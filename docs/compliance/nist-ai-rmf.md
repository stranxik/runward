# Lens: NIST AI RMF (US)

The natural US lens. The NIST AI Risk Management Framework (AI RMF 1.0, and the Generative AI Profile NIST-AI-600-1) is **voluntary** but widely adopted, and — because it is not a state law — it survives the US state-law churn and federal preemption moves of 2025–2026. Lead here for a US CISO or enterprise buyer; pair with SOC 2 / ISO 42001 for up-market deals. Do **not** lead with "EU AI Act art. 13" in the US — it reads as foreign.

**What the AI RMF asks for (relevant here):** the GOVERN / MEASURE / MANAGE functions call for documented, repeatable measurement and testing (TEVV), a traceable basis for risk trade-offs, and records of the controls applied across the lifecycle.

## How runward's output maps

| NIST AI RMF function | runward artifact |
|---|---|
| **GOVERN 1.x** — documented policies & accountability | The `AGENTS.md` charter, the ADR journal (decisions + triggers), one accountable operator at every gate. |
| **MEASURE 2.x** — documented, repeatable TEVV | The deterministic `check --strict` verdict (reproducible, zero-LLM) + the evaluation rubric; the conformance manifest as the record of what was measured. |
| **MANAGE** — risk treatment & traceability | Rules mapped to OWASP ASI01–ASI10; deviations recorded as ADRs with re-evaluation triggers; the threat model. |

## Honest boundary

runward produces **audit-ready supporting evidence** aligned to the AI RMF's documentation and traceability expectations. The AI RMF is voluntary guidance, not a certification; runward does not make you "NIST compliant" (no such status exists). Verify the current AI RMF / GenAI Profile text before citing it in a customer or legal document.
