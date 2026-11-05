# ADR-0121 — runward-fleet and the hosted product: one interface, two deployments

**Date**: 2026-11-06 (the decisions were delegated on 2026-11-05)
**Status**: accepted (2026-11-05), by the maintainer's delegation in chat on 2026-11-05, on the agent's
recommendation; the maintainer did not review this text before acceptance. Constitutional, class R under
ADR-0088 decision 2: it amends ADR-0093 (its answer 2, decisions 10 and 12), the conditions of ADR-0039,
part 3 of ADR-0052 and decision 3 of ADR-0109
**Deciders**: the maintainer, by delegation in chat on 2026-11-05, in these words (translated from French):
« In what I have to do there are items that you can do, and where you even make recommendations to me.
After having investigated. So I trust you: carry it out each time instead of asking me. » Accepted on the
recommendation of the agent sessions that built the fleet prototype and read the public filings cited
below; the maintainer did not review this text before acceptance. This is a delegation, not a review. The
decisions were relayed to the session that wrote this record by the session that received them. Under
ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review. The delegation does not amend `runward/delegation.md`, where class R
stays the maintainer's: this acceptance stands outside the charter, and the record lands when the
maintainer approves its pull request
**Method**: a prototype of `runward-fleet` built on 2026-11-05 outside this repository (an index builder,
a static view, a replay of 40 revisions of runward's own history, a static check of the view rules) and
the bench it displays (fresh copies of `examples/request-triage`, runward 0.46.0 installed from npm, seven
sabotages each pushed as is and after an attempt to re-seal it, two healthy runs). The investigations of
2026-11-05, outside this repository, among them a reading of what a regulated buyer asks of a supplier.
Datadog's registration statement on Form S-1 (2019) and its annual report on Form 10-K for fiscal 2025,
read on 2026-11-05. The Functional Source License 1.1 with the MIT future licence, read on 2026-11-06
(fsl.software, the licence template of `getsentry/fsl.software`, the SPDX entry `FSL-1.1-MIT`). Read on a
fresh clone at `main@32d8425` (0.46.0): ADR-0039 (amendment of 2026-08-24), 0052 (part 3), 0054, 0086,
0088 (decisions 2 and 4), 0093, 0094 (question 1 and its note of 2026-10-23), 0109,
`docs/interop.md`, `src/lib/styles.ts`, `src/lib/report.ts`, `test/unit/runtime-boundary.test.js`,
RWD-2026-0195; ADR-0117, 0119 and 0120 as written in pull request #482, open when this record was written.
Measured on that clone: `node dist/cli.js check --strict --json` (decision 7). Reviewed before publication
by a separate agent session, read-only, whose findings were applied
**Relates to**: [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md),
[ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0086](ADR-0086-security-advisories-and-a-fix-time-target.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md),
[ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md),
[ADR-0109](ADR-0109-the-mission-is-named-by-what-it-declares-never-by-its-checkout-folder.md);
ADR-0119 and ADR-0120 (pull request #482, open when this record was written); ADR-0122 (proposed, the
integration recipes)
**Amends, by name**:
- ADR-0093: the maintainer's answer 2 and decision 12 (« built in D6 »), for a hosted preview only
  (decision 1 below and the note of 2026-11-06); decision 10 (« its own repository »), for `runward-fleet`;
  and the place of the view in decision 12's order (decision 1).
- ADR-0039, amendment of 2026-08-24: its first condition (« It lives in its own repository »), for
  `runward-fleet` and `runward-assess`; its fourth (« the aggregation is the operator's, computed from
  artifacts runward emitted and the operator holds »), for `runward-assess` (decision 5).
- ADR-0120 decision 8, once both records land: the closing sentence of its first bullet
  (« `runward-fleet` keeps its own repository (ADR-0093 decision 10) »).
- ADR-0052 part 3, branch A (decision 2).
- ADR-0109 decision 3 (« `check --json` keeps `mission` = the project root »), for a payload exported to a
  fleet (decision 7).

Dated notes land with this record on ADR-0093 (three) and ADR-0052 (one). The notes on ADR-0039 and
ADR-0109 land with the first code they govern. No accepted decision is rewritten

## Context

**What is decided, and what is built.** ADR-0093 decided that what runward shows is assembled from files
the CLI writes; that a customer-run satellite, `runward-fleet` (MIT, no vendor key), verifies signatures,
raises the cells it can prove and displays; and that a vendor-operated hosted product is a separate
product with its own repository, record and licence, built in D6 (decision 10, answer 2). It placed the
static fleet in D4 and the container in D5. None of it is built: on `main`, `packages/` holds
`runward-forge` only.

**A prototype, outside this repository.** On 2026-11-05 an index builder was written that reads, besides
its template and fonts, only the files an operator declares in an inventory (`check --strict --json`, the
unsigned attestation, the witness, the output of `verify` and of `report --format md`, bench logs). It
records the SHA-256 of each, computes the groupings a view must never compute (each with the list it
counts), and inlines the result into one HTML page. It reads no clock, no network and no repository,
imports no runward module, and refuses to build when a private filesystem path or the state
`machine-established` would reach the page. A static check holds part of the view rules: no banned word,
no refused colour, gold defined once and used by one class, nothing loaded from another host, no clock, no
computed percentage; the runtime half (one gold mark per view, a source on every figure) is left to a
browser check not written yet. The page reads the same index whether it is inlined or served as
`index.json`: that is decision 1.

**What the bench it displays measured.** Seven sabotages of the reference example, judged by 0.46.0 on a
fresh copy per run: the default Action refused 7 of the 14 sabotaged runs; the gate re-run on JUnit, lint
and coverage reports regenerated in CI refused 14 of 14, with no refusal on the 2 healthy runs. One
mission, one language: indicative, not a rate. It is why the run record of decision 7 matters, and the
subject of ADR-0122.

**Where money meets the architecture.** ADR-0052 part 3 waits for a named trigger before choosing a
structure; its branch A fires on any of three, the first being « a buyer pays the "evidence pack" invoice
line ». The investigations of 2026-11-05 found what a regulated buyer stops on: a counterparty,
contractual support, a maintained line, advisories that reach the databases buyers read. When such a buyer
contracts for an ICT service, Regulation (EU) 2022/2554 asks that the rights and obligations of both
parties be set out in writing (art. 30): a support or hosting offer is such a contract, and it needs a
counterparty able to sign it. Datadog's filings show the split this record keeps, with another licence on
the operated side: the API libraries and the agent its customers run to send data are licensed on an open
source basis, and the service that receives the data is proprietary (10-K for fiscal 2025; the S-1 of
2019 says the same of its agent).

## Decision

**One interface, two deployments. `runward-fleet` comes first: MIT, static, run by the customer. The
hosted product of the future company comes next and serves the same view from the same index. Everything
that judges, verifies or displays stays MIT; what is sold first is continuity and accountability, then the
hosted service under FSL-1.1-MIT; no euro is received before a legal entity exists and a lawyer has given
an opinion.**

1. **One interface, two deployments.** The interface is `runward-fleet`'s view: one page that reads one
   document, the index (`runward-fleet-index/0`, ADR-0093 note of 2026-11-06), inlined by the static build
   or served as `index.json` by the hosted product. The view reads no clock, fetches no other host and
   computes no state (ADR-0093 decision 11). First deployment: the operator runs `runward-fleet` in their
   own CI and publishes a static site. Second: the hosted product, operated by a company that does not
   exist yet, serves the same view. The view ships ahead of the deliveries that will fill it (D2 to D5):
   every cell they would fill reads `not-available`, and the page says why, as the prototype does. The
   trust policy, the signature verification and the raising of cells to `machine-established` stay where
   ADR-0093 D4 puts them, or, once ADR-0120 lands, its D4a and D4b. A hosted preview may run before D2 to
   D5 are delivered, operated by the maintainer for the maintainer's own repositories while no legal
   entity exists (ADR-0093 note of 2026-11-06, which amends answer 2 and decision 12 for a preview only).

2. **What stays MIT, and what is sold.**
   - Everything that judges, verifies or displays stays MIT: the CLI, `runward-fleet` (static site and
     container), `runward-run` (ADR-0120), `runward-assess`, `runward-forge`, and the recipes of ADR-0122.
     The view the hosted product serves is `runward-fleet`'s. The hosted product raises no cell:
     `machine-established` stays set by the satellite only, under the customer's trust policy (ADR-0093
     decisions 6, 8 and 11). What it shows at that state is what the customer's `runward-fleet`
     established, carried in the index that `runward-fleet` built; every other cell reads no higher than
     its record says.
   - The first paid offer sells continuity and accountability: a legal entity as counterparty, contractual
     support, a maintained line (fixes backported to a version the customer pins, for a contractual
     period; the backports are MIT and public, like every commit), and security advisories published with
     CVE identifiers within a contractual delay. Advisories stay public for every user (ADR-0086): what is
     sold is the commitment, never access to a fix.
   - The hosted product comes after that offer, under the licence of decision 3.
   - No euro is received before a legal entity exists and a lawyer has given an opinion on the offer, the
     licences and the trademark. Charging for runward, support included, may place it on the market in the
     course of a commercial activity under Regulation (EU) 2024/2847, with a manufacturer's obligations;
     whether and how is the opinion this decision puts before the first invoice, not after it.
   - ADR-0052 part 3, amended by name (note of 2026-11-06 on that record): branch A's first trigger reads
     « a buyer agrees in writing to pay the "evidence pack" invoice line », and the entity exists before
     that invoice is issued. Its other two triggers stand, as do branch B and the rule that no branch is
     chosen without a dated, named trigger. The invoice line stays ADR-0052's price test; under this
     decision it can only be a service line of the entity, since the code that assembles the pack stays
     MIT.

