/** Shared map data helpers and the 3D map's scales. Pure maths with no graphics, so it is tested directly. */
import { ISS_PO2_PSI, pO2 } from "./physics";

export interface MapPoint {
  test_id: string;
  investigation: "ACME" | "CFI" | "SPICE";
  o2_pct: number;
  pressure_psi: number;
  flow_cm_s: number | null;
  fuel: string | null;
  campaign: string | null;
  from_doc: boolean;
}

export interface MapData {
  points: MapPoint[];
  not_plotted: { test_id: string; investigation: string; missing: string[] }[];
  lunar_region: { o2_pct: [number, number]; pressure_psi: [number, number] };
}

export const INV_COLORS = { ACME: "#4CC9F0", CFI: "#A78BFA", SPICE: "#5EE6A8" } as const;

export interface Agg {
  value: [number, number];
  ids: string[];
  fuels: string[];
  inv: string;
  fromDoc: boolean;
}

/** Tests at identical conditions are drawn as one point whose size grows with the count. */
export function aggregate(points: MapPoint[]): Agg[] {
  const m = new Map<string, Agg>();
  for (const p of points) {
    const k = `${p.investigation}|${p.pressure_psi}|${p.o2_pct}`;
    const a = m.get(k) ?? { value: [p.pressure_psi, p.o2_pct], ids: [], fuels: [], inv: p.investigation, fromDoc: p.from_doc };
    a.ids.push(p.test_id);
    if (p.fuel && !a.fuels.includes(p.fuel)) a.fuels.push(p.fuel);
    m.set(k, a);
  }
  return [...m.values()];
}

/** Point size in pixels; the flat chart and the 3D scene use the same rule. */
export function pointPx(count: number): number {
  return Math.min(26, 6 + Math.sqrt(count) * 1.6);
}

/**
 * 3D scales. Pressure is logarithmic so the low-pressure habitats do not bunch together; O2 and height are linear.
 * Height is real data: pO2 = (O2% / 100) × P from lib/physics.ts.
 */
export const SCALE = {
  pressureMin: 3,
  pressureMax: 80,
  halfWidth: 9,
  halfDepth: 6.5,
  heightPerPsi: 0.14,
  /** The sheet stops here: just above the highest pO2 in the data, not a physical limit. */
  sheetMaxPo2: 44,
};

export const PRESSURE_TICKS = [4, 8, 15, 30, 60];
export const O2_TICKS = [20, 40, 60, 80, 100];
export const PO2_TICKS = [10, 20, 30, 40];

export function pressureToX(psi: number): number {
  const u = Math.log(psi / SCALE.pressureMin) / Math.log(SCALE.pressureMax / SCALE.pressureMin);
  return -SCALE.halfWidth + 2 * SCALE.halfWidth * u;
}

export function xToPressure(x: number): number {
  const u = (x + SCALE.halfWidth) / (2 * SCALE.halfWidth);
  return SCALE.pressureMin * (SCALE.pressureMax / SCALE.pressureMin) ** u;
}

/** Higher O2 sits further from the viewer. */
export function o2ToZ(o2Pct: number): number {
  return SCALE.halfDepth - (2 * SCALE.halfDepth * o2Pct) / 100;
}

export function po2ToY(po2Psi: number): number {
  return po2Psi * SCALE.heightPerPsi;
}

export function toScene(pressurePsi: number, o2Pct: number): { x: number; y: number; z: number } {
  return { x: pressureToX(pressurePsi), y: po2ToY(pO2(o2Pct, pressurePsi)), z: o2ToZ(o2Pct) };
}

/** Every pressure and O2 with the same pO2 as the ISS: O2% = 100 × 3.087 / P, within 0–100% O2 and the axis range. */
export function issCurve(steps = 90): [number, number][] {
  const start = Math.max(SCALE.pressureMin, ISS_PO2_PSI);
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const p = start * (SCALE.pressureMax / start) ** (i / steps);
    out.push([p, (100 * ISS_PO2_PSI) / p]);
  }
  return out;
}

/** Index of the point closest to the pointer within its reach, or -1. */
export function pickNearest(points: { x: number; y: number; reach: number }[], px: number, py: number): number {
  let best = -1;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - px, p.y - py);
    if (d <= p.reach && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}
