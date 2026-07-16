# ADR-0017: The application↔infrastructure double vision — shared-brick placement as a gated deliverable

**Date**: 2026-07-11
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a multi-agent audit (skills→runward coverage, the application/infrastructure double vision, doctrine fidelity), cross-read against the doctrine itself, read first-hand: §01 (framing and the guiding principle — "the architecture frames the model, not the other way around"), §02 (the decoupling that makes language and topology secondary), §15 (beyond the application, the shared building blocks). Decided against the never-a-runtime, deterministic, zero-LLM-gate and anti-overclaim invariants. Decision only; no code in this ADR.

## Context

runward faithfully packages the **applicative** side of the doctrine as a gated path: six phases, 54 craft rules, the conformance manifest, `check --strict`. The **infrastructure** side of the doctrine — §15, "Beyond the application, the shared building blocks" — is present in runward only as `templates/mission/shared-bricks.md`, and that artifact is an **orphan**:

- its sole reference is `src/lib/paths.ts` (`MISSION_LAYOUT`), so `runward init` scaffolds it empty;
- **no workflow produces it**, no Definition of Done requires it;
- **`check --strict` never verifies it** — the 54 rules map only to phases `architect` / `floor` / `govern`, with **zero infra / placement phase**.

This is not a doctrine gap. §15 already specifies the infrastructure vision completely and precisely: five location families behind each port, six stable arbitration criteria, the recursive contract/index/implementation motif, the building-block matrix (default plus trigger per block), sovereignty graduated by class of data ("execution traces contain the prompts and the outputs, hence data… exporting them to a third-party service is an exfiltration like any other"), and the usage registry ("risk is classified per deployment, not per platform"). It is an **operationalization gap**: the doctrine's infra vision is not wired into runward's executable, gated flow.

Critically, the doctrine is explicit that infrastructure is **not a separate domain** — it is an adapter decision behind a stable port:

- §01: "language and deployment topology are adapter decisions, made behind stable contracts."
- §02: "a service is just an adapter that has migrated into its own process; the domain does not change."
- §15: "The question is therefore never port or no port: it is which location behind the port, existing infrastructure, dedicated platform, or managed service. This location trade-off is reversible precisely because the contract itself does not move."

**The port is the bridge between the two visions.** That bridge is never operationalized in runward: nowhere does a deliverable ask, port by port, *where the adapter lives, which class of data crosses it, which sovereignty level, which ADR*.

**Field signal.** Architects (and future users) struggle to link the two visions inside runward, because the applicative side is a gated path end-to-end while the infra side is an isolated note beside it. runward reproduces the doctrine's own ordering (infra laid out in §15) and, worse, leaves it ungated — so the port→placement decision is never traced or verified.

**Honest boundary (never a runtime).** runward does not, and will not, deploy, provision, or orchestrate anything. It **traces and governs** the placement / sovereignty decision, exactly as it already traces architecture decisions. *"Never a runtime" does not mean "ignore topology":* the topology decision is a decision, and decisions are precisely what runward gates. The §15 grid is stable; its filling is a dated, context-specific exercise the doctrine deliberately leaves out ("The grid is durable; filling it in depends on a dated landscape and context") — runward supplies the grid and gates that a decision was made, it never fills the market-dependent answer.

## Decision

Make the application↔infrastructure double vision **executable** by operationalizing doctrine §15 into runward's gated flow, without ever becoming a runtime. Five moves.

1. **Name the double vision** in `docs/positioning.md` and `templates/workflows/method.md`: two governed visions behind the same ports — the **application domain** (what the system does) and the **execution topology / placement** (where, and under which sovereignty, it runs). runward traces and governs both; it deploys neither. This lifts the ambiguity that "never a runtime" created, in which topology reads as out of scope.

2. **Cable `shared-bricks.md` as a produced, gated deliverable** (end the orphan). It becomes a first-class mission artifact: a skeleton produced in the `architect` phase (candidate placement behind each port), reopened at each `iterate` gate like the decision-matrix, and added to the Definition of Done of those workflows. Near-free, and it converts a dormant template into a living artifact.

