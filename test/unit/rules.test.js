// Unit tests for the rule-set machine surface (ADR-0024).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRule, ruleBody, readRuleSet, GATE_NON_SCOPE, matchRulesForPaths, normalizeForPath } from "../../dist/lib/rules.js";

const RULE = `---
title: Sample Rule
impact: HIGH
asi: [ASI02, asi07, bogus]
phases: [floor, govern]
signature: assertSomething|fail[-\\s]?closed
impactDescription: Why this matters in one line
tags: [a, b]
---

## Sample Rule

The body.
`;

test("parseRule reads the full frontmatter shape", () => {
  const r = parseRule("sample-rule", RULE);
  assert.equal(r.title, "Sample Rule");
  assert.equal(r.impact, "HIGH");
  assert.deepEqual(r.phases, ["floor", "govern"]);
  assert.deepEqual(r.asi, ["ASI02", "ASI07"]); // normalized, bogus dropped
  assert.equal(r.signature, "assertSomething|fail[-\\s]?closed");
  assert.equal(r.why, "Why this matters in one line");
  assert.equal(ruleBody(RULE).startsWith("## Sample Rule"), true);
});

test("readRuleSet is deterministic and sorted by slug; missing fields degrade gracefully", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-rules-"));
  try {
    writeFileSync(join(dir, "zz-last.md"), RULE);
    writeFileSync(join(dir, "aa-first.md"), "---\nimpact: LOW\n---\n\nBody only.\n");
    const set1 = readRuleSet(dir);
    const set2 = readRuleSet(dir);
    assert.deepEqual(set1, set2);
    assert.deepEqual(set1.map((r) => r.slug), ["aa-first", "zz-last"]);
    assert.equal(set1[0].title, "aa-first"); // slug fallback when no title
    assert.equal(set1[0].signature, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the shipped rule set parses cleanly through the same surface", () => {
  // The package rules are the real data behind rules --json: every rule must carry the contract fields.
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  assert.ok(shipped.length >= 60);
  for (const r of shipped) {
    assert.ok(r.slug && r.title && r.impact, `rule ${r.slug} misses a contract field`);
  }
  const signed = shipped.filter((r) => r.signature);
  assert.ok(signed.some((r) => r.slug === "frontier-deterministic-boundary"), "the flagship signed rule is present");
  for (const r of signed) assert.doesNotThrow(() => new RegExp(r.signature, "i"), `invalid signature regex on ${r.slug}`);
});

test("ADR-0040: nonScope parses when declared, stays null otherwise, and the gate-wide default is non-empty", () => {
  const withField = parseRule("x", "---\ntitle: X\nimpact: HIGH\nnonScope: proves the shape, not the wiring\n---\nbody");
  assert.equal(withField.nonScope, "proves the shape, not the wiring");
  const without = parseRule("y", "---\ntitle: Y\nimpact: LOW\n---\nbody");
  assert.equal(without.nonScope, null);
  assert.ok(GATE_NON_SCOPE.length > 100, "the gate-wide non-scope is a real statement, not a stub");
  assert.match(GATE_NON_SCOPE, /never proves|does not execute/i);
});

test("ADR-0040: the gate-wide non-scope declares the TEMPORAL blind zone, not only the depth one", () => {
  // Born from the Dropyour field report (2026-07-31): two mapped rules were violated by code written
  // after the crossing, gate green throughout. The depth blind zone (a green row never proves the
  // evidence implements the rule) was declared; the temporal one (the operator's judgment was made
  // about the code that existed then, and nothing re-judges code added later) was not — ADR-0040 in
  // default of its own standard, "every gate names what it cannot verify".
  assert.match(GATE_NON_SCOPE, /never proves|does not execute/i, "the depth blind zone stays declared");
  assert.match(GATE_NON_SCOPE, /added later|forward in time/i, "the temporal blind zone is declared");
  assert.match(GATE_NON_SCOPE, /point of action/i, "and it names the operator's counter-gesture");
});

// ── ADR-0041: territory matching (`rules --for`) ──
// The primitive answers "which rules govern these files" from a territory the rule DECLARES.
// Its value rests entirely on the answer being a fact with a rendered reason, so these tests
// pin the reason, the determinism and the honesty of the empty case — not just the happy path.

const scoped = (slug, globs) => parseRule(slug, `---\ntitle: ${slug}\nimpact: HIGH\nappliesTo: [${globs.join(", ")}]\n---\nbody`);
const unscoped = (slug) => parseRule(slug, `---\ntitle: ${slug}\nimpact: LOW\n---\nbody`);

test("ADR-0041: a match names the pattern that retained the path (the check-ignore model)", () => {
  const rules = [scoped("jobs", ["**/cron/**"]), unscoped("other")];
  const r = matchRulesForPaths(rules, ["src/cron/runner.ts"]);
  assert.equal(r.matched.length, 1);
  assert.deepEqual(r.matched[0].matchedBy, [{ kind: "appliesTo", pattern: "**/cron/**", path: "src/cron/runner.ts" }]);
});

test("ADR-0041: the glob dialect matches a segment, never a prefix of one", () => {
  const rules = [scoped("jobs", ["**/cron/**"])];
  // The directory itself and anything under it, at the root or nested…
  for (const p of ["cron/run.ts", "src/cron/run.ts", "a/b/cron/x/y.ts", "cron"]) {
    assert.equal(matchRulesForPaths(rules, [p]).matched.length, 1, `${p} should match`);
  }
  // …but never a file that merely starts with the segment's name.
  for (const p of ["src/cronjob.ts", "src/crontab", "notcron/x.ts"]) {
    assert.equal(matchRulesForPaths(rules, [p]).matched.length, 0, `${p} must not match`);
  }
});

test("ADR-0041: unscoped rules are counted, never silently dropped", () => {
  const rules = [scoped("jobs", ["**/cron/**"]), unscoped("a"), unscoped("b")];
  const r = matchRulesForPaths(rules, ["docs/readme.md"]);
  assert.equal(r.matched.length, 0, "no territory covers this path");
  assert.equal(r.unscoped, 2, "the two territory-less rules are reported as not evaluated");
  assert.equal(r.total, 3);
});

test("ADR-0041 amendment: a declared absence of territory is not the same as silence", () => {
  // Silence is not a declaration (the ADR-0040 lesson, one level down): without this split, a rule
  // nobody has ruled on and a rule that deliberately governs no file class read identically.
  const declared = parseRule("everywhere", "---\ntitle: X\nimpact: HIGH\nnoTerritory: constrains every entry point of untrusted content, not a class of files\n---\nbody");
  assert.equal(declared.noTerritory, "constrains every entry point of untrusted content, not a class of files");
  assert.deepEqual(declared.appliesTo, []);

  const r = matchRulesForPaths([scoped("jobs", ["**/cron/**"]), declared, unscoped("nobody-looked")], ["docs/x.md"]);
  assert.equal(r.unscoped, 2, "both carry no territory (the v0.24.0 field keeps its meaning)");
  assert.equal(r.declaredNoTerritory, 1, "one of them decided it has none");
  assert.equal(r.unreviewed, 1, "the other is simply unreviewed — the backlog");
});

test("ADR-0041 amendment: no shipped rule both declares a territory and declares it has none", () => {
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  const contradictory = shipped.filter((r) => r.appliesTo.length && r.noTerritory);
  assert.deepEqual(contradictory.map((r) => r.slug), [], "a rule cannot both have and not have a territory");
  // Every rule is in exactly one of the three states, so the counts always partition the set.
  const declared = shipped.filter((r) => !r.appliesTo.length && r.noTerritory).length;
  const unreviewedCount = shipped.filter((r) => !r.appliesTo.length && !r.noTerritory).length;
  const scopedCount = shipped.filter((r) => r.appliesTo.length).length;
  assert.equal(scopedCount + declared + unreviewedCount, shipped.length, "the three states partition the rule set");
});

test("ADR-0041 amendment: every shipped rule is ruled on — silence is never a state", () => {
  // The 2026-07-31 editorial pass closed the backlog: all 64 rules either declare a territory or
  // declare, with a reason, that they have none. A rule added later must be ruled on too — this
  // assertion is what stops a new rule from silently re-opening the ambiguity the amendment closed.
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  const unreviewed = shipped.filter((r) => !r.appliesTo.length && !r.noTerritory).map((r) => r.slug);
  assert.deepEqual(unreviewed, [],
    "a new rule must declare `appliesTo:` or `noTerritory:` — saying nothing is not a scope, it is an omission");
  assert.ok(shipped.filter((r) => r.appliesTo.length).length >= 14, "the declared-territory set does not shrink silently");
  for (const r of shipped.filter((r) => r.noTerritory)) {
    assert.ok(r.noTerritory.length > 40, `noTerritory on ${r.slug} is too thin to be a reason`);
  }
});

test("ADR-0041: deterministic — same input, same bytes; order is the rule set's, never a ranking", () => {
  const rules = [scoped("aaa", ["**/x/**"]), scoped("mmm", ["**/x/**", "**/y/**"]), scoped("zzz", ["**/x/**"])];
  const a = matchRulesForPaths(rules, ["x/1.ts", "y/2.ts"]);
  const b = matchRulesForPaths(rules, ["x/1.ts", "y/2.ts"]);
  assert.equal(JSON.stringify(a), JSON.stringify(b), "byte-identical across runs");
  assert.deepEqual(a.matched.map((m) => m.rule.slug), ["aaa", "mmm", "zzz"],
    "sorted by slug as the rule set is — the rule matching twice is not promoted");
});

test("ADR-0041: paths are normalised cross-OS; absolute paths and escapes cannot be asked about", () => {
  assert.equal(normalizeForPath("src\\cron\\run.ts"), "src/cron/run.ts", "Windows separators give the same answer");
  assert.equal(normalizeForPath("./src/a.ts"), "src/a.ts");
  assert.equal(normalizeForPath("/etc/passwd"), null, "absolute path: not project-relative");
  assert.equal(normalizeForPath("C:/Windows/x"), null, "Windows absolute path: not project-relative");
  assert.equal(normalizeForPath("../outside/x.ts"), null, "escaping the project is refused");
  assert.equal(normalizeForPath("   "), null);
});

test("ADR-0041: a directory territory that doubles singular/plural does it consistently", () => {
  // A second field report (2026-07-31) measured `services/worker/index.ts` → 0 while
  // `services/workers/index.ts` → 1: an `s` separated a match from silence. The corpus doubles
  // elsewhere (migrations/migration, providers/provider); `workers` had lost its twin when the
  // editorial pass dropped it as "a redundant singular variant". It was not redundant.
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  const jobs = shipped.find((r) => r.slug === "async-job-guardrails");
  for (const p of ["services/worker/index.ts", "services/workers/index.ts", "src/worker/run.ts"]) {
    assert.equal(matchRulesForPaths([jobs], [p]).matched.length, 1, `${p} must reach the background-job rule`);
  }
  // The doubled pairs the corpus already ships, asserted as a set so a new one is added on purpose.
  const dirs = new Set(shipped.flatMap((r) => r.appliesTo).map((g) => /^\*\*\/([a-z-]+)\/\*\*$/.exec(g)?.[1]).filter(Boolean));
  for (const [a, b] of [["migrations", "migration"], ["providers", "provider"], ["workers", "worker"]]) {
    assert.ok(dirs.has(a) && dirs.has(b), `${a}/${b} are doubled — dropping either makes an "s" decide the match`);
  }
});

test("ADR-0041: the seeded rules cover the field-report case that motivated the ADR", () => {
  // 2026-07-31: a cron rewrite and a secret relay passed the gate green with both rules unread.
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  const seeded = shipped.filter((r) => r.appliesTo.length);
  assert.ok(seeded.length >= 4, `expected >= 4 seeded territories, got ${seeded.length}`);
  const hit = matchRulesForPaths(shipped, ["src/cron/graduation-runner.ts", "src/config/egress-key.ts"]);
  const slugs = hit.matched.map((m) => m.rule.slug);
  assert.ok(slugs.includes("async-job-guardrails"), "the HIGH rule missed in the field is surfaced");
  assert.ok(slugs.includes("config-secrets-boundary"), "the CRITICAL rule missed in the field is surfaced");
  for (const m of hit.matched) assert.ok(m.matchedBy[0].pattern, "every match renders its pattern");
});

test("ADR-0040: the seeded rules carry a nonScope narrower than the default", () => {
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  const seeded = shipped.filter((r) => r.nonScope);
  assert.ok(seeded.length >= 4, `expected >= 4 seeded rules, got ${seeded.length}`);
  assert.ok(seeded.some((r) => r.slug === "frontier-deterministic-boundary"), "the flagship signed rule declares its blind zone");
  for (const r of seeded) assert.ok(r.nonScope.length > 40, `nonScope on ${r.slug} is too thin to inform an assessor`);
});
