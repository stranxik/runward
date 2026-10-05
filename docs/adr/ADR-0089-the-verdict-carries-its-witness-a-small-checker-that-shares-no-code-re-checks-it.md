# ADR-0089 — The verdict carries its witness: a small checker that shares no code re-checks it, before any second implementation

**Date**: 2026-10-05
**Status**: proposed — constitutional, class R under ADR-0088 decision 2 (it touches the verdict path):
the maintainer decides; an agent wrote this record, so no agent decides it (ADR-0088 decision 4,
applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: `ROADMAP.md` ("The strongest form of proof, as the best of the category does it", item 1),
`src/lib/verdict.ts`, `conformance.ts`, `evidence.ts`, `mission.ts`, `scaffold-lock.ts`,
`attestation.ts`, `check-contract.ts`, `src/commands/verify.ts`, ADR-0001, ADR-0007, ADR-0045,
ADR-0047, ADR-0054, ADR-0055, ADR-0087 and ADR-0088, `test/audit-corpus.js` (AC-001 to AC-016),
`test/unit/manifest-fuzz.test.js`, `test/unit/runtime-boundary.test.js`,
`docs/compliance/mutation-register.md` and `ratchet-summary-0.43.0.json`, all read on the branch of this
ADR (base `main` after #362, runward 0.43.0). Measured on 2026-10-05 (Node 24.18.0, macOS arm64, git
2.50.1, while another job was running the test suite on the same machine, so the timings are rough):
the verdict's import closure; `check --strict --json` on this repository; eight candidate metamorphic
relations applied to the example mission and judged by `computeVerdict`; a 111-line prototype checker,
written for this record in a scratch directory and not committed, run against `computeVerdict` on 18
missions; a mock witness built from the facts the verdict reads, to size it. The literature was read at
the source where it could be, on 2026-10-05; what could not be read is said beside each entry.
**Relates to**: [ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md) (one verdict,
decision 4 "No second opinion"), [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (the five
crossings; "same working tree, same verdict"),
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) (the attack corpus's origin),
[ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md) (the attestation `verify`
re-derives), [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) (the mutation
register), [ADR-0087](ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md) (the kit
that would carry the checker), [ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)
(the class of this record)
**Would amend, by name, once accepted**: none. Decision 3 states how the checker sits beside ADR-0047
decision 4 without changing it.

## Context

**The ROADMAP item.** Wave 3 of the reliability roadmap opens with "a reference model of the verdict and
a differential test", after Cedar, and names four pieces for runward: "a canonical mission snapshot, a
generator of missions with metamorphic properties, a certifying verdict that a small separate checker
verifies, and that checker grown into an independent second implementation." This record investigates
what each piece would be on the tree as it is, what it would cost, in what order, and what each step
would and would not show.

**The verdict path, measured.** `computeVerdict` (`src/lib/verdict.ts`) is a pure function of the
mission on disk. Its transitive import closure is 15 modules, 6,090 lines, 3,561 of them code (blank
and comment lines removed); it imports `node:fs`, `node:path` and `node:crypto` and nothing that opens a
socket or spawns, which `test/unit/runtime-boundary.test.js` asserts (ADR-0054 crossing 1). Its result
depends on more than the mission tree: the shipped `templates/` of the runward version that runs it
(`artifactState` compares each deliverable with its template, `corpusDivergence` compares the rules with
the published hashes in `templates/rule-history.json`), and on markers above the mission
(`repoRootAbove` looks for `.git`, `pnpm-workspace.yaml` and three others, up to 24 levels). So the
exact form of the ADR-0054 contract is "same tree and same runward version, same verdict".
`computeVerdict` took about 100 ms on the example mission and 180 ms on this repository's mission.

**What the machine output exposes, measured on this repository.** `check --strict --json` exits 0 and
writes 7,365 bytes: the verdict, counts by family, the list of violations, an evidence breakdown (46
rows, 21 applied, 3 deviated, 22 n/a, 20 typed, 33 evidence files), the corpus status, the seal, the
ratification ledger, the delegation reading. On a green run `conformance` is an empty list. **The payload
names what failed; it does not name what was checked and held.** No row, pointer, resolved path or
digest of a green run is in it, so nothing outside runward can re-check a green verdict from it; it can
only re-run runward.

**`runward verify` re-derives, with the same code.** `verify` recomputes the mission-state digest and the
verdict and compares them with an attestation's predicate field by field (the fix that followed three
auditors rewriting `evidence`, `seal` and `gateNonScope` unnoticed, recorded in `verify.ts`). It calls
`computeVerdict`. It catches a tampered attestation and a drifted tree; a defect in `computeVerdict` is
reproduced by it, not caught. `missionStateDigest` hashes `runward/` and the cited evidence; it does not
hash the templates or the root markers the verdict also reads.

**What the test net already holds near the verdict.**

- *The attack corpus* (`test/audit-corpus.js`): 16 cases, AC-001 to AC-016, 12 `REFUSE` and 4 `ACCEPT`,
  each the example mission altered once and judged by the exit code of the real CLI. Every case is a
  defect that was found and closed.
- *The manifest fuzz* (`test/unit/manifest-fuzz.test.js`, fast-check 4.10.2, fixed seed `0xC0FFEE`):
  500 malformed manifests never throw and never pass an uncovered expected rule; the same manifest read
  twice gives the same rows and the same `conformance()` result; re-aligning a row's whitespace never
  changes the digest its ratification binds to; rewriting the evidence always does. It works on one
  synthetic deliverable and one rule, at the level of `parseManifest`, `conformance` and `rowDigest`,
  not on a whole mission through `computeVerdict`.
- *Same tree, same verdict*: `runtime-boundary.test.js` asserts two `check --strict --json` runs on an
  unchanged example mission are byte-identical; `delegation-charter.test.js` and
  `delegation-sample.test.js` assert the charter and sample readings do not depend on the clock.
- *The mutation register* (2,229 filings in 24 modules). The verdict closure carries most of it:
  `mission` 707 (671 `hole`), `evidence` 332 (221), `delegation-sample` 281 (281), `conformance` 202
  (147), `delegation` 131 (131), `verdict` 51 (37), `workflow-contract` 33 (33), `identity` 30 (30),
  `scaffold-lock` 28 (15). A `hole` here means "nothing in the net caught it": 820 of the 1,784 `hole`
  rows say "COULD NOT CLEAR — filed as a hole because no measurement decided it", and the 452 filings
  of the three modules added in 0.43.0 have not been through pass 2.

**Eight metamorphic relations, measured today.** A metamorphic relation is, in the survey's words, "a
necessary property of f over a sequence of two or more inputs" (Chen et al. 2018); its use is that "it
is not necessary to investigate whether P(xi) = f(xi) for any individual test case". Each relation below
was applied once to the example mission (`init --example`, green) and the result judged by
`computeVerdict` with `strict: true`:

| Relation | Expected | Observed | Tested today? |
|---|---|---|---|
| Add or rename a file no row cites, outside `runward/` | verdict unchanged | unchanged, whole result identical | no |
| Reverse the order of a manifest's rule rows | verdict unchanged | exit, counts and violations identical; `requiresUnmet` listed in the new row order | no |
| Re-pad every row with extra spaces | unchanged | unchanged, whole result identical | row digest only (fuzz) |
| Convert a manifest to CRLF | unchanged | unchanged, whole result identical | rules (AC-013) and seal, not manifests |
| Add an `n/a` row with a real reason for a known rule the phase does not expect | unchanged | exit and violations identical; the evidence breakdown counts one more row | no |
| Delete a file a row cites | green to red | exit 1, four `unresolved-pointer` | by example (unit tests, corpus) |
| Duplicate one row | green to red | exit 1, `duplicate-row` | by example |
| Empty the evidence of one `applied` row | green to red | exit 1, `applied-without-evidence` | by example |

All eight hold on this one mission. Two hold only up to list order or a disclosed count, which a
canonical snapshot of the result must state (sort the lists, or compare the verdict and its violations
as sets). Each variant (copy, alter, judge, then the prototype below) cost about 0.25 s.

**What a "certifying" verdict means, at the source.** McConnell, Mehlhorn, Näher and Schweitzer (2011):
"A certifying algorithm is an algorithm that produces, with each output, a certificate or witness
(easy-to-verify proof) that the particular output has not been compromised by a bug." The checker "is an
algorithm for verifying that w proves that y is a correct output for x"; "the checker is so simple that a
trusted implementation of it can be produced, perhaps even in a different language". Two limits they
state themselves: "it does not suffice for the checker to be a simple algorithm. It is equally important
that it also easy for a user to understand why w proves that y is a correct output for input x" (sic),
and "we do not know that the program will work correctly for all inputs, we only know it for instance x".
"Certifying" is their technical term for an algorithm that emits a witness; it says nothing of any
certification, and this record calls the artefact a **witness** for that reason.

Translation validation is the same move applied to a compiler: Necula (2000) "compares the intermediate
form of the program before and after each compiler pass and verifies the preservation of semantics", and
found it could be built "with about the effort typically required to implement one compiler pass".
CompCert uses it where proving the transformation is costly: "the compiler is complemented by a validator
... that verifies the property S ≈ C a posteriori" (Leroy 2009), and Rideau and Leroy (2010) note the
cost of the arrangement, "weaker completeness guarantees": a validator can refuse a correct output.

**What Cedar does, at the source.** "How We Built Cedar" (FSE 2024): "writing an executable model of the
system and mechanically proving properties about the model; writing production code for the system and
using differential random testing (DRT) to check that the production code matches the model; and using
property-based testing (PBT) to check properties of unmodeled parts". Proofs found 4 bugs in the
validator, "DRT and PBT helped us find and fix 21 additional bugs". What is not modeled: "our parsers are
not modeled in Lean"; and a limit of the generators: "we did not discover some parser bugs triggered by
malformed policies because our test generators create abstract syntax trees of Cedar policies and thus
are limited to produce only syntactically correct policies." The Amazon Science post (May 2023), when the
model was in Dafny: "we run DRT for six hours nightly and execute on the order of 100 million total
tests". The model moved to Lean (Cedar RFC 0032; the Dafny formalization deprecated in cedar-spec 3.1.0,
2024-03-08), and "A new version of Cedar isn't released unless its model, proofs, and differential tests
are up to date" (AWS Open Source blog, April 2024). The advisory GHSA-c33x-vcv4-vg3g (published
2026-06-25, low): malformed JSON policy templates with `is in` conditions, where "the slot identifiers
were silently corrected", so "the linked policy is then semantically different from the malformed policy
the user intended". Two precisions the ROADMAP sentence needs: "decision divergence" in the advisory is a
divergence from the author's intent, not a reported divergence between the model and the
implementation, and the advisory does not say how the defect was found; that the path was not modeled is
consistent with the FSE paper (parsers not modeled, generators producing only well-formed policies), not
stated by the advisory. And "100 million" is the post's figure for "total tests", not explicitly per
night.

