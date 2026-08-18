# Pilot scoring sheet — one run

**Fill one copy per run.** The BEFORE run and the AFTER run use this same sheet, unchanged: a
questionnaire that moves between the two measures makes the two numbers incomparable, which is the
one way this instrument can quietly fail.

- **Run**: `BEFORE` / `AFTER` (delete one)
- **Repository**: ………
- **Scored by**: ……… (the third party's engineer — never the runward maintainer)
- **Date**: ………
- **Time box**: 30 minutes per question, 8 hours total. Reaching a box stops that question at its
  current score, and that is a result, not a failure.

## How to score

Answer each question **from the repository alone** — no calls, no chat with the authors, no
searching outside the checkout. Then:

- `answered` — found, with the pointer to where it lives, inside the time box;
- `partial` — an answer exists but is incomplete, stale, or contradicted elsewhere;
- `unanswered` — not found, or answerable only by asking a human.

Record **where** you found it even when the answer is partial: the location is what makes the score
auditable by someone who was not in the room.

## The sheet

| # | Question | Score | Where the answer lives | Minutes |
|---|---|---|---|---|
| 1 | What problem does this system exist to solve, and what is its observable success criterion? | | | |
| 2 | Which load-bearing architecture decisions were taken, when, and why — and where is each recorded? | | | |
| 3 | For the three most structural decisions: which alternatives were rejected, and why? | | | |
| 4 | Where does the model (or any non-deterministic component) sit, and behind which stable contract? | | | |
| 5 | What happens when the model provider is down or degraded — what is the fallback, and where was that decided? | | | |
| 6 | Where is the threat model, and which of its threats are constrained by construction rather than watched for? | | | |
| 7 | By what path can untrusted input reach a sensitive tool, and what stands between them? | | | |
| 8 | How do you restart the system from nothing, and where is that written? | | | |
| 9 | What breaks first under load or failure, and how would you know (what is instrumented)? | | | |
| 10 | Which secrets does the system use, where do they live, and how are they rotated? | | | |
| 11 | What is tested deterministically versus evaluated continuously, and where are the rubrics? | | | |
| 12 | Who answers for what — which human owns which decision surface? | | | |
| 13 | What would a new maintainer need in order to redo a real task without the original author, and is there evidence anyone has done it? | | | |
| 14 | Which dependencies are pinned, which float, and where was that decided? | | | |
| 15 | What evidence exists that the declared rules and practices were actually applied — not merely claimed? | | | |
| 16 | If this repository were audited against a named regime tomorrow, what could be handed over today, and what is known to be missing? | | | |

## Totals for this run

| | Value |
|---|---|
| `T` — total hours | |
| `U` — count of `unanswered` | |
| `P` — count of `partial` | |
| `A` — count of `answered` | |

## Free remarks (optional, and welcome)

Anything the scores cannot carry: a question that was ambiguous, an answer found in an unexpected
place, a moment where the repository actively misled you. These are the most useful lines in the
sheet and they are the ones no metric replaces.
