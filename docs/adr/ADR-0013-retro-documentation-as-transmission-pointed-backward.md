# ADR-0013: Retro-documentation as the transmission phase pointed backward

**Date**: 2026-07-09
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — cross-referenced against the FDE method (`methode-fde`, `transmettre-capitaliser`) and a 4-angle veille (internal capability map, enterprise demand, tooling landscape, mechanism design), challenged against the never-a-runtime and zero-LLM-gate invariants, durable position. Decision only; no code in this ADR.

> **Amendment (2026-07-11) — the `--mine` sub-step uses no model.** This ADR's body describes the ADR-mining sub-step as one that "may use an agent/LLM" (§Decision, §Consequences). That was superseded by the **[ADR-0014](ADR-0014-the-characterize-command-contract.md) amendment (2026-07-10)**, which reconciled `characterize --mine` with the zero-LLM-tool invariant: mining is **deterministic git archaeology, no model call**. Read the phrasing below as historical; the shipped behaviour is deterministic. The gate stays zero-LLM either way.

## Context

A large installed base of systems — legacy services, and now the ~95% of GenAI agents shipped without governance — exists without the documentation a regulator, an acquirer, or an inheriting team now demands. The forcing functions are dated and owned: EU AI Act art. 11/111 (a "significant change" to a pre-2026 high-risk system triggers a full technical file), DORA and SR 11-7 (model/asset inventories for the financial installed base), ISO/IEC 42001 (traceability at certification), M&A technical due diligence. The job is not "documentation is expensive"; it is "an undocumented system must become governed and transmissible, by a date, for an owner."

Three facts make this runward's ground, not a new product:

- **The method already names it.** `methode-fde`'s entry-mode gesture lists "audit complet puis refonte d'un existant qui n'a pas suivi la doctrine" and delegates to a `reprendre-un-existant` skill whose job is to "reconstituer ce qui manque et ramener dans la chaîne au bon palier." That skill is referenced but unwritten; runward has a `brownfield.md` workflow but **no `characterize` command** — the entry mode is documented, not tooled.
- **The output IS the transmission kit.** `transmettre-capitaliser` defines the phase-6 kit as reusable assets · architecture note · ADR journal · recovery runbook · proofs in code — identical to the retro-documentation artifact set. Retro-documentation is the transmission phase reconstructed for a system that skipped it.
- **The competitive white space is the decision layer.** Code-doc tools (Swimm, Mintlify) reconstruct structure; ADR tools (Log4brains, git-adr) author decisions going forward; governance platforms (Credo, watsonx) govern at the model/policy level and are runtimes. None reconstruct *why a legacy system is the way it is* as ADRs with dated re-evaluation triggers, coupled to a deterministic operator-owned gate.

The trap is the highest-temptation overclaim in runward's history: "the AI reads your code and generates your compliance documentation." That would put an LLM's judgment in the gate and turn runward into an unaccountable black-box certifier — the exact anti-goal.

## Decision

Adopt **retro-documentation as a first-class capability, framed as the transmission phase pointed backward**: reconstruct the phase-6 kit for an existing system as a **structured elicitation-and-validation pipeline** — advisory tooling *proposes* reconstructed decisions from evidence, the operator *validates* each and attaches its trigger, and the deterministic gate checks only that a validated, traced decision now exists where the system demands one. The governance of the reconstruction is the deliverable; the reconstruction itself is the cheap, fallible part.

The minimal surface (to be built ADR-first in follow-up work), each piece holding every invariant:

- **`runward characterize`** — a read-only command. A deterministic inventory (dependencies, pinned versions, entrypoints, CI topology, test coverage) plus an **opt-in advisory** ADR-mining sub-step that may use an agent/LLM but writes only `DRAFT-*.md` ADRs (`status: hypothesis`, evidence pointers, `why: UNKNOWN`) **outside the gate**. It parses artifacts at rest — installs and runs nothing of the user's system.
- **An ADR `status: hypothesis → accepted` lifecycle** — a predicate, not a feature. `check --strict` additionally requires `status: accepted` + a non-empty *why* + a non-empty re-evaluation trigger. A reconstructed decision is a hypothesis until the operator ratifies it; an unratified hypothesis **fails** the gate.
- **`runward check --coverage`** — an advisory report (never a gate): required decision-points versus traced-and-validated ones, with open `why: UNKNOWN` items surfaced. Informative pressure toward completeness without asserting it.
- **A `mission/gap-analysis.md` template** and a characterization-test scaffold; and, doctrine-side, authoring the referenced-but-absent `reprendre-un-existant` skill.

The discipline that keeps this honest:

