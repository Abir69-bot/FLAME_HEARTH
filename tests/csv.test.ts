import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { applyMapping, detectMapping, parseCsv } from "@/lib/csv";

describe("lab CSV upload", () => {
  it("parses quotes, CRLF and skips comment lines", () => {
    const rows = parseCsv('# example\r\nname,"O2, %",pressure (bar)\r\n"a ""x""",21,1\r\n\r\nb,30,0.7\r\n');
    expect(rows).toEqual([
      ["name", "O2, %", "pressure (bar)"],
      ['a "x"', "21", "1"],
      ["b", "30", "0.7"],
    ]);
  });

  it("detects columns and units, converts and range-checks", () => {
    const rows = parseCsv("sample,xo2,pressure_kpa,air velocity\nA,0.21,101.3,10\nB,1.2,50,-1\nC,0.3,,5\n");
    const m = detectMapping(rows[0], rows.slice(1));
    expect([m.label, m.o2, m.pressure, m.flow, m.pressure_unit]).toEqual([0, 1, 2, 3, "kPa"]);
    expect(m.o2_is_fraction).toBe(false); // 1.2 is not a fraction
    const out = applyMapping(rows.slice(1), { ...m, o2_is_fraction: true });
    expect(out[0].o2_pct).toBe(21);
    expect(out[0].pressure_psi).toBeCloseTo(14.692, 2);
    expect(out[0].problems).toEqual([]);
    expect(out[1].problems).toEqual(["O2 outside 0–100%", "airflow < 0"]);
    expect(out[2].problems).toEqual(["pressure missing"]);
  });

  it("the example file is labelled as made-up and parses cleanly", () => {
    const text = fs.readFileSync("public/sample_lab_data.csv", "utf8");
    expect(text.split("\n")[0]).toMatch(/EXAMPLE DATA.*NOT NASA/);
    const rows = parseCsv(text);
    const m = detectMapping(rows[0], rows.slice(1));
    const out = applyMapping(rows.slice(1), m);
    expect(out.length).toBe(6);
    expect(out.every((r) => r.problems.length === 0)).toBe(true);
  });
});
