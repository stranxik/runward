import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { TEMPLATES, MISSION_LAYOUT } from "./paths.js";
import { ADR_MIN_CHARS } from "./constants.js";
import { adrIdExists } from "./conformance.js";

/**
 * Mission state reading — the gap analysis: which deliverable, expected at
 * which phase, is present / started / still a template.
 */

export type ArtifactState = "missing" | "untouched" | "in-progress" | "filled";

/** WHY a deliverable is `in-progress`. The state has two causes and the run named only one of them,
 *  so an operator whose file carries no placeholder at all was told "placeholders remain" and went
 *  looking for something that was not there (ADR-0051 paper cut). Additive: the `state` a machine
 *  consumer reads is unchanged, this sits beside it. */
export type InProgressCause =
  | "placeholders" | "below-floor"
  // The structure-contract causes (chantier 5, inert by default behind the mission's opt-in):
  // each names WHAT to fix, never a generic sentence — the detail rides in `inProgressDetail`.
  | "missing-section" | "invalid-field" | "row-out-of-domain" | "incoherent-rows" | "broken-echo"
  | null;

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

/** An ADR's status line as the operator wrote it, or "". Single source of truth for the same
 *  reason as isRealAdrName above: three modules read this one line and two of them spelled the
 *  pattern differently, so the pack printed `accepted` from a line the gate and the reopening
 *  watch both refused to see (RWD-2026-0084). A space before a colon is not a typo in French
 *  typography, it is the rule, so the shape arrives from ordinary operators, not from fuzzing. */
export function adrStatusLine(text: string): string {
  return text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)?.[1]?.trim() ?? "";
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
    const text = readFileSync(abs, "utf8");
    if (text.trim().length < ADR_MIN_CHARS) return false;
    // M4, behind the mission's own opt-in (the adr/ dir sits at missionDir/adr): a decision has a
    // date, a status from the closed list the template teaches, and a non-empty reevaluation
    // trigger — the three parsers existed in this file for weeks; this is the wiring the report
    // named. Every existing mission keeps its current reading until it opts in.
    if (structureContractOptIn(dirname(dir))) {
      if (!/\*\*Date\*\*\s*:\s*\d{4}-\d{2}-\d{2}/.test(text)) return false;
      if (!/^(proposed|accepted|superseded|deprecated)\b/.test(adrStatusLine(text))) return false;
      const t = text.search(/^## Reevaluation trigger/m);
      if (t === -1) return false;
      const block = text.slice(t).split("\n").slice(1).join("\n").split(/\n## /)[0].trim();
      if (block.length < 20 || /^\[[^\]]*\]$/.test(block)) return false;
    }
    return true;
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
  const spec = a.templateKey ? STRUCTURE[a.templateKey] : undefined;
  if (spec && structureContractOptIn(missionDir)) {
    const v = structureViolations(missionDir, content, spec);
    if (v.length > 0) return v[0].cause;
  }
  return "below-floor";
}

/** The named detail behind a structure-contract cause — what to fix, not just what kind of wrong. */
export function inProgressDetail(missionDir: string, a: Artifact): string | null {
  if (!a.templateKey) return null;
  const spec = STRUCTURE[a.templateKey];
  if (!spec || !structureContractOptIn(missionDir)) return null;
  const path = join(missionDir, a.relPath);
  try {
    const v = structureViolations(missionDir, readFileSync(path, "utf8"), spec);
    return v.length ? v[0].detail : null;
  } catch { return null; }
}

// ── The structure contract (chantier 5 of the 2026-09-02 work orders) ──────────────────────────
//
// What the presence layer measures — distance from the template — is a floor against raw
// scaffolds, not a bar against confident emptiness: thirteen deliverables filled in reverse order
// with generic prose read "filled" (measured 2026-09-02, held as the T2 ratchet). A structure
// contract makes a template's own promises MECHANICAL: which sections must exist, which header
// fields must parse under which shape, which table columns admit which values, which lines must
// echo another file verbatim. Bytes at rest, zero execution, zero judgment of meaning — the
// ADR-0001/0054 line unchanged.
//
// INERT BY DEFAULT. Every existing mission would flip from filled to in-progress overnight; the
// contract judges only missions that OPT IN by declaring `"structureContract": true` in their
// scaffold-lock.json — the mission's own committed declaration, in the artifact that already
// records what the scaffold was. Whether NEW missions opt in by default is the author's open
// decision (D3); nothing here presumes it.

