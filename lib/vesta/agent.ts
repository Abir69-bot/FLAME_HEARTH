import type { Confidence, Source } from "@/lib/types";
import { dedupeSources, extractConfidenceTag, lowerConfidence, type Emit } from "./events";
import { checkGrounding, collectNumbers, fixRequest, matches, UNVERIFIED_NOTE } from "./grounding";
import { systemPrompt, type Level } from "./prompt";
import { PROVIDER_TIMEOUT_MS } from "./providers/anthropic";
import { EngineError, type HistoryMessage, type Provider, type ProviderReply, type ToolResultMessage } from "./providers/types";
import { runTool, VESTA_TOOLS } from "./tools";
import type { ChartPayload } from "./tools/make_chart";
import { toolSpecs } from "./tools/schemas";
import type { UiEvent } from "./tools/ui_action";

export const MAX_TOOL_ROUNDS = 6;
export const MAX_INVALID_CALLS = 3;
export const TOOL_RESULT_MAX_CHARS = 3500;

export interface AgentInput {
  provider: Provider;
  history: HistoryMessage[];
  missionId?: string;
  level: Level;
  signal?: AbortSignal;
  /** Live progress (tool steps). Final content is returned, not emitted. */
  emit: Emit;
  timeoutMs?: number;
}

export interface AgentOutput {
  text: string;
  confidence: Confidence;
  confidenceNote?: string;
  sources: Source[];
  charts: ChartPayload[];
  ui: UiEvent[];
  toolsUsed: string[];
}

/** Run one provider call with a hard timeout (and the caller's abort signal). */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, outer?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(ctrl.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctrl.abort();
          reject(new EngineError("timeout"));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}

function truncate(s: string): string {
  return s.length <= TOOL_RESULT_MAX_CHARS ? s : `${s.slice(0, TOOL_RESULT_MAX_CHARS)} …[truncated]`;
}

const EVIDENCE_TOOLS = new Set(["envelope_check", "nearest_tests"]);

/** These tools always move the dashboard, in every engine, even if the model forgets ui_action. */
export const AUTO_VIEW: Record<string, UiEvent> = {
  compare: { action: "go_view", view: "compare", path: "/compare" },
  safety_audit: { action: "go_view", view: "safety", path: "/safety" },
  gap_finder: { action: "go_view", view: "safety", path: "/safety" },
};

export function withAutoView(ui: UiEvent[], toolsUsed: string[], compareArgs?: string[]): UiEvent[] {
  if (ui.some((u) => u.action === "go_view")) return ui;
  const tool = [...toolsUsed].reverse().find((t) => AUTO_VIEW[t]);
  if (!tool) return ui;
  const ev = { ...AUTO_VIEW[tool] };
  if (tool === "compare" && compareArgs?.length) ev.compare = compareArgs;
  return [...ui, ev];
}

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const { provider, history, emit } = input;
  const timeout = input.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const known = new Set<number>();
  for (const m of history) if (m.role === "user") collectNumbers(m.content, known);

  const ctx = { missionId: input.missionId, isKnownNumber: (n: number) => matches(n, 6, known) };
  const session = provider.startSession({ system: systemPrompt(input.missionId, input.level), history, tools: toolSpecs(VESTA_TOOLS) });

  const sources: Source[] = [];
  const charts: ChartPayload[] = [];
  const ui: UiEvent[] = [];
  const toolsUsed: string[] = [];
  const evidence: Confidence[] = [];
  const otherConf: Confidence[] = [];
  let rounds = 0;
  let invalid = 0;
  let askedFix = false;
  let calls = 0;
  let compareArgs: string[] | undefined;

  for (;;) {
    if (++calls > MAX_TOOL_ROUNDS + 3) throw new EngineError("other", "too many model calls");
    const reply: ProviderReply = await withTimeout((s) => session.send(s), timeout, input.signal);

    if (reply.toolCalls.length) {
      rounds++;
      const results: ToolResultMessage[] = [];
      for (const call of reply.toolCalls) {
        if (rounds > MAX_TOOL_ROUNDS) {
          results.push({ id: call.id, name: call.name, isError: true, content: "Tool limit reached. Answer now with the results you already have." });
          continue;
        }
        emit({ type: "step", tool: call.name, status: "running", summary: `calling ${call.name}` });
        const res = await runTool(call.name, call.args, ctx);
        if (!res.ok && (res.error === "unknown_tool" || res.error === "invalid_arguments")) {
          if (++invalid >= MAX_INVALID_CALLS) throw new EngineError("bad_tool_output");
        }
        emit({ type: "step", tool: call.name, status: res.ok ? "done" : "error", summary: res.summary });
        const payload = truncate(JSON.stringify({ ok: res.ok, data: res.data, sources: res.sources, confidence: res.confidence, error: res.error }));
        if (res.ok) {
          toolsUsed.push(call.name);
          if (call.name === "compare") compareArgs = (call.args as { investigations?: string[] })?.investigations;
          collectNumbers(payload, known);
          sources.push(...res.sources);
          if (res.confidence) (EVIDENCE_TOOLS.has(call.name) ? evidence : otherConf).push(res.confidence);
          const d = res.data as { chart?: ChartPayload; ui?: UiEvent } | null;
          if (call.name === "make_chart" && d?.chart) charts.push(d.chart);
          if (call.name === "ui_action" && d?.ui) ui.push(d.ui);
        }
        results.push({ id: call.id, name: call.name, isError: !res.ok, content: payload });
      }
      session.addToolResults(results);
      continue;
    }

    const { text, tag } = extractConfidenceTag(reply.text ?? "");
    if (!text) throw new EngineError("other", "empty answer");
    const g = checkGrounding(text, known);
    if (!g.ok && !askedFix) {
      askedFix = true;
      session.addUserText(fixRequest(g.unverified));
      continue;
    }

    const fromTools: Confidence = evidence.length
      ? evidence.reduce(lowerConfidence)
      : otherConf.length
        ? otherConf.reduce(lowerConfidence)
        : "extrapolated";
    let confidence = tag ? lowerConfidence(tag, fromTools) : fromTools;
    let finalText = text;
    let note: string | undefined;
    if (!g.ok) {
      finalText = `${text}\n\n${UNVERIFIED_NOTE}`;
      confidence = lowerConfidence(confidence, "extrapolated");
      note = UNVERIFIED_NOTE;
    }
    return { text: finalText, confidence, confidenceNote: note, sources: dedupeSources(sources), charts, ui: withAutoView(ui, toolsUsed, compareArgs), toolsUsed };
  }
}
