"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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

/** ECharts wrapper: dark theme defaults, animation off under reduced motion. */
export function EChart({ option, height = 260, onEvents, ariaLabel }: { option: Record<string, unknown>; height?: number; onEvents?: Handlers; ariaLabel: string }) {
  const reduce = useReducedMotion();
  const opt = reduce ? { ...option, animation: false } : option;
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ReactECharts option={opt} style={{ height, width: "100%" }} notMerge lazyUpdate onEvents={onEvents} opts={{ renderer: "canvas" }} />
    </div>
  );
}
