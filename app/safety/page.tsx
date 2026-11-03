import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Safety & gaps" };

export default function SafetyPage() {
  return (
    <PageHeader eyebrow="Evidence, not rules" title="Safety & gaps">
      Prevention, detection and suppression findings from the NASA data, the untested O2 × pressure cells and the experiments that would fill them.
    </PageHeader>
  );
}
