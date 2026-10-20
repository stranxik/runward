// RWD-2026-0180: the behavioral proof's freshness assumed the code lived under `code/`.
//
// `check --strict` prints, for a declared `Proof artifact`, whether it is newer than the sources.
// Until this fix the sources were looked for under `<root>/code/` only, with seven extensions: a
// mission whose code lives under `app/` (an adopter's layout, `Behavioral proof: cd app && npm test`)
// got the artifact line with no freshness at all, and nothing said that freshness had not been
// computed. Measured on main dbcbc7a. The fix derives the source root from the command (`cd X`), then
// the legacy `code/`, then the artifact's top-level directory, and says so when none is found.
// Advisory only: nothing here reaches the verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { behavioralProof, proofSourceRoot } from "../../dist/lib/behavioral-proof.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "cli.js");
const T = { old: 946_684_800, mid: 1_600_000_000, recent: 1_750_000_000 };
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** A root with runward/floor.md declaring `command` and `artifact`, and files stamped at stated times. */
function root(command, artifact, files) {
  const d = mkdtempSync(join(tmpdir(), "rw-bp-"));
  dirs.push(d);
  const lines = [command && `**Behavioral proof**: \`${command}\``, artifact && `**Proof artifact**: \`${artifact}\``].filter(Boolean);
  mkdirSync(join(d, "runward"), { recursive: true });
  writeFileSync(join(d, "runward", "floor.md"), `# Floor\n\n${lines.join("\n")}\n`);
  for (const [rel, when] of Object.entries(files)) {
    mkdirSync(dirname(join(d, rel)), { recursive: true });
    writeFileSync(join(d, rel), "x\n");
    utimesSync(join(d, rel), when, when);
  }
  return d;
}
const bp = (d) => behavioralProof(join(d, "runward"), d);

test("RWD-2026-0180 positive control: the adopter's layout, code under app/, an artifact older than it", () => {
  const d = root("cd app && npm test", "app/reports/junit.xml", { "app/src/a.ts": T.recent, "app/reports/junit.xml": T.mid });
  const got = bp(d);
  assert.equal(got.sourceRoot, "app", "the source root is the directory the command enters");
  assert.equal(got.fresh, false, "a proof older than the code under app/ is stale — it read as nothing before the fix");
  assert.equal(got.freshnessNotComputed, undefined);
});

test("RWD-2026-0180: the proof newer than every source is fresh, against the root the command names", () => {
  const d = root("cd app && npm test", "app/reports/junit.xml", { "app/src/a.ts": T.mid, "app/reports/junit.xml": T.recent });
  assert.deepEqual([bp(d).sourceRoot, bp(d).fresh], ["app", true]);
});

test("RWD-2026-0180: the legacy code/ layout still reads as before", () => {
  const d = root("npm test", "reports/junit.xml", { "code/src/a.ts": T.recent, "reports/junit.xml": T.mid });
  assert.deepEqual([bp(d).sourceRoot, bp(d).fresh], ["code", false]);
});

test("RWD-2026-0180: with no cd and no code/, the artifact's top-level directory is the root", () => {
  const d = root("make test", "svc/out/junit.xml", { "svc/main.go": T.recent, "svc/out/junit.xml": T.mid });
  assert.deepEqual([bp(d).sourceRoot, bp(d).fresh], ["svc", false]);
});

test("RWD-2026-0180: no root found is stated, never silent", () => {
  const d = root("npm test", "junit.xml", { "junit.xml": T.mid, "lib/a.ts": T.recent });
  const got = bp(d);
  assert.equal(got.fresh, undefined);
  assert.equal(got.freshnessNotComputed, "no source root found");
  const e = root("cd app && npm test", "app/junit.xml", { "app/junit.xml": T.mid, "app/README.md": T.recent });
  assert.equal(bp(e).freshnessNotComputed, "no source file under app/", "a root holding no source file is said too");
});

test("RWD-2026-0180: a cd outside the judged tree is never followed", () => {
  for (const cmd of ["cd .. && npm test", "cd /etc && make", "cd ~/x && make", "cd a/../.. && make"]) {
    assert.equal(proofSourceRoot(tmpdir(), cmd, undefined), undefined, cmd);
  }
  const d = root("cd 'my app' && npm test", "my app/junit.xml", { "my app/x.py": T.recent, "my app/junit.xml": T.mid });
  assert.equal(bp(d).sourceRoot, "my app", "a quoted directory is read whole");
});

test("RWD-2026-0180: more languages count as sources, and a non-source never does", () => {
  for (const f of ["a.mjs", "a.kt", "a.cs", "a.php", "a.swift", "a.c"]) {
    const d = root("cd app && make", "app/junit.xml", { [`app/${f}`]: T.recent, "app/junit.xml": T.mid });
    assert.equal(bp(d).fresh, false, f);
  }
  const d = root("cd app && make", "app/junit.xml", { "app/package-lock.json": T.recent, "app/x.ts": T.old, "app/junit.xml": T.mid });
  assert.equal(bp(d).fresh, true, "a lockfile written after the proof does not make it stale");
});

/** init --example with its floor's proof lines replaced, then `check --strict`'s stdout. */
function exampleCheck(lines) {
  const d = mkdtempSync(join(tmpdir(), "rw-bp-cli-"));
  dirs.push(d);
  execFileSync(process.execPath, [CLI, "init", "--example"], { cwd: d, stdio: "pipe" });
  const floor = join(d, "runward", "floor.md");
  writeFileSync(floor, readFileSync(floor, "utf8").replace("**Behavioral proof**: `cd code && npm test`", lines));
  try { return execFileSync(process.execPath, [CLI, "check", "--strict"], { cwd: d, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }); }
  catch (e) { return `exit ${e.status}\n${e.stdout}`; }
}

test("RWD-2026-0180: check --strict names the source root and labels the date UTC", () => {
  const out = exampleCheck("**Behavioral proof**: `cd code && npm test`\n**Proof artifact**: `code/reports/junit.xml`");
  assert.match(out, /proof artifact code\/reports\/junit\.xml \(modified \d{4}-\d{2}-\d{2} UTC\) · (fresh \(newer than|stale \(older than) the sources under code\//);
});

test("RWD-2026-0180: check --strict says when freshness could not be computed", () => {
  const out = exampleCheck("**Behavioral proof**: `cd runward && true`\n**Proof artifact**: `code/reports/junit.xml`");
  assert.match(out, /proof artifact code\/reports\/junit\.xml \(modified \d{4}-\d{2}-\d{2} UTC\) · freshness not computed \(no source file under runward\/\)/);
});
