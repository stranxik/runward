// ADR-0110 decision 3: the closed dispatch list. `.github/dispatch-allowlist.json` names the workflows a
// delegate of runward/delegation.md may dispatch or re-run, and the inputs it may pass.
//
// What is pinned here: every listed file exists and has `workflow_dispatch`, and its dispatch inputs are
// exactly the listed ones; no listed workflow grants a write that matters (id-token, attestations,
// contents, packages, issues, pull-requests) at the top, nor to a job the allowed inputs can reach; every
// workflow with `workflow_dispatch` is either listed or carries the delegate refusal, a first job that
// every other root job waits on; a listed workflow with a restricted input carries a refusal that reads
// it; every refusal names exactly the delegates of the charter (plus the App the stop always counts); and
// the refusals' own shell, run here, refuses and admits what the list says. Two positive controls show
// the check is not blind: a listed workflow given `id-token: write`, and an unlisted dispatchable
// workflow without the refusal, each fail it.
//
// What it does not see, said as the ADR says it: the refusals and this test hold main's copy. A dispatch
// on a branch ref runs that branch's copy, which nothing in the tree holds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { charterDelegates, BUILTIN_DELEGATES } from "../../scripts/delegation-stop.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WF = join(ROOT, ".github", "workflows");
const ALLOWLIST = JSON.parse(readFileSync(join(ROOT, ".github", "dispatch-allowlist.json"), "utf8"));
const DELEGATES = [...new Set([...BUILTIN_DELEGATES, ...charterDelegates(readFileSync(join(ROOT, "runward", "delegation.md"), "utf8"))])].sort();
const GUARD = "refuse-delegate";
const WRITES = ["id-token", "attestations", "contents", "packages", "issues", "pull-requests"];

function loadWorkflows() {
  const out = {};
  for (const f of readdirSync(WF).filter((n) => /\.ya?ml$/.test(n)).sort()) out[f] = yaml.load(readFileSync(join(WF, f), "utf8"));
  return out;
}

// `on:` is read by js-yaml as the key "on" (YAML 1.2), never as `true`.
const triggers = (wf) => (wf && typeof wf.on === "object" && wf.on !== null ? wf.on : {});
const hasDispatch = (wf) => Object.prototype.hasOwnProperty.call(triggers(wf), "workflow_dispatch");
const dispatchInputs = (wf) => Object.keys((triggers(wf).workflow_dispatch || {}).inputs || {}).sort();
const writesOf = (perms) => (perms && typeof perms === "object" ? WRITES.filter((k) => perms[k] === "write") : perms === "write-all" ? WRITES : []);
const needsOf = (job) => (job.needs === undefined ? [] : [].concat(job.needs));
const restricted = (entry) => Object.entries(entry.inputs).filter(([, v]) => v.allowed !== "any");

function guardDelegates(job) {
  const raw = job?.steps?.[0]?.env?.DELEGATES;
  try { return [...JSON.parse(raw)].sort(); } catch { return null; }
}

function checkGuard(file, wf, delegates, problems) {
  const jobs = wf.jobs || {};
  const guard = jobs[GUARD];
  if (!guard) { problems.push(`${file}: no ${GUARD} job`); return null; }
  if (needsOf(guard).length) problems.push(`${file}: ${GUARD} must be a first job (it has needs)`);
  if (guard.if !== undefined) problems.push(`${file}: ${GUARD} must run on every event (it has an if)`);
  if (writesOf(guard.permissions).length || guard.permissions === undefined) problems.push(`${file}: ${GUARD} must hold permissions: {}`);
  for (const [id, job] of Object.entries(jobs)) {
    if (id !== GUARD && needsOf(job).length === 0) problems.push(`${file}: root job ${id} does not wait on ${GUARD}`);
  }
  const named = guardDelegates(guard);
  if (!named || JSON.stringify(named) !== JSON.stringify(delegates)) problems.push(`${file}: ${GUARD} names ${JSON.stringify(named)}, the charter's delegates are ${JSON.stringify(delegates)}`);
  if (!/github\.triggering_actor/.test(String(guard.steps?.[0]?.env?.TRIGGERING_ACTOR))) problems.push(`${file}: ${GUARD} does not read github.triggering_actor`);
  return guard;
}

