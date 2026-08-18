# runward — positioning & messaging (source of truth)

Internal reference for all runward copy (site, README, release notes, ADRs, decks). Keep claims here defensible; when in doubt, downgrade the claim.

> The *verifiable* claims here — the MANDATORY compliance guardrails, the current regulatory dates, the framework/never-platform and never-overclaim rules, the cited ADRs — are enforced in CI by `test/unit/positioning-drift.test.js`. Dilute a guardrail, let a date go stale, assert a forbidden overclaim instead of negating it, or cite a missing ADR, and the gate reddens. Subjective wording stays free; the load-bearing claims cannot drift.

## Thesis (the wedge)

Spec-driven development automated the *easy* part — authoring intent. It left the part where ~95% of enterprise GenAI projects die — **shipping, governing, running** — without an owner. runward plants its flag there, on the FDE (Forward Deployed Engineer) method.

## The survival thesis (locked — ADR-0052 decision 1, folded verbatim)

Why a delivery verdict cannot live inside the harness that produced the code. Adopted word for word;
`positioning-drift.test.js` reddens CI if it is diluted or paraphrased, because a thesis that can be
softened under commercial pressure is not a thesis.

> A harness-native gate governs actions, at runtime, inside a session, under the signature of the
> agent's vendor. A delivery verdict needs three properties no harness can hold for its own agent.
> Independence: a verdict is opposable only when the judged party does not manufacture the judge;
> conformity regimes write that principle into law ('notified bodies shall be independent of the
> provider … in relation to which they perform conformity assessment activities', Regulation (EU)
> 2024/1689, art. 31(4)) — cited as a principle, not a status: runward is not a notified body and
> performs no conformity assessment. Survival: an audit happens months after the session, on the
> repository alone, re-run byte for byte, possibly after the agent has been replaced; a verdict
> that lives in the harness dies with it. Agent-agnosticism: the same gate must judge whatever
> agent produced the code, including a competitor's. runward holds the three by construction —
> local, MIT, zero LLM in the verdict path, living in the repository it judges, owned by the
> operator who answers for the system. What this does not claim: that a harness vendor cannot build
> a phase-gate. It claims that a vendor's phase-gate over its own agent's work is the auditor
> auditing its own books — and that shipping cannot fix that.

The article 31(4) citation was verified verbatim against the primary source on 2026-08-12
(eur-lex.europa.eu/eli/reg/2024/1689/oj) and is cited **as a principle, not a status**: runward is
not a notified body and performs no conformity assessment. The negating form of the closing sentence
is deliberate, not stylistic — it states what the thesis does NOT claim, which is the only shape in
which a claim this strong is honest.

## Category

- Descriptor (safe, primary): **agentic-delivery framework**.
- Brand signature (distinctive, to install over time): **run-grade engineering**.
- Always say **framework / method**, **never "platform"** — it protects the "never a runtime" belief and the crowded-runtime space we refuse.
- Tether to spec-driven as the "before": *bring your spec; runward owns everything downstream.*

## Positioning statement

For engineers and engineering leaders who must put agentic systems into production and keep them alive, runward is the **agentic-delivery framework** that governs, ships, runs and hands off the system on the FDE method — a deterministic gate you own, evolution only on evidence, zero vendor lock-in. Unlike spec-driven tools, which end at "generate the code," runward owns the hard part: the run.

## The differentiator, in one line (say this when there is time for one sentence)

**runward turns a delivery into a verdict you can re-check: deterministic, attested, and re-derivable
offline months later — on the repo alone.**

Unpacked, in the order a skeptic asks:
- **deterministic** — same working tree, same verdict; no model in the path, so no prompt can move it;
- **linked, not judged** — the verdict says every load-bearing decision is traced to evidence that
  resolves (a file, a symbol, a green test case, a scan with no open finding), never that the code is
  good. That boundary is the product, not a limitation to apologise for;
- **attested** — the verdict emits as an in-toto Statement, and as a SLSA VSA a policy engine admits
  on without learning our vocabulary;
- **re-derivable offline** — `runward verify` re-computes it from the tree alone, with no network, no
  trust root and no key. That is what makes it opposable: a claim anyone can re-check is a claim we
  cannot quietly walk back.

If only one clause survives the skim, it is the last one. Everyone claims a gate; almost nobody can
hand you a verdict you re-derive yourself, months later, on a laptop with the wifi off.

## Construction stage, not release stage (say this before anyone asks "isn't that Kosli?")

Kosli, JFrog AppTrust, Chainloop and the SLSA toolchain govern a **published artifact**: its
provenance, its custody, its promotion between environments. runward governs the **working tree
before the merge**: were the decisions made, traced and evidenced. Different stage, different object,
different moment.

