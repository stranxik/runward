// The regulated tier's reading of a Ratification block, pinned by calling the readers directly
// (ADR-0080 part 1, ADR-0082 and its amendment of 2026-09-28).
//
// Found by the mutation measure of 2026-09-28 (release 0.42.3): the agent path, the digest binding
// and the declared-name comparison were exercised mostly through `runward ratify` and `check` in a
// child process, where no mutant is active, so the unit suite let a row the agent itself proposed
// bind, a `(declared, agent)` label leak into a name, and a digest of the wrong length bind. What is
// pinned here: which cause each trace earns, what the parser keeps of each declared segment, how a
// declared name is compared, what the digest a trace carries is made of, and what the ledger counts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readRatification, ratificationLedger, unboundRatifications, declaredNameIn, rowDigest,
} from "../../dist/lib/conformance.js";

const ROW = { rule: "r-a", status: "applied", evidence: "file:src/a.ts" };
const DIGEST = rowDigest(ROW);

const floorWith = (rows, entries) => [
  "# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
  ...rows, "", "### Ratification", "", ...entries, "",
].join("\n");

function missionDir(lock) {
  const dir = mkdtempSync(join(tmpdir(), "rw-bind-"));
  if (lock !== undefined) writeFileSync(join(dir, "scaffold-lock.json"), typeof lock === "string" ? lock : JSON.stringify(lock));
  return dir;
}

const agentLine = (segments) => `- 2026-09-28 · rows: r-a · ${segments} · bound: r-a@${DIGEST} · mode: agent`;

// ── which cause a trace earns ───────────────────────────────────────────────────────────────────

