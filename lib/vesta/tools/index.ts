import type { ToolResult } from "@/lib/types";
import { analyzeDataTool } from "./analyze_data";
import { chartDataTool } from "./chart_data";
import { compareTool } from "./compare";
import { envelopeCheckTool } from "./envelope_check";
import { gapFinderTool } from "./gap_finder";
import { makeChartTool } from "./make_chart";
import { mathEvalTool } from "./math_eval";
import { readDocPageTool } from "./read_doc_page";
import { uiActionTool } from "./ui_action";
import { nearestTestsTool } from "./nearest_tests";
import { physicsCalc } from "./physics_calc";
import { queryData } from "./query_data";
import { rankInvestigationsTool } from "./rank_investigations";
import { safetyAuditTool } from "./safety_audit";
import { searchDocsTool } from "./search_docs";
import type { ToolContext, ToolDef } from "./types";

/** Data tools: read the NASA data, the PDFs or the tested formulas. */
export const DATA_TOOLS: ToolDef[] = [
  queryData,
  searchDocsTool,
  physicsCalc,
  nearestTestsTool,
  envelopeCheckTool,
  compareTool,
  rankInvestigationsTool,
  gapFinderTool,
  safetyAuditTool,
  analyzeDataTool,
  mathEvalTool,
  readDocPageTool,
] as unknown as ToolDef[];

/** Everything VESTA can call: data tools + chart tools + ui_action. */
export const VESTA_TOOLS: ToolDef[] = [...DATA_TOOLS, makeChartTool, chartDataTool, uiActionTool] as unknown as ToolDef[];

export function findTool(name: string, tools: ToolDef[] = VESTA_TOOLS): ToolDef | undefined {
  return tools.find((t) => t.name === name);
}

/** Validate arguments with zod, then run. Never throws. */
export async function runTool(name: string, args: unknown, ctx: ToolContext = {}, tools: ToolDef[] = VESTA_TOOLS): Promise<ToolResult> {
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
