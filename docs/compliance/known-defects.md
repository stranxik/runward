# Known defects and constraints

**Register date**: 2026-08-06 · **Describes**: runward 0.33.0 · **Maintained by**: the maintainer, alone.

This register lists defects the maintainer knows of and considers useful to someone adopting runward. Information is not available for all defects, known or unknown. It is published because the schemes in [regulated-adoption.md](regulated-adoption.md) section 8 ask for exactly this artifact, and because a supplier who holds an unfavourable finding and does not publish it is worth less to an assessment than one who does.

**This register is not `GATE_NON_SCOPE`, and neither replaces the other.** The non scope states what the gate deliberately does not do, by decision; it is printed in the ISO/IEC 42001 readiness draft and readable through `runward rules --json`, and the NIST AI RMF pack, the EU AI Act pack and the OSCAL component-definition do not carry it today. This register states what the gate did wrong without meaning to. An assessment that reads one and not the other has read half the picture.

**Both directions are listed.** A register that only publishes false greens describes half a campaign and is falsifiable in one command against this project's own `CHANGELOG.md`, which records five adversarial audits of which two asked the opposite question: where does the gate cry on a mission that is telling the truth. Four of the nine hardening classes written on 2026-08-04 cried on the honest case before they shipped. Undue refusals are listed below alongside undue passes, because a gate that reds on correct work gets switched off, and a switched-off gate protects nothing.

**How to read the classes.**

| Class | Meaning |
|---|---|
| `wrong-verdict` | The gate returned the wrong exit code. |
| `unguarded-mechanism` | The behaviour was correct in every shipped release; no test protected it against regression. |
| `machine-surface` | Injecting a fault would corrupt what the tool prints or emits while the exit code stays correct. No shipped release did this; nothing detected it until 2026-08-05. |
| `measurement` | A measured property of the project, published with its perimeter. |

`effect: exit-code` means the item can move the 0/1/2 the gate returns. `effect: text-only` means it cannot.

---

## Wrong verdicts, found 2026-08-04, closed in 0.32.0

Three adversarial self-audits were run against the shipped binary, with every case executed rather than reasoned. They proved **22 false positives** grouped into the **9 classes** below. The full account is [ADR-0045](../adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md).

**On the count.** The mapping from the 22 proven cases to these 9 classes is not published per class, and this register does not invent one. What is reproducible is the class: each entry below names a case in `test/audit-corpus.js`, which anyone can run against the real CLI (`node test/audit-corpus.js`, 13 cases, 9 refusals and 4 acceptances, with a sanity guard asserting the reference mission is green before any case runs).

All nine share: `affected-from` = 0.31.x and earlier, `fixed-in` = 0.32.0, `effect` = `exit-code`, `status` = `closed-by-fix`, `class` = `wrong-verdict`.

| id | Defect | How you detect it in your repo | Workaround before 0.32.0 |
|---|---|---|---|
| RWD-2026-0001 | The rule corpus was not checked against `scaffold-lock.json` by `check`. A rule edited, removed, or never written by runward was seen and never raised, so fabrication, substitution and signature stripping all passed. `update` read the lock; `check` did not. **This entry was written as fully closed in 0.32.0. It was not: see RWD-2026-0021, which reopens the same vector by deleting one file.** | Run `runward check --strict` on 0.33.1 or later. | Review `runward/rules/` by hand against the shipped templates. |
| RWD-2026-0002 | Circular evidence was accepted. `file:<manifest>#<slug>` was a universal green key, because the slug is column 1 of every row, so it always resolved and always matched. Pointing into `runward/rules/` is the same move once removed. | On 0.32.0, such a pointer is refused with a named reason. | Grep manifests for pointers into the manifest itself or into `runward/rules/`. |
| RWD-2026-0003 | The coverage counter printed only when `applied > 0`. Answering `n/a` to every rule removed the only vacuity signal the product had. This is the aggravating form: the emptiest missions produced the most reassuring output. | The counter now prints unconditionally: `N applied · N deviated · N n/a`. | Count `n/a` rows by hand. |
| RWD-2026-0004 | The ADR layer accepted an empty file, the `ADR-0000` template, a `rejected` or `superseded` decision, and an unratified one, as a ratified decision. The evidence layer had always refused an empty file. | `adr:NNNN` pointers now refuse those states. | Open each cited ADR. |
| RWD-2026-0005 | `resolveFile` was purely lexical, so a symlink escaped containment and the seal became an arbitrary file read oracle. | Containment now resolves the real path. | Refuse symlinks under evidence bases. |
| RWD-2026-0006 | Silent no-op pointers: `#`, `#""`, `::`, and one-character symbols. A pointer that looked precise and verified nothing. | Those forms are now refused. | Read each pointer's anchor. |
| RWD-2026-0007 | The manifest grammar was rewritten before parsing: quotes, a delimiting apostrophe, only the first pointer read, malformed `adr:`, duplicate sections, fenced tables, and a row without a trailing pipe. | The parser is fence aware, refuses duplicate sections, and parses every pointer. | None reliable. |
| RWD-2026-0008 | The seal covered the cited files, not the claim made about them. 31 files sealed, every manifest row rewritten to `n/a`, and the seal still read intact. Sealing zero files was accepted, and a lock declaring an unknown version was consumed silently. | On 0.32.0 a lock sealing zero files and a lock of unknown version are both refused. | Re-seal after any manifest edit and diff the manifest by hand. |
| RWD-2026-0009 | `unsafeSignature` did not scan non-capturing groups, so a rule signature could backtrack catastrophically: over 20 seconds on 38 characters. In CI that means no verdict rendered at all, which is an `exit-code` effect by absence of verdict. | The screen now scans non-capturing groups and reduces nested groups. | Review operator-authored `signature:` fields. |

