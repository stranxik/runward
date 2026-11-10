# ADR-0119 — Three levels of proof and one required level: each row says whether its evidence is re-derived by runward, attested or declared, and `--require` refuses below the level asked

**Date**: 2026-11-05
**Status**: accepted (2026-11-05). Constitutional, class R under ADR-0088 decision 2: it adds a term to the
verdict and reopens ADR-0060
**Deciders**: the maintainer, by delegation in chat on 2026-11-05, in these words (translated from
French): « runward must perhaps cover more than what we imagined. Everything has evolved. » and « In what
I have to do there are items that you can do, and where you even make recommendations to me. After having
investigated. So I trust you: carry it out each time instead of asking me. » Accepted on the
recommendation of the agent sessions that investigated (scratchpad inv-S1, inv-S2); the maintainer did not
review this text before acceptance. This is a delegation, not a review. The words were relayed to the
session that wrote this record by the session that received them. Under ADR-0088 decision 4 the
maintainer is the single accountable person, and the agent's writing is disclosed throughput, not
independent review; as ADR-0088 decision 3 asks, the act is recorded by an agent session (agent), for
`github:stranxik` (accountable). The delegation does not amend `runward/delegation.md`, where class R stays
the maintainer's and `scope-D` covers non-constitutional ADRs only: this acceptance stands outside the
charter, and the record lands when the maintainer approves its pull request
**Method**: read on a fresh clone of `stranxik/runward` at `main@61d5041`: `src/lib/verdict.ts`
(`computeVerdict`, `verdictFrom`), `src/lib/check-contract.ts` (`machinePayload`, `nextStep`),
`src/lib/attestation.ts`, `docs/spec/runward-signing.md` (§3, `signatureVerified`), ADR-0047, 0055, 0060,
0069, 0073, 0083, 0089, 0093, 0095, 0098. The flag of ADR-0114 as written on branch
`fix/symbols-outside-comments-and-vacuous-green`, which was not on GitHub on 2026-11-05 and was read in its
working copy: `--require <level>` with the levels `traced` and `mechanical`, ordered « so a later level
slots in by rank », `mechanical` the default of a full strict verdict, exit 5 when no gap stands and the
level is not met, `verdict.require = { level, met }`, and `verdictOutcome`, the one reading of the words
and the code. The sabotage measurements are ADR-0117's
**Relates to**: [ADR-0117](ADR-0117-the-verdict-measures-what-the-accountable-people-declared-against-what-the-agent-delivered-decisions-code-and-execution-each-at-a-named-level.md)
(the perimeter this record grades), [ADR-0120](ADR-0120-an-executor-outside-the-cli-runward-run-executes-the-tests-in-a-pinned-container-and-the-operators-ci-signs-what-it-wrote.md)
(where `attested` evidence comes from), ADR-0114 (the flag this record extends; in progress), ADR-0118 (the
analyzers that make `re-derived` reach code; in progress), ADR-0113 (`verify` says verified only for what
it re-derives; in progress)
**Amends, by name**: [ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md), reopened in the
form it wrote; [ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md), a term added to
the verdict; [ADR-0095](ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md),
the machine surfaces. Each receives its dated note with the code, one delivery ahead of it (ADR-0093's
practice); no accepted decision is rewritten

## Context

**ADR-0060 wrote the shape of its own reversal.** It kept a vacuous green green, disclosed, and added:
« If this ever becomes a refusal, it takes Jest's shape: a named opt-in flag, never a silent pass. »
ADR-0114 takes that step for one case: `check --strict --require <level>`, where `mechanical` (at least
one applied row carries a pointer the gate opened and checked) is the default of a full strict verdict and
`traced` accepts by name a green that rests on judgement alone; a run with no gap that does not meet its
level exits 5.

**What a reader cannot tell, measured on 2026-11-05.** Whether a row's evidence was recomputed by runward,
produced by something the agent could not reach, or written by the agent. `evidence.typed` counts the
pointers the gate opened; nothing records where the opened thing came from. A committed report is read as
it was committed (ADR-0098: freshness is not verified by `check`), and a hand-committed 93-byte ESLint JSON
satisfies `requires:`. The exit code and the last line are the same for the healthy mission and for each
sabotage of ADR-0117's table.

**What ADR-0117 needs.** Three objects at three named levels, and a way for a pipeline to ask for a level
and be refused below it.

