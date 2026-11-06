// runward-fleet verifies signatures offline against the operator's trust policy, and raises a cell
// to machine-established only on a verified signature under a pinned policy (ADR-0093 decision 8,
// D4: "unpinned policy raises nothing"; "What would settle it": "a record whose certificate names
// another commit is never raised"). Two kinds of signature, each with its four controls: valid,
// falsified, absent, signer outside the policy.
//   - keyless: a Sigstore bundle as actions/attest writes it, the trusted root given as a file. The
//     real one is runward's own v0.46.0 release provenance (test/fixtures/fleet/sigstore/), verified
//     here with no network; the ones a CI on refs/heads/main would write are made by
//     test/support/fleet-sigstore.js, with keys generated at each run.
//   - a dedicated Ed25519 key: the evidence folder a CI signs as manifeste.json and manifeste.sig
//     (schema dropyour.preuves-ci.v2), with a key generated at each run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { build, fixture, fixtureJson, indexFrom, manifestOf, realCheck, sigstore, trust } from "../support/fleet.js";
import { githubIdentity, makeBundle, makeSigstore, statementOver } from "../support/fleet-sigstore.js";

const realBundle = () => JSON.parse(fixture("sigstore", "runward-0.46.0.provenance.intoto.jsonl").toString("utf8").split("\n")[0]);
const realRoot = () => sigstore.readTrustedRoot(fixtureJson("sigstore", "trusted_root.json"));
const failed = (r) => r.checks.filter((c) => !c.ok).map((c) => c.id);
const sha = (b) => createHash("sha256").update(b).digest("hex");

// ------------------------------------------------------------------ the verifier, on real data
test("a real actions/attest bundle verifies offline: log, inclusion, checkpoint, chain, envelope", () => {
  const r = sigstore.verifyBundle(realBundle(), [realRoot()]);
  assert.deepEqual(failed(r), [], "every check of runward's v0.46.0 release provenance holds");
  assert.equal(r.ok, true);
  assert.deepEqual(r.checks.map((c) => c.id), ["bundle-format", "tlog-key", "tlog-set", "tlog-inclusion", "tlog-checkpoint", "tlog-body", "certificate-chain", "certificate-validity", "certificate-usage", "dsse-signature", "statement"]);
  assert.equal(r.identity.buildSignerURI, "https://github.com/stranxik/runward/.github/workflows/build-and-attest.yml@refs/tags/v0.46.0");
  assert.equal(r.identity.sourceRepositoryDigest, "192ca3d63c456a4235aac8062aff21f16733c520");
  assert.equal(r.identity.sourceRepositoryRef, "refs/tags/v0.46.0");
  assert.equal(r.signedAt, Date.UTC(2026, 9, 28, 11, 52, 51), "the signing time is the log's integrated time, never this machine's clock");
  assert.equal(r.statement.subject[0].digest.sha256, "64becf895be9282b40a230389d3c1da0204ac52404d026f1e923a547dc1e3248");
});

test("the real bundle, falsified anywhere, is refused by the check that guards that part", () => {
  const plant = (fn) => { const b = realBundle(); fn(b); return failed(sigstore.verifyBundle(b, [realRoot()])); };
  assert.ok(plant((b) => {
    const st = JSON.parse(Buffer.from(b.dsseEnvelope.payload, "base64").toString("utf8"));
    st.subject[0].digest.sha256 = "0".repeat(64);
    b.dsseEnvelope.payload = Buffer.from(JSON.stringify(st)).toString("base64");
  }).includes("dsse-signature"), "a rewritten statement");
  assert.ok(plant((b) => {
    const s = Buffer.from(b.dsseEnvelope.signatures[0].sig, "base64");
    s[s.length - 1] ^= 1;
    b.dsseEnvelope.signatures[0].sig = s.toString("base64");
  }).includes("dsse-signature"), "one bit of the signature");
  assert.ok(plant((b) => { b.verificationMaterial.tlogEntries[0].inclusionProof.hashes[3] = Buffer.alloc(32).toString("base64"); }).includes("tlog-inclusion"), "a hash of the inclusion proof");
  assert.ok(plant((b) => { b.verificationMaterial.tlogEntries[0].integratedTime = String(Number(b.verificationMaterial.tlogEntries[0].integratedTime) + 3600); }).includes("tlog-set"), "an integrated time moved by an hour");
  const lines = plant((b) => { const e = b.verificationMaterial.tlogEntries[0].inclusionProof.checkpoint; e.envelope = e.envelope.replace(/^(.*\n)(\d+)/, (m, a, n) => `${a}${Number(n) + 1}`); });
  assert.ok(lines.includes("tlog-checkpoint"), "a checkpoint that names another tree size");
});

