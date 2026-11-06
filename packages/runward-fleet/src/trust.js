// The trust policy and the one decision that raises a cell (ADR-0093 decision 8).
//
// runward writes every record at `ci-declared` at most and never verifies a signature. This module
// is where a cell may go higher: to `machine-established`, and only when ALL of these hold for a
// signature the operator declared next to an export:
//   1. it verifies (offline, against the trusted root or the key the policy pins);
//   2. its signer is one the operator's trust-policy.json pins for THIS repository: a repository
//      cannot sign for another;
//   3. that policy entry pins `refs/heads/main` and, for a CI certificate, the workflow file digest;
//      an entry that does not raises nothing, whatever it verifies;
//   4. the signed ref is that protected ref, and the signed commit is the landing commit declared in
//      fleet.json for these exports (no declared commit, nothing to compare, nothing raised);
//   5. what was signed covers the very bytes of the export (the statement itself, or a subject or a
//      listed file whose sha256 is the export's);
//   6. the export is not a replay: a replayed record is never raised.
// Any other outcome leaves the cell at `ci-declared` and says why, by a reason code the views
// translate and docs/spec/runward-fleet.md lists.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readTrustedRoot, verifyBundle } from "./sigstore.js";
import { MANIFEST_FORMATS, readEd25519Key, readSignedManifest } from "./ed25519.js";
import { BuildError } from "./errors.js";

export const POLICY_FORMAT = "runward-fleet-trust-policy/0";
export const PROTECTED_REF = "refs/heads/main";
// ADR-0093 decision 8 names a certificate; a key names no workflow. v1 raises a key-signed export
// under the key, repository and protected-ref pins and says "a key names its holder, not the
// workflow" wherever the cell is shown. Whether that stays is the maintainer's open question in the
// pull request that introduced it; turning this off leaves every key-signed export at ci-declared.
export const KEY_SIGNATURES_RAISE = true;

