// Unit tests for the rule-set machine surface (ADR-0024).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { parseRule, ruleBody, readRuleSet, GATE_NON_SCOPE, matchRulesForPaths, normalizeForPath, territoryVocabulary, globToRegExp } from "../../dist/lib/rules.js";
import { execFileSync } from "node:child_process";
import { GATED_DELIVERABLES } from "../../dist/lib/conformance.js";
import { fileURLToPath } from "node:url";
const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "cli.js");

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
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
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
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
  // Either carrier contradicts `noTerritory` — a rule cannot both have and not have a territory.
  const contradictory = shipped.filter((r) => (r.appliesTo.length || r.governs.length) && r.noTerritory);
  assert.deepEqual(contradictory.map((r) => r.slug), []);
});

test("ADR-0043: the report partitions the rule set — a real sum, not a tautology", () => {
  // The assertion this replaces filtered on three predicates that were exhaustive BY CONSTRUCTION,
  // so it could never fail: it would have stayed green while a `governs:`-only rule was miscounted
  // as unreviewed. This one asserts the counters the command actually reports, against the total.
  const rules = [
    scoped("globbed", ["**/cron/**"]),
    parseRule("categorised", "---\ntitle: C\nimpact: HIGH\ngoverns: [background-work]\n---\nbody"),
    parseRule("both", "---\ntitle: B\nimpact: HIGH\nappliesTo: [**/x/**]\ngoverns: [startup]\n---\nbody"),
    parseRule("none", "---\ntitle: N\nimpact: LOW\nnoTerritory: governs a property of the system, not a class of files\n---\nbody"),
    unscoped("silent"),
  ];
  const bind = [{ path: "src/w.ts", category: "background-work",
    via: { source: "derived", adapter: "a", file: "m.jsonc", line: 1, declaration: "triggers.crons" } }];
  const r = matchRulesForPaths(rules, ["src/w.ts"], bind);
  assert.equal(r.matched.length + r.evaluated + r.unresolved + r.declaredNoTerritory + r.unreviewed, r.total,
    "the five states partition the rule set");
  assert.equal(r.matched.length, 1, "only the categorised rule matches this path");
  assert.equal(r.unresolved, 1, "`both` governs `startup`, which nothing binds — the question could not be asked");
  assert.equal(r.evaluated, 1, "`globbed` was fully resolvable and simply did not match");
  assert.equal(r.unscoped, r.declaredNoTerritory + r.unreviewed, "the v0.24.0 field keeps its arithmetic");
});

test("ADR-0043: a category match carries BOTH levels of its reason, and no fake pattern", () => {
  const rules = [parseRule("jobs", "---\ntitle: J\nimpact: HIGH\ngoverns: [background-work]\n---\nbody")];
  const via = { source: "derived", adapter: "cloudflare-workers", file: "wrangler.jsonc", line: 4, declaration: "triggers.crons" };
  const r = matchRulesForPaths(rules, ["src/entry.serve.ts"], [{ path: "src/entry.serve.ts", category: "background-work", via }]);
  const m = r.matched[0].matchedBy[0];
  assert.equal(m.kind, "category");
  assert.equal(m.category, "background-work");
  assert.deepEqual(m.via, via, "which file, which line, which declaration — the <source> half of check-ignore -v");
  assert.equal(m.pattern, undefined, "a pattern is a glob; emitting a fake one would repurpose an existing field");
});

test("ADR-0043: resolution is mission-wide, matching is per-path", () => {
  // A category bound to SOME file is resolved, even when the paths asked about are outside it.
  // Without this, a rule would read as "could not be asked" merely because of the question.
  const rules = [parseRule("jobs", "---\ntitle: J\nimpact: HIGH\ngoverns: [background-work]\n---\nbody")];
  const bind = [{ path: "src/other.ts", category: "background-work",
    via: { source: "derived", adapter: "a", file: "m", line: null, declaration: "d" } }];
  const r = matchRulesForPaths(rules, ["docs/readme.md"], bind);
  assert.equal(r.unresolved, 0, "the category is bound somewhere, so the question was askable");
  assert.equal(r.evaluated, 1, "it was asked, and the answer is no");
});

test("ADR-0043: with no binding at all, a categorised rule is unresolved — never silently absent", () => {
  const rules = [parseRule("jobs", "---\ntitle: J\nimpact: HIGH\ngoverns: [background-work]\n---\nbody")];
  const r = matchRulesForPaths(rules, ["src/entry.serve.ts"], []);
  assert.equal(r.matched.length, 0);
  assert.equal(r.unresolved, 1, "a missing binding is named, not counted as 'does not apply'");
  assert.equal(r.unscoped, 0, "and it is NOT unscoped: the rule did declare a territory");
});

