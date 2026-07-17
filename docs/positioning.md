# runward — positioning & messaging (source of truth)

Internal reference for all runward copy (site, README, release notes, ADRs, decks). Keep claims here defensible; when in doubt, downgrade the claim.

> The *verifiable* claims here — the MANDATORY compliance guardrails, the current regulatory dates, the framework/never-platform and never-overclaim rules, the cited ADRs — are enforced in CI by `test/unit/positioning-drift.test.js`. Dilute a guardrail, let a date go stale, assert a forbidden overclaim instead of negating it, or cite a missing ADR, and the gate reddens. Subjective wording stays free; the load-bearing claims cannot drift.

## Thesis (the wedge)

Spec-driven development automated the *easy* part — authoring intent. It left the part where ~95% of enterprise GenAI projects die — **shipping, governing, running** — without an owner. runward plants its flag there, on the FDE (Forward Deployed Engineer) method.

## Category

- Descriptor (safe, primary): **agentic-delivery framework**.
- Brand signature (distinctive, to install over time): **run-grade engineering**.
- Always say **framework / method**, **never "platform"** — it protects the "never a runtime" belief and the crowded-runtime space we refuse.
- Tether to spec-driven as the "before": *bring your spec; runward owns everything downstream.*

## Positioning statement

For engineers and engineering leaders who must put agentic systems into production and keep them alive, runward is the **agentic-delivery framework** that governs, ships, runs and hands off the system on the FDE method — a deterministic gate you own, evolution only on evidence, zero vendor lock-in. Unlike spec-driven tools, which end at "generate the code," runward owns the hard part: the run.

## Tagline

- Primary: **"After the spec, the hard part starts. runward ships it and runs it."**
- Belief line (for CTOs): "The model is an adapter. The discipline is the product."

## Six messaging pillars (claim + proof)

1. **The gate is aimed at the decision, at delivery.** The exit-code gate verifies a *traced decision* — was the architecture / topology / governance choice made, recorded and ratified — **not** an action (that is a runtime policy engine) and **not** an output (that is a test). And it spans the *whole delivery arc* — six gates, from framing (before a line of code) through the floor and governance to handover (after production) — **never at runtime**. Deterministic, zero-LLM and non-jailbreakable is *how* the decision-gate stays honest (a model cannot talk it into passing), not *why* runward exists. The operator owns it, rerunnable byte-for-byte. *Demo it, don't describe it.* (See [[positioning-note-object-moment-lineage]].)
2. **Governed from day zero.** Threat model, eval rubric, observability schema, cost cap wired on the first commit — against the post-deployment gap.
3. **No lock-in.** Model and runtime are swappable adapters behind a port; agent-agnostic (AGENTS.md); MCP/OTel/A2A pinned as versioned ports.
4. **Evolution on evidence + transmission.** Complexity added only on a trigger, every change an ADR, the team runs it without you.
5. **Both visions, one gated path (ADR-0017).** The application domain *and* the execution topology — where each port's adapter runs, under which sovereignty — are traced and gated behind the same ports. runward governs the placement decision (location family, data class, sovereignty, usage registry); it deploys nothing. "Never a runtime" does not mean "ignore topology": the topology decision is a decision, and a traced decision is what the gate verifies.
6. **Evidence derived from the decision journal.** The OSCAL / readiness draft is a byproduct of the mission's own artifacts — the *decision → ADR → conformance manifest → OSCAL* chain, with SHA-256-deterministic UUIDs. Every ASI control traces back to a ratified engineering decision, not a catalogue entry, so the evidence cannot drift from what was actually built and decided. The moat is that chain, not "we emit OSCAL" (anyone can template OSCAL). Keep the compliance guardrails below: audit-*ready*, feeds/supports, never "compliant".

## Compliance guardrails (MANDATORY — never overclaim)

The OWASP ASI / EU AI Act angle is an asset **only** if we do not overclaim. Verified with primary sources (2026-07-09).

