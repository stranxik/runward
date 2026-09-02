# ADR-0068 — One maintained minor, and a dated release train

**Date**: 2026-09-03
**Status**: proposed
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

**Proposed**:

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
