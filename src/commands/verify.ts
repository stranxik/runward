import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { computeVerdict } from "../lib/verdict.js";
import { missionStateDigest, rawFileSha256, IN_TOTO_STATEMENT_TYPE, RUNWARD_PREDICATE_TYPE, RUNWARD_BUNDLE_PREDICATE_TYPE } from "../lib/attestation.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/** Verify a bundle (ADR-0055 layer 4): re-hash each referenced artifact by its raw bytes and confirm
 *  it is present and unchanged. Offline, no mission, no key. */
function verifyBundle(statement: { subject?: Array<{ name?: string; digest?: { sha256?: string } }> }, opts: { json?: boolean }): void {
  const subjects = statement.subject ?? [];
  const results = subjects.map((s) => {
    const abs = s.name ? resolve(process.cwd(), s.name) : "";
    const present = !!s.name && existsSync(abs) && statSync(abs).isFile();
    const matches = present && rawFileSha256(abs) === s.digest?.sha256;
    return { name: s.name ?? "(unnamed)", present, matches };
  });
  const verified = subjects.length > 0 && results.every((r) => r.matches);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ runward: VERSION, kind: "bundle", verified, artifacts: results, exitCode: verified ? 0 : 1 }, null, 2) + "\n");
    if (!verified) process.exitCode = 1;
    return;
  }
  console.log(createHeader(`Runward v${VERSION} — verify (bundle)`, `${subjects.length} artifact(s)`));
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

  if (statement!._type !== IN_TOTO_STATEMENT_TYPE) fail2("Not an in-toto Statement (wrong _type).", "not-in-toto");
  // A bundle (ADR-0055 layer 4) is about its listed files, not a verdict: re-hash each by its raw
  // bytes, as any cosign/in-toto tool would, and confirm it is present and unchanged. No mission.
  if (statement!.predicateType === RUNWARD_BUNDLE_PREDICATE_TYPE) { verifyBundle(statement!, opts); return; }
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
  const verified = digestMatches && verdictMatches;

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
      digest: { matches: digestMatches, attested: claimedDigest, current: currentDigest },
      verdict: { matches: verdictMatches, attested: statement!.predicate?.verdict ?? null, current: currentVerdict },
      // ADR-0053: non-null ⇒ a PREFIX attestation, verified against the declared horizon, NOT a
      // completion verdict. A consumer must not read a verified prefix as a full-arc delivery.
      horizon: through ? { through, deferred: deferredCount } : null,
      exitCode: verified ? 0 : 1,
    }, null, 2) + "\n");
    if (!verified) process.exitCode = 1;
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — verify`, attestationPath));
  console.log(section("Re-derived from the mission tree (no network, no trust root)"));
  console.log(`  ${digestMatches
    ? status.success("subject digest matches — this attestation is about this exact tree")
    : status.error("subject digest DIFFERS — the tree drifted since this attestation was made")}`);
  if (!digestMatches) console.log(`    ${c.darkGray(`attested ${claimedDigest!.slice(0, 16)}… · now ${currentDigest.slice(0, 16)}…`)}`);
  console.log(`  ${verdictMatches
    ? status.success(`verdict re-derives (${currentVerdict})`)
    : status.error(`verdict DIFFERS — attested "${statement!.predicate?.verdict}", re-derived "${currentVerdict}"`)}`);
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
