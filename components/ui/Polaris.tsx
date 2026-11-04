import Link from "next/link";

/** The Team Polaris mark: a north star with long vertical rays. */
export function PolarisMark({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M12 6.5l1 4.5 4.5 1-4.5 1-1 4.5-1-4.5-4.5-1 4.5-1z" fill="currentColor" opacity="0.45" transform="rotate(45 12 12)" />
      <path d="M12 0.5l3 8.5 8.5 3-8.5 3-3 8.5-3-8.5-8.5-3 8.5-3z" fill="currentColor" />
    </svg>
  );
}

/** Compact team badge for the top bar; links to the About page. */
export function TeamBadge() {
  return (
    <Link href="/about" className="team-badge" aria-label="Team Polaris, about this project">
      <PolarisMark size={13} className="animate-twinkle" />
      <span>
        Team <span className="font-bold">Polaris</span>
      </span>
    </Link>
  );
}
