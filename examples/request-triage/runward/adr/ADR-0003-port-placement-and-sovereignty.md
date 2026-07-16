# ADR-0003: port placement and sovereignty behind the four ports

**Date**: 2026-05-12
**Status**: accepted
**Deciders**: operator, Head of Operations (sponsor)
**Method**: decision-loop: reality-check against the org's existing infrastructure inventory, challenge on sovereignty per data class, durable position

## Context

The architecture note names four ports; two of their adapters run beyond the process. The model adapter calls a vendor-hosted deployment, and the routing adapter writes into the ticketing system the organization already operates. Placement is an adapter decision behind a stable port — the domain does not change with it — but it is a decision, and it carries the mission's most sensitive constraint: inbound request text may contain personal data, so where each adapter runs decides which jurisdiction and which operator can read it. This ADR is the first member of the mission's infra ADR family (placement, sovereignty, trace export); it locks the placement and sovereignty rows recorded in `execution-topology.md`.

## Decision

One placement per port, sovereignty graduated by the class of data crossing it — never a wholesale switch.

- **ModelPort → managed model-vendor runtime**, bound to the organization's approved deployment. Residency is enforced at the adapter: the deployment is region-pinned, and request text (internal, possibly personal) never leaves the approved region. Sovereignty: **raised**. The port keeps the placement reversible — a self-hosted or gateway-fronted deployment is an adapter swap, not a rework.
- **RoutingPort → existing infrastructure** (the ticketing system of record), reached only through the anticorruption adapter and the deterministic guard (ADR-0002). Only the validated `TriageRecord` (internal business data) crosses; compliance-flagged records are approval-gated. Sovereignty: **standard**.
- **RequestIntakePort and PersistencePort → in-app**, the sober default; the intake adapter consumes the existing mailbox, the log is in-process and append-only.
- **No third-party trace export.** Observability is in-app structured logs (`governance/observability-schema.md`). Traces carry request text — exporting them would be a data transfer requiring its own ADR naming recipient, data class and retention.

## Alternatives discarded

- **Self-hosted model runtime**: discarded at the floor. Operating a model server costs more than the floor's value proof justifies, and the port makes the move cheap later. Trigger named below.
- **A dedicated intake queue now**: discarded. No volume signal; in-process handling holds the observed load. Premature distribution would buy eventual consistency and idempotence work with no gain.
- **Exporting traces to a managed observability service**: discarded. Traces contain the prompts and the extracted fields — the most sensitive payloads in the system. Convenience does not clear a data transfer; if the need appears, it is its own decision with recipient, class and retention named.

## Consequences

- **Positive**: every port's placement and sovereignty is a traced, reversible decision; residency is pinned where it is actually enforced (the adapter binding, not a policy document); the two non-in-app placements are auditable from one table.
- **Negative, accepted**: the model path depends on a vendor runtime — bounded by the port and the approved-deployment binding; the ticketing coupling is real but contained in the anticorruption adapter.
- **On other boundaries**: `execution-topology.md` §2 records the rows this ADR locks; the usage registry (§3) classes the deployment's risk; the threat model treats both external surfaces as untrusted.

## Reevaluation trigger (mandatory, dated)

Reopen this decision if any of: a second application needs the same model routing, quotas or audit (→ shared gateway on existing infra); the ticketing system is migrated or multi-tenanted; anyone requests third-party trace export; or the data classification of inbound requests changes (e.g. confirmed regulated data). Until a trigger fires, apply without reopening.

**Trigger set on**: 2026-05-12 · **Watched via**: the usage registry review at each iterate gate, and the architecture review before any new consumer of the model path

## References

- [execution-topology.md](../execution-topology.md) §2 — the port → placement map this ADR locks.
- [architecture.md](../architecture.md) §2, §3 — the ports and the data residency constraint.
- [shared-bricks.md](../shared-bricks.md) — the five location families and six criteria used to arbitrate.
- [ADR-0002](ADR-0002-deterministic-guard-on-extracted-fields.md) — the guard standing before RoutingPort.
