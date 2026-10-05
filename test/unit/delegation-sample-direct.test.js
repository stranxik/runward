// Direct tests of src/lib/delegation-sample.ts (ADR-0088 decisions 6 and 7), written from the survivors
// the 0.43.0 ratchet filed as "not yet instructed" (ADR-0046 decision 4). Each assertion is a behaviour
// of the exported API that a surviving mutant changed and no test observed.
//
// Three kinds of claim are pinned, and why each is a behaviour rather than a detail:
//  - THE STATUS OF A PERIOD. A sample that counts moves the chain and lifts the single-accountable
//    condition; one that does not leaves agent acts unsampled. Every tampering below must leave the
//    period `malformed`, and every legitimate variant must leave it `passed`.
//  - THE NUMBER OF PROBLEMS. Each ledger problem becomes one strict gap (verdict.ts, `sample-malformed`),
//    so a defect named twice, or a second problem invented on top of a real one, moves the strict count.
//    A mutant that only swaps one problem's sentence for another is left alone (ADR-0046 decision 1).
//  - THE CANONICAL FORMS (population hash, draw, seed placement, shipped digest). `runward sample`
//    writes a ledger and the gate re-performs it, both with this module, so a change of the form is
//    invisible to a round trip and breaks every ledger already committed. They are pinned by value.
//
// And one contract the module states for itself: parseSampleLedger never throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  drawSample, placeSeeds, seedCommitment, shippedDigest, populationHash, drandRound, drandRandomness,
  parseSampleLedger, readSampleLedger, sampleState, passingCovers, dayString,
  RANDOMNESS_DECLARED, DRAND_QUICKNET, SAMPLE_FILE,
} from "../../dist/lib/delegation-sample.js";
import { parseCharter, isoDay } from "../../dist/lib/delegation.js";

/** A stage-1 charter: effective 2026-09-01, weekly, 5 acts and 1 seed (the sample test's reference). */
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
const sig = (label) => createHash("sha384").update(label).digest("hex");
const sha = (s) => createHash("sha256").update(s).digest("hex");

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

/** The records of one period, built with the module's own functions (as `runward sample` builds them). */
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
const jsonl = (...recs) => recs.flat(Infinity).map((r) => JSON.stringify(r)).join("\n") + "\n";
const read = (recs, charter = CHARTER) => parseSampleLedger(jsonl(recs), charter);
/** The records of the reference period with `f` applied to a copy of them. */
const tampered = (f, opts = {}) => { const recs = structuredClone(period(opts).recs); f(recs); return recs; };
/** The one sample's status and the ledger's problem count. */
const verdictOf = (l) => [l.samples[0]?.status, l.problems.length];
const DRAW = 1, REVIEW = 2, REVEAL = 3;

test("the reference period passes, so every `malformed` below is the tampering's doing", () => {
  const l = read(period().recs);
  assert.deepEqual(l.problems, []);
  assert.equal(l.samples[0].status, "passed");
});

// ── constants a consumer reads ──────────────────────────────────────────────────────────────────

test("the randomness disclosure and drand's quicknet coordinates, at the character", () => {
  // Printed on check, doctor and sample, and carried in the verdict's banner: what the gate does not
  // verify is said on every surface, so an empty or rewritten disclosure is a claim, not a typo.
  assert.equal(RANDOMNESS_DECLARED, "randomness: declared — the drand round is recomputed and its randomness checked against its signature; the signature is not verified against drand's public key");
  // https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/info, read 2026-10-02.
  assert.equal(DRAND_QUICKNET.publicKey, "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a");
  assert.equal(DRAND_QUICKNET.url, "https://api.drand.sh");
});

// ── the canonical forms ─────────────────────────────────────────────────────────────────────────

