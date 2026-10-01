# The delegation charter: `runward/delegation.md`

A delegation charter is the policy under which agents act for one accountable person. The gate reads
it, and it proves nothing by itself
([ADR-0088](adr/ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)
decision 5). The person it governs writes it, so every surface that reads it prints, at the character:

- « delegation: declared, not proved — the maintainer's credential is within agent reach » (decision 1,
  stage 1)
- « charter: declared, not proved » (decision 5)

The charter is optional. A mission without `runward/delegation.md` behaves exactly as before: no
section, no JSON key, no SARIF property, no gap.

## Who writes it

The accountable person. Signing, renewing, widening and revoking the charter are class R acts (trust
roots, ADR-0088 decision 2). `runward init`, `runward wire` and `runward update` never create one. To
start, copy the template shipped with the package and fill every field:

```sh
cp node_modules/runward/templates/delegation/delegation.md runward/delegation.md
```

A placeholder left in the template (`<account>`, `YYYY-MM-DD`) is a named gap under `check --strict`.
Commit the charter in its own commit. A widening (a new scope, a smaller sample, a shorter sampling
period) goes in its own commit too and must not ride a renewal.

## Format

A frontmatter block of `key: value` lines, the grammar of the workflow contracts. A list is written
`key: [a, b]`, or `key:` followed by `  - item` lines when an item carries a comma. The prose after
the block is for people; the gate does not read it. Every field below is required unless marked
optional. An unknown, duplicated or misshapen field is a named gap, never repaired.

| Field | Value | Read as |
|---|---|---|
| `charter` | `runward-delegation/1` | the format version this release reads |
| `stage` | `1` or `2` | ADR-0088 decision 1. Stage 2 is a gap in this version (`charter-stage-unread`): its evidence (a separate OS user for agents, commits signed by a key in `allowedSigners`, signed samples) is not read yet, and stage 2 is what the gate checks, not what the charter says |
| `accountable` | a canonical id, e.g. `github:<account>` | the one person who answers for every delegate |
| `aliases` | list (optional) | the other spellings of that person: login, name as written in ratifications |
| `delegates` | list | the agents allowed to act, as `ratify --agent` records them, and the App's forge identity (`<app>[bot]`). A delegate that is a spelling of the accountable person is refused: an agent acts under its own identity (ADR-0082) |
| `class-R`, `class-H` | `maintainer` | trust roots, and judgement owed to a third party: the maintainer's in every stage (`charter-class-refused` otherwise) |
| `class-I` | `refused` (stage 1) | irreversible public acts: not delegated in stage 1 (`charter-class-refused` otherwise) |
| `class-D` | `delegated` or `maintainer` | reversible or internal acts |
| `scope-R`, `scope-H`, `scope-I`, `scope-D` | list (optional) | what each class covers, in words; declared, not interpreted |
| `budget-consecutive-refusals`, `budget-refusals-per-period` | whole numbers ≥ 1 | the escalation budget (decision 9) |
| `sample-size`, `sample-seeds`, `sample-period-days` | whole numbers ≥ 1 | the weekly control (decision 6): acts drawn, seeded defective items, period |
| `effective`, `expires` | `YYYY-MM-DD` | the window; `expires` after `effective`, at most 90 days later |
| `pre-merge-paths` | list, must include `runward/delegation.md` | paths whose changes wait for the maintainer before merge (decision 7), repository-relative |
| `pre-merge-events` | list (optional) | events that wait for the maintainer before merge (decision 7) |

The budgets, the sample fields and the pre-merge list are data this release validates and publishes
(`check --json`, `delegation.preMerge`); it does not enforce them. Enforcing them needs the signed sample
and the forge, later changes of ADR-0088.

## What the gate reads

`runward check` prints a "Delegation charter" section with the two sentences above, the stage, the
accountable person, the delegates and the window. `check --json` and the attestation predicate carry a
`delegation` block, with and without `--strict`; the SARIF run carries `properties.delegation`; the
delivery report and `runward doctor` print the sentences.

Under `--strict`, each of these is a strict gap (exit 1, ADR-0083), counted in `gaps.charter` and listed
in the `conformance` table with scope `delegation`:

| Kind | When |
|---|---|
| `charter-malformed` | a field is missing, unknown, duplicated, a placeholder, or not of its shape; the window is over 90 days |
| `charter-class-refused` | class R or H is not `maintainer`; class I is `delegated` in stage 1 |
| `charter-stage-unread` | `stage: 2` |
| `agent-not-delegate` | the ratification in force on a decided row was made by an agent the charter does not list (`by:` compared folded) |
| `charter-expired` | the ratification in force on a decided row was made by a delegate on a date after `expires:` |

An agent ratification dated before `effective:` predates the charter and is not judged by it. A row an
agent ratified outside the charter and a person re-ratified since is not a gap: like the regulated tier,
the gate reads the ratification in force. `runward ratify` itself does not consult the charter; the gate
names what it does not cover.

## Expiry, and why the gate has no clock

The verdict path reads no clock: the same working tree gives the same verdict on any day
([ADR-0054](adr/ADR-0054-the-runtime-boundary-is-explicit.md), crossing 4 and its test). A charter
that lapses overnight must not turn yesterday's green tree red with no change committed. So the gate
reads expiry against the dates the tree itself declares: an agent ratification whose entry is dated
after `expires:` is a `charter-expired` gap, on any day the gate runs, and a tree with no act after
`expires:` reads the same before and after the date.

`runward doctor`, outside the verdict path, sets `expires:` beside today's date (the clock every runward
date honours: `RUNWARD_NOW`, then `SOURCE_DATE_EPOCH`, in non-interactive runs). It warns when the
charter has expired and when it expires within 14 days (decision 7), and otherwise says how many days
are left.

Dates in ratification entries are declared too: `ratify` writes the day it ran, and a hand-edited date
is a readable diff, not a proof.

## Identities: the charter and the lock

ADR-0088 decision 4 compares accountable persons by canonical id. Until this release the ids lived in
`runward/scaffold-lock.json`, `"identities": { "<canonical id>": ["<alias>", …] }`, as an interim home.
Both are read now. The precedence:

1. Every id the lock declares stays declared, with its aliases: nothing a lock declared stops resolving.
2. The charter's `accountable` id gets the union of the charter's `aliases` and the lock's aliases for
   that id, the charter's first, one spelling per folded name.
3. An alias the charter gives its accountable person is removed from every other id in the lock. On
   the accountable person's own names, the charter wins.

`"singleAccountable"` and the other opt-ins stay in the lock. `runward doctor` says when the charter and
the lock both declare the accountable person.

## What it does not do

- It does not prove who acted. Every name is declared: `by:`, `for:`, the delegates, the dates. In
  stage 1 an agent holding the maintainer's credential can edit the charter, and the banner says so.
- It does not make an agent ratification independent approval, nor a DORA change-approval control
  (ADR-0088, Consequences).
- It does not read git history, the forge or the clock in the verdict path.
- It is not the signed weekly sample (decision 6), which is a later change.
