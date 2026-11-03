"use client";
import { useEffect, useRef, useState } from "react";
import { useHearth } from "@/lib/store";
import type { TestRecord } from "@/lib/types";
import { IconClose } from "./Icons";

interface Detail {
  test: TestRecord;
  derived: { po2: { value: number; formula: string } | null; ratio_to_iss: { value: number } | null; flow_regime: { regime: string; rule: string } };
  passages: { source_file: string; page: number; snippet: string }[];
}

const FIELDS: [keyof TestRecord, string, string?][] = [
  ["investigation", "Investigation"],
  ["campaign", "Campaign"],
  ["hardware", "Hardware"],
  ["fuel", "Fuel"],
  ["fuel_phase", "Fuel phase"],
  ["geometry", "Geometry"],
  ["size_mm", "Size", "mm"],
  ["o2_pct", "O2", "%"],
  ["pressure_psi", "Pressure", "psi"],
  ["diluent", "Diluent"],
  ["flow_cm_s", "Airflow", "cm/s"],
  ["gravity", "Gravity"],
  ["outcome", "Outcome"],
];

const METRIC_LABEL: Record<string, string> = { burn_time_s: "Burn time (s)", hc_fuel_rate_mg_s: "HC fuel rate (mg/s)" };

/** Shared details drawer for one test (opened from the map, the table, sources or VESTA). */
export function TestDrawer() {
  const id = useHearth((s) => s.openTestId);
  const openTest = useHearth((s) => s.openTest);
  const setDraft = useHearth((s) => s.setDraft);
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (id) setTimeout(() => closeRef.current?.focus(), 30);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setData(null);
    setErr(null);
    fetch(`/api/tests/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr("Could not load this test."));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openTest(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTest]);

  if (!id) return null;
  const t = data?.test;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Test ${id}`}>
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close details" onClick={() => openTest(null)} />
      <div className="relative h-full w-full max-w-md animate-slideIn overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted">Test details</p>
            <h2 className="font-head text-xl font-bold">{id}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={() => openTest(null)} className="rounded p-1 text-muted hover:bg-raised hover:text-text" aria-label="Close">
            <IconClose />
          </button>
        </div>
        {err && <p className="text-bad">{err}</p>}
        {!t && !err && <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-raised" />)}</div>}
        {t && data && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {FIELDS.map(([k, label, unit]) => {
                const v = t[k];
                return (
                  <div key={k} className="contents">
                    <dt className="text-muted">{label}</dt>
                    <dd className={typeof v === "number" ? "font-mono" : ""}>{v == null || v === "" ? <span className="text-muted">missing</span> : `${v}${unit ? ` ${unit}` : ""}`}</dd>
                  </div>
                );
              })}
              <dt className="text-muted">pO2</dt>
              <dd className="font-mono">{data.derived.po2 ? `${data.derived.po2.value} psi (${data.derived.ratio_to_iss?.value}× ISS)` : "missing"}</dd>
              <dt className="text-muted">Flow regime</dt>
              <dd>{data.derived.flow_regime.regime}</dd>
              {t.key_metric_name && (
                <>
                  <dt className="text-muted">{METRIC_LABEL[t.key_metric_name] ?? t.key_metric_name}</dt>
                  <dd className="font-mono">{t.key_metric_value ?? "missing"}</dd>
                </>
              )}
            </dl>
            <p className="mt-3 rounded bg-bg px-2 py-1 font-mono text-[11px] text-muted">
              Source: {t.source_file} · row {t.source_row}
            </p>
            {t.flags.length > 0 && <p className="mt-2 text-xs text-warn">Flags: {t.flags.join(", ")}</p>}
            <section className="mt-4">
              <h3 className="mb-1 text-sm font-semibold">Sensors & measurements</h3>
              <p className="text-xs text-muted">{[...t.sensors, ...t.measurements].join(" · ") || "missing"}</p>
            </section>
            {Object.keys(t.extra).length > 0 && (
              <section className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">All recorded values (raw)</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {Object.entries(t.extra).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k.replace(/_/g, " ")}</dt>
                      <dd className="font-mono">{v == null ? <span className="text-muted">missing</span> : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {t.notes && (
              <section className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">Notes</h3>
                <p className="text-xs text-muted">{t.notes}</p>
              </section>
            )}
            {data.passages.length > 0 && (
              <section className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">Related PDF passages</h3>
                <ul className="space-y-2">
                  {data.passages.map((p, i) => (
                    <li key={i} className="rounded border border-line bg-bg p-2 text-xs text-muted">
                      {p.snippet}
                      <span className="mt-1 block font-mono text-[10px]">{p.source_file.split("/").pop()} · p{p.page}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(`Explain test ${t.test_id} and what it means for habitat fire safety.`);
                openTest(null);
                setTimeout(() => document.getElementById("vesta-input")?.focus(), 50);
              }}
              className="mt-4 w-full rounded-md bg-ember px-3 py-2 text-sm font-semibold text-bg hover:bg-ember-soft"
            >
              Ask VESTA about this test
            </button>
          </>
        )}
      </div>
    </div>
  );
}
