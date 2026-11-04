"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUp } from "@/components/ui/CountUp";
import { PolarisMark } from "@/components/ui/Polaris";
import { Orb } from "@/components/vesta/Orb";
import { useVesta } from "@/components/vesta/useVesta";
import { useHearth } from "@/lib/store";

const INVESTIGATIONS = [
  { name: "ACME", cls: "text-acme border-acme/40" },
  { name: "CFI", cls: "text-cfi border-cfi/40" },
  { name: "SPICE", cls: "text-spice border-spice/40" },
];

/** Overview opening: who built this, what it does, and the two most useful first actions. */
export function HeroBand() {
  const busy = useHearth((s) => s.busy);
  const { send } = useVesta();
  const [tests, setTests] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/tests?page_size=1")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setTests(j.total))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-label="Introduction" className="relative flex animate-fadeUp flex-wrap items-center justify-between gap-x-6 gap-y-3 py-1">
      <div className="min-w-0 flex-1 basis-[420px]">
        <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-[0.2em] text-star">
          <PolarisMark size={13} className="animate-twinkle" />
          Team Polaris <span className="text-muted"><span className="hidden sm:inline">· </span>NASA Space Apps Challenge 2026</span>
        </p>
        <h1 className="fire-text mt-1 font-head text-3xl font-bold leading-[1.15] tracking-wide [text-wrap:balance] sm:text-[2.15rem]">Fire-safety intelligence for crewed habitats</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          <b className="font-semibold text-text">HEARTH</b> (Habitat Environment Analysis &amp; Risk Tracking Hub) turns NASA microgravity combustion data into evidence you can use, with VESTA, your AI crewmate.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => send("Run a safety audit for this mission")} className="btn-ember">
            Run a safety audit
          </button>
          <Link href="/explorer" className="btn-ghost">
            Explore the tests
          </Link>
          <span className="ml-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {tests != null && (
              <span>
                <b className="font-mono text-sm font-medium text-text">
                  <CountUp value={tests} />
                </b>{" "}
                NASA tests from
              </span>
            )}
            {INVESTIGATIONS.map((i) => (
              <span key={i.name} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${i.cls}`}>
                {i.name}
              </span>
            ))}
          </span>
        </div>
      </div>
      <figure className="hidden flex-col items-center sm:flex">
        <Orb thinking={busy} size={140} variant="flame" />
        <figcaption className="max-w-[170px] text-center text-[10px] leading-tight text-muted">Artwork: flames burn round in microgravity. Not a simulation.</figcaption>
      </figure>
    </section>
  );
}
