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
import { existsSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { collectSealableEvidence, normalizedFileSha256 } from "./evidence.js";
import { declaredMissionName } from "./mission.js";
import { GATE_NON_SCOPE } from "./rules.js";
import { PACKAGE_NAME, PKG_ROOT, VERSION } from "./paths.js";
import { deliveredEntries } from "./delivered-tree.js";

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
/** The run predicate type (ADR-0120 decision 4): what `runward-run`, a sibling package, writes about the
 *  execution it made out of the agent's reach. runward never writes one; it reads it (evidence-levels.ts). */
export const RUNWARD_RUN_PREDICATE_TYPE = "https://runward.dev/run/v1";

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
  return digestOfFiles(missionStateFiles(root, missionDir));
}

/** The files the mission-state digest binds, by project-relative key, each with its normalised hash:
 *  every file under runward/, and every evidence file the manifests cite (ADR-0055, its 2026-08-14
 *  amendment). `missionStateDigest` is the digest of this map, and `verify` names its extent from it
 *  (ADR-0113 decision 3), so the sentence and the digest cannot describe two different sets. */
export function missionStateFiles(root: string, missionDir: string): Record<string, string> {
  const files: Record<string, string> = {};
  // The whole mission tree (deliverables, manifests, rules, adr, contracts, governance, seal, lock).
  for (const [rel, h] of Object.entries(hashTree(missionDir))) files[`${basename(missionDir)}/${rel}`] = h;
  // The applied-evidence files the manifests cite (may live outside runward/, e.g. code/). Keys are
  // already project-root-relative and dedupe against the gated manifests already in the tree above.
  for (const [rel, h] of Object.entries(collectSealableEvidence(missionDir))) files[rel] = h;
  return files;
}

/** The digest of a {path -> sha256} map: SHA-256 of its JSON with the keys sorted. The one
 *  construction of the mission-state digest and of the delivered tree's (ADR-0113 decision 5). */
export function digestOfFiles(files: Record<string, string>): string {
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]])));
  return createHash("sha256").update(canonical).digest("hex");
}

/** What the mission-state digest covers, as `verify` says it (ADR-0113 decision 3): the mission tree
 *  and the cited evidence outside it. Every other file of the project is not covered. */
export interface MissionStateScope { missionTree: string; missionFiles: number; citedOutside: string[] }

export function missionStateScope(files: Record<string, string>, missionDir: string): MissionStateScope {
  const prefix = `${basename(missionDir)}/`;
  const keys = Object.keys(files).sort();
  return {
    missionTree: prefix,
    missionFiles: keys.filter((k) => k.startsWith(prefix)).length,
    citedOutside: keys.filter((k) => !k.startsWith(prefix)),
  };
}

/** Who produced an attestation (ADR-0113 decision 4): what retrieves the binary (`purl`, a published
 *  version never being replaceable on npm) and what confirms the retrieved one is the same (`build`). */
export interface ProducerIdentity { name: string; version: string; purl: string; build: string }

let buildMemo: string | null = null;

/**
 * The digest of the files this binary computes its verdict with: its compiled code (`dist/`) and the
 * templates the verdict reads (`templates/`: the corpus, the deliverable templates the divergence floor
 * compares against, the workflow contracts), each by its path and normalised content, with the
 * package's name and version. Every installation of one published version holds the same files, so it
 * gives one build everywhere; a build from a working copy gives another while it still carries the
 * released version number, which is how a development build stops being read as that release.
 * Node.js is not in it: the attestations of one tree are byte-identical under 22.22.2, 24.18.0 and
 * 24.22.1, and recording the runtime would make them differ across machines (ADR-0109).
 */
export function buildDigest(): string {
  if (buildMemo !== null) return buildMemo;
  const files: Record<string, string> = {};
  for (const dir of ["dist", "templates"]) {
    const abs = join(PKG_ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const [rel, h] of Object.entries(hashTree(abs))) files[`${dir}/${rel}`] = h;
  }
  const canonical = JSON.stringify({ name: PACKAGE_NAME, version: VERSION, files: Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]])) });
  buildMemo = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
  return buildMemo;
}