3. **Add `templates/mission/execution-topology.md`** — the port→placement bridge, made legible. Per domain port, one row: *port · adapter · location family (the five of §15) · class(es) of data crossing it · sovereignty level required · reference ADR · re-evaluation trigger.* This operationalizes "the port is the bridge": the architect reads the domain **and** its infra incarnation in one table, closing the exact gap that keeps the two visions apart.

4. **Open an infra ADR family** — placement of a block / port (the six §15 criteria as the grid), sovereignty by class of data, secrets network boundary (vaulting / injection), agent-identity location, multi-region / HA, third-party trace export. Each infrastructure decision becomes a **traced, re-evaluable ADR**, the same regime as the existing ADRs and the building-block matrix's default-plus-trigger.

5. **Gate `execution-topology.md` as a first-class deliverable, its own `topology` conformance phase.** Decided over folding the rules into `architect`: a finished product traces the placement decision *where it lives*, symmetric with the `architect`/`floor`/`govern` gates, no cross-file split (which would be debt). `check --strict` gains one `(phase, deliverable)` pair — `topology → execution-topology.md` — and `EXPECTED_MAPPED` gains a `topology` floor. Four deterministic craft rules, `phases: [topology]`, each verifying the **existence of a traced decision**, never a real infra state:
   - `topology-port-placement-mapped` (HIGH) — each domain port has a named location family, plus an ADR when the placement is not in-app.
   - `topology-sovereignty-by-data-class` (CRITICAL) — each class of data has a declared sovereignty level (the §15 gradient), not a wholesale switch.
   - `topology-trace-export-decision` (HIGH) — third-party trace export is either absent or covered by a traced decision (recipient, data class, retention): the §10/§15 guard that traces "are data."
   - `topology-usage-registry-present` (HIGH) — the usage registry (per deployment: risk class, data classes, owner, responsible) exists.

   The secrets-at-the-network-boundary concern is **not** a new topology rule: `config-secrets-boundary` (CRITICAL, `[floor, govern]`) already covers it — a fifth rule would be duplication, i.e. debt. `execution-topology.md` references it instead.

**Adjacent, same thread:** the **usage registry** (§15 "usage registry") as a first-class mission artifact. It is the §15 "compliance consumes the architecture" made concrete — "risk is classified per deployment, not per platform" — and it strengthens the compliance angle (ADR-0015/0016) with no overclaim: it is a governed engineering artifact, not a compliance declaration.

## Consequences

- **Deterministic, zero-LLM gate preserved.** The new rules check the presence of a traced placement / sovereignty decision, never an infra state. No model call, no network, no scraping.
- **Never a runtime preserved.** runward emits and gates decision artifacts; it deploys, provisions and orchestrates nothing.
- **Evolution on evidence preserved.** Each placement carries a sober default and an explicit trigger (the building-block matrix), traced in an ADR; complexity grows only on signal.
- **Vendor-neutral preserved.** The five location families and six criteria are the stable grid; their filling is the operator's dated, context-specific exercise ("The grid is durable; filling it in depends on a dated landscape and context"). runward supplies the grid, gates the decision, and names no vendor.
- **Honest framing.** This closes an *operationalization* gap, not a doctrine gap — §15 already specifies everything. The claim to make is "runward now packages both visions of the doctrine as one gated path", not "runward does infrastructure."
- **Cost.** Moves 1 and 2 are near-free and remove the orphan immediately. Moves 3–5 add one template, one ADR family and four rules, and one `(phase, deliverable)` pair plus a `topology` floor in the gate config (not its mechanics: `conformance()` is phase-generic). The shipped example gains a filled `execution-topology.md` so it still passes `--strict`. Every mission now carries a fourth gated deliverable — deliberate: for a mission whose ports are all in-app, the note is a quick, honest sovereignty attestation ("all in-app, nothing leaves"), not noise.

## Ordered rollout

1. Name the double vision (move 1).
2. Cable the existing `shared-bricks.md` plus seed the usage registry (move 2 plus adjacent) — kills the orphan.
3. `execution-topology.md` — the bridge (move 3).
4. Infra ADR family (move 4).
5. Gated infra rules, verified by `check --strict` (move 5).

The first two are near-free and end the orphaning; the rest make the double vision executable and verified, without ever making runward a deployer.

