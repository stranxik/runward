#!/usr/bin/env node
// The runner of runward's qualification kit (ADR-0087, decision 1).
//
//   node run.mjs --package <path to the installed runward> [--out <dir>] [--work <dir>] [--jobs <n>]
//
// It runs the tests the requirements document cites against YOUR installation of runward and writes
// what happened: `qualification-report.json` and `junit.xml`. It records results; it determines no
// tool class, no level and no outcome of any assessment. That determination is yours, in your
// context of use (README.md, first paragraph).
//
// What it does, in order, and where it stops:
//   1. It checks the kit's own files against `kit-manifest.json` (exit 3 on a difference).
//   2. It refuses an installation whose package.json is not runward at the kit's version (exit 2).
//   3. It compares the SHA-256 of every file of the installation with the list of the attested npm
//      tarball the manifest carries. On any difference it writes the comparison and NO test result,
//      and exits 3: results measured on other bytes would describe something the kit never saw.
//   4. It builds a work directory: the kit's tests copied under `test/`, the installation's top-level
//      entries linked beside them (directories) or copied (files), and the installation's runtime
//      dependencies linked under `node_modules/` where Node finds them from the installation. The
//      tests find `dist/` where they expect it, and nothing is ever written into the installation;
//      step 7 checks that.
//   5. It runs every cited unit file with `node --test`, then `test/smoke.js` with its one `js-yaml`
//      check skipped and reported as skipped (ADR-0087, decision 3), then the attack corpus.
//   6. It joins the results to the requirements: per requirement, the cited test, its kind
//      (`interface`, `internal`, `static`, derived by the kit builder from the test source), the
//      result and the duration. A case that needs the repository's source tree, or imports a package
//      that is neither a Node built-in nor a runtime dependency of runward (a development dependency
//      the kit does not carry), is `not-run-here`, with a pointer to the release's committed
//      reports/junit.xml, and is never counted as passed. The builder derived both from the tests'
//      source and import graph.
//   7. It compares the installation's digests again, after the run.
//
// Exit codes: 0 every case that runs here passed; 1 at least one failed; 2 usage error or a
// different installed version; 3 the installation or the kit differs from the manifest.
//
// The report is unsigned (ADR-0087, decision 7): runward holds no key. If your process needs it
// signed, sign it with your own identity.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync,
  symlinkSync, copyFileSync, rmSync, realpathSync,
} from "node:fs";
import { tmpdir, availableParallelism, type as osType, release as osRelease } from "node:os";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = dirname(fileURLToPath(import.meta.url));
const EXIT = { ok: 0, failed: 1, usage: 2, mismatch: 3 };
export const SMOKE_SKIP_LABEL = "the phase SKILL.md frontmatter parses as strict YAML (js-yaml)";
const SMOKE_SKIP_REASON = "js-yaml is a development dependency of runward, not part of the kit (ADR-0087, decision 3)";

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { package: null, out: null, work: null, jobs: Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2))) };
  const keys = { "--package": "package", "--out": "out", "--work": "work", "--jobs": "jobs" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help" || argv[i] === "-h") throw new UsageError("");
    const k = keys[argv[i]];
    if (!k || i + 1 >= argv.length) throw new UsageError(`unknown or incomplete argument: ${argv[i]}`);
    opts[k] = argv[++i];
  }
  if (!opts.package) throw new UsageError("--package <path to the installed runward> is required");
  opts.jobs = Number(opts.jobs);
  if (!Number.isInteger(opts.jobs) || opts.jobs < 1) throw new UsageError("--jobs takes a positive integer");
  return opts;
}

const USAGE = "usage: node run.mjs --package <path to the installed runward, e.g. node_modules/runward> [--out <dir>] [--work <dir>] [--jobs <n>]";

const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** Every regular file under `dir`, relative, with "/" separators; `node_modules` is not walked. */
function listFiles(dir) {
  const out = [];
  const walkDir = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" || d !== dir) walkDir(p); continue; }
      if (e.isFile() || e.isSymbolicLink()) out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walkDir(dir);
  return out.sort();
}

