// The spelling ladder of a typed pointer: the check that decides whether a pointer resolves only
// because THIS filesystem is forgiving, and would fail on the Linux runner where it counts.
//
// Found by the full mutation pass of 2026-08-05: `onDiskSpelling` in evidence.ts carried eight
// survivors that no net caught — the unit suite, the self-gate `check --strict`, OSCAL validation
// and the smoke test. One of them is a false GREEN. Cutting the Unicode-form rung of the ladder
// (`e.normalize("NFC") === want.normalize("NFC")` to `false`) turns `check --strict` from exit 1 to
// exit 0 on the shipped example mission whose ONLY defect is a pointer typed in NFC while the file
// on disk is spelled in NFD (measured, both directions, 2026-08-05). Nothing else catches it: not
// the drift pass, not the seal, not the conformance count. This is not defence in depth, it is the
// only line holding the promise the function was written for — no green here that turns red there.
//
// The case rung (`file:SRC/Guard.TS`) is already pinned by pointer-grammar.test.js; this file pins
// the rung underneath it, and what happens when NEITHER rung answers.
//
// The two names are built code point by code point on purpose. Written as literal accented
// characters, an editor, a git filter or a copy through any normalising tool would quietly bring
// the two spellings back to the same bytes, and every case below would pass while guarding
// nothing — a decorative test on the exact subject of Unicode normalisation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport } from "../../dist/lib/evidence.js";

const ON_DISK = "cafe" + String.fromCharCode(0x301) + ".ts";  // e + combining acute (NFD)
const TYPED = "caf" + String.fromCharCode(0xe9) + ".ts";       // precomposed (NFC)
const TYPED_UPPER = "CAF" + String.fromCharCode(0xc9) + ".TS"; // precomposed AND upper-cased
assert.notEqual(ON_DISK, TYPED, "this file guards nothing unless the two spellings really differ");

const table = (...rows) => `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;

/** A mission beside a source tree holding one file under the given spelling, and a floor manifest
 *  whose single applied row points at it under the spelling the operator typed. */
function fixture(diskName, typedPath) {
  const root = mkdtempSync(join(tmpdir(), "rw-spelling-"));
  const mission = join(root, "runward");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(root, "src", diskName), "export function assertGrounded() {}\n");
  writeFileSync(join(mission, "floor.md"), table(`| r1 | applied | file:${typedPath}#assertGrounded |`));
  return { root, mission };
}

test("a pointer spelled exactly as the filesystem spells it is accepted, accents and all", () => {
  // The mirror direction, and it has to be here: a ladder that answers "this differs" for anything
  // handed to it refuses honest evidence, and a gate that cries on the safe input is the one that
  // gets switched off. Without this case, a constant "always differs" satisfies the whole file.
  const { root, mission } = fixture(ON_DISK, `src/${ON_DISK}`);
  try {
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), [],
      "the exact on-disk spelling is not a spelling problem");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a pointer differing only in Unicode form is refused, and told the spelling to copy", () => {
  // The dangerous direction: accepting it. macOS resolves the precomposed name against a name
  // stored decomposed, so the row goes green on the author's machine and red on the Linux runner —
  // the surprise that makes people stop trusting a gate, and the reason the seal once counted the
  // same file twice under two names. Lower-casing does NOT collapse the two forms, so the case rung
  // cannot cover this one: the NFC comparison is the only thing standing here.
  const { root, mission } = fixture(ON_DISK, `src/${TYPED}`);
  try {
    const v = evidenceReport(mission, "floor.md", {});
    // On a normalisation-SENSITIVE filesystem (a Linux ext4 runner) the same pointer simply does
    // not resolve, which is also a refusal — the verdict must be red either way, never green.
    assert.equal(v.length, 1, `it must be refused, got: ${v.map((x) => x.problem).join(" | ") || "nothing"}`);
    assert.match(v[0].problem, /case-insensitive|does not resolve/);
    if (/case-insensitive/.test(v[0].problem)) {
      assert.ok(v[0].problem.includes(`src/${ON_DISK}`),
        "and it must print the form the filesystem holds, or the operator retypes and meets the same red");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a spelling that answers on no rung still returns a verdict, never a crash mid-run", () => {
  // Case and form drift at once: the filesystem still resolves the pointer, the case rung fails
  // (lower-casing does not collapse NFD and NFC) and the form rung fails (normalising does not
  // collapse the case). `entries.find` then returns undefined, and the guard that stops the walk
  // there is load-bearing: without it the walk joins a path with `undefined` and the whole `check`
  // dies with a TypeError — the output stops mid-section and `--json` stops being JSON, the failure
  // mode evidence.ts already refuses for a file it cannot read ("the gate has no verdict on a file
  // it cannot open — that is a verdict").
  //
  // This case pins the crash, deliberately NOT the answer: today the ladder reports "no difference"
  // here and the pointer goes through, which is a residual hole of its own (a pointer wrong on both
  // axes is still a local green and a Linux red). Closing that hole must not turn this test red.
  const { root, mission } = fixture(ON_DISK, `src/${TYPED_UPPER}`);
  try {
    let v;
    assert.doesNotThrow(() => { v = evidenceReport(mission, "floor.md", {}); },
      "a spelling the ladder cannot place must end in a verdict, not in a stack trace");
    assert.ok(Array.isArray(v), "and that verdict must still be a list of violations");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
