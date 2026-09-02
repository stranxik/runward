// The gate enters the harness's loop (ADR-0065, H1). Everything the command decides lives here,
// where a test reaches it without a terminal (the ADR-0047 discipline).
//
// This module generalises the four inventions of the repository's own Stop hook
// (.claude/hooks/runward-gate.sh, 2026-08-27 — the author submitting to the constraint he sells):
//   1. block ONCE — the harness's native re-entry guards (`stop_hook_active`, `loop_count` with a
//      hard ceiling) are honoured so a red gate never traps a session;
//   2. a release is a TRACE, never a silence — it appends to runward/gate-bypass.log, which is
//      committed: the gate can only be bypassed in a diff someone can read;
//   3. show the REFUSALS, not the tail of the output — a block that does not name what is red
//      forces the operator to re-run the gate to understand it;
//   4. fail open on INFRASTRUCTURE (no mission, unreadable payload), never on a verdict.
//
// ADR-0054 boundary: this module computes the verdict IN PROCESS (computeVerdict import) — no
// spawned runward, no jq, no socket. gate-hook is the harness's runtime seam, not the verdict's;
// the runtime-boundary test walks its closure and refuses every crossing, hook seam included.
import type { Verdict } from "./verdict.js";
import { verdictSummaryParts } from "./verdict.js";
import { conformanceRows } from "./check-contract.js";

/** The harnesses whose native refusal shape this command speaks. A closed list: an id outside it
 *  is a configuration error said loud at install time, never a silent allow-forever. */
export const GATE_HOOK_HARNESSES = ["claude", "copilot", "kiro", "gemini", "junie", "cursor"] as const;
export type GateHookHarness = (typeof GATE_HOOK_HARNESSES)[number];

/** One block per stop, at most: past this many hook re-entries the gate releases and traces. */
export const LOOP_CEILING = 8;

export interface HookGuards {
  /** The harness says it already blocked this stop (`stop_hook_active`, Claude's contract). */
  alreadyBlocked: boolean;
  /** The harness's own re-entry counter (`loop_count`), when the payload carries one. */
  loopCount: number | null;
}

/** Tolerant payload reading: hooks receive JSON on stdin, but a manual invocation pipes nothing
 *  and a broken harness pipes garbage. Both yield NO guards — the verdict is still judged (the
 *  prototype's posture: fail-open applies to infrastructure, not to a red gate). */
export function parseHookPayload(text: string): HookGuards {
  try {
    const j = JSON.parse(text);
    const loop = typeof j?.loop_count === "number" ? j.loop_count : null;
    return { alreadyBlocked: j?.stop_hook_active === true, loopCount: loop };
  } catch {
    return { alreadyBlocked: false, loopCount: null };
  }
}

/** The refusal, named: what check --strict would print as ✗, selected — never the tail. Pure
 *  renaming of the verdict; nothing here re-decides (ADR-0047). */
export function refusalLines(verdict: Verdict): string[] {
  const lines: string[] = [];
  lines.push(`runward gate: check --strict refuses this tree — ${verdictSummaryParts(verdict).join(" · ")}.`);
  for (const d of verdict.deliverables.filter((r) => r.state !== "filled").slice(0, 10)) {
    lines.push(`✗ ${d.phase} · ${d.artifact} (runward/${d.relPath}) — ${d.state}`);
  }
  for (const r of conformanceRows(verdict).slice(0, 15)) {
    lines.push(`✗ ${r.scope} · ${r.rule} — ${r.problem}`);
  }
  const shown = lines.length - 1;
  const total = verdict.deliverables.filter((r) => r.state !== "filled").length + conformanceRows(verdict).length;
  if (total > shown) lines.push(`… and ${total - shown} more — \`runward check --strict\` names them all.`);
  return lines;
}

export interface Refusal {
  /** Where the harness reads its contract from. */
  stream: "stdout" | "stderr";
  text: string;
  exitCode: number;
}

/** The native refusal per harness — each speaks the shape its harness's hook contract blocks on.
 *  Cursor's hook is advisory by contract (no deny channel): the refusal is a follow-up message
 *  labelled as the retry tier, exit 0 — an honest label, never a pretended block. */
export function renderRefusal(harness: GateHookHarness, lines: string[]): Refusal {
  const text = lines.join("\n");
  switch (harness) {
    case "claude":
    case "junie":
      return { stream: "stderr", text, exitCode: 2 };
    case "copilot":
    case "kiro":
      return { stream: "stdout", text: JSON.stringify({ decision: "block", reason: text }), exitCode: 0 };
    case "gemini":
      return { stream: "stdout", text: JSON.stringify({ decision: "deny", reason: text }), exitCode: 0 };
    case "cursor":
      return { stream: "stdout", text: JSON.stringify({ followup_message: `runward gate red (advisory retry tier — Cursor's hook cannot block): ${text}` }), exitCode: 0 };
  }
}

/** The committed trace of a release. One line, greppable, dated by the caller (the verdict path
 *  takes no clock; the hook seam may). */
export function bypassEntry(dateIso: string, harness: string, cause: "already-blocked" | "loop-ceiling"): string {
  return `${dateIso}  gate red at end of turn, released after one block (${harness}, ${cause})\n`;
}
