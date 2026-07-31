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
  /** The territory this rule declares, as path globs (ADR-0041). */
  appliesTo: string[];
  /** Why this rule has NO file territory, when that is a decision rather than an omission
   *  (ADR-0041 amendment). Silence is not a declaration: without this field, "no territory yet
   *  reviewed" and "no territory by nature" are indistinguishable, and the reader cannot tell a
   *  considered scope from a gap — the very confusion ADR-0040 exists to refuse. */
  noTerritory: string | null;
}

/**
 * The gate-wide non-scope (ADR-0040, generalising ADR-0005): what NO green row proves,
 * stated once so 64 rules don't repeat it. A rule's own `nonScope:` frontmatter narrows
 * or specialises this; it never replaces it.
 */
export const GATE_NON_SCOPE =
  "A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. " +
  "It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute " +
  "project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). " +
  "Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the " +
  "row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but " +
  "code added later under the same rule is never re-judged — the gate has no signal that new work fell under an " +
  "already-accounted-for rule. Confront the rules at the point of action, not only at the crossing.";

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
    appliesTo: listField(fm, "appliesTo"),
    noTerritory: field("noTerritory") || null,
  };
}

// ── Territory matching (ADR-0041) ──
// `--for <paths>` answers "which rules govern these files" by matching each path against the
// globs a rule DECLARES in `appliesTo:`. Pure string matching: no filesystem access, no git, no
// model — a path need not exist (you may ask before writing the file). Tags are never a path
// match: they are thematic, and inferring territory from them would be a heuristic with no
// auditable reason to render.

// The supported glob dialect, declared rather than inherited — no braces, no character ranges,
// no negation, so a rule author reads the whole grammar in five lines. "/" is the separator and
// paths are POSIX-normalised before matching.
//   double-star + slash, leading   zero or more leading segments (so a root-level hit matches too)
//   slash + double-star, trailing  the directory itself and everything under it
//   double-star, elsewhere         any run of characters, crossing "/"
//   single star                    any run of characters within one segment
//   question mark                  exactly one character, never "/"
// Anything else is literal. Example: the pattern for a cron territory matches both "cron/run.ts"
// and "src/jobs/cron/run.ts", but never "src/cronjob.ts".
export const GLOB_DIALECT =
  "`**/` (zero or more leading segments) · `/**` (the directory and everything under it) · " +
  "`**` (any run, crossing `/`) · `*` (any run within a segment) · `?` (one character). " +
  "No braces, no ranges, no negation — everything else is literal.";

function globToRegExp(glob: string): RegExp {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith("**/", i) && i === 0) { re += "(?:.*/)?"; i += 3; continue; }
    if (glob.startsWith("/**", i) && i + 3 === glob.length) { re += "(?:/.*)?"; i += 3; continue; }
    if (glob.startsWith("**", i)) { re += ".*"; i += 2; continue; }
    const ch = glob[i];
    if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i++;
  }
  return new RegExp(`^${re}$`);
}

/** Normalise a caller-supplied path to a project-relative POSIX path, or null if the question
 *  cannot be asked about it (absolute, or escaping the project with `..`). Windows separators are
 *  accepted so a caller on either platform gets the same answer. */
export function normalizeForPath(input: string): string | null {
  const p = input.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!p) return null;
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return null; // absolute: not project-relative
  if (p.split("/").includes("..")) return null;               // escapes the project
  return p;
}

/** One reason a rule was retained, on the `git check-ignore -v` model: which pattern, from which
 *  field, retained which path. Rendered verbatim — it is a fact, never a verdict. */
export interface RuleMatch {
  kind: "appliesTo";
  pattern: string;
  path: string;
}

export interface MatchReport {
  /** Matched rules, in the rule set's own order (by slug) — never ranked. */
  matched: Array<{ rule: RuleInfo; matchedBy: RuleMatch[] }>;
  /** Rules with no territory globs, so `--for` cannot evaluate them. Reported, never silently
   *  dropped. Equals `declaredNoTerritory + unreviewed` — the two are split below because they
   *  mean opposite things. */
  unscoped: number;
  /** Of those: rules that DECLARE they have no file territory, with the reason. A decision. */
  declaredNoTerritory: number;
  /** Of those: rules nobody has ruled on yet. An omission — this is the editorial backlog, and
   *  unlike `declaredNoTerritory` it is meant to reach zero. */
  unreviewed: number;
  total: number;
}

/** Match a rule set against paths. Deterministic: sorted input order preserved, matches in
 *  (path, pattern) declaration order, no scoring. */
export function matchRulesForPaths(rules: RuleInfo[], paths: string[]): MatchReport {
  const matched: MatchReport["matched"] = [];
  let unscoped = 0, declaredNoTerritory = 0, unreviewed = 0;
  for (const rule of rules) {
    if (rule.appliesTo.length === 0) {
      unscoped++;
      if (rule.noTerritory) declaredNoTerritory++; else unreviewed++;
      continue;
    }
    const matchedBy: RuleMatch[] = [];
    for (const path of paths) {
      for (const pattern of rule.appliesTo) {
        if (globToRegExp(pattern).test(path)) matchedBy.push({ kind: "appliesTo", pattern, path });
      }
    }
    if (matchedBy.length) matched.push({ rule, matchedBy });
  }
  return { matched, unscoped, declaredNoTerritory, unreviewed, total: rules.length };
}

/** The standing caveat printed with every `--for` answer. A matcher that let its list be read as
 *  exhaustive would be the weak verifier ADR-0040 warns about. */
export const FOR_NON_EXHAUSTIVE =
  "Surfacing, never masking: this list is what the rules themselves declare they govern. " +
  "A rule absent from it is not thereby inapplicable — a rule with no territory is never matched, " +
  "only counted. Two reasons a rule carries none, and they are opposite: it DECLARED it has no " +
  "file territory (a decision, with its reason readable via `runward explain`), or nobody has " +
  "ruled on it yet (an omission). Only the second is a backlog.";

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
