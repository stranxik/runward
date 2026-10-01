// The decisions `check` makes AROUND the verdict, moved where a test can reach them.
//
// [ADR-0047](../../docs/adr/ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md) moved the
// verdict itself out of the command. It left everything the command decides on the way in and on the
// way out: which flag combinations are misuse, whether output is for a human or a machine, and the
// exact shape of the machine payload — which is the contract of
// [ADR-0030](../../docs/adr/ADR-0030-the-machine-surface-is-a-contract.md), read by a CI or an agent
// that cannot cross-check it against anything.
//
// Measured 2026-08-24: `checkCommand` was a single 442-line function with 79 decision-bearing lines
// interleaved with 69 rendering lines, reachable only by spawning the CLI, and a mutation sample of
// the slice where the exit code is chosen scored 26 %. Rendering is not the problem — prose has no
// business being pinned by a test. The problem is that the decisions could not be exercised without
// it.
//
// Nothing here renders, reads the filesystem, or exits the process. `optionFault` RETURNS the fault
// rather than printing and exiting, so a test can ask what a flag combination means without
// spawning a process and reading stderr.

import { GATED_DELIVERABLES, UNBOUND_CAUSE_TEXT } from "./conformance.js";
import type { Verdict } from "./verdict.js";
import { PHASES, type GapReport } from "./mission.js";

/** Everything `check` accepts, exactly as commander hands it over. */
export interface CheckOptions {
  path?: string;
  strict?: boolean;
  hooks?: boolean;
  coverage?: boolean;
  freeze?: boolean;
  json?: boolean;
  through?: string;
  attest?: boolean;
  sarif?: boolean;
  vsa?: boolean;
  resourceUri?: string;
}

/**
 * A flag combination that cannot mean anything, and the sentence that says why.
 *
 * The sentence is the whole of it. This interface used to carry a `flags` field beside it, naming
 * the combination a second time in a shorter form; the call site printed the message and nothing
 * ever read the field. The mutation campaign of 2026-08-28 is what said so out loud: three of the
 * four surviving mutants of this module sat on those three strings, and each was filed `equivalent`
 * — no test could distinguish them because no code path could. An `equivalent` that exists because
 * a field is dead is not a gap in the net, it is a gap in the code, and the answer to "nothing can
 * tell these apart" is to have one of them rather than a test for the other.
 */
export interface OptionFault {
  message: string;
}

/**
 * The fault in a flag combination, or null when there is none.
 *
 * Misuse exits 2, like any bad flag combination — never 1, which would read as a failed gate.
 */
export function optionFault(opts: CheckOptions): OptionFault | null {
  // ADR-0053: a declared horizon certifies only a prefix; a seal certifies a full crossing. The two
  // are mutually exclusive by construction — sealing a partial arc would read like completion, the
  // precise false green this mode refuses.
  if (opts.through && opts.freeze) {
    return {
      message: "`--through` cannot be combined with `--freeze`: a seal certifies a full crossing, a declared horizon only a prefix. Seal the whole arc (drop --through), or drop --freeze.",
    };
  }
  // `--vsa` without `--resource-uri` is misuse, not a default to invent: the URI names the artifact
  // a policy engine will admit or refuse, and runward has no way to verify a name it guessed.
  if (opts.vsa && !opts.resourceUri) {
    return {
      message: "`--vsa` needs `--resource-uri <uri>`: the VSA names the artifact it is about (a package, image or release URI), and runward reads a working tree — it cannot know where you publish it, and will not guess a name a policy engine would act on.",
    };
  }
  // ONE DOCUMENT PER STDOUT. `--json --sarif` emitted a SARIF and silently abandoned the ADR-0030
  // contract at exit 0, so a CI that asked for both got one and could not tell which. Measured
  // 2026-08-26. The resolution was a precedence chain (`vsa` → `sarif` → `attest`) that nothing
  // documented and no consumer could observe. A gate that refuses to guess everywhere else must not
  // guess here: name the conflict and let the operator pick.
  const emissions = ([["--json", opts.json], ["--sarif", opts.sarif], ["--vsa", opts.vsa], ["--attest", opts.attest]] as const)
    .filter(([, on]) => !!on).map(([f]) => f);
  if (emissions.length > 1) {
    return {
      message: `${emissions.join(" and ")} each write a different document to stdout, and only one can. Run \`runward check\` once per document you need.`,
    };
  }
  return null;
}

