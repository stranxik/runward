// Wave C obj 7 (ADR-0055 layer 4): `runward bundle` binds delivery artifacts into one attested
// manifest, and `runward verify` re-checks it.
//
// A factory hands an assessor ONE in-toto Statement whose subjects are the delivery artifacts (the
// verdict attestation, the seal, an OSCAL export, an SBOM), each referenced by its RAW SHA-256 — the
// digest cosign / in-toto tools / `sha256sum` compute, so the bundle is verifiable by anyone, not
// only by runward. It emits a file; it runs nothing, holds no key (ADR-0054). The negative controls
// are the point: a changed or missing artifact must fail re-verification.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const rawSha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "rw-bundle-"));
  execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: dir, stdio: "pipe" });
  // Two real artifacts: a verdict attestation and a sealed evidence-lock.
  writeFileSync(join(dir, "verdict.intoto.json"), execFileSync(process.execPath, [CLI, "check", "--attest", "--strict", "-p", "."], { cwd: dir, encoding: "utf8" }));
  execFileSync(process.execPath, [CLI, "check", "--freeze", "-p", "."], { cwd: dir, stdio: "pipe" });
  return { dir, drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const bundle = (dir, args) => execFileSync(process.execPath, [CLI, "bundle", ...args], { cwd: dir, encoding: "utf8" });
function verifyExit(dir, file) {
  try { execFileSync(process.execPath, [CLI, "verify", file], { cwd: dir, stdio: "pipe" }); return 0; }
  catch (e) { return e.status; }
}

test("obj 7: bundle emits a valid in-toto Statement whose subjects are the artifacts by RAW sha256", () => {
  const f = fixture();
  const s = JSON.parse(bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]));
  assert.equal(s._type, "https://in-toto.io/Statement/v1");
  assert.equal(s.predicateType, "https://runward.dev/bundle/v1");
  assert.deepEqual(s.subject.map((x) => x.name), ["runward/evidence-lock.json", "verdict.intoto.json"], "subjects sorted by name");
  // The digest is the RAW file hash — what an external tool re-computes. Interop is the point.
  assert.equal(s.subject.find((x) => x.name === "verdict.intoto.json").digest.sha256, rawSha(join(f.dir, "verdict.intoto.json")));
  assert.ok(!("signature" in s) && !("signatures" in s), "unsigned");
  f.drop();
});

test("obj 7: bundle is byte-idempotent on unchanged artifacts", () => {
  const f = fixture();
  assert.equal(bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]),
    bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]), "two runs identical");
  // And order-independent: naming the same set differently yields the same bundle (subjects sort).
  assert.equal(bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]),
    bundle(f.dir, ["runward/evidence-lock.json", "verdict.intoto.json"]), "argument order does not matter");
  f.drop();
});

test("obj 7: verify a bundle — all artifacts present and unchanged, exit 0", () => {
  const f = fixture();
  writeFileSync(join(f.dir, "bundle.intoto.json"), bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]));
  assert.equal(verifyExit(f.dir, "bundle.intoto.json"), 0, "every bundled artifact matches");
  f.drop();
});

test("obj 7: NEGATIVE CONTROL — a changed artifact fails bundle re-verification (exit 1)", () => {
  const f = fixture();
  writeFileSync(join(f.dir, "bundle.intoto.json"), bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]));
  appendFileSync(join(f.dir, "verdict.intoto.json"), "\ntampered\n");
  assert.equal(verifyExit(f.dir, "bundle.intoto.json"), 1, "the bundled attestation changed");
  f.drop();
});

test("obj 7: NEGATIVE CONTROL — a missing artifact fails bundle re-verification (exit 1)", () => {
  const f = fixture();
  writeFileSync(join(f.dir, "bundle.intoto.json"), bundle(f.dir, ["verdict.intoto.json", "runward/evidence-lock.json"]));
  rmSync(join(f.dir, "verdict.intoto.json"));
  assert.equal(verifyExit(f.dir, "bundle.intoto.json"), 1, "a bundled artifact is gone");
  f.drop();
});

test("obj 7: misuse — no artifact named, or a missing file, exits 2", () => {
  const f = fixture();
  const run = (args) => { try { execFileSync(process.execPath, [CLI, "bundle", ...args], { cwd: f.dir, stdio: "pipe" }); return 0; } catch (e) { return e.status; } };
  assert.equal(run([]), 2, "commander requires at least one artifact");
  assert.equal(run(["does-not-exist.json"]), 2, "a named file that is not there is misuse");
  f.drop();
});

process.on("exit", () => {});