3. **The hosted product's licence: FSL-1.1-MIT, never called open source.** The Functional Source
   License, version 1.1, with the MIT future licence (SPDX `FSL-1.1-MIT`). Any use is permitted except a
   competing use: making the software available to others in a commercial product or service that
   substitutes for it, that substitutes for any other product or service the licensor offers using it and
   that exists as of the date the licensor makes it available, or that offers the same or substantially
   similar functionality. Each version becomes available under MIT on the second anniversary of the date
   it is made available. The licence covers the hosted product's own service code (ingestion, tenants,
   identity, retention, alerts, billing), in its own repository; it never covers code of this repository.
   Its authors call it a Fair Source licence; while its non-compete clause runs it does not meet the Open
   Source Definition, so nothing runward publishes calls the hosted product open source.

4. **Re-execution, by a runner the customer designates.** When the project's tests and tools are run
   again out of the agent's reach, and the gate re-run on what they wrote, the runner is one the customer
   designates, in a workflow the agent cannot write (ADR-0120 decisions 1 to 5). The company operates no
   executor for now: the hosted executor that ADR-0120 decision 11 assigns to the hosted product (D6) is
   not part of the hosted product's first versions, and those versions run neither runward, nor a test,
   nor the customer's code. Building that executor takes a record of its own.

