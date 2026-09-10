# Security policy

## Supported versions

Two supported lines, never more ([ADR-0068](docs/adr/ADR-0068-one-maintained-minor-and-a-dated-release-train.md), ratified 2026-09-09): the latest published minor is the maintained one and receives everything; the previous minor receives security fixes — and only security fixes — for six months from the day the newer minor shipped.

| Line | Status | Until |
|---|---|---|
| 0.39.x | maintained (features + security) | the next minor ships |
| 0.38.x | security fixes only | 2027-03-10 (six months after 0.39.0, published 2026-09-10) |
| 0.37.x | security fixes only | 2027-03-07 — the dated promise of the 0.38.0 release stands; a stated, expiring exception to the two-line rule (both windows close three days apart) |
| ≤ 0.36.x | unsupported | — |

Security fixes are exempt from the feature release train: they ship when ready, to both supported lines. This table moves at every minor; the dates are the contract.

## Reporting a vulnerability

**Do not open a public issue.** Report privately, by email to the author — contact address published at https://thibaultsouris.fr — or through GitHub's private vulnerability reporting on this repository.

Include what you can: affected version, reproduction steps, impact. You will get an acknowledgment, and disclosure is coordinated: the report stays private until a fix is released.

## Supply chain and regulated adoption

runward is a local CLI with no data flow: it runs in your repository, emits no data, hosts nothing. Releases carry SLSA provenance (OIDC trusted publishing, no long-lived secrets) and an attested CycloneDX SBOM. For a security / procurement / TPRM review — what applies, what is moot because there is no data flow, the OSPS Baseline alignment, the licence framing and the honest limits — see [`docs/compliance/regulated-adoption.md`](docs/compliance/regulated-adoption.md).
