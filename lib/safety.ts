/**
 * HEARTH safety rules (Prevention / Detection / Suppression).
 * Each rule runs real queries on the NASA data, returns a severity 0–100 from a documented
 * heuristic, a confidence from the amount of evidence, sources and an "evidence suggests…" guideline.
 * Severity is a HEARTH heuristic for ordering findings, not a NASA rating.
 */
import { countable, sourcesFor, stats } from "./data";
import { getMission } from "./missions";
import { envelopeCheck, ISS_PO2_PSI, pO2 } from "./physics";
import { searchDocs } from "./search";
import type { Confidence, Source, TestRecord } from "./types";
import { round } from "./util";
import { memo } from "./ratelimit";

export type SafetyCategory = "prevention" | "detection" | "suppression";

export interface Evidence {
  text: string;
  source?: Source;
}

export interface Finding {
  id: string;
  category: SafetyCategory;
  title: string;
  severity: number;
  severity_rule: string;
  confidence: Confidence;
  evidence: Evidence[];
  sources: Source[];
  guideline: string;
}

export interface SafetyTarget {
  o2_pct: number;
  pressure_psi: number;
  gravity: "microgravity" | "lunar" | "other";
  label: string;
}

export const EVIDENCE_SUPPORTED_MIN = 5;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function confidenceFromCount(n: number): Confidence {
  return n >= EVIDENCE_SUPPORTED_MIN ? "supported" : n > 0 ? "extrapolated" : "no_data";
}

const outcome = (t: TestRecord, re: RegExp) => re.test(t.outcome ?? "");
const csvRow = (t: TestRecord): Source => ({ file: t.source_file, row: t.source_row, test_id: t.test_id });

export function targetFor(input: { mission?: string; o2_pct?: number; pressure_psi?: number }): SafetyTarget | null {
  const m = getMission(input.mission);
  const o2 = input.o2_pct ?? m?.o2_pct;
  const p = input.pressure_psi ?? m?.pressure_psi;
  if (o2 == null || p == null) return null;
  const g = m?.gravity ?? "microgravity";
  return {
    o2_pct: o2,
    pressure_psi: p,
    gravity: g.startsWith("lunar") ? "lunar" : g === "microgravity" ? "microgravity" : "other",
    label: input.o2_pct != null ? `${o2}% O2 at ${p} psi` : `${m!.name} (${o2}% O2, ${p} psi)`,
  };
}

// ---------------------------------------------------------------- prevention
export function ruleOxygenEnrichment(t: SafetyTarget, tests = countable()): Finding {
  const env = envelopeCheck(t.o2_pct, t.pressure_psi, tests);
  const near = tests.filter((x) => env.test_ids.includes(x.test_id));
  const acme = near.filter((x) => x.investigation === "ACME");
  const ignited = acme.filter((x) => outcome(x, /hot ignition: (yes|flash)/));
  const ratio = round(pO2(t.o2_pct, t.pressure_psi) / ISS_PO2_PSI, 3);
  const severity = Math.round(70 * clamp01((t.o2_pct - 21) / (50 - 21)) + 30 * clamp01(ratio - 1));
  const enriched = t.o2_pct > 21;
  return {
    id: "oxygen_enrichment",
    category: "prevention",
    title: enriched ? `Oxygen enrichment: ${t.o2_pct}% O2` : `Oxygen at ${t.o2_pct}% (not enriched)`,
    severity,
    severity_rule: "70 × clamp((O2% − 21) / 29) + 30 × clamp(pO2/ISS − 1)",
    confidence: env.confidence,
    evidence: [
      { text: `pO2 ${pO2(t.o2_pct, t.pressure_psi)} psi = ${ratio}× ISS (${ISS_PO2_PSI} psi)`, source: { file: "lib/physics.ts", note: "tested formula" } },
      { text: `${env.count} NASA tests within ±5 pp O2 and ±2.5 psi (envelope: ${env.status})` },
      ...(acme.length ? [{ text: `${ignited.length} of ${acme.length} ACME gas flames there ignited`, source: acme[0] ? csvRow(acme[0]) : undefined }] : []),
    ],
    sources: sourcesFor(near, 4),
    guideline: enriched
      ? `Evidence suggests minimising ignition sources and flammable items at ${t.o2_pct}% O2: ${acme.length ? `${ignited.length} of ${acme.length} tested gas flames near these conditions ignited` : "no tested flames sit this close, so margins are unknown"}.`
      : "Evidence suggests this is the best-tested region: oxygen is at or below Earth air.",
  };
}

