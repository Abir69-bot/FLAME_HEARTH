import { EXPORT_FILES, exportBody, type ExportFile } from "@/lib/dataset-export";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return EXPORT_FILES.map((file) => ({ file }));
}

export function GET(_req: Request, { params }: { params: { file: string } }) {
  if (!EXPORT_FILES.includes(params.file as ExportFile)) return new Response("Not found", { status: 404 });
  const { body, type } = exportBody(params.file as ExportFile);
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="hearth-${params.file}"`,
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
