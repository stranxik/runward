# ADR-0125: The decision reading, a plain-language projection of the fleet index, written once in runward-fleet from a closed lexicon in two languages, with no model

**Date**: 2026-11-10
**Status**: accepted (2026-11-10), on the maintainer's agreement in chat on 2026-11-10 to the direction
of a decision reading built in `runward-fleet` (relayed to the session that wrote this record by the
session that received it). The maintainer did not review this text before it was written: his approval
of the pull request that carries it is its acceptance, and the record lands only with that approval.
Non-constitutional: it adds a view, a document and additive fields to `runward-fleet-index/0`, and
amends no accepted record
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an
agent session. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the
agent's writing is disclosed throughput, not independent review
**Method**: read on a fresh clone at `main@5a9cdf0`: `packages/runward-fleet` (the build, the view rules,
the views), `docs/spec/runward-fleet-index.md`, ADR-0093 (decision 11), ADR-0121, ADR-0082, ADR-0088
(decision 4), ADR-0095, ADR-0114, and the code of the CLI that writes the closed fields of
`check --strict --json` (`src/lib/check-contract.ts`, `conformance.ts`, `delegation.ts`, `analyze.ts`,
`mission.ts`, `verdict.ts`). The same fields read in the runward 0.46.0 package published on npm (its
tarball, integrity compared with the registry's). Five real `check --strict --json` exports kept as
fixtures (`test/fixtures/fleet/decision/`): three written by 0.46.0 in the continuous integration of
the public renaming demonstration and of a public repository whose rows are all proposed, one by 0.46.0
on the shipped example after two rows were ratified with `ratify --agent`, one by the CLI of this tree
with `--require attested`. The adversarial review of a mock-up of the hosted product's screens, outside
this repository, whose findings on the refusal's text, the line of a refusal, the counts of
ratification and the history of states this record answers
**Relates to**: [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(decision 11, the eighteen view rules, which this record keeps as they are),
[ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md) (one
interface, two deployments), [ADR-0082](ADR-0082-an-agent-may-ratify-under-its-own-name-never-under-a-humans.md)
and [ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)
(decision 4: how an agent's ratification is counted), ADR-0095 (`ratification.byRow`,
`gaps.causesByKind`), ADR-0114 (`level-not-met`), ADR-0030 (values are only ever added), ADR-0059 (the
mutation register)

## Context

The hosted product decided on 2026-11-10 to show first a reading for the people who answer for what
agents deliver and do not read code. Its record (in its own repository) puts that reading in
`runward-fleet`, so both deployments of ADR-0121 say the same thing from the same index, and no second
reader of the index drifts from the first. This record decides the `runward-fleet` half.

What the index carried, read at `main@5a9cdf0`, and what it did not. It carried the verdict, each
deliverable with its state and cause, each refusal (`scope`, `rule`, `kind`, `problem`, `file`), the
ratification counts and the names of those who ratified. It did not carry:

- the line of a refusal, which `check --json` writes (`conformance[].line`, RWD-2026-0149);
- a grouping n / N for the ratification modes: the counts `lineByLine` and `enBloc` count ratification
  entries, not rows, so a view that showed "17 of 46" computed the denominator itself, which ADR-0093
  decision 11 forbids; only `ratified`, `changed`, `blind` and `untraced` had their grouping;
- the rows an agent ratified (`ratification.agent`, `agents`, `singleAccountable`, ADR-0082 and ADR-0088
  decision 4): `ratifiers` listed an agent's declared name beside the people's, with nothing to tell them
  apart;
- a way to leave the names of people out of an index published in public;
- a mission whose check was received as a digest only, its content not shared.

What the CLI writes. The kind of a refusal is closed and only ever grows (ADR-0030). Measured on
2026-11-10: the published 0.46.0 writes 31 kinds, this tree's CLI 39 (`requires-unmet` and seven
`analysis-*`). `evidence-refused` is the family of almost every evidence check, and only the English
prose of `problem` says which check refused: the renaming demonstration's two refusals read `typed pointer
file:code/src/core/domain/guard.ts#guardFields — symbol "guardFields" not found in the file (moved or
renamed? update the pointer)`. No document of this repository lists the kinds whole: `docs/interop.md`
misses five of them, and the comment of `ConformanceEntry` misses four.

The word list of the view rules. `BANNED` (`src/rules.js`) matched French forms with `\b`, which is ASCII:
it saw no boundary after an accented letter, so a masculine singular past participle ending in one passed
the rule, and several forms of the author's list were not in it at all. No release carried
`runward-fleet` (it came with #494 and was never published), so no page was published with that gap.

## Decision

**The decision reading is one pure projection of `runward-fleet-index/0`, written in `runward-fleet` from
a closed lexicon in English and French. It reads closed fields only, shows the free text of a refusal as
it is, computes nothing, and calls no model.**

1. **Where it lives.** `ui/views.js` exports `decide(index)`, the reading as a document
   (`runward-fleet-decision/0`, [docs/spec/runward-fleet-decision.md](../spec/runward-fleet-decision.md)),
   `renderDecision(index, id?)`, its HTML (the portfolio, or one application's page), and `LEXICON` with
   `lexiconAt`. It is the module the static page inlines and a hosted deployment serves
   (`runward-fleet/views`), so both deployments run the same bytes. The page opens on the reading when it
   has no hash; the fleet view stays at `#/`, and every technical view stays one click away. Each element
   carries a style role (`data-role`), never a look: each deployment styles the same roles with its own
   layer.
