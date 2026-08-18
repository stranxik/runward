# ADR-0052: the survival thesis and the first third-party mission

**Date**: 2026-08-12
**Status**: accepted 2026-08-18 (the thesis is locked and the pilot is armed — everything that does not depend on the third party; record below)

## Context

Three facts, each measured on 2026-08-12, define what this ADR instructs.

**The thesis exists nowhere.** A grep for the vocabulary of the confrontation ("judge and party",
"action-gate", "phase-gate", "harness-native") across `docs/` and `runward/` returns no occurrence
(re-run 2026-08-12 before writing this: empty). The nearest material is
[positioning.md](../positioning.md) pillar 1 (the gate is aimed at the decision, at delivery, never
at runtime) and its vendor-neutrality rule (a per-harness hook is "one example, not privileged").
Neither the judge-and-party independence argument nor the confrontation with the harness's own gate
is written anywhere. That confrontation is not hypothetical: the vendor's native action gate exists
today. Claude Code's PreToolUse hook "blocks the tool call", a runtime, per-action mechanism inside
a session (code.claude.com/docs/en/hooks, read 2026-08-12; cited here under the vendor-neutrality
rule, as one example and not privileged), and the four spec-driven tools have each added gate or
proof mechanics of their own (product review of 2026-08-12, counter-expertised: five axes held, one
refuted). The question "what remains of runward when the harness ships its gate" has an answer this
project believes and has never written down.

**Zero third parties, proven rather than suspected.** `gh api repos/stranxik/runward`: 1 star,
0 forks, 0 watchers (2026-08-12). GitHub code search for "npx runward" outside stranxik/runward:
5 repositories, all the author's. npm: 4 658 downloads/month (api.npmjs.org, window 2026-07-11 to
2026-08-09), which is distribution, not adoption. No before/after number exists anywhere, including
from the author's own missions.

**The structure is one person.** Bus factor 1, no legal entity, and
[regulated-adoption.md](../compliance/regulated-adoption.md) section 2 already prices both plainly
(38 tags cut in five weeks; "price that risk rather than net it out"). The portage salarial is a GO
(study of 2026-07-22); the legal review of the MIT/trademark split is still open; a paid pilot
would demand a contractual vehicle none of this provides.

The adverse case, first. Nothing prevents a harness vendor from building a phase-gate tomorrow: the
thesis below claims a defect of opposability over the vendor's own agent, never impossibility, and
a vendor shipping an agent-agnostic gate that judges a competitor's agent is improbable, not
impossible. The sharpest edge cuts inward: with zero third parties, nobody has demanded
opposability from runward either. The thesis is a thesis, tested by no real audit, and the legal
anchor below is cited as a principle, not a status.

## Decision

Three parts. What proves each is in Ratification; none of it is proven today.

**1. The survival thesis is adopted, verbatim.** The exact statement, in the house style, negating
form deliberate:

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

The article 31(4) sentence is verified verbatim against the primary source: "Notified bodies shall
be independent of the provider of a high-risk AI system in relation to which they perform
conformity assessment activities", Regulation (EU) 2024/1689, art. 31(4)
(eur-lex.europa.eu/eli/reg/2024/1689/oj, read 2026-08-12). The negating form is not stylistic: the
no-overclaim guard exempts formulations that argue against a claim
(`test/unit/no-overclaim.test.js`, the NEGATED class), so the thesis is writable because it denies
rather than asserts. Its path is the house path and no other: an adversarial fact-check pass first
(the verification-before-publication doctrine), then the fold into
[positioning.md](../positioning.md), then `test/unit/positioning-drift.test.js` extended to lock
the statement, and only then do the site and README derive from it (product review decision 1:
public copy at the level of the product). The precedent is exact:
[positioning-note-object-moment-lineage](../positioning-note-object-moment-lineage.md), ratified
then folded, never one more surface to maintain.

