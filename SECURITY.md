# Security policy

## Supported versions

Only the latest published version receives security fixes. (A two-line policy — the latest minor plus six months of security fixes on the previous one — is proposed in [ADR-0068](docs/adr/ADR-0068-one-maintained-minor-and-a-dated-release-train.md); this line changes when it is ratified, not before.)

## Reporting a vulnerability

**Do not open a public issue.** Report privately, by email to the author — contact address published at https://thibaultsouris.fr — or through GitHub's private vulnerability reporting on this repository.

Include what you can: affected version, reproduction steps, impact. You will get an acknowledgment, and disclosure is coordinated: the report stays private until a fix is released.

## Supply chain and regulated adoption

runward is a local CLI with no data flow: it runs in your repository, emits no data, hosts nothing. Releases carry SLSA provenance (OIDC trusted publishing, no long-lived secrets) and an attested CycloneDX SBOM. For a security / procurement / TPRM review — what applies, what is moot because there is no data flow, the OSPS Baseline alignment, the licence framing and the honest limits — see [`docs/compliance/regulated-adoption.md`](docs/compliance/regulated-adoption.md).
