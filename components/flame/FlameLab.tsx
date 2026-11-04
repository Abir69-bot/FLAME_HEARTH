"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/charts/EChart";
import { IconCheck } from "@/components/ui/Icons";
import { ConfidenceTag, DemoBadge } from "@/components/vesta/Bits";
import { useVesta } from "@/components/vesta/useVesta";
import {
  UNTIMED_REPLAY_S,
  acmeEvidence,
  acmeLook,
  cfiEvidence,
  confidenceOf,
  frameAt,
  longestBurn,
  randomAcmeTest,
  replaySeconds,
  spiceEvidence,
  spiceLook,
  timelineLength,
  type Ending,
  type EvidenceStatus,
  type FlameDataset,
  type FlameType,
  type TimelineInput,
  type Verdict,
} from "@/lib/flame";
import { MISSIONS } from "@/lib/missions";
import { useHearth } from "@/lib/store";
import { rowRanges } from "@/lib/util";
import { FlameCanvas, type FlameScene } from "./FlameCanvas";

type Experiment = "acme" | "cfi" | "spice";
type GravityView = "both" | "micro" | "earth";

const EXPERIMENTS: { id: Experiment; name: string; what: string; color: string }[] = [
  { id: "acme", name: "ACME gas flame", what: "Gas fed through a small porous sphere", color: "text-acme" },
  { id: "cfi", name: "CFI fuel droplet", what: "A burning droplet of liquid fuel", color: "text-cfi" },
  { id: "spice", name: "SPICE jet flame", what: "A thin gas jet in moving air", color: "text-spice" },
];

const CHALLENGES = [
  { id: "cool", title: "Catch a cool flame", hint: "Rare: about 39% O2 and 29 psi, n-butane mix" },
  { id: "refuse", title: "Find a mix that refused to light", hint: "Diluted fuel can fail where pure fuel burns" },
  { id: "long", title: "Replay a burn over 150 seconds", hint: "Try the longest burn button" },
  { id: "void", title: "Reach a no-data zone", hint: "Push O2 far outside what was tested" },
  { id: "modes", title: "Light all three experiments", hint: "ACME, CFI and SPICE" },
] as const;
type ChallengeId = (typeof CHALLENGES)[number]["id"];

/** Droplet size on screen: the report's target of about 4 mm at the start (CFI_Report p6), shrinking as it burns. */
const DROPLET_START = 0.1;

