// runward-run is distributed as a release asset, packed and attested with runward (ADR-0120 decision
// 1), while npm is closed to it (the bootstrap runward-forge waits on, RWD-2026-0195). The release
// chain holds ADR-0116's rules for it as for the three others: the builder that packs it holds no
// signing credential and tests before it packs; the job that signs it builds nothing, checks out
// nothing and refuses a file whose digest the builder did not declare; the release workflow packs it
// again and refuses a byte of difference, attaches it as the tenth asset, reads it back, and never
// publishes it to npm.
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

test("release chain: the isolated builder packs runward-run in its own directory, and the job that signs, which builds nothing, attests it (ADR-0116)", () => {
  const build = workflow("build-and-attest.yml");
  assert.match(build.on.workflow_call.outputs.run.value, /jobs\.build\.outputs\.run\b/);
  assert.match(build.jobs.build.outputs.run, /steps\.run_pack\.outputs\.run/);
  assert.match(build.jobs.build.outputs.run_sha256, /steps\.digests\.outputs\.run_sha256/);
  assert.deepEqual(build.jobs.build.permissions, { contents: "read" }, "the builder holds no signing credential");
  const steps = runOf(build.jobs.build.steps);
  const pack = indexOf(steps, /cd packages\/runward-run && npm pack --silent/, "packs packages/runward-run");
  assert.ok(indexOf(steps, /^Verify\nnpm test/, "runs npm test") < pack, "the builder tests before it packs: what is attested is what was tested");
  assert.match(steps[pack], /runward-run-\$VERSION\.tgz/, "the builder refuses a run tarball at another version");
  assert.ok(pack < indexOf(steps, /run_sha256=/, "hashes the run tarball for the signing job"));
  assert.ok(!steps.some((t) => /attest-build-provenance/.test(t)), "the build job signs nothing");
  assert.match(steps.at(-1), /run_pack\.outputs\.run/, "the run tarball is handed to the signing job");
  const attestJob = build.jobs.attest;
  assert.ok(attestJob.steps.every((s) => !/actions\/checkout|actions\/setup-node/.test(s.uses ?? "")), "the signing job checks out nothing and sets up no Node.js");
  assert.ok(attestJob.steps.every((s) => !/\bnpm\b|\bnode\b/.test(s.run ?? "")), "the signing job runs no npm and no node");
  const sign = runOf(attestJob.steps);
  const check = indexOf(sign, /check "\$RUN" "\$RUN_SHA256"/, "checks the run tarball against the digest the build job declared");
  const attest = indexOf(sign, /attest-build-provenance@[0-9a-f]{40}[\s\S]*needs\.build\.outputs\.run\b/, "attests the run tarball");
  assert.ok(check < attest);
  assert.match(sign[indexOf(sign, /The files are the ones the build job hashed/, "checks names and digests")], /\[ "\$RUN" = "runward-run-\$VERSION\.tgz" \]/, "a run tarball under another name is refused before signing");
  assert.match(sign.at(-1), /needs\.build\.outputs\.run\b/, "the run tarball is handed to the caller");
});

test("release chain: the runward-run tarball is byte-matched, attached as the tenth asset, read back, and never published to npm", () => {
  const rel = workflow("release.yml");
  const verify = runOf(rel.jobs.verify.steps);
  const cross = indexOf(verify, /builder's runward-run tarball must byte-match a local pack/, "cross-checks the run tarball");
  assert.match(verify[cross], /BUILDER_RUN[\s\S]*cd packages\/runward-run && npm pack --silent[\s\S]*\[ "\$A" = "\$B" \][\s\S]*refusing to publish/);
  const stage = indexOf(verify, /^Stage the release assets under their published names/, "stages the assets");
  assert.ok(cross < stage);
  assert.match(verify[stage], /cp "\$RUN" "release-assets\/runward-run-\$VERSION\.tgz"/);
  const draft = runOf(rel.jobs.draft.steps);
  const names = (t) => [...t.matchAll(/"(runward-[^"]+)"/g)].map((m) => m[1]);
  const uploaded = names(draft[indexOf(draft, /gh release upload/, "uploads the assets")]);
  assert.ok(uploaded.includes("runward-run-$VERSION.tgz"));
  assert.deepEqual(names(draft[indexOf(draft, /held\.txt/, "reads the draft back")]), uploaded, "the read-back checks exactly what was uploaded");
  assert.equal(uploaded.length, 10);
  assert.ok(!/id-token/.test(JSON.stringify(rel.jobs.verify.permissions ?? {})), "the job that packs it again holds no signing credential");
  const publish = runOf(rel.jobs.publish.steps).join("\n");
  assert.ok(!/runward-run/.test(publish), "the publish job never touches runward-run: npm is not one of its channels before the bootstrap");
  const pkg = JSON.parse(readFileSync(join(ROOT, "packages", "runward-run", "package.json"), "utf8"));
  assert.equal(pkg.private, true, "and npm would refuse it anyway");
});

test("the release guide verifies the runward-run tarball, pinned to its tag, as it does the others", () => {
  const guide = readFileSync(join(ROOT, "docs", "verifying-a-release.md"), "utf8");
  const step9 = guide.slice(guide.indexOf("## Step 9"), guide.indexOf("## Step 10"));
  assert.match(step9, /gh attestation verify runward-run-X\.Y\.Z\.tgz --repo stranxik\/runward \\\n\s+--signer-workflow stranxik\/runward\/\.github\/workflows\/build-and-attest\.yml \\\n\s+--source-ref refs\/tags\/vX\.Y\.Z \\\n\s+--deny-self-hosted-runners/);
  const runbook = readFileSync(join(ROOT, "runward", "runbook.md"), "utf8");
  assert.match(runbook, /Check the ten assets/);
  assert.match(runbook, /runward-run-X\.Y\.Z\.tgz/);
});
