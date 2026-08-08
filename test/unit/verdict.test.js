// The verdict itself: what turns a mission on disk into an exit code.
//
// Until 2026-08-06 this logic lived inside `src/commands/check.ts` and no unit test imported it.
// Line coverage there was 8.70 per cent, function coverage zero, and the mutation pass of ADR-0046
// could not measure it at all: mutating a file no test imports yields 100 per cent survivors, which
// is noise and not a measurement. The project could therefore say "we measured what our net
// catches" everywhere except where the verdict is decided, and that is the region the 22 false
// positives of ADR-0045 lived in.
//
// So these cases pin the decision, not the rendering. `test/smoke.js` and `test/audit-corpus.js`
// already drive the real CLI end to end; what neither can do is fail fast on a single term of the
// arithmetic. Every guard below is exercised in BOTH directions, because a gate that refuses
// everything passes a one-sided fixture just as well as a correct one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, appendFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { computeVerdict, verdictFrom } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

// One reference mission, built once by the real CLI, then copied per case. `init --example` is the
// mission the project ships as green; starting from a bare scaffold instead would make every case
// red for reasons unrelated to what it tests, which is how a fixture stops proving anything.
const REFERENCE = mkdtempSync(join(tmpdir(), "rw-verdict-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-verdict-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}

// ── The arithmetic ──────────────────────────────────────────────────────────────────────────────
// `verdictFrom` is the single definition of "clean". It is exported precisely so the command cannot
// grow a second copy at the bottom of the render, which is how two versions of one rule drift.

test("all three counts at zero is the only clean verdict, and it exits 0", () => {
  assert.deepEqual(verdictFrom(0, 0, 0), { clean: true, exitCode: 0 });
});

test("each term alone reddens the gate, and none of the three is decorative", () => {
  // Written as three separate assertions on purpose: an `||` chain reduced to a single term still
  // passes a test that only ever checks the sum.
  assert.deepEqual(verdictFrom(1, 0, 0), { clean: false, exitCode: 1 }, "an unfilled deliverable must red");
  assert.deepEqual(verdictFrom(0, 1, 0), { clean: false, exitCode: 1 }, "a strict gap must red");
  assert.deepEqual(verdictFrom(0, 0, 1), { clean: false, exitCode: 1 }, "a failed hook must red");
});

test("a failed hook is not overruled by an otherwise perfect mission", () => {
  // The operator's own check saying no. runward reports it; it never nets it out against its own
  // findings.
  assert.equal(verdictFrom(0, 0, 3).clean, false);
});

test("the exit code is 1, never the count of what went wrong", () => {
  // 2 is reserved for "no mission found" and is decided before this function is reached. A gate
  // that returned 7 for seven gaps would break every `if [ $? -eq 1 ]` in the wild.
  assert.equal(verdictFrom(9, 9, 9).exitCode, 1);
});

// ── Deliverables gate with or without --strict ──────────────────────────────────────────────────

test("the reference mission is clean under --strict, and exits 0", () => {
  // The base case. Without it, every refusal below could be a broken fixture rather than a working
  // guard, which is the failure this file exists to prevent elsewhere.
  const m = mission();
  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.gaps, 0, "no deliverable gap");
  assert.equal(v.strictGaps, 0, `no strict gap, got: ${JSON.stringify(v.gated.flatMap((g) => g.violations).slice(0, 3))}`);
  assert.equal(v.clean, true);
  assert.equal(v.exitCode, 0);
  m.drop();
});

test("a deliverable reverted to its raw template gates the phase, with or without --strict", () => {
  // `gaps` is the one term that does not depend on --strict: a phase never closes without its
  // artifact. Asserting both modes forbids moving this counter inside the strict branch.
  const m = mission();
  writeFileSync(join(m.mission, "framing.md"), readFileSync(join(ROOT, "templates", "mission", "framing.md")));
  for (const strict of [false, true]) {
    const v = computeVerdict(m.mission, { strict });
    assert.ok(v.gaps > 0, `strict=${strict}: a raw template must count as a gap`);
    assert.equal(v.exitCode, 1, `strict=${strict}: and must red the gate`);
  }
  m.drop();
});

test("every deliverable is reported, filled or not, and the row carries its state", () => {
  // The `--json` contract (ADR-0030) is built from this list. A list that only carried failures
  // would make an empty mission and a perfect one look alike to a machine.
  const m = mission();
  const v = computeVerdict(m.mission, { strict: true });
  assert.ok(v.deliverables.length >= 10, `expected the full set, got ${v.deliverables.length}`);
  assert.ok(v.deliverables.every((d) => d.phase && d.artifact && d.relPath && d.state));
  assert.equal(v.deliverables.filter((d) => d.state !== "filled").length, v.gaps, "gaps must equal the non-filled rows");
  m.drop();
});

// ── What --strict adds, term by term ────────────────────────────────────────────────────────────

test("without --strict the strict readings are empty rather than absent, and cost nothing", () => {
  // A consumer must never have to test which mode produced the object. Returning `undefined` here
  // would push a null check into every caller, and a missed one reads as "no violations".
  const m = mission();
  const v = computeVerdict(m.mission, { strict: false });
  assert.equal(v.strictGaps, 0);
  assert.deepEqual(v.gated, []);
  assert.equal(v.checked, 0);
  assert.equal(v.seal.present, false);
  assert.deepEqual(v.unratified, []);
  m.drop();
});

test("a typed pointer that no longer opens is a strict gap, and only under --strict", () => {
  // The evidence layer (ADR-0019) joined to the verdict. Non-strict must stay green on the same
  // mission: that is the contract between the two modes, and a single-mode assertion would let the
  // strict branch swallow the plain one.
  const m = mission();
  const f = join(m.mission, "architecture.md");
  const before = readFileSync(f, "utf8");
  const after = before.replace("file:code/src/core/ports/model-provider.port.ts#TriageModelPort",
    "file:code/src/does-not-exist.ts#Nothing");
  // Assert the fixture actually changed before believing anything about the verdict. A pattern that
  // matches nothing produces a green run that looks like a passing test, which is how three
  // mutation survivors were wrongly declared harmless on 2026-08-02.
  assert.notEqual(after, before, "the fixture must really break a pointer");
  writeFileSync(f, after);
  assert.equal(computeVerdict(m.mission, { strict: false }).exitCode, 0, "plain mode does not read pointers");
  const v = computeVerdict(m.mission, { strict: true });
  assert.ok(v.strictGaps > 0, "a dead pointer must be a strict gap");
  assert.equal(v.exitCode, 1);
  m.drop();
});

test("every gated deliverable is examined on a shipped mission: the skip branch is unreachable there", () => {
  // Measured on 2026-08-06, on BOTH shipped missions (`init --yes` and `init --yes --example`):
  // five gated deliverables, five examined, zero skipped. The skip needs a deliverable with no
  // expected rule AND no violation, and ADR-0002 pins every phase floor above zero, so stripping a
  // mapping raises `(mapping)` instead of falling silent. The branch therefore cannot fire on any
  // corpus runward ships.
  //
  // This test says exactly that, rather than fabricating a mission to reach the branch. It is
  // written to break the day the claim stops holding: a shipped mission that skips a deliverable is
  // either a floor set to zero or a mapping violation gone missing, and both deserve to be looked
  // at rather than absorbed.
  for (const args of [["init", "--yes"], ["init", "--yes", "--example"]]) {
    const dir = mkdtempSync(join(tmpdir(), "rw-verdict-skip-"));
    execFileSync(process.execPath, [CLI, ...args], { cwd: dir, stdio: "pipe" });
    const v = computeVerdict(join(dir, "runward"), { strict: true });
    assert.equal(v.gated.filter((g) => g.skipped).length, 0, `${args.join(" ")}: no deliverable may be skipped`);
    assert.equal(v.checked, v.gated.length, `${args.join(" ")}: checked must count them all`);
    assert.ok(v.checked > 0, `${args.join(" ")}: and there must be something to check`);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the corpus reaches the verdict on its own: an edited rule reddens a mission with nothing else wrong", () => {
  // ADR-0045 class 1. The gate judges a mission against a corpus the mission OWNS, and an audit
  // made it exit 0 on 36 rule files containing the word "ok": `update` read `scaffold-lock.json`,
  // `check` did not.
  //
  // An EDIT rather than a removal, deliberately. Removing a rule also drops the phase below its
  // ADR-0002 floor, so the mission reddens through the mapping violation and the test passes with
  // the corpus contribution deleted. That is exactly the tautology this file is meant to avoid: the
  // first version of this case survived `corpus contribution = 0`.
  const m = mission();
  const base = computeVerdict(m.mission, { strict: true });
  assert.equal(base.strictGaps, 0, "the reference mission must start with nothing else wrong");
  assert.equal(base.corpus.status, "verifiable", "and with a corpus the gate can check");

  const rules = join(m.mission, "rules");
  const victim = readdirSync(rules).find((f) => f.endsWith(".md"));
  assert.ok(victim, "the mission keeps a local rule copy");
  appendFileSync(join(rules, victim), "\nan edit runward did not write\n");

  const v = computeVerdict(m.mission, { strict: true });
  assert.deepEqual(v.corpus.edited, [victim], "the edited rule must be named");
  assert.equal(v.strictGaps, 1, "and must be the ONLY thing in the verdict, which is what proves it counts");
  assert.equal(v.exitCode, 1);
  m.drop();
});

test("a mission whose corpus cannot be checked is refused, not merely warned about", () => {
  // Found on 2026-08-06 against the published 0.33.0, while investigating something else entirely.
  //
  // `corpusDivergence` answers `unrecorded` when a mission keeps its own rule copy and carries no
  // `scaffold-lock.json`. That state was a warning in the printed text and NOTHING in the verdict.
  // But the lock lives in the audited repository, so "this mission predates the lock" is
  // indistinguishable from "someone deleted the lock". Measured: 64 rule files reduced to the word
  // "ok" exit 1 with the lock present and **exit 0** with the lock removed. ADR-0045 class 1,
  // reopened by deleting one file the audited party owns, and `known-defects.md` called that class
  // closed.
  //
  // Both directions are pinned below, because the fix must not punish the honest configurations:
  // a mission with no local copy at all judges against the installed package and stays green.
  const m = mission();
  assert.equal(computeVerdict(m.mission, { strict: true }).exitCode, 0, "the reference mission starts green");

  rmSync(join(m.mission, "scaffold-lock.json"), { force: true });
  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.corpus.status, "unrecorded", "removing the lock must be seen");
  assert.equal(v.strictGaps, 1, "and must be the ONLY thing in the verdict, which is what proves it counts");
  assert.equal(v.exitCode, 1);

  // The safest configuration there is: nothing local to edit, so nothing to vouch for.
  rmSync(join(m.mission, "rules"), { recursive: true, force: true });
  const w = computeVerdict(m.mission, { strict: true });
  assert.equal(w.corpus.status, "package", "no local copy judges against the installed package");
  assert.equal(w.exitCode, 0, "and must not be punished for it");
  m.drop();
});

test("an unratified decision is a strict gap: a hypothesis is not a decision", () => {
  const m = mission();
  const adr = join(m.mission, "adr");
  mkdirSync(adr, { recursive: true });
  writeFileSync(join(adr, "DRAFT-0099-something.md"),
    "# DRAFT-0099: something\n\n**Status**: proposed\n\n## Context\n\nA hypothesis.\n");
  const v = computeVerdict(m.mission, { strict: true });
  assert.ok(v.unratified.length > 0, "the draft must be named");
  assert.ok(v.strictGaps >= v.unratified.length, "and must reach the verdict");
  assert.equal(v.exitCode, 1);
  m.drop();
});

// ── The seal ────────────────────────────────────────────────────────────────────────────────────
// RWD-2026-0010: one field flipped in `verifyEvidenceLock` made a tampered sealed mission go from
// exit 1 to exit 0, with the violations neither printed nor counted, and nothing reddened.

test("a tampered seal reddens the gate", () => {
  const m = mission();
  execFileSync(process.execPath, [CLI, "check", "--freeze", "-p", "."], { cwd: m.dir, stdio: "pipe" });
  assert.equal(computeVerdict(m.mission, { strict: true }).exitCode, 0, "a fresh seal must be intact");
  appendFileSync(join(m.mission, "floor.md"), "\nan edit after sealing\n");
  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.seal.present, true, "the seal must still be seen");
  assert.ok(v.seal.violations.length > 0, "and its violations found");
  assert.ok(v.strictGaps > 0, "and counted into the verdict");
  assert.equal(v.exitCode, 1);
  m.drop();
});