const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const REPO = /^[a-z0-9.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const normRepo = (s) => String(s ?? "").replace(/^https?:\/\//, "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();

function fail(msg) { throw new BuildError(`trust-policy.json: ${msg}`); }

/**
 * Read and validate a trust policy. A malformed policy is refused (the build stops): a page built on
 * a policy nobody can read would claim a check it did not make. An entry that is well formed but
 * does not pin what decision 8 requires is kept, and marked unpinned: it raises nothing.
 * `read(rel)` returns the bytes of a file named relative to the policy, or null.
 */
export function readPolicy(doc, read) {
  if (!doc || doc.format !== POLICY_FORMAT) fail(`format must be "${POLICY_FORMAT}" (found ${JSON.stringify(doc?.format)})`);
  const roots = [];
  for (const rel of doc.trustedRoots ?? []) {
    if (typeof rel !== "string" || rel.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rel)) fail(`trustedRoots: ${JSON.stringify(rel)} must be a path relative to the policy`);
    const buf = read(rel);
    if (!buf) fail(`trusted root ${rel} is declared and absent`);
    let parsed;
    try { parsed = JSON.parse(buf.toString("utf8")); } catch { fail(`trusted root ${rel} is not JSON`); }
    let root;
    try { root = readTrustedRoot(parsed); } catch (e) { fail(`trusted root ${rel}: ${e.message}`); }
    roots.push({ path: rel, sha256: sha256hex(buf), bytes: buf.length, mediaType: parsed.mediaType, root, logs: root.tlogs.length, authorities: root.cas.length });
  }
  if (!Array.isArray(doc.signers)) fail("signers must be a list");
  const ids = new Set();
  const signers = doc.signers.map((s, i) => {
    const where = `signers[${i}]`;
    if (!s || typeof s.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s.id)) fail(`${where}: id must be a plain identifier`);
    if (ids.has(s.id)) fail(`${where}: id ${s.id} is used twice`);
    ids.add(s.id);
    if (!Array.isArray(s.repositories) || s.repositories.length === 0 || !s.repositories.every((r) => typeof r === "string" && REPO.test(r))) {
      fail(`${where}: repositories must list host/owner/repo identities (e.g. github.com/org/app)`);
    }
    const entry = { id: s.id, kind: s.kind, repositories: s.repositories.map(normRepo), ref: typeof s.ref === "string" ? s.ref : null, unpinned: [] };
    if (entry.ref !== PROTECTED_REF) entry.unpinned.push("ref");
    if (s.kind === "sigstore") {
      for (const k of ["issuer", "workflow"]) if (typeof s[k] !== "string" || !s[k]) fail(`${where}: a sigstore signer names its ${k}`);
      entry.issuer = s.issuer;
      entry.workflow = s.workflow;
      const digests = s.workflowDigests ?? [];
      if (!Array.isArray(digests) || !digests.every((d) => typeof d === "string" && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(d))) fail(`${where}: workflowDigests must list git commit digests`);
      entry.workflowDigests = digests;
      if (digests.length === 0) entry.unpinned.push("workflow-digest");
      if (s.runnerEnvironment !== undefined) entry.runnerEnvironment = String(s.runnerEnvironment);
    } else if (s.kind === "ed25519") {
      let material = null;
      if (typeof s.publicKey === "string") {
        if (s.publicKey.startsWith("/") || /^[A-Za-z]:[\\/]/.test(s.publicKey)) fail(`${where}: publicKey must be a path relative to the policy`);
        const buf = read(s.publicKey);
        if (!buf) fail(`${where}: public key ${s.publicKey} is declared and absent`);
        material = buf.toString("utf8");
        entry.publicKey = s.publicKey;
      } else if (s.jwk && typeof s.jwk === "object") {
        material = s.jwk;
        entry.publicKey = "jwk";
      } else fail(`${where}: an ed25519 signer names its publicKey (a PEM file) or its jwk`);
      let k;
      try { k = readEd25519Key(material); } catch (e) { fail(`${where}: ${e.message}`); }
      if (typeof s.keyDigest !== "string") fail(`${where}: keyDigest pins the key (sha256 of its SPKI), and is required`);
      if (s.keyDigest !== k.digest) fail(`${where}: keyDigest ${s.keyDigest} is not the digest of the key it names (${k.digest})`);
      entry.key = k.key;
      entry.keyDigest = k.digest;
      if (typeof s.manifestFormat !== "string") fail(`${where}: an ed25519 signer names the manifestFormat it signs`);
      entry.manifestFormat = s.manifestFormat;
    } else {
      fail(`${where}: kind must be "sigstore" or "ed25519"`);
    }
    entry.pinned = entry.unpinned.length === 0;
    return entry;
  });
  return { roots, signers };
}

/** What the page may show of a policy (no key objects). */
export function describePolicy(policy) {
  return {
    trustedRoots: policy.roots.map((r) => ({ path: r.path, sha256: r.sha256, mediaType: r.mediaType, logs: r.logs, authorities: r.authorities })),
    signers: policy.signers.map((s) => ({
      id: s.id, kind: s.kind, repositories: s.repositories, ref: s.ref, pinned: s.pinned, unpinned: s.unpinned,
      ...(s.kind === "sigstore" ? { issuer: s.issuer, workflow: s.workflow, workflowDigests: s.workflowDigests, runnerEnvironment: s.runnerEnvironment ?? null }
        : { publicKey: s.publicKey, keyDigest: s.keyDigest, manifestFormat: s.manifestFormat }),
    })),
  };
}

/** Does a signed statement cover an export? Returns how, or null. */
function bindsStatement(statement, payload, exp) {
  if (!exp) return null;
  if (payload && payload.equals(exp.bytes)) return { how: "payload" };
  if (exp.json !== undefined && isDeepStrictEqual(statement, exp.json)) return { how: "statement" };
  const hit = (statement?.subject ?? []).find((s) => s?.digest?.sha256 === exp.sha256);
  return hit ? { how: "subject", name: String(hit.name ?? "") } : null;
}

