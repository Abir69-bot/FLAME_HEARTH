import type { Metadata } from "next";
import { AskVesta, CopyButton, OpenTestButton } from "@/components/dataset/DatasetActions";
import { Distributions } from "@/components/dataset/Distributions";
import { Dossiers } from "@/components/dataset/Dossiers";
import { RecordInspector } from "@/components/dataset/RecordInspector";
import { fileName, formatBytes, INV_BG, InvName, Section } from "@/components/dataset/shared";
import { SplitBuilder } from "@/components/dataset/SplitBuilder";
import { SplitExplorer } from "@/components/dataset/SplitExplorer";
import { StructureExplorer } from "@/components/dataset/StructureExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { datasetProfile } from "@/lib/dataset";
import { NASA_LINKS, REPO_BLOB } from "@/lib/dataset-docs";
import { downloadList } from "@/lib/dataset-export";
import { INVESTIGATIONS, type Investigation } from "@/lib/types";

export const metadata: Metadata = { title: "Dataset", description: "Everything about the NASA data behind HEARTH: where it comes from, how it is structured and split, its limits, and how to download it." };

const SITE = "https://project-hearth-five.vercel.app/dataset";

const NAV = [
  ["flow", "Data flow"],
  ["split", "The split"],
  ["structure", "Structure"],
  ["investigations", "Investigations"],
  ["distributions", "Distributions"],
  ["inspector", "Raw vs clean"],
  ["quality", "Quality"],
  ["modelling", "Modelling"],
  ["download", "Download"],
  ["references", "NASA sources"],
];

function citation(r: { authors: string; date: string; title: string; file: string }) {
  const by = r.authors.includes("not stated") ? "NASA" : r.authors;
  const when = r.date.includes("not stated") ? "n.d." : r.date;
  return `${by}. ${when}. ${r.title}. NASA Physical Sciences Informatics. File: ${fileName(r.file)}.`;
}

