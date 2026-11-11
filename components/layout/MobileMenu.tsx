"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconClose, IconMenu } from "@/components/ui/Icons";
import { isActive, NAV_GROUPS } from "./nav";

/** Menu button + slide-in sheet for screens narrower than the side menu breakpoint. */
export function MobileMenu() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("a[aria-current='page'], a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-text vesta:hidden"
      >
        <IconMenu />
        <span>Menu</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 vesta:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div ref={sheet} id="mobile-menu" className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] animate-slideInLeft flex-col overflow-y-auto border-r border-line bg-panel p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-head text-lg font-bold tracking-wider">HEARTH</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted hover:text-text" aria-label="Close menu">
                <IconClose />
              </button>
            </div>
            <nav aria-label="Main (phone)" className="space-y-4">
              {NAV_GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{g.title}</p>
                  <ul className="space-y-0.5">
                    {g.items.map(({ href, label, hint, Icon }) => {
                      const active = isActive(href, path);
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-start gap-3 rounded-md px-2 py-2.5 ${active ? "bg-ember/15 text-text" : "text-text/90 hover:bg-raised"}`}
                          >
                            <Icon className={`mt-0.5 shrink-0 ${active ? "text-ember" : "text-muted"}`} />
                            <span>
                              <span className="block text-sm">{label}</span>
                              <span className="block text-[11px] text-muted">{hint}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
