# runward × retro-documentation (source of truth)

Internal reference. Retro-documentation is **the transmission phase (phase 6) pointed backward** at a system that skipped it. Reconstruct, after the fact, the docs a system was built without — decisions (as ADRs), architecture, ports, threat model, governance, and a handover kit — turning an undocumented black box into a governed, audit-ready, transmissible mission. Keep every claim here defensible; when in doubt, downgrade the claim.

## Thesis

The job is not "docs are expensive" (weak, vendor-sourced numbers). It is: **an undocumented system must become governed and transmissible, by a date, for an owner — an auditor, an acquirer, a regulator.** runward's existing primitives (brownfield "characterize before touching" + ADR-with-triggers + deterministic conformance gate + threat model + handover) are a 1:1 match, and **no competitor occupies the decision layer.**

Retro-documentation is not "the AI reads your code and writes your docs." It is a **structured elicitation-and-validation pipeline**: advisory tooling *proposes* reconstructed decisions from evidence; the operator *validates* each one and attaches its re-evaluation trigger; the deterministic gate only ever checks that a validated, traced decision now exists where the system demands one. The reconstruction is the cheap, fallible part. **The governance of the reconstruction is the deliverable.**

## Doctrinal verification (why this is not scope creep)

1. **Already named by the method.** `methode-fde` lists the entry mode "audit complet puis refonte d'un existant qui n'a pas suivi la doctrine" and delegates to a `reprendre-un-existant` skill whose job is to "reconstituer ce qui manque et ramener dans la chaîne au bon palier." Retro-doc is that entry mode, built out.
2. **The retro-doc output IS the transmission kit.** `transmettre-capitaliser` defines the kit as reusable assets · architecture note · ADR journal · recovery runbook · proofs in code — identical to the retro-doc artifact set. Retro-doc reconstructs the phase-6 kit for a system that never produced it.
3. **It reconstructs the layer the doctrine values.** "Ce qui se capitalise, ce n'est pas le prototype (remplaçable), c'est l'architecture et la méthode." Retro-doc reconstructs decisions + architecture — the durable layer.

### The sharp caveat (non-negotiable)

"runward realizes the transmission" is **only half true**, and the doctrine draws the line hard. Transmission's Definition of Done is **proven autonomy** ("le collectif refait une tâche seul, sans le FDE"), NOT a kit handed over — "une note remise n'est pas une compétence transmise." So:

> runward **reconstructs the transmission KIT** (the material substrate). It does **not** *realize* transmission — that requires humans working the kit to autonomy. Claim "reconstructs the handover kit" / "transmission, tooled." **Never** "runward transmits / certifies / auto-documents your system."

Second doctrinal guard: "un exécutable vaut mieux qu'un beau document." Retro-doc produces documents, so it is justified **only when tied to an owner and a deadline** (autonomy, governance, audit) — never "beautiful docs." Lead with the deadline-owning persona, never developer-productivity.

## Matrix 1 — GTM: need → runward artifact → maturity → buyer → urgency

| # | Enterprise need | runward artifact(s) | Maturity | Buyer | Trigger / urgency |
|---|---|---|---|---|---|
| 1 ⭐ | Ungoverned production AI agents → governed (the ~95% stalled) | threat model + OWASP ASI + `check --strict` + AGENTS.md | 🟡 primitives present, needs `characterize` at scale | CTO / Head of AI | Board: "are our agents safe/compliant?" — **no incumbent** |
| 2 ⭐ | EU AI Act Art. 11/111 technical-file retrofit on legacy high-risk | brownfield characterize + retroactive ADRs + threat model + manifest | 🟡 templates present, needs coverage + gap-analysis | CISO / AI Governance / Compliance | "Significant change" to a pre-2026 system → new conformity assessment (2026→2027) — **highest WTP** |
| 3 ⭐ | M&A technical due diligence (pre-close) | brownfield characterize + gap-analysis + reconstructed ADRs | 🔨 workflow yes, command no | Acquirer CTO / PE deal team | LOI signed, diligence window — deal-sized budget, **fast proof** |
| 4 | Post-acquisition handover (PMI) | AGENTS.md + runbook + ADR journal | ✅ handover is first-class | Head of Platform | Close + departing target staff |
| 5 | Model inventory / doc (SR 11-7, DORA) | ADR + architecture + threat (partial) | 🔨 partial fit (not a model-inventory tool) | Model Risk / CRO | Regulatory exam / DORA register (live 2025) |
| 6 | Key-person / retirement knowledge capture | ADR journal + AGENTS.md | 🟡 | Engineering Director | A principal engineer leaves |
| 7 | Post-incident audit-readiness (SOC2/ISO 42001) | threat model + runbook + manifest | 🟡 | CISO / VP Eng | Sev-1 postmortem, scheduled audit |

