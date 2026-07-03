// Eval harness test: the committed EVAL_CASES are a dev set (a true hold-out
// lives outside the repo, invisible to whoever optimizes). The deterministic
// case also locks the contract "tool results reach the synthesis prompt".

import { test } from "node:test";
import assert from "node:assert/strict";
import { runEval, EVAL_CASES } from "../src/eval/harness.ts";

test("eval harness: all committed eval cases pass on the deterministic echo", async () => {
  const report = await runEval();
  assert.equal(report.cases.length, EVAL_CASES.length);
  assert.equal(report.passRate, 1);
  for (const c of report.cases) {
    assert.ok(c.deterministicOk, `${c.name}: deterministic assertion failed`);
    assert.ok(c.judge.passed, `${c.name}: judge failed (${c.judge.reason})`);
  }
});
