// Three silent decisions of the evidence layer: where a pointer STOPS, what BYTES a seal hashes,
// and what SHAPE a lock key may take. None of them is visible in the output when it goes wrong —
// each one simply makes the gate look at less than the operator believes it looks at.
//
// Found by the full mutation pass of 2026-08-05 and re-measured against the suite of 2026-08-08
// (346 tests): the four mutants below survived the whole net — the unit suite, the self-gate
// `check --strict`, the OSCAL validation and the smoke test. Each was then applied to dist/ and the
// verdict read on a real mission (`init --yes --example`, green at exit 0 before the mutation):
//
//   · `splitSegments`, `if (ch === quote)` → `false` (the quote never closes). A cell reading
//     `file:triage.ts#"Pure triage domain";file:deleted.ts` loses its SECOND pointer entirely: the
//     deleted file is cited, the row still reads as typed, and nothing opens it.
//     Measured: `check --strict` 1 → 0. A false GREEN.
//   · `sha256`, `if (buf.includes(0))` → `false` (never treat a file as binary). Every sealed file
//     is lossily decoded as UTF-8 before hashing, so two DIFFERENT binaries collide on one hash.
//     Measured on a sealed mission whose binary evidence was then tampered with: 1 → 0. A false
//     GREEN, and the one failure mode a seal must not have.
//   · `sha256`, `if (buf.includes(0))` → `true` (always hash raw bytes). A checkout that rewrites
//     line endings — git doing its documented job — breaks a seal over evidence nobody touched.
//     Measured: 0 → 1. A false RED, which is how a gate gets switched off.
//   · `verifyEvidenceLock`, `isAbsolute(rel)` → `false`. An ABSOLUTE lock key naming a file inside
//     the project is consumed instead of refused. `check --freeze` never writes one, so an absolute
//     key means the lock was hand-edited; and it is green here, red on any other machine.
//     Measured: 1 → 0.
//
// Nothing else catches any of the four: `evidenceReport` never re-reads the lock, and the lock is
// read by nothing but `check.ts` (grep). That seal violations reach the exit code is pinned by
// verdict.test.js ("a tampered seal reddens the gate"); this file pins what they are computed FROM.
//
// Every guard below is exercised in both directions: a refusal paired with the acceptance that
// forbids a constant from satisfying it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  parseEvidencePointers, evidenceReport,
  renderEvidenceLock, verifyEvidenceLock, EVIDENCE_LOCK,
} from "../../dist/lib/evidence.js";

const manifest = (rows) =>
  "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n") + "\n";

// ── Where a pointer segment stops ───────────────────────────────────────────────────────────────
// `splitSegments` splits an Evidence cell on `;` while honouring quotes. The quote state has two
// transitions and only the closing one is in question here: if it never fires, everything after the
// first quoted symbol is swallowed into one segment and the pointers behind it are never parsed.

test("a pointer written after a quoted symbol is still parsed — the quote closes", () => {
  // The dangerous direction is losing the second pointer: the row keeps reading as typed evidence,
  // so no other check reports anything, and a file that is cited is never opened.
  const p = parseEvidencePointers('file:src/a.ts#"the guard fails closed";file:src/b.ts');
  assert.equal(p.length, 2, "two pointers were written, two must be parsed");
  assert.deepEqual(p.map((x) => x.path), ["src/a.ts", "src/b.ts"]);
  assert.equal(p[0].symbol, "the guard fails closed", "and the quoted symbol keeps its words");
});

test("a `;` INSIDE a quoted symbol does not split the cell — the quote opens", () => {
  // The mirror, and it has to be here: a splitter that closes its quote at the first character it
  // reads passes the case above and breaks this one. `evidence.split(";")` ran before anything knew
  // about quotes and turned `#"the guard fails closed; nothing passes"` into the symbol `"the` —
  // present in nearly every file, so GREEN. Both transitions are pinned, or neither is.
  const p = parseEvidencePointers('file:src/a.ts#"the guard fails closed; nothing passes"');
  assert.equal(p.length, 1, "one pointer was written, one must be parsed");
  assert.equal(p[0].symbol, "the guard fails closed; nothing passes");
});

