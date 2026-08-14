# ADR-0053: the construction gate certifies a declared horizon, not the whole arc

**Date**: 2026-08-13
**Status**: accepted (2026-08-13; ratification proofs recorded below)

## Context

The product review of 2026-08-12 named a usability hole that no other decision closes (UX hole
number 1). It is measured, not supposed. Verified live on the shipped 0.33.5 (`echo $?` on real
runs, not reasoned):

- `runward check --strict` collapses every non-filled deliverable across **all** phases into one
  `gaps` count (`src/lib/verdict.ts:106-116`), every gated-deliverable violation across all phases
  into one `strictGaps` count (`src/lib/verdict.ts:123-146`), and the sole exit arithmetic
  `verdictFrom` (`src/lib/verdict.ts:162-165`) folds those into a single boolean: exit 0 only when
  the count over the **whole arc** is zero.
- During construction, later-phase deliverables (Govern day-zero, Hand over) are by definition not
  yet `filled`, so a **required** `check --strict` in CI exits 1 continuously until the entire arc
  through handover is done. It turns green only at the very end.

So a team that wires the required check the way the docs prescribe (a hard status check on
`check --strict`, ADR-0028) gets a red gate for the whole build and learns to ignore it, or wires
it `|| true`, or reconstructs a subset by hand from `check --json | jq` (every deliverable row
already carries `{phase, state}`). Each of those is a worse, untested answer to a real need: a CI
signal that is honestly green while the team is on track for the phase it has actually reached.
`analyze()` already **names** the furthest-green boundary (`currentPhase`, `src/lib/mission.ts:146-162`)
but never **certifies** it: there is no verdict, and no exit code, for a prefix of the arc.

**This exact object was deferred to its own decision.** [ADR-0033](ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md)
recorded, in its Alternatives, "the partially-filled-but-shipped case … needs a deterministic
'delivered' signal; its own decision" and refused to make Iterate a sixth gated rung precisely
because such a rung would "never complete (permanent red) or complete falsely". This ADR is that
deferred decision, taken now, under the constraint ADR-0033 set: the signal must not be a rung that
completes falsely.

**The naive form of the fix reopens the false-green family, and this was reproduced, not feared.**
A `check --through <phase>` that simply narrows the counters to phases up to K, taken alone, was
attacked on the real code: scaffold `init --example` (strict-green), revert the three Govern and two
Handover deliverables to their raw templates (a genuine "crossed through floor, not through govern"
state), then measure. `check --strict` reads exit 1 (currentGate `5 · Govern (day zero)`, 16
conformance gaps, all of them in {Govern, Handover}: prompt-injection, secrets boundary, sandbox,
MCP pinning, resilience, eval, handover). The floor prefix is genuinely clean. So a bare
`check --through floor` feeds `verdictFrom(0,0,0)` and flips the exit code 1 → 0 **while the entire
day-zero governance layer is a set of raw templates**. Branch protection consumes only that exit
code; the honest caveats the command prints beside it do not reach it. That is the amendment of
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) turned against the tool: "the run
is the exit code, not the sentence next to it." A construction verdict that can become the sole
required merge gate is the "completes falsely" trap in a new costume.

The worst case, named first: the true statement "the prefix through K is crossed" is a green that a
required check reads as "shippable", and no exit code can distinguish the two — because on the fixed
0/1/2 contract a legitimate prefix crossing **must** exit 0. The tool cannot police how a human
wires it. So the decision below is not a flag; it is a flag bound to a wiring contract, and the
contract is the load-bearing half.

## Decision

**1. `runward check --through <phase-id>`: a declared-horizon prefix verdict.** `phase-id` is a
presence-phase id in the ordered set `{frame, architect, floor, govern, handover}` (topology is
folded under architect, exactly as the presence view already does), reusing the phase-id vocabulary
already parsed and validated for `rules --phase` (`src/cli.ts:122`, `src/lib/conformance.ts:25-33`).
It composes with `--strict` and `--json`. It **narrows only the set of phases fed to the existing
counters**: `countGaps` and `judgeGated` filter their loops to phases whose ordered index is ≤ K;
the pure `verdictFrom(gaps, strictGaps, hookFailed)` is then called with those subset counts,
unchanged. The exit arithmetic is not touched.

