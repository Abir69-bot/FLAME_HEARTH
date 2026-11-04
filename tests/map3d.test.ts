import { describe, expect, it } from "vitest";
import testsJson from "@/data/processed/tests.json";
import { O2_TICKS, PRESSURE_TICKS, SCALE, aggregate, issCurve, o2ToZ, pickNearest, pointPx, po2ToY, pressureToX, toScene, xToPressure, type MapPoint } from "@/lib/map3d";
import { MISSIONS } from "@/lib/missions";
import { ISS_PO2_PSI, pO2 } from "@/lib/physics";

const TESTS = testsJson as unknown as { pressure_psi: number | null; o2_pct: number | null }[];

describe("3D map scales", () => {
  it("height is exactly the tested pO2 formula", () => {
    expect(toScene(8.2, 34).y).toBeCloseTo(pO2(34, 8.2) * SCALE.heightPerPsi, 10);
    expect(pO2(34, 8.2)).toBeCloseTo(2.788, 3);
    expect(po2ToY(0)).toBe(0);
  });

  it("maps pressure on a log scale, and back", () => {
    expect(pressureToX(SCALE.pressureMin)).toBeCloseTo(-SCALE.halfWidth, 10);
    expect(pressureToX(SCALE.pressureMax)).toBeCloseTo(SCALE.halfWidth, 10);
    expect(xToPressure(pressureToX(14.7))).toBeCloseTo(14.7, 10);
    // equal ratios are equal distances
    expect(pressureToX(16) - pressureToX(8)).toBeCloseTo(pressureToX(32) - pressureToX(16), 10);
  });

  it("puts higher O2 further away, at the right ends of the axis", () => {
    expect(o2ToZ(0)).toBe(SCALE.halfDepth);
    expect(o2ToZ(100)).toBe(-SCALE.halfDepth);
    expect(o2ToZ(34)).toBeLessThan(o2ToZ(21));
  });

  it("fits every NASA test and mission inside the axes and under the sheet", () => {
    const places = [...TESTS.map((t) => [t.pressure_psi as number, t.o2_pct as number]), ...MISSIONS.map((m) => [m.pressure_psi, m.o2_pct])];
    expect(places.length).toBeGreaterThan(800);
    for (const [p, o] of places) {
      expect(p).toBeGreaterThanOrEqual(SCALE.pressureMin);
      expect(p).toBeLessThanOrEqual(SCALE.pressureMax);
      expect(o).toBeLessThanOrEqual(100);
      expect(pO2(o, p)).toBeLessThanOrEqual(SCALE.sheetMaxPo2);
    }
  });

  it("keeps axis ticks inside the axes", () => {
    for (const p of PRESSURE_TICKS) expect(Math.abs(pressureToX(p))).toBeLessThanOrEqual(SCALE.halfWidth);
    for (const o of O2_TICKS) expect(Math.abs(o2ToZ(o))).toBeLessThanOrEqual(SCALE.halfDepth);
  });

  it("the ISS line stays level at the ISS pO2", () => {
    for (const [p, o] of issCurve()) expect((o / 100) * p).toBeCloseTo(ISS_PO2_PSI, 6);
  });
});

describe("3D map points", () => {
  const point = (id: string, inv: MapPoint["investigation"], o2: number, p: number, fuel = "ethane"): MapPoint => ({ test_id: id, investigation: inv, o2_pct: o2, pressure_psi: p, flow_cm_s: null, fuel, campaign: null, from_doc: false });

  it("merges tests at identical conditions without losing any", () => {
    const pts = [point("a", "ACME", 21, 14), point("b", "ACME", 21, 14, "propane"), point("c", "CFI", 21, 14), point("d", "ACME", 30, 14)];
    const agg = aggregate(pts);
    expect(agg.length).toBe(3);
    expect(agg.flatMap((a) => a.ids).sort()).toEqual(["a", "b", "c", "d"]);
    expect(agg[0].fuels).toEqual(["ethane", "propane"]);
  });

  it("uses the flat chart's size rule, with a cap", () => {
    expect(pointPx(1)).toBeCloseTo(7.6, 5);
    expect(pointPx(435)).toBe(26);
  });

  it("picks the closest point within reach, else nothing", () => {
    const pts = [
      { x: 10, y: 10, reach: 10 },
      { x: 16, y: 10, reach: 10 },
      { x: 100, y: 100, reach: -1 },
    ];
    expect(pickNearest(pts, 14, 10)).toBe(1);
    expect(pickNearest(pts, 60, 60)).toBe(-1);
    // a point behind the camera has no reach
    expect(pickNearest(pts, 100, 100)).toBe(-1);
  });
});
