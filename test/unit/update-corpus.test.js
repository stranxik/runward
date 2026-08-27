// `update --corpus` is the gesture ADR-0057 exists for: an organisation brings its own rule corpus.
// On the shipped 0.36.2 it was broken in BOTH directions, and both were measured on 2026-08-26.
//
// IT BRICKED A GREEN MISSION. `nextFiles` was built from `readdirSync(srcDir)`, and with --corpus
// that source is the org's directory — so every rule runward wrote and the corpus does not carry
// fell out of the lock while its FILE stayed exactly where it was. `scaffold-lock.ts` derives
// "known" from the lock, so each one became `extra`. Vendoring a one-rule house corpus onto a green
// example mission dropped the lock from 64 entries to 1 and made `check --strict` refuse 31 rules
// runward had scaffolded seconds earlier, accusing the operator of authoring them — while `update`
// reported success. The documented adoption path bricked the gate in one command.
//
// AND IT HID A FORK. A same-slug replacement of a rule runward ships was classified `upstream`
// (pristine locally, source moved) and written with the word runward uses for its OWN refreshes.
// Vendoring a fork of runward's corpus with one `signature:` line deleted takes a mission from
// exit 1 to exit 0, and nothing in the terminal said a CRITICAL rule had been substituted.
//
// The gate going green there is the organisation's right; the silence was not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const CLI = join(process.cwd(), "dist/cli.js");
const PACKAGED = join(process.cwd(), "templates/rules");

const run = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
const lockRules = (root) => {
  const j = JSON.parse(readFileSync(join(root, "runward/scaffold-lock.json"), "utf8"));
  return Object.keys(j.files ?? {}).filter((k) => k.startsWith("rules/") && k.endsWith(".md"));
};

/** A green example mission, asserted green before anything is measured about it. */
function mission() {
  const root = mkdtempSync(join(tmpdir(), "rw-corpus-"));
  spawnSync("git", ["init", "-q", "."], { cwd: root });
  run(root, "init", "--yes", "--example");
  assert.equal(run(root, "check", "--strict").status, 0,
    "the fixture must start green, or nothing measured below means anything");
  return root;
}

test("a one-rule org corpus does not erase the record of every rule runward wrote", () => {
  const root = mission();
  const corpus = mkdtempSync(join(tmpdir(), "rw-corpusdir-"));
  try {
    const before = lockRules(root).length;
    assert.ok(before > 50, `the shipped corpus should be large; got ${before}`);
    // MEDIUM and no gated phase, so the house rule cannot stand in for a shipped one — that guard
    // is separate and correct, and this test is not about it.
    writeFileSync(join(corpus, "acme-house.md"),
      "---\ntitle: Acme house rule\nimpact: MEDIUM\nphases: []\n---\nA house rule.\n");

    const upd = run(root, "update", "--corpus", corpus);
    assert.equal(upd.status, 0, upd.stderr);
    assert.equal(lockRules(root).length, before + 1,
      "the vendored rule is added; the rules already on disk keep their record");

    const after = run(root, "check", "--strict");
    assert.equal(after.status, 0,
      `vendoring a house corpus must not redden a green mission — got:\n${after.stdout}`);
    assert.doesNotMatch(after.stdout, /never wrote/,
      "no rule runward itself scaffolded may be reported as one the operator fabricated");

    // And the operator is told which rules the corpus does not manage, because deleting them is a
    // decision they may want to make and it is theirs, not update's.
    assert.match(upd.stdout, /absent from this corpus and were left in place/);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(corpus, { recursive: true, force: true }); }
});

test("replacing a shipped rule from an org corpus is named a replacement, never an upstream change", () => {
  const root = mission();
  const corpus = mkdtempSync(join(tmpdir(), "rw-corpusfork-"));
  try {
    for (const f of readdirSync(PACKAGED)) copyFileSync(join(PACKAGED, f), join(corpus, f));
    const target = "frontier-deterministic-boundary.md";
    const forked = readFileSync(join(corpus, target), "utf8")
      .split("\n").filter((l) => !l.startsWith("signature:")).join("\n");
    assert.notEqual(forked, readFileSync(join(PACKAGED, target), "utf8"),
      "the fork must actually differ from the packaged rule, or this proves nothing");
    writeFileSync(join(corpus, target), forked);

    const upd = run(root, "update", "--corpus", corpus);
    assert.equal(upd.status, 0, upd.stderr);
    assert.match(upd.stdout, /replaced .*frontier-deterministic-boundary/,
      "a rule runward ships, replaced by the org's version, must be named as replaced");
    assert.match(upd.stdout, /replaced by the org corpus/,
      "and counted in the summary, so a reviewer of the run sees it");
    assert.doesNotMatch(upd.stdout, /frontier-deterministic-boundary\.md.*changed upstream/,
      "it is not an upstream refresh: runward's upstream did not move");
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(corpus, { recursive: true, force: true }); }
});

test("an ordinary update still calls an upstream refresh what it is", () => {
  // The mirror: the word `upstream` must keep its meaning where it is true, or the fix above has
  // traded one wrong label for another.
  const root = mission();
  try {
    const rule = join(root, "runward/rules/hexa-architecture.md");
    const packaged = readFileSync(join(PACKAGED, "hexa-architecture.md"), "utf8");
    writeFileSync(rule, packaged.replace(/\n$/, "\nAn upstream-looking line.\n"));
    // Re-record it as pristine so `classify` sees "runward wrote this, and the package has moved".
    const lockPath = join(root, "runward/scaffold-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.files["rules/hexa-architecture.md"] =
      createHash("sha256").update(readFileSync(rule, "utf8")).digest("hex");
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

    const upd = run(root, "update");
    assert.match(upd.stdout, /hexa-architecture/, "the file should have been refreshed");
    assert.doesNotMatch(upd.stdout, /replaced by the org corpus/,
      "no corpus was vendored, so nothing was replaced by one");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
