/**
 * Insights page data: patterns across many NASA tests, built from the processed table.
 * Pure (no file or browser access) so every number is tested directly against the data.
 * These are descriptive views of what was recorded. Nothing here is a fitted model or a prediction.
 */
import { parseEnding, parseIgnition, type Ending, type FlameType, type Ignition } from "./flame";
import type { TestRecord } from "./types";
import { isCountable, round } from "./util";

export interface InsightAcme {
  id: string;
  file: string;
  row: number;
  fuel: string;
  /** fuel without its N2 dilution, e.g. "n-butane" for "n-butane (30% in N2)" */
  base: string;
  type: FlameType;
  o2: number;
  p: number;
  ignition: Ignition;
  ended: Ending | null;
  cool: boolean;
  /** seconds; 0 when the flame did not ignite */
  burn: number | null;
  tad: number | null;
  zst: number | null;
  /** peak burner temperature, °C */
  peak: number | null;
  /** chamber O2 before minus after the test, percentage points. Normal flames only (inverse rows hold fuel fractions there). */
  o2Drop: number | null;
}

export interface InsightCfi {
  id: string;
  file: string;
  row: number;
  fuel: string;
  o2: number;
  p: number;
  helium: number;
  fiber: boolean | null;
}

export interface InsightSpice {
  id: string;
  file: string;
  row: number;
  fuel: string;
  nozzle: number;
  /** co-flow air speed, cm/s */
  flow: number;
  /** hydrocarbon fuel rate, mg/s */
  rate: number;
}

export interface CfiCell {
  fuel: string;
  pressure: number;
  count: number;
  helium: number[];
  fiber: number;
  free: number;
  o2: number[];
}

export interface InsightsData {
  acme: InsightAcme[];
  cfi: InsightCfi[];
  spice: InsightSpice[];
  /** CFI fuels × pressures; a missing pair means no test */
  cfiFuels: string[];
  cfiPressures: number[];
  cfiCells: CfiCell[];
  totals: {
    acme: number;
    ignited: number;
    flash: number;
    noIgnition: number;
    selfExtinguished: number;
    flowTerminated: number;
    coolFlames: number;
    o2DropTests: number;
    peakTests: number;
    cfi: number;
    spice: number;
    spiceLeftOut: number;
  };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const baseFuel = (fuel: string) => fuel.split(" (")[0];

export function buildInsights(tests: TestRecord[]): InsightsData {
  const acme: InsightAcme[] = [];
  const cfi: InsightCfi[] = [];
  const spice: InsightSpice[] = [];
  let spiceLeftOut = 0;
  for (const t of tests) {
    if (!isCountable(t) || t.source_row == null || !t.fuel) continue;
    const base = { id: t.test_id, file: t.source_file, row: t.source_row, fuel: t.fuel };
    if (t.investigation === "ACME") {
      const ignition = parseIgnition(t.outcome);
      if (!ignition || t.o2_pct == null || t.pressure_psi == null) continue;
      const type: FlameType = t.geometry?.includes("inverse") ? "inverse" : "normal";
      const before = num(t.extra?.xo2_before);
      const after = num(t.extra?.xo2_after);
      acme.push({
        ...base,
        base: baseFuel(t.fuel),
        type,
        o2: t.o2_pct,
        p: t.pressure_psi,
        ignition,
        ended: parseEnding(t.outcome),
        cool: !!t.outcome?.includes("cool flame: yes"),
        burn: t.key_metric_name === "burn_time_s" ? num(t.key_metric_value) : null,
        tad: num(t.extra?.tad_k),
        zst: num(t.extra?.zst),
        peak: num(t.extra?.peak_burner_t_c),
        o2Drop: type === "normal" && before != null && after != null ? round((before - after) * 100, 3) : null,
      });
    } else if (t.investigation === "CFI") {
      if (t.o2_pct == null || t.pressure_psi == null) continue;
      cfi.push({
        ...base,
        o2: t.o2_pct,
        p: round(t.pressure_psi, 1),
        helium: num(t.extra?.he_fraction) ?? 0,
        fiber: t.geometry?.startsWith("fiber") ? true : t.geometry?.startsWith("free") ? false : null,
      });
    } else if (t.investigation === "SPICE") {
      const rate = num(t.extra?.hc_fuel_rate_mg_s);
      // no airflow value, a failed range check or no fuel flow: the setting cannot be placed on the chart
      if (t.flow_cm_s == null || t.size_mm == null || !rate || t.flags.some((f) => f.startsWith("range_check_failed"))) {
        spiceLeftOut++;
        continue;
      }
      spice.push({ ...base, nozzle: t.size_mm, flow: t.flow_cm_s, rate });
    }
  }

  const cfiFuels = [...new Set(cfi.map((r) => r.fuel))].sort();
  const cfiPressures = [...new Set(cfi.map((r) => r.p))].sort((a, b) => a - b);
  const cells = new Map<string, CfiCell>();
  for (const r of cfi) {
    const key = `${r.fuel}|${r.p}`;
    const c = cells.get(key) ?? { fuel: r.fuel, pressure: r.p, count: 0, helium: [], fiber: 0, free: 0, o2: [] };
    c.count++;
    if (!c.helium.includes(r.helium)) c.helium.push(r.helium);
    if (!c.o2.includes(r.o2)) c.o2.push(r.o2);
    if (r.fiber === true) c.fiber++;
    if (r.fiber === false) c.free++;
    cells.set(key, c);
  }
  for (const c of cells.values()) {
    c.helium.sort((a, b) => a - b);
    c.o2.sort((a, b) => a - b);
  }

  return {
    acme,
    cfi,
    spice,
    cfiFuels,
    cfiPressures,
    cfiCells: [...cells.values()],
    totals: {
      acme: acme.length,
      ignited: acme.filter((r) => r.ignition === "yes").length,
      flash: acme.filter((r) => r.ignition === "flash").length,
      noIgnition: acme.filter((r) => r.ignition === "no").length,
      selfExtinguished: acme.filter((r) => r.ended === "self").length,
      flowTerminated: acme.filter((r) => r.ended === "flow").length,
      coolFlames: acme.filter((r) => r.cool).length,
      o2DropTests: acme.filter((r) => r.o2Drop != null).length,
      peakTests: acme.filter((r) => r.peak != null).length,
      cfi: cfi.length,
      spice: spice.length,
      spiceLeftOut,
    },
  };
}

/** O2 bands used for "how flames ended". Edges are the same reference points used across HEARTH. */
export const O2_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Below 21%", min: -Infinity, max: 21 },
  { label: "21–30%", min: 21, max: 30 },
  { label: "30–40%", min: 30, max: 40 },
  { label: "40% and up", min: 40, max: Infinity },
];