- **The gate checks recording, never reconstruction.** It stays deterministic and zero-LLM (ADR-0001). The LLM lives in the opt-in mining sub-step, strictly upstream and advisory; the gate gains one boolean predicate. A brilliant unvalidated inference fails; a mundane validated decision passes.
- **The operator owns every gate.** Reconstruction confidence tops out at MEDIUM automatically — the *why* (LOW confidence, not in the code) must be supplied by a human, or the gate fails. Nothing reaches "decided" without an operator.
- **Never a runtime.** `characterize` reads artifacts at rest. runward reconstructs the transmissible **kit**; it does not *realize* transmission — that is proven autonomy (`transmettre-capitaliser` DoD), which requires humans working the kit. Copy says "reconstructs the handover kit," never "runward transmits your system."
- **Audit-ready, never compliant (ADR-0009).** Output is supporting evidence that a validated traced decision exists; never a conformity assessment, certification, or a claim the system is safe.

## Alternatives discarded

- **A full auto-documentation generator** ("point it at a repo, get the docs"). Puts LLM judgment on the path to the verdict, produces unvalidated prose as if it were fact, and invites the compliance overclaim. Rejected — it breaks the zero-LLM gate and the operator-owns-the-gate invariants at once.
- **A governance/compliance platform** (the Credo/watsonx shape). Requires becoming a runtime that ingests live asset metadata and asserts compliance posture. Rejected outright — violates never-a-runtime and the vendor-neutral stance.
- **Leave brownfield as a workflow only.** The entry mode stays documented-not-tooled, the `reprendre-un-existant` skill stays unwritten, and the largest, most deadline-driven enterprise pull (regulated retrofits, M&A, agent-sprawl governance) goes unaddressed. Rejected — it forfeits ground the method already claims.

## Consequences

- **Positive.** Completes an entry mode the method already names; reuses every existing primitive (brownfield, ADR-with-triggers, gate, threat model, handover) rather than adding a product line; opens the regulated/enterprise door that forward-only delivery does not; makes runward's transmission moat addressable across the undocumented installed base. Sharpens the story: "the transmission you can run — forward, and backward."
- **Negative, accepted.** The overclaim surface is the largest runward has faced; it is contained only by the guardrails above and `docs/retro-documentation.md`, not by the tool itself. The reconstruction is advisory and fallible (its quality is an agent's, not runward's). Build cost is real, though bounded and staged.
- **On other boundaries.** A new read-only `characterize` command; ADR frontmatter gains a `status` field; a new `--coverage` advisory flag; a `gap-analysis.md` template. The deterministic audit gains exactly one predicate (`accepted` + why + trigger) and stays zero-LLM and zero-run.

## Reevaluation trigger (mandatory, dated)

Reopen if the advisory ADR-mining sub-step is asked to influence the gate verdict (an LLM creeping onto the `check --strict` path), or if the "audit-ready evidence" framing is read as certification by users or auditors in the field. At that point, restrict the mining to a stricter, non-generative form or drop the advisory layer entirely rather than let the gate or the claim drift.

**Trigger set on**: 2026-07-09 · **Watched via**: field feedback on retro-doc usage and any reported compliance overclaim.

## Amendment (2026-08-17) — the tooled half shipped; the doctrine skill is not this repository's to write

The 2026-08-14 audit found the `reprendre-un-existant` skill still absent and `methode-fde` still
delegating to it — a dangling reference two years of releases never closed. It is closed here by
deciding rather than by promising again.

**What this repository owed, it delivered.** The entry mode is tooled: `runward characterize` (a
read-only inventory of an existing codebase, deterministic and zero-LLM), the `brownfield.md`
workflow, the `gap-analysis.md` mission template, and the account in
[retro-documentation.md](../retro-documentation.md). An operator picking up an existing system runs
those today; nothing in that path waits on a skill file.

**What remains is doctrine, and doctrine lives elsewhere.** `reprendre-un-existant` is a skill of the
canon *Designing and Running Agentic Systems*, published in its own repository under CC BY-ND 4.0
([NOTICE.md](../../NOTICE.md)). runward is MIT tooling of that doctrine; authoring a doctrine skill
from this repository would place CC BY-ND text in an MIT tree and blur the licence split the project
maintains on purpose. So this ADR stops carrying it as runward debt: the reference is the doctrine's,
tracked where the doctrine is written, and runward's obligation — making the entry mode executable —
is met.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate the lifecycle predicate extends.
- [ADR-0009](ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md) — the audit-ready-evidence framing and its guardrails.
- [ADR-0010](ADR-0010-agents-md-as-a-first-class-handover-deliverable.md) — the handover kit retro-doc reconstructs.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the ports retro-doc recovers.
- `docs/retro-documentation.md` — the capability brief, matrices, and anti-overclaim guardrails.
- `templates/workflows/brownfield.md`, `docs/when-to-use.md` — the documented entry mode this ADR makes first-class.
- FDE method: `methode-fde` (the named entry mode), `transmettre-capitaliser` (the kit and the proven-autonomy DoD).
