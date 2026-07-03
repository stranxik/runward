# Evaluation Rubric: Triage Qualifier (classification and extraction)

**Version**: v1.0 · **Anchored judge**: judge model pinned at the version deployed 2026-06-02; anchor set of 30 labeled requests replayed at every judge change · **Rerun triggers**: any change to the classification prompt, the model version or tier, or the category vocabulary (TriageRecord contract change)

> Figures and set sizes below are **illustrative**. The deterministic tests (guards, schema, queue resolution) live in the test suite; this rubric covers only the non-deterministic half — the model's proposals.

## 1. Capabilities evaluated

Floor-tier capabilities only. The long-memory capability set does not apply: the floor has no memory — each request is triaged independently (named deferral, framing §6). The rubric extends when that deferral trigger fires, not before.

| Capability | What it verifies |
|---|---|
| Routing fidelity | the proposed category matches the labeled ground truth on real requests, across the closed vocabulary (support / sales / compliance / unknown) |
| Extraction fidelity | proposed key fields (requester identity, account reference, stated deadline) match what is actually present in the source text |
| Abstention | when the request is ambiguous or the information is absent, the model proposes `unknown` or omits the field — it never invents a category, an account reference or a deadline |
| Criterion compliance | no compliance-category request is proposed for a non-compliance queue; borderline compliance signals must lower confidence, which sends the record to human review |

## 2. Scoring scale

| Answer quality | Score |
|---|---|
| Correct category and all present fields extracted, absent fields omitted | 2 |
| Correct category, one field missed or over-extracted | 1 |
| Wrong category between support and sales (recoverable misroute) | 0 |
| Invented field value, or a compliance request proposed outside compliance/review | −2, and the case is flagged for review of the guard path |

Deterministic scoring against labels wherever ground truth exists; the judge model is used only to grade borderline category judgment on ambiguous requests.

## 3. Scenarios

### Scenario RT-01 — capability: routing fidelity
- **Input**: a labeled replay request: password-reset complaint referencing an existing account.
- **Expected terms**: category `support`; the account reference exactly as written in the text.
- **Forbidden terms**: category `sales` or `compliance`; any account reference not present in the text.

### Scenario RT-07 — capability: abstention
- **Input**: a two-line request with no account reference and no identifiable ask ("hello, following up on my situation, please advise").
- **Expected terms**: category `unknown`, no extracted account reference, low confidence.
- **Forbidden terms**: any invented account reference or deadline; any confident category. The right answer is a motivated abstention that routes to human review.

### Scenario RT-12 — capability: criterion compliance
- **Input**: a request mixing a sales question with a personal-data deletion demand buried in the third paragraph.
- **Expected terms**: category `compliance` (or `unknown` with the compliance flag raised), deadline field extracted from the text.
- **Forbidden terms**: category `sales` with high confidence — the buried deletion demand is the regulatory payload; missing it silently is the single failure the criterion forbids.

## 4. Hold-out (non-gameable)

- **Composition**: 40 labeled requests drawn from the replay archive, stratified across categories, never used for prompt tuning — invisible to whoever adjusts the prompt.
- **Use**: replayed after every rerun trigger; a drop on the hold-out rolls the change back regardless of the visible-set score.
- **Limit**: ambiguous-category judgment has soft ground truth; for those cases the safety net is a weekly human sample from the review queue.

## 5. Judge anchoring

- **Anchoring method**: judge version pinned; the 30-request anchor set is replayed whenever the judge changes, to recalibrate the series before comparing new scores to old ones.
- **Judge scope**: only borderline category quality. The hard floor — the deterministic guard, the schema, the compliance attached condition — is tested deterministically, never delegated to the judge.
- **Action boundary**: the loop produces scores and flags; prompt or routing changes it motivates go through the operator and, when structural, an ADR — never autonomous self-rewriting.

## References

- [observability-schema.md](observability-schema.md) — the trace stream this loop samples from, off the hot path.
- [ADR-0002](../adr/ADR-0002-deterministic-guard-on-extracted-fields.md) — why invented values score −2 but never act regardless.
- [floor.md](../floor.md) §2 — the measured proof this rubric's replay set descends from.
