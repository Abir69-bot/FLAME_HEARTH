import { apiError, json } from "@/lib/api";
import { getTest } from "@/lib/data";
import { flowRegime, pO2Calc, ratioToISS } from "@/lib/physics";
import { relatedPassages } from "@/lib/search";

export const runtime = "nodejs";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = getTest(decodeURIComponent(params.id));
  if (!t) return apiError("test not found", 404);
  const label = typeof t.extra.test_label === "string" ? t.extra.test_label : "";
  const hasConditions = t.o2_pct != null && t.pressure_psi != null;
  return json({
    test: t,
    derived: {
      po2: hasConditions ? pO2Calc(t.o2_pct!, t.pressure_psi!) : null,
      ratio_to_iss: hasConditions ? ratioToISS(t.o2_pct!, t.pressure_psi!) : null,
      flow_regime: flowRegime(t.flow_cm_s),
    },
    passages: relatedPassages([label, t.fuel ?? "", t.geometry ?? ""], t.investigation, 3),
    source: { file: t.source_file, row: t.source_row },
  });
}
