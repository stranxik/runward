// `wire --install` — the one writing gesture, and its locks (ADR-0065, H2).
//
// What is pinned: the anti-self-arming lock (an agent runtime signal refuses even before the TTY
// check, and no flag lifts it — `--yes` does not exist on this gesture); the preserving merge
// (every operator key and hook survives, runward adds exactly one marked Stop entry); the honest
// refusal for families with no native target (never a fallback write); `--dry-run` as the exempt
// read-only rendering; and the symmetric removal that touches only what runward marked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installPlan, mergeClaudeSettings, removeClaudeSettings, kiroHookContent, alreadyWired, journalLine } from "../../dist/lib/wire-install.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
// RUNWARD_YES stays set on purpose: every lock below fires THROUGH it — the proof --yes lifts nothing.
const BASE_ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
delete BASE_ENV.RUNWARD_DRY_RUN;
delete BASE_ENV.CLAUDECODE; delete BASE_ENV.GEMINI_CLI; delete BASE_ENV.CURSOR_AGENT;
const wire = (cwd, env, ...a) => {
  const r = spawnSync("node", [CLI, "wire", ...a], { cwd, encoding: "utf8", env: { ...BASE_ENV, ...env }, input: "" });
  return { out: r.stdout ?? "", err: r.stderr ?? "", code: r.status };
};
const mission = () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-wire-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "init", "--yes"], { cwd: dir, env: BASE_ENV, stdio: "pipe" });
  return dir;
};

test("installPlan: two native targets, and null everywhere else — null is a refusal, not a fallback", () => {
  assert.deepEqual(installPlan("claude"), { target: ".claude/settings.json", kind: "merge", harness: "claude" });
  assert.deepEqual(installPlan("kiro"), { target: ".kiro/hooks/runward-gate.kiro.hook", kind: "own", harness: "kiro" });
  for (const fam of ["gemini", "cursor", "copilot", "windsurf", null]) assert.equal(installPlan(fam), null);
});

test("the preserving merge: every operator key and hook survives, one marked entry lands", () => {
  const theirs = JSON.stringify({
    model: "opus", hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "tsc --noEmit" }] }], Stop: [{ hooks: [{ type: "command", command: "their-own-thing" }] }] },
  });
  const merged = JSON.parse(mergeClaudeSettings(theirs, "9.9.9"));
  assert.equal(merged.model, "opus", "unrelated keys survive");
  assert.equal(merged.hooks.PostToolUse[0].hooks[0].command, "tsc --noEmit", "unrelated hooks survive");
  assert.equal(merged.hooks.Stop.length, 2, "their Stop entry survives beside ours");
  assert.equal(merged.hooks.Stop[1]["runward-wired"], "9.9.9", "the marker rides inside the entry runward adds — never at the operator's top level");
  assert.match(merged.hooks.Stop[1].hooks[0].command, /runward gate-hook --harness claude/);
  assert.ok(!("runward-wired" in merged), "no top-level marker in a file runward does not own");
  const fresh = JSON.parse(mergeClaudeSettings(null));
  assert.equal(fresh.hooks.Stop.length, 1, "no file yet: the merge starts from an empty object");
  assert.throws(() => mergeClaudeSettings("[1,2]"), /refusing to merge/, "a non-object file is refused, never destroyed");
  assert.throws(() => mergeClaudeSettings("not json"), "an unparsable file is refused, never destroyed");
});

test("alreadyWired reads the marker, then the command, then says no", () => {
  assert.equal(alreadyWired(mergeClaudeSettings(null, "1.2.3")), "1.2.3");
  assert.equal(alreadyWired(JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "npx --yes runward gate-hook --harness claude" }] }] } })), "pre-marker",
    "a marker-less entry that still speaks gate-hook was wired by an older gesture");
  assert.equal(alreadyWired(JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "eslint ." }] }] } })), null);
  assert.equal(alreadyWired(kiroHookContent("2.0.0")), "2.0.0", "the owned kiro file carries its marker at the top level");
});

test("the symmetric removal touches only what runward marked, and cleans up after itself", () => {
  const theirs = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "their-own-thing" }] }] } });
  const merged = mergeClaudeSettings(theirs, "1.0.0");
  const removed = JSON.parse(removeClaudeSettings(merged));
  assert.equal(removed.hooks.Stop.length, 1);
  assert.equal(removed.hooks.Stop[0].hooks[0].command, "their-own-thing", "the operator's entry is untouched");
  assert.equal(removeClaudeSettings(theirs), null, "nothing of runward's here — removal says so instead of guessing");
  const onlyOurs = JSON.parse(removeClaudeSettings(mergeClaudeSettings(null)));
  assert.ok(!("hooks" in onlyOurs), "an empty hooks object does not linger");
});

