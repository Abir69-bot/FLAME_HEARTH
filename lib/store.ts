"use client";
import { create } from "zustand";
import type { Confidence, Source } from "./types";
import type { EngineChoice } from "./vesta/engines";
import type { ChartPayload } from "./vesta/tools/make_chart";

export type Level = "student" | "researcher" | "engineer";

export interface Step {
  tool: string;
  status: "running" | "done" | "error";
  summary: string;
}

export interface VestaMessage {
  id: string;
  role: "user" | "vesta";
  text: string;
  badge?: string;
  note?: string;
  steps: Step[];
  charts: ChartPayload[];
  sources: Source[];
  confidence?: Confidence;
  confidenceNote?: string;
  pending?: boolean;
  error?: string;
  alert?: "ok" | "warn" | "bad";
  cached?: boolean;
}

interface HearthState {
  missionId: string;
  engine: EngineChoice;
  level: Level;
  highlightIds: string[];
  openTestId: string | null;
  pinned: ChartPayload[];
  messages: VestaMessage[];
  busy: boolean;
  draft: string;
  setMission: (id: string) => void;
  setEngine: (e: EngineChoice) => void;
  setLevel: (l: Level) => void;
  setHighlight: (ids: string[]) => void;
  openTest: (id: string | null) => void;
  pin: (c: ChartPayload) => void;
  unpin: (id: string) => void;
  addMessage: (m: VestaMessage) => void;
  updateMessage: (id: string, fn: (m: VestaMessage) => VestaMessage) => void;
  setBusy: (b: boolean) => void;
  setDraft: (d: string) => void;
}

export const useHearth = create<HearthState>((set) => ({
  missionId: "lunar-rover",
  engine: "auto",
  level: "researcher",
  highlightIds: [],
  openTestId: null,
  pinned: [],
  messages: [],
  busy: false,
  draft: "",
  setMission: (missionId) => set({ missionId }),
  setEngine: (engine) => set({ engine }),
  setLevel: (level) => set({ level }),
  setHighlight: (highlightIds) => set({ highlightIds }),
  openTest: (openTestId) => set({ openTestId }),
  pin: (c) => set((s) => (s.pinned.some((p) => p.id === c.id) ? s : { pinned: [...s.pinned, c].slice(-6) })),
  unpin: (id) => set((s) => ({ pinned: s.pinned.filter((p) => p.id !== id) })),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m].slice(-60) })),
  updateMessage: (id, fn) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) })),
  setBusy: (busy) => set({ busy }),
  setDraft: (draft) => set({ draft }),
}));

// ---- small per-viewer preferences in localStorage (always wrapped: storage may be blocked)
const PREFS_KEY = "hearth.prefs.v1";

export function loadPrefs(): Partial<Pick<HearthState, "engine" | "level" | "missionId">> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePrefs(p: Pick<HearthState, "engine" | "level" | "missionId">) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: preferences just don't persist */
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10);