---

## Wrong verdict, found 2026-08-06, closed in 0.33.1

One entry, and it matters more than its count: **it reopens a class this register called closed.**

| id | Defect | How you detect it | Workaround |
|---|---|---|---|
| RWD-2026-0021 | `corpusDivergence` answers `unrecorded` when a mission keeps its own rule copy and carries no `scaffold-lock.json`. That state printed a warning and contributed **nothing** to the verdict. Since the lock lives in the audited repository, "this mission predates the lock" is indistinguishable from "someone deleted the lock". Measured against the published 0.33.0: 64 rule files reduced to the word `ok` exit **1** with the lock present and **0** with the lock removed. `class` = `wrong-verdict`, `effect` = `exit-code`, `affected-from` = 0.32.0 (when the corpus check was introduced) through 0.33.0, `fixed-in` = 0.33.1. | `node test/audit-corpus.js`, case *"deleted lock: the corpus is fabricated AND the lock removed"*. On 0.33.1 an unrecorded corpus is a named line of the verdict. | Assert `runward/scaffold-lock.json` is present in CI, or delete `runward/rules/` so the gate judges against the installed package. |

**How it was found, because that is part of the record.** Not by an audit of the gate. By an investigation into an unrelated product question, where an analyst was asked to build the cheapest mission that would earn a hypothetical attestation and did. The lesson is the one ADR-0045 already states and this register has to keep restating: a compatibility state controlled by the audited party is an attack surface, and a signal that lives in the printed text and not in the exit code is not a signal.

---

## Unguarded mechanisms, found 2026-08-05, closed by tests

**None of these three produced an observed defect in any shipped release.** All three were regression exposure: the behaviour was correct, and no test would have reddened if it stopped being. They are listed separately from the nine above on purpose. Merging them would over-declare three entries and under-declare twenty two.

Found by a full mutation pass; the account is [ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md). All three: `class` = `unguarded-mechanism`, `status` = `closed-by-test`, `fixed-in` = **0.33.0**, the first release to carry the tests that pin them. Between 2026-08-05, when they were found, and that release, they were open on every published version, and this register said so rather than back-dating them.

| id | Mechanism | Effect | Evidence |
|---|---|---|---|
| RWD-2026-0010 | Seal tamper detection, `verifyEvidenceLock`. One field returned false on the unparseable-lock path makes a sealed, tampered mission go from exit 1 to exit 0, because `src/commands/check.ts` gates the whole seal section on `if (seal.present)`: the violations are neither printed nor counted. | `exit-code`, **demonstrated** on a real mission sealed with `check --freeze`. | `test/unit/evidence-lock.test.js` |
| RWD-2026-0011 | The ReDoS screen of [ADR-0020](../adr/ADR-0020-rule-evidence-signatures.md). The loop collapsing nested groups was entered by no fixture and could be deleted with the suite still green. | `exit-code` potential, not demonstrated. | `test/unit/evidence-signature.test.js` |
| RWD-2026-0012 | Pointer containment, `resolvePointer`. The repository fallback was dead code under test: every containment test ran in a bare temp directory, where no repository marker exists above the base. | `exit-code` potential, not demonstrated. | `test/unit/evidence-resolve.test.js` |

---

## Undue refusals, found 2026-08-04, closed in 0.32.0

The same week's audits asked the opposite question twice: where does the gate red on a mission that is telling the truth. Four of the nine hardening classes written that morning cried on the honest case before they shipped, and the items below had shipped in 0.31.x. They are listed with the same weight as the undue passes, because a gate that reds on correct work gets switched off, and a switched-off gate protects nothing.

All: `class` = `wrong-verdict`, `effect` = `exit-code`, `affected-from` = 0.31.x and earlier, `fixed-in` = 0.32.0, `status` = `closed-by-fix`.

