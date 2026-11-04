"use client";
import { useMemo, useState } from "react";
import type { DatasetProfile } from "@/lib/dataset";
import { INVESTIGATIONS, type Investigation } from "@/lib/types";
import { Chip, INV_BG, InvName } from "./shared";

/** How the data divides up. Bars are HTML so every number stays readable and selectable. */
export function SplitExplorer({ dimensions, totals }: { dimensions: DatasetProfile["dimensions"]; totals: DatasetProfile["totals"] }) {
  const [dimId, setDimId] = useState("investigation");
  const [allRows, setAllRows] = useState(false);
  const [hidden, setHidden] = useState<Investigation[]>([]);
  const dim = dimensions.find((d) => d.id === dimId) ?? dimensions[0];
  const shown = INVESTIGATIONS.filter((i) => !hidden.includes(i));

  const rows = useMemo(() => {
    const list = allRows ? dim.all : dim.counted;
    return list.map((r) => ({ ...r, total: shown.reduce((a, i) => a + r.counts[i], 0) })).filter((r) => r.total > 0);
  }, [dim, allRows, shown]);

  const whole = rows.reduce((a, r) => a + r.total, 0);
  const biggest = Math.max(1, ...rows.map((r) => r.total));
  const toggle = (id: Investigation) => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : h.length === 2 ? h : [...h, id]));

  return (
    <div className="hud-panel space-y-3 p-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Split the data by">
        {dimensions.map((d) => (
          <Chip key={d.id} active={d.id === dim.id} onClick={() => setDimId(d.id)}>
            {d.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 pt-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Show investigations">
          {INVESTIGATIONS.map((i) => (
            <Chip key={i} active={!hidden.includes(i)} onClick={() => toggle(i)}>
              <InvName id={i} />
            </Chip>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={allRows} onChange={(e) => setAllRows(e.target.checked)} className="accent-ember" />
          Include the {totals.duplicates} flagged duplicates
        </label>
      </div>

      <p className="text-sm">
        <b className="font-semibold">{dim.question}</b> <span className="text-muted">{whole} rows in {rows.length} {rows.length === 1 ? "group" : "groups"}.</span>
      </p>

      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid gap-1 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-center sm:gap-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 break-words">{r.label}</span>
              <span className="shrink-0 font-mono text-xs text-muted sm:hidden">
                {r.total} · {((100 * r.total) / whole).toFixed(1)}%
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-3.5 min-w-0 flex-1 gap-0.5" aria-hidden>
                {shown.map(
                  (i) =>
                    r.counts[i] > 0 && (
                      <span
                        key={i}
                        title={`${i}: ${r.counts[i]} rows`}
                        className={`${INV_BG[i]} rounded-sm transition-[width] duration-500 motion-reduce:transition-none`}
                        style={{ width: `${(100 * r.counts[i]) / biggest}%`, minWidth: 3 }}
                      />
                    ),
                )}
              </div>
              <span className="hidden w-[6.5rem] shrink-0 text-right font-mono text-xs text-muted sm:inline">
                {r.total} · {((100 * r.total) / whole).toFixed(1)}%
              </span>
            </div>
            <p className="font-mono text-[10px] text-muted sm:col-start-2">
              {shown
                .filter((i) => r.counts[i] > 0)
                .map((i) => `${i} ${r.counts[i]}`)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
