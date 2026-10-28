# ADR-0068 — One maintained minor, and a dated release train

**Date**: 2026-09-03
**Status**: accepted 2026-09-09 (ratified on the maintainer's order, two days after 0.38.0 shipped — the first supported-lines table below is this policy's first act; the first post-bump security release remains the measurement that settles it)
**Deciders**: the maintainer
**Method**: measured against the repository's own published statements, which contradict each other

## Context

Two published documents give a regulated adopter opposite instructions. `SECURITY.md` states:
*"Only the latest published version receives security fixes."* `docs/distribution.md` states that
pinning *"is the operator's call, and it is the safer default for a regulated pipeline."* Both are
individually reasonable, and together they are a trap: the operator who follows the distribution
advice — pin — is exactly the operator the security policy then abandons, running a version that
will never receive a fix. The 2026-09-02 product investigation (ATTENTES-ENTREPRISES) named this
contradiction the cheapest credibility gap on the enterprise checklist, because a procurement
security review reads both files in its first hour.

The release cadence itself has been high — 0.30 to 0.37 in under a month — which is healthy for a
product under construction and unreadable for an adopter who must requalify what they run. What an
enterprise expects is not slowness; it is a STATEMENT: which version is safe to stand on, for how
long, and when the ground moves.

## Decision

**Ratified**:

1. **One maintained minor at a time.** The latest published minor is the maintained one. When a new
   minor ships, the PREVIOUS minor keeps receiving security fixes — and only security fixes — for
   **six months** from that day. Two supported lines, never more: the moving edge and the last
   ground. `SECURITY.md`'s supported-versions table states both, with dates.
2. **A dated release train.** Feature releases group into a train (target: every two to four
   weeks, dated in the CHANGELOG). Security fixes are exempt from the train — they ship when
   ready, to both supported lines. The cadence of FIXING does not change; only the cadence of
   PUBLISHING features becomes legible.
3. **The pinning advice becomes coherent.** `docs/distribution.md` recommends pinning the
   maintained minor (not an arbitrary version), and says what the operator is buying: six months
   of security fixes without requalification.

## Alternatives discarded

- **Latest-only, stated louder.** Honest and cheap, but it makes pinning — the advice the product
  itself gives regulated adopters — a security liability. A policy that contradicts the product's
  own distribution guidance is not a policy.
- **Long-term support lines (N minors, 12+ months).** The team is one person; promising an LTS
  matrix nobody can staff is the overclaim this repository exists to refuse. Six months on one
  previous minor is the largest honest promise available today.
- **No train, keep shipping continuously.** Kept for fixes; discarded for features, because the
  requalification cost lands on the adopter every time, and eight minors in a month is a cost no
  procurement review prices kindly.

## Consequences

- **Positive**: the two documents stop contradicting each other; a regulated adopter can pin with
  a stated guarantee; the 1.0 question gains its prerequisite (a version contract is what 1.0
  means).
- **Negative, accepted**: backporting security fixes to one previous minor is real work on a
  one-person team, bounded to six months and to security only.
- **On other boundaries**: nothing touches the verdict path or the runtime boundary (ADR-0054);
  this is a publishing policy, not a product surface.

## What would settle it

The first security fix released after a minor bump: it must land on both supported lines within
the coordinated-disclosure window, and the effort must be small enough that it actually happens.
If the backport is skipped once, the policy is theatre and this ADR reopens toward latest-only,
stated as loudly as the failure deserves.

## Reevaluation trigger (mandatory, dated)

A second maintainer joins (the LTS alternative becomes staffable), or the first backport is
skipped, or an adopter's procurement review rejects the six-month window as insufficient — any of
the three reopens this.

**Trigger set on**: 2026-09-03 · **Watched via**: the first post-bump security release, and the
pilot's procurement questions (ADR-0052)

## Note, 2026-10-28: the backport was skipped, and the policy moves to latest-only

Recorded so a reader of this record finds what replaced it; the decision above is not rewritten. The
maintainer decided; an agent wrote this note (ADR-0088 decision 4, applied to decisions as to rows).

**What was measured.** "What would settle it" asked that the first security fix released after a
minor bump land on both supported lines. It never did. Every fix with a published advisory released
after this record was ratified, fourteen from 0.39.0 to 0.44.1, shipped on the latest line only, and
no older line received a release (GitHub releases and the npm registry, read 2026-10-28). The two
found after [ADR-0086](ADR-0086-security-advisories-and-a-fix-time-target.md) made backporting the
default where a fix applies without rework are RWD-2026-0165 (S1, fixed in 0.43.1) and RWD-2026-0168
(S1, fixed in 0.44.1); their advisories say no older line receives a backport. `SECURITY.md`'s table,
meanwhile, stayed at 0.43.x through 0.44.0, 0.45.0 and 0.46.0. This record's own reevaluation trigger
("the first backport is skipped") was met, and its text had said what follows: the policy reopens
toward latest-only, stated as loudly as the failure deserves.

**What is decided.**

1. **Decision 1 is withdrawn.** Only the latest published minor line is supported; no fix is
   backported. The six-month windows promised to 0.37.x through 0.42.x (until 2027-03-07 to
   2027-04-02) end on 2026-10-28, and `SECURITY.md` says plainly that they were not kept.
2. **Decision 2 keeps its train**, and loses "to both supported lines": security fixes still ship when
   ready, outside the train, on the latest line.
3. **Decision 3 changes meaning.** Pinning remains the operator's call for comparable verdicts; it no
   longer buys security fixes, and `docs/distribution.md` says so.
4. A test (`test/unit/packaging.test.js`) fails when `SECURITY.md`'s table does not name exactly the
   package's current minor as supported.

The alternative this record discarded, *Latest-only, stated louder*, is the one now taken, and its
cost stands as that entry describes it: a pinned older version receives no fix. What would reopen
this: a second maintainer (a backport becomes staffable), or an adopter whose procurement requires a
supported previous line; a window is then promised only after one backport has been run through the
release chain (the trial ADR-0086 names under "What would settle it").
