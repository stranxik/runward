import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolveEvidencePath } from "./evidence.js";
import { join, dirname, relative, sep } from "node:path";
import { TEMPLATES } from "./paths.js";
import { EXPECTED_MAPPED, ADR_MIN_CHARS } from "./constants.js";
import { ruleMigrations } from "./rule-migrations.js";
import { adrStatusLine, agentRatificationOptIn, regulatedOptIn } from "./mission.js";
import { readIdentities, resolveIdentity, spellingsOf, foldName, singleAccountableOptIn, SINGLE_ACCOUNTABLE_DISCLOSURE, SINGLE_ACCOUNTABLE_REGULATED_NOTE, type Identities } from "./identity.js";

/**
 * Rule-conformance verification (the --strict gate).
 *
 * Deterministic, and deliberately narrow: it verifies that every CRITICAL/HIGH
 * craft rule mapped to a build phase is *accounted for* in the deliverable's
 * "Rule conformance" manifest — applied with an evidence pointer, deviated with
 * an existing ADR, or n/a with a reason. It never opens project code, never runs
 * a test, and never judges whether the pointer truly implements the rule. That
 * judgment stays the operator's, at the gate. See docs/adr/ADR-0001.
 */

export interface ManifestRow { rule: string; status: string; evidence: string; }
/**
 * What KIND of refusal a violation is, as a stable identifier a machine can branch on.
 *
 * `check --json` published every refusal as English prose, so an agent had to parse the sentence
 * to tell "a proposal awaits ratification" from "the pointer does not resolve" from "the row is
 * missing" — while the SARIF log of the same run already located each one (RWD-2026-0149). The
 * kind is set WHERE the refusal is raised, never inferred from its wording afterwards, so
 * rewording a message can never change it. Additive (ADR-0030): values may be added, never renamed
 * or removed. `evidence-refused` is the evidence layer's family (a typed pointer that resolves but
 * does not hold: empty file, missing symbol, red scan…); the problem text says which.
 */
export type ViolationKind =
  | "proposed" | "missing-row" | "empty-status" | "invalid-status" | "applied-without-evidence"
  | "deviated-without-adr" | "na-without-reason" | "unknown-rule" | "duplicate-row"
  | "deliverable-missing" | "manifest-unreadable" | "mapping-floor"
  | "unresolved-pointer" | "evidence-placeholder" | "evidence-refused";
export interface Violation { rule: string; problem: string;
  /** "proposed" marks the ADR-0066 family: refused like every violation, COUNTED apart — the
   *  summary says "N proposed row(s) awaiting ratification", never a generic conformance gap.
   *  Every other value names its refusal for the machine payload (RWD-2026-0149); a seal
   *  violation carries none, its scope says what it is. */
  kind?: ViolationKind; }
export interface ConformanceReport { expected: string[]; violations: Violation[] }

/** The gated (phase, deliverable) pairs — the single source `check --strict`, the evidence
 *  layer and the compliance assembler all read (ADR-0001/0016/0017). */
export const GATED_DELIVERABLES: Array<{ phase: string; deliverable: string; label: string }> = [
  { phase: "architect", deliverable: "architecture.md", label: "Architect" },
  { phase: "topology", deliverable: "execution-topology.md", label: "Topology" },
  { phase: "floor", deliverable: "floor.md", label: "Floor" },
  { phase: "govern", deliverable: "governance/threat-model.md", label: "Govern" },
  { phase: "handover", deliverable: "handover.md", label: "Handover" },
];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
/** The three decisions a conformance row may carry. Exported because evidence.ts has to
 *  recognise a row of this shape wherever it sits, and a second copy of this list would drift
 *  the day a fourth status is added. */
export const VALID_STATUS = new Set(["applied", "deviated", "n/a"]);

/** The proposal grammar (ADR-0066): `proposed:applied | proposed:deviated | proposed:n/a`.
 *  A prefix on the STATUS, and nothing else, for two measured reasons. It fails closed on every
 *  deployed binary — `proposed:applied` reads as an invalid status everywhere before 0.38, so no
 *  mission carrying proposals can pass green on an older runward. And it reuses the product's own
 *  word for "not yet ratified": the ADR cycle is proposed → accepted, and a row follows the same
 *  cycle. A fourth column was disqualified by measurement (readManifest folds extra columns into
 *  Evidence, so an old binary would read `applied` + evidence and pass GREEN); a side ledger was
 *  disqualified by precedent (ADR-0038: the deliverable IS the state).
 *  Returns the underlying status a proposal proposes, or null when the status is not a proposal. */
export function proposedStatus(status: string): string | null {
  if (!status.startsWith("proposed:")) return null;
  const rest = status.slice("proposed:".length).trim();
  return VALID_STATUS.has(rest) ? rest : null;
}

/** An n/a reason must be more than a placeholder: real length, not a bracketed template token. */
function trivialReason(s: string): boolean {
  const t = s.trim();
  if (t.length < 8 || /^\[.*\]$/.test(t)) return true;
  // A length floor is a floor on KEYSTROKES, not on meaning: `xxxxxxxx` (8) cleared it while
  // `xxxxxxx` (7) did not, so a manifest whose every n/a said `xxxxxxxx` passed — the cheapest green
  // mission the 2026-08-26 audit found. What separates that from `no queue` is not word count or
  // length, both of which refuse `no queue` too and redden an honest mission; it is that one of them
  // is a single character repeated. Three distinct characters is the floor, which is below every
  // real reason (the shipped example runs 18 to 28) and above every degenerate one.
  //
  // This is a floor on SHAPE, and deliberately not more. An `n/a` cell is prose, the gate does not
  // read prose (GATE_NON_SCOPE), and `abcdefgh` still clears this. Recorded as a limitation rather
  // than closed: the only real check on an `n/a` is a human who knows the system.
  if (new Set(t.toLowerCase().replace(/\s/g, "")).size < 3) return true;
  return false;
}

interface RuleMeta { impact: string; phases: string[]; signature: string }

function parseRuleMeta(content: string): RuleMeta {
  const fm = content.match(FRONTMATTER)?.[1] ?? "";
  const impact = (fm.match(/^impact:\s*(.+)$/m)?.[1] ?? "").trim();
  const phasesRaw = fm.match(/^phases:\s*\[(.*)\]/m)?.[1] ?? "";
  const phases = phasesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const signature = (fm.match(/^signature:\s*(.+)$/m)?.[1] ?? "").trim();
  return { impact, phases, signature };
}