function Slider({ id, label, unit, min, max, step, value, onChange, hint }: { id: string; label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
        <span className="flex items-center gap-1">
          <input
            type="number"
            aria-label={`${label} value`}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-[4.5rem] rounded border border-line bg-bg px-1.5 py-0.5 text-right font-mono text-xs focus:border-ember focus:outline-none"
          />
          <span className="w-9 text-[11px] text-muted">{unit}</span>
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-ember" />
      {hint && <p className="text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}

function Picker({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm focus:border-ember focus:outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex overflow-hidden rounded-md border border-line text-xs">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`flex-1 px-2.5 py-1.5 transition ${value === o.value ? "bg-ember/20 text-ember-soft" : "text-muted hover:text-text"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Where tests really happened for the current choices; click a dot to go to that test. */
function TestedMap({ points, x, y, xMax, yMax, xLabel, yLabel, onPick }: { points: { id: string; x: number; y: number; color: string; label: string }[]; x: number; y: number; xMax: number; yMax: number; xLabel: string; yLabel: string; onPick: (id: string) => void }) {
  const W = 300;
  const H = 150;
  const px = (v: number) => 28 + (Math.min(v, xMax) / xMax) * (W - 36);
  const py = (v: number) => H - 20 - (Math.min(v, yMax) / yMax) * (H - 30);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={`Tested conditions: ${points.length} real tests for this choice. Select a dot to go to that test.`}>
      <rect x={28} y={10} width={W - 36} height={H - 30} fill="#070B14" stroke="#1F2A44" />
      <text x={W / 2} y={H - 4} fill="#97A3BC" fontSize={9} textAnchor="middle">
        {xLabel}
      </text>
      <text x={8} y={H / 2} fill="#97A3BC" fontSize={9} textAnchor="middle" transform={`rotate(-90 8 ${H / 2})`}>
        {yLabel}
      </text>
      <text x={25} y={15} fill="#97A3BC" fontSize={8} textAnchor="end">
        {yMax}
      </text>
      <text x={25} y={H - 20} fill="#97A3BC" fontSize={8} textAnchor="end">
        0
      </text>
      <text x={W - 8} y={H - 11} fill="#97A3BC" fontSize={8} textAnchor="end">
        {xMax}
      </text>
      {points.map((p) => (
        <circle key={p.id} cx={px(p.x)} cy={py(p.y)} r={3} fill={p.color} fillOpacity={0.85} className="cursor-pointer transition-[r] hover:[r:5px]" tabIndex={0} role="button" aria-label={p.label} onClick={() => onPick(p.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(p.id))}>
          <title>{p.label}</title>
        </circle>
      ))}
      <g pointerEvents="none">
        <line x1={px(x)} x2={px(x)} y1={10} y2={H - 20} stroke="#FF7A2F" strokeOpacity={0.55} strokeDasharray="3 3" />
        <line x1={28} x2={W - 8} y1={py(y)} y2={py(y)} stroke="#FF7A2F" strokeOpacity={0.55} strokeDasharray="3 3" />
        <circle cx={px(x)} cy={py(y)} r={4.5} fill="none" stroke="#FF7A2F" strokeWidth={1.6} />
      </g>
    </svg>
  );
}

const STATUS_NOTE: Record<EvidenceStatus, string> = {
  supported: "5 or more real tests near these settings",
  sparse: "only 1–4 real tests near these settings",
  no_data: "no real test near these settings",
};

function shortFile(file: string): string {
  return file.split("/").pop() ?? file;
}

export function FlameLab() {
  const reduce = useReducedMotion();
  const openTest = useHearth((s) => s.openTest);
  const busy = useHearth((s) => s.busy);
  const { send } = useVesta();

  const [data, setData] = useState<FlameDataset | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [experiment, setExperiment] = useState<Experiment>("acme");
  const [gravity, setGravity] = useState<GravityView>("both");
  const [fuel, setFuel] = useState("ethane (30% in N2)");
  const [flameType, setFlameType] = useState<FlameType>("normal");
  const [o2, setO2] = useState(34);
  const [pressure, setPressure] = useState(8.2);
  const [cfiFuel, setCfiFuel] = useState("n-dodecane");
  const [helium, setHelium] = useState(0);
  const [cfiO2, setCfiO2] = useState(21);
  const [cfiP, setCfiP] = useState(14.7);
  const [spiceFuel, setSpiceFuel] = useState("propylene");
  const [nozzle, setNozzle] = useState(1.6002);
  const [coflow, setCoflow] = useState(30);
  const [rate, setRate] = useState(1);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ verdict: Verdict; finished: boolean } | null>(null);
  const [clock, setClock] = useState(0);
  const [done, setDone] = useState<Set<ChallengeId>>(new Set());
  const [litModes, setLitModes] = useState<Set<Experiment>>(new Set());
  const [pendingIgnite, setPendingIgnite] = useState(false);

  useEffect(() => {
    fetch("/api/flame")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  const acme = useMemo(() => (data ? acmeEvidence(data.acme, { fuel, type: flameType, o2, p: pressure }) : null), [data, fuel, flameType, o2, pressure]);
  const cfi = useMemo(() => (data ? cfiEvidence(data.cfi, { fuel: cfiFuel, helium, o2: cfiO2, p: cfiP }) : null), [data, cfiFuel, helium, cfiO2, cfiP]);
  const spice = useMemo(() => (data ? spiceEvidence(data.spice, { fuel: spiceFuel, nozzle, flow: coflow, rate }) : null), [data, spiceFuel, nozzle, coflow, rate]);

  const status: EvidenceStatus = (experiment === "acme" ? acme?.status : experiment === "cfi" ? cfi?.status : spice?.status) ?? "no_data";
  const verdict: Verdict = (experiment === "acme" ? acme?.verdict : experiment === "cfi" ? cfi?.verdict : spice?.verdict) ?? "no_data";
  const nearest = experiment === "acme" ? acme?.nearest : experiment === "cfi" ? cfi?.nearest : spice?.nearest;
  const evidenceRows: { row: number; file: string }[] = (experiment === "acme" ? acme?.rows : experiment === "cfi" ? cfi?.rows : spice?.rows) ?? [];

  // what the replay will play, from the real results
  const realBurn = experiment === "acme" ? (acme?.medianBurn ?? null) : null;
  const ending: Ending = acme && acme.endedFlow > acme.endedSelf ? "flow" : "self";
  const hasCool = experiment === "cfi" ? verdict === "burns" : experiment === "acme" ? (acme?.cool ?? 0) > 0 : false;
  const timeline = useMemo<TimelineInput>(() => {
    const burnS = realBurn != null ? replaySeconds(realBurn) : UNTIMED_REPLAY_S;
    return { verdict, burnS, ending: experiment === "spice" ? "flow" : ending, cool: hasCool };
  }, [verdict, realBurn, ending, hasCool, experiment]);
  const speed = realBurn != null ? Math.max(1, Math.round(realBurn / timeline.burnS)) : null;

  // the scene the flame canvases read, steered from here
  const scene = useRef<FlameScene>({ mode: 0, life: 0, size: 0.4, heat: 0.6, soot: 0.3, cool: 0, drop: DROPLET_START, fiber: 0, flow: 0, len: 0.8, spark: 0, version: 0 });
  const target = useRef({ size: 0.4, heat: 0.6, soot: 0.3, flow: 0, len: 0.8, fiber: 0 });
  const runStart = useRef<number | null>(null);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  useEffect(() => {
    const t = target.current;
    if (experiment === "acme" && acme) {
      const look = acmeLook(acme, flameType);
      t.size = look.size;
      t.heat = look.heat;
      t.soot = look.soot;
      scene.current.mode = 0;
    } else if (experiment === "cfi" && cfi) {
      t.size = 0.5;
      t.heat = 0.55;
      t.soot = 0.55;
      t.fiber = cfi.fiber >= cfi.free && cfi.fiber > 0 ? 1 : 0;
      scene.current.mode = 1;
    } else if (experiment === "spice" && data) {
      const maxRate = Math.max(0.001, ...data.spice.filter((r) => r.fuel === spiceFuel && r.nozzle === nozzle).map((r) => r.rate));
      const look = spiceLook({ flow: coflow, rate }, maxRate);
      t.len = look.length;
      t.soot = look.soot;
      t.flow = look.flow;
      t.heat = 0.6;
      scene.current.mode = 2;
    }
    scene.current.fiber = t.fiber;
    scene.current.version++;
  }, [experiment, acme, cfi, data, flameType, spiceFuel, nozzle, coflow, rate]);

  const markDone = useCallback((id: ChallengeId) => setDone((d) => (d.has(id) ? d : new Set(d).add(id))), []);

  const ignite = useCallback(() => {
    const tl = timelineRef.current;
    if (tl.verdict === "no_data") markDone("void");
    if (tl.verdict === "no_ignition") markDone("refuse");
    setLastRun({ verdict: tl.verdict, finished: tl.verdict === "no_data" });
    setClock(0);
    if (tl.verdict === "no_data") {
      setRunning(false);
      runStart.current = null;
      scene.current.life = 0;
      scene.current.cool = 0;
      scene.current.version++;
      return;
    }
    if (tl.verdict === "burns") setLitModes((m) => new Set(m).add(experiment));
    if (reduce) {
      // no animation: show the burning state as one still picture
      const f = frameAt(tl, 0.8 + tl.burnS / 2);
      Object.assign(scene.current, { life: f.life, cool: hasCool ? 0.7 : 0, spark: 0, size: target.current.size, len: target.current.len, heat: target.current.heat, soot: target.current.soot, flow: target.current.flow, version: scene.current.version + 1 });
      setRunning(false);
      setClock(1);
      setLastRun({ verdict: tl.verdict, finished: true });
      if (hasCool && experiment === "acme") markDone("cool");
      if ((acme?.medianBurn ?? 0) > 150 && experiment === "acme") markDone("long");
      return;
    }
    runStart.current = performance.now();
    setRunning(true);
  }, [experiment, reduce, hasCool, acme, markDone]);

  const stop = useCallback(() => {
    runStart.current = null;
    setRunning(false);
    scene.current.life = 0;
    scene.current.cool = 0;
    scene.current.spark = 0;
    scene.current.version++;
  }, []);

  // animate: settle slowly towards the targets, and play the timeline
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let lastClock = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = scene.current;
      const t = target.current;
      const k = 0.06;
      s.heat += (t.heat - s.heat) * k;
      s.soot += (t.soot - s.soot) * k;
      s.flow += (t.flow - s.flow) * k;
      s.len += (t.len - s.len) * k;
      let sizeK = 1;
      if (runStart.current != null) {
        const tl = timelineRef.current;
        const elapsed = (now - runStart.current) / 1000;
        const f = frameAt(tl, elapsed);
        s.life = f.life;
        s.spark = f.spark;
        s.cool = f.cool;
        sizeK = f.size;
        // CFI: the droplet shrinks all through the burn; its diameter squared falls steadily, as droplet burning does
        const total = timelineLength(tl);
        s.drop = DROPLET_START * Math.sqrt(Math.max(0.05, 1 - 0.9 * (elapsed / Math.max(total, 0.1))));
        if (now - lastClock > 90) {
          lastClock = now;
          setClock(f.progress);
        }
        if (f.done) {
          runStart.current = null;
          setRunning(false);
          setClock(1);
          setLastRun((r) => (r ? { ...r, finished: true } : r));
          const exp = scene.current.mode === 0 ? "acme" : scene.current.mode === 1 ? "cfi" : "spice";
          if (exp === "acme" && tl.cool) markDone("cool");
          if (exp === "acme" && tl.verdict === "burns" && (realBurnRef.current ?? 0) > 150) markDone("long");
        }
      } else {
        s.drop = DROPLET_START;
      }
      s.size += (t.size * sizeK - s.size) * 0.12;
      s.version++;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, markDone]);
  const realBurnRef = useRef(realBurn);
  realBurnRef.current = realBurn;

  useEffect(() => {
    if (litModes.size === 3) markDone("modes");
  }, [litModes, markDone]);

  // ignite on the render after a jump, so it plays the new settings
  useEffect(() => {
    if (!pendingIgnite) return;
    setPendingIgnite(false);
    ignite();
  }, [pendingIgnite, ignite]);

  // if a change leaves the data while burning, the flame must not keep claiming to burn
  useEffect(() => {
    if (running && verdict === "no_data") {
      stop();
      setLastRun({ verdict: "no_data", finished: true });
      markDone("void");
    }
  }, [running, verdict, stop, markDone]);

  const jumpToAcme = useCallback(
    (id: string, thenIgnite = false) => {
      const r = data?.acme.find((x) => x.id === id);
      if (!r) return;
      stop();
      setExperiment("acme");
      setFuel(r.fuel);
      setFlameType(r.type);
      setO2(Math.round(r.o2 * 10) / 10);
      setPressure(Math.round(r.p * 10) / 10);
      if (thenIgnite) setPendingIgnite(true);
    },
    [data, stop],
  );

  const chooseExperiment = (e: Experiment) => {
    stop();
    setLastRun(null);
    setClock(0);
    setExperiment(e);
  };

  const fuelsOf = useCallback(<T extends { fuel: string }>(rows: T[]) => [...new Set(rows.map((r) => r.fuel))].sort(), []);
  const acmeFuels = useMemo(() => fuelsOf((data?.acme ?? []).filter((r) => r.type === flameType)), [data, flameType, fuelsOf]);
  const cfiFuels = useMemo(() => fuelsOf(data?.cfi ?? []), [data, fuelsOf]);
  const spiceFuels = useMemo(() => fuelsOf(data?.spice ?? []), [data, fuelsOf]);
  const nozzles = useMemo(() => [...new Set((data?.spice ?? []).filter((r) => r.fuel === spiceFuel).map((r) => r.nozzle))].sort((a, b) => a - b), [data, spiceFuel]);
  const heliums = useMemo(() => [...new Set((data?.cfi ?? []).filter((r) => r.fuel === cfiFuel).map((r) => r.helium))].sort((a, b) => a - b), [data, cfiFuel]);

  // keep each choice valid when another one narrows what was tested
  useEffect(() => {
    if (acmeFuels.length && !acmeFuels.includes(fuel)) setFuel(acmeFuels[0]);
  }, [acmeFuels, fuel]);
  useEffect(() => {
    if (nozzles.length && !nozzles.includes(nozzle)) setNozzle(nozzles[0]);
  }, [nozzles, nozzle]);
  useEffect(() => {
    if (heliums.length && !heliums.includes(helium)) setHelium(heliums[0]);
  }, [heliums, helium]);

  if (loadError) return <p className="text-sm text-bad">Could not load the experiment data.</p>;
  if (!data || !acme || !cfi || !spice) return <div className="h-[520px] animate-pulse rounded-lg bg-raised" />;

  const longest = longestBurn(data.acme);
  const sourceFile = evidenceRows[0]?.file;
  const showMicro = gravity !== "earth";
  const showEarth = gravity !== "micro";
  const timerSeconds = realBurn != null && verdict === "burns" ? Math.round(realBurn * clock) : null;

  const mapProps =
    experiment === "acme"
      ? {
          points: data.acme
            .filter((r) => r.fuel === fuel && r.type === flameType)
            .map((r) => ({ id: r.id, x: r.p, y: r.o2, color: r.cool ? "#A78BFA" : r.ignition === "yes" ? "#FF7A2F" : r.ignition === "flash" ? "#FFC857" : "#97A3BC", label: `${r.id}: ${Math.round(r.o2 * 10) / 10}% O2, ${Math.round(r.p * 10) / 10} psi, ignition ${r.ignition}${r.cool ? ", cool flame" : ""}` })),
          x: pressure,
          y: o2,
          xMax: 50,
          yMax: 100,
          xLabel: "Pressure (psi)",
          yLabel: "O2 (%)",
          onPick: (id: string) => jumpToAcme(id),
        }
      : experiment === "cfi"
        ? {
            points: data.cfi
              .filter((r) => r.fuel === cfiFuel && r.helium === helium)
              .map((r) => ({ id: r.id, x: r.p, y: r.o2, color: "#A78BFA", label: `${r.id}: ${r.o2}% O2, ${Math.round(r.p * 10) / 10} psi` })),
            x: cfiP,
            y: cfiO2,
            xMax: 80,
            yMax: 30,
            xLabel: "Pressure (psi)",
            yLabel: "O2 (%)",
            onPick: (id: string) => {
              const r = data.cfi.find((x) => x.id === id);
              if (r) {
                setCfiO2(r.o2);
                setCfiP(Math.round(r.p * 10) / 10);
              }
            },
          }
        : {
            points: data.spice
              .filter((r) => r.fuel === spiceFuel && r.nozzle === nozzle)
              .map((r) => ({ id: r.id, x: r.rate, y: r.flow, color: "#5EE6A8", label: `${r.id}: ${r.rate} mg/s fuel, ${r.flow} cm/s air` })),
            x: rate,
            y: coflow,
            xMax: 4.5,
            yMax: 90,
            xLabel: "Fuel rate (mg/s)",
            yLabel: "Air (cm/s)",
            onPick: (id: string) => {
              const r = data.spice.find((x) => x.id === id);
              if (r) {
                setRate(r.rate);
                setCoflow(Math.round(r.flow));
              }
            },
          };

  const liveMessage =
    verdict === "no_data"
      ? "No NASA test near these settings, so nothing to simulate."
      : verdict === "no_ignition"
        ? "Most nearby NASA tests did not ignite."
        : verdict === "flash"
          ? "Most nearby NASA tests only flashed."
          : `${evidenceRows.length} NASA tests near these settings.`;

  return (
    <div className="space-y-4">
      <section aria-label="Experiment" className="grid gap-2 sm:grid-cols-3">
        {EXPERIMENTS.map((e) => (
          <button key={e.id} type="button" aria-pressed={experiment === e.id} onClick={() => chooseExperiment(e.id)} className={`rounded-lg border p-3 text-left transition ${experiment === e.id ? "border-ember bg-ember/10 shadow-[0_0_16px_rgba(255,122,47,0.2)]" : "border-line bg-panel hover:border-muted"}`}>
            <span className={`block font-head text-sm font-bold ${e.color}`}>{e.name}</span>
            <span className="block text-[11px] leading-tight text-muted">{e.what}</span>
          </button>
        ))}
      </section>

      <div className="space-y-4">
        <section aria-label="Flame view" className="hud-panel p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <DemoBadge />
            <span className="text-[11px] text-muted">Simulation steered by NASA results. Not a measurement.</span>
            <div className="ml-auto w-full sm:w-auto sm:min-w-[260px]">
              <Segmented<GravityView>
                label="Gravity"
                value={gravity}
                onChange={setGravity}
                options={[
                  { value: "both", label: "Side by side" },
                  { value: "micro", label: "Microgravity" },
                  { value: "earth", label: "Earth" },
                ]}
              />
            </div>
          </div>
          {failed ? (
            <p className="rounded-lg border border-warn/40 bg-warn/10 p-6 text-center text-sm text-warn">This device cannot draw the flame, but the NASA results below still apply.</p>
          ) : (
            <div className={`grid gap-2 ${showMicro && showEarth ? "grid-cols-2" : "grid-cols-1"}`}>
              {showMicro && (
                <figure className="relative h-[300px] overflow-hidden rounded-lg border border-line bg-black sm:h-[400px]">
                  <FlameCanvas earth={false} scene={scene} reduce={reduce} onFail={() => setFailed(true)} />
                  <figcaption className="pointer-events-none absolute left-2 top-2 rounded bg-bg/70 px-1.5 py-0.5 font-mono text-[10px] text-star">Microgravity</figcaption>
                </figure>
              )}
              {showEarth && (
                <figure className="relative h-[300px] overflow-hidden rounded-lg border border-line bg-black sm:h-[400px]">
                  <FlameCanvas earth scene={scene} reduce={reduce} onFail={() => setFailed(true)} />
                  <figcaption className="pointer-events-none absolute left-2 top-2 rounded bg-bg/70 px-1.5 py-0.5 font-mono text-[10px] text-ember-soft">Earth · illustration</figcaption>
                </figure>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {running ? (
              <button type="button" onClick={stop} className="btn-ghost !border-bad/60 !text-bad">
                Stop
              </button>
            ) : (
              <button type="button" onClick={ignite} className="btn-ember min-w-[110px]">
                Ignite
              </button>
            )}
            {experiment === "acme" && (
              <>
                <button type="button" className="btn-ghost" onClick={() => jumpToAcme(randomAcmeTest(data.acme)?.id ?? "", true)}>
                  Surprise me
                </button>
                {longest && (
                  <button type="button" className="btn-ghost" onClick={() => jumpToAcme(longest.id, true)}>
                    Longest burn
                  </button>
                )}
              </>
            )}
            <div className="ml-auto min-w-[130px] flex-1 sm:max-w-[260px]" aria-hidden={timerSeconds == null}>
              {timerSeconds != null && (running || clock > 0) && (
                <>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-ember-soft">T+ {timerSeconds} s</span>
                    {speed != null && speed > 1 && <span className="text-muted">replay ×{speed}</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-line">
                    <div className="h-full rounded-full bg-gradient-to-r from-ember to-ember-soft" style={{ width: `${clock * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted" role="status" aria-live="polite">
            {liveMessage}
            {lastRun?.finished && lastRun.verdict === "no_data" && " Choose a dot on the tested map to go to a real test."}
          </p>
        </section>

        <section aria-label="Controls" className="hud-panel grid gap-x-5 gap-y-3 p-3 md:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Your conditions</h2>
            {experiment === "acme" && (
              <>
                <Segmented<FlameType>
                  label="Flame type"
                  value={flameType}
                  onChange={setFlameType}
                  options={[
                    { value: "normal", label: "Fuel from burner" },
                    { value: "inverse", label: "O2 from burner" },
                  ]}
                />
                <Picker id="flame-fuel" label="Fuel" value={fuel} onChange={setFuel} options={acmeFuels.map((f) => ({ value: f, label: f }))} />
                <Slider id="flame-o2" label="Oxygen" unit="% O2" min={5} max={100} step={0.5} value={o2} onChange={setO2} />
                <Slider id="flame-p" label="Pressure" unit="psi" min={3} max={50} step={0.1} value={pressure} onChange={setPressure} />
                <div className="flex flex-wrap gap-1">
                  {MISSIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={`${m.name}: ${m.o2_pct}% O2, ${m.pressure_psi} psi`}
                      onClick={() => {
                        setO2(m.o2_pct);
                        setPressure(m.pressure_psi);
                      }}
                      className="rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] text-muted transition hover:border-ember hover:text-text"
                    >
                      {m.short}
                    </button>
                  ))}
                </div>
              </>
            )}
            {experiment === "cfi" && (
              <>
                <Picker id="flame-cfi-fuel" label="Fuel" value={cfiFuel} onChange={setCfiFuel} options={cfiFuels.map((f) => ({ value: f, label: f }))} />
                <Picker id="flame-he" label="Helium in the chamber" value={String(helium)} onChange={(v) => setHelium(Number(v))} options={heliums.map((h) => ({ value: String(h), label: h ? `${Math.round(h * 100)}% helium` : "None" }))} />
                <Slider id="flame-cfi-o2" label="Oxygen" unit="% O2" min={10} max={30} step={0.5} value={cfiO2} onChange={setCfiO2} />
                <Slider id="flame-cfi-p" label="Pressure" unit="psi" min={3} max={80} step={0.1} value={cfiP} onChange={setCfiP} />
              </>
            )}
            {experiment === "spice" && (
              <>
                <Picker id="flame-spice-fuel" label="Fuel" value={spiceFuel} onChange={setSpiceFuel} options={spiceFuels.map((f) => ({ value: f, label: f }))} />
                <Picker id="flame-nozzle" label="Nozzle" value={String(nozzle)} onChange={(v) => setNozzle(Number(v))} options={nozzles.map((n) => ({ value: String(n), label: `${n} mm` }))} />
                <Slider id="flame-rate" label="Fuel rate" unit="mg/s" min={0.05} max={4.5} step={0.01} value={rate} onChange={setRate} />
                <Slider id="flame-flow" label="Air speed" unit="cm/s" min={0} max={90} step={1} value={coflow} onChange={setCoflow} />
                <p className="text-[10px] leading-tight text-muted">SPICE ran only in cabin air (21% O2, 101 kPa, SPICE_Report p20), so oxygen and pressure are fixed here.</p>
              </>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Where real tests happened</h2>
            <p className="mb-1 text-[11px] text-muted">{experiment === "acme" ? "Orange lit, grey did not, yellow flashed, violet cool flame. Select a dot to go to it." : "Each dot is a real test. Select one to go to it."}</p>
            <TestedMap {...mapProps} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-label="What NASA measured" className="hud-panel p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">What NASA recorded here</h2>
            <ConfidenceTag value={confidenceOf(status)} note={STATUS_NOTE[status]} />
          </div>

          {experiment === "acme" && acme.rows.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Ignited" value={`${acme.ignited} of ${acme.rows.length}`} />
              {acme.flashed > 0 && <Stat label="Only flashed" value={`${acme.flashed}`} />}
              {acme.failed > 0 && <Stat label="Did not ignite" value={`${acme.failed}`} />}
              {acme.medianBurn != null && <Stat label="Median burn time" value={`${acme.medianBurn} s`} sub={acme.burnRange ? `${acme.burnRange[0]}–${acme.burnRange[1]} s` : undefined} />}
              {acme.medianTad != null && <Stat label="Flame temperature*" value={`${Math.round(acme.medianTad)} K`} />}
              {acme.endedSelf + acme.endedFlow > 0 && <Stat label="How it ended" value={`${acme.endedSelf} went out alone`} sub={`${acme.endedFlow} gas shut off`} />}
              <Stat label="Cool flames" value={`${acme.cool}`} accent={acme.cool > 0} />
            </dl>
          )}
          {experiment === "acme" && acme.rows.length > 0 && <p className="mt-2 text-[10px] text-muted">*Calculated adiabatic flame temperature from the experiment table (Tad). Medians of the {acme.rows.length} tests with this fuel and flame type within ±5 points O2 and ±2.5 psi.</p>}

          {experiment === "cfi" && cfi.rows.length > 0 && (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Droplet burns near here" value={`${cfi.rows.length}`} />
                <Stat label="On a fibre" value={`${cfi.fiber}`} />
                <Stat label="Free-floating" value={`${cfi.free}`} />
              </dl>
              <p className="mt-2 text-xs text-muted">The CFI table lists test conditions, not results, so the replay has no timer. Its sequence comes from the report: the hot flame goes out from radiative heat loss, then a cool flame keeps burning (CFI_Report p5–p6).</p>
            </>
          )}

          {experiment === "spice" && spice.rows.length > 0 && (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Settings near here" value={`${spice.rows.length}`} />
                {spice.rateRange && <Stat label="Fuel rates tested" value={`${spice.rateRange[0]}–${spice.rateRange[1]}`} sub="mg/s at this air speed" />}
              </dl>
              <p className="mt-2 text-xs text-muted">The table does not mark which setting reached the smoke point, so the soot on screen only grows with fuel rate and is not a measured limit. Trends from the report: more co-flowing air shortens the flame (SPICE_Report p2).</p>
            </>
          )}

          {status === "no_data" && (
            <div className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm">
              <p className="font-semibold text-bad">Data gap: no NASA test here, so no flame.</p>
              <p className="mt-1 text-xs text-muted">
                {experiment === "acme" &&
                  `A spherical-flame run with ${fuel} at ${o2}% O2 and ${pressure} psi would fill this gap.${acme.otherHere > 0 ? ` ${acme.otherHere} tests at these conditions used another fuel or flame type.` : ""}`}
                {experiment === "cfi" && `A droplet run with ${cfiFuel} at ${cfiO2}% O2 and ${cfiP} psi would fill this gap.`}
                {experiment === "spice" && `A jet-flame run with ${spiceFuel} through the ${nozzle} mm nozzle at ${rate} mg/s and ${coflow} cm/s air would fill this gap.`}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[11px] text-muted">
            {sourceFile && (
              <span className="font-mono">
                {shortFile(sourceFile)} · rows {rowRanges(evidenceRows.slice(0, 40).map((r) => r.row)).slice(0, 44)}
                {evidenceRows.length > 40 ? "…" : ""}
              </span>
            )}
            {nearest && (
              <button type="button" onClick={() => openTest(nearest.id)} className="rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[10px] transition hover:border-ember hover:text-text">
                Closest test: {nearest.id}
              </button>
            )}
            {nearest && (
              <button type="button" disabled={busy} onClick={() => send(`Explain test ${nearest.id}`)} className="rounded border border-ember/50 px-1.5 py-0.5 text-[10px] text-ember-soft transition hover:border-ember disabled:opacity-50">
                Ask VESTA about it
              </button>
            )}
          </div>
        </section>

        <section aria-label="Challenges" className="hud-panel p-4">
          <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">
            Challenges <span className="font-mono text-ember-soft">{done.size}/{CHALLENGES.length}</span>
          </h2>
          <ul className="space-y-1.5">
            {CHALLENGES.map((c) => {
              const got = done.has(c.id);
              return (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${got ? "border-ok bg-ok/15 text-ok" : "border-line"}`}>{got && <IconCheck className="h-3 w-3" />}<span className="sr-only">{got ? "Done:" : "To do:"}</span></span>
                  <span>
                    <span className={got ? "text-ok" : ""}>{c.title}</span>
                    <span className="block text-[11px] leading-tight text-muted">{c.hint}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section aria-label="How this works" className="hud-panel p-4 text-xs text-muted">
        <h2 className="mb-1 font-head text-sm font-semibold uppercase tracking-wider">How much of this is real?</h2>
        <p>
          <b className="text-text">Real:</b> every number and the choice of what happens (ignites, flashes, fails, how long it burns, how it ends, cool flames) comes from the NASA rows named above.{" "}
          <b className="text-text">Artwork:</b> the flame&apos;s picture and motion. It is not a combustion model and does not predict anything. In ACME mode its colour follows the table&apos;s flame temperature and its size follows the table&apos;s stoichiometric mixture fraction (Zst).{" "}
          <b className="text-text">Why the two flames differ:</b> on Earth hot gas rises, stretching a flame into a flickering teardrop and feeding it with fresh air. In microgravity nothing rises, so the same flame stays round, still and dimmer, fed only by slow diffusion. These tests all ran in microgravity, so the Earth view is an illustration with no test data or numbers, shows no cool flames, and does not say whether a mix would ignite on Earth. There are no Moon or Mars gravity tests in this data, so there is no slider for them.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-raised p-2">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className={`font-mono text-sm ${accent ? "text-cfi" : ""}`}>{value}</dd>
      {sub && <dd className="font-mono text-[10px] text-muted">{sub}</dd>}
    </div>
  );
}
