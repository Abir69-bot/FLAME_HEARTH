import { getMission } from "@/lib/missions";
import type { ToolContext } from "./types";

/** Take O2/pressure from the input, or from a mission id, or from the active mission. */
export function resolveConditions(
  input: { o2_pct?: number; pressure_psi?: number; mission?: string },
  ctx: ToolContext,
): { o2_pct: number; pressure_psi: number; mission?: string } | null {
  const m = getMission(input.mission ?? (input.o2_pct == null || input.pressure_psi == null ? ctx.missionId : undefined));
  const o2 = input.o2_pct ?? m?.o2_pct;
  const p = input.pressure_psi ?? m?.pressure_psi;
  if (o2 == null || p == null) return null;
  return { o2_pct: o2, pressure_psi: p, mission: m?.id };
}
