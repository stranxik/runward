# Tool Operational Requirements — runward

**Register date**: 2026-10-08 · **Describes**: runward 0.43.1 · **Status**: third edition, extended for 0.43.0, for ADR-0089 and for RWD-2026-0165

> **Third edition (2026-10-01).** The second edition described 0.34.0 and declared, as dated debt,
> that the verdict layer (`check --through`, `check --attest`, `runward verify`, `runward bundle`,
> `runward spec-check`) had no requirement row. Sections 10 to 12 cover it. Sections 13 to 22 cover
> what came after: proposals and `ratify` (ADR-0066), the regulated tier (ADR-0080), agent
> ratification (ADR-0082), the classes of exit 2 (ADR-0083), the wider `--json` surface, the armed
> gate (`wire --install`, `gate-hook`, ADR-0065), and the CLI audit of 2026-09-27
> (RWD-2026-0124 to RWD-2026-0162). TOR-001 to TOR-051 are unchanged. What is still uncovered is
> named in section 24.
>
> **Extended for 0.43.0 (2026-10-02).** TOR-158 to TOR-184 (section 15) cover independence by
> canonical id (RWD-2026-0164), the delegation charter and the weekly sample (ADR-0088 stage 1);
> TOR-185 to TOR-191 (section 23) cover the qualification kit (ADR-0087). TOR-112 and TOR-117 are
> reworded for the canonical id; the rest of TOR-001 to TOR-157 is unchanged.

> **Extended for ADR-0089 (2026-10-06).** TOR-192 to TOR-200 (section 22) cover the canonical mission
> snapshot and the eight metamorphic relations of increment 1, checked over generated missions. TOR-201
> to TOR-207 (section 22) cover the witness of a strict verdict (`check --strict --witness`, step 3).
> The rest of TOR-001 to TOR-191 is unchanged.

> **Extended for RWD-2026-0165 (2026-10-06).** TOR-208 (section 3) covers a pointer written right after
> another one in the same segment. TOR-205 is reworded for attack corpus case AC-017; the rest of
> TOR-001 to TOR-207 is unchanged.

> **What this document is, and the two things it is not.**
>
> It states what runward's gate is required to do, one requirement at a time, each with the test that
> exercises it. It exists because `runward/contracts/port-contract.md` already carried the substance
> in prose, and prose cannot be checked off: an assessor asks *which requirement, verified where*, and
> until today this project could not answer without a reading.
>
> It is **not a qualification kit**, and calling it one would be the overclaim this project refuses.
> A commercial kit's documents are produced under a quality system a third party has assessed; these
> are produced by one maintainer with no external assessment of any kind. What follows is the
> requirements half, written so that someone else can check it — nothing more.
>
> It is **not a claim that these requirements are sufficient**. They cover the verdict surface and what
> surrounds it: what `check` decides, what the machine outputs promise, how an attestation is
> re-verified, how a row is ratified, how the gate is armed, and the invariants the tool holds. They say
> nothing about whether the corpus of rules is the right corpus, which is [ADR-0045](../adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)'s
> subject and belongs to the operator.

## How to read a requirement

Each entry carries three parts, and the third is the one that matters most.

- **Requirement** — one atomic, falsifiable statement. If it needs an "and", it is two requirements.
- **Verified by** — a test file and a case name inside it. A drift guard (`test/unit/tor-traceability.test.js`)
  asserts that every file cited exists and that every case name cited is present in it, so a renamed
  test reds the build instead of leaving a dead reference.
- **Does not assert** — what a green on this requirement leaves open. Stated per requirement because
  the gate-wide reservation ([`GATE_NON_SCOPE`](../../src/lib/rules.ts)) is too coarse to answer an
  assessor's question about one line.

**The traceability guard checks that a link EXISTS, never that the test is relevant.** A requirement
could cite a test that passes for unrelated reasons and the guard would stay green. That is the same
class of limit `GATE_NON_SCOPE` states one floor below, and it has to be repeated here, or this
document would reproduce at its own level the defect it documents.

---

## 1. Exit codes

The load-bearing contract: consumed blind by CI systems that never read the report.

### TOR-001 — a clean gate exits 0

**Requirement.** When no deliverable gap, no strict gap and no hook failure is present, `check` exits 0.

**Verified by.** `test/unit/verdict.test.js` — "all three counts at zero is the only clean verdict, and it exits 0"

**Does not assert.** That the mission's evidence is meaningful. A mission may be clean and carry prose in every row.

### TOR-002 — each failing term alone reddens the gate

**Requirement.** A deliverable gap, a strict gap, or a hook failure independently produces exit 1; none of the three is decorative.

**Verified by.** `test/unit/verdict.test.js` — "each term alone reddens the gate, and none of the three is decorative"

**Does not assert.** Any ordering or priority between the three; the gate reports all of them.

### TOR-003 — a failed operator hook is never netted out

**Requirement.** A hook the operator supplied, having failed, reddens the gate regardless of how clean runward's own findings are.

**Verified by.** `test/unit/verdict.test.js` — "a failed hook is not overruled by an otherwise perfect mission"

**Does not assert.** That the hook did anything useful. runward runs the operator's command and reports its exit code.

### TOR-004 — the exit code is 1, never a count

**Requirement.** A red gate exits exactly 1, whatever the number of findings.

**Verified by.** `test/unit/verdict.test.js` — "the exit code is 1, never the count of what went wrong"

**Does not assert.** Anything about stderr or the report body, which are not part of the exit contract.

### TOR-005 — exit 2 is reserved for a question that cannot be asked

**Requirement.** No mission found, or CLI misuse, exits 2 — distinct from a red gate, so a typo never reads as "gate red".

**Verified by.** `test/smoke.js` — the consumer-facing exit-code assertions

**Does not assert.** That every misuse is detected; an unknown flag combination may still be accepted and ignored.

### TOR-006 — `rules --for` always exits 0

**Requirement.** An empty match is a reading, never a verdict: `rules --for` exits 0 on no match, and 2 only when the question is malformed (absolute path, or a path escaping the project).

**Verified by.** `test/unit/rules.test.js` — "ADR-0041: a match names the pattern that retained the path (the check-ignore model)"

**Does not assert.** That the empty answer is correct — only that it is reported as a fact rather than a silence.

---

## 2. What the gate decides

### TOR-007 — deliverables gate with or without `--strict`

**Requirement.** A deliverable still holding its raw template counts as a gap in both modes; a phase never closes without its artifact.

**Verified by.** `test/unit/verdict.test.js` — "a deliverable reverted to its raw template gates the phase, with or without --strict"

**Does not assert.** That a filled deliverable says anything true. Departure from the template is the whole test.

### TOR-008 — every deliverable is reported, filled or not

**Requirement.** The verdict lists all deliverables with their state, so an empty mission and a complete one are distinguishable to a machine.

**Verified by.** `test/unit/verdict.test.js` — "every deliverable is reported, filled or not, and the row carries its state"

**Does not assert.** That the count of gaps matches any external expectation; it matches the non-filled rows, and that identity is what is checked.

### TOR-009 — non-strict mode returns empty readings, never absent ones

**Requirement.** Without `--strict`, the strict fields are present and empty rather than undefined, so no consumer needs a null check that a missed case would read as "no violations".

**Verified by.** `test/unit/verdict.test.js` — "without --strict the strict readings are empty rather than absent, and cost nothing"

**Does not assert.** That non-strict mode is cheaper in any measured sense.

### TOR-010 — an unratified decision is a strict gap

**Requirement.** A decision record still marked as a hypothesis does not satisfy the gate under `--strict`.

**Verified by.** `test/unit/verdict.test.js` — "an unratified decision is a strict gap: a hypothesis is not a decision"

**Does not assert.** That a ratified decision is a good one, or that anyone read it.

### TOR-011 — the corpus reaches the verdict on its own

**Requirement.** An edited rule in the mission's corpus reddens a mission with nothing else wrong: the rules the gate judges against are themselves gated.

**Verified by.** `test/unit/verdict.test.js` — "the corpus reaches the verdict on its own: an edited rule reddens a mission with nothing else wrong"

**Does not assert.** That the shipped corpus is correct or complete. It asserts the corpus cannot be edited under the gate's feet.

### TOR-012 — an uncheckable corpus is refused, not warned about

**Requirement.** When the corpus cannot be checked at all, the gate refuses; it does not degrade to a warning.

**Verified by.** `test/unit/verdict.test.js` — "a mission whose corpus cannot be checked is refused, not merely warned about"

**Does not assert.** Which failure modes are detectable; only that a detected one is fatal.

### TOR-013 — the critical scope is reported

**Requirement.** The gate states how many CRITICAL/HIGH rules it demands and how many it never asks about, and names the latter.

**Verified by.** `test/unit/verdict.test.js` — "the gate reports how much of the critical set it never asks about"

**Does not assert.** That the unmapped rules are unimportant. They are reported, never gated, and gating them would red every honest mission.

### TOR-014 — `computeVerdict` runs nothing and writes nothing

**Requirement.** Computing the verdict executes no operator command and mutates no file; hooks live in the command layer and their result is an input.

**Verified by.** `test/unit/verdict.test.js` — "computeVerdict runs nothing and writes nothing"

**Does not assert.** That the command layer is equally pure; it is not, by design.

---

## 3. Typed evidence

### TOR-015 — a pointer that no longer opens is a strict gap

**Requirement.** A typed pointer whose target cannot be resolved and read is a violation under `--strict`, and is invisible without it.

**Verified by.** `test/unit/verdict.test.js` — "a typed pointer that no longer opens is a strict gap, and only under --strict"

**Does not assert.** That the target, when it opens, supports the claim. Nothing automates that, by decision.

### TOR-016 — an absolute path is never evidence

**Requirement.** A pointer given as an absolute path does not resolve, even when it points inside the project.

**Verified by.** `test/unit/evidence-resolve.test.js` — "an absolute path is never evidence, even when it points inside the base"

**Does not assert.** Anything about symbolic links, which RWD-2026-0005 records separately.

### TOR-017 — a pointer leaving the repository does not resolve

**Requirement.** Containment is enforced at the repository boundary, whether or not a marker sits above the mission base.

**Verified by.** `test/unit/evidence-resolve.test.js` — "a pointer that leaves the REPOSITORY does not resolve, marker above the base or not"

**Does not assert.** That the repository boundary is correctly detected in every layout; nested and sibling checkouts are covered by the neighbouring cases.

### TOR-018 — a sibling directory sharing a name prefix is outside

**Requirement.** A directory whose name merely begins with the repository's name is not inside it.

**Verified by.** `test/unit/evidence-resolve.test.js` — "a directory whose name merely starts with the repository's name is outside it"

**Does not assert.** Case-insensitive filesystem behaviour, which is covered by the spelling requirements.

### TOR-019 — a pointer to something that is not a regular file is refused before it is read

**Requirement.** The gate refuses a non-regular file rather than attempting to read it.

**Verified by.** `test/unit/evidence-nonregular.test.js` — "a pointer at a file that is not regular is refused before it is read, and one that is regular is read"

**Does not assert.** That every non-regular kind behaves identically; the load-bearing case is the one that would otherwise block forever.

### TOR-020 — a declared test name that names nothing is recorded as declared

**Requirement.** A `test:` pointer whose `::` names no test is recorded as DECLARED, never silently treated as absent.

**Verified by.** `test/unit/evidence-pointers.test.js` — "a `::` that names nothing is recorded as DECLARED, not as absent"

**Does not assert.** That the named test tests the thing claimed.

### TOR-021 — the gate refuses a `::` that names no test

**Requirement.** A pointer declaring a test name the target file does not contain is a violation, and one whose name is present is accepted.

**Verified by.** `test/unit/evidence-pointers.test.js` — "the gate refuses a `::` that names no test, and accepts one that does"

**Does not assert.** That the test passes, or that it is run at all.

