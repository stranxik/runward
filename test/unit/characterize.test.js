// Unit tests for `runward characterize` — the determinism moat (ADR-0014) and the
// resume-existing extensions: monorepos + ordering (ADR-0034), pinned versions (ADR-0035),
// churn hotspots (ADR-0036), infra/config (ADR-0037), cross-language mining + idempotence (ADR-0038).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInventory, renderCharacterization, mineDrafts, renderDraft } from "../../dist/lib/characterize.js";

/** Build a throwaway git repo shaped like a small monorepo, return its path. */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "rw-char-"));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_AUTHOR_NAME: "A", GIT_AUTHOR_EMAIL: "a@x", GIT_COMMITTER_NAME: "A", GIT_COMMITTER_EMAIL: "a@x", GIT_AUTHOR_DATE: "2020-01-01T00:00:00", GIT_COMMITTER_DATE: "2020-01-01T00:00:00" } });

  // Root: a Node workspace with a lockfile and a family dependency, plus a framework config + IaC.
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "mono", workspaces: ["packages/*"], dependencies: { express: "^4.18.0", "@prisma/client": "^5.0.0" }, devDependencies: { typescript: "^5" } }));
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ name: "mono", lockfileVersion: 3, packages: { "": {}, "node_modules/express": { version: "4.18.2" }, "node_modules/@prisma/client": { version: "5.4.1" } } }));
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
  writeFileSync(join(root, "tsconfig.json"), "{}");
  writeFileSync(join(root, "main.tf"), 'resource "null_resource" "x" {}\n');
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(join(root, ".github", "workflows", "ci.yml"), "on: push\n");
  writeFileSync(join(root, ".github", "workflows", "release.yml"), "on: tag\n");
  // A nested sub-package (the monorepo shape).
  mkdirSync(join(root, "packages", "api"), { recursive: true });
  writeFileSync(join(root, "packages", "api", "package.json"), JSON.stringify({ name: "api", dependencies: { fastify: "^4" } }));
  // A Python sub-package (cross-language).
  mkdirSync(join(root, "packages", "worker"), { recursive: true });
  writeFileSync(join(root, "packages", "worker", "requirements.txt"), "celery==5.3\nredis>=4\n");

  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "init");
  // A second commit that churns one file, by a second author (bus-factor > 1).
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "mono", workspaces: ["packages/*"], dependencies: { express: "^4.18.0", "@prisma/client": "^5.0.0" }, devDependencies: { typescript: "^5", eslint: "^9" } }));
  execFileSync("git", ["-C", root, "commit", "-aqm", "churn"], { stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_AUTHOR_NAME: "B", GIT_AUTHOR_EMAIL: "b@x", GIT_COMMITTER_NAME: "B", GIT_COMMITTER_EMAIL: "b@x", GIT_AUTHOR_DATE: "2020-02-01T00:00:00", GIT_COMMITTER_DATE: "2020-02-01T00:00:00" } });
  return root;
}

