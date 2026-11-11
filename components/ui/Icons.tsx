type P = { className?: string };
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconOverview = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconDatabase = (p: P) => (
  <svg {...base} className={p.className}><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
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
export const IconCheck = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
);
export const IconAudit = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 3c1 3.5 6 5.5 6 11a6 6 0 01-12 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3-.5-3 .5-6 1.5-9z" /></svg>
);
export const IconRank = (p: P) => (
  <svg {...base} className={p.className}><path d="M5 6h14M5 12h9M5 18h5" /></svg>
);
export const IconGap = (p: P) => (
  <svg {...base} className={p.className}><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21M11 8v3.5M11 14v.2" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base} className={p.className}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base} className={p.className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
);
export const IconPin = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 17v4M8 3h8l-1 6 3 3H6l3-3z" /></svg>
);
export const IconInsights = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 20h16" /><circle cx="7" cy="14" r="1.6" /><circle cx="11" cy="9" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="19" cy="5" r="1.6" /></svg>
);
export const IconReport = (p: P) => (
  <svg {...base} className={p.className}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} className={p.className}><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
);
export const IconMenu = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
