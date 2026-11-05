# HEARTH data notes

How the raw NASA tables in `Pseudo_DataKeep/` map to the clean data model (`data/processed/tests.json`,
see CLAUDE.md). The raw files are read-only. Full machine inspection: `docs/inspect_output.md`
(regenerate with `python -I scripts/ingest/inspect.py --out docs/inspect_output.md`).

Unit conversions used everywhere:

| From | To | Factor |
|---|---|---|
| bar | psi | × 14.5038 |
| atm | psi | × 14.6959 |
| kPa | psi | × 0.145038 |
| mole fraction | % | × 100 |

`source_row` is the spreadsheet row number (header = row 1). Unknown value → `null`. Values that come from a document rather than the row are marked in
`notes` with the page they come from. Extra field `flags: string[]` (not in the base model) records
machine-readable data-quality marks: `duplicate_row`, `range_check_failed:<check>`, `layout_shifted`,
`conditions_from_doc`.

## Raw file summary

| Investigation | CSV rows | Columns | What one row is | Campaign (from Report) |
|---|---|---|---|---|
| ACME | 333 (+11 blank rows at the end) | 18 | One gaseous spherical diffusion-flame test point | CFI-G, Cool Flames Investigation with Gases (ACME_Report p1, p3) |
| CFI | 87 (8 are exact duplicates) | 10 | One n-dodecane-based droplet burn | CFI 2017 droplet runs, FLEX-1206…1387 (CFI_Report p7) |
| SPICE | 469 | 9 | One flame / fuel-flow setting in the coflow duct | SPICE, MSG Feb–Jun 2009 (SPICE_Report p19) |

## ACME (CFI-G) — `ACME_Experimental_Table.csv`

The table holds two row layouts.

- **Normal flames** (179 rows, `Flame Type` = Normal): fuel (optionally N2-diluted) flows out of the
  6.35 mm porous sphere into an O2/N2 chamber. Columns mean what their headers say.
- **Inverse flames** (154 rows, `Flame Type` = Inverse/inverse): the chamber is filled with N2 + fuel and
  an O2/N2 mixture flows from the burner (ACME_Report p3). In every inverse row the values are
  shifted one column to the left of their header: the `Cool flame?` column holds the chamber fuel
  mole fraction before the test, `XO2 before test` holds the chamber fuel fraction after the test,
  `XO2 after test` holds the pressure in bar, `approx p (bar)` holds the O2 mole fraction of the
  oxidizer stream, and `Xf` / `mHC (mg/s)` hold two flow rates (see open question Q1). Evidence: the
  `XO2 after test` column reaches 3.31 only in inverse rows, the "pressure" column then holds exactly
  0.12–0.30 (typical O2 fractions), and the fuel fraction falls test after test as fuel is consumed.
  The adapter reads inverse rows with this shifted layout and adds the flag `layout_shifted`.

| CSV column | Clean field | Normal rows | Inverse rows | Notes |
|---|---|---|---|---|
| (row number) | `source_row` | CSV line number (header = 1) | same | |
| Test | `campaign_test` in notes; part of `test_id` | | | e.g. `21088 B1`; test_id = `ACME-CFIG-001…` in file order |
| Flame Type | `geometry` | "spherical diffusion flame, normal" | "spherical diffusion flame, inverse" | case normalised |
| Day | notes | test day | test day | |
| Fuel | `fuel` | e.g. "30% butane" → fuel "n-butane (30% in N2)" | same | `fuel_phase` = gas |
| Cool flame? | `outcome` part | text: "yes, PCI-D" / "no, PCI-hot" | holds chamber fuel fraction (shifted) | PCI = cool-flame test label in Report Table 3 (p46) |
| XO2 before test | `o2_pct` (normal) | × 100 | fuel fraction after test (notes) | |
| XO2 after test | notes (normal) | × 100 | `pressure_psi` = bar × 14.5038 | |
| approx p (bar) | `pressure_psi` (normal) | bar × 14.5038 | `o2_pct` = × 100 (oxidizer stream) | |
| Xf | notes | fuel mole fraction in burner stream | flow rate A (Q1) | |
| mHC (mg/s) | notes | fuel mass flow, mg/s | flow rate B (Q1) | not a velocity → `flow_cm_s` = null |
| TFP | `sensors` | Yes → add "thin-filament pyrometry (SiC fibres)" | same | ACME_Report p7, p27 |
| Tad (K) | notes | adiabatic flame temperature, K | same | ACME_Report p29 |
| Zst | notes | stoichiometric mixture fraction | same | ACME_Report p29 |
| Hot ignition | `outcome` part | Yes/No/flash | same | case normalised |
| burn time (sec) | `key_metric_name` = "burn_time_s", `key_metric_value` | seconds | same | 0 when no ignition |
| Self-ext or flow term | `outcome` part | SE = self-extinguished, FT = flow terminated, "-" = none | same | from Comments "FC=flow cut" |
| Peak burner T (C ) | notes | °C; "-" → null | same | |
| Comments | `notes` | free text | same | |

