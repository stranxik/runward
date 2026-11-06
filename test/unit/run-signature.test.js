// ADR-0120 D4a, its acceptance: the identity half of `attested`, verified offline by runward-fleet
// (`verify-run`) against the operator's trust policy, never by runward's CLI (which counts the signature
// and says so, ADR-0119 decision 5).
//
//   - a Statement signed from the mission's own caller workflow is refused;
//   - one signed by an unpinned signer workflow is refused (not in the policy, or no commit pinned);
//   - one signed by the pinned workflow at another commit is refused, and so is one signed for another
//     commit of the mission;
//   - a Statement the agent signs with a key of its own is refused;
//   - what the executing job could make without id-token (R1): no signature the trust policy accepts;
//   - the pinned one is accepted, on GitHub (a reusable workflow) and on GitLab (the runner project), and
//     with the operator's own key on an offline instance.
// The Sigstore here is the tests' own (test/support/fleet-sigstore.js): keys generated at each run, no
// network. The Statement is the one runward-run builds (its statement.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { PKG, ROOT, trust } from "../support/fleet.js";
import { makeBundle, makeSigstore } from "../support/fleet-sigstore.js";

const runSig = await import(pathToFileURL(join(PKG, "src", "run-signature.js")).href);
const { buildRunStatement } = await import(pathToFileURL(join(ROOT, "packages", "runward-run", "src", "statement.js")).href);
const FLEET_CLI = join(PKG, "src", "cli.js");

const COMMIT = "c0ffee".padEnd(40, "0");
const OTHER = "badbad".padEnd(40, "0");
const WF = "d1ce57".padEnd(40, "0");
const ISSUER = "https://token.actions.githubusercontent.com";
const SIGNER = "https://github.com/example/ci/.github/workflows/runward-run.yml@refs/heads/main";
const MISSION = "github.com/example/app";

/** A run Statement as runward-run writes it, for a mission at a commit. */
function runStatement({ commit = COMMIT, repository = MISSION, ref = "refs/heads/main" } = {}) {
  return buildRunStatement({
    version: "0.46.0", mission: { repository, commit, ref }, policySha256: "1".repeat(64),
    image: "node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c",
    runtime: { name: "docker", version: "27.5.1" },
    install: { command: ["npm", "ci", "--ignore-scripts"], cwd: "code", exitCode: 0, network: "open", installScripts: "disabled" },
    lockfile: { path: "code/package-lock.json", sha256: "2".repeat(64) },
    legs: [{ leg: "tests", cwd: "code", command: ["node", "--test"], exitCode: 0, reports: ["code/reports/junit.xml"] }],
    manifests: { files: ["runward/floor.md"], digest: "3".repeat(64) },
    sources: { "code/src/a.ts": "4".repeat(64) },
    expected: { rule: "r", from: "runward check --strict --require attested --json (levels.execution.expected)", runward: "0.46.0" },
    reports: [{ path: "code/reports/junit.xml", sha256: "5".repeat(64) }],
  });
}

/** The identity GitHub gives a job of a reusable workflow `signer` called by `source` at `commit`. */
function reusableIdentity({ signer = SIGNER, signerDigest = WF, source = "example/app", commit = COMMIT, ref = "refs/heads/main", caller = ".github/workflows/runward.yml" } = {}) {
  const config = `https://github.com/${source}/${caller}@${ref}`;
  return {
    san: signer,
    claims: { 8: ISSUER, 9: signer, 10: signerDigest, 11: "github-hosted", 12: `https://github.com/${source}`, 13: commit, 14: ref, 18: config, 19: commit, 20: "push", 21: `https://github.com/${source}/actions/runs/7/attempts/1`, 22: "public" },
  };
}

function policyFor(ss, signers, files = {}) {
  const doc = { format: "runward-fleet-trust-policy/0", trustedRoots: ["root.json"], signers };
  const map = new Map(Object.entries({ "root.json": JSON.stringify(ss.trustedRoot), ...files }).map(([k, v]) => [k, Buffer.from(v)]));
  return trust.readPolicy(doc, (rel) => map.get(rel) ?? null);
}
const pinned = (over = {}) => ({ id: "runward-run", kind: "sigstore", repositories: [MISSION], issuer: ISSUER, workflow: SIGNER, workflowDigests: [WF], ref: "refs/heads/main", ...over });
const verify = (document, policy, expect = {}, unsigned = null) => runSig.verifyRunSignature({ document, policy, expect: { repository: MISSION, commit: COMMIT, ...expect }, unsigned });
const codes = (r) => r.reasons.map((x) => x.code);

