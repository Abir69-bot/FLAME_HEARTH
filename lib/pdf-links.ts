/**
 * Links to the NASA PDFs served by /api/pdf/[file], opened at a page.
 * Safe for the browser: a plain list of file names, no file access.
 */
export const PDF_FILES = [
  "ACME_Report.pdf",
  "ACME_Engineering_Doc.pdf",
  "CFI_Report.pdf",
  "CFI_Engineering_Doc.pdf",
  "SPICE_Report.pdf",
  "SPICE_Engineering_Doc.pdf",
] as const;
export type PdfFile = (typeof PDF_FILES)[number];

/** "Pseudo_DataKeep/ACME/ACME_Report.pdf" or "ACME_Report.pdf" → the served file name, or null for anything else. */
export function pdfName(file: string): PdfFile | null {
  const name = file.split("/").pop() ?? file;
  return (PDF_FILES as readonly string[]).includes(name) ? (name as PdfFile) : null;
}

/** URL that opens the PDF at a page in the browser's own viewer, or null when the file is not one of the NASA PDFs. */
export function pdfHref(file: string, page?: number | null): string | null {
  const name = pdfName(file);
  if (!name) return null;
  return `/api/pdf/${name}${page && page > 0 ? `#page=${page}` : ""}`;
}

/** Path of a served PDF inside the repository. */
export function pdfPath(name: PdfFile): string {
  return `Pseudo_DataKeep/${name.split("_")[0]}/${name}`;
}
