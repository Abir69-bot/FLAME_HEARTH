"use client";
import { useMemo, useState, type ReactNode } from "react";
import { EChart } from "@/components/charts/EChart";
import { describeCorrelation, endingsByO2, ignitionByFuel, spearman, type InsightAcme, type InsightsData } from "@/lib/insights";
import { useHearth } from "@/lib/store";

const PALETTE = ["#4cc9f0", "#ffc857", "#a78bfa", "#5ee6a8", "#ff7a2f", "#ff5d6c", "#cfe6ff"];
const TOOLTIP = { backgroundColor: "#131B2E", borderColor: "#1F2A44", textStyle: { color: "#E8ECF6", fontSize: 12 } };
const AXIS = { axisLabel: { color: "#97A3BC" }, splitLine: { lineStyle: { color: "#1F2A44" } }, axisLine: { lineStyle: { color: "#1F2A44" } }, nameTextStyle: { color: "#97A3BC" } };
const LEGEND = { top: 0, right: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: "#97A3BC", fontSize: 11 } };

type Point = { value: [number, number]; id: string; label: string };
type ClickParams = { data?: { id?: string } };

const colorFor = (keys: string[]) => Object.fromEntries(keys.map((k, i) => [k, PALETTE[i % PALETTE.length]]));
const short = (file: string) => file.split("/").pop() ?? file;

