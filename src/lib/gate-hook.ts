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
import { conformanceRowsLocated, type LineLocator } from "./check-contract.js";
import { familyOfHarness } from "./harness.js";

/** The harnesses whose native refusal shape this command speaks. A closed list: an id outside it
 *  is a configuration error — said on stderr and traced in runward/gate-bypass.log, never a silent
 *  allow-forever, and never a block either (see misconfiguredEntry). */
export const GATE_HOOK_HARNESSES = ["claude", "copilot", "kiro", "gemini", "junie", "cursor"] as const;
export type GateHookHarness = (typeof GATE_HOOK_HARNESSES)[number];

/** The id gate-hook runs under, or null when it is not one. `wire --json` names harnesses by their
 *  detection id (`claude-code`, `gemini-cli`), and an agent that copied that value into
 *  `--harness` got "unknown harness" (RWD-2026-0147). A detection id is accepted as an ALIAS of its
 *  family, from the same table `wire` reads — never a second list to keep in step. */
export function resolveGateHookHarness(id: string | undefined): GateHookHarness | null {
  if (!id) return null;
  if ((GATE_HOOK_HARNESSES as readonly string[]).includes(id)) return id as GateHookHarness;
  const family = familyOfHarness(id);
  return family && (GATE_HOOK_HARNESSES as readonly string[]).includes(family) ? family as GateHookHarness : null;
}

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
 *  renaming of the verdict; nothing here re-decides (ADR-0047).
 *
 *  With a locator, each conformance line also says WHERE: `(runward/architecture.md:41)`. The
 *  model reading this refusal used to be told `Architect · <rule>` and left to guess the file and
 *  search for the row (RWD-2026-0149). The location is the one `check --json` and the SARIF log
 *  publish, from the same locator. */
export function refusalLines(verdict: Verdict, locate?: LineLocator): string[] {
  const lines: string[] = [];
  lines.push(`runward gate: check --strict refuses this tree — ${verdictSummaryParts(verdict).join(" · ")}.`);
  const unfilled = verdict.deliverables.filter((r) => r.state !== "filled");
  for (const d of unfilled.slice(0, 10)) {
    lines.push(`✗ ${d.phase} · ${d.artifact} (runward/${d.relPath}) — ${d.state}`);
  }
  const rows = conformanceRowsLocated(verdict, locate);
  // ONE INSTRUCTION PER CAUSE (RWD-2026-0158). This refusal is what the model reads back at the
  // end of a turn, and on a fresh mission it used to carry the same 260-character instruction
  // fifteen times, then "and 34 more": about 5 KB of context per stop, most of it one sentence.
  // The diagnosis stays with each row; an instruction shared by two rows or more is said once, after
  // them, with how many rows it answers. Three rows or more with the same diagnosis are one line
  // per deliverable naming the rules (every one of them: a name is short, a repeated clause is not).
  // Pure rendering: `conformance[].problem` in `check --json` is unchanged, full sentence per row.
  const split = (p: string): { brief: string; fix: string | null } => {
    const i = p.indexOf(" — ");
    return i < 0 ? { brief: p, fix: null } : { brief: p.slice(0, i), fix: p.slice(i + 3) };
  };
  const briefCount = new Map<string, number>();
  const fixCount = new Map<string, number>();
  for (const r of rows) {
    const { brief, fix } = split(r.problem);
    briefCount.set(brief, (briefCount.get(brief) ?? 0) + 1);
    if (fix) fixCount.set(fix, (fixCount.get(fix) ?? 0) + 1);
  }
  const grouped = (brief: string) => (briefCount.get(brief) ?? 0) >= 3;
  // A placeholder rule name ("(seal)", "(corpus)") names nothing: the scope says what it is.
  const name = (r: { scope: string; rule: string }) => r.rule.startsWith("(") ? r.scope : `${r.scope} · ${r.rule}`;
  const fixes = new Map<string, number>();
  const groupsDone = new Set<string>();
  let singlesShown = 0, singlesTotal = 0;
  for (const r of rows) {
    const { brief, fix } = split(r.problem);
    const elide = fix !== null && (grouped(brief) || (fixCount.get(fix) ?? 0) >= 2);
    if (elide) fixes.set(fix!, (fixes.get(fix!) ?? 0) + 1);
    if (grouped(brief)) {
      if (groupsDone.has(brief)) continue;
      groupsDone.add(brief);
      const members = rows.filter((x) => split(x.problem).brief === brief);
      lines.push(`✗ ${members.length} row(s): ${brief}`);
      const byScope = new Map<string, typeof members>();
      for (const m of members) byScope.set(m.scope, [...(byScope.get(m.scope) ?? []), m]);
      for (const [scope, ms] of byScope) {
        const where = locate ? ` (${ms[0]!.file})` : "";
        lines.push(`    ${scope}${where}: ${ms.map((m) => `${m.rule}${locate && m.line !== null ? `:${m.line}` : ""}`).join(", ")}`);
      }
      continue;
    }
    singlesTotal++;
    if (singlesShown >= 15) continue;
    singlesShown++;
    const where = locate ? ` (${r.file}${r.line !== null ? `:${r.line}` : ""})` : "";
    lines.push(`✗ ${name(r)}${where} — ${elide ? brief : r.problem}`);
  }
  for (const [fix, n] of fixes) lines.push(`  Fix for the ${n} row(s) above that share it: ${fix}`);
  const hidden = (unfilled.length - Math.min(unfilled.length, 10)) + (singlesTotal - singlesShown);
  if (hidden > 0) lines.push(`… and ${hidden} more — \`runward check --strict\` names them all.`);
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
      return { stream: "stdout", text: JSON.stringify({ followup_message: `runward gate red (advisory: Cursor cannot block this turn): ${text.replace(/^runward gate: /, "")}` }), exitCode: 0 };
  }
}

/** The committed trace of a release. One line, greppable, dated by the caller (the verdict path
 *  takes no clock; the hook seam may). */
export function bypassEntry(dateIso: string, harness: string, cause: "already-blocked" | "loop-ceiling"): string {
  return `${dateIso}  gate red at end of turn, released after one block (${harness}, ${cause})\n`;
}

/** The committed trace of a hook that could not evaluate the gate because its own command line is
 *  wrong (unknown harness, missing or unknown option).
 *
 *  Until 0.42.3 that case exited 2 — Claude Code's and Junie's "block and show stderr to the model"
 *  — BEFORE the payload was read, so `stop_hook_active` was never honoured: a one-letter typo in
 *  settings.json (`--harness claud`) handed the model `unknown harness "claud"` as if it were the
 *  gate's refusal, on every end of turn, forever (RWD-2026-0137). That broke invention 1 (block
 *  once, never trap a session) and misfiled a configuration error as a verdict, which invention 4
 *  and ADR-0065 forbid in the other direction: fail open on infrastructure, never on a verdict.
 *  No verdict was computed here, so there is nothing to refuse. The "never a silent allow-forever"
 *  the exit 2 was guarding is kept by this line instead: it lands in the committed log, one per
 *  turn, so the misconfiguration is in the diff until someone fixes the hook command. */
export function misconfiguredEntry(dateIso: string, detail: string): string {
  return `${dateIso}  gate NOT evaluated: gate-hook misconfigured (${detail}), failed open\n`;
}
