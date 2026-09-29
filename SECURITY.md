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

Security fixes are exempt from the feature release train: they ship when ready, to both supported lines. This table moves at every minor; the dates are the contract.

## Reporting a vulnerability

**Do not open a public issue.** Report through the repository's private vulnerability reporting form, the one channel for security reports:

https://github.com/stranxik/runward/security/advisories/new

It is the *Report a vulnerability* button on the repository's Security tab, and it needs a GitHub account. The report is not public: it is visible to you and to the repository's maintainers.

Include what you can: affected version, reproduction steps, impact.

- **Acknowledgement**: within 7 days of the report.
- **Coordinated disclosure**: the report stays private until a fix is released; the advisory is published with the fix.
- **No fix deadline is promised.** The project has one maintainer and has not set a time to fix; it depends on the defect.

## Supply chain and regulated adoption

runward is a local CLI with no data flow: it runs in your repository, emits no data, hosts nothing. Releases carry SLSA provenance (OIDC trusted publishing, no long-lived secrets) and an attested CycloneDX SBOM. For a security / procurement / TPRM review — what applies, what is moot because there is no data flow, the OSPS Baseline alignment, the licence framing and the honest limits — see [`docs/compliance/regulated-adoption.md`](docs/compliance/regulated-adoption.md).