test("the population hash, the draw, the seed placement and the shipped digest, by value", () => {
  const r = drandRandomness(sig("golden"));
  assert.equal(populationHash(POP), GOLDEN.populationHash);
  assert.deepEqual(drawSample(POP, r, 5).map((x) => x.ref), GOLDEN.draw);
  assert.deepEqual(placeSeeds(drawSample(POP, r, 5), [SEED, { ...SEED, ref: "f".repeat(40) }], r).seedAt, GOLDEN.seedAt);
  // The shipped digest is SHA-256 of the shipped merges' refs, sorted, one per line.
  const sh = shippedDigest(POP);
  assert.deepEqual(sh.merges, ["b".repeat(40), "d".repeat(40)]);
  assert.equal(sh.digest, sha(`${"b".repeat(40)}\n${"d".repeat(40)}`));
});

test("the population hash tells a shipped merge and an agent ratification from the same act without the flag", () => {
  const base = { stratum: "merge", ref: "a".repeat(40), date: "2026-09-02", actor: "codex", summary: "Merge" };
  assert.notEqual(populationHash([{ ...base, shipped: true }]), populationHash([base]));
  assert.equal(populationHash([{ ...base, shipped: false }]), populationHash([base]), "false and absent are one flag");
  const rat = { ...base, stratum: "ratification" };
  assert.notEqual(populationHash([{ ...rat, agent: true }]), populationHash([rat]));
  assert.equal(populationHash([{ ...rat, agent: false }]), populationHash([rat]));
});

/** A deterministic permutation of `xs`, by sorting on a hash of each item's position and a label. */
const shuffle = (xs, label) => xs.map((x, i) => [sha(`${label}:${i}`), x]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, x]) => x);
const BIG = [
  ...POP,
  ...Array.from({ length: 9 }, (_, i) => ({ stratum: "merge", ref: `${i}`.repeat(40).slice(0, 40), date: "2026-09-03", actor: "codex", summary: `Merge #${10 + i}`, shipped: i % 3 === 0 })),
  ...Array.from({ length: 4 }, (_, i) => ({ stratum: "ratification", ref: `floor.md@2026-09-0${i + 2}:r-${i}`, date: `2026-09-0${i + 2}`, actor: "claude", summary: "mode: agent", agent: i % 2 === 0 })),
];

test("the draw does not depend on the order the population was listed in", () => {
  for (let k = 0; k < 40; k++) {
    const r = drandRandomness(sig(`order${k}`));
    const want = drawSample(BIG, r, 6);
    for (let p = 0; p < 6; p++) assert.deepEqual(drawSample(shuffle(BIG, `${k}:${p}`), r, 6), want, `randomness ${k}, permutation ${p}`);
  }
});

test("stratified first: each non-empty stratum gives one act before the weighted rest, and never more than `size` acts", () => {
  for (let k = 0; k < 60; k++) {
    const r = drandRandomness(sig(`strata${k}`));
    const three = drawSample(BIG, r, 3);
    assert.deepEqual(three.map((x) => x.stratum), ["merge", "ratification", "tag"], `randomness ${k}`);
    assert.equal(drawSample(BIG, r, 1).length, 1);
    assert.equal(drawSample(BIG, r, 1)[0].stratum, "merge", "the floor visits merge first");
    assert.equal(drawSample(BIG, r, 2).length, 2);
    assert.deepEqual(drawSample(BIG, r, 2).map((x) => x.stratum), ["merge", "ratification"]);
  }
});

test("seeds land anywhere among the drawn acts, end included, and each seed's position is its own", () => {
  const seen = new Set();
  const two = [SEED, { ...SEED, ref: "f".repeat(40), summary: "Merge #6: another seed" }];
  for (let k = 0; k < 200; k++) {
    const r = drandRandomness(sig(`seed${k}`));
    const items = drawSample(POP, r, 3);
    const { full, seedAt } = placeSeeds(items, two, r);
    assert.equal(full.length, 5);
    assert.deepEqual(seedAt.map((i) => full[i].ref), two.map((s) => s.ref), `randomness ${k}`);
    seen.add(placeSeeds(items, [SEED], r).seedAt[0]);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3], "with three drawn acts a single seed takes each of the four positions");
});

