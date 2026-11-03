"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCompare, IconInfo, IconLab, IconOverview, IconShield, IconTable } from "@/components/ui/Icons";

export const NAV = [
  { href: "/", label: "Mission overview", Icon: IconOverview },
  { href: "/explorer", label: "Test explorer", Icon: IconTable },
  { href: "/compare", label: "Compare", Icon: IconCompare },
  { href: "/safety", label: "Safety & gaps", Icon: IconShield },
  { href: "/lab", label: "My data lab", Icon: IconLab },
  { href: "/about", label: "About", Icon: IconInfo },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="border-b border-line vesta:w-56 vesta:shrink-0 vesta:border-b-0 vesta:border-r">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 vesta:sticky vesta:top-[49px] vesta:flex-col vesta:px-3 vesta:py-4">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-raised text-text shadow-[inset_2px_0_0_var(--ember)]" : "text-muted hover:bg-panel hover:text-text"
                }`}
              >
                <Icon className={active ? "text-ember" : ""} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
