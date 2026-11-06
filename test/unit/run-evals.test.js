// ADR-0120 R3, its acceptance: the evals leg. runward-run runs the evals the run policy declares like any
// other leg, the network cut, so only evals that replay recorded outputs or run a pinned local model; their
// report is bound by the run Statement and reads `attested` once signed. An eval that needs a remote model
// is outside runward-run: the policy names its report with no command, runward-run runs nothing for it and
// records it in the Statement as declared, with the reason, and runward names it so on the row that cites
// it, never as « no Statement binds it ».
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkJson, copyLeg, countedEnvelope, labPolicy, makeLab, runLab, runModule } from "../support/run-lab.js";

const POSIX = process.platform !== "win32";
const skip = POSIX ? false : "runward-run drives a Linux container runtime; its fake runtime is a POSIX executable";
const { readPolicy } = await runModule("policy.js");
const REPORTS = join("code", "reports");
const LOCAL = "eval: a request carrying an instruction is classified as data, replayed from recorded outputs";
const REMOTE = "eval: a hosted model grades the approval summary's tone";
const junit = (name) => `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n\t<testcase name="${name}" classname="evals"/>\n</testsuites>\n`;

/** The laboratory, one row citing a local eval and a remote one besides what it cited. */
function evalLab(dir) {
  const lab = makeLab(dir);
  writeFileSync(join(lab, REPORTS, "evals.xml"), junit(LOCAL));
  writeFileSync(join(lab, REPORTS, "evals-remote.xml"), junit(REMOTE));
  const p = join(lab, "runward", "governance", "threat-model.md");
  const row = "| security-prompt-injection | applied | ";
  const text = readFileSync(p, "utf8");
  assert.ok(text.includes(row));
  writeFileSync(p, text.replace(row, `${row}test:code/reports/evals.xml::"${LOCAL}"; test:code/reports/evals-remote.xml::"${REMOTE}"; `));
  return lab;
}
const evalsPolicy = (why = "graded by a hosted model") => {
  const base = labPolicy();
  return { ...base, legs: [...base.legs,
    { leg: "evals", cwd: "code", command: copyLeg(["evals.xml"]), reports: [{ path: "code/reports/evals.xml", nature: "junit" }] },
    { leg: "evals", remote: true, reports: [{ path: "code/reports/evals-remote.xml", nature: "junit" }], ...(why ? { why } : {}) },
  ] };
};

test("the run policy: an evals leg runs like the tests; one whose evals need a remote model names its reports and runs nothing", () => {
  const p = readPolicy(evalsPolicy());
  assert.deepEqual(p.legs.slice(-2).map((l) => [l.leg, !!l.remote, l.command.length > 0]), [["evals", false, true], ["evals", true, false]]);
  const kind = (doc) => { try { readPolicy(doc); return "ok"; } catch (e) { return e.kind; } };
  const base = evalsPolicy();
  assert.equal(kind({ ...base, legs: [...base.legs.slice(0, -1), { ...base.legs.at(-1), command: ["node", "-e", "0"] }] }), "usage", "runward-run never runs an eval that needs the network");
  assert.equal(kind({ ...base, legs: [base.legs.at(-1)] }), "usage", "a run of remote evals alone runs nothing and binds nothing");
  assert.equal(kind({ ...base, legs: [...base.legs, { ...base.legs.at(-1) }] }), "usage", "two legs never name one report");
});

let base, lab, statement;
before(() => {
  if (!POSIX) return;
  base = mkdtempSync(join(tmpdir(), "rw-run-evals-"));
  lab = evalLab(join(base, "lab"));
  const wd = join(base, "run");
  mkdirSync(wd);
  const r = runLab(wd, lab, { policy: evalsPolicy() });
  assert.equal(r.status, 0, r.stderr.slice(-1500));
  cpSync(r.out, lab, { recursive: true });
  const st = readFileSync(join(lab, REPORTS, "runward-run.intoto.json"));
  writeFileSync(join(lab, REPORTS, "runward-run.dsse.json"), countedEnvelope(st));
  statement = JSON.parse(st);
});
after(() => { if (base) rmSync(base, { recursive: true, force: true }); });

test("R3: an eval that needs a remote model reads declared, named; the local eval, run with the network cut, reads attested", { skip }, () => {
  const j = checkJson(lab, "--require", "attested");
  const ours = (r) => r.rule === "security-prompt-injection" && r.deliverable === "governance/threat-model.md";
  const row = [...j.levels.rows.attested, ...j.levels.rows["re-derived"], ...j.levels.rows.declared].find(ours);
  const piece = (report) => row.pieces.find((x) => x.report === report);
  assert.deepEqual([piece("code/reports/evals.xml").level, piece("code/reports/evals.xml").statement], ["attested", "code/reports/runward-run.dsse.json"]);
  const remote = piece("code/reports/evals-remote.xml");
  assert.equal(remote.level, "declared");
  assert.match(remote.why, /^an eval that needs a remote model: runward-run runs every leg with the network cut, so this report is produced outside it and its result stays declared \(ADR-0120 decision 2\); the run policy says: graded by a hosted model$/);
  assert.equal(row.level, "re-derived", "a row that cites it does not reach attested");
  const below = j.levels.below.find(ours);
  assert.ok(below.holds.some((h) => h.startsWith("execution: declared — code/reports/evals-remote.xml (an eval that needs a remote model")), below.holds.join("; "));
});

test("R3: the Statement binds the local eval's report and names the remote one, never as a subject; a run without one keeps its bytes", { skip }, () => {
  const p = statement.predicate;
  assert.deepEqual(p.legs.map((l) => l.leg), ["tests", "reports", "evals"], "the remote leg did not run");
  assert.ok(statement.subject.some((s) => s.name === "code/reports/evals.xml"));
  assert.ok(!statement.subject.some((s) => s.name === "code/reports/evals-remote.xml"), "a report produced outside the run is never one of its subjects");
  assert.deepEqual(p.declared.map((d) => [d.path, d.nature, d.leg]), [["code/reports/evals-remote.xml", "junit", "evals"]]);
  const plain = mkdtempSync(join(base, "plain-"));
  const tree = makeLab(join(plain, "lab"));
  const r = runLab(plain, tree);
  assert.equal(r.status, 0, r.stderr);
  assert.equal("declared" in JSON.parse(readFileSync(join(r.out, REPORTS, "runward-run.intoto.json"), "utf8")).predicate, false);
});
