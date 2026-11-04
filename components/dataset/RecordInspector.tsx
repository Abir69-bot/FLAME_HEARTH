"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RawRows } from "@/lib/dataset-export";
import { useHearth } from "@/lib/store";
import type { TestRecord } from "@/lib/types";
import { Chip, fileName, loadRecords } from "./shared";

const PRESETS = [
  { id: "ACME-CFIG-159", label: "A cool flame" },
  { id: "ACME-CFIG-200", label: "Shifted columns" },
  { id: "CFI-FLEX-1206", label: "A droplet burn" },
  { id: "SPICE-002", label: "A flagged duplicate" },
];

function JsonValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted">null</span>;
  if (typeof value === "number") return <span className="text-acme">{value}</span>;
  if (typeof value === "string") return <span className="text-spice">&quot;{value}&quot;</span>;
  return <span>{JSON.stringify(value)}</span>;
}

/** One record, raw row beside clean result, so anyone can check the cleaning for themselves. */
export function RecordInspector() {
  const box = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<TestRecord[] | null>(null);
  const [raw, setRaw] = useState<RawRows | null>(null);
  const [failed, setFailed] = useState(false);
  const [id, setId] = useState(PRESETS[0].id);
  const [draft, setDraft] = useState(PRESETS[0].id);
  const openTest = useHearth((s) => s.openTest);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const load = () => {
      Promise.all([loadRecords(), fetch("/api/dataset/raw-rows.json").then((r) => (r.ok ? (r.json() as Promise<RawRows>) : { available: false, files: {} }))])
        .then(([tests, rows]) => {
          setRecords(tests);
          setRaw(rows);
        })
        .catch(() => setFailed(true));
    };
    if (typeof IntersectionObserver === "undefined") return load();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const byId = useMemo(() => new Map((records ?? []).map((t) => [t.test_id.toUpperCase(), t])), [records]);
  const rec = byId.get(id.trim().toUpperCase());
  const notFound = !!records && !rec;
  const file = rec && raw?.files[rec.source_file];
  const rawRow = file && rec ? file.rows[rec.source_row - 2] : undefined;

  const choose = (next: string) => {
    setId(next);
    setDraft(next);
  };
  const random = () => {
    if (records?.length) choose(records[Math.floor(Math.random() * records.length)].test_id);
  };

  return (
    <div ref={box} className="hud-panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <Chip key={p.id} active={id === p.id} onClick={() => choose(p.id)}>
            {p.label}
          </Chip>
        ))}
        <button type="button" disabled={!records} onClick={random} className="rounded-md border border-ember/50 bg-ember/10 px-2.5 py-1 text-xs text-ember-soft transition hover:bg-ember/20 disabled:opacity-40">
          Random test
        </button>
        <form
          className="flex min-w-[12rem] flex-1 items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setId(draft);
          }}
        >
          <label htmlFor="dataset-record-id" className="sr-only">
            Test ID
          </label>
          <input id="dataset-record-id" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-md border border-line bg-bg/60 px-2 py-1 font-mono text-xs" />
          <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:text-text">
            Show
          </button>
        </form>
      </div>

      {failed && <p className="text-sm text-bad">Could not load the records. Please reload the page and try again.</p>}
      {!records && !failed && <div className="h-64 animate-pulse rounded-lg bg-raised motion-reduce:animate-none" role="status" aria-label="Loading records" />}
      {notFound && <p className="text-sm text-warn">No test has the ID “{id}”. IDs look like ACME-CFIG-159, CFI-FLEX-1206 or SPICE-002.</p>}

      {rec && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <b className="font-mono font-semibold">{rec.test_id}</b>
            {rec.flags.map((f) => (
              <span key={f} className="rounded border border-warn/50 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn">
                {f}
              </span>
            ))}
            <button type="button" onClick={() => openTest(rec.test_id)} className="ml-auto rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:text-text">
              Open test details
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-line bg-bg/60 p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Raw NASA row</h3>
              <p className="mb-2 break-all font-mono text-[11px] text-muted">
                {fileName(rec.source_file)}, row {rec.source_row}
              </p>
              {rawRow && file ? (
                <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  {file.columns.map((c, i) => (
                    <div key={`${c}-${i}`} className="contents">
                      <dt className="text-muted">{c || `column ${i + 1}`}</dt>
                      <dd className="break-words font-mono">{rawRow[i]?.trim() ? rawRow[i] : <span className="text-muted">empty</span>}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">{raw ? "The raw row is not available here." : "Loading…"}</p>
              )}
              {rec.flags.includes("layout_shifted") && <p className="mt-2 rounded border border-warn/30 bg-warn/5 p-2 text-xs">In this inverse-flame row, the values sit one column left of their headers. The clean record on the right corrects that.</p>}
            </div>
            <div className="min-w-0 rounded-lg border border-line bg-bg/60 p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Clean record in tests.json</h3>
              <p className="mb-2 font-mono text-[11px] text-muted">after scripts/ingest/ingest.py</p>
              <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                {"{\n"}
                {Object.entries(rec).map(([k, v], i, all) => (
                  <span key={k}>
                    {"  "}
                    <span className="text-ember-soft">&quot;{k}&quot;</span>: <JsonValue value={v} />
                    {i < all.length - 1 ? ",\n" : "\n"}
                  </span>
                ))}
                {"}"}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