What it certifies: every deliverable in phases ≤ K is `filled`, and (under `--strict`) every gated
deliverable in phases ≤ K has zero conformance, evidence and drift violations. What it refuses to
certify: anything about phases after K, which are surfaced as explicitly **deferred**, never as
crossed; and that the mission is complete.

**2. The horizon is declared, never inferred.** There is no `--wip`/`--auto` that detects K from the
furthest-green prefix. An inferred horizon would silently lower itself when a crossed phase broke,
exiting 0 at the smaller prefix and hiding the regression, the exact false green
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) forbids. K lives in the
version-controlled, reviewed CI YAML, where a reviewer sees which horizon the team claims. The
declared horizon is a **floor the whole prefix must hold**: the phase-global integrity checks are
**not** scoped by `--through` — the corpus scaffold-lock (`src/lib/verdict.ts:196-213`), the
evidence seal (`217-223`) and the unratified-ADR check (`225-227`) still run over the whole mission,
so a moved corpus, a broken seal, an edited or removed rule, or a `DRAFT`/hypothesis ADR reds the
verdict at **any** horizon. Regress anything at or below K and the exit goes to 1. This property was
adversarially confirmed to hold on the real code.

**3. The wiring contract, which the ADR carries because the tool cannot enforce it.** The
release / merge-to-main gate is **always** the full `check --strict` (no `--through`). `--through` is
the construction-branch **progress** signal, aligned 1:1 with governance through phase K
([ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md)); it is never the sole
required status check that guards production. The tool cannot mechanically prevent a team from wiring
`check --through floor` as their only merge gate — a required status check keys on an exit code, and
no deterministic, branch-blind, zero-LLM tool can know a green is being read as "done". So the mode
does the only honest things it can at the mechanism level, and states the rest as contract:

- it **refuses `--freeze`** (`check --through <id> --freeze` exits 2, misuse): a seal certifies a
  full crossing, and a partial arc must never be sealed as a completed mission
  (`src/commands/check.ts:280-282` already refuses to seal an empty set);
- it refuses to infer its own horizon (decision 2);
- it prints a **loud horizon line** naming the deferred phases and stating, in the run, "prefix
  verdict through `<phase-id>`; N later deliverable(s) deferred; this is not a completion verdict";
- `--json` carries `through`, `horizon.deferred[]` and `gaps.deferred`, so any tooling can detect a
  prefix verdict and refuse to treat it as a whole-arc gate; `currentGate` and `steadyState` keep
  their true whole-arc values.

This is not weaker than the status quo: teams already build partial-green by hand with `jq`, which
**drops** the phase-global corpus/seal/unratified checks; `--through` keeps them. It is a
disciplined, tested version of a thing that otherwise ships as untested CI glue, off the seam a test
can reach ([ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)).

**4. The exit contract and the JSON contract are untouched.** No fourth exit code: `--through` maps
onto the fixed 0/1/2 port ([ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md),
[ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md),
[ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)); unknown
phase-id and `--through`+`--freeze` both take the existing misuse path to exit 2
(`src/cli.ts:148-159`). The new JSON fields are additive-only (`through`, `horizon`, `gaps.deferred`);
nothing is renamed or repurposed. `--through handover` (the whole arc) is **identical on the exit
code** to plain `check --strict`; it is **not** byte-identical on `--json`, which additionally
carries `through:"handover"`, `horizon.deferred:[]`, `gaps.deferred:0` — the identity test is scoped
to the exit code, never the JSON bytes.

## Alternatives considered

- **Close it by doctrine only, no flag: require `check --strict` at release, run non-required
  `check` for visibility during construction.** This has zero false-green vector because it never
  claims a green mid-construction; it just does not gate. It is the honest fallback and the ADR does
  not foreclose a team choosing it. It is carried here as a live option because it removes a product
  surface and a residual misuse risk; the reason to prefer the flag is that "advisory, ignore the
  red" trains teams to ignore the gate, and a meaningful, honestly-green construction signal is what
  the review found teams actually want. **This is the one genuine fork for the author**: ship the
  flag with its contract, or close UX hole 1 by doctrine alone. The rest of this ADR assumes the
  flag; if the author chooses doctrine-only, decisions 1–4 collapse to a `docs/` pattern and the
  ratification below is replaced by a documentation test.
