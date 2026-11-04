"use client";
import { useEffect, useMemo, useState } from "react";
import { MISSIONS, getMission } from "@/lib/missions";
import { ISS_PO2_PSI } from "@/lib/physics";
import { useHearth } from "@/lib/store";
import { EChart, useReducedMotion } from "./EChart";

interface MapPoint {
  test_id: string;
  investigation: "ACME" | "CFI" | "SPICE";
  o2_pct: number;
  pressure_psi: number;
  flow_cm_s: number | null;
  fuel: string | null;
  campaign: string | null;
  from_doc: boolean;
}
interface MapData {
  points: MapPoint[];
  not_plotted: { test_id: string; investigation: string; missing: string[] }[];
  lunar_region: { o2_pct: [number, number]; pressure_psi: [number, number] };
}

export const INV_COLORS = { ACME: "#4CC9F0", CFI: "#A78BFA", SPICE: "#5EE6A8" } as const;

interface Agg {
  value: [number, number];
  ids: string[];
  fuels: string[];
  inv: string;
  fromDoc: boolean;
}

/** Tests at identical conditions are drawn as one point whose size grows with the count. */
function aggregate(points: MapPoint[]): Agg[] {
  const m = new Map<string, Agg>();
  for (const p of points) {
    const k = `${p.investigation}|${p.pressure_psi}|${p.o2_pct}`;
    const a = m.get(k) ?? { value: [p.pressure_psi, p.o2_pct], ids: [], fuels: [], inv: p.investigation, fromDoc: p.from_doc };
    a.ids.push(p.test_id);
    if (p.fuel && !a.fuels.includes(p.fuel)) a.fuels.push(p.fuel);
    m.set(k, a);
  }
  return [...m.values()];
}

export function HabitatMap({ height = 420 }: { height?: number }) {
  const [data, setData] = useState<MapData | null>(null);
  const [err, setErr] = useState(false);
  const missionId = useHearth((s) => s.missionId);
  const highlight = useHearth((s) => s.highlightIds);
  const openTest = useHearth((s) => s.openTest);
  const labRows = useHearth((s) => s.labRows);
  const reduce = useReducedMotion();

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
  if (!option) return <div style={{ height }} className="animate-pulse rounded-lg bg-raised" />;
  const plotted = data!.points.length;
  return (
    <div>
      <EChart option={option} height={height} onEvents={onEvents} ariaLabel={`Habitat relevance map: ${plotted} NASA tests by pressure and oxygen, with mission markers`} />
      <p className="mt-1 text-[11px] text-muted">
        {plotted} tests plotted (points at identical conditions are merged; size = count). Scroll to zoom, click a point for details.{" "}
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
