# Changelog

## 0.37.0-dev (unreleased)

### Four missing nets (2026-08-26 audit, tier 2)

Detectors that could not see the one shape where the abuse is free. Each reproduced first, each
fixed with the opposite direction asserted, and each new test measured RED against the unfixed build.

- **RWD-2026-0049** — the seal covered no `adr:` target: 0 of 18 lock keys under `adr/`, so every
  ADR body could be replaced with filler under `✓ seal intact`.
- **RWD-2026-0050** — the duplicate-cell census read `applied` rows only, skipping the two columns
  where copying a cell costs nothing. `duplicated[].rules[]` now carries `status` (additive).
- **RWD-2026-0051** — the ReDoS screen accepted anything past 21 nesting levels, and was blind to
  `a*a*`: eight adjacent repetitions of one atom exceed 20 s on a 40-character subject. An exhausted
  screen now refuses instead of approving.
- **RWD-2026-0052** — the `n/a` reason floor counted keystrokes, so `xxxxxxxx` cleared it. Now a
  degeneracy floor, and **recorded as a limitation rather than closed**: the gate does not read prose.

### The gate's own false greens (2026-08-26 audit, tier 2)

Three ways a green line rested on nothing, all reproduced on the shipped 0.36.2 binary and on this
tree before being closed, each with a sensitivity control proving the fix is not a blanket refusal.

- **RWD-2026-0046** — circularity was tested on the pointer, not the target: dropping `file:` moved
  the rule's own file into a loop that banked it unexamined. Four states of one cell on a CRITICAL
  signed rule: prose → 1, unrelated file → 1, typed self-pointer → 1, **bare self-path → 0**.
- **RWD-2026-0047** — the signature was tested against the whole file, table included, so the row
  declaring a rule satisfied it. 7 of the 9 signed rules ship a signature their own slug matches,
  three CRITICAL. The signature now reads the text outside the manifest.
- **RWD-2026-0048** — `isRealAdr` was a filename test, so a zero-byte ADR read `✓ Decision journal`,
  `all gates passed`, `1 decision(s) traced` and `1 ratified ADR(s)`. Three definitions of "an ADR"
  existed across three layers; they now share one predicate and one threshold, and the compliance
  pack counts as *ratified* only what carries a ratified status.

`test/audit-corpus.js` gains the bare-path vector and reads 15/15 — it read 14/14 while that hole was
live, because it carried only the `file:` spelling of the same attack. A second candidate vector was
written and then REMOVED rather than shipped: it was refused by the unfixed build for an unrelated
reason, so it would have printed `ok` without testing what it names. Its proven detector is
`test/unit/gate-false-greens.test.js`, measured red on the unfixed build and green on the fixed one.

**The version string is part of the fix, not bookkeeping.** `runward verify` derives version skew from
`predicate.runward !== VERSION`, and this tree carries fifteen false-green fixes over the published
0.36.2 while stamping the same string — so no skew could ever be named between a build that has the
defects and one that fixes them, and a compliance pack stamped `0.36.2` may have been produced by
either. That was itself an audit finding.

### Fixed — the adoption path (`update --corpus`)
- **RWD-2026-0038** — vendoring an org corpus erased the lock record of every rule runward wrote,
  turning a green mission red on 31 rules it had scaffolded seconds earlier while reporting success.
- **RWD-2026-0039** — replacing a shipped rule from an org corpus was labelled with the word runward
  uses for its own refreshes, so a fork with one `signature:` line deleted flipped a red gate green
  in silence. It is now named `replaced` and counted as a warning.

### Fixed — the artifacts the gate hands to a machine
- **RWD-2026-0040** — a red gate emitted a SARIF byte-identical to a green one whenever the gap was
  the evidence seal, the rule corpus, an unratified decision or a failed hook.
- **RWD-2026-0041** — half of every SARIF used a mission-relative uri, so those annotations pointed
  at paths no checkout holds.
- **RWD-2026-0042** — `runward verify` re-derived two predicate fields of fifteen; everything a
  regulator would read was unbound free text.
- **RWD-2026-0043** — `verify` took its strictness from the untrusted predicate and never reported
  which gate it had re-derived.
- **RWD-2026-0044** — `--vsa` named `RUNWARD_GATE_STRICT` on a `FAILED` verification, in the one
  field the interop page tells a policy engine to branch on.
- **RWD-2026-0045** — the OSCAL pack was byte-identical between a green gate and one red on eighteen
  unresolvable pointers, and declared controls `implemented` from the manifest status column alone.

### Still open, recorded rather than fixed
The third adversarial audit produced 56 measured findings across five dimensions. Nine of the fifteen
high-severity ones are fixed here; the remainder are filed in
[known-defects.md](docs/compliance/known-defects.md) with their reproductions, and are not closed.

## 0.36.2

**Two more false greens in the spelling ladder, both live since 0.32.0 and 0.34.0 — and neither reachable by reading the code. One needed a permission state nobody creates by accident; the other needed a filesystem the author does not have.**

### The false greens

- **A directory the gate could not list silently cleared the case check** (RWD-2026-0029). `onDiskSpelling` returns `null` for *"the spelling already matches"*, and its `catch` returned `null` too — so *"I could not check"* and *"it is fine"* were the same answer. Measured: `file:./src/Guard.TS` citing a file spelled `guard.ts` is refused with the directory at `0755` and **passes at `0111`**, on a filesystem where it resolves only because the filesystem is forgiving. One permission bit cleared the check for everything beneath it. An unverifiable spelling is now its own answer and a named violation — where the gate cannot verify, it says so in the run ([ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)).
- **On Windows, a redundant `./` defeated the check entirely** (RWD-2026-0030). There `onDiskSpelling` is already defeated by 8.3 short names (`RUNNER~1` against the long name the parent directory lists), which is why `spellingViaRealpath` exists — so it is the **only rung left**, and its failure is the whole ladder's. It compared the operator's raw cell against a canonical suffix: `.\src\Guard.TS` versus `src\guard.ts`. The comparison failed on the *prefix* rather than on the *case*, and "no difference" is what a caller reads as "correctly spelled". Measured on the windows-latest leg: `file:src/Guard.TS` refused, the same pointer written `file:./src/Guard.TS` accepted, same tree. macOS caught both forms all along, which is precisely why nothing before that leg could see it.

Both are a green on the author's machine that turns red on a case-sensitive runner — the surprise that makes people stop trusting a gate.

### The tool-adapter routing is guarded

`tool-adapters.test.js` proved each committed-tool adapter answers correctly **when called**. Nothing proved the gate *calls* it, or *acts* on the answer: 27 mutants sat on that routing and survived the unit suite and the whole net. They **move** a verdict rather than remove it — a coverage report routed to the lint branch still produces a violation, just the wrong one, and a test that only checks "something was raised" passes.

A matrix now covers 4 adapters × every state they can return, each asserting the failure **class** and never the wording, each with the mirror state that must stay silent. Plus the structural cases: the same SARIF body under three filenames routes identically ([ADR-0056](docs/adr/ADR-0056-committed-tool-artifacts-as-evidence.md) recognises shape, never extension), and an ordinary source file still reaches the symbol check. **Measured after: 73 mutants in that range, 73 killed.**

### Also

- The mutation instrument's concurrency is set from a measurement rather than from the core count: the unit suite uses **310 % CPU**, so each worker costs ~3 cores and the ceiling on 8 cores is two. Getting this wrong always errs toward flattery, because a starved run is filed as a caught mutant.
- Tests that depend on filesystem behaviour now **probe** the capability — case-insensitivity, and whether this process can be denied a directory listing — instead of inferring it from `process.platform`. A case-sensitive volume on macOS and a root container on Linux both exist.

## 0.36.1

**Three false greens in the evidence layer, found by instructing the mutants that survive runward's own test net — and the instrument that found them, which was measuring the machine instead of the code.**

### The false greens

