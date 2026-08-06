---
title: Evaluation Loop (Test + Evaluate, Hold-out, Anchored Judge)
impact: CRITICAL
asi: [ASI08]
phases: [govern]
impactDescription: Gives a non-deterministic system a trustworthy way to detect behavioural regressions without letting it optimise its own grader
tags: [evaluation, testing, llm, quality, governance]
noTerritory: It is a behavioural evaluation discipline — scenario bench, untouchable hold-out, version-anchored judge — that judges the whole system and lives in no file.
---

## Evaluation Loop

> **A deterministic system is tested. An agentic system is tested *and* evaluated.**

The code around the agent is verified like any software (unit, integration, contract). The agent's behaviour is non-deterministic, so it needs a second instrument: an evaluation rubric replayed over scenarios, scored over time.

**Two distinct instruments, never confused:**

| | Test | Evaluation |
|---|---|---|
| Subject | Deterministic code | Agent behaviour |
| Verdict | Pass / fail | Score on a rubric |
| Guarantee | Hard | Behavioural signal |
| Owns | Safety, authorisation, schema, idempotency | Faithfulness, clarity, abstention quality |

**Abstention is scored.** For a grounded system, refusing to invent a figure counts as much as recalling one. A hallucinated number where the agent should have abstained is the worst outcome, scored zero, even if the rest is perfect.

**The hold-out is non-manipulable.** A naive closed loop that optimises the judge's score drifts toward what flatters the judge without improving real quality. What makes self-tuning safe is a guard the optimiser never sees: a hold-out with verifiable ground truth that triggers a rollback when the hallucination rate climbs. The hold-out is only valid where ground truth is verifiable; for purely subjective quality, the net is a human sample and the self-tuning envelope stays narrow.

**The judge is anchored.** The model that scores behavioural quality is frozen in version; on any judge change you replay an anchoring set to recalibrate, otherwise the quality series becomes incomparable in silence. The judge covers only irreducible behavioural quality. The hard floor (is the figure exactly the one in the store, is the source the right one) stays deterministic, compared directly to the store, never handed to the judge.

**No chorus of verifiers replaces a deterministic guard.** Stacking fallible LLM checkers that re-read each other does not manufacture a hard property: their errors correlate (shared data, shared blind spots), an adversarial input that fools one fools the chorus, and each check is one more slow, costly inference where a deterministic control is free and certain. Deterministic for what admits a guarantee; judge only for behavioural quality; always under the hold-out.

**The loop is open at the action boundary.** It produces signals and recommendations. Acting on them goes through a bounded, audited tuning envelope or a human decision, never an autonomous rewrite of the agent.

**Eval runbook (per scenario):**

```
Add     describe the multi-turn conversation, the final question,
        the expected and forbidden terms, the capability targeted.
Run     replay the turns in order against the current system,
        ask the final question, compare to expected/forbidden terms.
Score   apply the rubric, track the score per capability over time
        to catch behavioural regressions.
```

**Continuous faithfulness metric (monitoring, not gating):** alongside the deterministic guard, run a faithfulness metric of the RAGAS / FActScore family over a traffic sample: decompose each synthesis into atomic claims, verify each against the served facts and their source, aggregate into a per-request score and a time series. The guard blocks; the metric alerts. They are complementary.

**Checklist:**

- [ ] Tests and evaluation are separate; safety lives in tests, not in the rubric.
- [ ] Abstention is a scored capability.
- [ ] A non-manipulable hold-out with verifiable ground truth gates regressions.
- [ ] The judge is version-anchored; the deterministic floor never goes to the judge.
- [ ] Acting on eval signals is bounded-and-audited or human, never autonomous.
