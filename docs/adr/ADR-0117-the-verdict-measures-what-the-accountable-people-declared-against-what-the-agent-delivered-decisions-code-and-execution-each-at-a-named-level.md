# ADR-0117 — The verdict measures the gap between what the accountable people declared and what the agent delivered, on evidence the agent could not produce alone: decisions, code and execution, each at a named level

**Date**: 2026-11-05
**Status**: accepted (2026-11-05). Constitutional, class R under ADR-0088 decision 2: it amends ADR-0001,
the founding decision, and the ceiling of the public claim
**Deciders**: the maintainer, by delegation in chat on 2026-11-05, in these words (translated from
French): « runward must perhaps cover more than what we imagined. Everything has evolved. » and « In what
I have to do there are items that you can do, and where you even make recommendations to me. After having
investigated. So I trust you: carry it out each time instead of asking me. » Accepted on the
recommendation of the agent sessions that investigated (scratchpad inv-S1, inv-S2); the maintainer did not
review this text before acceptance. This is a delegation, not a review. The words were relayed to the
session that wrote this record by the session that received them. Under ADR-0088 decision 4 the
maintainer is the single accountable person, and the agent's writing is disclosed throughput, not
independent review; as ADR-0088 decision 3 asks, the act is recorded by an agent session (agent), for
`github:stranxik` (accountable). The delegation does not amend `runward/delegation.md`, where class R stays
the maintainer's and `scope-D` covers non-constitutional ADRs only: this acceptance stands outside the
charter, and the record lands when the maintainer approves its pull request
**Method**: an investigation of 2026-11-05 by agent sessions, outside this repository. (1) What
regulators, standards and buyers expect from 2026 to 2028 of whoever governs and verifies software written
by agents, read in primary sources where they are public: the Official Journal texts through CELLAR
(Regulation (EU) 2024/1689 and 2026/1744, 2024/2847, 2022/2554 and Delegated Regulation 2024/1774,
Directive 2022/2555 and Implementing Regulation 2024/2690, Directive 2024/2853, Decision 2026/2274), NIST
SP 800-218 and 800-218A, SLSA 1.2, the in-toto attestation repository, PCI DSS 4.0.1, the guidance of
BaFin, ANSSI and BSI; paid standards and analyst notes only as secondary sources, marked as such and not
relied on. (2) A static prototype analyzer (124 lines, no dependency; it runs nothing and reads, besides the
sources, only the committed JUnit report, to compare its census with the test sources) and a mutation
mini-harness, run with runward 0.46.0 and `main@8ffdf7c` on copies of the shipped example
mission carrying the investigation's sabotages. (3) The synthesis of six parallel investigations and two
adversarial reviews. Read on a fresh clone of `stranxik/runward` at `main@61d5041`: ADR-0001, 0005, 0012,
0039, 0041, 0043, 0046, 0052, 0054, 0055, 0060, 0065, 0073, 0080, 0088, 0089, 0090, 0093, 0098,
`docs/positioning.md`, `GATE_NON_SCOPE` (`src/lib/rules.ts`), `test/unit/positioning-drift.test.js`,
`runward/delegation.md`
**Relates to**: [ADR-0119](ADR-0119-three-levels-of-proof-and-one-required-level-each-row-says-whether-its-evidence-is-re-derived-attested-or-declared.md)
(the levels), [ADR-0120](ADR-0120-an-executor-outside-the-cli-runward-run-executes-the-tests-in-a-pinned-container-and-the-operators-ci-signs-what-it-wrote.md)
(the executor), ADR-0118 (the built-in analyzers, written on branch `feat/built-in-analyzers`, not merged
on 2026-11-05), ADR-0113 to ADR-0116 (verify, the vacuous green, the example and `requires:`, the supply
chain: other pull requests in progress on 2026-11-05)
**Amends, by name**: ADR-0001 (decision 3); ADR-0005, with ADR-0120; ADR-0041 and ADR-0043 (the
`hypothesis` class); `GATE_NON_SCOPE`; the differentiator of `docs/positioning.md`. Each amended record
receives its dated note in the pull request that ships the change it announces, one delivery ahead of the
code, as ADR-0093 does; no accepted decision is rewritten
**Does not touch**: ADR-0052 decision 1, the locked thesis; the five crossings of ADR-0054 in the CLI

