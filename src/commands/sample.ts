// `runward sample`: the weekly signed sample of ADR-0088 decision 6, the side that reads git.
//
// The gate (`check`) reads runward/delegation-samples.jsonl from the tree alone (delegation-sample.ts)
// and re-performs it offline. Everything that needs git or the clock is here, outside the verdict
// path, and is allowed to spawn `git` read-only (ADR-0054; eslint.security.config.js SPAWN_ALLOWED,
// the same allowance doctor.ts and characterize.ts have):
//   plant    the planter (an agent or the operator layer, never the reviewer) commits a seed as
//            H(seed, nonce) before the sample; the seed and its nonce wait in the git directory,
//            outside the tree, until the reveal;
//   draw     after the period closed: the population from git (first-parent merges on the branch, tags,
//            ratification entries at the branch's tip) since the last sample that counts, its counts
//            reconciled, its hash, the drand round's signature (given by whoever fetched it: runward
//            opens no socket), the draw, the shipped-code digest; then it prints what to review;
//   review   the maintainer's verdict on every item, the one act to sign: it prints the commit command;
//   reveal   the planter opens the commitments after the review, and the control is settled;
//   status   (default) where the period stands, what comes next and who does it, and what git says:
//            the review commit's signature (`%G?` against the repository's `gpg.ssh.allowedSignersFile`)
//            and the order of the commits (seed before draw, review before reveal).
// It never decides for the maintainer: it writes the record the maintainer chose and says what it is
// worth. In stage 1 the signing key is within agent reach: « sample: declared human, not proved ».
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
import { readCharter, isoDay, CHARTER_FILE } from "../lib/delegation.js";
import { GATED_DELIVERABLES, readRatification, isAgentMode, latestDeclaredDay } from "../lib/conformance.js";
import { agentRuntimeSignal } from "../lib/harness.js";
import {
  sampleState, parseSampleLedger, drawSample, placeSeeds, seedCommitment, shippedDigest, populationHash,
  drandRound, drandRandomness, dayString, SAMPLE_FILE, SAMPLE_BANNER, RANDOMNESS_DECLARED, DRAND_QUICKNET, STRATA,
  type PopulationItem, type Seed, type Stratum, type SampleLedger,
} from "../lib/delegation-sample.js";
import type { Charter } from "../lib/delegation.js";

export interface SampleOptions {
  path?: string; branch?: string;
  ref?: string; summary?: string; defect?: string; stratum?: string; actor?: string; date?: string;
  signature?: string; reviewer?: string;
}

const ACTIONS = ["status", "plant", "draw", "review", "reveal"];

function stop(msg: string, code = 2): never {
  console.error(`\n  ${c.error("✗")} ${msg}\n`);
  process.exit(code);
}