/** The rule directory the gate reads: the mission's own copy when present, else the package's. */
export function rulesDir(missionDir: string): string {
  const missionRules = join(missionDir, "rules");
  return existsSync(missionRules) ? missionRules : join(TEMPLATES, "rules");
}

/** Evidence signatures (ADR-0020): rule slug → the regex source its applied evidence must match. */
export function ruleSignatures(missionDir: string): Record<string, string> {
  const dir = rulesDir(missionDir);
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    let sig = "";
    try { sig = parseRuleMeta(readFileSync(join(dir, f), "utf8")).signature; } catch { continue; }
    if (sig) out[f.replace(/\.md$/, "")] = sig;
  }
  return out;
}

/** CRITICAL/HIGH rules mapped to a phase — the set that must be accounted for.
 *  The mapping is a property of the rule definitions: read the mission's own
 *  `runward/rules/` when present, else fall back to the package rules (the
 *  authoritative source — covers missions predating rules-in-mission). */
export function expectedRules(missionDir: string, phaseId: string): string[] {
  const dir = rulesDir(missionDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => {
      const { impact, phases } = parseRuleMeta(readFileSync(join(dir, f), "utf8"));
      return (impact === "CRITICAL" || impact === "HIGH") && phases.includes(phaseId);
    })
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/** Every rule slug in the set (mission's own, else the package) — the universe a manifest row must belong to. */
export function allRules(missionDir: string): string[] {
  const dir = rulesDir(missionDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
}

/** Parse the "## Rule conformance" markdown table from a deliverable. */
export function parseManifest(content: string): ManifestRow[] {
  return readManifest(content).rows;
}

/** The manifest, plus the structural problems that made part of it unreadable.
 *
 *  Four ways a manifest could lie about itself, all found by an adversarial audit and all silent:
 *  a second `## Rule conformance` section above the real one hid it entirely (only the first was
 *  read); a table inside a ```` ``` ```` fence was parsed as real rows; a `### Sub-heading` after
 *  the table did not end the section, so a following table was absorbed; and a row without its
 *  closing pipe — valid GFM, rendered identically — vanished with whatever pointer it carried. */
/** Where a `Rule conformance` section starts, and where the next heading ends it. ONE definition,
 *  because there were two and the gap between them was a false green.
 *
 *  `readManifest` has always located the section with this scan: any heading depth, case-insensitive,
 *  matched on the STEM so `## Rule conformance and deviations` is still the manifest, and blind to
 *  anything inside a code fence because an illustration is not a manifest. The divergence guard in
 *  `artifactState` — which must exclude the machine's own table from both sides of the comparison
 *  (RWD-2026-0107) — grew its own matcher instead: `/^#{2,3} Rule conformance\s*$/m`, case-sensitive,
 *  two or three hashes only, requiring end-of-line, fence-blind.
 *
 *  Measured 2026-09-13, end to end on a real mission: rename the heading to
 *  `## Rule conformance and deviations` and nothing else, and `execution-topology.md` goes from
 *  `in-progress` to `filled` — because the reader still finds the table (so the rows parse and the
 *  mission works) while the guard no longer recognises the section, so the machine's own rows become
 *  the operator's divergence. RWD-2026-0107 reopened by a rename, with no human line written
 *  (RWD-2026-0115). Two answers to one question, which is the shape this file has already paid for
 *  twice: "is this ADR ratified?" and "how many ADRs are there?" were each answered two ways.
 *
 *  Every section is returned, not the first: when a deliverable carries several, `readManifest`
 *  refuses to choose between them and reads no rows — but the guard must still exclude all of them,
 *  or an ambiguous manifest would hand back the same false green a renamed one did. */
export function manifestSections(content: string): Array<{ start: number; end: number }> {
  const lines = content.split("\n");
  const heads: number[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (!fenced && /^#{1,6}\s+Rule conformance/i.test(lines[i])) heads.push(i);
  }
  return heads.map((start) => {
    let end = lines.length, inFence = false;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
      if (!inFence && /^#{1,6}\s/.test(lines[i])) { end = i; break; }
    }
    return { start, end };
  });
}

/** `lines[i]` is the 1-based line of `rows[i]`. A parallel array rather than a field on the row:
 *  rows are spread into the compliance payload (compliance.ts), and a new row field would change
 *  that machine surface for a need only `rules --for` has (ADR-0077). */
export function readManifest(content: string): { rows: ManifestRow[]; problems: string[]; lines: number[] } {
  const lines = content.split("\n");
  const problems: string[] = [];
  const heads = manifestSections(content).map((s) => s.start);
  let fenced = false;
  if (heads.length === 0) return { rows: [], problems, lines: [] };
  if (heads.length > 1) {
    // Refuse, never pick. Choosing the first is how an "example of the format" pasted above the
    // real table made a whole phase invisible while the gate reported it accounted for.
    problems.push(`${heads.length} \`Rule conformance\` sections in this deliverable (lines ${heads.map((i) => i + 1).join(", ")}) — the gate will not choose between them; keep one`);
    return { rows: [], problems, lines: [] };
  }

  const rows: ManifestRow[] = [];
  const rowLines: number[] = [];
  fenced = false;
  for (let i = heads[0] + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;                       // an illustration is not a manifest row
    if (/^#{1,6}\s/.test(line)) break;           // ANY heading ends the section, not just `##`
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    // GFM makes the closing pipe optional and renders both forms identically. Dropping such a row
    // silently took its pointer with it; now it is read, and a malformed one is reported.
    const inner = t.endsWith("|") ? t.slice(1, -1) : t.slice(1);
    // Backticks are stripped from every column, as they always have been: writing a pointer as a
    // markdown code-span is the normal thing to do, and `` `file:src/x.ts` `` must resolve. The
    // consequence is that a backtick can never DELIMIT a quoted symbol — it is gone before the
    // grammar runs — so the pointer grammar does not offer it. Only `"` delimits.
    // GFM: `\|` inside a cell is a LITERAL pipe, not a separator. This split treated it as one,
    // so the scaffold's own illustration row — `| [rule-slug] | applied \| deviated \| n/a | … |` —
    // parsed as five columns and became a real row whose status is the garbage `applied \`,
    // published as-is by the ADR-0030 machine payload on every untouched mission (RWD-2026-0097).
    // The lookbehind leaves one deliberate gap: a cell ENDING in an escaped backslash before a real
    // separator (`\\|`) keeps its pipe — a shape no manifest has ever carried, accepted over
    // implementing GFM backslash-run parsing in full.
    const cols = inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").replace(/`/g, "").trim());
    if (cols.length < 3) {
      if (!/^:?-+:?$/.test(cols[0] ?? "") && (cols[0] ?? "").trim() && !/^rule$/i.test(cols[0]))
        problems.push(`line ${i + 1}: a manifest row needs 3 columns (rule | status | evidence) — got ${cols.length}: ${t.slice(0, 70)}`);
      continue;
    }
    const rule = cols[0], status = cols[1], evidence = cols.slice(2).join(" | ");
    if (/^rule$/i.test(rule) || /^:?-+:?$/.test(rule)) continue; // header / separator
    // A bracketed rule name is the template teaching its own format, never a decision: the scaffold
    // ships `| [rule-slug] | … |` in every gated deliverable, and counting it gave a mission nobody
    // had touched 5 rows, a shared-cell warning about its own illustration, and garbage in the
    // machine payload (RWD-2026-0097). Square brackets are already the product's placeholder
    // vocabulary — the fill heuristic in mission.ts counts the same motif.
    if (/^\[.*\]$/.test(rule)) continue;
    rows.push({ rule, status: status.toLowerCase(), evidence });
    rowLines.push(i + 1);
  }
  return { rows, problems, lines: rowLines };
}

/** True when an ADR with exactly this id (e.g. "ADR-3") exists in runward/adr/.
 *  Anchored on a digit boundary so ADR-1 is not satisfied by ADR-10 / ADR-12
 *  when filenames are unpadded. */
export function adrIdExists(missionDir: string, id: string): boolean {
  return adrDecision(missionDir, id) === null;
}

/** Where a mission's decision journal may live (ADR-0074, option 3, ratified 2026-09-12).
 *
 *  `<mission>/adr/` FIRST, then the three places the ecosystem actually keeps decisions: `docs/adr/`
 *  (MADR), `doc/adr/` (adr-tools), `adr/`. Mission-first is the same precedence the rest of the
 *  product uses, and it is what makes the widening free of surprises: a mission ADR still wins over a
 *  same-numbered one further out.
 *
 *  Why it widened. Measured 2026-09-12 on runward's own mission: `adr:0011`, `adr:0017` and `adr:0054`
 *  all answered *no matching ADR in runward/adr/* — while ADR-0017 is the decision that opens the
 *  placement / sovereignty / trace-export ADR family BY NAME, ADR-0054 decides the sovereignty
 *  posture, and ADR-0011 decides that runward exports no trace. Three accepted, on-point decisions,
 *  reported as absent to the three rules that require exactly them, on a mission whose own ADR-0001
 *  is titled "the decision journal lives in docs/adr". The mission declared where its journal was and
 *  the gate did not read the declaration (RWD-2026-0112). It failed in the safe direction — a gap
 *  disclosed where none existed, never a pass — and a false negative in a disclosure is how an
 *  operator learns to stop reading it. */
const ADR_JOURNALS = ["docs/adr", "doc/adr", "adr"] as const;

function adrJournalDirs(missionDir: string): string[] {
  const project = dirname(missionDir);
  return [join(missionDir, "adr"), ...ADR_JOURNALS.map((d) => join(project, ...d.split("/")))];
}

/** The absolute path behind `adr:NNNN`, plus every directory that was looked in. One lookup, shared
 *  by the verdict, the seal and the structure contract — a second implementation is how this file
 *  once answered "is this ratified?" two different ways. */
function locateAdr(missionDir: string, id: string): { abs: string | null; hit: string | null; searched: string[]; present: string[] } {
  const u0 = id.toUpperCase();
  const searched: string[] = [], present: string[] = [];
  for (const dir of adrJournalDirs(missionDir)) {
    const shown = toDisplayDir(missionDir, dir);
    searched.push(shown);
    if (!existsSync(dir)) continue;
    present.push(shown);
    let hit: string | undefined;
    try {
      hit = readdirSync(dir).find((f) => {
        const u = f.toUpperCase();
        return u.startsWith(u0) && !/[0-9]/.test(u.charAt(u0.length));
      });
    } catch { continue; }
    if (hit) return { abs: join(dir, hit), hit, searched, present };
  }
  return { abs: null, hit: null, searched, present };
}

/** A journal directory as the operator wrote it, not as the filesystem spells it here. */
function toDisplayDir(missionDir: string, dir: string): string {
  const rel = relative(dirname(missionDir), dir);
  return `${rel.split(sep).join("/")}/`;
}

/** The absolute path of the ADR behind `adr:NNNN`, or null. Exported so the seal can freeze the
 *  target of an `adr:` pointer: of the three pointer kinds the grammar announces, it was the only one
 *  whose target could never be frozen, so the three ADRs a mission's deviations rest on could be
 *  replaced with filler under an intact seal. It returns a PATH rather than a bare filename since
 *  ADR-0074: the directory is no longer a constant the caller can assume. */
export function adrPath(missionDir: string, id: string): string | null {
  return locateAdr(missionDir, id).abs;
}

/** Why this ADR cannot carry a decision, or null when it can.
 *
 *  The evidence layer refuses an empty file outright ("an empty file is not evidence"); the ADR
 *  layer accepted one as a ratified decision. An audit satisfied 36 deviations with a 0-byte file,
 *  and 36 more by pointing at `ADR-0000-template.md` — the template runward scaffolds itself and
 *  nobody ever wrote. A directory named `ADR-0009-…` passed too. The two layers now hold the same
 *  line: a decision has to have been made by someone. */
export function adrDecision(missionDir: string, id: string): string | null {
  const { abs, hit, searched, present } = locateAdr(missionDir, id);
  // The refusal NAMES every directory it looked in (ADR-0074). An operator whose journal sits
  // somewhere else learns where to put it instead of guessing, and the two situations stay distinct:
  // "you have no journal" is not "your journal does not hold this decision".
  if (!abs || !hit) {
    return present.length === 0
      ? `no decision journal — looked in ${searched.join(", ")}`
      : `no matching ADR in ${present.join(", ")} (also looked in ${searched.filter((d) => !present.includes(d)).join(", ") || "nowhere else"})`;
  }
  if (/^ADR-0+(?:-|\.md$)/i.test(hit) || /^ADR-0+$/i.test(hit.replace(/\.md$/i, "")))
    return `${hit} is the scaffolded template, not a decision anyone took`;
  let text: string;
  try {
    if (!statSync(abs).isFile()) return `${hit} is a directory, not a decision`;
    text = readFileSync(abs, "utf8");
  } catch { return `${hit} cannot be read`; }
  if (text.trim().length < ADR_MIN_CHARS) return `${hit} is empty or near-empty — an empty file is not a decision`;
  // Read the STATUS, not the whole line. Searching anywhere in it refused
  // `accepted, replacing the proposed ADR-0012` as unratified, and
  // `accepted (superseded by ADR-0050)` as set-aside — both are accepted decisions whose line
  // merely mentions another one. The convention across this corpus is that the status is the first
  // word: `accepted (ratified 2026-07-21 — see Ratification)`.
  const word = adrStatusWord(text);
  if (ADR_SET_ASIDE.test(word)) return `${hit} is ${word} — a set-aside decision cannot justify a deviation`;
  if (ADR_UNRATIFIED.test(word)) return `${hit} is not ratified (${word}) — ratify it, or the deviation rests on nothing`;
  return null;
}

export const ADR_SET_ASIDE = /^(rejected|superseded|withdrawn|obsolete)$/;
export const ADR_UNRATIFIED = /^(proposed|hypothesis|draft|pending)$/;

/** The first word of an ADR's `**Status**:` line, lower-cased, or "" when there is no such line.
 *  Exported so the compliance pack cannot answer "is this ratified?" with a second implementation:
 *  it printed `N ratified ADR(s)` while counting every .md in the directory, ratified or not, and
 *  that pack is the artifact that leaves the building for a third-party GRC tool. */
export { adrStatusLine };

/** The evidence natures a decision in this mission's journal declares UNCARRIABLE, with the ADR that
 *  says so. ADR-0075, ratified 2026-09-12, needed a machine-readable form of one of its own
 *  conclusions: some rules in the shipped corpus require evidence a given delivery has no tool to
 *  produce, and for runward `loadtest` is one — a CLI with no endpoint has nothing for k6 or JMeter to
 *  address, and writing a bench's numbers into a k6 schema would be a report implying a tool that never
 *  ran.
 *
 *  The label is read the way `**Status**` already is, deliberately: this file learned once that a
 *  second way of reading an ADR is how it came to answer "is this ratified?" two different ways, so the
 *  declaration uses the journal that exists rather than a registry beside it.
 *
 *  It changes a DISCLOSURE and nothing else. The nature stays unmet and stays listed; what changes is
 *  that the line carries the decision an auditor can read and challenge, instead of sitting beside gaps
 *  that are closable. It is not an exemption the tool grants — at the armed tier (ADR-0065) a
 *  declaration is a decision someone signed, not a switch that turns a requirement off. Only an
 *  ACCEPTED decision counts, so a `proposed` one declares nothing. */
export function declaredUncarriableNatures(missionDir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const dir of adrJournalDirs(missionDir)) {
    if (!existsSync(dir)) continue;
    let names: string[];
    try { names = readdirSync(dir).filter((f) => /^ADR-.*\.md$/i.test(f)).sort(); } catch { continue; }
    for (const name of names) {
      let text: string;
      try { text = readFileSync(join(dir, name), "utf8"); } catch { continue; }
      const line = text.match(/^\*\*Nature not carried\*\*:\s*([a-z][a-z0-9-]*)/mi);
      if (!line) continue;
      if (ADR_SET_ASIDE.test(adrStatusWord(text)) || ADR_UNRATIFIED.test(adrStatusWord(text))) continue;
      const id = name.match(/^ADR-\d+/i)?.[0].toUpperCase();
      if (id && !out.has(line[1].toLowerCase())) out.set(line[1].toLowerCase(), id);
    }
  }
  return out;
}

export function adrStatusWord(text: string): string {
  return adrStatusLine(text).toLowerCase().match(/^[a-zà-ÿ]+/)?.[0] ?? "";
}

/** The reason a `deviated` row's ADR cannot carry it, or null. Returns the precise cause so the
 *  operator is not left guessing between "wrong number" and "that file is the template". */
function adrProblem(missionDir: string, evidence: string): string | null {
  const id = evidence.match(/ADR-\d+/i)?.[0];
  if (!id) return "no ADR referenced — cite the ADR that records the deviation (e.g. ADR-0007)";
  return adrDecision(missionDir, id);
}

/**
 * The reconstruction lifecycle (ADR-0013/0014). A retroactively reconstructed decision is a
 * *hypothesis* until the operator ratifies it — writes the real *why*, sets a re-evaluation
 * trigger, and marks it accepted. This returns the ADRs in runward/adr/ still unratified, by
 * deterministic marker: a DRAFT- filename, a `Status: hypothesis`, or a `why: UNKNOWN` left in
 * place. The gate fails while any remain — an agent's guess must not pass as a decision.
 */
export function unratifiedAdrs(missionDir: string): Array<{ file: string; reason: string }> {
  const dir = join(missionDir, "adr");
  if (!existsSync(dir)) return [];
  const out: Array<{ file: string; reason: string }> = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    if (/^DRAFT-/i.test(f)) {
      // A DRAFT marked `Status: rejected` is the operator's durable "not a decision" (ADR-0038):
      // it is resolved, not unratified — deleting it instead would only be re-proposed by --mine.
      let draftBody = "";
      try { draftBody = readFileSync(join(dir, f), "utf8"); } catch { /* unreadable: treat as unratified */ }
      if (/^\s*(?:\*\*status\*\*|status)\s*:\s*rejected\b/im.test(draftBody)) continue;
      out.push({ file: f, reason: "DRAFT — reconstructed decision not yet ratified" });
      continue;
    }
    let body = "";
    try { body = readFileSync(join(dir, f), "utf8"); } catch { continue; }
    if (/^\s*(?:\*\*status\*\*|status)\s*:\s*hypothesis\b/im.test(body)) out.push({ file: f, reason: "Status: hypothesis" });
    else if (/why\s*:\s*UNKNOWN\b/i.test(body)) out.push({ file: f, reason: "why: UNKNOWN — the operator must supply it" });
  }
  return out;
}

/**
 * Decision-ratification coverage (ADR-0013): how many recorded decisions are ratified vs still
 * hypotheses. Advisory — a deterministic ratio, never a claim of completeness. Excludes the
 * scaffolded ADR-0000 template and any README.
 */
export function decisionCoverage(missionDir: string): { total: number; ratified: number; unratified: Array<{ file: string; reason: string }> } {
  const dir = join(missionDir, "adr");
  const unratified = unratifiedAdrs(missionDir);
  let total = 0;
  if (existsSync(dir)) {
    total = readdirSync(dir).filter((f) => {
      if (!f.endsWith(".md") || f === "ADR-0000-template.md" || f.toUpperCase() === "README.MD") return false;
      // A rejected DRAFT is a recorded "not a decision" — it is not part of the decision count.
      if (/^DRAFT-/i.test(f)) {
        try { return !/^\s*(?:\*\*status\*\*|status)\s*:\s*rejected\b/im.test(readFileSync(join(dir, f), "utf8")); } catch { return true; }
      }
      return true;
    }).length;
  }
  return { total, ratified: Math.max(0, total - unratified.length), unratified };
}

// A path token: a file with a known code/doc extension (excludes version numbers like v1.0, "§2").
const PATH_TOKEN = /[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|md|json|ya?ml|toml|go|rs|java|rb|php|sql|sh|css|scss|html|txt)\b/g;

/** File-path tokens carried by an evidence cell — the drift/evidence layer's shared extraction. */
export function evidencePathTokens(evidence: string): string[] {
  return evidence.match(PATH_TOKEN) ?? [];
}

/** Drift (ADR-0004, blocking under --strict since ADR-0021): applied pointers whose file path no
 *  longer resolves. Existence only. Rows carrying typed pointers are diagnosed by the evidence
 *  layer (ADR-0019) instead — one diagnosis per row, never two. */
export function driftReport(missionDir: string, deliverable: string): Violation[] {
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) return [];
  const bases = [dirname(missionDir), missionDir, dirname(path)];
  const out: Violation[] = [];
  for (const row of parseManifest(readFileSync(path, "utf8"))) {
    if (row.status !== "applied") continue;
    if (/\b(?:file|test|adr):\S/.test(row.evidence)) continue; // typed — the evidence layer owns it
    const tokens = row.evidence.match(PATH_TOKEN) ?? [];
    if (tokens.length === 0) continue; // pure prose reference — the operator's judgment
    // `existsSync(join(base, token))` had no containment and no symlink resolution, so a path
    // OUTSIDE the project satisfied this check while the same path written as a typed pointer was
    // refused. The gate punished precision: an operator in a monorepo who dropped `file:` went
    // green. One definition of "inside the project", used by both layers.
    const resolves = tokens.some((t) => resolveEvidencePath(t, bases) !== null);
    if (!resolves) out.push({ rule: row.rule, kind: "unresolved-pointer", problem: `applied pointer does not resolve (drift): ${row.evidence} — update the pointer, mark the row deviated with its ADR, or remove it` });
  }
  return out;
}

/** Verify a build phase's conformance manifest against its expected rule set. */
export function conformance(missionDir: string, phaseId: string, deliverable: string): ConformanceReport {
  const expected = expectedRules(missionDir, phaseId);
  const violations: Violation[] = [];
  // Non-vacuity (ADR-0002): the mapping cannot be stripped below its pinned floor.
  const floor = EXPECTED_MAPPED[phaseId];
  if (floor !== undefined && expected.length < floor) {
    violations.push({ rule: "(mapping)", kind: "mapping-floor", problem: `only ${expected.length} CRITICAL/HIGH rules mapped to '${phaseId}', floor is ${floor} — the mapping may have been stripped; restore the phases: [...] frontmatter on this phase's rules` });
  }
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) {
    return { expected, violations: expected.map((rule) => ({ rule, kind: "deliverable-missing" as const, problem: `${deliverable} missing` })) };
  }
  const { rows, problems } = readManifest(readFileSync(path, "utf8"));
  // A manifest the gate could not read whole is not a manifest that passed. Reporting the
  // structural fault here is what stops a duplicated section or a fenced table from producing a
  // confident "N rule(s) accounted for" over rows nobody read.
  for (const p of problems) violations.push({ rule: "(manifest)", kind: "manifest-unreadable", problem: p });
  // Form-lint (ADR-0003): well-formedness before the semantic check. Skip template placeholder tokens.
  const known = new Set(allRules(missionDir));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (/^\[.*\]$/.test(r.rule)) continue;
    counts.set(r.rule, (counts.get(r.rule) ?? 0) + 1);
  }
  // ADR-0057: built-in renames plus the org corpus's own migrations.json (in-tree, no fetch).
  const migrations = ruleMigrations(rulesDir(missionDir));
  for (const [rule, n] of counts) {
    if (!known.has(rule)) {
      const m = migrations[rule];
      const hint = m
        ? (m.to ? ` — renamed to '${m.to}' in ${m.since} (${m.reason})` : ` — removed in ${m.since} (${m.reason})`)
        : " (typo? not in runward/rules/)";
      violations.push({ rule, kind: "unknown-rule", problem: `unknown rule${hint}` });
    }
    if (n > 1) violations.push({ rule, kind: "duplicate-row", problem: `listed ${n} times in the manifest — keep a single row per rule` });
  }
  const byRule = new Map(rows.map((r) => [r.rule, r]));
  for (const rule of expected) {
    const row = byRule.get(rule);
    // ADR-0051 paper cut: the message described the destination and not the road. `runward manifest
    // --sync` scaffolds exactly these rows, and an operator who does not know that adds them by
    // hand, one at a time. Naming the gesture is free; what is NOT free is implying it closes the
    // gap — sync writes the row with an EMPTY status and the gate refuses that until a human
    // decides (ADR-0023). So the sentence names the tool and then hands the decision straight back.
    if (!row) { violations.push({ rule, kind: "missing-row", problem: "not accounted for in the Rule conformance manifest — `runward manifest --sync` scaffolds the missing row(s), with an empty status the gate still refuses; the decision stays yours: applied with a file:line/test, deviated with an ADR, or n/a with a reason" }); continue; }
    // ADR-0066: a proposal NEVER crosses. The refusal is dedicated, not an anonymous invalid
    // status: a proposed row is a named, refused, counted state — the whole mechanism rests on
    // the gate seeing it and saying exactly what it is waiting for.
    // The way out it names is the charter's (RWD-2026-0153). It used to end "or decide the row
    // yourself", and the reader of this line is as often the agent that wrote the proposal, which
    // the charter tells never to decide its own row; since ADR-0082 an agent has an honest road,
    // under its own name and never on a row it or its person proposed.
    if (proposedStatus(row.status)) {
      violations.push({ rule, kind: "proposed", problem:
        `${row.status} awaits ratification — a proposal is not a decision, and whoever proposed it does not ratify it: the operator runs \`runward ratify\`, which shows its evidence, or an agent that did not propose it reads it with \`runward ratify --agent <name> --for <person> --list\`, then names it with \`--accept\` (under the regulated tier, only where the mission accepts agent ratification)` });
      continue;
    }
    if (!VALID_STATUS.has(row.status)) {
      violations.push({ rule, kind: row.status === "" ? "empty-status" : "invalid-status", problem: row.status === ""
        ? "status not set — a scaffolded row is not a decision: choose applied | deviated | n/a and fill the Evidence column"
        : `invalid status "${row.status}" (use applied | deviated | n/a)` });
      continue;
    }
    if (row.status === "applied" && !row.evidence) violations.push({ rule, kind: "applied-without-evidence", problem: "applied without an evidence pointer — put a file:line or a test in the Evidence column" });
    if (row.status === "deviated") {
      const why = adrProblem(missionDir, row.evidence);
      if (why) violations.push({ rule, kind: "deviated-without-adr", problem: `deviated — ${why}` });
    }
    if (row.status === "n/a" && trivialReason(row.evidence)) violations.push({ rule, kind: "na-without-reason", problem: "n/a with an empty or placeholder reason — give a real one-line reason why it does not apply here" });
  }
  return { expected, violations };
}

