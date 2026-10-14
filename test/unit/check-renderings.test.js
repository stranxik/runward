// ADR-0096: the verdict rendered as a Code Quality report and as a JUnit XML, written to files
// beside an unchanged stdout, and the loop closed: a JUnit runward wrote is never evidence.
//
// What runs here: the CLI on example missions, made red one way at a time. What does not run here:
// GitLab. Whether its widget reads the files as the format documentation says is the offline
// bench's measurement (ADR-0094), not this file's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CLAIMS_RULES, NEGATED } from "../../dist/lib/claims-rules.js";
import { buildCodeQuality, buildJUnit, xmlEscape } from "../../dist/lib/renderings.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "renderings");
const UPDATE = process.env.UPDATE_GOLDEN === "1";
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8" });

function example() {
  const root = mkdtempSync(join(tmpdir(), "rw-render-"));
  spawnSync("git", ["init", "-q", "."], { cwd: root });
  run(root, "init", "--yes", "--example");
  assert.equal(run(root, "check", "--strict").status, 0, "the fixture must start green");
  return root;
}

/** Run check with both renderings into a directory outside the mission; return the run and both files. */
function rendered(root, ...flags) {
  const out = mkdtempSync(join(tmpdir(), "rw-render-out-"));
  try {
    const cq = join(out, "cq.json"), ju = join(out, "junit.xml");
    const r = run(root, "check", ...flags, "--codequality", cq, "--junit", ju);
    return {
      r,
      cq: existsSync(cq) ? readFileSync(cq, "utf8") : null,
      junit: existsSync(ju) ? readFileSync(ju, "utf8") : null,
    };
  } finally { rmSync(out, { recursive: true, force: true }); }
}

/** The stamp names the version and the payload digest, both of which move with a release: the
 *  golden file holds a placeholder, and determinism of the digest is asserted separately. */
