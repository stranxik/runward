// obj 9 (ADR-0057): a shared corpus is pinned without a registry — the in-repo core.
//
// runward RESOLVES a vendored committed corpus (rulesDir, unchanged), COMPARES/EMITS its in-tree
// version stamp (corpus.json → check --json `corpusPin`, advisory), and SURFACES the corpus's own
// migration records (runward/rules/migrations.json merged with the built-in RULE_MIGRATIONS). Every
// read below is pure node:fs of an in-tree file — no node_modules, no lockfile, no socket. The
// full no-fetch invariant is the `unshare -n` CI step named in ADR-0057's ratification; these unit
// tests pin the readers and the merge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadOrgMigrations, ruleMigrations } from "../../dist/lib/rule-migrations.js";
import { corpusStamp } from "../../dist/lib/rules.js";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const tmp = () => mkdtempSync(join(tmpdir(), "rw-corpus-"));

const REFERENCE = tmp();
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });
function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-corpus-m-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), rules: join(dir, "runward", "rules"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}

test("obj 9: loadOrgMigrations reads well-formed records and drops malformed ones", () => {
  const dir = tmp();
  writeFileSync(join(dir, "migrations.json"), JSON.stringify({
    "old-a": { to: "new-a", reason: "renamed", since: "2.0.0" },
    "old-b": { reason: "removed", since: "2.1.0" },   // a removal (no `to`)
    "bad-to": { to: 5, reason: "x", since: "1" },      // non-string `to` → dropped
    "no-since": { reason: "x" },                        // missing `since` → dropped
  }));
  const m = loadOrgMigrations(dir);
  assert.deepEqual(m["old-a"], { reason: "renamed", since: "2.0.0", to: "new-a" });
  assert.deepEqual(m["old-b"], { reason: "removed", since: "2.1.0" });
  assert.ok(!("bad-to" in m) && !("no-since" in m), "a malformed org record must never corrupt the guidance");
  rmSync(dir, { recursive: true, force: true });
});

test("obj 9: an absent, unparseable, or non-object migrations.json yields {} — never a crash", () => {
  const dir = tmp();
  assert.deepEqual(loadOrgMigrations(dir), {}, "absent → {}");
  writeFileSync(join(dir, "migrations.json"), "not json"); assert.deepEqual(loadOrgMigrations(dir), {}, "malformed → {}");
  writeFileSync(join(dir, "migrations.json"), "[1,2,3]"); assert.deepEqual(loadOrgMigrations(dir), {}, "an array is not a map");
  rmSync(dir, { recursive: true, force: true });
});

test("obj 9: ruleMigrations merges built-in and org; the org record wins a collision", () => {
  const dir = tmp();
  writeFileSync(join(dir, "migrations.json"), JSON.stringify({ "org-only": { to: "x", reason: "r", since: "2" } }));
  const m = ruleMigrations(dir);
  assert.ok("hexa-llm-boundary-principle" in m, "the built-in migration is kept");
  assert.ok("org-only" in m, "the org migration is merged");
  writeFileSync(join(dir, "migrations.json"), JSON.stringify({ "hexa-llm-boundary-principle": { to: "org-wins", reason: "r", since: "2" } }));
  assert.equal(ruleMigrations(dir)["hexa-llm-boundary-principle"].to, "org-wins", "a collision resolves to the org's record — it is about the mission's own corpus");
  rmSync(dir, { recursive: true, force: true });
});

test("obj 9: corpusStamp reads corpus.json {name,version}, and is null otherwise", () => {
  const dir = tmp();
  assert.equal(corpusStamp(dir), null, "absent → null");
  writeFileSync(join(dir, "corpus.json"), JSON.stringify({ name: "@acme/rules", version: "2.1.0" }));
  assert.deepEqual(corpusStamp(dir), { name: "@acme/rules", version: "2.1.0" });
  writeFileSync(join(dir, "corpus.json"), "not json"); assert.equal(corpusStamp(dir), null, "malformed → null, never a crash");
  writeFileSync(join(dir, "corpus.json"), JSON.stringify({ name: "x" })); assert.equal(corpusStamp(dir), null, "missing version → null");
  rmSync(dir, { recursive: true, force: true });
});

test("obj 9: a manifest row citing a renamed ORG slug is guided at the gate, not left to guess", () => {
  const m = mission();
  writeFileSync(join(m.rules, "migrations.json"), JSON.stringify({ "old-org-rule": { to: "new-org-rule", reason: "org renamed it", since: "2.0.0" } }));
  const arch = join(m.mission, "architecture.md");
  const c = readFileSync(arch, "utf8").replace(/(\| ?rule ?\| ?status ?\| ?evidence ?\|\n\|[-| ]+\|\n)/i, "$1| old-org-rule | n/a | placeholder |\n");
  assert.notEqual(c, readFileSync(arch, "utf8"), "the fixture row must really be added");
  writeFileSync(arch, c);
  const viol = computeVerdict(m.mission, { strict: true }).gated.flatMap((g) => g.violations).find((x) => x.rule === "old-org-rule");
  assert.ok(viol, "the unknown org slug is flagged");
  assert.match(viol.problem, /renamed to 'new-org-rule' in 2\.0\.0/, "and guided by the org's own migration record");
  m.drop();
});

test("obj 9: check --json emits corpusPin from corpus.json; a mission with no stamp carries null", () => {
  const m = mission();
  writeFileSync(join(m.rules, "corpus.json"), JSON.stringify({ name: "@acme/rules", version: "2.1.0" }));
  const withPin = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", "."], { cwd: m.dir, encoding: "utf8" }));
  assert.equal(withPin.exitCode, 0, "the stamp is advisory — it does not gate");
  assert.deepEqual(withPin.corpusPin, { name: "@acme/rules", version: "2.1.0" });
  m.drop();
  const plain = mission();
  const noPin = JSON.parse(execFileSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", "."], { cwd: plain.dir, encoding: "utf8" }));
  assert.equal(noPin.corpusPin, null, "no stamp → null; additive, the reference mission is unaffected");
  plain.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
