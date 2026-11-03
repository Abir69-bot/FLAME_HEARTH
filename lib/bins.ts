/** Shared O2 × pressure bins for the gap finder and the gap heatmap. Lower edge inclusive. */
export const O2_BINS: [number, number][] = [
  [10, 15], [15, 21], [21, 25], [25, 30], [30, 35], [35, 40], [40, 50], [50, 70], [70, 100.0001],
];
export const P_BINS: [number, number][] = [
  [0, 5], [5, 8], [8, 11], [11, 14], [14, 16], [16, 25], [25, 50], [50, 80],
];

export function binIndex(bins: [number, number][], v: number | null | undefined): number {
  if (v == null) return -1;
  return bins.findIndex(([lo, hi]) => v >= lo && v < hi);
}

export function binLabel([lo, hi]: [number, number], unit: string): string {
  return `${lo}–${Math.round(hi)} ${unit}`;
}
