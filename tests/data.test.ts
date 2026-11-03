import { describe, expect, it } from "vitest";
import { allChunks, allTests, countable, filterTests, getTest, rowRanges, sortTests, sourcesFor } from "@/lib/data";
import { searchDocs } from "@/lib/search";
import { getMission, MISSIONS } from "@/lib/missions";

describe("processed data", () => {
  it("loads and validates every test with a source file and row", () => {
    const ts = allTests();
    expect(ts.length).toBe(889);
    for (const t of ts) {
      expect(t.source_file).toMatch(/^Pseudo_DataKeep\//);
      expect(t.source_row).toBeGreaterThanOrEqual(2);
    }
  });
  it("test ids are unique and lookups are case-insensitive", () => {
    const ids = allTests().map((t) => t.test_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getTest("acme-cfig-001")?.test_id).toBe("ACME-CFIG-001");
  });
  it("countable() drops flagged duplicates", () => {
    const dups = allTests().filter((t) => t.flags.includes("duplicate_row")).length;
    expect(dups).toBeGreaterThan(0);
    expect(countable().length).toBe(889 - dups);
  });
  it("filters by investigation and O2 range", () => {
    const r = filterTests({ investigation: ["CFI"], o2_max: 18 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.investigation === "CFI" && (t.o2_pct ?? 99) <= 18)).toBe(true);
  });
  it("sorts descending with nulls last", () => {
    const r = sortTests(filterTests({ investigation: ["SPICE"] }), "-flow_cm_s");
    expect(r[0].flow_cm_s).toBe(85.28);
    expect(r[r.length - 1].flow_cm_s).toBeNull();
  });
  it("compresses row ranges and cites rows", () => {
    expect(rowRanges([5, 2, 3, 4, 9])).toBe("2–5, 9");
    const s = sourcesFor(filterTests({ investigation: ["CFI"] }), 2);
    expect(s[0].row).toBeDefined();
    expect(s.some((x) => x.rows)).toBe(true);
  });
});

describe("doc search", () => {
  it("chunks are page-aware", () => {
    expect(allChunks().every((c) => c.page >= 1 && c.text.length > 0)).toBe(true);
  });
  it("finds the SPICE coflow conditions passage on page 20", () => {
    const hits = searchDocs("101 kPa 21% O2 uniform velocity profiles", { investigation: "SPICE", limit: 5 });
    expect(hits.some((h) => h.page === 20)).toBe(true);
  });
});

describe("missions", () => {
  it("rover demo scenario is 34% / 8.2 psi and labelled demo", () => {
    const m = getMission("lunar-rover")!;
    expect([m.o2_pct, m.pressure_psi, m.demo]).toEqual([34, 8.2, true]);
    expect(MISSIONS.find((x) => x.id.includes("mars"))).toBeUndefined();
  });
});
