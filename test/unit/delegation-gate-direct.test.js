// Direct tests of where the gate reads the charter and the sample (ADR-0088 decisions 4 to 7), written
// from the survivors the 0.43.0 ratchet filed as "not yet instructed" in conformance, verdict,
// check-contract and sarif (ADR-0046 decision 4). Each assertion is a behaviour a surviving mutant
// changed and no test observed: which agent ratifications the charter judges (the window's bounds, an
// undated entry, a row that is not decided), from which day a suspension or two missed periods apply,
// the regulated causes read from `for:` and `proposer-for:`, the `--through` horizon, and where a
// delegation gap lands in `check --json` and in the SARIF log.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCharter } from "../../dist/lib/delegation.js";
import {
  drawSample, placeSeeds, seedCommitment, shippedDigest, populationHash, drandRound, drandRandomness, DRAND_QUICKNET, SAMPLE_FILE,
} from "../../dist/lib/delegation-sample.js";
import { isoDay } from "../../dist/lib/delegation.js";
import {
  rowDigest, charterActGaps, unboundRatifications, missionSample, latestDeclaredDay, accountableRelation, readRatification,
} from "../../dist/lib/conformance.js";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { delegationPayload } from "../../dist/lib/check-contract.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
for (const k of ["CLAUDECODE", "GEMINI_CLI", "CURSOR_AGENT", "FORCE_COLOR"]) delete ENV[k];
const run = (cwd, args) => {
  try { return { out: execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

/** A stage-1 charter: effective 2026-09-01 to 2026-11-15, weekly, delegates claude and codex. */
function charterText(over = {}) {
  const f = {
    charter: "runward-delegation/1", stage: "1", accountable: "github:ada", aliases: "[Ada]",
    delegates: "[claude, codex, runward-steward[bot]]",
    "class-R": "maintainer", "class-H": "maintainer", "class-I": "refused", "class-D": "delegated",
    "budget-consecutive-refusals": "3", "budget-refusals-per-period": "20",
    "sample-size": "5", "sample-seeds": "1", "sample-period-days": "7",
    effective: "2026-09-01", expires: "2026-11-15", "pre-merge-paths": "[runward/delegation.md]",
    ...over,
  };
  return ["---", ...Object.entries(f).map(([k, v]) => `${k}: ${v}`), "---", ""].join("\n");
}
const CHARTER = parseCharter(charterText());

const ROWS = ["r-a", "r-b", "r-c", "r-d", "r-e"].map((rule) => ({ rule, status: "applied", evidence: `file:src/${rule}.ts` }));
const entry = (date, rule, segs, mode) => `- ${date} · rows: ${rule} · ${segs} · bound: ${rule}@${rowDigest(ROWS.find((r) => r.rule === rule) ?? { rule, status: "maybe", evidence: "x" })} · mode: ${mode}`;
const AGENT = (by) => `by: ${by} (declared, agent) · for: Ada (declared, accountable)`;
/** A mission holding floor.md with ROWS (plus `extraRows`) and the given ratification entries. */
function mission(entries, { charter, ledger, lock, extraRows = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rw-deleg-gate-"));
  writeFileSync(join(dir, "floor.md"), ["# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
    ...ROWS.map((r) => `| ${r.rule} | ${r.status} | ${r.evidence} |`), ...extraRows, "", "### Ratification", "", ...entries, ""].join("\n"));
  if (charter !== undefined) writeFileSync(join(dir, "delegation.md"), charter);
  if (ledger !== undefined) writeFileSync(join(dir, SAMPLE_FILE), ledger);
  if (lock) writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify(lock));
  return dir;
}
const withMission = (entries, opts, f) => { const dir = mission(entries, opts); try { return f(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
/** The regulated causes of r-a and r-b (the rows the tests ratify; the others are never ratified). */
const causes = (dir) => unboundRatifications(dir).filter((u) => u.rule === "r-a" || u.rule === "r-b").map((u) => [u.rule, u.cause]);
const gapsOf = (dir, charter = CHARTER) => charterActGaps(dir, charter, undefined, missionSample(dir, charter)).map((g) => [g.kind, g.rule]);

// ── a sample period, built as `runward sample` builds it ───────────────────────────────────────

const sig = (label) => createHash("sha384").update(label).digest("hex");
const POP = [
  { stratum: "merge", ref: "a".repeat(40), date: "2026-09-02", actor: "runward-steward[bot]", summary: "Merge #1: docs" },
  { stratum: "merge", ref: "b".repeat(40), date: "2026-09-03", actor: "runward-steward[bot]", summary: "Merge #2: src change", shipped: true },
  { stratum: "merge", ref: "c".repeat(40), date: "2026-09-04", actor: "Ada", summary: "Merge #3: ci" },
  { stratum: "merge", ref: "d".repeat(40), date: "2026-09-05", actor: "codex", summary: "Merge #4: templates", shipped: true },
  { stratum: "tag", ref: "tag:v1.0.1", date: "2026-09-05", actor: "Ada", summary: "dddddd v1.0.1" },
  { stratum: "ratification", ref: "floor.md@2026-09-06:r-a", date: "2026-09-06", actor: "claude", summary: "mode: agent", agent: true },
  { stratum: "ratification", ref: "floor.md@2026-09-07:r-b", date: "2026-09-07", actor: "Ada", summary: "mode: line-by-line" },
];
const SEED = { stratum: "merge", ref: "e".repeat(40), date: "2026-09-04", actor: "codex", summary: "Merge #5: tidy the gate test", defect: "deletes the strict-gate test", nonce: "11".repeat(32) };
function period({ verdict = (_it, isSeed) => (isSeed ? "rejected" : "accepted") } = {}) {
  const end = "2026-09-08", signature = sig(end), round = drandRound(isoDay(end)), randomness = drandRandomness(signature);
  const { full, seedAt } = placeSeeds(drawSample(POP, randomness, 5), [SEED], randomness);
  const counts = { total: POP.length, gitMerges: 4, merge: 4, ratification: 2, tag: 1 };
  const shipped = shippedDigest(POP);
  const recs = [{ type: "seed", period: end, round, commitment: seedCommitment(SEED) },
    { type: "draw", period: end, start: "2026-09-01", end, branch: "main", size: 5, seeds: 1,
      drand: { chain: DRAND_QUICKNET.chain, round, randomness, signature }, counts, populationHash: populationHash(POP), population: POP, items: full, shipped },
    { type: "review", period: end, reviewer: "github:ada", verdicts: full.map((it, i) => verdict(it, seedAt.includes(i))), shippedDigest: shipped.digest },
    { type: "reveal", period: end, seeds: [SEED] }];
  return { ledger: recs.map((r) => JSON.stringify(r)).join("\n") + "\n", full, seedAt };
}

// ── the charter's reading of the acts ───────────────────────────────────────────────────────────

test("the charter judges agent acts from `effective:` included, an undated act included, and only on decided rows", () => {
  const entries = [
    entry("2026-09-01", "r-a", AGENT("gemini"), "agent"), // on the day the charter takes effect
    entry("2026-02-30", "r-b", AGENT("gemini"), "agent"), // a date that is no day: judged, never skipped
    entry("2026-08-31", "r-c", AGENT("gemini"), "agent"), // before the charter: not judged by it
    entry("2026-09-02", "r-x", AGENT("gemini"), "agent"), // a row whose status is not a decision
  ];
  withMission(entries, { charter: charterText(), extraRows: ["| r-x | maybe | file:src/x.ts |"] }, (dir) => {
    assert.deepEqual(gapsOf(dir), [["agent-not-delegate", "r-a"], ["agent-not-delegate", "r-b"]]);
  });
});

test("a delegate's act on the day the charter expires is inside it; a charter with no readable `expires:` expires nothing", () => {
  const entries = [entry("2026-11-15", "r-a", AGENT("claude"), "agent"), entry("2026-11-16", "r-b", AGENT("claude"), "agent")];
  withMission(entries, { charter: charterText() }, (dir) => {
    assert.deepEqual(charterActGaps(dir, CHARTER).map((g) => [g.kind, g.rule]), [["charter-expired", "r-b"]]);
    assert.deepEqual(charterActGaps(dir, parseCharter(charterText({ expires: "someday" }))), []);
  });
});

test("the latest declared day is the latest date any entry declares, whatever the year", () => {
  withMission([entry("1969-12-31", "r-a", "by: Ada", "line-by-line")], {}, (dir) => assert.equal(latestDeclaredDay(dir), -1));
  withMission([entry("2026-09-03", "r-a", "by: Ada", "line-by-line"), entry("2026-02-30", "r-b", "by: Ada", "line-by-line"), entry("2026-09-02", "r-c", "by: Ada", "line-by-line")], {},
    (dir) => assert.equal(latestDeclaredDay(dir), isoDay("2026-09-03")));
  withMission([], {}, (dir) => assert.equal(latestDeclaredDay(dir), null));
});

test("a suspension applies from the day of the sample's end, included, to that delegate's acts", () => {
  const p = period();
  const target = p.full.find((it, i) => !p.seedAt.includes(i) && ["claude", "codex", "runward-steward[bot]"].includes(it.actor));
  const { ledger } = period({ verdict: (it, isSeed) => (isSeed || it.ref === target.ref ? "rejected" : "accepted") });
  const entries = [entry("2026-09-07", "r-a", AGENT(target.actor), "agent"), entry("2026-09-08", "r-b", AGENT(target.actor), "agent")];
  withMission(entries, { charter: charterText(), ledger }, (dir) => {
    const gaps = charterActGaps(dir, CHARTER, undefined, missionSample(dir, CHARTER));
    assert.deepEqual(gaps.map((g) => [g.kind, g.rule]), [["class-suspended", "r-b"]]);
    assert.ok(gaps[0].problem.includes(`period ending 2026-09-08 rejected its act ${target.ref}`), gaps[0].problem);
  });
});

// Week 1 sampled (covered until 2026-09-08); a person's line declares 2026-09-22: two periods missed
// since 2026-09-08, so agent acts from that day on stop counting, and those before it still count.
const MISSED = [entry("2026-09-03", "r-a", "", ""), entry("2026-09-08", "r-b", "", ""), entry("2026-09-22", "r-c", "by: Ada", "line-by-line")];
const independent = "by: claude (declared, agent) · for: Ada (declared, accountable) · proposer: codex (declared) · proposer-for: Bob (declared, accountable)";

test("two missed periods: an agent act on the chain's day stops counting, one before it still counts", () => {
  const entries = [entry("2026-09-03", "r-a", AGENT("claude"), "agent"), entry("2026-09-08", "r-b", AGENT("claude"), "agent"), MISSED[2]];
  withMission(entries, { charter: charterText(), ledger: period().ledger }, (dir) => {
    assert.equal(missionSample(dir, CHARTER).missed, 2);
    assert.deepEqual(gapsOf(dir), [["sample-missed", "r-b"]]);
  });
  // The regulated reading of the same two acts.
  const reg = [entry("2026-09-03", "r-a", independent, "agent"), entry("2026-09-08", "r-b", independent, "agent"), MISSED[2]];
  const lock = { regulated: true, agentRatification: true, identities: { "github:ada": ["Ada"], "github:bob": ["Bob"] } };
  withMission(reg, { charter: charterText(), ledger: period().ledger, lock }, (dir) => {
    assert.deepEqual(causes(dir), [["r-b", "agent-unsampled"]]);
  });
});

test("regulated causes: `proposer-for:` alone attributes the proposer, and an entry with no `for:` is unattributed before anything else", () => {
  const lock = { regulated: true, agentRatification: true, identities: { "github:ada": ["Ada"], "github:bob": ["Bob"] } };
  const entries = [
    entry("2026-09-03", "r-a", "by: claude (declared, agent) · for: Ada (declared, accountable) · proposer-for: Bob (declared, accountable)", "agent"),
    entry("2026-09-03", "r-b", "by: claude (declared, agent) · proposer: claude (declared)", "agent"),
  ];
  withMission(entries, { lock }, (dir) => {
    assert.deepEqual(causes(dir), [["r-b", "agent-unattributed"]], "r-a binds: two declared persons");
  });
});

test("the accountable relation: an agent known by an alias of the proposer is the proposer; `proposer-for:` alone is read", () => {
  const ids = { "github:bot": ["claude", "anthropic-claude"], "github:ada": ["Ada"], "github:bob": ["Bob"] };
  assert.deepEqual(accountableRelation({ agent: "claude", accountable: "Ada", proposer: "anthropic-claude" }, ids), { relation: "agent-proposed", declared: false });
  assert.deepEqual(accountableRelation({ agent: "claude", accountable: "Ada", proposerFor: "Bob" }, ids), { relation: "independent", declared: true });
  assert.deepEqual(accountableRelation({ agent: "claude", accountable: "Ada", proposerFor: "Ada" }, ids), { relation: "same-accountable", declared: true });
});

test("the single-accountable mark is read with blanks around its value", () => {
  const [e] = readRatification(["### Ratification", "", "- 2026-09-03 · rows: r-a · by: codex · independence:  single accountable  · mode: agent", ""].join("\n"));
  assert.equal(e.singleAccountable, true);
});

// ── the verdict and its surfaces ────────────────────────────────────────────────────────────────

test("a charter with no ledger carries no sample banner, and the payload's gaps are the verdict's", () => {
  withMission([entry("2026-09-03", "r-a", AGENT("gemini"), "agent")], { charter: charterText() }, (dir) => {
    const v = computeVerdict(dir, { strict: true });
    assert.deepEqual(v.delegation.sample.banner, []);
    assert.equal(v.delegation.sample.present, false);
    assert.deepEqual(delegationPayload(v, true).gaps, v.delegation.gaps);
    assert.equal(delegationPayload(v, true).gaps.length, 1);
    const { gaps, ...rest } = v.delegation;
    assert.deepEqual(delegationPayload({ ...v, delegation: rest }, true).gaps, [], "a strict payload always carries a list");
    assert.equal("gaps" in delegationPayload(v, false), false);
  });
  assert.equal(delegationPayload({ delegation: null }, true), null);
});

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-deleg-gate-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe", env: ENV });
process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
const RULE = "hexa-move-deterministic-out";

/** The shipped example, with a charter, an agent ratification by a non-delegate, and a malformed ledger. */
function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-deleg-gate-ex-"));
  cpSync(REFERENCE, dir, { recursive: true });
  writeFileSync(join(dir, "runward", "delegation.md"), charterText({ effective: "2026-10-02", expires: "2026-12-31" }));
  appendFileSync(join(dir, "runward", "floor.md"), `\n### Ratification\n\n- 2026-10-05 · rows: ${RULE} · by: gemini (declared, agent) · for: Ada (declared, accountable) · mode: agent\n`);
  writeFileSync(join(dir, "runward", SAMPLE_FILE), "not json\n");
  const line = readFileSync(join(dir, "runward", "floor.md"), "utf8").split("\n").findIndex((l) => l.startsWith(`| ${RULE} |`)) + 1;
  return { dir, line, drop: () => rmSync(dir, { recursive: true, force: true }) };
}

test("--through: an agent act on a deferred deliverable is not judged by the charter, one inside the horizon is", () => {
  const m = example();
  try {
    const kinds = (through) => computeVerdict(join(m.dir, "runward"), { strict: true, through }).delegation.gaps.map((g) => g.kind);
    assert.deepEqual(kinds("architect"), ["sample-malformed"], "floor.md is deferred at architect");
    assert.deepEqual(kinds("floor"), ["sample-malformed", "agent-not-delegate"]);
    assert.deepEqual(kinds("handover"), ["sample-malformed", "agent-not-delegate"]);
  } finally { m.drop(); }
});

test("check --json and --sarif: a gap on a row lands on that row of its deliverable, a ledger defect on the ledger", () => {
  const m = example();
  try {
    const j = JSON.parse(run(m.dir, ["check", "--strict", "--json"]).out);
    const rows = j.conformance.filter((c) => c.scope === "delegation");
    assert.deepEqual(rows.map((r) => [r.rule, r.kind, r.file, r.line, r.phaseId]), [
      ["(sample)", "sample-malformed", `runward/${SAMPLE_FILE}`, null, null],
      [RULE, "agent-not-delegate", "runward/floor.md", m.line, "floor"],
    ]);
    assert.ok(m.line > 1);
    assert.equal(j.delegation.gaps.length, 2);
    const s = JSON.parse(run(m.dir, ["check", "--strict", "--sarif"]).out);
    const res = s.runs[0].results.find((r) => r.ruleId === "runward/agent-not-delegate");
    const loc = res.locations[0].physicalLocation;
    assert.deepEqual([loc.artifactLocation.uri, loc.region.startLine], ["runward/floor.md", m.line]);
  } finally { m.drop(); }
});
