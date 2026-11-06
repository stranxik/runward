// ADR-0120 R1, its acceptance, held on a laboratory repository with the shipped example's run policy
// shape (test/support/run-lab.js): runward reads, at `--require attested`, the reports runward-run wrote,
// its run Statement and the signatures carried with it, as files at rest (decision 6). The binding is
// re-derived by the CLI; a signature is COUNTED, never verified (that is runward-fleet's, D4a).
//
//   - the healthy example passes (exit 0) once its Statement carries a signature;
//   - an unsigned Statement, consistent with the tree, reads declared and exits 5;
//   - a hand-committed report, and a forged JUnit report, are refused at attested for want of a binding;
//   - a cited source edited after the run breaks the binding and exits 5; so does a manifest edited, a
//     recorded set narrower than the tree's, a run that did not cut the network;
//   - a run that could not cut the network leaves nothing the gate reads as evidence;
//   - the sentence of ADR-0119 decision 5 at the character, and `signatureVerified: false`, always.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { CLI, check, checkJson, countedEnvelope, env, makeLab, runLab } from "../support/run-lab.js";
import { githubIdentity, makeBundle, makeSigstore } from "../support/fleet-sigstore.js";

const POSIX = process.platform !== "win32";
const skip = POSIX ? false : "runward-run drives a Linux container runtime; its fake runtime is a POSIX executable";
const SENTENCE = "attested: the binding is re-derived by this command; the signature is verified outside it";
const REPORTS = join("code", "reports");

let base, lab, run, signed;
before(() => {
  if (!POSIX) return;
  base = mkdtempSync(join(tmpdir(), "rw-run-bind-"));
  lab = makeLab(join(base, "lab"));
  run = runLab(join(base), lab);
  assert.equal(run.status, 0, run.stderr);
  // The operator's CI commits what the run wrote with the tree it judges (decision 6).
  cpSync(run.out, lab, { recursive: true });
  // `signed`: the same tree, with the Statement in a DSSE envelope that carries one signature.
  signed = fresh(lab);
  const st = readFileSync(join(signed, REPORTS, "runward-run.intoto.json"));
  writeFileSync(join(signed, REPORTS, "runward-run.dsse.json"), countedEnvelope(st));
});
after(() => { if (base) rmSync(base, { recursive: true, force: true }); });
function fresh(from) { const d = mkdtempSync(join(base, "case-")); cpSync(from, d, { recursive: true }); return d; }
const level = (j) => ({ exit: j.exitCode, verdict: j.verdict, met: j.levels.met, counts: j.levels.counts });

test("R1: the healthy example, run by runward-run and its Statement signed, passes at attested (exit 0)", { skip }, () => {
  const r = check(signed, "--require", "attested");
  assert.equal(r.status, 0, r.stdout.slice(-1500));
  assert.ok(r.stdout.includes(SENTENCE), "the sentence of ADR-0119 decision 5, at the character, wherever attested is read");
  const j = checkJson(signed, "--require", "attested");
  assert.deepEqual(level(j), { exit: 0, verdict: "clean", met: true, counts: { "re-derived": 8, attested: 16, declared: 0 } });
  assert.equal(j.levels.signatureVerified, false, "the CLI never verifies a signature");
  assert.equal(j.levels.sentence, SENTENCE);
  const envelope = j.levels.execution.statements.find((s) => s.form === "dsse");
  assert.deepEqual([envelope.bound, envelope.signatures, envelope.binds.length], [true, 1, 4]);
  for (const row of j.levels.rows.attested) for (const p of row.pieces.filter((x) => x.kind === "execution")) assert.equal(p.statement, "code/reports/runward-run.dsse.json");
  // The rows that cite no execution piece meet attested at re-derived: an attestation adds nothing to a
  // fact runward recomputes (ADR-0119 decision 2).
  for (const row of j.levels.rows["re-derived"]) assert.ok(row.pieces.every((p) => p.kind === "static"), `${row.rule}: re-derived, and it cites no report`);
  assert.deepEqual(j.require, { level: "attested", met: true });
  assert.equal(check(signed, "--require", "attested", "--json").stdout, check(signed, "--require", "attested", "--json").stdout, "same tree, same payload, byte for byte (ADR-0054 crossing 4)");
});

