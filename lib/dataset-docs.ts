/**
 * Written documentation for the /dataset page: what each field means, where it comes from and which
 * NASA document says so. Mapping facts come from docs/DATA_NOTES.md; titles, authors and dates were read
 * from each PDF's first page. Counts are never written here: lib/dataset.ts computes them from the data.
 */
import type { Investigation } from "./types";

export interface FieldDoc {
  name: string;
  type: string;
  unit?: string;
  meaning: string;
  origin: Record<Investigation, string>;
}

const same = (text: string): Record<Investigation, string> => ({ ACME: text, CFI: text, SPICE: text });

export const FIELD_DOCS: FieldDoc[] = [
  { name: "test_id", type: "string", meaning: "Stable ID for one test row. Every other HEARTH page and VESTA use it.", origin: { ACME: "ACME-CFIG-001… in file order", CFI: "CFI-FLEX-<Flex Number>", SPICE: "SPICE-001… in file order" } },
  { name: "investigation", type: "ACME | CFI | SPICE", meaning: "Which NASA investigation the row belongs to.", origin: same("Set from the source folder") },
  { name: "campaign", type: "string | null", meaning: "Campaign inside the investigation.", origin: { ACME: "Constant: CFI-G (ACME_Report p1, p3)", CFI: "From the fuel: n-dodecane or n-dodecane/iso-dodecane", SPICE: "Constant: SPICE (MSG 2009)" } },
  { name: "hardware", type: "string | null", meaning: "The apparatus that ran the test.", origin: { ACME: "Constant: CIR / ACME chamber, porous spherical burner", CFI: "Constant: CIR / MDCA droplet apparatus", SPICE: "Constant: MSG / SPICE flow duct, round-jet nozzle" } },
  { name: "fuel", type: "string | null", meaning: "Fuel name, normalised, with any dilution written out.", origin: { ACME: "Fuel column: “30% butane” → n-butane (30% in N2)", CFI: "Fuel column: C12H26 → n-dodecane", SPICE: "Fuel column: “75 % Propylene” → propylene (75% in N2)" } },
  { name: "fuel_phase", type: "gas | liquid | solid | null", meaning: "Physical phase of the fuel.", origin: { ACME: "Constant: gas", CFI: "Constant: liquid", SPICE: "Constant: gas" } },
  { name: "geometry", type: "string | null", meaning: "Flame or droplet configuration.", origin: { ACME: "Flame Type column: normal or inverse spherical diffusion flame", CFI: "Fiber column: free-floating, fiber-supported or not recorded", SPICE: "Constant: round-jet coflow diffusion flame" } },
  { name: "size_mm", type: "number | null", unit: "mm", meaning: "Burner or nozzle diameter.", origin: { ACME: "Constant 6.35: burner diameter (ACME_Report p8)", CFI: "null: the 4 mm droplet size is a target, not a per-row measurement (CFI_Report p6)", SPICE: "Nozzle (mm) column: inner diameter" } },
  { name: "o2_pct", type: "number | null", unit: "%", meaning: "Oxygen. For ACME inverse flames this is the O2 in the oxidizer stream, not the chamber.", origin: { ACME: "Normal: XO2 before test × 100. Inverse: the approx p (bar) column × 100 (shifted layout)", CFI: "Oxygen column × 100", SPICE: "21% from SPICE_Report p20, not from the row" } },
  { name: "pressure_psi", type: "number | null", unit: "psi", meaning: "Chamber pressure, converted to psi.", origin: { ACME: "Normal: approx p (bar) × 14.5038. Inverse: the XO2 after test column × 14.5038 (shifted layout)", CFI: "Pressure column: atm × 14.6959", SPICE: "101 kPa from SPICE_Report p20 × 0.145038, not from the row" } },
  { name: "diluent", type: "string | null", meaning: "The inert gas in the atmosphere.", origin: { ACME: "Constant: N2", CFI: "Nitrogen and Helium columns", SPICE: "Constant: N2 (cabin air), SPICE_Report p20" } },
  { name: "flow_cm_s", type: "number | null", unit: "cm/s", meaning: "Air speed past the flame.", origin: { ACME: "null: mHC is a mass flow in mg/s, not a velocity", CFI: "null: the chamber is quiescent, but flow was not measured, so 0 is not assumed", SPICE: "Air Rate (cm/s) column" } },
  { name: "gravity", type: "ug | 1g | efield", meaning: "Gravity condition of the test.", origin: same("Constant: ug (microgravity, on the ISS)") },
  { name: "measurements", type: "string[]", meaning: "What this kind of test measured.", origin: { ACME: "Constant list from ACME_Report", CFI: "Constant list from CFI_Report p6–p9", SPICE: "Constant list from SPICE_Report p2–p4" } },
  { name: "sensors", type: "string[]", meaning: "Instruments used.", origin: { ACME: "Constant list; thin-filament pyrometry added when TFP = Yes (ACME_Report p7, p27)", CFI: "Constant list from CFI_Engineering_Doc p1 and CFI_Report p6", SPICE: "Constant list from SPICE_Report p2–p4" } },
  { name: "outcome", type: "string | null", meaning: "What happened in the test, in words.", origin: { ACME: "Hot ignition + Cool flame? + Self-ext or flow term columns", CFI: "null: the table lists conditions, not results", SPICE: "null: the table does not say which row reached the smoke point" } },
  { name: "key_metric_name", type: "string | null", meaning: "Names the number in key_metric_value. It differs by investigation, so never compare the two across investigations.", origin: { ACME: "burn_time_s", CFI: "null", SPICE: "hc_fuel_rate_mg_s" } },
  { name: "key_metric_value", type: "number | null", meaning: "The main number recorded for the row, in the unit named by key_metric_name.", origin: { ACME: "burn time (sec) column; 0 when there was no ignition", CFI: "null: not in the table", SPICE: "HC Fuel Rate (mg/s) column" } },
  { name: "source_file", type: "string", meaning: "The raw NASA file this row came from.", origin: same("Path inside Pseudo_DataKeep/") },
  { name: "source_row", type: "integer", meaning: "Spreadsheet row in that file (the header is row 1). VESTA cites this.", origin: same("Line number in the CSV") },
  { name: "notes", type: "string", meaning: "Free text: dates, comments and the page behind any value taken from a document.", origin: { ACME: "Comments column plus mapping notes", CFI: "FLEX number, CIR run, date and time", SPICE: "GMT day and times plus the p20 citation" } },
  { name: "flags", type: "string[]", meaning: "Machine-readable data-quality marks, explained in the Quality section.", origin: same("Added by scripts/ingest/ingest.py") },
  { name: "extra", type: "object", meaning: "Raw values kept per investigation so nothing is lost. Listed below.", origin: same("Other CSV columns, parsed") },
];

