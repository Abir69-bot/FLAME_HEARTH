import type { Metadata } from "next";
import { FlameLab } from "@/components/flame/FlameLab";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Flame simulator" };

export default function SimulatorPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Play with fire, safely" title="Flame simulator">
        Change the oxygen, pressure and fuel, press Ignite, and see why a flame in microgravity burns nothing like one on Earth. What happens is decided by the real NASA tests closest to your settings.
      </PageHeader>
      <FlameLab />
    </div>
  );
}
