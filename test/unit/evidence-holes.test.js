// These tests kill holes filed on 2026-11-04 in docs/compliance/mutation-survivors: survivors of
// dist/lib/evidence.js that a measurement showed observable (a false green, a false red, a crash,
// or a lock/witness fact that diverges from what the verdict read). Each test drives the seal, the
// seal's verifier or the evidence-cell parser on an `init --example` mission, asserts the behaviour
// the source intends, and carries its positive control where one makes sense.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");
const CLI = join(DIST, "cli.js");
const { collectEvidenceSeal, collectSealableEvidence, parseEvidencePointers, renderEvidenceSeal, verifyEvidenceLock } =
  await import(join(DIST, "lib", "evidence.js"));

const REPORT = "code/reports/junit.xml";
const dirs = [];
const locked = [];
test.after(() => {
  for (const f of locked) { try { chmodSync(f, 0o644); } catch {} }
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function rw(cwd, ...args) {
  try { return { out: execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ""}${e.stderr ?? ""}`, code: e.status }; }
}

// One example mission, frozen once; every test works on its own copy.
let base;
function frozenBase() {
  if (base) return base;
  base = realpathSync(mkdtempSync(join(tmpdir(), "rw-holes-base-")));
  dirs.push(base);
  assert.equal(rw(base, "init", "--example").code, 0);
  assert.equal(rw(base, "check", "--strict", "--freeze").code, 0);
  return base;
}
// Real paths: the CLI works from a physical cwd, and so do these direct calls (macOS tmpdir is a link).
function copy() {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "rw-holes-")));
  dirs.push(d);
  cpSync(frozenBase(), d, { recursive: true });
  return d;
}
const mission = (d) => join(d, "runward");
const lockPath = (d) => join(d, "runward", "evidence-lock.json");
const readLock = (d) => JSON.parse(readFileSync(lockPath(d), "utf8"));
const writeLock = (d, lock) => writeFileSync(lockPath(d), JSON.stringify(lock, null, 2) + "\n");
const reseal = (d) => writeFileSync(lockPath(d), renderEvidenceSeal(collectEvidenceSeal(mission(d)), "2026-11-04"));
const about = (v, rel) => v.violations.filter((x) => x.problem.includes(rel));
function lock000(f) { chmodSync(f, 0o000); locked.push(f); }

/** Insert rule-conformance rows into floor.md, right after its first `applied` row. */
function addFloorRows(d, ...rows) {
  const f = join(d, "runward", "floor.md");
  const text = readFileSync(f, "utf8");
  const anchor = text.indexOf("| hexa-move-deterministic-out |");
  assert.ok(anchor > 0, "the example floor carries the anchor row");
  writeFileSync(f, text.slice(0, anchor) + rows.map((r) => r + "\n").join("") + text.slice(anchor));
}

// chmod 000 does not make a file unreadable on Windows, nor for root.
const canUnread = process.platform !== "win32" && process.getuid?.() !== 0;
const canLink = process.platform !== "win32";

// ---------------------------------------------------------------------------------------------
// False greens and crashes of the verifier
// ---------------------------------------------------------------------------------------------

test("a projection entry over a file that no longer parses as a report never reads intact, even with the sentinel forged in the lock", () => {
  const d = copy();
  const lock = readLock(d);
  assert.equal(lock.hashKinds?.[REPORT], "junit-projection-v1", "the example seals its report by projection");
  // Positive control: the untouched frozen mission verifies intact.
  assert.deepEqual(verifyEvidenceLock(mission(d)).violations, []);
  writeFileSync(join(d, REPORT), "not a report\n");
  const real = about(verifyEvidenceLock(mission(d)), REPORT);
  assert.equal(real.length, 1);
  assert.equal(real[0].rule, "(seal)");
  assert.match(real[0].problem, /no longer parses as one/);
  // The sentinel `not-a-junit-report` written in the lock is the one the verifier computes: it must
  // still be refused (SEAL_SENTINELS), never matched.
  lock.files[REPORT] = "not-a-junit-report";
  writeLock(d, lock);
  const forged = about(verifyEvidenceLock(mission(d)), REPORT);
  assert.equal(forged.length, 1);
  assert.equal(forged[0].rule, "(seal)");
  assert.match(forged[0].problem, /sealed evidence changed: code\/reports\/junit\.xml .*no longer parses as one/);
  const r = rw(d, "check", "--strict");
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.out, /seal intact/);
});

test("an unreadable projected report is a seal violation, not a crash, whatever hash the lock records", { skip: !canUnread && "chmod cannot make a file unreadable here" }, () => {
  const d = copy();
  const lock = readLock(d);
  lock000(join(d, REPORT));
  // The real hash over an unreadable file: refused, with the projection message, and no throw.
  const v = verifyEvidenceLock(mission(d));
  const real = about(v, REPORT);
  assert.equal(real.length, 1);
  assert.equal(real[0].rule, "(seal)");
  assert.match(real[0].problem, /sealed evidence changed: code\/reports\/junit\.xml — its JUnit cases or verdicts changed/);
  // The machine payload survives (the gate audit, not an error message).
  const j = rw(d, "check", "--strict", "--json");
  assert.equal(j.code, 1);
  assert.doesNotMatch(j.out, /Cannot read properties of undefined/);
  assert.match(j.out, /sealed evidence changed: code\/reports\/junit\.xml/);
  // A lock that records the empty string must not match an unreadable file either.
  lock.files[REPORT] = "";
  writeLock(d, lock);
  const empty = about(verifyEvidenceLock(mission(d)), REPORT);
  assert.equal(empty.length, 1);
  assert.match(empty[0].problem, /sealed evidence changed/);
});

test("a NUL byte added to a sealed report takes it out of the projection: refused, not intact", () => {
  const d = copy();
  assert.deepEqual(verifyEvidenceLock(mission(d)).violations, []);
  const f = join(d, REPORT);
  writeFileSync(f, readFileSync(f, "utf8").replace("<!-- tests 14 -->", "<!-- tests\0 14 -->"));
  const v = about(verifyEvidenceLock(mission(d)), REPORT);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "(seal)");
  assert.match(v[0].problem, /no longer parses as one/);
  const r = rw(d, "check", "--strict");
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.out, /seal intact/);
});

test("a hashKinds that is not an object is refused, under the (seal) rule", () => {
  for (const hk of [null, 7, [], "x"]) {
    const d = copy();
    const lock = readLock(d);
    // No projected entry left: a mis-read hashKinds would otherwise read as no kinds and pass.
    delete lock.files[REPORT];
    lock.hashKinds = hk;
    writeLock(d, lock);
    const v = verifyEvidenceLock(mission(d)).violations;
    assert.equal(v.length, 1, `hashKinds ${JSON.stringify(hk)}: ${JSON.stringify(v)}`);
    assert.equal(v[0].rule, "(seal)");
    assert.match(v[0].problem, /has a `hashKinds` that is not an object of path → kind/);
    if (hk === null) {
      const r = rw(d, "check", "--strict");
      assert.equal(r.code, 1);
      assert.doesNotMatch(r.out, /seal intact/);
    }
  }
  // Positive control: the same lock without hashKinds verifies intact.
  const d = copy();
  const lock = readLock(d);
  delete lock.files[REPORT];
  delete lock.hashKinds;
  writeLock(d, lock);
  assert.deepEqual(verifyEvidenceLock(mission(d)).violations, []);
});

test("a hash kind on an unsealed path, or an unknown kind, is refused under (seal) and nothing else is reported", () => {
  const d = copy();
  const lock = readLock(d);
  lock.hashKinds = { ...lock.hashKinds, "code/nowhere.ts": "bytes" };
  writeLock(d, lock);
  const unsealed = verifyEvidenceLock(mission(d)).violations;
  assert.equal(unsealed.length, 1);
  assert.equal(unsealed[0].rule, "(seal)");
  assert.match(unsealed[0].problem, /records a hash kind for code\/nowhere\.ts, which it does not seal/);
  // An unknown kind on an UNCHANGED bytes file: one refusal, and no invented drift.
  for (const kind of ["weird", 7]) {
    const e = copy();
    const l = readLock(e);
    l.hashKinds = { ...l.hashKinds, "AGENTS.md": kind };
    writeLock(e, l);
    const v = verifyEvidenceLock(mission(e)).violations;
    assert.equal(v.length, 1, `kind ${JSON.stringify(kind)}: ${JSON.stringify(v)}`);
    assert.equal(v[0].rule, "(seal)");
    assert.match(v[0].problem, /records the hash kind .* for AGENTS\.md, which this runward does not know/);
    assert.doesNotMatch(v[0].problem, /sealed evidence changed/);
  }
});

test("a verdict change in a projected report is refused under the (seal) rule", () => {
  const d = copy();
  const f = join(d, REPORT);
  writeFileSync(f, readFileSync(f, "utf8").replace(
    '<testcase name="sales request: classified and routed to the sales queue" classname="test"/>',
    '<testcase name="sales request: classified and routed to the sales queue" classname="test"><failure message="x"/></testcase>'));
  const v = about(verifyEvidenceLock(mission(d)), REPORT);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "(seal)");
  assert.match(v[0].problem, /its JUnit cases or verdicts changed/);
});

// ---------------------------------------------------------------------------------------------
// Line endings: the writer and the verifier normalise CRLF the same way
// ---------------------------------------------------------------------------------------------

test("a CRLF report whose case name spans a line break reads intact right after its seal", () => {
  const d = copy();
  const f = join(d, REPORT);
  const text = readFileSync(f, "utf8").replace(
    "<!-- tests 14 -->",
    '<testcase name="a name that\nspans two lines" classname="test"/>\n\t<!-- tests 14 -->');
  writeFileSync(f, text.replace(/\n/g, "\r\n"));
  reseal(d);
  assert.equal(readLock(d).hashKinds?.[REPORT], "junit-projection-v1", "the CRLF report is still sealed by projection");
  assert.deepEqual(verifyEvidenceLock(mission(d)).violations, []);
  // Positive control: a verdict change on the same report is still seen.
  writeFileSync(f, readFileSync(f, "utf8").replace('spans two lines" classname="test"/>', 'spans two lines" classname="test"><failure/></testcase>'));
  assert.equal(about(verifyEvidenceLock(mission(d)), REPORT).length, 1);
});

// ---------------------------------------------------------------------------------------------
// The writer: what the lock records and how it is rendered
// ---------------------------------------------------------------------------------------------

test("a cited file the seal cannot read is recorded as the bytes sentinel, never dropped nor given a kind", { skip: !canUnread && "chmod cannot make a file unreadable here" }, () => {
  const d = copy();
  lock000(join(d, "code", "package.json"));
  const seal = collectEvidenceSeal(mission(d));
  assert.equal(seal.files["code/package.json"], "unreadable");
  assert.ok(!("code/package.json" in seal.hashKinds), JSON.stringify(seal.hashKinds));
  const lock = JSON.parse(renderEvidenceSeal(seal, "2026-11-04"));
  assert.equal(lock.files["code/package.json"], "unreadable");
  assert.deepEqual(lock.hashKinds, { [REPORT]: "junit-projection-v1" });
});

test("the lock is rendered sorted and ends with a newline", () => {
  const d = copy();
  const raw = readFileSync(lockPath(d), "utf8");
  assert.ok(raw.endsWith("}\n"), "the frozen lock ends with a newline");
  const keys = Object.keys(JSON.parse(raw).files);
  assert.ok(keys.length > 10);
  assert.deepEqual(keys, [...keys].sort());
  assert.deepEqual(Object.keys(collectEvidenceSeal(mission(d)).files), keys);
  assert.equal(renderEvidenceSeal({ files: { a: "1" }, hashKinds: {} }, "2026-11-04"),
    JSON.stringify({ version: 1, sealedAt: "2026-11-04", files: { a: "1" } }, null, 2) + "\n");
});

test("only a whole-cell [placeholder] rule is skipped by the seal; a real rule carrying brackets is sealed", () => {
  const d = copy();
  for (const f of ["decoy.ts", "decoy2.ts", "decoy3.ts"]) writeFileSync(join(d, "code", f), `export function parseDeadline() { return "${f}"; }\n`);
  addFloorRows(d,
    "| retry-budget [deprecated] | applied | file:code/decoy.ts#parseDeadline |",
    "| [deprecated] retry-x | applied | file:code/decoy2.ts#parseDeadline |",
    "| [Rule name] | applied | file:code/decoy3.ts#parseDeadline |");
  const sealed = Object.keys(collectSealableEvidence(mission(d)));
  assert.ok(sealed.includes("code/decoy.ts"), "a slug ending in a bracket is a real row");
  assert.ok(sealed.includes("code/decoy2.ts"), "a slug starting with a bracket is a real row");
  assert.ok(!sealed.includes("code/decoy3.ts"), "positive control: the template row is skipped");
});

test("only a well-formed adr: pointer to a regular file puts an ADR in the seal", () => {
  const d = copy();
  writeFileSync(join(d, "runward", "adr", "ADR-undefined-notes.md"), "# notes nobody cites\n");
  mkdirSync(join(d, "runward", "adr", "ADR-0004-a-directory"));
  writeFileSync(join(d, "runward", "adr", "ADR-0004-a-directory", "inner.md"), "x\n");
  addFloorRows(d,
    "| config-typing-zod | deviated | adr:ADR-9999 |",
    "| data-ttl-types | deviated | adr:0004 |");
  const sealed = Object.keys(collectEvidenceSeal(mission(d)).files);
  assert.ok(sealed.includes("runward/adr/ADR-0001-single-orchestrator.md"), "positive control: a cited ADR is sealed");
  assert.ok(!sealed.includes("runward/adr/ADR-undefined-notes.md"), "a malformed adr: pointer is never looked up as ADR-undefined");
  assert.ok(!sealed.some((k) => k.startsWith("runward/adr/ADR-0004")), "a directory named like an ADR is not sealed");
});

test("a cited symlink is sealed under its own path, so re-pointing it breaks the seal", { skip: !canLink && "symlinks need privileges here" }, () => {
  const d = copy();
  symlinkSync("src/core/domain/guard.ts", join(d, "code", "evidence-alias.ts"));
  writeFileSync(join(d, "code", "decoy.ts"), "export function parseDeadline() { return 0; }\n");
  addFloorRows(d, "| routing-model-cost-ratios | applied | file:code/evidence-alias.ts#parseDeadline |");
  const seal = collectEvidenceSeal(mission(d));
  assert.ok("code/src/core/domain/guard.ts" in seal.files, "the link's target is sealed");
  assert.ok("code/evidence-alias.ts" in seal.files, "the link's own path is sealed");
  writeFileSync(lockPath(d), renderEvidenceSeal(seal, "2026-11-04"));
  assert.deepEqual(verifyEvidenceLock(mission(d)).violations, [], "positive control: intact right after the seal");
  unlinkSync(join(d, "code", "evidence-alias.ts"));
  symlinkSync("decoy.ts", join(d, "code", "evidence-alias.ts"));
  const v = verifyEvidenceLock(mission(d)).violations;
  assert.ok(v.some((x) => /sealed evidence changed: code\/evidence-alias\.ts/.test(x.problem)), JSON.stringify(v));
});

test("the link pass seals neither an uncited twin under another base nor a dangling link", { skip: !canLink && "symlinks need privileges here" }, () => {
  const d = copy();
  writeFileSync(join(d, "notes.md"), "# Notes\n\nthe cited one\n");
  writeFileSync(join(d, "runward", "notes.md"), "# Notes\n\nan uncited twin\n");
  symlinkSync("nowhere.ts", join(d, "code", "alias2.ts"));
  addFloorRows(d, "| routing-model-cost-ratios | applied | file:notes.md#Notes — see code/alias2.ts |");
  const sealed = Object.keys(collectEvidenceSeal(mission(d)).files);
  assert.ok(sealed.includes("notes.md"), "positive control: the cited file is sealed");
  assert.ok(!sealed.includes("runward/notes.md"), "the uncited twin is not sealed");
  assert.ok(!sealed.includes("code/alias2.ts"), "a dangling link is not sealed");
});

// ---------------------------------------------------------------------------------------------
// The evidence-cell parser: what a test pointer records
// ---------------------------------------------------------------------------------------------

test("a quoted test name holding a backslash that is not last resolves as written", () => {
  const [p] = parseEvidencePointers('test:code/reports/junit.xml::"a\\b" — comment');
  assert.equal(p.kind, "test");
  assert.equal(p.testName, "a\\b");
  assert.equal(p.malformed, undefined);
  // Positive control: a name ENDING in a backslash is the glued form and is refused.
  const [q] = parseEvidencePointers('test:code/reports/junit.xml::"a \\"b\\" c"');
  assert.ok(q.malformed);
});

test("a glued test pointer records the name it read and that a name was declared", () => {
  const [p] = parseEvidencePointers('test:code/reports/junit.xml::"a \\"b\\" c"');
  assert.match(p.malformed, /cannot appear inside a quoted test name/);
  assert.equal(p.testName, "a \\");
  assert.equal(p.testNameDeclared, true);
  const [q] = parseEvidencePointers('test:code/reports/junit.xml::"x "y" z"');
  assert.ok(q.malformed);
  assert.equal(q.testName, "x ");
  assert.equal(q.testNameDeclared, true);
  // An empty name read from a glued pointer is recorded as no name.
  const [e] = parseEvidencePointers('test:code/reports/junit.xml::""x"');
  assert.ok(e.malformed);
  assert.equal(e.testName, undefined);
  assert.equal(e.testNameDeclared, true);
});
