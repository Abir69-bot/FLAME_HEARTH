/**
 * The columns VESTA can analyse: the clean table plus the investigation-specific columns kept in `extra`.
 * Meanings are in docs/DATA_NOTES.md. A value that is missing or failed a range check returns null.
 */
import { pO2 } from "./physics";
import type { TestRecord } from "./types";

export interface NumericField {
  label: string;
  unit?: string;
  get: (t: TestRecord) => number | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const extra = (k: string) => (t: TestRecord) => num((t.extra as Record<string, unknown> | undefined)?.[k]);
const metric = (name: string) => (t: TestRecord) => (t.key_metric_name === name ? num(t.key_metric_value) : null);

export const NUMERIC_FIELDS: Record<string, NumericField> = {
  o2_pct: { label: "O2", unit: "%", get: (t) => t.o2_pct },
  pressure_psi: { label: "Pressure", unit: "psi", get: (t) => t.pressure_psi },
  po2_psi: { label: "O2 partial pressure", unit: "psi", get: (t) => (t.o2_pct != null && t.pressure_psi != null ? pO2(t.o2_pct, t.pressure_psi) : null) },
  // Rows that failed the flow range check (negative airflow) are never analysed.
  flow_cm_s: { label: "Airflow", unit: "cm/s", get: (t) => (t.flags.includes("range_check_failed:flow") ? null : t.flow_cm_s) },
  size_mm: { label: "Burner or nozzle size", unit: "mm", get: (t) => t.size_mm },
  burn_time_s: { label: "Burn time", unit: "s", get: metric("burn_time_s") },
  hc_fuel_rate_mg_s: { label: "Hydrocarbon fuel rate", unit: "mg/s", get: metric("hc_fuel_rate_mg_s") },
  tad_k: { label: "Adiabatic flame temperature", unit: "K", get: extra("tad_k") },
  zst: { label: "Stoichiometric mixture fraction", get: extra("zst") },
  peak_burner_t_c: { label: "Peak burner temperature", unit: "°C", get: extra("peak_burner_t_c") },
  fuel_flow_mg_s: { label: "Fuel flow", unit: "mg/s", get: extra("fuel_flow_mg_s") },
  xf_fuel_fraction: { label: "Fuel fraction in the fuel stream", get: extra("xf_fuel_fraction") },
  chamber_fuel_fraction_before: { label: "Chamber fuel fraction before test", get: extra("chamber_fuel_fraction_before") },
  oxidizer_o2_fraction: { label: "O2 fraction of the burner oxidizer", get: extra("oxidizer_o2_fraction") },
  n2_fraction: { label: "N2 fraction", get: extra("n2_fraction") },
  he_fraction: { label: "He fraction", get: extra("he_fraction") },
  fuel_rate_sccm: { label: "Fuel rate", unit: "sccm", get: extra("fuel_rate_sccm") },
  fuel_rate_mg_s: { label: "Fuel rate", unit: "mg/s", get: extra("fuel_rate_mg_s") },
};

const part = (re: RegExp) => (t: TestRecord) => re.exec(t.outcome ?? "")?.[1]?.trim() ?? null;

export const CATEGORY_FIELDS: Record<string, (t: TestRecord) => string | null> = {
  investigation: (t) => t.investigation,
  campaign: (t) => t.campaign,
  fuel: (t) => t.fuel,
  fuel_phase: (t) => t.fuel_phase,
  geometry: (t) => t.geometry,
  diluent: (t) => t.diluent,
  outcome: (t) => t.outcome,
  /** Parsed from the outcome text, e.g. "hot ignition: yes; ended: self-extinguished". "flash" is a brief flame that did not last. */
  hot_ignition: part(/hot ignition:\s*(yes|no|flash)/i),
  cool_flame: part(/cool flame:\s*(yes|no)/i),
  ended: part(/ended:\s*([^;]+)/i),
};

export const NUMERIC_NAMES = Object.keys(NUMERIC_FIELDS);
export const CATEGORY_NAMES = Object.keys(CATEGORY_FIELDS);
export const isNumericField = (f: string) => Object.prototype.hasOwnProperty.call(NUMERIC_FIELDS, f);
export const isCategoryField = (f: string) => Object.prototype.hasOwnProperty.call(CATEGORY_FIELDS, f);

/** "Burn time (s)": how a field appears on a chart axis. */
export function fieldLabel(f: string): string {
  const n = isNumericField(f) ? NUMERIC_FIELDS[f] : undefined;
  if (n) return n.unit ? `${n.label} (${n.unit})` : n.label;
  return f.replace(/_/g, " ");
}

/** Paired numeric values: only tests that have every requested field. */
export function pairs(tests: TestRecord[], fields: string[]): { rows: TestRecord[]; values: number[][] } {
  const getters = fields.map((f) => NUMERIC_FIELDS[f].get);
  const rows: TestRecord[] = [];
  const values: number[][] = [];
  for (const t of tests) {
    const v = getters.map((g) => g(t));
    if (v.every((x): x is number => x != null)) {
      rows.push(t);
      values.push(v);
    }
  }
  return { rows, values };
}

/** A label for grouping: the category value, or for a numeric field the bin the value falls into. */
export function groupKeyer(field: string, binWidth?: number): (t: TestRecord) => { key: string; order: number } | null {
  if (isCategoryField(field)) {
    const get = CATEGORY_FIELDS[field];
    return (t) => {
      const v = get(t);
      return v == null ? null : { key: v, order: 0 };
    };
  }
  const get = NUMERIC_FIELDS[field].get;
  if (binWidth && binWidth > 0) {
    return (t) => {
      const v = get(t);
      if (v == null) return null;
      const lo = Math.floor(v / binWidth + 1e-9) * binWidth;
      return { key: `${Number(lo.toPrecision(6))}–${Number((lo + binWidth).toPrecision(6))}`, order: lo };
    };
  }
  return (t) => {
    const v = get(t);
    return v == null ? null : { key: String(Number(v.toPrecision(6))), order: v };
  };
}

export function groupBy(tests: TestRecord[], field: string, binWidth?: number): { key: string; rows: TestRecord[] }[] {
  const keyer = groupKeyer(field, binWidth);
  const groups = new Map<string, { key: string; order: number; rows: TestRecord[] }>();
  for (const t of tests) {
    const k = keyer(t);
    if (!k) continue;
    const g = groups.get(k.key) ?? { key: k.key, order: k.order, rows: [] };
    g.rows.push(t);
    groups.set(k.key, g);
  }
  const out = [...groups.values()];
  return isCategoryField(field) ? out.sort((a, b) => b.rows.length - a.rows.length) : out.sort((a, b) => a.order - b.order);
}