// ── The ratification ledger (ADR-0066) ──────────────────────────────────────────────────────────

/** One entry of a deliverable's `### Ratification` block — the machine-readable line grammar the
 *  block carries, like the manifest table itself. Everything here is DECLARED, never proved
 *  (the `sealedAt` doctrine: runward holds no key, ADR-0021). */
export interface RatificationEntry {
  date: string; rows: string[]; mode: string;
  /** ADR-0080: rule → digest of the row as it stood when ratified (`bound:` segment). Empty for an
   *  entry written before the segment existed, or typed by hand without it. */
  bound: Record<string, string>;
  /** The declared ratifier (`by:`), without its `(declared…)` label. Absent when the line has none. */
  by?: string;
  /** ADR-0082: the declared person accountable for an agent ratifier (`for:`). */
  for?: string;
  /** The declared proposer moved out of the rows (`proposer:`), when the entry carries one. */
  proposer?: string;
  /** ADR-0088 decision 4: the person accountable for the proposer, as `propose --for` recorded it in
   *  the row (`proposer-for:`). Absent on entries written before it existed. */
  proposerFor?: string;
  /** ADR-0082: the entry was written by an agent (`mode: agent`). */
  agent?: true;
  /** ADR-0088 decision 4: the entry declares `independence: single accountable`, the agent's
   *  accountable person also answering for the proposer. */
  singleAccountable?: true;
}

