import { describe, expect, it } from "vitest";
import testsJson from "@/data/processed/tests.json";
import { acmeEvidence, acmeLook, buildFlameDataset, cfiEvidence, confidenceOf, frameAt, longestBurn, median, randomAcmeTest, replaySeconds, spiceEvidence, spiceLook, statusOf, timelineLength, type TimelineInput } from "@/lib/flame";
import type { TestRecord } from "@/lib/types";
import { isCountable } from "@/lib/util";

const TESTS = testsJson as unknown as TestRecord[];
const data = buildFlameDataset(TESTS);

describe("flame dataset comes straight from the NASA rows", () => {
  it("keeps every countable ACME and CFI test", () => {
    const count = (inv: string) => TESTS.filter((t) => t.investigation === inv && isCountable(t)).length;
    expect(data.acme.length).toBe(count("ACME"));
    expect(data.cfi.length).toBe(count("CFI"));
  });

  it("leaves out SPICE settings that cannot be placed", () => {
    expect(data.spice.length).toBeGreaterThan(350);
    for (const r of data.spice) {
      expect(r.flow).toBeGreaterThanOrEqual(0);
      expect(r.rate).toBeGreaterThan(0);
    }
  });

  it("reads outcomes exactly as recorded", () => {
    const r = data.acme.find((x) => x.id === "ACME-CFIG-159")!;
    const t = TESTS.find((x) => x.test_id === "ACME-CFIG-159")!;
    expect(t.outcome).toContain("cool flame: yes");
    expect(r).toMatchObject({ ignition: "yes", cool: true, ended: "self", burn: t.key_metric_value, o2: t.o2_pct, p: t.pressure_psi, row: t.source_row });
  });

  it("finds all 7 recorded cool flames, and only those", () => {
    expect(data.acme.filter((r) => r.cool).length).toBe(TESTS.filter((t) => t.investigation === "ACME" && isCountable(t) && t.outcome?.includes("cool flame: yes")).length);
    expect(data.acme.filter((r) => r.cool).length).toBe(7);
  });
});

describe("evidence follows the real tests", () => {
  it("uses the same rule as the data envelope", () => {
    expect([statusOf(0), statusOf(1), statusOf(4), statusOf(5)]).toEqual(["no_data", "sparse", "sparse", "supported"]);
    expect(confidenceOf("sparse")).toBe("extrapolated");
  });

  it("counts results near the settings", () => {
    const e = acmeEvidence(data.acme, { fuel: "n-butane (30% in N2)", type: "normal", o2: 39.4, p: 29.4 });
    expect(e.rows.length).toBeGreaterThan(5);
    expect(e.ignited + e.flashed + e.failed).toBe(e.rows.length);
    expect(e.cool).toBe(7);
    expect(e.verdict).toBe("burns");
    for (const r of e.rows) {
      expect(Math.abs(r.o2 - 39.4)).toBeLessThanOrEqual(5);
      expect(Math.abs(r.p - 29.4)).toBeLessThanOrEqual(2.5);
    }
  });

  it("the median burn is a value between the real burns", () => {
    const e = acmeEvidence(data.acme, { fuel: "ethane (30% in N2)", type: "normal", o2: 34, p: 8.2 });
    expect(e.medianBurn).not.toBeNull();
    expect(e.medianBurn!).toBeGreaterThanOrEqual(e.burnRange![0]);
    expect(e.medianBurn!).toBeLessThanOrEqual(e.burnRange![1]);
    expect(median([1, 3, 100])).toBe(3);
    expect(median([2, 4])).toBe(3);
    expect(median([])).toBeNull();
  });

  it("refuses to show a flame where nothing was tested, and names the closest test", () => {
    const e = acmeEvidence(data.acme, { fuel: "ethane", type: "normal", o2: 100, p: 4.3 });
    expect(e.status).toBe("no_data");
    expect(e.verdict).toBe("no_data");
    expect(e.nearest?.fuel).toBe("ethane");
    expect(frameAt({ verdict: "no_data", burnS: 5, ending: "self", cool: false }, 1).life).toBe(0);
  });

  it("a mix that mostly failed to ignite does not burn", () => {
    const failing = data.acme.find((r) => r.ignition === "no" && acmeEvidence(data.acme, { fuel: r.fuel, type: r.type, o2: r.o2, p: r.p }).verdict === "no_ignition");
    expect(failing, "some real tests should be in a mostly-failed region").toBeTruthy();
  });

  it("every ACME test lands on evidence that includes itself", () => {
    for (const r of data.acme) expect(acmeEvidence(data.acme, { fuel: r.fuel, type: r.type, o2: r.o2, p: r.p }).rows).toContain(r);
  });

  it("CFI and SPICE claim only what their tables hold", () => {
    const c = cfiEvidence(data.cfi, { fuel: "n-dodecane", helium: 0, o2: 21, p: 14.7 });
    expect(c.status).toBe("supported");
    expect(c.fiber + c.free).toBeLessThanOrEqual(c.rows.length);
    expect(cfiEvidence(data.cfi, { fuel: "n-dodecane", helium: 0, o2: 30, p: 80 }).verdict).toBe("no_data");

    const s = spiceEvidence(data.spice, { fuel: "propylene", nozzle: 1.6002, flow: 30, rate: 1 });
    expect(s.rows.length).toBeGreaterThan(0);
    expect(s.rateRange![0]).toBeLessThanOrEqual(s.rateRange![1]);
    expect(spiceEvidence(data.spice, { fuel: "propylene", nozzle: 1.6002, flow: 30, rate: 4.5 }).verdict).toBe("no_data");
  });
});

