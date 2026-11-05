/**
 * Live Blueprint: serves the page at http://localhost:4321 and rebuilds it whenever the project changes.
 * The open page refreshes itself. Local only: it listens on 127.0.0.1 and is never deployed.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { OUTPUT } from "./render";

const PORT = Number(process.env.BLUEPRINT_PORT ?? 4321);
const ROOT = process.cwd();
const WATCH = ["app", "components", "lib", "tests", "scripts/blueprint", "scripts/ingest", "data/processed", "evals", "package.json"];
const clients = new Set<http.ServerResponse>();

const RELOAD = `<script>new EventSource("/__events").addEventListener("reload",function(){location.reload()});document.documentElement.dataset.live="1"</script>`;

function rebuild(): Promise<void> {
  return new Promise((resolve) => {
    const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    const child = spawn(process.execPath, [tsx, "scripts/blueprint/build.ts"], { cwd: ROOT, stdio: "inherit" });
    child.on("exit", () => resolve());
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;
let building = false;
let again = false;

async function run() {
  if (building) {
    again = true;
    return;
  }
  building = true;
  await rebuild();
  building = false;
  for (const c of clients) c.write("event: reload\ndata: 1\n\n");
  if (again) {
    again = false;
    void run();
  }
}

function schedule(file: string | null) {
  if (file && /blueprint\.html$|\.tsbuildinfo$/.test(file)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void run(), 500);
}

const server = http.createServer((req, res) => {
  if (req.url === "/__events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  try {
    const html = fs.readFileSync(path.join(ROOT, OUTPUT), "utf8").replace("</body>", `${RELOAD}</body>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  } catch {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("The Blueprint is still building. Refresh in a moment.");
  }
});

void rebuild().then(() => {
  for (const target of WATCH) {
    const full = path.join(ROOT, target);
    if (!fs.existsSync(full)) continue;
    fs.watch(full, { recursive: fs.statSync(full).isDirectory() }, (_e, f) => schedule(f ? String(f) : null));
  }
  server.listen(PORT, "127.0.0.1", () => console.log(`[blueprint] live at http://localhost:${PORT} (press Ctrl+C to stop)`));
});