5. **`runward-fleet` and `runward-assess` are packages of this repository**, `packages/runward-fleet` and
   `packages/runward-assess`, as `runward-forge` is (ADR-0094 question 1): MIT, released by the chain that
   releases `runward`, each with its own name and tarball. `runward-assess` is the collector and pure
   scorer of a repeatable assessment grid: its collector snapshots runward's outputs, other tools' results
   and public registries into a directory the operator holds, and its scorer is a pure function of that
   snapshot. Its first definition is a draft of 2026-11-05 outside this repository, not frozen, so this
   record decides where it lives, not what it scores.
   - **The boundary, in both directions.** The `runward` package imports nothing from either and ships
     none of their files; neither imports a module of runward's `src/` or `dist/`, and both read the files
     runward writes. For `runward-fleet` a test proves it, which is ADR-0093's D4 acceptance (« no runward
     import »): `test/unit/runtime-boundary.test.js` gains, with the package's first code, assertions of
     the shape it holds for `runward-forge`, with a planted import as positive control in each direction.
     Unlike `runward-forge`'s, they admit the dependencies signature verification needs; what they refuse
     is any path into runward's modules. The same assertions cover `runward-assess` when its first code
     lands.
   - **Distribution.** Until npm publishes them (the bootstrap `runward-forge` still waits on,
     RWD-2026-0195), they ship as an Action of this repository and as release assets the release chain
     attests, verified with `gh attestation verify` as the `runward-forge` asset is.
   - **What this amends.** ADR-0093 decision 10, « its own repository », for `runward-fleet`. ADR-0039's
     first condition for an adjacent product, « It lives in its own repository », read for these two
     packages as ADR-0120 decision 8 reads it for `runward-run`: a sibling package of the same repository
     and release chain, when the import boundary is tested in both directions and the `runward` tarball
     contains none of its code. ADR-0039's fourth condition, read for `runward-assess`, whose inputs are not
     all runward's: its result is computed from artifacts the operator holds, each recorded with its digest
     and its source, runward's outputs among them. And, once both records land, the closing sentence of the
     first bullet of ADR-0120 decision 8. ADR-0039's two other conditions stand: neither package enters the
     MIT CLI or makes runward operate a process.

