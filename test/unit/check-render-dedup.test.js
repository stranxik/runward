// A cause shared by many rows is said once, under the lines it explains.
//
// RWD-2026-0100. On a mission where 36 rules were missing their manifest row, the strict render
// printed the same 41-word guidance sentence 36 times — 71.6 % of the whole output was one repeated
// sentence (2 061 words for a first screen), and everything else the gate had to say drowned in it.
// The product's own code states the principle this was breaking: a disclosure nobody can read is a
// disclosure that was not made. The diagnosis ("not accounted for…") stays on every line; the
// guidance clause is spelled out once. The machine payload keeps the full sentence per row
// (ADR-0030 unchanged). Measured red against the pre-fix binary: 36 occurrences of the guidance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }); }
  catch (e) { return (e.stdout ?? "") + (e.stderr ?? ""); }
};
const count = (hay, needle) => hay.split(needle).length - 1;

test("the shared guidance prints once; the per-line diagnosis stays on every line", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-dedup-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init");
    const out = run(dir, "check", "--strict");
    assert.equal(count(out, "scaffolds the missing row(s)"), 1,
      "the guidance clause must appear exactly once — it appeared 36 times before the fix");
    assert.ok(count(out, "not accounted for") >= 30,
      "the per-line diagnosis must stay on every violating line — eliding it would hide WHICH rules are open");
    assert.match(out, /↳ \d+ rule\(s\) above share one cause/,
      "the shared cause must be announced with its count, under the lines it explains");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a cause carried by fewer than three rows is never elided", () => {
  // The elision exists for the degenerate screen, not as a habit: two rules failing for two
  // different reasons must keep their full sentences inline — there is nothing to deduplicate,
  // and a reader must never have to jump to a footnote for a singleton.
  const dir = mkdtempSync(join(tmpdir(), "rw-dedup2-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    const before = run(dir, "check", "--strict");
    assert.ok(!/↳/.test(before), "a green example mission elides nothing");
    // break exactly ONE pointer: one violation, unique problem, printed in full inline.
    // Pure Node, no sed: `sed -i ""` is BSD-only and the GNU leg of the CI read the empty string
    // as the script — the first push of this very test failed on Linux for that reason.
    const floor = join(dir, "runward", "floor.md");
    writeFileSync(floor, readFileSync(floor, "utf8").replace("#guardFields", "#renamedAway"));
    const out = run(dir, "check", "--strict");
    assert.match(out, /renamedAway.*not found in the file/,
      "a singleton violation keeps its full sentence inline");
    assert.ok(!/↳/.test(out), "no shared-cause footnote for causes below the threshold");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
