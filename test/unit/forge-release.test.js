// runward-forge is released with runward (ADR-0094, question 1): the same version, the same tag, the
// same release chain, and no extra gesture per release. These tests hold the four places that
// promise can silently break: the package's own manifest (a version left behind on a bump), its
// tarball (a file it should not carry, or the LICENSE it must), the runward tarball (which must
// still carry nothing of packages/), and the release workflows (a step dropped from the builder,
// the cross-check, the draft or the publish job). The one-time npm bootstrap is checked too, so the
// placeholder can never carry code or reach `latest` by the runbook's command.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FORGE = join(ROOT, "packages", "runward-forge");
const BOOTSTRAP = join(ROOT, "scripts", "runward-forge-bootstrap");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const ROOT_PKG = json(join(ROOT, "package.json"));
const FORGE_PKG = json(join(FORGE, "package.json"));

// The Windows leg needs `npm.cmd` and a shell to run it (see the ADR-0070 test in packaging.test.js);
// every argument is a literal, nothing is interpolated into that shell.
function packedFiles(cwd) {
  const win = process.platform === "win32";
  const out = execFileSync(win ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json"],
    { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: win });
  const [p] = JSON.parse(out);
  return { name: p.name, version: p.version, files: p.files.map((f) => f.path.replaceAll("\\", "/")).sort() };
}

test("runward-forge ships at runward's version: public, no private flag, provenance from CI only", () => {
  assert.equal(FORGE_PKG.name, "runward-forge");
  assert.equal(FORGE_PKG.version, ROOT_PKG.version,
    `packages/runward-forge is at ${FORGE_PKG.version}, runward at ${ROOT_PKG.version}: bump both (runward/runbook.md §3 step 3)`);
  assert.ok(!("private" in FORGE_PKG), "a private package is refused by npm publish: the release would publish runward alone");
  assert.deepEqual(FORGE_PKG.publishConfig, { access: "public" },
    "publishConfig carries the access only: provenance is requested by the release workflow, and no registry is overridden");
  assert.equal(FORGE_PKG.license, ROOT_PKG.license);
  assert.equal(FORGE_PKG.repository?.url, "git+https://github.com/stranxik/runward.git",
    "npm provenance binds the package to this repository: its manifest must name it");
  assert.equal(FORGE_PKG.repository?.directory, "packages/runward-forge");
  for (const k of ["dependencies", "optionalDependencies", "peerDependencies", "scripts"]) {
    assert.ok(!FORGE_PKG[k], `runward-forge declares no ${k}: Node built-ins only, nothing runs at install or pack`);
  }
});

test("the runward-forge tarball holds src/, README.md, package.json and LICENSE, and nothing else", () => {
  const packed = packedFiles(FORGE);
  assert.equal(packed.name, "runward-forge");
  assert.equal(packed.version, ROOT_PKG.version);
  const modules = readdirSync(join(FORGE, "src")).filter((f) => f.endsWith(".js")).map((f) => `src/${f}`);
  assert.ok(modules.length >= 5, `the package's modules were listed (${modules.length})`);
  assert.deepEqual(packed.files, ["LICENSE", "README.md", "package.json", ...modules].sort());
  assert.equal(readFileSync(join(FORGE, "LICENSE"), "utf8"), readFileSync(join(ROOT, "LICENSE"), "utf8"),
    "the package's LICENSE is the repository's, byte for byte");
  assert.ok(!/\]\(\.\.?\//.test(readFileSync(join(FORGE, "README.md"), "utf8")),
    "the README links nothing relative: on npm a relative link points at no file");
});

test("the runward tarball still carries nothing of packages/", () => {
  const packed = packedFiles(ROOT);
  assert.equal(packed.name, "runward");
  assert.ok(packed.files.length > 100, `the root tarball was actually read (${packed.files.length} files)`);
  assert.deepEqual(packed.files.filter((f) => f.startsWith("packages/") || f.startsWith("scripts/")), [],
    "the runward tarball ships a file of packages/ or scripts/ (ADR-0094: the forge code is a second package)");
});

const workflow = (f) => loadYaml(readFileSync(join(ROOT, ".github", "workflows", f), "utf8"));
const runOf = (steps) => steps.map((s) => `${s.name ?? ""}\n${s.run ?? ""}\n${s.uses ?? ""}\n${JSON.stringify(s.with ?? {})}`);
const indexOf = (texts, re, what) => {
  const i = texts.findIndex((t) => re.test(t));
  assert.ok(i >= 0, `no step ${what}`);
  return i;
};