export function ruleUntestedSolids(t: SafetyTarget, tests = countable()): Finding {
  const solids = tests.filter((x) => x.fuel_phase === "solid");
  const phases = [...new Set(tests.map((x) => x.fuel_phase).filter(Boolean))];
  return {
    id: "untested_solids",
    category: "prevention",
    title: "Cabin materials are untested",
    severity: t.o2_pct > 21 ? 80 : 50,
    severity_rule: "80 when O2 > 21%, else 50 (no solid-material data at all)",
    confidence: confidenceFromCount(solids.length),
    evidence: [
      { text: `${solids.length} solid-fuel tests among ${tests.length} (phases tested: ${phases.join(", ")})`, source: { file: "data/processed/tests.json" } },
    ],
    sources: sourcesFor(tests, 0),
    guideline: `Evidence is missing: fabrics, foams and wiring insulation have no test in this dataset. BASS / Saffire-type material flammability tests at ${t.o2_pct}% O2 and ${t.pressure_psi} psi would fill this gap.`,
  };
}

// ---------------------------------------------------------------- detection
export function ruleCoolFlames(t: SafetyTarget, tests = countable()): Finding {
  const cool = tests.filter((x) => x.investigation === "ACME" && outcome(x, /cool flame: yes/));
  const cfi = tests.filter((x) => x.investigation === "CFI");
  const o2 = stats(cool.map((x) => x.o2_pct));
  const pr = stats(cool.map((x) => x.pressure_psi));
  const inRange =
    o2.min != null && o2.max != null && pr.min != null && pr.max != null &&
    t.o2_pct >= o2.min - 5 && t.o2_pct <= o2.max + 5 && t.pressure_psi >= pr.min - 2.5 && t.pressure_psi <= pr.max + 2.5;
  const doc = searchDocs("radiative extinction subsequent cool flame combustion", { investigation: "CFI", limit: 1 })[0];
  return {
    id: "cool_flames",
    category: "detection",
    title: "Cool flames are hard to see",
    severity: 40 + (inRange ? 20 : 0),
    severity_rule: "40 + 20 when the condition is within ±5 pp O2 and ±2.5 psi of the recorded cool-flame tests",
    confidence: inRange ? confidenceFromCount(cool.length) : cool.length ? "extrapolated" : "no_data",
    evidence: [
      { text: `${cool.length} ACME tests recorded a cool flame, at ${o2.min}–${o2.max}% O2 and ${pr.min === pr.max ? pr.min : `${pr.min}–${pr.max}`} psi`, source: cool[0] ? csvRow(cool[0]) : undefined },
      { text: `${cfi.length} CFI droplet burns studied hot-to-cool flame transitions`, source: doc ? { file: doc.source_file, page: doc.page } : undefined },
    ],
    sources: [...sourcesFor(cool, 3), ...(doc ? [{ file: doc.source_file, page: doc.page }] : [])],
    guideline:
      "Evidence suggests a cool flame can keep burning after the bright hot flame goes out, with little light or heat; detectors that rely on visible flame or high temperature may miss it.",
  };
}

export function ruleSmokeDetection(t: SafetyTarget, tests = countable()): Finding {
  const spice = tests.filter((x) => x.investigation === "SPICE");
  const fuels = [...new Set(spice.map((x) => x.fuel).filter(Boolean))] as string[];
  const differs = Math.abs(t.o2_pct - 21) > 5 || Math.abs(t.pressure_psi - 14.649) > 2.5;
  const doc = searchDocs("Fifty-two smoke points were found", { investigation: "SPICE", limit: 1 })[0];
  return {
    id: "smoke_detection",
    category: "detection",
    title: "Smoke and soot behaviour",
    severity: 35 + (differs ? 15 : 0),
    severity_rule: "35 + 15 when the atmosphere is outside SPICE's tested 21% O2 / 101 kPa (±5 pp, ±2.5 psi)",
    confidence: differs ? "extrapolated" : confidenceFromCount(spice.length),
    evidence: [
      { text: `${spice.length} SPICE flame settings across ${fuels.length} gas fuels, used to find where flames start to soot`, source: spice[0] ? csvRow(spice[0]) : undefined },
      ...(doc ? [{ text: "Smoke points found for ethylene, propane, propylene and mixtures", source: { file: doc.source_file, page: doc.page } }] : []),
    ],
    sources: [...sourcesFor(spice, 2), ...(doc ? [{ file: doc.source_file, page: doc.page }] : [])],
    guideline: differs
      ? `Evidence suggests sooting depends on fuel and airflow, but SPICE ran only at 21% O2 and 101 kPa: smoke-detector response at ${t.o2_pct}% O2 and ${t.pressure_psi} psi is untested.`
      : "Evidence suggests sooting depends on fuel and airflow (SPICE smoke points); smoke detectors should be checked against these fuels.",
  };
}

