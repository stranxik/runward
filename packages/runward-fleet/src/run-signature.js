// The identity half of `attested` (runward ADR-0119 decision 5, ADR-0120 decision 5, delivery D4a):
// whether the signature on a runward-run Statement verifies offline, against the operator's trust
// policy, as made by a signer the policy pins, for this repository, at this commit.
//
// runward's CLI re-derives the binding of the Statement to the tree and COUNTS its signatures; it never
// verifies one (ADR-0093). This module is where one is verified, outside the CLI and its verdict path,
// and it reads only files: the bundle or the envelope, the trust policy and the trusted roots it names.
// It reuses the verifier of the fleet's records (sigstore.js: the log entry, the certificate chain at
// the log's time, the DSSE signature) and its policy reader (trust.js); what it adds are the rules a run
// Statement must meet, each refused by name:
//
//   signed-from-the-mission-workflow   the signing identity is a workflow of the mission's own
//                                      repository, which the agent can write (ADR-0120 decision 5),
//                                      whatever the policy says;
//   signer-not-in-policy               the signer workflow is not one the policy pins (an unpinned signer);
//   policy-unpinned-workflow-digest    the policy names the workflow and pins none of its commits;
//   workflow-digest-not-pinned         the pinned workflow, at a commit the policy does not pin;
//   signer-pinned-for-other-repositories, signed-for-another-repository, signed-at-another-commit,
//   signed-on-another-ref              what was signed is not this repository, this commit, this ref;
//   key-not-in-policy                  a key signature under no key the policy pins (the agent's own);
//   statement-names-another-*          the Statement says another repository or commit than its certificate;
//   statement-differs                  the signed Statement is not the run's (the file it is checked against).
//
// Where the mission's commit comes from. A GitHub reusable workflow called by the mission signs with a
// certificate whose source repository and commit are the mission's: they are read from the certificate,
// and the Statement's own `mission` claim must agree. A pipeline that runs in the signer's project (the
// GitLab runner project of samples/gitlab, or any workflow run in the CI repository itself), and a key,
// name the signer and not the mission: the commit is read from the signed Statement's `mission` claim,
// which that signer vouches for by signing it.
import { isDeepStrictEqual } from "node:util";
import { pae, verifyBundle } from "./sigstore.js";
import { REPOSITORY_SHAPE, foreignRepository, normRepo } from "./repository.js";
import { PROTECTED_REF } from "./trust.js";
import { signatureVerifies } from "./ed25519.js";

export const RUN_PREDICATE_TYPE = "https://runward.dev/run/v1";
const STATEMENTS = new Set(["https://in-toto.io/Statement/v1"]);

/** The repository a workflow identity lives in: `host/owner/repo` from a GitHub Build Signer URI
 *  (`https://github.com/org/ci/.github/workflows/x.yml@ref`), `host/group/…/project` from a GitLab one
 *  (`https://gitlab.example/group/subgroup/project//.gitlab-ci.yml@ref`); null when neither shape, or
 *  when what precedes the workflow is not a repository identity (ADR-0130). */
