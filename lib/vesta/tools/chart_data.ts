import { z } from "zod";
import { sourcesFor } from "@/lib/data";
import { CATEGORY_NAMES, fieldLabel, groupBy, isCategoryField, isNumericField, NUMERIC_FIELDS, NUMERIC_NAMES, pairs } from "@/lib/fields";
import { describe, histogram, mean, median, ols, pearson, sig } from "@/lib/stats";
import type { Confidence, TestRecord, ToolResult } from "@/lib/types";
import { dataFilter, dataNotes, FieldError, requireNumeric, selectTests, STATS_SOURCE } from "./filter";
import { buildOption, MAX_CHART_POINTS, newChartId, type ChartPayload, type MakeChartArgs } from "./make_chart";
import { defineTool, fail } from "./types";

const STATS = { mean, median, min: (v: number[]) => (v.length ? Math.min(...v) : null), max: (v: number[]) => (v.length ? Math.max(...v) : null) } as const;
const MAX_CATEGORIES = 40;
const MAX_SERIES = 8;

export const ChartDataInput = dataFilter.extend({
  chart: z.enum(["scatter", "histogram", "bar", "line", "heatmap"]).describe("scatter: x,y. histogram: x. bar/line: x grouped, y summarised. heatmap: x and y grouped, z summarised (or counts)"),
  title: z.string().min(1).max(80),
  x: z.string().describe("Field on the horizontal axis"),
  y: z.string().optional().describe("Field on the vertical axis"),
  z: z.string().optional().describe("heatmap: numeric field for the colour; default is the test count"),
  stat: z.enum(["mean", "median", "min", "max", "count"]).optional().describe("bar/line/heatmap summary, default mean (count when there is no y)"),
  series_by: z.string().optional().describe("scatter/bar/line: split into one series per category"),
  bins: z.number().int().min(2).max(50).optional().describe("histogram: number of bins"),
  x_bin_width: z.number().positive().optional().describe("Width of bins for a numeric x"),
  y_bin_width: z.number().positive().optional().describe("heatmap: width of bins for a numeric y"),
  fit: z.boolean().optional().describe("scatter: add the least-squares fit line and report r and R²"),
  log_x: z.boolean().optional(),
  log_y: z.boolean().optional(),
});
type Args = z.infer<typeof ChartDataInput>;

function requireAny(field: string | undefined, role: string): string {
  if (!field) throw new FieldError(`${role} is required`);
  if (!isCategoryField(field) && !isNumericField(field)) throw new FieldError(`${role} "${field}" is unknown. Categories: ${CATEGORY_NAMES.join(", ")}. Numeric: ${NUMERIC_NAMES.join(", ")}`);
  return field;
}

const rnd = (v: number | null) => (v == null ? null : sig(v));

function summarise(rows: TestRecord[], y: string | undefined, stat: Args["stat"]): number | null {
  if (!y || stat === "count") return rows.length;
  const v = rows.map((t) => NUMERIC_FIELDS[y].get(t)).filter((n): n is number => n != null);
  return rnd(STATS[stat ?? "mean"](v));
}

function logAxes(option: Record<string, unknown>, a: Args) {
  const mark = (axis: unknown) => ({ ...(axis as object), type: "log", scale: undefined });
  if (a.log_x && a.chart === "scatter") option.xAxis = mark(option.xAxis);
  if (a.log_y && a.chart !== "heatmap") option.yAxis = mark(option.yAxis);
}

interface Built {
  spec: Omit<MakeChartArgs, "title">;
  used: TestRecord[];
  stats: Record<string, unknown>;
  fields: string[];
  fitLine?: { name: string; data: number[][] };
}

