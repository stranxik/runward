# ADR-0100 — Whether a mission can span several repositories: a system, and one aggregated evidence file

**Date**: 2026-10-22
**Status**: accepted (2026-10-23) — the maintainer kept A (one mission per project) and recorded the convention an operator's system document follows meanwhile: cite each member's emitted artefact by digest, never merge their states. C is the target contract if a second adopter asks; E is measured before any sentence says it works
**Deciders**: the maintainer
**Method**: an adopter's finding, re-checked by the adopter against runward 0.44.1 on 2026-10-22; read
against a fresh clone of `stranxik/runward` at `main@de61beb` (0.44.1): `src/cli.ts` (`check -p,
--path`), ADR-0039, 0041, 0054, 0064 and 0093 (decisions 10 and 11, the D4 delivery)
**Relates to**: [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(the organisation view, `runward-fleet`, D4), [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md)
(crossing 4 and the fleet corollary), [ADR-0064](ADR-0064-the-verdict-gets-a-report-an-auditor-reads-alone.md)
(a grouping is a pure function of emitted fields), [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md)
(the operator layer), [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)
(territory by path)

## Context

**What was reported.** An adopter delivers a system made of several applications, each in its own
repository, and is asked for one evidence file for the system. In runward a mission is one project:
`check` judges the `runward/` directory of the project it is pointed at (`-p, --path`, the current
directory by default), and every artefact it writes (`check --json`, the witness, the attestation, the
delivery report) describes that one tree. There is no system-level mission and no aggregated file.

**What the boundary says.** ADR-0054 crossing 4 forbids the verdict to read beyond the single mission
tree it judges: a second repository's working tree, its git history, a base ref. Its fleet corollary,
as amended by ADR-0093, keeps "assembled from artifacts each repo already emitted, never from a live
pipe into the repos". ADR-0064, as amended by ADR-0093, permits a grouping inside runward as a pure
function of emitted fields, under a versioned contract, publishing the list it counts, and forbids it in
any view.

**The closest planned piece.** D4 of ADR-0093 delivers `runward-fleet`, a customer-run satellite that
reads the files each repository emitted, verifies their signatures under the customer's trust policy and
displays them. Its view rules (decision 11) include "states never summed, no composite percentage",
"silence is a finding" and "a repository cannot sign for another". So the organisation view shows
several missions side by side; by its own rules it does not say "the system is green".

**What the adopter's "one evidence file" can mean.** Either a document that carries every member's
verdict with its provenance, readable alone (an aggregation of evidence), or a verdict about the system
(an aggregation of judgements). The first fits the boundary as files; the second needs a rule that
combines verdicts, which nothing in runward defines today.

## Decision

**Decided (2026-10-23).** A stays: one mission per project, aggregation the operator's. Recorded
with it, as documentation and not as a contract runward verifies: a system document cites each member
repository's emitted artefact (`check --json` or witness) by commit and digest, and never adds their
states into a system verdict. That is option C's shape without the gate reading it, so a later
`runward-system/1` can adopt documents written that way. C is the option a second adopter would reopen;
B waits for D4; D is the adopter's choice, not runward's; E (nested missions) is measured before any
sentence says it works.

The options as proposed on 2026-10-22: **one of the options below, or a combination**, chosen by the maintainer on the
evidence under "What would settle it". Until then the tree keeps A.

- **A. One mission per project, aggregation the operator's (the tree today).** Cost: zero code. The
  adopter assembles its own system file from each repository's emitted artefacts, with no contract and
  no verification runward stands behind.
- **B. The organisation view of D4 as the system view.** A system is a named set of repositories in the
  satellite's configuration; the view lists each member's emitted verdict, its commit, its signature
  state and its age, and names a silent member as a finding. Cost: waits for D4; it is a display, not a
  file an auditor carries away, unless the satellite's export is that file; and it says nothing about the
  system as a whole, by its view rules.
- **C. A system manifest, read by the gate in its own tree.** A system repository (or a directory in
  one) holds a file listing its members, each by repository, commit and the digest of its emitted
  `check --json` or witness, and committed copies of those artefacts. `check` on that tree verifies the
  digests and reports, per member, what the copy says; an aggregated file is a pure function of those
  copies (ADR-0064 as amended). No live read: it stays inside crossing 4. Cost: a new versioned contract
  (a `runward-system/1` file, its schema and its refusals); the copies go stale exactly as a committed
  JUnit report does (ADR-0098 is the same question one level up); and, if the file carries a system
  verdict, a combination rule that ADR-0093's view rules would have to be amended to allow, with its own
  record.
- **D. One repository for the system.** Several applications in one repository under one mission, each
  application's rules scoped by territory (ADR-0041). Cost: it asks the adopter to restructure its
  repositories for the gate; the deliverables (framing, architecture, floor) are written once for
  several applications, which may or may not match how the system is delivered.
- **E. Several missions in one repository, one per directory.** Each application keeps its own
  `runward/` directory and is judged with `-p`; an aggregation is then B or C over directories rather
  than repositories. Cost: whether every command and every adapter handles a nested mission has not been
  measured for this record; a measurement comes before any sentence saying it works.

## Alternatives discarded

- **The gate reads the member repositories live** (their working trees, their forges, their git
  history). ADR-0054 crossings 1, 4 and 5; refused by name, as ADR-0041 refused `--changed`.
- **A hosted aggregator inside the CLI.** A process runward operates that stores or serves verdicts is a
  runtime; the vendor-operated product is separate by ADR-0093 decision 10 (D6), and the CLI knows
  neither its URL nor its existence.
- **A system verdict as the minimum or the sum of member verdicts, without a record.** ADR-0093 forbids
  summed states and composite percentages in any view; a combination rule is a decision, not a display
  detail.

## Consequences

- B adds nothing to the CLI; C adds a contract and a refusal surface to the gate; D and E add none but
  move cost to the adopter (D) or to a measurement (E).
- C and any system-level verdict would be read by auditors as a statement about the system; the wording
  of what it does not establish (each member judged on its own tree, at its own commit, at its own date)
  would have to travel with it.
- Whatever is chosen, a member's verdict stays computed in its own repository; nothing here lets one
  repository sign or judge for another.

## What would settle it

- **For A**: adopters for whom a hand-assembled file is accepted by their clients.
- **For B**: D4 built, and an adopter's reviewer accepting a side-by-side view with provenance as the
  system file, with no system verdict asked for.
- **For C**: an adopter's client requiring one file it can verify offline, with each member's evidence
  inside, and B's export measured as not enough; plus a decision on whether the file carries a combined
  verdict, in its own record.
- **For D**: an adopter whose applications already share a repository, or who prefers to.
- **For E**: a measurement of `check`, `report`, `wire` and the adapters on a repository with two nested
  missions, each judged with `-p`.

## Reevaluation trigger (mandatory, dated)

Reopen when D4 of ADR-0093 starts, when a second adopter asks for a system-level evidence file, or on
2027-01-22, whichever comes first.

**Trigger set on**: 2026-10-22 · **Watched via**: issues mentioning several repositories, a system, a
monorepo or an aggregated report, and the ADR-0093 delivery plan in the ROADMAP.

## References

- `src/cli.ts`: `check -p, --path <path>` (the project a mission belongs to).
- ADR-0093, decisions 10 (the satellite) and 11 (the view rules), and the D4 delivery.
- ADR-0054, crossing 4 and the fleet corollary as amended on 2026-10-13.
