// The delivered tree (ADR-0113 decision 5): what a project's own .gitignore files deliver, read with
// git's pattern rules and without git, so `check --attest --whole-tree` can bind it as a second subject.
//
// The notion a reader has in mind is "the files git tracks", and asking git would be a spawned process on
// the command that owns the exit code (ADR-0054 crossing 1). So the walker is held to git here, in a test,
// where spawning git is allowed: on a layout that exercises each pattern rule of gitignore(5), the list
// the walker gives is the list of untracked files `git status` gives on a fresh repository (what
// `git ls-files --others --exclude-standard` lists), with the global excludes
// file switched off (runward never reads it: it lives in the home directory, ADR-0054 crossing 3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deliveredEntries, parseIgnoreLine } from "../../dist/lib/delivered-tree.js";
import { deliveredTreeOf, DELIVERED_TREE_RULE } from "../../dist/lib/attestation.js";

const HAS_GIT = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
const put = (root, rel, body = "x\n") => { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), body); };
const trySymlink = (target, at) => { try { symlinkSync(target, at); return true; } catch { return false; } };

/** git's own answer, on the throwaway repository the test creates (never on this one, which a Stryker
 *  sandbox does not hold as a repository): the files it would offer to track, every one untracked in a
 *  fresh repository, read from `git status` with no global or system configuration. */
