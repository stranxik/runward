# ADR-0018: Native skill packagings as opt-in application adapters over the gated core

**Date**: 2026-07-12
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — the craft rules are enforced markdown, but the *application* layer (how the operating agent surfaces the right rule at the point of action) is asymmetric across harnesses; challenged against the never-a-runtime, vendor-neutral and gate-is-the-authority invariants; the competitive angle is that ungated skill-loading is exactly the soft, LLM-judged framing runward refuses.

## Context

runward's craft rules (`runward/rules/`) are, functionally, **skills** — reusable craft knowledge the agent applies while building. Two layers must be kept distinct:

- **Enforcement.** `runward check --strict` verifies each CRITICAL/HIGH rule was **accounted for** in the deliverable's conformance manifest (`applied` + `file:line`/test, `deviated` + ADR, `n/a` + reason). This is deterministic and **does not depend on how, or whether, the agent "loaded" the rule**: if the agent skips one, the manifest is incomplete and the gate goes red, forcing it back. This layer is correct, vendor-neutral (plain markdown + `AGENTS.md`), and is an invariant. It is not in question here.
- **Application.** Whether the agent surfaces the *right* rule at the *right* moment, at the point of action. Here what runward ships per harness is **asymmetric**: `.cursor/rules/` are auto-applied by Cursor (relevance/globs), `.github/copilot-instructions.md` loads as repo instructions, but the Claude Code profile ships **slash commands** (`.claude/commands/`, human-invoked) — **not** Agent Skills (`SKILL.md`, spontaneously loaded by relevance). Codex is similar. So on skill-capable harnesses, runward under-uses the very mechanism those agents now have for surfacing craft at the point of action.

The competitive reality sharpens the stakes. Delivery frameworks like BMAD lean **fully** into spontaneous skill/persona loading: it feels LLM-native and delightful, and it drove real adoption. But their loading is **ungated** — the agent may or may not apply what it loaded, and nothing verifies it. That is precisely the soft, LLM-judged framing runward exists to replace. The risk to name: **if respecting the invariants makes runward feel austere while competitors feel spontaneous, users never reach the production problem where runward wins.** The fix is not to loosen the invariants (that would make runward a worse BMAD); it is to make the *application* layer as spontaneous as theirs while keeping the gate underneath.

## Decision

Ship **native skill packagings as opt-in, non-privileged, per-harness application adapters**, layered strictly **above** the gated neutral core. Same shape as the tool profiles (`tools.ts`) and the gate adapters (ADR-0012): runward emits them; the operator opts in; no harness is privileged.

1. **A small set of runward skills per phase, not one per rule.** A `SKILL.md`-shaped packaging (and its per-harness equivalents) that points *into* the rules by build phase (`architect`, `topology`, `floor`, `govern`), so a skill-capable agent surfaces the relevant rules spontaneously at the point of action. Sixty micro-skills would be noise; a handful of phase-scoped skills is the right grain.
2. **The gate stays the sole authority.** A skill only helps the agent *apply* a rule; it never replaces the manifest verification. `check --strict` remains the deterministic judge. A skill that is loaded but not applied still fails the gate. **A skill without the gate is just advice** — the competitors' soft framing — and runward must never present its skills as the mechanism, only as the application convenience over an enforced core.
3. **Opt-in and vendor-neutral.** Emitted like the other profiles, selected by `--tools` (or a dedicated flag), inert until chosen. No harness is privileged; a new one is a new sample file, not a core change. `AGENTS.md` stays the neutral entry that works for any agent, including those with no skill mechanism.
4. **The harness skill format is a versioned port (ADR-0011), not a coupling.** Agent Skill formats are young and move fast. runward pins the format it targets as a versioned boundary and decouples its own rule content from the packaging, so a format change is an adapter bump, never a core rewrite.

The framing to hold: this is **altitude-1** work — the delightful, LLM-native application experience — done **without crossing any invariant**. runward goes full throttle on experience here, and holds the line on enforcement, never-a-runtime and vendor-neutrality. It is how runward matches a "go-full-throttle" competitor on feel while staying on the right side of the limit.

## Amendment (2026-07-12) — corrected by a multi-agent ecosystem/competitor scan

Two premises of the original decision were wrong, and the framing is corrected accordingly. The **decision stands**; its cost and its claim change.

