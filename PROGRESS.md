# HEARTH progress

## Status
- Next phase: 2 (waiting for "go" after the Phase 1 plan review)
- Live URL: https://project-hearth-five.vercel.app
- AI engines with keys: Groq and Gemini set in `.env.local`; Claude key empty. Vercel env vars NOT yet added (the tool permission was denied; see Phase 1 problems).

## Log

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
