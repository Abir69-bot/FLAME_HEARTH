import { z } from "zod";
import { safetyAudit, targetFor } from "@/lib/safety";
import type { Confidence } from "@/lib/types";
import { defineTool, fail } from "./types";

export const safetyAuditTool = defineTool({
  name: "safety_audit",
  description:
    "Fire-safety audit for a mission or condition: Prevention / Detection / Suppression findings (oxygen enrichment, untested cabin materials, cool flames, smoke detection, still air and flow control, partial gravity), each with a heuristic severity 0-100, evidence from the NASA data, sources, its own confidence and an 'evidence suggests' guideline.",
  input: z.object({
    mission: z.string().optional().describe("Mission id: iss, lunar-base, lunar-rover, spacesuit (also sets the gravity level)"),
    o2_pct: z.number().min(0).max(100).optional(),
    pressure_psi: z.number().positive().optional(),
  }),
  run(input, ctx) {
    const target = targetFor({ mission: input.mission ?? ctx.missionId, o2_pct: input.o2_pct, pressure_psi: input.pressure_psi });
    if (!target) return fail("safety_audit needs a mission or o2_pct + pressure_psi");
    const findings = safetyAudit(target);
    // overall = how well the condition itself is covered, lowered when some findings have no data
    const condition = findings.find((f) => f.id === "oxygen_enrichment")?.confidence ?? "no_data";
    const anyGap = findings.some((f) => f.confidence !== "supported");
    const confidence: Confidence = condition === "supported" && anyGap ? "extrapolated" : condition;
    return {
      ok: true,
      data: { target, findings },
      sources: findings.flatMap((f) => f.sources),
      confidence,
      summary: `${findings.length} findings; top: ${findings[0].title} (${findings[0].severity})`,
    };
  },
});