function gitList(root) {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1", HOME: root };
  assert.equal(spawnSync("git", ["init", "-q", "."], { cwd: root, env }).status, 0);
  const r = spawnSync("git", ["-c", "core.excludesFile=", "-c", "core.ignorecase=false", "-c", "core.quotepath=off",
    "status", "--porcelain=v1", "--untracked-files=all", "--ignored=no", "-z"], { cwd: root, env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const entries = r.stdout.split("\0").filter(Boolean);
  assert.ok(entries.every((e) => e.startsWith("?? ")), "a fresh repository has only untracked entries");
  return entries.map((e) => e.slice(3));
}

function layout() {
  const root = mkdtempSync(join(tmpdir(), "rw-delivered-"));
  put(root, ".gitignore", [
    "# a comment, then a blank line", "",
    "*.log", "!important.log",            // a glob, and a negation after it
    "build/",                              // a directory only: a FILE named build elsewhere is kept
    "/only-root.txt",                      // anchored by a leading slash
    "docs/private",                        // anchored by a middle slash
    "**/tmp",                              // a leading **/
    "a/**/b",                              // **/ in the middle: zero or more directories
    "logs/**", "!logs/keep.txt",           // a trailing /**, and a file re-included inside it
    "out/", "!out/keep",                   // a directory excluded: nothing inside can be re-included
    "\\#hash.txt", "\\!bang.txt",          // escaped # and !
    "[ab].dat", "?.q", "[[:digit:]]*.num", // bracket, single character, POSIX class
    "trail.txt   ",                        // trailing spaces are not part of the pattern
  ].join("\n") + "\n");
  for (const f of [
    "keep.txt", "x.log", "important.log", "sub/y.log", "build/out.js", "src/build", "only-root.txt", "sub/only-root.txt",
    "docs/private", "docs/public.md", "deep/x/tmp", "tmp", "a/b", "a/x/y/b", "a/b.txt", "logs/a.txt", "logs/keep.txt",
    "out/keep", "#hash.txt", "!bang.txt", "a.dat", "b.dat", "c.dat", "z.q", "zz.q", "7days.num", "days.num", "trail.txt",
    "crlf/x.txt", "crlf/y.txt", "nested/inner.txt", "sub/local-only", "sub/z.log",
  ]) put(root, f);
  // A deeper .gitignore overrides its parents for what is below it: the last match wins.
  put(root, "sub/.gitignore", "!*.log\nlocal-only\n");
  // A .gitignore written with CRLF line endings reads as git reads it.
  put(root, "crlf/.gitignore", "x.txt\r\n");
  // An empty file is delivered: whether it is bound is the attestation's decision, not the walker's.
  put(root, "empty.txt", "");
  // Another repository inside this one: git lists it as `nested/`, runward never enters it.
  put(root, "nested/.git", "gitdir: ../elsewhere\n");
  return root;
}

test("the delivered tree is the list git would track, on a layout that exercises each pattern rule", { skip: !HAS_GIT && "git is not installed" }, () => {
  const root = layout();
  try {
    // A real repository inside, for git to recognise one (the walker needs only the `.git` entry).
    rmSync(join(root, "nested", ".git"));
    assert.equal(spawnSync("git", ["init", "-q", join(root, "nested")]).status, 0);
    const ours = deliveredEntries(root).map((e) => e.rel);
    const git = gitList(root);
    // The positive control: the layout does what it says, as git reads it, so a walker that ignored
    // negations, anchoring, `**`, directory-only patterns or nested files could not pass by accident.
    for (const kept of ["important.log", "src/build", "sub/only-root.txt", "docs/public.md", "a/b.txt", "logs/keep.txt", "c.dat", "zz.q", "days.num", "sub/y.log", "sub/z.log", "crlf/y.txt", "empty.txt", "keep.txt"]) {
      assert.ok(git.includes(kept), `git keeps ${kept}: ${JSON.stringify(git)}`);
    }
    for (const dropped of ["x.log", "build/out.js", "only-root.txt", "docs/private", "deep/x/tmp", "tmp", "a/b", "a/x/y/b", "logs/a.txt", "out/keep", "#hash.txt", "!bang.txt", "a.dat", "b.dat", "z.q", "7days.num", "trail.txt", "crlf/x.txt", "sub/local-only"]) {
      assert.ok(!git.includes(dropped), `git ignores ${dropped}`);
    }
    assert.ok(git.includes("nested/"), "git names the nested repository and does not enter it");
    assert.deepEqual(ours, git.filter((f) => !f.endsWith("/")).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a nested repository is never entered, and no .git entry is ever listed", () => {
  const root = layout();
  try {
    const rels = deliveredEntries(root).map((e) => e.rel);
    assert.ok(!rels.some((r) => r.startsWith("nested/")), "another repository is another repository's (ADR-0054 crossing 4)");
    assert.ok(!rels.some((r) => r === ".git" || r.endsWith("/.git") || r.includes(".git/")));
    // Control: the same directory without its .git is walked like any other.
    rmSync(join(root, "nested", ".git"));
    assert.ok(deliveredEntries(root).some((e) => e.rel === "nested/inner.txt"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a pattern reads as gitignore(5) says: comments, escapes, trailing spaces, anchoring, directories", () => {
  assert.equal(parseIgnoreLine("# not a pattern"), null);
  assert.equal(parseIgnoreLine("   "), null, "spaces alone end in nothing");
  assert.equal(parseIgnoreLine("!"), null);
  const trail = parseIgnoreLine("name\\  ");
  assert.ok(trail.re.test("name "), "an escaped trailing space is kept, the unescaped one dropped");
  assert.ok(!trail.re.test("name  "));
  const dir = parseIgnoreLine("cache/");
  assert.equal(dir.dirOnly, true);
  assert.equal(dir.anchored, false, "a trailing slash alone does not anchor");
  assert.equal(parseIgnoreLine("a/b").anchored, true);
  assert.equal(parseIgnoreLine("/a").anchored, true);
  assert.ok(parseIgnoreLine("*.log").re.test("x.log"));
  assert.ok(!parseIgnoreLine("*.log").re.test("dir/x.log"), "a single star never crosses a slash");
  assert.ok(parseIgnoreLine("a/**/b").re.test("a/b") && parseIgnoreLine("a/**/b").re.test("a/x/y/b"));
  assert.ok(parseIgnoreLine("[!a]x").re.test("bx") && !parseIgnoreLine("[!a]x").re.test("ax"));
  assert.ok(!parseIgnoreLine("[!a]x").re.test("/x"), "a bracket never matches a slash");
  assert.ok(parseIgnoreLine("\\d").re.test("d") && !parseIgnoreLine("[\\d]").re.test("7"), "an escaped letter is the letter");
});

test("the attestation's tree leaves out empty files and runward Statements, and hashes as the mission digest does", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-delivered-att-"));
  try {
    put(root, "lf.txt", "one\ntwo\n");
    put(root, "crlf.txt", "one\r\ntwo\r\n");
    put(root, "empty.txt", "");
    const statement = { _type: "https://in-toto.io/Statement/v1", subject: [{ name: "m", digest: { sha256: "0".repeat(64) } }], predicateType: "https://runward.dev/verdict/v1", predicate: {} };
    put(root, "verdict.intoto.json", JSON.stringify(statement));
    put(root, "verdict.dsse.json", JSON.stringify({ payloadType: "application/vnd.in-toto+json", payload: Buffer.from(JSON.stringify(statement)).toString("base64"), signatures: [] }));
    put(root, "other.json", JSON.stringify({ _type: "https://in-toto.io/Statement/v1", predicateType: "https://slsa.dev/provenance/v1" }));
    const t = deliveredTreeOf(root);
    assert.deepEqual(Object.keys(t.entries).sort(), ["crlf.txt", "lf.txt", "other.json"],
      "a runward Statement is about the tree, never part of it; an empty file is what the shell creates before runward writes");
    assert.equal(t.entries["crlf.txt"], t.entries["lf.txt"], "CRLF reads as LF, as for the mission-state digest");
    assert.equal(t.files, 3);
    assert.equal(t.rule, DELIVERED_TREE_RULE);
    if (trySymlink("lf.txt", join(root, "link"))) {
      const withLink = deliveredTreeOf(root);
      assert.equal(withLink.entries.link, createHash("sha256").update("lf.txt").digest("hex"), "a link is hashed by its target, the bytes git stores for it");
      assert.notEqual(withLink.entries.link, withLink.entries["lf.txt"], "and never followed");
    }
    assert.match(readFileSync(join(root, "lf.txt"), "utf8"), /one/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
