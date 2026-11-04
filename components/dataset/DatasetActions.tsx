"use client";
import { useState } from "react";
import { useVesta } from "@/components/vesta/useVesta";
import { useHearth } from "@/lib/store";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  };
  return (
    <button type="button" onClick={copy} className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:text-text" aria-live="polite">
      {state === "done" ? "Copied" : state === "failed" ? "Select the text to copy" : label}
    </button>
  );
}

export function OpenTestButton({ id }: { id: string }) {
  const openTest = useHearth((s) => s.openTest);
  return (
    <button type="button" onClick={() => openTest(id)} className="rounded border border-line bg-bg/50 px-1.5 py-0.5 font-mono text-[11px] text-muted transition hover:text-text">
      {id}
    </button>
  );
}

const QUESTIONS = ["Compare ACME and SPICE", "What data gaps exist for the lunar rover?", "Explain test ACME-CFIG-159", "What is a cool flame?"];

export function AskVesta() {
  const { send } = useVesta();
  const busy = useHearth((s) => s.busy);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {QUESTIONS.map((q) => (
        <li key={q}>
          <button type="button" disabled={busy} onClick={() => send(q)} className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs text-ember-soft transition hover:bg-ember/20 disabled:opacity-40">
            {q}
          </button>
        </li>
      ))}
    </ul>
  );
}
