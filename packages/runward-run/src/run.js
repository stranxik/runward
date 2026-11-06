// One run of runward-run (ADR-0120 decisions 2 to 4): the legs of the run policy, executed in a
// container pinned by digest with the network cut, on a copy of the judged tree, and what they wrote,
// normalised and bound to the tree by one unsigned run Statement.
//
// THE ORDER, and why each step is where it is:
//   1. refuse what would make the run unprovable before anything runs: a policy inside the judged tree,
//      an output directory inside it or not empty, an image not pinned by digest (policy.js);
//   2. hash the sources of the expected set FROM THE CHECKOUT, before any leg: the set is the one
//      runward derived from this tree (`check --json`, levels.execution.expected), never chosen here;
//   3. the runtime answers, the image is pulled by its digest and the runtime names it by that digest;
//   4. copy the tree; install the dependencies from the lockfile on the copy, the network open and
//      install scripts disabled, the lockfile's digest recorded;
//   5. prove the network is cut: a container started with `--network none` must see no interface but
//      the loopback (a runtime that ignores the flag is refused, not trusted);
//   6. the legs, each in its own container, the network cut, writing to the output directory only; the
//      mutation leg last, once per mutant of the cited lines runward derived (levels.execution.
//      mutationTargets), each mutant written into the copy and the copy restored after its run;
//   7. normalise each report, hash the sources again (the checkout must not have moved), and only then
//      write the reports and the Statement. A run that stops anywhere before writes nothing: no report,
//      no Statement, an output directory that does not exist. It fails closed.
// It holds no key, opens no socket of its own, and keeps no state between runs.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { bufferDigest, fileDigest, mapDigest, rawDigest } from "./digest.js";
import { PolicyError, expand, readPolicy, safeRel } from "./policy.js";
import { normalizeReport } from "./normalize.js";
import { containerRuntime, interfacesOf } from "./runtime.js";
import { buildRunStatement, buildTestResultStatement } from "./statement.js";
import { MUTATOR, applyMutant, languageOf, mutantsOf } from "./mutate.js";
import { caseOutcomes } from "./cases.js";

/** The container paths of a run: the copy of the tree, and the output directory. */
export const CONTAINER = { work: "/runward-run/work", out: "/runward-run/out" };
/** The names the run writes beside its reports (runward reads the first in that directory). */
export const STATEMENT_FILE = "runward-run.intoto.json";
export const TEST_RESULT_FILE = "runward-run.test-result.intoto.json";
const PROBE = ["cat", "/proc/net/dev"];

/** A run refused, fail closed: nothing was written. Exit 3. */
export class RunRefused extends Error {}
/** A misuse of the command: exit 2. */
export class RunUsage extends Error {}

export function version() {
  const pkg = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  return JSON.parse(readFileSync(pkg, "utf8")).version;
}

const inside = (child, parent) => child === parent || child.startsWith(parent + sep);
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** The expected set runward derived from this tree, read from its `check --strict --json` output. */
export function expectedFromCheck(doc) {
  const e = doc?.levels?.execution?.expected;
  if (!e || !Array.isArray(e.files) || !Array.isArray(e.manifests) || typeof e.manifestsDigest !== "string" || !e.files.every(safeRel) || !e.manifests.every(safeRel)) {
    throw new RunRefused("the expected set is not in the check output: write it with `runward check --strict --require attested --json > check.json` on this tree (its levels.execution.expected), then run again");
  }
  return { files: e.files, manifests: e.manifests, manifestsDigest: e.manifestsDigest, rule: String(e.rule ?? ""), runward: typeof doc.runward === "string" ? doc.runward : null };
}

/**
 * The rows whose cited lines the mutation leg mutates, as runward derived them from this tree
 * (`levels.execution.mutationTargets`): never chosen here. Null when the check output carries none (a
 * runward that predates the mutation leg).
 */
