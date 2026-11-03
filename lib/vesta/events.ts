import type { Confidence, Source } from "@/lib/types";
import type { EngineId } from "./engines";
import type { ChartPayload } from "./tools/make_chart";
import type { UiEvent } from "./tools/ui_action";

/** The SSE events every engine emits, in this order: engine → step* → (chart|ui)* → text* → sources → confidence → done. */
export type VestaEvent =
  | { type: "engine"; id: EngineId; label: string; model: string; badge: string; note?: string; fallback_from?: { id: EngineId; reason: string }[] }
  | { type: "step"; tool: string; status: "running" | "done" | "error"; summary: string }
  | { type: "text"; delta: string }
  | { type: "chart"; chart: ChartPayload }
  | { type: "ui"; ui: UiEvent }
  | { type: "sources"; sources: Source[] }
  | { type: "confidence"; confidence: Confidence; note?: string }
  | { type: "done"; cached?: boolean }
  | { type: "error"; message: string };

export type Emit = (e: VestaEvent) => void;

export function sse(e: VestaEvent): string {
  const { type, ...data } = e;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Split final text into small pieces so the panel can render it progressively. */
export function chunkText(text: string, size = 28): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    const space = text.lastIndexOf(" ", end);
    if (end < text.length && space > i + 8) end = space + 1;
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

export function dedupeSources(list: Source[], max = 12): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of list) {
    const k = `${s.file}|${s.row ?? ""}|${s.rows ?? ""}|${s.page ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const RANK: Record<Confidence, number> = { supported: 2, extrapolated: 1, no_data: 0 };

export function lowerConfidence(a: Confidence, b: Confidence): Confidence {
  return RANK[a] <= RANK[b] ? a : b;
}

const TAG = /^\s*\**\s*confidence\s*\**\s*[:：]\s*\**\s*(supported|extrapolated|no_data|no data)\b.*$/gim;

/** Pull the model's "Confidence: x" line out of the text. */
export function extractConfidenceTag(text: string): { text: string; tag?: Confidence } {
  let tag: Confidence | undefined;
  const cleaned = text.replace(TAG, (_m, t: string) => {
    tag = (t.toLowerCase().replace(" ", "_") as Confidence) ?? tag;
    return "";
  });
  return { text: cleaned.replace(/\n{3,}/g, "\n\n").trim(), tag };
}
