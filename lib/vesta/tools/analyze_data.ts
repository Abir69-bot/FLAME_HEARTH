import { z } from "zod";
import { sourcesFor } from "@/lib/data";
import { CATEGORY_NAMES, groupBy, isCategoryField, isNumericField, NUMERIC_FIELDS, NUMERIC_NAMES, pairs } from "@/lib/fields";
import { describe, histogram, ols, pearson, percentile, sig, spearman, welch } from "@/lib/stats";
import type { Confidence, TestRecord, ToolResult } from "@/lib/types";
import { dataFilter, dataNotes, FieldError, requireNumeric, selectTests, STATS_SOURCE } from "./filter";
import { defineTool, fail } from "./types";

const OPERATIONS = ["describe", "percentiles", "correlation", "regression", "histogram", "group_stats", "crosstab", "compare_groups", "rows", "list_fields"] as const;

export const AnalyzeInput = dataFilter.extend({
  operation: z.enum(OPERATIONS),
  field: z.string().optional().describe("Numeric field for describe, percentiles, histogram, group_stats, compare_groups"),
  x: z.string().optional().describe("correlation: first field"),
  y: z.string().optional().describe("correlation: second field. regression: the outcome"),
  predictors: z.array(z.string()).min(1).max(5).optional().describe("regression: one or more input fields"),
  log_x: z.boolean().optional().describe("regression: log10 of the predictors (with log_y this fits a power law)"),
  log_y: z.boolean().optional().describe("regression: log10 of y"),
  predict_at: z.array(z.number()).optional().describe("regression: predictor values to evaluate; refused outside the tested range"),
  percentiles: z.array(z.number().min(0).max(100)).max(12).optional(),
  bins: z.number().int().min(2).max(50).optional().describe("histogram: number of bins"),
  bin_width: z.number().positive().optional().describe("histogram: bin width; also bins a numeric group_by"),
  group_by: z.string().optional().describe("group_stats, compare_groups: category or numeric field"),
  groups: z.array(z.string()).length(2).optional().describe("compare_groups: the two group names"),
  row: z.string().optional().describe("crosstab: row field"),
  col: z.string().optional().describe("crosstab: column field"),
  row_bin_width: z.number().positive().optional(),
  col_bin_width: z.number().positive().optional(),
  fields: z.array(z.string()).max(8).optional().describe("rows: columns to return. describe: several fields"),
  sort: z.string().optional().describe("rows: field to sort by, '-' prefix for descending"),
  limit: z.number().int().min(1).max(200).optional().describe("rows: how many (default 20)"),
});
type Args = z.infer<typeof AnalyzeInput>;

function requireGroupField(field: string | undefined, role: string): string {
  if (!field) throw new FieldError(`${role} is required`);
  if (!isCategoryField(field) && !isNumericField(field)) throw new FieldError(`${role} "${field}" is unknown. Categories: ${CATEGORY_NAMES.join(", ")}. Numeric: ${NUMERIC_NAMES.join(", ")}`);
  return field;
}

const column = (rows: TestRecord[], field: string) => rows.map((t) => NUMERIC_FIELDS[field].get(t)).filter((v): v is number => v != null);
const rnd = (x: number | null | undefined) => (x == null ? null : sig(x));

function result(rows: TestRecord[], used: TestRecord[], data: Record<string, unknown>, summary: string, fields: string[], extraNotes: string[] = []): ToolResult {
  // Confidence follows the number of tests behind the result, the same threshold as envelope_check.
  const confidence: Confidence = used.length === 0 ? "no_data" : used.length < 5 ? "extrapolated" : "supported";
  const notes = [...dataNotes(used, fields), ...extraNotes];
  return {
    ok: true,
    data: { matched_tests: rows.length, tests_used: used.length, ...data, ...(notes.length ? { notes } : {}) },
    sources: [...sourcesFor(used), STATS_SOURCE],
    confidence,
    summary,
  };
}

