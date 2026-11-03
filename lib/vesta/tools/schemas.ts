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
