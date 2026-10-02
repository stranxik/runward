// The weekly signed sample (ADR-0088 decision 6): `runward/delegation-samples.jsonl`, read by the gate.
//
// What it is. One ledger, append-only, one JSON object per line, four record types per period:
//   seed    the planted defective item, committed as H(seed, nonce) BEFORE the sample, with the drand
//           round the draw will use, announced in advance;
//   draw    the population built from git (first-parent merges on the branch, tags, ratification
//           entries since the last sample that counts), its counts and its hash, the drand round's
//           signature, the items drawn, and the 100 % digest of shipped-code merges (decision 7);
//   review  the maintainer's verdict on every item (`accepted` / `rejected`) and the digest they
//           acknowledged, in a commit the maintainer signs;
//   reveal  the seeds and their nonces, after the review, so anyone re-performs the control.
// `runward sample` (src/commands/sample.ts, outside the verdict path) writes every record; it reads
// git, the gate never does.
//
// What the gate does with it, from the file's content alone (ADR-0054: no process, no socket, no git,
// no clock). It re-performs the draw: the round is recomputed from the period's end, the randomness is
// recomputed from the round's signature (drand quicknet is unchained: randomness = SHA-256(signature)),
// the population hash and counts are recomputed, the items are drawn again and compared, the seed
// commitments are opened and the seeds put back where the randomness says. What it cannot do offline
// without a pairing library: verify the round's BLS signature against drand's public key. So the
// randomness is DECLARED, consistency-checked, and the gate says so; no dependency enters the verdict
// path for it. Who signed the review commit is not read here either: git signatures belong to
// `runward sample`, which may read git. In stage 1 the signing key is within agent reach, so every
// surface prints « sample: declared human, not proved » and nothing here unlocks class I.
//
// Missed periods without a clock. Periods are fixed by the charter: `effective:` plus multiples of
// `sample-period-days:`. A sample that counts covers [start, end); the chain is the end of the last
// one (or `effective:` when none). The gate's only "now" is the latest date the tree itself declares
// (a ratification entry's date, conformance.ts `latestDeclaredDay`): every period that ended on or
// before it and is not covered is missed. The same tree reads the same on any day, as #352 did for
// `expires:`; `runward doctor` and `runward sample` set the chain beside the clock.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { foldName } from "./identity.js";
import { isoDay, isDelegate, type Charter } from "./delegation.js";

/** Mission-relative, beside the charter. */
export const SAMPLE_FILE = "delegation-samples.jsonl";
/** ADR-0088 decision 6, at the character: printed while the signing key is within agent reach. */
export const SAMPLE_BANNER = "sample: declared human, not proved";
/** What the gate checks of the randomness, and what it does not. */
export const RANDOMNESS_DECLARED = "randomness: declared — the drand round is recomputed and its randomness checked against its signature; the signature is not verified against drand's public key";

/** drand's quicknet chain (unchained, BLS on G1, 3-second rounds): read at
 *  https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/info on
 *  2026-10-02. The public key is recorded for whoever verifies a signature with a BLS library. */
export const DRAND_QUICKNET = {
  chain: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  genesis: 1692803367,
  period: 3,
  publicKey: "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a",
  url: "https://api.drand.sh",
} as const;

export type Stratum = "merge" | "ratification" | "tag";
/** The order the stratified floor visits the strata in: one item from each non-empty stratum first. */
export const STRATA: readonly Stratum[] = ["merge", "ratification", "tag"];

/** One act of the population, as `runward sample` read it from git. */
export interface PopulationItem {
  stratum: Stratum; ref: string; date: string; actor: string; summary: string;
  /** A merge touching a file of the published package (decision 7). */
  shipped?: boolean;
  /** A ratification entry written in `mode: agent`. */
  agent?: boolean;
}
/** What the reviewer is shown: the same shape for a real act and a seed, so a seed does not stand out
 *  by its form. (It can by its content: a reviewer who looks it up in the population finds it absent.
 *  The control measures that each item was opened, not that a seed is undetectable.) */
export interface SampleItem { stratum: string; ref: string; date: string; actor: string; summary: string }
export interface Seed extends SampleItem { defect: string; nonce: string }

export const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