/** ADR-0082: is this a ratification made by an agent, under its own name? The mode says so, and
 *  nothing else does: a reader never infers it from a name. */
export function isAgentMode(mode: string): boolean {
  return mode.trim().toLowerCase() === "agent";
}

/** ADR-0082: does a declared name appear in a declared text (a proposer segment)? Case-insensitive,
 *  as a whole token: `claude` matches `claude, 2026-09-28` and `Claude (agent)`, not `claude-code`.
 *  Both sides are DECLARED: this compares names someone typed, it proves nobody's identity
 *  (RWD-2026-0119). A match refuses; the comparison errs towards refusing. */
export function declaredNameIn(name: string, text: string): boolean {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) return false;
  const t = text.replace(/\s*\(declared[^)]*\)\s*$/i, "").replace(/\s+/g, " ");
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_-])${esc}($|[^\\p{L}\\p{N}_-])`, "iu").test(t);
}

/** ADR-0088 decision 4: how the person accountable for a ratifying agent relates to the row's
 *  proposer, compared by canonical id (identity.ts), never by raw strings.
 *
 *  - `agent-proposed`: the ratifying agent is itself the proposer. Never ratifiable.
 *  - `same-accountable`: one person answers for both sides. Refused, except as
 *    `agent (single accountable)`.
 *  - `independent`: two different accountable persons.
 *  - `unreadable`: the proposer's accountable person cannot be read: the row records none (`propose
 *    --for` did not run), its proposer is not a declared identity, and its text does not name the
 *    ratifier's accountable person.
 *
 *  `declared` says whether BOTH accountable persons resolved to a canonical id the lock declares;
 *  the regulated tier requires it, a default mission does not. Everything compared is declared text:
 *  this reads the record, it proves no one's identity (RWD-2026-0119). */
export type AccountableRelation = "agent-proposed" | "same-accountable" | "independent" | "unreadable";

export function accountableRelation(
  x: { agent?: string; accountable?: string; proposer?: string | null; proposerFor?: string | null },
  identities: Identities,
): { relation: AccountableRelation; declared: boolean } {
  const proposer = x.proposer ?? "";
  if (x.agent && proposer && (declaredNameIn(x.agent, proposer) ||
      resolveIdentity(x.agent, identities).id === resolveIdentity(proposer, identities).id)) {
    return { relation: "agent-proposed", declared: false };
  }
  if (!x.accountable || (!proposer && !x.proposerFor)) return { relation: "unreadable", declared: false };
  const a = resolveIdentity(x.accountable, identities);
  let p: { id: string; declared: boolean } | null = null;
  if (x.proposerFor) p = resolveIdentity(x.proposerFor, identities);
  else {
    const r = resolveIdentity(proposer, identities);
    if (r.declared) p = r;
    // A proposer segment written before `propose --for` existed: it may name the accountable person
    // in its prose (`claude, for Alice Martin`). Found there, under any declared spelling, it is the
    // same person; not found, nothing says who answers for the proposer.
    else if (r.id === a.id || spellingsOf(a, x.accountable, identities).some((n) => declaredNameIn(n, proposer))) p = a;
  }
  if (!p) return { relation: "unreadable", declared: false };
  return { relation: p.id === a.id ? "same-accountable" : "independent", declared: a.declared && p.declared };
}

/** ADR-0080: the digest a ratification binds to — the row's rule, status and evidence, whitespace
 *  folded so re-aligning a table does not unbind it. Rewriting the decision does. */
export function rowDigest(row: { rule: string; status: string; evidence: string }): string {
  const fold = (x: string) => x.trim().replace(/\s+/g, " ");
  return createHash("sha256").update(`${fold(row.rule)}\u0000${fold(row.status).toLowerCase()}\u0000${fold(row.evidence)}`).digest("hex").slice(0, 16);
}

/** Read a deliverable's `### Ratification` block. Append-only by convention; the table says the
 *  STATE, the block says the HISTORY. No side file — ADR-0038's precedent: the deliverable is the
 *  state, and a ledger beside it would drift. */
