// Two defects of the shipped code, found on 2026-11-04 while instructing the survivors of the
// re-measure of evidence.js and mission.js, outside any mutant (RWD-2026-0189, RWD-2026-0190).
// Each was measured in both directions on an `init --example` mission before it was fixed; each
// test pins the mechanism, and carries its positive control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "cli.js");
const dirs = [];
test.after(() => { for (const d of dirs) { try { chmodSync(join(d, "code", "package.json"), 0o644); } catch {} rmSync(d, { recursive: true, force: true }); } });

function rw(cwd, ...args) {
  try { return { out: execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ""}${e.stderr ?? ""}`, code: e.status }; }
}

function example() {
  const d = mkdtempSync(join(tmpdir(), "rw-sentinel-"));
  dirs.push(d);
  assert.equal(rw(d, "init", "--example").code, 0);
  return d;
}

// chmod 000 does not make a file unreadable on Windows, nor for root.
const canUnread = process.platform !== "win32" && process.getuid?.() !== 0;

test("RWD-2026-0189: a lock that records the sentinel \"unreadable\" never reads intact over an unreadable file", { skip: !canUnread && "chmod cannot make a file unreadable here" }, () => {
  const d = example();
  assert.equal(rw(d, "check", "--strict", "--freeze").code, 0);
  const lockPath = join(d, "runward", "evidence-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.ok("code/package.json" in lock.files, "the example seals code/package.json");
  // Positive control: the real hash over an unreadable file is refused as a seal violation.
  chmodSync(join(d, "code", "package.json"), 0o000);
  const real = rw(d, "check", "--strict");
  assert.equal(real.code, 1);
  assert.match(real.out, /\(seal\) — sealed evidence changed: code\/package\.json/);
  // The defect: the sentinel written in the lock matched the sentinel the gate computed.
  lock.files["code/package.json"] = "unreadable";
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  const forged = rw(d, "check", "--strict");
  assert.equal(forged.code, 1);
  assert.doesNotMatch(forged.out, /seal intact/);
  assert.match(forged.out, /\(seal\) — sealed evidence changed: code\/package\.json/);
});

const COST = /^#{2,3} 5\. Cost ceilings\s*$/m;
const NO_NUMBER = "the cost ceilings carry no number";

function withCeilings(d, body) {
  const f = join(d, "runward", "governance", "observability-schema.md");
  const text = readFileSync(f, "utf8");
  const at = text.search(COST);
  assert.ok(at >= 0, "the example's observability schema has a Cost ceilings section");
  const heading = text.slice(at).split("\n")[0];
  const rest = text.slice(at + heading.length);
  const next = rest.search(/\n#{2,3} /);
  writeFileSync(f, text.slice(0, at) + heading + "\n\n" + body + "\n" + (next < 0 ? "" : rest.slice(next)));
}

test("RWD-2026-0190: a Cost ceilings section with no number is refused, its heading's digit aside", () => {
  const d = example();
  // Positive control: the example's own ceilings carry numbers and pass.
  assert.doesNotMatch(rw(d, "check", "--strict").out, new RegExp(NO_NUMBER));
  withCeilings(d, "Ceilings are set later, by feel.");
  const r = rw(d, "check", "--strict");
  assert.equal(r.code, 1);
  assert.match(r.out, new RegExp(NO_NUMBER));
  // A number in the body, or the template's bracketed placeholder, still passes the check.
  withCeilings(d, "Per request: 40000 tokens.");
  assert.doesNotMatch(rw(d, "check", "--strict").out, new RegExp(NO_NUMBER));
  withCeilings(d, "[the ceiling per request, in tokens]");
  assert.doesNotMatch(rw(d, "check", "--strict").out, new RegExp(NO_NUMBER));
});