**2. The exit from zero third parties is one measured pilot.** The first unit of credibility is
one named third party, brownfield, no production stakes required, measuring the cost of a
handover. The instrument is a fixed questionnaire of 12 to 20 questions that an acquirer or an
auditor actually asks: which decisions were taken and why, where is the threat model, how do you
restart it, what breaks first, who answers for what. Measure BEFORE on the repository as it stands
(hours spent, questions left unanswered); then `characterize`, retro-documentation, mission;
measure AFTER with the same questionnaire, scored by the third party's engineer and never by the
author. Pre-registration is mandatory, and it is the thesis's own judge-and-party logic applied to
ourselves: protocol, questionnaire and failure criteria are committed and dated before any data
exists, the git history being the proof. The failure criterion is written in advance, of the form:
if the after does not reduce the unanswered questions, or reduces the hours by less than the
operator time spent producing the artifacts, the pilot counts against the method and is published
as is. Publication is committed whichever way the result points (the "results that count against
us" line of regulated-adoption.md, applied). What is prepared without waiting for anyone:
`docs/pilot-protocol.md`, the questionnaire, and the candidate list (eXalt through an existing
contact; the HN funnel once the launch lands; Bpifrance measures usage and credibility, never
price, per the study of 2026-07-22; the "evidence pack" invoice line remains the price test,
separate from and later than this credibility pilot). One dependency, named: a team pilot hits, on
day one, the absence of a CI construction mode that answers "in good standing through the phase we
have reached" (the product review's UX hole number 1). That mode is not part of the review's
decision 2 ([ADR-0051](ADR-0051-the-gate-is-made-as-strong-as-its-headline.md) hardens the gate's
depth, a different concern) nor decision 1
([ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) narrows public copy); it
is the decision [ADR-0033](ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md)
reserved as "its own decision", now taken as
[ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md) (accepted 2026-08-13), whose
ratification precedes or accompanies the pilot.

**3. The structure decision is not taken here; it waits for a named trigger.** Two branches,
recorded now so that the day a trigger fires the choice is a reading, not a scramble. Branch A, a
contractable entity, triggers on any of: a buyer pays the "evidence pack" invoice line; a pilot
buyer demands liability, IP or support terms the portage salarial cannot carry; the trademark
review concludes the mark needs a holder. Branch B, an assumed internal OSS regime, triggers on:
the invoice line is struck (the "people pay for the proof" thesis dies, and no revenue justifies
an entity's running cost), or the pilots hold under portage; the honest posture is then the one
regulated-adoption.md already writes (the buyer pins a version, keeps the right to fork, qualifies
the tool in their own environment, receives no commercial promise). This ADR forbids choosing a
branch without a dated, named trigger event: the choice, when it comes, is its own decision,
recording which trigger fired and when. One prerequisite is common to both branches and settles
independently of any trigger: the legal review of the MIT/trademark split, still open (ROADMAP,
Later). The pressure to decide early has its answer prepared: to a prospect asking "who are you,
legally", the reply is this ADR, the question posed, traced, and decided on trigger.

## Alternatives considered

- **Write the thesis straight into the site or README, no ADR.** A load-bearing claim without its
  traced decision contradicts the repository's own lineage doctrine (the evidence derives from the
  decisions) and skips the verification-before-publication pass; it is also exactly what the
  product review already reproaches the FR site (copy ahead of the product).
- **A dedicated doc page or an immediate whitepaper.** positioning.md declares itself the source of
  truth for all copy and is already CI-guarded; the house precedent
  (positioning-note-object-moment-lineage: ratified, then folded) shows the path without adding a
  surface to maintain. A public page can derive from the fold later if a need appears.
- **Settle the structure now, create the entity.** Deciding on assertion before any buyer signal; a
  recurring cost with no demonstrated revenue; the MIT/trademark review still open; and the
  falsifiable invoice-line test already acted is designed to validate or kill the pricing thesis
  for zero euros of structure.
- **Make the first pilot a paid pilot.** That couples the credibility question (a measured
  before/after) to the price question and its legal prerequisites. The handover pilot costs the
  third party about half an engineer-day and can be free; the price test stays separate and later.
- **One more self-audit as proof of value.** The product review established it: neither value nor
  novelty is demonstrable while nobody else ships with runward. A further self-audit strengthens
  the mechanics, does not leave zero third parties, and reproduces the judge-and-party defect the
  thesis denounces.

## Consequences

- The thesis becomes citable, then locked: after the fold, diluting it reds CI
  (`positioning-drift.test.js`), and product review decision 1 (public copy at the level of the
  product) finally has a written base instead of an intuition.
- The journal admits zero third parties in public: this proposed ADR says in writing that nobody
  else ships with runward today. That is an accepted negative, consistent with regulated-adoption's
  "results that count against us", and it is what will make the first third-party number credible
  when it exists.
- The pilot can count against the method: pre-registration makes an unfavourable before/after
  impossible to dress up, and publication is committed both ways. A published unfavourable number
  is worth more than no number.
- Nothing moves at the gate: this ADR crosses no phase and no manifest may cite it as evidence
  ([ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) decision 4 refuses an
  unratified ADR by name, which is exactly the wanted state). `node dist/cli.js check --strict`
  measured exit 0 on 2026-08-12 before this file; it must read exit 0 after.
- The order of work becomes a dependency chain, not three parallel workstreams: part 3 cannot
  resolve before part 2 produces a signal, and a team pilot hits, on day one, the missing CI
  construction answer, whose closure is its own decision
  ([ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md), accepted), not
  decision 2.
- Cost, stated: about three maintainer-days of writing in total (thesis fold with its fact-check
  pass, 1 to 1.5; pilot protocol and questionnaire, 1; structure part, 0.5), plus 0.5 to 1
  operator-day per measurement session. The pilot's calendar belongs to the third party and is not
  promised; the legal review is an external cost, not priced here. The only thing that plans is
  that everything on our side is ready the day a third party says yes.

## What this does not claim

That the thesis is proved: no real audit has demanded opposability from runward, and it stays a
thesis until the first third party. That a vendor cannot technically build a phase-gate: the thesis
is about opposability, not feasibility. That the pilot will happen, or when: the third party
controls the calendar. That 4 658 npm downloads a month mean adoption: they mean distribution.
That the structure question is resolved: it is posed, with its triggers, nothing more. That any
phase of the runward mission advances: this ADR is proposed, and the gate does not cross on paper.
That the pilot's before/after will be favourable: its publication is due either way.

## Ratification

**Accepted 2026-08-18**, on exactly what this ADR said acceptance would certify: the thesis locked
and the pilot armed. It does **not** certify the exit from zero third parties — only a published
pilot report proves that, and no third party has been named yet.

- **(a) The thesis — FOLDED.** The statement stands verbatim in
  [`docs/positioning.md`](../positioning.md), under a heading that says it is locked, with the
  fact-check dated beside it: the article 31(4) sentence was verified against the primary source on
  2026-08-12 (eur-lex.europa.eu/eli/reg/2024/1689/oj) and is carried **as a principle, not a
  status** — runward is not a notified body and performs no conformity assessment.
  `test/unit/positioning-drift.test.js` pins the load-bearing clauses INDIVIDUALLY (independence,
  survival, agent-agnosticism, the principle-not-status caveat, and the negating close), because a
  paraphrase usually keeps the shape and loses exactly one of them. Proven in both directions:
  removing "not a status" reddens three assertions, and softening independence to "the judge should
  ideally be independent" reddens by name. Both dilutions reverted.
- **(b) The pilot, armed — DONE.** `docs/pilot-protocol.md` was committed 2026-08-17 with the fixed
  sixteen-question instrument, the scoring rule (the third party's engineer scores, never the
  author) and the written failure criterion; `docs/pilot/` added the artifacts it is filled into on
  2026-08-18, still empty. The git history of both dates is the pre-registration, and it precedes
  any pilot data because no pilot has run.
- **(c) The structure.** Excluded by construction, unchanged: choosing a branch is a separate dated
  decision naming the trigger that fired. This acceptance chooses nothing.

The criteria as originally set, kept as the record of the bar:

- **(a) The thesis.** The adversarial fact-check pass has run and its date is appended here; the
  statement stands verbatim in `docs/positioning.md` (a grep of its first sentence returns exactly
  one occurrence there) and `test/unit/positioning-drift.test.js` is extended so that diluting or
  paraphrasing it reds `npm test`. Site and README touch the thesis only after that fold.
- **(b) The pilot, armed.** `docs/pilot-protocol.md` exists with the fixed questionnaire, the
  scoring rule (the third party's engineer scores, never the author) and the written failure
  criterion, committed before any pilot data exists, and the git history shows it. That is the
  pre-registration.
- **(c) The structure.** Excluded from this ADR's ratification by construction: choosing a branch
  is a separate, dated decision naming the trigger that fired. Nothing in this ADR's acceptance
  chooses one.

Acceptance therefore certifies that the thesis is locked and the pilot is armed, which is
everything that does not depend on the third party. It does not certify that the exit from zero
third parties happened: only the published pilot report proves that (a named third party, hours
and unanswered-question counts scored by their engineer, published whichever way the numbers
point), and its calendar is not ours to promise. Global invariant, measured before writing and to
re-measure after: `node dist/cli.js check --strict` exits 0; a proposed ADR is cited by no
manifest and crosses no phase.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-17.

**This trigger is also a decision deadline** — the 0040-style lapse discipline this ADR lacked, added 2026-08-17 on the audit's finding. By 2026-11-17 either the pilot has run under [pilot-protocol.md](../pilot-protocol.md) and its result is published whichever way it points, or the decision is retaken: the survival thesis stays a thesis, and the project says so in `docs/positioning.md` instead of waiting indefinitely for a third party who may never arrive. A decision with no deadline is a wish, and this is the one decision the whole positioning rests on.

The decision is also wrong and must be revisited if any holds: a third party runs the gate and the handover cost does not move (the failure criterion fires, and publication is already committed); a harness vendor ships an agent-agnostic delivery gate that judges a competitor's agent, which would falsify the independence argument rather than the tool; or a paid engagement arrives first and forces the structure decision (part 3) before the credibility pilot.

**Watched via**: the pilot protocol's own dates, and the ADR-0028 demand-signal watch.
