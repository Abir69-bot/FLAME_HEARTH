/**
 * Grounding check: every number in VESTA's answer must appear in a tool result or in the user's
 * message (rounding allowed, % ↔ fraction allowed). Small counting numbers (0–10) are allowed.
 */

export const SMALL_INT_MAX = 10;

/** Collect every finite number inside a JSON value, including numbers written inside strings. */
export function collectNumbers(value: unknown, into: Set<number> = new Set()): Set<number> {
  if (typeof value === "number") {
    if (Number.isFinite(value)) into.add(value);
  } else if (typeof value === "string") {
    for (const n of extractNumbers(value, { keepSmall: true })) into.add(n.value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectNumbers(v, into);
  }
  return into;
}

export interface FoundNumber {
  raw: string;
  value: number;
  decimals: number;
}

// Things that contain digits but are not quantities: test ids, chemical formulas, page / row refs,
// versions, model names, dates and times.
const NOT_QUANTITIES: RegExp[] = [
  /\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b/g, // ACME-CFIG-128, CFI-FLEX-1206, SPICE-001, CFI-G
  /\b(?:[A-Z][a-z]?\d+)+\b/g, // O2, N2, C12H26, CO2
  /\bp(?:ages?)?\.?\s?\d+(?:\s?[–-]\s?\d+)?\b/gi, // p20, page 3, pp 6–9
  // row 129, rows 2–334, rows 2–68, 70–76, 78–334. A later item followed by a unit or % is a quantity, not a row.
  /\brows?\s\d+(?:\s?[–-]\s?\d+)?(?:,\s?\d+(?:\s?[–-]\s?\d+)?(?!\s*[%a-zA-Z°]|\.?\d))*/gi,
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g, // times
  /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g, // dates
  /\b[a-z]+-[a-z0-9.-]*\d[a-z0-9.-]*\b/gi, // model names like gpt-oss-120b, gemini-2.5-flash
  /\b\d+g\b/gi, // 1g
  /\b(?:FLEX|Flex|flex)\s?\d+\b/g,
];

export function extractNumbers(text: string, opts: { keepSmall?: boolean } = {}): FoundNumber[] {
  let t = text;
  for (const re of NOT_QUANTITIES) t = t.replace(re, " ");
  const out: FoundNumber[] = [];
  const re = /(?<![\w.])[-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\w])|(?<![\w.])[-−]?\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const raw = m[0];
    const value = Number(raw.replace(/,/g, "").replace("−", "-"));
    if (!Number.isFinite(value)) continue;
    if (!opts.keepSmall && Number.isInteger(value) && Math.abs(value) <= SMALL_INT_MAX) continue;
    const dec = raw.includes(".") ? raw.split(".")[1].length : 0;
    out.push({ raw, value, decimals: dec });
  }
  return out;
}

/** True when `n` (written with `decimals` digits) matches a known number after rounding, or as % ↔ fraction. */
export function matches(n: number, decimals: number, known: Iterable<number>): boolean {
  const tol = 0.5 * 10 ** -decimals + 1e-9;
  for (const k of known) {
    for (const cand of [k, k * 100, k / 100]) {
      // rounding to the written precision is fine: 2.79 for 2.788, 48 for 48.006
      if (Math.abs(cand - n) <= tol) return true;
    }
    if (Math.abs(Math.abs(k) - Math.abs(n)) <= tol) return true; // sign written in words ("−5.92" as "5.92 below zero")
  }
  return false;
}

export interface GroundingResult {
  ok: boolean;
  unverified: string[];
  checked: number;
}

export function checkGrounding(answer: string, known: Set<number>): GroundingResult {
  const nums = extractNumbers(answer);
  const unverified = nums.filter((n) => !matches(n.value, n.decimals, known)).map((n) => n.raw);
  return { ok: unverified.length === 0, unverified: [...new Set(unverified)], checked: nums.length };
}

export const UNVERIFIED_NOTE = "Some figures could not be verified.";

export function fixRequest(unverified: string[]): string {
  return (
    `Grounding check: these numbers in your answer do not appear in any tool result or in my message: ${unverified.join(", ")}. ` +
    "Rewrite the answer using only numbers from tool results (call a tool if you need one), keep the sources and end with one Confidence line."
  );
}