/** The package URL (purl) of an npm package version: a scoped name's `@` is percent-encoded. */
export function npmPurl(name: string, version: string): string {
  return `pkg:npm/${name.startsWith("@") ? `%40${name.slice(1)}` : name}@${version}`;
}

/** This binary, as an attestation names its producer. */
export function producerIdentity(): ProducerIdentity {
  return { name: PACKAGE_NAME, version: VERSION, purl: npmPurl(PACKAGE_NAME, VERSION), build: buildDigest() };
}

/** What `deliveredTree.rule` says, at the character, in every attestation that binds the tree. */
export const DELIVERED_TREE_RULE =
  "every regular file and symbolic link under the project root that the project's own .gitignore files do not ignore " +
  "(git's pattern rules, read without git, matched case-sensitively, paths in Unicode NFC), except .git entries, " +
  "nested repositories, files of zero bytes and runward in-toto Statements; each file hashed by SHA-256 of its content " +
  "with CRLF read as LF in a text file, each symbolic link by its target. Not read: .git/info/exclude, the global " +
  "excludes file, any .gitignore above the project root.";

/** The suffix that names the delivered tree's subject beside the mission's own. */
export const DELIVERED_TREE_SUBJECT_SUFFIX = " (delivered tree)";

export interface DeliveredTree { files: number; rule: string; entries: Record<string, string> }

/** Whether a file's bytes are a runward in-toto Statement `verify` reads (a verdict or a bundle, bare or
 *  inside a DSSE envelope): it is about the tree, never part of it (ADR-0113 decision 5). A run Statement
 *  of `runward-run` (ADR-0120) is one too, bare, in a DSSE envelope, or in the Sigstore bundle a signing
 *  job writes around that envelope: the operator's CI commits it beside the reports it binds, and binding
 *  it to the tree it describes would make every run Statement differ from its own tree. */
