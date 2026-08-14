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
    predicate: { runward: runwardVersion, mission: missionName, artifacts: sorted.length },
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
