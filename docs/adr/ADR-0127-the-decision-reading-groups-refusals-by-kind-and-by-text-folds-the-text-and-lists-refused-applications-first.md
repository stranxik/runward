# ADR-0127: The decision reading groups the refusals by kind and by text, folds the text, keeps a count for every state and lists the refused applications first

**Date**: 2026-11-11
**Status**: proposed. It records what the maintainer validated on a mock-up of the hosted product's screens
(outside this repository), relayed to the session that wrote this record: refusals grouped by kind and by
identical text with their n / N and their list, the check's text folded behind a disclosure, the refused
applications first, a tile for every state with `0 / N`, and a label that does not announce the text's
language. The maintainer has not read this text: it becomes accepted with his approval of the pull request
that carries it, or is amended on his review. Non-constitutional: it refines ADR-0125, adds one field to
`runward-fleet-index/0` (expand-only) and one rule of the reading, and amends no accepted record
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an agent
session. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing
is disclosed throughput, not independent review
**Method**: read on a worktree at `main@d05b597`, where the decision reading merged: `packages/runward-fleet`
(`src/build.js`, `src/rules.js`, `src/site.js`, `ui/views.js`, `ui/template.html`),
`docs/spec/runward-fleet-decision.md`, `docs/spec/runward-fleet-index.md`, ADR-0093 (decision 11), ADR-0121,
ADR-0125. The five real `check --strict --json` exports ADR-0125 keeps (`test/fixtures/fleet/decision/`), of
which `hosted-proposed.check.json` holds 46 refusals carrying four texts. Heights measured with Chrome on the
hosted product's real server (in-memory store, seeded through its application with the same five exports, its
own style layer), at `main@d05b597` and with this change, French, light theme
**Relates to**: [ADR-0125](ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md)
(the decision reading, refined here), [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(decision 11: a view computes no count), [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md)
(one interface, two deployments), ADR-0030 (values are only ever added)

## Context

ADR-0125 lists every refusal of an application with its sentence, where it is and its text in full, and
lists the applications in the inventory's order, a choice it argued ("Ordering applications by state" is
among its discarded alternatives). On a real export the first rule makes the reading unreadable: the 46
refusals of a public repository whose rows are all proposed carry four texts (22, 19 and 1 of the kind
`proposed`, 4 of `missing-row`), each about 380 characters, so the same paragraph is shown 22 times. The
hosted product shows the reading byte for byte; measured there, the application's page was 10,555 px tall at
1440 px and 19,118 px at 390 px, the panel that lets a reader recompute the verdict starting at 17,161 px on a
phone. The portfolio drew a tile only for a state at least one application holds, and the French label of the
text said "(en anglais)", which the mock-up's own review removed.

A view never computes a count (ADR-0093 decision 11, ADR-0125): grouping refusals by text in the view would
count them there.

## Decision

1. **The index groups each kind's refusals by text.** Each group of `conformanceByKind` carries `byText`: its
   refusals by `problem`, compared character for character, in the order the export lists them, each
   `{ state, n, N, list }`, `state` being the text as written, `N` the kind's `n`, `list` the positions of
   those refusals in `conformance`. Additive to `runward-fleet-index/0`; the reading reads it and counts
   nothing.
2. **An application's page says each text once, folded.** For each kind, its sentence with n / N; for each of
   its texts, a `<details>` whose label is "Check detail, as written" ("Détail du contrôle, tel quel"), with
   "(the same for n / N)" when the text stands for several refusals, holding the text as written
   (`lang="en"`); then where each refusal is ("{document}: {file}, line {line}, requirement {rule}"), behind a
   second `<details>` when there are several. The first text of the page is open, as on the mock-up. No
   script: every refusal is in the HTML, open or not. A refusal no text group lists (an index built before
   this record) is shown alone, with its own sentence and its text.
