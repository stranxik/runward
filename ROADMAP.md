# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-08-11 (v0.33.4) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

- **Instruct the 199 remaining mutation survivors**, and file each one as what it is: hole, defence
  in depth, equivalent, or display-only. A register, not a backlog to zero
  ([ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 4). The
  largest block is 20 in `evidenceReport`. The 733 lower-stakes survivors were never confronted with
  the full net and are not counted here.
- **A vulnerability check in CI.** There is none today: `grep -rn "npm audit\|dependency-review"
  .github/workflows/` returns nothing, and two HIGH advisories sit open in the development
  dependency tree. `docs/compliance/regulated-adoption.md` says so plainly, which is the right first
  move and not the last one.
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
