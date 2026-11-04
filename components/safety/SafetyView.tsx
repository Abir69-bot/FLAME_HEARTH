"use client";
import { useEffect, useMemo, useState } from "react";
import { EChart } from "@/components/charts/EChart";
import { ConfidenceTag, sourceLabel } from "@/components/vesta/Bits";
import { getMission } from "@/lib/missions";
import { useHearth } from "@/lib/store";
import type { Confidence, Source } from "@/lib/types";

interface Finding {
  id: string;
  category: "prevention" | "detection" | "suppression";
  title: string;
  severity: number;
  severity_rule: string;
  confidence: Confidence;
  evidence: { text: string; source?: Source }[];
  guideline: string;
}
interface Cell {
  o2_index: number;
  p_index: number;
  count: number;
  missions: string[];
  by_investigation: Record<string, number>;
}
interface Gaps {
  o2_bins: string[];
  p_bins: string[];
  grid: Cell[];
  missing_fuel_phases: string[];
  gravity_levels_tested: string[];
  recommendations: { gap: string; suggestion: string }[];
  focus_cell: Cell | null;
}

const CATS: { id: Finding["category"]; label: string; hint: string }[] = [
  { id: "prevention", label: "Prevention", hint: "Keep a fire from starting" },
  { id: "detection", label: "Detection", hint: "Notice a fire early" },
  { id: "suppression", label: "Suppression", hint: "Put a fire out" },
];

function sevColor(s: number) {
  return s >= 60 ? "bg-bad" : s >= 35 ? "bg-warn" : "bg-ok";
}

