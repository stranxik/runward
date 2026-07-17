// OSCAL schema test: prove `runward compliance` emits an OSCAL component-definition
// that validates against the vendored NIST OSCAL 1.2.2 schema. Runs offline.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const SCHEMA_PATH = join(ROOT, "test", "fixtures", "oscal_component_schema.v1.2.2.json");
const tmp = mkdtempSync(join(tmpdir(), "runward-oscal-"));
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else { failures++; console.error(`  FAIL  ${label}`); }
}
function run(args, cwd = tmp) {
  execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
}

try {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  // Generate an OSCAL export from a real init'd mission (with actual rules/).
  run(["init"]);
  run(["compliance", "eu-ai-act"]);
  const oscalPath = join(tmp, "runward/compliance/oscal-component-definition.json");
  assert(existsSync(oscalPath), "compliance emits an OSCAL component-definition");
  const data = JSON.parse(readFileSync(oscalPath, "utf8"));

  // The exporter's declared oscal-version must match the vendored schema.
  const declared = data["component-definition"]?.metadata?.["oscal-version"];
  const schemaVer = schema["$id"].match(/\/(\d+\.\d+\.\d+)\//)?.[1];
  assert(declared === schemaVer,
    `exporter oscal-version (${declared}) matches the vendored schema (${schemaVer})`);

  // The actual validation.
  const ok = validate(data);
  if (!ok) {
    for (const e of validate.errors.slice(0, 20)) {
      console.error(`    · ${e.instancePath || "(root)"} ${e.keyword}: ${e.message}`);
    }
  }
  assert(ok, "OSCAL export validates against the NIST OSCAL 1.2.2 component-definition schema");

  // Negative controls: the validator must actually bite, or a green above is meaningless.
  const clone = () => JSON.parse(JSON.stringify(data));
  const noUuid = clone(); delete noUuid["component-definition"].uuid;
  assert(!validate(noUuid), "negative control: a missing required uuid is rejected");
  const badUuid = clone(); badUuid["component-definition"].uuid = "not-a-uuid";
  assert(!validate(badUuid), "negative control: a malformed uuid is rejected (confirms detUuid shape)");
  const badType = clone(); badType["component-definition"].components[0].type = 12345;
  assert(!validate(badType), "negative control: a non-string component type is rejected");

  if (failures) { console.error(`\noscal-schema test FAILED — ${failures} assertion(s)`); process.exit(1); }
  console.log("\noscal-schema test OK");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
