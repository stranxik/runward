# ADR-0079 — A release keeps a signed summary of its mutation ratchet

**Date**: 2026-09-26
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured on the 0.42.1 and 0.42.2 release ratchets, the repository's own citations, and the workflow permissions

## Context

Every release runs the mutation ratchet over the whole perimeter ([ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md)):
it re-measures every module and refuses if `docs/compliance/mutation-register.md` no longer describes
the code. The register is the durable product of that work, committed and reviewed, with an argument
for every survivor. What the ratchet adds is one fact: **on this release, the register was confirmed
by a fresh measurement.** That fact is not kept anywhere that lasts.

**Measured, 2026-09-26.**

- The 0.42.1 ratchet produced 141 artifacts, 500.7 MB, of which 21 merged reports weigh 249.2 MB.
  The merged reports are kept 30 days (`retention-days: 30`), the per-chunk ones 7, the run logs 90
  (the repository's setting). After that, nothing shows that 0.42.1 passed its ratchet.
- The repository already cites that kind of evidence by link: ADR-0059 points at 7 ratchet runs
  (`actions/runs/32951829865` … `32991880465`, lines 197 to 224) as the proof of its ratification
  criteria. Those runs date from late August; their logs expire within weeks. A decision whose cited
  evidence disappears is the defect runward refuses in the missions it gates.
- The run is not reproducible after the fact: a re-measurement months later runs a different test
  suite on a different runner, and timeouts move. The record has to be taken when the run happens.
- The ratchet runs for hours on mutated code, with `contents: read`. The release and its assets are
  produced elsewhere, by the isolated builder ([ADR-0049](ADR-0049-the-build-is-isolated-from-the-publish.md)).

## Decision

**Proposed.** When the release ratchet completes, a final job writes a **ratchet summary** and signs it
as a GitHub artifact attestation, the mechanism `build-and-attest.yml` already uses for the build
provenance.

- **The summary is small and complete.** A JSON of a few kilobytes: the version and the commit; for
  each module, the measured survivor count, the filed count and the ratchet's answer; the SHA-256 of
  each merged report; the run identifier and its date; the overall verdict, including a refusal. A red
  ratchet is summarised exactly like a green one.
- **Signed, not stored in the release.** The attestation is created with `id-token: write` and
  `attestations: write` by a job that only downloads the merged reports and hashes them. No job of the
  ratchet gains write access to the repository or the release: a workflow that runs mutated code for
  hours must not be able to change what was published.
- **Verifiable by anyone, later.** `gh attestation verify ratchet-summary-X.Y.Z.json --repo
  stranxik/runward --signer-workflow stranxik/runward/.github/workflows/mutation-ratchet.yml`, added to
  `docs/verifying-a-release.md` beside the provenance check. The summary file itself is uploaded as a
  workflow artifact and, once verified, may be attached to the release by the maintainer's hand.
- **The documents stop citing runs.** A decision that needs a ratchet as evidence cites the attested
  summary of the release that carried it. The 7 links in ADR-0059 are replaced by the facts they
  proved, written out, since their summaries cannot be produced retroactively.
- **The full reports are not kept.** 249 MB per release, read by nobody, would grow by gigabytes in a
  few months. The hashes in the summary are enough to recognise a report someone kept.

## Alternatives discarded

- **Attach the full merged reports to every release.** Measured size: 249 MB per release. Rejected on
  weight and on use.
- **Let the ratchet write the summary into the release.** Needs `contents: write` on a job that runs
  mutated code for hours. Rejected for the reason ADR-0049 isolates the build.
- **Commit a ledger line per release in the repository.** Durable, but self-declared: a line anyone
  with write access can type. Kept only as a human-readable index if the attestation is adopted, never
  as the proof.
- **Do nothing but raise retention to 90 days.** Cheaper, and it delays the loss rather than preventing
  it. It remains the fallback if this ADR is rejected, together with rewriting the 7 links in ADR-0059.

## Consequences

- **Positive.** Every release proves its ratchet the way it already proves its build: a signed, durable
  statement anyone can check, without trusting the maintainer or the retention of a CI log.
- **Negative, accepted.** One more job in the ratchet workflow and one more command in the
  verification guide. The attestation proves what the workflow measured, not that the register's
  qualifications are right: that judgement stays in the reviewed register.
- **On other boundaries.** The gate, the CLI and the npm package are untouched. This concerns how
  runward's own releases are evidenced.

## What would settle it

- **Ratify** if the summary job runs on two consecutive releases, its attestation verifies with the
  command above on a clean machine, and nothing in the ratchet gains write access to the repository.
- **Reject** if GitHub artifact attestations prove not to be durable for this repository (an
  attestation of the 0.42.x releases no longer retrievable), or if the maintainer judges the evidence
  not worth one more job. The fallback above then applies.

## Reevaluation trigger (mandatory, dated)

Reopen when GitHub changes the retention or the availability of artifact attestations, or when a
third party (a pilot, an assessor) asks for the mutation evidence of a specific release: that request
is the demand this decision anticipates.

**Trigger set on**: 2026-09-26 · **Watched via**: `docs/verifying-a-release.md` and the pilot
protocol's questionnaire

## References

- [ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md) — the ratchet whose verdict this keeps.
- [ADR-0049](ADR-0049-the-build-is-isolated-from-the-publish.md) — why no long-running job gets write access.
- `.github/workflows/build-and-attest.yml` — the attestation mechanism reused.
