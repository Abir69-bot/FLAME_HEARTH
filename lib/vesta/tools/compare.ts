import { z } from "zod";
import { compareInvestigations } from "@/lib/analysis";
import { InvestigationSchema } from "@/lib/types";
import { defineTool } from "./types";

export const compareTool = defineTool({
  name: "compare",
  description:
    "Compare 2 or 3 investigations (ACME, CFI, SPICE): attributes shared by all, attributes only in one, and O2 / pressure / flow statistics per investigation.",
  input: z.object({
    investigations: z.array(InvestigationSchema).min(2).max(3),
  }),
  run({ investigations }) {
    const invs = [...new Set(investigations)];
    if (invs.length < 2) {
      return { ok: false, data: null, sources: [], summary: "compare needs two different investigations", error: "need 2-3 different investigations" };
    }
    const r = compareInvestigations(invs);
    return {
      ok: true,
      data: { shared: r.shared, only: r.only, conditions: r.conditions },
      sources: r.sources,
      confidence: "supported",
      summary: `compared ${invs.join(", ")}`,
    };
  },
});
