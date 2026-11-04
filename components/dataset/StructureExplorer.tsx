"use client";
import { useMemo, useState } from "react";
import type { DatasetProfile } from "@/lib/dataset";
import { INVESTIGATIONS } from "@/lib/types";
import { InvName } from "./shared";

/** Shade grows with the fill rate. The number is always printed, so colour is never the only signal. */
function FillCell({ pct }: { pct: number }) {
  return (
    <span
      className={`block rounded px-1 py-0.5 text-center font-mono text-[11px] ${pct === 0 ? "text-muted" : "text-text"}`}
      style={{ background: pct === 0 ? "transparent" : `rgba(255, 122, 47, ${0.08 + (pct / 100) * 0.42})`, outline: pct === 0 ? "1px dashed #1F2A44" : undefined }}
    >
      {pct}%
    </span>
  );
}

export function StructureExplorer({ fields, extras, totals }: Pick<DatasetProfile, "fields" | "extras" | "totals">) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = useMemo(() => (needle ? fields.filter((f) => `${f.name} ${f.meaning} ${f.type}`.toLowerCase().includes(needle)) : fields), [fields, needle]);
  const extraList = useMemo(() => (needle ? extras.filter((e) => `${e.key} ${e.meaning} ${e.investigation}`.toLowerCase().includes(needle)) : extras), [extras, needle]);

  return (
    <div className="hud-panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-w-[14rem] flex-1 items-center gap-2 text-xs text-muted">
          <span className="shrink-0">Find a field</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="pressure, burn, sensors…"
            className="w-full rounded-md border border-line bg-bg/60 px-2 py-1.5 text-sm text-text placeholder:text-muted"
          />
        </label>
        <p className="text-xs text-muted">
          {totals.fields} fields on every record, plus {totals.extraFields} raw values in <code className="font-mono">extra</code>
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] items-end gap-1 px-1 text-[10px] uppercase tracking-wide text-muted sm:grid-cols-[minmax(0,1fr)_repeat(3,4rem)]">
        <span>Field. Open a row for its meaning and origin</span>
        {INVESTIGATIONS.map((i) => (
          <InvName key={i} id={i} className="justify-center" />
        ))}
      </div>

      <div className="divide-y divide-line/60">
        {list.map((f) => (
          <details key={f.name} className="group">
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] items-center gap-1 rounded px-1 py-1.5 hover:bg-raised/60 sm:grid-cols-[minmax(0,1fr)_repeat(3,4rem)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="mr-1 inline-block text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden>
                  ›
                </span>
                <code className="break-all font-mono text-sm text-ember-soft">{f.name}</code>
                <span className="ml-2 font-mono text-[10px] text-muted">
                  {f.type}
                  {f.unit ? ` · ${f.unit}` : ""}
                </span>
              </span>
              {INVESTIGATIONS.map((i) => (
                <FillCell key={i} pct={f.fill[i]} />
              ))}
            </summary>
            <div className="space-y-2 px-1 pb-3 pt-1 text-sm">
              <p>{f.meaning}</p>
              <dl className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {INVESTIGATIONS.map((i) => (
                  <div key={i} className="min-w-0 rounded-lg border border-line bg-bg/60 p-2">
                    <dt className="mb-1 text-xs font-semibold">
                      <InvName id={i} />
                    </dt>
                    <dd className="text-xs text-muted">{f.origin[i]}</dd>
                    <dd className="mt-1 font-mono text-[11px] text-text [overflow-wrap:anywhere]">{f.examples[i] ?? <span className="text-muted">null: no value in this table</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        ))}
        {!list.length && <p className="py-3 text-sm text-muted">No main field matches “{q}”.</p>}
      </div>

      <details className="rounded-lg border border-line bg-bg/40 p-3" open={!!needle && extraList.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold">
          Inside <code className="font-mono text-ember-soft">extra</code>: {extraList.length} raw values kept per investigation
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">Investigation</th>
                <th className="pr-2 font-medium">Key</th>
                <th className="pr-2 font-medium">Meaning</th>
                <th className="pr-2 font-medium">Unit</th>
                <th className="pr-2 text-right font-medium">Filled</th>
                <th className="font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {extraList.map((e) => (
                <tr key={`${e.investigation}.${e.key}`} className="border-t border-line/60">
                  <td className="py-1 pr-2">
                    <InvName id={e.investigation} />
                  </td>
                  <td className="pr-2 font-mono text-ember-soft">{e.key}</td>
                  <td className="pr-2 text-muted">{e.meaning}</td>
                  <td className="pr-2 font-mono text-muted">{e.unit ?? "none"}</td>
                  <td className="whitespace-nowrap pr-2 text-right font-mono">
                    {e.filled}/{e.rows}
                  </td>
                  <td className="font-mono">{e.example ?? "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
