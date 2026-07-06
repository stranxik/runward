# Shared Bricks

> **Usage.** Read this note when a capability the mission needs already exists — or should exist — beyond the application: a model gateway, a connector bank, a skill catalog, shared memory, a registry. It gives the placement families, the stable criteria, and a matrix of the common bricks, each with a sober default and its trigger. It decides *where a brick lives*; the port that consumes it is decided in `architecture.md`, and every placement switch is an ADR.

## The move that does not change the rule

A brick leaving the application changes nothing for the domain. The application consumed it through a port before; it consumes it through the same port after. The only question is what stands behind the port — in-process code, a service the platform team runs, a managed product. That placement is a **reversible adapter decision**, arbitrated like every line of the decision matrix: one sober default, one explicit trigger, and an ADR when the trigger fires. If moving a brick would force the domain to change, the boundary was wrong — fix the port before moving anything.

## The recursive pattern: contract, index, implementation

Every shared brick decomposes into three things that never merge:

- the **contract** — versioned, additive, tolerant reader — that consumers code against;
- the **index** that publishes and resolves what exists (which connectors, which skills, which models): it publishes and it resolves, it does not orchestrate. **The index is an index, not a brain.**
- the **implementation** behind the contract, replaceable without touching a single consumer.

This is the same discipline that keeps the tool registry thin inside the application, replayed at platform scale: **delivery delivers, the orchestrator decides.** A brick that starts deciding for its consumers has stopped being a brick and become a dependency you cannot leave.

## Five placement families

| Family | What stands behind the port |
|---|---|
| **In-app** | A module of the application itself — the starting point for everything |
| **Existing infrastructure** | Infrastructure the organization already operates: API gateway, message bus, identity provider |
| **Dedicated internal platform** | A product run by a platform team, serving many applications |
| **Managed infrastructure service** | A cloud provider's neutral runtime: queues, workflow engines, observability stacks |
| **Managed model-vendor runtime** | The model vendor's own platform hosting agents, tools or memory |

Each family further from the top trades control for leverage. None is right in general; each is right under criteria.

## Six stable criteria

The families change with the market; the criteria do not. Weigh every placement against:

1. **Sovereignty & control** — who can read the data, change the behavior, revoke the access.
2. **Reuse** — how many consumers actually benefit from sharing this brick.
3. **Velocity** — what the placement does to the team's iteration speed, now and at handover.
4. **Cost & dependency** — the bill, and the cost of leaving.
5. **Reuse of existing** — what the organization already runs, staffs and knows how to audit outranks a new component of equal merit.
6. **Compliance** — certifications, data residency, auditability the deployment must inherit.

## The brick matrix

One sober default and one trigger per brick — the decision-matrix discipline applied beyond the application.

| Brick | Sober default | Trigger to move |
|---|---|---|
| **Model gateway** | One model port in-app, direct SDK | A second application needs the same routing, quotas and audit — shared gateway on existing infra or an internal platform |
| **Connector bank** | Connectors as in-app adapters | The same connector is being rewritten for a third consumer — publish it behind a contract, listed in an index |
| **Skill catalog** | Skills versioned in the app repository | Skills are shared across teams — a catalog with curation, provenance and versioning |
| **Shared memory** | Per-app memory: journal plus derived view | A second application needs the same facts — a memory service with access control per data class |
| **Discovery registry** | A static list in configuration | Entries change faster than releases, or third parties publish into it — a registry that publishes and resolves, still not a brain |
| **Durable execution** | In-app suspend-and-rehydrate on the journal | Several apps rebuild the same suspend/resume machinery — a workflow engine, managed or internal; it carries the control flow and the durability, never the reasoning or the business, and the model call stays a recorded activity you re-read, never replay |
| **Delivery & evaluation** | CI plus the eval harness per app | Rubrics and shadow deployments duplicated across teams — shared evaluation infrastructure; delivery delivers, the orchestrator decides |
| **Observability** | Structured logs and metrics per app, common schema | Cross-app trajectories must be reconstructed — a shared trace store, placed under the sovereignty rule below |
| **Identity & secrets** | The existing IdP and vault | Agents need their own principals at scale — an agent-identity extension of the existing IdP, never a parallel identity system |

**Reconciliation with the doctrine's defaults.** Where doctrine §15 leans on *existing infrastructure* as the sober default for the model gateway, the connector bank and observability — under criterion 5, what the organization already runs, staffs and audits outranks a new component of equal merit — this template defaults those three to **in-app, per-app** instead. The divergence is deliberate and narrow: the doctrine bricks assume an enterprise whose infrastructure is already operated, while a runward mission starts on a greenfield floor where no such infra exists to reuse yet. In-app is the honest starting point here, not a rejection of the criterion. The moment a second consumer appears — or an already-operated brick is on hand — criterion 5 reasserts itself and each brick's own trigger moves placement onto existing infrastructure. Same rule, different starting inventory.

## Sovereignty, graduated by data class

Sovereignty is not one rule per brick; it is one rule per **class of data** crossing the brick. Public reference data can live on a managed vendor runtime; internal business data raises the bar; regulated or personal data pushes placement toward the internal families — and the class is decided at field level, not system level. Two facts are constantly underestimated: **traces are data** — an observability pipeline that ships prompts and tool arguments to a third party is exporting your most sensitive payloads under the name "telemetry"; and **third-party export is exfiltration** unless a decision says otherwise — same review as any data transfer: named recipient, named data class, named retention.

## The usage registry

Keep a registry of who deploys what on which brick, because risk is classed **by deployment, not by platform**. The same internal platform hosts a harmless FAQ bot and an agent with write access to payments; a platform-level risk label would either strangle the first or wave the second through. Governance attaches to each deployment — its data classes, its action scopes, its approval points — and the registry is what lets you answer, at audit time, "what runs where, touching what."

## The lesson of the layers

Every layer commoditizes. Yesterday's hand-rolled orchestration is today's managed workflow engine; today's bespoke gateway is tomorrow's product. The lesson is not to guess the winner — it is to **consume every brick through a contract and never weld the domain to a brick's SDK**. When the layer commoditizes, you swap the implementation and keep the contract; the applications above it do not notice.

## A third party is untrusted input

The moment a brick admits third-party content — connectors, skills, registry entries, remote tools — **curation is not optional**: review before listing, provenance recorded, capability scopes declared, and the 2-of-3 rule applied to whatever the content can reach (see `governance/threat-model.md`). An index that lists anything unreviewed is not a registry; it is an attack surface with a search box.
