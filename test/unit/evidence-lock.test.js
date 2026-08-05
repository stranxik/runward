// The seal verdict: what `runward check --strict` does with runward/evidence-lock.json.
//
// Found by the full mutation pass of 2026-08-04. Seven mutants inside `verifyEvidenceLock` were
// re-run through the whole net (unit suite, self-gate, OSCAL validation, smoke); five came back
// alive. Measured on 2026-08-05 against a real sealed mission (`init --yes --example`, then
// `check --freeze`, then tamper with the lock), each of the five turns `check --strict` from
// exit 1 into exit 0:
//
//   · `present: true` → `false` on the unparseable-lock return — check.ts only enters the seal
//     section when `present`, so a corrupt lock is skipped in silence: no line printed, gate green.
//   · `if (v !== undefined && v !== 1)` → `false`, and `v !== undefined` → `v === undefined` — a
//     lock declaring `version: 999` is consumed as a v1 and reported `✓ seal intact — 18 file(s)`.
//     The second one also invents a violation on a lock carrying no version field at all: a false
//     red, which is how a gate gets switched off.
//   · `if (Object.keys(files).length === 0)` → `false` — an empty seal prints
//     `✓ seal intact — 0 evidence file(s)` and exits 0. A seal over nothing reads like proof.
//   · `!existsSync(abs) || !isRegularFile(abs)` → `&&` — an entry naming something that is not a
//     regular file falls through to the hash comparison, where sha256's unreadable-file sentinel
//     is a value a forged lock can simply declare: `✓ seal intact — 1 evidence file(s)`, exit 0.
//
// Nothing else in the CLI reads evidence-lock.json (grep: only check.ts, through this function),
// so there is no second mechanism behind it. Its violations are the only thing that carries a
// broken seal into `strictGaps`, and `strictGaps` is the exit code.
//
// The two other mutants of the batch were already dead when re-measured on 2026-08-05: forcing the
// version check to `true` and forcing the containment check to `false` both fail
// evidence.test.js's traversal test. The containment check is left to that test and is not
// re-pinned here; the `true` case falls out of the version tests below anyway.
//
// Each test names the decision it pins and the dangerous direction, and every refusal is paired
// with the acceptance that forbids a constant from satisfying it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderEvidenceLock, verifyEvidenceLock, EVIDENCE_LOCK } from "../../dist/lib/evidence.js";

const manifest = (rows) =>
  "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n") + "\n";

