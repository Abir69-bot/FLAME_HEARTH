import { describe, expect, it } from "vitest";
import { coverageRadar } from "@/lib/analysis";
import {
  confidenceFromCount,
  ruleCoolFlames,
  ruleOxygenEnrichment,
  rulePartialGravity,
  ruleSmokeDetection,
  ruleStillAir,
  ruleUntestedSolids,
  safetyAudit,
  targetFor,
} from "@/lib/safety";
import { runTool } from "@/lib/vesta/tools";
import { withAutoView } from "@/lib/vesta/agent";

const rover = targetFor({ mission: "lunar-rover" })!;
const iss = targetFor({ mission: "iss" })!;
const suit = targetFor({ mission: "spacesuit" })!;

function wellFormed(f: ReturnType<typeof ruleOxygenEnrichment>) {
  expect(f.severity).toBeGreaterThanOrEqual(0);
  expect(f.severity).toBeLessThanOrEqual(100);
  expect(["supported", "extrapolated", "no_data"]).toContain(f.confidence);
  expect(f.guideline).toMatch(/^Evidence (suggests|is missing)/);
  expect(f.guideline).not.toMatch(/\b(must|shall|NASA requires)\b/i);
  expect(f.sources.length + f.evidence.filter((e) => e.source).length).toBeGreaterThan(0);
  expect(f.severity_rule.length).toBeGreaterThan(10);
}

describe("safety rules", () => {
  it("confidence comes from the evidence count", () => {
    expect([confidenceFromCount(0), confidenceFromCount(3), confidenceFromCount(5)]).toEqual(["no_data", "extrapolated", "supported"]);
  });

  it("oxygen enrichment: 0 at Earth air, grows with O2 and pO2", () => {
    const a = ruleOxygenEnrichment(iss);
    const b = ruleOxygenEnrichment(rover);
    const c = ruleOxygenEnrichment(suit);
    [a, b, c].forEach(wellFormed);
    expect(a.severity).toBe(0);
    // 70 × 13/29 = 31.4 (pO2 below ISS) → 31
    expect(b.severity).toBe(31);
    expect(c.severity).toBe(82); // 70 + 30 × 0.393 = 81.8
    expect(b.confidence).toBe("supported");
    expect(c.confidence).toBe("no_data");
  });

  it("untested solids: no solid tests → no_data, higher severity in enriched O2", () => {
    const a = ruleUntestedSolids(rover);
    const b = ruleUntestedSolids(iss);
    [a, b].forEach(wellFormed);
    expect(a.confidence).toBe("no_data");
    expect([a.severity, b.severity]).toEqual([80, 50]);
    expect(a.guideline).toMatch(/BASS|Saffire/);
  });

  it("cool flames: needs both O2 and pressure near the recorded cool flames", () => {
    const far = ruleCoolFlames(rover);
    wellFormed(far);
    expect(far.severity).toBe(40);
    expect(far.confidence).toBe("extrapolated");
    const near = ruleCoolFlames({ o2_pct: 39.4, pressure_psi: 29.4, gravity: "microgravity", label: "test" });
    expect(near.severity).toBe(60);
    expect(near.confidence).toBe("supported");
  });

  it("smoke detection: extrapolated outside SPICE's 21% / 101 kPa", () => {
    const a = ruleSmokeDetection(rover);
    const b = ruleSmokeDetection(iss);
    [a, b].forEach(wellFormed);
    expect([a.severity, a.confidence]).toEqual([50, "extrapolated"]);
    expect([b.severity, b.confidence]).toEqual([35, "supported"]);
  });

  it("still air: uses ACME flow-terminated and self-extinguished counts", () => {
    const a = ruleStillAir(iss);
    wellFormed(a);
    expect(a.severity).toBe(55);
    expect(a.evidence[0].text).toMatch(/^89 ACME flames ended when the gas flow was cut/);
    expect(a.evidence[1].text).toMatch(/^183 ACME flames self-extinguished/);
    expect(ruleStillAir(rover).confidence).toBe("extrapolated");
  });

  it("partial gravity: no_data and high severity for lunar missions", () => {
    const a = rulePartialGravity(rover);
    const b = rulePartialGravity(iss);
    [a, b].forEach(wellFormed);
    expect([a.severity, a.confidence]).toEqual([65, "no_data"]);
    expect([b.severity, b.confidence]).toEqual([20, "supported"]);
    expect(a.guideline).toMatch(/LUCI|FM2/);
  });

  it("audit returns all six rules across the three categories, sorted by severity", () => {
    const f = safetyAudit(rover);
    expect(f.length).toBe(6);
    expect(new Set(f.map((x) => x.category))).toEqual(new Set(["prevention", "detection", "suppression"]));
    for (let i = 1; i < f.length; i++) expect(f[i - 1].severity).toBeGreaterThanOrEqual(f[i].severity);
  });

  it("safety_audit tool works with a mission or with raw conditions", async () => {
    const a = await runTool("safety_audit", { mission: "lunar-rover" });
    expect(a.ok).toBe(true);
    expect(a.confidence).toBe("extrapolated");
    const b = await runTool("safety_audit", { o2_pct: 21, pressure_psi: 14.7 }, { missionId: "iss" });
    expect((b.data as { findings: { id: string; severity: number }[] }).findings.find((x) => x.id === "oxygen_enrichment")?.severity).toBe(0);
  });
});

describe("coverage radar and dashboard moves", () => {
  it("normalises every axis to 0–100 with formulas", () => {
    const c = coverageRadar("lunar-rover");
    expect(c.axes.length).toBe(6);
    for (const inv of ["ACME", "CFI", "SPICE"]) {
      for (const a of c.axes) {
        expect(c.norm[inv][a.key]).toBeGreaterThanOrEqual(0);
        expect(c.norm[inv][a.key]).toBeLessThanOrEqual(100);
      }
    }
    expect(c.raw.SPICE.flow_span).toBeGreaterThan(0);
    expect(c.raw.ACME.flow_span).toBe(0); // not recorded
  });

  it("compare, safety_audit and gap_finder always move the dashboard", () => {
    expect(withAutoView([], ["physics_calc", "compare"], ["ACME", "CFI"])).toEqual([{ action: "go_view", view: "compare", path: "/compare", compare: ["ACME", "CFI"] }]);
    expect(withAutoView([], ["safety_audit"])[0].view).toBe("safety");
    expect(withAutoView([], ["gap_finder"])[0].view).toBe("safety");
    expect(withAutoView([{ action: "go_view", view: "overview", path: "/" }], ["compare"]).length).toBe(1);
    expect(withAutoView([], ["physics_calc"])).toEqual([]);
  });
});
