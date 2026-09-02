// `runward gate-hook --harness <id>` — the verdict enters the harness's loop (ADR-0065, H1).
//
// What is pinned: each harness receives its NATIVE refusal shape (exit 2 + named ✗ lines for
// claude/junie, decision:block for copilot/kiro, decision:deny for gemini, an honestly-labelled
// advisory follow-up for cursor — never a pretended block); the gate blocks ONCE (stop_hook_active
// and the loop_count ceiling release with a committed trace in runward/gate-bypass.log); a refusal
// NAMES what is red instead of showing the tail; and infrastructure fails open (no mission, bad
// payload) while a verdict never does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHookPayload, renderRefusal, bypassEntry, GATE_HOOK_HARNESSES, LOOP_CEILING } from "../../dist/lib/gate-hook.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
// spawnSync, not execFileSync: a release exits 0 AND speaks on stderr, and execFileSync only
// hands stderr back on failure — the first draft of this file was blind to the release notice.
const hook = (cwd, payload, ...a) => {
  const r = spawnSync("node", [CLI, "gate-hook", ...a], { cwd, encoding: "utf8", env: ENV, input: payload });
  return { out: r.stdout ?? "", err: r.stderr ?? "", code: r.status };
};
const red = () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-gh-red-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "init", "--yes"], { cwd: dir, env: ENV, stdio: "pipe" });
  return dir;
};

test("payload reading is tolerant: guards from valid JSON, none from garbage or emptiness", () => {
  assert.deepEqual(parseHookPayload('{"stop_hook_active":true,"loop_count":3}'), { alreadyBlocked: true, loopCount: 3 });
  assert.deepEqual(parseHookPayload(""), { alreadyBlocked: false, loopCount: null });
  assert.deepEqual(parseHookPayload("not json {"), { alreadyBlocked: false, loopCount: null });
  assert.deepEqual(parseHookPayload('{"loop_count":"9"}'), { alreadyBlocked: false, loopCount: null },
    "a string counter is not a counter — no guard is invented from a malformed field");
});

test("each harness speaks its native refusal shape, and cursor never pretends to block", () => {
  const lines = ["runward gate: check --strict refuses this tree — 1 deliverable(s) not filled.", "✗ Frame · Framing Note (runward/framing.md) — untouched"];
  for (const h of ["claude", "junie"]) {
    const r = renderRefusal(h, lines);
    assert.deepEqual([r.stream, r.exitCode], ["stderr", 2], `${h} blocks by exit code`);
    assert.match(r.text, /✗ Frame/);
  }
  for (const [h, decision] of [["copilot", "block"], ["kiro", "block"], ["gemini", "deny"]]) {
    const r = renderRefusal(h, lines);
    assert.deepEqual([r.stream, r.exitCode], ["stdout", 0], `${h} blocks by contract, not exit code`);
    assert.equal(JSON.parse(r.text).decision, decision);
    assert.match(JSON.parse(r.text).reason, /refuses this tree/);
  }
  const cur = renderRefusal("cursor", lines);
  assert.equal(cur.exitCode, 0);
  assert.match(JSON.parse(cur.text).followup_message, /advisory retry tier — Cursor's hook cannot block/,
    "the one harness with no deny channel is labelled honestly, never dressed as a block");
});

test("a red mission blocks in the claude shape: exit 2, the refusals named on stderr", () => {
  const dir = red();
  try {
    const r = hook(dir, "{}", "--harness", "claude");
    assert.equal(r.code, 2);
    assert.match(r.err, /runward gate: check --strict refuses this tree/);
    assert.match(r.err, /✗ .+ · .+ — /, "the ✗ lines name phase, artifact and state — never the tail of an output");
    assert.match(r.err, /deliverable\(s\) not filled/, "the summary arithmetic is check's own (verdictSummaryParts)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a green mission is silence: exit 0, nothing written, no log", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-gh-green-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    execFileSync("node", [CLI, "init", "--yes", "--example"], { cwd: dir, env: ENV, stdio: "pipe" });
    const r = hook(dir, "{}", "--harness", "claude");
    assert.deepEqual([r.code, r.out, r.err], [0, "", ""]);
    assert.ok(!existsSync(join(dir, "runward", "gate-bypass.log")), "a green gate leaves no trace to explain");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("block ONCE: stop_hook_active releases, and the release is a committed trace", () => {
  const dir = red();
  try {
    const r = hook(dir, '{"stop_hook_active":true}', "--harness", "claude");
    assert.equal(r.code, 0, "the session is never trapped");
    assert.match(r.err, /this is a bypass, and it is in the diff/);
    const log = readFileSync(join(dir, "runward", "gate-bypass.log"), "utf8");
    assert.match(log, /released after one block \(claude, already-blocked\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test(`the loop ceiling (${LOOP_CEILING}) releases too, under its own named cause`, () => {
  const dir = red();
  try {
    const below = hook(dir, `{"loop_count":${LOOP_CEILING - 1}}`, "--harness", "gemini");
    assert.match(JSON.parse(below.out).decision ?? "", /deny/, "below the ceiling the gate still refuses");
    const at = hook(dir, `{"loop_count":${LOOP_CEILING}}`, "--harness", "gemini");
    assert.equal(at.code, 0);
    assert.equal(at.out, "", "a release emits no decision object — the harness proceeds");
    assert.match(readFileSync(join(dir, "runward", "gate-bypass.log"), "utf8"), /gemini, loop-ceiling/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("fail-open on infrastructure: no mission is silence; an unknown harness is a loud config error", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-gh-none-"));
  try {
    const r = hook(dir, "{}", "--harness", "claude");
    assert.deepEqual([r.code, r.out], [0, ""], "a repo-wide hook firing outside any mission allows — infrastructure, not a verdict");
    const bad = hook(dir, "{}", "--harness", "vscode");
    assert.equal(bad.code, 2, "a wrong id must be SEEN once at install time, never a silent allow-forever");
    assert.match(bad.err, new RegExp(GATE_HOOK_HARNESSES.join(", ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("garbage on stdin does not soften the verdict: the gate still blocks", () => {
  const dir = red();
  try {
    const r = hook(dir, "corrupted {{{ payload", "--harness", "claude");
    assert.equal(r.code, 2, "fail-open is for infrastructure; a red gate with no readable guards still refuses");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
