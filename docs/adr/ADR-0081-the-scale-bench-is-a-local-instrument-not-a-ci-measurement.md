# ADR-0081 — The scale bench is a local instrument, not a CI measurement

**Date**: 2026-09-27
**Status**: accepted 2026-09-27 — a correction of fact rather than a new direction: it narrows one sentence of ADR-0075 to what the tree does, changes no behaviour and no verdict, and is ratified by the maintainer's merge
**Deciders**: the maintainer
**Method**: measured on `main` at 0.42.2: `.github/workflows/`, `package.json`, `test/bench-scale.js`
**Refines**: [ADR-0075](ADR-0075-a-required-nature-the-project-cannot-produce.md) decision 3 (the `loadtest` nature). ADR-0075 stays accepted; its decision is unchanged.

## Context

ADR-0075 declared that runward's own mission cannot carry the `loadtest` nature, and gave a reason
with two parts. The first is that a CLI with no endpoint, no session and no concurrency surface gives
k6 and JMeter nothing to address. The second is that `test/bench-scale.js` "measures the question that
does exist … in CI". The first part holds. The second does not.

**Measured, 2026-09-27.**

- `grep -rn "bench" .github/` returns nothing. No workflow runs `test/bench-scale.js` or `npm run bench`.
- `package.json` wires it as `"bench": "npm run build && node test/bench-scale.js"`, outside `npm test`.
- The file says so itself: « This is a measurement harness, not a test: it prints a table and exits 0.
  It asserts nothing about milliseconds (machine-dependent), and it is deliberately NOT in the
  `npm test` path. »

So the sentence gave the declared limit a support it never had: a reader of ADR-0075 would believe the
performance question is re-measured on every push, with a number somewhere a regression would move.
Nothing measures it on a push, and no number is kept. Filed as RWD-2026-0122.

## Decision

1. **The bench is a local instrument.** `npm run bench` answers the monorepo objection on the machine
   of whoever runs it. It is not executed in CI, it has no threshold, it asserts nothing and it keeps
   no result. Its output is an observation, never evidence a row can cite as a measured floor.
2. **ADR-0075's reason for the `loadtest` limit rests on its first part alone.** A CLI with no endpoint
   and no concurrency surface has nothing a load test addresses. That reason is sufficient, and it is
   the only one the declaration now claims. The declaration itself does not move: the nature stays
   declared uncarriable in ADR-0075, stays unmet, and stays listed.
3. **ADR-0075 is annotated, not rewritten.** Its text keeps the sentence as the record of what was
   claimed, with a dated note pointing here, the way ADR-0054 and ADR-0066 carry their amendments.

## Alternatives discarded

- **Run the bench in CI to make the sentence true.** It exits 0 by construction and asserts nothing, so
  a CI step would be green on every regression: a check that cannot fail, added to rescue a sentence.
  A timing threshold on a shared runner would flap, and a gate that flaps is a gate that gets disabled
  (RWD-2026-0113 measured that asymmetry for JUnit).
- **Edit ADR-0075 in place.** An accepted decision is a record; rewriting its reason erases the fact
  that the reason was once overstated, which is the thing a reader auditing the journal needs to see.
- **Supersede ADR-0075.** Its three decisions all stand. Superseding would retire two correct
  decisions to fix one clause of the third.

## Consequences

- **For the `loadtest` nature: nothing changes in the gate.** `check --strict` still reports
  `checklist-pre-production-performance requires loadtest — declared in ADR-0075`. What changes is the
  weight of the declaration: it rests on the absence of a surface, not on a measurement standing in
  for one. If runward grows a concurrency surface, ADR-0075's own trigger fires and the row becomes
  closable; the bench does not delay that.
- **The mission's own row overstates too.** The row for `checklist-pre-production-performance` in
  runward's governance deliverable cites `test/bench-scale.js` as measuring « in CI ». That text lives in
  the mission and is corrected there, by the mission's writer, in its own change.
- **Negative, accepted.** There is still no recorded number for the gate's cost on a large tree. That is
  honest: nothing was recording one before either.

## Reevaluation trigger (mandatory, dated)

Reopen if a workflow starts running `test/bench-scale.js`, if the bench grows an assertion or a kept
result (it then becomes evidence and this ADR is wrong in the other direction), or if a user reports
the gate's cost growing with the size of the repository around a mission.

**Trigger set on**: 2026-09-27 · **Watched via**: `.github/workflows/` and the `bench` script in
`package.json`

## References

- [ADR-0075](ADR-0075-a-required-nature-the-project-cannot-produce.md): the declaration this refines.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md): why no home-made performance report schema.
- `test/bench-scale.js`: the instrument, and its own statement of what it does not assert.
