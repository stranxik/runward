import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { computeVerdict } from "../lib/verdict.js";
import { missionStateDigest, rawFileSha256, IN_TOTO_STATEMENT_TYPE, RUNWARD_PREDICATE_TYPE, RUNWARD_BUNDLE_PREDICATE_TYPE } from "../lib/attestation.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";
import { GATE_NON_SCOPE } from "../lib/rules.js";
import { conformanceRows } from "../lib/check-contract.js";

/** Verify a bundle (ADR-0055 layer 4): re-hash each referenced artifact by its raw bytes and confirm
 *  it is present and unchanged. Offline, no mission, no key. */
function verifyBundle(statement: { subject?: Array<{ name?: string; digest?: { sha256?: string } }> }, opts: { json?: boolean }, dsse: { signaturesPresent: number } | null = null): void {
  const subjects = statement.subject ?? [];
  const results = subjects.map((s) => {
    const abs = s.name ? resolve(process.cwd(), s.name) : "";
    const present = !!s.name && existsSync(abs) && statSync(abs).isFile();
    const matches = present && rawFileSha256(abs) === s.digest?.sha256;
    return { name: s.name ?? "(unnamed)", present, matches };
  });
  const verified = subjects.length > 0 && results.every((r) => r.matches);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ runward: VERSION, kind: "bundle", verified, dsse: dsse ? { envelope: true, signaturesPresent: dsse.signaturesPresent, signatureVerified: false } : null, artifacts: results, exitCode: verified ? 0 : 1 }, null, 2) + "\n");
    if (!verified) process.exitCode = 1;
    return;
  }
  console.log(createHeader(`Runward v${VERSION} — verify (bundle)`, `${subjects.length} artifact(s)`));
  if (dsse) console.log(`  ${c.warning("◑")} ${c.darkGray(`DSSE envelope: payload decoded; ${dsse.signaturesPresent} signature(s) present and NOT verified — runward anchors no trust root; check them with your own tooling (cosign verify-blob-attestation)`)}`);
  console.log(section("Re-hashed each referenced artifact (no network)"));
  if (subjects.length === 0) console.log("  " + status.error("the bundle references no artifacts."));
  for (const r of results) {
    console.log(`  ${r.matches ? status.success(r.name) : status.error(`${r.name} — ${r.present ? "changed since bundling" : "missing"}`)}`);
  }
  console.log(section("Result"));
  if (verified) console.log("  " + status.success("verified — every bundled artifact is present and unchanged."));
  else { console.log("  " + status.error("NOT verified — a bundled artifact is missing or changed.")); process.exitCode = 1; }
  console.log();
}

/**
 * Verify a runward verdict attestation offline (ADR-0055 layer 2).
 *
 * Given a `check --attest` Statement and the repository, re-derive the mission-state digest and the
 * verdict from the CURRENT tree, and confirm the attestation binds to it: the subject digest must
 * still match (the tree has not drifted), and the predicate's verdict must re-derive (the predicate
 * was not tampered). No network, no trust root, no second tree, no base ref (ADR-0054): the survival
 * property made portable — anyone can re-check a verdict months later on the repo alone.
 *
 * Exit codes (the 0/1/2 port, ADR-0012): 0 = verified · 1 = drift or a lying predicate · 2 = the
 * attestation could not be read, is not a runward attestation, or no mission is here to re-derive.
 */
