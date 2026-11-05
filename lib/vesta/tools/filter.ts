import { z } from "zod";
import { filterTests } from "@/lib/data";
import { isNumericField, NUMERIC_FIELDS, NUMERIC_NAMES } from "@/lib/fields";
import type { Source, TestRecord } from "@/lib/types";
import { queryDataInput } from "./query_data";

/** The same filters as query_data, plus a min/max on any numeric column. Used by analyze_data and chart_data. */
export const dataFilter = queryDataInput
  .pick({ investigation: true, fuel_phase: true, fuel: true, campaign: true, o2_min: true, o2_max: true, pressure_min: true, pressure_max: true, flow_min: true, flow_max: true, q: true })
  .extend({
    where: z
      .array(z.object({ field: z.string(), min: z.number().optional(), max: z.number().optional() }))
      .max(6)
      .optional()
      .describe("Extra min/max limits on any numeric field"),
  });

export type DataFilter = z.infer<typeof dataFilter>;

export const STATS_SOURCE: Source = { file: "lib/stats.ts", note: "tested formula (tests/stats.test.ts)" };

export class FieldError extends Error {}

export function requireNumeric(field: string | undefined, role: string): string {
  if (!field) throw new FieldError(`${role} is required`);
  if (!isNumericField(field)) throw new FieldError(`${role} "${field}" is not a numeric field. Use one of: ${NUMERIC_NAMES.join(", ")}`);
  return field;
}

/** Filtered tests, duplicates excluded. */
export function selectTests(f: DataFilter): TestRecord[] {
  let rows = filterTests(f);
  for (const w of f.where ?? []) {
    const name = requireNumeric(w.field, "where.field");
    const get = NUMERIC_FIELDS[name].get;
    rows = rows.filter((t) => {
      const v = get(t);
      return v != null && (w.min == null || v >= w.min) && (w.max == null || v <= w.max);
    });
  }
  return rows;
}

/** Limits the reader should know, based on what was actually selected. */
export function dataNotes(rows: TestRecord[], fields: string[]): string[] {
  const notes: string[] = [];
  const uses = (...names: string[]) => names.some((n) => fields.includes(n));
  if (uses("o2_pct", "pressure_psi", "po2_psi") && rows.some((t) => t.flags.includes("conditions_from_doc"))) {
    notes.push("SPICE O2 and pressure are one documented condition, not measured per row.");
  }
  if (uses("burn_time_s")) notes.push("Burn time is 0 or missing for tests that did not ignite; add q: \"hot ignition: yes\" to study only sustained flames.");
  const fuels = new Set(rows.map((t) => t.fuel).filter(Boolean));
  if (fuels.size > 1) notes.push(`These tests mix ${fuels.size} fuels; limit by fuel to remove that effect.`);
  return notes;
}
