// runward installs alone (ADR-0129): the package declares no runtime dependency, the lockfile's
// runtime tree is empty, and what the package runs imports nothing but Node.js built-ins and its
// own files.
//
// Three readings, because each can be true while another is false: a package.json without
// `dependencies` whose code still imports a package that happens to be installed for development
// works in this checkout and fails at a user's; a lockfile can keep a runtime entry a package.json
// no longer names. The install itself (one package added) is measured by the pull request and by
// docs/verifying-a-release.md, with npm; here the three are read from the tree, without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

const FIELDS = ["dependencies", "optionalDependencies", "peerDependencies", "bundleDependencies", "bundledDependencies"];

/** Every runtime dependency a package.json declares, as `field: name`. */
export function declaredRuntimeDependencies(pkg) {
  return FIELDS.flatMap((field) => {
    const v = pkg[field];
    const names = v === true ? ["(all)"] : Array.isArray(v) ? v : Object.keys(v ?? {});
    return names.map((n) => `${field}: ${n}`);
  });
}

/** Every package of a lockfile that an install without development dependencies would add. */
export function lockedRuntimePackages(lock) {
  return Object.entries(lock.packages ?? {})
    .filter(([path, e]) => path !== "" && !e.dev && !e.devOptional && !e.link)
    .map(([path]) => path);
}

/**
 * Every module a source text loads that is neither a relative file nor a Node.js built-in: its
 * `import` and `export … from` statements (at the start of a line, as the compiler writes them) and
 * every `import("…")` of a literal, wherever it stands.
 */
export function foreignImports(source) {
  const specs = [
    ...[...source.matchAll(/^(?:import|export)\s[^"'`;]*?\bfrom\s*["']([^"']+)["']/gm)].map((m) => m[1]),
    ...[...source.matchAll(/^import\s*["']([^"']+)["']/gm)].map((m) => m[1]),
    ...[...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
  ];
  return specs.filter((spec) => !spec.startsWith(".") && !spec.startsWith("node:")
    && !builtinModules.includes(spec) && !builtinModules.includes(spec.split("/")[0]));
}

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : []);
}

test("ADR-0129: package.json declares no runtime dependency", () => {
  assert.deepEqual(declaredRuntimeDependencies(read("package.json")), [],
    "runward has zero runtime dependencies (ADR-0129): what is needed at run time is written in src/, or the decision is reopened by an ADR");
});

test("ADR-0129: the lockfile's runtime tree is empty", () => {
  const lock = read("package-lock.json");
  assert.ok(Object.keys(lock.packages).length > 50, "the lockfile was read (it lists the development tree)");
  assert.deepEqual(lockedRuntimePackages(lock), [], "a package of the lockfile would be installed with runward");
});

test("ADR-0129: what the package runs imports only Node.js built-ins and its own files", () => {
  const files = jsFiles(join(ROOT, "dist"));
  assert.ok(files.length > 60, `the build was read (${files.length} modules)`);
  const foreign = files.flatMap((f) => foreignImports(readFileSync(f, "utf8")).map((spec) => `${f.slice(ROOT.length + 1)} imports "${spec}"`));
  assert.deepEqual(foreign, []);
  // The scan sees what it must refuse: a module of the build does import a built-in by its name.
  assert.ok(files.some((f) => /from "node:util"/.test(readFileSync(f, "utf8"))), "the scan reads real import lines");
});

test("planted controls: each reading refuses the dependency it is there to refuse", () => {
  // The three shapes a runtime dependency can come back in, and one that is not one.
  assert.deepEqual(declaredRuntimeDependencies({ dependencies: { chalk: "^6.0.0" } }), ["dependencies: chalk"]);
  assert.deepEqual(declaredRuntimeDependencies({ optionalDependencies: { fsevents: "*" }, peerDependencies: { typescript: "*" } }),
    ["optionalDependencies: fsevents", "peerDependencies: typescript"]);
  assert.deepEqual(declaredRuntimeDependencies({ bundleDependencies: ["commander"] }), ["bundleDependencies: commander"]);
  assert.deepEqual(declaredRuntimeDependencies({ bundleDependencies: true }), ["bundleDependencies: (all)"]);
  assert.deepEqual(declaredRuntimeDependencies({ devDependencies: { typescript: "^5" }, dependencies: {} }), []);

  assert.deepEqual(lockedRuntimePackages({ packages: {
    "": { name: "runward" }, "node_modules/typescript": { dev: true }, "node_modules/chalk": { version: "6.0.0" },
    "node_modules/x": { devOptional: true }, "node_modules/a/node_modules/b": { optional: true },
  } }), ["node_modules/chalk", "node_modules/a/node_modules/b"]);

  assert.deepEqual(foreignImports('import chalk from "chalk";\nimport { a } from "./a.js";\nimport { b } from "node:fs";\nimport c from "fs";\nimport d from "fs/promises";'), ["chalk"]);
  assert.deepEqual(foreignImports('const m = await import("@inquirer/prompts");\nexport { x } from "commander";\nimport "side-effect";\nimport {\n  a,\n  b,\n} from "multi-line";').sort(),
    ["@inquirer/prompts", "commander", "multi-line", "side-effect"]);
  assert.deepEqual(foreignImports('const text = "a sentence that says import x from \\"somewhere\\" in a string";'), [], "a sentence is not an import");
});
