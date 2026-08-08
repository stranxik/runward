// The rule-conformance gate: the decisions that turn a manifest on disk into strict gaps.
//
// `conformance.test.js` already pins this region from synthetic mini-missions, and it pins it well:
// every case there builds a manifest that is WRONG and asserts the exact violation it earns. What
// no case does is start from a manifest that is RIGHT and demand silence. That asymmetry is where
// the 2026-08-05 mutation survivors live, and each one is a measured verdict change, not a theory:
// letting drift judge `n/a` rows turns the shipped `init --example` mission from exit 0 to exit 1
// because an n/a reason happens to name a document; deleting a gated deliverable and calling
// `driftReport` on it throws ENOENT out of `computeVerdict`, replacing the whole audit with one
// error line; a typed pointer judged twice inflates the published gap count that ADR-0019 says must
// carry one diagnosis per row; and a rule file with no frontmatter — a state the corpus check
// deliberately allows, so house notes stay legal — becomes a null dereference that takes the
// verdict with it. Nothing in the suite catches any of those today.
//
// So each case here exercises its guard in BOTH directions: the clean mission must stay silent, and
// one single deliberate defect must be the only thing that speaks. The fixtures assert that they
// actually bit — a `replace()` whose pattern misses produces a green test that guards nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  conformance, driftReport, expectedRules, allRules, ruleSignatures, GATED_DELIVERABLES,
} from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

// One reference mission, built once by the real CLI, then copied per case. `init --example` is the
// mission the project ships as green: it is the only fixture that can prove a guard does not fire
// when it must not.
const REFERENCE = mkdtempSync(join(tmpdir(), "rw-conf-ref-"));
// `init` ends by running the gate on what it just wrote, so it exits non-zero the moment the gate
// misjudges the example. Scaffolding is not the assertion — swallow the exit code here so a broken
// guard fails on the case that NAMES it, not on a child process at import time.
try {
  execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });
} catch { /* judged below, by name */ }
if (!existsSync(join(REFERENCE, "runward", "architecture.md"))) {
  throw new Error("reference mission was not scaffolded — the fixture, not the gate, is broken");
}

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-conf-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Edit a file and REFUSE to continue if the pattern missed: a fixture that did not bite makes a
 *  test that passes for no reason. */
function edit(path, from, to) {
  const before = readFileSync(path, "utf8");
  assert.ok(before.includes(from), `fixture did not bite: ${JSON.stringify(from)} not found in ${path}`);
  const after = before.replace(from, to);
  assert.notEqual(after, before, `fixture produced no change in ${path}`);
  writeFileSync(path, after);
}

const problems = (violations, rule) => violations.filter((v) => v.rule === rule).map((v) => v.problem);
const anySays = (violations, needle) => violations.some((v) => v.problem.includes(needle));

// ── The clean mission is clean ──────────────────────────────────────────────────────────────────
// The blunt pin the region never had. Any guard in `conformance()` mutated to fire unconditionally
// dies here, because the shipped example is the one manifest that must produce nothing at all.

test("the shipped example manifest raises no conformance violation on any gated deliverable", () => {
  const m = mission();
  try {
    for (const { phase, deliverable } of GATED_DELIVERABLES) {
      const { expected, violations } = conformance(m.mission, phase, deliverable);
      assert.ok(expected.length > 0, `${phase}: expected rule set must not be empty`);
      assert.deepEqual(violations, [], `${deliverable}: a green mission must raise nothing`);
    }
  } finally { m.drop(); }
});

// ── Non-vacuity floor (ADR-0002) ────────────────────────────────────────────────────────────────
// The floor exists to catch a stripped mapping. Dangerous direction: firing on a corpus that is
// intact, which reddens every mission that ever runs --strict.

test("the non-vacuity floor stays silent at the floor and speaks below it", () => {
  const m = mission();
  try {
    // architect ships exactly 6 CRITICAL/HIGH rules and its floor is 6: at the floor, not above it.
    assert.equal(expectedRules(m.mission, "architect").length, 6);
    const intact = conformance(m.mission, "architect", "architecture.md").violations;
    assert.deepEqual(problems(intact, "(mapping)"), [], "a corpus AT its floor is not a stripped corpus");

    // Remove one architect mapping — the exact defect the floor was built to catch.
    edit(join(m.mission, "rules", "hexa-architecture.md"), "phases: [architect, floor]", "phases: [floor]");
    assert.equal(expectedRules(m.mission, "architect").length, 5);
    const stripped = conformance(m.mission, "architect", "architecture.md").violations;
    assert.equal(problems(stripped, "(mapping)").length, 1, "5 of 6 mapped must raise the floor violation");
    assert.match(problems(stripped, "(mapping)")[0], /only 5 CRITICAL\/HIGH rules mapped to 'architect', floor is 6/);
  } finally { m.drop(); }
});

// ── An applied row must carry a pointer ─────────────────────────────────────────────────────────
// Dangerous direction: demanding a pointer from a row that already has one.

