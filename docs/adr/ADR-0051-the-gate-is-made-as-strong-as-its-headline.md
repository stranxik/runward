# ADR-0051: the gate is made as strong as its headline

**Date**: 2026-08-12
**Status**: proposed (ratification criteria below; this document crosses nothing)

## Context

The product prints and documents claims about the depth of its deterministic gate. Measured on the
shipped 0.33.5 (`dist/cli.js`, every case executed 2026-08-12, none reasoned), each claim is
stronger than the mechanism behind it. The reader this matters to is the one runward exists not to
deceive: an auditor handed a green strict run.

1. **"The gate verifies the shape of the evidence" holds for 1 rule of 64.** `rules --json` lists
   64 rules and exactly one `signature:` (`frontier-deterministic-boundary`). Reproduced on a fresh
   scaffold, one run, two rows side by side: `hexa-architecture | applied |
   file:src/guard.ts#guardFields`, pointing at a real file with no relation whatsoever to hexagonal
   architecture, raises **zero** violations, while the one signed rule on the same run raises
   "evidence does not match the rule's signature" with the hint "(cited, not applied?)". The
   credibility sentence [ADR-0020](ADR-0020-rule-evidence-signatures.md) made true is true exactly
   once. Everywhere else the pointer layer verifies existence, not shape, and nothing in the run
   says which regime a given row was judged under.

2. **The symbol check passes on any substring, while its message claims presence.**
   `src/lib/evidence.ts:413` tests `content.includes(p.symbol)`. Executed: a file containing only
   `guardFieldsLegacy`, pointer `#guardFields`, is green; the control `#guardRows` reds with
   "symbol not found in the file (moved or renamed? update the pointer)". So the exact case the
   message names, a renamed symbol, stays green whenever the old name is a prefix or fragment of
   the new one, and a seal can sit on a pointer naming an identifier that no longer exists. This is
   a declared depth, not a silence: [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md)
   declared the substring and [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)
   preserved it by name ("the declared depth limits, unchanged"). Changing it amends a documented
   decision, and this ADR is that amendment, stated rather than slipped in.

3. **The run never says how thin the signed share is.** "What this gate verified" counts typed
   versus prose rows (`src/lib/evidence.ts:562-595`, rendered `src/commands/check.ts:150-167`) but
   not signed versus merely resolved. An operator reading "36 of 36 pointers the gate opened and
   checked (100%)" cannot tell that for 35 of them "checked" meant: the file exists, is non-empty,
   is not circular, and contains the substring. Never: has the rule's shape.

The unfavorable case, plainly: today the gate's strongest printed sentence covers its weakest
verification, in silence. A sibling decision from the same product review,
[ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md) (accepted), bounds a
different overclaim (exit 0 read as "mission complete" during construction); the two are
independent and neither depends on the other landing.

## Decision

Three moves. Each either strengthens the mechanism to match the sentence, or narrows the sentence
to match the mechanism. Nothing else moves: the 0/1/2 exit contract
([ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)), the six phases, `GATE_NON_SCOPE`, and the
seal's semantics are untouched.

**1. Symbols match at identifier boundaries.** For a pointer symbol of identifier form
(`/^[A-Za-z_$][A-Za-z0-9_$]*$/`), the match requires an occurrence not embedded in a larger
identifier: the escaped symbol wrapped in `(?<![\w$])` and `(?![\w$])`, replacing the bare
`includes` at `src/lib/evidence.ts:413`. Quoted symbols keep the exact-substring semantics they
already have by construction. Test names (`test:PATH::NAME`, line 416) are untouched: they are
prose, and an identifier boundary has no meaning in prose. The violation message does not change;
"moved or renamed? update the pointer" simply becomes true.

**2. A slice of signatures, adjudicated rule by rule.** Coverage grows only where the rule's own
text prescribes its tokens, which is the ADR-0020 line verbatim ("added rule by rule, each
justified by tokens the rule text itself prescribes, never wholesale"); no amendment is needed.
Realistic target: 8 to 12 of the 31 CRITICAL/HIGH rules mapped to the gated phases. Candidates to
adjudicate, not commitments: `provider-no-crash-missing-env` (its text prescribes the env-guard
idiom), `resilience-retry-backoff` (names retry and exponential backoff),
`config-secrets-boundary`, `security-prompt-injection`. Every accepted signature: is justified in
the rule's frontmatter by the tokens the text prescribes; passes `unsafeSignature` (ADR-0045
class 9, a signature must never hang the gate); and is validated against both reference missions
before merge. A candidate whose tokens are not genuinely prescribed is not signed; the target is
not a quota. ADR-0020's reevaluation trigger carries over verbatim: one confirmed false red on a
legitimate implementation retires that signature immediately.

**3. The run names the signed share of the verdict.** On the model of the critical-scope line
(`src/lib/verdict.ts:98-103`, a count the sentence could not honestly omit): "N of M `applied`
row(s) rest on a signed rule; for the others, the gate verified that the evidence exists, not its
shape." Printed in "What this gate verified"; counted, never gated; one additive JSON field under
the ADR-0030 additive-only contract. This is the ADR-0045 doctrine applied to the gate's own
headline: where the gate cannot verify, it says so in the run, not only in the abstract.

Three adjacent paper cuts (the missing-row message naming `runward manifest --sync`, the
in-progress label naming its true cause, an advisory when several `applied` rows carry an
identical prose cell) change no decision and ship without an ADR; they live on the roadmap.

## Alternatives discarded

