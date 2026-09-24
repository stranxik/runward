# Territory

Which files of this mission carry which category of artifact (ADR-0043). A deployment manifest
declares an execution topology, never the nature of the code behind it; this map declares the rest.
It describes the example's own tree, which runward wrote — in your mission, you write it.

| Pattern | Category | Effect | Why |
|---|---|---|---|
| `code/src/core/domain/**` | `domain-core` | declare | entities, the deterministic guard and triage policy — pure business logic that imports nothing from adapters |
| `code/src/core/application/**` | `domain-core` | declare | the use case that orchestrates the domain through ports, and nothing else |
| `code/src/core/ports/**` | `domain-core` | declare | the port interfaces the core owns; adapters implement them |