/** `--freeze` implies `--strict`: a seal certifies a strict crossing, never a lenient one. */
export function impliesStrict(opts: CheckOptions): boolean {
  return !!opts.strict || !!opts.freeze;
}

/**
 * The command a red run's "Next" line tells the reader to re-run: the SAME gate that just said no.
 *
 * The line used to read "re-run `runward check`" whatever produced the red. A strict gap, a failed
 * hook or an unratified decision is invisible to the bare command — it judges presence and runs no
 * hook — so the reader who followed the advice to the letter got a green, exit 0, and concluded the
 * gap was closed (RWD-2026-0129, measured 2026-09-27 on `--strict` and on `--hooks`). The flags that
 * shaped the verdict are echoed; the ones that only shape the output (`--json`, `--coverage`, …)
 * are not, and `--freeze` is echoed as the `--strict` it implies, never as a second seal attempt.
 */
export function rerunCommand(opts: CheckOptions): string {
  const parts = ["runward check"];
  if (opts.path) parts.push(`-p ${opts.path}`);
  if (impliesStrict(opts)) parts.push("--strict");
  if (opts.through) parts.push(`--through ${opts.through}`);
  if (opts.hooks) parts.push("--hooks");
  return parts.join(" ");
}

/** One run of text in the "Next" line: plain, a command to type, or muted commentary. */
export interface NextSegment { text: string; tone?: "command" | "muted" }

/**
 * The next gesture, as the terminal's "Next" line prints it and as `--json` publishes it.
 *
 * `check` has always told the reader what to do next, but only in prose: the comment above the
 * render said "name the next gesture, so the operating agent can hand the human a decision", and an
 * agent reading `--json` had to rebuild it from the counts (RWD-2026-0145). ONE implementation now
 * yields both: the terminal colours the segments, the payload joins them. `action` is a stable
 * identifier to branch on; `command` is the first command the line names; `rerun` is the gate that
 * said no (null on a green run, where nothing is re-run).
 */
export interface NextStep { action: string; command: string; rerun: string | null; segments: NextSegment[] }

export function nextStep(
  v: { gaps: number; strictGaps: number; hookFailed: number; breakdown: Verdict["strictBreakdown"] },
  opts: CheckOptions,
): NextStep {
  const cmd = (text: string): NextSegment => ({ text, tone: "command" });
  const muted = (text: string): NextSegment => ({ text, tone: "muted" });
  const plain = (text: string): NextSegment => ({ text });
  if (v.gaps === 0 && v.strictGaps === 0 && v.hookFailed === 0) {
    return {
      action: "assemble-evidence-pack", command: "runward compliance <regime>", rerun: null,
      segments: [plain("Assemble the evidence pack with "), cmd("runward compliance <regime>"), plain(" "),
        muted("(iso-42001 · nist-ai-rmf · eu-ai-act), or"), plain(" "), cmd("runward status"), plain(" "), muted("for a handover snapshot.")],
    };
  }
  // The gesture has to match what actually failed. "Fill the deliverable(s) named above" was
  // printed for a seal drift, with every deliverable filled and none named.
  // And the command it names has to be the gate that said no: "re-run runward check" after a
  // --strict or --hooks red ran a gate that cannot see the failure, and came back green
  // (RWD-2026-0129).
  const b = v.breakdown;
  const rerun = rerunCommand(opts);
  const then = (lead: string, action: string): Pick<NextStep, "action" | "command" | "segments"> =>
    ({ action, command: rerun, segments: [plain(`${lead}, then re-run `), cmd(rerun), plain(".")] });
  const step: Pick<NextStep, "action" | "command" | "segments"> = v.gaps
    ? b.conformance
      ? then("Fill the deliverable(s) named above and close the rule-conformance gap(s)", "fill-deliverables-and-close-conformance-gaps")
      : then("Fill the deliverable(s) named above", "fill-deliverables")
    : b.seal
      ? { action: "reseal-evidence", command: "runward check --freeze",
          segments: [plain("Re-read the changed evidence, confirm it still holds, then re-seal with "), cmd("runward check --freeze"), plain(".")] }
      : b.corpus
        ? { action: "reconcile-corpus", command: "runward update",
            segments: [plain("Reconcile the rule corpus named above — "), cmd("runward update"), plain(" for a rule runward moved, "), cmd("runward update --corpus <path>"), plain(" for one your organisation vendors.")] }
        : b.unratified
          ? then("Ratify the decision(s) named above", "ratify-decisions")
          : b.conformance
            ? then("Close the rule-conformance gap(s) named above", "close-conformance-gaps")
            // After conformance, never before: ratifying a row the gate still refuses binds it, and
            // fixing it afterwards rewrites it and unbinds it again — the operator ratifies twice.
            : b.unboundRows
              ? { action: "ratify-decided-rows", command: "runward ratify --decided",
                  segments: [plain("Ratify the decided row(s) named above with "), cmd("runward ratify --decided"), plain(", then re-run "), cmd(rerun), plain(".")] }
              // ADR-0088 decision 5: the charter is the maintainer's to fix or renew (class R); an agent
              // ratification it does not cover is re-ratified by a delegate or a person.
              : b.charter
                ? then("Fix runward/delegation.md, or re-ratify the row(s) it does not cover, as named above (the charter is the maintainer's to change)", "fix-delegation-charter")
                : v.hookFailed
                ? then("Fix the failing hook(s) in runward/hooks.json", "fix-hooks")
                : { action: "rerun", command: rerun, segments: [plain("Re-run "), cmd(rerun), plain(".")] };
  // `status` reads the deliverables and nothing else: it cannot name a strict gap, a seal drift or
  // a failed hook. Pointing there after one of those sent the reader to a screen that answered
  // "delivery arc complete" (RWD-2026-0130), so the pointer is kept only where it is true.
  const statusSeesIt = v.gaps > 0 && v.strictGaps === 0 && v.hookFailed === 0;
  return {
    ...step, rerun,
    segments: statusSeesIt ? [...step.segments, plain(" "), cmd("runward status"), plain(" "), muted("names exactly what is open at the current gate.")] : step.segments,
  };
}

