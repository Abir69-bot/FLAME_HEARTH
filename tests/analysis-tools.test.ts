import { describe, expect, it } from "vitest";
import { countable } from "@/lib/data";
import { CATEGORY_FIELDS, NUMERIC_FIELDS } from "@/lib/fields";
import { mean, pearson } from "@/lib/stats";
import { runTool } from "@/lib/vesta/tools";
import { checkGrounding, collectNumbers } from "@/lib/vesta/grounding";
import type { ChartPayload } from "@/lib/vesta/tools/make_chart";

/* eslint-disable @typescript-eslint/no-explicit-any */
const analyze = async (args: Record<string, unknown>) => runTool("analyze_data", args);
const chart = async (args: Record<string, unknown>) => runTool("chart_data", { title: "Test", ...args });

const acme = () => countable().filter((t) => t.investigation === "ACME");
const col = (f: string, rows = acme()) => rows.map((t) => NUMERIC_FIELDS[f].get(t)).filter((v): v is number => v != null);

describe("fields", () => {
  it("every numeric field has values somewhere in the data, so none is a dead end", () => {
    for (const [name, f] of Object.entries(NUMERIC_FIELDS)) {
      expect(countable().some((t) => f.get(t) != null), name).toBe(true);
    }
  });

  it("never analyses airflow values that failed the range check", () => {
    expect(countable().filter((t) => t.flags.includes("range_check_failed:flow")).length).toBeGreaterThan(0);
    for (const t of countable()) if (t.flags.includes("range_check_failed:flow")) expect(NUMERIC_FIELDS.flow_cm_s.get(t)).toBeNull();
    expect(Math.min(...col("flow_cm_s", countable()))).toBeGreaterThanOrEqual(0);
  });

  it("reads every ignition outcome, including brief flashes", () => {
    const get = CATEGORY_FIELDS.hot_ignition;
    const of = (v: string) => acme().filter((t) => get(t) === v);
    expect(of("yes").length + of("no").length + of("flash").length).toBe(acme().length);
    for (const v of ["yes", "no", "flash"]) {
      expect(of(v).length).toBeGreaterThan(0);
      for (const t of of(v)) expect(t.outcome).toContain(`hot ignition: ${v}`);
    }
  });
});

