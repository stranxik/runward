// The thresholds that decide whether a deliverable counts as done.
//
// Found by the full mutation pass of 2026-08-04: `artifactState` carried 101 of the 189 survivors
// in mission.js (module score 40%, the lowest of the seven core modules), and no unit test aimed at
// it. Twelve of the thirteen tests in mission.test.js target readReopeningTriggers and
// findMissionRoot; a single one touches analyze.
//
// This is the function every phase rests on: it decides "filled" / "in-progress" / "untouched" /
// "missing" for each deliverable, and a phase cannot be crossed while one is incomplete. Its
// numbers were "calibrated against the reference mission" in a comment and pinned by nothing, so
// `>= 3` could become `> 3`, `< 3`, `true` or `false` and the whole net stayed green.
//
// A surviving mutant here does not always mean a false green: the reference mission is also held by
// typed-pointer resolution, so making the ADR branch always answer "filled" still ends in a refusal
// (verified 2026-08-04). What it does produce is a report that prints ✓ where the truth is ○ — a
// lying proof surface under a correct verdict, which for this tool is a defect of its own.
//
// Each case below states the threshold it pins and the direction that would be dangerous.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactState } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TPL = join(ROOT, "templates", "mission");
const template = (name) => readFileSync(join(TPL, name), "utf8");

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-artifact-"));
  return dir;
}
const put = (dir, rel, body) => {
  mkdirSync(join(dir, dirname(rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
};

// ── The ADR directory ───────────────────────────────────────────────────────────────────────────
// `adrs.length > 0 ? "filled" : "untouched"`. Both branches, both directions.

test("an adr/ holding only the scaffolded template is untouched, never filled", () => {
  // The dangerous direction: reporting a decision journal as done when no decision was recorded.
  // Mutating this branch to a constant "filled" survived the unit suite, the self-gate, the smoke
  // test AND the audit corpus on 2026-08-04.
  const dir = mission();
  put(dir, "adr/ADR-0000-template.md", "# template\n");
  assert.equal(artifactState(dir, { label: "x", relPath: "adr" }), "untouched");
  rmSync(dir, { recursive: true, force: true });
});

test("one real ADR beside the template makes adr/ filled", () => {
  // The opposite direction, so the test cannot be satisfied by a constant either way.
  const dir = mission();
  put(dir, "adr/ADR-0000-template.md", "# template\n");
  put(dir, "adr/ADR-0001-something.md", "# ADR\n\n**Status**: accepted\n");
  assert.equal(artifactState(dir, { label: "x", relPath: "adr" }), "filled");
  rmSync(dir, { recursive: true, force: true });
});

test("an absent deliverable is missing, and never confused with untouched", () => {
  const dir = mission();
  assert.equal(artifactState(dir, { label: "x", relPath: "adr" }), "missing");
  rmSync(dir, { recursive: true, force: true });
});

// ── The contracts directory ─────────────────────────────────────────────────────────────────────
// `contracts.length === 0` then `some(f => text !== template)`.

test("an empty contracts/ is untouched", () => {
  const dir = mission();
  mkdirSync(join(dir, "contracts"), { recursive: true });
  assert.equal(artifactState(dir, { label: "x", relPath: "contracts" }), "untouched");
  rmSync(dir, { recursive: true, force: true });
});

test("a contracts/ holding only the raw port-contract template is untouched", () => {
  // Copying the scaffold into place is not writing a contract. Inverting the emptiness test, or
  // dropping the template comparison, both flip this to filled.
  const dir = mission();
  put(dir, "contracts/port-contract.md", template("port-contract.md"));
  assert.equal(artifactState(dir, { label: "x", relPath: "contracts" }), "untouched");
  rmSync(dir, { recursive: true, force: true });
});

test("one contract that departs from the template makes contracts/ filled", () => {
  const dir = mission();
  put(dir, "contracts/port-contract.md", template("port-contract.md"));
  put(dir, "contracts/queue.md", "# Queue port\n\nSame input, same verdict, byte for byte.\n");
  assert.equal(artifactState(dir, { label: "x", relPath: "contracts" }), "filled");
  rmSync(dir, { recursive: true, force: true });
});

// ── The placeholder floor (ADR-0002 non-vacuity) ────────────────────────────────────────────────
// `(content.match(PLACEHOLDER) || []).length >= 3`. The mutation pass survived `> 3`, `< 3`, `true`
// and `false` on this line: the floor was load-bearing and pinned by nothing.

test("a deliverable left identical to its template is untouched", () => {
  const dir = mission();
  put(dir, "framing.md", template("framing.md"));
  assert.equal(artifactState(dir, { label: "x", relPath: "framing.md", templateKey: "framing.md" }), "untouched");
  rmSync(dir, { recursive: true, force: true });
});

test("exactly three remaining placeholders still read as in-progress — the floor is >= 3, not > 3", () => {
  // Pins the boundary itself. With `> 3`, a deliverable carrying three unfilled brackets would be
  // announced as done; with `< 3`, genuine work would be held back forever.
  const dir = mission();
  const body = ["# Framing", "", "Real prose that carries several lines of actual content here.",
    "", "- [to be decided]", "- [owner to name]", "- [date to set]", ""].join("\n");
  assert.equal((body.match(/\[[^\]\n]*\s[^\]\n]{1,80}\](?!\()/g) || []).length, 3, "fixture must carry exactly 3");
  put(dir, "framing.md", body);
  assert.equal(artifactState(dir, { label: "x", relPath: "framing.md", templateKey: "framing.md" }), "in-progress");
  rmSync(dir, { recursive: true, force: true });
});

test("two placeholders do not hold a substantial deliverable back", () => {
  // The symmetric case. A guard that never lets anything through is as broken as one that lets
  // everything through, and only the pair of tests forbids both constants.
  const dir = mission();
  const body = ["# Framing", "",
    "The mission delivers a deterministic gate over the delivery of agentic systems, and this",
    "note states the problem it answers, who carries it, and what would count as done.",
    "The scope is the command line surface and the mission files it reads.",
    "Out of scope: anything the operator runs outside this repository.",
    "", "- [owner to name]", "- [date to set]", ""].join("\n");
  put(dir, "framing.md", body);
  assert.equal(artifactState(dir, { label: "x", relPath: "framing.md", templateKey: "framing.md" }), "filled");
  rmSync(dir, { recursive: true, force: true });
});

// ── The divergence floor ────────────────────────────────────────────────────────────────────────
// `added.length < 3 || addedWords < 20`. Templates with few placeholders cannot lean on the floor
// above, so a one-byte interior edit would otherwise pass as a filled deliverable.

// All three cases run on execution-topology.md, which carries a single placeholder. On a
// placeholder-rich template the earlier floor answers first and these tests pass while guarding
// nothing — which is exactly what happened on the first draft: they were green, and disabling the
// divergence floor outright did not turn them red. Written against the wrong template, a test is
// not weak, it is decorative.
const topo = { label: "x", relPath: "execution-topology.md", templateKey: "execution-topology.md" };

test("a one-line edit of a template is not a filled deliverable", () => {
  const dir = mission();
  put(dir, "execution-topology.md", `${template("execution-topology.md")}\nOne added line.\n`);
  assert.equal(artifactState(dir, topo), "in-progress");
  rmSync(dir, { recursive: true, force: true });
});

test("three added lines carrying fewer than twenty words are still in-progress", () => {
  // Pins the word half of the floor. Dropping `addedWords < 20` lets three near-empty lines pass.
  const dir = mission();
  put(dir, "execution-topology.md", `${template("execution-topology.md")}\nOne line.\nTwo line.\nThree line.\n`);
  assert.equal(artifactState(dir, topo), "in-progress");
  rmSync(dir, { recursive: true, force: true });
});

test("two added lines carrying plenty of words are still in-progress — the floor needs three", () => {
  // Pins the line half of the floor, which the word half would otherwise hide.
  const dir = mission();
  const two = ["The gate reads the mission repository and never the behaviour of the system it guards,",
    "so the same working tree always yields the same verdict and the same machine outputs.", ""].join("\n");
  put(dir, "execution-topology.md", `${template("execution-topology.md")}\n${two}`);
  assert.equal(artifactState(dir, topo), "in-progress");
  rmSync(dir, { recursive: true, force: true });
});

test("several lines of genuinely new prose make a templated deliverable filled", () => {
  // And the floor must let honest work through: this is the case a gate that cries on the safe
  // input would break, which is the failure mode that gets a gate switched off.
  //
  // Run on execution-topology.md (one placeholder) rather than framing.md (thirty): the divergence
  // floor exists precisely for the templates the placeholder floor cannot hold, so testing it on a
  // placeholder-rich template would measure the wrong guard. First fixture of this file got that
  // wrong and read as a code defect until the templates were counted.
  const dir = mission();
  const added = ["The gate reads the mission repository and never the behaviour of the system it",
    "guards, so the same working tree always yields the same verdict and the same machine",
    "outputs. The operator holds the decision; the tool holds the evidence.", ""].join("\n");
  put(dir, "execution-topology.md", `${template("execution-topology.md")}\n${added}`);
  assert.equal(artifactState(dir, {
    label: "x", relPath: "execution-topology.md", templateKey: "execution-topology.md",
  }), "filled");
  rmSync(dir, { recursive: true, force: true });
});
