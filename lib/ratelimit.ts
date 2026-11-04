/** Small in-memory sliding-window rate limiter (per server instance). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    public readonly limit: number,
    public readonly windowMs: number,
  ) {}

  /** Returns 0 when allowed (and records the hit), otherwise the seconds to wait. */
  check(key: string, now = Date.now()): number {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return Math.ceil((this.windowMs - (now - list[0])) / 1000);
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) this.hits.delete(this.hits.keys().next().value as string);
    return 0;
  }
}

/** VESTA: 12 questions per 5 minutes per visitor. */
export const vestaLimiter = new RateLimiter(12, 5 * 60_000);

/** Memoise pure functions of static data (map, rank, gaps, safety, coverage). */
export function memo<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  const m = new Map<string, R>();
  return (...a: A) => {
    const k = JSON.stringify(a);
    if (!m.has(k)) {
      if (m.size > 200) m.clear();
      m.set(k, fn(...a));
    }
    return m.get(k)!;
  };
}