6. **No red in the fleet view.** The view has no red and no green. A refusal is shown by inverting the
   page's two grounds, basalt and chalk, with its word and a diamond mark, so it reads in grayscale, in
   print and for a reader who does not tell colours apart (WCAG 2.2, success criterion 1.4.1, Use of
   Color). A red reads as an alarm and a green as an approval; a runward refusal is a finding with its
   cause, and ADR-0093 decision 9 already keeps a customer tool from reading « pass » on runward's word.
   The view's tokens are defined in `runward-fleet` with its first code: basalt `#191715`, chalk
   `#E9E4DB`, stone `#E1DCD2`, sage `#C9D2C6`, ink `#2A2622`, a warm black `#131110` for terminal blocks,
   and gold `#C9A45C` for the one proof mark of a view. It is a view rule with its test, as ADR-0093
   decision 11's are: every colour of the built page is one of these tokens or a transparency of one, and
   a planted red reddens the test. The CLI's terminal colours (`src/lib/styles.ts`) and the HTML report
   (`src/lib/report.ts`) are not changed by this record.

7. **Two new records, and a path that must not travel.**
   - **The run record.** What a runner the customer designates writes when it executes the legs of
     ADR-0120 decision 2 out of the agent's reach is the `runward-run` Statement of ADR-0120 decision 4
     (`https://runward.dev/run/v1`) and its signature bundle. `runward-fleet` displays it as a record of
     its own kind, beside the `runward.dev/record/v1` records and never mixed with them. It raises the
     run's cells to `machine-established` only when the signature verifies against the operator's trust
     policy and that policy pins that runner (the signer workflow, its commit and the repositories it may
     sign for, ADR-0120 decision 5), on the protected ref (ADR-0093 decision 8). An unpinned runner, or a
     signature that does not verify, raises nothing.
   - **The declared mission name.** Every record and index `runward-fleet` reads or writes names the
     mission by its declared name, `declaredMissionName` of ADR-0109 (the title of
     `runward/mission-contract.md`, or `mission`), never by a path or a folder: `runward.dev/record/v1`,
     the run record, the operator's declared inventory (`runward-fleet-manifest/0`) and the index.
   - **Measured on `main@32d8425`** (0.46.0 built from the tree, Node.js 24.22.1, macOS):
     `node dist/cli.js check --strict --json` exits 0, verdict `clean`, and its `mission` is the absolute
     path of the checkout, here a scratch directory whose path carries the operator's account name. It is
     the only absolute path in the payload. ADR-0109 decision 3 kept it on purpose (« the local payload
     says where it ran »), and `docs/interop.md` documents it. A fleet turns the payload into an export, and
     that reason does not travel with it: the prototype's index builder had to drop the field and to refuse
     any private path that would reach the page, and its replay rewrote the field before hashing each
     payload, so the digests its records carry are of bytes the CLI never wrote. For a payload exported to
     a fleet, ADR-0109 decision 3 is amended by name: the field is a defect, to be filed in the register
     (`docs/compliance/known-defects.md`), with its class, `affected-from` and fix decided when it is
     filed. The candidates are an additive field beside `mission`, under the additive rule of ADR-0024 and
     ADR-0030, or a change of `mission`'s value, which a consumer reads as a breaking change.

