"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-raised" />,
});

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

type Handlers = Record<string, (params: unknown) => void>;
interface Resizable {
  resize: () => void;
  isDisposed?: () => boolean;
}

/** ECharts wrapper: dark theme defaults, animation off under reduced motion, resizes with its box. */
export function EChart({ option, height = 260, onEvents, ariaLabel }: { option: Record<string, unknown>; height?: number; onEvents?: Handlers; ariaLabel: string }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<Resizable | null>(null);
  const opt = reduce ? { ...option, animation: false } : option;

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const c = chart.current;
      if (c && !c.isDisposed?.()) c.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} role="img" aria-label={ariaLabel} style={{ height }} className="w-full min-w-0 overflow-hidden">
      <ReactECharts
        option={opt}
        style={{ height, width: "100%" }}
        notMerge
        lazyUpdate
        onEvents={onEvents}
        opts={{ renderer: "canvas" }}
        onChartReady={(instance: Resizable) => {
          chart.current = instance;
          // the box may have settled after the chart measured itself
          requestAnimationFrame(() => instance.resize());
        }}
      />
    </div>
  );
}
