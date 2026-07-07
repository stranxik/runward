import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Operator-supplied hook seam around `check` (ADR-0008). Opt-in only: runward's own
 * gate never runs these; they execute solely under `check --hooks`, so a clone cannot
 * run anything by surprise. This is where language-specific proofs runward will not run
 * itself (e.g. a baseline test check, the P4 residual) are plugged in.
 */
export interface HookResult { ran: number; failed: string[]; }

export function runHooks(missionDir: string, phase: "before" | "after", cwd: string): HookResult {
  const result: HookResult = { ran: 0, failed: [] };
  const path = join(missionDir, "hooks.json");
  if (!existsSync(path)) return result;
  let cfg: { before?: string[]; after?: string[] };
  try { cfg = JSON.parse(readFileSync(path, "utf8")); } catch { return result; }
  for (const cmd of cfg[phase] ?? []) {
    result.ran++;
    try { execSync(cmd, { cwd, stdio: "inherit" }); }
    catch { result.failed.push(cmd); }
  }
  return result;
}