test("an unreadable seal reddens rather than being ignored", () => {
  // The exact mutation that survived every net on 2026-08-05: `present: true` returned false on the
  // unparseable-lock path, so `check.ts` skipped the whole section and a corrupted seal read as no
  // seal at all.
  const m = mission();
  execFileSync(process.execPath, [CLI, "check", "--freeze", "-p", "."], { cwd: m.dir, stdio: "pipe" });
  writeFileSync(join(m.mission, "evidence-lock.json"), "not json at all");
  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.seal.present, true, "a corrupted lock is a seal that is present and broken, never an absent one");
  assert.ok(v.strictGaps > 0);
  assert.equal(v.exitCode, 1);
  m.drop();
});

test("--freeze does not verify the seal it is about to replace", () => {
  // Otherwise re-sealing is impossible: the changed file reddens the very gate freeze requires
  // green. Everything else must still be checked, which is why this asserts the seal is skipped and
  // NOT that the verdict is green.
  const m = mission();
  execFileSync(process.execPath, [CLI, "check", "--freeze", "-p", "."], { cwd: m.dir, stdio: "pipe" });
  appendFileSync(join(m.mission, "floor.md"), "\nan edit after sealing\n");
  assert.equal(computeVerdict(m.mission, { strict: true }).exitCode, 1, "without freeze the drift reddens");
  const v = computeVerdict(m.mission, { strict: true, freeze: true });
  assert.equal(v.seal.present, false, "under freeze the old seal is not read");
  assert.equal(v.exitCode, 0, "and nothing else was wrong");
  m.drop();
});

