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
