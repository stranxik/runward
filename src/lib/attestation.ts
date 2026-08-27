/**
 * The verdict as a standards-legible in-toto attestation (ADR-0055 layer 1).
 *
 * This module EMITS. It builds an UNSIGNED in-toto Statement whose subject is a deterministic digest
 * of the mission state the verdict depends on, and whose predicate is the `check --json` payload the
 * gate already computes. It holds no key, opens no socket, calls no model — a pure function of the
 * tree on disk, exactly like the verdict it wraps (ADR-0054, thesis-consistent). Signing the
 * Statement into a DSSE envelope is a separate, opt-in step done under the OPERATOR's own key
 * (ADR-0055 layer 5); nothing here signs, because a valid envelope needs a key and runward holds
 * none (ADR-0021).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { collectSealableEvidence, normalizedFileSha256 } from "./evidence.js";
import { GATE_NON_SCOPE } from "./rules.js";
import { VERSION } from "./paths.js";

/** Plain SHA-256 of the raw file bytes — what cosign, in-toto tools and `sha256sum` compute, so a
 *  bundle subject is verifiable by ANY external tool, not only by runward. (The mission-state digest
 *  and the seal normalize line endings for cross-checkout determinism; a bundle references delivery
 *  artifacts by their exact bytes, the way the ecosystem expects.) */
export function rawFileSha256(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

export const IN_TOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
/** A versioned port (ADR-0011): expand/contract only, never a breaking shape change under this URI. */
export const RUNWARD_PREDICATE_TYPE = "https://runward.dev/verdict/v1";
/** The bundle predicate type (ADR-0055 layer 4): binds several delivery artifacts under one provenance. */
export const RUNWARD_BUNDLE_PREDICATE_TYPE = "https://runward.dev/bundle/v1";

export interface BundleSubject { name: string; digest: { sha256: string } }

/**
 * Build the UNSIGNED in-toto Statement that binds several already-emitted delivery artifacts (the
 * verdict attestation, the seal, an OSCAL export, an SBOM) into one — each referenced by SHA-256 as
 * an in-toto subject, so a factory hands an assessor a single provenance instead of a pile of files.
 * Deterministic (subjects sorted by name); removing or changing any referenced artifact changes its
 * digest, so the bundle no longer matches (checked by `runward verify`). It signs nothing.
 */
export function buildBundleStatement(subjects: BundleSubject[], missionName: string, runwardVersion: string): Record<string, unknown> {
  const sorted = [...subjects].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: sorted,
    predicateType: RUNWARD_BUNDLE_PREDICATE_TYPE,
    // The caveat travels here too. sarif.ts repeats it in every rule's fullDescription "so a
    // consumer that keeps the findings and drops the non-scope has to drop it deliberately", and
    // compliance.ts carries the principle in a comment — "A caveat that stays home is a caveat that
    // was not made." The 2026-08-26 audit found the two envelopes that lacked it were precisely the
    // two designed for a consumer who will never read anything else about runward.
    predicate: { runward: runwardVersion, mission: missionName, artifacts: sorted.length, gateNonScope: GATE_NON_SCOPE },
  };
}

/** Walk a directory into a {dir-relative path → normalized sha256} map, deterministic by sort. */
function hashTree(dir: string, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const abs = join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(out, hashTree(abs, rel));
    else if (e.isFile()) out[rel] = normalizedFileSha256(abs);
  }
  return out;
}

/**
 * A deterministic digest of the mission state the verdict depends on: every file under runward/,
 * plus the applied-evidence files the manifests resolve outside it. Same working tree ⇒ same digest
 * (the ADR-0054 invariant); any drift in a deliverable, manifest, rule, ADR, seal or cited evidence
 * changes it, which is what lets `runward verify` bind a verdict to the tree it was computed on.
 */
export function missionStateDigest(root: string, missionDir: string): string {
  const files: Record<string, string> = {};
  // The whole mission tree (deliverables, manifests, rules, adr, contracts, governance, seal, lock).
  for (const [rel, h] of Object.entries(hashTree(missionDir))) files[`${basename(missionDir)}/${rel}`] = h;
  // The applied-evidence files the manifests cite (may live outside runward/, e.g. code/). Keys are
  // already project-root-relative and dedupe against the gated manifests already in the tree above.
  for (const [rel, h] of Object.entries(collectSealableEvidence(missionDir))) files[rel] = h;
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]])));
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Build the UNSIGNED in-toto Statement wrapping the verdict payload. Byte-idempotent on an unchanged
 * tree: the subject digest and the predicate are both pure functions of the mission on disk.
 */
export function buildVerdictStatement(
  root: string, missionDir: string, predicate: Record<string, unknown>,
): Record<string, unknown> {
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [{ name: basename(root), digest: { sha256: missionStateDigest(root, missionDir) } }],
    predicateType: RUNWARD_PREDICATE_TYPE,
    predicate,
  };
}

