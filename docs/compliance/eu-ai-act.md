# Lens: EU AI Act (EU high-risk providers)

The EU lens — use it for an EU high-risk provider, not as the global default (ADR-0015). High-risk obligations were postponed by Regulation (EU) 2026/1744 of 8 July 2026 (OJ L, 2026/1744, 24.7.2026) and now bind from **2 December 2027** (Annex III) and **2 August 2028** (Annex I) (Annex III systems): risk management, data governance, record-keeping (art. 12), transparency to deployers (art. 13), human oversight. (The 2 August 2026 milestone still applies to other obligations — Article 50 transparency, governance, GPAI enforcement — but is no longer the high-risk deadline.) Note the art. 111 "significant change" trigger: touching a pre-2026 high-risk system can require a fresh technical file — the retro-documentation case (`characterize`).

Do not conflate dates: prohibitions have applied since Feb 2025 and GPAI-model obligations since Aug 2025; high-risk from **2 December 2027** (Annex III) and **2 August 2028** (Annex I). This line read "high-risk from Aug 2026" until 2026-08-06, contradicting the paragraph above it two lines earlier: the date moved with Regulation (EU) 2026/1744 and only one of the two sentences was updated. The binding dates here are the ones carried by `regimes/eu-ai-act@2026-1744.json` and, unchanged, by its revision `regimes/eu-ai-act@2026-1744-r2.json` (the default lens, below), which the dated-facts watch tracks against the consolidated text at EUR-Lex.

## How runward's output maps

| EU AI Act expectation | runward artifact |
|---|---|
| **Art. 13** transparency / instructions-for-use documentation | The conformance manifest + threat model + ADR journal: which controls, limitations and oversight measures were considered and traced. |
| Risk management & agentic-risk coverage | Rules mapped to OWASP ASI01–ASI10; the threat model (lethal trifecta, 2-of-3 rule). |
| Traceability of decisions | The ADR journal with dated re-evaluation triggers; retro-reconstructed via `characterize` for a pre-2026 system under art. 111. |
| **Art. 12** record-keeping (runtime logs) | The observability schema names the port; **the manifest does NOT satisfy art. 12** — that needs actual runtime event logs, which the deployed system produces, not runward. |

## The lens version, and what the pack asks of you beyond Annex IV

The default lens is **`eu-ai-act@2026-1744-r2`** (ADR-0101, accepted 2026-10-23). It reads the same legal text as `eu-ai-act@2026-1744` (Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744): the `-r2` suffix marks a revision of the lens, not a new amendment, and it sorts after `2026-1744`, so it is the highest shipped version and the default. The previous lens was cut for the Annex IV file of a high-risk provider and said nothing of whether the system is high-risk at all, nor of Articles 4, 5, 14 and 50; a reader could take that silence for an absence of obligation. The revision changes two things in the draft, and nothing in the Annex IV map:

- **Four operator-required rows, in front of the existing ones.** runward supplies nothing for any of them; the pack names them so that their absence shows.
  1. **System qualification**, first, because it decides which of the other rows bind: is the system high-risk under Annex III (art. 6(2)) or Annex I (art. 6(1))? Is it an art. 50 case (an AI system interacting with natural persons, generating synthetic content, used for emotion recognition or biometric categorisation, or generating deep fakes)? Does it involve a prohibited practice of art. 5 (the new ones, art. 5(1)(ba),(bb) and 5(1a),(1b), apply from 2 December 2026)? A blank answer is not a "no".
  2. **Art. 4 AI literacy**: the measures you take, and their record.
  3. **Art. 14 human oversight**: your oversight measures, binding only for a high-risk system, from the high-risk dates above. The oversight tooling listed under Annex IV Point 3 is an input to them, not the measures.
  4. **Art. 50 transparency**: the measures for each art. 50 case your qualification identifies. Art. 50 applies from 2 August 2026, with art. 111(4) giving pre-2 August 2026 synthetic-content systems until 2 December 2026. runward does not observe what a running system discloses to the persons it reaches, so no row maps Article 50 to runward evidence.
- **The lens's dated notes print under the draft's header**, in a "Dated notes of this lens" block, so the dates the file records (Chapter III, governance, Art. 50, the new Art. 5 practices, the simplified Art. 11(1) form) reach the reader. The block is switched on by the lens file (`printNotes`) and printed by the EU AI Act renderer only; the ISO/IEC 42001 and NIST AI RMF drafts are unchanged.

To reproduce a pack assembled before this revision, pin the older lens: `runward compliance eu-ai-act --regime-version 2026-1744` renders the previous draft byte for byte (a golden test holds it on a fresh and on the reference mission). The selected lens is stamped in the draft and in the OSCAL `runward-regime-lens` prop.

## Honest boundary

runward produces **audit-ready supporting evidence** that feeds the art. 11 / Annex IV technical documentation and the surrounding documentation duties. It does **not** satisfy art. 12 (runtime logging), it is **not** a conformity assessment, and it does not make a system "EU AI Act compliant" — that is the provider's determination with a notified body where required. Verify the current Act text and guidance before a legal or sales document.
