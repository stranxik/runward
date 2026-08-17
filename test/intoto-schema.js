// in-toto schema test (ADR-0055 ratification criterion 1): prove `check --attest` and `bundle`
// emit Statements that validate against the vendored in-toto Statement v1 contract. Runs offline —
// the schema is vendored (test/fixtures/intoto_statement_schema.v1.json), nothing is fetched.
// Mirrors test/oscal-schema.js: the same discipline, on the attestation surface. This step was the
// admitted-missing piece of the criterion ("a CI step … schema-validates the envelope against the
// in-toto spec") — named by the 2026-08-14 audit, closed here, wired in ci.yml's network-cut block.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const SCHEMA_PATH = join(ROOT, "test", "fixtures", "intoto_statement_schema.v1.json");
const tmp = mkdtempSync(join(tmpdir(), "runward-intoto-"));
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else { failures++; console.error(`  FAIL  ${label}`); }
}

try {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));
  const env = { ...process.env, NO_COLOR: "1" };

  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: tmp, encoding: "utf8", env });

  // The verdict attestation (layer 1).
  const verdict = JSON.parse(execFileSync("node", [CLI, "check", "--strict", "--attest", "-p", "."], { cwd: tmp, encoding: "utf8", env }));
  assert(validate(verdict), `check --attest emits a valid in-toto Statement v1${validate.errors ? ` — ${ajv.errorsText(validate.errors)}` : ""}`);
  assert(verdict.predicateType === "https://runward.dev/verdict/v1", "the verdict predicateType is the versioned runward URI");
  assert(!("signature" in verdict) && !("signatures" in verdict), "no signature field — signing stays the operator's gesture, under the operator's key");
  assert(/^[a-f0-9]{64}$/.test(verdict.subject?.[0]?.digest?.sha256 ?? ""), "the subject digest is a full sha256");

  // The artifact bundle (layer 4): bind the attestation we just emitted.
  writeFileSync(join(tmp, "verdict.intoto.json"), JSON.stringify(verdict, null, 2));
  const bundle = JSON.parse(execFileSync("node", [CLI, "bundle", "verdict.intoto.json", "-p", "."], { cwd: tmp, encoding: "utf8", env }));
  assert(validate(bundle), `bundle emits a valid in-toto Statement v1${validate.errors ? ` — ${ajv.errorsText(validate.errors)}` : ""}`);
  assert(bundle.predicateType === "https://runward.dev/bundle/v1", "the bundle predicateType is the versioned runward URI");
  assert(!("signature" in bundle) && !("signatures" in bundle), "the bundle carries no signature field either");
  // The VSA port (ADR-0011): a neutral predicate an ecosystem verifier reads without learning
  // anything about runward. It must satisfy the SAME envelope contract as our own predicates.
  const vsa = JSON.parse(execFileSync("node", [CLI, "check", "--strict", "--vsa", "--resource-uri", "pkg:npm/demo@1.0.0", "-p", "."], { cwd: tmp, encoding: "utf8", env: { ...env, SOURCE_DATE_EPOCH: "1700000000" } }));
  assert(validate(vsa), `check --vsa emits a valid in-toto Statement v1${validate.errors ? ` — ${ajv.errorsText(validate.errors)}` : ""}`);
  assert(vsa.predicateType === "https://slsa.dev/verification_summary/v1", "the VSA predicateType is the SLSA one, not a runward invention");
  assert(Array.isArray(vsa.predicate.verifiedLevels) && vsa.predicate.verifiedLevels.every((l) => !String(l).startsWith("SLSA_")),
    "verifiedLevels claims no SLSA level: runward verifies a delivery gate, not a build pipeline");
  assert(typeof vsa.predicate.resourceUri === "string" && vsa.predicate.resourceUri.length > 0, "the operator-supplied resource URI is carried verbatim");

} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nin-toto schema test OK");