/** The SLSA Verification Summary Attestation predicate (VSA v1) — a NEUTRAL port, not runward's own
 *  vocabulary: an ecosystem verifier (Kyverno, a policy engine, a release gate) reads this shape
 *  already and needs to learn nothing about runward to consume the verdict (ADR-0011). */
export const VSA_PREDICATE_TYPE = "https://slsa.dev/verification_summary/v1";

/** The policy this verifier evaluates, as a resolvable URI — the gate itself, documented publicly.
 *  A VSA's trust base is `verifier.id` + `policy.uri`, so both must be things a consumer can read. */
export const RUNWARD_POLICY_URI = "https://runward.dev/docs/concepts/the-gate/";

/**
 * Emit the verdict as a SLSA Verification Summary Attestation (ADR-0055, the interop port).
 *
 * Two fields of the VSA spec collide with runward's own invariants, and both are resolved by
 * REFUSING to invent the missing input rather than by guessing it:
 *
 * - `timeVerified` is REQUIRED and is a clock reading, while every other runward emission is
 *   byte-idempotent on an unchanged tree. The reproducible-builds convention settles it: when
 *   `SOURCE_DATE_EPOCH` is set the emission stays byte-identical (the operator owns the clock);
 *   otherwise the wall clock is used and the VSA is the one runward artifact that is NOT
 *   byte-idempotent — stated here, in the docs, and in the command's own output. The VERDICT is
 *   unaffected either way: the timestamp is in the envelope, never in what was verified.
 * - `resourceUri` is REQUIRED and names the artifact the consumer will admit or refuse — a
 *   published package, an image, a release. runward reads a working tree and knows nothing about
 *   where it is published (ADR-0054: no registry, no git remote, no network), so the operator
 *   supplies it. No default is honest here: guessing a URI would put a name runward cannot verify
 *   into an attestation a policy engine acts on.
 *
 * `verifiedLevels` carries a CUSTOM value and never an `SLSA_` one. runward evaluates no SLSA build
 * level — it verifies a delivery gate — and the spec is explicit: "Users MAY use custom values here
 * but MUST NOT use custom values starting with SLSA_". Emitting `SLSA_BUILD_LEVEL_3` because the
 * gate is green would be a claim about a build pipeline runward never looked at.
 */
export function buildVsaStatement(
  root: string, missionDir: string,
  opts: { resourceUri: string; passed: boolean; strict: boolean; timeVerified: string; through?: string | null },
): Record<string, unknown> {
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [{ name: basename(root), digest: { sha256: missionStateDigest(root, missionDir) } }],
    predicateType: VSA_PREDICATE_TYPE,
    predicate: {
      verifier: { id: "https://runward.dev", version: { runward: VERSION } },
      timeVerified: opts.timeVerified,
      resourceUri: opts.resourceUri,
      // `annotations` is the in-toto ResourceDescriptor's own field for arbitrary metadata, so the
      // caveat rides inside the SLSA VSA v1 shape rather than beside it: a policy engine that
      // validates the predicate strictly still receives it, and one that reads only `verifiedLevels`
      // at least cannot say it was never told.
      policy: { uri: RUNWARD_POLICY_URI, annotations: { "runward.dev/gate-non-scope": GATE_NON_SCOPE } },
      verificationResult: opts.passed ? "PASSED" : "FAILED",
      // Custom, never SLSA_*: the level names WHAT was verified, and a declared horizon is part of
      // it — a prefix verdict must never read as a whole-arc one, in this envelope as in every other.
      //
      // A FAILED VERIFICATION REACHES NO LEVEL, and until 2026-08-26 it named one anyway. Measured
      // by an adversarial audit: a mission with a conformance gap emitted
      // `verificationResult: "FAILED"` beside `verifiedLevels: ["RUNWARD_GATE_STRICT"]` — the level
      // was computed from `strict`/`through` alone and `passed` reached only the result. That is the
      // one field docs/interop.md §4 singles out: "Read the level, not just the result", so a
      // Kyverno or OPA rule written to that instruction — admit when the levels contain
      // RUNWARD_GATE_STRICT — admitted an artifact whose gate had refused it.
      //
      // The SLSA VSA v1 spec's own SlsaResult carries `FAILED` for exactly this ("Indicates policy
      // evaluation failed"), and it is not an `SLSA_`-prefixed value, so emitting it breaks no rule
      // the comment above states. A failed verification therefore says FAILED in both fields, and
      // the level it did not reach is named nowhere.
      verifiedLevels: opts.passed
        ? [
            opts.through
              ? `RUNWARD_GATE_${opts.strict ? "STRICT" : "PRESENCE"}_THROUGH_${opts.through.toUpperCase()}`
              : `RUNWARD_GATE_${opts.strict ? "STRICT" : "PRESENCE"}`,
          ]
        : ["FAILED"],
    },
  };
}
