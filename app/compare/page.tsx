import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <PageHeader eyebrow="Investigations side by side" title="Compare">
      Compare the coverage of ACME, CFI and SPICE: conditions, fuels, sensors and what each one alone covers.
    </PageHeader>
  );
}
