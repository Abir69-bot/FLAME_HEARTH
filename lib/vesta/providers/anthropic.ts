import Anthropic from "@anthropic-ai/sdk";
import { EngineError, type ChatSession, type HistoryMessage, type Provider, type ProviderReply, type ToolResultMessage, type ToolSpec } from "./types";

export const PROVIDER_TIMEOUT_MS = 20_000;
const MAX_TOKENS = 4000;

type Param = Anthropic.Beta.Messages.BetaMessageParam;

/** Claude via @anthropic-ai/sdk. Uses server-side refusal fallbacks ("default" routing). */
export function anthropicProvider(apiKey: string, model: string): Provider {
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: PROVIDER_TIMEOUT_MS });
  return {
    id: "claude",
    model,
    startSession({ system, history, tools }: { system: string; history: HistoryMessage[]; tools: ToolSpec[] }): ChatSession {
      const messages: Param[] = history.map((m) => ({ role: m.role, content: m.content }));
      const toolDefs = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Beta.Messages.BetaTool.InputSchema,
      }));
      return {
        async send(signal: AbortSignal): Promise<ProviderReply> {
          const res = await client.beta.messages.create(
            {
              model,
              max_tokens: MAX_TOKENS,
              system,
              messages,
              tools: toolDefs,
              output_config: { effort: "medium" },
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
            },
            { signal, timeout: PROVIDER_TIMEOUT_MS },
          );
          // Keep the full content (thinking blocks included) in history, unchanged.
          messages.push({ role: "assistant", content: res.content as unknown as Anthropic.Beta.Messages.BetaContentBlockParam[] });
          if (res.stop_reason === "refusal") throw new EngineError("refusal");
          let text = "";
          const toolCalls: ProviderReply["toolCalls"] = [];
          for (const block of res.content) {
            if (block.type === "text") text += block.text;
            else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, args: block.input });
          }
          return {
            text,
            toolCalls,
            stop: toolCalls.length ? "tool_use" : res.stop_reason === "max_tokens" ? "max_tokens" : "end",
          };
        },
        addToolResults(results: ToolResultMessage[]) {
          // All results of one round go back in a single user message.
          messages.push({
            role: "user",
            content: results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content, is_error: r.isError })),
          });
        },
        addUserText(text: string) {
          messages.push({ role: "user", content: text });
        },
      };
    },
  };
}
