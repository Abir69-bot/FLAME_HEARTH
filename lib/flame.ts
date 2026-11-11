/**
 * Data logic of the Flame simulator: real experiment rows in, evidence and animation settings out.
 * Pure, with no browser or file access, so it is tested directly against the NASA data.
 * The flame on screen is artwork steered by these results. It is not a combustion model.
 */
import { DIST_FLOW_SCALE, ENVELOPE_O2_WINDOW_PCT, ENVELOPE_P_WINDOW_PSI, ENVELOPE_SUPPORTED_MIN, testDistance } from "./physics";
import type { Confidence, TestRecord } from "./types";
import { isCountable } from "./util";

export type Ignition = "yes" | "no" | "flash";
export type Ending = "self" | "flow";
export type FlameType = "normal" | "inverse";
export type EvidenceStatus = "supported" | "sparse" | "no_data";

export interface AcmeRow {
  id: string;
  file: string;
  row: number;
  fuel: string;
  type: FlameType;
  o2: number;
  p: number;
  ignition: Ignition;
  cool: boolean;
  ended: Ending | null;
  burn: number | null;
  tad: number | null;
  zst: number | null;
}

export interface CfiRow {
  id: string;
  file: string;
  row: number;
  fuel: string;
  o2: number;
  p: number;
  helium: number;
  fiber: boolean | null;
}

export interface SpiceRow {
  id: string;
  file: string;
  row: number;
  fuel: string;
  nozzle: number;
  flow: number;
  rate: number;
}

export interface FlameDataset {
  acme: AcmeRow[];
  cfi: CfiRow[];
  spice: SpiceRow[];
}

export function parseIgnition(outcome: string | null): Ignition | null {
  const m = outcome?.match(/hot ignition: (yes|no|flash)/);
  return m ? (m[1] as Ignition) : null;
}

