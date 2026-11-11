"use client";
import { pdfHref } from "@/lib/pdf-links";
import { sourceLabel } from "@/lib/source-label";
import type { Confidence, Source } from "@/lib/types";

const CONF: Record<Confidence, { label: string; cls: string; tip: string }> = {
  supported: { label: "supported", cls: "border-ok/50 bg-ok/10 text-ok", tip: "At least 5 NASA tests near this condition, or quoted from a NASA document" },
  extrapolated: { label: "extrapolated", cls: "border-warn/50 bg-warn/10 text-warn", tip: "Only sparse or indirect evidence" },
  no_data: { label: "no data", cls: "border-bad/50 bg-bad/10 text-bad", tip: "Nothing in the NASA data covers this" },
};

export function ConfidenceTag({ value, note }: { value: Confidence; note?: string }) {
  const c = CONF[value];
  return (
    <span title={note ?? c.tip} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${c.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      confidence: {c.label}
    </span>
  );
}

export { sourceLabel };

export function SourceChips({ sources, onOpen }: { sources: Source[]; onOpen?: (testId: string) => void }) {
  if (!sources.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Sources">
      {sources.map((s, i) => {
        const label = sourceLabel(s);
        const cls = "rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[10px] text-muted";
        return (
          <li key={`${label}-${i}`}>
            {s.test_id && onOpen ? (
              <button type="button" onClick={() => onOpen(s.test_id!)} className={`${cls} hover:border-ember hover:text-text`} title={`Open ${s.test_id}`}>
                {label}
              </button>
            ) : s.page && pdfHref(s.file, s.page) ? (
              <a href={pdfHref(s.file, s.page)!} target="_blank" rel="noopener noreferrer" className={`${cls} inline-block hover:border-ember hover:text-text`} title={`Open ${label} in the NASA PDF (new tab)`}>
                {label} ↗
              </a>
            ) : (
              <span className={cls} title={s.note}>
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return <span className={`rounded border border-warn/60 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-warn ${className}`}>DEMO</span>;
}