export interface ExtraDoc {
  investigation: Investigation;
  key: string;
  unit?: string;
  meaning: string;
}

export const EXTRA_DOCS: ExtraDoc[] = [
  { investigation: "ACME", key: "test_label", meaning: "NASA's test label, from the Test column" },
  { investigation: "ACME", key: "day", meaning: "Test day number in the table" },
  { investigation: "ACME", key: "pressure_bar", unit: "bar", meaning: "Pressure as recorded" },
  { investigation: "ACME", key: "xo2_before", unit: "mole fraction", meaning: "Chamber O2 before the test (normal flames)" },
  { investigation: "ACME", key: "xo2_after", unit: "mole fraction", meaning: "Chamber O2 after the test (normal flames)" },
  { investigation: "ACME", key: "xf_fuel_fraction", unit: "mole fraction", meaning: "Fuel fraction in the burner stream (normal flames)" },
  { investigation: "ACME", key: "fuel_flow_mg_s", unit: "mg/s", meaning: "Fuel mass flow (normal flames)" },
  { investigation: "ACME", key: "tad_k", unit: "K", meaning: "Adiabatic flame temperature (ACME_Report p29)" },
  { investigation: "ACME", key: "zst", meaning: "Stoichiometric mixture fraction (ACME_Report p29)" },
  { investigation: "ACME", key: "peak_burner_t_c", unit: "°C", meaning: "Peak burner temperature" },
  { investigation: "ACME", key: "chamber_fuel_fraction_before", unit: "mole fraction", meaning: "Chamber fuel before the test (inverse flames)" },
  { investigation: "ACME", key: "chamber_fuel_fraction_after", unit: "mole fraction", meaning: "Chamber fuel after the test (inverse flames)" },
  { investigation: "ACME", key: "oxidizer_o2_fraction", unit: "mole fraction", meaning: "O2 in the oxidizer stream (inverse flames)" },
  { investigation: "ACME", key: "flow_value_a_unlabelled", meaning: "Inverse-flame flow value the PDFs do not label. Kept raw, never charted" },
  { investigation: "ACME", key: "flow_value_b_unlabelled", meaning: "Inverse-flame flow value the PDFs do not label. Kept raw, never charted" },
  { investigation: "CFI", key: "flex_number", meaning: "FLEX test number" },
  { investigation: "CFI", key: "cir_run", meaning: "Combustion Integrated Rack run ID" },
  { investigation: "CFI", key: "pressure_atm", unit: "atm", meaning: "Pressure as recorded" },
  { investigation: "CFI", key: "n2_fraction", unit: "mole fraction", meaning: "Nitrogen in the chamber" },
  { investigation: "CFI", key: "he_fraction", unit: "mole fraction", meaning: "Helium in the chamber" },
  { investigation: "CFI", key: "fiber", meaning: "Whether a support fiber was used (Yes / No)" },
  { investigation: "CFI", key: "test_date", meaning: "Test date as recorded" },
  { investigation: "SPICE", key: "gmt_day_2009", meaning: "GMT day of year in 2009 (45 = 14 Feb, SPICE_Report p19)" },
  { investigation: "SPICE", key: "fuel_rate_sccm", unit: "sccm", meaning: "Volume flow of burner gas" },
  { investigation: "SPICE", key: "fuel_rate_mg_s", unit: "mg/s", meaning: "Total burner gas mass flow" },
  { investigation: "SPICE", key: "hc_fuel_rate_mg_s", unit: "mg/s", meaning: "Hydrocarbon mass flow" },
  { investigation: "SPICE", key: "nozzle_mm", unit: "mm", meaning: "Nozzle inner diameter" },
];