export function isRunwardStatement(buf: Buffer): boolean {
  let i = 0;
  while (i < buf.length && (buf[i] === 0x20 || buf[i] === 0x0a || buf[i] === 0x0d || buf[i] === 0x09 || buf[i] === 0xef || buf[i] === 0xbb || buf[i] === 0xbf)) i++;
  if (buf[i] !== 0x7b) return false; // "{"
  let doc: unknown;
  try { doc = JSON.parse(buf.toString("utf8").replace(/^\uFEFF/, "")); } catch { return false; }
  const isStatement = (d: unknown): boolean => {
    const o = d as { _type?: unknown; predicateType?: unknown } | null;
    return !!o && typeof o === "object" && o._type === IN_TOTO_STATEMENT_TYPE &&
      (o.predicateType === RUNWARD_PREDICATE_TYPE || o.predicateType === RUNWARD_BUNDLE_PREDICATE_TYPE || o.predicateType === RUNWARD_RUN_PREDICATE_TYPE);
  };
  if (isStatement(doc)) return true;
  const inEnvelope = (e: unknown): boolean => {
    const env = e as { payloadType?: unknown; payload?: unknown } | null;
    if (!env || typeof env !== "object" || typeof env.payloadType !== "string" || typeof env.payload !== "string" || !/in-toto/.test(env.payloadType)) return false;
    try { return isStatement(JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"))); } catch { return false; }
  };
  if (inEnvelope(doc)) return true;
  const bundle = doc as { mediaType?: unknown; dsseEnvelope?: unknown } | null;
  return !!bundle && typeof bundle.mediaType === "string" && /^application\/vnd\.dev\.sigstore\.bundle/.test(bundle.mediaType) && inEnvelope(bundle.dsseEnvelope);
}

/**
 * The delivered tree of a project (ADR-0113 decision 5): the entries `deliveredEntries` lists (what the
 * project's own `.gitignore` files deliver), less the files of zero bytes and the runward Statements, each
 * with its hash. A file is hashed like the mission-state digest hashes it (CRLF read as LF in a text
 * file); a symbolic link by its target, the bytes git stores for it, so a checkout that writes the link as
 * a plain file holding its target gives the same hash.
 *
 * Why zero bytes: `check --attest --whole-tree > verdict.intoto.json` creates that file, empty, before
 * runward runs, and binding it would make every attestation written into its own tree differ from it.
 */
export function deliveredTreeOf(root: string): DeliveredTree {
  const entries: Record<string, string> = {};
  for (const e of deliveredEntries(root)) {
    if (e.kind === "symlink") {
      let target: Buffer;
      try { target = readlinkSync(e.abs, { encoding: "buffer" }); } catch { continue; }
      entries[e.rel] = createHash("sha256").update(target).digest("hex");
      continue;
    }
    let buf: Buffer;
    try { buf = readFileSync(e.abs); } catch { entries[e.rel] = "unreadable"; continue; }
    if (buf.length === 0 || isRunwardStatement(buf)) continue;
    entries[e.rel] = normalizedFileSha256(e.abs);
  }
  return { files: Object.keys(entries).length, rule: DELIVERED_TREE_RULE, entries };
}

/**
 * Build the UNSIGNED in-toto Statement wrapping the verdict payload. Byte-idempotent on an unchanged
 * tree: the subject digest and the predicate are both pure functions of the mission on disk.
 *
 * The subject's `name` is the name the mission declares (`declaredMissionName`), not the checkout
 * folder: until 2026-10-28 it was `basename(root)`, so the same tree cloned under two folder names
 * gave two different attestations (RWD-2026-0186, ADR-0109). `root` stays a parameter because the
 * digest resolves cited evidence against it.
 */
export function buildVerdictStatement(
  root: string, missionDir: string, predicate: Record<string, unknown>,
  opts: { deliveredTree?: DeliveredTree; missionFiles?: Record<string, string> } = {},
): Record<string, unknown> {
  const name = declaredMissionName(missionDir);
  const tree = opts.deliveredTree;
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [
      { name, digest: { sha256: digestOfFiles(opts.missionFiles ?? missionStateFiles(root, missionDir)) } },
      // ADR-0113 decision 5: on request (`--whole-tree`), the files the project delivers, as a second
      // subject. The verdict above never reads it.
      ...(tree ? [{ name: `${name}${DELIVERED_TREE_SUBJECT_SUFFIX}`, digest: { sha256: digestOfFiles(tree.entries) } }] : []),
    ],
    predicateType: RUNWARD_PREDICATE_TYPE,
    // ADR-0113 decision 4: the producer travels with what it produced, last so every key before it keeps
    // its place (ADR-0030); the delivered tree's list, when bound, after it.
    predicate: { ...predicate, producer: producerIdentity(), ...(tree ? { deliveredTree: tree } : {}) },
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
  opts: { resourceUri: string; passed: boolean; strict: boolean; timeVerified: string; through?: string | null; proofLevel?: string | null },
): Record<string, unknown> {
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [{ name: declaredMissionName(missionDir), digest: { sha256: missionStateDigest(root, missionDir) } }],
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
      // ADR-0119 decision 6: the level of proof the run required and met travels as one more custom
      // value, `RUNWARD_PROOF_<LEVEL>`, never an `SLSA_` one, and only when the run read the levels
      // (`re-derived` or `attested`): every other VSA keeps its bytes.
      verifiedLevels: opts.passed
        ? [
            opts.through
              ? `RUNWARD_GATE_${opts.strict ? "STRICT" : "PRESENCE"}_THROUGH_${opts.through.toUpperCase()}`
              : `RUNWARD_GATE_${opts.strict ? "STRICT" : "PRESENCE"}`,
            ...(opts.proofLevel ? [`RUNWARD_PROOF_${opts.proofLevel.toUpperCase().replace(/-/g, "_")}`] : []),
          ]
        : ["FAILED"],
    },
  };
}