test("`applied` is refused without an evidence pointer, and accepted with one", () => {
  const m = mission();
  const arch = join(m.mission, "architecture.md");
  try {
    const withPointer = conformance(m.mission, "architect", "architecture.md").violations;
    assert.equal(anySays(withPointer, "applied without an evidence pointer"), false,
      "rows that carry a pointer must not be accused of lacking one");

    // Empty the Evidence cell of ONE applied row; status and rule name stay untouched, so this is
    // the only cause in play.
    edit(arch,
      "| hexa-architecture | applied | file:code/src/core/application/triage-request.usecase.ts#TriageRequestUseCase — §2 pure triage domain, four ports; code/src/core/ |",
      "| hexa-architecture | applied |  |");
    const blanked = conformance(m.mission, "architect", "architecture.md").violations;
    assert.deepEqual(problems(blanked, "hexa-architecture"),
      ["applied without an evidence pointer — put a file:line or a test in the Evidence column"]);
  } finally { m.drop(); }
});

// ── Drift: which rows it may judge ──────────────────────────────────────────────────────────────
// Drift is existence-of-file, and it is only ever the business of an `applied` row. An `n/a`
// reason routinely names a document to explain itself; a `deviated` row names its ADR. Judging
// those as pointers turns a legitimate sentence into a red gate.

test("drift judges `applied` rows only — an n/a reason may name a file without being a pointer", () => {
  const m = mission();
  const arch = join(m.mission, "architecture.md");
  const row = "| hexa-typescript-native | n/a | language deliberately left open at this note (§5); locked at floor kickoff (ADR-0004 pending) |";
  const reason = "language deliberately left open at this note (§5); see notes/language-choice.md for the shortlist";
  try {
    edit(arch, row, `| hexa-typescript-native | n/a | ${reason} |`);
    assert.deepEqual(driftReport(m.mission, "architecture.md"), [],
      "a path named inside an n/a reason is prose, not a pointer that can drift");

    // Same cell, same unresolvable path: only the STATUS changes. One cause, both directions.
    edit(arch, `| hexa-typescript-native | n/a | ${reason} |`, `| hexa-typescript-native | applied | ${reason} |`);
    const drifted = driftReport(m.mission, "architecture.md");
    assert.equal(drifted.length, 1);
    assert.equal(drifted[0].rule, "hexa-typescript-native");
    assert.match(drifted[0].problem, /applied pointer does not resolve \(drift\)/);
  } finally { m.drop(); }
});

// ── Drift: one diagnosis per row, never two (ADR-0019) ──────────────────────────────────────────
// A typed pointer belongs to the evidence layer. If drift also claims it, a single broken pointer
// is counted twice and the published gap count stops meaning what it says.

test("drift leaves typed pointers to the evidence layer and takes the untyped ones", () => {
  const m = mission();
  const arch = join(m.mission, "architecture.md");
  const tail = "#KeywordModelAdapter — §3 every dependency behind a port; code/src/adapters/";
  try {
    // Break the pointer, keep it TYPED: the evidence layer owns this row, drift must not speak.
    edit(arch, `| hexa-adapter-pattern | applied | file:code/src/adapters/keyword-model.adapter.ts${tail} |`,
               `| hexa-adapter-pattern | applied | file:code/src/adapters/gone-missing.adapter.ts${tail} |`);
    assert.deepEqual(driftReport(m.mission, "architecture.md"), [],
      "a typed pointer is diagnosed once, by the evidence layer — not twice");

    // Same broken path, now UNTYPED: nobody else owns it, so drift must speak. Only the `file:`
    // prefix differs between the two halves of this case.
    edit(arch, "| hexa-adapter-pattern | applied | file:code/src/adapters/gone-missing.adapter.ts",
               "| hexa-adapter-pattern | applied | code/src/adapters/gone-missing.adapter.ts");
    const drifted = driftReport(m.mission, "architecture.md");
    assert.equal(drifted.length, 1);
    assert.equal(drifted[0].rule, "hexa-adapter-pattern");
  } finally { m.drop(); }
});

// ── Drift: a deliverable that is not there ──────────────────────────────────────────────────────
// Mid-mission, a gated deliverable is routinely absent — `conformance()` reports it as missing and
// the gate closes on that. Drift must return nothing and let that reading stand. Reading the file
// unguarded throws ENOENT out of `computeVerdict`, which replaces the whole audit with one line.

test("drift returns nothing for an absent deliverable instead of throwing over the audit", () => {
  const m = mission();
  try {
    // Present: drift reads it and stays silent on a mission whose pointers all resolve.
    assert.deepEqual(driftReport(m.mission, "handover.md"), []);

    unlinkSync(join(m.mission, "handover.md"));
    let out;
    assert.doesNotThrow(() => { out = driftReport(m.mission, "handover.md"); },
      "an absent deliverable is `conformance()`'s finding to report, not an exception to raise");
    assert.deepEqual(out, []);
    // And the reading that must survive: conformance still names every unaccounted rule.
    const { violations } = conformance(m.mission, "handover", "handover.md");
    assert.ok(violations.length > 0 && violations.every((v) => v.problem === "handover.md missing"));
  } finally { m.drop(); }
});

