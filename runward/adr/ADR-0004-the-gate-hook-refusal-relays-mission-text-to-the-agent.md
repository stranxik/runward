# ADR-0004 — The gate-hook refusal relays mission text to the agent

**Date**: 2026-09-27
**Status**: accepted — decision taken by the maintainer on 2026-09-27 on the ratification dossier's recommendation; text drafted by the coding agent, accepted by the maintainer's review and merge
**Deciders**: the maintainer
**Method**: ratification preparation of 2026-09-27

## Context

The rule `security-prompt-injection` asks that observed content stay data, never instruction. runward
calls no model. But since product ADR-0065, `runward gate-hook` returns its refusal into the coding
agent's loop, in the channel the harness uses to block a turn, and that refusal quotes rule ids, paths
and evidence text from the manifests: at most 25 lines, each quoting its cell whole (a drift message
relays the entire evidence cell), not escaped (`src/lib/gate-hook.ts`, `src/lib/conformance.ts`). Evidence text shaped as an instruction reaches the model with the authority
of a harness block. The two rows said `n/a` ("no model ingests anything"); that is no longer true.

## Decision

Both rows are `deviated`. The relay is accepted as bounded: it adds no private data (the agent can read
the same files in the tree) and opens no outbound channel (the refusal goes back to the same agent; a
hosted model's provider receives it through the operator's harness, like everything the agent reads),
so runward does not complete a trifecta path. What it adds is authority, and that is recorded, not denied.

## Alternatives discarded

- **Keep `n/a`.** False since ADR-0065.
- **Quote the relayed text as data now.** Marking it "data, not instructions" or not relaying free
  evidence text is a product change, left to the trigger below.

## Consequences

- **Positive**: the path where runward's output reaches a model with a harness block's authority is
  named in the threat model and the manifests. (The shipped advisory hooks and skills also let the
  agent read `check` output, with no more authority than any command's output.)
- **Negative, accepted**: until the product quotes relayed text as data, a crafted evidence cell can
  read as an instruction to the agent that sees the refusal.

## Reevaluation trigger (mandatory, dated)

Reopen when the gate-hook refusal changes shape, or on the first reported case of relayed evidence text
steering an agent.

**Trigger set on**: 2026-09-27 · **Watched via**: changes to `src/lib/gate-hook.ts`; issues and known defects.

## References

- Product ADR-0065 (`docs/adr/ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md`), threat model §1 and §2.
