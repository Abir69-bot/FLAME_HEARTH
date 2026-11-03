/** Proactive mission alert: no AI call, only tested formulas and the envelope check. */
import { allTests, sourcesFor } from "@/lib/data";
import { getMission } from "@/lib/missions";
import { envelopeCheck, nearestTests, o2VsEarth, pO2, ratioToISS } from "@/lib/physics";
import type { Confidence, Source } from "@/lib/types";

export interface MissionAlert {
  mission: string;
  severity: "ok" | "warn" | "bad";
  title: string;
  text: string;
  confidence: Confidence;
  sources: Source[];
  highlight: string[];
}

export function missionAlert(missionId: string): MissionAlert | null {
  const m = getMission(missionId);
  if (!m) return null;
  const env = envelopeCheck(m.o2_pct, m.pressure_psi, allTests());
  const near = nearestTests(m.o2_pct, m.pressure_psi, allTests(), 5);
  const po2 = pO2(m.o2_pct, m.pressure_psi);
  const ratio = ratioToISS(m.o2_pct, m.pressure_psi).value;
  const vs = o2VsEarth(m.o2_pct);
  const enriched = m.o2_pct > 21;
  const severity: MissionAlert["severity"] = env.status === "no_data" ? "bad" : enriched || ratio > 1 ? "warn" : "ok";
  const parts: string[] = [];
  if (enriched) parts.push(`Hazard first: ${m.o2_pct}% O2 is ${vs.value}× Earth air.`);
  parts.push(`pO2 ${po2} psi (${ratio}× ISS).`);
  parts.push(
    env.status === "no_data"
      ? `No NASA tests within ±5 points O2 and ±2.5 psi of ${m.o2_pct}% / ${m.pressure_psi} psi: I won't predict here; this is a data gap.`
      : `Data envelope ${env.status}: ${env.count} tests nearby.`,
  );
  if (m.gravity.startsWith("lunar")) parts.push("All data is microgravity; lunar gravity is untested.");
  return {
    mission: m.id,
    severity,
    title: severity === "ok" ? `${m.short}: inside the tested envelope` : severity === "warn" ? `${m.short}: enriched oxygen` : `${m.short}: no test data`,
    text: parts.join(" "),
    confidence: env.confidence === "supported" && m.gravity.startsWith("lunar") ? "extrapolated" : env.confidence,
    sources: [{ file: "lib/physics.ts", note: "tested formula" }, ...sourcesFor(near.map((h) => h.test), 3)],
    highlight: near.map((h) => h.test.test_id),
  };
}
