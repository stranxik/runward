// The qualification kit (ADR-0087, decision 1): its builder and its runner.
//
// The kit is built from a git tree and an npm tarball, and run against an installation. Every test
// below builds a small repository of its own (a requirements document, one cited test file per
// kind, a smoke test that imports js-yaml, a corpus) and a tarball of its own, so what is measured
// is the mechanism, independent of this repository's size and of the network. The end-to-end run
// on a real release is in the pull request that introduced the kit and in the release chain.
//
// What must hold, and is pinned here: the runner refuses another version (exit 2); it refuses to
// record any result when one installed byte differs from the attested tarball (exit 3), and when
// the kit's own files differ from its manifest; a case reading the source tree is `not-run-here` and
// never `pass`; the js-yaml check of smoke.js is `skipped`, every other smoke check runs; each case's
// kind is derived from its source; two builds of the same inputs are byte-identical; and the
// installation is not written to.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildKit, classifyCases, parseRequirements, readTgz, writeTgz } from "../../scripts/build-qualification-kit.mjs";
import { withoutYamlCheck, parseJunit } from "../../scripts/qualification-kit/run.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION = "9.9.9";

const TOR = `# Tool Operational Requirements — fixture

**Register date**: 2026-10-02 · **Describes**: runward ${VERSION} (published) · **Status**: fixture

## 1. Cases

### TOR-001 — binary

**Requirement.** It prints its version.

**Verified by.** \`test/unit/fx.test.js\` — "binary: the version prints"

**Does not assert.** Anything else.

### TOR-002 — internal

**Requirement.** The module answers.

**Verified by.** \`test/unit/fx.test.js\` — "internal: the module answers"

**Does not assert.** Anything else.

### TOR-003 — static

**Requirement.** The template reads.

**Verified by.** \`test/unit/fx.test.js\` — "static: the shipped template reads"

**Does not assert.** Anything else.

### TOR-004 — source tree

**Requirement.** The page exists.

**Verified by.** \`test/unit/fx.test.js\` — "source: the docs page exists"

**Does not assert.** Anything else.

### TOR-005 — smoke

**Requirement.** The smoke passes.

**Verified by.** \`test/smoke.js\` — the consumer-facing assertions

**Does not assert.** Anything else.
`;

const FX = `import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { answer } from "../../dist/lib/m.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

test("binary: the version prints", () => {
  assert.equal(execFileSync(process.execPath, [CLI, "--version"], { encoding: "utf8" }).trim(), "${VERSION}");
});
test("internal: the module answers", () => { assert.equal(answer(), 42); });
test("static: the shipped template reads", () => {
  assert.match(readFileSync(join(ROOT, "templates", "t.md"), "utf8"), /template/);
});
test("source: the docs page exists", () => {
  assert.match(readFileSync(join(ROOT, "docs", "page.md"), "utf8"), /page/);
});
`;

const SMOKE = `import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
let failures = 0;
function assert(cond, label) {
  if (cond) console.log("  ok  " + label);
  else { failures++; console.error("  FAIL  " + label); }
}
try {
  assert(execFileSync(process.execPath, [CLI, "--version"], { encoding: "utf8" }).includes("${VERSION}"), "the version");
  const { load: yamlLoad, JSON_SCHEMA } = await import("js-yaml");
  for (const phase of ["architect"]) {
    assert(yamlLoad("name: x", { schema: JSON_SCHEMA }).name === phase, "yaml");
  }
  assert(true, "a check after the yaml block still runs");
  if (failures) process.exit(1);
  console.log("smoke test OK");
} finally {
  // nothing to clean
}
`;

const CORPUS = `// A fixture corpus: one case, always as expected.
import { writeFileSync } from "node:fs";
const i = process.argv.indexOf("--json");
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify({ measures: "fixture", totals: { cases: 1, pass: 1, fail: 0,
  REFUSE: { cases: 1, pass: 1, fail: 0 }, ACCEPT: { cases: 0, pass: 0, fail: 0 } }, cases: [] }));
console.log("1/1 as expected");
`;

const REGISTER = `# Known defects

**Describes**: runward ${VERSION}

| id | Defect | Workaround |
|---|---|---|
| RWD-2026-0001 | \`affected-from=9.9.0\` \`fixed-in=unreleased\` · Still open. More. | do this |
| RWD-2026-0002 | \`affected-from=9.0.0\` \`fixed-in=9.9.9\` · Fixed here. More. | none |
`;

