import { openAICompatProvider } from "./openai-compat";
import type { Provider } from "./types";

/** OpenRouter via the openai SDK pointed at OpenRouter's OpenAI-compatible endpoint. */
export function openRouterProvider(apiKey: string, model: string): Provider {
  return openAICompatProvider({
    id: "openrouter",
    apiKey,
    model,
    baseURL: "https://openrouter.ai/api/v1",
    headers: { "HTTP-Referer": "https://github.com/mail6heatler/Project-HEARTH", "X-Title": "HEARTH VESTA" },
    // low effort, reasoning left out of the reply: fast answers, and the output budget goes to the answer and tool calls
    extraBody: () => ({ reasoning: { effort: "low", exclude: true } }),
  });
}
