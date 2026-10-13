# ADR-0095: `check --json` carries the ratification row by row, the causes by kind, and the assurance mode in force

**Date**: 2026-10-13
**Status**: proposed — class R proposed under ADR-0088 decision 2: it changes the machine payload of
the command that owns the exit code (ADR-0030) and touches `src/lib/conformance*` and
`src/lib/verdict*`, both on the charter's pre-merge paths, so it goes through the pre-approval path,
never a delegated merge. The studies classed it D on the pre-approval path; the maintainer decides the
class and the two questions in "What would settle it". An agent wrote this record and decides nothing
(ADR-0088 decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: a fresh clone of `stranxik/runward` at `main@958d068` (runward 0.43.1), read on
2026-10-13: `src/lib/conformance.ts` (`ratificationLedger`, `RatificationLedger`, `unboundRatifications`,
`UnboundCause`, `UNBOUND_CAUSE_TEXT`), `src/lib/check-contract.ts` (`conformanceRows`,
`delegationPayload`, the machine payload), `src/commands/verify.ts` (the `cmp` calls and the additive-key
rule), `src/lib/witness.ts` (`NOT_WITNESSED`), ADR-0066, 0080, 0082, 0088, 0089, 0090, 0093. One
measurement: `node dist/cli.js check --strict --json` on runward's own mission, whose top-level keys,
`ratification` object and `delegation` block are quoted below
**Relates to**: [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md) (prerequisite I0, decision 6),
[ADR-0066](ADR-0066-a-manifest-row-can-be-proposed-and-a-proposal-never-crosses.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
[ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md)
**Would amend, by name, once accepted**: none. ADR-0090 carries a dated note pointing here; its
decision 2 already names `delegation.assurance`, and this record fixes only its machine shape.

## Context

**What a consumer can read today, measured.** On runward's own mission, `check --strict --json` has
26 top-level keys. Ratification is a block of counts:

```json
"ratification": { "rows": 48, "lineByLine": 2, "enBloc": 46, "blind": 0, "untraced": 0 }
```

plus, only when non-zero, `agent`, `agents[]`, `singleAccountable`, `changed` and `changedRows[]`.
Which row was ratified, how, by whom, on which digest, is not in the payload: it is in the Markdown of
the five gated deliverables. Per-row causes exist only under the regulated tier
(`regulated.unbound[]`, eleven `UnboundCause` values).

**The causes of a red verdict** are rows of `conformance[]`, each with a `kind`
(`rule-violation`, `evidence-refused`, `unbound-row`, the charter kinds…), and `gaps` gives counts per
scope (`deliverables`, `conformance`, `hooks`, `deferred`, `proposed`, `unboundRows`, `charter`). No
field groups the causes by kind.

**The assurance mode is absent.** ADR-0090 decision 2 names `delegation.assurance` on `check --json`.
Measured: the `delegation` block carries `file`, `banner`, `stage`, `accountable`, `delegates`,
`classes`, `effective`, `expires`, `preMerge`, `sample`, `gaps`, and no mode and no `degraded` flag.
It arrives with the `mode:` field of ADR-0090's work order, not yet built.

**Why it matters now.** ADR-0093 rule R1: no view computes a state, every count comes from runward with
the list it counts. Without these fields, the Markdown summary (D1), the change row (D2) and the period
(D3) would each have to re-read the deliverables' Markdown: a second reader of the same rows, so a
second verdict that can disagree with the first.

**Two constraints the payload already imposes.**
- `ratification.rows` is the count. A list cannot take that key without breaking every consumer of
  ADR-0030's contract.
- `verify` compares `ratification` as a whole object (`cmp("ratification", …)`). A list added inside it
  would make every attestation sealed by 0.43.x fail to verify against a newer tree reading. The
  precedent for the fix exists: `evidence.proseRows` is compared on its own, only when present
  (RWD-2026-0150).

The witness does not carry the ratification ledger (`NOT_WITNESSED.disclosures`), so nothing here
changes the witness or its checker.

## Decision

**Three additive fields, each a pure function of what the verdict already reads, each re-derived by
`verify`, none counting toward the verdict.**

1. **The per-row list**, under the key chosen in question 1 (recommended `ratification.byRow`), sorted by
   gated deliverable in phase order, then manifest order. One element per decided row:

   ```json
   { "deliverable": "architecture.md", "rule": "…", "phaseId": "…",
     "state": "ratified | changed | untraced | blind",
     "mode": "line-by-line | en bloc | blind | agent | agent (single accountable) | null",
     "by": "…", "for": "…", "date": "YYYY-MM-DD",
     "bound": "<digest> | null", "current": "<rowDigest>",
     "unboundCause": "<UnboundCause> | null" }
   ```

   `state` follows the latest entry, as `ratificationLedger` and `unboundRatifications` already do;
   `unboundCause` is filled only when the regulated tier is on, so no other mission's reading changes;
   names are copied as the tree declares them (question 2). The counts stay where they are and must
   equal the list's counts, asserted by a test.
2. **`gaps.causesByKind`**, strict only (like `conformance[]`): for each `kind` present, `{ count,
   indices }`, the indices pointing into `conformance[]`. A count never travels without its list.
3. **`delegation.assurance`**, present when a charter is: `{ declared, inForce, degraded, notInForce[] }`
   and the sentence ADR-0090 decision 2 fixes at the character. Its computation is ADR-0090's; this
   record fixes the machine shape so records (ADR-0093 decision 6) can copy it. Until it ships,
   consumers read `not-observed`, never a default mode.

**Re-derivation.** `verify` compares each new field on its own, only when present in the attestation,
like `evidence.proseRows`: an attestation sealed before the fields existed keeps verifying, and one
sealed with them and edited is caught. Stripping all three passes, like deleting any additive field: it
removes information, never adds any.

**Path.** One pull request on the pre-approval path, its golden payloads regenerated in the same
commit, `check --strict --json` byte-identical across two runs, and no exit code changed on any fixture
of the attack corpus.

## Alternatives discarded

- **Reuse `ratification.rows` for the list.** Breaks every consumer reading the count (ADR-0030).
- **Let each renderer read the Markdown.** A second reader of the rows; ADR-0064's own "what would
  settle it" forbids a rendering that computes.
- **Put the list inside `ratification` and keep the whole-object compare.** Every 0.43.x attestation
  would fail `verify` on an unchanged tree; an older producer is not a liar.
- **Group causes in each view.** Rule R1 of ADR-0093: the grouping is runward's, published with its list.
- **Compute the assurance mode here.** ADR-0090 owns it; two computations of one mode can disagree.

## Consequences

- **Positive.** Every number the D1 summary prints is a JSON path of the payload; the change row of D2
  and the period of D3 read one source; the assurance mode becomes machine-readable the day it ships.
- **Negative, accepted.** A larger payload (one element per decided row: 48 on runward's own mission);
  three more fields `verify` must keep re-deriving; declared names travel further than the Markdown.
- **On other boundaries.** No verdict or exit code changes; the witness is unchanged.

## What would settle it

**Questions for the maintainer** (each with the recommendation):

1. **The key and its place.** (a) `ratification.byRow`, compared on its own by `verify`; (b) a top-level
   `ratificationRows`. **Recommended: (a)**: the ledger stays one block for a reader, and the
   `evidence.proseRows` precedent already shows `verify` handling a nested additive list.
2. **Names in the list.** (a) `by` and `for` copied as the tree declares them; (b) canonical ids only,
   free names dropped. **Recommended: (a)**: the names are already in the committed deliverables, and
   pseudonymisation belongs to the exporter (`ledger export`, D2), which knows the retention its reader
   needs; dropping them here would make the list disagree with the Markdown it summarises.

**Evidence that would ratify or reverse it:**

- The list's counts equal `ratification`'s counts on every fixture, and a planted mismatch reddens.
- `verify` on a 0.43.1 attestation and an unchanged tree still exits 0; an edited `byRow` element exits
  non-zero.
- The D1 Markdown golden test: every number in the summary is a JSON path into this payload.
- Reversal: a consumer that cannot use the list without re-reading the Markdown, or a payload size
  measured as a problem on a real mission.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-01-13, or earlier when: ADR-0090's `mode:` field ships with a shape other than the one
above; the witness starts carrying the ratification ledger; or a consumer of `check --json` reports
that a renamed or moved ratification field broke it.

**Trigger set on**: 2026-10-13 · **Watched via**: the payload golden tests, `verify`'s additive-key
tests, the D1 Markdown golden test.

## References

- `src/lib/conformance.ts`, `src/lib/check-contract.ts`, `src/commands/verify.ts`, `src/lib/witness.ts`
  at `main@958d068`.
- ADR-0030 (the machine surface is a contract), ADR-0064, ADR-0066, ADR-0080, ADR-0082, ADR-0088
  decisions 2 and 4, ADR-0090 decision 2, ADR-0093 decision 6 and rule R1.
