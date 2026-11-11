import type { Metadata } from "next";
import { ReportRedirect } from "@/components/report/ReportActions";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Mission report" };

export default function ReportIndex() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="One page to share" title="Mission report" />
      <ReportRedirect />
    </div>
  );
}
