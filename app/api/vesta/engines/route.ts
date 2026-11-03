import { NextResponse } from "next/server";
import { listEngines } from "@/lib/vesta/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only {id, label, available} per engine. Never keys, key fragments or model secrets. */
export function GET() {
  return NextResponse.json(listEngines(), { headers: { "Cache-Control": "no-store" } });
}
