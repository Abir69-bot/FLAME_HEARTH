/** One shared interface for every AI engine. Each session keeps its provider-native history. */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema generated once from the tool's zod schema. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Parsed JSON arguments (validated with zod by the agent before running). */
  args: unknown;
}

export interface ProviderReply {
  text: string;
  toolCalls: ToolCall[];
  stop: "tool_use" | "end" | "max_tokens" | "refusal";
}

export interface ToolResultMessage {
  id: string;
  name: string;
  content: string;
  isError: boolean;
}

export interface ChatSession {
  send(signal: AbortSignal): Promise<ProviderReply>;
  addToolResults(results: ToolResultMessage[]): void;
  addUserText(text: string): void;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Provider {
  id: "claude" | "groq" | "gemini";
  model: string;
  startSession(input: { system: string; history: HistoryMessage[]; tools: ToolSpec[] }): ChatSession;
}

/** Errors the router understands. Never carries a key or raw provider text to the user. */
export type EngineErrorKind = "no_key" | "auth" | "rate_limit" | "server" | "timeout" | "no_tools" | "bad_tool_output" | "refusal" | "model_unavailable" | "other";

export class EngineError extends Error {
  constructor(
    public kind: EngineErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/** Map any SDK error (they all carry a numeric `status`) to an EngineError kind. */
export function classifyError(e: unknown): EngineError {
  if (e instanceof EngineError) return e;
  const err = e as { status?: unknown; name?: string; message?: string; code?: string };
  const status = typeof err?.status === "number" ? err.status : undefined;
  const text = `${err?.name ?? ""} ${err?.message ?? ""} ${err?.code ?? ""}`.toLowerCase();
  if (status === 401 || status === 403) return new EngineError("auth");
  if (status === 429 || text.includes("quota") || text.includes("rate limit")) return new EngineError("rate_limit");
  if (status != null && status >= 500) return new EngineError("server");
  if (text.includes("timeout") || text.includes("timed out") || text.includes("abort")) return new EngineError("timeout");
  if (status === 400 && (text.includes("tool") || text.includes("function"))) return new EngineError("no_tools");
  if (status === 404) return new EngineError("model_unavailable");
  return new EngineError("other");
}

export const FRIENDLY_REASON: Record<EngineErrorKind, string> = {
  no_key: "no key",
  auth: "key rejected",
  rate_limit: "limit reached",
  server: "service error",
  timeout: "timed out",
  no_tools: "cannot use tools",
  bad_tool_output: "sent an invalid tool call",
  refusal: "declined the request",
  model_unavailable: "model not available",
  other: "unavailable",
};
