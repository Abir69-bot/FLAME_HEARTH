import { z } from "zod";

export const INVESTIGATIONS = ["ACME", "CFI", "SPICE"] as const;
export const InvestigationSchema = z.enum(INVESTIGATIONS);
export type Investigation = z.infer<typeof InvestigationSchema>;

export const FuelPhaseSchema = z.enum(["gas", "liquid", "solid"]);
export type FuelPhase = z.infer<typeof FuelPhaseSchema>;

export const GravitySchema = z.enum(["ug", "1g", "efield"]);

export const ConfidenceSchema = z.enum(["supported", "extrapolated", "no_data"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const nullableNumber = z.number().nullable();

export const TestRecordSchema = z.object({
  test_id: z.string(),
  investigation: InvestigationSchema,
  campaign: z.string().nullable(),
  hardware: z.string().nullable(),
  fuel: z.string().nullable(),
  fuel_phase: FuelPhaseSchema.nullable(),
  geometry: z.string().nullable(),
  size_mm: nullableNumber,
  o2_pct: nullableNumber,
  pressure_psi: nullableNumber,
  diluent: z.string().nullable(),
  flow_cm_s: nullableNumber,
  gravity: GravitySchema,
  measurements: z.array(z.string()),
  sensors: z.array(z.string()),
  outcome: z.string().nullable(),
  key_metric_name: z.string().nullable(),
  key_metric_value: nullableNumber,
  source_file: z.string(),
  source_row: z.number().int(),
  notes: z.string(),
  flags: z.array(z.string()),
  extra: z.record(z.union([z.string(), z.number(), z.null()])),
});
export type TestRecord = z.infer<typeof TestRecordSchema>;

export const ChunkSchema = z.object({
  chunk_id: z.string(),
  investigation: InvestigationSchema,
  source_file: z.string(),
  page: z.number().int(),
  text: z.string(),
});
export type Chunk = z.infer<typeof ChunkSchema>;

export const PdfTableSchema = z.object({
  table_id: z.string(),
  investigation: InvestigationSchema,
  source_file: z.string(),
  page: z.number().int(),
  rows: z.array(z.array(z.string())),
});
export type PdfTable = z.infer<typeof PdfTableSchema>;

/** Where a fact comes from: a CSV row, a range of rows, a PDF page, or a tested formula. */
export const SourceSchema = z.object({
  file: z.string(),
  row: z.number().int().optional(),
  rows: z.string().optional(),
  page: z.number().int().optional(),
  test_id: z.string().optional(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export interface Mission {
  id: string;
  name: string;
  short: string;
  o2_pct: number;
  pressure_psi: number;
  gravity: string;
  description: string;
  reference: string;
  demo: boolean;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data: T;
  sources: Source[];
  confidence?: Confidence;
  /** One-line plain-language summary for logs / offline answers. */
  summary: string;
  error?: string;
}