describe("analyze_data", () => {
  it("describes a field over every matching row, past query_data's row limit", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "describe", field: "o2_pct" });
    const s = (r.data as any).stats[0];
    expect(s.n).toBe(acme().length);
    expect(s.n).toBeGreaterThan(50);
    expect(s.mean).toBeCloseTo(mean(col("o2_pct"))!, 2);
    expect(r.confidence).toBe("supported");
    expect(r.sources.some((x) => x.file.endsWith("ACME_Experimental_Table.csv"))).toBe(true);
    expect(r.sources.some((x) => x.file === "lib/stats.ts")).toBe(true);
  });

  it("gives the same correlation as computing it directly on the same rows", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "correlation", x: "o2_pct", y: "tad_k" });
    const rows = acme().filter((t) => t.o2_pct != null && NUMERIC_FIELDS.tad_k.get(t) != null);
    const direct = pearson(rows.map((t) => t.o2_pct as number), rows.map((t) => NUMERIC_FIELDS.tad_k.get(t) as number))!;
    expect((r.data as any).n).toBe(rows.length);
    expect((r.data as any).pearson.r).toBeCloseTo(direct.r, 4);
    expect((r.data as any).notes.join(" ")).toContain("not cause");
  });

  it("says so when a field does not vary, instead of inventing a correlation", async () => {
    const r = await analyze({ investigation: ["SPICE"], operation: "correlation", x: "o2_pct", y: "hc_fuel_rate_mg_s" });
    expect((r.data as any).pearson).toBeNull();
    expect((r.data as any).notes.join(" ")).toContain("Not computable");
    expect((r.data as any).notes.join(" ")).toContain("documented");
  });

  it("warns that burn time includes tests that never lit", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "describe", field: "burn_time_s" });
    expect((r.data as any).notes.join(" ")).toContain("did not ignite");
  });

  it("no matching tests is no_data, with no numbers made up", async () => {
    const r = await analyze({ investigation: ["ACME"], fuel: "unobtainium", operation: "describe", field: "o2_pct" });
    expect(r.confidence).toBe("no_data");
    expect((r.data as any).stats[0].mean).toBeNull();
  });

  it("a handful of tests is only extrapolated", async () => {
    const id = acme()[0].fuel!;
    const r = await analyze({ investigation: ["ACME"], fuel: id, where: [{ field: "o2_pct", min: acme()[0].o2_pct!, max: acme()[0].o2_pct! }], operation: "describe", field: "o2_pct" });
    expect((r.data as any).tests_used).toBeLessThan(5);
    expect(r.confidence).toBe("extrapolated");
  });

  it("names the available fields when given a wrong one", async () => {
    const r = await analyze({ operation: "describe", field: "banana" });
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("o2_pct");
  });

  it("fits a regression and reports what it was fitted on", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "regression", y: "tad_k", predictors: ["o2_pct", "pressure_psi"] });
    const d = r.data as any;
    expect(d.coefficients.map((c: any) => c.field)).toEqual(["o2_pct", "pressure_psi"]);
    expect(d.r2).toBeGreaterThan(0);
    expect(d.r2).toBeLessThanOrEqual(1);
    expect(d.tested_range[0].min).toBeLessThan(d.tested_range[0].max);
  });

  it("refuses to predict outside the tested range, and allows it inside", async () => {
    const base = { investigation: ["ACME"], operation: "regression", y: "tad_k", predictors: ["o2_pct"] };
    const fit = (await analyze(base)).data as any;
    const outside = (await analyze({ ...base, predict_at: [fit.tested_range[0].max + 1] })).data as any;
    expect(outside.prediction.status).toBe("refused");
    expect(outside.prediction.y).toBeUndefined();
    const mid = (fit.tested_range[0].max + fit.tested_range[0].min) / 2;
    const inside = (await analyze({ ...base, predict_at: [mid] })).data as any;
    expect(inside.prediction.status).toBe("within_tested_range");
    expect(inside.prediction.y).toBeCloseTo(fit.intercept + fit.coefficients[0].estimate * mid, 0);
  });

  it("a log fit leaves out zeros and says how many", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "regression", y: "burn_time_s", predictors: ["o2_pct"], log_y: true });
    const zeros = acme().filter((t) => NUMERIC_FIELDS.burn_time_s.get(t) === 0).length;
    expect(zeros).toBeGreaterThan(0);
    expect((r.data as any).notes.join(" ")).toContain(`${zeros} tests`);
  });

  it("histogram bins add up to the tests used", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "histogram", field: "o2_pct", bin_width: 10 });
    const d = r.data as any;
    expect(d.bins.reduce((s: number, b: any) => s + b.n, 0)).toBe(d.tests_used);
  });

  it("group_stats covers each group, and a crosstab adds up", async () => {
    const g = (await analyze({ investigation: ["ACME"], operation: "group_stats", group_by: "fuel", field: "burn_time_s" })).data as any;
    expect(g.groups.reduce((s: number, x: any) => s + x.tests, 0)).toBe(acme().length);
    const c = (await analyze({ investigation: ["ACME"], operation: "crosstab", row: "o2_pct", row_bin_width: 10, col: "hot_ignition" })).data as any;
    expect(c.table.reduce((s: number, x: any) => s + x.total, 0)).toBe(acme().length);
    for (const row of c.table) expect(Object.values(row.percent as Record<string, number>).reduce((s, n) => s + n, 0)).toBeCloseTo(100, 2);
  });

  it("compare_groups runs a Welch t-test and lists groups it could not find", async () => {
    const ok = await analyze({ investigation: ["ACME"], operation: "compare_groups", group_by: "hot_ignition", groups: ["yes", "no"], field: "o2_pct" });
    expect((ok.data as any).welch_t_test.p).toBeGreaterThanOrEqual(0);
    const bad = await analyze({ investigation: ["ACME"], operation: "compare_groups", group_by: "hot_ignition", groups: ["yes", "maybe"], field: "o2_pct" });
    expect(bad.ok).toBe(false);
    expect(bad.summary).toContain("Available");
  });

  it("rows sorts by a column and skips tests without it", async () => {
    const d = (await analyze({ investigation: ["ACME"], operation: "rows", fields: ["peak_burner_t_c"], sort: "-peak_burner_t_c", limit: 5 })).data as any;
    expect(d.rows.length).toBe(5);
    const v = d.rows.map((x: any) => x.peak_burner_t_c);
    expect(v).toEqual([...v].sort((a: number, b: number) => b - a));
    expect(v[0]).toBe(Math.max(...col("peak_burner_t_c")));
    expect(d.rows[0].source_row).toBeGreaterThan(0);
  });

  it("the where filter limits on extra columns", async () => {
    const d = (await analyze({ investigation: ["ACME"], where: [{ field: "peak_burner_t_c", min: 500 }], operation: "describe", field: "peak_burner_t_c" })).data as any;
    expect(d.stats[0].min).toBeGreaterThanOrEqual(500);
  });

  it("results can pass the grounding check: every number is in the payload", async () => {
    const r = await analyze({ investigation: ["ACME"], operation: "correlation", x: "o2_pct", y: "tad_k" });
    const known = collectNumbers(JSON.stringify(r.data));
    const rv = (r.data as any).pearson.r;
    expect(checkGrounding(`The correlation is r = ${rv}.`, known).ok).toBe(true);
    expect(checkGrounding("The correlation is r = 0.1234.", known).ok).toBe(false);
  });
});

