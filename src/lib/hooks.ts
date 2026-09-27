import { execSync } from "node:child_process";
import type { StdioOptions } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Operator-supplied hook seam around `check` (ADR-0008). Opt-in only: runward's own
 * gate never runs these; they execute solely under `check --hooks`, so a clone cannot
 * run anything by surprise. This is where language-specific proofs runward will not run
 * itself (e.g. a baseline test check, the P4 residual) are plugged in.
 */
export interface HookResult { ran: number; failed: string[]; }

export type HookPhase = "before" | "after";

/**
 * What `runward/hooks.json` holds, read ONCE per run, before any hook executes.
 *
 * RWD-2026-0134, RWD-2026-0135. Until 0.42.3 the file was read inside runHooks with `catch { return result; }`, so three
 * different states printed the same thing: no file, a file with a trailing comma, and a file
 * whose hooks all passed. Measured by the 2026-09-27 audit: `{"before":["exit 1"],}` under
 * `check --hooks` printed no Hooks section, `✓ All expected deliverables are filled`, exit 0 — the
 * operator asked for their proofs to run and got a green in which none ran. And
 * `{"before":"exit 1"}` was iterated character by character (`e`, `x`, `i`, `t`, ` `, `1` launched
 * as commands): `✗ 5/6 failed`, a count of nothing the operator wrote.
 *
 * So the three states are told apart here. `absent` is legitimate (--hooks on a mission with no
 * hooks) and is SAID, never a failure; `invalid` is a configuration error that counts as a failed
 * hook, because under --hooks an unreadable file means the operator's proofs did not run — the
 * same reason a failing hook blocks the gate (verdict.ts: runward does not overrule the operator's
 * own check, and it does not pretend one ran either).
 */
export type HooksConfig =
  | { state: "absent" }
  | { state: "invalid"; problem: string }
  | { state: "ok"; before: string[]; after: string[] };

export function readHooksConfig(missionDir: string): HooksConfig {
  const path = join(missionDir, "hooks.json");
  if (!existsSync(path)) return { state: "absent" };
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { return { state: "invalid", problem: `not valid JSON (${(e as Error).message})` }; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { state: "invalid", problem: `must be a JSON object with "before" and/or "after" arrays` };
  }
  const cfg = raw as Record<string, unknown>;
  const phases: Record<HookPhase, string[]> = { before: [], after: [] };
  for (const phase of ["before", "after"] as const) {
    const v = cfg[phase];
    if (v === undefined) continue;
    // Shape, not content: a string is iterable, and iterating it is how "exit 1" became six
    // commands. Only an array of non-empty strings is a list of commands.
    if (!Array.isArray(v) || v.some((cmd) => typeof cmd !== "string" || cmd.trim() === "")) {
      return { state: "invalid", problem: `"${phase}" must be an array of command strings` };
    }
    phases[phase] = v as string[];
  }
  return { state: "ok", ...phases };
}

export function runHooks(cfg: HooksConfig, phase: HookPhase, cwd: string, opts: { quietStdout?: boolean } = {}): HookResult {
  const result: HookResult = { ran: 0, failed: [] };
  // An invalid file runs NOTHING, in either phase: half a configuration is not the operator's
  // configuration, and the caller has already counted the file itself as the failure.
  if (cfg.state !== "ok") return result;
  // Under --json (quietStdout), route the hook's own stdout to the parent's stderr (fd 2): a
  // subprocess writing to stdout would otherwise corrupt the single-JSON-object contract, which
  // log() cannot suppress. The hook's output stays visible on stderr; stdout carries only the JSON.
  const stdio: StdioOptions = opts.quietStdout ? ["inherit", 2, "inherit"] : "inherit";
  for (const cmd of cfg[phase]) {
    result.ran++;
    try { execSync(cmd, { cwd, stdio }); }
    catch { result.failed.push(cmd); }
  }
  return result;
}
