import { describe, expect, it } from "vitest";
import { DATA_TOOLS, runTool } from "@/lib/vesta/tools";

describe("data tools", () => {
  it("every tool has a name, description and zod input", () => {
    expect(DATA_TOOLS.map((t) => t.name).sort()).toEqual(
      ["compare", "envelope_check", "gap_finder", "nearest_tests", "physics_calc", "query_data", "rank_investigations", "safety_audit", "search_docs"].sort(),
    );
  });

  it("physics_calc: 34% at 8.2 psi → 2.788 psi with a formula source", async () => {
    const r = await runTool("physics_calc", { o2_pct: 34, pressure_psi: 8.2 });
    expect(r.ok).toBe(true);
    expect((r.data as { po2: { value: number } }).po2.value).toBe(2.788);
    expect(r.sources[0].file).toBe("lib/physics.ts");
  });

  it("physics_calc uses the active mission when no numbers are given", async () => {
    const r = await runTool("physics_calc", {}, { missionId: "iss" });
    expect((r.data as { po2: { value: number } }).po2.value).toBe(3.087);
  });

  it("rejects invalid arguments without throwing", async () => {
    const r = await runTool("physics_calc", { o2_pct: "lots" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_arguments");
    const u = await runTool("nope", {});
    expect(u.error).toBe("unknown_tool");
  });

  it("query_data returns rows, stats and row-level sources", async () => {
    const r = await runTool("query_data", { investigation: ["ACME"], o2_min: 35, group_by: "fuel", limit: 3 });
    const d = r.data as { total: number; rows: unknown[]; groups: unknown[] };
    expect(d.total).toBeGreaterThan(0);
    expect(d.rows.length).toBeLessThanOrEqual(3);
    expect(d.groups.length).toBeGreaterThan(0);
    expect(r.sources[0].row).toBeGreaterThan(1);
  });

  it("every successful tool result carries at least one source", async () => {
    const calls: [string, unknown][] = [
      ["query_data", {}],
      ["search_docs", { query: "cool flame" }],
      ["physics_calc", { mission: "lunar-rover" }],
      ["nearest_tests", { o2_pct: 34, pressure_psi: 8.2 }],
      ["envelope_check", { mission: "lunar-rover" }],
      ["compare", { investigations: ["ACME", "SPICE"] }],
      ["rank_investigations", { mission: "lunar-rover" }],
      ["gap_finder", {}],
      ["safety_audit", { mission: "lunar-rover" }],
    ];
    for (const [name, args] of calls) {
      const r = await runTool(name, args);
      expect(r.ok, name).toBe(true);
      expect(r.sources.length, name).toBeGreaterThan(0);
      expect(["supported", "extrapolated", "no_data"]).toContain(r.confidence);
    }
  });

  it("envelope_check for the rover reports its status and nearest tests", async () => {
    const r = await runTool("envelope_check", { mission: "lunar-rover" });
    const d = r.data as { status: string; nearest: { distance: number }[] };
    expect(["supported", "sparse", "no_data"]).toContain(d.status);
    expect(d.nearest.length).toBe(3);
  });

  it("compare reports shared and unique attributes", async () => {
    const r = await runTool("compare", { investigations: ["ACME", "CFI"] });
    const d = r.data as { shared: Record<string, string[]>; only: Record<string, Record<string, string[]>> };
    expect(d.only.CFI.fuel_phase).toContain("liquid");
    expect(d.shared.gravity ?? []).toEqual([]);
  });

  it("rank returns three investigations with score parts summing to the score", async () => {
    const r = await runTool("rank_investigations", { mission: "lunar-rover" });
    const d = r.data as { ranking: { score: number; parts: { points: number }[] }[] };
    expect(d.ranking.length).toBe(3);
    for (const row of d.ranking) expect(row.parts.reduce((s, p) => s + p.points, 0)).toBeCloseTo(row.score, 1);
  });

  it("gap_finder flags missing solids and partial gravity", async () => {
    const r = await runTool("gap_finder", {});
    const d = r.data as { missing_fuel_phases: string[]; recommendations: { suggestion: string }[] };
    expect(d.missing_fuel_phases).toContain("solid");
    expect(d.recommendations.some((x) => /LUCI|FM2/.test(x.suggestion))).toBe(true);
    expect(d.recommendations.some((x) => /BASS|Saffire/.test(x.suggestion))).toBe(true);
  });
});
