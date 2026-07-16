# ADR-0020: Rule evidence signatures — an opt-in deterministic content predicate

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — factual multi-agent audit of the gate, replay of the founding incident (ADR-0001) against the typed-pointer layer, challenge on false-positive risk, durable position

## Context

The founding incident: an agent **cited** `frontier-deterministic-boundary` and shipped no grounding guard; the gate passed green. Typed pointers (ADR-0019) close the hollow-trace hole — the evidence now provably exists and is non-empty — but they still cannot say whether the pointed content has anything to do with the rule. A pointer at a real, non-empty, unrelated file passes.

The full "does it truly implement the rule?" judgment is semantic and stays out of the deterministic gate forever (ADR-0001, ADR-0007). But there is a deterministic middle that no ADR has claimed yet: some rules carry an **executable specification** whose load-bearing tokens are named in the rule text itself. `frontier-deterministic-boundary` prescribes `assertGrounded`, a `GroundingError`, a guard that "fails closed". If the cited evidence contains none of those shapes, the citation is not credible — and a grep can say so.

## Decision

A rule may declare, in its frontmatter, an optional **`signature:`** — an ECMAScript regular expression (compiled case-insensitive) that the evidence of an `applied` row must match.

- **Semantics.** For an `applied` row of a signed rule, at least one evidence file that resolves (typed `file:`/`test:` pointer or path token) must contain a match for the signature. Declaring a signature therefore makes file-backed evidence mandatory for `applied` rows of that rule — that is the point of signing it. `deviated` and `n/a` rows are untouched.
- **Blocking under `--strict`.** A signed rule marked `applied` whose evidence matches nowhere is a violation, with the signature shown in the message so the fix is legible.
- **Still a grep, never a judgment.** The check upgrades "a pointer exists" to "the pointer points at something that has the rule's shape". Whether the shape is honest remains the operator's call at the gate, plus the adversarial `verify` workflow (ADR-0007). Zero LLM, zero execution, zero network — unchanged.
- **Shipped conservatively.** One flagship signature ships: `frontier-deterministic-boundary`, whose own executable spec names its tokens. Signatures are added rule by rule, each justified by tokens the rule text itself prescribes — never wholesale. A wrong signature is a false red, and false reds erode the gate faster than any gap. Operators own their mission's `runward/rules/` copy (read first by the gate) and may add, tighten or drop signatures there.

## Alternatives discarded

- **An LLM judging cite-vs-apply in the gate.** Rejected by invariant (ADR-0001); it already exists in the right place, advisory and agent-executed (ADR-0007).
- **Signatures on every CRITICAL rule at once.** Most rules have no canonical token (`hexa-architecture` matches no grep); forcing one manufactures false reds. Coverage grows only where a rule genuinely prescribes its shape.
- **A separate signatures file** (predicates decoupled from rules). Splits a rule from its own predicate — the frontmatter is the rule's contract surface, versioned and migrated with it (ADR-0006).

## Consequences

- **Positive.** The founding incident is now caught deterministically end-to-end: cite `frontier-deterministic-boundary`, point at code with no guard shape, and `--strict` turns red. The credibility claim "the gate verifies the shape of the evidence" becomes true, not aspirational.
- **Negative, accepted.** A signature can be gamed by pasting the token into a comment — the gate raises the cost of the lie, it does not abolish lying; the operator still reads pointers. Signature maintenance follows rule evolution (a renamed guard idiom means a rule edit).
- **On other boundaries.** `parseRuleMeta` learns `signature:`; the evidence layer (ADR-0019) gains the match pass; the rule-authoring documentation and the floor workflow explain when a rule earns a signature.

## Reevaluation trigger (mandatory, dated)

Reopen if a shipped signature produces a confirmed false positive on a legitimate implementation (fix or drop that signature immediately; reconsider the mechanism if it recurs), or if signatures spread to rules whose text does not prescribe their tokens — scope creep toward pseudo-semantic checking the gate must not claim.

**Trigger set on**: 2026-07-16 · **Watched via**: the conformance-gate incident log and each rule-set release review.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the incident this closes deterministically; the invariant this respects.
- [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md) — where the semantic judgment lives, unchanged.
- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) — the pointer layer this predicate reads through.
- `templates/rules/frontier-deterministic-boundary.md` — the flagship signed rule.