test("release chain: the isolated builder packs runward-forge in its own directory and attests it", () => {
  // ADR-0116 decision 3: the build job packs, the attest job signs, and the forge tarball crosses from
  // one to the other by digest.
  const build = workflow("build-and-attest.yml");
  assert.match(build.on.workflow_call.outputs.forge.value, /jobs\.build\.outputs\.forge/);
  const steps = runOf(build.jobs.build.steps);
  const pack = indexOf(steps, /cd packages\/runward-forge && npm pack --silent/, "packs packages/runward-forge");
  const hashed = indexOf(steps, /forge_sha256=\$\(sha256sum "\$FORGE"/, "hashes the forge tarball for the signing job");
  assert.ok(indexOf(steps, /^Verify\nnpm test/, "runs npm test") < pack, "the builder tests before it packs");
  assert.ok(pack < hashed);
  assert.match(steps[pack], /runward-forge-\$VERSION\.tgz/, "the builder refuses a forge tarball at another version");
  assert.match(steps.at(-1), /forge_pack\.outputs\.forge/, "the forge tarball is handed to the signing job");
  const signing = runOf(build.jobs.attest.steps);
  const checked = indexOf(signing, /check "\$FORGE" "\$FORGE_SHA256"/, "checks the forge tarball's digest");
  const attest = indexOf(signing, /attest-build-provenance@[0-9a-f]{40}[\s\S]*needs\.build\.outputs\.forge/, "attests the forge tarball");
  assert.ok(checked < attest, "the signing job checks the digest before it signs");
  assert.match(signing.at(-1), /needs\.build\.outputs\.forge/, "the forge tarball is handed to the caller");
});

test("release chain: the forge tarball is byte-matched, attached as the eighth asset, and read back", () => {
  // ADR-0116: the job that cross-checks and stages is `verify`, which holds no signing credential; the
  // SBOM attestation joins the staged assets in the draft job.
  const rel = workflow("release.yml");
  const verify = runOf(rel.jobs.verify.steps);
  const cross = indexOf(verify, /builder's runward-forge tarball must byte-match a local pack/, "cross-checks the forge tarball");
  assert.match(verify[cross], /BUILDER_FORGE[\s\S]*cd packages\/runward-forge && npm pack --silent[\s\S]*\[ "\$A" = "\$B" \][\s\S]*refusing to publish/);
  const stage = indexOf(verify, /^Stage the release assets under their published names/, "stages the assets");
  assert.ok(cross < stage);
  assert.match(verify[stage], /cp "\$FORGE" "release-assets\/runward-forge-\$VERSION\.tgz"/);
  const draft = runOf(rel.jobs.draft.steps);
  assert.ok(indexOf(draft, /sbom-attestation/, "downloads the SBOM attestation") < indexOf(draft, /gh release upload/, "uploads"),
    "the eighth asset is in place before the upload");
  const names = (t) => [...t.matchAll(/"(runward-[^"]+)"/g)].map((m) => m[1]);
  const uploaded = names(draft[indexOf(draft, /gh release upload/, "uploads the assets")]);
  const readBack = names(draft[indexOf(draft, /held\.txt/, "reads the draft back")]);
  assert.equal(new Set(uploaded).size, 10, `the draft uploads ten assets, runward-run's the tenth (${uploaded.join(", ")})`);
  assert.deepEqual(readBack, uploaded, "the read-back checks exactly what was uploaded");
  assert.ok(uploaded.includes("runward-forge-$VERSION.tgz"));
  const releaseText = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
  assert.ok(!/\bseven\b/.test(releaseText.replace(/seventh asset/g, "")), "no step or message of release.yml still counts seven assets");
  assert.ok(!/\beight\b/.test(releaseText), "nor eight, since runward-fleet's tarball is the ninth (ADR-0093 D4)");
  assert.ok(!/\bnine (assets|staged)\b|assembles the nine\b/.test(releaseText), "nor nine, since runward-run's tarball is the tenth (ADR-0120)");
});

test("release chain: the publish job publishes runward, then verifies and publishes runward-forge from the release", () => {
  const steps = runOf(workflow("release.yml").jobs.publish.steps);
  const runward = indexOf(steps, /npm publish "\$TARBALL" --provenance --access public/, "publishes runward");
  const download = indexOf(steps, /gh release download "\$TAG" --pattern "\$FORGE"/, "downloads the forge tarball from the release");
  const prov = indexOf(steps, /gh attestation verify "\$FORGE"/, "verifies the forge provenance");
  const forge = indexOf(steps, /npm publish "\$FORGE" --provenance --access public/, "publishes runward-forge");
  assert.ok(runward < download && download < prov && prov < forge, "runward first, then the forge: download, verify, publish");
  assert.match(steps[download], /\[ "\$NAME" = "runward-forge" \] && \[ "\$PKGVERSION" = "\$VERSION" \]/, "name and version are checked");
  for (const flag of [/--signer-workflow "\$GH_REPO\/\.github\/workflows\/build-and-attest\.yml"/,
    /--source-ref "refs\/tags\/\$TAG"/, /--source-digest "\$TAG_COMMIT"/, /\[ "\$NAMED" = "\$TAG_COMMIT" \]/]) {
    assert.match(steps[prov], flag, `the forge provenance is pinned exactly as runward's (${flag})`);
  }
  for (const i of [runward, forge]) {
    assert.match(steps[i], /npm view "[^"]+@\$VERSION" dist\.integrity/, "a re-run asks npm what it holds first");
    assert.match(steps[i], /already published with this file's integrity/, "an identical version is skipped and said so");
    assert.match(steps[i], /exit 1/, "any other integrity fails the job");
  }
  assert.ok(!steps.some((t) => /npm unpublish/.test(t)), "nothing is ever unpublished");
});

test("the npm bootstrap placeholder carries no code and the runbook never publishes it to latest", () => {
  const pkg = json(join(BOOTSTRAP, "package.json"));
  assert.equal(pkg.name, FORGE_PKG.name);
  assert.equal(pkg.version, "0.0.0-bootstrap.0");
  assert.deepEqual(pkg.files, ["README.md"]);
  for (const k of ["bin", "main", "exports", "scripts", "dependencies"]) assert.ok(!(k in pkg), `the placeholder declares no ${k}`);
  assert.deepEqual(readdirSync(BOOTSTRAP).sort(), ["README.md", "package.json"], "the bootstrap directory holds two files");
  assert.match(readFileSync(join(BOOTSTRAP, "README.md"), "utf8"), /placeholder[\s\S]*no code/i);
  const runbook = readFileSync(join(ROOT, "runward", "runbook.md"), "utf8");
  const publishes = [...runbook.matchAll(/npm publish[^\n]*/g)].map((m) => m[0]).filter((l) => /runward-forge-bootstrap|bootstrap/.test(l));
  assert.ok(publishes.length >= 1, "the runbook gives the placeholder's publish command");
  for (const l of publishes) assert.match(l, /--tag bootstrap/, `"${l}" publishes under the bootstrap dist-tag`);
  assert.match(runbook, /npm deprecate runward-forge@0\.0\.0-bootstrap\.0/);
});

test("release chain: the publish job runs in the `release` environment, so a branch run cannot reach npm (ADR-0110 decision 1)", () => {
  const publish = workflow("release.yml").jobs.publish;
  assert.equal(publish.environment, "release",
    "the publish job must declare environment: release (its deployment rule admits only tags v*)");
  assert.equal(publish.if, "github.event_name == 'release'", "the publish job runs on the release event only");
  assert.equal(publish.permissions["id-token"], "write", "the OIDC exchange npm checks is the one the environment gates");
});

// ADR-0116 decision 4. From 0.44.0 to 0.46.0 the publish job ended red on `404 Not Found - PUT
// https://registry.npmjs.org/runward-forge` (the package was never bootstrapped, runbook §3.1), so
// verify-release.yml, which runs after a green publish only, never ran. The step itself is executed
// here, with `curl`, `npm`, `openssl` and `base64` stubbed on the PATH: the package's absence warns and
// ends green, and every other answer of the registry or of npm keeps the failure a failure.
const FORGE_PUBLISH = "Publish the released runward-forge tarball with provenance (OIDC, no token)";
// One stub directory for every run: each new executable costs a first-run scan on macOS.
let STUBS = null;
function stubs() {
  if (STUBS) return STUBS;
  STUBS = mkdtempSync(join(tmpdir(), "rw-forge-stubs-"));
  const put = (name, body) => { writeFileSync(join(STUBS, name), `#!/bin/sh\n${body}\n`); chmodSync(join(STUBS, name), 0o755); };
  put("curl", `printf '%s' "$STUB_CODE"; exit "\${STUB_CURL_EXIT:-0}"`);
  put("npm", `case "$1" in view) printf '%s' "$STUB_HELD" ;; publish) echo "publish $*" >> "$STUB_LOG"; exit "\${STUB_PUBLISH_EXIT:-0}" ;; esac`);
  put("openssl", "cat > /dev/null 2>&1; printf 'digest'");
  put("base64", "cat > /dev/null; printf 'OWN'");
  return STUBS;
}
function runForgePublish(stub) {
  const step = workflow("release.yml").jobs.publish.steps.find((s) => s.name === FORGE_PUBLISH);
  assert.ok(step?.run, "the publish job has the runward-forge publish step");
  const dir = mkdtempSync(join(tmpdir(), "rw-forge-publish-"));
  try {
    const bin = stubs();
    writeFileSync(join(dir, "runward-forge-9.9.9.tgz"), "x");
    const summary = join(dir, "summary.md");
    const log = join(dir, "npm.log");
    const r = spawnSync("bash", ["-c", step.run], { cwd: dir, encoding: "utf8",
      env: { PATH: `${bin}:${process.env.PATH}`, VERSION: "9.9.9", FORGE: "runward-forge-9.9.9.tgz", GITHUB_STEP_SUMMARY: summary,
        STUB_LOG: log, STUB_CODE: "", STUB_HELD: "", ...stub } });
    const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
    return { status: r.status, out: `${r.stdout}${r.stderr}`, summary: read(summary), published: read(log) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("release chain: a runward-forge absent from npm warns and leaves the publish green; every other failure stays red", () => {
  // What the step says, read everywhere; what it does, executed where its shell runs (Linux, where the
  // required test jobs run, and macOS). The Windows leg reads the text only.
  const run = workflow("release.yml").jobs.publish.steps.find((s) => s.name === FORGE_PUBLISH)?.run ?? "";
  assert.match(run, /curl [^\n]*-w '%\{http_code\}'[\s\S]*https:\/\/registry\.npmjs\.org\/runward-forge"\) \|\| CODE="unreachable"/,
    "the registry is asked for the package, not for a version");
  assert.match(run, /if \[ "\$CODE" = "404" \]; then[\s\S]*::warning[\s\S]*GITHUB_STEP_SUMMARY[\s\S]*exit 0\n\s*fi/, "absent: a warning, the summary, exit 0");
  assert.match(run, /\[ "\$CODE" = "200" \] \\\n\s*\|\| \{ echo "::error::[^"]*"; exit 1; \}/, "any answer but 404 and 200 fails");
  if (process.platform === "win32") return;

  const absent = runForgePublish({ STUB_CODE: "404" });
  assert.equal(absent.status, 0, absent.out);
  assert.match(absent.out, /::warning title=runward-forge not published::runward-forge is not on npm[\s\S]*runbook\.md §3\.1/);
  assert.match(absent.summary, /### runward-forge not published/, "the warning is in the job summary too, where a reader of the run sees it");
  assert.equal(absent.published, "", "nothing is published when the package does not exist");

  const fresh = runForgePublish({ STUB_CODE: "200" });
  assert.equal(fresh.status, 0, fresh.out);
  assert.match(fresh.published, /publish runward-forge-9\.9\.9\.tgz --provenance --access public/, "a package that exists is published");

  const refused = runForgePublish({ STUB_CODE: "200", STUB_PUBLISH_EXIT: "1" });
  assert.equal(refused.status, 1, "a failed publish of a package that exists is a failure, never a warning");
  assert.doesNotMatch(refused.out, /::warning/);

  const same = runForgePublish({ STUB_CODE: "200", STUB_HELD: "sha512-OWN" });
  assert.equal(same.status, 0, same.out);
  assert.match(same.out, /already published with this file's integrity/);
  assert.equal(same.published, "");

  const other = runForgePublish({ STUB_CODE: "200", STUB_HELD: "sha512-ANOTHER" });
  assert.equal(other.status, 1, "npm holding another file at this version is a failure");

  for (const [code, exit] of [["503", "0"], ["000", "6"]]) {
    const r = runForgePublish({ STUB_CODE: code, STUB_CURL_EXIT: exit });
    assert.equal(r.status, 1, `a registry answering ${code} (curl exit ${exit}) is a failure: ${r.out}`);
    assert.match(r.out, /::error::the npm registry answered/);
  }
  rmSync(stubs(), { recursive: true, force: true });
});