describe("the challenges can really be completed from the data", () => {
  it("has a burn over 150 seconds and a longest burn from a real row", () => {
    const l = longestBurn(data.acme)!;
    expect(l.burn).toBe(304);
    expect(acmeEvidence(data.acme, { fuel: l.fuel, type: l.type, o2: Math.round(l.o2 * 10) / 10, p: Math.round(l.p * 10) / 10 }).medianBurn!).toBeGreaterThan(150);
  });

  it("surprise picks a real test", () => {
    expect(data.acme).toContain(randomAcmeTest(data.acme, () => 0.5));
    expect(data.acme).toContain(randomAcmeTest(data.acme, () => 0.999));
    expect(randomAcmeTest([])).toBeNull();
  });

  it("every SPICE fuel and nozzle offered has real settings", () => {
    for (const r of data.spice) expect(spiceEvidence(data.spice, { fuel: r.fuel, nozzle: r.nozzle, flow: r.flow, rate: r.rate }).rows).toContain(r);
  });
});

describe("the animation follows the result", () => {
  const burn: TimelineInput = { verdict: "burns", burnS: 6, ending: "self", cool: false };

  it("plays long burns faster and keeps short ones real", () => {
    expect(replaySeconds(304)).toBeLessThanOrEqual(30);
    expect(replaySeconds(304)).toBeGreaterThan(2);
    expect(replaySeconds(2)).toBe(2);
    expect(replaySeconds(60)).toBe(5);
  });

  it("lights, burns fully, then goes out", () => {
    expect(frameAt(burn, 0).life).toBe(0);
    expect(frameAt(burn, 3)).toMatchObject({ phase: "burn", life: 1 });
    expect(frameAt(burn, 3).progress).toBeGreaterThan(0);
    expect(frameAt(burn, timelineLength(burn) + 0.1)).toMatchObject({ phase: "out", life: 0, done: true });
  });

  it("life stays between 0 and 1 for every outcome", () => {
    for (const verdict of ["burns", "flash", "no_ignition"] as const) {
      for (const cool of [true, false]) {
        const i: TimelineInput = { verdict, burnS: 5, ending: "flow", cool };
        for (let t = 0; t <= timelineLength(i) + 1; t += 0.05) {
          const f = frameAt(i, t);
          expect(f.life).toBeGreaterThanOrEqual(0);
          expect(f.life).toBeLessThanOrEqual(1);
          expect(f.cool).toBeGreaterThanOrEqual(0);
          expect(f.cool).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("a failed ignition stays a weak puff, and only tests with a cool flame show one", () => {
    const fail: TimelineInput = { verdict: "no_ignition", burnS: 5, ending: "self", cool: false };
    for (let t = 0; t < 1.4; t += 0.05) expect(frameAt(fail, t).life).toBeLessThan(0.2);
    for (let t = 0; t <= timelineLength(burn); t += 0.1) expect(frameAt(burn, t).cool).toBe(0);
    const cool = { ...burn, cool: true };
    expect(frameAt(cool, timelineLength(burn) + 1).cool).toBeGreaterThan(0.5);
  });

  it("turns the table's temperature and Zst into a look, and airflow shortens a jet", () => {
    const hot = acmeLook({ medianTad: 2900, medianZst: 0.1 }, "normal");
    const cold = acmeLook({ medianTad: 1500, medianZst: 0.7 }, "normal");
    expect(hot.heat).toBeGreaterThan(cold.heat);
    expect(hot.size).toBeGreaterThan(cold.size);
    expect(acmeLook({ medianTad: 2000, medianZst: 0.1 }, "inverse").size).toBeLessThan(acmeLook({ medianTad: 2000, medianZst: 0.1 }, "normal").size);
    expect(spiceLook({ flow: 80, rate: 1 }, 2).length).toBeLessThan(spiceLook({ flow: 0, rate: 1 }, 2).length);
    expect(spiceLook({ flow: 10, rate: 2 }, 2).length).toBeGreaterThan(spiceLook({ flow: 10, rate: 0.5 }, 2).length);
  });
});
