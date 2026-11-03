"use client";
import { useEffect, useMemo, useState } from "react";
import { useHearth } from "@/lib/store";
import { EChart } from "./EChart";

interface Rank {
  mission: { id: string; short: string; o2_pct: number; pressure_psi: number };
  ranking: { investigation: string; score: number; envelope_count: number; parts: { name: string; points: number; max: number; why: string }[] }[];
}

const PART_COLORS = ["#FF7A2F", "#4CC9F0", "#A78BFA", "#5EE6A8"];

/** Investigation relevance for the active mission: stacked score parts, reasons on hover. */
export function RankBars() {
  const missionId = useHearth((s) => s.missionId);
  const [data, setData] = useState<Rank | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr(false);
    fetch(`/api/rank?mission=${missionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [missionId]);

  const option = useMemo(() => {
    if (!data) return null;
    const rows = [...data.ranking].reverse();
    const partNames = rows[0]?.parts.map((p) => p.name) ?? [];
    return {
      backgroundColor: "transparent",
      grid: { left: 56, right: 40, top: 30, bottom: 24 },
      legend: { top: 0, textStyle: { color: "#97A3BC", fontSize: 10 }, itemWidth: 10, itemHeight: 8 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#131B2E",
        borderColor: "#1F2A44",
        textStyle: { color: "#E8ECF6", fontSize: 12 },
        formatter: (ps: { dataIndex: number }[]) => {
          const r = rows[ps[0].dataIndex];
          return `<b>${r.investigation}: ${r.score} / 100</b> (heuristic)<br/>${r.parts.map((p) => `${p.name}: ${p.points}/${p.max}<br/><span style="color:#97A3BC;font-size:11px">${p.why}</span>`).join("<br/>")}`;
        },
      },
      xAxis: { type: "value", max: 100, axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } } },
      yAxis: { type: "category", data: rows.map((r) => r.investigation), axisLabel: { color: "#E8ECF6" }, axisLine: { lineStyle: { color: "#1F2A44" } } },
      series: partNames.map((name, i) => ({
        name,
        type: "bar",
        stack: "score",
        barWidth: 18,
        itemStyle: { color: PART_COLORS[i % PART_COLORS.length] },
        data: rows.map((r) => r.parts[i].points),
        label: i === partNames.length - 1 ? { show: true, position: "right", color: "#E8ECF6", formatter: (p: { dataIndex: number }) => String(rows[p.dataIndex].score) } : undefined,
      })),
    };
  }, [data]);

  return (
    <section aria-label="Investigation ranking" className="rounded-xl border border-line bg-panel p-4">
      <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Most relevant investigations</h2>
      <p className="mb-2 text-[11px] text-muted">
        {data ? `For ${data.mission.short} (${data.mission.o2_pct}% O2, ${data.mission.pressure_psi} psi). ` : ""}Score = proximity 40 + O2 coverage 20 + pressure coverage 20 + tests in envelope 20 (heuristic). Hover for reasons.
      </p>
      {err ? <p className="text-sm text-bad">Could not load the ranking.</p> : option ? <EChart option={option} height={190} ariaLabel="Ranking of investigations by relevance score" /> : <div className="h-[190px] animate-pulse rounded bg-raised" />}
    </section>
  );
}
