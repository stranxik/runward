// Drift guard for docs/compliance/regulated-adoption.md (ADR-0031).
//
// The vendor sheet is a document derived from real facts about this repository. A document
// can silently go stale. This test makes that impossible: every verifiable fact the sheet
// asserts to a regulated buyer is checked here. If the posture changes — a control removed,
// an action un-pinned, a long-lived secret introduced, the licence changed, the SBOM/provenance
// step deleted — a test breaks and CI reddens. So the fix is forced: restore the fact, or update
// the sheet. The document can never lie to an auditor without turning the gate red first.
//
// This is the runward principle applied to runward's own governance: the maintainer decides,
// but a deterministic gate guarantees the claim and the reality do not drift apart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const has = (p) => existsSync(join(ROOT, p));
const workflows = () => readdirSync(join(ROOT, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f));

test("posture: the governance / health files the sheet relies on exist", () => {
  for (const f of [
    "SECURITY.md", ".github/CODEOWNERS", "GOVERNANCE.md", "CONTRIBUTING.md",
    ".github/dependabot.yml", ".github/workflows/scorecard.yml", ".github/workflows/codeql.yml",
    "LICENSE", "NOTICE.md", "CHANGELOG.md", "package-lock.json",
    "docs/compliance/regulated-adoption.md", "docs/compliance/oscal-ingest.md",
    "test/oscal-ingest.py",
  ]) assert.ok(has(f), `missing ${f} — claimed by regulated-adoption.md`);
  assert.ok(readdirSync(join(ROOT, "docs/adr")).some((f) => /^ADR-0031/.test(f)), "ADR-0031 present");
});

test("posture: the instructions for a change ask that new functionality add its tests to the automated suite", () => {
  // The test policy a contributor reads before proposing a change (the OpenSSF criteria test_policy and
  // tests_documented_added): in CONTRIBUTING.md's section for opening a pull request, and in the
  // template's checks.
  const contributing = read("CONTRIBUTING.md");
  const before = contributing.slice(contributing.indexOf("## Before you open a PR"), contributing.indexOf("\n## ", contributing.indexOf("## Before you open a PR") + 1));
  assert.match(before, /A change that adds functionality adds its tests to that automated suite, which CI runs on every pull request/);
  const template = read(".github/PULL_REQUEST_TEMPLATE.md");
  const checks = template.slice(template.indexOf("## Checks"));
  assert.match(checks, /- \[ \] New functionality adds its tests to the automated suite \(`npm test`, which CI runs\)/);
  // The suite the sentences name is the one CI runs on a pull request.
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /^on:\n(?:.*\n)*?\s+pull_request:/m);
  assert.match(ci, /^\s+- run: npm test$/m);
});

test("posture: release wires provenance + an attested SBOM bound to the published tarball", () => {
  const rel = read(".github/workflows/release.yml");
  assert.match(rel, /npm publish[^\n]*--provenance/, "npm --provenance (Sigstore signature)");
  // ADR-0116 decision 2: the release's SBOM is the package's, derived from the tarball and the lockfile
  // by the repository's own script, twice (the sbom job, then the verify job's cross-check).
  const derivations = rel.match(/node scripts\/package-sbom\.mjs --tarball "\$TARBALL" --lock package-lock\.json/g) ?? [];
  assert.ok(derivations.length >= 2, "the package SBOM is written, then derived again and compared");
  assert.ok(!/sbom-action@/.test(rel), "no repository scan stands in for the package SBOM in the release");
  // actions/attest (attest-sbom's successor) attests the SBOM when sbom-path is set;
  // both matches together keep the guarded property: SBOM SLSA-attested, SHA-pinned.
  assert.match(rel, /actions\/attest@[0-9a-f]{40}/, "SBOM SLSA-attested (SHA-pinned action)");
  assert.match(rel, /sbom-path:/, "the attestation is bound to the SBOM (sbom-path input)");
  assert.match(rel, /npm publish "\$TARBALL"/, "publishes the packed tarball itself (attested == published)");
});