So the honest sentence is *"runward's verdict is an input to your release gate"*, never *"instead
of"*: the verdict pushes into their gates as external evidence, and the recipes are published
([interop.md](interop.md)). A prospect who hears "we already have Kosli" has not raised an objection;
they have named the layer runward sits **under**. The failure mode to avoid is letting runward be
filed as a poor man's release gate — which is what happens when the stage distinction is left implicit.

## Tagline

- Primary: **"After the spec, the hard part starts. runward ships it and runs it."**
- Belief line (for CTOs): "The model is an adapter. The discipline is the product."

## Six messaging pillars (claim + proof)

1. **The gate is aimed at the decision, at delivery.** The exit-code gate verifies a *traced decision* — was the architecture / topology / governance choice made, recorded and ratified — **not** an action (that is a runtime policy engine) and **not** an output (that is a test). And it spans the *whole delivery arc* — six gates, from framing (before a line of code) through the floor and governance to handover (after production) — **never at runtime**. Deterministic, zero-LLM and non-jailbreakable is *how* the decision-gate stays honest (a model cannot talk it into passing), not *why* runward exists. The operator owns it, rerunnable byte-for-byte. The field survey "Code as Agent Harness" (arXiv 2605.18747, §4) names this missing layer **"executable accountability"** — "a safety layer that filters, vetoes, escalates, and records agent actions before they reach the real world"; borrow the term only with its distinguo: the survey's layer records runtime *actions*, runward's gate is executable accountability for *decisions at delivery* — it verifies and records what was decided and ratified, never what an agent did at runtime (that is the runtime policy engine runward refuses to be). *Demo it, don't describe it.* (See [[positioning-note-object-moment-lineage]].)
2. **Governed from day zero.** Threat model, eval rubric, observability schema, cost cap wired on the first commit — against the post-deployment gap.
3. **No lock-in.** Model and runtime are swappable adapters behind a port; agent-agnostic (AGENTS.md); MCP/OTel/A2A pinned as versioned ports.
4. **Evolution on evidence + transmission.** Complexity added only on a trigger, every change an ADR, the team runs it without you. What the same survey calls a **"change contract"** — every harness edit carrying its target, its invariants, "which evaluation can falsify it, and how it can be rolled back" (arXiv 2605.18747, §4) — is this discipline already in place: every runward ADR carries a mandatory dated reevaluation trigger (the falsification condition), and rule renames/removals ship as tracked migration records — reason, version, guided path — never silent rewrites (ADR-0006).
5. **Both visions, one gated path (ADR-0017).** The application domain *and* the execution topology — where each port's adapter runs, under which sovereignty — are traced and gated behind the same ports. runward governs the placement decision (location family, data class, sovereignty, usage registry); it deploys nothing. "Never a runtime" does not mean "ignore topology": the topology decision is a decision, and a traced decision is what the gate verifies.
6. **Evidence derived from the decision journal.** The OSCAL / readiness draft is a byproduct of the mission's own artifacts — the *decision → ADR → conformance manifest → OSCAL* chain, with SHA-256-deterministic UUIDs. Every ASI control traces back to a ratified engineering decision, not a catalogue entry, so the evidence cannot drift from what was actually built and decided. The moat is that chain, not "we emit OSCAL" (anyone can template OSCAL). Keep the compliance guardrails below: audit-*ready*, feeds/supports, never "compliant".

## Compliance guardrails (MANDATORY — never overclaim)

The OWASP ASI / EU AI Act angle is an asset **only** if we do not overclaim. Verified with primary sources (2026-07-09).