test("characterize is byte-for-byte deterministic on the same commit (ADR-0014 moat)", () => {
  const root = makeFixture();
  try {
    const a = renderCharacterization(buildInventory(root), "2026-07-20");
    const b = renderCharacterization(buildInventory(root), "2026-07-20");
    assert.equal(a, b, "two runs on the same commit must produce identical output");
    // And the mining pass is deterministic too.
    const ma = mineDrafts(root, buildInventory(root)).map((c) => c.slug + "|" + c.evidence.join(","));
    const mb = mineDrafts(root, buildInventory(root)).map((c) => c.slug + "|" + c.evidence.join(","));
    assert.deepEqual(ma, mb);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("monorepo: nested manifests and workspace markers are seen and sorted (ADR-0034)", () => {
  const root = makeFixture();
  try {
    const inv = buildInventory(root);
    const paths = inv.subPackages.map((s) => s.path);
    assert.ok(paths.includes(join("packages", "api", "package.json")), "nested Node manifest discovered");
    assert.ok(paths.includes(join("packages", "worker", "requirements.txt")), "nested Python manifest discovered");
    assert.deepEqual(paths, [...paths].sort(), "sub-packages are sorted (deterministic)");
    assert.ok(inv.workspaceMarkers.includes("pnpm-workspace.yaml"));
    assert.ok(inv.workspaceMarkers.includes("package.json (workspaces field)"));
    // CI list is sorted.
    assert.deepEqual(inv.ci, [...inv.ci].sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("pinned versions are read from the lockfile, offline (ADR-0035)", () => {
  const root = makeFixture();
  try {
    const node = buildInventory(root).ecosystems.find((e) => e.name.startsWith("Node"));
    assert.ok(node.pinnedVersions, "pinned versions extracted");
    assert.ok(node.pinnedVersions.sample.includes("express@4.18.2"), "resolved express version surfaced");
    assert.ok(node.pinnedVersions.sample.includes("@prisma/client@5.4.1"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("git churn hotspots carry raw counts and bus-factor (ADR-0036)", () => {
  const root = makeFixture();
  try {
    const git = buildInventory(root).git;
    assert.ok(git && git.hotspots.length > 0, "hotspots present");
    const pkg = git.hotspots.find((h) => h.path === "package.json");
    assert.ok(pkg, "the churned file is a hotspot");
    assert.ok(pkg.changes >= 2, "counts commits touching it");
    assert.equal(pkg.authors, 2, "bus-factor counts the two distinct authors");
    // Deterministic order: count desc then path asc.
    for (let i = 1; i < git.hotspots.length; i++) {
      const prev = git.hotspots[i - 1], cur = git.hotspots[i];
      assert.ok(prev.changes > cur.changes || (prev.changes === cur.changes && prev.path <= cur.path));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("infra and framework/DB config are detected by presence (ADR-0037)", () => {
  const root = makeFixture();
  try {
    const inv = buildInventory(root);
    assert.ok(inv.infra.some((f) => /Terraform/.test(f)), "terraform file detected");
    assert.ok(inv.frameworkConfig.includes("tsconfig.json"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--mine groups by family, mines cross-language, and never resurrects a ratified DRAFT (ADR-0038)", () => {
  const root = makeFixture();
  try {
    const inv = buildInventory(root);
    const cands = mineDrafts(root, inv);
    const slugs = cands.map((c) => c.slug);
    // One DRAFT per family, not per dep.
    assert.ok(slugs.includes("deps-web-framework-ui"), "web-framework family candidate (express)");
    assert.ok(slugs.includes("deps-data-store-orm"), "data-store family candidate (@prisma/client)");
    assert.ok(slugs.filter((s) => s.startsWith("deps-")).length === new Set(slugs.filter((s) => s.startsWith("deps-"))).size, "no duplicate family DRAFTs");
    // Honest dating (ADR-0038): **Date** is the MINING date; the git first-seen is quoted in
    // Evidence as a labeled trace, never promoted to Date (fact vs hypothesis boundary).
    const stack = cands.find((c) => c.slug.startsWith("stack-"));
    const draftMd = renderDraft(stack, "2026-07-20");
    assert.ok(/\*\*Date\*\*: 2026-07-20/.test(draftMd), "DRAFT dated by the mining date");
    assert.ok(!/\*\*Date\*\*: 2020-01-01/.test(draftMd), "the git first-seen is never the Date");
    assert.ok(stack.evidence.some((e) => /first git trace 2020-01-01/.test(e)), "first-seen quoted as labeled evidence");
    assert.ok(/\*\*Draft-slug\*\*: stack-/.test(draftMd), "the DRAFT carries its Draft-slug provenance line");
    // A framework/DB config signal feeds --mine (ADR-0037).
    assert.ok(slugs.includes("framework-db-config"), "frameworkConfig produces a candidate");
    // Idempotence: ratify one candidate, re-mine must drop it.
    mkdirSync(join(root, "runward", "adr"), { recursive: true });
    writeFileSync(join(root, "runward", "adr", "ADR-0007-deps-data-store-orm.md"), "# ratified\n");
    const after = mineDrafts(root, buildInventory(root)).map((c) => c.slug);
    assert.ok(!after.includes("deps-data-store-orm"), "a ratified slug is not resurrected");
    // Ratified under a DIFFERENT filename: the kept **Draft-slug** line still resolves it (ADR-0038).
    writeFileSync(join(root, "runward", "adr", "ADR-0008-adopt-the-web-framework.md"), "# ratified\n\n**Draft-slug**: deps-web-framework-ui\n");
    const after2 = mineDrafts(root, buildInventory(root)).map((c) => c.slug);
    assert.ok(!after2.includes("deps-web-framework-ui"), "a renamed ratification resolves via Draft-slug");
    // Rejected in place is durable: a DRAFT marked Status: rejected is never re-proposed.
    writeFileSync(join(root, "runward", "adr", "DRAFT-ci-pipeline.md"), "# DRAFT\n\n**Status**: rejected\n");
    const after3 = mineDrafts(root, buildInventory(root)).map((c) => c.slug);
    assert.ok(!after3.includes("ci-pipeline"), "a rejected DRAFT is not resurrected");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
