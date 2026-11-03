import { z } from "zod";
import { compact, filterTests, sortTests, sourcesFor, stats } from "@/lib/data";
import { InvestigationSchema, type TestRecord } from "@/lib/types";
import { defineTool } from "./types";

const GROUPS = ["investigation", "campaign", "fuel", "fuel_phase", "geometry"] as const;

export const queryDataInput = z.object({
  investigation: z.array(InvestigationSchema).optional().describe("Limit to these investigations"),
  fuel_phase: z.enum(["gas", "liquid", "solid"]).optional(),
  fuel: z.string().optional().describe("Substring of the fuel name, e.g. 'propane'"),
  campaign: z.string().optional(),
  o2_min: z.number().optional().describe("Minimum O2 %"),
  o2_max: z.number().optional().describe("Maximum O2 %"),
  pressure_min: z.number().optional().describe("Minimum pressure, psi"),
  pressure_max: z.number().optional().describe("Maximum pressure, psi"),
  flow_min: z.number().optional().describe("Minimum airflow, cm/s"),
  flow_max: z.number().optional().describe("Maximum airflow, cm/s"),
  q: z.string().optional().describe("Free-text match on id, fuel, outcome, notes"),
  group_by: z.enum(GROUPS).optional().describe("Return counts and condition ranges per group"),
  sort: z.string().optional().describe("Field to sort by, prefix '-' for descending, e.g. '-o2_pct'"),
  limit: z.number().int().min(1).max(50).optional().describe("Rows to return (default 10)"),
});

function condStats(ts: TestRecord[]) {
  return {
    o2_pct: stats(ts.map((t) => t.o2_pct)),
    pressure_psi: stats(ts.map((t) => t.pressure_psi)),
    flow_cm_s: stats(ts.map((t) => t.flow_cm_s)),
  };
}

export const queryData = defineTool({
  name: "query_data",
  description:
    "Filter and aggregate the NASA test table (ACME, CFI, SPICE). Returns matching rows (with source file + row), totals, O2/pressure/flow statistics and optional per-group counts. Duplicate rows are excluded.",
  input: queryDataInput,
  run(input) {
    const rows = sortTests(filterTests(input), input.sort ?? "test_id");
    const limit = input.limit ?? 10;
    let groups: ({ key: string; n: number } & ReturnType<typeof condStats>)[] | undefined;
    if (input.group_by) {
      const key = input.group_by;
      const g = new Map<string, TestRecord[]>();
      for (const t of rows) {
        const k = String(t[key] ?? "unknown");
        g.set(k, [...(g.get(k) ?? []), t]);
      }
      groups = [...g.entries()].map(([k, ts]) => ({ key: k, n: ts.length, ...condStats(ts) })).sort((a, b) => b.n - a.n);
    }
    return {
      ok: true,
      data: {
        total: rows.length,
        ...condStats(rows),
        key_metric: stats(rows.map((t) => t.key_metric_value)),
        groups,
        rows: rows.slice(0, limit).map(compact),
      },
      sources: sourcesFor(rows),
      confidence: rows.length ? "supported" : "no_data",
      summary: `${rows.length} matching tests${groups ? ` in ${groups.length} groups` : ""}`,
    };
  },
});