2. **What it says.** For the fleet, the groupings by state with their lists. For each application: its
   state, the index's own, renamed and never recomputed; the sentence that follows it; the date of the
   last check received (the export's `at` label, data, never a clock); one reason sentence; the refusals
   by kind with their n / N; each refusal with its document and its sentence, then the check's detail as
   written; the documents not filled in, grouped by nature; how the decided rows were endorsed, as
   recorded; where the reading comes from (`implemented`). Every value carries its index path, and every
   sentence its lexicon pointer and the index path of the closed value it was read from. No score, no
   percentage, no amount, no threshold on a date, and no history of states: the index carries the last
   check only.
3. **The lexicon is closed, and complete.** A sentence is keyed on a closed value of the index: the
   verdict, a deliverable's state and cause, the deliverable (its `relPath`), its phase, a refusal's kind
   and scope, how a row was endorsed, `implemented`. The closed lists are published in
   `docs/spec/runward-closed-values.json`, each value marked as written by the published 0.46.0 or by
   this tree only. A test reads them against the CLI of the same commit, from its code (the unions it
   declares, read with the TypeScript compiler, and the literals of the table `conformanceEntries`
   builds), and requires a sentence for every value in both languages; a value planted in the CLI's code
   reddens it. A value the lexicon does not know is shown as written, marked as data, never dropped and
   never guessed.
4. **The refusal's text is data.** `problem` is shown character for character, marked verbatim. No
   sentence is derived from it: the sentence comes from `kind`, and the document from `file` matched to
   the closed list of deliverables, or from `scope`. A test rewords every `problem` of the renaming
   demonstration and finds no sentence changed.
5. **The index grows, additively** (`runward-fleet-index/0` is expand-only): each refusal carries its
   `line` and `phaseId`; `conformanceByKind` groups the refusals by kind; `ratification` carries `agent`,
   `agents` and `singleAccountable` as the CLI writes them, `byMode` (the decided rows by how they were
   endorsed: the mode of a ratified row, or the state of any other, partitioning the decided rows, each
   with n / N and its list) and `agentRows` (each agent's ratified rows, with the person it declared it
   answers to); `fleet.byVerdict` gains the state `not-available`.
6. **An agent's endorsement is never a person's.** It reads "endorsed by a reviewing agent (declared
   name), under the responsibility of (declared person)", never in a person's mode; an agent whose export
   declares no person reads so, never "not published". When the index does not detail the modes (an export
   without `byRow`, or an index built before this record), the reading writes "endorsement mode not
   detailed", with no number: the export's counts count entries, not rows, and no grouping stands behind
   them.
