// `gaps.proposed` and `gaps.unboundRows` are subsets of `gaps.conformance`, while `deliverables`,
// `conformance` and `hooks` are disjoint; nothing said so, and an agent summing the object counted
// the same rows twice (RWD-2026-0146). The numbers do not change: the contract now says it, and
// this test pins both the inclusion and the sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-28", COLUMNS: "400" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

test("gaps doc: a proposal is counted inside gaps.conformance, not beside it", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-gaps-doc-"));
  try {
    assert.equal(run(dir, "--yes", "init", "--example").status, 0);
    const f = join(dir, "runward", "architecture.md");
    writeFileSync(f, readFileSync(f, "utf8").replace("| applied |", "| proposed:applied |"));
    const j = JSON.parse(run(dir, "check", "--strict", "--json").stdout);
    assert.equal(j.gaps.proposed, 1);
    assert.equal(j.gaps.conformance, 1, "one proposal, one gap: proposed is a subset, never an addend");
    assert.equal(j.conformance.length, j.gaps.conformance, "the array holds exactly what gaps.conformance counts");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("gaps doc: the check --json help says the sub-counts are inside gaps.conformance", () => {
  const help = run(ROOT, "check", "--help").stdout.replace(/\s+/g, " ");
  assert.match(help, /gaps\.proposed and gaps\.unboundRows are already inside gaps\.conformance, never added to it/);
  const src = readFileSync(join(ROOT, "src", "lib", "check-contract.ts"), "utf8");
  assert.match(src, /`proposed` and\s+\/\/ `unboundRows` are SUBSETS of it/, "the payload's own comment says it where the field is built");
});
