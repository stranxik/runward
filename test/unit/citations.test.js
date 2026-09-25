// ADR-0077, the library itself. The CLI tests in rules-for-cited.test.js pin the user-visible answer
// but run in a child process, where a mutant switched on in THIS process is never active — so the
// module's own decisions are pinned here, calling it directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { citationsForPaths, compareCitations } from "../../dist/lib/citations.js";
import { readManifest } from "../../dist/lib/conformance.js";

const HEAD = "## Rule conformance\n\n| rule | status | evidence |\n|---|---|---|\n";
function project(files) {
  const root = mkdtempSync(join(tmpdir(), "rw-citations-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}
const key = (x) => `${x.rule} ${x.via.file}:${x.via.line}`;

test("citations are ordered by rule, then manifest, then line — never by reading order", () => {
  const root = project({
    "src/a.ts": "export const f = 1;\n",
    // floor.md: rows at lines 5, 6, 7, 8 — written out of order on purpose.
    "runward/floor.md": HEAD +
      "| z-rule | applied | file:src/a.ts |\n" +
      "| a-rule | applied | file:src/a.ts |\n" +
      "| m-rule | applied | file:src/a.ts |\n" +
      "| a-rule | deviated | file:src/a.ts — second row, same rule |\n",
    "runward/governance/threat-model.md": HEAD +
      "| z-rule | applied | file:src/a.ts |\n" +
      "| a-rule | applied | file:src/a.ts |\n",
  });
  const r = citationsForPaths(root, ["src/a.ts"]);
  assert.deepEqual(r.citations.map(key), [
    "a-rule runward/floor.md:6",
    "a-rule runward/floor.md:8",
    "a-rule runward/governance/threat-model.md:6",
    "m-rule runward/floor.md:7",
    "z-rule runward/floor.md:5",
    "z-rule runward/governance/threat-model.md:5",
  ]);
  rmSync(root, { recursive: true, force: true });
});

test("no project, or no path asked: nothing is read, and nothing is claimed read", () => {
  assert.deepEqual(citationsForPaths(null, ["src/a.ts"]), { citations: [], proposedSkipped: [], couldNotRead: [], manifestsRead: 0 });
  const root = project({ "runward/floor.md": HEAD + "| a | applied | file:src/a.ts |\n" });
  assert.equal(citationsForPaths(root, []).manifestsRead, 0, "an empty question reads no manifest");
  assert.equal(citationsForPaths(root, ["src/a.ts"]).manifestsRead, 1, "a missing deliverable is skipped, not read");
  rmSync(root, { recursive: true, force: true });
});

test("a single malformed row is the gate's business; only a manifest read as nothing is a fault", () => {
  const root = project({
    "src/a.ts": "x\n",
    "runward/floor.md": HEAD + "| a-rule | applied | file:src/a.ts |\n| broken row |\n",
    "runward/handover.md": HEAD + "| a | applied | x |\n\n" + HEAD,
  });
  const r = citationsForPaths(root, ["src/a.ts"]);
  assert.deepEqual(r.citations.map((x) => x.rule), ["a-rule"]);
  assert.equal(r.couldNotRead.length, 1);
  assert.deepEqual({ ...r.couldNotRead[0], detail: "…" }, { source: "manifest", carrier: "runward/handover.md", detail: "…" });
  rmSync(root, { recursive: true, force: true });
});

test("a pointer into the rule set is circular and never listed; a pointer leaving the project never matches", () => {
  const root = project({
    "runward/rules/a-rule.md": "---\ntitle: A\n---\n",
    "runward/floor.md": HEAD +
      "| a-rule | applied | file:runward/rules/a-rule.md |\n" +
      "| b-rule | applied | file:../outside.ts |\n",
  });
  const r = citationsForPaths(root, ["runward/rules/a-rule.md", "../outside.ts"]);
  assert.deepEqual(r.citations, []);
  rmSync(root, { recursive: true, force: true });
});

test("a missing file is matched lexically and said not to resolve; a present symbol resolves", () => {
  const root = project({
    "src/a.ts": "export function kept() {}\n",
    "runward/floor.md": HEAD +
      "| a-rule | applied | file:src/gone.ts |\n" +
      "| b-rule | applied | file:src/a.ts#kept |\n" +
      "| c-rule | applied | file:src/a.ts#renamed |\n",
  });
  const r = citationsForPaths(root, ["src/gone.ts", "src/a.ts"]);
  const by = Object.fromEntries(r.citations.map((x) => [x.rule, x]));
  assert.equal(by["a-rule"].resolves, false);
  assert.match(by["a-rule"].note, /does not exist/);
  assert.equal(by["b-rule"].resolves, true);
  assert.equal(by["b-rule"].note, undefined);
  assert.equal(by["c-rule"].resolves, false);
  assert.match(by["c-rule"].note, /symbol "renamed" not found/);
  rmSync(root, { recursive: true, force: true });
});

test("readManifest: an unread manifest carries no lines either — the arrays stay parallel", () => {
  assert.deepEqual(readManifest("# no section\n").lines, []);
  assert.deepEqual(readManifest(HEAD + "| a | applied | x |\n\n" + HEAD + "| b | applied | y |\n").lines, []);
});

test("a project reached through a symlink still finds its citations (the gate resolves canonical paths)", () => {
  // Found 2026-09-25 by these very tests on macOS, where tmpdir() sits under the /var -> /private/var
  // symlink: the section stayed silently EMPTY. Linux CI has no such symlink, so it is built here.
  const real = project({ "src/a.ts": "x\n", "runward/floor.md": HEAD + "| a-rule | applied | file:src/a.ts |\n" });
  const link = join(mkdtempSync(join(tmpdir(), "rw-citations-link-")), "via-link");
  symlinkSync(realpathSync(real), link, "dir");
  assert.deepEqual(citationsForPaths(link, ["src/a.ts"]).citations.map((x) => x.rule), ["a-rule"]);
  rmSync(real, { recursive: true, force: true });
});

test("compareCitations: every branch, in both argument orders", () => {
  const c = (rule, file, line) => ({ rule, via: { file, line } });
  const sign = (a, b) => Math.sign(compareCitations(a, b));
  // rule decides first, whatever file and line say
  assert.equal(sign(c("a", "z.md", 9), c("b", "a.md", 1)), -1);
  assert.equal(sign(c("b", "a.md", 1), c("a", "z.md", 9)), 1);
  // same rule: file decides, whatever line says
  assert.equal(sign(c("a", "a.md", 9), c("a", "b.md", 1)), -1);
  assert.equal(sign(c("a", "b.md", 1), c("a", "a.md", 9)), 1);
  // same rule, same file: line decides
  assert.equal(sign(c("a", "a.md", 5), c("a", "a.md", 8)), -1);
  assert.equal(sign(c("a", "a.md", 8), c("a", "a.md", 5)), 1);
  assert.equal(compareCitations(c("a", "a.md", 5), c("a", "a.md", 5)), 0);
});

test("a cited path that cannot be read (a directory) never resolves a symbol", () => {
  const root = project({ "src/lib/x.ts": "x\n", "runward/floor.md": HEAD + "| a-rule | applied | file:src/lib#here |\n" });
  const [x] = citationsForPaths(root, ["src/lib"]).citations;
  assert.equal(x.resolves, false);
  assert.match(x.note, /symbol "here" not found/);
  rmSync(root, { recursive: true, force: true });
});
