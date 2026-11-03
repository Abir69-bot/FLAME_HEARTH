"use client";
import { useEffect, useMemo, useState } from "react";
import { EChart } from "@/components/charts/EChart";
import { INV_COLORS } from "@/components/charts/HabitatMap";
import { useHearth } from "@/lib/store";

type Inv = "ACME" | "CFI" | "SPICE";
interface Row {
  test_id: string;
  investigation: Inv;
  campaign: string | null;
  fuel: string | null;
  fuel_phase: string | null;
  o2_pct: number | null;
  pressure_psi: number | null;
  flow_cm_s: number | null;
  size_mm: number | null;
  key_metric_name: string | null;
  key_metric_value: number | null;
  source_row: number;
  flags: string[];
}
interface Resp {
  total: number;
  page: number;
  pages: number;
  rows: Row[];
  by_campaign: Record<string, number>;
  o2_values: number[];
}

const COLS: { key: keyof Row; label: string; num?: boolean }[] = [
  { key: "test_id", label: "Test" },
  { key: "investigation", label: "Inv." },
  { key: "fuel", label: "Fuel" },
  { key: "o2_pct", label: "O2 %", num: true },
  { key: "pressure_psi", label: "psi", num: true },
  { key: "flow_cm_s", label: "Flow cm/s", num: true },
  { key: "size_mm", label: "Size mm", num: true },
  { key: "key_metric_value", label: "Key metric", num: true },
];

const HIST_BIN = 5;