test("the shipped digest is the shipped merges only, in an order the population's listing does not change", () => {
  assert.deepEqual(shippedDigest([...POP].reverse()), shippedDigest(POP));
  const flagged = [...POP, { stratum: "tag", ref: "tag:v2", date: "2026-09-05", actor: "Ada", summary: "v2", shipped: true },
    { stratum: "ratification", ref: "r@x", date: "2026-09-05", actor: "claude", summary: "agent", shipped: true }];
  assert.deepEqual(shippedDigest(flagged).merges, ["b".repeat(40), "d".repeat(40)], "a tag or a ratification is never shipped code");
});

// ── hex ─────────────────────────────────────────────────────────────────────────────────────────

test("a signature is 48 bytes of lower-case hex and nothing else; a seed commitment is 32", () => {
  const h = sig("x");
  assert.notEqual(drandRandomness(h), null);
  for (const bad of ["abcd", h.slice(0, -2), `${h}00`, `-${h.slice(1)}`, `g${h.slice(1)}`, `${h.slice(0, -1)}!`, Array.from({ length: 96 }, () => "a")]) {
    assert.equal(drandRandomness(bad), null, JSON.stringify(bad).slice(0, 40));
  }
  // The same rule on a seed commitment: a planted period with a malformed commitment is malformed.
  const seedRec = (commitment) => [{ type: "seed", period: "2026-09-08", round: drandRound(isoDay("2026-09-08")), commitment }];
  assert.deepEqual(verdictOf(read(seedRec(seedCommitment(SEED)))), ["planted", 0]);
  for (const bad of ["abcd", "-".repeat(64), "g".repeat(64), Array.from({ length: 64 }, () => "a"), 7]) {
    assert.deepEqual(verdictOf(read(seedRec(bad))), ["malformed", 1], JSON.stringify(bad).slice(0, 40));
  }
});

// ── the records ─────────────────────────────────────────────────────────────────────────────────

test("a byte-order mark is stripped at the start of the ledger only, and blank lines are skipped", () => {
  assert.deepEqual(parseSampleLedger(`﻿${jsonl(period().recs)}`, CHARTER).problems, []);
  const pop = POP.map((p, i) => (i === 0 ? { ...p, summary: "Merge #1:﻿ docs" } : p));
  assert.deepEqual(read(period({ pop }).recs).problems, [], "a U+FEFF inside a record is content");
  const spaced = period().recs.map((r) => JSON.stringify(r)).join("\n   \n\t\n") + "\n";
  assert.deepEqual(parseSampleLedger(spaced, CHARTER).problems, []);
});

test("a line that is not a record object is one problem, and never an exception", () => {
  for (const line of ["null", "5", '"draw"', "[1]", "true", '{"period":"2026-09-08"}', '{"type":"draw"}', '{"type":5,"period":"2026-09-08"}']) {
    assert.equal(parseSampleLedger(`${line}\n`, CHARTER).problems.length, 1, line);
  }
});

test("a record repeated, or a review before its draw, makes the period malformed", () => {
  const [seed, draw, review, reveal] = period().recs;
  for (const recs of [[seed, draw, draw, review, reveal], [seed, draw, review, review, reveal], [seed, draw, review, reveal, reveal], [seed, review, draw, reveal]]) {
    assert.equal(read(recs).samples[0].status, "malformed", recs.map((r) => r.type).join(","));
  }
});

test("without a window in the charter there is no chain: the ledger is read, nothing is placed in time", () => {
  for (const over of [{ effective: "soon" }, { "sample-period-days": "0" }, { effective: "soon", "sample-period-days": "x" }]) {
    const l = read(period().recs, parseCharter(charterText(over)));
    assert.deepEqual(l, { file: `runward/${SAMPLE_FILE}`, present: true, samples: [], coveredUntil: null, problems: [] }, JSON.stringify(over));
  }
});

