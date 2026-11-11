/**
 * Mission report: one printable page per mission with its conditions, data coverage, nearest tests,
 * safety findings and every source. Built from the same functions the dashboard and VESTA use.
 */
import { countable } from "./data";
import { getMission, MISSIONS } from "./missions";
import { envelopeCheck, hazardIndex, nearestTests, o2VsEarth, pO2Calc, ratioToISS, type EnvelopeResult, type HazardIndex } from "./physics";
import { safetyAudit, targetFor, type Finding } from "./safety";
import type { Mission } from "./types";

export interface ReportNearest {
  test_id: string;
  investigation: string;
  fuel: string | null;
  o2_pct: number | null;
  pressure_psi: number | null;
  outcome: string | null;
  source_file: string;
  source_row: number | null;
  distance: number;
}

export interface MissionReport {
  mission: Mission;
  po2: { value: number; formula: string };
  ratio: { value: number; formula: string };
  vsEarth: { value: number; delta_pp: number; formula: string };
  envelope: EnvelopeResult;
  hazard: HazardIndex;
  nearest: ReportNearest[];
  findings: Finding[];
}

export const REPORT_MISSION_IDS = MISSIONS.map((m) => m.id);

export function buildReport(missionId: string): MissionReport | null {
  const mission = getMission(missionId);
  const target = targetFor({ mission: missionId });
  if (!mission || !target) return null;
  const tests = countable();
  const envelope = envelopeCheck(mission.o2_pct, mission.pressure_psi, tests);
  return {
    mission,
    po2: pO2Calc(mission.o2_pct, mission.pressure_psi),
    ratio: ratioToISS(mission.o2_pct, mission.pressure_psi),
    vsEarth: o2VsEarth(mission.o2_pct),
    envelope,
    hazard: hazardIndex(mission.o2_pct, mission.pressure_psi, null, envelope.status),
    nearest: nearestTests(mission.o2_pct, mission.pressure_psi, tests, 5).map(({ test: t, distance }) => ({
      test_id: t.test_id,
      investigation: t.investigation,
      fuel: t.fuel,
      o2_pct: t.o2_pct,
      pressure_psi: t.pressure_psi,
      outcome: t.outcome,
      source_file: t.source_file,
      source_row: t.source_row,
      distance,
    })),
    findings: safetyAudit(target),
  };
}
