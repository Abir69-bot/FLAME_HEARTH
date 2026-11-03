"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EChart } from "@/components/charts/EChart";
import { INV_COLORS } from "@/components/charts/HabitatMap";
import { useHearth } from "@/lib/store";

type Inv = "ACME" | "CFI" | "SPICE";
const ALL: Inv[] = ["ACME", "CFI", "SPICE"];
interface Stat {
  n: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}
interface CompareResp {
  investigations: Inv[];
  shared: Record<string, string[]>;
  only: Record<string, Record<string, string[]>>;
  conditions: { investigation: Inv; tests: number; o2_pct: Stat; pressure_psi: Stat; flow_cm_s: Stat }[];
  coverage: {
    axes: { key: string; label: string; unit: string; formula: string }[];
    raw: Record<string, Record<string, number>>;
    norm: Record<string, Record<string, number>>;
  };
}
interface MapPoint {
  investigation: Inv;
  o2_pct: number;
  pressure_psi: number;
}

const ATTR_LABEL: Record<string, string> = {
  fuel: "Fuels",
  fuel_phase: "Fuel phases",
  geometry: "Flame geometries",
  hardware: "Hardware",
  diluent: "Diluents",
  campaign: "Campaigns",
  sensors: "Sensors",
  measurements: "Measurements",
};

