// Every term that makes the verdict red must reach the SARIF log, or the document a CI uploads
// says less than the gate did.
//
// Measured 2026-08-26 by an adversarial audit: FOUR of the five strict terms never reached this
// emitter. A mission red on its evidence SEAL, its rule CORPUS, an unratified DECISION or a failed
// HOOK produced a log with the same sha256 as a green mission's — `results: []`, `rules: []`. The
// README calls that document "the verdict as annotations" and the CHANGELOG calls it "the gate's own
// findings"; this project also documents it as the artifact that CLEARS a forge's stale alerts. So a
// mission whose sealed evidence was tampered with uploaded the exact document that wipes the warning.
//
// `buildSarif` had everything it needed on the Verdict already. It read two fields of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI = join(process.cwd(), "dist/cli.js");
const PACKAGED_RULES = join(process.cwd(), "templates/rules");
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8" });
const sarif = (cwd, ...extra) => JSON.parse(run(cwd, "check", "--strict", ...extra, "--sarif").stdout);

/** A green example mission, asserted green before anything is measured about it. */
function mission() {
  const root = mkdtempSync(join(tmpdir(), "rw-sarif-"));
  spawnSync("git", ["init", "-q", "."], { cwd: root });
  run(root, "init", "--yes", "--example");
  assert.equal(run(root, "check", "--strict").status, 0, "the fixture must start green");
  return root;
}

test("a green mission emits no results, which is what makes the rest meaningful", () => {
  const root = mission();
  try {
    assert.equal(sarif(root).runs[0].results.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Each case: make the mission red on ONE term, and require the log to carry it. The green log is
// captured first in the same fixture, so "differs from green" is a comparison and not a hope.
for (const [term, ruleId, breakIt] of [
  ["the evidence seal", "runward/evidence-seal", (root) => {
    assert.equal(run(root, "check", "--strict", "--freeze").status, 0, "the freeze must succeed");
    const lock = JSON.parse(readFileSync(join(root, "runward/evidence-lock.json"), "utf8"));
    const sealed = Object.keys(lock.files).find((f) => f.endsWith(".ts"));
    assert.ok(sealed, "the lock must carry a file to tamper with");
    writeFileSync(join(root, sealed), readFileSync(join(root, sealed), "utf8") + "\n// tamper\n");
  }],
  ["the rule corpus", "runward/rule-corpus", (root) => {
    cpSync(PACKAGED_RULES, join(root, "runward/rules"), { recursive: true });
    rmSync(join(root, "runward/scaffold-lock.json"), { force: true });
  }],
  ["an unratified decision", "runward/unratified-decision", (root) => {
    writeFileSync(join(root, "runward/adr/DRAFT-0099-guess.md"),
      "# Draft\n\n**Status**: hypothesis\n\nwhy: UNKNOWN\n");
  }],
]) {
  test(`the log carries ${term}`, () => {
    const root = mission();
    try {
      const green = JSON.stringify(sarif(root));
      breakIt(root);
      assert.equal(run(root, "check", "--strict").status, 1,
        `${term} must actually redden the gate, or this case tests nothing`);
      const log = sarif(root);
      assert.notEqual(JSON.stringify(log), green,
        `a red mission must not emit the same log as a green one — that log is what clears a forge's alerts`);
      assert.ok(log.runs[0].results.some((r) => r.ruleId === ruleId),
        `expected a ${ruleId} result, got: ${JSON.stringify(log.runs[0].results.map((r) => r.ruleId))}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("the log carries a failed hook", () => {
  const root = mission();
  try {
    writeFileSync(join(root, "runward/hooks.json"),
      JSON.stringify({ before: [{ name: "always-fails", run: "false" }] }));
    assert.equal(run(root, "check", "--strict").status, 0, "without --hooks the file is ignored");
    assert.equal(run(root, "check", "--strict", "--hooks").status, 1, "with --hooks it reddens");
    const log = sarif(root, "--hooks");
    assert.ok(log.runs[0].results.some((r) => r.ruleId === "runward/hook-failed"),
      `expected a hook result, got: ${JSON.stringify(log.runs[0].results.map((r) => r.ruleId))}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a deliverable annotation points at a path the checkout actually holds", () => {
  // The uri base was MISSION-relative for the deliverable half and repository-relative for the
  // violation half, so half of every log pointed at a path no forge can resolve — while the comment
  // on the line above asserted the opposite and the existing guard matched `/floor\.md$/`, a suffix
  // satisfied by both bases. That is why it shipped.
  const root = mission();
  try {
    writeFileSync(join(root, "runward/handover.md"), "# X\n\n[TODO]\n");
    const log = sarif(root);
    const uris = log.runs[0].results.map((r) => r.locations[0].physicalLocation.artifactLocation.uri);
    assert.ok(uris.length > 0, "the mission must be red on a deliverable for this case to test anything");
    for (const uri of uris) {
      assert.ok(existsSync(join(root, uri)),
        `${uri} does not resolve against the checkout root; a forge cannot annotate it`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a deliverable beyond the declared horizon is a note, never an error", () => {
  // ADR-0053: `--through` defers later phases on purpose. The JSON payload and the VSA level both
  // honour it; this emitter did not, so a passing prefix run annotated an error saying "the gate
  // cannot be crossed on it" — a permanently red pull request on a green gate.
  const root = mission();
  try {
    writeFileSync(join(root, "runward/handover.md"), "# X\n\n[TODO]\n");
    assert.equal(run(root, "check", "--strict").status, 1, "the whole arc is red");
    assert.equal(run(root, "check", "--strict", "--through", "floor").status, 0,
      "the prefix is green, which is the state under test");
    const log = sarif(root, "--through", "floor");
    const handover = log.runs[0].results.filter((r) =>
      r.locations[0].physicalLocation.artifactLocation.uri.endsWith("handover.md"));
    assert.ok(handover.length > 0, "the deferred deliverable should still be visible to a reviewer");
    for (const r of handover) {
      assert.equal(r.level, "note", "a run that passed must not annotate an error");
      assert.match(r.message.text, /deferred by the declared horizon/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