export function parseEnding(outcome: string | null): Ending | null {
  if (outcome?.includes("ended: self-extinguished")) return "self";
  if (outcome?.includes("ended: flow terminated")) return "flow";
  return null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Compact rows for the browser. Exact duplicates are left out, like everywhere else in HEARTH. */
export function buildFlameDataset(tests: TestRecord[]): FlameDataset {
  const out: FlameDataset = { acme: [], cfi: [], spice: [] };
  for (const t of tests) {
    if (!isCountable(t) || t.o2_pct == null || t.pressure_psi == null || t.source_row == null || !t.fuel) continue;
    const base = { id: t.test_id, file: t.source_file, row: t.source_row, fuel: t.fuel };
    if (t.investigation === "ACME") {
      const ignition = parseIgnition(t.outcome);
      if (!ignition) continue;
      out.acme.push({
        ...base,
        type: t.geometry?.includes("inverse") ? "inverse" : "normal",
        o2: t.o2_pct,
        p: t.pressure_psi,
        ignition,
        cool: !!t.outcome?.includes("cool flame: yes"),
        ended: parseEnding(t.outcome),
        burn: num(t.key_metric_value),
        tad: num(t.extra?.tad_k),
        zst: num(t.extra?.zst),
      });
    } else if (t.investigation === "CFI") {
      out.cfi.push({
        ...base,
        o2: t.o2_pct,
        p: t.pressure_psi,
        helium: num(t.extra?.he_fraction) ?? 0,
        fiber: t.geometry?.startsWith("fiber") ? true : t.geometry?.startsWith("free") ? false : null,
      });
    } else if (t.investigation === "SPICE") {
      // settings with no airflow value, a failed range check or no fuel flow cannot be placed
      const rate = num(t.extra?.hc_fuel_rate_mg_s);
      if (t.flow_cm_s == null || t.size_mm == null || !rate || t.flags.some((f) => f.startsWith("range_check_failed"))) continue;
      out.spice.push({ ...base, nozzle: t.size_mm, flow: t.flow_cm_s, rate });
    }
  }
  return out;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Same rule as the data envelope everywhere else: 5 or more tests is supported, 1–4 sparse, 0 no data. */
export function statusOf(count: number): EvidenceStatus {
  return count >= ENVELOPE_SUPPORTED_MIN ? "supported" : count > 0 ? "sparse" : "no_data";
}

export function confidenceOf(status: EvidenceStatus): Confidence {
  return status === "supported" ? "supported" : status === "sparse" ? "extrapolated" : "no_data";
}

function nearWindow(row: { o2: number; p: number }, o2: number, p: number): boolean {
  return Math.abs(row.o2 - o2) <= ENVELOPE_O2_WINDOW_PCT && Math.abs(row.p - p) <= ENVELOPE_P_WINDOW_PSI;
}

function byDistance<T extends { o2: number; p: number }>(rows: T[], o2: number, p: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    const d = testDistance({ o2_pct: r.o2, pressure_psi: r.p, flow_cm_s: null } as TestRecord, o2, p) ?? Infinity;
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

export type Verdict = "burns" | "flash" | "no_ignition" | "no_data";

export interface AcmeEvidence {
  status: EvidenceStatus;
  verdict: Verdict;
  rows: AcmeRow[];
  ignited: number;
  flashed: number;
  failed: number;
  cool: number;
  endedSelf: number;
  endedFlow: number;
  medianBurn: number | null;
  burnRange: [number, number] | null;
  medianTad: number | null;
  medianZst: number | null;
  /** Closest test of this fuel and flame type, wherever it is. */
  nearest: AcmeRow | null;
  /** Tests at these conditions with any other fuel or flame type. */
  otherHere: number;
}

/** What actually happened in the NASA tests closest to these settings. The verdict follows the majority. */
export function acmeEvidence(all: AcmeRow[], q: { fuel: string; type: FlameType; o2: number; p: number }): AcmeEvidence {
  const pool = all.filter((r) => r.fuel === q.fuel && r.type === q.type);
  const rows = pool.filter((r) => nearWindow(r, q.o2, q.p));
  const ignited = rows.filter((r) => r.ignition === "yes").length;
  const flashed = rows.filter((r) => r.ignition === "flash").length;
  const failed = rows.filter((r) => r.ignition === "no").length;
  const burning = rows.filter((r) => r.ignition === "yes");
  const burns = burning.map((r) => r.burn).filter((b): b is number => b != null && b > 0);
  const verdict: Verdict = !rows.length ? "no_data" : ignited >= failed + flashed ? "burns" : failed >= flashed ? "no_ignition" : "flash";
  return {
    status: statusOf(rows.length),
    verdict,
    rows,
    ignited,
    flashed,
    failed,
    cool: rows.filter((r) => r.cool).length,
    endedSelf: burning.filter((r) => r.ended === "self").length,
    endedFlow: burning.filter((r) => r.ended === "flow").length,
    medianBurn: median(burns),
    burnRange: burns.length ? [Math.min(...burns), Math.max(...burns)] : null,
    medianTad: median(rows.map((r) => r.tad).filter((v): v is number => v != null)),
    medianZst: median(rows.map((r) => r.zst).filter((v): v is number => v != null)),
    nearest: byDistance(pool, q.o2, q.p),
    otherHere: all.filter((r) => !(r.fuel === q.fuel && r.type === q.type) && nearWindow(r, q.o2, q.p)).length,
  };
}

export interface CfiEvidence {
  status: EvidenceStatus;
  verdict: Verdict;
  rows: CfiRow[];
  fiber: number;
  free: number;
  nearest: CfiRow | null;
}

/** The CFI table lists conditions, not results, so this only says whether a droplet was burned near here. */
export function cfiEvidence(all: CfiRow[], q: { fuel: string; helium: number; o2: number; p: number }): CfiEvidence {
  const pool = all.filter((r) => r.fuel === q.fuel && r.helium === q.helium);
  const rows = pool.filter((r) => nearWindow(r, q.o2, q.p));
  return {
    status: statusOf(rows.length),
    verdict: rows.length ? "burns" : "no_data",
    rows,
    fiber: rows.filter((r) => r.fiber === true).length,
    free: rows.filter((r) => r.fiber === false).length,
    nearest: byDistance(pool, q.o2, q.p),
  };
}

/** How close a fuel rate has to be to count as the same SPICE setting. */
export const SPICE_RATE_WINDOW_MG_S = 0.25;

export interface SpiceEvidence {
  status: EvidenceStatus;
  verdict: Verdict;
  rows: SpiceRow[];
  /** Fuel rates tested with this fuel and nozzle at about this airflow. */
  rateRange: [number, number] | null;
  nearest: SpiceRow | null;
}

/** The SPICE table lists settings and does not mark which one reached the smoke point, so no soot threshold is claimed. */
export function spiceEvidence(all: SpiceRow[], q: { fuel: string; nozzle: number; flow: number; rate: number }): SpiceEvidence {
  const pool = all.filter((r) => r.fuel === q.fuel && r.nozzle === q.nozzle);
  const atFlow = pool.filter((r) => Math.abs(r.flow - q.flow) <= DIST_FLOW_SCALE);
  const rows = atFlow.filter((r) => Math.abs(r.rate - q.rate) <= SPICE_RATE_WINDOW_MG_S);
  let nearest: SpiceRow | null = null;
  let bestD = Infinity;
  for (const r of pool) {
    const d = Math.hypot((r.flow - q.flow) / DIST_FLOW_SCALE, (r.rate - q.rate) / SPICE_RATE_WINDOW_MG_S);
    if (d < bestD) {
      nearest = r;
      bestD = d;
    }
  }
  return {
    status: statusOf(rows.length),
    verdict: rows.length ? "burns" : "no_data",
    rows,
    rateRange: atFlow.length ? [Math.min(...atFlow.map((r) => r.rate)), Math.max(...atFlow.map((r) => r.rate))] : null,
    nearest,
  };
}

// ------------------------------------------------------------------ steering the artwork

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Extremes of Tad (K) and Zst across all ACME rows. They only set how bright and how large the artwork is. */
const TAD_RANGE: [number, number] = [1397, 2978];
const ZST_RANGE: [number, number] = [0.059, 0.784];

/**
 * Flame look for an ACME result. Hotter Tad is brighter and bluer. A diffusion flame sits where fuel and oxygen meet in the
 * right ratio (Zst): when the burner feeds fuel, low Zst pushes the flame further out; feeding oxygen reverses that.
 */
export function acmeLook(e: Pick<AcmeEvidence, "medianTad" | "medianZst">, type: FlameType): { heat: number; size: number; soot: number } {
  const heat = e.medianTad == null ? 0.5 : clamp01((e.medianTad - TAD_RANGE[0]) / (TAD_RANGE[1] - TAD_RANGE[0]));
  const z = e.medianZst == null ? 0.5 : clamp01((e.medianZst - ZST_RANGE[0]) / (ZST_RANGE[1] - ZST_RANGE[0]));
  const outward = type === "normal" ? 1 - z : z;
  return { heat, size: 0.26 + outward * 0.34, soot: clamp01(0.75 - heat * 0.55) };
}

/** SPICE report p2: more fuel means a longer flame, more co-flowing air a shorter one. Soot grows with rate; no threshold is implied. */
export function spiceLook(q: { flow: number; rate: number }, maxRate: number): { length: number; soot: number; flow: number } {
  const r = clamp01(q.rate / Math.max(maxRate, 0.001));
  const f = clamp01(q.flow / 85);
  return { length: (0.5 + r * 0.95) * (1 - f * 0.28), soot: clamp01(r * 1.05 - 0.1), flow: f };
}

// ------------------------------------------------------------------ replay timeline

const SPARK_S = 0.8;
const END_S: Record<Ending, number> = { self: 2, flow: 0.7 };
const COOL_S = 4;
const REPLAY_MIN_S = 2.5;
const REPLAY_MAX_S = 11;
/** Burn length of a replay when the table has no burn time: droplet and jet modes. Shows no timer. */
export const UNTIMED_REPLAY_S = 8;

/** Long burns play faster so nobody waits five minutes; the on-screen speed says by how much. */
export function replaySeconds(realBurnS: number): number {
  return realBurnS <= REPLAY_MIN_S ? Math.max(0.6, realBurnS) : Math.min(REPLAY_MAX_S, Math.max(REPLAY_MIN_S, realBurnS / 12));
}

export interface TimelineInput {
  verdict: Verdict;
  burnS: number;
  ending: Ending;
  cool: boolean;
}

export interface Frame {
  phase: "spark" | "burn" | "ending" | "cool" | "out";
  /** Flame strength, 0–1. */
  life: number;
  /** Multiplies the flame's size, 0–1. */
  size: number;
  spark: number;
  cool: number;
  /** Share of the burn played, 0–1. */
  progress: number;
  done: boolean;
}

export function timelineLength(i: TimelineInput): number {
  if (i.verdict === "no_data") return 0;
  if (i.verdict === "no_ignition") return 1.4;
  if (i.verdict === "flash") return 1.6;
  return SPARK_S + i.burnS + END_S[i.ending] + (i.cool ? COOL_S : 0);
}

const ease = (v: number) => v * v * (3 - 2 * v);

export function frameAt(i: TimelineInput, t: number): Frame {
  const out: Frame = { phase: "out", life: 0, size: 0, spark: 0, cool: 0, progress: 1, done: true };
  if (i.verdict === "no_data") return out;
  if (t >= timelineLength(i)) return out;
  if (i.verdict === "no_ignition") {
    // the igniter glows, a weak puff forms and dies: what "did not ignite" looks like
    return { phase: "spark", life: 0.16 * Math.sin(Math.PI * clamp01((t - 0.4) / 0.8)), size: 0.45, spark: 1 - clamp01((t - 0.9) / 0.4), cool: 0, progress: 0, done: false };
  }
  if (i.verdict === "flash") {
    const k = clamp01((t - 0.4) / 1.2);
    return { phase: "burn", life: k < 0.18 ? k / 0.18 : 1 - ease((k - 0.18) / 0.82), size: 0.45 + k * 0.5, spark: 1 - clamp01((t - 0.6) / 0.4), cool: 0, progress: k, done: false };
  }
  if (t < SPARK_S) {
    const k = clamp01((t - 0.3) / (SPARK_S - 0.3));
    return { phase: "spark", life: ease(k), size: 0.35 + 0.65 * ease(k), spark: 1 - clamp01((t - 0.55) / 0.25), cool: 0, progress: 0, done: false };
  }
  const afterBurn = t - SPARK_S - i.burnS;
  if (afterBurn < 0) return { phase: "burn", life: 1, size: 1, spark: 0, cool: 0, progress: (t - SPARK_S) / i.burnS, done: false };
  const endS = END_S[i.ending];
  if (afterBurn < endS) {
    const k = ease(afterBurn / endS);
    // going out alone: slowly dimmer and smaller. Fuel shut off: the flame collapses towards the burner.
    return { phase: "ending", life: 1 - k, size: 1 - k * (i.ending === "self" ? 0.3 : 0.6), spark: 0, cool: i.cool ? k * 0.8 : 0, progress: 1, done: false };
  }
  const k = (afterBurn - endS) / COOL_S;
  return { phase: "cool", life: 0, size: 0.7, spark: 0, cool: k < 0.75 ? 0.8 + 0.2 * Math.sin(k * 9) : 0.8 * (1 - (k - 0.75) / 0.25), progress: 1, done: false };
}

// ------------------------------------------------------------------ fun, from real rows only

export function randomAcmeTest(all: AcmeRow[], rand: () => number = Math.random): AcmeRow | null {
  return all.length ? all[Math.floor(rand() * all.length) % all.length] : null;
}

/** The real test with the longest recorded burn. */
export function longestBurn(all: AcmeRow[]): AcmeRow | null {
  return all.reduce<AcmeRow | null>((best, r) => ((r.burn ?? 0) > (best?.burn ?? 0) ? r : best), null);
}
