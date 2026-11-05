/**
 * Builds public/blueprint.html.
 *   tsx scripts/blueprint/build.ts          rebuild, and fail loudly on errors
 *   tsx scripts/blueprint/build.ts --safe   used by prebuild: a failure keeps the last good file and never stops a deploy
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assemble, normalise, OUTPUT, readManifest, renderHtml, structuralIds, type Manifest, type Volatile } from "./render";
import { scanProject, type Scan } from "./scan";

const MAX_HISTORY = 80;
const MAX_CHANGES = 40;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** Git may be missing on the build server: then keep the stored history and add the commit Vercel reports. */
function gitInfo(prev: Manifest | null): Pick<Volatile, "history"> & { commit: string | null; subject: string | null } {
  const log = git(["log", `-n${MAX_HISTORY}`, "--date=short", "--format=%h%x09%ad%x09%s"]);
  if (log) {
    const history = log.split("\n").map((l) => {
      const [hash, date, ...rest] = l.split("\t");
      return { hash, date, subject: rest.join(" ") };
    });
    return { history, commit: history[0]?.hash ?? null, subject: history[0]?.subject ?? null };
  }
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const subject = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null;
  const stored = prev?.history ?? [];
  const history = sha && subject && !stored.some((h) => h.hash === sha) ? [{ hash: sha, date: new Date().toISOString().slice(0, 10), subject }, ...stored].slice(0, MAX_HISTORY) : stored;
  return { history, commit: sha ?? prev?.scan.commit ?? null, subject: subject ?? prev?.scan.subject ?? null };
}

function nextChanges(prev: Manifest | null, scan: Scan): Volatile["changes"] {
  const before = prev?.changes ?? [];
  if (!prev) return before;
  const old = new Set(structuralIds(prev));
  const now = new Set(structuralIds(scan));
  const added = [...now].filter((x) => !old.has(x));
  const removed = [...old].filter((x) => !now.has(x));
  if (!added.length && !removed.length) return before;
  return [{ date: new Date().toISOString().slice(0, 10), added, removed }, ...before].slice(0, MAX_CHANGES);
}

async function main() {
  const file = path.join(process.cwd(), OUTPUT);
  const previousHtml = fs.existsSync(file) ? normalise(fs.readFileSync(file, "utf8")) : null;
  const prev = previousHtml ? readManifest(previousHtml) : null;

  const scan = await scanProject();
  const info = gitInfo(prev);
  const changes = nextChanges(prev, scan);
  const scanStamp = (at: string): Volatile["scan"] => ({ at, commit: info.commit, subject: info.subject });

  // Keep the old timestamp when nothing else changed, so a rebuild does not touch the file.
  if (prev && previousHtml) {
    const same = renderHtml(assemble(scan, { scan: scanStamp(prev.scan.at), history: info.history, changes }));
    if (same === previousHtml) {
      console.log("[blueprint] already up to date");
      return;
    }
  }
  const html = renderHtml(assemble(scan, { scan: scanStamp(new Date().toISOString()), history: info.history, changes }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  const m = readManifest(html);
  const missing = m?.unexplained.length ?? 0;
  console.log(`[blueprint] wrote ${OUTPUT} (${Math.round(Buffer.byteLength(html) / 1024)} KB)${missing ? `, ${missing} item(s) not explained yet: ${m?.unexplained.map((u) => u.id).join(", ")}` : ""}`);
}

main().catch((e: unknown) => {
  const safe = process.argv.includes("--safe");
  console.error(`[blueprint] ${safe ? "scan failed, keeping the last good page" : "failed"}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(safe ? 0 : 1);
});
