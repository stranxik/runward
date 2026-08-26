import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolveEvidencePath } from "./evidence.js";
import { join, dirname } from "node:path";
import { TEMPLATES } from "./paths.js";
import { EXPECTED_MAPPED, ADR_MIN_CHARS } from "./constants.js";
import { ruleMigrations } from "./rule-migrations.js";

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
export interface Violation { rule: string; problem: string; }
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

/** An n/a reason must be more than a placeholder: real length, not a bracketed template token. */
function trivialReason(s: string): boolean {
  const t = s.trim();
  return t.length < 8 || /^\[.*\]$/.test(t);
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
export function readManifest(content: string): { rows: ManifestRow[]; problems: string[] } {
  const lines = content.split("\n");
  const problems: string[] = [];
  const heads: number[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (!fenced && /^#{1,6}\s+Rule conformance/i.test(lines[i])) heads.push(i);
  }
  if (heads.length === 0) return { rows: [], problems };
  if (heads.length > 1) {
    // Refuse, never pick. Choosing the first is how an "example of the format" pasted above the
    // real table made a whole phase invisible while the gate reported it accounted for.
    problems.push(`${heads.length} \`Rule conformance\` sections in this deliverable (lines ${heads.map((i) => i + 1).join(", ")}) — the gate will not choose between them; keep one`);
    return { rows: [], problems };
  }

  const rows: ManifestRow[] = [];
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
    const cols = inner.split("|").map((c) => c.replace(/`/g, "").trim());
    if (cols.length < 3) {
      if (!/^:?-+:?$/.test(cols[0] ?? "") && (cols[0] ?? "").trim() && !/^rule$/i.test(cols[0]))
        problems.push(`line ${i + 1}: a manifest row needs 3 columns (rule | status | evidence) — got ${cols.length}: ${t.slice(0, 70)}`);
      continue;
    }
    const rule = cols[0], status = cols[1], evidence = cols.slice(2).join(" | ");
    if (/^rule$/i.test(rule) || /^:?-+:?$/.test(rule)) continue; // header / separator
    rows.push({ rule, status: status.toLowerCase(), evidence });
  }
  return { rows, problems };
}

/** True when an ADR with exactly this id (e.g. "ADR-3") exists in runward/adr/.
 *  Anchored on a digit boundary so ADR-1 is not satisfied by ADR-10 / ADR-12
 *  when filenames are unpadded. */
export function adrIdExists(missionDir: string, id: string): boolean {
  return adrDecision(missionDir, id) === null;
}

/** Why this ADR cannot carry a decision, or null when it can.
 *
 *  The evidence layer refuses an empty file outright ("an empty file is not evidence"); the ADR
 *  layer accepted one as a ratified decision. An audit satisfied 36 deviations with a 0-byte file,
 *  and 36 more by pointing at `ADR-0000-template.md` — the template runward scaffolds itself and
 *  nobody ever wrote. A directory named `ADR-0009-…` passed too. The two layers now hold the same
 *  line: a decision has to have been made by someone. */
export function adrDecision(missionDir: string, id: string): string | null {
  const dir = join(missionDir, "adr");
  if (!existsSync(dir)) return "no runward/adr/ directory";
  const u0 = id.toUpperCase();
  const hit = readdirSync(dir).find((f) => {
    const u = f.toUpperCase();
    return u.startsWith(u0) && !/[0-9]/.test(u.charAt(u0.length));
  });
  if (!hit) return "no matching ADR in runward/adr/";
  if (/^ADR-0+(?:-|\.md$)/i.test(hit) || /^ADR-0+$/i.test(hit.replace(/\.md$/i, "")))
    return `${hit} is the scaffolded template, not a decision anyone took`;
  const abs = join(dir, hit);
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
export function adrStatusWord(text: string): string {
  const line = text.match(/^\*\*Status\*\*:\s*(.+)$/mi)?.[1]?.trim() ?? "";
  return line.toLowerCase().match(/^[a-zà-ÿ]+/)?.[0] ?? "";
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
    if (!resolves) out.push({ rule: row.rule, problem: `applied pointer does not resolve (drift): ${row.evidence} — update the pointer, mark the row deviated with its ADR, or remove it` });
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
    violations.push({ rule: "(mapping)", problem: `only ${expected.length} CRITICAL/HIGH rules mapped to '${phaseId}', floor is ${floor} — the mapping may have been stripped; restore the phases: [...] frontmatter on this phase's rules` });
  }
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) {
    return { expected, violations: expected.map((rule) => ({ rule, problem: `${deliverable} missing` })) };
  }
  const { rows, problems } = readManifest(readFileSync(path, "utf8"));
  // A manifest the gate could not read whole is not a manifest that passed. Reporting the
  // structural fault here is what stops a duplicated section or a fenced table from producing a
  // confident "N rule(s) accounted for" over rows nobody read.
  for (const p of problems) violations.push({ rule: "(manifest)", problem: p });
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
      violations.push({ rule, problem: `unknown rule${hint}` });
    }
    if (n > 1) violations.push({ rule, problem: `listed ${n} times in the manifest — keep a single row per rule` });
  }
  const byRule = new Map(rows.map((r) => [r.rule, r]));
  for (const rule of expected) {
    const row = byRule.get(rule);
    // ADR-0051 paper cut: the message described the destination and not the road. `runward manifest
    // --sync` scaffolds exactly these rows, and an operator who does not know that adds them by
    // hand, one at a time. Naming the gesture is free; what is NOT free is implying it closes the
    // gap — sync writes the row with an EMPTY status and the gate refuses that until a human
    // decides (ADR-0023). So the sentence names the tool and then hands the decision straight back.
    if (!row) { violations.push({ rule, problem: "not accounted for in the Rule conformance manifest — `runward manifest --sync` scaffolds the missing row(s), with an empty status the gate still refuses; the decision stays yours: applied with a file:line/test, deviated with an ADR, or n/a with a reason" }); continue; }
    if (!VALID_STATUS.has(row.status)) {
      violations.push({ rule, problem: row.status === ""
        ? "status not set — a scaffolded row is not a decision: choose applied | deviated | n/a and fill the Evidence column"
        : `invalid status "${row.status}" (use applied | deviated | n/a)` });
      continue;
    }
    if (row.status === "applied" && !row.evidence) violations.push({ rule, problem: "applied without an evidence pointer — put a file:line or a test in the Evidence column" });
    if (row.status === "deviated") {
      const why = adrProblem(missionDir, row.evidence);
      if (why) violations.push({ rule, problem: `deviated — ${why}` });
    }
    if (row.status === "n/a" && trivialReason(row.evidence)) violations.push({ rule, problem: "n/a with an empty or placeholder reason — give a real one-line reason why it does not apply here" });
  }
  return { expected, violations };
}