/** The machine form of the Next line: the same segments, joined without colour. */
export function nextPayload(n: NextStep): { action: string; command: string; rerun: string | null; text: string } {
  return { action: n.action, command: n.command, rerun: n.rerun, text: n.segments.map((x) => x.text).join("") };
}

/**
 * What the "Current gate" line (terminal, `--json` `currentGate`, the delivery report) says.
 *
 * `analyze()` names the first open DELIVERABLE phase, or "all gates passed" once every deliverable
 * is filled — a statement about deliverables alone. Printed under a red verdict, the same summary
 * read "Current gate  all gates passed" one line above "! 2 rule-conformance gap(s)", exit 1, and
 * the JSON carried `currentGate: "all gates passed"` beside `verdict: "gaps"` (RWD-2026-0131). The
 * label now says what it measured whenever the verdict disagrees; the green keeps its bytes.
 */
export function currentGateLabel(report: { currentPhase: string; steadyState: boolean }, clean: boolean): string {
  return report.steadyState && !clean ? "all deliverables filled (verdict: gaps)" : report.currentPhase;
}

/**
 * Is this run for a machine?
 *
 * In every machine mode each human line is suppressed and the sole output is one document — the
 * payload, the in-toto Statement wrapping it, the SARIF log, or the VSA. A mutant that made this
 * answer `false` under `--json` would interleave prose into a stream something else is parsing, and
 * no exit code would move.
 */
export function isMachineRun(opts: CheckOptions): boolean {
  return !!opts.json || !!opts.attest || !!opts.sarif || !!opts.vsa;
}

/** What the payload needs that the verdict does not carry. */
export interface PayloadContext {
  version: string;
  missionRoot: string;
  currentGate: string;
  adrCount: number;
  clean: boolean;
  strict: boolean;
  gaps: number;
  strictGaps: number;
  hookFailed: number;
  /** Present only when the run was asked for --hooks. */
  hooks?: { config: "absent" | "invalid" | "ok"; problem: string | null; failed: Array<{ phase: "before" | "after"; command: string }> };
  deliverables: Verdict["deliverables"];
  /** Since RWD-2026-0149, each row also carries kind, file, line and phaseId (conformanceRowsLocated). */
  conformance: Array<{ scope: string; rule: string; problem: string }> | ConformanceEntry[];
  corpusPin: unknown;
  corpusDrift: unknown;
  gateNonScope: unknown;
  /** The Next line, machine form (RWD-2026-0145). */
  next: ReturnType<typeof nextPayload>;
  /** Present only when the run was asked for --coverage (RWD-2026-0150). */
  coverage?: CoverageSummary;
}

