# ADR-0044: generated harness artifacts are refreshed, not owned

**Date**: 2026-08-04
**Status**: accepted (ratified 2026-08-04 — see Ratification)

## Context

A field report from a mission built with runward exposed a defect that had been shipping since
`init` first wrote phase skills. The mission's `.agents/skills/` had been laid down by
`runward init 0.14.1`; the installed package was `0.31.0`. **Seventeen releases apart, and nothing
signalled it** — not `check`, not `doctor`, not `status`, not `update`.

`runward update` refreshes `runward/workflows/`, `runward/rules/` and `runward/adapters/`
(`src/commands/update.ts`). Phase skills are written by `init` to `.agents/skills/` and, per tool
profile, to `.claude/skills/`, `.junie/skills/`, `.trae/skills/`. None of those were in the loop.
The scaffold lock ([ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) is the seal; the
lock is `src/lib/scaffold-lock.ts`) did not record them either, so even drift detection was blind.

**The consequence was not cosmetic.** The 0.14.1 skill described evidence as *"applied with a
file:line or test"* — prose. It named neither the typed pointer grammar the gate verifies
(`file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`), nor `runward explain`, nor `manifest --sync`,
nor signed rules. The reporting mission consequently wrote **24 `applied` rows in prose**, which
`check --strict` accepts and cannot verify ([ADR-0004](ADR-0004-advisory-drift-detection-of-applied-pointers.md):
prose stays the operator's judgment). An entire mission produced unverifiable evidence because a
generated file was never refreshed. Their agent's own words on discovering it: *"I did not know the
command existed."*

**Why it was missed on 2026-08-01.** That day, `update`'s boundary was examined and defended: it
does not touch `AGENTS.md`, which is correct, because `AGENTS.md` is a mission deliverable the
operator owns ([ADR-0010](ADR-0010-agents-md-as-a-first-class-handover-deliverable.md)). The
question asked was "is this file right to exclude?". The question **not** asked was "what else is
excluded?". A boundary was validated without taking its inventory — the same species as the release
stamp guard corrected the same week, which checked a hand-kept list that could be incomplete
without failing.

## Decision

**A generated artifact is refreshed by `update`. Only what the operator can personalise is left
alone. The distinction is authorship, not location.**

- **Phase skills are refreshed**, wherever they already exist. They are wholly derived from
  `PHASE_SKILLS` and `skillBody` in `src/lib/tools.ts`: there is no field an operator could fill,
  so freezing them at the version that ran `init` was a classification mistake, never a decision.
- **`AGENTS.md` stays untouched**, and this ADR does not weaken that. It is a deliverable the
  operator edits and hands over. The boundary is not "inside `runward/` vs outside", it is
  "generated vs authored".
- **Homes are discovered on disk, and derived from what `init` writes.** `existingSkillDirs()`
  probes `TOOL_PROFILES` for any path under a `skills` directory rather than restating a list, so a
  profile that ships skills under a new directory is covered the day it is added. `update`
  refreshes homes that **exist**; it never creates one, because it reads the mission repo and does
  not decide the harness layout ([ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md)).
- **The lock records them**, with root-relative, dot-prefixed keys that cannot collide with the
  mission-relative keys (`rules/x.md`). A skill the operator did edit is therefore reported as
  `kept (you edited it)`, exactly like a rule.
- **No record means refresh, for these files only.** A mission predating skill tracking has no
  hash to compare against. For an authored file, runward says it cannot tell
  ([the 0.28.0 rule](../../CHANGELOG.md)); for a generated one, refreshing cannot destroy work that
  no one could have done, and leaving it stale is the failure this decision ends.
- **`init` writes the lock after the skills**, not with the rules. Recording keys discovered on
  disk before the files exist records nothing — which is precisely how they escaped the lock at the
  start. Found by testing the fix, not by reading it.

## Alternatives discarded

- **Leave skills alone, symmetric with `AGENTS.md`.** That is the status quo, and it is what caused
  the report. Symmetry of location is not symmetry of authorship.
- **Have `check` or `doctor` warn on a stale skill.** It puts a behavioural observation in the gate's
  orbit, and it informs about something the tool could simply fix. `update` already exists for
  exactly this.
- **Regenerate skills on every command.** Writing outside `runward/` without being asked breaks
  "reads never mutate" (`runward/contracts/port-contract.md`).

## Consequences

- **Positive.** A mission that runs `update` after upgrading gets the current method in its harness,
  not the one that happened to be installed the day it was created. The report's root cause is
  closed at the source rather than per mission.
- **Positive, wider.** The rule now readable in one line — *generated is refreshed, authored is
  kept* — decides the next artifact without a new ADR.
- **Negative, accepted.** An operator who deliberately edited a skill on a pre-lock mission has that
  edit replaced on the first `update`. It is announced in the output, it concerns a generated file,
  and the alternative is leaving every affected mission stale forever.
- **Bounded.** This changes no gate behaviour, no exit code, and no verdict. `check --strict` is
  untouched.

## Ratification — 2026-08-04

Ratified by the maintainer on the field report. Delivered in the same increment: `update` covers the
skills, `init` records them, the skill text names the listing gesture (`rules --phase`, `rules --for`)
alongside the reading one, and four unit tests pin the properties. Two proven able to fail: removing
the listing gesture reddens its test, and restating the homes by hand reddens the derivation test.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) an operator reports a legitimately personalised skill being replaced — then the
generated/authored line needs a per-file marker rather than a directory rule; (b) a future artifact
is generated outside `runward/` and is NOT covered here, which would mean the derivation is again
too narrow; or (c) `AGENTS.md` acquires a generated section, which would break the file-level
granularity this decision assumes. Dated check: at the first groom after 2027-02-01.

**Trigger set on**: 2026-08-04 · **Watched via**: field reports on `update` output, and the skill
drift guard in `test/unit/skills.test.js`.

## References

- [ADR-0010](ADR-0010-agents-md-as-a-first-class-handover-deliverable.md) — the deliverable the operator owns, deliberately excluded
- [ADR-0018](ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) — the phase skills this decision keeps current
- [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) — reads the mission repo, never decides the harness layout
- [ADR-0004](ADR-0004-advisory-drift-detection-of-applied-pointers.md) — prose evidence stays the operator's judgment, which is why a stale skill was so costly
