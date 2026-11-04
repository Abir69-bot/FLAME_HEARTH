import { beforeEach, describe, expect, it } from "vitest";
import { POST as vestaPOST } from "@/app/api/vesta/route";
import { findGaps } from "@/lib/analysis";
import { memo, RateLimiter } from "@/lib/ratelimit";
import type { VestaEvent } from "@/lib/vesta/events";
import { classifyError, type ChatSession, type Provider, type ProviderReply } from "@/lib/vesta/providers/types";
import { clearVestaCache, runVesta } from "@/lib/vesta/router";

function provider(id: Provider["id"], replies: (ProviderReply | Error)[]) {
  const log = { sessions: 0 };
  let i = 0;
  const p: Provider = {
    id,
    model: `${id}-m`,
    startSession(): ChatSession {
      log.sessions++;
      return {
        async send() {
          const r = replies[Math.min(i++, replies.length - 1)];
          if (r instanceof Error) throw r;
          return r;
        },
        addToolResults() {},
        addUserText() {},
      };
    },
  };
  return { p, log };
}
const err = (status: number) => Object.assign(new Error("x"), { status });
const answer: ProviderReply = { text: "Hello from the test engine. Confidence: extrapolated", toolCalls: [], stop: "end" };

async function ask(deps: Parameters<typeof runVesta>[2], q = "hello there") {
  const ev: VestaEvent[] = [];
  await runVesta({ messages: [{ role: "user", content: q }], level: "student", engine: "auto" }, (e) => ev.push(e), { chunkDelayMs: 0, useCache: false, log: () => {}, ...deps });
  const engines = ev.filter((e) => e.type === "engine") as Extract<VestaEvent, { type: "engine" }>[];
  return engines[engines.length - 1];
}

beforeEach(() => clearVestaCache());

describe("error classification", () => {
  it("treats Gemini's 400 API_KEY_INVALID as a rejected key", () => {
    const gemini = Object.assign(new Error('{"error":{"status":"INVALID_ARGUMENT","message":"API key not valid.","reason":"API_KEY_INVALID"}}'), { status: 400 });
    expect(classifyError(gemini).kind).toBe("auth");
  });

  it("does not treat other 400s as key problems", () => {
    expect(classifyError(Object.assign(new Error("bad request"), { status: 400 })).kind).toBe("other");
  });
});

describe("engine cooldown", () => {
  it("skips an engine that just hit its limit, then retries after the cooldown", async () => {
    let t = 1_000_000;
    const now = () => t;
    const groq = provider("groq", [err(429), answer]);
    const gemini = provider("gemini", [answer]);
    const deps = { providers: { groq: groq.p, gemini: gemini.p }, now };
    expect((await ask(deps, "q1")).id).toBe("gemini");
    expect(groq.log.sessions).toBe(1);
    const second = await ask(deps, "q2");
    expect(second.id).toBe("gemini");
    expect(second.note).toContain("skipped for now");
    expect(groq.log.sessions).toBe(1); // not called again
    t += 61_000;
    expect((await ask(deps, "q3")).id).toBe("groq");
  });

  it("goes straight to Offline once the AI time budget is used up", async () => {
    let t = 0;
    const slow = provider("claude", [err(500)]);
    const groq = provider("groq", [answer]);
    const now = () => (t += 30_000); // every clock read advances 30 s
    const last = await ask({ providers: { claude: slow.p, groq: groq.p }, now, deadlineMs: 40_000 }, "What is pO2 at 21% and 14.7 psi?");
    expect(last.id).toBe("offline");
    expect(groq.log.sessions).toBe(0);
  });
});

describe("rate limit and caching", () => {
  it("allows N requests per window, then asks to wait", () => {
    const rl = new RateLimiter(3, 60_000);
    expect([rl.check("a", 0), rl.check("a", 1), rl.check("a", 2)]).toEqual([0, 0, 0]);
    expect(rl.check("a", 3)).toBe(60);
    expect(rl.check("b", 3)).toBe(0);
    expect(rl.check("a", 60_001)).toBe(0);
  });

  it("memoises pure results", () => {
    let calls = 0;
    const f = memo((x: number) => (calls++, x * 2));
    expect([f(2), f(2), f(3)]).toEqual([4, 4, 6]);
    expect(calls).toBe(2);
    expect(findGaps("iss")).toBe(findGaps("iss"));
  });
});

describe("/api/vesta request checks", () => {
  const post = (body: unknown, ip = "9.9.9.9") =>
    vestaPOST(new Request("http://x/api/vesta", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));

  it("rejects too-long messages and bad bodies with friendly errors", async () => {
    const long = await post({ messages: [{ role: "user", content: "a".repeat(2001) }] });
    expect(long.status).toBe(400);
    expect((await long.json()).error).toContain("too long");
    const bad = await post({ messages: [] });
    expect(bad.status).toBe(400);
    const notJson = await vestaPOST(new Request("http://x/api/vesta", { method: "POST", body: "{" }));
    expect(notJson.status).toBe(400);
  });

  it("streams an Offline answer as SSE", async () => {
    const res = await post({ messages: [{ role: "user", content: "help" }], engine: "offline" }, "8.8.8.8");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: engine");
    expect(text).toContain("event: done");
  });
});
