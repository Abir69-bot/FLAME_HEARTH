/** Files served by /api/dataset/[file]. Built at deploy time from the processed data and raw tables. */
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv";
import { allChunks, allPdfTables, allTests, isCountable } from "./data";
import { SOURCES, datasetProfile } from "./dataset";
import { toCsv } from "./dataset-split";

export const EXPORT_FILES = ["tests.json", "tests.csv", "tests-counted.csv", "chunks.json", "pdf_tables.json", "dictionary.json", "raw-rows.json"] as const;
export type ExportFile = (typeof EXPORT_FILES)[number];

export interface RawRows {
  available: boolean;
  files: Record<string, { columns: string[]; rows: string[][] }>;
}

/** Raw CSV rows for the record inspector. rows[n] is spreadsheet row n + 2, because the header is row 1. */
export function rawRows(root = process.cwd()): RawRows {
  try {
    const files: RawRows["files"] = {};
    for (const f of SOURCES.raw.filter((x) => x.kind === "table")) {
      const [head, ...rows] = parseCsv(fs.readFileSync(path.join(root, f.file), "utf8"));
      files[f.file] = { columns: head.map((c) => c.trim()), rows };
    }
    return { available: true, files };
  } catch {
    return { available: false, files: {} };
  }
}

export function exportBody(file: ExportFile): { body: string; type: string } {
  const json = (v: unknown) => ({ body: JSON.stringify(v), type: "application/json; charset=utf-8" });
  const csv = (body: string) => ({ body, type: "text/csv; charset=utf-8" });
  switch (file) {
    case "tests.json":
      return json(allTests());
    case "tests.csv":
      return csv(toCsv(allTests()));
    case "tests-counted.csv":
      return csv(toCsv(allTests().filter(isCountable)));
    case "chunks.json":
      return json(allChunks());
    case "pdf_tables.json":
      return json(allPdfTables());
    case "dictionary.json": {
      const p = datasetProfile();
      return json({
        fields: p.fields.map(({ name, type, unit, meaning, origin, fill }) => ({ name, type, unit: unit ?? null, meaning, origin, percent_filled: fill })),
        extra_fields: p.extras.map(({ investigation, key, unit, meaning, filled, rows }) => ({ investigation, key, unit: unit ?? null, meaning, filled, rows })),
        flags: p.flags.map(({ flag, title, why, handling, count }) => ({ flag, title, why, handling, rows: count })),
      });
    }
    case "raw-rows.json":
      return json(rawRows());
  }
}

/** Sizes of the files people can download, measured from what would actually be served. */
export function downloadList() {
  const { rows, counted } = datasetProfile().totals;
  const items: { file: ExportFile; label: string; detail: string }[] = [
    { file: "tests-counted.csv", label: "Clean table, counted rows", detail: `${counted} rows, duplicates removed. Start here for spreadsheets and modelling.` },
    { file: "tests.csv", label: "Clean table, all rows", detail: `${rows} rows, including flagged duplicates.` },
    { file: "tests.json", label: "Clean table, JSON", detail: `The ${rows} records exactly as HEARTH loads them.` },
    { file: "dictionary.json", label: "Data dictionary", detail: "Every field's type, unit, meaning, origin and fill rate." },
    { file: "chunks.json", label: "PDF passages", detail: "The text VESTA searches, with file and page." },
    { file: "pdf_tables.json", label: "PDF tables", detail: "Tables extracted from the NASA PDFs, with file and page." },
  ];
  return items.map((d) => ({ ...d, bytes: Buffer.byteLength(exportBody(d.file).body) }));
}
