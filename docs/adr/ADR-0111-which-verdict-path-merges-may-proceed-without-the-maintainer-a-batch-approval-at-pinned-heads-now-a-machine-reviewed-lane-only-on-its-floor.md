# ADR-0111 — Which verdict-path merges may proceed without the maintainer: a batch approval at pinned heads now, a machine-reviewed lane only on the floor it needs

**Date**: 2026-11-04
**Status**: proposed — constitutional, class R under ADR-0088 decision 2: it changes how the critical list of
`machine+critical` (ADR-0090 decision 6) is satisfied and would widen the charter. Written by an agent; under
ADR-0088 decision 4 the maintainer decides, and the agent's writing is disclosed throughput, not independent
review
**Deciders**: the maintainer
**Method**: `runward/delegation.md`; ADR-0088 decisions 4, 5, 7; ADR-0089 (the witness and its checker);
ADR-0090 decisions 1 to 4, 8 and 10 and its notes; ADR-0103 (`mutation:fresh`); `src/lib/delegation.ts` (the
floor reader); a search of `src/` for `critical-unapproved`; `stryker.config.json` (`mutate`). Measured on a
fresh clone at `main@b7d8c62`: the 75 first-parent merge commits on `main` from 2026-10-13 to 2026-10-28
(`git log --first-parent --merges --since=2026-10-13`), each one's files from
`git diff --name-only <merge>^1 <merge>`, matched against the charter's `pre-merge-paths` and against the
exclusion list of option 2 below, with `git diff --shortstat` and `git diff --numstat` for size
**Relates to**: [ADR-0082](ADR-0082-an-agent-may-ratify-under-its-own-name-never-under-a-humans.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
[ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md),
[ADR-0103](ADR-0103-the-register-records-the-source-each-module-was-measured-on-and-a-stale-one-refuses-the-release.md),
[ADR-0110](ADR-0110-the-app-may-change-and-dispatch-workflows-so-no-agent-acts-under-the-maintainers-identity-dispatch-is-a-closed-list-and-every-workflow-change-still-waits.md)
(proposed)
**Would amend, by name, once accepted**: none. Option 3 adds a way to give the approval ADR-0090's
`machine+critical` already requires; option 2, if ever chosen, would amend ADR-0090 decision 1 by adding a
mode, and is not recommended now

## Context

**What the mode in force requires.** runward's charter declares `mode: machine+critical`: a change to a path
in `pre-merge-paths`, or one of the `pre-merge-events`, waits for the maintainer before merge. ADR-0090's
sentence for the mode: « A person approved, before merge, the changes the charter names as critical; every
other delegated act rests on machine controls only ». The record kept the verdict path before a person's eyes
because « pure `machine` would let the agent change the agent's judge ».

**The question.** The maintainer is not available for every merge, and critical pull requests queue. Which of
them may proceed without the maintainer, without weakening a gate and without saying more than is proved?

**What the tree enforces today, said as it is.** The wait is a procedure, not a check. ADR-0090 decision 8
names a strict gap `critical-unapproved`; it is not built (no occurrence in `src/`). The branch protection read
on 2026-10-28 requires no review (ADR-0090's table). The floor reader returns every machine mode « degraded »
with all of M1 to M8 in `notInForce`, because it does not read the floor yet (`src/lib/delegation.ts`, "honest
on a missing reader"). The witness checker of ADR-0089, M4, is not built (no `checker/` in the tree). M7,
machine seeds, is not built. So today a critical merge waits because the delegates follow the charter, and
nothing in the gate would turn red if one did not.

**What the critical list carried, measured** (2026-10-13 to 2026-10-28, 75 merges, about 16 days):

| | Merges |
|---|---|
| touching at least one path of `pre-merge-paths` | 35 (about 15 a week) |
| touching `.github/**` | 18 |
| touching a path option 2 would exclude (below) | 28 |
| touching only the verdict code (`src/lib/{conformance,evidence,verdict}*`, `src/commands/check.ts`, `src/lib/harness.ts`) | 7 |

The 7 verdict-code-only merges changed 8 to 31 files and 83 to 1216 inserted lines. Counting inserted plus
deleted lines outside `test/`, `reports/`, goldens and the generated delivery report, 2 of the 7 stay under
300 (62 and 220 lines); the other 5 run from 310 to 631. Of the 28, 2 hit an excluded path through
`package.json` alone.

**What `mutation:fresh` means on a pull request.** ADR-0103: the check hashes each built module and compares
it with the digest its measurement recorded; any byte of a built module changes its digest. A pull request that
changes `conformance.ts`, `evidence.ts` or `verdict.ts` (all in the mutation perimeter) is therefore stale for
that module until the module is re-measured on the pull request's head (`mode=measure`, hours per module) and
the entry filed. `src/commands/check.ts` and `src/lib/harness.ts` are outside the perimeter: `mutation:fresh`
says nothing about them. ADR-0046 decision 3 keeps mutation off the pull-request gate; using it as a lane
condition is a choice about one lane, not a gate on every pull request.

## Options considered

1. **Keep `machine+critical` as it is (status quo), with batched review.** The maintainer approves each
   critical pull request; agents queue them and present them together. Cost: about 15 approvals a week at the
   measured volume, one gesture each; merges wait for the maintainer's availability. Nothing new to build;
   nothing new to claim. The wait stays unenforced until `critical-unapproved` is built.
2. **A `machine-reviewed` lane.** A pull request touching `pre-merge-paths` may be merged by the App, without
   the maintainer, only if all of:
   - every required check green on its first run, and no `pre-merge-event` on the pull request (a re-run makes
     it ineligible, ADR-0110 item 6);
   - `npm run build && npm run mutation:fresh` exit 0 on the head, which for a perimeter module means a
     `mode=measure` run on that head and its filing in the same pull request (ADR-0110's dispatch list allows
     the run);
   - an independent reviewer agent, in a session distinct from the author's, reports no blocking finding, and
     its findings are attached to the pull request. Under the rule that LLM review is consultative and never
     crosses a gate, the reviewer may only hold a merge back: its silence is a necessary condition, never an
     approval, and it is not counted in the floor (ADR-0090 decision 4);
   - the diff stays under a cap (proposed: 300 inserted plus deleted lines, outside tests, reports and
     goldens);
   - it touches no constitutional file. Proposed exclusion list: `runward/delegation.md`, `allowedSigners`,
     `runward/scaffold-lock.json`, `.github/**` (a workflow change writes its own required checks, ADR-0110
     item 5), `plugins/runward-gate/hooks/**`, `package.json` (scripts, `prepublishOnly`, dependencies),
     `SECURITY.md`, `AGENTS.md`, `src/lib/{delegation,delegation-sample,identity,witness}*` and the future
     `checker/**` and `docs/spec/witness.md` (the charter reader, the identities, and the witness the checker
     re-checks), `src/commands/{ratify,propose,wire}.ts` (the human and agent ratification paths and arming).
     What would remain eligible is the verdict code itself: `src/lib/{conformance,evidence,verdict}*`,
     `src/commands/check.ts`, `src/lib/harness.ts`; and that only once M3 and M4 are in force, because the
     only control that can say the verdict code still computes the verdict is a checker sharing no code with
     it (ADR-0089), and the only one that can say the net was not weakened in the same change is M3;
   - the merge is labelled « declared, not proved » in the weekly digest, and the witness of the next
     `check --strict --witness` lists the delegation family under `notWitnessed` until the checker re-checks
     it.

   **What this moves, plainly.** The residual moves from "a person read it" to "a machine and a reviewer agent
   read it". ADR-0090 calls that mode `machine`, and calls it honest only on a named floor the tree does not
   have yet: the floor reader is not built, M4 is not built, M7 is not built. So option 2 either waits for that
   floor, or ships now as a declared mode with the gap printed on every surface (« assurance: machine-reviewed,
   degraded. Not in force: … »). At the measured volume, and with the exclusion list above, it would have
   relieved at most 7 of 35 critical merges, and with the size cap 2 of them.
3. **A time-boxed batch approval at pinned heads.** The App opens one batch issue (or a pull-request comment)
   listing up to N queued critical pull requests (proposed N = 10), each with its head commit, its full diff
   link, its `git diff --stat`, its check runs, and the reviewer agent's findings when one ran. The maintainer
   answers with one line from the maintainer's own account, `Approved: <batch id> <pr>@<head> …` (or the same
   list minus the pull requests set aside), as a comment or a review. The App then merges each listed pull
   request only if its head still equals the approved commit and its required checks are green; a pull request
   whose head moved drops out and returns to the queue. A batch not answered within 72 hours expires: silence
   is never consent (ADR-0088 decision 7). The human act stays, one gesture per batch instead of per pull
   request; what it costs is the reading the gesture is supposed to carry.

## Decision

**Recommended: option 3 now, with the batch packet carrying each item's diff and the approval bound to each
head commit; option 2 deferred until M3, M4 and the floor reader are in force, then reopened on its measured
yield, never shipped before as a declared mode.**

1. **Why not 2 now.** It would put a machine on the verdict path while the one control that can judge verdict
   code, the ADR-0089 checker, does not exist, and print « degraded » for exactly the reason ADR-0090 refused
   pure `machine` for runward. And it buys little: 7 of 35 critical merges at most, 2 under the size cap. A
   declared mode with a printed gap would be honest in words and still the change ADR-0090 decided against.
2. **Why 3 rather than 1.** It keeps the human act and lowers the gesture count from about 15 a week to a few
   batches, without moving any residual to a machine. Binding the approval to the head commit closes the gap
   a batch opens (an approval of a branch that moves after it). It also gives the gate something to read: a
   batch line naming `<pr>@<head>` is the « declared approval on every critical merge » ADR-0090 decision 1
   asks `machine+critical` to check, and `critical-unapproved` can be built on it.
3. **What the batch must not become.** ADR-0088 measured a bulk ratification that left 28 of 46 rows unseen,
   and ADR-0090 a sample packet that showed one line per item. So: the packet shows each pull request's diff,
   not a summary; N is capped; the maintainer may set items aside in the same line; the batch's size and the
   number set aside are published in the weekly digest. The approval is declared in stage 1, as every human act
   is while the maintainer's credential is within agent reach, and the digest says so.
4. **Its words.** The `machine+critical` sentence is unchanged: a person approved, before merge, the changes the
   charter names as critical. The digest adds per batch: « critical batch <id>: <k> approved at pinned heads,
   <s> set aside, <m> dropped (head moved); approval declared ».
5. **Implementation order.** (a) This record decided. (b) The charter diff below, the maintainer's signed
   commit. (c) A small script, outside the verdict path, that builds the batch packet and, on the approval line,
   merges at pinned heads (pull request, merged by the maintainer, since it acts on critical merges). (d)
   `critical-unapproved` built on the batch lines (verdict path, its own record if its shape needs one). (e)
   Option 2 reopened when M3, M4 and the floor reader are in force.

**The charter diff proposed** (class R, the maintainer's own signed commit; a widening of `scope-D` cannot ride a
renewal, ADR-0088 decision 5). Existing keys only:

```diff
 scope-D:
   ...
   - golden regeneration
+  - merging a critical pull request the maintainer approved in a batch, at the approved head commit only (ADR-0111)
 ...
 pre-merge-events:
   ...
   - the net shrank
+  - a batch-approved pull request whose head moved after the approval
```

And in the charter's prose, the **Pre-merge** paragraph:

```diff
 **Pre-merge.** A change to a path in `pre-merge-paths`, or one of the `pre-merge-events`, waits for the
-maintainer before merge (ADR-0088 decision 7). Every other merge touching a file in the published
+maintainer before merge (ADR-0088 decision 7). The maintainer may approve several at once, in one line naming
+each pull request and its head commit; the App merges only those whose head is unchanged, and an unanswered
+batch expires after 72 hours (ADR-0111). Every other merge touching a file in the published
 tarball is listed in the weekly digest once the signed sample exists.
```

## Alternatives discarded

- **Option 2 now, as a declared degraded mode.** Honest in its banner, and still the agent's change judged by
  the agent's machine on the verdict path, before the checker that could judge it exists; for at most one
  merge in five.
- **Option 2 with the verdict code excluded too.** Nothing on the critical list would then remain eligible: a
  lane with no traffic.
- **Narrowing the critical list instead.** ADR-0090 decision 10 narrowed it on 2026-10-12 to the verdict path
  and the trust roots; narrowing it again is removing a control under another name.
- **Approval by silence after a notice.** Refused by ADR-0088 decision 7.
- **A batch approval without pinned heads.** An approval of a branch that can move after it approves code
  nobody read.
- **Counting the reviewer agent's report as an approval.** LLM review is consultative; it never crosses a gate
  and never counts toward the floor (ADR-0090 decision 4).

## Consequences

- **The human act stays on every critical merge**, now one gesture per batch. The reading time per pull
  request does not shrink, and the record does not pretend it does; the digest publishes batch sizes and
  set-asides so a rubber stamp would show.
- **Merges wait for a batch, not for each approval.** A critical change can wait up to the batch's answer; an
  unanswered batch expires and nothing merges.
- **The gate gains something to read.** Batch lines naming `<pr>@<head>` let `critical-unapproved` be built; until
  it is, the wait stays a procedure, as today.
- **No gate is weakened and no mode changes.** `machine+critical` stays declared and degraded until its floor
  is in force; the stage banner is unchanged.
- **Cost**: the batch script, the digest lines, and later `critical-unapproved`.

## What would settle it

- **For 3**: four weeks of batches, published: batch count, sizes, set-asides, heads that moved, the
  maintainer's minutes per batch, and no critical merge outside a batch line or a per-pull-request approval.
- **Against 3**: a batch approved with no item set aside while a later review finds a defect in one of its
  items that the packet showed; a merge at a head other than the approved one.
- **For reopening 2**: M3 required and M4 running on the CI self-gate, the floor reader returning M3 and M4 in
  force; then the share of critical merges the lane would admit, re-measured on four weeks. If it stays near
  one in five or below, the lane is not worth its claim.

## Reevaluation trigger (mandatory, dated)

Reopen at the charter's renewal on 2026-12-31, or earlier on: M4 in force on the CI self-gate; a defect reaching
`main` through a batch-approved merge; batches growing to the cap with no item ever set aside for four weeks; a
second maintainer joining (independence becomes possible, ADR-0088); the critical list firing on more than half
of runward's merges over four weeks (ADR-0090's own trigger; 35 of 75 measured here).

**Trigger set on**: 2026-11-04 · **Watched via**: the batch lines in the weekly digest; the floor reader's
`notInForce` on `check`.

## References

- `runward/delegation.md` (`mode`, `pre-merge-paths`, `pre-merge-events`, the **Pre-merge** paragraph).
- `src/lib/delegation.ts` (`MACHINE_FLOOR`, the degraded reading); `stryker.config.json` (`mutate`).
- The merge measurement: `git log --first-parent --merges --since=2026-10-13` at `main@b7d8c62`, 75 merges,
  files from `git diff --name-only <merge>^1 <merge>`, sizes from `git diff --shortstat` and `--numstat`.
- ADR-0046 decision 3; ADR-0082; ADR-0088 decisions 4, 5, 7 and Context; ADR-0089; ADR-0090 decisions 1, 4, 8,
  10 and its table of controls; ADR-0103 decision 2; ADR-0110 items 5 and 6.
