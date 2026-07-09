import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { TEMPLATES } from "./paths.js";
import { EXPECTED_MAPPED } from "./constants.js";
import { RULE_MIGRATIONS } from "./rule-migrations.js";

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

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const VALID_STATUS = new Set(["applied", "deviated", "n/a"]);

/** An n/a reason must be more than a placeholder: real length, not a bracketed template token. */
function trivialReason(s: string): boolean {
  const t = s.trim();
  return t.length < 8 || /^\[.*\]$/.test(t);
}

interface RuleMeta { impact: string; phases: string[] }

function parseRuleMeta(content: string): RuleMeta {
  const fm = content.match(FRONTMATTER)?.[1] ?? "";
  const impact = (fm.match(/^impact:\s*(.+)$/m)?.[1] ?? "").trim();
  const phasesRaw = fm.match(/^phases:\s*\[(.*)\]/m)?.[1] ?? "";
  const phases = phasesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return { impact, phases };
}

/** CRITICAL/HIGH rules mapped to a phase — the set that must be accounted for.
 *  The mapping is a property of the rule definitions: read the mission's own
 *  `runward/rules/` when present, else fall back to the package rules (the
 *  authoritative source — covers missions predating rules-in-mission). */
export function expectedRules(missionDir: string, phaseId: string): string[] {
  const missionRules = join(missionDir, "rules");
  const dir = existsSync(missionRules) ? missionRules : join(TEMPLATES, "rules");
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
  const missionRules = join(missionDir, "rules");
  const dir = existsSync(missionRules) ? missionRules : join(TEMPLATES, "rules");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
}

/** Parse the "## Rule conformance" markdown table from a deliverable. */
export function parseManifest(content: string): ManifestRow[] {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => /^##\s+Rule conformance/i.test(l));
  if (start === -1) return [];
  const rows: ManifestRow[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break; // next section
    if (!line.trim().startsWith("|")) continue;
    const cols = line.split("|").slice(1, -1).map((c) => c.replace(/`/g, "").trim());
    if (cols.length < 3) continue;
    const [rule, status, evidence] = cols;
    if (/^rule$/i.test(rule) || /^:?-+:?$/.test(rule)) continue; // header / separator
    rows.push({ rule, status: status.toLowerCase(), evidence });
  }
  return rows;
}

function adrExists(missionDir: string, evidence: string): boolean {
  const id = evidence.match(/ADR-\d+/i)?.[0].toUpperCase();
  if (!id) return false;
  const dir = join(missionDir, "adr");
  return existsSync(dir) && readdirSync(dir).some((f) => f.toUpperCase().startsWith(id));
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
    if (/^DRAFT-/i.test(f)) { out.push({ file: f, reason: "DRAFT — reconstructed decision not yet ratified" }); continue; }
    let body = "";
    try { body = readFileSync(join(dir, f), "utf8"); } catch { continue; }
    if (/^\s*(?:\*\*status\*\*|status)\s*:\s*hypothesis\b/im.test(body)) out.push({ file: f, reason: "Status: hypothesis" });
    else if (/why\s*:\s*UNKNOWN\b/i.test(body)) out.push({ file: f, reason: "why: UNKNOWN — the operator must supply it" });
  }
  return out;
}

// A path token: a file with a known code/doc extension (excludes version numbers like v1.0, "§2").
const PATH_TOKEN = /[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|md|json|ya?ml|toml|go|rs|java|rb|php|sql|sh|css|scss|html|txt)\b/g;

/** Advisory drift (ADR-0004): applied pointers whose file path no longer resolves. Existence only. */
export function driftReport(missionDir: string, deliverable: string): Violation[] {
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) return [];
  const bases = [dirname(missionDir), missionDir, dirname(path)];
  const out: Violation[] = [];
  for (const row of parseManifest(readFileSync(path, "utf8"))) {
    if (row.status !== "applied") continue;
    const tokens = row.evidence.match(PATH_TOKEN) ?? [];
    if (tokens.length === 0) continue; // pure prose reference — the operator's judgment
    const resolves = tokens.some((t) => bases.some((b) => existsSync(join(b, t))));
    if (!resolves) out.push({ rule: row.rule, problem: `applied pointer does not resolve (drift?): ${row.evidence} — update the pointer or remove the row` });
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
  const rows = parseManifest(readFileSync(path, "utf8"));
  // Form-lint (ADR-0003): well-formedness before the semantic check. Skip template placeholder tokens.
  const known = new Set(allRules(missionDir));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (/^\[.*\]$/.test(r.rule)) continue;
    counts.set(r.rule, (counts.get(r.rule) ?? 0) + 1);
  }
  for (const [rule, n] of counts) {
    if (!known.has(rule)) {
      const m = RULE_MIGRATIONS[rule];
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
    if (!row) { violations.push({ rule, problem: "not accounted for in the Rule conformance manifest — add a row: applied with a file:line/test, deviated with an ADR, or n/a with a reason" }); continue; }
    if (!VALID_STATUS.has(row.status)) { violations.push({ rule, problem: `invalid status "${row.status}" (use applied | deviated | n/a)` }); continue; }
    if (row.status === "applied" && !row.evidence) violations.push({ rule, problem: "applied without an evidence pointer — put a file:line or a test in the Evidence column" });
    if (row.status === "deviated" && !adrExists(missionDir, row.evidence)) violations.push({ rule, problem: "deviated but no matching ADR in runward/adr/ — reference an ADR that exists there" });
    if (row.status === "n/a" && trivialReason(row.evidence)) violations.push({ rule, problem: "n/a with an empty or placeholder reason — give a real one-line reason why it does not apply here" });
  }
  return { expected, violations };
}
