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

import type { Verdict } from "./verdict.js";

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

/** A flag combination that cannot mean anything, and the sentence that says why. */
export interface OptionFault {
  flags: string;
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
      flags: "--through + --freeze",
      message: "`--through` cannot be combined with `--freeze`: a seal certifies a full crossing, a declared horizon only a prefix. Seal the whole arc (drop --through), or drop --freeze.",
    };
  }
  // `--vsa` without `--resource-uri` is misuse, not a default to invent: the URI names the artifact
  // a policy engine will admit or refuse, and runward has no way to verify a name it guessed.
  if (opts.vsa && !opts.resourceUri) {
    return {
      flags: "--vsa without --resource-uri",
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
      flags: emissions.join(" + "),
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
  deliverables: Array<Record<string, unknown>>;
  conformance: Array<{ scope: string; rule: string; problem: string }>;
  corpusPin: unknown;
  corpusDrift: unknown;
  gateNonScope: unknown;
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
    gaps: {
      deliverables: ctx.gaps,
      conformance: ctx.strictGaps,
      hooks: ctx.hookFailed,
      deferred: verdict.deferredGaps,
    },
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
      gateNonScope: ctx.gateNonScope,
    } : {}),
  };
}
