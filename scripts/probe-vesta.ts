/**
 * Dev probe: run VESTA questions through the router and print the answer, engine and confidence.
 * Usage: npx tsx scripts/probe-vesta.ts <engine> "<question>" [mission]
 * Loads .env.local itself; never prints key values.
 */
import fs from "node:fs";
import { runVesta } from "@/lib/vesta/router";
import type { EngineChoice } from "@/lib/vesta/engines";
import type { VestaEvent } from "@/lib/vesta/events";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const [engine = "offline", question = "What is pO2 at 34% O2 and 8.2 psi?", mission = "lunar-rover"] = process.argv.slice(2);
  let text = "";
  const t0 = Date.now();
  await runVesta(
    { messages: [{ role: "user", content: question }], missionId: mission, level: "researcher", engine: engine as EngineChoice },
    (e: VestaEvent) => {
      if (e.type === "text") text += e.delta;
      else if (e.type === "step") console.log(`  step ${e.tool} ${e.status}: ${e.summary}`);
      else if (e.type === "engine") console.log(`ENGINE ${e.badge}${e.note ? ` [${e.note}]` : ""}`);
      else if (e.type === "confidence") console.log(`CONFIDENCE ${e.confidence}${e.note ? ` (${e.note})` : ""}`);
      else if (e.type === "sources") console.log(`SOURCES ${e.sources.slice(0, 4).map((s) => `${s.file.split("/").pop()}${s.row ? `#${s.row}` : s.page ? ` p${s.page}` : ""}`).join(", ")}`);
      else if (e.type === "chart") console.log(`CHART ${e.chart.title}`);
      else if (e.type === "ui") console.log(`UI ${JSON.stringify(e.ui)}`);
      else if (e.type === "error") console.log(`ERROR ${e.message}`);
    },
    { chunkDelayMs: 0, useCache: false, log: (m) => console.log(`  log: ${m}`) },
  );
  console.log(`TEXT (${Date.now() - t0} ms):\n${text}\n`);
}

main();
