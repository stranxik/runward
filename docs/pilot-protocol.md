# Pilot protocol — the exit from zero third parties, pre-registered

**Committed**: 2026-08-17 · **Status**: pre-registered, no data exists · **Governs**: the first
measured pilot of [ADR-0052](adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md)
decision 2 · **Named third party**: _to be filled at selection — the protocol does not change with
the name_

This document is committed and dated BEFORE any pilot data exists; the git history is the proof.
That is not ceremony. runward's own thesis says a verdict is opposable only when the judged party
does not manufacture the judge — and a pilot whose protocol, questionnaire or failure criterion is
written after the numbers are known is exactly a judge manufactured by the judged. So the
judge-and-party logic is applied to ourselves: everything that could bend under an unfavourable
result is fixed here, first. Changing this protocol after data exists voids the pilot; run a new
one under a new dated protocol.

## What the pilot measures, and what it does not

**Measured**: the cost of a handover. One named third party, one brownfield repository the runward
maintainer did not write, no production stakes required. The question is whether the method's
artifacts (characterization, retro-documented mission, the gated evidence trail) make the
repository materially cheaper for a stranger to answer for.

**Not measured, by design**: price (the "evidence pack" invoice line is a separate, later test —
the study of 2026-07-22); code quality (GATE_NON_SCOPE applies to the pilot as to the gate);
production behaviour (no production stakes are required, so none are claimed).

## Roles

- **The third party's engineer** answers the questionnaire and scores it — both times. The runward
  maintainer NEVER scores, never sits in the room during the timed runs, and sees the scores only
  after both measures are recorded.
- **The runward maintainer (the operator)** performs the intervention between the two measures and
  logs every hour spent on it. That log is part of the published result: the failure criterion
  consumes it.

## The instrument — sixteen fixed questions

The questions an acquirer or an auditor actually asks of a repository they must answer for. The
engineer answers each FROM THE REPOSITORY ALONE (no calls, no chat with the authors), notes where
the answer lives, and clocks the time. The list is frozen; a pilot that edits it is a new pilot.

1. What problem does this system exist to solve, and what is its observable success criterion?
2. Which load-bearing architecture decisions were taken, when, and why — and where is each recorded?
3. For the three most structural decisions: which alternatives were rejected, and why?
4. Where does the model (or any non-deterministic component) sit, and behind which stable contract?
5. What happens when the model provider is down or degraded — what is the fallback, and where was
   that decided?
6. Where is the threat model, and which of its threats are constrained by construction rather than
   watched for?
7. By what path can untrusted input reach a sensitive tool, and what stands between them?
8. How do you restart the system from nothing, and where is that written?
9. What breaks first under load or failure, and how would you know (what is instrumented)?
10. Which secrets does the system use, where do they live, and how are they rotated?
11. What is tested deterministically versus evaluated continuously, and where are the rubrics?
12. Who answers for what — which human owns which decision surface?
13. What would a new maintainer need in order to redo a real task without the original author, and
    is there evidence anyone has done it?
14. Which dependencies are pinned, which float, and where was that decided?
15. What evidence exists that the declared rules and practices were actually applied — not merely
    claimed?
16. If this repository were audited against a named regime tomorrow, what could be handed over
    today, and what is known to be missing?

