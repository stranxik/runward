// ADR-0080, part 1: the regulated tier. Under the mission's committed opt-in (`"regulated": true` in
// scaffold-lock.json) and --strict, a decided row counts only when a ratification binds to its
// current content. What is pinned here, criterion by criterion: without the flag nothing moves; with
// it every untraced row is a named strict gap; `ratify --decided` binds a hand-decided row; a changed
// row loses its binding; a hand-typed entry without a digest does not bind; BLIND does not bind and
// is printed; `update` keeps the flag; `verify` re-derives the new term; the forge approval is said
// to be unverified here, never counted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listDecidedUnbound, applyDecisions } from "../../dist/lib/ratify.js";
import { unboundRatifications, rowDigest, parseManifest } from "../../dist/lib/conformance.js";
import { renderScaffoldLock } from "../../dist/lib/scaffold-lock.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};
const json = (dir) => JSON.parse(run(dir, "check", "--strict", "--json").out);

function example({ regulated }) {
  const dir = mkdtempSync(join(tmpdir(), "rw-regulated-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init", "--example");
  if (regulated) {
    const lock = join(dir, "runward", "scaffold-lock.json");
    const j = JSON.parse(readFileSync(lock, "utf8"));
    j.regulated = true;
    writeFileSync(lock, JSON.stringify(j, null, 2) + "\n");
  }
  return dir;
}

/** Ratify every unbound decided row, line by line, as `ratify --decided` would after the operator
 *  accepted each one on sight. */
function ratifyAll(dir, mode = "line-by-line") {
  const mission = join(dir, "runward");
  const rows = listDecidedUnbound(mission, dir);
  applyDecisions(mission, rows, rows.map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" })),
    { by: "The Operator", date: "2026-09-27", mode });
  return rows.length;
}

test("ADR-0080: without the flag the tier changes nothing — the example stays clean and the payload keeps its shape", () => {
  const dir = example({ regulated: false });
  try {
    const r = run(dir, "check", "--strict");
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.out, /forge approval/);
    const p = json(dir);
    assert.equal(p.regulated, undefined, "the field is absent, not empty, without the opt-in");
    assert.equal(p.gaps.unboundRows, undefined);
    assert.ok(p.ratification.untraced > 0, "the disclosure still counts untraced rows");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: under the flag every decided row without a bound ratification is a named strict gap", () => {
  const dir = example({ regulated: true });
  try {
    const r = run(dir, "check", "--strict");
    assert.equal(r.code, 1, "the example goes red under the tier: its rows were never ratified");
    assert.match(r.out, /decided row\(s\) not ratified/);
    assert.match(r.out, /forge approval: not verified by this command/, "part 2 is named as unverified here, never green");
    assert.match(r.out, /runward ratify --decided/, "the Next gesture names the command that closes it");
    const p = json(dir);
    assert.equal(p.gaps.unboundRows, p.ratification.untraced, "every untraced decided row is counted");
    assert.ok(p.gaps.unboundRows > 0);
    assert.ok(p.regulated.unbound.every((u) => u.cause === "no-trace"));
    assert.equal(p.regulated.forgeApproval, "not verified by this command");
    assert.equal(p.conformance.filter((c) => c.scope === "ratification").length, p.gaps.unboundRows);
    const sarif = JSON.parse(run(dir, "check", "--strict", "--sarif").out);
    assert.equal(sarif.runs[0].results.filter((x) => x.ruleId === "runward/unratified-row").length, p.gaps.unboundRows);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: `ratify --decided` binds hand-decided rows, and the gate closes without changing a row", () => {
  const dir = example({ regulated: true });
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    const rowsBefore = parseManifest(before);
    assert.ok(ratifyAll(dir) > 0);
    const after = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    assert.deepEqual(parseManifest(after), rowsBefore, "ratifying a decided row records a trace; the rows are untouched");
    assert.match(after, /· bound: [a-z0-9-]+@[0-9a-f]{16}/);
    assert.equal(run(dir, "check", "--strict").code, 0);
    assert.equal(run(dir, "ratify", "--decided").out.includes("nothing to ratify"), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: a row rewritten after its ratification loses its binding; re-aligning whitespace does not", () => {
  const dir = example({ regulated: true });
  try {
    ratifyAll(dir);
    const p = join(dir, "runward", "floor.md");
    const content = readFileSync(p, "utf8");
    const row = parseManifest(content).find((r) => r.status === "n/a");
    assert.ok(row, "the example carries an n/a row to rewrite");
    const line = content.split("\n").find((l) => l.startsWith(`| ${row.rule} |`));
    const realigned = line.replace(/ (\S+) \|$/, "  $1   |").replace(/ ([^ |]+ [^ |]+)/, (m) => m.replace(" ", "  "));
    assert.notEqual(realigned, line, "the fixture really re-aligns the row");
    assert.ok(/\S  \S/.test(realigned), "an INTERNAL run of spaces, which the cell trim alone would keep");
    writeFileSync(p, content.replace(line, realigned));
    assert.deepEqual(unboundRatifications(join(dir, "runward")), [], "whitespace is folded out of the digest");
    writeFileSync(p, content.replace(line, `| ${row.rule} | n/a | a different reason, written after the ratification |`));
    assert.deepEqual(unboundRatifications(join(dir, "runward")), [{ deliverable: "floor.md", rule: row.rule, cause: "changed" }]);
    assert.equal(run(dir, "check", "--strict").code, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: a hand-typed entry without a digest does not bind, and the last entry naming a row speaks for it", () => {
  const dir = example({ regulated: true });
  try {
    ratifyAll(dir);
    const p = join(dir, "runward", "floor.md");
    const row = parseManifest(readFileSync(p, "utf8")).find((r) => r.status === "applied");
    writeFileSync(p, readFileSync(p, "utf8").replace(/\s*$/, "\n") + `- 2026-09-28 · rows: ${row.rule} · by: Someone (declared) · mode: line-by-line\n`);
    assert.deepEqual(unboundRatifications(join(dir, "runward")), [{ deliverable: "floor.md", rule: row.rule, cause: "no-digest" }]);
    // a digest that is not this row's does not bind either
    writeFileSync(p, readFileSync(p, "utf8") + `- 2026-09-29 · rows: ${row.rule} · by: Someone (declared) · bound: ${row.rule}@${rowDigest({ ...row, evidence: "x" })} · mode: line-by-line\n`);
    assert.equal(unboundRatifications(join(dir, "runward"))[0].cause, "changed");
    writeFileSync(p, readFileSync(p, "utf8") + `- 2026-09-30 · rows: ${row.rule} · by: Someone (declared) · bound: ${row.rule}@${rowDigest(row)} · mode: line-by-line\n`);
    assert.deepEqual(unboundRatifications(join(dir, "runward")), [], "a correct digest binds — a record, not proof of the gesture (RWD-2026-0119)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: BLIND does not bind under the tier, and the terminal prints it with or without the tier", () => {
  const dir = example({ regulated: true });
  try {
    const r = run(dir, "ratify", "--decided", "--attest-blind");
    assert.match(r.out, /ratified BLIND/);
    const c = run(dir, "check", "--strict");
    assert.equal(c.code, 1);
    assert.match(c.out, /row\(s\) ratified BLIND/, "ADR-0066 decision 4: the terminal discloses BLIND");
    assert.ok(json(dir).regulated.unbound.every((u) => u.cause === "blind"));
    const lock = join(dir, "runward", "scaffold-lock.json");
    const j = JSON.parse(readFileSync(lock, "utf8"));
    delete j.regulated;
    writeFileSync(lock, JSON.stringify(j, null, 2) + "\n");
    const off = run(dir, "check", "--strict");
    assert.equal(off.code, 0, "without the tier BLIND is disclosed, not counted");
    assert.match(off.out, /row\(s\) ratified BLIND/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: `update` preserves the flag, and the lock writer emits it only when set", () => {
  assert.doesNotMatch(renderScaffoldLock("x", {}, null, true, false), /regulated/);
  assert.match(renderScaffoldLock("x", {}, null, true, true), /"regulated": true/);
  const dir = example({ regulated: true });
  try {
    run(dir, "update");
    const j = JSON.parse(readFileSync(join(dir, "runward", "scaffold-lock.json"), "utf8"));
    assert.equal(j.regulated, true, "a refresh must not disarm the tier (the RWD-2026-0106 shape)");
    assert.equal(j.structureContract, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0080: `verify` re-derives the tier's count, and a payload that drops it is refused", () => {
  const dir = example({ regulated: true });
  try {
    const att = run(dir, "check", "--strict", "--attest").out;
    const file = join(dir, "v.intoto.json");
    writeFileSync(file, att);
    assert.equal(run(dir, "verify", file).code, 0, "an honest attestation under the tier verifies");
    const stmt = JSON.parse(att);
    delete stmt.predicate.gaps.unboundRows;
    delete stmt.predicate.regulated;
    writeFileSync(file, JSON.stringify(stmt));
    assert.notEqual(run(dir, "verify", file).code, 0, "the tree carries the flag: a payload without the term is a difference");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
