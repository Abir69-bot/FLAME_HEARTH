import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline } from "@/components/vesta/parseRichText";
import { followUps, starters, toolLabel } from "@/components/vesta/suggest";
import { detectIntent } from "@/lib/vesta/offline";
import { VESTA_TOOLS } from "@/lib/vesta/tools";

describe("VESTA answer formatting", () => {
  it("groups lists, headings and paragraphs", () => {
    expect(parseBlocks("### Findings\nIntro\n- one\n- two\n\n1. first\n2. second")).toEqual([
      { kind: "h", text: "Findings" },
      { kind: "p", text: "Intro" },
      { kind: "ul", items: ["one", "two"] },
      { kind: "gap" },
      { kind: "ol", start: 1, items: ["first", "second"] },
    ]);
  });

  it("reads tables and drops the separator row", () => {
    expect(parseBlocks("| A | B |\n|---|:-:|\n| 1 | 2 |")).toEqual([{ kind: "table", rows: [["A", "B"], ["1", "2"]] }]);
  });

  it("never loses or changes a number", () => {
    const line = "pO2 = 2.788 psi, 0.903× ISS at 34% O2 and 8.2 psi.";
    expect(parseBlocks(line)).toEqual([{ kind: "p", text: line }]);
    // a decimal at the start of a line is not a list number
    expect(parseBlocks("2.788 psi is the result")).toEqual([{ kind: "p", text: "2.788 psi is the result" }]);
    // a list keeps the number it started from
    expect(parseBlocks("3. third")).toEqual([{ kind: "ol", start: 3, items: ["third"] }]);
  });

  it("splits bold and code, and leaves HTML as plain text", () => {
    expect(parseInline("a **b** `c`")).toEqual([
      { kind: "text", text: "a " },
      { kind: "bold", text: "b" },
      { kind: "text", text: " " },
      { kind: "code", text: "c" },
    ]);
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ kind: "text", text: "<img src=x onerror=alert(1)>" }]);
  });
});

describe("VESTA suggestions", () => {
  it("has a friendly label for every tool", () => {
    for (const { name } of VESTA_TOOLS) expect(toolLabel(name)).not.toBe(name);
  });

  it("suggests next questions from what VESTA just did, at most three", () => {
    expect(followUps(["physics_calc", "envelope_check", "nearest_tests", "safety_audit"])).toEqual(["What data is missing for this mission?", "Which investigation is most relevant for this mission?"]);
    expect(followUps(["physics_calc"], "ACME-CFIG-128")[0]).toBe("Explain test ACME-CFIG-128");
    expect(followUps([], "SPICE-226").length).toBeLessThanOrEqual(3);
  });

  it("offers only questions Offline mode understands, so the buttons work without AI", () => {
    const questions = [
      ...starters("Lunar rover").map((s) => s.question),
      ...["safety_audit", "gap_finder", "rank_investigations", "compare", "physics_calc"].flatMap((t) => followUps([t], "ACME-CFIG-128")),
    ];
    for (const q of questions) expect(detectIntent(q), q).not.toBe("unknown");
  });

  it("starter questions contain no numbers of their own", () => {
    for (const s of starters("Moon base")) expect(`${s.title} ${s.hint} ${s.question}`).not.toMatch(/\d/);
  });
});
