"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSearch } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { openPalette } from "./CommandPalette";
import { MobileMenu } from "./MobileMenu";
import { TeamBadge } from "@/components/ui/Polaris";
import { MISSIONS } from "@/lib/missions";
import { useHearth } from "@/lib/store";

export function TopBar() {
  const missionId = useHearth((s) => s.missionId);
  const setMission = useHearth((s) => s.setMission);
  const [status, setStatus] = useState<{ ok: boolean; tests?: number }>({ ok: true });

  useEffect(() => {
    let alive = true;
    fetch("/api/tests?page_size=1")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setStatus({ ok: true, tests: j.total }))
      .catch(() => alive && setStatus({ ok: false }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-bg">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <MobileMenu />
        <Link href="/" className="flex items-center gap-2" aria-label="HEARTH home">
          <Logo size={30} />
          <span className="font-head text-lg font-bold tracking-wider">HEARTH</span>
        </Link>
        <span className="hidden md:inline-flex">
          <TeamBadge />
        </span>
        <div id="tour-missions" className="order-3 w-full sm:order-none sm:w-auto">
        <label className="flex items-center gap-2 text-xs text-muted sm:hidden">
          <span className="shrink-0">Mission</span>
          <select
            value={missionId}
            onChange={(e) => setMission(e.target.value)}
            className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-text"
          >
            {MISSIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.short} · {m.o2_pct}% O2 · {m.pressure_psi} psi{m.demo ? " (demo)" : ""}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Mission" className="hidden gap-1.5 overflow-x-auto pb-0.5 sm:flex">
          {MISSIONS.map((m) => {
            const active = m.id === missionId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMission(m.id)}
                aria-pressed={active}
                title={`${m.name}: ${m.o2_pct}% O2 at ${m.pressure_psi} psi`}
                className={`flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
                  active ? "border-ember bg-ember/15 text-ember-soft shadow-[0_0_14px_rgba(255,122,47,0.35)]" : "border-line bg-panel text-muted hover:border-muted hover:text-text"
                }`}
              >
                {active && (
                  <span className="relative mr-1.5 flex h-1.5 w-1.5" aria-hidden>
                    <span className="absolute inset-0 animate-pulseRing rounded-full bg-ember" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-ember" />
                  </span>
                )}
                {m.short}
                <span className="ml-1.5 font-mono text-[10px] opacity-80">
                  {m.o2_pct}%·{m.pressure_psi}
                </span>
                {m.demo && <span className="ml-1 text-[9px] uppercase text-warn">demo</span>}
              </button>
            );
          })}
        </nav>
        </div>
        <button
          type="button"
          onClick={openPalette}
          className="ml-auto flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-muted transition hover:border-muted hover:text-text"
          aria-label="Search pages, missions and tests (Ctrl K)"
        >
          <IconSearch />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden rounded border border-line px-1 font-mono text-[10px] lg:inline">Ctrl K</kbd>
        </button>
        <div className="hidden items-center gap-2 text-xs xl:flex" role="status">
          <span className="relative flex h-2 w-2" aria-hidden>
            {status.ok && <span className="absolute inset-0 animate-pulseRing rounded-full bg-ok" />}
            <span className={`relative h-2 w-2 rounded-full ${status.ok ? "bg-ok" : "bg-bad"}`} />
          </span>
          <span className="text-muted">
            {status.ok ? (status.tests != null ? <>NASA data · <span className="font-mono text-text">{status.tests}</span> tests</> : "NASA data · loading") : "Data offline"}
          </span>
        </div>
      </div>
      <div className="heat-line" aria-hidden />
    </header>
  );
}
