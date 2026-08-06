# Known defects and constraints

**Register date**: 2026-08-06 · **Describes**: runward 0.32.0 · **Maintained by**: the maintainer, alone.

This register lists defects the maintainer knows of and considers useful to someone adopting runward. Information is not available for all defects, known or unknown. It is published because the schemes in [regulated-adoption.md](regulated-adoption.md) section 8 ask for exactly this artifact, and because a supplier who holds an unfavourable finding and does not publish it is worth less to an assessment than one who does.

**This register is not `GATE_NON_SCOPE`, and neither replaces the other.** The non scope states what the gate deliberately does not do, by decision, and is printed in every compliance pack and readable through `runward rules --json`. This register states what the gate did wrong without meaning to. An assessment that reads one and not the other has read half the picture.

**How to read the classes.**

| Class | Meaning |
|---|---|
| `wrong-verdict` | The gate returned the wrong exit code. |
| `unguarded-mechanism` | The behaviour was correct in every shipped release; no test protected it against regression. |
| `lying-surface` | The verdict was correct and the printed or machine-readable output was not. |
| `measurement` | A measured property of the project, published with its perimeter. |

`effect: exit-code` means the item can move the 0/1/2 the gate returns. `effect: text-only` means it cannot.

---

## Wrong verdicts, found 2026-08-04, closed in 0.32.0

Three adversarial self-audits were run against the shipped binary, with every case executed rather than reasoned. They proved **22 false positives** grouped into the **9 classes** below. The full account is [ADR-0045](../adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md).

**On the count.** The mapping from the 22 proven cases to these 9 classes is not published per class, and this register does not invent one. What is reproducible is the class: each entry below names a case in `test/audit-corpus.js`, which anyone can run against the real CLI (`node test/audit-corpus.js`, 13 cases, 9 refusals and 4 acceptances, with a sanity guard asserting the reference mission is green before any case runs).

All nine share: `affected-from` = 0.31.x and earlier, `fixed-in` = 0.32.0, `effect` = `exit-code`, `status` = `closed-by-fix`, `class` = `wrong-verdict`.

| id | Defect | How you detect it in your repo | Workaround before 0.32.0 |
|---|---|---|---|
| RWD-2026-0001 | The rule corpus was not checked against `scaffold-lock.json` by `check`. A rule edited, removed, or never written by runward was seen and never raised, so fabrication, substitution and signature stripping all passed. `update` read the lock; `check` did not. | Run `runward check --strict` on 0.32.0 or later: a diverging corpus is now a line of the verdict. | Review `runward/rules/` by hand against the shipped templates. |
| RWD-2026-0002 | Circular evidence was accepted. `file:<manifest>#<slug>` was a universal green key, because the slug is column 1 of every row, so it always resolved and always matched. Pointing into `runward/rules/` is the same move once removed. | On 0.32.0, such a pointer is refused with a named reason. | Grep manifests for pointers into the manifest itself or into `runward/rules/`. |
| RWD-2026-0003 | The coverage counter printed only when `applied > 0`. Answering `n/a` to every rule removed the only vacuity signal the product had. This is the aggravating form: the emptiest missions produced the most reassuring output. | The counter now prints unconditionally: `N applied · N deviated · N n/a`. | Count `n/a` rows by hand. |
| RWD-2026-0004 | The ADR layer accepted an empty file, the `ADR-0000` template, a `rejected` or `superseded` decision, and an unratified one, as a ratified decision. The evidence layer had always refused an empty file. | `adr:NNNN` pointers now refuse those states. | Open each cited ADR. |
| RWD-2026-0005 | `resolveFile` was purely lexical, so a symlink escaped containment and the seal became an arbitrary file read oracle. | Containment now resolves the real path. | Refuse symlinks under evidence bases. |
| RWD-2026-0006 | Silent no-op pointers: `#`, `#""`, `::`, and one-character symbols. A pointer that looked precise and verified nothing. | Those forms are now refused. | Read each pointer's anchor. |
| RWD-2026-0007 | The manifest grammar was rewritten before parsing: quotes, a delimiting apostrophe, only the first pointer read, malformed `adr:`, duplicate sections, fenced tables, and a row without a trailing pipe. | The parser is fence aware, refuses duplicate sections, and parses every pointer. | None reliable. |
| RWD-2026-0008 | The seal covered the cited files, not the claim made about them. 31 files sealed, every manifest row rewritten to `n/a`, and the seal still read intact. Sealing zero files was accepted, and a lock declaring an unknown version was consumed silently. | On 0.32.0 a lock sealing zero files and a lock of unknown version are both refused. | Re-seal after any manifest edit and diff the manifest by hand. |
| RWD-2026-0009 | `unsafeSignature` did not scan non-capturing groups, so a rule signature could backtrack catastrophically: over 20 seconds on 38 characters. In CI that means no verdict rendered at all, which is an `exit-code` effect by absence of verdict. | The screen now scans non-capturing groups and reduces nested groups. | Review operator-authored `signature:` fields. |

