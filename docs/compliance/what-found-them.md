# What found the defects

The objection this page answers: *"we already do code review."*

Every entry in the [defect register](known-defects.md) carries a `found-by` field, a closed
vocabulary guarded by `test/unit/known-defects-register.test.js`. Across all 165 entries:

| What found it | `found-by` | Entries |
| --- | --- | ---: |
| Adversarial audit: multi-agent, run as a deliberate task | `adversarial-audit` | 111 |
| Mutation instruction: filing every surviving mutant, one argued verdict each | `mutation-instruction` | 15 |
| A measurement someone chose to take | `measurement` | 15 |
| While reproducing another defect | `while-reproducing` | 9 |
| An existing guard reddening | `existing-guard` | 6 |
| Declared at design time, as a limitation | `declared` | 4 |
| Not recorded: nobody wrote it down, and guessing would be fabrication | `not-recorded` | 2 |
| A CI leg on another OS | `ci-os-leg` | 1 |
| The conformance corpus | `conformance-corpus` | 1 |
| An operator's report, from using the product | `operator-report` | 1 |

The same test recounts the register and reddens when this table, the total above or the figures
below stop matching it. Until 2026-09-29 they were kept by hand and had drifted: this page said
"all 87 entries" over a table summing to 133, while the register held 162.

## What the mix says

The point is not that review fails: the 111 audit entries **are** review, run as a scheduled
adversarial task with a filing obligation, not as a by-product of merging. The point is that
nothing here was free. 126 of 165 came from two instruments that only produce anything when they
are run on purpose and their results filed. Most of the rest came from work someone chose to do:
15 measurements someone decided to take, 9 defects surfaced while reproducing another one, 4
limitations declared at design time, and one discovery each from an adversarial corpus and an
OS-specific CI leg. The closest things to a free catch are the six `existing-guard` entries, where
a suite reddened on its own, and even those guards were built on purpose: four sit in the mutation
campaign's own apparatus (its register guard, its per-module ratchet, its chunk count), two are the
`init` golden fixture, which caught both on its Windows CI leg the day it was recorded. The one
`operator-report` came from the maintainer ratifying runward's own mission.

Three entries, one line each, checkable in the register:

- **RWD-2026-0083** (mutation instruction): same tree, same pass — `runward rules` reads
  10/10 ASI coverage, the compliance pack writes 0/10. The input is a Windows-shaped checkout
  this repository's own CI can never produce: its `.gitattributes` pins every file to LF.
- **RWD-2026-0081** (conformance corpus, on its first run): a path bound compared a canonical
  namespace against a logical one (`/var` vs `/private/var`), so it never engaged — and the
  fix had been verified by its author on a path where the two coincide.
- **RWD-2026-0031** (a CI leg on macOS): APFS applies full Unicode case folding; the
  comparison ladder applied `toLowerCase()`.

## Why the gate finds none of these

By design. The gate proves that a decision was traced to resolving, non-empty evidence
(the [declared non-scope](known-defects.md), ADR-0040); it is not a defect finder and a green
gate was never evidence of absence. What runward contributes is the discipline around that
honesty: the instruments that do find defects are **required** (a stale mutation filing
refuses, ADR-0059), their results are **filed**, and the filing is what you can audit.

What this page does not prove: anything about the defects nobody has found yet. It proves
provenance for the ones we know, and it keeps that provenance checkable:

```
grep -oE '`found-by` = `[a-z-]+`' docs/compliance/known-defects.md | sort | uniq -c
```

The guard test refuses an entry without the field, a value outside the vocabulary, and a
register where `not-recorded` grows.
