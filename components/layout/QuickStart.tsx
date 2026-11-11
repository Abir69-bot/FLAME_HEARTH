"use client";
import Link from "next/link";
import { IconInsights, IconLab, IconReport, IconSearch } from "@/components/ui/Icons";
import { useHearth } from "@/lib/store";
import { openPalette } from "./CommandPalette";

/** Four next steps under the mission header, so new visitors find the deeper pages. */
export function QuickStart() {
  const missionId = useHearth((s) => s.missionId);
  const card = "hud-panel group flex items-start gap-3 p-3 text-left transition hover:border-ember/60";
  const icon = "mt-0.5 shrink-0 text-ember transition-transform group-hover:scale-110";
  return (
    <nav aria-label="Next steps" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/insights" className={card}>
        <IconInsights className={icon} />
        <span>
          <span className="block text-sm font-semibold">See the patterns</span>
          <span className="block text-xs text-muted">Where flames lit, how long they burned, how they went out</span>
        </span>
      </Link>
      <Link href={`/report/${missionId}`} className={card}>
        <IconReport className={icon} />
        <span>
          <span className="block text-sm font-semibold">Mission report</span>
          <span className="block text-xs text-muted">One printable page with every finding and source</span>
        </span>
      </Link>
      <Link href="/lab" className={card}>
        <IconLab className={icon} />
        <span>
          <span className="block text-sm font-semibold">Try your own cabin</span>
          <span className="block text-xs text-muted">Your O2, pressure and airflow against the NASA tests</span>
        </span>
      </Link>
      <button type="button" onClick={openPalette} className={card}>
        <IconSearch className={icon} />
        <span>
          <span className="block text-sm font-semibold">Search everything</span>
          <span className="block text-xs text-muted">Pages, missions, test ids and fuels · Ctrl K</span>
        </span>
      </button>
    </nav>
  );
}
