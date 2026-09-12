# ADR-0075 — A required nature the project cannot produce

**Date**: 2026-09-12
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured on runward's own mission against 0.40.0 — the `requiresUnmet` ledger, the
installed dev dependencies, and the workflows that emit reports

## Context

Seven rows on runward's own mission require an evidence nature this repository has no tool to
produce. The disclosure has been correct and quiet since Chantier 7 shipped it; what has never been
decided is what the author does about it.

| Nature | Rows | The tool that would produce it | Present in this repository |
|---|---|---|---|
| `eslint` | `hexa-architecture`, `hexa-adapter-pattern` — on `architecture.md` and `floor.md` | a linter with an import-boundary rule | **no** — no `eslint.config.*`, no `eslint` dev dependency, no lint script |
| `sarif` | `config-secrets-boundary` (CRITICAL), `checklist-pre-production-security` (CRITICAL) | a secrets scanner, a code scanner | **partly** — `scorecard.yml` uploads SARIF to code scanning; nothing is committed, and OSSF Scorecard is about repository practice, not about either rule's subject |
| `loadtest` | `checklist-pre-production-performance` | k6 or JMeter | **no** — `test/bench-scale.js` measures the real question and is neither |

One detail makes the `eslint` gap sharper than a missing dependency. `src/lib/styles.ts:99` carries
`// eslint-disable-next-line no-control-regex` — a directive addressed to a linter this project does
not install. The repository already believes it is linted.

And the requirement itself is right, which is why this is a decision and not a bug. An architecture
rule states a boundary; a boundary is provable by a lint rule that refuses the forbidden import, and
not provable by a sentence saying the boundary holds. `requires: eslint` on `hexa-architecture` is the
corpus asking for the only evidence that would actually settle the claim. runward asserts hexagonal
architecture in prose, in its own manifest, on a HIGH rule — the precise shape of the thing it sells
against.

## Decision

**Proposed** — one answer per nature, because the three gaps are not the same gap.

**1. `eslint` — install it, and mechanise the architecture claim (recommended).** Add ESLint with an
import-boundary rule that encodes the hexagon: `src/lib/**` may not import from `src/commands/**`, and
nothing outside the adapters may import a command. Emit a committable report the way the JUnit report
already is (`scripts/junit-committable.mjs`: run the tool, strip what is not the verdict, exit with
the TOOL's status), commit it, cite it per rule. This closes four rows with real evidence and turns
runward's own loudest architectural claim into a machine-checked fact. It is also the doctrine the
project already holds about itself: the author stands at the strictest tier.

**2. `sarif` — commit a scan that is about the rule's subject.** `config-secrets-boundary` wants a
secrets scanner (gitleaks emits SARIF natively); `checklist-pre-production-security` wants a code
scanner (CodeQL, already available to this repository through the action it uses for Scorecard). The
committed report must be made deterministic first — a scan carries timestamps and run ids, exactly
what the JUnit committable step had to strip — and the gate reads it, never runs it (ADR-0054).
Citing the existing Scorecard SARIF instead is explicitly refused: it resolves, it is a real report,
and it says nothing about either rule. A pointer that resolves and does not bear on its rule is the
vague spelling that passes.

**3. `loadtest` — declare that this mission cannot carry it, and say why in the disclosure.** runward
is a CLI with no endpoint, no session and no concurrency surface; k6 and JMeter have nothing to
address. `test/bench-scale.js` measures the question that does exist — the gate on the reference
mission and under 10,000 uncited files, in CI — and writing its numbers into a k6 summary schema
would produce a report implying a tool that never ran. That is the one thing this product may never
ship. So the honest state is a declared limit, and the disclosure should carry the reason rather than
listing the row beside gaps that are closable. Widening the `loadtest` adapter set to a generic
committable performance report is a candidate, deliberately NOT taken here: defining a report schema
is implementing a standard, and ADR-0011 rejected exactly that move.

## Alternatives discarded

- **Relax the `requires:` on the rules that are unmet.** The fastest green and the worst trade: the
  corpus would stop asking for the evidence that settles an architecture claim because the author's
  own repository could not produce it. Fixing the thermometer.
- **Fabricate the shape.** A k6-schema file from a Node bench, an ESLint-schema file written by hand.
  Every adapter in this product exists to read a report a tool produced; a hand-written report in a
  tool's schema is the false green the whole evidence layer is built against.
- **Leave all seven disclosed and undecided.** That is the status quo, and it is what this ADR closes:
  a disclosure with no decision behind it eventually reads as noise, and then it stops being read.

## Consequences

- Four rows move from a disclosed gap to machine-checked evidence, and runward's architecture claim
  becomes falsifiable by its own CI.
- Two CRITICAL security rows gain a committed scan whose subject is the rule, which is also the first
  SARIF this project both produces and consumes.
- One row becomes a DECLARED limit with its reason attached — the shape ADR-0072 ratified: the
  unknown is surfaced, never refused, and never silent.
- The `requiresUnmet` ledger becomes a list an operator can act on, instead of a list containing one
  entry that no action would ever clear.

## What would settle it

Per nature, and each with a positive control: the lint rule refuses a deliberate cross-boundary
import before it passes a clean tree (a guard whose red was never measured is not a guard); the
committed gitleaks report is byte-identical across two runs and refuses when a planted test secret is
present; and the `loadtest` row's disclosure names the reason a CLI carries no load test, read back
from the machine payload rather than from this file.

## Reevaluation trigger (mandatory, dated)

runward grows a surface with concurrency or an endpoint (the `loadtest` declaration is then wrong and
the row becomes closable), or the lint boundary rule starts refusing an honest import often enough
that the rule encodes the wrong hexagon.

**Trigger set on**: 2026-09-12 · **Watched via**: the `requiresUnmet` ledger on every release and the
register's `wrong-guidance` class
