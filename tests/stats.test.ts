import { describe as group, expect, it } from "vitest";
import { describe, histogram, incompleteBeta, mean, median, niceWidth, ols, pearson, percentile, ranks, sd, sig, spearman, tTwoSidedP, variance, welch } from "@/lib/stats";

/** Expected values are worked by hand or from closed forms, not copied from this code's output. */
group("basic statistics", () => {
  it("mean, variance, sd, with the n − 1 definition", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(variance([2, 4, 6])).toBe(4);
    expect(sd([2, 4, 6])).toBe(2);
  });

  it("percentiles interpolate between ranks", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 25)).toBe(1.75);
    expect(percentile([4, 1, 3, 2], 100)).toBe(4);
    expect(median([5, 1, 3])).toBe(3);
  });

  it("empty or too-short input gives null, never a number", () => {
    expect(mean([])).toBeNull();
    expect(variance([1])).toBeNull();
    expect(percentile([], 50)).toBeNull();
    expect(describe([]).mean).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(welch([1], [1, 2])).toBeNull();
    expect(ols([[1], [2]], [1, 2])).toBeNull();
  });

  it("sig keeps 6 significant digits", () => {
    expect(sig(123456.789)).toBe(123457);
    expect(sig(0.000123456789)).toBe(0.000123457);
    expect(sig(0)).toBe(0);
  });
});

group("t distribution", () => {
  it("matches the closed forms for 1 and 2 degrees of freedom", () => {
    // df = 1 (Cauchy): p = 1 − (2/π)·atan(t). df = 2: p = 1 − t/√(2 + t²).
    expect(tTwoSidedP(1, 1)).toBeCloseTo(0.5, 8);
    expect(tTwoSidedP(3, 1)).toBeCloseTo(1 - (2 / Math.PI) * Math.atan(3), 8);
    expect(tTwoSidedP(1, 2)).toBeCloseTo(1 - 1 / Math.sqrt(3), 8);
    expect(tTwoSidedP(2.5, 2)).toBeCloseTo(1 - 2.5 / Math.sqrt(2 + 6.25), 8);
  });

  it("matches published critical values", () => {
    expect(tTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(tTwoSidedP(2.086, 20)).toBeCloseTo(0.05, 3);
    expect(tTwoSidedP(2.576, 1e6)).toBeCloseTo(0.01, 3);
  });

  it("is 1 at t = 0 and symmetric", () => {
    expect(tTwoSidedP(0, 7)).toBeCloseTo(1, 10);
    expect(tTwoSidedP(-2, 7)).toBeCloseTo(tTwoSidedP(2, 7)!, 12);
  });

  it("incomplete beta matches a known case: I_x(1, 1) = x", () => {
    expect(incompleteBeta(0.3, 1, 1)).toBeCloseTo(0.3, 8);
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
  });
});

group("correlation", () => {
  const x = [1, 2, 3, 4, 5];
  const y = [2, 4, 5, 4, 5];

  it("pearson by hand: Sxy 6, Sxx 10, Syy 6", () => {
    const c = pearson(x, y)!;
    expect(c.r).toBeCloseTo(6 / Math.sqrt(60), 10);
    // t = r√3/√(1 − r²) with df 3, checked against the same formula directly
    expect(c.p).toBeCloseTo(tTwoSidedP((c.r * Math.sqrt(3)) / Math.sqrt(1 - c.r * c.r), 3)!, 10);
    expect(c.n).toBe(5);
  });

  it("a perfect line has r of exactly ±1", () => {
    expect(pearson(x, x.map((v) => 3 * v + 1))!.r).toBeCloseTo(1, 12);
    expect(pearson(x, x.map((v) => -v))!.r).toBeCloseTo(-1, 12);
  });

  it("a column that does not vary has no correlation", () => {
    expect(pearson(x, [7, 7, 7, 7, 7])).toBeNull();
    expect(pearson([0.21, 0.21, 0.21, 0.21], [1, 2, 3, 4])).toBeNull();
  });

  it("ties share their average rank", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });

  it("spearman sees a curved but always-rising trend as perfect", () => {
    expect(spearman(x, x.map((v) => v ** 3))!.r).toBeCloseTo(1, 12);
    expect(pearson(x, x.map((v) => v ** 3))!.r).toBeLessThan(1);
  });
});

