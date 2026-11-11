"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconSearch } from "@/components/ui/Icons";
import { MISSIONS } from "@/lib/missions";
import { useHearth } from "@/lib/store";
import { NAV } from "./nav";

export const OPEN_PALETTE_EVENT = "hearth:open-palette";

/** Opens the palette from anywhere (top-bar button, phone menu). */
export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

interface Item {
  id: string;
  group: "Pages" | "Missions" | "Tests" | "Ask";
  label: string;
  hint: string;
  run: () => void;
}

interface TestHit {
  test_id: string;
  investigation: string;
  fuel: string | null;
  o2_pct: number | null;
  pressure_psi: number | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Ctrl/⌘ + K: jump to a page, switch mission, open a test by id or fuel, or hand a question to VESTA. */
export function CommandPalette() {
  const router = useRouter();
  const setMission = useHearth((s) => s.setMission);
  const openTest = useHearth((s) => s.openTest);
  const setDraft = useHearth((s) => s.setDraft);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [tests, setTests] = useState<TestHit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setTests([]);
    lastFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const show = () => {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
      setActive(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, show);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  // tests: ask the API once the visitor pauses typing
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setTests([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/tests?q=${encodeURIComponent(term)}&page_size=6`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j: { rows: TestHit[] }) => setTests(j.rows))
        .catch(() => {
          /* aborted or offline: pages and missions still work */
        });
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const term = norm(q);
    const match = (...texts: string[]) => !term || texts.some((x) => norm(x).includes(term));
    const out: Item[] = [];
    for (const n of NAV) if (match(n.label, n.hint)) out.push({ id: `page:${n.href}`, group: "Pages", label: n.label, hint: n.hint, run: () => router.push(n.href) });
    for (const m of MISSIONS)
      if (match(m.name, m.short, "mission"))
        out.push({ id: `mission:${m.id}`, group: "Missions", label: `Switch to ${m.short}`, hint: `${m.o2_pct}% O2 · ${m.pressure_psi} psi${m.demo ? " · demo" : ""}`, run: () => setMission(m.id) });
    for (const t of tests)
      out.push({
        id: `test:${t.test_id}`,
        group: "Tests",
        label: t.test_id,
        hint: `${t.investigation} · ${t.fuel ?? "fuel missing"} · ${t.o2_pct ?? "?"}% O2 · ${t.pressure_psi ?? "?"} psi`,
        run: () => openTest(t.test_id),
      });
    if (q.trim().length >= 3)
      out.push({
        id: "ask",
        group: "Ask",
        label: `Ask VESTA: “${q.trim()}”`,
        hint: "Puts the question in the VESTA box",
        run: () => {
          setDraft(q.trim());
          const panel = document.getElementById("vesta-panel");
          panel?.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => document.getElementById("vesta-input")?.focus(), 250);
        },
      });
    return out;
  }, [q, tests, router, setMission, openTest, setDraft]);

  useEffect(() => setActive(0), [q, tests.length]);

  if (!open) return null;

  const choose = (it: Item | undefined) => {
    if (!it) return;
    const keepFocus = it.group === "Ask";
    setOpen(false);
    setQ("");
    setTests([]);
    it.run();
    if (!keepFocus && it.group !== "Tests") lastFocus.current?.focus?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search HEARTH">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative w-full max-w-xl animate-fadeUp overflow-hidden rounded-xl border border-line bg-panel shadow-2xl" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <IconSearch className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pages, missions, test ids or fuels… or a question for VESTA"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
            aria-autocomplete="list"
          />
          <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-muted">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" aria-label="Results" className="max-h-[55vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches. Try a test id like ACME-CFIG-001 or a fuel like propane.</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <li key={it.id} role="presentation">
                {header && <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{it.group}</p>}
                <div
                  id={`palette-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(it)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-3 py-2 text-sm ${i === active ? "bg-ember/15 text-text" : "text-text/90"}`}
                >
                  <span className={it.group === "Tests" ? "font-mono" : ""}>{it.label}</span>
                  <span className="truncate text-xs text-muted">{it.hint}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-4 py-2 font-mono text-[10px] text-muted">↑ ↓ to move · Enter to open · Ctrl/⌘ K anywhere</p>
      </div>
    </div>
  );
}