✅ exists · 🟡 primitives present, to tool · 🔨 real gap.

## Matrix 2 — Reconstruction confidence: artifact → source → confidence → validator

| Reconstructed artifact | Source read (read-only) | Confidence | Who validates | Gate treatment |
|---|---|---|---|---|
| Characterization inventory (deps, versions, entrypoints, CI, coverage) | manifests, lockfiles, CI, repo tree | **HIGH** (mechanical, reproducible) | Operator confirms scope | A fact is not a decision — not gated |
| Ports / architecture boundaries | import/call graph, adapters | **MEDIUM** (inferred, plausible-but-wrong possible) | Operator redraws boundaries | Hypothesis until confirmed |
| Retroactive ADRs — the *why* | git log, PRs, reverts, flags, TODOs | **LOW** (the *why* is not in the code) | **Human mandatory**: writes the *why* + trigger | `why: UNKNOWN` unfilled = missing decision → `--strict` fails |
| Threat-model surface | auth, untrusted inputs, secrets, CVEs | MEDIUM (gaps = open questions, not "you are secure") | Operator + security owner | Advisory; decisions it yields are gated |
| Conformance manifest | ADRs/ports/governance **already validated** | — (projection) | Operator owns it | What `--strict` reads |
| Runbook / AGENTS.md (handover) | all the above + confidence ledger | — | Operator sign-off; DoD = a third party re-runs a decision alone | Transmission = the deliverable |

The gate checks **recording, never reconstruction**. A brilliant unvalidated inference fails; a mundane validated decision passes. That keeps the gate deterministic and zero-LLM.

## Matrix 3 — Competitive white space

| Category | Reconstructs **decisions** (why + alternatives) | **Dated** re-eval triggers | Governance / threat / compliance | Deterministic **operator-owned** gate | Runtime or framework |
|---|---|---|---|---|---|
| Code-doc (Swimm, Mintlify) | ❌ structure/flows | ❌ | ❌ | ❌ | tool |
| ADR tooling (Log4brains, git-adr, LLM-on-PR) | 🟡 forward, per-PR, not mined from legacy | ❌ | ❌ | ❌ | tool |
| Architecture-recovery (Structurizr/C4, LLM research) | ❌ architecture, not decisions | ❌ | ❌ | ❌ | tool/lib |
| AI-governance platforms (Credo, watsonx, Holistic) | ❌ policy/model metadata | ❌ | ✅ | ❌ | **runtime/platform** |
| **runward** | ✅ **the core** | ✅ **unique** | ✅ (OWASP ASI, audit-ready) | ✅ | **framework, never a runtime** |

**White space:** (1) reconstruct the legacy **decision layer**; (2) decisions **+** governance/threat in one artifact set (today they live in separate universes); (3) **dated triggers** on those decisions (ADRs are static everywhere else); (4) audit-ready supporting evidence **tied to reconstructed decisions**, vendor-neutral; (5) agentic specificity (ASI01–10) with a general method.

**Honest gaps (do not deny):** auto-generation breadth (Swimm/Mintlify), diagrams (Structurizr/Doxygen), IDE integration, and governance **traction** (Credo = IBM OEM, real deployments; runward = a method/gate, not a proven enterprise platform).

