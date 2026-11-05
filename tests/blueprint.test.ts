import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";
import { allTests, isCountable } from "@/lib/data";
import { envelopeCheck, ENVELOPE_O2_WINDOW_PCT, ENVELOPE_P_WINDOW_PSI, ENVELOPE_SUPPORTED_MIN, ISS_PO2_PSI, pO2, ratioToISS } from "@/lib/physics";
import { currentFingerprints, fingerprint, pipelineStatus, readReviewed, WATCHED } from "../scripts/blueprint/pipeline-watch";
import { assemble, audit, normalise, OUTPUT, readManifest, renderHtml, type Manifest } from "../scripts/blueprint/render";
import { scanProject, type Scan } from "../scripts/blueprint/scan";
import { STORIES } from "../scripts/blueprint/stories";

const ROOT = process.cwd();
const HOW_TO_FIX = "Run: npm run blueprint";
let scan: Scan;
let html: string;
let stored: Manifest;

beforeAll(async () => {
  scan = await scanProject();
  html = normalise(fs.readFileSync(path.join(ROOT, OUTPUT), "utf8"));
  stored = readManifest(html) as Manifest;
}, 120_000);

function strings(value: unknown, skip: string[], out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, skip, out);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) if (!skip.includes(k)) strings(v, skip, out);
  return out;
}

describe("Blueprint stays in step with the project", () => {
  it("has a plain-language story for everything the scanner finds", () => {
    const { unexplained, orphans } = audit(scan);
    expect(unexplained, "Add a story for these in scripts/blueprint/stories.ts").toEqual([]);
    expect(orphans, "These stories describe things that no longer exist: remove them from scripts/blueprint/stories.ts").toEqual([]);
  });

  it("public/blueprint.html is up to date", () => {
    expect(stored, "public/blueprint.html is missing or unreadable").toBeTruthy();
    const fresh = renderHtml(assemble(scan, { scan: stored.scan, history: stored.history, changes: stored.changes }));
    expect(fresh === html, `The Blueprint is out of date. ${HOW_TO_FIX}`).toBe(true);
  });

  it("every file a story links to exists", () => {
    const paths = new Set<string>();
    for (const n of Object.values(STORIES.mapNodes)) n.files.forEach((f) => paths.add(f));
    for (const r of STORIES.rules) [...r.code, ...r.test].forEach((f) => paths.add(f));
    const missing = [...paths].filter((p) => !fs.existsSync(path.join(ROOT, p)));
    expect(missing).toEqual([]);
  });
});

describe("Pipeline watch", () => {
  it("no pipeline file changed since its explanation was reviewed", () => {
    const pending = pipelineStatus(currentFingerprints(), readReviewed());
    expect(
      pending.map((p) => `${p.file} (${p.reason})`),
      "Re-read these sections of scripts/blueprint/stories.ts, update them if needed, then run: npm run blueprint:reviewed",
    ).toEqual([]);
  });

  it("watches files and sections that really exist", () => {
    for (const w of WATCHED) {
      expect(fs.existsSync(path.join(ROOT, w.file)), w.file).toBe(true);
      expect(Object.keys(STORIES.sections), w.file).toContain(w.section);
    }
  });

  it("spots changed, removed and never-reviewed files", () => {
    const [a, b, c] = WATCHED.map((w) => w.file);
    const current = currentFingerprints();
    const reviewed = { ...current, [a]: "something-else" };
    delete reviewed[b];
    const stillThere = { ...current };
    delete stillThere[c];
    const found = pipelineStatus(stillThere, reviewed);
    expect(found.find((x) => x.file === a)?.reason).toBe("changed");
    expect(found.find((x) => x.file === b)?.reason).toBe("new");
    expect(found.find((x) => x.file === c)?.reason).toBe("removed");
    expect(found.length).toBe(3);
  });

  it("ignores line endings, so Windows and the build server agree", () => {
    expect(fingerprint("a\r\nb\r\n")).toBe(fingerprint("a\nb\n"));
    expect(fingerprint("a\nb\n")).not.toBe(fingerprint("a\nc\n"));
  });
});

