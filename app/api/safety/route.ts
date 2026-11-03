import { NextRequest } from "next/server";
import { apiError, json, numParam } from "@/lib/api";
import { safetyAudit, targetFor } from "@/lib/safety";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const target = targetFor({ mission: sp.get("mission") ?? "lunar-rover", o2_pct: numParam(sp, "o2_pct"), pressure_psi: numParam(sp, "pressure_psi") });
  if (!target) return apiError("unknown mission or conditions", 404);
  return json({ target, findings: safetyAudit(target), note: "Severity is a HEARTH heuristic (0–100), not a NASA rating. Guidelines are evidence, not rules." });
}
