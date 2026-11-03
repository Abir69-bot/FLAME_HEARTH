import { describe, expect, it } from "vitest";
import {
  convertPressure,
  envelopeCheck,
  flowRegime,
  hazardIndex,
  ISS_PO2_PSI,
  nearestTests,
  o2VsEarth,
  pO2,
  ratioToISS,
  testDistance,
} from "@/lib/physics";
import type { TestRecord } from "@/lib/types";

function t(id: string, o2: number | null, p: number | null, flow: number | null = null, flags: string[] = []): TestRecord {
  return {
    test_id: id, investigation: "ACME", campaign: null, hardware: null, fuel: null, fuel_phase: "gas", geometry: null,
    size_mm: null, o2_pct: o2, pressure_psi: p, diluent: null, flow_cm_s: flow, gravity: "ug", measurements: [], sensors: [],
    outcome: null, key_metric_name: null, key_metric_value: null, source_file: "x.csv", source_row: 2, notes: "", flags, extra: {},
  };
}

describe("pO2 and ratios (hand calculations)", () => {
  it("34% O2 at 8.2 psi = 2.788 psi", () => {
    expect(pO2(34, 8.2)).toBe(2.788);
  });
  it("ISS reference pO2 = 0.21 × 14.7 = 3.087 psi", () => {
    expect(ISS_PO2_PSI).toBe(3.087);
    expect(pO2(21, 14.7)).toBe(3.087);
  });
  it("ratio to ISS: 2.788 / 3.087 = 0.903", () => {
    expect(ratioToISS(34, 8.2).value).toBe(0.903);
  });
  it("spacesuit 100% at 4.3 psi = 4.3 psi pO2, 1.393× ISS", () => {
    expect(pO2(100, 4.3)).toBe(4.3);
    expect(ratioToISS(100, 4.3).value).toBe(1.393);
  });
  it("O2 vs Earth: 34 / 21 = 1.619, +13 pp", () => {
    const r = o2VsEarth(34);
    expect(r.value).toBe(1.619);
    expect(r.delta_pp).toBe(13);
  });
});

describe("flow regime", () => {
  it("uses still < 5, low < 20, forced ≥ 20", () => {
    expect(flowRegime(0).regime).toBe("still");
    expect(flowRegime(4.99).regime).toBe("still");
    expect(flowRegime(5).regime).toBe("low");
    expect(flowRegime(19.9).regime).toBe("low");
    expect(flowRegime(20).regime).toBe("forced");
    expect(flowRegime(null).regime).toBe("unknown");
  });
});

describe("unit conversion", () => {
  it("1 bar = 14.5038 psi, 1 atm = 14.6959 psi, 101 kPa = 14.6488 psi", () => {
    expect(convertPressure(1, "bar", "psi").value).toBe(14.5038);
    expect(convertPressure(1, "atm", "psi").value).toBe(14.6959);
    expect(convertPressure(101, "kPa", "psi").value).toBeCloseTo(14.6488, 3);
    expect(convertPressure(14.6959, "psi", "atm").value).toBe(1);
  });
});

describe("envelope check", () => {
  const near = [t("a", 33, 8), t("b", 35, 9), t("c", 30, 7), t("d", 38, 10), t("e", 34, 8.2)];
  it("≥5 tests inside ±5 pp / ±2.5 psi → supported", () => {
    expect(envelopeCheck(34, 8.2, near).status).toBe("supported");
  });
  it("1–4 → sparse, 0 → no_data", () => {
    expect(envelopeCheck(34, 8.2, near.slice(0, 2)).status).toBe("sparse");
    expect(envelopeCheck(80, 50, near).status).toBe("no_data");
  });
  it("window edges are inclusive and duplicates are ignored", () => {
    expect(envelopeCheck(34, 8.2, [t("x", 39, 10.7)]).count).toBe(1);
    expect(envelopeCheck(34, 8.2, [t("x", 34, 8.2, null, ["duplicate_row"])]).count).toBe(0);
  });
});

describe("nearest tests", () => {
  it("normalised distance: ΔO2 5 pp = 1, ΔP 2.5 psi = 1", () => {
    expect(testDistance(t("a", 39, 8.2), 34, 8.2)).toBe(1);
    expect(testDistance(t("a", 34, 10.7), 34, 8.2)).toBe(1);
    expect(testDistance(t("a", 39, 10.7), 34, 8.2)).toBe(1.414);
  });
  it("flow only counts when both are known", () => {
    expect(testDistance(t("a", 34, 8.2, 20), 34, 8.2, 10)).toBe(1);
    expect(testDistance(t("a", 34, 8.2, null), 34, 8.2, 10)).toBe(0);
  });
  it("sorts by distance and skips rows without O2/pressure", () => {
    const hits = nearestTests(34, 8.2, [t("far", 60, 30), t("none", null, 8), t("close", 33, 8)], 5);
    expect(hits.map((h) => h.test.test_id)).toEqual(["close", "far"]);
  });
});

describe("hazard index (heuristic)", () => {
  it("ISS air with supported data and forced flow scores 10 (airflow part only)", () => {
    const h = hazardIndex(21, 14.7, 30, "supported");
    expect(h.label).toBe("heuristic");
    expect(h.value).toBe(10);
  });
  it("parts add up to the value and stay within their max", () => {
    const h = hazardIndex(34, 8.2, 10, "no_data");
    expect(h.parts.reduce((s, p) => s + p.points, 0)).toBeCloseTo(h.value, 5);
    for (const p of h.parts) expect(p.points).toBeLessThanOrEqual(p.max);
    // 34% → 40 × 13/29 = 17.9; pO2 below ISS → 0; low flow → 20; no data → 20
    expect(h.value).toBe(57.9);
  });
});