For runward the lesson transfers in one direction especially. Every verdict defect this record cites,
from the register and from the code it read (RWD-2026-0006, 0007, 0026, 0110, 0115), was in reading
text: the pointer grammar, the manifest sections, line terminators, a renamed heading. That is the part
Cedar leaves unmodeled, and a model taking a parsed manifest as its input would leave it out too.

**A prototype checker, measured.** To size a checker before recommending one, a re-derivation of the core
of `check --strict` was written in a scratch directory: 111 lines of code, Node built-ins only, importing
nothing from runward. It re-derives the rule corpus against the lock and the published history, the
expected rows per gated phase and the mapping floor, the single `Rule conformance` section outside
fences, unknown and duplicate rows, statuses, `n/a` reasons, `deviated` and `adr:` resolution across the
three journal locations, unratified ADRs, and for each pointer: resolution in the three bases, a regular
non-empty file, inside the project by real path, not the rule corpus, and a self-citation only when the
cited symbol lies outside the manifest table. It does not re-derive deliverable state against templates,
the seven report natures (JUnit, SARIF, ESLint, coverage, SBOM, load tests), line counts, symbols in
other files, signatures, scaffold-identical files, on-disk spelling, the seal and drift, the regulated
tier, the charter and sample, or workflow contracts.

Run against `computeVerdict` on 18 missions (the example, this repository's own mission, and the 16
corpus missions), its first version agreed on 16. **The two disagreements were both in the pointer
grammar, and both re-introduced defects runward had already fixed**: it accepted `file:src/a.ts#`, a
pointer naming nothing (AC-011, the class of RWD-2026-0006), and it truncated the quoted form
`file:...#"Usage registry"` at its first space and refused an honest documentary citation (AC-015). After
those two fixes it agreed on 18 of 18 and on the 11 variants of the table above. Two readings, both kept:
a second implementation finds real disagreements cheaply (the differential test works), and a second
implementation written from the code's behaviour by someone who has not read its history makes the same
mistakes the first one made and paid for (agreement on 18 cases chosen because they were once wrong says
little about the 19th).