---

## Unguarded mechanisms, found 2026-08-05, closed by tests

**None of these three produced an observed defect in any shipped release.** All three were regression exposure: the behaviour was correct, and no test would have reddened if it stopped being. They are listed separately from the nine above on purpose. Merging them would over-declare three entries and under-declare twenty two.

Found by a full mutation pass; the account is [ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md). All three: `class` = `unguarded-mechanism`, `status` = `closed-by-test`. On `fixed-in`: the tests landed on `main` after 0.32.0 was tagged, so they ship in the next release and no released version carries them yet. That is stated rather than back-dated, and this line is the one to update when that release is cut.

| id | Mechanism | Effect | Evidence |
|---|---|---|---|
| RWD-2026-0010 | Seal tamper detection, `verifyEvidenceLock`. One field returned false on the unparseable-lock path makes a sealed, tampered mission go from exit 1 to exit 0, because `src/commands/check.ts` gates the whole seal section on `if (seal.present)`: the violations are neither printed nor counted. | `exit-code`, **demonstrated** on a real mission sealed with `check --freeze`. | `test/unit/evidence-lock.test.js` |
| RWD-2026-0011 | The ReDoS screen of [ADR-0020](../adr/ADR-0020-rule-evidence-signatures.md). The loop collapsing nested groups was entered by no fixture and could be deleted with the suite still green. | `exit-code` potential, not demonstrated. | `test/unit/evidence-signature.test.js` |
| RWD-2026-0012 | Pointer containment, `resolvePointer`. The repository fallback was dead code under test: every containment test ran in a bare temp directory, where no repository marker exists above the base. | `exit-code` potential, not demonstrated. | `test/unit/evidence-resolve.test.js` |

---

## Lying surfaces

The verdict is right and the output is not. For a tool whose promise is that no step is crossed without proof, a proof surface that lies under a correct verdict is a defect of its own, and it is listed rather than dismissed as cosmetic.

| id | Defect | Effect | Status |
|---|---|---|---|
| RWD-2026-0013 | `artifactState` can report an ADR directory as `filled` when it holds only the scaffolded template, printing `✓ Decision journal` where the truth is `○ raw template`. The mission is still **refused**, because the typed pointer `adr:0001` does not resolve: defence in depth, not a wrong verdict. Verified 2026-08-05. | `text-only` | `closed-by-test` (`test/unit/artifact-state.test.js`) |
| RWD-2026-0014 | Faults in the territory scanner corrupt `runward rules --for --json` while `check --strict` stays at exit 0. Measured: of 42 mutants applied one at a time to a green mission, 4 corrupted the machine output, 0 moved the verdict. The failure mode is the dangerous one for an agent consuming that contract: it does not answer "I could not read it", it answers a wrong list, plausibly. | `text-only` for the verdict, **machine surface** for an agent | `closed-by-test` (`test/unit/territory-*.test.js`) |

---

## Measurements

| id | Measurement | Status |
|---|---|---|
| RWD-2026-0015 | Mutation score **60.78 per cent** on 2026-08-05, 380 mutants surviving the entire net. Inseparable from its perimeter: **measured** on seven library modules the verdict is computed from; **not measured** on `src/commands/check.ts`, which assembles the verdict and returns the exit code and whose line coverage is 8.70 per cent with zero function coverage, nor on the nine other commands, nor on five `lib/` modules nothing reaches even transitively, nor on the nine other modules outside the core, which include `src/lib/compliance.ts`, the module that emits the OSCAL pack. Of the 380, 246 have been instructed and 181 now die. | `open` |

This is one entry, not 380. A surviving mutant is not a defect: [ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) records why, and records the case that proves it, where a mutant survived every net and the mission was still correctly refused.

---

## What this register does not do

It does not discharge any requirement for you. `runward/contracts/port-contract.md` and `GATE_NON_SCOPE` are material you cite while writing your own justification. And it records its own late arrival: the nine classes above were, until 2026-08-04, in no ADR, no template, and not in `GATE_NON_SCOPE`, which is to say this register did not exist during the period it describes.
