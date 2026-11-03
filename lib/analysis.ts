/** Shared analysis used by the API routes and the VESTA tools. Every output carries sources. */
import { countable, sourcesFor, stats } from "./data";
import { O2_BINS, P_BINS, binIndex, binLabel } from "./bins";
import { MISSIONS, getMission } from "./missions";
import { envelopeCheck, nearestTests } from "./physics";
import { round } from "./util";
import { INVESTIGATIONS, type Investigation, type Mission, type Source, type TestRecord } from "./types";

// ------------------------------------------------------------- compare
const ATTRS = ["fuel", "fuel_phase", "geometry", "hardware", "diluent", "campaign", "sensors", "measurements"] as const;
type Attr = (typeof ATTRS)[number];

function values(ts: TestRecord[], a: Attr): string[] {
  const s = new Set<string>();
  for (const t of ts) {
    const v = t[a];
    if (Array.isArray(v)) v.forEach((x) => s.add(x));
    else if (v != null) s.add(String(v));
  }
  return [...s].sort();
}

export function compareInvestigations(invs: Investigation[]) {
  const sets = invs.map((inv) => ({ inv, tests: countable().filter((t) => t.investigation === inv) }));
  const shared: Record<string, string[]> = {};
  const only: Record<string, Record<string, string[]>> = {};
  for (const a of ATTRS) {
    const per = sets.map((s) => new Set(values(s.tests, a)));
    shared[a] = [...per[0]].filter((v) => per.every((p) => p.has(v)));
    for (let i = 0; i < sets.length; i++) {
      const others = per.filter((_, j) => j !== i);
      (only[sets[i].inv] ??= {})[a] = [...per[i]].filter((v) => !others.some((o) => o.has(v)));
    }
  }
  const conditions = sets.map(({ inv, tests }) => ({
    investigation: inv,
    tests: tests.length,
    o2_pct: stats(tests.map((t) => t.o2_pct)),
    pressure_psi: stats(tests.map((t) => t.pressure_psi)),
    flow_cm_s: stats(tests.map((t) => t.flow_cm_s)),
    fuels: values(tests, "fuel").length,
    sensor_types: values(tests, "sensors").length,
  }));
  const sources: Source[] = sets.flatMap(({ tests }) => sourcesFor(tests, 0));
  return { investigations: invs, shared, only, conditions, sources };
}

// ------------------------------------------------------------- rank
export const RANK_WEIGHTS = { proximity: 40, o2_coverage: 20, pressure_coverage: 20, envelope_tests: 20 } as const;
export const RANK_O2_GAP_FULL = 20; // pp outside the tested O2 range that zeroes O2 coverage
export const RANK_P_GAP_FULL = 10; // psi outside the tested pressure range that zeroes pressure coverage
export const RANK_ENVELOPE_FULL = 10; // tests inside the envelope for full points
export const RANK_PROXIMITY_ZERO = 3; // normalised distance that earns 0 proximity

function coverage(target: number, min: number | null, max: number | null, gapFull: number): number {
  if (min == null || max == null) return 0;
  if (target >= min && target <= max) return 1;
  const gap = target < min ? min - target : target - max;
  return Math.max(0, 1 - gap / gapFull);
}

export interface RankRow {
  investigation: Investigation;
  score: number;
  parts: { name: string; points: number; max: number; why: string }[];
  envelope_count: number;
  nearest_ids: string[];
  sources: Source[];
}

export function rankInvestigations(target: { o2_pct: number; pressure_psi: number }): RankRow[] {
  const rows = INVESTIGATIONS.map((inv) => {
    const ts = countable().filter((t) => t.investigation === inv);
    const o2 = stats(ts.map((t) => t.o2_pct));
    const p = stats(ts.map((t) => t.pressure_psi));
    const near = nearestTests(target.o2_pct, target.pressure_psi, ts, 5);
    const prox = near.length ? near.reduce((s, h) => s + Math.max(0, 1 - h.distance / RANK_PROXIMITY_ZERO), 0) / near.length : 0;
    const env = envelopeCheck(target.o2_pct, target.pressure_psi, ts);
    const o2c = coverage(target.o2_pct, o2.min, o2.max, RANK_O2_GAP_FULL);
    const pc = coverage(target.pressure_psi, p.min, p.max, RANK_P_GAP_FULL);
    const envc = Math.min(1, env.count / RANK_ENVELOPE_FULL);
    const parts = [
      { name: "Proximity", points: round(RANK_WEIGHTS.proximity * prox, 1), max: RANK_WEIGHTS.proximity, why: `mean of max(0, 1 − d/${RANK_PROXIMITY_ZERO}) over the 5 nearest tests` },
      { name: "O2 coverage", points: round(RANK_WEIGHTS.o2_coverage * o2c, 1), max: RANK_WEIGHTS.o2_coverage, why: `tested O2 ${o2.min}–${o2.max}% vs target ${target.o2_pct}%` },
      { name: "Pressure coverage", points: round(RANK_WEIGHTS.pressure_coverage * pc, 1), max: RANK_WEIGHTS.pressure_coverage, why: `tested ${p.min}–${p.max} psi vs target ${target.pressure_psi} psi` },
      { name: "Tests in envelope", points: round(RANK_WEIGHTS.envelope_tests * envc, 1), max: RANK_WEIGHTS.envelope_tests, why: `${env.count} tests within ±5 pp O2 / ±2.5 psi (full points at ${RANK_ENVELOPE_FULL})` },
    ];
    return {
      investigation: inv,
      score: round(parts.reduce((s, x) => s + x.points, 0), 1),
      parts,
      envelope_count: env.count,
      nearest_ids: near.map((h) => h.test.test_id),
      sources: sourcesFor(near.map((h) => h.test), 3),
    };
  });
  return rows.sort((a, b) => b.score - a.score);
}

