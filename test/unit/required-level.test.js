// ADR-0114 decision 2: under --strict, a mission none of whose applied rows the gate verified no
// longer exits 0 as if it were proven. It exits 5, says so, and `--require traced` accepts it by name.
//
// Measured 2026-11-05 on 0.46.0 and `main` (case c4 of that day's witness): every one of the 46 rows of
// the five gated manifests set to `n/a` with one generic sentence, and `check --strict` printed
// "! nothing was verified mechanically" and then "all gates passed", exit 0. ADR-0060 decided that a
// vacuous green is disclosed, not refused, and wrote what a refusal would look like if one came: Jest's
// shape, a named flag. This is that refusal, and the flag is `--require traced`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verdictOutcome, requiredLevel, levelMet, LEVEL_NOT_MET_EXIT, REQUIRED_LEVELS } from "../../dist/lib/verdict.js";
import { currentGateLabel, nextStep, optionFault, rerunCommand } from "../../dist/lib/check-contract.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", SOURCE_DATE_EPOCH: "1" };
const run = (dir, ...a) => spawnSync("node", [CLI, ...a], { cwd: dir, encoding: "utf8", env });
const GATED = ["architecture.md", "execution-topology.md", "floor.md", "governance/threat-model.md", "handover.md"];
// Two applied rows answered in prose (the shape of the field report). The shipped example answered
// `topology-usage-registry-present` and `resilience-fail-open` in prose; since ADR-0115 it cites a JUnit
// case for the second, and a prose row whose rule requires a kind of evidence is refused for it
// (`requires-unmet`, a gap, exit 1). The second prose row is therefore one whose rule requires nothing.
const PROSE_ROWS = new Set(["topology-usage-registry-present", "handover-runbook-executable"]);
const PROSE_TEXT = { "handover-runbook-executable": "| handover-runbook-executable | applied | the team ran the runbook end to end on the staging copy |" };

/** Every manifest row through `fn(slug, line)`: a replacement line, or null to keep it. */
function rewriteRows(dir, fn) {
  for (const rel of GATED) {
    const p = join(dir, "runward", rel);
    const out = readFileSync(p, "utf8").split("\n").map((line) => {
      const m = line.match(/^\|\s*`?([a-z][a-z0-9-]+)`?\s*\|\s*(applied|deviated|n\/a)\s*\|.*\|\s*$/);
      return m ? fn(m[1], line, m[2]) ?? line : line;
    }).join("\n");
    writeFileSync(p, out);
  }
}

let base, example, vacuous, proseOnly;
const fresh = (from) => { const d = mkdtempSync(join(base, "case-")); cpSync(from, d, { recursive: true }); return d; };

before(() => {
  base = mkdtempSync(join(tmpdir(), "rw-level-"));
  example = join(base, "example");
  execFileSync("git", ["init", "-q", example]);
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: example, env });
  // c4: every row n/a, one generic sentence.
  vacuous = fresh(example);
  rewriteRows(vacuous, (slug) => `| ${slug} | n/a | not applicable at this stage of the mission |`);
  // The field report's shape: the rows that remain applied are all prose.
  proseOnly = fresh(example);
  rewriteRows(proseOnly, (slug, line) => (PROSE_ROWS.has(slug) ? PROSE_TEXT[slug] ?? line : `| ${slug} | n/a | not applicable at this stage of the mission |`));
});
after(() => rmSync(base, { recursive: true, force: true }));

