#!/usr/bin/env node
// Reuse of a previous release's SURVIVORS by the release ratchet (ADR-0106, proposed).
//
// Every release ratchet measured every mutant of the perimeter: on the 0.46.0 model (ADR-0104) that
// is 128 legs and 170 runner-hours, of which survivors are 101 (a survivor pays the whole suite, a
// killed mutant the cheap stage). This script lets a release reuse what cannot hide a hole, and only
// that: a mutant that SURVIVED at the previous release, whose code has not changed, and that the
// register still files. Everything else is measured on this tree, every killed mutant included.
//
// WHY ONLY SURVIVORS. A reused result is the one place a stale answer can enter. A reused "killed"
// that the tree would now let survive is a hole nobody files, the false green ADR-0059 exists to
// refuse; a reused "survived" that the tree would now kill is a hole filed after it was closed, a
// claim in the safe direction that the next full measure corrects. Stryker cannot tell the two
// apart here: with the command runner and coverageAnalysis "off" it has no per-test coverage, and
// its differ reuses EVERY mutant whose code did not change, whatever the tests became
// (node_modules/@stryker-mutator/core/src/mutants/incremental-differ.ts, `mutantCanBeReused`;
// observed by test/stryker-incremental-contract.js, case 4). So runward hands Stryker an
// incremental file that holds survivors only, and Stryker re-measures everything the file does not
// carry (case 2) and every mutant whose code changed (case 3).
//
// Subcommands, each called by .github/workflows/mutation-ratchet.yml:
//
//   previous-tag --current <x.y.z> [--inclusive]   < tags on stdin
//       The release whose bundle this run may reuse: the newest vX.Y.Z below the current version
//       (at or below it with --inclusive, for a dispatch on main between releases).
//   plan --bundle <f> --tag <t> --commit <sha> --run <id> --out <f>
//   plan --full "<reason>" --out <f>
//       The plan job's reuse plan. Validates the previous release's bundle (already verified by
//       `gh attestation verify` against the release's tag) and writes, per module, the survivors
//       offered to Stryker; or a full plan with the reason. Exit 0 either way: a full measure is the
//       safe outcome, never a pass, and the reason is printed and kept in the run's summary.
//   leg --plan <f> --module <m> --expect <n> --out <f>
//       One leg's Stryker incremental file. Writes nothing when the module is not reused. Exit 1 when
//       the plan said this leg reuses (`--expect` > 0) and it cannot: the chunk is then refused
//       rather than measured for hours on a plan cut for reuse.
//   trim --report <f> --start <s> --end <e>
//       Keeps only the mutants inside the leg's range. Stryker carries a file's mutants from outside
//       the `--mutate` range into the report (contract case 5); a full measure never reports them,
//       so neither does a reuse.
//   bundle --merged <dir> --answers <dir> --reuse-plan <f> --out <f>
//       The next release's input, written by the summary job and attested beside the summary
//       (ADR-0079).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SEP, survivorKeys } from "./mutation-key.mjs";

export const BUNDLE_SCHEMA = "https://runward.dev/mutation-reuse-bundle/v1";
export const PLAN_SCHEMA = "https://runward.dev/mutation-reuse-plan/v1";
/** One release ratchet in FULL_EVERY measures everything: three reuse runs, then a full one. */
export const FULL_EVERY = 4;
export const MARK = "reused by ADR-0106";
/** What decides how a mutant is generated and judged, besides the tree: any change, a full measure. */
export const HARNESS = [
  "stryker.config.json",
  "scripts/mutation-testcmd.sh",
  "scripts/mutation-select-tests.mjs",
  "scripts/mutation-timeouts.mjs",
  "scripts/mutation-apply-verdicts.mjs",
];
export const STRYKER_PACKAGES = ["@stryker-mutator/core", "@stryker-mutator/instrumenter"];
/** The same set as mutation-survivors.mjs and mutation-ratchet.mjs. */
export const SURVIVING = new Set(["Survived", "NoCoverage"]);
export const VERDICTS = "docs/compliance/mutation-survivors";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** dist/lib/evidence.js[:range] -> evidence */
export const perimeterOf = (config) => config.mutate.map((e) => {
  const file = String(e).replace(/:.*$/, "");
  return { module: basename(file).replace(/\.js$/, ""), file };
});

