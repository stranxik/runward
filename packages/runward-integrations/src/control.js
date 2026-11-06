// The control of each recipe (runward ADR-0122 decision 1), run for real: the shipped example built by
// the runward under test, its dependencies installed from its lockfile, the recipe's own step (the CLI
// every forge calls), and the gate's own verdict read from `check --strict --json`.
//
// A recipe's control passes when, on fresh copies of the example:
//   1. the HEALTHY tree, after the recipe's step, is accepted: the step exits 0 and the gate exits 0;
//   2. the SABOTAGED tree, without the recipe, is accepted by the gate (built-in analyzers included):
//      this is what makes the recipe worth having, measured rather than assumed;
//   3. the SABOTAGED tree, after the recipe's step, is refused: the gate exits 1 and names each row and
//      pointer the manifest expects;
//   4. each other recipe's sabotage the manifest says this one does not catch is, after this recipe's
//      step, still accepted: what a recipe does not catch is a measured statement, not prose.
// Anything else fails the control, with the run that differed.
//
// The control runs the project's code (the example's tests and linter) and installs its dependencies
// from the network: it belongs in a CI job and on a machine that may do both, never in runward's verdict.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readManifests } from "./manifest.js";
import { plant } from "./sabotages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "cli.js");
const win = process.platform === "win32";
const npm = (args, cwd) => spawnSync(win ? "npm.cmd" : "npm", args, { cwd, encoding: "utf8", shell: win, timeout: 600_000 });

/** The runward of a repository checkout: dist/cli.js beside the package, when it is built. */
export function defaultRunward() {
  const p = resolve(HERE, "..", "..", "..", "dist", "cli.js");
  return existsSync(p) ? p : null;
}
/** The example's lockfile in runward's repository: `init --example` does not ship it. */
export function defaultLockfile(runward) {
  const p = resolve(dirname(runward), "..", "examples", "request-triage", "code", "package-lock.json");
  return existsSync(p) ? p : null;
}

const node = (args, cwd, env = {}) => spawnSync(process.execPath, args, {
  cwd, encoding: "utf8", timeout: 600_000, maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", ...env },
});

export function runwardVersion(runward) {
  const r = node([runward, "--version"], process.cwd());
  const v = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(r.stdout ?? "");
  if (r.status !== 0 || !v) throw new Error(`the runward at ${runward} does not answer --version (exit ${r.status}): ${(r.stderr ?? "").slice(0, 300)}`);
  return v[1];
}

/** The example as a laboratory tree: `init --example` by the runward under test, with its lockfile. */
export function buildFixture({ runward, lockfile, out }) {
  mkdirSync(out, { recursive: true });
  const init = node([runward, "--yes", "init", "--example"], out);
  if (init.status !== 0) throw new Error(`runward init --example failed (exit ${init.status}): ${(init.stdout + init.stderr).slice(-600)}`);
  cpSync(lockfile, join(out, "code", "package-lock.json"));
  return out;
}

/** The example's dependencies, installed once from its lockfile, install scripts off, where every copy of
 *  the fixture below `dir` resolves them (Node.js looks up the parent directories). */
export function installDependencies({ fixture, dir }) {
  cpSync(join(fixture, "code", "package.json"), join(dir, "package.json"));
  cpSync(join(fixture, "code", "package-lock.json"), join(dir, "package-lock.json"));
  const r = npm(["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"], dir);
  if (r.status !== 0) throw new Error(`the example's dependencies could not be installed from its lockfile (npm ci exit ${r.status}): ${((r.stdout ?? "") + (r.stderr ?? "")).slice(-600)}`);
}

/** The gate's verdict on a tree: exit code and the conformance refusals, from `check --strict --json`. */
export function gate(runward, tree) {
  const r = node([runward, "check", "--strict", "--json"], tree);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* reported below */ }
  if (!json) return { exit: r.status, refused: [], error: `check --strict --json printed no JSON (exit ${r.status}): ${(r.stdout + r.stderr).slice(-400)}` };
  const refused = (json.conformance ?? []).map((c) => ({ rule: c.rule, file: c.file, problem: c.problem }));
  const findings = (json.analysis?.findings ?? []).length;
  return { exit: r.status, refused, findings };
}

/** The recipe's step, through the very CLI every forge calls. */
export function step(manifest, tree) {
  const c = manifest.control.command;
  const r = node([CLI, "regenerate", "--recipe", manifest.id, "--cwd", join(tree, ...c.cwd.split("/")), "--report", c.report, "--command", JSON.stringify(c.argv)], tree);
  return { exit: r.status, output: `${r.stdout}${r.stderr}`.trim() };
}

const fresh = (healthy, base, name) => {
  const d = join(base, name);
  rmSync(d, { recursive: true, force: true });
  cpSync(healthy, d, { recursive: true });
  return d;
};

/**
 * Runs the controls. Returns the results document (format runward-integrations-control/0). Throws only
 * when the laboratory cannot be built; a recipe whose control fails is a result, with its reason.
 */