**Sizing a witness, measured on a mock.** A witness built from the facts the verdict reads (the version,
each rule file's digest, each ADR's digest and status, each gated deliverable's digest and expected set,
each row with its digest, each applied pointer with its resolved path, digest and the check it needed)
is 19,807 bytes compact for the example mission (46 rows, 26 pointers to 15 files, 64 rules) and 29,915
bytes compact, 43,597 pretty-printed, for this repository's mission (46 rows, 66 pointers to 33 files):
about six times the current `--json` payload.

**Two kinds of facts.** A witness can carry a fact the checker *re-checks* cheaply against the tree: this
file's normalized SHA-256 is this; this row's text at this line has this digest; this pointer resolves,
by this base, to this real path inside the root; this symbol is on this line; this JUnit case is at this
offset with no failure child; this ADR's status word is this. A witness cannot carry an absence: that no
expected rule lacks a row, that no second section exists, that no table row was left out of the witness,
that no pointer in a cell was silently dropped. Those the checker must *re-derive*, and they are the
small part: the expected set (rule frontmatter), the sections (headings outside fences), and one
conservative test that every `file:`, `test:` and `adr:` occurrence in a cell is covered by a witnessed
pointer or a disclosed prose spelling, which refuses the silent-drop class (RWD-2026-0006, RWD-2026-0026)
without re-implementing the grammar.

