// Where the rule set comes from, what it claims to be, and the two positional guards of the glob
// dialect — the four decisions of `src/lib/rules.ts` that no test reached.
//
// Measured 2026-08-08 against the 346-test suite: nine mutants of these functions survive it whole.
// None of them changes a green mission into a green mission by accident; what they change is the
// SURFACE the operator and the agent read.
//
//   · `ruleSetDir` decides which directory of .md files IS the rule set, and labels its provenance.
//     Made to always read the package, a mission carrying its own CRITICAL house rule reports
//     "45 of 45 CRITICAL/HIGH rules" instead of 46, and `rules --json` returns 64 rules with the
//     house rule silently absent — exit code 0 either way, and nothing else in the gate notices:
//     `corpusDivergence` accepts an ADDED rule file (a house rule is legitimate), so there is no
//     second mechanism here. Made to always label the answer "mission" (or "package"), the
//     provenance field of the ADR-0024 envelope states the opposite of the directory it just read.
//   · `readRuleSet` and `parseRule` decide what a malformed or absent rule set does. Dropping the
//     optional chain in `parseRule` turns one hand-written .md with no frontmatter — the most
//     ordinary thing an operator drops into `runward/rules/` — into `Cannot read properties of
//     null`, which takes `check --strict` from exit 0 to a crash and `rules --json` with it.
//   · `globToRegExp` decides how wide a declared territory is. `**/` is a LEADING construct and
//     `/**` a TRAILING one; remove either positional guard and the same tokens keep their wide
//     meaning in the middle of a pattern, so `src/**/*.ts` starts retaining `src/a.ts`. A territory
//     wider than declared surfaces rules on files they do not govern, which is the noise that
//     stops a signal from being read.
//
// Every guard below is exercised in BOTH directions: a function that always answers "package", or a
// matcher that always widens, passes a one-sided fixture just as well as a correct one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ruleSetDir, readRuleSet, parseRule, globToRegExp } from "../../dist/lib/rules.js";
import { TEMPLATES } from "../../dist/lib/paths.js";

const PACKAGE_RULES = join(TEMPLATES, "rules");

/** A mission directory, with or without a rule set of its own. */
function missionDir(withRules) {
  const home = mkdtempSync(join(tmpdir(), "rw-ruleset-"));
  const mission = join(home, "runward");
  mkdirSync(mission, { recursive: true });
  if (withRules) {
    mkdirSync(join(mission, "rules"));
    writeFileSync(join(mission, "rules", "house-rule.md"),
      "---\ntitle: House Rule\nimpact: CRITICAL\nphases: [floor]\n---\n\nOurs.\n");
  }
  return { mission, drop: () => rmSync(home, { recursive: true, force: true }) };
}

// ── Which directory IS the rule set, and what the answer claims to be ────────────────────────────

test("a mission's own rule set is the one the gate reads, and `source` says mission — never the package's", () => {
  // The dangerous direction is silent substitution: read the package while a mission carries its
  // own copy, and the mission's house rules stop existing for `check --strict`'s critical-scope
  // reading and for every consumer of `rules --json`. Nothing else catches it — an added rule file
  // is not corpus divergence, and the exit code stays 0.
  const m = missionDir(true);
  try {
    const got = ruleSetDir(m.mission);
    assert.equal(got.dir, join(m.mission, "rules"), "the mission's copy is the effective set");
    assert.notEqual(got.dir, PACKAGE_RULES, "and it is NOT the package's");
    assert.equal(got.source, "mission", "provenance names the directory actually read");
    assert.equal(readRuleSet(got.dir).map((r) => r.slug).join(","), "house-rule",
      "the set really is the mission's: its house rule is in it");
  } finally { m.drop(); }
});

test("a mission with no rule set of its own falls back to the package, and `source` says package", () => {
  // The other direction of the same guard. A label that always says "mission" makes a fallback
  // indistinguishable from a mission that reviewed and kept its own corpus.
  const m = missionDir(false);
  try {
    const got = ruleSetDir(m.mission);
    assert.equal(got.dir, PACKAGE_RULES, "no local copy: the package set is the effective one");
    assert.equal(got.source, "package", "and provenance says so, rather than claiming a copy that is not there");
  } finally { m.drop(); }
});

test("asking outside any mission answers the package set instead of throwing", () => {
  // `runward rules` outside a mission passes null here. Treating null as a mission directory makes
  // the command die on `join(null, "rules")` — exit 1 with a TypeError where the contract is exit 0
  // and an envelope.
  assert.deepEqual(ruleSetDir(null), { dir: PACKAGE_RULES, source: "package" });
});

// ── What an absent or malformed rule set does ────────────────────────────────────────────────────