/** Ignited ACME flames per O2 band: how many went out by themselves and how many were stopped by cutting the flow. */
export function endingsByO2(rows: InsightAcme[]): { band: string; self: number; flow: number; unknown: number }[] {
  return O2_BANDS.map((b) => {
    const inBand = rows.filter((r) => r.ignition !== "no" && r.o2 >= b.min && r.o2 < b.max);
    return {
      band: b.label,
      self: inBand.filter((r) => r.ended === "self").length,
      flow: inBand.filter((r) => r.ended === "flow").length,
      unknown: inBand.filter((r) => r.ended == null).length,
    };
  });
}

/** Ignition outcome counts per base fuel. */
export function ignitionByFuel(rows: InsightAcme[]): { fuel: string; yes: number; flash: number; no: number }[] {
  const fuels = [...new Set(rows.map((r) => r.base))].sort();
  return fuels.map((fuel) => {
    const f = rows.filter((r) => r.base === fuel);
    return { fuel, yes: f.filter((r) => r.ignition === "yes").length, flash: f.filter((r) => r.ignition === "flash").length, no: f.filter((r) => r.ignition === "no").length };
  });
}

/** Spearman rank correlation, a plain description of "goes up together". Null when fewer than 5 pairs. */
export function spearman(pairs: [number, number][]): number | null {
  if (pairs.length < 5) return null;
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const a = rank(pairs.map((p) => p[0]));
  const b = rank(pairs.map((p) => p[1]));
  const n = pairs.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  if (!va || !vb) return null;
  return round(cov / Math.sqrt(va * vb), 2);
}

/** Words for a rank correlation, so the page never overstates a pattern. */
export function describeCorrelation(rho: number | null): string {
  if (rho == null) return "too few tests to say";
  const a = Math.abs(rho);
  const dir = rho > 0 ? "rise together" : "move in opposite directions";
  if (a < 0.2) return "no clear pattern";
  if (a < 0.4) return `weak tendency to ${dir}`;
  if (a < 0.7) return `moderate tendency to ${dir}`;
  return `strong tendency to ${dir}`;
}
