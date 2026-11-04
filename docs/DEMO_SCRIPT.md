# HEARTH 2-minute demo script

Live site: https://project-hearth-five.vercel.app · Start on **Mission overview** with **Lunar rover** selected and the model menu on **Auto**.
Tip: answers are cached for 10 minutes, so a rehearsal makes the live run instant.

| Time | Do | Say / show |
|---|---|---|
| 0:00 | Open the overview. VESTA has already posted its proactive alert. | "HEARTH turns NASA's microgravity combustion experiments into fire-safety evidence for crewed habitats. VESTA spoke first: the rover's 34% oxygen is enriched." |
| 0:10 | Point at the KPI tiles. | "pO2 2.788 psi, 0.903× the ISS. The badge says the condition is supported: 28 NASA tests sit within ±5 points of O2 and ±2.5 psi." |
| 0:20 | In VESTA type: **`Is the lunar rover cabin at 34% O2 and 8.2 psi inside the tested data? Highlight the nearest tests.`** | Tool steps appear live; nearest tests glow on the map. "Every number comes from a tool result, with file and row, and a confidence tag." |
| 0:40 | Hover a glowing point, click it. | Details drawer: source row, pO2, raw values, related PDF passages. "Nothing is invented: every field cites its CSV row." |
| 0:50 | Type: **`Run a safety audit for the rover`** | VESTA moves to **Safety & gaps**. "Six rules: prevention, detection, suppression. Cabin materials are untested at 34% O2: severity 80, no data." |
| 1:05 | Type: **`Compare ACME and CFI`** | VESTA draws a chart and opens **Compare**. Point at the radar: "formula on every axis." Pin the chart to the dashboard. |
| 1:20 | On Safety & gaps, point at the red cells. Type: **`What data is missing for lunar habitats?`** | "No solid materials and only microgravity. VESTA doesn't predict outside the data: it names the gap and the experiment that would fill it — BASS/Saffire-type material tests, LUCI or FM2 at lunar gravity." |
| 1:35 | Switch the model menu to **Offline** and ask **`What is pO2 at 30% O2 and 10.2 psi?`** | Badge "Offline mode": 3.06 psi. "If every AI service is down or out of free credits, VESTA still answers — the backup chain is Claude → Groq → Gemini → Offline." |
| 1:50 | Scroll to **Uses on Earth** on Safety & gaps. | "The same data helps cleaner engines and soot and smoke models for building fires." |
| 2:00 | End. | "HEARTH: NASA evidence, no guesses." |

Optional if time: **My data lab** → upload `sample_lab_data.csv` (made-up example) → triangles on the map; **Run fire drill** in the DEMO telemetry panel (labelled DEMO, never NASA data).
