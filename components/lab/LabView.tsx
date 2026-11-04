"use client";
import { useEffect, useMemo, useState } from "react";
import { EChart, useReducedMotion } from "@/components/charts/EChart";
import { INV_COLORS } from "@/components/charts/HabitatMap";
import { useVesta } from "@/components/vesta/useVesta";
import { applyMapping, detectMapping, parseCsv, type Mapping } from "@/lib/csv";
import { getMission } from "@/lib/missions";
import type { PressureUnit } from "@/lib/physics";
import { useHearth } from "@/lib/store";

interface Calc {
  po2: { value: number; formula: string };
  ratio_to_iss: { value: number };
  o2_vs_earth: { value: number; delta_pp: number };
  flow_regime: { regime: string; rule: string };
  envelope: { status: "supported" | "sparse" | "no_data"; count: number; rule: string };
  hazard_index: { value: number; label: string; parts: { name: string; points: number; max: number; why: string }[]; note: string };
  nearest: { distance: number; test_id: string; investigation: "ACME" | "CFI" | "SPICE"; fuel: string | null; o2_pct: number; pressure_psi: number; flow_cm_s: number | null; source_row: number }[];
}
interface MapPoint {
  investigation: "ACME" | "CFI" | "SPICE";
  o2_pct: number;
  pressure_psi: number;
}

const ENV_CLS = { supported: "text-ok", sparse: "text-warn", no_data: "text-bad" } as const;

function Field({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const id = `lab-${label.replace(/\W/g, "")}`;
  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between text-xs text-muted">
        {label}
        <span className="flex items-center gap-1">
          <input
            type="number"
            aria-label={`${label} value`}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-20 rounded border border-line bg-bg px-1.5 py-0.5 text-right font-mono text-sm text-text"
          />
          <span className="w-10 text-left">{unit}</span>
        </span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#FF7A2F]" />
    </div>
  );
}

