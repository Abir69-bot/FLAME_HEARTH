import { HabitatMap } from "@/components/charts/HabitatMap";
import { RankBars } from "@/components/charts/RankBars";
import { HeroBand } from "@/components/layout/HeroBand";
import { MissionHeader } from "@/components/layout/MissionHeader";
import { PinnedCharts } from "@/components/vesta/PinnedCharts";

export default function Overview() {
  return (
    <div className="space-y-5">
      <HeroBand />
      <MissionHeader />
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section id="tour-map" aria-label="Habitat relevance map" className="animate-fadeUp hud-panel p-4">
          <h2 className="mb-1 font-head text-sm font-semibold uppercase tracking-wider text-muted">Habitat relevance map</h2>
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
    <section aria-label="Investigations" className="hud-panel p-4">
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
