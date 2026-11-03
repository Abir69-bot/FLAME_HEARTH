"use client";
import { useEffect, useRef } from "react";

/** Animated VESTA orb on a canvas. Calm glow when idle, faster ember swirl when thinking. Static under reduced motion. */
export function Orb({ thinking, size = 44 }: { thinking: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;
    const r = size / 2;

    const draw = () => {
      const busy = thinkingRef.current;
      t += busy ? 0.06 : 0.018;
      ctx.clearRect(0, 0, size, size);
      const pulse = reduce ? 0 : Math.sin(t * 2) * 0.06;
      const g = ctx.createRadialGradient(r * 0.8, r * 0.7, 1, r, r, r);
      g.addColorStop(0, "#FFE2CC");
      g.addColorStop(0.35, busy ? "#FF7A2F" : "#FFB98A");
      g.addColorStop(1, "rgba(255,122,47,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r, r, r * (0.78 + pulse), 0, Math.PI * 2);
      ctx.fill();
      // orbiting sparks
      const n = busy ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = (reduce ? 0 : t) * (1 + i * 0.4) + (i * Math.PI * 2) / n;
        const x = r + Math.cos(a) * r * 0.62;
        const y = r + Math.sin(a) * r * 0.62;
        ctx.fillStyle = i % 2 ? "#4CC9F0" : "#FFF3E8";
        ctx.beginPath();
        ctx.arc(x, y, busy ? 2.2 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden className="shrink-0" />;
}
