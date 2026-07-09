# Architecture Note: Inbound Request Triage

**Date**: 2026-05-12 · **Version**: v0.1 · **Framing note**: [framing.md](framing.md) · **ADR journal**: [adr/](adr/)

## 1. Context

The organization triages ~400 heterogeneous inbound requests per week by hand; the success criterion is a first-assignment routing accuracy above the manual baseline, measured on real traffic, with zero silent misses on compliance-category requests. This architecture must carry the floor defined in the framing note: classify, extract key fields, route — nothing more. See [framing.md](framing.md).

## 2. Boundaries

- **Domain ports.** The triage domain is pure: it turns a raw request into a validated triage record and knows nothing about mailboxes, ticketing APIs, or model providers. Every dependency is a contract. The model port is a port like any other — the reasoning engine is bound by its contract (input text in, candidate classification and field extractions out), not by its brand. It is a replaceable adapter behind a stable port, which is also where the data-residency constraint is enforced: the adapter binds to the approved deployment; the domain never sees a provider.
- **Integration protocol.** Deterministic capabilities (field validation, account lookup, queue resolution) are exposed as tools through a single registry with a middleware chain (logging, access control, cost accounting, approval). Should any capability later move out of process, it is exposed over the standardized tool protocol: a service is an adapter that moved into its own process; the domain does not change.

## 3. Ports

| Port | Direction | Intent | Contract version | Spec |
|---|---|---|---|---|
| RequestIntakePort | primary | receive a raw inbound request (mailbox adapter, web-form adapter) | v1.0 | contracts/request-intake.md |
| ModelPort | secondary | propose classification and field extractions from raw text | v1.0 | contracts/model-port.md |
| RoutingPort | secondary | assign a validated triage record to a queue in the ticketing system — approval required: only for compliance-flagged records | v1.0 | contracts/routing-port.md |
| PersistencePort | secondary | append the triage decision to an immutable log, keyed by request ID | v1.0 | contracts/persistence-port.md |

The output contract is the **TriageRecord v1.0** schema: closed category vocabulary (`support`, `sales`, `compliance`, `unknown`), extracted fields each carrying a provenance marker (`computed`, `verified`, `model-proposed`), target queue, confidence level. The contract is versioned and evolves additively; consumers are tolerant readers. A record that fails schema validation is rejected fail-closed, never repaired silently.

## 4. Default topology and triggers

| Default | Rationale | Evolution trigger |
|---|---|---|
| Modular hexagonal monolith | one deployable; pure domain plus adapters; 400 req/week needs no distribution | throughput or availability measurably insufficient; multi-instance required |
| Single orchestrator (ADR-0001) | triage is a short dependent sequence; composes, carries no business logic | a genuinely parallelizable or isolation-requiring subtask appears |
| Tool registry + middleware chain | single transversal surface for logging, access, cost, approval | — |
| One core language, thin model SDK | no heavy chain framework; the model is one port among four | mature library or proven performance need → sidecar behind the same port |
| Deterministic guard before RoutingPort (ADR-0002) | no model-proposed value acts unverified | — (a floor invariant, not a default to outgrow) |

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| contracts-governance | applied | §3 TriageRecord v1.0 — versioned, additive, tolerant reader, fail-closed; contracts/ |
| hexa-architecture | applied | §2 pure triage domain, four ports; code/src/core/ |
| hexa-adapter-pattern | applied | §3 every dependency behind a port; code/src/adapters/ |
| hexa-typescript-native | n/a | language deliberately left open at this note (§5); locked at floor kickoff (ADR-0003 pending) |
| process-adr-and-journal | applied | adr/ADR-0001, adr/ADR-0002 — dated decisions with reevaluation triggers |
| security-mcp-server-pinning | n/a | the floor consumes no MCP or external tool server; tools are in-process and deterministic |

## 5. What stays open

Language, web framework, model provider, and hosting are explicitly undecided at this note's version. Each is an adapter decision, taken behind the contracts above and justified by a local technical reason — the core language will be locked in its own ADR at floor kickoff, chosen for team fluency and SDK maturity, not for the domain, which is language-agnostic by construction.

## 6. Legacy integration

The ticketing system is the system of record and predates this mission. An anticorruption adapter implements RoutingPort and translates the domain's `TriageRecord` into the ticketing API's dialect (its queue identifiers, its custom-field encoding, its pagination quirks). Named cost: the translation table must be maintained when the ticketing configuration changes, and queue resolution requires one extra lookup per routing. Accepted — the alternative is the ticketing dialect leaking into the domain.

## 7. Target, named

Per the framing note: auto-drafted acknowledgments under approval, priority scoring, requester memory, and a reassignment-to-evaluation feedback loop. Each would enter as a new adapter behind a new or existing port, without rewriting the core. Named for direction, not built.

## 8. Decisions

| Decision | ADR |
|---|---|
| Single orchestrator, sequential triage | [ADR-0001](adr/ADR-0001-single-orchestrator.md) |
| Deterministic guard on extracted fields | [ADR-0002](adr/ADR-0002-deterministic-guard-on-extracted-fields.md) |
| Core language (open — to be locked at floor kickoff) | ADR-0003 (pending) |
