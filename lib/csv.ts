/** Browser-side CSV helpers for My data lab. Nothing here leaves the browser. */
import type { PressureUnit } from "./physics";
import { convertPressure } from "./physics";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // drop comment lines (# …) and empty lines
  return rows.filter((r) => r.some((c) => c.trim() !== "") && !r[0]?.trim().startsWith("#")).map((r) => r.map((c) => c.trim()));
}

export interface Mapping {
  label: number | null;
  o2: number | null;
  o2_is_fraction: boolean;
  pressure: number | null;
  pressure_unit: PressureUnit;
  flow: number | null;
}

/** Guess which columns hold O2, pressure, airflow and a label, from the header names and values. */
export function detectMapping(header: string[], rows: string[][]): Mapping {
  const h = header.map((x) => x.toLowerCase());
  const find = (re: RegExp) => {
    const i = h.findIndex((x) => re.test(x));
    return i >= 0 ? i : null;
  };
  const o2 = find(/\bo2\b|oxygen|xo2/);
  const pressure = find(/press|psi|\bbar\b|\batm\b|kpa/);
  const flow = find(/flow|velocity|air ?rate|cm\/s/);
  const label = find(/^(id|name|label|test|sample)/) ?? (h.length && ![o2, pressure, flow].includes(0) ? 0 : null);
  const ph = pressure != null ? h[pressure] : "";
  const unit: PressureUnit = /kpa/.test(ph) ? "kPa" : /\bbar\b/.test(ph) ? "bar" : /atm/.test(ph) ? "atm" : "psi";
  const o2vals = o2 != null ? rows.map((r) => Number(r[o2])).filter(Number.isFinite) : [];
  const fraction = o2vals.length > 0 && o2vals.every((v) => v >= 0 && v <= 1);
  return { label, o2, o2_is_fraction: fraction, pressure, pressure_unit: unit, flow };
}

export interface LabRowOut {
  label: string;
  o2_pct: number | null;
  pressure_psi: number | null;
  flow_cm_s: number | null;
  problems: string[];
}

const num = (s: string | undefined) => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Apply the confirmed mapping, convert units and run the same range checks as the NASA ingest. */
export function applyMapping(rows: string[][], m: Mapping): LabRowOut[] {
  return rows.slice(0, 2000).map((r, i) => {
    const problems: string[] = [];
    const o2raw = m.o2 != null ? num(r[m.o2]) : null;
    const o2 = o2raw == null ? null : m.o2_is_fraction ? Math.round(o2raw * 100000) / 1000 : o2raw;
    const praw = m.pressure != null ? num(r[m.pressure]) : null;
    const p = praw == null ? null : m.pressure_unit === "psi" ? praw : convertPressure(praw, m.pressure_unit, "psi").value;
    const flow = m.flow != null ? num(r[m.flow]) : null;
    if (o2 == null) problems.push("O2 missing");
    else if (o2 < 0 || o2 > 100) problems.push("O2 outside 0–100%");
    if (p == null) problems.push("pressure missing");
    else if (p <= 0) problems.push("pressure ≤ 0");
    if (flow != null && flow < 0) problems.push("airflow < 0");
    return { label: (m.label != null ? r[m.label] : "") || `row ${i + 2}`, o2_pct: o2, pressure_psi: p, flow_cm_s: flow, problems };
  });
}
