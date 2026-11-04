import { engineKey, engineModel, type EngineId } from "../engines";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { openRouterProvider } from "./openrouter";
import type { Provider } from "./types";

/** Build a provider from env, or undefined when its key is missing. */
export function createProvider(id: Exclude<EngineId, "offline">, env: NodeJS.ProcessEnv = process.env): Provider | undefined {
  const key = engineKey(id, env);
  if (!key) return undefined;
  const model = engineModel(id, env);
  if (id === "claude") return anthropicProvider(key, model);
  if (id === "openrouter") return openRouterProvider(key, model);
  if (id === "groq") return groqProvider(key, model);
  return geminiProvider(key, model);
}
