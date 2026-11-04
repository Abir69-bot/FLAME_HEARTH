/** The dataset's profile for the /dataset page. Every number is computed here from the processed data. */
import sourcesJson from "@/data/processed/sources.json";
import { allChunks, allPdfTables, allTests, isCountable, round, stats, type NumStats } from "./data";
import { EXTRA_DOCS, FIELD_DOCS, FLAG_DOCS, INVESTIGATION_DOCS, REFERENCE_DOCS, type FieldDoc, type FlagDoc, type InvestigationDoc, type ReferenceDoc } from "./dataset-docs";
import { INVESTIGATIONS, type Investigation, type TestRecord } from "./types";

export type InvCounts = Record<Investigation, number>;

export interface RawFile {
  investigation: string;
  kind: string;
  file: string;
  bytes: number;
  sha256: string;
  pages?: number;
  rows?: number;
  blank_rows?: number;
  columns?: string[];
}

export const SOURCES = sourcesJson as { raw: RawFile[]; processed: { file: string; bytes: number }[] };

export interface SplitRow {
  label: string;
  counts: InvCounts;
}

export interface SplitDimension {
  id: string;
  label: string;
  question: string;
  all: SplitRow[];
  counted: SplitRow[];
}

export interface HistBin {
  label: string;
  counts: InvCounts;
}

export interface InvStats extends NumStats {
  median: number | null;
  missing: number;
}

export interface Distribution {
  id: string;
  label: string;
  unit: string;
  note: string;
  bins: HistBin[];
  stats: Record<Investigation, InvStats>;
}

export interface FieldProfile extends FieldDoc {
  fill: InvCounts;
  examples: Record<Investigation, string | null>;
}

export interface ExtraProfile {
  investigation: Investigation;
  key: string;
  unit?: string;
  meaning: string;
  filled: number;
  rows: number;
  example: string | null;
}

export interface InvestigationProfile extends InvestigationDoc {
  rows: number;
  counted: number;
  duplicates: number;
  share: number;
  o2: NumStats;
  pressure: NumStats;
  size: NumStats;
  flow: NumStats;
  fuels: { label: string; n: number }[];
  geometries: { label: string; n: number }[];
  sensors: string[];
  measurements: string[];
  hardware: string[];
  columns: string[];
  rawRows: number;
  blankRows: number;
  files: RawFile[];
  chunks: number;
  tables: number;
  pages: number;
  span: string | null;
}

export interface FlagProfile extends FlagDoc {
  count: number;
  counts: InvCounts;
  samples: string[];
}

export interface ReferenceProfile extends ReferenceDoc {
  investigation: string;
  kind: string;
  bytes: number;
  sha256: string;
  pages?: number;
  rows?: number;
}

export interface DatasetProfile {
  totals: {
    rows: number;
    counted: number;
    duplicates: number;
    investigations: number;
    fuels: number;
    fields: number;
    extraFields: number;
    rawFiles: number;
    rawBytes: number;
    pdfs: number;
    pdfPages: number;
    chunks: number;
    pdfTables: number;
    withOutcome: number;
    withMetric: number;
    processedBytes: number;
  };
  byInvestigation: { id: Investigation; rows: number; counted: number }[];
  dimensions: SplitDimension[];
  fields: FieldProfile[];
  extras: ExtraProfile[];
  investigations: InvestigationProfile[];
  distributions: Distribution[];
  flags: FlagProfile[];
  failedChecks: { test_id: string; row: number; value: number | null }[];
  references: ReferenceProfile[];
  labelled: Record<Investigation, { outcome: number; metric: number; metricName: string | null }>;
  processed: { file: string; bytes: number }[];
}

const zero = (): InvCounts => ({ ACME: 0, CFI: 0, SPICE: 0 });
const isFilled = (v: unknown) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0);

function groupRows(rows: TestRecord[], key: (t: TestRecord) => string): SplitRow[] {
  const m = new Map<string, InvCounts>();
  for (const t of rows) {
    const k = key(t);
    if (!m.has(k)) m.set(k, zero());
    m.get(k)![t.investigation]++;
  }
  const total = (c: InvCounts) => c.ACME + c.CFI + c.SPICE;
  return [...m.entries()].map(([label, counts]) => ({ label, counts })).sort((a, b) => total(b.counts) - total(a.counts) || a.label.localeCompare(b.label));
}

