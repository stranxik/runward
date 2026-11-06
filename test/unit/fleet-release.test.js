// runward-fleet is distributed two ways, npm being closed to it: by the Action of this repository
// (fleet/action.yml, which runs the package at the commit the step pins and can publish the page on
// GitHub Pages), and as a release asset packed and attested with runward. These tests hold the
// package's manifest (the version left behind on a bump, a dependency, an install script), its
// tarball (a file it should not carry, the LICENSE and the font licenses it must), and the Action's
// safety discipline (inputs through the environment, every action pinned by commit, no secret).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { PKG, ROOT } from "../support/fleet.js";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const ROOT_PKG = json(join(ROOT, "package.json"));
const FLEET_PKG = json(join(PKG, "package.json"));

// The Windows leg needs `npm.cmd` and a shell to run it; every argument is a literal.
function packedFiles(cwd) {
  const win = process.platform === "win32";
  const out = execFileSync(win ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json"], { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: win });
  const [p] = JSON.parse(out);
  return { name: p.name, version: p.version, files: p.files.map((f) => f.path.replaceAll("\\", "/")).sort() };
}

test("runward-fleet ships at runward's version, private to npm, with no dependency and no script", () => {
  assert.equal(FLEET_PKG.name, "runward-fleet");
  assert.equal(FLEET_PKG.version, ROOT_PKG.version, `packages/runward-fleet is at ${FLEET_PKG.version}, runward at ${ROOT_PKG.version}: bump both (runward/runbook.md §3 step 3)`);
  assert.equal(FLEET_PKG.private, true, "released as an asset, never published to npm: a private package refuses npm publish");
  assert.ok(!("publishConfig" in FLEET_PKG));
  assert.equal(FLEET_PKG.license, ROOT_PKG.license);
  assert.equal(FLEET_PKG.repository?.url, "git+https://github.com/stranxik/runward.git");
  assert.equal(FLEET_PKG.repository?.directory, "packages/runward-fleet");
  for (const k of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies", "scripts"]) assert.ok(!FLEET_PKG[k], `runward-fleet declares no ${k}`);
  assert.equal(FLEET_PKG.bin?.["runward-fleet"], "src/cli.js");
  assert.equal(FLEET_PKG.engines?.node, ROOT_PKG.engines.node);
});

test("the runward-fleet tarball holds its modules, its page, its fonts with their licenses, README, package.json and LICENSE, nothing else", () => {
  const packed = packedFiles(PKG);
  assert.equal(packed.name, "runward-fleet");
  assert.equal(packed.version, ROOT_PKG.version);
  const src = readdirSync(join(PKG, "src")).filter((f) => f.endsWith(".js")).map((f) => `src/${f}`);
  const fonts = readdirSync(join(PKG, "ui", "fonts")).map((f) => `ui/fonts/${f}`);
  assert.ok(src.length >= 9, `the package's modules were listed (${src.length})`);
  assert.deepEqual(fonts.filter((f) => f.endsWith(".txt")).sort(), ["ui/fonts/OFL-DepartureMono.txt", "ui/fonts/OFL-Inter.txt"], "each embedded font ships with its licence");
  assert.ok(fonts.filter((f) => f.endsWith(".woff2")).length === 5);
  assert.deepEqual(packed.files, ["LICENSE", "README.md", "package.json", ...src, "ui/template.html", "ui/views.js", ...fonts].sort());
  assert.equal(readFileSync(join(PKG, "LICENSE"), "utf8"), readFileSync(join(ROOT, "LICENSE"), "utf8"), "the package's LICENSE is the repository's, byte for byte");
  for (const f of ["OFL-Inter.txt", "OFL-DepartureMono.txt"]) assert.match(readFileSync(join(PKG, "ui", "fonts", f), "utf8"), /SIL Open Font License, Version 1\.1/);
  assert.ok(!/\]\(\.\.?\//.test(readFileSync(join(PKG, "README.md"), "utf8")), "the README links nothing relative: in a tarball a relative link points at no file");
});

test("the fleet Action builds from this repository's package, passes its inputs through the environment, pins every action, reads no secret", () => {
  const raw = readFileSync(join(ROOT, "fleet", "action.yml"), "utf8");
  const a = loadYaml(raw);
  assert.equal(a.runs.using, "composite");
  assert.deepEqual(Object.keys(a.inputs).sort(), ["manifest", "out", "pages"]);
  assert.equal(a.inputs.manifest.required, true);
  assert.equal(a.inputs.pages.default, "false", "publishing is asked for, never the default");
  const steps = a.runs.steps;
  for (const s of steps.filter((x) => x.run)) assert.ok(!/\$\{\{/.test(s.run), `no \${{ }} inside a run script (CWE-78): ${s.name}`);
  const buildStep = steps.find((s) => s.id === "build");
  assert.equal(buildStep.env.FLEET_MANIFEST, "${{ inputs.manifest }}");
  assert.equal(buildStep.env.FLEET_CLI, "${{ github.action_path }}/../packages/runward-fleet/src/cli.js", "the package at the commit the step pins: nothing from npm");
  assert.match(buildStep.run, /node "\$FLEET_CLI" build "\$FLEET_MANIFEST" --out "\$FLEET_OUT"/);
  for (const s of steps.filter((x) => x.uses)) {
    assert.match(s.uses, /^actions\/(upload-pages-artifact|deploy-pages)@[0-9a-f]{40}$/, `${s.uses} is pinned by commit`);
    assert.equal(s.if, "inputs.pages == 'true'", `${s.uses} runs only when publishing is asked for`);
  }
  assert.ok(steps.findIndex((s) => s.id === "build") < steps.findIndex((s) => s.uses?.startsWith("actions/upload-pages-artifact")), "a refused build publishes nothing");
  assert.ok(!/secrets\./.test(raw), "no secret: the satellite holds no key");
  assert.match(raw, /22\.12 or later/, "the Node.js floor is checked before the build");
});

const workflow = (f) => loadYaml(readFileSync(join(ROOT, ".github", "workflows", f), "utf8"));
const runOf = (steps) => steps.map((s) => `${s.name ?? ""}\n${s.run ?? ""}\n${s.uses ?? ""}\n${JSON.stringify(s.with ?? {})}`);
const indexOf = (texts, re, what) => {
  const i = texts.findIndex((t) => re.test(t));
  assert.ok(i >= 0, `no step ${what}`);
  return i;
};

test("release chain: the isolated builder packs runward-fleet in its own directory, and the job that signs, which builds nothing, attests it (ADR-0116)", () => {
  const build = workflow("build-and-attest.yml");
  assert.match(build.on.workflow_call.outputs.fleet.value, /jobs\.build\.outputs\.fleet/);
  assert.match(build.jobs.build.outputs.fleet, /steps\.fleet_pack\.outputs\.fleet/);
  assert.match(build.jobs.build.outputs.fleet_sha256, /steps\.digests\.outputs\.fleet_sha256/);
  const steps = runOf(build.jobs.build.steps);
  const pack = indexOf(steps, /cd packages\/runward-fleet && npm pack --silent/, "packs packages/runward-fleet");
  assert.ok(indexOf(steps, /^Verify\nnpm test/, "runs npm test") < pack, "the builder tests before it packs");
  assert.match(steps[pack], /runward-fleet-\$VERSION\.tgz/, "the builder refuses a fleet tarball at another version");
  assert.ok(pack < indexOf(steps, /fleet_sha256=/, "hashes the fleet tarball for the signing job"));
  assert.ok(!steps.some((t) => /attest-build-provenance/.test(t)), "the build job signs nothing");
  assert.match(steps.at(-1), /fleet_pack\.outputs\.fleet/, "the fleet tarball is handed to the signing job");
  const sign = runOf(build.jobs.attest.steps);
  const check = indexOf(sign, /check "\$FLEET" "\$FLEET_SHA256"/, "checks the fleet tarball against the digest the build job declared");
  const attest = indexOf(sign, /attest-build-provenance@[0-9a-f]{40}[\s\S]*needs\.build\.outputs\.fleet/, "attests the fleet tarball");
  assert.ok(check < attest);
  assert.match(sign.at(-1), /needs\.build\.outputs\.fleet/, "the fleet tarball is handed to the caller");
});

test("release chain: the fleet tarball is byte-matched, attached as the ninth asset, read back, and never published to npm", () => {
  const rel = workflow("release.yml");
  // ADR-0116: the cross-checks and the staging live in the unprivileged `verify` job.
  const verify = runOf(rel.jobs.verify.steps);
  const cross = indexOf(verify, /builder's runward-fleet tarball must byte-match a local pack/, "cross-checks the fleet tarball");
  assert.match(verify[cross], /BUILDER_FLEET[\s\S]*cd packages\/runward-fleet && npm pack --silent[\s\S]*\[ "\$A" = "\$B" \][\s\S]*refusing to publish/);
  const stage = indexOf(verify, /^Stage the release assets under their published names/, "stages the assets");
  assert.ok(cross < stage);
  assert.match(verify[stage], /cp "\$FLEET" "release-assets\/runward-fleet-\$VERSION\.tgz"/);
  const draft = runOf(rel.jobs.draft.steps);
  const names = (t) => [...t.matchAll(/"(runward-[^"]+)"/g)].map((m) => m[1]);
  const uploaded = names(draft[indexOf(draft, /gh release upload/, "uploads the assets")]);
  assert.ok(uploaded.includes("runward-fleet-$VERSION.tgz"));
  assert.deepEqual(names(draft[indexOf(draft, /held\.txt/, "reads the draft back")]), uploaded, "the read-back checks exactly what was uploaded");
  assert.equal(uploaded.length, 10, "ten assets, runward-run's the tenth (ADR-0120)");
  const publish = runOf(rel.jobs.publish.steps).join("\n");
  assert.ok(!/runward-fleet/.test(publish), "the publish job never touches runward-fleet: npm is not one of its channels");
});

test("the fleet Action is exercised in CI on this tree's own exports, and writes the page the build writes", () => {
  const job = workflow("ci.yml").jobs["fleet-action"];
  assert.ok(job, "ci.yml has a fleet-action job");
  const steps = runOf(job.steps);
  const demo = indexOf(steps, /node scripts\/fleet-demo\.mjs --out fleet-ci --no-replay/, "writes the exports");
  const action = indexOf(steps, /^\n\n\.\/fleet\n/, "runs the Action from this commit");
  const same = indexOf(steps, /cmp fleet-ci\/site\/index\.html fleet-ci\/action-site\/index\.html/, "compares the two pages");
  assert.ok(demo < action && action < same);
  assert.equal(job.steps[action].with.pages, undefined, "nothing is published from CI");
});
