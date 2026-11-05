/**
 * HEARTH Blueprint scanner: reads the real project and returns every fact the page shows.
 * Nothing here reads API keys: fake engines run with an empty environment and the output is public.
 */
import fs from "node:fs";
import path from "node:path";
import { AI_DEADLINE_MS, CACHE_TTL_MS, clearVestaCache, COOLDOWN_MS, runVesta, type RouterDeps } from "@/lib/vesta/router";
import { MAX_INVALID_CALLS, MAX_TOOL_ROUNDS, TOOL_RESULT_MAX_CHARS } from "@/lib/vesta/agent";
import { ENGINE_LABELS, ENGINE_ORDER, engineModel, type EngineId } from "@/lib/vesta/engines";
import type { VestaEvent } from "@/lib/vesta/events";
import { checkGrounding, fixRequest, SMALL_INT_MAX } from "@/lib/vesta/grounding";
import { detectIntent } from "@/lib/vesta/offline";
import { PROVIDER_TIMEOUT_MS } from "@/lib/vesta/providers/anthropic";
import { EngineError, FRIENDLY_REASON, type Provider, type ProviderReply, type ToolResultMessage } from "@/lib/vesta/providers/types";
import { DATA_TOOLS, VESTA_TOOLS } from "@/lib/vesta/tools";
import { RANK_WEIGHTS } from "@/lib/analysis";
import { allChunks, allPdfTables, allTests, isCountable } from "@/lib/data";
import { rawRows } from "@/lib/dataset-export";
import { MISSIONS } from "@/lib/missions";
import { ENVELOPE_O2_WINDOW_PCT, ENVELOPE_P_WINDOW_PSI, ENVELOPE_SUPPORTED_MIN, FLOW_LOW_MAX, FLOW_STILL_MAX, ISS_PO2_PSI, pO2, ratioToISS } from "@/lib/physics";
import { vestaLimiter } from "@/lib/ratelimit";
import { INVESTIGATIONS } from "@/lib/types";
import { RAW_CLEAN } from "./stories";

/** An empty environment: the scan must never see a key or a configured model name. */
const NO_ENV = {} as NodeJS.ProcessEnv;
const ROOT = process.cwd();
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = (f: string) => fs.existsSync(path.join(ROOT, f));

function walk(dir: string, out: string[] = []): string[] {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out.sort();
}

function grab(file: string, re: RegExp): string | null {
  return read(file).match(re)?.[1] ?? null;
}
function grabNum(file: string, re: RegExp): number | null {
  const v = grab(file, re);
  return v == null ? null : Number(v);
}