export default function DatasetPage() {
  const p = datasetProfile();
  const t = p.totals;
  const downloads = downloadList();
  const hearthCitation = `Team Polaris (2026). HEARTH processed microgravity combustion dataset: ACME/CFI-G, CFI and SPICE. NASA Space Apps Challenge 2026. Derived from NASA Physical Sciences Informatics files. ${SITE}`;

  const tiles: [string, string, string][] = [
    [`${t.investigations}`, "NASA investigations", "ACME, CFI and SPICE"],
    [`${t.fuels}`, "fuels and mixtures", "gas and liquid"],
    [`${t.fields}`, "fields per record", `plus ${t.extraFields} raw values`],
    [`${t.rawFiles}`, "raw NASA files", formatBytes(t.rawBytes)],
    [`${t.pdfPages}`, "PDF pages read", `from ${t.pdfs} documents`],
    [`${t.chunks.toLocaleString("en-US")}`, "searchable passages", "for VESTA, with page numbers"],
    [`${t.pdfTables}`, "tables from PDFs", "with file and page"],
    [`${p.dimensions.find((d) => d.id === "gravity")!.counted.length}`, "gravity level", "microgravity only"],
  ];

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Open the black box" title="The dataset">
        Everything behind the numbers on this site: where the data comes from, how it is built and divided, what it cannot tell you, and how to take it with you.
      </PageHeader>

      <nav aria-label="On this page" className="sticky top-[49px] z-20 hidden gap-1 overflow-x-auto rounded-lg border border-line bg-panel/95 p-1 backdrop-blur vesta:flex">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-raised hover:text-text">
            {label}
          </a>
        ))}
      </nav>
      <nav aria-label="On this page" className="flex gap-1 overflow-x-auto pb-1 vesta:hidden">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-md border border-line bg-panel/90 px-2 py-1 text-xs text-muted">
            {label}
          </a>
        ))}
      </nav>

      <section aria-label="Dataset at a glance" className="hud-panel animate-fadeUp overflow-hidden p-4 sm:p-5 motion-reduce:animate-none">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <p className="fire-text font-head text-6xl font-bold leading-none tracking-wide sm:text-7xl">{t.counted}</p>
            <p className="mt-1 font-head text-lg font-semibold">microgravity combustion tests</p>
            <p className="mt-1 text-sm text-muted">
              <span className="font-mono text-text">{t.rows}</span> rows in NASA&apos;s tables, minus <span className="font-mono text-text">{t.duplicates}</span> exact duplicates that are flagged and never counted twice.
            </p>
            <div className="mt-4" aria-hidden>
              <div className="flex h-4 gap-0.5 overflow-hidden rounded">
                {p.byInvestigation.map((i) => (
                  <span key={i.id} className={`${INV_BG[i.id]} origin-left animate-fadeUp motion-reduce:animate-none`} style={{ width: `${(100 * i.counted) / t.counted}%` }} />
                ))}
              </div>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {p.byInvestigation.map((i) => (
                <li key={i.id}>
                  <InvName id={i.id} /> <span className="font-mono">{i.counted}</span> <span className="font-mono text-xs text-muted">{((100 * i.counted) / t.counted).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid grid-cols-2 gap-2 self-start sm:grid-cols-4">
            {tiles.map(([value, label, sub]) => (
              <li key={label} className="rounded-lg border border-line bg-bg/60 p-2.5">
                <p className="font-mono text-xl">{value}</p>
                <p className="text-xs">{label}</p>
                <p className="text-[10px] text-muted">{sub}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section
        id="flow"
        eyebrow="How it is stored"
        title="There is no database server, on purpose"
        intro={<>HEARTH&apos;s &ldquo;database&rdquo; is a set of plain JSON files committed with the code. Every record keeps its source file and row, any change to the data shows up in the project&apos;s git history, and there is no database service that could go down. A Python script builds the files once; the app validates them with zod when it loads them and searches the PDF text with MiniSearch.</>}
      >
        <ol className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <li className="hud-panel p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ember-soft">1 · NASA files</p>
            <p className="mt-1 font-head font-semibold">{t.rawFiles} raw files, read only</p>
            <p className="text-xs text-muted">One table, one report and one engineering document for each investigation.</p>
            <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
              {INVESTIGATIONS.map((i) => (
                <li key={i}>
                  <InvName id={i} /> <span className="text-muted">.csv + 2 PDFs</span>
                </li>
              ))}
            </ul>
          </li>
          <li aria-hidden className="data-flow self-center justify-self-center md:rotate-0" />
          <li className="hud-panel p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ember-soft">2 · Cleaning</p>
            <p className="mt-1 font-mono text-sm font-semibold">scripts/ingest/ingest.py</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
              <li>Converts units: bar, atm and kPa to psi, fractions to %</li>
              <li>Corrects ACME&apos;s shifted inverse-flame columns</li>
              <li>Flags duplicates and failed range checks</li>
              <li>Keeps every source file and row number</li>
              <li>Unknown values become null, never a guess</li>
            </ul>
          </li>
          <li aria-hidden className="data-flow self-center justify-self-center" />
          <li className="hud-panel p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ember-soft">3 · Clean files</p>
            <ul className="mt-1 space-y-1 text-xs">
              {p.processed.map((f) => (
                <li key={f.file} className="flex justify-between gap-2">
                  <code className="break-all font-mono">{fileName(f.file)}</code>
                  <span className="shrink-0 font-mono text-muted">{formatBytes(f.bytes)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">The JSON files feed the site, its API and VESTA&apos;s data tools. The report records the last cleaning run.</p>
          </li>
        </ol>
      </Section>

      <Section
        id="split"
        eyebrow="How it divides"
        title="The data split"
        intro={<>HEARTH trains no model, so <b className="font-semibold text-text">this data has no train and test split</b>: VESTA looks rows up and computes from them. What the data does have is a natural division, and you can slice it every way below. Need a real split? The <a href="#modelling" className="text-ember-soft underline">split builder</a> further down makes one.</>}
      >
        <SplitExplorer dimensions={p.dimensions} totals={t} />
      </Section>

      <Section id="structure" eyebrow="How it is built" title="Every field, explained" intro="One object per test. The percentages show how often each investigation fills the field. A 0% is honest: that table simply does not record it, and HEARTH stores null rather than a guess.">
        <StructureExplorer fields={p.fields} extras={p.extras} totals={t} />
      </Section>

      <Section id="investigations" eyebrow="Where it comes from" title="The three investigations" intro="Three very different experiments, all run on the International Space Station.">
        <Dossiers investigations={p.investigations} />
      </Section>

      <Section id="distributions" eyebrow="What it looks like" title="Distributions" intro="Where the tests actually sit, counted rows only. The tall spikes show how narrow parts of this data are.">
        <Distributions distributions={p.distributions} />
      </Section>

      <Section id="inspector" eyebrow="Do not take our word for it" title="Raw row vs clean record" intro="Pick any test and compare NASA's original row with what the cleaning script produced.">
        <RecordInspector />
      </Section>

      <Section id="quality" eyebrow="What could go wrong" title="Data quality and limits" intro="Nothing is deleted or silently repaired. Each issue is flagged on the row, so you can see it and decide for yourself.">
        <ul className="grid gap-3 md:grid-cols-2">
          {p.flags.map((f) => (
            <li key={f.flag} className="hud-panel p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-head font-semibold">{f.title}</h3>
                <span className="font-mono text-2xl">{f.count}</span>
              </div>
              <code className="font-mono text-[11px] text-warn">{f.flag}</code>
              <p className="mt-2 text-sm">{f.why}</p>
              <p className="mt-1 text-sm text-muted">{f.handling}</p>
              <p className="mt-2 font-mono text-[11px] text-muted">
                {INVESTIGATIONS.filter((i: Investigation) => f.counts[i] > 0)
                  .map((i) => `${i} ${f.counts[i]}`)
                  .join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted">Examples</span>
                {f.samples.map((id) => (
                  <OpenTestButton key={id} id={id} />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="hud-panel p-4">
          <h3 className="font-head font-semibold">What this data cannot tell you</h3>
          <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            <li className="rounded-lg border border-bad/30 bg-bad/5 p-2.5">
              <b className="font-semibold">No partial gravity.</b> <span className="text-muted">All {t.rows} rows are microgravity. Moon and Mars gravity are untested in this data.</span>
            </li>
            <li className="rounded-lg border border-bad/30 bg-bad/5 p-2.5">
              <b className="font-semibold">No solid materials.</b> <span className="text-muted">No fabrics, foams or wiring. Every row is a gas or liquid fuel.</span>
            </li>
            <li className="rounded-lg border border-warn/30 bg-warn/5 p-2.5">
              <b className="font-semibold">Few recorded results.</b> <span className="text-muted">{t.withOutcome} of {t.counted} tests record an outcome, all from ACME.</span>
            </li>
            <li className="rounded-lg border border-warn/30 bg-warn/5 p-2.5">
              <b className="font-semibold">Documented conditions for SPICE.</b> <span className="text-muted">Its O2 and pressure come from the report, not from each row.</span>
            </li>
          </ul>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">The {p.failedChecks.length} rows that failed a range check</summary>
            <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
              {p.failedChecks.map((c) => (
                <li key={c.test_id} className="flex flex-wrap items-center gap-2">
                  <OpenTestButton id={c.test_id} /> <span className="text-muted">row {c.row}, air speed {c.value} cm/s</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </Section>

      <Section
        id="modelling"
        eyebrow="Challenge goal 2: flammability modelling"
        title="Split builder"
        intro="Build a repeatable train and test split and download it. This is a helper for your own modelling. HEARTH itself does not use it."
      >
        <SplitBuilder labelled={p.labelled} counted={t.counted} />
      </Section>

      <Section id="download" eyebrow="Take it with you" title="Download the data" intro="Served as files, ready for a spreadsheet, Python or R.">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {downloads.map((d) => (
            <li key={d.file}>
              <a href={`/api/dataset/${d.file}`} download={`hearth-${d.file}`} className="hud-panel flex h-full flex-col p-3 transition hover:border-ember/50">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{d.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">{formatBytes(d.bytes)}</span>
                </span>
                <span className="mt-1 flex-1 text-xs text-muted">{d.detail}</span>
                <span className="mt-2 font-mono text-[11px] text-ember-soft">↓ hearth-{d.file}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="hud-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-head font-semibold">Cite this cleaned dataset</h3>
            <CopyButton text={hearthCitation} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{hearthCitation}</p>
        </div>
        <div className="hud-panel p-4">
          <h3 className="font-head font-semibold">Ask VESTA about the data</h3>
          <p className="mb-2 mt-1 text-sm text-muted">Answers cite the file and row or page they came from.</p>
          <AskVesta />
        </div>
      </Section>

      <Section
        id="references"
        eyebrow="Credit where it is due"
        title="NASA references"
        intro={<>All of this data comes from NASA research on the International Space Station, shared through NASA&apos;s <a href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer" className="text-ember-soft underline">Physical Sciences Informatics (PSI)</a> system. Titles, authors and dates below are as printed on each document.</>}
      >
        {INVESTIGATIONS.map((inv) => (
          <div key={inv} className="hud-panel p-4">
            <h3 className="mb-2 font-head font-semibold">
              <InvName id={inv} />
            </h3>
            <ul className="divide-y divide-line/60">
              {p.references
                .filter((r) => r.investigation === inv)
                .map((r) => (
                  <li key={r.file} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 basis-64">
                        <p className="text-sm font-semibold">{r.title}</p>
                        <p className="text-xs text-muted">
                          {r.authors}. {r.date}.
                        </p>
                        <p className="mt-0.5 text-xs text-muted">Used for: {r.usedFor}.</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <CopyButton text={citation(r)} label="Cite" />
                        <a href={`${REPO_BLOB}${r.file}`} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:text-text">
                          Open file
                        </a>
                      </div>
                    </div>
                    <p className="mt-1 break-all font-mono text-[10px] text-muted">
                      {fileName(r.file)} · {r.pages ? `${r.pages} ${r.pages === 1 ? "page" : "pages"} · ` : ""}
                      {r.rows ? `${r.rows} rows · ` : ""}
                      {formatBytes(r.bytes)} · SHA-256 {r.sha256.slice(0, 16)}…
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <div className="hud-panel p-4">
          <h3 className="mb-2 font-head font-semibold">NASA pages</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {NASA_LINKS.map((l) => (
              <li key={l.href} className="text-sm">
                <a href={l.href} target="_blank" rel="noreferrer" className="text-ember-soft underline">
                  {l.label}
                </a>
                <span className="block text-xs text-muted">{l.note}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">
          HEARTH is an independent student project for the NASA Space Apps Challenge 2026 and is not endorsed by NASA. The cleaning, flags and summaries are Team Polaris&apos;s work, so any mistakes in them are ours, not NASA&apos;s. The files were not re-checked against PSI&apos;s current copies, so the checksums above describe the copies used here. Use them to tell whether a copy you hold is the same file.
        </p>
      </Section>
    </div>
  );
}
