import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "My data lab" };

export default function LabPage() {
  return (
    <PageHeader eyebrow="Try your own conditions" title="My data lab">
      Set O2, pressure and airflow and see pO2, the data envelope and the nearest NASA tests.
    </PageHeader>
  );
}
