"use client";
import { useEffect, useRef } from "react";
import { loadPrefs, savePrefs, useHearth } from "@/lib/store";
import { SpaceBackdrop } from "@/components/fx/SpaceBackdrop";
import { VestaPanel } from "@/components/vesta/VestaPanel";
import { postMissionAlert } from "@/components/vesta/useVesta";
import { TestDrawer } from "@/components/ui/TestDrawer";
import { Tour } from "@/components/ui/Tour";
import { CommandPalette } from "./CommandPalette";
import { SideNav } from "./SideNav";
import { SiteFooter } from "./SiteFooter";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const missionId = useHearth((s) => s.missionId);
  const engine = useHearth((s) => s.engine);
  const level = useHearth((s) => s.level);
  const loaded = useRef(false);
  const lastMission = useRef<string | null>(null);

  // restore preferences once
  useEffect(() => {
    const p = loadPrefs();
    const s = useHearth.getState();
    if (p.missionId) s.setMission(p.missionId);
    if (p.engine) s.setEngine(p.engine);
    if (p.level) s.setLevel(p.level);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) savePrefs({ missionId, engine, level });
  }, [missionId, engine, level]);

  // VESTA speaks first when the mission changes (and once on arrival)
  useEffect(() => {
    if (lastMission.current === missionId) return;
    const t = setTimeout(() => {
      lastMission.current = missionId;
      postMissionAlert(missionId);
    }, 150);
    return () => clearTimeout(t);
  }, [missionId]);

  return (
    <div className="relative min-h-screen text-text">
      <SpaceBackdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ember focus:px-3 focus:py-1 focus:text-bg">
        Skip to content
      </a>
      <TopBar />
      <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col vesta:flex-row">
        <SideNav />
        <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          {children}
          <SiteFooter />
        </main>
        <VestaPanel />
      </div>
      <TestDrawer />
      <CommandPalette />
      <Tour />
    </div>
  );
}
