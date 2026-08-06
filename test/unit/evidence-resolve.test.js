// Where a typed pointer is allowed to point: the containment decision of `resolvePointer`.
//
// Found by the full mutation pass of 2026-08-04/05: eight mutants inside `resolvePointer`
// (src/lib/evidence.ts) survived the unit suite, the self-gate `check --strict`, the OSCAL
// validation and the end-to-end smoke. Six of them sit on one line — the repository fallback
// `if (repo && (real === repo || real.startsWith(repo + sep)))` — which nothing in test/ ever
// entered: every existing containment test runs in a bare temp directory, where no repository
// marker exists above the base, so the fallback is dead code under test and any rewriting of it
// goes unnoticed. Measured, not supposed: with `repo && (true)` in place, a mission whose Floor
// evidence reads `file:../../../../../../etc/hosts` prints "✓ Floor: 10 rule(s) accounted for",
// "20 of 23 applied rows carry a pointer the gate opened and checked (87%)" and exits 0.
//
// This is the function that answers "is this evidence in your project?" for every `applied` row.
// `evidenceReport` refuses the row when it answers null, `driftReport` calls it through
// `resolveEvidencePath`, and both feed `strictGaps` in commands/check.ts, which sets
// `process.exitCode = 1`. It is a verdict function, not a display one.
//
// Both directions are pinned on every branch. A guard that refuses everything breaks the honest
// monorepo (a green mission goes red on upgrade with no spelling that works) exactly as surely as
// a guard that accepts everything turns the seal into an arbitrary-file read oracle; a single
// direction would be satisfied by a constant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { resolveEvidencePath } from "../../dist/lib/evidence.js";

const MARKERS = [".git", "pnpm-workspace.yaml", "lerna.json", "turbo.json", "nx.json"];

/** A fixture that pins the PRIMARY containment branch is only valid while no repository marker
 *  sits above it — otherwise the fallback answers first and the test guards nothing. Assert the
 *  premise rather than assume it: this is the difference between a test and a decoration. */
