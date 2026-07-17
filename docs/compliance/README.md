# Compliance mapping references

runward's gate is **regulation-agnostic** (ADR-0015). What it produces is universal:

- an **OWASP ASI01–ASI10** security mapping on the craft rules, and
- a **deterministic conformance manifest** — audit-ready *supporting* evidence that named engineering rules were accounted for, with traced decisions.

That artifact is the same in every market. What changes is the **regime you cite** when you hand it to an auditor, a customer, or a regulator. These references are **framing lenses**, not features and not claims — they show how the same manifest maps to each regime's documentation expectations.

## Pick a lens

| Lens | When | File |
|---|---|---|
| **Security-only** (default) | No regulatory claim — an OWASP ASI security posture. The honest, region-neutral baseline. | — (no file needed; the manifest stands alone) |
| **ISO/IEC 42001** | A global buyer, or when you want the region-agnostic anchor. Certifiable, offends no market. | [iso-42001.md](iso-42001.md) |
| **NIST AI RMF** | A US buyer / CISO. Voluntary but widely adopted; survives US state-law churn. | [nist-ai-rmf.md](nist-ai-rmf.md) |
| **EU AI Act** | An EU high-risk provider (art. 12/13, from 2 Aug 2026). | [eu-ai-act.md](eu-ai-act.md) |

Sector lenses (SR 11-7 for finance, Singapore AI Verify) can be added on demand.

## Adopting runward in a regulated environment

For a security / procurement / TPRM review — what applies (and what is moot because runward is local and has no data flow), the supply-chain evidence (provenance, SBOM), the OSPS Baseline alignment, the licence framing, and the honest limits — see **[regulated-adoption.md](regulated-adoption.md)** ([ADR-0031](../adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)).

## Non-negotiable guardrails (see also `docs/positioning.md`)

- Say **"audit-ready supporting evidence"**, never "compliant", "certified", "ISO 42001 certified", or "EU AI Act compliant". A framework confers neither compliance nor certification.
- The manifest **feeds / supports** a regime's technical file or management system; it does not satisfy runtime-logging duties (e.g. EU AI Act art. 12) and is **not** a conformity assessment.
- Regulations move fast. **Verify the current text** of any cited regime before a legal or sales document — these references are dated engineering framing, not legal advice.
- Lead with the **universal** (security posture + audit-ready evidence). Never region-lock the pitch for a global audience.


The machine-readable side of the pack — the decision → ADR → manifest → OSCAL chain, its status-derivation rules, deterministic UUIDs and the evidence seal — is specified in [`docs/spec/runward-oscal-mapping.md`](../spec/runward-oscal-mapping.md) (versioned, citable via the repository's `CITATION.cff`).
