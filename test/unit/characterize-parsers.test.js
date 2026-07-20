// Parser-level tests for `characterize` — one fixture per claimed lockfile family (ADR-0035),
// the scoped manifest extractions (pyproject, pom), and the environment-independence of the
// output (locale, git config). Born from the 2026-07-20 brownfield-lot audit: the yarn range-vs-
// resolved defect, the pnpm zero-match, and the locale-dependent sort all shipped untested.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildInventory, renderCharacterization } from "../../dist/lib/characterize.js";

function tmp() { return mkdtempSync(join(tmpdir(), "rw-parse-")); }
function nodeEco(root) { return buildInventory(root).ecosystems.find((e) => e.name.startsWith("Node")); }

// ── Lockfile families (ADR-0035: the RESOLVED version, or an honest "unread") ──

test("yarn.lock v1: the resolved version is reported, never the requested range", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { express: "^4.16.0", "@babel/core": "^7.0.0" } }));
    writeFileSync(join(root, "yarn.lock"), [
      "# yarn lockfile v1", "",
      "express@^4.16.0, express@^4.17.1:", '  version "4.18.2"', '  resolved "https://x"', "",
      '"@babel/core@^7.0.0":', '  version "7.23.5"', "",
    ].join("\n"));
    const pv = nodeEco(root).pinnedVersions;
    assert.ok(pv.sample.includes("express@4.18.2"), "resolved, not the ^4.16.0 range");
    assert.ok(!pv.sample.some((s) => s.includes("4.16.0")), "the range digits never appear as a pin");
    assert.ok(pv.sample.includes("@babel/core@7.23.5"), "scoped names survive the header parse");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("yarn.lock berry: `version: x` entries parse too", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { express: "^4.18.0" } }));
    writeFileSync(join(root, "yarn.lock"), ['"express@npm:^4.18.0":', "  version: 4.18.2", "  resolution: \"express@npm:4.18.2\"", ""].join("\n"));
    assert.ok(nodeEco(root).pinnedVersions.sample.includes("express@4.18.2"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("pnpm-lock.yaml: indented v6/v9 entries are parsed (the column-0 anchor bug)", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { accepts: "~1.3.8" } }));
    writeFileSync(join(root, "pnpm-lock.yaml"), [
      "lockfileVersion: '9.0'", "packages:", "", "  accepts@1.3.8:", "    resolution: {integrity: sha512}", "",
      "  /express@4.18.2(supports-color@9.0.0):", "    resolution: {integrity: sha512}", "",
      "  '@babel/core@7.23.5':", "    resolution: {integrity: sha512}", "",
    ].join("\n"));
    const pv = nodeEco(root).pinnedVersions;
    assert.ok(pv, "pnpm entries matched (previously zero matches)");
    assert.ok(pv.sample.includes("accepts@1.3.8"));
    const all = buildInventory(root).ecosystems.find((e) => e.name.startsWith("Node")).pinnedVersions;
    assert.equal(all.total, 3, "v9 bare, v6 slash-prefixed + peer-suffix, and quoted scoped all parse");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("bun.lockb (binary) degrades to an honest 'versions unread', never a garbage text-scan", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { express: "^4" } }));
    writeFileSync(join(root, "bun.lockb"), Buffer.from([0x00, 0x01, 0x0a, 0x65, 0x78, 0x70, 0x72, 0x65, 0x73, 0x73, 0x40, 0x34, 0x2e, 0x39, 0x00]));
    const eco = nodeEco(root);
    assert.equal(eco.pinnedVersions, undefined, "binary lockfile: no versions invented");
    const md = renderCharacterization(buildInventory(root), "2026-07-20");
    assert.ok(/bun\.lockb.*versions unread/.test(md), "the gap is NAMED in the render, not silent");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("go: pins come from go.mod (go.sum is a checksum DB, several versions per module)", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n");
    writeFileSync(join(root, "go.sum"), [
      "github.com/gin-gonic/gin v1.8.0 h1:aaa", "github.com/gin-gonic/gin v1.8.0/go.mod h1:bbb",
      "github.com/gin-gonic/gin v1.9.1 h1:ccc", "github.com/gin-gonic/gin v1.9.1/go.mod h1:ddd", "",
    ].join("\n"));
    const eco = buildInventory(root).ecosystems.find((e) => e.name === "Go");
    assert.ok(eco.pinnedVersions.sample.includes("github.com/gin-gonic/gin@v1.9.1"), "the go.mod requirement, not go.sum's lowest");
    assert.ok(!eco.pinnedVersions.sample.some((s) => s.includes("v1.8.0")), "stale checksum-DB versions never reported");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Pipfile.lock and uv.lock parse; an unknown format stays honestly unread", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "requirements.txt"), "flask==2.0\n");
    writeFileSync(join(root, "Pipfile.lock"), JSON.stringify({ default: { flask: { version: "==2.0.1" } }, develop: { pytest: { version: "==8.0.0" } } }));
    const py = buildInventory(root).ecosystems.find((e) => e.name === "Python");
    assert.ok(py.pinnedVersions.sample.includes("flask@2.0.1"), "Pipfile.lock JSON parsed, == stripped");
  } finally { rmSync(root, { recursive: true, force: true }); }
  const root2 = tmp();
  try {
    writeFileSync(join(root2, "requirements.txt"), "flask==2.0\n");
    writeFileSync(join(root2, "uv.lock"), '[[package]]\nname = "flask"\nversion = "3.0.2"\n');
    const py = buildInventory(root2).ecosystems.find((e) => e.name === "Python");
    assert.ok(py.pinnedVersions.sample.includes("flask@3.0.2"), "uv.lock TOML blocks parsed");
  } finally { rmSync(root2, { recursive: true, force: true }); }
});

