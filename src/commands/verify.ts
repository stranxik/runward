import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { declaredMissionName, findMissionRoot, THROUGH_PHASE_IDS } from "../lib/mission.js";
import { computeVerdict } from "../lib/verdict.js";
import {
  buildVerdictStatement, deliveredTreeOf, digestOfFiles, missionStateFiles, missionStateScope, producerIdentity, rawFileSha256,
  DELIVERED_TREE_RULE, DELIVERED_TREE_SUBJECT_SUFFIX, IN_TOTO_STATEMENT_TYPE, RUNWARD_PREDICATE_TYPE, RUNWARD_BUNDLE_PREDICATE_TYPE,
  type DeliveredTree,
} from "../lib/attestation.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { PACKAGE_NAME, VERSION } from "../lib/paths.js";
import { GATE_NON_SCOPE, corpusStamp, corpusDrift } from "../lib/rules.js";
import {
  attestedQuestion, conformanceRowsLocated, coverageSummary, currentGateLabel, deliverableRowsWithPhaseId, machinePayload, nextPayload, nextStep, redPhases,
} from "../lib/check-contract.js";
import { manifestLineLocator } from "../lib/sarif.js";
import { decisionCoverage, rulesDir } from "../lib/conformance.js";
import { citedJUnitNotGreen } from "../lib/evidence.js";
// Read only: `verify` imports the reader of hooks.json and nothing that executes a command; a test holds
// it to that (verify-claims-only-what-it-checks.test.js).
import { readHooksConfig } from "../lib/hooks.js";

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
  // ADR-0113 decision 3: the result names what it covers, as the verdict's does.
  if (verified) console.log("  " + status.success(`verified — the ${subjects.length} bundled artifact(s) are present and unchanged, by their raw bytes. A file the bundle does not list is not covered.`));
  else { console.log("  " + status.error("NOT verified — a bundled artifact is missing or changed.")); process.exitCode = 1; }
  console.log();
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** KEY ORDER IS NOT MEANING. Comparing through `JSON.stringify` alone made the order of a payload's keys
 *  load-bearing (found 2026-08-27, an honest attestation reported different for a reordered block).
 *  Arrays keep their order: there, order IS meaning. */
const canon = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canon);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
};
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** The keys of `attested` agree with `current`, recursively; a key only `current` has is not looked at.
 *  Used ONLY for the advisory reading of another producer's attestation (ADR-0113 decision 4): an older
 *  producer did not emit what was added since, and that reading never decides an exit code. */
const subsetSame = (attested: unknown, current: unknown): boolean => {
  if (Array.isArray(attested)) return Array.isArray(current) && attested.length === current.length && attested.every((x, i) => subsetSame(x, current[i]));
  if (isObj(attested)) return isObj(current) && Object.keys(attested).every((k) => k in current && subsetSame(attested[k], current[k]));
  return same(attested, current);
};

/** The blocks whose children are named one by one when they differ: `gaps` and `next` whole, and the
 *  lists published apart inside three others, so a reader learns WHICH part moved. */
const SPLIT: Record<string, "*" | string[]> = { gaps: "*", next: "*", evidence: ["proseRows"], ratification: ["byRow"], delegation: ["assurance"] };

/**
 * Every predicate key where the attestation and the re-derivation differ (ADR-0113 decision 1).
 *
 * `exact`: both ways. A key the attestation carries that this build does not emit is a difference
 * (a field nobody re-derives can no longer be blessed: `independentAudit`, a strict block added to a
 * presence attestation, RWD-2026-0192), and so is a key this build emits that the attestation lacks
 * (emptying or deleting a disclosure such as `prosePointers` is a removal, never an older producer: the
 * producer is named in `producer`). `subset`: only the keys the attestation carries, for the advisory
 * reading of another producer's attestation.
 */
