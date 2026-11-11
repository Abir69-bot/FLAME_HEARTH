import { describe, expect, it } from "vitest";
import { allTests } from "@/lib/data";
import { buildInsights, describeCorrelation, endingsByO2, ignitionByFuel, spearman } from "@/lib/insights";

// Expected values were counted independently from data/processed/tests.json with Python.
describe("insights data", () => {
  const d = buildInsights(allTests());

  it("counts ACME outcomes from the countable rows", () => {
    expect(d.totals.acme).toBe(333);
    expect([d.totals.ignited, d.totals.flash, d.totals.noIgnition]).toEqual([263, 8, 62]);
    expect([d.totals.selfExtinguished, d.totals.flowTerminated, d.totals.coolFlames]).toEqual([183, 89, 7]);
    expect(d.totals.peakTests).toBe(284);
  });

  it("measures the O2 drop only on normal flames, never negative", () => {
    const drops = d.acme.filter((r) => r.o2Drop != null);
    expect(drops).toHaveLength(179);
    expect(drops.every((r) => r.type === "normal" && r.o2Drop! >= 0)).toBe(true);
    expect(Math.max(...drops.map((r) => r.o2Drop!))).toBe(2.307);
    expect(d.acme.filter((r) => r.type === "inverse").every((r) => r.o2Drop == null)).toBe(true);
  });

  it("groups ignition by base fuel", () => {
    expect(ignitionByFuel(d.acme)).toEqual([
      { fuel: "ethane", yes: 81, flash: 8, no: 5 },
      { fuel: "n-butane", yes: 105, flash: 0, no: 35 },
      { fuel: "propane", yes: 77, flash: 0, no: 22 },
    ]);
  });

  it("splits flame endings by O2 band, ignited flames only", () => {
    const e = endingsByO2(d.acme);
    expect(e.map((b) => [b.self, b.flow])).toEqual([
      [20, 5],
      [32, 12],
      [62, 36],
      [69, 35],
    ]);
    expect(e.reduce((s, b) => s + b.self + b.flow + b.unknown, 0)).toBe(d.totals.ignited + d.totals.flash);
  });

  it("builds the CFI matrix and the SPICE coverage", () => {
    expect(d.totals.cfi).toBe(79);
    expect(d.cfiPressures).toEqual([7.3, 11, 14.7, 18.4, 29.4, 44.1, 73.5]);
    expect(d.cfiCells).toHaveLength(13);
    expect(d.cfiCells.reduce((s, c) => s + c.count, 0)).toBe(79);
    expect([d.totals.spice, d.totals.spiceLeftOut]).toEqual([406, 29]);
    expect(d.spice.every((r) => r.flow >= 0 && r.rate > 0)).toBe(true);
  });

  it("describes rank correlation without overstating it", () => {
    expect(spearman([[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]])).toBe(1);
    expect(spearman([[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]])).toBe(-1);
    expect(spearman([[1, 1], [2, 2]])).toBeNull();
    expect(describeCorrelation(null)).toBe("too few tests to say");
    expect(describeCorrelation(0.1)).toBe("no clear pattern");
    expect(describeCorrelation(-0.5)).toBe("moderate tendency to move in opposite directions");
  });
});
