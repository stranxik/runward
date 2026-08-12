# Verifying a runward release

**Written**: 2026-08-11 · **Verified against**: v0.33.3 and the v0.33.4 / v0.33.5 canaries · every command below was executed on the
public artifacts that day, negative controls included.

> **Why this page exists.** Scoring systems that rate releases read asset *names*: OpenSSF
> Scorecard's Signed-Releases check tests filename suffixes over the last five releases and never
> downloads an asset, by its own documentation ("The check does not verify the signatures";
> established at source level in [ADR-0048](adr/ADR-0048-the-release-carries-verifiable-proof.md)).
> A zero-byte file with the right name scores the same as a real bundle. So no score on this project
> is offered as proof of anything. What is offered is this page: commands you replay yourself, with
> the expected outputs, what each one proves, and what none of them proves.

Each release carries, as assets: the published tarball `runward-X.Y.Z.tgz`, the SBOM attestation
bundle `runward-X.Y.Z.intoto.jsonl`, the SBOM itself, and — from the first release after 2026-08-11
— the build provenance bundle `runward-X.Y.Z.provenance.intoto.jsonl`. Releases v0.32.0 through
v0.33.2 had their tarball and SBOM bundle attached retroactively on 2026-08-11, hash-verified
against their attestation subjects; the Sigstore timestamps inside the bundles independently date
the attestations to the original release day.

Substitute the version you are verifying for `0.33.3` throughout.

## Step 0 — the two stores hold the same bytes (no tooling)

```sh
curl -sLO https://github.com/stranxik/runward/releases/download/v0.33.3/runward-0.33.3.tgz
curl -sLo runward-npm.tgz https://registry.npmjs.org/runward/-/runward-0.33.3.tgz
shasum -a 256 runward-0.33.3.tgz runward-npm.tgz
```

Both lines must print the same digest (for 0.33.3:
`a0a8e9ab2dcf7d1631c26e8717a1ab93246e8d4e5a86e71bfacbbb8fd5be8e07`).
**Proves**: the GitHub release and the npm package are the same bytes.
**Does not prove**: where they came from.

## Step 1 — the one-command reflex (online, coarse)

```sh
npm audit signatures
```

Expected wording, verbatim: `28 packages have verified registry signatures` /
`4 packages have verified attestations`. Two caveats to read before quoting it: the counts cover
your **entire dependency tree**, not runward alone; and "registry signatures" rest on the npm
registry's own keys, a trust root distinct from Sigstore.

## Step 2 — verify the attestation, identity included (online)

```sh
gh attestation verify runward-0.33.3.tgz --repo stranxik/runward \
  --predicate-type https://cyclonedx.org/bom
```

The `--predicate-type` flag is **required** for the SBOM attestation: without it, gh filters on the
build-provenance predicate by default, and for releases up to v0.33.3 the store holds nothing under
it (HTTP 404 — that finding is what led to the provenance bundle being added). From v0.33.4 the
provenance is in the store and attached, so both of the following pass — proven on the v0.33.4
canary, 2026-08-11, exit 0 each:

```sh
gh attestation verify runward-0.33.4.tgz --repo stranxik/runward   # no flag: gh's default predicate
gh attestation verify runward-0.33.4.tgz --repo stranxik/runward \
  --predicate-type https://slsa.dev/provenance/v1
```

**Proves**: a valid Sigstore signature; the signing identity is
`.github/workflows/release.yml@refs/tags/v0.33.3` in `stranxik/runward`; a GitHub-hosted runner,
triggered by the release event; a timestamped Rekor log entry; and that your local file's digest is
the attested subject.
**Does not prove**: see the last section — strictly, the workflow *attested* these bytes.

## Step 2c — pin the builder identity (releases from v0.33.5)

```sh
gh attestation verify runward-0.33.5.tgz --repo stranxik/runward \
  --predicate-type https://slsa.dev/provenance/v1 \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml
```

Proven on the v0.33.5 canary, 2026-08-12, exit 0; the certificate's SAN names
`build-and-attest.yml@refs/tags/v0.33.5`. This is the strongest demand a reader can make here: not
only "a workflow of this repository attested these bytes" but "**this builder file** did" — the
provenance is signed inside a reusable workflow the publishing workflow cannot reach into
([ADR-0049](adr/ADR-0049-the-build-is-isolated-from-the-publish.md)). What that mechanism is
documented to provide is quoted, frozen verbatim, in that ADR; no level is claimed for runward.
**Does not prove**: anything more about the code — see the last section, which applies unchanged.

## Step 3 — the same thing offline (isolated environments)

```sh
gh attestation trusted-root > trusted-root.jsonl   # once, while online
gh attestation verify runward-0.33.3.tgz --repo stranxik/runward \
  --bundle runward-0.33.3.intoto.jsonl --custom-trusted-root trusted-root.jsonl \
  --predicate-type https://cyclonedx.org/bom
```

Verified exit 0 with all traffic blocked. Three files suffice: the tarball, the bundle attached to
the release, and a pre-fetched trusted root.

## Step 4 — a second verifier, identity pinned by you

```sh
cosign verify-blob-attestation --bundle runward-0.33.3.intoto.jsonl --new-bundle-format \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity https://github.com/stranxik/runward/.github/workflows/release.yml@refs/tags/v0.33.3 \
  --type https://cyclonedx.org/bom runward-0.33.3.tgz
```

Expected: `Verified OK`. Run the negative controls once — they are the exact counter-example to
trusting a filename: a tarball altered by one byte fails (exit 1); an empty `{}` bundle fails; a
wrong `--certificate-identity` fails and prints the real one. Offline: add `--trusted-root` with a
local file.

## Step 5 — the npm-side provenance

```sh
curl -s https://registry.npmjs.org/-/npm/v1/attestations/runward@0.33.3
```

Returns two attestations, one under the provenance predicate. The npm registry documents
`npm audit signatures` as its verification path. `slsa-verifier verify-npm-package` also works
today, with two reserves stated as measured: it requires `SLSA_VERIFIER_EXPERIMENTAL=1` (the exact
failure without it is `FAILED: SLSA verification failed: feature support is only provided in
SLSA_VERIFIER_EXPERIMENTAL mode`, v2.7.1), and the project announces itself as no longer maintained.
The npm bundle is **not** consumable by `gh attestation verify` (measured: exit 1). A third party's
reading of this provenance is public: deps.dev relays `verified: true` for every npm version since
0.15.0 (24 of 41 versions; per Scorecard's own probe documentation, that verification is delegated
to the npm registry — read it as a relay, not as an independent audit).

## What none of this proves

Every check above can pass and the software still be wrong. A signature establishes that the named
workflow **attested these bytes** — a compromised maintainer account would produce perfectly
verifiable provenance. None of it proves the code at the attested commit is sound, that the SBOM is
accurate or complete, or that the package does what it says. `gh`, `cosign` and `slsa-verifier`
share one trust root (GitHub OIDC plus the public Sigstore infrastructure); only npm's registry
signatures rest on a different one.

The only verification in this list that is independent of that chain is rebuilding: check out the
attested commit, `npm ci && npm run build && npm pack`, and compare digests — byte-for-byte identity
has been established for three releases, cross-OS included
(`docs/compliance/regulated-adoption.md`, Reproducibility row). What remains after all of it is
reading the code, which no command replaces.
