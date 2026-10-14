// The `version` input reaches `npx runward@<version>`: the gate Action, the verify Action and the
// GitLab template must refuse the same strings. The glob the Actions used, [0-9]*.[0-9]*.[0-9]*,
// admitted "1.0.0; anything" (quoted, so no injection, but not a version). This runs each file's own
// version check, extracted as written, on the same inputs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The `case "$RUNWARD_VERSION" in … esac` block of a file, as the job runs it. */
function versionCheck(rel) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const start = text.indexOf('case "$RUNWARD_VERSION" in');
  assert.ok(start >= 0, `${rel} checks its version`);
  const end = text.indexOf("esac", start);
  return text.slice(start, end + 4).split("\n").map((l) => l.trim()).join("\n");
}

const CHECKS = [
  ["action.yml", "bash"],
  ["verify/action.yml", "bash"],
  ["templates/ci/gitlab/runward-gate.yml", "sh"],
];

const ACCEPTED = ["0.43.1", "10.0.12", "latest", "next"];
const REFUSED = ["1.0.0; anything", "1.0.0 && true", "1.0.0-rc.1", "1.0", "v1.0.0", "1.0.0\nlatest", "1.0.0\n", "", "1..0.0", "1.0.0.0"];

const bash = spawnSync("bash", ["-c", "exit 0"]).status === 0;

for (const [rel, shell] of CHECKS) {
  test(`version allowlist: ${rel} accepts x.y.z and the dist-tags, and refuses everything else`, { skip: !bash && "no bash on this host" }, () => {
    const script = versionCheck(rel);
    const run = (v) => spawnSync(shell === "sh" && process.platform !== "win32" ? "sh" : "bash", ["-c", script], { env: { ...process.env, RUNWARD_VERSION: v }, encoding: "utf8" }).status;
    for (const v of ACCEPTED) assert.equal(run(v), 0, `${rel} accepts ${JSON.stringify(v)}`);
    for (const v of REFUSED) assert.equal(run(v), 2, `${rel} refuses ${JSON.stringify(v)}`);
  });
}
