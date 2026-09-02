# Framing Note: Inbound Request Triage

**Date**: 2026-05-04 · **Sponsor**: Head of Operations · **Entry mode**: greenfield · **Stopping tier**: full chain

## 1. Problem

The organization receives roughly 400 inbound requests per week through a shared mailbox and a web form. They are heterogeneous — support issues, sales inquiries, compliance and data-privacy requests — and arrive as free text, often incomplete. Two operations coordinators triage them by hand: read, guess the category, hunt for the requester's identity and account, forward to one of three teams. Triage consumes about half of each coordinator's day. Misrouted requests bounce between teams for one to three days before reaching the right owner; compliance requests carry a regulatory response deadline, so a bounce there is not just friction, it is exposure. Routing quality varies with who triages and at what hour.

## 2. Value

Faster, more consistent routing. The receiving teams start work on day zero instead of day two; the coordinators spend their time on the ambiguous cases that actually need judgment instead of on the obvious bulk; deadline-bearing compliance requests stop losing days in transit. Value accrues on every request, every day — this is a high-frequency, low-glamour process, which is exactly what makes it worth automating.

## 3. Observable success criterion

### SC-1

**Metric**: share of requests routed to the correct team on first assignment
**Unit**: % of inbound requests
**Baseline**: 71% — manual routing, reconstructed 2026-05 from the ticketing system's reassignment history
**Threshold (success)**: > manual baseline measured over the same period the previous month
**Measured on**: real inbound traffic, at least two weeks
**Measured by**: the ticketing system's reassignment log, replayed by `cd code && npm test`

**The share of requests routed to the correct team on first assignment, measured on real inbound traffic over at least two weeks, exceeds the manual baseline measured over the same period the previous month.** "Correct" is judged by the receiving team accepting the request without reassignment. Attached condition: no compliance-category request may be routed to a non-compliance queue without human review — a single silent miss there fails the gate regardless of the aggregate number.

## 4. Floor

The smallest system that proves value on real traffic: a qualifier that takes one raw request and produces a structured triage record — category (support / sales / compliance / unknown), extracted key fields (requester identity, account reference, stated deadline if any), a target queue, and a confidence level. One orchestrator, a model port for classification and extraction, deterministic guards that validate or recompute every extracted field before routing (see ADR-0002), persistence of every triage decision as an immutable log, baseline observability with a propagated request ID, and a per-run cost ceiling. Low-confidence and compliance-flagged requests route to a human review queue, never straight through. The floor routes; it does not answer requesters.

## 5. Target (named, not built)

Auto-drafted acknowledgments to requesters (under human approval); priority scoring within each queue; memory of past requester interactions for continuity; a feedback loop where reassignments automatically become labeled evaluation cases. Named to give direction only.

## 6. Named deferrals

| Deferred capability | Lean default in place | Trigger to revisit |
|---|---|---|
| Auto-drafted acknowledgments | none — humans reply as today | routing accuracy holds above baseline for 4 consecutive weeks |
| Priority scoring in queues | FIFO within each queue | receiving team measurably fails deadline-bearing requests under FIFO |
| Requester memory / continuity | each request triaged independently | measured rate of repeat requesters where prior context changes the routing |
| Multi-agent decomposition | single orchestrator (ADR-0001) | a genuinely parallelizable or isolation-requiring subtask appears |
| Externalized state | in-memory queue state, single instance | move to multi-instance, or replay-on-restart proves insufficient |

## 7. Hard constraints

- Requests contain personal data; nothing leaves the organization's approved infrastructure. The model provider is an adapter behind a port, bound to the approved deployment.
- Compliance-category requests carry regulatory deadlines: they must never be silently misrouted (attached condition in §3) and always pass human review at the floor.
- The system routes and records; it never replies to a requester at the floor tier.
- The existing ticketing system is the system of record; the qualifier writes to it, it does not replace it.

## 8. Presumed boundaries

Foreseen ports: an inbound request port (primary — mailbox and web form feed it), a model port (classification and extraction behind a stable contract), a routing/output port toward the ticketing system, a persistence port for the triage log. Integration with the ticketing system will go through an anticorruption adapter — its API dialect must not leak into the domain. Language and topology are explicitly left open; they are adapter decisions for the `architect` phase.

## 9. Definition of Ready check

| Condition | Status | If missing: named risk |
|---|---|---|
| Real problem, identified sponsor | met | — |
| Observable success criterion | met | — |
| Floor-first principle accepted | met | — |
| Access to the real process and people | met | — |
| Usable data or a path to it | **risk** | The manual baseline (correct-first-assignment rate) was never measured; historical reassignment data in the ticketing system is believed sufficient to reconstruct it, but this is unverified. **Owned by the sponsor**; measuring the baseline is the first object of discovery — without it the success criterion cannot be judged. |
| Access to technical infrastructure | met | — |
| Hard constraints known | met | — |
| Human available to decide and approve | met | — |