**What the CLI may say about a signature.** Nothing it has checked: it never signs and never verifies a
signature (ADR-0093; `docs/spec/runward-signing.md` freezes `signatureVerified: false`). A level that
depends on a signature must say which checks the CLI made.

## Decision

**1. Three levels, for each piece of evidence an applied row cites.**

- **`re-derived`**: runward recomputes the fact from the tree, offline and deterministically. A pointer
  that resolves; a cited symbol present outside comments (ADR-0114); a sealed digest; an ADR that
  resolves; an analyzer's reading of the declared territory (ADR-0118). These are the **static** pieces.
  What a reader must trust: the tree and runward's version.
- **`attested`**: a fact runward cannot recompute, because it takes an execution: a test result, coverage
  of the cited lines, a mutation result on the cited lines, an eval, the report a `requires:` nature
  names. These are the **execution** pieces. An execution piece is attested when it was produced outside
  the agent's reach (ADR-0120) and passes three checks. Two are made by the CLI: the binding (the report's digest is a
  subject of a run Statement found in the tree, and the source digests that Statement records match the
  tree) and the presence of a signature on that Statement (counted, as `verify` already counts DSSE
  signatures, never verified). The third, the identity, is never checked by the CLI: the signature
  verifies against the operator's trust policy, in `runward-fleet` or in the operator's CI. What a reader
  must trust: also that identity and its executor.
