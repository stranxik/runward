/**
 * The verdict, computed apart from the way it is printed.
 *
 * Why this file exists. Until 2026-08-06 the exit code of `runward check` was decided inside
 * `src/commands/check.ts`, interleaved with the rendering, and no unit test imported it: 8.70 % of
 * its lines and 0 % of its functions were covered, and the full mutation pass of ADR-0046 could not
 * reach it, because mutating a file no test imports yields 100 % survivors, which is noise and not a
 * measurement. So the project could say "we measured what our test net catches" everywhere except
 * where the verdict is decided, which is the sentence an assessor finds by crossing ADR-0046 with
 * the source tree, and it is the region the 22 false positives of ADR-0045 lived in.
 *
 * What this module is. A pure function of the mission on disk: it reads, it counts, it returns. It
 * prints nothing, it never touches `process.exitCode`, and it runs no hook. Hooks execute the
 * operator's commands and stay in the command layer; their failure count is an INPUT here, so that
 * the arithmetic that turns three counts into an exit code is testable without spawning anything.
 *
 * What this module is NOT. It is not a second opinion on the verdict, and it must never become one.
 * `check.ts` renders what this returns and exits on `exitCode`. If the two ever disagree, the
 * duplicated logic is the defect, not the disagreement.
 *
 * The order of the sections below is the order the gate prints them, deliberately: a reader
 * comparing this file to the output should not have to reorder anything in their head, and the
 * golden comparison that guarded this extraction rests on that correspondence.
 */
import { join } from "node:path";
import { analyze, type GapReport, type ArtifactState } from "./mission.js";
import {
  conformance, driftReport, unratifiedAdrs, ruleSignatures, GATED_DELIVERABLES,
  type Violation,
} from "./conformance.js";
import { evidenceReport, verifyEvidenceLock, evidenceBreakdown } from "./evidence.js";
import { corpusDivergence } from "./scaffold-lock.js";
import { TEMPLATES } from "./paths.js";

export interface DeliverableRow {
  phase: string;
  artifact: string;
  relPath: string;
  state: ArtifactState;
}

/** One gated deliverable, after conformance + evidence + drift have been joined. */
export interface GatedResult {
  label: string;
  expectedCount: number;
  violations: Violation[];
  /** True when the deliverable contributed nothing at all and the gate skipped it entirely. */
  skipped: boolean;
}

export interface Verdict {
  report: GapReport;
  deliverables: DeliverableRow[];
  /** Deliverables not in the `filled` state. Gates every phase, with or without --strict. */
  gaps: number;
  /** Everything --strict adds: conformance, evidence, drift, corpus, seal, unratified ADRs. */
  strictGaps: number;
  /** Gated deliverables that were actually examined. `0` means no CRITICAL/HIGH rule is mapped. */
  checked: number;
  gated: GatedResult[];
  corpus: ReturnType<typeof corpusDivergence>;
  breakdown: ReturnType<typeof evidenceBreakdown>;
  seal: ReturnType<typeof verifyEvidenceLock>;
  unratified: ReturnType<typeof unratifiedAdrs>;
  clean: boolean;
  exitCode: 0 | 1;
}

export interface VerdictOptions {
  strict?: boolean;
  /**
   * Under --freeze the old seal is being REPLACED, not verified. Verifying it would make
   * re-sealing impossible: a changed sealed file reddens the gate that freeze requires green.
   * Everything else must still be green to seal.
   */
  freeze?: boolean;
  /** Hooks run in the command layer; only how many failed reaches the verdict. */
  hookFailed?: number;
}

/** Deliverables carry the gate with or without --strict: a phase never closes without its artifact. */
function countGaps(report: GapReport): { rows: DeliverableRow[]; gaps: number } {
  const rows: DeliverableRow[] = [];
  let gaps = 0;
  for (const phase of report.phases) {
    for (const { artifact, state } of phase.artifacts) {
      if (state !== "filled") gaps++;
      rows.push({ phase: phase.spec.label, artifact: artifact.label, relPath: artifact.relPath, state });
    }
  }
  return { rows, gaps };
}

/**
 * The three layers that judge a gated deliverable, joined into one verdict:
 * conformance (the manifest rows), evidence (ADR-0019/0020: does the pointer open and match), and
 * drift (blocking since ADR-0021: has the cited evidence moved since it was sealed).
 */
