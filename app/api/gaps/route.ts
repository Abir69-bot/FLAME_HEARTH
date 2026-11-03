import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { findGaps } from "@/lib/analysis";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return json(findGaps(req.nextUrl.searchParams.get("mission") ?? undefined));
}