// ── the environment ─────────────────────────────────────────────────────────────────────────────

/**
 * stryker.config.json is read as Stryker reads it: its settings, without the `_` keys (prose: the
 * file is mostly comments, amended often) and without `mutate` (the perimeter, which the plan reads
 * module by module: a module that enters it has no survivor in the bundle and is measured whole).
 * The other harness files are read byte for byte.
 */
export function configDigest(config) {
  const canonical = (v) => (Array.isArray(v) ? v.map(canonical) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort(byCodeUnit).map((k) => [k, canonical(v[k])])) : v);
  const settings = Object.fromEntries(Object.entries(config).filter(([k]) => !k.startsWith("_") && k !== "mutate"));
  return sha256(JSON.stringify(canonical(settings)));
}

/** Node, Stryker and the harness files: what a reuse requires to be identical. */
export function environment(root, node = process.version) {
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const stryker = {};
  for (const p of STRYKER_PACKAGES) {
    const v = lock.packages?.[`node_modules/${p}`]?.version;
    if (!v) throw new Error(`package-lock.json carries no ${p}`);
    stryker[p] = v;
  }
  const harness = {};
  for (const f of HARNESS) {
    const bytes = readFileSync(resolve(root, f));
    harness[f] = f === "stryker.config.json" ? configDigest(JSON.parse(bytes.toString("utf8"))) : sha256(bytes);
  }
  return { node, stryker, harness };
}

/** null when equal, otherwise the first difference in words. */
export function environmentDiffers(was, now) {
  if (!was || typeof was !== "object") return "the bundle records no environment";
  if (was.node !== now.node) return `Node.js ${was.node} then, ${now.node} now`;
  for (const p of STRYKER_PACKAGES) {
    if (was.stryker?.[p] !== now.stryker[p]) return `${p} ${was.stryker?.[p] ?? "absent"} then, ${now.stryker[p]} now`;
  }
  for (const f of HARNESS) {
    if (was.harness?.[f] !== now.harness[f]) return `${f} changed`;
  }
  return null;
}

// ── which release ───────────────────────────────────────────────────────────────────────────────

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)$/;
const parse = (v) => { const m = SEMVER.exec(v.startsWith("v") ? v : `v${v}`); return m ? m.slice(1).map(Number) : null; };
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function previousTag(tags, current, inclusive = false) {
  const cur = parse(current);
  if (!cur) throw new Error(`not a version: ${current}`);
  let best = null;
  for (const t of tags) {
    const v = parse(t);
    if (!v || !t.startsWith("v")) continue;
    const c = compare(v, cur);
    if (c > 0 || (c === 0 && !inclusive)) continue;
    if (!best || compare(v, best.v) > 0) best = { t, v };
  }
  return best ? best.t : null;
}

// ── the register's filings ──────────────────────────────────────────────────────────────────────

/**
 * The stable keys the register files, per module. A survivor is offered for reuse only while its key
 * is filed: retiring a filing is what follows a test written to kill it, and that survivor must be
 * measured again, not carried past its fix. The key is the ratchet's own (mutation-key.mjs,
 * survivorKeys), computed on the source the survivor was measured on.
 */
export function filedKeys(root) {
  const keys = new Map();
  const dir = resolve(root, VERDICTS);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort(byCodeUnit)) {
    for (const v of JSON.parse(readFileSync(join(dir, f), "utf8")).verdicts ?? []) {
      if (!v.stableKey) throw new Error(`${VERDICTS}/${f}: a verdict carries no stableKey`);
      const m = v.stableKey.split(SEP)[0];
      if (!keys.has(m)) keys.set(m, new Set());
      keys.get(m).add(v.stableKey);
    }
  }
  return keys;
}

