# ADR-0048: the release carries verifiable proof, and the builder paths we refuse

**Date**: 2026-08-11
**Status**: accepted (ratified 2026-08-11 — see Ratification)

## Context

Until 2026-08-11 a GitHub release of runward carried the SBOM and nothing else. The provenance
existed — `npm audit signatures` returns it, and deps.dev relays `verified: true` for every version
since 0.15.0 — but it lived on the npm registry, and a GitHub release is where people look. The
project's own OpenSSF Scorecard read the release assets and answered, verbatim, *"Project has not
signed or included provenance with any releases"*: the public scorecard contradicted the project's
strongest claim, across at least three releases.

Fixing the attachment (0.33.3) surfaced two deeper findings, both established at source level
against ossf/scorecard **v5.5.0** (commit `c395761`, cloned and read 2026-08-11):

1. **The score is a filename convention.** The Signed-Releases check tests `strings.HasSuffix` on
   asset names over the last five releases — signatures are `.asc`, `.minisig`, `.sig`, `.sign`,
   `.sigstore`, `.sigstore.json` (8 points), provenance is `.intoto.jsonl` alone (10 points),
   `floor(sum / releases-with-assets)` — and never downloads an asset
   (`probes/releasesAreSigned/impl.go:43,69`, `probes/releasesHaveProvenance/impl.go:43,70`,
   `checks/evaluation/signed_releases.go:111-152`, `clients/githubrepo/releases.go:78-81`). No
   cryptographic verification exists anywhere in the tool; its own documentation says "The check
   does not verify the signatures". A zero-byte file with the right name scores the same as a real
   bundle. The check's `releasesHaveVerifiedProvenance` probe is experimental, belongs to no check,
   and itself only relays a boolean deps.dev takes from the npm registry.
2. **The verifier GitHub hands to everyone could not verify the artifact GitHub hosts.** With no
   flag, `gh attestation verify runward-0.33.3.tgz --repo stranxik/runward` answered HTTP 404,
   measured 2026-08-11: gh filters on the provenance predicate by default and the GitHub attestation
   store held only the SBOM attestation (predicate `https://cyclonedx.org/bom`) for that digest —
   the build provenance lived on npm alone, which gh does not read.

An enterprise that trusts the score is therefore trusting a naming convention. What it should be
handed instead is a replayable verification, which is what this ADR wires.

## Decision

**1. Every release attaches the tarball and two attestation bundles, under locked names.**
`runward-X.Y.Z.intoto.jsonl` is the SBOM attestation; `runward-X.Y.Z.provenance.intoto.jsonl` is the
build provenance, emitted by `actions/attest-build-provenance` against the same tarball that is
published. A missing bundle reds the release (`test -s`). Three files suffice for a fully offline
verification: the tarball, a bundle, and a pre-fetched trusted root
([docs/verifying-a-release.md](../verifying-a-release.md)).

**2. The asset names never change to `.sigstore.json`.** That suffix is classed as a *signature*
(8 points) where `.intoto.jsonl` is *provenance* (10) — `probes/releasesAreSigned/impl.go:43` at
tag v5.5.0. A well-intentioned rename would silently downgrade the release's category. The score is
a side effect and is never the goal; the goal is verifiability from the release page alone. This
clause exists so nobody "improves" the naming.

**3. slsa-github-generator is refused, not merely unchosen.** Three reasons, each sufficient:
its repository carries an official non-maintenance notice (merged to main 2026-08-07, PR #4515);
its Node.js builder never left beta; and its publish path uses a long-lived `NPM_TOKEN`, which
would regress this project from OIDC trusted publishing — the one property of the chain praised in
every audit of it — to exactly the durable secret the posture guard forbids
(`test/unit/regulated-posture.test.js`).

**4. The isolated-builder path is deferred, with named preconditions — not refused.** GitHub
documents one mechanism for the build level above the current one: moving the build into a reusable
workflow, verifiable by a reader with `gh attestation verify --signer-workflow`. The gain is real
and the effort bounded (1 to 2 maintainer-days), but it is the only gesture of this family that
touches a publish chain that demonstrably works, so it waits for: a canary release; byte-for-byte
reproducibility re-proven on that canary before any public sentence; and the no-overclaim guard
question settled first, because the admissible citation currently passes the guard only through the
dot in "v1.0", which is an accident of a regex and not a decision.

**5. The four releases in the current Scorecard window are backfilled, under a hash rule.** Their
attestations are real and were produced at build time — they live in the GitHub attestation store
and on npm; only the attachment to the GitHub release is missing, and v0.33.2 through v0.32.0 do
not even carry their tarball. Per release: the npm tarball, hash-matched against the attestation
subject, plus the SBOM bundle restored via `gh attestation download`; a dated line in the release
notes says when the assets were attached (the Sigstore timestamps independently date the
attestations to the original release day). **On any hash mismatch: abstain and report.** An
attachment that cannot be hash-verified is exactly the hollow proof the rest of this ADR refuses.

## Consequences

- A reader verifies a release offline from three files, with the verifier identity pinned; the
  procedure, its expected outputs and its negative controls are in
  [docs/verifying-a-release.md](../verifying-a-release.md), including the paragraph on what none of
  it proves (the signature establishes *who attested these bytes*, never that the code is sound).
- `.github/workflows/verify-release.yml` replays that procedure against the published artifacts
  after every release, negative control included. It is executable documentation, never a
  substitute for the reader running the commands themselves.
- Scorecard's Signed-Releases will converge upward as a side effect of the window filling with
  compliant releases. No sentence anywhere presents that number as a verification.
- No SLSA level is claimed for runward anywhere, in any phrasing; what is written is descriptive
  and cited (the guard's `SLSA level asserted without an assessment` rule stays the ceiling).

## Ratification

Ratified 2026-08-11 by the maintainer, on the investigation of the same day: three axes (the check
at source level, the enterprise verification path, the provenance chain), each counter-expertised
with re-execution of every reported command; all three held.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05.

The decision is wrong and must be revisited if any holds: a consumer reports that the published proof (provenance + attested SBOM) does not answer the question they actually had to answer, and names which one; a release ships whose artifacts a third party could not re-verify from the published instructions alone; or the attestation formats used here are superseded by one the ecosystem's verifiers read instead.

**Watched via**: the release verification workflow (`verify-release.yml`) and any consumer report.