function judgeGated(mission: string): { gated: GatedResult[]; checked: number; strictGaps: number } {
  const signatures = ruleSignatures(mission);
  const gated: GatedResult[] = [];
  let checked = 0;
  let strictGaps = 0;

  for (const { phase, deliverable, label } of GATED_DELIVERABLES) {
    const { expected, violations } = conformance(mission, phase, deliverable);
    violations.push(...evidenceReport(mission, deliverable, signatures));
    violations.push(...driftReport(mission, deliverable));

    // Non-vacuity (ADR-0002): when no rule is currently mapped to a phase, `conformance()` still
    // raises a `(mapping)` violation if the mapping was stripped below its pinned floor. Skip only
    // when there is genuinely nothing to report, never when that signal is present.
    if (expected.length === 0 && violations.length === 0) {
      gated.push({ label, expectedCount: 0, violations: [], skipped: true });
      continue;
    }
    checked++;
    strictGaps += violations.length;
    gated.push({ label, expectedCount: expected.length, violations, skipped: false });
  }
  return { gated, checked, strictGaps };
}

/**
 * The arithmetic that turns three counts into an exit code, in ONE place.
 *
 * It is exported because the command cannot call `computeVerdict` last: the `after` hooks run
 * once the report has been rendered, so their failures land after the reading. The alternative was
 * to re-write `gaps === 0 && strictGaps === 0 && hookFailed === 0` at the bottom of `check.ts`,
 * which is how two copies of a rule start drifting apart. There is one copy, and both callers use
 * it.
 *
 * Every term is a gate in its own right. A deliverable still a raw template closes nothing, with or
 * without --strict. A strict gap is a CRITICAL/HIGH rule unaccounted for, a pointer that does not
 * open, evidence that drifted, a corpus that moved, a broken seal, or an unratified decision. A
 * failed hook is the operator's own check saying no, and runward does not overrule it.
 */
export function verdictFrom(gaps: number, strictGaps: number, hookFailed: number): { clean: boolean; exitCode: 0 | 1 } {
  const clean = gaps === 0 && strictGaps === 0 && hookFailed === 0;
  return { clean, exitCode: clean ? 0 : 1 };
}

/**
 * Compute the verdict. Reads the mission on disk; prints nothing; returns everything the renderer
 * needs and the exit code the command must exit on.
 */
export function computeVerdict(mission: string, opts: VerdictOptions = {}): Verdict {
  const report = analyze(mission);
  const { rows, gaps } = countGaps(report);

  let strictGaps = 0;
  let checked = 0;
  let gated: GatedResult[] = [];
  // Defaults for the non-strict path: every strict-only reading is empty rather than absent, so a
  // consumer never has to test which mode produced the object.
  let corpus: Verdict["corpus"] = { status: "package", edited: [], missing: [], extra: [] };
  let breakdown = { rows: 0, applied: 0, deviated: 0, na: 0, typed: 0, prose: 0, proseRows: [] } as Verdict["breakdown"];
  let seal: Verdict["seal"] = { present: false, count: 0, violations: [] };
  let unratified: Verdict["unratified"] = [];

  if (opts.strict) {
    const g = judgeGated(mission);
    gated = g.gated;
    checked = g.checked;
    strictGaps += g.strictGaps;

    // The corpus the gate judges against belongs to the audited party. ADR-0002's floor is an
    // invariant of CARDINALITY, so substitution and fabrication passed it untouched: an audit made
    // this gate exit 0 on 36 rule files containing the word "ok". `scaffold-lock.json` already held
    // the hash of every rule runward wrote; nothing read it here. Now the verdict does.
    corpus = corpusDivergence(mission, join(TEMPLATES, "rules"));
    if (corpus.status === "verifiable") {
      strictGaps += corpus.missing.length + corpus.edited.length + corpus.extra.length;
    }

    breakdown = evidenceBreakdown(mission);

    seal = opts.freeze ? { present: false, count: 0, violations: [] } : verifyEvidenceLock(mission);
    // `present` gates the whole seal section, in the render AND here. One mutation of that field
    // turned a tampered sealed mission from exit 1 into exit 0 with the violations neither printed
    // nor counted, and nothing in the suite reddened (RWD-2026-0010, closed by
    // test/unit/evidence-lock.test.js). The coupling is deliberate: an absent seal is not a silent
    // pass, it is the absence of a claim.
    if (seal.present) strictGaps += seal.violations.length;

    unratified = unratifiedAdrs(mission);
    strictGaps += unratified.length;
  }

  const { clean, exitCode } = verdictFrom(gaps, strictGaps, opts.hookFailed ?? 0);

  return {
    report, deliverables: rows, gaps, strictGaps, checked, gated,
    corpus, breakdown, seal, unratified,
    clean, exitCode,
  };
}
