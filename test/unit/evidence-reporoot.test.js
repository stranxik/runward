// The workspace-symlink allowance in the evidence layer: `repoRootAbove()`, the climb that decides
// whether a pointer whose REAL path leaves the resolution base is still "evidence in your project".
//
// Found by the full mutation pass of 2026-08-04: eight mutants inside `repoRootAbove` survived the
// unit suite, the self-gate (`check --strict`), the OSCAL validation and the smoke test. Nothing in
// test/ ever built a symlink under an evidence base, so the whole function was pinned by nothing:
// its loop could stop before it started (`i < 24` -> `false`, `i >= 24`), its marker probe could
// answer always-yes or always-no, and its root guard could break on the first turn — all green.
//
// The direction that matters here is the PERMISSIVE one, and it runs backwards from the usual
// worry. Every one of those mutants makes the climb find nothing, so the gate REFUSES a pointer it
// should open: `packages/api/src/shared -> ../../shared` is an ordinary pnpm/turbo workspace, and
// the comment above this function records that hardening containment to the real path once turned a
// green mission red on upgrade "with no spelling that worked". That is a verdict — `check --strict`
// exits 1 — and no second mechanism catches it: verified 2026-08-05 by mutating dist/ and watching
// a mission that resolves go to "does not resolve" while every other layer stayed silent. The
// reason the mutants survived is simply that runward's own mission holds no symlinked evidence.
//
// So each case below pins one direction of that decision, and the pair forbids a constant:
// inside the enclosing repository must RESOLVE, outside it must REFUSE.
//
// What this file deliberately does NOT pin, so the next reader does not assume it does:
//   · the exact loop bound. `i < 24` -> `i <= 24` is reachable — measured: a marker sitting exactly
//     24 directories above the base is found by the mutant and missed by the original — but killing
//     it means asserting the number 24 itself, which decides nothing (both bounds are equally
//     correct, and `findMissionRoot` had the twin cap RAISED for causing false negatives). A
//     project 24 levels below its repository root is not a layout; the mutant widens the climb by
//     one level, never past "inside some enclosing repository".
//   · `parent === dir` -> `false`. That one is equivalent: once the climb reaches the filesystem
//     root, `dirname(dir) === dir`, so every further turn probes the same five markers in the same
//     directory for the same answer, and the counter still ends the loop. The `break` saves turns,
//     it does not change what is returned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveEvidencePath, resolutionBases, evidenceReport } from "../../dist/lib/evidence.js";

const manifest = (rows) =>
  "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n") + "\n";

/** A monorepo: marker at the top, the mission two levels down, the shared package a sibling of the
 *  package that cites it. The marker sits STRICTLY ABOVE the resolution base on purpose — with it
 *  on the base itself, a climb that never leaves its starting directory would still find it, and
 *  the test would guard nothing. `realpathSync` because macOS hands out /var/... for /private/var. */
function workspace(marker) {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "rw-repo-")));
  const api = join(repo, "packages", "api");
  const mission = join(api, "runward");
  mkdirSync(join(mission, "adr"), { recursive: true });
  mkdirSync(join(api, "src"), { recursive: true });
  mkdirSync(join(repo, "shared"), { recursive: true });
  writeFileSync(join(repo, "shared", "contract.ts"), "export function assertGrounded() { return true; }\n");
  if (marker) writeFileSync(join(repo, marker), marker === ".git" ? "gitdir: elsewhere\n" : "packages:\n  - 'packages/*'\n");
  // The pattern the allowance exists for. Skip rather than fail where symlinks are not permitted.
  try { symlinkSync(join("..", "..", "..", "shared"), join(api, "src", "shared")); }
  catch { rmSync(repo, { recursive: true, force: true }); return null; }
  return { repo, api, mission, bases: resolutionBases(mission, "floor.md") };
}