3. **The applications are listed refused first**, then level not met, then the other states in the index's
   order, each state in the inventory's order, read from the lists of `fleet.byVerdict`; the page says so.
   No date is compared: the `at` label is data. `decide()` keeps `applications[]` in the inventory's order
   and adds `listing` (`ids` and the sentence), so a reader keyed on positions keeps working.
4. **Every state keeps its tile**, `0 / N` included, in the same order.
5. **The label does not announce the text's language**, in either the refusals or the endorsement's
   disclosure; `lang="en"` on the text says it to assistive technology.
6. **Grouped, no refusal is hidden (R6, held by the build).** `checkIndex` refuses an index whose text groups
   do not partition a kind's refusals, are not n / N of the kind, or list a refusal of another text;
   `checkRefusals` refuses an application's page that does not list each refusal of the index exactly once,
   by its index path. Both run before a page is written, the hosted product's included.

## Alternatives discarded

- **Group in the view.** It counts in the view, which ADR-0093 decision 11 forbids, and two deployments
  could count differently.
- **Group by kind and document, as the mock-up drew it.** The document is already in each refusal's line;
  grouping by text is what removes the repetition, and a text's refusals may span documents (the 22 above
  span four).
- **Show one refusal and a link to the others.** It needs a page or a script the static page does not have;
  `<details>` holds them all, reachable without either.
- **Sort by the oldest check, as the mock-up did.** It compares dates, and the `at` label is data a static
  inventory may not declare; the reading reads no clock.
- **Reorder `applications[]` in the document.** Another view of this package reads it by the inventory's
  position; `listing` gives the order without moving it.

## Consequences

- **Measured.** The page of that application, on the hosted product's server: 10,555 to 1,483 px at 1440 px,
  19,118 to 3,656 px at 390 px (French), the panel to recompute the verdict from 17,161 to 1,699 px on a phone;
  46 refusals in the HTML before and after. On the static page: 12,084 to 1,445 px at 1440 px, 22,686 to
  1,882 px at 390 px; every disclosure opened, 46 refusals visible and no horizontal scroll at 1440, 390 and
  360 px.
- **Negative, accepted.** A reader opens a disclosure to read a text or the list of refusals. The goldens
  move (`test/fixtures/golden/fleet/`): the decision documents gain `listing`, `kinds[].path`,
  `kinds[].texts`, `problems[].entry` and `ungrouped`, and remove nothing; the page's digest changes. A
  hosted deployment re-pins and styles the new roles (`refusal-kinds`, `refusal-kind`, `refusal-text`,
  `where`, `where-label`, `refusals`).
- **On other boundaries.** The CLI does not change.

## What would settle it

Accepted when the maintainer approves the pull request after reading the reading of the hosted product's own
export on both deployments, at 1440 and 390 px. Shown in this pull request, each with its planted control in
`test/unit/fleet-decision.test.js`: every refusal of the five real exports listed once, under its own text,
with the index's n / N; a refusal dropped from a page, listed twice, moved under another text or taken out of
its group is refused, and the build refuses a planted copy of the view that lists one fewer; the order follows
the index's groupings; the five tiles with `0 / N`; the labels in both languages. Reversed if the
comprehension measure of the hosted product (ADR-0125) finds that readers miss a refusal behind a disclosure.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-11-19 with ADR-0125, on what readers made of the reading the day before; or earlier when:
`runward-fleet-index/0` changes in a non-additive way; the CLI writes a structured field that varies within
one text (a symbol, a pointer), which may group differently; a reader asks for the order by date.

**Trigger set on**: 2026-11-11 · **Watched via**: `test/unit/fleet-decision.test.js`, `checkIndex` and
`checkRefusals` in the build

## References

- [ADR-0125](ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
  (decision 11), [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md).
- [docs/spec/runward-fleet-decision.md](../spec/runward-fleet-decision.md),
  [docs/spec/runward-fleet-index.md](../spec/runward-fleet-index.md).
- HTML Living Standard, the `details` and `summary` elements.