describe("chart_data", () => {
  const spec = (r: { data: unknown }) => (r.data as { chart: ChartPayload }).chart;

  it("draws every matching test in a scatter, past the 50 row limit", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "scatter", x: "o2_pct", y: "burn_time_s" });
    const series = spec(r).option.series as { data: number[][] }[];
    expect(series[0].data.length).toBe(col("burn_time_s").length);
    expect(series[0].data.length).toBeGreaterThan(50);
    expect(r.sources.some((s) => s.file.endsWith("ACME_Experimental_Table.csv"))).toBe(true);
  });

  it("plots real values", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "scatter", x: "o2_pct", y: "tad_k" });
    const pts = (spec(r).option.series as { data: number[][] }[])[0].data;
    const xs = new Set(col("o2_pct").map((v) => Number(v.toPrecision(6))));
    for (const p of pts) expect(xs.has(p[0])).toBe(true);
  });

  it("the fit line stays inside the tested range and comes with its numbers", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "scatter", x: "o2_pct", y: "tad_k", fit: true });
    const line = (spec(r).option.series as { name: string; type: string; data: number[][] }[]).find((s) => s.type === "line")!;
    const d = r.data as any;
    expect(line.data[0][0]).toBe(d.x_stats.min);
    expect(line.data[1][0]).toBe(d.x_stats.max);
    expect(d.fit.r2).toBeGreaterThan(0);
  });

  it("splits a scatter into one series per category", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "scatter", x: "o2_pct", y: "tad_k", series_by: "hot_ignition" });
    const names = (spec(r).option.series as { name: string }[]).map((s) => s.name).sort();
    expect(names).toEqual(["flash", "no", "yes"]);
  });

  it("refuses too many series rather than draw an unreadable chart", async () => {
    const r = await chart({ chart: "scatter", x: "o2_pct", y: "pressure_psi", series_by: "outcome" });
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("series");
  });

  it("a histogram's bars add up to the tests used", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "histogram", x: "o2_pct", bins: 8 });
    const bars = (spec(r).option.series as { data: number[] }[])[0].data;
    expect(bars.reduce((s, n) => s + n, 0)).toBe((r.data as any).tests_used);
  });

  it("a bar chart summarises y by group", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "bar", x: "fuel", y: "burn_time_s", stat: "mean" });
    const d = r.data as any;
    const top = d.groups[0];
    const rows = acme().filter((t) => t.fuel === top.group);
    expect(top.value).toBeCloseTo(mean(col("burn_time_s", rows))!, 2);
  });

  it("a line chart bins a numeric x in order", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "line", x: "o2_pct", y: "tad_k", x_bin_width: 10 });
    const starts = ((spec(r).option.xAxis as { data: string[] }).data).map((c) => parseFloat(c));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("missing combinations are gaps, never zeros, and survive JSON", async () => {
    const r = await chart({ chart: "bar", x: "investigation", y: "o2_pct", series_by: "fuel_phase" });
    const series = spec(r).option.series as { name: string; data: (number | null)[] }[];
    expect(series.some((s) => s.data.includes(null))).toBe(true);
    expect(series.every((s) => !s.data.includes(0))).toBe(true);
    expect(() => JSON.parse(JSON.stringify(spec(r)))).not.toThrow();
  });

  it("a heatmap leaves untested cells empty and counts add up", async () => {
    const r = await chart({ investigation: ["ACME"], chart: "heatmap", x: "o2_pct", x_bin_width: 10, y: "pressure_psi", y_bin_width: 10 });
    const d = r.data as any;
    const cells = (spec(r).option.series as { data: number[][] }[])[0].data;
    expect(cells.length).toBe(d.cells.length);
    expect(cells.every((c) => c[2] > 0)).toBe(true);
    expect(cells.reduce((s, c) => s + c[2], 0)).toBe(acme().length);
  });

  it("uses a log axis when asked", async () => {
    const r = await chart({ investigation: ["SPICE"], chart: "scatter", x: "size_mm", y: "hc_fuel_rate_mg_s", log_y: true });
    expect((spec(r).option.yAxis as { type: string }).type).toBe("log");
  });

  it("no tests means no chart, and it says so", async () => {
    const r = await chart({ investigation: ["ACME"], fuel: "unobtainium", chart: "scatter", x: "o2_pct", y: "tad_k" });
    expect(r.confidence).toBe("no_data");
    expect((r.data as any).chart).toBeNull();
  });

  it("explains an unknown field", async () => {
    const r = await chart({ chart: "scatter", x: "banana", y: "o2_pct" });
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("o2_pct");
  });
});

