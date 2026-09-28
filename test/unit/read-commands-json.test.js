// `status`, `doctor`, `manifest`, `propose`, `report` and `compliance` had no machine output: an agent
// driving a mission had to parse coloured, decorated text whose labels change between releases
// (audit of what the CLI prints, 2026-09-27). ADR-0030 had deferred them "as the driving loop demands
// them"; each now takes `--json`: one document on stdout and nothing else, the exit code unchanged.
//
// Every test parses the WHOLE of stdout, so a single stray human line fails it, and runs the command
// twice: under NO_COLOR, and with colour forced on, because a pipe (spawnSync is never a TTY) is where
// an agent reads it and colour codes are the likeliest pollution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const BASE = { ...process.env, RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-28" };
delete BASE.NO_COLOR;
delete BASE.FORCE_COLOR;
const ENVS = [{ ...BASE, NO_COLOR: "1" }, { ...BASE, FORCE_COLOR: "3" }];
const run = (cwd, env, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env });

/** Run under both environments; stdout must be exactly one JSON document, the same both times. */
function json(cwd, ...a) {
  const docs = ENVS.map((env) => {
    const r = run(cwd, env, ...a);
    assert.doesNotMatch(r.stdout, /\u001b\[/, `no colour code on stdout (${a.join(" ")})`);
    let doc;
    assert.doesNotThrow(() => { doc = JSON.parse(r.stdout); }, `stdout is one JSON document (${a.join(" ")}): ${r.stdout.slice(0, 200)}`);
    return { status: r.status, doc };
  });
  assert.equal(docs[0].status, docs[1].status);
  return docs[docs.length - 1];
}

function mission(example) {
  const dir = mkdtempSync(join(tmpdir(), "rw-read-json-"));
  const r = run(dir, ENVS[0], "--yes", "init", ...(example ? ["--example"] : []));
  assert.ok(r.status === 0 || r.status === 1, r.stderr);
  return dir;
}
const clean = (dir) => rmSync(dir, { recursive: true, force: true });

test("json surface: status carries the gate, the deliverables and the strict verdict", () => {
  const dir = mission(false);
  try {
    const { status, doc } = json(dir, "status", "--json");
    assert.equal(status, 0);
    assert.equal(doc.runward, JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version);
    assert.equal(doc.strict, true);
    assert.equal(doc.verdict, "gaps");
    assert.equal(doc.currentPhaseId, "frame");
    assert.ok(doc.gaps.deliverables > 0);
    const frame = doc.phases.find((p) => p.id === "frame");
    assert.equal(frame.current, true);
    assert.ok(frame.deliverables.some((d) => d.deliverable === "runward/framing.md" && d.state !== "filled"));
    // Same function, same meaning as `check --json`.
    const check = JSON.parse(run(dir, ENVS[0], "check", "--strict", "--json").stdout);
    assert.equal(doc.currentGate, check.currentGate);
    assert.equal(doc.verdict, check.verdict);
    assert.equal(doc.gaps.conformance, check.gaps.conformance);
    assert.ok(Array.isArray(doc.adrs) && Array.isArray(doc.reopening.triggers));
  } finally { clean(dir); }
  const ex = mission(true);
  try {
    const { doc } = json(ex, "status", "--json");
    assert.equal(doc.verdict, "clean");
    assert.equal(doc.arcComplete, true);
    assert.ok(doc.adrs.length > 0 && doc.adrs.every((a) => a.date === null || /^\d{4}-\d{2}-\d{2}$/.test(a.date) || a.date === "unreadable"));
  } finally { clean(ex); }
});

test("json surface: doctor lists every check with its status, and -p points at the project", () => {
  const dir = mission(true);
  const elsewhere = mkdtempSync(join(tmpdir(), "rw-read-json-cwd-"));
  try {
    const { status, doc } = json(elsewhere, "doctor", "-p", dir, "--json");
    assert.equal(status, doc.exitCode);
    assert.equal(doc.health, doc.critical > 0 ? "critical" : doc.warnings > 0 ? "warnings" : "ok");
    assert.ok(doc.checks.length > 0);
    for (const c of doc.checks) {
      assert.ok(["environment", "package", "mission"].includes(c.section));
      assert.ok(["ok", "warning", "critical"].includes(c.status));
      assert.equal(typeof c.message, "string");
    }
    assert.equal(doc.checks.filter((c) => c.status === "warning").length, doc.warnings);
    assert.ok(doc.mission, "-p found the mission from another directory");
    assert.ok(doc.checks.some((c) => c.section === "mission" && /mission found/.test(c.message)));
  } finally { clean(dir); clean(elsewhere); }
});

test("json surface: manifest lists every row with its status, and --sync says what it appended", () => {
  const dir = mission(false);
  try {
    const before = json(dir, "manifest", "--json").doc;
    assert.equal(before.sync, false);
    assert.ok(before.missingRows > 0);
    const arch = before.deliverables.find((d) => d.deliverable === "runward/architecture.md");
    assert.ok(arch.missing.length > 0);
    assert.deepEqual(arch.added, []);
    assert.equal(arch.written, false);

    const r = run(dir, ENVS[0], "manifest", "--sync", "--json");
    assert.equal(r.status, 0);
    const synced = JSON.parse(r.stdout);
    const a2 = synced.deliverables.find((d) => d.deliverable === "runward/architecture.md");
    assert.equal(a2.written, true);
    assert.deepEqual(a2.added, arch.missing);
    for (const slug of a2.added) assert.ok(a2.rows.some((row) => row.rule === slug && row.status === ""), slug);

    const after = json(dir, "manifest", "--json").doc;
    assert.equal(after.missingRows, 0);
  } finally { clean(dir); }
});

test("json surface: propose names each proposal and each row left empty with its cause", () => {
  const dir = mission(true);
  try {
    const f = join(dir, "runward", "handover.md");
    writeFileSync(f, readFileSync(f, "utf8").replace(/^\| handover-agents-charter-final \| applied \| [^\n]*\|$/m, "| handover-agents-charter-final |  |  |"));
    // Measured under --dry-run first, so both environments see the same tree.
    const dry = json(dir, "--dry-run", "propose", "--json").doc;
    assert.equal(dry.dryRun, true);
    assert.equal(dry.counts.proposed, 1);
    assert.deepEqual(dry.proposals[0], {
      deliverable: "runward/handover.md", rule: "handover-agents-charter-final",
      status: "proposed:applied", evidence: "file:AGENTS.md", signature: dry.proposals[0].signature,
    });
    assert.ok(dry.proposals[0].signature.length > 0);
    assert.equal(dry.counts.leftEmpty, dry.leftEmpty.length);
  } finally { clean(dir); }
  const fresh = mission(false);
  try {
    assert.equal(run(fresh, ENVS[0], "manifest", "--sync").status, 0);
    const doc = json(fresh, "--dry-run", "propose", "--json").doc;
    assert.equal(doc.counts.leftEmpty, doc.leftEmpty.length);
    assert.ok(doc.leftEmpty.length > 0);
    for (const e of doc.leftEmpty) assert.ok(["scaffolded-file-untouched", "signature-not-found", "no-signature", "no-territory"].includes(e.cause), e.cause);
  } finally { clean(fresh); }
});

test("json surface: report names the file, the verdict and the next step, and dry-run writes nothing", () => {
  const dir = mission(false);
  try {
    const dry = json(dir, "--dry-run", "report", "--json").doc;
    assert.equal(dry.dryRun, true);
    assert.equal(dry.written, false);
    assert.equal(dry.file, "runward/governance/delivery-report.html");
    assert.equal(dry.verdict, "gaps");
    assert.equal(dry.subjectDigest, null);
    assert.equal(existsSync(join(dir, dry.file)), false);
    const check = JSON.parse(run(dir, ENVS[0], "check", "--strict", "--json").stdout);
    assert.deepEqual(dry.next, check.next);

    const { status, doc } = json(dir, "report", "--json");
    assert.equal(status, 0);
    assert.equal(doc.written, true);
    assert.equal(doc.replaced, true, "the second of the two runs replaced the first one's report");
    assert.match(doc.subjectDigest, /^[0-9a-f]{64}$/);
    assert.ok(existsSync(join(dir, doc.file)));
  } finally { clean(dir); }
});

test("json surface: compliance names the regime, the files and the verdict the pack carries", () => {
  const dir = mission(true);
  try {
    const { status, doc } = json(dir, "compliance", "iso-42001", "--json");
    assert.equal(status, 0);
    assert.equal(doc.regime, "iso-42001");
    assert.equal(typeof doc.regimeVersion, "string");
    assert.deepEqual(doc.files, ["runward/compliance/iso-42001-readiness.md", "runward/compliance/oscal-component-definition.json"]);
    for (const f of doc.files) assert.ok(existsSync(join(dir, f)), f);
    assert.equal(doc.written, true);
    assert.equal(doc.verdict, "clean");
    assert.equal(doc.summary.asiCategories, 10);
  } finally { clean(dir); }
});

test("json surface: without a mission each command emits the no-mission shape of check --json, exit 2", () => {
  const empty = mkdtempSync(join(tmpdir(), "rw-read-json-none-"));
  try {
    for (const args of [["status"], ["manifest"], ["propose"], ["report"], ["compliance", "iso-42001"]]) {
      const { status, doc } = json(empty, ...args, "--json");
      assert.equal(status, 2, args[0]);
      assert.deepEqual(Object.keys(doc), ["runward", "mission", "verdict", "error", "exitCode"]); // `error`: ADR-0083, additive
      assert.equal(doc.verdict, "no-mission");
      assert.equal(doc.exitCode, 2);
    }
  } finally { clean(empty); }
});
