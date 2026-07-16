# Your first mission in 15 minutes

This tutorial takes you from a clean machine to a Runward mission with its first gate passed. You will install the CLI from source, scaffold a mission, fill the two framing deliverables on a small provided case, and watch the gate audit go from gaps to a crossed gate. No API key, no network calls beyond `git clone` and `npm install`.

You need **Node.js 20+** and **git**.

## 1. Install from source

```bash
git clone https://github.com/stranxik/runward.git
cd runward
npm install
npm run build
```

Verify the build:

```bash
node dist/cli.js --version
```

You should see the version number (e.g. `0.6.0`). Keep this clone where it is — you will call `dist/cli.js` from your project.

## 2. Scaffold a mission

The case for this tutorial: a procurement team answers about forty recurring supplier emails a week (payment status, onboarding, portal access) by hand, roughly fifteen minutes each. You will frame a system that drafts replies from a validated FAQ, with a human reviewing and sending.

Create a project next to the clone and run the wizard:

```bash
mkdir ../supplier-faq && cd ../supplier-faq
node ../runward/dist/cli.js init
```

Answer the five prompts:

| Prompt | Answer |
|---|---|
| `Project directory` | press Enter (`.`) |
| `What are you building?` | **Answer recurring supplier questions from a knowledge base** (one line — it seeds your framing note) |
| `Tool profiles (AGENTS.md is always written)` | keep **Claude Code** checked, press Enter (pick others if you use them) |
| `Entry mode` | **Greenfield** |
| `Stopping tier (the sponsor's choice — can be revised)` | **Executable floor, proven on real traffic** |

You should see the sections `Mission structure`, `Workflows`, `Craft rules`, `Agent charter`, then:

```
Done
✓ 119 file(s) written, 0 skipped

Next steps
  1. Fill runward/framing.md — do not architect before the framing gate passes.
  2. Point your agent at AGENTS.md and runward/workflows/method.md.
  3. Run runward check anytime to see which gate you are at.
```

(The exact file count varies with the tool profiles you picked.)

## 3. See the gap

```bash
node ../runward/dist/cli.js check
```

You should see every phase with its deliverables, almost all of them raw templates:

```
1 · Frame
  ◐ Framing note (runward/framing.md) — placeholders remain
  ○ Steering contract (runward/mission-contract.md) — raw template

2 · Architect
  ○ Architecture note (runward/architecture.md) — raw template
  ...

Summary
  Current gate  1 · Frame
  ADRs          0  — no structural decision locked yet

! 13 deliverable(s) not filled. No phase closes without its artifact — and, under --strict, without its CRITICAL/HIGH rules accounted for.
```

Confirm the exit code — `runward check` is CI-friendly and exits 1 on gaps:

```bash
echo $?
```

You should see `1`. This is the point of the tool: the gap between what the phase expects and what exists is always one command away.

## 4. Fill the framing note

Open `runward/framing.md`. It is the template with two fields pre-filled by the wizard (entry mode, stopping tier) and bracketed placeholders everywhere else. Replace its entire content with the filled version below — in a real mission this is the output of the `frame` workflow with your sponsor; today the case is provided.

```markdown
# Framing Note: Supplier FAQ desk

**Date**: 2026-07-03 · **Sponsor**: Head of Procurement · **Entry mode**: greenfield · **Stopping tier**: floor

## 1. Problem

The procurement team receives ~40 supplier emails per week asking recurring questions: payment status, onboarding steps, portal access. Two buyers answer them by hand, ~15 minutes each, interrupting higher-value work. Answers drift between buyers because there is no single validated source.

## 2. Value

Roughly 10 hours per week of buyer time recovered, and consistent answers from one validated FAQ. Beneficiaries: the two buyers (daily) and suppliers (faster, uniform replies).

## 3. Observable success criterion

Over two weeks on real traffic: at least 60% of drafted replies are sent by the buyer with no or minor edits, measured by comparing the draft to the sent email.

## 4. Floor

One orchestrator; a model port with a default tier; a validated FAQ of ~30 entries as the only knowledge source; a deterministic guard that blocks any draft citing a payment amount or date not present in the source record; a review step where the buyer edits and sends — the system never sends; baseline observability (structured logs, request id, per-call metrics, cost ceiling).

## 5. Target (named, not built)

Retrieval over the full supplier knowledge base, long-term memory of per-supplier context, direct integration with the ticketing tool, multi-language replies. Named to give direction only.

## 6. Named deferrals

| Deferred capability | Lean default in place | Trigger to revisit |
|---|---|---|
| Long-term memory | per-email context only | measured need for cross-thread supplier continuity |
| Ticketing integration | copy-paste into the mail client | draft volume makes manual transfer the bottleneck |
| Multi-agent | single orchestrator | genuinely parallelizable subtasks appear |

## 7. Hard constraints

Supplier data stays inside the organization's environment; no draft is sent without human review; payment figures must come from the source record, never from the model.

## 8. Presumed boundaries

Ports foreseen: email intake, FAQ retrieval, model, draft delivery. Language and topology explicitly left open — adapter decisions for the architect phase.

## 9. Definition of Ready check

| Condition | Status | If missing: named risk |
|---|---|---|
| Real problem, identified sponsor | met | — |
| Observable success criterion | met | — |
| Floor-first principle accepted | met | — |
| Access to the real process and people | met | — |
| Usable data or a path to it | met | — |
| Access to technical infrastructure | risk | sandbox only for now — sponsor owns the risk |
| Hard constraints known | met | — |
| Human available to decide and approve | met | — |
```

