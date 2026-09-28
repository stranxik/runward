// `runward gate-hook --harness <id>` — the verdict enters the harness's loop (ADR-0065, H1).
// The shell only: stdin, streams, exit. Every decision lives in src/lib/gate-hook.ts.
//
// Measured 2026-09-02 (SURFACE-AGENT report): in 1668 recorded agent turns, the shipped
// consultative tier never once put the verdict in front of the model — every sample ended in
// `|| true`. This command is the armed tier's seam: a harness's Stop/per-tool hook pipes its
// payload here, and a red `check --strict` becomes the harness's OWN refusal shape instead of a
// swallowed exit code. Fail-open on infrastructure (no mission here is a legitimate state for a
// hook installed repo-wide), never on a verdict.
import { appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { computeVerdict, verdictFrom } from "../lib/verdict.js";
import { GATE_HOOK_HARNESSES, LOOP_CEILING, resolveGateHookHarness, parseHookPayload, refusalLines, renderRefusal, bypassEntry, misconfiguredEntry, type GateHookHarness } from "../lib/gate-hook.js";
import { generationDate } from "../lib/styles.js";
import { manifestLineLocator } from "../lib/sarif.js";
import { PACKAGED_WITHOUT_PROFILE } from "../lib/tools.js";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

/**
 * The hook's own command line is wrong: fail OPEN, said on stderr, traced in the committed log
 * when a mission is reachable (RWD-2026-0137). Exit 2 here was a block under Claude and Junie,
 * raised before the re-entry guards were read, so a typo trapped the session on every turn and the
 * model received a configuration error dressed as the gate's refusal. Also called from cli.ts for
 * Commander's own parse errors (missing --harness, unknown option), which never reach the action.
 */
export function gateHookMisconfigured(detail: string, path?: string): never {
  console.error(`runward gate-hook: misconfigured (${detail}). Failing open: the gate was NOT evaluated. Fix the hook command.`);
  const root = findMissionRoot(resolve(process.cwd(), path ?? "."));
  if (root) {
    try { appendFileSync(join(root, "runward", "gate-bypass.log"), misconfiguredEntry(new Date().toISOString(), detail)); }
    catch { /* an unwritable log is infrastructure too; stderr already said it */ }
  }
  process.exit(0);
}

export async function gateHookCommand(opts: { harness?: string; path?: string }): Promise<void> {
  const harness: GateHookHarness | null = resolveGateHookHarness(opts.harness);
  if (!harness) {
    // A harness runward packages without an armed tier is named for what it is (RWD-2026-0154).
    const packaged = PACKAGED_WITHOUT_PROFILE[opts.harness ?? ""];
    gateHookMisconfigured(`unknown harness "${opts.harness ?? ""}"; one of: ${GATE_HOOK_HARNESSES.join(", ")}, or wire's ids claude-code and gemini-cli${packaged ? `. ${packaged}` : ""}`, opts.path);
  }

  const start = resolve(process.cwd(), opts.path ?? ".");
  const root = findMissionRoot(start);
  if (!root) {
    // fail-open: a hook installed repo-wide may fire outside any mission — infrastructure, not a
    // verdict. But not in SILENCE: an empty stdout and exit 0 is exactly what a green gate prints,
    // so an operator testing the hook with a wrong -p could not tell "not evaluated" from "clean"
    // (RWD-2026-0138). stderr carries it; stdout, the harness's contract channel, stays empty.
    console.error(`runward gate: no runward/ mission found from ${start} — gate not evaluated (fail-open).`);
    return;
  }

  const guards = parseHookPayload(await readStdin());
  const mission = join(root, "runward");
  const verdict = computeVerdict(mission, { strict: true, hookFailed: 0 });
  if (verdictFrom(verdict.gaps, verdict.strictGaps, 0).clean) return;

  if (guards.alreadyBlocked || (guards.loopCount !== null && guards.loopCount >= LOOP_CEILING)) {
    // Block ONCE. The release is a committed trace, never a silence — the bypass lives in a diff.
    const cause = guards.alreadyBlocked ? "already-blocked" : "loop-ceiling";
    appendFileSync(join(mission, "gate-bypass.log"), bypassEntry(new Date().toISOString(), harness, cause));
    console.error("runward gate: still red. Releasing so the session is not trapped, and recording it in runward/gate-bypass.log — this is a bypass, and it is in the diff.");
    return;
  }

  const refusal = renderRefusal(harness, refusalLines(verdict, manifestLineLocator(mission)));
  if (refusal.stream === "stderr") console.error(refusal.text);
  else console.log(refusal.text);
  process.exit(refusal.exitCode);
}