export function targetsFromCheck(doc) {
  const t = doc?.levels?.execution?.mutationTargets;
  if (t === undefined) return null;
  const bad = () => new RunRefused("the mutation targets in the check output are not the shape runward writes (levels.execution.mutationTargets): it was not written by runward");
  if (!Array.isArray(t)) throw bad();
  return t.map((x) => {
    if (!x || typeof x.deliverable !== "string" || typeof x.rule !== "string" || !Array.isArray(x.locations) || !Array.isArray(x.tests)) throw bad();
    if (x.tests.some((t) => !t || !safeRel(t.report) || typeof t.name !== "string" || t.name === "")) throw bad();
    const locations = x.locations.map((l) => {
      if (!l || !safeRel(l.file) || !Number.isInteger(l.from) || !Number.isInteger(l.to) || l.from < 1 || l.to < l.from) throw bad();
      return { file: l.file, from: l.from, to: l.to };
    });
    return { deliverable: x.deliverable, rule: x.rule, locations, tests: x.tests.map((t) => ({ report: t.report, name: t.name })) };
  });
}

function hashAll(tree, rels, what) {
  const out = {};
  for (const rel of rels) {
    const d = fileDigest(join(tree, ...rel.split("/")));
    if (d === null) throw new RunRefused(`${what} names ${rel}, which this tree does not hold: the check output was not written from this tree`);
    out[rel] = d;
  }
  return out;
}

/**
 * Run the policy against a tree. `log` receives progress lines. Returns `{ exitCode, written }`, where
 * exitCode is 0 when every leg exited 0 and 1 when one did not (the reports and the Statement are
 * written either way: a red run is a fact). Throws RunUsage (exit 2) or RunRefused (exit 3), and then
 * nothing was written.
 */
