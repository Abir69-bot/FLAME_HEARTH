"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { INV_COLORS, aggregate, type Agg, type MapData } from "@/lib/map3d";
import { MISSIONS, getMission } from "@/lib/missions";
import { ISS_PO2_PSI } from "@/lib/physics";
import { useHearth } from "@/lib/store";
import { EChart, useReducedMotion } from "./EChart";

export { INV_COLORS };

const VIEW_KEY = "hearth.map.view";
type View = "3d" | "flat";

function canUse3D(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function savedView(): View | null {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "3d" || v === "flat" ? v : null;
  } catch {
    return null;
  }
}

const Skeleton = () => <div className="h-[400px] animate-pulse rounded-lg bg-raised sm:h-[540px]" />;

/** The 3D engine downloads only when this view is shown. */
const HabitatScene = dynamic(() => import("@/components/map3d/HabitatScene"), { ssr: false, loading: Skeleton });

export function HabitatMap({ height = 420 }: { height?: number }) {
  const [data, setData] = useState<MapData | null>(null);
  const [err, setErr] = useState(false);
  const missionId = useHearth((s) => s.missionId);
  const highlight = useHearth((s) => s.highlightIds);
  const openTest = useHearth((s) => s.openTest);
  const labRows = useHearth((s) => s.labRows);
  const reduce = useReducedMotion();
  const [view, setView] = useState<View | null>(null);
  const [can3D, setCan3D] = useState(true);
  const [failed3D, setFailed3D] = useState(false);

  // 3D by default; flat when the device cannot do 3D, the visitor prefers less motion, or chose flat before
  useEffect(() => {
    const ok = canUse3D();
    setCan3D(ok);
    setView(!ok ? "flat" : (savedView() ?? (reduce ? "flat" : "3d")));
  }, [reduce]);

  const chooseView = (v: View) => {
    setFailed3D(false);
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked: the choice just lasts until the page reloads */
    }
  };

  useEffect(() => {
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  const option = useMemo(() => {
    if (!data) return null;
    const mission = getMission(missionId);
    const hl = new Set(highlight);
    const byInv = (["ACME", "CFI", "SPICE"] as const).map((inv) => ({ inv, agg: aggregate(data.points.filter((p) => p.investigation === inv)) }));
    // constant-pO2 curve: O2% = 100 × 3.087 / P (tested formula, lib/physics.ts)
    const curve: [number, number][] = [];
    for (let p = 3.2; p <= 80; p += p < 10 ? 0.2 : 1) curve.push([Number(p.toFixed(2)), Number(((100 * ISS_PO2_PSI) / p).toFixed(2))]);
    const highlighted = data.points.filter((p) => hl.has(p.test_id)).map((p) => ({ value: [p.pressure_psi, p.o2_pct], ids: [p.test_id], fuels: p.fuel ? [p.fuel] : [], inv: p.investigation }));
    const refMissions = MISSIONS.filter((m) => m.id !== mission?.id);

    return {
      backgroundColor: "transparent",
      animationDuration: 800,
      grid: { left: 52, right: 18, top: 52, bottom: 48 },
      legend: { type: "scroll", pageIconColor: "#FFB98A", pageIconInactiveColor: "#1F2A44", pageTextStyle: { color: "#97A3BC" }, top: 0, textStyle: { color: "#97A3BC" }, itemWidth: 10, itemHeight: 10, data: ["ACME", "CFI", "SPICE", "ISS pO2 (3.087 psi)", "Missions", ...(labRows.length ? ["My data (not NASA)"] : [])] },
      tooltip: {
        trigger: "item",
        backgroundColor: "#131B2E",
        borderColor: "#1F2A44",
        textStyle: { color: "#E8ECF6", fontSize: 12 },
        formatter: (p: { seriesName: string; data: Agg & { name?: string; desc?: string } }) => {
          const d = p.data;
          if (d?.ids) {
            const more = d.ids.length > 3 ? ` +${d.ids.length - 3} more` : "";
            return `<b>${d.inv}</b> · ${d.ids.length} test${d.ids.length > 1 ? "s" : ""}<br/>${d.ids.slice(0, 3).join(", ")}${more}<br/>O2 ${d.value[1]}% · ${d.value[0]} psi<br/>${d.fuels.slice(0, 3).join(", ")}${d.fromDoc ? "<br/><i>conditions from SPICE_Report p20</i>" : ""}<br/><span style="color:#97A3BC">click for details</span>`;
          }
          if (d?.name) return `<b>${d.name}</b><br/>${d.desc ?? ""}`;
          return p.seriesName;
        },
      },
      xAxis: { type: "value", name: "Pressure (psi)", nameLocation: "middle", nameGap: 28, min: 0, max: 80, axisLabel: { color: "#97A3BC" }, nameTextStyle: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } }, axisLine: { lineStyle: { color: "#1F2A44" } } },
      yAxis: { type: "value", name: "O2 (%)", min: 0, max: 100, axisLabel: { color: "#97A3BC" }, nameTextStyle: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } } },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        { type: "inside", yAxisIndex: 0, filterMode: "none" },
      ],
      series: [
        {
          name: "Moon base / rover zone",
          type: "scatter",
          data: [],
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(255,122,47,0.10)", borderColor: "rgba(255,122,47,0.5)", borderType: "dashed", borderWidth: 1 },
            label: { show: false },
            data: [[{ name: "Moon base / rover", xAxis: data.lunar_region.pressure_psi[0], yAxis: data.lunar_region.o2_pct[0] }, { xAxis: data.lunar_region.pressure_psi[1], yAxis: data.lunar_region.o2_pct[1] }]],
          },
        },
        {
          name: "ISS pO2 (3.087 psi)",
          type: "line",
          data: curve,
          showSymbol: false,
          silent: true,
          lineStyle: { type: "dashed", color: "#FFC857", width: 1.2, opacity: 0.8 },
          itemStyle: { color: "#FFC857" },
          z: 1,
        },
        ...byInv.map(({ inv, agg }) => ({
          name: inv,
          type: "scatter",
          data: agg,
          symbolSize: (_v: unknown, p: { data: Agg }) => Math.min(26, 6 + Math.sqrt(p.data.ids.length) * 1.6),
          itemStyle: { color: INV_COLORS[inv], opacity: hl.size ? 0.35 : 0.8, borderColor: "#070B14", borderWidth: 0.5 },
          emphasis: { scale: 1.4, itemStyle: { opacity: 1 } },
          z: 3,
        })),
        {
          name: "Missions",
          type: "scatter",
          symbol: "diamond",
          symbolSize: 13,
          itemStyle: { color: "#E8ECF6", borderColor: "#070B14", borderWidth: 1 },
          label: { show: true, position: "right", color: "#E8ECF6", fontSize: 10, formatter: "{b}" },
          data: refMissions.map((m) => ({ name: m.short, value: [m.pressure_psi, m.o2_pct], desc: `${m.o2_pct}% O2 at ${m.pressure_psi} psi` })),
          z: 4,
        },
        ...(labRows.length
          ? [
              {
                name: "My data (not NASA)",
                type: "scatter",
                symbol: "triangle",
                symbolSize: 10,
                itemStyle: { color: "#FFC857", borderColor: "#070B14", borderWidth: 0.5 },
                data: labRows
                  .filter((r) => r.o2_pct != null && r.pressure_psi != null && !r.problems.length)
                  .map((r) => ({ name: r.label, value: [r.pressure_psi, r.o2_pct], desc: `Your uploaded row (not NASA data): ${r.o2_pct}% O2 at ${r.pressure_psi} psi` })),
                z: 4,
              },
            ]
          : []),
        ...(highlighted.length
          ? [
              {
                name: "Highlighted by VESTA",
                type: reduce ? "scatter" : "effectScatter",
                rippleEffect: { scale: 2.6, brushType: "stroke" },
                data: highlighted,
                symbolSize: 10,
                itemStyle: { color: "#FFFFFF", shadowBlur: 12, shadowColor: "#FFB98A" },
                z: 5,
              },
            ]
          : []),
        ...(mission
          ? [
              {
                name: "Active mission",
                type: reduce ? "scatter" : "effectScatter",
                rippleEffect: { scale: 3.2, brushType: "stroke", period: 3 },
                symbol: "diamond",
                symbolSize: 17,
                itemStyle: { color: "#FF7A2F", shadowBlur: 14, shadowColor: "#FF7A2F" },
                label: { show: true, position: "top", color: "#FFB98A", fontSize: 11, fontWeight: "bold", formatter: "{b}" },
                data: [{ name: mission.short, value: [mission.pressure_psi, mission.o2_pct], desc: `Active mission: ${mission.o2_pct}% O2 at ${mission.pressure_psi} psi` }],
                z: 6,
              },
            ]
          : []),
      ],
    };
  }, [data, missionId, highlight, reduce, labRows]);

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const d = (p as { data?: { ids?: string[] } }).data;
        if (d?.ids?.length) openTest(d.ids[0]);
      },
    }),
    [openTest],
  );

  if (err) return <p className="text-sm text-bad">Could not load the map data.</p>;
  if (!option || !view) return <Skeleton />;
  const plotted = data!.points.length;
  const { o2_pct: zoneO2, pressure_psi: zoneP } = data!.lunar_region;
  const show3D = view === "3d" && can3D && !failed3D;
  const legend: { name: string; color: string; shape: string }[] = [
    { name: "ACME", color: INV_COLORS.ACME, shape: "h-2 w-2 rounded-full" },
    { name: "CFI", color: INV_COLORS.CFI, shape: "h-2 w-2 rounded-full" },
    { name: "SPICE", color: INV_COLORS.SPICE, shape: "h-2 w-2 rounded-full" },
    { name: `Same pO2 as ISS (${ISS_PO2_PSI} psi)`, color: "#FFC857", shape: "h-0.5 w-4" },
    { name: `Moon base / rover zone (${zoneO2[0]}–${zoneO2[1]}% O2, ${zoneP[0]}–${zoneP[1]} psi)`, color: "#FF7A2F", shape: "h-2 w-2 rounded-sm" },
  ];
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-64 text-[11px] text-muted">
          {show3D ? (
            <>Every NASA test by pressure, O2 and height = pO2 (lib/physics.ts). The glowing sheet is every possible pO2; stems drop to the floor to read the axes. Pressure is on a log scale.</>
          ) : (
            <>
              Every NASA test by pressure and O2. Dashed line: same O2 partial pressure as the ISS ({ISS_PO2_PSI} psi). Shaded box: Moon base / rover zone ({zoneO2[0]}–{zoneO2[1]}% O2, {zoneP[0]}–{zoneP[1]} psi).
            </>
          )}
        </p>
        {can3D && (
          <div role="radiogroup" aria-label="Map view" className="flex shrink-0 overflow-hidden rounded-md border border-line text-[11px]">
            {(["3d", "flat"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => chooseView(v)} className={`px-2.5 py-1 transition ${view === v ? "bg-ember/20 text-ember-soft" : "text-muted hover:text-text"}`}>
                {v === "3d" ? "3D scene" : "Flat chart"}
              </button>
            ))}
          </div>
        )}
      </div>
      {failed3D && <p className="mb-1 text-[11px] text-warn">The 3D scene could not run on this device, so this is the flat chart.</p>}
      {show3D ? (
        <>
          <HabitatScene data={data!} reduce={reduce} onFail={() => setFailed3D(true)} />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" aria-label="Map key">
            {legend.map((l) => (
              <li key={l.name} className="flex items-center gap-1.5">
                <span aria-hidden className={`inline-block ${l.shape}`} style={{ background: l.color }} />
                {l.name}
              </li>
            ))}
            {labRows.length > 0 && (
              <li className="flex items-center gap-1.5 text-warn">
                <span aria-hidden>▲</span>My data (not NASA)
              </li>
            )}
          </ul>
        </>
      ) : (
        <EChart option={option} height={height} onEvents={onEvents} ariaLabel={`Habitat relevance map: ${plotted} NASA tests by pressure and oxygen, with mission markers`} />
      )}
      <p className="mt-1 text-[11px] text-muted">
        {plotted} tests plotted (points at identical conditions are merged; size = count).{" "}
        {show3D ? "Drag to turn, Ctrl + scroll or +/− to zoom, click a point for details. Earth, Moon and Sun are artwork and the mission models are symbols, not to scale: only the points, the sheet and each model's position are data. " : "Scroll to zoom, click a point for details. "}
        {data!.not_plotted.length ? `Not plotted (missing O2 or pressure): ${data!.not_plotted.map((n) => n.test_id).join(", ")}.` : "No test is missing O2 or pressure."}
        {highlight.length > 0 && (
          <button type="button" className="ml-2 text-ember-soft underline" onClick={() => useHearth.getState().setHighlight([])}>
            Clear {highlight.length} highlighted
          </button>
        )}
      </p>
    </div>
  );
}
