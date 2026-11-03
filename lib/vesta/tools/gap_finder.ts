import { z } from "zod";
import { findGaps } from "@/lib/analysis";
import { defineTool } from "./types";

export const gapFinderTool = defineTool({
  name: "gap_finder",
  description:
    "Find what the NASA data does NOT cover: empty O2 x pressure cells (especially mission cells and the exploration region 21-50% O2 below 14 psi), missing fuel phases (e.g. solids), untested gravity levels, and the experiments that would fill each gap.",
  input: z.object({
    mission: z.string().optional().describe("Mission id to focus on"),
  }),
  run({ mission }, ctx) {
    const g = findGaps(mission ?? ctx.missionId);
    return {
      ok: true,
      data: {
        o2_bins: g.o2_bins,
        p_bins: g.p_bins,
        focus_cell: g.focus_cell,
        mission_gaps: g.mission_gaps.map(({ o2_bin, p_bin, missions }) => ({ o2_bin, p_bin, missions })),
        exploration_region_gaps: g.exploration_region_gaps.map(({ o2_bin, p_bin }) => ({ o2_bin, p_bin })),
        exploration_region_gap_count: g.exploration_region_gaps.length,
        missing_fuel_phases: g.missing_fuel_phases,
        gravity_levels_tested: g.gravity_levels_tested,
        recommendations: g.recommendations,
        plotted_tests: g.plotted,
      },
      sources: g.sources,
      confidence: "supported",
      summary: `${g.mission_gaps.length} mission cells and ${g.exploration_region_gaps.length} exploration cells have no tests`,
    };
  },
});
