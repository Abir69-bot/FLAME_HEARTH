import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import { GET } from "@/app/api/dataset/[file]/route";
import { parseCsv } from "@/lib/csv";
import { allChunks, allPdfTables, allTests, countable } from "@/lib/data";
import { SOURCES, datasetProfile } from "@/lib/dataset";
import { EXTRA_DOCS, FIELD_DOCS, FLAG_DOCS, REFERENCE_DOCS } from "@/lib/dataset-docs";
import { EXPORT_FILES, rawRows } from "@/lib/dataset-export";
import { hash, makeSplit, toCsv } from "@/lib/dataset-split";
import { TestRecordSchema } from "@/lib/types";
import { VIEWS } from "@/lib/vesta/tools/ui_action";

const p = datasetProfile();
const sum = (c: { ACME: number; CFI: number; SPICE: number }) => c.ACME + c.CFI + c.SPICE;

describe("dataset profile", () => {
  it("matches the data for its headline numbers", () => {
    expect(p.totals.rows).toBe(allTests().length);
    expect(p.totals.counted).toBe(countable().length);
    expect(p.totals.duplicates).toBe(allTests().length - countable().length);
    expect(p.totals.chunks).toBe(allChunks().length);
    expect(p.totals.pdfTables).toBe(allPdfTables().length);
    expect(p.totals.rawFiles).toBe(9);
  });

  it("every split dimension adds up to the whole dataset", () => {
    for (const d of p.dimensions) {
      expect(d.all.reduce((a, r) => a + sum(r.counts), 0), `${d.id} all`).toBe(p.totals.rows);
      expect(d.counted.reduce((a, r) => a + sum(r.counts), 0), `${d.id} counted`).toBe(p.totals.counted);
    }
  });

  it("every histogram holds exactly the values it reports", () => {
    for (const d of p.distributions) {
      const inBins = d.bins.reduce((a, b) => a + sum(b.counts), 0);
      const reported = d.stats.ACME.n + d.stats.CFI.n + d.stats.SPICE.n;
      expect(inBins, d.id).toBe(reported);
      expect(reported + d.stats.ACME.missing + d.stats.CFI.missing + d.stats.SPICE.missing, d.id).toBe(p.totals.counted);
    }
  });

  it("documents every field of the data model and every extra key", () => {
    expect(FIELD_DOCS.map((f) => f.name).sort()).toEqual(Object.keys(TestRecordSchema.shape).sort());
    const inData = new Set(allTests().flatMap((t) => Object.keys(t.extra).map((k) => `${t.investigation}.${k}`)));
    const documented = new Set(EXTRA_DOCS.map((e) => `${e.investigation}.${e.key}`));
    expect([...inData].filter((k) => !documented.has(k))).toEqual([]);
    expect([...documented].filter((k) => !inData.has(k))).toEqual([]);
  });

  it("documents every data-quality flag in the data", () => {
    const inData = new Set(allTests().flatMap((t) => t.flags));
    expect([...inData].sort()).toEqual(FLAG_DOCS.map((f) => f.flag).sort());
    expect(p.flags.every((f) => f.count === sum(f.counts) && f.count > 0)).toBe(true);
  });

  it("states what is missing instead of inventing it", () => {
    const outcome = p.fields.find((f) => f.name === "outcome")!;
    expect(outcome.fill.CFI).toBe(0);
    expect(outcome.fill.SPICE).toBe(0);
    expect(outcome.fill.ACME).toBe(100);
    expect(p.labelled.CFI.metricName).toBeNull();
    expect(p.dimensions.find((d) => d.id === "gravity")!.counted.map((r) => r.label)).toEqual(["Microgravity"]);
    expect(p.dimensions.find((d) => d.id === "phase")!.counted.map((r) => r.label)).not.toContain("solid");
  });
});

