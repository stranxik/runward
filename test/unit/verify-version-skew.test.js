// The cross-version guard of `runward verify` (ADR-0055 layer 2, refined).
//
// The survival thesis says a repo re-checks its verdict months later — and months later the
// installed runward has moved. verify re-derives with the CURRENT verdict logic, so a failure on an
// old attestation has TWO possible causes: real drift/tampering, or verdict-logic evolution between
// the producing and the verifying versions. Before this guard the two were indistinguishable, which
// is exactly the plausible-but-wrong reading runward exists to refuse. The guard names the skew
// (`producedBy`/`versionSkew`, advisory) and, on a failure under skew, hands over the gesture that
// distinguishes the cases (re-verify with the producing version). It NEVER moves the exit code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-skew-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-skew-"));
  cpSync(REFERENCE, dir, { recursive: true });
  const att = join(dir, "verdict.intoto.json");
  writeFileSync(att, execFileSync(process.execPath, [CLI, "check", "--attest", "--strict", "-p", "."], { cwd: dir, encoding: "utf8" }));
  return { dir, att, statement: () => JSON.parse(readFileSync(att, "utf8")), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const verifyJson = (cwd, att) => {
  try { return { code: 0, out: JSON.parse(execFileSync(process.execPath, [CLI, "verify", att, "--json", "-p", "."], { cwd, encoding: "utf8" })) }; }
  catch (e) { return { code: e.status, out: JSON.parse(e.stdout) }; }
};
const verifyHuman = (cwd, att) => {
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, "verify", att, "-p", "."], { cwd, encoding: "utf8" }) }; }
  catch (e) { return { code: e.status, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
};

test("skew: same version — producedBy is the current version, versionSkew false, verified", () => {
  const m = mission();
  const { code, out } = verifyJson(m.dir, m.att);
  assert.equal(code, 0);
  assert.equal(out.producedBy, VERSION, "the producing version is read from the predicate");
  assert.equal(out.versionSkew, false, "no skew when producer and verifier are the same version");
  m.drop();
});

test("skew: an old producing version is NAMED, and alone it never fails the verification", () => {
  const m = mission();
  // Rewrite only predicate.runward: the subject digest is over the mission state, not the predicate,
  // and the verdict fields are untouched — so the attestation still verifies. Only the skew shows.
  const s = m.statement();
  s.predicate.runward = "0.1.0";
  writeFileSync(m.att, JSON.stringify(s, null, 2));
  const { code, out } = verifyJson(m.dir, m.att);
  assert.equal(code, 0, "skew is ADVISORY — it never moves the exit code");
  assert.equal(out.verified, true);
  assert.equal(out.producedBy, "0.1.0");
  assert.equal(out.versionSkew, true);
  const human = verifyHuman(m.dir, m.att);
  assert.match(human.out, /produced by runward v0\.1\.0/, "the skew is named in the human output too");
  m.drop();
});

test("skew: a FAILURE under skew hands over the distinguishing gesture (re-verify with the producer)", () => {
  const m = mission();
  const s = m.statement();
  s.predicate.runward = "0.1.0";
  s.predicate.verdict = "gaps"; // lie about the verdict → re-derivation fails
  s.predicate.exitCode = 1;
  writeFileSync(m.att, JSON.stringify(s, null, 2));
  const j = verifyJson(m.dir, m.att);
  assert.equal(j.code, 1, "a failed re-derivation still fails — skew explains, it never excuses");
  assert.equal(j.out.versionSkew, true);
  const human = verifyHuman(m.dir, m.att);
  assert.match(human.out, /verdict-logic evolution/, "the two possible causes are named");
  assert.match(human.out, /npx runward@0\.1\.0 verify/, "the distinguishing gesture is handed over");
  m.drop();
});

test("skew: an attestation with NO producing version stays verifiable — never a guess", () => {
  const m = mission();
  const s = m.statement();
  delete s.predicate.runward;
  writeFileSync(m.att, JSON.stringify(s, null, 2));
  const { code, out } = verifyJson(m.dir, m.att);
  assert.equal(code, 0, "an absent version is not an error");
  assert.equal(out.producedBy, null, "absent → null, never invented");
  assert.equal(out.versionSkew, false, "no version, no skew claim");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
