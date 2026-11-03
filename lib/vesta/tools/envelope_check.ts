import { z } from "zod";
import { allTests, getTest, sourcesFor } from "@/lib/data";
import { envelopeCheck as check, nearestTests } from "@/lib/physics";
import type { TestRecord } from "@/lib/types";
import { resolveConditions } from "./resolve";
import { defineTool, fail } from "./types";

export const envelopeCheckTool = defineTool({
  name: "envelope_check",
  description:
    "Is a condition inside the tested data envelope? supported = at least 5 NASA tests within ±5 percentage points O2 and ±2.5 psi; sparse = 1-4; no_data = 0. Also returns the 3 nearest tests.",
  input: z.object({
    o2_pct: z.number().min(0).max(100).optional(),
    pressure_psi: z.number().positive().optional(),
    mission: z.string().optional(),
  }),
  run(input, ctx) {
    const c = resolveConditions(input, ctx);
    if (!c) return fail("envelope_check needs o2_pct and pressure_psi (or a mission)");
    const env = check(c.o2_pct, c.pressure_psi, allTests());
    const inside = env.test_ids.map((id) => getTest(id)).filter(Boolean) as TestRecord[];
    const near = nearestTests(c.o2_pct, c.pressure_psi, allTests(), 3);
    return {
      ok: true,
      data: {
        target: c,
        status: env.status,
        count: env.count,
        by_investigation: env.by_investigation,
        window: env.window,
        rule: env.rule,
        test_ids: env.test_ids.slice(0, 25),
        nearest: near.map((h) => ({
          test_id: h.test.test_id,
          investigation: h.test.investigation,
          o2_pct: h.test.o2_pct,
          pressure_psi: h.test.pressure_psi,
          distance: h.distance,
        })),
      },
      sources: sourcesFor(inside.length ? inside : near.map((h) => h.test)),
      confidence: env.confidence,
      summary: `${env.status}: ${env.count} tests within the envelope`,
    };
  },
});