- **`check --phase <id>` (single-phase, reusing the `rules --phase` flag).** "In good standing at
  the phase we reached" is a **prefix** property (all phases up to K), not a single-phase one. A
  single-phase pass can go green on K while an earlier phase regressed — a stale pointer in
  frame/architect would be invisible to `--phase floor`. That is the regressed-crossed-phase false
  green again. Honest only if it also asserts the whole prefix, at which point it is `--through`
  under another name.
- **An auto-detected `--wip` mode, K inferred from the furthest-green prefix.** Inferring K lets the
  tool choose its own horizon; when a crossed phase regresses the prefix simply shrinks and the mode
  still exits 0 at the smaller prefix, hiding the regression. Rejected on decision 2.
- **A fourth exit code (`3` = "in progress but healthy").** Forbidden: the 0/1/2 contract is a
  fixed, versioned, additive-only port ([ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md),
  [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)); a fourth
  code breaks every consumer that reads any non-zero as failure, including CI required checks and the
  thin shells docs/distribution.md documents.
- **No flag, document the `check --json` primitive and a `jq` recipe.** Reconstructible today, but it
  relocates the verdict into per-team CI glue no runward test reaches, reopening the untested-verdict
  problem the extraction of `verdict.ts` closed
  ([ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)); each team's `jq`
  drifts and silently drops the phase-global checks. Kept as the documented fallback, never the
  primary answer.
- **Fold the horizon into a recorded mission-side marker (a "we are at phase K" state in the seal).**
  Introduces mission state a construction branch must commit and keep fresh, duplicating what a
  declared flag in the reviewed YAML gives for free; and seal semantics certify a full crossing, so a
  marker in the seal reads like completion — the precise false green to avoid.

## Consequences

- **Exit 0 stops implying `steadyState`.** Today exit 0 ⇔ the whole arc is clean. `--through` makes
  exit 0 coexist with `currentGate` naming an open phase and `steadyState` false. On the fixed 0/1/2
  contract a legitimate prefix crossing must exit 0, so this is inherent — which is exactly why the
  contract (decision 3), not the exit code, forbids `--through` from being a required release gate.
  The migration note names this and the population it affects (teams adopting the flag), in the
  version that ships it.
- **The residual misuse risk is real and named.** A team can wire only `check --through floor` as
  their required merge check and ship a govern-less, handover-less product behind a permanently green
  gate. The ADR states the contract, the run states the horizon loudly, the JSON exposes the prefix,
  and `--freeze` is refused — but a human who wires a progress signal as a release gate is
  misusing it, the same way a human who makes only unit tests required ships untested integrations.
  runward's own doctrine already holds this line: the gate verifies presence, pointers and integrity,
  never that a human wired it wisely; usage stays human.
- **Every regression at or below K still reds.** The phase-global integrity checks are unscoped, so
  the declared horizon is a floor, not a ceiling — verified adversarially, not asserted.
- **The topology fold is load-bearing.** `topology` is a `GATED_DELIVERABLES` entry with no
  presence-phase-id; an implementation that filters `judgeGated` by string-matching the presence-id
  would silently exempt the topology manifest at K = architect — a false green **inside** the
  certified prefix. The implementation maps the ordered index explicitly and the ratification proves,
  both directions, that a broken `execution-topology.md` reds at `--through architect`.
- **Cost**: about 2.5 to 3 maintainer-days, in line with ADR-0051's estimate for a comparable
  verdict-semantics change. `verdict.ts`: thread an optional `through` index into the two counter
  loops, leaving `verdictFrom` and the global corpus/seal/unratified blocks untouched (~0.5d).
  `cli.ts`: the flag, the phase-id validator extended from the `rules --phase` set, the
  `--through`+`--freeze` misuse guard (~0.25d). `check.ts`: pass-through, the horizon line and
  deferred list, the additive JSON fields (~0.5d). Tests both directions (~0.75d). ADR authoring with
  its fact-check pass and the ROADMAP entry (~0.5d). No third-party or external cost.

