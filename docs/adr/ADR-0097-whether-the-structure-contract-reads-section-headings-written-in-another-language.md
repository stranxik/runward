# ADR-0097 — Whether the structure contract reads section headings written in another language

**Date**: 2026-10-20
**Status**: accepted (2026-10-20) — the maintainer chose option A: the structure contract reads the template's English headings only, and names every heading it does not find. Options B to E stay written down with their cost; E (a missing trigger as a strict gap outside the opt-in) is not decided here. An agent wrote this record; the maintainer decided (ADR-0088 decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: an adopter's mission reproduced on `main` (0.44.0) and re-run on the branch of this ADR,
with the headings read by `STRUCTURE` (`src/lib/mission.ts`) and by the ADR reader (`adrSetAsideReason`)
compared against the files as the adopter wrote them
**Relates to**: [ADR-0069](ADR-0069-the-structure-contract-is-the-default-for-new-missions.md) (the structure
contract is the default for new missions), [ADR-0030](ADR-0030-the-machine-surface-is-a-contract.md) (the
machine surface is additive), RWD-2026-0172 and RWD-2026-0173 in
[known-defects.md](../compliance/known-defects.md)

## Context

**What was reported.** An adopter wrote a mission in French. Every deliverable kept runward's field
lines (`**Date**:`, `**Status**:`) and the `## Rule conformance` table, and wrote its sections in
French: `## 1. Problème`, `## 3. Critère de succès observable`, `## Contexte`, `## Décision`. Under the
structure contract, which `init` arms by default since ADR-0069, `check` read thirteen deliverables
as in progress (`section "1. Problem" is missing`) and the decision journal as empty. Its only ADR had
a context, a decision, its reasons and its consequences, and no section the reader recognises as a
reevaluation trigger.

**What the tree does.** `STRUCTURE` names each section a deliverable must carry by its English
heading, verbatim (`"1. Problem"`, `"3. Ports"`, `"Positions held"`), and an ADR counts only with a
heading that starts with `## Reevaluation`. Both are byte comparisons against the template runward
ships, which exists in English only: `init` has no language option and `templates/mission/` has one
copy of each file.

**What this branch already changed, and what it left.** The journal no longer reads "raw template"
when ADRs were set aside: each one is named with the section or field it lacks, in `check`'s output
and in `check --json` (`adrSetAside`, RWD-2026-0172), and a heading that starts with `## Reevaluation`
(`## Reevaluation`, `## Reevaluation triggers`) is the trigger section (RWD-2026-0173). Whether a
heading in another language is the section is not decided there, because each answer below moves
what the gate accepts.

**The adjacent question.** Without the opt-in, an ADR with no trigger section counts as a decision,
as it always has; the reopening watch already names an accepted one as missing its section
(`readReopeningTriggers`). Making that a strict gap outside the opt-in would change the verdict of
every unarmed mission that carries such an ADR, so it is not done here. It is listed below as
option E because it is the same family: what the gate does with a section it cannot find.

## Decision

Accepted: **option A for now, with the cost of each option written down**, until the evidence below
says whether a second language is a real population or one mission.

- **A. English headings only, named when missing (the tree today).** The reader stays a byte
  comparison; what changed is that a refusal names the heading it looked for. Cost: a mission
  written in another language must keep runward's section headings in English, or every
  deliverable reads in progress. Zero new code, zero new ambiguity.
- **B. A closed table of accepted spellings per heading, shipped with runward.** For each section
  in `STRUCTURE` and for the ADR trigger, a list of headings in each supported language
  (`"1. Problem"`, `"1. Problème"`). Cost: a translation table runward maintains for every
  template change, per language, tested both ways; each added spelling widens what the gate
  accepts, and a bad translation is a false green on that language.
- **C. Headings declared by the mission.** The mission's `scaffold-lock.json` (or a file beside it)
  maps runward's heading to the one the mission writes. Cost: a second configuration surface that
  the gate trusts, written by the party the gate judges. The mapping can point a required section
  at any heading, so it needs its own refusal rules (unique targets, every required section mapped
  once), and the delivery report has to print it.
- **D. Localized templates from `init`.** `init --lang fr` writes French templates and the contract
  reads that language's headings. Cost: B's maintenance plus every template, rule summary and skill
  in each language, and a mission whose language is fixed at `init`.
- **E. (Adjacent, not a heading question.) A missing trigger becomes a strict gap outside the
  opt-in.** Cost: a verdict change on existing unarmed missions; it would need a migration notice
  and a release of its own, under ADR-0069's rule that a mission opts into what moves its verdict.

## Alternatives discarded

- **Matching by section number only** (`## 1. ` counts as `1. Problem` whatever follows). Rejected:
  it makes any numbered heading the required one, so `## 1. Notes` passes for the problem
  statement. The contract reads shape, and this throws the shape away.
- **Fuzzy or translated matching at run time** (an edit distance, a dictionary lookup, a model).
  Rejected: the gate reads bytes and never judges meaning (ADR-0001, ADR-0054); two runs on the same
  tree must give the same verdict on every machine.

## Consequences

- With A, the adopter's mission stays in progress until its headings are written in English. It now
  sees which heading is missing in each deliverable and which ADR was set aside, and why.
- B, C and D each make the gate accept bytes it refuses today, so each is a release with a
  `wrong-verdict` audit of the new spellings before it ships, and an entry in this journal accepting it.
- E is a verdict change and needs its own ADR if it is wanted.

## What would settle it

- **For A**: no second mission written in another language within the trigger period below, or
  adopters who, once told which heading is missing, keep the English headings without asking for more.
- **For B**: two or more missions in the same language, from unrelated adopters, each red only on
  headings, and a maintainer willing to keep the table in step with each template change.
- **For C**: an adopter that needs headings in its own house vocabulary rather than a language, so a
  table runward ships could never cover it.
- **For D**: B's evidence for a language, plus a request to have the templates themselves in it.
- **For E**: a measured case where an unarmed mission went green on an ADR without a trigger and that
  was the cause of a decision nobody reopened.

## Reevaluation trigger (mandatory, dated)

Reopen when a second mission written in another language reports deliverables in progress only on
headings, when an adopter asks for headings of its own, or on 2027-01-20, whichever comes first.

**Trigger set on**: 2026-10-20 · **Watched via**: issues and the defect register (`found-by` =
`operator-report`) mentioning a section heading or a set-aside ADR.

## References

- `src/lib/mission.ts`: `STRUCTURE` (the sections each deliverable must carry), `REEVALUATION_HEADING`,
  `adrSetAsideReason`, `readReopeningTriggers`.
- `test/unit/adr-set-aside.test.js`: the localized heading kept as a control ("a localized one is not read").
- RWD-2026-0172 and RWD-2026-0173 in [known-defects.md](../compliance/known-defects.md).
