# ADR-0074 — A mission cites the decision journal it declares

**Date**: 2026-09-12
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured on runward's own mission, on the three topology rules that require an `adr:`
nature, against 0.40.0

## Context

Three CRITICAL/HIGH rules in the shipped corpus require an `adr:` nature — `topology-port-placement-mapped`,
`topology-sovereignty-by-data-class`, `topology-trace-export-decision` — and the requirement is
right: a placement, a sovereignty posture and a trace-export posture are decisions, and a decision
that is not written down is not a decision. ADR-0017's own decision text opens that family by name:
*"placement of a block / port, sovereignty by class of data, secrets network boundary, agent-identity
location, multi-region / HA, third-party trace export. Each infrastructure decision becomes a traced,
re-evaluable ADR."*

runward has those decisions, and they are ADRs:

| Question the rule asks | The ADR that decides it | Where it lives |
|---|---|---|
| Every port has a named placement | ADR-0017 §3–4 (the port→placement bridge, one row per port with a reference ADR) | `docs/adr/` |
| Sovereignty graduated by class of data | ADR-0054 (computed in-repo, on demand; never produced, held, watched, served or aggregated by a process runward operates) | `docs/adr/` |
| Trace export is a decision | ADR-0011 (the observability port is prescribed, *"runward exports nothing itself"*; shipping an OTel exporter is in the rejected options) | `docs/adr/` |

And the gate cannot see any of them. Measured 2026-09-12 on this tree:

```
adr:0001  →  OK (resolves, accepted)      # runward/adr/ADR-0001-decision-journal-lives-in-docs-adr.md
adr:0011  →  no matching ADR in runward/adr/
adr:0017  →  no matching ADR in runward/adr/
adr:0054  →  no matching ADR in runward/adr/
```

`adrDecision` resolves an `adr:` pointer against `<mission>/adr/` and nowhere else. runward's mission
holds exactly one ADR — and that one ADR, ADR-0001 of the mission journal, is titled *"the decision
journal lives in docs/adr"*. **The mission declares where its journal is, and the gate does not read
the declaration.** The consequence is not cosmetic: on this repository three real, accepted,
on-point decisions are reported as absent, which is a FALSE NEGATIVE in the one direction that
teaches an operator to distrust the disclosure.

There is a wrong way out, and it is the tempting one. `adr:0001` resolves, so citing it on all three
rows would clear the ledger. It would also make one ADR about file layout the evidence for port
placement, sovereignty and telemetry — a universal green key, the exact shape of the circular
evidence this product already had to remove twice (`file:<the manifest itself>#<the rule slug>`, and
the bare self-path that slipped past the typed loop). A pointer whose subject has nothing to do with
its rule is worse than a missing pointer, because it reads as satisfied.

## Decision

**Proposed** — three options, with a recommendation.

**Option 1 — the mission declares its journal, the gate reads the declaration.** A machine-readable
field (scaffold-lock, or mission frontmatter) names the journal directory; `adr:` resolves there and
falls back to `<mission>/adr/`. Exact, explicit, no convention guessed. Costs a new declared field on
the mission surface, and every project that already keeps ADRs in the ecosystem's usual place has to
declare the usual place.

**Option 2 — the mission writes bridge ADRs.** Three thin files under `runward/adr/`, each naming the
product ADR that holds the substance. Needs no product change. It is also paperwork about paperwork,
which ADR-0045 exists to refuse, and it fixes nothing for any other project: `doc/adr/` (adr-tools)
and `docs/adr/` (MADR) are where the ecosystem actually keeps decisions, so every such project meets
the same wall.

**Option 3 (recommended) — `adr:` resolves across the conventional journal locations, and a refusal
names every place it looked.** Search `<mission>/adr/`, then `docs/adr/`, `doc/adr/`, `adr/`; first
hit wins; `Status` is still read, so an unaccepted decision still fails. The failure message lists
the directories searched, so an operator whose journal sits somewhere else learns where to put it
instead of guessing. Option 1 composes on top of this later if a project needs a location no
convention covers.

Why widening is safe here, stated precisely rather than assumed: the only readings this changes are
`adr:` pointers that fail TODAY and would then resolve. It cannot turn a satisfied pointer into an
unsatisfied one, and it adds no new way to pass — relevance was never judged for `adr:` pointers in
`<mission>/adr/` either, in any location. What it does change is that a repository carrying an
unrelated `docs/adr/ADR-0017-*.md` would satisfy the nature; that is the same exposure the mission
directory already has, one directory further out.

## Alternatives discarded

- **Cite `adr:0001` on all three rows.** Clears the ledger with a decision about file layout. This is
  the universal green key, twice removed from this product already.
- **Drop `requires: adr` from the topology rules.** The requirement is the correct one — it is what
  ADR-0017 decided. Relaxing a rule because the tooling cannot see its evidence is fixing the
  thermometer.
- **Resolve `adr:` by scanning the whole repository for `ADR-NNNN`.** Turns any file that mentions a
  number into a decision. A pointer that always resolves verifies nothing.

## Consequences

- runward's own mission stops reporting three real decisions as absent, and the `requiresUnmet`
  disclosure becomes a list of genuine gaps rather than a list containing artifacts of resolution.
- Any project whose ADRs live where the ecosystem puts them can satisfy an `adr:` nature without
  moving files or declaring anything.
- One more place where the gate reads what the mission says about itself, rather than assuming a
  layout.

## What would settle it

A positive control in both directions, on one tree: with the change, `adr:0017` resolves from
`docs/adr/` and the three topology rows leave `requiresUnmet`; and an `adr:` pointer naming a
decision that exists nowhere still fails, with a message that names every directory searched. Plus
the non-regression that matters: a mission whose ADRs sit in `runward/adr/` resolves exactly as it
does today, byte for byte in the payload.

## Reevaluation trigger (mandatory, dated)

A project reports that the convention list resolved a pointer against a directory they did not
consider their journal (the widening is then too broad and Option 1's explicit declaration becomes
the default), or a fourth ADR convention becomes common enough that the list is no longer a list.

**Trigger set on**: 2026-09-12 · **Watched via**: the `requiresUnmet` disclosure on the pilot's
mission and the register's `machine-surface` class
