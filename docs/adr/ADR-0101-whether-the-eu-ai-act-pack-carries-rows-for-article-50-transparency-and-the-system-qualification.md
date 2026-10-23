# ADR-0101 — Whether the EU AI Act pack carries rows for Article 50 transparency and the system's qualification

**Date**: 2026-10-22
**Status**: accepted (2026-10-23) — the maintainer chose B and C: operator-required rows for the system's qualification and Articles 4, 5, 14 and 50 in a new lens file, and the lens's dated notes printed under the draft's header. A and D are not taken
**Deciders**: the maintainer
**Method**: an adopter's finding, re-checked by the adopter against runward 0.44.1 on 2026-10-22; read
against a fresh clone of `stranxik/runward` at `main@c43c6e9` (code identical to 0.44.1):
`regimes/eu-ai-act@2026-1744.json`, `src/lib/regimes.ts` (`RegimeMapping`), `src/lib/compliance.ts`
(`renderEuAiAct`), `docs/compliance/eu-ai-act.md`; the pack generated on the example mission and on an
empty mission. No primary text of the Regulation was re-read for this record: the dates below are the
lens file's own `notes`, dated there
**Relates to**: [ADR-0022](ADR-0022-regime-mappings-as-versioned-data.md) (a lens is versioned data; an
amendment is a new file), [ADR-0015](ADR-0015-regulatory-conformance-as-a-regional-profile.md) (a regime
is a dated lens), [ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md) (the pack assembler
and its provenance guardrails), [ADR-0099](ADR-0099-which-regime-lenses-come-after-the-three-ai-ones-cra-nis2-dora-gdpr-and-where-each-belongs.md)
(the lenses after the AI ones)

## Context

**What was reported.** An adopter whose generated applications mostly call AI providers outside the
high-risk categories noted that the pack says nothing about the obligation that reaches them most
often: Article 50 transparency. The `eu-ai-act` pack it generated cited articles 6, 9, 12, 47, 72 and
113 and Annex IV, and no row for Articles 4, 5, 14 or 50.

**What the tree ships.** `regimes/eu-ai-act@2026-1744.json` is cut for the Annex IV technical file of a
high-risk provider: `highRisk`, `articles` (`runtimeLogging: art. 12`), `annexIv` (points 1 to 9) and
`operatorRequired`. Article 50 appears only in `notes` ("Art. 50 transparency applies from 2 August
2026, with Art. 111(4) giving pre-2 August 2026 synthetic-content systems until 2 December 2026"),
and `renderEuAiAct` does not render `notes`. `docs/compliance/eu-ai-act.md` mentions Article 50 once,
in prose, and maps Article 13 (instructions for use) to the manifest, the threat model and the journal.
Human oversight (Article 14) has no row; the nearest rule is `security-human-agent-trust`
(tag `human-oversight`, ASI09). Nothing in the pack asks whether the system is high-risk or falls under
Article 50 at all: the pack is written for whoever runs `compliance eu-ai-act`, and opens on "Draft,
incomplete — not a conformity assessment".

**Why it matters.** A reader of the pack can take its silence on Article 50 for an absence of
obligation. The adopter who reported it now adds its own "to be completed by you" sections for system
qualification and Articles 14 and 50, outside runward.

## Decision

**Decided (2026-10-23).** B and C together. **B**: a new lens file (ADR-0022: a new file, never an
edit) adds `operatorRequired` rows: first the system's qualification (high-risk under Annex III or I? an
Article 50 case? an Article 5 prohibited practice?), then Article 4 literacy, Article 14 human oversight
and Article 50 transparency measures. runward supplies nothing for them; the pack names them so their
absence shows. One adopter already writes exactly these sections by hand. **C**: the draft prints the
lens's dated `notes`, so the Article 50 and Article 5 dates already in the file reach the reader. The
default lens moves to the new file; a pinned `--regime-version` keeps the old output. Implementation is
a pull request of its own.

The options as proposed on 2026-10-22:

- **A. Nothing in the tool.** The pack stays an Annex IV readiness draft; `docs/compliance/eu-ai-act.md`
  says plainly which articles it does not touch (4, 5, 14, 50) and why.
- **B. Operator-required rows, in a new lens file.** A new mapping version (ADR-0022: a change is a new
  file, never an edit) adds `operatorRequired` entries: the system's qualification (Annex III high-risk?
  Article 50 cases? prohibited practices of Article 5?), Article 4 literacy measures, Article 14 human
  oversight measures, Article 50 transparency measures. runward supplies nothing for them; the pack
  names them so their absence is visible. The renderer gains no logic.
- **C. Render `notes`.** The draft prints the lens's dated `notes` under its header, so the Article 50
  and Article 5 dates already in the file reach the reader. Cheapest; says when, not what to do.
- **D. A second pack.** A distinct `eu-ai-act-transparency` lens for systems outside the high-risk
  categories. Most work; a second renderer and its tests.

## Alternatives discarded

- **Mapping Article 50 to runward evidence.** runward does not observe what a running system discloses
  to its users; a green row there would be the overclaim `docs/positioning.md` forbids.

## Consequences

- B and C keep the ADR-0016 guardrails: every added line is operator-required or a dated fact, none is
  "supplied" by runward.
- B moves the pack's default lens version; adopters who pin `--regime-version eu-ai-act@2026-1744` keep
  the current output until they move.

## What would settle it

- **For A**: adopters who read the pack also read the documentation page, and no second adopter asks.
- **For B**: a second adopter, or an auditor, reading a pack and asking where Article 50 or the system's
  qualification is recorded; a dated reading of Articles 4, 5, 14 and 50 to word the rows.
- **For C**: the `notes` field kept short and dated enough to print as is.
- **For D**: adopters whose systems are mostly outside the high-risk categories asking for a pack of
  their own, more than one.

## Reevaluation trigger (mandatory, dated)

Reopen when a second unrelated adopter asks for Article 50 or Article 14 in the pack, when the lens
reaches its `reviewBy` (2026-12-02), or on 2027-01-22, whichever comes first.

**Trigger set on**: 2026-10-22 · **Watched via**: issues mentioning Article 50, transparency or the
`eu-ai-act` lens, and the `watch external facts` workflow's `reviewBy` alarm.

## References

- `regimes/eu-ai-act@2026-1744.json` (`notes`, `operatorRequired`), `src/lib/compliance.ts`
  (`renderEuAiAct`), `docs/compliance/eu-ai-act.md`.
- ADR-0016 and `docs/positioning.md`: what a pack may and may not say.