export function runPolicy({ policyPath, tree, checkPath, out, runtimeBin = "docker", scratchDir = null, mission = null, log = () => {} }) {
  if (!policyPath || !tree || !checkPath || !out) throw new RunUsage("--policy, --tree, --check and --out are required");
  const treeAbs = real(tree);
  if (!existsSync(treeAbs) || !statSync(treeAbs).isDirectory()) throw new RunUsage(`--tree ${tree} is not a directory`);
  const policyAbs = real(policyPath);
  if (inside(policyAbs, treeAbs)) {
    throw new RunRefused(`the run policy ${policyPath} lives in the judged tree: the agent writes the tree, and would choose the commands that produce its own evidence (ADR-0120 decision 5). Keep it with the workflow that runs runward-run`);
  }
  const outAbs = resolve(out);
  if (inside(real(dirname(outAbs)) + sep + outAbs.split(sep).pop(), treeAbs) || inside(outAbs, treeAbs)) {
    throw new RunRefused(`the output directory ${out} is inside the judged tree: the legs write only to a directory outside it, and the operator's CI commits what it holds`);
  }
  if (existsSync(outAbs) && (!statSync(outAbs).isDirectory() || readdirSync(outAbs).length > 0)) {
    throw new RunUsage(`the output directory ${out} exists and is not empty: a run writes into an empty one, so nothing of another run is read as its output`);
  }

  let policyBytes;
  try { policyBytes = readFileSync(policyAbs); } catch (e) { throw new RunUsage(`the run policy ${policyPath} cannot be read (${e.code ?? "error"})`); }
  let policy;
  try { policy = readPolicy(JSON.parse(policyBytes.toString("utf8"))); } catch (e) {
    if (e instanceof PolicyError) throw e.kind === "refusal" ? new RunRefused(e.message) : new RunUsage(e.message);
    throw new RunUsage(`the run policy ${policyPath} is not JSON`);
  }
  let checkDoc;
  try { checkDoc = JSON.parse(readFileSync(resolve(checkPath), "utf8")); } catch { throw new RunUsage(`--check ${checkPath} is not a readable JSON document`); }
  const expected = expectedFromCheck(checkDoc);
  const targets = targetsFromCheck(checkDoc);
  const mutationLegs = policy.legs.filter((l) => l.leg === "mutation");
  if (mutationLegs.length && targets === null) {
    throw new RunRefused("the check output carries no mutation targets (levels.execution.mutationTargets): write it with a runward that derives them, `runward check --strict --require attested --json > check.json`, then run again");
  }
  for (const t of targets ?? []) for (const l of t.locations) {
    if (!expected.files.includes(l.file)) throw new RunRefused(`the mutation target of ${t.rule} names ${l.file}, which the expected set does not hold: the check output was not written from this tree`);
  }

  // 2. The sources, hashed from the checkout before any leg runs.
  const sources = hashAll(treeAbs, expected.files, "the expected set");
  const manifestFiles = hashAll(treeAbs, expected.manifests, "the manifests");
  const manifestsDigest = mapDigest(manifestFiles);
  if (manifestsDigest !== expected.manifestsDigest) throw new RunRefused("the manifests of this tree are not the ones the check output records: it was not written from this tree");
  let lockfile = null;
  if (policy.install) {
    const d = fileDigest(join(treeAbs, ...policy.install.lockfile.split("/")));
    if (d === null) throw new RunRefused(`the lockfile ${policy.install.lockfile} is not in this tree: dependencies are installed from the lockfile the tree commits (ADR-0120 decision 3)`);
    lockfile = { path: policy.install.lockfile, sha256: d };
  }
  log(`runward-run: ${Object.keys(sources).length} source file(s) of the expected set hashed before any leg; manifests ${manifestsDigest.slice(0, 12)}`);

  // 3. The runtime, the image by its digest.
  const rt = containerRuntime(runtimeBin);
  const v = rt.version();
  if (!v.ok) throw new RunRefused(`the container runtime \`${runtimeBin}\` does not answer${v.detail ? ` (${v.detail})` : ""}: there is nowhere to run the legs with the network cut`);
  if (!rt.pull(policy.image).ok) throw new RunRefused(`the image ${policy.image} could not be pulled by its digest`);
  const digest = policy.image.slice(policy.image.indexOf("@") + 1);
  if (!rt.digests(policy.image).some((d) => d.endsWith(`@${digest}`))) {
    throw new RunRefused(`the runtime does not name the image by the digest the policy pins (${digest}): a run whose image cannot be named is not one a reader can redo`);
  }

  // The scratch directory holds the copy of the tree and the legs' raw output. It must be a path the
  // container runtime can mount: with a Docker daemon in another container (GitLab's dind service), a
  // directory the runner shares with it (`--scratch`), else the system's temporary directory.
  const scratchBase = scratchDir ? real(scratchDir) : tmpdir();
  if (scratchDir && (!existsSync(scratchBase) || !statSync(scratchBase).isDirectory())) throw new RunUsage(`--scratch ${scratchDir} is not a directory`);
  if (inside(scratchBase, treeAbs)) throw new RunUsage(`--scratch ${scratchDir} is inside the judged tree: the legs run on a copy outside it`);
  const scratch = mkdtempSync(join(scratchBase, "runward-run-"));
  const work = join(scratch, "work");
  const stage = join(scratch, "out");
  const user = typeof process.getuid === "function" ? `${process.getuid()}:${process.getgid()}` : null;
  const env = { HOME: "/tmp" };
  try {
    // 4. A copy of the tree, its `.git` left out (the legs run the tree, not its history) and its
    //    `node_modules` too (dependencies come from the lockfile, installed below, or not at all).
    cpSync(treeAbs, work, { recursive: true, filter: (src) => { const parts = relative(treeAbs, src).split(sep); return !parts.includes(".git") && !parts.includes("node_modules"); } });
    mkdirSync(stage, { recursive: true });
    // The directory of each report the policy declares exists before the legs run: a reporter that
    // writes to a path (Node.js's `--test-reporter-destination`) does not create its directory, and
    // measured on a real runtime the tests leg then wrote nothing at all.
    for (const leg of policy.legs) for (const rep of leg.reports) mkdirSync(dirname(join(stage, ...rep.path.split("/"))), { recursive: true });
    let install = null;
    if (policy.install) {
      const i = policy.install;
      log(`runward-run: install from ${i.lockfile} (network open, install scripts ${i.scripts})`);
      const r = rt.run({ image: policy.image, network: "default", mounts: [{ host: work, container: CONTAINER.work }], workdir: posixJoin(CONTAINER.work, i.cwd), command: i.command, user, env, timeoutSeconds: 1800 });
      if (r.status !== 0) throw new RunRefused(`the install from ${i.lockfile} failed (exit ${r.status ?? "none"}${r.error ? `, ${r.error}` : ""}): no leg ran`);
      install = { command: i.command, cwd: i.cwd, exitCode: 0, network: "open", installScripts: i.scripts };
    }

    // 5. The network is cut, or the run is refused.
    const probe = rt.run({ image: policy.image, network: "none", mounts: [], workdir: "/", command: PROBE, user, env, timeoutSeconds: 120, capture: true });
    if (probe.status !== 0) throw new RunRefused(`the runtime could not start a container with the network cut (exit ${probe.status ?? "none"}): ${(probe.stderr || probe.error || "").trim().slice(0, 300)}`);
    const ifaces = interfacesOf(probe.stdout);
    const open = ifaces.filter((n) => n !== "lo");
    if (ifaces.length === 0 || open.length > 0) {
      throw new RunRefused(`the network is not cut: a container started with --network none sees ${open.length ? `the interface(s) ${open.join(", ")}` : "no interface table"} (ADR-0120 decision 3)`);
    }
    log("runward-run: network cut (a --network none container sees the loopback only)");

    // 6. The legs, the mutation leg last.
    const legs = [];
    let mutation = null;
    let seq = 0;
    const name = () => `runward-run-${process.pid}-${seq++}`;
    for (const leg of [...policy.legs.filter((l) => l.leg !== "mutation"), ...mutationLegs]) {
      if (leg.leg === "mutation") {
        const started = Date.now();
        mutation = runMutationLeg({ rt, image: policy.image, leg, work, scratch, targets, user, env, name, log });
        log(`runward-run: mutation leg: ${mutation.mutants.length} mutant(s) of ${mutation.locations.length} cited location(s), ${((Date.now() - started) / 1000).toFixed(1)} s of wall clock`);
        legs.push({ leg: "mutation", cwd: leg.cwd, command: mutation.leg.command, exitCode: mutation.baseline.exitCode, ...(mutation.baseline.timedOut ? { timedOut: true } : {}), reports: [], natures: [] });
        continue;
      }
      const command = leg.command.map((a) => expand(a, CONTAINER));
      log(`runward-run: ${leg.leg} leg: ${command.join(" ")}`);
      const r = rt.run({ image: policy.image, network: "none", mounts: [{ host: work, container: CONTAINER.work }, { host: stage, container: CONTAINER.out }], workdir: posixJoin(CONTAINER.work, leg.cwd), command, user, env, timeoutSeconds: leg.timeoutSeconds, name: name() });
      legs.push({ leg: leg.leg, cwd: leg.cwd, command, exitCode: r.status, ...(r.timedOut ? { timedOut: true } : {}), reports: leg.reports.map((x) => x.path), natures: leg.reports.map((x) => x.nature) });
    }

    // 7. The reports, normalised; the sources, again; then, and only then, the output.
    const reports = [];
    const junitTexts = [];
    for (const leg of policy.legs) {
      for (const rep of leg.reports) {
        const abs = join(stage, ...rep.path.split("/"));
        if (!existsSync(abs) || !statSync(abs).isFile()) throw new RunRefused(`the ${leg.leg} leg wrote no report at ${rep.path} (\${out}/${rep.path}): there is nothing to bind`);
        let text;
        try {
          text = normalizeReport(rep.nature, readFileSync(abs, "utf8"), { base: posixJoin(CONTAINER.work, leg.cwd), work: CONTAINER.work });
        } catch (e) {
          throw new RunRefused(`the report ${rep.path} is not the ${rep.nature} document its policy names (${e.message})`);
        }
        const bytes = Buffer.from(text, "utf8");
        reports.push({ path: rep.path, nature: rep.nature, bytes, sha256: rawDigest(bytes), leg: leg.leg, cwd: leg.cwd, text });
        if (rep.nature === "junit") junitTexts.push(text);
      }
    }
    const after = hashAll(treeAbs, expected.files, "the expected set");
    const moved = Object.keys(sources).filter((k) => after[k] !== sources[k]);
    if (moved.length) throw new RunRefused(`the judged tree changed while the run ran (${moved.slice(0, 3).join(", ")}): the legs run on a copy, so something else wrote the checkout`);

    const run = {
      version: version(), mission, policySha256: rawDigest(policyBytes), image: policy.image,
      runtime: { name: rt.name, version: v.version }, install, lockfile,
      legs: legs.map(({ natures, ...l }) => l),
      manifests: { files: expected.manifests, digest: manifestsDigest },
      sources, expected: { rule: expected.rule, from: "runward check --strict --require attested --json (levels.execution.expected)", runward: expected.runward },
      reports,
      coverage: coverageFacts(reports, targets),
      mutation,
    };
    const statement = buildRunStatement(run);
    const testResult = buildTestResultStatement(run, junitTexts);

    const partial = `${outAbs}.runward-run-partial-${process.pid}`;
    rmSync(partial, { recursive: true, force: true });
    for (const r of reports) {
      const dest = join(partial, ...r.path.split("/"));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, r.bytes);
    }
    const dir = join(partial, ...policy.reportsDir.split("/").filter((s) => s !== "."));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, STATEMENT_FILE), `${JSON.stringify(statement, null, 2)}\n`);
    writeFileSync(join(dir, TEST_RESULT_FILE), `${JSON.stringify(testResult, null, 2)}\n`);
    if (existsSync(outAbs)) rmSync(outAbs, { recursive: true, force: true }); // empty, checked above
    renameSync(partial, outAbs);
    const written = [...reports.map((r) => r.path), posixJoin(policy.reportsDir, STATEMENT_FILE), posixJoin(policy.reportsDir, TEST_RESULT_FILE)];
    const red = legs.filter((l) => l.exitCode !== 0);
    log(`runward-run: wrote ${written.length} file(s) to ${relative(process.cwd(), outAbs) || "."}: ${reports.length} report(s), the run Statement (unsigned) and its test-result Statement${red.length ? `; ${red.length} leg(s) exited non-zero, recorded as such` : ""}`);
    return { exitCode: red.length ? 1 : 0, written, statement };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * The mutation leg (ADR-0120 decision 2): the cited tests' outcomes on the unmutated copy (the baseline),
 * then, for each mutant of each cited location, the copy's file changed by that mutant, the leg's command
 * run with the network cut, the JUnit report it wrote read for every cited case, and the file restored.
 * A mutant changes code only on the lines runward cited; the same change reached from two rows runs once.
 */
