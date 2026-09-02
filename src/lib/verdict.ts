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
import { analyze, THROUGH_PHASE_IDS, type GapReport, type ArtifactState, type InProgressCause } from "./mission.js";
import {
  conformance, driftReport, unratifiedAdrs, ruleSignatures, ratificationLedger, GATED_DELIVERABLES,
  type Violation,
} from "./conformance.js";
import { evidenceReport, verifyEvidenceLock, evidenceBreakdown, requiresLedger } from "./evidence.js";
import { readWorkflowContracts, producesGateJoin } from "./workflow-contract.js";
import { structureContractOptIn, artifactState, PHASES } from "./mission.js";
import { corpusDivergence } from "./scaffold-lock.js";
import { ruleSetDir, readRuleSet } from "./rules.js";
import { TEMPLATES } from "./paths.js";

export interface DeliverableRow {
  phase: string;
  artifact: string;
  relPath: string;
  state: ArtifactState;
  /** WHY, when `state` is `in-progress` — placeholders left, or content below the divergence floor.
   *  Additive (ADR-0030): `state` keeps its meaning; this says which of its two causes fired, so a
   *  run stops telling an operator to look for placeholders their file does not contain. */
  cause: InProgressCause;
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
  /** The same number, BROKEN DOWN. `strictGaps` alone was rendered as "N floor rule-conformance
   *  gap(s)" whatever it counted, so a broken seal printed a rule-conformance gap in a phase and
   *  the Next line said "Fill the deliverable(s) named above" with none named and all of them
   *  filled — the operator was sent to fix something that was not wrong. Measured 2026-08-26.
   *  The parts must sum to `strictGaps`; a test asserts it, so a new contributor to the total
   *  cannot land unnamed. */
  strictBreakdown: { conformance: number; corpus: number; seal: number; unratified: number;
    /** ADR-0066: proposed rows awaiting ratification — refused like every strict gap, counted
     *  apart so the summary names what the gate is waiting for. */
    proposed: number };
  /** The ratification posture (ADR-0066), disclosed and never gating: how the decided rows were
   *  ratified, and how many carry no trace. Zeroes without --strict — the ledger is a strict
   *  reading, like everything the manifests carry. */
  ratification: { rows: number; lineByLine: number; enBloc: number; blind: number; untraced: number };
  /** Applied rows whose rule requires an evidence NATURE (requires: junit | sarif | …) the cited
   *  evidence does not carry (chantier 7). Disclosed today, blocking at the armed tier
   *  (ADR-0065). Empty without --strict. */
  requiresUnmet: Array<{ deliverable: string; rule: string; requires: string }>;
  /** ADR-0067 (W3): what the workflow contracts declare and how the tree answers. Surfaced
   *  always; gating only under the mission's opt-in. Empty without --strict. */
  workflowContract: { gating: boolean; malformed: string[]; joinBreaks: string[]; unmetRequires: string[] };
  /** Gated deliverables that were actually examined. `0` means no CRITICAL/HIGH rule is mapped. */
  checked: number;
  gated: GatedResult[];
  corpus: ReturnType<typeof corpusDivergence>;
  breakdown: ReturnType<typeof evidenceBreakdown>;
  seal: ReturnType<typeof verifyEvidenceLock>;
  unratified: ReturnType<typeof unratifiedAdrs>;
  /** CRITICAL/HIGH rules in the corpus, and how many the gate actually demands. */
  criticalScope: { total: number; mapped: number; unmapped: string[] };
  /**
   * ADR-0053: the declared construction horizon (`--through`), or null when absent. `report`'s
   * `currentPhase`/`steadyState` stay the true whole-arc values regardless, so a prefix verdict is
   * never readable as "mission complete".
   */
  through: string | null;
  horizon: { phase: string; index: number; deferred: DeliverableRow[] } | null;
  /** Deliverables in phases beyond the horizon, excluded from `gaps`. 0 without `--through`. */
  deferredGaps: number;
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
  /**
   * ADR-0053: a declared construction horizon. When set to a presence phase-id
   * (`THROUGH_PHASE_IDS`), the deliverable and gated-conformance counters judge only phases up to
   * and including it; phases beyond it are deferred, never certified. The phase-GLOBAL checks
   * (corpus, seal, unratified ADRs) are NOT scoped by it, so the horizon is a floor the whole
   * prefix must hold, not a ceiling that hides a regression below it.
   */
  through?: string;
}