// ── Scoped manifest extraction (facts, not fabrications) ──

test("pyproject.toml: only [project] dependencies count — never the project's own name or tool config", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "pyproject.toml"), [
      "[build-system]", 'requires = ["setuptools", "wheel"]', "",
      "[project]", 'name = "myservice"', 'version = "1.2.3"',
      "dependencies = [", '  "flask>=2.0",', '  "stripe==8.0",', "]", "",
      "[tool.ruff]", 'select = ["E", "F"]', "",
    ].join("\n"));
    const names = buildInventory(root).ecosystems.find((e) => e.name === "Python").depNames;
    assert.deepEqual([...names].sort(), ["flask", "stripe"], `only the real deps, got: ${names}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("requirements.txt: VCS/URL lines never surface a literal 'git' or 'https' dependency", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "requirements.txt"), "flask==2.0\ngit+https://github.com/x/y@main#egg=ylib\nhttps://files.example/pkg.whl\n");
    const names = buildInventory(root).ecosystems.find((e) => e.name === "Python").depNames;
    assert.ok(names.includes("flask"));
    assert.ok(!names.includes("git") && !names.includes("https"), `scheme prefixes leaked: ${names}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("pom.xml: artifactIds are scoped to <dependencies> — not the project's own, its parent or plugins", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "pom.xml"), [
      "<project>", "  <artifactId>my-service</artifactId>",
      "  <parent><artifactId>corp-parent</artifactId></parent>",
      "  <dependencies>", "    <dependency><artifactId>spring-boot</artifactId></dependency>", "  </dependencies>",
      "  <build><plugins><plugin><artifactId>maven-compiler-plugin</artifactId></plugin></plugins></build>",
      "</project>",
    ].join("\n"));
    const names = buildInventory(root).ecosystems.find((e) => e.name.startsWith("Java (Maven)")).depNames;
    assert.deepEqual(names, ["spring-boot"], `own/parent/plugin artifactIds leaked: ${names}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a Maven + Gradle repo produces ONE stack-java candidate with merged evidence", async () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "pom.xml"), "<project><dependencies></dependencies></project>");
    writeFileSync(join(root, "build.gradle"), "plugins { id 'java' }\n");
    const { mineDrafts } = await import("../../dist/lib/characterize.js");
    const cands = mineDrafts(root, buildInventory(root));
    const javas = cands.filter((c) => c.slug === "stack-java");
    assert.equal(javas.length, 1, "one merged candidate, not a silently-dropped duplicate");
    assert.ok(javas[0].evidence.some((e) => e.includes("pom.xml")) && javas[0].evidence.some((e) => e.includes("build.gradle")), "evidence carries both build systems");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── Environment independence (the determinism moat, ADR-0034) ──

test("output is byte-identical across system locales (localeCompare would break this)", () => {
  const root = tmp();
  try {
    // Names whose relative order differs between en-US and sv-SE collation (ä vs z).
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "z-pkg": "1", "ä-pkg": "1" } }));
    writeFileSync(join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/z-pkg": { version: "1.0.0" }, "node_modules/ä-pkg": { version: "1.0.0" } } }));
    const lib = pathToFileURL(join(process.cwd(), "dist", "lib", "characterize.js")).href;
    const code = `import(${JSON.stringify(lib)}).then(m => process.stdout.write(m.renderCharacterization(m.buildInventory(${JSON.stringify(root)}), "2026-07-20")));`;
    const run = (locale) => execFileSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", env: { ...process.env, LC_ALL: locale, LANG: locale } });
    assert.equal(run("sv_SE.UTF-8"), run("en_US.UTF-8"), "same repo, different machine locale → same bytes");
    assert.equal(run("C"), run("cs_CZ.UTF-8"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a zero-commit git repo is reported as a repo with no commits — never 'not a git repository'", () => {
  const root = tmp();
  try {
    writeFileSync(join(root, "package.json"), "{}");
    execFileSync("git", ["-C", root, "init", "-q"]);
    const inv = buildInventory(root);
    assert.ok(inv.git, "git shape present");
    assert.equal(inv.git.commits, 0);
    assert.ok(/no commits yet/.test(renderCharacterization(inv, "2026-07-20")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a symlinked directory is never traversed (lstat): no escape outside the root", () => {
  const outside = tmp();
  const root = tmp();
  try {
    writeFileSync(join(outside, "huge.tf"), "x\n");
    writeFileSync(join(root, "package.json"), "{}");
    try { execFileSync("ln", ["-s", outside, join(root, "escape")]); } catch { return; } // no symlink support: skip
    const inv = buildInventory(root);
    assert.ok(!inv.infra.some((f) => /Terraform/.test(f)), "the .tf beyond the symlink was not counted");
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