test("the real bundle against a trusted root without its authority, or without its log, does not verify", () => {
  const doc = fixtureJson("sigstore", "trusted_root.json");
  const noCa = sigstore.readTrustedRoot({ ...doc, certificateAuthorities: [] });
  assert.ok(failed(sigstore.verifyBundle(realBundle(), [noCa])).includes("certificate-chain"));
  const noLog = sigstore.readTrustedRoot({ ...doc, tlogs: [] });
  assert.ok(failed(sigstore.verifyBundle(realBundle(), [noLog])).includes("tlog-key"));
});

test("a bundle of any malformed shape is refused, never a crash of the build", () => {
  const ss = makeSigstore();
  const policy = { format: "runward-fleet-trust-policy/0", trustedRoots: ["root.json"], signers: [] };
  for (const bad of [{ mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json", verificationMaterial: { certificate: { rawBytes: "AAAA" }, tlogEntries: 7 }, dsseEnvelope: { payload: "", payloadType: "x", signatures: [{ sig: "" }] } }, { mediaType: 3 }, [], "a string"]) {
    const index = indexFrom(manifestOf([{ ...{ id: "app", name: "example/app", repository: "github.com/example/app" }, exports: { check: { file: "c.json" } }, signatures: [{ covers: "check", kind: "sigstore-bundle", file: "b.json" }] }], { trustPolicy: "p.json" }),
      { "p.json": policy, "root.json": ss.trustedRoot, "c.json": realCheck(), "b.json": bad });
    const s = index.missions[0].signatures[0];
    assert.equal(s.state, "refused", JSON.stringify(bad).slice(0, 40));
    assert.equal(index.missions[0].latest.implemented, "ci-declared");
  }
});

test("what this version does not verify is said, and marked unsupported, never passed", () => {
  const b = realBundle();
  delete b.verificationMaterial.tlogEntries[0].inclusionPromise; // a Rekor v2 entry: its time is an RFC 3161 timestamp's
  const r = sigstore.verifyBundle(b, [realRoot()]);
  assert.equal(r.ok, false);
  assert.equal(r.checks.find((c) => c.id === "tlog-set").as, "unsupported");
  const none = realBundle();
  none.verificationMaterial.tlogEntries = [];
  assert.equal(sigstore.verifyBundle(none, [realRoot()]).checks.find((c) => c.id === "tlog-entry").as, "unsupported");
});

// ------------------------------------------------------------------ the decision, end to end
// A CI on refs/heads/main of github.com/example/app attests its check --json export.
const COMMIT = "c0ffee".padEnd(40, "0");
const WF_DIGEST = "d1ce57".padEnd(40, "0");
const SIGNER = "https://github.com/example/app/.github/workflows/fleet-sign.yml@refs/heads/main";

function sigstoreFleet({ policySigner = {}, identity = {}, statement, missionCommit = COMMIT, omitBundle = false, covers = "check", history } = {}) {
  const ss = makeSigstore();
  const check = realCheck();
  const bundle = makeBundle(ss, githubIdentity({ repo: "example/app", commit: COMMIT, workflowDigest: WF_DIGEST, ...identity }), statement ?? statementOver("check.json", check));
  const policy = {
    format: "runward-fleet-trust-policy/0",
    trustedRoots: ["trust/root.json"],
    signers: [{ id: "app-ci", kind: "sigstore", repositories: ["github.com/example/app"], issuer: "https://token.actions.githubusercontent.com", workflow: SIGNER, workflowDigests: [WF_DIGEST], ref: "refs/heads/main", ...policySigner }],
  };
  const files = { "trust-policy.json": policy, "trust/root.json": ss.trustedRoot, "exports/app/check.json": check };
  if (!omitBundle) files["exports/app/check.sigstore.json"] = bundle;
  if (history) files["exports/app/records.jsonl"] = history;
  const mission = { id: "app", name: "example/app", repository: "github.com/example/app", commit: missionCommit, exports: { check: { file: "exports/app/check.json" }, ...(history ? { history: { file: "exports/app/records.jsonl" } } : {}) }, signatures: [{ covers, kind: "sigstore-bundle", file: "exports/app/check.sigstore.json" }] };
  const index = indexFrom(manifestOf([mission], { trustPolicy: "trust-policy.json" }), files);
  return { index, m: index.missions[0], s: index.missions[0].signatures[0] };
}
const codes = (s) => s.reasons.map((r) => r.code);

test("keyless, valid: a pinned signer on refs/heads/main at the landing commit raises the verdict to machine-established", () => {
  const { index, m, s } = sigstoreFleet();
  assert.equal(s.state, "verified");
  assert.deepEqual(codes(s), []);
  assert.equal(s.raised, true);
  assert.deepEqual(s.binds, { how: "subject", name: "check.json" });
  assert.equal(m.latest.implemented, "machine-established");
  assert.equal(m.latest.raisedBy, "app:signature:1");
  assert.deepEqual(index.fleet.byImplemented.find((g) => g.state === "machine-established").list, ["app"]);
});

test("keyless, falsified: a statement changed after signing is refused and raises nothing", () => {
  const ss = makeSigstore();
  const bundle = makeBundle(ss, githubIdentity({ repo: "example/app", commit: COMMIT, workflowDigest: WF_DIGEST }), statementOver("check.json", realCheck()));
  const st = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, "base64").toString("utf8"));
  st.subject[0].digest.sha256 = sha(Buffer.from("another export"));
  bundle.dsseEnvelope.payload = Buffer.from(JSON.stringify(st)).toString("base64");
  const policy = { format: "runward-fleet-trust-policy/0", trustedRoots: ["root.json"], signers: [{ id: "app-ci", kind: "sigstore", repositories: ["github.com/example/app"], issuer: "https://token.actions.githubusercontent.com", workflow: SIGNER, workflowDigests: [WF_DIGEST], ref: "refs/heads/main" }] };
  const index = indexFrom(manifestOf([{ id: "app", name: "example/app", repository: "github.com/example/app", commit: COMMIT, exports: { check: { file: "check.json" } }, signatures: [{ covers: "check", kind: "sigstore-bundle", file: "b.json" }] }], { trustPolicy: "p.json" }),
    { "p.json": policy, "root.json": ss.trustedRoot, "check.json": realCheck(), "b.json": bundle });
  const [m] = index.missions;
  assert.equal(m.signatures[0].state, "refused");
  assert.equal(m.signatures[0].raised, false);
  assert.equal(m.latest.implemented, "ci-declared");
  assert.ok(m.findings.some((f) => f.what === "signature" && f.state === "refused"), "a refused signature is a finding");
});