function regression(a: Args, rows: TestRecord[]): ToolResult {
  const y = requireNumeric(a.y, "y");
  if (!a.predictors?.length) throw new FieldError("predictors is required");
  const xs = a.predictors.map((p) => requireNumeric(p, "predictor"));
  const { rows: all, values } = pairs(rows, [y, ...xs]);
  const keep = values.map((v) => (!a.log_y || v[0] > 0) && (!a.log_x || v.slice(1).every((x) => x > 0)));
  const used = all.filter((_, i) => keep[i]);
  const dropped = all.length - used.length;
  const tx = (v: number) => (a.log_x ? Math.log10(v) : v);
  const kept = values.filter((_, i) => keep[i]);
  const fit = ols(
    kept.map((v) => v.slice(1).map(tx)),
    kept.map((v) => (a.log_y ? Math.log10(v[0]) : v[0])),
  );
  const notes = ["A fit shows association in these tests, not cause and effect."];
  if (dropped) notes.push(`${dropped} tests with values of 0 or below were left out because a logarithm was used.`);
  if (!fit) {
    return result(rows, used, { y, predictors: xs, fit: null, reason: "Cannot fit: too few tests, or a field that does not vary, or predictors that move together." }, "regression not possible", [y, ...xs], notes);
  }
  const ranges = xs.map((name, j) => {
    const col = kept.map((v) => v[j + 1]);
    return { field: name, min: rnd(Math.min(...col)), max: rnd(Math.max(...col)) };
  });
  let prediction: Record<string, unknown> | undefined;
  if (a.predict_at) {
    if (a.predict_at.length !== xs.length) throw new FieldError(`predict_at needs ${xs.length} values, one per predictor`);
    const outside = a.predict_at.flatMap((v, j) => (v < (ranges[j].min as number) || v > (ranges[j].max as number) ? [ranges[j].field] : []));
    if (outside.length) {
      prediction = { status: "refused", reason: `Outside the tested range of ${outside.join(", ")}. VESTA does not predict there.` };
    } else {
      const raw = a.predict_at.reduce((s, v, j) => s + fit.coefficients[j].estimate * tx(v), fit.intercept);
      prediction = { status: "within_tested_range", at: a.predict_at, y: rnd(a.log_y ? 10 ** raw : raw) };
    }
  }
  return result(
    rows,
    used,
    {
      y,
      log_y: !!a.log_y,
      log_x: !!a.log_x,
      intercept: rnd(fit.intercept),
      coefficients: fit.coefficients.map((c, j) => ({ field: xs[j], estimate: rnd(c.estimate), se: rnd(c.se), t: rnd(c.t), p: rnd(c.p) })),
      r2: rnd(fit.r2),
      adj_r2: rnd(fit.adj_r2),
      residual_se: rnd(fit.residual_se),
      df: fit.df,
      tested_range: ranges,
      ...(prediction ? { prediction } : {}),
    },
    `regression on ${fit.n} tests, R² ${rnd(fit.r2)}`,
    [y, ...xs],
    notes,
  );
}

