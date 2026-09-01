# ADR-0064 — The verdict gets a report an auditor reads alone

**Date**: 2026-09-01
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured against what runward emits today, and against what the category emits, sourced

## Context

runward's artifacts target a regulated reader. Its ergonomics target an engineer. That gap is the
subject here, and it is not a polish problem.

**What runward emits today, and who it is for.** `check --sarif` renders into a forge's security
view. `compliance <regime>` writes three readiness drafts — ISO 42001, NIST AI RMF, EU AI Act — plus
an OSCAL component definition. `check --attest` and `bundle` produce in-toto statements. Every one of
those is a **compliance** surface. But runward does not only judge compliance: it judges DELIVERY —
which phases were crossed, which decisions were traced to resolving evidence, what is deferred and
why, what the gate deliberately does not cover. That verdict has no reader-facing form at all. It
exists as a terminal rendering for whoever ran the command, and as `--json` for whoever writes code
against it.

So the person who most needs the verdict — an assessor arriving months later, on the repository
alone — is the one person the product currently asks to open a terminal.

**What the category emits.** Measured 2026-09-01 against a comparative analysis of the three
spec-driven frameworks runward is positioned beside: *"None of these frameworks are described as
producing auditor-ready compliance reports, shipping verdicts, or governance dashboards."* Spec Kit
enforces human approval at phase gates and produces a constitution, specs, plans and tasks. OpenSpec
produces a change archive and claims traceability by design through its proposal → spec delta → task
→ code chain — which is a HISTORY, not a verdict. BMAD produces role-specific documents for a product
owner to read. None produces an object addressed to a reader who was not in the session.

**Is that immaturity?** Partly, and it would be lazy to stop there. The category is roughly a year
old, and features arrive. But the deeper reason is an ORIENTATION: these tools optimise for the
agent's next step, and their natural output is whatever the agent consumes next. A report for an
assessor has a different addressee and a different lifetime — it must survive the session, the
agent, and the tool. Maturity adds features to a design; it does not hand a tool an addressee it was
never pointed at. That orientation is precisely what the survival thesis (ADR-0052) says a
harness-native gate cannot hold, and it applies to the reporting surface as much as to the verdict.

**What the refusals actually forbid.** ADR-0054's five crossings constrain the VERDICT PATH: no
network endpoint SERVING rules or verdicts, no long-lived process BETWEEN invocations, no key or
state the operator does not hold, no reading beyond the tree judged, no network or LLM IN THE VERDICT
PATH. None of them forbids the CLI from EMITTING a rendered artifact. A generated file is a build
output, like the SARIF and the OSCAL already are — local, deterministic, owned by the operator,
surviving the tool that made it. Reading the refusals as a ban on any interface is a misreading, and
it has cost the product a reader.

## Decision

**Proposed**: `runward report` emits ONE self-contained file that an assessor opens without a
terminal, without an account, and without runward installed — addressed to the auditor, not to the
CTO and not to the agent.

Self-contained is the load-bearing word: no external stylesheet, no script fetching anything, no
link that must resolve for the document to be readable. It is committed, attached to a release, or
emailed, and it says the same thing in five years as it does today. It is generated FROM the verdict
and the artifacts the mission already holds — it computes nothing new, so it cannot disagree with
`check`.

What it must answer, because that is what an assessment asks:

1. **Where is this mission** — which phases are crossed, which is current, what blocks the next.
2. **What is proven, and by what** — each gated claim with the evidence it resolves to, by path.
3. **What is deferred, and why** — the declared horizon, stated as a floor and not as a ceiling.
4. **What the gate does not cover** — `GATE_NON_SCOPE`, verbatim, where a reader cannot miss it.
5. **How to re-derive this alone** — the command, the attestation, the fact that it needs no account.

## Alternatives discarded

- **A hosted dashboard.** Refused by construction, not by priority: it recreates the dependency the
  survival thesis exists to remove — a verdict that dies with the service that showed it. ADR-0054
  crossings 1 and 2.
- **More forge connectors instead of a report.** Worth doing and not a substitute. GitLab does ingest
  SARIF (`artifacts:reports:sarif`, with direct upload being made first-class), so the forge surface
  is wider than GitHub already. But a forge view shows FINDINGS; it does not show a delivery verdict,
  and it lives in the forge rather than in the repository. A separate decision, not this one.
- **Extending the readiness drafts.** They are addressed to a regime and shaped by it. Folding a
  delivery verdict into a regime pack would make the verdict look like a compliance claim, which is
  exactly the conflation this ADR exists to undo.
- **A cross-repository portfolio view.** Genuinely useful and genuinely a different product: a
  portfolio cannot be a per-repository artifact. It is the ADR-0039 satellite, with a different
  buyer, and conflating it with this decision would sink both.

## Consequences

- **Positive**: the reader runward's artifacts are FOR can finally read them; the delivery verdict
  stops being invisible to everyone but the operator who ran the command; and nothing about the
  verdict path changes, so no moat property is spent.
- **Negative, accepted**: a rendered document is a surface with taste in it, and taste ages. It also
  becomes a thing to keep byte-stable, which means a golden and a place in the whole net.
- **On other boundaries**: it is a fifth emission beside SARIF, OSCAL, in-toto and the readiness
  drafts, and it inherits their discipline — deterministic, schema-checked where a schema exists,
  and refusing to state anything the verdict does not.

## What would settle it

An assessor — or someone briefed to read as one — opens a generated report for a mission they have
never seen, without a terminal, and answers the five questions above. If any answer requires opening
the repository, the report has not replaced the terminal for its addressee and the shape is wrong.

The second half is cheaper and equally binding: the report must be byte-identical across two runs on
one tree, and must state nothing `check --json` does not already carry. A rendering that computes is
a second verdict, and two verdicts that can disagree are worse than one that is hard to read.

## Reevaluation trigger (mandatory, dated)

An assessor reads a generated report and still asks for the repository, or a regime pack and the
report state different things about one mission. Either signal means the addressee or the derivation
is wrong, and reopens this.

**Trigger set on**: 2026-09-01 · **Watched via**: the acceptance above, run on the first real
external reader — the ADR-0052 pilot, or the first assessment runward is put in front of