// ── Hooks reach the verdict without being run here ──────────────────────────────────────────────

test("a hook failure passed in reddens an otherwise clean mission", () => {
  // Hooks execute the operator's commands and stay in the command layer. Only the count crosses
  // into the verdict, which is what makes this arithmetic testable without spawning anything.
  const m = mission();
  assert.equal(computeVerdict(m.mission, { strict: true }).exitCode, 0);
  const v = computeVerdict(m.mission, { strict: true, hookFailed: 1 });
  assert.equal(v.clean, false);
  assert.equal(v.exitCode, 1);
  m.drop();
});

test("computeVerdict runs nothing and writes nothing", () => {
  // The module is a pure reading of the mission. If it ever grew a side effect, a caller could not
  // ask it twice, and `runward status` and `runward check` would stop agreeing.
  const m = mission();
  const before = readdirSync(m.mission).sort().join("|");
  const a = computeVerdict(m.mission, { strict: true });
  const b = computeVerdict(m.mission, { strict: true });
  assert.equal(readdirSync(m.mission).sort().join("|"), before, "no file may appear or vanish");
  assert.deepEqual([a.gaps, a.strictGaps, a.exitCode], [b.gaps, b.strictGaps, b.exitCode], "same tree, same verdict");
  m.drop();
});

// ── The machine surface must not be quieter than the terminal ───────────────────────────────────

