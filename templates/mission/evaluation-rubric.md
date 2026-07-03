# Evaluation Rubric: [agent or capability under evaluation]

> **Usage.** A deterministic system is tested; an agentic system is tested **and** evaluated. This rubric serves the evaluation half: measuring the quality of non-deterministic behavior where a test can no longer answer true or false. Scoring follows an explicit rubric; every scenario carries expected and forbidden terms, which makes **abstention** (refusing to invent) weigh as much as recall. Evaluation is not a final gate but a continuous loop, sampled off the hot path from the trace stream. Scoring is hybrid: deterministic wherever a guarantee exists, a judge model only for the irreducibly behavioral. Two mandatory guards: a **hold-out the optimizer never sees**, and an **anchored judge** (pinned version, or an anchor set replayed at every judge change) — without them the quality series silently becomes incomparable. Replace every `[placeholder]`; delete this notice on delivery.

**Version**: [vX.Y] · **Anchored judge**: [pinned version or anchor set] · **Rerun triggers**: [any change touching memory, prompts, or routing]

## 1. Capabilities evaluated

[Select and adapt the relevant capabilities. For long-memory benches, the six core ones below.]

| Capability | What it verifies |
|---|---|
| Direct recall | [retrieve a fact given many turns earlier] |
| Multi-constraint recall | [combine several scattered pieces of information into one answer] |
| Knowledge update | [return the most recent value after a correction] |
| Temporal reasoning | [state what was true at a given date; distinguish when a fact was learned from when it was valid] |
| Abstention | [refuse to invent when the information was never given] |
| Long session | [remember across enough turns to trigger summarization] |

## 2. Scoring scale

[Explicit and reproducible.]

| Answer quality | Score |
|---|---|
| Complete — restates all key elements | [max] |
| Partial — misses one | [intermediate] |
| Vague but not wrong | [half] |
| Wrong, or hallucinated where abstention was required | [zero] |

## 3. Scenarios

[One block per scenario: the multi-turn conversation, the final question, and the expected / forbidden terms.]

### Scenario [ID] — capability: [target capability]

- **Multi-turn conversation**: [describe the turns in order.]
- **Final question**: [the question asked at the end.]
- **Expected terms**: [elements a good answer must contain.]
- **Forbidden terms**: [elements whose presence signals hallucination or leakage. For an abstention scenario, the right answer is a motivated refusal; any invented fact is forbidden.]

## 4. Hold-out (non-gameable)

[The strong guard that stops self-tuning from drifting toward whatever flatters the judge.]

- **Composition**: [a subset of scenarios with verifiable ground truth, invisible to the optimizer.]
- **Use**: [replayed to trigger rollback if its score drops, independently of the training score.]
- **Limit**: [for purely subjective behavior without ground truth, the safety net reverts to human sampling; the self-tuning envelope stays narrow.]

## 5. Judge anchoring

[The judge is itself a model, and it will be updated.]

- **Anchoring method**: [pinned version, or an anchor set replayed at every judge change to recalibrate the measure.]
- **Judge scope**: [only irreducibly behavioral quality. The hard floor — safety, security, authorization, audit — stays deterministic, never delegated to the judge.]
- **Action boundary**: [the loop produces signals and recommendations; acting on them goes through bounded, audited, pre-approved tuning or human validation — never autonomous self-rewriting.]

## References

- [Observability schema (the trace stream feeding this loop), related evaluation runbook, ADRs.]