### TOR-022 — an error names the pointer that was written

**Requirement.** A violation quotes the pointer as the operator wrote it, so the message can be matched back to the manifest line.

**Verified by.** `test/unit/evidence-pointers.test.js` — "the pointer read back in an error names the same pointer that was written"

**Does not assert.** Any stability of the surrounding message text.

### TOR-023 — a pointer with no line and no symbol is not given one

**Requirement.** The gate does not invent a position the operator did not write.

**Verified by.** `test/unit/evidence-pointers.test.js` — "a pointer with no line and no symbol is not given one by the message"

**Does not assert.** That a pointer without a position is weaker evidence; it is a different, allowed form.

### TOR-208 — a pointer written right after another one is read

**Requirement.** Outside quotes, every `file:`/`test:`/`adr:` spelling of a segment that is not glued to a letter, a digit or `_` starts a pointer, whatever precedes it, so a dead pointer written behind a parenthesis after another pointer is refused and named exactly as it is after a space (RWD-2026-0165).

**Verified by.** `test/unit/evidence-misc.test.js` — "a dead pointer glued after another one is refused, naming it (RWD-2026-0165)"

**Does not assert.** How the operand of such a pointer is read: text glued to its end (`#A)—and`) stays part of the token as it always was, and a spelling glued to a word character is not a pointer.

---

## 4. The seal

### TOR-024 — a lock version this build cannot read is refused

**Requirement.** A lock declaring an unknown version is refused; a `version: 1` lock is accepted.

**Verified by.** `test/unit/evidence-lock.test.js` — "a lock declaring a version this build does not read is refused, and a v1 lock is accepted"

**Does not assert.** Forward compatibility with any future version.

### TOR-025 — a seal over zero files is a violation

**Requirement.** An empty seal does not satisfy the gate; a seal over one file is intact.

**Verified by.** `test/unit/evidence-lock.test.js` — "a seal over zero files is a violation, and a seal over one file is intact"

**Does not assert.** Any minimum meaningful number of sealed files beyond one.

### TOR-026 — a sealed entry that is no longer a regular file is missing evidence

**Requirement.** Whatever hash the lock claims, an entry that is not a regular file at verification time counts as missing.

**Verified by.** `test/unit/evidence-lock.test.js` — "a sealed entry that is not a regular file is missing evidence, whatever hash the lock claims"

**Does not assert.** That the file's content was ever what the lock says; see TOR-028.

### TOR-027 — an unparseable lock is present and red

**Requirement.** A corrupt lock is reported as a broken seal, never treated as the absence of a seal.

**Verified by.** `test/unit/evidence-lock.test.js` — "an unparseable lock is present and red, never treated as no seal at all"

**Does not assert.** Any repair behaviour; the operator re-seals deliberately.

### TOR-028 — a tampered seal reddens the gate

**Requirement.** A sealed file whose content changed after sealing reddens the gate under `--strict`.

**Verified by.** `test/unit/verdict.test.js` — "a tampered seal reddens the gate"

**Does not assert.** **When the seal was written.** `sealedAt` is declared by the mission and is editable by hand (RWD-2026-0022). What the seal establishes is that the cited files still hash to what they hashed at sealing time, never the date of that time.

### TOR-029 — `--freeze` does not verify the seal it replaces

**Requirement.** Under `--freeze` the old seal is being replaced, not checked; everything else must still be green to seal.

**Verified by.** `test/unit/verdict.test.js` — "--freeze does not verify the seal it is about to replace"

**Does not assert.** That re-sealing is safe in any workflow sense; it is an operator decision.

---

## 5. The machine surface

### TOR-030 — `check --strict --json` carries what the terminal shows

**Requirement.** The JSON payload carries the counters, corpus status, seal and critical scope the terminal prints, so a mission carrying real evidence is distinguishable from one answering `n/a` to every row.

**Verified by.** `test/unit/verdict.test.js` — "`check --strict --json` carries what the terminal shows, and an empty mission is distinguishable"

**Does not assert.** That a consumer reads them. `gateNonScope` travels with the counters precisely because a consumer keeping the numbers and dropping the caveat is the foreseeable misuse.

### TOR-031 — the rule surface is versioned and additive

**Requirement.** `rules --json` fields are added, never renamed, repurposed or removed; the payload carries the runward version.

**Verified by.** `test/smoke.js` — the consumer-facing rule-surface assertions

**Does not assert.** That consumers are tolerant readers; that is asked of them, not enforced here.

### TOR-032 — the gate-wide non-scope is declared and non-empty

**Requirement.** `GATE_NON_SCOPE` states what no green row proves, and is present on the machine surface.

**Verified by.** `test/unit/rules.test.js` — "ADR-0040: nonScope parses when declared, stays null otherwise, and the gate-wide default is non-empty"

**Does not assert.** That a rule's own `nonScope` is accurate; it narrows the default and never replaces it.

### TOR-033 — the declared non-scope names the temporal blind zone

**Requirement.** The gate-wide reservation states that a green row is a statement about the moment of the run, not only about depth of inspection.

**Verified by.** `test/unit/rules.test.js` — "ADR-0040: the gate-wide non-scope declares the TEMPORAL blind zone, not only the depth one"

**Does not assert.** How long a verdict remains meaningful, which no tool can decide for an operator.

### TOR-034 — the rule set is deterministic and sorted

**Requirement.** Reading the corpus yields the same inventory in the same order for the same tree, and missing optional fields degrade rather than throw.

**Verified by.** `test/unit/rules.test.js` — "readRuleSet is deterministic and sorted by slug; missing fields degrade gracefully"

**Does not assert.** That a degraded rule is still useful; it asserts the reader does not crash.

### TOR-035 — a match names the pattern that retained the path

**Requirement.** `rules --for` reports which pattern matched, on the `git check-ignore -v` model, so a match can be argued with.

**Verified by.** `test/unit/rules.test.js` — "ADR-0041: a match names the pattern that retained the path (the check-ignore model)"

**Does not assert.** That the pattern is the only one that would have matched.

---

## 6. Territory

### TOR-036 — a map row binds a path and carries its reason with a line

**Requirement.** A declared row binds a path, and the reported reason carries both the file and the line number.

**Verified by.** `test/unit/territory-map.test.js` — "ADR-0043: a declared row binds a path, and the reason carries the file AND the line"

**Does not assert.** That the reason text is true; it is the operator's.

### TOR-037 — the map corrects derivation in both directions

**Requirement.** A map row can add or remove a binding, and the last matching row wins per (path, category).

**Verified by.** `test/unit/territory-map.test.js` — "ADR-0043: the map corrects derivation in BOTH directions, last matching row winning"

**Does not assert.** That the operator's correction is right. What it forbids is silent narrowing of a rule's own `appliesTo`.

### TOR-038 — a `remove` undoes what was derived, not what was decided

**Requirement.** A `remove` row can undo a derived binding, never a rule's own declaration.

**Verified by.** `test/unit/territory-map.test.js` — "ADR-0043: a `remove` row can undo a DERIVED binding — what runward guessed, not what the maintainer decided"

**Does not assert.** That derivation was wrong where it is removed.

### TOR-039 — every refused row is named with its line

**Requirement.** A row the map cannot use is reported with its line number, never silently dropped.

**Verified by.** `test/unit/territory-map.test.js` — "ADR-0043: every refused row is NAMED with its line — never silently dropped"

**Does not assert.** That the operator will read the report.

### TOR-040 — absent, empty and broken are three different answers

**Requirement.** A missing map, an empty map and a structurally broken map are reported distinctly.

**Verified by.** `test/unit/territory-map.test.js` — "ADR-0043: absent, empty and structurally broken are three different answers"

**Does not assert.** That any of the three is preferable.

---

## 7. Deliverable state

### TOR-041 — a directory holding only the scaffolded template is untouched

**Requirement.** Scaffolding does not count as work: a deliverable still equal to its template is `untouched`, never `filled`.

**Verified by.** `test/unit/artifact-state.test.js` — "an adr/ holding only the scaffolded template is untouched, never filled"

**Does not assert.** That a departed-from template says anything true.

### TOR-042 — one real entry beside the template makes it filled

**Requirement.** A single genuine artifact alongside the scaffold moves the deliverable to `filled`.

**Verified by.** `test/unit/artifact-state.test.js` — "one real ADR beside the template makes adr/ filled"

**Does not assert.** Any threshold of quality or quantity beyond one.

### TOR-043 — absent and untouched are never confused

**Requirement.** A deliverable that does not exist is `missing`; one that exists unedited is `untouched`. The two are reported apart.

**Verified by.** `test/unit/artifact-state.test.js` — "an absent deliverable is missing, and never confused with untouched"

**Does not assert.** That either state is recoverable by any particular gesture.

---

## 8. Invariants

### TOR-044 — no network I/O, structurally

**Requirement.** The core suite, the schema validation and the self-gate run with the network unshared, so their independence from it is a property of the run rather than a policy.

**Verified by.** `test/unit/regulated-posture.test.js` — "posture: CI runs core tests network-isolated, gates runward, and tracks SBOM drift"

**Does not assert.** That the unit suite is network-isolated; it runs in a separate job and is not. The guard asserts the isolation step is present, not which tests run inside it.

### TOR-045 — every CI action is pinned by commit SHA

**Requirement.** No workflow references a mutable tag.

**Verified by.** `test/unit/regulated-posture.test.js` — "posture: every workflow action is pinned by commit SHA (no mutable tags)"

**Does not assert.** That the pinned commit is trustworthy, only that it cannot change under the project.

### TOR-046 — no long-lived secret in any workflow

**Requirement.** Publication uses OIDC trusted publishing; no durable credential appears in a workflow.

**Verified by.** `test/unit/regulated-posture.test.js` — "posture: no long-lived secrets in any workflow (OIDC trusted publishing only)"

**Does not assert.** Anything about secrets held elsewhere in the organisation.

### TOR-047 — the release binds an attested SBOM to the published tarball

**Requirement.** The release path emits provenance and an SBOM attestation whose subject is the tarball that is published.

**Verified by.** `test/unit/regulated-posture.test.js` — "posture: release wires provenance + an attested SBOM bound to the published tarball"

**Does not assert.** That the release assets are attached; that path is exercised only by cutting a release, and a missing bundle reds it at that moment.

---

## 9. Published claims

### TOR-048 — no forbidden claim on the shipped surface

**Requirement.** No shipped file claims runward is qualified, certified, pre-qualified, or of any tool confidence class.

**Verified by.** `test/unit/no-overclaim.test.js` — "no forbidden claim anywhere on the shipped surface"

**Does not assert.** That every true claim is stated; it forbids a family of false ones.

### TOR-049 — the overclaim guard knows what it scanned

**Requirement.** The guard reports its own coverage, so a scan reduced to one file cannot pass as a full sweep.

**Verified by.** `test/unit/no-overclaim.test.js` — "the guard scans more than one file, and knows what it scanned"

**Does not assert.** That the scanned set is the complete shipped surface.

### TOR-050 — the guard does not fire on legitimate prose

**Requirement.** Discussing qualification, as this document does, does not trip the guard.

**Verified by.** `test/unit/no-overclaim.test.js` — "the guard does not fire on legitimate prose"

**Does not assert.** That the boundary between the two is drawn correctly in every future phrasing.

### TOR-051 — the gate is named the same way everywhere

**Requirement.** The agent-facing contract and the human-facing documents describe the same obligation in the same terms.

**Verified by.** `test/unit/agent-contract-drift.test.js` — "the gate is named the same way everywhere it is named"

**Does not assert.** That the naming is the clearest available.

---

## 10. The declared horizon

`check --through <phase-id>` judges a prefix of the arc ([ADR-0053](../adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md)).
The requirements below hold what a prefix verdict may and may not leave out.

### TOR-052 — the horizon is a floor

