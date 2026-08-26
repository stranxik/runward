// The case ladder, driven DIRECTLY, so it is pinned on every filesystem rather than on this one.
//
// WHY THIS FILE EXISTS, measured rather than supposed. Every other test of the ladder drives it
// through `evidenceReport`, and through the gate the ladder is UNREACHABLE on a case-sensitive
// filesystem: `file:src/Guard.TS` simply does not resolve there, so `resolvePointer` refuses the
// pointer for an entirely different reason and never calls `onDiskSpelling`. The tests stay green
// on a Linux runner — for a reason that has nothing to do with the code they name.
//
// The chunked CI run of 2026-08-25 (ubuntu-latest, 950 mutants over this module) shows the shape:
//
//     onDiskSpelling         36 mutants,  8 killed  —  22 %
//     spellingViaRealpath    19 mutants,  5 killed  —  26 %
//     every other function                          —  50 % to 100 %
//
// The two weakest functions in the module are exactly the two the runner cannot exercise, and the
// same mutants die on macOS. So the survivor register was not describing the code; it was
// describing the code plus the filesystem, which ADR-0046's environment-independence amendment
// (2026-08-20) exists to refuse.
//
// The functions themselves are filesystem-INDEPENDENT: they list directories and compare strings.
// `onDiskSpelling` answers the same thing on ext4 and on APFS, given the same tree. Only the
// PATH INTO them is platform-dependent. So the fix is to stop routing through the gate for this
// unit, not to invent a portable fixture for a route that has none.
//
// Capabilities are PROBED, never inferred from `process.platform`: a case-sensitive volume mounted
// on macOS and a case-insensitive one on Linux both exist, and `chmod` means nothing to root.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, readdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { onDiskSpelling, spellingViaRealpath, projectRelativeSpelling, UNCHECKABLE, SPELLING_VERIFIED } from "../../dist/lib/evidence.js";

/** Can this process be denied a directory listing? Not true as root, not true on Windows. */
function canDenyListing() {
  const probe = mkdtempSync(join(tmpdir(), "rw-ladder-perm-"));
  const dir = join(probe, "d");
  try {
    mkdirSync(dir);
    writeFileSync(join(dir, "f.txt"), "x");
    chmodSync(dir, 0o111);
    try { readdirSync(dir); return false; } catch { return true; }
  } catch { return false; } finally {
    try { chmodSync(dir, 0o755); } catch { /* never existed */ }
    rmSync(probe, { recursive: true, force: true });
  }
}
const CAN_DENY_LISTING = canDenyListing();

/** A tree, built from an explicit list of relative paths. Returns its root. */
function tree(...relatives) {
  const root = mkdtempSync(join(tmpdir(), "rw-ladder-"));
  for (const rel of relatives) {
    const parts = rel.split("/");
    const file = parts.pop();
    if (parts.length) mkdirSync(join(root, ...parts), { recursive: true });
    writeFileSync(join(root, ...parts, file), "export function assertGrounded() {}\n");
  }
  return root;
}

const NFD = "cafe" + String.fromCharCode(0x301) + ".ts";  // e + combining acute
const NFC = "caf" + String.fromCharCode(0xe9) + ".ts";     // precomposed
assert.notEqual(NFD, NFC, "this file guards nothing unless the two spellings really differ");

