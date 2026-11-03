import { NextRequest } from "next/server";
import { apiError, json, numParam } from "@/lib/api";
import { compact, filterTests, sortTests, stats } from "@/lib/data";
import { INVESTIGATIONS, type Investigation } from "@/lib/types";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const inv = sp
    .get("investigation")
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (inv?.some((i) => !INVESTIGATIONS.includes(i as Investigation))) return apiError("investigation must be ACME, CFI or SPICE");
  const page = Math.max(1, Math.floor(numParam(sp, "page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(numParam(sp, "page_size") ?? 25)));
  const rows = sortTests(
    filterTests({
      investigation: inv as Investigation[] | undefined,
      fuel_phase: sp.get("fuel_phase") ?? undefined,
      o2_min: numParam(sp, "o2_min"),
      o2_max: numParam(sp, "o2_max"),
      q: sp.get("q") ?? undefined,
      include_duplicates: sp.get("include_duplicates") === "true",
    }),
    sp.get("sort") ?? "test_id",
  );
  const byCampaign: Record<string, number> = {};
  for (const t of rows) {
    const k = `${t.investigation} · ${t.campaign ?? "unknown"}`;
    byCampaign[k] = (byCampaign[k] ?? 0) + 1;
  }
  return json({
    total: rows.length,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(rows.length / pageSize)),
    o2_pct: stats(rows.map((t) => t.o2_pct)),
    by_campaign: byCampaign,
    o2_values: rows.map((t) => t.o2_pct).filter((v): v is number => v != null),
    rows: rows.slice((page - 1) * pageSize, page * pageSize).map(compact),
  });
}
