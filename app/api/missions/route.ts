import { json } from "@/lib/api";
import { MISSIONS } from "@/lib/missions";
import { pO2, ratioToISS } from "@/lib/physics";

export const runtime = "nodejs";

export function GET() {
  return json({
    missions: MISSIONS.map((m) => ({
      ...m,
      po2_psi: pO2(m.o2_pct, m.pressure_psi),
      ratio_to_iss: ratioToISS(m.o2_pct, m.pressure_psi).value,
    })),
    source: { file: "CLAUDE.md", note: "HEARTH reference atmospheres" },
  });
}
