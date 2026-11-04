/**
 * Run evals/questions.yaml against /api/vesta for every available engine (and always Offline).
 *
 *   npx tsx scripts/run-evals.ts [--base http://localhost:3000] [--engines groq,gemini,offline] [--delay groq=65] [--out evals/report.md]
 *
 * For a local server, start it with VESTA_EVAL_TOKEN=<16+ chars> and run this script with the same
 * variable: eval requests then skip the visitor rate limit and the answer cache. Never set it in production.
 * VESTA answers one request at a time per visitor, so run one engine list per server: parallel runs against one server get 429s.
 * Checks per question: expected tool used, facts present, sources, confidence (and expected value),
 * grounding (no "could not be verified"), expected dashboard view. If the engine fell back to another
 * engine (limit / outage) the question is reported as "unavailable" and left out of that engine's score.
 */
import fs from "node:fs";
import { parse } from "yaml";

interface Q {
  id: string;
  mission: string;
  question: string;
  expected_tools: string[];
  facts: (string | number)[];
  confidence?: string;
  expected_view?: string;
  offline: boolean;
}

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3000")!;
const OUT = arg("out", "evals/report.md")!;
const TOKEN = process.env.VESTA_EVAL_TOKEN;
const delays: Record<string, number> = { openrouter: 30, groq: 65, gemini: 15, claude: 2, offline: 0 };
for (const d of (arg("delay", "") ?? "").split(",").filter(Boolean)) {
  const [k, v] = d.split("=");
  delays[k] = Number(v);
}

interface Run {
  engineUsed: string;
  tools: string[];
  text: string;
  sources: number;
  confidence?: string;
  views: string[];
  ms: number;
  error?: string;
}

async function ask(engine: string, q: Q): Promise<Run> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/vesta`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(TOKEN ? { "x-eval-token": TOKEN } : {}) },
    body: JSON.stringify({ messages: [{ role: "user", content: q.question }], mission: q.mission, level: "researcher", engine }),
  });
  const raw = await res.text();
  const run: Run = { engineUsed: "?", tools: [], text: "", sources: 0, views: [], ms: 0 };
  if (!res.ok) {
    run.error = `HTTP ${res.status}: ${raw.slice(0, 120)}`;
    run.ms = Date.now() - t0;
    return run;
  }
  for (const block of raw.split("\n\n")) {
    const type = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!type) continue;
    const j = data ? JSON.parse(data) : {};
    if (type === "engine") run.engineUsed = j.id;
    if (type === "step" && j.status === "done") run.tools.push(j.tool);
    if (type === "text") run.text += j.delta;
    if (type === "sources") run.sources = j.sources.length;
    if (type === "confidence") run.confidence = j.confidence;
    if (type === "ui" && j.ui?.action === "go_view") run.views.push(j.ui.view);
    if (type === "error") run.error = j.message;
  }
  run.ms = Date.now() - t0;
  return run;
}

function hasNumber(text: string, n: number): boolean {
  const nums = (text.replace(/,(\d{3})/g, "$1").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const dec = String(n).includes(".") ? String(n).split(".")[1].length : 0;
  const tol = Math.max(0.5 * 10 ** -dec, Math.abs(n) * 0.005);
  return nums.some((x) => Math.abs(x - n) <= tol + 1e-9);
}

function grade(q: Q, r: Run) {
  const checks: [string, boolean][] = [
    ["tool", q.expected_tools.some((t) => r.tools.includes(t))],
    ...q.facts.map((f) => [`fact ${f}`, typeof f === "number" ? hasNumber(r.text, f) : new RegExp(f, "i").test(r.text)] as [string, boolean]),
    ["sources", r.sources > 0],
    ["confidence", !!r.confidence && (!q.confidence || r.confidence === q.confidence)],
    ["grounded", !/could not be verified/i.test(r.text)],
    ...(q.expected_view ? [["view", r.views.includes(q.expected_view)] as [string, boolean]] : []),
  ];
  return { pass: checks.every(([, ok]) => ok), failed: checks.filter(([, ok]) => !ok).map(([n]) => n) };
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

async function main() {
  const questions = (parse(fs.readFileSync("evals/questions.yaml", "utf8")) as { questions: Q[] }).questions;
  let engines = arg("engines")?.split(",");
  if (!engines) {
    const list = (await (await fetch(`${BASE}/api/vesta/engines`)).json()) as { id: string; available: boolean }[];
    engines = list.filter((e) => e.available && e.id !== "auto").map((e) => e.id);
    if (!engines.includes("offline")) engines.push("offline");
  }
  const lines: string[] = [
    "# VESTA eval report",
    "",
    `Generated ${new Date().toISOString()} against ${BASE} by scripts/run-evals.ts.`,
    "",
    "Checks per question: expected tool used · facts in the answer · sources · confidence tag (and expected value) · grounding · dashboard view. " +
      "\"unavailable\" = the engine could not answer (limit or outage) and VESTA fell back; those questions are left out of that engine's score. " +
      "Offline mode is scored only on the questions marked `offline: true`.",
    "",
  ];
  const summary: string[] = ["| Engine | Passed | Scored | Score | Unavailable |", "|---|---|---|---|---|"];
  for (const engine of engines) {
    const qs = engine === "offline" ? questions.filter((q) => q.offline) : questions;
    const rows: string[] = [];
    let passed = 0;
    let scored = 0;
    let unavailable = 0;
    for (const q of qs) {
      const r = await ask(engine, q);
      const fellBack = r.engineUsed !== engine;
      if (r.error && (r.engineUsed === "?" || !r.text)) {
        unavailable++;
        rows.push(`| ${q.id} | unavailable | ${r.error.replace(/\|/g, "/")} | ${r.ms} |`);
      } else if (fellBack) {
        unavailable++;
        rows.push(`| ${q.id} | unavailable | fell back to ${r.engineUsed} | ${r.ms} |`);
      } else {
        const g = grade(q, r);
        scored++;
        if (g.pass) passed++;
        rows.push(`| ${q.id} | ${g.pass ? "pass" : "FAIL"} | ${g.failed.join(", ") || "all checks"} (tools: ${[...new Set(r.tools)].join(", ") || "none"}) | ${r.ms} |`);
      }
      console.log(`${engine} ${q.id}: ${rows[rows.length - 1].split("|")[2].trim()}`);
      if (delays[engine]) await sleep(delays[engine]);
    }
    const score = scored ? Math.round((100 * passed) / scored) : 0;
    summary.push(`| ${engine} | ${passed} | ${scored} | ${scored ? `${score}%` : "n/a"} | ${unavailable} |`);
    lines.push(`## ${engine}`, "", "| Question | Result | Details | ms |", "|---|---|---|---|", ...rows, "");
  }
  const out = [...lines.slice(0, 6), "## Summary", "", ...summary, "", ...lines.slice(6)].join("\n");
  fs.writeFileSync(OUT, out);
  console.log(`\n${summary.join("\n")}\nwrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
