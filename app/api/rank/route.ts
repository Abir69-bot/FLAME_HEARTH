import { NextRequest } from "next/server";
import { apiError, json } from "@/lib/api";
import { rankForMission } from "@/lib/analysis";
import { getMission } from "@/lib/missions";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("mission") ?? "lunar-rover";
  if (!getMission(id)) return apiError("unknown mission; use iss, lunar-base, lunar-rover or spacesuit", 404);
  return json(rankForMission(id));
}
