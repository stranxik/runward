# ADR-0027: Adapters into competing orchestrators — the gate as a review layer they call

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a fresh competitive benchmark (BMAD, OpenSpec, Spec Kit, Spec Kitty at code level) surfaced a distribution seam, challenged against the vendor-neutral and never-a-runtime invariants, durable position

## Context

The benchmark confirmed runward's four exclusive grounds (rule-level gate with verified evidence, signed+sealed evidence, gated hand-over, deterministic OSCAL) and one concrete opening: **BMAD's `bmad-code-review` exposes a review-layers extension point whose `instruction` may "run anything (e.g. an external reviewer via bash)".** That is a first-class, documented seam by which runward's deterministic gate can run *inside* a competitor's review flow — beside its LLM reviewers, not against them. BMAD carries ~50k stars; being a review layer they invoke is distribution on their traction, and it sharpens the layering runward already claims (the harnesses and orchestrators enforce at the action; runward keeps the decision traced across the mission).

ADR-0012 established the gate-as-a-port with inert harness adapters (git, CI, Claude Code, GitLab, Kiro). This extends the same posture to a *competing orchestrator's own extension point*: another seam, same contract (the exit code), same inert-sample discipline.

## Decision

Ship `templates/adapters/bmad-review-layer.toml` — an inert `[[workflow.review_layers]]` block the operator copies into BMAD's `bmad-code-review` customize.toml. It adds one review layer that runs `npx runward check --strict` via bash and reports the exit code as a finding beside BMAD's adversarial subagents. Same invariants as every adapter: runward writes nothing into BMAD, installs nothing, runs nothing on its own; the operator wires it; the gate stays the load-bearing decision the operator crosses.

Framed as a **complement**: BMAD's layers judge the code's craft (LLM, adversarial); runward's layer verifies deterministically that the traced decisions are accounted for with resolving evidence. The two answer different questions; running both is strictly more than either. `EXPECTED_ADAPTERS` 5 → 6; the adapters README documents the seam.

## Alternatives discarded

- **Do not adapt into competitors** (stay standalone). Leaves distribution on the table and cedes the "we integrate with your existing flow" ground; the review-layer seam is exactly where a deterministic checker belongs, and an operator already on BMAD is the ideal runward user.
- **A deep BMAD integration** (a BMAD plugin/skill that embeds runward). Couples runward to one orchestrator's internals and its release cycle; the inert `.toml` sample keeps the coupling at the exit-code contract, swappable and neutral.
- **Privilege BMAD over the other orchestrators.** Rejected on the vendor-neutral invariant: BMAD ships first because it has the documented bash seam today; OpenSpec/Spec Kit/Spec Kitty adapters follow the same pattern when their seams are as clean, and none is privileged in the copy.

## Consequences

- **Positive.** runward reaches operators inside the largest spec-driven orchestrator as a complement on their distribution; the layering story ("your orchestrator enforces the action, runward keeps the decision traced and its evidence verified") gets a working demonstration; the never-a-runtime line is preserved (a called reviewer, not a resident process).
- **Negative, accepted.** The sample tracks BMAD's extension-point shape (`{diff_output}`/`{spec_file}` substitution, the `[[workflow.review_layers]]` schema); if BMAD changes it, the sample needs a refresh — bounded, since it is one inert block. A perception risk (endorsing a competitor) is outweighed by meeting operators where they are.
- **On other boundaries.** `templates/adapters/` gains the BMAD sample; `EXPECTED_ADAPTERS`, the adapters README, `doctor` and smoke follow; no change to the gate mechanics.

## Reevaluation trigger (mandatory, dated)

Reopen if BMAD (or another orchestrator) turns its review seam into a real deterministic checker of its own (then the complement becomes redundant there — reassess), or if maintaining the sample against a competitor's schema churn costs more than the distribution returns.

**Trigger set on**: 2026-07-16 · **Watched via**: BMAD's review-layer schema across releases, and any signal of runward adoption arriving through the BMAD seam.

## References

- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the gate-as-a-port and inert-adapter posture this extends to a competitor's seam.
- [ADR-0018](ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) — the vendor-neutral, no-privileged-agent invariant.
- BMAD `bmad-code-review` customize.toml `[[workflow.review_layers]]` — the documented extension point this adapter targets.