function scatter(a: Args, rows: TestRecord[]): Built {
  const x = requireNumeric(a.x, "x");
  const y = requireNumeric(a.y, "y");
  const { rows: all, values } = pairs(rows, [x, y]);
  const keep = values.map((v) => (!a.log_x || v[0] > 0) && (!a.log_y || v[1] > 0));
  const used = all.filter((_, i) => keep[i]);
  const pts = values.filter((_, i) => keep[i]);
  let groups: { name: string; rows: TestRecord[] }[] = [{ name: fieldLabel(y), rows: used }];
  if (a.series_by) {
    const by = requireAny(a.series_by, "series_by");
    groups = groupBy(used, by, undefined).map((g) => ({ name: g.key.slice(0, 60), rows: g.rows }));
    if (groups.length > MAX_SERIES) throw new FieldError(`series_by gives ${groups.length} series (max ${MAX_SERIES}); pick a field with fewer values or filter first`);
  }
  const series = groups.map((g) => ({ name: g.name, points: pairs(g.rows, [x, y]).values.map((v) => [sig(v[0]), sig(v[1])]) }));
  const xs = pts.map((v) => v[0]);
  const ys = pts.map((v) => v[1]);
  const corr = pearson(xs, ys);
  const stats: Record<string, unknown> = { x, y, n: pts.length, x_stats: describe(xs), y_stats: describe(ys), pearson_r: rnd(corr?.r ?? null), pearson_p: rnd(corr?.p ?? null) };
  let fitLine: Built["fitLine"];
  if (a.fit && pts.length) {
    const fit = ols(xs.map((v) => [v]), ys);
    if (fit) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      const at = (v: number) => fit.intercept + fit.coefficients[0].estimate * v;
      // Drawn only across the tested range, never beyond it.
      fitLine = { name: "Least-squares fit", data: [[sig(lo), sig(at(lo))], [sig(hi), sig(at(hi))]] };
      stats.fit = { intercept: rnd(fit.intercept), slope: rnd(fit.coefficients[0].estimate), slope_p: rnd(fit.coefficients[0].p), r2: rnd(fit.r2) };
    }
  }
  return { spec: { type: "scatter", x_label: fieldLabel(x), y_label: fieldLabel(y), series }, used, stats, fields: [x, y], fitLine };
}

function hist(a: Args, rows: TestRecord[]): Built {
  const x = requireNumeric(a.x, "x");
  const used = rows.filter((t) => NUMERIC_FIELDS[x].get(t) != null);
  const values = used.map((t) => NUMERIC_FIELDS[x].get(t) as number);
  const bins = histogram(values, { bins: a.bins, width: a.x_bin_width });
  if (bins.length > MAX_CATEGORIES) throw new FieldError(`that gives ${bins.length} bins (max ${MAX_CATEGORIES}); use a wider x_bin_width`);
  return {
    spec: { type: "bar", x_label: fieldLabel(x), y_label: "Tests", categories: bins.map((b) => `${b.from}–${b.to}`), series: [{ name: "Tests", values: bins.map((b) => b.n) }] },
    used,
    stats: { field: x, stats: describe(values), bins },
    fields: [x],
  };
}

function grouped(a: Args, rows: TestRecord[]): Built {
  const x = requireAny(a.x, "x");
  const y = a.y ? requireNumeric(a.y, "y") : undefined;
  const stat = a.stat ?? (y ? "mean" : "count");
  const base = y && stat !== "count" ? rows.filter((t) => NUMERIC_FIELDS[y].get(t) != null) : rows;
  const groups = groupBy(base, x, a.x_bin_width);
  if (groups.length > MAX_CATEGORIES) throw new FieldError(`x gives ${groups.length} groups (max ${MAX_CATEGORIES}); use x_bin_width or filter first`);
  if (!groups.length) throw new FieldError("no tests have values for this chart");
  const categories = groups.map((g) => g.key.slice(0, 40));
  let seriesList: { name: string; values: number[] }[];
  if (a.series_by) {
    const by = requireAny(a.series_by, "series_by");
    const names = groupBy(base, by).map((g) => g.key);
    if (names.length > MAX_SERIES) throw new FieldError(`series_by gives ${names.length} series (max ${MAX_SERIES})`);
    seriesList = names.map((name) => ({
      name: name.slice(0, 60),
      // A group with no tests has no value at all: it is drawn as a gap, never as a zero.
      values: groups.map((g) => {
        const sub = groupBy(g.rows, by).find((s) => s.key === name);
        return sub ? (summarise(sub.rows, y, stat) ?? NaN) : NaN;
      }),
    }));
  } else {
    seriesList = [{ name: y ? `${stat} ${fieldLabel(y)}` : "Tests", values: groups.map((g) => summarise(g.rows, y, stat) ?? NaN) }];
  }
  return {
    spec: { type: a.chart === "line" ? "line" : "bar", x_label: fieldLabel(x), y_label: y ? `${stat} ${fieldLabel(y)}` : "Tests", categories, series: seriesList },
    used: base,
    stats: { x, y: y ?? null, stat, groups: groups.map((g) => ({ group: g.key, tests: g.rows.length, value: summarise(g.rows, y, stat) })) },
    fields: y ? [y] : [],
  };
}

