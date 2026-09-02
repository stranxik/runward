// Unit tests for the gate core (dist/lib/conformance.js), against real files in temp dirs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseManifest, conformance, driftReport,
  expectedRules, allRules, unratifiedAdrs, decisionCoverage, GATED_DELIVERABLES,
} from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A fixture that looks like a decision someone took. An empty file used to satisfy a deviation;
 *  the evidence layer has always refused an empty file, and the two layers now agree. */
const ADR = (id, title) => `# ${id}: ${title}\n\n**Status**: accepted\n\n## Context\n\nSomething had to be decided here, and this records it.\n`;


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

test("parseManifest: a [rule-slug] placeholder row is the template, not a decision", () => {
  // This test used to pin the OPPOSITE — the placeholder row came back as a real row — with no
  // stated reason: it was written in the 2026-07-16 harness commit as a pin of observed behavior.
  // The behavior it pinned was the enabler of RWD-2026-0097 (an untouched mission reporting 5 rows
  // and garbage statuses in the machine payload), and the product already treated brackets as
  // placeholder vocabulary in two other places (the n/a form-lint, and a per-consumer skip in
  // evidence.ts that this change retires in favour of the parser owning the rule once).
  const rows = parseManifest(manifest(["| [rule-slug] | applied | [file:line] |"]));
  assert.deepEqual(rows, [], "the template teaching its own format is not manifest content");
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
    assert.match(violations[0].problem, /deviated .*(no matching ADR|no runward\/adr)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: a deviation needs a decision, not just a file with the right name", () => {
  // The evidence layer refuses an empty file outright; the ADR layer accepted one as a ratified
  // decision. An audit satisfied 36 deviations with a 0-byte file, and 36 more by citing
  // `ADR-0000-template.md` — the template runward scaffolds itself and nobody ever wrote.
  const dir = makeMission();
  try {
    mkdirSync(join(dir, "adr"));
    const cases = [
      ["ADR-0000-template.md", ADR("ADR-0000", "Template"), "ADR-0000", /template/i],
      ["ADR-0021-empty.md", "", "ADR-0021", /empty/i],
      ["ADR-0022-rejected.md", "# ADR-0022: x\n\n**Status**: rejected\n\nWe looked at this and said no, for reasons recorded here.\n", "ADR-0022", /rejected|set-aside/i],
      ["ADR-0023-proposed.md", "# ADR-0023: x\n\n**Status**: proposed\n\nThis is still under discussion and nobody has ratified it.\n", "ADR-0023", /not ratified|proposed/i],
    ];
    for (const [file, body, cite, expected] of cases) {
      writeFileSync(join(dir, "adr", file), body);
      const { violations } = check(dir, [`| rule-a | deviated | ${cite} |`]);
      assert.equal(violations.length, 1, `${file} must not carry a deviation`);
      assert.match(violations[0].problem, expected, `${file}: message names the real reason`);
    }
    // And a real one still works, so this is a floor and not a wall.
    writeFileSync(join(dir, "adr", "ADR-0024-real.md"), ADR("ADR-0024", "A real decision"));
    assert.deepEqual(check(dir, ["| rule-a | deviated | ADR-0024 |"]).violations, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("conformance: ADR-1 is not satisfied by ADR-10 (digit boundary)", () => {
  const dir = makeMission();
  try {
    mkdirSync(join(dir, "adr"));
    writeFileSync(join(dir, "adr", "ADR-10-other.md"), ADR("ADR-10", "Other"));
    let { violations } = check(dir, ["| rule-a | deviated | ADR-1 |"]);
    assert.equal(violations.length, 1);
    assert.match(violations[0].problem, /deviated/);
    writeFileSync(join(dir, "adr", "ADR-1-real.md"), ADR("ADR-1", "Real"));
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

test("the ADR status is the first word, not anything the line mentions", () => {
  // The inverse pass: a control that refuses an HONEST mission destroys trust, and an operator who
  // sees the gate cry wrongly learns to ignore the gate. Searching the whole line refused
  // `accepted, replacing the proposed ADR-0012` as unratified, and
  // `accepted (superseded by ADR-0050)` as set-aside — both are accepted decisions whose line
  // merely names another one. The convention here is `accepted (ratified … — see Ratification)`.
  const dir = makeMission();
  try {
    mkdirSync(join(dir, "adr"));
    const body = (id, status) => `# ${id}: x\n\n**Status**: ${status}\n\n## Context\n\nA real decision, recorded with enough substance to count.\n`;
    let n = 10;
    const run = (status, shouldPass) => {
      const id = `ADR-00${n}`; const file = `${id}-x.md`; n++;
      writeFileSync(join(dir, "adr", file), body(id, status));
      const { violations } = check(dir, [`| rule-a | deviated | ${id} |`]);
      assert.equal(violations.length === 0, shouldPass, `${JSON.stringify(status)} → ${violations[0]?.problem ?? "accepted"}`);
    };
    run("accepted", true);
    run("accepted (superseded by ADR-0050)", true);
    run("accepted, replacing the proposed ADR-0012", true);
    run("accepté (ratifié le 2026-07-21)", true);
    run("proposed", false);
    run("rejected", false);
    run("superseded by ADR-0050", false);
    run("draft", false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the README's phase claim matches the number of phases the gate actually gates", () => {
  // README read `## The method: six phases, gated` while GATED_DELIVERABLES holds five. Phase 4
  // (`iterate`) has no gated deliverable and ADR-0033 rejects it explicitly — "no deliverable that
  // is filled once and done" — so the omission was a decision the README never carried. Derived
  // from the code, so the day a sixth phase IS gated this test is what says the sentence is stale.
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const gated = GATED_DELIVERABLES.length;
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  const heading = readme.match(/^## The method: .*$/m);
  assert.ok(heading, "the method heading is gone — update this guard deliberately");
  assert.match(heading[0], new RegExp(`\\b${words[gated]}\\b`, "i"),
    `the heading must name ${gated} gated phase(s); GATED_DELIVERABLES has ${gated}`);
  // And every gated deliverable is named where the claim is made, so the count cannot be right by
  // luck while the list is wrong.
  const section = readme.slice(readme.indexOf(heading[0]), readme.indexOf(heading[0]) + 1500);
  for (const d of GATED_DELIVERABLES)
    assert.ok(section.includes(d.deliverable), `${d.deliverable} is gated but not named beside the claim`);
});
