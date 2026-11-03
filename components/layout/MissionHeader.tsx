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
  const tiles: [string, string, string][] = calc
    ? [
        ["O2", `${m.o2_pct}`, "%"],
        ["Pressure", `${m.pressure_psi}`, "psi"],
        ["pO2", `${calc.po2.value}`, "psi"],
        ["vs ISS pO2", `${calc.ratio_to_iss.value}`, "×"],
        ["O2 vs Earth", `${calc.o2_vs_earth.value}`, "×"],
        ["Tests in envelope", `${calc.envelope.count}`, ""],
      ]
    : [];
  return (
    <section aria-label="Active mission" className="animate-fadeUp rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-head text-lg font-semibold">{m.name}</h2>
        {m.demo && <span className="rounded border border-warn/60 px-1.5 text-[10px] uppercase text-warn">demo scenario</span>}
        {calc && <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PILL[calc.envelope.status]}`}>envelope: {calc.envelope.status.replace("_", " ")}</span>}
      </div>
      <p className="mt-0.5 text-xs text-muted">{m.description} Gravity: {m.gravity}. Reference: {m.reference}.</p>
      {err && <p className="mt-3 text-sm text-bad">Could not load mission numbers.</p>}
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(calc ? tiles : Array.from({ length: 6 }, () => ["", "", ""] as [string, string, string])).map(([label, value, unit], i) => (
          <div key={i} className="rounded-lg border border-line bg-raised p-3">
            {calc ? (
              <>
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="font-mono text-xl">
                  <CountUp value={Number(value)} />
                  <span className="ml-1 text-xs text-muted">{unit}</span>
                </dd>
              </>
            ) : (
              <div className="h-10 animate-pulse rounded bg-line/50" />
            )}
          </div>
        ))}
      </dl>
      <p className="mt-2 font-mono text-[10px] text-muted">pO2 = (O2% / 100) × pressure · lib/physics.ts · envelope = NASA tests within ±5 pp O2 and ±2.5 psi</p>
    </section>
  );
}
