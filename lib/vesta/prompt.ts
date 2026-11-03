import fs from "node:fs";
import path from "node:path";
import { getMission } from "@/lib/missions";

export type Level = "student" | "researcher" | "engineer";

let cached: string | null = null;

/** The shared system prompt (lib/vesta/system-prompt.md), identical for every engine. */
export function basePrompt(): string {
  if (cached == null) {
    const file = path.join(process.cwd(), "lib", "vesta", "system-prompt.md");
    cached = fs.readFileSync(file, "utf8");
  }
  return cached;
}

/** Per-request context appended after the stable prompt. */
export function systemPrompt(missionId: string | undefined, level: Level): string {
  const m = getMission(missionId);
  const mission = m
    ? `Active mission: ${m.name} (id ${m.id}) at ${m.o2_pct}% O2 and ${m.pressure_psi} psi, gravity: ${m.gravity}${m.demo ? ", demo scenario" : ""}.`
    : "No active mission.";
  return `${basePrompt()}\n\n## This conversation\n${mission}\nExplanation level: ${level}.`;
}
