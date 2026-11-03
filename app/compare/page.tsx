import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/CompareView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <>
      <PageHeader eyebrow="Investigations side by side" title="Compare">
        How much of the habitat design space each investigation covers: oxygen, pressure, airflow, fuels, sensors and relevance to the active mission.
      </PageHeader>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-panel" />}>
        <CompareView />
      </Suspense>
    </>
  );
}
