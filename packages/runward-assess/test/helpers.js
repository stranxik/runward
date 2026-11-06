// Shared test helpers: synthetic inputs for the score, and throw-away git repositories.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadGrid } from "../src/grid.js";

export const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BIN = join(PKG, "bin", "runward-assess.js");
export const G = loadGrid();
export const bundle = { grid: G.grid, catalogue: G.catalogue, data: G.data, digests: G.digests };

export const COMMIT = "a".repeat(40);
/** A measure, a concordant snapshot and a profile carrying exactly the given facts. */
export function inputs({ profiles = ["L", "W", "A"], prof = {}, facts = {}, snapshot = true, head = COMMIT } = {}) {
  const m = {}, x = {};
  for (const [k, v] of Object.entries(facts)) (k.startsWith("x.") ? x : m)[k] = v;
  const window = { basis: "100-first-parent", commits: 100, from: "c".repeat(40), fromDate: "2026-10-01T00:00:00Z", to: COMMIT, toDate: "2026-11-05T12:00:00Z" };
  const measure = {
    schema: "runward-assess-measure/1",
    environment: { arch: "test", git: "git", network: "blocked (test)", node: "test", os: "test" },
    facts: m, grid: { data: G.digests.gridData, digest: G.digests.grid, id: "grille@1" },
    inventory: { bytes: 0, files: 0, submodules: 0 },
    profileEvidence: { buildScript: null, gateRuns: null, modelSdks: [], paths: {}, publishable: [], toolSdks: [] },
    subject: { commit: COMMIT, committedAt: "2026-11-05T12:00:00Z", repo: "fixture/repo", tree: "b".repeat(40) },
    tool: { digest: "0".repeat(64), name: "runward-assess", version: "0.1.0" },
    window,
  };
  const snap = snapshot ? {
    digest: "d".repeat(64),
    manifest: { asOf: "2026-11-06T00:00:00.000Z", asOfDate: "2026-11-06", entries: [], gate: null, grid: { data: G.digests.gridData, id: "grille@1" }, subject: { commit: COMMIT, defaultBranch: "main", headAtCapture: head, repo: "fixture/repo" }, unavailable: [], window: { from: window.from, to: COMMIT } },
    facts: x, profileEvidence: { registry: {}, registryVersions: {}, urls: {}, visibility: "public" },
  } : null;
  const profile = { schema: "runward-assess-profile/1", profiles, facts: { repo_public: true, ...prof } };
  return { measure, snapshot: snap, profile };
}

export function git(dir, ...args) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_DATE: "2026-11-01T10:00:00Z", GIT_COMMITTER_DATE: "2026-11-01T10:00:00Z" } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/** A throw-away repository: commits is a list of { files: {path: content|null}, author?, email? }. */
export function repo(commits) {
  const dir = mkdtempSync(join(tmpdir(), "runward-assess-test-"));
  git(dir, "init", "-q", "-b", "main");
  for (const [i, c] of commits.entries()) {
    for (const [p, content] of Object.entries(c.files ?? {})) {
      const f = join(dir, p);
      if (content === null) rmSync(f, { force: true });
      else { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); }
    }
    git(dir, "add", "-A");
    git(dir, "-c", `user.name=${c.author ?? "Dev"}`, "-c", `user.email=${c.email ?? "dev@example.org"}`, "commit", "-q", "--allow-empty", "-m", c.message ?? `commit ${i}`);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function stateOf(record, id) {
  return [...record.internal.criteria, ...record.external.criteria].find((c) => c.id === id);
}