function assertNoRepoMarkerAbove(dir) {
  let cur = realpathSync(dir);
  for (let i = 0; i < 24; i++) {
    for (const m of MARKERS) {
      assert.ok(!existsSync(join(cur, m)), `fixture premise broken: ${join(cur, m)} exists`);
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}

const put = (dir, rel, body) => {
  mkdirSync(join(dir, dirname(rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
};

/** A base with nothing above it: the primary branch is the only one that can answer. */
function bareBase() {
  const root = mkdtempSync(join(tmpdir(), "rw-bare-"));
  put(root, "src/guard.ts", "export const guard = 1;\n");
  assertNoRepoMarkerAbove(root);
  return root;
}

/** The monorepo shape the fallback exists for: a repository root carrying a marker, one package
 *  used as the base, and a sibling package reachable both directly and through a symlink. */
function repoFixture() {
  const repo = mkdtempSync(join(tmpdir(), "rw-repo-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  put(repo, "packages/api/src/own.ts", "export const own = 1;\n");
  put(repo, "packages/shared/index.ts", "export const shared = 1;\n");
  symlinkSync(join("..", "shared"), join(repo, "packages", "api", "shared")); // packages/api/shared -> packages/shared
  return { repo, base: join(repo, "packages", "api") };
}

// ── The primary branch: inside the base ─────────────────────────────────────────────────────────
// `real === baseAbs || real.startsWith(baseAbs + sep)`.

test("a project-relative pointer to a file inside the base resolves to its real path", () => {
  // The dangerous direction here is refusal: collapsing this branch makes every ordinary pointer
  // in a non-monorepo project stop resolving, and `check --strict` reports "does not resolve" for
  // files that are plainly there. Pinned in a base with no repository marker above it, so the
  // fallback cannot answer in its place.
  const root = bareBase();
  assert.equal(resolveEvidencePath("src/guard.ts", [root]), realpathSync(join(root, "src/guard.ts")));
  // The boundary itself is inside: `real === baseAbs` is a written branch, and dropping it is not
  // cosmetic. The caller then answers "does not resolve" for a path that resolves perfectly well
  // and is merely a directory — the operator checks the path, finds it correct, and concludes the
  // gate is broken.
  assert.equal(resolveEvidencePath(".", [root]), realpathSync(root));
  rmSync(root, { recursive: true, force: true });
});

test("a pointer that leaves a base with no repository above it does not resolve", () => {
  // The opposite direction, so no constant satisfies the pair. `..` out of the only base, with
  // nothing to fall back on, is not evidence in this project (ADR-0019).
  const root = bareBase();
  const outside = mkdtempSync(join(tmpdir(), "rw-out-"));
  writeFileSync(join(outside, "secret.txt"), "not yours\n");
  assert.equal(resolveEvidencePath(`${relative(root, outside)}/secret.txt`, [root]), null);
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

// ── The absolute-path refusal ───────────────────────────────────────────────────────────────────
// `if (isAbsolute(p)) return { abs: null, why: "absolute" }`.

test("an absolute path is never evidence, even when it points inside the base", () => {
  // The dangerous direction: dropping the guard does NOT merely change a message. An absolute path
  // that happens to land inside the base passes containment and is accepted, so `/Users/me/proj/
  // src/guard.ts` becomes a valid pointer — a pointer that only resolves on the machine that wrote
  // it, and the row is green on the author's laptop and red nowhere it is read (ADR-0019).
  const root = bareBase();
  const abs = join(root, "src/guard.ts");
  assert.ok(existsSync(abs), "fixture premise: the absolute target really exists inside the base");
  assert.equal(resolveEvidencePath(abs, [root]), null);
  // And the same path written relatively is accepted — the refusal is about the SPELLING, not
  // about the file, which is what makes the error message honest.
  assert.equal(resolveEvidencePath("src/guard.ts", [root]), realpathSync(abs));
  rmSync(root, { recursive: true, force: true });
});

// ── The repository fallback ─────────────────────────────────────────────────────────────────────
// `repo && (real === repo || real.startsWith(repo + sep))`. Six of the eight survivors are here.

test("a pointer that leaves the base but stays inside the enclosing repository resolves", () => {
  // The dangerous direction: refusing the ordinary workspace layout. `packages/api/shared ->
  // ../shared` is how npm/pnpm monorepos are spelled; hardening containment to the real path once
  // broke it, and a green mission went red on upgrade with no spelling that worked.
  const { repo, base } = repoFixture();
  const want = realpathSync(join(repo, "packages/shared/index.ts"));
  assert.equal(resolveEvidencePath("../shared/index.ts", [base]), want, "sibling package, direct");
  assert.equal(resolveEvidencePath("shared/index.ts", [base]), want, "sibling package, through the symlink");
  // The repository root itself is inside the repository: `real === repo` is its own branch, and
  // losing it turns a legitimate boundary hit into "does not resolve".
  assert.equal(resolveEvidencePath("../..", [base]), realpathSync(repo));
  // The base's own files still take the primary branch, untouched by the fallback.
  assert.equal(resolveEvidencePath("src/own.ts", [base]), realpathSync(join(base, "src/own.ts")));
  rmSync(repo, { recursive: true, force: true });
});

test("a pointer that leaves the REPOSITORY does not resolve, marker above the base or not", () => {
  // The dangerous direction, and the reason this line is load-bearing: the fallback must widen
  // containment to the repository, never abolish it. Turning it into "a repository exists above,
  // therefore anything goes" accepts /etc/hosts and the neighbour's project — the seal then reads
  // and hashes them, which is the arbitrary-file read oracle the containment check exists to
  // prevent. It stays a refusal even though `repoRootAbove` finds a marker here.
  const { repo, base } = repoFixture();
  const outside = mkdtempSync(join(tmpdir(), "rw-out-"));
  writeFileSync(join(outside, "secret.txt"), "a file that exists, and is not yours\n");
  assert.ok(existsSync(join(repo, ".git")), "fixture premise: a repository marker sits above the base");
  assert.equal(resolveEvidencePath(`${relative(base, outside)}/secret.txt`, [base]), null,
    "an existing file outside the repository is not evidence inside it");
  assert.equal(resolveEvidencePath("../../../../../../etc/hosts", [base]), null,
    "and neither is one that exists on every machine");
  rmSync(repo, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

test("a directory whose name merely starts with the repository's name is outside it", () => {
  // The separator in `repo + sep` is what stops `/tmp/rw-repo-ab-evil` counting as under
  // `/tmp/rw-repo-ab`. The base's own prefix test is pinned in evidence.test.js; the repository
  // one was not pinned anywhere, and it guards the same class of near-miss.
  const { repo, base } = repoFixture();
  const evil = `${repo}-evil`;
  mkdirSync(join(evil, "packages"), { recursive: true });
  writeFileSync(join(evil, "packages/planted.ts"), "export const planted = 1;\n");
  assert.equal(resolveEvidencePath(`${relative(base, evil)}/packages/planted.ts`, [base]), null);
  rmSync(repo, { recursive: true, force: true });
  rmSync(evil, { recursive: true, force: true });
});

// ── The base list is walked in order, and a miss is not a refusal ───────────────────────────────

test("a base that does not hold the file is skipped, not fatal — the next one still answers", () => {
  // `resolutionBases` hands three bases; the loop must keep looking. Returning on the first miss
  // would refuse most honest pointers, and returning the first HIT unconditionally would accept
  // paths no base contains. Both directions in one fixture.
  const root = bareBase();
  const empty = mkdtempSync(join(tmpdir(), "rw-empty-"));
  assert.equal(resolveEvidencePath("src/guard.ts", [empty, root]), realpathSync(join(root, "src/guard.ts")));
  assert.equal(resolveEvidencePath("src/absent.ts", [empty, root]), null);
  rmSync(root, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
});