export function Explorer() {
  const [invs, setInvs] = useState<Inv[]>(["ACME", "CFI", "SPICE"]);
  const [phase, setPhase] = useState("");
  const [o2Min, setO2Min] = useState(0);
  const [o2Max, setO2Max] = useState(100);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [sort, setSort] = useState("test_id");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const openTest = useHearth((s) => s.openTest);
  const highlight = useHearth((s) => s.highlightIds);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [invs, phase, o2Min, o2Max, qDebounced, sort]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(false);
    const sp = new URLSearchParams({ page: String(page), page_size: "25", sort });
    if (invs.length) sp.set("investigation", invs.join(","));
    if (phase) sp.set("fuel_phase", phase);
    if (o2Min > 0) sp.set("o2_min", String(o2Min));
    if (o2Max < 100) sp.set("o2_max", String(o2Max));
    if (qDebounced) sp.set("q", qDebounced);
    fetch(`/api/tests?${sp}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setErr(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [invs, phase, o2Min, o2Max, qDebounced, sort, page]);

  const campaignOption = useMemo(() => {
    if (!data) return null;
    const entries = Object.entries(data.by_campaign).sort((a, b) => b[1] - a[1]);
    return {
      backgroundColor: "transparent",
      grid: { left: 8, right: 30, top: 10, bottom: 10, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } } },
      yAxis: { type: "category", data: entries.map((e) => e[0]).reverse(), axisLabel: { color: "#E8ECF6", fontSize: 10 } },
      series: [
        {
          type: "bar",
          data: entries
            .map(([k, v]) => ({ value: v, itemStyle: { color: INV_COLORS[k.split(" · ")[0] as Inv] ?? "#FF7A2F" } }))
            .reverse(),
          label: { show: true, position: "right", color: "#97A3BC", fontSize: 10 },
          barMaxWidth: 16,
        },
      ],
    };
  }, [data]);

  const histOption = useMemo(() => {
    if (!data) return null;
    const bins = Array.from({ length: 100 / HIST_BIN }, (_, i) => i * HIST_BIN);
    const counts = bins.map((b) => data.o2_values.filter((v) => v >= b && (v < b + HIST_BIN || (b + HIST_BIN === 100 && v === 100))).length);
    return {
      backgroundColor: "transparent",
      grid: { left: 8, right: 8, top: 10, bottom: 10, containLabel: true },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: bins.map((b) => `${b}–${b + HIST_BIN}`), name: "O2 %", axisLabel: { color: "#97A3BC", fontSize: 9 } },
      yAxis: { type: "value", axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } } },
      series: [{ type: "bar", data: counts, itemStyle: { color: "#FF7A2F" }, barCategoryGap: "10%" }],
    };
  }, [data]);

  const toggle = (i: Inv) => setInvs((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  const sortBy = (k: string) => setSort((s) => (s === k ? `-${k}` : k));

  return (
    <div className="space-y-4">
      <section aria-label="Filters" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-3">
        <fieldset className="flex gap-1.5">
          <legend className="mb-1 text-[11px] text-muted">Investigations</legend>
          {(["ACME", "CFI", "SPICE"] as Inv[]).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={invs.includes(i)}
              onClick={() => toggle(i)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${invs.includes(i) ? "border-transparent text-bg" : "border-line text-muted"}`}
              style={invs.includes(i) ? { background: INV_COLORS[i] } : undefined}
            >
              {i}
            </button>
          ))}
        </fieldset>
        <label className="text-[11px] text-muted">
          Fuel phase
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className="mt-1 block rounded-md border border-line bg-raised px-2 py-1 text-xs text-text">
            <option value="">All</option>
            <option value="gas">Gas</option>
            <option value="liquid">Liquid</option>
            <option value="solid">Solid</option>
          </select>
        </label>
        <fieldset className="min-w-[180px] text-[11px] text-muted">
          <legend>
            O2 range: <span className="font-mono text-text">{o2Min}–{o2Max}%</span>
          </legend>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={0} max={100} value={o2Min} onChange={(e) => setO2Min(Math.min(Number(e.target.value), o2Max))} aria-label="Minimum O2 %" className="w-24 accent-[#FF7A2F]" />
            <input type="range" min={0} max={100} value={o2Max} onChange={(e) => setO2Max(Math.max(Number(e.target.value), o2Min))} aria-label="Maximum O2 %" className="w-24 accent-[#FF7A2F]" />
          </div>
        </fieldset>
        <label className="min-w-[160px] flex-1 text-[11px] text-muted">
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="test id, fuel, outcome…" className="mt-1 block w-full rounded-md border border-line bg-bg px-2 py-1 text-sm text-text placeholder:text-muted/60 focus:border-ember focus:outline-none" />
        </label>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="min-w-0 overflow-hidden rounded-xl border border-line bg-panel p-3">
          <figcaption className="mb-1 text-xs font-semibold text-muted">Tests per campaign (filtered)</figcaption>
          {campaignOption ? <EChart option={campaignOption} height={180} ariaLabel="Bar chart of tests per campaign" /> : <div className="h-[180px] animate-pulse rounded bg-raised" />}
        </figure>
        <figure className="min-w-0 overflow-hidden rounded-xl border border-line bg-panel p-3">
          <figcaption className="mb-1 text-xs font-semibold text-muted">O2 distribution (filtered, {HIST_BIN}% bins)</figcaption>
          {histOption ? <EChart option={histOption} height={180} ariaLabel="Histogram of O2 percentage" /> : <div className="h-[180px] animate-pulse rounded bg-raised" />}
        </figure>
      </div>

      <section aria-label="Test table" className="rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted">
          <span role="status">{err ? "Could not load tests." : data ? `${data.total} tests${loading ? " · updating…" : ""}` : "Loading…"}</span>
          <span>Duplicates hidden · click a row for details</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-line bg-raised text-left text-[11px] uppercase tracking-wide text-muted">
                {COLS.map((c) => {
                  const active = sort.replace("-", "") === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort.startsWith("-") ? "descending" : "ascending") : "none"} className={`px-3 py-2 ${c.num ? "text-right" : ""}`}>
                      <button type="button" onClick={() => sortBy(c.key)} className="inline-flex items-center gap-1 hover:text-text">
                        {c.label}
                        <span aria-hidden className={active ? "text-ember" : "opacity-30"}>
                          {active && sort.startsWith("-") ? "▼" : "▲"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr
                  key={r.test_id}
                  tabIndex={0}
                  onClick={() => openTest(r.test_id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openTest(r.test_id))}
                  className={`cursor-pointer border-b border-line/60 transition hover:bg-raised focus:bg-raised focus:outline-none ${highlight.includes(r.test_id) ? "bg-ember/10" : ""}`}
                >
                  <td className="px-3 py-1.5 font-mono text-xs">{r.test_id}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: INV_COLORS[r.investigation] }} aria-hidden /> {r.investigation}
                  </td>
                  <td className="px-3 py-1.5 text-xs">{r.fuel ?? <span className="text-muted">missing</span>}</td>
                  {(["o2_pct", "pressure_psi", "flow_cm_s", "size_mm"] as const).map((k) => (
                    <td key={k} className={`px-3 py-1.5 text-right font-mono text-xs ${r.flags.some((f) => f.startsWith("range_check_failed")) && k === "flow_cm_s" ? "text-warn" : ""}`}>
                      {r[k] ?? <span className="text-muted">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-mono text-xs" title={r.key_metric_name ?? undefined}>
                    {r.key_metric_value != null ? `${r.key_metric_value}${r.key_metric_name === "burn_time_s" ? " s" : r.key_metric_name === "hc_fuel_rate_mg_s" ? " mg/s" : ""}` : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
              {data && data.rows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-3 py-6 text-center text-sm text-muted">
                    No tests match these filters.{phase === "solid" ? " The NASA data in HEARTH has no solid-fuel tests: this is a known data gap." : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-end gap-2 px-3 py-2 text-xs">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">
              Previous
            </button>
            <span className="font-mono text-muted">
              {page} / {data.pages}
            </span>
            <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">
              Next
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
