import testsJson from "@/data/processed/tests.json";
import chunksJson from "@/data/processed/chunks.json";
import tablesJson from "@/data/processed/pdf_tables.json";
import {
  ChunkSchema,
  INVESTIGATIONS,
  PdfTableSchema,
  TestRecordSchema,
  type Chunk,
  type Investigation,
  type PdfTable,
  type Source,
  type TestRecord,
} from "./types";
import { z } from "zod";
import { isCountable, rowRanges, stats } from "./util";

export { isCountable, rowRanges, round, stats } from "./util";
export type { NumStats } from "./util";

let _tests: TestRecord[] | null = null;
let _chunks: Chunk[] | null = null;
let _tables: PdfTable[] | null = null;
let _byId: Map<string, TestRecord> | null = null;

/** All tests, validated once. Includes flagged duplicates; use `countable` for statistics. */
export function allTests(): TestRecord[] {
  if (!_tests) _tests = z.array(TestRecordSchema).parse(testsJson);
  return _tests;
}

export function allChunks(): Chunk[] {
  if (!_chunks) _chunks = z.array(ChunkSchema).parse(chunksJson);
  return _chunks;
}

export function allPdfTables(): PdfTable[] {
  if (!_tables) _tables = z.array(PdfTableSchema).parse(tablesJson);
  return _tables;
}

export function getTest(id: string): TestRecord | undefined {
  if (!_byId) _byId = new Map(allTests().map((t) => [t.test_id.toUpperCase(), t]));
  return _byId.get(id.trim().toUpperCase());
}

export function countable(tests: TestRecord[] = allTests()): TestRecord[] {
  return tests.filter(isCountable);
}

export interface TestFilter {
  investigation?: Investigation[];
  fuel_phase?: string;
  fuel?: string;
  campaign?: string;
  o2_min?: number;
  o2_max?: number;
  pressure_min?: number;
  pressure_max?: number;
  flow_min?: number;
  flow_max?: number;
  q?: string;
  include_duplicates?: boolean;
}

export function filterTests(f: TestFilter = {}): TestRecord[] {
  const q = f.q?.trim().toLowerCase();
  const fuel = f.fuel?.trim().toLowerCase();
  const campaign = f.campaign?.trim().toLowerCase();
  return allTests().filter((t) => {
    if (!f.include_duplicates && !isCountable(t)) return false;
    if (f.investigation?.length && !f.investigation.includes(t.investigation)) return false;
    if (f.fuel_phase && t.fuel_phase !== f.fuel_phase) return false;
    if (fuel && !(t.fuel ?? "").toLowerCase().includes(fuel)) return false;
    if (campaign && !(t.campaign ?? "").toLowerCase().includes(campaign)) return false;
    if (f.o2_min != null && (t.o2_pct == null || t.o2_pct < f.o2_min)) return false;
    if (f.o2_max != null && (t.o2_pct == null || t.o2_pct > f.o2_max)) return false;
    if (f.pressure_min != null && (t.pressure_psi == null || t.pressure_psi < f.pressure_min)) return false;
    if (f.pressure_max != null && (t.pressure_psi == null || t.pressure_psi > f.pressure_max)) return false;
    if (f.flow_min != null && (t.flow_cm_s == null || t.flow_cm_s < f.flow_min)) return false;
    if (f.flow_max != null && (t.flow_cm_s == null || t.flow_cm_s > f.flow_max)) return false;
    if (q) {
      const hay = [t.test_id, t.fuel, t.campaign, t.geometry, t.outcome, t.notes, t.hardware].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = "test_id" | "investigation" | "fuel" | "o2_pct" | "pressure_psi" | "flow_cm_s" | "size_mm" | "key_metric_value";
export const SORT_KEYS: SortKey[] = ["test_id", "investigation", "fuel", "o2_pct", "pressure_psi", "flow_cm_s", "size_mm", "key_metric_value"];

export function sortTests(tests: TestRecord[], sort = "test_id"): TestRecord[] {
  const desc = sort.startsWith("-");
  const key = (desc ? sort.slice(1) : sort) as SortKey;
  if (!SORT_KEYS.includes(key)) return tests;
  const dir = desc ? -1 : 1;
  return [...tests].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // nulls always last
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
  });
}

/** Sources for a set of tests: up to `maxRows` row-level citations, plus one range citation per file. */
export function sourcesFor(tests: TestRecord[], maxRows = 8): Source[] {
  const out: Source[] = tests.slice(0, maxRows).map((t) => ({ file: t.source_file, row: t.source_row, test_id: t.test_id }));
  if (tests.length > maxRows) {
    const byFile = new Map<string, number[]>();
    for (const t of tests) byFile.set(t.source_file, [...(byFile.get(t.source_file) ?? []), t.source_row]);
    for (const [file, rows] of byFile) out.push({ file, rows: rowRanges(rows), note: `${rows.length} rows` });
  }
  return out;
}

export function investigationsSummary() {
  return INVESTIGATIONS.map((inv) => {
    const ts = countable().filter((t) => t.investigation === inv);
    return {
      investigation: inv,
      tests: ts.length,
      o2: stats(ts.map((t) => t.o2_pct)),
      pressure: stats(ts.map((t) => t.pressure_psi)),
      flow: stats(ts.map((t) => t.flow_cm_s)),
      fuels: [...new Set(ts.map((t) => t.fuel).filter(Boolean))] as string[],
      fuel_phases: [...new Set(ts.map((t) => t.fuel_phase).filter(Boolean))] as string[],
      campaigns: [...new Set(ts.map((t) => t.campaign).filter(Boolean))] as string[],
    };
  });
}

/** Compact row for tables / tool output. */
export function compact(t: TestRecord) {
  return {
    test_id: t.test_id,
    investigation: t.investigation,
    campaign: t.campaign,
    fuel: t.fuel,
    fuel_phase: t.fuel_phase,
    geometry: t.geometry,
    o2_pct: t.o2_pct,
    pressure_psi: t.pressure_psi,
    flow_cm_s: t.flow_cm_s,
    size_mm: t.size_mm,
    outcome: t.outcome,
    key_metric_name: t.key_metric_name,
    key_metric_value: t.key_metric_value,
    source_file: t.source_file,
    source_row: t.source_row,
    flags: t.flags,
  };
}
export type CompactTest = ReturnType<typeof compact>;
