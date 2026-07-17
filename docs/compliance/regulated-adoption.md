# Adopting runward in a regulated environment

runward is a **local, open-source CLI**. It runs inside your repository, emits no data, hosts nothing, and makes no network call. So most vendor due-diligence — which is built to assess a third party that *holds your data* — does not apply. What remains is **artifact integrity** and **project health**, where runward is strong. Hand this page to your TPRM / security / procurement team.

> **Posture in one line.** runward produces deterministic, replayable *engineering evidence* that **feeds** your compliance programme (ISO/IEC 42001, NIST AI RMF, the EU AI Act art. 13 technical file). It is not a compliance validator, and it never claims to be. See [ADR-0031](../adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md).

## 1. What does NOT apply (because runward is local, not a SaaS)

| Control usually demanded of a vendor | Why it is moot here |
|---|---|
| SOC 2 / ISO 27001 of a hosting provider | No host. runward runs in your repo, on your infrastructure. |
| DPA / GDPR art. 28 (processor agreement) | runward processes no personal data and has no data flow. |
| Data residency / sovereign hosting | Nothing is hosted or transmitted. Your repo, your region. |
| Penetration test of the service | No service is exposed — there is no runtime, no endpoint. |
| Sub-processors list | None. |
| Encryption in transit / at rest (vendor side) | No vendor side. Your existing repo controls apply. |
| Vendor business-continuity / exit plan | MIT-licensed and forkable; no hosted dependency to lose. |

The reason is structural: these controls evaluate a third party in the **data flow**. runward is not in the data flow. That is safer than a SaaS by construction, and it should be stated as such rather than left blank on a questionnaire built for SaaS.

## 2. What DOES apply — and how runward answers it

**Supply-chain integrity** (the real object of review for a local OSS tool):

| Requirement | runward |
|---|---|
| Provenance | npm **OIDC Trusted Publishing** + **SLSA provenance** attestation. Verify: `npm audit signatures`. |
| SBOM | **CycloneDX SBOM**, attested (SLSA build-provenance) and attached to each GitHub Release. |
| Dependency pinning | Committed lockfile; every CI action pinned by commit SHA. |
| Reproducibility | Deterministic build; anyone can re-verify the published artifact. |
| Vulnerability management | Dependencies kept current; disclosure handled per `SECURITY.md`. |
| CI hardening | Core tests run **network-isolated** (`unshare -n`) — a structural zero-network guarantee, not a claim. |
| Continuous posture | **OpenSSF Scorecard** workflow (`.github/workflows/scorecard.yml`). |

**Project health / governance:**

| Requirement | runward |
|---|---|
| Coordinated disclosure | `SECURITY.md` (private channel, response window). |
| Ownership & cadence | `CODEOWNERS`, SemVer, `CHANGELOG.md`, `GOVERNANCE.md`. |
| Bus factor | Single maintainer, mitigated by **MIT (right to fork)** + reproducible build. For OSS, forkability is the recognised continuity answer — stronger than a single-vendor SaaS. |

## 3. OpenSSF OSPS Baseline alignment

runward already meets the load-bearing OSPS Baseline controls a regulated buyer looks for:

- **Build & release:** signed provenance (SLSA), SBOM, SHA-pinned actions, published integrity metadata.
- **Vulnerability management & disclosure:** `SECURITY.md` with a private reporting channel and coordinated disclosure.
- **Access & governance:** `CODEOWNERS`, branch protection, review-by-default, no committed secrets (verified by CI guard).
- **Quality:** deterministic, network-isolated test suite; golden tests for the emitted OSCAL.

## 4. Licence framing

- **Tooling — MIT.** Freely reusable, no copyleft, no viral obligation. The favourable case in a regulated review.
- **Doctrine / method — CC BY-ND 4.0.** You may **use and apply** it internally: since CC 4.0, a *private* adaptation that is not shared is permitted. What the ND clause forbids is **redistributing a modified version** of the canon. Internal use therefore creates no distributed derivative and raises no obligation; only re-publishing an altered doctrine would.

## 5. What runward is NOT — the honest limits

- **Not a compliance validator.** It produces *audit-ready supporting evidence*; it does not confer compliance, certification, or a conformity assessment. Acceptance is the auditor's call.
- **Not a runtime.** No runtime logs. EU AI Act art. 12 record-keeping, Annex IV post-market and conformity-declaration items stay the **operator's** to supply. runward feeds the *design-time* technical file (art. 13).
- **Point-in-time.** Evidence is derived from repository content; rerun it in CI. `runward check --freeze` seals it (SHA-256); later drift reddens the gate until re-verified.
- **No SLA, no warranty.** MIT "AS IS", best-effort, single maintainer. Forkability is the continuity guarantee.

## 6. The OSCAL evidence pack

`runward compliance <regime>` emits an **OSCAL 1.1.2 component-definition** with SHA-256-deterministic UUIDs, byte-identical across runs, schema-validated and golden-tested in CI. It is designed to be ingested by a GRC tool (RegScale, Paramify, Xacta). **End-to-end ingestion into your specific GRC tool is your verification step**, not a runward guarantee — see [oscal-ingest.md](oscal-ingest.md). runward maps a *traced engineering decision* to an OSCAL requirement; a rule mapped but not justified yields `partial`, never `implemented`.