export function violations(workflows, allowlist, delegates) {
  const problems = [];
  for (const [file, entry] of Object.entries(allowlist.workflows)) {
    const wf = workflows[file];
    if (!wf) { problems.push(`${file}: listed but absent`); continue; }
    if (!hasDispatch(wf)) { problems.push(`${file}: listed but has no workflow_dispatch`); continue; }
    const listed = Object.keys(entry.inputs).sort();
    if (JSON.stringify(dispatchInputs(wf)) !== JSON.stringify(listed)) problems.push(`${file}: dispatch inputs ${JSON.stringify(dispatchInputs(wf))}, listed ${JSON.stringify(listed)}`);
    const top = writesOf(wf.permissions);
    if (top.length) problems.push(`${file}: top-level permissions write ${top.join(", ")}`);
    // A job with a write is unreachable by the allowed inputs only when its `if` requires an input the list
    // keeps non-empty to be empty (the ratchet's summary: `inputs.module == ''`).
    const nonEmpty = restricted(entry).filter(([, v]) => v.allowed === "non-empty").map(([k]) => k);
    for (const [id, job] of Object.entries(wf.jobs || {})) {
      const w = writesOf(job.permissions);
      if (!w.length) continue;
      const cond = String(job.if ?? "");
      const unreachable = nonEmpty.some((k) => cond.includes(`inputs.${k} == ''`));
      if (!unreachable) problems.push(`${file}: job ${id} writes ${w.join(", ")} and the allowed inputs can reach it`);
    }
    if (restricted(entry).length) {
      const guard = checkGuard(file, wf, delegates, problems);
      const envs = guard?.steps?.[0]?.env || {};
      for (const [k] of restricted(entry)) {
        if (!Object.values(envs).some((v) => String(v).includes(`inputs.${k}`))) problems.push(`${file}: ${GUARD} does not read input ${k}`);
      }
    }
  }
  for (const [file, wf] of Object.entries(workflows)) {
    if (!hasDispatch(wf) || allowlist.workflows[file]) continue;
    checkGuard(file, wf, delegates, problems);
  }
  return problems;
}

test("dispatch allowlist: the delegates come from the charter", () => {
  assert.ok(DELEGATES.includes("runward-steward[bot]"));
  assert.ok(DELEGATES.length >= 1);
});

test("dispatch allowlist: the list is exactly the four workflows of ADR-0110 decision 3", () => {
  assert.deepEqual(Object.keys(ALLOWLIST.workflows).sort(), ["documented-commands.yml", "mutation-ratchet.yml", "verify-artifact-roundtrip.yml", "verify-release.yml"]);
  assert.deepEqual(ALLOWLIST.workflows["mutation-ratchet.yml"].inputs.mode.allowed, ["measure"]);
  assert.equal(ALLOWLIST.workflows["mutation-ratchet.yml"].inputs.module.allowed, "non-empty");
  for (const never of ["release.yml", "build-and-attest.yml", "scorecard.yml", "watch-external-facts.yml", "codeql.yml", "gitlab-bench.yml"]) {
    assert.equal(ALLOWLIST.workflows[never], undefined, never);
  }
});

test("dispatch allowlist: the tree holds the list, the refusals and the workflows together", () => {
  assert.deepEqual(violations(loadWorkflows(), ALLOWLIST, DELEGATES), []);
});

test("dispatch allowlist: positive control, a listed workflow given id-token: write fails the check", () => {
  const wfs = loadWorkflows();
  const doc = structuredClone(wfs["verify-release.yml"]);
  doc.permissions = { contents: "read", "id-token": "write" };
  const out = violations({ ...wfs, "verify-release.yml": doc }, ALLOWLIST, DELEGATES);
  assert.ok(out.some((p) => p.startsWith("verify-release.yml: top-level permissions write id-token")), out.join("\n"));
  const job = structuredClone(wfs["documented-commands.yml"]);
  job.jobs.replay.permissions = { contents: "write" };
  const out2 = violations({ ...wfs, "documented-commands.yml": job }, ALLOWLIST, DELEGATES);
  assert.ok(out2.some((p) => p.includes("job replay writes contents")), out2.join("\n"));
});