7. **Names can stay out.** `fleet.json` may say `"names": "omitted"`: the index then carries no name of a
   person an export declares (`ratifiers` empty, the person of each agent `null`), the reading says the
   name is not published, and the build refuses an index where one of those names would still reach the
   page through the projected fields of any mission, across any run of blanks. It never rewrites a value. A
   name written only in free text and never declared in a field is not known to the build, and the
   specification says so.
8. **A digest only.** An export may be declared by its `sha256` alone, its content not shared. The mission
   then reads `not-available`, "content not shared", and none of the other states.
9. **The words, held where the page is built.** `BANNED` is completed and reads its words with
   boundaries of any script, each in its listed forms. Five rules of the reading join it, R1 to R5, each
   with a planted control, the first four held by the build on every rendered view of the reading and on
   the whole lexicon, in both languages: none of the method's own words (`INTERNAL`); every closed value
   with its sentence, the two languages holding the same keys; no state, group label or reason named as a
   decision taken (`go`, `no-go`, `ready`, `blocked`, and their French), the reader's decision being named
   in a title only ("Before your go / no-go"); "nothing is blocking" never without "according to the
   team's requirements", and, for an application, the date of the last check; and, held by a test, an
   agent's rows never said in a person's words, a refusal's text never read. The sources view lists them,
   numbered apart from ADR-0093's eighteen, which are unchanged.