- Use **"audit-ready evidence"** / **"supporting evidence"** — NOT "audit-grade" (which implies guaranteed auditor acceptance; acceptance is the auditor's call).
- The manifest **feeds / supports** an ISO/IEC 42001 programme and the EU AI Act technical documentation (art. 11 / Annex IV). It does **not** "satisfy" art. 12 (that needs runtime logs) and is **not** a conformity assessment.
- **Never** say: "compliant", "certified", "ISO 42001 certified", "EU AI Act compliant". A framework cannot confer compliance or certification.
- EU AI Act: high-risk (Annex III/IV) obligations were postponed by the Digital Omnibus on AI (June 2026) to **2 December 2027** — do NOT market an "August 2026 high-risk deadline" (stale). The 2 August 2026 milestone still applies to Article 50 transparency, governance and GPAI enforcement. Do NOT say "the AI Act starts in 2026" (prohibitions since Feb 2025, GPAI since Aug 2025). Two current, durable talking points instead: FedRAMP RFC-0024 states that GenAI outputs "do not constitute a factual record of the system state and must not be used to generate deterministic telemetry" (verified verbatim, in the RFC's Definitions — a federal validation of the deterministic, zero-LLM gate), and the Delve affair (AI-prefilled SOC 2 audits) shows why AI-produced evidence is not trusted.
- OWASP Top 10 for Agentic Applications (ASI01–ASI10, published 2025-12-09) is a voluntary security taxonomy, not law. Cite as an engineering-risk reference.
- **Regional profile, not EU-first (ADR-0015).** The OWASP ASI mapping is the *universal* core; the named regulation is a *regional lens*. Default to **security-only** (an ASI posture, no regulatory claim). Lead with the universal for a global audience, then map to the buyer's regime: **ISO/IEC 42001** (global anchor), **NIST AI RMF** (US), **EU AI Act** (EU). Never lead with "EU AI Act art. 13" for a US/APAC buyer — post-2025 US deregulation makes it read as foreign. See `docs/compliance/`.

## Vendor neutrality (see [[vendor-neutral-never-privilege-an-agent]])

Never privilege one agent/harness. Lead with the agent-agnostic seams (git pre-commit, CI) that gate whatever agent produced the code; any per-harness hook (e.g. Claude Code `Stop`) is "one example, not privileged."

## Competitive battlecard (2026)

Where runward wins vs Spec Kit / OpenSpec / BMAD / Spec Kitty:
- **Object × moment × lineage** — runward gates a *traced decision* (not an action, not an output), across the *whole delivery arc* from framing to handover (not runtime, not test time), and derives audit-ready evidence from a *ratified ADR journal*. Deterministic zero-LLM alone no longer discriminates (the Microsoft Agent Governance Toolkit and runtime policy engines like Cedar/OPA have it too); the durable distinction is that intersection, which no competitor holds together. See [[positioning-note-object-moment-lineage]].
- **Compliance/audit angle** — a wedge, not the arena (competitors are delivery frameworks, never GRC). No delivery framework occupies it.
- **"After the spec"** — competitors stop at Implement.
- **Runnable reference floor** (`floor-ts/`) — others ship scaffolding/orchestration, not a correctness floor.

Honest gaps (do not deny): traction (Spec Kit ~90–119k★ + GitHub brand + 70+ extensions; OpenSpec/BMAD ~50k; Spec Kitty ~1.4k), ecosystem breadth, docs maturity, and Spec Kitty already owns the "governed factory" language. Our edge is harder to say in one line — lead with the failure mode (95% fail at the *run*, not the spec).

## Tone

Sound like a staff engineer paged at 3am, not a vendor at a booth. Concrete nouns (gate, port, ADR, trigger, runbook), verbs over adjectives, numbers over enthusiasm. Confident about the method, humble about the stack. Teach, don't sell.
