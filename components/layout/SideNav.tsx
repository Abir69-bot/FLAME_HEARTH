"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PolarisMark } from "@/components/ui/Polaris";
import { isActive, NAV_GROUPS } from "./nav";

export { NAV } from "./nav";

/** Grouped side menu on wide screens. Phones use the menu button in the top bar instead. */
export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden vesta:block vesta:w-56 vesta:shrink-0 vesta:border-r vesta:border-line">
      <div className="sticky top-[49px] flex h-[calc(100vh-49px)] flex-col overflow-y-auto">
        <div className="space-y-4 px-3 py-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/80">{g.title}</p>
              <ul className="space-y-0.5">
                {g.items.map(({ href, label, Icon }) => {
                  const active = isActive(href, path);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`group flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                          active ? "bg-gradient-to-r from-ember/20 to-raised text-text shadow-[inset_2px_0_0_var(--ember),0_0_16px_rgba(255,122,47,0.14)]" : "text-muted hover:bg-panel hover:text-text"
                        }`}
                      >
                        <Icon className={`transition-transform group-hover:scale-110 ${active ? "text-ember" : ""}`} />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {/* Team card: the star above it is Polaris, drawn by the backdrop */}
        <Link href="/about" className="m-3 mt-auto block rounded-lg border border-star/25 bg-panel/80 p-3 transition hover:border-star/60">
          <span className="flex items-center gap-1.5 font-head text-sm font-bold tracking-wider text-star">
            <PolarisMark size={14} className="animate-twinkle" />
            Team Polaris
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">NASA Space Apps Challenge 2026</span>
        </Link>
      </div>
    </nav>
  );
}
