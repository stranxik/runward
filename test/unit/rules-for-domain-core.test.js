// ADR-0078: the domain core is a category, and one written absence of territory is reopened.
//
// `hexa-architecture` prescribes the inner hexagon by name ("core — pure business logic", "core never
// imports from adapters"), yet declared it had no file territory: the reason objected to GLOBS, and was
// written hours before categories existed. With `governs: [domain-core, port-adapter]` and a mission
// map line, the file the example mission is built around surfaces the rule — and so does a file that
// did not exist yesterday, which is the half a citation (ADR-0077) can never reach.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-dcore-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function forJson(cwd, ...paths) {
  return JSON.parse(execFileSync(process.execPath, [CLI, "rules", "--for", ...paths, "--json", "-p", "."], { cwd, encoding: "utf8" }));
}

test("ADR-0078: guard.ts and a brand-new core file both surface hexa-architecture, by the map line", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-dcore-"));
  cpSync(REFERENCE, dir, { recursive: true });
  const j = forJson(dir, "code/src/core/domain/guard.ts", "code/src/core/domain/not-written-yet.ts");
  const hexa = j.rules.find((r) => r.slug === "hexa-architecture");
  assert.ok(hexa, "the rule that prescribes the core is matched");
  assert.deepEqual(hexa.matchedBy.map((m) => [m.kind, m.category, m.path, m.via.source, m.via.file]), [
    ["category", "domain-core", "code/src/core/domain/guard.ts", "map", "runward/territory.md"],
    ["category", "domain-core", "code/src/core/domain/not-written-yet.ts", "map", "runward/territory.md"],
  ]);
  // The line named is the map row itself — read back, not trusted.
  const row = readFileSync(join(dir, "runward/territory.md"), "utf8").split("\n")[hexa.matchedBy[0].via.line - 1];
  assert.match(row, /`code\/src\/core\/domain\/\*\*` \| `domain-core`/);
  rmSync(dir, { recursive: true, force: true });
});

test("ADR-0078: an adapter is not domain core, and the rule still reaches it through port-adapter", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-dcore-"));
  cpSync(REFERENCE, dir, { recursive: true });
  const j = forJson(dir, "code/src/core/domain/guard.ts", "code/src/adapters/x.adapter.ts");
  const hexa = j.rules.find((r) => r.slug === "hexa-architecture");
  const byPath = Object.fromEntries(hexa.matchedBy.map((m) => [m.path, m.category ?? m.kind]));
  assert.equal(byPath["code/src/core/domain/guard.ts"], "domain-core");
  assert.equal(byPath["code/src/adapters/x.adapter.ts"], undefined,
    "port-adapter is bound by derivation or the map, never by a glob on hexa-architecture itself");
  rmSync(dir, { recursive: true, force: true });
});

test("ADR-0078: without a map line, domain-core is unresolved and said so — never silently empty", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-dcore-"));
  cpSync(REFERENCE, dir, { recursive: true });
  rmSync(join(dir, "runward/territory.md"));
  const j = forJson(dir, "code/src/core/domain/guard.ts");
  assert.ok(!j.rules.some((r) => r.slug === "hexa-architecture"));
  assert.ok(j.territoryStates.unresolved > 0, "a declared category nothing binds is a missing binding, counted");
  assert.ok(!j.derivation.categoriesResolved.includes("domain-core"));
  rmSync(dir, { recursive: true, force: true });
});
