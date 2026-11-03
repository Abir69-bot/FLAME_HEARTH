"use client";
import type { VestaEvent } from "./events";

/** POST /api/vesta and yield parsed SSE events as they arrive. */
export async function* streamVesta(body: unknown, signal?: AbortSignal): AsyncGenerator<VestaEvent> {
  const res = await fetch("/api/vesta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "VESTA is unavailable right now.";
    try {
      const j = await res.json();
      if (typeof j?.error === "string") message = j.error;
    } catch {
      /* keep default */
    }
    yield { type: "error", message };
    yield { type: "done" };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = parseBlock(block);
      if (ev) yield ev;
    }
  }
}

export function parseBlock(block: string): VestaEvent | null {
  let type = "";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!type) return null;
  try {
    return { type, ...(data ? JSON.parse(data) : {}) } as VestaEvent;
  } catch {
    return null;
  }
}