Run the audit again:

```bash
node ../runward/dist/cli.js check
```

You should see the first line flip:

```
1 · Frame
  ✓ Framing note (runward/framing.md)
  ○ Steering contract (runward/mission-contract.md) — raw template
```

Still exit code 1 — one framing deliverable remains.

## 5. Fill the mission contract

Open `runward/mission-contract.md`. Keep the *Principle*, *Engagements*, *Acceptance* and *Roadmap* sections as they are — they are the standing contract text. Replace the header line and the final *to fill with the sponsor* table:

```markdown
**Date**: 2026-07-03 · **Sponsor**: Head of Procurement · **Operator(s)**: you · **Indicative horizon**: framing this week, floor in three weeks
```

```markdown
| Field | To fill in |
|---|---|
| **Problem** | ~40 recurring supplier emails/week answered by hand, ~15 min each, answers drifting between buyers |
| **Success criterion** | ≥60% of drafts sent with no or minor edits, over two weeks on real traffic |
| **Floor** | Draft-only FAQ answerer with deterministic guard on figures and human send |
| **Target** | Full knowledge-base retrieval, supplier memory, ticketing integration — named, not built |
| **Engagements retained** | flash framing + executable floor |
| **Milestones & gates** | framing gate this week; floor gate at week 3, passes on the measured criterion |
| **Deliverables & DoD** | framing note validated by sponsor; floor measured against the criterion on real traffic |
| **Hard constraints** | data stays internal; human review before send; figures from source records only |
| **Risks owned by the sponsor** | infrastructure access is sandbox-only for now |
```

Also delete the `> **Usage.**` notice at the top — templates carry it, deliverables do not. Then:

```bash
node ../runward/dist/cli.js check
```

You should see Phase 1 fully green and the gate move:

```
1 · Frame
  ✓ Framing note (runward/framing.md)
  ✓ Steering contract (runward/mission-contract.md)

Summary
  Current gate  2 · Architect
```

The framing gate is passed — on filled artifacts, which the audit verifies; in a real mission the sponsor's validation of the criterion is what lets you claim it.

## 6. Point your agent at the method

The rest of the mission is executed by your agent, under your gates. Open the project in your agent (Claude Code, Cursor, Copilot, Gemini CLI, Windsurf — anything that reads `AGENTS.md`) and tell it:

```
Read AGENTS.md and runward/workflows/method.md, then run the architect
workflow for this mission. Do not cross any gate on your own assertion.
```

The charter (`AGENTS.md`) binds it to the boundaries; `runward/workflows/method.md` chains the phases; the craft rules in `runward/rules/` apply while it builds. You own every gate; `runward check` tells you where the mission stands at any moment.

## Where to go next

- **A mission filled end to end**: [`examples/request-triage/`](../examples/request-triage/) — every deliverable completed, with a runnable floor in `code/`. `runward check -p examples/request-triage` exits 0.
- **Start your floor from the reference**: [`floor-ts/`](../floor-ts/) — a clonable scaffold implementing the reference-stack defaults (zero keys, zero network by default). Clone it instead of starting phase 3 from a blank page.
- **Your role in all this**: [the operator role](operator-role.md) — one accountable human, the agent executes under their gates.
- **Before adding anything**: `runward/decision-matrix.md` — 22 arbitrations, each a sober default and an explicit trigger. No trigger, no complexity.