test("the locks: an agent signal refuses first, then the missing terminal — and --dry-run is exempt", () => {
  const dir = mission();
  try {
    const agent = wire(dir, { CLAUDECODE: "1" }, "--install");
    assert.equal(agent.code, 2);
    assert.match(agent.err, /runs under an agent harness \(CLAUDECODE\)/, "the agent lock names its evidence");
    assert.match(agent.err, /operator's gesture/, "and says whose gesture this is");

    const noTty = wire(dir, {}, "--install");
    assert.equal(noTty.code, 2);
    assert.match(noTty.err, /without a terminal/);
    assert.match(noTty.err, /There is no flag that skips this/, "no --yes on this gesture, and the message says so");

    const un = wire(dir, { CLAUDECODE: "1" }, "--uninstall");
    assert.equal(un.code, 2, "disarming is locked exactly like arming — the more dangerous direction for an agent");

    const dry = wire(dir, { CLAUDECODE: "1" }, "--install", "--dry-run");
    assert.equal(dry.code, 0, "--dry-run writes nothing, so both locks stand aside");
    assert.match(dry.out, /gate-hook --harness claude/, "the exact command that would land is shown");
    assert.match(dry.out, /tier: ARMED/, "the tier is announced honestly");
    assert.match(dry.out, /--dry-run: nothing written/);
    assert.ok(!existsSync(join(dir, ".claude", "settings.json")), "and indeed nothing was");
    assert.ok(!existsSync(join(dir, "runward", "adapters", "installed.log")), "no journal entry for a gesture that did not happen");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a family with no native target is an honest refusal toward the universal channels", () => {
  const dir = mission();
  try {
    const r = wire(dir, { GEMINI_CLI: "1" }, "--install", "--dry-run");
    assert.equal(r.code, 2, "the gesture did not happen, and the exit code says so");
    assert.match(r.out, /No native install target/);
    assert.match(r.out, /pre-commit or the CI required check/, "the refusal points somewhere real");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the wire --json contract is v2: detection never writes, installing is a named policy", () => {
  const dir = mission();
  try {
    const j = JSON.parse(wire(dir, { CLAUDECODE: "1" }, "--json").out);
    assert.equal(j.schemaVersion, 2, "ADR-0030: the shape changed, so the version did");
    assert.equal(j.wires, "explicit-install-only");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("journalLine is one greppable committed line", () => {
  assert.equal(journalLine("2026-09-02", "installed", ".claude/settings.json", "claude", "1.0.0"),
    "2026-09-02  installed .claude/settings.json (harness claude, runward 1.0.0)\n");
});

// ── The consolidated mutation pass (2026-09-02): degenerate shapes, pinned exactly ─────────────

test("kiroHookContent is the exact owned file — every literal is load-bearing", () => {
  assert.deepEqual(JSON.parse(kiroHookContent("1.2.3")), {
    "runward-wired": "1.2.3",
    version: "v1",
    hooks: [{
      name: "runward-gate", trigger: "Stop",
      action: { type: "command", command: "npx --yes runward gate-hook --harness kiro" },
      timeout: 120, enabled: true,
    }],
  });
});

test("mergeClaudeSettings refuses every non-object clause by its own name", () => {
  assert.throws(() => mergeClaudeSettings("null"), /refusing to merge/, "JSON null is not a settings object");
  assert.throws(() => mergeClaudeSettings("42"), /refusing to merge/, "a number is not a settings object");
  assert.throws(() => mergeClaudeSettings('"text"'), /refusing to merge/, "a string is not a settings object");
  const healed = JSON.parse(mergeClaudeSettings('{"hooks":"garbage"}', "1.0.0"));
  assert.equal(healed.hooks.Stop.length, 1, "a non-object hooks value is replaced, never assigned into (strict mode would throw)");
});

test("alreadyWired survives every degenerate lock shape and answers null, never a crash", () => {
  for (const shape of ['{"hooks":null}', '{"hooks":{"Stop":null}}', '{"hooks":{"Stop":[null]}}', "[]", "null", '{"hooks":{"Stop":"x"}}']) {
    assert.equal(alreadyWired(shape), null, `${shape} is not wired, and asking must not throw`);
  }
});

test("removeClaudeSettings tolerates a hookless file and answers null", () => {
  assert.equal(removeClaudeSettings("{}"), null);
  assert.equal(removeClaudeSettings('{"hooks":{}}'), null);
});
