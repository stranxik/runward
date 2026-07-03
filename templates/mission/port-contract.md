# Port Contract: [port name]

> **Usage.** A port expresses a domain need as a contract: provide a model completion, persist state, execute an action, read a source. The adapter that implements it may be written in any language, as long as it honors the contract. This spec describes the contract, never the implementation. Two reminders: the typed schema guards the data, but the behavioral boundary is validated (see the evaluation rubric and contract tests), not guaranteed by types; and a stable contract is not a frozen one — it is governed, it carries meaning, and it composes with legacy. The "evolution rule" section is not optional. Replace every `[placeholder]`; delete this notice on delivery.

## Port: [e.g. ModelPort, PersistencePort, ActionPort, SourcePort]

**Contract version**: [vX.Y]
**Port type**: [primary (drives the domain) | secondary (driven by the domain)]
**Known adapters**: [implementations, e.g. gateway adapter, store adapter]

## Business intent

[What the domain asks for, in business language, no technical detail. Why the need exists. Pin the meaning of the terms used — "client", "account", "validation" do not mean the same thing everywhere; fix this bounded context's meaning to prevent hallucinated mappings.]

## Signature

[The operation(s) the port exposes. For each: name, role, idempotent or not, sync or async, and whether it declares that approval is required.]

```
[operation]([input]) -> [output]
```

## Input schema

[Fields, types, optionality, per-field invariants. The schema is the guard: a valid payload passes, a malformed one is rejected at the boundary.]

| Field | Type | Required | Constraint |
|---|---|---|---|
| [field] | [type] | [yes / no] | [constraint] |

## Output schema

[Same columns. State what is guaranteed present and what is optional.]

| Field | Type | Always present | Constraint |
|---|---|---|---|
| [field] | [type] | [yes / no] | [constraint] |

## Invariants

[Properties true before and after the operation, independent of implementation. E.g.: every output references its input; a produced ID is unique; a read never mutates state. Invariants, not types, define the deep contract.]

## Errors

[Declared failure modes, qualified by type so the consumer knows how to react.]

| Error | Type | Meaning for the consumer |
|---|---|---|
| [error] | [transient / validation / business / unavailable] | [retry, degraded mode, escalate, fall back] |

## Evolution rule

[How this contract changes without breaking its consumers.]

- **Versioned**: [the contract carries a version; every evolution advances it.]
- **Additive by default**: [add optional fields; the consumer is a tolerant reader — it ignores unknown fields and accepts missing optional ones.]
- **Expand then contract**: [a genuinely breaking change happens in two steps: introduce the new, migrate consumers, retire the old once unused. Never in one move.]
- **Consumer-driven verification**: [each consumer expresses its expectations as an executable contract; a producer change that would break them fails at integration, before production.]
- **Provenance**: [record who produces, who consumes, under which version — so impact is measured before a change, not after.]

## References

- [Related port, adapter, ADR, contract-test suite.]
