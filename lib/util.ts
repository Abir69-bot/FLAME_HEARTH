import type { TestRecord } from "./types";

export function round(x: number, nd = 3): number {
  const f = 10 ** nd;
  return Math.round(x * f) / f;
}

/** Duplicate rows are kept in the data but never counted twice. */
export function isCountable(t: Pick<TestRecord, "flags">): boolean {
  return !t.flags.includes("duplicate_row");
}

export interface NumStats {
  n: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}

export function stats(values: (number | null | undefined)[]): NumStats {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!v.length) return { n: 0, min: null, max: null, mean: null };
  const sum = v.reduce((a, b) => a + b, 0);
  return { n: v.length, min: Math.min(...v), max: Math.max(...v), mean: round(sum / v.length, 3) };
}

/** Compress row numbers like [2,3,4,9] into "2–4, 9". */
export function rowRanges(rows: number[]): string {
  const s = [...new Set(rows)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(i === j ? `${s[i]}` : `${s[i]}–${s[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