function runMutationLeg({ rt, image, leg, work, scratch, targets, user, env, name, log }) {
  // The cited cases of the one JUnit report this leg's command writes; a case another report carries (an
  // eval's, another runner's) is not run here, and runward reads it so.
  const tests = [...new Set(targets.flatMap((t) => t.tests.filter((x) => x.report === leg.junit).map((x) => x.name)))].sort();
  const command = leg.command.map((a) => expand(a, CONTAINER));
  const junitRel = leg.junit.split("/");
  const once = () => {
    const out = mkdtempSync(join(scratch, "mutant-"));
    try {
      mkdirSync(dirname(join(out, ...junitRel)), { recursive: true });
      const r = rt.run({ image, network: "none", mounts: [{ host: work, container: CONTAINER.work }, { host: out, container: CONTAINER.out }], workdir: posixJoin(CONTAINER.work, leg.cwd), command, user, env, timeoutSeconds: leg.timeoutSeconds, capture: true, name: name() });
      let xml = "";
      try { xml = readFileSync(join(out, ...junitRel), "utf8"); } catch { xml = ""; }
      return { exitCode: r.status, ...(r.timedOut ? { timedOut: true } : {}), cases: caseOutcomes(xml, tests) };
    } finally { rmSync(out, { recursive: true, force: true }); }
  };
  log(`runward-run: mutation leg: the cited tests on the unmutated copy (${tests.length} case(s)): ${command.join(" ")}`);
  const baseline = once();

  const byLoc = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.from - b.from || a.to - b.to);
  const seenLoc = new Set();
  const locs = targets.flatMap((t) => t.locations).sort(byLoc).filter((l) => { const k = `${l.file}\0${l.from}\0${l.to}`; if (seenLoc.has(k)) return false; seenLoc.add(k); return true; });
  const originals = new Map();
  const planned = [];
  const locations = [];
  const seen = new Set();
  for (const loc of locs) {
    const language = languageOf(loc.file);
    if (!language) { locations.push({ ...loc, language: null, candidates: 0, mutants: 0 }); continue; }
    if (!originals.has(loc.file)) originals.set(loc.file, readFileSync(join(work, ...loc.file.split("/")), "utf8"));
    const all = mutantsOf(originals.get(loc.file), loc.from, loc.to);
    const fresh = all.filter((m) => !seen.has(`${loc.file}\0${m.start}\0${m.end}\0${m.replacement}`));
    const chosen = fresh.slice(0, leg.maxMutantsPerLocation);
    for (const m of chosen) { seen.add(`${loc.file}\0${m.start}\0${m.end}\0${m.replacement}`); planned.push({ file: loc.file, m }); }
    locations.push({ ...loc, language, candidates: all.length, mutants: chosen.length });
  }
  log(`runward-run: mutation leg: ${planned.length} mutant(s) to run (${locations.filter((l) => l.candidates > l.mutants).length} location(s) capped at ${leg.maxMutantsPerLocation})`);
  const clip = (s) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > 60 ? `${t.slice(0, 57)}...` : t; };
  const mutants = [];
  for (const { file, m } of planned) {
    const abs = join(work, ...file.split("/"));
    const original = originals.get(file);
    writeFileSync(abs, applyMutant(original, m));
    let r;
    try { r = once(); } finally { writeFileSync(abs, original); }
    mutants.push({ file, line: m.line, column: m.column, operator: `${m.kind}: ${clip(m.original)} → ${m.replacement === "" ? "(removed)" : clip(m.replacement)}`, exitCode: r.exitCode, ...(r.timedOut ? { timedOut: true } : {}), cases: r.cases });
  }
  for (const [file, text] of originals) {
    if (readFileSync(join(work, ...file.split("/")), "utf8") !== text) throw new RunRefused(`the mutation leg could not restore ${file} in the copy: its outcomes are not facts about this tree`);
  }
  return {
    mutator: MUTATOR,
    leg: { cwd: leg.cwd, command, junit: leg.junit, timeoutSeconds: leg.timeoutSeconds, maxMutantsPerLocation: leg.maxMutantsPerLocation },
    distinction: "a cited case failed on an assertion (the runner's AssertionError or ERR_ASSERTION), on another error (JUnit's <error>, or another error class), or with no class the runner tells (failure)",
    baseline, targets, locations, mutants,
  };
}

