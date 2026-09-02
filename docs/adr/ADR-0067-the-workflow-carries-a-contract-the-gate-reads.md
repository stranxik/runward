# ADR-0067 — The workflow carries a contract the gate reads

**Date**: 2026-09-02
**Status**: proposed
**Deciders**: Thibault Souris (maintainer)
**Method**: all 11 shipped workflows read in full and checked, command by command, against the
0.37.1 binary; the vacuum measured on this repository's own mission; the design evaluated against
ADR-0054's five crossings, one by one.

## Context

**Eleven procedures, copied, counted, cited — read by nothing.** `templates/workflows/` holds the
method itself: 11 files, 621 lines (`wc -l`), copied into every mission by `init`, refreshed into
LIVING missions by `update`, counted by `status` and `doctor`, cited at four call sites. They are
lexically current with 0.37.1 — every cited command, flag and template was verified one by one, and
iterate.md is exact to the digit ("twelve" vs `rules --phase govern --json` → 12. But of the
roughly 25 artifacts the 11 procedures promise, the machine reads five sealed conformance
manifests, one advisory findings file, and presence counts. The sequence — what each procedure
produces, what it requires first, what controls it imposes — is enforced nowhere. No ADR decided
the method would not be opposable; it is a vacuum, not a traced choice.

**The product's own mission demonstrates the vacuum.** Measured on this repository: `ls
runward/workflows/` → *No such file or directory* (the showcase mission never received the
procedures `init` copies to every user); `runward status` prints "! missing: method, frame,
architect, floor, iterate, govern, handover, brownfield, review, decision-loop, verify — run
`runward update`", advice never followed; and `runward check --strict` **exits 0** while its own
advisory line tells the operator to "run the verify workflow (runward/workflows/verify.md)" — a
path written in hard code at `check.ts:316` that does not exist in the very mission the gate just
judged. The gate recommends a file its own tree lacks, and stays green, because workflow presence
enters no verdict.

**Adjacent structural gaps, measured.** The CLI command `runward verify <attestation>` (ADR-0055,
2026-08-14) collides with the verify WORKFLOW (2026-07-16): an operator who types the gate's advice
gets "missing required argument 'attestation'". The reference scaffold `floor-ts/` that floor.md
tells the builder to start from is absent from the npm package's `files` field (measured against
package.json): the `npx` user cannot follow the procedure without cloning the git repository.
decision-loop.md promises artifacts in a `decisions/` directory the mission layout does not know.

**Why this matters beyond hygiene.** The 2026-09-02 audit filled 13 deliverables backwards in 2
minutes with no code, and the gate stayed green: the coherence the gate demands today is purely
textual. And the disclosure that should catch a reader's eye is drowned: in the sabotage scenario,
one 41-word sentence repeated 36 times makes up 71.6 % of the strict output. Both defects have the
same root — the gate has no per-procedure notion of what was promised, so it can neither demand a
committed control report nor speak about one procedure at a time.

## Decision

**1. Every workflow opens with a frontmatter contract**, the same head-grammar discipline as the
rules corpus: `workflow` (slug = filename), `phase` (the gate it serves, or `none` for advisory
procedures like verify and review), `produces` (mission-relative paths, with `gated: true` for a
sealed deliverable), `requires` (artifacts that must read `filled` before this procedure's phase is
judged), `controls` (the commands the procedure imposes on the builder — each naming an `evidence`
kind from the ALREADY-SHIPPED strict adapters (junit | sarif | lcov | cobertura | eslint |
cyclonedx) and a committed `report` path), `gate: strict | none`, and a one-sentence `nonScope`.

**2. What `check` verifies — deterministic, offline, no execution ever:**
- the 11 contracts parse, mission copy taking precedence over the package copy (the rules-corpus
  precedence); a malformed contract is a violation, not a silence (the `malformed`-pointer
  precedent from `evidence.ts`);
- the produces↔gate join holds both ways — every sealed deliverable is claimed by exactly one
  contract, every `gated: true` path is in `GATED_DELIVERABLES` — joined by descriptor, never by
  position;
- `requires` resolve to the `filled` state (the existing artifact-state reader) when the contract's
  phase is judged;
- every declared control's `report` resolves, parses under its adapter, and carries the demanded
  result — the exact mechanics of the strict tool adapters already shipped; runward reads the
  committed report, it never runs the tool;
- all contract paths are confined to the judged tree: `..`, absolute paths, or escaping links make
  the contract malformed and are never followed (the `evidence.ts` confinement, reused);
- the contract's `nonScope` prints once per concerned procedure — the dedup hook that retires the
  41-word sentence repeated 36 times.

**3. Surfaced by default, blocking only when armed.** Contract violations surface like
verify-findings freshness does today; under the armed opt-in tier they exit 1. Missions that
predate contracts change nothing until their operator opts in.

**4. The product rewires its own hard edges from the contracts.** `check.ts:316`'s advice derives
from the verify contract's `produces` instead of a hard-coded path; the `VERIFY_FINDINGS` constant
derives from the same contract (one source of truth); `status` reads promises
kept / empty / malformed instead of counting file presence; `doctor` verifies the 11 package
templates parse; `EXPECTED_WORKFLOW_CONTRACTS = 11` joins the inventory constants. And the showcase
mission must finally carry its workflows (`runward update`, performed by the author): with an armed
gate, the vacuum measured above becomes impossible to recreate silently.

**5. What the contract never claims — its own nonScope.** It proves that a procedure declared its
deliverables, that its inputs were filled, and that its imposed controls left committed, parseable,
passing reports. It never proves the procedure was walked in order, nor in good faith: chronology
is explicitly out of scope, so the load-bearing property "same working tree ⇒ same verdict" holds.
Backward-filling stops being prose-writing and becomes report-fabrication (a JUnit that parses and
passes, a coherent lcov); catching the FABRICATED report is a different product's race, deliberately
not entered.

**Evaluated against ADR-0054's five crossings, one by one:**
1. *No network endpoint serving rules or verdicts* — not crossed: contracts are files in the
   mission tree, read at `check` invocation; nothing serves, nothing listens.
2. *No long-lived process between invocations* — not crossed: no watcher; the only freshness notion
   remains verify-findings' surfaced mtime, never in the verdict.
3. *No key, state or identity the operator does not hold* — not crossed: contracts and control
   reports are the operator's committed files; runward signs nothing, retains nothing.
4. *No reading beyond the judged tree* — not crossed, and locked into the grammar: relative paths
   only, `..`/absolute/escaping = malformed, never followed; and explicitly NO git history, no base
   ref — temporal order is declared out of scope rather than measured through the harness's state
   (the ADR-0041 line).
5. *No network or LLM in the verdict path* — not crossed: YAML parsing, file joins, and the
   existing offline adapters; the verify workflow keeps `gate: none`, advisory by its own contract
   (ADR-0007).

## Alternatives discarded

- **Leave the workflows as uncontracted prose (status quo).** The measured result: the gate
  advises a file its own mission lacks and stays green, and 20 of the ~25 promised artifacts are
  prose nobody joins. The method the product IS remains the only part of the product the gate
  cannot see.
- **Verify chronology through git history.** Would prove "walked in order" — and would cross
  ADR-0054's fourth line: the moment runward runs git against a base ref it reads the harness's
  state, and "same tree ⇒ same verdict" dies. Rejected; order stays out of scope, said out loud.
- **A workflow runner that executes the procedures.** The frame becomes the runtime. Rejected
  outright, ADR-0012's founding sentence.
- **Fold workflow obligations into the rules corpus.** Rules govern code territory and are
  confronted at the point of action (ADR-0042); procedures govern sequence and artifacts. Different
  subjects, different lifecycles, and the corpus inventory (`EXPECTED_RULES`) would silently absorb
  things that are not rules.
- **Resolve the verify name collision inside this ADR.** A real defect with its own decision to
  make (rename one of the two, or document the cohabitation); this ADR only stops the hard-coded
  advice from pointing into the void. Conflating them would sink both.

## Consequences

- **Positive.** The method becomes opposable by declaration: every procedure states what it leaves
  behind, and the gate joins the statement to the tree. The two-minute backward-fill now meets
  demanded control reports. The disclosure noise gets its structural fix (one nonScope per
  contract). The product submits itself first: its own mission must carry the workflows or its own
  armed gate reds — the measured self-exemption closes.
- **Negative, accepted.** A new grammar to parse, test and mutation-cover; 11 templates gain a
  header agents must not mangle (a drift test extends the existing agent-contract pin from 2 files
  to 12); `update` must migrate contract FORM while preserving operator-filled fields such as a
  control's project-specific test command — form, never content, the ADR-0023 discipline.
- **On other boundaries.** `GATED_DELIVERABLES` is unchanged and becomes the join target; one new
  violation family; the effort reuses the typed-pointer engine (frontmatter parsing, path
  confinement, strict adapters — ADR-0019/0020), so the only genuinely new object is the
  contract↔gate join.

## What would settle it

Wire the contracts on the shipped 11 and run `runward update` on this repository's own mission,
then replay two measurements. First, the 2026-09-02 backward-fill: it must now SURFACE by default
and RED under the armed tier, on the missing or failing control reports. Second, the self-exemption:
`check` on the product's own mission must derive its verify advice from a contract that resolves,
and `status` must report zero empty promises. If either replay still passes silently, the joins are
decorative and the shape is wrong.

## Reevaluation trigger (mandatory, dated)

Reopen if operators routinely satisfy controls with stub reports that parse and pass (the contract
would then select for fabrication over proof — reconsider what a control may demand), or if a
second contract-parsing implementation appears anywhere in the product (the RWD-2026-0084 lesson:
two copies of one grammar diverge; there is one parser or there is none).

**Trigger set on**: 2026-09-02 · **Watched via**: the two replays above, the pilot's first
contracted mission, and `doctor`'s 11-contract inventory.

## References

- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — the five crossings this design is
  evaluated against, clause by clause, above.
- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) and
  [ADR-0020](ADR-0020-rule-evidence-signatures.md) — the engine (typed pointers, confinement,
  strict adapters) this reuses instead of reinventing.
- [ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md) — the `runward verify`
  command whose name collides with the verify workflow; the collision gets its own decision.
- [ADR-0042](ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) — why
  workflow contracts do not fold into the rules corpus.
- `templates/workflows/` (the 11), `src/lib/conformance.ts` (GATED_DELIVERABLES),
  `src/lib/tool-adapters.ts`, `src/commands/check.ts:316`, `src/commands/update.ts` — the surfaces
  this ADR touches.