/**
 * `--coverage`, machine form (RWD-2026-0150). The terminal printed the two ratios and the ADRs to
 * ratify; `--coverage --json` carried none of it, so the flag did nothing for an agent. ONE
 * computation feeds the terminal lines and this block. Advisory like the section: never gating.
 */
export interface CoverageSummary {
  deliverables: { filled: number; total: number };
  decisions: { ratified: number; total: number; toRatify: Array<{ file: string; reason: string }> };
}

export function coverageSummary(
  report: Pick<GapReport, "phases">,
  decisions: { total: number; ratified: number; unratified: Array<{ file: string; reason: string }> },
): CoverageSummary {
  let filled = 0, total = 0;
  for (const phase of report.phases) for (const { state } of phase.artifacts) { total++; if (state === "filled") filled++; }
  return {
    deliverables: { filled, total },
    decisions: { ratified: decisions.ratified, total: decisions.total, toRatify: decisions.unratified.map((u) => ({ file: u.file, reason: u.reason })) },
  };
}

/**
 * The deliverable rows with the stable id of their phase (RWD-2026-0151). `phase` is the display
 * label (`1 · Frame`, `5 · Govern (day zero)`) and keeps its bytes (ADR-0030); `phaseId` is the id
 * `check --through` accepts (`frame | architect | floor | govern | handover`). The table joining
 * this vocabulary to `rules --phase` and to `conformance[].scope` is in docs/interop.md.
 */
export function deliverableRowsWithPhaseId<T extends { phase: string }>(rows: T[]): Array<T & { phaseId: string | null }> {
  return rows.map((r) => ({ ...r, phaseId: PHASES.find((p) => p.label === r.phase)?.id ?? null }));
}

/**
 * The strict-conformance rows exactly as `check --strict` publishes them — ONE implementation,
 * consumed by the command that emits the payload and by `verify` that re-derives it.
 *
 * These rows used to be assembled inline in `check.ts`, pushed beside the render as each section
 * printed. That made them the one part of the predicate no other code could recompute, and
 * `verify` silently took them on trust: measured 2026-09-02 by an adversarial investigation, an
 * attestation whose `conformance` table was entirely invented — and whose `deliverables` table
 * described a mission that does not exist — answered `verified: true`, exit 0, because neither
 * field was compared and neither appeared in `notReDerived`. The same single-implementation rule
 * the survivor key follows (ADR-0059 criterion 5, RWD-2026-0090): a shape two sides must agree on
 * is written once, where both can import it.
 *
 * Pure function of the Verdict, in the exact order the render prints: gated violations, corpus,
 * evidence seal, reconstruction lifecycle. Order is meaning here — `verify` compares arrays
 * positionally, and a reorder would be a difference.
 *
 * Since RWD-2026-0149 this is the three-field PROJECTION of `conformanceRowsLocated`, which the
 * payload publishes: kept for the readers built on it (the delivery report) and for `verify` of an
 * attestation produced before the additive fields existed. Both walk `conformanceEntries`, once.
 */
export function conformanceRows(verdict: Verdict): Array<{ scope: string; rule: string; problem: string }> {
  return conformanceEntries(verdict).map(({ scope, rule, problem }) => ({ scope, rule, problem }));
}

