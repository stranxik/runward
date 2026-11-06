// ADR-0112: runward's committed JUnit report has one reference environment, macOS and the Node.js of
// `.nvmrc`. The generator writes `<!-- generated: node vX.Y.Z <platform> -->` into the report; the comment
// is outside what the gate and the seal read; `npm run test:reports` refuses a committed report whose
// comment names another environment, or none, and says how to regenerate it; `engines` stays the floor.
import { test } from "node:test";
import { load as loadYaml } from "js-yaml";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { junitProjection, junitTestCases, junitWritesQuotesTwice } from "../../dist/lib/tool-adapters.js";
import { generatedComment, withGeneratedComment, referenceProblem, referenceNode } from "../../scripts/junit-reference.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const report = (q) => `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n\t<testcase name="a ${q}quoted${q} name" classname="test"/>\n\t<testcase name="plain" classname="test"/>\n</testsuites>\n`;
const ONCE = report("&quot;"), TWICE = report("&amp;quot;");

test("the environment comment: written after the declaration, outside what the gate and the seal read", () => {
  const stamped = withGeneratedComment(ONCE, generatedComment("v24.22.1", "darwin"));
  assert.ok(stamped.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<!-- generated: node v24.22.1 darwin -->\n<testsuites>'), stamped);
  assert.equal(withGeneratedComment(stamped, generatedComment("v24.22.1", "darwin")), stamped, "one comment, replaced, never stacked");
  assert.ok(withGeneratedComment("<testsuites/>\n", generatedComment("v1.2.3", "linux")).startsWith("<!-- generated: node v1.2.3 linux -->\n<testsuites/>"), "first when there is no declaration");
  assert.deepEqual(junitProjection(stamped), junitProjection(ONCE), "the projection does not read it");
  assert.deepEqual(junitTestCases(stamped, 'a "quoted" name').map((c) => c.green), [true], "nor does the gate");
  assert.equal(junitWritesQuotesTwice(withGeneratedComment(TWICE, generatedComment("v24.18.0", "darwin"))), true, "nor does the document rule");
});

test("test:reports refuses a committed report written outside the reference environment, and accepts one written in it", () => {
  const node = referenceNode();
  assert.equal(node, `v${readFileSync(join(ROOT, ".nvmrc"), "utf8").trim()}`);
  assert.match(node, /^v\d+\.\d+\.\d+$/, ".nvmrc names an exact release");
  assert.equal(referenceProblem(withGeneratedComment(ONCE, generatedComment(node, "darwin"))), null);
  const otherNode = referenceProblem(withGeneratedComment(TWICE, generatedComment("v24.18.0", "darwin")));
  assert.match(otherNode, /written by node v24\.18\.0 on darwin, not by the reference environment, node v\d/);
  assert.match(otherNode, /npm run test:junit/, "it says how to regenerate");
  assert.match(referenceProblem(withGeneratedComment(ONCE, generatedComment(node, "linux"))), /on linux, not by the reference environment/);
  assert.match(referenceProblem(ONCE), /says nothing of the environment that wrote it/);
  // The script applies it to the COMMITTED report, read before it regenerates anything.
  const fresh = readFileSync(join(ROOT, "scripts", "reports-fresh.mjs"), "utf8");
  assert.match(fresh, /referenceProblem\(before\.junit\)/);
  assert.match(readFileSync(join(ROOT, "scripts", "junit-committable.mjs"), "utf8"), /withGeneratedComment\(/, "the generator writes the comment");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.engines.node, /^>=22\./, "engines stays the users' floor, not the reference");
});

test("the CI job that proves the committed reports current runs in the reference environment", () => {
  const ci = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
  const job = ci.match(/\n {2}lint-and-reports:\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n|\n[a-z])/);
  assert.ok(job, "the job lint-and-reports exists");
  assert.match(job[1], /\n {4}runs-on: macos-latest\n/, "on macOS, the platform of the reference");
  assert.match(job[1], /node-version-file: \.nvmrc/, "with the Node.js of .nvmrc");
  assert.doesNotMatch(job[1], /node-version: /, "and no second, hard-coded version");
  assert.match(job[1], /run: npm run test:reports/, "and it regenerates and compares the reports");
});

// ADR-0116 decision 9, refining ADR-0112 decision 5: the job keeps the report it regenerated, so the file
// committed is the one the reference environment wrote, without a run of the suite on someone's machine.
test("the reference job keeps the report it regenerated as an artifact, and stays red while the committed one differs", () => {
  const ci = loadYaml(readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
  const steps = ci.jobs["lint-and-reports"].steps;
  const at = steps.findIndex((s) => s.run === "npm run test:reports");
  assert.ok(at >= 0, "the job regenerates and compares the reports");
  assert.equal(steps[at].id, "reports", "the comparison step is named, so the upload can follow it");
  assert.ok(!("continue-on-error" in steps[at]), "a stale committed report fails the job: the artifact corrects, it never hides");
  const upload = steps.slice(at + 1).find((s) => /^actions\/upload-artifact@[0-9a-f]{40}$/.test(String(s.uses).split(" ")[0]));
  assert.ok(upload, "an upload follows the comparison, pinned by commit SHA");
  assert.equal(upload.with.name, "junit-reference");
  assert.equal(upload.with.path, "reports/junit.xml", "the file test:reports regenerated in place");
  assert.match(String(upload.if), /always\(\)/, "uploaded when the comparison failed too, which is when it is needed");
  assert.match(String(upload.if), /steps\.reports\.outcome != 'skipped'/, "and never when the regeneration did not run");
});
