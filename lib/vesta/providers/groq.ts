import { openAICompatProvider } from "./openai-compat";
import type { Provider } from "./types";

/** Groq via the openai SDK pointed at Groq's OpenAI-compatible endpoint. */
export function groqProvider(apiKey: string, model: string): Provider {
  const provider = openAICompatProvider({
    id: "groq",
    apiKey,
    model,
    baseURL: "https://api.groq.com/openai/v1",
    // gpt-oss models reason before answering; low effort keeps answers fast and inside free limits
    extraBody: (m) => (m.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
  });
  // The free tier allows few tokens per minute, and every request carries all the tool schemas.
  return { ...provider, compactTools: true };
}
