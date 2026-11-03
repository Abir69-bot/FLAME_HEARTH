# HEARTH progress

## Status
- Next phase: 3 (waiting for the user's "go"; the user wants a report + "go" after every phase)
- Live URL: https://project-hearth-five.vercel.app
- AI engines with keys: Groq and Gemini set in `.env.local`; Claude key empty. Vercel env vars NOT yet added (the tool permission was denied; see Phase 1 problems).

## Log

### Phase 2 done
**Done**
- `scripts/ingest/ingest.py`: one adapter per investigation → `data/processed/tests.json` (889 tests: ACME 333, CFI 87, SPICE 469), `chunks.json` (1066 page-aware chunks, ~800 chars / 100 overlap), `pdf_tables.json` (94 tables), `ingest_report.md`. Range checks: 8 SPICE rows with negative airflow kept and flagged. Duplicates flagged: CFI 8, SPICE 34. 6 pytest tests (`python -m pytest scripts/ingest`, run from the repo root).
- `lib/types.ts` (zod schemas), `lib/data.ts` (load once, filter/sort/stats/sources), `lib/util.ts` (pure helpers, safe for the browser), `lib/missions.ts` (ISS, Moon base, Lunar rover demo, Spacesuit), `lib/physics.ts` (pO2, ratio to ISS, O2 vs Earth, flow regime, unit conversion, envelope check, nearest tests, heuristic hazard index with parts), `lib/bins.ts`, `lib/analysis.ts` (compare, rank, gaps), `lib/search.ts` (MiniSearch).
- VESTA data tools in `lib/vesta/tools/`: query_data, search_docs, physics_calc, nearest_tests, envelope_check, compare, rank_investigations, gap_finder. Zod inputs, `runTool` validates and never throws, every result has sources and a confidence tag.
- API: missions, tests, tests/[id], map, rank, gaps, compare, search, calc (POST). `docs/API.md` with real example responses.
- 36 vitest tests (physics hand calculations: 34% at 8.2 psi = 2.788 psi, ISS = 3.087 psi, ratio 0.903).

**Decisions**
- Defaults for Q2 (SPICE 21% / 101 kPa from Report p20) and Q3 (duplicates flagged, not counted) adopted; Q1 flow columns stay in `extra` only.
- Envelope window ±5 percentage points O2 and ±2.5 psi; nearest-test distance is normalised so 1.0 = envelope edge.
- Ranking score = proximity 40 + O2 coverage 20 + pressure coverage 20 + tests-in-envelope 20 (constants in `lib/analysis.ts`). Hazard index = O2 concentration 40 + pO2 20 + airflow 20 + data coverage 20, labelled "heuristic".
- No Mars mission: no sourced values.
- `tsconfig` target set to ES2020.

**Findings worth knowing**
- Lunar rover (34% / 8.2 psi): supported, 28 ACME CFI-G tests inside the envelope (all gaseous spherical flames, no materials). Moon base: supported (6). Spacesuit: no_data. ISS: supported (518).
- Gaps: no solid fuels, only microgravity, spacesuit cell empty, 13 empty cells in the 21–50% O2 / < 14 psi exploration region.

**Problems**
- Bash heredocs with long TS content failed to parse in this shell; files were written with the editor tool instead.
- Running pytest from inside `scripts/ingest/` breaks because `inspect.py` shadows the stdlib; run it from the repo root.

**Next**
- Phase 3: VESTA system prompt, make_chart + ui_action, the three providers, agent loop, grounding, Offline mode, engine router, `/api/vesta*`, dashboard shell with the model menu.

### Phase 1 done
**Done**
- Git: initialised the folder, origin = github.com/mail6heatler/Project-HEARTH, checked out `main`. The remote had only `Pseudo_DataKeep/` and `test.txt` (no README, CLAUDE.md or PROGRESS.md), so nothing local was overwritten.
- All 9 raw files present (ACME, CFI, SPICE × Engineering_Doc.pdf, Experimental_Table.csv, Report.pdf).
- Next.js 14.2 (App Router, TS strict, Tailwind, ESLint) scaffolded in a temp folder and moved to the repo root. Installed echarts, echarts-for-react, zustand, minisearch, zod 3, zod-to-json-schema, @anthropic-ai/sdk, openai, @google/genai, vitest, tsx, yaml.
- Theme colours + Chakra Petch / IBM Plex Sans / IBM Plex Mono as CSS variables and Tailwind tokens. HEARTH welcome page with the inline SVG flame-in-ring logo.
- `.env.example`, `.gitignore`, `vitest.config.ts`, `npm test`.
- `scripts/ingest/inspect.py` (+ requirements.txt) → `docs/inspect_output.md`. `docs/DATA_NOTES.md` with the full column mapping and open questions.
- Vercel: linked to the existing `project-hearth` (Git already connected to this repo, production branch `main`). Fixed framework preset Other → Next.js, Node 26.x → 22.x.

**Decisions**
- The ACME table is the CFI-G campaign only (normal + inverse spherical diffusion flames). Inverse rows are shifted one column; the adapter will read them with their real layout (DATA_NOTES.md).
- SPICE O2/pressure come from SPICE_Report p20 (21% O2, 101 kPa) and are flagged `conditions_from_doc`.
- `inspect.py` must be run with `python -I` because its required name shadows the stdlib `inspect` module.
- Extra `flags: string[]` field on each test for data-quality marks.

**Problems**
- Adding keys to Vercel (`vercel env add`) was blocked by the Claude Code permission classifier. The user must allow it or run it by hand.
- `vercel link` appended a `VERCEL_OIDC_TOKEN` line to `.env.local` (git-ignored, harmless).
- `.env.local` line 2 has `ANTHROPIC_MODEL=claude-sonnet-5-5# VESTA AI keys...` (missing newline). The app trims model names at `#`/whitespace.

**Next**
- Phase 2: ingest.py adapters, processed data, lib/ data + physics, tools, API routes.