// ------------------------------------------------------------------ import graph
const IMPORT_RE = /(?:^|\n)\s*(import|export)\s+(type\s+)?[^;'"]*?from\s+["']([^"']+)["']|\n\s*import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (exists(c) && fs.statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}

const importCache = new Map<string, string[]>();
function directImports(file: string): string[] {
  const hit = importCache.get(file);
  if (hit) return hit;
  const out = new Set<string>();
  if (/\.tsx?$/.test(file)) {
    const src = read(file);
    for (const m of src.matchAll(IMPORT_RE)) {
      if (m[2]) continue; // import type: erased at build time
      const r = resolveImport(file, m[3] ?? m[4] ?? m[5]);
      if (!r) continue;
      // Borrowing only a constant from a component (INV_COLORS) does not mean using that component or its data.
      const names = m[0].match(/\{([^}]*)\}/)?.[1];
      const constantsOnly = !!names && r.startsWith("components/") && names.split(",").map((n) => n.trim().replace(/^type\s+.*/, "")).filter(Boolean).every((n) => /^[A-Z0-9_]+(\s+as\s+\w+)?$/.test(n));
      if (!constantsOnly) out.add(r);
    }
  }
  const list = [...out].sort();
  importCache.set(file, list);
  return list;
}

function reach(start: string, stopAt: string[] = []): string[] {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    for (const n of directImports(stack.pop() as string)) {
      if (seen.has(n) || stopAt.includes(n)) continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return [...seen].sort();
}

/** VESTA lives on every page, so a page's "Ask VESTA" button should not make the whole of VESTA look like part of that page. */
const VESTA_CLIENT = ["components/vesta/useVesta.ts"];

// ------------------------------------------------------------------ project structure
/** lib files that are plumbing, not a brain of their own. */
const PLUMBING = new Set(["lib/types.ts", "lib/util.ts", "lib/api.ts"]);

function libNode(file: string): string | null {
  if (file.startsWith("lib/vesta/")) return "lib/vesta";
  if (/^lib\/[^/]+\.ts$/.test(file) && !PLUMBING.has(file)) return file;
  return null;
}
const libsOf = (files: string[]) => [...new Set(files.map(libNode).filter((x): x is string => !!x))].sort();
const dataOf = (files: string[]) => files.filter((f) => f.startsWith("data/processed/")).sort();

function routePath(file: string): string {
  return `/${file.replace(/^app\//, "").replace(/\/?(route\.ts|page\.tsx)$/, "")}`;
}

export interface RouteInfo {
  path: string;
  methods: string[];
  libs: string[];
  data: string[];
  file: string;
}

function scanRoutes(): RouteInfo[] {
  return walk("app/api")
    .filter((f) => f.endsWith("/route.ts"))
    .map((file) => {
      const reached = reach(file);
      const methods = [...read(file).matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      return { path: routePath(file), methods, libs: libsOf(reached), data: dataOf(reached), file };
    });
}

function matchRoute(url: string, routes: RouteInfo[]): string | null {
  const parts = url.split("?")[0].split("/");
  for (const r of routes) {
    const rp = r.path.split("/");
    if (rp.length !== parts.length) continue;
    if (rp.every((seg, i) => (seg.startsWith("[") ? true : seg === parts[i]))) return r.path;
  }
  return null;
}

function apisOf(files: string[], routes: RouteInfo[]): string[] {
  const out = new Set<string>();
  for (const f of files) {
    if (!/^(components|app|lib)\//.test(f) || !/\.tsx?$/.test(f) || f.startsWith("app/api/")) continue;
    for (const m of read(f).matchAll(/["'`](\/api\/[\w\-./]*)/g)) {
      const hit = matchRoute(m[1], routes);
      if (hit) out.add(hit);
    }
  }
  return [...out].sort();
}

export interface PageInfo {
  path: string;
  label: string;
  file: string;
  components: string[];
  apis: string[];
  libs: string[];
}

function scanPages(routes: RouteInfo[]): PageInfo[] {
  const nav = read("components/layout/SideNav.tsx");
  const labels = [...nav.matchAll(/href:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map((m) => ({ href: m[1], label: m[2] }));
  const order = labels.map((l) => l.href);
  const rank = (p: string) => {
    const i = order.indexOf(p);
    return i < 0 ? 999 : i;
  };
  return walk("app")
    .filter((f) => f.endsWith("/page.tsx"))
    .map((file) => {
      const p = routePath(file);
      const reached = reach(file, VESTA_CLIENT);
      return {
        path: p === "/" ? "/" : p.replace(/\/$/, ""),
        label: labels.find((l) => l.href === p)?.label ?? p,
        file,
        components: reached.filter((f) => f.startsWith("components/")),
        apis: apisOf(reached, routes),
        libs: libsOf(reached),
      };
    })
    .sort((a, b) => rank(a.path) - rank(b.path));
}

function scanTests() {
  return walk("tests")
    .filter((f) => f.endsWith(".test.ts"))
    .map((file) => ({ file, count: (read(file).match(/^\s*(?:it|test)(?:\.each\(.*\))?\(/gm) ?? []).length }));
}

// ------------------------------------------------------------------ data
function scanInvestigations() {
  const tests = allTests();
  const chunks = allChunks();
  const tables = allPdfTables();
  const report = read("data/processed/ingest_report.md");
  return INVESTIGATIONS.map((id) => {
    const row = report.match(new RegExp(`\\|\\s*${id}\\s*\\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|`));
    const own = tests.filter((t) => t.investigation === id);
    return {
      id,
      rows: own.length,
      counted: own.filter(isCountable).length,
      duplicates: own.length - own.filter(isCountable).length,
      rangeFails: row ? Number(row[3]) : 0,
      chunks: chunks.filter((c) => c.investigation === id).length,
      tables: tables.filter((c) => c.source_file.includes(`/${id}/`)).length,
    };
  });
}

interface RawEntry {
  investigation: string;
  kind: string;
  file: string;
  bytes: number;
  pages?: number;
  rows?: number;
}

function scanSamples() {
  const raw = rawRows(ROOT);
  if (!raw.available) return [];
  const clean = ["test_id", "fuel", "o2_pct", "pressure_psi", "flow_cm_s", "size_mm", "key_metric_name", "key_metric_value", "outcome", "flags"] as const;
  return INVESTIGATIONS.map((inv) => {
    const t = allTests().find((x) => x.investigation === inv && isCountable(x) && !x.flags.includes("layout_shifted"));
    if (!t) return null;
    const file = raw.files[t.source_file];
    const values = file?.rows[t.source_row - 2];
    if (!values) return null;
    const rec = t as unknown as Record<string, unknown>;
    return {
      investigation: inv,
      file: t.source_file,
      row: t.source_row,
      columns: file.columns,
      values,
      clean: Object.fromEntries(clean.map((k) => [k, rec[k] ?? null])),
      mapping: RAW_CLEAN[inv] ?? [],
    };
  }).filter((x) => !!x);
}

/** Two neighbouring passages from one PDF page that really overlap. */
function scanChunkSample() {
  const all = allChunks();
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i];
    const b = all[i + 1];
    if (a.source_file !== b.source_file || a.page !== b.page || !a.source_file.includes("Report")) continue;
    let overlap = 0;
    for (let n = Math.min(a.text.length, b.text.length); n >= 30; n--) {
      if (a.text.endsWith(b.text.slice(0, n))) {
        overlap = n;
        break;
      }
    }
    if (overlap) return { file: a.source_file, page: a.page, first: a.text, second: b.text, overlap, firstId: a.chunk_id, secondId: b.chunk_id };
  }
  return null;
}

// ------------------------------------------------------------------ real VESTA recordings (no AI, no keys)
const REPLAY_QUESTIONS = [
  { id: "assess", label: "Is my rover cabin tested?", question: "Is 34% O2 at 8.2 psi tested?" },
  { id: "gap", label: "A place nobody tested", question: "Is 90% O2 at 40 psi tested?" },
  { id: "compare", label: "Compare two experiments", question: "Compare ACME and SPICE" },
  { id: "missing", label: "What's missing?", question: "What data is missing for the lunar rover?" },
  { id: "rank", label: "Which matters most?", question: "Which investigation is most relevant for the Moon base?" },
  { id: "audit", label: "Safety audit", question: "Run a safety audit for the rover" },
  { id: "test", label: "Explain one test", question: "Explain ACME-CFIG-128" },
];

const NO_KEYS: RouterDeps = { providers: {}, env: NO_ENV, useCache: false, chunkDelayMs: 0, log: () => {} };

type Recorded =
  | Exclude<VestaEvent, { type: "chart" } | { type: "text" }>
  | { type: "chart"; title: string }
  | { type: "text"; text: string; pieces: number };

function compact(events: VestaEvent[]): Recorded[] {
  const out: Recorded[] = [];
  for (const e of events) {
    if (e.type === "chart") {
      out.push({ type: "chart", title: e.chart.title ?? "Chart" });
    } else if (e.type === "text") {
      const last = out[out.length - 1];
      if (last?.type === "text") {
        last.text += e.delta;
        last.pieces++;
      } else out.push({ type: "text", text: e.delta, pieces: 1 });
    } else out.push(e);
  }
  return out;
}

async function recordReplays() {
  const out = [];
  for (const q of REPLAY_QUESTIONS) {
    clearVestaCache();
    const events: VestaEvent[] = [];
    await runVesta({ messages: [{ role: "user", content: q.question }], missionId: "lunar-rover", level: "researcher", engine: "offline" }, (e) => events.push(e), NO_KEYS);
    out.push({ ...q, intent: detectIntent(q.question), events: compact(events) });
  }
  return out;
}

type AiId = Exclude<EngineId, "offline">;
const AI_IDS = ENGINE_ORDER.filter((e): e is AiId => e !== "offline");

function fakeProvider(id: AiId, fail?: EngineError): Provider {
  return {
    id,
    model: engineModel(id, NO_ENV),
    startSession: () => ({
      async send(): Promise<ProviderReply> {
        if (fail) throw fail;
        return { text: "Scripted answer.", toolCalls: [], stop: "end" };
      },
      addToolResults() {},
      addUserText() {},
    }),
  };
}

/** Runs the real router against every mix of working / missing / limited engines. */
async function recordFallback() {
  const states = ["ok", "nokey", "limit"] as const;
  const results: Record<string, { path: string[]; winner: string; note: string | null; badge: string }> = {};
  const total = states.length ** AI_IDS.length;
  for (let n = 0; n < total; n++) {
    const pick = AI_IDS.map((_, i) => states[Math.floor(n / states.length ** i) % states.length]);
    const providers: NonNullable<RouterDeps["providers"]> = {};
    AI_IDS.forEach((id, i) => {
      if (pick[i] === "ok") providers[id] = fakeProvider(id);
      if (pick[i] === "limit") providers[id] = fakeProvider(id, new EngineError("rate_limit"));
    });
    clearVestaCache();
    const engines: Extract<VestaEvent, { type: "engine" }>[] = [];
    await runVesta(
      { messages: [{ role: "user", content: "Is 34% O2 at 8.2 psi tested?" }], missionId: "lunar-rover", level: "researcher", engine: "auto" },
      (e) => {
        if (e.type === "engine") engines.push(e);
      },
      { ...NO_KEYS, providers },
    );
    const last = engines[engines.length - 1];
    results[pick.join("|")] = { path: engines.map((e) => e.id), winner: last.id, note: last.note ?? null, badge: last.badge };
  }
  clearVestaCache();
  return { states: [...states], results };
}

/** A scripted model writes a made-up number; the real agent and grounding check catch it. */
async function recordGrounding() {
  const invented = "777.7";
  let results: ToolResultMessage[] = [];
  let sends = 0;
  let fix: string | null = null;
  let bad = "";
  const provider: Provider = {
    id: "claude",
    model: "scripted-demo-model",
    startSession: () => ({
      async send(): Promise<ProviderReply> {
        sends++;
        if (sends === 1) return { text: "", toolCalls: [{ id: "a", name: "envelope_check", args: { o2_pct: 34, pressure_psi: 8.2 } }], stop: "tool_use" };
        if (sends === 2) {
          bad = `A cabin at 34% O2 and 8.2 psi has ${invented} tests nearby, trust me.\nConfidence: supported`;
          return { text: bad, toolCalls: [], stop: "end" };
        }
        const count = (JSON.parse(results[0].content) as { data?: { count?: number } }).data?.count;
        return { text: `A cabin at 34% O2 and 8.2 psi has ${count} tests nearby.\nConfidence: supported`, toolCalls: [], stop: "end" };
      },
      addToolResults(r) {
        results = r;
      },
      addUserText(t) {
        fix = t;
      },
    }),
  };
  clearVestaCache();
  const events: VestaEvent[] = [];
  await runVesta({ messages: [{ role: "user", content: "Is 34% O2 at 8.2 psi tested?" }], missionId: "lunar-rover", level: "researcher", engine: "claude" }, (e) => events.push(e), {
    ...NO_KEYS,
    providers: { claude: provider },
  });
  clearVestaCache();
  const rec = compact(events);
  const step = rec.find((e): e is Extract<Recorded, { type: "step" }> => e.type === "step" && e.status === "done");
  const finalText = rec.find((e): e is Extract<Recorded, { type: "text" }> => e.type === "text")?.text ?? "";
  const conf = rec.find((e): e is Extract<Recorded, { type: "confidence" }> => e.type === "confidence");
  return {
    invented,
    caught: !!fix && checkGrounding(bad, new Set()).unverified.includes(invented),
    badText: bad.replace(/\nConfidence:.*/, ""),
    toolSummary: step?.summary ?? "",
    fixRequest: fix ?? fixRequest([invented]),
    finalText,
    confidence: conf?.confidence ?? null,
  };
}

// ------------------------------------------------------------------ the manifest
export async function scanProject() {
  const tests = allTests();
  const counted = tests.filter(isCountable);
  const invs = scanInvestigations();
  const sources = JSON.parse(read("data/processed/sources.json")) as { raw: RawEntry[] };
  const routes = scanRoutes();
  const pages = scanPages(routes);
  const testFiles = scanTests();
  const libs = [...new Set(walk("lib").map(libNode).filter((x): x is string => !!x))].sort();
  const libEdges = Object.fromEntries(
    libs.map((l) => {
      // Direct reads only: every module reaches the files through lib/data.ts, which is the trail worth drawing.
      return [l, l === "lib/vesta" ? [] : dataOf(directImports(l))];
    }),
  );
  const shell = directImports("components/layout/AppShell.tsx").filter((f) => f.startsWith("components/") && f.endsWith(".tsx"));
  const shellFiles = reach("app/layout.tsx");
  const everyPage: PageInfo = {
    path: "every page",
    label: "On every page",
    file: "components/layout/AppShell.tsx",
    components: shellFiles.filter((f) => f.startsWith("components/")),
    apis: apisOf(shellFiles, routes),
    libs: libsOf(shellFiles),
  };
  const components = walk("components").filter((f) => f.endsWith(".tsx"));
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const processed = walk("data/processed").map((file) => ({ file, name: path.posix.basename(file) }));
  const evalMatch = read("evals/report-offline.md").match(/\|\s*offline\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/i);
  const pyReq = read("scripts/ingest/requirements.txt")
    .split(/\r?\n/)
    .map((l) => l.trim().split(/[=<>~\s#]/)[0])
    .filter(Boolean);

  const facts: Record<string, number | string> = {
    rawFiles: sources.raw.length,
    rawCsv: sources.raw.filter((r) => r.kind === "table").length,
    rawPdf: sources.raw.filter((r) => r.pages != null).length,
    pdfPages: sources.raw.reduce((n, r) => n + (r.pages ?? 0), 0),
    testsTotal: tests.length,
    testsCounted: counted.length,
    duplicates: tests.length - counted.length,
    rangeFails: invs.reduce((n, i) => n + i.rangeFails, 0),
    chunks: allChunks().length,
    tables: allPdfTables().length,
    chunkSize: grabNum("scripts/ingest/ingest.py", /^CHUNK_SIZE = (\d+)/m) ?? "?",
    chunkOverlap: grabNum("scripts/ingest/ingest.py", /^CHUNK_OVERLAP = (\d+)/m) ?? "?",
    barToPsi: grabNum("scripts/ingest/ingest.py", /^BAR_TO_PSI = ([\d.]+)/m) ?? "?",
    atmToPsi: grabNum("scripts/ingest/ingest.py", /^ATM_TO_PSI = ([\d.]+)/m) ?? "?",
    kpaToPsi: grabNum("scripts/ingest/ingest.py", /^KPA_TO_PSI = ([\d.]+)/m) ?? "?",
    toolCount: VESTA_TOOLS.length,
    dataToolCount: DATA_TOOLS.length,
    actionToolCount: VESTA_TOOLS.length - DATA_TOOLS.length,
    routeCount: routes.length,
    pageCount: pages.length,
    engineCount: ENGINE_ORDER.length,
    aiEngineCount: AI_IDS.length,
    componentCount: components.length,
    libCount: libs.length,
    testFiles: testFiles.length,
    testBlocks: testFiles.reduce((n, t) => n + t.count, 0),
    evalQuestions: (read("evals/questions.yaml").match(/^\s*-\s*id:/gm) ?? []).length,
    evalOffline: evalMatch ? `${evalMatch[1]}/${evalMatch[2]}` : "not run",
    maxToolRounds: MAX_TOOL_ROUNDS,
    maxInvalid: MAX_INVALID_CALLS,
    toolResultMax: TOOL_RESULT_MAX_CHARS,
    cacheMin: CACHE_TTL_MS / 60_000,
    cooldownShortS: (COOLDOWN_MS.rate_limit ?? 0) / 1000,
    cooldownLongMin: (COOLDOWN_MS.auth ?? 0) / 60_000,
    aiDeadlineS: AI_DEADLINE_MS / 1000,
    engineTimeoutS: PROVIDER_TIMEOUT_MS / 1000,
    functionMaxS: grabNum("app/api/vesta/route.ts", /maxDuration = (\d+)/) ?? "?",
    rateLimit: vestaLimiter.limit,
    rateWindowMin: vestaLimiter.windowMs / 60_000,
    maxMsgChars: grabNum("app/api/vesta/route.ts", /MAX_MESSAGE_CHARS = (\d+)/) ?? "?",
    maxMsgs: grabNum("app/api/vesta/route.ts", /MAX_MESSAGES = (\d+)/) ?? "?",
    historyMsgs: grabNum("components/vesta/useVesta.ts", /\.slice\(-(\d+)\)/) ?? "?",
    apiCacheMin: (grabNum("lib/api.ts", /s-maxage=(\d+)/) ?? 0) / 60,
    envO2: ENVELOPE_O2_WINDOW_PCT,
    envP: ENVELOPE_P_WINDOW_PSI,
    envMin: ENVELOPE_SUPPORTED_MIN,
    envSparseMax: ENVELOPE_SUPPORTED_MIN - 1,
    smallIntMax: SMALL_INT_MAX,
    issPo2: ISS_PO2_PSI,
    flowStill: FLOW_STILL_MAX,
    flowLow: FLOW_LOW_MAX,
    rankProx: RANK_WEIGHTS.proximity,
    rankO2: RANK_WEIGHTS.o2_coverage,
    rankP: RANK_WEIGHTS.pressure_coverage,
    rankEnv: RANK_WEIGHTS.envelope_tests,
    fallbackRuns: 3 ** AI_IDS.length,
    missionCount: MISSIONS.length,
  };

  return {
    facts,
    investigations: invs,
    raw: sources.raw.map((r) => ({ investigation: r.investigation, kind: r.kind, file: r.file, name: path.posix.basename(r.file), bytes: r.bytes, pages: r.pages ?? null, rows: r.rows ?? null })),
    processed,
    samples: scanSamples(),
    chunkSample: scanChunkSample(),
    points: counted.filter((t) => t.o2_pct != null && t.pressure_psi != null).map((t) => [INVESTIGATIONS.indexOf(t.investigation), t.o2_pct, t.pressure_psi, t.test_id] as const),
    missions: MISSIONS.map((m) => ({ id: m.id, short: m.short, o2: m.o2_pct, p: m.pressure_psi, po2: pO2(m.o2_pct, m.pressure_psi), ratio: ratioToISS(m.o2_pct, m.pressure_psi).value })),
    engines: ENGINE_ORDER.map((id) => ({ id, label: ENGINE_LABELS[id], model: engineModel(id, NO_ENV) })),
    reasons: FRIENDLY_REASON,
    tools: VESTA_TOOLS.map((t) => ({ name: t.name, description: t.description, kind: DATA_TOOLS.includes(t) ? "data" : "action", file: `lib/vesta/tools/${t.name}.ts` })),
    routes,
    pages,
    everyPage,
    shell,
    libs,
    libEdges,
    tests: testFiles,
    deps: Object.entries(pkg.dependencies).map(([name, version]) => ({ name, version: version.replace(/^[\^~]/, "") })),
    pythonDeps: pyReq,
    replays: await recordReplays(),
    fallback: await recordFallback(),
    grounding: await recordGrounding(),
  };
}

export type Scan = Awaited<ReturnType<typeof scanProject>>;