test("posture: build provenance is signed in the isolated builder, and the caller cross-checks it", () => {
  // ADR-0049. Three properties, each guarded in the direction it can silently regress: the builder
  // exists and signs (a deleted builder or an un-pinned attest step would fake the isolation), the
  // caller actually calls it (a builder nobody calls isolates nothing), and the caller refuses to
  // publish a tarball it cannot byte-match (the hand-off must not become a single point of silent
  // divergence).
  assert.ok(has(".github/workflows/build-and-attest.yml"), "the isolated builder workflow exists");
  const builder = read(".github/workflows/build-and-attest.yml");
  assert.match(builder, /workflow_call:/, "the builder is reusable (workflow_call): that is the isolation mechanism");
  assert.match(builder, /attest-build-provenance@[0-9a-f]{40}/, "provenance attested IN the builder, SHA-pinned");
  const rel = read(".github/workflows/release.yml");
  assert.match(rel, /uses: \.\/\.github\/workflows\/build-and-attest\.yml/, "release calls the isolated builder");
  assert.ok(!/attest-build-provenance@/.test(rel), "the caller does NOT attest provenance itself — that would defeat the isolation");
  assert.match(rel, /refusing to publish/, "the determinism cross-check gates the publish");
  const verify = read(".github/workflows/verify-release.yml");
  assert.match(verify, /--signer-workflow/, "verify-release demands the builder identity on release runs");
});

/** The script `sudo unshare -n bash -c '…'` runs in ci.yml: a command written outside it runs with
 *  the network, whatever the rest of the file says. null when there is no such block. */