/** Bands keep a fixed order, so a chart never reshuffles them by size. */
function bandRows(rows: TestRecord[], bands: { label: string; test: (t: TestRecord) => boolean }[]): SplitRow[] {
  return bands
    .map(({ label, test }) => {
      const counts = zero();
      for (const t of rows) if (test(t)) counts[t.investigation]++;
      return { label, counts };
    })
    .filter((r) => r.counts.ACME + r.counts.CFI + r.counts.SPICE > 0);
}

function dimensions(all: TestRecord[], counted: TestRecord[]): SplitDimension[] {
  const grouped = (id: string, label: string, question: string, key: (t: TestRecord) => string): SplitDimension => ({ id, label, question, all: groupRows(all, key), counted: groupRows(counted, key) });
  const banded = (id: string, label: string, question: string, bands: { label: string; test: (t: TestRecord) => boolean }[]): SplitDimension => ({ id, label, question, all: bandRows(all, bands), counted: bandRows(counted, bands) });
  const o2 = (t: TestRecord) => t.o2_pct ?? -1;
  const p = (t: TestRecord) => t.pressure_psi ?? -1;
  return [
    grouped("investigation", "Investigation", "Which experiment did each test come from?", (t) => t.investigation),
    grouped("campaign", "Campaign", "Which campaign inside each investigation?", (t) => t.campaign ?? "not recorded"),
    grouped("fuel", "Fuel", "What was burning?", (t) => t.fuel ?? "not recorded"),
    grouped("phase", "Fuel phase", "Gas, liquid or solid?", (t) => t.fuel_phase ?? "not recorded"),
    grouped("geometry", "Flame shape", "What kind of flame or droplet?", (t) => t.geometry ?? "not recorded"),
    banded("o2", "O2 band", "How much oxygen, compared with Earth air at 21%?", [
      { label: "Below 21%", test: (t) => o2(t) >= 0 && o2(t) < 21 },
      { label: "Exactly 21%", test: (t) => o2(t) === 21 },
      { label: "Above 21%, up to 30%", test: (t) => o2(t) > 21 && o2(t) <= 30 },
      { label: "Above 30%, up to 40%", test: (t) => o2(t) > 30 && o2(t) <= 40 },
      { label: "Above 40%", test: (t) => o2(t) > 40 },
    ]),
    banded("pressure", "Pressure band", "How much pressure, compared with habitat limits?", [
      { label: "Up to 10.2 psi (Moon base limit)", test: (t) => p(t) >= 0 && p(t) <= 10.2 },
      { label: "Above 10.2, up to 14.7 psi (ISS)", test: (t) => p(t) > 10.2 && p(t) <= 14.7 },
      { label: "Above 14.7, up to 30 psi", test: (t) => p(t) > 14.7 && p(t) <= 30 },
      { label: "Above 30 psi", test: (t) => p(t) > 30 },
    ]),
    grouped("gravity", "Gravity", "Under what gravity?", (t) => (t.gravity === "ug" ? "Microgravity" : t.gravity)),
    grouped("origin", "O2 and pressure source", "Are the conditions measured in the row or taken from a document?", (t) => (t.flags.includes("conditions_from_doc") ? "From a document (SPICE_Report p20)" : "From the table row")),
    grouped("labels", "Recorded results", "Does the row say what happened?", (t) => (t.outcome ? "Outcome recorded" : "No outcome recorded")),
  ];
}

function median(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, 3);
}

const extraNumber = (key: string) => (t: TestRecord) => {
  const v = t.extra[key];
  return typeof v === "number" ? v : null;
};

function distribution(rows: TestRecord[], def: { id: string; label: string; unit: string; note: string; step: number; get: (t: TestRecord) => number | null }): Distribution {
  const values = rows.map((t) => ({ inv: t.investigation, v: def.get(t) }));
  const nums = values.filter((x): x is { inv: Investigation; v: number } => typeof x.v === "number");
  const min = Math.floor(Math.min(...nums.map((x) => x.v)) / def.step) * def.step;
  const max = Math.max(...nums.map((x) => x.v));
  const count = Math.max(1, Math.ceil((max - min) / def.step + 1e-9));
  const bins: HistBin[] = Array.from({ length: count }, (_, i) => ({ label: `${round(min + i * def.step, 3)}–${round(min + (i + 1) * def.step, 3)}`, counts: zero() }));
  for (const { inv, v } of nums) bins[Math.min(count - 1, Math.floor((v - min) / def.step + 1e-9))].counts[inv]++;
  const perInv = Object.fromEntries(
    INVESTIGATIONS.map((inv) => {
      const part = values.filter((x) => x.inv === inv);
      const v = part.map((x) => x.v).filter((x): x is number => typeof x === "number");
      return [inv, { ...stats(v), median: median(v), missing: part.length - v.length }];
    }),
  ) as Record<Investigation, InvStats>;
  return { id: def.id, label: def.label, unit: def.unit, note: def.note, bins, stats: perInv };
}

