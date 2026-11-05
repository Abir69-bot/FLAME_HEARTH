/** Friendly wording for VESTA's tools and the questions it offers next. Questions hold no numbers of their own. */

const TOOL_LABELS: Record<string, string> = {
  query_data: "Searching the test data",
  search_docs: "Reading the NASA documents",
  physics_calc: "Running the physics",
  nearest_tests: "Finding the closest tests",
  envelope_check: "Checking data coverage",
  compare: "Comparing investigations",
  rank_investigations: "Ranking investigations",
  safety_audit: "Running the safety audit",
  gap_finder: "Looking for data gaps",
  make_chart: "Drawing a chart",
  ui_action: "Updating the dashboard",
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

export type StarterIcon = "assess" | "audit" | "gaps" | "rank";

export interface Starter {
  icon: StarterIcon;
  title: string;
  hint: string;
  question: string;
}

/** First-time suggestions; the wording also works in Offline mode. */
export function starters(missionShort: string): Starter[] {
  return [
    { icon: "assess", title: "Assess this cabin", hint: "Is it inside the tested data?", question: `Is the ${missionShort} atmosphere inside the tested data?` },
    { icon: "audit", title: "Safety audit", hint: "Prevention, detection, suppression", question: "Run a safety audit for this mission" },
    { icon: "rank", title: "Best experiments", hint: "Rank investigations for this mission", question: "Which investigation is most relevant for this mission?" },
    { icon: "gaps", title: "Find data gaps", hint: "What has never been tested?", question: "What data is missing for this mission?" },
  ];
}

const AUDIT = "Run a safety audit for this mission";
const GAPS = "What data is missing for this mission?";
const RANK = "Which investigation is most relevant for this mission?";
const COMPARE = "Compare ACME and SPICE";

const NEXT_AFTER: Record<string, string[]> = {
  safety_audit: [GAPS, RANK],
  gap_finder: [AUDIT, RANK],
  rank_investigations: [COMPARE, AUDIT],
  compare: [RANK, GAPS],
  envelope_check: [AUDIT, GAPS],
  physics_calc: [AUDIT, GAPS],
  nearest_tests: [AUDIT, GAPS],
};

/** Up to three next questions, based on what VESTA just did and a test it just cited. */
export function followUps(toolsUsed: string[], firstTestId?: string, max = 3): string[] {
  const out: string[] = [];
  if (firstTestId) out.push(`Explain test ${firstTestId}`);
  // the most specific tools decide first: an audit also runs physics, but "audit" is what happened
  const order = ["safety_audit", "gap_finder", "rank_investigations", "compare", "envelope_check", "nearest_tests", "physics_calc"];
  const key = order.find((t) => toolsUsed.includes(t));
  for (const q of key ? NEXT_AFTER[key] : [AUDIT, RANK]) if (!out.includes(q)) out.push(q);
  return out.slice(0, max);
}