test("a rule directory that is not there reads as an empty set, and one that is there reads its rules", () => {
  // Both directions of the guard: the empty answer must come from the directory being absent, not
  // from the reader being blind.
  const home = mkdtempSync(join(tmpdir(), "rw-ruleset-"));
  try {
    assert.deepEqual(readRuleSet(join(home, "nowhere")), [], "absent directory: empty set, never a throw");
    const dir = join(home, "rules");
    mkdirSync(dir);
    writeFileSync(join(dir, "b-rule.md"), "---\ntitle: B\nimpact: HIGH\n---\n\nbody\n");
    writeFileSync(join(dir, "a-rule.md"), "---\ntitle: A\nimpact: CRITICAL\n---\n\nbody\n");
    assert.deepEqual(readRuleSet(dir).map((r) => r.slug), ["a-rule", "b-rule"], "present directory: its rules, sorted");
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("a rule file with no frontmatter degrades to its defaults — it never takes the reader down with it", () => {
  // A hand-written note in `runward/rules/` has no frontmatter. Reading it must yield an
  // impoverished RuleInfo, not an exception: the exception propagates out of `readRuleSet` into
  // `computeVerdict`, and a mission that was exit 0 becomes a crash with no report at all.
  const bare = parseRule("house-note", "# House note\n\nNo frontmatter here.\n");
  assert.equal(bare.title, "house-note", "title falls back to the slug");
  assert.equal(bare.impact, "", "no impact declared");
  assert.deepEqual(bare.phases, [], "no phases declared");
  assert.equal(bare.signature, null);
  // The other direction: when the frontmatter IS there, the fields are read rather than defaulted.
  const full = parseRule("real-rule", "---\ntitle: Real\nimpact: CRITICAL\nphases: [floor]\n---\n\nbody\n");
  assert.equal(full.title, "Real");
  assert.equal(full.impact, "CRITICAL");
  assert.deepEqual(full.phases, ["floor"]);
});

test("one frontmatter-less file in the rule directory does not cost the whole inventory", () => {
  // The path a real mission takes: `readRuleSet` over a directory holding both.
  const home = mkdtempSync(join(tmpdir(), "rw-ruleset-"));
  const dir = join(home, "rules");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a-rule.md"), "---\ntitle: A\nimpact: CRITICAL\n---\n\nbody\n");
  writeFileSync(join(dir, "z-note.md"), "# Just a note\n\nNo frontmatter.\n");
  try {
    const set = readRuleSet(dir);
    assert.deepEqual(set.map((r) => r.slug), ["a-rule", "z-note"], "both files are inventoried");
    assert.equal(set[0].impact, "CRITICAL", "the well-formed rule keeps its fields");
    assert.equal(set[1].impact, "", "the note degrades instead of throwing");
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── The two positional guards of the glob dialect (ADR-0041) ─────────────────────────────────────

const m = (glob, path) => globToRegExp(glob).test(path);

test("`**/` means leading segments, and only at the start — mid-pattern it must not swallow a segment", () => {
  // GLOB_DIALECT declares `**/` as "zero or more LEADING segments". Drop the `i === 0` guard and the
  // same three characters keep that meaning anywhere in the pattern, so the intervening directory a
  // rule author wrote becomes optional and the territory is silently WIDER than declared.
  // Isolated on purpose: in `a**/b` the `**/` is not preceded by a separator, so the neighbouring
  // `/**` guard cannot fire and this case can red for exactly one reason.
  assert.equal(m("a**/b", "a/x/b"), true, "mid-pattern `**` still crosses directories, as `**` always does");
  assert.equal(m("a**/b", "ab"), false, "but it is NOT the leading form: the separator it wrote is required");
  // The leading form itself keeps working, in both directions.
  assert.equal(m("**/jobs/**", "jobs/run.ts"), true, "at position 0, zero leading segments is a match");
  assert.equal(m("**/jobs/**", "src/app/jobs/run.ts"), true, "and so is any number of them");
  assert.equal(m("**/jobs/**", "src/jobsy/run.ts"), false, "and it still does not bleed onto a longer segment");
});

test("`/**` means the directory and all under it, and only at the end — mid-pattern it must not become optional", () => {
  // The trailing form `dir/**` matches the directory itself, which is why it expands to an OPTIONAL
  // group. Drop the `i + 3 === glob.length` guard and that optionality applies mid-pattern too:
  // `app/**/x` starts retaining `app/x`. Isolated: in `a/**b` the `**` is not followed by a
  // separator, so the neighbouring `**/` guard cannot fire.
  assert.equal(m("a/**b", "a/xb"), true, "mid-pattern `**` still matches a run of characters");
  assert.equal(m("a/**b", "ab"), false, "but the separator is not optional away from the end");
  // The trailing form itself keeps working, in both directions.
  assert.equal(m("src/**", "src"), true, "at the end, the directory itself matches");
  assert.equal(m("src/**", "src/deep/a.ts"), true, "and everything under it");
  assert.equal(m("src/**", "srcx"), false, "and nothing that merely starts with the same letters");
});

test("a mid-pattern territory is exactly as wide as it was written: `src/**/*.ts` is not `src/*.ts`", () => {
  // The shape a mission actually writes, where BOTH positional guards are in play. Either one
  // removed retains a file the rule does not govern.
  assert.equal(m("src/**/*.ts", "src/nested/a.ts"), true, "what the pattern declares");
  assert.equal(m("src/**/*.ts", "src/deep/deeper/a.ts"), true, "at any depth");
  assert.equal(m("src/**/*.ts", "src/a.ts"), false, "but not the file sitting directly in src/");
});