const cfiDate = (text: unknown): number | null => {
  const m = typeof text === "string" ? /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(text.trim()) : null;
  if (!m) return null;
  const month = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2]) / 3;
  return month >= 0 && Number.isInteger(month) ? Date.UTC(2000 + Number(m[3]), month, Number(m[1])) : null;
};

const dateText = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function tableSpan(inv: Investigation, rows: TestRecord[]): string | null {
  if (inv === "ACME") {
    const days = rows.map((t) => t.extra.day).filter((d): d is number => typeof d === "number");
    return days.length ? `Table records test days ${Math.min(...days)}–${Math.max(...days)}, without calendar dates` : null;
  }
  if (inv === "CFI") {
    const dates = rows.map((t) => cfiDate(t.extra.test_date)).filter((d): d is number => d !== null);
    return dates.length ? `Table rows run from ${dateText(Math.min(...dates))} to ${dateText(Math.max(...dates))}` : null;
  }
  const days = rows.map((t) => t.extra.gmt_day_2009).filter((d): d is number => typeof d === "number");
  return days.length ? `Table rows run from GMT day ${Math.min(...days)} to day ${Math.max(...days)} of 2009` : null;
}

function tally(values: (string | null)[]): { label: string; n: number }[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

let cached: DatasetProfile | null = null;

export function datasetProfile(): DatasetProfile {
  if (cached) return cached;
  const all = allTests();
  const counted = all.filter(isCountable);
  const chunks = allChunks();
  const tables = allPdfTables();
  const pdfs = SOURCES.raw.filter((f) => f.pages);

  const fields: FieldProfile[] = FIELD_DOCS.map((doc) => {
    const fill = zero();
    const examples = { ACME: null, CFI: null, SPICE: null } as Record<Investigation, string | null>;
    for (const inv of INVESTIGATIONS) {
      const part = all.filter((t) => t.investigation === inv);
      const key = doc.name as keyof TestRecord;
      const present = part.filter((t) => isFilled(t[key]));
      fill[inv] = Math.round((100 * present.length) / part.length);
      if (present[0]) {
        const v = present[0][key];
        examples[inv] = (typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 90);
      }
    }
    return { ...doc, fill, examples };
  });

  const extras: ExtraProfile[] = EXTRA_DOCS.map((doc) => {
    const part = all.filter((t) => t.investigation === doc.investigation);
    const present = part.filter((t) => isFilled(t.extra[doc.key]));
    return { ...doc, filled: present.length, rows: part.length, example: present[0] ? String(present[0].extra[doc.key]) : null };
  });

  const investigations: InvestigationProfile[] = INVESTIGATION_DOCS.map((doc) => {
    const rows = all.filter((t) => t.investigation === doc.id);
    const uniq = rows.filter(isCountable);
    const files = SOURCES.raw.filter((f) => f.investigation === doc.id);
    const table = files.find((f) => f.kind === "table");
    return {
      ...doc,
      rows: rows.length,
      counted: uniq.length,
      duplicates: rows.length - uniq.length,
      share: round((100 * uniq.length) / counted.length, 1),
      o2: stats(uniq.map((t) => t.o2_pct)),
      pressure: stats(uniq.map((t) => t.pressure_psi)),
      size: stats(uniq.map((t) => t.size_mm)),
      flow: stats(uniq.filter((t) => !t.flags.includes("range_check_failed:flow")).map((t) => t.flow_cm_s)),
      fuels: tally(uniq.map((t) => t.fuel)),
      geometries: tally(uniq.map((t) => t.geometry)),
      sensors: [...new Set(rows.flatMap((t) => t.sensors))],
      measurements: [...new Set(rows.flatMap((t) => t.measurements))],
      hardware: [...new Set(rows.map((t) => t.hardware).filter((h): h is string => !!h))],
      columns: table?.columns ?? [],
      rawRows: table?.rows ?? 0,
      blankRows: table?.blank_rows ?? 0,
      files,
      chunks: chunks.filter((c) => c.investigation === doc.id).length,
      tables: tables.filter((c) => c.investigation === doc.id).length,
      pages: files.reduce((a, f) => a + (f.pages ?? 0), 0),
      span: tableSpan(doc.id, rows),
    };
  });

  const flags: FlagProfile[] = FLAG_DOCS.map((doc) => {
    const hit = all.filter((t) => t.flags.includes(doc.flag));
    const counts = zero();
    for (const t of hit) counts[t.investigation]++;
    return { ...doc, count: hit.length, counts, samples: hit.slice(0, 3).map((t) => t.test_id) };
  });

  const noFailedFlow = (t: TestRecord) => !t.flags.includes("range_check_failed:flow");
  const distributions: Distribution[] = [
    { id: "o2", label: "Oxygen", unit: "% O2", step: 5, note: "ACME inverse flames report the O2 of the oxidizer stream. Every SPICE row uses the documented 21%.", get: (t: TestRecord) => t.o2_pct },
    { id: "pressure", label: "Pressure", unit: "psi", step: 5, note: "Every SPICE row uses the documented 101 kPa.", get: (t: TestRecord) => t.pressure_psi },
    { id: "flow", label: "Air speed", unit: "cm/s", step: 10, note: "Only SPICE records air speed. Rows with a negative value are left out here.", get: (t: TestRecord) => (noFailedFlow(t) ? t.flow_cm_s : null) },
    { id: "size", label: "Burner or nozzle size", unit: "mm", step: 0.5, note: "CFI droplet size is not recorded per row.", get: (t: TestRecord) => t.size_mm },
    { id: "burn", label: "Burn time", unit: "s", step: 20, note: "ACME only. 0 means no ignition.", get: (t: TestRecord) => (t.key_metric_name === "burn_time_s" ? t.key_metric_value : null) },
    { id: "hc", label: "Hydrocarbon fuel rate", unit: "mg/s", step: 0.25, note: "SPICE only.", get: (t: TestRecord) => (t.key_metric_name === "hc_fuel_rate_mg_s" ? t.key_metric_value : null) },
    { id: "tad", label: "Adiabatic flame temperature", unit: "K", step: 100, note: "ACME only (ACME_Report p29).", get: extraNumber("tad_k") },
    { id: "zst", label: "Stoichiometric mixture fraction", unit: "", step: 0.1, note: "ACME only (ACME_Report p29).", get: extraNumber("zst") },
    { id: "peak", label: "Peak burner temperature", unit: "°C", step: 50, note: "ACME only.", get: extraNumber("peak_burner_t_c") },
  ].map((def) => distribution(counted, def));

  const references: ReferenceProfile[] = REFERENCE_DOCS.map((doc) => {
    const f = SOURCES.raw.find((x) => x.file === doc.file);
    if (!f) throw new Error(`No raw file record for ${doc.file}`);
    return { ...doc, investigation: f.investigation, kind: f.kind, bytes: f.bytes, sha256: f.sha256, pages: f.pages, rows: f.rows };
  });

  const labelled = Object.fromEntries(
    INVESTIGATIONS.map((inv) => {
      const part = counted.filter((t) => t.investigation === inv);
      return [inv, { outcome: part.filter((t) => t.outcome).length, metric: part.filter((t) => t.key_metric_value !== null).length, metricName: part.find((t) => t.key_metric_name)?.key_metric_name ?? null }];
    }),
  ) as DatasetProfile["labelled"];

  cached = {
    totals: {
      rows: all.length,
      counted: counted.length,
      duplicates: all.length - counted.length,
      investigations: INVESTIGATIONS.length,
      fuels: new Set(counted.map((t) => t.fuel).filter(Boolean)).size,
      fields: FIELD_DOCS.length,
      extraFields: EXTRA_DOCS.length,
      rawFiles: SOURCES.raw.length,
      rawBytes: SOURCES.raw.reduce((a, f) => a + f.bytes, 0),
      pdfs: pdfs.length,
      pdfPages: pdfs.reduce((a, f) => a + (f.pages ?? 0), 0),
      chunks: chunks.length,
      pdfTables: tables.length,
      withOutcome: counted.filter((t) => t.outcome).length,
      withMetric: counted.filter((t) => t.key_metric_value !== null).length,
      processedBytes: SOURCES.processed.reduce((a, f) => a + f.bytes, 0),
    },
    byInvestigation: INVESTIGATIONS.map((id) => ({ id, rows: all.filter((t) => t.investigation === id).length, counted: counted.filter((t) => t.investigation === id).length })),
    dimensions: dimensions(all, counted),
    fields,
    extras,
    investigations,
    distributions,
    flags,
    failedChecks: all.filter((t) => t.flags.includes("range_check_failed:flow")).map((t) => ({ test_id: t.test_id, row: t.source_row, value: t.flow_cm_s })),
    references,
    labelled,
    processed: SOURCES.processed,
  };
  return cached;
}
