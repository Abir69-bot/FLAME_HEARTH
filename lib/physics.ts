/**
 * HEARTH physics: small, tested formulas. Every function returns plain numbers that
 * the UI and VESTA can show together with the formula string.
 */
import type { Confidence, TestRecord } from "./types";
import { isCountable, round } from "./util";

// ---- reference constants (CLAUDE.md reference atmospheres)
export const EARTH_O2_PCT = 21;
export const ISS_PRESSURE_PSI = 14.7;
export const ISS_PO2_PSI = round((EARTH_O2_PCT / 100) * ISS_PRESSURE_PSI, 3); // 3.087

// ---- unit conversion factors
export const PSI_PER_BAR = 14.5038;
export const PSI_PER_ATM = 14.6959;
export const PSI_PER_KPA = 0.145038;

// ---- flow regime thresholds (cm/s)
export const FLOW_STILL_MAX = 5; // below: still air
export const FLOW_LOW_MAX = 20; // below: low flow; at or above: forced flow

// ---- envelope check (a test counts as "near" when inside both windows)
export const ENVELOPE_O2_WINDOW_PCT = 5; // ± percentage points of O2
export const ENVELOPE_P_WINDOW_PSI = 2.5; // ± psi
export const ENVELOPE_SUPPORTED_MIN = 5; // ≥ 5 tests → supported

// ---- nearest tests: normalisation scales (distance 1 = edge of the envelope window)
export const DIST_O2_SCALE = ENVELOPE_O2_WINDOW_PCT;
export const DIST_P_SCALE = ENVELOPE_P_WINDOW_PSI;
export const DIST_FLOW_SCALE = 10; // cm/s

export interface Calc {
  value: number;
  unit: string;
  formula: string;
}

export function pO2(o2Pct: number, pressurePsi: number): number {
  return round((o2Pct / 100) * pressurePsi, 3);
}

export function pO2Calc(o2Pct: number, pressurePsi: number): Calc {
  return { value: pO2(o2Pct, pressurePsi), unit: "psi", formula: `pO2 = (${o2Pct} / 100) × ${pressurePsi} psi` };
}

export function ratioToISS(o2Pct: number, pressurePsi: number): Calc {
  const p = pO2(o2Pct, pressurePsi);
  return { value: round(p / ISS_PO2_PSI, 3), unit: "× ISS", formula: `${p} psi / ${ISS_PO2_PSI} psi (ISS pO2)` };
}

export function o2VsEarth(o2Pct: number): Calc & { delta_pp: number } {
  return {
    value: round(o2Pct / EARTH_O2_PCT, 3),
    unit: "× Earth air",
    delta_pp: round(o2Pct - EARTH_O2_PCT, 3),
    formula: `${o2Pct}% / ${EARTH_O2_PCT}% (Earth air)`,
  };
}

export type FlowRegime = "still" | "low" | "forced" | "unknown";

export function flowRegime(flowCmS: number | null | undefined): { regime: FlowRegime; rule: string } {
  if (flowCmS == null || !Number.isFinite(flowCmS)) return { regime: "unknown", rule: "no airflow value" };
  if (flowCmS < FLOW_STILL_MAX) return { regime: "still", rule: `< ${FLOW_STILL_MAX} cm/s` };
  if (flowCmS < FLOW_LOW_MAX) return { regime: "low", rule: `${FLOW_STILL_MAX}–${FLOW_LOW_MAX} cm/s` };
  return { regime: "forced", rule: `≥ ${FLOW_LOW_MAX} cm/s` };
}

export type PressureUnit = "psi" | "bar" | "atm" | "kPa";
const TO_PSI: Record<PressureUnit, number> = { psi: 1, bar: PSI_PER_BAR, atm: PSI_PER_ATM, kPa: PSI_PER_KPA };

export function convertPressure(value: number, from: PressureUnit, to: PressureUnit): Calc {
  const psi = value * TO_PSI[from];
  const out = round(psi / TO_PSI[to], 4);
  return { value: out, unit: to, formula: `${value} ${from} × ${TO_PSI[from]} psi/${from} ÷ ${TO_PSI[to]} psi/${to}` };
}

// ---- envelope + nearest
export type EnvelopeStatus = "supported" | "sparse" | "no_data";

export interface EnvelopeResult {
  status: EnvelopeStatus;
  confidence: Confidence;
  count: number;
  by_investigation: Record<string, number>;
  test_ids: string[];
  window: { o2_pct: [number, number]; pressure_psi: [number, number] };
  rule: string;
}

function plottable(t: TestRecord): t is TestRecord & { o2_pct: number; pressure_psi: number } {
  return t.o2_pct != null && t.pressure_psi != null && isCountable(t);
}