// ---------------------------------------------------------------- suppression
export function ruleStillAir(t: SafetyTarget, tests = countable()): Finding {
  const acme = tests.filter((x) => x.investigation === "ACME");
  const se = acme.filter((x) => outcome(x, /self-extinguished/));
  const ft = acme.filter((x) => outcome(x, /flow terminated/));
  const stillSpice = tests.filter((x) => x.investigation === "SPICE" && x.flow_cm_s != null && x.flow_cm_s < 5);
  const severity = t.gravity === "microgravity" ? 55 : t.gravity === "lunar" ? 45 : 35;
  return {
    id: "still_air",
    category: "suppression",
    title: "Still-air pockets and flow control",
    severity,
    severity_rule: "55 microgravity, 45 lunar gravity, 35 otherwise (less buoyant flow = more still-air pockets)",
    confidence: t.gravity === "microgravity" ? confidenceFromCount(se.length + ft.length) : "extrapolated",
    evidence: [
      { text: `${ft.length} ACME flames ended when the gas flow was cut`, source: ft[0] ? csvRow(ft[0]) : undefined },
      { text: `${se.length} ACME flames self-extinguished in the quiescent chamber`, source: se[0] ? csvRow(se[0]) : undefined },
      { text: `${stillSpice.length} SPICE flames ran in still or near-still coflow (< 5 cm/s)`, source: stillSpice[0] ? csvRow(stillSpice[0]) : undefined },
    ],
    sources: [...sourcesFor(ft, 2), ...sourcesFor(se, 2), ...sourcesFor(stillSpice, 1)],
    guideline: `Evidence suggests cutting fuel or oxidizer flow ends gas flames (${ft.length} ACME cases), and that quiescent air lets flames self-extinguish; ventilation shutdown is supported by this data for gas flames only.`,
  };
}

export function rulePartialGravity(t: SafetyTarget, tests = countable()): Finding {
  const g = [...new Set(tests.map((x) => x.gravity))];
  const partial = tests.filter((x) => x.gravity !== "ug" && x.gravity !== "1g").length;
  const severity = t.gravity === "lunar" ? 65 : t.gravity === "microgravity" ? 20 : 40;
  return {
    id: "partial_gravity",
    category: "suppression",
    title: t.gravity === "lunar" ? "Lunar gravity is untested" : "Gravity level",
    severity,
    severity_rule: "65 lunar mission, 20 microgravity mission (data matches), 40 otherwise",
    confidence: t.gravity === "microgravity" ? "supported" : confidenceFromCount(partial),
    evidence: [{ text: `Gravity levels in the data: ${g.map((x) => (x === "ug" ? "microgravity" : x)).join(", ")} (${partial} partial-gravity tests)`, source: { file: "data/processed/tests.json" } }],
    sources: sourcesFor(tests, 0),
    guideline:
      t.gravity === "lunar"
        ? "Evidence is missing for lunar gravity: microgravity and 1g only bound flame and suppressant behaviour. LUCI or FM2-type experiments at lunar gravity would fill this gap."
        : "Evidence suggests the microgravity data applies directly to station conditions.",
  };
}

export const RULES = [ruleOxygenEnrichment, ruleUntestedSolids, ruleCoolFlames, ruleSmokeDetection, ruleStillAir, rulePartialGravity];

function safetyAuditImpl(t: SafetyTarget): Finding[] {
  const tests = countable();
  return RULES.map((r) => r(t, tests)).sort((a, b) => b.severity - a.severity);
}

/** Cached per target (the data is static). */
export const safetyAudit = memo(safetyAuditImpl);
