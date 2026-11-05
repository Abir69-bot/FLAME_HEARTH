/**
 * Tested statistics (tests/stats.test.ts). Pure functions with no data access. Anything that cannot be
 * computed (too few values, a constant column, collinear predictors) returns null: callers say so
 * rather than show a made-up number.
 */

export type Num = number;

/** Keep results readable without losing meaning: 6 significant digits. */
export function sig(x: number, digits = 6): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number(x.toPrecision(digits));
}

export function mean(v: Num[]): number | null {
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Sample variance (n − 1). */
export function variance(v: Num[]): number | null {
  if (v.length < 2) return null;
  const m = mean(v)!;
  return v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1);
}

export function sd(v: Num[]): number | null {
  const s = variance(v);
  return s == null ? null : Math.sqrt(s);
}

/** Percentile with linear interpolation between ranks (the common "type 7" definition). p is 0–100. */
export function percentile(v: Num[], p: number): number | null {
  if (!v.length || p < 0 || p > 100) return null;
  const s = [...v].sort((a, b) => a - b);
  const h = (p / 100) * (s.length - 1);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (s[hi] - s[lo]) * (h - lo);
}

export function median(v: Num[]): number | null {
  return percentile(v, 50);
}

export interface Described {
  n: number;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
  mean: number | null;
  sd: number | null;
}

export function describe(v: Num[]): Described {
  const r = (x: number | null) => (x == null ? null : sig(x));
  return {
    n: v.length,
    min: v.length ? sig(Math.min(...v)) : null,
    p25: r(percentile(v, 25)),
    median: r(median(v)),
    p75: r(percentile(v, 75)),
    max: v.length ? sig(Math.max(...v)) : null,
    mean: r(mean(v)),
    sd: r(sd(v)),
  };
}

// ---- distributions -------------------------------------------------------------------------------

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const t = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let s = 1.000000000190015;
  for (const k of c) s += k / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}

/** Continued fraction for the incomplete beta function (Lentz's method). */
function betaCf(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaCf(a, b, x)) / a : 1 - (front * betaCf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student's t with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number | null {
  if (!Number.isFinite(t) || !(df > 0)) return null;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

// ---- association ---------------------------------------------------------------------------------

export interface Correlation {
  n: number;
  r: number;
  p: number | null;
}

export function pearson(x: Num[], y: Num[]): Correlation | null {
  const n = x.length;
  if (n !== y.length || n < 3) return null;
  const mx = mean(x)!;
  const my = mean(y)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  // A column that does not vary has no correlation at all. Relative test, so rounding noise doesn't count.
  if (sxx <= 1e-20 * (mx * mx * n + 1e-300) || syy <= 1e-20 * (my * my * n + 1e-300) || sxx === 0 || syy === 0) return null;
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  if (n === 2 || Math.abs(r) === 1) return { n, r, p: n > 2 ? 0 : null };
  return { n, r, p: tTwoSidedP(r * Math.sqrt((n - 2) / (1 - r * r)), n - 2) };
}

/** Ranks with ties sharing their average rank. */
export function ranks(v: Num[]): number[] {
  const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(v.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) out[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}

export function spearman(x: Num[], y: Num[]): Correlation | null {
  return pearson(ranks(x), ranks(y));
}

// ---- regression ----------------------------------------------------------------------------------

export interface OlsFit {
  n: number;
  df: number;
  intercept: number;
  /** One per predictor, in the given order. */
  coefficients: { estimate: number; se: number | null; t: number | null; p: number | null }[];
  r2: number;
  adj_r2: number | null;
  residual_se: number | null;
}

/** Invert a symmetric matrix by Gauss-Jordan with partial pivoting. Null when singular (collinear predictors). */
function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-11) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((row) => row.slice(n));
}

/**
 * Ordinary least squares with an intercept. `X` is one row per observation. Predictors are centred and
 * scaled internally so very different units (0.2 vs 2700) stay numerically stable; results are in the
 * original units.
 */
