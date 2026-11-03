import { z } from "zod";
import { compact, filterTests, sourcesFor } from "@/lib/data";
import { DIST_FLOW_SCALE, DIST_O2_SCALE, DIST_P_SCALE, nearestTests as nearest } from "@/lib/physics";
import { InvestigationSchema } from "@/lib/types";
import { resolveConditions } from "./resolve";
import { defineTool, fail } from "./types";

export const nearestTestsTool = defineTool({
  name: "nearest_tests",
  description:
    "Find the NASA tests closest to given conditions (O2 %, pressure psi, optional airflow cm/s), using a normalised distance where 1.0 = edge of the ±5 pp O2 / ±2.5 psi envelope.",
  input: z.object({
    o2_pct: z.number().min(0).max(100).optional(),
    pressure_psi: z.number().positive().optional(),
    mission: z.string().optional(),
    flow_cm_s: z.number().optional(),
    k: z.number().int().min(1).max(10).optional(),
    investigation: z.array(InvestigationSchema).optional(),
  }),
  run(input, ctx) {
    const c = resolveConditions(input, ctx);
    if (!c) return fail("nearest_tests needs o2_pct and pressure_psi (or a mission)");
    const hits = nearest(c.o2_pct, c.pressure_psi, filterTests({ investigation: input.investigation }), input.k ?? 5, input.flow_cm_s);
    return {
      ok: true,
      data: {
        target: { ...c, flow_cm_s: input.flow_cm_s ?? null },
        distance_rule: `sqrt((dO2/${DIST_O2_SCALE})^2 + (dP/${DIST_P_SCALE})^2 [+ (dFlow/${DIST_FLOW_SCALE})^2 when both flows are known])`,
        tests: hits.map((h) => ({ distance: h.distance, ...compact(h.test) })),
      },
      sources: sourcesFor(hits.map((h) => h.test)),
      confidence: hits.length && hits[0].distance <= 1 ? "supported" : hits.length ? "extrapolated" : "no_data",
      summary: hits.length ? `nearest: ${hits[0].test.test_id} at distance ${hits[0].distance}` : "no tests with O2 and pressure",
    };
  },
});
