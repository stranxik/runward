// `characterize --mine` on an already-governed, green mission wrote DRAFT ADRs that turned
// `check --strict` red, under a help and a heading that said "read-only" (RWD-2026-0141). The
// mission here is the shipped example plus a manifest and a CI file, so the miner has candidates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-27" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });
const git = (cwd, ...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd });

function governedWithCandidates() {
  const dir = mkdtempSync(join(tmpdir(), "rw-char-gov-"));
  git(dir, "init", "-q", ".");
  assert.equal(run(dir, "init", "--yes", "--example").status, 0);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", dependencies: { express: "4.0.0" } }));
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  return dir;
}
const drafts = (dir) => readdirSync(join(dir, "runward", "adr")).filter((f) => f.startsWith("DRAFT-"));

test("characterize --mine on a governed mission refuses before writing, and the gate stays green", () => {
  const dir = governedWithCandidates();
  try {
    assert.equal(run(dir, "check", "--strict").status, 0, "the mission starts green");
    const r = run(dir, "characterize", "--mine");
    assert.equal(r.status, 2, "refused: the DRAFTs would be strict-gate refusals nobody chose");
    assert.match(r.stderr, /already has a runward\/ mission\. --mine would add DRAFT ADRs/);
    assert.match(r.stderr, /--mine --force/);
    assert.deepEqual(drafts(dir), [], "no DRAFT written");
    assert.ok(!existsSync(join(dir, "runward", "characterization.md")), "nothing written at all");
    assert.equal(run(dir, "check", "--strict").status, 0, "the gate is still green");
    // --force is the explicit request, and it is honoured — with the consequence said.
    const f = run(dir, "characterize", "--mine", "--force");
    assert.equal(f.status, 0, f.stderr);
    assert.ok(drafts(dir).length > 0);
    assert.match(f.stdout, /each DRAFT keeps the gate red until you set it to accepted or rejected/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("characterize says it writes into runward/, never 'read-only' above a write line", () => {
  const dir = governedWithCandidates();
  try {
    const r = run(dir, "characterize");
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /read-only/i);
    assert.match(r.stdout, /Reading your code \(never modified; writes into runward\/\)/);
    const help = run(dir, "characterize", "--help").stdout;
    assert.doesNotMatch(help, /read-only/i);
    assert.match(help, /writes runward\/characterization\.md/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("characterize --mine without a candidate does not send the reader to DRAFTs that do not exist", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-char-none-"));
  try {
    writeFileSync(join(dir, "README.md"), "# nothing to mine\n");
    const r = run(dir, "characterize", "--mine");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /no candidate decision found/);
    assert.doesNotMatch(r.stdout, /DRAFT-\*\.md/);
    assert.doesNotMatch(r.stdout, /until you ratify each/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
