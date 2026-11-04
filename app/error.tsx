"use client";

/** Shown when a page throws. VESTA and the data files are untouched, so a retry usually works. */
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="hud-panel mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="font-head text-xl font-semibold">This view hit a problem</h1>
      <p className="mt-2 text-sm text-muted">Nothing is lost. Try loading it again, or pick another page from the menu.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-ember px-4 py-2 text-sm font-semibold text-bg transition hover:brightness-110">
        Try again
      </button>
    </section>
  );
}
