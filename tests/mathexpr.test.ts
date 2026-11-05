import { describe, expect, it } from "vitest";
import { evaluate, MathError } from "@/lib/mathexpr";
import { runTool } from "@/lib/vesta/tools";

const val = (s: string) => evaluate(s).value;

describe("math expressions", () => {
  it("follows operator precedence", () => {
    expect(val("2 + 3 * 4")).toBe(14);
    expect(val("(2 + 3) * 4")).toBe(20);
    expect(val("10 - 4 - 3")).toBe(3);
    expect(val("100 / 5 / 2")).toBe(10);
    expect(val("7 % 3")).toBe(1);
  });

  it("powers bind tighter than a minus sign and read right to left", () => {
    expect(val("2 ^ 3 ^ 2")).toBe(512);
    expect(val("-2 ^ 2")).toBe(-4);
    expect(val("2 ^ -1")).toBe(0.5);
  });

  it("reproduces the rover pO2 from the project's formula", () => {
    expect(val("(34 / 100) * 8.2")).toBeCloseTo(2.788, 10);
    expect(val("(2.788 - 3.087) / 3.087 * 100")).toBeCloseTo(-9.6858, 3);
  });

  it("knows its functions and constants", () => {
    expect(val("sqrt(16) + abs(-3)")).toBe(7);
    expect(val("log10(1000)")).toBeCloseTo(3, 12);
    expect(val("ln(e)")).toBeCloseTo(1, 12);
    expect(val("max(1, 5, 3) - min(2, 4)")).toBe(3);
    expect(val("pow(2, 10)")).toBe(1024);
    expect(val("cos(pi)")).toBeCloseTo(-1, 12);
    expect(val("1.5e3")).toBe(1500);
  });

  it("reports every number that was typed", () => {
    expect(evaluate("2 * (3.5 + sqrt(16))").literals).toEqual([2, 3.5, 16]);
  });

  it.each(["", "   ", "2 +", "(2", "2 2", "1 / 0", "5 % 0", "sqrt(-1)", "2 ^ 99999", "foo(1)", "bar", "pow(2)", "sqrt(1, 2)"])("rejects %j", (s) => {
    expect(() => evaluate(s)).toThrow(MathError);
  });

  it.each(["process.exit(1)", "constructor", "__proto__", "this", "require('fs')", "Math.PI", "a=1", "toString(1)", "valueOf"])("cannot reach anything outside the calculator: %j", (s) => {
    expect(() => evaluate(s)).toThrow(MathError);
  });

  it("rejects very long and very deep input without crashing", () => {
    expect(() => evaluate("1+".repeat(300) + "1")).toThrow(MathError);
    expect(() => evaluate("(".repeat(100) + "1" + ")".repeat(100))).toThrow(MathError);
    expect(() => evaluate("-".repeat(100) + "1")).toThrow(MathError);
  });
});

describe("math_eval tool", () => {
  const known = new Set([2.788, 3.087]);
  const ctx = { isKnownNumber: (n: number) => known.has(n) };

  it("calculates with numbers that came from tools", async () => {
    const r = await runTool("math_eval", { expression: "(2.788 - 3.087) / 3.087 * 100" }, ctx);
    expect(r.ok).toBe(true);
    expect((r.data as { value: number }).value).toBeCloseTo(-9.6858, 3);
    expect(r.sources[0].file).toBe("lib/mathexpr.ts");
  });

  it("refuses a number nobody gave it", async () => {
    const r = await runTool("math_eval", { expression: "2.788 * 41.7" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("41.7");
  });

  it("allows the common small numbers and unit factors", async () => {
    const r = await runTool("math_eval", { expression: "2.788 * 100 / 60 + 273.15" }, ctx);
    expect(r.ok).toBe(true);
  });

  it("explains a bad expression instead of failing", async () => {
    const r = await runTool("math_eval", { expression: "1 / 0" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("division by zero");
  });
});