Constant fields: `investigation` ACME, `campaign` "CFI-G", `hardware` "CIR / ACME chamber, porous spherical
burner", `size_mm` 6.35 (burner diameter, ACME_Report p8), `diluent` "N2", `gravity` "ug",
`measurements` = ["burn time", "ignition outcome", "extinction mode", "peak burner temperature",
"cool-flame occurrence"], base `sensors` = ["burner thermocouple", "radiometers", "cameras"].

## CFI — `CFI_Experimental_Table.csv`

| CSV column | Clean field | Notes |
|---|---|---|
| (row number) | `source_row` | |
| Flex Number | notes, `test_id` = `CFI-FLEX-1206` | 8 exact duplicate rows (FLEX 1285–1292) → second copy flagged `duplicate_row` |
| Test Date, Local Time | notes | e.g. 9-Mar-17, 02:03:08 pm est |
| CIR | notes | CIR run id, e.g. f068a03 |
| Pressure | `pressure_psi` | "1 atm" → 14.70 psi (strip spaces, atm × 14.6959) |
| Oxygen | `o2_pct` | mole fraction × 100 (17% or 21%) |
| Nitrogen | `diluent` part | |
| Helium | `diluent` part | diluent = "N2" or "N2 + He (29%)" etc. |
| Fiber | `geometry` | Yes → "fiber-supported droplet (40 µm SiC)", No → "free-floating droplet", empty → "droplet (support not recorded)" |
| Fuel | `fuel` | "C12H26" → "n-dodecane"; "[.60]/[.40] C12H26/iso-dodecane" → "n-dodecane/iso-dodecane 60/40" |

Constant fields: `investigation` CFI, `campaign` by fuel ("n-dodecane" / "n-dodecane/iso-dodecane"),
`hardware` "CIR / MDCA droplet apparatus", `fuel_phase` liquid, `size_mm` null (Report p6 says initial
droplet size was "kept around 4 mm"; that is a target, not a per-row measurement, stored in notes),
`flow_cm_s` 0 is NOT assumed → null (quiescent chamber, but not measured), `gravity` "ug",
`measurements` ["hot-flame burning", "radiative extinction", "cool-flame burning", "extinction diameter"]
(CFI_Report p6–p9), `sensors` ["color camera", "UV OH* camera", "backlit droplet camera",
"chamber pressure & temperature"] (CFI_Engineering_Doc p1, CFI_Report p6). `outcome` and key metric are
not in the table → `outcome` null, `key_metric_*` null.

Row 13 (FLEX 1220) has O2 0.21 + N2 0.76 = 0.97 → kept, noted.

## SPICE — `SPICE_Experimental_Table.csv`