/** The installation against the manifest's tarball list: { result, compared, changed, missing, extra }. */
export function compareInstallation(pkgDir, files) {
  const changed = [], missing = [];
  for (const f of files) {
    const p = join(pkgDir, ...f.path.split("/"));
    if (!existsSync(p)) { missing.push(f.path); continue; }
    const got = sha256File(p);
    if (got !== f.sha256) changed.push({ path: f.path, expected: f.sha256, found: got });
  }
  const known = new Set(files.map((f) => f.path));
  const extra = listFiles(pkgDir).filter((p) => !known.has(p));
  const result = changed.length || missing.length || extra.length ? "mismatch" : "match";
  return { result, compared: files.length, changed, missing, extra };
}

/** The kit's own files against the manifest. */
export function checkKit(kitDir, manifest) {
  const mismatches = [];
  for (const f of manifest.files) {
    const p = join(kitDir, ...f.path.split("/"));
    if (!existsSync(p)) mismatches.push({ path: f.path, problem: "missing" });
    else if (sha256File(p) !== f.sha256) mismatches.push({ path: f.path, problem: "changed" });
  }
  return { result: mismatches.length ? "mismatch" : "match", checked: manifest.files.length, mismatches };
}

/**
 * smoke.js imports `js-yaml` for one check and cannot start without it. The kit carries smoke.js
 * unchanged; the work copy replaces exactly that check (the import line and the loop that follows
 * it) with a line saying it was skipped. Returns { text, skipped }; throws when the file holds the
 * import in a shape this replacement does not recognise, rather than running a half-edited test.
 */
export function withoutYamlCheck(text) {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.includes('await import("js-yaml")'));
  if (at < 0) {
    if (text.includes("js-yaml")) throw new Error("test/smoke.js uses js-yaml in a shape the runner does not recognise");
    return { text, skipped: false };
  }
  const loop = lines[at + 1] ?? "";
  const indent = loop.slice(0, loop.length - loop.trimStart().length);
  if (!loop.trimStart().startsWith("for (")) throw new Error("test/smoke.js: the js-yaml import is not followed by the loop the runner expects");
  const end = lines.findIndex((l, i) => i > at + 1 && l === `${indent}}`);
  if (end < 0) throw new Error("test/smoke.js: the end of the js-yaml loop was not found");
  const replaced = [...lines.slice(0, at), `${indent}console.log("  skip  ${SMOKE_SKIP_LABEL}: not run by the kit");`, ...lines.slice(end + 1)];
  const out = replaced.join("\n");
  if (out.includes('import("js-yaml")') || /from\s+["']js-yaml["']/.test(out)) throw new Error("test/smoke.js imports js-yaml more than once");
  return { text: out, skipped: true };
}

/** Test cases of a Node junit report: [{ name, time, status, message }]. Names decoded until stable. */
export function parseJunit(xml) {
  const decode = (s) => {
    for (let prev = null; prev !== s;) {
      prev = s;
      s = s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    }
    return s;
  };
  const out = [];
  const re = /<testcase\b([^>]*?)(\/>|>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const name = decode((attrs.match(/\bname="([^"]*)"/) ?? [])[1] ?? "");
    const time = Number((attrs.match(/\btime="([^"]*)"/) ?? [])[1] ?? 0);
    let status = "pass", message = null;
    if (m[2] === ">") {
      const close = xml.indexOf("</testcase>", re.lastIndex);
      const body = xml.slice(re.lastIndex, close < 0 ? xml.length : close);
      const f = body.match(/<failure\b[^>]*?message="([^"]*)"/);
      const s = body.match(/<skipped\b[^>]*?message="([^"]*)"/);
      if (/<failure\b/.test(body)) { status = "fail"; message = f ? decode(f[1]) : null; }
      else if (/<skipped\b/.test(body)) { status = "skipped"; message = s ? decode(s[1]) : null; }
      re.lastIndex = close < 0 ? xml.length : close;
    }
    out.push({ name, time, status, message });
  }
  return out;
}

function run(cmd, args, { cwd, env }) {
  return new Promise((done) => {
    const started = process.hrtime.bigint();
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (e) => done({ code: null, stdout, stderr: `${stderr}${e.message}`, ms: 0 }));
    child.on("close", (code) => done({ code, stdout, stderr, ms: Number(process.hrtime.bigint() - started) / 1e6 }));
  });
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
  }));
  return results;
}

function toolVersion(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch { return null; }
}

/**
 * Where Node finds `name` for a module of the installation: `<dir>/node_modules/<name>` for the
 * installation's real directory and each of its ancestors that is not itself a `node_modules`.
 */