// ── line mapping, for the planner's prediction only ─────────────────────────────────────────────

/**
 * Old line -> new line for the lines a longest common subsequence keeps with equal text. Used only
 * to predict which new range a survivor falls in, so the planner can cut the plan; Stryker's own
 * differ decides what is reused.
 */
export function lineMap(oldText, newText) {
  const a = oldText.split("\n"), b = newText.split("\n");
  const out = new Map();
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) { out.set(p + 1, p + 1); p++; }
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s);
  const n = A.length, m = B.length;
  if (n > 0 && m > 0) {
    const width = m + 1;
    const dp = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * width + j] = A[i] === B[j] ? dp[(i + 1) * width + j + 1] + 1 : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.set(p + i + 1, p + j + 1); i++; j++; }
      else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) i++;
      else j++;
    }
  }
  for (let k = 0; k < s; k++) out.set(a.length - k, b.length - k);
  return out;
}

// ── the bundle (written at release N, read at release N+1) ──────────────────────────────────────

const ANSWERED = new Set([0, 1]);

/**
 * `merged`: Map module -> parsed merged report; `answers`: Map module -> parsed answer.
 * A module is reusable next time only if its measurement was complete: every chunk came back and
 * the ratchet compared it (exit 0 describes or 1 mismatch: the measurement stands either way; exit 2
 * compared nothing). Its survivors are kept with the source they were measured on.
 */
export function buildBundle({ perimeter, merged, answers, reusePlan, version, commit, run, event }) {
  if (!reusePlan || reusePlan.schema !== PLAN_SCHEMA) {
    throw new Error("this run's reuse plan is missing, so what it reused cannot be stated: no bundle");
  }
  const modules = {};
  for (const { module, file } of perimeter) {
    const a = answers.get(module);
    const report = merged.get(module);
    if (!a || !report) { modules[module] = { complete: false, reason: !a ? "no answer" : "no merged report" }; continue; }
    if (!ANSWERED.has(a.exit)) { modules[module] = { complete: false, reason: `ratchet exit ${a.exit}: nothing was compared` }; continue; }
    if (a.chunksExpected !== a.chunksMeasured) { modules[module] = { complete: false, reason: `${a.chunksMeasured} of ${a.chunksExpected} chunks` }; continue; }
    const entry = report.files?.[file];
    if (!entry || typeof entry.source !== "string") { modules[module] = { complete: false, reason: `the merged report carries no ${file}` }; continue; }
    const survivors = entry.mutants.filter((m) => SURVIVING.has(m.status)).map((m) => ({
      id: String(m.id), mutatorName: m.mutatorName, replacement: m.replacement, location: m.location, status: m.status,
    }));
    modules[module] = { complete: true, sha256: sha256(entry.source), source: entry.source, survivors };
  }
  return {
    schema: BUNDLE_SCHEMA,
    adr: "ADR-0106",
    version,
    commit,
    run,
    event,
    generation: reusePlan.generation,
    env: reusePlan.env,
    modules,
  };
}

// ── the plan (release N+1) ──────────────────────────────────────────────────────────────────────

export function fullPlan(reason, env = null) {
  return { schema: PLAN_SCHEMA, adr: "ADR-0106", state: "full", reason, generation: 0, from: null, env, modules: {} };
}

/**
 * Validates a bundle the workflow has already verified by its attestation, and decides per module.
 * Returns a plan; never throws for a bundle it cannot use (that is a full plan with its reason).
 * `sourceOf(file)` reads the module as built now.
 */