## Decision

**runward emits, on request, a witness of each strict verdict: the facts the verdict relied on. A small
checker that shares no code with runward re-checks the facts and re-derives the absences, on runward's
own CI and in the qualification kit. Its answer never changes `check`'s exit code. The full second
implementation and any formal model come later, each behind a trigger.** The order:

**Increment 1, the first useful one.**

1. *A canonical mission snapshot* (test support, not shipped): the files the verdict reads, as a sorted
   map of path to bytes, plus the runward version and the digests of the templates it compares against;
   `snapshot(dir)` and `materialize(snapshot)` with a round-trip property; a canonical rendering of a
   `Verdict` with every list sorted, so a relation that holds up to order can be asserted byte for byte.
2. *A mission generator and the eight relations above in fast-check*, fixed seed and bounded runs in the
   unit suite like the manifest fuzz: missions derived from the example mission by random operators
   (rename an uncited file, reorder rows, re-pad, CRLF, add an unexpected `n/a` row, delete a cited
   file, duplicate a row, empty an `applied` cell), including byte-level ones that produce malformed
   manifests, Cedar's lesson on generators. At the measured 0.25 s a variant, 40 runs per relation is
   about 80 s; the run count is set from a CI measurement, not from this estimate.
3. *The witness*: `check --strict --witness <file>` writes it, opt-in, beside the unchanged `--json`
   payload (six times its size otherwise). Its schema is versioned like the attestation predicate
   (expand only) and documented in `docs/spec/witness.md`, which is the checker's only specification. It
   names what it does not cover (`notWitnessed`), and a refusal's witness is the failing facts.
