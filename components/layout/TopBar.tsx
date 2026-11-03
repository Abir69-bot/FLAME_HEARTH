"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
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
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="HEARTH home">
          <Logo size={30} />
          <span className="font-head text-lg font-bold tracking-wider">HEARTH</span>
          <span className="hidden text-xs text-muted sm:inline">· Team Polaris</span>
        </Link>
        <nav aria-label="Mission" className="order-3 flex w-full gap-1.5 overflow-x-auto pb-0.5 sm:order-none sm:w-auto">
          {MISSIONS.map((m) => {
            const active = m.id === missionId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMission(m.id)}
                aria-pressed={active}
                title={`${m.name}: ${m.o2_pct}% O2 at ${m.pressure_psi} psi`}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
                  active ? "border-ember bg-ember/15 text-ember-soft" : "border-line bg-panel text-muted hover:border-muted hover:text-text"
                }`}
              >
                {m.short}
                <span className="ml-1.5 font-mono text-[10px] opacity-80">
                  {m.o2_pct}%·{m.pressure_psi}
                </span>
                {m.demo && <span className="ml-1 text-[9px] uppercase text-warn">demo</span>}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs" role="status">
          <span className={`h-2 w-2 rounded-full ${status.ok ? "bg-ok" : "bg-bad"}`} aria-hidden />
          <span className="text-muted">
            {status.ok ? (status.tests != null ? `NASA data · ${status.tests} tests` : "NASA data · loading") : "Data offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