export function planReuse({ bundle, bundleSha256, tag, commit, run, env, perimeter, sourceOf, filed, fullEvery = FULL_EVERY }) {
  const full = (reason) => fullPlan(reason, env);
  if (!bundle || bundle.schema !== BUNDLE_SCHEMA) return full("the bundle is not a reuse bundle this script reads");
  const version = tag.replace(/^v/, "");
  if (bundle.version !== version) return full(`the bundle says version ${bundle.version}, the release is ${tag}`);
  if (bundle.commit !== commit) return full(`the bundle says commit ${bundle.commit}, ${tag} is ${commit}`);
  if (bundle.event !== "release") return full(`the bundle was written by a ${bundle.event} run, not a release`);
  if (!Number.isInteger(bundle.generation) || bundle.generation < 0) return full("the bundle carries no generation");
  const generation = bundle.generation + 1;
  if (generation >= fullEvery) return full(`the last ${bundle.generation} release ratchet(s) reused survivors; one in ${fullEvery} measures everything`);
  const differs = environmentDiffers(bundle.env, env);
  if (differs) return full(`the environment changed: ${differs}`);
  if (!bundle.modules || typeof bundle.modules !== "object") return full("the bundle carries no modules");

  const modules = {};
  let offered = 0;
  for (const { module, file } of perimeter) {
    const b = bundle.modules[module];
    const no = (reason) => { modules[module] = { reuse: false, reason }; };
    if (!b) { no(`not in ${tag}'s perimeter`); continue; }
    if (!b.complete) { no(`incomplete at ${tag}: ${b.reason ?? "no reason recorded"}`); continue; }
    if (typeof b.source !== "string" || sha256(b.source) !== b.sha256) { no("the bundle's source does not match its digest"); continue; }
    if (!Array.isArray(b.survivors)) { no("the bundle carries no survivor list"); continue; }
    if (b.survivors.some((m) => !SURVIVING.has(m.status))) return full(`${module}: the bundle carries a mutant that did not survive; a bundle holds survivors only`);
    if (b.survivors.length === 0) { no(`no survivor at ${tag}`); continue; }
    const keys = survivorKeys(b.source, module, b.survivors);
    const filedHere = filed.get(module) ?? new Set();
    const kept = b.survivors.filter((_, i) => filedHere.has(keys[i]));
    const retired = b.survivors.length - kept.length;
    if (kept.length === 0) { no(`none of its ${b.survivors.length} survivor(s) at ${tag} is still filed`); continue; }
    const current = sourceOf(file);
    const map = sha256(current) === b.sha256 ? null : lineMap(b.source, current);
    const reason = `${MARK} from ${tag} (run ${run})`;
    modules[module] = {
      reuse: true,
      file,
      source: b.source,
      unchanged: map === null,
      retired,
      mutants: kept.map((m) => ({ ...m, statusReason: reason })),
      // The new line each survivor is predicted on, or null where its line moved or changed.
      predictedLines: kept.map((m) => (map === null ? m.location.start.line : map.get(m.location.start.line) ?? null)),
    };
    offered += kept.length;
  }
  if (offered === 0) return full(`nothing to reuse from ${tag}`);
  return {
    schema: PLAN_SCHEMA,
    adr: "ADR-0106",
    state: "reuse",
    reason: `${offered} survivor(s) of ${tag} offered to Stryker; every other mutant is measured`,
    generation,
    from: { tag, version, commit, run: String(run), bundleSha256, generation: bundle.generation },
    env,
    modules,
  };
}

// ── one leg ─────────────────────────────────────────────────────────────────────────────────────

/** The Stryker incremental report one leg is handed: the module's offered survivors and the source they were measured on. */
export function legFile(plan, module) {
  const m = plan?.modules?.[module];
  if (!plan || plan.state !== "reuse" || !m?.reuse) return null;
  return {
    schemaVersion: "1.0",
    thresholds: { high: 100, low: 0 },
    files: { [m.file]: { language: "javascript", source: m.source, mutants: m.mutants } },
  };
}

/** Keeps the mutants inside [start, end] (1-based lines, both ends included), as a full measure of that range reports them. */
export function trimReport(report, start, end) {
  let kept = 0, dropped = 0, reused = 0;
  for (const entry of Object.values(report.files ?? {})) {
    entry.mutants = (entry.mutants ?? []).filter((m) => {
      const inside = m.location.start.line >= start && m.location.end.line <= end;
      if (!inside) { dropped++; return false; }
      kept++;
      if (String(m.statusReason ?? "").startsWith(MARK)) reused++;
      return true;
    });
  }
  return { kept, dropped, reused };
}