// A mission carrying one real piece of evidence, plus the lock the writer would produce for it.
// Building the reference lock with renderEvidenceLock (rather than hand-writing hashes) keeps the
// "accept" half of every test honest: it is the exact bytes a real `check --freeze` writes.
function sealedMission() {
  const root = mkdtempSync(join(tmpdir(), "runward-seal-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "a.ts"), "the evidence the gate crossed on\n");
  writeFileSync(join(mission, "floor.md"), manifest([["r1", "applied", "file:a.ts"]]));
  const lock = JSON.parse(renderEvidenceLock(mission, "2026-08-05"));
  return { root, mission, lock };
}
const writeLock = (mission, obj) =>
  writeFileSync(join(mission, EVIDENCE_LOCK), JSON.stringify(obj, null, 2) + "\n");
const cleanup = (root) => rmSync(root, { recursive: true, force: true });

// ── The version gate ────────────────────────────────────────────────────────────────────────────
// `if (v !== undefined && v !== 1)`. A lock this build cannot read must not be read as a v1.

test("a lock declaring a version this build does not read is refused, and a v1 lock is accepted", () => {
  // The dangerous direction: consuming an unknown lock format in silence. A future v2 lock, or a
  // forged one, would then be interpreted under v1 rules and reported `✓ seal intact`.
  const { root, mission, lock } = sealedMission();
  try {
    writeLock(mission, { ...lock, version: 999 });
    const bad = verifyEvidenceLock(mission).violations;
    assert.equal(bad.length, 1, "an unreadable lock version is a violation on its own");
    assert.match(bad[0].problem, /declares version 999/);
    // The opposite direction, so the test cannot be met by refusing everything: the lock the
    // writer actually produces must stay silent.
    writeLock(mission, lock);
    assert.deepEqual(verifyEvidenceLock(mission).violations, []);
  } finally { cleanup(root); }
});

test("a lock with no version field is still read as a v1, but a non-numeric version is refused", () => {
  // Pins the `!== undefined` half. Inverting it to `=== undefined` reddens every version-less lock
  // — a gate that cries on a valid seal — while waving through the `version: 999` above.
  const { root, mission, lock } = sealedMission();
  try {
    const { version, ...noVersion } = lock;
    assert.equal(version, 1, "fixture must start from a real v1 lock");
    writeLock(mission, noVersion);
    assert.deepEqual(verifyEvidenceLock(mission).violations, [], "an absent version is not an unknown version");
    // And the paired refusal: `"1"` is a version string, not version 1.
    writeLock(mission, { ...lock, version: "1" });
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /declares version "1"/);
  } finally { cleanup(root); }
});

// ── The empty seal ──────────────────────────────────────────────────────────────────────────────
// `if (Object.keys(files).length === 0)`. Sealing nothing is not a crossing.

test("a seal over zero files is a violation, and a seal over one file is intact", () => {
  // The dangerous direction: `✓ seal intact — 0 evidence file(s)` in a CI log is one digit away
  // from a real seal, and exits 0. Dropping this branch is a green gate certifying nothing.
  const { root, mission, lock } = sealedMission();
  try {
    writeLock(mission, { version: 1, sealedAt: lock.sealedAt, files: {} });
    const empty = verifyEvidenceLock(mission);
    assert.equal(empty.count, 0);
    assert.equal(empty.violations.length, 1);
    assert.match(empty.violations[0].problem, /seals zero files/);
    // The opposite direction: a seal that does cover something must pass, and count what it covers.
    writeLock(mission, lock);
    const real = verifyEvidenceLock(mission);
    assert.deepEqual(real.violations, []);
    assert.ok(real.count > 0, "a real seal counts the files it froze");
  } finally { cleanup(root); }
});

// ── The sealed entry that is not a regular file ─────────────────────────────────────────────────
// `if (!existsSync(abs) || !isRegularFile(abs))`. Either failure means the evidence is gone; the
// hash comparison below must never be reached for something that cannot be read as a file.

test("a sealed entry that is not a regular file is missing evidence, whatever hash the lock claims", () => {
  // The dangerous direction: turning `||` into `&&` sends a directory (or a fifo, or a device) to
  // sha256, which answers with its unreadable-file sentinel. A forged lock that simply declares
  // that sentinel as the hash then verifies clean — `✓ seal intact — 1 evidence file(s)`, exit 0.
  const { root, mission, lock } = sealedMission();
  try {
    mkdirSync(join(root, "adir"));
    writeLock(mission, { version: 1, sealedAt: lock.sealedAt, files: { adir: "unreadable" } });
    const forged = verifyEvidenceLock(mission).violations;
    assert.equal(forged.length, 1, "a directory is never sealed evidence, even against the sentinel hash");
    assert.match(forged[0].problem, /sealed evidence missing: adir/);
    // Same entry, an ordinary hash: the diagnosis must still be "missing", not "changed" — the
    // gate must not claim it read a file it never opened.
    writeLock(mission, { version: 1, sealedAt: lock.sealedAt, files: { adir: "0".repeat(64) } });
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /sealed evidence missing: adir/);
    // The opposite direction: a real regular file at its sealed hash stays silent.
    writeLock(mission, lock);
    assert.deepEqual(verifyEvidenceLock(mission).violations, []);
  } finally { cleanup(root); }
});

// ── The unparseable lock ────────────────────────────────────────────────────────────────────────
// `return { present: true, ... }` in the catch. `present` is not decoration: check.ts prints and
// counts the seal section only `if (seal.present)`.

test("an unparseable lock is present and red, never treated as no seal at all", () => {
  // The dangerous direction: flipping `present` to false makes a corrupt lock indistinguishable
  // from a mission that was never sealed. The violation is still built, and never looked at:
  // measured on a real mission, `check --strict` printed no seal section and exited 0.
  const { root, mission } = sealedMission();
  try {
    writeFileSync(join(mission, EVIDENCE_LOCK), "{not json");
    const r = verifyEvidenceLock(mission);
    assert.equal(r.present, true, "a lock file that exists is a seal to answer for, valid or not");
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0].problem, /not valid JSON/);
    // The opposite direction: with no lock file there is genuinely no seal, and silence is right.
    rmSync(join(mission, EVIDENCE_LOCK));
    const none = verifyEvidenceLock(mission);
    assert.equal(none.present, false);
    assert.deepEqual(none.violations, []);
  } finally { cleanup(root); }
});
