"use client";
import { useEffect, useRef } from "react";
import { EChart } from "@/components/charts/EChart";
import { IconPin, IconSend } from "@/components/ui/Icons";
import { getMission } from "@/lib/missions";
import { useHearth, type Level, type VestaMessage } from "@/lib/store";
import { ConfidenceTag, SourceChips } from "./Bits";
import { ModelMenu } from "./ModelMenu";
import { Orb } from "./Orb";
import { useVesta } from "./useVesta";

const LEVELS: Level[] = ["student", "researcher", "engineer"];

function quickPrompts(missionName: string): string[] {
  return [
    `Is the ${missionName} atmosphere inside the tested data?`,
    "What is pO2 at 34% O2 and 8.2 psi?",
    "Which investigation is most relevant for this mission?",
    "What data is missing for lunar habitats?",
    "Compare ACME and SPICE",
  ];
}

/** Minimal, safe rendering of **bold** and line breaks (no HTML injection). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() ? "" : "h-2"}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} className="font-semibold text-text">
                {seg.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{seg}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function Message({ m }: { m: VestaMessage }) {
  const pin = useHearth((s) => s.pin);
  const openTest = useHearth((s) => s.openTest);
  if (m.role === "user") {
    return (
      <li className="ml-8 animate-fadeUp self-end rounded-lg rounded-br-sm bg-raised px-3 py-2 text-sm">
        <span className="sr-only">You: </span>
        {m.text}
      </li>
    );
  }
  const alertCls = m.alert === "bad" ? "border-bad/60" : m.alert === "warn" ? "border-warn/60" : m.alert === "ok" ? "border-ok/50" : "border-line";
  return (
    <li className={`mr-2 animate-fadeUp rounded-lg rounded-bl-sm border bg-panel px-3 py-2 text-sm ${alertCls}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-head text-xs font-semibold tracking-wider text-ember-soft">VESTA</span>
        {m.badge && <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">{m.badge}</span>}
        {m.cached && <span className="font-mono text-[10px] text-muted">cached</span>}
      </div>
      {m.note && <p className="mb-1 text-[11px] text-warn">{m.note}</p>}
      {m.steps.length > 0 && (
        <ul className="mb-1.5 space-y-0.5" aria-label="Tool steps">
          {m.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${s.status === "running" ? "animate-pulse bg-ember" : s.status === "done" ? "bg-ok" : "bg-bad"}`} aria-hidden />
              {s.tool === "engine" ? s.summary : `${s.tool}: ${s.summary}`}
            </li>
          ))}
        </ul>
      )}
      {m.charts.map((c) => (
        <figure key={c.id} className="my-2 rounded-md border border-line bg-bg p-2">
          <EChart option={c.option} height={220} ariaLabel={`Chart: ${c.title}`} />
          <figcaption className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted">
            <span>{c.source_note ?? "Data from VESTA tool results"}</span>
            <button type="button" onClick={() => pin(c)} className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 hover:border-ember hover:text-text">
              <IconPin className="h-3 w-3" /> Pin to dashboard
            </button>
          </figcaption>
        </figure>
      ))}
      <div className="space-y-1 leading-relaxed text-text/90">
        {m.text ? <RichText text={m.text} /> : m.pending ? <p className="text-muted">Thinking…</p> : null}
        {m.error && <p className="text-bad">{m.error}</p>}
      </div>
      {(m.sources.length > 0 || m.confidence) && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          <SourceChips sources={m.sources} onOpen={openTest} />
          {m.confidence && <ConfidenceTag value={m.confidence} note={m.confidenceNote} />}
        </div>
      )}
    </li>
  );
}

export function VestaPanel() {
  const messages = useHearth((s) => s.messages);
  const busy = useHearth((s) => s.busy);
  const level = useHearth((s) => s.level);
  const setLevel = useHearth((s) => s.setLevel);
  const draft = useHearth((s) => s.draft);
  const setDraft = useHearth((s) => s.setDraft);
  const missionId = useHearth((s) => s.missionId);
  const mission = getMission(missionId);
  const { send } = useVesta();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || busy) return;
    const t = draft;
    setDraft("");
    send(t);
  };

  return (
    <aside
      aria-label="VESTA assistant"
      className="flex flex-col border-t border-line bg-panel/60 vesta:sticky vesta:top-[49px] vesta:h-[calc(100vh-49px)] vesta:w-[400px] vesta:shrink-0 vesta:border-l vesta:border-t-0"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Orb thinking={busy} />
        <div className="mr-auto">
          <h2 className="font-head text-base font-bold tracking-wider">VESTA</h2>
          <p className="flex items-center gap-1 text-[11px] text-muted" role="status" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-ember" : "bg-ok"}`} aria-hidden />
            {busy ? "Thinking" : "Online"}
          </p>
        </div>
        <ModelMenu />
        <div role="radiogroup" aria-label="Explanation level" className="flex w-full overflow-hidden rounded-md border border-line text-[11px]">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={`flex-1 px-2 py-1 capitalize transition ${level === l ? "bg-ember/20 text-ember-soft" : "text-muted hover:text-text"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <ul ref={listRef} className="flex max-h-[60vh] min-h-[240px] flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 vesta:max-h-none" aria-live="polite">
        {messages.length === 0 && (
          <li className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
            I&apos;m VESTA. Every number I give comes from NASA test data or a tested formula, with its source and a confidence tag. Ask me about a habitat atmosphere, a test, or a data gap.
          </li>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
      </ul>

      <div className="border-t border-line px-3 py-2">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {quickPrompts(mission?.short ?? "mission").map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => send(q)}
              className="whitespace-nowrap rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] text-muted transition hover:border-ember hover:text-text disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="vesta-input" className="sr-only">
            Ask VESTA
          </label>
          <textarea
            id="vesta-input"
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="Ask about fire risk, a test or a data gap…"
            className="min-h-[44px] flex-1 resize-none rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/70 focus:border-ember focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-md bg-ember text-bg transition hover:bg-ember-soft disabled:opacity-40"
            aria-label="Send to VESTA"
          >
            <IconSend />
          </button>
        </form>
      </div>
    </aside>
  );
}
