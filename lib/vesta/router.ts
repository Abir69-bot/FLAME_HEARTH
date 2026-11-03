import { runAgent, type AgentOutput } from "./agent";
import { badge, ENGINE_LABELS, engineChain, engineModel, type EngineChoice, type EngineId } from "./engines";
import { chunkText, type Emit, type VestaEvent } from "./events";
import { runOffline } from "./offline";
import type { Level } from "./prompt";
import { createProvider } from "./providers";
import { classifyError, FRIENDLY_REASON, type HistoryMessage, type Provider } from "./providers/types";

export const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

export interface VestaRequest {
  messages: HistoryMessage[];
  missionId?: string;
  level: Level;
  engine: EngineChoice;
}

export interface RouterDeps {
  /** Inject providers (tests). When given, only these are used; a missing entry means "no key". */
  providers?: Partial<Record<Exclude<EngineId, "offline">, Provider | undefined>>;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  chunkDelayMs?: number;
  useCache?: boolean;
  log?: (msg: string) => void;
}

const cache = new Map<string, { at: number; events: VestaEvent[] }>();

export function clearVestaCache() {
  cache.clear();
}

function cacheKey(r: VestaRequest): string {
  return JSON.stringify([r.engine, r.missionId ?? "", r.level, r.messages.map((m) => [m.role, m.content.trim().toLowerCase()])]);
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getProvider(id: Exclude<EngineId, "offline">, deps: RouterDeps): Provider | undefined {
  if (deps.providers) return deps.providers[id];
  return createProvider(id, deps.env ?? process.env);
}

export async function runVesta(req: VestaRequest, emit: Emit, deps: RouterDeps = {}): Promise<void> {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const delay = deps.chunkDelayMs ?? 8;
  const useCache = deps.useCache ?? true;
  const key = cacheKey(req);

  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      for (const e of hit.events) emit(e.type === "done" ? { type: "done", cached: true } : e);
      return;
    }
  }

  const recorded: VestaEvent[] = [];
  const out: Emit = (e) => {
    if (e.type !== "step") recorded.push(e);
    emit(e);
  };

  const failures: { id: EngineId; reason: string }[] = [];
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  for (const id of engineChain(req.engine)) {
    const model = id === "offline" ? "rule-based" : (getProvider(id, deps)?.model ?? engineModel(id, deps.env ?? process.env));
    let result: AgentOutput;
    try {
      if (id === "offline") {
        out(engineEvent(id, model, failures));
        result = await runOffline({ message: lastUser, missionId: req.missionId, level: req.level, emit: out });
      } else {
        const provider = getProvider(id, deps);
        if (!provider) {
          if (req.engine === id) failures.push({ id, reason: FRIENDLY_REASON.no_key });
          continue;
        }
        out(engineEvent(id, provider.model, failures));
        result = await runAgent({ provider, history: req.messages, missionId: req.missionId, level: req.level, emit: out, timeoutMs: deps.timeoutMs });
      }
    } catch (e) {
      const err = classifyError(e);
      log(`[vesta] engine ${id} failed: ${err.kind}`);
      failures.push({ id, reason: FRIENDLY_REASON[err.kind] });
      emit({ type: "step", tool: "engine", status: "error", summary: `${ENGINE_LABELS[id]} ${FRIENDLY_REASON[err.kind]}, switching engine` });
      if (id === "offline") {
        out({ type: "error", message: "VESTA could not answer right now. Please try again." });
        out({ type: "done" });
        return;
      }
      continue;
    }

    for (const chart of result.charts) out({ type: "chart", chart });
    for (const ui of result.ui) out({ type: "ui", ui });
    for (const piece of chunkText(result.text)) {
      out({ type: "text", delta: piece });
      if (delay) await sleep(delay);
    }
    out({ type: "sources", sources: result.sources });
    out({ type: "confidence", confidence: result.confidence, note: result.confidenceNote });
    out({ type: "done" });
    if (useCache) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), events: recorded.filter((e) => e.type !== "step") });
    }
    return;
  }
}

function engineEvent(id: EngineId, model: string, failures: { id: EngineId; reason: string }[]): VestaEvent {
  const note = failures.length
    ? `${failures.map((f) => `${ENGINE_LABELS[f.id]} ${f.reason}`).join("; ")}, answered with ${id === "offline" ? "Offline mode" : ENGINE_LABELS[id]}`
    : undefined;
  return { type: "engine", id, label: ENGINE_LABELS[id], model, badge: badge(id, model), note, fallback_from: failures.length ? [...failures] : undefined };
}
