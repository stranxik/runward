// ADR-0088 decision 6: the weekly signed sample (runward/delegation-samples.jsonl), and decision 7's
// missed periods; decision 4's single-accountable condition, now readable.
//
// What is pinned here: drand's round fixed by arithmetic and quicknet's randomness recomputed from its
// signature (a real round, read 2026-10-02); the draw fixed, stratified and risk-weighted, the
// population hash order-free; a full period re-performed offline from the ledger alone, the seed's
// commitment opened after the review; every tampering named, never repaired; a seed accepted is
// `control missed` and the sample does not count; a rejected act suspends that delegate's class D;
// missed periods read against the latest date the tree declares, never a clock (one: « unsampled
// since <date> »; two: agent acts since are strict gaps and agent ratifications stop counting under
// the regulated tier); the single-accountable exception counting only for a date a passing sample
// covers; the surfaces; and `runward sample` end to end on a git repository (plant, draw, review,
// reveal, status), the review refused inside an agent session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  drawSample, placeSeeds, seedCommitment, shippedDigest, populationHash, drandRound, drandRandomness, riskWeight,
  parseSampleLedger, sampleState, passingCovers, dayString, SAMPLE_BANNER, RANDOMNESS_DECLARED, DRAND_QUICKNET, SAMPLE_FILE,
} from "../../dist/lib/delegation-sample.js";
import { parseCharter, isoDay } from "../../dist/lib/delegation.js";
import { rowDigest, unboundRatifications, charterActGaps, missionSample, UNBOUND_CAUSE_TEXT } from "../../dist/lib/conformance.js";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { buildSarif } from "../../dist/lib/sarif.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
for (const k of ["CLAUDECODE", "GEMINI_CLI", "CURSOR_AGENT", "FORCE_COLOR"]) delete ENV[k];
const run = (cwd, args, env = {}) => {
  try { return { out: execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...ENV, ...env }, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const B3 = "sample: declared human, not proved";

/** A stage-1 charter: effective 2026-09-01, weekly, 5 acts and 1 seed. */
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

/** A deterministic 48-byte "signature": the gate cannot tell it from drand's (declared randomness). */
const sig = (label) => createHash("sha384").update(label).digest("hex");

const POP = [
  { stratum: "merge", ref: "a".repeat(40), date: "2026-09-02", actor: "runward-steward[bot]", summary: "Merge #1: docs", },
  { stratum: "merge", ref: "b".repeat(40), date: "2026-09-03", actor: "runward-steward[bot]", summary: "Merge #2: src change", shipped: true },
  { stratum: "merge", ref: "c".repeat(40), date: "2026-09-04", actor: "Ada", summary: "Merge #3: ci" },
  { stratum: "merge", ref: "d".repeat(40), date: "2026-09-05", actor: "codex", summary: "Merge #4: templates", shipped: true },
  { stratum: "tag", ref: "tag:v1.0.1", date: "2026-09-05", actor: "Ada", summary: "dddddd v1.0.1" },
  { stratum: "ratification", ref: "floor.md@2026-09-06:r-a", date: "2026-09-06", actor: "claude", summary: "mode: agent", agent: true },
  { stratum: "ratification", ref: "floor.md@2026-09-07:r-b", date: "2026-09-07", actor: "Ada", summary: "mode: line-by-line" },
];
const SEED = { stratum: "merge", ref: "e".repeat(40), date: "2026-09-04", actor: "codex", summary: "Merge #5: tidy the gate test", defect: "deletes the strict-gate test", nonce: "11".repeat(32) };

/** The records of one period, built with the same functions the command uses. */
function period({ start = "2026-09-01", end = "2026-09-08", pop = POP, signature = sig(end), seeds = [SEED], size = 5,
  verdict = (_it, isSeed) => (isSeed ? "rejected" : "accepted"), review = true, reveal = true } = {}) {
  const round = drandRound(isoDay(end));
  const randomness = drandRandomness(signature);
  const { full, seedAt } = placeSeeds(drawSample(pop, randomness, size), seeds, randomness);
  const counts = { total: pop.length, gitMerges: pop.filter((p) => p.stratum === "merge").length };
  for (const s of ["merge", "ratification", "tag"]) counts[s] = pop.filter((p) => p.stratum === s).length;
  const shipped = shippedDigest(pop);
  const recs = seeds.map((s) => ({ type: "seed", period: end, round, commitment: seedCommitment(s) }));
  recs.push({ type: "draw", period: end, start, end, branch: "main", size, seeds: seeds.length,
    drand: { chain: DRAND_QUICKNET.chain, round, randomness, signature }, counts, populationHash: populationHash(pop), population: pop, items: full, shipped });
  if (review) recs.push({ type: "review", period: end, reviewer: "github:ada", verdicts: full.map((it, i) => verdict(it, seedAt.includes(i))), shippedDigest: shipped.digest });
  if (review && reveal) recs.push({ type: "reveal", period: end, seeds });
  return { recs, full, seedAt };
}
const jsonl = (...recs) => recs.flat().map((r) => JSON.stringify(r)).join("\n") + "\n";
/** The first drawn act (not a seed) whose actor is a delegate, and a period rejecting it. */
function rejecting() {
  const p = period();
  const target = p.full.find((it, i) => !p.seedAt.includes(i) && ["claude", "codex", "runward-steward[bot]"].includes(it.actor));
  return { target, recs: period({ verdict: (it, isSeed) => (isSeed || it.ref === target.ref ? "rejected" : "accepted") }).recs };
}

// ── the pure pieces ─────────────────────────────────────────────────────────────────────────────

test("drand: the round is fixed by arithmetic, quicknet's randomness is SHA-256 of a real round's signature", () => {
  // Round 1000 of quicknet, read at https://api.drand.sh/<chain>/public/1000 on 2026-10-02.
  assert.equal(drandRandomness("b44679b9a59af2ec876b1a6b1ad52ea9b1615fc3982b19576350f93447cb1125e342b73a8dd2bacbe47e4b6b63ed5e39"),
    "fe290beca10872ef2fb164d2aa4442de4566183ec51c56ff3cd603d930e54fdd");
  assert.equal(drandRandomness("ABC"), null, "not 48 bytes of lower-case hex");
  assert.equal(drandRandomness("B".repeat(96)), null, "upper case is refused, not repaired");
  for (const day of ["2026-09-08", "2026-10-02", "2027-01-01"]) {
    const t = isoDay(day) * 86400, r = drandRound(isoDay(day));
    const at = (n) => DRAND_QUICKNET.genesis + (n - 1) * DRAND_QUICKNET.period;
    assert.ok(at(r) >= t && at(r - 1) < t, `round ${r} is the first emitted at or after ${day} 00:00 UTC`);
  }
  assert.equal(DRAND_QUICKNET.chain, "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971");
});

test("the draw is fixed, stratified and risk-weighted; the population hash ignores order", () => {
  const r = drandRandomness(sig("draw"));
  const a = drawSample(POP, r, 5);
  assert.deepEqual(a, drawSample([...POP].reverse(), r, 5), "the same population in another order draws the same items");
  assert.equal(populationHash(POP), populationHash([...POP].reverse()));
  assert.equal(a.length, 5);
  assert.deepEqual(new Set(drawSample(POP, r, 3).map((x) => x.stratum)), new Set(["merge", "ratification", "tag"]), "one per stratum first");
  assert.equal(drawSample(POP, r, 50).length, POP.length, "never more than the population");
  assert.deepEqual(drawSample([], r, 5), []);
  assert.deepEqual([riskWeight(POP[0]), riskWeight(POP[1]), riskWeight(POP[4]), riskWeight(POP[5]), riskWeight(POP[6])], [1, 3, 2, 3, 1]);
  // Risk-weighted: a shipped merge (3) is drawn about three times as often as another (1).
  const two = [POP[0], { ...POP[1] }];
  let shipped = 0;
  for (let i = 0; i < 600; i++) if (drawSample(two, drandRandomness(sig(`w${i}`)), 1)[0].ref === POP[1].ref) shipped++;
  assert.ok(shipped > 380 && shipped < 520, `shipped drawn ${shipped}/600, expected about 450`);
  // The seeds land where the randomness says, and their positions are known by insertion.
  const { full, seedAt } = placeSeeds(a, [SEED], r);
  assert.equal(full.length, 6);
  assert.equal(full[seedAt[0]].ref, SEED.ref);
  assert.equal(seedCommitment(SEED), seedCommitment({ ...SEED }), "the commitment is a function of the seed and its nonce");
  assert.notEqual(seedCommitment(SEED), seedCommitment({ ...SEED, nonce: "22".repeat(32) }));
});

test("a full period re-performs offline from the ledger alone: seed caught, every act accepted, the period counts", () => {
  const p = period();
  const l = parseSampleLedger(jsonl(p.recs), CHARTER);
  assert.deepEqual(l.problems, []);
  assert.equal(l.samples.length, 1);
  const s = l.samples[0];
  assert.deepEqual([s.status, s.start, s.end, s.items, s.seeds, s.caught, s.rejected.length, s.reviewer], ["passed", "2026-09-01", "2026-09-08", 6, 1, 1, 0, "github:ada"]);
  assert.equal(l.coveredUntil, "2026-09-08");
  // The stages before the end: planted, awaiting review, awaiting reveal. None counts, none is a gap.
  const steps = [
    [p.recs.slice(0, 1), "planted"], [p.recs.slice(0, 2), "awaiting-review"], [p.recs.slice(0, 3), "awaiting-reveal"],
  ];
  for (const [recs, status] of steps) {
    const x = parseSampleLedger(jsonl(recs), CHARTER);
    assert.equal(x.samples[0].status, status);
    assert.deepEqual(x.problems, []);
    assert.equal(x.coveredUntil, "2026-09-01", `${status} covers nothing`);
  }
  // A second week continues the chain from the end of the first.
  const w2 = period({ start: "2026-09-08", end: "2026-09-15", pop: POP.map((x) => ({ ...x, date: dayString(isoDay(x.date) + 7) })) });
  const two = parseSampleLedger(jsonl(p.recs, w2.recs), CHARTER);
  assert.deepEqual(two.problems, []);
  assert.equal(two.coveredUntil, "2026-09-15");
  // A record that ended on or before `effective:` belongs to a previous charter.
  assert.equal(parseSampleLedger(jsonl(p.recs), parseCharter(charterText({ effective: "2026-09-08" }))).samples[0].status, "superseded");
});

test("a seed accepted is control missed and the sample does not count; a rejected act suspends that delegate's class D", () => {
  const missed = parseSampleLedger(jsonl(period({ verdict: () => "accepted" }).recs), CHARTER);
  assert.equal(missed.samples[0].status, "control-missed");
  assert.equal(missed.samples[0].caught, 0);
  assert.equal(missed.coveredUntil, "2026-09-01", "a sample that missed its control does not count");
  const { target, recs } = rejecting();
  const rej = parseSampleLedger(jsonl(recs), CHARTER);
  const s = rej.samples[0];
  assert.equal(s.status, "rejected", "it counts, and it rejected an act");
  assert.equal(rej.coveredUntil, "2026-09-08");
  const st = sampleState(rej, CHARTER, isoDay("2026-09-10"));
  assert.deepEqual(st.suspended.map((x) => [x.delegate, dayString(x.from), x.ref]), [[target.actor, "2026-09-08", target.ref]]);
  assert.equal(passingCovers(st, isoDay("2026-09-03")), false, "a sample that rejected an act is not a passing one");
});

test("every tampering is named, never repaired, and the sample does not count", () => {
  const base = period();
  const mut = (f) => { const recs = structuredClone(base.recs); f(recs); return parseSampleLedger(jsonl(recs), CHARTER); };
  const cases = [
    [(r) => { r[1].items[0].ref = "f".repeat(40); }, /do not re-perform|do not sit where the randomness/],
    [(r) => { r[1].drand.randomness = "0".repeat(64); }, /not SHA-256 of the round's signature/],
    [(r) => { r[1].drand.round += 1; }, /draws on round \d+, announced by arithmetic/],
    [(r) => { r[0].round += 1; }, /the seed announces round/],
    [(r) => { r[1].population.pop(); }, /population hash does not match/],
    [(r) => { r[1].counts.gitMerges = 3; }, /do not reconcile/],
    [(r) => { r[1].shipped.digest = "0".repeat(64); }, /shipped-code digest does not match/],
    [(r) => { r[2].verdicts.pop(); }, /must give each one "accepted" or "rejected"/],
    [(r) => { r[2].shippedDigest = "0".repeat(64); }, /acknowledges another shipped-code digest/],
    [(r) => { r[3].seeds[0].nonce = "33".repeat(32); }, /does not open its commitment/],
    [(r) => { r[1].start = "2026-09-08"; r[1].end = "2026-09-08"; }, /not before its end/],
    [(r) => { r[1].size = 4; }, /4 act\(s\) drawn, the charter asks 5/],
    [(r) => { r[1].population[0].date = "2026-08-30"; r[1].populationHash = populationHash(r[1].population); }, /outside 2026-09-01 to 2026-09-08/],
  ];
  for (const [f, re] of cases) {
    const l = mut(f);
    assert.equal(l.samples[0].status, "malformed", String(f));
    assert.ok(l.problems.some((p) => re.test(p)), `${f}\n${l.problems.join("\n")}`);
    assert.equal(l.coveredUntil, "2026-09-01");
  }
  // Order: a seed after the draw, a reveal before the review; a period off the boundaries; a hole.
  const [seed, draw, review, reveal] = base.recs;
  assert.ok(parseSampleLedger(jsonl(draw, seed, review, reveal), CHARTER).problems.some((p) => /after the draw/.test(p)));
  assert.ok(parseSampleLedger(jsonl(seed, draw, reveal, review), CHARTER).problems.some((p) => /before the review/.test(p)));
  const off = period({ end: "2026-09-09" });
  assert.ok(parseSampleLedger(jsonl(off.recs), CHARTER).problems.some((p) => /not end on a period boundary/.test(p)));
  const hole = period({ start: "2026-09-08", end: "2026-09-15", pop: [] });
  assert.ok(parseSampleLedger(jsonl(hole.recs), CHARTER).problems.some((p) => /never in a population/.test(p)), "a sample may not leave a hole after the last one that counts");
  assert.ok(parseSampleLedger("not json\n", CHARTER).problems.some((p) => /line 1 is not JSON/.test(p)));
  assert.ok(parseSampleLedger(JSON.stringify({ type: "vote", period: "2026-09-08" }) + "\n", CHARTER).problems.some((p) => /unknown record type/.test(p)));
});

test("missed periods are read against the latest date the tree declares, never a clock", () => {
  const src = readFileSync(join(ROOT, "dist", "lib", "delegation-sample.js"), "utf8");
  assert.ok(!/Date\.now\(|new Date\(\)/.test(src), "delegation-sample.js must not read the wall clock (ADR-0054)");
  assert.ok(!/child_process|node:net|node:https?/.test(src), "nor spawn, nor open a socket");
  const none = parseSampleLedger("", CHARTER);
  const at = (day, l = none) => sampleState(l, CHARTER, day === null ? null : isoDay(day));
  assert.deepEqual([at(null).missed, at("2026-08-20").missed, at("2026-09-07").missed], [0, 0, 0]);
  assert.deepEqual([at("2026-09-08").missed, at("2026-09-08").unsampledSince, at("2026-09-08").unsampledFrom], [1, "2026-09-01", null], "one period ended: unsampled since the chain");
  assert.deepEqual([at("2026-09-15").missed, at("2026-09-15").unsampledFrom], [2, isoDay("2026-09-01")], "two: agent acts since the chain stop counting");
  const covered = parseSampleLedger(jsonl(period().recs), CHARTER);
  assert.deepEqual([at("2026-09-14", covered).missed, at("2026-09-15", covered).missed, at("2026-09-15", covered).unsampledSince], [0, 1, "2026-09-08"]);
});

// ── in the gate ─────────────────────────────────────────────────────────────────────────────────

const ROWS = ["r-a", "r-b", "r-c"].map((rule) => ({ rule, status: "applied", evidence: `file:src/${rule}.ts` }));
const line = (date, rule, segs, mode) => `- ${date} · rows: ${rule} · ${segs} · bound: ${rule}@${rowDigest(ROWS.find((r) => r.rule === rule))} · mode: ${mode}`;
function gateMission(entries, { ledger, lock, charter = charterText() } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rw-sample-gate-"));
  writeFileSync(join(dir, "floor.md"), ["# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
    ...ROWS.map((r) => `| ${r.rule} | ${r.status} | ${r.evidence} |`), "", "### Ratification", "", ...entries, ""].join("\n"));
  writeFileSync(join(dir, "delegation.md"), charter);
  if (ledger !== undefined) writeFileSync(join(dir, SAMPLE_FILE), ledger);
  if (lock) writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify(lock));
  return dir;
}
const AGENT = (by) => `by: ${by} (declared, agent) · for: Ada (declared, accountable)`;

test("two missed periods: agent acts since the chain are strict gaps on their rows; one missed is a notice, never a gap", () => {
  const entries = [line("2026-09-03", "r-a", AGENT("claude"), "agent"), line("2026-09-10", "r-b", AGENT("claude"), "agent"), line("2026-09-16", "r-c", "by: Ada", "line-by-line")];
  const dir = gateMission(entries);
  try {
    const gaps = charterActGaps(dir, parseCharter(charterText()), undefined, missionSample(dir, parseCharter(charterText())));
    assert.deepEqual(gaps.map((g) => [g.kind, g.rule]), [["sample-missed", "r-a"], ["sample-missed", "r-b"]], "latest declared 2026-09-16: two periods ended since 2026-09-01");
    assert.match(gaps[0].problem, /after 2 sampling periods missed \(unsampled since 2026-09-01, read against 2026-09-16, the latest date the tree declares\)/);
    const v = computeVerdict(dir, { strict: true });
    assert.equal(v.strictBreakdown.charter, 2);
    assert.equal(v.delegation.sample.notice, "unsampled since 2026-09-01");
    assert.equal(v.delegation.sample.missed, 2);
    // A passing sample of the first week: the chain moves, one period missed, a notice and no gap.
    writeFileSync(join(dir, SAMPLE_FILE), jsonl(period().recs));
    const v2 = computeVerdict(dir, { strict: true });
    assert.equal(v2.strictBreakdown.charter, 0, JSON.stringify(v2.delegation.gaps));
    assert.equal(v2.delegation.sample.notice, "unsampled since 2026-09-08");
    assert.deepEqual(v2.delegation.sample.banner, [B3, RANDOMNESS_DECLARED]);
    // Without --strict: the notice, no gap.
    assert.equal(computeVerdict(dir, {}).delegation.sample.notice, "unsampled since 2026-09-08");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a rejected act suspends its delegate's class D; a malformed record lands on the ledger", () => {
  const { target, recs } = rejecting();
  const other = ["claude", "codex"].find((a) => a !== target.actor);
  const entries = [line("2026-09-09", "r-a", AGENT(target.actor), "agent"), line("2026-09-09", "r-b", AGENT(other), "agent"), line("2026-09-07", "r-c", AGENT(target.actor), "agent")];
  const dir = gateMission(entries, { ledger: jsonl(recs) });
  try {
    const v = computeVerdict(dir, { strict: true });
    assert.deepEqual(v.delegation.gaps.map((g) => [g.kind, g.rule]), [["class-suspended", "r-a"]], "suspended from the sample's end, for that delegate only; an act before it is not");
    assert.ok(v.delegation.gaps[0].problem.includes(`whose class D is suspended since the sample of the period ending 2026-09-08 rejected its act ${target.ref}`), v.delegation.gaps[0].problem);
    const bad = structuredClone(recs); bad[1].items.reverse();
    writeFileSync(join(dir, SAMPLE_FILE), jsonl(bad));
    const v2 = computeVerdict(dir, { strict: true });
    const g = v2.delegation.gaps.find((x) => x.kind === "sample-malformed");
    assert.equal(g.file, `runward/${SAMPLE_FILE}`);
    const sarif = buildSarif(dir, v2, 0);
    const res = sarif.runs[0].results.find((r) => r.ruleId === "runward/sample-malformed");
    assert.equal(res.locations[0].physicalLocation.artifactLocation.uri, `runward/${SAMPLE_FILE}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("single accountable under the regulated tier counts only for a date a passing sample covers; two missed periods stop agent ratifications", () => {
  const lock = { regulated: true, agentRatification: true, identities: { "github:ada": ["Ada"] }, singleAccountable: "github:ada" };
  const single = "by: codex (declared, agent) · for: Ada (declared, accountable) · proposer: claude (declared) · proposer-for: Ada (declared, accountable) · independence: single accountable";
  const causes = (entries, ledger) => {
    const dir = gateMission(entries, { ledger, lock });
    try { return unboundRatifications(dir).filter((u) => u.rule === "r-a").map((u) => u.cause); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const a = [line("2026-09-03", "r-a", single, "agent")];
  assert.deepEqual(causes(a), ["single-accountable-unsampled"], "no ledger");
  assert.deepEqual(causes(a, jsonl(period().recs)), [], "a passing sample covers 2026-09-03: the exception counts");
  assert.deepEqual(causes(a, jsonl(period({ verdict: () => "accepted" }).recs)), ["single-accountable-unsampled"], "control missed covers nothing");
  assert.deepEqual(causes(a, jsonl(period({ review: false }).recs)), ["single-accountable-unsampled"], "a sample not reviewed covers nothing");
  assert.deepEqual(causes([line("2026-09-09", "r-a", single, "agent")], jsonl(period().recs)), ["single-accountable-unsampled"], "a date outside the sample's period");
  // Two periods missed: agent ratifications since stop counting, with their own cause.
  const late = [line("2026-09-03", "r-a", single, "agent"), line("2026-09-16", "r-c", "by: Ada", "line-by-line")];
  assert.deepEqual(causes(late), ["agent-unsampled"]);
  assert.match(UNBOUND_CAUSE_TEXT["agent-unsampled"], /stop counting until a sample in runward\/delegation-samples\.jsonl covers them/);
  assert.match(UNBOUND_CAUSE_TEXT["single-accountable-unsampled"], /not a DORA change-approval control; ADR-0080 Part 2 unchanged\)$/);
});

// ── the surfaces ────────────────────────────────────────────────────────────────────────────────

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-sample-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe", env: ENV });
process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));

test("check (text, JSON, SARIF), report, doctor and verify carry the sample; the same tree gives the same verdict on any day", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-sample-surf-"));
  try {
    cpSync(REFERENCE, dir, { recursive: true });
    writeFileSync(join(dir, "runward", "delegation.md"), charterText());
    writeFileSync(join(dir, "runward", SAMPLE_FILE), jsonl(period().recs));
    // A person's ratification line declares 2026-09-16: one period missed after the sample.
    appendFileSync(join(dir, "runward", "floor.md"), "\n### Ratification\n\n- 2026-09-16 · rows: some-rule · by: Ada · mode: line-by-line\n");
    const t = run(dir, ["check", "--strict"]);
    assert.ok(t.out.includes("unsampled since 2026-09-08") && t.out.includes(B3), t.out);
    assert.ok(t.out.includes("covered until 2026-09-08 · last: period ending 2026-09-08, passed, 6 item(s), 1/1 seed(s) caught, 0 rejected"), t.out);
    const j = JSON.parse(run(dir, ["check", "--strict", "--json"]).out);
    assert.equal(j.delegation.sample.notice, "unsampled since 2026-09-08");
    assert.equal(j.delegation.sample.samples[0].status, "passed");
    const s = JSON.parse(run(dir, ["check", "--strict", "--sarif"]).out);
    assert.deepEqual([s.runs[0].properties.delegation.unsampled, s.runs[0].properties.delegation.sample], ["unsampled since 2026-09-08", [B3, RANDOMNESS_DECLARED]]);
    assert.equal(run(dir, ["report"]).code, 0);
    const html = readFileSync(join(dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.ok(html.includes("unsampled since 2026-09-08") && html.includes(B3), "the report carries the notice and the banner");
    const d = run(dir, ["doctor"], { RUNWARD_NOW: "2026-10-02" });
    assert.ok(d.out.includes("unsampled since 2026-09-08: 3 sampling period(s) ended by this run's clock (2026-10-02)"), d.out);
    // Same tree, same verdict, whatever the clock.
    const a = run(dir, ["check", "--strict", "--json"], { RUNWARD_NOW: "2026-09-10", SOURCE_DATE_EPOCH: "" });
    const b = run(dir, ["check", "--strict", "--json"], { RUNWARD_NOW: "2031-06-30", SOURCE_DATE_EPOCH: "" });
    assert.equal(a.out, b.out);
    // verify re-derives the block: a sample status rewritten in the predicate is a difference.
    const att = join(dir, "verdict.intoto.json");
    writeFileSync(att, run(dir, ["check", "--attest", "--strict"]).out);
    assert.equal(run(dir, ["verify", att]).code, 0);
    const st = JSON.parse(readFileSync(att, "utf8"));
    st.predicate.delegation.sample.notice = null;
    writeFileSync(att, JSON.stringify(st));
    assert.ok(JSON.parse(run(dir, ["verify", att, "--json"]).out).predicate.differing.includes("delegation"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── `runward sample`, end to end on git ────────────────────────────────────────────────────────

test("runward sample: plant, draw, review, reveal on a git repository; the gate reads the period as passed; the review refuses an agent session", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-sample-cmd-"));
  const GENV = { GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.com", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.com", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  const git = (args, date) => execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args], { cwd: dir, stdio: "pipe", encoding: "utf8",
    env: { ...ENV, ...GENV, ...(date ? { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : {}) } });
  const rw = (args, env = {}) => run(dir, args, { ...GENV, ...env });
  try {
    cpSync(REFERENCE, dir, { recursive: true });
    writeFileSync(join(dir, "runward", "delegation.md"), charterText());
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", files: ["dist", "templates"] }));
    git(["init", "-q", "-b", "main"]);
    git(["add", "-A"]); git(["commit", "-qm", "init"], "2026-09-01T09:00:00Z");
    // The planter commits the seed before the period closes.
    assert.equal(rw(["sample", "plant"], { RUNWARD_NOW: "2026-09-02" }).code, 2, "plant needs the item and its defect");
    const p = rw(["sample", "plant", "--ref", "seed-0001", "--summary", "Merge #9: tidy", "--defect", "deletes the gate test", "--actor", "codex"], { RUNWARD_NOW: "2026-09-02" });
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /seed 1\/1 for the period ending 2026-09-08/);
    assert.ok(!readFileSync(join(dir, "runward", SAMPLE_FILE), "utf8").includes("deletes the gate test"), "the seed itself stays out of the tree until the reveal");
    git(["add", "-A"]); git(["commit", "-qm", "seed"], "2026-09-02T09:00:00Z");
    // A week of merges: one shipped (src/, since dist ships), one not; a tag.
    for (const [i, file] of [[1, "src/a.ts"], [2, "notes.md"]]) {
      git(["checkout", "-qb", `f${i}`]);
      mkdirSync(join(dir, dirname(file)), { recursive: true });
      writeFileSync(join(dir, file), `${i}\n`);
      git(["add", "-A"]); git(["commit", "-qm", `feat ${i}`], `2026-09-0${i + 2}T10:00:00Z`);
      git(["checkout", "-q", "main"]); git(["merge", "-q", "--no-ff", `f${i}`, "-m", `Merge f${i}`], `2026-09-0${i + 2}T11:00:00Z`);
    }
    git(["tag", "v0.0.1"], "2026-09-05T10:00:00Z");
    // The draw waits for the period to close, and for the drand signature someone fetched.
    assert.match(rw(["sample", "draw"], { RUNWARD_NOW: "2026-09-07" }).out, /has not closed/);
    const noSig = rw(["sample", "draw"], { RUNWARD_NOW: "2026-09-09" });
    assert.equal(noSig.code, 2);
    assert.ok(noSig.out.includes(`curl -s ${DRAND_QUICKNET.url}/${DRAND_QUICKNET.chain}/public/${drandRound(isoDay("2026-09-08"))}`), noSig.out);
    const d = rw(["sample", "draw", "--signature", sig("cmd")], { RUNWARD_NOW: "2026-09-09" });
    assert.equal(d.code, 0, d.out);
    assert.match(d.out, /population 3 act\(s\): 2 merge, 0 ratification, 1 tag; merges reconciled 2\/2/);
    assert.match(d.out, /runward sample review 1=accept 2=accept 3=accept 4=accept && git add runward\/delegation-samples\.jsonl && git commit -S -m "sample: review of the period ending 2026-09-08"/);
    git(["add", "-A"]); git(["commit", "-qm", "draw"], "2026-09-09T10:00:00Z");
    const ledger = readFileSync(join(dir, "runward", SAMPLE_FILE), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const drawRec = ledger.find((r) => r.type === "draw");
    assert.equal(drawRec.shipped.merges.length, 1, "the src/ merge is shipped code, the notes merge is not");
    const seedAt = drawRec.items.findIndex((it) => it.ref === "seed-0001");
    // The review is the maintainer's: refused inside an agent session, then recorded from a terminal.
    const verdicts = drawRec.items.map((_, i) => `${i + 1}=${i === seedAt ? "reject" : "accept"}`);
    const inAgent = rw(["sample", "review", ...verdicts], { CLAUDECODE: "1" });
    assert.equal(inAgent.code, 2);
    assert.match(inAgent.out, /the review is the maintainer's act, and this process runs inside an agent session \(CLAUDECODE\)/);
    assert.match(rw(["sample", "review", "1=accept"]).out, /every item needs a verdict; missing: 2, 3, 4/);
    const r = rw(["sample", "review", ...verdicts]);
    assert.equal(r.code, 0, r.out);
    git(["add", "-A"]); git(["commit", "-qm", "review"], "2026-09-09T11:00:00Z");
    const v = rw(["sample", "reveal"]);
    assert.equal(v.code, 0, v.out);
    assert.match(v.out, /control caught: 1\/1 seed\(s\) rejected; 0 real act\(s\) rejected; status passed/);
    git(["add", "-A"]); git(["commit", "-qm", "reveal"], "2026-09-09T12:00:00Z");
    // The gate reads it from the tree; the command reads what git says.
    const j = JSON.parse(rw(["check", "--strict", "--json"]).out);
    assert.equal(j.delegation.sample.samples[0].status, "passed");
    assert.equal(j.delegation.sample.coveredUntil, "2026-09-08");
    const s = rw(["sample"], { RUNWARD_NOW: "2026-09-10" });
    assert.match(s.out, /period ending 2026-09-08: review commit [0-9a-f]{12} NOT signed/);
    assert.match(s.out, /every seed was committed before the draw/);
    assert.match(s.out, /the seeds were revealed after the review commit/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