test("c4: every row n/a exits 5, says why, and the JSON carries the level, the verdict and the way out", () => {
  const r = run(vacuous, "check", "--strict");
  assert.equal(r.status, LEVEL_NOT_MET_EXIT, r.stdout.slice(-600));
  assert.match(r.stdout, /0 applied · 0 deviated · 46 n\/a/);
  assert.match(r.stdout, /Current gate\s+deliverables filled, nothing verified mechanically/);
  assert.match(r.stdout, /No gap, and nothing was verified mechanically: no applied row carries a pointer the gate opened and checked, and this run requires `mechanical` \(exit 5, runward ADR-0114\)/);
  assert.doesNotMatch(r.stdout, /all gates passed|All expected deliverables are filled/);
  assert.match(r.stdout, /runward check --strict --require traced\./, "the Next line names the explicit acceptance");
  const j = JSON.parse(run(vacuous, "check", "--strict", "--json").stdout);
  assert.equal(j.verdict, "level-not-met");
  assert.equal(j.exitCode, 5);
  assert.deepEqual(j.require, { level: "mechanical", met: false });
  assert.equal(j.next.action, "verify-a-row");
  assert.deepEqual([j.gaps.deliverables, j.gaps.conformance], [0, 0], "no gap: what stands between this run and a green is the level");
});

test("--require traced accepts it by name, exit 0, and the run still says what the green rests on", () => {
  const r = run(vacuous, "check", "--strict", "--require", "traced");
  assert.equal(r.status, 0, r.stdout.slice(-600));
  assert.match(r.stdout, /Nothing was verified mechanically: this green rests on judgment alone, accepted because this run requires `traced`/);
  assert.match(r.stdout, /this run asked for that by name \(`--require traced`\)/);
  const j = JSON.parse(run(vacuous, "check", "--strict", "--require", "traced", "--json").stdout);
  assert.deepEqual([j.verdict, j.exitCode, j.require], ["clean", 0, { level: "traced", met: true }]);
});

test("the field report's shape, applied rows that are all prose, exits 5 too", () => {
  const j = JSON.parse(run(proseOnly, "check", "--strict", "--json").stdout);
  assert.equal(j.evidence.applied, 2, "two rows applied, in prose");
  assert.equal(j.evidence.typed, 0);
  assert.deepEqual([j.verdict, j.exitCode], ["level-not-met", 5]);
  assert.equal(run(proseOnly, "check", "--strict").status, 5);
});

test("the shipped example stays green at `mechanical`; `traced` changes nothing on it", () => {
  const r = run(example, "check", "--strict");
  assert.equal(r.status, 0, r.stdout.slice(-400));
  assert.doesNotMatch(r.stdout, /nothing was verified mechanically/i);
  const j = JSON.parse(run(example, "check", "--strict", "--json").stdout);
  assert.deepEqual([j.verdict, j.exitCode, j.require], ["clean", 0, { level: "mechanical", met: true }]);
  assert.equal(run(example, "check", "--strict", "--require", "traced").status, 0);
  assert.equal(JSON.parse(run(example, "check", "--json").stdout).require, undefined, "without --strict no row is read and no level is answered");
});

test("gaps come first: a red mission exits 1 whatever its level", () => {
  const red = fresh(vacuous);
  rewriteRows(red, (slug, line) => (slug === "hexa-architecture" ? `| ${slug} | applied | file:code/src/nowhere.ts |` : line));
  const j = JSON.parse(run(red, "check", "--strict", "--json").stdout);
  assert.deepEqual([j.verdict, j.exitCode], ["gaps", 1]);
  assert.equal(run(red, "check", "--strict").status, 1);
});

test("a --through prefix requires `traced` unless told otherwise; misuse exits 2", () => {
  assert.equal(run(vacuous, "check", "--strict", "--through", "floor").status, 0, "a prefix verdict certifies progress (ADR-0053)");
  assert.equal(run(vacuous, "check", "--strict", "--through", "floor", "--require", "mechanical").status, 5, "asked by name, the level applies to a prefix too");
  const bare = run(vacuous, "check", "--require", "traced");
  assert.equal(bare.status, 2);
  assert.match(bare.stderr, /`--require` sets the level of proof a strict verdict demands/);
  assert.equal(run(vacuous, "check", "--strict", "--require", "attested").status, 2, "an unknown level is a usage error");
});

