// RWD-2026-0205: a manifest cell or a decision record built to make the gate's own readers quadratic.
//
// The audit of 2026-11-06 that followed the analyzers' quadratic pattern (RWD-2026-0203) read every
// regular expression of the evidence and conformance layers too, which every release since 0.8.0 runs
// under `check --strict`. Five were quadratic on a text the judged tree writes, measured end to end on
// 0.46.0 with `init --example`, one cell or one file planted, 100,000 characters: the trailing punctuation
// stripped from a pointer (over 60 s), the template placeholder test of a cell (18 s), the path tokens of a
// cell (15 s), the `rejected` status of a draft decision (11 s), the `hypothesis` status of a decision
// (6.8 s). Each is rewritten in a form that reads each character one way, and is held to the old
// pattern's answers on generated inputs (measured in the session, 850,000 comparisons, no difference).
// Here each shape runs through the real CLI, at the size measured, far inside the ceiling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const SIZE = 100_000;
const CEILING_MS = 6000;
const fill = (unit) => unit.repeat(Math.floor(SIZE / unit.length));

const prepared = (() => {
  const dir = mkdtempSync(join(tmpdir(), "rw-ceiling-ec-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir, stdio: "ignore" });
  const init = spawnSync(process.execPath, [CLI, "--yes", "init", "--example"], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return dir;
})();
test.after(() => rmSync(prepared, { recursive: true, force: true }));

/** A copy of the example, one change, and `check --strict` timed. */
function timed(plant) {
  const dir = mkdtempSync(join(tmpdir(), "rw-ceiling-ec-"));
  try {
    execFileSync("cp", ["-R", `${prepared}/.`, dir]);
    plant(dir);
    const t0 = process.hrtime.bigint();
    const r = spawnSync(process.execPath, [CLI, "check", "--strict"], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
    return { code: r.status, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
/** The evidence of the first applied row of the floor, replaced. */
const cell = (evidence) => (dir) => {
  const floor = join(dir, "runward", "floor.md");
  const lines = readFileSync(floor, "utf8").split("\n");
  const i = lines.findIndex((l) => /^\|\s*[a-z][a-z0-9-]+\s*\|\s*applied\s*\|/.test(l));
  const cells = lines[i].split("|");
  cells[3] = ` ${evidence} `;
  lines[i] = cells.join("|");
  writeFileSync(floor, lines.join("\n"));
};

for (const [what, plant] of [
  ["a pointer followed by a long run of closing punctuation (over 60 s on 0.46.0)", cell("file:code/src/core/domain/guard.ts" + fill(")") + "x")],
  ["a cell opening like the template placeholder, blanks and words to its end (18 s)", cell("[" + fill(" a"))],
  ["a cell of path characters with no extension, then a pointer (15 s)", cell(fill("sh-") + " file:code/src/core/domain/guard.ts")],
  ["a draft decision of blank lines (11 s)", (dir) => writeFileSync(join(dir, "runward", "adr", "DRAFT-0099-blank.md"), "\n".repeat(SIZE) + "x")],
  ["a decision ending in blank lines of tabs (6.8 s)", (dir) => appendFileSync(join(dir, "runward", "adr", "ADR-0001-single-orchestrator.md"), "\n" + fill("\n\t") + "x")],
]) {
  test(`${what}: \`check --strict\` reads it in linear time`, () => {
    const { code, ms } = timed(plant);
    assert.ok(code === 0 || code === 1, `the gate answered (exit ${code})`);
    assert.ok(ms < CEILING_MS, `read in ${ms.toFixed(0)} ms, over the ${CEILING_MS} ms ceiling`);
  });
}