describe("Blueprint text cannot go stale", () => {
  it("every placeholder resolves to a real fact", () => {
    const text = JSON.stringify(assemble(scan, { scan: { at: "", commit: null, subject: null }, history: [], changes: [] }).stories);
    expect(text.match(/\{\{\w+\}\}/g) ?? []).toEqual([]);
  });

  it("no number is typed into the stories by hand", () => {
    const typed = strings(STORIES, ["files", "code", "test"]).filter((s) =>
      /\d/.test(
        s
          .replace(/\{\{\w+\}\}/g, "")
          .replace(/`[^`]*`/g, "")
          .replace(/\b(?:p?O2|3D|1g|N2)\b/g, ""),
      ),
    );
    expect(typed, "Use {{factName}} from scan.ts instead of typing a number").toEqual([]);
  });

  it("the row-cleaning demo uses columns and fields that really exist", () => {
    expect(scan.samples.length).toBe(3);
    for (const s of scan.samples) {
      for (const m of s.mapping) {
        expect(s.columns, `${s.investigation}: raw column`).toContain(m.raw);
        expect(s.clean[m.clean], `${s.investigation}: ${m.clean}`).not.toBeNull();
      }
    }
  });
});

describe("Blueprint demos match the real code", () => {
  it("the browser copy of the envelope rule and pO2 agrees with lib/physics.ts", () => {
    const ctx: { BPLogic?: { pO2(o2: number, p: number): number; ratioToIss(o2: number, p: number, iss: number): number; envelope(pts: unknown[], o2: number, p: number, r: unknown): { status: string; count: number } } } = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, "scripts/blueprint/logic.js"), "utf8"), ctx);
    const logic = ctx.BPLogic as NonNullable<typeof ctx.BPLogic>;
    const rule = { o2: ENVELOPE_O2_WINDOW_PCT, p: ENVELOPE_P_WINDOW_PSI, min: ENVELOPE_SUPPORTED_MIN };
    const tests = allTests();
    for (const [o2, p] of [[34, 8.2], [21, 14.7], [30, 10.2], [100, 4.3], [85, 48], [12, 7.2], [50, 30], [21, 73.5], [0, 1], [90, 40]]) {
      const real = envelopeCheck(o2, p, tests);
      const copy = logic.envelope(scan.points as unknown as unknown[], o2, p, rule);
      expect([copy.status, copy.count], `${o2}% at ${p} psi`).toEqual([real.status, real.count]);
      expect(logic.pO2(o2, p)).toBe(pO2(o2, p));
      expect(logic.ratioToIss(o2, p, ISS_PO2_PSI)).toBe(ratioToISS(o2, p).value);
    }
  });

  it("embeds exactly the counted tests", () => {
    const counted = allTests().filter((t) => isCountable(t) && t.o2_pct != null && t.pressure_psi != null);
    expect(scan.points.length).toBe(counted.length);
  });

  it("replays are complete recordings from the Offline engine", () => {
    expect(scan.replays.length).toBeGreaterThan(0);
    for (const r of scan.replays) {
      const types = r.events.map((e) => e.type);
      expect(types[0], r.id).toBe("engine");
      expect(types[types.length - 1], r.id).toBe("done");
      expect(types, r.id).toContain("confidence");
      expect(types, r.id).not.toContain("error");
      expect(r.intent, r.id).not.toBe("unknown");
    }
  });

  it("the grounding demo really catches the invented number", () => {
    expect(scan.grounding.caught).toBe(true);
    expect(scan.grounding.finalText).not.toContain(scan.grounding.invented);
  });

  it("the fallback playground covers every mix and always ends with an answer", () => {
    const { results } = scan.fallback;
    expect(Object.keys(results).length).toBe(3 ** (scan.engines.length - 1));
    const key = (s: string) => Array(scan.engines.length - 1).fill(s).join("|");
    expect(results[key("ok")].winner).toBe(scan.engines[0].id);
    expect(results[key("limit")].winner).toBe("offline");
    expect(results[key("limit")].note).toContain("Offline");
    expect(results[key("nokey")].path).toEqual(["offline"]);
    for (const r of Object.values(results)) expect(r.winner).toBeTruthy();
  });
});

describe("Blueprint is safe to publish", () => {
  it("contains nothing shaped like an API key", () => {
    expect(html.match(/sk-ant-[\w-]{8,}|sk-or-[\w-]{8,}|gsk_[\w]{8,}|AIza[\w-]{16,}|sk-[A-Za-z0-9]{24,}/g)?.length ?? 0).toBe(0);
  });

  it("contains no value from this machine's key settings", () => {
    const file = path.join(ROOT, ".env.local");
    const fromFile = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
    const lines = [...fromFile, ...Object.entries(process.env).map(([k, v]) => `${k}=${v}`)];
    const values = lines
      .map((l) => l.match(/^\s*\w*(?:API_KEY|TOKEN|SECRET)\w*\s*=\s*(.+?)\s*$/)?.[1])
      .filter((v): v is string => !!v && v.length >= 8 && !v.includes("PASTE"));
    // Report only a count, so a failure can never print a key.
    expect(values.filter((v) => html.includes(v)).length).toBe(0);
  });

  it("names no commit author or email address", () => {
    expect(html.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi)?.length ?? 0).toBe(0);
  });
});