describe("source files", () => {
  it("records real sizes, checksums and row counts for every raw file", () => {
    for (const f of SOURCES.raw) {
      const data = fs.readFileSync(f.file);
      expect(data.length, f.file).toBe(f.bytes);
      expect(crypto.createHash("sha256").update(data).digest("hex"), f.file).toBe(f.sha256);
      if (f.kind === "table") expect(parseCsv(data.toString("utf8")).length - 1, f.file).toBe(f.rows);
    }
  });

  it("has a reference for every raw file", () => {
    expect(REFERENCE_DOCS.map((r) => r.file).sort()).toEqual(SOURCES.raw.map((f) => f.file).sort());
  });

  it("raw rows line up with source_row, so the inspector shows the right row", () => {
    const raw = rawRows();
    expect(raw.available).toBe(true);
    for (const t of allTests()) {
      const f = raw.files[t.source_file];
      const row = f.rows[t.source_row - 2];
      if (t.investigation === "CFI") expect(Number(row[f.columns.indexOf("Flex Number")]), t.test_id).toBe(t.extra.flex_number);
      if (t.investigation === "SPICE") expect(Number(row[f.columns.indexOf("Nozzle (mm)")]), t.test_id).toBeCloseTo(t.size_mm!, 3);
      if (t.investigation === "ACME") expect(row[f.columns.indexOf("Test")].replace(/\s/g, ""), t.test_id).toBe(String(t.extra.test_label).replace(/\s/g, ""));
    }
  });
});

describe("split helper", () => {
  const tests = allTests();

  it("is deterministic and depends on the seed", () => {
    const a = makeSplit(tests, { strategy: "row", trainPct: 80, seed: 7 });
    const b = makeSplit(tests, { strategy: "row", trainPct: 80, seed: 7 });
    const c = makeSplit(tests, { strategy: "row", trainPct: 80, seed: 8 });
    expect([...a.assign]).toEqual([...b.assign]);
    expect([...a.assign]).not.toEqual([...c.assign]);
    expect(hash("abc")).toBe(hash("abc"));
  });

  it("leaves out duplicates and places every counted row once", () => {
    const s = makeSplit(tests, { strategy: "row", trainPct: 80, seed: 1 });
    expect(s.train + s.test).toBe(countable().length);
    expect(s.assign.size).toBe(countable().length);
    for (const t of tests.filter((x) => x.flags.includes("duplicate_row"))) expect(s.assign.has(t.test_id)).toBe(false);
    expect(s.train / (s.train + s.test)).toBeCloseTo(0.8, 1);
  });

  it("the fuel split never puts a fuel on both sides", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = makeSplit(tests, { strategy: "fuel", trainPct: 70, seed });
      expect(s.sharedFuels, `seed ${seed}`).toEqual([]);
      expect(s.train).toBeGreaterThan(0);
      expect(s.test).toBeGreaterThan(0);
    }
  });

  it("the holdout split tests only on the chosen investigation", () => {
    const s = makeSplit(tests, { strategy: "holdout", trainPct: 80, seed: 1, holdout: "CFI" });
    expect(s.per.CFI.train).toBe(0);
    expect(s.per.CFI.test).toBe(countable().filter((t) => t.investigation === "CFI").length);
    expect(s.per.ACME.test + s.per.SPICE.test).toBe(0);
  });

  it("writes valid CSV with a split column", () => {
    const s = makeSplit(tests, { strategy: "row", trainPct: 80, seed: 1 });
    const rows = parseCsv(toCsv(tests, s.assign));
    const head = rows[0];
    expect(head[0]).toBe("split");
    expect(rows.length - 1).toBe(countable().length);
    const original = tests.find((t) => t.test_id === rows[1][head.indexOf("test_id")])!;
    expect(rows[1][head.indexOf("notes")]).toBe(original.notes);
    expect(rows.every((r) => r.length === head.length)).toBe(true);
  });
});

describe("dataset downloads", () => {
  it("serves every export and refuses unknown names", async () => {
    for (const file of EXPORT_FILES) {
      const res = GET(new Request(`http://x/api/dataset/${file}`), { params: { file } });
      expect(res.status, file).toBe(200);
      expect((await res.text()).length, file).toBeGreaterThan(50);
    }
    expect(GET(new Request("http://x/api/dataset/.env"), { params: { file: ".env" } }).status).toBe(404);
    expect(GET(new Request("http://x"), { params: { file: "../../.env.local" } }).status).toBe(404);
  });

  it("VESTA can open the page", () => {
    expect(VIEWS).toContain("dataset");
  });
});