| id | Defect | Verifiable at |
|---|---|---|
| RWD-2026-0016 | A Windows checkout turned the corpus into a fabrication. `core.autocrlf` rewrites every file and the frontmatter pattern was `/^---\n/`, so no rule parsed. | `git show v0.31.0:src/lib/rules.ts` line 49 against `src/lib/rules.ts` today (`/^---\r?\n/`) |
| RWD-2026-0017 | npm and pnpm workspaces broke under the containment hardening: `packages/api/src/shared -> ../../shared` stopped resolving and no spelling worked. Containment now accepts a target inside the enclosing repository, found by a marker on disk and never by reading git configuration. | `repoRootAbove` in `src/lib/evidence.ts`; `test/unit/evidence-reporoot.test.js` |
| RWD-2026-0018 | The mission search gave up after twelve parent directories and then asserted no mission existed, which is false and unfalsifiable from the operator's seat. | `git show v0.31.0:src/lib/mission.ts` line 65 (`i < 12`) against `src/lib/mission.ts` today (`i < 128`) |
| RWD-2026-0019 | An unreadable file was a crash rather than a verdict, and `--json` stopped being JSON, so a CI consuming the machine surface got neither an answer nor a parseable error. | `src/lib/evidence.ts`, try/catch on every evidence read |
| RWD-2026-0020 | The gate punished precision: a path outside the project passed as prose and failed as a typed pointer, so writing the more precise form was worse than writing the vaguer one. | `resolvePointer` in `src/lib/evidence.ts`; `test/unit/evidence-resolve.test.js` |

---

## Machine surface, guarded only since 2026-08-05

Neither entry below is a defect of any shipped release. Both describe what a **mutation** of the code would do without any test reddening, which is regression exposure on the machine surface rather than on the exit code. They are listed because the schemes in section 8 of [regulated-adoption.md](regulated-adoption.md) ask for failures that can be injected into a tool's output, and these are exactly that.

| id | Defect | Effect | Status |
|---|---|---|---|
| RWD-2026-0013 | **Not a defect of any shipped release, and listed here only to keep the record straight.** The mutation pass showed that if `artifactState` were changed to report an ADR directory as `filled` when it holds only the scaffolded template, the whole net would stay green: unit suite, self-gate, smoke and audit corpus. The shipped binary does not do that. Verified 2026-08-06 on 0.32.0: an `adr/` holding only `ADR-0000-template.md` prints `○ Decision journal (≥1 ADR) (runward/adr) — raw template`, because `isRealAdr` (`src/lib/mission.ts:89`) excludes the template by name. What was missing was the test, not the behaviour. | none observed | `closed-by-test` (`test/unit/artifact-state.test.js`) |
| RWD-2026-0014 | Faults injected into the territory scanner corrupt `runward rules --for --json` while `check --strict` stays at exit 0. Measured on 2026-08-05: of 42 mutants applied one at a time to a green mission, 4 corrupted the machine output and 0 moved the verdict. The failure mode is the dangerous one for an agent consuming that contract: it does not answer "I could not read it", it answers a wrong list, plausibly. `check.ts` imports neither the territory module nor characterize, so the partition protecting the verdict is real; it is half a partition, because the machine contract is not behind it. | none on the verdict, **machine surface** for an agent | `closed-by-test` (`test/unit/territory-*.test.js`) |

---

## Measurements

| id | Measurement | Status |
|---|---|---|
| RWD-2026-0015 | Mutation score **60.78 per cent** on 2026-08-05, 380 mutants surviving the entire net. Inseparable from its perimeter: **measured** on seven library modules the verdict is computed from; **not measured** on the ten commands, on five `lib/` modules nothing reaches even transitively, nor on the nine other modules outside the core, which include `src/lib/compliance.ts`, the module that emits the OSCAL pack. Of the 380, 246 have been instructed and 181 now die. The largest absence of that pass is closed since 2026-08-06: the verdict itself, which was assembled in `src/commands/check.ts` at 8.70 per cent line and zero function coverage, now lives in `src/lib/verdict.ts` at 97.79 per cent line and 100 per cent function coverage, inside the measured perimeter ([ADR-0047](../adr/ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)). The next pass will report a different number for that reason, and this line says so rather than letting the improvement look like a measurement error. | `open` |

This is one entry, not 380. A surviving mutant is not a defect: [ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) records why, and records the case that proves it, where a mutant survived every net and the mission was still correctly refused.

---

## What this register does not do

It does not discharge any requirement for you. `runward/contracts/port-contract.md` and `GATE_NON_SCOPE` are material you cite while writing your own justification. And it records its own late arrival: the nine classes above were, until 2026-08-04, in no ADR, no template, and not in `GATE_NON_SCOPE`, which is to say this register did not exist during the period it describes.
