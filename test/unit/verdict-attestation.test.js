// ADR-0055 layer 1: `check --attest` emits the verdict as an UNSIGNED in-toto Statement.
//
// The keystone of the verdict-as-attestation work. The Statement wraps what `check --json` already
// computes (the predicate) and binds it to the mission tree (the subject digest). It must be a pure
// emission: byte-idempotent on an unchanged tree, no signature (runward holds no key, ADR-0021), and
// it must never feed back into the verdict — emitting an attestation cannot change the exit code
// (ADR-0054 crossing (5)). Every property is pinned here so a later signing layer cannot quietly
// pull the base command across the runtime boundary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { missionStateDigest, buildVerdictStatement, RUNWARD_PREDICATE_TYPE, IN_TOTO_STATEMENT_TYPE } from "../../dist/lib/attestation.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-attest-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-attest-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
// The attestation is the sole stdout even when the gate reds; capture it whatever the exit code.
function attest(cwd, extra = []) {
  try { return execFileSync(process.execPath, [CLI, "check", "--attest", ...extra, "-p", "."], { cwd, encoding: "utf8" }); }
  catch (e) { return e.stdout; }
}

test("ADR-0055: check --attest emits a valid, unsigned in-toto Statement wrapping the verdict", () => {
  const m = mission();
  const s = JSON.parse(attest(m.dir, ["--strict"]));
  assert.equal(s._type, IN_TOTO_STATEMENT_TYPE, "the in-toto Statement type");
  assert.equal(s.predicateType, RUNWARD_PREDICATE_TYPE, "the stable versioned runward-verdict predicateType");
  assert.ok(Array.isArray(s.subject) && s.subject.length === 1, "one subject");
  assert.equal(s.subject[0].name, basename(m.dir), "the subject names the mission");
  assert.match(s.subject[0].digest.sha256, /^[a-f0-9]{64}$/, "a sha256 subject digest");
  assert.equal(s.predicate.verdict, "clean", "the predicate carries the verdict payload");
  assert.equal(s.predicate.exitCode, 0);
  assert.ok(s.predicate.gateNonScope, "the strict predicate carries the non-scope caveat");
  // Unsigned by construction: a signature needs a key runward does not hold (ADR-0021 / ADR-0054).
  assert.ok(!("signature" in s) && !("signatures" in s), "no signature — the base command is unsigned");
  assert.ok(!/-----BEGIN/.test(JSON.stringify(s)), "no embedded key material");
  m.drop();
});

test("ADR-0055: the attestation is byte-idempotent on an unchanged tree", () => {
  const m = mission();
  const a = attest(m.dir, ["--strict"]);
  const b = attest(m.dir, ["--strict"]);
  assert.equal(a, b, "two runs on the same tree produce byte-identical Statements");
  m.drop();
});

test("ADR-0055: the subject digest equals missionStateDigest and moves with the tree", () => {
  const m = mission();
  const s1 = JSON.parse(attest(m.dir));
  assert.equal(s1.subject[0].digest.sha256, missionStateDigest(m.dir, m.mission),
    "the subject digest is the mission-state digest, computable independently");
  // Drift any file the verdict depends on: the digest must change (what lets `verify` bind later).
  writeFileSync(join(m.mission, "framing.md"), "changed after the first attestation\n");
  const s2 = JSON.parse(attest(m.dir));
  assert.notEqual(s2.subject[0].digest.sha256, s1.subject[0].digest.sha256, "a drifted tree yields a new digest");
  m.drop();
});

test("ADR-0055: emitting an attestation never changes the verdict (out of the exit-code path)", () => {
  // ADR-0054 crossing (5): the attestation is downstream of the verdict, never an input to it. The
  // exit code of `check --strict` and `check --attest --strict` must match on the same tree.
  const m = mission();
  const exitOf = (args) => {
    try { execFileSync(process.execPath, [CLI, "check", ...args, "-p", "."], { cwd: m.dir, stdio: "pipe" }); return 0; }
    catch (e) { return e.status; }
  };
  assert.equal(exitOf(["--strict"]), exitOf(["--attest", "--strict"]), "green mission: same exit code");
  // And on a red mission.
  writeFileSync(join(m.mission, "floor.md"), "raw\n");
  assert.equal(exitOf(["--strict"]), exitOf(["--attest", "--strict"]), "red mission: same exit code");
  m.drop();
});

test("ADR-0055: buildVerdictStatement is a pure wrapper — same predicate in, same envelope out", () => {
  const m = mission();
  const predicate = { verdict: "clean", exitCode: 0 };
  const a = buildVerdictStatement(m.dir, m.mission, predicate);
  const b = buildVerdictStatement(m.dir, m.mission, predicate);
  assert.deepEqual(a, b, "deterministic");
  assert.equal(a.predicate, predicate, "the predicate is wrapped as given, not re-derived");
  assert.equal(a._type, IN_TOTO_STATEMENT_TYPE);
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