**Requirement.** A regression in a phase at or below the declared horizon reddens `check --through`.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: the horizon is a floor — a regression at or below it still reds"

**Does not assert.** Anything about the phases after the horizon. They are deferred, never crossed (TOR-056).

### TOR-053 — the corpus check is never scoped by the horizon

**Requirement.** An edited, moved or removed rule reddens the verdict whatever horizon is declared.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: the phase-global corpus check is never scoped by the horizon"

**Does not assert.** That the corpus is the right one (ADR-0045's subject, see the reservation at the top).

### TOR-054 — an unratified decision reddens at any horizon

**Requirement.** A decision record still marked as a hypothesis reddens `check --strict --through`, whatever the horizon.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: an unratified decision reds at any horizon"

**Does not assert.** That the decision belongs to a phase at or below the horizon; the check is global by design.

### TOR-055 — the seal is global, not scoped

**Requirement.** A tampered seal reddens the verdict at a horizon below the phase of the sealed file.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: a tampered seal reds below its own phase — the seal is global, not scoped"

**Does not assert.** When the seal was written (TOR-028 applies unchanged).

### TOR-056 — what lies above the horizon is deferred, and said to be

**Requirement.** A broken gated pointer in a phase above the horizon is listed as deferred, not counted as a gap and not reported as crossed.

**Verified by.** `test/unit/verdict-horizon-corpus.test.js` — "a broken gated pointer ABOVE the horizon is deferred — the deferral itself, pinned"

**Does not assert.** That a consumer reads the deferred list. A green prefix is not a finished mission, and only the full `check --strict` judges the whole arc.

### TOR-057 — an unknown phase id fails loud

**Requirement.** A `--through` value that names no phase is refused, never read as a horizon that defers everything.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: unknown --through phase throws fail-loud, never a silent all-deferred green"

**Does not assert.** That the phase vocabulary is the one an operator expects; TOR-128 joins the vocabularies.

### TOR-058 — a prefix is never sealed

**Requirement.** `check --through <id> --freeze` exits 2 as misuse, and so does an unknown phase id on the command line.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: the CLI rejects an unknown phase-id and refuses --freeze, both as misuse (exit 2)"

**Does not assert.** That a team never wires `--through` as its only merge gate. The tool cannot see how an exit code is consumed; ADR-0053 states that wiring contract in prose.

### TOR-059 — the last phase as horizon is the full gate

**Requirement.** `check --strict --through handover` exits as plain `check --strict` does, green and red.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: --through handover matches plain --strict on the exit code (identity), green and red"

**Does not assert.** That the two reports read identically; the identity is on the exit code.

### TOR-060 — the horizon travels on the machine surface

**Requirement.** `check --through --json` carries the horizon and the deferred list, additively, beside the whole-arc fields.

**Verified by.** `test/unit/verdict.test.js` — "ADR-0053: `--through --json` carries through/horizon/gaps.deferred, additive, whole-arc truth intact"

**Does not assert.** That a consumer reading only `verdict` notices the horizon; the field is there so that it can.

---

## 11. The attestation and its re-verification

`check --attest` wraps the verdict in an in-toto Statement; `verify` re-derives it against a tree;
`bundle` and `check --vsa` emit the neighbouring documents ([ADR-0055](../adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md)).

### TOR-061 — the attestation is an unsigned in-toto Statement wrapping the verdict

**Requirement.** `check --attest` emits a schema-valid in-toto Statement whose predicate is the verdict, and signs nothing.

**Verified by.** `test/unit/verdict-attestation.test.js` — "ADR-0055: check --attest emits a valid, unsigned in-toto Statement wrapping the verdict"

**Does not assert.** Who produced the document. An unsigned Statement says nothing about its author; signing belongs to the operator's pipeline.

### TOR-062 — emitting an attestation never changes the verdict

**Requirement.** The exit code of `check` is the same with and without `--attest`.

**Verified by.** `test/unit/verdict-attestation.test.js` — "ADR-0055: emitting an attestation never changes the verdict (out of the exit-code path)"

**Does not assert.** That the emitted document is kept anywhere; storage is the operator's.

### TOR-063 — the attestation is byte-idempotent

**Requirement.** Two attestations of an unchanged tree are byte-identical.

**Verified by.** `test/unit/verdict-attestation.test.js` — "ADR-0055: the attestation is byte-idempotent on an unchanged tree"

**Does not assert.** Idempotence across runward versions; TOR-069 covers a version skew.

### TOR-064 — `verify` accepts an attestation of the tree it is run on

**Requirement.** `verify` of an attestation produced on an unchanged tree reports verified and exits 0.

**Verified by.** `test/unit/verify-attestation.test.js` — "obj 6: verify an intact tree — verified, exit 0"

**Does not assert.** That the attested gate was green. Verified means authentic for this tree, whatever the verdict it carries (TOR-067).

### TOR-065 — `verify` fails a drifted tree

**Requirement.** An attestation verified against a tree that changed since it was produced exits 1.

**Verified by.** `test/unit/verify-attestation.test.js` — "obj 6: NEGATIVE CONTROL — a drifted tree fails (exit 1)"

**Does not assert.** Which change caused the drift; the digest says that something changed, not what.

### TOR-066 — `verify` fails a tampered predicate

**Requirement.** An attestation whose predicate was edited after emission exits 1, because `verify` re-derives the predicate from the tree.

**Verified by.** `test/unit/verify-attestation.test.js` — "obj 6: NEGATIVE CONTROL — a tampered predicate fails (exit 1)"

**Does not assert.** That every field is re-derived. The fields added since are pinned one by one, and this register cites two of them (TOR-071, TOR-106).

### TOR-067 — an honest attestation of a red gate reads RED

**Requirement.** `verify` of an authentic attestation of a red gate says RED on its result line and at the top of its JSON.

**Verified by.** `test/unit/cli-false-greens.test.js` — "RWD-2026-0132: verify of an honest RED attestation says RED on its result line and at the top of its JSON"

**Does not assert.** Anything about the exit code beyond TOR-064: an authentic red attestation verifies.

### TOR-068 — a prefix attestation verifies as a prefix

**Requirement.** An attestation made under `--through` verifies against its declared horizon and is surfaced as a prefix.

**Verified by.** `test/unit/verify-attestation.test.js` — "obj 5: a phase-crossing attestation verifies against its declared horizon, surfaced as a prefix"

**Does not assert.** That the reader of `verify` notices the word; TOR-056 applies.

### TOR-069 — a version skew is named, and alone never fails

**Requirement.** When the attestation was produced by another runward version, `verify` names that version, and the skew alone does not fail verification.

**Verified by.** `test/unit/verify-version-skew.test.js` — "skew: an old producing version is NAMED, and alone it never fails the verification"

**Does not assert.** That the two versions judge identically. On a failure under skew, the gesture is to re-verify with the producing version.

### TOR-070 — a DSSE signature is counted, never verified

**Requirement.** `verify` decodes a DSSE envelope, re-derives its payload and reports how many signatures it carries, without verifying any of them.

**Verified by.** `test/unit/verify-dsse.test.js` — "dsse: an enveloped attestation verifies — decoded, re-derived, signature counted and NOT verified"

**Does not assert.** That a signature is valid or whose key made it. That is the operator's verifier's job.

### TOR-071 — `verify` re-derives the next step

**Requirement.** An attestation whose `next.action` was edited is refused by `verify`.

**Verified by.** `test/unit/check-json-next.test.js` — "json next: verify re-derives next.action and refuses a forged one"

**Does not assert.** That the next step is the best one; it is the one the terminal prints.

### TOR-072 — the VSA never claims an SLSA level

**Requirement.** `check --vsa` writes a custom value into `verifiedLevels`, never an `SLSA_` level.

**Verified by.** `test/unit/vsa.test.js` — "vsa: verifiedLevels carries a CUSTOM value and NEVER an SLSA_ one"

**Does not assert.** Anything about the build's SLSA posture, on which runward has no reading.

### TOR-073 — a red mission emits a FAILED VSA

**Requirement.** The VSA states the verdict: a red mission yields `FAILED`, not an absent document.

**Verified by.** `test/unit/vsa.test.js` — "vsa: a red mission emits FAILED — the attestation is about the verdict, not about success"

**Does not assert.** What a policy engine does with `FAILED`.

### TOR-074 — the VSA's resource is never guessed

**Requirement.** `check --vsa` without `--resource-uri` exits 2.

**Verified by.** `test/unit/vsa.test.js` — "vsa: --resource-uri is REQUIRED and never guessed — misuse exits 2"

**Does not assert.** That the URI given names the right resource; it is the operator's.

### TOR-075 — a bundle's subjects are the artifacts' raw digests

**Requirement.** `bundle` emits a valid in-toto Statement whose subjects are the named artifacts by the sha256 of their raw bytes.

**Verified by.** `test/unit/bundle.test.js` — "obj 7: bundle emits a valid in-toto Statement whose subjects are the artifacts by RAW sha256"

**Does not assert.** Anything about the artifacts' content; a bundle binds bytes, it does not read them.

### TOR-076 — a changed artifact fails bundle re-verification

**Requirement.** `verify` of a bundle exits 1 when one artifact's bytes changed.

**Verified by.** `test/unit/bundle.test.js` — "obj 7: NEGATIVE CONTROL — a changed artifact fails bundle re-verification (exit 1)"

**Does not assert.** Which change it was.

### TOR-077 — a missing artifact fails bundle re-verification

**Requirement.** `verify` of a bundle exits 1 when one named artifact is absent.

**Verified by.** `test/unit/bundle.test.js` — "obj 7: NEGATIVE CONTROL — a missing artifact fails bundle re-verification (exit 1)"

**Does not assert.** That the bundle named every artifact that matters; the operator chooses what to bundle.

---

## 12. Spec linkage

`runward spec-check` reads the acceptance criteria of a spec and checks that each one links to an
artifact ([ADR-0056](../adr/ADR-0056-the-evidence-layer-widens.md)). Linkage, never satisfaction.

### TOR-078 — a criterion is linked only to an artifact that is present

**Requirement.** A criterion whose pointer opens is linked; a criterion with no pointer or a dead one is not.

**Verified by.** `test/unit/spec-conformance.test.js` — "obj 10: a criterion linked to a present artifact is linked; no pointer or a dead pointer is not"

**Does not assert.** That the artifact satisfies the criterion (TOR-079).

### TOR-079 — linkage is reported as linkage

**Requirement.** A criterion pointing at unrelated content is still reported linked, and the output carries the non-scope that says linkage is not satisfaction.

**Verified by.** `test/unit/spec-conformance.test.js` — "obj 10: NON-SCOPE — linkage only, never satisfaction (unrelated content still links)"

**Does not assert.** That anyone reads the non-scope.

### TOR-080 — every pointer on a criterion must verify

**Requirement.** One resolving pointer does not mask a broken one beside it on the same criterion.

**Verified by.** `test/unit/spec-conformance.test.js` — "audit 2026-08-14: EVERY pointer must verify — one green path cannot mask a broken #SYMBOL beside it"

**Does not assert.** That a criterion carries enough pointers.

### TOR-081 — a criterion may not link out of the tree

**Requirement.** A pointer leaving the project does not link, as for the gate's own pointers (TOR-017).

**Verified by.** `test/unit/spec-conformance.test.js` — "obj 10: containment — a criterion may not link out of the tree"

**Does not assert.** Symbolic link behaviour beyond what TOR-016 to TOR-018 state.

### TOR-082 — a spec without criteria is a distinct state

**Requirement.** A spec with no acceptance-criteria section is reported as such, never as an empty pass.

**Verified by.** `test/unit/spec-conformance.test.js` — "obj 10: no acceptance-criteria section is a distinct state, not an empty pass"

**Does not assert.** Which heading spellings are recognised beyond those the shape tests pin.

### TOR-083 — a reference no file declares is dangling

**Requirement.** Across a directory of spec files, an identifier referenced and declared nowhere is reported as a dangling reference.

**Verified by.** `test/unit/spec-conformance.test.js` — "bundle: a referenced identifier no file declares is a DANGLING reference — the delta is broken"

**Does not assert.** That every declared identifier is referenced.

### TOR-084 — `spec-check` speaks the port contract

**Requirement.** `spec-check` exits 0 when every criterion is linked, 1 on a gap, 2 without a criteria section.

**Verified by.** `test/unit/spec-conformance.test.js` — "obj 10: the CLI exits 0 all-linked, 1 on a gap, 2 without a criteria section, and carries the non-scope"

**Does not assert.** That `spec-check` is wired into `check`; it is a separate command.

### TOR-085 — criteria pointing at absent files are refused in every shape

**Requirement.** Whatever the markdown shape of the criteria, a pointer at a file that does not exist is a gap.

**Verified by.** `test/unit/spec-check-shapes.test.js` — "a spec whose criteria point at files that do not exist is refused, in every shape"

**Does not assert.** That every markdown shape a writer may use is read; the honest shapes the test lists are.

---

## 13. Proposals and ratification

A manifest row can be proposed by `runward propose` or by an agent, and a proposal never crosses the
gate; `runward ratify` turns proposals into the operator's decisions against displayed evidence
([ADR-0066](../adr/ADR-0066-a-manifest-row-can-be-proposed-and-a-proposal-never-crosses.md)).

### TOR-086 — a proposal never crosses

**Requirement.** A `proposed:` row is refused under `--strict` with its own cause and its own counter.

**Verified by.** `test/unit/proposed-rows.test.js` — "a proposed row is refused with its dedicated cause and its dedicated counter"

**Does not assert.** That the proposal is right or wrong; the gate does not read it.

### TOR-087 — a proposal is never counted as its underlying status

**Requirement.** `proposed:applied` is never counted as `applied`, on any surface.

**Verified by.** `test/unit/proposed-rows.test.js` — "a proposal is never counted as its underlying status — the 0.38 half of fail-closed"

**Does not assert.** Anything about how a consumer sums the counters (TOR-130).

### TOR-088 — a mission carrying proposals cannot be sealed

**Requirement.** `check --freeze` refuses a mission with a proposed row.

**Verified by.** `test/unit/proposed-rows.test.js` — "a mission carrying proposals cannot be sealed"

**Does not assert.** That a sealed mission was ever ratified by a person.

### TOR-089 — `propose` never judges

**Requirement.** `propose` writes a proposal only where a rule's signature matches inside its territory; a rule with no signature is listed with no status, and no match leaves the row empty.

**Verified by.** `test/unit/propose.test.js` — "propose never judges: no signature means listed, never a status; no match means left empty"

**Does not assert.** That a signature match is evidence of the rule being applied. It is a proposal, refused until ratified.

### TOR-090 — `propose` never touches a decided row

**Requirement.** `propose` is idempotent and leaves decided rows unchanged.

**Verified by.** `test/unit/propose.test.js` — "propose is idempotent and never touches a decided row"

**Does not assert.** That the decided row is right.

### TOR-091 — `propose` does not cite runward's own scaffold as evidence

**Requirement.** The untouched `AGENTS.md` that `init` writes is never cited by a proposal, and the output says why.

**Verified by.** `test/unit/propose-scaffold-not-evidence.test.js` — "propose does not cite the untouched scaffolded AGENTS.md as evidence, and says why"

**Does not assert.** That other scaffolded files are recognised; the gate's side of the same rule is TOR-147.

### TOR-092 — a person's ratification needs a terminal

**Requirement.** `ratify` without `--agent` refuses a run with no terminal, and refuses `--accept`.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: without --agent, the person's path is unchanged — refused without a terminal, --accept refused"

**Does not assert.** That a person sits at the terminal. A terminal is a precondition, not an identity (RWD-2026-0119).

### TOR-093 — a blind ratification says it is blind, every time

**Requirement.** `ratify --attest-blind` records `mode: BLIND`, and every later `check` discloses it.

**Verified by.** `test/unit/ratify.test.js` — "non-TTY ratify refuses; --attest-blind ratifies, records BLIND, and every later check discloses it"

**Does not assert.** That the disclosure gates; it does only under the regulated tier (TOR-104).

### TOR-094 — a sampled row the operator skipped is never ratified

**Requirement.** When the operator skips a row of the en-bloc sample, the bloc is cancelled and no row is ratified by it.

**Verified by.** `test/unit/ratify-truth.test.js` — "RWD-2026-0124: a sampled row the operator skipped cancels the bloc and is never ratified"

**Does not assert.** That the sample is large enough to catch a bad row; its size is ADR-0066's choice.

### TOR-095 — `ratify` honours the global `--dry-run`

**Requirement.** `runward --dry-run ratify` writes nothing.

**Verified by.** `test/unit/ratify-truth.test.js` — "RWD-2026-0127: ratify honours the global --dry-run and writes nothing"

**Does not assert.** That every other command honours it; `report` is TOR-149.

### TOR-096 — a ratification by nobody is refused

**Requirement.** An empty `--by` is refused before anything is written.

**Verified by.** `test/unit/ratify-truth.test.js` — "RWD-2026-0128: an empty --by is refused before anything is written"

**Does not assert.** That the name given is true. Names are declared, never verified.

### TOR-097 — a rejection empties the row and records nothing

**Requirement.** Rejecting a proposal returns the row to an empty status and writes no ratification entry for it.

**Verified by.** `test/unit/ratify.test.js` — "reject empties the row back to a frank hole, and records nothing for it"

**Does not assert.** That the operator's reason for rejecting is kept anywhere.

### TOR-098 — the ledger names the decided rows no one ratified

**Requirement.** The ratification ledger counts each mode per row and names every decided row with no trace.

**Verified by.** `test/unit/proposed-rows.test.js` — "the ledger counts modes per row and names the untraced decided rows"

**Does not assert.** That a trace was written by the gesture it records, or by a person: a trace is text a script can write (RWD-2026-0119). Outside the regulated tier the ledger discloses and never gates.

### TOR-099 — a proposal's dead pointer is named

**Requirement.** A `proposed:applied` row whose pointer does not resolve is refused with that pointer named, without a second gap for the same row.

**Verified by.** `test/unit/cli-false-greens.test.js` — "RWD-2026-0133: a proposed row's dead pointer is named in its refusal, without a second gap"

**Does not assert.** That a resolving pointer supports the claim (TOR-015 applies).

---

## 14. The regulated tier

A mission that declares `"regulated": true` in its scaffold lock requires every decided row to carry a
ratification bound to its current content ([ADR-0080](../adr/ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md), part 1).

### TOR-100 — without the flag, the tier changes nothing

**Requirement.** A mission that does not declare the tier keeps its verdict and the shape of its payload.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: without the flag the tier changes nothing — the example stays clean and the payload keeps its shape"

**Does not assert.** That a mission which should declare the tier does.

### TOR-101 — under the tier, an unbound decided row is a strict gap

**Requirement.** Under the tier and `--strict`, each decided row without a bound ratification is a named strict gap.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: under the flag every decided row without a bound ratification is a named strict gap"

**Does not assert.** Who ratified. The record is bound to the row, not to a person.

### TOR-102 — a row rewritten after its ratification loses its binding

**Requirement.** Changing a ratified row's status or evidence unbinds it; re-aligning its whitespace does not.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: a row rewritten after its ratification loses its binding; re-aligning whitespace does not"

**Does not assert.** That the file the row cites is unchanged. The digest binds the row's text; the cited file is the seal's job (TOR-028).

### TOR-103 — an entry without a digest does not bind

**Requirement.** A hand-typed ratification entry with no content digest leaves the row unbound, and the last entry naming a row is the one read.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: a hand-typed entry without a digest does not bind, and the last entry naming a row speaks for it"

**Does not assert.** That an entry with a digest was written by `ratify`; a digest can be computed by anyone.

### TOR-104 — a blind ratification does not bind under the tier

**Requirement.** Under the tier a `BLIND` ratification leaves its row unbound, and the terminal prints it with or without the tier.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: BLIND does not bind under the tier, and the terminal prints it with or without the tier"

**Does not assert.** Anything outside the tier, where BLIND counts and is disclosed (TOR-093).

### TOR-105 — rows decided by hand can be ratified without being changed

**Requirement.** `ratify --decided` binds rows already decided by hand, and the gate closes without the rows' text changing.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: `ratify --decided` binds hand-decided rows, and the gate closes without changing a row"

**Does not assert.** That the rows were re-read before being ratified.

### TOR-106 — `verify` re-derives the tier's count

**Requirement.** An attestation whose tier count was dropped or changed is refused by `verify`.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: `verify` re-derives the tier's count, and a payload that drops it is refused"

**Does not assert.** Anything about the forge (TOR-107).

### TOR-107 — the payload never claims the forge approval

**Requirement.** The tier block states that the forge approval is not verified by `check`, and `verify` refuses an attestation that claims otherwise, or that carries a tier the tree does not declare.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: `verify` compares the whole tier block — a forged forge claim, or a tier the tree does not declare, is refused"

**Does not assert.** That an approval by a second person took place. ADR-0080 part 2 reads it on the forge, and runward 0.42.3 ships no such step (section 24).

### TOR-108 — the tier follows the horizon

**Requirement.** Under `--through`, the tier judges only the phases the horizon judges.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: under `--through` the tier judges only the phases the horizon judges (ADR-0053)"

**Does not assert.** That deferred rows are bound; they are judged by the full gate.

### TOR-109 — `update` preserves the declaration

**Requirement.** `update` keeps `"regulated": true` in the lock, and the lock writer emits the key only when it is set.

**Verified by.** `test/unit/regulated-tier.test.js` — "ADR-0080: `update` preserves the flag, and the lock writer emits it only when set"

**Does not assert.** That a hand edit removing the flag is noticed; it is a readable diff, by decision.

---

## 15. Agent ratification

An agent may ratify, as itself, under the name of the person accountable for it
([ADR-0082](../adr/ADR-0082-an-agent-may-ratify-under-its-own-name-never-under-a-humans.md)). Every
name below is declared text: the requirements stop the honest mistake, not the liar.

### TOR-110 — an agent names itself and its accountable person

**Requirement.** `--agent` and `--for` are given together, neither empty, and neither a name the trace cannot hold.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: --agent and --for go together, never empty, never a name the trace cannot hold"

**Does not assert.** That either name is true.

### TOR-111 — an agent's trace says it is an agent's

**Requirement.** An agent ratifies a named row without a terminal, and the trace names the agent and its accountable person, in agent mode.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: an agent ratifies a named row without a terminal, and the trace names it and its accountable person"

**Does not assert.** That the agent looked at the evidence it was given.

### TOR-112 — an agent never ratifies what its side proposed

**Requirement.** A row whose declared proposer is the agent, or whose proposer answers to the agent's own accountable person, is refused, names compared case-insensitively (since ADR-0088, accountable persons by canonical id; the one exception is TOR-160).

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: an agent never ratifies a row it, or its accountable person, proposed (declared names, case-insensitive)"

**Does not assert.** Independence. Declared names are compared; no identity is checked.

### TOR-113 — a row not listed now is refused, and nothing is written

**Requirement.** If one `--accept` names a row that is not pending, the whole call is refused and writes nothing.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: a row that is not listed now is refused, and the whole call writes nothing"

**Does not assert.** That the rows listed are the ones the agent meant.

### TOR-114 — `--list` writes nothing

**Requirement.** `ratify --list` shows what a person is shown and writes nothing; `--json` carries the same rows with their ids.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: --list writes nothing and shows what a person is shown; --json carries the same rows with their ids"

**Does not assert.** That the excerpt shown is sufficient evidence for a decision.

### TOR-115 — agent ratifications are counted apart, everywhere

**Requirement.** The ledger, the terminal, the JSON and the SARIF each count agent ratifications separately from a person's.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: agent ratifications are counted apart in the ledger, the terminal, the JSON and the SARIF"

**Does not assert.** That a reader weighs the two counts differently.

### TOR-116 — under the tier, an agent's ratification needs the organisation's opt-in

**Requirement.** Under the regulated tier, without `"agentRatification": true` in the lock, an agent-ratified row is a named strict gap.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: under the regulated tier without the opt-in, an agent-ratified row is a named strict gap"

**Does not assert.** That the opt-in was decided by the organisation rather than written by anyone with commit access.

### TOR-117 — with the opt-in, the accountable person must not be the proposer

**Requirement.** With the opt-in, a trace whose accountable person proposed the row, or whose row names no proposer, stays a gap.

**Verified by.** `test/unit/agent-ratification.test.js` — "ADR-0082: with the opt-in, a trace whose accountable person proposed the row, or names no proposer, stays a gap"

**Does not assert.** Separation of duties between people. The names are declared.

### TOR-158 — accountable persons are compared by canonical id

**Requirement.** Under the regulated tier with the opt-in, an agent ratification counts only when the ratifier's and the proposer's accountable persons resolve to two different canonical ids the lock declares; the same person under two spellings, or a proposer whose accountable person cannot be read, is a named gap.

**Verified by.** `test/unit/single-accountable.test.js` — "RWD-2026-0164 reproduced: two traces the free-string comparison counted as independent are now named gaps"

**Does not assert.** That a declared identity is the account it names; runward never resolves an id against a forge.

### TOR-159 — a proposal records who answers for it

**Requirement.** `propose --for <person>` writes `; for: <person>` in every row it proposes, refuses a name the cell cannot hold before writing anything, and `ratify` carries it into the trace as `proposer-for:`.

**Verified by.** `test/unit/single-accountable.test.js` — "propose --for records the proposer's accountable person in each row; an unusable name is refused before anything is written"

**Does not assert.** That the person named ran the proposer.

### TOR-160 — one accountable person is ratified only as agent (single accountable), and said so

**Requirement.** In a default mission, a row whose proposer answers to the agent's accountable person is refused without `--single-accountable`, and with it is recorded `independence: single accountable` and disclosed in the terminal, the JSON, the SARIF and the delivery report with the sentence of ADR-0088 decision 4.

**Verified by.** `test/unit/single-accountable.test.js` — "a default mission: refused without --single-accountable, recorded and disclosed on every surface with it"

**Does not assert.** Independent approval; the disclosure says it is not.

### TOR-161 — under the tier, the exception is refused by default and never silently counted

**Requirement.** Under the regulated tier, an `agent (single accountable)` row is a strict gap: refused unless the lock names the person as `singleAccountable`, and under that exception a gap until a passing sample covers its date (TOR-182); both say « not a DORA change-approval control; ADR-0080 Part 2 unchanged ».

**Verified by.** `test/unit/single-accountable.test.js` — "the regulated tier: refused by default, a named gap 'no signed sample yet' under the lock's exception, never silently counted"

**Does not assert.** Anything about the signed sample, which does not exist yet (ADR-0088 decision 6).

### TOR-162 — `doctor` sets a declared ratifier beside the identity that committed it

**Requirement.** `doctor` reports, for each ratification entry, the identity git recorded as committing its line, whether the declared `by:` names it, and warns when an agent's entry was committed under another identity; an uncommitted entry stays as declared.

**Verified by.** `test/unit/single-accountable.test.js` — "doctor sets each entry's declared by: beside the identity git committed it under, and warns only for an agent's"

**Does not assert.** Who typed the commit. Git records what the committer configured; signatures are not verified (ADR-0088 stage 1).

### TOR-163 — `update` keeps the declared identities and the exception

**Requirement.** The lock writer emits `identities` and `singleAccountable` only when given, as given, and `update` carries both over.

**Verified by.** `test/unit/single-accountable.test.js` — "the lock writer emits identities and singleAccountable only when given, as given"

**Does not assert.** That a hand edit removing either is noticed; it is a readable diff.

### TOR-164 — the delegation charter's schema is read, every malformation named

**Requirement.** When `runward/delegation.md` exists, its frontmatter is parsed against the charter format (ADR-0088 decision 5, `docs/delegation-charter.md`): a missing, unknown, duplicated, placeholder or misshapen field, a window over 90 days, and a pre-merge list without the charter itself are each a named `charter-malformed` problem, never repaired.

**Verified by.** `test/unit/delegation-charter.test.js` — "every malformation of the charter is named, never repaired"

**Does not assert.** That the charter's content is wise, or that its author is the accountable person. The charter is declared.

### TOR-165 — class I is refused in stage 1, R and H are never delegated

**Requirement.** A charter delegating class R or H, or class I in stage 1, carries a `charter-class-refused` problem; a charter declaring stage 2 carries `charter-stage-unread`, because this version reads none of stage 2's evidence.

**Verified by.** `test/unit/delegation-charter.test.js` — "class I is refused in stage 1, R and H are never delegated, and stage 2 is a gap this version cannot read"

**Does not assert.** That a class kept by the maintainer is in fact exercised by the maintainer: in stage 1 an agent can act with the maintainer's credential.

### TOR-166 — an agent ratification the charter does not cover is a named gap on its row

**Requirement.** Under `check --strict`, the ratification in force on a decided row, made by an agent the charter does not list as a delegate (`agent-not-delegate`) or by a delegate on a date after `expires:` (`charter-expired`), is a strict gap on that row; an entry dated before `effective:` and a row re-ratified by a person since are not.

**Verified by.** `test/unit/delegation-charter.test.js` — "an agent ratification by a non-delegate, or dated after the charter expired, is a named gap on its row"

**Does not assert.** Who ran the ratification. The agent's name and the entry's date are declared.

### TOR-167 — the charter's expiry reads no clock

**Requirement.** The verdict path compares `expires:` only with the dates the tree declares, so the same tree gives the same `check --strict --json` bytes whatever the clock says; the module the verdict imports reads no wall clock.

**Verified by.** `test/unit/delegation-charter.test.js` — "expiry is read from the dates the tree declares, never from the clock: the same tree gives the same verdict on any day"

**Does not assert.** That a lapsed charter with no act after it is noticed by the gate. `doctor` says it (TOR-170).

### TOR-168 — the stage banner is printed on every surface, and nothing changes without a charter

**Requirement.** With a charter, `check` (with and without `--strict`), `check --json`, the SARIF run properties, the delivery report and `doctor` print « delegation: declared, not proved — the maintainer's credential is within agent reach » and « charter: declared, not proved ». Without one, no section, JSON key, gap count or SARIF property appears.

**Verified by.** `test/unit/delegation-charter.test.js` — "with a charter, check (text, JSON, SARIF), report and doctor print the stage banner at the character"

**Does not assert.** Anything about protection: stage 1 adds attribution, not protection, and the banner says so.

### TOR-169 — a defective charter turns the strict gate red with the cause named

**Requirement.** A malformed charter, or one delegating class I in stage 1, makes `check --strict` exit 1, counts in `gaps.charter`, lists a `delegation` row in the `conformance` table with its kind, and names the next gesture `fix-delegation-charter`; the presence gate is unchanged.

**Verified by.** `test/unit/delegation-charter.test.js` — "a malformed charter, or one delegating class I in stage 1, turns check --strict red with the cause named (exit 1)"

**Does not assert.** That fixing the charter is done by the accountable person; the charter is the maintainer's by convention (class R), not by a check.

### TOR-170 — `doctor` sets the charter's expiry beside the clock

**Requirement.** `doctor` compares `expires:` with the date of the run (`RUNWARD_NOW`, then `SOURCE_DATE_EPOCH`, in non-interactive runs), warns when the charter has expired or expires within 14 days, and otherwise says how many days are left.

**Verified by.** `test/unit/delegation-charter.test.js` — "doctor sets expires beside the clock: in force, within 14 days, expired"

**Does not assert.** That anyone reads the warning: a notice delivered is not a notice read (ADR-0088 decision 7).

### TOR-171 — the charter's accountable person merges over the lock's identities

**Requirement.** The charter's `accountable` id gets the union of its aliases and the lock's for that id, the charter's first; an alias the charter gives that person is removed from other lock ids; every other lock id stays declared; the regulated reading uses the merged identities.

**Verified by.** `test/unit/delegation-charter.test.js` — "the charter's accountable person merges over the lock's identities, the charter first"

**Does not assert.** That any of the names belongs to the person. Every id and alias is declared.

### TOR-172 — `init`, `wire` and `update` never write a charter

**Requirement.** No command scaffolds `runward/delegation.md`: `init` (with and without `--example`), `wire` and `update` leave it absent.

**Verified by.** `test/unit/delegation-charter.test.js` — "init and wire never write a charter: it is the accountable person's act (class R)"

**Does not assert.** That a person, rather than an agent, wrote a charter that exists.

### TOR-173 — `verify` re-derives the delegation block

**Requirement.** When the tree holds a charter, `verify` re-derives the predicate's `delegation` block and `gaps.charter` and reports a tampered or dropped one as a difference.

**Verified by.** `test/unit/delegation-charter.test.js` — "verify re-derives the delegation block: a tampered banner or gap count is a difference"

**Does not assert.** The attestation's author; it is unsigned by design.

### TOR-174 — the sample's randomness is recomputed offline, and declared

**Requirement.** The drand round a period draws on is recomputed from the period's end (the first quicknet round emitted at or after 00:00 UTC that day), and its randomness is recomputed as SHA-256 of the round's signature; a mismatch on either is a named problem. The signature is not verified against drand's public key, and every surface carrying the sample says « randomness: declared ».

**Verified by.** `test/unit/delegation-sample.test.js` — "drand: the round is fixed by arithmetic, quicknet's randomness is SHA-256 of a real round's signature"

**Does not assert.** That the round's signature was produced by drand. A fabricated 48-byte signature passes the offline check; the BLS verification is left to anyone with the public key.

### TOR-175 — the draw is fixed, stratified and risk-weighted

**Requirement.** The draw depends only on the population and the randomness, never on their order: one act from each non-empty stratum first, then risk-weighted without replacement up to `sample-size`; the seeds land at positions the randomness fixes; the population hash is order-free.

**Verified by.** `test/unit/delegation-sample.test.js` — "the draw is fixed, stratified and risk-weighted; the population hash ignores order"

**Does not assert.** That the weights reflect the real risk of an act. They are a declared ordering, ADR-0088 decision 6.

### TOR-176 — a period re-performs from the ledger alone

**Requirement.** A period whose seed, draw, review and reveal records hold is read as `passed` by the gate with no git, no process and no clock, and moves the chain to its end; a period not yet reviewed or revealed counts for nothing and is not a gap; a record that ended on or before `effective:` is `superseded`.

**Verified by.** `test/unit/delegation-sample.test.js` — "a full period re-performs offline from the ledger alone: seed caught, every act accepted, the period counts"

**Does not assert.** That the review was read. A verdict per item is a record, and in stage 1 « sample: declared human, not proved ».

### TOR-177 — a seed accepted is `control missed`; a rejected act suspends its delegate

**Requirement.** A sample whose seed was accepted is `control-missed` and does not count; a sample that caught every seed and rejected an act counts, is not a passing sample, and suspends class D for a delegate whose act it rejected, from the period's end.

**Verified by.** `test/unit/delegation-sample.test.js` — "a seed accepted is control missed and the sample does not count; a rejected act suspends that delegate's class D"

**Does not assert.** That the seed was hard to find. A reviewer who checks the population can tell a seed from a drawn act; the control measures that each item was opened.

### TOR-178 — every tampering of a sample record is named, never repaired

**Requirement.** A drawn item changed, a randomness, round, population, count, shipped-code digest, verdict list or seed opening that does not hold, records out of order, a period off the charter's boundaries, a draw leaving a hole after the chain, and a line that is not a record are each a named problem (`sample-malformed`), and the sample does not count.

**Verified by.** `test/unit/delegation-sample.test.js` — "every tampering is named, never repaired, and the sample does not count"

**Does not assert.** That a ledger rewritten whole and consistently is noticed. Its git history is what `runward sample` reads.

### TOR-179 — missed periods are read against the tree, never a clock

**Requirement.** The gate counts the periods ended after the chain's end against the latest date a ratification entry in the tree declares; the module the verdict imports reads no wall clock, spawns nothing and opens no socket.

**Verified by.** `test/unit/delegation-sample.test.js` — "missed periods are read against the latest date the tree declares, never a clock"

**Does not assert.** That a period missed while nothing is declared after it is noticed by the gate. `runward doctor` and `runward sample` say it against today (TOR-183).

### TOR-180 — two missed periods turn agent acts red, one is a notice

**Requirement.** With one missed period every surface prints « unsampled since <date> » and nothing counts against the verdict; with two or more, each agent ratification in force dated on or after the chain's end is a `sample-missed` strict gap on its row; a delegate suspended by a sample is a `class-suspended` gap on its later rows; a malformed record lands on the ledger.

**Verified by.** `test/unit/delegation-sample.test.js` — "two missed periods: agent acts since the chain are strict gaps on their rows; one missed is a notice, never a gap"

**Does not assert.** That the dates the entries declare are true: they are declared.

### TOR-181 — a suspended delegate and a malformed record are located where they belong

**Requirement.** A `class-suspended` gap is on the row of the suspended delegate's ratification, never on another delegate's or on an act before the sample's end; a `sample-malformed` gap is located on `runward/delegation-samples.jsonl` in the JSON and SARIF outputs.

**Verified by.** `test/unit/delegation-sample.test.js` — "a rejected act suspends its delegate's class D; a malformed record lands on the ledger"

**Does not assert.** That the suspension is lifted by the right person: renewing the charter is the maintainer's act by convention (class R).

### TOR-182 — the single-accountable exception counts only under a passing sample

**Requirement.** Under the regulated tier, a row ratified as `agent (single accountable)` under the lock's exception counts only when a `passed` sample covers its date; a `control-missed`, unreviewed or non-covering sample leaves it `single-accountable-unsampled`; after two missed periods agent ratifications stop counting (`agent-unsampled`).

**Verified by.** `test/unit/delegation-sample.test.js` — "single accountable under the regulated tier counts only for a date a passing sample covers; two missed periods stop agent ratifications"

**Does not assert.** That the exception is a DORA change-approval control. It is not, and every surface says so.

### TOR-183 — every surface carries the sample, and the same tree gives the same verdict

**Requirement.** `check` (text, JSON, SARIF), the delivery report and `doctor` carry « sample: declared human, not proved », the randomness sentence and « unsampled since <date> »; `doctor` reads the periods against today; `check --strict --json` is byte-identical under two clocks; `verify` re-derives the sample block.

**Verified by.** `test/unit/delegation-sample.test.js` — "check (text, JSON, SARIF), report, doctor and verify carry the sample; the same tree gives the same verdict on any day"

**Does not assert.** That anyone reads the notice: a notice delivered is not a notice read (ADR-0088 decision 7).

### TOR-184 — `runward sample` builds the period from git and leaves the review to the maintainer

**Requirement.** `runward sample` plants a seed as a commitment and keeps the seed outside the tree, refuses to draw before the period ends or without the round's signature (printing where to fetch it), builds the population from git with its merge count reconciled and its shipped-code merges listed, prints the items and the one command to sign, refuses the review inside an agent session or with an item left without a verdict, reveals the seeds after the review, and reports the review commit's signature status and the order of the commits.

**Verified by.** `test/unit/delegation-sample.test.js` — "runward sample: plant, draw, review, reveal on a git repository; the gate reads the period as passed; the review refuses an agent session"

**Does not assert.** That the person who ran the review is the maintainer: the agent-session stop is environment detection, and in stage 1 the signing key is within agent reach.

---

## 16. Exit 2, legible

Exit 2 means the question could not be asked; it carries several classes, and each one is named for a
machine ([ADR-0083](../adr/ADR-0083-exit-code-two-carries-several-meanings-say-which-before-splitting-it.md)).
TOR-005 holds unchanged.

### TOR-118 — no mission is named `no-mission`

**Requirement.** Each command whose `--json` form owns an error document, run where no mission is found, exits 2 with `error: "no-mission"` beside the `verdict` or `reason` it already carried.

**Verified by.** `test/unit/exit-two-legible.test.js` — "exit 2 legible: no-mission, additive beside the verdict/reason each document already carried"

**Does not assert.** That the mission search looked where the operator expected.

### TOR-119 — misuse is named `usage`

**Requirement.** A Commander parse error, and each command's own refusal of its arguments, exits 2 with `error: "usage"` and a plain sentence.

**Verified by.** `test/unit/exit-two-legible.test.js` — "exit 2 legible: usage, from Commander and from each command's own refusals"

**Does not assert.** That every misuse is detected (TOR-005's reservation applies).

### TOR-120 — a gesture runward will not perform is named `refused`

**Requirement.** A gesture runward refuses here (`--agent` without `--for`, `report -o` over a file that is not a delivery report, `wire --install` from an agent harness) exits 2 with `error: "refused"`.

**Verified by.** `test/unit/exit-two-legible.test.js` — "exit 2 legible: refused, for the gestures runward will not perform here"

**Does not assert.** That the list of refused gestures is complete, or that each refusal wrote nothing; the report case is pinned by TOR-148.

### TOR-121 — unreadable input is named `unreadable-input`

**Requirement.** An attestation or a spec that is absent or unreadable exits 2 with `error: "unreadable-input"` beside the reason `verify` or `spec-check` already gave.

**Verified by.** `test/unit/exit-two-legible.test.js` — "exit 2 legible: unreadable-input, beside the reason/verdict verify and spec-check already name"

**Does not assert.** Which byte made the input unreadable.

### TOR-122 — no document is invented

**Requirement.** Where `--json` owns no error document, or without `--json`, exit 2 leaves stdout empty.

**Verified by.** `test/unit/exit-two-legible.test.js` — "exit 2 legible: no document where only --json owns one, and none without --json"

**Does not assert.** The wording of stderr.

### TOR-123 — the shipped samples read 2 as never a red gate

**Requirement.** Every shipped sample that prints the exit codes says that 2 is never a red gate, and not only "no mission".

**Verified by.** `test/unit/exit-two-legible.test.js` — "RWD-2026-0157: every shipped sample that prints the exit codes says 2 is never a red gate, and not only 'no mission'"

**Does not assert.** That an operator's own copy of an older sample was updated.

---

## 17. The machine surface, widened

### TOR-124 — `status --json` carries the strict verdict

**Requirement.** `status --json` carries the gate, the deliverables and the strict verdict, not the deliverables alone.

**Verified by.** `test/unit/read-commands-json.test.js` — "json surface: status carries the gate, the deliverables and the strict verdict"

**Does not assert.** That the other read commands' payloads are frozen; their fields are additive (TOR-031's rule).

### TOR-125 — a refusal row is located

**Requirement.** Each `conformance` row of `check --json` carries its kind, file, line and phase id, at the location the SARIF gives.

**Verified by.** `test/unit/check-machine-surface.test.js` — "RWD-2026-0149: each conformance row carries kind, file, line and phaseId, at the SARIF location"

**Does not assert.** That the location is the one to edit; it is where the gate read the row.

### TOR-126 — a missing line is said, not invented

**Requirement.** A row with no manifest line carries `line: null`, and every row carries a kind.

**Verified by.** `test/unit/check-machine-surface.test.js` — "RWD-2026-0149: a row with no manifest line says line null, and every row has a kind"

**Does not assert.** Anything about the other fields' presence beyond TOR-125.

### TOR-127 — coverage and prose rows reach the JSON

**Requirement.** `check --coverage --json` and the rows accepted as prose carry the terminal's own numbers.

**Verified by.** `test/unit/check-machine-surface.test.js` — "RWD-2026-0150: --coverage and the prose rows reach the JSON, from the terminal's own numbers"

**Does not assert.** That prose rows are good evidence; they are disclosed.

### TOR-128 — one phase id joins the three vocabularies

**Requirement.** `phaseId` joins deliverables to `--through` and conformance rows to `rules --phase`.

**Verified by.** `test/unit/check-machine-surface.test.js` — "RWD-2026-0151: phaseId joins deliverables to --through and conformance rows to rules --phase"

**Does not assert.** That the human labels were unified; the join is on the machine field.

### TOR-129 — `check --json` names the next step the terminal names

**Requirement.** A red strict run's `next` field names the strict gate to re-run, as the terminal's "Next" line does.

**Verified by.** `test/unit/check-json-next.test.js` — "json next: a red strict run names the strict gate to re-run, as the terminal does"

**Does not assert.** That following the step will turn the gate green.

### TOR-130 — sub-counts are said to be inside the conformance count

**Requirement.** A proposal is counted inside `gaps.conformance`, not beside it, and the help of `check --json` says so.

**Verified by.** `test/unit/check-json-gaps-doc.test.js` — "gaps doc: a proposal is counted inside gaps.conformance, not beside it"

**Does not assert.** That a consumer reads the help before summing the counters.

---

## 18. The armed gate

`runward wire --install` lets the operator, and only the operator, install a hook that blocks the end
of an agent's turn on a red gate; `runward gate-hook` is the one engine behind it
([ADR-0065](../adr/ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md)).

### TOR-131 — an agent cannot install the gate

**Requirement.** `wire --install` refuses first when an agent runtime signal is present, then when no terminal is attached; `--dry-run` is exempt because it writes nothing.

**Verified by.** `test/unit/wire-install.test.js` — "the locks: an agent signal refuses first, then the missing terminal — and --dry-run is exempt"

**Does not assert.** That every agent runtime sets a signal runward knows. An agent that hides its signal and owns a terminal is outside what a local check can see.

### TOR-132 — installing preserves the operator's settings

**Requirement.** Merging into an existing settings file keeps every operator key and hook, and adds one marked entry.

**Verified by.** `test/unit/wire-install.test.js` — "the preserving merge: every operator key and hook survives, one marked entry lands"

**Does not assert.** That the harness reads the merged file as runward expects; that is the harness's documented contract.

### TOR-133 — removal touches only what runward marked

**Requirement.** `wire --uninstall` removes only the entry runward marked and leaves no empty structure it created.

**Verified by.** `test/unit/wire-install.test.js` — "the symmetric removal touches only what runward marked, and cleans up after itself"

**Does not assert.** Anything about entries the operator edited by hand after installing.

### TOR-134 — detection never writes

**Requirement.** `wire --json` is at schema version 2: detection writes nothing, and installing is a named policy.

**Verified by.** `test/unit/wire-install.test.js` — "the wire --json contract is v2: detection never writes, installing is a named policy"

**Does not assert.** That detection finds every harness present.

### TOR-135 — the armed tier is named beside the advisory one

**Requirement.** `wire` names `wire --install` beside the advisory sample, and says the sample never blocks.

**Verified by.** `test/unit/wire-armed-tier.test.js` — "armed tier: wire names wire --install beside the advisory sample, and says the sample never blocks"

**Does not assert.** That the operator chooses the armed tier.

### TOR-136 — a red mission blocks in the harness's own shape

**Requirement.** On a red gate, `gate-hook --harness claude` exits 2 with the refusals named on stderr.

**Verified by.** `test/unit/gate-hook.test.js` — "a red mission blocks in the claude shape: exit 2, the refusals named on stderr"

**Does not assert.** That the harness honours the refusal. Blocking is the harness's act upon the exit code; this exit 2 is the harness's protocol, outside the port (ADR-0083).

### TOR-137 — a green mission is silence

**Requirement.** On a green gate, `gate-hook` exits 0, writes nothing and logs nothing.

**Verified by.** `test/unit/gate-hook.test.js` — "a green mission is silence: exit 0, nothing written, no log"

**Does not assert.** That the gate it ran was the full one the operator intended; it runs `check --strict`.

### TOR-138 — the gate blocks once, and the release is traced

**Requirement.** When the harness signals a repeated stop, `gate-hook` releases and appends a line to a log meant to be committed.

**Verified by.** `test/unit/gate-hook.test.js` — "block ONCE: stop_hook_active releases, and the release is a committed trace"

**Does not assert.** That the line is committed; runward writes it, the operator commits it.

### TOR-139 — garbage on stdin does not soften the verdict

**Requirement.** An unreadable harness payload does not turn a red gate into a release.

**Verified by.** `test/unit/gate-hook.test.js` — "garbage on stdin does not soften the verdict: the gate still blocks"

**Does not assert.** That every payload field a harness may send is read.

### TOR-140 — a misconfigured hook fails open, says so, and traces it

**Requirement.** An unknown or missing `--harness` exits 0 with an empty stdout, says on stderr that the gate was not evaluated, and appends a line to the bypass log, on every turn.

**Verified by.** `test/unit/hooks-fail-honestly.test.js` — "hooks-honest: a misconfigured gate-hook fails open, says so, and traces it — even under stop_hook_active"

**Does not assert.** That the operator reads stderr or the log. Failing open on infrastructure is the decision; failing silently is what is refused.

### TOR-141 — no mission is a fail-open that is said

**Requirement.** `gate-hook` with no mission reachable exits 0 with an empty stdout, and says on stderr that the gate was not evaluated.

**Verified by.** `test/unit/hooks-fail-honestly.test.js` — "hooks-honest: gate-hook with no mission reachable says so on stderr, still exit 0 with an empty stdout"

**Does not assert.** That a mission should have been found.

### TOR-142 — the harness id `wire` prints is the one `gate-hook` accepts

**Requirement.** Each harness id `wire` reports, and its gate-hook id, both run the gate; neither is answered "unknown harness".

**Verified by.** `test/unit/wire-gate-hook-ids.test.js` — the parametrised case "hook ids: wire's (detection id) and its gateHookId both run the gate", one per harness

**Does not assert.** That every harness can block. One that cannot stays a misconfiguration, and `wire` says null.

### TOR-143 — the hook seam carries no crossing

**Requirement.** `gate-hook` computes the verdict in process: the modules it imports carry none of the crossings ADR-0054 enumerates, with no allowance at all.

**Verified by.** `test/unit/runtime-boundary.test.js` — "ADR-0054, the gate-hook ring: the harness seam carries NO crossing at all — not even the hook seam"

**Does not assert.** Anything beyond the import graph of the built `dist/` it walks; the verdict ring is TOR-156.

---

## 19. Operator hooks under `check --hooks`

### TOR-144 — a malformed hooks file fails the gate

**Requirement.** Under `--hooks`, a `hooks.json` that does not parse is said and reddens the gate; it is never a green with no hook run.

**Verified by.** `test/unit/hooks-fail-honestly.test.js` — "hooks-honest: a malformed hooks.json under --hooks is said and fails the gate — never a green with no hook run"

**Does not assert.** That a well-formed file runs the right commands; they are the operator's (TOR-003).

### TOR-145 — a wrong shape is a shape error, and an absent file is said

**Requirement.** A string where a list of commands belongs is refused as a shape error, not run character by character; a missing `hooks.json` under `--hooks` is said.

**Verified by.** `test/unit/hooks-fail-honestly.test.js` — "hooks-honest: a string where a list belongs is a shape error, not six commands; an absent file is said"

**Does not assert.** That an absent file reddens. It does not: no `hooks.json` is a legitimate state, said and not gated.

### TOR-146 — a failed hook is named

**Requirement.** The failed hook's command is named in the terminal and in `--json`, not only counted.

**Verified by.** `test/unit/hooks-fail-honestly.test.js` — "hooks-honest: the failed hook is named, in the terminal and in --json"

**Does not assert.** Why the hook failed; its own output is the operator's to read.

---

## 20. What the CLI writes, and refuses to write

### TOR-147 — runward's blank charter is not evidence

**Requirement.** An `applied` row citing the untouched `AGENTS.md` that `init` writes is refused under `--strict`, and the refusal says why.

**Verified by.** `test/unit/gate-scaffold-not-evidence.test.js` — "gate scaffold: an applied row citing the untouched blank AGENTS.md is refused, and says why"

**Does not assert.** That a written charter is a good one; it departs from the template, which is the whole test (TOR-041's limit, one floor up).

### TOR-148 — `report -o` does not overwrite what it did not write

**Requirement.** `report -o` refuses a target that is not a delivery report, and leaves it intact.

**Verified by.** `test/unit/report-out-guard.test.js` — "report -o refuses to overwrite a file that is not a delivery report, and leaves it intact"

**Does not assert.** That an older delivery report at that path is kept; it is replaced, by design.

### TOR-149 — `report` honours the global `--dry-run`

**Requirement.** `runward --dry-run report` writes nothing, removes nothing, and says what it would write.

**Verified by.** `test/unit/report-out-guard.test.js` — "report under the global --dry-run writes nothing, removes nothing, and says what it would write"

**Does not assert.** That the report it would write is correct; report rendering has no requirement (section 24).

### TOR-150 — `characterize --mine` does not redden a governed mission

**Requirement.** On a governed mission, `characterize --mine` refuses before writing, and `check --strict` stays green.

**Verified by.** `test/unit/characterize-governed.test.js` — "characterize --mine on a governed mission refuses before writing, and the gate stays green"

**Does not assert.** Anything about `characterize` on a project without a mission (section 24).

### TOR-151 — `init --example --force` keeps the reference charter

**Requirement.** Re-running the example with `--force` keeps its finalized `AGENTS.md` and says so.

**Verified by.** `test/unit/init-example-force-charter.test.js` — "init --example --force keeps the reference's finalized charter, and says it keeps it"

**Does not assert.** What `--force` does to the operator's own files outside the example.

### TOR-152 — the packed example is green

**Requirement.** From the packed package, `init --example` then `check --strict` exits 0.

**Verified by.** `test/unit/example-packed.test.js` — "RWD-2026-0156: the packed example is green out of the box — init --example then check --strict exits 0"

**Does not assert.** That the example is a model of good evidence; it is a reference that crosses the gate.

---

## 21. Readings that must not contradict the verdict

### TOR-153 — a red run's next step names the gate that said no

**Requirement.** The "Next" line of a red run names the command that produced the red, and that command stays red when re-run.

**Verified by.** `test/unit/cli-false-greens.test.js` — "RWD-2026-0129: a red run's Next line names the gate that said no, and that command stays red"

**Does not assert.** That the step is the shortest way to green.

### TOR-154 — `status` never calls a refused arc complete

**Requirement.** `status` does not call the delivery arc complete while `check --strict` refuses it.

**Verified by.** `test/unit/cli-false-greens.test.js` — "RWD-2026-0130: status never calls the arc complete while check --strict refuses it, and check no longer sends there"

**Does not assert.** That `status` lists every strict gap; `check --strict` is the verdict.

### TOR-155 — no "all gates passed" under a red verdict

**Requirement.** The current-gate label never reads "all gates passed" under a red verdict, in the terminal, the JSON or the delivery report.

**Verified by.** `test/unit/cli-false-greens.test.js` — "RWD-2026-0131: Current gate never reads 'all gates passed' under a red verdict (terminal, JSON, report)"

**Does not assert.** That every other sentence agrees with the verdict; report prose has no requirement (section 24).

---

## 22. Invariants, widened

The runtime boundary of [ADR-0054](../adr/ADR-0054-the-runtime-boundary-is-explicit.md), held by the import graph and by a re-run.

### TOR-156 — the verdict path crosses nothing

**Requirement.** The modules the verdict is computed from import no socket and no process spawner, transitively.

**Verified by.** `test/unit/runtime-boundary.test.js` — "ADR-0054 crossing 1: the verdict path imports no socket and no process spawner, transitively"

**Does not assert.** That the whole CLI is network-free; it is not. Operator hooks spawn processes by design, outside the verdict path.

### TOR-157 — the same tree gives the same verdict

**Requirement.** Two runs on the same working tree produce byte-identical verdicts.

**Verified by.** `test/unit/runtime-boundary.test.js` — "ADR-0054 crossing 4: same working tree, same verdict — byte-identical across two runs"

**Does not assert.** That the verdict is right; it is reproducible.

The eight relations below are [ADR-0089](../adr/ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md)'s,
each a property over missions generated from the shipped example by reordering rows, deciding rows
otherwise, citing new evidence files and adding uncited ones (fixed seed, `RUNWARD_MR_RUNS` missions per
relation, 3 by default). A relation relates two verdicts; it is not an oracle for either, so no entry
below asserts that a single verdict is right. The red-turning relations are judged on missions that were
green first.

### TOR-192 — one canonical snapshot, one verdict

**Requirement.** An LF checkout and a CRLF checkout of the example mission have one canonical snapshot (paths in POSIX spelling, CRLF folded to LF in text files, the runward version, the template digests and the repository markers above the root) and receive byte-identical canonical verdicts.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "snapshot: an LF and a CRLF checkout of one mission have one snapshot and get one verdict"

**Does not assert.** That every pair of trees sharing a snapshot gets one verdict; it is measured on the example, and the round trip of the snapshot itself on generated missions. A Windows file system is not exercised: the path spelling is checked on `path.win32`'s output, not on a Windows checkout.

### TOR-193 — renaming an uncited file changes nothing

**Requirement.** Renaming a file outside `runward/` that no file of the mission or of the root mentions leaves the canonical verdict byte-identical.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-1: renaming a file no row cites leaves the verdict unchanged"

**Does not assert.** Anything about a file a row cites; that is TOR-198.

### TOR-194 — row order is not content

**Requirement.** Reversing the order of the rule rows of one or more gated manifests leaves the canonical verdict byte-identical, lists compared as sorted.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-2: reversing the order of a manifest's rule rows leaves the verdict unchanged"

**Does not assert.** That the order of a list in the payload is stable; `requiresUnmet`, for one, follows the row order, which is why the comparison sorts every list.

### TOR-195 — cell padding is not content

**Requirement.** Re-padding the cells of every rule row with spaces leaves the canonical verdict byte-identical.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-3: re-padding the cells of every rule row leaves the verdict unchanged"

**Does not assert.** Whitespace inside a cell, between words; the ratification digest's folding of it is held by `test/unit/manifest-fuzz.test.js`, not by this entry.

### TOR-196 — line endings are not content

**Requirement.** Converting any subset of a mission's text files to CRLF leaves the canonical verdict byte-identical.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-4: converting files to CRLF leaves the verdict unchanged"

**Does not assert.** A lone CR or a U+2028 inside a cell; those are pointer-grammar cases (RWD-2026-0026) held by their own tests.

### TOR-197 — an unexpected n/a row is disclosed and changes nothing else

**Requirement.** Adding an `n/a` row with a reason, for a known rule the deliverable's phase does not expect, leaves the exit code and the violations unchanged and moves exactly three disclosed counts by one: the breakdown's rows, its `n/a` rows, and the ratification ledger's untraced rows.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-5: adding an n/a row for a rule the phase does not expect leaves the verdict unchanged"

**Does not assert.** That such a row is useful to anyone; the gate accepts it as a disclosed decision and reads nothing in its reason.

### TOR-198 — deleting a cited file turns green to red

**Requirement.** On a green generated mission, deleting a file outside `runward/` that an `applied` row cites makes the verdict red with an `unresolved-pointer` violation.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-6: deleting a file an applied row cites turns a green verdict red"

**Does not assert.** Which rule carries the violation when several rows cite the file; the property asserts that one does.

### TOR-199 — duplicating a row turns green to red

**Requirement.** On a green generated mission, duplicating a rule row makes the verdict red with a `duplicate-row` violation for that rule in that deliverable.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-7: duplicating a rule row turns a green verdict red"

**Does not assert.** Anything about the same rule listed in two different manifests, which this relation does not produce.

### TOR-200 — emptying an applied cell turns green to red

**Requirement.** On a green generated mission, emptying the evidence cell of an `applied` row for an expected rule makes the verdict red with an `applied-without-evidence` violation for that rule in that deliverable.

**Verified by.** `test/unit/verdict-metamorphic.test.js` — "MR-8: emptying the evidence of an applied row turns a green verdict red"

**Does not assert.** The same for a rule the phase does not expect; the row checks run over the expected set.

The entries below are step 3 of ADR-0089's increment 1: `check --strict --witness <file>` writes the
facts a strict verdict relied on, specified by [`docs/spec/witness.md`](../spec/witness.md) for a
checker that shares no code with runward. They hold the emitter. None of them asserts that a checker
agrees with a witness: the checker is written from the specification by another session, and its
requirements will be its own.

### TOR-201 — a witness is deterministic and canonical

**Requirement.** Two runs of `check --strict --witness` on one tree, and on two checkouts of one tree in two directories, write byte-identical witnesses, in the canonical encoding of `docs/spec/witness.md` section 3, with no absolute path; and the witness built in process from a computed verdict is the command's file, byte for byte.

**Verified by.** `test/unit/verdict-witness.test.js` — "determinism: the same tree twice, and two checkouts in two directories, give byte-identical witnesses"

**Does not assert.** Identity across operating systems or runward versions; the witness names its version because the verdict depends on it.

### TOR-202 — a witness never changes what check prints or exits with

**Requirement.** With and without `--witness`, on a green and on a red mission, in text, `--json` and `--sarif`, `check --strict` writes the same stdout and exits with the same code, and the witness's `verdict.exitCode` is that code.

**Verified by.** `test/unit/verdict-witness.test.js` — "stdout and the exit code are the same with and without --witness, green and red, text and --json"

**Does not assert.** Anything about stderr, which carries the notice that the witness was written.

### TOR-203 — the global --dry-run writes no witness

**Requirement.** Under `--dry-run`, `check --strict --witness <file>` writes no file and keeps the stdout and exit code of the same run without `--witness`.

**Verified by.** `test/unit/verdict-witness.test.js` — "--dry-run writes no witness and changes neither stdout nor the exit code"

**Does not assert.** The byte count the notice announces.

### TOR-204 — a witness that cannot be written is refused before the gate runs

**Requirement.** `--witness` without `--strict`, beside `--freeze`, on a directory, under a missing or unwritable directory, or inside `runward/` exits 2 as a usage error, and on an existing file that is not a witness exits 2 as a refusal leaving the file intact; each prints no audit, writes nothing, and under `--json` emits the ADR-0083 error document with its class. An existing witness is overwritten.

**Verified by.** `test/unit/verdict-witness.test.js` — "refusals exit 2, before the gate runs, and write nothing"

**Does not assert.** A write that fails after the gate ran (a disk filling up), which is handled by removing the temporary file and exiting 2, and is not provoked by the test.

### TOR-205 — every case of the attack corpus yields a witness that says its exit code

**Requirement.** For each of AC-001 to AC-017, `check --strict --witness` judges the case as the corpus expects, writes a witness whose `verdict.exitCode` and `verdict.result` are the run's, whose causes number `gaps + strictGaps + hookFailed`, and which, for a refused case, carries at least one cause.

**Verified by.** `test/unit/verdict-witness.test.js` — "every attack corpus case yields a witness whose verdict is the exit code (AC-001 to AC-017)"

**Does not assert.** That a checker re-derives each refusal from the witnessed facts; that is the checker's own test.

### TOR-206 — the witness's arithmetic holds across families

**Requirement.** On a mission red at once on a deliverable, a missing row, an edited rule and an unratified decision, the causes number `gaps + strictGaps + hookFailed`, `strictGaps` is the sum of the breakdown plus the workflow-contract causes, each family's causes equal its count, and `notWitnessed` lists the families of the specification with their cause counts.

**Verified by.** `test/unit/verdict-witness.test.js` — "the arithmetic a checker re-checks holds on a mission red in several families at once"

**Does not assert.** The seal, regulated, charter, workflow-contract and hooks families, which this mission does not exercise.

### TOR-207 — the specification names every member a witness carries

**Requirement.** Every member name that occurs in the witnesses of a green example, of a horizon run and of a red run with a deviation, a dead pointer and a malformed `adr:` pointer is named in `docs/spec/witness.md`, which also states the schema identifier, every `notWitnessed` family and that a checker never changes `check`'s exit code.

**Verified by.** `test/unit/verdict-witness.test.js` — "the specification names every member a witness carries, and the facts it was written from"

**Does not assert.** That the specification is right or sufficient; that is measured when a checker written from it alone agrees with runward (ADR-0089, "What would settle it").

---

## 23. The qualification kit

The kit a release carries for regulated users ([ADR-0087](../adr/ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md)): a runner, the cited tests, this document and the open anomalies of that version. These requirements hold the runner and its builder, not the tool the kit exercises.

### TOR-185 — the kit runs only against its own version

**Requirement.** The qualification kit's runner exits 2, and runs no test, when the installed `package.json` is not runward at the kit's version.

**Verified by.** `test/unit/qualification-kit.test.js` — "kit run: refuses an installation of another version, exit 2, before any test"

**Does not assert.** That the installed files are the published ones; that is TOR-186.

### TOR-186 — one changed installed byte withholds every result

**Requirement.** The runner compares the SHA-256 of every installed file with the list of the npm tarball the kit carries; on a changed or missing file it records the comparison, records no test result, and exits 3.

**Verified by.** `test/unit/qualification-kit.test.js` — "kit run: one changed installed byte withholds every result, exit 3"

**Does not assert.** That the tarball list itself is authentic: that is the kit's attestation, checked by the user before extraction (`docs/verifying-a-release.md`).

### TOR-187 — a file the tarball does not hold is a mismatch

**Requirement.** A file present in the installation and absent from the tarball's list, outside `node_modules/`, is reported as extra and makes the comparison a mismatch (exit 3).

**Verified by.** `test/unit/qualification-kit.test.js` — "kit run: an extra installed file is a mismatch too, node_modules aside"

**Does not assert.** Anything about the installation's dependencies under `node_modules/`, which the comparison does not read.

### TOR-188 — a kit altered after extraction is refused

**Requirement.** The runner checks every file of the kit against `kit-manifest.json` and, on a difference, records no test result and exits 3.

**Verified by.** `test/unit/qualification-kit.test.js` — "kit run: a kit whose own files changed after extraction is refused, exit 3"

**Does not assert.** Protection against someone who rewrites the manifest too; the manifest is inside the attested kit file, and that attestation is the check.

### TOR-189 — the report never counts what did not run here

**Requirement.** The runner reports a cited case that reads the source tree, or imports a package that is neither a Node built-in nor a runtime dependency of runward, as `not-run-here` with a pointer to the source commit's `reports/junit.xml`, never as `pass`; reports the `js-yaml` check of `smoke.js` as `skipped` while the rest of `smoke.js` runs; records the kind of each case, the environment and the digest comparison before and after the run; and finds the installation unchanged after it.

**Verified by.** `test/unit/qualification-kit.test.js` — "kit run: kinds, not-run-here, the skipped js-yaml check, the corpus, and an untouched installation"

**Does not assert.** That a passing case is relevant to the requirement citing it (see the reservation at the top of this document), or that the report means anything for a user's tool classification; that determination is the user's.

### TOR-190 — a case's kind is derived from its source, never written by hand

**Requirement.** The kit builder labels a cited case `internal` when anything it reaches, fixture included, uses a module of `dist/`; `interface` when it otherwise runs the binary; `static` otherwise; marks it as needing the source tree only when it reads, relative to the repository root, a path the installed package does not have; and marks it as needing a package when it, or a test support file it imports transitively, imports a package that is neither a Node built-in nor a runtime dependency of the installed runward, while a case importing a runtime dependency still runs.

**Verified by.** `test/unit/qualification-kit.test.js` — "classification: the kind is derived from what the case reaches, fixture included"

**Verified by.** `test/unit/qualification-kit.test.js` — "classification: a package the installation does not provide makes a case not-run-here, through the import graph"

**Does not assert.** That the derivation sees every way a test can reach a path or a module; it reads the patterns the cited tests use, and errs toward `internal`.

### TOR-191 — two builds of a kit are byte-identical

**Requirement.** Building the kit twice from the same tree and the same tarball produces the same bytes, with its entries sorted.

**Verified by.** `test/unit/qualification-kit.test.js` — "kit: two builds of the same tree and tarball are byte-identical, entries sorted"

**Does not assert.** That the kit's content is right; that is TOR-185 to TOR-190 and the run of the kit in the release chain.

---

## 24. What has no requirement yet

Stated rather than omitted, because an assessor finds the gap by reading the source tree and the
omission would then look like a claim.

- **The compliance pack derivation.** `src/lib/compliance.ts` is outside the measured perimeter
  (section 5.3 of `regulated-adoption.md`). What is verified there is form — byte-identical output
  against a fixture, schema validity, third-party ingestion — never the derivation of `partial`
  versus `implemented`. No TOR covers it, and writing one that cites the golden test would be a
  requirement about form dressed as a requirement about correctness.
- **The characterize path**, which reads an existing project rather than judging a mission. Its one
  requirement is that it does not redden a governed mission (TOR-150).
- **Report rendering.** The exit contract is covered; the prose that accompanies it is not, and a
  requirement per sentence would be requirements theatre.
- **The approval read on the forge** ([ADR-0080](../adr/ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md) part 2).
  The 0.42.3 changelog states it is "not in this release". Section 14 covers part 1 only, and
  TOR-107 holds that the payload never claims part 2.
- **The wording of what the CLI prints**, corrected by the audit of 2026-09-27 (RWD-2026-0152 to
  RWD-2026-0155, RWD-2026-0158 to RWD-2026-0162). Those corrections are pinned by tests
  (`check-machine-surface`, `cli-plain-words`, `gate-hook-refusal-grouping`), and stay outside this
  register for the reason given for report rendering above. Section 21 keeps the three sentences
  that contradicted a verdict.
- **RWD-2026-0163**, which concerns this repository's settings on its forge, not the tool.
- **The SARIF document as a whole.** Its locations and counts are reached by TOR-115 and TOR-125;
  its shape is tested (`test/sarif-shape.js`, `sarif-*.test.js`) and has no requirement row.
- **The shared corpus pin** ([ADR-0057](../adr/ADR-0057-the-shared-corpus-is-pinned-without-a-registry.md))
  and `update` beyond TOR-109.
- **The mutation survivors**, filed module by module in [`mutation-register.md`](mutation-register.md)
  under [ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md). They are the
  measured limit of the net behind these requirements, and every "verified by" above should be read
  against that register rather than instead of it. The second edition quoted a count; this one points
  at the register, which is produced from a measurement and moves with it.

## Traceability

`test/unit/tor-traceability.test.js` reds the build when a requirement loses its identifier, cites a
file that does not exist, cites a case name absent from that file, or cites a case name that the
committed JUnit report (`reports/junit.xml`) does not record as a test case. The last check, added
with the third edition, refuses a citation that matches a comment or a fragment of a test name
rather than a test that ran. It checks the link, never the relevance — see the reservation at the
top of this document.