test("D4a: the pinned reusable workflow, at its pinned commit, for this repository and commit, is accepted, and a landing on the protected ref", () => {
  const ss = makeSigstore();
  const st = runStatement();
  const r = verify(makeBundle(ss, reusableIdentity(), st), policyFor(ss, [pinned()]), {}, st);
  assert.deepEqual(codes(r), []);
  assert.equal(r.accepted, true);
  assert.equal(r.signer, "runward-run");
  assert.deepEqual(r.vouched, { repository: MISSION, commit: COMMIT, ref: "refs/heads/main", from: "certificate" }, "on GitHub the mission's commit is the certificate's");
  assert.equal(r.landing, true);
  const pr = verify(makeBundle(ss, reusableIdentity({ ref: "refs/pull/3/merge" }), runStatement({ ref: "refs/pull/3/merge" })), policyFor(ss, [pinned()]));
  assert.equal(pr.accepted, true, "a pull request's run is verified");
  assert.equal(pr.landing, false, "and raises no landing: only the protected ref does (ADR-0093 decision 8)");
});

test("D4a: a Statement signed from the mission's own caller workflow is refused, even under a policy that pins it", () => {
  const ss = makeSigstore();
  const own = "https://github.com/example/app/.github/workflows/runward.yml@refs/heads/main";
  const bundle = makeBundle(ss, reusableIdentity({ signer: own, signerDigest: COMMIT }), runStatement());
  const r = verify(bundle, policyFor(ss, [pinned()]));
  assert.equal(r.accepted, false);
  assert.deepEqual(codes(r), ["signed-from-the-mission-workflow"]);
  const lax = verify(bundle, policyFor(ss, [pinned({ workflow: own, workflowDigests: [COMMIT] })]));
  assert.equal(lax.accepted, false, "the agent can write that file: no policy makes its identity one out of the agent's reach");
  assert.ok(codes(lax).includes("signed-from-the-mission-workflow"));
});

test("D4a: an unpinned signer workflow is refused: one the policy does not name, or names without a commit", () => {
  const ss = makeSigstore();
  const elsewhere = "https://github.com/someone/else/.github/workflows/sign.yml@refs/heads/main";
  const r = verify(makeBundle(ss, reusableIdentity({ signer: elsewhere }), runStatement()), policyFor(ss, [pinned()]));
  assert.deepEqual([r.accepted, codes(r)], [false, ["signer-not-in-policy"]]);
  const noCommit = verify(makeBundle(ss, reusableIdentity(), runStatement()), policyFor(ss, [pinned({ workflowDigests: [] })]));
  assert.deepEqual([noCommit.accepted, codes(noCommit)], [false, ["policy-unpinned-workflow-digest"]], "a workflow named without its commit accepts that file at any commit (ADR-0110 measured it of a ref)");
  const otherRepo = verify(makeBundle(ss, reusableIdentity(), runStatement()), policyFor(ss, [pinned({ repositories: ["github.com/example/other"] })]));
  assert.deepEqual([otherRepo.accepted, codes(otherRepo)], [false, ["signer-pinned-for-other-repositories"]], "a repository cannot sign for another");
});

test("D4a: the pinned workflow at another commit is refused, and so is a signature for another commit of the mission", () => {
  const ss = makeSigstore();
  const moved = verify(makeBundle(ss, reusableIdentity({ signerDigest: OTHER }), runStatement()), policyFor(ss, [pinned()]));
  assert.deepEqual([moved.accepted, codes(moved)], [false, ["workflow-digest-not-pinned"]]);
  const stale = verify(makeBundle(ss, reusableIdentity({ commit: OTHER }), runStatement({ commit: OTHER })), policyFor(ss, [pinned()]));
  assert.deepEqual([stale.accepted, codes(stale)], [false, ["signed-at-another-commit"]], "a signature of another commit's run is not this verdict's");
  const lying = verify(makeBundle(ss, reusableIdentity(), runStatement({ commit: OTHER })), policyFor(ss, [pinned()]));
  assert.ok(codes(lying).includes("statement-names-another-commit"), "the Statement may not say another commit than its certificate");
});

