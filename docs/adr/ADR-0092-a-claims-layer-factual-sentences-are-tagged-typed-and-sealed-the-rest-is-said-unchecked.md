# ADR-0092 — A claims layer: the factual sentences of the documents that bind are tagged, typed and sealed; the rest is said unchecked

**Date**: 2026-10-13
**Status**: proposed (2026-10-13) — drafting approved by the maintainer on 2026-10-13 as item 2 of the
work order of ADR-0090 ("make important factual sentences checkable, with a detector for untagged
ones"); revised the same day to the maintainer's principle that the layer costs no human time by
default (Context, last paragraph; decisions 3, 4, 6 and 7). Nothing is built by this record. Its class is one of the maintainer's decisions below: as
designed, the layer is a CI job and a unit test outside the verdict path; it becomes class R under
ADR-0088 decision 2 if claims ever become mission evidence (decision 9). An agent wrote this record
and only proposes; the maintainer decides (ADR-0088 decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: a fresh clone of `stranxik/runward` at `origin/main@928cd3f` (PR #381 merged), read on
2026-10-13: ADR-0021, 0045, 0050, 0080, 0088, 0090; `src/lib/claims-rules.ts`;
`src/lib/conformance.ts` (`rowDigest`, `readRatification`, `unboundRatifications`); `src/lib/ratify.ts`;
`test/unit/documented-commands.test.js` and `scripts/documented-commands.mjs` (TOR-210 to TOR-212);
`test/unit/tor-traceability.test.js`; `test/unit/adr-proposed.test.js`; `runward/delegation.md`;
`docs/compliance/known-defects.md` (RWD-2026-0166); `AGENTS.md`, `SECURITY.md`, `README.md` and
`docs/verifying-a-release.md` as they stand on that commit. Two state-of-the-art reports written for
the maintainer on 2026-10-13, outside this repository, in French (controlled languages, mathematical
vernaculars and checkable documentation; formal languages for legal text); their figures are cited
below as theirs, with their limits. One measurement made for this record: the first-parent commits of
`main` from 2026-09-01 to 2026-10-13 that touch the four scoped files, each commit's files read with
`git diff --name-only <commit>^1 <commit>`
**Relates to**: [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md),
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md),
[ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md)
**Amends, by name**: none. ADR-0090 carries a dated note pointing here; its decisions are not rewritten.

## Context

**The seed nobody saw.** The first sample period of ADR-0088 ended `control missed`: a seed made
Step 3 of `docs/verifying-a-release.md` say the trusted root is not needed offline, and the review
accepted it. ADR-0090 then measured that no machine control catches that class (a false sentence in
prose), and built M6: the guide's commands held to `verify-release.yml` and executed at pull-request
time. M6 catches the seed only if the seed changed a command, or rewrote the one sentence of the
form "N files suffice: …" (TOR-212). A test pins the rest as a blind spot: adding "Offline, the
trusted root is not needed." to Step 3 leaves everything green.

**What runward has today against a false sentence.** Four kinds of check, scattered, none with an
identifier, and none that notices a sentence that is new:

| Check | Where | What it judges |
|---|---|---|
| guide and workflow run the same commands | `test/unit/documented-commands.test.js` | commands, not prose |
| "N files suffice: a, b and c" equals the files of the offline command | same test, `fileClaimProblems` | one sentence shape, against its own words |
| presence pins | `hooks-claim.test.js`, `one-accountable-person-claim.test.js` | that a sentence is there or absent |
| forbidden overclaims | `claims-rules.ts`, `no-overclaim.test.js` (ADR-0050) | absence of a word pattern |

The overclaim guard is right for its job and wrong for this one. Its `NEGATED` screen exempts any
line carrying "not", "no", "never", "without"…, because an overclaim argued against is not an
overclaim. ADR-0090 measured the consequence for prose: the seed's sentence carries "not" and is
exempt. False security sentences are often negative ("is not needed", "never reads", "no network").
For a layer that checks facts, a negation is a marker, never an exemption.

**What the research measured** (report on controlled languages, 2026-10-13; one reader, no double
coding, so orders of magnitude, not a reproducible measure). The 281 sentences of
`docs/verifying-a-release.md` (68), `SECURITY.md` (41) and `README.md` (172), each classed by the
claim that carries it:

| Class | Count | Share |
|---|---|---|
| checkable: a parser and one deterministic check (tree, offline CLI, YAML, release API or npm registry on an immutable object) | 111 | 40 % |
| checkable with effort: a dedicated harness, history, a third party, admin rights, or a universal property | 72 | 26 % |
| not checkable: sufficiency arguments ("Proves", "Does not prove"), intention, positioning, instruction | 98 | 35 % |

About 15 of the 281 are touched by an existing check; one ("Three files suffice") is checked against
its own words. The second report (formal languages for legal text), cutting the same two files
differently, counted 50 statements in `SECURITY.md` and 84 in the guide, against 41 and 68: the
segmentation itself moves the denominators by a fifth, which is why this record fixes its unit (one
tagged sentence) rather than a share of a file. Reading the files "as claims" surfaced, in passing,
sentences a typed check would flag and a person would settle: a future tense ("expected 0.43.0") that
the published release has overtaken, a ratio ("24 of 41 versions") with no date anchor while npm lists
more versions, a count ("for three releases") whose cited source names one, and a count that disagrees
with its own section title ("six gated phases" under "six phases, five of them gated"). Whether each
still holds is for the pull requests that own those files; they are cited here as the kind of defect
the layer is for, not as defects established by this record.

**The detector, measured** (same report, same reader). A lexical heuristic flags a sentence carrying
at least one of: a backticked fragment, a number, "exit", a quantifier or modal (every, never, only,
must, requires, refuses, fails, suffice, within, until), a necessity word (need, needed, optional,
offline, online, without), a file extension, a `--flag`.

| True class | Flagged | Rate |
|---|---|---|
| checkable | 93 of 110 scored | 85 % recall |
| checkable with effort | 54 of 72 | 75 % |
| not checkable | 27 of 98 | 28 % flagged (the false positives) |

The report scores 110 checkable sentences where its class table counts 111; the source does not
explain the difference. Of the 174 flagged sentences, 27 (16 %) carry nothing to check and 54 (31 %)
need effort. The necessity lexicon was added after a first pass missed the seed's sentence, so that
part is fitted on one example. The misses are mostly navigation links and claims with no lexical
marker ("Runward is MIT"); the false positives are maxims ("Every switch is an ADR."). A lexical
detector is a good alarm and a bad judge.

**What the prior art agrees on** (both reports). No project checks the meaning of free prose, Catala
included: the formal-law languages either pair each passage with a rule written beside it (the
fidelity of the pair stays a human matter), or restrict the language to a grammar that translates
mechanically (Logical English, Attempto, EARS for form only). Executable documentation (doctest,
rustdoc, Concordion, Dafny's `check-examples`) checks what a marked fragment designates, never the
prose around it, and the marking is invisible to the reader (Dafny's directives are HTML comments).
TOR-212 is already a minute controlled language of that kind: a regular expression as grammar, a
lexicon (`fileKind`), a semantics (the files the offline command names).

**The churn the cost depends on** (measured for this record). Of the 150 first-parent commits on
`main` from 2026-09-01 to 2026-10-13 (merges and squash merges), 26 touch at least one of the four
scoped files: `SECURITY.md` 9, `README.md` 7, `AGENTS.md` 6, `docs/verifying-a-release.md` 6. That is
about four a week, an upper bound on the change events the layer handles, since most of those
commits add sentences rather than rewrite them. Under the default of this record each event is
re-checked by a machine, so the figure bounds CI work, not a person's time.

**Why this record was revised** (2026-10-13). The first draft made a person re-ratify every changed
tagged sentence, within a budget of at most two batches and 30 minutes a week. The maintainer stated
the product principle it contradicts, on 2026-10-13: "in the end runward must be able to frame AIs in
a fully automated way, and not cost the organisation more time. That is runward's objective." The
layer is therefore designed so that its default human cost is zero: the verifier is the gate, what
cannot be measured is disclosed and counted rather than sent to a person, and human ratification of
sentences is an option of the assurance modes of ADR-0090 that an adopter chooses, never the default.

## Decision

**In declared zones of the documents that bind, a factual sentence carries an invisible tag naming a
claim. The claim has a type from a closed registry; each type has a deterministic verifier that reads
the asserted value from the sentence's own words, and a positive control. The sentence's text is
sealed by a digest; a changed sentence is detected by its digest and re-checked automatically by its
type's verifier, which is the gate; a changed `declared` sentence is disclosed and counted, never sent
to a person. No step of the layer waits on a human gesture by default; human ratification of
sentences exists only as an option of ADR-0090's `sampled` and `per-act` modes, chosen by the adopter. A detector reports the factual-looking sentences of a
zone that carry no tag, and, after a measured first phase, refuses new ones. No model is in any of
it. The layer checks bounded classes of sentences and says so; free prose stays unchecked, and every
surface that reports the layer says that too.**

1. **The tag.** `<!-- claim: <id> -->`, an HTML comment, invisible in rendered Markdown, placed on
   the same line immediately after the sentence it binds. The bound sentence runs back from the tag
   to the previous sentence end, tag, heading, list marker or table cell boundary. One tag, one
   sentence. Ids are lower-case kebab words, unique across the registry, never reused once retired.
   Two further forms:
   - `<!-- claim: none: <reason> -->` on a flagged sentence that asserts nothing checkable (a maxim,
     an intention, a sufficiency argument). The reason is mandatory and is published in the job's
     count.
   - a tag whose registry entry has the type `declared` (decision 3), for a commitment that is a fact
     but cannot be measured.

2. **The zones, and how they grow.** The registry (decision 5) declares the scope as a list of zones,
   each a file and optionally a heading whose section it covers. The first scope:
   - `docs/verifying-a-release.md`, whole file;
   - `SECURITY.md`, whole file;
   - `AGENTS.md`, the section "Boundaries (never)";
   - `README.md`, the section "Commands" (the command table: options, files produced, exit codes),
     plus the sentences the existing presence pins already hold. The rest of the README, mostly
     positioning, stays out until its own measure says otherwise.

   A zone is added by a pull request that changes the registry and tags the zone's sentences in the
   same change; it enters in report mode (decision 6). Removing a zone, retiring a claim, or turning a
   typed claim into `declared` is a shrink of the net, and the job judges it by machine: every run
   publishes the zones, the typed count and the declared count against the base branch. A claim
   retired with its sentence (the sentence deleted from the zone) is disclosed with its text and
   counted as retired. A pull request that keeps a typed claim's sentence but drops its tag or turns
   it into `declared` or `none`, or that removes a zone, fails the job, naming the shrink; the one
   machine-recorded exception is the withdrawal of a type after a false green (decision 7, failure).
   Narrowing the net otherwise is a change of this record by a new ADR, not an operation of the layer;
   no label, acknowledgment or ratification is asked of a person on the way.

3. **The first registry of claim types.** Closed: a type not in this list is `claim-malformed`. Each
   type has a grammar (the sentence shapes it accepts), a verifier, and a positive control (an
   altered sentence or an altered system on which the verifier must fail). **The verifier reads the
   asserted value from the sealed sentence, never from the registry.** The registry names only where
   the truth is (a step, a workflow path, a command). A rewritten sentence is therefore judged on its
   new words, on the pull request that rewrites it, with no person in the loop; this is what lets
   "Two files suffice" fail although the registry entry did not change.

   | Type | Sentence shape (grammar) | Verifier | Positive control | Runs where |
   |---|---|---|---|---|
   | `file-set` | "N files suffice: a, b and c" | N equals the items listed, and their kinds equal the files the step's offline command names; generalises `fileClaimProblems` (TOR-212) | the sentence rewritten to two files, the trusted root dropped, fails (exists today) | unit test, no network |
   | `not-needed` | "X is not needed for step Y [offline]", and its dual "X is required for step Y" | static: the step's command does not name X (resp. names it); dynamic: the documented-commands job runs the step without X and expects exit 0 (resp. non-zero) | "the trusted root is not needed for Step 3 offline" fails: Step 3 without `--custom-trusted-root`, network cut, exits 1, a control the job already runs | unit test, and the documented-commands job for the dynamic half |
   | `duration` | "within N days", "kept N days", "for N months" | bound to a config value (`retention-days`, a cron, a date in a table) when the entry names one; otherwise the claim must be typed `declared`, never `duration` | the number changed in the sentence, or in the config, fails | unit test, no network |
   | `count` | "N <things>" where the registry names the source set ("six gated phases" against the phases that carry a gate) | the number equals the cardinality of the named source | N off by one fails | unit test, no network |
   | `exit-code` | "`<command>` exits N", "exit N" in a sentence with a backticked command | the command run in a throwaway directory against a fixture the entry names | the expected code changed fails | unit test, offline; a networked command only in the job |
   | `version-ref` | "expected X", "from X", "since X", "releases from X" | X compared with the released versions (npm `versions` and the release list): "expected X" fails once X is published; "from X" fails if X is not published | "expected" naming an already-published version fails | the job (network), never the unit test |
   | `n-of-m` | "N of M <things>", "for N releases" | recomputed from the source the entry names; a source that is a live service requires a date anchor in the sentence ("as of YYYY-MM-DD") and a committed receipt, and the check is the receipt and the anchor | the ratio changed, or the anchor removed, fails | unit test (receipt), the job (live source) |
   | `flag-present` | "`runward <cmd> --x`", "the `--x` option" | `--x` appears in `runward <cmd> --help` of the built CLI | a renamed option fails | unit test, no network |
   | `declared` | any sentence no other type's grammar parses (a `declared` tag on a sentence a type parses is refused) | none; displayed « declared, not measured » with its id, on every surface that counts claims; a changed one is disclosed with its word diff and counted (decision 4) | not applicable: it has nothing to fail, and says so | none |

   A type enters the registry with its verifier and its positive control in the same pull request, or
   not at all. The commitments of `SECURITY.md` ("within 7 days of the report") start as `declared`:
   their truth needs the timestamps of private advisories, an admin token and a scheduled job; what
   is cheap today (the same number in `SECURITY.md` and ADR-0086) can be a `count`-like consistency
   check later, and is not one of the first types. The declared count is published on every run so
   that it is a number the project works down: it falls only when a declared claim is turned into a
   measured type, and a new declared sentence is shown as an addition, never folded into a total.

4. **The seal, and what a change triggers.** The registry stores, per claim, the sentence text with
   whitespace folded, and its digest computed by the existing `rowDigest` with the claim id as rule,
   the type as status, and `<file>: <sentence text>` as evidence. Re-wrapping a paragraph does not
   change a digest; changing one word, one digit, one backtick or the file does. The pull request that
   changes a tagged sentence updates its row (text and digest, written by the layer's script, never by
   hand); the unit test refuses a row whose text or digest does not match the tagged sentence.
   - **What the seal is for.** Detecting and disclosing change, not demanding a person. The job
     compares each claim's digest with the base branch's: a claim whose digest moved is `changed` in
     that pull request. RWD-2026-0166's lesson is applied from the start: every surface that counts
     claims (the job's summary, its JSON, the counters) reads the digest, so a changed claim is never
     counted as unchanged anywhere, and a sentence cannot be reworded under an old row.
   - **A changed typed claim** is re-checked by its type's verifier on its new words in the same run.
     The verifier is the gate: pass, the change merges like any other green change; fail, the job
     fails with the reason. No ratification is asked.
   - **A changed `declared` claim** is not sent to anyone. The job prints it as « declared, not
     measured; changed », with its id, file and the sentence before and after as a word diff, and
     counts it in the summary and the JSON. The disclosure is the whole treatment: what cannot be
     measured is said to be unmeasured, every time it moves.
   - **The human leg, optional, per assurance mode** (ADR-0090 decision 1). Under `machine` and
     `machine+critical`, nothing in this layer asks for a human gesture: no ratification block is
     required and none is read as missing. Only when the mission's charter sets `mode:` explicitly to
     `sampled` or `per-act` (an absent `mode:`, which ADR-0090 reads as `sampled` for compatibility,
     does not switch it on) does the layer offer a human leg, over the existing writer and reader:
     `runward ratify --claims --list` (writes nothing) shows per changed claim its id, type, file,
     word diff, verifier result and positive-control result; `--accept` writes one line per batch in a
     `### Ratification` block read by the existing `readRatification`, with the existing `bound:
     id@digest` segment, no second format. Under `per-act` the changed claims of a pull request join
     its approval; under `sampled` they join the population the period's sample is drawn from. In both
     the digest binds what the person saw, so a sentence changed after the gesture shows as changed
     again. An agent may run `--list`; it never writes a ratification line by hand (`AGENTS.md`).
   - **What this layer does not change.** Who approves a change to `SECURITY.md` or `AGENTS.md` is
     ADR-0088's and ADR-0090's (class R, and the critical list of `machine+critical`); the layer adds no
     gesture to it and removes none. The ADR-0021 amendment's trap (a seal re-signed on every commit
     trains re-signing without reading) does not arise by default, because nobody signs; where an
     adopter opts in, the batches are counted (decision 7) so the trap shows up as a number.

5. **The registry, and its own traceability.** One file, `docs/claims/registry.md` (format
   `runward-claims/1`): the zones; one table row per claim (id, type, file, the source the verifier
   reads, the sealed text, the digest); and, only under the opt-in of decision 4, the ratification
   block. A unit test holds it as `tor-traceability.test.js` holds the requirements register: ids unique; every tag in a zone has a
   row and every row a tag; every row's digest matches its text; every type has a verifier and a
   positive-control case whose name is present in the test file; the parse is not empty (an
   extraction floor, as `documented-commands.test.js` has). Each type also gets its TOR entry when it
   is built, with its "Does not assert".

6. **The coverage rule, and its phase-in.** In a zone, a sentence the detector flags and that
   carries no tag (`<id>`, `none: <reason>`, or a `declared` claim) is *untagged*. The detector is the
   report's marker list with negation and necessity as markers; the `NEGATED` screen of
   `claims-rules.ts` is not reused, and ADR-0050's guard is unchanged.
   - **Phase A, report (four weeks from the day the job first runs on `main`):** untagged sentences
     are listed, never refused. The sentences present at the start are a baseline: their count is
     published and must not grow; the work of tagging them is done zone by zone, in report mode.
   - **Phase B, refuse, zone by zone, only if phase A meets its criteria (decision 7):** a pull
     request that adds or changes an untagged flagged sentence in a zone fails the job, naming the
     sentence and the three ways out (a typed tag, `declared`, `none: <reason>`). Sentences of the
     baseline are not refused, only counted. Order: `docs/verifying-a-release.md` and `AGENTS.md`
     boundaries first, then `SECURITY.md`; the README zone stays in phase A until its own waiver
     share is measured.
   - **The false-positive cost, said in advance.** On the research sample, about one flag in six
     carries nothing to check and would need a `none` waiver; about one in three needs effort and
     would start `declared`. Waivers are written by whoever writes the sentence, an agent included,
     and are judged by machine: a `none` on a sentence that one type's grammar parses is refused, as a
     `declared` tag is (decision 3), so a waiver cannot hide a checkable claim. A guard that cries on the safe case gets switched off (`claims-rules.ts`,
     design rule 1); the waiver keeps the cry to one comment, and phase A measures how many.

7. **The measurement plan, before generalisation.** Fixed now, before anything is built.
   - **Seeds.** An agent plants prose seeds on throwaway branches, never merged, each recorded in a
     committed ledger with its class, placement and the job run's URL. Four classes, from the
     research and the first period: a false *not-needed* (the first seed's class), a wrong *count*, a
     stale *version* ("expected" a published version), a *negated* claim (a negative sentence that is
     false). Three placements for each: (P1) a tagged sentence rewritten; (P2) a new sentence in a
     zone, untagged; (P3) a new sentence outside every zone. Five seeds per class and placement: 60
     seeds. Plus two controls the planter does not choose: the first seed re-planted in both variants
     (command changed; sentence only), and five marker-free paraphrases in a zone ("you can skip it
     when disconnected"), expected missed.
   - **What counts as caught,** published separately and never added together: *caught by a
     verifier* (P1: the job fails on the sentence's own words); *flagged by the detector* (P2: listed
     as untagged); *disclosed only* (P1 on a `declared` claim: the job prints the change as « declared,
     not measured; changed » and counts it, but nothing judges its truth, so this never counts toward
     the machine rate); *missed*. P3 and the paraphrases are expected missed; they are published as
     the layer's blind spots, the way ADR-0090's seed counter publishes missed classes.
   - **Human gestures,** over the same four weeks, measured from the job's own record: the number of
     runs whose outcome waited on a person's action (a ratification line, a label, an acknowledgment,
     a comment) under `machine` or `machine+critical`. Beside it, machine-judged figures only: the
     detector's flags on new prose, `none` waivers and their share of those flags (the false
     positives), `declared` claims added, changed and turned into types, and the declared count's
     trend. Where an adopter opts into the human leg, its batches per week and claims per batch are
     reported beside, outside the criteria below.
   - **Success** (all of): the re-planted first seed is caught in both variants, the sentence-only one
     by the `not-needed` verifier or the coverage rule; P1 caught by a verifier on at least 18 of 20
     typed seeds, and at least 4 of 5 in every class; P2 flagged on at least 16 of 20, and at least 4
     of 5 negated seeds; zero human gestures required by default, measured as above; waivers at most
     30 % of flags on new prose; every changed `declared` claim of the period disclosed in the job's
     output, none counted as checked.
   - **Failure** (any of): a typed claim found passing on a false sentence (a false green), which
     withdraws that type to `declared` until its verifier is fixed and re-measured; P1 below 3 of 5 in
     any class after one round of fixes; waivers above 30 % of flags (phase B does not start, and
     the detector is reworked or the zone narrowed); any step of the layer found to need a human
     gesture under `machine` or `machine+critical` (that step is redesigned to be machine-judged or
     disclosed before anything is generalised); a changed `declared` claim absent from the job's
     output.
   - **Generalisation** (more zones, more types, the rest of the README, any ADR "Decision" section,
     claims for adopters' missions) waits for success, and for this record to be accepted.

8. **What the job prints, and what it never claims.** The job is `claims` (a workflow and a script,
   like `documented-commands`); the unit test is in the required suite as M6's parity test is. Its
   summary, at the character:

   > claims: N sentences bound in Z zones: T typed and checked (by type), D declared, not measured;
   > C changed in this change (V re-checked by their verifiers, K declared and disclosed); U untagged
   > factual-looking sentences (baseline B).
   > Checked: the bound sentences of the declared zones, each against its type's template. Not
   > checked: prose outside the zones, untagged prose the detector does not flag, and the meaning of
   > any sentence beyond its type's template.

   Then one line per failing, changed or untagged sentence, with its file and line, and a word diff
   for each changed `declared` claim. Under an opted-in human leg (decision 4) the summary adds the
   ratification state; under `machine` and `machine+critical` it has no such line, because nothing
   is awaited. It never says
   "the documentation is verified", "the docs are true", or that a zone is checked as a whole; the
   claims guard of ADR-0050 gains those shapes as forbidden, with this summary as the `instead`.
   `runward check` prints nothing of the layer: it is not on the verdict path (decision 9). Whether
   the job becomes a required check is the maintainer's setting, as for M6 and M3.

9. **The verdict path, and the class.** As designed, the layer reads documents and runs commands in
   CI; the verdict path opens no socket, runs no git and reads no clock (ADR-0054), and gains nothing
   here. Its building pull requests touch `.github/**`, on the critical list of ADR-0090 decision 10,
   so they wait for the maintainer whatever the class. Two future moves would change the class to R,
   each by its own record: claims becoming mission evidence (a manifest row citing a claim, read by
   `check`), and the layer added to runward's own charter as a `machine-controls:` addition to the
   ADR-0090 floor (the charter is class R). Neither is decided here.

10. **The first seed's blind-spot pin.** The pull request that builds the `not-needed` type updates
    the pinned blind spot of `documented-commands.test.js` in the same change: the sentence-only seed
    is then refused by the layer, and the pin's record says by which check, as its comment requires.

**The maintainer's decisions** (each with a recommendation).

1. **Adopt the layer and its first registry** (decisions 1 to 5 and 8), and its class: recommended,
   class D as designed, outside the verdict path, with class R reserved for the two moves of
   decision 9. Alternative: class R now, on the ground that the coverage rule governs how
   `SECURITY.md` promises and `AGENTS.md` boundaries may be written.
2. **The phase-in of the coverage rule:** recommended, as decision 6 (four weeks report-only, then
   refuse zone by zone on the measured criteria, the README last). Alternatives: refuse from day one
   in the guide only (the seed's file), accepting an unmeasured waiver cost there; or report-only
   indefinitely, which keeps the blind spot of ADR-0090 open for new sentences.
3. **No human re-ratification by default:** recommended, as decision 4. A changed typed claim is
   re-checked by its verifier, which is the gate; a changed `declared` claim is disclosed and counted;
   human ratification of sentences is an option of the `sampled` and `per-act` modes of ADR-0090,
   set explicitly by the adopter, never the default. runward's own mission runs `machine+critical`
   (ADR-0090 decision 10), so the layer asks the maintainer for nothing in operation. Alternative,
   discarded by the principle in Context: the first draft, the maintainer re-ratifying every changed
   claim in batches within a weekly time budget.

## Alternatives discarded

- **A person re-ratifies every changed tagged sentence** (this record's first draft, at most two
  batches and 30 minutes a week). It makes the organisation pay in time for every edit of a bound
  document, contrary to the maintainer's principle of 2026-10-13, and it walks into the ADR-0021
  amendment's trap of re-signing without reading. The verifier judges what is measurable; what is
  not is disclosed, which is what a re-ratifier under time pressure would have added at best.
- **An LLM that reads the prose and judges it.** Non-deterministic, outside ADR-0001's core, and the
  research found that even round trips with equivalence proofs do not secure fidelity to the source
  text. A model may at most propose tags on flagged sentences, advisory, as ADR-0090 decision 4 allows
  an LLM leg; it never decides a tag, a verdict or a ratification.
- **Rewrite the documents in a controlled language** (Attempto, Logical English). Coherence among
  rewritten sentences is not their truth against the system, and the cost of keeping a lexicon and
  a grammar over 281 sentences, 35 % of which assert nothing checkable, exceeds the gain.
- **Tag without sealing the text.** A registry that stores the asserted value lets a sentence drift
  from it silently; a tag without a digest lets a sentence be reworded under its old seal.
  Both repeat RWD-2026-0166 one level up.
- **Seal without a coverage rule.** The first seed added a sentence; a seal sees only sentences that
  are already tagged. The coverage rule is what turns the pinned blind spot into a refusal.
- **Reuse the overclaim guard with new patterns.** Its `NEGATED` screen exempts exactly the negative
  sentences this layer exists for, and its unit is a forbidden shape, not a claim with a truth source.
- **Whole files in scope from day one.** The research sample suggests about 174 flagged sentences in
  three files; tagging them all before measuring the waiver cost repeats the ADR-0021 amendment's
  lesson (seal what has stopped moving), and the README is mostly positioning.
- **A second ratification format for claims.** runward already has one, digests included, and a
  defect register entry (RWD-2026-0166) on what happens when one surface forgets to read the digest.

## Consequences

- The class of the first seed becomes catchable for bounded sentence shapes, and a new factual
  sentence in a zone becomes visible, then refusable. Free prose, paraphrases without markers,
  sufficiency arguments and intentions stay unchecked, and the job's summary says so every run.
- A tagged sentence can no longer change silently: a typed one is re-checked by its verifier, a
  declared one is disclosed with its diff and counted. The default human cost is zero, and the
  measurement plan holds it to that; an adopter who wants a person on sentences opts in through the
  assurance mode.
- What is declared stays unmeasured, and the layer says so on every run rather than handing the
  question to a person; the published declared count is the work left, falling only as declared
  claims become types.
- A typed claim whose verifier is too weak is a false green with a tag on it, which reads stronger
  than an untagged sentence. The positive control per type and the failure criterion that withdraws a
  type to `declared` are what keep that from becoming the layer's main output.
- The detector will flag maxims; each flag costs a `none: <reason>` comment, counted and published.
- The ADR-0090 seed counter gains a meaning for the prose class: caught by a typed verifier, flagged by
  the detector, or missed, published separately.
- Cost to build: a parser for tags and zones, a registry and its test, eight verifiers each with a
  positive control, the base-branch digest comparison, an optional `ratify --claims` path over the
  existing writer and reader (built only with the opt-in modes), a job, and the seed ledger.

## What would settle it

- The four weeks of decision 7 run: the seed catch rates per class and placement, the re-planted first
  seed in both variants, the paraphrase controls, the waiver share, the declared claims disclosed, and
  the count of human gestures required by default (expected zero), published with the success and
  failure criteria fixed above, unchanged.
- The `not-needed` verifier run once against the first seed's sentence-only variant, and the
  `version-ref` verifier once against the guide's Step 8 as it stands on the day it is built.
- A second reader classing a sample of the 281 sentences, so the 40 / 26 / 35 split and the detector's
  rates have an agreement figure.

## Reevaluation trigger (mandatory, dated)

Reopen when the four-week measurement ends, or on 2027-01-13 if the layer is not built by then, or
earlier on: a false green on a typed claim; a waiver share above 30 % in any zone in phase B; the
step of the layer found to need a human gesture under `machine` or `machine+critical`; a changed
`declared` claim missing from the job's output; a false sentence reaching a
release in a zone; an adopter asking to carry claims as mission evidence (decision 9, class R).

**Trigger set on**: 2026-10-13 · **Watched via**: the `claims` job summary, the seed ledger, the weekly
digest.

## References

- ADR-0090, Context ("What the machine controls show") and the notes of 2026-10-13 on M6 and M3.
- `test/unit/documented-commands.test.js`, `fileClaimProblems` and the pinned blind spot, at
  `origin/main@928cd3f`.
- `src/lib/conformance.ts`, `rowDigest` and `unboundRatifications`; RWD-2026-0166 in
  `docs/compliance/known-defects.md`.
- The two research reports of 2026-10-13 (outside this repository, French): the 281-sentence
  classification and the detector measure; the formal-legal-language survey (Catala, ICFP 2021; Logical
  English, LPOP 2020; the OECD and Canadian Rules as Code reports) and its 4 findings on the guide.
- The churn count: `git log --first-parent --since=2026-09-01 origin/main` at `928cd3f`, each commit's
  files from `git diff --name-only <commit>^1 <commit>`, matched against the four scoped files,
  2026-10-13.