/** A UTC day number as YYYY-MM-DD. */
export function dayString(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** The drand round the draw of a period ending on `endDay` uses: the first quicknet round emitted at or
 *  after 00:00 UTC that day. Fixed by arithmetic, so it is announced the moment the period is. */
export function drandRound(endDay: number): number {
  const t = endDay * 86_400;
  return Math.max(1, Math.ceil((t - DRAND_QUICKNET.genesis) / DRAND_QUICKNET.period) + 1);
}

function isHex(s: unknown, bytes?: number): s is string {
  if (typeof s !== "string" || s.length === 0 || s.length % 2 !== 0) return false;
  if (bytes !== undefined && s.length !== bytes * 2) return false;
  for (const ch of s) if (!((ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f"))) return false;
  return true;
}

/** quicknet is unchained: a round's randomness is SHA-256 of its signature bytes. Null when the
 *  signature is not 48 bytes of lower-case hex (a compressed G1 point). */
export function drandRandomness(signature: string): string | null {
  return isHex(signature, 48) ? sha256(Buffer.from(signature, "hex")) : null;
}

/** ADR-0088 decision 6, "risk-weighted": a shipped-code merge and an agent ratification weigh most. */
export function riskWeight(i: PopulationItem): number {
  if (i.stratum === "tag") return 2;
  if (i.stratum === "merge") return i.shipped ? 3 : 1;
  return i.agent ? 3 : 1;
}

function canonical(i: PopulationItem): string {
  return JSON.stringify([i.stratum, i.ref, i.date, i.actor, i.summary, i.shipped === true, i.agent === true]);
}

/** The population's hash: order-free, so two readers listing git in different orders agree. */
export function populationHash(pop: readonly PopulationItem[]): string {
  return sha256(pop.map(canonical).sort().join("\n"));
}

export function project(i: SampleItem): SampleItem {
  return { stratum: i.stratum, ref: i.ref, date: i.date, actor: i.actor, summary: i.summary };
}

/** A number in [0, 1) from 48 bits of SHA-256: the same on every engine (IEEE doubles, exact). */
function uniform(randomness: string, salt: string, label: string, i: number): number {
  const h = sha256(`${randomness}:${salt}:${label}:${i}`);
  return parseInt(h.slice(0, 12), 16) / 2 ** 48;
}

/**
 * The draw, fixed by the population and the randomness: stratified (one item from each non-empty
 * stratum first, in STRATA order), then risk-weighted without replacement until `size` items.
 */
export function drawSample(pop: readonly PopulationItem[], randomness: string, size: number): SampleItem[] {
  const salt = populationHash(pop);
  const pool = [...pop].sort((a, b) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0));
  const out: PopulationItem[] = [];
  let k = 0;
  const take = (cands: PopulationItem[]): void => {
    const total = cands.reduce((s, c) => s + riskWeight(c), 0);
    let u = uniform(randomness, salt, "draw", k++) * total;
    let chosen = cands[cands.length - 1];
    for (const c of cands) { u -= riskWeight(c); if (u < 0) { chosen = c; break; } }
    pool.splice(pool.indexOf(chosen), 1);
    out.push(chosen);
  };
  for (const s of STRATA) {
    if (out.length >= size) break;
    const cands = pool.filter((p) => p.stratum === s);
    if (cands.length > 0) take(cands);
  }
  while (out.length < size && pool.length > 0) take(pool);
  return out.map(project);
}

/** The seeds put among the drawn items, each at a position the randomness fixes; `seedAt[j]` is
 *  where seed j landed (by insertion, so a seed equal to a drawn act is never ambiguous). */
export function placeSeeds(items: readonly SampleItem[], seeds: readonly SampleItem[], randomness: string): { full: SampleItem[]; seedAt: number[] } {
  const full = items.map(project);
  const tag: number[] = items.map(() => -1);
  seeds.forEach((s, j) => {
    const p = Math.floor(uniform(randomness, "", "seed", j) * (full.length + 1));
    full.splice(p, 0, project(s));
    tag.splice(p, 0, j);
  });
  return { full, seedAt: seeds.map((_, j) => tag.indexOf(j)) };
}

/** H(seed, nonce), what the `seed` record publishes before the draw. */
export function seedCommitment(s: Seed): string {
  return sha256(JSON.stringify([s.stratum, s.ref, s.date, s.actor, s.summary, s.defect, s.nonce]));
}

/** Decision 7: every merge of the population touching the published package, 100 %, and its digest. */
export function shippedDigest(pop: readonly PopulationItem[]): { merges: string[]; digest: string } {
  const merges = pop.filter((p) => p.stratum === "merge" && p.shipped === true).map((p) => p.ref).sort();
  return { merges, digest: sha256(merges.join("\n")) };
}

// ── reading the ledger ──────────────────────────────────────────────────────────────────────────

/** Where a period's sample stands. Values are only ever added (ADR-0030).
 *  - `superseded`       it ended on or before the charter's `effective:`: a renewal starts a new chain.
 *  - `planted`          the seed is committed, nothing drawn yet.
 *  - `awaiting-review`  drawn; the maintainer has not reviewed it.
 *  - `awaiting-reveal`  reviewed; the seeds are not revealed yet.
 *  - `malformed`        a record does not re-perform: a strict gap, and it does not count.
 *  - `control-missed`   a seed was accepted: the sample does not count (decision 6).
 *  - `rejected`         it counts, and an act was rejected: that delegate's class D is suspended.
 *  - `passed`           it counts, every act accepted, every seed caught. */
export type SampleStatus = "superseded" | "planted" | "awaiting-review" | "awaiting-reveal" | "malformed" | "control-missed" | "rejected" | "passed";

export interface SampleOutcome {
  period: string; start: string | null; end: string; status: SampleStatus;
  items: number; seeds: number; caught: number;
  rejected: Array<{ stratum: string; ref: string; actor: string }>;
  round: number | null; reviewer: string | null;
  problems: string[];
}

export interface SampleLedger {
  file: string;
  present: boolean;
  samples: SampleOutcome[];
  /** The end of the last sample that counts, else the charter's `effective:`; null when the charter
   *  declares no readable window or period. */
  coveredUntil: string | null;
  /** Each malformation, named: a strict gap (`sample-malformed`). */
  problems: string[];
}

const VERDICTS = new Set(["accepted", "rejected"]);

function str(x: unknown): x is string { return typeof x === "string"; }
function isItem(x: unknown): x is SampleItem {
  const o = x as Record<string, unknown> | null;
  return !!o && typeof o === "object" && str(o.stratum) && str(o.ref) && str(o.date) && str(o.actor) && str(o.summary);
}
function isPopItem(x: unknown): x is PopulationItem {
  const o = x as Record<string, unknown>;
  return isItem(x) && (STRATA as readonly string[]).includes(o.stratum as string)
    && (o.shipped === undefined || typeof o.shipped === "boolean") && (o.agent === undefined || typeof o.agent === "boolean");
}
const same = (a: SampleItem, b: SampleItem) => a.stratum === b.stratum && a.ref === b.ref && a.date === b.date && a.actor === b.actor && a.summary === b.summary;

/** Is `sub` a subsequence of `all`, and which positions of `all` are left over? */
function leftover(sub: readonly SampleItem[], all: readonly SampleItem[]): number[] | null {
  const rest: number[] = [];
  let j = 0;
  for (let i = 0; i < all.length; i++) {
    if (j < sub.length && same(sub[j], all[i])) j++;
    else rest.push(i);
  }
  return j === sub.length ? rest : null;
}

interface Group { period: string; seeds: Array<{ line: number; rec: Record<string, unknown> }>; draw?: { line: number; rec: Record<string, unknown> }; review?: { line: number; rec: Record<string, unknown> }; reveal?: { line: number; rec: Record<string, unknown> }; problems: string[] }

/** Read a ledger's text against the charter. Never throws: every defect is a named problem. */
export function parseSampleLedger(text: string, charter: Charter, file = `runward/${SAMPLE_FILE}`): SampleLedger {
  const problems: string[] = [];
  const groups = new Map<string, Group>();
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const n = idx + 1;
    if (raw.trim() === "") return;
    let rec: unknown;
    try { rec = JSON.parse(raw); } catch { problems.push(`line ${n} is not JSON`); return; }
    const r = rec as Record<string, unknown> | null;
    if (!r || typeof r !== "object" || Array.isArray(r) || !str(r.type) || !str(r.period)) { problems.push(`line ${n} is not a record with a "type" and a "period"`); return; }
    if (!["seed", "draw", "review", "reveal"].includes(r.type)) { problems.push(`line ${n}: unknown record type "${r.type}"`); return; }
    const g = groups.get(r.period) ?? { period: r.period, seeds: [], problems: [] };
    groups.set(r.period, g);
    const entry = { line: n, rec: r };
    if (r.type === "seed") {
      if (g.draw) g.problems.push(`a seed committed on line ${n}, after the draw: a seed is committed before the sample`);
      g.seeds.push(entry);
    } else if (r.type === "draw") {
      if (g.draw) g.problems.push(`a second draw on line ${n}`);
      else g.draw = entry;
    } else if (r.type === "review") {
      if (g.review) g.problems.push(`a second review on line ${n}`);
      else if (!g.draw) g.problems.push(`a review on line ${n} before any draw`);
      else g.review = entry;
    } else {
      if (g.reveal) g.problems.push(`a second reveal on line ${n}`);
      else if (!g.review) g.problems.push(`a reveal on line ${n} before the review: the seeds are revealed after the verdicts`);
      else g.reveal = entry;
    }
  });

  const E = isoDay(charter.effective);
  const P = charter.sample.periodDays;
  const samples: SampleOutcome[] = [];
  if (E === null || P === null) {
    // The charter's own malformation is already named; without a window there is no chain to read.
    return { file, present: true, samples, coveredUntil: null, problems };
  }
  let cursor = E;
  const ordered = [...groups.values()].sort((a, b) => (isoDay(a.period) ?? -Infinity) - (isoDay(b.period) ?? -Infinity));
  for (const g of ordered) {
    const out: SampleOutcome = { period: g.period, start: null, end: g.period, status: "planted", items: 0, seeds: g.seeds.length, caught: 0, rejected: [], round: null, reviewer: null, problems: [...g.problems] };
    samples.push(out);
    const bad = (p: string) => out.problems.push(p);
    const end = isoDay(g.period);
    if (end === null) { bad(`period "${g.period}" is not a date (YYYY-MM-DD, the period's end)`); out.status = "malformed"; continue; }
    if (end <= E) { out.status = "superseded"; continue; }
    if ((end - E) % P !== 0) bad(`period ${g.period} does not end on a period boundary of the charter (effective ${charter.effective}, every ${P} day(s))`);
    const round = drandRound(end);
    out.round = round;

    // Seeds: commitments, and the round they announce.
    const commitments: string[] = [];
    for (const s of g.seeds) {
      if (!isHex(s.rec.commitment, 32)) bad(`line ${s.line}: the seed commitment is not a SHA-256 in lower-case hex`);
      else commitments.push(s.rec.commitment);
      if (s.rec.round !== round) bad(`line ${s.line}: the seed announces round ${String(s.rec.round)}; a period ending ${g.period} draws on round ${round}`);
    }
    if (g.seeds.length === 0 && g.draw) bad(`no seed was committed before the draw (sample-seeds: ${charter.sample.seeds ?? "?"})`);
    if (!g.draw) { out.status = out.problems.length ? "malformed" : "planted"; continue; }

    // Draw: re-performed.
    const d = g.draw.rec;
    const at = `line ${g.draw.line}`;
    const start = isoDay(str(d.start) ? d.start : null);
    out.start = str(d.start) ? d.start : null;
    if (d.end !== g.period) bad(`${at}: the draw's end "${String(d.end)}" is not its period "${g.period}"`);
    if (start === null) bad(`${at}: the draw has no start date`);
    else {
      if (start >= end) bad(`${at}: the draw starts on ${d.start}, not before its end ${g.period}`);
      if (start < E || (start - E) % P !== 0) bad(`${at}: the draw starts on ${d.start}, not on a period boundary of the charter`);
      if (start > cursor) bad(`${at}: the draw starts on ${d.start}, after ${dayString(cursor)}, the end of the last sample that counts: the acts in between were never in a population`);
    }
    const size = d.size, nSeeds = d.seeds;
    if (typeof size !== "number" || !Number.isInteger(size) || size < 1) bad(`${at}: "size" is not a whole number`);
    else if (charter.sample.size !== null && size < charter.sample.size) bad(`${at}: ${size} act(s) drawn, the charter asks ${charter.sample.size}`);
    if (typeof nSeeds !== "number" || !Number.isInteger(nSeeds) || nSeeds < 1) bad(`${at}: "seeds" is not a whole number`);
    else {
      if (charter.sample.seeds !== null && nSeeds < charter.sample.seeds) bad(`${at}: ${nSeeds} seed(s), the charter asks ${charter.sample.seeds}`);
      if (nSeeds !== g.seeds.length) bad(`${at}: the draw counts ${nSeeds} seed(s), ${g.seeds.length} were committed`);
    }
    const dr = (d.drand ?? {}) as Record<string, unknown>;
    if (dr.chain !== DRAND_QUICKNET.chain) bad(`${at}: the drand chain is not quicknet (${DRAND_QUICKNET.chain})`);
    if (dr.round !== round) bad(`${at}: drand round ${String(dr.round)}; a period ending ${g.period} draws on round ${round}, announced by arithmetic`);
    const randomness = str(dr.signature) ? drandRandomness(dr.signature) : null;
    if (randomness === null) bad(`${at}: the drand signature is not 48 bytes of lower-case hex`);
    else if (dr.randomness !== randomness) bad(`${at}: the drand randomness is not SHA-256 of the round's signature`);
    const popOk = Array.isArray(d.population) && d.population.every(isPopItem);
    if (!popOk) bad(`${at}: the population is not a list of acts`);
    const pop = popOk ? (d.population as PopulationItem[]) : [];
    if (popOk) {
      if (d.populationHash !== populationHash(pop)) bad(`${at}: the population hash does not match the population`);
      const counts = (d.counts ?? {}) as Record<string, unknown>;
      for (const s of STRATA) {
        const n = pop.filter((p) => p.stratum === s).length;
        if (counts[s] !== n) bad(`${at}: counts.${s} is ${String(counts[s])}, the population holds ${n}`);
      }
      if (counts.total !== pop.length) bad(`${at}: counts.total is ${String(counts.total)}, the population holds ${pop.length}`);
      if (counts.gitMerges !== counts.merge) bad(`${at}: the merges listed (${String(counts.merge)}) and the merges git counted (${String(counts.gitMerges)}) do not reconcile`);
      for (const p of pop) {
        const day = isoDay(p.date);
        if (day === null || (start !== null && day < start) || day >= end) { bad(`${at}: the act ${p.ref} is dated ${p.date}, outside ${String(d.start)} to ${g.period}`); break; }
      }
      const sh = shippedDigest(pop);
      const recorded = (d.shipped ?? {}) as Record<string, unknown>;
      if (recorded.digest !== sh.digest || !Array.isArray(recorded.merges) || recorded.merges.join("\n") !== sh.merges.join("\n")) bad(`${at}: the shipped-code digest does not match the population's shipped merges`);
    }
    const items = Array.isArray(d.items) && d.items.every(isItem) ? (d.items as SampleItem[]) : null;
    if (!items) bad(`${at}: "items" is not a list of drawn acts`);
    out.items = items?.length ?? 0;
    const expected = popOk && randomness !== null && typeof size === "number" ? drawSample(pop, randomness, size) : null;
    if (items && expected) {
      const rest = leftover(expected, items);
      if (rest === null || rest.length !== g.seeds.length) bad(`${at}: the items do not re-perform: the draw from this population and this randomness gives other acts`);
    }
    if (!g.review) { out.status = out.problems.length ? "malformed" : "awaiting-review"; continue; }

    // Review: one verdict per item, the digest acknowledged.
    const r = g.review.rec;
    out.reviewer = str(r.reviewer) && foldName(r.reviewer) !== "" ? r.reviewer : null;
    if (out.reviewer === null) bad(`line ${g.review.line}: the review names no reviewer`);
    const verdicts = Array.isArray(r.verdicts) && r.verdicts.every((v) => str(v) && VERDICTS.has(v)) ? (r.verdicts as string[]) : null;
    if (!verdicts || verdicts.length !== out.items) bad(`line ${g.review.line}: ${out.items} item(s) drawn, the review must give each one "accepted" or "rejected"`);
    if (r.shippedDigest !== (d.shipped as Record<string, unknown> | undefined)?.digest) bad(`line ${g.review.line}: the review acknowledges another shipped-code digest than the draw's`);
    if (!g.reveal) { out.status = out.problems.length ? "malformed" : "awaiting-reveal"; continue; }

    // Reveal: the commitments open, the seeds sit where the randomness put them.
    const v = g.reveal.rec;
    const seeds = Array.isArray(v.seeds) && v.seeds.every((s) => isItem(s) && str((s as Seed).defect) && str((s as Seed).nonce)) ? (v.seeds as Seed[]) : null;
    if (!seeds || seeds.length !== commitments.length) bad(`line ${g.reveal.line}: ${commitments.length} seed(s) committed, the reveal opens ${seeds?.length ?? 0}`);
    else seeds.forEach((s, j) => { if (seedCommitment(s) !== commitments[j]) bad(`line ${g.reveal!.line}: seed ${j + 1} does not open its commitment (line ${g.seeds[j].line})`); });
    let seedAt: number[] = [];
    if (seeds && items && expected && randomness !== null) {
      const placed = placeSeeds(expected, seeds, randomness);
      if (placed.full.length !== items.length || placed.full.some((x, i) => !same(x, items[i]))) bad(`line ${g.reveal.line}: the revealed seeds do not sit where the randomness puts them among the drawn items`);
      seedAt = placed.seedAt;
    }
    if (out.problems.length) { out.status = "malformed"; continue; }
    const seedSet = new Set(seedAt);
    out.caught = seedAt.filter((i) => verdicts![i] === "rejected").length;
    out.rejected = items!.flatMap((it, i) => (!seedSet.has(i) && verdicts![i] === "rejected" ? [{ stratum: it.stratum, ref: it.ref, actor: it.actor }] : []));
    out.status = out.caught < seedAt.length ? "control-missed" : out.rejected.length > 0 ? "rejected" : "passed";
    if ((out.status === "passed" || out.status === "rejected") && start !== null) cursor = Math.max(cursor, end);
  }
  for (const s of samples) for (const p of s.problems) problems.push(`period ending ${s.period}: ${p}`);
  return { file, present: true, samples, coveredUntil: dayString(cursor), problems };
}

/** The mission's ledger, read against its charter; `present: false` when the file is absent. */
export function readSampleLedger(missionDir: string, charter: Charter): SampleLedger {
  const path = join(missionDir, SAMPLE_FILE);
  if (!existsSync(path)) {
    const E = isoDay(charter.effective);
    return { file: `runward/${SAMPLE_FILE}`, present: false, samples: [], coveredUntil: E === null || charter.sample.periodDays === null ? null : dayString(E), problems: [] };
  }
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { text = ""; }
  return parseSampleLedger(text, charter);
}

// ── the state the gate acts on ──────────────────────────────────────────────────────────────────

export interface SampleState {
  ledger: SampleLedger;
  /** The latest date the tree declares (its only "now"), or null when it declares none. */
  latest: string | null;
  /** Closed periods since `coveredUntil` with no sample that counts, read against `latest`. */
  missed: number;
  /** « unsampled since <date> », when at least one period is missed. */
  unsampledSince: string | null;
  /** Two missed periods or more: agent acts dated on or after this day stop counting. */
  unsampledFrom: number | null;
  /** [start, end) of every sample that passed: what covers a single-accountable row. */
  passing: Array<[number, number]>;
  /** A rejected act suspends class D for its actor, when the actor is a delegate, from the sample's end. */
  suspended: Array<{ delegate: string; from: number; period: string; ref: string }>;
}

export function sampleState(ledger: SampleLedger, charter: Charter, latestDay: number | null): SampleState {
  const cursor = isoDay(ledger.coveredUntil);
  const P = charter.sample.periodDays;
  const missed = cursor !== null && P !== null && latestDay !== null && latestDay >= cursor ? Math.floor((latestDay - cursor) / P) : 0;
  const passing: Array<[number, number]> = [];
  const suspended: SampleState["suspended"] = [];
  for (const s of ledger.samples) {
    const a = isoDay(s.start), b = isoDay(s.end);
    if (a === null || b === null) continue;
    if (s.status === "passed") passing.push([a, b]);
    if (s.status === "rejected" || s.status === "control-missed") {
      for (const r of s.rejected) if (isDelegate(charter, r.actor)) suspended.push({ delegate: r.actor, from: b, period: s.period, ref: r.ref });
    }
  }
  return {
    ledger, latest: latestDay === null ? null : dayString(latestDay), missed,
    unsampledSince: missed >= 1 && ledger.coveredUntil !== null ? ledger.coveredUntil : null,
    unsampledFrom: missed >= 2 ? cursor : null,
    passing, suspended,
  };
}

/** Is `day` inside a period a passing sample covers? (ADR-0088 decision 4's condition.) */
export function passingCovers(state: SampleState, day: number | null): boolean {
  return day !== null && state.passing.some(([a, b]) => a <= day && day < b);
}

/** The line every surface prints when a period is missed (decision 7), at the character. */
export function unsampledLine(since: string): string {
  return `unsampled since ${since}`;
}
