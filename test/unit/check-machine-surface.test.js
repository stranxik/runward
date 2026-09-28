// What `check` hands a MACHINE, and what the shipped packagings tell an agent.
//
// Found 2026-09-27 by an adversarial audit of what the CLI prints (RWD-2026-0149 to 0155). None of
// these moved an exit code. Each was a fact the run already held and a machine reader could not
// get: a refusal's file and line (the SARIF log had them, the JSON did not), its kind (English
// only), the `--coverage` numbers and the prose rows (terminal only), a join between the three
// phase vocabularies; or a sentence an agent reads and acts on that was not true: a refusal that
// told the proposing agent to "decide the row yourself", packaged hooks said to surface a verdict
// that no documented harness contract delivers, a Kiro hook that blocked every tool on a red gate.
// Every CLI case runs the built CLI on a throwaway copy of `init --example` with one defect planted.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THROUGH_PHASE_IDS } from "../../dist/lib/mission.js";
import { GATED_DELIVERABLES } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const GOOD = "| hexa-adapter-pattern | applied | file:code/src/adapters/keyword-model.adapter.ts#";
const DEAD = "| hexa-adapter-pattern | applied | file:code/src/adapters/missing.ts#";

let base;
before(() => {
  base = mkdtempSync(join(tmpdir(), "rw-machine-base-"));
  execFileSync("git", ["init", "-q", "."], { cwd: base });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: base, env: ENV, stdio: "ignore" });
});
after(() => rmSync(base, { recursive: true, force: true }));

function mission(plant) {
  const dir = mkdtempSync(join(tmpdir(), "rw-machine-"));
  cpSync(base, dir, { recursive: true });
  if (plant) {
    const p = join(dir, "runward", "architecture.md");
    const text = readFileSync(p, "utf8");
    const next = plant(text);
    assert.notEqual(next, text, "the plant must change the manifest, or the test proves nothing");
    writeFileSync(p, next);
  }
  return dir;
}
const run = (dir, ...args) => spawnSync("node", [CLI, ...args], { cwd: dir, env: ENV, encoding: "utf8" });
const json = (dir, ...args) => JSON.parse(run(dir, ...args).stdout);
const deadPointer = (t) => t.replace(GOOD, DEAD);