export function LabView() {
  const missionId = useHearth((s) => s.missionId);
  const m = getMission(missionId);
  const [o2, setO2] = useState(m?.o2_pct ?? 21);
  const [p, setP] = useState(m?.pressure_psi ?? 14.7);
  const [flow, setFlow] = useState(10);
  const [material, setMaterial] = useState<"" | "gas" | "liquid" | "solid">("");
  const [calc, setCalc] = useState<Calc | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [err, setErr] = useState(false);
  const reduce = useReducedMotion();
  const openTest = useHearth((s) => s.openTest);
  const labRows = useHearth((s) => s.labRows);
  const setLabRows = useHearth((s) => s.setLabRows);
  const { send } = useVesta();

  useEffect(() => {
    if (m) {
      setO2(m.o2_pct);
      setP(m.pressure_psi);
    }
  }, [m]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o2_pct: o2, pressure_psi: p, flow_cm_s: flow, fuel_phase: material || undefined }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => {
          setCalc(j);
          setErr(false);
        })
        .catch(() => setErr(true));
    }, 200);
    return () => clearTimeout(t);
  }, [o2, p, flow, material]);

  useEffect(() => {
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setPoints(j.points))
      .catch(() => {});
  }, []);

  const chart = useMemo(() => {
    const uniq = (inv: string) => {
      const seen = new Set<string>();
      return points.filter((x) => x.investigation === inv).map((x) => [x.pressure_psi, x.o2_pct]).filter((v) => (seen.has(v.join()) ? false : (seen.add(v.join()), true)));
    };
    const good = labRows.filter((r) => !r.problems.length && r.o2_pct != null && r.pressure_psi != null);
    return {
      backgroundColor: "transparent",
      legend: { type: "scroll", pageIconColor: "#FFB98A", pageIconInactiveColor: "#1F2A44", pageTextStyle: { color: "#97A3BC" }, top: 0, right: 8, textStyle: { color: "#97A3BC" } },
      tooltip: { trigger: "item", backgroundColor: "#131B2E", borderColor: "#1F2A44", textStyle: { color: "#E8ECF6" } },
      grid: { left: 8, right: 16, top: 52, bottom: 30, containLabel: true },
      xAxis: { type: "value", name: "Pressure (psi)", nameLocation: "middle", nameGap: 24, min: 0, max: 80, axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } }, nameTextStyle: { color: "#97A3BC" } },
      yAxis: { type: "value", name: "O2 (%)", min: 0, max: 100, axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } }, nameTextStyle: { color: "#97A3BC" } },
      dataZoom: [{ type: "inside", xAxisIndex: 0, filterMode: "none" }, { type: "inside", yAxisIndex: 0, filterMode: "none" }],
      series: [
        ...(["ACME", "CFI", "SPICE"] as const).map((inv) => ({ name: inv, type: "scatter", symbolSize: 6, itemStyle: { color: INV_COLORS[inv], opacity: 0.35 }, data: uniq(inv) })),
        { name: "Nearest 5", type: "scatter", symbolSize: 11, itemStyle: { color: "#FFFFFF", borderColor: "#FF7A2F", borderWidth: 2 }, data: (calc?.nearest ?? []).map((n) => ({ value: [n.pressure_psi, n.o2_pct], name: n.test_id })) },
        ...(good.length ? [{ name: "My data (not NASA)", type: "scatter", symbol: "triangle", symbolSize: 10, itemStyle: { color: "#FFC857" }, data: good.map((r) => ({ value: [r.pressure_psi, r.o2_pct], name: r.label })) }] : []),
        { name: "Your condition", type: reduce ? "scatter" : "effectScatter", rippleEffect: { scale: 3, brushType: "stroke" }, symbolSize: 15, symbol: "diamond", itemStyle: { color: "#FF7A2F" }, data: [[p, o2]], z: 5 },
      ],
    };
  }, [points, calc, labRows, p, o2, reduce]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section aria-label="Conditions" className="space-y-4 hud-panel p-4">
          <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Your conditions</h2>
          <Field label="Oxygen" unit="%" value={o2} min={0} max={100} step={0.5} onChange={setO2} />
          <Field label="Pressure" unit="psi" value={p} min={0.5} max={80} step={0.1} onChange={setP} />
          <Field label="Airflow" unit="cm/s" value={flow} min={0} max={100} step={1} onChange={setFlow} />
          <label className="block text-xs text-muted">
            Material (filters the NASA tests used)
            <select value={material} onChange={(e) => setMaterial(e.target.value as typeof material)} className="mt-1 block w-full rounded-md border border-line bg-raised px-2 py-1 text-sm text-text">
              <option value="">Any tested fuel</option>
              <option value="gas">Gas (ACME, SPICE)</option>
              <option value="liquid">Liquid droplets (CFI)</option>
              <option value="solid">Solid materials (no NASA data here)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => send(`Assess ${o2}% O2 at ${p} psi with ${flow} cm/s airflow${material ? ` for ${material} fuels` : ""}. Is it inside the tested data?`)}
            className="w-full rounded-md bg-ember px-3 py-2 text-sm font-semibold text-bg hover:bg-ember-soft"
          >
            Ask VESTA to assess
          </button>
        </section>

        <section aria-label="Results" className="space-y-3 hud-panel p-4" aria-live="polite">
          {err && <p className="text-sm text-bad">Could not compute these conditions.</p>}
          {!calc ? (
            <div className="h-64 animate-pulse rounded bg-raised" />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["pO2", `${calc.po2.value}`, "psi"],
                  ["vs ISS pO2", `${calc.ratio_to_iss.value}`, "×"],
                  ["O2 vs Earth", `${calc.o2_vs_earth.value}`, "×"],
                  ["Flow regime", calc.flow_regime.regime, ""],
                ].map(([l, v, u]) => (
                  <div key={l} className="rounded-lg border border-line bg-raised p-2">
                    <dt className="text-[11px] text-muted">{l}</dt>
                    <dd className="font-mono text-lg">
                      {v} <span className="text-xs text-muted">{u}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="font-mono text-[10px] text-muted">{calc.po2.formula} · flow {calc.flow_regime.rule} · lib/physics.ts</p>
              <p className="text-sm">
                Envelope: <b className={ENV_CLS[calc.envelope.status]}>{calc.envelope.status.replace("_", " ")}</b> — {calc.envelope.count} NASA tests{material ? ` (${material} only)` : ""} within ±5 pp O2 and ±2.5 psi.
              </p>
              <div>
                <p className="text-sm">
                  Hazard index <span className="rounded border border-warn/50 px-1 text-[10px] uppercase text-warn">heuristic</span>: <b className="font-mono">{calc.hazard_index.value}</b> / 100
                </p>
                <ul className="mt-1 space-y-1">
                  {calc.hazard_index.parts.map((part) => (
                    <li key={part.name} className="text-xs">
                      <div className="flex justify-between">
                        <span>{part.name}</span>
                        <span className="font-mono">
                          {part.points}/{part.max}
                        </span>
                      </div>
                      <div className="h-1.5 rounded bg-raised">
                        <div className="h-full rounded bg-ember transition-[width] duration-500" style={{ width: `${(100 * part.points) / part.max}%` }} />
                      </div>
                      <p className="text-[10px] text-muted">{part.why}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-muted">{calc.hazard_index.note}</p>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <figure className="min-w-0 hud-panel p-3">
          <figcaption className="text-xs font-semibold text-muted">All NASA tests, the 5 nearest and your condition (pulsing)</figcaption>
          <EChart option={chart} height={340} ariaLabel="Scatter of NASA tests, the five nearest tests and your condition" />
        </figure>
        <section aria-label="Nearest tests" className="hud-panel p-4">
          <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">Nearest 5 NASA tests</h2>
          {calc?.nearest.length === 0 && <p className="text-sm text-muted">No NASA tests of this material — a data gap.</p>}
          <ol className="space-y-1.5">
            {calc?.nearest.map((n) => (
              <li key={n.test_id}>
                <button type="button" onClick={() => openTest(n.test_id)} className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-left text-xs hover:border-ember">
                  <span className="font-mono">{n.test_id}</span> · <span style={{ color: INV_COLORS[n.investigation] }}>{n.investigation}</span> · {n.fuel}
                  <span className="block font-mono text-muted">
                    {n.o2_pct}% · {n.pressure_psi} psi · distance {n.distance} · row {n.source_row}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] text-muted">Distance 1.0 = edge of the ±5 pp O2 / ±2.5 psi envelope (lib/physics.ts).</p>
        </section>
      </div>

      <CsvUpload rowsCount={labRows.length} onRows={setLabRows} />
    </div>
  );
}

function CsvUpload({ rowsCount, onRows }: { rowsCount: number; onRows: (r: ReturnType<typeof applyMapping>) => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const labRows = useHearth((s) => s.labRows);

  const load = (text: string, fileName: string) => {
    const all = parseCsv(text);
    if (all.length < 2) {
      setMsg("The file needs a header row and at least one data row.");
      return;
    }
    setName(fileName);
    setRows(all);
    setMapping(detectMapping(all[0], all.slice(1)));
    setMsg(null);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) {
      setMsg("File too large (max 2 MB).");
      return;
    }
    f.text().then((t) => load(t, f.name));
  };

  const header = rows?.[0] ?? [];
  const sel = (key: "label" | "o2" | "pressure" | "flow", label: string) => (
    <label className="text-xs text-muted">
      {label}
      <select
        value={mapping?.[key] ?? ""}
        onChange={(e) => setMapping((m) => (m ? { ...m, [key]: e.target.value === "" ? null : Number(e.target.value) } : m))}
        className="mt-1 block w-full rounded border border-line bg-raised px-2 py-1 text-sm text-text"
      >
        <option value="">— none —</option>
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || `column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section aria-label="Upload your data" className="space-y-3 hud-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Upload your own data (CSV)</h2>
        <a href="/sample_lab_data.csv" download className="text-xs text-ember-soft underline">
          Download example CSV (made-up example data)
        </a>
      </div>
      <p className="text-xs text-muted">Your file is read in this browser only and kept in memory: it is never uploaded or saved, and never mixed into the NASA tables. Rows appear as yellow triangles here and on the overview map.</p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="block text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-raised file:px-3 file:py-1.5 file:text-text" aria-label="Choose a CSV file" />
      {msg && <p className="text-sm text-bad">{msg}</p>}
      {rows && mapping && (
        <div className="space-y-3 rounded-lg border border-line bg-bg p-3">
          <p className="text-sm">
            <b>{name}</b>: {rows.length - 1} rows. Confirm which columns to use:
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {sel("label", "Label")}
            {sel("o2", "O2 column")}
            <label className="text-xs text-muted">
              O2 written as
              <select value={mapping.o2_is_fraction ? "f" : "p"} onChange={(e) => setMapping({ ...mapping, o2_is_fraction: e.target.value === "f" })} className="mt-1 block w-full rounded border border-line bg-raised px-2 py-1 text-sm text-text">
                <option value="p">percent (21)</option>
                <option value="f">fraction (0.21)</option>
              </select>
            </label>
            {sel("pressure", "Pressure column")}
            <label className="text-xs text-muted">
              Pressure unit
              <select value={mapping.pressure_unit} onChange={(e) => setMapping({ ...mapping, pressure_unit: e.target.value as PressureUnit })} className="mt-1 block w-full rounded border border-line bg-raised px-2 py-1 text-sm text-text">
                {["psi", "bar", "atm", "kPa"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            {sel("flow", "Airflow column (cm/s)")}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onRows(applyMapping(rows.slice(1), mapping))} className="rounded-md bg-ember px-3 py-1.5 text-sm font-semibold text-bg hover:bg-ember-soft">
              Use this mapping
            </button>
            <button type="button" onClick={() => (setRows(null), setMapping(null))} className="rounded-md border border-line px-3 py-1.5 text-sm text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
      {rowsCount > 0 && (
        <div className="overflow-x-auto">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>
              {labRows.filter((r) => !r.problems.length).length} of {labRows.length} rows passed the range checks (O2 0–100%, pressure &gt; 0, airflow ≥ 0).
            </span>
            <button type="button" onClick={() => onRows([])} className="underline">
              Clear my data
            </button>
          </div>
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1">Label</th>
                <th className="text-right">O2 %</th>
                <th className="text-right">psi</th>
                <th className="text-right">cm/s</th>
                <th className="pl-3">Checks</th>
              </tr>
            </thead>
            <tbody>
              {labRows.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-t border-line/60">
                  <td className="py-1">{r.label}</td>
                  <td className="text-right font-mono">{r.o2_pct ?? "—"}</td>
                  <td className="text-right font-mono">{r.pressure_psi ?? "—"}</td>
                  <td className="text-right font-mono">{r.flow_cm_s ?? "—"}</td>
                  <td className={`pl-3 ${r.problems.length ? "text-warn" : "text-ok"}`}>{r.problems.join("; ") || "ok"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