export function ols(X: Num[][], y: Num[]): OlsFit | null {
  const n = y.length;
  if (!n || X.length !== n) return null;
  const k = X[0].length;
  if (!k || n < k + 2) return null;

  const my = mean(y)!;
  const cols = Array.from({ length: k }, (_, j) => X.map((row) => row[j]));
  const means = cols.map((c) => mean(c)!);
  const scales = cols.map((c) => sd(c) ?? 0);
  if (scales.some((s) => !(s > 0))) return null; // a predictor that never changes cannot be fitted

  const Z = X.map((row) => row.map((v, j) => (v - means[j]) / scales[j]));
  const yc = y.map((v) => v - my);
  const ZtZ = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => Z.reduce((s, row) => s + row[a] * row[b], 0)));
  const norm = ZtZ.map((row) => row.map((v) => v / (n - 1))); // correlation matrix: conditioning check is scale-free
  const invNorm = invert(norm);
  if (!invNorm) return null;
  const inv = invNorm.map((row) => row.map((v) => v / (n - 1)));
  const Zty = Array.from({ length: k }, (_, a) => Z.reduce((s, row, i) => s + row[a] * yc[i], 0));
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Zty[j], 0));

  let sse = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const fit = Z[i].reduce((s, z, j) => s + z * beta[j], 0);
    sse += (yc[i] - fit) ** 2;
    sst += yc[i] ** 2;
  }
  if (sst === 0) return null; // the outcome never changes
  const df = n - k - 1;
  const s2 = df > 0 ? sse / df : null;
  const coefficients = beta.map((b, j) => {
    const estimate = b / scales[j];
    const seZ = s2 != null ? Math.sqrt(Math.max(0, s2 * inv[j][j])) : null;
    const se = seZ != null ? seZ / scales[j] : null;
    const t = se ? estimate / se : null;
    return { estimate, se, t, p: t != null ? tTwoSidedP(t, df) : se === 0 ? 0 : null };
  });
  const intercept = my - coefficients.reduce((s, c, j) => s + c.estimate * means[j], 0);
  const r2 = 1 - sse / sst;
  return {
    n,
    df,
    intercept,
    coefficients,
    r2,
    adj_r2: df > 0 ? 1 - ((1 - r2) * (n - 1)) / df : null,
    residual_se: s2 != null ? Math.sqrt(s2) : null,
  };
}

// ---- groups --------------------------------------------------------------------------------------

export interface WelchResult {
  n_a: number;
  n_b: number;
  mean_a: number;
  mean_b: number;
  difference: number;
  t: number;
  df: number;
  p: number | null;
}

/** Welch's t-test: compares two means without assuming equal variance. */
export function welch(a: Num[], b: Num[]): WelchResult | null {
  if (a.length < 2 || b.length < 2) return null;
  const va = variance(a)! / a.length;
  const vb = variance(b)! / b.length;
  if (va + vb === 0) return null;
  const mean_a = mean(a)!;
  const mean_b = mean(b)!;
  const t = (mean_a - mean_b) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { n_a: a.length, n_b: b.length, mean_a, mean_b, difference: mean_a - mean_b, t, df, p: tTwoSidedP(t, df) };
}

export interface HistBin {
  from: number;
  to: number;
  n: number;
}

/** The readable width (1, 2, 2.5, 5 or 10 × a power of ten) nearest a raw width. */
export function niceWidth(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * mag;
}

/** Equal-width bins on round edges. Give `width`, or roughly how many `bins` (default 10). The last bin includes the maximum value. */
export function histogram(v: Num[], opts: { bins?: number; width?: number } = {}): HistBin[] {
  if (!v.length) return [];
  const min = Math.min(...v);
  const max = Math.max(...v);
  if (min === max) return [{ from: min, to: max, n: v.length }];
  let width = opts.width && opts.width > 0 ? opts.width : niceWidth((max - min) / (opts.bins && opts.bins > 0 ? opts.bins : 10));
  let start = Math.floor(min / width + 1e-9) * width;
  let count = Math.max(1, Math.ceil((max - start) / width - 1e-9));
  if (count > 500) {
    // A very narrow width on a wide range would make an unreadable table: fall back to 500 bins.
    count = 500;
    start = min;
    width = (max - min) / count;
  }
  const out: HistBin[] = Array.from({ length: count }, (_, i) => ({ from: sig(start + i * width), to: sig(start + (i + 1) * width), n: 0 }));
  for (const x of v) {
    const i = Math.min(count - 1, Math.max(0, Math.floor((x - start) / width + 1e-9)));
    out[i].n++;
  }
  return out;
}
