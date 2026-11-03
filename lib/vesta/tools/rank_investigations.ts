import { z } from "zod";
import { rankInvestigations, RANK_WEIGHTS } from "@/lib/analysis";
import { resolveConditions } from "./resolve";
import { defineTool, fail } from "./types";

export const rankInvestigationsTool = defineTool({
  name: "rank_investigations",
  description:
    "Rank ACME, CFI and SPICE by relevance to a mission or condition (score 0-100 = proximity 40 + O2 coverage 20 + pressure coverage 20 + tests in envelope 20). Returns every score part with its reason.",
  input: z.object({
    mission: z.string().optional().describe("Mission id: iss, lunar-base, lunar-rover, spacesuit"),
    o2_pct: z.number().min(0).max(100).optional(),
    pressure_psi: z.number().positive().optional(),
  }),
  run(input, ctx) {
    const c = resolveConditions(input, ctx);
    if (!c) return fail("rank_investigations needs a mission or o2_pct + pressure_psi");
    const ranking = rankInvestigations(c);
    return {
      ok: true,
      data: { target: c, weights: RANK_WEIGHTS, ranking: ranking.map((r) => ({ investigation: r.investigation, score: r.score, parts: r.parts, envelope_count: r.envelope_count, nearest_ids: r.nearest_ids })) },
      sources: ranking.flatMap((r) => r.sources),
      confidence: ranking[0].envelope_count >= 5 ? "supported" : ranking[0].envelope_count > 0 ? "extrapolated" : "no_data",
      summary: `top: ${ranking[0].investigation} (${ranking[0].score})`,
    };
  },
});
