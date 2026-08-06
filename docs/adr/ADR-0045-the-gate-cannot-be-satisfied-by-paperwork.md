# ADR-0045: the gate cannot be satisfied by paperwork

**Date**: 2026-08-04
**Status**: accepted (ratified 2026-08-04 — see Ratification)

## Context

Three adversarial audits, run against the shipped binary with every case executed rather than
reasoned, made `runward check --strict` exit 0 on missions containing **no evidence at all**. The
cheapest cost **2 726 bytes of arbitrary text and zero lines of project code** — with the seal
applied and the ISO 42001 pack assembled on top.

They found **22 proven false positives**: a green verdict over evidence that proves nothing. The
asymmetry matters more than the count. A false negative costs an operator an afternoon; a false
positive is what an auditor is handed.

**The structural defect.** The gate judges a mission against a corpus the mission **owns**, in a
directory the audited party writes. [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md)
closed rule **removal**; it never closed **substitution** or **fabrication**, because its floor is
an invariant of *cardinality* over a set the adversary controls. Twelve files containing the word
`ok` satisfy `govern: 12`.

**The aggravating form.** The emptiest missions produced the most reassuring output. Citing each
rule's own file printed `36 of 36 typed pointers the gate opened and checked (100%)`. Answering
`n/a` to all 36 rules removed the only vacuity signal the product has, because that counter printed
only when `applied > 0`. **A gate whose worst case is indistinguishable from its best, at the exit
code and in the text, is not opposable.**

**What was already right, and stays.** `GATE_NON_SCOPE` is honest and complete about depth and
time. ADR-0019 declares the symbol check a deterministic substring; ADR-0020 says a signature
"raises the cost of the lie, it does not abolish lying"; ADR-0021 says the seal detects drift, not
falsification by a writer. Those are decisions, documented, and this ADR does not weaken them. The
defects below were **silent** — in no ADR, no template, not in `GATE_NON_SCOPE`.

## Decision

**A verdict may not rest on anything the audited party can write without leaving a trace. Where the
gate cannot verify, it says so in the run — not only in the abstract.**

Nine classes, each verified by re-running the audit's own technique:

1. **The corpus is wired to the verdict.** `scaffold-lock.json` already held the SHA-256 of every
   rule runward wrote, and `update` read it — `check` did not. The falsification was seen, named to
   the operator, and never raised. A rule edited, removed, or never written by runward is now a
   line of the verdict. This alone closes fabrication, substitution and signature-stripping.
2. **Circular evidence is refused.** `file:<manifest>#<slug>` was a universal green key: the slug is
   column 1 of every row, so it always resolved and always matched. Pointing into `runward/rules/`
   is the same move once removed — a rule cannot be its own application, and its file contains the
   very tokens its `signature:` looks for.
3. **The counter is unconditional and no longer optimistic.** It prints `N applied · N deviated ·
   N n/a` always, names plainly when nothing was verified mechanically, and counts a row as
   verified only if the pointer **resolves** and is not circular.
4. **The ADR layer matches the evidence layer.** The evidence layer has always refused an empty file;
   the ADR layer accepted one as a ratified decision. Empty, template (`ADR-0000`), `rejected`,
   `superseded` and unratified are each refused **by name**.
5. **Containment actually runs.** `resolveFile` was purely lexical, so a symlink to `/etc/hosts`
   passed and was read — turning the seal into an arbitrary-file read oracle, the exact thing the
   code's own comment promised it prevented. `characterize.ts` already `lstat`'d correctly.
6. **A pointer that checks nothing says so.** `#`, `#""`, `::` and one-character symbols were silent
   no-ops on a pointer that looks precise.
7. **The grammar is read before anything rewrites it.** Quotes are honoured before the `;` split;
   the apostrophe is not a delimiter (French is full of them, and `#'l'invariant tient'` made the
   gate look for `l`); every pointer in a cell is parsed, not just the first; a malformed `adr:` is
   a pointer that **fails** rather than one that never existed; duplicate `Rule conformance`
   sections are refused rather than arbitrated; fenced tables are illustrations; any heading ends
   the section; a row without its closing pipe is read.
