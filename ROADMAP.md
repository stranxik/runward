# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-08-12 (v0.33.5) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

### From the 2026-08-12 product review (four ADRs; ADR-0051 and ADR-0053 accepted 2026-08-13, ADR-0050 and ADR-0052 proposed)

A multi-agent product review (six axes, five held under counter-expertise, one refuted on sourcing)
produced four structural decisions, each carried by a **proposed** ADR that crosses no phase until
its ratification proofs pass. The decisions are ordered as a dependency chain, not parallel tracks:
decision 1 conditions any public launch, decision 2 makes the central headline true, decision 4
closes the one usability hole a team pilot hits on day one, and decision 3 depends on a third party
the project does not control (and on decision 4 landing first). Decision 4 was added 2026-08-13
after a multi-agent investigation showed the sixth axis (UX hole 1) needed its own decision and that
the naive form of the fix reopened the false-green family.

**Decision 1 — the public claim never exceeds what the gate proves ([ADR-0050](docs/adr/ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md), proposed).** The site says "no AI can fool it"; measured 2026-08-12, a real but unrelated proof passes `check --strict` (1 rule of 64 is signed), so the sentence loses an argument with the product the first time anyone runs it.

- **Externalize the overclaim rules as package data** (`runward/claims` export or `dist/claims-rules.json`), `no-overclaim.test.js` consuming them with its three meta-guards intact (safe-list both directions, frozen citations, scope > 100 named files); new classes (absolutes about the gate, impossible by design, secured from day one, unreplayable dated competitive claim, verbatim on a translation), each proven in both directions before merge (ADR-0050 decision 2).
- **A claims guard in the site build**: `scripts/check-claims.mjs` on runward-site consumes the rules from the pinned runward devDependency (daily sync already in place), scans the BUILT surface `public/` plus the sources, and runs as the last step of `npm run build` so a violation reds the Vercel deploy; not trusted until one seeded violation has demonstrably broken a build (ADR-0050 decision 3).
- **Narrow the site copy to the ceiling sentence**, FR and EN, at the sources then regenerated: hero and security section lose "impossible" for the actual mechanism, case-study and compare reuse `case-study.fr.md:51` to the character, the July competitive claim becomes replayable or a dated observation, translated citations carry the EN verbatim; every rewording passes the author (ADR-0050 decision 4).
- **Name the gate in the four SPA compare pages** (`index.html:1534-1603`): grep -c "gate" on that window is 0 today while `docs/compare` names it 8 times; word and mechanism in each "what runward adds" cell, text only (ADR-0050 decision 5).

**Decision 2 — the gate is made as strong as its headline ([ADR-0051](docs/adr/ADR-0051-the-gate-is-made-as-strong-as-its-headline.md), accepted 2026-08-13, implemented).** The decision that changes verdict semantics. **Implemented and ratified 2026-08-13**, tests red-before/green-after, both reference missions strict-green: identifier-boundary symbol match (a seal no longer sits on a renamed pointer), a slice of **5 signatures adjudicated on the evidence** (6 of 64 rules signed, the refusals named so the choice is auditable), and the signed-share line in every run ("N of M `applied` rows rest on a signed rule", counted never gated). The three adjacent paper cuts below remain open. Ships in the next release, then this item leaves the roadmap for the CHANGELOG.

- **Landed 2026-08-13 (ADR-0051):** identifier-boundary symbol match, a 5-signature slice (6 of 64 signed, refusals named), and the signed-share line. The three items below are the remaining **paper cuts** — they change no decision and ship without an ADR.
- **The missing-row message names the gesture.** The strict gate's manifest message (`src/lib/conformance.ts:328`) never mentions `runward manifest --sync`, which scaffolds exactly the missing rows. Proof: `conformance-gate.test.js` golden contains the command when rows are missing. 1 to 2 hours.
- **The in-progress label states the true cause.** `check` prints "placeholders remain" for every in-progress artifact (`src/commands/check.ts:67`) while `mission.ts:115-126` distinguishes placeholders-left from divergence-below-floor. Expose the cause; JSON `state` unchanged. Proof in `artifact-state.test.js`. 2 to 3 hours.
- **Duplicated prose is named in the run.** When 2+ `applied` rows carry an identical Evidence cell, "What this gate verified" says so; counted, never gated, ADR-0004 intact, additive JSON. Proof in `evidence-breakdown.test.js`. Half a day.

**Decision 3 — the survival thesis and the first third-party mission ([ADR-0052](docs/adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md), proposed).** The strategic decision; the parts that depend only on us are ratifiable, the exit from zero third parties is not (a third party controls the calendar).