const TOOLTIP = { backgroundColor: "#131B2E", borderColor: "#1F2A44", textStyle: { color: "#E8ECF6", fontSize: 12 } };
const AXIS = { axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } }, axisLine: { lineStyle: { color: "#1F2A44" } }, nameTextStyle: { color: "#97A3BC" } };

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const missionId = useHearth((s) => s.missionId);
  const fromUrl = (params.get("inv") ?? "ACME,CFI,SPICE").split(",").filter((x): x is Inv => ALL.includes(x as Inv));
  const [sel, setSel] = useState<Inv[]>(fromUrl.length >= 2 ? fromUrl : ALL);
  const [data, setData] = useState<CompareResp | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [err, setErr] = useState(false);

  // follow VESTA's go_view compare=… changes
  const urlKey = params.get("inv") ?? "";
  useEffect(() => {
    const next = urlKey.split(",").filter((x): x is Inv => ALL.includes(x as Inv));
    if (next.length >= 2) setSel(next);
  }, [urlKey]);

  useEffect(() => {
    let alive = true;
    setErr(false);
    fetch(`/api/compare?inv=${sel.join(",")}&mission=${missionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [sel, missionId]);

  useEffect(() => {
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setPoints(j.points))
      .catch(() => {});
  }, []);

  const toggle = (i: Inv) => {
    const next = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i];
    if (next.length < 2) return;
    setSel(next);
    router.replace(`/compare?inv=${next.join(",")}`, { scroll: false });
  };

  const radar = useMemo(() => {
    if (!data) return null;
    const axes = data.coverage.axes;
    return {
      backgroundColor: "transparent",
      color: sel.map((i) => INV_COLORS[i]),
      legend: { bottom: 0, textStyle: { color: "#97A3BC" } },
      tooltip: {
        ...TOOLTIP,
        trigger: "item",
        formatter: (p: { name: string }) => {
          const inv = p.name;
          return `<b>${inv}</b><br/>${axes
            .map((a) => `${a.label}: ${data.coverage.norm[inv][a.key]} <span style="color:#97A3BC">(raw ${data.coverage.raw[inv][a.key]} ${a.unit})</span><br/><span style="color:#97A3BC;font-size:11px">${a.formula}</span>`)
            .join("<br/>")}`;
        },
      },
      radar: {
        indicator: axes.map((a) => ({ name: a.label, max: 100 })),
        axisName: { color: "#E8ECF6", fontSize: 10 },
        center: ["50%", "52%"],
        splitLine: { lineStyle: { color: "#1F2A44" } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: "#1F2A44" } },
        radius: "56%",
      },
      series: [
        {
          type: "radar",
          areaStyle: { opacity: 0.15 },
          data: sel.map((inv) => ({ name: inv, value: axes.map((a) => data.coverage.norm[inv][a.key]) })),
        },
      ],
    };
  }, [data, sel]);

  const bars = useMemo(() => {
    if (!data) return null;
    const metrics: [string, "o2_pct" | "pressure_psi" | "flow_cm_s"][] = [
      ["Mean O2 (%)", "o2_pct"],
      ["Mean pressure (psi)", "pressure_psi"],
      ["Mean airflow (cm/s)", "flow_cm_s"],
    ];
    return {
      backgroundColor: "transparent",
      legend: { top: 0, textStyle: { color: "#97A3BC" } },
      tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: metrics.map((m) => m[0]), ...AXIS, axisLabel: { color: "#97A3BC", interval: 0, fontSize: 10 } },
      yAxis: { type: "value", ...AXIS },
      series: data.conditions.map((c) => ({
        name: c.investigation,
        type: "bar",
        itemStyle: { color: INV_COLORS[c.investigation] },
        data: metrics.map(([, k]) => c[k].mean),
        label: { show: true, position: "top", color: "#97A3BC", fontSize: 10, formatter: (p: { value: number | null }) => (p.value == null ? "not recorded" : String(p.value)) },
      })),
    };
  }, [data]);

  const scatter = useMemo(() => {
    if (!points.length) return null;
    return {
      backgroundColor: "transparent",
      legend: { top: 0, textStyle: { color: "#97A3BC" } },
      tooltip: { ...TOOLTIP, trigger: "item", formatter: (p: { seriesName: string; value: [number, number] }) => `${p.seriesName}<br/>${p.value[1]}% O2 · ${p.value[0]} psi` },
      grid: { left: 8, right: 16, top: 30, bottom: 30, containLabel: true },
      xAxis: { type: "value", name: "Pressure (psi)", nameLocation: "middle", nameGap: 24, ...AXIS },
      yAxis: { type: "value", name: "O2 (%)", max: 100, ...AXIS },
      dataZoom: [{ type: "inside", xAxisIndex: 0, filterMode: "none" }, { type: "inside", yAxisIndex: 0, filterMode: "none" }],
      series: sel.map((inv) => {
        const seen = new Set<string>();
        const pts = points
          .filter((p) => p.investigation === inv)
          .map((p) => [p.pressure_psi, p.o2_pct] as [number, number])
          .filter((v) => (seen.has(v.join()) ? false : (seen.add(v.join()), true)));
        return { name: inv, type: "scatter", symbolSize: 7, itemStyle: { color: INV_COLORS[inv], opacity: 0.75 }, data: pts };
      }),
    };
  }, [points, sel]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Investigations to compare">
        <span className="text-xs text-muted">Compare (pick 2–3):</span>
        {ALL.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={sel.includes(i)}
            onClick={() => toggle(i)}
            className={`rounded-md border px-3 py-1 text-sm transition ${sel.includes(i) ? "border-transparent text-bg" : "border-line text-muted hover:text-text"}`}
            style={sel.includes(i) ? { background: INV_COLORS[i] } : undefined}
          >
            {i}
          </button>
        ))}
      </div>
      {err && <p className="text-sm text-bad">Could not load the comparison.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        <figure className="min-w-0 animate-fadeUp rounded-xl border border-line bg-panel p-3">
          <figcaption className="text-xs font-semibold text-muted">Coverage radar (0–100 per axis; hover for raw values and formulas)</figcaption>
          {radar ? <EChart option={radar} height={320} ariaLabel="Radar chart of investigation coverage" /> : <div className="h-[320px] animate-pulse rounded bg-raised" />}
        </figure>
        <figure className="min-w-0 animate-fadeUp rounded-xl border border-line bg-panel p-3">
          <figcaption className="text-xs font-semibold text-muted">Mean test conditions</figcaption>
          {bars ? <EChart option={bars} height={320} ariaLabel="Grouped bars of mean O2, pressure and airflow" /> : <div className="h-[320px] animate-pulse rounded bg-raised" />}
        </figure>
      </div>
      <figure className="min-w-0 rounded-xl border border-line bg-panel p-3">
        <figcaption className="text-xs font-semibold text-muted">Where each investigation tested (O2 vs pressure, unique conditions)</figcaption>
        {scatter ? <EChart option={scatter} height={300} ariaLabel="Overlay scatter of tested conditions" /> : <div className="h-[300px] animate-pulse rounded bg-raised" />}
      </figure>
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">Shared by all</h2>
            <AttrList items={data.shared} empty="Nothing in common beyond microgravity operation." />
          </section>
          {sel.map((inv) => (
            <section key={inv} className="rounded-xl border border-line bg-panel p-4">
              <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider" style={{ color: INV_COLORS[inv] }}>
                Only in {inv}
              </h2>
              <AttrList items={data.only[inv] ?? {}} empty="Nothing unique." />
            </section>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted">Statistics exclude flagged duplicate rows. SPICE O2 and pressure are the documented coflow conditions (SPICE_Report p20).</p>
    </div>
  );
}

function AttrList({ items, empty }: { items: Record<string, string[]>; empty: string }) {
  const rows = Object.entries(items).filter(([, v]) => v.length);
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] uppercase tracking-wide text-muted">{ATTR_LABEL[k] ?? k}</dt>
          <dd className="flex flex-wrap gap-1">
            {v.map((x) => (
              <span key={x} className="rounded border border-line bg-raised px-1.5 py-0.5 text-xs">
                {x}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