test("a symlink that leaves the base but stays inside the enclosing repository still resolves", () => {
  // THE decision. The dangerous direction is refusal: this is the shape of every pnpm/turbo
  // workspace, and refusing it prints "does not resolve" for a file that exists, is readable and
  // sits in the same repository — the operator checks the path, finds it correct, and concludes
  // the gate is broken. Killed here: the climb stopping before it starts, the marker probe stuck
  // on either constant, and the root guard breaking on the first turn.
  const w = workspace(".git");
  if (!w) return;
  try {
    assert.equal(resolveEvidencePath("src/shared/contract.ts", w.bases), join(w.repo, "shared", "contract.ts"),
      "the pointer resolves to the real file, one directory above the base and inside the repository");
  } finally { rmSync(w.repo, { recursive: true, force: true }); }
});

test("the repository is recognised by a workspace marker too, not only by .git", () => {
  // Same decision, second marker: a pnpm workspace with no .git at its root (a vendored checkout,
  // a submodule) must not lose its evidence. A probe wired to a single name would pass the test
  // above and fail here.
  const w = workspace("pnpm-workspace.yaml");
  if (!w) return;
  try {
    assert.equal(resolveEvidencePath("src/shared/contract.ts", w.bases), join(w.repo, "shared", "contract.ts"));
  } finally { rmSync(w.repo, { recursive: true, force: true }); }
});

test("the same layout with no repository marker anywhere above it is refused", () => {
  // The opposite direction, and the reason the climb tests EXISTENCE instead of assuming a root:
  // without a marker there is no enclosing repository to be inside of, so the escape is just an
  // escape. Forbids answering with the top of the world, or with a fixed number of levels up.
  const w = workspace(null);
  if (!w) return;
  try {
    assert.equal(resolveEvidencePath("src/shared/contract.ts", w.bases), null,
      "no marker, no repository — a symlink out of the base resolves to nothing");
  } finally { rmSync(w.repo, { recursive: true, force: true }); }
});

test("a symlink that leaves the repository is refused even though the repository is found", () => {
  // The containment half of the same line: finding a repository root must not turn into opening
  // the machine. The climb succeeds here (.git is at the top) and the pointer must STILL be
  // refused, because its target lives outside that root. Without this case, "always inside" would
  // satisfy every other test in this file.
  const w = workspace(".git");
  if (!w) return;
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "rw-out-")));
  try {
    writeFileSync(join(outside, "secret.ts"), "a secret that lives outside the repository\n");
    symlinkSync(join(outside, "secret.ts"), join(w.api, "src", "escape.ts"));
    assert.equal(resolveEvidencePath("src/escape.ts", w.bases), null,
      "a symlink whose target leaves the repository is not evidence in the project");
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(w.repo, { recursive: true, force: true });
  }
});

test("the gate reports the escaping pointer and stays silent on the workspace one", () => {
  // The verdict-shaped statement of the pair: `evidenceReport` is what `check --strict` adds to its
  // gap count, so this is where the climb reaches the exit code. One row must produce a violation
  // and the other must produce none — a report that refuses both is as wrong as one that opens
  // both, and only the two assertions together say so.
  const w = workspace(".git");
  if (!w) return;
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "rw-out-")));
  try {
    writeFileSync(join(outside, "secret.ts"), "a secret that lives outside the repository\n");
    symlinkSync(join(outside, "secret.ts"), join(w.api, "src", "escape.ts"));
    writeFileSync(join(w.mission, "floor.md"), manifest([
      ["r-workspace", "applied", "file:src/shared/contract.ts#assertGrounded"],
      ["r-escape", "applied", "file:src/escape.ts"],
    ]));
    const v = evidenceReport(w.mission, "floor.md", {});
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.equal(by("r-workspace"), "", "a workspace symlink inside the repository is opened and checked, not refused");
    assert.match(by("r-escape"), /does not resolve/, "and the one that leaves the repository is refused by name");
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(w.repo, { recursive: true, force: true });
  }
});