test("periods are read in date order whatever the file's order, the undated first", () => {
  const w1 = period();
  const w2 = period({ start: "2026-09-08", end: "2026-09-15", pop: POP.map((x) => ({ ...x, date: dayString(isoDay(x.date) + 7) })) });
  const w3 = period({ start: "2026-09-15", end: "2026-09-22", pop: POP.map((x) => ({ ...x, date: dayString(isoDay(x.date) + 14) })) });
  const l = read([w3.recs, w1.recs, w2.recs]);
  assert.deepEqual(l.problems, []);
  assert.equal(l.coveredUntil, "2026-09-22");
  const undated = { type: "seed", period: "someday", round: 1, commitment: "a".repeat(64) };
  const u = read([w2.recs, undated, w1.recs]);
  assert.deepEqual(u.samples.map((s) => s.period), ["someday", "2026-09-08", "2026-09-15"]);
  assert.deepEqual(u.samples.map((s) => s.status), ["malformed", "passed", "passed"]);
  assert.equal(u.coveredUntil, "2026-09-15");
});

test("a period that is not a date is malformed, named once, and covers nothing", () => {
  const l = read([{ type: "seed", period: "2026-02-30", round: 1, commitment: "a".repeat(64) }]);
  assert.deepEqual(verdictOf(l), ["malformed", 1]);
  assert.deepEqual(l.samples[0].rejected, []);
  assert.equal(l.coveredUntil, "2026-09-01");
  // A planted period carries no rejection either.
  assert.deepEqual(read(period().recs.slice(0, 1)).samples[0].rejected, []);
});

test("a draw with no seed committed before it is named", () => {
  const l = read(tampered((r) => r.shift(), { review: false }));
  assert.equal(l.samples[0].status, "malformed");
  assert.ok(l.problems.some((p) => /no seed was committed before the draw/.test(p)), l.problems.join("\n"));
});

test("every field of the draw is checked: each tampering, alone, makes the period malformed", () => {
  const cases = {
    "end is not the period": (r) => { r[DRAW].end = "2026-09-07"; },
    "chain": (r) => { r[DRAW].drand.chain = "0".repeat(64); },
    "counts.merge and gitMerges together": (r) => { r[DRAW].counts.merge = 9; r[DRAW].counts.gitMerges = 9; },
    "counts.tag": (r) => { r[DRAW].counts.tag = 0; },
    "counts.total": (r) => { r[DRAW].counts.total = 99; },
    "shipped merges, digest kept": (r) => { r[DRAW].shipped.merges = ["b".repeat(40)]; },
    "seeds counted": (r) => { r[DRAW].seeds = 2; },
    "a drawn act's summary": (r) => { r[DRAW].items.find((x) => x.ref !== SEED.ref).summary = "other"; },
    "a drawn act's stratum": (r) => { r[DRAW].items.find((x) => x.ref !== SEED.ref).stratum = "other"; },
    "a drawn act's date": (r) => { r[DRAW].items.find((x) => x.ref !== SEED.ref).date = "2026-09-07"; },
    "a drawn act's actor": (r) => { r[DRAW].items.find((x) => x.ref !== SEED.ref).actor = "other"; },
    "a verdict outside accepted/rejected": (r) => { const i = r[REVIEW].verdicts.indexOf("accepted"); r[REVIEW].verdicts[i] = "fine"; },
  };
  for (const [name, f] of Object.entries(cases)) {
    assert.equal(read(tampered(f)).samples[0].status, "malformed", name);
  }
});

test("before the review, a draw whose items do not re-perform is already malformed", () => {
  const cases = {
    "an act replaced": (r) => { r[DRAW].items[r[DRAW].items.findIndex((x) => x.ref !== SEED.ref)].ref = "f".repeat(40); },
    // The draw less its last act: what is left over is exactly as many items as seeds were committed,
    // so only the subsequence check can tell it from a draw that re-performs.
    "the last act dropped": (r) => { const it = r[DRAW].items; it.splice(it.map((x) => x.ref !== SEED.ref).lastIndexOf(true), 1); },
    "an act added": (r) => { r[DRAW].items.push({ ...POP[0], ref: "9".repeat(40) }); },
    "no items": (r) => { r[DRAW].items = null; },
  };
  for (const [name, f] of Object.entries(cases)) {
    assert.deepEqual(verdictOf(read(tampered(f, { review: false }))), ["malformed", 1], name);
  }
});