- Use **"audit-ready evidence"** / **"supporting evidence"** — NOT "audit-grade" (which implies guaranteed auditor acceptance; acceptance is the auditor's call).
- The manifest **feeds / supports** an ISO/IEC 42001 programme and the EU AI Act technical documentation (art. 11 / Annex IV). It does **not** "satisfy" art. 12 (that needs runtime logs) and is **not** a conformity assessment.
- **Never** say: "compliant", "certified", "ISO 42001 certified", "EU AI Act compliant". A framework cannot confer compliance or certification.
- EU AI Act: high-risk (Annex III/IV) obligations were postponed by Regulation (EU) 2026/1744 of 8 July 2026 (OJ L, 2026/1744, 24.7.2026) to **2 December 2027** (Annex III) and **2 August 2028** (Annex I) — do NOT market an "August 2026 high-risk deadline" (stale). The 2 August 2026 milestone still applies to Article 50 transparency, governance and GPAI enforcement. Do NOT say "the AI Act starts in 2026" (prohibitions since Feb 2025, GPAI since Aug 2025). Three current, durable talking points instead: FedRAMP RFC-0024 states that GenAI outputs "do not constitute a factual record of the system state and must not be used to generate deterministic telemetry" (verified verbatim, in the RFC's Definitions — a federal validation of the deterministic, zero-LLM gate), the Delve affair (AI-prefilled SOC 2 audits) shows why AI-produced evidence is not trusted, and the academic pendant: the field survey "Code as Agent Harness" (arXiv 2605.18747) calls verification beyond unit tests "largely unsolved", citing the empirical study *Are "solved issues" in SWE-bench really solved correctly?* (arXiv 2503.15223) for its oracle-adequacy crisis — agent-declared resolutions are not reliable without independent re-verification — alongside failure-attribution studies whose best step-level accuracies sit at only 14–53%; its remedy vocabulary is the gate's premise: "objective oracle signals, signals that cannot hallucinate" (§3.4).
- **Never quote "signals that cannot hallucinate" without its counterpoint.** The very same §3.4 passage goes on to recommend LLM-simulated execution as a "fast path" (98%+ claimed precision), keeping execution as the verification oracle "only for the failure modes that require it" — an economy runward refuses in the verdict path (ADR-0001, ADR-0007: "no LLM sits anywhere in the gate path"). The scopes differ — the survey's fast path optimizes a runtime repair loop, runward's gate rules the delivery verdict — but quoting the oracle sentence alone is cherry-picking; the honest citation includes the contrast.
- OWASP Top 10 for Agentic Applications (ASI01–ASI10, published 2025-12-09) is a voluntary security taxonomy, not law. Cite as an engineering-risk reference.
- **Regional profile, not EU-first (ADR-0015).** The OWASP ASI mapping is the *universal* core; the named regulation is a *regional lens*. Default to **security-only** (an ASI posture, no regulatory claim). Lead with the universal for a global audience, then map to the buyer's regime: **ISO/IEC 42001** (global anchor), **NIST AI RMF** (US), **EU AI Act** (EU). Never lead with "EU AI Act art. 13" for a US/APAC buyer — post-2025 US deregulation makes it read as foreign. See `docs/compliance/`.

## Vendor neutrality (see [[vendor-neutral-never-privilege-an-agent]])

Never privilege one agent/harness. Lead with the agent-agnostic seams (git pre-commit, CI) that gate whatever agent produced the code; any per-harness hook (e.g. Claude Code `Stop`) is "one example, not privileged."

## Competitive battlecard (2026)

Where runward wins vs Spec Kit / OpenSpec / BMAD / Spec Kitty:
- **Object × moment × lineage** — runward gates a *traced decision* (not an action, not an output), across the *whole delivery arc* from framing to handover (not runtime, not test time), and derives audit-ready evidence from a *ratified ADR journal*. Deterministic zero-LLM alone no longer discriminates (the Microsoft Agent Governance Toolkit and runtime policy engines like Cedar/OPA have it too); the durable distinction is that intersection, which no competitor holds together. See [[positioning-note-object-moment-lineage]].
- **Compliance/audit angle** — a wedge, not the arena (competitors are delivery frameworks, never GRC). No delivery framework occupies it.
- **"After the spec"** — competitors stop at Implement.
- **Runnable reference floor** (`floor-ts/`) — others ship scaffolding/orchestration, not a correctness floor.
- **A verdict that leaves the machine** (0.35.0) — attested in-toto, re-derivable offline by anyone,
  emitted as SARIF for the PR and as a SLSA VSA for a policy engine. The spec-driven tools produce an
  advisory opinion from a model; none produces an artifact a stranger re-checks without them. This is
  the clause that survives a skim, and it is the one to lead with in 2026.

Watch (2026-08, from the pre-announcement audit): a **message-adjacent entrant** now claims the same
invariant almost word for word — deterministic, local, replayable attestation — with a paid cloud tier
and an anonymous publisher. Named, with its URL and what it does and does not have, in the audit of
2026-08-14 rather than here: the response is passive differentiation (public identity, a traced ADR
journal, MIT, a method that spans the whole arc rather than one merge), not a call-out. Re-check at
the next groom; if it gains real distribution, the runward story becomes "the second one", and that
is a positioning problem, not a product one.

Honest gaps against the RELEASE layer (do not deny, and keep out of the technical docs — this is
positioning material, and it ages on a different clock than a mechanism): Kosli, JFrog AppTrust and
Chainloop have reference customers in regulated industries, sales teams, hosted evidence stores,
partner ecosystems and years of operation. runward has none of that. When the need is custody of
published artifacts at group scale, that is where the buyer should go, and saying so costs nothing —
runward is not competing for that budget line. What runward has and none of them claims: a verdict
about construction decisions that anyone re-derives alone, on the repository, with no account and no
network.

Honest gaps (do not deny): traction (Spec Kit ~90–119k★ + GitHub brand + 70+ extensions; OpenSpec/BMAD ~50k; Spec Kitty ~1.4k), ecosystem breadth, docs maturity, and Spec Kitty already owns the "governed factory" language. Our edge is harder to say in one line — lead with the failure mode (95% fail at the *run*, not the spec).

## Tone

Sound like a staff engineer paged at 3am, not a vendor at a booth. Concrete nouns (gate, port, ADR, trigger, runbook), verbs over adjectives, numbers over enthusiasm. Confident about the method, humble about the stack. Teach, don't sell.
