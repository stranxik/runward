# Security policy

## Supported versions

Two supported lines, never more ([ADR-0068](docs/adr/ADR-0068-one-maintained-minor-and-a-dated-release-train.md), ratified 2026-09-09): the latest published minor is the maintained one and receives everything; the previous minor receives security fixes — and only security fixes — for six months from the day the newer minor shipped.

| Line | Status | Until |
|---|---|---|
| 0.42.x | maintained (features + security) | the next minor ships |
| 0.41.x | security fixes only | 2027-03-24 (six months after 0.42.0, published 2026-09-24) |
| 0.40.x | security fixes only | 2027-03-19 — the dated promise of the 0.41.0 release stands |
| 0.39.x | security fixes only | 2027-03-12 — the dated promise of the 0.40.0 release stands |
| 0.38.x | security fixes only | 2027-03-10 — the dated promise of the 0.39.0 release stands |
| 0.37.x | security fixes only | 2027-03-07 — the dated promise of the 0.38.0 release stands |
| ≤ 0.36.x | unsupported | — |

Six lines is more than the two-line rule allows, and that is deliberate rather than drift: a
DATED promise is not something this project withdraws because a release cadence caught up with it.
The five older windows expire within seventeen days of each other in March 2027, after which the table
returns to two lines on its own. The count grows while the cadence is faster than six months and
shrinks by itself afterwards; what it may never do is lose a row before the date that row promised.

Security fixes are exempt from the feature release train: they ship when ready, on the maintained line and on every older supported line the fix applies to without rework ([ADR-0086](docs/adr/ADR-0086-security-advisories-and-a-fix-time-target.md)). When a fix does not apply to an older line without rework, it ships on the maintained line only, and the advisory says so: it lists the older line's versions as affected and names the maintained version as the first patched one. Until 2026-10-01 this sentence said fixes ship "to both supported lines", and it is narrowed here on purpose: no line older than the maintained one has had a release since its own minor shipped, so the fixes found before 2026-10-01 and since classed as security fixes shipped on the maintained line only, and their advisories say so. This table moves at every minor; the dates are the contract.

## Reporting a vulnerability

**Do not open a public issue.** Report through the repository's private vulnerability reporting form, the one channel for security reports:

https://github.com/stranxik/runward/security/advisories/new

It is the *Report a vulnerability* button on the repository's Security tab, and it needs a GitHub account. The report is not public: it is visible to you and to the repository's maintainers.

Include what you can: affected version, reproduction steps, impact.

- **Acknowledgement**: within 7 days of the report.
- **Coordinated disclosure**: the report stays private until a fix is released; the advisory is published with the fix.
- **Fix or decision**: we aim to ship a fix, or to publish a decision, within 30 days of the report. A decision is a documented workaround, a reasoned "not a vulnerability", or a dated plan. This is an aim of a single maintainer, not a contractual deadline. If it is missed, the reporter is told before day 30, in the advisory, with the reason and a new date.
- **The same aim for what the project finds itself**: a defect the maintainer finds that meets one of the four criteria below is held to the same 30 days, counted from the date it was measured.
- **A missed aim is recorded**: one line in the advisory (or in the register entry) saying it was missed and by how many days. Two missed aims in a row reopen the decision that set the aim.

## What we treat as a vulnerability

A defect in a version published on npm gets a published security advisory when it does one of four things ([ADR-0086](docs/adr/ADR-0086-security-advisories-and-a-fix-time-target.md)):

- **S1, a verdict turned green.** Content your repository can hold (mission files, the lock, the rule copies, committed reports, the hook configuration) makes `check` exit 0 where it should exit 1, or makes `verify` answer verified on an attestation that does not describe the tree.
- **S2, an effect on files you did not ask for.** The CLI writes, removes or reads a file the command did not ask for: outside the project root, under `--dry-run`, under a help text that says read-only, or on a path other than the one named.
- **S3, a human act recorded that the human did not make.** The CLI records a ratification or a decision under your name that you did not give.
- **S4, no verdict.** Content your repository can hold makes the gate run without bound, so no verdict is rendered.

Not advised, and recorded in the [defect register](docs/compliance/known-defects.md) only: undue refusals (the gate failing closed on honest work), a wrong message or wrong guidance that moved no exit code, output read by a machine whose exit code never moved, a mechanism that behaved correctly in every release but had no test, measurements, and declared limits with no fix. Each advisory names its register entry, its affected range, its patched version and the workaround the entry gives. A CVE is requested through GitHub for S1 and S2; for S3 and S4 the maintainer decides. A defect whose whole affected range lies in unsupported lines gets no advisory; the register is its record.

## Supply chain and regulated adoption

runward is a local CLI with no data flow: it runs in your repository, emits no data, hosts nothing. Releases carry SLSA provenance (OIDC trusted publishing, no long-lived secrets) and an attested CycloneDX SBOM. For a security / procurement / TPRM review — what applies, what is moot because there is no data flow, the OSPS Baseline alignment, the licence framing and the honest limits — see [`docs/compliance/regulated-adoption.md`](docs/compliance/regulated-adoption.md).
