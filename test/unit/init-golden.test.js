// Golden test: `init` is byte-fixed — its transcript AND every file it writes.
//
// This is the lock the 2026-09-02 investigation asked for before anything else: templates/ carried
// zero guards (the mission templates had not moved since 2026-07-16, the workflows since 07-31, and
// nothing would have said so if they had), while the proof layer holds byte fixtures that killed 191
// renderer mutants in one campaign (readiness-golden.test.js, whose shape this file copies). From
// this test on, every edit to what `init` writes — a template, an adapter, AGENTS.md, a skill — is a
// DELIBERATE golden diff reviewed in its PR, never a silent drift. A substring assertion cannot give
// that: the fixture is the one net a substring cannot satisfy.
//
// Two fixtures:
//   init-transcript.txt — the console output of `init --yes --tools claude`, byte for byte.
//   init-tree.txt       — one line per written file, `sha256  path`, sorted by path.
//
// Normalisations, each because a real source of drift was measured before recording:
//   - the package version (from package.json) becomes <VERSION> in the transcript and in file
//     contents before hashing, so a release bump does not masquerade as a template change;
//   - the temp mission path becomes <ROOT> in the transcript;
//   - .DS_Store is excluded from the tree (Finder writes it unasked on APFS).
// The env is frozen the way every golden in this suite freezes it: NO_COLOR, RUNWARD_YES,
// RUNWARD_NOW — and the test asserts determinism itself by scaffolding TWICE in two directories
// before comparing to the fixture, so "the fixture matches" can never mean "matched by luck".
//
// Regenerate deliberately with UPDATE_GOLDEN=1 node --test test/unit/init-golden.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GOLDEN_DIR = join(ROOT, "test", "fixtures", "golden");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-01-01" };

/** Scaffold in a fresh directory; return the normalised transcript and the normalised tree manifest. */
function scaffold(parent) {
  const missionRoot = join(parent, "golden-init");
  mkdirSync(missionRoot);
  const out = execFileSync("node", [CLI, "--yes", "init", "--tools", "claude"], {
    cwd: missionRoot, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"],
  });
  // Windows prints the written paths with backslashes; the fixture is recorded with forward
  // slashes and the SAME bytes must come back on every OS the CI runs (the Windows leg is the one
  // that caught this). The transcript carries no legitimate backslash on any platform, so a global
  // replacement is exact, not a heuristic.
  const transcript = out.split(missionRoot).join("<ROOT>").split(VERSION).join("<VERSION>").replace(/\\/g, "/");

  const files = [];
  const walk = (dir, prefix) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === ".DS_Store") continue;
      const abs = join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, rel);
      else {
        const content = readFileSync(abs, "utf8").split(VERSION).join("<VERSION>");
        files.push(`${createHash("sha256").update(content).digest("hex")}  ${rel}`);
      }
    }
  };
  walk(missionRoot, "");
  return { transcript, tree: files.sort().join("\n") + "\n" };
}

test("golden: init --yes --tools claude is byte-fixed — transcript and written tree", () => {
  const parent = mkdtempSync(join(tmpdir(), "runward-igold-"));
  try {
    const dirA = join(parent, "a"); mkdirSync(dirA);
    const dirB = join(parent, "b"); mkdirSync(dirB);
    const a = scaffold(dirA);
    const b = scaffold(dirB);
    // Determinism first: two scaffolds in two directories must agree with EACH OTHER before either
    // is compared to the fixture. A golden recorded over nondeterministic output flakes forever,
    // and the flake reads as "someone edited a template" — the exact confusion this test exists
    // to remove.
    assert.equal(a.transcript, b.transcript, "two inits disagree on the transcript: init is nondeterministic, fix that before touching the fixture");
    assert.equal(a.tree, b.tree, "two inits disagree on the written tree: init is nondeterministic, fix that before touching the fixture");

    const tFixture = join(GOLDEN_DIR, "init-transcript.txt");
    const treeFixture = join(GOLDEN_DIR, "init-tree.txt");
    if (process.env.UPDATE_GOLDEN === "1") {
      writeFileSync(tFixture, a.transcript);
      writeFileSync(treeFixture, a.tree);
    } else {
      assert.equal(a.transcript, readFileSync(tFixture, "utf8"),
        "the init transcript drifted from the golden fixture — inspect the diff, then regenerate " +
        "deliberately with UPDATE_GOLDEN=1 if the change is intended");
      assert.equal(a.tree, readFileSync(treeFixture, "utf8"),
        "the tree init writes drifted from the golden fixture (a template, adapter, skill or charter " +
        "changed) — inspect the diff, then regenerate deliberately with UPDATE_GOLDEN=1 if intended");
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