test("a seed revealed where the randomness did not put it is named", () => {
  const recs = tampered((r) => {
    const items = r[DRAW].items, at = items.findIndex((x) => x.ref === SEED.ref);
    // Swapped with its neighbour: the drawn acts stay in their order, so the draw still re-performs and
    // only the seed's position is wrong.
    const to = at === 0 ? 1 : at - 1;
    [items[at], items[to]] = [items[to], items[at]];
    r[REVIEW].verdicts = items.map((x) => (x.ref === SEED.ref ? "rejected" : "accepted"));
  });
  assert.deepEqual(verdictOf(read(recs)), ["malformed", 1]);
});

test("the draw's window: on the charter's boundaries, from the end of the last sample that counts", () => {
  // A start one period BEFORE effective: on the arithmetic of the boundaries, outside the charter.
  assert.equal(read(period({ start: "2026-08-25" }).recs).samples[0].status, "malformed");
  // A second period starting off the boundaries, inside the first one's window.
  const w1 = period();
  const pop2 = POP.map((x) => ({ ...x, date: dayString(isoDay(x.date) + 7) }));
  const w2 = period({ start: "2026-09-05", end: "2026-09-15", pop: pop2 });
  const l = read([w1.recs, w2.recs]);
  assert.deepEqual(l.samples.map((s) => s.status), ["passed", "malformed"]);
  assert.equal(l.coveredUntil, "2026-09-08");
});

test("an act dated on the start counts, an act dated on the end does not", () => {
  const onStart = POP.map((p, i) => (i === 0 ? { ...p, date: "2026-09-01" } : p));
  assert.deepEqual(verdictOf(read(period({ pop: onStart }).recs)), ["passed", 0]);
  const onEnd = POP.map((p, i) => (i === 0 ? { ...p, date: "2026-09-08" } : p));
  assert.deepEqual(verdictOf(read(period({ pop: onEnd }).recs)), ["malformed", 1]);
});

test("a draw with no start date and an undated act names both, once each", () => {
  const pop = POP.map((p, i) => (i === 0 ? { ...p, date: "soon" } : p));
  const recs = tampered((r) => { delete r[DRAW].start; }, { pop, review: false });
  assert.deepEqual(verdictOf(read(recs)), ["malformed", 2]);
});

test("size and seeds: whole numbers of at least 1, as many as the charter asks", () => {
  // Legitimate: the charter asks one act and one is drawn.
  const one = parseCharter(charterText({ "sample-size": "1" }));
  assert.deepEqual(verdictOf(read(period({ size: 1 }).recs, one)), ["passed", 0]);
  // Not whole numbers, or below 1 where the charter states no size: malformed, each named once.
  const noSize = parseCharter(charterText({ "sample-size": "0" }));
  assert.deepEqual(verdictOf(read(period({ size: 0 }).recs, noSize)), ["malformed", 1], "size 0");
  assert.deepEqual(verdictOf(read(period({ size: 5.5 }).recs)), ["malformed", 1], "size 5.5");
  assert.deepEqual(verdictOf(read(tampered((r) => { r[DRAW].size = "5"; }))), ["malformed", 1], "size \"5\"");
  assert.deepEqual(verdictOf(read(tampered((r) => { delete r[DRAW].size; }, { review: false }))), ["malformed", 1], "no size");
  assert.deepEqual(verdictOf(read(tampered((r) => { r[DRAW].seeds = 0; }))), ["malformed", 1], "seeds 0");
  // Fewer seeds than the charter asks.
  const twoSeeds = parseCharter(charterText({ "sample-seeds": "2" }));
  assert.equal(read(period().recs, twoSeeds).samples[0].status, "malformed");
});

test("a signature that is not hex is malformed even when the record declares no randomness, and named once", () => {
  assert.equal(read(tampered((r) => { r[DRAW].drand.signature = "zz"; r[DRAW].drand.randomness = null; })).samples[0].status, "malformed");
  assert.deepEqual(verdictOf(read(tampered((r) => { r[DRAW].drand.signature = "zz"; }, { review: false }))), ["malformed", 1]);
});

