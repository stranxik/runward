// The case ladder, tested where the realpath fallback cannot answer for it.
//
// `resolvePointer` reads `onDiskSpelling(abs) ?? spellingViaRealpath(...)` (evidence.ts:325). On
// macOS `realpathSync.native` canonicalises case, so the fallback re-derives the same verdict and
// HIDES whatever the segment walk misses. That is why the existing `file:SRC/Guard.TS` case in
// pointer-grammar.test.js stayed green while the walk's own rungs were unguarded: 24 mutants across
// the two functions survived the whole net on 2026-08-21, and three of them turn `check --strict`
// from exit 1 to exit 0 on a mission whose only defect is a case divergence.
//
// Two forms escape the mask, both found by instructing those survivors:
//   - a redundant `./` segment, which the walk sees and realpath normalises away;
//   - a directory that is traversable but not listable, where `readdirSync` throws and the walk has
//     to answer null without taking the process with it.
//
// The mirror direction is here too, and the file is worthless without it: a ladder that answers
// "this differs" for anything handed to it refuses honest evidence, and a gate that cries on the
// safe input is the one that gets switched off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceReport } from "../../dist/lib/evidence.js";

const table = (...rows) =>
  `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n${rows.join("\n")}\n`;

/** A mission beside a small source tree: src/guard.ts and src/lib/deep/guard.ts. */
function fixture(...pointers) {
  const root = mkdtempSync(join(tmpdir(), "rw-unmasked-"));
  const mission = join(root, "runward");
  mkdirSync(join(root, "src", "lib", "deep"), { recursive: true });
  mkdirSync(mission, { recursive: true });
  const body = "export function assertGrounded() {}\n";
  writeFileSync(join(root, "src", "guard.ts"), body);
  writeFileSync(join(root, "src", "lib", "deep", "guard.ts"), body);
  writeFileSync(join(mission, "floor.md"), table(
    ...pointers.map((p, i) => `| r${i + 1} | applied | ${p} |`),
  ));
  return { root, mission };
}

const spellingProblems = (mission) =>
  evidenceReport(mission, "floor.md", {}).filter((v) => /case-insensitive|spell/i.test(v.problem));

for (const [what, pointer] of [
  ["the file component", "file:./src/Guard.TS#assertGrounded"],
  ["a directory component", "file:./SRC/guard.ts#assertGrounded"],
  ["a nested directory component", "file:./src/LIB/deep/guard.ts#assertGrounded"],
]) {
  test(`a pointer mis-spelling ${what} is refused, even behind a redundant "./"`, () => {
    // The `./` is what makes this test worth having: without it, realpath answers and the rung
    // being tested is never consulted. With it, the walk is on its own.
    const { root, mission } = fixture(pointer);
    try {
      assert.equal(spellingProblems(mission).length, 1,
        `${pointer} resolves only because this filesystem is case-insensitive; a Linux runner ` +
        "would not find it, and the gate has to say so here rather than there");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("the same pointers spelled exactly are accepted, in every form", () => {
  // The false-RED detector. A ladder that always answers "differs" satisfies every case above.
  const { root, mission } = fixture(
    "file:src/guard.ts#assertGrounded",
    "file:./src/guard.ts#assertGrounded",
    "file:src/lib/deep/guard.ts#assertGrounded",
    "file:./src/lib/deep/guard.ts#assertGrounded",
  );
  try {
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), [],
      "four honest pointers, none of them a spelling problem");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a directory the gate cannot list yields a verdict, never a crash", () => {
  // `readdirSync` throws on a directory that is traversable (execute) but not listable (read). The
  // walk answers null and the gate carries on. Emptying that catch was measured on 2026-08-21 to
  // take `check --strict --json` from 4783 bytes of valid JSON to ZERO, on
  // `Cannot read properties of undefined (reading 'includes')` — and the exit code stayed 1 by
  // coincidence, so a net that reads only the exit code cannot see it. The machine contract of
  // ADR-0030 simply disappears.
  const { root, mission } = fixture("file:src/guard.ts#assertGrounded");
  const dir = join(root, "src");
  try {
    chmodSync(dir, 0o111);   // --x--x--x: traversable, not listable
    const problems = evidenceReport(mission, "floor.md", {});
    assert.ok(Array.isArray(problems),
      "the report must still be a report: an unreadable directory is a finding, not an exception");
  } finally {
    chmodSync(dir, 0o755);   // before rmSync, or the cleanup is the thing that throws
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unlistable directory does not silently clear a mis-spelled pointer", () => {
  // The dangerous half of the case above. When the walk cannot list, the answer must not become
  // "no spelling problem" — that is a false green bought with a permission bit.
  const { root, mission } = fixture("file:./src/Guard.TS#assertGrounded");
  const dir = join(root, "src");
  try {
    chmodSync(dir, 0o111);
    const problems = evidenceReport(mission, "floor.md", {});
    assert.ok(problems.length > 0,
      "a pointer the gate cannot check is not a pointer the gate has checked");
  } finally {
    chmodSync(dir, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});
