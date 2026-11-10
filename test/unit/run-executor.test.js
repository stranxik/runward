// runward-run, the executor of ADR-0120, driven by a fake container runtime (the maintainer's machine
// never starts Docker; the real container runs are the CI job's and the NAS's). What is held here:
//   - the order of a run: the expected set hashed from the checkout before any leg, the install with the
//     network open, a probe that the network is cut, the legs with it cut, writing to the output only;
//   - what it writes: the reports, normalised, at their project-relative paths, one unsigned run
//     Statement that binds them, and its test-result Statement; the same inputs, the same bytes;
//   - that it fails closed: an image not pinned, a runtime that cannot cut the network or ignores it, a
//     policy in the judged tree, scripts left on, no lockfile, a check output of another tree, a leg that
//     writes nothing: exit 3, and the output directory does not exist (decision 3, R1's acceptance:
//     "a run that could not cut the network writes nothing").
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IMAGE, labPolicy, makeLab, runLab, runModule } from "../support/run-lab.js";

const POSIX = process.platform !== "win32";
const skip = POSIX ? false : "runward-run drives a Linux container runtime; its fake runtime is a POSIX executable";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const treeHash = (dir) => {
  const out = [];
  const walk = (d, rel) => { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(join(d, e.name), r); else out.push(`${r} ${sha(readFileSync(join(d, e.name)))}`);
  } };
  walk(dir, "");
  return sha(out.join("\n"));
};

let base, lab;
before(() => {
  if (!POSIX) return;
  base = mkdtempSync(join(tmpdir(), "rw-run-exec-"));
  lab = makeLab(join(base, "lab"));
});
after(() => { if (base) rmSync(base, { recursive: true, force: true }); });
const fresh = () => mkdtempSync(join(base, "case-"));

test("a run: the sources hashed first, the install with the network open, a probe, the legs with it cut, and nothing written into the tree", { skip }, () => {
  const before = treeHash(lab);
  const r = runLab(fresh(), lab);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(treeHash(lab), before, "the legs ran on a copy: the judged tree is byte for byte what it was");
  const runs = r.calls.filter((c) => c.cmd === "run");
  assert.deepEqual(runs.map((c) => c.network), ["bridge", "none", "none", "none"], "install (network open), probe, two legs (network cut)");
  assert.deepEqual(runs[1].command, ["cat", "/proc/net/dev"], "the probe runs before any leg");
  assert.equal(runs[0].mounts.length, 1, "the install sees the copy of the tree, not the output directory");
  for (const leg of runs.slice(2)) {
    assert.deepEqual(leg.mounts.map((m) => m.container), ["/runward-run/work", "/runward-run/out"]);
    assert.ok(leg.mounts.every((m) => m.options === "z"), "labelled for containers, so a runtime that enforces SELinux lets the leg read its mounts");
    assert.equal(leg.workdir, "/runward-run/work/code");
    assert.equal(leg.image, IMAGE, "every container runs the image the policy pins, by digest");
    assert.match(leg.user, /^\d+:\d+$/, "the legs run as this user, never as root");
  }
  const order = r.calls.map((c) => c.cmd);
  assert.deepEqual(order.slice(0, 3), ["version", "pull", "inspect"], "the runtime answers, the image is pulled and named by its digest, before any container");
  const files = readdirSync(join(r.out, "code", "reports")).sort();
  assert.deepEqual(files, ["eslint.json", "eslint.sarif", "junit.xml", "lcov.info", "runward-run.intoto.json", "runward-run.test-result.intoto.json"]);
  for (const f of ["junit.xml", "eslint.json", "eslint.sarif", "lcov.info"]) {
    assert.equal(readFileSync(join(r.out, "code", "reports", f), "utf8"), readFileSync(join(lab, "code", "reports", f), "utf8"), `${f}: normalised, it is byte for byte what the example's own scripts commit`);
  }
});

