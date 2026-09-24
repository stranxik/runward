# ADR-0078: The domain core is a category, and one written absence of territory is reopened

**Date**: 2026-09-24
**Status**: accepted 2026-09-24 — the maintainer handed the open question of [ADR-0077](ADR-0077-rules-for-shows-what-the-mission-already-cited-a-reminder-not-a-territory.md) back to be investigated to a conclusion rather than arbitrated; this is that conclusion
**Deciders**: the maintainer
**Method**: each candidate rule read in full against the criterion ADR-0043 set for a category, and the written absences dated against the carrier they answered

## Context

ADR-0077 left one question open: a `domain-core` category would reach the files a citation never
can — a file nobody instructed yet, above all a new one — but the rules it would attach to had each
declared, in writing, that they carry no territory. Reopening a written decision is the cost
[ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) says must never
be paid silently, so the question was: does any of those decisions actually object to a category?

**Dated, the answer changes.** All 64 absences were written on 2026-07-31 at 11:21
(`feat(rules): declared absence of territory, and the editorial pass over all 64 rules`). The
category carrier arrived the same day at 16:45 ([ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md)
tiers 1-2), and its delivery gave `governs:` to the nine rules that **already** had a glob. The fifty
written absences were never re-read against the new carrier: ADR-0043 named reopening them as a cost
and did not examine whether any needed it. So every `noTerritory:` reason answers the question "which
glob?", and only some of them also answer "which subject?".

**Read against ADR-0043's criterion** — a category is a class of artifacts a shipped rule's own text
is about, added when a rule needs it, never by quota — the candidates split cleanly:

- **`hexa-architecture`** (HIGH). Its text prescribes the inner hexagon by name — `core/`, "UNTOUCHABLE
  - Pure business logic", and the dependency rule "Core never imports from adapters. Adapters implement
  ports defined in core." Its absence reads: "any glob broad enough to be true would be `**`, which
  states nothing." That objects to a **glob**, and it is right about globs: `core/` is one project's
  spelling. It says nothing against a category, which is exactly the object ADR-0043 built so that a
  rule names the subject and the mission names the files.
- **`hexa-move-deterministic-out`, `frontier-deterministic-boundary`** (CRITICAL). Their subject is the
  split between model and program, "wherever a load-bearing value is produced". In the example mission
  that happens to be a domain file; in general it is not a layer. Not `domain-core`.
- **`security-prompt-injection`, `security-human-agent-trust`**. Their reasons are about the shape of the
  whole system and of every output, not a class of files — substantive, and unchanged.
- **`hexa-typescript-native`, `contracts-governance`** mention the core, and their absences are
  substantive too ("judged on the imports of the whole codebase"; "a territory on the ports alone would
  declare less than the rule governs"). Unchanged.

## Decision

**`domain-core` joins the closed vocabulary, and `hexa-architecture` governs it.**

- **The category**: the inner hexagon — domain, use cases and the port interfaces the core owns; code
  that must import nothing from adapters. No deployment manifest can know which files those are, so
  it is only ever bound by the mission map (`runward/territory.md`), never derived.
- **The rule**: `hexa-architecture` replaces its `noTerritory:` with `governs: [domain-core,
  port-adapter]` — the two layers its dependency rule names. It carries no glob, which is the point.
  It is the first shipped rule whose territory is a category alone; `governs:` is a declared territory,
  and the "every rule is ruled on" guard now says so.
- **One written decision is reopened, and only one.** The other six candidates keep their absence, for
  the reasons above. The four rules the example mission cites on `guard.ts` stay reachable through
  ADR-0077's citation section — a reminder, which is what they warrant.
- **The example mission carries a map.** Its `runward/territory.md` binds `code/src/core/{domain,
  application,ports}/**` to `domain-core`. ADR-0043 says runward never writes this file for a mission;
  the example's tree is runward's own, so its map describes runward's layout, never an operator's, and
  it shows the tier-3 mechanism working instead of describing it.

**Measured**, in the example mission: `rules --for code/src/core/domain/guard.ts` matches
`hexa-architecture` through `runward/territory.md:9`, and so does a core file that does not exist yet.
Without the map line, `domain-core` is reported unresolved — a missing binding, never an empty answer.

## Alternatives discarded

- **Attach `domain-core` to the four cited rules.** Rejected: their subject is not the domain core, and
  a category that made them surface on every core file would be the false positive ADR-0043 split
  `secret-boundary` out of `configuration` to avoid.
- **Leave the fifty absences as written.** Rejected for this one rule: an absence that answers a
  question the carrier no longer asks is a stale decision, and keeping it would keep a rule whose text
  names the core unreachable from the core.
- **Re-read all fifty now.** Deferred, not refused: this ADR re-read the seven that bear on the core.
  The rest is named in the reevaluation trigger.

## Consequences

- **Positive.** A new file in the core surfaces the rule that governs the core — the half ADR-0077's
  citation section cannot reach — with the map line that bound it.
- **Negative, accepted.** It depends on the mission writing one map line; without it the category is
  unresolved and says so. The rule set's declared-territory count moves from 14 to 15, and
  `unscoped.count` from 50 to 49.
- **On other boundaries.** The gate is untouched: `governs:` is read by `--for` only.

## Reevaluation trigger (mandatory, dated)

Reopen if a mission reports `domain-core` surfacing `hexa-architecture` where its dependency rule does
not apply (a false positive), or if field use shows missions do not write the map line. Separately,
the forty-nine remaining absences were written against globs only: re-read them against the category
carrier the next time a rule is reported unreachable from files its text is about.

**Trigger set on**: 2026-09-24 · **Watched via**: `rules --for` field reports and `characterize`'s
territory-coverage section

## References

- [ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md) — the category carrier and its criterion.
- [ADR-0077](ADR-0077-rules-for-shows-what-the-mission-already-cited-a-reminder-not-a-territory.md) — the question this settles.
- `test/unit/rules-for-domain-core.test.js` — guard.ts, a not-yet-written core file, an adapter, and the unmapped case.
