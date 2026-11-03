import { z } from "zod";
import { apiError, json } from "@/lib/api";
import { allTests, compact } from "@/lib/data";
import { envelopeCheck, flowRegime, hazardIndex, nearestTests, o2VsEarth, pO2Calc, ratioToISS } from "@/lib/physics";

export const runtime = "nodejs";

const Body = z.object({
  o2_pct: z.number().min(0).max(100),
  pressure_psi: z.number().positive().max(200),
  flow_cm_s: z.number().min(-10).max(500).nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("body must be JSON");
  }
  const p = Body.safeParse(body);
  if (!p.success) return apiError(p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { o2_pct, pressure_psi, flow_cm_s } = p.data;
  const env = envelopeCheck(o2_pct, pressure_psi, allTests());
  return json(
    {
      inputs: p.data,
      po2: pO2Calc(o2_pct, pressure_psi),
      ratio_to_iss: ratioToISS(o2_pct, pressure_psi),
      o2_vs_earth: o2VsEarth(o2_pct),
      flow_regime: flowRegime(flow_cm_s),
      envelope: { status: env.status, count: env.count, by_investigation: env.by_investigation, rule: env.rule, confidence: env.confidence },
      hazard_index: hazardIndex(o2_pct, pressure_psi, flow_cm_s, env.status),
      nearest: nearestTests(o2_pct, pressure_psi, allTests(), 5, flow_cm_s).map((h) => ({ distance: h.distance, ...compact(h.test) })),
      source: { file: "lib/physics.ts", note: "tested formulas" },
    },
    { cache: false },
  );
}
