// obj 9 (ADR-0057): the vendored corpus is pinned WITHOUT a registry — resolved from committed bytes.
//
// This is the no-fetch invariant, executable. It vendors an org corpus into a mission via
// `update --corpus <path>` (a filesystem PATH, never a coordinate), then RESOLVES and REPORTS against
// it — check --strict, rules --json, the advisory drift — with nothing but local bytes. Every read is
// node:fs of an in-tree file; the only child processes are the CLI itself (local). CI runs THIS file
// under `sudo unshare -n` (.github/workflows/ci.yml): with the network cut, any socket attempt fails
// the job, so a green run is a STRUCTURAL proof that resolution never fetched — not a grep of src/.
// regulated-posture.test.js asserts that CI step is present, so the guard cannot be silently removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const PKG_RULES = join(ROOT, "templates", "rules");

// A vendored org corpus = the package rules VERBATIM (so the example mission stays strict-green
// against them) + the corpus's own self-description + its own migration records. The point is not
// what the rules say; it is that the whole thing resolves from disk with no wire anywhere.
function makeCorpus(version = "2.1.0") {
  const dir = mkdtempSync(join(tmpdir(), "rw-org-corpus-"));
  for (const f of readdirSync(PKG_RULES).filter((f) => f.endsWith(".md"))) cpSync(join(PKG_RULES, f), join(dir, f));
  writeFileSync(join(dir, "corpus.json"), JSON.stringify({ name: "@acme/rules", version }));
  writeFileSync(join(dir, "migrations.json"), JSON.stringify({ "old-house-rule": { to: "house-rule", reason: "renamed on our line", since: "2.0.0" } }));
  return dir;
}

function exampleMission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-nofetch-"));
  execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: dir, stdio: "pipe" });
  return dir;
}

// Capture stdout even when the gate reddens (exit 1) — the machine payload is on stdout regardless.
const run = (dir, args) => {
  try { return { code: 0, stdout: execFileSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8" }), stderr: "" }; }
  catch (e) { return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" }; }
};

test("obj 9: a vendored corpus resolves from local bytes — no fetch, no registry, no node_modules", () => {
  const mission = exampleMission();
  const corpus = makeCorpus("2.1.0");
  // Vendor via the path flag (also exercises `update --corpus`); the org corpus is now committed bytes.
  execFileSync(process.execPath, [CLI, "update", "--corpus", corpus], { cwd: mission, stdio: "pipe" });
  const rules = join(mission, "runward", "rules");
  assert.ok(existsSync(join(rules, "corpus.json")) && existsSync(join(rules, "migrations.json")), "corpus.json + migrations.json vendored in-tree");
  const lock = JSON.parse(readFileSync(join(mission, "runward", "scaffold-lock.json"), "utf8"));
  assert.deepEqual(lock.corpus, { name: "@acme/rules", version: "2.1.0" }, "the pin is recorded in the scaffold-lock");

  // RESOLVE + REPORT from local bytes only.
  const chk = run(mission, ["check", "--strict", "--json"]);
  assert.equal(chk.code, 0, "check --strict resolves the vendored corpus and exits 0");
  const j = JSON.parse(chk.stdout);
  assert.deepEqual(j.corpusPin, { name: "@acme/rules", version: "2.1.0" }, "check emits the resolved corpus pin");
  assert.equal(j.corpusDrift, null, "aligned pin ⇒ no drift");
  assert.equal(j.corpus.status, "verifiable", "the local corpus is verified against the shipped package, never a remote");

  const rj = JSON.parse(run(mission, ["rules", "--json"]).stdout);
  assert.equal(rj.source, "mission", "rules resolve from the mission's vendored copy, not the package");
  assert.ok(rj.count >= 60, "the full vendored set resolves");

  rmSync(mission, { recursive: true, force: true });
  rmSync(corpus, { recursive: true, force: true });
});

test("obj 9: version drift is ADVISORY — reported, never gated", () => {
  const mission = exampleMission();
  const corpus = makeCorpus("2.1.0");
  execFileSync(process.execPath, [CLI, "update", "--corpus", corpus], { cwd: mission, stdio: "pipe" });
  const before = run(mission, ["check", "--strict", "--json"]);
  // Bump the in-tree corpus.json WITHOUT re-vendoring: the pin (2.1.0) and the bytes (2.2.0) diverge.
  writeFileSync(join(mission, "runward", "rules", "corpus.json"), JSON.stringify({ name: "@acme/rules", version: "2.2.0" }));
  const after = run(mission, ["check", "--strict", "--json"]);
  assert.equal(before.code, 0);
  assert.equal(after.code, 0, "the exit code is byte-identical across the drift — the drift never gates");
  const jb = JSON.parse(before.stdout), ja = JSON.parse(after.stdout);
  assert.equal(jb.verdict, ja.verdict, "the verdict is unchanged by the drift");
  assert.equal(jb.corpusDrift, null, "aligned ⇒ null");
  assert.deepEqual(ja.corpusDrift, { pinned: { name: "@acme/rules", version: "2.1.0" }, onDisk: { name: "@acme/rules", version: "2.2.0" } }, "drift is surfaced, both stamps named");

  rmSync(mission, { recursive: true, force: true });
  rmSync(corpus, { recursive: true, force: true });
});

test("obj 9: negative control — a rule the corpus does not hold fails LOUD, never a silent fetch", () => {
  const mission = exampleMission();
  const corpus = makeCorpus("2.1.0");
  execFileSync(process.execPath, [CLI, "update", "--corpus", corpus], { cwd: mission, stdio: "pipe" });
  const rules = join(mission, "runward", "rules");
  // Delete a shipped+recorded rule. runward does NOT reach out to fetch it — the authority is the
  // installed package, present; the rule is reported missing, and the gate reddens. "Could only be
  // resolved by a fetch" fails loud, it never silently passes.
  const victim = readdirSync(PKG_RULES).filter((f) => f.endsWith(".md"))[0];
  unlinkSync(join(rules, victim));
  const chk = run(mission, ["check", "--strict", "--json"]);
  assert.equal(chk.code, 1, "a corpus that no longer holds a shipped rule fails loud (never a silent pass)");
  const j = JSON.parse(chk.stdout);
  assert.ok(j.corpus.missing.includes(victim), `the missing rule ${victim} is named — resolved locally, never fetched`);

  rmSync(mission, { recursive: true, force: true });
  rmSync(corpus, { recursive: true, force: true });
});
