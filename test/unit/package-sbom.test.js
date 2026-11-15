// The release's SBOM is the package's, and the package carries the tree the suite ran on (ADR-0116,
// decisions 1 and 2).
//
// Until 0.46.0 the release attached a Syft scan of the checkout: `metadata.component` was `"."`, 24 of its
// 117 components were files, 26 libraries were outside the runtime tree, and an install resolved 16 of
// the 27 runtime packages to other versions than the lockfile the suite ran on. These tests hold the two
// halves of the fix where they can silently break: the generator (`scripts/package-sbom.mjs`), against
// a synthetic package and against the official CycloneDX 1.6 schema, and the real tarball this tree
// packs, whose bundle must be the lockfile's runtime tree at the lockfile's versions. A Dependabot pull
// request that changes the lockfile packs and checks it here like any other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { writeTgz } from "../../scripts/build-qualification-kit.mjs";
import { packageSbom, render, runtimeTree, uuidV5, npmPurl, licensesOf, resolveFrom, sha512OfIntegrity, authorName, InputError, SPEC_VERSION } from "../../scripts/package-sbom.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "package-sbom.mjs");
const fixture = (f) => JSON.parse(readFileSync(join(ROOT, "test", "fixtures", f), "utf8"));

// The official schema, vendored (test/fixtures/README.md). The two formats the schema names and ajv-formats
// does not define are accepted as strings; the URLs are checked with `new URL` below instead.
function validator() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addFormat("iri-reference", true);
  ajv.addFormat("idn-email", true);
  ajv.addSchema(fixture("cyclonedx_spdx_schema.v1.6.1.json"));
  ajv.addSchema(fixture("cyclonedx_jsf_schema.v1.6.1.json"));
  return { ajv, validate: ajv.compile(fixture("cyclonedx_bom_schema.v1.6.1.json")) };
}
const { ajv, validate } = validator();
const valid = (bom) => validate(bom) || assert.fail(`not a valid CycloneDX ${SPEC_VERSION} document: ${ajv.errorsText(validate.errors)}`);

const sha512 = (s) => `sha512-${createHash("sha512").update(s).digest("base64")}`;
const json = (o) => Buffer.from(JSON.stringify(o));