export interface InvestigationDoc {
  id: Investigation;
  name: string;
  tagline: string;
  rowIs: string;
  where: string;
  collected: { text: string; cite: string }[];
  missing: string[];
}

export const INVESTIGATION_DOCS: InvestigationDoc[] = [
  {
    id: "ACME",
    name: "Advanced Combustion via Microgravity Experiments",
    tagline: "Gas flames on a porous sphere. This table is the CFI-G campaign, Cool Flames Investigation with Gases.",
    rowIs: "One gaseous spherical diffusion-flame test point",
    where: "Combustion Integrated Rack, International Space Station",
    collected: [{ text: "NASA's 30-day reports for this campaign cover ISS Increments 64 and 65", cite: "ACME_Report p2" }],
    missing: [
      "A flow velocity: the table gives mass flow, so flow_cm_s is null.",
      "BRE and E-FIELD Flames rows: they appear only as text in the PDFs, which VESTA can search.",
      "Labels for two inverse-flame flow values: they are kept raw and never charted.",
    ],
  },
  {
    id: "CFI",
    name: "Cool Flames Investigation",
    tagline: "Burning droplets of liquid fuel, hot flames that can turn into cool flames.",
    rowIs: "One n-dodecane-based droplet burn",
    where: "Multi-user Droplet Combustion Apparatus in the Combustion Integrated Rack, International Space Station",
    collected: [{ text: "Experiments ran on the ISS from January to September 2017", cite: "CFI_Report p4" }],
    missing: [
      "Results: the table lists conditions only, so outcome and key_metric_value are null.",
      "Measured droplet size: about 4 mm is a target, not a per-row value (CFI_Report p6).",
    ],
  },
  {
    id: "SPICE",
    name: "Smoke Point In Co-flow Experiment",
    tagline: "Thin gas jets in moving air, used to find where flames start to produce soot.",
    rowIs: "One flame and fuel-flow setting in the coflow duct",
    where: "Microgravity Science Glovebox, International Space Station",
    collected: [{ text: "Tests ran in the glovebox from February to June 2009", cite: "SPICE_Report p19" }],
    missing: [
      "O2 and pressure per row: every row uses the documented 21% O2 and 101 kPa (SPICE_Report p20).",
      "Which row reached the smoke point: the report found 52 smoke points (SPICE_Report p2), but the table does not mark them.",
    ],
  },
];

export interface FlagDoc {
  flag: string;
  title: string;
  why: string;
  handling: string;
}

export const FLAG_DOCS: FlagDoc[] = [
  { flag: "duplicate_row", title: "Exact duplicate rows", why: "The raw table repeats a row exactly.", handling: "The row stays in the data but is left out of every count, chart, envelope check and ranking." },
  { flag: "layout_shifted", title: "Shifted columns", why: "In every ACME inverse-flame row, the values sit one column to the left of their headers.", handling: "The ingest script reads these rows with the corrected layout, so pressure and O2 land in the right fields." },
  { flag: "conditions_from_doc", title: "Conditions from a document", why: "The SPICE table has no O2 or pressure columns.", handling: "O2 and pressure come from SPICE_Report p20 and the row is marked, so they are never mistaken for per-row measurements." },
  { flag: "range_check_failed:flow", title: "Negative air speed", why: "These SPICE rows record an air speed below zero.", handling: "The raw value is kept and flagged. The simulator and the distribution chart on this page leave these rows out." },
];

export interface ReferenceDoc {
  file: string;
  title: string;
  authors: string;
  date: string;
  usedFor: string;
}

