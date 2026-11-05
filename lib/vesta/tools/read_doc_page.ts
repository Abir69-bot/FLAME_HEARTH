import { z } from "zod";
import { allChunks, allPdfTables } from "@/lib/data";
import { defineTool, fail } from "./types";

const TEXT_MAX_CHARS = 8000;

/** "ACME_Report.pdf" and "Pseudo_DataKeep/ACME/ACME_Report.pdf" both name the same file. */
const baseName = (f: string) => f.replace(/\\/g, "/").split("/").pop()!.toLowerCase();

export const readDocPageTool = defineTool({
  name: "read_doc_page",
  description:
    "Read one whole page of a NASA PDF, including any tables extracted from it. Use after search_docs when a short passage is not enough. Files: ACME, CFI or SPICE + _Report.pdf or _Engineering_Doc.pdf.",
  input: z.object({
    file: z.string().min(3).describe("e.g. ACME_Report.pdf"),
    page: z.number().int().min(1),
  }),
  run({ file, page }) {
    const name = baseName(file);
    const inFile = allChunks().filter((c) => baseName(c.source_file) === name);
    if (!inFile.length) {
      const files = [...new Set(allChunks().map((c) => baseName(c.source_file)))].sort();
      return fail(`unknown file "${file}". Files: ${files.join(", ")}`);
    }
    const chunks = inFile.filter((c) => c.page === page);
    const tables = allPdfTables()
      .filter((t) => baseName(t.source_file) === name && t.page === page)
      .map((t) => ({ table_id: t.table_id, rows: t.rows }));
    if (!chunks.length && !tables.length) {
      const pages = inFile.map((c) => c.page);
      return { ok: true, data: { file, page, text: null, tables: [], pages_with_text: { first: Math.min(...pages), last: Math.max(...pages) } }, sources: [], confidence: "no_data", summary: `no text on page ${page} of ${file}` };
    }
    const sourceFile = chunks[0]?.source_file ?? inFile[0].source_file;
    return {
      ok: true,
      data: { file: sourceFile, page, text: chunks.map((c) => c.text).join("\n").slice(0, TEXT_MAX_CHARS), tables },
      sources: [{ file: sourceFile, page }],
      confidence: "supported",
      summary: `read page ${page} of ${file}`,
    };
  },
});