export function predicateDiffs(attested: Record<string, unknown>, expected: Record<string, unknown>, mode: "exact" | "subset"): string[] {
  const eq = mode === "exact" ? same : subsetSame;
  const keysOf = (a: Record<string, unknown>, e: Record<string, unknown>): string[] =>
    (mode === "exact" ? [...new Set([...Object.keys(a), ...Object.keys(e)])] : Object.keys(a)).sort();
  const out: string[] = [];
  for (const k of keysOf(attested, expected)) {
    if (k === "deliveredTree") continue; // the second subject is compared on its own
    // Under another producer, who produced it is the finding itself, printed apart: never a field that
    // "reads differently" here.
    if (mode === "subset" && (k === "runward" || k === "producer")) continue;
    const a = attested[k];
    const e = expected[k];
    const split = SPLIT[k];
    if (split && isObj(a) && isObj(e)) {
      const children = split === "*" ? keysOf(a, e) : split.filter((x) => (mode === "exact" ? x in a || x in e : x in a));
      for (const ch of children) {
        if (mode === "subset" && !(ch in e)) { out.push(`${k}.${ch}`); continue; }
        if (!eq(a[ch], e[ch])) out.push(`${k}.${ch}`);
      }
      if (split !== "*") {
        const rest = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([x]) => !split.includes(x)));
        if (!eq(rest(a), rest(e))) out.push(k);
      }
      continue;
    }
    if (mode === "subset" && !(k in expected)) { out.push(k); continue; }
    if (!eq(a, e)) out.push(k);
  }
  return out;
}

/** The envelope around the predicate: no top-level key in-toto does not define, and the subject this
 *  build writes (its name, a SHA-256 digest and nothing else, and one more subject only for the tree). */
function statementDiffs(attested: Record<string, unknown>, expected: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of Object.keys(attested)) if (!["_type", "subject", "predicateType", "predicate"].includes(k)) out.push(`statement.${k}`);
  const sa = Array.isArray(attested.subject) ? attested.subject : [];
  const se = expected.subject as Array<{ name: string }>;
  if (sa.length !== se.length) out.push("subject");
  const s0 = sa[0];
  if (!isObj(s0) || s0.name !== se[0].name) out.push("subject.name");
  if (isObj(s0)) {
    for (const k of Object.keys(s0)) if (k !== "name" && k !== "digest") out.push(`subject.${k}`);
    if (!isObj(s0.digest) || Object.keys(s0.digest).some((k) => k !== "sha256")) out.push("subject.digest");
  }
  return out;
}

/** The delivered tree, compared on its own (ADR-0113 decision 5): its record must be coherent (the
 *  subject's digest is the digest of the listed files, the count is their number, the rule is this
 *  build's), and the files must match the tree, each change named. */