- **Sign the 31 mapped CRITICAL/HIGH rules at once.** Rejected by ADR-0020 itself, in its own
  alternatives ("Signatures on every CRITICAL rule at once"): most rules have no canonical token,
  `hexa-architecture` "matches no grep", and a forced signature manufactures false reds, which
  erode the gate faster than any gap. The same ADR's trigger also forbids the drift toward
  pseudo-semantic checking that a blanket pass would be.
- **Identifier-boundary match on test names too.** Test names are prose, with spaces and
  punctuation; an identifier boundary has no defined meaning there, and the quoted case is already
  exact. The hardening covers only symbols shaped like identifiers.
- **Make duplicated prose a blocking gap.** Would reverse the standing acceptance of prose evidence (the untyped complement of [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md)) and the alternative ADR-0045 already discarded ("Require a typed pointer on every `applied`
  row"): an absence cannot be pointed at, and prose is legitimate exactly there. The coherent move
  is a counted advisory, and it is a roadmap item, not a decision.

## Consequences

- **Green missions will redden, and that is the point, but it is a rupture.** Two populations:
  missions whose pointer symbol was a prefix or fragment of the real identifier (a seal over a
  dead pointer), and missions with prose `applied` rows on newly signed rules, which redden after
  `runward update` refreshes their rule corpus, because a signature makes file-backed evidence
  mandatory for `applied` rows (ADR-0020 semantics, unchanged here). Same class as ADR-0045:
  carried in the version number and a migration note that names both populations and the gesture
  for each.
- **Bounded before merge.** The runward mission and the shipped example must be strict-green
  before and after each of the three changes, verified by execution; if a reference mission
  reddens, its pointers are fixed first, and that reddening is recorded as the mechanism working.
  `check --strict` on this repository exits 0 today (measured 2026-08-12) and must still exit 0 on
  the branch.
- **Recurring cost, accepted.** Every signature adds the ADR-0020 maintenance consequence: a
  renamed guard idiom in the ecosystem means a rule edit. A slice of 8 to 12 multiplies that
  charge accordingly. `scaffold-lock.json` is regenerated by the release as usual (the rule files
  change, so their hashes change: ADR-0045 class 1 mechanics).
- **The scope line may be uncomfortable.** A mission with 24 `applied` rows of which 2 rest on
  signed rules will read "2 of 24". That number was always true; only its visibility is new
  ([ADR-0040](ADR-0040-per-rule-non-scope-declaration.md): every gate names what it cannot verify,
  per run).
- Estimated cost: 3 to 3.5 maintainer-days (0.5 to 1 for the boundary match, 2 to 2.5 for the
  signature slice with its validations, 0.5 for the scope line), reference-mission re-verification
  included, ADR ratification excluded.

## What this does not claim

- Not that the gate judges whether evidence *implements* a rule: `GATE_NON_SCOPE` is unchanged;
  the semantic judgment stays with the operator and the adversarial `verify` workflow
  ([ADR-0007](ADR-0007-advisory-llm-conformance-verification.md)).
- Not that a signature is unforgeable: pasting the tokens into a comment still passes. ADR-0020
  verbatim: the gate "raises the cost of the lie, it does not abolish lying".
- Not that the boundary match is sufficient: pointing at a real identifier that exists but has
  nothing to do with the rule still passes; only the signature layer, where present, sees content.
- Not that coverage becomes broad: the 14 CRITICAL/HIGH rules mapped to no phase remain reported
  and never gated (existing perimeter decision), and most rules will stay unsigned permanently,
  because their text prescribes no token and forcing one would manufacture false reds.
- No change to the six phases, the 0/1/2 exit contract, or what the seal certifies (including its
  declared-date limit).

## Ratification

This ADR is proposed. It crosses no phase and edits no manifest. It moves to accepted when all of
the following pass in CI, on the built binary, each test red before its change and green after:

1. **Boundary match**: a case in `test/unit/evidence-report.test.js` (or
   `pointer-grammar.test.js`): a file containing only `guardFieldsLegacy`, pointer `#guardFields`,
   raises "symbol not found"; pointer `#guardFieldsLegacy` raises nothing; and `check --strict` on
   this repository and on the shipped example still exit 0.
2. **Signatures**: `rules --json | jq '[.rules[] | select(.signature)] | length'` equals the
   shipped slice size (8 to 12, or the adjudicated number with each refusal named in the PR); for
   **each** newly signed rule, a replayed case in `test/audit-corpus.js` where an `applied` row
   points at a real but unrelated file and exits 1 (the bypass in this ADR's Context, reproduced
   then killed); both reference missions green before and after.
3. **Scope line**: the golden output contains "N of M `applied` row(s) rest on a signed rule" and
   the additive JSON field exists (goldens / `test/unit/no-overclaim.test.js`).

Until then, the Status line above stays proposed, and no sentence anywhere presents this hardening
as shipped.

## References

- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) — the declared substring depth this ADR amends (decision 1)
- [ADR-0020](ADR-0020-rule-evidence-signatures.md) — the signature frame, unamended; its trigger carried verbatim (decision 2)
- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — the doctrine ("where the gate cannot verify, it says so in the run") and the rupture precedent (decision 3, Consequences)
- [ADR-0040](ADR-0040-per-rule-non-scope-declaration.md) — every gate names what it cannot verify, applied per run
- [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md) — the additive-only JSON contract the new field respects
- [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md) — where the semantic judgment lives, unchanged
- [ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md) (accepted 2026-08-13, same product review) — the sibling decision on partial/prefix verdicts; independent