test("`check --strict --json` carries what the terminal shows, and an empty mission is distinguishable", () => {
  // Until 2026-08-08 the payload was strictly LESS informative than the text beside it: no counters,
  // no corpus status, no seal. An agent driving on `--json` — which is how this tool is meant to be
  // consumed, and how a CI reads it blind — could not tell a mission carrying real evidence from one
  // answering `n/a` to every row. Both said `verdict: "clean"`.
  //
  // That inverts ADR-0045's own finding, one layer out: the worst case must not be the quietest.
  // This spawns the real CLI rather than importing, because the payload is assembled in the command.
  const m = mission();
  const full = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", "."],
    { cwd: m.dir, encoding: "utf8" }));

  for (const k of ["evidence", "corpus", "seal", "gateNonScope"]) {
    assert.ok(k in full, `--strict --json must carry \`${k}\``);
  }
  assert.ok(full.evidence.rows > 0 && full.evidence.applied > 0, "the reference mission applies rows");
  assert.equal(full.corpus.status, "verifiable");
  assert.ok(full.gateNonScope.includes("It never proves the evidence truly implements"),
    "the caveat travels with the counters, or a consumer keeps the numbers and drops it");

  // Gut the mission: every row to `n/a`. The verdict stays clean by design (ADR-0004 accepts
  // judgment), and that is exactly why the COUNTERS have to move — they are the only thing that
  // separates the two missions for a reader that never sees the text.
  for (const f of ["architecture.md", "floor.md"]) {
    const p = join(m.mission, f);
    const before = readFileSync(p, "utf8");
    const after = before.replace(/^\| ([a-z0-9-]+) \| (applied|deviated) \|[^\n]*$/gm,
      "| $1 | n/a | not applicable to this component |");
    assert.notEqual(after, before, `${f}: the fixture must really change`);
    writeFileSync(p, after);
  }
  const gutted = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", "."],
    { cwd: m.dir, encoding: "utf8" }));
  assert.ok(gutted.evidence.applied < full.evidence.applied,
    `an emptied mission must report fewer applied rows (${gutted.evidence.applied} vs ${full.evidence.applied})`);
  assert.ok(gutted.evidence.na > full.evidence.na, "and more n/a");

  // Without --strict the strict-only readings stay absent: the contract is additive, not chatty.
  const plain = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--json", "-p", "."],
    { cwd: m.dir, encoding: "utf8" }));
  assert.ok(!("evidence" in plain), "plain mode reads no evidence, so it reports none");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
