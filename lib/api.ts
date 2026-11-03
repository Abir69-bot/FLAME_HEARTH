import { NextResponse } from "next/server";

export function json(data: unknown, init: { status?: number; cache?: boolean } = {}) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers:
      init.cache === false
        ? { "Cache-Control": "no-store" }
        : { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}

export function apiError(message: string, status = 400) {
  return json({ error: message }, { status, cache: false });
}

export function numParam(sp: URLSearchParams, key: string): number | undefined {
  const v = sp.get(key);
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
