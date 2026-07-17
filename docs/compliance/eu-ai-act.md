# Lens: EU AI Act (EU high-risk providers)

The EU lens — use it for an EU high-risk provider, not as the global default (ADR-0015). High-risk obligations were postponed by the Digital Omnibus on AI (June 2026) and now bind from **2 December 2027** (Annex III systems): risk management, data governance, record-keeping (art. 12), transparency to deployers (art. 13), human oversight. (The 2 August 2026 milestone still applies to other obligations — Article 50 transparency, governance, GPAI enforcement — but is no longer the high-risk deadline.) Note the art. 111 "significant change" trigger: touching a pre-2026 high-risk system can require a fresh technical file — the retro-documentation case (`characterize`).

Do not conflate dates: prohibitions have applied since Feb 2025 and GPAI-model obligations since Aug 2025; high-risk from Aug 2026; embedded-product high-risk from 2027.

## How runward's output maps

| EU AI Act expectation | runward artifact |
|---|---|
| **Art. 13** transparency / instructions-for-use documentation | The conformance manifest + threat model + ADR journal: which controls, limitations and oversight measures were considered and traced. |
| Risk management & agentic-risk coverage | Rules mapped to OWASP ASI01–ASI10; the threat model (lethal trifecta, 2-of-3 rule). |
| Traceability of decisions | The ADR journal with dated re-evaluation triggers; retro-reconstructed via `characterize` for a pre-2026 system under art. 111. |
| **Art. 12** record-keeping (runtime logs) | The observability schema names the port; **the manifest does NOT satisfy art. 12** — that needs actual runtime event logs, which the deployed system produces, not runward. |

## Honest boundary

runward produces **audit-ready supporting evidence** that feeds the art. 11 / Annex IV technical documentation and the surrounding documentation duties. It does **not** satisfy art. 12 (runtime logging), it is **not** a conformity assessment, and it does not make a system "EU AI Act compliant" — that is the provider's determination with a notified body where required. Verify the current Act text and guidance before a legal or sales document.
