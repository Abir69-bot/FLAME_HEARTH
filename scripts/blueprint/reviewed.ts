/**
 * Records that the explanations were checked against the current pipeline code.
 * Run it only after re-reading the matching sections of stories.ts: npm run blueprint:reviewed
 */
import fs from "node:fs";
import path from "node:path";
import { currentFingerprints, pipelineStatus, readReviewed, REVIEWED_FILE } from "./pipeline-watch";

const current = currentFingerprints();
const pending = pipelineStatus(current, readReviewed());
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(process.cwd(), REVIEWED_FILE), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(pending.length ? `[blueprint] marked as reviewed:\n${pending.map((p) => `  ${p.file} (${p.reason})`).join("\n")}` : "[blueprint] nothing was waiting for review");
