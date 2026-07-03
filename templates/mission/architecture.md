# Architecture Note: [system name]

> **Usage.** Produce this note at the end of the `architect` workflow. It states boundaries before technology: the ports, the integration protocol, the default topology with its triggers, and what deliberately stays open. Keep it to a few pages — it is a map, not a detailed design dossier. Every structuring decision referenced here must already be locked in an ADR; the note cites, it does not decide. Replace every `[placeholder]`; delete this notice on delivery.

**Date**: [YYYY-MM-DD] · **Version**: [vX.Y] · **Framing note**: [link] · **ADR journal**: [link]

## 1. Context

[One paragraph: the problem and success criterion from framing, and the floor this architecture must carry. No restating of the full framing note — link it.]

## 2. Boundaries

[The two boundaries that make the stack secondary.]

- **Domain ports.** [How the domain expresses its needs as contracts, and why the model port is a port like any other: the reasoning engine is bound by its contract, not its brand — a replaceable adapter behind a stable port.]
- **Integration protocol.** [The standardized tool protocol through which out-of-process capabilities are exposed and consumed. A service is an adapter that moved into its own process; the domain does not change.]

## 3. Ports

[One line per port; the full contract of each lives in its own port-contract spec.]

| Port | Direction | Intent | Contract version | Spec |
|---|---|---|---|---|
| [ModelPort] | [secondary] | [provide a model completion] | [v0.1] | [link] |
| [PersistencePort] | [secondary] | [persist the interaction log] | [v0.1] | [link] |
| [ActionPort] | [secondary] | [execute an action — approval required: yes/no] | [v0.1] | [link] |
| [EntryPort] | [primary] | [receive work: interface / API / tool protocol] | [v0.1] | [link] |

## 4. Default topology and triggers

[The starting silhouette and the signal that would change each default. Defaults apply now; triggers are crossed only in `iterate`.]

| Default | Rationale | Evolution trigger |
|---|---|---|
| Modular hexagonal monolith | [one deployable, pure domain plus adapters] | [load, isolation, release-cycle, or availability signal] |
| Single orchestrator | [composes, carries no business logic] | [genuinely parallelizable subtasks] |
| Tool registry + middleware chain | [single transversal surface, thin channel] | [—] |
| One core language, thin model SDK | [no heavy chain framework] | [mature library or proven performance need → sidecar] |

## 5. What stays open

[Explicitly undecided: language(s), framework, model provider, hosting. Each is an adapter decision, taken later behind the contracts above, justified by a local technical reason.]

## 6. Legacy integration (if any)

[Where the anticorruption layer sits, which dialect it translates, and the named cost of that translation. The boundary is never free on legacy.]

## 7. Target, named

[The architecture this system tends toward, per the framing note — named for direction, not built.]

## 8. Decisions

[Pointers only. Every structuring choice is locked in an ADR before appearing here.]

| Decision | ADR |
|---|---|
| [starting topology] | [ADR-0001] |
| [core language] | [ADR-0002] |
| [legacy integration strategy] | [ADR-0003] |
