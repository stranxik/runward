// The last lines of `init --example` name the first gesture, not the last one.
//
// QW2 of the 2026-09-02 work orders. The example scaffold ends by auditing itself (deliberately:
// first contact is the strict gate going green), but the audit's own "Next" — assemble a
// compliance pack — then closed the screen: the right advice for a crossed mission, the wrong
// first contact with the product. Measured: the demo instruction sat at line 158 of a 249-line
// screen, and the final advice was a regime pack. The last lines are the ones a new operator acts
// on, so the first real gesture is repeated there. Since 2026-10-13 the renaming gestures are
// printed there too, and executed below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const RUN = (dir) => execFileSync("node", [CLI, "--yes", "init", "--example"], {
  cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" },
});

test("the example scaffold's closing lines carry the demo and the renaming gestures", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-exnext-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    const tail = RUN(dir).trimEnd().split("\n").slice(-9).join("\n");
    assert.match(tail, /cd code && npm install && npm run demo/,
      "the demo gesture must be within the closing lines — the eye acts on the end of the screen");
    assert.match(tail, /xargs sed -i\.bak 's\/guardFields\/validateFields\/g'/,
      "the clean rename that turns the gate red must be printed, not one URL away (2026-10-13)");
    assert.ok(tail.includes(`npx --yes runward@${VERSION} check --strict`),
      "the gate command is pinned to this version: a bare `npx runward` can run an older global install");
    assert.match(tail, /first-mission\.md/,
      "the closing lines must hand the reader to the tutorial that continues the path");
    assert.doesNotMatch(tail, /^ {2}\S.*\s#\s/m,
      "no printed command carries a trailing # comment: zsh pastes it as arguments");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// The printed gestures are instructions, so they are executed: the rename must turn the strict gate
// red, and the printed repair must turn it green. `npx --yes runward@X` is replaced by this build
// (no network in a unit test); the npm lines are skipped (they install the example's dependencies).
test("the printed gestures do what the header says: red after the rename, green after the repair", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-exrun-"));
  const strict = () => spawnSync("node", [CLI, "check", "--strict"], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }).status;
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    const lines = RUN(dir).split("\n").map((l) => l.trim());
    const rename = lines.find((l) => l.startsWith("grep -rl guardFields"));
    const repair = lines.find((l) => l.startsWith("sed -i.bak 's/#guardFields/"));
    assert.ok(rename && repair, "both gestures are printed");
    assert.equal(strict(), 0, "the example is green before the rename");
    execFileSync("sh", ["-c", rename], { cwd: dir });
    assert.equal(strict(), 1, "the clean rename turns the strict gate red");
    execFileSync("sh", ["-c", repair], { cwd: dir });
    assert.equal(strict(), 0, "the printed repair turns it green again");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