/**
 * ADR-0053: map a gated-deliverable phase (conformance.ts `GATED_DELIVERABLES`) onto the
 * presence-horizon ordinal a `--through <id>` declares. Topology folds onto architect: it is a
 * gated deliverable with no presence-phase-id of its own, so a broken execution-topology.md is
 * judged AT `--through architect`, never exempted. This fold is load-bearing — a match by raw
 * phase-string would silently exempt the topology manifest inside the certified prefix.
 */
const GATED_TO_PRESENCE: Record<string, string> = {
  architect: "architect", topology: "architect", floor: "floor", govern: "govern", handover: "handover",
};
function gatedOrdinal(gatedPhase: string): number {
  return THROUGH_PHASE_IDS.indexOf(GATED_TO_PRESENCE[gatedPhase] ?? gatedPhase);
}

/**
 * The CRITICAL/HIGH rules the gate never asks about, counted from the corpus it judges against.
 *
 * The conformance section prints "Architect: 6 rule(s) accounted for … Govern: 12 rule(s) accounted
 * for" and stops there, which reads as though the critical set were covered. Measured on the shipped
 * corpus, 2026-08-08: **45 rules are CRITICAL or HIGH and only 31 are mapped to a gated phase.** The
 * other 14 are never demanded, and five of them are CRITICAL, including the pre-production security
 * and resilience checklists.
 *
 * That is a scope decision, not a defect: a rule with `phases: []` is documentation the operator may
 * apply without the gate ever asking. What was a defect is leaving it unsaid, so the only honest
 * sentence — "the 31 CRITICAL/HIGH rules mapped to the five gated phases each have a row" — could
 * not be written by a reader of the output.
 */
function unmappedCriticalRules(missionDir: string): { total: number; mapped: number; unmapped: string[] } {
  const { dir } = ruleSetDir(missionDir);
  const rules = readRuleSet(dir).filter((r) => r.impact === "CRITICAL" || r.impact === "HIGH");
  const unmapped = rules.filter((r) => r.phases.length === 0).map((r) => r.slug);
  return { total: rules.length, mapped: rules.length - unmapped.length, unmapped };
}

/**
 * Deliverables carry the gate with or without --strict: a phase never closes without its artifact.
 *
 * ADR-0053: `throughIndex` is the presence ordinal of a declared horizon, or null. Rows for phases
 * beyond it are still returned (the render and `deliverables[]` stay complete and honest) but their
 * gaps go to `deferredGaps`, not `gaps`, so they neither gate nor hide: the deferred set is surfaced
 * explicitly, never conflated with "crossed".
 */
function countGaps(report: GapReport, throughIndex: number | null): {
  rows: DeliverableRow[]; gaps: number; deferred: DeliverableRow[]; deferredGaps: number;
} {
  const rows: DeliverableRow[] = [];
  const deferred: DeliverableRow[] = [];
  let gaps = 0;
  let deferredGaps = 0;
  report.phases.forEach((phase, idx) => {
    const beyondHorizon = throughIndex !== null && idx > throughIndex;
    for (const { artifact, state, cause } of phase.artifacts) {
      const row: DeliverableRow = { phase: phase.spec.label, artifact: artifact.label, relPath: artifact.relPath, state, cause };
      rows.push(row);
      if (beyondHorizon) {
        deferred.push(row);
        if (state !== "filled") deferredGaps++;
      } else if (state !== "filled") {
        gaps++;
      }
    }
  });
  return { rows, gaps, deferred, deferredGaps };
}

/**
 * The three layers that judge a gated deliverable, joined into one verdict:
 * conformance (the manifest rows), evidence (ADR-0019/0020: does the pointer open and match), and
 * drift (blocking since ADR-0021: has the cited evidence moved since it was sealed).
 */