test("keyless, absent: a declared bundle that is not there is a finding, and the cell stays ci-declared", () => {
  const { m, s } = sigstoreFleet({ omitBundle: true });
  assert.equal(s.state, "absent");
  assert.equal(m.latest.implemented, "ci-declared");
  assert.ok(m.findings.some((f) => f.what === "signature" && f.why === "declared-file-absent"));
});

test("keyless, signer outside the policy: another workflow, another digest, another issuer raise nothing", () => {
  const other = sigstoreFleet({ identity: { workflow: ".github/workflows/other.yml" } });
  assert.equal(other.s.state, "outside-policy");
  assert.deepEqual(codes(other.s), ["signer-not-in-policy"]);
  const digest = sigstoreFleet({ identity: { workflowDigest: "e".repeat(40) } });
  assert.equal(digest.s.state, "outside-policy");
  assert.deepEqual(codes(digest.s), ["workflow-digest-not-pinned"]);
  const elsewhere = sigstoreFleet({ policySigner: { repositories: ["github.com/example/other"] } });
  assert.equal(elsewhere.s.state, "outside-policy");
  assert.deepEqual(codes(elsewhere.s), ["signer-pinned-for-other-repositories"]);
  for (const x of [other, digest, elsewhere]) assert.equal(x.m.latest.implemented, "ci-declared");
});

