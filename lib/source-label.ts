import type { Source } from "./types";

/** "ACME_Experimental_Table.csv · row 129", "SPICE_Report.pdf · p20". Plain module, so server and client components can both call it. */
export function sourceLabel(s: Source): string {
  const f = s.file.split("/").pop() ?? s.file;
  if (s.row) return `${f} · row ${s.row}`;
  if (s.rows) return `${f} · rows ${s.rows.length > 18 ? `${s.rows.slice(0, 18)}…` : s.rows}`;
  if (s.page) return `${f} · p${s.page}`;
  return f;
}