describe("grounding reads row citations correctly", () => {
  const ok = (text: string, known: number[] = []) => checkGrounding(text, new Set(known)).ok;

  it("a list of row ranges is a citation, not a set of quantities", () => {
    expect(ok("See ACME_Experimental_Table.csv rows 2–68, 70–76, 78–334.")).toBe(true);
    expect(ok("(rows 46–65, 90–125, 234–276; lib/stats.ts)")).toBe(true);
    expect(ok("rows 12, 45, 99")).toBe(true);
  });

  it("an invented number right after a row list is still caught", () => {
    expect(ok("rows 2–5, 30 psi")).toBe(false);
    expect(ok("rows 2–5, 41.7 psi")).toBe(false);
    expect(ok("rows 2–5, 30% O2")).toBe(false);
    expect(ok("rows 2–5, 41.7")).toBe(false);
    expect(ok("rows 2–5 show a burn time of 300 s")).toBe(false);
  });

  it("the same numbers pass when a tool gave them", () => {
    expect(ok("rows 2–5, 30 psi", [30])).toBe(true);
  });
});

describe("read_doc_page", () => {
  it("reads a page and cites it", async () => {
    const r = await runTool("read_doc_page", { file: "SPICE_Report.pdf", page: 20 });
    expect(r.ok).toBe(true);
    expect((r.data as any).text.length).toBeGreaterThan(50);
    expect(r.sources[0].page).toBe(20);
  });

  it("accepts a full path", async () => {
    const r = await runTool("read_doc_page", { file: "Pseudo_DataKeep/SPICE/SPICE_Report.pdf", page: 20 });
    expect(r.ok).toBe(true);
  });

  it("lists the files when given an unknown one", async () => {
    const r = await runTool("read_doc_page", { file: "secret.pdf", page: 1 });
    expect(r.ok).toBe(false);
    expect(r.summary.toLowerCase()).toContain("spice_report.pdf");
  });

  it("cannot read anything outside the processed PDFs", async () => {
    for (const file of ["../../.env.local", ".env.local", "C:\\Windows\\win.ini"]) {
      expect((await runTool("read_doc_page", { file, page: 1 })).ok).toBe(false);
    }
  });

  it("a page past the end is no_data", async () => {
    const r = await runTool("read_doc_page", { file: "SPICE_Report.pdf", page: 99999 });
    expect(r.confidence).toBe("no_data");
    expect((r.data as any).text).toBeNull();
  });
});