function run(a: Args): ToolResult {
  const rows = selectTests(a);
  switch (a.operation) {
    case "list_fields": {
      const numeric = NUMERIC_NAMES.map((f) => ({ field: f, label: NUMERIC_FIELDS[f].label, unit: NUMERIC_FIELDS[f].unit, tests_with_value: column(rows, f).length }));
      return result(rows, rows, { numeric, categories: CATEGORY_NAMES }, `${NUMERIC_NAMES.length} numeric fields`, []);
    }
    case "describe": {
      const fields = (a.fields?.length ? a.fields : [a.field]).map((f) => requireNumeric(f, "field"));
      const stats = fields.map((f) => ({ field: f, missing: rows.length - column(rows, f).length, ...describe(column(rows, f)) }));
      const used = rows.filter((t) => fields.some((f) => NUMERIC_FIELDS[f].get(t) != null));
      return result(rows, used, { stats }, `statistics of ${fields.join(", ")} over ${used.length} tests`, fields);
    }
    case "percentiles": {
      const f = requireNumeric(a.field, "field");
      const v = column(rows, f);
      const ps = a.percentiles?.length ? a.percentiles : [10, 25, 50, 75, 90];
      const used = rows.filter((t) => NUMERIC_FIELDS[f].get(t) != null);
      return result(rows, used, { field: f, percentiles: ps.map((p) => ({ p, value: rnd(percentile(v, p)) })) }, `percentiles of ${f}`, [f]);
    }
    case "correlation": {
      const x = requireNumeric(a.x, "x");
      const y = requireNumeric(a.y, "y");
      const { rows: used, values } = pairs(rows, [x, y]);
      const xs = values.map((v) => v[0]);
      const ys = values.map((v) => v[1]);
      const p = pearson(xs, ys);
      const s = spearman(xs, ys);
      const fmt = (c: typeof p) => (c ? { r: rnd(c.r), p: rnd(c.p) } : null);
      const notes = ["Correlation shows association in these tests, not cause and effect."];
      if (!p) notes.push("Not computable: too few paired tests, or one field does not vary here.");
      return result(rows, used, { x, y, n: values.length, pearson: fmt(p), spearman: fmt(s) }, p ? `r = ${rnd(p.r)} over ${values.length} tests` : "correlation not computable", [x, y], notes);
    }
    case "regression":
      return regression(a, rows);
    case "histogram": {
      const f = requireNumeric(a.field, "field");
      const used = rows.filter((t) => NUMERIC_FIELDS[f].get(t) != null);
      return result(rows, used, { field: f, bins: histogram(column(rows, f), { bins: a.bins, width: a.bin_width }) }, `histogram of ${f}`, [f]);
    }
    case "group_stats": {
      const by = requireGroupField(a.group_by, "group_by");
      const f = requireNumeric(a.field, "field");
      const groups = groupBy(rows, by, a.bin_width);
      const out = groups.map((g) => ({ group: g.key, tests: g.rows.length, ...describe(column(g.rows, f)) }));
      return result(rows, groups.flatMap((g) => g.rows), { group_by: by, field: f, groups: out }, `${f} in ${groups.length} groups of ${by}`, [f]);
    }
    case "crosstab": {
      const rf = requireGroupField(a.row, "row");
      const cf = requireGroupField(a.col, "col");
      const rowGroups = groupBy(rows, rf, a.row_bin_width);
      const colKeys = groupBy(rows, cf, a.col_bin_width).map((g) => g.key);
      const table = rowGroups.map((g) => {
        const cells = Object.fromEntries(groupBy(g.rows, cf, a.col_bin_width).map((c) => [c.key, c.rows.length]));
        const total = Object.values(cells).reduce((s, n) => s + n, 0);
        return { row: g.key, total, counts: Object.fromEntries(colKeys.map((k) => [k, cells[k] ?? 0])), percent: Object.fromEntries(colKeys.map((k) => [k, total ? rnd(((cells[k] ?? 0) / total) * 100) : null])) };
      });
      return result(rows, rowGroups.flatMap((g) => g.rows), { row: rf, col: cf, columns: colKeys, table }, `crosstab of ${rf} by ${cf}`, []);
    }
    case "compare_groups": {
      const by = requireGroupField(a.group_by, "group_by");
      const f = requireNumeric(a.field, "field");
      if (!a.groups) throw new FieldError("groups needs the two group names");
      const groups = groupBy(rows, by, a.bin_width);
      const [ga, gb] = a.groups.map((name) => groups.find((g) => g.key.toLowerCase() === name.toLowerCase()));
      if (!ga || !gb) return fail(`group not found. Available: ${groups.map((g) => g.key).slice(0, 20).join(", ")}`);
      const va = column(ga.rows, f);
      const vb = column(gb.rows, f);
      const w = welch(va, vb);
      const notes = ["Welch's t-test compares means; a low p does not by itself show the grouping caused the difference."];
      return result(rows, [...ga.rows, ...gb.rows], {
        field: f,
        group_a: { name: ga.key, ...describe(va) },
        group_b: { name: gb.key, ...describe(vb) },
        welch_t_test: w ? { difference: rnd(w.difference), t: rnd(w.t), df: rnd(w.df), p: rnd(w.p) } : null,
      }, `compared ${f} between ${ga.key} and ${gb.key}`, [f], notes);
    }
    case "rows": {
      const fields = (a.fields?.length ? a.fields : ["o2_pct", "pressure_psi"]).map((f) => requireNumeric(f, "fields"));
      const key = a.sort?.replace(/^-/, "");
      if (key) requireNumeric(key, "sort");
      const dir = a.sort?.startsWith("-") ? -1 : 1;
      const sorted = key
        ? rows.filter((t) => NUMERIC_FIELDS[key].get(t) != null).sort((p, q) => (NUMERIC_FIELDS[key].get(p)! - NUMERIC_FIELDS[key].get(q)!) * dir)
        : rows;
      const out = sorted.slice(0, a.limit ?? 20);
      const table = out.map((t) => ({ test_id: t.test_id, fuel: t.fuel, source_row: t.source_row, ...Object.fromEntries(fields.map((f) => [f, NUMERIC_FIELDS[f].get(t)])) }));
      return result(rows, out, { fields, total_matching: sorted.length, rows: table }, `${out.length} of ${sorted.length} rows`, fields);
    }
  }
}

export const analyzeDataTool = defineTool({
  name: "analyze_data",
  description:
    `Statistics across ALL matching tests with tested formulas: describe, percentiles, correlation (Pearson + Spearman with p), regression (one or more predictors, log options, predict_at refused outside the tested range), histogram, group_stats, crosstab (counts + percent), compare_groups (Welch t-test), rows (sorted columns), list_fields. Numeric fields: ${NUMERIC_NAMES.join(", ")} (tad_k is the adiabatic flame temperature, peak_burner_t_c the measured burner temperature). Category fields: ${CATEGORY_NAMES.join(", ")}.`,
  input: AnalyzeInput,
  run(a) {
    try {
      return run(a);
    } catch (e) {
      if (e instanceof FieldError) return fail(e.message);
      throw e;
    }
  },
});
