"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MISSIONS } from "@/lib/missions";
import { useHearth } from "@/lib/store";

/** Print button: the browser's print dialog can also save the page as a PDF. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ember print:hidden">
      Print or save as PDF
    </button>
  );
}

/** Mission switcher for the report, and it keeps the dashboard's active mission in step. */
export function ReportMissionLinks({ current }: { current: string }) {
  const setMission = useHearth((s) => s.setMission);
  return (
    <nav aria-label="Report for another mission" className="flex flex-wrap gap-1.5 print:hidden">
      {MISSIONS.map((m) => (
        <Link
          key={m.id}
          href={`/report/${m.id}`}
          onClick={() => setMission(m.id)}
          aria-current={m.id === current ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-xs ${m.id === current ? "border-ember bg-ember/15 text-ember-soft" : "border-line bg-panel text-muted hover:text-text"}`}
        >
          {m.short}
        </Link>
      ))}
    </nav>
  );
}

/** /report opens the report for the mission chosen in the top bar. */
export function ReportRedirect() {
  const missionId = useHearth((s) => s.missionId);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/report/${missionId}`);
  }, [missionId, router]);
  return (
    <p className="text-sm text-muted">
      Opening the report for your mission…{" "}
      {MISSIONS.map((m) => (
        <Link key={m.id} href={`/report/${m.id}`} className="mr-2 underline">
          {m.short}
        </Link>
      ))}
    </p>
  );
}
