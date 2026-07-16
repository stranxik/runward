# Verify — Advisory Cite-vs-Apply Review (above the gate, never in it)

## When to use

Use this **after** `runward check --strict` is green, and before you cross the gate as the operator. The deterministic gate proves a decision was *traced* for every CRITICAL/HIGH rule (applied with a pointer, deviated with an ADR, n/a with a reason). It cannot prove the code an `applied` row points at **actually applies** the rule rather than merely citing it — that is a semantic judgment. This workflow makes that judgment, adversarially, to inform yours.

It is **advisory**. It produces findings, never a verdict that gates. `runward check --strict` stays the load-bearing decision; you cross it. See [ADR-0007].

## Inputs

- The `Rule conformance` manifests (`floor.md`, `architecture.md`, `governance/threat-model.md`).
- The code each `applied` row points at.

## Procedure

**Challenge each `applied` claim, adversarially.** For every `applied` row, open its evidence (the `file:line` or test) and default to skepticism: *does this code actually apply the rule it names, or does it only cite it?* Judge through distinct lenses — correctness, does-it-reproduce, security-relevance — and, where you can, run this pass on a **different model** than the one that built the floor, so it does not agree with itself.

**Return a finding per row**: `confirmed` (the code applies the rule), `cited-not-applied` (the row claims applied but the code does not carry the rule), or `uncertain` (needs a human look). Deduplicate overlapping findings; group them by severity.

**Write the findings, then hand them to the operator.** Record the pass in `runward/governance/verify-findings.md`: a dated header (date, model used, manifests reviewed) and one line per `applied` row — `rule · finding · pointer · one-line reason`. A green `check --strict` surfaces this artifact's presence and freshness (stale once a gated manifest changes); it never reads a verdict out of it. The findings are input to the operator's gate decision, not a gate of their own. A `cited-not-applied` finding is a prompt to fix the code (or downgrade the row to `deviated`/`n/a`) and re-run `check --strict` — never a silent override of the deterministic gate.

## Definition of Done

- Every `applied` row reviewed, with a confirmed / cited-not-applied / uncertain finding.
- Findings written to `runward/governance/verify-findings.md` (dated) and handed to the operator; no exit code produced, no gate blocked.
- Any `cited-not-applied` finding routed back to the code and re-checked deterministically.

## Anti-patterns

- Treating a clean `verify` pass as "the gate passed" — it is advisory; the deterministic `check --strict` is the gate.
- Wiring `verify` into CI as a blocking step, or into an exit code — it never blocks.
- Running `verify` **instead of** `check --strict` — it sits above the deterministic gate, it does not replace it.
- Running it on the same model that wrote the code and trusting the agreement — use a different lens, ideally a different model.
