import OpenAI from "openai";
import { PROVIDER_TIMEOUT_MS } from "./anthropic";
import { EngineError, type ChatSession, type HistoryMessage, type Provider, type ProviderReply, type ToolResultMessage, type ToolSpec } from "./types";

const MAX_TOKENS = 1500;

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Groq via the openai SDK pointed at Groq's OpenAI-compatible endpoint. */
export function groqProvider(apiKey: string, model: string): Provider {
  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1", maxRetries: 0, timeout: PROVIDER_TIMEOUT_MS });
  return {
    id: "groq",
    model,
    startSession({ system, history, tools }: { system: string; history: HistoryMessage[]; tools: ToolSpec[] }): ChatSession {
      const messages: Msg[] = [{ role: "system", content: system }, ...history.map((m) => ({ role: m.role, content: m.content }) as Msg)];
      const toolDefs: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      return {
        async send(signal: AbortSignal): Promise<ProviderReply> {
          const res = await client.chat.completions.create(
            {
              model,
              messages,
              tools: toolDefs,
              tool_choice: "auto",
              max_completion_tokens: MAX_TOKENS,
              temperature: 0.2,
              // gpt-oss models reason before answering; low effort keeps answers fast and inside free limits
              ...(model.includes("gpt-oss") ? { reasoning_effort: "low" as const } : {}),
            },
            { signal, timeout: PROVIDER_TIMEOUT_MS },
          );
          const choice = res.choices?.[0];
          if (!choice) throw new EngineError("server", "empty response");
          const msg = choice.message;
          const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
          messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls.length ? calls : undefined } as Msg);
          const toolCalls = calls.map((c) => {
            if (c.type !== "function") throw new EngineError("bad_tool_output");
            let args: unknown;
            try {
              args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
            } catch {
              throw new EngineError("bad_tool_output", "tool arguments are not valid JSON");
            }
            return { id: c.id, name: c.function.name, args };
          });
          return {
            text: msg.content ?? "",
            toolCalls,
            stop: toolCalls.length ? "tool_use" : choice.finish_reason === "length" ? "max_tokens" : "end",
          };
        },
        addToolResults(results: ToolResultMessage[]) {
          for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
        },
        addUserText(text: string) {
          messages.push({ role: "user", content: text });
        },
      };
    },
  };
}
