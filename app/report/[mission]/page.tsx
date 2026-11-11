import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton, ReportMissionLinks } from "@/components/report/ReportActions";
import { ConfidenceTag } from "@/components/vesta/Bits";
import { sourceLabel } from "@/lib/source-label";
import { SOURCES } from "@/lib/dataset";
import { pdfHref } from "@/lib/pdf-links";
import { ENVELOPE_O2_WINDOW_PCT, ENVELOPE_P_WINDOW_PSI } from "@/lib/physics";
import { buildReport, REPORT_MISSION_IDS } from "@/lib/report";

export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_MISSION_IDS.map((mission) => ({ mission }));
}

export function generateMetadata({ params }: { params: { mission: string } }): Metadata {
  const r = buildReport(params.mission);
  return { title: r ? `Report · ${r.mission.short}` : "Mission report" };
}

const short = (f: string) => f.split("/").pop() ?? f;
const CAT_LABEL = { prevention: "Prevention", detection: "Detection", suppression: "Suppression" } as const;
const STATUS_TEXT = { supported: "Supported by test data", sparse: "Only a few tests nearby", no_data: "No NASA tests nearby" } as const;

export default function MissionReportPage({ params }: { params: { mission: string } }) {
  const r = buildReport(params.mission);
  if (!r) notFound();
  const m = r.mission;
  const kpis: [string, string, string][] = [
    ["Oxygen", `${m.o2_pct}%`, `${r.vsEarth.value}× Earth air`],
    ["Pressure", `${m.pressure_psi} psi`, m.gravity],
    ["pO2", `${r.po2.value} psi`, r.po2.formula],
    ["vs ISS pO2", `${r.ratio.value}×`, r.ratio.formula],
    ["Tests nearby", `${r.envelope.count}`, `±${ENVELOPE_O2_WINDOW_PCT} pp O2, ±${ENVELOPE_P_WINDOW_PSI} psi`],
    ["Hazard index", `${r.hazard.value} / 100`, "HEARTH heuristic"],
  ];
  return (
    <article className="report mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember-soft">HEARTH mission report</p>
            <h1 className="fire-text font-head text-2xl font-bold tracking-wide sm:text-3xl">{m.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{m.description}</p>
          </div>
          <PrintButton />
        </div>
        <ReportMissionLinks current={m.id} />
        {m.demo && <p className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn">Demo scenario: these cabin conditions are a HEARTH example, not a NASA specification.</p>}
      </header>

      <section aria-labelledby="r-summary" className="hud-panel space-y-3 p-4">
        <h2 id="r-summary" className="font-head text-lg font-semibold">
          At a glance
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceTag value={r.envelope.confidence} />
          <span className="text-sm">{STATUS_TEXT[r.envelope.status]}.</span>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kpis.map(([k, v, sub]) => (
            <div key={k} className="rounded-md border border-line bg-bg p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-mono text-xl">{v}</dd>
              <dd className="text-[10px] text-muted">{sub}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">{r.envelope.rule}</p>
      </section>

      <section aria-labelledby="r-nearest" className="hud-panel space-y-2 p-4">
        <h2 id="r-nearest" className="font-head text-lg font-semibold">
          Closest NASA tests
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-normal">Test</th>
                <th className="font-normal">Fuel</th>
                <th className="text-right font-normal">O2 %</th>
                <th className="text-right font-normal">psi</th>
                <th className="font-normal">Outcome</th>
                <th className="font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {r.nearest.map((t) => (
                <tr key={t.test_id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap font-mono">{t.test_id}</td>
                  <td>{t.fuel ?? "—"}</td>
                  <td className="whitespace-nowrap text-right font-mono">{t.o2_pct ?? "—"}</td>
                  <td className="whitespace-nowrap text-right font-mono">{t.pressure_psi ?? "—"}</td>
                  <td>{t.outcome ?? "not in the table"}</td>
                  <td className="whitespace-nowrap font-mono text-[10px] text-muted">
                    {short(t.source_file)}
                    {t.source_row ? ` row ${t.source_row}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="r-safety" className="space-y-3">
        <h2 id="r-safety" className="font-head text-lg font-semibold">
          Safety findings
        </h2>
        <p className="text-xs text-muted">Evidence from the NASA data, not official NASA rules. Severity is a HEARTH heuristic (0–100) for ordering, shown with its rule.</p>
        {r.findings.map((f) => (
          <div key={f.id} className="hud-panel space-y-2 p-4 break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-head font-semibold">
                <span className="mr-2 font-mono text-[11px] uppercase tracking-widest text-ember-soft">{CAT_LABEL[f.category]}</span>
                {f.title}
              </h3>
              <span className="font-mono text-sm">severity {f.severity}</span>
            </div>
            <ConfidenceTag value={f.confidence} />
            <p className="text-sm">{f.guideline}</p>
            <ul className="space-y-1 text-xs text-muted">
              {f.evidence.map((e, i) => (
                <li key={i}>
                  • {e.text}
                  {e.source && (
                    <span className="font-mono text-[10px]">
                      {" "}
                      ({e.source.page && pdfHref(e.source.file, e.source.page) ? (
                        <a href={pdfHref(e.source.file, e.source.page)!} target="_blank" rel="noopener noreferrer" className="underline">
                          {sourceLabel(e.source)}
                        </a>
                      ) : (
                        sourceLabel(e.source)
                      )}
                      )
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="font-mono text-[10px] text-muted">{f.severity_rule}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="r-limits" className="hud-panel space-y-2 p-4 text-sm">
        <h2 id="r-limits" className="font-head text-lg font-semibold">
          Limits of this report
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>All NASA tests here ran in microgravity. Lunar and Martian gravity are untested.</li>
          <li>No solid materials (fabrics, foams, wiring) were tested: only gas flames and liquid droplets.</li>
          <li>SPICE oxygen and pressure are the documented conditions, not per-row measurements.</li>
          <li>The hazard index and severity scores are HEARTH heuristics with published formulas, not NASA ratings.</li>
        </ul>
        <p className="text-xs text-muted">
          Data: NASA Physical Sciences Informatics, {SOURCES.raw.length} raw files ({SOURCES.raw.filter((f) => f.kind === "table").map((f) => short(f.file)).join(", ")} and their reports). Made with HEARTH by Team Polaris. Independent student project, not endorsed by NASA.
        </p>
      </section>
    </article>
  );
}
