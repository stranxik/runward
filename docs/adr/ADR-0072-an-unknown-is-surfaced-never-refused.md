# ADR-0072 — An unknown is surfaced, never refused

**Date**: 2026-09-11
**Status**: accepted 2026-09-11 (this states a rule the product already follows in three places and
that two investigations proposed to break; writing it down is the decision)
**Deciders**: the maintainer
**Method**: measured on the placeholder exoneration and on the register's own history

## Context

Two axes of the 2026-09-11 investigation independently proposed the same fix, and it would have made
the product worse.

The observation is real: `runward/runbook.md` crosses its gate with four contacts reading `UNKNOWN`,
and `handover.md` accepts a bracketed placeholder where it refuses an honest sentence. The proposed
fix in both cases was to REFUSE the unknown: make `UNKNOWN` a violation, make the placeholder a
violation.

The register already records, twice, what that does. **RWD-2026-0020**: *"The gate punished
precision: writing the more precise form was worse than writing the vaguer one."* **RWD-2026-0046**:
*"Deleting five characters from a pointer turned a refusal into a pass — the vague spelling was the
one that passed."* Both are the same shape: a guard that makes honesty more expensive than vagueness
trains the operator to be vague. Refusing `UNKNOWN` completes that training, because the operator
who does not know the on-call contact has exactly two moves left, and only one of them costs
nothing: invent a name.

A third instance was measured the same day and is the sharper one: `handover.md`'s condition
EXONERATES a cell matching `/^\[/`. So `[to be named]` passes and *"no successor has been named; the
maintainer carries this alone"* does not. The incentive is not merely absent, it is inverted.

## Decision

**Ratified**:

1. **A declared unknown is never refused for being unknown.** `UNKNOWN`, `none`, `not yet named` and
   their kin are legitimate answers; the gate's business is that the question was answered, not that
   the answer is comfortable.
2. **A declared unknown is DISCLOSED, by name, everywhere the verdict is published** — the run, the
   machine payload, and the delivery report an assessor reads. An unknown that only the operator
   sees is the silence this project refuses (the ADR-0060 posture: legitimate in real cases, never
   silent).
3. **No exoneration may make a placeholder cheaper than a sentence.** Where a condition today
   forgives `/^\[/`, it stops forgiving it: the bracketed scaffold is the one thing that is NOT an
   answer. Honesty must never be the more expensive spelling.

## Alternatives discarded

- **Refuse the unknown.** Measured above by the project's own history, twice. It buys a greener
  manifest and a less true one.
- **Keep exonerating brackets and refuse UNKNOWN.** The worst of both: the scaffold passes, the
  confession fails.
- **Say nothing and let the operator decide.** That is the current state for the contacts, and it
  means an assessor reads a crossed gate over four unknowns without being told.

## Consequences

- **Positive**: the product stops training vagueness; the assessor learns what is not known, which
  is information they can price; and the inverted incentive in `handover.md` is closed.
- **Negative, accepted**: some missions will publish a report that says, in writing, that four
  contacts are unknown. That is the point, and it is the honest cost of rule 2.
- **On other boundaries**: nothing in the verdict path changes for rule 1 or 2 (they are disclosure);
  rule 3 makes one condition stricter and can turn a green mission amber, so it lands behind the
  structure-contract opt-in like every other hardening (ADR-0069).

## What would settle it

After rule 2 ships: a mission with unknown contacts must produce a report in which a reader finds
the unknowns without being told to look for them. And after rule 3: the honest sentence passes where
the bracketed placeholder does not, measured as a pair — the inversion, righted.

## Reevaluation trigger (mandatory, dated)

An operator reports that the disclosure of unknowns made their report unusable with a stakeholder
(the disclosure is then too loud, not wrong), or a new guard is added that refuses an unknown
without offering a cheaper honest form.

**Trigger set on**: 2026-09-11 · **Watched via**: the register's `wrong-guidance` class and the
pilot's report reading
