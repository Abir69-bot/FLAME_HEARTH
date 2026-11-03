import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <PageHeader eyebrow="HEARTH · Team Polaris" title="About">
      What HEARTH is, where the NASA data comes from and how VESTA answers.
    </PageHeader>
  );
}
