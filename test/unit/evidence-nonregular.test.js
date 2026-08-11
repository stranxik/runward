// The read gate: what `evidenceReport` agrees to OPEN.
//
// `if (!isRegularFile(abs))` sits between a pointer that resolved and the `readFileSync` that reads
// it. The full mutation pass of 2026-08-05 kept `→ false` alive against the whole net (mutant 1063,
// still alive against the 346-test suite of 2026-08-08), and the obvious reading is that the guard
// is redundant: a pointer at a DIRECTORY is caught one line later, because `readFileSync` throws
// EISDIR and the catch emits its own violation. Measured, and true — the verdict does not move:
//
//   sane   : `typed pointer resolves to a directory, not a file: file:code/src`
//   mutated: `typed pointer file:code/src — cannot be read (EISDIR): the gate has no verdict …`
//   `runward check --strict` on a real mission: exit 1 and 2 strict gaps, both ways.
//
// That second mechanism only covers the inputs whose read FAILS. It covers nothing where the read
// BLOCKS. A named pipe inside the repository — a log a service writes to, cited as evidence — is
// not a regular file and has no writer at gate time, so `readFileSync` waits for one forever.
// Measured on the same fixture: the sane gate refuses in milliseconds; with the guard removed the
// call never returns, and `check` produces no verdict at all. A gate that hangs is not a soft
// failure of a gate that refuses — it is the absence of the verdict the whole tool exists to give.
//
// So the case below is the FIFO, not the directory: the directory is already held twice. The child
// process is not decoration — a synchronous block starves the event loop, so `node:test`'s own
// timeout can never fire, and the assertion has to be made from outside the process under test.
//
// Both directions, as everywhere in this suite: a non-regular file is refused, and a REGULAR file
// at the very same path is read and accepted — a guard that refused everything would satisfy a
// one-sided fixture just as well as a working one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVIDENCE = pathToFileURL(join(ROOT, "dist", "lib", "evidence.js")).href;
// Generous on purpose: this deadline exists to catch a call that never returns, not a slow one.
const DEADLINE_MS = 8000;

// A mission inside a project root, the way `runward/` sits beside the code in a real repository.
function scaffold() {
  const root = mkdtempSync(join(tmpdir(), "rw-nonregular-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  writeFileSync(join(mission, "floor.md"),
    `## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| r-pipe | applied | file:service.log |\n`);
  return { root, mission };
}

// Run `evidenceReport` in a child so a synchronous block is observable instead of fatal.
// Returns the violation count, or null when the child had to be killed at the deadline.
function countOrHang(mission) {
  const src = `import { evidenceReport } from ${JSON.stringify(EVIDENCE)};`
    + `process.stdout.write(String(evidenceReport(${JSON.stringify(mission)}, "floor.md", {}).length));`;
  try {
    return Number(execFileSync(process.execPath, ["--input-type=module", "-e", src],
      { timeout: DEADLINE_MS, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (e) {
    if (e.killed || e.signal) return null; // the deadline fired: the gate never returned
    throw e;
  }
}

test("a pointer at a file that is not regular is refused before it is read, and one that is regular is read", { skip: process.platform === "win32" ? "POSIX fifo" : false }, () => {
  const { root, mission } = scaffold();
  try {
    // Direction 1 — the guard must FIRE. A named pipe with no writer: `readFileSync` blocks on it
    // forever, so nothing downstream can turn this into a violation. Only refusing before the read
    // does.
    execFileSync("mkfifo", [join(root, "service.log")]);
    const refused = countOrHang(mission);
    assert.notEqual(refused, null, "the gate must return a verdict on a named pipe, not block on it");
    assert.equal(refused, 1, "a pointer at something that is not a regular file is one violation");

    // Direction 2 — the guard must NOT fire on everything. Same mission, same pointer, same path:
    // only the inode changes. A guard that refused every pointer would pass direction 1 alone.
    unlinkSync(join(root, "service.log"));
    writeFileSync(join(root, "service.log"), "triage request accepted — routed to the deterministic adapter\n");
    assert.equal(countOrHang(mission), 0, "a regular, non-empty file it can open is evidence, and is accepted");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
