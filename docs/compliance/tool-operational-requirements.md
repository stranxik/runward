# Tool Operational Requirements — runward

**Register date**: 2026-08-11 · **Describes**: runward 0.33.5 · **Status**: first edition

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
> It is **not a claim that these requirements are sufficient**. They cover the verdict surface: what
> `check` decides, what the machine outputs promise, and the invariants the tool holds. They say
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

## 10. What has no requirement yet

Stated rather than omitted, because an assessor finds the gap by reading the source tree and the
omission would then look like a claim.

- **The compliance pack derivation.** `src/lib/compliance.ts` is outside the measured perimeter
  (section 5.3 of `regulated-adoption.md`). What is verified there is form — byte-identical output
  against a fixture, schema validity, third-party ingestion — never the derivation of `partial`
  versus `implemented`. No TOR covers it, and writing one that cites the golden test would be a
  requirement about form dressed as a requirement about correctness.
- **The characterize path**, which reads an existing project rather than judging a mission.
- **Report rendering.** The exit contract is covered; the prose that accompanies it is not, and a
  requirement per sentence would be requirements theatre.
- **The 81 mutation survivors** recorded against the verdict core ([ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md)).
  They are the measured limit of the net behind these requirements, and every "verified by" above
  should be read against that number rather than instead of it.

## Traceability

`test/unit/tor-traceability.test.js` reds the build when a requirement loses its identifier, cites a
file that does not exist, or cites a case name absent from that file. It checks the link, never the
relevance — see the reservation at the top of this document.