/**
 * One strict refusal, with what a machine needs to act on it (RWD-2026-0149, RWD-2026-0151).
 *
 * The table used to stop at `{scope, rule, problem}`: an agent told `scope: "Architect"` had to
 * guess that it meant `runward/architecture.md`, then search the file for the row, and could only
 * tell a proposal from a dead pointer by reading English — while `check --sarif` on the same run
 * already put each refusal on its file and line. The additive fields come from the SAME place the
 * SARIF log reads them: `conformanceFile` for the path and the `LineLocator` for the row, so the
 * two documents cannot disagree about where a refusal lives.
 *
 * - `kind`    stable identifier of the refusal (see ViolationKind, plus the non-manifest scopes:
 *             `corpus-missing` · `corpus-edited` · `corpus-extra` · `corpus-unrecorded` ·
 *             `seal-violation` · `unratified-decision` · `unbound-row` · and, under a delegation
 *             charter, `charter-malformed` · `charter-class-refused` · `charter-stage-unread` ·
 *             `charter-expired` · `agent-not-delegate`). Values are only ever added.
 * - `file`    repository-relative, `/`-separated, the artifact that carries the refusal.
 * - `line`    1-based line of the rule's row in that file, or null when the refusal has no row
 *             (a missing row, a whole-file fact, a rule the file does not list).
 * - `phaseId` the `rules --phase` id of the gated phase (`architect | topology | floor | govern |
 *             handover`), or null for a scope that is not a phase (corpus, seal, reconstruction).
 *             Beside `scope`, never instead of it: `scope` keeps its values (ADR-0030).
 */
export interface ConformanceEntry {
  scope: string; rule: string; problem: string;
  kind: string; file: string; line: number | null; phaseId: string | null;
}

/** Given a repository-relative file and a rule slug, the 1-based line of that rule's row, or null. */
export type LineLocator = (file: string, rule: string) => number | null;

/** The artifact a gated scope's refusals live in: `runward/<deliverable>`, or `runward` when the
 *  label is not a gated deliverable's. ONE mapping, read by the SARIF emitter and by this table. */
export function conformanceFile(label: string): string {
  const meta = GATED_DELIVERABLES.find((x) => x.label === label);
  return meta ? `runward/${meta.deliverable}` : "runward";
}

/** The rows with their location, kind and phase id — the ADR-0030 `conformance` table since
 *  RWD-2026-0149. Without a locator every `line` is null: nothing is guessed. */
export function conformanceRowsLocated(verdict: Verdict, locate: LineLocator = () => null): ConformanceEntry[] {
  return conformanceEntries(verdict).map((e) => ({
    scope: e.scope, rule: e.rule, problem: e.problem, kind: e.kind, file: e.file,
    line: e.rowed ? locate(e.file, e.rule) : null, phaseId: e.phaseId,
  }));
}

/** The additive keys RWD-2026-0149 put on each row: what `verify` strips from the re-derivation
 *  when an attestation was produced before them. */
export const CONFORMANCE_ADDITIVE_KEYS = ["kind", "file", "line", "phaseId"] as const;

function conformanceEntries(verdict: Verdict): Array<Omit<ConformanceEntry, "line"> & { rowed: boolean }> {
  const rows: Array<Omit<ConformanceEntry, "line"> & { rowed: boolean }> = [];
  for (const g of verdict.gated) {
    if (g.skipped) continue;
    const meta = GATED_DELIVERABLES.find((x) => x.label === g.label);
    for (const viol of g.violations) {
      rows.push({ scope: g.label, rule: viol.rule, problem: viol.problem, kind: viol.kind ?? "rule-violation",
        file: conformanceFile(g.label), rowed: true, phaseId: meta?.phase ?? null });
    }
  }
  const corpus = verdict.corpus;
  const whole = (scope: string, rule: string, problem: string, kind: string, file: string) =>
    rows.push({ scope, rule, problem, kind, file, rowed: false, phaseId: null });
  if (corpus.status === "verifiable") {
    for (const f of corpus.missing) whole("corpus", f, "rule removed from the mission corpus", "corpus-missing", `runward/rules/${f}`);
    for (const f of corpus.edited) whole("corpus", f, "rule edited since runward wrote it", "corpus-edited", `runward/rules/${f}`);
    for (const f of corpus.extra) whole("corpus", f, "rule not written by runward", "corpus-extra", `runward/rules/${f}`);
  } else if (corpus.status === "unrecorded") {
    whole("corpus", "(corpus)", "rule corpus not recorded: scaffold-lock.json is absent, so the corpus the gate judges against cannot be verified", "corpus-unrecorded", "runward/rules");
  }
  if (verdict.seal.present) {
    for (const v of verdict.seal.violations) whole("evidence-seal", v.rule, v.problem, "seal-violation", "runward/evidence-lock.json");
  }
  for (const u of verdict.unratified) whole("reconstruction", u.file, u.reason, "unratified-decision", `runward/adr/${u.file}`);
  // ADR-0088 decision 5: present only when the mission has a charter, so every other payload keeps
  // its bytes. A defect of the charter lands on the charter; an act it does not cover, on its row.
  for (const c of verdict.delegation?.gaps ?? []) {
    if (c.deliverable !== undefined && c.rule !== undefined) {
      const meta = GATED_DELIVERABLES.find((x) => x.deliverable === c.deliverable);
      rows.push({ scope: "delegation", rule: c.rule, problem: `${c.problem} (${c.deliverable})`, kind: c.kind,
        file: `runward/${c.deliverable}`, rowed: true, phaseId: meta?.phase ?? null });
    } else {
      whole("delegation", "(charter)", c.problem, c.kind, verdict.delegation!.file);
    }
  }
  // ADR-0080: present only under the regulated opt-in, so every other mission's payload keeps its bytes.
  for (const u of verdict.regulated.unbound) {
    const meta = GATED_DELIVERABLES.find((x) => x.deliverable === u.deliverable);
    rows.push({ scope: "ratification", rule: u.rule, problem: `${UNBOUND_CAUSE_TEXT[u.cause]} (${u.deliverable})`,
      kind: "unbound-row", file: `runward/${u.deliverable}`, rowed: true, phaseId: meta?.phase ?? null });
  }
  return rows;
}

