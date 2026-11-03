/** Engine configuration from environment variables. Never exposes key values. */

export type EngineId = "claude" | "groq" | "gemini" | "offline";
export type EngineChoice = EngineId | "auto";

export const ENGINE_ORDER: EngineId[] = ["claude", "groq", "gemini", "offline"];

export const ENGINE_LABELS: Record<EngineChoice, string> = {
  auto: "Auto (recommended)",
  claude: "Claude",
  groq: "Groq",
  gemini: "Gemini",
  offline: "Offline",
};

const DEFAULT_MODELS: Record<Exclude<EngineId, "offline">, string> = {
  claude: "claude-opus-5-5",
  groq: "openai/gpt-oss-120b",
  gemini: "gemini-2.5-flash",
};

const KEY_VARS: Record<Exclude<EngineId, "offline">, string> = {
  claude: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const MODEL_VARS: Record<Exclude<EngineId, "offline">, string> = {
  claude: "ANTHROPIC_MODEL",
  groq: "GROQ_MODEL",
  gemini: "GEMINI_MODEL",
};

/** A key counts as missing when empty or when it still contains a "PASTE" placeholder. */
export function isRealKey(v: string | undefined | null): v is string {
  return !!v && v.trim().length > 0 && !v.includes("PASTE");
}

/** Model names are trimmed at the first whitespace or '#', so a broken .env line still works. */
export function cleanModel(v: string | undefined | null): string | undefined {
  const m = (v ?? "").trim().split(/[\s#]/)[0];
  return m && !m.includes("PASTE") ? m : undefined;
}

export function engineKey(id: EngineId, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (id === "offline") return undefined;
  const v = env[KEY_VARS[id]];
  return isRealKey(v) ? v.trim() : undefined;
}

export function engineModel(id: EngineId, env: NodeJS.ProcessEnv = process.env): string {
  if (id === "offline") return "rule-based";
  return cleanModel(env[MODEL_VARS[id]]) ?? DEFAULT_MODELS[id];
}

export function engineAvailable(id: EngineId, env: NodeJS.ProcessEnv = process.env): boolean {
  return id === "offline" || !!engineKey(id, env);
}

export interface EngineInfo {
  id: EngineChoice;
  label: string;
  available: boolean;
}

/** Public list for GET /api/vesta/engines: id, label, available. Nothing else. */
export function listEngines(env: NodeJS.ProcessEnv = process.env): EngineInfo[] {
  return (["auto", ...ENGINE_ORDER] as EngineChoice[]).map((id) => ({
    id,
    label: ENGINE_LABELS[id],
    available: id === "auto" ? true : engineAvailable(id, env),
  }));
}

/** Order to try: the chosen engine first, then the rest of the chain, Offline always last. */
export function engineChain(choice: EngineChoice): EngineId[] {
  if (choice === "auto") return [...ENGINE_ORDER];
  const rest = ENGINE_ORDER.filter((e) => e !== choice);
  return choice === "offline" ? ["offline"] : [choice, ...rest];
}

export function badge(id: EngineId, model: string): string {
  return id === "offline" ? "Offline mode" : `via ${ENGINE_LABELS[id]} · ${model}`;
}
