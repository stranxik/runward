// DSSE tolerance in `runward verify` (Vague 1, from the 2026-08-14 audit's remainder).
//
// cosign wraps the Statement it signs in a DSSE envelope { payloadType, payload: base64,
// signatures[] } — the exact artifact ADR-0055 layer 5 will produce. verify DECODES the payload and
// re-derives as usual; it NEVER verifies the signature (runward anchors no trust root and holds no
// key — pretending to check a signature it cannot anchor would be a stronger claim than the tool is
// entitled to). The signature count is reported, the words say "NOT verified", and the operator's
// own cosign does the signature half. Tampering INSIDE the envelope still fails: the re-derivation
// reads the decoded Statement, not the wrapper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-dsse-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-dsse-"));
  cpSync(REFERENCE, dir, { recursive: true });
  const statement = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--attest", "--strict", "-p", "."], { cwd: dir, encoding: "utf8" }));
  return { dir, statement, drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const envelope = (statement, signatures = [{ keyid: "op-key", sig: "bm90LXZlcmlmaWVk" }]) => JSON.stringify({
  payloadType: "application/vnd.in-toto+json",
  payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
  signatures,
});
const verify = (cwd, att) => {
  try { return { code: 0, out: JSON.parse(execFileSync(process.execPath, [CLI, "verify", att, "--json", "-p", "."], { cwd, encoding: "utf8" })) }; }
  catch (e) { return { code: e.status, out: e.stdout ? JSON.parse(e.stdout) : null }; }
};

test("dsse: an enveloped attestation verifies — decoded, re-derived, signature counted and NOT verified", () => {
  const m = mission();
  const att = join(m.dir, "verdict.dsse.json");
  writeFileSync(att, envelope(m.statement));
  const { code, out } = verify(m.dir, att);
  assert.equal(code, 0, "the decoded Statement re-derives on the intact tree");
  assert.equal(out.verified, true);
  assert.deepEqual(out.dsse, { envelope: true, signaturesPresent: 1, signatureVerified: false }, "the envelope is named, the signature is counted, and signatureVerified is FALSE in so many words");
  const human = execFileSync(process.execPath, [CLI, "verify", att, "-p", "."], { cwd: m.dir, encoding: "utf8" });
  assert.match(human, /NOT verified/, "the human output says what was not checked");
  m.drop();
});

test("dsse: a bare Statement still carries dsse: null — the field is additive, never a guess", () => {
  const m = mission();
  const att = join(m.dir, "verdict.intoto.json");
  writeFileSync(att, JSON.stringify(m.statement));
  const { code, out } = verify(m.dir, att);
  assert.equal(code, 0);
  assert.equal(out.dsse, null);
  m.drop();
});

test("dsse: NEGATIVE CONTROL — a lying predicate inside the envelope still fails", () => {
  const m = mission();
  m.statement.predicate.verdict = "gaps";
  m.statement.predicate.exitCode = 1;
  const att = join(m.dir, "verdict.dsse.json");
  writeFileSync(att, envelope(m.statement));
  const { code, out } = verify(m.dir, att);
  assert.equal(code, 1, "the wrapper buys the payload nothing — re-derivation reads the Statement inside");
  assert.equal(out.verified, false);
  m.drop();
});

test("dsse: a non-in-toto payloadType and a rotten payload both exit 2, named", () => {
  const m = mission();
  const att = join(m.dir, "bad.dsse.json");
  writeFileSync(att, JSON.stringify({ payloadType: "application/vnd.docker.something", payload: "e30=", signatures: [] }));
  assert.equal(verify(m.dir, att).code, 2, "a foreign payload is refused, not guessed at");
  writeFileSync(att, JSON.stringify({ payloadType: "application/vnd.in-toto+json", payload: "not-base64-json!!!", signatures: [] }));
  assert.equal(verify(m.dir, att).code, 2, "an undecodable payload is refused");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