10. **The English words.** The French state words were chosen by the maintainer; their English
    equivalents are: "Refused by the check" (`gaps`: the CLI's own word, a fact rather than a
    consequence; "failed" would read as pass or fail, and "blocked" claims a release depends on it),
    "Required level not met" (`level-not-met`, the view's word since 2026-11-06), "No check received"
    (`not-observed`: nothing was ever received, which "silent" or "no news" would blur), "Nothing is
    blocking" (`clean`: "clear" or "cleared" read as an approval, "no blockers" is a tracker's jargon),
    and "Content not shared" (`not-available`). A row's endorsement is "endorsed", the word the hosted
    product's record uses: "approved" names an approval this check does not make, and "validated" reads
    as a verification.

## Alternatives discarded

- **A reading in the hosted product, from the index or from `check.json`.** Two readers of one index
  drift, the customer-run page would not get the reading, and ADR-0121's one interface would split.
- **A model that picks or writes the sentence.** The reading would no longer be computable again from the
  index, and the split between verified and declared that such an answer rests on is not in the data.
- **A sentence that names the symbol, parsed from `problem`.** The CLI may reword its prose. A structured
  pointer field is the CLI's to add, in its own record.
- **A module of its own, `runward-fleet/decision`.** The static page inlines one module; a second would
  need a second inlining path and a second pin, for the same bytes.
- **The closed lists as a constant of the CLI, typed into `ConformanceEntry`.** It closes the list at
  compile time, and it changes `check-contract`, a module the mutation register measures (ADR-0059). The
  list in `docs/spec`, held against the code by a test with a planted value, closes it at no cost to the
  register. It reopens with the next change of that module.
- **Counting the refusals by kind, or the rows by mode, in the view.** A view never computes a count; the
  index carries each grouping with its denominator and its list.
- **Adding the reading's rules to ADR-0093's eighteen.** Those are the rules of every view; these hold the
  reading only, and keeping them apart amends no accepted record.
- **"Go", "ready" or "blocked" as a state.** A state named "go" reads as a decision the tool took; a
  refusal is "blocked" only where a release depends on the check, which the index does not carry.
- **Ordering applications by state.** The order is the inventory's, and the page says so.

## Consequences

- **Positive.** One lexicon for both deployments, tested once; the static page gives the reading with no
  hosted service; every sentence is computable again from the same index; the counts the hosted product's
  screens need arrive with their denominators; an agent's ratification can no longer read as a person's.
- **Negative, accepted.** A change of wording is a change in this repository, then a new pin by the hosted
  product. Two languages to keep, and a test that refuses a value without its sentence in both. The reading
  says less than a reader may want: no symbol name in a sentence, no score, no trend, no history. The page's
  golden files move (`test/fixtures/golden/fleet/`). The French word of the technical views for `untraced`
  becomes "sans ratification enregistrée", the former one falling under the completed list.
- **On other boundaries.** The CLI does not change. The hosted product pins a commit of `main` that carries
  this record (its own re-pin record applies), imports `decide` and `renderDecision` from
  `runward-fleet/views`, assembles a `fleet.json` with `names` and digest-only exports where its consent
  says so, and words what only the service knows from its own lexicon.

## What would settle it

Shown in this pull request, each with its planted control in `test/unit/fleet-decision.test.js`:

1. The closed lists are the values the CLI of this commit writes, read from its code; every value has its
   sentence in both languages; a planted value reddens; an unknown value renders as written.
2. The word rules find each listed form of a word runward never says and each word of the method, in each
   language, in the lexicon and in a rendered view, and none in what ships; a planted state named "Go"
   reddens and the title passes; "nothing is blocking" without the requirements or the date reddens.
3. Every sentence of the renaming demonstration's refused state derives from `kind` and `file` of its real
   `check.json`; its `problem` is shown character for character; rewording it moves no sentence.
4. A real `check.json` with two rows ratified by an agent renders the agent's sentence, its rows in no
   person's group, with a planted control. No real export of a repository ratified by an agent existed on
   2026-11-10 (the hosted product's 42 rows are proposed): the fixture is 0.46.0's output on the shipped
   example after `ratify --agent`, written as the CLI writes it.
5. The reading of one index is the same bytes through the package's exports as in the build (golden, both
   languages).

Still to be seen, outside this repository: the hosted shell renders the same bytes of the reading as
`runward-fleet build` for one index, at its pin; and the comprehension measure of the hosted product's
record (five readers who do not read code, ten seconds). Against: a measure where the first question is
answered by fewer than four readers in five reopens the wording.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-11-19, on what readers of the target made of the reading the day before; then on
2027-02-06, with ADR-0121; or earlier when: `runward-fleet-index/0` changes in a non-additive way; the CLI
writes a closed value `docs/spec/runward-closed-values.json` does not name (the test reddens); the CLI
publishes a structured pointer for a refusal; a third language is asked for; a question written down by
three teams that the reading cannot answer; the next change of `src/lib/check-contract.ts`, which may type
the list instead.

**Trigger set on**: 2026-11-10 · **Watched via**: `test/unit/fleet-decision.test.js` (closed lists,
lexicon, words, goldens), the comprehension measures the hosted product publishes

## References

- [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
  (decision 11), [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md),
  [ADR-0082](ADR-0082-an-agent-may-ratify-under-its-own-name-never-under-a-humans.md),
  [ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md) (decision 4),
  ADR-0030, ADR-0059, ADR-0095, ADR-0114.
- [docs/spec/runward-fleet-decision.md](../spec/runward-fleet-decision.md),
  [docs/spec/runward-closed-values.json](../spec/runward-closed-values.json),
  [docs/spec/runward-fleet-index.md](../spec/runward-fleet-index.md).
- RWD-2026-0149 (`conformance[].kind`, `file`, `line`), RWD-2026-0210 (a build of an unpublished tree
  names the last release's version: the `level-not-met` fixture says 0.46.0).
- RFC 6901 (JSON Pointer); WCAG 2.2, success criterion 1.4.1 (each state has its shape and its word).
