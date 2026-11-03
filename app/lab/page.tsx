import type { Metadata } from "next";
import { DemoTelemetry } from "@/components/lab/DemoTelemetry";
import { LabView } from "@/components/lab/LabView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "My data lab" };

export default function LabPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Try your own conditions" title="My data lab">
        Set oxygen, pressure and airflow to see pO2, the NASA data envelope, a heuristic hazard index and the nearest NASA tests. Upload your own CSV to compare it with the NASA data (kept in this browser only).
      </PageHeader>
      <LabView />
      <DemoTelemetry />
    </div>
  );
}
