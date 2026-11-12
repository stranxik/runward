# ADR-0126: The mission projections: the six steps of each application, the portfolio by step and a history of the versions received, written once in runward-fleet from the index as it is

**Date**: 2026-11-11
**Status**: proposed. It records the direction the maintainer set in chat on 2026-11-10 for the hosted
product (the path through the six steps, the portfolio map and the history are projections written once in
`runward-fleet`; step 4 reads "not asked by the gate"), relayed to the session that wrote this record. The
maintainer has not read this text: it becomes accepted with his approval of the pull request that carries it,
or is amended on his review. Non-constitutional: it adds a module, its export and a document, adds nothing to
`runward-fleet-index/0`, and amends no accepted record
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an agent
session. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing is
disclosed throughput, not independent review
**Method**: read on a fresh worktree at `main@d05b597`, where the decision reading merged: `packages/runward-fleet`
(`src/build.js`, `src/rules.js`, `src/site.js`, `ui/views.js`), `docs/spec/runward-fleet-index.md`,
`docs/spec/runward-fleet-decision.md`, `docs/spec/runward-closed-values.json`, ADR-0033, ADR-0093 (decision
11), ADR-0114, ADR-0121, ADR-0125; the code of the CLI that places a mission on its path (`src/lib/mission.ts`,
`PHASES` and `analyze`; `src/lib/conformance.ts`, `GATED_DELIVERABLES`; `src/lib/check-contract.ts`,
`currentGateLabel` and `redPhases`; `src/commands/status.ts`, its phase progress). The five real `check --strict
--json` exports kept by ADR-0125 (`test/fixtures/fleet/decision/`). The hosted product's design note of
2026-11-10, outside this repository, whose fourth section names `path`, `portfolio`, `point` and `trace`
**Relates to**: [ADR-0125](ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md)
(the decision reading, whose words this record shares), [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md)
(one interface, two deployments), [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(decision 11, the eighteen view rules), [ADR-0033](ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md)
(phase 4 carries no gate), [ADR-0114](ADR-0114-an-identifier-is-read-outside-comments-and-a-strict-green-requires-a-row-the-gate-verified.md)
(no vacuous crossing), ADR-0030 (values are only ever added)

## Context

The hosted product decided on 2026-11-10 to show, for each application of a customer, where it stands in the
six steps of the method, the applications side by side by step, and how that changed over the versions it
received, near real time. Its record puts the projections in `runward-fleet`, so the static page and the hosted
service say the same thing from the same index (ADR-0121), and the service never reads a field itself.

What the index carries, read at `main@d05b597`. For each check received: every document the check expects, with
its `phaseId`, `state` and `cause` (since the first version of `runward-fleet-index/0`); every refusal, with its
`kind`, `scope` and, since ADR-0125, `phaseId`; the verdict, `strict`, `currentGate`, the CLI's own counts
(`gaps.deliverables`, `gaps.conformance`), and the runward version. It carries no grouping by phase, and no
history: a hosted service keeps each version of the index it published (bytes, order, date of reception), and
serves the last one only.

What the CLI says about the path. `PHASES` numbers five gated phases in its own labels: `1 · Frame`,
`2 · Architect`, `3 · Floor`, `5 · Govern (day zero)`, `6 · Hand over`; `topology` is folded under the second
(`GATED_DELIVERABLES`). Phase 4, iterate, has no document (ADR-0033: a posture, not a milestone). `analyze` names
the current phase: the first whose documents are not all filled; `runward status` marks the phases before it
done and the later ones pending, and says "check --strict refuses the crossing" when every document is filled and
the strict verdict is not clean. `currentGate` is prose: a phase label, `all gates passed`, `deliverables filled,
gate red at Floor, Govern` (the phases `redPhases` names), or `deliverables filled, below the level of proof the
run required (attested)` (ADR-0114, ADR-0119). On the five real exports, the hosted product's own record has 42
proposals on steps 2, 3 and 5, four missing rows and one untouched document on step 6, and `currentGate` reads
`6 · Hand over`.

Two readings a naive path would give wrongly. A step whose documents are filled read "crossed", the CLI's ✓ of
`status`, says "crossed" over 42 proposals not endorsed, and over every step of an export at exit 5: the vacuous
green ADR-0114 refuses. A step read "crossed" only once the whole verdict is clean says nothing the state does not
say, and the CLI does name the phases where the gate is red.

## Decision

**The mission projections are pure functions of `runward-fleet-index/0` as it is, written once in `runward-fleet`
(`runward-fleet/mission`, `ui/mission.js`), with their views and a closed lexicon in English and French. They
compute the groupings of each step, the reading of each step by one written rule, and, over the versions
received, since when the last state holds; a view computes nothing; no model, no clock, no network.**

1. **Where they live.** `ui/mission.js` exports `path(index, id)` (`runward-fleet-path/0`), `portfolio(index)`
   (`runward-fleet-portfolio/0`), `point(index)` (`runward-fleet-point/0`), `series(entries)`
   (`runward-fleet-series/0`; the design note's `trace`, a word the package's sources and views never use,
   `BANNED`), their views `renderPath`, `renderPortfolio` and `renderSeries`, and
   `MISSION_LEXICON` with `missionLexiconAt`. A module of its own, beside `ui/views.js`, which it imports for the
   decision reading's lexicon and `decide`: the decision reading's file and goldens are untouched, and a hosted
   deployment imports the module from the commit it pins. The static page does not show these views yet: it
   inlines `ui/views.js` alone. The specification is
   [docs/spec/runward-fleet-mission.md](../spec/runward-fleet-mission.md).
2. **The steps, and how a step reads.** Six steps, each holding the phases the CLI numbers with it (`topology`
   under step 2), step 4 none. A refusal belongs to the step of its `phaseId`; in an index written before
   ADR-0125, to the phase its gated scope names (`SCOPE_PHASE`, the CLI's table); any other scope to no step,
   listed apart. A step reads, in this order: `not-listed` (the check lists no document at all), `not-asked` (no
   document and no refusal there, step 4 always in 0.46.0), `current` (the first step with a document not filled,
   the CLI's own current phase) or `ahead` (a later one), `refused` (a refusal at this step), `crossed` (the check
   is strict and its verdict, `clean` or `gaps`, judges the answers), and `complete` otherwise, with its cause
   (`not-strict`, `level-not-met`, `no-state`, `other`). A refusal that belongs to no step does not stop a step
   from being crossed: it is listed apart, and the application's state, the decision reading's, says the check
   refuses.
3. **What is computed, and where it can be checked.** The index holds no grouping by step, so the projection
   groups, as the build groups (ADR-0093 decision 10): each grouping is n / N with the list it counts and the
   index path of every item (`at`), and the groupings partition the documents and the refusals of the check. A
   view prints the projection: each number's `data-index` names its path in the projection document, which
   `checkView` holds as it holds the index for the other views. "Since when" is computed once, by `series`.
4. **The words.** Every sentence is keyed on a closed value: the step's id, the reading, the cause, the state of a
   point. What the decision reading already names is named by its lexicon (`/decision/…`): a document, its state
   and cause, a refusal's kind, an application's state, its requirements and its date, a value as written. The
   French step words are the method's (Cadrer, Architecturer, Plancher, Itérer, Gouverner, Transmettre), the
   English ones the CLI's labels (Frame, Architect, Floor, Iterate, Govern, Hand over). The words runward never
   says (`BANNED`) and "nothing is blocking" never alone (R4 of ADR-0125) hold here; no reading names a decision
   taken. R1 of ADR-0125, none of the method's own words, does not: these views name the method's six steps by
   design, one click from the decision reading. The closed values are published in
   `docs/spec/runward-closed-values.json` (`mission`), and a test holds every phase the CLI writes on exactly one
   step.
5. **The point, and the series.** `point(index)` is the compact summary a history needs of one version, a pure
   function of the index, so a service writes it when it publishes the version and computes it from the stored
   bytes for a version that has none: for each application, its state, the runward version, the declared commit,
   `currentGate` as written, the exit code, the CLI's own counts, the digest of the check read, and the six
   readings. `series(entries)` takes `[{ version, seq, at, point }]` from the service (`erased: true` for a version
   whose content was erased), reads them in the order of `seq`, and gives one series per application: its points,
   the holes (erased or unreadable, in every series), the runward versions that judged (a change from one point to
   the next is marked, rule 7), the points grouped by state, and since when the last state and position hold (the
   first point of the last run of equal ones, a hole or an absence breaking the run). It is labelled `received`,
   never mixed with a replay (rule 6), and its dates are the receiving service's clock, said declared.
6. **Its rules**, M1 to M6, numbered apart from ADR-0093's eighteen and ADR-0125's five, each held by
   `test/unit/fleet-mission.test.js` with a planted control: every count n / N with the index path of each item,
   and every number the projection's own (M1); one written rule for a reading, the current step the CLI's (M2);
   step 4 never crossed (M3); no step crossed unless the check reads the answers, refuses nothing at that step and
   does not report the level required as unmet (M4); every closed value with its sentence in both languages, no
   refused word, no reading named as a decision taken (M5); the history received only, dated and declared, a
   change of judge marked, since when in the projection, an erased version a hole (M6). M2 is held against the
   CLI's own words on the five real exports: the step called current is the one `currentGate` names when it names
   a phase, the steps called refused are the phases it says are red, and nothing is crossed when it says the level
   required is not met.

## Alternatives discarded

- **The groupings by step in the index, built once, as ADR-0125 did for its counts.** It keeps every count an
  index path, which is what the other views do. But every version a service already keeps would read no step
  until it is built again; a point computed at read for such a version would have none; and a service that
  replays its earlier uploads with the new pin would get other bytes than it stored. Reading the index as it is
  costs the projection its groupings, and each of them names the index path of what it counts.
- **The steps in the hosted product.** Two readers of one index drift (ADR-0004 of the hosted product), and the
  customer-run page could not show the same path.
- **Placing the mission by parsing `currentGate`.** It is prose the CLI may reword. The current step is read from
  the documents' states, as `analyze` reads it, and the label is shown as written; a test, not the product,
  compares the two.
- **"Crossed" for a step whose documents are filled.** It says crossed over refusals at the step and under exit 5:
  the vacuous green ADR-0114 refuses.
- **"Crossed" only when the whole verdict is clean.** The path would say nothing the state does not, and would
  call frame "not crossed" because of a refusal at hand-over, where the CLI says the gate is red at hand-over.
- **A refusal on no step stops every step from being crossed.** A change to the team's rules would read as six
  steps not crossed; it is listed apart, under the application's own state, which already says the check
  refuses.
- **"Since when" in a view.** Two views would compute it two ways; it is the projection's, once.
- **The module inlined in the static page now.** It needs a second inlining path in `src/site.js` and routes in
  the template, for a page that does not ask for them yet; it is its own change, when it does.
- **The decision reading's file.** A second set of exports and goldens in one file reviewed for another purpose;
  the decision reading stays as ADR-0125 left it.

## Consequences

- **Positive.** The path, the portfolio and the history ship without a new field, a new upload or a rebuild, and
  read every version a service already keeps; one module for both deployments, tested once; step 4 is never
  crossed, and no step is crossed under a check that does not hold its answers; a document, a refusal and a state
  are named as the decision reading names them; the series is ready for a service's versions, holes included.
- **Negative, accepted.** The projection computes groupings the index does not hold, and a view's numbers name
  paths in the projection rather than in the index, each item naming its index path one level down. The reading
  of a step is runward-fleet's rule, mirrored on the CLI's, not a field the CLI writes: a change of the CLI's
  current-phase logic would show in the test on the real exports, not in the product. The position is the CLI's
  English prose, shown as data on a French page. Two languages to keep, and the specification holds every
  sentence. The static page does not show the views yet.
- **On other boundaries.** The CLI does not change, nor `runward-fleet-index/0`. The hosted product pins a commit
  of `main` that carries this record (its own re-pin record applies), imports `runward-fleet/mission`, writes
  `point(index)` with each version it publishes, and passes `series` its versions, their order, their dates of
  reception and the erased ones.

## What would settle it

Shown in this pull request, each with its planted control in `test/unit/fleet-mission.test.js`:

1. On the five real exports, the current step is the phase `currentGate` names, the refused steps are the phases
   it says are red, every step with documents is crossed under `all gates passed`, and none is crossed below the
   level required.
2. Step 4 reads "not asked by the gate" on every export, and a planted rule that reads it otherwise is caught; a
   presence-only check, a check with no state and an unknown state cross nothing.
3. Every grouping is n / N with the index path of each item, the steps partition the documents and the refusals,
   and every number of every view is the projection's value at its path, in both languages.
4. An index written before refusals carried their phase reads the same steps.
5. The projections and pages of the real exports are golden, in both languages, and the same through the package's
   exports.

Still to be seen, outside this repository: the hosted shell renders the same bytes of the path and the portfolio
as this module for one index, at its pin; a point written at publication equals the point computed at read from
the stored bytes; and readers who do not read code name the current step and the refused steps of an application.
Against: a real export whose `status --json` names another current phase than `path` does (a check run with
`--through`, for one), or a reader who takes "crossed" for an approval.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-11-19, on what the first readers made of the steps; then on 2027-02-06, with ADR-0121; or earlier
when: the CLI writes a phase `docs/spec/runward-closed-values.json` does not place on a step (the test reddens);
the CLI writes the state of each phase's gate in `check --json` (the reading becomes the CLI's, read, not
computed); a document is expected at step 4; `runward-fleet-index/0` changes in a non-additive way; the static page
is asked to show the steps; the hosted product's record changes what a point holds.

**Trigger set on**: 2026-11-11 · **Watched via**: `test/unit/fleet-mission.test.js` (the CLI's words on the real
exports, the closed values, the lexicon, the goldens), the hosted product's own measures of its screens

## References

- [ADR-0125](ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md),
  [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
  (decision 11), [ADR-0033](ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md),
  [ADR-0114](ADR-0114-an-identifier-is-read-outside-comments-and-a-strict-green-requires-a-row-the-gate-verified.md),
  ADR-0030, ADR-0088 (decision 4), ADR-0119.
- [docs/spec/runward-fleet-mission.md](../spec/runward-fleet-mission.md),
  [docs/spec/runward-fleet-decision.md](../spec/runward-fleet-decision.md),
  [docs/spec/runward-fleet-index.md](../spec/runward-fleet-index.md),
  [docs/spec/runward-closed-values.json](../spec/runward-closed-values.json).
- RFC 6901 (JSON Pointer); WCAG 2.2, success criterion 1.4.1 (each reading has its shape and its word).