4. *The checker*: `checker/check-witness.mjs`, one file, Node built-ins only, importing nothing from
   `src/`, `dist/` or `test/` (a test asserts it, as `runtime-boundary.test.js` asserts the verdict's
   closure), with a line cap of 600 that a test also asserts. Scope of the first version: the corpus,
   the expected rows, statuses, ADRs, pointer resolution and digests, symbols and JUnit cases at their
   witnessed location, plus the three re-derivations above. It exits 0 when the witness holds on the
   tree, 1 when a fact does not hold or an absence is not re-derived, and prints which.
5. *The differential test*: on every generated mission, `computeVerdict` and the checker; on runward's
   own mission, the checker over the witness of `check --strict` in CI. A disagreement fails the build.

**Increment 2.** The witness and the checker grow over what increment 1 left out, one family per pull
request, each with its positive control: deliverable state against templates, the report natures, line
counts, signatures, scaffold-identical files, the seal and drift, the regulated tier, the charter and
sample, workflow contracts. Pass 2 of the mutation register gains the differential test as a leg.

**Increment 3, only on a trigger.** When the checker covers every family the verdict judges, it is the
independent second implementation the ROADMAP names; from then on the differential test compares two
whole verdicts. A model in a proof assistant (Cedar's route) is not planned: it is reopened by the
triggers below.

**What each step shows, and what it does not.**

| Step | Shows | Does not show |
|---|---|---|
| Snapshot and relations | on generated missions, the verdict respects eight necessary properties | that any single verdict is right: a relation is not an oracle |
| Witness and checker | for this run on this tree and this version, every witnessed fact holds and every re-derived absence holds, re-checked by code sharing nothing with the verdict | anything about another tree ("we only know it for instance x"); anything about a family listed in `notWitnessed`; anything about the quality of the evidence (`GATE_NON_SCOPE` is unchanged) |
| Differential test | where the two disagree, one of them has a defect, on generated inputs | that agreement is correctness: both can share a misreading of `docs/spec/witness.md`, as the prototype shared two of runward's past ones |
| Second implementation | the same, over every family | the same limit, at a higher cost |

**The decisions the maintainer takes** (at most three), each with the recommended answer:

1. **Direction and first increment.** Recommended: adopt the order above; increment 1 as five pull
   requests (snapshot and canonical rendering; generator and relations; witness and its spec; checker;
   differential test in CI), the second implementation and any formal model behind the triggers.
   Alternative: start with the second implementation (see Alternatives).
2. **The checker's independence and home.** Recommended: one file under `checker/`, Node built-ins only,
   no import from runward, a line cap of 600, written from `docs/spec/witness.md` by an agent session
   other than the one that writes the witness emitter, the maintainer reviewing the spec and the cap;
   shipped in the qualification kit (ADR-0087) and run by runward's CI, never in the npm package and
   never in the verdict path. Alternative: a `runward verify --witness` subcommand inside the package.
3. **What a disagreement does, and the words.** Recommended: in runward's CI, a witness the checker
   refuses or a differential disagreement fails the build and is filed in `known-defects.md` before
   either side changes; in a user's run, the checker answers with its own exit code and never changes
   `check`'s, so ADR-0047 decision 4 ("`check.ts` must never re-decide anything it renders") and
   ADR-0054 read unchanged: the checker is outside the command, outside the verdict path, and decides
   nothing for the user. The artefact is called a witness; the public wording stays "re-checked by a
   separate program that shares no code with runward", never "certified", "proven" or "verified
   correct". Alternative: fold the checker's answer into `check`'s exit code.

## Alternatives discarded

- **A formal model and differential random testing, Cedar's route, first.** The strongest form, and the
  one the ROADMAP cites. It needs a proof assistant, a model kept in lockstep with every release, and a
  maintainer fluent in both; runward has one maintainer. And the model would most naturally take parsed
  rows as its input, leaving out the text reading where most of runward's verdict defects lived, which
  is the part Cedar also leaves unmodeled. Reopened by the triggers below.
- **The independent second implementation first.** It is the end point, and the prototype shows it
  finds disagreements. Started first, it is about 3,561 lines of verdict code to re-derive with no
  specification but the code, and the prototype shows the risk: written from behaviour, it re-made two
  of runward's fixed defects in 111 lines. The witness spec gives the second implementation something
  to be written from, and the checker is its first, small, useful part.
- **Make `runward verify` the checker.** It already re-derives, but by calling `computeVerdict`; a
  re-run of the same code detects tampering and drift, not defects. It stays what ADR-0055 made it.
- **The witness in the default `--json` payload.** About six times the payload (43,597 bytes
  pretty-printed on this repository's mission against 7,365), for every CI consumer that never runs the
  checker. Opt-in costs nothing and keeps the machine surface additive.
- **The checker's answer in `check`'s exit code.** It would make a second opinion part of the verdict,
  which ADR-0047 decision 4 refuses, and a checker defect would redden honest missions. The checker's
  job is to find runward's defects, not to gate users.
- **Metamorphic relations alone.** Cheapest, and adopted as step 2. Alone, they check relations between
  runs and never whether one run is right.
- **A witness only for green verdicts.** Simpler, but a refusal the checker cannot re-check is a refusal
  nobody outside runward can confirm; the failing facts are the easiest witness to carry.

## Consequences

- **Positive.** A green strict verdict can be re-checked, fact by fact, by at most 600 lines that share
  no code with the 3,561 that produced it, on runward's CI and on a regulated user's machine from the kit.
  The differential test gives the mutation register a new leg: a mutant in the verdict closure that
  changes the verdict on a generated mission is killed, which is the measurement that can clear some of
  the 820 "could not clear" holes. The ADR-0054 contract gains its exact wording (tree and version).
- **Negative, accepted.** A witness schema to keep in step with the verdict: every new family the gate
  judges needs a witness field and a checker check, or it lands in `notWitnessed` and says so. A second
  body of code to maintain, deliberately not shared. A slower unit suite (step 2), bounded by its run
  count. A checker that refuses a correct witness (the "weaker completeness" Rideau and Leroy name) costs
  a CI failure and an investigation, never a user's verdict.
- **On other surfaces.** `verify` is unchanged: the witness is a separate file, not a predicate field,
  so ADR-0055's attestation keeps its shape; carrying the witness's digest in the predicate is a later,
  additive choice. The overclaim guard already scans `docs/` and the kit's README, where the witness
  spec and the checker's documentation will live. The ROADMAP's Cedar sentence is corrected on this
  branch (the two precisions in Context).

## What would settle it

- **For the checker's independence (decision 2)**: the checker, written from `docs/spec/witness.md` by a
  session that did not write the emitter, agrees with `computeVerdict` on the example mission, this
  repository's mission and AC-001 to AC-016, and stays under its line cap.
- **For its sensitivity**: three planted defects, each re-introduced in a throwaway copy of the verdict
  path (a pointer naming nothing accepted, RWD-2026-0006; a U+2028 swallowing a pointer, RWD-2026-0026; a
  second `Rule conformance` section with only the first read, AC-012), each producing a green verdict whose
  witness the checker refuses. A checker that passes all three unchanged is blind, whatever it agrees
  with.
- **For the relations (step 2)**: the eight relations hold on every generated mission at the chosen run
  count, and each of the three directional ones is shown to fail on a build where the matching check is
  removed.
- **For the differential leg**: pass 2 re-run on `conformance`, `evidence` and `mission` with the
  differential test added, and the number of `hole` filings it kills, published with the ratchet.
- **Against the whole direction**: if the checker cannot be kept under its cap while covering
  increment 1's scope, the witness is carrying the wrong facts, and the design is reopened before the
  code grows.

## Reevaluation trigger (mandatory, dated)

Reopen when the checker and runward disagree on a user's mission; when the checker exceeds its line
cap; when a regulated user or an assessor asks for an independent implementation or a formal model;
when the verdict judges a new family of evidence (the witness schema and the checker follow, or the
family is listed in `notWitnessed`); when a second maintainer makes a model in a proof assistant
affordable; and in any case six months after increment 1 ships.

**Trigger set on**: 2026-10-05 · **Watched via**: the differential leg in CI, the checker's line-cap
test, the security and support intake (ADR-0084), and each release's runbook step for the ratchet.

## References

- `src/lib/verdict.ts`, `conformance.ts`, `evidence.ts`, `mission.ts`, `scaffold-lock.ts`,
  `attestation.ts`, `check-contract.ts`; `src/commands/verify.ts`; `test/audit-corpus.js`;
  `test/unit/manifest-fuzz.test.js`; `test/unit/runtime-boundary.test.js`;
  `docs/compliance/mutation-register.md`; `docs/compliance/ratchet-summaries/ratchet-summary-0.43.0.json`;
  `docs/compliance/known-defects.md` (RWD-2026-0006, RWD-2026-0026); `ROADMAP.md`.
- R. M. McConnell, K. Mehlhorn, S. Näher, P. Schweitzer, "Certifying algorithms", *Computer Science
  Review* 5(2), 2011. Read in the authors' preprint (dated 30 August 2010),
  people.mpi-inf.mpg.de/~mehlhorn/ftp/CertifyingAlgorithms.pdf, 2026-10-05; the publisher's version of
  record (doi.org/10.1016/j.cosrev.2010.09.009) was not read.
- E. Alkassar, S. Böhme, K. Mehlhorn, C. Rizkallah, "A Framework for the Verification of Certifying
  Computations", arXiv:1301.7462 (the manuscript of the *Journal of Automated Reasoning* 52(3), 2014
  paper), read 2026-10-05; the journal version and the CAV 2011 paper were not read.
- G. C. Necula, "Translation validation for an optimizing compiler", PLDI 2000,
  people.eecs.berkeley.edu/~necula/Papers/tv_pldi00.pdf, read 2026-10-05. A. Pnueli, M. Siegel,
  E. Singerman, "Translation validation", TACAS 1998: not read at the source (the publisher page refused
  the request); cited for the term only.
- X. Leroy, "Formal verification of a realistic compiler", *Communications of the ACM*, 2009,
  xavierleroy.org/publi/compcert-CACM.pdf; S. Rideau, X. Leroy, "Validating register allocation and
  spilling", CC 2010, xavierleroy.org/publi/validation-regalloc.pdf; both read 2026-10-05. CakeML was not
  read.
- C. Disselkoen et al., "How We Built Cedar: A Verification-Guided Approach", FSE Companion 2024,
  arxiv.org/abs/2407.01688, read 2026-10-05; "Cedar: A New Language for Expressive, Fast, Safe, and
  Analyzable Authorization", OOPSLA 2024, arxiv.org/abs/2403.04651, abstract only.
- M. Hicks, "How we built Cedar with automated reasoning and differential testing", Amazon Science, May
  2023, amazon.science/blog/how-we-built-cedar-with-automated-reasoning-and-differential-testing; K.
  Hietala, E. Torlak, "Lean Into Verified Software Development", AWS Open Source blog, April 2024,
  aws.amazon.com/blogs/opensource/lean-into-verified-software-development; Cedar RFC 0032,
  cedar-policy.github.io/rfcs/0032-port-formalization-to-lean.html; all read 2026-10-05.
- Cedar security advisory GHSA-c33x-vcv4-vg3g, github.com/cedar-policy/cedar/security/advisories, read
  2026-10-05.
- T. Y. Chen et al., "Metamorphic Testing: A Review of Challenges and Opportunities", *ACM Computing
  Surveys* 51(1), 2018, read 2026-10-05 from a course-hosted copy of the published PDF (the ACM Digital
  Library refused the request).
- M. Blum, S. Kannan, "Designing programs that check their work", STOC 1989 and *Journal of the ACM*
  42(1), 1995: not read at the source; the program-checking lineage is taken from McConnell et al. §4.
- fast-check, model-based testing, fast-check.dev/docs/advanced/model-based-testing, read 2026-10-05.
