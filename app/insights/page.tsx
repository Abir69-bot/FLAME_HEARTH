import type { Metadata } from "next";
import { InsightsView } from "@/components/insights/InsightsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { allTests } from "@/lib/data";
import { buildInsights } from "@/lib/insights";

export const metadata: Metadata = {
  title: "Insights",
  description: "Patterns across the NASA tests: where flames lit, how long they burned, how they ended, what they did to the chamber, and which conditions were never tried.",
};

export default function InsightsPage() {
  const data = buildInsights(allTests());
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Patterns, not predictions" title="Insights">
        What hundreds of NASA tests show together: where flames lit, how long they burned, how they went out, what they did to the chamber, and which conditions nobody has tried. Every chart is built straight from the test rows; click a point to see its source.
      </PageHeader>
      <InsightsView data={data} />
    </div>
  );
}