test("the gate opens the pointer written after a quoted symbol, and says so when it is gone", () => {
  // The verdict-shaped statement of the same decision: `evidenceReport` is what `check --strict`
  // adds to its gap count. One row, one quoted symbol that really is in the file, and one pointer
  // at a file that does not exist — so a violation here can only come from the second pointer.
  const root = mkdtempSync(join(tmpdir(), "rw-segments-"));
  const mission = join(root, "runward");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "src", "a.ts"), "// the guard fails closed\nexport const guard = 1;\n");
  try {
    writeFileSync(join(mission, "floor.md"),
      manifest([["r1", "applied", 'file:src/a.ts#"the guard fails closed";file:src/deleted.ts']]));
    const v = evidenceReport(mission, "floor.md", {});
    assert.equal(v.length, 1, `the second pointer must be checked, got ${JSON.stringify(v)}`);
    assert.match(v[0].problem, /does not resolve/);
    assert.match(v[0].problem, /deleted\.ts/, "and it must name the pointer that failed");

    // The acceptance half: the same row with a second pointer that DOES resolve is silent. Without
    // it, a report that refuses every quoted cell would satisfy the assertions above.
    writeFileSync(join(root, "src", "b.ts"), "export const other = 2;\n");
    writeFileSync(join(mission, "floor.md"),
      manifest([["r1", "applied", 'file:src/a.ts#"the guard fails closed";file:src/b.ts']]));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), [],
      "two pointers that both resolve are two pointers the gate is happy with");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── What bytes a seal hashes ────────────────────────────────────────────────────────────────────
// `sha256` chooses between the raw bytes and a line-ending-normalised UTF-8 decode, and the NUL
// probe is the whole choice. Both directions of the probe are a real failure: raw-always breaks a
// seal on a Windows checkout, decode-always makes two different binaries hash the same.