function git(top: string, args: string[]): string {
  return execFileSync("git", ["-c", "core.quotepath=false", "-C", top, ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
}
function gitOr(top: string, args: string[]): string | null {
  try { return git(top, args); } catch { return null; }
}
const posix = (p: string) => p.split(sep).join("/");
const utcDay = (epochSeconds: number) => Math.floor(epochSeconds / 86_400);

/** The first period boundary of the charter strictly after `day`. */
function nextBoundary(E: number, P: number, day: number): number {
  return day < E ? E + P : E + P * (Math.floor((day - E) / P) + 1);
}

/** Where the planter's secrets wait until the reveal: the git directory, never the tree. */
function secretsFile(top: string, period: string): string {
  const common = (gitOr(top, ["rev-parse", "--git-common-dir"]) ?? "").trim();
  if (!common) stop("the sample's seed is kept in the git directory until the reveal, and this is not a git repository");
  const dir = isAbsolute(common) ? common : resolve(top, common);
  return join(dir, "runward", "sample-seeds", `${period}.json`);
}
function readSecrets(file: string): Seed[] {
  try { const j = JSON.parse(readFileSync(file, "utf8")); return Array.isArray(j) ? j as Seed[] : []; } catch { return []; }
}

/** The paths of the published package (decision 7): `package.json` `files`, the manifest itself,
 *  `templates/` and `plugins/` (named by the ADR), and `src/` when `dist` ships, since dist is built
 *  from it and is not committed. A glob keeps the part before its first `*`. */
function shippedPrefixes(root: string, relRoot: string): string[] {
  let files: string[] = [];
  try {
    const j = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (Array.isArray(j.files)) files = j.files.filter((f: unknown): f is string => typeof f === "string");
  } catch { /* no manifest: only the named directories */ }
  const out = new Set<string>(["package.json", "templates", "plugins"]);
  for (const f of files) {
    const star = f.indexOf("*");
    const base = (star === -1 ? f : f.slice(0, star)).replace(/^\.\//, "").replace(/\/+$/, "");
    if (base) out.add(base);
    if (base === "dist") out.add("src");
  }
  return [...out].map((p) => (relRoot ? `${relRoot}/${p}` : p));
}

/** The population of [start, end) from git, and the independent merge count it reconciles with. */
function buildPopulation(top: string, root: string, branch: string, start: number, end: number): { pop: PopulationItem[]; gitMerges: number } {
  if (gitOr(top, ["rev-parse", "--verify", "--quiet", `${branch}^{commit}`]) === null) stop(`no branch "${branch}" in this repository (--branch names the one the population is read from)`);
  // Both sides resolved first: on Windows a temp path can arrive in its 8.3 short form
  // (RUNNER~1) while git prints the long one, and relative() then walks out of the repository.
  const real = (p: string) => { try { return realpathSync.native(p); } catch { return resolve(p); } };
  const rel = posix(relative(real(top), real(root)));
  const relRoot = rel.startsWith("..") ? "" : rel;
  const prefixes = shippedPrefixes(root, relRoot);
  const inRange = (day: number) => day >= start && day < end;
  const pop: PopulationItem[] = [];

  for (const line of git(top, ["log", "--first-parent", "--merges", "--format=%H%x1f%ct%x1f%an%x1f%s", branch]).split("\n")) {
    if (!line) continue;
    const [sha, ct, an, subject] = line.split("\x1f");
    const day = utcDay(Number(ct));
    if (!inRange(day)) continue;
    const touched = git(top, ["diff", "--name-only", `${sha}^1`, sha]).split("\n").filter(Boolean);
    const shipped = touched.some((p) => prefixes.some((x) => p === x || p.startsWith(`${x}/`)));
    pop.push({ stratum: "merge", ref: sha, date: dayString(day), actor: an, summary: subject ?? "", ...(shipped ? { shipped: true } : {}) });
  }
  // The reconciliation: the same merges counted by another plumbing path (parents per commit).
  let gitMerges = 0;
  for (const line of git(top, ["rev-list", "--first-parent", "--parents", "--timestamp", branch]).split("\n")) {
    const parts = line.trim().split(" ");
    if (parts.length >= 4 && inRange(utcDay(Number(parts[0])))) gitMerges++;
  }
  for (const line of git(top, ["for-each-ref", "--format=%(refname:short)%1f%(creatordate:unix)%1f%(taggername)%(authorname)%1f%(objectname:short) %(subject)", "refs/tags"]).split("\n")) {
    if (!line) continue;
    const [name, ts, who, subject] = line.split("\x1f");
    const day = utcDay(Number(ts));
    if (!inRange(day)) continue;
    pop.push({ stratum: "tag", ref: `tag:${name}`, date: dayString(day), actor: who || "(unknown)", summary: subject ?? "" });
  }
  const relMission = posix(relative(top, join(root, "runward")));
  for (const g of GATED_DELIVERABLES) {
    const text = gitOr(top, ["show", `${branch}:${relMission}/${g.deliverable}`]);
    if (text === null) continue;
    for (const e of readRatification(text)) {
      const day = isoDay(e.date);
      if (day === null || !inRange(day)) continue;
      pop.push({ stratum: "ratification", ref: `${g.deliverable}@${e.date}:${e.rows.join(",")}`, date: e.date, actor: e.by ?? "(undeclared)",
        summary: `mode: ${e.mode}`, ...(isAgentMode(e.mode) ? { agent: true } : {}) });
    }
  }
  return { pop, gitMerges };
}

function readLedgerText(mission: string): string {
  const p = join(mission, SAMPLE_FILE);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}
function append(mission: string, rec: Record<string, unknown>): void {
  const p = join(mission, SAMPLE_FILE);
  const text = existsSync(p) ? readFileSync(p, "utf8") : "";
  appendFileSync(p, `${text !== "" && !text.endsWith("\n") ? "\n" : ""}${JSON.stringify(rec)}\n`);
}
/** Records of the ledger, by period, in file order (the pure reader validates them; this only finds them). */
function records(text: string): Array<Record<string, unknown>> {
  return text.split(/\r?\n/).flatMap((l) => { try { const r = JSON.parse(l); return r && typeof r === "object" ? [r] : []; } catch { return []; } });
}

const commitHint = (what: string, sign: boolean) =>
  `git add runward/${SAMPLE_FILE} && git commit${sign ? " -S" : ""} -m "${what}"`;

export async function sampleCommand(action: string | undefined, verdicts: string[], opts: SampleOptions): Promise<void> {
  const act = action ?? "status";
  if (!ACTIONS.includes(act)) stop(`unknown action "${act}": one of ${ACTIONS.join(", ")}`);
  const root = findMissionRoot(opts.path ? resolve(opts.path) : process.cwd());
  if (!root) stop("No runward/ mission found here or above.");
  const mission = join(root, "runward");
  const charter = readCharter(mission);
  if (!charter) stop(`no delegation charter (runward/${CHARTER_FILE}): the sample is drawn under one, and writing it is the maintainer's act (class R, https://github.com/stranxik/runward/blob/main/docs/delegation-charter.md)`);
  const E = isoDay(charter.effective), P = charter.sample.periodDays, size = charter.sample.size, nSeeds = charter.sample.seeds;
  if (E === null || P === null || size === null || nSeeds === null) stop(`runward/${CHARTER_FILE} declares no readable effective:, sample-period-days:, sample-size: or sample-seeds: — \`runward check --strict\` names what is wrong`);
  const top = (gitOr(root, ["rev-parse", "--show-toplevel"]) ?? "").trim();
  if (!top) stop("the sample's population is read from git, and this is not a git repository");
  const branch = opts.branch ?? "main";
  // Passed to git as an argument, never through a shell; a leading dash would read as an option.
  if (branch === "" || branch.startsWith("-")) stop(`--branch: "${branch}" is not a branch name`);
  const today = isoDay(generationDate())!;
  const text = readLedgerText(mission);
  const ledger = parseSampleLedger(text, charter);

  console.log(createHeader(`runward sample — ${act}`));
  console.log(`  ${c.warning("◑")} ${c.white(SAMPLE_BANNER)}`);

  if (act === "plant") return plant(mission, top, charter, ledger, E, P, today, opts);
  if (act === "draw") return draw(mission, top, root, charter, ledger, branch, today, opts);
  if (act === "review") return review(mission, charter, ledger, verdicts, opts);
  if (act === "reveal") return reveal(mission, top, charter, ledger);
  return statusView(mission, top, charter, ledger, text, today);
}

function plant(mission: string, top: string, charter: Charter, ledger: SampleLedger, E: number, P: number, today: number, opts: SampleOptions): void {
  if (!opts.ref || !opts.summary || !opts.defect) stop("plant needs --ref, --summary and --defect: the planted item as the reviewer will see it, and the defect a careful review finds");
  const stratum = (opts.stratum ?? "merge") as Stratum;
  if (!(STRATA as readonly string[]).includes(stratum)) stop(`--stratum: one of ${STRATA.join(", ")}`);
  const end = nextBoundary(E, P, today);
  const period = dayString(end);
  if (ledger.samples.some((s) => s.period === period && s.status !== "planted")) stop(`the period ending ${period} is already drawn: a seed is committed before the sample`);
  const planted = ledger.samples.find((s) => s.period === period)?.seeds ?? 0;
  if (planted >= charter.sample.seeds!) stop(`the period ending ${period} already has its ${planted} seed(s) (sample-seeds: ${charter.sample.seeds})`);
  const seed: Seed = { stratum, ref: opts.ref, date: opts.date ?? dayString(today), actor: opts.actor ?? charter.delegates[0] ?? "(undeclared)", summary: opts.summary, defect: opts.defect, nonce: randomBytes(32).toString("hex") };
  const file = secretsFile(top, period);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify([...readSecrets(file), seed], null, 2) + "\n");
  append(mission, { type: "seed", period, round: drandRound(end), commitment: seedCommitment(seed) });
  console.log(section("Seed committed"));
  console.log("  " + status.success(`seed ${planted + 1}/${charter.sample.seeds} for the period ending ${period}: H(seed, nonce) appended to runward/${SAMPLE_FILE}; the seed waits in ${file}, outside the tree, until the reveal`));
  console.log("  " + status.info(`drand round ${drandRound(end)} (quicknet) will draw this period: announced now, emitted after ${period} 00:00 UTC`));
  console.log(section("Next"));
  console.log(`  Commit the commitment now, before the period closes (it must precede the draw in history):\n    ${c.white(commitHint(`sample: seed for the period ending ${period}`, false))}`);
}

function draw(mission: string, top: string, root: string, charter: Charter, ledger: SampleLedger, branch: string, today: number, opts: SampleOptions): void {
  const target = ledger.samples.find((s) => s.status === "planted");
  if (!target) stop("no planted period waits for its draw: `runward sample plant` comes first (by the planter, never the reviewer)");
  const end = isoDay(target.end)!;
  if (today < end) stop(`the period ending ${target.end} has not closed (today is ${dayString(today)} by this run's clock)`);
  if (target.seeds < charter.sample.seeds!) stop(`the period ending ${target.end} has ${target.seeds} seed(s); the charter asks ${charter.sample.seeds}`);
  const round = drandRound(end);
  const fetchHint = `curl -s ${DRAND_QUICKNET.url}/${DRAND_QUICKNET.chain}/public/${round}`;
  if (!opts.signature) stop(`draw needs the signature of drand round ${round}, which runward never downloads itself (no socket in runward). Fetch it and pass it:\n      ${fetchHint}\n      runward sample draw --signature <the "signature" field>`);
  const randomness = drandRandomness(opts.signature.trim().toLowerCase());
  if (randomness === null) stop("--signature: 96 hex characters, the round's \"signature\" field as drand publishes it");
  const seeds = readSecrets(secretsFile(top, target.end));
  const commitments = records(readLedgerText(mission)).filter((r) => r.type === "seed" && r.period === target.end).map((r) => r.commitment);
  if (seeds.length !== commitments.length || seeds.some((s, j) => seedCommitment(s) !== commitments[j])) stop(`the seeds waiting in the git directory do not open the ${commitments.length} commitment(s) of the period ending ${target.end}: the draw is run where the seed was planted`);
  const startDay = isoDay(ledger.coveredUntil)!;
  const { pop, gitMerges } = buildPopulation(top, root, branch, startDay, end);
  const counts: Record<string, number> = { total: pop.length, gitMerges };
  for (const s of STRATA) counts[s] = pop.filter((p) => p.stratum === s).length;
  const real = drawSample(pop, randomness, charter.sample.size!);
  const { full } = placeSeeds(real, seeds, randomness);
  const shipped = shippedDigest(pop);
  append(mission, {
    type: "draw", period: target.end, start: ledger.coveredUntil, end: target.end, branch,
    size: charter.sample.size, seeds: seeds.length,
    drand: { chain: DRAND_QUICKNET.chain, round, randomness, signature: opts.signature.trim().toLowerCase() },
    counts, populationHash: populationHash(pop), population: pop, items: full, shipped,
  });
  const reread = parseSampleLedger(readLedgerText(mission), charter).samples.find((s) => s.period === target.end);
  if (reread?.status !== "awaiting-review") stop(`the draw was written and does not re-perform: ${(reread?.problems ?? []).join("; ")}`, 1);
  console.log(section(`Drawn: ${ledger.coveredUntil} to ${target.end} (end excluded), branch ${branch}`));
  console.log("  " + status.success(`population ${pop.length} act(s): ${STRATA.map((s) => `${counts[s]} ${s}`).join(", ")}; merges reconciled ${counts.merge}/${gitMerges}; hash ${populationHash(pop).slice(0, 16)}…`));
  console.log("  " + status.info(RANDOMNESS_DECLARED));
  printReview(full, shipped, target.end);
  console.log(section("Next"));
  console.log(`  Commit the draw (any delegate may):\n    ${c.white(commitHint(`sample: draw for the period ending ${target.end}`, false))}\n  Then the maintainer reviews the items above and runs the one command printed there.`);
}

function printReview(items: Array<{ stratum: string; ref: string; date: string; actor: string; summary: string }>, shipped: { merges: string[]; digest: string }, period: string): void {
  console.log(section("To review (the maintainer)"));
  items.forEach((it, i) => console.log(`  ${c.white(`${i + 1}.`)} ${it.stratum} ${c.white(it.ref)} · ${it.date} · ${it.actor}\n     ${c.darkGray(it.summary)}`));
  console.log(section("Shipped-code merges, 100 % (decision 7)"));
  if (shipped.merges.length === 0) console.log(`  ${c.darkGray("none in this period")}`);
  for (const m of shipped.merges) console.log(`  ${c.white(m)}  ${c.darkGray(`git show --stat ${m.slice(0, 12)}`)}`);
  console.log(`  ${c.darkGray(`digest ${shipped.digest}`)}`);
  console.log(section("The one command"));
  console.log(`  Open each item, mark the ones you reject, and run (from the repository, not from an agent session):\n    ${c.white(`runward sample review ${items.map((_, i) => `${i + 1}=accept`).join(" ")} && ${commitHint(`sample: review of the period ending ${period}`, true)}`)}`);
}

function review(mission: string, charter: Charter, ledger: SampleLedger, verdicts: string[], opts: SampleOptions): void {
  const target = ledger.samples.find((s) => s.status === "awaiting-review");
  if (!target) stop("no drawn period waits for its review");
  // The honest-mistake stop, like `wire --install`: an agent session does not record the maintainer's
  // review. It is environment detection, not proof (stage 1).
  const signal = agentRuntimeSignal(process.env);
  if (signal) stop(`the review is the maintainer's act, and this process runs inside an agent session (${signal}): run it from your own terminal`);
  const drawRec = records(readLedgerText(mission)).find((r) => r.type === "draw" && r.period === target.period)!;
  const items = drawRec.items as unknown[];
  const out: string[] = new Array(items.length).fill("");
  for (const v of verdicts) {
    const at = v.indexOf("=");
    const n = Number(v.slice(0, at));
    const word = v.slice(at + 1).toLowerCase();
    if (at < 1 || !Number.isInteger(n) || n < 1 || n > items.length) stop(`"${v}": write <item number>=accept or <item number>=reject, 1 to ${items.length}`);
    if (word !== "accept" && word !== "reject") stop(`"${v}": accept or reject`);
    if (out[n - 1] !== "") stop(`item ${n} is given twice`);
    out[n - 1] = word === "accept" ? "accepted" : "rejected";
  }
  const missing = out.flatMap((x, i) => (x === "" ? [i + 1] : []));
  if (missing.length) {
    printReview(items as never, drawRec.shipped as never, target.period);
    stop(`every item needs a verdict; missing: ${missing.join(", ")}`);
  }
  const reviewer = opts.reviewer ?? charter.accountable ?? "";
  append(mission, { type: "review", period: target.period, reviewer, verdicts: out, shippedDigest: (drawRec.shipped as { digest: string }).digest });
  console.log(section("Review recorded"));
  console.log("  " + status.success(`${out.filter((x) => x === "accepted").length} accepted, ${out.filter((x) => x === "rejected").length} rejected, shipped-code digest acknowledged, reviewer ${reviewer} (declared)`));
  console.log(section("Next"));
  console.log(`  Sign the review — the act the gate reads as the maintainer's (declared in stage 1):\n    ${c.white(commitHint(`sample: review of the period ending ${target.period}`, true))}\n  Then the planter reveals the seeds: runward sample reveal`);
}

function reveal(mission: string, top: string, charter: Charter, ledger: SampleLedger): void {
  const target = ledger.samples.find((s) => s.status === "awaiting-reveal");
  if (!target) stop("no reviewed period waits for its reveal");
  const seeds = readSecrets(secretsFile(top, target.period));
  if (seeds.length === 0) stop(`the seeds of the period ending ${target.period} are not in this repository's git directory: the reveal is run where they were planted`);
  append(mission, { type: "reveal", period: target.period, seeds });
  const after = parseSampleLedger(readLedgerText(mission), charter).samples.find((s) => s.period === target.period)!;
  console.log(section("Seeds revealed"));
  if (after.status === "malformed") console.log("  " + status.error(`the period does not re-perform: ${after.problems.join("; ")}`));
  else if (after.status === "control-missed") console.log("  " + status.warning(`control missed: ${after.caught}/${after.seeds} seed(s) rejected — the sample does not count (ADR-0088 decision 6)`));
  else console.log("  " + status.success(`control caught: ${after.caught}/${after.seeds} seed(s) rejected; ${after.rejected.length} real act(s) rejected${after.rejected.length ? ` (${after.rejected.map((r) => `${r.ref} by ${r.actor}`).join("; ")}: class D suspended for a delegate among them)` : ""}; status ${after.status}`));
  console.log(section("Next"));
  console.log(`  ${c.white(commitHint(`sample: reveal for the period ending ${target.period}`, false))}`);
}

/** The commit that last wrote line `n` of the ledger, or null when it is not committed. */
function lineCommit(top: string, file: string, n: number): string | null {
  const out = gitOr(top, ["blame", "--porcelain", "-L", `${n},${n}`, "--", file]);
  const sha = out?.match(/^([0-9a-f]{40}) /)?.[1] ?? null;
  return sha && !/^0+$/.test(sha) ? sha : null;
}
const strictlyBefore = (top: string, a: string, b: string) => a !== b && gitOr(top, ["merge-base", "--is-ancestor", a, b]) !== null;

function statusView(mission: string, top: string, charter: Charter, ledger: SampleLedger, text: string, today: number): void {
  const E = isoDay(charter.effective)!, P = charter.sample.periodDays!;
  const byClock = sampleState(ledger, charter, today);
  const byTree = sampleState(ledger, charter, latestDeclaredDay(mission));
  console.log(section("Where the chain stands"));
  console.log("  " + status.info(`covered until ${ledger.coveredUntil} (the end of the last sample that counts, else the charter's effective date); the open period ends ${dayString(nextBoundary(E, P, today))}`));
  if (byClock.unsampledSince) console.log("  " + status.warning(`unsampled since ${byClock.unsampledSince}: ${byClock.missed} period(s) ended by this run's clock (${dayString(today)}) with no sample that counts`));
  if (byTree.unsampledSince) console.log("  " + status.warning(`the gate reads ${byTree.missed} missed period(s) against ${byTree.latest}, the latest date the tree declares${byTree.missed >= 2 ? ": agent ratifications since then are strict gaps" : ""}`));
  for (const s of ledger.samples.filter((x) => x.status !== "superseded")) {
    const line = `period ending ${s.period}: ${s.status}${s.items ? ` · ${s.items} item(s), ${s.caught}/${s.seeds} seed(s) caught, ${s.rejected.length} rejected` : ""}`;
    console.log("  " + (s.status === "passed" ? status.success(line) : s.status === "malformed" || s.status === "control-missed" ? status.error(`${line}${s.problems.length ? ` — ${s.problems[0]}` : ""}`) : status.info(line)));
  }

  // What git says, which the gate cannot read: signatures and the order of the commits.
  const rel = posix(relative(top, join(mission, SAMPLE_FILE)));
  const lines = text.split(/\r?\n/);
  const at: Record<string, Record<string, number[]>> = {};
  lines.forEach((l, i) => { try { const r = JSON.parse(l); if (r && typeof r.type === "string" && typeof r.period === "string") ((at[r.period] ??= {})[r.type] ??= []).push(i + 1); } catch { /* the gate names it */ } });
  const checked = Object.entries(at).filter(([, t]) => t.review);
  if (checked.length) console.log(section("What git says (declared in stage 1: the signing key is within agent reach)"));
  for (const [period, t] of checked) {
    const reviewCommit = lineCommit(top, rel, t.review[0]);
    if (!reviewCommit) { console.log("  " + status.warning(`period ending ${period}: the review is not committed yet`)); continue; }
    const [g, signer] = (gitOr(top, ["log", "-1", "--format=%G?%x1f%GS", reviewCommit]) ?? "N").trim().split("\x1f");
    const word = g === "G" ? `signed, good signature by ${signer} (allowedSigners)` : g === "U" ? `signed by ${signer || "a key"} of unknown validity` : g === "N" ? "NOT signed" : g === "E" ? "signed, not verifiable here (no gpg.ssh.allowedSignersFile, or the key is missing)" : `signature status ${g}`;
    console.log("  " + (g === "G" ? status.success : status.warning)(`period ending ${period}: review commit ${reviewCommit.slice(0, 12)} ${word}`));
    const seedCommits = (t.seed ?? []).map((n) => lineCommit(top, rel, n));
    const drawCommit = t.draw ? lineCommit(top, rel, t.draw[0]) : null;
    if (drawCommit && seedCommits.length) {
      const ok = seedCommits.every((s) => s !== null && strictlyBefore(top, s, drawCommit));
      console.log("  " + (ok ? status.success : status.warning)(`period ending ${period}: ${ok ? "every seed was committed before the draw" : "a seed was not committed strictly before the draw: the commitment did not precede the sample"}`));
    }
    const revealCommit = t.reveal ? lineCommit(top, rel, t.reveal[0]) : null;
    if (revealCommit) {
      const ok = strictlyBefore(top, reviewCommit, revealCommit);
      console.log("  " + (ok ? status.success : status.warning)(`period ending ${period}: ${ok ? "the seeds were revealed after the review commit" : "the reveal is not strictly after the review commit"}`));
    }
  }

  console.log(section("Next"));
  const next = ledger.samples.find((s) => ["planted", "awaiting-review", "awaiting-reveal"].includes(s.status));
  if (!next) console.log(`  The planter plants this period's seed before it closes: runward sample plant --ref <ref> --summary <text> --defect <text>`);
  else if (next.status === "planted") console.log(`  After ${next.period} 00:00 UTC, whoever fetches drand round ${next.round}: ${DRAND_QUICKNET.url}/${DRAND_QUICKNET.chain}/public/${next.round}\n  then: runward sample draw --signature <its "signature" field>`);
  else if (next.status === "awaiting-review") {
    const d = records(text).find((r) => r.type === "draw" && r.period === next.period)!;
    printReview(d.items as never, d.shipped as never, next.period);
  } else console.log("  The planter reveals the seeds: runward sample reveal");
}
