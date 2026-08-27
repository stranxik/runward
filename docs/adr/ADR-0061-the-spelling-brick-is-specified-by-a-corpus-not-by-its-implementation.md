# ADR-0061: the spelling brick is specified by a corpus, not by its implementation

**Status**: accepted 2026-08-27
**Date**: 2026-08-27
**Relates to**: [ADR-0019](ADR-0019-evidence-lives-in-the-repository-under-audit.md) (containment),
[ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) (amended 2026-08-26: a survivor
list is a property of the code, not of one laptop's filesystem).

## Context

Two independent instruments name the same module, and they were not built to agree.

**Mutation testing.** `dist/lib/evidence.js` carries 144 filed holes of 214 survivors — the largest
concentration in the product.

**Blame archaeology.** An SZZ-style walk over `v0.36.0..HEAD` found that **every** line a later fix
had to redo lives in `src/lib/evidence.ts` and nowhere else: 8 pairs, 8 in that file, 0 across the
eight other modules touched in the same window. Behavioural confirmation on those pairs put the
actual bad-fix rate at 1 of 18 fix commits — the ordinary industry figure — so the finding is not
"fixes create defects here". It is **one module concentrates the churn**.

**The register agrees.** Fourteen filed defects belong to this brick: RWD-2026-0005, 0012, 0016,
0017, 0024, 0029, 0031, 0033, 0034, 0035, 0037, 0055, 0070, 0074.

Its hard part is not algorithmic. It is filesystem and Unicode semantics: case folding, realpath,
symlink traversal, containment, separators, 8.3 short names, ancestor permissions. JavaScript has no
Unicode case-folding primitive — `toLowerCase()`/`toUpperCase()` are not case folding — which is why
`caseFold` is a hand-rolled `toLowerCase().toUpperCase().toLowerCase()` and why the ß/ẞ pair
(RWD-2026-0035) survived its own subsumption test: the asserted corpus carried the lower-case half
and not its twin.

## Decision

**The brick's specification is a data corpus, and the implementation is judged against it.**

`test/fixtures/spelling-corpus.json` holds triples: a pointer **as written**, a layout **on disk**,
and the **verdict expected**. `test/spelling-conformance.js` is only the harness that drives them.
Three properties make it a specification rather than another test file:

1. **It is data.** This is the artifact that would be ported if the brick were ever reimplemented in
   another language. Porting a test suite means porting its assertions; porting a corpus means
   porting a file.
2. **Every case cites the defect it was learned from.** It is the empirical record of what this
   module has actually got wrong, not a list of what someone imagined it might.
3. **It states its filesystem, and names what it skipped.** Half the cases are answers about a
   case-insensitive, Unicode-folding filesystem and are meaningless on a case-sensitive one. The
   harness probes the host, runs what applies, and **prints the skips with their reason**. ADR-0046's
   amendment was paid for by exactly this failure: a list that was a property of code AND filesystem
   while claiming to be a property of code. A counted skip is a known limit; a silent one is a false
   green.

**This does not decide the language question, and deliberately defers it.** A rewrite in Rust or Go
would buy a real case-folding primitive and lose npm distribution, which is the adoption channel for
a tool aimed at people living inside coding agents. That trade is not settled by this ADR. What this
ADR does is make the trade *possible to evaluate later at a bounded cost*: the corpus is the part
that survives a reimplementation, and the interface it drives (`evidenceReport` over a mission and a
pointer) is the seam a port would replace.

## Consequences

- **Positive, and immediate.** On its first run the corpus found a live defect in a fix made the day
  before: the bound added for RWD-2026-0074 was passed in the CANONICAL namespace while the path
  being walked was in the LOGICAL one, so on macOS (`/var` → `/private/var`) the bound never engaged
  and the walk silently restarted at the filesystem root. The verification that had accepted that fix
  used a path already under `/private/tmp`, where the two namespaces coincide and the defect cannot
  appear. Filed as RWD-2026-0081.
- **Negative.** A corpus can only encode what has been learned. It is a floor under regressions, not
  a proof of correctness, and it says so.
- **Accepted cost.** One more artifact to keep honest. The mitigation is that adding a case is
  cheaper than writing a test, which is the point.

## Reevaluation trigger

**Trigger set on**: 2027-02-27.

The decision is wrong and must be revisited if: a defect in this brick is filed that the corpus
could have expressed and nobody added it (the corpus is being kept as decoration); or the skip list
on the primary CI filesystem grows past a third of the cases (the corpus is measuring a machine more
than a module); or a port to another language is actually undertaken and the corpus turns out not to
be the portable part, which would mean the seam is drawn in the wrong place.

**Watched via**: `test/spelling-conformance.js` (its own skip output), the register's per-defect
`verified by` column, and the ADR-0046 mutation figures for `evidence`.
