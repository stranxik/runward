// Golden test: the command line's own surface is byte-fixed — every help screen, every usage error
// and its exit code (ADR-0129).
//
// The fixture was recorded from `main` at 0.46.0, when the argument parser was a dependency, before
// the parser in src/lib/cli-args.ts replaced it: what this test compares is the surface an operator,
// a CI and the documentation already knew, not a description of the new code written by the new
// code. From here on, a change to a help line, to the wording of a usage error or to an exit code is
// a DELIBERATE golden diff read in its pull request.
//
// What is recorded, per case: the arguments, the exit status, stdout and stderr, byte for byte.
//   - the help of the program and of each command, by `--help`, `-h` and `help <command>`;
//   - the help as a terminal of 60, 100 and 140 columns shows it (test/support/fake-tty.mjs): the
//     wrapping follows the terminal, and is fixed at 80 columns when the stream is not one;
//   - each usage error: an unknown command or option (with its suggestion), a missing or an excess
//     argument, an option without its value, a value outside the allowed choices, a required option
//     left out; in a machine run (`--json`), the document on stdout beside the sentence on stderr;
//   - `gate-hook`, where the same errors let the turn through (exit 0, ADR-0065).
// Normalisation: the package version becomes <VERSION>, so a release does not read as a change.
//
// Regenerate deliberately with UPDATE_GOLDEN=1 node --test test/unit/cli-usage-golden.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const FAKE_TTY = join(ROOT, "test", "support", "fake-tty.mjs");
const FIXTURE = join(ROOT, "test", "fixtures", "golden", "cli-usage.json");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const COMMANDS = ["init", "check", "verify", "bundle", "spec-check", "status", "doctor", "wire", "update",
  "characterize", "manifest", "propose", "ratify", "sample", "gate-hook", "report", "rules", "explain", "compliance"];

/** Every case is an argument list; `columns` runs it as a terminal of that width. */
const CASES = [
  // Help and version.
  { argv: [] }, { argv: ["--help"] }, { argv: ["-h"] }, { argv: ["help"] }, { argv: ["help", "help"] },
  { argv: ["help", "bogus"] }, { argv: ["--version"] }, { argv: ["-V"] }, { argv: ["check", "--version"] },
  { argv: ["--bogus", "--help"] }, { argv: ["bogus", "--help"] }, { argv: ["--help", "check"] },
  ...COMMANDS.flatMap((c) => [{ argv: [c, "--help"] }, { argv: ["help", c] }, { argv: [c, "-h"] }]),
  ...[60, 100, 140].flatMap((columns) => [{ argv: ["--help"], columns }, { argv: [], columns },
    ...COMMANDS.map((c) => ({ argv: [c, "--help"], columns }))]),
  // Unknown command, with and without a suggestion.
  { argv: ["bogus"] }, { argv: ["chekc"] }, { argv: ["stats"] }, { argv: ["rule"] }, { argv: ["bogus", "--zzz"] },
  { argv: ["--no-color", "bogus"] },
  // Unknown option, with and without a suggestion, at the program and at a command.
  { argv: ["--bogus"] }, { argv: ["--verbos"] }, { argv: ["--path", "x", "check"] }, { argv: ["check", "--bogus"] },
  { argv: ["check", "--strct"] }, { argv: ["check", "--jsno"] }, { argv: ["check", "--no-colour"] },
  { argv: ["check", "-x"] }, { argv: ["check", "--strict=1"] }, { argv: ["check", "--yes=1"] },
  { argv: ["status", "--strict"] }, { argv: ["ratify", "--acept", "a:b"] }, { argv: ["rules", "--fro", "x"] },
  // An option without its value, a value outside the choices, a required option left out.
  { argv: ["check", "--through"] }, { argv: ["check", "-p"] }, { argv: ["check", "--witness"] },
  { argv: ["init", "--tools"] }, { argv: ["rules", "--for"] }, { argv: ["ratify", "--accept"] },
  { argv: ["check", "--through", "zzz"] }, { argv: ["check", "--through=zzz"] }, { argv: ["check", "--require", "zzz"] },
  { argv: ["check", "--bogus", "--through", "zzz"] }, { argv: ["check", "--through", "zzz", "--help"] },
  // Arguments: missing, in excess.
  { argv: ["verify"] }, { argv: ["verify", "a", "b"] }, { argv: ["bundle"] }, { argv: ["spec-check"] },
  { argv: ["explain"] }, { argv: ["explain", "a", "b"] }, { argv: ["compliance", "a", "b"] },
  { argv: ["check", "extra"] }, { argv: ["check", "a", "b"] }, { argv: ["check", "-5"] },
  { argv: ["check", "--", "--help"] }, { argv: ["status", "extra", "--bogus"] }, { argv: ["doctor", "x"] },
  // A machine run gets its usage error as the document it asked for (ADR-0083).
  { argv: ["check", "--json", "--bogus"] }, { argv: ["status", "--json", "--bogus"] }, { argv: ["doctor", "--json", "--bogus"] },
  { argv: ["wire", "--json", "--bogus"] }, { argv: ["spec-check", "--json"] }, { argv: ["check", "--json", "--through", "topology"] },
  { argv: ["ratify", "--json", "--bogus"] }, { argv: ["ratify", "--list", "--json", "--bogus"] },
  { argv: ["check", "--sarif", "--json", "--bogus"] }, { argv: ["update", "--json"] }, { argv: ["verify", "--json"] },
  { argv: ["explain", "--json"] }, { argv: ["bogus", "--json"] },
  // gate-hook runs inside a harness: a parse error there lets the turn through (ADR-0065).
  { argv: ["gate-hook"] }, { argv: ["gate-hook", "--bogus"] }, { argv: ["gate-hook", "--harness"] },
  { argv: ["gate-hook", "--harness", "claude-code", "extra"] }, { argv: ["gate-hook", "-p", "somewhere", "--bogus"] },
];