8. **The success criterion: time to first view, on repositories never seen.** `runward-fleet` succeeds
   when, on repositories on which runward's authors have never run it, the median time to a first view is
   five minutes or less, following only the published instructions. Each time is measured from a machine
   with git and Node.js and nothing of runward, to the first rendered view of that repository: its face
   sentence and its `n / N` per state, every figure with its source (ADR-0093 decision 11). The
   repositories are fixed before the first measurement and never tuned on; every time is published, with
   the median and the worst, never the best alone. A repository with no mission is a valid case: its first
   view says it has none, since silence is a finding. Datadog's S-1 put this promise at the centre of a
   self-service model (« Users can derive value […] within minutes without any specialized training »);
   five minutes is this record's target, not a measurement.

**The dated notes landing with this record.** On ADR-0093: a hosted preview may run before D2 to D5, on
the maintainer's repositories only, while no legal entity exists; the upload to the hosted product lives in
the hosted product's repository, never in the CLI, `action.yml` or `runward-forge`; the index contract,
`runward-fleet-index/0`, lives in `runward-fleet`. On ADR-0052: the first euro follows the entity.

## Alternatives discarded

- **Two interfaces, one per deployment.** The hosted view would drift from the MIT one, and an export
  replayed in a customer's container would no longer give the same site (ADR-0093, D6 acceptance).
- **The hosted product first.** Customer data would pass through a company that does not exist, before
  anyone has used, alone, the view it serves.
- **The hosted product raising cells itself.** It is not a satellite (ADR-0093 decision 10), and a cell the
  vendor raised would rest on the vendor's verification instead of the customer's policy.
- **Moving any code of this repository off MIT.** What judges, verifies or displays has to stay readable
  and runnable by whoever checks it, the customer and the customer's assessor first.
- **Another licence for the hosted product.** A proprietary licence contradicts the exit the export
  promises. The AGPL is an open source licence: a competitor may run the same service while publishing its
  changes, so it protects access to the source, not the company's offer. The Business Source License leaves
  its change date (at most four years) and its additional use grant to each licensor, where FSL fixes both
  in its text.
- **Selling the hosted product first, or selling verification.** A price per verification makes checking
  cost money. What a regulated buyer stops on is a counterparty and continuity, which the first offer sells.
- **`runward-fleet` in its own repository** (ADR-0093 decision 10 as written, ADR-0120 decision 8). A
  second release chain and a second set of protections for one maintainer, while a sibling package already
  gives the property a reviewer checks; the npm block would hold a second repository the same way.
- **A hosted executor now.** It needs the vendor identity, keys, contracts and entity ADR-0120 decision 11
  lists; none exists.
- **Red for refused, green for clean.** Colour alone fails the readers who do not see it, and it makes the
  page say « fail » and « pass », which runward never says on a customer's behalf.
- **Keeping the checkout path in exports and scrubbing it in each consumer.** Each consumer would rewrite
  bytes the CLI wrote, and the digest of an export would stop naming what the CLI emitted.

