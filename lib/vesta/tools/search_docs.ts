import { z } from "zod";
import { passageSources, searchDocs as search } from "@/lib/search";
import { InvestigationSchema } from "@/lib/types";
import { defineTool } from "./types";

export const searchDocsTool = defineTool({
  name: "search_docs",
  description:
    "Full-text search over the NASA engineering documents and final reports (PDFs). Returns short passages with file and page number. Use it to explain hardware, methods, definitions and findings.",
  input: z.object({
    query: z.string().min(2).describe("Words to search for"),
    investigation: InvestigationSchema.optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  run({ query, investigation, limit }) {
    const passages = search(query, { investigation, limit: limit ?? 4 });
    return {
      ok: true,
      data: { passages },
      sources: passageSources(passages),
      confidence: passages.length ? "supported" : "no_data",
      summary: passages.length ? `${passages.length} passages for "${query}"` : `no passages for "${query}"`,
    };
  },
});