/** ADR-0088 decision 5: the charter block of the payload, ONE implementation for `check` and for
 *  `verify`, which re-derives it. `gaps` only under --strict, like every strict reading. */
export function delegationPayload(verdict: Verdict, strict: boolean): Record<string, unknown> | null {
  const d = verdict.delegation;
  if (!d) return null;
  const { gaps, ...rest } = d;
  return { ...rest, ...(strict ? { gaps: gaps ?? [] } : {}) };
}

/**
 * The ADR-0030 machine payload: what a consumer reads instead of the printed run.
 *
 * Pure, so its shape can be asserted directly. Every field here is something a CI or an agent may
 * branch on, and it cannot cross-check any of them — which is why a wrong count under a right exit
 * code is a defect and not a cosmetic one (RWD-2026-0003 is that failure: answering `n/a` to every
 * rule removed the only vacuity signal the product had, and the emptiest missions produced the most
 * reassuring output).
 */
export function machinePayload(verdict: Verdict, ctx: PayloadContext): Record<string, unknown> {
  return {
    runward: ctx.version,
    mission: ctx.missionRoot,
    currentGate: ctx.currentGate,
    adrCount: ctx.adrCount,
    strict: ctx.strict,
    verdict: ctx.clean ? "clean" : "gaps",
    exitCode: ctx.clean ? 0 : 1,
    // HOW THE COUNTS ADD UP (RWD-2026-0146). `deliverables`, `conformance` and `hooks` are disjoint:
    // their sum is what stands between this run and a green. `conformance` is the WHOLE strict count
    // (rule violations, proposals, corpus divergences, seal drift, unratified reconstruction
    // decisions, unbound regulated rows, gating workflow-contract breaks). `proposed` and
    // `unboundRows` are SUBSETS of it, published apart so a consumer can tell which gesture closes
    // them; adding them to `conformance` counts the same rows twice. `deferred` is outside the
    // verdict (ADR-0053: deliverables beyond a declared --through horizon).
    gaps: {
      deliverables: ctx.gaps,
      conformance: ctx.strictGaps,
      hooks: ctx.hookFailed,
      deferred: verdict.deferredGaps,
      // ADR-0066, additive (ADR-0030): proposals INSIDE `conformance`'s total (a subset, never an
      // addend), counted apart so a consumer can tell "decide these rows" from "ratify these
      // proposals" without parsing prose.
      proposed: verdict.strictBreakdown.proposed,
      // ADR-0080, additive and present only under the regulated opt-in. Also INSIDE `conformance`'s
      // total: each unbound row is one `ratification` row of the `conformance` array.
      ...(verdict.regulated.on && ctx.strict ? { unboundRows: verdict.strictBreakdown.unboundRows } : {}),
      // ADR-0088 decision 5, additive and present only when the mission has a charter. INSIDE
      // `conformance`'s total too: each one is a `delegation` row of the `conformance` array.
      ...(verdict.delegation && ctx.strict ? { charter: verdict.strictBreakdown.charter } : {}),
    },
    // ADR-0030, additive and present only under --hooks, so every other run keeps its bytes.
    // `gaps.hooks` counted failures and named none: an agent told "1" had to re-run each operator
    // command to learn which one said no, and could not tell "no hooks.json" from "all passed"
    // (RWD-2026-0134..0136). Not re-derived by `verify`: it would require running the commands.
    ...(ctx.hooks ? { hooks: ctx.hooks } : {}),
    deliverables: ctx.deliverables,
    // ADR-0053: additive. `through` is the declared horizon (null without --through); `horizon`
    // surfaces the deferred deliverables as an explicit machine state, so a consumer cannot read a
    // prefix green as mission-complete.
    through: verdict.through,
    horizon: verdict.horizon,
    corpusPin: ctx.corpusPin,
    corpusDrift: ctx.corpusDrift,
    // The strict block is ABSENT without --strict, not empty. An empty `conformance: []` under a
    // lenient run would read as "conformance was checked and found clean", which is the false green
    // this shape refuses: nothing was checked. Absence says so; zero does not.
    ...(ctx.strict ? {
      conformance: ctx.conformance,
      evidence: {
        rows: verdict.breakdown.rows,
        applied: verdict.breakdown.applied,
        deviated: verdict.breakdown.deviated,
        na: verdict.breakdown.na,
        typed: verdict.breakdown.typed,
        prose: verdict.breakdown.prose,
        // RWD-2026-0150, additive: WHICH rows are prose — the list the terminal prints under this
        // count. `prosePointers` below is another notion (pointer spellings read as prose).
        proseRows: verdict.breakdown.proseRows,
        signed: verdict.breakdown.signed,
        // WHERE the evidence lives, so a consumer can tell a substantive crossing from a documentary
        // one. `external: 0` with rows > 0 means every green line rests on the mission's own
        // documents. Counted, never gated (ADR-0054 makes this a documentary gate, so a
        // documentation-only mission is legitimate) — what it may not do is read like more.
        evidenceFiles: verdict.breakdown.evidenceFiles,
        duplicated: verdict.breakdown.duplicated,
      },
      corpus: {
        status: verdict.corpus.status,
        missing: verdict.corpus.missing,
        edited: verdict.corpus.edited,
        extra: verdict.corpus.extra,
      },
      seal: {
        present: verdict.seal.present,
        count: verdict.seal.count,
        sealedAt: verdict.seal.sealedAt ?? null,
        violations: verdict.seal.violations.length,
      },
      criticalScope: verdict.criticalScope,
      // ADR-0066, additive: the ratification posture. Disclosed, never gating; re-derived by
      // `runward verify` like every predicate field.
      ratification: verdict.ratification,
      // Chantier 7, additive: the unmet required natures. Disclosed, never gating today.
      requiresUnmet: verdict.requiresUnmet,
      // RWD-2026-0110, additive: pointer spellings a cell carries where no path could be, read as
      // prose. Disclosed, never gating. It is here because `check` tells the operator this list is in
      // `--json`, and a surface that promises a field has to carry it.
      prosePointers: verdict.prosePointers,
      // ADR-0067 (W3), additive: what the workflow contracts declare and how the tree answers.
      // `gating` says whether the breaks counted (the mission's hardening opt-in).
      workflowContract: verdict.workflowContract,
      // ADR-0080, additive: the regulated tier, present only when the mission opted in. The forge
      // approval (part 2) is never judged here: this command has no forge to ask.
      ...(verdict.regulated.on ? { regulated: { unbound: verdict.regulated.unbound, forgeApproval: "not verified by this command" } } : {}),
      gateNonScope: ctx.gateNonScope,
    } : {}),
    // RWD-2026-0150, additive and present only under --coverage, so every other run keeps its bytes.
    ...(ctx.coverage ? { coverage: ctx.coverage } : {}),
    // ADR-0088 decision 5, additive and present only when the mission has a charter: the stage
    // banner, with or without --strict, and under --strict the gaps it names.
    ...(verdict.delegation ? { delegation: delegationPayload(verdict, ctx.strict) } : {}),
    // RWD-2026-0145, additive (ADR-0030): the terminal's Next line, from the same nextStep(). Last,
    // so every key before it keeps its place.
    next: ctx.next,
  };
}