// ── Rule frontmatter: malformed is not fatal ────────────────────────────────────────────────────
// `runward/rules/` is the operator's directory: house rules live there, and the corpus check
// deliberately tolerates an added file that claims no gated impact. A note without frontmatter is
// therefore a GREEN state today. Reading `match(...)[1]` without the optional chain turns that
// state into a null dereference that takes the whole verdict with it.

test("a rule file with no frontmatter is skipped, not fatal — and a well-formed one is still read", () => {
  const m = mission();
  const rules = join(m.mission, "rules");
  try {
    const baseline = expectedRules(m.mission, "architect");
    writeFileSync(join(rules, "zz-house-note.md"), "# A house note\n\nNo frontmatter at all.\n");

    assert.doesNotThrow(() => ruleSignatures(m.mission));
    assert.doesNotThrow(() => allRules(m.mission));
    assert.doesNotThrow(() => expectedRules(m.mission, "architect"),
      "a rule file without frontmatter must not throw out of the rule reader");
    assert.ok(allRules(m.mission).includes("zz-house-note"), "it is still part of the rule universe");
    assert.deepEqual(expectedRules(m.mission, "architect"), baseline,
      "with no declared impact it claims no phase");

    // Other direction: give the same file real frontmatter and it must be picked up.
    writeFileSync(join(rules, "zz-house-note.md"),
      "---\ntitle: House\nimpact: CRITICAL\nphases: [architect]\n---\n\n# A house note\n");
    assert.deepEqual(expectedRules(m.mission, "architect"), [...baseline, "zz-house-note"].sort());
  } finally { m.drop(); }
});

test("frontmatter without an `impact:` key is skipped, not fatal — adding the key admits the rule", () => {
  const m = mission();
  const rules = join(m.mission, "rules");
  const file = join(rules, "zz-no-impact.md");
  try {
    const baseline = expectedRules(m.mission, "architect");
    // Frontmatter present, `impact:` absent: the inner match returns null where the outer did not.
    writeFileSync(file, "---\ntitle: No impact declared\nphases: [architect]\n---\n\n# note\n");
    assert.doesNotThrow(() => expectedRules(m.mission, "architect"),
      "a missing `impact:` key must not throw out of the rule reader");
    assert.deepEqual(expectedRules(m.mission, "architect"), baseline);

    writeFileSync(file, "---\ntitle: No impact declared\nimpact: HIGH\nphases: [architect]\n---\n\n# note\n");
    assert.deepEqual(expectedRules(m.mission, "architect"), [...baseline, "zz-no-impact"].sort());
  } finally { m.drop(); }
});

// ── Signatures: only rules that declare one ─────────────────────────────────────────────────────
// Defence in depth, pinned on purpose. `evidenceReport` guards with `if (sig)`, so an unsigned rule
// mapped to "" is inert TODAY — the day that guard becomes `row.rule in signatures`, every unsigned
// rule starts demanding a match against an empty regex. The map must not carry what it cannot mean.

test("ruleSignatures carries signed rules only, never an empty signature for an unsigned one", () => {
  const m = mission();
  try {
    const sigs = ruleSignatures(m.mission);
    const declared = allRules(m.mission).filter((slug) =>
      /^signature:\s*\S/m.test(readFileSync(join(m.mission, "rules", `${slug}.md`), "utf8")));
    assert.ok(declared.length > 0, "the corpus must ship at least one signed rule for this to test anything");
    assert.deepEqual(Object.keys(sigs).sort(), declared.sort(), "exactly the rules that declare a signature");
    assert.deepEqual(Object.values(sigs).filter((s) => !s), [], "no rule may carry an empty signature");
  } finally { m.drop(); }
});

test("a non-.md file in runward/rules/ contributes no signature, even when it declares one", () => {
  const m = mission();
  const rules = join(m.mission, "rules");
  const body = "---\nimpact: HIGH\nphases: [architect]\nsignature: HOUSE_MARKER\n---\n\n# house\n";
  try {
    writeFileSync(join(rules, "zz-house.txt"), body);
    const sigs = ruleSignatures(m.mission);
    assert.equal("zz-house.txt" in sigs, false, "the rule set is .md — a stray file is not a rule");
    assert.equal("zz-house" in sigs, false);
    assert.equal(allRules(m.mission).includes("zz-house.txt"), false);

    // Other direction: the same content under a .md name IS a rule, signature and all.
    writeFileSync(join(rules, "zz-house.md"), body);
    assert.equal(ruleSignatures(m.mission)["zz-house"], "HOUSE_MARKER");
  } finally { m.drop(); }
});