## Context

**What the verdict covers, measured on 2026-11-05.** runward 0.46.0 and `main@8ffdf7c` give the same
results. Each sabotage ran on a fresh copy of the shipped example mission (`examples/request-triage`): one
mission and one language, so the table is indicative and is not a false-positive rate. "Refused" means
`check --strict` exits non-zero.

| Sabotage | 0.46.0 as shipped | 0.46.0, reports regenerated in CI before the gate | Static prototype, no execution | What stops it |
|---|---|---|---|---|
| 1. The domain rewritten under the cited names: `pg` imported into the declared core, an `sk-live-` key in the source, SQL text concatenated | exit 0, output identical to the byte | refused | refused: boundary, secret | a re-derived reading of the code |
| 2. A file inside the declared core that calls a model and executes its answer (`execSync`, `eval`) | exit 0 | refused | refused: boundary, capability, secret | a re-derived reading of the code |
| 3. Twelve stub files and a forged one-case JUnit report | exit 0 | refused | refused: cited symbols declared as constants, a test file importing nothing it claims to exercise | a re-derived reading of the code |
| 4. Test cases emptied of their assertions, the JUnit report regenerated | exit 0 (refused when the test file was sealed and not re-sealed) | refused | refused: cases that assert nothing | a re-derived reading of the tests |
| 5. Sabotages 1 and 4 together | exit 0 | refused | refused | a re-derived reading |
| 6. A clean rename, the old name left in a comment, re-sealed | exit 0 | exit 0 | refused: the cited name occurs only in a comment | a re-derived reading (ADR-0114) |
| 7. The executor of sabotage 2 placed outside the declared territory | exit 0 | not measured | flagged (`eval` and a process execution reported) only under a policy that looks for code-execution sinks in every source file; the recorded exit of that run was 0, to measure again | a re-derived reading, under that policy |
| 8. Every assertion replaced by `assert.ok(true)`, the calls kept, re-sealed | exit 0 | exit 0 | exit 0 | an attested mutation of the cited lines: on 13 sampled mutants, the original tests kill 11, the weakened ones 5, none of them through an assertion (none is left that could fail) |
| 9. A forger who rewrites the code, the tests, the rules and the reports | not refused | not refused | not refused: the forger writes what the analyzers read | an attestation under an identity the forger does not hold |
| Controls: the healthy mission, and an honest rename re-sealed | exit 0 | exit 0 | exit 0, no finding | they must stay green |

Rows 1 to 5 are the seven sabotages of the investigation's laboratory (two of them in two variants); with
reports regenerated in CI, 0.46.0 refuses them in 14 runs of 14, the agent's re-seal included, with no
false red on the controls. Rows 6 and 8 were measured once, after the real tools regenerated the JUnit,
ESLint and coverage reports and the tree was re-sealed. Row 9 is not a measurement: a gate that reads only
the tree cannot tell a consistent forgery from the real thing. The prototype took 0.08 s on the tree where
`check --strict` took 0.28 s. A motif for SQL injection, tried in the same prototype, was found in one file
and missed in another: a heuristic, not an invariant.

**What this says.** By default the gate verifies that the documents point to names that exist and that
nothing cited moved since the seal. It does not look at the code those names live in, nor at where the
reports it reads come from, and it says so on every run (« runward did not run your code »). But the exit
code and the last line are the same for a healthy mission and a sabotaged one, and that is what a pipeline
reads. The bridge to the code already exists in the engine, and it holds only when the reports are
produced out of the agent's reach: committed by hand, a 93-byte ESLint JSON satisfies `requires:`. One
`check --freeze`, which any agent can run, re-arms the seal on a sabotaged tree.

**What the expectations ask.** None of the eight main EU texts read mentions code generated by a model
(a search with a positive control); they apply the existing rules to it, and NIST SP 800-218A does "not
distinguish between human-written and AI-generated source code". They converge on four things:

- a change recorded, tested, assessed, approved and verified (Regulation (EU) 2022/2554 art. 9(4)(e);
  Delegated Regulation (EU) 2024/1774 art. 17; Implementing Regulation (EU) 2024/2690 annex, points 6.4
  and 6.5; PCI DSS 4.0.1 requirement 6.2.3);
