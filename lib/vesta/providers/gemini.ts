import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { EngineError, type ChatSession, type HistoryMessage, type Provider, type ProviderReply, type ToolResultMessage, type ToolSpec } from "./types";

const MAX_TOKENS = 4000;

/** Gemini via @google/genai, function calling with JSON-schema parameters. */
export function geminiProvider(apiKey: string, model: string): Provider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    id: "gemini",
    model,
    startSession({ system, history, tools }: { system: string; history: HistoryMessage[]; tools: ToolSpec[] }): ChatSession {
      const contents: Content[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.parameters,
      }));
      let callCounter = 0;
      return {
        async send(signal: AbortSignal): Promise<ProviderReply> {
          const res = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: system,
              tools: [{ functionDeclarations }],
              maxOutputTokens: MAX_TOKENS,
              temperature: 0.2,
              abortSignal: signal,
            },
          });
          const cand = res.candidates?.[0];
          if (!cand?.content) {
            if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new EngineError("refusal");
            throw new EngineError("server", "empty response");
          }
          // Keep the model turn as returned (thought signatures included).
          contents.push(cand.content);
          const parts = cand.content.parts ?? [];
          const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("");
          const toolCalls = parts
            .filter((p) => p.functionCall)
            .map((p) => {
              const fc = p.functionCall!;
              if (!fc.name) throw new EngineError("bad_tool_output", "function call without a name");
              return { id: fc.id ?? `gemini-call-${++callCounter}`, name: fc.name, args: fc.args ?? {} };
            });
          return {
            text,
            toolCalls,
            stop: toolCalls.length ? "tool_use" : cand.finishReason === "MAX_TOKENS" ? "max_tokens" : "end",
          };
        },
        addToolResults(results: ToolResultMessage[]) {
          contents.push({
            role: "user",
            parts: results.map((r) => ({
              functionResponse: { id: r.id.startsWith("gemini-call-") ? undefined : r.id, name: r.name, response: r.isError ? { error: r.content } : { output: r.content } },
            })),
          });
        },
        addUserText(text: string) {
          contents.push({ role: "user", parts: [{ text }] });
        },
      };
    },
  };
}