test("ADR-0093 D4: an unpinned policy raises nothing, whatever it verifies", () => {
  const noDigest = sigstoreFleet({ policySigner: { workflowDigests: [] } });
  assert.equal(noDigest.s.state, "verified");
  assert.deepEqual(codes(noDigest.s), ["policy-unpinned-workflow-digest"]);
  assert.equal(noDigest.m.latest.implemented, "ci-declared");
  const noRef = sigstoreFleet({ policySigner: { ref: "refs/heads/release" } });
  assert.ok(codes(noRef.s).includes("policy-unpinned-ref"));
  assert.equal(noRef.m.latest.implemented, "ci-declared");
  assert.deepEqual(noRef.index.policy.signers[0].unpinned, ["ref"]);
});

test("a certificate that names another commit, another ref or another repository is never raised", () => {
  const commit = sigstoreFleet({ missionCommit: "b".repeat(40) });
  assert.deepEqual(codes(commit.s), ["signed-at-another-commit"]);
  const undeclared = sigstoreFleet({ missionCommit: null });
  assert.deepEqual(codes(undeclared.s), ["no-landing-commit"]);
  const ref = sigstoreFleet({ identity: { ref: "refs/heads/feature" }, policySigner: { workflow: "https://github.com/example/app/.github/workflows/fleet-sign.yml@refs/heads/feature" } });
  assert.ok(codes(ref.s).includes("signed-on-another-ref"));
  const repo = sigstoreFleet({ identity: { repo: "example/other" }, policySigner: { workflow: "https://github.com/example/other/.github/workflows/fleet-sign.yml@refs/heads/main" } });
  assert.ok(codes(repo.s).includes("signed-for-another-repository"), "a repository cannot sign for another");
  for (const x of [commit, undeclared, ref, repo]) assert.equal(x.m.latest.implemented, "ci-declared");
});

test("a valid signature that covers something else raises nothing; a replay is never raised", () => {
  const other = sigstoreFleet({ statement: statementOver("app.tgz", Buffer.from("a tarball")) });
  assert.deepEqual(codes(other.s), ["does-not-cover-export"]);
  assert.equal(other.m.latest.implemented, "ci-declared");
  const records = fixture("exports", "runward.records.jsonl");
  const replay = sigstoreFleet({ covers: "history", statement: statementOver("records.jsonl", records), history: records });
  assert.ok(codes(replay.s).includes("replay-never-raised"));
  assert.equal(replay.s.raised, false);
});

test("runward's real release provenance, under a policy that pins its real signer, verifies and raises nothing", () => {
  const policy = { format: "runward-fleet-trust-policy/0", trustedRoots: ["root.json"], signers: [{ id: "release", kind: "sigstore", repositories: ["github.com/stranxik/runward"], issuer: "https://token.actions.githubusercontent.com", workflow: "https://github.com/stranxik/runward/.github/workflows/build-and-attest.yml@refs/tags/v0.46.0", workflowDigests: ["192ca3d63c456a4235aac8062aff21f16733c520"], ref: "refs/tags/v0.46.0" }] };
  const index = indexFrom(manifestOf([{ id: "runward", name: "stranxik/runward", repository: "github.com/stranxik/runward", commit: "32d8425b1cb41568eab3ce29dce24f63bad8a32a", exports: { check: { file: "check.json" } }, signatures: [{ covers: "check", kind: "sigstore-bundle", file: "prov.jsonl" }] }], { trustPolicy: "p.json" }),
    { "p.json": policy, "root.json": fixture("sigstore", "trusted_root.json"), "check.json": realCheck(), "prov.jsonl": fixture("sigstore", "runward-0.46.0.provenance.intoto.jsonl") });
  const s = index.missions[0].signatures[0];
  assert.equal(s.state, "verified");
  assert.deepEqual(codes(s), ["policy-unpinned-ref", "signed-on-another-ref", "signed-at-another-commit", "does-not-cover-export"]);
  assert.equal(index.missions[0].latest.implemented, "ci-declared");
});