export const reusedIn = (report) => Object.values(report.files ?? {})
  .reduce((n, e) => n + (e.mutants ?? []).filter((m) => String(m.statusReason ?? "").startsWith(MARK)).length, 0);

// ── command line ────────────────────────────────────────────────────────────────────────────────

function find(dir, test) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const name of readdirSync(dir).sort(byCodeUnit)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...find(p, test));
    else if (test(name)) found.push(p);
  }
  return found;
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

export function main(argv) {
  const [cmd, ...rest] = argv;
  const arg = (name) => { const i = rest.indexOf(`--${name}`); return i === -1 ? null : rest[i + 1]; };
  const flag = (name) => rest.includes(`--${name}`);
  const root = process.cwd();

  if (cmd === "previous-tag") {
    const current = arg("current");
    if (!current) { console.error("usage: mutation-reuse.mjs previous-tag --current <x.y.z> [--inclusive] < tags"); return 2; }
    const tags = readFileSync(0, "utf8").split("\n").map((t) => t.trim()).filter(Boolean);
    const t = previousTag(tags, current, flag("inclusive"));
    if (t) process.stdout.write(`${t}\n`);
    return 0;
  }

  if (cmd === "plan") {
    const out = arg("out");
    if (!out) { console.error("usage: mutation-reuse.mjs plan (--bundle <f> --tag <t> --commit <sha> --run <id> | --full <reason>) --out <f>"); return 2; }
    let env = null;
    const write = (p) => {
      writeFileSync(out, `${JSON.stringify(p)}\n`);
      if (p.state === "reuse") console.log(`::notice title=reuse (ADR-0106)::${p.reason}; generation ${p.generation} of at most ${FULL_EVERY - 1} before a full measure`);
      else console.log(`::warning title=full measure (ADR-0106)::${p.reason}. Every mutant of the perimeter is measured.`);
      for (const [m, e] of Object.entries(p.modules)) console.error(`  ${m.padEnd(20)} ${e.reuse ? `${e.mutants.length} survivor(s) offered${e.retired ? `, ${e.retired} no longer filed and measured` : ""}${e.unchanged ? "" : ", module changed since"}` : `measured whole: ${e.reason}`}`);
      return 0;
    };
    try {
      env = environment(root);
    } catch (e) {
      return write(fullPlan(`the environment cannot be read: ${e.message}`));
    }
    if (arg("full") !== null) return write(fullPlan(arg("full"), env));
    const bundlePath = arg("bundle"), tag = arg("tag"), commit = arg("commit"), run = arg("run");
    if (!bundlePath || !tag || !commit || !run) return write(fullPlan("the plan step was not given a verified bundle, a tag, a commit and a run", env));
    let bundle, bytes;
    try {
      bytes = readFileSync(bundlePath);
      bundle = JSON.parse(bytes.toString("utf8"));
    } catch (e) {
      return write(fullPlan(`the bundle is not readable JSON (${e.message})`, env));
    }
    let config, filed;
    try {
      config = readJson(resolve(root, "stryker.config.json"));
      filed = filedKeys(root);
    } catch (e) {
      return write(fullPlan(`the perimeter or the register cannot be read: ${e.message}`, env));
    }
    const sourceOf = (file) => readFileSync(resolve(root, file), "utf8");
    try {
      return write(planReuse({ bundle, bundleSha256: sha256(bytes), tag, commit, run, env, perimeter: perimeterOf(config), sourceOf, filed }));
    } catch (e) {
      return write(fullPlan(`the plan could not be computed: ${e.message}`, env));
    }
  }

  if (cmd === "leg") {
    const planPath = arg("plan"), module = arg("module"), out = arg("out");
    const expect = Number(arg("expect") ?? 0);
    if (!module || !out) { console.error("usage: mutation-reuse.mjs leg --plan <f> --module <m> --expect <n> --out <f>"); return 2; }
    let plan = null;
    try { plan = readJson(planPath); } catch { plan = null; }
    if (!plan || plan.schema !== PLAN_SCHEMA) {
      if (expect > 0) { console.error(`::error title=${module}::this leg was planned with ${expect} reused survivor(s) and the reuse plan is not readable: the chunk is refused rather than measured on a plan cut for reuse`); return 1; }
      console.log("no reuse plan: this leg measures every mutant of its range");
      return 0;
    }
    const file = legFile(plan, module);
    if (!file) {
      if (expect > 0) { console.error(`::error title=${module}::the plan predicted ${expect} reused survivor(s) here and offers none: refused`); return 1; }
      console.log(`${module}: not reused (${plan.state === "full" ? plan.reason : plan.modules?.[module]?.reason ?? "not in the plan"}); every mutant of the range is measured`);
      return 0;
    }
    if (plan.env?.node !== process.version) {
      console.error(`::error title=${module}::the reuse plan was made under Node.js ${plan.env?.node} and this leg runs ${process.version}: refused`);
      return 1;
    }
    writeFileSync(out, JSON.stringify(file));
    console.log(`${module}: ${file.files[plan.modules[module].file].mutants.length} survivor(s) of ${plan.from.tag} offered to Stryker, which reuses those whose code did not change; every other mutant is measured`);
    return 0;
  }

  if (cmd === "trim") {
    const report = arg("report"), start = Number(arg("start")), end = Number(arg("end"));
    if (!report || !Number.isInteger(start) || !Number.isInteger(end) || end < start) { console.error("usage: mutation-reuse.mjs trim --report <f> --start <s> --end <e>"); return 2; }
    if (!existsSync(report)) { console.log(`no report at ${report}: nothing to trim (the ratchet will refuse this chunk)`); return 0; }
    const r = readJson(report);
    const t = trimReport(r, start, end);
    writeFileSync(report, JSON.stringify(r));
    console.log(`lines ${start}-${end}: ${t.kept} mutant(s) kept, ${t.reused} of them reused (${MARK}), ${t.dropped} outside the range dropped`);
    return 0;
  }

  if (cmd === "bundle") {
    const mergedDir = arg("merged"), answersDir = arg("answers"), planPath = arg("reuse-plan"), out = arg("out");
    if (!mergedDir || !answersDir || !out) { console.error("usage: mutation-reuse.mjs bundle --merged <dir> --answers <dir> --reuse-plan <f> --out <f>"); return 2; }
    const merged = new Map(find(mergedDir, (n) => n.endsWith("-merged.json")).map((f) => [basename(f).replace(/-merged\.json$/, ""), readJson(f)]));
    const answers = new Map(find(answersDir, (n) => n.endsWith("-answer.json")).map((f) => { const a = readJson(f); return [a.module, a]; }));
    let reusePlan = null;
    try { reusePlan = planPath ? readJson(planPath) : null; } catch { reusePlan = null; }
    try {
      const bundle = buildBundle({
        perimeter: perimeterOf(readJson(resolve(root, "stryker.config.json"))),
        merged, answers, reusePlan,
        version: readJson(resolve(root, "package.json")).version,
        commit: process.env.GITHUB_SHA ?? null,
        run: process.env.GITHUB_RUN_ID ?? null,
        event: process.env.GITHUB_EVENT_NAME ?? null,
      });
      writeFileSync(out, `${JSON.stringify(bundle)}\n`);
      const complete = Object.values(bundle.modules).filter((m) => m.complete);
      console.log(`${out}: ${complete.length} of ${Object.keys(bundle.modules).length} module(s) complete, ${complete.reduce((n, m) => n + m.survivors.length, 0)} survivor(s), generation ${bundle.generation}`);
      return 0;
    } catch (e) {
      console.error(`::warning title=no reuse bundle (ADR-0106)::${e.message}. The next release ratchet measures everything.`);
      return 1;
    }
  }

  console.error("usage: mutation-reuse.mjs <previous-tag|plan|leg|trim|bundle> …");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