test("ADR-0043: a glob match stays first in matchedBy, so existing consumers keep reading it", () => {
  const rules = [parseRule("both", "---\ntitle: B\nimpact: HIGH\nappliesTo: [**/cron/**]\ngoverns: [background-work]\n---\nbody")];
  const bind = [{ path: "src/cron/run.ts", category: "background-work",
    via: { source: "derived", adapter: "a", file: "m", line: null, declaration: "d" } }];
  const m = matchRulesForPaths(rules, ["src/cron/run.ts"], bind).matched[0].matchedBy;
  assert.equal(m[0].kind, "appliesTo", "the v0.24.0 positional read of matchedBy[0].pattern survives");
  assert.equal(m[1].kind, "category", "and the category reason is still rendered, second");
});

test("ADR-0041 amendment: every shipped rule is ruled on — silence is never a state", () => {
  // The 2026-07-31 editorial pass closed the backlog: all 64 rules either declare a territory or
  // declare, with a reason, that they have none. A rule added later must be ruled on too — this
  // assertion is what stops a new rule from silently re-opening the ambiguity the amendment closed.
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
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

test("ADR-0041: an empty answer renders what was looked for, as declared", () => {
  // A second field report (2026-07-31) ran --for on an entry-file layout and got nothing. The
  // answer was true and unreadable: it could not be told from "the rule set was never taught what
  // my files are". The vocabulary is the fact that makes it readable — runward states the patterns
  // it evaluated, never anything about the layout it has not read.
  const v = territoryVocabulary([
    parseRule("a", "---\ntitle: A\nimpact: HIGH\nappliesTo: [**/cron/**, **/jobs/**]\n---\nbody"),
    parseRule("b", "---\ntitle: B\nimpact: LOW\nappliesTo: [**/cron/**]\n---\nbody"),
    parseRule("c", "---\ntitle: C\nimpact: LOW\nnoTerritory: governs a property, not a class of files, and it is stated here\n---\nbody"),
  ]);
  assert.equal(v.declaring, 2, "only rules declaring a territory are counted");
  assert.deepEqual(v.patterns, ["**/cron/**", "**/jobs/**"], "distinct patterns, sorted by code unit, deduplicated");

  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
  const real = territoryVocabulary(shipped);
  assert.equal(real.declaring, shipped.filter((r) => r.appliesTo.length).length);
  assert.ok(real.patterns.includes("**/cron/**"), "the shipped vocabulary is the real one, not a sample");
  assert.deepEqual(real.patterns, [...real.patterns].sort(), "deterministic order");
});

test("ADR-0041: a directory territory that doubles singular/plural does it consistently", () => {
  // A second field report (2026-07-31) measured `services/worker/index.ts` → 0 while
  // `services/workers/index.ts` → 1: an `s` separated a match from silence. The corpus doubles
  // elsewhere (migrations/migration, providers/provider); `workers` had lost its twin when the
  // editorial pass dropped it as "a redundant singular variant". It was not redundant.
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
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
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
  const seeded = shipped.filter((r) => r.appliesTo.length);
  assert.ok(seeded.length >= 4, `expected >= 4 seeded territories, got ${seeded.length}`);
  const hit = matchRulesForPaths(shipped, ["src/cron/graduation-runner.ts", "src/config/egress-key.ts"]);
  const slugs = hit.matched.map((m) => m.rule.slug);
  assert.ok(slugs.includes("async-job-guardrails"), "the HIGH rule missed in the field is surfaced");
  assert.ok(slugs.includes("config-secrets-boundary"), "the CRITICAL rule missed in the field is surfaced");
  for (const m of hit.matched) assert.ok(m.matchedBy[0].pattern, "every match renders its pattern");
});

test("ADR-0040: the seeded rules carry a nonScope narrower than the default", () => {
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
  const seeded = shipped.filter((r) => r.nonScope);
  assert.ok(seeded.length >= 4, `expected >= 4 seeded rules, got ${seeded.length}`);
  assert.ok(seeded.some((r) => r.slug === "frontier-deterministic-boundary"), "the flagship signed rule declares its blind zone");
  for (const r of seeded) assert.ok(r.nonScope.length > 40, `nonScope on ${r.slug} is too thin to inform an assessor`);
});

test("ADR-0041: `*` stops at a path separator, `**` is what crosses directories", () => {
  // Found by mutation: replacing `[^/]*` with `.*` in globToRegExp survived the whole suite. The
  // consequence is not cosmetic -- a territory would silently be WIDER than declared, so a rule
  // would surface on files it does not govern. A signal that arrives with noise stops being read,
  // which is the failure mode this mechanism exists to avoid.
  const m = (glob, path) => globToRegExp(glob).test(path);
  assert.equal(m("src/*.ts", "src/a.ts"), true, "one segment: matches");
  assert.equal(m("src/*.ts", "src/nested/a.ts"), false, "`*` must NOT cross a separator");
  assert.equal(m("src/**/*.ts", "src/nested/a.ts"), true, "`**` is the one that crosses");
  assert.equal(m("src/**/*.ts", "src/deep/deeper/a.ts"), true, "and it crosses more than one level");
  assert.equal(m("**/jobs/**", "app/jobs/x.ts"), true, "the shipped rule shape still matches");
  assert.equal(m("**/jobs/**", "app/jobsy/x.ts"), false, "and does not bleed onto a longer segment");
  // `?` has the same boundary, for the same reason.
  assert.equal(m("src/?.ts", "src/a.ts"), true);
  assert.equal(m("src/?.ts", "src//.ts"), false, "`?` must not match a separator either");
});

test("ADR-0024: the envelope publishes the gated phases, so a consumer never re-lists them", () => {
  // A consumer that restates which phases a gate can require drifts the day one is added. The
  // published rule catalog did exactly that on 2026-08-01: it hard-coded four phases, omitted
  // `handover`, and understated the gate by four rules (one of them CRITICAL) in the very
  // paragraph correcting an earlier overclaim. The envelope now carries the fact.
  const out = execFileSync(process.execPath, [CLI, "rules", "--json"], { encoding: "utf8" });
  const env = JSON.parse(out);
  assert.ok(Array.isArray(env.gatedPhases), "gatedPhases is published");
  assert.deepEqual(env.gatedPhases, [...new Set(GATED_DELIVERABLES.map((g) => g.phase))].sort(),
    "and it IS the gated deliverables' phases, not a copy that can drift from them");
  // Every phase a rule declares must be gated: if that ever stops holding, a consumer computing
  // "requirable rules" from gatedPhases would silently drop rules, which is the failure above.
  const declared = [...new Set(env.rules.flatMap((r) => r.phases))].sort();
  assert.deepEqual(declared.filter((p) => !env.gatedPhases.includes(p)), [],
    "no rule declares a phase the gate cannot require");
});

test("ADR-0009 amendment: every CRITICAL/HIGH rule is ruled on — silence is never a state", () => {
  // The audit of 2026-08-14 found 19 of 45 CRITICAL/HIGH rules carrying no `asi:` while the README
  // and the OSCAL spec sold the mapping as a property of the chain. Completing all 19 would have
  // manufactured false coverage (ASI is an ATTACK taxonomy; hexagonal layering has no honest
  // category in it), so the rule is the ADR-0041 shape: a category, or a written reason there is
  // none. This guard makes the third state — silence — impossible.
  const shipped = readRuleSet(fileURLToPath(new URL("../../templates/rules/", import.meta.url)));
  const gated = shipped.filter((r) => r.impact === "CRITICAL" || r.impact === "HIGH");
  assert.ok(gated.length >= 40, `expected the shipped CRITICAL/HIGH slice, got ${gated.length}`);
  const silent = gated.filter((r) => r.asi.length === 0 && !r.noAsi);
  assert.deepEqual(silent.map((r) => r.slug), [], "a CRITICAL/HIGH rule must carry `asi:` or a `noAsi:` reason");
  // A declared absence must be a sentence, not a shrug — the same bar `noTerritory` sets.
  for (const r of gated.filter((x) => x.noAsi)) {
    assert.ok(r.noAsi.trim().length >= 40, `${r.slug}: the noAsi reason must argue, not merely exist`);
    assert.equal(r.asi.length, 0, `${r.slug}: a rule cannot both map to ASI and declare it has none`);
  }
  // And the mapped side stays exact: only ASI01..ASI10, never an invented code.
  for (const r of gated) for (const a of r.asi) assert.match(a, /^ASI(0[1-9]|10)$/, `${r.slug}: ${a} is not an ASI code`);
});
