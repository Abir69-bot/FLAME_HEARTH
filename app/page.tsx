import { HabitatMap } from "@/components/charts/HabitatMap";
import { RankBars } from "@/components/charts/RankBars";
import { MissionHeader } from "@/components/layout/MissionHeader";
import { Logo } from "@/components/ui/Logo";
import { PinnedCharts } from "@/components/vesta/PinnedCharts";

export default function Overview() {
  return (
    <div className="space-y-5">
      <section className="flex animate-fadeUp flex-wrap items-center gap-4">
        <div className="animate-flicker">
          <Logo size={52} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember-soft">Habitat Environment Analysis &amp; Risk Tracking Hub</p>
          <h1 className="font-head text-2xl font-bold tracking-wide sm:text-3xl">Fire-safety intelligence for crewed habitats</h1>
          <p className="text-sm text-muted">NASA microgravity combustion data from ACME, CFI and SPICE, read by VESTA, your AI crewmate.</p>
        </div>
      </section>
      <MissionHeader />
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Habitat relevance map" className="animate-fadeUp rounded-xl border border-line bg-panel p-4">
          <h2 className="font-head text-sm font-semibold uppercase tracking-wider text-muted">Habitat relevance map</h2>
          <p className="mb-2 text-[11px] text-muted">
            Every NASA test by pressure and O2. Dashed line: same O2 partial pressure as the ISS (3.087 psi). Shaded box: Moon base / rover zone (30–34% O2, 8.2–10.2 psi).
          </p>
          <HabitatMap />
        </section>
        <div className="space-y-5">
          <RankBars />
          <InvestigationKey />
        </div>
      </div>
      <PinnedCharts />
    </div>
  );
}

function InvestigationKey() {
  const items = [
    { name: "ACME", color: "bg-acme", text: "Gaseous spherical flames (CFI-G campaign) in the Combustion Integrated Rack." },
    { name: "CFI", color: "bg-cfi", text: "n-dodecane droplet flames, hot and cool, in the CIR droplet apparatus." },
    { name: "SPICE", color: "bg-spice", text: "Smoke points of coflow jet flames in the Microgravity Science Glovebox." },
  ];
  return (
    <section aria-label="Investigations" className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">The three investigations</h2>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex gap-2">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i.color}`} aria-hidden />
            <span>
              <b className="font-semibold">{i.name}</b> <span className="text-muted">{i.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">All tests ran in microgravity. No solid-material or partial-gravity tests are in this dataset.</p>
    </section>
  );
}
