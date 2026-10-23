# ADR-0099 — Which regime lenses come after the three AI ones (CRA, NIS2, DORA, GDPR), and where each belongs

**Date**: 2026-10-22
**Status**: accepted (2026-10-23) — the maintainer chose, regime by regime: D for GDPR and NIS2 (a documentation crosswalk, no pack), C for DORA (a lens of the D3 period report, when D3 is built), A for the CRA. B (a pack per regime) is not taken for any of the four
**Deciders**: the maintainer
**Method**: an adopter's finding, re-checked by the adopter against runward 0.44.1 on 2026-10-22; read
against a fresh clone of `stranxik/runward` at `main@de61beb` (0.44.1): `regimes/` (four files),
`src/lib/regimes.ts` (`loadRegime`, `RegimeMapping`), `src/commands/compliance.ts` (the regime table),
`src/lib/compliance.ts` (the draft headers), ADR-0015, 0016, 0022, 0032, 0080, 0088 and 0093. No
primary text of the four regimes was read for this record: the readings of DORA cited below are
ADR-0080's and ADR-0088's, dated there
**Relates to**: [ADR-0022](ADR-0022-regime-mappings-as-versioned-data.md) (regime mappings as versioned
data), [ADR-0015](ADR-0015-regulatory-conformance-as-a-regional-profile.md) (a regime is a dated
lens), [ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md) (the pack assembler and its
provenance guardrails), [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(D3, the period report), [ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md)
(the regulated tier)

## Context

**What was reported.** Adopters who deliver to regulated clients are asked about lenses runward does not
ship: the Cyber Resilience Act (Regulation (EU) 2024/2847), NIS2 (Directive (EU) 2022/2555), DORA
(Regulation (EU) 2022/2554 and its delegated regulation 2024/1774) and the GDPR (Regulation (EU)
2016/679). In this record "DORA" is the EU regulation; it is not the DevOps delivery metrics that
`runward-change-row/1` (ADR-0093) offers join keys for.

**What the tree ships.** `regimes/` holds four files for three regimes: `eu-ai-act@2024-1689.json`,
`eu-ai-act@2026-1744.json`, `iso-42001@2023.json`, `nist-ai-rmf@1.0.json`. Each carries the part of a
lens that tracks a dated external text (clause references, the operator-required list, a `reviewBy`
date the `watch external facts` workflow reads) and nothing else (ADR-0022). A lens is not only data:
`src/commands/compliance.ts` maps each regime to its own render function (`renderIso42001Readiness`,
`renderEuAiAct`, …), and every draft opens on "Draft, incomplete — not a compliance claim" or "not a
conformity assessment". The `RegimeMapping` shape (`clauses`, `annexIv`, `crosswalk`, `highRisk`) was
cut for AI-governance texts.

**Why DORA is not like the other three.** What DORA asks of change management, as ADR-0080 and ADR-0088
read it, is about every change: art. 9(4)(e) asks that all changes to ICT systems be "recorded, tested,
assessed, approved, implemented and verified in a controlled manner", and RTS 2024/1774 art. 17(1)
applies "in respect of all changes". A `compliance` pack is assembled from one tree at one commit; it
cannot say anything about all changes of a period. The period report planned in ADR-0093 (D3,
`runward-period/1`) counts per verb and state over bounds in commits, with each denominator and the list
it counts, `effectiveness: not-assessed-by-runward` and an empty `management_approval`: the shape a
DORA reading needs, and the place where a DORA lens would read it. ADR-0088 already says runward's own
delegation "is not a DORA change-approval control".

**What each of the other three would map, at most.** Stated as questions, because no primary text was
read for this record: the CRA's essential requirements and vulnerability handling for a product with
digital elements; NIS2's risk-management measures, which reach an entity through a national
transposition runward cannot track per member state; the GDPR's data protection by design and the
security of processing, of which a delivery repository holds evidence of design decisions and none of
the processing itself. Each is a lens over the same evidence the mission already carries; none adds a
gate.

## Decision

**Decided (2026-10-23).** Regime by regime. **GDPR and NIS2: D**, a crosswalk page each, saying which
runward artefacts an entity may cite for which provision, with the provisions runward does not touch
named; requested by one adopter preparing regulated deployments, and cheap enough not to wait for a
second. For NIS2 the page maps the directive, never a transposition. **DORA: C**, written when D3
starts, because DORA speaks of all changes of a period, not of one tree. **CRA: A** until an adopter
asks. **B is not taken** for any of the four: a pack with runward's name on it is the overclaim ADR-0015
and ADR-0016 guard against, and the trigger (two unrelated adopters asking for the same regime) is not
met. Each crosswalk page gets a review date the `watch external facts` workflow reads.

The options as proposed on 2026-10-22: **for each of the four, one of the placements below**, chosen regime by regime by
the maintainer on the evidence under "What would settle it". Until then the tree keeps A.

- **A. Three AI lenses only (the tree today).** Cost: zero. An adopter maps CRA, NIS2, DORA or GDPR
  requirements to its evidence by hand, outside runward, and the pack it shows a client says nothing
  about them.
- **B. A `compliance` pack per regime, under ADR-0022.** A `regimes/<regime>@<version>.json` file and a
  renderer for each, with its operator-required list and its "not a compliance claim" header. Cost per
  regime: a dated reading of the primary text, recorded in the file's `notes` and kept by `reviewBy`; a
  renderer and its tests; a check that the shape fits, since ADR-0022's own trigger is "a regime's
  structure stops fitting the shared data shape"; and, for NIS2, a statement that the lens maps the
  directive, never a transposition. The risk is the one ADR-0015 and ADR-0016 guard against: a pack with
  runward's name on it read as the entity's conformance.
- **C. DORA as a lens of the period report (ADR-0093 D3), not as a pack.** The period report gains a
  section that maps its counts to the DORA provisions it can speak to (all changes recorded and approved,
  independence of approval as ADR-0080 Part 2 records it) and lists, as operator-required, what it
  cannot (the entity's ICT risk framework, management approval, the effectiveness assessment). Cost:
  waits for D3; ties DORA wording to `runward-period/1`, so a revision of either moves the other; and the
  same overclaim risk as B, sharper because a period count looks like a control test.
- **D. A crosswalk in the documentation only.** A page per regime saying which runward artefacts an
  entity may cite for which provision, with no command and no data file. Cost: low; nothing reads it, so
  it ages silently unless the `watch external facts` workflow is given a date for it.
- **E. Lenses written by adopters, outside the package.** Cost: ADR-0022 discarded mission-level regime
  files because a silently edited mapping with the package's name on it is a provenance leak; this would
  reopen that alternative and needs its own record.

The four regimes need not take the same option: C is written for DORA only, and B or D fit the other
three differently.

## Alternatives discarded

- **A "conformant" or "compliant" verdict for any regime.** runward reads a delivery repository; it does
  not assess an entity. Every lens, in every option, is an input to the entity's work and says so.
- **Fetching regulatory texts or updates at run time.** Zero network in the gate (ADR-0022, ADR-0054).
- **One generic "EU regulation" lens covering the four.** The texts differ in subject (a product, an
  entity, a financial entity's ICT, personal data processing) and in date; one lens would map none of
  them precisely.

## Consequences

- B and C each add a dated text runward has to keep current, with a `reviewBy` the external-facts watch
  reads; the cost recurs.
- C makes D3 carry a regulatory wording; the period report's own acceptance test (byte-identical across
  runs) holds the lens to the same determinism.
- Whatever is chosen, the README and every pack keep "not a compliance claim"; a new lens adds no claim
  class to the claims guard and must pass it.

## What would settle it

- **For A**: no adopter asks again within the trigger period, or adopters who asked are served by D.
- **For B, per regime**: two or more adopters, unrelated, asking for the same regime for a delivery, a
  dated reading of its primary text, and a maintainer willing to keep the file current.
- **For C**: D3 built, and an adopter's DORA reviewer reading a period report and naming the provisions
  it helps with and the ones it must not be read as covering.
- **For D**: adopters for whom a citation table is enough, with no command needed.
- **For E**: an adopter needing a regime runward will not ship, and a provenance rule that keeps runward's
  name off a mapping runward did not write.

## Reevaluation trigger (mandatory, dated)

Reopen when D3 of ADR-0093 starts, when a second unrelated adopter asks for the same regime, when one of
the four texts reaches a dated application milestone that an adopter cites, or on 2027-01-22, whichever
comes first.

**Trigger set on**: 2026-10-22 · **Watched via**: issues mentioning a regime, a lens or a pack, and the
ADR-0093 delivery plan in the ROADMAP.

## Notes

- **2026-10-22.** The adopter who reported this finding asked again for GDPR and NIS2, because it means to
  deploy in regulated settings (on premises or partly so). That is one adopter asking, not two
  unrelated ones: it does not meet the trigger above, and it is recorded so the second request, if it
  comes, is counted against it.

## References

- `regimes/` and `src/lib/regimes.ts` (ADR-0022), `src/commands/compliance.ts` (one renderer per regime).
- ADR-0080 and ADR-0088: the dated readings of DORA art. 9(4)(e) and RTS 2024/1774 art. 17(1).
- ADR-0093, decision 6: `runward-period/1`.
