import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rulesDir } from "./conformance.js";
import { readScaffoldLock } from "./scaffold-lock.js";
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
  /** The categories of artifact this rule governs (ADR-0043) — the invariant half of a territory.
   *  Which files are in a category is declared elsewhere: derived from a deployment manifest, or
   *  by the mission. Composes with `appliesTo` by union; a rule may carry both. */
  governs: string[];
  /** Why this rule has NO file territory, when that is a decision rather than an omission
   *  (ADR-0041 amendment). Silence is not a declaration: without this field, "no territory yet
   *  reviewed" and "no territory by nature" are indistinguishable, and the reader cannot tell a
   *  considered scope from a gap — the very confusion ADR-0040 exists to refuse. */
  noTerritory: string | null;
  /** Why this rule maps to NO gated phase, when that is a decision rather than an omission
   *  (the ADR-0041 shape, third member of the family after noTerritory and noAsi; posed by the
   *  2026-09-02 lot instruction, ADR-0065 context). A cost lever pulled on a measured trigger, a
   *  reference table that informs decisions, an optimisation adopted mid-iteration: forcing a
   *  phase onto those manufactures a manifest row nobody can honestly fill. Silence is not a
   *  declaration: without this field, "not yet attached" and "no phase by nature" are
   *  indistinguishable — which is exactly how 33 rules sat unattached for two months with five
   *  CRITICAL among them and nothing to say so. */
  noPhase: string | null;
  /** Why this CRITICAL/HIGH rule maps to NO OWASP ASI category, when that is a decision rather
   *  than an omission (ADR-0009 amendment, reusing the ADR-0041 shape). ASI is an AGENTIC-SECURITY
   *  taxonomy: a rule about hexagonal layering, model cost ratios or forward-only migrations has no
   *  honest ASI category, and forcing one manufactures a false mapping a CISO would read as coverage
   *  that does not exist — the mirror of the false red ADR-0020 refuses for signatures. Silence is
   *  not a declaration: without this field, "not yet mapped" and "no ASI surface by nature" are
   *  indistinguishable. */
  noAsi: string | null;
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

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

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
    governs: listField(fm, "governs"),
    noTerritory: field("noTerritory") || null,
    noPhase: field("noPhase") || null,
    noAsi: field("noAsi") || null,
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

export function globToRegExp(glob: string): RegExp {
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
export type RuleMatch =
  | { kind: "appliesTo"; pattern: string; path: string }
  /** A category match carries BOTH levels of the reason (ADR-0043): the rule governs this
   *  category, and this file is in it because of that declaration, in that file, at that line —
   *  the `<source>` component of the `git check-ignore -v` model. It carries no `pattern`: a
   *  pattern is a glob, and emitting a fake one would repurpose an existing field. */
  | {
      kind: "category"; category: string; path: string;
      via:
        | { source: "derived"; adapter: string; file: string; line: number | null; declaration: string }
        | { source: "map"; file: string; line: number; pattern: string; why: string };
    };

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
  /** Declared a territory that was fully resolvable here, and no path matched. The question was
   *  asked and answered. (ADR-0043) */
  evaluated: number;
  /** Declared a CATEGORY that nothing in this mission binds to any file — so the question could
   *  not be asked. Neither a scope nor a backlog: a missing binding. This is the "rules that
   *  govern nothing" half of the bidirectional report. (ADR-0043)
   *  Resolution is mission-wide, matching is per-path: a category is unresolved only when NO file
   *  anywhere carries it, never merely because the paths asked about are outside it. */
  unresolved: number;
  total: number;
}

/** Match a rule set against paths. Deterministic: sorted input order preserved, matches in
 *  (path, pattern) declaration order, no scoring. */
