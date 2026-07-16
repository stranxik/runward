import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectHarness } from "../../dist/lib/harness.js";

test("runtime signal wins: CLAUDECODE → claude family (covers Cowork), offer-to-wire", () => {
  const d = detectHarness({ CLAUDECODE: "1" }, null);
  assert.equal(d.status, "detected");
  assert.equal(d.family, "claude");
  assert.equal(d.detectedVia, "runtime-signal");
  assert.equal(d.signal, "CLAUDECODE");
  assert.equal(d.operatorAction, "offer-to-wire-sample");
  assert.ok(d.recommendedChannel && d.recommendedChannel.sample.includes("claude-code-settings"));
});

test("CURSOR_AGENT is the agent-mode marker; CURSOR_TRACE_ID alone is not a signal", () => {
  assert.equal(detectHarness({ CURSOR_AGENT: "1" }, null).family, "cursor");
  assert.equal(detectHarness({ CURSOR_TRACE_ID: "abc" }, null).status, "undetermined");
});

test("GEMINI_CLI → gemini; channel lives in the packaging (no mission sample)", () => {
  const d = detectHarness({ GEMINI_CLI: "1" }, null);
  assert.equal(d.family, "gemini");
  assert.equal(d.recommendedChannel.sample, null);
  assert.ok(d.recommendedChannel.note);
});

test("no signal, no config → undetermined, ask the operator, universal candidates present", () => {
  const d = detectHarness({}, null);
  assert.equal(d.status, "undetermined");
  assert.equal(d.harness, null);
  assert.equal(d.operatorAction, "ask-operator-which-harness");
  assert.equal(d.recommendedChannel, null);
  assert.ok(d.candidateChannels.some((ch) => ch.channel === "ci-required-check"));
  assert.ok(d.candidateChannels.some((ch) => ch.channel === "pre-commit"));
});

test("config file is a weaker signal (config-detected) and a runtime signal overrides it", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-harness-"));
  try {
    mkdirSync(join(root, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(root, ".cursor", "rules", "runward.mdc"), "x");
    const d = detectHarness({}, root);
    assert.equal(d.status, "config-detected");
    assert.equal(d.family, "cursor");
    assert.equal(d.detectedVia, "config-file");
    // a runtime signal beats a config file:
    assert.equal(detectHarness({ CLAUDECODE: "1" }, root).family, "claude");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("config-file detection per family, incl. the fragile .claude/commands/rw-* path", () => {
  const cases = [
    { rel: [".claude", "commands", "rw-frame.md"], family: "claude" },
    { rel: ["GEMINI.md"], family: "gemini" },
    { rel: [".github", "copilot-instructions.md"], family: "copilot" },
    { rel: [".kiro", "steering", "runward-architect.md"], family: "kiro" },
  ];
  for (const { rel, family } of cases) {
    const root = mkdtempSync(join(tmpdir(), "rw-cfg-"));
    try {
      mkdirSync(join(root, ...rel.slice(0, -1)), { recursive: true });
      writeFileSync(join(root, ...rel), "x");
      const d = detectHarness({}, root);
      assert.equal(d.status, "config-detected", `${family} → config-detected`);
      assert.equal(d.family, family);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("windsurf config-detected has no shipped channel → recommendedChannel null, universals still offered", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-ws-"));
  try {
    mkdirSync(join(root, ".windsurf", "rules"), { recursive: true });
    writeFileSync(join(root, ".windsurf", "rules", "runward.md"), "x");
    const d = detectHarness({}, root);
    assert.equal(d.status, "config-detected");
    assert.equal(d.family, "windsurf");
    assert.equal(d.recommendedChannel, null);
    assert.ok(d.candidateChannels.some((ch) => ch.channel === "ci-required-check"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a mission with no marker at all → undetermined (root non-null, config loop exhausted)", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-bare-"));
  try {
    const d = detectHarness({}, root);
    assert.equal(d.status, "undetermined");
    assert.equal(d.operatorAction, "ask-operator-which-harness");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("wire never writes — wires:false is invariant across every outcome (ADR-0012)", () => {
  for (const env of [{ CLAUDECODE: "1" }, { GEMINI_CLI: "1" }, { CURSOR_AGENT: "1" }, {}]) {
    assert.equal(detectHarness(env, null).wires, false);
  }
});
