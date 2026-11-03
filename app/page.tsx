import { MissionHeader } from "@/components/layout/MissionHeader";
import { PinnedCharts } from "@/components/vesta/PinnedCharts";
import { Logo } from "@/components/ui/Logo";

export default function Overview() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4">
        <div className="animate-flicker">
          <Logo size={56} />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember-soft">Habitat Environment Analysis &amp; Risk Tracking Hub</p>
          <h1 className="font-head text-2xl font-bold tracking-wide sm:text-3xl">Fire-safety intelligence for crewed habitats</h1>
          <p className="text-sm text-muted">NASA microgravity combustion data from ACME, CFI and SPICE, read by VESTA, your AI crewmate.</p>
        </div>
      </section>
      <MissionHeader />
      <PinnedCharts />
    </div>
  );
}
