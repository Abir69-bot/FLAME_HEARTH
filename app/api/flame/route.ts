import { json } from "@/lib/api";
import { allTests } from "@/lib/data";
import { buildFlameDataset } from "@/lib/flame";

export const runtime = "nodejs";

/** Compact experiment rows for the Flame simulator, so the sliders respond instantly in the browser. */
export function GET() {
  return json(buildFlameDataset(allTests()));
}
