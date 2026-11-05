"use client";
import { useEffect, useState } from "react";
import { useHearth } from "@/lib/store";
import type { EngineChoice, EngineInfo } from "@/lib/vesta/engines";

const FALLBACK: EngineInfo[] = [
  { id: "auto", label: "Auto (recommended)", available: true },
  { id: "claude-code", label: "Claude Code", available: false },
  { id: "claude", label: "Claude", available: false },
  { id: "openrouter", label: "OpenRouter", available: false },
  { id: "groq", label: "Groq", available: false },
  { id: "gemini", label: "Gemini", available: false },
  { id: "offline", label: "Offline", available: true },
];

export function ModelMenu() {
  const engine = useHearth((s) => s.engine);
  const setEngine = useHearth((s) => s.setEngine);
  const [engines, setEngines] = useState<EngineInfo[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetch("/api/vesta/engines")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: EngineInfo[]) => {
        if (!alive || !Array.isArray(list)) return;
        setEngines(list);
        const cur = list.find((e) => e.id === useHearth.getState().engine);
        if (cur && !cur.available) setEngine("auto");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [setEngine]);

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      <span className="sr-only">Model</span>
      <select
        value={engine}
        onChange={(e) => setEngine(e.target.value as EngineChoice)}
        className="rounded-md border border-line bg-raised px-2 py-1 text-xs text-text focus:border-ember focus:outline-none"
        aria-label="VESTA model"
      >
        {engines.map((e) => (
          <option key={e.id} value={e.id} disabled={!e.available}>
            {e.label}
            {!e.available ? (e.id === "claude-code" ? " — local only" : " — no key") : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