function Panel({ id, eyebrow, title, intro, controls, children, limits, source }: { id: string; eyebrow: string; title: string; intro: ReactNode; controls?: ReactNode; children: ReactNode; limits: ReactNode; source: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="hud-panel scroll-mt-44 space-y-3 p-4 vesta:scroll-mt-28">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember-soft">{eyebrow}</p>
        <h2 id={`${id}-title`} className="font-head text-lg font-semibold tracking-wide">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{intro}</p>
      </header>
      {controls && <div className="flex flex-wrap items-end gap-3">{controls}</div>}
      {children}
      <div className="grid gap-2 border-t border-line pt-3 text-xs text-muted sm:grid-cols-[1fr_auto]">
        <p>
          <span className="font-semibold text-warn">Limits: </span>
          {limits}
        </p>
        <p className="font-mono text-[10px] sm:text-right">Source: {source}</p>
      </div>
    </section>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[11px] text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${value === v ? "border-ember bg-ember/15 text-ember-soft" : "border-line bg-bg text-muted hover:border-muted hover:text-text"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Pattern({ pairs, x, y }: { pairs: [number, number][]; x: string; y: string }) {
  const rho = spearman(pairs);
  return (
    <p className="rounded-md border border-line bg-bg px-3 py-2 text-xs text-muted">
      <span className="text-text">{pairs.length}</span> tests · {x} and {y}: <span className="text-text">{describeCorrelation(rho)}</span>
      {rho != null && <span className="font-mono"> (Spearman ρ = {rho})</span>}. A pattern in recorded tests, not a cause and not a prediction.
    </p>
  );
}

function scatter(name: string, data: Point[], color: string, symbol = "circle", size = 8) {
  return { name, type: "scatter", data, symbol, symbolSize: size, itemStyle: { color, opacity: 0.85, borderColor: "#070b14", borderWidth: 0.5 }, emphasis: { scale: 1.6 } };
}

const pointTip = (unitX: string, unitY: string) => ({
  ...TOOLTIP,
  trigger: "item",
  formatter: (p: { seriesName: string; data: Point }) => `<b>${p.data.label}</b><br/>${p.seriesName}<br/>${p.data.value[0]} ${unitX} · ${p.data.value[1]} ${unitY}<br/><span style="color:#97A3BC">click to open the test</span>`,
});

// ------------------------------------------------------------------ 1. ignition map
function IgnitionMap({ rows, onOpen }: { rows: InsightAcme[]; onOpen: (id: string) => void }) {
  const fuels = useMemo(() => [...new Set(rows.map((r) => r.base))].sort(), [rows]);
  const [fuel, setFuel] = useState("all");
  const [type, setType] = useState<"all" | "normal" | "inverse">("all");
  const shown = rows.filter((r) => (fuel === "all" || r.base === fuel) && (type === "all" || r.type === type));
  const by = (k: InsightAcme["ignition"]) => shown.filter((r) => r.ignition === k).map((r) => ({ value: [r.p, r.o2] as [number, number], id: r.id, label: `${r.id} · ${r.fuel}, ${r.type}` }));
  const option = {
    backgroundColor: "transparent",
    grid: { left: 8, right: 16, top: 34, bottom: 28, containLabel: true },
    legend: LEGEND,
    tooltip: pointTip("psi", "% O2"),
    xAxis: { ...AXIS, type: "value", name: "Pressure (psi)", nameLocation: "middle", nameGap: 26, scale: true },
    yAxis: { ...AXIS, type: "value", name: "O2 %", scale: true },
    series: [scatter("Ignited", by("yes"), "#ff7a2f", "circle", 9), scatter("Flash only", by("flash"), "#ffc857", "diamond", 11), scatter("Did not ignite", by("no"), "#97a3bc", "emptyCircle", 9)],
  };
  const counts = ignitionByFuel(shown);
  return (
    <Panel
      id="ignition"
      eyebrow="ACME · where flames lit"
      title="Ignition map"
      intro="Every ACME test by pressure and oxygen, marked by whether the flame lit. Shape and colour both show the outcome."
      controls={
        <>
          <Segmented label="Fuel" value={fuel} options={[["all", "All"], ...fuels.map((f): [string, string] => [f, f])]} onChange={setFuel} />
          <Segmented label="Flame type" value={type} options={[["all", "All"], ["normal", "Normal"], ["inverse", "Inverse"]]} onChange={setType} />
        </>
      }
      limits="Inverse flames show the O2 of the oxidizer stream, not the chamber. Gas flames only; no cabin materials were tested. All tests ran in microgravity."
      source="ACME_Experimental_Table.csv, Hot ignition column"
    >
      <EChart option={option} height={340} ariaLabel="Scatter of ACME tests by pressure and oxygen, coloured by ignition outcome" onEvents={{ click: (p) => (p as ClickParams).data?.id && onOpen((p as ClickParams).data!.id!) }} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-xs">
          <caption className="sr-only">Ignition outcome counts per fuel for the current filter</caption>
          <thead className="text-muted">
            <tr>
              <th className="py-1 text-left font-normal">Fuel</th>
              <th className="text-right font-normal">Ignited</th>
              <th className="text-right font-normal">Flash</th>
              <th className="text-right font-normal">Did not ignite</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {counts.map((c) => (
              <tr key={c.fuel} className="border-t border-line">
                <td className="py-1 font-sans">{c.fuel}</td>
                <td className="text-right">{c.yes}</td>
                <td className="text-right">{c.flash}</td>
                <td className="text-right">{c.no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 2. burn time
const BURN_X = {
  o2: { label: "O2 %", unit: "% O2", get: (r: InsightAcme) => r.o2 },
  p: { label: "Pressure (psi)", unit: "psi", get: (r: InsightAcme) => r.p },
  tad: { label: "Adiabatic flame temperature (K)", unit: "K", get: (r: InsightAcme) => r.tad },
  zst: { label: "Stoichiometric mixture fraction", unit: "", get: (r: InsightAcme) => r.zst },
} as const;
type BurnX = keyof typeof BURN_X;

function BurnTime({ rows, onOpen }: { rows: InsightAcme[]; onOpen: (id: string) => void }) {
  const [x, setX] = useState<BurnX>("o2");
  const lit = rows.filter((r) => r.ignition !== "no" && r.burn != null && r.burn > 0);
  const fuels = [...new Set(lit.map((r) => r.base))].sort();
  const colors = colorFor(fuels);
  const def = BURN_X[x];
  const pts = lit.filter((r) => def.get(r) != null);
  const option = {
    backgroundColor: "transparent",
    grid: { left: 8, right: 16, top: 34, bottom: 28, containLabel: true },
    legend: LEGEND,
    tooltip: pointTip(def.unit, "s"),
    xAxis: { ...AXIS, type: "value", name: def.label, nameLocation: "middle", nameGap: 26, scale: true },
    yAxis: { ...AXIS, type: "value", name: "Burn time (s)" },
    series: fuels.map((f) => scatter(f, pts.filter((r) => r.base === f).map((r) => ({ value: [def.get(r)!, r.burn!] as [number, number], id: r.id, label: `${r.id} · ${r.fuel}` })), colors[f])),
  };
  return (
    <Panel
      id="burn"
      eyebrow="ACME · how long flames lasted"
      title="Burn time explorer"
      intro="How long each flame that lit kept burning, against the condition you pick."
      controls={<Segmented label="Compare burn time with" value={x} options={[["o2", "Oxygen"], ["p", "Pressure"], ["tad", "Flame temperature"], ["zst", "Mixture fraction"]]} onChange={setX} />}
      limits="Burn time also depends on when the crew cut the gas flow, so a short burn is not always a weak flame (see How flames ended). Flame temperature and mixture fraction are calculated values from the ACME report, not measurements."
      source="ACME_Experimental_Table.csv, burn time, Tad and Zst columns"
    >
      <EChart option={option} height={320} ariaLabel={`Scatter of burn time against ${def.label}`} onEvents={{ click: (p) => (p as ClickParams).data?.id && onOpen((p as ClickParams).data!.id!) }} />
      <Pattern pairs={pts.map((r) => [def.get(r)!, r.burn!])} x={def.label.toLowerCase()} y="burn time" />
    </Panel>
  );
}

// ------------------------------------------------------------------ 3. endings
function Endings({ rows }: { rows: InsightAcme[] }) {
  const e = endingsByO2(rows);
  const option = {
    backgroundColor: "transparent",
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    legend: LEGEND,
    tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.05)" } } },
    xAxis: { ...AXIS, type: "category", data: e.map((b) => b.band), name: "Chamber or oxidizer O2", nameLocation: "middle", nameGap: 28 },
    yAxis: { ...AXIS, type: "value", name: "Flames" },
    series: [
      { name: "Went out by itself", type: "bar", stack: "end", data: e.map((b) => b.self), itemStyle: { color: "#5ee6a8" }, barMaxWidth: 48 },
      { name: "Gas flow cut", type: "bar", stack: "end", data: e.map((b) => b.flow), itemStyle: { color: "#ff7a2f" }, barMaxWidth: 48 },
      { name: "Not recorded", type: "bar", stack: "end", data: e.map((b) => b.unknown), itemStyle: { color: "#97a3bc" }, barMaxWidth: 48 },
    ],
  };
  return (
    <Panel
      id="endings"
      eyebrow="ACME · how flames ended"
      title="Did the flame go out by itself?"
      intro="Flames that lit, grouped by oxygen. Green ones went out on their own in the still chamber; orange ones were still burning when the gas flow was cut."
      limits="“Gas flow cut” is a test procedure, not a property of the flame: those flames might have kept burning. Nothing here tells you how to put out a cabin fire made of other materials."
      source="ACME_Experimental_Table.csv, Self-ext or flow term column"
    >
      <EChart option={option} height={280} ariaLabel="Stacked bars of how ACME flames ended, by oxygen band" />
      <ul className="grid gap-2 text-xs sm:grid-cols-4">
        {e.map((b) => {
          const total = b.self + b.flow + b.unknown;
          return (
            <li key={b.band} className="rounded-md border border-line bg-bg px-3 py-2">
              <span className="block text-muted">{b.band}</span>
              <span className="font-mono text-text">{total ? Math.round((b.flow / total) * 100) : 0}%</span> <span className="text-muted">still burning at flow cut</span>
              <span className="block font-mono text-[10px] text-muted">{total} flames</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4. chamber effects
function Chamber({ rows, onOpen }: { rows: InsightAcme[]; onOpen: (id: string) => void }) {
  const [metric, setMetric] = useState<"o2Drop" | "peak">("o2Drop");
  const isDrop = metric === "o2Drop";
  const pts = rows.filter((r) => r.burn != null && r[metric] != null);
  const fuels = [...new Set(pts.map((r) => r.base))].sort();
  const colors = colorFor(fuels);
  const yName = isDrop ? "O2 used (percentage points)" : "Peak burner temperature (°C)";
  const option = {
    backgroundColor: "transparent",
    grid: { left: 8, right: 16, top: 34, bottom: 28, containLabel: true },
    legend: LEGEND,
    tooltip: pointTip("s", isDrop ? "pp O2" : "°C"),
    xAxis: { ...AXIS, type: "value", name: "Burn time (s)", nameLocation: "middle", nameGap: 26 },
    yAxis: { ...AXIS, type: "value", name: yName, scale: !isDrop },
    series: fuels.map((f) => scatter(f, pts.filter((r) => r.base === f).map((r) => ({ value: [r.burn!, r[metric]!] as [number, number], id: r.id, label: `${r.id} · ${r.fuel}` })), colors[f])),
  };
  return (
    <Panel
      id="chamber"
      eyebrow="ACME · what a burn does to the chamber"
      title={isDrop ? "Oxygen used per test" : "Burner heat"}
      intro={
        isDrop
          ? "How much the chamber's oxygen fell during each normal-flame test (O2 before minus after). In a closed cabin, a fire uses up the oxygen around it."
          : "The hottest the burner got in each test. A hint at how much heat a small flame can put into the hardware next to it."
      }
      controls={<Segmented label="Show" value={metric} options={[["o2Drop", "Oxygen used"], ["peak", "Burner heat"]]} onChange={setMetric} />}
      limits={
        isDrop
          ? "Normal flames only: inverse rows store fuel fractions in these columns. The chamber was large and sealed, so the drop per test is small; a smaller cabin would see a bigger change."
          : "Burner temperature, not flame or cabin temperature. Some tests have no recorded value."
      }
      source={isDrop ? "ACME_Experimental_Table.csv, XO2 before / after test" : "ACME_Experimental_Table.csv, Peak burner T (C)"}
    >
      <EChart option={option} height={320} ariaLabel={`Scatter of ${yName} against burn time`} onEvents={{ click: (p) => (p as ClickParams).data?.id && onOpen((p as ClickParams).data!.id!) }} />
      <Pattern pairs={pts.map((r) => [r.burn!, r[metric]!])} x="burn time" y={isDrop ? "oxygen used" : "burner heat"} />
    </Panel>
  );
}

// ------------------------------------------------------------------ 5. CFI matrix
function CfiMatrix({ data }: { data: InsightsData }) {
  const cell = (fuel: string, p: number) => data.cfiCells.find((c) => c.fuel === fuel && c.pressure === p);
  const max = Math.max(...data.cfiCells.map((c) => c.count));
  return (
    <Panel
      id="cfi"
      eyebrow="CFI · what was tried"
      title="Droplet test matrix"
      intro="Every fuel and pressure the CFI droplet burns used. Empty boxes are combinations nobody tested: candidates for the next experiment."
      limits="The CFI table lists conditions only, not results, so this shows coverage, not how the droplets burned. Pressures are rounded to 0.1 psi."
      source="CFI_Experimental_Table.csv"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
          <caption className="sr-only">CFI droplet tests per fuel and pressure, with helium levels and fibre use</caption>
          <thead>
            <tr>
              <th scope="col" className="text-left font-normal text-muted">
                Fuel \ pressure (psi)
              </th>
              {data.cfiPressures.map((p) => (
                <th key={p} scope="col" className="font-mono font-normal text-muted">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cfiFuels.map((f) => (
              <tr key={f}>
                <th scope="row" className="pr-2 text-left font-normal">
                  {f}
                </th>
                {data.cfiPressures.map((p) => {
                  const c = cell(f, p);
                  if (!c)
                    return (
                      <td key={p} className="rounded border border-dashed border-line px-2 py-2 text-center text-[10px] text-muted/70">
                        not tested
                      </td>
                    );
                  const he = c.helium.filter((h) => h > 0);
                  return (
                    <td key={p} className="rounded border border-cfi/40 px-2 py-1.5 text-center" style={{ background: `rgba(167,139,250,${0.08 + 0.32 * (c.count / max)})` }}>
                      <span className="block font-mono text-sm text-text">{c.count}</span>
                      <span className="block text-[10px] text-muted">{c.o2.join(", ")}% O2</span>
                      {he.length > 0 && <span className="block text-[10px] text-cfi">+He {he.map((h) => `${Math.round(h * 100)}%`).join(", ")}</span>}
                      {(c.fiber > 0 || c.free > 0) && (
                        <span className="block text-[10px] text-muted">
                          {c.fiber} fibre · {c.free} free
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 6. SPICE coverage
function SpiceCoverage({ data, onOpen }: { data: InsightsData; onOpen: (id: string) => void }) {
  const nozzles = useMemo(() => [...new Set(data.spice.map((r) => r.nozzle))].sort((a, b) => a - b), [data.spice]);
  const [nozzle, setNozzle] = useState("all");
  const rows = data.spice.filter((r) => nozzle === "all" || String(r.nozzle) === nozzle);
  const fuels = [...new Set(data.spice.map((r) => r.fuel))].sort();
  const colors = colorFor(fuels);
  const option = {
    backgroundColor: "transparent",
    grid: { left: 8, right: 16, top: 34, bottom: 28, containLabel: true },
    legend: { ...LEGEND, type: "scroll" },
    tooltip: pointTip("cm/s", "mg/s"),
    xAxis: { ...AXIS, type: "value", name: "Co-flow air speed (cm/s)", nameLocation: "middle", nameGap: 26 },
    yAxis: { ...AXIS, type: "value", name: "Fuel rate (mg/s)" },
    series: fuels.map((f) => scatter(f, rows.filter((r) => r.fuel === f).map((r) => ({ value: [r.flow, r.rate] as [number, number], id: r.id, label: `${r.id} · ${r.nozzle} mm nozzle` })), colors[f], "circle", 7)),
  };
  return (
    <Panel
      id="spice"
      eyebrow="SPICE · air and fuel flow"
      title="Smoke-point flow coverage"
      intro="Which fuel rates and air speeds SPICE tried, per nozzle. Moving air is what carries smoke to a detector, so this is the map of flow conditions with real data behind them."
      controls={<Segmented label="Nozzle" value={nozzle} options={[["all", "All"], ...nozzles.map((n): [string, string] => [String(n), `${n} mm`])]} onChange={setNozzle} />}
      limits={`The SPICE table does not say which setting reached the smoke point, so this is coverage, not results. ${data.totals.spiceLeftOut} settings with no air speed, a failed range check or no fuel flow are left out. All at the documented 21% O2 and 101 kPa.`}
      source="SPICE_Experimental_Table.csv, Air Rate and HC Fuel Rate columns"
    >
      <EChart option={option} height={320} ariaLabel="Scatter of SPICE settings by air speed and fuel rate" onEvents={{ click: (p) => (p as ClickParams).data?.id && onOpen((p as ClickParams).data!.id!) }} />
    </Panel>
  );
}

const SECTIONS: [string, string][] = [
  ["ignition", "Ignition"],
  ["burn", "Burn time"],
  ["endings", "Endings"],
  ["chamber", "Chamber"],
  ["cfi", "CFI matrix"],
  ["spice", "SPICE flow"],
];

export function InsightsView({ data }: { data: InsightsData }) {
  const openTest = useHearth((s) => s.openTest);
  const t = data.totals;
  const coolAt = [...new Set(data.acme.filter((r) => r.cool).map((r) => Math.round(r.p * 10) / 10))].sort((a, b) => a - b);
  const tiles: [number, string, string][] = [
    [t.ignited, "flames lit", `of ${t.acme} ACME tests`],
    [t.flash, "flash only", "lit, then went out at once"],
    [t.noIgnition, "did not light", "same hardware, no flame"],
    [t.selfExtinguished, "went out by themselves", "in still air"],
    [t.flowTerminated, "stopped by cutting gas", "test procedure"],
    [t.coolFlames, "cool flames", coolAt.length ? `at ${coolAt.join(", ")} psi` : "none recorded"],
  ];
  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([n, label, sub]) => (
          <li key={label} className="hud-panel p-3">
            <span className="block font-mono text-2xl text-text">{n}</span>
            <span className="block text-sm">{label}</span>
            <span className="block text-[11px] text-muted">{sub}</span>
          </li>
        ))}
      </ul>
      <nav aria-label="Insights sections" className="sticky top-[49px] z-20 -mx-1 flex gap-1 overflow-x-auto bg-bg/90 px-1 py-2 backdrop-blur-none">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted hover:border-ember hover:text-text">
            {label}
          </a>
        ))}
      </nav>
      <IgnitionMap rows={data.acme} onOpen={openTest} />
      <BurnTime rows={data.acme} onOpen={openTest} />
      <Endings rows={data.acme} />
      <Chamber rows={data.acme} onOpen={openTest} />
      <CfiMatrix data={data} />
      <SpiceCoverage data={data} onOpen={openTest} />
      <p className="text-xs text-muted">
        Click any point to open that test with its source row. Raw files: {[...new Set(data.acme.map((r) => short(r.file)))].join(", ")}, CFI_Experimental_Table.csv, SPICE_Experimental_Table.csv.
      </p>
    </div>
  );
}
