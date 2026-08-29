# Open decisions — questions raised, not yet arbitrated

The ADR journal beside this file holds decisions that were **made**. Every one of its entries is
`accepted`. That is the right shape for a journal, and it leaves nowhere to put the other thing a
project accumulates: a question that was raised, that has a real cost either way, and that nobody
has decided yet.

Without such a place those questions live in whatever conversation surfaced them, which means they
are lost the moment that conversation scrolls. This register exists so that raising one is an act
that leaves a trace, and so that arbitrating one is an act that closes something.

**What belongs here.** A question about what runward should DO — behaviour a user or a downstream
tool observes — where the answer is a judgement rather than a measurement, and where choosing wrong
is expensive enough to be worth the wait. Not a bug (those go to
[known-defects.md](../compliance/known-defects.md)), not a task, not an idea.

**What each entry owes.** The same discipline the defect register asks: what was measured, what is
actually known versus assumed, what each option costs, and — the field that keeps this register from
becoming a wish list — **what would settle it**. An entry that cannot say what evidence would decide
it is not a decision waiting on judgement, it is a question nobody has thought about yet.

**How an entry closes.** By an ADR. The entry then names it and moves to the closed table at the
bottom, so the trail from "this was noticed" to "this was decided" survives in one place. An entry
does not close by being implemented, and it does not close by going quiet.

---

## Open

### OD-0001 — What does a SARIF finding about a MISSING file anchor to?

**Raised** 2026-08-29, while instructing `sarif` in the mutation campaign.

**The situation, measured.** `check --sarif` emits every finding with a `physicalLocation` naming
the artifact it is about. For a finding whose whole content is that an artifact is ABSENT, that path
is by definition not in the checkout. Measured on a realistic red mission: six findings, one of them
anchored to a path that does not resolve — `runward/deliverable-not-filled` on
`runward/runbook.md`, the deliverable it reports as missing.

Three finding families can produce it, and only two of them actually do:

| family | anchors to | can the path be absent? |
|---|---|---|
| `runward/deliverable-not-filled` | `runward/<deliverable>` | yes, when the state is `missing` |
| `runward/rule-corpus` | `runward/rules/<file>` | yes, for a rule reported gone |
| `runward/unratified-decision` | `runward/adr/<file>` | no — the file exists, it is merely unratified |
| `runward/evidence-seal`, `runward/hook-failed` | the lock, `hooks.json` | no — present by construction |

**Why it is not obviously fine.** This project already refused a version of this once: RWD-2026-0041
shipped uris no checkout held, and the net that came out of it asserts *every uri resolves in the
checkout*. That invariant is the reason the question surfaced at all — the new fixtures made it fail,
and it was narrowed to admit exactly this case rather than dropped. So the current behaviour now sits
inside a stated exception rather than inside a guarantee, which is honest but is not the same as
being right.

**Why it is not obviously wrong either.** The finding is *about* that path. Anchoring it to the
manifest that requires the deliverable would put a red mark on a file that is fine, and a reviewer
following the annotation would land somewhere the problem is not.

**What is actually known about the consequence — and what is not.** GitHub's code-scanning
documentation is **silent** on a result whose path is absent from the analyzed commit. It states
only that relative paths are resolved against the repository root, that an absolute URI is converted
to a relative one to be "matched against a file committed to the repository", and — for the
neighbouring case — that a path resolved through a symlink leaves code scanning "unable to display
the result". Reports from other tools' users describe the alert being ingested and the file view
answering *"Sorry, we couldn't find this file in the repository"*, and separately that an EMPTY
`artifactLocation.uri` makes the upload itself fail. Ingested-but-undisplayable and rejected are very
different outcomes, and the difference is exactly what this decision turns on.

**The options.**

1. **Keep it.** The finding names the path it is about. Cost: on a forge, the alert may be
   undisplayable; the "every uri resolves" guarantee stays weakened by a stated exception.
2. **Anchor to the manifest.** Every uri resolves again, unconditionally. Cost: the annotation lands
   on a file that is correct, and the reviewer has to read the message to learn which file is
   actually missing.
3. **Anchor to the manifest, name the path in the message.** Option 2 with the loss mitigated in
   prose. Cost: two paths in one finding, and the machine surface no longer says which artifact the
   finding is about in a field a tool can read.

**What would settle it.** An actual upload of a document carrying an absent-path finding to GitHub
code scanning, and a look at what the alert becomes: created and displayable, created and
undisplayable, or rejected. That is one CI run against a scratch repository, and it turns three
guesses into one measurement. Until it is run, this stays open — the documentation cannot answer it
and neither can reasoning.

**Currently in the tree.** Option 1, with `test/sarif-shape.js` asserting that a non-resolving uri
belongs to a finding about an absent artifact, and that every other uri resolves.

---

## Closed

_None yet. An entry moves here when an ADR decides it, and names that ADR._

| id | question | decided by | outcome |
|---|---|---|---|