test("the population is a list of acts: one item of another kind makes the period malformed, and is named once", () => {
  // Each population is internally consistent (hash, counts, draw, digest built from it), so only the
  // check on the population itself can tell it from a real one.
  const odd = (extra) => read(period({ pop: [...POP, { stratum: "merge", ref: "9".repeat(40), date: "2026-09-03", actor: "codex", summary: "Merge #9", ...extra }] }).recs);
  for (const extra of [{ stratum: "vote" }, { shipped: "yes" }, { agent: "yes" }, { summary: 9 }, { actor: 9 }, { date: 9 }, { ref: 9 }]) {
    assert.equal(odd(extra).samples[0].status, "malformed", JSON.stringify(extra));
  }
  // Not a list at all: one problem, the draw not re-performed against it, and no exception.
  for (const population of ["x", 5, null, [null], [POP[0], null]]) {
    const l = read(tampered((r) => { r[DRAW].population = population; }, { review: false }));
    assert.deepEqual(verdictOf(l), ["malformed", 1], JSON.stringify(population));
  }
  // With an empty population recorded consistently and then replaced: still named.
  const empty = period({ pop: [], seeds: [SEED], size: 5 });
  assert.equal(read(structuredClone(empty.recs).map((r) => (r.type === "draw" ? { ...r, population: "x" } : r))).samples[0].status, "malformed");
});

test("a seed must be an act with its defect and its nonce, every field a string", () => {
  for (const extra of [{ stratum: 9 }, { ref: 9 }, { date: 9 }, { actor: 9 }, { summary: 9 }, { defect: undefined }, { nonce: undefined }]) {
    const s = { ...SEED, ...extra };
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    assert.equal(read(period({ seeds: [s] }).recs).samples[0].status, "malformed", JSON.stringify(extra));
  }
});

test("the review names a reviewer, and gives each item a verdict", () => {
  for (const reviewer of [undefined, null, 5, "", "---"]) {
    const l = read(tampered((r) => { r[REVIEW].reviewer = reviewer; if (reviewer === undefined) delete r[REVIEW].reviewer; }));
    assert.equal(l.samples[0].status, "malformed", String(reviewer));
    assert.equal(l.samples[0].reviewer, null);
  }
  // Reviewed, not yet revealed, with a defect: malformed, not a stage of the protocol.
  assert.equal(read(tampered((r) => { delete r[REVIEW].reviewer; }, { reveal: false })).samples[0].status, "malformed");
  // A draw that recorded no shipped digest is a problem of its own, never an exception.
  assert.equal(read(tampered((r) => { delete r[DRAW].shipped; })).samples[0].status, "malformed");
});

test("malformed records never throw, whatever they hold", () => {
  const shapes = [
    (r) => { r[DRAW].items = [null]; },
    (r) => { r[DRAW].items = [null, ...r[DRAW].items]; },
    (r) => { r[DRAW].items = "x"; },
    (r) => { r[DRAW].items = null; },
    (r) => { r[DRAW].population = 5; },
    (r) => { r[REVEAL].seeds = [null]; },
    (r) => { r[REVEAL].seeds = [SEED, null]; },
    (r) => { r[REVEAL].seeds = [SEED, SEED]; },
    (r) => { delete r[REVEAL].seeds; },
    (r) => { r[REVEAL].seeds = "x"; },
    (r) => { r[REVIEW].verdicts = "x"; },
    (r) => { r[REVIEW].verdicts = null; },
    (r) => { r[REVIEW].reviewer = 5; },
    (r) => { r[DRAW].drand = null; },
  ];
  for (const f of shapes) {
    const l = read(tampered(f));
    assert.equal(l.samples[0].status, "malformed", String(f));
  }
  // The reveal opening more seeds than were committed is named, with no exception, wherever the
  // randomness puts the extra seed (at the end too, where every other position still agrees).
  const extra = { ...SEED, ref: "f".repeat(40) };
  let atEnd = 0;
  for (let k = 0; k < 60; k++) {
    const signature = sig(`extra${k}`);
    const p = period({ signature });
    if (placeSeeds(p.full.filter((_, i) => !p.seedAt.includes(i)), [SEED, extra], drandRandomness(signature)).seedAt[1] === p.full.length) atEnd++;
    const recs = structuredClone(p.recs);
    recs[REVEAL].seeds = [SEED, extra];
    assert.equal(read(recs).samples[0].status, "malformed", `signature ${k}`);
  }
  assert.ok(atEnd > 0, "some of these signatures put the extra seed last");
});

