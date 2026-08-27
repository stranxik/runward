import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { TEMPLATES, MISSION_LAYOUT } from "./paths.js";
import { ADR_MIN_CHARS } from "./constants.js";

/**
 * Mission state reading — the gap analysis: which deliverable, expected at
 * which phase, is present / started / still a template.
 */

export type ArtifactState = "missing" | "untouched" | "in-progress" | "filled";

/** WHY a deliverable is `in-progress`. The state has two causes and the run named only one of them,
 *  so an operator whose file carries no placeholder at all was told "placeholders remain" and went
 *  looking for something that was not there (ADR-0051 paper cut). Additive: the `state` a machine
 *  consumer reads is unchanged, this sits beside it. */
export type InProgressCause = "placeholders" | "below-floor" | null;

export interface Artifact {
  label: string;
  relPath: string;        // inside runward/
  templateKey?: string;   // key in MISSION_LAYOUT for template comparison
}

export interface PhaseSpec {
  id: string;
  label: string;
  artifacts: Artifact[];
}

export const PHASES: PhaseSpec[] = [
  {
    id: "frame", label: "1 · Frame",
    artifacts: [
      { label: "Framing note", relPath: "framing.md", templateKey: "framing.md" },
      { label: "Steering contract", relPath: "mission-contract.md", templateKey: "mission-contract.md" },
    ],
  },
  {
    id: "architect", label: "2 · Architect",
    artifacts: [
      { label: "Architecture note", relPath: "architecture.md", templateKey: "architecture.md" },
      { label: "Execution topology", relPath: "execution-topology.md", templateKey: "execution-topology.md" },
      { label: "Decision matrix", relPath: "decision-matrix.md", templateKey: "decision-matrix.md" },
      { label: "Decision journal (≥1 ADR)", relPath: "adr" },
      { label: "Port contracts (≥1 filled)", relPath: "contracts" },
    ],
  },
  {
    id: "floor", label: "3 · Floor",
    artifacts: [{ label: "Floor note (measured proof)", relPath: "floor.md", templateKey: "floor.md" }],
  },
  {
    id: "govern", label: "5 · Govern (day zero)",
    artifacts: [
      { label: "Threat model", relPath: "governance/threat-model.md", templateKey: "threat-model.md" },
      { label: "Evaluation rubric", relPath: "governance/evaluation-rubric.md", templateKey: "evaluation-rubric.md" },
      { label: "Observability schema", relPath: "governance/observability-schema.md", templateKey: "observability-schema.md" },
    ],
  },
  {
    id: "handover", label: "6 · Hand over",
    artifacts: [
      { label: "Recovery runbook", relPath: "runbook.md", templateKey: "runbook.md" },
      { label: "Hand-over note (the kit, proven)", relPath: "handover.md", templateKey: "handover.md" },
    ],
  },
];

/**
 * ADR-0053: the presence phase ids a declared construction horizon (`check --through <id>`) may
 * name, in mission order. The gated deliverables (conformance.ts) fold onto these — topology sits
 * under architect, exactly as the phase list above groups execution-topology.md under "2 · Architect".
 * Single source so the CLI validation, the help text and the verdict agree.
 */
export const THROUGH_PHASE_IDS: readonly string[] = PHASES.map((p) => p.id);

