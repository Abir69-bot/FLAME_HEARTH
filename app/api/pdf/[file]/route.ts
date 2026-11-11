import fs from "node:fs";
import path from "node:path";
import { PDF_FILES, pdfPath, type PdfFile } from "@/lib/pdf-links";

// Built once at deploy time and served as static files: the PDFs are larger than a function response may be.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_FILES.map((file) => ({ file }));
}

export function GET(_req: Request, { params }: { params: { file: string } }) {
  if (!PDF_FILES.includes(params.file as PdfFile)) return new Response("Not found", { status: 404 });
  const body = fs.readFileSync(path.join(process.cwd(), pdfPath(params.file as PdfFile)));
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${params.file}"`,
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
