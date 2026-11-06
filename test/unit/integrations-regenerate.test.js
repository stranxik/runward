// The step every recipe of runward-integrations runs, on every forge (runward ADR-0122 decision 1): the
// project's command writes its report to {raw}, outside the tree; the recipe normalises it and replaces the
// cited report. Held here through the CLI the forges call, with commands that stand in for a test runner,
// a coverage run and a scanner by writing what those tools write:
//   - the cited report is replaced by the normalised one, red or green, and the step exits with the tool;
//   - a command that writes no report of the recipe's format is refused (exit 3), and the cited report is
//     REMOVED, so that a gate after it cannot read a report this tree did not produce;
//   - a usage error changes nothing (exit 2);
//   - every run says what it wrote is declared (ADR-0119 decision 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../support/run-lab.js";

const CLI = join(ROOT, "packages", "runward-integrations", "src", "cli.js");
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
function project() {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "rwi-regen-")));
  dirs.push(d);
  mkdirSync(join(d, "code", "reports"), { recursive: true });
  return d;
}
const regen = (cwd, recipe, report, command, extra = []) =>
  spawnSync(process.execPath, [CLI, "regenerate", "--recipe", recipe, "--cwd", cwd, "--report", report, "--command", JSON.stringify(command), ...extra],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
/** A command that writes `body` to {raw} and exits `code`. In `body`, `<path:a/b>` is the absolute path of
 *  a/b under the working directory and `<url:a/b>` its file:// URL, spelled as this platform's tools spell them. */
const writer = (body, code = 0) => ["node", "-e",
  `const { join } = require("path"); const { pathToFileURL } = require("url");
   const abs = (rel) => join(process.cwd(), ...rel.split("/"));
   const text = process.argv[2] === "<empty>" ? "" : process.argv[2]
     .replace(/<path:([^>]+)>/g, (_, r) => abs(r)).replace(/<url:([^>]+)>/g, (_, r) => pathToFileURL(abs(r)).href);
   require("fs").writeFileSync(process.argv[1], text); process.exit(${code})`, "{raw}", body === "" ? "<empty>" : body];

const JUNIT = (verdict) => `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n\t<testcase name="the case" classname="test" time="0.01" file="<path:test/a.test.ts>"${verdict === "red"
  ? `>\n\t\t<failure message="boom">at <path:test/a.test.ts>:3:1</failure>\n\t</testcase>` : "/>"}\n\t<!-- duration_ms 4.2 -->\n</testsuites>\n`;

test("a green run replaces the cited report with the normalised one, exit 0, and says it is declared", () => {
  const d = project();
  writeFileSync(join(d, "code", "reports", "junit.xml"), "<testsuites><testcase name=\"the case\"/></testsuites>\n"); // the committed one
  const r = regen(join(d, "code"), "junit", "reports/junit.xml", writer(JUNIT("green")));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = readFileSync(join(d, "code", "reports", "junit.xml"), "utf8");
  assert.doesNotMatch(out, new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "no absolute path");
  assert.doesNotMatch(out, /time=|file=|duration_ms/);
  assert.match(r.stdout, /wrote reports\/junit\.xml from the project's own run \(1 case\(s\), 0 not green; tool exit 0\)/);
  assert.match(r.stdout, /declared: a plain CI step binds nothing to the tree/);
});

test("a red run writes the red report and exits 1: a red tool is recorded, never hidden", () => {
  const d = project();
  const r = regen(join(d, "code"), "junit", "reports/junit.xml", writer(JUNIT("red"), 1));
  assert.equal(r.status, 1);
  const out = readFileSync(join(d, "code", "reports", "junit.xml"), "utf8");
  assert.ok(out.includes(`<failure message="boom">at ${join("test", "a.test.ts")}:3:1</failure>`), "the failure is kept, its stack relative");
  assert.match(r.stdout, /1 not green; tool exit 1/);
});

test("a command that writes no report of the recipe's format is refused, exit 3, and the cited report is removed", () => {
  for (const [why, command] of [
    ["no file at {raw}", ["node", "-e", "process.exit(0)", "{raw}"]],
    ["an empty file", writer("")],
    ["another format", writer("{\"not\": \"junit\"}")],
  ]) {
    const d = project();
    const cited = join(d, "code", "reports", "junit.xml");
    writeFileSync(cited, "<testsuites><testcase name=\"the case\"/></testsuites>\n");
    const r = regen(join(d, "code"), "junit", "reports/junit.xml", command);
    assert.equal(r.status, 3, `${why}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /was removed so that the gate cannot read a report this tree did not produce/);
    assert.ok(!existsSync(cited), `${why}: the committed report a gate would have read as this tree's is gone`);
  }
});

test("coverage: a run that measured nothing writes an empty tracefile and exits 1; SARIF: rules and results counted", () => {
  const d = project();
  let r = regen(join(d, "code"), "coverage", "reports/lcov.info", writer(""));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(readFileSync(join(d, "code", "reports", "lcov.info"), "utf8"), "");
  assert.match(r.stdout, /0 source file\(s\), 0 executed: it records no source file, which is not evidence/);
  r = regen(join(d, "code"), "coverage", "reports/lcov.info", writer("TN:\nSF:<path:src/x.ts>\nDA:1,2\nLH:1\nLF:1\nend_of_record\n"));
  assert.equal(r.status, 0);
  assert.equal(readFileSync(join(d, "code", "reports", "lcov.info"), "utf8"), "TN:\nSF:src/x.ts\nDA:1,2\nLH:1\nLF:1\nend_of_record\n");
  const log = { version: "2.1.0", runs: [{ tool: { driver: { name: "s", rules: [{ id: "a" }] } }, results: [{ ruleId: "a", level: "error", message: { text: "m" },
    locations: [{ physicalLocation: { artifactLocation: { uri: "<url:src/x.ts>" }, region: { startLine: 1 } } }] }] }] };
  r = regen(join(d, "code"), "sarif", "reports/scan.sarif", writer(JSON.stringify(log), 1));
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(readFileSync(join(d, "code", "reports", "scan.sarif"), "utf8")).runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, "src/x.ts");
  assert.match(r.stdout, /1 rule\(s\) in force, 1 result\(s\)/);
});

test("{rwi} names the package, and `node` is the Node.js running the step", () => {
  const d = project();
  const probe = ["node", "-e", `require("fs").writeFileSync(process.argv[1], '<testsuites><testcase name="' + require("path").basename(process.argv[2]) + '|' + (process.execPath === ${JSON.stringify(process.execPath)}) + '"/></testsuites>')`, "{raw}", "{rwi}"];
  const r = regen(join(d, "code"), "junit", "reports/junit.xml", probe);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(readFileSync(join(d, "code", "reports", "junit.xml"), "utf8"), /name="runward-integrations\|true"/);
});

test("a usage error changes nothing (exit 2): unknown recipe, a shell line, no {raw}, a report outside the directory", () => {
  const d = project();
  const cited = join(d, "code", "reports", "junit.xml");
  writeFileSync(cited, "committed\n");
  for (const [why, args, re] of [
    ["unknown recipe", ["regenerate", "--recipe", "pytest", "--report", "reports/junit.xml", "--command", "[\"x\",\"{raw}\"]"], /unknown recipe/],
    ["a shell line", ["regenerate", "--recipe", "junit", "--report", "reports/junit.xml", "--command", "npm test > {raw}"], /not a JSON argument vector/],
    ["no {raw}", ["regenerate", "--recipe", "junit", "--report", "reports/junit.xml", "--command", "[\"npm\",\"test\"]"], /names no \{raw\}/],
    ["an escaping report", ["regenerate", "--recipe", "junit", "--report", "../outside.xml", "--command", "[\"x\",\"{raw}\"]"], /not a path relative to the working directory/],
    ["an absolute report", ["regenerate", "--recipe", "junit", "--report", "/tmp/x.xml", "--command", "[\"x\",\"{raw}\"]"], /not a path relative/],
    ["missing arguments", ["regenerate", "--recipe", "junit"], /usage: regenerate/],
  ]) {
    const r = spawnSync(process.execPath, [CLI, ...args, "--cwd", join(d, "code")], { encoding: "utf8" });
    assert.equal(r.status, 2, `${why}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, re, why);
    assert.equal(readFileSync(cited, "utf8"), "committed\n", `${why}: the cited report is untouched`);
  }
});

test("on GitHub, the step writes its outputs and its summary line", () => {
  const d = project();
  const out = join(d, "gh-output"), summary = join(d, "gh-summary");
  const r = regen(join(d, "code"), "junit", "reports/junit.xml", writer(JUNIT("green")), ["--github-output", out, "--summary", summary]);
  assert.equal(r.status, 0);
  assert.equal(readFileSync(out, "utf8"), "tool-exit=0\nreport=reports/junit.xml\n");
  assert.match(readFileSync(summary, "utf8"), /^- runward-integrations junit: wrote reports\/junit\.xml/);
});