- an approval independent of whoever requests or implements the change (Delegated Regulation 2024/1774
  art. 17(1)(b));
- source code reviewed statically and dynamically, its integrity protected, third-party and open-source
  code tested before production (the same regulation, art. 16(2), (3), (7) and (8)), components checked
  for known exploitable vulnerabilities (Regulation (EU) 2024/2847 art. 13(5) and annex I);
- a technical file with the design choices and their rationale and with test reports dated and signed by
  the responsible persons (Regulation (EU) 2024/1689 annex IV, points 2(b) and 2(g), for the high-risk
  systems of annex III from 2 December 2027 and of annex I from 2 August 2028, as Regulation (EU)
  2026/1744 set them), kept ten years (Regulation 2024/2847 art. 13(13); Regulation 2024/1689 art. 18) and
  disclosable (Directive (EU) 2024/2853 art. 9 and 10).

They do not ask for a verifier without a model, nor for an absence of people: the signature of the
responsible persons, the management body's final responsibility (Regulation 2022/2554 art. 5(2)(a)) and
an approval (PCI DSS 4.0.1 requirement 6.2.3.1) remain. What they reward is a verification an auditor can
run again. The original perimeter answers the design-choice expectation and part of the approval one: the
decision. Code, tests and their provenance are checkable without a model, and they were outside the
perimeter ADR-0001 drew.

**What ADR-0001 refused, and what it did not.** ADR-0001 discarded « an auto-blocking quality gate (an
LLM or heuristic that fails the build on a "bad" artifact) » because the operator owns every gate and
runward must not become a framework that decides for you, and it discarded an LLM judge. A deterministic
check of an invariant the accountable people declared (the declared core imports no infrastructure; no
value of a known secret shape sits in the tree; a cited symbol is code and not a comment) is neither a
model nor a judgement of quality: the people who answer for the system declared the invariant, and the
gate reports whether the delivered bytes violate it. A heuristic stays what ADR-0001 refused.

## Decision

**The verdict measures the gap between what the accountable people declared and what the agent
delivered, with evidence the agent could not have produced alone.** It reads three objects, each at a
named level. The levels are ADR-0119's: `re-derived` when runward recomputes the fact from the tree,
`attested` when the fact was produced outside the agent's reach and is bound to the tree, `declared` when
it rests on what someone wrote.

1. **Decisions, traced and linked to evidence that resolves.** The core since ADR-0001, ADR-0019 and
   ADR-0056, unchanged. The links are `re-derived`. The decision itself, an `n/a` or `deviated` answer
   with its reason, and a ratification are what the accountable people declared: the reference the
   verdict measures against, which no level grades (ADR-0119); a ratification trace stays declared
   provenance (the last sentence of `GATE_NON_SCOPE`).
2. **Code, confronted with the invariants the mission declares, and re-derived by runward itself from the
   tree**: no model, no execution, the bytes at rest. Where: the declared territory (ADR-0043, ADR-0078)
   and the cited files. What: the invariants the accountable people declared, or accepted with the
   shipped analysis policy, in families ADR-0118 names and classifies; from the prototype, the first ones
   are the boundary of the declared core, the capabilities it may use, secrets of known shapes (a provider
   key, a private key, a URL that carries credentials: a listed shape is an invariant, a secret of another
   shape is out of its reach), the integrity of the tests, and the cited symbols. A policy that looks
   only inside the declared core misses an executor placed outside it (row 7 of the table); how far the
   shipped policy reaches is ADR-0118's to decide, measured against that row. Level: `re-derived`. A file
   in a language no analyzer reads is "not analysed", named, and never counted as re-derived; no mission
   is refused by default for its language (ADR-0119 decision 4). A heuristic reading is a `hypothesis`:
   labelled, behind its own opt-in, never counted, never mixed with an invariant's finding.
3. **Execution evidence, produced outside the agent's reach, bound to the tree by digests the gate
   recomputes, and attested under an identity the agent does not hold**: tests, coverage of the cited
   lines, mutation of the cited lines, evals, and the reports a `requires:` nature names. The executor is
   `runward-run`, a sibling package (ADR-0120), never the CLI. Level: `attested`; its identity check is
   made outside the CLI (ADR-0093, ADR-0119).

