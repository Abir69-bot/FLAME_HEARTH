type P = { className?: string };
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconOverview = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconTable = (p: P) => (
  <svg {...base} className={p.className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
);
export const IconCompare = (p: P) => (
  <svg {...base} className={p.className}><path d="M6 20V10M12 20V4M18 20v-7" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconLab = (p: P) => (
  <svg {...base} className={p.className}><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
);
export const IconSend = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 12l16-8-6 16-2-6z" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base} className={p.className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconPin = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 17v4M8 3h8l-1 6 3 3H6l3-3z" /></svg>
);
