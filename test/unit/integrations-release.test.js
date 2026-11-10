// runward-integrations is distributed as a release asset, packed and attested with runward (ADR-0122,
// ADR-0121 decision 5), and never through npm: the package is private, and its recipes are taken from
// a commit of this repository. The release chain holds ADR-0116's rules for it as for the four others:
// the builder that packs it holds no signing credential and tests before it packs; the job that signs
// it builds nothing, checks out nothing and refuses a file whose digest or name the builder did not
// declare; the release workflow packs it again and refuses a byte of difference, attaches it as the
// eleventh asset, reads it back, and never publishes it to npm; verify-release.yml verifies it after
// the release, as Step 9 of the guide tells a reader to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { ROOT } from "../support/run-lab.js";

const workflow = (f) => loadYaml(readFileSync(join(ROOT, ".github", "workflows", f), "utf8"));
const runOf = (steps) => steps.map((s) => `${s.name ?? ""}\n${s.run ?? ""}\n${s.uses ?? ""}\n${JSON.stringify(s.with ?? {})}`);
const indexOf = (texts, re, what) => {
  const i = texts.findIndex((t) => re.test(t));
  assert.ok(i >= 0, `no step ${what}`);
  return i;
};

test("release chain: the isolated builder packs runward-integrations in its own directory, and the job that signs, which builds nothing, attests it (ADR-0116)", () => {
  const build = workflow("build-and-attest.yml");
  assert.match(build.on.workflow_call.outputs.integrations.value, /jobs\.build\.outputs\.integrations\b/);
  assert.match(build.jobs.build.outputs.integrations, /steps\.integrations_pack\.outputs\.integrations/);
  assert.match(build.jobs.build.outputs.integrations_sha256, /steps\.digests\.outputs\.integrations_sha256/);
  assert.deepEqual(build.jobs.build.permissions, { contents: "read" }, "the builder holds no signing credential");
  const steps = runOf(build.jobs.build.steps);
  const pack = indexOf(steps, /cd packages\/runward-integrations && npm pack --silent/, "packs packages/runward-integrations");
  assert.ok(indexOf(steps, /^Verify\nnpm test/, "runs npm test") < pack, "the builder tests before it packs: what is attested is what was tested");
  assert.match(steps[pack], /runward-integrations-\$VERSION\.tgz/, "the builder refuses an integrations tarball at another version");
  assert.ok(pack < indexOf(steps, /integrations_sha256=/, "hashes the integrations tarball for the signing job"));
  assert.ok(!steps.some((t) => /attest-build-provenance/.test(t)), "the build job signs nothing");
  assert.match(steps.at(-1), /integrations_pack\.outputs\.integrations/, "the integrations tarball is handed to the signing job");
  const attestJob = build.jobs.attest;
  assert.ok(attestJob.steps.every((s) => !/actions\/checkout|actions\/setup-node/.test(s.uses ?? "")), "the signing job checks out nothing and sets up no Node.js");
  assert.ok(attestJob.steps.every((s) => !/\bnpm\b|\bnode\b/.test(s.run ?? "")), "the signing job runs no npm and no node");
  const sign = runOf(attestJob.steps);
  const check = indexOf(sign, /check "\$INTEGRATIONS" "\$INTEGRATIONS_SHA256"/, "checks the integrations tarball against the digest the build job declared");
  const attest = indexOf(sign, /attest-build-provenance@[0-9a-f]{40}[\s\S]*needs\.build\.outputs\.integrations\b/, "attests the integrations tarball");
  assert.ok(check < attest);
  assert.match(sign[indexOf(sign, /The files are the ones the build job hashed/, "checks names and digests")], /\[ "\$INTEGRATIONS" = "runward-integrations-\$VERSION\.tgz" \]/,
    "an integrations tarball under another name is refused before signing");
  assert.match(sign.at(-1), /needs\.build\.outputs\.integrations\b/, "the integrations tarball is handed to the caller");
});