export function findDependency(pkgDir, name) {
  let dir = realpathSync(pkgDir);
  for (;;) {
    if (!dir.endsWith(`${sep}node_modules`)) {
      const p = join(dir, "node_modules", ...name.split("/"));
      if (existsSync(join(p, "package.json"))) return realpathSync(p);
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** The work directory: tests copied, the installation's top-level entries linked or copied, and its
 *  runtime dependencies linked under node_modules/, so a test that imports one finds the installed one. */
function buildWorkDir(work, pkgDir, manifest, dependencies) {
  mkdirSync(work, { recursive: true });
  const top = [...new Set(manifest.package.files.map((f) => f.path.split("/")[0]))].sort();
  for (const name of top) {
    const src = join(pkgDir, name);
    if (!existsSync(src)) continue;
    if (statSync(src).isDirectory()) symlinkSync(src, join(work, name), process.platform === "win32" ? "junction" : "dir");
    else copyFileSync(src, join(work, name));
  }
  const copyTree = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const e of readdirSync(from, { withFileTypes: true })) {
      if (e.isDirectory()) copyTree(join(from, e.name), join(to, e.name));
      else copyFileSync(join(from, e.name), join(to, e.name));
    }
  };
  copyTree(join(KIT, "tests"), join(work, "test"));
  for (const name of dependencies) {
    const found = findDependency(pkgDir, name);
    if (!found) continue; // an incomplete installation: a test importing it fails, as it should
    const link = join(work, "node_modules", ...name.split("/"));
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(found, link, process.platform === "win32" ? "junction" : "dir");
  }
}

/** Why a case does not run here, in the report's words. */
export function notRunHereDetail(c, manifest) {
  const dev = new Set(manifest.devDependencies ?? []);
  const why = [];
  if (c.needs?.length) why.push(`reads ${c.needs.join(", ")} from the source tree, which an installation does not have`);
  for (const p of c.needsPackages ?? []) {
    why.push(dev.has(p) ? `needs the dev dependency ${p}, which the kit does not carry`
      : `needs the package ${p}, which is not a runtime dependency of runward`);
  }
  return `${why.join("; ")}; the release's run is recorded in ${manifest.junitPointer}`;
}

const xmlEscape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderJunit(report) {
  const cases = report.requirements ?? [];
  const count = (r) => cases.filter((c) => c.result === r).length;
  const skippedChecks = report.skipped ?? [];
  const lines = ['<?xml version="1.0" encoding="utf-8"?>',
    `<testsuites name="runward ${xmlEscape(report.kit.version)} qualification kit run" tests="${cases.length + skippedChecks.length}" failures="${count("fail")}" skipped="${count("skipped") + count("not-run-here") + skippedChecks.length}">`,
    `\t<testsuite name="requirements" tests="${cases.length}" failures="${count("fail")}" skipped="${count("skipped") + count("not-run-here")}">`,
    "\t\t<properties>",
    ...Object.entries(report.environment).map(([k, v]) => `\t\t\t<property name="${xmlEscape(k)}" value="${xmlEscape(v ?? "")}"/>`),
    `\t\t\t<property name="digest" value="${xmlEscape(report.digest.result)}"/>`,
    "\t\t</properties>"];
  for (const c of cases) {
    const name = `${c.tor} [${c.kind}] ${c.case ?? `${c.file} (whole file)`}`;
    const head = `\t\t<testcase name="${xmlEscape(name)}" classname="${xmlEscape(c.file)}" time="${((c.durationMs ?? 0) / 1000).toFixed(3)}"`;
    if (c.result === "pass") lines.push(`${head}/>`);
    else if (c.result === "fail") lines.push(`${head}>`, `\t\t\t<failure message="${xmlEscape(c.detail ?? "failed")}"/>`, "\t\t</testcase>");
    else lines.push(`${head}>`, `\t\t\t<skipped message="${xmlEscape(c.result === "not-run-here" ? `not-run-here: ${c.detail}` : c.detail ?? "skipped")}"/>`, "\t\t</testcase>");
  }
  lines.push("\t</testsuite>");
  if (skippedChecks.length) {
    lines.push(`\t<testsuite name="skipped checks" tests="${skippedChecks.length}" failures="0" skipped="${skippedChecks.length}">`);
    for (const s of skippedChecks) lines.push(`\t\t<testcase name="${xmlEscape(s.check)}" classname="${xmlEscape(s.suite)}" time="0">`, `\t\t\t<skipped message="${xmlEscape(s.reason)}"/>`, "\t\t</testcase>");
    lines.push("\t</testsuite>");
  }
  if (report.corpus) {
    const c = report.corpus;
    lines.push(`\t<testsuite name="attack corpus" tests="1" failures="${c.result === "pass" ? 0 : 1}" skipped="0">`,
      `\t\t<testcase name="${xmlEscape(`test/audit-corpus.js: ${c.summary}`)}" classname="test/audit-corpus.js" time="${((c.durationMs ?? 0) / 1000).toFixed(3)}"${c.result === "pass" ? "/>" : `>\n\t\t\t<failure message="${xmlEscape(c.summary)}"/>\n\t\t</testcase>`}`,
      "\t</testsuite>");
  }
  lines.push("</testsuites>", "");
  return lines.join("\n");
}

export async function main(argv, { log = console.log, err = console.error } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { err(e.message ? `${e.message}\n${USAGE}` : USAGE); return EXIT.usage; }

  const manifest = JSON.parse(readFileSync(join(KIT, "kit-manifest.json"), "utf8"));
  const version = manifest.version;
  const pkgDir = resolve(opts.package);
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) { err(`no package.json in ${pkgDir}: point --package at the installed runward directory (for example node_modules/runward)`); return EXIT.usage; }
  let installed;
  try { installed = JSON.parse(readFileSync(pkgJsonPath, "utf8")); } catch { err(`${pkgJsonPath} is not JSON`); return EXIT.usage; }
  if (installed.name !== "runward" || installed.version !== version) {
    err(`this kit is for runward ${version}; ${pkgDir} holds ${installed.name}@${installed.version}. Refused: a kit runs only against its own version (download the kit of the version you installed).`);
    return EXIT.usage;
  }

  const out = resolve(opts.out ?? `runward-kit-report-${version}`);
  mkdirSync(out, { recursive: true });
  const environment = {
    runward: installed.version,
    node: process.version,
    os: `${osType()} ${osRelease()}`,
    platform: process.platform,
    arch: process.arch,
    git: toolVersion("git", ["--version"]),
  };
  const base = {
    report: "runward qualification kit run",
    schemaVersion: 1,
    statement: "What the kit's tests did on this installation. It determines no tool class, level or assessment outcome: that determination is the user's, in their context of use.",
    signed: false,
    signature: "none: runward holds no key (ADR-0087, decision 7); sign this file with your own identity if your process needs it",
    kit: { version, sourceCommit: manifest.sourceCommit, manifestSha256: sha256File(join(KIT, "kit-manifest.json")) },
    environment,
    package: { dir: pkgDir, tarballSha256: manifest.package.tarball.sha256 },
  };
  const write = (report) => {
    writeFileSync(join(out, "qualification-report.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(out, "junit.xml"), renderJunit(report));
  };

  const kitIntegrity = checkKit(KIT, manifest);
  const digest = compareInstallation(pkgDir, manifest.package.files);
  if (kitIntegrity.result !== "match" || digest.result !== "match") {
    write({ ...base, kitIntegrity, digest, results: "withheld: the kit or the installation differs from the manifest, so no test result is recorded", requirements: [], skipped: [] });
    if (kitIntegrity.result !== "match") err(`the kit's own files differ from kit-manifest.json (${kitIntegrity.mismatches.length}): re-extract the attested kit`);
    if (digest.result !== "match") {
      err(`the installation differs from the attested tarball: ${digest.changed.length} changed, ${digest.missing.length} missing, ${digest.extra.length} extra`);
      for (const c of digest.changed.slice(0, 10)) err(`  changed  ${c.path}`);
      for (const p of digest.missing.slice(0, 10)) err(`  missing  ${p}`);
      for (const p of digest.extra.slice(0, 10)) err(`  extra    ${p}`);
    }
    err(`no test was run; the comparison is in ${join(out, "qualification-report.json")}`);
    return EXIT.mismatch;
  }
  log(`runward ${version} at ${pkgDir}: ${digest.compared} files match the attested tarball (sha256 ${manifest.package.tarball.sha256.slice(0, 12)}…)`);

  const work = opts.work ? resolve(opts.work) : mkdtempSync(join(realpathSync(tmpdir()), "rw-kit-work-"));
  const env = { ...process.env, NO_COLOR: "1" };
  delete env.NODE_TEST_CONTEXT;
  const raw = join(out, "raw");
  mkdirSync(raw, { recursive: true });
  try {
    buildWorkDir(work, pkgDir, manifest, Object.keys(installed.dependencies ?? {}));
    const skipped = [];
    const smokePath = join(work, "test", "smoke.js");
    let smokeSetup = null;
    if (existsSync(smokePath)) {
      try {
        const r = withoutYamlCheck(readFileSync(smokePath, "utf8"));
        writeFileSync(smokePath, r.text);
        if (r.skipped) skipped.push({ suite: "test/smoke.js", check: SMOKE_SKIP_LABEL, result: "skipped", reason: SMOKE_SKIP_REASON });
      } catch (e) { smokeSetup = e.message; }
    }

    // Unit files: every cited file under test/, once each.
    const unitFiles = [...new Set(manifest.cases.map((c) => c.file))].filter((f) => f.startsWith("test/unit/") && existsSync(join(work, f))).sort();
    log(`running ${unitFiles.length} cited test files (${opts.jobs} at a time)…`);
    const unit = new Map();
    await pool(unitFiles, opts.jobs, async (f) => {
      const dest = join(raw, `${f.split("/").pop()}.junit.xml`);
      const r = await run(process.execPath, ["--test", "--test-reporter=junit", `--test-reporter-destination=${dest}`, f], { cwd: work, env });
      const cases = existsSync(dest) ? parseJunit(readFileSync(dest, "utf8")) : [];
      unit.set(f, { file: f, exitCode: r.code, durationMs: Math.round(r.ms), cases });
    });

    let smoke = null;
    if (existsSync(smokePath) && !smokeSetup) {
      log("running test/smoke.js…");
      const r = await run(process.execPath, ["test/smoke.js"], { cwd: work, env });
      writeFileSync(join(raw, "smoke.log"), r.stdout + r.stderr);
      smoke = { exitCode: r.code, durationMs: Math.round(r.ms) };
    }

    let corpus = null;
    if (existsSync(join(work, "test", "audit-corpus.js"))) {
      log("running the attack corpus…");
      const jsonFile = join(out, "attack-corpus.json");
      rmSync(jsonFile, { force: true });
      const r = await run(process.execPath, ["test/audit-corpus.js", "--cli", join(work, "dist", "cli.js"), "--json", jsonFile], { cwd: work, env });
      writeFileSync(join(raw, "attack-corpus.log"), r.stdout + r.stderr);
      const json = existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, "utf8")) : null;
      const m = (r.stdout + r.stderr).match(/(\d+)\/(\d+) as expected/);
      const summary = json?.totals ? `${json.totals.pass}/${json.totals.cases} as expected (REFUSE ${json.totals.REFUSE.pass}/${json.totals.REFUSE.cases}, ACCEPT ${json.totals.ACCEPT.pass}/${json.totals.ACCEPT.cases})`
        : m ? `${m[1]}/${m[2]} as expected` : `exit ${r.code}, no total printed`;
      corpus = {
        result: r.code === 0 ? "pass" : "fail", exitCode: r.code, durationMs: Math.round(r.ms), summary,
        json: json ? "attack-corpus.json" : null,
        measures: json?.measures ?? "regression on a fixed set of known vectors, each a defect found and closed; not a detection rate on unknown ones",
      };
    }

    const requirements = manifest.cases.map((c) => {
      const row = { tor: c.tor, file: c.file, case: c.case, note: c.note, kind: c.kind };
      if (!c.runsHere) {
        return { ...row, result: "not-run-here", durationMs: null, detail: notRunHereDetail(c, manifest), pointer: manifest.junitPointer };
      }
      if (c.file === "test/smoke.js") {
        if (!smoke) return { ...row, result: "fail", durationMs: null, detail: smokeSetup ?? "test/smoke.js did not run" };
        return { ...row, result: smoke.exitCode === 0 ? "pass" : "fail", durationMs: smoke.durationMs,
          detail: smoke.exitCode === 0 ? "test/smoke.js exited 0" : `test/smoke.js exited ${smoke.exitCode}; see raw/smoke.log` };
      }
      const u = unit.get(c.file);
      if (!u) return { ...row, result: "fail", durationMs: null, detail: `${c.file} is not in the kit` };
      if (c.case === null) {
        const failed = u.cases.filter((t) => t.status === "fail");
        return { ...row, result: u.exitCode === 0 && u.cases.length > 0 ? "pass" : "fail", durationMs: u.durationMs,
          detail: u.exitCode === 0 ? `whole file: ${u.cases.length} cases, exit 0` : `whole file: exit ${u.exitCode}, ${failed.length} failed` };
      }
      const hits = u.cases.filter((t) => t.name === c.case);
      if (!hits.length) return { ...row, result: "fail", durationMs: null, detail: `the case did not run (file exit ${u.exitCode})` };
      const ms = Math.round(hits.reduce((s, t) => s + t.time * 1000, 0));
      const bad = hits.find((t) => t.status === "fail");
      if (bad) return { ...row, result: "fail", durationMs: ms, detail: bad.message ?? "failed" };
      const skip = hits.find((t) => t.status === "skipped");
      if (skip) return { ...row, result: "skipped", durationMs: ms, detail: `the test skipped itself: ${skip.message ?? "no reason given"}` };
      return { ...row, result: "pass", durationMs: ms, detail: null };
    });

    const after = compareInstallation(pkgDir, manifest.package.files);
    const count = (pred) => requirements.filter(pred).length;
    const kinds = {};
    for (const k of ["interface", "internal", "static"]) {
      kinds[k] = { cases: count((r) => r.kind === k), pass: count((r) => r.kind === k && r.result === "pass"),
        fail: count((r) => r.kind === k && r.result === "fail"), notRunHere: count((r) => r.kind === k && r.result === "not-run-here") };
    }
    const totals = {
      requirements: new Set(requirements.map((r) => r.tor)).size,
      citations: requirements.length,
      pass: count((r) => r.result === "pass"),
      fail: count((r) => r.result === "fail"),
      skipped: count((r) => r.result === "skipped"),
      notRunHere: count((r) => r.result === "not-run-here"),
      byKind: kinds,
    };
    const report = {
      ...base, kitIntegrity, digest: { ...digest, afterRun: { result: after.result, changed: after.changed, missing: after.missing, extra: after.extra } },
      totals, requirements, skipped, corpus,
      suites: { unit: [...unit.values()].sort((a, b) => (a.file < b.file ? -1 : 1)).map(({ cases, ...u }) => ({ ...u,
        tests: cases.length, pass: cases.filter((t) => t.status === "pass").length, fail: cases.filter((t) => t.status === "fail").length,
        skipped: cases.filter((t) => t.status === "skipped").length })), smoke },
    };
    write(report);

    log("");
    log(`${totals.citations} cited cases for ${totals.requirements} requirements: ${totals.pass} pass, ${totals.fail} fail, ${totals.skipped} skipped by the test itself, ${totals.notRunHere} not-run-here (need the source tree or a package the kit does not carry)`);
    log(`  by kind: ${["interface", "internal", "static"].map((k) => `${k} ${kinds[k].pass}/${kinds[k].cases - kinds[k].notRunHere}`).join(", ")} (passed / run here)`);
    for (const s of skipped) log(`  skipped: ${s.suite}, ${s.check}`);
    if (corpus) log(`  attack corpus: ${corpus.summary}`);
    log(`  installation after the run: ${after.result === "match" ? "unchanged" : "CHANGED, see digest.afterRun"}`);
    for (const r of requirements.filter((x) => x.result === "fail")) log(`  FAIL ${r.tor} ${r.file} :: ${r.case ?? "(whole file)"}\n       ${String(r.detail).split("\n")[0].slice(0, 200)}`);
    log(`\nreport: ${join(out, "qualification-report.json")} and ${join(out, "junit.xml")} (unsigned)`);
    log("This records test results on this installation. It does not determine a tool class, a level or an assessment outcome.");
    const failed = totals.fail > 0 || (corpus && corpus.result !== "pass") || after.result !== "match";
    return failed ? EXIT.failed : EXIT.ok;
  } finally {
    if (!opts.work) rmSync(work, { recursive: true, force: true });
  }
}

const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) process.exitCode = await main(process.argv.slice(2));