export async function verifyCommand(attestationPath: string, opts: { path?: string; json?: boolean }): Promise<void> {
  const fail2 = (msg: string, reason: string): never => {
    if (opts.json) process.stdout.write(JSON.stringify({ runward: VERSION, verified: false, reason, exitCode: 2 }) + "\n");
    else console.error(status.error(msg));
    process.exit(2);
  };

  if (!existsSync(attestationPath)) fail2(`Attestation not found: ${attestationPath}`, "attestation-not-found");
  let statement: {
    _type?: string; predicateType?: string;
    subject?: Array<{ name?: string; digest?: { sha256?: string } }>;
    predicate?: { runward?: string; strict?: boolean; verdict?: string; exitCode?: number; through?: string | null; horizon?: { deferred?: unknown[] } | null };
  };
  try { statement = JSON.parse(readFileSync(attestationPath, "utf8")); }
  catch { fail2(`Attestation is not valid JSON: ${attestationPath}`, "attestation-not-json"); }

  // A DSSE envelope is TOLERATED, never trusted: cosign wraps the Statement it signs in
  // { payloadType, payload: base64, signatures[] } — the exact artifact layer 5 will produce and
  // any cosign-signed runward attestation already has. verify DECODES the payload and proceeds on
  // the Statement inside; it NEVER verifies the signature — runward holds no key and no trust root
  // (ADR-0021/ADR-0054), and pretending to check a signature it cannot anchor would be a stronger
  // claim than the tool is entitled to. The signature count is REPORTED so the operator verifies it
  // with their own tooling (cosign verify-blob-attestation), and the output says so in words.
  let dsse: { signaturesPresent: number } | null = null;
  const maybeEnvelope = statement! as unknown as { payloadType?: unknown; payload?: unknown; signatures?: unknown[] };
  if (typeof maybeEnvelope.payloadType === "string" && typeof maybeEnvelope.payload === "string") {
    if (!/in-toto/.test(maybeEnvelope.payloadType)) fail2(`DSSE envelope whose payloadType is "${maybeEnvelope.payloadType}" — not an in-toto payload.`, "dsse-not-in-toto");
    try {
      const decoded = JSON.parse(Buffer.from(maybeEnvelope.payload, "base64").toString("utf8"));
      dsse = { signaturesPresent: Array.isArray(maybeEnvelope.signatures) ? maybeEnvelope.signatures.length : 0 };
      statement = decoded;
    } catch { fail2("DSSE payload is not base64-encoded JSON.", "dsse-payload-invalid"); }
  }

  if (statement!._type !== IN_TOTO_STATEMENT_TYPE) fail2("Not an in-toto Statement (wrong _type).", "not-in-toto");
  // A bundle (ADR-0055 layer 4) is about its listed files, not a verdict: re-hash each by its raw
  // bytes, as any cosign/in-toto tool would, and confirm it is present and unchanged. No mission.
  if (statement!.predicateType === RUNWARD_BUNDLE_PREDICATE_TYPE) { verifyBundle(statement!, opts, dsse); return; }
  if (statement!.predicateType !== RUNWARD_PREDICATE_TYPE) {
    fail2("Not a runward attestation (predicateType is neither a verdict nor a bundle).", "not-a-runward-attestation");
  }
  const claimedDigest = statement!.subject?.[0]?.digest?.sha256;
  if (!claimedDigest) fail2("Attestation carries no subject digest — nothing to bind to a tree.", "no-subject-digest");

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) fail2("No runward/ mission found here or above — verify re-derives the verdict from the mission tree.", "no-mission");
  const mission = join(root!, "runward");

  // Re-derive from the CURRENT tree, and nothing else: no network, no trust root, no second tree.
  const currentDigest = missionStateDigest(root!, mission);
  const strict = !!statement!.predicate?.strict;
  // ADR-0053: a phase-crossing attestation certifies a declared PREFIX. Re-derive with the SAME
  // horizon it recorded, or a prefix verdict (clean through floor) would be checked against the
  // whole-arc verdict (gaps) and a valid attestation would fail. A full-arc attestation carries
  // `through: null` and re-derives the whole arc, unchanged.
  const through = statement!.predicate?.through ?? undefined;
  const verdict = computeVerdict(mission, { strict, through });
  const currentVerdict = verdict.clean ? "clean" : "gaps";
  const deferredCount = statement!.predicate?.horizon?.deferred?.length ?? 0;

  const digestMatches = currentDigest === claimedDigest;
  const verdictMatches = statement!.predicate?.verdict === currentVerdict && statement!.predicate?.exitCode === verdict.exitCode;

  // THE PREDICATE BODY IS RE-DERIVED, not taken on trust.
  //
  // Until 2026-08-26 this function compared exactly two fields — `verdict` and `exitCode` — and
  // answered "verified" over everything else. Measured by three independent auditors on the shipped
  // binary: rewrite `evidence` to 36 typed / 0 prose, `seal` to present with 4242 files on a mission
  // that has no seal, `criticalScope` to 45 of 45, and DELETE `gateNonScope` — or replace it with
  // "runward proves the code is correct" — and verify still answered `verified: true`, exit 0. The
  // attestation is unsigned by design, so its bytes are attacker-controllable until the operator
  // checks a signature runward explicitly does not check. README:93 and docs/interop.md §5 both
  // promise that a tampered predicate fails loud; it did not.
  //
  // Everything below is re-derived from the SAME Verdict this function already computed, so there is
  // no second assembly to drift from check.ts. Fields that cannot be re-derived offline are named in
  // `notReDerived` rather than silently blessed: `hooks` requires running the operator's commands,
  // and `runward`/`currentGate`/`adrCount`/`corpusPin` are reported by their own surfaces.
  const p = (statement!.predicate ?? {}) as Record<string, any>;
  const differing: string[] = [];
  // ABSENCE IS A DIFFERENCE FOR A FIELD THIS BUILD ALWAYS EMITS. The first cut of this comparison
  // skipped any `undefined`, so that an older predicate would not be called a liar for a field that
  // did not exist when it was made — and that skip re-opened the hole one spelling over: DELETING
  // `gateNonScope` from a current attestation passed, where replacing it was caught. A missing
  // required field is either an older producer, which `versionSkew` names beside this line, or a
  // removal. Both deserve a not-verified; only one of them is tampering, and the reader is given
  // what they need to tell them apart.
  //
  // KEY ORDER IS NOT MEANING. `JSON.stringify` preserves insertion order, so comparing two objects
  // through it made the ORDER of the payload's keys load-bearing: adding one field to the emitted
  // `evidence` block before `duplicated`, and to this re-derivation after it, produced
  // `differing: ["evidence"]` on an honest attestation with identical contents. Found 2026-08-27
  // while adding the vacuity disclosure. Aligning the two lists would have hidden it until the next
  // reorder; canonicalising is what stops it being a trap. Arrays keep their order — there, order
  // IS meaning (`duplicated` is sorted deterministically, and a different order is a different tree).
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
    }
    return v;
  };
  const cmp = (name: string, attested: unknown, current: unknown, required = false) => {
    if (attested === undefined && !required) return;
    if (JSON.stringify(canon(attested)) !== JSON.stringify(canon(current))) differing.push(name);
  };
  cmp("strict", p.strict, strict);
  cmp("through", p.through, verdict.through);
  cmp("gaps.deliverables", p.gaps?.deliverables, verdict.gaps);
  cmp("gaps.conformance", p.gaps?.conformance, verdict.strictGaps);
  cmp("gaps.deferred", p.gaps?.deferred, verdict.deferredGaps);
  // The two tables an assessor reads FIRST, and the horizon that scopes them. Until 2026-09-02 none
  // of the three was compared, and none was named in `notReDerived` — the worst combination: an
  // attestation whose `deliverables` table described a mission that does not exist, whose
  // `conformance` table was invented, and whose `horizon` was falsified answered `verified: true`,
  // exit 0, printed by the very command whose purpose is "do not trust this attestation". Found by
  // an adversarial investigation (RWD-2026-0095). All three re-derive from the same Verdict this
  // function already computed; `conformance` through the ONE implementation `check` publishes with
  // (conformanceRows, ADR-0059 criterion 5), so the two sides cannot drift apart again.
  cmp("deliverables", p.deliverables, verdict.deliverables, true);
  cmp("horizon", p.horizon, verdict.horizon, true);
  if (strict) {
    cmp("conformance", p.conformance, conformanceRows(verdict), true);
    cmp("evidence", p.evidence, {
      rows: verdict.breakdown.rows, applied: verdict.breakdown.applied,
      deviated: verdict.breakdown.deviated, na: verdict.breakdown.na,
      typed: verdict.breakdown.typed, prose: verdict.breakdown.prose,
      signed: verdict.breakdown.signed, duplicated: verdict.breakdown.duplicated,
      // Added to the payload with the vacuity disclosure. Re-derived here in the same commit,
      // because RWD-2026-0042 is exactly the defect of a predicate field nobody re-derives: the
      // suite went red the moment the field landed, which is the guard doing its job.
      evidenceFiles: verdict.breakdown.evidenceFiles,
    }, true);
    cmp("corpus", p.corpus, {
      status: verdict.corpus.status, missing: verdict.corpus.missing,
      edited: verdict.corpus.edited, extra: verdict.corpus.extra,
    }, true);
    cmp("seal", p.seal, {
      present: verdict.seal.present, count: verdict.seal.count,
      sealedAt: verdict.seal.sealedAt ?? null, violations: verdict.seal.violations.length,
    }, true);
    cmp("criticalScope", p.criticalScope, verdict.criticalScope, true);
    // ADR-0066, additive on 0.38: not `required` — an attestation produced before the field
    // existed is an older producer, not a liar (`versionSkew` names the case); one produced WITH
    // it and tampered is caught like every other field.
    cmp("ratification", p.ratification, verdict.ratification);
    cmp("requiresUnmet", p.requiresUnmet, verdict.requiresUnmet);
    cmp("gaps.proposed", p.gaps?.proposed, verdict.strictBreakdown.proposed);
    // The declared non-scope is a CONSTANT of this build. An attestation that carries a different
    // one — or none — is carrying a claim runward did not make, which is the whole point of shipping
    // the caveat inside the artifact.
    cmp("gateNonScope", p.gateNonScope, GATE_NON_SCOPE, true);
  }
  const notReDerived = ["runward", "mission", "currentGate", "adrCount", "corpusPin", "corpusDrift", "gaps.hooks"];
  const predicateMatches = differing.length === 0;
  const verified = digestMatches && verdictMatches && predicateMatches;

  // The version that PRODUCED this attestation, beside the verifier's own. verify re-derives with
  // the CURRENT verdict logic; when the two versions differ, a re-derivation failure can come from
  // verdict-logic evolution between them, not only from drift or a lying predicate — and the reader
  // must be able to tell those cases apart (ADR-0040: name what this gate cannot verify). Advisory
  // only: the skew NEVER moves the exit code, because an evolved gate refusing an old attestation is
  // the honest verdict of the current logic, not an error. The subject digest is version-independent
  // (raw hashing), so a digest mismatch is real drift regardless of skew.
  const producedBy = typeof statement!.predicate?.runward === "string" ? statement!.predicate!.runward! : null;
  const versionSkew = producedBy !== null && producedBy !== VERSION;

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      runward: VERSION, verified,
      // Additive (ADR-0030): who produced the attestation vs who is re-deriving. `versionSkew: true`
      // means a NOT-verified result may be verdict-logic evolution, not tampering — re-verify with
      // the producing version to distinguish. Never moves the exit code.
      producedBy, versionSkew,
      // DSSE tolerance: the envelope was decoded, its signature deliberately NOT verified (no
      // trust root, no key — the operator's cosign does that). null when the input was a bare
      // Statement. Additive (ADR-0030).
      dsse: dsse ? { envelope: true, signaturesPresent: dsse.signaturesPresent, signatureVerified: false } : null,
      digest: { matches: digestMatches, attested: claimedDigest, current: currentDigest },
      verdict: { matches: verdictMatches, attested: statement!.predicate?.verdict ?? null, current: currentVerdict },
      // WHICH gate was re-derived, named rather than implied. `strict: false` is a PRESENCE check
      // and a weaker statement than a strict crossing; the VSA carries that distinction in
      // `verifiedLevels` precisely so a policy cannot lose it, and this command lost it entirely —
      // neither output so much as contained the word. Measured 2026-08-26 on a tree where
      // `check --strict` exits 1 and `check` exits 0: a presence attestation verified, exit 0, with
      // no way for a consumer to tell which gate it had just re-derived.
      strict,
      level: strict ? (through ? `RUNWARD_GATE_STRICT_THROUGH_${String(through).toUpperCase()}` : "RUNWARD_GATE_STRICT") : "RUNWARD_GATE_PRESENCE",
      // Additive (ADR-0030): every predicate field this run re-derived and found equal, and the ones
      // it structurally cannot re-derive offline. A consumer must be able to tell "checked and
      // agrees" from "not checked".
      predicate: { matches: predicateMatches, differing, notReDerived },
      // ADR-0053: non-null ⇒ a PREFIX attestation, verified against the declared horizon, NOT a
      // completion verdict. A consumer must not read a verified prefix as a full-arc delivery.
      horizon: through ? { through, deferred: deferredCount } : null,
      exitCode: verified ? 0 : 1,
    }, null, 2) + "\n");
    if (!verified) process.exitCode = 1;
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — verify`, attestationPath));
  if (dsse) console.log(`  ${c.warning("◑")} ${c.darkGray(`DSSE envelope: payload decoded; ${dsse.signaturesPresent} signature(s) present and NOT verified — runward anchors no trust root; check them with your own tooling (cosign verify-blob-attestation)`)}`);
  console.log(section("Re-derived from the mission tree (no network, no trust root)"));
  console.log(`  ${digestMatches
    ? status.success("subject digest matches — this attestation is about this exact tree")
    : status.error("subject digest DIFFERS — the tree drifted since this attestation was made")}`);
  if (!digestMatches) console.log(`    ${c.darkGray(`attested ${claimedDigest!.slice(0, 16)}… · now ${currentDigest.slice(0, 16)}…`)}`);
  console.log(`  ${verdictMatches
    ? status.success(`verdict re-derives (${currentVerdict}) under ${strict ? "--strict" : "the presence gate"}`)
    : status.error(`verdict DIFFERS — attested "${statement!.predicate?.verdict}", re-derived "${currentVerdict}"`)}`);
  console.log(`  ${predicateMatches
    ? status.success(`predicate body re-derives (${["strict", "gaps", "deliverables", "horizon", strict ? "conformance, evidence, corpus, seal, criticalScope, gateNonScope" : null].filter(Boolean).join(", ")})`)
    : status.error(`predicate DIFFERS from the tree — ${differing.join(", ")}`)}`);
  console.log(`    ${c.darkGray(`not re-derived offline: ${notReDerived.join(", ")}`)}`);
  if (through) console.log(`  ${c.warning("◑")} ${c.darkGray(`PREFIX attestation through ${through} — NOT a completion verdict; ${deferredCount} later deliverable(s) deferred`)}`);
  if (versionSkew) console.log(`  ${c.warning("◑")} ${c.darkGray(`produced by runward v${producedBy} — re-derived by v${VERSION} (advisory: verdict logic may have evolved between the two)`)}`);
  console.log(section("Result"));
  if (verified) {
    console.log("  " + status.success("verified — the attestation binds to this tree, and its verdict re-derives on the repo alone."));
  } else {
    console.log("  " + status.error("NOT verified — do not trust this attestation for this tree."));
    if (versionSkew) {
      console.log(`  ${c.darkGray(`This attestation was produced by runward v${producedBy} and re-derived by v${VERSION}: the failure can come`)}`);
      console.log(`  ${c.darkGray(`from verdict-logic evolution between the two versions, not only from drift or a tampered predicate.`)}`);
      console.log(`  ${c.darkGray(`To tell the cases apart, re-verify with the producing version: npx runward@${producedBy} verify ${attestationPath}`)}`);
    }
    process.exitCode = 1;
  }
  console.log();
}