function judgeGated(mission: string, throughIndex: number | null): { gated: GatedResult[]; checked: number; strictGaps: number } {
  const signatures = ruleSignatures(mission);
  const gated: GatedResult[] = [];
  let checked = 0;
  let strictGaps = 0;

  for (const { phase, deliverable, label } of GATED_DELIVERABLES) {
    // ADR-0053: a gated deliverable beyond the declared horizon is deferred, not judged. The fold is
    // explicit (`gatedOrdinal`): topology is judged at `--through architect`, never exempted.
    if (throughIndex !== null && gatedOrdinal(phase) > throughIndex) continue;
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
/** The summary's naming arithmetic, factored so check's render and gate-hook's refusal say the
 *  SAME failure (the "NAME WHAT FAILED" rule, single implementation). Hook failures are the
 *  caller's to append — they are not the verdict's to know. */
export function verdictSummaryParts(v: Verdict): string[] {
  const b = v.strictBreakdown;
  const parts: string[] = [];
  if (v.gaps) parts.push(`${v.gaps} deliverable(s) not filled`);
  if (b.conformance) parts.push(`${b.conformance} rule-conformance gap(s)`);
  if (b.proposed) parts.push(`${b.proposed} proposed row(s) awaiting ratification`);
  if (b.corpus) parts.push(`${b.corpus} rule-corpus divergence(s)`);
  if (b.seal) parts.push(`${b.seal} sealed evidence file(s) changed`);
  if (b.unratified) parts.push(`${b.unratified} unratified decision(s)`);
  const wc = v.workflowContract;
  const wcBreaks = wc.malformed.length + wc.joinBreaks.length + wc.unmetRequires.length;
  if (wc.gating && wcBreaks) parts.push(`${wcBreaks} workflow-contract break(s)`);
  return parts;
}

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
  // ADR-0053: resolve the declared horizon to a presence ordinal, fail-loud on an unknown id. A
  // missing id must never fall through to "-1", which would defer every phase and manufacture the
  // silent all-green the CLI's `choices()` validation exists to prevent.
  const throughIndex = opts.through != null ? THROUGH_PHASE_IDS.indexOf(opts.through) : null;
  if (opts.through != null && throughIndex === -1) {
    throw new Error(`unknown --through phase '${opts.through}'; valid: ${THROUGH_PHASE_IDS.join(", ")}`);
  }
  const { rows, gaps, deferred, deferredGaps } = countGaps(report, throughIndex);

  let strictGaps = 0;
  const strictBreakdown = { conformance: 0, corpus: 0, seal: 0, unratified: 0, proposed: 0 };
  let checked = 0;
  let gated: GatedResult[] = [];
  // Defaults for the non-strict path: every strict-only reading is empty rather than absent, so a
  // consumer never has to test which mode produced the object.
  let corpus: Verdict["corpus"] = { status: "package", edited: [], missing: [], extra: [] };
  let breakdown = { rows: 0, applied: 0, deviated: 0, na: 0, typed: 0, prose: 0, signed: 0, proseRows: [], duplicated: [], evidenceFiles: { total: 0, external: 0 } } as Verdict["breakdown"];
  let seal: Verdict["seal"] = { present: false, count: 0, violations: [] };
  let unratified: Verdict["unratified"] = [];
  let criticalScope: Verdict["criticalScope"] = { total: 0, mapped: 0, unmapped: [] };

  if (opts.strict) {
    const g = judgeGated(mission, throughIndex);
    gated = g.gated;
    checked = g.checked;
    strictGaps += g.strictGaps;
    // ADR-0066: proposals are strict gaps (the exit code moves) and their own family (the
    // summary and the machine payload count them apart from ordinary conformance gaps).
    const proposedHere = g.gated.flatMap((x) => x.violations).filter((v) => v.kind === "proposed").length;
    strictBreakdown.proposed += proposedHere;
    strictBreakdown.conformance += g.strictGaps - proposedHere;

    // The corpus the gate judges against belongs to the audited party. ADR-0002's floor is an
    // invariant of CARDINALITY, so substitution and fabrication passed it untouched: an audit made
    // this gate exit 0 on 36 rule files containing the word "ok". `scaffold-lock.json` already held
    // the hash of every rule runward wrote; nothing read it here. Now the verdict does.
    corpus = corpusDivergence(mission, join(TEMPLATES, "rules"));
    if (corpus.status === "verifiable") {
      strictGaps += corpus.missing.length + corpus.edited.length + corpus.extra.length;
      strictBreakdown.corpus += corpus.missing.length + corpus.edited.length + corpus.extra.length;
    } else if (corpus.status === "unrecorded") {
      // A mission that keeps its own rule copy and carries no lock cannot have its corpus checked.
      // That used to be a warning in the text and nothing in the verdict, and the two are not the
      // same thing: `scaffold-lock.json` lives in the audited repository, so "this mission predates
      // the lock" is indistinguishable from "someone deleted the lock". Measured on 2026-08-06
      // against the published 0.33.0: 64 rule files reduced to the word "ok" exit 1 with the lock
      // present and **exit 0** with the lock removed, which is ADR-0045 class 1 reopened by deleting
      // one file the audited party owns.
      //
      // ADR-0045's own words: where the gate cannot verify, it says so IN THE RUN. The run is the
      // exit code, not the prose beside it. A legacy mission is one `runward update` away from being
      // recorded, and a mission with no local copy at all stays `package` and costs nothing, so the
      // honest configuration is never the one punished here.
      strictGaps += 1;
      strictBreakdown.corpus += 1;
    }

    breakdown = evidenceBreakdown(mission);

    seal = opts.freeze ? { present: false, count: 0, violations: [] } : verifyEvidenceLock(mission);
    // `present` gates the whole seal section, in the render AND here. One mutation of that field
    // turned a tampered sealed mission from exit 1 into exit 0 with the violations neither printed
    // nor counted, and nothing in the suite reddened (RWD-2026-0010, closed by
    // test/unit/evidence-lock.test.js). The coupling is deliberate: an absent seal is not a silent
    // pass, it is the absence of a claim.
    if (seal.present) { strictGaps += seal.violations.length; strictBreakdown.seal += seal.violations.length; }

    unratified = unratifiedAdrs(mission);
    strictGaps += unratified.length;
    strictBreakdown.unratified += unratified.length;

    // Reported, never gated: a rule the corpus does not map to a phase is documentation, and turning
    // it into a gap would red every honest mission on day one. What it must not do is stay invisible.
    criticalScope = unmappedCriticalRules(mission);
  }

  const { clean, exitCode } = verdictFrom(gaps, strictGaps, opts.hookFailed ?? 0);

  const horizon = opts.through != null && throughIndex !== null
    ? { phase: opts.through, index: throughIndex, deferred }
    : null;

  // ADR-0066: a strict reading, like everything the manifests carry — the presence gate does not
  // open deliverables it does not judge.
  const ratification = opts.strict
    ? ratificationLedger(mission)
    : { rows: 0, lineByLine: 0, enBloc: 0, blind: 0, untraced: 0 };
  const requiresUnmet = opts.strict ? requiresLedger(mission) : [];

  // ADR-0067 (W3): the gate reads the workflow contracts. Malformed contracts and join breaks
  // surface always (a broken promise is never a silence); under the mission's opt-in they gate.
  // A contract's `requires` are judged only when its own phase's gated deliverable is being
  // judged — a floor contract does not demand framing on a mission still framing.
  const workflowContract: { gating: boolean; malformed: string[]; joinBreaks: string[]; unmetRequires: string[] } =
    { gating: false, malformed: [], joinBreaks: [], unmetRequires: [] };
  if (opts.strict) {
    const contracts = readWorkflowContracts(mission);
    for (const { file, contract } of contracts) {
      if (contract) for (const m of contract.malformed) workflowContract.malformed.push(`${file}: ${m}`);
    }
    workflowContract.joinBreaks = producesGateJoin(contracts);
    const stateOf = new Map<string, string>();
    for (const ph of PHASES) for (const a of ph.artifacts) stateOf.set(`runward/${a.relPath}`, artifactState(mission, a));
    for (const { file, contract } of contracts) {
      if (!contract || contract.gate !== "strict") continue;
      // judged when at least one of its gated produces is filled — the procedure claims to be done
      const claimed = contract.produces.some((p) => p.gated && stateOf.get(p.path) === "filled");
      if (!claimed) continue;
      for (const r of contract.requires) {
        const st = stateOf.get(r);
        if (st !== undefined && st !== "filled") {
          workflowContract.unmetRequires.push(`${file}: requires ${r}, which reads ${st} — the procedure's own precondition, declared in its contract`);
        }
      }
    }
    workflowContract.gating = structureContractOptIn(mission);
    if (workflowContract.gating) {
      strictGaps += workflowContract.malformed.length + workflowContract.joinBreaks.length + workflowContract.unmetRequires.length;
    }
  }

  return {
    report, deliverables: rows, gaps, strictGaps, strictBreakdown, checked, gated, ratification, requiresUnmet,
    corpus, breakdown, seal, unratified, criticalScope,
    workflowContract,
    through: opts.through ?? null, horizon, deferredGaps,
    clean, exitCode,
  };
}