test("R1: an unsigned Statement, consistent with the tree, reads declared and exits 5", { skip }, () => {
  const j = checkJson(lab, "--require", "attested");
  assert.deepEqual(level(j), { exit: 5, verdict: "level-not-met", met: false, counts: { "re-derived": 24, attested: 0, declared: 0 } });
  const st = j.levels.execution.statements;
  assert.deepEqual(st.map((s) => [s.path, s.form, s.bound, s.signatures]), [["code/reports/runward-run.intoto.json", "statement", true, 0]], "the binding holds; no signature is carried");
  assert.ok(j.levels.below.length > 0);
  for (const b of j.levels.below) assert.ok(b.holds.every((h) => /carries no signature/.test(h)), `${b.rule}: ${b.holds.join("; ")}`);
  assert.equal(j.next.action, "attest-the-execution");
  const r = check(lab, "--require", "attested");
  assert.equal(r.status, 5);
  assert.match(r.stdout, /No gap, and the level of proof this run requires is not met: `attested`/);
  assert.ok(r.stdout.includes(SENTENCE));
  // The levels below it are met: the statement changes nothing a lower level reads.
  assert.equal(check(lab, "--require", "re-derived").status, 0);
  assert.equal(check(lab).status, 0, "mechanical, the default, is unchanged by a run Statement");
});

test("R1: a hand-committed report, and a forged JUnit report, are refused at attested for want of a binding", { skip }, () => {
  // A 93-byte-style ESLint JSON written by hand: the evidence layer reads it clean, nothing binds it.
  const hand = fresh(signed);
  const files = ["src/core/application/triage-request.usecase.ts", "src/core/domain/triage.ts", "src/core/domain/guard.ts"];
  writeFileSync(join(hand, REPORTS, "eslint.json"), JSON.stringify(files.map((f) => ({ filePath: f, messages: [], errorCount: 0, fatalErrorCount: 0, warningCount: 0 }))));
  assert.equal(check(hand).status, 0, "control: at mechanical the hand-committed report is read as it was committed");
  const jh = checkJson(hand, "--require", "attested");
  assert.equal(jh.exitCode, 5);
  const held = jh.levels.below.filter((b) => b.holds.some((h) => h.startsWith("execution: declared — code/reports/eslint.json")));
  assert.ok(held.length >= 3, "every row citing the hand-committed report is below attested");
  assert.ok(held.every((b) => b.holds.some((h) => /no run Statement in code\/reports\/ has its digest among its subjects|does not bind/.test(h))), JSON.stringify(held[0]));

  // A forged JUnit report: the same cases, written by hand, green.
  const forged = fresh(signed);
  const cases = [...readFileSync(join(forged, REPORTS, "junit.xml"), "utf8").matchAll(/<testcase name="([^"]*)"/g)].map((m) => m[1]);
  writeFileSync(join(forged, REPORTS, "junit.xml"), `<testsuites>\n${cases.map((n) => `<testcase name="${n}" classname="test"/>`).join("\n")}\n</testsuites>\n`);
  assert.equal(check(forged).status, 0, "control: the forged report satisfies every cited case at mechanical");
  const jf = checkJson(forged, "--require", "attested");
  assert.equal(jf.exitCode, 5);
  assert.ok(jf.levels.below.some((b) => b.holds.some((h) => h.startsWith("execution: declared — code/reports/junit.xml"))));
  assert.ok(jf.levels.rows.attested.every((r) => r.pieces.every((p) => p.report !== "code/reports/junit.xml")), "no row citing the forged report reads attested");
});

test("R1: a cited source edited after the run breaks the binding and exits 5", { skip }, () => {
  const d = fresh(signed);
  appendFileSync(join(d, "code", "src", "core", "domain", "guard.ts"), "\n// edited after the run\n");
  assert.equal(check(d).status, 0, "control: the edit breaks nothing the lower levels read");
  const j = checkJson(d, "--require", "attested");
  assert.equal(j.exitCode, 5);
  const s = j.levels.execution.statements.find((x) => x.form === "dsse");
  assert.equal(s.bound, false);
  assert.ok(s.problems.some((p) => /1 source file\(s\) differ from what the run hashed before its legs ran \(e\.g\. code\/src\/core\/domain\/guard\.ts\)/.test(p)), s.problems.join("; "));
  assert.equal(j.levels.rows.attested.length, 0, "a Statement that does not bind attests nothing");
});