/** A package bundling a, @s/b and a's dependency c, with a package.json deeper in @s/b that is not a root. */
function synthetic({ files = {}, pkg = {} } = {}) {
  const root = { name: "runward", version: "9.9.9", license: "MIT", author: "A Maintainer <a@example.org>",
    repository: { type: "git", url: "git+https://github.com/stranxik/runward.git" },
    dependencies: { a: "^1.0.0", "@s/b": "^2.0.0" }, bundleDependencies: ["a", "@s/b"], ...pkg };
  const entries = {
    "package/package.json": json(root),
    "package/dist/cli.js": Buffer.from("#!/usr/bin/env node\n"),
    "package/node_modules/a/package.json": json({ name: "a", version: "1.2.3", license: "MIT", dependencies: { c: "^1.0.0" } }),
    "package/node_modules/a/index.js": Buffer.from("export {};\n"),
    "package/node_modules/c/package.json": json({ name: "c", version: "1.0.0", license: "ISC" }),
    "package/node_modules/@s/b/package.json": json({ name: "@s/b", version: "2.0.1", license: "(MIT OR Apache-2.0)", author: { name: "B Author", email: "b@example.org" } }),
    "package/node_modules/@s/b/dist/esm/package.json": json({ type: "module" }),
    ...files,
  };
  return writeTgz(Object.entries(entries).filter(([, d]) => d !== null).map(([path, data]) => ({ path, data })), 0);
}
function lockOf(over = {}) {
  const e = (name, version, license, extra = {}) => ({ version, resolved: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`,
    integrity: sha512(`${name}@${version}`), license, ...extra });
  return { name: "runward", version: "9.9.9", lockfileVersion: 3, requires: true, packages: {
    "": { name: "runward", version: "9.9.9", license: "MIT", dependencies: { a: "^1.0.0", "@s/b": "^2.0.0" }, devDependencies: { d: "^1.0.0" } },
    "node_modules/a": e("a", "1.2.3", "MIT", { dependencies: { c: "^1.0.0" } }),
    "node_modules/c": e("c", "1.0.0", "ISC"),
    "node_modules/@s/b": e("@s/b", "2.0.1", "(MIT OR Apache-2.0)"),
    "node_modules/d": e("d", "1.0.0", "MIT", { dev: true }),
    ...over,
  } };
}

test("package SBOM: a synthetic package becomes a valid CycloneDX 1.6 document naming the package and its bundle", () => {
  const tarball = synthetic();
  const { bom, problems } = packageSbom({ tarball, lock: lockOf(), timestamp: "2026-11-05T22:00:00+01:00" });
  assert.deepEqual(problems, []);
  valid(bom);
  // Positive control: the schema is not a formality, an invalid licence id and a wrong format are refused.
  const broken = structuredClone(bom);
  broken.components[0].licenses = [{ license: { id: "Not-A-Licence" } }];
  assert.equal(validate(broken), false, "the vendored schema refuses a licence id outside SPDX");
  assert.equal(validate({ ...bom, bomFormat: "SPDX" }), false, "and a document that is not CycloneDX");
  assert.equal(bom.specVersion, "1.6");
  assert.equal(bom.metadata.timestamp, "2026-11-05T21:00:00Z", "the timestamp is normalised to UTC, to the second");
  const c = bom.metadata.component;
  assert.equal(c.type, "application");
  assert.equal(`${c.name}@${c.version}`, "runward@9.9.9", "the component is the product, never the checkout");
  assert.equal(c.purl, "pkg:npm/runward@9.9.9");
  assert.deepEqual(c.hashes, [{ alg: "SHA-256", content: createHash("sha256").update(tarball).digest("hex") },
    { alg: "SHA-512", content: createHash("sha512").update(tarball).digest("hex") }], "the tarball's own digests");
  assert.deepEqual(c.licenses, [{ license: { id: "MIT", acknowledgement: "declared" } }]);
  assert.deepEqual(c.authors, [{ name: "A Maintainer" }], "the author's name, never the address");
  for (const r of c.externalReferences) assert.doesNotThrow(() => new URL(r.url), r.url);
  assert.deepEqual(bom.components.map((x) => x["bom-ref"]), ["node_modules/@s/b", "node_modules/a", "node_modules/c"],
    "every bundled package root, and the package.json under dist/esm is not one");
  const b = bom.components[0];
  assert.equal(b.group, "@s");
  assert.equal(b.name, "b");
  assert.equal(b.purl, "pkg:npm/%40s/b@2.0.1");
  assert.deepEqual(b.licenses, [{ expression: "(MIT OR Apache-2.0)", acknowledgement: "declared" }]);
  assert.deepEqual(b.authors, [{ name: "B Author" }]);
  assert.deepEqual(bom.components[2].licenses, [{ license: { id: "ISC", acknowledgement: "declared" } }]);
  assert.equal(bom.components[1].hashes[0].content, Buffer.from(sha512("a@1.2.3").slice(7), "base64").toString("hex"),
    "a component's hash is the SHA-512 of the registry tarball the lockfile names");
  assert.deepEqual(bom.components[1].properties, [{ name: "cdx:npm:package:bundled", value: "true" }, { name: "cdx:npm:package:path", value: "node_modules/a" }]);
  assert.ok(!bom.components.some((x) => x.name === "d"), "a development package of the lockfile is never a component");
  assert.deepEqual(bom.dependencies, [
    { ref: "pkg:npm/runward@9.9.9", dependsOn: ["node_modules/@s/b", "node_modules/a"] },
    { ref: "node_modules/@s/b", dependsOn: [] },
    { ref: "node_modules/a", dependsOn: ["node_modules/c"] },
    { ref: "node_modules/c", dependsOn: [] },
  ]);
});

test("package SBOM: the same inputs give the same bytes, and the serial number follows the tarball", () => {
  const tarball = synthetic();
  const a = render(packageSbom({ tarball, lock: lockOf(), timestamp: "2026-11-05T21:00:00Z" }).bom);
  const b = render(packageSbom({ tarball, lock: lockOf(), timestamp: "2026-11-05T21:00:00Z" }).bom);
  assert.equal(a, b, "deterministic: a reader re-derives it from the tag and compares");
  const other = packageSbom({ tarball: synthetic({ files: { "package/dist/cli.js": Buffer.from("// another build\n") } }), lock: lockOf() }).bom;
  assert.notEqual(other.serialNumber, JSON.parse(a).serialNumber, "another tarball, another serial number");
  assert.match(JSON.parse(a).serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(!("timestamp" in other.metadata), "no timestamp is invented when none is given");
  // RFC 9562 appendix A.4: the version-5 UUID of "www.example.com" in the DNS namespace.
  assert.equal(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
  assert.throws(() => packageSbom({ tarball, lock: lockOf(), timestamp: "the day after" }), InputError);
});

test("package SBOM: every way a bundle can differ from the lockfile is refused, and says which", () => {
  const cases = [
    ["a version", synthetic({ files: { "package/node_modules/c/package.json": json({ name: "c", version: "1.0.1", license: "ISC" }) } }), lockOf(),
      /node_modules\/c: bundled at 1\.0\.1, the lockfile says 1\.0\.0/],
    ["a package missing", synthetic({ files: { "package/node_modules/c/package.json": null } }), lockOf(),
      /node_modules\/c: in the lockfile's runtime tree \(1\.0\.0\), and not bundled/],
    ["a package added", synthetic({ files: { "package/node_modules/x/package.json": json({ name: "x", version: "1.0.0" }) } }), lockOf(),
      /node_modules\/x: bundled, and not in the lockfile's runtime tree/],
    ["a development package bundled", synthetic({ files: { "package/node_modules/d/package.json": json({ name: "d", version: "1.0.0", license: "MIT" }) } }), lockOf(),
      /node_modules\/d: bundled, and not in the lockfile's runtime tree/],
    ["another declared licence", synthetic({ files: { "package/node_modules/c/package.json": json({ name: "c", version: "1.0.0", license: "MIT" }) } }), lockOf(),
      /node_modules\/c: declares the licence "MIT", the lockfile "ISC"/],
    ["no integrity", synthetic(), lockOf({ "node_modules/c": { version: "1.0.0", license: "ISC" } }),
      /node_modules\/c: the lockfile records no SHA-512 integrity/],
    ["a runtime dependency left out of bundleDependencies", synthetic({ pkg: { bundleDependencies: ["a"] } }), lockOf(),
      /the runtime dependency @s\/b is not in bundleDependencies/],
    ["a lockfile of another version", synthetic(), { ...lockOf(), packages: { ...lockOf().packages, "": { name: "runward", version: "9.9.8" } } },
      /the lockfile is of runward@9\.9\.8, the tarball of runward@9\.9\.9/],
    ["a dependency the bundle cannot satisfy", synthetic({ files: { "package/node_modules/a/package.json": json({ name: "a", version: "1.2.3", license: "MIT", dependencies: { c: "^1", e: "^1" } }) } }), lockOf(),
      /node_modules\/a: depends on e, which the bundle does not carry/],
  ];
  for (const [what, tarball, lock, re] of cases) {
    const { problems } = packageSbom({ tarball, lock });
    assert.ok(problems.some((p) => re.test(p)), `${what}: ${problems.join(" | ") || "nothing refused"}`);
  }
  // An optional package of the lockfile may be absent (another operating system's binary); nothing else.
  const optional = packageSbom({ tarball: synthetic(), lock: lockOf({ "node_modules/f": { version: "1.0.0", integrity: sha512("f"), optional: true } }) });
  assert.deepEqual(optional.problems, []);
  assert.throws(() => packageSbom({ tarball: writeTgz([{ path: "package/README.md", data: Buffer.from("x") }], 0), lock: lockOf() }), InputError);
  assert.throws(() => packageSbom({ tarball: synthetic(), lock: { lockfileVersion: 1, dependencies: {} } }), InputError);
});

test("package SBOM: the helpers say what they mean", () => {
  assert.equal(npmPurl("@inquirer/prompts", "8.7.3"), "pkg:npm/%40inquirer/prompts@8.7.3");
  assert.equal(npmPurl("x", "1.0.0+build.1"), "pkg:npm/x@1.0.0%2Bbuild.1");
  assert.deepEqual(licensesOf("BSD-style"), [{ license: { name: "BSD-style", acknowledgement: "declared" } }], "a non-SPDX word is a name, never an invalid id");
  assert.equal(licensesOf(undefined), undefined);
  assert.equal(sha512OfIntegrity("sha1-abc sha512-AAAA"), "000000");
  assert.equal(sha512OfIntegrity("sha1-abc"), null);
  const have = new Set(["node_modules/a", "node_modules/a/node_modules/c", "node_modules/c", "node_modules/@s/b"]);
  assert.equal(resolveFrom("node_modules/a", "c", have), "node_modules/a/node_modules/c", "the nearest copy wins, as Node.js resolves");
  assert.equal(resolveFrom("node_modules/@s/b", "c", have), "node_modules/c");
  assert.equal(resolveFrom("", "@s/b", have), "node_modules/@s/b");
  assert.equal(resolveFrom("node_modules/@s/b", "zz", have), null);
  const tree = runtimeTree(lockOf());
  assert.deepEqual([...tree.keys()].sort(), ["node_modules/@s/b", "node_modules/a", "node_modules/c"]);
});

// RWD-2026-0208. CodeQL read the old cut, `raw.replace(/<[^>]*>|\([^)]*\)/g, "")`, as an incomplete
// sanitization: an address left open stayed in the name. The SBOM is JSON, not markup, so nothing was
// injected, but the name was not the one npm reads, an object's name lost its parentheses, and the cut
// restarted from every `<` that did not close (3.2 s for 64,000 of them).
test("package SBOM: an author's name is the one npm reads, and a long field is read in linear time", () => {
  assert.equal(authorName("A Maintainer <a@example.org> (https://example.org)"), "A Maintainer");
  assert.equal(authorName("A Maintainer <a@example.org"), "A Maintainer", "an address left open is not part of the name");
  assert.equal(authorName("A Maintainer (https://example.org) <a@example.org>"), "A Maintainer");
  assert.equal(authorName("A Maintainer <a@example.org> Jr"), "A Maintainer", "npm's parsePerson stops at the first < or (");
  assert.equal(authorName({ name: "James C. (Jamie) Davis", email: "j@example.org" }), "James C. (Jamie) Davis", "an object's name is read as written");
  assert.equal(authorName("<a@example.org>"), null);
  assert.equal(authorName({ email: "a@example.org" }), null);
  assert.equal(authorName(undefined), null);
  for (const unit of ["<", "(", "a <", "a ("]) {
    const field = unit.repeat(Math.floor(1_000_000 / unit.length));
    const t0 = process.cpuUsage();
    authorName(field);
    const t = process.cpuUsage(t0);
    const ms = (t.user + t.system) / 1000;
    assert.ok(ms < 2000, `${JSON.stringify(unit)} x ${field.length / unit.length}: read in ${ms.toFixed(0)} ms of CPU, over the 2000 ms ceiling`);
  }
});

// ── the real tree ─────────────────────────────────────────────────────────────────────────────────
// Packed here as `npm pack` packs it for the release; `--ignore-scripts` because nothing of the suite
// must run again from inside the suite (example-packed.test.js does the same).
//
// Packed where its `node_modules` really is. In a mutation sandbox, Stryker copies the tree into
// `.stryker-tmp/` and links `node_modules` back to the checkout's, and npm packs a bundled dependency's
// own dependencies through that link only while the hidden lockfile (`node_modules/.package-lock.json`)
// is newer than every package folder: once one folder is newer, npm reads the tree through the link and
// the tarball bundles the 3 direct dependencies of the 27. Measured on 2026-11-10, a sandbox of this
// tree with one package folder touched: 27 bundled, then 3, then 27 once the hidden lockfile was the
// newest again; packed from the checkout itself, 27 either way. That day every leg of seven
// measure-mode runs of mutation-ratchet.yml on main at 5a9cdf0 failed Stryker's initial run on the two
// tests below, so no module could be measured. The checkout the link points to holds the same
// package.json and lockfile as the sandbox, so packing it checks what the release packs. The two tests
// read the bundle and the SBOM, never a module's code, and this file executes no line of a module of the
// mutation perimeter (the coverage map of ADR-0105 records it with none): packing the checkout rather
// than its instrumented copy changes nothing a mutant could be caught by.
function packRoot() {
  const nm = join(ROOT, "node_modules");
  try {
    if (!lstatSync(nm).isSymbolicLink()) return ROOT;
    const checkout = dirname(realpathSync(nm));
    return existsSync(join(checkout, "package.json")) ? checkout : ROOT;
  } catch { return ROOT; }
}
function packTree() {
  const work = mkdtempSync(join(tmpdir(), "rw-sbom-"));
  const win = process.platform === "win32";
  execFileSync(win ? "npm.cmd" : "npm", ["pack", "--ignore-scripts", "--pack-destination", work], { cwd: packRoot(), stdio: "pipe", shell: win });
  const name = readdirSync(work).find((f) => f.endsWith(".tgz"));
  assert.ok(name, "npm pack produced a tarball");
  return { work, file: join(work, name) };
}

test("ADR-0116: the tarball this tree packs bundles the lockfile's runtime tree, at the lockfile's versions", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual([...pkg.bundleDependencies].sort(), Object.keys(pkg.dependencies).sort(),
    "every runtime dependency is bundled: one left out would be resolved from the registry at install");
  const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
  const { work, file } = packTree();
  try {
    const { bom, problems } = packageSbom({ tarball: readFileSync(file), lock, timestamp: "2026-11-05T00:00:00Z" });
    assert.deepEqual(problems, [], "the bundle differs from the lockfile the suite ran on");
    valid(bom);
    assert.equal(`${bom.metadata.component.name}@${bom.metadata.component.version}`, `runward@${pkg.version}`);
    const tree = runtimeTree(lock);
    assert.ok(tree.size >= 3, `the lockfile's runtime tree was read (${tree.size} packages)`);
    assert.equal(bom.components.length, tree.size, "one component per package of the runtime tree, no more");
    for (const c of bom.components) {
      assert.equal(c.version, tree.get(c["bom-ref"]).version, c["bom-ref"]);
      assert.ok(c.licenses?.length, `${c["bom-ref"]} declares a licence`);
      assert.ok(c.hashes?.[0]?.content?.length === 128, `${c["bom-ref"]} carries the SHA-512 of its registry tarball`);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("ADR-0116: the command writes the document, refuses a lockfile the bundle does not match, and names a missing input", () => {
  const { work, file } = packTree();
  try {
    const out = join(work, "sbom.cdx.json");
    const lockPath = join(ROOT, "package-lock.json");
    const ok = spawnSync(process.execPath, [SCRIPT, "--tarball", file, "--lock", lockPath, "--timestamp", "2026-11-05T00:00:00Z", "--out", out], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    assert.equal(readFileSync(out, "utf8"), render(packageSbom({ tarball: readFileSync(file), lock, timestamp: "2026-11-05T00:00:00Z" }).bom),
      "the file the release attaches is the module's rendering");
    // One runtime package at another version in the lockfile: refused, and nothing written.
    const [path] = runtimeTree(lock).keys();
    const tampered = structuredClone(lock);
    tampered.packages[path].version = "0.0.0-not-this";
    const tamperedPath = join(work, "tampered-lock.json");
    writeFileSync(tamperedPath, JSON.stringify(tampered));
    const out2 = join(work, "refused.cdx.json");
    const refused = spawnSync(process.execPath, [SCRIPT, "--tarball", file, "--lock", tamperedPath, "--out", out2], { encoding: "utf8" });
    assert.equal(refused.status, 1, refused.stderr);
    assert.match(refused.stderr, new RegExp(`${path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}: bundled at `));
    assert.ok(!existsSync(out2), "a refused bundle leaves no SBOM behind");
    const usage = spawnSync(process.execPath, [SCRIPT, "--tarball", file], { encoding: "utf8" });
    assert.equal(usage.status, 2, "a missing input is exit 2, never a pass");
  } finally { rmSync(work, { recursive: true, force: true }); }
});