test("an agent that itself proposed the row never binds it, whoever it answers for", () => {
  const dir = missionDir({ regulated: true, agentRatification: true });
  try {
    writeFileSync(join(dir, "floor.md"), floorWith(["| r-a | applied | file:src/a.ts |"], [
      agentLine("by: claude (declared, agent) · for: Ada (declared, accountable) · proposer: Claude, 2026-09-27 (declared)"),
    ]));
    assert.deepEqual(unboundRatifications(dir), [{ deliverable: "floor.md", rule: "r-a", cause: "agent-proposer" }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an agent trace that names no agent still binds when its accountable person did not propose", () => {
  const dir = missionDir({ regulated: true, agentRatification: true });
  try {
    writeFileSync(join(dir, "floor.md"), floorWith(["| r-a | applied | file:src/a.ts |"], [
      agentLine("for: Ada (declared, accountable) · proposer: Bob (declared)"),
    ]));
    assert.deepEqual(unboundRatifications(dir), []);
    // and the independent case with a named agent binds too — the refusal above is about WHO proposed
    writeFileSync(join(dir, "floor.md"), floorWith(["| r-a | applied | file:src/a.ts |"], [
      agentLine("by: claude (declared, agent) · for: Ada (declared, accountable) · proposer: Bob (declared)"),
    ]));
    assert.deepEqual(unboundRatifications(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a row that is not decided is not the tier's business, and a deliverable that is absent is skipped", () => {
  const dir = missionDir({ regulated: true });
  try {
    // floor.md exists, the four other gated deliverables do not: reading them must not throw.
    writeFileSync(join(dir, "floor.md"), floorWith([
      "| r-a | applied | file:src/a.ts |",
      "| r-proposed | proposed:applied | file:src/b.ts ; proposer: Bob |",
      "| r-empty |  |  |",
    ], [`- 2026-09-28 · rows: r-a · by: Ada (declared) · bound: r-a@${DIGEST} · mode: line-by-line`]));
    assert.deepEqual(unboundRatifications(dir), [],
      "a proposal and an empty row are refused as such elsewhere; they are not also 'never ratified'");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a digest binds only when it is exactly sixteen hex characters", () => {
  const dir = missionDir({ regulated: true });
  try {
    for (const bad of [`${DIGEST}0`, `x${DIGEST}`]) {
      writeFileSync(join(dir, "floor.md"), floorWith(["| r-a | applied | file:src/a.ts |"],
        [`- 2026-09-28 · rows: r-a · by: Ada (declared) · bound: r-a@${bad} · mode: line-by-line`]));
      assert.deepEqual(unboundRatifications(dir), [{ deliverable: "floor.md", rule: "r-a", cause: "no-digest" }], bad);
    }
    // a pair without a digest binds nothing and breaks nothing
    writeFileSync(join(dir, "floor.md"), floorWith(["| r-a | applied | file:src/a.ts |"],
      ["- 2026-09-28 · rows: r-a · by: Ada (declared) · bound: r-a · mode: line-by-line"]));
    assert.deepEqual(unboundRatifications(dir), [{ deliverable: "floor.md", rule: "r-a", cause: "no-digest" }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── what the parser keeps ───────────────────────────────────────────────────────────────────────

const read = (line) => readRatification(`### Ratification\n${line}\n`)[0];

test("a declared name is read without its label, and a name without a label is read whole", () => {
  const e = read(agentLine("by: claude (declared, agent) · for: Ada Lovelace (declared, accountable) · proposer: Bob, 2026-09-27 (declared)"));
  assert.equal(e.by, "claude");
  assert.equal(e.for, "Ada Lovelace");
  assert.equal(e.proposer, "Bob, 2026-09-27");
  assert.equal(e.agent, true);
  // hand-typed: no label at all, a parenthesis that belongs to the name, a label never closed
  const h = read("- 2026-09-28 · rows: r-a · by: claude · for: Ada (Ops) · proposer: Bob (declared by HR · mode: agent");
  assert.equal(h.by, "claude");
  assert.equal(h.for, "Ada (Ops)");
  assert.equal(h.proposer, "Bob (declared by HR");
  // spacing is the operator's: extra spaces after the colon or before the label are not the name
  const s = read("- 2026-09-28 · rows: r-a · by:   claude  (declared, agent) · for:  Ada · mode: agent");
  assert.equal(s.by, "claude");
  assert.equal(s.for, "Ada");
});

test("a segment that declares nothing is not a name, and an empty name reads as undeclared", () => {
  const e = read("- 2026-09-28 · rows: r-a · forAda · by:  · for: · proposer:x · mode: agent");
  assert.deepEqual(e, { date: "2026-09-28", rows: ["r-a"], mode: "agent", bound: {}, agent: true });
});

test("the bound segment is read wherever it sits, spacing around the pairs is the operator's", () => {
  const e = read(`- 2026-09-28 · rows: r-a, r-b · bound: r-a@${DIGEST},  r-b @ ${DIGEST} · by: Ada (declared) · mode: line-by-line`);
  assert.deepEqual(e.bound, { "r-a": DIGEST, "r-b": DIGEST });
});

// ── how a declared name is compared ─────────────────────────────────────────────────────────────

test("declared names: whole token, case-insensitive, whitespace folded, labels and metacharacters inert", () => {
  assert.equal(declaredNameIn("Ada  Lovelace", "ada lovelace, 2026-09-28"), true, "runs of spaces fold in the name");
  assert.equal(declaredNameIn("Ada Lovelace", "Ada \t Lovelace (declared)"), true, "runs of spaces fold in the text");
  assert.equal(declaredNameIn("agent", "claude (declared, agent)"), false, "the trace's own label is not a name");
  assert.equal(declaredNameIn("agent", "claude(declared, agent)"), false, "with or without the space before it");
  assert.equal(declaredNameIn("claude", "claude(declared, agent)"), true, "and dropping it keeps the name before it");
  assert.equal(declaredNameIn("agent", "Bob (declared, agent), 2026-09-27"), true,
    "only a TRAILING label is runward's; anywhere else the words are the operator's, and the comparison errs towards refusing");
  assert.equal(declaredNameIn("accountable", "Ada (declared, accountable)  "), false);
  assert.equal(declaredNameIn("j.doe", "jxdoe, 2026-09-28"), false, "a dot in a name is a dot");
  assert.equal(declaredNameIn("j.doe", "j.doe, 2026-09-28"), true);
  assert.equal(declaredNameIn("c++", "c++ (declared)"), true);
  assert.equal(declaredNameIn("claude", "claude-code, 2026-09-28"), false, "claude-code is another name");
});

// ── the digest a trace carries ──────────────────────────────────────────────────────────────────

test("the row digest is stable across releases, folds whitespace, and changes with the decision", () => {
  // Persisted in every ratification line: a digest function that moves unbinds every trace written
  // by the previous release. Pinned as a golden.
  assert.equal(rowDigest(ROW), "c6022ab4c2fd9009");
  assert.equal(rowDigest({ ...ROW, evidence: "file:src/a.ts   covers  it" }), rowDigest({ ...ROW, evidence: "file:src/a.ts covers it" }),
    "re-aligning the words of a cell does not unbind");
  assert.notEqual(rowDigest({ ...ROW, evidence: "file:src/a .ts" }), rowDigest({ ...ROW, evidence: "file:src/a.ts" }),
    "a space inside the evidence is part of the decision");
});

// ── the ledger ──────────────────────────────────────────────────────────────────────────────────

test("the ledger lists each agent and accountable pair apart, sorted, and names what was not declared", () => {
  const dir = missionDir();
  try {
    mkdirSync(join(dir, "governance"));
    writeFileSync(join(dir, "floor.md"), floorWith([
      "| r-1 | applied | file:a.ts |", "| r-2 | applied | file:a.ts |", "| r-3 | applied | file:a.ts |",
      "| r-4 | applied | file:a.ts |", "| r-5 | applied | file:a.ts |",
    ], [
      "- 2026-09-28 · rows: r-1 · by: zed (declared, agent) · for: Ada (declared, accountable) · mode: agent",
      "- 2026-09-28 · rows: r-2 · by: bot (declared, agent) · for: Zoe (declared, accountable) · mode: agent",
      "- 2026-09-28 · rows: r-3, r-4 · by: bot (declared, agent) · for: Ada (declared, accountable) · mode: agent",
      "- 2026-09-28 · rows: r-5 · mode: agent",
    ]));
    const led = ratificationLedger(dir);
    assert.equal(led.agent, 5);
    assert.deepEqual(led.agents, [
      { agent: "(undeclared)", for: "(undeclared)", rows: 1 },
      { agent: "bot", for: "Ada", rows: 2 },
      { agent: "bot", for: "Zoe", rows: 1 },
      { agent: "zed", for: "Ada", rows: 1 },
    ]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the committed opt-in ────────────────────────────────────────────────────────────────────────

test("an agent's ratification is never counted by a mission that did not commit the opt-in", () => {
  // `ratify --decided` reads unboundRatifications whatever the tier: a mission with no lock, or a
  // lock nobody can parse, has declared nothing, and an agent trace stays a named gap there.
  for (const lock of [undefined, "{ not json", JSON.stringify({ regulated: true }), JSON.stringify({ agentRatification: "true" })]) {
    const dir = missionDir(lock);
    try {
      writeFileSync(join(dir, "floor.md"), floorWith(["| r-a | applied | file:src/a.ts |"], [
        agentLine("by: claude (declared, agent) · for: Ada (declared, accountable) · proposer: Bob (declared)"),
      ]));
      assert.deepEqual(unboundRatifications(dir), [{ deliverable: "floor.md", rule: "r-a", cause: "agent-not-accepted" }], String(lock));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
