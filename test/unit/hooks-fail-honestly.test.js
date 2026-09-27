// The operator's hook seams fail HONESTLY: what did not run is said, what failed is named, and a
// configuration error is never dressed as a verdict. Found by the 2026-09-27 audit of what the CLI
// prints, each case reproduced on the shipped 0.42.2 binary before it was fixed:
//
//   RWD-2026-0134  `check --hooks` with a malformed hooks.json: no hook ran, no line said so, and the
//                  gate came out green, exit 0.
//   RWD-2026-0135  `check --hooks` with no hooks.json: silence; with `"before": "exit 1"` (a string):
//                  iterated character by character, `✗ 5/6 failed`.
//   RWD-2026-0136  a failed hook was counted and never named, in the terminal and in --json.
//   RWD-2026-0137  `gate-hook` with a wrong --harness, or none: exit 2, which Claude Code and Junie
//                  read as "block the agent", raised before `stop_hook_active` was honoured.
//   RWD-2026-0138  `gate-hook` outside any mission (or with a wrong -p): empty output, exit 0 —
//                  exactly what a green gate prints.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, args, input) => {
  const r = spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ENV, input });
  return { out: r.stdout ?? "", err: r.stderr ?? "", code: r.status };
};
// A mission whose plain `check` is green, so any red below is the hooks' doing and nothing else.
const green = () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-hooks-honest-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env: ENV, stdio: "pipe" });
  assert.equal(run(dir, ["check"]).code, 0, "precondition: the example mission is green without hooks");
  return dir;
};
const hooksFile = (dir, text) => writeFileSync(join(dir, "runward", "hooks.json"), text);

test("hooks-honest: a malformed hooks.json under --hooks is said and fails the gate — never a green with no hook run", () => {
  const dir = green();
  try {
    hooksFile(dir, '{"before":["exit 1"],}'); // trailing comma
    const r = run(dir, ["check", "--hooks"]);
    assert.equal(r.code, 1, "the operator asked for their proofs; none ran; that is not a pass");
    assert.match(r.out, /runward\/hooks\.json: not valid JSON .* no hook ran/);
    assert.doesNotMatch(r.out, /All expected deliverables are filled/);
    const j = JSON.parse(run(dir, ["check", "--hooks", "--json"]).out);
    assert.deepEqual([j.verdict, j.gaps.hooks, j.hooks.config], ["gaps", 1, "invalid"]);
    assert.match(j.hooks.problem, /not valid JSON/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hooks-honest: a string where a list belongs is a shape error, not six commands; an absent file is said", () => {
  const dir = green();
  try {
    const none = run(dir, ["check", "--hooks"]);
    assert.equal(none.code, 0, "no hooks.json is a legitimate state, not a failure");
    assert.match(none.out, /--hooks: no runward\/hooks\.json .* no hook ran/, "but it is SAID: the operator believed their proofs ran");
    assert.equal(JSON.parse(run(dir, ["check", "--hooks", "--json"]).out).hooks.config, "absent");
    assert.equal(JSON.parse(run(dir, ["check", "--json"]).out).hooks, undefined, "without --hooks the payload keeps its bytes");

    hooksFile(dir, '{"before":"touch CHAR_RAN"}');
    const str = run(dir, ["check", "--hooks"]);
    assert.equal(str.code, 1);
    assert.match(str.out, /"before" must be an array of command strings/);
    assert.doesNotMatch(str.out, /\d+\/\d+ failed/, "no count of commands the operator never wrote");
    assert.ok(!existsSync(join(dir, "CHAR_RAN")) && !existsSync(join(dir, "t")), "nothing of a malformed file is executed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hooks-honest: the failed hook is named, in the terminal and in --json", () => {
  const dir = green();
  try {
    hooksFile(dir, JSON.stringify({ before: ["true"], after: ["exit 3", "true"] }));
    const r = run(dir, ["check", "--hooks"]);
    assert.equal(r.code, 1);
    assert.match(r.out, /Hooks · after[\s\S]*1\/2 failed\n\s+✗ exit 3\n/, "the command that said no is on its own line");
    const j = JSON.parse(run(dir, ["check", "--hooks", "--json"]).out);
    assert.equal(j.gaps.hooks, 1);
    assert.deepEqual(j.hooks, { config: "ok", problem: null, failed: [{ phase: "after", command: "exit 3" }] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hooks-honest: a misconfigured gate-hook fails open, says so, and traces it — even under stop_hook_active", () => {
  const dir = green();
  try {
    const log = join(dir, "runward", "gate-bypass.log");
    for (const args of [["--harness", "claud"], [], ["--harness"]]) {
      const r = run(dir, ["gate-hook", ...args], '{"stop_hook_active":true}');
      assert.deepEqual([r.code, r.out], [0, ""], `gate-hook ${args.join(" ")}: exit 2 would block the agent on a typo, every turn`);
      assert.match(r.err, /misconfigured .* Failing open: the gate was NOT evaluated/);
    }
    const trace = readFileSync(log, "utf8").trim().split("\n");
    assert.equal(trace.length, 3, "each failed-open turn is a committed line, never a silent allow-forever");
    assert.match(trace[0], /gate NOT evaluated: gate-hook misconfigured \(unknown harness "claud"/);
    assert.match(trace[1], /required option/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hooks-honest: gate-hook with no mission reachable says so on stderr, still exit 0 with an empty stdout", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-hooks-nomission-"));
  try {
    for (const [cwd, args] of [[dir, []], [ROOT, ["-p", join(dir, "does-not-exist")]]]) {
      const r = run(cwd, ["gate-hook", "--harness", "claude", ...args], "{}");
      assert.deepEqual([r.code, r.out], [0, ""], "fail-open stays fail-open: the harness's contract channel is untouched");
      assert.match(r.err, /no runward\/ mission found from .* gate not evaluated \(fail-open\)/, "distinguishable from a green");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