const normalize = (xml) => xml.replace(/runward\/[0-9][^ "]* payload-sha256:[0-9a-f]{64}/g, "runward/<version> payload-sha256:<digest>");

function golden(name, text) {
  const file = join(GOLDEN, name);
  if (UPDATE) { mkdirSync(GOLDEN, { recursive: true }); writeFileSync(file, text); }
  assert.ok(existsSync(file), `${name} is missing: run with UPDATE_GOLDEN=1 once, then read the diff`);
  assert.equal(text, readFileSync(file, "utf8"), `${name} differs from its golden file`);
}

const SCENARIOS = [
  ["green", [], () => {}, 0],
  ["red", [], (root) => writeFileSync(join(root, "runward/handover.md"), "# X\n\n[TODO]\n"), 1],
  ["missing-file", [], (root) => rmSync(join(root, "runward/handover.md")), 1],
  ["deferred", ["--through", "floor"], (root) => writeFileSync(join(root, "runward/handover.md"), "# X\n\n[TODO]\n"), 0],
];

test("ADR-0096: the Code Quality and JUnit renderings match their golden files (green, red, missing file, deferred)", () => {
  for (const [name, extra, breakIt, code] of SCENARIOS) {
    const root = example();
    try {
      breakIt(root);
      const { r, cq, junit } = rendered(root, "--strict", ...extra);
      assert.equal(r.status, code, `${name}: ${r.stderr}`);
      golden(`${name}.codequality.json`, cq);
      golden(`${name}.junit.xml`, normalize(junit));
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("ADR-0096: every Code Quality issue carries GitLab's required fields, and the JUnit is well-formed with the counts it declares", () => {
  const root = example();
  try {
    rmSync(join(root, "runward/handover.md"));
    writeFileSync(join(root, "runward/adr/DRAFT-0099-guess.md"), "# Draft\n\n**Status**: hypothesis\n\nwhy: UNKNOWN\n");
    const { r, cq, junit } = rendered(root, "--strict");
    assert.equal(r.status, 1);
    const issues = JSON.parse(cq);
    assert.ok(issues.length >= 2, "the mission must be red on several causes");
    for (const i of issues) {
      assert.deepEqual(Object.keys(i), ["description", "check_name", "fingerprint", "severity", "location"]);
      assert.equal(typeof i.description, "string");
      assert.match(i.description, /\(runward gate: presence, pointers, integrity; not a code-quality or security judgement\)$/);
      assert.match(i.check_name, /^runward\//);
      assert.match(i.fingerprint, /^[0-9a-f]{64}$/);
      assert.ok(["blocker", "info"].includes(i.severity));
      assert.doesNotMatch(i.location.path, /\\|^\/|^[A-Za-z]:/, "repository-relative, forward slashes");
      assert.ok(Number.isInteger(i.location.lines.begin) && i.location.lines.begin >= 1);
    }
    assert.equal(new Set(issues.map((i) => i.fingerprint)).size, issues.length, "fingerprints are unique in a report");
    assert.ok(issues.some((i) => i.check_name === "runward/unratified-decision" && i.location.path === "runward/adr/DRAFT-0099-guess.md"));
    assert.ok(issues.some((i) => i.check_name === "runward/deliverable-not-filled" && i.location.path === "runward/handover.md" && i.location.lines.begin === 1),
      "a missing file anchors to the path it is about, line 1 (ADR-0063)");

    assert.match(junit, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<testsuites name="runward gate verdict" /);
    const suites = [...junit.matchAll(/<testsuite name="([^"]*)" tests="(\d+)" failures="(\d+)" errors="0" skipped="(\d+)">([\s\S]*?)<\/testsuite>/g)];
    assert.ok(suites.length >= 2);
    let tests = 0, failures = 0;
    for (const [, name, t, f, s, body] of suites) {
      assert.match(name, /\(no test executed\)$/, "every suite says no test was executed");
      assert.equal((body.match(/<testcase\b/g) ?? []).length, Number(t), `${name}: tests`);
      assert.equal((body.match(/<failure\b/g) ?? []).length, Number(f), `${name}: failures`);
      assert.equal((body.match(/<skipped\b/g) ?? []).length, Number(s), `${name}: skipped`);
      assert.match(body, /<property name="runward\.rendering" value="runward\/[^"]+ payload-sha256:[0-9a-f]{64}"\/>/);
      tests += Number(t); failures += Number(f);
    }
    assert.match(junit, new RegExp(`<testsuites name="runward gate verdict" tests="${tests}" failures="${failures}"`));
    assert.match(suites[0][5], /<testcase name="runward gate" classname="runward">\s*<failure /, "the gate case fails on exit 1");
    assert.equal(failures, issues.length + 1, "one failing case per cause, plus the gate case");
    // Every opened element is closed, in order: a cheap well-formedness check without an XML library.
    const stack = [];
    for (const m of junit.matchAll(/<(\/?)([a-z]+)\b[^>]*?(\/?)>/g)) {
      if (m[3] === "/") continue;
      if (m[1] === "/") assert.equal(stack.pop(), m[2]); else stack.push(m[2]);
    }
    assert.deepEqual(stack, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ADR-0096: XML escaping, and the claims guard applied to the rendered text", () => {
  const nasty = [{ ruleId: "runward/x", level: "error", text: `a <b> & "c" 'd' \u0001 end`, uri: "runward/a&b.md", line: 3, rule: "x", scope: "S<1>" }];
  const xml = buildJUnit(nasty, { version: "0.0.0", payloadDigest: "0".repeat(64), strict: true, exitCode: 1, through: null });
  assert.ok(xml.includes("a &lt;b&gt; &amp; &quot;c&quot; &apos;d&apos; � end"));
  assert.ok(xml.includes('classname="runward/a&amp;b.md"'));
  assert.ok(xml.includes('name="S&lt;1&gt; (no test executed)"'));
  assert.equal(xmlEscape("\uD800x"), "�x", "a lone surrogate is replaced, never written");
  const cq = JSON.stringify(buildCodeQuality(nasty));
  const root = example();
  try {
    writeFileSync(join(root, "runward/handover.md"), "# X\n\n[TODO]\n");
    const { cq: realCq, junit } = rendered(root, "--strict");
    for (const text of [xml, cq, realCq, junit]) {
      for (const line of text.split("\n")) {
        for (const rule of CLAIMS_RULES) {
          if (rule.re.test(line) && !NEGATED.test(line)) assert.fail(`rendered text makes the claim "${rule.name}": ${line}`);
        }
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ADR-0096: fingerprints are stable across runs and survive a moved row; two homonymous causes get two fingerprints", () => {
  const root = example();
  try {
    const floor = join(root, "runward/floor.md");
    const original = readFileSync(floor, "utf8");
    // Blank the status of one row: one located cause on that row.
    const row = original.split("\n").find((l) => l.startsWith("| security-prompt-injection |"));
    assert.ok(row, "the example carries the row this case edits");
    const broken = original.replace(row, "| security-prompt-injection |  |  |");
    writeFileSync(floor, broken);
    const first = JSON.parse(rendered(root, "--strict").cq);
    const second = JSON.parse(rendered(root, "--strict").cq);
    assert.deepEqual(first, second, "two runs, the same report");
    const issue = first.find((i) => i.check_name === "runward/security-prompt-injection");
    assert.ok(issue, JSON.stringify(first.map((i) => i.check_name)));
    // Move the row: three blank lines above the table shift every line, the identity does not move.
    writeFileSync(floor, broken.replace("## Rule conformance", "\n\n\n## Rule conformance"));
    const moved = JSON.parse(rendered(root, "--strict").cq).find((i) => i.check_name === "runward/security-prompt-injection");
    assert.equal(moved.location.lines.begin, issue.location.lines.begin + 3, "the row did move");
    assert.equal(moved.fingerprint, issue.fingerprint, "a moved row keeps its fingerprint");
    // The JUnit digest is deterministic too.
    const stamp = (x) => x.match(/payload-sha256:([0-9a-f]{64})/)[1];
    assert.equal(stamp(rendered(root, "--strict").junit), stamp(rendered(root, "--strict").junit));
  } finally { rmSync(root, { recursive: true, force: true }); }
  const twin = { ruleId: "runward/r", level: "error", text: "t", uri: "runward/floor.md", line: 9, rule: "r", scope: "Floor" };
  const [a, b] = buildCodeQuality([twin, { ...twin, text: "another pointer refused" }]);
  assert.notEqual(a.fingerprint, b.fingerprint, "two refusals on one row are two issues");
  assert.equal(buildCodeQuality([{ ...twin, line: 40 }])[0].fingerprint, a.fingerprint, "the line is not in the fingerprint");
});

test("ADR-0096: stdout and the exit code are byte-identical with and without the renderings", () => {
  const root = example();
  try {
    writeFileSync(join(root, "runward/handover.md"), "# X\n\n[TODO]\n");
    for (const mode of [[], ["--json"], ["--sarif"]]) {
      const plain = run(root, "check", "--strict", ...mode);
      const { r } = rendered(root, "--strict", ...mode);
      assert.equal(r.status, plain.status, `${mode.join(" ") || "human"}: exit code`);
      assert.equal(r.status, 1);
      assert.equal(r.stdout, plain.stdout, `${mode.join(" ") || "human"}: stdout`);
      assert.match(r.stderr, /--codequality written: .*\n.*--junit written: /);
    }
    // Without --strict too: the deliverable half, and the document says which.
    const { r, junit } = rendered(root);
    assert.equal(r.status, 1);
    assert.match(junit, /<property name="runward\.strict" value="false"\/>/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ADR-0096: a rendering path inside runward/, in a missing directory or at a foreign file is refused with exit 2 before the gate runs; a failed write is exit 2", () => {
  const root = example();
  const out = mkdtempSync(join(tmpdir(), "rw-render-bad-"));
  try {
    const foreign = join(out, "theirs.xml");
    writeFileSync(foreign, "<testsuites><testsuite name=\"theirs\"/></testsuites>\n");
    for (const [flag, path, why] of [
      ["--junit", join(root, "runward", "junit.xml"), /lies inside runward\//],
      ["--codequality", join(out, "nope", "cq.json"), /does not exist/],
      ["--junit", foreign, /exists and is not a report runward wrote/],
      ["--codequality", out, /is a directory/],
    ]) {
      const r = run(root, "check", "--strict", flag, path);
      assert.equal(r.status, 2, `${flag} ${path}: ${r.stderr}`);
      assert.match(r.stderr, why);
      assert.doesNotMatch(r.stdout, /gate audit/, "refused before the gate runs: no partial audit");
    }
    assert.equal(readFileSync(foreign, "utf8"), "<testsuites><testsuite name=\"theirs\"/></testsuites>\n", "the foreign file is untouched");
    assert.ok(!existsSync(join(root, "runward", "junit.xml")));
    // A write that fails after the verdict: a name the file system refuses once the temporary
    // suffix is added (255 bytes). Exit 2, named, and nothing left behind.
    const long = join(out, `${"x".repeat(248)}.xml`);
    const w = run(root, "check", "--strict", "--junit", long);
    assert.equal(w.status, 2, w.stderr);
    assert.match(w.stderr, /--junit .* could not be written \([A-Z]+\): nothing was written/);
    assert.ok(!existsSync(long));
    // A file runward wrote is overwritten in place, run after run.
    const own = join(out, "own.xml");
    assert.equal(run(root, "check", "--strict", "--junit", own).status, 0);
    assert.equal(run(root, "check", "--strict", "--junit", own).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); }
});

test("ADR-0096: --codequality, --junit and --witness naming one file is a usage error", () => {
  const root = example();
  try {
    const r = run(root, "check", "--strict", "--codequality", "x.out", "--junit", "x.out");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--codequality and --junit name the same file/);
    const w = run(root, "check", "--strict", "--witness", "w.json", "--junit", "./w.json");
    assert.equal(w.status, 2);
    assert.match(w.stderr, /--witness and --junit name the same file/);
    assert.ok(!existsSync(join(root, "x.out")) && !existsSync(join(root, "w.json")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ADR-0096: a JUnit runward wrote, cited as evidence, is refused by name; the same file without the property resolves (positive control)", () => {
  const root = example();
  try {
    const report = join(root, "code", "reports", "junit.xml");
    const ordinary = readFileSync(report, "utf8");
    // 1. The example cites an ordinary JUnit, and is green on it: the refusal does not touch it.
    assert.equal(run(root, "check", "--strict").status, 0);
    // 2. The same file, marked as a runward rendering: refused, by name, on the row that cites it.
    writeFileSync(report, ordinary.replace("<testsuites>", "<testsuites>\n\t<testsuite name=\"t\"><properties><property name=\"runward.rendering\" value=\"planted\"/></properties></testsuite>"));
    const red = run(root, "check", "--strict", "--json");
    assert.equal(red.status, 1, "a runward rendering cited as evidence reddens the gate");
    const rows = JSON.parse(red.stdout).conformance.filter((c) => c.rule === "frontier-deterministic-boundary");
    assert.ok(rows.some((c) => c.kind === "evidence-refused" && /a JUnit report runward itself wrote .*a previous verdict is not evidence for this one \(ADR-0096\)/.test(c.problem)),
      JSON.stringify(rows));
    // 3. Positive control: the property removed, the same pointer resolves as before.
    writeFileSync(report, ordinary);
    assert.equal(run(root, "check", "--strict").status, 0, "without the property the row resolves");
    // 4. A file `check --junit` actually wrote, cited by a row: refused too.
    const own = join(root, "code", "reports", "runward-junit.xml");
    assert.equal(run(root, "check", "--strict", "--junit", own).status, 0);
    assert.match(readFileSync(own, "utf8"), /<testcase name="runward gate" classname="runward"\/>/, "a green rendering's gate case passes");
    const floor = join(root, "runward", "floor.md");
    const text = readFileSync(floor, "utf8");
    writeFileSync(floor, text.replace("test:code/test/triage.test.ts — threat-model §3", "test:code/reports/runward-junit.xml::runward gate — threat-model §3"));
    const own2 = JSON.parse(run(root, "check", "--strict", "--json").stdout);
    assert.equal(own2.exitCode, 1);
    assert.ok(own2.conformance.some((c) => c.rule === "security-prompt-injection" && /a JUnit report runward itself wrote/.test(c.problem)),
      JSON.stringify(own2.conformance));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
