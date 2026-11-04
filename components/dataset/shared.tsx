import type { ReactNode } from "react";
import type { Investigation, TestRecord } from "@/lib/types";

export const INV_BG: Record<Investigation, string> = { ACME: "bg-acme", CFI: "bg-cfi", SPICE: "bg-spice" };

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}

export const fileName = (path: string) => path.split("/").pop() ?? path;

/** Colour marks the investigation; the name beside it means identity never relies on colour alone. */
export function InvName({ id, className = "" }: { id: Investigation; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${INV_BG[id]}`} aria-hidden />
      {id}
    </span>
  );
}

export function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-44 space-y-3 vesta:scroll-mt-28">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember-soft">{eyebrow}</p>
        <h2 id={`${id}-title`} className="font-head text-xl font-semibold tracking-wide">
          {title}
        </h2>
        {intro && <div className="mt-1 max-w-3xl text-sm text-muted">{intro}</div>}
      </header>
      {children}
    </section>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs transition ${active ? "border-ember/60 bg-ember/15 text-ember-soft" : "border-line bg-bg/50 text-muted hover:border-[#2c3b5e] hover:text-text"}`}
    >
      {children}
    </button>
  );
}

let records: Promise<TestRecord[]> | null = null;

/** One shared copy of the clean table, downloaded once and only when a tool on the page needs it. */
export function loadRecords(): Promise<TestRecord[]> {
  if (!records) {
    records = fetch("/api/dataset/tests.json").then((r) => {
      if (!r.ok) throw new Error("load failed");
      return r.json() as Promise<TestRecord[]>;
    });
    records.catch(() => {
      records = null; // let a later visit to the section try again
    });
  }
  return records;
}

export function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