export function rankForMission(missionId: string | null | undefined) {
  const m = getMission(missionId) ?? getMission("lunar-rover")!;
  return { mission: m, ranking: rankInvestigations(m) };
}

// ------------------------------------------------------------- gaps
export interface GapCell {
  o2_bin: string;
  p_bin: string;
  o2_index: number;
  p_index: number;
  count: number;
  by_investigation: Record<string, number>;
  missions: string[];
}

export const EXPLORATION_REGION = { o2_min: 21, o2_max: 50, p_max: 14 };

const EXPERIMENT_SUGGESTIONS = {
  solid: "Solid materials (fabrics, foams, wiring insulation) at elevated O2: BASS / Saffire-type material flammability tests.",
  partial_gravity: "Partial (lunar / Martian) gravity: LUCI or FM2-type combustion experiments at lunar gravity.",
  cell: (c: GapCell) => `No tests at ${c.o2_bin} O2 and ${c.p_bin}: a CIR/ACME-type campaign at these conditions would fill this cell.`,
};

export function findGaps(missionId?: string) {
  const ts = countable();
  const grid: GapCell[] = [];
  for (let i = 0; i < O2_BINS.length; i++) {
    for (let j = 0; j < P_BINS.length; j++) {
      grid.push({ o2_bin: binLabel(O2_BINS[i], "%"), p_bin: binLabel(P_BINS[j], "psi"), o2_index: i, p_index: j, count: 0, by_investigation: {}, missions: [] });
    }
  }
  const cell = (i: number, j: number) => grid[i * P_BINS.length + j];
  let plotted = 0;
  for (const t of ts) {
    const i = binIndex(O2_BINS, t.o2_pct);
    const j = binIndex(P_BINS, t.pressure_psi);
    if (i < 0 || j < 0) continue;
    plotted++;
    const c = cell(i, j);
    c.count++;
    c.by_investigation[t.investigation] = (c.by_investigation[t.investigation] ?? 0) + 1;
  }
  for (const m of MISSIONS) {
    const i = binIndex(O2_BINS, m.o2_pct);
    const j = binIndex(P_BINS, m.pressure_psi);
    if (i >= 0 && j >= 0) cell(i, j).missions.push(m.id);
  }
  const inRegion = (c: GapCell) =>
    O2_BINS[c.o2_index][0] >= EXPLORATION_REGION.o2_min && O2_BINS[c.o2_index][0] < EXPLORATION_REGION.o2_max && P_BINS[c.p_index][0] < EXPLORATION_REGION.p_max;
  const empty = grid.filter((c) => c.count === 0);
  const missionGaps = empty.filter((c) => c.missions.length);
  const regionGaps = empty.filter((c) => !c.missions.length && inRegion(c));
  const phases = new Set(ts.map((t) => t.fuel_phase));
  const gravities = new Set(ts.map((t) => t.gravity));
  const missing_fuel_phases = (["gas", "liquid", "solid"] as const).filter((p) => !phases.has(p));
  const focus: Mission | undefined = getMission(missionId);
  const focusCell = focus ? grid.find((c) => c.missions.includes(focus.id)) : undefined;
  const recommendations = [
    ...missionGaps.map((c) => ({ gap: `${c.o2_bin} × ${c.p_bin} (${c.missions.join(", ")})`, suggestion: EXPERIMENT_SUGGESTIONS.cell(c) })),
    ...(missing_fuel_phases.includes("solid") ? [{ gap: "No solid-fuel / fabric tests", suggestion: EXPERIMENT_SUGGESTIONS.solid }] : []),
    ...([...gravities].every((g) => g === "ug") ? [{ gap: "Only microgravity data", suggestion: EXPERIMENT_SUGGESTIONS.partial_gravity }] : []),
  ];
  return {
    o2_bins: O2_BINS.map((b) => binLabel(b, "%")),
    p_bins: P_BINS.map((b) => binLabel(b, "psi")),
    grid,
    plotted,
    mission_gaps: missionGaps,
    exploration_region_gaps: regionGaps,
    exploration_region: EXPLORATION_REGION,
    focus_cell: focusCell ?? null,
    missing_fuel_phases,
    gravity_levels_tested: [...gravities],
    recommendations,
    sources: sourcesFor(ts, 0),
  };
}