export function matchRulesForPaths(
  rules: RuleInfo[],
  paths: string[],
  /** Category bindings for this mission — file → category, each with the declaration that bound
   *  it. Empty when there is no mission or no derivation source: categories are then structurally
   *  unresolvable, and the report says so rather than answering a shorter truth. */
  bindings: ReadonlyArray<{ path: string; category: string; via: Extract<RuleMatch, { kind: "category" }>["via"] }> = [],
): MatchReport {
  const matched: MatchReport["matched"] = [];
  let unscoped = 0, declaredNoTerritory = 0, unreviewed = 0, evaluated = 0, unresolved = 0;
  // Resolution is mission-wide: a category is resolved if ANY file carries it, whatever was asked.
  const boundCategories = new Set(bindings.map((b) => b.category));

  for (const rule of rules) {
    if (rule.appliesTo.length === 0 && rule.governs.length === 0) {
      unscoped++;
      if (rule.noTerritory) declaredNoTerritory++; else unreviewed++;
      continue;
    }
    const matchedBy: RuleMatch[] = [];
    // `appliesTo` first, so a glob match stays at matchedBy[0] for existing consumers.
    for (const path of paths) {
      for (const pattern of rule.appliesTo) {
        if (globToRegExp(pattern).test(path)) matchedBy.push({ kind: "appliesTo", pattern, path });
      }
    }
    for (const path of paths) {
      for (const b of bindings) {
        if (b.path === path && rule.governs.includes(b.category)) {
          matchedBy.push({ kind: "category", category: b.category, path, via: b.via });
        }
      }
    }
    if (matchedBy.length) { matched.push({ rule, matchedBy }); continue; }
    // Nothing matched. Was every carrier resolvable? A declared category that nothing binds means
    // the question could not be asked — the honest state, and never a silent absence.
    // A rule degrades to `unresolved` as soon as ONE declared carrier could not be resolved —
    // including a mixed rule whose globs were checked but whose category was not. Naming what
    // could not be asked beats reporting a partial answer as a complete one (ADR-0040).
    if (rule.governs.some((c) => !boundCategories.has(c))) unresolved++;
    else evaluated++;
  }
  return { matched, unscoped, declaredNoTerritory, unreviewed, evaluated, unresolved, total: rules.length };
}

/** The territories that were evaluated, as declared — the distinct patterns across the rule set,
 *  sorted, plus how many rules declare one. Rendering this turns an empty answer from a silence
 *  into a fact: the reader sees the conventions the rule set actually looks for, finds none of
 *  them in their own layout, and concludes for themselves. runward never says "your layout follows
 *  no convention" — that would be an inference about a tree it has not read. It says what it
 *  looked for; the reading is the operator's (the `skipped_target` discipline: report the rejection
 *  with its reason, never a judgment). */
export function territoryVocabulary(rules: RuleInfo[]): { declaring: number; patterns: string[]; categories: string[] } {
  const patterns = new Set<string>();
  const categories = new Set<string>();
  let declaring = 0;
  for (const r of rules) {
    if (!r.appliesTo.length && !r.governs.length) continue;
    declaring++;
    for (const p of r.appliesTo) patterns.add(p);
    for (const c of r.governs) categories.add(c);
  }
  // Sorted by code unit, never localeCompare — the ordering is part of the byte-stable contract.
  return { declaring, patterns: [...patterns].sort(), categories: [...categories].sort() };
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

export interface CorpusStamp { name: string; version: string }

/**
 * A vendored org corpus (ADR-0057) self-describes with a committed `corpus.json` ({name, version})
 * beside its rules, so a run — and a fleet view built from it — can name which corpus the mission is
 * pinned to. In-tree, read-only, NO fetch: it never asks anything what version it should be at.
 * `null` when absent or malformed (the package corpus and a legacy mission carry no stamp).
 */
export function corpusStamp(dir: string): CorpusStamp | null {
  const path = join(dir, "corpus.json");
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { name?: unknown; version?: unknown };
    if (raw && typeof raw.name === "string" && typeof raw.version === "string") return { name: raw.name, version: raw.version };
  } catch { /* malformed → no stamp, never a crash */ }
  return null;
}

/**
 * COMPARE (ADR-0057): two IN-TREE stamps — the vendored corpus's own `runward/rules/corpus.json`
 * and the pin the scaffold-lock recorded when `update --corpus` last vendored it. When they disagree
 * the mission holds bytes of one version while the recorded pin names another ("forgot to re-vendor /
 * drifted"). This is reported, NEVER gated: both stamps live in the audited repo and are re-signable
 * together, so as a strict gap it would be exactly the re-signable floor ADR-0002 closed. `null` when
 * the two agree, or when either stamp is absent. Pure in-tree reads; runward asks nothing what its
 * version should be.
 */
export function corpusDrift(missionDir: string, rulesDirPath: string): { pinned: CorpusStamp; onDisk: CorpusStamp } | null {
  const onDisk = corpusStamp(rulesDirPath);
  const pinned = readScaffoldLock(missionDir)?.corpus ?? null;
  if (!onDisk || !pinned) return null;
  if (onDisk.name === pinned.name && onDisk.version === pinned.version) return null;
  return { pinned, onDisk };
}
