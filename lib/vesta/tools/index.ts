import type { ToolResult } from "@/lib/types";
import { compareTool } from "./compare";
import { envelopeCheckTool } from "./envelope_check";
import { gapFinderTool } from "./gap_finder";
import { nearestTestsTool } from "./nearest_tests";
import { physicsCalc } from "./physics_calc";
import { queryData } from "./query_data";
import { rankInvestigationsTool } from "./rank_investigations";
import { searchDocsTool } from "./search_docs";
import type { ToolContext, ToolDef } from "./types";

/** Data tools (Phase 2). make_chart and ui_action are added in Phase 3. */
export const DATA_TOOLS: ToolDef[] = [
  queryData,
  searchDocsTool,
  physicsCalc,
  nearestTestsTool,
  envelopeCheckTool,
  compareTool,
  rankInvestigationsTool,
  gapFinderTool,
] as unknown as ToolDef[];

export function findTool(name: string, tools: ToolDef[] = DATA_TOOLS): ToolDef | undefined {
  return tools.find((t) => t.name === name);
}

/** Validate arguments with zod, then run. Never throws. */
export async function runTool(name: string, args: unknown, ctx: ToolContext = {}, tools: ToolDef[] = DATA_TOOLS): Promise<ToolResult> {
  const tool = findTool(name, tools);
  if (!tool) return { ok: false, data: null, sources: [], summary: `unknown tool ${name}`, error: "unknown_tool" };
  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return { ok: false, data: null, sources: [], summary: `invalid arguments for ${name}: ${msg}`, error: "invalid_arguments" };
  }
  try {
    return await tool.run(parsed.data, ctx);
  } catch (e) {
    return { ok: false, data: null, sources: [], summary: `${name} failed`, error: e instanceof Error ? e.message : "tool_error" };
  }
}
