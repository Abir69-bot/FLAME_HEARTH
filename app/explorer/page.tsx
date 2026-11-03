import type { Metadata } from "next";
import { Explorer } from "@/components/explorer/Explorer";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Test explorer" };

export default function ExplorerPage() {
  return (
    <>
      <PageHeader eyebrow="NASA test table" title="Test explorer">
        Filter, sort and inspect every ACME, CFI and SPICE test. Each row links to its source file and row. Empty cells mean the value is not in the data.
      </PageHeader>
      <Explorer />
    </>
  );
}
