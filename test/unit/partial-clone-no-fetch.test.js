// RWD-2026-0202. In a partial clone (`git clone --filter=blob:none`), a git read that needs a blob the
// clone does not hold makes git fetch it from the promisor remote, on its own. Measured on 2026-11-06 on
// runward's own repository: `doctor` (git blame), `sample` (git blame) and `characterize` (git log
// --name-only, whose rename detection reads blobs) each started `git fetch origin --filter=blob:none`;
// with the network cut, `doctor` printed "7 entr(ies) not committed yet" for committed entries and
// `sample` printed "the review is not committed yet" where a full clone prints the review commit's
// signature status.
//
// What is pinned here, on a local partial clone (a bare repository served over file:// with
// uploadpack.allowFilter, so no network is involved):
//   - the positive control: in that clone, a plain `git blame` DOES fetch (a promisor pack appears), so
//     "no new promisor pack" below is not vacuous;
//   - `doctor`, `sample` (status and draw) and `characterize` add no promisor pack, remote reachable;
//   - a read git cannot make is reported "unknown, git could not read …", never "not committed", the
//     remote reachable or gone; the draw refuses a population it cannot read whole and writes nothing;
//   - the legitimate case still reads as such: in a full clone, a line not committed says so.
// GIT_NO_LAZY_FETCH is honoured from git 2.45.0 (absent from git's environment.h at v2.44.1, present at
// v2.45.0). With an older git the partial-clone tests are skipped, by name: they could not tell a
// refused fetch from a fetch made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GENV = { GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.com", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.com",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const ENV = { ...process.env, ...GENV, NO_COLOR: "1", RUNWARD_YES: "1" };
// runward must set the variable itself: the test environment never does it for it.
for (const k of ["CLAUDECODE", "GEMINI_CLI", "CURSOR_AGENT", "FORCE_COLOR", "GIT_NO_LAZY_FETCH", "GIT_DIR", "GIT_WORK_TREE"]) delete ENV[k];

const git = (cwd, args, env = {}) => execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args],
  { cwd, encoding: "utf8", stdio: "pipe", env: { ...ENV, ...env } });
