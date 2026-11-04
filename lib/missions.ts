import type { Mission } from "./types";

/** HEARTH reference atmospheres (project assumptions, listed on the About page). No Mars habitat: no sourced values. */
export const MISSIONS: Mission[] = [
  {
    id: "iss",
    name: "ISS / Earth sea level",
    short: "ISS",
    o2_pct: 21,
    pressure_psi: 14.7,
    gravity: "microgravity",
    description: "Space station cabin air, same as Earth at sea level.",
    reference: "HEARTH reference atmospheres",
    demo: false,
  },
  {
    id: "lunar-base",
    name: "Moon base",
    short: "Moon base",
    o2_pct: 30,
    pressure_psi: 10.2,
    gravity: "lunar (1/6 g)",
    description: "Lunar surface habitat: at least 30% O2 at up to 10.2 psi.",
    reference: "HEARTH reference atmospheres: ≥30% O2, ≤10.2 psi",
    demo: false,
  },
  {
    id: "lunar-rover",
    name: "Pressurized lunar rover (demo scenario)",
    short: "Lunar rover",
    o2_pct: 34,
    pressure_psi: 8.2,
    gravity: "lunar (1/6 g)",
    description: "Demo scenario: pressurized rover cabin at 34% O2 and 8.2 psi.",
    reference: "HEARTH demo rover scenario",
    demo: true,
  },
  {
    id: "spacesuit",
    name: "Spacesuit",
    short: "Spacesuit",
    o2_pct: 100,
    pressure_psi: 4.3,
    gravity: "any",
    description: "Pure oxygen at low pressure inside the suit.",
    reference: "HEARTH reference atmospheres",
    demo: false,
  },
];

export const DEFAULT_MISSION_ID = "lunar-rover";

export function getMission(id: string | null | undefined): Mission | undefined {
  if (!id) return undefined;
  const key = id.trim().toLowerCase();
  return MISSIONS.find((m) => m.id === key || m.short.toLowerCase() === key || m.name.toLowerCase() === key);
}
