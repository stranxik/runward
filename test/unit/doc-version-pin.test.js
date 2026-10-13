// Every runward version a newcomer's document cites is the version this package is.
//
// The 2026-10-13 newcomer measurement: on a machine with an older global install, a bare
// `npx runward` ran 0.28.0 without a word (`unknown option '--attest'`, `unknown command 'verify'`),
// and the README wrote every command that way. The README and the tutorial now pin the version in
// each command; a pin is only worth something if it cannot go stale, which is what this test holds:
// on a version bump it turns red until the documents move with package.json (runbook §release,
// step 3, already says to `git grep` the old version).
//
// Two checks, per document:
//   1. every `runward@X.Y.Z` is package.json's version (README, tutorial, distribution map);
//   2. no runward invocation in the README or the tutorial is left unpinned: `npx [--yes] runward`
//      and `npm install|i -g runward` must carry `@<version>`. distribution.md is out of check 2 on
//      purpose: it DESCRIBES the unpinned hooks (`npx --yes runward`), which is a statement about
//      them, not an instruction.
// A positive control on each file (a floor of pins found) keeps an empty sweep from passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

// [file, minimum pins expected, unpinned invocations forbidden]
const DOCS = [
  ["README.md", 6, true],
  ["docs/first-mission.md", 2, true],
  ["docs/distribution.md", 2, false],
];

const PIN = /runward@(\d+\.\d+\.\d+)/g;
// An invocation followed by anything but `@`: end of line, a space, a backtick, a quote.
const UNPINNED = /\bnpx\s+(?:--yes\s+|-y\s+)?runward(?!@)\b|\bnpm\s+(?:install|i)\s+(?:-g|--global)\s+runward(?!@)\b/g;

test("every runward version a newcomer document cites is package.json's version", () => {
  const offenders = [];
  for (const [rel, floor] of DOCS) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    const pins = [...text.matchAll(PIN)].map((m) => m[1]);
    assert.ok(pins.length >= floor, `${rel}: only ${pins.length} pinned runward version(s) found, expected at least ${floor} — the sweep went blind or the pins were removed`);
    for (const v of pins) if (v !== VERSION) offenders.push(`${rel}: cites runward@${v}, package.json is ${VERSION}`);
  }
  assert.deepEqual(offenders, [], "a document cites a stale runward version; move it with package.json:\n  " + offenders.join("\n  "));
});

test("the README and the tutorial invoke runward pinned, never bare", () => {
  const offenders = [];
  for (const [rel, , strict] of DOCS) {
    if (!strict) continue;
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(UNPINNED)) {
        // The README and the tutorial name the bare form once, to warn against it, and call it
        // "a bare `npx runward`": that wording is the warning, not an instruction.
        if (line.slice(0, m.index).endsWith("bare `")) continue;
        offenders.push(`${rel}:${i + 1}: \`${m[0]}\``);
      }
    });
  }
  assert.deepEqual(offenders, [], "an unpinned runward invocation runs whatever global copy is installed:\n  " + offenders.join("\n  "));
});

test("positive control: the unpinned pattern catches the forms it is meant to", () => {
  for (const bad of ["npx runward init", "npx --yes runward check", "`npx runward`", "npm install -g runward", "npm i -g runward\n"]) {
    assert.ok([...bad.matchAll(UNPINNED)].length === 1, `missed: ${bad}`);
  }
  for (const good of [`npx runward@${VERSION} init`, `npx --yes runward@${VERSION} check`, `npm install -g runward@${VERSION}`, "npx runward@<version>"]) {
    assert.equal([...good.matchAll(UNPINNED)].length, 0, `false hit: ${good}`);
  }
});

// The regulated-adoption sheet is written against an older build and says so; the one sentence that
// names the CURRENT release must move with package.json, or the sheet's own scope line goes stale
// (it read "runward 0.33.5" alone on 2026-10-13, ten minors later).
test("the regulated-adoption sheet names the current release as package.json's version", () => {
  const text = readFileSync(join(ROOT, "docs/compliance/regulated-adoption.md"), "utf8");
  const m = text.match(/the current release is (\d+\.\d+\.\d+)/);
  assert.ok(m, "the scope line names the current release");
  assert.equal(m[1], VERSION);
});