group("regression", () => {
  it("one predictor by hand: slope 0.6, intercept 2.2, R² 0.6, slope SE √0.08", () => {
    const f = ols([[1], [2], [3], [4], [5]], [2, 4, 5, 4, 5])!;
    expect(f.coefficients[0].estimate).toBeCloseTo(0.6, 10);
    expect(f.intercept).toBeCloseTo(2.2, 10);
    expect(f.r2).toBeCloseTo(0.6, 10);
    expect(f.coefficients[0].se).toBeCloseTo(Math.sqrt(0.08), 10);
    expect(f.df).toBe(3);
    expect(f.residual_se).toBeCloseTo(Math.sqrt(0.8), 10);
  });

  it("recovers an exact two-predictor plane", () => {
    const X = [[1, 2], [2, 1], [3, 5], [4, 3], [5, 8], [6, 2]];
    const f = ols(X, X.map(([a, b]) => 1 + 2 * a + 3 * b))!;
    expect(f.intercept).toBeCloseTo(1, 8);
    expect(f.coefficients[0].estimate).toBeCloseTo(2, 8);
    expect(f.coefficients[1].estimate).toBeCloseTo(3, 8);
    expect(f.r2).toBeCloseTo(1, 10);
  });

  it("stays accurate with very different units", () => {
    const X = [[0.001, 2000], [0.002, 3100], [0.003, 2200], [0.004, 4000], [0.005, 2900], [0.006, 3500]];
    const f = ols(X, X.map(([a, b]) => 5 + 1000 * a + 0.01 * b))!;
    expect(f.coefficients[0].estimate).toBeCloseTo(1000, 5);
    expect(f.coefficients[1].estimate).toBeCloseTo(0.01, 8);
  });

  it("refuses predictors that move together, or that never change", () => {
    const a = [1, 2, 3, 4, 5, 6];
    expect(ols(a.map((v) => [v, 2 * v]), [1, 3, 2, 5, 4, 6])).toBeNull();
    expect(ols(a.map(() => [4]), [1, 3, 2, 5, 4, 6])).toBeNull();
    expect(ols(a.map((v) => [v]), [4, 4, 4, 4, 4, 4])).toBeNull();
  });
});

group("Welch t-test", () => {
  it("by hand: means 3 and 6, variances 2.5 and 10", () => {
    const w = welch([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])!;
    expect(w.difference).toBe(-3);
    expect(w.t).toBeCloseTo(-3 / Math.sqrt(2.5), 10);
    expect(w.df).toBeCloseTo(6.25 / 1.0625, 10);
    expect(w.p).toBeCloseTo(tTwoSidedP(w.t, w.df)!, 12);
  });

  it("two constant groups cannot be tested", () => {
    expect(welch([2, 2], [3, 3])).toBeNull();
  });
});

group("histogram", () => {
  it("counts every value exactly once, and the maximum lands in the last bin", () => {
    const v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const h = histogram(v, { bins: 5 });
    expect(h.length).toBe(5);
    expect(h.reduce((s, b) => s + b.n, 0)).toBe(v.length);
    expect(h[4].n).toBe(3); // 8, 9, 10
  });

  it("asking for a number of bins gives round edges, not 17.2143–22.4286", () => {
    const h = histogram([12, 20, 35, 60, 85], { bins: 7 });
    expect(h[0].from).toBe(10);
    expect(h[0].to).toBe(20);
    expect(h[h.length - 1].to).toBe(90);
    expect(h.reduce((s, b) => s + b.n, 0)).toBe(5);
  });

  it("picks readable widths", () => {
    expect(niceWidth(1.3)).toBe(1);
    expect(niceWidth(2)).toBe(2);
    expect(niceWidth(3)).toBe(2.5);
    expect(niceWidth(6)).toBe(5);
    expect(niceWidth(8)).toBe(10);
    expect(niceWidth(10)).toBe(10);
    expect(niceWidth(0.06)).toBeCloseTo(0.05, 12);
  });

  it("a fixed width starts on a round edge", () => {
    const h = histogram([12, 13, 27], { width: 5 });
    expect(h[0].from).toBe(10);
    expect(h[h.length - 1].to).toBe(30);
    expect(h.reduce((s, b) => s + b.n, 0)).toBe(3);
  });

  it("a value exactly on an edge belongs to the upper bin", () => {
    expect(histogram([10, 15, 20], { width: 5 }).map((b) => b.n)).toEqual([1, 2]);
  });

  it("handles no values and a single repeated value", () => {
    expect(histogram([])).toEqual([]);
    expect(histogram([4, 4, 4])).toEqual([{ from: 4, to: 4, n: 3 }]);
  });

  it("caps an absurdly narrow width instead of building millions of bins", () => {
    const h = histogram([0, 1000], { width: 0.0001 });
    expect(h.length).toBe(500);
    expect(h.reduce((s, b) => s + b.n, 0)).toBe(2);
  });
});