None of these needed a mutant to reach. They were exposed by building a mission that would actually exercise each function, which is what instructing a survivor requires ([ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 3).

- **A code fence hid the manifest from the circular-evidence check** (RWD-2026-0025). `textOutsideManifest` removes the conformance table before looking for a self-cited symbol, because column 1 of every row is the rule's own slug and would always match. It took the **first** matching heading, fenced or not, so an example of the format pasted above the real table left the real table inside the text being searched. That is RWD-2026-0002, the universal green key, reopened by a code fence — and `readManifest` had already fixed this exact shape for row parsing. Measured: the same self-citing row exits **1** without the illustration and **0** with it.
- **One invisible character swallowed a typed pointer** (RWD-2026-0026). The pointer pattern ends in `$`, and `.` never matches a line terminator in JavaScript, so a single CR, U+2028 or U+2029 after the prefix made `$` unreachable: the pointer was dropped **in silence**, the row still read as typed, and the cited file was never opened. A paste leaves such characters behind and nobody can see them. Measured on a row citing a file that does not exist: exit **1** with an ordinary cell, exit **0** with a U+2028 in it. Terminators are now folded to a space before parsing, which cannot change a well-formed cell since a space is already a pointer separator.
- **An absent seal said nothing at all** (RWD-2026-0027). The output could not distinguish "never sealed" from "seal deleted": tamper with a sealed evidence file and the gate exits 1, delete `runward/evidence-lock.json` and the same tampered tree exits 0, silently. The strict run now names the regime it is in. The **verdict** is deliberately unchanged, and RWD-2026-0028 records why in a new `known-defects.md` section for constraints that cannot be closed inside the repository: sealing is opt-in, and an in-repository marker declaring "this mission seals" buys nothing against anyone deliberate while costing honest teams a red gate — the reasoning `scaffold-lock.ts` already carries about the corpus lock.

### The instrument, and why its own numbers had to be thrown away

- **The mutation harness is committed** — configuration, resumable passes, the probe, and a survivor register generated from measured verdicts. The ratchet of ADR-0046 decision 2 had existed since 2026-08-05 with **no list to be diffed against**, so "the survivor list does not grow" could not be falsified. That is the shape ADR-0045 refuses from an operator.
- **The raw numbers were fiction.** The harness bounded children with `spawnSync`'s timeout, which signals the direct child only, while `node --test` isolates each test file in its own process — every expired run left about a dozen grandchildren alive, still executing their mutant. Measured: load average **78 on 8 cores**, 32 orphans surviving the driver, and at one point two copies of the verifier racing each other. Stryker counts a `Timeout` as *detected*, so starved survivors vanished into the detected column and the score went **up**: the same module read **98.1 %** contaminated and **77.4 %** clean, with 199 of 269 "timeouts" turning out to be survivors.
- **The instrument now refuses to measure what it cannot measure**: process groups killed whole, hangs reported rather than inferred from an exit code, a lock against a second concurrent copy, the mutant read back from disk before any verdict is taken, and a mutant list bound to the sha256 of the build it was measured on — three fixes moved one function by 47 lines, and a replay would otherwise have spliced into other code with full confidence.
- **[`docs/compliance/mutation-register.md`](docs/compliance/mutation-register.md)** files all 215 survivors of `evidence` as **144 holes, 42 equivalents and 29 display-only**, each carrying what was run and observed rather than what was reasoned, every equivalence argued, guarded on every commit by a test that never runs Stryker.

Nothing here changes the gate's contract: no threshold, no score is a crossing condition, and CI does not run the pass.

## 0.36.0

**The evidence layer reaches the artifacts a factory already produces, and the verdict leaves in the formats its consumers already read. Plus the two false greens the pre-announcement audit found in 0.35.0's own code, and the Windows leg that proved the central invariant on a third OS.**

### The verdict, in formats other tools already read

- **`check --sarif`** emits the gate's own findings as a SARIF 2.1.0 log, each gap annotated on the **manifest row that carries it** — a reviewer reads the verdict in the pull request instead of a CI log. Row located by its first column (never a substring, which would annotate prose above the table), repository-relative URIs, deterministic bytes, and a valid **empty** log on a green mission, which is what clears stale annotations. Emission only: runward writes the file, your CI uploads it.
- **`check --vsa --resource-uri <uri>`** emits the verdict as a **SLSA Verification Summary Attestation** — a neutral port, so a policy engine admits on it without learning runward's vocabulary. It claims **no SLSA level**: `verifiedLevels` carries a custom value (`RUNWARD_GATE_STRICT`, `…_THROUGH_<PHASE>`), because runward verifies a delivery gate and never looked at your build pipeline. `--resource-uri` is required and never guessed. Its `timeVerified` is a clock the spec mandates, making this the one non-byte-idempotent emission — set `SOURCE_DATE_EPOCH` and it is reproducible again.
- **`runward verify` tolerates DSSE envelopes**: it decodes the payload and re-derives, and reports the signature as present and **not verified** — runward anchors no trust root, and checking a signature it cannot anchor would be a stronger claim than the tool is entitled to. A lying predicate inside an envelope still fails.
- **A PR-native `verify` Action** (`stranxik/runward/verify@<sha>`): emits and re-derives, writing the verdict to the job summary. Exercised on runward's own mission in CI, so it cannot rot unnoticed.
- **`runward bundle`** and the [reference Kyverno policy](examples/kyverno/require-runward-verdict.yaml) complete the chain, with [docs/interop.md](docs/interop.md) carrying the recipes: cosign signing, Archivista/Chainloop/OCI deposit, the verdict as external evidence in Kosli and JFrog gates.

### Committed-tool adapters: the evidence a factory already has

A rule row (or a spec criterion) can now rest on an artifact your CI already commits. Same mechanism throughout — recognise the file **structurally**, read what the tool recorded, refuse what the tool itself marked bad:

| Point at | The pointer names | Resolves when | Refused |
|---|---|---|---|
| a **SARIF** scan | `#ruleId` | the scan knows the rule and records no open finding | open findings; a rule never checked |
| a **coverage** report (lcov or Cobertura) | `#path/to/file.ts` | measured **and** something exercised it | measured with zero covered lines |
| an **ESLint** report | `#path/to/file.ts` | linted, no error-severity finding | recorded errors (a warning does not redden) |
| a **CycloneDX SBOM** | `#pkg:npm/name@1.2.3` | the component is declared | a different version; **a bare name**, refused rather than resolved |

Never a threshold, and never a semantic judgment: this is "an empty file is not evidence", declined — **a red test is not evidence, a scan with open findings is not evidence, a file nothing exercises does not prove the rule was applied in it.** SCA deliberately gets no adapter: vulnerability findings are the SARIF adapter's job.

### `spec-check` takes a bundle, and the delta must hold together

Point it at several files or a feature **directory** (`specs/<feature>/`, an OpenSpec change dir) and it adds a second deterministic question: every criterion identifier the bundle **references** must be **declared** by some file of it. `tasks.md` implementing AC7 when the spec declares AC1..AC5 is broken whatever AC7 meant. The identifier pattern is deliberately narrow, so RFC 7231, ISO 42001 and task T3 do not become false reds.

### Two false greens, found by an audit of this project against itself

The 2026-08-14 full-repo audit (thirteen agents, three of them adversarial) found both **inside the evidence layer** — the exact defect class the gate exists to refuse:

1. **The JUnit adapter stopped at the first matching case.** With two homonymous cases in two suites, a **red** case behind a green one was invisible and `test:…::NAME` read "pass". Now every occurrence is scanned and one red reddens; `CLASS::NAME` pins one case among legitimate homonyms.
2. **`spec-check` silently dropped the declared depth.** A criterion linked to an absent `#SYMBOL` or a red `::NAME` read "linked". It now verifies through the gate's own evidence layer, and a criterion links only when **every** one of its pointers verifies.

### Windows, proven rather than assumed

A `windows-latest` CI leg now runs the full suite plus the self-gate. Its first run found seven real defects across three root classes, all fixed: artifact paths are **POSIX by contract at emission** (a bundle made on Windows was not byte-comparable with one made on Linux), the checkout is LF everywhere (`.gitattributes`), and the case-forgiving-filesystem check was silently skipping under 8.3 short names — on the exact platform it exists for. *Same working tree ⇒ same verdict* now holds on three operating systems.

### The run says more, and claims no more

- **The missing-row message names the gesture** (`runward manifest --sync` scaffolds the rows) and hands the decision straight back: sync writes an empty status the gate still refuses.
- **`in-progress` states its true cause** — placeholders left, or content below the divergence floor. `state` is unchanged; `cause` is additive in `--json` and SARIF.
- **Identical Evidence cells are named** in the run, grouped by cell. Counted, never gated: one artifact can legitimately evidence several rules.
- **Every CRITICAL/HIGH rule is ruled on against OWASP ASI** — mapped, or declaring in writing why it has none. Completing all nineteen unmapped rules would have reported agentic-security coverage that does not exist; a test now refuses the third state, silence.
- **`npm run bench`** measures the gate's cost on your machine: burying the reference mission under 10,000 uncited files leaves it flat. The gate is O(cited evidence), not O(repo).

### Migration

Nothing renames and no flag changes meaning. Two populations turn red, both deliberately:

1. **A `test:…::NAME` pointer whose report holds a red homonym.** Fix: pin yours with `test:report.xml::CLASS::NAME`, or accept that the red test was never evidence.
2. **A spec-check criterion whose `#SYMBOL` / `::NAME` does not verify.** Fix: point at the real symbol or case, or drop the depth marker you cannot honour.

Both reference missions are strict-green under this release.

## 0.35.0

**The verdict layer: the verdict becomes a portable, re-checkable, standards-legible object — attested, re-derivable offline, bindable into one provenance — and a full-repo audit hardened it before it shipped. Two false greens found by that audit die in this release; the migration note names who reddens and the one-line fix.**

### `runward check --attest` — the verdict as an attestation ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 1)

Wraps the `--json` verdict in an **unsigned** in-toto Statement v1 (predicate `https://runward.dev/verdict/v1`) whose subject digest binds it to the exact mission state (the mission tree ∪ the cited evidence files). Byte-idempotent; no signature field — signing stays your gesture, under your key, runward holds none. The envelope is schema-validated in CI against a **vendored** in-toto Statement v1 schema, with the network cut.

### `runward verify` — offline re-check ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 2)

Re-derives the mission-state digest and the verdict from the current tree and confirms the attestation binds to it: a drifted tree and a tampered predicate both fail, loud; no network, no trust root, no key. A **version skew is named** (`producedBy`/`versionSkew`): when the attestation was produced by an older runward, a re-derivation failure can be verdict-logic evolution rather than tampering, and verify hands over the distinguishing gesture (`npx runward@<producedBy> verify …`) instead of letting the two read the same. A phase-crossing attestation (`check --through --attest`) records its declared horizon and verifies against that prefix — a verified prefix can never be read as a finished mission ([ADR-0053](docs/adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md)).

### `runward bundle` — one provenance for an assessor ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) layer 4)

Binds already-emitted artifacts (the verdict attestation, the evidence seal, an OSCAL pack, an SBOM…) into a single in-toto manifest, each referenced by raw SHA-256 — re-verifiable by `runward verify` or any cosign/in-toto tool.

### `runward spec-check` — deterministic spec conformance ([ADR-0056](docs/adr/ADR-0056-the-evidence-layer-widens.md))

Every acceptance criterion in a spec (Spec Kit, OpenSpec, BMAD — format-agnostic markdown) must be **linked** to a delivered artifact that resolves, at the depth the pointer declares: `#SYMBOL` at an identifier boundary, `::NAME` recorded green in a committed JUnit report, the `:LINE` bound — through the gate's own evidence layer, never a re-implementation. A criterion links only when EVERY one of its pointers verifies: one green path cannot mask a broken `#SYMBOL` beside it. Linkage, never semantic satisfaction — `SPEC_NON_SCOPE` travels with every verdict, and the exit stays the 0/1/2 port.

### Committed-tool evidence: the JUnit adapter ([ADR-0056](docs/adr/ADR-0056-the-evidence-layer-widens.md))

A `test:reports/junit.xml::Name` pointer resolves against the **committed** report structurally — present-and-green, present-and-red, absent — never by running anything. **Every homonymous case is scanned and one red reddens the verdict** (the audit's first blocking finding: the first version stopped at the first match, so a red case behind a green homonym was invisible); `CLASS::NAME` pins one case among legitimate homonyms via the `classname` attribute.

### The shared corpus, pinned without a registry ([ADR-0057](docs/adr/ADR-0057-the-shared-corpus-is-pinned-without-a-registry.md))

An org vendors ONE rule corpus across a fleet with **no registry and no fetch**: `runward update --corpus <path>` vendors `runward/rules/` from an already-vendored local directory — a filesystem path, **never** a registry coordinate (`@org/rules` is refused by name) — and records the pin in the scaffold-lock. The corpus self-describes (`corpus.json` → `corpusPin` in `check --json`); a pin/bytes divergence is reported as `corpusDrift`, **advisory, never a gap** (both stamps are re-signable together — gating them would be ADR-0002's re-signable floor). The corpus's own `migrations.json` merges with the built-in migrations at every reading surface, so a renamed org slug is guided, not guessed at. The no-fetch invariant is proven structurally: the whole flow runs inside CI's network-cut block, where any socket attempt fails the job.

### The gate, hardened and accounted for

- **Three more signed rules** — `config-secrets-boundary`, `async-job-guardrails`, `data-memory-provenance` (9 of 64), each on an idiom its text prescribes, each with a `nonScope`.
- **`rules --for --json` refuses rather than guesses**: a top-level `couldNotRead` names every territory carrier a read step could not fully read, so an orchestrator cannot treat a shortened answer as exhaustive.
- **The runtime boundary is a test, not a promise** ([ADR-0054](docs/adr/ADR-0054-the-runtime-boundary-is-explicit.md), now accepted): the transitive import closure of the verdict path contains no socket module and no process spawner; `check --strict --json` is byte-identical across two runs; no command speaks `--changed`/base-ref. `npm run bench` answers the monorepo objection with a measurement: burying the reference mission under 10,000 uncited files leaves the gate flat — O(cited evidence), not O(repo).
- **The journal caught up with the code**: ADR-0054 and ADR-0056 ratified on their proofs, ADR-0055 amended (the subject is the mission-state digest — stated, no longer silent; layers 3-4 recorded delivered), ADR-0005 amended (a reader of a committed report is not the runner lock-in it refused). The assessor-facing compliance registers were corrected in the uncomfortable direction: they claimed three packs did not carry `GATE_NON_SCOPE` when all four do — the claim now follows the blocking test instead of being maintained by hand.
- **The README says what ships**: the verdict layer is documented from the front door, and the turn-end hooks are labeled what they are — advisory by design (`|| true`), the hard stop is CI.
- **`runward/claims` resolves**: the forbidden-claim list ships as a real package export (with a wildcard passthrough so no existing deep path breaks), and the site build now consumes it as a failing guard — one list, no drift ([ADR-0050](docs/adr/ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) executed end to end).

### Migration — two false greens die, and three rules gain a signature

1. **A `test:…::NAME` pointer whose report holds a red homonym.** Previously read "pass" off the first match; now one red reddens. **Fix:** if the homonyms are genuinely different tests, pin yours with `test:report.xml::CLASS::NAME`; if not, the red test was never evidence.
2. **A spec-check criterion whose `#SYMBOL` / `::NAME` does not verify.** Previously "linked" on path presence alone; now the declared depth must hold, on every pointer of the criterion. **Fix:** point at the real symbol/case, or drop the depth marker you cannot honor.
3. **A prose `applied` row on `config-secrets-boundary`, `async-job-guardrails` or `data-memory-provenance`.** Same class as 0.34.0's five: a signature makes shape-matching evidence mandatory. **Fix:** point at evidence carrying the idiom, or answer `n/a`/`deviated` with a reason.

Both reference missions are strict-green under this release; every change was validated in both directions.

## 0.34.0

**Three decisions from the 2026-08-12 product review land: the construction gate becomes usable in CI, and the gate is made as strong as its headline. This release deliberately reddens some previously green missions — the migration note below names exactly which, and the one-line fix for each.**

### `runward check --through <phase-id>` — the construction gate ([ADR-0053](docs/adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md))

A required `check --strict` exits 1 for the whole build, because later-phase deliverables are unfilled by definition — so it was unusable in CI during construction, and teams hacked a partial-green with `jq` or `|| true`. `--through <phase-id>` certifies a declared PREFIX: every phase up to and including `<phase-id>` is crossed on evidence, nothing past it. It narrows only the phase counters; the 0/1/2 exit contract, the seal and the six phases are untouched, and the phase-global integrity checks (corpus, seal, unratified ADRs, drift) are NOT scoped, so a regression at or below the horizon still reds — the horizon is a floor, not a ceiling. It refuses `--freeze` (a seal certifies a full crossing) and an unknown id, both exit 2; it prints a loud "not a completion verdict" banner and carries additive JSON (`through`, `horizon`, `gaps.deferred`). The wiring contract is in the ADR: the release / merge-to-main gate stays the full `check --strict`; `--through` is a construction progress signal, never the sole required release check.

### The gate is made as strong as its headline ([ADR-0051](docs/adr/ADR-0051-the-gate-is-made-as-strong-as-its-headline.md))

- **Symbols match at an identifier boundary.** `#guardFields` no longer matches a file that contains only `guardFieldsLegacy`. A renamed identifier — the exact "moved or renamed" case the violation message names — now reds instead of silently passing, and a seal can no longer sit on a pointer whose identifier no longer exists. Non-identifier symbols (dotted, quoted) keep their exact-substring semantics.
- **Five more rules carry an evidence signature** (6 of 64, up from 1): `resilience-retry-backoff`, `resilience-multi-provider-fallback`, `security-mcp-server-pinning`, `security-code-execution-sandbox`, `security-tool-change-reapproval` — each a conventional idiom the rule text prescribes, each with a `nonScope` stating what a match does NOT prove. Rules whose idiom is illustrative rather than a code token stay unsigned, and the refusals are named in the commit.
- **The run names the signed share of the verdict**: "N of M `applied` row(s) rest on a signed rule". Counted, never gated; additive JSON (`evidence.signed`).

### Overclaim rules externalized ([ADR-0050](docs/adr/ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) decision 2, structural part)

The forbidden-claim list moves out of the CLI test into `src/lib/claims-rules.ts`, shipped with the package, so a site-build guard can consume the same list from the pinned dependency — one source, no drift. No behaviour change; the guard's three meta-guards are intact. ADR-0050 stays proposed (its site-copy decisions need the site repo).

### Migration — this release reddens some green missions on purpose

After `runward update` refreshes a mission's rule corpus (or on the next `check --strict` for a mission that judges against the package corpus), two populations turn red. Both are the mechanism working, and each has a one-line fix:

1. **A pointer symbol that was a fragment of the real identifier.** If an `applied` row's `#SYMBOL` passed only because it is a substring of a larger identifier (e.g. `#guardFields` over `guardFieldsLegacy`), it now reads "symbol not found". **Fix:** point at the real identifier, or drop the `#SYMBOL` to keep the bare path.
2. **A prose `applied` row on one of the five newly-signed rules.** A signature makes file-backed evidence mandatory for `applied` rows, so an `applied` row that carried only prose (no `file:`/`test:` pointer whose content matches the idiom) now reds with "cited, not applied". **Fix:** point the row at evidence that carries the rule's shape, or answer `n/a` / `deviated` with a reason — a rule the mission does not implement was never meant to be `applied`.

The two reference missions (runward's own, and the shipped `request-triage` example) are strict-green under this release; every change was validated in both directions on each.

## 0.33.5

**No verdict changes. The canary for [ADR-0049](docs/adr/ADR-0049-the-build-is-isolated-from-the-publish.md): the first release whose provenance is signed by the isolated builder.**

The tarball is built, tested and its provenance signed inside `build-and-attest.yml`, a reusable workflow whose steps `release.yml` cannot reach into; the signing certificate names that file. The publish job packs the same commit itself and refuses to publish a builder tarball that does not byte-match — the reproducibility re-proof, executed at release time rather than promised. `npm publish` stays in `release.yml` under OIDC trusted publishing, unchanged.

Written before the tag, as with the 0.33.4 canary. What this release must establish:

```sh
gh attestation verify runward-0.33.5.tgz --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml
```

passing on the published artifact; the determinism cross-check holding; and a local rebuild of the attested commit still reconciling byte for byte. `verify-release.yml` requires the signer identity on this release's run, so the outcome is loud in both directions.

No SLSA level is asserted anywhere. The sentence naming what the mechanism is documented to provide is frozen verbatim in the overclaim guard (`FROZEN_CITATIONS`), and every paraphrase of it faces the rule — the regex accident that used to let it pass became a decision, tested in both directions.

Worth recording: the first CI run of this chain caught a real mistake — the builder wiring was applied, tested green locally, then silently reverted by the restoration step of the very guard-bite checks meant to prove it was guarded, and the stale local run was believed. The extended posture guard reddened on `release calls the isolated builder` at its first outing. The commit message of the fix carries the lesson: restore from a saved copy, never from HEAD, when the working tree holds uncommitted work.

## 0.33.4

**No verdict changes. This is the canary release for [ADR-0048](docs/adr/ADR-0048-the-release-carries-verifiable-proof.md): the first release whose build provenance is attested and attached, and the first the release proves under its own verifier.**

### What this release is the proof of

- **The provenance path.** `release.yml` now attests build provenance for the tarball (`actions/attest-build-provenance`, own SHA pin) and attaches **two** bundles under locked names: `runward-0.33.4.intoto.jsonl` (SBOM attestation) and `runward-0.33.4.provenance.intoto.jsonl` (build provenance). Until now the GitHub attestation store held no provenance for the tarball — `gh attestation verify` with no flag answered HTTP 404, measured 2026-08-11 — because the provenance lived on npm alone, which gh does not read. From this release, `gh attestation verify runward-0.33.4.tgz --repo stranxik/runward --predicate-type https://slsa.dev/provenance/v1` is expected to pass from the release assets, offline included. This changelog entry is written **before** the tag: whether it holds is exactly what the canary establishes, and `verify-release.yml` requires it on this release's run — a missing bundle reds the release (`test -s`), and a failed verification reds the verify run.
- **The verifier.** `.github/workflows/verify-release.yml` replays `docs/verifying-a-release.md` against the published artifacts after every release: cross-store hash, attestation verification with identity, offline verification from the attached bundle, and a negative control (a corrupted tarball must fail). Proven by dispatch against v0.33.3 before this release; this is its first release-triggered run.

### Also in this release (shipped on main since 0.33.3)

- **`docs/verifying-a-release.md`** — the replayable verification an enterprise runs, expected outputs verbatim, offline path (three files suffice), second verifier with pinned identity, negative controls, and the closing paragraph on what none of it proves: a signature establishes who **attested** these bytes, never that the code is sound.
- **ADR-0048** — locked asset names (a rename to `.sigstore.json` would downgrade the Scorecard category from provenance to signature, established at source against ossf/scorecard v5.5.0); slsa-github-generator refused for three sufficient reasons (non-maintenance notice merged 2026-08-07, Node builder never left beta, `NPM_TOKEN` publish path regressing from OIDC trusted publishing); the isolated-builder path deferred with named preconditions, not refused.
- **Backfill** (release assets, not code): v0.32.0 through v0.33.2 now carry their tarball and SBOM attestation bundle, each verified — signature, workflow identity, digest, then re-verified offline from the restored bundle — before attachment, with a dated note in each release. Side effect, measured then confirmed on the public scorecard: Signed-Releases 0 → 10, global score 6.1 → 6.9. The score reads filenames and verifies nothing (its own documentation says so); the deliverable is the procedure, the score is its shadow.

## 0.33.3

**No verdict changes.** The release path now carries its own proof, two claims that were true became enforced, and the gate's requirements are stated one at a time with the test that exercises each.

### The release carried no proof

Until 0.33.3 a GitHub release carried the SBOM and **nothing else** — not the tarball, not a single attestation. The provenance existed (`npm audit signatures` returns it, and deps.dev shows Google verifying it independently) but it lived on the npm registry, and a GitHub release is where most people look.

So OpenSSF Scorecard read the release assets and answered, verbatim: *"Project has not signed or included provenance with any releases"*, scoring Signed-Releases **0/10**. The project's own public scorecard contradicted its strongest claim, across at least three releases.

The real bundle now goes up under the `.intoto.jsonl` name the ecosystem reads, with the tarball beside it — an attestation whose subject the reader cannot fetch from the same place proves nothing they can act on. `test -s` reds the release rather than shipping a silent gap. **This release is the first proof that the path works**; it could not be tested any other way.

### Two lines the compliance sheet could only assert

- **`npm audit --audit-level=high` runs on every pull request.** There was no such job: `grep -rn "npm audit" .github/workflows/` returned nothing, and a HIGH advisory sat green and unmerged while a release was cut. Scoped to high and above on purpose — a floor at `low` reds on advisories nobody would act on, and a guard that cries on the safe case gets switched off.
- **Line coverage is measured and held above a committed floor.** The `coverage` script existed and nothing called it. A **ratchet, not a target**: floor at 78 against a measured 80.41, moved only by a deliberate commit. [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) refuses a threshold on the *mutation* score for reasons that do not transfer — a mutation score is a property of the tests, whereas line coverage is recomputed from scratch on every run.

### Tool operational requirements

[`docs/compliance/tool-operational-requirements.md`](docs/compliance/tool-operational-requirements.md): **51 requirements** over the verdict surface, each citing a test file and a case name inside it. The substance was already in `runward/contracts/port-contract.md` — in prose, with zero identifiers. Prose cannot be checked off.

Each entry states what a green **leaves open**, per requirement, because `GATE_NON_SCOPE` is too coarse to answer a question about one line.

It is **not a qualification kit**, and says so: a vendor kit's documents are produced under a quality system a third party has assessed, and these are not. Its traceability guard checks that a citation **resolves**, never that the cited test is **relevant** — the same class of limit stated one floor below. Section 10 names what carries no requirement at all.

### Why runward issues no attestation about your application

Section 5.4 of the regulated-adoption sheet answers a recurring question with **no**, in any form, and the reason is measured rather than principled: the machine contract cannot distinguish a substantial mission from one carrying no project code, the corpus belongs to the audited party, the seal date is the mission's word, and issuer, subject and verifier would be the same party. What can be published instead is a **replayable record, by the operator, in their own repository** — with the admission that on a private repository the only level that checks content is unavailable to an outside reader.

### Test suite

**428 → 435**, and 98 mutants that survived the entire net now die. Re-measured before instructing: the derived figure was 199, the measured one 179, because twenty had been killed by tests that never aimed at them. 81 survivors remain, filed as a register rather than a backlog.

## 0.33.2

**No verdict changes. Four places where the output claimed more than it established, or less than it knew.** All four came out of an investigation into whether runward should issue an attestation that an application was built with it. The answer to that was no, and the reasons produced this release.

### The machine surface was quieter than the terminal

`check --strict --json` carried no counters, no corpus status, no seal. An agent driving on `--json` — which is how this tool is meant to be consumed, and how a CI reads it **blind** — could not tell a mission carrying real evidence from one answering `n/a` to every row. Both said `verdict: "clean"`.

That inverts [ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)'s own finding one layer out: the worst case must not be the quietest.

| | reference mission | same mission, every row `n/a` |
|---|---|---|
| before | `verdict: clean` | `verdict: clean`, **identical object** |
| after | `applied 23 · na 13 · typed 20` | `applied 11 · na 25 · typed 8` |

Additive per ADR-0030: `evidence`, `corpus`, `seal`, `criticalScope`, `gateNonScope`, all under `--strict` only. **`gateNonScope` travels with the counters on purpose** — a consumer that keeps the numbers and drops the caveat is the next entry.

### The declared non-scope shipped in one pack out of four

Measured on generated packs: present in the ISO/IEC 42001 draft, **absent** from the NIST AI RMF draft, the EU AI Act draft, and the OSCAL component-definition. The artifact that leaves for a third-party GRC tool was the one carrying no reservation, and the prose around a pack does not travel with it. A caveat that stays home was not made.

All four carry it now, the OSCAL one in its metadata `remarks` so it survives ingestion.

### The gate demands 31 of the 45 CRITICAL/HIGH rules

The conformance section printed *"Architect: 6 rule(s) accounted for … Govern: 12"* and stopped, which reads as though the critical set were covered. It is not: 14 rules are mapped to no gated phase and are never asked about, **five of them CRITICAL**, including `checklist-pre-production-security` and `checklist-pre-production-resilience`.

Reported, never gated. A rule with `phases: []` is documentation the operator may apply without the gate asking, and gating it would red every honest mission on day one. Leaving it unsaid was the defect, because it let a reader believe a sentence the output never supported. The count and the list are printed, and `criticalScope` is in `--json`.

### The seal date is declared, not observed

`runward/evidence-lock.json` carries `sealedAt`, and nothing signs the lock. Editing the field by hand yields `✓ seal intact — sealed 1999-12-31` with exit 0. **Nothing changes for an honest user** — `check --freeze` writes the real date, as it always did — and nothing here is repairable: an unsigned file inside the audited repository cannot testify about itself. What the seal proves is unchanged: the cited files still hash to what they hashed when it was written. The printed line and the machine surface now say the *when* is the mission's word.

Recorded as RWD-2026-0022 and RWD-2026-0023 in `docs/compliance/known-defects.md`, under a section that says plainly these are properties of where the data lives, not bugs awaiting a patch.

### Method note

Every guard added here was checked **by removing the fix**: drop `gateNonScope` from the payload, remove the reservation from the drafts, stop computing `criticalScope` — each one reds. A guard nobody tried to break is a guard nobody has tested.

## 0.33.1

**A false green, in the release published this morning.** One `rm` on a file the audited party owns, and a corpus of 64 rule files reduced to the word `ok` crossed the gate.

```
64 rule files reduced to "ok", scaffold-lock.json present  ->  exit 1
64 rule files reduced to "ok", scaffold-lock.json deleted  ->  exit 0
```

Reproduced against `runward@0.33.0` installed from npm, not against a working tree.

### What was open

`corpusDivergence` answers `unrecorded` when a mission keeps its own rule copy and carries no `scaffold-lock.json`. That is a compatibility path for missions predating the lock, and it printed a warning while contributing **nothing** to the verdict.

The lock lives in the audited repository. So *"this mission predates the lock"* and *"someone deleted the lock"* are the same observation, and the second costs one command. **[ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) class 1 reopens by deleting a file instead of re-signing it** — and `docs/compliance/known-defects.md` called that class closed.

It is also the aggravating form ADR-0045 names, one storey up: the gate said it could not check, in prose, next to a green exit code. **Where the gate cannot verify, it says so in the run, and the run is the exit code.**

### The fix, and what it leaves alone

`unrecorded` is a named line of the verdict from this release. Verified in both directions: the fabricated corpus with the lock deleted goes from exit 0 to exit 1 with a reason; the shipped example, a mission with no local rule copy (`package`), and runward's own mission all stay at exit 0. A legacy mission is one `runward update` away, and the safest configuration — no local copy at all — was never the one punished.

Guarded twice: `test/unit/verdict.test.js` pins both directions and kills two mutants, and `test/audit-corpus.js` replays it end to end. **The first draft of that replay was decorative** — it renamed the rule files, so every manifest row cited a slug that no longer existed and the mission reddened on conformance, which made the case pass with the fix removed. It guts the bodies in place now and fails without the fix.

### How it was found, which belongs in the record

Not by re-running the audit method ADR-0045 says to re-run on any release touching these modules. By an investigation into an unrelated product question, where an analyst asked to build the cheapest mission that would earn a hypothetical attestation built it. **A reevaluation trigger is only as good as whoever remembers to pull it.**

ADR-0045 gains an amendment stating that class 1 was not closed, rather than leaving a ratified decision claiming a closure that did not hold. `known-defects.md` gains RWD-2026-0021 and corrects the RWD-2026-0001 entry.

### Also

- The SBOM round-trip guard shipped yesterday with `workflow_dispatch` only, which was the defect it exists to prevent: a guard someone has to remember is a guard that does not run. It fires on any pull request touching `release.yml`, which is what every Dependabot bump to `download-artifact` or `anchore/sbom-action` does.
- `chalk` 6.0.0. Verified with colours forced, since the suite redirects to files and emits no escape sequence at all: six outputs captured on 5.6.2 and 6.0.0, **byte-identical**.
- Dependency advisories closed (`js-yaml` 5.2.3, `fast-uri` 3.1.5). `npm audit` reports 0 in the repository; an installer already got 0, since both are development dependencies.

## 0.33.0

**0.32.0 fixed what an audit found. This one measures what the net that guards it would catch, and publishes the answer with everything in it that counts against us.** No behaviour of the gate changes: 24 golden outputs across four missions and six flag combinations are byte-identical to 0.32.0, exit codes included.

### How much does this test suite actually detect

A full mutation pass (Stryker 9.6.1) on the seven library modules the verdict is computed from. **Mutation score 60.78 per cent**: 2 973 mutants, 1 769 killed, 38 timeout, 1 166 survived, in 2 h 35.

A survivor count is not a defect count, and treating it as one produces a day of false findings. So: 433 survivors carry mutators able to flip a *decision* and were re-run against the whole net (unit suite, self-gate, OSCAL validation, end to end smoke); **53 died there, 380 survived everything**. Then 246 of those were instructed one function at a time, each by applying the mutant to a real mission and reading the verdict rather than reasoning about the code. **181 now die**, measured centrally rather than claimed.

Three mechanisms were **correct in every shipped release** and guarded by **no test**:

- **Seal tamper detection.** One field returned false in `verifyEvidenceLock` takes a sealed, tampered mission from exit 1 to **exit 0**: `check.ts` gates the whole seal section on it, so the violations were neither printed nor counted. Reproduced by hand on a mission sealed with `check --freeze`.
- **The ReDoS screen** ([ADR-0020](docs/adr/ADR-0020-rule-evidence-signatures.md)). The loop collapsing nested groups was entered by no fixture and could be deleted with the suite still green.
- **Pointer containment.** The repository fallback was dead code under test: every containment test ran in a bare temp directory, where no repository marker exists above the base.

One correction the pass forced on its own reading, and the reason [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) exists: **a surviving mutant is not automatically a false green**. Forcing `artifactState` to call every ADR directory `filled` survives the unit suite, the self-gate, the smoke run *and* the audit corpus, and the mission is still **refused**, because a typed pointer does not resolve. Defence in depth. What it corrupts is the printed line, and for this tool a proof surface that lies under a correct verdict is a defect of its own.

Mutation testing is adopted as an **instrument, never a gate**. No score is ever a crossing condition: a number in a manifest is a verdict satisfied by a figure nobody re-derived, which is what [ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) forbids, and runward does not do to itself what it refuses from an operator. What is opposable is a **ratchet on a named perimeter**.

### The verdict is now computed where a test can reach it

The largest absence of that measurement was the one that mattered: `src/commands/check.ts`, where the verdict is assembled and the exit code chosen, sat at **8.70 per cent line and 0 per cent function coverage**, no unit test imported it, and the mutation pass could not reach it at all.

`src/lib/verdict.ts` is now a pure reading of the mission: it prints nothing, never touches `process.exitCode`, runs no hook. `check.ts` renders it and exits on it. `verdictFrom()` is the single definition of "clean", exported so the command cannot grow a second copy below the render. **97.79 per cent line, 100 per cent function**, and inside the measured perimeter from now on. 12 hand-written mutants, 11 killed; the survivor is argued rather than assumed ([ADR-0047](docs/adr/ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)).

### What we publish about ourselves

- **`docs/compliance/known-defects.md`**, 20 entries in four classes, each with the version range it affects and the command that verifies it. It lists **both directions**: the undue passes and the five undue refusals that shipped in 0.31.x. A register that only published false greens describes half a campaign and is falsifiable in one command against this project's own changelog.
- **`docs/compliance/regulated-adoption.md`** gains the axis it was missing. It was written on the shape of a SaaS questionnaire, artifact integrity plus project health; the axis that decides for a tool that renders a verdict, **whether the verdict is right**, was absent from all 82 lines. New section 8 works the tool confidence analysis through for medical device, automotive, rail and airborne software, **adverse case first**, and asserts no level and no class for runward in any scheme.
- Its footer no longer says every verifiable claim on the page is enforced in CI. That was a reassuring count over a set the author chose, which is the exact failure mode ADR-0045 records in the gate itself.
- One published falsehood corrected: `GATE_NON_SCOPE` is **not** printed in every compliance pack. Measured, it appears only in the ISO/IEC 42001 draft. The NIST AI RMF pack, the EU AI Act pack and the OSCAL component-definition carry nothing, and the pack it is missing from is the one that goes to a high-risk provider.

### Guards that had a broken perimeter

The recurring defect of this repository, four instances in one week:

- **The reproducible-build job had never once compared two tarballs.** `npm pack --pack-destination` does not create the directory, so it exited ENOENT on its own output path. The claim it guards is true, verified by hand; the guard simply never reached the comparison.
- **The overclaim guard** saw neither `TQL`, nor `TCL2/3`, nor the rail classes, and nothing refused declaring a normative clause satisfied. Widened *before* the section that produces that risk was written, not after.
- **`CITATION.cff` was pinned at 0.21.0** for eleven releases, while `packaging.test.js` already guarded the roadmap against the same failure mode.
- `docs/compliance/eu-ai-act.md` contradicted itself two lines apart on the high-risk binding date, and the compliance README carried the superseded one.

### Also

- `test/audit-corpus.js`: the adversarial campaign behind ADR-0045 becomes a corpus anyone can replay against the real CLI, 9 refusals and 4 acceptances, with a sanity guard asserting the reference mission is green before any case runs.
- `regimes/eu-ai-act@2026-1744.json`: the expired sheet had missed an amending regulation. The dated-facts watch now detects that the **text** moved instead of waiting for a date we guessed.
- Unit suite **209 → 342**. Whole-project line coverage 74.90 → 79.70 per cent.

## 0.32.0

**The largest correctness release this project has had.** Five adversarial audits, every case executed against the shipped binary rather than reasoned about. Three asked "how do I get a false green"; two asked the opposite, "where does the gate cry on a mission that is telling the truth". Both halves were needed: **of the nine hardening classes written in the morning, four cried on the honest case.**

### The gate could be satisfied by paperwork

`check --strict` exited 0 on missions containing **no evidence at all**. The cheapest cost 2 726 bytes of arbitrary text and zero lines of project code — with the seal applied and the ISO 42001 pack assembled on top. The aggravating form: the emptiest missions produced the most reassuring output. Citing each rule's own file printed `36 of 36 typed pointers the gate opened and checked (100%)`.

- **The corpus is wired to the verdict.** The gate judges a mission against a corpus the mission *owns*. [ADR-0002](docs/adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) closed rule removal; substitution and fabrication passed, because its floor counts *cardinality* over a set the adversary controls — twelve files containing `ok` satisfy `govern: 12`. The authority is now the **installed package**, outside the repository; `scaffold-lock.json` keeps its real job, telling an upstream change from a local edit.
- **Circular evidence is refused.** `file:<manifest>#<slug>` was a universal green key: the slug is column 1 of every row.
- **The ADR layer matches the evidence layer.** A 0-byte file, `ADR-0000-template.md`, a rejected or unratified decision each satisfied a deviation. Refused by name.
- **Containment actually runs.** `resolveFile` was purely lexical: a symlink to `/etc/hosts` passed and was read, turning the seal into an arbitrary-file read oracle.
- **The seal covers the claim**, not only the files it cites; sealing zero files is refused; an unknown lock `version` is refused.
- **The counter no longer goes quiet at the worst moment.** It printed only when `applied > 0`, so answering `n/a` to all 36 rules removed the only vacuity signal. It now always prints `N applied · N deviated · N n/a`.
- **The grammar is read before anything rewrites it.** Quotes honoured before the `;` split; the apostrophe is not a delimiter (`#'l'invariant tient'` made the gate look for `l`, true of every file); every pointer in a cell parsed, not just the first; duplicate `Rule conformance` sections refused rather than arbitrated; fenced tables are illustrations.
- **A signature cannot hang the gate.** `unsafeSignature` excluded `(?:...)`, so `(?:a+)+b` ran over 20 s on 38 characters.

### The gate refused honest missions

- **A Windows checkout turned the corpus into a fabrication.** `core.autocrlf` rewrites every file and `/^---
/` does not match `---
`, so all 64 rules read as empty and the gate announced *"the mapping may have been stripped"*. Git doing its documented job accused the operator.
- **npm/pnpm workspaces broke** under the containment hardening: `packages/api/src/shared -> ../../shared` stopped resolving, with no spelling that worked. Containment now accepts a target inside the enclosing repository, found by a marker on disk — never by reading git configuration ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)).
- **An unreadable file was a crash, not a verdict**, and `--json` stopped being JSON.
- **The gate punished precision**: a path outside the project passed as prose and failed as a typed pointer.
- **A documentary rule could not be proven.** The usage registry and the named successor have no evidence but the section stating the fact. A pointer may now cite a fact stated *outside* the manifest table.
- **House rules are welcome again.** Only an extension that would count toward the non-vacuity floor is refused.
- **A green here is a green in CI.** `file:SRC/Guard.TS` resolved on macOS and failed on Linux; it is refused here, with the on-disk spelling resolved segment by segment.

### What this changes for you

**Missions that were green may go red** — a hand-edited rule, a deviation resting on an unratified ADR, a circular pointer. Those verdicts were about something other than what they claimed. **Missions that were red may go green** — every Windows checkout, every workspace.

Nothing changes in the exit-code contract, the machine surface, or the six phases. And none of this makes the gate judge whether evidence *implements* a rule: `GATE_NON_SCOPE` is unchanged and remains the honest statement of depth. See [ADR-0045](docs/adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md).

## 0.31.0

An adversarial fact-check on [the v0.30.0 article](https://runward.dev/news/2026-08-01-six-tests-that-could-not-fail/) re-tested every claim it made. **Two of the three mutations published as harmless were live defects**, and the corrected figure in the same article was itself wrong. Both fixes are here; the article is corrected on the site.

- **`territory.ts` bracket balance.** A `#` two characters past an opening quote was taken for a comment, the line truncated, an inline array lost its `]`, and the balance loop swallowed the rest of the file. The `#` need not sit on a line runward reads: a documentation URL with an anchor inside `[vars]`, a table never consulted, destroyed the `[triggers]` below it and a HIGH rule silently stopped surfacing. The published reasoning argued line by line about an automaton that carries state **across** lines.
- **`territory.ts` derivation notes.** The binding-source check could mean *"no other manifest produced anything"* instead of *"this one produced nothing"*: a false note beside a cron just derived from that same file, a real absence silenced, and a note naming **the wrong manifest**. No exit code moved, which is why it was first filed as "an informational message" — but evidence pointing at the wrong file is not classified by its output channel.
- **`gatedPhases` is published in the rules envelope** (`rules --json`, `--for`, `explain`), read from `GATED_DELIVERABLES` rather than restated. The site's catalog had computed "rules the gate can require" from a hand-written literal missing `handover`, understating the gate by four rules, one of them CRITICAL. Additive field per [ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md); `port-contract.md` updated.
- **The one survivor that really is equivalent is now guarded on its reason, not its symptom.** `mission.ts`'s line filter is equivalent across 3267 comparisons, but only while every shipped template ends with a newline. Strip one and a deliverable flips `in-progress` to `filled`, opening a phase. A test now pins the invariant; it deliberately does not kill the mutation.

Every guard proven able to fail: each mutation reddens its own test and only it, removing a template's trailing newline reddens the invariant guard, and reintroducing the old `BUILD_PHASES` literal verbatim reddens the contract guard.

## 0.30.0

An internal-validity pass: instead of adding surface, mutate the source and see whether the tests notice. **42 valid mutations, 36 killed or type-caught, 6 survivors** — three of them real holes. Everything below was found by measurement, not by reading.

- **`AGENTS.md` now carries the gesture its own obligation needs.** It already told the agent to *"confront them at the point of action, not from memory"*, then named only `runward explain <rule>` — which reads a rule whose **name you already know**. It never said how to find out **which** rules govern the file being touched. `runward rules --for <paths>` is now in the same sentence, with the honesty clause that must travel with it (rules declaring no territory are counted, never matched). This is not an extension of [ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md), which deliberately kept the step out of the non-building workflows: `AGENTS.md` is not a workflow, it is the contract handed to the agent every session, and it already carried the obligation. **`update` does not refresh `AGENTS.md`** and is right not to — it is a mission deliverable ([ADR-0010](docs/adr/ADR-0010-agents-md-as-a-first-class-handover-deliverable.md)), so existing missions do not receive this; new ones do.
- **The traversal guard on evidence pointers had no test.** Collapsing the containment check in `resolveFile` survived the whole suite — on the path **every `applied` row goes through**. `verifyEvidenceLock` had its traversal test; pointer resolution did not. Now pinned: a `../` climbing out of every base is refused even when the file really exists, and a sibling directory sharing the base's prefix (`/a/project-evil` vs `/a/project`) is not inside it.
- **Nothing pinned that runward works from inside a repo.** Stopping the `findMissionRoot` climb on its first iteration survived — and climbing to the mission root is the one behaviour that makes `runward check` usable from anywhere, which is how it is actually run. Pinned from three levels down, from the root, and an orphan directory resolving to nothing rather than adopting a mission above it.
- **A `*` that crossed a path separator went unnoticed, and a block comment that ate its line too.** The first would make a declared territory silently **wider** than declared, surfacing rules on files they do not govern; the second would drop whatever follows `/*` on the same line of a `wrangler.jsonc`. Both are red under mutation now.
- **When NOT to seal, measured and written down** ([ADR-0021 amendment](docs/adr/ADR-0021-blocking-drift-and-evidence-sealing.md)). Sealing this repository would seal 25 files, and **25 of 25 changed within 30 days** — a committed lock here would turn `check --strict` red on the first commit after every seal. The opt-in was right; the boundary was written nowhere, and an operator in a regulated setting is exactly the one who would seal everything on principle. **Seal what has stopped moving**: a handover, a release, a version entering operation.
- **The release stamp guard sweeps instead of listing.** It stopped at the first stale manifest, read one stamp per file (missing `marketplace.json`'s second), and checked a hand-kept list a new packaging could be forgotten from. Stamps are now found by walking `packaging/`, `plugins/` and `.claude-plugin/`; every stale one is named at once; the set of stamped files must equal the declared inventory exactly.

**Three survivors were not holes, and saying so is part of the result.** A `readToml` mutation is near-equivalent on well-formed TOML; the other two affect a line count and an informational note, not a verdict. **107 candidate mutations were not tried** — the bench is bounded per file. This is a sample, not a proof of coverage.

## 0.29.0

Two defects found on the **first field use** of v0.28.0's territory map, by the mission that asked for it. Both of the same species: a mechanism that is correct and unreachable is not a mechanism. [ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) amended.

- **`runward/territory.md` is now read under `#`, `##` or `###`.** The mission titled theirs `# Territory` and the map was silently voided. The diagnostic existed and said the right thing — at line 16 of a 28-line output nobody scrolls. A map the operator believes is active and runward ignores is exactly the state v0.28.0's "every refused row is named with its line" rule exists to prevent; counting `#` reintroduced it one level up, at the file. A heading of any level still ends the section, so a following `# Notes` table is never eaten.
- **A map that could not be read now says so first**, under its own `This map was not read` heading, above every match: *"Everything below is derivation only — your declarations had no effect."*
- **`Territory coverage` moves from `characterize` to `status`.** v0.28.0 put the anti-rot instrument in the one command a governed mission has no reason to run: `characterize` announces it targets ungoverned repositories, and writes a `characterization.md` that is not a mission deliverable — the reporting mission deleted the file after reading it. `runward status` is the governed-mission read, at the same groom cadence, and it writes nothing. Files walked, files carrying a category, and map rows that matched no walked file with their line numbers — unchanged, reachable.

- **The release stamp guard now sweeps instead of listing.** Bumping 0.28.0 → 0.29.0 exposed three defects in the guard itself, all of the same species as the two above. It stopped at the *first* stale manifest, turning a release bump into a guess-and-retry loop when it already knew the whole answer. It read one stamp per file, so `.claude-plugin/marketplace.json`'s second stamp (`plugins[].version`, beside `metadata.version`) was never verified. And it checked a hand-kept list, so a future packaging carrying a product version and forgotten there would have shipped mislabelled, green. Stamps are now found by walking `packaging/`, `plugins/` and `.claude-plugin/` for any `"version": "x.y.z"` at any depth; every stale one is named at once; and the set of stamped files must equal the declared inventory exactly, which fails on a new manifest *and* on a vanished one. A host's own schema version (kiro's `"v1"`, copilot's `1`) stays out of scope by shape rather than by an exception someone must remember.

An ungoverned repository no longer gets the measure. That is correct: with no `runward/` there is no map and nothing to be inert.

All notable changes to the Runward tooling. Newest first. What is ahead lives in [ROADMAP.md](ROADMAP.md).

## v0.28.0 — the mission says what a manifest cannot — 2026-07-31

[ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) complete. A deployment manifest declares an **execution topology** — an entry module, a schedule — never the nature of the code behind it. v0.27.0 derived the first half; this ships the second, and the mission that reported the gap now sees **both** rules it violated in July, not one.

- **`runward/territory.md` — the mission declares which of its files carry which category.** Four columns (pattern · category · effect · why), and precedence **named in three places rather than inferred**: the last matching row wins per (path, category); derivation < map < a rule's own `appliesTo`, **which the map may never narrow**. The map may remove what runward *guessed*; it may never remove what the maintainer *decided* — a mission able to silently shrink its own coverage would be the weak verifier [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md) refuses.
- **Markdown by necessity, not taste.** The match reason must carry `<source>:<linenum>`, and `JSON.parse` destroys positions. `remove` is a column rather than a `!` prefix, because the glob dialect declares "no negation" and a character that inverts a line disappears in a diff.
- **Every refused row is named with its line.** An unknown category, an empty `why`, a bad effect, a path escaping the project, a short row — each is reported, never dropped. A row the operator believes is working, that runward ignored, is the worst state of all. Rows inert *by construction* are found too: a category no rule governs can never surface one, and a `remove` for a category nothing derives removes nothing.
- **`characterize` gains `## Territory coverage`** — files walked, files carrying a category, and **map rows that matched no walked file, with their line numbers**. `rules --for` structurally cannot measure this: it only ever sees the paths its caller passed. Without this section, ADR-0043's own reopening condition on inert rows would have been a trigger nothing observes.
- **The vocabulary grew by one, on field evidence.** Ratification named seven categories; a mission showed `configuration` was too coarse — two rules shared the word with different subjects, so declaring a file "configuration" would have surfaced the typed-config rule as a **false positive beside the secret boundary it was meant to reach**. `secret-boundary` is now its own category, and the rule is stated: a category is split when missions must be able to declare its parts separately, never by quota.

The gate is unchanged, no project code is read, and `runward` never writes the map: `init` does not scaffold it and `update` does not refresh it — a file the tool rewrites is a file the operator stops owning, and that ownership is what makes a stale row visible in a diff. Self-gate green: 152 unit tests, smoke OK, OSCAL schema OK.

## v0.27.0 — the nature was declared twice, and nobody read it — 2026-07-31

A rule can now declare the **category** of artifact it governs instead of guessing everyone's directory names, and runward derives which files are in that category from a manifest **the project already wrote**. First increment of [ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md). The deterministic, zero-network gate is unchanged, and no project code is ever read.

On the layout that reported the gap — three Cloudflare Workers as entry files, no `cron/` directory anywhere — `rules --for src/entry.serve.ts` returned nothing in v0.26.0. It now returns the HIGH rule on background-job guardrails, with both levels of the reason: `governs=background-work ← wrangler.serve.jsonc triggers.crons`.

- **`governs:` on the nine rules whose territory reaches the client's tree**, using the seven-category vocabulary named at ratification. They **keep** their `appliesTo`: a category adds reach, it does not replace it. Dropping the globs in the same release would have made `--for src/cron/runner.ts` return nothing on a mission with no manifest — a coverage regression in the release that fixes coverage.
- **A Cloudflare Workers derivation adapter** reading `wrangler.jsonc` / `.json` / `.toml`: `main`, plus `triggers.crons` and `queues.consumers`. It reads a declaration the operator wrote, never the code behind it, and it derives an **intention** rather than a deployed state — the docs are explicit that commenting the `crons` key does not disable a trigger. A queue *producer* is not background work in that Worker, and Durable Object alarms live in code, so both stay out.
- **JSONC by a two-state scanner, then `JSON.parse` — not by regex.** Cloudflare's own canonical example carries `//` comments and trailing commas, so `JSON.parse` fails on the *nominal* case; and a regex would eat the `//` inside `"https://example.com//v2"`. What does not parse throws, so refusing is free.
- **TOML by a table-path automaton — not a line-scan.** Table headers are absolute paths, so a cron declared under `[env.production.triggers]` is named as such, and order-independence comes for free. A line-scan was measured reporting a production cron as the root schedule, and reading a `[triggers]` block inside a `"""` string as a declaration.
- **Several named manifests are several Workers**, each authoritative for its own entry — `wrangler -c` is how one repository holds a fleet, which is the shape that reported the gap. The genuine ambiguity is narrower: two manifests claiming the *same* entry, where nothing is derived and the conflict is named.
- **A new state, `unresolved`.** A rule declaring a category nothing binds here has not been evaluated — that is neither a scope nor a backlog, it is a missing binding, and `--for` says so under "Could not be asked". Resolution is mission-wide, matching is per-path: a category is unresolved only when no file anywhere carries it, never merely because the paths asked about fall outside it.
- **`unscoped.count` keeps its arithmetic**, and therefore its extensional meaning (no territory in *any* carrier). Its old gloss — "rules `--for` could not evaluate" — is now false, and `port-contract.md` says which. **A consumer reading it as a completeness denominator under-counts**: named here rather than left to be discovered.

Two defects fixed before they could bite: `explain` fell through to "not ruled on yet — an omission, not a scope" for a `governs:`-only rule, describing the best-decided rule in the corpus as an omission; and the partition test was a **tautology** whose three predicates were exhaustive by construction, so it could never fail and would have stayed green while the thing it guards became false. Self-gate green: 139 unit tests (+18), smoke OK, OSCAL schema OK.

## Ratification — territory declared in two parts — 2026-07-31

[ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) is ratified, ahead of its 2026-12-01 deadline. **Nothing is built yet**, and the ADR says so plainly: ratify, then the vocabulary and the first derivation adapter, then the mission tier. **No CLI behaviour changes.**

- **The initial category vocabulary, named at ratification as the trigger required: seven**, derived from the nine shipped rules whose territory reaches the client's tree, none speculative — `background-work`, `scheduled-work`, `configuration`, `schema-migration`, `port-adapter`, `model-provider`, `startup`. Closed and small on purpose: a category is added when a shipped rule needs one, never in anticipation. The five rules whose paths runward scaffolds itself (`AGENTS.md`, the four `topology-*`) keep `appliesTo:` and gain no category — their paths really are invariant, which is the case the ADR preserves.
- **The first derivation adapter, named: the Cloudflare Workers deployment manifest.** `wrangler.jsonc`/`wrangler.toml` already declares the entry module (`main`) and its triggers (`triggers.crons`, queue consumers) — a normed file the operator wrote. runward derives the category from that declaration, never from the code behind it. Chosen first because it serves the population that reported the gap, and because it is the cleanest instance of the principle: the nature was declared twice already and nobody read it.
- **The two prior-art warnings are accepted, not dismissed.** A hand-typed taxonomy goes empty, so derivation stays the default gesture rather than the fallback. Any map the repository maintains rots, so the bidirectional report (files no rule governs, **and** rules that govern nothing) and the pruning of inert entries ship **with** the mission tier, not after it.

## An empty answer, made readable — and the carrier's premise corrected — 2026-07-31

A second field report ran `rules --for` on an entry-file layout (Cloudflare Workers) and got almost nothing back. Measurement corrected its headline — that layout matches three rules, one CRITICAL, through `adapters/` — and confirmed the substance with a number [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) should have computed before ratifying: **six of the 45 CRITICAL/HIGH rules declare a territory that reaches the client's tree.** That is the ceiling under the current carrier, not a plateau. **No CLI behaviour changes beyond the output below.**

- **An empty answer now renders what was looked for.** `--for` prints the declared territories verbatim, and `--json` carries them as an additive `territories` field. A repo whose layout uses none of these conventions can now *see* that, instead of reading a silence. This is ADR-0041's own trigger (a) remedy — "the output shape must change" — in the only form it permits: runward states the patterns it evaluated and says nothing about a tree it has not read. The field report asked for the line "your layout follows no anchored convention"; that is a hypothesis about the client's tree, and it is refused.
- **The gap that caused the report, closed.** `appliesTo` appeared nowhere in `docs/`, the README or the shipped workflows: the six folder conventions carrying that coverage were **implicit and unprescribed**, so no mission could know what layout would make it match. The rendered vocabulary closes it at the point of use.
- **The singular `worker` territory, restored.** `services/worker/index.ts` returned zero while `services/workers/index.ts` returned one — an `s` decided the match on a HIGH rule. The editorial pass had dropped `**/worker/**` as "a redundant singular variant"; it was not. The corpus doubles elsewhere (`migrations`/`migration`, `providers`/`provider`), and a test now pins the three pairs. Deliberately not widened to `jobs`/`job` or `ports`/`port`: those singular forms are rare, and adding them by symmetry rather than on evidence is the by-quota error the discipline forbids.
- **ADR-0041 amended: its premise for the carrier was false.** It argued "territory is a property of the rule, identical across missions", transposing [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md)'s reasoning for a different object — a non-scope really is invariant, a territory is the product of the rule's *subject* (invariant) and the mission's *layout* (variable). The corpus contradicts the premise on its own: the editorial pass anchored two rules to `execution-topology.md` **because runward scaffolds that deliverable itself**, and refused another because it "would have dictated the client's tree". The untouched half stands, though — a per-mission map does get restated and does rot.
- **[ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md), candidate: territory declared in two parts.** The rule names the category it governs and no path; which files are in that category is derived from what the project already declares (a deployment manifest, an ecosystem manifest — declarations, never code) and completed by the mission where derivation cannot reach. Nothing is built until it is ratified.

## v0.26.0 — no rule is silent about its territory any more — 2026-07-31

v0.25.0 left seven rules unruled: each targeted a real artifact while its own text prescribed no path, so a glob would have been inference presented as an auditable fact. A second pass ruled on all seven, weighing one question per rule — *does the rule already imply a location a sentence could make explicit, or would anchoring add a prescription it does not carry?* — with refusal as the default. **All 64 rules are now ruled on: 14 declare a territory, 50 declare, with a reason, that they have none, and none stays silent.** The deterministic, zero-network gate is unchanged.

- **Five refusals, each a distinct failure mode**, kept on the record because they are the reason the answer is trustworthy. `scaling-db-connection-pooling` would have dictated the client's tree, and its one literal path (`prisma/schema.prisma`) contradicts its own prescription — in that variant pooling lives in the connection URL, not the file. `contracts-governance` would have **under-declared** on `**/ports/**`, letting a DTO or SQL change read as out of scope — the false negative [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s own trigger names. `data-orphan-cleanup` says "cron" five times, but as a *cadence*, not a place: the glob would match every scheduled job and miss the orphan condition. `async-post-turn-pipeline` would have matched the code that is already correct and stayed silent on the turn handler where the violation lives. `observability-alert-configuration` shows its own alerts realised three ways, one of them outside the repository.
- **Two anchors, on a deliverable runward scaffolds itself.** `topology-sovereignty-by-data-class` and `topology-usage-registry-present` now name `execution-topology.md` in their text and declare it as their territory. Naming it prescribes nothing to the client: the shipped mission template already carries the very columns each rule demands — `Sovereignty level` for one, and a `## Usage registry` table matching the other term for term.
- **A premise corrected along the way.** The usage registry was thought to be missing from the mission layout; it has lived in `execution-topology.md` all along, and runward's own dogfooded mission fills it. The rule's closing sentence is also sharpened: it feeds `runward compliance` **through its conformance row**, never a compliance declaration in itself — the flow was real but indirect, and the text now says which.
- **Silence can no longer come back.** A test asserts that no shipped rule declares neither `appliesTo:` nor `noTerritory:`, so a rule added later must be ruled on rather than quietly reopening the ambiguity v0.25.0 closed.

Self-gate green: 119 unit tests, smoke OK, OSCAL schema OK.

## v0.25.0 — every rule now says whether it has a territory, or why it has none — 2026-07-31

v0.24.0 shipped `rules --for` with four rules declaring a territory and sixty saying nothing. Saying nothing turned out to be the flaw: a rule nobody had ruled on and a rule that deliberately governs no class of files read exactly alike. That is [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md)'s own lesson — an *undeclared* scope is a weak verifier — applied one level down. This release closes it, and completes the editorial pass over all 64 rules. The deterministic, zero-network gate is unchanged.

- **A declared absence of territory ([ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), amended).** `noTerritory: <reason>` states that a rule governs no class of files **and why** — the exact mirror of `nonScope:`, per-rule, optional, prose, with the reason as the valuable part. There are three states now, reported as three: a declared territory · a declared absence, with its reason · not ruled on yet. `runward explain` prints whichever applies, including the third ("an omission, not a scope"). Only the last is a backlog, and only it is meant to reach zero.
- **The editorial pass, over all 64 rules.** Five parallel readers classified every rule against **its own text**, with the negative decisions treated as first-class results: **12 declare a territory · 45 declare they have none, with a reason · 7 remain unreviewed.** The unreviewed count went from 60 to 7.
- **It corrected the seeds it inherited.** `config-secrets-boundary` carried `**/secrets/**` and `**/env/**` — conventional patterns appearing **nowhere** in the rule's text; replaced by `**/config.ts`, which the text names. `data-migrations-forward-only` carried `**/migrate/**`, which does not match `scripts/migrate.ts` — the runner the rule itself cites; now `**/migrate.*`.
- **It refused territories that would have been inferred from a slug.** `process-adr-and-journal` names no ADR directory; `tools-registry-pattern` names no location; `cache-three-tier-architecture` is misleadingly named and governs prompt-prefix stability, not an architecture. Each stays unscoped **by declaration**, with the reason readable.
- **The seven left unreviewed are a named state, not a remainder.** Each targets a real artifact while its own text prescribes no path, so a glob would be inference presented as an auditable fact. The fix is a sentence anchoring the rule's text — rule authoring, not matching. A test pins the list so it cannot grow in silence, and the ROADMAP carries it.

`unscoped.count` keeps its v0.24.0 meaning; `declaredNoTerritory` and `unreviewed` are additive beside it ([ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md)), and `noTerritory` joins the per-rule contract. Self-gate green: 119 unit tests, smoke OK, OSCAL schema OK.

## v0.24.0 — ask which rules govern this file, and see why — 2026-07-31

`AGENTS.md` has always prescribed confronting the craft rules "at the point of action, not from memory". Until now nothing made that mechanisable: `rules` filtered by phase, and `govern` alone returns twelve. This release ships the primitive the 2026-07-31 field report asked for, and ratifies the two decisions behind it. The deterministic, zero-network gate is unchanged — `--for` is a reading, never a verdict.

- **`runward rules --for <paths>` ([ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), ratified and implemented).** Returns the rules whose declared territory covers the given project-relative paths, **with the pattern that retained each one** — the `git check-ignore -v` model, so the answer is auditable rather than magical. Matching is on an optional `appliesTo:` glob list the rule declares, never on `tags:` (thematic, and inferring territory from them would be a heuristic with no reason to render). Paths come from the caller: runward never computes the change set, so the composition is yours — `git diff --name-only "$BASE...HEAD" | xargs runward rules --for`.
- **A declared glob dialect, and no new dependency.** Five constructs — leading `**/`, trailing `/**`, `**`, `*`, `?` — stated in the machine surface and echoed in `--json`. No braces, no ranges, no negation: a rule author reads the whole grammar in five lines, rather than inheriting semantics nobody in the mission could state. `**/cron/**` matches `cron/x`, `src/cron/x` and `cron`, never `src/cronjob.ts`.
- **It never pretends to be exhaustive.** Every run reports how many rules declare no territory and were therefore not evaluated, with the standing caveat *surfacing, never masking*. On a fresh rule set that count is most of them, and saying so is the point: a primitive answering "nothing" where it means "I was never told" would be the weak verifier [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md) warns about. **Always exits 0**; exit 2 only when the question cannot be asked (an absolute path, or one escaping the project).
- **No filesystem access, no git, no model.** Pure string matching, so a path need not exist yet — you can ask *before* writing the file — and nothing depends on the caller's working directory. Windows separators give the same answer as POSIX ones.
- **Four territories seeded**, on the [ADR-0020](docs/adr/ADR-0020-rule-evidence-signatures.md) "never wholesale" discipline: `async-job-guardrails`, `async-scheduled-maintenance`, `config-secrets-boundary`, `data-migrations-forward-only` — each because the rule's own text is about a specific artifact class. `security-mcp-server-pinning` was considered and left unscoped: its text prescribes no path, so a territory would have been invented. **4 of 64 rules declare a territory**: the primitive is complete, its coverage is not, and the editorial pass is the remaining work.
- **[ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) ratified**, and `iterate.md` now names `--for` as the precise gesture (its own reopening trigger, followed through), paired with `--phase` since `--for` is not exhaustive.

`rules --json` gains `appliesTo` per rule and, under `--for`, the `selector`, `unscoped` and `matchedBy` fields — additive per [ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md); `port-contract.md` documents the new surface. A regression test pins the case that motivated all of it: the cron and the secret relay that passed a green gate with both rules unread now surface with their patterns. Self-gate green: 116 unit tests, smoke OK, OSCAL schema OK.

## Ratification — the two field-report candidates, decided — 2026-07-31

[ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) and [ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) shipped as candidates in v0.23.0, each with a dated trigger governing its ratification. Both are ratified, ahead of their deadlines. **No CLI behaviour changes.**

- **[ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) — accepted, with its implementation already shipped.** The method change (`iterate.md` carries the craft-rule confrontation step) went out in v0.23.0; this ratifies the position behind it: rule confrontation is a continuous obligation of building, not a gate-crossing ritual. The Ratification section records what shipped, what was deliberately left silent (the non-building workflows), and the honest limit — the gesture is coarse until ADR-0041 lands.
- **[ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) — accepted as a direction; nothing is built.** Unlike [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md), which shipped its implementation the day it was ratified, this one commits to work that does not exist yet, and its Ratification section says so plainly. It settles the design so the implementation re-litigates nothing (the rule file is the carrier; matching is on declared territory only, never on thematic tags; the match reason is rendered; unscoped rules are counted; always exit 0; runward never computes the change set) and names what stays open (which rules get `appliesTo` first, the glob dialect, the monorepo resolution base).
- **ROADMAP re-groomed**: `Next` now carries the implementation of ADR-0041 rather than the choice to make.

## v0.23.0 — a green row does not travel forward in time — 2026-07-31

A field report from a mission built with runward: two mapped craft rules — `async-job-guardrails` (HIGH) and `config-secrets-boundary` (CRITICAL) — violated in one afternoon, on code the agent had just written itself, with `check --strict` green from start to finish. The gate behaved exactly as declared. What the report exposed is that the declaration was incomplete, and that the method stops talking about the craft rules precisely where most of a product's code gets written. Investigated by a four-agent read (adversarial fact-checking against the code, ADR-corpus constraint analysis, external prior-art survey, feasibility mapping). The deterministic, zero-network gate is unchanged.

- **The gate's temporal blind zone, declared.** `GATE_NON_SCOPE` ([ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md)) named the *depth* blind zone — a green row never proves the evidence implements the rule — and was silent on the *temporal* one: the operator's judgment was made about the code that existed when the row was written, and nothing re-judges code added later under an already-accounted-for rule. Every run still re-verifies that cited pointers resolve and that sealed evidence has not drifted; the semantic judgment is what does not travel. ADR-0040 was in default of its own standard ("every gate names what it cannot verify"); it no longer is. Read it in full with `runward explain <rule>`.
- **Craft-rule confrontation is continuous, not a crossing ritual ([ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md), candidate).** The coupling was empirical, not assumed: across the eleven shipped workflows the craft rules were named in `architect`/`floor`/`govern`/`handover` — the manifest-bearing ones — plus `verify`, and nowhere else, while `AGENTS.md` prescribes confronting them "while building, at the point of action, not from memory". `iterate.md` now carries the step in the gated workflows' own form, with the gesture available today (`runward rules --phase <phase>`) and no wait on the matcher below. Accounting rides the artifact `iterate` already mandates — the ADR that locks a switch names the rules confronted; ordinary maintenance is a reading discipline with no artifact, and the step says so, as it says that `check --strict` verifies none of it. Missions pick it up with `runward update`.
- **`rules --phase <unknown>` is misuse now, not an empty answer.** It returned zero rules and exit 0 — in a CI step, indistinguishable from "nothing applies here". It exits 2 and names the gated phases, derived from `GATED_DELIVERABLES`. The `--phase` help was stale too (it omitted `handover`, gated since [ADR-0026](docs/adr/ADR-0026-handover-as-a-gated-conformance-phase.md)); it is derived from the same single source, so a new gated phase can never be missing from it again.
- **A matching primitive, decided but not built ([ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), candidate).** `runward rules --for <paths>` would make "confront at the point of action" mechanisable, matching on an optional `appliesTo:` glob list — a territory the rule *declares* — never on `tags:`, which are thematic and would make the correspondence an implicit heuristic. The matched pattern is rendered on the `git check-ignore -v` model, unscoped rules are counted and reported, and it always exits 0. Nothing ships until it is ratified.
- **Two refusals, on the record with their citations.** A gated Iterate deliverable is rejected by name in [ADR-0033](docs/adr/ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md) (permanent red on every mature mission, or false completion). `check --changed <base>` would put a mutable, third-party-writable git ref in the exit-code path against the port contract's "same working tree ⇒ same verdict", is neutralisable by a `fetch-depth: 1`, and would be the second gate the doctrine denies. runward never computes the change set itself: paths come from the caller ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)). The operator composes — `runward rules --for $(git diff --name-only)` to inform, `check --hooks` to block ([ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md)).
- **Also carries the 2026-07-29 ratification below** — the six brownfield/characterize ADRs (0033–0038) moved to `accepted` with typed evidence pointers, plus the test hardening that preceded them. That work was committed as governance, without a release; this is the release it reaches.

`port-contract.md` is realigned with the code (`rules --json` carries `tags`, `nonScope`, and the `gateNonScope` envelope field). Guards: +1 unit, +2 smoke. Self-gate green: 110 unit tests, smoke OK, OSCAL schema OK.

## Ratification — the brownfield/characterize ADRs, status catches up to code — 2026-07-29

Six ADRs from the 2026-07-20 resume-existing (brownfield) audit — [ADR-0033](docs/adr/ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md) (`status` names the iterate steady-state and the reopening watch) and [ADR-0034](docs/adr/ADR-0034-characterize-sees-the-whole-tree-monorepos-and-deterministic-ordering.md)–[ADR-0038](docs/adr/ADR-0038-mine-across-languages-groups-by-family-and-never-resurrects-a-ratified-draft.md) (`characterize` sees the whole tree, extracts pinned versions offline, reports churn/bus-factor, detects infra & framework/DB signals, mines dependency families) — shipped across past releases and have run under test on `main`, yet their status stayed `proposed`. That is the doc↔code drift the gate condemns, inverted: the code was ahead of its own decision record. This entry closes it. **No CLI behaviour changes.**

- **Ratified, with evidence.** Each of the six ADRs moves to `accepted (ratified 2026-07-29 — see Ratification)` and gains a `## Ratification` section carrying typed evidence pointers (`file:…#symbol`, `test:…`) to the shipped implementation and its tests, on the [ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md) model.
- **Proof hardened first.** Three status/mission unit tests added (byte-stable trigger sort across ADRs; the `**Trigger set on**` line never taken as preview prose; `analyze().steadyState` false on an incomplete mission) and two `characterize` smoke assertions (a nested sub-package surfaced end-to-end, ADR-0034; pinned versions extracted from the lockfile offline, ADR-0035) — the two ADRs that had unit coverage only. Self-gate green; 109 unit tests.
- **Honest scope note.** Ratifying the product ADRs under `docs/adr/` does not change `runward status` output: its reopening watch reads the *mission's* decision journal (`runward/adr/`), not the product ADRs. This is a governance act, not a behavioural one.

## v0.22.0 — every gate names what it cannot verify — 2026-07-21

An adversarial confrontation of the repo against the field survey on code-as-harness (arXiv 2605.18747 — a v1 preprint; a survey describes a landscape, it does not validate a product) produced one candidate ADR in the morning, its sizing note in the afternoon, and this release in the evening. The survey named the missing abstraction verbatim: "a verification stack with explicit scope […] Each artifact should declare what it verifies, what it cannot verify." The deterministic, zero-network gate is unchanged — it now travels with its declared blind zone.

- **Per-rule non-scope declaration ([ADR-0040](docs/adr/ADR-0040-per-rule-non-scope-declaration.md), proposed → sized → ratified the same day).** Generalises [ADR-0005](docs/adr/ADR-0005-baseline-worktree-test-validation-out-of-scope.md)'s honesty into a first-class property: `GATE_NON_SCOPE` — what NO green row proves — stated once in the machine surface (`rules --json` / `explain --json`, additive fields per [ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md)), printed by `explain` (Non-scope / Gate-wide lines), and as a banner in the ISO readiness draft: an assessor reading green also reads what green does not prove. Per-rule `nonScope:` frontmatter only where a rule's blind zone is narrower — four rules seeded, the flagship signed rule included; the rest is written when practice reveals a blind zone, not by quota. Gate path, manifest shape and the [ADR-0003](docs/adr/ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md) lint untouched.
- **Survey-grounded documentation pass, skeptic-audited.** A third durable guardrail talking point in `positioning.md` (the SWE-bench "solved-correctly" oracle-adequacy study — with the mandatory rule never to cite the survey's "signals that cannot hallucinate" without its §3.4 fast-path context, which runward refuses by [ADR-0001](docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md)/[ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)); [ADR-0006](docs/adr/ADR-0006-rule-set-evolution-as-tracked-migrations.md) amended — every future rule-set migration entry is a change contract (invariants, falsifier, rollback); a distillation-surface section in `regulated-adoption.md` (traces stay yours by dated ADR, not promise); the AHE loop recorded as the operator-satellite's citable frame in the ROADMAP — a frame, not a demand signal.
- **Release workflow: `actions/attest-sbom` → `actions/attest`** (deprecated upstream; same inputs, SHA-pinned, least-privilege layout unchanged). This release run is its first live proof.

## v0.21.1 — the three tiers, named — 2026-07-21

A maintainer dogfooding pass (operating runward from a well-kept coding harness) surfaced that the verification architecture was fully built but never named — and that everything beyond it belongs to the operator, not the CLI. This release names the boundary and locks it by ADR. The deterministic, zero-network gate is unchanged; no CLI change.

- **The operator layer stays outside the CLI ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)).** Adoption audits over harness transcripts, operator-side cost telemetry and machine-wide instruction files are the operator's own tooling — never the MIT CLI, which reads the mission repo and nothing else ("local with no data flow", [ADR-0031](docs/adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)). A voluntary satellite is deferred behind an explicit demand trigger (the [ADR-0028](docs/adr/ADR-0028-distributable-packagings-across-harness-channels.md) channel-signal watch).
- **The three-tier verification doctrine, named.** A concepts page on the documentation site maps a name onto what the ADRs already implement: Tier 1 — the deterministic gate (unforgeable, decides phases); Tier 2 — the operator's mechanical hooks (inform and correct, never gate — the [ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md) seam); Tier 3 — advisory review (findings in, operator decides — [ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)). One partition question: *must this check be unforgeable?* Zero new mechanics: [runward.dev/docs/concepts/three-tiers](https://runward.dev/docs/concepts/three-tiers/).
- **"Wire your harness" — an operating guide in the honest per-channel format.** Extends the gate-wiring doc with what each harness can carry beyond the turn-end hook, tier by tier, no channel privileged, nothing auto-wired ([ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md) holds in full): [runward.dev/docs/operating/wire-your-harness](https://runward.dev/docs/operating/wire-your-harness/).
- **Roadmap groomed.** Next carried the naming work (shipped with this release); Later gains the official plugin-directory submission for the Claude Code plugin (discoverability — the third-party marketplace channel already works); Someday parks the operator-layer satellite behind the demand trigger.

## v0.21.0 — one command, the whole chain green — 2026-07-19

A launch-review pass (multi-agent, adversarially verified) found the first-contact story promised more than one command delivered. The fix is in the product, not the copy: the demo path now *is* one command.

- **`init --example` ends by running the gate itself.** After scaffolding the filled `request-triage` reference, `init --example` chains `check --strict` on the fresh mission — the whole chain goes green in front of you, in one command, exactly as advertised. Deterministic, zero-network, skipped under `--dry-run`. The example's next-steps now point at the guard demo (`cd code && npm install && npm run demo` — req-005 carries a fabricated account reference the deterministic guard refuses, fail-closed) instead of asking you to run a check that already ran.
- **README accuracy pass (the HN landing).** The hand-over uniqueness claim is aligned with the project's own sourced comparison (Spec Kitty *does* carry the mission past tested code; runward's difference is a plain-code succession check and standardized OSCAL evidence, not bespoke YAML). "FDE" is expanded on first use (Forward Deployed Engineer), the Why section leads with what runward does, and the sourced comparison + dropyour case study are linked from the Documentation list.
- **Example docs.** The reference floor's README now counts all five demo requests, including the guard-refused fabrication.

## v0.20.0 — regulated-adoption evidence, current OSCAL, audit-hardened — 2026-07-19

Sharpening the wedge for regulated adoption, tracking the current OSCAL release, and closing a security audit — the deterministic, zero-network gate unchanged.

- **Sovereign engineering evidence for regulated environments ([ADR-0031](docs/adr/ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)).** A CycloneDX SBOM and OIDC provenance on every release, a `regulated-adoption` sheet (what standard vendor due-diligence does *not* apply to a local, no-data-flow CLI, and what does), and honest licence framing — runward *feeds* an ISO/IEC 42001 · NIST AI RMF · EU AI Act programme, never claims to satisfy one. A drift guard over `positioning.md` and the adoption sheet keeps the copy from out-running the code.
- **Track the current OSCAL release ([ADR-0032](docs/adr/ADR-0032-track-current-oscal-and-watch-dated-external-facts.md)).** The evidence pack now emits **OSCAL 1.2.2** (was 1.1.2), proven by a third-party tool (IBM compliance-trestle) ingesting it in CI, not only our vendored schema check. Future OSCAL/regime drift is watched out-of-band by a scheduled, non-blocking workflow that opens an issue — never the gate.
- **Security hardening (from a multi-agent audit).** SBOM generation moved out of the OIDC-privileged publish job into a `contents: read` job; every CI checkout sets `persist-credentials: false`; the rule-signature ReDoS screen now also rejects overlapping-alternation patterns (`(a|a)+`); the Node floor is `>=22.12` (Node 20 is EOL, dropped from the CI matrix). No behaviour change to the gate.
- **TypeScript 7 forward-compat, without adopting it yet.** `tsconfig` declares `types: ["node"]` so the build no longer relies on TypeScript's implicit `@types` auto-inclusion — a behaviour the TS 7 native (Go) compiler drops (it was failing the build with 102 errors). Backward-compatible with TS 5.x; Dependabot **ignores `typescript` major bumps** until TS 7 is GA-stable.
- **Docs & README.** The hosted documentation ([runward.dev/docs](https://runward.dev/docs)) is surfaced from the README with a plain, direct entry, a sourced comparison vs Spec Kit / BMAD / Kiro / OpenSpec / Spec Kitty, and a *built with runward* case study. Evergreen, version-less OG banner; broken-image fixes (absolute banner URL, static npm badge).

## v0.19.0 — agent-operable baseline + harness detection — 2026-07-17

Making "an AI agent can discover, install and operate runward with no human at the keyboard" true — without leaning on a detection layer that can only ever be partial ([ADR-0030](docs/adr/ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)).

- **Neutral baseline by default.** `init` with no explicit `--tools` writes only the vendor-neutral core (`AGENTS.md` + `.agents/skills/`); `--yes` no longer defaults to the `claude` profile and the wizard pre-checks nothing. No harness is privileged — a channel is an opt-in the operator adds afterward. Closes a standing vendor-neutrality breach.
- **`runward wire` — best-effort harness detection.** Detects the AI harness running the command via a verified runtime signal (`CLAUDECODE` for Claude Code and Cowork, `GEMINI_CLI`, `CURSOR_AGENT`), falling back to a config-file marker, then `undetermined`. It recommends the matching auto-trigger channel and points at the inert sample — it never wires anything (`wires:false` invariant, [ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md)) and never prompts, so an agent run never hangs. On `undetermined`, the doctrine (AGENTS.md + the plugin SKILL.md) tells the agent to *ask* the operator which tool they use rather than guess.
- **`check --json` — a machine contract.** A stable, deterministic JSON verdict (current gate, deliverable states, conformance gaps) so an agent drives on data, not scraped text. Hook output is routed to stderr under `--json` so a subprocess can't corrupt the object.
- **Hardened non-interactivity.** `isNonInteractive()` also returns true when stdin is not a TTY or `CI` is set — an autonomous run never hangs on a prompt it cannot answer.
- **Guards.** New unit tests for detection (signal precedence, per-family config detection, `undetermined`, the `wires:false` invariant) and smoke assertions for `wire --json` and `check --json[ --strict]`. Self-gate strict green; 65 unit tests.

## v0.18.1 — pre-marketplace hardening (a 5-agent audit, closed) — 2026-07-16

A five-agent adversarial audit before public marketplace submission (security, compliance, code coherence, packagings, architecture). The verdict was sound — self-gate honestly green, no cited-not-applied, architecture faithful to its own doctrine — with two real security holes to close and some polish. All fixed here.

- **Seal traversal closed (security).** The evidence-seal *writer* confined paths to the project (v0.17), but the *verifier* did not — a forged `evidence-lock.json` with a `../` or absolute key made `check --strict` read and hash a file outside the project (an arbitrary-file-read oracle, plus a DoS via `/dev/zero` or a huge file). The verifier now contains lock keys exactly like the writer.
- **Command injection closed in the GitHub Action (security, CWE-78).** `action.yml` interpolated `${{ inputs.version }}`/`${{ inputs.path }}` into the `run:` script. They now pass through the environment, and `version` is allowlisted (semver or a dist-tag) — a malicious input can no longer inject shell (the pattern marketplace review blocks).
- **ReDoS screen bypass closed (security).** A nested quantifier hidden in a character class (`([^()]+)+`) slipped past `unsafeSignature` and hung V8 >8s (a CI DoS). The screen now normalizes character classes first, catching `([^()]+)+` and `([a-z]+)*` while leaving real signatures safe.
- **`runward rules` no longer mislabels the gated hand-over rules.** The four `handover` rules (one CRITICAL) showed as "Unmapped (advisory)" because of a stale hardcoded phase list; the gated phases now derive from `GATED_DELIVERABLES`, so a new gated phase can never be mislabelled again.
- **Packaging polish before submission.** Four `packaging/*` manifests stuck at `0.17.0` are bumped; the Codex `marketplace.json` is rewritten to the documented schema (`interface.displayName`, `source` object, `policy`, `category`); the Cursor tier in `docs/distribution.md` is corrected to *advisory `stop`* (not per-tool); the `npx --yes` supply-chain posture is documented with how to pin.
- **Guards so it can't regress.** New unit tests for the seal-traversal rejection, the ReDoS screen, and a packaging version/hook check that would have caught the `0.17.0` drift. The repo mission's ADR count is harmonized to 28.

## v0.18.0 — install runward from where you already work — 2026-07-16

Turning the lead into distribution. A channel benchmark confirmed the "install channel + deterministic gate" pattern is not proprietary to Claude Code — it's replicated across at least four harnesses, plus the canonical CI channel. So runward now publishes a **family of distributable packagings** ([ADR-0028](docs/adr/ADR-0028-distributable-packagings-across-harness-channels.md)), each honestly tiered by how hard its gate can block. Same one line everywhere: `runward check --strict`.

- **GitHub Action (the hard governance gate).** `action.yml` at the repo root: `uses: stranxik/runward@<sha>` as a required status check blocks the *merge* on a gap. Open, no secrets. The highest-leverage channel and the one aligned 1:1 with governance.
- **Claude Code plugin + marketplace.** `/plugin marketplace add stranxik/runward` → `/plugin install runward-gate@runward`: a `Stop` hook that surfaces `runward check --strict` at turn end, plus an orientation skill.
- **Siblings for every hard-Stop harness.** `packaging/` ships Gemini CLI (`AfterAgent`), OpenAI Codex (`Stop`), and GitHub Copilot / VS Code Agent hooks (Claude-compatible JSON) — the same one line at turn end.
- **Soft-gate packagings, labelled soft.** Cursor and a Kiro Power bundle a per-tool hook, documented explicitly as *per-tool, not end-of-turn* — because Cursor's `stop` and Kiro's IDE Stop/save cannot hard-block. No operator is misled.
- **MCP descriptor — discovery only.** `packaging/mcp/server.json` for findability, with a README that hammers the honest line: an MCP tool is model-controlled — findable, never obeyed. It would expose read-only surfaces at most, never the enforcement path. Positioning runward-as-MCP as a gate would be the exact "soft judge dressed as hard" the product rejects.
- **One honest map.** [`docs/distribution.md`](docs/distribution.md) tiers every channel: hard-at-merge (CI), hard-at-turn-end (client hooks), soft-per-tool (Cursor/Kiro), discovery-only (MCP). The tiering is itself a credibility signal in a market that overclaims.

**Invariants preserved**: the operator installs (runward auto-wires nothing — `/plugin install`, `uses:`, `gemini extensions install` are your gesture); never a runtime (every packaging is a thin shell around the exit-code port); vendor-neutral (a family published together, no agent privileged; the canonical surface stays `AGENTS.md` + `.agents/skills/`). Publishing to the marketplaces is the maintainer's outward-facing gesture, like the npm publish — the packages are prepared, not auto-submitted.

Also: the message pass — the README leads its differentiators with the four grounds a code-level benchmark confirmed nobody else pairs (rule-level gate with sealed evidence, gated hand-over, published OSCAL spec), and the OSCAL mapping is presented as the citable reference implementation.

## v0.17.0 — a second audit, honestly closed; the gate reaches into BMAD — 2026-07-16

We ran our own method on ourselves again: a factual multi-agent audit (adversarial internal + a fresh code-level competitive benchmark). It confirmed the four exclusive grounds hold — nobody else pairs a rule-level gate with verified evidence, signed-and-sealed evidence, a gated hand-over, and a deterministic OSCAL mapping — and it broke five things shipped in v0.15/v0.16. Closing your own defects in daylight is the doctrine, not an embarrassment.

- **Path traversal closed.** `file:/etc/hosts` and `file:../../etc/hosts` passed the gate green, contradicting ADR-0019's promise that evidence resolves under the three project bases. Resolution is now confined: absolute paths are rejected, `../` cannot climb out of a base. Evidence must be **in your project**.
- **ReDoS closed.** A rule signature with nested quantifiers (`(a+)+`) hung the gate on adversarial content — a self-inflicted CI freeze. A deterministic screen rejects the known-dangerous shape before the regex is compiled; a signed rule with such a pattern fails fast, never hangs.
- **OSCAL reconciled with its own spec.** `renderOscal` took the first manifest row (`.find()`), so a multi-phase rule's `implementation-status` depended on deliverable order — `implemented` where a later `deviated` row means `partial`. It now aggregates every row of every mapped rule (spec §3), order-independent. The readiness link is derived from the pack's regime (no dangling `./iso-42001-readiness.md` in an `eu-ai-act` pack); `description`/prefix/`links` are now normative in the spec. The "implementable independently, byte-for-byte" promise holds off the nominal path.
- **The seal's scope stated plainly.** ADR-0021 and the spec §6 now say it: the content-addressed seal detects drift and deletion, not falsification by a writer who recomputes the hash — the trust anchor is the signed git history. A repo-resident, zero-secret gate holds no signing key by design.
- **`RUNWARD_NOW` validated; `doctor`'s adapter count fixed; doc regressions fixed.** A malformed date now falls back to today instead of emitting schema-invalid OSCAL; `doctor` counts real adapters, not the README (substituting an adapter for a stray file no longer passes); `first-mission.md` documents the five wizard prompts (was four) with current counts; the README lists Kiro and `execution-topology.md`.
- **EU AI Act date corrected (2 August 2026 → 2 December 2027).** The Digital Omnibus on AI (Council final green light, 29 June 2026) postponed the Annex III/IV high-risk obligations; our regime data and docs carried the stale deadline, which the OSCAL readiness draft printed. Corrected as a factual fix (the date was already postponed before v0.16). The 2 August 2026 milestone stays real for Article 50 transparency, governance and GPAI enforcement. `positioning.md` retires the stale deadline talking point for two durable ones: **FedRAMP RFC-0024 forbids GenAI-produced evidence** (a federal validation of the zero-LLM gate) and the **Delve affair** (AI-prefilled SOC 2 audits) — both arguing AI-produced evidence is not trusted.
- **The gate reaches into BMAD (ADR-0027).** BMAD's `bmad-code-review` exposes a review-layers seam whose instruction may "run anything (e.g. an external reviewer via bash)". `templates/adapters/bmad-review-layer.toml` adds runward's deterministic gate as one review layer beside BMAD's LLM reviewers — a complement running on their distribution, same inert exit-code port as every adapter (adapters 5 → 6), no orchestrator privileged.

## v0.16.0 — the hand-over is gated, the mapping is citable — 2026-07-16

The whitespace phase: the three grounds the audit told us to own, shipped as product.

- **Hand-over becomes a gated conformance phase ([ADR-0026](docs/adr/ADR-0026-handover-as-a-gated-conformance-phase.md)).** "The hand-over is proven by a real task redone without you" was Definition-of-Done prose no gate verified — the flagship differentiator was the least backed claim in the chain. Now `runward/handover.md` is a gated deliverable (the kit index, the **redone-task proof record**, the **named succession**, the provider-swap drill) verified by four new handover rules (`handover-redone-task-proof` CRITICAL, `handover-runbook-executable`, `handover-agents-charter-final`, `handover-succession-named`); rules 60 → 64, a fifth phase skill surfaces the craft at the point of succession. The reference mission ships a filled note **and its finalized `AGENTS.md`** — `init --example` now lays down the leave-behind charter, not the scaffold. The repo's own mission records the honest state: no succession has occurred (single maintainer), the redone-task row is a reasoned `n/a` with the mechanical half (pristine CI reproduces build, tests and the strict gate) pointed at, and the flip condition named.
- **The OSCAL mapping is a published, citable mini-spec ([ADR-0025](docs/adr/ADR-0025-oscal-mapping-published-as-a-citable-spec.md)).** [`docs/spec/runward-oscal-mapping.md`](docs/spec/runward-oscal-mapping.md) v1.0, implementation-independent: the decision → ADR → manifest → OSCAL chain, the implementation-status derivation rules (with the paper-coverage asymmetry stated: mapping a rule without accounting for it never upgrades the status), the deterministic UUID seed grammar, the regime-lens stamp, byte-identity conditions, the evidence-lock v1 format, and conformance criteria for independent implementations. The golden fixture is the normative example — where prose and fixture disagree, the fixture wins. `CITATION.cff` makes citing mechanical.
- **Kiro joins the adapter family ([ADR-0018](docs/adr/ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) amended).** `--tools kiro` mirrors the phase skills as steering files (`.kiro/steering/`, `inclusion: auto` — Kiro's relevance idiom, same semantics as the SKILL.md trigger; `AGENTS.md` is read natively, so the charter needs no extra file), and `templates/adapters/kiro-hooks.json` ships the turn-end gate (`Stop` trigger, the same inert one line as the Claude Code hook; adapters 5 → 6). The mission's traced decisions inform in-session enforcement in one more harness — as a complement riding the harness's own seams, never a runtime of ours.

## v0.15.0 — the gate verifies the evidence, and runward gates itself — 2026-07-16

A factual multi-agent audit confirmed the one honest gap the ADRs had already named: the gate proved a decision was *traced*, never that the trace pointed at anything real — a pointer at an existing-but-empty file passed green. This release executes the tightenings the ADRs pre-authorized (ADR-0001 trigger b, ADR-0004's promotion trigger), still bytes, never judgment, zero-LLM:

- **Typed evidence pointers, verified ([ADR-0019](docs/adr/ADR-0019-typed-evidence-pointers-verified-at-the-gate.md)).** Evidence can declare its nature — `file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`, `adr:NNNN`, several per cell — and `check --strict` verifies each: resolution, non-empty content, line count, symbol/test-name presence. For every `applied` row, typed or prose, a resolvable path must point at a **non-empty** file: the hollow-evidence pass is closed. Free prose stays valid — it is the operator's judgment.
- **Rule signatures ([ADR-0020](docs/adr/ADR-0020-rule-evidence-signatures.md)).** A rule can declare a `signature:` regex its applied evidence must contain. `frontier-deterministic-boundary` ships signed (`assertGrounded|GroundingError|fail-closed`): the founding cited-not-applied incident is now caught deterministically end to end. Shipped conservatively — one flagship signature; a wrong signature is a false red, and false reds erode the gate.
- **Drift blocks; a green gate can be sealed ([ADR-0021](docs/adr/ADR-0021-blocking-drift-and-evidence-sealing.md)).** A stale `applied` pointer now fails `--strict` (ADR-0004's own promotion trigger, executed). `check --freeze` seals a green gate: every resolvable evidence file hashed (SHA-256) into `runward/evidence-lock.json`; a sealed file that later changes or disappears fails the gate until re-verified and re-sealed. `--freeze` replaces the old seal (re-sealing always possible) and refuses to seal a red gate.
- **`runward manifest --sync` ([ADR-0023](docs/adr/ADR-0023-manifest-sync-scaffolds-form-never-content.md)).** The table plumbing stops feeding rubber-stamps: missing expected rows scaffolded with an **empty status** (the gate refuses them until the operator decides), renamed slugs migrated in place with status and evidence preserved, template placeholders retired, duplicates/unknowns reported and never deleted. Form only, never content.
- **`runward rules --json` and `runward explain <rule>` ([ADR-0024](docs/adr/ADR-0024-machine-surface-of-the-rule-set.md)).** The rule set becomes a supported machine contract (`{ runward, source, count, rules }`, sorted, versioned-additive) for dashboards, editor extensions and CI; `explain` prints a rule's contract (impact, phases, ASI, signature, why) and full body inline — the rationale one command away instead of a doctrine excavation.
- **Regime mappings as versioned data ([ADR-0022](docs/adr/ADR-0022-regime-mappings-as-versioned-data.md)).** The ISO 42001 clauses, EU AI Act Annex IV rows and NIST crosswalk move out of the code into `regimes/<regime>@<version>.json`; `compliance --regime-version` pins the lens, and every draft plus the OSCAL stamp which mapping version produced them. A regulatory change becomes a data-file addition. Real-ingest testing was evaluated and honestly declined — no credible maintained OSS OSCAL ingester exists today (dated rejection table + manual GRC ingest procedure in `docs/compliance/oscal-ingest.md`); the offline proof remains NIST-schema validation with negative controls.
- **The verify pass leaves a trace ([ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md), amended).** The advisory cite-vs-apply workflow now writes `runward/governance/verify-findings.md`; a green `check --strict` reports its presence and freshness (stale once a gated manifest changes) — deterministically, never parsing a verdict, never blocking. The semantic layer becomes visible in a pipeline without any LLM entering runward.
- **runward gates itself.** The repository now carries its own `runward/` mission — framing, architecture, execution topology, floor, governance, runbook, all four conformance manifests filled with typed pointers into runward's own source — and CI requires `runward check --strict` green on runward, including under network isolation (`unshare -n`). Dogfooding as a required check, not a claim.
- **A real unit harness under the core.** 50 `node:test` unit tests (zero new dependencies) importing `conformance`/`compliance`/`evidence`/`regimes` directly — ~99% line coverage on the gate core — plus a seeded fuzz pass over the manifest parser (never crashes, never false-passes) and a **golden byte-identical OSCAL test** (`RUNWARD_NOW` pinned): the byte-for-byte promise is now tested, not asserted. `npm run coverage` reports via `--experimental-test-coverage`.
- **ADR-0017 closed for real.** Move 2 re-scoped (the produced, gated placement role was delivered by `execution-topology.md`; `shared-bricks.md` stays the non-gated reference grid — gating a copied reference text would be paperwork theater), move 4 executed (the reference mission gains `ADR-0003 port placement and sovereignty`, first member of the infra ADR family, cited by its topology rows).
- **Also:** a GitLab CI gate adapter joins pre-commit / GitHub Actions / Claude Code (adapters 4 → 5); `init --example` now ships the reference `code/` with the mission, so the example is green because its typed evidence actually resolves; the empty-status gate message names the expected gesture.

## v0.14.2 — every command names the next gesture — 2026-07-13

runward's own principle, applied to its CLI: a command that does work but names no next step breaks the transmission chain — the operating agent can't hand the human "what to decide next". `check`, `doctor` and `update` were doing work and then stopping silent. Each now closes with a **Next** section, matching `status`, `characterize` and `compliance`.

- **`runward check`** names the next gesture: on green, assemble the evidence pack (`runward compliance <regime>`) or take a handover snapshot (`runward status`); on gaps, fill the named deliverables and re-run, with `runward status` pointing at exactly what is open at the current gate.
- **`runward doctor`** closes on the next move: `runward init` to scaffold a mission, or `runward check` inside one.
- **`runward update`** points back to `runward check`, to re-verify the gate against the refreshed rules and workflows.
- Smoke covers all four next-gesture surfaces.

## v0.14.1 — valid YAML in the emitted skills — 2026-07-13

A follow-up audit found one real issue behind the v0.14.0 hardening: the phase-skill frontmatter runward emits (`.agents/skills/runward-<phase>/SKILL.md` and the Continue.dev mirror) was not strict-YAML valid. The `description` embeds the skill's relevance trigger, which carries a colon (and an apostrophe, `port's`); left unquoted, a spec-conformant parser (PyYAML `safe_load`, js-yaml) rejects the frontmatter. Today's harness readers are lenient line-based and still load the skill, but a strict-parsing harness would drop it — a crack in the vendor-neutral promise.

- **The `description` scalar is now double-quoted** (colons and apostrophes need no escaping there), so every emitted `SKILL.md` and the `.continue/rules/` mirror parse under a conformant YAML parser. A new smoke regression parses all four skills for real (`js-yaml`, dev-only, never shipped).

## v0.14.0 — gate integrity: a green you can trust — 2026-07-13

A multi-agent functional audit of the toolchain (build, tests, `init`, the full `check --strict` chain, `compliance`, the example floor) confirmed the core runs green end to end with no blocker, but surfaced gate-integrity defects: paths by which a mission could look done when it wasn't, or an operator typo could read as a real failure. This release closes them, so a green `check` is trustworthy ground truth.

- **CLI misuse now exits `2`, distinct from `1` "the gate has gaps".** An unknown command, unknown option, or missing/excess argument (`runward frobnicate`, `runward check --typo`, `runward init --tools`) all exited `1`, indistinguishable in CI from a legitimate gate failure. Commander's own errors are now mapped onto runward's exit-code contract via `exitOverride`, applied to the root **and every subcommand**: misuse → `2`, help/version → `0`, gate gaps stay `1`.
- **The "filled" heuristic no longer passes a one-byte edit.** Deliverables with few template placeholders (`decision-matrix.md`, `execution-topology.md`) could close their Architect gate on any interior one-character change, since only exact-template equality guarded them. A divergence guard now requires several lines of genuinely new content beyond the scaffold (calibrated against the reference mission, whose lightest fill adds 5 lines / 215 words). The reference stays green; a trivial edit reads `in-progress`.
- **Non-vacuity holds at exactly zero.** If a phase's rule mapping was stripped to empty (`phases:` removed from every rule), `check --strict` skipped the deliverable and stayed green — bypassing the very floor (ADR-0002) meant to catch a stripped mapping. The `(mapping)` violation now surfaces even when the mapped set is empty.
- **One ADR-counting rule, shared.** The mission, status, and conformance paths disagreed on what counts as an ADR: two used `!name.includes("0000")`, which wrongly dropped a real `ADR-0021-…-10000-ms.md`, while conformance excluded only the exact template. A single `isRealAdr` helper (`ADR-<n>-*.md`, excluding `ADR-0000-template.md`) is now the one source of truth.
- **The Frame and Architect workflows name every gate artifact.** `frame.md` never mentioned the steering contract (`mission-contract.md`) and `architect.md` never mentioned the decision matrix (`decision-matrix.md`), so an agent following the workflow text left an uncloseable gate gap. Both are now in the workflows' Outputs and Definition of Done.
- **Minor hardening.** `--tools` help now lists all eight profiles (derived from the profile set, not a stale literal); a `deviated` row citing `ADR-1` no longer matches `ADR-10` (anchored on a digit boundary); an Evidence cell containing a pipe (a TS union `a | b`) is no longer truncated into a false `n/a` failure. New `smoke.js` regressions cover every fix above.

## v0.13.3 — the two proofs, made legible — 2026-07-12

- **`runward check --strict` now names the two proofs.** On a green gate, an advisory section states the boundary: this gate is the *documentary* proof (the decisions are traced); runward never ran your code (it is not a runtime); the *behavioral* proof is your test suite. `floor.md §2` can declare `Behavioral proof: <command>` and an optional `Proof artifact: <path>`; runward reports the pointer and, if an artifact is named, its presence and freshness (artifact mtime vs the newest source under `code/`) — strictly read-only, never executed, never parsed for pass/fail. Advisory, never gates the verdict.
- **The reference demo shows the guard's climax.** `examples/request-triage`'s `npm run demo` now includes a request whose plausible account reference the model proposed (`ACC-7777`) is not in the registry: the deterministic guard refuses to route on it, fail-closed (ADR-0002) — "unverified account reference, not in registry", escalated to human review. The "catch" the whole design exists for, reproducible in one command.

## v0.13.2 — phase skills: surface the craft by relevance — 2026-07-12

runward now emits **phase skills** — the CRITICAL/HIGH craft rules of each build phase, packaged so a skill-capable agent surfaces them *by relevance* at the point of action (progressive disclosure), a layer above the gated core and always subordinate to it. Honest framing: native skills are table stakes (BMAD, Spec Kit and OpenSpec all ship them) — this is parity, not a moat; the edge stays the doctrine content and the deterministic gate underneath. A skill loaded but not applied still fails `runward check --strict`.

- **Vendor-neutral by construction.** A single canonical set — `.agents/skills/runward-<phase>/SKILL.md` (architect, topology, floor, govern) — is written **always, like `AGENTS.md`**. It is the converged SKILL.md alias read by **14+ harnesses in one write** (Codex, Cursor, Copilot, Gemini, Windsurf, Cline, Zed, Amp, opencode, Roo, Kilo, Warp, Devin, Augment), no agent privileged.
- **Per-harness mirrors**, selected via `--tools`, for harnesses that read their own path: Claude Code (`.claude/skills/`), JetBrains Junie (`.junie/skills/`), Trae (`.trae/skills/`), and Continue.dev (`.continue/rules/`, `alwaysApply:false` + `description`). Aider and goose have no relevance surface, so their craft rides the always-written `AGENTS.md` (honest ceiling, not forced into always-on prose).
- **[ADR-0018](docs/adr/ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) (amended twice)** by a top-20 harness scan: `SKILL.md` is a converged open standard and `.agents/skills/` is the vendor-neutral seam. Content single-sourced; every skill subordinate to the gate. Smoke covers emission, subordination and the absence of per-harness duplication.

## v0.13.1 — a transmission-ready status, agent-assisted gate wiring — 2026-07-12

- **`runward status` becomes a handoff snapshot.** It reads the mission files into a "where the mission stands": the six-phase arc with per-phase fill counts, the current gate marked with its open deliverables named, the dated decision journal with a total, the last-touched deliverable, and a **Next** block that names the exact next gesture. Read-only and deterministic.
- **The agent offers to wire the gate, on the operator's approval.** `AGENTS.md` now directs the operating agent to proactively offer to wire the gate at the harness seam (git `pre-commit` / CI required check / turn-end hook) from the inert `runward/adapters/` samples, acting only on explicit operator approval and never silently. runward still installs nothing and touches no `.git/` — the operator's wiring gesture, agent-assisted and approval-gated. Recorded as an amendment to [ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md).
- **[ADR-0018](docs/adr/ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) (accepted).** Native skill packagings (Claude Code Agent Skills and equivalents) will ship as opt-in, non-privileged application adapters **above** the gated core — a small set of phase-scoped skills that surface the right rules at the point of action, with the deterministic gate remaining the sole authority (a skill without the gate is just advice). Decision recorded; implementation deferred to the roadmap.

## v0.13.0 — see the whole chain green in one command — 2026-07-12

`npx runward init --example` scaffolds the `request-triage` reference mission already filled, so a newcomer sees the entire gated chain pass green and can emit audit-ready evidence without writing a line. The fastest way to understand what runward does.

- **`runward init --example`** lays down the filled reference deliverables (framing, architecture, two ADRs, four port contracts, execution-topology, floor, governance threat-model / eval / observability, runbook) alongside the usual rules, workflows, adapters, `AGENTS.md` and tool profiles. `runward check --strict` passes green out of the box, and `runward compliance iso-42001` emits the OSCAL evidence pack derived from the traced decisions. It skips the idea / entry-mode / stopping-tier prompts (the reference is fixed) and adds the three non-gated scaffolding notes as blank templates so the scaffold stays complete. The reference mission now ships in the package (`examples/request-triage/runward`); the reference `code/` is not bundled. Then `runward init` (without `--example`) starts a real mission from blank templates. Covered by the smoke suite.

## v0.12.2 — audit remediation, full OWASP ASI coverage — 2026-07-11

A multi-agent audit of runward, then a confrontation against competitor repos, surfaced internal inconsistencies, one genuine coverage gap, and a positioning that had stopped discriminating. All three are closed here, with no change to the invariants (deterministic, zero-LLM, read-only, never a runtime).

- **Full OWASP ASI coverage (10/10).** Two new govern-phase craft rules close the two previously-uncovered categories: `security-code-execution-sandbox` (ASI05, ASI02, CRITICAL — unexpected code execution runs sandboxed, never in-process) and `security-human-agent-trust` (ASI09, HIGH — provenance on every field, so the human never reads a model-proposed value as verified). Rules: 58 → 60; the govern non-vacuity floor rises 10 → 12; the shipped `examples/request-triage` threat-model manifest accounts for both; the smoke suite now asserts all ten ASI controls are covered and the `compliance` output leaves none `planned`.
- **Audit remediation.** Internal inconsistencies surfaced by the audit fixed: stale rule counts, a dead compliance branch, an ADR amendment note, the CI Node matrix and the zero-network import guard.
- **Framing corrected.** runward packages the FDE method: it no longer cites "the doctrine" or "the method" as external documents, and the companion "LLM Boundary Principle" annex is no longer presented as the method's founding thesis. The guiding principle (the architecture frames the model) is stated directly, and the deterministic-boundary pattern is named for what it does. Purged across README, workflows, NOTICE, the two craft rules, `floor-ts` and the agent charter.
- **Positioning sharpened (`docs/positioning.md`).** "Deterministic zero-LLM" no longer discriminates (the Microsoft Agent Governance Toolkit and runtime policy engines have it too). The durable distinction, now the lead: runward gates a *traced decision* (not an action, not an output), at *delivery* (not runtime, not test time), and derives audit-ready evidence from a *ratified ADR journal*. Rationale in `docs/positioning-note-object-moment-lineage.md`.

## v0.12.1 — surface the advisory verify layer — 2026-07-11

The `verify` workflow (ADR-0007, cite-vs-apply semantic review above the gate) shipped since v0.7.0 but nothing surfaced it — an operator crossing a green gate never learned the semantic layer existed. Now it does, without touching the zero-LLM gate or vendor-neutrality.

- **[ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md) (amended)** — discoverability wired. `runward check --strict`, when green, prints an advisory "Semantic check" pointer to `runward/workflows/verify.md`: the deterministic gate proved every rule was *traced*, not that the code *applies* it; the verify workflow judges that, adversarially, ideally on a different model, and never blocks. `AGENTS.md` now tells any agent to run `verify` before crossing a green gate. Both are zero-LLM, vendor-neutral prose. The `/rw-verify` slash command is deliberately left as a per-harness example (not a privileged default) to hold the vendor-neutral line.

## v0.12.0 — the application/infrastructure double vision — 2026-07-11

runward now packages **both visions of the doctrine as one gated path**: the application domain (what the system does) and the execution topology (where, and under which sovereignty, each port's adapter runs). The doctrine's section 15 (shared building blocks) was present only as an orphaned `shared-bricks.md` template — scaffolded but produced by no workflow and verified by no gate. It is now cabled into the method and made executable, without runward ever becoming a runtime: it **traces and governs** the placement decision, it deploys nothing.

- **[ADR-0017](docs/adr/ADR-0017-application-infrastructure-double-vision-gated.md)** — operationalize doctrine §15 into the gated flow. **(1)** Name the double vision in `docs/positioning.md` (a fifth messaging pillar) and the `method`/`architect` workflows. **(2)** Cable the orphaned `shared-bricks.md` into the `architect` (produce) and `iterate` (reopen on a placement switch) workflows' Definition of Done. **(3)** A new mission deliverable, **`execution-topology.md`** — the port→placement bridge: per domain port, its adapter, location family (the five of §15), data class(es), sovereignty level, ADR and re-evaluation trigger, plus a **usage registry** (per deployment: risk class, data classes, owner) since "risk is classified per deployment, not per platform." **(4)** An infra ADR family (placement, sovereignty by data class, agent-identity location, multi-region, trace export). **(5)** `execution-topology.md` becomes a **first-class gated deliverable** with its own `topology` conformance phase (decided over folding into `architect`, which would split rule and deliverable across files — debt): `check --strict` now verifies four deterministic `phases: [topology]` rules — `topology-port-placement-mapped`, `topology-sovereignty-by-data-class` (CRITICAL), `topology-trace-export-decision`, `topology-usage-registry-present` — each proving a *traced placement decision*, never a real infra state. The secrets-boundary concern reuses the existing `config-secrets-boundary` rule rather than duplicating it. The shipped `examples/request-triage` gains a filled `execution-topology.md` (four ports, two reaching beyond the process) so it still passes `--strict`. Rules: 54 → 58. Covered by the smoke suite.

## v0.11.0 — compliance evidence packs — 2026-07-10

A new command turns the mission's conformance work into a hand-ready, regime-framed **evidence pack** — and makes the previously-inert `docs/compliance/*` references operational. Deterministic, read-only, zero-LLM, outside the gate; never a compliance claim. This is a provenance layer upstream of the auditor: evidence traceable to ratified engineering decisions, emitted as OSCAL so it flows into GRC/auditor tooling.

- **[ADR-0016](docs/adr/ADR-0016-runward-compliance-evidence-pack-assembler.md)** — `runward compliance <regime>`, a deterministic, read-only, zero-LLM evidence-pack **assembler** (outside the gate): reads the mission's real artifacts (conformance manifest → OWASP ASI coverage, ADR journal, threat model, eval rubric) and assembles a regime-framed **assessment-readiness draft** (ISO 42001 / NIST AI RMF / EU AI Act Annex IV), explicitly flagging the sections only the operator/organization can supply, and emits **OSCAL-compatible** output so the evidence flows into GRC/auditor workflows. A provenance layer upstream of the auditor — never "compliant/certified", never LLM-drafted, never live-scraped. Makes the inert `docs/compliance/*` references operational. *Implemented (piece 1):* the **ISO/IEC 42001** readiness-draft assembler — `runward compliance iso-42001` reads the mission's rule→ASI mapping, conformance manifests, ADR journal and governance-doc presence and writes `runward/compliance/iso-42001-readiness.md` (the technical-evidence layer + its index, with the operator/organization-only sections explicitly flagged). Deterministic, read-only, zero-LLM, outside the gate. *(piece 2)* the **OSCAL export** — every `compliance` run also writes `runward/compliance/oscal-component-definition.json`, an OSCAL 1.1.2 component-definition mapping ASI01–ASI10 to implementation-status derived from the conformance manifest, with **deterministic (SHA-256-seeded) UUIDs** so re-runs are byte-identical; this is the machine-readable interop layer that flows into GRC/auditor tooling. *(piece 3)* the **NIST AI RMF** and **EU AI Act (Annex IV)** lenses — for NIST, an ASI↔AI-RMF crosswalk and the MEASURE/TEVV documentation; for the EU, an Annex IV coverage map with the ADR journal as the near-verbatim Point 2 design-rationale. The compliance surface (ADR-0016) is now **complete**: ISO 42001 / NIST AI RMF / EU AI Act readiness drafts + the OSCAL export, all deterministic, read-only, zero-LLM, and never a compliance claim.

## v0.10.0 — retro-documentation & regional compliance — 2026-07-10

Two feature lines, both holding the invariants — the gate stays deterministic, zero-LLM and read-only. **Retro-documentation** (ADR-0013/0014): runward reconstructs the transmission kit for an existing, undocumented system — the transmission phase pointed backward. **Regional compliance** (ADR-0015): the OWASP ASI security mapping is the universal core; the named regulation becomes a swappable regional lens, security-only by default. Plus path-resolution fixes.

- **[ADR-0013](docs/adr/ADR-0013-retro-documentation-as-transmission-pointed-backward.md)** — retro-documentation as the transmission phase pointed backward: reconstruct the phase-6 kit (ADRs, architecture, threat model, runbook, handover) for an existing system that skipped it, as a structured elicitation-and-validation pipeline. runward reconstructs the transmission **kit**; it does not *realize* transmission (proven autonomy needs humans) — never "transmits / certifies / auto-documents". Brief and matrices in [docs/retro-documentation.md](docs/retro-documentation.md).
- **[ADR-0014](docs/adr/ADR-0014-the-characterize-command-contract.md)** — the `runward characterize` command contract: a read-only command emitting a deterministic `characterization.md` inventory (zero-LLM) plus, under an opt-in `--mine` flag, advisory `DRAFT-*.md` ADR candidates (`status: hypothesis`, `why: UNKNOWN`) written outside the gate. Read-only, never a runtime; nothing it emits can pass the gate until the operator ratifies it. *Implemented:* **(piece 1)** the **deterministic inventory** and the `runward characterize` command — parses dependency manifests + lockfiles, entrypoints, CI, tests and git-log shape into `runward/characterization.md` (facts, `confidence: high`), writing only into `runward/`; ends with operator next-steps. **(piece 2)** the ADR **`hypothesis → accepted` lifecycle**: `check --strict` now fails while any `runward/adr/` entry is an unratified reconstruction (a `DRAFT-` file, `Status: hypothesis`, or a leftover `why: UNKNOWN`), with an actionable ratify-or-remove message — the red gate is what forces the operator to own each reconstructed decision. **(piece 3)** `check --coverage` — an advisory report of deliverable and decision-ratification ratios (lists what remains to ratify; never gates), plus the scaffolded `mission/gap-analysis.md` template (the section-by-section brownfield audit that was prescribed by the workflow but had no template). **(piece 4)** `characterize --mine` — **deterministic git archaeology, no model call** (per an ADR-0014 amendment reconciling `--mine` with the zero-LLM-tool invariant and ADR-0007): proposes candidate structural decisions (the stack/language choice, containerization, the CI pipeline, notable dependency families) as `runward/adr/DRAFT-*.md` hypotheses with evidence pointers and `why: UNKNOWN`; the operating agent refines and the operator ratifies. The retro-documentation surface (ADR-0013/0014) is now **complete**, covered end-to-end by the smoke suite.
- **[ADR-0015](docs/adr/ADR-0015-regulatory-conformance-as-a-regional-profile.md)** — regulatory conformance as a **regional profile**: the OWASP ASI mapping and the deterministic manifest are the universal core; the named regulation is a swappable lens, **security-only by default**. Ships framing references (not gate logic) under [`docs/compliance/`](docs/compliance/) — ISO/IEC 42001 (global anchor), NIST AI RMF (US), EU AI Act (EU). Copy de-EU-first'd (README, positioning) — lead with the universal security posture, map to the buyer's regime. The gate stays regulation-agnostic.
- **Fixes:** `-p <absolute-path>` on `init`/`check`/`update`/`status` resolved to the wrong directory (`join(cwd, absPath)` → `resolve`), so an absolute project path works everywhere; the `characterize --mine` help text no longer says "not yet implemented".

## v0.9.1 — 2026-07-09

Docs-only patch. No change to the gate, the adapters, or any behavior.

- Reframe the gate adapters as **agent-agnostic**, holding runward's vendor-neutral line: the git `pre-commit` and CI adapters gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is the first shipped example of a per-harness turn-end hook, not a privileged one. Corrects the adapters `README.md`, the root README, ADR-0012, and the v0.9.0 notes — the shipped `templates/adapters/README.md` now leads with the agnostic seams.

## v0.9.0 — audit-ready alignment: OWASP ASI, ports & harness adapters — 2026-07-09

Ecosystem and doctrine alignment from the 2026 veille — each decision locked as an ADR first, then implemented (doctrine before code, per the method). Together they make the conformance manifest read as audit-ready supporting evidence and wire the deterministic gate into every harness, without adding any runtime surface. The gate stays zero-LLM and zero-run.

- **[ADR-0009](docs/adr/ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md)** — OWASP Top 10 for Agentic Applications (ASI01–10) as the gate's risk grammar. *Implemented:* 20 security/governance craft rules gain an `asi:` mapping (verified against the official OWASP taxonomy) so the conformance manifest reads as audit-ready supporting evidence that feeds an ISO 42001 / EU AI Act technical file; **3 new CVE-derived deterministic rules** (`security-mcp-server-pinning` [ASI04/10], `security-tool-change-reapproval` [ASI02/04], `data-memory-provenance` [ASI06]) — 51 → **54 rules**; floors updated (architect 6, govern 10); example migrated.
- **[ADR-0010](docs/adr/ADR-0010-agents-md-as-a-first-class-handover-deliverable.md)** — `AGENTS.md` as a first-class handover deliverable. *Implemented:* the `handover` workflow finalizes the `AGENTS.md` written at `init` as the receiving team's charter — the craft rules, the judgment boundaries (operator vs agent), the verification commands (including `runward check --strict`), and the never/PR rules — in the harness-neutral format every agent reads (Codex, Copilot, Cursor, Gemini, Amp, Claude Code).
- **[ADR-0011](docs/adr/ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md)** — neutral ecosystem standards as versioned ports. *Implemented:* `reference-stack.md` names MCP (pinned by spec version + server hash), OTel GenAI semantic conventions, agent identity (OAuth 2.1/PKCE, SPIFFE, Entra Agent ID) and A2A (deferred, distributed-topology trigger) as the pinned port contracts — referenced and re-tested behind the port, never implemented in the core.
- **[ADR-0012](docs/adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md)** — the gate as a port (its exit code is the contract), with **harness adapters** (the 2026 veille P0). *Implemented:* `init` emits 4 inert sample adapters under `runward/adapters/` — a `pre-commit` git hook, a `github-actions.yml` CI job, a `claude-code-settings.json` `Stop`-hook snippet, and a `README.md` pinning the exit-code port contract — so the deterministic gate runs at each harness's lifecycle seam. The git and CI adapters are **agent-agnostic** — they gate whatever agent produced the code (Codex, Claude, Cursor, Copilot, Gemini); the Claude Code `Stop`-hook is the first shipped example of a per-harness turn-end hook, not a privileged one. Opt-in and inert until the operator wires them (runward writes nothing into `.git/`, never a runtime); refreshed by `update`, verified by `doctor` (`EXPECTED_ADAPTERS`). Closes the opening incident at its root: the agent-agnostic seams re-run the gate regardless of harness.

## v0.8.0 — conformance-gate hardening — 2026-07-07

Hardening of the `--strict` conformance gate, from a code-level benchmark of the spec-driven competitors (BMAD, Spec Kit, OpenSpec, Spec Kitty). Each structural item is locked in an ADR first; the deterministic gate stays zero-LLM and zero-run — the LLM verification (P7) and the hook seam (P8) sit beside it, subordinate and opt-in.

- **P1 — harden `--strict` against vacuous passing** ([ADR-0002](docs/adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md)): a routed-count floor per phase (`EXPECTED_MAPPED`, enforced by `check --strict` and `doctor`) so the `phases:` mapping cannot be silently stripped; `n/a` reasons must be real, not empty or a `[placeholder]` token; the smoke suite plants a violation and asserts the gate catches it. Deterministic, zero-LLM.
- **P2 — deterministic form-lint of the manifest** ([ADR-0003](docs/adr/ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md)): before the semantic check, `check --strict` flags a rule listed more than once and a row whose slug is not a real rule (a typo that would otherwise silently hide a gap). Well-formedness before presence-of-decision.
- **P3 — advisory drift detection** ([ADR-0004](docs/adr/ADR-0004-advisory-drift-detection-of-applied-pointers.md)): `check --strict` reports (advisory, non-blocking) any `applied` pointer whose file path no longer resolves — the manifest snapshot stops silently rotting as the code moves. Existence only, deterministic, zero-LLM; pure-prose evidence is skipped.
- **P4 — baseline-worktree test validation: considered, not adopted** ([ADR-0005](docs/adr/ADR-0005-baseline-worktree-test-validation-out-of-scope.md)): running the project's tests in a worktree would violate the gate's zero-run, language-neutral invariant. Test-evidence honesty stays the project CI's job; P3 already catches a vanished test; an operator who wants baseline validation plugs it via the hook seam (P8).
- **P5 — rule-set evolution as tracked migrations** ([ADR-0006](docs/adr/ADR-0006-rule-set-evolution-as-tracked-migrations.md)): a machine-readable migration record (`rule-migrations`) turns a renamed or removed rule into a guided migration — a manifest citing an old slug now reads `renamed to '<new>' in <version> (<reason>)` instead of a bare "unknown rule". The rule set evolves by tracked delta, never by silent rewrite.
- **P6 — actionable `--strict` messages** (DX, no ADR — not a structural change): every conformance violation now carries a targeted fix hint (`add a row: applied with a file:line/test…`, `put a file:line or a test in the Evidence column`, `keep a single row per rule`, `restore the phases: [...] frontmatter`…), so the fix is in the message.
- **P7 — advisory LLM conformance verification** ([ADR-0007](docs/adr/ADR-0007-advisory-llm-conformance-verification.md)): a new `verify` workflow (`/rw-verify`) — an agent-executed, adversarial cite-vs-apply pass over the manifest ("does this code apply the rule, or only cite it?"). Advisory only: it emits findings, never an exit code, never blocks; `check --strict` stays the deterministic gate. Vendor-neutral (nothing bundled), strictly subordinate to the gate. Closes the one benchmarked weakness without touching the zero-LLM invariant.
- **P8 — opt-in hook seam around `check`** ([ADR-0008](docs/adr/ADR-0008-opt-in-hook-seam-around-check.md)): `check --hooks` runs operator-supplied `before`/`after` commands from `runward/hooks.json` around the audit; a failing hook fails the gate. Opt-in only — plain `check` never runs hooks, so a clone cannot execute anything by surprise. The extension point for language-specific proofs runward will not run itself (the P4 residual); runward's own gate stays deterministic and zero-run.

## v0.7.0 — rule-conformance gate — 2026-07-07

Implements [ADR-0001](docs/adr/ADR-0001-enforce-declared-rule-conformance-at-the-gate.md): craft rules become active at the gate, deterministically, across the architect, floor and govern phases. Motivated by a field test where an agent cited a rule (`frontier-deterministic-boundary`) without applying it and the floor still passed `runward check` green.

- **`runward check --strict`** (opt-in): verifies each phase's `Rule conformance` manifest — every CRITICAL/HIGH rule mapped to the phase must be `applied` (with a `file:line`/test pointer), `deviated` (with an existing ADR), or `n/a` (with a reason). Deterministic: it checks that a decision was traced, never the quality of the code; no LLM in the gate path. Default `check` is unchanged (non-breaking).
- Rule frontmatter gains an additive `phases:` field; 18 CRITICAL/HIGH rules mapped — architect (5), floor (10), govern (7). The expected set reads from the mission's `runward/rules/`, or the package rules as a fallback.
- `architecture.md`, `floor.md` and `governance/threat-model.md` gain a `Rule conformance` section; the `architect`, `floor` and `govern` workflows and the `AGENTS.md` charter direct the agent to confront the routed rules at the point of building and account for each.
- The `examples/request-triage` mission is migrated: it carries filled manifests and passes `runward check --strict` across all three phases (a worked mix of `applied` and reasoned `n/a`).
- The incident scenario now turns `check --strict` red. 3 smoke tests (incident → red, unbacked `applied` → red, migrated example → green across architect/floor/govern).
- Deferred, named with trigger (per ADR-0001): finer per-task `appliesWhen` routing — added on evidence.

## v0.6.0 — first public release — 2026-07-06

The first version published to npm (`npx runward init`); the repository goes public at `stranxik/runward`, the site at `runward.dev`, and the doctrine ships separately at `stranxik/designing-and-running-agentic-systems`. Bundles the feature work developed 2026-07-03 through the public-release wiring.

- Public release: live on npm; repository and site public; `repository`/`homepage`/`bugs` metadata point at them; README npm version badge; first public landing surface for `runward.dev`.
- Rule rename: `hexa-move-deterministic-out` normalized to its canonical id across the craft-rule set and the workflows that reference it (no rule added or removed by the rename).
- Rule-count reconciliation: `EXPECTED_RULES` pinned to the exact craft-rule count so `doctor` and the smoke test gate on the real number rather than a hand-kept figure.
- Runnable example: `examples/request-triage/code/` — the mission's floor implemented (deterministic guard on extracted fields, fail-closed compliance routing with suspension, abstention; 14 tests).
- Reference floor: two deferrals implemented — suspend & rehydrate on human approval (run serialized, process freed, exact resume) and prompt provenance (SHA-256 of the prompt actually sent, per call, re-read never replayed). 53 tests.
- 3 new async rules (post-turn pipeline, scheduled maintenance, job guardrails) — 51 rules total; `govern` workflow extended accordingly.
- New reference `shared-bricks.md` (placement families, brick matrix, sovereignty by data class, usage registry); tutorial `docs/first-mission.md` (first mission in 15 minutes, flow verified by execution).
- Language framing corrected everywhere: one single language in the core, which one is an adapter decision; TypeScript is the reference-stack sober default, sidecars on proven triggers.

---

_Pre-public development history — the versions below were never published to npm (the package starts at 0.6.0). Kept for provenance._

## v0.5.0 — 2026-07-03

- Example mission `examples/request-triage/` filled end to end: steering contract, decision matrix, four port contracts, threat model, evaluation rubric, observability schema, recovery runbook — `runward check -p examples/request-triage` passes clean and the smoke test asserts it
- `runward check` gates on more of the chain: the steering contract at Frame; the decision matrix and at least one filled port contract at Architect
- Placeholder detection no longer counts markdown links (`[floor note](floor.md)` is a cross-reference, not a gap)
- `runward status` dates each ADR from its own `**Date**:` line (file mtime as fallback)
- Craft-rule set at 48 rules; `doctor` and the smoke test verify the new count
- Framing rebalanced across README, docs, workflows and the agent charter: the guiding principle (the architecture frames the model) is the method's opening posture; the six phases, five gestures, decision matrix and craft rules carry the whole
- "Operator" terminology propagated where the role was still called "the engineer"
- Packaging: `repository` / `homepage` / `bugs` metadata, `prepublishOnly` guard, `CONTRIBUTING.md`, `SECURITY.md`, this changelog

## v0.4.0

- Reference floor `floor-ts/`: clonable hexagonal TypeScript scaffold (23 tests, zero keys by default, provider profiles, day-zero cost cap) + its craft companion `floor-ts/AGENTS.md`
- New templates: `mission-contract.md` (one-page steering contract, 4 engagements with DoD, decision gates) and `reference-stack.md` (default adapter kit per layer with triggers)
- Fidelity audit of all 10 workflows against their sources — 10 major losses fixed (mentor posture, 8 DoR conditions, boundary-principle rooting, 2-of-3 window rule, hardened handover DoD, the five review hats…)

## v0.3.0

- The craft rules shipped with the mission (`runward/rules/`) — memory, state, resilience, observability, security, scaling depth
- Full 22-arbitration decision matrix (`runward/decision-matrix.md`)
- `runward update` covers rules; `doctor` verifies rule completeness
- README reflects the four broken assumptions and five gestures, not just the guiding principle

## v0.2.0

- CLI rebuilt on commander/chalk/@inquirer: interactive wizard, `--yes`, `--dry-run`, `--no-color`, exit codes, error handlers
- `runward check`: gate audit (which expected deliverable is missing at the current phase)
- `runward status`, `runward doctor`, `runward update` (drift-aware, mission state never touched)
- Tool profiles: GitHub Copilot, Gemini CLI, Windsurf (AGENTS.md always written)
- Example mission (end-to-end, anonymized)

## v0.1.0

- Mission structure (`runward/`) with gates per phase
- Missing templates created: `framing.md`, `architecture.md` (structure existed only in prose before)
- Workflows in English, executable by an agent
- `runward init` CLI
- Tool profiles: Claude Code, Cursor
- License split: tooling MIT, doctrine CC BY-ND canon (see NOTICE.md)