// ── reading the file ────────────────────────────────────────────────────────────────────────────

test("an absent ledger: not present, its path named, the chain at `effective:` when the charter has a window", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-ledger-"));
  try {
    assert.deepEqual(readSampleLedger(dir, CHARTER), { file: `runward/${SAMPLE_FILE}`, present: false, samples: [], coveredUntil: "2026-09-01", problems: [] });
    assert.equal(readSampleLedger(dir, parseCharter(charterText({ effective: "soon" }))).coveredUntil, null);
    assert.equal(readSampleLedger(dir, parseCharter(charterText({ "sample-period-days": "0" }))).coveredUntil, null);
    // A ledger that exists and cannot be read as a file reads as an empty ledger: present, no sample,
    // so every period since `effective:` is still unsampled. Nothing is invented from the failure.
    mkdirSync(join(dir, SAMPLE_FILE));
    assert.deepEqual(readSampleLedger(dir, CHARTER), { file: `runward/${SAMPLE_FILE}`, present: true, samples: [], coveredUntil: "2026-09-01", problems: [] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the state the gate reads ────────────────────────────────────────────────────────────────────

test("no window, no missed period; no declared date, no latest", () => {
  const noWindow = parseCharter(charterText({ effective: "soon" }));
  const st = sampleState(parseSampleLedger("", noWindow), noWindow, isoDay("2026-10-01"));
  assert.deepEqual([st.missed, st.unsampledSince, st.unsampledFrom], [0, null, null]);
  const none = sampleState(parseSampleLedger("", CHARTER), CHARTER, null);
  assert.deepEqual([none.latest, none.missed, none.passing, none.suspended], [null, 0, [], []]);
});

test("a rejected act suspends a delegate only, and a sample that missed its control still suspends", () => {
  const p = period();
  const delegateAct = p.full.find((it, i) => !p.seedAt.includes(i) && ["claude", "codex", "runward-steward[bot]"].includes(it.actor));
  const personAct = p.full.find((it, i) => !p.seedAt.includes(i) && it.actor === "Ada");
  assert.ok(delegateAct && personAct, "the reference draw holds a delegate's act and a person's");
  // The seed accepted (control missed) AND a delegate's act rejected.
  const missed = read(period({ verdict: (it, isSeed) => (!isSeed && it.ref === delegateAct.ref ? "rejected" : "accepted") }).recs);
  assert.equal(missed.samples[0].status, "control-missed");
  assert.deepEqual(sampleState(missed, CHARTER, isoDay("2026-09-10")).suspended.map((s) => s.delegate), [delegateAct.actor]);
  // A person's act rejected: the sample rejected an act, and nobody is suspended.
  const person = read(period({ verdict: (it, isSeed) => (isSeed || it.ref === personAct.ref ? "rejected" : "accepted") }).recs);
  assert.equal(person.samples[0].status, "rejected");
  assert.deepEqual(sampleState(person, CHARTER, isoDay("2026-09-10")).suspended, []);
});

test("a passing sample covers its period from its start, included, to its end, excluded", () => {
  const st = sampleState(read(period().recs), CHARTER, isoDay("2026-09-10"));
  assert.deepEqual(st.passing, [[isoDay("2026-09-01"), isoDay("2026-09-08")]]);
  const at = (d) => passingCovers(st, isoDay(d));
  assert.deepEqual([at("2026-08-31"), at("2026-09-01"), at("2026-09-07"), at("2026-09-08")], [false, true, true, false]);
});

/** Values computed by this module on 2026-10-05 (0.43.0); see the header for why they are pinned. */
const GOLDEN = {
  populationHash: "146b8575ea1d4f71c002f43394a1ddf2079339a3305ee25f3afd9d2b6f643afb",
  draw: ["b".repeat(40), "floor.md@2026-09-06:r-a", "tag:v1.0.1", "a".repeat(40), "floor.md@2026-09-07:r-b"],
  seedAt: [0, 2],
};