test("R1: a manifest edited after the run, a narrower recorded set, a run with the network open: each unbinds", { skip }, () => {
  const manifest = fresh(signed);
  const floor = join(manifest, "runward", "floor.md");
  writeFileSync(floor, readFileSync(floor, "utf8").replace("## Rule conformance", "<!-- a later edit -->\n\n## Rule conformance"));
  const jm = checkJson(manifest, "--require", "attested");
  assert.equal(jm.exitCode, 5);
  assert.ok(jm.levels.execution.statements.find((x) => x.form === "dsse").problems.some((p) => /the manifests it records are not this tree's/.test(p)));

  const rewrap = (mutate) => {
    const d = fresh(signed);
    const st = JSON.parse(readFileSync(join(d, REPORTS, "runward-run.intoto.json"), "utf8"));
    mutate(st);
    rmSync(join(d, REPORTS, "runward-run.intoto.json"));
    writeFileSync(join(d, REPORTS, "runward-run.dsse.json"), countedEnvelope(Buffer.from(JSON.stringify(st))));
    return checkJson(d, "--require", "attested");
  };
  const narrower = rewrap((st) => { delete st.predicate.sources.files["code/src/core/domain/guard.ts"]; });
  assert.equal(narrower.exitCode, 5);
  assert.ok(narrower.levels.execution.statements[0].problems.some((p) => /narrower than the one this tree implies: 1 file\(s\) not recorded \(e\.g\. code\/src\/core\/domain\/guard\.ts\)/.test(p)),
    "the writer cannot narrow the set it binds (ADR-0117 note E: ADR-0098 option F with its weakness corrected)");
  const open = rewrap((st) => { st.predicate.network = "bridge"; });
  assert.equal(open.exitCode, 5);
  assert.ok(open.levels.execution.statements[0].problems.some((p) => /did not record the network as cut/.test(p)));
  const unsafe = rewrap((st) => { st.predicate.sources.files["../outside.ts"] = "0".repeat(64); });
  assert.ok(unsafe.levels.execution.statements[0].problems.some((p) => /not project-relative/.test(p)), "a recorded path outside the project is named, never opened");
  const control = rewrap(() => {});
  assert.equal(control.exitCode, 0, "control: the same Statement re-wrapped unchanged binds");
});

test("R1: a run that could not cut the network leaves nothing the gate reads as evidence", { skip }, () => {
  const d = fresh(lab);
  for (const f of ["runward-run.intoto.json", "runward-run.test-result.intoto.json"]) rmSync(join(d, REPORTS, f));
  const r = runLab(mkdtempSync(join(base, "nonet-")), d, { runtimeEnv: { FAKE_RUNTIME_NO_NETWORK_NONE: "1" } });
  assert.equal(r.status, 3);
  assert.equal(existsSync(r.out), false, "nothing written");
  const j = checkJson(d, "--require", "attested");
  assert.equal(j.exitCode, 5);
  assert.deepEqual(j.levels.execution.statements, [], "no run Statement in the tree: every report reads declared");
});

test("R1: a Sigstore bundle around the Statement is read too, its signature counted, never verified", { skip }, () => {
  const d = fresh(lab);
  const st = readFileSync(join(d, REPORTS, "runward-run.intoto.json"));
  const ss = makeSigstore();
  const bundle = makeBundle(ss, githubIdentity({ repo: "example/ci", workflow: ".github/workflows/runward-run.yml" }), st);
  writeFileSync(join(d, REPORTS, "runward-run.sigstore.json"), `${JSON.stringify(bundle)}\n`);
  const j = checkJson(d, "--require", "attested");
  assert.equal(j.exitCode, 0);
  assert.deepEqual(j.levels.execution.statements.map((s) => [s.form, s.signatures, s.bound]), [["statement", 0, true], ["sigstore-bundle", 1, true]]);
  // A forged bundle whose signature verifies under nothing still reads attested HERE: only the identity
  // check refuses it (ADR-0119 decision 5, runward-fleet verify-run). The sentence says so.
  const forged = { ...bundle, dsseEnvelope: { ...bundle.dsseEnvelope, signatures: [{ sig: Buffer.from("forged").toString("base64") }] } };
  writeFileSync(join(d, REPORTS, "runward-run.sigstore.json"), JSON.stringify(forged));
  const jf = checkJson(d, "--require", "attested");
  assert.equal(jf.exitCode, 0);
  assert.equal(jf.levels.signatureVerified, false);
});

test("R1: a run Statement and its bundle are about the tree, not part of it: the delivered tree and the analyzers leave them out", { skip }, () => {
  const att = spawnSync(process.execPath, [CLI, "check", "-p", signed, "--strict", "--require", "attested", "--attest", "--whole-tree"], { encoding: "utf8", env });
  assert.equal(att.status, 0, att.stderr);
  const doc = JSON.parse(att.stdout);
  const entries = Object.keys(doc.predicate.deliveredTree.entries);
  assert.ok(entries.includes("code/reports/junit.xml"), "the reports are delivered files");
  for (const f of ["runward-run.intoto.json", "runward-run.dsse.json"]) assert.ok(!entries.includes(`code/reports/${f}`), `${f} is not bound into the tree it describes`);
  const attPath = join(base, "att.json");
  writeFileSync(attPath, att.stdout);
  const v = spawnSync(process.execPath, [CLI, "verify", attPath, "-p", signed], { encoding: "utf8", env });
  assert.equal(v.status, 0, `verify re-derives the attestation made at attested, the levels block included: ${v.stdout.slice(-800)}`);
});
