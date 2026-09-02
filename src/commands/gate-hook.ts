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
import { GATE_HOOK_HARNESSES, LOOP_CEILING, parseHookPayload, refusalLines, renderRefusal, bypassEntry, type GateHookHarness } from "../lib/gate-hook.js";
import { generationDate } from "../lib/styles.js";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

export async function gateHookCommand(opts: { harness?: string; path?: string }): Promise<void> {
  const harness = opts.harness as GateHookHarness | undefined;
  if (!harness || !GATE_HOOK_HARNESSES.includes(harness)) {
    // A wrong id is a CONFIGURATION error, said loud once at install time — never a silent
    // allow-forever (that would be failing open on the one thing this command exists to carry).
    console.error(`runward gate-hook: unknown harness "${opts.harness ?? ""}" — one of: ${GATE_HOOK_HARNESSES.join(", ")}.`);
    process.exit(2);
  }

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) return; // fail-open: a hook installed repo-wide may fire outside any mission — infrastructure, not a verdict.

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

  const refusal = renderRefusal(harness, refusalLines(verdict));
  if (refusal.stream === "stderr") console.error(refusal.text);
  else console.log(refusal.text);
  process.exit(refusal.exitCode);
}