## What this does not claim

- Not that `--through` is safe to use as a release gate: it is not, and the whole of decision 3
  exists to say so. It closes the usability hole for the construction branch, not the release gate.
- Not that the tool can prevent its own misuse: a deterministic, branch-blind gate cannot know a
  green is being read as "done". It makes the honest signal available and states the contract; the
  wiring stays a human decision.
- Not that anything changes at the seal, the six phases, `GATE_NON_SCOPE`, or the 0/1/2 contract:
  all unchanged; `--through` narrows the phase set fed to the existing arithmetic and adds JSON
  fields, nothing more.
- Not that this ADR crosses a phase: it is cited by no manifest and crosses no phase
  ([ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) decision 4).
  `node dist/cli.js check --strict` measured exit 0 on this repository on 2026-08-13 before this
  file; it must read exit 0 after.

## Ratification

Accepted (header, 2026-08-13). The bar it had to clear — all of the following passing in CI, on the
built binary, each test red before its change and green after (the
[ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md) /
[ADR-0051](ADR-0051-the-gate-is-made-as-strong-as-its-headline.md) pattern):

1. **Prefix green mid-construction.** On a mission crossed through floor but with Govern/Handover as
   raw templates, `check --through floor --strict` exits 0, while plain `check --strict` exits 1; the
   run names the deferred phases and `--json` carries `through`, `horizon.deferred` (non-empty),
   `gaps.deferred > 0`, `currentGate` = the first open phase, `steadyState` = false.
2. **The floor holds, both directions.** With the same horizon, reverting a phase-≤-K deliverable to
   its template, editing a rule file, breaking the seal, or dropping a `DRAFT` ADR each reds
   `check --through floor --strict` (exit 1). The topology case is explicit: a broken
   `execution-topology.md` reds `check --through architect --strict`, and is green only when the
   topology manifest is sound.
3. **Contract guards.** `check --through <id> --freeze` exits 2; an unknown `phase-id` exits 2.
4. **Whole-arc identity on the exit code.** On a strict-green mission, `check --through handover
   --strict` and `check --strict` return the same exit code (0); the identity test asserts the exit
   code only, not the JSON bytes.
5. **Global invariant.** `node dist/cli.js check --strict` on this repository exits 0 before and
   after; `test/unit/no-overclaim.test.js` stays green (this ADR argues against false greens, it
   does not assert one).

**Ratification record (2026-08-13).** All five proofs pass on the built binary, in
`test/unit/verdict.test.js` (ten cases under the "ADR-0053" heading). Red-before / green-after was
demonstrated by measurement, not asserted: with the phase scoping neutered (`countGaps` and
`judgeGated` fed `null` instead of the resolved horizon), the three cases that assert the new
semantics — the UX-hole-1 prefix certification, the topology fold, and the additive `--through
--json` payload — turn red, while the cases that assert preserved invariants (the floor still reds
below the horizon, the global corpus / seal / unratified checks still red, the whole-arc identity,
the fail-loud on an unknown id, the CLI misuse guards) stay green; restoring the scoping turns all
ten green. `node dist/cli.js check --strict` on this repository read exit 0 before and after. The
mechanism ships in the release that carries this file; until that release, the flag is present on
`main` under this accepted, tested contract.

## References

- [ADR-0033](ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md) — deferred this exact signal to "its own decision"; this ADR is that decision
- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — the anti-paperwork doctrine and "the run is the exit code, not the sentence next to it", the false green decision 3 exists to refuse
- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) / [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the fixed 0/1/2 exit port, unchanged
- [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md) — the additive-only `check --json` contract the new fields respect
- [ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md) / [ADR-0029](ADR-0029-mcp-is-a-discovery-boundary-never-an-enforcement-path.md) — the CI required-check tier `--through` must not become the sole gate of
- [ADR-0047](ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md) — the verdict stays on a seam a test can reach, which the jq-wrapper alternative fails
- [ADR-0051](ADR-0051-the-gate-is-made-as-strong-as-its-headline.md) — sibling product-review decision on the gate's depth; independent axis (depth vs horizon)
- [ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md) — the first-pilot dependency that hits this hole on day one