/** Bibliographic details exactly as printed on each document's first page. */
export const REFERENCE_DOCS: ReferenceDoc[] = [
  { file: "Pseudo_DataKeep/ACME/ACME_Report.pdf", title: "ACME/CFI-G Final Report (2022)", authors: "D. P. Stocker (NASA Glenn Research Center), P. B. Sunderland (University of Maryland), R. L. Axelbaum (Washington University in St. Louis), F. A. Williams (UC San Diego)", date: "21 November 2022", usedFor: "Science background, burner size, column meanings and test labels" },
  { file: "Pseudo_DataKeep/ACME/ACME_Engineering_Doc.pdf", title: "ACME Engineering Implementation", authors: "D. P. Stocker (NASA Glenn Research Center)", date: "19 May 2022", usedFor: "Chamber, burners, gas delivery and diagnostics" },
  { file: "Pseudo_DataKeep/ACME/ACME_Experimental_Table.csv", title: "ACME experimental table (CFI-G test points)", authors: "NASA ACME project", date: "Date not stated in the file", usedFor: "ACME rows in tests.json" },
  { file: "Pseudo_DataKeep/CFI/CFI_Report.pdf", title: "Cool Flame Investigation (CFI): Science Final Report", authors: "V. Nayagam (CWRU/LTX), D. L. Dietrich (NASA/LTX)", date: "23 July 2020", usedFor: "Operations dates, droplet size and measurements" },
  { file: "Pseudo_DataKeep/CFI/CFI_Engineering_Doc.pdf", title: "Cool Flames Investigation (CFI): Operational Requirements and Protocols", authors: "Authors not stated in the file", date: "Date not stated in the document text", usedFor: "Diagnostics and test protocol" },
  { file: "Pseudo_DataKeep/CFI/CFI_Experimental_Table.csv", title: "CFI experimental table (FLEX droplet runs)", authors: "NASA CFI project", date: "Rows dated 2017", usedFor: "CFI rows in tests.json" },
  { file: "Pseudo_DataKeep/SPICE/SPICE_Report.pdf", title: "Smoke Point in Co-flow Experiment (SPICE): Laminar Smoke Point Properties of Non-buoyant Round-Jet Diffusion Flames, Final Report", authors: "D. L. Urban (NASA Glenn Research Center), P. B. Sunderland (University of Maryland), Z.-G. Yuan (National Center for Space Exploration Research)", date: "2 December 2011", usedFor: "Coflow conditions, operations dates and smoke point results" },
  { file: "Pseudo_DataKeep/SPICE/SPICE_Engineering_Doc.pdf", title: "SPICE Flight Safety Data Package, Phase III (SPICE-SDP-003)", authors: "ZIN Technologies, for NASA Glenn Research Center", date: "May 2008", usedFor: "Flow duct, operations and sensors" },
  { file: "Pseudo_DataKeep/SPICE/SPICE_Experimental_Table.csv", title: "SPICE experimental table (flame and fuel-flow settings)", authors: "NASA SPICE project", date: "Rows dated 2009", usedFor: "SPICE rows in tests.json" },
];

/** Every link below answered HTTP 200 when added (2026-11-04). */
export const NASA_LINKS: { label: string; href: string; note: string }[] = [
  { label: "PSI data repository", href: "https://psi.nasa.gov/physci/repo/", note: "NASA's Physical Sciences Informatics repository" },
  { label: "Search PSI: SPICE", href: "https://psi.nasa.gov/physci/repo/search?q=SPICE&data_source=psi&data_type=investigation", note: "Live search of PSI investigations" },
  { label: "Search PSI: Cool Flames", href: "https://psi.nasa.gov/physci/repo/search?q=Cool%20Flames&data_source=psi&data_type=investigation", note: "Live search of PSI investigations" },
  { label: "About PSI", href: "https://science.nasa.gov/physical-sciences-informatics-psi/history-of-physical-science-informatics/", note: "NASA's history and overview of the system" },
  { label: "NASA Biological and Physical Sciences data", href: "https://science.nasa.gov/biological-physical/data/", note: "Where psi.nasa.gov leads today" },
  { label: "SPICE fact sheet", href: "https://www.nasa.gov/wp-content/uploads/2025/07/smoke-point-in-co-flow-experiment-spice.pdf", note: "NASA fact sheet on the experiment" },
  { label: "Fluids and Combustion Facility", href: "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/science-facilities-on-the-iss/fluids-combustion-facility/", note: "The ISS facility that houses the Combustion Integrated Rack" },
  { label: "Space Station's quest for the secrets of fire", href: "https://www.nasa.gov/humans-in-space/space-stations-quest-for-the-secrets-of-fire/", note: "NASA article on this combustion research" },
];

export const REPO_BLOB = "https://github.com/mail6heatler/Project-HEARTH/blob/main/";
