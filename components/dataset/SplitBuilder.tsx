"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DatasetProfile } from "@/lib/dataset";
import { makeSplit, toCsv, type SplitStrategy } from "@/lib/dataset-split";
import { INVESTIGATIONS, type Investigation, type TestRecord } from "@/lib/types";
import { Chip, InvName, loadRecords, saveFile } from "./shared";

const STRATEGIES: { id: SplitStrategy; label: string; text: string }[] = [
  { id: "row", label: "Random rows", text: "Shuffles rows within each investigation, so each keeps the same share. Easy, but similar tests can land on both sides, which makes scores look better than they are." },
  { id: "fuel", label: "Unseen fuels", text: "A fuel goes entirely to one side, so the test set checks whether a model handles fuels it never saw. Whole fuels move together, so the share only gets close to your target." },
  { id: "holdout", label: "Unseen investigation", text: "Trains on two investigations and tests on the third. The hardest test, because the apparatus changes too." },
];

export function SplitBuilder({ labelled, counted }: { labelled: DatasetProfile["labelled"]; counted: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [tests, setTests] = useState<TestRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [strategy, setStrategy] = useState<SplitStrategy>("fuel");
  const [trainPct, setTrainPct] = useState(80);
  const [seed, setSeed] = useState(1);
  const [holdout, setHoldout] = useState<Investigation>("CFI");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const load = () => loadRecords().then(setTests).catch(() => setFailed(true));
    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const result = useMemo(() => (tests ? makeSplit(tests, { strategy, trainPct, seed, holdout }) : null), [tests, strategy, trainPct, seed, holdout]);
  const active = STRATEGIES.find((s) => s.id === strategy)!;
  const trainShare = result ? Math.round((100 * result.train) / (result.train + result.test)) : 0;

  const download = () => {
    if (!tests || !result) return;
    saveFile(`hearth-split-${strategy}${strategy === "holdout" ? `-${holdout}` : `-${trainPct}`}-seed${seed}.csv`, toCsv(tests, result.assign), "text/csv;charset=utf-8");
  };

  return (
    <div ref={box} className="hud-panel space-y-3 p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Split strategy">
        {STRATEGIES.map((s) => (
          <Chip key={s.id} active={s.id === strategy} onClick={() => setStrategy(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <p className="text-sm text-muted">{active.text}</p>

      <div className="flex flex-wrap items-end gap-4 text-sm">
        {strategy === "holdout" ? (
          <div role="group" aria-label="Investigation to hold out" className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Test on</span>
            {INVESTIGATIONS.map((i) => (
              <Chip key={i} active={holdout === i} onClick={() => setHoldout(i)}>
                <InvName id={i} />
              </Chip>
            ))}
          </div>
        ) : (
          <label className="min-w-[12rem] flex-1 text-xs text-muted">
            Target for training: <b className="font-mono text-text">{trainPct}%</b>
            <input type="range" min={50} max={90} step={5} value={trainPct} onChange={(e) => setTrainPct(Number(e.target.value))} className="mt-1 block w-full accent-ember" />
          </label>
        )}
        {strategy !== "holdout" && (
          <label className="text-xs text-muted">
            Seed
            <input
              type="number"
              min={0}
              value={seed}
              onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="mt-1 block w-24 rounded-md border border-line bg-bg/60 px-2 py-1 font-mono text-sm text-text"
            />
          </label>
        )}
      </div>

      {failed && <p className="text-sm text-bad">Could not load the records. Please reload the page and try again.</p>}
      {!tests && !failed && <div className="h-36 animate-pulse rounded-lg bg-raised motion-reduce:animate-none" role="status" aria-label="Loading records" />}

      {result && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-bg/60 p-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Train</p>
              <p className="font-mono text-2xl">{result.train}</p>
              <p className="text-xs text-muted">{trainShare}% of rows</p>
            </div>
            <div className="rounded-lg border border-line bg-bg/60 p-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Test</p>
              <p className="font-mono text-2xl">{result.test}</p>
              <p className="text-xs text-muted">{100 - trainShare}% of rows</p>
            </div>
            <div className="rounded-lg border border-line bg-bg/60 p-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Overlap between the sides</p>
              <p className="text-sm">
                <span className={result.sharedFuels.length ? "text-warn" : "text-ok"}>{result.sharedFuels.length ? "⚠" : "✓"}</span> <span className="font-mono">{result.sharedFuels.length}</span> fuels shared
              </p>
              <p className="text-sm">
                <span className={result.sharedConditions ? "text-warn" : "text-ok"}>{result.sharedConditions ? "⚠" : "✓"}</span> <span className="font-mono">{result.sharedConditions}</span> identical test setups shared
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1 font-medium">Investigation</th>
                  <th className="w-2/5 font-medium">Train and test</th>
                  <th className="text-right font-medium">Train</th>
                  <th className="text-right font-medium">Test</th>
                </tr>
              </thead>
              <tbody>
                {INVESTIGATIONS.map((i) => {
                  const { train, test } = result.per[i];
                  const pct = (100 * train) / Math.max(1, train + test);
                  return (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-1.5">
                        <InvName id={i} />
                      </td>
                      <td>
                        <div className="flex h-2.5 gap-0.5" aria-hidden>
                          {train > 0 && <span className="rounded-sm bg-ember transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />}
                          {test > 0 && <span className="flex-1 rounded-sm bg-star/60" />}
                        </div>
                      </td>
                      <td className="text-right font-mono">{train}</td>
                      <td className="text-right font-mono">{test}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={download} className="rounded-md bg-ember px-3 py-1.5 text-sm font-semibold text-bg transition hover:brightness-110">
              Download this split as CSV
            </button>
            <p className="min-w-[14rem] flex-1 text-xs text-muted">
              The first column is <code className="font-mono">split</code>. The {counted} counted rows only, so a duplicate can never sit on both sides. The same settings always give the same split.
            </p>
          </div>
        </>
      )}

      <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm">
        <b className="font-semibold">Check what you can actually predict.</b>{" "}
        {INVESTIGATIONS.map((i) => {
          const l = labelled[i];
          return (
            <span key={i} className="mr-1">
              {i}: {l.outcome} rows with an outcome, {l.metric} with {l.metricName ? <code className="font-mono text-xs">{l.metricName}</code> : "a metric"}.
            </span>
          );
        })}
        <span className="text-muted"> Burn time and fuel rate are different quantities, so they cannot share one target column.</span>
      </div>
    </div>
  );
}
