import { z } from "zod";
import { apiError } from "@/lib/api";
import { sse, type VestaEvent } from "@/lib/vesta/events";
import { runVesta } from "@/lib/vesta/router";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 2000;
const MAX_MESSAGES = 20;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(MAX_MESSAGE_CHARS * 3) }))
    .min(1)
    .max(MAX_MESSAGES),
  mission: z.string().max(40).optional(),
  level: z.enum(["student", "researcher", "engineer"]).default("researcher"),
  engine: z.enum(["auto", "claude", "openrouter", "groq", "gemini", "offline"]).default("auto"),
});

/** One request at a time per visitor (per server instance). */
const busy = new Set<string>();

function visitorId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("body must be JSON");
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError("invalid request: send messages (role + content), optional mission, level and engine");
  const last = parsed.data.messages[parsed.data.messages.length - 1];
  if (last.role !== "user") return apiError("the last message must be from the user");
  if (last.content.length > MAX_MESSAGE_CHARS) return apiError(`message is too long (max ${MAX_MESSAGE_CHARS} characters)`);

  const visitor = visitorId(req);
  if (busy.has(visitor)) return apiError("VESTA is still answering your previous question.", 429);
  busy.add(visitor);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: VestaEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(e)));
        } catch {
          /* client went away */
        }
      };
      try {
        await runVesta(
          { messages: parsed.data.messages, missionId: parsed.data.mission, level: parsed.data.level, engine: parsed.data.engine },
          send,
        );
      } catch {
        send({ type: "error", message: "VESTA could not answer right now. Please try again." });
        send({ type: "done" });
      } finally {
        busy.delete(visitor);
        controller.close();
      }
    },
    cancel() {
      busy.delete(visitor);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