**Scoring, per question** (by the third party's engineer, both runs):
- `answered` — found, with the pointer to where it lives, in under the time box;
- `partial` — an answer exists but is incomplete, stale, or contradicted elsewhere;
- `unanswered` — not found, or only answerable by asking a human.
- Time is clocked per question; the time box is 30 minutes per question, 8 hours total. Reaching a
  box stops that question at its current score.

## The instruments, committed before any data

The questionnaire above is the content; these are the artifacts it is filled into. They are
committed now, empty, for the same reason the protocol is: an instrument shaped after the numbers
are known is an instrument shaped by them.

| File | Filled by | When |
|---|---|---|
| [`pilot/scoring-sheet.md`](pilot/scoring-sheet.md) | the third party's engineer | once per run — one copy BEFORE, one copy AFTER, the sheet itself unchanged between them |
| [`pilot/operator-log.md`](pilot/operator-log.md) | the runward maintainer | continuously during the intervention, committed as the hours accumulate |
| [`pilot/result-template.md`](pilot/result-template.md) | both, at the end | once, and published whichever way the numbers point |

Two properties of that set are load-bearing. The sheet is **identical for both runs** — a
questionnaire that moves between the two measures makes the two numbers incomparable, which is the
one way this instrument fails quietly. And the operator log is committed **as the hours are spent**,
so its git history is the evidence that `O` was not reconstructed once `T_after` was known: `O` is
half the failure criterion, and a number produced after the fact could always be produced small
enough.

## Procedure

1. **BEFORE.** The engineer runs the questionnaire on the repository as it stands. Recorded:
   `T_before` (total hours), `U_before` (count of `unanswered`), `P_before` (count of `partial`),
   and the per-question sheet.
2. **Intervention.** The operator runs the method on the same repository: `runward characterize`,
   the retro-documented mission (framing, architecture, topology, governance, handover as they
   actually are — never as they should be), the conformance manifests with typed evidence,
   `runward check --strict` to green or to an honestly recorded red. Recorded: `O` (operator hours,
   logged as they are spent, committed with the artifacts).
3. **AFTER.** The same engineer re-runs the same questionnaire on the repository with the mission
   in it. Recorded: `T_after`, `U_after`, `P_after`, the sheet.
4. Both sheets, the operator log, and the verdict below are published together.

## The failure criterion, written before any data

The pilot **counts against the method**, and is published as such, if either:

- `U_after >= U_before` — the artifacts did not reduce the unanswered questions; or
- `(T_before - T_after) < O` — the hours saved for the stranger are fewer than the operator hours
  spent producing the artifacts. A method that costs its operator more than it saves its inheritor
  has, on this repository, failed its own definition of a handover.

Anything else counts for the method exactly as far as the numbers go, and no further: one pilot is
one data point, on one repository, with one engineer — the publication says so in those words.

## Publication commitment

The result is published whichever way it points — the numbers, both sheets, the operator log, and
the repository's identity to the precision the third party permits (fully named, or described by
size/stack/age if the party requires anonymity). This is the "results that count against us" line
of [regulated-adoption.md](compliance/regulated-adoption.md), applied before the fact. Suppressing
an unfavourable result voids more than the pilot.

## Volunteering

A team that wants to be the one opens
[the pilot candidate form](https://github.com/stranxik/runward/issues/new?template=pilot_candidate.yml).
It is a GitHub issue form on purpose: runward operates no service and collects nothing, so the
invitation runs on the same infrastructure as the rest of the project — a public repository. The
questions are versioned beside this protocol, which means they are pre-registered too: a candidate
can read exactly what they will be asked before asking anything of us.

The form states the cost before the benefit (one engineer, up to 8 hours boxed, twice), carries the
three non-negotiable terms as required checkboxes rather than prose, and names the losing outcome —
a candidate who has not read that the pilot may count against the method has not really volunteered.

## Candidates (from ADR-0052; the selection is the author's, recorded when made)

- **eXalt** — through the existing contact; the natural first ask.
- **The HN funnel** — once a launch lands; any engineer with a brownfield repo and an hour-boxed
  curiosity qualifies.
- **Bpifrance** — measures usage and credibility, never price (study of 2026-07-22), and any pilot
  there stays outside the consulting mission's perimeter (no judge-and-party on the day job).

One dependency, already met: a team pilot hits, on day one, the need for a CI construction mode —
`check --strict --through <phase>` shipped and was ratified as
[ADR-0053](adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md) (0.34.0), so the
pilot does not stall on it.

## What this protocol does not claim

- It does not make the pilot a certification, a benchmark of tools, or a statement about any
  repository other than the one measured.
- It does not pay anyone: this is the credibility pilot; the price test (the invoice line) is a
  separate, later decision with its own trigger (ADR-0052 decision 3).
- It does not survive edits: the protocol's integrity IS its commit date. Amendments before a
  third party is engaged are ordinary dated commits; after engagement, the protocol is frozen and
  a change means a new pilot.
