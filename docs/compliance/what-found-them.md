# What found the defects

The objection this page answers: *"we already do code review."*

Every entry in the [defect register](known-defects.md) carries a `found-by` field — a closed
vocabulary, guarded by `test/unit/known-defects-register.test.js`. Across all 87 entries:

| What found it | Entries |
| --- | ---: |
| Adversarial audit — multi-agent, run as a deliberate task | 59 |
| Mutation instruction — filing every surviving mutant, one argued verdict each | 14 |
| While reproducing another defect | 4 |
| Declared at design time, as a limitation | 3 |
| An existing guard reddening | 2 |
| Not recorded — nobody wrote it down, and guessing would be fabrication | 2 |
| A CI leg on another OS | 1 |
| The conformance corpus | 1 |
| The measurement itself | 1 |

## What the mix says

The point is not that review fails: the 59 audit entries **are** review — run as a scheduled
adversarial task with a filing obligation, not as a by-product of merging. The point is that
nothing here was free. 73 of 87 came from two instruments that only produce anything when they
are run on purpose and their results filed; every other recorded discovery traces to something
someone built deliberately — an adversarial corpus, an OS-specific CI leg, a guard installed by
an earlier campaign. The closest thing to a free catch is the two `existing-guard` entries,
where the suite reddened on its own — and both guards had been installed by the mutation
campaign for exactly the class they caught.

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