const PACKAGE = {
  "package.json": JSON.stringify({ name: "runward", version: VERSION, type: "module" }, null, 2) + "\n",
  "dist/cli.js": `import { readFileSync } from "node:fs";\nconsole.log(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);\n`,
  "dist/lib/m.js": "export const answer = () => 42;\n",
  "templates/t.md": "a template\n",
  "README.md": "readme\n",
};

let work, repo, tarball, kitDir, inst, firstBuild;

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_AUTHOR_DATE: "2026-10-02T00:00:00Z", GIT_COMMITTER_DATE: "2026-10-02T00:00:00Z" } });
}
function put(dir, files) {
  for (const [p, text] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); }
}
function extract(tgz, dest, strip) {
  for (const e of readTgz(readFileSync(tgz))) put(dest, { [e.path.slice(strip.length)]: e.data });
}
function runKit(args) {
  return spawnSync(process.execPath, [join(kitDir, "run.mjs"), ...args], { encoding: "utf8" });
}
const report = (out) => JSON.parse(readFileSync(join(out, "qualification-report.json"), "utf8"));

before(async () => {
  work = realpathSync(mkdtempSync(join(tmpdir(), "rw-kit-test-")));
  repo = join(work, "repo");
  put(repo, {
    "package.json": PACKAGE["package.json"],
    "templates/t.md": PACKAGE["templates/t.md"],
    "README.md": "readme\n",
    "docs/page.md": "a page\n",
    "docs/compliance/tool-operational-requirements.md": TOR,
    "docs/compliance/known-defects.md": REGISTER,
    "scripts/open-anomalies.mjs": readFileSync(join(ROOT, "scripts", "open-anomalies.mjs"), "utf8"),
    "test/unit/fx.test.js": FX,
    "test/smoke.js": SMOKE,
    "test/audit-corpus.js": CORPUS,
  });
  sh("git", ["init", "-q", "."], repo);
  sh("git", ["add", "-A"], repo);
  sh("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "fixture"], repo);
  tarball = join(work, `runward-${VERSION}.tgz`);
  writeFileSync(tarball, writeTgz(Object.entries(PACKAGE).map(([p, t]) => ({ path: `package/${p}`, data: Buffer.from(t) })), 0));
  firstBuild = await buildKit({ ref: "HEAD", tarball, out: join(work, "kit-a"), repo });
  extract(firstBuild.file, join(work, "kit"), "");
  kitDir = join(work, "kit", `runward-qualification-kit-${VERSION}`);
  inst = join(work, "inst");
  extract(tarball, inst, "package/");
  put(inst, { "node_modules/dep/index.js": "// a dependency, never compared\n" });
});

after(() => { if (work) rmSync(work, { recursive: true, force: true }); });

test("kit: two builds of the same tree and tarball are byte-identical, entries sorted", async () => {
  const again = await buildKit({ ref: "HEAD", tarball, out: join(work, "kit-b"), repo });
  assert.equal(again.sha256, firstBuild.sha256);
  const entries = readTgz(readFileSync(firstBuild.file)).map((e) => e.path);
  assert.deepEqual(entries, [...entries].sort());
  assert.ok(entries.includes(`runward-qualification-kit-${VERSION}/tests/unit/fx.test.js`));
  assert.ok(entries.includes(`runward-qualification-kit-${VERSION}/docs/tool-operational-requirements.md`));
  const manifest = JSON.parse(readFileSync(join(kitDir, "kit-manifest.json"), "utf8"));
  assert.equal(manifest.version, VERSION);
  assert.equal(manifest.package.files.length, Object.keys(PACKAGE).length);
  assert.ok(manifest.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
  const anomalies = JSON.parse(readFileSync(join(kitDir, "docs", "open-anomalies.json"), "utf8"));
  assert.deepEqual(anomalies.open.map((e) => e.id), ["RWD-2026-0001"], "the open anomalies are generated for the kit's version");
});

test("kit: the builder refuses a tarball of another version", async () => {
  const other = join(work, "other.tgz");
  writeFileSync(other, writeTgz([{ path: "package/package.json", data: Buffer.from(JSON.stringify({ name: "runward", version: "9.9.8" })) }], 0));
  await assert.rejects(buildKit({ ref: "HEAD", tarball: other, out: join(work, "kit-c"), repo }), /9\.9\.8.*9\.9\.9|refusing/);
});

test("kit: the README opens with the hard line and claims no outcome", () => {
  const readme = readFileSync(join(kitDir, "README.md"), "utf8");
  const head = readme.split("\n").slice(0, 8).join(" ");
  assert.match(head, /does not determine a TQL, a TCL, a tool class or a\s+validation outcome/);
  assert.match(head, /no body has assessed runward or this kit/);
  assert.ok(!readme.includes("{{"), "every placeholder is filled");
});

test("kit run: refuses an installation of another version, exit 2, before any test", () => {
  const other = join(work, "inst-other");
  cpSync(inst, other, { recursive: true });
  put(other, { "package.json": JSON.stringify({ name: "runward", version: "9.9.8" }) });
  const r = runKit(["--package", other, "--out", join(work, "out-other")]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /this kit is for runward 9\.9\.9/);
});

test("kit run: one changed installed byte withholds every result, exit 3", () => {
  const changed = join(work, "inst-changed");
  cpSync(inst, changed, { recursive: true });
  put(changed, { "dist/lib/m.js": "export const answer = () => 43;\n" });
  const out = join(work, "out-changed");
  const r = runKit(["--package", changed, "--out", out]);
  assert.equal(r.status, 3, r.stderr);
  const rep = report(out);
  assert.equal(rep.digest.result, "mismatch");
  assert.deepEqual(rep.digest.changed.map((c) => c.path), ["dist/lib/m.js"]);
  assert.deepEqual(rep.requirements, [], "no result is recorded on bytes the kit never saw");
  assert.match(rep.results, /withheld/);
});

test("kit run: an extra installed file is a mismatch too, node_modules aside", () => {
  const extra = join(work, "inst-extra");
  cpSync(inst, extra, { recursive: true });
  put(extra, { "dist/lib/injected.js": "export {};\n" });
  const out = join(work, "out-extra");
  const r = runKit(["--package", extra, "--out", out]);
  assert.equal(r.status, 3, r.stderr);
  assert.deepEqual(report(out).digest.extra, ["dist/lib/injected.js"]);
});

test("kit run: a kit whose own files changed after extraction is refused, exit 3", () => {
  const tampered = join(work, "kit-tampered");
  cpSync(join(work, "kit"), tampered, { recursive: true });
  const dir = join(tampered, `runward-qualification-kit-${VERSION}`);
  writeFileSync(join(dir, "tests", "unit", "fx.test.js"), FX.replace("answer(), 42", "42, 42"));
  const out = join(work, "out-tampered");
  const r = spawnSync(process.execPath, [join(dir, "run.mjs"), "--package", inst, "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 3, r.stderr);
  assert.deepEqual(report(out).kitIntegrity.mismatches.map((m) => m.path), ["tests/unit/fx.test.js"]);
});

test("kit run: kinds, not-run-here, the skipped js-yaml check, the corpus, and an untouched installation", () => {
  const out = join(work, "out-ok");
  const r = runKit(["--package", inst, "--out", out, "--jobs", "1"]);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const rep = report(out);
  const by = Object.fromEntries(rep.requirements.map((x) => [x.tor, x]));
  assert.deepEqual([by["TOR-001"].kind, by["TOR-001"].result], ["interface", "pass"]);
  assert.deepEqual([by["TOR-002"].kind, by["TOR-002"].result], ["internal", "pass"]);
  assert.deepEqual([by["TOR-003"].kind, by["TOR-003"].result], ["static", "pass"]);
  assert.equal(by["TOR-004"].result, "not-run-here", "a case reading the source tree is never run as if it could pass here");
  assert.match(by["TOR-004"].pointer, /\/blob\/[0-9a-f]{40}\/reports\/junit\.xml$/);
  assert.match(by["TOR-004"].detail, /docs\/page\.md/);
  assert.equal(by["TOR-005"].result, "pass", "smoke ran, its yaml check apart");
  assert.deepEqual(rep.skipped.map((s) => [s.suite, s.result]), [["test/smoke.js", "skipped"]]);
  assert.match(readFileSync(join(out, "raw", "smoke.log"), "utf8"), /a check after the yaml block still runs/);
  assert.deepEqual([rep.totals.pass, rep.totals.fail, rep.totals.notRunHere], [4, 0, 1]);
  assert.equal(rep.corpus.result, "pass");
  assert.equal(rep.digest.result, "match");
  assert.equal(rep.digest.afterRun.result, "match", "the run wrote nothing into the installation");
  assert.equal(rep.signed, false);
  for (const k of ["runward", "node", "os", "platform", "arch", "git"]) assert.ok(k in rep.environment, `environment.${k}`);
  const junit = readFileSync(join(out, "junit.xml"), "utf8");
  assert.match(junit, /TOR-004 \[static\][^>]*>\s*<skipped message="not-run-here:/);
  assert.match(junit, /<skipped message="js-yaml is a development dependency/);
  assert.doesNotMatch(r.stdout + JSON.stringify(rep), /\b(certified|qualified|compliant|guaranteed)\b/i, "the runner never claims an outcome");
});

test("classification: the kind is derived from what the case reaches, fixture included", () => {
  const src = `import { test } from "node:test";
import { f } from "../../dist/lib/x.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const SAMPLES = ["action.yml", "templates/a.md"];
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const SCAN = ["README.md", "docs"];
function files(rel) { return [join(ROOT, rel)]; }
const CORPUS = SCAN.flatMap(files);
const mission = () => { const d = mk(); run(CLI, d); return d; };
test("a", () => { const d = mission(); assert.ok(d); });
test("b", () => { const d = mission(); f(d); });
test("c", () => { read("templates/x.md"); });
test("d", () => { for (const s of SAMPLES) readFileSync(join(ROOT, s)); });
test("e", () => { readFileSync(join(ROOT, "templates", "targets", "AGENTS.md")); });
test("g", () => { readFileSync(join(ROOT, "src", "lib", "hooks.ts")); });
test("h", () => { assert.ok(CORPUS.length); });
test("i", () => { read(".github/workflows/ci.yml"); });
test("j", () => { const p = join(ROOT, "dist", "lib", "y.js"); import(p); });
test("k", () => { writeFileSync(join(tmp, "docs", "x.md"), ""); });
`;
  const so = new Set(["action.yml", "docs", "src", ".github", "AGENTS.md", "node_modules"]);
  const cites = "abcdeghijk".split("").map((n) => ({ tor: n, file: "t.js", caseName: n, note: null }));
  const r = Object.fromEntries(classifyCases(cites, new Map([["t.js", src]]), so).map((c) => [c.caseName, c]));
  assert.equal(r.a.kind, "interface");
  assert.equal(r.b.kind, "internal", "a function from dist/lib makes the case internal");
  assert.equal(r.c.kind, "static");
  assert.equal(r.j.kind, "internal", "a module loaded by path is internal too");
  assert.deepEqual(r.a.sourceTree, []);
  assert.deepEqual(r.c.sourceTree, [], "a shipped path read through a root helper runs here");
  assert.deepEqual(r.d.sourceTree, ["action.yml"], "an array iterated into join(ROOT, …)");
  assert.deepEqual(r.e.sourceTree, [], "join(ROOT, 'templates', 'targets', 'AGENTS.md') is one shipped path, not AGENTS.md");
  assert.deepEqual(r.g.sourceTree, ["src/lib/hooks.ts"]);
  assert.deepEqual(r.h.sourceTree, ["docs"], "names flat-mapped through a root reader");
  assert.deepEqual(r.i.sourceTree, [".github/workflows/ci.yml"]);
  assert.deepEqual(r.k.sourceTree, [], "a 'docs' directory inside a fixture is not the repository's");
  assert.throws(() => classifyCases([{ tor: "z", file: "t.js", caseName: "absent", note: null }], new Map([["t.js", src]]), so), /not a test call/);
});

test("requirements: citations are read as the traceability guard reads them", () => {
  const c = parseRequirements(TOR);
  assert.equal(c.length, 5);
  assert.deepEqual(c[0], { tor: "TOR-001", file: "test/unit/fx.test.js", caseName: "binary: the version prints", note: null });
  assert.deepEqual([c[4].caseName, c[4].note], [null, "the consumer-facing assertions"]);
});

test("smoke: only the js-yaml block is removed, and an unknown shape is refused", () => {
  const r = withoutYamlCheck(SMOKE);
  assert.equal(r.skipped, true);
  assert.ok(!r.text.includes("js-yaml\")"));
  assert.ok(r.text.includes("a check after the yaml block still runs"));
  assert.ok(r.text.includes("the version"));
  assert.deepEqual(withoutYamlCheck("console.log(1);\n"), { text: "console.log(1);\n", skipped: false });
  assert.throws(() => withoutYamlCheck('const y = await import("js-yaml");\nconsole.log(y);\n'), /loop/);
  assert.throws(() => withoutYamlCheck('import y from "js-yaml";\n'), /does not recognise/);
});

test("junit: a decoded name, a failure and a self-skip are told apart", () => {
  const xml = `<testsuites><testcase name="a &amp;quot;q&amp;quot;" time="0.5" classname="test"/>
<testcase name="b" time="0.1" classname="test" failure="x"><failure type="t" message="boom"/></testcase>
<testcase name="c" time="0" classname="test"><skipped type="skipped" message="why"/></testcase></testsuites>`;
  assert.deepEqual(parseJunit(xml), [
    { name: 'a "q"', time: 0.5, status: "pass", message: null },
    { name: "b", time: 0.1, status: "fail", message: "boom" },
    { name: "c", time: 0, status: "skipped", message: "why" },
  ]);
});