export function runControls({ runward = defaultRunward(), lockfile, recipes, work, keep = false, log = () => {} } = {}) {
  if (!runward || !existsSync(runward)) throw new Error("no runward to control against: build this repository (npm run build) or pass --runward <path to cli.js>");
  runward = resolve(runward);
  lockfile = lockfile ?? defaultLockfile(runward);
  if (!lockfile || !existsSync(lockfile)) throw new Error("the example's lockfile was not found: pass --lockfile <examples/request-triage/code/package-lock.json of runward's repository>");
  const manifests = readManifests().filter((m) => !recipes || recipes.includes(m.id));
  if (manifests.length === 0) throw new Error(`no recipe named ${JSON.stringify(recipes)}`);
  const all = readManifests();
  const root = work ? resolve(work) : realpathSync(mkdtempSync(join(tmpdir(), "runward-integrations-control-")));
  mkdirSync(root, { recursive: true });
  const cases = join(root, "cases");
  mkdirSync(cases, { recursive: true });
  const version = runwardVersion(runward);
  const results = {
    format: "runward-integrations-control/0", runward: version, node: process.version, os: process.platform,
    date: new Date().toISOString().slice(0, 10), recipes: [],
  };
  try {
    log(`runward ${version} (${runward}); the shipped example, its lockfile ${lockfile}`);
    const healthy = buildFixture({ runward, lockfile, out: join(cases, "healthy") });
    installDependencies({ fixture: healthy, dir: cases });
    const base = gate(runward, healthy);
    if (base.exit !== 0) throw new Error(`the fixture is not green before any recipe (gate exit ${base.exit}): the control cannot say anything about it`);

    const withoutCache = new Map();
    const sabotagedWithout = (id) => {
      if (!withoutCache.has(id)) {
        const t = fresh(healthy, cases, `${id}-sabotaged-without`);
        plant(id, t);
        withoutCache.set(id, gate(runward, t));
      }
      return withoutCache.get(id);
    };

    for (const m of manifests) {
      const runs = [];
      const record = (run) => { runs.push(run); log(`  ${run.ok ? "ok  " : "FAIL"} ${m.id}: ${run.case} — step ${run.step ?? "-"}, gate ${run.gate}${run.why ? ` (${run.why})` : ""}`); };
      try {
        // 1. healthy, with the recipe
        {
          const t = fresh(healthy, cases, `${m.id}-healthy-with`);
          const s = step(m, t);
          const g = gate(runward, t);
          const ok = s.exit === m.control.expect.healthy && g.exit === m.control.expect.healthy;
          record({ case: "healthy tree, with the recipe", step: s.exit, gate: g.exit, expected: m.control.expect.healthy, ok,
            ...(ok ? {} : { why: s.exit !== 0 ? `the step exited ${s.exit}: ${s.output.slice(-300)}` : `the gate refused: ${g.error ?? g.refused.map((x) => x.rule).join(", ")}` }) });
        }
        // 2. sabotaged, without the recipe
        {
          const g = sabotagedWithout(m.id);
          const ok = g.exit === m.control.expect.withoutRecipe;
          record({ case: "sabotaged tree, without the recipe", gate: g.exit, expected: m.control.expect.withoutRecipe, ok,
            ...(ok ? {} : { why: `the gate already refuses the sabotage without the recipe (${g.error ?? g.refused.map((x) => x.rule).join(", ")}${g.findings ? `; ${g.findings} analyzer finding(s)` : ""}): this control no longer shows the recipe is needed` }) });
        }
        // 3. sabotaged, with the recipe
        {
          const t = fresh(healthy, cases, `${m.id}-sabotaged-with`);
          plant(m.id, t);
          const s = step(m, t);
          const g = gate(runward, t);
          const want = m.control.expect.withRecipe;
          const missing = want.refuses.filter((x) => !g.refused.some((r) => r.rule === x.rule && r.file === x.file && r.problem.includes(x.pointer)));
          const ok = g.exit === want.exit && missing.length === 0;
          record({ case: "sabotaged tree, with the recipe", step: s.exit, gate: g.exit, expected: want.exit, ok,
            refused: g.refused.map((r) => `${r.file} ${r.rule}`),
            ...(ok ? {} : { why: g.exit !== want.exit ? `the gate exited ${g.exit}${g.error ? `: ${g.error}` : ""}` : `not refused as expected: ${missing.map((x) => `${x.rule} in ${x.file}`).join(", ")}` }) });
        }
        // 4. what this recipe does not catch
        for (const d of m.control.doesNotCatch) {
          if (!all.some((o) => o.id === d.sabotage)) { record({ case: `${d.sabotage}'s sabotage, with this recipe`, gate: null, expected: 0, ok: false, why: `no recipe ${d.sabotage}` }); continue; }
          const t = fresh(healthy, cases, `${m.id}-on-${d.sabotage}`);
          plant(d.sabotage, t);
          const s = step(m, t);
          const g = gate(runward, t);
          const ok = g.exit === 0;
          record({ case: `${d.sabotage}'s sabotage, with this recipe (not caught)`, step: s.exit, gate: g.exit, expected: 0, ok,
            ...(ok ? {} : { why: `the manifest says ${m.id} does not catch ${d.sabotage}'s sabotage, and with it the gate exited ${g.exit}: correct the manifest` }) });
        }
      } catch (e) {
        record({ case: "the control could not run", gate: null, expected: null, ok: false, why: e.message });
      }
      const failed = runs.filter((r) => !r.ok);
      results.recipes.push({ id: m.id, passed: failed.length === 0, ...(failed.length ? { reason: failed.map((r) => `${r.case}: ${r.why}`).join("; ") } : {}), runs });
    }
  } finally {
    if (!keep && !work) rmSync(root, { recursive: true, force: true });
  }
  return results;
}

/** Writes the date and the runward version of this passing control into each passing recipe's manifest. */
export function recordPassing(results, { manifestPath }) {
  const written = [];
  for (const r of results.recipes) {
    if (!r.passed) continue;
    const p = manifestPath(r.id);
    const doc = JSON.parse(readFileSync(p, "utf8"));
    doc.maintainer.lastPassingControl = { date: results.date, runward: results.runward };
    writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
    written.push(r.id);
  }
  return written;
}
