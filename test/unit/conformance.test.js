// Unit tests for the gate core (dist/lib/conformance.js), against real files in temp dirs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseManifest, conformance, driftReport,
  expectedRules, allRules, unratifiedAdrs, decisionCoverage,
} from "../../dist/lib/conformance.js";

// "custom" is absent from EXPECTED_MAPPED, so the non-vacuity floor stays out of these cases.
const PHASE = "custom";

function ruleFile(dir, slug, { impact = "CRITICAL", phases = PHASE } = {}) {
  writeFileSync(join(dir, "rules", `${slug}.md`), `---
title: ${slug}
impact: ${impact}
asi: [ASI01]
phases: [${phases}]
---

Body.
`);
}

function makeMission(slugs = ["rule-a"], opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "runward-conf-"));
  mkdirSync(join(dir, "rules"), { recursive: true });
  for (const s of slugs) ruleFile(dir, s, opts);
  return dir;
}

function manifest(rows) {
  return [
    "# Deliverable", "",
    "## Rule conformance", "",
    "| Rule | Status | Evidence |",
    "|---|---|---|",
    ...rows, "",
    "## Next section", "",
    "| rule-after-section | applied | src/after.ts:1 |", "",
  ].join("\n");
}

// ── parseManifest ──────────────────────────────────────────────────

test("parseManifest: simple table, statuses lowercased, header and separator ignored", () => {
  const rows = parseManifest(manifest([
    "| rule-a | Applied | src/x.ts:1 |",
    "| rule-b | n/a | not a service |",
  ]));
  assert.deepEqual(rows, [
    { rule: "rule-a", status: "applied", evidence: "src/x.ts:1" },
    { rule: "rule-b", status: "n/a", evidence: "not a service" },
  ]);
});

test("parseManifest: no Rule conformance section returns an empty array", () => {
  assert.deepEqual(parseManifest("# Doc\n\n| rule-a | applied | src/x.ts |\n"), []);
});

test("parseManifest: backticks are stripped from every column", () => {
  const rows = parseManifest(manifest(["| `rule-a` | `applied` | `src/x.ts:1` |"]));
  assert.deepEqual(rows, [{ rule: "rule-a", status: "applied", evidence: "src/x.ts:1" }]);
});

test("parseManifest: a pipe inside the evidence is rejoined, not truncated", () => {
  const rows = parseManifest(manifest(["| rule-a | n/a | uses the union a | b instead |"]));
  assert.equal(rows[0].evidence, "uses the union a | b instead");
});

test("parseManifest: a [rule-slug] placeholder row is returned as-is", () => {
  const rows = parseManifest(manifest(["| [rule-slug] | applied | [file:line] |"]));
  assert.deepEqual(rows, [{ rule: "[rule-slug]", status: "applied", evidence: "[file:line]" }]);
});

test("parseManifest: parsing stops at the next ## section", () => {
  const rows = parseManifest(manifest(["| rule-a | applied | src/x.ts:1 |"]));
  assert.equal(rows.length, 1);
  assert.ok(!rows.some((r) => r.rule === "rule-after-section"));
});

// ── expectedRules / allRules ───────────────────────────────────────

