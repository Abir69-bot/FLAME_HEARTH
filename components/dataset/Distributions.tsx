"use client";
import { useMemo, useState } from "react";
import { EChart } from "@/components/charts/EChart";
import type { DatasetProfile } from "@/lib/dataset";
import { INV_COLORS } from "@/lib/map3d";
import { INVESTIGATIONS } from "@/lib/types";
import { Chip, InvName } from "./shared";

/** One measure at a time as a stacked histogram, with its numbers in a table underneath. */
export function Distributions({ distributions }: { distributions: DatasetProfile["distributions"] }) {
  const [id, setId] = useState(distributions[0].id);
  const d = distributions.find((x) => x.id === id) ?? distributions[0];
  const present = INVESTIGATIONS.filter((i) => d.stats[i].n > 0);

  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      animationDuration: 500,
      grid: { left: 8, right: 12, top: present.length > 1 ? 34 : 12, bottom: 28, containLabel: true },
      legend: present.length > 1 ? { top: 0, right: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: "#97A3BC", fontSize: 11 } } : undefined,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.05)" } },
        backgroundColor: "#131B2E",
        borderColor: "#1F2A44",
        textStyle: { color: "#E8ECF6", fontSize: 12 },
      },
      xAxis: {
        type: "category",
        data: d.bins.map((b) => b.label),
        name: d.unit,
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { color: "#97A3BC", fontSize: 11 },
        axisLine: { lineStyle: { color: "#1F2A44" } },
        axisTick: { show: false },
        axisLabel: { color: "#97A3BC", fontSize: 10, hideOverlap: true },
      },
      yAxis: { type: "value", name: "Tests", nameTextStyle: { color: "#97A3BC", fontSize: 11 }, minInterval: 1, axisLabel: { color: "#97A3BC", fontSize: 10 }, splitLine: { lineStyle: { color: "#1F2A44", opacity: 0.6 } } },
      series: present.map((i) => ({
        name: i,
        type: "bar",
        stack: "tests",
        barCategoryGap: "12%",
        data: d.bins.map((b) => b.counts[i]),
        itemStyle: { color: INV_COLORS[i], borderColor: "#0D1322", borderWidth: 1, borderRadius: 2 },
        emphasis: { focus: "series" },
      })),
    }),
    [d, present],
  );

  const unit = d.unit ? ` ${d.unit}` : "";
  return (
    <div className="hud-panel space-y-3 p-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Choose a measure">
        {distributions.map((x) => (
          <Chip key={x.id} active={x.id === id} onClick={() => setId(x.id)}>
            {x.label}
          </Chip>
        ))}
      </div>
      <h3 className="font-head text-base font-semibold">
        {d.label}
        {d.unit && <span className="ml-1.5 font-mono text-xs font-normal text-muted">{d.unit}</span>}
      </h3>
      <EChart option={option} height={270} ariaLabel={`Histogram of ${d.label}. The table below gives the same data as statistics per investigation.`} />
      <p className="text-xs text-muted">{d.note}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="py-1 font-medium">Investigation</th>
              <th className="text-right font-medium">Values</th>
              <th className="text-right font-medium">Missing</th>
              <th className="text-right font-medium">Min</th>
              <th className="text-right font-medium">Median</th>
              <th className="text-right font-medium">Mean</th>
              <th className="text-right font-medium">Max</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {INVESTIGATIONS.map((i) => {
              const s = d.stats[i];
              return (
                <tr key={i} className="border-t border-line/60">
                  <td className="py-1 font-sans">
                    <InvName id={i} />
                  </td>
                  <td className="text-right">{s.n}</td>
                  <td className="text-right text-muted">{s.missing}</td>
                  {s.n === 0 ? (
                    <td colSpan={4} className="text-right font-sans text-muted">
                      not recorded
                    </td>
                  ) : (
                    <>
                      <td className="text-right">{s.min}</td>
                      <td className="text-right">{s.median}</td>
                      <td className="text-right">{s.mean}</td>
                      <td className="text-right">{s.max}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sr-only">All values in{unit || " their own unit"}.</p>
    </div>
  );
}
