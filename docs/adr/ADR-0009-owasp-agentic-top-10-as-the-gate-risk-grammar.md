# ADR-0009: OWASP Top 10 for Agentic Applications (ASI01–10) as the gate's risk grammar

**Date**: 2026-07-09
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — ecosystem veille (2026), sourced state of the art, challenge, durable position

## Context

The 2026 ecosystem veille surfaced a stable, peer-reviewed risk taxonomy: the **OWASP Top 10 for Agentic Applications** (ASI01–ASI10), distinct from the LLM Top 10 — goal/intent hijack, tool misuse, identity abuse, memory poisoning, unsafe inter-agent communication, and so on. It is the shared grammar a security lead or an auditor already reads. runward's craft rules and its `Rule conformance` manifest currently speak runward's own vocabulary. That is legible to an engineer, opaque to a CISO.

Two forces make an alignment worth locking: the manifest becomes **audit-ready supporting evidence** that feeds an ISO/IEC 42001 programme and the EU AI Act technical documentation (art. 11 / Annex IV) (high-risk obligations binding 2027-12-02, postponed from 2026-08-02 by the Digital Omnibus on AI) — an input to that work, never a conformity assessment and never a substitute for art. 12 runtime logging — and ecosystem CVEs (MCP tool poisoning, rug-pull, memory injection) can be turned into **opposable deterministic rules** rather than left as prose warnings. The decision is at the tooling/method boundary (the rule schema and the manifest), deterministic, zero-LLM.

## Decision

Adopt **ASI01–ASI10 as the reference risk taxonomy** of the gate:

- Each CRITICAL/HIGH craft rule declares an additive `asi:` frontmatter field mapping it to one or more ASI categories. The conformance report can then be read as ASI coverage — legible to a CISO, usable as audit-ready supporting evidence.
- Add **CVE-derived deterministic craft rules** the veille made concrete: an MCP server consumed by the system is pinned by version **and** hash; a change to a signed tool forces re-approval (against rug-pull / tool poisoning); retrieved content and memory items carry provenance and never gain instruction authority (memory poisoning).
- The mapping is descriptive and deterministic. No LLM classifies risk — the mapping is declared and exact.

## Amendment (2026-08-17) — a declared absence, because ASI is a security taxonomy

The decision above reads "**each** CRITICAL/HIGH craft rule declares an additive `asi:` field". Measured
on 2026-08-14 by the full-repo audit: 19 of 45 did not, and the promise had been printed as a property
of the chain in the README and the OSCAL spec. Two ways out, and the honest one is not the obvious one.

Completing all 19 was the obvious move and would have been a lie. OWASP ASI is an **agentic-attack**
taxonomy; `hexa-architecture`, `routing-model-cost-ratios`, `data-migrations-forward-only` or
`process-adr-and-journal` have no honest category in it, and forcing one would report agentic-security
coverage that does not exist — a CISO reading the pack would count controls that were never controls.
That is the exact mirror of the false red [ADR-0020](ADR-0020-rule-evidence-signatures.md) refuses for
signatures ("a forced signature manufactures a false red, which erodes the gate faster than a gap"),
pointed the other way: a forced mapping manufactures a false green.

So the amendment takes the shape this repository already invented for the same problem
([ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s `noTerritory`):
**a CRITICAL/HIGH rule carries `asi:` OR a `noAsi:` reason — silence is never a state.** Three of the
nineteen turned out to carry a real category and were mapped (`hexa-typescript-native` → ASI04, a heavy
framework being dependency surface in the agent's execution path; `provider-no-crash-missing-env` →
ASI08, the cascading failure the rule exists to stop; `topology-trace-export-decision` → ASI04, a
telemetry backend receiving prompts is a third party in the agent's data chain). The other sixteen — plus
`handover-succession-named`, which carried a bare `asi: []` that said "no ASI" without saying why — now
state their reason in one sentence, readable in `runward explain <rule>` and in `rules --json`.

The promise the README and the OSCAL spec may make is therefore the amended one: **every CRITICAL/HIGH
rule is ruled on** — mapped to its ASI categories, or declaring in writing why it has none. The coverage
number a pack reports counts mapped rules only, and it now means what it says.

Guarded, not asserted: `rules.test.js` fails the build if any CRITICAL/HIGH rule carries neither.

## Alternatives discarded

- **Keep only runward's own vocabulary.** Legible to engineers, opaque to auditors and security — it forfeits the audit-readiness value exactly when regulation demands it.
- **An LLM that classifies each rule's risk.** Violates the zero-LLM invariant; a declared mapping is exact where an LLM guess is not.
- **Adopt the LLM Top 10 instead.** The agentic taxonomy is the correct, distinct one for tool-using, memory-bearing, multi-agent systems.

## Consequences

- **Positive.** The conformance manifest doubles as an ISO 42001 / EU AI Act evidence artifact; ecosystem CVEs become deterministic, opposable rules; the gate speaks the security world's language.
- **Negative, accepted.** A mapping to keep honest as OWASP revises the taxonomy; a few new craft rules to maintain.
- **On other boundaries.** Rule frontmatter gains `asi:`; the conformance report can group by ASI; the doctrine's security section can reference ASI as the shared grammar. Zero-LLM invariant untouched.

## Reevaluation trigger (mandatory, dated)

Reopen when OWASP publishes a revised Agentic Top 10 (category renames/renumbering): re-map the `asi:` fields and pin the taxonomy version referenced. Reopen sooner if a mapping proves misleading to auditors in practice.

**Trigger set on**: 2026-07-09 · **Watched via**: OWASP Agentic Top 10 releases and the ecosystem CVE feed.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the conformance manifest this grammar annotates.
- OWASP Top 10 for Agentic Applications (ASI01–10), 2026 — the reference taxonomy.
- ISO/IEC 42001 · EU AI Act art. 12–13 (binding 2027-12-02, postponed by the Digital Omnibus on AI) — the audit frame the manifest serves.
- `templates/rules/*.md`, the `Rule conformance` manifest — the surfaces this ADR touches.