| CSV column | Clean field | Notes |
|---|---|---|
| (row number) | `source_row` | `test_id` = `SPICE-001…`; 34 rows are exact copies of an earlier row → flagged `duplicate_row` |
| GMT date | notes | day of year 2009 (45 = 14 Feb 2009, SPICE_Report p19) |
| GMT ignition, GMT Flame Off | notes | some use "14.48.19" format |
| Fuel | `fuel`, `diluent` | "75 % Propylene" → fuel "propylene (75% in N2)", diluent "N2" (SPICE_Report p20) |
| Nozzle (mm) | `size_mm` | inner diameter, mm |
| Fuel Rate (sccm) | notes | |
| Fuel Rate (mg/s) | notes | total burner gas |
| HC Fuel Rate (mg/s) | `key_metric_name` "hc_fuel_rate_mg_s" | hydrocarbon mass flow |
| Air Rate (cm/s) | `flow_cm_s` | co-flow air velocity; 25 empty → null; 8 negative values (down to −5.92) → kept, flagged `range_check_failed:flow` |

Constant fields: `investigation` SPICE, `campaign` "SPICE (MSG 2009)", `hardware` "MSG / SPICE flow duct,
round-jet nozzle", `fuel_phase` gas, `geometry` "round-jet coflow diffusion flame", `gravity` "ug".
`o2_pct` 21 and `pressure_psi` 14.65 (101 kPa) come from the Report, not from each row: "Parameters ua, uf
and Re assume conditions of 298 K, 101 kPa and 21±1% O2" (SPICE_Report p20) and cabin air O2 "maintained
within 19–24%" (p19). These rows get the flag `conditions_from_doc`. `measurements` ["smoke point",
"luminous flame length"], `sensors` ["still camera", "video camera"] (SPICE_Report p2–p4).
`outcome` null (the table does not say which row reached the smoke point).

## Data gaps (true for all three tables)

- No solid-fuel / fabric tests (ACME's BRE emulates burning solids, but its rows are not in this table).
- No partial gravity: all rows are microgravity (`ug`). Lunar/Mars gravity is bounded only by µg and 1g.
- O2 range: ACME normal 18.0–40.0% (chamber), ACME inverse 12–85% (oxidizer stream), CFI 17–21%, SPICE 21% (doc).
- Pressure range: ACME 0.50–3.31 bar (7.2–48.0 psi), CFI 0.5–5 atm (7.3–73.5 psi), SPICE 14.65 psi.

## Dataset page (`/dataset`)

`data/processed/sources.json` records each raw file's size, SHA-256, pages, rows and columns. It is made by
`python -I scripts/ingest/describe_sources.py`; run it again whenever raw data changes (a test checks the sizes,
checksums and row counts). Field and flag explanations are in `lib/dataset-docs.ts` (tests fail if a field or flag
in the data has no explanation); all counts are computed in `lib/dataset.ts`.

This data has no train/test split, because HEARTH trains no model. `lib/dataset-split.ts` lets modellers make one.
Fuel-level splits are decided across the whole dataset, because propane burned in both ACME and SPICE.

PSI record numbers are not stated in the raw files and could not be confirmed, so the page links to a PSI search
rather than to a specific record. The files were not compared with PSI's current copies.

## Open questions

- **Q1 (ACME inverse flow columns):** the two inverse-row flow values (e.g. 1.5 and 5.59) always keep a
  ratio near 3.72. They look like the oxidizer and O2 (or fuel-equivalent) flow in different units, but the
  PDFs do not label them. Plan: store both raw in notes, use neither as a number in charts.
- **Q2 (SPICE conditions) — decided:** every SPICE row is 21% O2 at 14.65 psi with the
  `conditions_from_doc` flag and the p20 citation.
- **Q3 (duplicates) — decided:** exact copies are kept in tests.json, the later copy is flagged `duplicate_row`
  and excluded from counts, envelope checks, ranking, gaps and the map (CFI 8 rows, SPICE 34 rows).
- **Q4 (ACME campaigns):** the ACME table is only CFI-G. BRE and E-FIELD Flames appear in the PDFs only as
  text (searchable in docs), not as table rows.
