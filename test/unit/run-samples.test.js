// The inert samples runward-run ships (ADR-0120 decision 5): a GitHub reusable workflow, the mission's
// caller, and a GitLab pipeline, at parity. runward installs none of them. What is held here is the
// layout the decision rests on, read from the files themselves:
//   - the executing job holds no id-token and no secret (whatever the project's code does, no identity
//     to sign with is in reach); the signing job runs no project code; each job asks only what it uses;
//   - the run policy lives in the workflow, never in the mission, and it is a policy runward-run accepts:
//     the image pinned by digest, the install from the lockfile with scripts off;
//   - every action and image is pinned by digest; inputs reach scripts through the environment only;
//   - GitHub and GitLab embed the same run policy and the same three jobs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { ROOT, runModule } from "../support/run-lab.js";

const SAMPLES = join(ROOT, "packages", "runward-run", "samples");
const read = (...p) => readFileSync(join(SAMPLES, ...p), "utf8");
const gh = loadYaml(read("github", "runward-run.yml"));
const ghRaw = read("github", "runward-run.yml");
const caller = loadYaml(read("github", "caller.yml"));
const gl = loadYaml(read("gitlab", "runward-run.gitlab-ci.yml"));
const examplePolicy = JSON.parse(read("request-triage.run-policy.json"));
const heredoc = (text) => JSON.parse(/<<'POLICY'\n([\s\S]*?)\n\s*POLICY/.exec(text)[1]);
const stepsText = (job) => job.steps.map((s) => `${s.name ?? ""}\n${s.uses ?? ""}\n${s.run ?? ""}\n${JSON.stringify(s.with ?? {})}\n${JSON.stringify(s.env ?? {})}`).join("\n");

test("GitHub: the executing job holds no id-token and no secret; it is the only job that runs the project's code", () => {
  assert.ok(gh.on.workflow_call, "a reusable workflow, called by commit from the mission");
  assert.deepEqual(gh.permissions, {}, "nothing granted by default: each job asks for what it uses");
  const ex = gh.jobs.execute;
  assert.deepEqual(ex.permissions, { "contents": "read" });
  assert.ok(!("id-token" in ex.permissions), "no OIDC token in the job that runs the agent's code");
  const { name: _name, ...body } = ex;
  assert.doesNotMatch(JSON.stringify(body), /secrets\.|id-token|GITHUB_TOKEN/, "no secret in reach of the project's code");
  assert.match(stepsText(ex), /packages\/runward-run\/src\/cli\.js run/, "it runs the legs with runward-run");
  for (const [name, job] of Object.entries(gh.jobs)) {
    if (name === "execute") continue;
    assert.doesNotMatch(stepsText(job), /runward-run\/src\/cli\.js run|npm (ci|install|test|run)|--import tsx/, `${name} runs no project code`);
  }
});

test("GitHub: the signing job runs no project code, checks the hand-over, and signs keyless under its own workflow's identity", () => {
  const sign = gh.jobs.sign;
  assert.equal(sign.needs, "execute");
  assert.deepEqual(sign.permissions, { "id-token": "write", "attestations": "write" });
  const text = stepsText(sign);
  assert.doesNotMatch(text, /actions\/checkout/, "it checks out nothing: no project file is even on its disk");
  assert.match(text, /needs\.execute\.outputs\.statement_sha256/, "the Statement handed over must be the one the executing job wrote");
  assert.match(text, /its digest is not the subject the Statement names/, "every subject is re-hashed before signing");
  const attest = sign.steps.find((s) => /^actions\/attest@/.test(s.uses ?? ""));
  assert.ok(attest, "it signs with actions/attest");
  assert.equal(attest.with["predicate-type"], "https://runward.dev/run/v1");
  assert.equal(attest.with["subject-checksums"], "subjects.sha256", "it signs exactly the subjects the run Statement names");
  assert.ok(!gh.jobs.gate.permissions["id-token"] && !gh.jobs.commit.permissions["id-token"], "only the signing job holds the identity that signs");
  assert.deepEqual(gh.jobs.gate.permissions, { contents: "read" });
});

test("GitHub: the run policy lives in the workflow, is runward-run's to accept, and is the shipped example's", async () => {
  const { readPolicy } = await runModule("policy.js");
  const inline = heredoc(ghRaw);
  assert.deepEqual(inline, examplePolicy, "the workflow writes the example's run policy, character for character in meaning");
  const p = readPolicy(inline);
  assert.equal(p.install.scripts, "disabled");
  assert.equal(p.reportsDir, "code/reports");
  assert.ok(!Object.keys(gh.on.workflow_call.inputs ?? {}).some((k) => /policy|command|image|leg/.test(k)), "the caller passes nothing that changes how the run executes");
});