test("no trust policy, no trusted root: nothing is verified and nothing is raised", () => {
  const ss = makeSigstore();
  const bundle = makeBundle(ss, githubIdentity({ repo: "example/app", commit: COMMIT }), statementOver("check.json", realCheck()));
  const m1 = { id: "app", name: "example/app", repository: "github.com/example/app", commit: COMMIT, exports: { check: { file: "check.json" } }, signatures: [{ covers: "check", kind: "sigstore-bundle", file: "b.json" }] };
  const none = indexFrom(manifestOf([m1]), { "check.json": realCheck(), "b.json": bundle });
  assert.equal(none.missions[0].signatures[0].state, "not-verifiable");
  assert.deepEqual(codes(none.missions[0].signatures[0]), ["no-policy"]);
  const rootless = indexFrom(manifestOf([m1], { trustPolicy: "p.json" }), { "p.json": { format: "runward-fleet-trust-policy/0", signers: [] }, "check.json": realCheck(), "b.json": bundle });
  assert.deepEqual(codes(rootless.missions[0].signatures[0]), ["no-trusted-root"]);
});

// ------------------------------------------------------------------ a dedicated Ed25519 key
function keyFleet({ tamper, signWith, claimed, repositories = ["github.com/example/app"], manifest: change = {}, omitSig = false, keyDigest } = {}) {
  const ci = generateKeyPairSync("ed25519");
  const other = generateKeyPairSync("ed25519");
  const verdict = fixture("exports", "runward.verdict.intoto.json");
  const doc = { schema: "dropyour.preuves-ci.v2", depot: "example/app", commit: COMMIT, ref: "refs/heads/main", run: "42", fichiers: [{ chemin: "verdict.intoto.json", sha256: sha(verdict) }], ...change };
  let bytes = Buffer.from(`${JSON.stringify(doc, null, 2)}\n`);
  const sig = sign(null, bytes, (signWith === "other" ? other : ci).privateKey).toString("base64");
  if (tamper) { bytes = Buffer.from(bytes); bytes[bytes.indexOf("42")] = "3".charCodeAt(0); }
  const pem = ci.publicKey.export({ type: "spki", format: "pem" });
  const digest = `sha256:${sha(ci.publicKey.export({ type: "spki", format: "der" }))}`;
  const files = {
    "trust-policy.json": { format: "runward-fleet-trust-policy/0", signers: [{ id: "app-ci-key", kind: "ed25519", repositories, publicKey: "keys/ci.pem", keyDigest: keyDigest ?? digest, ref: "refs/heads/main", manifestFormat: "dropyour.preuves-ci.v2" }] },
    "keys/ci.pem": pem,
    "preuves-ci/verdict.intoto.json": verdict,
    "preuves-ci/manifeste.json": bytes,
  };
  if (!omitSig) files["preuves-ci/manifeste.sig"] = `${sig}\n`;
  if (claimed) files["preuves-ci/cle-publique.pem"] = other.publicKey.export({ type: "spki", format: "pem" });
  const mission = { id: "app", name: "example/app", repository: "github.com/example/app", commit: COMMIT, exports: { attestation: { file: "preuves-ci/verdict.intoto.json" } },
    signatures: [{ covers: "attestation", kind: "ed25519-manifest", format: "dropyour.preuves-ci.v2", manifest: "preuves-ci/manifeste.json", signature: "preuves-ci/manifeste.sig", ...(claimed ? { claimedKey: "preuves-ci/cle-publique.pem" } : {}) }] };
  const index = indexFrom(manifestOf([mission], { trustPolicy: "trust-policy.json" }), files);
  return { index, m: index.missions[0], s: index.missions[0].signatures[0] };
}

