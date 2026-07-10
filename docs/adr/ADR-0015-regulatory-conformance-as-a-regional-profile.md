# ADR-0015: Regulatory conformance as a regional profile; the OWASP ASI mapping is universal

**Date**: 2026-07-10
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a 2026 veille on the non-EU AI-governance landscape (NIST AI RMF, US state laws, UK, Singapore, ISO/IEC 42001, SR 11-7, SOC 2), filtered through the never-a-runtime and zero-LLM-gate invariants and the anti-overclaim guardrails. Durable position.

## Context

runward's conformance manifest carries an OWASP ASI (Top 10 for Agentic Applications) mapping and is framed as "audit-ready supporting evidence" (ADR-0009). That framing currently leads **EU-first** — it names the EU AI Act (art. 12/13) and ISO/IEC 42001. The veille surfaced two facts that make EU-first the wrong default for a global product:

- **The OWASP ASI mapping is universal and region-agnostic** — an OWASP security-engineering taxonomy tied to no jurisdiction. It is the stable, portable asset.
- **The named regulation is regional and volatile.** Outside the EU: the US is actively deregulating (a Dec-2025 federal executive action pushing state-law preemption; Colorado repealed and gutted its EU-style AI act); Canada's AIDA died; the UK and Japan are principles-only; ISO/IEC 42001, NIST AI RMF, SR 11-7 and SOC 2 value the *same* build-time evidence under different labels. Leading with "EU AI Act art. 13" to a US or APAC buyer reads as foreign and, post-2025, politically off-key.

Build-time evidence travels almost everywhere that expects any governance — what changes is the **citation label**, not the artifact. That is precisely the argument for decoupling.

## Decision

**Decouple the universal security core from the regional regulatory framing, and make the regulation a swappable lens — never gate logic.**

- **Universal, never toggled:** the OWASP ASI01–ASI10 mapping and the deterministic conformance manifest itself. The gate stays universal, deterministic and zero-LLM (ADR-0001) — it verifies traced decisions and rule conformance; it knows nothing about any regulation. No regulation-specific branch ever enters the decision path.
- **The honest default is "security-only."** The default posture makes **no regulatory claim** — it is an OWASP ASI security posture and audit-ready supporting evidence, full stop. Given the volatility above, this is both the most honest and the safest default.
- **Regulatory framing ships as regional mapping references**, not a code feature: `docs/compliance/{eu-ai-act,nist-ai-rmf,iso-42001}.md` show how the same manifest and ASI coverage map to each regime's documentation expectations. **ISO/IEC 42001** is the region-agnostic anchor (certifiable, offends no market); **NIST AI RMF** is the US lens; **EU AI Act** is the EU lens. SR 11-7 (finance) and Singapore AI Verify can follow on demand.
- **Copy leads with the universal.** Marketing and docs lead with the security posture (OWASP ASI) + audit-ready evidence, then "maps to your regime." No EU-first for a global audience. The anti-overclaim guardrails hold and gain a clause: never region-lock, and never say "compliant/certified" for any regime.

## Alternatives discarded

- **Bake the EU AI Act into the product / gate.** Forfeits the largest (US) market, ages badly as regulations churn, and would put regulation-specific logic into the deterministic gate — breaking its universality and the zero-LLM invariant. Rejected.
- **A `check --compliance=<regime>` code toggle.** Overkill and misleading: the gate produces no compliance report and the manifest is the same artifact regardless of regime. The "profile" is a framing/documentation layer, not a code branch. (Reopen only if a real report-generation feature is genuinely demanded — kept out of the gate.)
- **Drop the compliance angle entirely.** Forfeits a differentiator no competitor occupies and real enterprise pull (ISO 42001, NIST, SR 11-7 buyers). Rejected.

## Consequences

- **Positive.** Addressable globally — a US CISO sees NIST AI RMF, a global buyer sees ISO/IEC 42001, an EU buyer sees the AI Act — without re-architecting anything: only the citations and the report cover change. The universal ASI value is stable while regulations move. The security-only default is the honest, region-neutral baseline.
- **Negative, accepted.** More framing surface to maintain: the per-regime mapping references must be kept accurate as regimes move (they carry a dated "verify current text before a legal/sales doc" caveat). None of it is load-bearing on the gate.
- **On other boundaries.** New `docs/compliance/*` references; the audit-ready copy is reframed across README, site and `docs/positioning.md`; the gate, the manifest, and the OWASP ASI mapping are unchanged.

## Reevaluation trigger (mandatory, dated)

Reopen if a jurisdiction runward targets makes documentation duties binding in a way that demands actual report *generation* (not just framing) — then design a report hook that still stays out of the deterministic gate and out of any model call. Also revisit the mapping references whenever a cited regime changes materially (the veille flagged Colorado, the US preemption EO, and revised SR 11-7 as fast-moving).

**Trigger set on**: 2026-07-10 · **Watched via**: the AI-governance veille and buyer feedback on which regime they need cited.

## References

- [ADR-0009](ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md) — the OWASP ASI mapping this decision keeps universal.
- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate that stays regulation-agnostic.
- `docs/positioning.md` — the compliance guardrails, now with the regional-profile and security-only-default clauses.
- `docs/compliance/eu-ai-act.md`, `docs/compliance/nist-ai-rmf.md`, `docs/compliance/iso-42001.md` — the regional mapping references.
