/**
 * Train / test split helper for people modelling this data. HEARTH itself trains nothing and uses no split.
 * Pure and deterministic, safe in the browser. Duplicate rows are always left out, so one row cannot
 * land on both sides.
 */
import { INVESTIGATIONS, type Investigation, type TestRecord } from "./types";

export type SplitStrategy = "row" | "fuel" | "holdout";

export interface SplitOptions {
  strategy: SplitStrategy;
  trainPct: number;
  seed: number;
  holdout?: Investigation;
}

export interface SplitResult {
  assign: Map<string, "train" | "test">;
  per: Record<Investigation, { train: number; test: number }>;
  train: number;
  test: number;
  sharedFuels: string[];
  sharedConditions: number;
}

/** FNV-1a: the same seed and key always give the same order, in any browser. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const conditionKey = (t: TestRecord) => [t.fuel, t.geometry, t.o2_pct, t.pressure_psi, t.size_mm, t.flow_cm_s].join("|");

function fuelGroups(rows: TestRecord[], seed: number, trainPct: number): Set<string> {
  const groups = new Map<string, number>();
  for (const r of rows) groups.set(r.fuel ?? "unknown", (groups.get(r.fuel ?? "unknown") ?? 0) + 1);
  const order = [...groups.keys()].sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`) || a.localeCompare(b));
  const target = (rows.length * trainPct) / 100;
  const train = new Set<string>();
  let n = 0;
  for (const g of order) {
    if (train.size === order.length - 1) break; // keep at least one fuel for testing
    const size = groups.get(g)!;
    // take the fuel when that lands closer to the target than stopping here
    if (Math.abs(n + size - target) <= Math.abs(n - target)) {
      train.add(g);
      n += size;
    }
  }
  if (!train.size && order.length) train.add(order[0]);
  return train;
}

export function makeSplit(tests: TestRecord[], opts: SplitOptions): SplitResult {
  const rows = tests.filter((t) => !t.flags.includes("duplicate_row"));
  const assign = new Map<string, "train" | "test">();
  const pct = Math.min(95, Math.max(5, opts.trainPct));

  if (opts.strategy === "fuel") {
    // Across the whole dataset, not per investigation: propane burned in both ACME and SPICE.
    const train = fuelGroups(rows, opts.seed, pct);
    for (const r of rows) assign.set(r.test_id, train.has(r.fuel ?? "unknown") ? "train" : "test");
  } else {
    for (const inv of INVESTIGATIONS) {
      const part = rows.filter((t) => t.investigation === inv);
      if (opts.strategy === "holdout") {
        for (const r of part) assign.set(r.test_id, inv === (opts.holdout ?? "SPICE") ? "test" : "train");
      } else {
        const order = [...part].sort((a, b) => hash(`${opts.seed}:${a.test_id}`) - hash(`${opts.seed}:${b.test_id}`) || a.test_id.localeCompare(b.test_id));
        const cut = Math.round((part.length * pct) / 100);
        order.forEach((r, i) => assign.set(r.test_id, i < cut ? "train" : "test"));
      }
    }
  }

  const per = Object.fromEntries(INVESTIGATIONS.map((i) => [i, { train: 0, test: 0 }])) as SplitResult["per"];
  const fuels = { train: new Set<string>(), test: new Set<string>() };
  const conditions = { train: new Set<string>(), test: new Set<string>() };
  for (const r of rows) {
    const side = assign.get(r.test_id)!;
    per[r.investigation][side]++;
    if (r.fuel) fuels[side].add(r.fuel);
    conditions[side].add(conditionKey(r));
  }
  const sum = (side: "train" | "test") => INVESTIGATIONS.reduce((a, i) => a + per[i][side], 0);
  return {
    assign,
    per,
    train: sum("train"),
    test: sum("test"),
    sharedFuels: [...fuels.train].filter((f) => fuels.test.has(f)).sort(),
    sharedConditions: [...conditions.train].filter((c) => conditions.test.has(c)).length,
  };
}

const COLUMNS: (keyof TestRecord)[] = ["test_id", "investigation", "campaign", "hardware", "fuel", "fuel_phase", "geometry", "size_mm", "o2_pct", "pressure_psi", "diluent", "flow_cm_s", "gravity", "measurements", "sensors", "outcome", "key_metric_name", "key_metric_value", "source_file", "source_row", "notes", "flags", "extra"];

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const text = Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Flat CSV of the clean records. Lists are joined with "; ", and extra stays as JSON. */
export function toCsv(tests: TestRecord[], split?: Map<string, "train" | "test">): string {
  const head = [...(split ? ["split"] : []), ...COLUMNS].join(",");
  const lines = tests
    .filter((t) => !split || split.has(t.test_id))
    .map((t) => [...(split ? [split.get(t.test_id)] : []), ...COLUMNS.map((c) => t[c])].map(cell).join(","));
  return [head, ...lines].join("\n") + "\n";
}
