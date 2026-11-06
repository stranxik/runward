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
//   6. the legs, each in its own container, the network cut, writing to the output directory only;
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

    // 6. The legs.
    const legs = [];
    for (const leg of policy.legs) {
      const command = leg.command.map((a) => expand(a, CONTAINER));
      log(`runward-run: ${leg.leg} leg: ${command.join(" ")}`);
      const r = rt.run({ image: policy.image, network: "none", mounts: [{ host: work, container: CONTAINER.work }, { host: stage, container: CONTAINER.out }], workdir: posixJoin(CONTAINER.work, leg.cwd), command, user, env, timeoutSeconds: leg.timeoutSeconds });
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
        reports.push({ path: rep.path, nature: rep.nature, bytes, sha256: rawDigest(bytes) });
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

function posixJoin(a, b) {
  if (!b || b === ".") return a;
  return `${a.replace(/\/+$/, "")}/${b}`;
}

/** The digest runward compares a cited report with, for a reader who has the bytes. */
export const reportDigests = (buf) => ({ raw: rawDigest(buf), normalized: bufferDigest(buf) });
