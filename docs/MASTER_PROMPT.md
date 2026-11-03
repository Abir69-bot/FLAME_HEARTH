# MASTER PROMPT — Build, push and deploy Project HEARTH from start to finish

## RULES FOR THIS WHOLE RUN
- Read CLAUDE.md and PROGRESS.md first and follow them exactly.
- Your first action: copy MASTER_PROMPT.md to docs/MASTER_PROMPT.md (keep the root copy too).
- Work through PHASES 1 to 6 in order. If PROGRESS.md says a phase is already done, skip it.
- End EVERY phase with this checkpoint: npm run lint, npm test and npm run build pass (fix failures) → update PROGRESS.md ("Phase N done": Done · Decisions · Problems · Next) → git commit -m "Phase N: <summary>" → git push origin main → wait for the Vercel deployment and open the live URL to confirm it works → continue straight to the next phase.
- Stop and wait for me ONLY when: (a) a login or browser approval is needed, (b) the plan approval at the end of Phase 1, (c) something truly blocks you (explain it and give me options).
- Never invent data values. Never print, log or commit secrets. Never force-push. Never create a second Vercel project.
- AI keys are optional. A missing key is never a blocker: build everything, and VESTA uses whatever engines are available.

## PHASE 1 — Connect, pull, scaffold, understand the data, first deploy
1. GitHub (https://github.com/mail6heatler/Project-HEARTH.git)
   - If this folder is not a git repo: git init, use branch main, add origin, git fetch, then check out origin/main into this folder. My CLAUDE.md, PROGRESS.md, MASTER_PROMPT.md and .env.local must survive; if the repo already has a CLAUDE.md or PROGRESS.md, keep mine and tell me.
   - If it already is a repo: check origin is this URL and run git pull (merge, keep both sides).
   - Confirm Pseudo_DataKeep/ACME, Pseudo_DataKeep/CFI and Pseudo_DataKeep/SPICE each hold their Engineering_Doc.pdf, Experimental_Table.csv and Report.pdf. If not, stop and tell me what is missing.
   - If any git step needs a login, stop and give me exact steps (for example `gh auth login`, choose "Login with a web browser"), then wait for "done".
2. Project setup
   - .gitignore: node_modules, .next, .env*, .venv, __pycache__, .vercel, .DS_Store.
   - Create the Next.js 14 app AT THE REPO ROOT without touching Pseudo_DataKeep/, README.md, CLAUDE.md, PROGRESS.md, MASTER_PROMPT.md or .env.local (scaffold in a temporary folder with TypeScript, Tailwind, App Router, ESLint, no src dir, then move the files in).
   - Install echarts, echarts-for-react, zustand, minisearch, zod, zod-to-json-schema, @anthropic-ai/sdk, openai, @google/genai and vitest. Add an "npm test" script.
   - Add .env.example listing every variable from CLAUDE.md with empty values (no real keys).
   - Colors and fonts from CLAUDE.md (next/font/google) as CSS variables and in the Tailwind theme.
   - Home page: dark HEARTH welcome screen with the logo (inline SVG flame in a ring), "HEARTH · Team Polaris", "Fire-safety intelligence for crewed habitats".
3. Understand the data (read-only)
   - scripts/ingest/inspect.py + scripts/ingest/requirements.txt (pandas, pdfplumber, pymupdf), run in a .venv.
   - Each CSV: columns, types, row count, empty values, 5 sample rows, top values of text columns, unit hints. Each PDF: pages, extractable text, tables per page, headings, and which pages explain the CSV columns.
   - docs/DATA_NOTES.md: a table mapping every CSV column to the clean data model in CLAUDE.md (or "not used"), units and conversions, open questions.
4. Vercel (the EXISTING project connected to this repo)
   - npx vercel whoami; if not logged in, ask me to run `npx vercel login` and wait for "done".
   - npx vercel project ls → find the project for this repo (the README's Vercel link helps) → npx vercel link to it. More than one candidate → show me and ask.
   - Settings must fit: framework Next.js, root directory = repo root. If the Git connection is missing, run npx vercel git connect.
   - Keys: for each of ANTHROPIC_API_KEY, GROQ_API_KEY and GEMINI_API_KEY that has a real value in .env.local (not empty, not containing PASTE), add it and its matching *_MODEL to Production and Preview by piping the value from .env.local into `npx vercel env add <NAME> <environment>`; never show a value. Confirm with npx vercel env ls (names only). Tell me which engines are set up; missing ones are fine.
5. Checkpoint. Then show me: the live URL, the column mapping table, the open questions, which AI engines have keys, and a short PLAN for Phases 2–6 (key decisions per phase). Wait for me to say "go". After "go", do not stop again except for rules (a) and (c).

## PHASE 2 — Data engine and API
1. scripts/ingest/ingest.py: one adapter per investigation mapping its CSV to the clean data model using DATA_NOTES.md. Convert units. Stable test_ids like ACME-BRE-001. Every record has source_file and source_row. Unknown → null, never guessed. PDFs → page-aware chunks (~800 chars, 100 overlap) in chunks.json; tables → pdf_tables.json. data/processed/ingest_report.md with rows per investigation, empty rates, value ranges and failed checks (O2 0–100, pressure > 0, flow ≥ 0; failed rows kept and marked in notes). A few pytest tests. Commit data/processed/.
2. lib/types.ts (types + zod), lib/data.ts (load once, query helpers), lib/missions.ts (ISS, Lunar base, Lunar rover demo scenario, Spacesuit; Mars habitat only if labelled "assumed (demo)").
3. lib/physics.ts: pO2, ratio to ISS, O2 vs Earth air, flow regime (still < 5, low < 20, forced ≥ 20 cm/s, named constants), envelope check, nearest tests (normalized distance), hazard index labelled "heuristic" returning its parts. Vitest against hand calculations (34% at 8.2 psi = 2.788 psi; ISS = 3.087 psi).
4. lib/search.ts (minisearch over chunks). lib/vesta/tools/: query_data, search_docs, physics_calc, nearest_tests, envelope_check, compare, rank_investigations (with score parts), gap_finder; zod inputs; every result has sources.
5. app/api/: missions, tests (filters investigation, fuel_phase, o2_min, o2_max, q, sort, page), tests/[id], map, rank?mission=, gaps, compare?inv=, search?q=, calc (POST). docs/API.md with example responses.
6. Checkpoint, and test 3 routes on the live URL.

## PHASE 3 — VESTA (3 AI engines + Offline), model menu and dashboard shell
1. lib/vesta/system-prompt.md: personality, the 8 product rules, the 3 explanation levels, reference atmospheres, "every number from a tool result", "end with sources and one confidence tag", "outside the tested range name the gap", "use ui_action to move the dashboard", "use make_chart when a chart explains better". Written so it works for every model, not only Claude.
2. Tools: Phase 2 tools + make_chart (zod-validated ECharts option: line/bar/scatter/radar/heatmap, max 2000 points, no functions) + ui_action (go_view, set_mission, highlight_tests, open_test). Write each tool schema once in zod and convert it for each provider with zod-to-json-schema.
3. Providers (lib/vesta/providers/), one shared interface (send messages + tools → text and tool calls, streaming):
   - anthropic.ts: @anthropic-ai/sdk, model ANTHROPIC_MODEL.
   - groq.ts: openai SDK with baseURL https://api.groq.com/openai/v1, model GROQ_MODEL.
   - gemini.ts: @google/genai, model GEMINI_MODEL.
   - Validate every tool call's arguments with zod before running the tool.
4. lib/vesta/agent.ts: provider-agnostic tool loop, max 6 tool rounds, inputs = messages + mission + level + chosen engine. lib/vesta/grounding.ts: every number in the answer must appear in a tool result or the user's message (allow rounding); otherwise ask the model once to fix; if still not, add "Some figures could not be verified" and set confidence to extrapolated.
5. lib/vesta/offline.ts (Offline mode): intent router (assess conditions, compare, gaps, rank, safety audit, explain a test or a topic, help) + number extraction ("34%", "8.2 psi", "5 cm/s", test ids) → the same tools → templated answers with sources and a confidence tag, using the same SSE events.
6. lib/vesta/router.ts (backup chain): Auto = Claude → Groq → Gemini → Offline, skipping engines without a key. A specific choice tries that engine first, then continues down the chain. Fall back on 401/403, 429, 5xx, a 20-second timeout, a model that cannot do tool calling, or invalid tool-call output. Log only the error type, never a key. Cache identical questions for 10 minutes.
7. API: GET /api/vesta/engines → [{id, label, available}] for auto, claude, groq, gemini, offline (never keys). POST /api/vesta (SSE events engine, step, text, chart, ui, sources, confidence, done, error; Node runtime; maxDuration 60). POST /api/vesta/alert: proactive alert with no AI call.
8. Shell: sticky top bar (logo, Team Polaris, mission chips, data status); left nav (Mission overview, Test explorer, Compare, Safety & gaps, My data lab, About); zustand store. VESTA panel on the right (below the page under 1180px): animated canvas orb, Online/Thinking, a MODEL MENU (dropdown: Auto (recommended), Claude, Groq, Gemini, Offline; options without a key greyed out with "no key"; choice saved in localStorage and sent with every message), Student/Researcher/Engineer switch, live tool steps, streaming text, an engine badge on every VESTA message ("via Groq · gpt-oss-120b", "Offline mode"), a short fallback note when it switched engines, inline ECharts charts with "Pin to dashboard", source chips, colored confidence tag, quick prompts, input. ui events move the app; mission change shows the proactive alert. Loading, empty and error states.
9. Tests: mock every provider and test the tool loop, event order, make_chart and ui_action validation, grounding, the backup chain (missing key, 429, timeout, bad tool call → next engine; all fail → Offline), the engines endpoint (never leaks keys), and Offline mode (each intent, number extraction). evals/questions.yaml with 12 questions, expected tools and facts.
10. Checkpoint. Then on the live site, test "What is pO2 at 34% O2 and 8.2 psi?" with every engine that is available in the menu, plus Offline: each must give ~2.79 psi with a source and a confidence tag. Report which engines worked.

## PHASE 4 — Dashboard on real data
1. Overview (/): mission header with envelope pill; animated KPI tiles (O2 %, pressure, pO2, ratio to ISS, O2 vs Earth, tests in envelope); habitat relevance map (ECharts scatter: x pressure psi, y O2 %, color per investigation, dashed constant-pO2 line at 3.087 psi, shaded Moon base / rover region 30–34% O2 at 8.2–10.2 psi, ISS and Spacesuit diamonds, pulsing mission marker, wheel zoom, rich tooltips, click → details, VESTA-highlighted tests glow; tests missing O2 or pressure listed as "not plotted"); ranking bars with score parts on hover; pinned VESTA charts strip.
2. Explorer (/explorer): investigation toggles, fuel phase, O2 range slider, search, sortable paged table, two charts that follow the filters (tests per campaign, O2 histogram).
3. Shared details drawer: every field, pO2, source file and row, sensors, measurements, related PDF passages, "Ask VESTA about this test".
4. Motion (entry animations, slide-in drawer, count-ups, pulsing marker), off under prefers-reduced-motion. Check 400px, 1024px and 1440px widths.
5. Checkpoint.

## PHASE 5 — Analysis, lab, DEMO mode, About
1. Compare (/compare): pick 2–3 investigations; radar of coverage (max O2, pressure span, flow span, fuel variety, sensor types, mission relevance; formula in each axis tooltip); grouped bars of mean O2, pressure, flow; overlay scatter; "Shared by all" and "Only in X" lists.
2. lib/safety.ts rules (Prevention / Detection / Suppression): oxygen enrichment, still-air pockets, cool flames, smoke and detector response, untested solid materials, partial-gravity uncertainty. Each runs real queries for evidence and returns severity 0–100 (documented heuristic), confidence from evidence count, sources and an "evidence suggests…" guideline. safety_audit tool. Vitest per rule.
3. Safety & gaps (/safety): finding cards (confidence tag, animated severity bar, evidence chips, guideline); gap heatmap of test counts on O2 × pressure bins (empty cells red "gap", mission cell outlined); missing fuel types; recommended experiments per gap (fabrics above 30% O2 → BASS/Saffire-type tests; lunar gravity → LUCI/FM2); "Uses on Earth" panel.
4. Lab (/lab): sliders + number boxes for O2, pressure, airflow, material picker; live pO2, ratio, O2 vs Earth, flow regime, envelope, hazard index with parts, nearest 5 tests; scatter of all tests, nearest 5 and the user's pulsing point; in-browser CSV upload with column detection, a confirm-mapping step and range checks, rows plotted as triangles here and on the overview; memory only; public/sample_lab_data.csv marked as example; "Ask VESTA to assess".
5. DEMO mode, labelled DEMO everywhere: simulated cabin readings (O2, pressure, pO2, airflow, smoke, temperature) every 1.5 s with sparklines, hazard gauge, 90-second live chart, "Run fire drill" (smoke and temperature up, airflow down, tiles red past limits, then recovery) with VESTA's red alert and closing message, scrolling event ticker. Simulated values never enter tables or NASA charts.
6. About (/about): investigations and hardware, what each file holds, NASA PSI credit and links, limits, and a short "How VESTA works" note (the engine chain and Offline mode).
7. VESTA moves the dashboard when it uses compare, safety_audit or gap_finder, in every engine including Offline. 4 more eval questions.
8. Checkpoint.

## PHASE 6 — Quality, polish, launch (no new features)
1. scripts/run-evals.ts runs evals/questions.yaml against /api/vesta for every available engine and always for Offline (tools, facts, sources, confidence, grounding) → evals/report.md with a score per engine. Improve the system prompt and tool descriptions (no special cases) until each AI engine passes ≥ 90%; Offline must pass every question in its supported intents.
2. Strict NASA-judge review: numbers without data or a tested formula, answers without sources or confidence, unlabelled DEMO content, secrets in code or git history, any key reaching the browser. Fix all.
3. Hardening: message length limit, per-visitor rate limit on /api/vesta, friendly errors, timeouts, cached map/rank/gap results, fallback chain tested with a deliberately broken key.
4. Polish at 400px, 1024px and 1440px; loading skeletons; empty states; skippable 3-step first-visit tour (mission chips → map → VESTA and its model menu) remembered in localStorage; page titles; favicon.
5. README.md: keep the existing content (including the Vercel link) and add what HEARTH is, features, the VESTA engine chain, architecture, how to run, which keys are optional, data credits, Team Polaris. docs/DEMO_SCRIPT.md: 2-minute demo with exact messages (lunar rover question → numbers → map → safety audit → compare chart → data gap → switch the model menu to show the backup chain → uses on Earth). Run it on the live site and fix anything slow or broken.
6. Checkpoint with commit "Phase 6: launch", then git tag v1.0 and push the tag.

## FINAL REPORT
The live URL, the eval score per engine, which engines are active, what each page does, and anything I should check by hand.