export function workflowRepository(uri) {
  const s = String(uri ?? "").replace(/^https?:\/\//, "");
  const at = s.lastIndexOf("@");
  const path = at > 0 ? s.slice(0, at) : s;
  const gitlab = path.indexOf("//");
  if (gitlab > 0) return foreignRepository(path.slice(0, gitlab));
  const gh = path.indexOf("/.github/workflows/");
  if (gh > 0) return foreignRepository(path.slice(0, gh));
  return null;
}

const b64 = (s) => (typeof s === "string" && /^[A-Za-z0-9+/_-]*={0,2}$/.test(s) ? Buffer.from(s, s.includes("-") || s.includes("_") ? "base64url" : "base64") : null);

function statementOf(payloadType, payload) {
  if (payloadType !== "application/vnd.in-toto+json" || !payload) return null;
  try {
    const st = JSON.parse(payload.toString("utf8"));
    return st && STATEMENTS.has(st._type) && Array.isArray(st.subject) ? st : null;
  } catch { return null; }
}

/** The Statement the run wrote and the one that was signed are the same run's: the same predicate, and
 *  the same subject digests (`actions/attest` names its subjects itself; cosign signs the bytes). */
function sameRun(signed, unsigned) {
  const digests = (st) => (st.subject ?? []).map((x) => x?.digest?.sha256).filter((h) => typeof h === "string").sort();
  return signed.predicateType === unsigned.predicateType && isDeepStrictEqual(signed.predicate, unsigned.predicate) && isDeepStrictEqual(digests(signed), digests(unsigned));
}

/**
 * Verify one signed run Statement. `document` is the parsed Sigstore bundle (what `actions/attest` and
 * `cosign attest-blob --bundle` write) or a DSSE envelope; `policy` what trust.readPolicy returns;
 * `expect` the repository (`host/path`, ADR-0130) and commit the verdict is about, and optionally the ref.
 * Returns `accepted` true only when the signature verifies and every rule holds; `landing` true only
 * when it was signed on the protected ref under an entry that pins it (ADR-0093 decision 8).
 */
export function verifyRunSignature({ document, policy, expect, unsigned = null }) {
  const r = { accepted: false, state: "refused", via: null, signer: null, identity: null, vouched: null, landing: false, checks: [], reasons: [], statement: null };
  const reason = (code, params = {}) => r.reasons.push({ code, ...params });
  const done = () => { r.accepted = r.state === "verified" && r.reasons.length === 0; if (!r.accepted && r.state === "verified") r.state = "outside-policy"; return r; };
  // What the caller expects is read as a signature's name is: a forge address is accepted, and nothing
  // outside the grammar is.
  const mission = foreignRepository(expect?.repository);
  if (!mission || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(String(expect?.commit ?? ""))) throw new Error(`expect.repository (${REPOSITORY_SHAPE}) and expect.commit (a full commit digest) are required`);
  // The repository the signature vouches for, canonical, or null when it names none: `claims.repository`
  // is what is shown, `claimed` what is compared.
  let claimed = null;
  const shown = (raw) => { claimed = foreignRepository(raw); return claimed ?? normRepo(raw); };
  if (!policy) { reason("no-policy"); r.state = "not-verifiable"; return r; }

  const isBundle = document && typeof document.mediaType === "string" && /^application\/vnd\.dev\.sigstore\.bundle/.test(document.mediaType);
  const keyless = isBundle && (document.verificationMaterial?.certificate || document.verificationMaterial?.x509CertificateChain);
  let statement = null;
  let entry = null;
  let claims = null;

  if (keyless) {
    r.via = "sigstore";
    if (policy.roots.length === 0) { reason("no-trusted-root"); r.state = "not-verifiable"; return r; }
    let v;
    try { v = verifyBundle(document, policy.roots.map((x) => x.root)); } catch { reason("bundle-unreadable"); return r; }
    r.checks = v.checks;
    r.identity = v.identity;
    if (!v.ok) {
      const failed = v.checks.filter((c) => !c.ok);
      const unsupported = failed.some((c) => c.as === "unsupported") && failed.every((c) => c.as === "unsupported" || c.as === "skipped");
      r.state = unsupported ? "not-verifiable" : "refused";
      reason(unsupported ? "unsupported-bundle" : "signature-does-not-verify", { checks: failed.map((c) => c.id) });
      return r;
    }
    statement = v.statement;
    const id = v.identity;
    const signerRepo = workflowRepository(id.buildSignerURI);
    r.state = "verified";
    if (signerRepo === mission) {
      // The workflow that signed lives in the mission's repository: the agent can write it, so the
      // identity is not out of its reach, whatever a policy pins (ADR-0120 decision 5).
      reason("signed-from-the-mission-workflow", { workflow: id.buildSignerURI ?? null });
    }
    const named = policy.signers.filter((s) => s.kind === "sigstore" && s.issuer === id.issuer && s.workflow === id.buildSignerURI);
    const forRepo = named.filter((s) => s.repositories.includes(mission));
    const pinned = forRepo.filter((s) => s.workflowDigests.length > 0);
    entry = pinned.find((s) => s.workflowDigests.includes(id.buildSignerDigest)) ?? null;
    if (!entry && !r.reasons.length) {
      if (named.length === 0) reason("signer-not-in-policy", { workflow: id.buildSignerURI ?? null, issuer: id.issuer ?? null });
      else if (forRepo.length === 0) reason("signer-pinned-for-other-repositories", { workflow: id.buildSignerURI });
      else if (pinned.length === 0) reason("policy-unpinned-workflow-digest", { workflow: id.buildSignerURI });
      else reason("workflow-digest-not-pinned", { workflow: id.buildSignerURI, digest: id.buildSignerDigest ?? null, pinned: pinned.flatMap((s) => s.workflowDigests) });
    }
    if (entry?.runnerEnvironment && id.runnerEnvironment !== entry.runnerEnvironment) reason("runner-not-pinned", { signed: id.runnerEnvironment ?? null, pinned: entry.runnerEnvironment });
    const source = foreignRepository(id.sourceRepositoryURI);
    const said = statement?.predicate?.mission ?? null;
    if (signerRepo && source === signerRepo) {
      // The pipeline ran in the signer's own project: the certificate names that project, so the
      // mission is what the signed Statement says, vouched for by the signer.
      claims = said && typeof said === "object" ? { repository: shown(said.repository), commit: said.commit ?? null, ref: said.ref ?? null, from: "statement" } : null;
    } else {
      claims = { repository: shown(id.sourceRepositoryURI), commit: id.sourceRepositoryDigest ?? null, ref: id.sourceRepositoryRef ?? null, from: "certificate" };
      if (said && typeof said === "object") {
        const stated = said.repository ? foreignRepository(said.repository) : null;
        if (said.repository && (source === null || stated !== source)) reason("statement-names-another-repository", { statement: stated ?? normRepo(said.repository), certificate: claims.repository });
        if (said.commit && String(said.commit).toLowerCase() !== String(claims.commit ?? "").toLowerCase()) reason("statement-names-another-commit", { statement: said.commit, certificate: claims.commit });
      }
    }
  } else {
    // A key: a Sigstore bundle with a public key hint, or a bare DSSE envelope.
    r.via = "key";
    const env = isBundle ? document.dsseEnvelope : document;
    const payload = b64(env?.payload);
    statement = statementOf(env?.payloadType, payload);
    const sigs = Array.isArray(env?.signatures) ? env.signatures.map((x) => b64(x?.sig)).filter((x) => x && x.length > 0) : [];
    if (!statement || sigs.length === 0) { reason(statement ? "no-signature" : "not-a-statement"); return r; }
    const data = pae(env.payloadType, payload);
    for (const s of policy.signers.filter((x) => x.kind === "key")) {
      if (sigs.some((sig) => signatureVerifies(data, sig, s))) { entry = s; break; }
    }
    r.checks = [{ id: "dsse-signature", ok: Boolean(entry), detail: entry ? `verifies under the key ${entry.keyDigest} the policy pins` : "verifies under no key the policy pins" }];
    if (!entry) {
      // A signature that verifies under no pinned key: the signer's own key, or a forgery. Either way the
      // operator does not trust it; the agent can always sign with a key of its own.
      r.state = "outside-policy";
      reason("key-not-in-policy");
      return r;
    }
    r.state = "verified";
    r.identity = { key: entry.keyDigest, algorithm: entry.algorithm };
    if (!entry.repositories.includes(mission)) reason("signer-pinned-for-other-repositories", { key: entry.keyDigest });
    const said = statement.predicate?.mission ?? null;
    claims = said && typeof said === "object" ? { repository: shown(said.repository), commit: said.commit ?? null, ref: said.ref ?? null, from: "statement" } : null;
  }

  r.statement = statement;
  r.signer = entry?.id ?? null;
  if (statement?.predicateType !== RUN_PREDICATE_TYPE) reason("not-a-run-statement", { predicateType: statement?.predicateType ?? null });
  else if (statement.predicate?.network !== "none") reason("run-network-not-cut");
  if (!claims) reason("no-mission-claims");
  else {
    r.vouched = claims;
    if (claimed !== mission) reason("signed-for-another-repository", { signed: claims.repository ?? null, mission });
    if (String(claims.commit ?? "").toLowerCase() !== String(expect.commit).toLowerCase()) reason("signed-at-another-commit", { signed: claims.commit ?? null, expected: expect.commit });
    if (expect.ref && claims.ref !== expect.ref) reason("signed-on-another-ref", { signed: claims.ref ?? null, expected: expect.ref });
    r.landing = claims.ref === PROTECTED_REF && entry?.ref === PROTECTED_REF;
  }
  if (unsigned && statement && !sameRun(statement, unsigned)) reason("statement-differs");
  return done();
}

/** One line per reason, for the terminal. */
export const REASON_TEXT = {
  "no-policy": () => "no trust policy: nothing can be verified",
  "no-trusted-root": () => "the trust policy names no trusted root: a keyless signature cannot be verified",
  "bundle-unreadable": () => "the bundle cannot be read",
  "unsupported-bundle": (x) => `the bundle uses what this version does not verify (${x.checks.join(", ")})`,
  "signature-does-not-verify": (x) => `the signature does not verify (${x.checks.join(", ")})`,
  "signed-from-the-mission-workflow": (x) => `signed from the mission's own workflow (${x.workflow}): the agent can write it, so the identity is not out of its reach`,
  "signer-not-in-policy": (x) => `the signer workflow ${x.workflow} is not one the trust policy pins`,
  "signer-pinned-for-other-repositories": () => "the signer is pinned for other repositories, not this one",
  "policy-unpinned-workflow-digest": (x) => `the trust policy names ${x.workflow} and pins none of its commits`,
  "workflow-digest-not-pinned": (x) => `the pinned workflow, at a commit the policy does not pin (${x.digest})`,
  "runner-not-pinned": (x) => `the runner environment ${x.signed} is not the pinned ${x.pinned}`,
  "statement-names-another-repository": (x) => `the Statement names ${x.statement}, its certificate ${x.certificate}`,
  "statement-names-another-commit": (x) => `the Statement names the commit ${x.statement}, its certificate ${x.certificate}`,
  "no-signature": () => "the envelope carries no signature",
  "not-a-statement": () => "the payload is not an in-toto Statement",
  "key-not-in-policy": () => "the signature verifies under no key the trust policy pins: a key of the signer's own is not one the operator trusts",
  "not-a-run-statement": (x) => `the signed Statement is not a run Statement (${x.predicateType})`,
  "run-network-not-cut": () => "the signed run did not record the network as cut",
  "no-mission-claims": () => "the signed Statement names no mission commit, and its signer names none either",
  "signed-for-another-repository": (x) => `signed for ${x.signed}, not ${x.mission}`,
  "signed-at-another-commit": (x) => `signed at ${x.signed}, not ${x.expected}`,
  "signed-on-another-ref": (x) => `signed on ${x.signed}, not ${x.expected}`,
  "statement-differs": () => "the signed Statement is not the run Statement it is checked against",
};