export interface StructureSpec {
  /** H2/H3 headings that must be present, verbatim. */
  sections?: string[];
  /** `**Key**: value` header fields that must parse under the given shape. */
  fields?: Array<{ name: string; shape: RegExp; hint: string }>;
  /** Table columns with a closed value domain: every row of the table under `section` must keep
   *  column `column` (0-based, after the rule/name column) inside `values`. */
  domains?: Array<{ section: string; column: number; values: string[] }>;
  /** Lines that must appear VERBATIM in another mission file — the cross-file echo (the
   *  framing→floor success criterion is the canonical case). `fromSection` names the block whose
   *  non-empty lines must all be found in `inFile`. */
  echoes?: Array<{ fromSection: string; inFile: string;
    /** When set, only the block's lines matching this prefix are checked — the typed lines that
     *  must travel (Metric, Threshold), not the narration around them. */
    linePrefix?: RegExp }>;
  /** Row-coherence rules — the trifecta's shape: YOUR three answers and YOUR verdict must agree
   *  with each other. The check receives one data row's cells and returns the named problem or
   *  null; it reads strings and compares them, never the world (the gate checks that the answers
   *  are COHERENT, never whether they are true). */
  rowRules?: Array<{ section: string; description: string; check: (cells: string[]) => string | null }>;
  /** Cross-section conditions a single row cannot see — "a Verdict below met requires a named gap
   *  row", "high privilege requires the high-privilege guardrail line". Deterministic functions
   *  over the CONTENT (and the mission dir for cross-file cases); each returns the named problem
   *  or null. The escape hatch is narrow on purpose: everything expressible as sections, fields,
   *  domains, rows or echoes uses those, where the data documents itself. */
  conditions?: Array<{ description: string; check: (content: string, missionDir: string) => string | null }>;
}

