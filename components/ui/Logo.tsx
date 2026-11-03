export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="HEARTH logo: a flame inside a ring"
      className={className}
    >
      <defs>
        <linearGradient id="hearth-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FF7A2F" />
          <stop offset="100%" stopColor="#FFB98A" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#1F2A44" strokeWidth="4" />
      <circle cx="32" cy="32" r="28" fill="none" stroke="#FF7A2F" strokeWidth="2.5" strokeDasharray="120 56" strokeLinecap="round" transform="rotate(-110 32 32)" />
      <path
        d="M32 12c2 7 10 11 10 21a10 10 0 0 1-20 0c0-5 3-8 5-10 0 4 2 6 4 6-1-6 0-11 1-17z"
        fill="url(#hearth-flame)"
      />
      <path d="M32 33c1.5 2.5 4 4 4 7a4 4 0 0 1-8 0c0-2.5 2-4.5 4-7z" fill="#070B14" opacity="0.55" />
    </svg>
  );
}
