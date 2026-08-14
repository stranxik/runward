// Wave B obj 6 (ADR-0055 layer 2): `runward verify` re-checks an attestation offline.
//
// The survival property made portable: anyone can re-check a verdict months later on the repo
// alone. verify re-derives the mission-state digest and the verdict from the CURRENT tree and
// confirms the attestation binds to it — the tree has not drifted (subject digest) and the predicate
// was not tampered (the verdict re-derives). No network, no trust root, no second tree (ADR-0054).
// The negative controls are the point: a drifted tree and a lying predicate must both fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, appendFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-verify-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-verify-"));
  cpSync(REFERENCE, dir, { recursive: true });
  const att = join(dir, "verdict.intoto.json");
  writeFileSync(att, execFileSync(process.execPath, [CLI, "check", "--attest", "--strict", "-p", "."], { cwd: dir, encoding: "utf8" }));
  return { dir, mission: join(dir, "runward"), att, drop: () => rmSync(dir, { recursive: true, force: true }) };
}
function verifyExit(cwd, att) {
  try { execFileSync(process.execPath, [CLI, "verify", att, "-p", "."], { cwd, stdio: "pipe" }); return 0; }
  catch (e) { return e.status; }
}

test("obj 6: verify an intact tree — verified, exit 0", () => {
  const m = mission();
  assert.equal(verifyExit(m.dir, m.att), 0, "the attestation binds to the tree it was made on");
  m.drop();
});

test("obj 6: NEGATIVE CONTROL — a drifted tree fails (exit 1)", () => {
  const m = mission();
  appendFileSync(join(m.mission, "framing.md"), "\na change after the attestation\n");
  assert.equal(verifyExit(m.dir, m.att), 1, "the subject digest no longer matches, so verify refuses");
  m.drop();
});

test("obj 6: NEGATIVE CONTROL — a tampered predicate fails (exit 1)", () => {
  // Emit an attestation on a RED tree, then edit the predicate to claim clean. The tree is unchanged
  // (digest still matches) but the verdict re-derives to gaps, so verify catches the lie.
  const m = mission();
  writeFileSync(join(m.mission, "floor.md"), "raw template\n");
  // On a red tree `check --attest --strict` exits 1; the Statement is still its stdout, so capture it.
  const redOut = (() => { try { return execFileSync(process.execPath, [CLI, "check", "--attest", "--strict", "-p", "."], { cwd: m.dir, encoding: "utf8" }); } catch (e) { return e.stdout; } })();
  const red = JSON.parse(redOut);
  red.predicate.verdict = "clean";
  red.predicate.exitCode = 0;
  writeFileSync(m.att, JSON.stringify(red, null, 2));
  assert.equal(verifyExit(m.dir, m.att), 1, "a predicate that lies about the verdict is refused");
  m.drop();
});

test("obj 6: misuse — a non-attestation and a missing file both exit 2", () => {
  const m = mission();
  const notAtt = join(m.dir, "not.json");
  writeFileSync(notAtt, JSON.stringify({ hello: 1 }));
  assert.equal(verifyExit(m.dir, notAtt), 2, "a file that is not a runward attestation is misuse");
  assert.equal(verifyExit(m.dir, join(m.dir, "does-not-exist.json")), 2, "a missing file is misuse");
  m.drop();
});

test("obj 6: --json carries the verdict and both match flags", () => {
  const m = mission();
  const j = JSON.parse(execFileSync(process.execPath, [CLI, "verify", m.att, "--json", "-p", "."], { cwd: m.dir, encoding: "utf8" }));
  assert.equal(j.verified, true);
  assert.equal(j.digest.matches, true);
  assert.equal(j.verdict.matches, true);
  assert.equal(j.exitCode, 0);
  // And it reflects a drift.
  appendFileSync(join(m.mission, "framing.md"), "\ndrift\n");
  const out = (() => { try { return execFileSync(process.execPath, [CLI, "verify", m.att, "--json", "-p", "."], { cwd: m.dir, encoding: "utf8" }); } catch (e) { return e.stdout; } })();
  const k = JSON.parse(out);
  assert.equal(k.verified, false);
  assert.equal(k.digest.matches, false);
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