## Alternatives discarded

- **Fold the topology rules into the existing `architect` phase** (verified in `architecture.md`). Lighter — no fourth gated deliverable — but it splits the rule and its deliverable across files: the placement decision lives in `execution-topology.md` while the gate reads `architecture.md`. That cross-file split is debt; a finished product gates the decision where it lives. Rejected in favour of a first-class `topology` conformance phase.
- **Leave the double vision produced-but-ungated** (name it, cable `shared-bricks.md` and `execution-topology.md` into the workflows' Definition of Done, but never fail `check --strict` on a missing placement). Doctrine-consistent on "complexity on trigger", but it reproduces the original defect one layer up: a deliverable no gate enforces drifts back to orphan. Rejected — the whole point of ADR-0017 is that the decision is *verified*, not merely produced.
- **Have runward read/plan the actual infrastructure** (topology as deployment, not decision). Crosses the never-a-runtime line and makes runward a deployer. Rejected outright; if ever needed it is its own ADR, not this one.

## Reevaluation trigger (mandatory, dated)

Reopen if real usage shows the four topology rules are systematically `n/a` for a whole class of missions (signal: not one placement, sovereignty tightening or trace export ever recorded across many missions) — then reconsider whether the `topology` gate should be conditional on a trigger rather than always-on (deliberately not pre-optimized here; an all-in-app note is a cheap, honest sovereignty attestation). Also reopen if a future capability genuinely needs to *read* infra state to be useful — that would cross the never-a-runtime line and requires its own ADR, not an extension of this one.

**Trigger set on**: 2026-07-11 · **Watched via**: the `n/a` ratio on topology rules across missions, and any request to have runward inspect real infra state.

## Amendment (2026-07-16) — closure: move 2 re-scoped onto the shipped bridge, move 4 executed in the reference

A factual audit found the rollout half-executed: moves 1, 3 and 5 shipped (the gated `topology` phase, `execution-topology.md`, the four rules, the floor), but `shared-bricks.md` was still a non-gated scaffolding note in no Definition of Done (move 2 unexecuted as worded), and no infra ADR existed anywhere — the reference mission itself carried two non-in-app placements with no placement ADR while marking `topology-port-placement-mapped` applied (move 4 unexecuted). Closed as follows, decision recorded here rather than left half-open:

- **Move 2 is re-scoped, not silently dropped.** Everything move 2 assigned to `shared-bricks.md` — the per-port candidate placement, produced at `architect`, reopened at each `iterate` gate, required by the Definition of Done — was delivered by `execution-topology.md` (move 3): the architect DoD requires it, `iterate` step 4 and its DoD reopen it, the gate verifies it. What remains in `shared-bricks.md` carries no mission decision: it is the stable reference grid (five families, six criteria, the brick matrix, the sovereignty gradient) that the decision consumes. Gating it would make `check --strict` verify the presence of a copied reference text — vacuous paperwork, the exact theater ADR-0002 hardens the gate against. `shared-bricks.md` therefore stays a scaffolded, **non-gated reference note**, consumed by the `architect` workflow and cross-referenced by the gated `execution-topology.md`. The orphan is closed by role, not by gate: the reference informs; the decision it informs is gated where it lives.
- **Move 4 is executed where a family begins: in the reference mission.** The example gains `ADR-0003-port-placement-and-sovereignty.md` — placement and sovereignty of the two non-in-app ports (model runtime residency, ticketing system of record), no third-party trace export — and the `execution-topology.md` rows plus the conformance manifest now cite it. The family's categories (placement, sovereignty by data class, secrets boundary, agent-identity location, multi-region, trace export) stay named in the `execution-topology.md` template; a mission opens one ADR per crossed category, as the reference now demonstrates instead of merely prescribing.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate this new `topology` phase extends.
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the non-vacuity floor (`EXPECTED_MAPPED`) the `topology: 4` floor joins.
- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md), [ADR-0015](ADR-0015-regulatory-conformance-as-a-regional-profile.md), [ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md) — the invariants (never a runtime, regional profile, compliance provenance) this ADR preserves.
- Doctrine §15 "Beyond the application, the shared building blocks" — the source this ADR operationalizes.
