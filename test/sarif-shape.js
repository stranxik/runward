// SARIF conformance net (2026-08-26 audit, finding 11). `test/fixtures/` vendors an in-toto schema
// and an OSCAL schema and validates the emissions against them; the SARIF had NO net at all. The
// auditor ran the missing one by hand — 22 mission states against the official OASIS schema, all
// valid — so the emitter is well formed today, and nothing would say if it stopped being.
//
// WHAT THIS IS NOT: it is not validation against the OASIS SARIF 2.1.0 schema. That schema is
// draft-04; ajv 8 refuses draft-04 (`id` vs `$id`, boolean `exclusiveMinimum`), so full validation
// needs `ajv-draft-04` — a new dependency on a project that ships an attested SBOM, which is the
// operator's decision and not this file's. Recorded in the register as such. What this DOES check is
// every structural invariant a SARIF consumer relies on, across several mission states, plus the
// determinism the other emissions are already held to.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-01-01" };
let failures = 0;
const ok = (cond, label) => { if (cond) console.log(`  ok    ${label}`); else { failures++; console.error(`  FAIL  ${label}`); } };

const parent = mkdtempSync(join(tmpdir(), "runward-sarif-"));

function mission(mutate) {
  const d = mkdtempSync(join(parent, "m-"));
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: d, encoding: "utf8", env: ENV, stdio: "pipe" });
  if (mutate) mutate(join(d, "runward"), d);
  return d;
}
function sarif(dir, extra = []) {
  try {
    return JSON.parse(execFileSync("node", [CLI, "check", "--strict", "--sarif", ...extra], { cwd: dir, encoding: "utf8", env: ENV }));
  } catch (e) { return JSON.parse(e.stdout); }   // a red gate exits 1 and still emits the document
}

const LEVELS = new Set(["error", "warning", "note", "none"]);

function checkShape(doc, dir, label) {
  ok(doc.version === "2.1.0", `${label}: version is 2.1.0`);
  ok(typeof doc.$schema === "string" && doc.$schema.length > 0, `${label}: carries $schema`);
  ok(Array.isArray(doc.runs) && doc.runs.length === 1, `${label}: exactly one run`);
  const run = doc.runs[0];
  const driver = run.tool?.driver ?? {};
  ok(typeof driver.name === "string" && driver.name.length > 0, `${label}: driver.name`);
  ok(typeof driver.informationUri === "string", `${label}: driver.informationUri`);
  const rules = driver.rules ?? [];
  const ids = rules.map((r) => r.id);
  ok(new Set(ids).size === ids.length, `${label}: rule ids are unique`);
  ok(rules.every((r) => typeof r.id === "string" && r.id.length > 0), `${label}: every rule has an id`);
  const results = run.results ?? [];
  ok(results.every((r) => ids.includes(r.ruleId)), `${label}: every result names a declared rule`);
  ok(results.every((r) => LEVELS.has(r.level)), `${label}: every level is one of the four SARIF levels`);
  ok(results.every((r) => typeof r.message?.text === "string" && r.message.text.length > 0), `${label}: every result carries a message`);
  const uris = results.flatMap((r) => (r.locations ?? []).map((l) => l.physicalLocation?.artifactLocation?.uri));
  ok(uris.every((u) => typeof u === "string" && u.length > 0), `${label}: every location has a uri`);
  ok(uris.every((u) => !isAbsolute(u) && !u.includes("://")), `${label}: no absolute or scheme uri`);
  // RWD-2026-0041: half of them pointed at paths no checkout holds.
  ok(uris.every((u) => existsSync(join(dir, u))), `${label}: every uri resolves in the checkout`);
}

// A clean mission, a mission with a broken pointer, one with a drifted seal, and a prefix run.
const clean = mission();
checkShape(sarif(clean), clean, "clean");

const broken = mission((m) => {
  const f = join(m, "floor.md");
  writeFileSync(f, readFileSync(f, "utf8").replace(/^\| config-secrets-boundary \| n\/a \|[^\n]*$/m,
    "| config-secrets-boundary | applied | file:code/nope.ts |"));
});
const bdoc = sarif(broken);
checkShape(bdoc, broken, "broken pointer");
ok((bdoc.runs[0].results ?? []).length > 0, "broken pointer: the document actually carries findings");

const drifted = mission((m, d) => {
  execFileSync("node", [CLI, "check", "--strict", "--freeze"], { cwd: d, encoding: "utf8", env: ENV, stdio: "pipe" });
  appendFileSync(join(d, "code", "src", "core", "domain", "guard.ts"), "\n// drift\n");
});
checkShape(sarif(drifted), drifted, "seal drift");

const prefix = mission();
checkShape(sarif(prefix, ["--through", "floor"]), prefix, "--through floor");

// Determinism, the discipline every other emission is already held to.
const a = JSON.stringify(sarif(broken)), b = JSON.stringify(sarif(broken));
ok(a === b, "two successive runs are byte-identical");

rmSync(parent, { recursive: true, force: true });
console.log(failures === 0 ? "\nSARIF shape test OK" : `\n${failures} SARIF shape failure(s)`);
process.exit(failures === 0 ? 0 : 1);