test("GitHub: every action is pinned by commit, and no ${{ }} reaches a run script", () => {
  const all = [...Object.values(gh.jobs).flatMap((j) => j.steps), ...Object.values(caller.jobs)];
  for (const s of all) {
    if (s.uses) assert.match(s.uses, /@[0-9a-f]{40}$/, `${s.uses} is pinned by commit`);
    if (s.run) assert.doesNotMatch(s.run, /\$\{\{/, `${s.name}: inputs reach the script through env (CWE-78)`);
  }
  assert.match(caller.jobs["runward-run"].uses, /\.github\/workflows\/runward-run\.yml@[0-9a-f]{40}$/, "the mission calls the reusable workflow by commit");
  assert.deepEqual(caller.permissions, {});
  const refs = Object.values(gh.jobs).flatMap((j) => j.steps).filter((s) => s.with?.repository === "stranxik/runward").map((s) => s.with.ref);
  assert.equal(refs.length, 2);
  for (const ref of refs) assert.match(String(ref), /^[0-9a-f]{40}$/, "runward-run and runward-fleet are checked out at a commit, a string YAML does not read as a number");
});

test("GitLab at parity: the same run policy, the same three jobs, no id_tokens where the project's code runs", async () => {
  const { readPolicy } = await runModule("policy.js");
  assert.deepEqual(gl.stages, ["execute", "sign", "gate"]);
  const inline = heredoc(gl.execute.script.join("\n"));
  assert.deepEqual(inline, examplePolicy, "GitHub and GitLab run the same policy");
  assert.equal(readPolicy(inline).image, examplePolicy.image);
  assert.ok(!("id_tokens" in gl.execute), "no OIDC token in the executing job");
  assert.doesNotMatch(JSON.stringify(gl.execute), /COSIGN|PRIVATE_KEY|SIGSTORE/, "no key in reach of the project's code");
  assert.match(gl.execute.script.join("\n"), /runward-run\/src\/cli\.js run/);
  assert.deepEqual(gl.sign.needs, ["execute"]);
  assert.equal(gl.sign.id_tokens.SIGSTORE_ID_TOKEN.aud, "sigstore", "keyless where the instance offers Sigstore");
  const signScript = gl.sign.script.join("\n");
  assert.doesNotMatch(signScript, /npm|npx|node |git clone|tsx/, "the signing job runs no project code, and does not even clone the mission");
  assert.match(signScript, /cosign attest-blob --yes --new-bundle-format --statement "\$ST" --bundle/, "cosign signs the very Statement the run wrote");
  assert.match(signScript, /statement\.sha256/, "the hand-over is checked first");
  assert.ok(!("id_tokens" in gl.gate));
  for (const job of [gl.execute, gl.sign, gl.gate]) {
    const images = [job.image, ...(job.services ?? []).map((s) => s.name ?? s)];
    for (const i of images) assert.match(i, /@sha256:[0-9a-f]{64}$/, `${i} is pinned by digest`);
  }
  assert.match(gl.gate.script.join("\n"), /runward-fleet\/src\/cli\.js verify-run/);
  assert.match(gl.gate.script.join("\n"), /check -p mission --strict --require attested/);
  assert.match(stepsText(gh.jobs.gate), /check -p mission --strict --require attested/);
  assert.match(stepsText(gh.jobs.gate), /runward-fleet\/src\/cli\.js verify-run/);
});

// The package itself (ADR-0120 decision 1): its own name and tarball, at runward's version, MIT, with no
// dependency and no install script; until the npm bootstrap it is private, so `npm publish` refuses it.
const PKG_DIR = join(ROOT, "packages", "runward-run");
const pkgJson = (p) => JSON.parse(readFileSync(p, "utf8"));

test("runward-run ships at runward's version, MIT, private to npm, with no dependency and no script", () => {
  const root = pkgJson(join(ROOT, "package.json"));
  const run = pkgJson(join(PKG_DIR, "package.json"));
  assert.equal(run.name, "runward-run");
  assert.equal(run.version, root.version, `packages/runward-run is at ${run.version}, runward at ${root.version}: bump both`);
  assert.equal(run.license, root.license);
  assert.equal(run.private, true, "not on npm before the bootstrap runward-forge waits on (RWD-2026-0195)");
  for (const k of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies", "scripts"]) assert.ok(!run[k], `runward-run declares no ${k}`);
  assert.equal(run.bin?.["runward-run"], "src/cli.js");
  assert.equal(run.engines?.node, root.engines.node);
  assert.equal(readFileSync(join(PKG_DIR, "LICENSE"), "utf8"), readFileSync(join(ROOT, "LICENSE"), "utf8"), "the package's LICENSE is the repository's, byte for byte");
});

test("the runward-run tarball holds its modules, its samples, README, package.json and LICENSE, nothing else", async () => {
  const { execFileSync } = await import("node:child_process");
  const { readdirSync } = await import("node:fs");
  const win = process.platform === "win32";
  const [p] = JSON.parse(execFileSync(win ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json"], { cwd: PKG_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: win }));
  const files = p.files.map((f) => f.path.replaceAll("\\", "/")).sort();
  const src = readdirSync(join(PKG_DIR, "src")).map((f) => `src/${f}`);
  const samples = ["samples/github/caller.yml", "samples/github/runward-run.yml", "samples/gitlab/runward-run.gitlab-ci.yml", "samples/request-triage.run-policy.json"];
  assert.deepEqual(files, ["LICENSE", "README.md", "package.json", ...src, ...samples].sort());
  assert.ok(!/\]\(\.\.?\//.test(readFileSync(join(PKG_DIR, "README.md"), "utf8")), "the README links nothing relative: in a tarball a relative link points at no file");
});
