// The verdict as a SLSA Verification Summary Attestation (ADR-0011/ADR-0055 — the interop port).
//
// A neutral port, not runward's own vocabulary: an ecosystem verifier (Kyverno, a policy engine, a
// release gate) reads a VSA already and needs to learn nothing about runward to consume the verdict.
//
// Two fields of the VSA spec collide with runward's invariants, and both are resolved by REFUSING
// to invent the missing input rather than guessing it — that refusal is what these tests pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const URI = "pkg:npm/acme-service@1.2.3";

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-vsa-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });
function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-vsa-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const emit = (cwd, args, env = {}) => {
  const opts = { cwd, encoding: "utf8", env: { ...process.env, ...env } };
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], opts) }; }
  catch (e) { return { code: e.status, out: e.stdout ?? "" }; }
};

test("vsa: a green mission emits PASSED, bound to the tree, under the SLSA predicate type", () => {
  const m = mission();
  const { code, out } = emit(m.dir, ["check", "--strict", "--vsa", "--resource-uri", URI, "-p", "."]);
  assert.equal(code, 0);
  const s = JSON.parse(out);
  assert.equal(s.predicateType, "https://slsa.dev/verification_summary/v1");
  assert.equal(s._type, "https://in-toto.io/Statement/v1");
  assert.match(s.subject[0].digest.sha256, /^[a-f0-9]{64}$/, "bound to the exact mission state, like every runward attestation");
  assert.equal(s.predicate.verificationResult, "PASSED");
  assert.equal(s.predicate.resourceUri, URI);
  assert.equal(s.predicate.verifier.id, "https://runward.dev");
  assert.equal(s.predicate.policy.uri, "https://runward.dev/docs/concepts/the-gate/", "the trust base is verifier + policy, and both must be readable by a consumer");
  m.drop();
});

test("vsa: verifiedLevels carries a CUSTOM value and NEVER an SLSA_ one", () => {
  // The load-bearing honesty test. runward evaluates no SLSA build level — it verifies a delivery
  // gate — and the spec is explicit: custom values are allowed, but must not start with SLSA_.
  // Emitting SLSA_BUILD_LEVEL_3 because the gate is green would be a claim about a build pipeline
  // runward never looked at: the exact overclaim class this project fails a test over elsewhere.
  const m = mission();
  const s = JSON.parse(emit(m.dir, ["check", "--strict", "--vsa", "--resource-uri", URI, "-p", "."]).out);
  assert.deepEqual(s.predicate.verifiedLevels, ["RUNWARD_GATE_STRICT"]);
  for (const l of s.predicate.verifiedLevels) assert.ok(!l.startsWith("SLSA_"), `${l} claims a SLSA level runward never evaluated`);
  const presence = JSON.parse(emit(m.dir, ["check", "--vsa", "--resource-uri", URI, "-p", "."]).out);
  assert.deepEqual(presence.predicate.verifiedLevels, ["RUNWARD_GATE_PRESENCE"], "without --strict the level says so");
  m.drop();
});

test("vsa: a declared horizon is IN the level — a prefix never reads as a whole arc", () => {
  const m = mission();
  const s = JSON.parse(emit(m.dir, ["check", "--strict", "--through", "floor", "--vsa", "--resource-uri", URI, "-p", "."]).out);
  assert.deepEqual(s.predicate.verifiedLevels, ["RUNWARD_GATE_STRICT_THROUGH_FLOOR"], "the consumer cannot read a prefix verdict as a finished mission");
  m.drop();
});

test("vsa: a red mission emits FAILED — the attestation is about the verdict, not about success", () => {
  const m = mission();
  writeFileSync(join(m.mission, "floor.md"), "raw template\n");
  const { code, out } = emit(m.dir, ["check", "--strict", "--vsa", "--resource-uri", URI, "-p", "."]);
  assert.equal(code, 1, "the port contract is unchanged by the envelope");
  assert.equal(JSON.parse(out).predicate.verificationResult, "FAILED");
  m.drop();
});

test("vsa: --resource-uri is REQUIRED and never guessed — misuse exits 2", () => {
  const m = mission();
  const { code } = emit(m.dir, ["check", "--strict", "--vsa", "-p", "."]);
  assert.equal(code, 2, "the URI names the artifact a policy engine will admit or refuse; runward reads a tree and cannot verify a name it invented");
  m.drop();
});

test("vsa: SOURCE_DATE_EPOCH makes the emission byte-idempotent; without it, only the timestamp moves", () => {
  const m = mission();
  const run = (env) => emit(m.dir, ["check", "--strict", "--vsa", "--resource-uri", URI, "-p", "."], env).out;
  assert.equal(run({ SOURCE_DATE_EPOCH: "1700000000" }), run({ SOURCE_DATE_EPOCH: "1700000000" }), "the operator owns the clock, so the artifact is reproducible");
  assert.equal(JSON.parse(run({ SOURCE_DATE_EPOCH: "1700000000" })).predicate.timeVerified, "2026-11-14T22:13:20Z".replace("2026-11-14T22:13:20Z", new Date(1700000000000).toISOString().replace(/\.\d{3}Z$/, "Z")));
  // Without it the clock moves, and NOTHING ELSE does: the verdict is in the payload, never in the
  // envelope's timestamp.
  const a = JSON.parse(run({})), b = JSON.parse(run({}));
  delete a.predicate.timeVerified; delete b.predicate.timeVerified;
  assert.deepEqual(a, b, "the only non-idempotent field is the one the spec requires to be a clock");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
