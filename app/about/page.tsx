import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "About" };

const INVESTIGATIONS = [
  {
    name: "ACME",
    color: "text-acme",
    full: "Advanced Combustion via Microgravity Experiments — CFI-G campaign (Cool Flames Investigation with Gases)",
    hardware: "Combustion Integrated Rack (CIR), porous spherical burner (6.35 mm), thermocouples, radiometers, cameras, thin-filament pyrometry.",
    data: "333 test points of normal and inverse spherical diffusion flames of ethane, propane and n-butane (pure or N2-diluted), 12–85% O2, 7–48 psi: ignition, cool flames, burn time, extinction mode.",
  },
  {
    name: "CFI",
    color: "text-cfi",
    full: "Cool Flames Investigation",
    hardware: "CIR with the Multi-user Droplet Combustion Apparatus: free-floating or fibre-supported droplets (about 4 mm), colour and UV OH* cameras.",
    data: "87 droplet burns (79 unique) of n-dodecane and n-dodecane / iso-dodecane blends, 17–21% O2, 0.5–5 atm, some with helium dilution.",
  },
  {
    name: "SPICE",
    color: "text-spice",
    full: "Smoke Point In Co-flow Experiment",
    hardware: "Microgravity Science Glovebox flow duct, round-jet nozzles (0.41, 0.76, 1.6 mm), still and video cameras.",
    data: "469 flame settings (435 unique) of ethylene, propane, propylene, propylene/N2 and methane in co-flowing cabin air (21% O2, 101 kPa, SPICE_Report p20).",
  },
];

const FILES = [
  ["<INV>_Experimental_Table.csv", "One row per test point: the source of every number in HEARTH (cited as file + row)."],
  ["<INV>_Engineering_Doc.pdf", "Hardware, operations and safety documentation (searchable by VESTA, cited as file + page)."],
  ["<INV>_Report.pdf", "Final science report: methods, findings and column meanings (searchable by VESTA)."],
];

const ENGINES = [
  ["1. Claude", "Used when an Anthropic key is set. Best quality."],
  ["2. Groq (free)", "openai/gpt-oss-120b through Groq's OpenAI-compatible API."],
  ["3. Gemini (free)", "Google Gemini with function calling."],
  ["4. Offline mode", "Always available. Rule-based: detects the intent, pulls numbers such as “34%” or “8.2 psi” from your message, calls the same tools and fills a template. No AI."],
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="HEARTH · Team Polaris · NASA Space Apps 2026" title="About HEARTH">
        HEARTH (Habitat Environment Analysis &amp; Risk Tracking Hub) summarises, ranks and interprets NASA microgravity combustion experiments to give fire-safety insights for crewed habitats: the ISS, a lunar base, pressurized rovers and spacesuits. It is guided by VESTA (Virtual Engineer for Space-fire Threat Assessment), an AI crewmate that computes, charts, compares and audits inside the dashboard.
      </PageHeader>

      <section aria-label="Investigations" className="grid gap-3 lg:grid-cols-3">
        {INVESTIGATIONS.map((i) => (
          <article key={i.name} className="rounded-xl border border-line bg-panel p-4 text-sm">
            <h2 className={`font-head text-lg font-bold ${i.color}`}>{i.name}</h2>
            <p className="mb-2 text-xs text-muted">{i.full}</p>
            <p>
              <b className="text-muted">Hardware:</b> {i.hardware}
            </p>
            <p className="mt-1">
              <b className="text-muted">In HEARTH:</b> {i.data}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4 text-sm">
          <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">What each file holds</h2>
          <dl className="space-y-2">
            {FILES.map(([f, d]) => (
              <div key={f}>
                <dt className="font-mono text-xs text-ember-soft">{f}</dt>
                <dd className="text-muted">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            The raw files are read-only. A Python script converts them into one clean table (units converted, unknown values left empty, every mapping decision documented in docs/DATA_NOTES.md). Exact duplicate rows are kept but not counted; rows that fail range checks are kept and flagged.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 text-sm">
          <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">Credits</h2>
          <p>
            All experimental data and documents come from NASA&apos;s{" "}
            <a className="text-ember-soft underline" href="https://psi.nasa.gov" target="_blank" rel="noreferrer">
              Physical Sciences Informatics (PSI)
            </a>{" "}
            system, from experiments run aboard the International Space Station. ACME project page:{" "}
            <a className="text-ember-soft underline" href="https://www1.grc.nasa.gov/space/iss-research/iss-fcf/cir/acme/" target="_blank" rel="noreferrer">
              NASA Glenn Research Center
            </a>
            . HEARTH is an independent student project for the NASA Space Apps Challenge 2026 and is not endorsed by NASA.
          </p>
          <h2 className="mb-2 mt-4 font-head text-sm font-semibold uppercase tracking-wider text-muted">Limits</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>All tests ran in microgravity. Lunar and Martian gravity are untested; microgravity and 1g only bound them.</li>
            <li>No solid materials (fabrics, foams, wiring) are in the data, so cabin-material flammability is a gap.</li>
            <li>SPICE oxygen and pressure are documented conditions, not per-row measurements.</li>
            <li>Ranking scores, severity and the hazard index are HEARTH heuristics with published formulas, not NASA ratings.</li>
            <li>Safety guidelines describe evidence (“evidence suggests…”), never official NASA rules.</li>
            <li>DEMO telemetry and the fire drill are simulated and always labelled DEMO.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4 text-sm">
        <h2 className="mb-2 font-head text-sm font-semibold uppercase tracking-wider text-muted">How VESTA works</h2>
        <p className="text-muted">
          VESTA is a tool-using agent. It never states a number it did not get from a tool: it queries the test table, searches the PDFs, runs tested formulas (pO2, ratios, flow regime, envelope check, nearest tests), compares and ranks investigations, finds gaps, runs a safety audit, draws charts and moves the dashboard. A grounding check compares every number in an answer with the tool results; anything unverifiable is flagged and the confidence is lowered. Every answer ends with its sources and one confidence tag: supported, extrapolated or no data.
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {ENGINES.map(([e, d]) => (
            <div key={e} className="rounded-lg border border-line bg-bg p-2">
              <dt className="font-semibold">{e}</dt>
              <dd className="text-xs text-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">
          In Auto mode VESTA tries the engines in this order and uses the first one that works. If an engine is missing a key, hits a free limit, times out or sends an invalid tool call, VESTA moves to the next one and says so in a small note. Keys stay on the server; the browser only ever sees which engines are available.
        </p>
      </section>
    </div>
  );
}
