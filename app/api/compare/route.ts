import { NextRequest } from "next/server";
import { apiError, json } from "@/lib/api";
import { compareInvestigations } from "@/lib/analysis";
import { INVESTIGATIONS, type Investigation } from "@/lib/types";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("inv") ?? "ACME,CFI,SPICE").split(",");
  const inv = [...new Set(raw.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (inv.length < 2 || inv.length > 3 || inv.some((i) => !INVESTIGATIONS.includes(i as Investigation))) {
    return apiError("inv must list 2 or 3 of ACME, CFI, SPICE");
  }
  return json(compareInvestigations(inv as Investigation[]));
}