/** The registry — one source, the GATED_DELIVERABLES philosophy. Filled template by template by
 *  chantier-5 rewrites (M2/M3); empty entries mean the presence layer alone judges that file. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const yesNo = (cell: string): "yes" | "no" | null => {
  const t = cell.replace(/^\*+/, ""); // emphasis is layout, not meaning
  return /^yes\b/i.test(t) ? "yes" : /^no\b/i.test(t) ? "no" : null;
};

export const STRUCTURE: Record<string, StructureSpec> = {
  // M2, calibrated three ways before landing: the raw template stays untouched-with-zero-noise
  // (bracketed cells and fields are the template teaching its format), the shipped example passes
  // every check, and the generic reverse-fill of the T2 ratchet is REFUSED — each spec entry
  // removed its template from KNOWN_ACCEPTED in the same commit.
  "framing.md": {
    sections: ["1. Problem", "3. Observable success criterion", "6. Named deferrals", "9. Definition of Ready check"],
    fields: [
      { name: "Date", shape: ISO_DATE, hint: "an ISO date (YYYY-MM-DD)" },
      { name: "Metric", shape: /^\S.*$/, hint: "one non-empty line: the quantity observed" },
      { name: "Threshold \\(success\\)", shape: /(<|<=|>|>=|=)\s*\S/, hint: "a comparator and a target (e.g. >= 80, > manual baseline)" },
    ],
    domains: [{ section: "9. Definition of Ready check", column: 0, values: ["met", "risk"] }],
    rowRules: [{
      section: "9. Definition of Ready check",
      description: "a risk names its risk — a dash is an answer only beside met",
      check: (cells) => cells[1] === "risk" && (!cells[2] || cells[2] === "—" || cells[2] === "-")
        ? "Status is risk but the third cell names no risk" : null,
    }],
  },
  "floor.md": {
    sections: ["1. Scope shipped", "2. Proof against the success criterion", "3. Gaps and deviations"],
    fields: [
      { name: "Period", shape: /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/, hint: "a date range (YYYY-MM-DD..YYYY-MM-DD)" },
      { name: "Verdict", shape: /^(met|partially-met|not-met)\b/, hint: "met | partially-met | not-met" },
    ],
    echoes: [{
      fromSection: "2. Proof against the success criterion", inFile: "framing.md",
      linePrefix: /^\*\*(Metric|Threshold \(success\))\*\*/,
    }],
    conditions: [{
      description: "a Verdict below met requires at least one named gap row in §3",
      check: (content) => {
        const v = content.match(/\*\*Verdict\*\*\s*:\s*([^·\n]+)/);
        if (!v || /^met\b/.test(v[1].trim()) || /^\[/.test(v[1].trim())) return null; // bracketed = the template itself
        const idx = content.search(/^#{2,3} 3\. Gaps and deviations\s*$/m);
        if (idx === -1) return null;
        let headerSeen = false;
        for (const line of content.slice(idx).split("\n").slice(1)) {
          if (/^#{1,6}\s/.test(line)) break;
          const t = line.trim();
          if (!t.startsWith("|")) continue;
          const cells = tableCells(t);
          if (cells.every((x) => /^:?-+:?$/.test(x))) continue;
          if (!headerSeen) { headerSeen = true; continue; }
          if (cells.some((x) => x && !/^\[[^\]]*\]$/.test(x))) return null; // one real gap row
        }
        return `the Verdict reads "${v[1].trim()}" and §3 names no gap — a shortfall with zero gaps is a shape error`;
      },
    }],
  },
  "mission-contract.md": {
    // M3a. The contract is CO-SIGNED: every field row of the final table carries a real value.
    // Calibrated on the shipped example, which renames the section ("filled with the sponsor")
    // and legitimately points its milestones at the arc above — so the section is matched by
    // prefix and no date is demanded (the report's ISO-date idea died on the example's honesty).
    conditions: [{
      description: "the contract table is co-signed: every field carries a real value, and the retained engagements name at least one of the four",
      check: (content) => {
        const rows = sectionTableRows(content, /^## The contract,.*sponsor$/m);
        if (rows.length === 0) return "the contract section (\"The contract, … sponsor\") or its table is missing";
        for (const cells of rows) {
          const field = (cells[0] ?? "").replace(/^\*+|\*+$/g, "");
          const value = cells[1] ?? "";
          if (value === "" || /^\[[^\]]*\]$/.test(value)) continue; // template rows: presence layer owns them
          if (/^Engagements retained$/i.test(field)
            && !/(flash framing|executable floor|staged iteration|handover)/i.test(value)) {
            return `"Engagements retained" reads "${value.slice(0, 50)}" and names none of the four engagements`;
          }
        }
        const undecided = rows.filter((c) => (c[1] ?? "") === "" || /^\[[^\]]*\]$/.test(c[1] ?? ""));
        if (undecided.length > 0 && undecided.length < rows.length) {
          return `${undecided.length} contract field(s) still carry no agreed value (${undecided.map((c) => (c[0] ?? "").replace(/\*+/g, "")).slice(0, 3).join(", ")}…)`;
        }
        return null;
      },
    }],
  },
  "architecture.md": {
    // M3a. The two tables that draw the map stop being decorative: §8's decisions must cite ADRs
    // that exist (or say `pending`, the example's own honest word), §3's Spec column must resolve,
    // and every port must reappear in the topology map — the cross-file echo of the two visions.
    sections: ["3. Ports", "8. Decisions"],
    conditions: [
      {
        description: "every §8 decision cites an ADR that exists, or says pending",
        check: (content, missionDir) => {
          for (const cells of sectionTableRows(content, /^## 8\. Decisions\s*$/m)) {
            const adrCell = cells[1] ?? "";
            if (adrCell === "" || /^\[[^\]]*\]$/.test(adrCell)) continue;
            if (/pending/i.test(adrCell)) continue;
            const id = adrCell.match(/ADR-(\d+)/);
            if (!id) return `"${cells[0]}" cites no ADR and does not say pending — a decision here is a pointer, never a claim`;
            if (!adrIdExists(missionDir, `ADR-${id[1]}`)) return `"${cells[0]}" cites ADR-${id[1]}, which does not exist in adr/`;
          }
          return null;
        },
      },
      {
        description: "every §3 Spec resolves to a file in the mission",
        check: (content, missionDir) => {
          for (const cells of sectionTableRows(content, /^## 3\. Ports\s*$/m)) {
            const spec = cells[4] ?? "";
            if (spec === "" || /^\[[^\]]*\]$/.test(spec) || spec === "—") continue;
            const target = spec.replace(/^\[|\]$/g, "").split("](").pop()!.replace(/\)$/, "");
            if (!existsSync(join(missionDir, target))) return `port "${cells[0]}" cites spec "${spec.slice(0, 40)}", which does not resolve in the mission`;
          }
          return null;
        },
      },
      {
        description: "every §3 port reappears in the topology map — the two visions stay joined",
        check: (content, missionDir) => {
          const topoPath = join(missionDir, "execution-topology.md");
          if (!existsSync(topoPath)) return null; // its own artifact state owns that absence
          const topo = readFileSync(topoPath, "utf8");
          for (const cells of sectionTableRows(content, /^## 3\. Ports\s*$/m)) {
            const port = (cells[0] ?? "").replace(/^\*+|\*+$/g, "");
            if (port === "" || /^\[[^\]]*\]$/.test(port)) continue;
            if (!topo.includes(port)) return `port "${port}" has no line in execution-topology.md's placement map`;
          }
          return null;
        },
      },
    ],
  },
  "execution-topology.md": {
    // M3a. The rule this template already WROTE in prose ("any placement that is not in-app
    // carries an ADR") finally gains its reader; the Location family is the closed list
    // shared-bricks.md authored. Annotations after the family stay yours (prefix match).
    conditions: [{
      description: "the family is one of the five shared-bricks families, and a non-In-app placement cites a resolving ADR",
      check: (content, missionDir) => {
        // The template says "The port → placement map"; the shipped example numbers it
        // ("2. Port → placement map"). Both are the same section — number and article optional.
        const MAP = /^#{2,3} (?:\d+\. )?(?:The )?[Pp]ort → placement map\s*$/m;
        if (!MAP.test(content)) return "the port → placement map section is missing";
        const FAMILIES = ["In-app", "Existing infrastructure", "Dedicated internal platform", "Managed infrastructure service", "Managed model-vendor runtime"];
        for (const cells of sectionTableRows(content, MAP)) {
          const port = cells[0] ?? "";
          if (port === "" || /^\[[^\]]*\]$/.test(port) || /^_e\.g\._/.test(port) || /^(…|\.\.\.)$/.test(port)) continue;
          const family = (cells[2] ?? "").replace(/^\*+/, "");
          if (family === "" || /^\[[^\]]*\]$/.test(family)) continue;
          if (!FAMILIES.some((f) => family.startsWith(f))) {
            return `"${port}" places in "${family.slice(0, 40)}", which starts with none of the five shared-bricks families`;
          }
          if (!family.startsWith("In-app")) {
            const adrCell = cells[5] ?? "";
            const id = adrCell.match(/ADR-(\d+)/);
            if (!id) return `"${port}" leaves In-app (${family.slice(0, 30)}) and its ADR cell cites no ADR — the template's own rule, now read`;
            if (!adrIdExists(missionDir, `ADR-${id[1]}`)) return `"${port}" cites ADR-${id[1]}, which does not exist in adr/`;
          }
        }
        return null;
      },
    }],
  },
  "decision-matrix.md": {
    // M3a. The emptiest requirement in the product gains its object: the new "Positions held"
    // section records which of the 22 arbitrations this mission has taken, default or switched —
    // and a switch is an ADR, resolved.
    sections: ["Positions held"],
    rowRules: [{
      section: "Positions held",
      description: "a position is default or switched — the matrix above holds the doctrine, this table holds YOUR arbitrations",
      check: (cells) => {
        const pos = (cells[1] ?? "").replace(/^\*+/, "");
        if (pos === "") return null;
        if (!/^(default|switched)\b/.test(pos)) return `the Position reads "${pos.slice(0, 30)}" — default or switched, with your annotation after it`;
        return null;
      },
    }],
    conditions: [{
      description: "a switched position cites an ADR that exists",
      check: (content, missionDir) => {
        for (const cells of sectionTableRows(content, /^## Positions held\s*$/m)) {
          const pos = (cells[1] ?? "").replace(/^\*+/, "");
          if (!/^switched\b/.test(pos)) continue;
          const id = (cells[2] ?? "").match(/ADR-(\d+)/);
          if (!id) return `"${cells[0]}" is switched and cites no ADR — a switch without its trigger traced is the drift this table exists to refuse`;
          if (!adrIdExists(missionDir, `ADR-${id[1]}`)) return `"${cells[0]}" cites ADR-${id[1]}, which does not exist in adr/`;
        }
        return null;
      },
    }],
  },
  "evaluation-rubric.md": {
    // M3b. A bench without a bench is prose: the scoring scale must carry at least one numeric
    // score, and at least one scenario must exist with its Expected/Forbidden lines.
    sections: ["2. Scoring scale", "3. Scenarios"],
    conditions: [{
      description: "the scale is numeric and at least one scenario carries its terms",
      check: (content) => {
        const scores = sectionTableRows(content, /^#{2,3} 2\. Scoring scale\s*$/m)
          .filter((c) => (c[1] ?? "") !== "" && !/^\[[^\]]*\]$/.test(c[1] ?? "")); // bracketed = the template teaching
        const numeric = scores.some((c) => /-?−?\d/.test(c[1] ?? ""));
        if (scores.length > 0 && !numeric) return "the scoring scale carries no numeric score — a scale nobody can add up is prose";
        if (!/^### Scenario /m.test(content)) return "no scenario block — a bench without a scenario measures nothing";
        if (!/\*\*Expected terms\*\*\s*:/.test(content) || !/\*\*Forbidden terms\*\*\s*:/.test(content)) {
          return "a scenario is missing its Expected terms or Forbidden terms line";
        }
        return null;
      },
    }],
  },
  "observability-schema.md": {
    // M3b. The carrier field is a literal token (backticked), and the ceilings are numbers — the
    // two facts an operator greps for at 3 a.m.
    sections: ["2. Propagated request ID", "5. Cost ceilings"],
    conditions: [{
      description: "the carrier field is a literal backticked token and the ceilings carry a number",
      check: (content) => {
        const carrier = content.match(/\*\*Carrier field\*\*\s*:\s*([^\n]+)/);
        if (carrier && !/^\[/.test(carrier[1].trim()) && !/`[^`]+`/.test(carrier[1])) {
          return `the Carrier field reads "${carrier[1].trim().slice(0, 40)}" and names no backticked literal token`;
        }
        const idx = content.search(/^#{2,3} 5\. Cost ceilings\s*$/m);
        if (idx !== -1) {
          const block = content.slice(idx).split(/\n#{2,3} /)[0];
          if (!/\[[^\]]*\]/.test(block) && !/\d/.test(block)) return "the cost ceilings carry no number — a ceiling without a value bounds nothing";
        }
        return null;
      },
    }],
  },
  "runbook.md": {
    // M3b. The two facts that turn an incident into a non-event: real contacts, and dependencies
    // whose failure behaviour is named in the closed vocabulary the template teaches.
    sections: ["2. Dependencies and degraded modes", "5. Contacts"],
    rowRules: [{
      section: "2. Dependencies and degraded modes",
      description: "Criticality starts with critical or non-critical, and the failure behaviour names its mode",
      check: (cells) => {
        const crit = (cells[2] ?? "").replace(/^\*+/, "");
        // Measured vocabulary of the shipped example: critical, non-critical, degraded-capable.
        if (crit && !/^\[/.test(crit) && !/^(critical|non-critical|degraded)/.test(crit)) return `Criticality reads "${crit.slice(0, 30)}" — critical, non-critical or degraded-capable, with your annotation after it`;
        const behaviour = cells[3] ?? "";
        // Measured vocabulary: the example's gateway row says "automatic switch to the keyword
        // fallback" — failover by its plain names.
        if (behaviour && !/^\[/.test(behaviour) && !/(fail-open|fail-closed|failover|fallback|switch|degraded|escalat)/i.test(behaviour)) {
          return `the failure behaviour names none of fail-open | fail-closed | failover | fallback | switch | degraded | escalate`;
        }
        return null;
      },
    }],
    conditions: [{
      description: "at least one real contact row — a contacts table of placeholders is what turns an incident into an event",
      check: (content) => {
        const rows = sectionTableRows(content, /^#{2,3} 5\. Contacts\s*$/m);
        if (rows.length === 0) return null; // the missing section is its own violation
        // A table of fully bracketed rows is the raw template: the presence layer owns that state.
        if (rows.every((c) => c.every((x) => x === "" || /^\[[^\]]*\]$/.test(x)))) return null;
        const real = rows.some((c) => c.length >= 4 && c.slice(0, 4).every((x) => x !== "" && !/^\[[^\]]*\]$/.test(x)));
        return real ? null : "no contact row carries four real cells — the template says it plainly: filling in contacts is what turns an incident into a non-event";
      },
    }],
  },
  "handover.md": {
    // M3b. The redone task is THE proof of autonomy, and its evidence is a pointer the gate can
    // open — the promise the template has carried in prose since day one, now read. (The kit's
    // State column stays unclosed: the template teaches ready|untested and its own example writes
    // "finalized at hand-over" and "current" — that vocabulary tension belongs to the author,
    // not to a checker inventing a list from one file.)
    sections: ["1. The kit", "2. The redone task (the proof)", "4. Provider-swap drill"],
    conditions: [{
      description: "the redone task carries an ISO date and typed evidence (file:/adr:) the gate can open",
      check: (content) => {
        const idx = content.search(/^#{2,3} 2\. The redone task/m);
        if (idx === -1) return null;
        const block = content.slice(idx).split(/\n#{2,3} /)[0];
        const dateLine = block.match(/\*\*Date[^*]*\*\*\s*:\s*([^\n]+)/);
        if (dateLine && !/^\[/.test(dateLine[1].trim()) && !/\d{4}-\d{2}-\d{2}/.test(dateLine[1])) {
          return "the redone task's Date line carries no ISO date — an undated proof cannot be sequenced";
        }
        const evidence = block.match(/\*\*Evidence\*\*\s*:\s*([^\n]+)/);
        if (evidence && !/^\[/.test(evidence[1].trim()) && !/(file:|adr:|test:)/.test(evidence[1])) {
          return `the redone task's Evidence line reads "${evidence[1].trim().slice(0, 40)}" and carries no typed pointer — the template's own promise, now read`;
        }
        return null;
      },
    }],
  },
  "threat-model.md": {
    sections: ["1. Attack surfaces", "2. Lethal trifecta", "4. Approval points"],
    fields: [{ name: "Last review", shape: ISO_DATE, hint: "an ISO date (YYYY-MM-DD)" }],
    rowRules: [{
      section: "2. Lethal trifecta",
      description: "three yes must not read safe; two or fewer must — your answers and your verdict must agree",
      check: (cells) => {
        const answers = [cells[1], cells[2], cells[3]].map((x) => yesNo(x ?? ""));
        if (answers.some((a) => a === null)) return null; // annotated/absent cells stay yours to judge
        const yeses = answers.filter((a) => a === "yes").length;
        const verdict = (cells[4] ?? "").trim();
        if (!verdict) return null;
        if (yeses === 3 && /^safe\b/i.test(verdict)) return "all three properties meet on this path and the Verdict reads safe";
        if (yeses < 3 && !/^safe\b/i.test(verdict) && !/^\[[^\]]*\]$/.test(verdict)) return `only ${yeses} of 3 properties meet and the Verdict does not read safe`;
        return null;
      },
    }],
  },
};

/** Split a table line into cells, honouring the GFM escape: `\|` inside a cell is a literal
 *  pipe, not a separator — the RWD-2026-0097 lesson, applied here before it bites a third time
 *  (the raw templates teach `[met \| risk]` in one cell). */
export function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split(/(?<!\\)\|/).map((x) => x.replace(/\\\|/g, "|").trim());
}

/** The data rows of the table under `section` — header and separators skipped, cells GFM-split.
 *  The helper the spec conditions share, so no spec grows its own table walk (RWD-2026-0084's
 *  lesson: two copies of one motif diverge). */
export function sectionTableRows(content: string, sectionPattern: RegExp): string[][] {
  const idx = content.search(sectionPattern);
  if (idx === -1) return [];
  const rows: string[][] = [];
  let headerSeen = false;
  for (const line of content.slice(idx).split("\n").slice(1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const cells = tableCells(t);
    if (cells.every((x) => /^:?-+:?$/.test(x))) continue;
    if (!headerSeen) { headerSeen = true; continue; }
    rows.push(cells);
  }
  return rows;
}

export interface StructureViolation { cause: Exclude<InProgressCause, "placeholders" | "below-floor" | null>; detail: string }

/** The pure checker: every way `content` breaks `spec`, named precisely enough to act on.
 *  Exported for tests and for M2's rewrites to calibrate against — the ADR-0047 discipline. */
export function structureViolations(missionDir: string, content: string, spec: StructureSpec): StructureViolation[] {
  const out: StructureViolation[] = [];
  for (const sec of spec.sections ?? []) {
    if (!new RegExp(`^#{2,3} ${sec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(content)) {
      out.push({ cause: "missing-section", detail: `section "${sec}" is missing` });
    }
  }
  for (const f of spec.fields ?? []) {
    // A header line may carry several `**Key**: value` fields separated by ` · ` (the house
    // style: Date · Sponsor · Entry mode on one line) — the value stops at the next separator.
    const m = content.match(new RegExp(`\\*\\*${f.name}\\*\\*\\s*:\\s*([^·\\n]+)`));
    const value = m ? m[1].trim() : null;
    // A bracketed value is the template teaching its format — the placeholder vocabulary — and is
    // never a violation: the presence layer already refuses untouched scaffolds.
    if (value !== null && /^\[[^\]]*\]/.test(value)) continue;
    if (!m || !f.shape.test(value!)) {
      out.push({ cause: "invalid-field", detail: `field "${f.name}" ${m ? `reads "${value}" and` : "is absent or"} must be ${f.hint}` });
    }
  }
  for (const d of spec.domains ?? []) {
    const idx = content.search(new RegExp(`^#{2,3} ${d.section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m"));
    if (idx === -1) continue; // a missing section is already its own violation
    let headerSeen = false;
    for (const line of content.slice(idx).split("\n").slice(1)) {
      if (/^#{1,6}\s/.test(line)) break;
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      const cells = tableCells(t);
      if (cells.every((x) => /^:?-+:?$/.test(x))) continue;      // the separator row
      if (!headerSeen) { headerSeen = true; continue; }           // the header row names columns
      // Emphasis is layout, not meaning: `**risk**` is `risk` (the shipped example writes it so).
      const v = cells[d.column + 1]?.replace(/^\*+|\*+$/g, "");
      // A bracketed cell is the template teaching its format — the placeholder vocabulary the
      // whole product speaks — and an empty cell is an undecided one: neither is out of domain.
      if (v === undefined || v === "" || /^\[[^\]]*\]$/.test(v)) continue;
      if (!d.values.includes(v)) {
        out.push({ cause: "row-out-of-domain", detail: `"${cells[0]}" carries "${v}" in a column whose domain is ${d.values.join(" | ")}` });
      }
    }
  }
  for (const r of spec.rowRules ?? []) {
    const idx = content.search(new RegExp(`^#{2,3} ${r.section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m"));
    if (idx === -1) continue;
    let headerSeen = false;
    for (const line of content.slice(idx).split("\n").slice(1)) {
      if (/^#{1,6}\s/.test(line)) break;
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      const cells = tableCells(t);
      if (cells.every((x) => /^:?-+:?$/.test(x))) continue;
      if (!headerSeen) { headerSeen = true; continue; }
      if (cells.every((x) => x === "" || /^\[[^\]]*\]$/.test(x))) continue; // pure template row
      const problem = r.check(cells);
      if (problem) out.push({ cause: "incoherent-rows", detail: `"${cells[0]}": ${problem} (${r.description})` });
    }
  }
  for (const e of spec.echoes ?? []) {
    const idx = content.search(new RegExp(`^#{2,3} ${e.fromSection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m"));
    if (idx === -1) continue;
    const block: string[] = [];
    for (const line of content.slice(idx).split("\n").slice(1)) {
      if (/^#{1,6}\s/.test(line)) break;
      const t = line.trim();
      if (t) block.push(t);
    }
    const checked = (e.linePrefix ? block.filter((l) => e.linePrefix!.test(l)) : block)
      // A bracketed value is the template teaching its format — nothing to echo yet.
      .filter((l) => !/:\s*\[[^\]]*\]?\s*$/.test(l));
    if (checked.length === 0) continue; // nothing typed yet: the presence layer owns this state
    const target = join(missionDir, e.inFile);
    if (!existsSync(target)) { out.push({ cause: "broken-echo", detail: `"${e.fromSection}" must echo into ${e.inFile}, which is missing` }); continue; }
    const targetText = readFileSync(target, "utf8");
    for (const line of checked) {
      if (!targetText.includes(line)) {
        out.push({ cause: "broken-echo", detail: `the line "${line.slice(0, 60)}" from "${e.fromSection}" is not echoed verbatim in ${e.inFile}` });
        break;
      }
    }
  }
  for (const cnd of spec.conditions ?? []) {
    const problem = cnd.check(content, missionDir);
    if (problem) out.push({ cause: "incoherent-rows", detail: `${problem} (${cnd.description})` });
  }
  return out;
}

/** Has this mission opted into the structure contract? Its own committed declaration, read from
 *  scaffold-lock.json — never inferred, never defaulted (the D3 default is the author's open
 *  decision). */
export function structureContractOptIn(missionDir: string): boolean {
  try {
    const j = JSON.parse(readFileSync(join(missionDir, "scaffold-lock.json"), "utf8"));
    return j?.structureContract === true;
  } catch { return false; }
}

export function artifactState(missionDir: string, a: Artifact): ArtifactState {
  const path = join(missionDir, a.relPath);
  if (!existsSync(path)) return "missing";

  // Special case: ADR directory — count real ADRs beyond the template.
  if (a.relPath === "adr") {
    const adrs = readdirSync(path).filter((f) => isRealAdr(f, path));
    return adrs.length > 0 ? "filled" : "untouched";
  }

  // Special case: contracts directory. The base rule — filled as soon as one .md is not the raw
  // template — accepted a one-byte interior edit (the report's measured defect). Under the
  // mission's opt-in, a filled contract must also carry the port-contract skeleton: the four
  // sections a consumer navigates by. Sections only, never content — the gate reads shape.
  if (a.relPath === "contracts") {
    const template = readFileSync(join(TEMPLATES, "mission", "port-contract.md"), "utf8").trim();
    const contracts = readdirSync(path).filter((f) => f.endsWith(".md")).sort();
    if (contracts.length === 0) return "untouched";
    const armed = structureContractOptIn(missionDir);
    const CONTRACT_SECTIONS = ["Business intent", "Signature", "Invariants", "Errors"];
    const hasFilled = contracts.some((f) => {
      const text = readFileSync(join(path, f), "utf8");
      if (text.trim() === template) return false;
      if (!armed) return true;
      return CONTRACT_SECTIONS.every((sec) => new RegExp(`^## ${sec}\\s*$`, "m").test(text));
    });
    return hasFilled ? "filled" : armed && contracts.some((f) => readFileSync(join(path, f), "utf8").trim() !== template) ? "in-progress" : "untouched";
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
    // The structure contract, AFTER the presence floor and only for missions that opted in:
    // a violation is in-progress with its named cause, never filled (chantier 5; inert by
    // default — see structureContractOptIn).
    const spec = STRUCTURE[a.templateKey];
    if (spec && structureContractOptIn(missionDir) && structureViolations(missionDir, content, spec).length > 0) {
      return "in-progress";
    }
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
    // In force only: the `**Status**:` line must start with "accepted". Read through the shared
    // reader, so an ADR the gate ratifies is an ADR whose triggers are watched (RWD-2026-0084).
    if (!/^accepted\b/i.test(adrStatusLine(text))) continue;
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
