// ADR-0112: runward's committed JUnit report has one reference environment, macOS and the Node.js of
// `.nvmrc`. The generator writes `<!-- generated: node vX.Y.Z <platform> -->` into the report; the comment
// is outside what the gate and the seal read; `npm run test:reports` refuses a committed report whose
// comment names another environment, or none, and says how to regenerate it; `engines` stays the floor.
import { test } from "node:test";
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
