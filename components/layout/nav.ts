import { IconAudit, IconCompare, IconDatabase, IconInfo, IconInsights, IconLab, IconOverview, IconReport, IconShield, IconTable } from "@/components/ui/Icons";

export interface NavItem {
  href: string;
  label: string;
  hint: string;
  Icon: (p: { className?: string }) => JSX.Element;
}

/** Every page, grouped by what a visitor wants to do. Used by the side menu, the phone menu and the command palette. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Mission",
    items: [
      { href: "/", label: "Mission overview", hint: "Conditions, 3D map, ranking", Icon: IconOverview },
      { href: "/safety", label: "Safety & gaps", hint: "Findings and untested conditions", Icon: IconShield },
      { href: "/report", label: "Mission report", hint: "One printable page", Icon: IconReport },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/explorer", label: "Test explorer", hint: "Filter every NASA test", Icon: IconTable },
      { href: "/insights", label: "Insights", hint: "Ignition, burn time, coverage", Icon: IconInsights },
      { href: "/compare", label: "Compare", hint: "ACME, CFI and SPICE side by side", Icon: IconCompare },
      { href: "/dataset", label: "Dataset", hint: "Sources, quality, downloads", Icon: IconDatabase },
    ],
  },
  {
    title: "Try it",
    items: [
      { href: "/lab", label: "My data lab", hint: "Your own conditions or CSV", Icon: IconLab },
      { href: "/simulator", label: "Flame simulator", hint: "Replays of real tests (demo)", Icon: IconAudit },
      { href: "/about", label: "About", hint: "Investigations, limits, credits", Icon: IconInfo },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(href: string, path: string): boolean {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}