export function findMissionRoot(cwd: string): string | null {
  let dir = cwd;
  // Climb to the filesystem root. The old cap of 12 parents made the command give up at depth 12
  // and then assert "No runward/ mission found here or above" — a sentence that was simply false.
  // The loop already terminates on its own at the root; the bound below is a guard against a
  // pathological symlink cycle, not a search limit.
  for (let i = 0; i < 128; i++) {
    // A mission root contains runward/ with at least the framing note —
    // a directory merely named "runward" (e.g. this repository) does not count.
    if (existsSync(join(dir, "runward", "framing.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// A placeholder is bracketed prose with whitespace ([the real process as observed…]),
// which distinguishes it from cross-references like [ADR-0001] or [framing.md].
// A closing bracket followed by "(" is a markdown link ([floor note](floor.md)) — never a placeholder.
const PLACEHOLDER = /\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g;

/** A real ADR file: ADR-<n>-*.md, excluding the scaffolded template. Single source of
 *  truth so the mission, status, and conformance paths agree (they used to diverge:
 *  a `!f.includes("0000")` filter wrongly dropped e.g. ADR-0021-…-10000-ms.md). */
export function isRealAdrName(f: string): boolean {
  return /^ADR-\d+/.test(f) && f.endsWith(".md") && f !== "ADR-0000-template.md";
}

/** A real ADR: the NAME rule above, and a file that actually holds a decision. */
export function isRealAdr(f: string, dir: string): boolean {
  if (!isRealAdrName(f)) return false;
  // A NAME is not a decision. `printf '' > runward/adr/ADR-0001-empty.md` used to read
  // `✓ Decision journal (≥1 ADR)`, `all gates passed`, `ADRs 1`, `1 decision(s) traced` and
  // `1 ratified ADR(s)` in the ISO 42001 pack — while the evidence layer, in the SAME pass, printed
  // "an empty file is not a decision" four lines below the tick. `dir` is required rather than
  // optional on purpose: an optional argument is one a call site can forget, and forgetting it here
  // silently restores the name-only test. The compiler now refuses `.filter(isRealAdr)`.
  const abs = join(dir, f);
  try {
    if (!statSync(abs).isFile()) return false;
    return readFileSync(abs, "utf8").trim().length >= ADR_MIN_CHARS;
  } catch { return false; }
}

/** The cause behind an `in-progress` state, computed by re-running the same two tests the state
 *  itself uses — never a second implementation, which would drift the day the floor moves. Returns
 *  null for every other state. */
export function inProgressCause(missionDir: string, a: Artifact): InProgressCause {
  if (artifactState(missionDir, a) !== "in-progress") return null;
  const path = join(missionDir, a.relPath);
  let content: string;
  try { content = readFileSync(path, "utf8"); } catch { return null; }
  // Order matters and mirrors artifactState: the placeholder floor is tested first, so a file that
  // trips both is reported as the one the operator can act on most directly.
  if ((content.match(PLACEHOLDER) || []).length >= 3) return "placeholders";
  return "below-floor";
}

export function artifactState(missionDir: string, a: Artifact): ArtifactState {
  const path = join(missionDir, a.relPath);
  if (!existsSync(path)) return "missing";

  // Special case: ADR directory — count real ADRs beyond the template.
  if (a.relPath === "adr") {
    const adrs = readdirSync(path).filter((f) => isRealAdr(f, path));
    return adrs.length > 0 ? "filled" : "untouched";
  }

  // Special case: contracts directory — filled as soon as one .md is not the raw port-contract template.
  if (a.relPath === "contracts") {
    const template = readFileSync(join(TEMPLATES, "mission", "port-contract.md"), "utf8").trim();
    const contracts = readdirSync(path).filter((f) => f.endsWith(".md"));
    if (contracts.length === 0) return "untouched";
    const hasFilled = contracts.some((f) => readFileSync(join(path, f), "utf8").trim() !== template);
    return hasFilled ? "filled" : "untouched";
  }

  const content = readFileSync(path, "utf8");
  if (a.templateKey) {
    const template = readFileSync(join(TEMPLATES, "mission", a.templateKey), "utf8");
    if (content.trim() === template.trim()) return "untouched";
    if ((content.match(PLACEHOLDER) || []).length >= 3) return "in-progress";
    // Divergence guard: a deliverable is "filled" only when it departs meaningfully from
    // the scaffold. Templates with few placeholders (decision-matrix, execution-topology)
    // cannot lean on the placeholder floor, so a one-byte interior edit would otherwise
    // pass. Require several lines of genuinely new content beyond the template. Calibrated
    // against the reference mission (its lightest fill adds 5 lines / 215 words).
    const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const templateLines = new Set(lines(template));
    const added = lines(content).filter((l) => !templateLines.has(l));
    const addedWords = added.reduce((n, l) => n + l.split(/\s+/).filter(Boolean).length, 0);
    if (added.length < 3 || addedWords < 20) return "in-progress";
    return "filled";
  }
  if ((content.match(PLACEHOLDER) || []).length >= 3) return "in-progress";
  return "filled";
}

export interface GapReport {
  phases: Array<{
    spec: PhaseSpec;
    artifacts: Array<{ artifact: Artifact; state: ArtifactState; cause: InProgressCause }>;
    complete: boolean;
  }>;
  adrCount: number;
  currentPhase: string;
  // ADR-0033: every gated deliverable is filled — the delivery arc is crossed and the mission is
  // in the iterate/operate steady-state, not at a terminal "done". An explicit flag so consumers
  // never string-match "all gates passed" to detect it.
  steadyState: boolean;
}

export function analyze(missionDir: string): GapReport {
  const phases = PHASES.map((spec) => {
    const artifacts = spec.artifacts.map((artifact) => ({ artifact, state: artifactState(missionDir, artifact), cause: inProgressCause(missionDir, artifact) }));
    return { spec, artifacts, complete: artifacts.every((a) => a.state === "filled") };
  });
  const adrDir = join(missionDir, "adr");
  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter((f) => isRealAdr(f, adrDir)).length
    : 0;
  const firstIncomplete = phases.find((p) => !p.complete);
  return {
    phases,
    adrCount,
    currentPhase: firstIncomplete ? firstIncomplete.spec.label : "all gates passed",
    steadyState: !firstIncomplete,
  };
}

// ── Reopening watch (ADR-0033, "À ROUVRIR") ──
// Every ADR carries a mandatory `## Reevaluation trigger` section and a `**Trigger set on**: <date>`
// line (the ADR-0000 template mandates it). A returning operator's real backlog on a governed mission
// is "which locked decision is due to reopen". This is a pure, deterministic parse of that already-normed
// format — read-only, zero-LLM. It PRESENTS the triggers verbatim (a bounded preview); it never judges a
// trigger fired — the operator owns that call (operator-owns-the-gate, ADR-0001).

export interface ReopeningTrigger {
  adr: string;        // filename, e.g. ADR-0031-….md
  setOn: string | null; // YYYY-MM-DD from `**Trigger set on**`, or null if absent
  preview: string;    // first prose line of the trigger section, bounded — the full text lives in the ADR
}

const TRIGGER_PREVIEW_MAX = 140;

/** The reopening watch, parsed: triggers from accepted ADRs, plus the accepted ADRs that carry
 *  NO `## Reevaluation trigger` section — named, never silently counted as if they had one. */
export interface ReopeningWatch {
  triggers: ReopeningTrigger[];
  /** Accepted ADRs without a trigger section — non-conforming to the template, reported as such. */
  missingSection: string[];
}

/** Parse the accepted ADRs' reopening triggers, sorted by filename (deterministic). Only decisions
 *  currently in force (Status: accepted) — superseded/deprecated/proposed are not a live backlog.
 *  An accepted ADR with no trigger section goes to `missingSection` (fail-honest): pushing it into
 *  the watch as an empty entry would inflate the "N decision(s) carry a reopening trigger" count. */
export function readReopeningTriggers(adrDir: string): ReopeningWatch {
  if (!existsSync(adrDir)) return { triggers: [], missingSection: [] };
  const triggers: ReopeningTrigger[] = [];
  const missingSection: string[] = [];
  for (const f of readdirSync(adrDir).filter((f) => isRealAdr(f, adrDir)).sort()) {
    let text: string;
    try { text = readFileSync(join(adrDir, f), "utf8"); } catch { continue; }
    // In force only: the `**Status**:` line must start with "accepted".
    const statusLine = text.match(/^\*\*Status\*\*:\s*(.+)$/m);
    if (!statusLine || !/^accepted\b/i.test(statusLine[1].trim())) continue;
    // Isolate the Reevaluation trigger section by slicing (robust, no fragile multiline regex):
    // from the heading line to the next `## ` heading (or end of file).
    const headIdx = text.search(/^##\s+Reevaluation trigger/m);
    if (headIdx === -1) { missingSection.push(f); continue; }
    const afterHeading = text.slice(headIdx).replace(/^[^\n]*\n/, ""); // drop the heading line itself
    const nextHead = afterHeading.search(/^##\s/m);
    const section = nextHead === -1 ? afterHeading : afterHeading.slice(0, nextHead);
    const setOn = section.match(/\*\*Trigger set on\*\*:\s*(\d{4}-\d{2}-\d{2})/);
    // First prose line: skip blanks and the `**Trigger set on**` metadata line.
    const proseLines = section
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\*\*Trigger set on\*\*/.test(l));
    const prose = proseLines[0] ?? "";
    let preview = prose.length > TRIGGER_PREVIEW_MAX ? prose.slice(0, TRIGGER_PREVIEW_MAX - 1).trimEnd() + "…" : prose;
    // A multi-line trigger is previewed by its first line — mark the truncation, never silent.
    if (proseLines.length > 1 && !preview.endsWith("…")) preview += " …";
    triggers.push({ adr: f, setOn: setOn ? setOn[1] : null, preview });
  }
  return { triggers, missingSection };
}