function unshareBlock(ci) {
  const m = ci.match(/sudo unshare -n bash -c '\n([\s\S]*?)\n\s*'\n/);
  return m ? m[1] : null;
}
/** What the network-cut block must run (docs/isolated-environments.md and regulated-adoption.md cite it). */
const CUT = [
  [/ip route \| grep -q "\^default"/, "the check that no default route is left"],
  [/node test\/smoke\.js/, "the smoke suite"],
  [/node test\/oscal-schema\.js/, "the OSCAL schema test"],
  [/node test\/intoto-schema\.js/, "the in-toto schema test"],
  [/node dist\/cli\.js check --strict\n/, "the self-gate"],
  [/node --test test\/unit\/corpus-no-fetch\.test\.js/, "the vendored-corpus no-fetch test (ADR-0057)"],
  [/check --strict --attest > verdict\.intoto\.json/, "an attestation emitted"],
  [/cli\.js" verify verdict\.intoto\.json/, "verify"],
  [/cli\.js" report\)/, "report"],
  [/cli\.js" ratify --agent \S+ --for \S+ --accept /, "ratify --agent"],
];
const missingFromCut = (ci) => {
  const block = unshareBlock(ci);
  if (block === null) return ["the `sudo unshare -n bash -c` block itself"];
  return CUT.filter(([re]) => !re.test(block)).map(([, what]) => what);
};

test("posture: what the sheets say runs with the network cut is INSIDE the unshare block, not merely in ci.yml", () => {
  assert.deepEqual(missingFromCut(read(".github/workflows/ci.yml")), [],
    "each of these must run inside `sudo unshare -n bash -c '…'` in ci.yml");
});

test("positive control: a command moved out of the unshare block, or the block removed, is caught", () => {
  const ci = read(".github/workflows/ci.yml");
  const block = unshareBlock(ci);
  assert.ok(block, "the block is found in the real file");
  // verify moved after the closing quote: still in ci.yml, no longer in the cut.
  const verifyLine = block.split("\n").find((l) => /cli\.js" verify verdict\.intoto\.json/.test(l));
  assert.ok(verifyLine, "the verify line exists in the block");
  const moved = ci.replace(verifyLine + "\n", "").replace(/(\n\s*'\n)/, `$1          ${verifyLine.trim()}\n`);
  assert.match(moved, /cli\.js" verify verdict\.intoto\.json/, "the command is still in the file");
  assert.ok(missingFromCut(moved).includes("verify"), "and the guard sees it left the cut");
  assert.deepEqual(missingFromCut(ci.replace("sudo unshare -n bash -c", "bash -c")), ["the `sudo unshare -n bash -c` block itself"]);
});

test("posture: CI runs core tests network-isolated, gates runward, and tracks SBOM drift", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /unshare -n/, "network-isolated core tests (structural zero-network)");
  assert.match(ci, /check --strict/, "self-gate as a required check");
  // ADR-0057: the vendored-corpus no-fetch invariant runs INSIDE the network-cut block, so a green
  // run structurally proves resolution never fetched. Guarded here so the step cannot be silently
  // dropped (mirroring the /unshare -n/ check above).
  assert.match(ci, /node --test test\/unit\/corpus-no-fetch\.test\.js/, "the vendored corpus resolves under network isolation (ADR-0057 no-fetch invariant)");
  assert.match(ci, /sbom-action@[0-9a-f]{40}/, "SBOM on every push/PR (drift), SHA-pinned");
  assert.match(ci, /compliance-trestle/, "OSCAL ingested by a third-party tool (compliance-trestle) in CI");
  // 2026-08-17: "same working tree ⇒ same verdict" is proven on the third OS — the full suite plus
  // the self-gate run on windows-latest. Locked here so the leg cannot be silently dropped (its
  // first run found seven real defects; a leg that finds bugs is exactly the one that gets removed).
  assert.match(ci, /windows-latest/, "the Windows leg (full npm test + self-gate) is present");
  // ADR-0104 decision 7: one CI run per ref, superseded pull-request runs cancelled, `main` runs never.
  assert.match(ci, /^concurrency:\n  group: ci-\$\{\{ github\.ref \}\}\n  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}$/m,
    "a concurrency group per ref, cancelling only superseded pull-request runs (ADR-0104)");
});

test("posture: dated external facts are watched out-of-band (ADR-0032)", () => {
  assert.ok(has(".github/workflows/watch-external-facts.yml"), "the external-facts watch workflow exists");
  const wf = read(".github/workflows/watch-external-facts.yml");
  assert.match(wf, /schedule:/, "the watch runs on a schedule, outside the gate");
  assert.match(wf, /usnistgov\/OSCAL/, "it checks the pinned OSCAL version against NIST releases");
  assert.match(wf, /reviewBy/, "it checks the regime reviewBy dates");
  // The claim the watch protects: at least one shipped regime carries a reviewBy re-check date.
  const regimes = readdirSync(join(ROOT, "regimes")).filter((f) => f.endsWith(".json"));
  assert.ok(
    regimes.some((f) => /"reviewBy"\s*:/.test(read(join("regimes", f)))),
    "at least one regimes/*.json carries a reviewBy date for the watch to track",
  );
});

test("posture: CodeQL scans the sources and the workflows on push, pull request and schedule", () => {
  // The sheet's "Continuous posture" row claims all three triggers and both languages; a dropped
  // trigger or language would leave the row true in name and false in coverage.
  const wf = read(".github/workflows/codeql.yml");
  for (const trigger of [/^\s*push:/m, /^\s*pull_request:/m, /^\s*schedule:/m]) assert.match(wf, trigger, `codeql.yml keeps ${trigger}`);
  assert.match(wf, /language: \[javascript-typescript, actions\]/, "both languages analysed");
  assert.match(wf, /codeql-action\/analyze@[0-9a-f]{40}/, "analysis step present, SHA-pinned");
});

test("posture: every workflow action is pinned by commit SHA (no mutable tags)", () => {
  for (const wf of workflows()) {
    for (const m of read(join(".github/workflows", wf)).matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)) {
      // A LOCAL reference (`./…` — a reusable workflow or an action shipped by this repo, such as
      // `./verify`) is the one shape that CANNOT be pinned and needs no pin: it always runs the
      // file at the calling run's own commit, which is stronger than a SHA (a pin can lag;
      // same-commit cannot). Anything remote must still carry its 40 chars.
      if (m[1].startsWith("./")) continue;
      assert.match(m[1], /@[0-9a-f]{40}$/, `${wf}: "${m[1]}" is not pinned by a 40-char commit SHA`);
    }
  }
});

test("posture: no long-lived secrets in any workflow (OIDC trusted publishing only)", () => {
  for (const wf of workflows()) {
    const refs = [...read(join(".github/workflows", wf)).matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    assert.deepEqual(refs, [], `${wf}: references long-lived secret(s) [${refs.join(", ")}] — the sheet claims none`);
  }
});

test("posture: licences match the sheet — MIT tooling, CC BY-ND doctrine", () => {
  assert.match(read("LICENSE"), /\bMIT\b/, "MIT tooling licence");
  assert.match(read("NOTICE.md"), /BY-ND/, "CC BY-ND doctrine notice");
});

test("posture: the conformance-gate incident log the ADRs cite actually exists, and they cite it", () => {
  // Eight ADRs name "the conformance-gate incident log" as their reevaluation watch mechanism. The
  // 2026-08-14 audit found no file by that name — a watch mechanism eight decisions depend on,
  // existing nowhere. It existed under a better name (the known-defects register), and that is now
  // stated there. This guard keeps the citation from going dangling again, in either direction.
  const reg = read("docs/compliance/known-defects.md");
  assert.match(reg, /conformance-gate incident log/i, "the register declares that it IS the log the ADRs cite");
  const citing = readdirSync(join(ROOT, "docs/adr"))
    .filter((f) => /^ADR-\d{4}/.test(f))
    .filter((f) => /incident log/i.test(read(join("docs/adr", f))));
  assert.ok(citing.length >= 5, `expected the ADRs whose watch mechanism is the log, got ${citing.length}`);
  // Each RWD entry carries the fields an assessor reads: an id, and somewhere on its row a fix.
  const ids = [...reg.matchAll(/RWD-\d{4}-\d{4}/g)].map((m) => m[0]);
  assert.ok(new Set(ids).size >= 20, `the register holds its dated entries, got ${new Set(ids).size}`);
});