test("the run Statement: its subjects are the reports, its predicate how they were produced, and the same inputs give the same bytes", { skip }, async () => {
  const { RUN_PREDICATE_TYPE } = await runModule("statement.js");
  const a = runLab(fresh(), lab);
  const b = runLab(fresh(), lab);
  const stA = readFileSync(join(a.out, "code", "reports", "runward-run.intoto.json"));
  assert.equal(stA.toString(), readFileSync(join(b.out, "code", "reports", "runward-run.intoto.json"), "utf8"), "two runs of one tree write one Statement: two signers sign the same payload");
  const st = JSON.parse(stA);
  assert.equal(st._type, "https://in-toto.io/Statement/v1");
  assert.equal(st.predicateType, RUN_PREDICATE_TYPE);
  assert.deepEqual(st.subject.map((s) => s.name), ["code/reports/eslint.json", "code/reports/eslint.sarif", "code/reports/junit.xml", "code/reports/lcov.info"]);
  for (const s of st.subject) assert.equal(s.digest.sha256, sha(readFileSync(join(a.out, ...s.name.split("/")))), `${s.name}: the subject is the SHA-256 of the bytes written`);
  const p = st.predicate;
  assert.equal(p.network, "none");
  assert.deepEqual(p.image, { ref: IMAGE, digest: IMAGE.slice(IMAGE.indexOf("@") + 1) });
  assert.equal(p.lockfile.path, "code/package-lock.json");
  assert.match(p.lockfile.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(p.legs.map((l) => [l.leg, l.exitCode]), [["tests", 0], ["reports", 0]], "every command as run, with its exit code");
  assert.equal(p.install.network, "open");
  const check = JSON.parse(readFileSync(a.checkPath, "utf8"));
  assert.deepEqual(Object.keys(p.sources.files), check.levels.execution.expected.files, "the source set is the one runward derived from the tree, never chosen by the writer");
  assert.equal(p.manifests.digest, check.levels.execution.expected.manifestsDigest);
  assert.equal(p.sources.count, Object.keys(p.sources.files).length);
  assert.match(p.nonScope, /not that it behaved/);
  const tr = JSON.parse(readFileSync(join(a.out, "code", "reports", "runward-run.test-result.intoto.json"), "utf8"));
  assert.equal(tr.predicateType, "https://in-toto.io/attestation/test-result/v0.1", "the tests leg emits the neutral in-toto predicate beside it");
  assert.equal(tr.predicate.result, "PASSED");
  assert.equal(tr.predicate.passedTests.length, 14);
  assert.ok(!JSON.stringify(tr).includes("://node:"), "the image is named by its digest, not by a URI a secret scanner reads as a password");
});

test("a run that cannot cut the network writes nothing, whichever way the runtime fails (ADR-0120 decision 3)", { skip }, () => {
  for (const [what, runtimeEnv] of [
    ["a runtime that refuses --network none", { FAKE_RUNTIME_NO_NETWORK_NONE: "1" }],
    ["a runtime that accepts the flag and leaves an interface up", { FAKE_RUNTIME_LEAK: "1" }],
  ]) {
    const r = runLab(fresh(), lab, { runtimeEnv });
    assert.equal(r.status, 3, `${what}: ${r.stderr}`);
    assert.match(r.stderr, /refused, nothing written: .*network/);
    assert.equal(existsSync(r.out), false, `${what}: the output directory does not exist`);
    assert.equal(r.calls.filter((c) => c.cmd === "run" && c.command[0] === "node" && c.network === "none").length, 0, `${what}: no leg ran`);
  }
});

test("fail closed on everything that would make the run unprovable: exit 3, nothing written", { skip }, () => {
  const cases = [
    ["an image pinned by tag only", { policy: labPolicy({ image: "node:24-bookworm-slim" }) }, /not pinned by digest/],
    ["a runtime that does not answer", { runtimeEnv: { FAKE_RUNTIME_DOWN: "1" } }, /does not answer/],
    ["a runtime that does not name the image by its digest", { runtimeEnv: { FAKE_RUNTIME_DIGESTS: JSON.stringify(["node@sha256:" + "0".repeat(64)]) } }, /does not name the image by the digest/],
    ["npm install scripts left on", { policy: labPolicy({ install: { cwd: "code", lockfile: "code/package-lock.json", command: ["npm", "ci"] } }) }, /without --ignore-scripts/],
    ["an install from no lockfile", { policy: labPolicy({ install: { cwd: "code", lockfile: "code/no-such-lock.json", command: ["node", "-e", "0"] } }) }, /lockfile .* is not in this tree/],
    ["an install that fails", { runtimeEnv: { FAKE_RUNTIME_INSTALL_FAIL: "1" } }, /install .* failed/],
    ["a leg that writes no report", { policy: labPolicy({ legs: [{ leg: "tests", cwd: "code", command: ["node", "-e", "0"], reports: [{ path: "code/reports/junit.xml", nature: "junit" }] }] }) }, /wrote no report/],
  ];
  for (const [what, opts, re] of cases) {
    const r = runLab(fresh(), lab, opts);
    assert.equal(r.status, 3, `${what}: exit ${r.status} ${r.stderr}`);
    assert.match(r.stderr, re, what);
    assert.equal(existsSync(r.out), false, `${what}: nothing written`);
  }
});

test("the policy in the tree, an output inside it, a check output of another tree: each refused by name", { skip }, async () => {
  const { runPolicy, RunRefused, RunUsage } = await runModule("run.js");
  const d = fresh();
  const policyPath = join(d, "p.json");
  writeFileSync(policyPath, JSON.stringify(labPolicy()));
  const r0 = runLab(d, lab);
  assert.equal(r0.status, 0);
  const inTree = join(lab, "code", "run-policy.json");
  writeFileSync(inTree, JSON.stringify(labPolicy()));
  try {
    assert.throws(() => runPolicy({ policyPath: inTree, tree: lab, checkPath: r0.checkPath, out: join(d, "o1") }), (e) => e instanceof RunRefused && /lives in the judged tree/.test(e.message));
  } finally { rmSync(inTree, { force: true }); }
  assert.throws(() => runPolicy({ policyPath, tree: lab, checkPath: r0.checkPath, out: join(lab, "out") }), (e) => e instanceof RunRefused && /inside the judged tree/.test(e.message));
  mkdirSync(join(d, "full"));
  writeFileSync(join(d, "full", "x"), "x");
  assert.throws(() => runPolicy({ policyPath, tree: lab, checkPath: r0.checkPath, out: join(d, "full") }), (e) => e instanceof RunUsage && /not empty/.test(e.message));
  const other = JSON.parse(readFileSync(r0.checkPath, "utf8"));
  other.levels.execution.expected.manifestsDigest = "0".repeat(64);
  const otherPath = join(d, "other-check.json");
  writeFileSync(otherPath, JSON.stringify(other));
  assert.throws(() => runPolicy({ policyPath, tree: lab, checkPath: otherPath, out: join(d, "o2"), runtimeBin: "/nonexistent" }), (e) => e instanceof RunRefused && /not the ones the check output records/.test(e.message));
  const none = JSON.parse(readFileSync(r0.checkPath, "utf8"));
  delete none.levels;
  writeFileSync(otherPath, JSON.stringify(none));
  assert.throws(() => runPolicy({ policyPath, tree: lab, checkPath: otherPath, out: join(d, "o3") }), (e) => e instanceof RunRefused && /expected set is not in the check output/.test(e.message));
});

test("a red leg is a fact: the reports and the Statement are written, the exit code is 1, the Statement records it", { skip }, () => {
  const pol = labPolicy();
  pol.legs[0].command = ["node", "-e", `const fs=require("fs");fs.copyFileSync("reports/junit.xml",process.argv[1]+"/junit.xml");process.exit(1)`, "${out}/code/reports"];
  const r = runLab(fresh(), lab, { policy: pol });
  assert.equal(r.status, 1, r.stderr);
  const st = JSON.parse(readFileSync(join(r.out, "code", "reports", "runward-run.intoto.json"), "utf8"));
  assert.deepEqual(st.predicate.legs.map((l) => l.exitCode), [1, 0]);
  const tr = JSON.parse(readFileSync(join(r.out, "code", "reports", "runward-run.test-result.intoto.json"), "utf8"));
  assert.equal(tr.predicate.result, "FAILED", "the tests leg exited non-zero: the test-result says so whatever the report holds");
});

test("the normalisers take out absolute paths and timings, touch no verdict, and are idempotent", async () => {
  const { normalizeReport } = await runModule("normalize.js");
  const paths = { base: "/runward-run/work/code", work: "/runward-run/work" };
  const junit = `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n\t<testcase name="a" time="0.012" classname="test" file="/runward-run/work/code/test/a.test.ts"/>\n\t<testcase name="b" time="1.5" classname="test" file="/runward-run/work/code/test/a.test.ts">\n\t\t<failure message="boom" type="testCodeFailure">at /runward-run/work/code/test/a.test.ts:3:1</failure>\n\t</testcase>\n\t<!-- duration_ms 12.5 -->\n</testsuites>\n`;
  const j = normalizeReport("junit", junit, paths);
  assert.doesNotMatch(j, /time=|file=|duration_ms|\/runward-run\//);
  assert.match(j, /<failure message="boom"/, "a failure stays a failure");
  assert.match(j, /at test\/a\.test\.ts:3:1/);
  assert.equal(normalizeReport("junit", j, paths), j);
  const eslint = JSON.stringify([{ filePath: "/runward-run/work/code/src/b.ts", messages: [{ ruleId: "no-eval", severity: 2, message: "eval", line: 1, column: 1 }], errorCount: 1, fatalErrorCount: 0, warningCount: 0, source: "eval(x)", usedDeprecatedRules: [] }, { filePath: "/runward-run/work/code/src/a.ts", messages: [], errorCount: 0, fatalErrorCount: 0, warningCount: 0 }]);
  const e = normalizeReport("eslint", eslint, paths);
  assert.deepEqual(JSON.parse(e).map((x) => [x.filePath, x.errorCount]), [["src/a.ts", 0], ["src/b.ts", 1]], "relative, sorted, the error kept");
  assert.equal(normalizeReport("eslint", e, paths), e);
  const lcov = "TN:\nSF:/runward-run/work/code/src/a.ts\nDA:1,1\nend_of_record\n";
  assert.equal(normalizeReport("coverage", lcov, paths), "TN:\nSF:src/a.ts\nDA:1,1\nend_of_record\n");
  const sarif = JSON.stringify({ version: "2.1.0", runs: [{ invocations: [{ startTimeUtc: "2026-11-06T00:00:00Z", executionSuccessful: true }], results: [{ ruleId: "r", locations: [{ physicalLocation: { artifactLocation: { uri: "file:///runward-run/work/code/src/a.ts" } } }] }] }] });
  const s = JSON.parse(normalizeReport("sarif", sarif, paths));
  assert.equal(s.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, "src/a.ts");
  assert.equal(s.runs[0].invocations[0].startTimeUtc, undefined);
  assert.equal(s.runs[0].invocations[0].executionSuccessful, true);
  assert.throws(() => normalizeReport("eslint", "{ not json", paths), "a report that is not its nature's document is refused, never guessed");
});

test("the policy is read strictly: shapes refused as usage, what would make a run unprovable refused as a refusal", async () => {
  const { readPolicy, PolicyError } = await runModule("policy.js");
  const good = labPolicy();
  assert.equal(readPolicy(good).reportsDir, "code/reports");
  const kind = (doc) => { try { readPolicy(doc); return "ok"; } catch (e) { return e instanceof PolicyError ? e.kind : "crash"; } };
  assert.equal(kind({ ...good, format: "x" }), "usage");
  assert.equal(kind({ ...good, image: "node:24" }), "refusal");
  assert.equal(kind({ ...good, image: "node@sha256:abc" }), "refusal");
  assert.equal(kind({ ...good, install: { ...good.install, command: ["pnpm", "install", "--frozen-lockfile"] } }), "refusal");
  assert.equal(kind({ ...good, install: { ...good.install, command: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"] } }), "ok");
  assert.equal(kind({ ...good, legs: [{ ...good.legs[0], command: "node -e 0" }] }), "usage", "a command is an argument vector, never a shell line");
  assert.equal(kind({ ...good, legs: [{ ...good.legs[0], cwd: "../elsewhere" }] }), "usage");
  assert.equal(kind({ ...good, legs: [{ ...good.legs[0], reports: [{ path: "/etc/passwd", nature: "junit" }] }] }), "usage");
  assert.equal(kind({ ...good, legs: [good.legs[0], { ...good.legs[1], reports: [{ path: "elsewhere/lcov.info", nature: "coverage" }] }] }), "usage", "one run, one directory of reports");
  assert.equal(kind({ ...good, legs: [{ ...good.legs[1], leg: "tests" }] }), "usage", "a tests leg writes a JUnit report");
  assert.equal(kind({ ...good, legs: [{ ...good.legs[0], leg: "evals" }] }), "ok", "R3's leg runs like the tests");
  assert.equal(kind({ ...good, legs: [{ ...good.legs[0], leg: "benchmarks" }] }), "usage", "a leg ADR-0120 does not name is a usage error");
});
