import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { computeVerdict } from "../lib/verdict.js";
import { missionStateDigest, IN_TOTO_STATEMENT_TYPE, RUNWARD_PREDICATE_TYPE } from "../lib/attestation.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

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
    subject?: Array<{ digest?: { sha256?: string } }>;
    predicate?: { strict?: boolean; verdict?: string; exitCode?: number };
  };
  try { statement = JSON.parse(readFileSync(attestationPath, "utf8")); }
  catch { fail2(`Attestation is not valid JSON: ${attestationPath}`, "attestation-not-json"); }

  if (statement!._type !== IN_TOTO_STATEMENT_TYPE || statement!.predicateType !== RUNWARD_PREDICATE_TYPE) {
    fail2("Not a runward verdict attestation (wrong _type or predicateType) — verify only reads its own.", "not-a-runward-attestation");
  }
  const claimedDigest = statement!.subject?.[0]?.digest?.sha256;
  if (!claimedDigest) fail2("Attestation carries no subject digest — nothing to bind to a tree.", "no-subject-digest");

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) fail2("No runward/ mission found here or above — verify re-derives the verdict from the mission tree.", "no-mission");
  const mission = join(root!, "runward");

  // Re-derive from the CURRENT tree, and nothing else: no network, no trust root, no second tree.
  const currentDigest = missionStateDigest(root!, mission);
  const strict = !!statement!.predicate?.strict;
  const verdict = computeVerdict(mission, { strict });
  const currentVerdict = verdict.clean ? "clean" : "gaps";

  const digestMatches = currentDigest === claimedDigest;
  const verdictMatches = statement!.predicate?.verdict === currentVerdict && statement!.predicate?.exitCode === verdict.exitCode;
  const verified = digestMatches && verdictMatches;

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      runward: VERSION, verified,
      digest: { matches: digestMatches, attested: claimedDigest, current: currentDigest },
      verdict: { matches: verdictMatches, attested: statement!.predicate?.verdict ?? null, current: currentVerdict },
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
  console.log(section("Result"));
  if (verified) {
    console.log("  " + status.success("verified — the attestation binds to this tree, and its verdict re-derives on the repo alone."));
  } else {
    console.log("  " + status.error("NOT verified — do not trust this attestation for this tree."));
    process.exitCode = 1;
  }
  console.log();
}
