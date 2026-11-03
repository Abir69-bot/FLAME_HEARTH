import type { Metadata } from "next";
import { SafetyView } from "@/components/safety/SafetyView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Safety & gaps" };

export default function SafetyPage() {
  return (
    <>
      <PageHeader eyebrow="Evidence, not rules" title="Safety & gaps">
        Prevention, detection and suppression findings for the active mission, built from the NASA test data, plus the oxygen × pressure conditions nobody has tested yet.
      </PageHeader>
      <SafetyView />
    </>
  );
}
