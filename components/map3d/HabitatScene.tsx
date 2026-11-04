"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MISSIONS } from "@/lib/missions";
import type { MapData } from "@/lib/map3d";
import { useHearth } from "@/lib/store";
import { HabitatEngine, type Hover, type LabPoint } from "./engine";

/** Pause before the opening camera move, so the whole map is seen first. */
const OPENING_FLY_DELAY_MS = 1400;

function Tooltip({ hover, width }: { hover: Hover; width: number }) {
  const flip = hover.x > width - 240;
  const style = { left: flip ? undefined : hover.x + 14, right: flip ? width - hover.x + 14 : undefined, top: Math.max(4, hover.y - 20) };
  const cls = "pointer-events-none absolute z-10 max-w-[230px] rounded-md border border-line bg-raised/95 px-2.5 py-1.5 text-xs text-text shadow-lg";
  if (hover.kind === "lab") {
    return (
      <div style={style} className={cls}>
        <b className="text-warn">{hover.lab.label}</b>
        <br />
        Your uploaded row (not NASA data)
        <br />
        O2 {hover.lab.o2_pct}% · {hover.lab.pressure_psi} psi
      </div>
    );
  }
  const a = hover.agg;
  return (
    <div style={style} className={cls}>
      <b>{a.inv}</b> · {a.ids.length} test{a.ids.length > 1 ? "s" : ""}
      <br />
      {a.ids.slice(0, 3).join(", ")}
      {a.ids.length > 3 ? ` +${a.ids.length - 3} more` : ""}
      <br />
      O2 {a.value[1]}% · {a.value[0]} psi
      <br />
      {a.fuels.slice(0, 3).join(", ")}
      {a.fromDoc && (
        <>
          <br />
          <i>conditions from SPICE_Report p20</i>
        </>
      )}
      <br />
      <span className="text-muted">click for details</span>
    </div>
  );
}

const CONTROL = "flex h-8 min-w-8 items-center justify-center rounded-md border border-line bg-bg/80 px-2 font-mono text-xs text-text transition hover:border-ember";

/** Loaded on demand, so the 3D engine only downloads for visitors who see the 3D map. Calls onFail so the page can show the flat chart. */
export default function HabitatScene({ data, reduce, onFail }: { data: MapData; reduce: boolean; onFail: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HabitatEngine | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const missionId = useHearth((s) => s.missionId);
  const highlight = useHearth((s) => s.highlightIds);
  const labRows = useHearth((s) => s.labRows);
  const setMission = useHearth((s) => s.setMission);
  const openTest = useHearth((s) => s.openTest);

  const labPoints = useMemo<LabPoint[]>(
    () => labRows.filter((r) => r.o2_pct != null && r.pressure_psi != null && !r.problems.length).map((r) => ({ label: r.label, o2_pct: r.o2_pct as number, pressure_psi: r.pressure_psi as number })),
    [labRows],
  );

  useEffect(() => {
    const host = hostRef.current;
    const overlay = overlayRef.current;
    if (!host || !overlay) return;
    let engine: HabitatEngine;
    try {
      engine = new HabitatEngine(host, overlay, { onHover: setHover, onOpenTest: openTest, onSelectMission: setMission, onLost: onFail }, reduce);
      engine.setData(data, MISSIONS);
      engine.setHighlight(useHearth.getState().highlightIds);
    } catch {
      onFail();
      return;
    }
    engineRef.current = engine;
    // Page scrolling keeps working over the map: only Ctrl + wheel reaches the zoom control.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) e.stopPropagation();
    };
    host.addEventListener("wheel", onWheel, { capture: true });
    return () => {
      host.removeEventListener("wheel", onWheel, { capture: true });
      engine.dispose();
      engineRef.current = null;
    };
    // the engine is built once per data set; later changes arrive through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const opened = useRef(false);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (opened.current || reduce) {
      engine.setMission(missionId, MISSIONS, opened.current);
      opened.current = true;
      return;
    }
    // first arrival: show the full map, then glide to the active mission
    const timer = window.setTimeout(() => {
      opened.current = true;
      engineRef.current?.setMission(useHearth.getState().missionId, MISSIONS, true);
    }, OPENING_FLY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [missionId, reduce, data]);

  useEffect(() => {
    engineRef.current?.setHighlight(highlight);
  }, [highlight]);

  useEffect(() => {
    engineRef.current?.setLabRows(labPoints);
  }, [labPoints]);

  return (
    <div className="relative h-[400px] overflow-hidden rounded-lg border border-line bg-[#03060d] sm:h-[540px]">
      <div
        ref={hostRef}
        role="img"
        aria-label={`3D habitat relevance map: ${data.points.length} NASA tests placed by pressure, oxygen and oxygen partial pressure, with mission markers. Switch to the flat chart for a precise 2D view.`}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {hover && <Tooltip hover={hover} width={hostRef.current?.clientWidth ?? 0} />}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button type="button" aria-label="Zoom in" className={CONTROL} onClick={() => engineRef.current?.zoom(0.78)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" className={CONTROL} onClick={() => engineRef.current?.zoom(1.28)}>
          −
        </button>
        <button type="button" className={CONTROL} onClick={() => engineRef.current?.reset()}>
          Reset view
        </button>
      </div>
    </div>
  );
}