1. **`SKILL.md` is a *converged open standard*, not N fast-moving per-harness formats.** The [agentskills.io](https://agentskills.io) `SKILL.md` spec (name + description frontmatter + progressive-disclosure body) is adopted across Claude Code, Codex, Cursor, Copilot/VS Code, Gemini, goose, Kiro and others. So the *content* is single-sourced and the *format* is one; only the *install location* differs per harness. This is **cheaper** than the ADR assumed — closer to one adapter than N.
2. **Native `SKILL.md` is *table stakes*, not a differentiator.** BMAD, Spec Kit and OpenSpec have **all already migrated** to native `SKILL.md` as their primary install format. Shipping it is **catch-up to parity**, not a moat. Never message it as an edge.
3. **The real edge is not the container.** It is (a) the **doctrine content** inside the skill, (b) the **gate underneath** (a skill loaded-but-not-applied still fails `check --strict` — the one thing competitors lack), and (c) **genuine spontaneity**: authoring descriptions that self-activate the craft on intent, where the competitors ship the container but still drive it with user-invoked pipelines (`/speckit.specify`, `bmad-help`, `/opsx:propose`). Honest caveat: reliable runtime auto-*triggering* mid-task is only partially proven, so (c) is a bet on experience, not a certainty.
4. **Scope tightened.** Ship the phase skills (architect / topology / floor / govern) only where a **relevance-loading mechanism actually exists** (initial estimate: Claude Code, Cursor, Windsurf). *Superseded by the amendment below.*

## Amendment 2 (2026-07-12) — the `.agents/skills/` convergence (top-20 harness scan)

A full scan of the top ~20 harnesses **disproved the "nothing for Copilot/Gemini" call in point 4 above** and revealed a cleaner design. As of Dec 2025, **Copilot and Gemini CLI both ship SKILL.md Agent Skills with genuine relevance loading**, and — decisively — **`.agents/skills/<name>/SKILL.md` is a converged vendor-neutral alias read by 14+ harnesses** in one write: Codex, Cursor, Copilot, Gemini, Windsurf, Cline, Zed, Amp, opencode, Roo Code, Kilo Code, Warp, Devin, Augment. This is more vendor-neutral than the per-harness idioms first shipped (`.cursor/rules/*.mdc`, `.windsurf/rules/*.md`), which are now redundant and removed.

**Final emission (implemented):**
- **Baseline, always written (like `AGENTS.md`):** `.agents/skills/runward-<phase>/SKILL.md` — the neutral seam, no agent privileged, covering the 14 harnesses above.
- **Per-harness mirrors, via `--tools`, for harnesses that do not read `.agents/skills/`:** Claude Code → `.claude/skills/`; Junie → `.junie/skills/` (SKILL.md, own path); Trae → `.trae/skills/`; Continue.dev → `.continue/rules/runward-<phase>.md` (no SKILL.md, but `alwaysApply:false` + `description` = description-triggered).
- **`AGENTS.md`-only ceiling (honest):** Aider and goose have no description-triggered surface; their craft rides the always-written `AGENTS.md`. Not forced into always-on prose.

Content is single-sourced (`skillBody`); each target gets the SKILL.md open format (or its native idiom for Continue). Naming: say "SKILL.md-format skills"; only Roo, Kilo and Augment cite the agentskills.io standard by name. Everything stays subordinate to the deterministic gate. This makes the phase skills a **vendor-neutral baseline** (parity with `AGENTS.md`) rather than a per-profile opt-in — the cleanest expression of the vendor-neutral invariant.

Net: still worth doing (cheap, closes the experience gap on the two largest agent audiences), but as honest parity plus a spontaneity bet, never as a claimed moat.

## Alternatives discarded

- **Move the core to skills (rules become skills, drop or de-emphasize the markdown + gate).** Collapses runward into an ungated, LLM-judged framing — the exact thing that dies before production and that competitors already do. It would trade runward's only durable moat (the deterministic gate on a traced decision) for short-term feel. Rejected outright.
- **Do nothing; keep the current posture.** Defensible on enforcement (the gate already works regardless of loading), but it leaves the application asymmetry in place and cedes the LLM-native, spontaneous experience to competitors on skill-capable harnesses — the precise gap that lets a burned user never reach the production problem. Rejected as the reason this ADR exists.
- **Ship one harness's skills as the privileged path (e.g. only Claude Code).** Breaks vendor-neutrality, the invariant that no agent is privileged. Rejected; every skill packaging is one optional sample among peers.
- **Auto-load / auto-register the skills for the agent.** The ADR-0012 foot-gun again: surprise wiring without the operator's act. Skills are emitted and opt-in; the operator (or the agent, on the operator's approval, per the ADR-0012 amendment) enables them. Rejected.

## Consequences

- **Positive.** On skill-capable harnesses, the agent surfaces the right craft rules spontaneously at the point of action — the application layer becomes as fluent as a "go-full-throttle" competitor's, closing the experience gap. Enforcement, vendor-neutrality and never-a-runtime are untouched. The moat (the gate) is unchanged and stays the headline.
- **Negative, accepted.** More surface to maintain: N per-harness skill formats on top of the existing tool profiles. Bounded by treating them as optional profiles, keeping the rule *content* single-sourced, and pinning each format as a versioned port. If maintenance outpaces the application gain, the trigger below reopens it.
- **On other boundaries.** A new emitted/updated/doctored profile family, like `workflows/`, `rules/`, `adapters/`. The deterministic audit, its exit-code contract, and the zero-LLM invariant are not touched. `AGENTS.md` remains the neutral, always-works entry.

## Reevaluation trigger (mandatory, dated)

Reopen if: (a) the Agent Skill formats converge to a cross-harness standard — then target that single standard as one port and retire the per-harness packagings; (b) maintaining N formats measurably outpaces the application gain (signal: skill packagings drift stale relative to the rules, or few operators enable them); or (c) any evidence that a shipped skill is being treated as a substitute for the gate rather than an application layer over it — in which case tighten the framing or pull the packaging.

**Trigger set on**: 2026-07-12 · **Watched via**: Agent Skill format convergence in the ecosystem veille, skill-packaging staleness against the rules, and operator opt-in rates.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate that remains the sole authority; skills sit above it.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the versioned-port framing applied to the moving Agent Skill formats.
- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the emit-and-opt-in, none-privileged adapter pattern this ADR reuses (and its 2026-07-12 amendment on agent-assisted, approval-gated wiring).
- `src/lib/tools.ts`, `src/commands/init.ts` — the tool-profile surface a skill-packaging profile would extend.
- `runward/rules/` — the single-sourced rule content the packagings point into.
