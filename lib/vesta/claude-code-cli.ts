/**
 * Finding and locking down the local Claude Code CLI. This engine only exists on the machine that runs
 * the site with Claude Code logged in; it is never available on Vercel.
 */
import fs from "node:fs";
import path from "node:path";

const EXE = process.platform === "win32" ? "claude.exe" : "claude";

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Full path of the CLI, or null. Looks only at the given environment, so tests stay deterministic. */
export function findClaudeCli(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL) return null; // hosted: no CLI, and visitors must never reach a personal Claude plan
  const home = env.USERPROFILE ?? env.HOME;
  const dirs = [...(env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean), ...(home ? [path.join(home, ".local", "bin")] : [])];
  for (const dir of dirs) {
    const full = path.join(dir, EXE);
    if (isFile(full)) return full;
  }
  return null;
}

/**
 * Only what the CLI needs to start and find its login. Everything else stays behind, above all the AI keys
 * from .env.local: with ANTHROPIC_API_KEY set the CLI would bill that key instead of the Claude plan.
 */
const ENV_ALLOWLIST = [
  "PATH", "Path", "PATHEXT", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA",
  "TEMP", "TMP", "TMPDIR", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "ProgramData", "ProgramFiles",
  "LANG", "LC_ALL", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "CLAUDE_CONFIG_DIR", "CLAUDE_CODE_GIT_BASH_PATH",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
];

export function cliEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: Record<string, string | undefined> = {};
  for (const k of ENV_ALLOWLIST) if (env[k] !== undefined) out[k] = env[k];
  return out as NodeJS.ProcessEnv;
}

/** True when the request was addressed to this machine by name, not through a network address. */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return ["localhost", "127.0.0.1", "[::1]"].includes(name.toLowerCase());
}