- **`declared`**: a piece that rests on what someone wrote. A prose pointer; an execution report no
  attestation binds (ADR-0073 option 1 as shipped, a report the agent's own session produced); a run
  Statement that carries no signature.

**What is not graded.** The decision itself, an `n/a` or `deviated` answer and its reason, and a
ratification are what the accountable people declared: the reference the verdict measures against, not
evidence a level grades. A ratification trace stays declared provenance (the last sentence of
`GATE_NON_SCOPE`), and no level depends on it, so a mission that ratifies every row (ADR-0080 part 1)
reaches every level its evidence reaches.

A level qualifies how a fact was established, never whether it is true: a `file:` pointer to a document
re-derives that the document exists and resolves, not what it says.

**A row's level**, for each applied row: `declared` when it rests on a static piece runward could not
re-derive (a prose pointer); otherwise `attested` when it cites at least one execution piece and every
execution piece it cites is attested; otherwise `re-derived`, and each execution piece it cites that is
not attested is named beside it (« execution: declared »). This is ADR-0114's reading, refined: ADR-0114
reads a row listed in `evidence.proseRows` as declared and every other applied row as re-derived.

**2. One required level, on a ladder that extends ADR-0114 by rank**: `traced` < `mechanical` <
`re-derived` < `attested`. Each level includes the one below it.

- **`traced`** and **`mechanical`**: ADR-0114's, unchanged. ADR-0114 left one question to this record,
  whether `mechanical` stays « one row » or becomes a floor every row must reach. It stays one row: the
  floor every applied row must reach is a level of its own, `re-derived`, so no run that met `mechanical`
  under that name is refused under it later.
- **`re-derived`**: no applied row reads `declared`; and the declared territory is non-empty and analysed
  under the declared policy (ADR-0118), in languages the analyzers read. Execution pieces may still be
  unattested; each one is named.
- **`attested`**: `re-derived`, and no applied row cites an execution piece that is not attested, and
  every `requires:` nature an applied row rests on is met by an attested report. A row that cites no
  execution piece meets it at `re-derived`, since an attestation adds nothing to a fact runward recomputes.
  Where a row cites a code location and a test, and `runward-run` has a mutator for the language, the
  mutation fact of ADR-0120 is part of its execution evidence: the row is below `attested` when its cited
  tests kill no mutant of its cited lines through a failed assertion. Where the runner cannot tell a failed
  assertion from an error, the row is held to « at least one mutant of its cited lines killed », and every
  surface says the distinction was unavailable. Where no mutator exists for the language, the row reaches
  `attested` without the mutation fact, and every surface says so.

An attested row does not rank above a re-derived one because an attestation beats a re-derivation: as
evidence, an attested fact asks a reader to trust more (an identity and its executor). It ranks above
because it leaves nothing to the agent's word: its static pieces are re-derived, and its execution pieces
were produced out of the agent's reach.

**3. `--require <level>`, ADR-0114's flag, takes the four values.** A run with no gap that is below the
level it requires exits 5 (ADR-0114's code), names each row below the level and the piece that holds it
there, and `--freeze` refuses to seal it (ADR-0114). A gap stays exit 1 whatever the level; an unknown
level is a misuse, exit 2 (ADR-0083).

**4. Where the required level comes from, and the defaults.** For a full strict verdict: the flag, else
the mission's lock (`"requiredLevel"` in `runward/scaffold-lock.json`: a lock opt-in, so a class R act
under ADR-0088 decision 2, and on runward's own mission a change to a pre-merge path), else ADR-0114's
default, `mechanical`. A `--through` prefix requires `traced` unless the flag names a level: the lock never
applies to a prefix, because a declared horizon speaks for progress, never for a crossing (ADR-0053,
ADR-0114).

- **New missions.** `runward init` writes `"requiredLevel": "re-derived"` from the first release that both
  ships ADR-0118's analyzers and meets ADR-0117's criterion 2 (false reds measured on real repositories),
  as ADR-0069 made the structure contract the default for new missions. A new mission that is
  documentation only lowers it by name, in a diff a reviewer reads.
- **No mission is refused for its language.** A `re-derived` the lock asks for applies to the languages the
  analyzers read: when the declared territory holds files in a language they do not read, the run requires
  `mechanical` instead and says so on every surface, naming the language (« re-derived: not reachable,
  <language> is not analysed; this run requires mechanical »). Only `--require re-derived`, asked by name,
  refuses a territory in a language no analyzer reads. The same holds for the static half of an `attested`
  the lock or the regulated tier asks for. The level a run meets is never overstated: such a run meets
  `mechanical`, not `re-derived`.
- **Existing missions.** No verdict moves: `update` preserves the lock as it is, and every strict run
  prints the level the mission meets and the rows the next level would refuse.
- **The regulated tier** (ADR-0080) requires `attested` from one minor release after both `runward-run`
  and the verification half of D4 (ADR-0120) are published, with a migration notice in the release before
  it.
- **Never a default for an unregulated mission: `attested`.** It depends on infrastructure the operator
  runs (an executor in CI, a verifier), and ADR-0093 decision 1 keeps every function of the CLI working
  without a third-party tool.
- **runward's own mission** takes `re-derived` in the release that makes it the default for new missions,
  which means declaring the territory its analyzers read, or that release's CHANGELOG entry says why not.
  The product does not ask of others what it declines to do (ADR-0073).
- **The shipped example** meets `re-derived` in that same release: on 2026-11-05, 22 of its 24 applied
  rows carry a typed pointer and 2 are prose (measured with `init --example`), so those two become typed
  pointers first.

**5. What the CLI alone can refuse at `attested`, and what it cannot.** `check` re-derives the binding,
counts the signatures, and prints, at the character, « attested: the binding is re-derived by this
command; the signature is verified outside it ». Every payload the CLI writes carries
`signatureVerified: false`. On its own, the CLI refuses an unbound report, an unsigned Statement and a
mutation fact with no kill; it does not refuse a Statement a forger signed with a key of their own, which
only the identity check refuses. A pipeline that admits on `attested` therefore runs both, in a job the
agent cannot change (ADR-0120 gives the layout), and the CLI never presents a piece as attested in full.

**6. The machine surfaces, additive (ADR-0095's rule).**

- Each applied row of `conformance[]` in `check --json` carries `proof: { level, pieces: [{ pointer,
  kind: "static" | "execution", level, setsLevel }] }`; a row that is not applied carries none.
- The strict block carries `levels: { required, source: "flag" | "lock" | "default", met, rows: {
  "re-derived": [...], "attested": [...], "declared": [...] } }`, each count with its list (ADR-0095
  decision 2, ADR-0093 rule R1). ADR-0114's `require` key keeps its shape.
- `verify` re-derives each new field on its own, only when present (ADR-0095), and says verified only for
  what it re-derives (ADR-0113).
- The attestation predicate carries the level met. The VSA's `verificationResult` reads `PASSED` only on
  exit 0 (ADR-0114), and the level met travels as one more custom `verifiedLevels` value, never an `SLSA_`
  one (ADR-0055, amendment of 2026-08-17).
- The witness lists the levels under `notWitnessed` until its checker re-derives them (ADR-0089,
  increment 2).
- The text output, the SARIF properties and the delivery report name each row's level. No surface sums
  levels into a percentage (ADR-0093's view rules).

**7. ADR-0047: the term is computed where a test reaches it.** The levels are computed in the library
(`src/lib/verdict.ts` and the evidence modules) and read by every surface through ADR-0114's
`verdictOutcome`; `check.ts` decides nothing. This is a change that adds a term to the verdict, which is
ADR-0047's own trigger, and each piece of the term is pinned in both directions.

**8. ADR-0060, reopened in the form it wrote.** The refusal takes Jest's shape, a named flag, and its
values extend by rank; no level becomes a silent pass, and `traced` stays the named way to accept a green
that rests on judgement alone. ADR-0060's disclosure stays on every mission.

## Alternatives discarded

- **One word for the whole run, no level per row.** A count that travels without its list (ADR-0095): a
  reader would know the run is below its level and not which row holds it there.
- **`attested` as the default of every mission.** It needs an executor and a verifier the operator runs;
  every upgrade would turn red on missions that have neither (ADR-0093 decision 1).
- **`re-derived` at the top of the ladder**, every row recomputable by runward. The CLI runs nothing, so
  every execution claim would be refused: a top level no software mission can reach.
- **One exit code per level.** One meaning per code (ADR-0083); exit 5 already says « no gap, the level is
  not met » (ADR-0114), and the level is named in the output and the payload.
- **The CLI verifies the signature itself.** ADR-0093 decided it never does: a trust root and a
  cryptographic dependency would enter the verdict path, and a signature is checked where the trust policy
  lives. Counting signatures is not verifying them, and `verify` already counts them.
- **Grade the ratification and the decision too.** A ratification is declared by nature, so every row of a
  regulated mission (ADR-0080 part 1) would read `declared` and `attested` could never be met; and the
  decision is the reference the verdict measures against, not evidence of the delivery.
- **`attested` read from the report's own statement of provenance** (a property written into the report).
  The writer would declare its own independence, the defect ADR-0098 named in its option C.
- **A percentage of re-derived rows as the level.** ADR-0093's view rules forbid a composite percentage,
  and ADR-0046 refuses a score as a crossing condition.

## Consequences

- **Positive.** At the level it requires, the exit code and the last line now differ between the healthy
  mission and a sabotaged one. A reader sees, row by row, what rests on the agent's word. ADR-0060's
  disclosure becomes a refusal by name, and the reading an enterprise pipeline needs has a name,
  `attested`.
- **Negative, accepted.** A larger payload; one more lock opt-in, a class R act; existing missions see one
  more line until they opt in; a mission whose territory holds a language no analyzer reads runs at
  `mechanical` under a lock that asks for `re-derived`, and says so; a row in a language with no mutator
  meets `attested` without the mutation fact and says so; three more fields `verify` must keep
  re-deriving.
- **On other boundaries.** No crossing of ADR-0054 is touched: every level is computed from the tree, and
  the identity check stays outside the CLI. ADR-0090's assurance modes are untouched: a mode says who
  controls the acts, a level says where the evidence came from.
- **Nothing ships with this record.** The levels land with ADR-0114's flag, ADR-0118's analyzers and
  ADR-0120's executor, each in its own pull request on the charter's pre-merge paths.

### What this does not catch

- **A test written to defeat the executor**: one that reads the code under test as bytes, or prints
  results it did not compute. `attested` says the pinned executor produced the report from this tree, not
  that the agent's code behaved while it ran; ADR-0118's test-integrity family is where such tests are
  named.
- **A weak assertion**, one that kills a mutant of the cited lines and misses the others. The survivors are
  listed, never summed; the reader judges.
- **A wrong requirement with green tests, prose, intent, and who ratified.**
- **A signature from an identity the trust policy should not have trusted.** The policy is the operator's.

## What would settle it

**For**:

- On the sabotage table of ADR-0117, replayed with the release that ships this record and ADR-0118, on
  the shipped example as that release ships it (its two prose rows typed): `--require re-derived` exits
  non-zero on rows 1 to 7 (5 when the level is the only failure, 1 when a gap stands) and 0 on the two
  controls; `--require attested`, with `runward-run`'s reports bound to the tree and signed, exits 5 on
  row 8 and names the row and its mutation fact, and exits 0 on the controls.
- A hand-committed 93-byte ESLint JSON, a forged one-case JUnit report and an unsigned Statement the agent
  wrote, consistent with the tree, each read `declared` and exit 5 at `attested`. A Statement the agent
  signs with a key of its own reads `attested` in the CLI, with `signatureVerified: false`, and is refused
  by the identity check (ADR-0120, D4a).
- A regulated mission whose every row is ratified reaches `attested` when its evidence does (the
  ratification is not graded), measured on a fixture.
- A mission whose territory holds a file in a language no analyzer reads, under a lock asking for
  `re-derived`, exits 0 at `mechanical` with the line that names the language; under
  `--require re-derived` it exits 5.
- On every fixture of the attack corpus, each row's level equals the level of its least independent piece,
  and a planted mismatch reddens a unit test; every count travels with its list; `check --strict --json` is
  byte-identical across two runs on an unchanged tree; the new fields make no attestation written by 0.46.0
  fail on an unchanged tree (ADR-0095's additive rule).
- The « attested: ... » sentence is printed at the character wherever `attested` is read, and
  `signatureVerified` is `false` in every payload the CLI writes, both pinned by tests.

**Against**: on the real repositories of ADR-0117's criterion 2, an honest mission that must type pointers
by hand or lower its level on more than half of its applied rows to reach `re-derived` (the ladder is
drawn in the wrong place); one report, issue or assessor's reading that takes the CLI's `attested` for a
verified signature despite the sentence; one consumer found branching on a row's level as if it were the
verdict.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-05, or earlier when: ADR-0114 merges with another shape for `--require` (this record
then follows its names and keeps the ranks); the first adopter requires `attested` in CI; a false red at
`re-derived` on a real repository; the verification half of D4 ships, which raises the question whether
its result may enter a file the CLI reads, a question this record leaves closed under ADR-0093.

**Trigger set on**: 2026-11-05 · **Watched via**: the attack corpus with the sabotage table, the payload
golden tests and `check-contract`'s tests, and the published classification of findings on real
repositories (ADR-0117, criterion 2).

## Note, 2026-11-06: `re-derived` and `attested` land with ADR-0120's R1, in part

`check --strict --require` takes the four values of decision 2, by rank (`src/lib/evidence-levels.ts`,
read by `verdictOutcome` as ADR-0114's levels are). Delivered: each applied row's level and its pieces
(decision 1), `re-derived` (no declared row, the declared territory analysed under the pinned policy,
a language the analyzers do not read named and refused under the flag) and `attested` (also, every
execution piece bound to the tree by a signed run Statement, and every `requires:` nature carried by an
attested report); exit 5 below the level, naming each row and what holds it (decision 3); the CLI's
two checks of decision 5, the binding re-derived and the signatures counted, the sentence at the
character on the terminal and in the payload, `signatureVerified: false`; the `levels` block of
`check --json`, present only when the run requires `re-derived` or `attested`, so every other payload
keeps its bytes (decision 6, additive), re-derived by `verify` with the rest of the payload. Each row's
`proof` travels in `levels.rows` rather than on `conformance[]`, which lists only refused rows.

Not delivered, each to land in its own change: the required level read from the mission's lock and the
language fallback under it (decision 4), so `source` is `flag` in every payload today; `init` writing
`"requiredLevel"` for new missions; the level printed on every strict run whatever it requires; the SARIF
properties, the delivery report and the witness naming each row's level (decision 6); a `verifiedLevels`
value of the VSA. The shipped example still answers one row in prose (`topology-usage-registry-present`
cites its own manifest), which `re-derived` refuses: the laboratory of ADR-0120's tests types it, the
example does not yet. The mutation fact of decision 2 waits for ADR-0120's R2: until then every surface
says that no run Statement bound here carries a mutation leg.

## Note, 2026-11-06 (later): the lock, the fallback and the surfaces of decisions 4 and 6

Delivered on a second branch, each piece pinned by `test/unit/levels-lock.test.js`:

- **The lock** (decision 4). A full strict verdict reads `"requiredLevel"` in `runward/scaffold-lock.json`
  when `--require` names none (`lockRequiredLevel`, `requiredLevel(opts, lock)` in `src/lib/verdict.ts`);
  a `--through` prefix never reads it; a value that is not a level is refused before the gate runs, exit
  2 (ADR-0083), the flag included, so a typo never reads as a weaker level. `levels.source` is `lock`.
  `update` carries the line through as written, a refused value included, and writes none on its own:
  the writer rebuilds the lock, and RWD-2026-0106 is what happened when a lock opt-in was not one of its
  parameters.
- **The fallback** (decision 4). A `re-derived` the lock asks for, on a territory holding a language the
  analyzers do not read, requires `mechanical` (`require.level`), says so at the character in
  `levels.fallback` and on every surface, and `levels.below` then names only what holds the run, a
  declared row staying listed under `rows.declared`. For an `attested` the lock asks for, the static half
  falls and the name is kept; the sentence adds « for its static half, and attested for its execution ».
  Asked by name, `--require re-derived` still refuses the territory. Measured on `init --example` with
  `code/tools/convert.py` added: exit 0 under the lock, `require: { level: "mechanical", met: true }`,
  exit 5 under the flag.
- **Every strict run prints the level the tree meets** and what the next level would refuse, read at
  `attested` for the terminal only, so the payload, the renderings and the exit code of a run that asks
  for no upper level keep their bytes. On `init --example`: « level of proof this tree meets: mechanical;
  the next level, re-derived, would refuse 1 row(s) that rest on a declaration ». On runward's own mission:
  mechanical; re-derived would refuse 1 row that rests on a declaration, and the mission pins no analysis
  policy.
- **The surfaces** (decision 6), each only when the run reads the levels: the SARIF run's property bag
  (`levels`, each applied row named under its level), the witness (a `levels` member, and the family
  `levels` under `notWitnessed` in that witness alone, `docs/spec/witness.md` 7.8), the delivery report and
  the job summary (a table of each applied row at its level, and what holds it below), and the VSA (one
  more `verifiedLevels` value naming the level met, never overstated: `RUNWARD_PROOF_RE_DERIVED`,
  `RUNWARD_PROOF_ATTESTED`, or `RUNWARD_PROOF_MECHANICAL` under the fallback, by the ladder of decision 2).
  The attestation predicate already carried the level through `require` and `levels`. `status` names the
  level the lock asks for. `gate-hook` names `mechanical`: the session gate's question is gaps (ADR-0065),
  and an `attested` level needs a run the session cannot make (ADR-0120).

Not delivered, and why. **`init` still writes no level**: this decision moves the default of new missions
in the first release that meets ADR-0117's criterion 2, and no classification of false reds on three real
repositories is published. The switch is one constant, `NEW_MISSION_REQUIRED_LEVEL` in
`src/lib/evidence-levels.ts`, read by `init`; the release that flips it also types the shipped example's
prose row (`topology-usage-registry-present`), takes `re-derived` on runward's own mission or says why not
in its CHANGELOG entry (the mission pins no analysis policy today, and its lock is a pre-merge path), and
regenerates the goldens that row reaches. The text output names each row below the level and counts the
others, listed in `--json`; it does not print every row's level.

## Note, 2026-11-06 (R2): the mutation fact of decision 2

With ADR-0120's R2, `attested` reads the mutation of the cited lines (`src/lib/mutation-targets.ts`,
`docs/spec/runward-run.md` §7). A row that cites a code location and a test is below `attested` when its
cited tests kill no mutant of its cited lines through a failed assertion, as decision 2 writes it; held to
« at least one mutant killed » where no failure carries the distinction; reaching `attested` without the
fact where runward-run has no mutator for the language. One reading this record did not spell out, made
here: a row whose cited lines hold no operator the mutator changes (a port's interface, a type) kills no
mutant of them, so it is below `attested`, read as written: neither exception applies, and such a row
cites the lines that implement what it claims. Two rows of the shipped example cite an interface that
way; the laboratory of ADR-0120's tests also cites the adapter that implements each, the example does
not yet.

## Note, 2026-11-06: two readings of the notes above, decided under the delegation of 2026-11-05

Taken under the maintainer's delegation of 2026-11-05 ("carry it out each time instead of asking me"),
on the recommendation of the agent session that built the lock, R2 and R3, and recorded by the session
that merged them into the third integration train; the maintainer did not review them before they were
written, and each stands until he reverses it.

- **A row whose cited lines hold no mutant, a port's interface or a type, stays below `attested`.** The
  reading of the R2 note holds as decided: neither exception of decision 2 applies to such a row, and it
  is kept because it closes the sabotage on those lines. Were it lifted, a row could reach `attested` by
  citing lines no mutant can reach, whatever its cited tests assert. The row reaches `attested` by also
  citing the lines that implement the interface, as the laboratory of ADR-0120's tests does.
- **`NEW_MISSION_REQUIRED_LEVEL` moves to `re-derived` only in the release that publishes the
  classification of ADR-0117's criterion 2 at zero false reds**, and that release also types the shipped
  example's prose row (`topology-usage-registry-present`), with the other work the note on decisions 4
  and 6 lists. Until that release, `init` writes no level.

## Note, 2026-11-06: the condition of decision 4 met at `51675dc`, and what the move waits on

ADR-0117's criterion 2 holds at `51675dc`: [the measurement of the analyzers on three repositories runward
did not write](../compliance/analyzers-on-real-repositories.md), published with its commands and with the
classification of every finding by reviewer sessions that did not write the analyzers, reads zero false reds
on express, fastify and hono, and the head of the third integration train reads the same 227 ids. The
condition this decision sets on the default of new missions is met.

`NEW_MISSION_REQUIRED_LEVEL` does not move in that train. Measured on its tree with the constant set to
`re-derived`: a new mission that follows the blank template is refused, exit 5, on
`topology-usage-registry-present`. The rule keeps the usage registry in `execution-topology.md` and the
template puts it there, so the row's one pointer is at the manifest itself, which the gate does not open as
evidence: the row is `declared`, below `re-derived`, and the audit corpus's honest case AC-015, a
documentary rule citing the section that states the fact, reads exit 5 where it is accepted today. The move
is made with the coherence of that rule and the template, in the pull request that follows the third
integration train, so the release that publishes the classification carries both. Decided under the
maintainer's delegation of 2026-11-05, on the recommendation of the session that measured it; the
maintainer did not review it before it was written.

## Note, 2026-11-06: the default of new missions moved, with the usage registry in a file of its own

`NEW_MISSION_REQUIRED_LEVEL` is `re-derived`: `runward init` writes `"requiredLevel": "re-derived"` in a new
mission's lock, as the note above on two readings decided, ADR-0117's criterion 2 being published at zero
false reds. What the note above found in the way is gone. `topology-usage-registry-present` now says the
registry lives in a file of its own, `runward/governance/usage-registry.md`, cited by deployment from the
row, and `execution-topology.md` points at it; the blank template ships that file (a seventeenth mission
template), so a new mission that follows it cites a file the gate opens, and the row is `re-derived`.
`templates/rule-history.json` gains the rule's new text and loses none. The shipped example cites its
registry in that file, so `init --example` meets the level it asks for, 24 applied rows re-derived and none
declared, and the goldens it reaches are regenerated; the goldens of runward's own mission keep their bytes.
The audit corpus's honest case AC-015 cites the section of the registry's own file and is accepted; no
refusal case is added, since the corpus holds vectors once found and closed, and the one reading this move
needs in the other direction, a pointer at the manifest itself read `declared` below the level, is held by
`test/unit/levels-lock.test.js` and `test/unit/run-binding.test.js`. The metamorphic relations MR-1, MR-2,
MR-3 and MR-5 compare the whole judgement but `levels.execution.expected`, the inventory a run Statement is
bound to (ADR-0120 decision 4), which lists the files by path and digests the manifests' bytes, the bytes
those relations change.

runward's own mission does not take the level: it pins no analysis policy, so its territory is not
analysed, and its lock is a pre-merge path. Measured at the head of the pull request that moves the
default, `check --strict --require re-derived` on it exits 5 with 20 applied rows re-derived and 1 declared,
its usage registry row, which still cites its own manifest. Decided under the maintainer's delegation of
2026-11-05; the lock of runward's mission and its copy of the rule change in the same pull request, a
pre-merge path the maintainer approves.

## References

- [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md),
  [ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md),
  [ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md),
  [ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md),
  [ADR-0069](ADR-0069-the-structure-contract-is-the-default-for-new-missions.md),
  [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md),
  [ADR-0075](ADR-0075-a-required-nature-the-project-cannot-produce.md),
  [ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
  [ADR-0083](ADR-0083-exit-code-two-carries-several-meanings-say-which-before-splitting-it.md),
  [ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
  [ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md),
  [ADR-0095](ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md),
  [ADR-0098](ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md).
- `src/lib/verdict.ts`, `src/lib/check-contract.ts`, `src/lib/attestation.ts`,
  `docs/spec/runward-signing.md` §3, `runward/scaffold-lock.json`.
- Jest's `--passWithNoTests` and pytest's exit code 5, the prior art ADR-0060 and ADR-0114 cite.
