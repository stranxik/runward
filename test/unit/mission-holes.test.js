// These tests kill holes filed on 2026-11-04 in docs/compliance/mutation-survivors: survivors of
// dist/lib/mission.js measured on `init --example` missions. Two families:
// - the name a mission declares (MISSION_CONTRACT_TITLE, declaredMissionName), which only the
//   `check --attest` statement carries (subject name and predicate `mission`), so it is read there;
// - STRUCTURE conditions that no test broke alone: the observability schema's Carrier field (a
//   backticked literal token) while the cost ceilings still carry numbers, the Cost ceilings
//   heading as the file's last line with no newline, and the hand-over's untyped Evidence line.
// Each test asserts an observable (exit code, message, attested name) and carries its positive control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "cli.js");
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function rw(cwd, ...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  return { code: r.status, stdout: r.stdout ?? "", out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function example() {
  const d = mkdtempSync(join(tmpdir(), "rw-mission-holes-"));
  dirs.push(d);
  assert.equal(rw(d, "init", "--example").code, 0);
  return d;
}

// ---------------------------------------------------------------------------------------------
// The declared mission name, as `check --attest` attests it.

const TITLE = "# Mission Contract: Inbound Request Triage";

function attestedName(d, titleLine) {
  const f = join(d, "runward", "mission-contract.md");
  const text = readFileSync(f, "utf8");
  const at = text.indexOf(TITLE);
  assert.ok(at >= 0, "the example's contract opens with its title");
  // Only the title line changes; the contract is restored after each read.
  writeFileSync(f, text.slice(0, at) + titleLine + text.slice(at + TITLE.length));
  try {
    const r = rw(d, "check", "--strict", "--attest");
    const stmt = JSON.parse(r.stdout);
    assert.equal(stmt.predicate.mission, stmt.subject[0].name, "subject and predicate name the same mission");
    return stmt.subject[0].name;
  } finally {
    writeFileSync(f, text);
  }
}

test("the declared name: the H1 title is read whatever blanks surround it, and only an H1", () => {
  const d = example();
  // Positive control: the example's own title is attested as written.
  assert.equal(attestedName(d, TITLE), "Inbound Request Triage");
  // An H2 is not the contract's title: the mission is undeclared (the anchor `^` holds).
  assert.equal(attestedName(d, "## Mission Contract: Inbound Request Triage"), "mission");
  // Several blanks after `#` still make an H1.
  assert.equal(attestedName(d, "#  Mission Contract: Inbound Request Triage"), "Inbound Request Triage");
  assert.equal(attestedName(d, "#\t\tMission Contract: Inbound Request Triage"), "Inbound Request Triage");
  // No blank after the colon: the whole name is still declared, first word included.
  assert.equal(attestedName(d, "# Mission Contract:Inbound Request Triage"), "Inbound Request Triage");
  // An empty title is undeclared; the next line of the contract is never taken for a name.
  assert.equal(attestedName(d, "# Mission Contract:"), "mission");
  assert.equal(attestedName(d, "# Mission Contract:   "), "mission");
});

test("the declared name: an invisible no-break space around the name is not attested", () => {
  const d = example();
  assert.equal(attestedName(d, TITLE), "Inbound Request Triage");
  assert.equal(attestedName(d, "# Mission Contract: Inbound Request Triage "), "Inbound Request Triage");
  assert.equal(attestedName(d, "# Mission Contract:  Inbound Request Triage"), "Inbound Request Triage");
});

test("the declared name: only a whole-bracket title is the scaffold placeholder", () => {
  const d = example();
  // Positive control: the scaffold's placeholder is undeclared.
  assert.equal(attestedName(d, "# Mission Contract: [Name of the system]"), "mission");
  // A real name that merely starts with a bracket is declared.
  assert.equal(attestedName(d, "# Mission Contract: [Triage] inbound requests"), "[Triage] inbound requests");
});

// ---------------------------------------------------------------------------------------------
// STRUCTURE: observability-schema.md and handover.md conditions, each broken alone.

const CARRIER_MSG = /the Carrier field reads "request_id in logs, events and metrics\." and names no backticked literal token/;
const NO_NUMBER = /the cost ceilings carry no number/;

test("observability schema: an unbackticked Carrier field is refused while the cost ceilings carry numbers", () => {
  const d = example();
  const f = join(d, "runward", "governance", "observability-schema.md");
  const text = readFileSync(f, "utf8");
  const line = "- **Carrier field**: `request_id` in logs";
  assert.ok(text.includes(line), "the example's Carrier field is a backticked token");
  // Positive control: the example passes, its ceilings carry numbers.
  const ok = rw(d, "check", "--strict");
  assert.equal(ok.code, 0);
  assert.doesNotMatch(ok.out, CARRIER_MSG);
  // The carrier half alone: no backtick, ceilings untouched.
  writeFileSync(f, text.replace(line, "- **Carrier field**: request_id in logs"));
  const r = rw(d, "check", "--strict");
  assert.equal(r.code, 1);
  assert.match(r.out, CARRIER_MSG);
  assert.doesNotMatch(r.out, NO_NUMBER);
  // The template's bracketed placeholder is not judged by this condition.
  writeFileSync(f, text.replace(line, "- **Carrier field**: [the field name] in logs"));
  assert.doesNotMatch(rw(d, "check", "--strict").out, /the Carrier field reads/);
});

test("observability schema: the Cost ceilings heading as the file's last line, with or without a newline, carries no number", () => {
  const d = example();
  const f = join(d, "runward", "governance", "observability-schema.md");
  const text = readFileSync(f, "utf8");
  const heading = "## 5. Cost ceilings";
  const at = text.indexOf(heading);
  assert.ok(at >= 0, "the example's schema has a Cost ceilings section");
  // Positive control: the full section passes.
  assert.doesNotMatch(rw(d, "check", "--strict").out, NO_NUMBER);
  for (const tail of ["\n", ""]) {
    writeFileSync(f, text.slice(0, at + heading.length) + tail);
    const r = rw(d, "check", "--strict");
    assert.equal(r.code, 1, `heading ${JSON.stringify(tail)}`);
    assert.match(r.out, NO_NUMBER, `the heading's own digit does not count (tail ${JSON.stringify(tail)})`);
  }
});

test("hand-over: a redone-task Evidence line without a typed pointer is refused", () => {
  const d = example();
  const f = join(d, "runward", "handover.md");
  const text = readFileSync(f, "utf8");
  const m = text.match(/^- \*\*Evidence\*\*: file:[^\n]*$/m);
  assert.ok(m, "the example's redone task carries typed evidence");
  // Positive control: typed evidence passes.
  const ok = rw(d, "check", "--strict");
  assert.equal(ok.code, 0);
  assert.doesNotMatch(ok.out, /carries no typed pointer/);
  writeFileSync(f, text.replace(m[0], "- **Evidence**: the test suite and the runbook recovery section"));
  const r = rw(d, "check", "--strict");
  assert.equal(r.code, 1);
  assert.match(r.out, /the redone task's Evidence line reads "the test suite and the runbook recovery " and carries no typed pointer/);
});
