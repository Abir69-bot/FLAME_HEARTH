import { z } from "zod";
import { evaluate, MathError, MAX_EXPRESSION_CHARS } from "@/lib/mathexpr";
import { sig } from "@/lib/stats";
import { defineTool, fail } from "./types";

/** Plain numbers an expression may always use: small counts and common unit factors. */
const ALWAYS_ALLOWED = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 24, 60, 100, 1000, 3600, 273.15]);

export const mathEvalTool = defineTool({
  name: "math_eval",
  description:
    "Calculator for arithmetic on numbers you already have, e.g. percent differences or ratios of tool results: + - * / % ^ ( ), sqrt, abs, exp, ln, log10, log2, sin, cos, tan, round, floor, ceil, min, max, pow, pi, e. Every number in the expression must come from an earlier tool result or the user's message (0-10, 12, 24, 60, 100, 1000, 3600 and 273.15 are always allowed). It does not extrapolate or predict.",
  input: z.object({
    expression: z.string().min(1).max(MAX_EXPRESSION_CHARS),
    meaning: z.string().max(120).optional().describe("What the result is, in a few words"),
  }),
  run({ expression, meaning }, ctx) {
    try {
      const { value, literals } = evaluate(expression);
      const unknown = literals.filter((n) => !ALWAYS_ALLOWED.has(n) && ctx.isKnownNumber && !ctx.isKnownNumber(n));
      if (unknown.length) return fail(`these numbers did not come from a tool result or the user's message: ${[...new Set(unknown)].slice(0, 6).join(", ")}`);
      return {
        ok: true,
        data: { expression, value: sig(value, 8), meaning },
        sources: [{ file: "lib/mathexpr.ts", note: "tested calculator (tests/mathexpr.test.ts)" }],
        summary: `${expression} = ${sig(value, 8)}`,
      };
    } catch (e) {
      if (e instanceof MathError) return fail(e.message);
      throw e;
    }
  },
});