function compareTree(sa: unknown[], attestedTree: unknown, expectedName: string, current: DeliveredTree, mode: "exact" | "subset") {
  const t = isObj(attestedTree) ? attestedTree : null;
  const entries = t && isObj(t.entries) && Object.values(t.entries).every((h) => typeof h === "string") ? t.entries as Record<string, string> : null;
  const s1 = sa[1];
  const coherent = entries !== null && sa.length === 2 && isObj(s1) && s1.name === expectedName &&
    isObj(s1.digest) && s1.digest.sha256 === digestOfFiles(entries) && Object.keys(s1).every((k) => k === "name" || k === "digest") &&
    t!.files === Object.keys(entries).length &&
    (mode === "subset" || (t!.rule === DELIVERED_TREE_RULE && Object.keys(t!).every((k) => k === "files" || k === "rule" || k === "entries")));
  const attested = entries ?? {};
  const changed = Object.keys(attested).filter((k) => k in current.entries && current.entries[k] !== attested[k]).sort();
  const added = Object.keys(current.entries).filter((k) => !(k in attested)).sort();
  const removed = Object.keys(attested).filter((k) => !(k in current.entries)).sort();
  return { coherent, matches: coherent && changed.length + added.length + removed.length === 0, files: current.files, attestedFiles: entries ? Object.keys(entries).length : null, changed, added, removed };
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** One argument of a command printed for a person or an agent to run: quoted unless it is plainly safe. */
const shellArg = (s: string): string => (/^[A-Za-z0-9_./:@%+=,-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const listed = (xs: string[], max = 3): string => xs.slice(0, max).join(", ") + (xs.length > max ? `, +${xs.length - max} more` : "");

/**
 * Verify a runward verdict attestation offline (ADR-0055 layer 2, refined by ADR-0113).
 *
 * Under the build that produced it, `verify` rebuilds, with the functions `check` emits with, the
 * Statement this binary emits for this tree and for the question the attestation records (`strict`,
 * `through`, whether `--hooks` and `--coverage` ran), and compares every key, both ways: a field nobody
 * re-derives cannot be blessed, because there is no list of fields to forget one from. Under another
 * build it answers neither verified nor not verified: it names the producer and the command that
 * re-derives with it, and gives its own reading as advisory. No network, no trust root, no second tree,
 * no base ref (ADR-0054).
 *
 * Exit codes (the 0/1/2 port, ADR-0012, ADR-0083): 0 = verified · 1 = differs (the digest, a field, or
 * the delivered tree it binds) · 2 = the question cannot be answered here: another build produced it
 * (`version-skew`), the attesting run executed hook commands this one does not re-run
 * (`not-re-derivable`), or the attestation could not be read, is not a runward attestation, or no
 * mission is here to re-derive it.
 */
export async function verifyCommand(attestationPath: string, opts: { path?: string; json?: boolean }): Promise<void> {
  const fail2 = (msg: string, reason: string): never => {
    // `error` (ADR-0083) is additive beside `reason`, which keeps its value.
    if (opts.json) process.stdout.write(JSON.stringify({ runward: VERSION, verified: false, reason, error: reason === "no-mission" ? "no-mission" : "unreadable-input", message: msg, exitCode: 2 }) + "\n");
    else console.error(status.error(msg));
    process.exit(2);
  };

  if (!existsSync(attestationPath)) fail2(`Attestation not found: ${attestationPath}`, "attestation-not-found");
  let statement: Record<string, unknown>;
  try { statement = JSON.parse(readFileSync(attestationPath, "utf8")); }
  catch { fail2(`Attestation is not valid JSON: ${attestationPath}`, "attestation-not-json"); }
  if (!isObj(statement!)) fail2(`Attestation is not a JSON object: ${attestationPath}`, "not-in-toto");

  // A DSSE envelope is TOLERATED, never trusted: cosign wraps the Statement it signs in
  // { payloadType, payload: base64, signatures[] }. verify DECODES the payload and proceeds on the
  // Statement inside; it NEVER verifies the signature — runward holds no key and no trust root
  // (ADR-0021/ADR-0054/ADR-0093). The signature count is REPORTED so the operator verifies it with
  // their own tooling (cosign verify-blob-attestation), and the output says so in words.
  let dsse: { signaturesPresent: number } | null = null;
  const maybeEnvelope = statement! as { payloadType?: unknown; payload?: unknown; signatures?: unknown[] };
  if (typeof maybeEnvelope.payloadType === "string" && typeof maybeEnvelope.payload === "string") {
    if (!/in-toto/.test(maybeEnvelope.payloadType)) fail2(`DSSE envelope whose payloadType is "${maybeEnvelope.payloadType}" — not an in-toto payload.`, "dsse-not-in-toto");
    try {
      const decoded = JSON.parse(Buffer.from(maybeEnvelope.payload, "base64").toString("utf8"));
      dsse = { signaturesPresent: Array.isArray(maybeEnvelope.signatures) ? maybeEnvelope.signatures.length : 0 };
      statement = decoded;
    } catch { fail2("DSSE payload is not base64-encoded JSON.", "dsse-payload-invalid"); }
    if (!isObj(statement!)) fail2("DSSE payload is not a JSON object.", "dsse-payload-invalid");
  }

  if (statement!._type !== IN_TOTO_STATEMENT_TYPE) fail2("Not an in-toto Statement (wrong _type).", "not-in-toto");
  // A bundle (ADR-0055 layer 4) is about its listed files, not a verdict: re-hash each by its raw
  // bytes, as any cosign/in-toto tool would, and confirm it is present and unchanged. No mission.
  if (statement!.predicateType === RUNWARD_BUNDLE_PREDICATE_TYPE) { verifyBundle(statement! as Parameters<typeof verifyBundle>[0], opts, dsse); return; }
  if (statement!.predicateType !== RUNWARD_PREDICATE_TYPE) {
    fail2("Not a runward attestation (predicateType is neither a verdict nor a bundle).", "not-a-runward-attestation");
  }
  const subjects: unknown[] = Array.isArray(statement!.subject) ? statement!.subject : [];
  const s0 = isObj(subjects[0]) ? subjects[0] : null;
  const claimedDigest = isObj(s0?.digest) && typeof s0!.digest.sha256 === "string" ? s0!.digest.sha256 : null;
  if (!claimedDigest) fail2("Attestation carries no subject digest — nothing to bind to a tree.", "no-subject-digest");

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) fail2("No runward/ mission found here or above — verify re-derives the verdict from the mission tree.", "no-mission");
  const mission = join(root!, "runward");
  const p: Record<string, unknown> = isObj(statement!.predicate) ? statement!.predicate : {};

  // ── The question the attestation records, and nothing it does not ────────────────────────────────
  // ADR-0053: a prefix attestation re-derives under the horizon it recorded. A `through` that names no
  // phase is re-derived without one, and the comparison names `through`.
  const strict = p.strict === true;
  const through = typeof p.through === "string" && THROUGH_PHASE_IDS.includes(p.through) ? p.through : undefined;
  // The run used --hooks exactly when the payload carries `hooks` (ADR-0030), and --coverage exactly
  // when it carries `coverage`. Each choice shapes the question, never the answer: an attestation that
  // drops the block is the honest attestation of the run without the flag, and is compared as one.
  const hooksAsked = p.hooks !== undefined;
  const coverageAsked = p.coverage !== undefined;

  // The one input no offline reading can give: which of the operator's hook commands failed. The file
  // is re-read (pure, nothing runs); the attesting run's record of the failures is taken only when each
  // entry names a configured command, in the order the run executes them, and then it is DECLARED, never
  // re-derived (`not-re-derivable`, below).
  let hookFailed = 0;
  let hooksExecuted = 0;
  let expectedHooks: { config: "absent" | "invalid" | "ok"; problem: string | null; failed: Array<{ phase: "before" | "after"; command: string }> } | undefined;
  if (hooksAsked) {
    const cfg = readHooksConfig(mission);
    const order = cfg.state === "ok" ? [...cfg.before.map((command) => ({ phase: "before" as const, command })), ...cfg.after.map((command) => ({ phase: "after" as const, command }))] : [];
    const claimed = isObj(p.hooks) && Array.isArray(p.hooks.failed) ? p.hooks.failed : null;
    const failed: Array<{ phase: "before" | "after"; command: string }> = [];
    let at = 0;
    let coherent = claimed !== null;
    for (const f of claimed ?? []) {
      while (at < order.length && !(isObj(f) && order[at].phase === f.phase && order[at].command === f.command)) at++;
      if (at === order.length) { coherent = false; break; }
      failed.push(order[at++]);
    }
    expectedHooks = { config: cfg.state, problem: cfg.state === "invalid" ? cfg.problem : null, failed: coherent ? failed : [] };
    hookFailed = expectedHooks.failed.length + (cfg.state === "invalid" ? 1 : 0);
    hooksExecuted = order.length;
  }

  // ── The Statement this build emits for this tree and that question ──────────────────────────────────
  // The SAME functions `check` publishes with (machinePayload, nextStep, buildVerdictStatement): there
  // is no second assembly to drift from check.ts, and a field added to one side only stops an honest
  // attestation from verifying the day it lands, which the tests read.
  const verdict = computeVerdict(mission, { strict, through, hookFailed });
  const question = attestedQuestion({ strict, through, hooks: hooksAsked });
  const payload = machinePayload(verdict, {
    version: VERSION,
    missionRoot: root!,
    currentGate: currentGateLabel(verdict.report, verdict.clean, redPhases(verdict)),
    adrCount: verdict.report.adrCount,
    adrSetAside: verdict.report.adrSetAside,
    clean: verdict.clean,
    strict,
    gaps: verdict.gaps,
    strictGaps: verdict.strictGaps,
    hookFailed,
    hooks: expectedHooks,
    deliverables: deliverableRowsWithPhaseId(verdict.deliverables),
    conformance: strict ? conformanceRowsLocated(verdict, manifestLineLocator(mission)) : [],
    corpusPin: corpusStamp(rulesDir(mission)),
    corpusDrift: corpusDrift(mission, rulesDir(mission)),
    gateNonScope: GATE_NON_SCOPE,
    next: nextPayload(nextStep({ gaps: verdict.gaps, strictGaps: verdict.strictGaps, hookFailed, breakdown: verdict.strictBreakdown }, question)),
    coverage: coverageAsked ? coverageSummary(verdict.report, decisionCoverage(mission)) : undefined,
    junitNotGreen: citedJUnitNotGreen(mission),
  });
  const missionFiles = missionStateFiles(root!, mission);
  const scope = missionStateScope(missionFiles, mission);
  const treeBound = subjects.length > 1 || p.deliveredTree !== undefined;
  const currentTree = treeBound ? deliveredTreeOf(root!) : undefined;
  const expected = buildVerdictStatement(root!, mission, { ...payload, mission: declaredMissionName(mission) }, { deliveredTree: currentTree, missionFiles });
  const expectedSubject = (expected.subject as Array<{ name: string; digest: { sha256: string } }>);
  const currentDigest = expectedSubject[0].digest.sha256;

  // ── Who produced it ─────────────────────────────────────────────────────────────────────────────────
  // ADR-0113 decision 4. A verdict re-derives only under the logic that produced it. Every attestation
  // made before the producer was recorded carries `runward` alone and is another build by definition,
  // since this one always records itself; one that names no producer at all is not an older one (every
  // runward since 0.35.0 writes `runward`) and is compared under this build, where it differs.
  const self = producerIdentity();
  const attestedProducer = isObj(p.producer) ? p.producer : null;
  const producedBy = typeof attestedProducer?.version === "string" ? attestedProducer.version : typeof p.runward === "string" ? p.runward : null;
  const sameBuild = attestedProducer !== null && attestedProducer.version === self.version && attestedProducer.build === self.build;
  const versionSkew = !sameBuild && producedBy !== null;
  const mode = versionSkew ? "subset" : "exact";

  const digestMatches = claimedDigest === currentDigest;
  const currentVerdict = verdict.clean ? "clean" : "gaps";
  const verdictMatches = p.verdict === currentVerdict && p.exitCode === verdict.exitCode;
  const tree = currentTree ? compareTree(subjects, p.deliveredTree, `${declaredMissionName(mission)}${DELIVERED_TREE_SUBJECT_SUFFIX}`, currentTree, mode) : null;
  const differing = [
    ...(versionSkew ? [] : statementDiffs(statement!, expected)),
    ...predicateDiffs(p, expected.predicate as Record<string, unknown>, mode),
    ...(tree && !tree.coherent ? ["deliveredTree"] : []),
  ];
  const predicateMatches = differing.length === 0;
  const notReDerived = !versionSkew && hooksExecuted > 0 ? ["hooks.failed"] : [];

  type Result = "verified" | "differs" | "version-skew" | "not-re-derivable";
  const result: Result = versionSkew ? "version-skew"
    : !digestMatches || !predicateMatches || (tree !== null && !tree.matches) ? "differs"
      : hooksExecuted > 0 ? "not-re-derivable"
        : "verified";
  const exitCode = result === "verified" ? 0 : result === "differs" ? 1 : 2;
  const verified = result === "verified";
  const attestedVerdict = typeof p.verdict === "string" ? p.verdict : null;
  const deferredCount = isObj(p.horizon) && Array.isArray(p.horizon.deferred) ? p.horizon.deferred.length : 0;
  // The version is printed in a command only when it reads as a version: the field comes from the
  // attestation, and "0.1.0; curl … | sh" printed as the gesture to run was measured on 2026-11-05.
  const rederive = versionSkew
    ? (SEMVER.test(producedBy!)
      ? { version: producedBy, command: ["npx", "--yes", `${PACKAGE_NAME}@${producedBy}`, "verify", shellArg(attestationPath), ...(opts.path ? ["-p", shellArg(opts.path)] : [])].join(" ") }
      : { version: null, command: null })
    : null;
  const notCovered = treeBound ? null : "every file of the project outside runward/ that the manifests do not cite";

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      runward: VERSION, verified,
      // ADR-0113: one of verified | differs | version-skew | not-re-derivable; `error` names the class of
      // an exit 2 (ADR-0083), additive.
      result,
      ...(exitCode === 2 ? { error: result } : {}),
      // Additive (ADR-0030): `verified` answers "is this attestation authentic for this tree", never
      // "did the gate pass" (RWD-2026-0132).
      attestedVerdict,
      producedBy, versionSkew,
      producer: attestedProducer ?? (producedBy !== null ? { version: producedBy } : null),
      verifier: self,
      rederive,
      dsse: dsse ? { envelope: true, signaturesPresent: dsse.signaturesPresent, signatureVerified: false } : null,
      digest: { matches: digestMatches, attested: claimedDigest, current: currentDigest, covers: scope, notCovered },
      tree: tree ? { matches: tree.matches, coherent: tree.coherent, files: tree.files, attestedFiles: tree.attestedFiles, changed: tree.changed, added: tree.added, removed: tree.removed } : null,
      verdict: { matches: verdictMatches, attested: attestedVerdict, current: currentVerdict },
      strict,
      level: strict ? (through ? `RUNWARD_GATE_STRICT_THROUGH_${String(through).toUpperCase()}` : "RUNWARD_GATE_STRICT") : "RUNWARD_GATE_PRESENCE",
      // `comparison: advisory` under another build: this build's reading, which decides nothing.
      predicate: { matches: predicateMatches, differing, notReDerived, comparison: versionSkew ? "advisory" : "exact" },
      horizon: through ? { through, deferred: deferredCount } : null,
      exitCode,
    }, null, 2) + "\n");
    process.exitCode = exitCode;
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — verify`, attestationPath));
  if (dsse) console.log(`  ${c.warning("◑")} ${c.darkGray(`DSSE envelope: payload decoded; ${dsse.signaturesPresent} signature(s) present and NOT verified — runward anchors no trust root; check them with your own tooling (cosign verify-blob-attestation)`)}`);
  const shortBuild = (b: unknown): string => (typeof b === "string" && /^sha256:[a-f0-9]{64}$/.test(b) ? `${b.slice(0, 19)}…` : "no build recorded");
  // The producer version comes from the attestation: shown as it is only when it reads as a version,
  // quoted otherwise, so no text of the document reaches the terminal unescaped.
  const shownVersion = producedBy !== null && SEMVER.test(producedBy) ? producedBy : JSON.stringify(producedBy);
  console.log(section("Produced by"));
  if (sameBuild) {
    console.log(`  ${status.success(`runward ${self.version}, build ${shortBuild(self.build)} — the build running this check`)}`);
  } else if (versionSkew) {
    console.log(`  ${c.warning("◑")} ${c.white(`runward ${shownVersion}, ${attestedProducer ? (shortBuild(attestedProducer.build) === "no build recorded" ? "no build recorded" : `build ${shortBuild(attestedProducer.build)}`) : "no build recorded"}`)} ${c.darkGray(`— this check runs runward ${self.version}, build ${shortBuild(self.build)}`)}`);
  } else {
    console.log(`  ${status.error("no producer named — every runward since 0.35.0 writes one; compared under this build")}`);
  }

  console.log(section(versionSkew
    ? `Read by runward ${self.version}, advisory: not the producer's logic, it decides nothing`
    : "Re-derived from the mission tree (no network, no trust root)"));
  const scopeWords = `runward/ (${plural(scope.missionFiles, "file")}) and the ${plural(scope.citedOutside.length, "evidence file")} the manifests cite outside it`;
  console.log(`  ${digestMatches
    ? status.success(`subject digest matches — it binds ${scopeWords}`)
    : status.error(`subject digest DIFFERS — a file of runward/ or one the manifests cite changed, appeared or disappeared since this attestation was made`)}`);
  if (!digestMatches) console.log(`    ${c.darkGray(`attested ${claimedDigest!.slice(0, 16)}… · now ${currentDigest.slice(0, 16)}… (now: ${scopeWords})`)}`);
  if (!treeBound) console.log(`    ${c.darkGray("not covered: every other file of the project — `runward check --attest --whole-tree` binds them too")}`);
  console.log(`  ${verdictMatches
    ? status.success(`verdict re-derives (${currentVerdict}) under ${strict ? "--strict" : "the deliverables-only gate (no --strict)"}`)
    : status.error(`verdict DIFFERS — attested "${attestedVerdict}", re-derived "${currentVerdict}"`)}`);
  const fieldCount = Object.keys(expected.predicate as object).filter((k) => k !== "deliveredTree").length;
  console.log(`  ${predicateMatches
    ? status.success(versionSkew ? "every field the attestation carries reads the same under this build" : `every predicate field re-derives (${fieldCount} fields, each compared both ways)`)
    : status.error(`${versionSkew ? "fields that read differently under this build" : "predicate DIFFERS from the tree"} — ${differing.join(", ")}`)}`);
  if (tree) {
    if (tree.matches) console.log(`  ${status.success(`the whole delivered tree matches (${plural(tree.files, "file")})`)}`);
    else {
      const parts = [
        tree.changed.length ? `${tree.changed.length} changed (${listed(tree.changed)})` : null,
        tree.added.length ? `${tree.added.length} added (${listed(tree.added)})` : null,
        tree.removed.length ? `${tree.removed.length} removed (${listed(tree.removed)})` : null,
        tree.coherent ? null : "its record is not coherent (the subject's digest, the count or the rule)",
      ].filter(Boolean);
      console.log(`  ${status.error(`the whole delivered tree differs (${tree.attestedFiles ?? "?"} files attested, ${tree.files} now): ${parts.join("; ")}`)}`);
    }
  }
  if (!versionSkew && hooksExecuted > 0) console.log(`  ${c.warning("◑")} ${c.darkGray(`hook outcomes not re-derived — the attesting run executed ${plural(hooksExecuted, "command")} of runward/hooks.json, ${expectedHooks!.failed.length} failed by its record; this command runs nothing`)}`);
  if (through) console.log(`  ${c.warning("◑")} ${c.darkGray(`PREFIX attestation through ${through} — NOT a completion verdict; ${deferredCount} later deliverable(s) deferred`)}`);

  console.log(section("Result"));
  const covered = tree ? `, and the whole delivered tree matches (${plural(tree.files, "file")})` : `, from ${scopeWords}. Any other file of the project is not covered`;
  if (result === "verified" && attestedVerdict !== "clean") {
    // Exit 0 stays for an honest record of a refused crossing (RWD-2026-0132): `verify` answers whether
    // the attestation is AUTHENTIC. The first word the reader meets names the colour.
    console.log("  " + status.warning(`verified: this attestation honestly records a RED gate (verdict: ${attestedVerdict}). The delivery did not cross.`));
    console.log("  " + c.darkGray(`authentic, not passing: exit 0 says the record is true to this tree, not that the gate was crossed. Every field re-derives under the build that produced it${covered}.`));
  } else if (result === "verified") {
    console.log("  " + status.success(`verified — every field of this attestation re-derives under the build that produced it${covered}.`));
  } else if (result === "differs" && digestMatches && predicateMatches && tree && !tree.matches) {
    // ADR-0113 decision 5: the two subjects are answered apart. The verdict's own reading stands; the
    // tree it was attested beside is no longer this one.
    console.log("  " + status.error(`NOT verified — the whole delivered tree differs (${plural(tree.changed.length + tree.added.length + tree.removed.length, "file")}); the verdict and every field re-derive under the build that produced it.`));
    console.log("  " + c.darkGray("The verdict was attested beside a tree that is not this one: re-attest with `runward check --strict --attest --whole-tree` once the changes are reviewed."));
  } else if (result === "differs") {
    const what = [!digestMatches ? "the subject digest" : null, !predicateMatches ? (differing.length === 1 ? `the field ${differing[0]}` : `${differing.length} fields (${listed(differing, 6)})`) : null, tree && !tree.matches ? "the delivered tree" : null].filter(Boolean).join("; ");
    console.log("  " + status.error(`NOT verified — what differs: ${what}. Do not trust this attestation for this tree.`));
  } else if (result === "version-skew") {
    console.log("  " + status.warning(`not answered by this build — produced by runward ${shownVersion}. A verdict re-derives only under the runward that produced it (exit 2).`));
    if (rederive?.command) {
      console.log("  " + c.darkGray("Re-derive it with the producing version:"));
      console.log(`    ${c.primary(rederive.command)}`);
      console.log("  " + c.darkGray(`Its answer carries that version's own limits (https://github.com/stranxik/runward/blob/main/docs/compliance/known-defects.md lists them by version); if the producer was an unpublished build, only that build can answer.`));
    } else {
      console.log("  " + c.darkGray("The attestation's producer version does not read as a version, so no command is given."));
    }
  } else {
    console.log("  " + status.warning(`not verified offline — every other field re-derives and agrees, but the outcome of the ${plural(hooksExecuted, "hook command")} is the attesting run's record (exit 2).`));
    console.log(`  ${c.darkGray("Re-run them:")} ${c.primary(["runward check", ...(strict ? ["--strict"] : []), ...(through ? [`--through ${through}`] : []), "--hooks"].join(" "))}`);
  }
  process.exitCode = exitCode;
  console.log();
}