test("expectedRules: only CRITICAL/HIGH rules mapped to the phase, sorted", () => {
  const dir = makeMission([]);
  try {
    ruleFile(dir, "z-crit");
    ruleFile(dir, "a-high", { impact: "HIGH" });
    ruleFile(dir, "b-medium", { impact: "MEDIUM" });
    ruleFile(dir, "c-other-phase", { phases: "elsewhere" });
    assert.deepEqual(expectedRules(dir, PHASE), ["a-high", "z-crit"]);
    assert.deepEqual(allRules(dir).sort(), ["a-high", "b-medium", "c-other-phase", "z-crit"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── conformance ────────────────────────────────────────────────────

function check(dir, rows) {
  writeFileSync(join(dir, "floor.md"), manifest(rows));
  return conformance(dir, PHASE, "floor.md");
}

test("conformance: applied without evidence is a violation", () => {
  const dir = makeMission();
  try {
    const { violations } = check(dir, ["| rule-a | applied |  |"]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /applied without an evidence pointer/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: deviated without a matching ADR is a violation", () => {
  const dir = makeMission();
  try {
    const { violations } = check(dir, ["| rule-a | deviated | ADR-7 |"]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /no matching ADR/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: ADR-1 is not satisfied by ADR-10 (digit boundary)", () => {
  const dir = makeMission();
  try {
    mkdirSync(join(dir, "adr"));
    writeFileSync(join(dir, "adr", "ADR-10-other.md"), "# Other\n");
    let { violations } = check(dir, ["| rule-a | deviated | ADR-1 |"]);
    assert.equal(violations.length, 1);
    writeFileSync(join(dir, "adr", "ADR-1-real.md"), "# Real\n");
    ({ violations } = check(dir, ["| rule-a | deviated | ADR-1 |"]));
    assert.deepEqual(violations, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: n/a with a short or placeholder reason is a violation, a real one passes", () => {
  const dir = makeMission();
  try {
    assert.equal(check(dir, ["| rule-a | n/a | short |"]).violations.length, 1);
    assert.equal(check(dir, ["| rule-a | n/a | [one-line reason] |"]).violations.length, 1);
    assert.deepEqual(check(dir, ["| rule-a | n/a | single-process CLI, no queue here |"]).violations, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: an invalid status is a violation", () => {
  const dir = makeMission();
  try {
    const { violations } = check(dir, ["| rule-a | maybe | src/x.ts:1 |"]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /invalid status "maybe"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: an unknown rule is a violation, a [placeholder] row is not", () => {
  const dir = makeMission();
  try {
    const { violations } = check(dir, [
      "| rule-a | applied | src/x.ts:1 |",
      "| totally-unknown-rule | applied | src/x.ts:1 |",
      "| [rule-slug] | applied | [file:line] |",
    ]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, "totally-unknown-rule");
    assert.match(violations[0].problem, /unknown rule/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: a duplicated rule row is a violation", () => {
  const dir = makeMission();
  try {
    const { violations } = check(dir, [
      "| rule-a | applied | src/x.ts:1 |",
      "| rule-a | applied | src/y.ts:2 |",
    ]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /listed 2 times/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: a stripped mapping below the pinned floor yields a (mapping) violation", () => {
  const dir = makeMission(["only-one"], { phases: "architect" });
  try {
    writeFileSync(join(dir, "floor.md"), manifest(["| only-one | applied | src/x.ts:1 |"]));
    const { expected, violations } = conformance(dir, "architect", "floor.md");
    assert.deepEqual(expected, ["only-one"]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, "(mapping)");
    assert.match(violations[0].problem, /floor is 6/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: a missing deliverable yields one violation per expected rule", () => {
  const dir = makeMission(["rule-a", "rule-b"]);
  try {
    const { expected, violations } = conformance(dir, PHASE, "absent.md");
    assert.equal(expected.length, 2);
    assert.equal(violations.length, 2);
    assert.ok(violations.every((v) => v.problem === "absent.md missing"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: an expected rule absent from the manifest is a violation", () => {
  const dir = makeMission();
  try {
    const { violations } = check(dir, []);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /not accounted for/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── driftReport ────────────────────────────────────────────────────

test("driftReport: an applied pointer with an unresolvable path is drift", () => {
  const dir = makeMission();
  try {
    writeFileSync(join(dir, "floor.md"), manifest(["| rule-a | applied | src/gone.ts:12 |"]));
    const drift = driftReport(dir, "floor.md");
    assert.equal(drift.length, 1);
    assert.match(drift[0].problem, /does not resolve/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("driftReport: pure prose evidence without a path token is not drift", () => {
  const dir = makeMission();
  try {
    writeFileSync(join(dir, "floor.md"), manifest(["| rule-a | applied | reviewed at the gate, v1.0 |"]));
    assert.deepEqual(driftReport(dir, "floor.md"), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("driftReport: a pointer resolving under one of the bases is not drift", () => {
  const dir = makeMission();
  try {
    mkdirSync(join(dir, "lib"));
    writeFileSync(join(dir, "lib", "real.ts"), "export {};\n");
    writeFileSync(join(dir, "floor.md"), manifest(["| rule-a | applied | lib/real.ts:3 |"]));
    assert.deepEqual(driftReport(dir, "floor.md"), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── unratifiedAdrs / decisionCoverage ──────────────────────────────

test("unratifiedAdrs: DRAFT- filename, Status: hypothesis, why: UNKNOWN are each flagged", () => {
  const dir = makeMission([]);
  try {
    mkdirSync(join(dir, "adr"));
    writeFileSync(join(dir, "adr", "DRAFT-0005-guess.md"), "# Guess\n");
    writeFileSync(join(dir, "adr", "ADR-0003-hyp.md"), "# Hyp\n\n**Status**: hypothesis\n");
    writeFileSync(join(dir, "adr", "ADR-0004-why.md"), "# Why\n\n**Status**: accepted\n\nwhy: UNKNOWN\n");
    writeFileSync(join(dir, "adr", "ADR-0001-good.md"), "# Good\n\n**Status**: accepted\n\nwhy: measured on live traffic\n");
    const out = unratifiedAdrs(dir);
    assert.deepEqual(out.map((o) => o.file).sort(), ["ADR-0003-hyp.md", "ADR-0004-why.md", "DRAFT-0005-guess.md"]);
    assert.match(out.find((o) => o.file.startsWith("DRAFT")).reason, /DRAFT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("decisionCoverage: template and README excluded from the total, ratified = total - unratified", () => {
  const dir = makeMission([]);
  try {
    mkdirSync(join(dir, "adr"));
    writeFileSync(join(dir, "adr", "ADR-0000-template.md"), "# Template\n\n**Status**: fill me\n");
    writeFileSync(join(dir, "adr", "README.md"), "# Journal\n");
    writeFileSync(join(dir, "adr", "ADR-0001-good.md"), "# Good\n\n**Status**: accepted\n");
    writeFileSync(join(dir, "adr", "DRAFT-0002-guess.md"), "# Guess\n");
    const cov = decisionCoverage(dir);
    assert.equal(cov.total, 2);
    assert.equal(cov.ratified, 1);
    assert.equal(cov.unratified.length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("decisionCoverage: no adr/ directory means zero totals", () => {
  const dir = makeMission([]);
  try {
    assert.deepEqual(decisionCoverage(dir), { total: 0, ratified: 0, unratified: [] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