/** Ask the ladder about `query`, relative to a tree built from `files`. */
function ask(files, query) {
  const root = tree(...files);
  try {
    const answer = onDiskSpelling(join(root, ...query.split("/")));
    // Answers are reported relative to the root so a failure message is readable, and so the
    // assertion cannot accidentally pass on a temp-directory name.
    if (answer === null || answer === UNCHECKABLE || answer === SPELLING_VERIFIED) return answer;
    return answer.slice(root.length + 1).split(sep).join("/");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// Each row is (name, files on disk, the path asked about, the expected answer). `null` means "the
// spelling already matches"; a string means "it differs, and here is what the filesystem holds".
//
// EVERY ONE OF THESE RUNS ON EVERY FILESYSTEM. That is the point of the file: the function reads
// `readdirSync` and compares strings, so ext4 and APFS give it identical inputs here.
for (const [what, files, query, expected] of [
  // The mirror direction first. A ladder that answers "differs" for anything handed to it refuses
  // honest evidence, and a gate that cries on the safe input is the one that gets switched off.
  ["an exact spelling is VERIFIED, not merely un-refused", ["src/guard.ts"], "src/guard.ts", SPELLING_VERIFIED],
  ["an exact spelling, nested", ["src/lib/deep/guard.ts"], "src/lib/deep/guard.ts", SPELLING_VERIFIED],

  // The case rung.
  ["a file spelled in the wrong case", ["src/guard.ts"], "src/Guard.TS", "src/guard.ts"],
  ["a directory spelled in the wrong case", ["src/guard.ts"], "SRC/guard.ts", "src/guard.ts"],
  ["a nested directory in the wrong case", ["src/lib/deep/guard.ts"], "src/LIB/deep/guard.ts", "src/lib/deep/guard.ts"],
  // Wrong twice. Reporting only half of it sends the operator to fix half and meet the same red,
  // which is what the segment walk exists to avoid.
  ["a path wrong in two segments at once", ["src/lib/guard.ts"], "SRC/lib/Guard.TS", "src/lib/guard.ts"],
  // The walk must CONTINUE past a corrected segment (`cur = join(cur, hit)`), not stop at it.
  ["a corrected directory still finds the file below it", ["src/lib/guard.ts"], "SRC/lib/guard.ts", "src/lib/guard.ts"],

  // The Unicode-form rung. Lower-casing does NOT collapse NFD and NFC, so the case rung cannot
  // cover this one: the NFC comparison is the only thing standing here.
  ["a file differing only in Unicode form", [`src/${NFD}`], `src/${NFC}`, `src/${NFD}`],
  ["a directory differing only in Unicode form", [`caf${String.fromCharCode(0xe9)}/guard.ts`], `cafe${String.fromCharCode(0x301)}/guard.ts`, `caf${String.fromCharCode(0xe9)}/guard.ts`],

  // Neither rung answers: nothing on disk is case- or form-equal. `null` here means "I have no
  // spelling to offer", and the caller refuses the pointer for not resolving at all.
  ["a name that matches nothing returns null", ["src/guard.ts"], "src/absent.ts", null],
  ["a directory that matches nothing returns null", ["src/guard.ts"], "nowhere/guard.ts", null],
]) {
  test(`the ladder: ${what}`, () => {
    assert.equal(ask(files, query), expected);
  });
}

// The filesystem's fold is stronger than `toLowerCase()`, and until 2026-08-26 the ladder was not.
//
// APFS and HFS+ apply full Unicode case folding: a pointer citing `sguard.ts` as `\u017Fguard.ts`
// OPENS the file. `toLowerCase()` leaves U+017F alone and `normalize("NFC")` does not fold it, so no
// rung matched, `if (!hit) return null` answered "the spelling already matches", and
// `check --strict` returned exit 0 / clean on a mission a case-sensitive runner refuses. The same
// disease as RWD-2026-0016, one level below case.
//
// These cases run on EVERY filesystem, because the function is being asked directly: it never opens
// the cited path, it lists the parent and compares names. Whether THIS volume would also open the
// file is a separate fact, probed below.
const FOLDS = [
  ["U+017F, long s onto s", String.fromCharCode(0x17f), "s"],
  ["U+03C2, final sigma onto sigma", String.fromCharCode(0x3c2), String.fromCharCode(0x3c3)],
  ["U+03D1, theta symbol onto theta", String.fromCharCode(0x3d1), String.fromCharCode(0x3b8)],
  ["U+212A, kelvin sign onto k", String.fromCharCode(0x212a), "k"],
  ["U+00DF, eszett onto ss", String.fromCharCode(0xdf), "ss"],
];

for (const [what, typed, onDisk] of FOLDS) {
  test(`the ladder sees a fold the filesystem performs: ${what}`, () => {
    assert.equal(ask([`src/${onDisk}guard.ts`], `src/${typed}guard.ts`), `src/${onDisk}guard.ts`,
      "the filesystem would open this file; a check weaker than the filesystem's own fold is a hole " +
      "shaped exactly like the surprise it exists to prevent");
  });
}

test("the fold rung SUBSUMES the two rungs it replaced, so this only ever widened the refusal", () => {
  // The single most dangerous way to get this wrong is to trade one blind spot for another. The
  // rung that now stands, `normalize("NFC").toUpperCase().toLowerCase()`, replaced
  // `toLowerCase()` and `normalize("NFC")`; every divergence those two used to catch must still be
  // caught. Asserted over the corpus rather than argued from the Unicode tables.
  const previously = [
    ["plain case, file", "guard.ts", "Guard.TS"],
    ["plain case, directory", "src", "SRC"],
    ["all caps", "guard.ts", "GUARD.TS"],
    ["mixed", "myGuard.ts", "MyGuard.TS"],
    ["accented, case only", "caf" + String.fromCharCode(0xe9) + ".ts", "CAF" + String.fromCharCode(0xc9) + ".TS"],
    ["Unicode form only", "cafe" + String.fromCharCode(0x301) + ".ts", "caf" + String.fromCharCode(0xe9) + ".ts"],
    ["Unicode form AND case", "cafe" + String.fromCharCode(0x301) + ".ts", "CAF" + String.fromCharCode(0xc9) + ".TS"],
  ];
  for (const [what, onDisk, typed] of previously) {
    const oldWouldMatch = onDisk.toLowerCase() === typed.toLowerCase()
      || onDisk.normalize("NFC") === typed.normalize("NFC");
    if (!oldWouldMatch) continue;   // not a case the old rungs caught; nothing to preserve
    assert.equal(ask([`src/${onDisk}`], `src/${typed}`), `src/${onDisk}`,
      `${what}: the old rungs caught this and the new one must too`);
  }
});

test("the fold rung does not invent a divergence where the name is exact", () => {
  // The false-RED half of the widening. A fold that collapses too much would report a divergence
  // for a correctly spelled pointer, and a gate that refuses honest evidence gets switched off.
  for (const [, typed, onDisk] of FOLDS) {
    assert.equal(ask([`src/${onDisk}guard.ts`], `src/${onDisk}guard.ts`), SPELLING_VERIFIED,
      "the exact on-disk spelling is not a spelling problem, whatever the fold could have done");
    assert.equal(ask([`src/${typed}guard.ts`], `src/${typed}guard.ts`), SPELLING_VERIFIED,
      "and that holds for the folded form when it is what the filesystem actually holds");
  }
});

test("a verified match and a walk that broke off are DIFFERENT answers", () => {
  // They used to be the same `null`, and they are opposite facts. `resolvePointer` consults the
  // realpath fallback when the walk has no opinion, so a verified match answered `null` was being
  // overruled by a rung that compares a canonical suffix against what was written — and that rung
  // cannot tell a case divergence from a traversal through a symlink whose own name is a
  // case-variant of its target. Measured on a case-sensitive volume 2026-08-25: `probe/SRC/guard.ts`
  // with `SRC -> src` refused, naming a case-insensitive filesystem that was not one and
  // prescribing the rewrite of a path that was already correct (RWD-2026-0033).
  assert.equal(ask(["src/guard.ts"], "src/guard.ts"), SPELLING_VERIFIED,
    "every segment was listed exactly as written: that is a reading, not an absence of one");
  assert.equal(ask(["src/guard.ts"], "src/absent.ts"), null,
    "a segment that matched nothing leaves this function with no opinion, and the fallback may speak");
  assert.notEqual(SPELLING_VERIFIED, null, "the whole point is that these are distinguishable");
});

test("the ladder reports the MATCHING entry, never merely the first one", () => {
  // `entries.find(...)` with an inverted or constant-true predicate returns the first name in the
  // directory instead of the equal one, and the gate then prints a spelling that points at another
  // file entirely. Every fixture above has one candidate per directory, so all of them would pass
  // under that mutant. The decoy sorts before the real target on purpose.
  assert.equal(ask(["src/aaa-decoy.ts", "src/guard.ts"], "src/Guard.TS"), "src/guard.ts");
  assert.equal(ask(["src/aaa-decoy/x.ts", "src/lib/guard.ts"], "src/LIB/guard.ts"), "src/lib/guard.ts");
});

test("a directory the gate cannot list answers UNCHECKABLE, never null", {
  skip: CAN_DENY_LISTING ? false : "this process cannot be denied a directory listing (root, or a filesystem without POSIX modes)",
}, () => {
  // ADR-0045: where the gate cannot verify, it says so IN THE RUN. `null` is what this function
  // returns when the spelling ALREADY MATCHES, so returning it here would let one permission bit
  // silently clear the case check for everything beneath that directory (RWD-2026-0029).
  const root = tree("src/guard.ts");
  const dir = join(root, "src");
  try {
    chmodSync(dir, 0o111);   // traversable, not listable
    assert.equal(onDiskSpelling(join(root, "src", "guard.ts")), UNCHECKABLE,
      "'I could not look' must not be spelled the same way as 'I looked and it was fine'");
  } finally {
    chmodSync(dir, 0o755);   // before rmSync, or the cleanup is what throws
    rmSync(root, { recursive: true, force: true });
  }
});

test("the realpath rung answers on a divergence the walk was never given", () => {
  // `spellingViaRealpath` is reached, through the gate, only when the walk returns null — which on
  // a case-insensitive volume implies the walk already found the divergence, so the rung is dead
  // code there and no mission can drive it. Called directly it is testable anywhere.
  //
  // The state it exists for: the path resolves, and its canonical form differs from the written
  // one below the base. A symlinked directory segment produces exactly that on any filesystem.
  const root = tree("real/guard.ts");
  try {
    symlinkSync("real", join(root, "link"), "dir");
    const answer = spellingViaRealpath("link/guard.ts", root, join(root, "link", "guard.ts"));
    // Either it names the canonical spelling, or it declines — what it must never do is throw, and
    // what it must never do is claim a spelling that is not on disk.
    if (answer !== null) {
      assert.ok(answer.endsWith(`real${sep}guard.ts`),
        `the answer must be the path the filesystem holds, got: ${answer}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the realpath rung declines on an honest path", () => {
  // The false-RED half. A fallback that answers "differs" for a correctly spelled pointer refuses
  // honest evidence, and this rung runs on every pointer the walk could not settle.
  const root = tree("src/guard.ts");
  try {
    assert.equal(spellingViaRealpath("src/guard.ts", root, join(root, "src", "guard.ts")), null,
      "an exactly-spelled pointer is not a spelling problem, on any filesystem");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// A refusal whose remedy does not work is worse than a refusal that says it has none.
//
// RWD-2026-0034. When `spellingViaRealpath` is the rung that answers, the spelling comes from an
// ABSOLUTE canonical path — and that rung exists precisely for the case where the mission is
// ADDRESSED differently from how the filesystem spells it (Windows 8.3: `RUNNER~1` in the mission
// path, the long name in the canonical one). There the two are not prefixes of one another, so
// `relative()` returns a path climbing OUT of the mission, and pasting the prescribed spelling into
// the cell produced `resolves outside the project this mission audits (ADR-0019)`. The only remedy
// on offer was one the gate rejects.
//
// Pinned on the render rather than through the gate, because on POSIX this rung is unreachable
// once the walk answers: every segment of a path that resolves IS listed by its parent, so the walk
// either verifies it or names the divergence, and never hands over to the fallback. Driving the
// helper directly is what makes a Windows-only defect testable on any machine.
test("a spelling under the project is handed back as a path the operator can paste", () => {
  assert.equal(projectRelativeSpelling("/w/repo/src/guard.ts", "/w/repo"), "src/guard.ts");
  assert.equal(projectRelativeSpelling("/w/repo/a/b/c.ts", "/w/repo"), "a/b/c.ts");
});

test("a spelling that climbs OUT of the project is refused, never prescribed", () => {
  // Each of these used to be emitted as the fix to copy, and each is rejected by the gate's own
  // containment check the moment it is copied.
  assert.equal(projectRelativeSpelling("/w/CAFE/code/demo.ts", "/w/cafe"), null);
  assert.equal(projectRelativeSpelling("/elsewhere/src/guard.ts", "/w/repo"), null);
  assert.equal(projectRelativeSpelling("/w/repo-other/src/guard.ts", "/w/repo"), null);
});

test("the project root itself is not a spelling", () => {
  assert.equal(projectRelativeSpelling("/w/repo", "/w/repo"), null,
    "an empty relative path is not a path to paste into a cell");
});

test("a sentinel is never rendered as a path to copy", () => {
  // The sentinels are strings, so `relative()` splices them into a path without complaint. With the
  // identity branch defeated, the gate emitted "The file is spelled `../../../…/\u0000unchecked`"
  // into --json, --sarif and the in-toto attestation, and nothing downstream rejects a control
  // character in that field. In the shipped build the identity test runs first — which is the
  // objection, not the answer: the property held by branch ORDER, and an equivalence verdict resting
  // on branch order is one refactor away from being a false green.
  for (const sentinel of [UNCHECKABLE, SPELLING_VERIFIED]) {
    assert.equal(projectRelativeSpelling(sentinel, "/w/repo"), null,
      `${JSON.stringify(sentinel)} is a state, not a path, and must not reach an artifact`);
  }
  assert.equal(projectRelativeSpelling("", "/w/repo"), null);
  assert.equal(projectRelativeSpelling("/w/repo/src/gu\u0007ard.ts", "/w/repo"), null,
    "nor may a control character travel into a machine surface a CI parses");
});

test("every sentinel this module defines is caught by the same structural test", () => {
  // The guard is on the SHAPE — a leading U+0000 — so a sentinel added later is excluded without
  // anyone remembering to extend a list. If a future sentinel stops following that convention, this
  // is the test that says so.
  for (const [name, value] of Object.entries({ UNCHECKABLE, SPELLING_VERIFIED })) {
    assert.match(value, /^[\u0000-\u001f]/,
      `${name} must carry the prefix that makes it structurally unrenderable`);
  }
});
