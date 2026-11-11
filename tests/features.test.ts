import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV, NAV_GROUPS, isActive } from "@/components/layout/nav";
import { MISSIONS } from "@/lib/missions";
import { PDF_FILES, pdfHref, pdfName, pdfPath } from "@/lib/pdf-links";
import { buildReport, REPORT_MISSION_IDS } from "@/lib/report";
import { VIEW_PATHS } from "@/lib/vesta/tools/ui_action";

describe("mission report", () => {
  it("builds one report per mission from the same functions as the dashboard", () => {
    expect(REPORT_MISSION_IDS).toEqual(MISSIONS.map((m) => m.id));
    const rover = buildReport("lunar-rover")!;
    expect(rover.po2.value).toBe(2.788);
    expect(rover.ratio.value).toBe(0.903);
    expect(rover.envelope.status).toBe("supported");
    expect(rover.envelope.count).toBe(28);
    expect(rover.nearest).toHaveLength(5);
    expect(rover.nearest.every((t) => t.source_file.endsWith(".csv") && t.source_row)).toBe(true);
    expect(rover.findings.length).toBe(6);
  });

  it("says no_data for the spacesuit and refuses unknown missions", () => {
    expect(buildReport("spacesuit")!.envelope.status).toBe("no_data");
    expect(buildReport("mars")).toBeNull();
  });
});

describe("PDF links", () => {
  it("serves exactly the six NASA PDFs, and every one exists", () => {
    expect(PDF_FILES).toHaveLength(6);
    for (const f of PDF_FILES) expect(fs.existsSync(path.join(process.cwd(), pdfPath(f))), f).toBe(true);
  });

  it("links a page and rejects anything else", () => {
    expect(pdfHref("Pseudo_DataKeep/SPICE/SPICE_Report.pdf", 20)).toBe("/api/pdf/SPICE_Report.pdf#page=20");
    expect(pdfHref("ACME_Report.pdf")).toBe("/api/pdf/ACME_Report.pdf");
    expect(pdfHref("Pseudo_DataKeep/ACME/ACME_Experimental_Table.csv", 2)).toBeNull();
    expect(pdfName("../../.env.local")).toBeNull();
  });
});

describe("navigation", () => {
  it("lists every page once, and every page exists", () => {
    const hrefs = NAV.map((n) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(NAV_GROUPS.reduce((s, g) => s + g.items.length, 0)).toBe(NAV.length);
    for (const h of hrefs) {
      const file = h === "/" ? "app/page.tsx" : `app${h}/page.tsx`;
      expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(true);
    }
  });

  it("VESTA can open every page in the menu", () => {
    const viewPaths = Object.values(VIEW_PATHS);
    for (const n of NAV) expect(viewPaths, n.href).toContain(n.href);
  });

  it("marks the active page, including sub-pages", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/insights")).toBe(false);
    expect(isActive("/report", "/report/iss")).toBe(true);
    expect(isActive("/lab", "/labx")).toBe(false);
  });
});