## The minimal new surface (see ADR-0013)

No runtime, no LLM in the gate:
- **`runward characterize`** — read-only command: deterministic inventory + an opt-in advisory ADR-mining sub-step that writes only `DRAFT-*.md` (`status: hypothesis`, `why: UNKNOWN`) **outside** the gate. Parses artifacts at rest → "never a runtime" holds.
- **ADR `status: hypothesis → accepted` lifecycle** — a predicate: `--strict` requires `status: accepted` + non-empty `why` + non-empty `trigger`. Still deterministic, zero-LLM.
- **`runward check --coverage`** — a report (not a gate): required vs traced-and-validated decision points, `why: UNKNOWN` listed.
- Templates: `mission/gap-analysis.md` + a characterization-test scaffold.
- Doctrine-side: author the referenced-but-absent `reprendre-un-existant` skill.

## Operator ratification loop

A reconstructed decision is a hypothesis until the operator ratifies it (ADR-0013). Two things must hold: the operator cannot *miss* that ratification is required, and the agent can carry most of the work — but not the accountability.

**How the operator knows (layered forcing signals, not vigilance):**
1. **The DRAFT file self-instructs** — every `DRAFT-*.md` carries `status: hypothesis` and `why: UNKNOWN — needs operator`.
2. **The gate fails red until ratified** — `check --strict` rejects a `status: hypothesis` with an actionable message ("write the *why* + trigger and promote to `accepted`, or set `Status: rejected` and keep the file — a deleted DRAFT would be re-proposed by the next `--mine`"). The red gate is the teacher; you cannot close it without deciding.
3. **`check --coverage`** lists the open `why: UNKNOWN` items — the count of what remains to ratify.
4. **The brownfield workflow** walks the operator through characterize → reconstruct → **ratify** → govern.
5. **`characterize` ends with explicit next-steps.**

**Agent proposes, operator disposes.** The agent may mine the candidates, propose the *why* and the trigger, draft the full `accepted` ADR, and **interview** the operator ("this commit suggests X — is that the reason?"). The operator alone confirms it is true, puts their name in *Deciders*, and commits to the reopening trigger. The human supplies knowledge and judgment; the agent supplies the typing.

**The one non-delegable thing.** Ratification is an act of accountability, not a keystroke. The gate checks the *presence* of `accepted` + *why* + trigger, never their *truth* (that is what keeps it deterministic and zero-LLM). So "accept all drafts" fired at an agent unread **silently defeats the mechanism** — it launders hypotheses into false decisions. The operator's integrity at "yes, this is why, and I answer for it" is the load-bearing, un-toolable part. This is the ADR-0013 reevaluation trigger: if operators promote DRAFTs unread, add friction.

**The CLI is a transmission surface.** Because the operating agent learns what to do by reading command output, **every command must transmit its next-step guidance in its output** — not just retro-doc commands. That is how the agent relays "here is what you, the operator, must now decide" to the human. A command that does work but says nothing about the next gesture breaks the transmission chain. (Tracked as a cross-command audit in ROADMAP.)

## Anti-overclaim guardrails (non-negotiable)

❌ "auto-generates your compliance docs" · ❌ "the AI reconstructed the truth" · ❌ "certified / audit-passed / secure" · ❌ "complete documentation" · ❌ "no human needed" · ❌ "runward transmits your system." ✅ Reconstructed docs are **operator-validated hypotheses, confidence=X, basis=Y** · gate output is **supporting evidence** ("N decisions traced and validated, M open") · reconstructed ≠ original design intent, provenance always retained.

## Recommendation

Worth building — as a **narrative wedge + a small ADR-first build, not a pivot.** Reframe: *"runward — the transmission you can run: forward, and backward."* Lead wedge: **#1 ungoverned production AI agents** (best product-truth fit, board-level pain, no incumbent). #2 (EU AI Act Art. 111) carries the WTP; #3 (M&A) gives the fastest proof. It lives or dies on the anti-overclaim discipline above.