## Consequences

- **Positive.** One view to build, test and keep honest; the hosted product cannot show what the MIT view
  cannot, nor raise what the customer did not verify; the export is the exit, read by the same code at the
  customer's. The line between MIT and paid is one sentence a reviewer checks against each package's
  `license` field. The checkout path is named as a defect before any record carries it.
- **Negative, accepted.**
  - Three more packages in one repository (`runward-fleet`, `runward-assess`, and `runward-run` from
    ADR-0120), each with its boundary test, all packed and attested by the release chain, none on npm
    until the bootstrap.
  - A view that ships before the deliveries that fill it shows many `not-available` cells, for a long
    time, and says so.
  - A first offer of support and continuity costs the maintainer time a price has to cover, and no price
    exists before the entity and the opinion.
  - The success criterion can be missed in public: the median is published as measured.
- **On other boundaries.** The CLI is unchanged by this record: no upload flag, no URL, no knowledge of the
  hosted product (ADR-0093 decision 10, ADR-0039). `check --json` changes only when the defect of decision
  7 is fixed, under its own entry and record.

## What would settle it

- **Interface.** The same `index.json`, byte for byte, rendered by the static build and by the hosted
  product gives the same page (a golden test in `runward-fleet`); an export of the hosted product replayed
  in the customer's container gives the same index.
- **Boundary.** `test/unit/runtime-boundary.test.js` reddens on a planted import of runward into
  `runward-fleet` or `runward-assess`, and on a planted import of either into the `runward` package; the
  `runward` tarball contains neither.
- **No cell raised by the vendor.** An index served by the hosted product holds `machine-established` only
  where the customer's `runward-fleet` wrote it (a test with a planted one).
- **No red.** The view test reddens on a planted red colour.
- **Path.** No index, record or export `runward-fleet` builds contains an absolute path (a test with a
  planted one).
- **Time to first view.** Measured as decision 8 says, the median at or under five minutes; against, a
  median above it, published as measured.
- **Money.** No invoice before the entity's registration and the lawyer's opinion, both dated in the
  record that takes ADR-0052's structure decision.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier when: the legal entity is registered; the lawyer's opinion contradicts
decision 2 or 3; npm publishes `runward-forge`, which changes the distribution of decision 5; the first
measurement of decision 8 is published; a buyer refuses FSL-1.1-MIT for the hosted product in writing;
ADR-0120 lands with its decision 8 unchanged, and the two records are then reconciled by note.

**Trigger set on**: 2026-11-06 · **Watched via**: `test/unit/runtime-boundary.test.js`, the view's golden
and colour tests, the register, the published time-to-first-view measurements, and the record that takes
ADR-0052's structure decision.

## References

- [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) (amendment of 2026-08-24),
  [ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md) (part 3),
  [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
  [ADR-0086](ADR-0086-security-advisories-and-a-fix-time-target.md),
  [ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)
  (decisions 2 and 4),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
  (answer 2, decisions 6, 8, 9, 10, 11 and 12),
  [ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)
  (question 1),
  [ADR-0109](ADR-0109-the-mission-is-named-by-what-it-declares-never-by-its-checkout-folder.md)
  (decision 3); ADR-0119 and ADR-0120 (pull request #482); ADR-0122.
- `docs/interop.md`, `src/lib/styles.ts`, `src/lib/report.ts`, `test/unit/runtime-boundary.test.js`,
  RWD-2026-0195 in [known-defects.md](../compliance/known-defects.md).
- Regulation (EU) 2022/2554, art. 30; Regulation (EU) 2024/2847; WCAG 2.2, success criterion 1.4.1.
- Functional Source License, Version 1.1, MIT Future License (fsl.software and the SPDX entry
  `FSL-1.1-MIT`, read on 2026-11-06).
- Datadog, Inc., registration statement on Form S-1 (2019) and annual report on Form 10-K for fiscal 2025
  (SEC EDGAR, read on 2026-11-05).
