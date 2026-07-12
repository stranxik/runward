# Positioning note — the differentiator is Object × Moment × Lineage, not "deterministic"

**Date**: 2026-07-11
**Status**: ratified — folded into [positioning.md](positioning.md) (pillar 1 rewritten, pillar 6 added, battlecard updated) in v0.12.2
**Origin**: the competitive confrontation (multi-agent audit of runward, then read against competitor repos — delivery frameworks BMAD / Spec Kit / Kiro, runtime policy engines Cedar / OPA, the Microsoft Agent Governance Toolkit, and GRC / OSCAL emitters).

## The finding that forces this note

runward's current lead claim is the **deterministic, zero-LLM, non-jailbreakable gate you own** (positioning.md pillar 1). The confrontation showed that claim **no longer discriminates**:

- The Microsoft Agent Governance Toolkit is also Tier-1 **deterministic, zero-LLM**, ASI-mapped, permissively licensed.
- Runtime policy engines (Cedar, OPA) are **deterministic** by construction, Rust-fast, and battle-proven.
- "Zero-LLM gate" is now table stakes for anyone serious about a governance check. It is a property runward must keep, not a moat it can lead with.

Leading with "deterministic zero-LLM" puts runward in a feature race it does not win on maturity (mono-author, unproven vs. a vendor-backed toolkit). The durable distinction is **not the mechanism of the gate**. It is **what the gate is aimed at, when it fires, and where its evidence comes from.**

## The reframe — three axes no competitor occupies together

### 1. OBJECT — runward gates a *traced decision*, not an action or an output

- **Runtime policy engines** (Cedar / OPA) gate an **action**: may this call proceed, now, under this policy.
- **Test / eval frameworks** gate an **output**: did this run produce an acceptable result.
- **runward gates a *decision*****: was the architecture / topology / governance choice *made, recorded, and ratified* — architecture.md, execution-topology.md, floor.md, threat-model.md, each rule `applied`+pointer / `deviated`+ADR / `n/a`+reason.

The gate does not verify that the code is correct or that a call is safe. It verifies that a **human-owned engineering decision exists and is traceable**. That object — the decision — is unclaimed by the runtime and test crowds.

### 2. MOMENT — runward spans the *whole delivery arc* (framing to handover), not runtime or test time

- Policy engines fire **at runtime**, on every request, forever — an operational cost surface.
- Eval harnesses fire **at test time**, against a fixture set.
- **runward spans the whole delivery arc**: six gates, from framing (before any code) through the floor and governance to handover (after production), each a checkpoint you cross on evidence and re-cross byte-for-byte. It is **never a runtime**; it deploys, provisions and orchestrates nothing.

This is the FDE moment: the gap where ~95% of enterprise GenAI dies is not "the model gave a bad answer," it is **"nobody owns shipping, governing, running, handing off."** runward plants its flag on that moment. Being *not* a runtime is a feature here, not a limitation.

### 3. LINEAGE — the compliance evidence is *derived from a ratified ADR journal*

- GRC platforms and generic OSCAL emitters produce evidence from a **static control catalogue** — a checklist mapped to boilerplate.
- **runward's OSCAL / readiness draft is derived from the mission's own artifacts**: the decision → ADR → conformance manifest → OSCAL chain, with SHA-256-deterministic UUIDs. Every ASI control in the export traces back to a **real, ratified engineering decision in the ADR journal**, not to a catalogue entry.

The moat is not "runward emits OSCAL" (anyone can template OSCAL). The moat is that the evidence is **a byproduct of the traced decisions**, so it cannot drift from what was actually built and decided. Break the chain and the export changes; that coupling is the defensibility.

## The one-line positioning that results

> runward is the framework that gates the **decision** (not the action, not the output), at **delivery** (not at runtime, not at test time), and turns the **ratified decision journal** into audit-ready evidence (not a catalogue checklist).

"Deterministic and zero-LLM" moves from *headline* to *supporting property*: it is **how** the decision-gate stays honest (an LLM cannot talk it into passing), not **why** runward exists.

## Where this competes cleanly (positioning map)

| | Object gated | Moment | Evidence lineage |
|---|---|---|---|
| Runtime policy engines (Cedar, OPA) | an **action** | runtime, every request | n/a (enforcement, not evidence) |
| Governance toolkits (MS Agent Gov.) | a **posture / config** | assessment scan | catalogue-mapped |
| Eval / test frameworks | an **output** | test time | test reports |
| Delivery frameworks (BMAD, Spec Kit, Kiro) | *authoring intent* | before build | none |
| GRC / OSCAL emitters | *controls* | audit prep | static catalogue |
| **runward** | a **traced decision** | **delivery / handoff** | **ratified ADR journal → manifest → OSCAL** |

No row but the last one holds all three columns. That intersection is the wedge.

## Consequences for the copy (proposed edits to positioning.md)

1. **Rewrite pillar 1.** From "The gate you own — deterministic, zero-LLM, non-jailbreakable" to lead with the **object and moment**: *"The gate is aimed at the decision, not the action. It fires at delivery, not at runtime. Deterministic and zero-LLM is how it stays honest, not the reason it exists."* Keep the demo-it-don't-describe-it note.
2. **Add a sixth pillar — Lineage / derived evidence.** The decision → ADR → manifest → OSCAL chain, with SHA-256 UUIDs, as the compliance defensibility. Keep the existing overclaim guardrails verbatim (audit-*ready*, feeds/supports, never "compliant/certified").
3. **Tagline unchanged** ("After the spec, the hard part starts. runward ships it and runs it.") — it already encodes the *moment* axis. The belief line "the model is an adapter, the discipline is the product" stays.
4. **Category unchanged** — "agentic-delivery framework", never "platform". The reframe reinforces "framework / never a runtime": the *moment* axis is exactly why runward is not a runtime.

## Guardrails carried over (unchanged)

- Competitors are **delivery frameworks** (BMAD, Spec Kit, Kiro), not GRC platforms; compliance / OSCAL is a **wedge**, never the arena.
- Vendor-neutral on **agents / harnesses** (peers, always). Naming competing *frameworks* in this internal analysis is fine; site and README copy stay neutral.
- "Zero-LLM" scopes only to the **gate**; never imply runward is AI-free (the agent that builds *is* an LLM).
- No overclaim on compliance: audit-**ready** evidence that **feeds** ISO 42001 / EU AI Act art. 13; never "satisfies", "compliant", "certified".

## Next step

Ratify, then fold items 1–2 into [positioning.md](positioning.md) and propagate to the site hero / README lead only after that edit is agreed. This note is the rationale; positioning.md stays the single source of truth.
