// ADR-0124 decision 4: the seal covers the decisions the manifests name.
//
// Case g4 of the 2026-11-05 saboteur corpus, and its variant g6 written on 2026-11-06: the example's
// ADR-0002, which its manifests name in prose, in a table and by a link but never through `adr:`, was
// outside the lock, so a stub (g4) or a well-formed record that reverses the decision (g6) replaced it
// under an intact seal. `check --freeze` now seals every ADR a gated manifest names by its id. The
// acceptances that bound it: an ADR nobody names is not sealed, and a lock written before keeps
// verifying exactly the keys it lists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectSealableEvidence } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });
const ADR2 = "runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md";

// A well-formed record that reverses the decision: dated, accepted, a trigger. Only a baseline sees it.
const REVERSED = "# ADR-0002: no guard on model-extracted fields\n\n**Date**: 2026-05-12\n**Status**: accepted\n" +
  "**Deciders**: operator\n\n## Context\n\nThe model is reliable enough on the replayed set.\n\n## Decision\n\n" +
  "Model-proposed values are routed as proposed; no deterministic guard runs before RoutingPort.\n\n" +
  "## Reevaluation trigger (mandatory, dated)\n\nReopen if the misrouting rate exceeds 5% on the weekly review, set on 2026-05-12.\n";

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-seal-named-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
  return dir;
}

test("an ADR a manifest names only in prose and tables is sealed; one nobody names is not", () => {
  const dir = example();
  try {
    const keys = Object.keys(collectSealableEvidence(join(dir, "runward")));
    assert.ok(keys.includes(ADR2), "the example names ADR-0002 in its rows and its decision table, never through adr:");
    writeFileSync(join(dir, "runward", "adr", "ADR-0099-a-decision-nobody-names.md"),
      "# ADR-0099: a decision nobody names\n\n**Date**: 2026-11-06\n**Status**: accepted\n\n## Context\n\nNo manifest cites it.\n\n" +
      "## Reevaluation trigger (mandatory, dated)\n\nReopen when a manifest names it, set on 2026-11-06.\n");
    assert.ok(!Object.keys(collectSealableEvidence(join(dir, "runward"))).some((k) => k.includes("ADR-0099")),
      "the seal does not invent a claim: an ADR no manifest names stays outside it");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("end to end: a named decision rewritten after the seal is refused, the seal intact before", () => {
  const dir = example();
  try {
    const sealed = check(dir, "--strict", "--freeze");
    assert.equal(sealed.status, 0, sealed.stdout);
    const lock = JSON.parse(readFileSync(join(dir, "runward", "evidence-lock.json"), "utf8"));
    assert.ok(ADR2 in lock.files, "the lock holds the named decision");
    assert.equal(check(dir, "--strict").status, 0, "positive control: nothing moved, the seal is intact");
    writeFileSync(join(dir, ADR2), REVERSED);
    const r = check(dir, "--strict");
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /sealed evidence changed: runward\/adr\/ADR-0002-deterministic-guard-on-extracted-fields\.md/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a lock written before keeps verifying exactly the keys it lists; the next freeze widens", () => {
  const dir = example();
  try {
    assert.equal(check(dir, "--strict", "--freeze").status, 0);
    const lockPath = join(dir, "runward", "evidence-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    delete lock.files[ADR2]; // the lock an earlier runward wrote, without the named decision
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    assert.equal(check(dir, "--strict").status, 0, "an earlier lock does not turn red for what it never sealed");
    writeFileSync(join(dir, ADR2), REVERSED);
    assert.equal(check(dir, "--strict").status, 0, "and it does not see what it never sealed: the boundary of an old lock");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