test("dispatch allowlist: positive control, an unlisted dispatchable workflow without the refusal fails the check", () => {
  const wfs = loadWorkflows();
  const doc = structuredClone(wfs["gitlab-bench.yml"]);
  delete doc.jobs[GUARD];
  delete doc.jobs.bench.needs;
  const out = violations({ ...wfs, "gitlab-bench.yml": doc }, ALLOWLIST, DELEGATES);
  assert.ok(out.some((p) => p === `gitlab-bench.yml: no ${GUARD} job`), out.join("\n"));
  const fresh = { on: { workflow_dispatch: {} }, jobs: { x: { "runs-on": "ubuntu-latest", steps: [{ run: "true" }] } } };
  assert.ok(violations({ ...wfs, "new.yml": fresh }, ALLOWLIST, DELEGATES).includes(`new.yml: no ${GUARD} job`));
  const skipped = structuredClone(wfs["release.yml"]);
  delete skipped.jobs.publish.needs;
  assert.ok(violations({ ...wfs, "release.yml": skipped }, ALLOWLIST, DELEGATES).includes(`release.yml: root job publish does not wait on ${GUARD}`));
});

const HAS_JQ = spawnSync("jq", ["--version"]).status === 0;
function runGuard(file, env) {
  const script = loadWorkflows()[file].jobs[GUARD].steps[0].run;
  const r = spawnSync("bash", ["-c", script], { env: { PATH: process.env.PATH, DELEGATES: JSON.stringify(DELEGATES), ...env }, encoding: "utf8" });
  return r.status;
}

test("dispatch allowlist: the ratchet's refusal admits one module in measure mode, and only that, from a delegate", { skip: !HAS_JQ && "jq is not installed here" }, () => {
  const D = "runward-steward[bot]";
  assert.equal(runGuard("mutation-ratchet.yml", { TRIGGERING_ACTOR: D, EVENT: "workflow_dispatch", MODULE: "evidence", MODE: "measure" }), 0);
  assert.equal(runGuard("mutation-ratchet.yml", { TRIGGERING_ACTOR: D, EVENT: "workflow_dispatch", MODULE: "", MODE: "measure" }), 1);
  assert.equal(runGuard("mutation-ratchet.yml", { TRIGGERING_ACTOR: D, EVENT: "workflow_dispatch", MODULE: "  ", MODE: "measure" }), 1);
  assert.equal(runGuard("mutation-ratchet.yml", { TRIGGERING_ACTOR: D, EVENT: "workflow_dispatch", MODULE: "evidence", MODE: "gate" }), 1);
  assert.equal(runGuard("mutation-ratchet.yml", { TRIGGERING_ACTOR: D, EVENT: "release", MODULE: "", MODE: "" }), 1);
  assert.equal(runGuard("mutation-ratchet.yml", { TRIGGERING_ACTOR: "stranxik", EVENT: "workflow_dispatch", MODULE: "", MODE: "gate" }), 0);
});

test("dispatch allowlist: an unlisted workflow's refusal refuses every delegate and admits anyone else", { skip: !HAS_JQ && "jq is not installed here" }, () => {
  for (const file of ["release.yml", "gitlab-bench.yml", "watch-external-facts.yml"]) {
    for (const d of DELEGATES) assert.equal(runGuard(file, { TRIGGERING_ACTOR: d }), 1, `${file} ${d}`);
    assert.equal(runGuard(file, { TRIGGERING_ACTOR: "stranxik" }), 0, file);
    assert.equal(runGuard(file, { TRIGGERING_ACTOR: "runward-steward[bot]x" }), 0, file);
  }
});

test("dispatch allowlist: the ADR names the list's file", () => {
  const adr = execFileSync("git", ["ls-files", "docs/adr/ADR-0110-*"], { cwd: ROOT, encoding: "utf8" }).trim();
  assert.ok(adr, "ADR-0110 is in the tree");
  assert.match(readFileSync(join(ROOT, adr), "utf8"), /\.github\/dispatch-allowlist\.json/);
});
