"use client";
import { useEffect, useState } from "react";
import { getMission } from "@/lib/missions";
import { useHearth } from "@/lib/store";
import { CountUp } from "@/components/ui/CountUp";

interface Calc {
  po2: { value: number };
  ratio_to_iss: { value: number };
  o2_vs_earth: { value: number };
  envelope: { status: "supported" | "sparse" | "no_data"; count: number };
}

const PILL: Record<Calc["envelope"]["status"], string> = {
  supported: "border-ok/50 bg-ok/10 text-ok",
  sparse: "border-warn/50 bg-warn/10 text-warn",
  no_data: "border-bad/50 bg-bad/10 text-bad",
};

/** Meter scales: sea-level pressure and the ISS reference pO2 from the reference atmospheres; pO2 scale just fits every mission. */
const SEA_LEVEL_PSI = 14.7;
const ISS_PO2_PSI = 3.087;
const PO2_SCALE_PSI = 5;

interface MeterScale {
  max: number;
  tick?: number;
  title: string;
}

interface Tile {
  label: string;
  value: number;
  unit: string;
  meter?: MeterScale;
}

function Meter({ value, max, tick, title }: MeterScale & { value: number }) {
  return (
    <div className="relative mt-2 h-1 rounded-full bg-line" title={title} aria-hidden>
      <div className="h-full rounded-full bg-gradient-to-r from-ember to-ember-soft shadow-[0_0_8px_rgba(255,122,47,0.7)] transition-[width] duration-700" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      {tick != null && <span className="absolute -top-0.5 h-2 w-px bg-star" style={{ left: `${(tick / max) * 100}%` }} />}
    </div>
  );
}

/** Active mission with its envelope status; numbers come from POST /api/calc. */
export function MissionHeader() {
  const missionId = useHearth((s) => s.missionId);
  const m = getMission(missionId);
  const [calc, setCalc] = useState<Calc | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!m) return;
    let alive = true;
    setErr(false);
    fetch("/api/calc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ o2_pct: m.o2_pct, pressure_psi: m.pressure_psi }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setCalc(j))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [m]);

  if (!m) return null;
  const tiles: Tile[] = calc
    ? [
        { label: "O2", value: m.o2_pct, unit: "%", meter: { max: 100, title: "Scale: 0 to 100% O2" } },
        { label: "Pressure", value: m.pressure_psi, unit: "psi", meter: { max: SEA_LEVEL_PSI, title: `Scale: 0 to ${SEA_LEVEL_PSI} psi (sea level)` } },
        { label: "pO2", value: calc.po2.value, unit: "psi", meter: { max: PO2_SCALE_PSI, tick: ISS_PO2_PSI, title: `Scale: 0 to ${PO2_SCALE_PSI} psi. Tick: ISS reference, ${ISS_PO2_PSI} psi` } },
        { label: "vs ISS pO2", value: calc.ratio_to_iss.value, unit: "×" },
        { label: "O2 vs Earth", value: calc.o2_vs_earth.value, unit: "×" },
        { label: "Tests in envelope", value: calc.envelope.count, unit: "" },
      ]
    : [];
  return (
    <section aria-label="Active mission" className="hud-panel animate-fadeUp p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember-soft">Active mission</span>
        <h2 className="basis-full font-head text-lg font-semibold sm:basis-auto">{m.name}</h2>
        {m.demo && <span className="rounded border border-warn/60 px-1.5 text-[10px] uppercase text-warn">demo scenario</span>}
        {calc && (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PILL[calc.envelope.status]}`}>
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inset-0 animate-pulseRing rounded-full bg-current" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            envelope: {calc.envelope.status.replace("_", " ")}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">{m.description} Gravity: {m.gravity}. Reference: {m.reference}.</p>
      {err && <p className="mt-3 text-sm text-bad">Could not load mission numbers.</p>}
      {/* the key replays the tile entrance and light sweep whenever the mission changes */}
      <dl key={calc ? m.id : "loading"} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {calc
          ? tiles.map((tile, i) => (
              <div key={tile.label} style={{ animationDelay: `${i * 55}ms` }} className="kpi-tile animate-fadeUp rounded-lg border border-line bg-raised p-3">
                <dt className="text-[11px] text-muted">{tile.label}</dt>
                <dd className="font-mono text-xl">
                  <CountUp value={tile.value} />
                  <span className="ml-1 text-xs text-muted">{tile.unit}</span>
                </dd>
                {tile.meter && <Meter value={tile.value} {...tile.meter} />}
              </div>
            ))
          : Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded-lg border border-line bg-raised p-3">
                <div className="h-10 animate-pulse rounded bg-line/50" />
              </div>
            ))}
      </dl>
      <p className="mt-2 font-mono text-[10px] text-muted">pO2 = (O2% / 100) × pressure · lib/physics.ts · envelope = NASA tests within ±5 pp O2 and ±2.5 psi</p>
    </section>
  );
}
