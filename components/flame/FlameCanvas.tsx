"use client";
import { useEffect, useRef } from "react";
import { FRAGMENT, VERTEX } from "./shader";

/** Everything the flame needs to draw itself. Updated many times a second, so it lives outside React. */
export interface FlameScene {
  mode: 0 | 1 | 2;
  life: number;
  size: number;
  heat: number;
  soot: number;
  cool: number;
  drop: number;
  fiber: number;
  flow: number;
  len: number;
  spark: number;
  version: number;
}

const UNIFORMS = ["uRes", "uTime", "uEarth", "uMode", "uLife", "uSize", "uHeat", "uSoot", "uCool", "uDrop", "uFiber", "uFlow", "uLen", "uSpark"] as const;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("no shader");
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader did not compile");
  return s;
}

/** One flame view, drawn with plain WebGL. Calls onFail if the device cannot draw it, so the page can say so. */
export function FlameCanvas({ earth, scene, reduce, onFail }: { earth: boolean; scene: React.MutableRefObject<FlameScene>; reduce: boolean; onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let disposed = false;
    let cleanup = () => {};
    try {
      const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
      if (!gl) throw new Error("no webgl");
      const program = gl.createProgram();
      if (!program) throw new Error("no program");
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("program did not link");
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

      const nav = navigator as Navigator & { deviceMemory?: number };
      const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
      const frameMs = 1000 / (weak ? 30 : 50);
      const pixelRatio = weak ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      let visible = true;
      let last = 0;
      let drawnVersion = -1;

      const draw = (now: number) => {
        const s = scene.current;
        gl.uniform2f(u.uRes, canvas.width, canvas.height);
        gl.uniform1f(u.uTime, reduce ? 3 : now / 1000);
        gl.uniform1f(u.uEarth, earth ? 1 : 0);
        gl.uniform1f(u.uMode, s.mode);
        gl.uniform1f(u.uLife, s.life);
        gl.uniform1f(u.uSize, s.size);
        gl.uniform1f(u.uHeat, s.heat);
        gl.uniform1f(u.uSoot, s.soot);
        gl.uniform1f(u.uCool, s.cool);
        gl.uniform1f(u.uDrop, s.drop);
        gl.uniform1f(u.uFiber, s.fiber);
        gl.uniform1f(u.uFlow, s.flow);
        gl.uniform1f(u.uLen, s.len);
        gl.uniform1f(u.uSpark, s.spark);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        drawnVersion = s.version;
      };

      const resize = () => {
        const w = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
        const h = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
          drawnVersion = -1;
        }
      };
      const resizer = new ResizeObserver(resize);
      resizer.observe(canvas);
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
      });
      io.observe(canvas);
      resize();

      const loop = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        if (!visible || now - last < frameMs) return;
        // with reduced motion only redraw when something changed
        if (reduce && drawnVersion === scene.current.version) return;
        last = now;
        draw(now);
      };
      raf = requestAnimationFrame(loop);

      const onLost = (e: Event) => {
        e.preventDefault();
        onFail();
      };
      canvas.addEventListener("webglcontextlost", onLost);
      cleanup = () => {
        resizer.disconnect();
        io.disconnect();
        canvas.removeEventListener("webglcontextlost", onLost);
      };
    } catch {
      onFail();
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [earth, scene, reduce, onFail]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
