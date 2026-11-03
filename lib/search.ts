import MiniSearch from "minisearch";
import { allChunks } from "./data";
import type { Chunk, Investigation, Source } from "./types";

let index: MiniSearch<Chunk> | null = null;

function getIndex(): MiniSearch<Chunk> {
  if (index) return index;
  index = new MiniSearch<Chunk>({
    idField: "chunk_id",
    fields: ["text"],
    storeFields: ["chunk_id", "investigation", "source_file", "page", "text"],
    searchOptions: { prefix: true, fuzzy: 0.15, combineWith: "OR" },
  });
  index.addAll(allChunks());
  return index;
}

export interface Passage {
  chunk_id: string;
  investigation: Investigation;
  source_file: string;
  page: number;
  score: number;
  snippet: string;
}

function snippet(text: string, terms: string[], max = 420): string {
  const low = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = low.indexOf(t.toLowerCase());
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, (at < 0 ? 0 : at) - 120);
  const s = text.slice(start, start + max).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + s + (start + max < text.length ? "…" : "");
}

export function searchDocs(query: string, opts: { investigation?: Investigation; limit?: number } = {}): Passage[] {
  const q = query.trim();
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10);
  const results = getIndex().search(q, {
    filter: opts.investigation ? (r) => r.investigation === opts.investigation : undefined,
  });
  return results.slice(0, limit).map((r) => ({
    chunk_id: r.chunk_id as string,
    investigation: r.investigation as Investigation,
    source_file: r.source_file as string,
    page: r.page as number,
    score: Math.round(r.score * 100) / 100,
    snippet: snippet(r.text as string, r.terms),
  }));
}

export function passageSources(p: Passage[]): Source[] {
  return p.map((x) => ({ file: x.source_file, page: x.page }));
}

/** PDF passages that mention a test label or fuel (used by the details drawer). */
export function relatedPassages(terms: string[], investigation: Investigation, limit = 3): Passage[] {
  return searchDocs(terms.filter(Boolean).join(" "), { investigation, limit });
}
