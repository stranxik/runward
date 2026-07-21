import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rulesDir } from "./conformance.js";
import { TEMPLATES } from "./paths.js";

/**
 * The rule set as data (ADR-0024): one parser for the full frontmatter shape,
 * shared by the machine surface (`rules --json`) and `explain`. Read-only.
 */

export interface RuleInfo {
  slug: string;
  title: string;
  impact: string;
  phases: string[];
  asi: string[];
  tags: string[];
  why: string;
  signature: string | null;
  /** What a green row for this rule does NOT prove (ADR-0040). Null = the gate-wide default applies. */
  nonScope: string | null;
}

/**
 * The gate-wide non-scope (ADR-0040, generalising ADR-0005): what NO green row proves,
 * stated once so 64 rules don't repeat it. A rule's own `nonScope:` frontmatter narrows
 * or specialises this; it never replaces it.
 */
export const GATE_NON_SCOPE =
  "A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. " +
  "It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute " +
  "project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005).";

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

function listField(fm: string, key: string): string[] {
  const raw = fm.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, "m"))?.[1] ?? "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseRule(slug: string, content: string): RuleInfo {
  const fm = content.match(FRONTMATTER)?.[1] ?? "";
  const field = (key: string) => (fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1] ?? "").trim();
  return {
    slug,
    title: field("title") || slug,
    impact: field("impact"),
    phases: listField(fm, "phases"),
    asi: listField(fm, "asi").map((s) => s.toUpperCase()).filter((s) => /^ASI\d{2}$/.test(s)),
    tags: listField(fm, "tags"),
    why: field("impactDescription"),
    signature: field("signature") || null,
    nonScope: field("nonScope") || null,
  };
}

/** The rule body — everything after the frontmatter. */
export function ruleBody(content: string): string {
  return content.replace(FRONTMATTER, "").replace(/^\n+/, "");
}

/** The effective rule set: the mission's copy when a mission is given and has one, else the package's. */
export function ruleSetDir(missionDir: string | null): { dir: string; source: "mission" | "package" } {
  if (missionDir) {
    const dir = rulesDir(missionDir);
    return { dir, source: dir === join(TEMPLATES, "rules") ? "package" : "mission" };
  }
  return { dir: join(TEMPLATES, "rules"), source: "package" };
}

/** Deterministic inventory, sorted by slug. */
export function readRuleSet(dir: string): RuleInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseRule(f.replace(/\.md$/, ""), readFileSync(join(dir, f), "utf8")));
}
