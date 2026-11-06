// ADR-0124 decision 1: one bar for a decision record.
//
// Measured on the saboteur corpus of 2026-11-05, replayed on the integration train of 2026-11-06: an ADR
// of the shipped example replaced by a 47-character stub (a title, `**Status**: accepted`, "Nothing
// here.") left `check --strict` green, sealed or not. The evidence layer (`adrDecision`) took any file
// over 40 characters whose status is accepted for a decision, while the structure contract, which the
// example opts into, set the same file aside in the same run ("no **Date** line") and only left it out
// of a count. One question, two answers. `adrDecision` now asks the journal's own function, on the
// mission's own journal, under the mission's opt-in. Each refusal below is paired with the acceptance
// that keeps the bar from refusing what it must not: a complete record, a mission without the opt-in, a
// journal outside the mission kept in another tool's format.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adrDecision } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });

const STUB = (n, status = "accepted") => `# ADR-${n}\n\n**Status**: ${status}\n\nNothing here.\n`;
const RECORD = (n) => `# ADR-${n}: a decision\n\n**Date**: 2026-11-06\n**Status**: accepted\n\n## Context\n\n` +
  "A context long enough to read as one, written for this test.\n\n## Decision\n\nThe decision this record carries.\n\n" +
  "## Reevaluation trigger (mandatory, dated)\n\nReopen when the measured signal moves, set on 2026-11-06.\n";
// The format another tool writes (a plain `Date:` and a `## Status` section, no bold labels).
const OTHER_FORMAT = "# 42. Keep the boundary in the lint configuration\n\nDate: 2026-05-12\n\n## Status\n\nAccepted\n\n" +
  "## Context\n\nThe boundary is enforced by the lint rule rather than by a package split.\n\n" +
  "## Decision\n\nThe lint rule refuses infrastructure imports in the core.\n";

/** A project with a bare mission: a lock that opts into the structure contract, or not. */
function project({ armed }) {
  const root = mkdtempSync(join(tmpdir(), "rw-one-bar-"));
  const mission = join(root, "runward");
  mkdirSync(join(mission, "adr"), { recursive: true });
  writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify({ version: 1, files: {}, ...(armed ? { structureContract: true } : {}) }));
  return { root, mission };
}

test("under the structure contract, a stub left accepted in the mission's journal carries no decision", () => {
  const { root, mission } = project({ armed: true });
  try {
    writeFileSync(join(mission, "adr", "ADR-0001-stub.md"), STUB("0001"));
    assert.match(adrDecision(mission, "ADR-0001") ?? "",
      /^ADR-0001-stub\.md is not a decision record under the structure contract \(no "\*\*Date\*\*: YYYY-MM-DD" line\): the journal sets it aside, so nothing may rest on it$/);
    // The positive control: the same id, a complete record, is a decision.
    writeFileSync(join(mission, "adr", "ADR-0001-stub.md"), RECORD("0001"));
    assert.equal(adrDecision(mission, "ADR-0001"), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("without the opt-in nothing moves: the same stub reads as a decision, as before", () => {
  const { root, mission } = project({ armed: false });
  try {
    writeFileSync(join(mission, "adr", "ADR-0001-stub.md"), STUB("0001"));
    assert.equal(adrDecision(mission, "ADR-0001"), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a status refusal keeps its words: a proposed stub is unratified before it is incomplete", () => {
  const { root, mission } = project({ armed: true });
  try {
    writeFileSync(join(mission, "adr", "ADR-0001-stub.md"), STUB("0001", "proposed"));
    assert.match(adrDecision(mission, "ADR-0001") ?? "", /is not ratified \(proposed\)/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a journal outside the mission keeps its reading, whatever format it is kept in", () => {
  const { root, mission } = project({ armed: true });
  try {
    rmSync(join(mission, "adr"), { recursive: true });
    mkdirSync(join(root, "docs", "adr"), { recursive: true });
    writeFileSync(join(root, "docs", "adr", "ADR-0042-keep-the-boundary.md"), OTHER_FORMAT);
    writeFileSync(join(root, "docs", "adr", "ADR-0043-stub.md"), STUB("0043"));
    assert.equal(adrDecision(mission, "ADR-0042"), null, "a record in another tool's format is a decision, as before");
    // The limit ADR-0124 names: the bar applies where the journal count applies it, the mission's own
    // adr/. A stub kept outside the mission is read as before.
    assert.equal(adrDecision(mission, "ADR-0043"), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-one-bar-ex-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
  return dir;
}

test("end to end: the corpus's g2 and g4 are refused, sealed or not, and the example as shipped crosses", () => {
  const dir = example();
  try {
    const sealed = check(dir, "--strict", "--freeze");
    assert.equal(sealed.status, 0, `positive control: the example crosses and seals as shipped\n${sealed.stdout}`);
    const adrDir = join(dir, "runward", "adr");
    const g4 = join(adrDir, "ADR-0002-deterministic-guard-on-extracted-fields.md");
    const original = readFileSync(g4, "utf8");
    writeFileSync(g4, STUB("0002"));
    const r4 = check(dir, "--strict");
    assert.equal(r4.status, 1, r4.stdout);
    assert.match(r4.stdout, /"Deterministic guard on extracted fields" cites ADR-0002, which cannot be cited: ADR-0002-deterministic-guard-on-extracted-fields\.md is not a decision record under the structure contract \(no "\*\*Date\*\*: YYYY-MM-DD" line\)/,
      "g4: the architecture note's decision table no longer reads the stub as a decision");
    writeFileSync(g4, original);
    const g2 = join(adrDir, "ADR-0001-single-orchestrator.md");
    writeFileSync(g2, STUB("0001"));
    const r2 = check(dir, "--strict");
    assert.equal(r2.status, 1, r2.stdout);
    assert.match(r2.stdout, /typed pointer adr:0001 — ADR-0001-single-orchestrator\.md is not a decision record under the structure contract/,
      "g2: the `adr:` pointer no longer resolves to the stub");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
