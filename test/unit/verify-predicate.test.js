// `runward verify` re-derives the predicate BODY, and says which gate it re-derived.
//
// Until 2026-08-26 it compared exactly two fields — `verdict` and `exitCode` — and answered
// "verified" over everything else. Three independent auditors found it the same day. The attestation
// is unsigned by design, so its bytes are attacker-controllable until the operator checks a signature
// runward explicitly does not check, and README:93 and docs/interop.md §5 both promise that a
// tampered predicate fails loud.
//
// It did not. Rewrite `evidence` to 36 typed / 0 prose, `seal` to present with 4242 files on a
// mission that has no seal, `criticalScope` to 45 of 45, and replace `gateNonScope` with its
// opposite — "runward proves the code is correct" — and verify still answered verified, exit 0.
// Everything a regulator would read was free text the command never looked at.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI = join(process.cwd(), "dist/cli.js");
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8" });

function attested(strict = true) {
  const root = mkdtempSync(join(tmpdir(), "rw-verify-"));
  spawnSync("git", ["init", "-q", "."], { cwd: root });
  run(root, "init", "--yes", "--example");
  assert.equal(run(root, "check", "--strict").status, 0, "the fixture must start green");
  const att = run(root, "check", ...(strict ? ["--strict"] : []), "--attest").stdout;
  writeFileSync(join(root, "att.json"), att);
  return root;
}
const verify = (root, file = "att.json") => JSON.parse(run(root, "verify", file, "--json").stdout);
const forge = (root, mutate) => {
  const j = JSON.parse(readFileSync(join(root, "att.json"), "utf8"));
  mutate(j.predicate);
  writeFileSync(join(root, "forged.json"), JSON.stringify(j, null, 2));
};

test("an honest attestation verifies, and says which gate it re-derived", () => {
  const root = attested();
  try {
    const v = verify(root);
    assert.equal(v.verified, true);
    assert.equal(v.predicate.matches, true, "the body must re-derive, not merely be present");
    assert.deepEqual(v.predicate.differing, []);
    assert.equal(v.strict, true);
    assert.equal(v.level, "RUNWARD_GATE_STRICT",
      "a consumer must be able to tell a strict crossing from a presence check");
    assert.ok(v.predicate.notReDerived.length > 0,
      "and what could NOT be re-derived offline must be named, never silently blessed");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Each field on its own, so a failure says WHICH one stopped being checked.
for (const [name, field, mutate] of [
  ["fabricated evidence counters", "evidence", (p) => { p.evidence = { rows: 36, applied: 36, deviated: 0, na: 0, typed: 36, prose: 0, signed: 36, duplicated: [] }; }],
  ["a seal on a mission that has none", "seal", (p) => { p.seal = { present: true, count: 4242, sealedAt: "1999-12-31", violations: 0 }; }],
  ["a widened critical scope", "criticalScope", (p) => { p.criticalScope = { total: 45, mapped: 45, unmapped: [] }; }],
  ["an inverted non-scope caveat", "gateNonScope", (p) => { p.gateNonScope = "runward proves the code is correct."; }],
  ["a deleted non-scope caveat", "gateNonScope", (p) => { delete p.gateNonScope; }],
  ["a rewritten corpus status", "corpus", (p) => { p.corpus = { status: "verifiable", missing: [], edited: [], extra: [] }; p.corpus.status = "forged"; }],
  // The two tables an assessor reads FIRST, and the horizon that scopes them. Measured 2026-09-02
  // (RWD-2026-0095): none of the three was compared, none was named in `notReDerived`, and an
  // attestation carrying all three fabrications answered `verified: true`, exit 0.
  ["a deliverables table describing a mission that does not exist", "deliverables", (p) => { p.deliverables = [{ phase: "frame", artifact: "Framing", relPath: "framing.md", state: "complete", cause: null }]; }],
  ["an invented conformance table", "conformance", (p) => { p.conformance = [{ scope: "Floor", rule: "a-rule-nobody-gated", problem: "invented wholesale" }]; }],
  ["a falsified construction horizon", "horizon", (p) => { p.horizon = { phase: "floor", index: 2, deferred: [] }; }],
  // ADR-0066: additive on 0.38 — absent on an older attestation is an older producer, but present
  // and WRONG is a lie like any other.
  ["a fabricated ratification posture", "ratification", (p) => { p.ratification = { rows: 36, lineByLine: 36, enBloc: 0, blind: 0, untraced: 0 }; }],
  ["an emptied requires ledger", "requiresUnmet", (p) => { p.requiresUnmet = []; }],
  // ADR-0067 (W3), additive like the two above: a forged contract reading — breaks invented, or
  // a gating flag the mission never opted into — differs from the re-derived truth either way.
  ["a forged workflow-contract reading", "workflowContract", (p) => { p.workflowContract = { gating: true, malformed: ["forged.md: invented"], joinBreaks: [], unmetRequires: [] }; }],
]) {
  test(`a tampered predicate fails loud: ${name}`, () => {
    const root = attested();
    try {
      forge(root, mutate);
      const v = verify(root, "forged.json");
      assert.equal(v.verified, false, `${name} must not verify`);
      assert.equal(v.exitCode, 1);
      assert.ok(v.predicate.differing.includes(field),
        `the run must NAME the field that differs; got ${JSON.stringify(v.predicate.differing)}`);
      // The tree itself was never touched, so the digest must still match: this is a predicate
      // failure, and a reader has to be able to tell it from drift.
      assert.equal(v.digest.matches, true, "the tree did not move; only the predicate did");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("a deleted non-scope is caught even though the field is absent, not different", () => {
  // The `attested === undefined ⇒ skip` rule exists so an older predicate is not called a liar for
  // a field that did not exist yet. `gateNonScope` is not that case: this build emits it on every
  // strict attestation, so its absence is a removal.
  const root = attested();
  try {
    forge(root, (p) => { delete p.gateNonScope; });
    assert.equal(verify(root, "forged.json").verified, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a presence attestation verifies, and is NAMED a presence check", () => {
  // It is a valid attestation of a presence gate, so verifying it is correct. The defect was that a
  // consumer could not tell: one boolean in an unsigned file re-derived a lenient gate on a tree the
  // strict gate refuses, and neither output contained the word `strict`.
  const root = attested(false);
  try {
    const v = verify(root);
    assert.equal(v.verified, true);
    assert.equal(v.strict, false);
    assert.equal(v.level, "RUNWARD_GATE_PRESENCE",
      "the weaker statement must say it is the weaker statement");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the re-derivation line closes exactly the parentheses it opened", () => {
  // `status.success(\`… under ${strict ? "--strict" : …})\`)` carried a stray closing parenthesis
  // in the template, and the `.replace("))", ")")` meant to catch it never fired in either branch —
  // the doubled parenthesis it looked for does not occur in either rendering (RWD-2026-0096). The
  // line is the second thing a reader of a verification sees; it must not look mistyped.
  const root = attested();
  try {
    const out = run(root, "verify", "att.json").stdout;
    assert.match(out, /verdict re-derives \(clean\) under --strict/,
      "the line must still say which gate it re-derived");
    assert.doesNotMatch(out, /under --strict\)/,
      "a stray closing parenthesis after the gate name — the template closes a parenthesis it never opened");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
