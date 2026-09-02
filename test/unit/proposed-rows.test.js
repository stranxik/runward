// A proposal never crosses (ADR-0066, P1: the grammar and the refusal).
//
// The status grammar gains `proposed:applied | proposed:deviated | proposed:n/a`. The gate refuses
// every proposed row with a DEDICATED cause and a dedicated counter — never an anonymous invalid
// status: the whole mechanism rests on the gate seeing a proposal and saying exactly what it is
// waiting for. The grammar's decisive safety property is that it FAILS CLOSED on every deployed
// binary: `proposed:applied` reads as an invalid status everywhere before 0.38, so no mission
// carrying proposals can pass green on an older runward — and this file pins the 0.38 half of that
// intent: a proposal must never be COUNTED as its underlying status anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proposedStatus, readRatification, ratificationLedger } from "../../dist/lib/conformance.js";
import { evidenceBreakdown } from "../../dist/lib/evidence.js";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

function exampleMission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-prop-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init", "--example");
  return dir;
}
const propose = (dir, rule) => {
  const p = join(dir, "runward", "floor.md");
  writeFileSync(p, readFileSync(p, "utf8").replace(`| ${rule} | applied |`, `| ${rule} | proposed:applied |`));
};

// ── the grammar itself ───────────────────────────────────────────────────────────────────────────

test("proposedStatus recognises exactly the three proposals, and nothing that merely resembles one", () => {
  assert.equal(proposedStatus("proposed:applied"), "applied");
  assert.equal(proposedStatus("proposed:deviated"), "deviated");
  assert.equal(proposedStatus("proposed:n/a"), "n/a");
  for (const not of ["applied", "proposed", "proposed:", "proposed:accepted", "proposal:applied", ""]) {
    assert.equal(proposedStatus(not), null, `"${not}" must not read as a proposal`);
  }
});

// ── the refusal ──────────────────────────────────────────────────────────────────────────────────

test("a proposed row is refused with its dedicated cause and its dedicated counter", () => {
  const dir = exampleMission();
  try {
    propose(dir, "frontier-deterministic-boundary");
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 1, "a proposal never crosses");
    assert.match(out, /proposed:applied awaits ratification — a proposal is not a decision/,
      "the refusal must say what the gate is waiting for, never an anonymous invalid status");
    assert.match(out, /1 proposed row\(s\) awaiting ratification/,
      "the summary counts proposals apart from ordinary conformance gaps");
    const j = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.equal(j.gaps.proposed, 1, "the machine contract carries the dedicated counter");
    assert.equal(j.exitCode, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a proposal is never counted as its underlying status — the 0.38 half of fail-closed", () => {
  const dir = exampleMission();
  try {
    const before = evidenceBreakdown(join(dir, "runward"));
    propose(dir, "frontier-deterministic-boundary");
    const after = evidenceBreakdown(join(dir, "runward"));
    assert.equal(after.applied, before.applied - 1,
      "a proposed:applied row left the applied bucket — it must never be silently promoted");
    assert.equal(after.rows, before.rows, "the row itself is still a row");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a mission carrying proposals cannot be sealed", () => {
  // `--freeze` refuses a red gate, and proposals are strict gaps: one never seals a mission whose
  // decisions are not decisions yet — by construction, not by a special case.
  const dir = exampleMission();
  try {
    propose(dir, "frontier-deterministic-boundary");
    const { code } = run(dir, "check", "--strict", "--freeze");
    assert.equal(code, 1, "freeze must refuse over pending proposals");
    assert.ok(!existsSync(join(dir, "runward", "evidence-lock.json")),
      "no seal may be written over a mission with pending proposals");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the ratification ledger ──────────────────────────────────────────────────────────────────────

test("the Ratification block parses by its line grammar, and any heading ends it", () => {
  const entries = readRatification([
    "## Rule conformance", "",
    "| Rule | Status | Evidence |", "|---|---|---|",
    "| r-one | applied | file:a.ts |", "",
    "### Ratification", "",
    "- 2026-09-03 · rows: r-one, r-two · by: Someone (declared) · mode: line-by-line",
    "- 2026-09-04 · rows: r-three (1) · by: Someone (declared) · proposer: an-agent (declared) · mode: en bloc (sample 1/3)",
    "- 2026-09-05 · rows: r-four · by: Someone (declared) · mode: BLIND",
    "not an entry line",
    "## Next section",
    "- 2026-09-06 · rows: r-five · by: X · mode: line-by-line",
  ].join("\n"));
  assert.equal(entries.length, 3, "three entries inside the block; the one after the heading is outside it");
  assert.deepEqual(entries[0].rows, ["r-one", "r-two"]);
  assert.deepEqual(entries[1].rows, ["r-three"], "a trailing count annotation is not a row name");
  assert.equal(entries[1].mode, "en bloc (sample 1/3)");
  assert.equal(entries[2].mode, "BLIND");
});

test("the ledger counts modes per row and names the untraced decided rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-ledger-"));
  try {
    mkdirSync(join(dir, "governance"), { recursive: true });
    writeFileSync(join(dir, "floor.md"), [
      "# Floor", "", "## Rule conformance", "",
      "| Rule | Status | Evidence |", "|---|---|---|",
      "| r-traced | applied | file:a.ts |",
      "| r-untraced | n/a | a real reason of real length |",
      "| r-proposed | proposed:applied | file:b.ts |", "",
      "### Ratification", "",
      "- 2026-09-03 · rows: r-traced · by: Someone (declared) · mode: line-by-line", "",
    ].join("\n"));
    const led = ratificationLedger(dir);
    assert.deepEqual(led, { rows: 1, lineByLine: 1, enBloc: 0, blind: 0, untraced: 1 },
      "one traced decision, one untraced decision; a PROPOSED row is not decided and never counts as untraced");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the disclosure line prints, never gates, and the machine contract re-derives the posture", () => {
  const dir = exampleMission();
  try {
    const floor = join(dir, "runward", "floor.md");
    writeFileSync(floor, readFileSync(floor, "utf8")
      + "\n### Ratification\n\n- 2026-09-03 · rows: frontier-deterministic-boundary · by: T (declared) · mode: line-by-line\n");
    const { out, code } = run(dir, "check", "--strict");
    assert.equal(code, 0, "the untraced counter discloses, it never gates (ADR-0060's shape)");
    // The first cut of the stranded-proposal detector read cells[1] before the length guard and
    // crashed on every 2-cell table line (separators included) — caught by the repository's own
    // gate, not by this suite, because a crash and a refusal share exit code 1. Pin the difference.
    assert.doesNotMatch(out, /Cannot read properties/, "a crash is not a verdict");
    assert.match(out, /decided row\(s\) carry no ratification trace/,
      "the posture is said where the operator reads");
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.ratification.rows, 1);
    assert.equal(v.ratification.lineByLine, 1);
    assert.ok(v.ratification.untraced > 0, "the example's hand-decided rows are untraced, and that is the legitimate solo path");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
