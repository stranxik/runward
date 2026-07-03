# ADR-0001: single orchestrator, sequential triage

**Date**: 2026-05-12
**Status**: accepted
**Deciders**: delivery engineer, Head of Operations (sponsor)
**Method**: decision-loop: reality-check on the observed process, sourced state of the art, challenge, durable position

## Context

Triaging one request is a short sequence of dependent steps: normalize the raw input, propose a classification and field extractions (model), validate or recompute the extracted fields (deterministic, see ADR-0002), resolve the target queue, route or escalate to human review, persist. Each step consumes the output of the previous one; none is independent enough to parallelize, none handles content requiring an isolated context. Volume is ~400 requests per week — throughput is not a force here. The decision is taken at the orchestration boundary, behind the primary RequestIntakePort; it is structuring because topology is expensive to unwind once adapters and observability are built around it.

## Decision

One orchestrator, running a fixed sequential plan per request, holding no instance state. It composes the steps and carries no business logic: classification rules live in the domain, validation in the guards, translation in the adapters. This applies the framework's sober default: no multi-agent until a genuinely parallelizable or isolation-requiring subtask exists.

## Alternatives discarded

- **Multi-agent (one agent per step)**: discarded. No step is isolable enough to deserve its own context; the coordination and token overhead buys nothing measurable at this volume.
- **Model-driven dynamic planning**: discarded. The triage sequence is known and stable; letting the model decide the plan adds non-determinism, cost, and an attack surface without adding value.
- **Event-driven pipeline (queue between each step)**: tempered rather than eliminated. Useful at scale for backpressure, but at 400 requests/week it multiplies moving parts for no observed load. The persistence log already gives replayability.

## Consequences

- **Positive**: deterministic, replayable trajectories; a single point of cost accounting and tracing; one request ID covers the whole run with no parent-child lineage to manage; the fixed plan keeps model spend to the two calls that need it.
- **Negative, accepted**: if one step becomes heavy and independent — for example untrusted attachment processing that should run quarantined — the topology must be revisited. Cost taken on knowingly.
- **On other boundaries**: observability stays flat (one trajectory per request); security review has one path to guard; the contract between steps is internal and free to change until a step crosses a process boundary.

## Reevaluation trigger (mandatory, dated)

Reopen this decision when either observable signal appears: (1) a subtask requiring an isolated context or genuine parallelism enters scope — the named candidate is attachment processing, currently out of scope; or (2) end-to-end triage latency exceeds 60 seconds at p95 over a full week, measured on the observability schema, indicating the sequential plan no longer holds the load. Until then, apply without reopening.

**Trigger set on**: 2026-05-12 · **Watched via**: weekly review of the p95 latency metric and the scope backlog

## References

- [architecture.md](../architecture.md) §4 — default topology and triggers.
- [ADR-0002](ADR-0002-deterministic-guard-on-extracted-fields.md) — the guard step this plan sequences.
