// `runward report -o` removed then overwrote whatever file it was pointed at, re-rooted an absolute
// path under the project and let `../` write outside it (RWD-2026-0139); the global --dry-run was
// ignored and the previous report removed on a "preview" (RWD-2026-0140). Each test below fails on
// the unguarded command: the file it protects is gone, or the tree it must not touch has changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-27" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

function example() {
  const parent = mkdtempSync(join(tmpdir(), "rw-report-out-"));
  const dir = join(parent, "mission");
  execFileSync("mkdir", [dir]);
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  const r = run(dir, "init", "--yes", "--example");
  assert.equal(r.status, 0, r.stderr);
  return { parent, dir };
}
const REPORT = join("runward", "governance", "delivery-report.html");

test("report -o refuses to overwrite a file that is not a delivery report, and leaves it intact", () => {
  const { parent, dir } = example();
  try {
    const target = join(dir, "runward", "framing.md");
    const before = readFileSync(target, "utf8");
    const r = run(dir, "report", "-o", "runward/framing.md");
    assert.equal(r.status, 2, "a refusal, not a success");
    assert.match(r.stderr, /runward\/framing\.md exists and is not a runward delivery report/);
    assert.equal(readFileSync(target, "utf8"), before, "the deliverable is untouched");
    // --force is the explicit way through, and it is honoured.
    assert.equal(run(dir, "report", "-o", "runward/framing.md", "--force").status, 0);
    assert.match(readFileSync(target, "utf8"), /^<!DOCTYPE html>/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("report -o refuses a path that leaves the project, and a directory", () => {
  const { parent, dir } = example();
  try {
    const up = run(dir, "report", "-o", "../escape.html");
    assert.equal(up.status, 2);
    assert.match(up.stderr, /--out must be a file path inside the project/);
    assert.ok(!existsSync(join(parent, "escape.html")), "nothing written outside the project");
    const abs = join(parent, "abs.html");
    const outside = run(dir, "report", "-o", abs);
    assert.equal(outside.status, 2);
    assert.ok(!existsSync(abs) && !existsSync(join(dir, abs)), "an absolute path is neither re-rooted nor written outside");
    const d = run(dir, "report", "-o", "runward");
    assert.equal(d.status, 2);
    assert.match(d.stderr, /--out points to a directory \(runward\)/);
    assert.doesNotMatch(d.stderr, /EISDIR/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("report -o honours an absolute path inside the project and replaces a previous report", () => {
  const { parent, dir } = example();
  try {
    const abs = join(dir, "runward", "r.html");
    const a = run(dir, "report", "-o", abs);
    assert.equal(a.status, 0, a.stderr);
    assert.ok(existsSync(abs), "written where it was asked, not re-rooted");
    assert.match(a.stdout, /file: runward\/r\.html/);
    assert.equal(run(dir, "report").status, 0);
    const first = readFileSync(join(dir, REPORT), "utf8");
    assert.equal(run(dir, "report").status, 0, "a previous report is replaced without --force");
    assert.equal(readFileSync(join(dir, REPORT), "utf8"), first);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("report under the global --dry-run writes nothing, removes nothing, and says what it would write", () => {
  const { parent, dir } = example();
  try {
    const fresh = run(dir, "--dry-run", "report");
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.match(fresh.stdout, /would write runward\/governance\/delivery-report\.html \(verdict CLEAN\)/);
    assert.ok(!existsSync(join(dir, REPORT)), "a dry run creates no report");
    writeFileSync(join(dir, REPORT), "<!DOCTYPE html>\n<title>Delivery report — subject abc</title>\nPREVIOUS");
    const again = run(dir, "--dry-run", "report");
    assert.match(again.stdout, /would replace runward\/governance\/delivery-report\.html/);
    assert.match(readFileSync(join(dir, REPORT), "utf8"), /PREVIOUS$/, "the previous report is neither removed nor rewritten");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
