// `update` names the rules it newly gates (RWD-2026-0174, TOR-246). Reported by an adopter: the
// refresh added rules to the corpus and its summary read "4 added, 85 refreshed"; the next
// `check --strict` was red with rows missing and a `manifest --sync` hint the update had not given.
// The scenario below is that shape on the reference mission: its copy of one CRITICAL rule is an
// older release's, mapped to no phase and recorded as runward wrote it, and its floor manifest has
// no row for it. The refresh maps the rule to `floor`, so the gate starts expecting a row.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { hashText } from "../../dist/lib/scaffold-lock.js";
import { newlyGatedRules, ruleFiles } from "../../dist/lib/conformance.js";

const CLI = join(process.cwd(), "dist/cli.js");
const RULE = "frontier-deterministic-boundary";
const run = (cwd, args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", ...env } });

function staleMission() {
  const root = mkdtempSync(join(tmpdir(), "rw-newly-gated-"));
  spawnSync("git", ["init", "-q", "."], { cwd: root });
  run(root, ["init", "--yes", "--example"]);
  assert.equal(run(root, ["check", "--strict"]).status, 0, "the reference mission is green before anything is measured");
  const rule = join(root, "runward/rules", `${RULE}.md`);
  const old = readFileSync(rule, "utf8").replace("phases: [floor]", "phases: []");
  assert.notEqual(old, readFileSync(rule, "utf8"), "the scenario edits the mapping it relies on");
  writeFileSync(rule, old);
  const lockPath = join(root, "runward/scaffold-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.files[`rules/${RULE}.md`] = hashText(old); // what an older release wrote: `update` calls it upstream
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  const floor = join(root, "runward/floor.md");
  writeFileSync(floor, readFileSync(floor, "utf8").split("\n").filter((l) => !l.startsWith(`| ${RULE} |`)).join("\n"));
  return root;
}

test("RWD-2026-0174: update names each rule it newly gates and the manifest --sync that follows", () => {
  const root = staleMission();
  try {
    const out = run(root, ["update"]);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /updated runward\/rules\/frontier-deterministic-boundary\.md \(changed upstream\)/);
    assert.match(out.stdout, /1 rule\(s\) newly expected by `runward check --strict` for this mission, 1 without a row yet:/);
    assert.match(out.stdout, /runward\/floor\.md · frontier-deterministic-boundary \(no row yet\)/);
    assert.match(out.stdout, /Run runward manifest --sync to scaffold the 1 missing row\(s\)/);
    // the notice and the gate agree: the rule it named is the row check --strict now misses
    const strict = run(root, ["check", "--strict", "--json"]);
    assert.equal(strict.status, 1);
    const missing = JSON.parse(strict.stdout).conformance.filter((r) => r.kind === "missing-row").map((r) => r.rule);
    assert.deepEqual(missing, [RULE]);
    // positive control in the other direction: a second update gates nothing new and says nothing
    const again = run(root, ["update"]);
    assert.doesNotMatch(again.stdout, /Newly gated|newly expected/);
    assert.match(again.stdout, /Re-run runward check to re-verify the gate/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("RWD-2026-0174: a dry run names the same newly gated rules and writes nothing", () => {
  const root = staleMission();
  try {
    const before = readFileSync(join(root, "runward/rules", `${RULE}.md`), "utf8");
    const out = run(root, ["update"], { RUNWARD_DRY_RUN: "1" });
    assert.match(out.stdout, /runward\/floor\.md · frontier-deterministic-boundary \(no row yet\)/);
    assert.equal(readFileSync(join(root, "runward/rules", `${RULE}.md`), "utf8"), before, "a dry run writes nothing");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("RWD-2026-0174: a newly gated rule whose row is already there is named as present, and needs no sync", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-newly-gated-unit-"));
  try {
    spawnSync("git", ["init", "-q", "."], { cwd: root });
    run(root, ["init", "--yes", "--example"]);
    const m = join(root, "runward");
    const after = ruleFiles(m);
    const before = new Map(after);
    before.set(`${RULE}.md`, after.get(`${RULE}.md`).replace("phases: [floor]", "phases: []"));
    // the reference floor manifest carries the row: newly gated, present
    assert.deepEqual(newlyGatedRules(m, before, after), [{ deliverable: "floor.md", rule: RULE, hasRow: true }]);
    // control: an identical rule set gates nothing new
    assert.deepEqual(newlyGatedRules(m, after, after), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