export function readRatification(content: string): RatificationEntry[] {
  const idx = content.search(/^### Ratification$/m);
  if (idx === -1) return [];
  const entries: RatificationEntry[] = [];
  for (const line of content.slice(idx).split("\n").slice(1)) {
    if (/^#{1,6}\s/.test(line)) break; // any heading ends the block
    const m = line.match(/^- (\d{4}-\d{2}-\d{2}) · rows: ([^·]+) · (.+)$/);
    if (!m) continue;
    const mode = (m[3].match(/mode: (.+)$/) ?? [, ""])[1]!.trim();
    const rows = m[2].replace(/\((\d+)\)\s*$/, "").split(",").map((r) => r.trim()).filter(Boolean);
    // ADR-0080: `bound: rule@digest, …` sits before `mode:`, so a reader that predates it still
    // reads the mode — the segment is additive (ADR-0024).
    const bound: Record<string, string> = {};
    const b = m[3].match(/(?:^|· )bound: ([^·]+)/);
    if (b) for (const pair of b[1].split(",")) {
      const [r, d] = pair.trim().split("@");
      if (r && d && /^[0-9a-f]{16}$/.test(d.trim())) bound[r.trim()] = d.trim();
    }
    // The declared names, each its own ` · `-separated segment (additive, ADR-0082: a reader that
    // predates them still reads rows, bound and mode). A name never carries ` · `: `ratify` refuses it.
    const named: Pick<RatificationEntry, "by" | "for" | "proposer" | "proposerFor" | "singleAccountable"> = {};
    for (const seg of m[3].split(" · ")) {
      // Plain string slicing, no backtracking pattern: the key before `: `, the value after, and a
      // trailing `(declared…)` label dropped.
      const at = seg.indexOf(": ");
      const key = at > 0 ? seg.slice(0, at) : "";
      // ADR-0088 decision 4, additive: `independence: single accountable` marks the exception.
      if (key === "independence") { if (seg.slice(at + 2).trim() === "single accountable") named.singleAccountable = true; continue; }
      if (key !== "by" && key !== "for" && key !== "proposer" && key !== "proposer-for") continue;
      let value = seg.slice(at + 2).trim();
      const label = value.lastIndexOf(" (declared");
      if (label !== -1 && value.endsWith(")")) value = value.slice(0, label).trim();
      if (value) named[key === "proposer-for" ? "proposerFor" : key] = value;
    }
    entries.push({ date: m[1], rows, mode, bound, ...named, ...(isAgentMode(mode) ? { agent: true as const } : {}) });
  }
  return entries;
}

/** The mission's ratification posture, disclosed and never gating (ADR-0060's shape): how many
 *  rows were ratified and how, and how many DECIDED rows carry no ratification trace at all.
 *  `untraced` is the disclosure counter ADR-0066 names: an operator who decided their own rows by
 *  hand is the legitimate solo path and pays nothing; an agent-built mission should show zero,
 *  and the armed tier (ADR-0065) may make it blocking for missions that opt in. */
export interface RatificationLedger {
  rows: number; lineByLine: number; enBloc: number; blind: number; untraced: number;
  /** ADR-0082: rows an agent ratified under its own name, counted apart from every human mode.
   *  PRESENT ONLY WHEN NON-ZERO: `verify` compares the whole object, and an attestation sealed
   *  before the field existed must keep verifying on a mission no agent ratified. */
  agent?: number;
  /** ADR-0082: who ratified them, and for whom: declared names, per (agent, accountable) pair. */
  agents?: Array<{ agent: string; for: string; rows: number }>;
  /** ADR-0088 decision 4: rows ratified as `agent (single accountable)`, the agent's accountable
   *  person also answering for the proposer (declared by the entry, or read from the names by
   *  canonical id), with the sentences every surface prints. PRESENT ONLY WHEN NON-ZERO, for the
   *  same reason as `agent`. */
  singleAccountable?: { rows: number; disclosure: string[] };
}

export function ratificationLedger(missionDir: string): RatificationLedger {
  let rows = 0, lineByLine = 0, enBloc = 0, blind = 0, untraced = 0, agent = 0, single = 0;
  const identities = readIdentities(missionDir);
  const pairs = new Map<string, { agent: string; for: string; rows: number }>();
  for (const g of GATED_DELIVERABLES) {
    const path = join(missionDir, g.deliverable);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    const traced = new Set<string>();
    for (const e of readRatification(content)) {
      for (const r of e.rows) traced.add(r);
      rows += e.rows.length;
      if (/blind/i.test(e.mode)) blind += e.rows.length;
      else if (e.agent) {
        agent += e.rows.length;
        const who = { agent: e.by ?? "(undeclared)", for: e.for ?? "(undeclared)" };
        const k = `${who.agent}\u0000${who.for}`;
        pairs.set(k, { ...who, rows: (pairs.get(k)?.rows ?? 0) + e.rows.length });
        if (e.singleAccountable || accountableRelation({ agent: e.by, accountable: e.for, proposer: e.proposer, proposerFor: e.proposerFor }, identities).relation === "same-accountable") single += e.rows.length;
      }
      else if (/^en bloc/i.test(e.mode)) enBloc += e.rows.length;
      else lineByLine += e.rows.length;
    }
    for (const row of parseManifest(content)) {
      if (VALID_STATUS.has(row.status) && !traced.has(row.rule)) untraced++;
    }
  }
  return { rows, lineByLine, enBloc, blind, untraced,
    ...(agent > 0 ? { agent, agents: [...pairs.values()].sort((a, b) => a.agent.localeCompare(b.agent) || a.for.localeCompare(b.for)) } : {}),
    ...(single > 0 ? { singleAccountable: { rows: single, disclosure: singleAccountableDisclosure(missionDir) } } : {}) };
}

/** ADR-0088 decision 4, at the character: the sentence every surface prints beside rows ratified as
 *  `agent (single accountable)`, and under the regulated tier the second one. */
export function singleAccountableDisclosure(missionDir: string): string[] {
  return regulatedOptIn(missionDir)
    ? [SINGLE_ACCOUNTABLE_DISCLOSURE, SINGLE_ACCOUNTABLE_REGULATED_NOTE]
    : [SINGLE_ACCOUNTABLE_DISCLOSURE];
}

/** Why a decided row does not count as ratified under the regulated tier (ADR-0080). */
export type UnboundCause = "no-trace" | "blind" | "no-digest" | "changed"
  /** ADR-0082: ratified by an agent on a regulated mission whose lock does not declare
   *  `"agentRatification": true`. */
  | "agent-not-accepted"
  /** ADR-0082 amended: the agent, or the person accountable for it, is the row's declared proposer. */
  | "agent-proposer"
  /** ADR-0082 amended: an agent ratification that names no accountable person, or a row with no
   *  declared proposer: the independence the tier asks for cannot be read from the trace. */
  | "agent-unattributed"
  /** ADR-0088 decision 4: an accountable person (the ratifier's or the proposer's) is not a canonical
   *  id the lock's `identities` declares, so the comparison by canonical id cannot be made. */
  | "agent-identity-undeclared"
  /** ADR-0088 decision 4: ratified as `agent (single accountable)`, and the lock does not name this
   *  person as its `singleAccountable` exception: refused by default under the regulated tier. */
  | "single-accountable-refused"
  /** ADR-0088 decision 4: the lock names the exception, and no signed sample covers the period yet. */
  | "single-accountable-unsampled";

/**
 * ADR-0080, part 1: under the regulated tier every DECIDED row must carry a ratification bound to
 * its current content. The LAST entry naming a row is the one that speaks for it. What this proves
 * is a record, not a gesture: a script can write the line as well as `ratify` can (RWD-2026-0119).
 */
export function unboundRatifications(
  missionDir: string,
  /** ADR-0053: under `--through`, the phases beyond the horizon are deferred, not judged. */
  judged: (phase: string) => boolean = () => true,
): Array<{ deliverable: string; rule: string; cause: UnboundCause }> {
  const out: Array<{ deliverable: string; rule: string; cause: UnboundCause }> = [];
  // ADR-0082: the organisation's explicit choice, off by default, read from the committed lock.
  // ADR-0088 decision 4: the declared identities and the single-accountable exception, same lock.
  const ctx: AgentContext = { accepted: agentRatificationOptIn(missionDir), identities: readIdentities(missionDir), single: singleAccountableOptIn(missionDir) };
  for (const g of GATED_DELIVERABLES) {
    if (!judged(g.phase)) continue;
    const path = join(missionDir, g.deliverable);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    const last = new Map<string, RatificationEntry>();
    for (const e of readRatification(content)) for (const r of e.rows) last.set(r, e);
    for (const row of parseManifest(content)) {
      if (!VALID_STATUS.has(row.status)) continue;
      const e = last.get(row.rule);
      const cause: UnboundCause | null = !e ? "no-trace"
        : /blind/i.test(e.mode) ? "blind"
        : !e.bound[row.rule] ? "no-digest"
        : e.bound[row.rule] !== rowDigest(row) ? "changed"
        : e.agent ? agentCause(e, ctx)
        : null;
      if (cause) out.push({ deliverable: g.deliverable, rule: row.rule, cause });
    }
  }
  return out;
}

interface AgentContext { accepted: boolean; identities: Identities; single: string | null }

/** ADR-0082 (amended 2026-09-28) and ADR-0088 decision 4: an agent ratification binds under the
 *  regulated tier only when the mission accepts agent ratification AND the persons accountable for
 *  the ratifying agent and for the proposer are two different canonical ids the lock declares.
 *
 *  Until ADR-0088 this compared the declared strings: `--for thibaultsouris` against a proposer
 *  `Thibault Souris` read as two people, and a proposer segment naming an agent (`claude`) let an
 *  agent answering to the same person ratify as if independent (RWD-2026-0164). Accountable persons
 *  are now compared by canonical id, and a relation the trace cannot read is a named gap.
 *
 *  The one exception, `agent (single accountable)`, counts only when the lock names the person
 *  (`"singleAccountable": "<canonical id>"`) AND a passing signed sample covers the period. The
 *  signed sample does not exist yet (ADR-0088 decision 6, a later change), so under the exception
 *  such a row is a named gap, `no signed sample yet`, never silently counted. Names are declared on
 *  every side: this reads the record, it proves no one's identity. */
function agentCause(e: RatificationEntry, ctx: AgentContext): UnboundCause | null {
  if (!ctx.accepted) return "agent-not-accepted";
  if (!e.for || (!e.proposer && !e.proposerFor)) return "agent-unattributed";
  const r = accountableRelation({ agent: e.by, accountable: e.for, proposer: e.proposer, proposerFor: e.proposerFor }, ctx.identities);
  if (r.relation === "agent-proposed") return "agent-proposer";
  if (r.relation === "unreadable") return "agent-unattributed";
  if (!r.declared) return "agent-identity-undeclared";
  if (r.relation === "independent") return null;
  // One accountable person on both sides. Without the entry's own `independence: single accountable`
  // it is the refusal ADR-0082 already named; with it, the exception is the lock's to grant.
  if (!e.singleAccountable) return "agent-proposer";
  const named = ctx.single === null ? null : resolveIdentity(ctx.single, ctx.identities);
  if (!named || !named.declared || named.id !== resolveIdentity(e.for, ctx.identities).id) return "single-accountable-refused";
  return "single-accountable-unsampled";
}

export const UNBOUND_CAUSE_TEXT: Record<UnboundCause, string> = {
  "no-trace": "decided, never ratified",
  "blind": "ratified BLIND, without displayed evidence",
  "no-digest": "its ratification carries no content digest (written before the regulated tier, or by hand)",
  "changed": "the row changed since it was ratified",
  "agent-not-accepted": "ratified by an agent; this mission does not accept agent ratification (its scaffold-lock.json does not declare \"agentRatification\": true)",
  "agent-proposer": "ratified by an agent whose accountable person, or the agent itself, proposed the row (declared names compared, not proof)",
  "agent-unattributed": "ratified by an agent, but the trace names no accountable person, or nothing says who answers for the proposer (no `for:` recorded by `runward propose --for`, and the proposer is not a declared identity): the independence the tier asks for cannot be read",
  "agent-identity-undeclared": "ratified by an agent, but an accountable person (the ratifier's or the proposer's) is not a canonical id declared in scaffold-lock.json \"identities\": this tier compares accountable persons by canonical id (declared, not proof)",
  "single-accountable-refused": `ratified as agent (single accountable): one person answers for the proposer and the ratifying agent, and scaffold-lock.json does not name this person as "singleAccountable"; refused by default under this tier (${SINGLE_ACCOUNTABLE_REGULATED_NOTE})`,
  "single-accountable-unsampled": `ratified as agent (single accountable) under the lock's "singleAccountable" exception, which counts only for a period a passing signed sample covers: no signed sample yet (${SINGLE_ACCOUNTABLE_REGULATED_NOTE})`,
};