function heatmap(a: Args, rows: TestRecord[]): Built {
  const x = requireAny(a.x, "x");
  const y = requireAny(a.y, "y");
  const z = a.z ? requireNumeric(a.z, "z") : undefined;
  const stat = a.stat ?? (z ? "mean" : "count");
  const base = z && stat !== "count" ? rows.filter((t) => NUMERIC_FIELDS[z].get(t) != null) : rows;
  const xs = groupBy(base, x, a.x_bin_width);
  const ys = groupBy(base, y, a.y_bin_width);
  if (xs.length > MAX_CATEGORIES || ys.length > MAX_CATEGORIES) throw new FieldError(`that gives ${xs.length} × ${ys.length} cells (max ${MAX_CATEGORIES} per side); use bin widths or filter first`);
  if (!xs.length || !ys.length) throw new FieldError("no tests have values for this chart");
  const cells: number[][] = [];
  const table: { x: string; y: string; tests: number; value: number | null }[] = [];
  xs.forEach((gx, i) => {
    const inX = new Set(gx.rows);
    ys.forEach((gy, j) => {
      const sub = gy.rows.filter((t) => inX.has(t));
      if (!sub.length) return; // an untested cell stays empty: "no test" is not the same as zero
      const value = summarise(sub, z, stat);
      table.push({ x: gx.key, y: gy.key, tests: sub.length, value });
      if (value != null) cells.push([i, j, value]);
    });
  });
  return {
    spec: { type: "heatmap", x_label: fieldLabel(x), y_label: fieldLabel(y), categories: xs.map((g) => g.key.slice(0, 40)), y_categories: ys.map((g) => g.key.slice(0, 40)), series: [{ name: z ? `${stat} ${fieldLabel(z)}` : "Tests", cells }] },
    used: base,
    stats: { x, y, z: z ?? null, stat, cells: table },
    fields: z ? [z] : [],
  };
}

function build(a: Args): { built: Built; rows: TestRecord[] } {
  const rows = selectTests(a);
  const built = a.chart === "scatter" ? scatter(a, rows) : a.chart === "histogram" ? hist(a, rows) : a.chart === "heatmap" ? heatmap(a, rows) : grouped(a, rows);
  return { built, rows };
}

export const chartDataTool = defineTool({
  name: "chart_data",
  description:
    "Draw a chart directly from ALL matching tests (no copying numbers): scatter (optional fit line, series_by, log axes), histogram, bar or line (grouped by a category or numeric bins, stat of y), heatmap (two fields, counts or stat of z). Returns the statistics behind the chart. Same fields as analyze_data.",
  input: ChartDataInput,
  run(a): ToolResult {
    let out;
    try {
      out = build(a);
    } catch (e) {
      if (e instanceof FieldError) return fail(e.message);
      throw e;
    }
    const { built, rows } = out;
    if (!built.used.length) return { ok: true, data: { matched_tests: rows.length, tests_used: 0, chart: null, reason: "No tests have values for these fields." }, sources: [], confidence: "no_data", summary: "no tests to chart" };
    const spec: MakeChartArgs = { ...built.spec, title: a.title, source_note: `${built.used.length} tests, NASA tables via chart_data` } as MakeChartArgs;
    const points = spec.series.reduce((n, s) => n + (s.values?.length ?? 0) + (s.points?.length ?? 0) + (s.cells?.length ?? 0), 0);
    if (points > MAX_CHART_POINTS) return fail(`too many points (max ${MAX_CHART_POINTS})`);
    const option = buildOption(spec);
    logAxes(option, a);
    if (built.fitLine) {
      (option.series as unknown[]).push({ name: built.fitLine.name, type: "line", data: built.fitLine.data, showSymbol: false, lineStyle: { width: 2, type: "dashed" }, color: "#FF7A2F" });
      option.legend = { type: "scroll", top: 22, textStyle: { color: "#97A3BC", fontSize: 10 } };
      (option.grid as Record<string, unknown>).top = 52;
    }
    // NaN is not valid JSON: a gap travels as null, which ECharts draws as a gap.
    const clean = JSON.parse(JSON.stringify(option, (_, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v))) as Record<string, unknown>;
    const chart: ChartPayload = { id: newChartId(), title: a.title, type: spec.type, option: clean, source_note: spec.source_note };
    const notes = dataNotes(built.used, built.fields);
    const confidence: Confidence = built.used.length < 5 ? "extrapolated" : "supported";
    return {
      ok: true,
      data: { matched_tests: rows.length, tests_used: built.used.length, ...built.stats, ...(notes.length ? { notes } : {}), chart },
      sources: [...sourcesFor(built.used), STATS_SOURCE],
      confidence,
      summary: `chart "${a.title}" from ${built.used.length} tests`,
    };
  },
});
