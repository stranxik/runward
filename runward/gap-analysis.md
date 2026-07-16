# Gap analysis — [system or mission name]

> Brownfield / retro-documentation artifact (workflow `brownfield.md`, mode M3). A **section-by-section
> audit of an existing system**: what is there, what is missing, and — for each gap — the trigger that
> forces closing it and the reconstructed decision that records the choice. Start it from the facts in
> `characterization.md` (run `runward characterize`). Everything here is a **finding or a hypothesis**
> until you, the operator, ratify it — never a claim that the system is safe or complete.

## How to fill this

For each dimension below: state what **exists** in the current system (fact, from characterization or
observation), what is **missing or unknown** (the gap), the **trigger** under which the gap must be
closed (a date, an audit, a next change), and the **ADR** that records the reconstructed decision (a
`DRAFT-*` hypothesis until you ratify it — write the real *why* + a re-evaluation trigger and set
`Status: accepted`). Leave `why: UNKNOWN` where you cannot yet source the rationale; `runward check
--strict` will keep the gate red until it is filled.

| Dimension | What exists (fact) | Gap / unknown | Trigger to close | Reconstructed ADR |
|---|---|---|---|---|
| **Boundaries & architecture** | | | | |
| **Ports & contracts** | | | | |
| **Model / non-determinism boundary** | | | | |
| **State & memory** | | | | |
| **Governance — threat model** | | | | |
| **Governance — evaluation** | | | | |
| **Observability & tracing** | | | | |
| **Security — untrusted input / trifecta** | | | | |
| **Resilience & cost controls** | | | | |
| **Tests / characterization** | | | | |
| **Handover / transmission** | | | | |

## Findings summary

- **Critical gaps** (block production / audit): …
- **Deferred gaps** (named, each with a trigger): …
- **Reconstructed decisions to ratify**: list the `DRAFT-*` ADRs still `Status: hypothesis` — the
  operator owns each *why* and trigger before it counts (see the ratification loop). The reconstruction
  is the cheap part; owning it is the deliverable.

## Re-entry point

After this audit, re-enter the six-phase chain at the right rung (`brownfield.md`): typically Architect
(reconstruct boundaries and ports) then Govern (retrofit the threat model, evaluation, observability),
proving each on real behavior before touching anything.
