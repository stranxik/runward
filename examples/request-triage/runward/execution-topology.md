# Execution Topology — Request Triage

> The bridge between the two visions: `architecture.md` names the four ports; this note records, port by port, where each adapter runs and under which sovereignty. runward traces the placement decision; it deploys nothing.

## 1. The two visions, behind the same ports

The triage domain says *what* the system does (raw request in, validated `TriageRecord` out). The execution topology says *where* each port's adapter runs. They are not two subjects: a placement is an adapter decision behind a stable port. Two of the four ports already reach beyond the process, and the domain does not notice.

## 2. Port → placement map

| Port | Adapter (what runs) | Location family | Data class(es) crossing it | Sovereignty level | ADR / evidence | Re-evaluation trigger |
|---|---|---|---|---|---|---|
| RequestIntakePort | mailbox / web-form adapter, in-process | In-app, consuming existing infra (mailbox) | inbound request text (internal, may carry personal data) | raised | architecture.md §3 | intake volume outgrows in-process handling → dedicated queue |
| ModelPort | model adapter bound to the approved deployment | Managed model-vendor runtime | request text (internal / personal) | raised — residency enforced at the adapter, not in the domain | ADR-0003 (placement + residency); architecture.md §2 | a second application needs the same routing/quotas → shared model gateway |
| RoutingPort | anticorruption adapter → ticketing system of record | Existing infrastructure | `TriageRecord` (internal business) | standard; approval-gated for compliance-flagged records | ADR-0003 (placement); ADR-0002 (deterministic guard) | the ticketing system moves or multi-tenants → re-evaluate the adapter placement |
| PersistencePort | append-only log, in-process | In-app | `TriageRecord` plus provenance (internal) | standard | architecture.md §3 | multi-instance required → externalized store (iterate) |

Traces are data: this floor exports none to a third party (see the conformance note below).

## 3. Usage registry

Risk is classed by deployment, not by platform. This floor is one deployment.

| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |
|---|---|---|---|---|---|
| triage-bot / prod | medium | request text (personal possible), `TriageRecord` | read intake; write to ticketing (approval-gated for compliance-flagged records) | triage product owner | — |

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| topology-port-placement-mapped | applied | file:code/src/core/ports/routing.port.ts#RoutingPort — §2 map — all four ports placed; the two non-in-app placements (ModelPort → managed vendor runtime, RoutingPort → existing ticketing infra) are locked in ADR-0003 (the infra ADR family) |
| topology-sovereignty-by-data-class | applied | file:code/src/adapters/hardcoded-account-registry.adapter.ts — §2 map — a data class and a sovereignty level per port; request text is bound to the approved model deployment (residency), the `TriageRecord` is kept internal |
| topology-trace-export-decision | n/a | the floor exports no execution traces to a third party; observability is in-app structured logs per governance/observability-schema.md |
| topology-usage-registry-present | applied | §3 usage registry — the single prod deployment with its risk class, data classes, action scopes and owner |

## Cross-references

- `architecture.md` — the four ports this note places.
- `shared-bricks.md` — placement families, criteria, brick matrix, sovereignty by data class.
- `governance/threat-model.md` — the ticketing system and model provider are untrusted surfaces.