/** A mission with one piece of evidence and the lock a real `check --freeze` would write for it. */
function sealed(contents) {
  const root = mkdtempSync(join(tmpdir(), "rw-seal-bytes-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "a.dat"), contents);
  writeFileSync(join(mission, "floor.md"), manifest([["r1", "applied", "file:a.dat"]]));
  writeFileSync(join(mission, EVIDENCE_LOCK), renderEvidenceLock(mission, "2026-08-08"));
  return { root, mission, file: join(root, "a.dat") };
}

test("a sealed text file re-written with CRLF is not drift — git is not tampering", () => {
  // The dangerous direction: reporting drift on evidence nobody touched. A seal that reddens
  // because a checkout normalised line endings is a seal people re-run with `--freeze` without
  // reading, which is exactly the habit the seal exists to prevent.
  const s = sealed("line one\nline two\n");
  try {
    writeFileSync(s.file, "line one\r\nline two\r\n");
    assert.deepEqual(verifyEvidenceLock(s.mission).violations, [],
      "same text, different line endings — the seal holds");
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test("a sealed text file whose words changed IS drift, line endings or not", () => {
  // The mirror of the case above: normalising line endings must not become normalising content. A
  // hash that answered "intact" to everything would pass the previous test on its own.
  const s = sealed("line one\nline two\n");
  try {
    writeFileSync(s.file, "line one\r\nline three\r\n");
    const v = verifyEvidenceLock(s.mission).violations;
    assert.equal(v.length, 1, "one changed file, one violation");
    assert.match(v[0].problem, /sealed evidence changed/);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

// Two byte strings that differ, and that a UTF-8 decode flattens onto the SAME string: 0xC0 and
// 0xC1 are both invalid starts and become U+FFFD. Asserted here rather than assumed, because the
// whole point of the next test is that hashing the decode instead of the bytes loses the
// difference — if the two ever stopped colliding, the test would go green while guarding nothing.
const BIN_SEALED = Buffer.from([0x00, 0xc0, 0x00]);
const BIN_TAMPERED = Buffer.from([0x00, 0xc1, 0x00]);
assert.notDeepEqual(BIN_SEALED, BIN_TAMPERED, "the two binaries must really differ");
assert.equal(BIN_SEALED.toString("utf8"), BIN_TAMPERED.toString("utf8"),
  "and they must decode to the same UTF-8 string, or this pair proves nothing");

test("a sealed binary that was tampered with is drift, even when its UTF-8 decode is unchanged", () => {
  // THE false green. A seal that hashes a lossy decode instead of the bytes cannot tell these two
  // files apart: every invalid byte becomes the same replacement character, so an attacker (or a
  // corrupted download) edits sealed evidence and the gate still reports `✓ seal intact`.
  const s = sealed(BIN_SEALED);
  try {
    writeFileSync(s.file, BIN_TAMPERED);
    const v = verifyEvidenceLock(s.mission).violations;
    assert.equal(v.length, 1, "the bytes changed — the seal must say so");
    assert.match(v[0].problem, /sealed evidence changed/);
    assert.match(v[0].problem, /a\.dat/);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test("an untouched binary stays sealed — hashing the bytes is not hashing at random", () => {
  // The acceptance half. Without it, "every binary is drift" satisfies the test above, and the
  // seal becomes unusable for any project whose evidence includes an image or a fixture.
  const s = sealed(BIN_SEALED);
  try {
    assert.deepEqual(verifyEvidenceLock(s.mission).violations, [],
      "nothing moved, nothing to report");
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

// ── What shape a lock key may take ──────────────────────────────────────────────────────────────
// A lock entry must be a project-relative path. The relative half of that rule (a `../` escape) is
// pinned by evidence.test.js; the absolute half is pinned here, and it is the half a containment
// test on the RESOLVED path cannot see, because an absolute key naming a file inside the project
// resolves inside the project.

test("an absolute lock key is refused even when it names the sealed file itself, with its real hash", () => {
  // The dangerous direction: consuming it. `check --freeze` never writes an absolute key, so one in
  // a lock means the file was hand-edited — and it is a key that is green on this machine and
  // "sealed evidence missing" on every other, which is the surprise that makes people stop
  // trusting the gate. The hash is the CORRECT one on purpose: if it were wrong, the entry would
  // red for the wrong reason and this test would pass without the rule it claims to pin.
  const root = mkdtempSync(join(tmpdir(), "rw-lock-key-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "a.ts"), "the evidence the gate crossed on\n");
  writeFileSync(join(mission, "floor.md"), manifest([["r1", "applied", "file:a.ts"]]));
  try {
    const lock = JSON.parse(renderEvidenceLock(mission, "2026-08-08"));
    const rel = Object.keys(lock.files).find((k) => k.endsWith("a.ts"));
    assert.ok(rel, "the writer seals the evidence under a relative key");
    assert.equal(rel, "a.ts", "and that key is project-relative, never absolute");

    // Same file, same hash, spelled absolutely. One character of difference from the accepted lock.
    const abs = resolve(root, rel);
    const forged = { ...lock, files: { ...lock.files, [abs]: lock.files[rel] } };
    delete forged.files[rel];
    writeFileSync(join(mission, EVIDENCE_LOCK), JSON.stringify(forged, null, 2) + "\n");
    const v = verifyEvidenceLock(mission).violations;
    assert.equal(v.length, 1, `an absolute key is one violation, got ${JSON.stringify(v)}`);
    assert.match(v[0].problem, /escapes the project/);
    assert.match(v[0].problem, /a\.ts/, "and the operator is told which entry to fix");

    // The acceptance half: the lock the writer actually produces, byte for byte, is silent. It
    // forbids "every key escapes", which would satisfy the assertions above on its own.
    writeFileSync(join(mission, EVIDENCE_LOCK), renderEvidenceLock(mission, "2026-08-08"));
    assert.deepEqual(verifyEvidenceLock(mission).violations, [],
      "the lock a real `check --freeze` writes verifies clean");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
