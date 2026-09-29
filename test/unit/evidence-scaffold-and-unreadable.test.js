// The evidence layer, called directly, on the refusals the mutation measure of 2026-09-28 (release
// 0.42.3) found unwatched: the template's own cell carries its kind; a bare path to a file still
// byte-identical to runward's scaffold is refused like a typed one (RWD-2026-0144); a file outside the
// project is never "runward's scaffold", whatever a lock line claims; a cited file the gate cannot
// read is refused rather than taken as read; and a sealed file that became unreadable is reported as
// changed instead of crashing the seal. The gate's own tests reached most of these through
// `check --strict` in a child process, where no mutant is active.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceReport, verifyEvidenceLock, normalizedFileSha256, EVIDENCE_LOCK } from "../../dist/lib/evidence.js";
import { hashText } from "../../dist/lib/scaffold-lock.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AS_ROOT = process.getuid?.() === 0;
// chmod 000 does not make a file unreadable on Windows: the case cannot be built there.
const NO_CHMOD = process.platform === "win32";
const manifest = (rows) => ["# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|", ...rows, ""].join("\n");

function project(rows, lockFiles) {
  const root = mkdtempSync(join(tmpdir(), "rw-ev-scaffold-"));
  const mission = join(root, "runward");
  mkdirSync(mission);
  writeFileSync(join(mission, "floor.md"), manifest(rows));
  if (lockFiles) writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify({ version: 1, writtenBy: "t", files: lockFiles }));
  return { root, mission };
}

test("the template's own evidence cell is refused under its own kind", () => {
  const { root, mission } = project(["| r-a | applied | [file:line, a test, ADR-id, or a reason] |"]);
  try {
    assert.deepEqual(evidenceReport(mission, "floor.md", {}).map((v) => [v.rule, v.kind]), [["r-a", "evidence-placeholder"]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a bare path to the untouched charter template is refused like a typed pointer, and a written one is not", () => {
  const { root, mission } = project(["| r-a | applied | the charter in AGENTS.md says so |"]);
  try {
    const tpl = readFileSync(join(ROOT, "templates", "targets", "AGENTS.md"), "utf8");
    writeFileSync(join(root, "AGENTS.md"), tpl);
    const refused = evidenceReport(mission, "floor.md", {});
    assert.equal(refused.length, 1);
    assert.equal(refused[0].rule, "r-a");
    assert.match(refused[0].problem, /AGENTS\.md, which is still the file runward scaffolded/);
    writeFileSync(join(root, "AGENTS.md"), tpl + "\n## Mission boundaries\nNever write to the registry.\n");
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), [], "the operator wrote it: it is theirs");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a file outside the project is never runward's scaffold, whatever a lock line claims", () => {
  const top = mkdtempSync(join(tmpdir(), "rw-ev-outside-"));
  try {
    execFileSync("git", ["init", "-q", top]);
    mkdirSync(join(top, "shared"));
    mkdirSync(join(top, "app", "runward"), { recursive: true });
    const body = "the shared design, written by this organisation\n";
    writeFileSync(join(top, "shared", "doc.md"), body);
    symlinkSync(join(top, "shared", "doc.md"), join(top, "app", "design.md"));
    const mission = join(top, "app", "runward");
    writeFileSync(join(mission, "scaffold-lock.json"),
      JSON.stringify({ version: 1, writtenBy: "t", files: { "../shared/doc.md": hashText(body) } }));
    writeFileSync(join(mission, "floor.md"), manifest(["| r-a | applied | design.md |", "| r-b | applied | file:design.md |"]));
    assert.deepEqual(evidenceReport(mission, "floor.md", {}), []);
  } finally { rmSync(top, { recursive: true, force: true }); }
});

test("a cited file the gate cannot read is refused, never taken as read", { skip: NO_CHMOD ? "chmod has no effect on Windows" : AS_ROOT ? "root reads everything" : false }, () => {
  const { root, mission } = project(["| r-a | applied | see src/locked.ts for the boundary |"]);
  const locked = join(root, "src", "locked.ts");
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(locked, "export const boundary = 1;\n");
    chmodSync(locked, 0o000);
    const out = evidenceReport(mission, "floor.md", {});
    assert.equal(out.length, 1);
    assert.equal(out[0].rule, "r-a");
    assert.match(out[0].problem, /a file the gate cannot read: src\/locked\.ts \(EACCES\)/);
  } finally { try { chmodSync(locked, 0o600); } catch { /* not created */ } rmSync(root, { recursive: true, force: true }); }
});

test("a sealed file that became unreadable is a changed seal, not a crash", { skip: NO_CHMOD ? "chmod has no effect on Windows" : AS_ROOT ? "root reads everything" : false }, () => {
  const { root, mission } = project([]);
  const f = join(root, "src", "a.ts");
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(f, "export const a = 1;\n");
    writeFileSync(join(mission, EVIDENCE_LOCK),
      JSON.stringify({ version: 1, sealedAt: "2026-09-28", files: { "src/a.ts": normalizedFileSha256(f) } }));
    assert.deepEqual(verifyEvidenceLock(mission).violations, [], "sealed and intact first");
    chmodSync(f, 0o000);
    const v = verifyEvidenceLock(mission);
    assert.deepEqual(v.violations.map((x) => x.rule), ["(seal)"]);
    assert.match(v.violations[0].problem, /sealed evidence changed: src\/a\.ts/);
  } finally { try { chmodSync(f, 0o600); } catch { /* not created */ } rmSync(root, { recursive: true, force: true }); }
});
