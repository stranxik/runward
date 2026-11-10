// runward-integrations' recipes, held to what their manifests say (runward ADR-0122 decisions 1, 2 and 5):
//   - every manifest validates against schema/recipe-manifest.schema.json, and the schema refuses the
//     planted manifests a careless edit would produce (a recipe with no maintainer, a step pinned to a
//     branch, a control that expects nothing refused): it is not a schema that accepts anything;
//   - the order is ADR-0122's: SARIF, JUnit, LCOV;
//   - each row's citable form is the one `runward explain` prints for its nature, character for character;
//   - each step exists for GitHub Actions and GitLab CI, calls the package's CLI for its own recipe, and
//     passes its inputs through the environment, never into a script;
//   - the command each control runs is the one the samples give the steps, and each recipe's runward-run
//     leg is one runward-run accepts; for JUnit and LCOV it is the sample run policy's own leg;
//   - the package ships at runward's version, MIT, private to npm, with no dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv from "ajv";
import { load as loadYaml } from "js-yaml";
import { ROOT, CLI, runModule } from "../support/run-lab.js";

const PKG = join(ROOT, "packages", "runward-integrations");
const mod = (f) => import(pathToFileURL(join(PKG, "src", f)).href);
const { readManifests, ORDER } = await mod("manifest.js");
const { SABOTAGES } = await mod("sabotages.js");
const manifests = readManifests();
const schema = JSON.parse(readFileSync(join(PKG, "schema", "recipe-manifest.schema.json"), "utf8"));
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
const raw = (id) => JSON.parse(readFileSync(join(PKG, "recipes", id, "manifest.json"), "utf8"));

test("three recipes, in ADR-0122's order (SARIF, JUnit, LCOV), each manifest valid against the schema", () => {
  assert.deepEqual(manifests.map((m) => m.id), ORDER);
  assert.deepEqual(manifests.map((m) => m.report.format), ["SARIF 2.1.0", "JUnit XML", "LCOV"]);
  for (const m of manifests) assert.ok(validate(raw(m.id)), `${m.id}: ${JSON.stringify(validate.errors)}`);
});

test("positive controls: the schema refuses what a careless manifest would say", () => {
  const base = raw("junit");
  const planted = [
    ["no maintainer", (m) => { delete m.maintainer; }],
    ["an unnamed maintainer", (m) => { m.maintainer.name = ""; }],
    ["a nature runward cannot require", (m) => { m.rows[0].nature = "pytest"; }],
    ["a step pinned to a branch", (m) => { m.steps.github.uses += "@main"; }],
    ["a control that expects no refusal", (m) => { m.control.expect.withRecipe.refuses = []; }],
    ["a control whose sabotage passes nothing without the recipe", (m) => { m.control.expect.withoutRecipe = 1; }],
    ["a command with no {raw}", (m) => { m.control.command.argv = ["npm", "test"]; }],
    ["a level other than declared for a CI step", (m) => { m.level.ciStep = "attested"; }],
    ["a last passing control without its version", (m) => { m.maintainer.lastPassingControl = { date: "2026-11-06" }; }],
    ["an unknown field", (m) => { m.certifiedBy = "x"; }],
    ["a runward-run leg that writes no recipe's report", (m) => { m.runwardRun.leg.leg = "mutation"; }],
  ];
  for (const [what, change] of planted) {
    const m = structuredClone(base);
    change(m);
    assert.equal(validate(m), false, `the schema accepts ${what}`);
  }
});

