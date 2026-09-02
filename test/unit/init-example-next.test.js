// The last lines of `init --example` name the first gesture, not the last one.
//
// QW2 of the 2026-09-02 work orders. The example scaffold ends by auditing itself (deliberately:
// first contact is the strict gate going green), but the audit's own "Next" — assemble a
// compliance pack — then closed the screen: the right advice for a crossed mission, the wrong
// first contact with the product. Measured: the demo instruction sat at line 158 of a 249-line
// screen, and the final advice was a regime pack. The last lines are the ones a new operator acts
// on, so the first real gesture is repeated there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

test("the example scaffold's closing lines carry the demo gesture", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-exnext-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    const out = execFileSync("node", [CLI, "--yes", "init", "--example"], {
      cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" },
    });
    const tail = out.trimEnd().split("\n").slice(-5).join("\n");
    assert.match(tail, /cd code && npm install && npm run demo/,
      "the demo gesture must be within the last five lines — the eye acts on the end of the screen");
    assert.match(tail, /first-mission\.md/,
      "the closing lines must hand the reader to the tutorial that continues the path");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