- **Fold the survival thesis into `docs/positioning.md`, behind the fact-check.** Adopted verbatim (independence: a verdict is opposable only when the judged party does not manufacture the judge; survival; agent-agnosticism). Adversarial fact-check pass, then the fold, then `positioning-drift.test.js` extended so diluting it reds CI. Site and README derive only after.
- **Commit the pilot pre-registration before any data exists.** `docs/pilot-protocol.md`: the fixed 12-to-20-question handover questionnaire, the scoring rule (the third party's engineer scores, never the author), and the written failure criterion, committed and dated first; the git history is the proof. Publication of the report is committed whichever way the numbers point.
- **The structure decision is posed, not taken** (Branch A contractable entity / Branch B assumed internal OSS regime), each with a named trigger; choosing a branch is its own later dated decision.

**Decision 4 — the construction gate certifies a declared horizon ([ADR-0053](docs/adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md), accepted 2026-08-13, implemented).** A required `check --strict` exits 1 for the whole build (later phases are unfilled by definition), so it is unusable in CI during construction; teams hack a partial-green with `jq` or `|| true`, worse and untested. The signal was deferred to its own decision by [ADR-0033](docs/adr/ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md). Adversarially verified 2026-08-13: the naive fix reopens the false-green family (a bare `check --through floor` exits 0 with the whole day-zero governance layer as raw templates), which is why the flag ships bound to a wiring contract, not alone. **Implemented and ratified 2026-08-13** (`test/unit/verdict.test.js`, ten cases; red-before/green-after demonstrated by neutering the scoping — the prefix, topology-fold and JSON cases red without it, the invariant cases stay green). Ships in the next release, then this item leaves the roadmap for the CHANGELOG.

- **`check --through <phase-id>`: a declared-horizon prefix verdict.** Narrows only the phase set fed to the existing `countGaps`/`judgeGated` loops (`src/lib/verdict.ts:106-146`); `verdictFrom` and the 0/1/2 contract untouched. Certifies phases ≤ K crossed on evidence; refuses anything past K (surfaced as `horizon.deferred`).
- **The horizon is declared in the reviewed CI YAML, never inferred** — an inferred K self-lowers when a crossed phase breaks and hides the regression. The phase-global integrity checks (corpus scaffold-lock, seal, unratified-ADR, drift) stay unscoped, so a regression at or below K still reds: the horizon is a floor, not a ceiling.
- **The wiring contract, carried by the ADR because the tool cannot enforce it**: the release / merge-to-main gate is always full `check --strict`; `--through` is the construction progress signal, never the sole required release check. Refuses `--freeze`, prints a loud "not a completion verdict" horizon line, additive JSON (`through`, `horizon`, `gaps.deferred`). Residual misuse (wiring `--through` as the only merge gate) is named and left to human wiring, as any CI signal is.
- **Load-bearing: the topology fold** (`topology` is a gated deliverable with no presence-phase-id) must map the ordered index explicitly so a broken `execution-topology.md` reds at `--through architect`; proven both directions in ratification.
- **One genuine fork for the author**: ship the flag with its contract, or close UX hole 1 by doctrine only (require `check --strict` at release, run non-required `check` during construction — zero false-green vector, no new surface). ADR-0053 assumes the flag and carries the doctrine-only option in its Alternatives.

### Standing items

- **Instruct the remaining mutation survivors** — 81 measured against the full 437-test suite on
  2026-08-11 (down from a derived 199; twenty were already dead), each filed as hole, defence in
  depth, equivalent, or display-only
  ([ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 4). The
  largest block is 37 in `evidence`. The 733 lower-stakes survivors were never confronted with the
  full net and are not counted here.
- **`fixed-in` for RWD-2026-0010/0011/0012** in `docs/compliance/known-defects.md`: they are closed
  by tests on `main` and this release is the first to carry them.

## Watching

- **How the `--for` answer is read.** [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s own reopening trigger (a): if the list is taken as exhaustive despite the standing caveat and the split counts, the output shape is wrong, not the operator.
- **Whether the two anchored `topology-*` rules pull their weight.** They were anchored to `execution-topology.md` because runward scaffolds that deliverable itself; if operators find the match noisy on a file that already carries four topology rules, the anchor is too coarse.
- **Whether a version gap between the running binary and the mission ever changes a verdict.**
  A field report ran a global `0.19.0` beside a repo at `0.28.0`. Measured rather than assumed, on
  2026-07-31: the same working tree judged by `0.19.0` and `0.32.0` — the runward mission itself,
  then a mission freshly scaffolded by `0.32.0` — produced **byte-identical output except the header
  line carrying the version**, same exit code. Ten releases apart. The gate reads the mission's own
  rule copy and the mission's own deliverables, so the binary's age does not move the verdict.
  Nothing is mechanised on an unproven risk (the ADR-0039 posture). Reopen if a report ever exhibits
  two versions disagreeing on one tree — that is the objective trigger, and it is falsifiable by the
  same two commands.
- **Rules whose `noTerritory` reason ages.** A declared absence is a decision, not a permanent fact: a rule rewritten to name an artifact becomes anchorable. Fifty of them now carry a reason that can be argued with — that is the point.
- **Whether the mutation ratchet holds.** [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md)
  sets no threshold and one direction: on the seven core modules the score does not go down and the
  absolute-survivor list does not grow. Next pass due 2026-11-05. It will report a **different**
  number for a reason that is not a regression: the verdict moved into `src/lib/verdict.ts`
  ([ADR-0047](docs/adr/ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)) and now sits
  inside the measured perimeter. Compare like for like, or the ratchet reads noise.
- **Whether the machine surface deserves the partition the verdict has.** Measured on 2026-08-05: 42
  territory mutants applied one at a time left `check --strict` at exit 0 every time, while 4 of them
  corrupted `runward rules --for --json`. `check.ts` imports neither territory nor characterize, so
  the partition protecting the verdict is real. It is half a partition, because the contract an agent
  drives on sits outside it and answers a wrong list plausibly rather than saying it could not read.

## Later

- Community workflow extensions
- More tool profiles (contributions welcome — see CONTRIBUTING.md)
- Legal review of the license split (tooling MIT / doctrine CC BY-ND)
- Submit the Claude Code plugin (runward-gate) to the official plugin directory
  (discoverability; the third-party marketplace channel already works)

## Someday

- Certification / training track (separate, commercial)
- Operator-layer satellite (adoption self-audit, operator cost recipes) — only on a real
  demand signal arriving through a channel (the ADR-0028 watch); never in the MIT CLI
  ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)). If the
  trigger ever fires, the citable reference frame exists: the AHE loop
  (observe/diagnose/propose/evaluate/promote under HITL) of arXiv 2605.18747 §2.3 —
  a frame, not a demand signal; the trigger stands unchanged
