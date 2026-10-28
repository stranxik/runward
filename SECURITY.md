# Security policy

## Supported versions

Only the latest published minor line is supported. It receives everything, features and security fixes, and no fix is backported to an older line. Decided by the maintainer on 2026-10-28 (dated notes in [ADR-0068](docs/adr/ADR-0068-one-maintained-minor-and-a-dated-release-train.md) and [ADR-0086](docs/adr/ADR-0086-security-advisories-and-a-fix-time-target.md)).

| Line | Status | Until |
|---|---|---|
| 0.46.x | supported (features + security) | the next minor ships |
| ≤ 0.45.x | unsupported | — |

**What changed on 2026-10-28, and why.** From 2026-09-09 to 2026-10-28 this section promised two supported lines: the latest minor, and the previous one receiving security fixes for six months from the day the newer minor shipped, with dated windows for 0.37.x to 0.42.x running until March and April 2027. That promise was not kept. No line older than the latest one ever received a release: every fix with a published advisory released since then, fourteen from 0.39.0 to 0.44.1, shipped on the latest line only, and the advisories say so. Among them are RWD-2026-0165 (fixed in 0.43.1) and RWD-2026-0168 (fixed in 0.44.1), two S1 fixes found after 2026-10-01, when shipping a fix to every older supported line it applies to without rework had become the stated default. ADR-0068 had named that outcome in advance: if the backport is skipped once, the policy is theatre and it reopens toward latest-only. It is withdrawn rather than left standing, and the dated windows end on 2026-10-28. The table had also stayed at 0.43.x through 0.44.0, 0.45.0 and 0.46.0; a test now fails when it does not name the package's current minor as the one supported line.

Security fixes are exempt from the feature release train: they ship when ready, on the latest line. An advisory lists every affected version, older lines included, and names the first patched version on the latest line; on an older line, upgrade to the latest minor to receive the fix. This table moves at every minor.

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

Not advised, and recorded in the [defect register](docs/compliance/known-defects.md) only: undue refusals (the gate failing closed on honest work), a wrong message or wrong guidance that moved no exit code, output read by a machine whose exit code never moved, a mechanism that behaved correctly in every release but had no test, measurements, and declared limits with no fix. Each advisory names its register entry, its affected range, its patched version and the workaround the entry gives. A CVE is requested through GitHub for S1 and S2; for S3 and S4 the maintainer decides. A defect whose whole affected range lies at or below 0.36.x (the lines already unsupported when ADR-0086 set this rule) gets no advisory; the register is its record. The 2026-10-28 change to the supported lines has not moved that boundary.

## Supply chain and regulated adoption

runward is a local CLI with no data flow: it runs in your repository, emits no data, hosts nothing. Releases carry SLSA provenance (OIDC trusted publishing, no long-lived secrets) and an attested CycloneDX SBOM. For a security / procurement / TPRM review — what applies, what is moot because there is no data flow, the OSPS Baseline alignment, the licence framing and the honest limits — see [`docs/compliance/regulated-adoption.md`](docs/compliance/regulated-adoption.md).
