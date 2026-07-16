# Hand-over Note

> **Usage.** Fill this note in phase 6 (`workflows/handover.md`), as the succession happens — not after. It is the kit made legible in one place: what is handed over, the proof that the receiving side can operate alone, and who owns the system now. `runward check --strict` verifies its conformance manifest; you transfer autonomy, not documents.

## 1. The kit

One row per leave-behind. State is honest: a document nobody has exercised is `untested`, not `ready`.

| Artifact | Where | State | Exercised by the receiving side? |
|---|---|---|---|
| Recovery runbook | `runbook.md` | [ready \| untested] | [when / by whom, or not yet] |
| Agent charter (finalized) | `AGENTS.md` | [finalized at hand-over \| still the scaffold] | [—] |
| Architecture note + decision journal | `architecture.md` · `adr/` | [current \| stale] | [—] |
| Evaluation bench | [where it runs] | [ready \| untested] | [—] |
| Evidence pack | `compliance/` (regenerate on demand) | [—] | [—] |

## 2. The redone task (the proof)

The hand-over is proven by a real task redone end to end **without the departing builder**. Record it here; point the manifest at this section.

- **Task**: [a real one from the mission's backlog — which change, run, fix or evaluation]
- **Date / doer**: [when, and who — explicitly without the builder in the loop]
- **Evidence**: [the artifact produced — a merged change, a report, a closed approval; a pointer the gate can verify]
- **Gaps found**: [every step the doer had to guess — each folded back into the runbook or charter before the gate is crossed]

## 3. Succession

- **Owner after departure**: [named person or standing role — incidents, cost, keys, open ADR triggers]
- **Escalation path**: [who is called when the owner is not enough — security contact, sponsor, provider support]
- **Review cadence**: [when the usage registry, the ADR triggers and the evidence seal are re-read, and in which forum]
- **Credentials boundary**: [where the keys live, who rotates them; the builder's accesses revoked on — date]

## 4. Provider-swap drill

The model is a replaceable adapter behind a port — proven, not assumed. Record the last drill: [date, from → to, what was re-run afterwards (the bench), result]. If never drilled, say so here and name the trigger that will force it.

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the handover phase (`runward/rules/`, frontmatter `phases: [handover]`). `applied` needs a pointer; `deviated` needs an ADR; `n/a` needs a reason. `runward check --strict` verifies this table is complete — it checks a traced succession, not whether the hand-over went well.
>
> Evidence can be **typed**, and typed pointers are verified deterministically at the gate: `file:PATH[:LINE][#SYMBOL]` · `test:PATH[::NAME]` · `adr:NNNN` — several per cell, separated by `;`. The gate checks resolution, non-emptiness, line count, symbol/test-name presence, and the rule's `signature:` when it declares one (ADR-0019/0020). Free prose stays valid — it is your judgment; a path it cites must simply not point at an empty file.

| Rule | Status | Evidence |
|---|---|---|
| [rule-slug] | applied \| deviated \| n/a | [pointer, ADR-id, or reason] |

## Cross-references

- `workflows/handover.md` — the phase this note closes.
- `runbook.md` — the operational half of the kit; this note indexes, the runbook operates.
- `AGENTS.md` — the charter the next agent inherits.
- `adr/` — the open re-evaluation triggers the new owner now watches.