test("Ed25519, valid: a CI's signed evidence folder raises the verdict read from its attestation", () => {
  const { m, s } = keyFleet();
  assert.equal(s.state, "verified");
  assert.equal(s.via, "ed25519");
  assert.deepEqual(codes(s), []);
  assert.deepEqual(s.binds, { how: "file", name: "verdict.intoto.json" });
  assert.equal(m.latest.from, "attestation", "with no check export, the verdict is read from the attestation's predicate");
  assert.equal(m.latest.implemented, "machine-established");
  assert.equal(m.attestation.implemented, "machine-established");
  assert.equal(trust.KEY_SIGNATURES_RAISE, true, "v1 raises key-signed exports and says a key names its holder (the pull request's open question)");
});

test("Ed25519, falsified: one byte of the manifest changed after signing is refused", () => {
  const { m, s } = keyFleet({ tamper: true });
  assert.equal(s.state, "refused");
  assert.deepEqual(codes(s), ["signature-does-not-verify"]);
  assert.equal(m.latest.implemented, "ci-declared");
});

test("Ed25519, absent: a manifest without its signature file is a finding", () => {
  const { m, s } = keyFleet({ omitSig: true });
  assert.equal(s.state, "absent");
  assert.equal(m.latest.implemented, "ci-declared");
  assert.ok(m.findings.some((f) => f.what === "signature" && f.why === "declared-file-absent"));
});

test("Ed25519, signer outside the policy: another key, or a key pinned for another repository, raises nothing", () => {
  const other = keyFleet({ signWith: "other", claimed: true });
  assert.equal(other.s.state, "outside-policy");
  assert.deepEqual(codes(other.s), ["key-not-in-policy"]);
  const unknown = keyFleet({ signWith: "other" });
  assert.equal(unknown.s.state, "refused", "without the key it claims, a signature no pinned key verifies is refused");
  const elsewhere = keyFleet({ repositories: ["github.com/example/other"] });
  assert.equal(elsewhere.s.state, "outside-policy");
  assert.deepEqual(codes(elsewhere.s), ["signer-pinned-for-other-repositories"]);
  for (const x of [other, unknown, elsewhere]) assert.equal(x.m.latest.implemented, "ci-declared");
});

test("Ed25519: a manifest for another commit, ref or repository, or that lists other files, raises nothing", () => {
  assert.deepEqual(codes(keyFleet({ manifest: { commit: "b".repeat(40) } }).s), ["signed-at-another-commit"]);
  assert.deepEqual(codes(keyFleet({ manifest: { ref: "refs/heads/dev" } }).s), ["signed-on-another-ref"]);
  assert.deepEqual(codes(keyFleet({ manifest: { depot: "example/other" } }).s), ["signed-for-another-repository"]);
  assert.deepEqual(codes(keyFleet({ manifest: { fichiers: [{ chemin: "verdict.intoto.json", sha256: "0".repeat(64) }] } }).s), ["does-not-cover-export"]);
});

test("a trust policy that pins a key under a digest that is not the key's is refused: the build stops", () => {
  assert.throws(() => keyFleet({ keyDigest: `sha256:${"0".repeat(64)}` }), (e) => e instanceof build.BuildError && /keyDigest/.test(e.message));
  assert.throws(() => indexFrom(manifestOf([], { trustPolicy: "p.json" }), { "p.json": { format: "another/1", signers: [] } }), build.BuildError);
  assert.throws(() => indexFrom(manifestOf([], { trustPolicy: "p.json" }), { "p.json": { format: "runward-fleet-trust-policy/0", signers: [{ id: "x", kind: "sigstore", repositories: ["not a repo"] }] } }), /repositories/);
});
