import type { z } from "zod";
import type { ToolResult } from "@/lib/types";

export interface ToolContext {
  missionId?: string;
}

export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  input: S;
  run: (input: z.infer<S>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;
}

export function defineTool<S extends z.ZodTypeAny>(t: ToolDef<S>): ToolDef<S> {
  return t;
}

export function fail(summary: string): ToolResult {
  return { ok: false, data: null, sources: [], summary, error: summary };
}

export const FORMULA_SOURCE = { file: "lib/physics.ts", note: "tested formula (tests/physics.test.ts)" };
