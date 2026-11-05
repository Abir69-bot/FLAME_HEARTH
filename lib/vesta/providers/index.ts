import { cleanModel, engineKey, engineModel, type EngineId } from "../engines";
import { findClaudeCli } from "../claude-code-cli";
import { anthropicProvider } from "./anthropic";
import { claudeCodeProvider } from "./claude-code";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { openRouterProvider } from "./openrouter";
import type { Provider } from "./types";

/** Build a provider from env, or undefined when its key is missing. */
export function createProvider(id: Exclude<EngineId, "offline">, env: NodeJS.ProcessEnv = process.env): Provider | undefined {
  if (id === "claude-code") {
    const cli = findClaudeCli(env);
    return cli ? claudeCodeProvider({ cli, model: engineModel(id, env), effort: cleanModel(env.VESTA_CLAUDE_CODE_EFFORT), env }) : undefined;
  }
  const key = engineKey(id, env);
  if (!key) return undefined;
  const model = engineModel(id, env);
  if (id === "claude") return anthropicProvider(key, model);
  if (id === "openrouter") return openRouterProvider(key, model);
  if (id === "groq") return groqProvider(key, model);
  return geminiProvider(key, model);
}
