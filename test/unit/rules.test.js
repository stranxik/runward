// Unit tests for the rule-set machine surface (ADR-0024).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRule, ruleBody, readRuleSet, GATE_NON_SCOPE } from "../../dist/lib/rules.js";

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

test("ADR-0040: the seeded rules carry a nonScope narrower than the default", () => {
  const shipped = readRuleSet(new URL("../../templates/rules/", import.meta.url).pathname);
  const seeded = shipped.filter((r) => r.nonScope);
  assert.ok(seeded.length >= 4, `expected >= 4 seeded rules, got ${seeded.length}`);
  assert.ok(seeded.some((r) => r.slug === "frontier-deterministic-boundary"), "the flagship signed rule declares its blind zone");
  for (const r of seeded) assert.ok(r.nonScope.length > 40, `nonScope on ${r.slug} is too thin to inform an assessor`);
});
