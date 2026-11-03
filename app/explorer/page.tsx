import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Test explorer" };

export default function ExplorerPage() {
  return (
    <PageHeader eyebrow="NASA test table" title="Test explorer">
      Filter, sort and inspect every ACME, CFI and SPICE test with its source file and row.
    </PageHeader>
  );
}
