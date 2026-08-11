# ADR-0049: the build is isolated from the publish

**Date**: 2026-08-11
**Status**: accepted (ratified 2026-08-11 — canary results appended under Ratification)

## Context

[ADR-0048](ADR-0048-the-release-carries-verifiable-proof.md) deferred one path with named
preconditions: moving the build into a reusable workflow, which GitHub's documentation describes in
one sentence, quoted verbatim because it is the ceiling of what may be said: "Reusable workflows can
provide isolation between the build process and the calling workflow, to meet SLSA v1.0 Build
Level 3." (docs.github.com/en/actions/concepts/security/artifact-attestations, read 2026-08-11.)

The preconditions are now met, in order:

1. **The guard question is settled.** The quoted sentence used to pass the no-overclaim guard only
   because "v1.0" carries a dot and the SLSA rule's gap class is `[^.\n]` — an accident of a regex.
   `test/unit/no-overclaim.test.js` now carries a `FROZEN_CITATIONS` list: the exact sentence is
   writable, and every paraphrase, cut or translation faces the rule with no accident to hide
   behind. Guarded in both directions.
2. **The canary mechanism exists and has been seen working.** v0.33.4 proved the provenance chain
   end to end, and `verify-release.yml` requires on every release-triggered run what the previous
   canary established.

What the isolation buys, concretely: today the provenance is attested in the same job that runs
`npm ci`, `npm test` and `npm publish` — the file the release event executes, the one an attacker
editing the caller would touch. After this change the tarball's provenance is signed inside
`build-and-attest.yml`, whose steps the calling workflow cannot reach into, and the signing
certificate names that file — which a reader pins with
`gh attestation verify --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml`.

## Decision

**1. A reusable builder signs the provenance.** `.github/workflows/build-and-attest.yml`
(`on: workflow_call`) checks out the calling run's commit, runs the full net (`npm test`), packs,
attests build provenance with `actions/attest-build-provenance` (SHA-pinned), and hands the tarball
plus the bundle to the caller as a workflow artifact. `id-token: write` for that signature exists
only in the builder's job.

**2. `npm publish` stays in `release.yml`.** npm trusted publishing validates the *calling*
workflow when a reusable workflow is involved (docs.npmjs.com/trusted-publishers), and npmjs.com is
configured to trust `release.yml`. Moving the publish would break the one property of this chain
every audit of it praised — OIDC with no long-lived secret. The npm-side provenance therefore keeps
the caller as its signer; the GitHub-side provenance carries the builder. The two claims are
different and both true, and `docs/verifying-a-release.md` says which command verifies which.

**3. The caller refuses to publish what it cannot reproduce.** Before `npm publish`, the publish
job packs the same commit itself and byte-compares against the builder's tarball; a mismatch reds
the release with nothing published. This is the reproducibility re-proof ADR-0048's preconditions
demanded, executed at every release rather than promised once — and it keeps the artifact hand-off
from becoming a single point of silent divergence.

**4. `verify-release.yml` demands the builder identity.** On every release-triggered run,
`--signer-workflow` is required alongside the provenance predicate. A regression — the builder
deleted, the attest step moved back into the caller — reds the verify run in public.

**5. The posture guard pins the shape.** `test/unit/regulated-posture.test.js` asserts: the builder
exists, is reusable and attests with a SHA-pinned action; the caller calls it and does **not**
attest provenance itself; the determinism cross-check gates the publish; verify-release demands the
signer. The pin rule learned the one legitimate exception, stated rather than suffered: a local
`./.github/workflows/…` reference cannot be pinned and needs no pin — it always runs at the calling
run's own commit, which is stronger than a SHA.

## What this does not claim

No SLSA level is asserted for runward, in any phrasing — the frozen citation above is GitHub's
sentence about the mechanism, not a claim about this project, and no assessment by anyone exists.
The isolation does not protect against a compromised maintainer (who could edit the builder too,
one commit in the open), does not make the code at the attested commit sound, and does not change
what the SBOM attestation proves. It narrows one thing: the set of files whose edition can influence
what the provenance says, from "the executing workflow" to "the builder file the certificate names".

## Ratification

Ratified 2026-08-11. Canary: v0.33.5, first release built by the isolated builder. Results, measured
after the tag and recorded in `docs/verifying-a-release.md`: the `--signer-workflow` verification,
the determinism cross-check outcome, and the byte-for-byte reconciliation of the published tarball
against a local rebuild of the attested commit.
