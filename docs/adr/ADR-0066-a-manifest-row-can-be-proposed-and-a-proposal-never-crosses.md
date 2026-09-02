# ADR-0066 — A manifest row can be proposed, and a proposal never crosses

**Date**: 2026-09-02
**Status**: accepted 2026-09-03 (ratified by the maintainer on the 2026-09-02 investigation's measurements, unamended)
**Deciders**: Thibault Souris (maintainer)
**Method**: entry cost counted on a fresh mission against the built binary; row families counted
from the shipped corpus frontmatter; every marking candidate tested against the current
`readManifest` before being chosen or discarded.

## Context

**The entry cost, measured.** A fresh mission after `init --yes` plus `manifest --sync` reports,
in the gate's own summary line: **"12 deliverable(s) not filled · 36 rule-conformance gap(s)"**
(measured on a throwaway mission with the built 0.37.1 binary). The 36 rows split architect 6,
topology 4, floor 10, govern 12, handover 4 — 31 unique rules, 5 demanded in two phases. Behind
them, the 12 deliverables carry roughly 339 placeholders of their own. The dominant cost per row is
not deciding; it is FINDING the evidence before deciding: at 10–25 minutes per row of opening the
rule, searching the code, and formatting a typed pointer, the manifest alone is an estimated 5 to
9 hours (declared estimate, to be timed on the first pilot), inside a lived total of 2 to 4 days.

**What the machine could already corroborate, counted from the corpus.** Of the 36 rows: **11**
belong to rules declaring a verifiable `signature:` (a content pattern the gate already checks when
evidence is cited); **8** belong to rules with declared territory (`appliesTo`) but no signature;
**17** belong to rules with neither — pure judgment. Half the table is mechanically corroborable
today; none of it is mechanically pre-filled.

**Agents already fill these tables — illegitimately.** The 2026-09-02 adversarial audit filled 13
deliverables backwards in 2 minutes, with no code, and the gate stayed green. The product offers an
agent no legitimate channel: writing a bare `applied` fabricates the judge (the judged party
manufacturing its own verdict), and writing nothing leaves the work invisible. The worst case is
the current case.

**The product already owns the answer's vocabulary.** `characterize --mine` emits `DRAFT-*.md`
files with `Status: hypothesis` and the sentence "they are not decisions until you own them";
`unratifiedAdrs()` counts `proposed` ADRs as strict gaps; ADR-0038 rejected the mutable ledger
("the deliverable IS the state"). The proposed→ratified lifecycle exists; it has never been offered
at the granularity of a manifest row.

**The marking candidates were tested, not assumed.** Writing `proposed:applied` into a row today
makes the gate answer `✗ invalid status "proposed:applied" (use applied | deviated | n/a)` and exit
non-zero — the prefix **fails closed on every deployed binary** (measured). A fourth column, by
contrast, is folded into the Evidence cell by `readManifest` (`cols.slice(2).join(" | ")`), so
every deployed binary would read a marked row as a decided one and pass — it **fails open**, which
disqualifies it outright.

## Decision

**1. The status grammar gains `proposed:applied | proposed:deviated | proposed:n/a`.** The gate
refuses every proposed row — a proposal never crosses — with a dedicated strict counter
("N proposed row(s) awaiting ratification") in the human output, in the `check --json` machine
contract (ADR-0030; re-derived by `runward verify` like every predicate field), and in the SARIF.
A proposed row is never an anonymous form error: it is a named, refused, counted state.

**2. `runward propose` pre-fills deterministically.** No model call, no network, bytes at rest only
(the ADR-0014 posture). It writes `proposed:applied` with the found pointer ONLY where a rule's
declared signature matches a file inside its declared territory (11 of 36 rows on the shipped
corpus), and records the proposer as declared text ("runward propose vX, signature matched").
Territory-without-signature rows get their governed files listed in the command output, never a
status — guessing would fabricate the judge. It never touches a decided or already-proposed row:
idempotent, the ADR-0038 non-resurrection precedent.

**3. Agents propose through the same grammar.** The charter (AGENTS.md) and the workflows instruct:
at the point of action, fill the row as `proposed:<status>` with a typed pointer and a one-line
justification; never a bare status; never run `ratify`. The agent's judgment is structurally
outside the verdict path — the gate sees a proposal and refuses it, satisfying ADR-0001 and
ADR-0054 without an exception clause.

**4. `runward ratify` turns proposals into the operator's decisions — against displayed evidence.**
It shows what the gate already knows how to resolve (existence, line, symbol presence, signature
verdict — all existing machinery in `evidence.ts`) plus an excerpt of the cited file, then takes
accept / edit / reject (empties the row back to a frank gap) / skip. It **refuses a non-interactive
terminal**: a ratification is an answer to displayed evidence, not a flag. The only escape is
explicit and self-marking — `--attest-blind` ratifies without display and records `mode: BLIND`,
disclosed by every later `check` and carried into the attestation. The ADR-0060 shape: legitimate
in real cases (migrating a historical mission), never silent.

**5. `ratify --all` exists, with a mandatory sample.** Forbidding the bulk gesture would push
operators to `sed`. The sample is drawn deterministically from the mission-state digest (same tree,
same sample — no re-rolling): every signed row whose signature does NOT match is always included,
plus 20 % of the rest, minimum 3. A rejected sampled row cancels the bloc for the unseen rows —
the sample just proved the lot untrustworthy.

**6. The trace lives in the deliverable, and travels the existing channels.** An append-only
`### Ratification` block under each manifest records rows, ratifier, proposer, and mode
(line-by-line / en-bloc with sample size / BLIND) — all **declared, none proved**: runward holds no
key (ADR-0021), and it says so wherever the names print. The block reaches the attestation through
`missionStateDigest` (which already hashes all of `runward/`) and a `ratification` summary object
in the check --json predicate; nothing new is sealed, and `--freeze` cannot seal pending proposals
because they are strict gaps by construction. Decided rows carrying no ratification trace are
counted and disclosed ("N decided row(s) carry no ratification trace") — never blocking by
default, since the solo operator editing rows by hand is today's legitimate path; the armed opt-in
tier (ADR-0065's plan line) may block it for missions that declare agent-built work.

**7. `GATE_NON_SCOPE` grows exactly one sentence**: ratification proves a human answered the
displayed evidence; it never proves the human understood it.

## Alternatives discarded

- **Auto-fill without ratification** (`propose` writes bare statuses): the judged party fabricates
  the judge; contradicts ADR-0023's "form, never content" and empties the one thing the product
  sells — a human signature that means something.
- **En-bloc ratification without a sample**: measured in this product's own audit, unchecked bulk
  acceptance is how 13 deliverables got filled backwards in 2 minutes; a bloc with no witnessed row
  is `--attest-blind` wearing a suit.
- **A fourth column as the marker**: measured — `readManifest` folds extra columns into Evidence,
  so every deployed binary reads the row as decided and passes. Fails open; disqualified.
- **A proposals ledger beside the deliverable**: rejected by precedent (ADR-0038) — mutable state
  beside the deliverable fights "same commit → same output"; the deliverable IS the state.
- **Do nothing**: the entry cost stays 2–4 days and the agent channel stays illegitimate, so agents
  keep writing bare statuses with no marking at all — the current worst case, kept.

## Consequences

- **Positive.** The manifest's entry cost drops from an estimated 5–9 hours to an estimated 45–90
  minutes (declared estimates, to be timed): 11 signature-corroborated rows become a glance, 15
  proposable rows become a judgment on shown evidence, and only 3 rows remain true human
  arbitration. The human signature is not diluted — it is moved from "produce 36 rows" to "answer
  36 displayed proofs", which is what ADR-0001 meant by the judgment staying with the operator.
  The ratification's SHAPE becomes machine-legible (attestation, verify, SARIF): an auditor sees
  how the signing happened, not merely that a status exists.
- **Negative, accepted.** Two new commands to maintain and mutation-test; the Ratification block is
  a new parsed grammar (kept line-oriented, one parser, the RWD-2026-0084 lesson). The
  proposer/ratifier identity is declared, not proved — stated wherever it prints.
- **On other boundaries.** No LLM enters the verdict path (the agent's draft is refused, never read
  as judgment); nothing is hosted; nothing is signed under a runward key; the attestation is not
  extended, it embarks through existing channels.

## What would settle it

The first pilot mission (ADR-0052): time the ratification session against the declared estimates,
count untraced rows on an agent-built mission, and count what the mandatory sample catches. A
sample that catches nothing across several missions argues for shrinking it; a session that still
takes days argues the cost was never in the manifest.

## Reevaluation trigger (mandatory, dated)

Reopen if: operators ratify blind en bloc as routine (add friction — the ADR-0014 trigger shape);
the sample never catches anything (shrink it); or agents keep writing bare statuses anyway (arm the
untraced-rows counter by default).

**Trigger set on**: 2026-09-02 · **Watched via**: the disclosed counters (`proposed`, `untraced`,
ratification modes) on the pilot mission and on this repository's own mission.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the judgment stays with
  the operator at the gate; this ADR gives that judgment a cheaper, not weaker, form.
- [ADR-0023](ADR-0023-manifest-sync-scaffolds-form-never-content.md) — a scaffolded row is not a
  decision; a proposed row is not one either, and now says so in its status.
- [ADR-0038](ADR-0038-mine-across-languages-groups-by-family-and-never-resurrects-a-ratified-draft.md)
  — the proposed→ratified lifecycle and the no-ledger precedent this row-level mechanism inherits.
- [ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md) — the disclosed-never-silent
  shape `--attest-blind` and the untraced counter copy.
- `src/lib/conformance.ts` (VALID_STATUS, readManifest), `src/lib/evidence.ts`,
  `src/lib/attestation.ts` (missionStateDigest — unchanged, the measured embarkation path).