test("every rendering of the run states the code it exits with", () => {
  const dir = fresh(vacuous);
  const vsa = run(dir, "check", "--strict", "--vsa", "--resource-uri", "pkg:npm/x@1");
  assert.equal(vsa.status, 5);
  assert.equal(JSON.parse(vsa.stdout).predicate.verificationResult, "FAILED", "a level not met is not a pass");
  const xml = join(dir, "gate.xml");
  assert.equal(run(dir, "check", "--strict", "--junit", xml).status, 5);
  const junit = readFileSync(xml, "utf8");
  assert.match(junit, /<failure message="nothing was verified mechanically \(exit 5\)" type="runward\/gate">/);
  assert.match(junit, /name="runward.exit-code" value="5"/);
  const wf = join(dir, "w.json");
  assert.equal(run(dir, "check", "--strict", "--witness", wf).status, 5);
  const w = JSON.parse(readFileSync(wf, "utf8"));
  assert.deepEqual([w.verdict.result, w.verdict.exitCode, w.verdict.require], ["clean", 0, { level: "mechanical", met: false }], "witness/1 keeps its arithmetic; the level is an added member");
  assert.ok(w.notWitnessed.some((x) => x.family === "required-level") && w.notWitnessed.some((x) => x.family === "comments"));
  const md = run(dir, "report", "--format", "md");
  assert.equal(md.status, 0);
  assert.match(md.stdout, /## runward gate: LEVEL NOT MET/);
  assert.match(md.stdout, /\*\*Verdict: LEVEL NOT MET\*\*, exit code 5 \(no gap, and the level of proof the run required is not met/);
  const st = run(dir, "status");
  assert.match(st.stdout, /Strict gate\s+no gap, nothing verified mechanically \(exit 5, ADR-0114\)/);
  assert.doesNotMatch(st.stdout, /delivery arc complete/);
  const pack = join(dir, "pack");
  assert.equal(run(dir, "compliance", "iso-42001", "--out", pack).status, 0);
  assert.match(readFileSync(join(pack, "iso-42001-readiness.md"), "utf8"), /Gate verdict when this draft was assembled: level not met \(--strict, exit 5, 0 conformance gap\(s\)\)/);
  const freeze = run(dir, "check", "--freeze");
  assert.equal(freeze.status, 5);
  assert.match(freeze.stdout, /refusing to seal: nothing was verified mechanically/);
  assert.equal(existsSync(join(dir, "runward", "evidence-lock.json")), false, "nothing was sealed");
});

test("verify re-derives at the level the attestation records, and refuses a forged green", () => {
  const dir = fresh(vacuous);
  const attPath = join(dir, "att.json");
  const att = run(dir, "check", "--strict", "--attest");
  assert.equal(att.status, 5);
  writeFileSync(attPath, att.stdout);
  const ok = run(dir, "verify", attPath);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /honestly records a gate that did not cross: no gap, and nothing was verified mechanically/);
  // Forged: the same attestation claiming a clean exit 0 while it records the `mechanical` level.
  const forged = JSON.parse(att.stdout);
  Object.assign(forged.predicate, { verdict: "clean", exitCode: 0 });
  writeFileSync(attPath, JSON.stringify(forged));
  const bad = run(dir, "verify", attPath);
  assert.equal(bad.status, 1, bad.stdout);
  assert.match(bad.stdout, /verdict DIFFERS — attested "clean", re-derived "level-not-met"/);
  // An attestation that records no level was written by a runward before ADR-0114, another producer:
  // answered exit 2 (ADR-0113 decision 4), read at `traced` as advisory, and it says so.
  const older = JSON.parse(run(dir, "check", "--strict", "--require", "traced", "--attest").stdout);
  delete older.predicate.require;
  older.predicate.runward = "0.46.0";
  older.predicate.producer = { ...older.predicate.producer, version: "0.46.0", purl: "pkg:npm/runward@0.46.0", build: "sha256:" + "0".repeat(64) };
  writeFileSync(attPath, JSON.stringify(older));
  const legacy = run(dir, "verify", attPath);
  assert.equal(legacy.status, 2, legacy.stdout);
  assert.match(legacy.stdout, /records no level of proof \(`require`\): its verdict was re-derived at `traced`/);
  // Under the build that produced it, the same attestation without its `require` block is a removal.
  const stripped = JSON.parse(run(dir, "check", "--strict", "--require", "traced", "--attest").stdout);
  delete stripped.predicate.require;
  writeFileSync(attPath, JSON.stringify(stripped));
  assert.equal(run(dir, "verify", attPath).status, 1, "a strict attestation of this build without `require` differs (ADR-0113)");
  // Recording a level it was not run at is a difference too.
  const relabelled = JSON.parse(run(dir, "check", "--strict", "--require", "traced", "--attest").stdout);
  relabelled.predicate.require = { level: "mechanical", met: true };
  writeFileSync(attPath, JSON.stringify(relabelled));
  assert.equal(run(dir, "verify", attPath).status, 1, "a `require` block the tree does not give differs");
});

test("the contract, without a process: the outcome, the default level, the label, the Next step, the faults", () => {
  assert.deepEqual(REQUIRED_LEVELS, ["traced", "mechanical"], "ordered from the least to the most demanding");
  assert.deepEqual(verdictOutcome(false, { level: "mechanical", met: false }), { verdict: "gaps", exitCode: 1 }, "gaps first");
  assert.deepEqual(verdictOutcome(true, { level: "mechanical", met: false }), { verdict: "level-not-met", exitCode: 5 });
  assert.deepEqual(verdictOutcome(true, { level: "traced", met: true }), { verdict: "clean", exitCode: 0 });
  assert.deepEqual(verdictOutcome(true, null), { verdict: "clean", exitCode: 0 }, "no --strict, no level");
  assert.equal(requiredLevel({}), "mechanical");
  assert.equal(requiredLevel({ through: "floor" }), "traced");
  assert.equal(requiredLevel({ through: "floor", require: "mechanical" }), "mechanical");
  assert.equal(requiredLevel({ require: "traced" }), "traced");
  assert.equal(levelMet("mechanical", { typed: 0 }), false);
  assert.equal(levelMet("mechanical", { typed: 1 }), true);
  assert.equal(levelMet("traced", { typed: 0 }), true);
  const filled = { currentPhase: "all gates passed", steadyState: true };
  assert.equal(currentGateLabel(filled, true, [], true), "deliverables filled, nothing verified mechanically");
  assert.equal(currentGateLabel(filled, true, [], false), "all gates passed");
  assert.equal(currentGateLabel(filled, false, ["Floor"], true), "deliverables filled, gate red at Floor", "red wins over the level");
  const zero = { conformance: 0, corpus: 0, seal: 0, unratified: 0, proposed: 0, unboundRows: 0, charter: 0 };
  const n = nextStep({ gaps: 0, strictGaps: 0, hookFailed: 0, breakdown: zero, levelNotMet: true }, { strict: true });
  assert.equal(n.action, "verify-a-row");
  assert.equal(n.rerun, "runward check --strict");
  assert.ok(n.segments.some((s) => s.text === "runward check --strict --require traced"));
  assert.equal(nextStep({ gaps: 1, strictGaps: 0, hookFailed: 0, breakdown: zero, levelNotMet: true }, { strict: true }).action, "fill-deliverables", "gaps first");
  assert.equal(nextStep({ gaps: 0, strictGaps: 0, hookFailed: 0, breakdown: zero }, { strict: true }).action, "assemble-evidence-pack");
  assert.match(optionFault({ require: "traced" })?.message ?? "", /add `--strict`/);
  assert.equal(optionFault({ require: "traced", strict: true }), null);
  assert.equal(rerunCommand({ strict: true, require: "traced" }), "runward check --strict --require traced");
});
