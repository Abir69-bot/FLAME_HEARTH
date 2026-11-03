import { describe, it, expect } from "vitest";
import fs from "node:fs";

describe("project setup", () => {
  it(".env.example lists every optional key with an empty value", () => {
    const text = fs.readFileSync(".env.example", "utf8");
    for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL"]) {
      expect(text).toMatch(new RegExp(`^${name}=$`, "m"));
    }
  });
  it("raw data files are present", () => {
    for (const inv of ["ACME", "CFI", "SPICE"]) {
      for (const kind of ["Engineering_Doc.pdf", "Experimental_Table.csv", "Report.pdf"]) {
        expect(fs.existsSync(`Pseudo_DataKeep/${inv}/${inv}_${kind}`)).toBe(true);
      }
    }
  });
});
