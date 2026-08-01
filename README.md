# Runward

![Runward — verify the engineering decisions behind AI-written code](https://raw.githubusercontent.com/stranxik/runward/main/assets/og-image-en.jpg)

[<img alt="npm" height="28" src="https://raw.githubusercontent.com/stranxik/runward/main/assets/npm-badge.png">](https://www.npmjs.com/package/runward) [![Docs](https://img.shields.io/badge/Docs-runward.dev-0a0a0a?style=for-the-badge)](https://runward.dev/docs) [![GitHub Marketplace](https://img.shields.io/badge/Marketplace-runward%20gate-2ea44f?style=for-the-badge&logo=github)](https://github.com/marketplace/actions/runward-gate) [![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a?style=for-the-badge)](LICENSE) [![Doctrine: CC BY-ND 4.0](https://img.shields.io/badge/Doctrine-CC%20BY--ND%204.0-C9A45C?style=for-the-badge)](https://github.com/stranxik/designing-and-running-agentic-systems) [![Support via Ko-fi](https://img.shields.io/badge/%E2%98%95%20Support%20via%20Ko--fi-orange?style=for-the-badge)](https://ko-fi.com/stranxik)

**AI writes the code. Runward verifies the engineering decisions behind it.**

Your coding agent (Claude Code, Cursor, Codex…) is great at producing code. The harder question is who checks the decisions that make a system survive *after* the code ships — the architecture, where things run, how it's secured, how it's handed over.

Runward is an open-source delivery methodology for AI-assisted software engineering — a discipline made executable, not a library you import. It doesn't replace your agent; it gives it a way to work through a full engineering mission, from framing to handover, and then **verifies, deterministically**, that the load-bearing decisions were actually made and written down. Same input, same verdict; no prompt can talk it into passing.

The core idea: don't ask an LLM whether the engineering process was followed. Verify it with plain code.

**Try it in one command** — `npx runward init --example` scaffolds a filled reference mission and ends by running the strict gate itself: the whole chain goes green in front of you. The reference floor even ships an intentional failure (a value the model invented) that the deterministic guard refuses — `npm run demo` in `code/` shows the catch. When you want it on your own project, `npx runward init` starts a blank mission. MIT, zero key, zero network by default.

> Spec Kit, OpenSpec and BMAD take you to tested, sometimes merged code. Runward pilots the whole mission — and picks up their output if you use them. What none of them *structures* is the run: governed memory, resilience, execution security, continuous evaluation, transmission.

## Documentation

The full documentation is at **[runward.dev/docs](https://runward.dev/docs)** — written for humans and coding agents alike, with a Markdown twin (`.md`) and a copy-to-clipboard button on every page.

- **[Quickstart](https://runward.dev/docs/getting-started/quickstart/)** — from an empty directory to a green `runward check`.
- **[Concepts: the deterministic gate](https://runward.dev/docs/concepts/the-gate/)** — what the gate verifies, and why it is deterministic and zero-LLM.
- **[The six phases](https://runward.dev/docs/concepts/six-phases/)** — the gated delivery spine, phase by phase.
- **[From an AI agent](https://runward.dev/docs/operating/from-an-agent/)** — how an agent installs and drives runward end to end.
- **[Compliance evidence](https://runward.dev/docs/compliance/evidence/)** — framed for ISO 42001, NIST AI RMF and the EU AI Act, exported as OSCAL.
- **[How it compares](https://runward.dev/docs/compare/)** — Spec Kit, BMAD, Kiro, OpenSpec, Spec Kitty: sourced, from their own docs.
- **[Case study: dropyour](https://runward.dev/docs/case-study/)** — a real product shipped with runward, the trail gate by gate.

## Why

Runward exists to carry an agentic system across the stretch where nearly everything dies today: between the demo and production. Not because the model is weak, but because nobody can evaluate a non-deterministic behavior, govern it, or say in advance when it fails. These are architecture problems, not model problems. The industry's own signal is unambiguous: model vendors now deploy engineers directly into client organizations, because the bottleneck has moved from the model to its integration into the real world.

Spec-driven frameworks answered the first half of that problem: write the right thing. Runward structures the second half: ship it, run it, hand it over.

Agentic systems break four assumptions of classical distributed engineering. The core component is **non-deterministic**: same input, different output, by design. **Input is indistinguishable from instruction**: anything the model reads can try to command it, so prompt injection is structural, not a bug to patch. **Forgetting becomes an engineering problem**: memory that only grows drowns the signal, so decay, invalidation and consolidation have to be designed, not hoped for. And the **blast radius is unprecedented**: an agent with tools acts on the world, so a bad output is no longer just a bad answer.

Runward is the **FDE (Forward Deployed Engineer) method** made executable — the way those embedded engineers deliver, written down and gated. Its guiding principle: the architecture frames the model, never the other way around — the model and the infrastructure are adapter decisions behind stable contracts. That is a fifty-year-old lesson applied to a new unstable component: every time software absorbed one (I/O, frameworks, now models), the answer was a stable contract in front and the unstable part behind — information hiding (Parnas, 1972), ports and adapters (Cockburn, 2005), and now this. The default shape is a modular, hexagonal core — a *default*, not a requirement: the gate checks the decision was confronted and traced, never the style ([when to use Runward](docs/when-to-use.md)). From there, a delivery spine: six gated phases (a gate: a checkpoint you cross on evidence, never on assertion), each with a Definition of Ready and a Definition of Done, a decision matrix, and 64 craft rules — the detail is in the sections below.

## Who it's for — and when

Three profiles, three doors into the same method:

| You are | Where you enter |
|---|---|
| **A tech lead with a working prototype** that must now hold production | The brownfield workflow: characterize the existing system before touching anything |
| **An operator or consultant delivering an agentic system for a client**, especially in a regulated sector | Frame: day one is a conversation with your sponsor, not code |
| **A team finishing a spec** with Spec Kit, OpenSpec or BMAD | Your spec becomes the input of framing; the gates continue from there |

**When NOT to use it.** An already-specified tooling request with no production stakes. Recurring operations — Runward hands over, it does not operate. A pure content or assistant use case, with no tools and no blast radius. And if you want a framework that decides for you: Runward makes *you* decide, at every gate.

**Monday morning.** Install, run `runward init`, and fill `runward/framing.md` with your sponsor — a conversation, not code. Day one produces a framing note and a mission contract. The first code you write is the floor — weeks in, not months.

**The honest timeline** — the one the mission contract states. Framing takes days. An executable floor takes weeks. Iteration is paced by evidence, and handover ends the mission. No dates promised; gates crossed on proof.

The cost is discipline: one accountable operator, governance from day zero, and every structural decision written as an ADR (Architecture Decision Record: a dated, locked decision with a re-evaluation trigger). The longer version — the three entry scenarios told concretely, the anti-cases, what you hold at the end — is in [When to use Runward, and when not to](docs/when-to-use.md).

## Install

```bash
npx runward init --example       # a filled reference mission — see the whole chain green in one command
npx runward init                 # interactive wizard (blank templates for your own mission)
npx runward --yes init           # non-interactive, defaults (CI-friendly)
npx runward init --tools claude,cursor,copilot,gemini,windsurf
```

**Fastest way to see what runward does:** `npx runward init --example` scaffolds the `request-triage` reference mission already filled and ends by running `check --strict` itself — every gate green, in one command. Then `cd code && npm install && npm run demo` runs five requests end to end; one of them (req-005) carries an account reference the model invented, and you watch the deterministic guard refuse to route on it, fail-closed. `runward compliance iso-42001` emits an audit-ready OSCAL pack from the traced decisions. When you're ready, `npx runward init` (no `--example`) starts your own mission from blank templates.

**Install the gate where you already work — honestly tiered by how hard it blocks:**

- **Hard, at merge (CI):** the [GitHub Action](https://github.com/marketplace/actions/runward-gate) — `uses: stranxik/runward@<sha>` as a required status check.
- **Hard, at turn end:** plugins/hooks for Claude Code (`/plugin marketplace add stranxik/runward` → `/plugin install runward-gate@runward`), Gemini CLI, Codex, and Copilot.
- **Soft, per-tool:** Cursor and Kiro (their end-of-turn seam can't hard-block; the per-tool hook can).
- **Discovery only, never a gate:** an MCP descriptor — an MCP tool is model-controlled, so a check behind it is skippable, and a skippable check is not a gate (ADR-0029).

The full per-channel map, with install commands, is [`docs/distribution.md`](docs/distribution.md). The operator installs; none is privileged.

New here? Follow [your first mission in 15 minutes](docs/first-mission.md).

### Commands

| Command | What it does |
|---|---|
| `runward init` | Scaffold the mission structure (wizard: entry mode, stopping tier, tool profiles) |
| `runward check` | **Gate audit**: which deliverable, expected at which phase, is missing, started, or filled — exit code 1 on gaps |
| `runward check --strict` | **Conformance gate**: verifies each phase's rule-conformance manifest — every CRITICAL/HIGH craft rule mapped to the phase is accounted for (applied with evidence, deviated with an ADR, or reasoned `n/a`) — **and verifies the evidence itself**: typed pointers (`file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`, `adr:NNNN`) must resolve to real, non-empty content; a signed rule's evidence must match the rule's `signature:`; a stale pointer (drift) fails the gate. **Deterministic and zero-LLM**: it proves a decision was traced and points at something real, never the code's quality, and cannot be jailbroken by injection — rerun it and get the same verdict |
| `runward check --freeze` | **Seal a green gate**: hashes every resolvable evidence file into `runward/evidence-lock.json` (SHA-256, committed). A sealed file that later changes or disappears fails `check --strict` until you re-verify and re-seal — silent post-merge erosion becomes loud. Refuses to seal a red gate. **Seal what has stopped moving** — a handover, a release, a version entering operation; sealing a deliverable still under active edit makes every expected change loud, which trains you to re-seal without reading ([ADR-0021 amendment](docs/adr/ADR-0021-blocking-drift-and-evidence-sealing.md)) |
| `runward manifest` | **Conformance-table plumbing**: overview of the five gated manifests; `--sync` scaffolds the *form* — missing rows appended with an empty status (the gate refuses them until you decide), renamed rules migrated in place — and never touches the *content*: no status set, no evidence written, no row deleted |
| `runward rules` | **The rule set as data**: the effective set (your mission's copy, else the package's) with impact, phases, OWASP ASI and signatures; `--json` is a stable, versioned machine contract for dashboards, editor extensions and CI annotations |
| `runward explain <rule>` | **The why, inline**: a rule's contract (impact, phases, ASI, signature, rationale) and its full text — no doctrine excavation; renamed slugs answer with their migration |
| `runward status` | Mission snapshot: current gate, decision journal (ADRs), workflows |
| `runward doctor` | Environment and installation checks |
| `runward wire` | **Harness → channel**: detect the AI harness running the command (via a runtime signal, else a config file) and recommend the matching auto-trigger channel. Read-only — it detects and points at the inert sample, it never wires anything; the operator does (ADR-0012). On `undetermined`, the agent asks the operator which tool they use. `--json` for agent consumption |
| `runward update` | Refresh `runward/workflows/` from the package — mission state never touched, local edits preserved unless `--force` |
| `runward characterize` | **Read-only inventory** of an existing codebase (brownfield / retro-documentation) → `runward/characterization.md`: dependencies and lockfiles, entrypoints, CI, tests, git-log shape. Deterministic and zero-LLM; it parses artifacts at rest and never runs, builds, or writes to your code. Facts, not decisions — reconstructing the *why* stays yours |
| `runward compliance <regime>` | **Assemble a regime-framed evidence pack** (`iso-42001`, `nist-ai-rmf`, `eu-ai-act`) from the mission's artifacts → `runward/compliance/…`: a human readiness *draft* (OWASP ASI coverage, rule-conformance status, ADR journal, with the operator-only sections flagged) **and a machine-readable OSCAL** component-definition to feed your GRC/auditor tool. Deterministic, read-only, zero-LLM — supporting evidence, never a compliance claim. The regime mapping is **versioned data** (`--regime-version` pins the lens; the pack stamps which version produced it). The mapping itself is a published, citable mini-spec: [docs/spec/runward-oscal-mapping.md](docs/spec/runward-oscal-mapping.md) |

Global flags: `--yes`, `--dry-run`, `--verbose`, `--no-color`. Exit codes: 0 success, 1 gaps/warnings, 2 missing prerequisite.

The gate's exit code is a **port**: `runward/adapters/` ships inert sample wiring so the gate runs at each harness's natural moment.

**Install runward from where you already work.** Beyond the copy-in adapters, runward publishes distributable packagings across every channel that can carry a real gate — see the install block above and the full map in [`docs/distribution.md`](docs/distribution.md). The git `pre-commit` and CI adapters are **agent-agnostic** — they gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is one example of a per-harness turn-end hook, not a privileged one. You copy an adapter in; runward never installs or runs one for you.

`init` creates:

```
your-project/
├── AGENTS.md                    # vendor-neutral agent charter (the "law" file)
├── runward/
│   ├── framing.md               # problem, value, observable success criterion, floor vs target
│   ├── mission-contract.md      # one-page steering contract: engagements, DoD, gates
│   ├── architecture.md          # boundaries, ports, integration protocol — stack stays open
│   ├── execution-topology.md    # per-port placement: location family, data class, sovereignty (gated)
│   ├── decision-matrix.md       # 22 arbitrations: one sober default + one explicit trigger each
│   ├── reference-stack.md       # default adapter kit per layer, with evolution triggers
│   ├── shared-bricks.md         # bricks beyond the app: placement families, brick matrix, sovereignty by data class
│   ├── floor.md                 # the smallest system that proves value on real traffic
│   ├── handover.md              # the succession, proven: kit index, redone-task proof, named owner
│   ├── adr/                     # one ADR per structural decision, with re-evaluation trigger
│   ├── rules/                   # 64 craft rules your agent applies while building
│   ├── governance/
│   │   ├── threat-model.md      # lethal trifecta, 2-of-3 rule on the context window
│   │   ├── evaluation-rubric.md # test the deterministic, evaluate the non-deterministic
│   │   └── observability-schema.md
│   ├── contracts/               # port contracts (versioned, additive, tolerant reader)
│   ├── runbook.md               # recovery runbook for the team that inherits the system
│   ├── adapters/                # inert samples that run the gate at each harness seam (git, GitHub/GitLab CI, Claude Code, Kiro, BMAD)
│   └── workflows/               # the method, executable by your agent
└── .claude/ | .cursor/          # tool profiles (--tools)
```

## The method: six phases, gated

Each phase has entry conditions (Definition of Ready) and a Definition of Done. You do not move on assertion; you move on evidence.

| Phase | Output | Done when |
|---|---|---|
| 1. Frame | `framing.md` | Sponsor validates the observable success criterion and the floor scope |
| 2. Architect | `architecture.md` + ADRs | Boundaries decided, stack still open |
| 3. Ship the floor | Running system + `floor.md` | First measured proof against the criterion, on real cases |
| 4. Iterate on evidence | Increments + ADRs | Every addition traced to an objective trigger |
| 5. Govern & evaluate | Threat model, rubric, observability | Instrumented from day zero, never retrofitted |
| 6. Hand over | Handover kit | The team redoes a task autonomously — demonstrated, not declared |

Phase 5 is transverse: it starts at day zero, not after the incident.

## What makes it different

Four things, and a code-level competitive check (July 2026) confirmed no other scaffold pairs them: a **rule-level gate with verified, sealed evidence**, a **gated hand-over**, and a **published, deterministic OSCAL mapping**. Each exists somewhere in isolation; the combination is runward's ground. The rest of this section is those four and the invariants under them.

- **The gate you own — deterministic and zero-LLM.** `runward check --strict` is a non-probabilistic, operator-owned exit-code gate: it cannot be jailbroken by injection (no model in the gate path) and reruns byte-for-byte. Every competitor's *code* check is judged by the model; this one does not depend on an LLM to pass. (Two 2026 signals back the stance: FedRAMP RFC-0024 forbids GenAI-produced factual evidence, and the Delve affair showed why AI-produced audit evidence is not trusted.)
- **The gate verifies the evidence, not just the row.** A pointer must resolve to real, non-empty content; a symbol or test name must actually be there; a rule can declare the shape its evidence must contain (`signature:` — the founding cited-not-applied incident is now caught deterministically); a stale pointer fails the gate; a sealed gate (`--freeze`) makes later erosion loud. Still bytes, never judgment — and never a model.
- **runward gates itself.** This repository carries its own `runward/` mission, and CI requires `runward check --strict` green on runward's own code — including under network isolation. The same stance runs the release: publishing to npm is a deliberate human gesture (creating the Release), and everything downstream is deterministic machinery — OIDC trusted publishing with no long-lived token, SLSA provenance, an attested CycloneDX SBOM. The deterministic executes; the human decides the crossing. The discipline is demonstrated, not claimed.
- **Audit-ready evidence, in a published format.** Craft rules carry an OWASP ASI (Top 10 for Agentic Applications) mapping — a universal, region-agnostic security posture — so the conformance manifest reads as supporting evidence and exports as a machine-readable OSCAL pack. The decision → ADR → manifest → OSCAL chain is a **versioned, citable mini-spec** ([`docs/spec/runward-oscal-mapping.md`](docs/spec/runward-oscal-mapping.md)) anyone can reproduce or critique — the reference implementation of gate-level agentic-delivery evidence, not a black box. Security-only by default; it maps to your regime when you need one — ISO/IEC 42001 (global), NIST AI RMF (US), or the EU AI Act technical documentation (art. 11 / Annex IV) (EU) — see [`docs/compliance/`](docs/compliance/). An input to that work — never a conformity assessment, never a claim to certify. For a regulated procurement / TPRM review — what applies, what is moot because runward is **local with no data flow**, the supply-chain evidence (OIDC provenance + an attested CycloneDX **SBOM** on every release), the OpenSSF OSPS Baseline alignment, the licence framing and the honest limits — see [`docs/compliance/regulated-adoption.md`](docs/compliance/regulated-adoption.md) ([ADR-0031](docs/adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)).
- **Never a runtime.** Runward writes nothing into `.git/`, installs nothing, and runs nothing of yours — it frames, gates and hands off. Your runtime and model are swappable adapters behind a port; the thing you depend on is never Runward.
- **Floor, not MVP deck.** The floor is the smallest *running* system that proves value on real traffic. A presentation is not a floor.
- **Evolution on evidence.** Multi-agent, long-term memory, microservices, a bigger model: each has a sober default and an explicit trigger. No trigger, no complexity. Every switch is an ADR.
- **Security by architecture, not detection.** Prompt injection is constrained structurally (lethal trifecta, 2-of-3 rule), not filtered heuristically.
- **Craft rules, not vibes.** 64 engineering craft rules ship with the mission (memory scoring, tiered retrieval, event sourcing, request-id propagation, multi-provider fallback, cost routing, post-turn pipelines, prompt-injection defenses…) — your agent applies them, `runward check` will not invent them. Code examples follow the reference-stack default (a single language in the core — TypeScript by default, an adapter decision like any other: see the decision matrix). The patterns are the contract; the language is the adapter.
- **One accountable operator, not a simulated team.** One human owns every gate while the agent executes the workflows — see [the operator role](docs/operator-role.md).
- **Hand-over gated on proof, not a folder.** The mission ends when the receiving team redoes a real task without you — and that succession is a gated deliverable (`handover.md`, four handover rules), verified like every other phase. Only one other scaffold (Spec Kitty) carries the mission past tested code — and its acceptance verdict is an AI review; runward's succession check is plain code, and its evidence exports as standardized OSCAL, not bespoke YAML.

## The reference floor

`floor-ts/` is a clonable scaffold that implements the Runward defaults: hexagonal core, the model behind a port (a port: a stable contract behind which implementations swap — here a deterministic echo adapter by default, zero keys, zero network), provider profiles keyed on base URL, middleware chain (logging, access, cost cap, approval), day-zero cost ceiling, secrets redaction, per-call prompt provenance (a SHA-256 of every prompt), suspend-and-rehydrate on human approval, full test pyramid and an evaluation harness. It is expressed in TypeScript because it implements the reference-stack defaults — one language in the core, and which one is an adapter decision like any other. The durable part is what it demonstrates: the ports, the contracts, the middleware chain, the deterministic guard. Port them to your language and the architecture survives. Its README maps each principle to the exact file that implements it. Start a floor by cloning it, not from a blank page.

## Relationship to the canon

Runward is the tooling of the doctrine **“Designing and Running Agentic Systems”** (Thibault Souris, 2026) — a 60-page architecture reference, published separately under CC BY-ND 4.0 in [its own repository](https://github.com/stranxik/designing-and-running-agentic-systems). The doctrine is the canon: read it for the *why*. Runward is MIT: fork it, adapt it, contribute. See [NOTICE.md](NOTICE.md).

Read the doctrine: [Concevoir et exécuter des systèmes agentiques (FR)](https://github.com/stranxik/designing-and-running-agentic-systems/blob/main/Concevoir-et-executer-des-systemes-agentiques-2026.pdf) · [Designing and Running Agentic Systems (EN)](https://github.com/stranxik/designing-and-running-agentic-systems/blob/main/Designing-and-Running-Agentic-Systems-2026.pdf)

## Supported tools

Two vendor-neutral files are **always written**, so the method works on any agent with no profile at all: `AGENTS.md` (the standard charter read by Codex, Cursor, Copilot, Windsurf, Cline, Zed, Amp, opencode, Junie, Warp and more), and the **phase skills** at `.agents/skills/runward-<phase>/SKILL.md` — the converged `SKILL.md` seam read by 14+ harnesses, which surface each build phase's craft rules *by relevance* at the point of action (subordinate to the gate: a skill loaded but not applied still fails `check --strict`).

Tool profiles (`--tools`) add harness-specific wiring on top: **Claude Code** (`/rw-*` commands + `.claude/skills/`), **Cursor**, **GitHub Copilot**, **Gemini CLI**, **Windsurf** (charter files), **Continue.dev** (`.continue/rules/`), **JetBrains Junie** and **Trae** (`.<harness>/skills/`), and **Kiro** (`.kiro/steering/`, relevance-loaded). The mission structure itself is plain markdown in your repo. More profiles welcome (see [ROADMAP.md](ROADMAP.md)).

## License

MIT © Thibault Souris. The doctrine text is licensed separately (CC BY-ND 4.0) and is **not** included in this repository.
