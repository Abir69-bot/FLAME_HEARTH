/** Turns a scan + the stories into one self-contained HTML file. Deterministic for the same input. */
import fs from "node:fs";
import path from "node:path";
import type { Scan } from "./scan";
import { RAW_CLEAN, STORIES } from "./stories";

export const OUTPUT = "public/blueprint.html";
const DIR = "scripts/blueprint";

export interface Volatile {
  scan: { at: string; commit: string | null; subject: string | null };
  history: { hash: string; date: string; subject: string }[];
  changes: { date: string; added: string[]; removed: string[] }[];
}

export type Manifest = Scan & Volatile & { stories: typeof STORIES; unexplained: { kind: string; id: string }[]; orphans: { kind: string; id: string }[] };

const lf = (s: string) => s.replace(/\r\n/g, "\n");
const part = (name: string) => lf(fs.readFileSync(path.join(process.cwd(), DIR, name), "utf8"));

/** Replace {{fact}} everywhere; an unknown fact stays visible so the test can catch it. */
export function fill<T>(value: T, facts: Record<string, number | string>): T {
  if (typeof value === "string") return value.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in facts ? String(facts[k]) : m)) as T;
  if (Array.isArray(value)) return value.map((v) => fill(v, facts)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, facts)])) as T;
  return value;
}

/** Things the scanner found that have no plain-language story, and stories for things that no longer exist. */
export function audit(scan: Scan) {
  const groups: [string, string[], string[]][] = [
    ["page", [...scan.pages.map((p) => p.path), scan.everyPage.path], Object.keys(STORIES.pages)],
    ["route", scan.routes.map((r) => r.path), Object.keys(STORIES.routes)],
    ["tool", scan.tools.map((t) => t.name), Object.keys(STORIES.tools)],
    ["engine", scan.engines.map((e) => e.id), Object.keys(STORIES.engines)],
    ["module", scan.libs, Object.keys(STORIES.libs)],
    ["shell", scan.shell, Object.keys(STORIES.shell)],
    ["dependency", scan.deps.map((d) => d.name), Object.keys(STORIES.deps)],
  ];
  const unexplained: { kind: string; id: string }[] = [];
  const orphans: { kind: string; id: string }[] = [];
  for (const [kind, found, told] of groups) {
    for (const id of found) if (!told.includes(id)) unexplained.push({ kind, id });
    for (const id of told) if (!found.includes(id)) orphans.push({ kind, id });
  }
  return { unexplained, orphans };
}

/** The ids whose appearance or removal is worth logging. */
export function structuralIds(s: Pick<Scan, "pages" | "routes" | "tools" | "engines" | "libs">): string[] {
  return [...s.pages.map((p) => `page ${p.path}`), ...s.routes.map((r) => `route ${r.path}`), ...s.tools.map((t) => `tool ${t.name}`), ...s.engines.map((e) => `engine ${e.id}`), ...s.libs.map((l) => `module ${l}`)];
}

export function assemble(scan: Scan, vol: Volatile): Manifest {
  const { unexplained, orphans } = audit(scan);
  const filledScan = { ...scan, samples: scan.samples.map((x) => ({ ...x, mapping: fill(RAW_CLEAN[x.investigation] ?? [], scan.facts) })) };
  return { ...filledScan, ...vol, stories: fill(STORIES, scan.facts), unexplained, orphans };
}

export function renderHtml(m: Manifest): string {
  const data = JSON.stringify(m).replace(/</g, "\\u003c");
  const parts: Record<string, string> = {
    "__STYLE__": part("style.css"),
    "__DATA__": data,
    "__LOGIC__": part("logic.js"),
    "__PAGE__": part("page.js"),
  };
  return part("template.html").replace(/__STYLE__|__DATA__|__LOGIC__|__PAGE__/g, (k) => parts[k]);
}

export function readManifest(html: string): Manifest | null {
  const m = html.match(/<script type="application\/json" id="blueprint-data">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Manifest;
  } catch {
    return null;
  }
}

export function normalise(html: string): string {
  return lf(html);
}