**What the verdict still never says**: that the code is good, that it implements the rule, that a person
answered, or that the code under test behaved while it ran (it is the agent's code, executed as written).
Semantics, intent and quality stay outside. A green says which invariants were checked on which files,
which executions were attested, and what rests on a declaration.

### What it amends, by name

- **ADR-0001.** « never the quality of an implementation » and « no LLM sits anywhere in the gate path »
  stand. What the gate verifies widens from the presence of a traced decision to the three objects above.
  In decision 3, « It never opens project code » falls for the declared territory and the cited files:
  the gate reads their bytes to confront them with the declared invariants. « never runs tests » stands
  for the CLI. « never judges whether the pointer truly implements the rule » stands. The discarded
  alternative, an LLM or a heuristic that fails the build on a "bad" artifact, stays discarded: an
  invariant is declared by the accountable people and checked as a fact, and a heuristic stays outside
  the verdict.
- **ADR-0005**, with ADR-0120. The CLI still runs nothing, and « runward did not run your code » stays
  true of `check` (`test/smoke.js` pins it). Language neutrality holds by construction: the analyzers are
  per-language adapters behind a port, and an unknown language yields a named absence, never a guess. The
  execution half moves to a sibling package, and ADR-0120 amends ADR-0005 for it.
- **ADR-0041 and ADR-0043, the `hypothesis` class.** Their refusal stands where it was aimed: a content
  signal that concludes an obligation from code (that a rule applies, that a file belongs to a category)
  is a hypothesis presented as a fact, and the reach of a rule is still declared, or derived from
  declarations. Two things change. Reading code to check an invariant the mission declared is not a
  content signal: the obligation is declared, and only the fact is read. And the separately labelled
  `hypothesis` class ADR-0041 left to « its own decision » is opened here, for heuristic readings only,
  under the conditions ADR-0041 wrote: its own opt-in flag, never mixed with declared matches, never
  counted.
- **`GATE_NON_SCOPE`** (`src/lib/rules.ts`). It gains one sentence, in the pull request that ships the
  first analyzer and not before: inside the declared territory the gate confronts the bytes with the
  invariants the mission declared, and a green says none of the checked invariants is violated, never
  that the code is good. The sentence on time (« code added later under the same rule is never
  re-judged ») narrows the same way: code added later inside the declared territory is checked again
  against the declared invariants on every run, and is still never judged against the rule's intent. A
  non-scope that narrowed ahead of the code would claim what the gate does not do. Its other sentences
  stand.
- **The differentiator of `docs/positioning.md`.** « linked, not judged » becomes, at its fold: decisions
  linked, code confronted with the invariants declared for it, execution bound and attested, never
  judged. « never that the code is good » stays at the character. The fold follows the code, passes
  `test/unit/positioning-drift.test.js`, and is not made by this record.

### What it does not touch

- **ADR-0052's locked thesis.** Every clause `test/unit/positioning-drift.test.js` pins stays true, word
  for word. Independence: the analyzers are runward's, deterministic, in the operator's repository, and
  execution evidence comes from outside the agent's reach, so the judged party still does not manufacture
  the judge. Survival: a re-derived fact re-runs on the repository alone, byte for byte; an attested one
  re-derives its binding from the reports, the Statement and its signature bundle committed with the tree
  (ADR-0120 decision 6), and its identity is checked against that bundle and the trust policy (ADR-0093
  decision 8). Agent-agnosticism: nothing here reads the agent.
  « zero LLM in the verdict path » and « living in the repository it judges, owned by the operator » are
  unchanged, and so are the pinned differentiator (« re-derivable offline months later — on the repo
  alone »), the stage distinction and « input to your release gate ».
- **ADR-0054 in the CLI.** The five crossings are unchanged. The analyzers read files of the working tree
  being judged, with no second tree, no history, no network and no model. `runward-run` executes outside
  the `runward` package, in the operator's CI (ADR-0120 carries the note on ADR-0054).
- **ADR-0046 for runward's own suite.** It is amended for adopters only (note F).

### Three notes the investigation added

- **E. Three records reopened, decided here, built in their own pull requests.**
  - ADR-0098 option F (source digests declared by the report and recomputed by the gate), with the
    weakness it wrote corrected: the writer no longer chooses the source set. The expected set is derived
    from the declared territory and the citations, and a report that declares a narrower one does not bind
    (ADR-0120).
  - ADR-0073: option 1 stands for a committed report, which reads `declared`; a report written by
    `runward-run` and bound to the tree reads `attested`; option 3, a reference to an external run, stays
    unchosen: it reaches outside the judged tree (crossing 4), and the gate reads files at rest.
  - ADR-0065: the arming order of `requires:` that ADR-0073 attributes to it (teach, demonstrate,
    document, then refuse) reaches its last step at the `attested` level, asked by name or by the lock
    (ADR-0119), never as a default that moves an existing mission's verdict.
- **F. ADR-0046 amended for adopters.** A mutation result on the lines a row cites is a fact about that
  row: can the cited tests fail when the cited lines change. `runward-run` produces it and the gate reads
  it at `attested`. It is never a score, never a percentage threshold, never a ratchet imposed on an
  adopter, and its survivors are listed, never summed. ADR-0046's decision for runward's own suite is
  unchanged.
- **G. Three class R anchors.** The declared territory (`runward/territory.md`), the analysis policy (its
  file is ADR-0118's to name) and the seal (`runward/evidence-lock.json`) decide what the analyzers read
  and what stays frozen: an agent that narrows the first, relaxes the second or re-seals a sabotaged tree
  defeats them. For runward's own mission the three join the charter's `pre-merge-paths` at its next
  renewal, the maintainer's act in its own commit; this record does not edit the charter. For an adopter,
  the attestation of ADR-0120 binds their digests at run time, and the forge protects them (code owners, a
  required review by an identity other than the agent's); the record of that protection is the forge's,
  read outside the verdict path (ADR-0080 part 2), and the CLI never assumes it.

### The twelve capabilities, and where each stands

The investigation inferred twelve capabilities a leader holds by the end of 2027 from the expectations
above, ranked by how many expectations each bears on, by deadline, and by whether a deterministic tool can
hold it. Each row says where runward stands on 2026-11-05, which records carry the work, and the class of
the decision it asks for (ADR-0088 decision 2: R trust roots and constitutional records, I irreversible
public acts, D reversible or internal acts). "In progress" means a pull request not merged on 2026-11-05.

| # | Capability | Expectations it bears on | State on 2026-11-05 | Workstream and records | Class |
|---|---|---|---|---|---|
| 1 | Evidence produced outside the agent's reach: tests, static and dynamic analysis and dependency scans regenerated by a CI the agent does not control, signed, bound to the tree | Delegated Regulation 2024/1774 art. 16(2), (3), (7), (8) and 17(1)(a); Implementing Regulation 2024/2690 annex 6.2 and 6.5; Regulation 2024/2847 annex VII point 6; Regulation 2024/1689 annex IV 2(g); NIST SP 800-218A; PCI DSS 4.0.1 req. 6.2.3 | The bridge exists, not by default: rows 1 to 5 are refused when the mission cites reports regenerated in CI; the shipped example cites one committed JUnit report; `requires:` is disclosed and never refused; nothing runs out of the agent's reach | ADR-0115 (the example takes the machine-evidence path; in progress); ADR-0120 (`runward-run`); ADR-0119 (`attested`); ADR-0098 F and ADR-0073, reopened (E) | R |
| 2 | Independence shown: who authored a change (a person, an agent, a tool) and who approved it, read from the forge; the verdict outside the agent's loop and outside its vendor's systems | Delegated Regulation 2024/1774 art. 17(1)(b); SLSA 1.2 source track; PCI DSS 4.0.1 req. 6.2.3.1 | Approvals are not read (ADR-0080 part 2, planned in D5); the verdict can already run outside the agent's loop, in the operator's CI; runward's own charter is at stage 1, declared, not proved | ADR-0080 part 2; ADR-0094; ADR-0088 stage 2 | R |
| 3 | Traceability from a requirement to a decision to evidence that resolves | Regulation 2024/1689 art. 11 and annex IV 2(b); Regulation 2024/2847 annex VII; Delegated Regulation 2024/1774 art. 16(3) | The core, shipped; a cited symbol is still met by a comment (RWD-2026-0194) | ADR-0114 (symbols outside comments, the vacuous green refused by name; in progress); ADR-0001, ADR-0019, ADR-0056 | R |
| 4 | A complete change record: purpose, scope, risk, security effect, rollback, emergency changes assessed again | Regulation 2022/2554 art. 9(4)(e); Delegated Regulation 2024/1774 art. 17(1)(d) to (h); Implementing Regulation 2024/2690 annex 6.4; PCI DSS 4.0.1 req. 6.5 | Not built | ADR-0093 D2 (`ledger`, `runward-change-row/1`, the deposit on the change request) | R for a git reader, D for the deposit |
| 5 | Diligence on the components an agent adds: detected, existing (no invented package), checked against known vulnerabilities on a frozen snapshot, maintained; a machine-readable SBOM | Regulation 2024/2847 art. 13(5), annex I part I(2)(a) and part II(1) and (3); Delegated Regulation 2024/1774 art. 10(2)(d) and 16(8) | Not built for an adopter's tree; runward's own SBOM is attested (ADR-0048) | ADR-0118 (dependency facts from the manifest and the lockfile; in progress); a frozen advisory snapshot in the tree, under its own record | R |
| 6 | Durable attestations: in-toto, a VSA, CycloneDX or SPDX, verifiable offline for ten years by later versions, a forged field refused | Regulation 2024/2847 art. 13(13); Regulation 2024/1689 art. 18; Directive 2024/2853 art. 9 and 10; SLSA 1.2 | Partial: an unsigned Statement and a VSA are emitted; `verify` answered verified over forged fields (RWD-2026-0192); an older attestation is checked with the version that wrote it | ADR-0113 (`verify` says verified only for what it re-derives; in progress); ADR-0055; ADR-0120 (the run Statement) | R |
| 7 | Determinism and qualifiability: one input, one verdict on every operating system; a stability policy; a maintained line; a qualification kit; the installed tool equal to the tested one | Delegated Regulation 2024/1774 art. 16; Directive 2024/2853 art. 10(4); tool qualification in safety sectors (secondary sources) | Partial: one verdict per tree and version across three Node.js releases, another time zone and another locale (measured on macOS, not on Linux); RWD-2026-0187 fixed on `main`, not released; the latest minor only; the kit ships (ADR-0087); the installed dependency tree is not frozen | ADR-0112; ADR-0116 (the supply chain; in progress); ADR-0068 (a maintained line, reopened by a second maintainer); a release | R; I for a release |
| 8 | An inventory, and the provenance of each change's author: agent, model, version, instruction files; recorded, never a condition | BaFin guidance on ICT risks when using AI (18 December 2025, non-binding); ANSSI and BSI on AI coding assistants (4 October 2024); OWASP Top 10 for Agentic Applications | Not built: agent names appear in ratification entries only | ADR-0093 D2 and D3 (records, the event stream); ADR-0082 | R |
| 9 | Controls of agentic failure modes: model output executed, undeclared model calls, secrets, the agent's configuration changed, tests disabled | OWASP Top 10 for Agentic Applications (ASI04, ASI05); BaFin guidance (static analysis of calls to AI functions); Delegated Regulation 2024/1774 art. 16(3) | A prototype outside this repository (rows 1 to 7 of the table above) | ADR-0118 (built-in analyzers; in progress); ADR-0119 (`re-derived`); note G | R |
| 10 | An authenticated human ratification of the residue: a verifiable identity and a declared role, limited to what the machine does not establish | Regulation 2024/1689 annex IV 2(g); Regulation 2022/2554 art. 5(2)(a); PCI DSS 4.0.1 req. 6.2.3.1 | Declared: names as written; `ratify --decided --all` is scriptable in 1.3 s (RWD-2026-0119); the regulated tier binds a ratification to its row's digest (ADR-0080 part 1) | ADR-0080 part 2; ADR-0088 stage 2 (a hardware key in `allowedSigners`); ADR-0090 (the residue named) | R |
| 11 | Executable mappings to DORA, NIS2, the CRA, the AI Act (EN 18286:2026), ISO/IEC 27001 and 42001, PCI DSS, SOC 2 and the SSDF, each line saying whether runward's evidence re-derives the fact it asks about, supports it, or does not cover it, never that it is met; an OSCAL export | Decision (EU) 2026/2274, which cites EN 18286:2026; the texts above | Partial: OSCAL component definitions for ISO/IEC 42001, the NIST AI RMF and the EU AI Act; CRA, NIS2, DORA and GDPR lenses placed by ADR-0099, the DORA reading deferred to D3; no lens qualifies its lines this way | ADR-0015, ADR-0016, ADR-0076, ADR-0099, ADR-0101; one lens per regime | D for a lens; R for any sentence that raises the public claim |
| 12 | The loop after delivery: verdicts linked to versions, checked again on each new vulnerability or drift, the affected deliveries listed within hours | Regulation 2024/2847 art. 14 (from 11 September 2026); Regulation 2024/1689 art. 72; Delegated Regulation 2024/1774 art. 10 | Not built; runward keeps its own defect register only | ADR-0093 D2 (`ledger replay`), D3 (the period, the event stream), D5; `runward-fleet` | R |
| — | Outside the product: an organisation that can contract (service levels, vulnerability handling, continuity) the day a contract exists | Regulation 2022/2554 art. 28(1)(a) and 30(3)(e); Regulation 2024/2847 once runward is placed on the market against payment | None: one person, no entity | ADR-0052 part 3, branch A | the maintainer's, outside the charter |

## Alternatives discarded

- **Keep the perimeter and say it louder.** The measurement shows the default exits 0, with an output
  identical to the byte, on a rewritten domain; the expectations ask about code, tests and their
  provenance. A louder non-scope answers none of it.
- **A model in the verdict path, reviewing the code.** Refused by ADR-0001 and ADR-0007: it is not
  deterministic, it carries the judge's bias, and it puts a vendor inside the judge, which would make the
  thesis's independence clause false.
- **Infer obligations from code**, a content signal that decides which rule applies. ADR-0041's refusal
  stands; this record reads code only to check what was declared.
- **Leave code entirely to the adopter's tools, through `requires:`.** Kept as an input, not enough alone:
  the reports are written by whoever runs the tools, a hand-committed one satisfies the field, and the
  agent can edit the tools' configuration.
- **Run the tests in the CLI.** ADR-0005 and ADR-0054: the gate would hold a runtime. The execution moves
  to a sibling package instead (ADR-0120).
- **Judge quality** (complexity, style, a coverage percentage). These are scores, not declared invariants;
  ADR-0046 refuses a score as a crossing condition and ADR-0093's view rules refuse a composite percentage.
- **Wait for the pilot of ADR-0052 before widening.** The expectations are dated and read at the source,
  and the pilot's calendar belongs to a third party; the decision rests on the research, and the pilot
  validates it afterwards.

## Consequences

- **Positive.** The verdict will read the three objects the expectations name, without a model. Rows 1 to
  7 become refusable by re-derivation, with no CI change. Rows 8 and 9 become refusable by a pipeline that
  checks both halves of `attested`: the CLI alone refuses an unbound report, an unsigned Statement and a
  mutation fact with no kill, and only the identity check refuses a forger's own signature (ADR-0119
  decision 5). The public question, who verifies what the agent delivered, gets a mechanism for an
  answer.
- **Negative, accepted.**
  - The CLI reads the source files of the declared territory: a larger read set, which the attestation's
    subject must then cover (ADR-0055's amendment of 2026-08-14 bound the subject to the files the verdict
    reads, the mission tree and the cited evidence, and the analysed territory joins them), and which
    `verify` and the witness must re-derive (ADR-0113, ADR-0089).
  - Per-language analyzers to maintain. The first reads JavaScript and TypeScript, the shipped example's
    languages; any other language reads "not analysed" until an adapter exists.
  - Wiring an analyzer into the verdict touches the charter's pre-merge paths (`src/lib/verdict*`,
    `src/lib/evidence*`), so each of those pull requests waits for the maintainer (ADR-0088 decision 7,
    ADR-0090 decision 10); a new analyzer module outside those globs is on no pre-merge path until the
    charter's next renewal names it, the maintainer's act.
  - Three more class R anchors, so more of the maintainer's acts on runward's own mission.
  - A sibling package that runs code (ADR-0120), whose first publication meets the npm bootstrap
    `runward-forge` still waits on (RWD-2026-0195).
  - An existing mission keeps its verdict until its operator opts in, as ADR-0069 did for the structure
    contract; a new mission gets the new default (ADR-0119).
- **On other boundaries.** ADR-0090's list of what no machine control catches narrows in one place: its
  item 6, the net weakened in the same change, at `attested` and for one case, an assertion weakened on a
  cited line, which the mutation of the cited lines refutes. A deleted test outside the citations, a
  dropped relation or a lowered run count stay in item 6, and item 7, the quality of evidence, is
  unchanged: a checked invariant is a fact about the bytes, not a judgement of the evidence.
- **Nothing ships with this record.** No CLI behaviour, output or verdict changes until the records above
  land, each with its tests.
- **Words.** "re-derived", "attested", "declared", "confronted with the declared invariants". A run never
  says that the code is verified, secure or good, and the forbidden words of `docs/positioning.md` stay
  forbidden.

## What would settle it

**For**, three measurements, each published with its command:

1. **The sabotage table above, replayed** on a fresh copy of the shipped example for each row, with the
   release that ships ADR-0118 and ADR-0119:
   - under the default configuration of a new mission (`init --example`, its lock as `init` writes it,
     the example as that release ships it, its two prose rows typed), rows 1 to 7 exit non-zero, row 7
     measured again with the real analyzer, and the two controls exit 0 with no finding;
   - under `--require attested`, with `runward-run`'s reports bound and signed by the workflow of ADR-0120,
     row 8 exits 5 with the mutation fact named on its row, and the controls exit 0;
   - row 9 is refused by the identity check, measured on a laboratory repository: a Statement the forger
     signs with a key of its own, or from the mission's own workflow, does not verify against the trust
     policy, and an unsigned one reads `declared` in the CLI.
2. **False reds, measured before the default of new missions moves.** The analyzers run on at least three
   real repositories that runward did not write, in the languages the analyzers claim to read; every
   finding is classified true or false by a reviewer who did not write the analyzer (a separate session at
   least), and the classification is published with the commands that reproduce it. The default moves
   only when zero false reds remain after the fixes, on all three; a family that cannot reach zero stays
   behind its own opt-in.
3. **The locks hold.** `test/unit/positioning-drift.test.js` stays green with no change to the clauses it
   pins; `test/unit/runtime-boundary.test.js` stays green with the analyzers inside the verdict closure (no
   socket, no spawn); `test/smoke.js` still finds « did not run your code ».

**Against**: an invariant family that needs, on any of the three repositories, more exceptions than the
invariants it checks; a row of the table caught only by a heuristic (it then belongs in the
`hypothesis` class, and the table says so); an assessor or a buyer who reads a re-derived code row as a
judgement of quality despite the wording.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-11-15, the target date the maintainer gave, relayed with the delegation, for runward to
verify agent-written deliveries itself, for enterprise use. It is a dated reading, not a promise of
delivery: that day the capability table is read again, each state measured again, and every capability
still short of what its row describes is listed as such in the CHANGELOG and the README rather than
dropped. Then on 2027-02-05. Earlier on: a false red on a real repository that no declared invariant
explains; the first assessor's reading of a re-derived code row; the deadline of ADR-0052 (2026-11-17)
concluding that the thesis stays a thesis; an in-toto predicate for the provenance of agent changes
reaching a release (capability 6).

**Trigger set on**: 2026-11-05 · **Watched via**: the sabotage table once it joins the attack corpus
(`test/audit-corpus.js`, with ADR-0118), the published classification of findings on real repositories,
and the capability table of this record.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md),
  [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md),
  [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md),
  [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md),
  [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md),
  [ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md),
  [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md),
  [ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md),
  [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
  [ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md),
  [ADR-0056](ADR-0056-the-evidence-layer-widens.md),
  [ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md),
  [ADR-0065](ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md),
  [ADR-0069](ADR-0069-the-structure-contract-is-the-default-for-new-missions.md),
  [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md),
  [ADR-0078](ADR-0078-the-domain-core-is-a-category-and-one-written-absence-is-reopened.md),
  [ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
  [ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
  [ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
  [ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md),
  [ADR-0098](ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md).
- `src/lib/rules.ts` (`GATE_NON_SCOPE`), `docs/positioning.md`, `test/unit/positioning-drift.test.js`,
  `test/smoke.js`, `runward/delegation.md`.
- RWD-2026-0119, RWD-2026-0187, RWD-2026-0192, RWD-2026-0194 and RWD-2026-0195 in
  [known-defects.md](../compliance/known-defects.md).
- The investigation notes and the synthesis of 2026-11-05, outside this repository.
