# Evaluation Rubric: runward

**Version**: v0.14.2 · **Anchored judge**: none — there is no judge model, because there is no non-deterministic behavior to judge · **Rerun triggers**: every commit (CI), every release

The doctrine's split is: *test the deterministic, evaluate the non-deterministic.* runward sits entirely on the deterministic side — the gate is a pure function of the working tree — so this rubric is honest about what that means: the "evaluation" of runward **is** its test harness plus the external scrutiny the project subjects itself to. There are no scenario scores, no judge model, no hold-out set, because grading a deterministic function on a rubric would be theater. What replaces each instrument is listed below.

## 1. What is verified, and by what instrument

| Capability | Instrument | What it verifies |
|---|---|---|
| The gate's verdict logic | unit suites (node:test) under `test/unit/` | conformance accounting, form lint, non-vacuity floors, typed-pointer resolution, signatures, sealing, manifest sync, the rules surface, compliance inputs — each gate-core library above 85% line coverage from the unit suites alone (measured with node:test coverage), the remainder driven end to end by the smoke suite |
| Parser robustness (anti-false-pass) | seeded fuzz suite (`test/unit/manifest-fuzz.test.js`) | the manifest parser never throws and — the property that matters for a gate — never lets a malformed table pass as accounted-for |
| Compliance output fidelity | golden OSCAL test with negative controls (`test/unit/oscal-golden.test.js`, `test/fixtures/golden/`) | the OSCAL component-definition is byte-identical to the reviewed golden; mutations are caught, so drift in the pack is impossible to miss |
| Standards conformance | NIST schema validation (`test/oscal-schema.js`) | the emitted OSCAL validates against the official 1.1.2 schema |
| End-to-end command behavior | smoke suite (`test/smoke.js`) | every command driven for real: init idempotence, strict red/green transitions, drift blocking, seal tampering, exit-code contract, the reference mission green out of the box |
| Determinism and isolation | `core-offline` CI job | the same suites pass inside a no-network namespace; repeated runs produce identical output |
| Project security posture | OSSF Scorecard (continuous), Dependabot, CODEOWNERS review | supply-chain hygiene scored by an external instrument, not self-attested |

## 2. The equivalents of the rubric's guards

- **Hold-out the optimizer never sees** → the golden files and the fuzz seeds are reviewed artifacts; a change that rewrites a golden to make a regression pass is exactly as visible in review as the regression itself (regenerating requires the explicit `UPDATE_GOLDEN=1` gesture and produces a diff).
- **Anchored judge** → the anchors are external and versioned: the NIST OSCAL 1.1.2 schema and the pinned rule set. Neither moves silently.
- **Abstention weighs as much as recall** → the gate's equivalent is refusing to pass on doubt: unknown rules, empty statuses, unresolvable pointers and stripped mappings are violations, never skips. The fuzz suite asserts the never-false-pass property directly.

## 3. What would change this note

If runward ever grew a non-deterministic surface, that feature would need a real evaluation loop before it ships — and per docs/adr/ADR-0001 the verdict path can never be that surface, so the trigger would be an advisory feature only (e.g. shipping a scored semantic-verification workflow). None is planned; the advisory verify workflow (docs/adr/ADR-0007) is executed by the operator's own agent, on the operator's own model, outside this system.

## References

- [observability-schema.md](observability-schema.md) — the CI chain this rubric runs on.
- [../floor.md](../floor.md) §2 — the behavioral proof (`npm test`).