/**
 * Evaluate one declared signature. `ctx` holds the mission (id, repository, declared commit), its
 * exports by kind (bytes, sha256, parsed json, origin), the policy (or null) and a reader for the
 * signature's files. Returns the state, whether it raised the export it covers, and why not.
 */
export function evaluateSignature(decl, ctx) {
  const r = { kind: decl.kind, covers: decl.covers, state: "not-verifiable", raised: false, via: null, signer: null, identity: null, checks: [], binds: null, reasons: [] };
  const reason = (code, params = {}) => r.reasons.push({ code, ...params });
  const exp = ctx.exports[decl.covers] ?? null;
  const repo = normRepo(ctx.mission.repository);

  if (decl.kind === "sigstore-bundle") {
    r.via = "sigstore";
    const buf = ctx.read(decl.file);
    if (!buf) { r.state = "absent"; reason("signature-file-absent", { file: decl.file }); return r; }
    if (!ctx.policy) { reason("no-policy"); return r; }
    if (ctx.policy.roots.length === 0) { reason("no-trusted-root"); return r; }
    let bundle;
    try { bundle = JSON.parse(buf.toString("utf8").split("\n").find((l) => l.trim()) ?? ""); } catch { r.state = "refused"; reason("bundle-unreadable"); return r; }
    let v;
    // A bundle is untrusted input: whatever shape it has, it is refused, never a crash of the build.
    try { v = verifyBundle(bundle, ctx.policy.roots.map((x) => x.root)); } catch { r.state = "refused"; reason("bundle-unreadable"); return r; }
    r.checks = v.checks;
    r.identity = v.identity;
    if (!v.ok) {
      const failed = v.checks.filter((c) => !c.ok);
      // Refused when a check failed on its own merits; not verifiable when every failure is a
      // feature this version does not verify (or a check skipped because of one).
      const unsupported = failed.some((c) => c.as === "unsupported") && failed.every((c) => c.as === "unsupported" || c.as === "skipped");
      r.state = unsupported ? "not-verifiable" : "refused";
      reason(unsupported ? "unsupported-bundle" : "signature-does-not-verify", { checks: failed.map((c) => c.id) });
      return r;
    }
    const id = v.identity;
    const candidates = ctx.policy.signers.filter((s) => s.kind === "sigstore" && s.issuer === id.issuer && s.workflow === id.buildSignerURI);
    const forRepo = candidates.filter((s) => s.repositories.includes(repo));
    const entry = forRepo.find((s) => s.workflowDigests.length === 0 || s.workflowDigests.includes(id.buildSignerDigest)) ?? null;
    if (!entry) {
      r.state = "outside-policy";
      if (candidates.length && !forRepo.length) reason("signer-pinned-for-other-repositories", { workflow: id.buildSignerURI });
      else if (forRepo.length) reason("workflow-digest-not-pinned", { workflow: id.buildSignerURI, digest: id.buildSignerDigest });
      else reason("signer-not-in-policy", { workflow: id.buildSignerURI ?? null, issuer: id.issuer ?? null });
      return r;
    }
    r.state = "verified";
    r.signer = entry.id;
    const signedRepo = normRepo(id.sourceRepositoryURI);
    if (!entry.pinned) for (const u of entry.unpinned) reason(u === "ref" ? "policy-unpinned-ref" : "policy-unpinned-workflow-digest", { signer: entry.id });
    if (signedRepo !== repo) reason("signed-for-another-repository", { signed: signedRepo, mission: repo });
    if (id.sourceRepositoryRef !== PROTECTED_REF) reason("signed-on-another-ref", { signed: id.sourceRepositoryRef ?? null, pinned: PROTECTED_REF });
    if (entry.runnerEnvironment && id.runnerEnvironment !== entry.runnerEnvironment) reason("runner-not-pinned", { signed: id.runnerEnvironment ?? null, pinned: entry.runnerEnvironment });
    commitReasons(id.sourceRepositoryDigest, ctx, reason);
    const b = bindsStatement(v.statement, v.payload, exp);
    if (b) r.binds = b; else reason("does-not-cover-export", { covers: decl.covers });
  } else if (decl.kind === "ed25519-manifest") {
    r.via = "ed25519";
    const manifest = ctx.read(decl.manifest);
    const sigBuf = ctx.read(decl.signature);
    if (!manifest || !sigBuf) { r.state = "absent"; reason("signature-file-absent", { file: !manifest ? decl.manifest : decl.signature }); return r; }
    if (!ctx.policy) { reason("no-policy"); return r; }
    const keys = ctx.policy.signers.filter((s) => s.kind === "ed25519" && s.manifestFormat === decl.format);
    let claimed = null;
    if (decl.claimedKey) {
      const kb = ctx.read(decl.claimedKey);
      if (kb) { try { claimed = readEd25519Key(kb.toString("utf8")); } catch { claimed = null; } }
    }
    if (!Object.hasOwn(MANIFEST_FORMATS, decl.format)) { reason("unsupported-manifest-format", { format: String(decl.format) }); return r; }
    const m = readSignedManifest({ manifest, signature: sigBuf.toString("utf8"), format: decl.format, keys, claimed });
    r.checks = [
      { id: "manifest-format", ok: Boolean(m.claims), detail: m.claims ? decl.format : (m.reason ?? "unreadable") },
      { id: "ed25519-signature", ok: Boolean(m.verifiedBy), detail: m.verifiedBy ? `verifies under the key ${m.verifiedBy.keyDigest} the policy pins` : m.claimedVerifies ? "verifies only under a key the policy does not pin" : "verifies under no key this build knows" },
    ];
    if (m.claims) r.identity = { repository: m.claims.repository, commit: m.claims.commit, ref: m.claims.ref, run: m.claims.run, key: m.verifiedBy?.keyDigest ?? (m.claimedVerifies ? claimed.digest : null) };
    if (!m.verifiedBy) {
      r.state = m.claimedVerifies ? "outside-policy" : "refused";
      reason(m.claimedVerifies ? "key-not-in-policy" : "signature-does-not-verify", { checks: ["ed25519-signature"] });
      return r;
    }
    if (!m.claims) { r.state = "refused"; reason("manifest-unreadable"); return r; }
    const entry = m.verifiedBy;
    if (!entry.repositories.includes(repo)) { r.state = "outside-policy"; reason("signer-pinned-for-other-repositories", { key: entry.keyDigest }); return r; }
    r.state = "verified";
    r.signer = entry.id;
    if (!KEY_SIGNATURES_RAISE) reason("key-signatures-do-not-raise");
    if (!entry.pinned) reason("policy-unpinned-ref", { signer: entry.id });
    if (normRepo(m.claims.repository) !== repo) reason("signed-for-another-repository", { signed: normRepo(m.claims.repository), mission: repo });
    if (m.claims.ref !== PROTECTED_REF) reason("signed-on-another-ref", { signed: m.claims.ref, pinned: PROTECTED_REF });
    commitReasons(m.claims.commit, ctx, reason);
    const hit = exp ? m.claims.files.find((f) => f.sha256 === exp.sha256) : null;
    if (hit) r.binds = { how: "file", name: hit.path }; else reason("does-not-cover-export", { covers: decl.covers });
  } else {
    reason("unsupported-signature-kind", { kind: String(decl.kind) });
    return r;
  }
  if (exp?.origin === "replayed") reason("replay-never-raised");
  r.raised = r.state === "verified" && r.reasons.length === 0;
  return r;
}

function commitReasons(signed, ctx, reason) {
  const declared = ctx.mission.commit;
  if (!declared) reason("no-landing-commit", { signed: signed ?? null });
  else if (String(signed ?? "").toLowerCase() !== declared.toLowerCase()) reason("signed-at-another-commit", { signed: signed ?? null, declared });
}