const rw = (cwd, args, env = {}) => {
  try { return { out: execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", stdio: "pipe", env: { ...ENV, ...env } }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const v = execFileSync("git", ["--version"], { encoding: "utf8" }).match(/(\d+)\.(\d+)\.(\d+)/);
const honoured = v !== null && (Number(v[1]) > 2 || (Number(v[1]) === 2 && Number(v[2]) >= 45));
const SKIP = honoured ? false : `git ${v?.[0] ?? "of unknown version"} ignores GIT_NO_LAZY_FETCH (honoured from 2.45.0): a refused fetch cannot be told from a fetch made`;

/** A stage-1 charter, as test/unit/delegation-sample.test.js writes it: effective 2026-09-01, weekly. */
function charterText() {
  const f = {
    charter: "runward-delegation/1", stage: "1", accountable: "github:ada", aliases: "[Ada]",
    delegates: "[claude, codex, runward-steward[bot]]",
    "class-R": "maintainer", "class-H": "maintainer", "class-I": "refused", "class-D": "delegated",
    "budget-consecutive-refusals": "3", "budget-refusals-per-period": "20",
    "sample-size": "5", "sample-seeds": "1", "sample-period-days": "7",
    effective: "2026-09-01", expires: "2026-11-15", "pre-merge-paths": "[runward/delegation.md]",
  };
  return ["---", ...Object.entries(f).map(([k, val]) => `${k}: ${val}`), "---", ""].join("\n");
}
/** A deterministic 48-byte "signature" (the gate checks randomness against it, not drand's key). */
const sig = (label) => createHash("sha384").update(label).digest("hex");

const BASE = mkdtempSync(join(tmpdir(), "rw-partial-"));
process.on("exit", () => rmSync(BASE, { recursive: true, force: true }));
const SRC = join(BASE, "src");
const ORIGIN = join(BASE, "origin.git");

/** A mission with a history every command under test reads: a ratification line in a file changed
 *  after it, a delegation ledger written over several commits, and merges that rename a file. */
function buildSource() {
  mkdirSync(SRC);
  const g = (args, date) => git(SRC, args, date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {});
  const r = (args, env) => { const x = rw(SRC, args, env); assert.equal(x.code, 0, `runward ${args.join(" ")}: ${x.out}`); return x; };
  g(["init", "-q", "-b", "main"]);
  r(["--yes", "init"]);
  r(["manifest", "--sync"]);
  mkdirSync(join(SRC, "code", "config"), { recursive: true });
  writeFileSync(join(SRC, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
  r(["propose"]);
  r(["ratify", "--agent", "bot", "--for", "Ada", "--accept", "floor.md:config-secrets-boundary"]);
  writeFileSync(join(SRC, "runward", "delegation.md"), charterText());
  writeFileSync(join(SRC, "package.json"), JSON.stringify({ name: "x", files: ["dist", "templates"] }));
  writeFileSync(join(SRC, "notes.md"), "alpha\nbeta\ngamma\ndelta\nepsilon\n");
  g(["add", "-A"]); g(["commit", "-qm", "init"], "2026-09-01T09:00:00Z");
  r(["sample", "plant", "--ref", "seed-0001", "--summary", "Merge #9: tidy", "--defect", "deletes the gate test", "--actor", "codex"], { RUNWARD_NOW: "2026-09-02" });
  // floor.md changes after its ratification line: blaming that line reads the older version.
  const floor = join(SRC, "runward", "floor.md");
  writeFileSync(floor, readFileSync(floor, "utf8").replace(/^# (.*)$/m, "# $1 (revised)"));
  g(["add", "-A"]); g(["commit", "-qm", "seed"], "2026-09-02T09:00:00Z");
  // A merge that renames and changes a file: rename detection reads both blobs.
  g(["checkout", "-qb", "f1"]); g(["mv", "notes.md", "notes-renamed.md"]);
  writeFileSync(join(SRC, "notes-renamed.md"), "alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\n");
  g(["add", "-A"]); g(["commit", "-qm", "rename notes"], "2026-09-03T10:00:00Z");
  g(["checkout", "-q", "main"]); g(["merge", "-q", "--no-ff", "f1", "-m", "Merge f1"], "2026-09-03T11:00:00Z");
  r(["sample", "draw", "--signature", sig("one")], { RUNWARD_NOW: "2026-09-09" });
  g(["add", "-A"]); g(["commit", "-qm", "draw"], "2026-09-09T10:00:00Z");
  const ledger = readFileSync(join(SRC, "runward", "delegation-samples.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const items = ledger.find((x) => x.type === "draw").items;
  r(["sample", "review", ...items.map((it, i) => `${i + 1}=${it.ref === "seed-0001" ? "reject" : "accept"}`)]);
  g(["add", "-A"]); g(["commit", "-qm", "review"], "2026-09-09T11:00:00Z");
  r(["sample", "reveal"]);
  g(["add", "-A"]); g(["commit", "-qm", "reveal"], "2026-09-09T12:00:00Z");
  // The second period: its seed, then a merge that renames again, for a draw made in the clone.
  r(["sample", "plant", "--ref", "seed-0002", "--summary", "Merge #12: tidy", "--defect", "drops a test", "--actor", "codex"], { RUNWARD_NOW: "2026-09-10" });
  g(["add", "-A"]); g(["commit", "-qm", "seed 2"], "2026-09-10T09:00:00Z");
  g(["checkout", "-qb", "f2"]); g(["mv", "notes-renamed.md", "notes-again.md"]);
  writeFileSync(join(SRC, "notes-again.md"), "alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\neta\n");
  g(["add", "-A"]); g(["commit", "-qm", "rename again"], "2026-09-11T10:00:00Z");
  g(["checkout", "-q", "main"]); g(["merge", "-q", "--no-ff", "f2", "-m", "Merge f2"], "2026-09-11T11:00:00Z");
  git(BASE, ["clone", "-q", "--bare", SRC, ORIGIN]);
  git(ORIGIN, ["config", "uploadpack.allowFilter", "true"]);
}
if (honoured) buildSource();

/** A blobless clone of `origin` over file://: it holds every commit and tree, and the blobs of HEAD only. */
function partialClone(name, origin = ORIGIN) {
  const dir = join(BASE, name);
  git(BASE, ["clone", "-q", "--filter=blob:none", pathToFileURL(origin).href, dir]);
  return dir;
}
/** Each lazy fetch leaves one more promisor pack behind. */
const promisorPacks = (dir) => readdirSync(join(dir, ".git", "objects", "pack")).filter((f) => f.endsWith(".promisor")).length;
/** The line of the ratification entry in runward/floor.md. */
function ratificationLine(dir) {
  const lines = readFileSync(join(dir, "runward", "floor.md"), "utf8").split("\n");
  const head = lines.indexOf("### Ratification");
  const at = lines.findIndex((l, i) => i > head && /^- \d{4}-\d{2}-\d{2} · /.test(l));
  assert.ok(head >= 0 && at > head, "the fixture carries a ratification entry");
  return at + 1;
}

test("positive control: in this partial clone, a plain git blame fetches the blob it lacks", { skip: SKIP }, () => {
  const dir = partialClone("control");
  const before = promisorPacks(dir);
  const n = ratificationLine(dir);
  git(dir, ["blame", "--porcelain", "-L", `${n},${n}`, "--", "runward/floor.md"]);
  assert.ok(promisorPacks(dir) > before, "without a fetch here, 'no new promisor pack' below would prove nothing");
});

test("doctor adds no promisor pack, and a line git cannot read is unknown, not uncommitted", { skip: SKIP }, () => {
  const dir = partialClone("doctor");
  const before = promisorPacks(dir);
  const d = rw(dir, ["doctor"], { RUNWARD_NOW: "2026-09-16" });
  assert.equal(promisorPacks(dir), before, `doctor's git fetched from the promisor remote:\n${d.out}`);
  assert.match(d.out, /unknown, git could not read runward\/floor\.md:\d+/);
  assert.doesNotMatch(d.out, /not committed yet/);
  assert.match(d.out, /partial clone \(promisor remote: origin\): runward runs git with GIT_NO_LAZY_FETCH=1/);
  const j = JSON.parse(rw(dir, ["doctor", "--json"], { RUNWARD_NOW: "2026-09-16" }).out);
  assert.ok(j.ratifiers.some((b) => b.unreadable === true && b.committer === null && b.bound === null), JSON.stringify(j.ratifiers));
  assert.equal(promisorPacks(dir), before);
});

test("sample adds no promisor pack: its status says unknown, and its draw refuses a population it cannot read whole", { skip: SKIP }, () => {
  const dir = partialClone("sample");
  const before = promisorPacks(dir);
  const s = rw(dir, ["sample"], { RUNWARD_NOW: "2026-09-16" });
  assert.equal(promisorPacks(dir), before, `sample's git fetched from the promisor remote:\n${s.out}`);
  assert.match(s.out, /period ending 2026-09-08: unknown, git could not read runward\/delegation-samples\.jsonl:\d+/);
  assert.doesNotMatch(s.out, /the review is not committed yet/);
  // The planter's seed waits in the git directory, as it does on the planter's machine.
  cpSync(join(SRC, ".git", "runward"), join(dir, ".git", "runward"), { recursive: true });
  const ledger = readFileSync(join(dir, "runward", "delegation-samples.jsonl"), "utf8");
  const d = rw(dir, ["sample", "draw", "--signature", sig("two")], { RUNWARD_NOW: "2026-09-16" });
  assert.equal(d.code, 2, d.out);
  assert.match(d.out, /unknown, git could not read/);
  assert.equal(readFileSync(join(dir, "runward", "delegation-samples.jsonl"), "utf8"), ledger, "nothing is drawn from a population read in part");
  assert.equal(promisorPacks(dir), before, `the draw's git fetched from the promisor remote:\n${d.out}`);
});

test("characterize adds no promisor pack, and says the churn is unknown", { skip: SKIP }, () => {
  const dir = partialClone("characterize");
  const before = promisorPacks(dir);
  const c = rw(dir, ["characterize"]);
  assert.equal(c.code, 0, c.out);
  assert.equal(promisorPacks(dir), before, `characterize's git fetched from the promisor remote:\n${c.out}`);
  assert.match(readFileSync(join(dir, "runward", "characterization.md"), "utf8"), /Churn unknown, git could not read the history/);
});

test("the remote gone: doctor and sample say unknown, never not committed", { skip: SKIP }, () => {
  const origin = join(BASE, "origin-gone.git");
  git(BASE, ["clone", "-q", "--bare", ORIGIN, origin]);
  git(origin, ["config", "uploadpack.allowFilter", "true"]);
  const dir = partialClone("gone", origin);
  renameSync(origin, join(BASE, "origin-moved-away.git"));
  const d = rw(dir, ["doctor"], { RUNWARD_NOW: "2026-09-16" });
  assert.match(d.out, /unknown, git could not read runward\/floor\.md:\d+/);
  assert.doesNotMatch(d.out, /not committed yet/);
  const s = rw(dir, ["sample"], { RUNWARD_NOW: "2026-09-16" });
  assert.match(s.out, /period ending 2026-09-08: unknown, git could not read runward\/delegation-samples\.jsonl:\d+/);
  assert.doesNotMatch(s.out, /the review is not committed yet/);
});

test("control: in a full clone, the same history reads, and a ratification not committed yet still says so", { skip: SKIP }, () => {
  const dir = join(BASE, "full");
  git(BASE, ["clone", "-q", ORIGIN, dir]);
  const s = rw(dir, ["sample"], { RUNWARD_NOW: "2026-09-16" });
  assert.match(s.out, /period ending 2026-09-08: review commit [0-9a-f]{12} NOT signed/);
  assert.doesNotMatch(s.out, /unknown, git could not read/);
  // The charter is in force in this history: the agent is one it lists, inside its window.
  const r = rw(dir, ["ratify", "--agent", "claude", "--for", "Ada", "--accept", "governance/threat-model.md:config-secrets-boundary"], { RUNWARD_NOW: "2026-09-16" });
  assert.equal(r.code, 0, r.out);
  const d = rw(dir, ["doctor"], { RUNWARD_NOW: "2026-09-16" });
  assert.match(d.out, /1 entr\(ies\) not committed yet/);
  assert.doesNotMatch(d.out, /unknown, git could not read/);
  assert.doesNotMatch(d.out, /partial clone/);
});
