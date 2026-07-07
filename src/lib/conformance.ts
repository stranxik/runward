import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES } from "./paths.js";

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

/** Verify a build phase's conformance manifest against its expected rule set. */
export function conformance(missionDir: string, phaseId: string, deliverable: string): ConformanceReport {
  const expected = expectedRules(missionDir, phaseId);
  const violations: Violation[] = [];
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) {
    return { expected, violations: expected.map((rule) => ({ rule, problem: `${deliverable} missing` })) };
  }
  const byRule = new Map(parseManifest(readFileSync(path, "utf8")).map((r) => [r.rule, r]));
  for (const rule of expected) {
    const row = byRule.get(rule);
    if (!row) { violations.push({ rule, problem: "not accounted for in the Rule conformance manifest" }); continue; }
    if (!VALID_STATUS.has(row.status)) { violations.push({ rule, problem: `invalid status "${row.status}" (use applied | deviated | n/a)` }); continue; }
    if (row.status === "applied" && !row.evidence) violations.push({ rule, problem: "applied without an evidence pointer" });
    if (row.status === "deviated" && !adrExists(missionDir, row.evidence)) violations.push({ rule, problem: "deviated but no matching ADR in runward/adr/" });
    if (row.status === "n/a" && !row.evidence) violations.push({ rule, problem: "n/a without a reason" });
  }
  return { expected, violations };
}