test("RWD-2026-0149: each conformance row carries kind, file, line and phaseId, at the SARIF location", () => {
  const dir = mission(deadPointer);
  try {
    const payload = json(dir, "check", "--strict", "--json");
    const row = payload.conformance.find((r) => r.rule === "hexa-adapter-pattern");
    assert.ok(row, "the planted dead pointer must be a conformance row");
    assert.equal(row.scope, "Architect", "scope keeps its value (ADR-0030)");
    assert.equal(row.kind, "unresolved-pointer");
    assert.equal(row.file, "runward/architecture.md");
    assert.equal(row.phaseId, "architect");
    const lines = readFileSync(join(dir, "runward", "architecture.md"), "utf8").split("\n");
    assert.equal(row.line, lines.findIndex((l) => l.startsWith(DEAD)) + 1, "the line is the row's own");
    // Same source as SARIF: the annotation of the same refusal sits on the same file and line.
    const sarif = json(dir, "check", "--strict", "--sarif");
    const res = sarif.runs[0].results.find((r) => r.ruleId === "runward/hexa-adapter-pattern");
    assert.equal(res.locations[0].physicalLocation.artifactLocation.uri, row.file);
    assert.equal(res.locations[0].physicalLocation.region.startLine, row.line);
    // The refusal the model receives from the armed hook names the place too.
    const hook = spawnSync("node", [CLI, "gate-hook", "--harness", "claude"], { cwd: dir, env: ENV, encoding: "utf8", input: "{}" });
    assert.match(hook.stderr, new RegExp(`hexa-adapter-pattern \\(runward/architecture\\.md:${row.line}\\) — typed pointer does not resolve`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0149: a row with no manifest line says line null, and every row has a kind", () => {
  // Deleting the row entirely: the refusal lives in the file, on no line.
  const dir = mission((t) => t.split("\n").filter((l) => !l.startsWith(GOOD)).join("\n"));
  try {
    const row = json(dir, "check", "--strict", "--json").conformance.find((r) => r.rule === "hexa-adapter-pattern");
    assert.equal(row.kind, "missing-row");
    assert.equal(row.file, "runward/architecture.md");
    assert.equal(row.line, null, "no row, no line: nothing is guessed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0149: verify accepts an attestation made before the row fields, and refuses one edited row", () => {
  const dir = mission(deadPointer);
  try {
    const att = json(dir, "check", "--strict", "--attest");
    // An older producer's shape: none of the additive keys on any row.
    const older = structuredClone(att);
    for (const r of older.predicate.conformance) { delete r.kind; delete r.file; delete r.line; delete r.phaseId; }
    for (const d of older.predicate.deliverables) delete d.phaseId;
    delete older.predicate.evidence.proseRows;
    const olderPath = join(dir, "older.att.json");
    writeFileSync(olderPath, JSON.stringify(older));
    const vOld = json(dir, "verify", "--json", olderPath);
    assert.deepEqual(vOld.predicate.differing, [], "an honest attestation from before the fields still re-derives");
    assert.equal(vOld.verified, true);
    // The current shape verifies as emitted.
    const curPath = join(dir, "current.att.json");
    writeFileSync(curPath, JSON.stringify(att));
    assert.equal(json(dir, "verify", "--json", curPath).verified, true);
    // One row edited (a lying line): compared whole, it differs.
    const lied = structuredClone(att);
    lied.predicate.conformance[0].line = 1;
    const liedPath = join(dir, "lied.att.json");
    writeFileSync(liedPath, JSON.stringify(lied));
    const vLied = json(dir, "verify", "--json", liedPath);
    assert.equal(vLied.verified, false);
    assert.deepEqual(vLied.predicate.differing, ["conformance"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0150: --coverage and the prose rows reach the JSON, from the terminal's own numbers", () => {
  const dir = mission(deadPointer);
  try {
    const term = run(dir, "check", "--coverage").stdout;
    const cov = json(dir, "check", "--coverage", "--json").coverage;
    assert.ok(cov, "--coverage --json must carry the coverage block");
    const [, f, t] = term.match(/Deliverables\s+(\d+)\/(\d+) filled/);
    assert.deepEqual(cov.deliverables, { filled: Number(f), total: Number(t) });
    const [, r, rt] = term.match(/Decisions\s+(\d+)\/(\d+) ratified/);
    assert.equal(cov.decisions.ratified, Number(r));
    assert.equal(cov.decisions.total, Number(rt));
    assert.equal(json(dir, "check", "--json").coverage, undefined, "absent without --coverage: every other run keeps its bytes");

    const strictTerm = run(dir, "check", "--strict").stdout;
    const ev = json(dir, "check", "--strict", "--json").evidence;
    assert.equal(ev.proseRows.length, ev.prose, "the list and its count agree");
    for (const p of ev.proseRows.slice(0, 5)) assert.ok(strictTerm.includes(`${p.deliverable} · ${p.rule}`), `the terminal names ${p.rule}`);

    // verify re-derives the coverage block it finds.
    const att = json(dir, "check", "--strict", "--coverage", "--attest");
    const okPath = join(dir, "cov.att.json");
    writeFileSync(okPath, JSON.stringify(att));
    assert.equal(json(dir, "verify", "--json", okPath).verified, true);
    att.predicate.coverage.deliverables.filled = 0;
    const badPath = join(dir, "cov-bad.att.json");
    writeFileSync(badPath, JSON.stringify(att));
    assert.deepEqual(json(dir, "verify", "--json", badPath).predicate.differing, ["coverage"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0151: phaseId joins deliverables to --through and conformance rows to rules --phase", () => {
  const dir = mission(deadPointer);
  try {
    const payload = json(dir, "check", "--strict", "--json");
    for (const d of payload.deliverables) assert.ok(THROUGH_PHASE_IDS.includes(d.phaseId), `${d.phase} → ${d.phaseId}`);
    assert.equal(payload.deliverables.find((d) => d.relPath === "execution-topology.md").phaseId, "architect");
    const ruleIds = GATED_DELIVERABLES.map((g) => g.phase);
    for (const r of payload.conformance.filter((x) => GATED_DELIVERABLES.some((g) => g.label === x.scope))) {
      assert.ok(ruleIds.includes(r.phaseId), `${r.scope} → ${r.phaseId}`);
      assert.equal(run(dir, "rules", "--phase", r.phaseId, "--json").status, 0, "the id is one `rules --phase` accepts");
    }
    const doc = readFileSync(join(ROOT, "docs", "interop.md"), "utf8");
    assert.match(doc, /#### Phase vocabularies, joined/, "the join table is documented");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0153: a proposal's refusal names the charter's roads, never 'decide the row yourself'", () => {
  const dir = mission((t) => t.replace(GOOD, GOOD.replace("| applied |", "| proposed:applied |")));
  try {
    const line = run(dir, "check", "--strict").stdout.split("\n").find((l) => l.includes("hexa-adapter-pattern"));
    assert.doesNotMatch(line, /decide the row yourself/);
    assert.match(line, /awaits ratification — a proposal is not a decision/);
    assert.match(line, /the operator runs `runward ratify`/);
    assert.match(line, /`runward ratify --agent <name> --for <person> --list`/);
    // The road it names exists and lists this row.
    const listed = json(dir, "ratify", "--agent", "agent-x", "--for", "person-y", "--list", "--json");
    assert.ok(listed.rows.some((r) => r.rule === "hexa-adapter-pattern"));
    const hook = spawnSync("node", [CLI, "gate-hook", "--harness", "claude"], { cwd: dir, env: ENV, encoding: "utf8", input: "{}" });
    assert.doesNotMatch(hook.stderr, /decide the row yourself/, "the model's refusal says the same");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0152: the packaged Claude skill and plugin do not claim the verdict reaches the model", () => {
  const skill = readFileSync(join(ROOT, "plugins", "runward-gate", "skills", "runward", "SKILL.md"), "utf8");
  assert.doesNotMatch(skill, /surfaces the verdict/);
  assert.match(skill, /the verdict does not reach you/);
  assert.match(skill, /Run `runward check --strict` yourself before you end a turn/);
  const readme = readFileSync(join(ROOT, "plugins", "runward-gate", "README.md"), "utf8");
  assert.doesNotMatch(readme, /surfaces the verdict in the loop/);
  assert.doesNotMatch(readme, /To make the session hook block hard too, remove the `\|\| true`/);
  const pk = readFileSync(join(ROOT, "packaging", "README.md"), "utf8");
  assert.match(pk, /## What the consultative hooks actually deliver/);
});

test("RWD-2026-0154: Codex, packaged without a profile, is named for what it is", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-machine-codex-"));
  try {
    const init = run(dir, "--yes", "init", "--tools", "codex");
    assert.match(init.stdout, /No tool profile "codex": Codex reads AGENTS\.md natively/);
    const hook = spawnSync("node", [CLI, "gate-hook", "--harness", "codex"], { cwd: dir, env: ENV, encoding: "utf8", input: "{}" });
    assert.equal(hook.status, 0, "fail-open, as every misconfiguration of the hook (RWD-2026-0137)");
    assert.match(hook.stderr, /unknown harness "codex".*Codex reads AGENTS\.md natively/s);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0155: the packaged Kiro hook never blocks a tool, and the Kiro texts agree", () => {
  const hook = JSON.parse(readFileSync(join(ROOT, "packaging", "kiro", "hooks", "runward-gate.kiro.hook"), "utf8"));
  assert.equal(hook.hooks[0].trigger, "PreToolUse");
  assert.match(hook.hooks[0].action.command, /runward check --strict 2>&1 \|\| true$/,
    "a red gate exiting 1 blocked every tool call in Kiro, the fixing edit included");
  const adapters = readFileSync(join(ROOT, "templates", "adapters", "README.md"), "utf8");
  assert.doesNotMatch(adapters, /the same turn-end gate, Kiro flavor[\s\S]*surfaces the verdict in the session/);
  const dist = readFileSync(join(ROOT, "docs", "distribution.md"), "utf8");
  assert.doesNotMatch(dist, /The Kiro \*CLI\* has a blocking `stop`/);
  const armed = JSON.parse(readFileSync(join(ROOT, "templates", "adapters", "kiro-hooks.armed.json"), "utf8"));
  assert.match(armed["//"], /NOT confirmed by Kiro's current docs/);
});
