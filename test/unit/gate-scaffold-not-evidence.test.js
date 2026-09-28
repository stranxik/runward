// `check --strict` accepted `handover-agents-charter-final | applied | file:AGENTS.md#Never` when
// AGENTS.md was the blank charter `init` writes: its text holds "--strict" and "Never" by
// construction, so the signature matched runward's own template (RWD-2026-0144). The same cut
// `propose` makes (RWD-2026-0142) now holds in the gate: a file byte-identical to what runward
// scaffolded is not evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-28" };
const run = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-gate-scaffold-"));
  assert.equal(run(dir, "--yes", "init", "--example").status, 0);
  return dir;
}

test("gate scaffold: the finalized example charter still crosses check --strict", () => {
  const dir = example();
  try {
    const r = run(dir, "check", "--strict");
    assert.equal(r.status, 0, r.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("gate scaffold: an applied row citing the untouched blank AGENTS.md is refused, and says why", () => {
  const dir = example();
  try {
    writeFileSync(join(dir, "AGENTS.md"), readFileSync(join(ROOT, "templates", "targets", "AGENTS.md"), "utf8"));
    const r = run(dir, "check", "--strict");
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /handover-agents-charter-final — typed pointer file:AGENTS\.md#Never is still the file runward scaffolded, byte for byte/);
    const j = JSON.parse(run(dir, "check", "--strict", "--json").stdout);
    assert.ok(j.conformance.some((c) => c.rule === "handover-agents-charter-final" && /still the file runward scaffolded/.test(c.problem)));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("gate scaffold: CRLF does not hide the template, a written charter does", () => {
  const dir = example();
  try {
    const tpl = readFileSync(join(ROOT, "templates", "targets", "AGENTS.md"), "utf8");
    writeFileSync(join(dir, "AGENTS.md"), tpl.replace(/\n/g, "\r\n"));
    assert.equal(run(dir, "check", "--strict").status, 1, "line endings are not content");
    writeFileSync(join(dir, "AGENTS.md"), tpl + "\n## Mission boundaries\nNever write to the registry.\n");
    assert.equal(run(dir, "check", "--strict").status, 0, "the operator wrote the charter: it is theirs");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
