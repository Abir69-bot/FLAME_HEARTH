import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolSpec } from "../providers/types";
import type { ToolDef } from "./types";

/** Convert a zod schema to a plain, inline JSON Schema object that every provider accepts. */
export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const j = zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" }) as Record<string, unknown>;
  delete j.$schema;
  delete j.definitions;
  if (j.type !== "object") return { type: "object", properties: {} };
  return j;
}

/** The same schema without parameter descriptions or number limits. Arguments are still fully checked by zod when a tool runs. */
function stripDetails(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripDetails);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "properties" && v && typeof v === "object") {
      // Here the keys are parameter names, one of which could be called "description".
      out[k] = Object.fromEntries(Object.entries(v).map(([name, sub]) => [name, stripDetails(sub)]));
    } else if (!["description", "additionalProperties", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems"].includes(k)) {
      out[k] = stripDetails(v);
    }
  }
  return out;
}

/** The first sentence says what a tool is for. Field lists stay, because the model cannot guess column names. */
function shortDescription(text: string): string {
  return text
    .split(/(?<=[a-z0-9)])\. (?=[A-Z])/)
    .filter((s, i) => i === 0 || /fields:/i.test(s))
    .join(". ");
}

/** Left out on a tight budget: chart_data covers charts of test data, and search_docs covers reading the PDFs. */
export const NOT_IN_COMPACT = ["make_chart", "read_doc_page"];

/** For engines with a tight token budget. */
export function compactToolSpecs(tools: ToolDef[]): ToolSpec[] {
  return toolSpecs(tools.filter((t) => !NOT_IN_COMPACT.includes(t.name))).map((s) => ({ name: s.name, description: shortDescription(s.description), parameters: stripDetails(s.parameters) as Record<string, unknown> }));
}

const cache = new WeakMap<ToolDef, ToolSpec>();

/** Tool schemas are written once in zod and converted here for every provider. */
export function toolSpecs(tools: ToolDef[]): ToolSpec[] {
  return tools.map((t) => {
    let spec = cache.get(t);
    if (!spec) {
      spec = { name: t.name, description: t.description, parameters: toJsonSchema(t.input) };
      cache.set(t, spec);
    }
    return spec;
  });
}