test("each recipe names its maintainer, and the reader refuses a manifest without one", async () => {
  const { readManifest } = await mod("manifest.js");
  for (const m of manifests) assert.equal(m.maintainer.name, "stranxik");
  const d = realpathSync(mkdtempSync(join(tmpdir(), "rwi-manifest-")));
  try {
    const m = raw("junit");
    m.maintainer.name = "";
    writeFileSync(join(d, "manifest.json"), JSON.stringify(m));
    assert.throws(() => readManifest(join(d, "manifest.json"), "junit"), /a recipe without a named maintainer is not shipped/);
    assert.throws(() => readManifest(join(PKG, "recipes", "junit", "manifest.json"), "sarif"), /is not its directory's name/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("each row's citable form is the one `runward explain` prints for its nature, verbatim", () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "rwi-explain-")));
  try {
    execFileSync(process.execPath, [CLI, "--yes", "init", "--example"], { cwd: d, stdio: "pipe" });
    // No shipped rule requires coverage: a rule of the mission's own does, as an adopter's would.
    writeFileSync(join(d, "runward", "rules", "x-coverage-probe.md"),
      "---\ntitle: The Guard Runs Under the Tests\nrequires: coverage\nimpact: LOW\nphases: [floor]\nnoAsi: a probe of explain\nnoTerritory: a probe\n---\n\n## The Guard Runs Under the Tests\n\nA probe.\n");
    const ruleFor = { junit: "frontier-deterministic-boundary", sarif: "config-secrets-boundary", coverage: "x-coverage-probe" };
    for (const m of manifests) {
      for (const row of m.rows) {
        const out = execFileSync(process.execPath, [CLI, "explain", ruleFor[row.nature], "-p", d], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
        assert.match(out, new RegExp(`Requires\\s+${row.nature}\\b`), `${row.nature}: the probed rule requires it`);
        const printed = /e\.g\. (.+)$/m.exec(out)?.[1].trim();
        assert.equal(row.citable, printed, `${m.id}: the manifest's citable form is what explain prints`);
      }
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("each row's pointer on the example is one the example's manifests cite", () => {
  const text = ["floor.md", "architecture.md", "governance/threat-model.md"].map((f) => readFileSync(join(ROOT, "examples", "request-triage", "runward", f), "utf8")).join("\n");
  for (const m of manifests) {
    for (const row of m.rows) assert.ok(text.includes(row.onTheExample), `${m.id}: ${row.onTheExample} is cited by the example`);
    for (const r of m.control.expect.withRecipe.refuses) {
      const f = readFileSync(join(ROOT, "examples", "request-triage", r.file), "utf8");
      assert.ok(f.split("\n").some((l) => l.startsWith(`| ${r.rule} |`) && l.includes(r.pointer)), `${m.id}: ${r.rule} in ${r.file} cites ${r.pointer}`);
    }
  }
});

test("GitHub: each step is a composite action calling the package's CLI for its own recipe, its inputs through the environment", () => {
  for (const m of manifests) {
    const file = join(PKG, m.steps.github.action);
    const action = loadYaml(readFileSync(file, "utf8"));
    assert.equal(action.runs.using, "composite", m.id);
    assert.deepEqual(Object.keys(action.inputs).sort(), ["command", "report", "working-directory"]);
    assert.equal(action.runs.steps.length, 1);
    const s = action.runs.steps[0];
    assert.equal(s.shell, "bash");
    assert.doesNotMatch(s.run, /\$\{\{/, `${m.id}: no input is interpolated into the script (CWE-78)`);
    assert.equal(s.run.trim(), `node "$GITHUB_ACTION_PATH/../../../src/cli.js" regenerate --recipe ${m.id} --cwd "$RWI_CWD" --report "$RWI_REPORT" --command "$RWI_COMMAND" --github-output "$GITHUB_OUTPUT" --summary "$GITHUB_STEP_SUMMARY"`);
    assert.deepEqual(s.env, { RWI_CWD: "${{ inputs.working-directory }}", RWI_REPORT: "${{ inputs.report }}", RWI_COMMAND: "${{ inputs.command }}" });
    assert.equal(join(file, "..", "..", "..", "..", "src", "cli.js"), join(PKG, "src", "cli.js"), "the action reaches the CLI of the package it ships in");
    assert.match(m.steps.github.uses, new RegExp(`^stranxik/runward/packages/runward-integrations/recipes/${m.id}/github$`));
    assert.match(readFileSync(file, "utf8"), new RegExp(`uses: stranxik/runward/packages/runward-integrations/recipes/${m.id}/github@<40-character commit>`), "the file says how it is pinned");
  }
});

test("GitLab: each step is the hidden job the manifest names, the package fetched by a pinned sha256, then the CLI for its recipe", () => {
  for (const m of manifests) {
    const doc = loadYaml(readFileSync(join(PKG, m.steps.gitlab.template), "utf8"));
    assert.deepEqual(Object.keys(doc), [m.steps.gitlab.extends], `${m.id}: one hidden job, the one the manifest names`);
    const job = doc[m.steps.gitlab.extends];
    assert.equal(job.variables.RWI_RECIPE, m.id);
    assert.equal(job.artifacts.when, "always", "the regenerated report is kept red or green, for the gate job");
    const script = job.script.join("\n");
    assert.match(script, /createHash\("sha256"\)/);
    assert.match(script, /not the pinned/, "a package whose sha256 is not the pinned one is refused");
    assert.match(script, /"\$RWI_PACKAGE_URL" "\$RWI_PACKAGE_SHA256"/);
    assert.equal(job.script.at(-1), 'node "${TMPDIR:-/tmp}/runward-integrations/package/src/cli.js" regenerate --recipe "$RWI_RECIPE" --cwd "$RWI_CWD" --report "$RWI_REPORT" --command "$RWI_COMMAND"');
  }
});

test("the command each control runs is the one the samples give the steps, on GitHub and on GitLab", () => {
  const gh = loadYaml(readFileSync(join(PKG, "samples", "github", "integrations.yml"), "utf8"));
  const gl = loadYaml(readFileSync(join(PKG, "samples", "gitlab", "integrations.gitlab-ci.yml"), "utf8"));
  for (const m of manifests) {
    const step = gh.jobs.gate.steps.find((s) => (s.uses ?? "").startsWith(`${m.steps.github.uses}@`));
    assert.ok(step, `${m.id}: the GitHub sample calls the recipe's step`);
    assert.deepEqual(JSON.parse(step.with.command), m.control.command.argv, `${m.id}: the GitHub sample runs the control's command`);
    assert.equal(step.with.report, m.control.command.report);
    assert.equal(step.with["working-directory"], m.control.command.cwd);
    const job = gl[m.id];
    assert.ok(job.extends.includes(m.steps.gitlab.extends), `${m.id}: the GitLab sample extends the recipe's job`);
    assert.deepEqual(JSON.parse(job.variables.RWI_COMMAND), m.control.command.argv, `${m.id}: the GitLab sample runs the control's command`);
    assert.equal(job.variables.RWI_REPORT, m.control.command.report);
    assert.ok(gl.include[0].file.includes(`/packages/runward-integrations/${m.steps.gitlab.template}`), `${m.id}: the GitLab sample includes the recipe's template`);
  }
  for (const s of gh.jobs.gate.steps) if (s.uses) assert.match(s.uses, /@[0-9a-f]{40}$/, `${s.uses} is pinned by commit`);
  for (const s of gh.jobs.gate.steps) if (s.run) assert.doesNotMatch(s.run, /\$\{\{/);
  const caller = loadYaml(readFileSync(join(PKG, "samples", "github", "caller.yml"), "utf8"));
  assert.deepEqual(caller.permissions, {});
  assert.match(caller.jobs["runward-integrations"].uses, /\.github\/workflows\/runward-integrations\.yml@[0-9a-f]{40}$/, "the mission calls the operator's workflow by commit");
  assert.equal(caller.jobs["runward-integrations"].with, undefined, "the mission passes nothing that changes a command");
  assert.match(String(gl.include[0].ref), /^[0-9a-f]{40}$/, "the GitLab sample includes the templates at a commit");
  assert.deepEqual(gl.gate.needs.map((n) => n.job), ["sarif", "junit", "coverage"]);
  assert.equal(gl.gate.when, "always", "the gate reads a red report too");
});

test("each control's sabotage is one the controls can plant, and the recipes' sabotages are the three", () => {
  assert.deepEqual(Object.keys(SABOTAGES).sort(), manifests.map((m) => m.id).sort());
  for (const m of manifests) {
    assert.equal(SABOTAGES[m.id].id, m.control.sabotage.id, `${m.id}: the manifest's sabotage is the one sabotages.js plants`);
    for (const d of m.control.doesNotCatch) assert.ok(SABOTAGES[d.sabotage] && d.sabotage !== m.id, `${m.id}: ${d.sabotage} is another recipe's sabotage`);
    assert.deepEqual(m.control.doesNotCatch.map((d) => d.sabotage).sort(), manifests.map((x) => x.id).filter((x) => x !== m.id).sort(),
      `${m.id}: what it does not catch is measured against every other recipe's sabotage`);
  }
});

test("each sabotage plants into the shipped example as it is, and refuses to plant where the text it edits is gone", () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "rwi-plant-")));
  try {
    execFileSync(process.execPath, [CLI, "--yes", "init", "--example"], { cwd: d, stdio: "pipe" });
    const guard = join(d, "code", "src", "core", "domain", "guard.ts");
    const before = readFileSync(guard, "utf8");
    SABOTAGES.junit.plant(d);
    assert.notEqual(readFileSync(guard, "utf8"), before);
    assert.throws(() => SABOTAGES.junit.plant(d), /no longer holds the text it edits/, "planting twice finds nothing to edit: it throws, never a silent no-op");
    SABOTAGES.coverage.plant(d);
    const t = readFileSync(join(d, "code", "test", "triage.test.ts"), "utf8");
    assert.doesNotMatch(t, /from "\.\.\/src\/adapters\/in-memory-triage-log\.adapter\.ts"/, "the tests no longer load the journal adapter");
    assert.match(t, /^class InMemoryTriageLog implements TriageLogPort/m, "they carry their own copy");
    SABOTAGES.sarif.plant(d);
    const planted = readFileSync(join(d, "code", "src", "adapters", "upstream-auth.adapter.ts"), "utf8");
    assert.match(planted, /"Bearer [A-Za-z0-9]{20,}"/, "a literal the example's lint configuration refuses");
  } finally { rmSync(d, { recursive: true, force: true }); }
  for (const f of ["sabotages.js", "control.js"]) assert.doesNotMatch(readFileSync(join(PKG, "src", f), "utf8"), /Bearer [A-Za-z0-9]{20,}/, `${f} holds no credential-shaped literal`);
});

test("ADR-0122 decision 5: each recipe's runward-run leg is one runward-run accepts; JUnit's and LCOV's are the sample policy's own", async () => {
  const { readPolicy } = await runModule("policy.js");
  const sample = JSON.parse(readFileSync(join(ROOT, "packages", "runward-run", "samples", "request-triage.run-policy.json"), "utf8"));
  for (const m of manifests) {
    const p = readPolicy({ ...sample, legs: [m.runwardRun.leg] });
    assert.equal(p.legs.length, 1, m.id);
    assert.deepEqual(m.runwardRun.leg.reports.map((r) => r.nature), [m.report.nature]);
    assert.equal(m.runwardRun.leg.reports[0].path, `${m.control.command.cwd}/${m.control.command.report}`, `${m.id}: the leg writes the report the control regenerates`);
    assert.equal(m.level.ciStep, "declared");
    assert.equal(m.level.runwardRunLeg, "attested");
  }
  const byId = Object.fromEntries(manifests.map((m) => [m.id, m]));
  assert.deepEqual(byId.junit.runwardRun.leg, sample.legs[0], "the JUnit recipe's leg is the sample policy's tests leg");
  assert.deepEqual(byId.coverage.runwardRun.leg, sample.legs[1], "the LCOV recipe's leg is the sample policy's coverage leg");
  // The same command, the report going to ${out} instead of {raw}: the control runs what the leg runs.
  for (const id of ["junit", "coverage"]) {
    const m = byId[id];
    assert.deepEqual(m.control.command.argv.map((a) => a.replace("{raw}", `\${out}/${m.control.command.cwd}/${m.control.command.report}`)), m.runwardRun.leg.command);
  }
  assert.ok(!sample.legs.some((l) => JSON.stringify(l) === JSON.stringify(byId.sarif.runwardRun.leg)), "the SARIF leg is not on the sample policy, and the manifest says why");
  assert.match(byId.sarif.runwardRun.onTheSamplePolicy, /image that carries this package/);
});

const PKG_JSON = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
test("runward-integrations ships at runward's version, MIT, private to npm, with no dependency and no script", () => {
  const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(PKG_JSON.name, "runward-integrations");
  assert.equal(PKG_JSON.version, root.version, `packages/runward-integrations is at ${PKG_JSON.version}, runward at ${root.version}: bump both`);
  assert.equal(PKG_JSON.license, "MIT");
  assert.equal(PKG_JSON.private, true, "nothing publishes it to npm from this repository");
  for (const k of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies", "scripts", "bundleDependencies"]) assert.ok(!PKG_JSON[k], `no ${k}`);
  assert.equal(PKG_JSON.engines.node, root.engines.node);
  assert.equal(readFileSync(join(PKG, "LICENSE"), "utf8"), readFileSync(join(ROOT, "LICENSE"), "utf8"), "the package's LICENSE is the repository's, byte for byte");
});

test("the runward-integrations tarball holds its modules, recipes, samples, schema, README, package.json and LICENSE, nothing else", () => {
  const win = process.platform === "win32";
  const [p] = JSON.parse(execFileSync(win ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json"], { cwd: PKG, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: win }));
  const files = p.files.map((f) => f.path.replaceAll("\\", "/")).sort();
  const want = ["LICENSE", "README.md", "package.json", "schema/recipe-manifest.schema.json",
    "samples/github/caller.yml", "samples/github/integrations.yml", "samples/gitlab/integrations.gitlab-ci.yml",
    ...["cli.js", "control.js", "count.js", "manifest.js", "normalize.js", "regenerate.js", "sabotages.js", "tools/eslint-sarif.mjs"].map((f) => `src/${f}`),
    ...manifests.flatMap((m) => [`recipes/${m.id}/manifest.json`, m.steps.github.action, m.steps.gitlab.template])].sort();
  assert.deepEqual(files, want);
  assert.ok(!/\]\(\.\.?\//.test(readFileSync(join(PKG, "README.md"), "utf8")), "the README links nothing relative: in a tarball a relative link points at no file");
  assert.ok(existsSync(join(PKG, "README.md")));
});

test("the CLI refuses an unknown command and a sabotage it does not know, exit 2", () => {
  const cli = join(PKG, "src", "cli.js");
  assert.equal(spawnSync(process.execPath, [cli, "publish"], { encoding: "utf8" }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, "sabotage", "--recipe", "pytest", "--tree", "."], { encoding: "utf8" }).status, 2);
});

// ── Guards on the CI job these tests cannot run (ADR-0122 decision 6) ──────────────────────────────────
test("CI: the integrations job runs the controls, the live count check, and each recipe's GitHub step on a sabotaged and a healthy tree", () => {
  const wf = loadYaml(readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
  const job = wf.jobs.integrations;
  assert.ok(job, "the job exists in .github/workflows/ci.yml");
  const runs = job.steps.map((s) => s.run ?? "").join("\n");
  assert.match(runs, /packages\/runward-integrations\/src\/cli\.js control --json "\$RUNNER_TEMP\/controls\.json"/);
  assert.match(runs, /count --check --results "\$RUNNER_TEMP\/controls\.json"/, "the count is checked against this run's controls");
  const countStep = job.steps.find((s) => /count --check --results/.test(s.run ?? ""));
  assert.equal(countStep.if, "${{ !cancelled() }}", "a failed control still has the count checked");
  for (const m of manifests) {
    const steps = job.steps.filter((s) => s.uses === `./packages/runward-integrations/${m.steps.github.action.replace(/\/action\.yml$/, "")}`);
    assert.equal(steps.length, 2, `${m.id}: its GitHub step runs twice, on its sabotaged tree and on the healthy one`);
    assert.deepEqual(steps.map((s) => s.with["working-directory"]).sort(), [`\${{ runner.temp }}/lab-${m.id}/code`, "${{ runner.temp }}/lab-healthy/code"].sort());
    for (const s of steps) {
      assert.deepEqual(JSON.parse(s.with.command), m.control.command.argv, `${m.id}: the job runs the control's command`);
      assert.equal(s.with.report, m.control.command.report);
    }
    assert.equal(steps.find((s) => s.with["working-directory"].includes("lab-healthy"))["continue-on-error"], undefined, `${m.id}: the healthy step must pass`);
  }
  assert.match(runs, /\[ "\$code" -eq 1 \] \|\| \{[^}]*expected 1/, "each sabotaged tree must be refused after its step");
  assert.match(runs, /node dist\/cli\.js check -p "\$RUNNER_TEMP\/lab-healthy" --strict\s*$/m, "and the healthy tree accepted");
  assert.match(runs, /already refuses the sabotage on its committed reports/, "the sabotage must pass without its recipe");
  assert.deepEqual(job.steps.filter((s) => s.uses && !s.uses.startsWith("./")).map((s) => s.uses.split("@")[1]).filter((ref) => !/^[0-9a-f]{40}$/.test(ref)), [], "every action from outside is pinned by commit");
});

test("control --record writes the date and runward version of a passing control into its manifest, and no other byte", async () => {
  const { recordPassing } = await mod("control.js");
  const d = realpathSync(mkdtempSync(join(tmpdir(), "rwi-record-")));
  try {
    const at = (id) => join(d, `${id}.json`);
    for (const m of manifests) writeFileSync(at(m.id), readFileSync(join(PKG, "recipes", m.id, "manifest.json"), "utf8").replace(/"lastPassingControl":\s*(?:null|\{[^{}]*\})/, '"lastPassingControl": null'));
    const before = Object.fromEntries(manifests.map((m) => [m.id, readFileSync(at(m.id), "utf8")]));
    const results = { date: "2027-01-02", runward: "9.9.9", recipes: [{ id: "sarif", passed: true }, { id: "junit", passed: false, reason: "x" }, { id: "coverage", passed: true }] };
    assert.deepEqual(recordPassing(results, { manifestPath: at }), ["sarif", "coverage"], "only the recipes whose control passed");
    for (const id of ["sarif", "coverage"]) {
      const after = readFileSync(at(id), "utf8");
      assert.equal(after, before[id].replace('"lastPassingControl": null', '"lastPassingControl": { "date": "2027-01-02", "runward": "9.9.9" }'), `${id}: one value changed, every other byte kept`);
      assert.ok(validate(JSON.parse(after)), `${id}: still a valid manifest`);
    }
    assert.equal(readFileSync(at("junit"), "utf8"), before.junit, "a recipe whose control failed keeps its last passing record");
  } finally { rmSync(d, { recursive: true, force: true }); }
});
