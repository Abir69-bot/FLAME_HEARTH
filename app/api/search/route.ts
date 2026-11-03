import { NextRequest } from "next/server";
import { apiError, json, numParam } from "@/lib/api";
import { searchDocs } from "@/lib/search";
import { INVESTIGATIONS, type Investigation } from "@/lib/types";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").slice(0, 200);
  if (q.trim().length < 2) return apiError("q must be at least 2 characters");
  const inv = sp.get("investigation")?.toUpperCase();
  if (inv && !INVESTIGATIONS.includes(inv as Investigation)) return apiError("investigation must be ACME, CFI or SPICE");
  return json({
    query: q,
    passages: searchDocs(q, { investigation: inv as Investigation | undefined, limit: numParam(sp, "limit") ?? 5 }),
  });
}
