// `check --json` carried no next step: the gesture lived only in the terminal's "Next" line, and an
// agent driving on the machine contract had to rebuild it from the counts (RWD-2026-0145). The
// payload now carries `next`, from the same nextStep() the terminal renders, and `verify`
// re-derives its action.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-28" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-json-next-"));
  assert.equal(run(dir, "--yes", "init", "--example").status, 0);
  return dir;
}
/** The terminal's Next line, as printed (NO_COLOR). */
const terminalNext = (out) => out.split(/\r?\n/).slice(out.split(/\r?\n/).findIndex((l) => l === "Next") + 2).find((l) => l.trim())?.trim();

test("json next: a green run names the same gesture the terminal prints", () => {
  const dir = example();
  try {
    const j = JSON.parse(run(dir, "check", "--strict", "--json").stdout);
    assert.equal(j.next.action, "assemble-evidence-pack");
    assert.equal(j.next.rerun, null);
    assert.equal(j.next.text, terminalNext(run(dir, "check", "--strict").stdout));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("json next: a red strict run names the strict gate to re-run, as the terminal does", () => {
  const dir = example();
  try {
    const f = join(dir, "runward", "handover.md");
    writeFileSync(f, readFileSync(f, "utf8").replace(/^(\| handover-agents-charter-final \| )applied( \|)/m, "$1$2"));
    const r = run(dir, "check", "--strict", "--json");
    assert.equal(r.status, 1);
    const j = JSON.parse(r.stdout);
    assert.equal(j.next.action, "close-conformance-gaps");
    assert.equal(j.next.command, "runward check --strict");
    assert.equal(j.next.rerun, "runward check --strict");
    assert.equal(j.next.text, terminalNext(run(dir, "check", "--strict").stdout));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("json next: verify re-derives next.action and refuses a forged one", () => {
  const dir = example();
  const out = mkdtempSync(join(tmpdir(), "rw-json-next-att-"));
  try {
    const att = join(out, "att.json");
    writeFileSync(att, run(dir, "check", "--strict", "--attest").stdout);
    const ok = JSON.parse(run(dir, "verify", att, "--json").stdout);
    assert.equal(ok.verified, true);
    assert.ok(ok.predicate.notReDerived.includes("next.text"), "the invocation echo is named, not blessed");
    const s = JSON.parse(readFileSync(att, "utf8"));
    s.predicate.next.action = "rerun";
    writeFileSync(att, JSON.stringify(s));
    const bad = run(dir, "verify", att, "--json");
    assert.equal(bad.status, 1);
    assert.deepEqual(JSON.parse(bad.stdout).predicate.differing, ["next.action"]);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); }
});
