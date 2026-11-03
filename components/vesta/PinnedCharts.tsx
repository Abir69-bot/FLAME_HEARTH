"use client";
import { EChart } from "@/components/charts/EChart";
import { IconClose } from "@/components/ui/Icons";
import { useHearth } from "@/lib/store";

export function PinnedCharts() {
  const pinned = useHearth((s) => s.pinned);
  const unpin = useHearth((s) => s.unpin);
  return (
    <section aria-label="Pinned VESTA charts">
      <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">Pinned VESTA charts</h2>
      {pinned.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">When VESTA draws a chart, press “Pin to dashboard” to keep it here.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pinned.map((c) => (
            <figure key={c.id} className="rounded-lg border border-line bg-panel p-2">
              <div className="flex justify-end">
                <button type="button" onClick={() => unpin(c.id)} className="rounded p-1 text-muted hover:text-text" aria-label={`Unpin ${c.title}`}>
                  <IconClose className="h-4 w-4" />
                </button>
              </div>
              <EChart option={c.option} height={240} ariaLabel={`Pinned chart: ${c.title}`} />
              {c.source_note && <figcaption className="mt-1 text-[10px] text-muted">{c.source_note}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