8. **The seal covers the claim.** Gated manifests are sealed alongside the files they cite (an audit
   sealed 31 files, rewrote every row to `n/a`, and the seal still read intact); sealing zero files
   is refused; an unknown lock `version` is refused.
9. **A signature cannot hang the gate.** `unsafeSignature` excluded `(?:...)`, the most common
   grouping form, so `(?:a+)+b` ran over 20 s on 38 characters — in CI, a gate that renders no
   verdict. Groups are scanned alike and nested ones reduced iteratively.

**Deliberately NOT done, and why.** Turning `EXPECTED_MAPPED` into a set invariant (pinned slugs per
phase) was on the plan. After class 1 it is near-redundant — an edited or fabricated corpus is
already a violation — and it would make the rule set rigid: adding a rule would mean editing a
pinned list, which is the hand-kept-list defect this corpus refuses elsewhere. A mission predating
`scaffold-lock.json` cannot have its corpus verified; the run says exactly that and names the
gesture (`runward update`), rather than implying a check that did not happen.

**No new syntax.** The first attempt at class 7 introduced a quoting convention documented nowhere,
with three delimiters colliding with markdown, French, and editors' smart quotes. Only `"` delimits,
and the ambiguous case is refused instead of narrowed.

## Alternatives discarded

- **Require a typed pointer on every `applied` row.** An absence cannot be pointed at — "the CLI
  reads no secret at runtime" has no file to cite — and forcing one manufactures the
  cited-not-applied this tool exists to catch. Counting and naming the prose is the honest form.
- **Warn instead of failing.** The audit's own finding is that the reassuring output was the
  problem. A warning on a green gate is read as green.
- **Verify the corpus against the package instead of the lock.** That is what `update` did before
  the 0.28.0 lock, and it cannot tell an upstream change from a local edit.

## Consequences

- **Positive.** The cheapest paths to a false green are closed, each by a mechanism that names what
  is wrong and the gesture that fixes it.
- **Negative, accepted, and the reason this is a MAJOR release.** Missions that were green may now
  be red: a hand-edited rule, a deviation resting on an unratified ADR, a circular pointer. That is
  the point — those verdicts were about something other than what they claimed.
- **Bounded.** No change to the exit-code contract, the machine surface, or the six phases.
- **Still true, and still declared.** None of this makes the gate judge whether evidence
  *implements* a rule. `GATE_NON_SCOPE` is unchanged and remains the honest statement of depth.

## Ratification — 2026-08-04

Ratified by the maintainer, on three audits whose every case was executed. Each class was verified
by re-running the technique that had produced exit 0: fabricated corpus, self-citation, blanket
`n/a`, `ADR-0000`, 0-byte ADR, symlink, empty symbol, duplicated section, fenced table, sealed-then-
emptied manifest, catastrophic signature. The mission runward and the shipped example both remain
green throughout, with no new section and no new violation on an honest mission.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) a new false positive is demonstrated on the deterministic layer — the audit method is
reproducible and should be re-run on any release touching `evidence.ts`, `conformance.ts` or the
seal; (b) an operator reports a legitimate mission made red by class 1 because they maintain house
rules inside `runward/rules/` — then house rules need a declared home outside the audited corpus;
or (c) the `unrecorded` corpus state is still common six months on, which would mean missions are
not running `update` and the gap is structural rather than transitional. Dated check: at the first
groom after 2027-02-01.

**Trigger set on**: 2026-08-04 · **Watched via**: field reports, and `test/audit-corpus.js`, which
replays the campaign against every release. The scripts that found these vectors lived in a session
scratchpad, which made "the audit is reproducible" something no third party could act on: an event
nobody else can replay is an assertion, not evidence. The corpus holds BOTH directions, because a
pass that only checks attacks ships a gate nobody can use.

## References

- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — closed removal; its trigger (a) named "a new vector observed", which is exactly this
- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md), [ADR-0020](ADR-0020-rule-evidence-signatures.md) — the declared depth limits, unchanged
- [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) — the seal's declared scope, now covering the claim as well as the cited files
- [ADR-0040](ADR-0040-per-rule-non-scope-declaration.md) — "every gate names what it cannot verify", applied per run and not only in the abstract