export function envelopeCheck(o2Pct: number, pressurePsi: number, tests: TestRecord[]): EnvelopeResult {
  const inside = tests.filter(
    (t) =>
      plottable(t) &&
      Math.abs(t.o2_pct - o2Pct) <= ENVELOPE_O2_WINDOW_PCT &&
      Math.abs(t.pressure_psi - pressurePsi) <= ENVELOPE_P_WINDOW_PSI,
  );
  const by: Record<string, number> = {};
  for (const t of inside) by[t.investigation] = (by[t.investigation] ?? 0) + 1;
  const n = inside.length;
  const status: EnvelopeStatus = n >= ENVELOPE_SUPPORTED_MIN ? "supported" : n > 0 ? "sparse" : "no_data";
  return {
    status,
    confidence: status === "supported" ? "supported" : status === "sparse" ? "extrapolated" : "no_data",
    count: n,
    by_investigation: by,
    test_ids: inside.map((t) => t.test_id),
    window: {
      o2_pct: [round(o2Pct - ENVELOPE_O2_WINDOW_PCT, 3), round(o2Pct + ENVELOPE_O2_WINDOW_PCT, 3)],
      pressure_psi: [round(pressurePsi - ENVELOPE_P_WINDOW_PSI, 3), round(pressurePsi + ENVELOPE_P_WINDOW_PSI, 3)],
    },
    rule: `supported: ≥${ENVELOPE_SUPPORTED_MIN} tests within ±${ENVELOPE_O2_WINDOW_PCT} pp O2 and ±${ENVELOPE_P_WINDOW_PSI} psi; sparse: 1–${ENVELOPE_SUPPORTED_MIN - 1}; no_data: 0`,
  };
}

export interface NearestHit {
  test: TestRecord;
  distance: number;
}

/** Normalised distance: sqrt((ΔO2/5)² + (ΔP/2.5)² [+ (Δflow/10)² when both flows are known]). */
export function testDistance(t: TestRecord, o2Pct: number, pressurePsi: number, flowCmS?: number | null): number | null {
  if (t.o2_pct == null || t.pressure_psi == null) return null;
  let d2 = ((t.o2_pct - o2Pct) / DIST_O2_SCALE) ** 2 + ((t.pressure_psi - pressurePsi) / DIST_P_SCALE) ** 2;
  if (flowCmS != null && t.flow_cm_s != null) d2 += ((t.flow_cm_s - flowCmS) / DIST_FLOW_SCALE) ** 2;
  return round(Math.sqrt(d2), 3);
}

export function nearestTests(
  o2Pct: number,
  pressurePsi: number,
  tests: TestRecord[],
  k = 5,
  flowCmS?: number | null,
): NearestHit[] {
  const hits: NearestHit[] = [];
  for (const t of tests) {
    if (!isCountable(t)) continue;
    const d = testDistance(t, o2Pct, pressurePsi, flowCmS);
    if (d != null) hits.push({ test: t, distance: d });
  }
  hits.sort((a, b) => a.distance - b.distance || a.test.test_id.localeCompare(b.test.test_id));
  return hits.slice(0, k);
}

// ---- hazard index (heuristic, not a NASA rating)
export interface HazardPart {
  name: string;
  points: number;
  max: number;
  why: string;
}

export interface HazardIndex {
  value: number;
  label: "heuristic";
  parts: HazardPart[];
  note: string;
}

export const HAZARD_O2_FULL_PCT = 50; // O2 % that earns full concentration points
export const HAZARD_PO2_FULL_RATIO = 2; // pO2 at 2× ISS earns full partial-pressure points

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Heuristic hazard index 0–100, made of four documented parts:
 *  oxygen concentration (0–40): linear from 21% (0) to 50% O2 (40)
 *  oxygen partial pressure (0–20): linear from 1× ISS pO2 (0) to 2× (20)
 *  airflow (0–20): low flow 20, still 10, forced 10, unknown 10
 *  data coverage (0–20): no_data 20, sparse 10, supported 0
 */
export function hazardIndex(o2Pct: number, pressurePsi: number, flowCmS: number | null | undefined, envelope: EnvelopeStatus): HazardIndex {
  const o2pts = round(40 * clamp01((o2Pct - EARTH_O2_PCT) / (HAZARD_O2_FULL_PCT - EARTH_O2_PCT)), 1);
  const ratio = pO2(o2Pct, pressurePsi) / ISS_PO2_PSI;
  const ppts = round(20 * clamp01((ratio - 1) / (HAZARD_PO2_FULL_RATIO - 1)), 1);
  const { regime } = flowRegime(flowCmS);
  const fpts = regime === "low" ? 20 : 10;
  const dpts = envelope === "no_data" ? 20 : envelope === "sparse" ? 10 : 0;
  const parts: HazardPart[] = [
    { name: "O2 concentration", points: o2pts, max: 40, why: `${o2Pct}% O2; 0 pts at ${EARTH_O2_PCT}%, 40 pts at ≥${HAZARD_O2_FULL_PCT}%` },
    { name: "O2 partial pressure", points: ppts, max: 20, why: `${round(ratio, 3)}× ISS pO2; 0 pts at ≤1×, 20 pts at ≥${HAZARD_PO2_FULL_RATIO}×` },
    { name: "Airflow", points: fpts, max: 20, why: `flow regime: ${regime}; low flow scores highest` },
    { name: "Data coverage", points: dpts, max: 20, why: `envelope: ${envelope}; less test data = more uncertainty` },
  ];
  return {
    value: round(parts.reduce((s, p) => s + p.points, 0), 1),
    label: "heuristic",
    parts,
    note: "Heuristic index for comparing conditions inside HEARTH. It is not a NASA rating or a flammability prediction.",
  };
}
