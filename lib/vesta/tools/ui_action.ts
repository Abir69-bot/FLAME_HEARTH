import { z } from "zod";
import { getTest } from "@/lib/data";
import { getMission } from "@/lib/missions";
import { defineTool, fail } from "./types";

export const VIEWS = ["overview", "explorer", "compare", "safety", "lab", "simulator", "about"] as const;
export type View = (typeof VIEWS)[number];

export const VIEW_PATHS: Record<View, string> = {
  overview: "/",
  explorer: "/explorer",
  compare: "/compare",
  safety: "/safety",
  lab: "/lab",
  simulator: "/simulator",
  about: "/about",
};

export const UiActionInput = z.object({
  action: z.enum(["go_view", "set_mission", "highlight_tests", "open_test"]),
  view: z.enum(VIEWS).optional().describe("go_view: which page"),
  mission: z.string().optional().describe("set_mission: iss, lunar-base, lunar-rover or spacesuit"),
  test_ids: z.array(z.string()).max(50).optional().describe("highlight_tests: test ids from tool results"),
  test_id: z.string().optional().describe("open_test: one test id"),
  compare: z.array(z.enum(["ACME", "CFI", "SPICE"])).max(3).optional().describe("go_view compare: investigations to preselect"),
});
export type UiActionArgs = z.infer<typeof UiActionInput>;

export interface UiEvent {
  action: UiActionArgs["action"];
  view?: View;
  path?: string;
  mission?: string;
  test_ids?: string[];
  test_id?: string;
  compare?: string[];
}

export function validateUi(a: UiActionArgs): UiEvent | string {
  switch (a.action) {
    case "go_view":
      if (!a.view) return "go_view needs a view";
      return { action: a.action, view: a.view, path: VIEW_PATHS[a.view], compare: a.compare };
    case "set_mission": {
      const m = getMission(a.mission);
      if (!m) return "unknown mission";
      return { action: a.action, mission: m.id };
    }
    case "highlight_tests": {
      const ids = (a.test_ids ?? []).map((id) => getTest(id)?.test_id).filter((x): x is string => !!x);
      if (!ids.length) return "no valid test ids";
      return { action: a.action, test_ids: ids };
    }
    case "open_test": {
      const t = a.test_id ? getTest(a.test_id) : undefined;
      if (!t) return "unknown test id";
      return { action: a.action, test_id: t.test_id };
    }
  }
}

export const uiActionTool = defineTool({
  name: "ui_action",
  description:
    "Move the HEARTH dashboard: go_view (overview, explorer, compare, safety, lab, about), set_mission, highlight_tests on the map, or open_test details. Use it whenever the answer is easier to see on a page.",
  input: UiActionInput,
  run(a) {
    const ev = validateUi(a);
    if (typeof ev === "string") return fail(ev);
    return { ok: true, data: { ui: ev }, sources: [], summary: `dashboard: ${ev.action}${ev.view ? ` → ${ev.view}` : ""}` };
  },
});
