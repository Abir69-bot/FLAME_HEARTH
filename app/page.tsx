import { Logo } from "@/components/ui/Logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="animate-flicker">
        <Logo size={96} />
      </div>
      <h1 className="font-head text-4xl font-bold tracking-wide sm:text-5xl">
        HEARTH <span className="text-ember">·</span> Team Polaris
      </h1>
      <p className="max-w-xl text-lg text-muted">Fire-safety intelligence for crewed habitats</p>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        Habitat Environment Analysis &amp; Risk Tracking Hub
      </p>
      <div className="mt-4 flex gap-3 text-xs font-mono">
        <span className="rounded border border-line bg-panel px-3 py-1 text-acme">ACME</span>
        <span className="rounded border border-line bg-panel px-3 py-1 text-cfi">CFI</span>
        <span className="rounded border border-line bg-panel px-3 py-1 text-spice">SPICE</span>
      </div>
    </main>
  );
}
