# Execution Topology

> **Usage.** Read this note once the ports are named in `architecture.md`. It is the bridge between the two visions the doctrine governs behind the same ports: the **application domain** (what the system does) and the **execution topology** (where, and under which sovereignty, each port's adapter actually runs). `architecture.md` decides the ports; `shared-bricks.md` decides *where a shared brick lives*; this note records, **port by port**, the placement, the data it carries and the sovereignty it inherits — so an architect reads the domain and its infrastructure incarnation in one table. runward traces and governs this decision; it never deploys, provisions or orchestrates anything.

## The two visions, behind the same ports

The doctrine is explicit: *"language and deployment topology are adapter decisions, made behind stable contracts"* (§01), and *"a service is just an adapter that has migrated into its own process; the domain does not change"* (§02). So topology is not a separate domain: it is the **location behind the port**. *"The question is therefore never port or no port: it is which location behind the port… This location trade-off is reversible precisely because the contract itself does not move"* (§15).

"Never a runtime" does not mean "ignore topology." The topology decision is a decision — and a traced decision is exactly what the gate verifies. This note is where the decision lives.

## The port → placement map

One row per domain port from `architecture.md`. The location family is one of the five in `shared-bricks.md`. Any placement that is not in-app carries an ADR. Every class of data crossing the port carries a declared sovereignty level.

| Port | Adapter (what runs) | Location family | Data class(es) crossing it | Sovereignty level | ADR | Re-evaluation trigger |
|---|---|---|---|---|---|---|
| _e.g._ Model port | direct SDK, in-process | In-app | public reference | standard | — | a second app needs the same routing/quotas → shared gateway |
| _e.g._ Persistence port | store adapter | In-app | internal business | raised | — | multi-instance in sight → externalized state |
| _e.g._ Trace sink | observability adapter | Existing infrastructure | regulated (traces are data) | sovereign / self-hosted | ADR-NNNN | third-party trace export requested → its own ADR |
| … | … | … | … | … | … | … |

**Filling rules (what the gate expects to be traced, not what the answer must be).**

- **Placement is named per port.** Each domain port has a location family. The grid is stable; its filling is a dated, context-specific exercise the doctrine leaves to you.
- **Non-in-app placement has an ADR.** Moving a port's adapter off in-app is a structuring decision — lock it in the infra ADR family (placement, sovereignty, secrets boundary, agent-identity location, multi-region).
- **Sovereignty is graduated by class of data.** Not a wholesale switch: public reference can live on a managed runtime; regulated or personal data pushes placement toward the internal families. Decide it per data class, at field level, not per system.
- **Traces are data.** An observability pipeline that ships prompts and tool arguments to a third party is exporting your most sensitive payloads. *"Exporting them to a third-party service is an exfiltration like any other"* (§10/§15): a third-party trace export is either absent or covered by a decision naming recipient, data class and retention.
- **Secrets live at the network boundary.** The real key is attached by the infrastructure at the network boundary, replaceable without redeploying; the agent side holds a placeholder. Record that vaulting/injection decision.

## Usage registry

Risk is classed **by deployment, not by platform** (§15): the same platform hosts a harmless FAQ bot and an agent with write access to payments. Governance attaches to each deployment. This registry is what answers, at audit time, "what runs where, touching what." It is a governed engineering artifact, not a compliance declaration (see ADR-0015/0016 and `runward compliance`).

| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |
|---|---|---|---|---|---|
| _e.g._ triage-bot / prod | low | public reference | read-only | — | — |
| _e.g._ payments-agent / prod | high | regulated, personal | mutate (approval-gated) | — | — |
| … | … | … | … | … | … |

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the topology phase (`runward/rules/`, frontmatter `phases: [topology]`). `applied` needs a pointer; `deviated` needs an ADR; `n/a` needs a reason. `runward check --strict` verifies this table is complete — it checks a traced placement decision, not where you should run.
>
> Evidence can be **typed**, and typed pointers are verified deterministically at the gate: `file:PATH[:LINE][#SYMBOL]` · `test:PATH[::NAME]` · `adr:NNNN` — several per cell, separated by `;`. The gate checks resolution, non-emptiness, line count, symbol/test-name presence, and the rule's `signature:` when it declares one (ADR-0019/0020). Free prose stays valid — it is your judgment; a path it cites must simply not point at an empty file.

| Rule | Status | Evidence |
|---|---|---|
| [rule-slug] | applied \| deviated \| n/a | [pointer, ADR-id, or reason] |

## Cross-references

- `architecture.md` — the ports this note places.
- `shared-bricks.md` — the placement families, the six criteria, the brick matrix, sovereignty by data class.
- `governance/threat-model.md` — a third party (connector, skill, remote tool) is untrusted input; a shared surface amplifies it.
- `adr/` — every non-in-app placement, sovereignty tightening and trace-export decision is an ADR.