function SeverityBar({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-raised" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Severity">
      <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${sevColor(value)}`} style={{ width: `${w}%` }} />
    </div>
  );
}

const EARTH = [
  {
    title: "Cleaner engines",
    text: "ACME's goals include advancing fuel efficiency and reducing pollutant production in practical combustion on Earth; most engine design models neglect cool-flame chemistry.",
    sources: [
      { file: "ACME_Report.pdf", page: 68 },
      { file: "ACME_Report.pdf", page: 4 },
    ],
  },
  {
    title: "Fuel chemistry for new engine types",
    text: "CFI's droplet cool flames inform autoignition and heat-release chemistry needed for HCCI and RCCI engines.",
    sources: [{ file: "CFI_Report.pdf", page: 3 }],
  },
  {
    title: "Soot, smoke and building fires",
    text: "Laminar smoke points correlate with soot and radiative loss of turbulent flames; smoke and carbon monoxide from smoking flames are the main killers in fires.",
    sources: [
      { file: "SPICE_Report.pdf", page: 2 },
      { file: "SPICE_Report.pdf", page: 7 },
    ],
  },
];

export function SafetyView() {
  const missionId = useHearth((s) => s.missionId);
  const mission = getMission(missionId);
  const openTest = useHearth((s) => s.openTest);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [gaps, setGaps] = useState<Gaps | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr(false);
    setFindings(null);
    Promise.all([fetch(`/api/safety?mission=${missionId}`).then((r) => (r.ok ? r.json() : Promise.reject())), fetch(`/api/gaps?mission=${missionId}`).then((r) => (r.ok ? r.json() : Promise.reject()))])
      .then(([s, g]) => {
        if (!alive) return;
        setFindings(s.findings);
        setGaps(g);
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [missionId]);

  const heat = useMemo(() => {
    if (!gaps) return null;
    const max = Math.max(...gaps.grid.map((c) => c.count), 1);
    return {
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: "#131B2E",
        borderColor: "#1F2A44",
        textStyle: { color: "#E8ECF6", fontSize: 12 },
        formatter: (p: { data: { cell: Cell } }) => {
          const c = p.data.cell;
          const inv = Object.entries(c.by_investigation).map(([k, v]) => `${k} ${v}`).join(", ");
          return `${gaps.o2_bins[c.o2_index]} O2 × ${gaps.p_bins[c.p_index]}<br/>${c.count ? `${c.count} tests (${inv})` : "<b style='color:#FF5D6C'>gap: no tests</b>"}${c.missions.length ? `<br/>missions: ${c.missions.join(", ")}` : ""}`;
        },
      },
      grid: { left: 8, right: 8, top: 10, bottom: 10, containLabel: true },
      xAxis: { type: "category", data: gaps.p_bins, name: "Pressure", nameLocation: "middle", nameGap: 26, axisLabel: { color: "#97A3BC", fontSize: 10 }, nameTextStyle: { color: "#97A3BC" } },
      yAxis: { type: "category", data: gaps.o2_bins, name: "O2", axisLabel: { color: "#97A3BC", fontSize: 10 }, nameTextStyle: { color: "#97A3BC" } },
      series: [
        {
          type: "heatmap",
          data: gaps.grid.map((c) => {
            const focus = c.missions.includes(missionId);
            const a = c.count ? 0.25 + 0.75 * Math.sqrt(c.count / max) : 0;
            return {
              value: [c.p_index, c.o2_index, c.count],
              cell: c,
              itemStyle: {
                color: c.count ? `rgba(255,122,47,${a.toFixed(2)})` : "rgba(255,93,108,0.18)",
                borderColor: focus ? "#FFB98A" : "#070B14",
                borderWidth: focus ? 3 : 1,
              },
              label: { show: true, color: c.count ? "#E8ECF6" : "#FF5D6C", fontSize: 10, formatter: c.count ? String(c.count) : "gap" },
            };
          }),
        },
      ],
    };
  }, [gaps, missionId]);

  if (err) return <p className="text-sm text-bad">Could not load the safety audit.</p>;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Audit for <b className="text-text">{mission?.name}</b> ({mission?.o2_pct}% O2, {mission?.pressure_psi} psi, gravity: {mission?.gravity}). Severity is a HEARTH heuristic (0–100) for ordering findings, not a NASA rating; guidelines describe evidence, not official rules.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {CATS.map((cat) => (
          <section key={cat.id} aria-label={cat.label} className="space-y-3">
            <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">
              {cat.label} <span className="normal-case tracking-normal text-muted/70">· {cat.hint}</span>
            </h2>
            {!findings &&
              [1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-panel" />)}
            {findings
              ?.filter((f) => f.category === cat.id)
              .map((f) => (
                <article key={f.id} className="animate-fadeUp space-y-2 hud-panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{f.title}</h3>
                    <span className="font-mono text-sm" title={f.severity_rule}>
                      {f.severity}
                    </span>
                  </div>
                  <SeverityBar value={f.severity} />
                  <p className="font-mono text-[10px] text-muted">severity = {f.severity_rule}</p>
                  <ConfidenceTag value={f.confidence} />
                  <ul className="space-y-1">
                    {f.evidence.map((e, i) => (
                      <li key={i} className="rounded border border-line bg-bg px-2 py-1 text-xs">
                        {e.text}
                        {e.source && (
                          <button
                            type="button"
                            disabled={!e.source.test_id}
                            onClick={() => e.source?.test_id && openTest(e.source.test_id)}
                            className="ml-1 font-mono text-[10px] text-muted enabled:hover:text-ember-soft"
                          >
                            · {sourceLabel(e.source)}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-text/90">{f.guideline}</p>
                </article>
              ))}
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <figure className="min-w-0 hud-panel p-3">
          <figcaption className="mb-1 text-xs font-semibold text-muted">Test coverage: O2 × pressure (count per cell; red = gap; outlined = active mission)</figcaption>
          {heat ? <EChart option={heat} height={360} ariaLabel="Heatmap of NASA test counts by O2 and pressure bins" /> : <div className="h-[360px] animate-pulse rounded bg-raised" />}
        </figure>
        <section className="space-y-3 hud-panel p-4">
          <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Data gaps and the experiments that would fill them</h2>
          {gaps && (
            <>
              <p className="text-sm">
                Missing fuel types: <b>{gaps.missing_fuel_phases.join(", ") || "none"}</b>. Gravity levels tested: <b>{gaps.gravity_levels_tested.map((g) => (g === "ug" ? "microgravity" : g)).join(", ")}</b>.
              </p>
              {gaps.focus_cell && (
                <p className="text-sm text-muted">
                  The active mission&apos;s cell holds <b className="text-text">{gaps.focus_cell.count}</b> tests.
                </p>
              )}
              <ul className="space-y-2">
                {gaps.recommendations.map((r) => (
                  <li key={r.gap} className="rounded-lg border border-line bg-bg p-2 text-sm">
                    <b className="text-bad">{r.gap}</b>
                    <p className="text-muted">{r.suggestion}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section aria-label="Uses on Earth" className="hud-panel p-4">
        <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">Uses on Earth</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {EARTH.map((e) => (
            <div key={e.title} className="rounded-lg border border-line bg-bg p-3 text-sm">
              <h3 className="mb-1 font-semibold text-spice">{e.title}</h3>
              <p className="text-muted">{e.text}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">{e.sources.map((s) => `${s.file} p${s.page}`).join(" · ")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