/**
 * The coverage of the cited lines (ADR-0120 decision 2): for each cited location of each row, how many of
 * its lines the coverage report instruments and how many it records executed, read from the LCOV a
 * coverage leg wrote. By the suite: a runner reports coverage per run, not per test.
 */
function coverageFacts(reports, targets) {
  const lcov = reports.find((r) => r.leg === "coverage" && r.nature === "coverage" && /^SF:/m.test(r.text));
  if (!lcov || !targets) return null;
  const hits = new Map();
  let file = null;
  for (const line of lcov.text.split("\n")) {
    if (line.startsWith("SF:")) { file = posixJoin(lcov.cwd, line.slice(3).trim()).replace(/^\.\//, ""); if (!hits.has(file)) hits.set(file, new Map()); }
    else if (line.startsWith("DA:") && file) { const [n, h] = line.slice(3).split(","); hits.get(file).set(Number(n), (hits.get(file).get(Number(n)) ?? 0) + Number(h)); }
    else if (line === "end_of_record") file = null;
  }
  return {
    report: lcov.path,
    targets: targets.map((t) => ({
      deliverable: t.deliverable, rule: t.rule,
      locations: t.locations.map((l) => {
        const h = hits.get(l.file);
        let instrumented = 0, executed = 0;
        if (h) for (const [n, c] of h) if (n >= l.from && n <= l.to) { instrumented++; if (c > 0) executed++; }
        return { ...l, instrumented, executed };
      }),
    })),
  };
}

function posixJoin(a, b) {
  if (!b || b === ".") return a;
  return `${a.replace(/\/+$/, "")}/${b}`;
}

/** The digest runward compares a cited report with, for a reader who has the bytes. */
export const reportDigests = (buf) => ({ raw: rawDigest(buf), normalized: bufferDigest(buf) });
