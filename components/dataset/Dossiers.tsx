"use client";
import { useState } from "react";
import type { InvestigationProfile } from "@/lib/dataset";
import type { NumStats } from "@/lib/util";
import { fileName, formatBytes, INV_BG, InvName } from "./shared";

const range = (s: NumStats, unit: string) => (s.n === 0 ? "not recorded" : s.min === s.max ? `${s.min} ${unit}` : `${s.min} to ${s.max} ${unit}`);

const KIND: Record<string, string> = { table: "Experimental table", report: "Final report", engineering: "Engineering document" };

function Tally({ items, total, color }: { items: { label: string; n: number }[]; total: number; color: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x.label} className="text-xs">
          <div className="flex justify-between gap-2">
            <span className="min-w-0 break-words">{x.label}</span>
            <span className="shrink-0 font-mono text-muted">{x.n}</span>
          </div>
          <div className="mt-0.5 h-1 rounded-full bg-line/50" aria-hidden>
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(100 * x.n) / total}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h4>;

export function Dossiers({ investigations }: { investigations: InvestigationProfile[] }) {
  const [id, setId] = useState(investigations[0].id);
  const inv = investigations.find((x) => x.id === id) ?? investigations[0];
  return (
    <div className="hud-panel p-4">
      <div role="group" aria-label="Choose an investigation" className="grid grid-cols-3 gap-1.5">
        {investigations.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === id}
            onClick={() => setId(x.id)}
            className={`rounded-lg border p-2 text-left transition ${x.id === id ? "border-ember/60 bg-ember/10" : "border-line bg-bg/50 hover:border-[#2c3b5e]"}`}
          >
            <InvName id={x.id} className="font-head text-sm font-semibold" />
            <span className="mt-0.5 block font-mono text-[11px] text-muted">
              {x.counted} tests · {x.share}%
            </span>
          </button>
        ))}
      </div>

      <div key={inv.id} className="mt-4 animate-fadeUp space-y-4 motion-reduce:animate-none">
        <div>
          <h3 className="font-head text-lg font-semibold">{inv.name}</h3>
          <p className="text-sm text-muted">{inv.tagline}</p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-bg/50 p-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted">One row is</dt>
            <dd>{inv.rowIs}</dd>
          </div>
          <div className="rounded-lg border border-line bg-bg/50 p-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted">Where it ran</dt>
            <dd>{inv.where}</dd>
          </div>
          <div className="rounded-lg border border-line bg-bg/50 p-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted">When</dt>
            {inv.collected.map((c) => (
              <dd key={c.text}>
                {c.text} <span className="font-mono text-[11px] text-muted">({c.cite})</span>
              </dd>
            ))}
            {inv.span && <dd className="mt-0.5 text-xs text-muted">{inv.span}</dd>}
          </div>
          <div className="rounded-lg border border-line bg-bg/50 p-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted">Rows</dt>
            <dd>
              <span className="font-mono">{inv.rows}</span> in the table, <span className="font-mono">{inv.counted}</span> counted, <span className="font-mono">{inv.duplicates}</span> flagged as duplicates
            </dd>
            {inv.blankRows > 0 && <dd className="mt-0.5 text-xs text-muted">The CSV also ends with {inv.blankRows} blank rows, which are ignored</dd>}
          </div>
        </dl>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <H>Tested conditions (counted rows)</H>
            <table className="w-full text-sm">
              <tbody className="[&_td]:py-1 [&_tr]:border-t [&_tr]:border-line/60">
                <tr>
                  <td className="text-muted">Oxygen</td>
                  <td className="text-right font-mono">{range(inv.o2, "%")}</td>
                </tr>
                <tr>
                  <td className="text-muted">Pressure</td>
                  <td className="text-right font-mono">{range(inv.pressure, "psi")}</td>
                </tr>
                <tr>
                  <td className="text-muted">Air speed</td>
                  <td className="text-right font-mono">{range(inv.flow, "cm/s")}</td>
                </tr>
                <tr>
                  <td className="text-muted">Burner or nozzle</td>
                  <td className="text-right font-mono">{range(inv.size, "mm")}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3">
              <H>Flame or droplet shape</H>
              <Tally items={inv.geometries} total={inv.counted} color={INV_BG[inv.id]} />
            </div>
          </div>
          <div>
            <H>Fuels ({inv.fuels.length})</H>
            <Tally items={inv.fuels} total={inv.counted} color={INV_BG[inv.id]} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <H>Measured</H>
            <ul className="flex flex-wrap gap-1.5">
              {inv.measurements.map((m) => (
                <li key={m} className="rounded border border-line bg-bg/50 px-1.5 py-0.5 text-xs">
                  {m}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <H>Sensors</H>
            <ul className="flex flex-wrap gap-1.5">
              {inv.sensors.map((m) => (
                <li key={m} className="rounded border border-line bg-bg/50 px-1.5 py-0.5 text-xs">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <H>Raw table columns ({inv.columns.length})</H>
          <ul className="flex flex-wrap gap-1">
            {inv.columns.map((c) => (
              <li key={c} className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px]">
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <H>Source files</H>
            <ul className="space-y-1.5 text-xs">
              {inv.files.map((f) => (
                <li key={f.file} className="flex flex-wrap justify-between gap-x-2">
                  <span>
                    <span className="break-all font-mono">{fileName(f.file)}</span> <span className="text-muted">{KIND[f.kind]}</span>
                  </span>
                  <span className="font-mono text-muted">
                    {f.pages ? `${f.pages} ${f.pages === 1 ? "page" : "pages"} · ` : ""}
                    {f.rows ? `${f.rows} rows · ` : ""}
                    {formatBytes(f.bytes)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Extracted for VESTA: <span className="font-mono">{inv.chunks}</span> text passages and <span className="font-mono">{inv.tables}</span> tables from {inv.pages} PDF pages.
            </p>
          </div>
          <div className="rounded-lg border border-warn/30 bg-warn/5 p-3">
            <H>Not in this table</H>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {inv.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
