"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EChart } from "@/components/charts/EChart";
import { DemoBadge } from "@/components/vesta/Bits";
import { getMission } from "@/lib/missions";
import { flowRegime, hazardIndex, pO2 } from "@/lib/physics";
import { newId, useHearth } from "@/lib/store";

/**
 * DEMO MODE: simulated cabin telemetry. Every value here is generated in the browser.
 * It is NOT NASA data and never enters the NASA tables, map or VESTA's data tools.
 */
const TICK_MS = 1500;
const WINDOW = 60; // 60 samples × 1.5 s = 90 s
const LIMITS = { smoke: 1.5, temp: 35, flowMin: 5 }; // DEMO thresholds, not standards

interface Sample {
  t: number;
  o2: number;
  p: number;
  po2: number;
  flow: number;
  smoke: number;
  temp: number;
}
type Phase = "idle" | "rising" | "alarm" | "recovering";

const jitter = (v: number, a: number) => v + (Math.random() - 0.5) * 2 * a;
const r = (v: number, d = 2) => Number(v.toFixed(d));

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <svg width="100%" height="28" aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 120},${26 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 120 28" width="100%" height="28" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function DemoTelemetry() {
  const missionId = useHearth((s) => s.missionId);
  const m = getMission(missionId) ?? getMission("lunar-rover")!;
  const [running, setRunning] = useState(true);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<{ id: string; t: string; text: string; level: "info" | "warn" | "bad" }[]>([]);
  const drill = useRef({ step: 0, alerted: false });
  const base = useRef({ o2: m.o2_pct, p: m.pressure_psi, flow: 12, smoke: 0.05, temp: 22 });

  const log = useCallback((text: string, level: "info" | "warn" | "bad" = "info") => {
    setEvents((e) => [{ id: newId(), t: new Date().toLocaleTimeString(), text, level }, ...e].slice(0, 30));
  }, []);

  useEffect(() => {
    base.current = { ...base.current, o2: m.o2_pct, p: m.pressure_psi };
    log(`DEMO feed set to ${m.short} cabin baseline (${m.o2_pct}% O2, ${m.pressure_psi} psi)`);
  }, [m, log]);

  const vestaSay = useCallback((text: string) => {
    useHearth.getState().addMessage({ id: newId(), role: "vesta", text, badge: "DEMO · simulated drill · not NASA data", steps: [], charts: [], sources: [], alert: "bad" });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const b = base.current;
      const d = drill.current;
      let smoke = jitter(b.smoke, 0.02);
      let temp = jitter(b.temp, 0.15);
      let flow = jitter(b.flow, 0.6);
      let ph: Phase = "idle";
      if (d.step > 0) {
        const k = d.step;
        if (k <= 8) {
          ph = "rising";
          smoke += 0.4 * k;
          temp += 2.2 * k;
          flow -= 1.2 * k;
        } else if (k <= 12) {
          ph = "alarm";
          smoke += 3.2;
          temp += 17.6;
          flow -= 9.6;
        } else if (k <= 20) {
          ph = "recovering";
          const f = (20 - k) / 8;
          smoke += 3.2 * f;
          temp += 17.6 * f;
          flow -= 9.6 * f;
        } else {
          d.step = 0;
          d.alerted = false;
          ph = "idle";
          log("DEMO drill complete: simulated readings back inside DEMO limits");
          vestaSay("DEMO drill complete. Simulated smoke, temperature and airflow are back inside the DEMO limits. Reminder: this was a simulation; HEARTH's NASA data has no smoke-detector or suppression tests, so treat the drill as practice only.");
        }
        if (d.step > 0) d.step++;
      }
      flow = Math.max(0.5, flow);
      const s: Sample = { t: Date.now(), o2: r(jitter(b.o2, 0.1), 2), p: r(jitter(b.p, 0.02), 2), po2: 0, flow: r(flow, 1), smoke: r(Math.max(0, smoke), 2), temp: r(temp, 1) };
      s.po2 = pO2(s.o2, s.p);
      const over = s.smoke > LIMITS.smoke || s.temp > LIMITS.temp || s.flow < LIMITS.flowMin;
      if (over && d.step > 0 && !d.alerted) {
        d.alerted = true;
        log(`DEMO alarm: smoke ${s.smoke} %/m, ${s.temp} °C, airflow ${s.flow} cm/s`, "bad");
        vestaSay(
          `DEMO ALERT. Hazard first: simulated smoke ${s.smoke} %/m and cabin temperature ${s.temp} °C passed the DEMO limits, and airflow ${s.flow} cm/s is in the "${flowRegime(s.flow).regime}" regime. In the NASA data, evidence suggests cutting fuel or oxidizer flow ends gas flames (see Safety & gaps). All values in this alert are simulated.`,
        );
      }
      setPhase(ph);
      setSamples((prev) => [...prev, s].slice(-WINDOW));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, log, vestaSay]);

  const startDrill = () => {
    if (drill.current.step > 0) return;
    drill.current = { step: 1, alerted: false };
    setRunning(true);
    log("DEMO fire drill started: smoke and temperature rising, airflow dropping", "warn");
  };

  const last = samples[samples.length - 1];
  const hazard = last ? hazardIndex(last.o2, last.p, last.flow, "supported") : null;

  const chart = useMemo(
    () => ({
      backgroundColor: "transparent",
      animation: false,
      legend: { top: 0, textStyle: { color: "#97A3BC" } },
      tooltip: { trigger: "axis" },
      grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: samples.map((s, i) => `${Math.round(((i - samples.length + 1) * TICK_MS) / 1000)}s`), axisLabel: { color: "#97A3BC", fontSize: 9 } },
      yAxis: [
        { type: "value", name: "°C", axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } }, nameTextStyle: { color: "#97A3BC" } },
        { type: "value", name: "%/m · cm/s", axisLabel: { color: "#97A3BC" }, splitLine: { show: false }, nameTextStyle: { color: "#97A3BC" } },
      ],
      series: [
        { name: "Temperature (DEMO)", type: "line", showSymbol: false, data: samples.map((s) => s.temp), itemStyle: { color: "#FF5D6C" } },
        { name: "Smoke (DEMO)", type: "line", yAxisIndex: 1, showSymbol: false, data: samples.map((s) => s.smoke), itemStyle: { color: "#97A3BC" } },
        { name: "Airflow (DEMO)", type: "line", yAxisIndex: 1, showSymbol: false, data: samples.map((s) => s.flow), itemStyle: { color: "#4CC9F0" } },
      ],
    }),
    [samples],
  );

  const gauge = useMemo(
    () => ({
      backgroundColor: "transparent",
      series: [
        {
          type: "gauge",
          min: 0,
          max: 100,
          progress: { show: true, width: 10, itemStyle: { color: hazard && hazard.value >= 60 ? "#FF5D6C" : hazard && hazard.value >= 35 ? "#FFC857" : "#5EE6A8" } },
          axisLine: { lineStyle: { width: 10, color: [[1, "#1F2A44"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          detail: { valueAnimation: true, formatter: "{value}", color: "#E8ECF6", fontSize: 22, offsetCenter: [0, "10%"] },
          title: { show: true, offsetCenter: [0, "45%"], color: "#97A3BC", fontSize: 10 },
          data: [{ value: hazard?.value ?? 0, name: "hazard (heuristic)" }],
        },
      ],
    }),
    [hazard],
  );

  const tiles: { key: keyof Sample; label: string; unit: string; color: string; bad?: (v: number) => boolean }[] = [
    { key: "o2", label: "O2", unit: "%", color: "#FFB98A" },
    { key: "p", label: "Pressure", unit: "psi", color: "#A78BFA" },
    { key: "po2", label: "pO2", unit: "psi", color: "#FF7A2F" },
    { key: "flow", label: "Airflow", unit: "cm/s", color: "#4CC9F0", bad: (v) => v < LIMITS.flowMin },
    { key: "smoke", label: "Smoke", unit: "%/m", color: "#97A3BC", bad: (v) => v > LIMITS.smoke },
    { key: "temp", label: "Temperature", unit: "°C", color: "#FF5D6C", bad: (v) => v > LIMITS.temp },
  ];

  return (
    <section aria-label="DEMO cabin telemetry" className="space-y-3 rounded-xl border-2 border-dashed border-warn/50 bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge />
        <h2 className="font-head text-sm font-semibold uppercase tracking-wider">Cabin telemetry · simulated</h2>
        <span className="text-xs text-muted">Generated in your browser every 1.5 s. Not NASA data; never used in NASA tables or charts.</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setRunning((x) => !x)} className="rounded-md border border-line px-3 py-1 text-xs">
            {running ? "Pause feed" : "Resume feed"}
          </button>
          <button type="button" onClick={startDrill} disabled={phase !== "idle"} className="rounded-md bg-bad px-3 py-1 text-xs font-semibold text-bg disabled:opacity-50">
            {phase === "idle" ? "Run fire drill" : `Drill: ${phase}`}
          </button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map((t) => {
            const v = last ? (last[t.key] as number) : null;
            const bad = v != null && t.bad?.(v);
            return (
              <div key={t.key} className={`rounded-lg border p-2 transition-colors ${bad ? "border-bad bg-bad/15" : "border-line bg-raised"}`}>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  {t.label}
                  <DemoBadge className="scale-75" />
                </div>
                <div className={`font-mono text-lg ${bad ? "text-bad" : ""}`}>
                  {v ?? "—"} <span className="text-xs text-muted">{t.unit}</span>
                </div>
                <Spark data={samples.map((s) => s[t.key] as number)} color={t.color} />
              </div>
            );
          })}
        </div>
        <figure className="min-w-0 rounded-lg border border-line bg-raised p-2">
          <EChart option={gauge} height={150} ariaLabel="DEMO hazard gauge" />
          <figcaption className="text-center text-[10px] text-muted">DEMO hazard index from simulated O2, pressure and airflow (lib/physics.ts heuristic)</figcaption>
        </figure>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <figure className="min-w-0 rounded-lg border border-line bg-raised p-2">
          <figcaption className="text-[11px] text-muted">Last 90 seconds (DEMO)</figcaption>
          <EChart option={chart} height={180} ariaLabel="DEMO live chart of simulated temperature, smoke and airflow" />
        </figure>
        <div className="rounded-lg border border-line bg-raised p-2">
          <p className="mb-1 text-[11px] text-muted">Event ticker (DEMO)</p>
          <ul className="max-h-[180px] space-y-1 overflow-y-auto text-[11px]" aria-live="polite">
            {events.map((e) => (
              <li key={e.id} className={e.level === "bad" ? "text-bad" : e.level === "warn" ? "text-warn" : "text-muted"}>
                <span className="font-mono">{e.t}</span> {e.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[10px] text-muted">DEMO limits (smoke &gt; {LIMITS.smoke} %/m, temperature &gt; {LIMITS.temp} °C, airflow &lt; {LIMITS.flowMin} cm/s) are illustration values, not standards.</p>
    </section>
  );
}