function runCase(c, cwd) {
  const args = c.columns ? [FAKE_TTY, CLI, String(c.columns), ...c.argv] : [CLI, ...c.argv];
  const env = { ...process.env, NO_COLOR: "1" };
  delete env.FORCE_COLOR;
  const norm = (s) => s.split(VERSION).join("<VERSION>");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d) => { stdout += d; });
    child.stderr.setEncoding("utf8").on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ argv: c.argv, ...(c.columns ? { columns: c.columns } : {}), status, stdout: norm(stdout), stderr: norm(stderr) }));
  });
}

/** Every case, a few processes at a time, in the order of CASES. */
async function runAll(cwd) {
  const got = new Array(CASES.length);
  let next = 0;
  const worker = async () => { while (next < CASES.length) { const i = next++; got[i] = await runCase(CASES[i], cwd); } };
  await Promise.all(Array.from({ length: Math.min(8, Math.max(2, availableParallelism())) }, worker));
  return got;
}

test("golden: every help screen, every usage error and its exit code, byte for byte", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "rw-cli-golden-"));
  try {
    const got = await runAll(cwd);
    if (process.env.UPDATE_GOLDEN) writeFileSync(FIXTURE, JSON.stringify(got, null, 1) + "\n");
    const want = JSON.parse(readFileSync(FIXTURE, "utf8"));
    assert.equal(got.length, want.length, "the fixture records every case, and no other");
    for (let i = 0; i < got.length; i++) {
      const label = `runward ${got[i].argv.join(" ")}${got[i].columns ? ` (terminal of ${got[i].columns} columns)` : ""}`;
      assert.deepEqual(got[i], want[i], label);
    }
    // The cases cover what they claim to: a fixture of empty strings would compare equal to itself.
    assert.ok(want.filter((w) => /^Usage: runward/.test(w.stdout)).length >= 3 * COMMANDS.length, "the help screens are in the fixture");
    assert.ok(want.filter((w) => w.status === 2 && /^error: /.test(w.stderr)).length >= 30, "the usage errors are in the fixture");
    assert.ok(want.some((w) => /Did you mean/.test(w.stderr)), "a suggestion is in the fixture");
    assert.ok(want.some((w) => w.status === 2 && /"error":\s*"usage"/.test(w.stdout)), "a machine usage document is in the fixture");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