test("release chain: the runward-integrations tarball is byte-matched, attached as the eleventh asset, read back, and never published to npm", () => {
  const rel = workflow("release.yml");
  const verify = runOf(rel.jobs.verify.steps);
  const cross = indexOf(verify, /builder's runward-integrations tarball must byte-match a local pack/, "cross-checks the integrations tarball");
  assert.match(verify[cross], /BUILDER_INTEGRATIONS[\s\S]*cd packages\/runward-integrations && npm pack --silent[\s\S]*\[ "\$A" = "\$B" \][\s\S]*refusing to publish/);
  const stage = indexOf(verify, /^Stage the release assets under their published names/, "stages the assets");
  assert.ok(cross < stage);
  assert.match(verify[stage], /cp "\$INTEGRATIONS" "release-assets\/runward-integrations-\$VERSION\.tgz"/);
  const draft = runOf(rel.jobs.draft.steps);
  const names = (t) => [...t.matchAll(/"(runward-[^"]+)"/g)].map((m) => m[1]);
  const uploaded = names(draft[indexOf(draft, /gh release upload/, "uploads the assets")]);
  assert.ok(uploaded.includes("runward-integrations-$VERSION.tgz"));
  assert.deepEqual(names(draft[indexOf(draft, /held\.txt/, "reads the draft back")]), uploaded, "the read-back checks exactly what was uploaded");
  assert.equal(new Set(uploaded).size, 11, `eleven assets, runward-integrations' the eleventh (${uploaded.join(", ")})`);
  const releaseText = readFileSync(join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  assert.ok(!/\bten (assets|staged)\b|assembles the ten\b|\bfour tarballs\b/.test(releaseText), "no step or message of release.yml still counts ten assets or four tarballs");
  assert.ok(!/id-token/.test(JSON.stringify(rel.jobs.verify.permissions ?? {})), "the job that packs it again holds no signing credential");
  const publish = runOf(rel.jobs.publish.steps).join("\n");
  assert.ok(!/runward-integrations/.test(publish), "the publish job never touches runward-integrations: npm is not one of its channels");
  const pkg = JSON.parse(readFileSync(join(ROOT, "packages", "runward-integrations", "package.json"), "utf8"));
  assert.equal(pkg.private, true, "and npm would refuse it anyway");
});

test("verify-release.yml verifies the runward-integrations tarball after the release, pinned to its tag and to the builder", () => {
  const steps = workflow("verify-release.yml").jobs.verify.steps;
  const step9 = steps.find((s) => /^Step 9 — /.test(s.name ?? ""));
  assert.ok(step9, "verify-release.yml has a Step 9");
  assert.match(step9.run, /gh attestation verify "runward-integrations-\$VERSION\.tgz" --repo "\$GITHUB_REPOSITORY" \\\n\s+--signer-workflow "\$GITHUB_REPOSITORY\/\.github\/workflows\/build-and-attest\.yml" \\\n\s+--source-ref refs\/tags\/"\$TAG" \\\n\s+--deny-self-hosted-runners/);
  const resolve = steps.find((s) => s.name === "Resolve the tag under verification");
  assert.match(resolve.run, /EXPECT_ASSET_TARBALLS="true"/, "a release-triggered run requires the tarball");
  assert.match(step9.run, /EXPECT_ASSET_TARBALLS" = "true" \][\s\S]*exit 1/, "and an absent tarball fails it");
  const download = steps.find((s) => /^Download what a reader downloads/.test(s.name ?? ""));
  assert.match(download.run, /--pattern "runward-\*\.tgz"/, "the download fetches it with the other tarballs");
});

test("the release guide and the runbook verify the runward-integrations tarball, pinned to its tag, as they do the others", () => {
  const guide = readFileSync(join(ROOT, "docs", "verifying-a-release.md"), "utf8");
  const step9 = guide.slice(guide.indexOf("## Step 9"), guide.indexOf("## Step 10"));
  assert.match(step9, /gh attestation verify runward-integrations-X\.Y\.Z\.tgz --repo stranxik\/runward \\\n\s+--signer-workflow stranxik\/runward\/\.github\/workflows\/build-and-attest\.yml \\\n\s+--source-ref refs\/tags\/vX\.Y\.Z \\\n\s+--deny-self-hosted-runners/);
  const runbook = readFileSync(join(ROOT, "runward", "runbook.md"), "utf8");
  assert.match(runbook, /Check the eleven assets/);
  assert.match(runbook, /holding eleven assets/);
  assert.match(runbook, /Step 9 on `runward-forge-X\.Y\.Z\.tgz`, `runward-fleet-X\.Y\.Z\.tgz`, `runward-run-X\.Y\.Z\.tgz` and `runward-integrations-X\.Y\.Z\.tgz`/);
  assert.ok(!/\bthe ten assets\b|holding ten assets/.test(runbook), "the runbook no longer counts ten assets");
});
