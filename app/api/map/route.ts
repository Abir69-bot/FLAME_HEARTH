import { json } from "@/lib/api";
import { countable } from "@/lib/data";
import { MISSIONS } from "@/lib/missions";
import { ISS_PO2_PSI } from "@/lib/physics";

export const runtime = "nodejs";

export function GET() {
  const ts = countable();
  const points = ts
    .filter((t) => t.o2_pct != null && t.pressure_psi != null)
    .map((t) => ({
      test_id: t.test_id,
      investigation: t.investigation,
      o2_pct: t.o2_pct,
      pressure_psi: t.pressure_psi,
      flow_cm_s: t.flow_cm_s,
      fuel: t.fuel,
      campaign: t.campaign,
      from_doc: t.flags.includes("conditions_from_doc"),
    }));
  const notPlotted = ts
    .filter((t) => t.o2_pct == null || t.pressure_psi == null)
    .map((t) => ({
      test_id: t.test_id,
      investigation: t.investigation,
      missing: [t.o2_pct == null ? "o2_pct" : null, t.pressure_psi == null ? "pressure_psi" : null].filter(Boolean),
    }));
  return json({
    points,
    not_plotted: notPlotted,
    missions: MISSIONS,
    iss_po2_psi: ISS_PO2_PSI,
    constant_po2_line: "o2_pct = 100 × 3.087 / pressure_psi",
    lunar_region: { o2_pct: [30, 34], pressure_psi: [8.2, 10.2] },
  });
}