test("D4a: a Statement the agent signs with a key of its own is refused; the operator's pinned key is accepted (an offline instance)", () => {
  const ss = makeSigstore();
  const st = runStatement();
  const envelope = (keyPair) => {
    const payload = Buffer.from(JSON.stringify(st));
    const pae = Buffer.concat([Buffer.from(`DSSEv1 28 application/vnd.in-toto+json ${payload.length} `), payload]);
    return { payloadType: "application/vnd.in-toto+json", payload: payload.toString("base64"), signatures: [{ keyid: "", sig: sign("sha256", pae, keyPair.privateKey).toString("base64") }] };
  };
  const operator = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const agent = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = operator.publicKey.export({ type: "spki", format: "pem" });
  const keyDigest = `sha256:${createHash("sha256").update(operator.publicKey.export({ type: "spki", format: "der" })).digest("hex")}`;
  const policy = policyFor(ss, [{ id: "offline-signer", kind: "key", repositories: [MISSION], publicKey: "keys/ci.pem", keyDigest, ref: "refs/heads/main" }], { "keys/ci.pem": pem });
  const own = verify(envelope(agent), policy);
  assert.deepEqual([own.accepted, codes(own)], [false, ["key-not-in-policy"]]);
  const ok = verify(envelope(operator), policy);
  assert.deepEqual(codes(ok), []);
  assert.equal(ok.accepted, true);
  assert.deepEqual(ok.vouched, { repository: MISSION, commit: COMMIT, ref: "refs/heads/main", from: "statement" }, "a key names its holder, not the workflow: the commit is what the signed Statement says");
  // The same key signature inside a Sigstore bundle with a public key hint (cosign --key --bundle).
  const keyBundle = { mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json", verificationMaterial: { publicKey: { hint: "ci" } }, dsseEnvelope: envelope(operator) };
  assert.equal(verify(keyBundle, policy).accepted, true);
  assert.throws(() => trust.readPolicy({ format: "runward-fleet-trust-policy/0", signers: [{ id: "k", kind: "key", repositories: [MISSION], publicKey: "keys/ci.pem", keyDigest: "sha256:" + "0".repeat(64) }] }, () => Buffer.from(pem)), /not the digest of the key/, "a key is pinned by its digest, and a wrong digest stops");
});

test("R1 and D4a: what the executing job can make without id-token is no signature the trust policy accepts", () => {
  const ss = makeSigstore();
  const st = runStatement();
  const policy = policyFor(ss, [pinned()]);
  // It cannot obtain a certificate from the trusted authority without an OIDC token. What it can make:
  // a certificate from an authority of its own, with the very claims of the signing job...
  const rogue = makeSigstore();
  const selfIssued = verify(makeBundle(rogue, reusableIdentity(), st), policy);
  assert.equal(selfIssued.accepted, false);
  assert.ok(codes(selfIssued).includes("signature-does-not-verify"));
  assert.ok(selfIssued.reasons[0].checks.includes("certificate-chain") || selfIssued.reasons[0].checks.includes("tlog-key"), JSON.stringify(selfIssued.reasons));
  // ...a key of its own...
  const k = generateKeyPairSync("ed25519");
  const payload = Buffer.from(JSON.stringify(st));
  const pae = Buffer.concat([Buffer.from(`DSSEv1 28 application/vnd.in-toto+json ${payload.length} `), payload]);
  const env = { payloadType: "application/vnd.in-toto+json", payload: payload.toString("base64"), signatures: [{ sig: sign(null, pae, k.privateKey).toString("base64") }] };
  assert.deepEqual(codes(verify(env, policy)), ["key-not-in-policy"]);
  // ...or nothing at all, which runward already reads as declared.
  assert.deepEqual(codes(verify({ ...env, signatures: [] }, policy)), ["no-signature"]);
  // And a genuine bundle whose Statement it rewrote after the signing job signed is refused too.
  const good = makeBundle(ss, reusableIdentity(), st);
  const tampered = { ...good, dsseEnvelope: { ...good.dsseEnvelope, payload: Buffer.from(JSON.stringify(runStatement({ commit: OTHER }))).toString("base64") } };
  assert.ok(codes(verify(tampered, policy)).includes("signature-does-not-verify"));
});

test("D4a, GitLab at parity: the runner project's pipeline signs, and the mission's commit is the one its signed Statement names", () => {
  const ss = makeSigstore();
  const runner = "https://gitlab.example/group/runner//.gitlab-ci.yml@refs/heads/main";
  const gl = { san: runner, claims: { 8: "https://gitlab.example", 9: runner, 10: WF, 11: "self-hosted", 12: "https://gitlab.example/group/runner", 13: WF, 14: "refs/heads/main", 18: runner, 19: WF, 20: "pipeline", 21: "https://gitlab.example/group/runner/-/pipelines/9", 22: "private" } };
  const mission = "gitlab.example/group/app";
  const st = runStatement({ repository: mission });
  const policy = policyFor(ss, [pinned({ id: "gl-runner", issuer: "https://gitlab.example", workflow: runner, repositories: [mission] })]);
  const r = runSig.verifyRunSignature({ document: makeBundle(ss, gl, st), policy, expect: { repository: mission, commit: COMMIT } });
  assert.deepEqual(codes(r), []);
  assert.equal(r.accepted, true);
  assert.equal(r.vouched.from, "statement");
  assert.equal(runSig.workflowRepository(runner), "gitlab.example/group/runner");
  assert.equal(runSig.workflowRepository(SIGNER), "github.com/example/ci");
  // The mission's own pipeline signing (its .gitlab-ci.yml) is refused as on GitHub.
  const own = "https://gitlab.example/group/app//.gitlab-ci.yml@refs/heads/main";
  const mine = runSig.verifyRunSignature({ document: makeBundle(ss, { san: own, claims: { ...gl.claims, 9: own, 12: "https://gitlab.example/group/app", 18: own } }, st), policy, expect: { repository: mission, commit: COMMIT } });
  assert.ok(codes(mine).includes("signed-from-the-mission-workflow"));
});

test("D4a: `runward-fleet verify-run` reads files only and answers by its exit code: 0 accepted, 1 refused, 2 a question it cannot ask", () => {
  const ss = makeSigstore();
  const dir = mkdtempSync(join(tmpdir(), "rw-verify-run-"));
  try {
    const st = runStatement();
    writeFileSync(join(dir, "root.json"), JSON.stringify(ss.trustedRoot));
    writeFileSync(join(dir, "trust-policy.json"), JSON.stringify({ format: "runward-fleet-trust-policy/0", trustedRoots: ["root.json"], signers: [pinned()] }));
    writeFileSync(join(dir, "runward-run.intoto.json"), JSON.stringify(st));
    writeFileSync(join(dir, "good.sigstore.json"), `${JSON.stringify(makeBundle(ss, reusableIdentity(), st))}\n`);
    writeFileSync(join(dir, "moved.sigstore.json"), JSON.stringify(makeBundle(ss, reusableIdentity({ signerDigest: OTHER }), st)));
    const cli = (...a) => spawnSync(process.execPath, [FLEET_CLI, "verify-run", ...a], { encoding: "utf8", cwd: dir });
    const base = ["--policy", "trust-policy.json", "--repository", MISSION, "--commit", COMMIT, "--statement", "runward-run.intoto.json"];
    const ok = cli("good.sigstore.json", ...base);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /accepted: good\.sigstore\.json is signed by runward-run \(https:\/\/github\.com\/example\/ci\/\.github\/workflows\/runward-run\.yml@refs\/heads\/main at d1ce57/);
    assert.match(ok.stdout, /a landing/);
    const json = JSON.parse(cli("good.sigstore.json", ...base, "--json").stdout);
    assert.equal(json.accepted, true);
    const moved = cli("moved.sigstore.json", ...base);
    assert.equal(moved.status, 1);
    assert.match(moved.stderr, /the pinned workflow, at a commit the policy does not pin/);
    writeFileSync(join(dir, "other-run.intoto.json"), JSON.stringify(runStatement({ ref: "refs/heads/dev" })));
    const differs = cli("good.sigstore.json", "--policy", "trust-policy.json", "--repository", MISSION, "--commit", COMMIT, "--statement", "other-run.intoto.json");
    assert.equal(differs.status, 1);
    assert.match(differs.stderr, /not the run Statement it is checked against/);
    assert.equal(cli("good.sigstore.json", "--policy", "trust-policy.json", "--repository", MISSION).status, 2, "no commit: no question");
    writeFileSync(join(dir, "bad-policy.json"), JSON.stringify({ format: "nope" }));
    assert.equal(cli("good.sigstore.json", "--policy", "bad-policy.json", "--repository", MISSION, "--commit", COMMIT).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
