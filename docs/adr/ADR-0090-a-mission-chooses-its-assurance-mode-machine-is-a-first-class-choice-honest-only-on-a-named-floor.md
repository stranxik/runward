# ADR-0090 — A mission chooses its assurance mode: machine is a first-class choice, honest only on a named floor of machine controls and with its blind spots measured

**Date**: 2026-10-12
**Status**: accepted (2026-10-12) — constitutional, class R under ADR-0088 decision 2 (it changes the
charter, the gate's delegation surfaces and the public claim ceiling). The maintainer accepted the
record with the three recommended answers: (1) the ladder `machine`, `machine+critical`, `sampled`,
`per-act` and the charter field `mode:`, the weekly sample becoming opt-in; (2) runward's own mission
runs `machine+critical`, displayed « degraded » until its machine floor is complete, and the regulated
tier leaves runward's own lock (option (b) of ADR-0088 decision 4); (3) an incomplete machine floor is
disclosed on every surface, and a strict gap only under the regulated tier. One refinement came from
the session that put the decision: runward's critical list is narrowed to the verdict path and the
trust roots (decision 10). An agent wrote this record and only records the decision; the maintainer
decided (ADR-0088 decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: the first sample period of ADR-0088 read at source (`runward/delegation-samples.jsonl`, PR
#376); `src/commands/sample.ts`, `src/lib/delegation.ts`, `src/lib/rules.ts`, `src/lib/claims-rules.ts`;
`test/audit-corpus.js`, `test/unit/manifest-fuzz.test.js`, `test/unit/verdict-metamorphic.test.js`,
`test/unit/template-command-freshness.test.js`, `test/unit/no-overclaim.test.js`,
`test/unit/regulated-posture.test.js`; `.github/workflows/{ci,verify-release,mutation-ratchet}.yml`;
`docs/compliance/mutation-register.md`; ADR-0046, 0059, 0060, 0072, 0080, 0087, 0088, 0089; read-only
`gh api` calls on 2026-10-12 (branch protection of `main`, the seed commit); first-parent merge commits
on `main` from 2026-09-01 to 2026-10-12 counted with `git log --first-parent --merges` and matched
against path lists with `git diff --name-only <merge>^1 <merge>`. All measured on `origin/main@5ad619f`.
The regulatory texts are not re-read: this record relies on ADR-0088 Context, read 2026-10-01
**Relates to**: [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md),
[ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md),
[ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md),
[ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md),
[ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md),
[ADR-0072](ADR-0072-an-unknown-is-surfaced-never-refused.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0087](ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md)
**Amends, by name** (ADR-0088 carries a dated note pointing here; its decisions are not rewritten):
ADR-0088 decisions 1, 4, 6, 7 and 10.

## Context

**What the maintainer said.** On 2026-10-12, after the first period ended `control missed`: « c'est
infernal pour moi, et pour un utilisateur à terme » [this is hellish for me, and eventually for a user];
then « il faudrait un choix, plutôt que de dire on l'enlève. Ça devrait être full machine. Non ? »
[there should be a choice rather than removing it; it should be full machine, no?].

**What the first period measured.** Period 2026-10-02 to 2026-10-09: 14 acts in the population, 5
drawn plus 1 seed, all 6 accepted. The seed was a commit making Step 3 of
`docs/verifying-a-release.md` say the trusted root is not needed offline. Two facts about the control
itself:

- The review list prints, per item, one line: stratum, ref, date, actor, summary (`printReview`,
  `src/commands/sample.ts:257`). Only shipped-code merges get a `git show --stat` hint. The seed was
  shown as « docs(verify): tighten the offline verification wording ».
- The seed commit `0dfb2249…` is not on the forge: `GET /repos/stranxik/runward/commits/0dfb2249…`
  returns 422 "No commit found" (2026-10-12). Reading it required the planter's local repository.

So the control measured the review packet as much as the reviewer. That is a defect of the sampled
control whatever this record decides (decision 9).

**What the machine controls show, and whether any catches the seed's class** (a false instruction in
prose documentation).

| Control | Shows | Does not show | Seed class | Measured state |
|---|---|---|---|---|
| Strict self-gate | every expected rule has a row; cited evidence resolves, is non-empty, has not drifted | that evidence implements the rule (`GATE_NON_SCOPE`); meaning | no | required (`test`) |
| Unit and integration suite | the behaviours the tests describe | a requirement the tests misread; documentation | no | 185 unit files, smoke, OSCAL, in-toto, SARIF shape |
| Attack corpus AC-001..017 | 13 named attacks on evidence refused, 4 honest cases accepted | any attack outside the corpus | no | required |
| Manifest fuzz | 500 generated manifests, fixed seed, no false green | anything outside the manifest | no | required |
| Metamorphic relations (#365) | 8 necessary properties of the verdict on generated missions | that any single verdict is right | no | 3 generated missions per relation in CI (`RUNWARD_MR_RUNS` default) |
| Mutation ratchet and register | the register still describes the code (freshness) | a level: the survivor list may grow and pass (ADR-0059) | no | 1858 survivors, 1413 filed `hole` (820 "could not clear", 170 "not yet instructed"); pass 2 stale on 20 modules, never run on 4 (`delegation`, `delegation-sample`, `identity`, `citations`); `check.ts` outside the perimeter; runs on release only, not required |
| Coverage floor (85 %) | line coverage does not drop more than 3 points | assertion quality | no | not required |
| Witness (`check --strict --witness`) | the facts a verdict relied on, written down | anything until a checker re-checks them | no | emitter shipped (0.43.1, #366); the independent checker is not built; the CI self-gate does not pass `--witness` |
| `verify-release.yml` | the verification commands work on the published release, offline step included | that the documentation says the same: the commands are copied into the workflow, not extracted from the doc; it runs after a release, not on the pull request | no, as built | no test ties the doc's fenced blocks to the workflow |
| Claims guard (`claims-rules.ts`) | no forbidden overclaim on the shipped surface | a false instruction; any line containing "not", "no", "never"… is exempt (`NEGATED`), which exempts the seed's sentence | no | required |
| `template-command-freshness` | every `runward` command a template cites exists | docs; `gh` or `cosign` commands | no | required |
| Delegation stop | when raised, no delegate pull request merges | the quality of an act | no | required |
| Branch protection | required checks: `test (22)`, `test (24)`, `floor-ts`, `core tests, network-isolated`, `delegation stop` | reviews are not required; signatures are not required; `enforce_admins` is off, so an administrator account (in stage 1, an agent holding the maintainer's token) can merge past a red check | no | read 2026-10-12 |
| Provenance, attestations, immutable releases | these bytes came from this workflow and commit | anything about content | no | in place (ADR-0048, 0049, 0085) |
| Qualification kit | a user re-runs the evidence | documentation correctness | no | shipped (ADR-0087) |

No machine control in force today catches the seed's class.

**What no machine control catches today.** (1) Whether a prose sentence is true, in docs, ADRs or the
README. (2) Whether a documented command still works, at pull-request time. (3) Design intent. (4)
Whether an ADR's decision is right: the gate reads presence and status, never merit. (5) A wrong
requirement with green tests; ADR-0089 says it of its own differential test: agreement is not
correctness. (6) The net weakened in the same change: nothing refuses a deleted test, a removed AC
case, a dropped relation or a lowered `numRuns` (none happened between 2026-09-01 and 2026-10-12;
nothing forbids it), the coverage floor is not required, and the ratchet lets survivors grow. (7) The
quality of evidence (`GATE_NON_SCOPE`) and, in stage 1, who acted. Items 1, 3, 4 and 5 are judgement:
no mode settles them; `per-act` assigns them to a person, which is a different thing. Items 2 and 6
can become machine checks.

**The volume a mode must carry.** 132 first-parent merge commits on `main` from 2026-09-01 to
2026-10-12, about 22 a week (the draft put to the maintainer said 133; re-counted for this record with
`git log --first-parent --merges`, it is 132, and the two figures below reproduce exactly; 15 further
first-parent commits in the same window are squash merges and are outside this population). 57 touch
the charter's current `pre-merge-paths` (48 without `README.md` and `package.json`); 82 touch `test/`.
Adding the net's own files (corpus, generator, fuzz, relations, Stryker configuration, mutation scripts
and register, claims rules) to the pre-merge list raises it to 78 in the draft's measure, 75 of 132 in
this record's reconstruction of that file set.

**What the texts require** (ADR-0088 Context, read 2026-10-01). DORA art. 9(4)(e) wants every change
approved; RTS 2024/1774 art. 17(1)(b) wants the approving function independent from the requesting and
implementing ones. AI Act art. 14 is a design obligation on providers of high-risk systems for
oversight of the system in use; it does not by itself settle how a system's code changes are approved
(AI Act art. 17, quality management, not read). NIST AI 100-1: "Some AI systems may not require human
oversight". ADR-0088 already states the charter-and-sample model is not a DORA change-approval control.

## Decision

**A mission declares one assurance mode for its delegated acts (class D), from a fixed ladder; the
gate computes the mode actually in force from what it can read, prints both, and never prints a
stronger mode than the one in force. Classes R, H and I are unchanged in every mode.**

1. **The ladder.**

   | Mode | The person, on class D | Estimated load at the measured volume | What the gate checks |
   |---|---|---|---|
   | `machine` | nothing per act; signs the charter and the machine floor (class R) | none for D; R, H, I unchanged (30 to 60 minutes a week, not measured) | the machine floor (decision 3) |
   | `machine+critical` | approves before merge the paths and events the charter names | about 8 to 10 reviews a week with the current list, 5 to 15 minutes each (estimate; see decision 10 for runward's list) | the machine floor, and a declared approval on every critical merge |
   | `sampled` | reviews a drawn sample plus seeds each period (ADR-0088 decision 6) | 20 to 40 minutes a week (estimate) | the sample chain, as today |
   | `per-act` | approves every act before merge | about 22 acts a week, 2 to 5 hours (estimate) | a declared approval per act; under the regulated tier, ADR-0080 Part 2 |

2. **The words, at the character,** on `check`, `check --json` (`delegation.assurance`), the SARIF run
   properties, the delivery report and `doctor`, beside the unchanged stage and charter banners:
   - `machine`: « assurance: machine. No person reviewed delegated acts; they passed the machine
     controls listed, which do not judge prose, design intent, decisions or requirements »
   - a `machine` or `machine+critical` mode whose floor is incomplete: « assurance: <mode>, degraded.
     Not in force: <controls>. Delegated acts rest on fewer controls than the mode names »
   - `machine+critical`: « assurance: machine+critical. A person approved, before merge, the changes
     the charter names as critical; every other delegated act rests on machine controls only »
   - `sampled`: « assurance: sampled. A person reviewed <k> drawn acts and <s> seeded defect(s) per
     <d>-day period; last period: <passed | rejected | control missed | unsampled since <date>> »
   - `per-act`: « assurance: per-act. Every delegated act carries an approval declared by a person
     before merge »
   - every machine mode also prints its seed counter (decision 4): « machine seeds: caught <x>/<y>;
     missed classes: <classes | none> ».
   While stage 1 holds, every mode is declared, not proved, and the stage banner says so.

3. **The machine floor.** runward fixes it; a charter may add controls, never remove one.

   | # | Control | Exists today |
   |---|---|---|
   | M1 | strict self-gate as a required check | yes |
   | M2 | full suite, attack corpus, manifest fuzz and metamorphic relations as required checks, the relations' run count set from a CI measurement | yes; relations at 3 runs |
   | M3 | a net-monotonic guard: no test file deleted, no AC case removed, the eight relations present, no `numRuns` lowered, the coverage floor required; a shrink is an escalation event, not a refusal | built 2026-10-13, pending merge; the coverage floor not yet a required check (see the note at the end) |
   | M4 | the ADR-0089 witness checker run on the CI self-gate | emitter yes, checker no |
   | M5 | the mutation ratchet fresh at each release, pass 2 current on the perimeter | partial |
   | M6 | a documented-commands guard (decision 5) | built 2026-10-13, pending merge (see the note at the end) |
   | M7 | machine seeds (decision 4) | no |
   | M8 | required checks enforced for administrators, and the forge posture read by a CI step outside the verdict path and attested, as ADR-0080 Part 2 does | no (`enforce_admins` off) |

   The gate reads M1 to M7 from the tree (files present, the workflows that call them, committed
   reports and their freshness). It reads M8 from the attested posture; locally it prints « forge
   posture: not verified by this command ». The verdict path still opens no socket, runs no git and
   reads no clock (ADR-0054).

   **Chosen (the maintainer's decision 3): a degraded machine mode is disclosed on every surface, not
   refused** (ADR-0060, ADR-0072); it is a strict gap only under the regulated tier (decision 7).
   Discarded: a strict gap `assurance-mode-unmet` whenever the floor is incomplete, which would keep
   runward's own strict gate red until step 7 of the order below.

4. **The seed stays; in machine modes the machine is the reviewer.** Each period an agent opens a seed
   pull request whose defect class is drawn, with the drand randomness ADR-0088 decision 6 already
   uses, from a taxonomy the charter fixes (`seed-classes:`, for instance prose-instruction,
   documented-command, test-weakened, logic-inverted, adr-contradiction). It is never merged. The
   ledger records whether a required check refused it, with the run's URL (declared; the forge step of
   M8 can attest it). A missed machine seed does not turn the gate red: its class is published as a
   blind spot in the seed counter. Drawing the class keeps the planter from planting only what the
   net already catches. An LLM reviewer may run in CI as one more leg, advisory only and outside the
   verdict path (ADR-0001; ADR-0007 already keeps LLM verification advisory); its catch rate on seeds
   is published like any leg's, and it never counts toward the floor.

5. **Two human checks become machine checks.**
   - *Documented commands.* A parity test: every fenced `sh` block of `docs/verifying-a-release.md`
     matches, up to the version and repository, a step of `verify-release.yml`, and every step matches
     a block. A pull-request job, triggered when that file changes, extracts the blocks, runs them
     against the latest published release, Step 3 under `unshare -n`. A seed that removed the trusted
     root from the commands fails it; a seed that changed only the sentence does not, and the
     `machine` sentence says prose is not judged. The seed's diff is not on the forge, so which of the
     two the first seed was is not known.
   - *Escalation by event, not by path.* M3 makes "the net shrank" an escalation event; only those
     changes wait for a person, instead of adding the net's files to a path list.

6. **The charter.** `mode:` with values `machine`, `machine+critical`, `sampled`, `per-act`; optional in
   `runward-delegation/1`; absent reads `sampled`, so no existing charter changes meaning silently; an
   unknown value is `charter-malformed`. Optional `machine-controls:` (additions to the floor, closed
   vocabulary) and `seed-classes:`. The `sample-*` fields are required only in `sampled`. `pre-merge-paths`
   and `pre-merge-events` become the critical list of `machine+critical`, with the new event « the net
   shrank ». Changing `mode:` is a widening when it moves down the ladder and needs its own signed
   commit (ADR-0088 decision 5).

7. **The regulated tier.** Under `"regulated": true`, only `per-act`, or `sampled` with the
   `singleAccountable` exception of ADR-0088 decision 4, count. A `machine` or `machine+critical` mode
   under the tier is a named strict gap, `assurance-mode-regulated`. `per-act` is the only mode that
   can sit under DORA RTS art. 17, and only with ADR-0080 Part 2 and an approving function independent
   from the requesting one; with one accountable person that independence does not exist, and every
   surface says « not a DORA change-approval control » as ADR-0088 already requires.

8. **New strict gaps.** `assurance-mode-regulated` (decision 7); `critical-unapproved` (in
   `machine+critical`, a critical merge with no declared approval). A degraded machine mode is
   disclosed, not refused (decision 3).

9. **The sampled mode is repaired whatever the choice.** The review list carries each item's diff
   (`git show` of the item, not a summary line), and a seed must be fetchable from the forge before the
   draw; a seed that is not is `sample-malformed`.

10. **runward's own mission (the maintainer's decision 2, with the session's refinement).**
    - **Mode: `machine+critical`**, printed « degraded » until M3, M4, M6, M7 and M8 are in force.
      Reasons: the gate, verification and evidence are what runward offers, so changes to them stay
      before the maintainer's eyes; pure `machine` would let the agent change the agent's judge; the
      sampled control measured its packet as much as its reviewer.
    - **The critical list, narrowed to the verdict path and the trust roots:**
      `src/lib/{conformance,evidence,verdict,witness,delegation,delegation-sample,identity}*`,
      `src/commands/{check,ratify,propose,wire}.ts`, `src/lib/harness.ts`,
      `plugins/runward-gate/hooks/**`, `.github/**`, `package.json`, `runward/scaffold-lock.json`,
      `runward/delegation.md`, `SECURITY.md`, `AGENTS.md`, and `allowedSigners` once it exists (a trust
      root under ADR-0088 decision 2; no such file is in the tree today). `README.md` leaves the path
      list; README claims stay a pre-merge event, and the claims guard keeps reading the file. The
      other `pre-merge-events` are unchanged, plus « the net shrank » (decision 6).
    - **What the narrowed list measures, said as it is.** Over the same 132 merges, the narrowed list
      would have caught 59, two more than the current list's 57: it is narrower in surface (README out)
      but wider in substance, because it adds the witness, the charter reader, the sample and the
      identity modules and `src/commands/check.ts`, and `check.ts` alone is touched by 21 of the 132
      merges (the sole hit on 3). 56 merges are caught by both lists, 1 by the current list only, 3 by
      the narrowed one only. Without `check.ts` the narrowed list catches 56; without `package.json`
      51; without both 48. `package.json` is the sole hit on 8 merges, four of which are version bumps
      (three on release branches). The load for runward therefore stays at about 10 reviews a week
      (59 merges over six weeks) until the list is re-measured; the list is
      recorded as decided, and its exact paths are fixed in the charter switch (step 8 below, class R),
      re-measured then.
    - **The regulated tier leaves runward's own lock** (option (b) of ADR-0088 decision 4, replacing
      option (a) chosen on 2026-10-01). Reason: the `singleAccountable` exception rests on a passing
      signed sample, a control runward's own mission no longer exercises in `machine+critical`. The
      tier stays exercised by the tests, the attack corpus and the example missions, and the README
      says so. Removing `"regulated": true` from `runward/scaffold-lock.json` is a lock opt-in, class R,
      done in the charter switch, not by this record.

**Amendments to ADR-0088, by name.** Decision 1: the stage banner stays; an « assurance » line is added
on every surface. Decision 4: the regulated tier requires `per-act` or `sampled`; for runward's own
lock, option (b) replaces option (a) (decision 10). Decision 6: the weekly sample becomes the `sampled`
mode, opt-in; an absent `mode:` reads `sampled`, so no existing charter changes meaning; "two missed
periods" applies only in `sampled` and to the `singleAccountable` exception. Decision 7: the pre-merge
list is the critical list of `machine+critical`. Decision 10: public claims follow the mode in force;
the claims guard gains the mode's ceiling (no "validated by a person" for acts outside the person's
mode).

**What it is honest to say publicly.**

| Mode | Honest | Refused |
|---|---|---|
| `machine` | "Agents deliver; machine controls gate each act; a person owns the policy and every irreversible act." | "validated by a human", "verified", and any word the claims guard already refuses |
| `machine+critical` | the above, and "a person approves changes to the gate and its trust roots before merge" | the same |
| `sampled` | "a person reviews a random sample each period, with a planted defect that measures the review" | "every change is reviewed" |
| `per-act` | "every change is approved by a person before merge" (declared in stage 1) | "independent approval" with one accountable person |

runward's premise reads, under this record: the person validates the policy, the trust roots and every
irreversible act in every mode; per act, per sample, or not at all for class D, as the mode says.

**The maintainer's decisions** (2026-10-12, each as recommended).

1. **Adopt the ladder and `mode:`**, the sample becoming opt-in, the mode governing class D only.
   Discarded alternative: keep the weekly sample mandatory and repair its packet only.
2. **runward's own mode and lock:** `machine+critical`, printed degraded until M3, M4, M6, M7 and M8 are
   in force, with the critical list narrowed (decision 10); option (b) of ADR-0088 decision 4.
   Discarded alternative: keep the tier and `sampled`, with the repaired packet (decision 9).
3. **A degraded machine mode is disclosed** on every surface, a strict gap only under the regulated
   tier. Discarded alternative: `assurance-mode-unmet` whenever the floor is incomplete.

**Implementation order.** (1) This record decided (this pull request: the record, a dated note on
ADR-0088, the ROADMAP and CHANGELOG; no CLI, charter or lock change). (2) M6, the documented-commands
guard. (3) M3, the net-monotonic guard, and the coverage floor made required. (4) M4, the witness
checker in CI (already decided by ADR-0089). (5) `mode:`, the mode in force, the sentences, the claims
guard. (6) M7, machine seeds; decision 9, the repaired sample packet. (7) M8, `enforce_admins` and the
attested forge posture. (8) runward's charter switched to `machine+critical` with the narrowed list,
and `"regulated": true` removed from its lock, in their own signed commit (class R). (9) ADR-0088 stage
2 remains the only path to a word stronger than "declared".

## Alternatives discarded

- **Remove the sample and say nothing else.** Leaves a mode with no measured blind spots: the rubber
  stamp this record exists to avoid, with a machine holding the stamp.
- **Keep the weekly sample mandatory for every mission.** The maintainer's own measure: hellish for one
  person, and for an adopter. Kept as an opt-in mode.
- **Pure `machine` for runward itself.** The agent could change the gate, the corpus or the witness in
  the same change it is judged by; M3 narrows this, it does not close design intent.
- **Add every file of the net to the pre-merge list.** 78 of 133 merges in the draft's measure (75 of
  132 in this record's reconstruction); the bottleneck restored. Replaced by the net-monotonic event.
- **Count an LLM review toward the floor.** Non-deterministic and outside ADR-0001's core; its value is
  measured by seeds, not assumed.
- **Let the charter remove controls from the floor.** The audited party would set its own floor.
- **Treat `machine` as compatible with DORA.** Every change must be approved by an independent function;
  no machine mode meets that, and no surface says otherwise.
- **Keep the regulated tier on runward's own lock under `machine+critical`.** The `singleAccountable`
  exception would rest on a sample no longer drawn.

## Consequences

- A mission can run with no per-act human review and say so in words that do not overclaim; the
  person's recurring work moves to the policy, the floor, the trust roots and irreversible acts.
- The seed becomes a permanent measurement of the machine's blind spots, published per defect class;
  the prose class is expected to stay missed until a reader of meaning (a person, or a measured LLM
  leg) is in the loop, and the counter will show it.
- Cost: a net-monotonic guard, a documented-commands job, the witness checker in CI, a seed workflow,
  a forge-posture step, the `mode:` field and its surfaces. `enforce_admins` on also binds the
  maintainer's account.
- runward stops dogfooding the regulated tier on its own mission, and says so in the README once the
  lock changes (step 8).
- The narrowed critical list does not lower runward's measured pre-merge load (59 of 132 against 57);
  the gain is in what the list names, not in how often it fires.
- Nothing here makes any mode more than declared while ADR-0088 stage 1 holds.

## What would settle it

- Four periods of machine seeds: catch rate per class, and whether the prose class is ever caught by a
  machine leg.
- The documented-commands job run once against a re-planted copy of the first seed, both variants
  (command changed, sentence only).
- The relations' run count measured in CI (ADR-0089 asks for it).
- `enforce_admins` measured on the lab repository against the release chain of ADR-0085.
- The maintainer's weekly minutes in `machine+critical`, and the critical list's actual hits, published
  after four weeks.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-01-12, or earlier on: a defect reaching a release that a machine seed class covered; the
prose class caught by a machine leg in two consecutive periods; a second maintainer joining
(independence becomes possible and `per-act` changes meaning); an adopter under DORA asking for a mode;
ADR-0088 stage 2 holding; the critical list firing on more than half of runward's merges over four
weeks.

**Trigger set on**: 2026-10-12 · **Watched via**: the seed counter on `check`, the weekly digest.

## References

- ADR-0088 Context, "What the texts require" (DORA art. 9(4)(e), RTS 2024/1774 art. 17, AI Act art. 14
  and 26, NIST AI 100-1, SLSA v1.2), read 2026-10-01; not re-read for this record.
- Branch protection of `main`: `GET /repos/stranxik/runward/branches/main/protection`, 2026-10-12.
- The seed commit: `GET /repos/stranxik/runward/commits/0dfb2249ab189453c0d86cd68ddc43d3bd913818`, 422,
  2026-10-12.
- The first period: `runward/delegation-samples.jsonl`, PR #376.
- The merge counts: `git log --first-parent --merges --since=2026-09-01 origin/main` at `5ad619f`,
  each merge's files from `git diff --name-only <merge>^1 <merge>`, matched against the current
  `pre-merge-paths` of `runward/delegation.md` and the narrowed list of decision 10, 2026-10-12.

## Note, 2026-10-13: M6 built (step 2 of the implementation order)

Built as decision 5 describes, in two halves. This note records what was built; it decides nothing.

- **The parity test**, `test/unit/documented-commands.test.js`, in the required suite, no network. Every
  `gh` command of the guide's Steps 2, 2c, 3 and 7 must be run by the workflow step of that name in
  `verify-release.yml`, and every `gh` command of a workflow step named "Step …" must be documented in
  the guide's step, after a declared normalisation (example versions `0.33.3`, `0.33.4`, `0.33.5`,
  `X.Y.Z`; the repository and tag variables); flags compare as a set. Step 0 is compared in substance
  only, and one Step 2 command (gh's default predicate) is declared guide-only. Positive controls in the
  test: `--custom-trusted-root` dropped from Step 3 fails naming Step 3, in both directions; Step 2c's
  signer workflow changed, or its predicate dropped, fails naming Step 2c; a workflow-side drift fails
  naming the workflow step. One narrow prose check is added: a "N files suffice: …" sentence must list
  N items, and they must be the files the step's offline command names. It catches the seed if the seed
  rewrote that sentence to two files; it does not catch any other sentence, and a test pins that blind
  spot (a sentence added to Step 3 saying the trusted root is not needed offline passes).
- **The execution job**, `.github/workflows/documented-commands.yml` over
  `scripts/documented-commands.mjs`: it extracts the commands of Steps 0, 2, 2c, 3, 7 and 8 from the
  guide, substitutes the latest published release, and runs them; every command carrying `--bundle`
  (Step 3, Step 8's offline line) runs under `sudo unshare -n`, after a check that the same request
  answers outside the namespace and fails inside it. Each step has a positive control (one flipped byte
  in the tarball, or the kit for Step 8, must fail; Step 0's digests must then differ); Step 3 without
  `--custom-trusted-root`, network cut, must fail; `gh release verify` on v0.42.3 must fail; the kit's
  runner must exit 0 on the installed release and 3 after one installed byte changes. Steps 1, 4, 5 and
  6 are not executed, each with its reason. It runs on pull requests touching the guide, the verify
  workflows, the runner or the kit, and weekly. It is not a required check: that is the maintainer's
  setting.
- **Measured, 2026-10-13, on macOS with the network denied by `sandbox-exec`, against v0.43.1:** 31 of
  31 expectations held. The re-planted seed, both variants ("What would settle it"): with
  `--custom-trusted-root` removed from Step 3's command, the job's Step 3 fails (offline, exit 1) and
  so does the parity test; with only the sentence changed to "Two files suffice: the tarball and the
  bundle …; the trusted root is not needed offline", the job passes (7 of 7 on Step 3) and only the
  narrow prose check fails. Which variant the first seed was stays unknown.

## Note, 2026-10-13: M3 built (step 3 of the implementation order)

Built as decision 3's row M3 and decision 5 describe. This note records what was built; it decides
nothing.

- **The guard**, `scripts/net-shrink.mjs`, run by `.github/workflows/net-shrink.yml` on
  `pull_request_target` from the default branch's copy, read-only; the pull request's files are read
  with `git show`, never run. It compares the head with the merge base and reports as a shrink: a test
  file deleted; a case removed from `reports/junit.xml`; an attack corpus identifier retired or no
  longer declared; a relation MR-n no longer checked; a `numRuns`, `RUNS` or RUNWARD_MR_RUNS default
  lowered; fewer fast-check properties, or fewer assertion calls, in a test file; a coverage floor
  lowered, or the coverage job no longer running; a module or `mutate` entry gone from the mutation
  perimeter; a `skip` or `todo` added. A rename is a removal plus an addition: it is paired, and
  reported as a note, only when the same file declares a new name sharing at least half its words;
  unsure is a removal. Positive controls for each kind and a pure-addition control are in
  `test/unit/net-shrink.test.js` (TOR-213 to TOR-216).
- **The escalation and its acknowledgment.** The check fails until the label `net-shrink-acknowledged`,
  last applied by an account with admin permission that is not a delegate identity, sits on the pull
  request with a body line `Net shrink acknowledged: <fingerprint> <kinds>` naming the exact shrink.
  Stage 1, said as it is: an agent holding the maintainer's credential can apply the label and write
  the line; the label event and the line are a trace on the forge, declared, not proved.
- **Not done here, the maintainer's settings:** `net shrink` and the coverage job
  `coverage does not go down` made required checks (M3 asks for the coverage floor required; on
  2026-10-13 the required checks of `main` are the two test legs, floor-ts, the offline core and the
  delegation stop), and the label created.
- **Measured, 2026-10-13, as a dry run** over the last 150 merges of `main` (each PR's head against its
  merge base): one would have escalated, #326, whose eight test names were translated from French; the
  guard cannot pair a translation, so it reported the removals as it is built to. None of the last 30
  would have escalated; two renames over the 150 were paired as notes. Reversed (a merge's head as
  the base), #380 and #365 escalate as expected (test files deleted, cases removed, the eight relations
  removed). What it does not see: a test weakened without losing an assertion call, a generator
  narrowed, an assertion made always true. It reads names and counts, not meaning.


## Note, 2026-10-13: the work order gains the claims layer (ADR-0092, proposed)

After M3, the maintainer added to the work order, as its next items: (1) executing Steps 1, 4, 5 and 6
of the verification guide, which no job runs today; (2) making the important factual sentences of the
documents that bind checkable, with a detector for the untagged ones. Item 2 is drafted as
[ADR-0092](ADR-0092-a-claims-layer-factual-sentences-are-tagged-typed-and-sealed-the-rest-is-said-unchecked.md),
`proposed`: tagged, typed and sealed sentences, a coverage rule phased in on a measured waiver cost,
and a seed plan fixed before anything is built. It is the measured answer this record's Consequences
expected for the prose class, bounded to sentence shapes; free prose stays unchecked. This note
records the order; it decides nothing, and the floor M1 to M8 is unchanged.
