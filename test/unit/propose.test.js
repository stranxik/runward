// `runward propose` proposes on signature × territory, and nothing else (ADR-0066, P2).
//
// The command is the deterministic half of the entry-cost repair: it conveys evidence a machine
// can corroborate (a rule's declared signature matching inside its declared territory) into a
// status the gate REFUSES until a human ratifies. What it must never do is judge: a rule with a
// territory but no signature gets its files listed, never a status — proposing on resemblance
// would fabricate the judge (ADR-0001). And it must never touch a row that carries any status:
// idempotence is the ADR-0038 non-resurrection precedent, one grammar over.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

/** A bare mission with scaffolded rows, and one project file inside config-secrets-boundary's
 *  declared territory whose content matches its signature (/secret|vault/ — case-sensitive,
 *  which the first manual probe of this command learned the hard way). */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "rw-propose-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init");
  run(dir, "manifest", "--sync");
  mkdirSync(join(dir, "code", "config"), { recursive: true });
  writeFileSync(join(dir, "code", "config", "settings.ts"),
    "export const key = process.env.vault_secret; // the vault owns it\n");
  return dir;
}
const floorOf = (dir) => readFileSync(join(dir, "runward", "floor.md"), "utf8");

test("a signature matching inside its territory becomes proposed:applied with the found pointer", () => {
  const dir = fixture();
  try {
    const { out } = run(dir, "propose");
    assert.match(out, /config-secrets-boundary — proposed:applied · file:code\/config\/settings\.ts/,
      "the corroborated row is proposed with the pointer the search found");
    assert.match(floorOf(dir),
      /\| config-secrets-boundary \| proposed:applied \| file:code\/config\/settings\.ts ; proposer: runward propose v[\d.]+ \(signature matched\) \|/,
      "the written row carries the proposal, the pointer, and the DECLARED proposer");
    const { code, out: check } = run(dir, "check", "--strict");
    assert.equal(code, 1, "a proposal never crosses");
    assert.match(check, /config-secrets-boundary — proposed:applied awaits ratification/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("propose never judges: no signature means listed, never a status; no match means left empty", () => {
  const dir = fixture();
  try {
    const { out } = run(dir, "propose");
    assert.match(out, /hexa-adapter-pattern[^\n]*; no signature, nothing proposed/,
      "a territory without a signature is listed for the human, never proposed");
    assert.ok(!/\| hexa-adapter-pattern \| proposed/.test(floorOf(dir)),
      "and nothing was written for it");
    // async-job-guardrails is signed with a territory (jobs/workers/queue…) that matches no file
    // in this fixture: it must be reported as searched-and-not-found, and left empty.
    assert.match(out, /async-job-guardrails[^\n]*signature \/[^/]+\/ not found in any/,
      "signed + territory + no match is its own honest sentence");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("propose is idempotent and never touches a decided row", () => {
  const dir = fixture();
  try {
    // decide one row by hand first
    const p = join(dir, "runward", "floor.md");
    writeFileSync(p, readFileSync(p, "utf8").replace(
      "| frontier-deterministic-boundary |  |  |",
      "| frontier-deterministic-boundary | n/a | decided by hand before propose ran |"));
    run(dir, "propose");
    const once = floorOf(dir);
    assert.match(once, /\| frontier-deterministic-boundary \| n\/a \| decided by hand before propose ran \|/,
      "a decided row is never touched (ADR-0038 precedent)");
    const { out } = run(dir, "propose");
    assert.match(out, /0 row\(s\) proposed/, "a second run proposes nothing");
    assert.equal(floorOf(dir), once, "and rewrites nothing — byte-idempotent");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("same tree, same proposal — the search is deterministic", () => {
  const a = fixture(); const b = fixture();
  try {
    run(a, "propose"); run(b, "propose");
    assert.equal(floorOf(a), floorOf(b),
      "two identical trees must produce byte-identical proposals (sorted walk, first match)");
  } finally { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); }
});
