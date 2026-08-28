# Mutation survivor register

Every mutant that runward's own test net fails to kill, filed with what it actually is.

This document exists because of [ADR-0046](../adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md),
which made mutation testing an instrument and set two obligations that only a committed artifact can
carry: decision 2 makes the survivor list a ratchet — *"the score does not go down and the absolute
survivor list does not grow"* — and decision 4 says each survivor is **filed**, not queued, because a
survivor is not automatically a defect.

Until 2026-08-19 the list existed only as counts inside that ADR. A ratchet nobody can diff is not a
ratchet, so the list is now produced from a real measurement, by
[`scripts/mutation-survivors.mjs`](../../scripts/mutation-survivors.mjs), and never typed by hand.

## What this is not

It is not a backlog to drive to zero, and it is not a score. ADR-0046 decision 1 refuses an absolute
threshold: a mutation score written into a manifest would be a verdict satisfied by a figure nobody
re-derived, which [ADR-0045](../adr/ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) forbids.
runward does not do to itself what it refuses from an operator. Nothing in this file is read by
`runward check`, and no CI job fails on it.

## Method

Two passes, in this order. The second one is not optional, and it is the reason the numbers here are
smaller than a raw Stryker report.

**Pass 1 — the unit suite.** `scripts/mutation-chunked.sh <module> <lines>` runs Stryker in resumable
line-range chunks. What survives is a mutant `node --test` did not kill.

**Pass 2 — the whole net.** ADR-0046 decision 2: the unit suite is not runward's safety net. In
August, 433 mutants survived the unit suite and **53 of them died** against the self-gate, the OSCAL
schema validation and the end-to-end smoke. Reporting those 53 as holes would have been false.
[`scripts/mutation-wholenet.mjs`](../../scripts/mutation-wholenet.mjs) re-runs each survivor against
that net and records which leg caught it.

Both passes *apply the mutant and read a verdict*. ADR-0046 decision 3 requires it: on an earlier
bench of four, three survivors declared harmless by reading the code were live defects. Reasoning
about a mutant is not evidence about a mutant.

## The four filings

| Filing | Meaning |
| --- | --- |
| `hole` | Nothing catches it and it changes a verdict. It gets an `RWD-` entry in [known-defects.md](known-defects.md) and a test. This is the only filing that creates work. |
| `defence-in-depth` | The unit suite misses it, another leg of the net catches it. Named with the leg that caught it. |
| `equivalent` | The mutant cannot change behaviour. **The argument is written out**, never assumed — this is the filing that was wrong three times out of four on the August bench. |
| `display-only` | It changes printed prose and nothing else. ADR-0046 decision 1: no test should pin prose. |

## Reproducing

```
npm run build
scripts/mutation-chunked.sh evidence 808          # pass 1, resumable
node scripts/mutation-survivors.mjs --chunks evidence --emit-merged reports/mutation/evidence.json
node scripts/mutation-wholenet.mjs --report reports/mutation/evidence.json --module evidence
```

A full pass over the eleven modules is an overnight, before-a-release job — 4250 mutants against a
47-second suite. `stryker.config.json` documents the measured cost, the levers that make it
affordable as the perimeter grows, and one lever that was tried and produces a fictional score.

## Perimeter, with its absences

Stated first, per ADR-0046 decision 5. The measurement covers library modules. It does **not** cover
`src/commands/check.ts`, where the verdict is assembled and the exit code is chosen: no unit test
imports a command, so mutating one would report 100 % survivors, which is noise rather than a
measurement. Pass 2 partially answers for those lines — the self-gate runs the real command — but a
mutant there is not counted here, and saying otherwise would be the overclaim this project refuses.

<!-- Module sections follow, each headed `## Module: <name>` — the marker is explicit so that the
     single-word headings above (Method, Reproducing) are not read as modules. Each declares its
     survivor count on a `Survivors: N` line, which test/unit/mutation-register.test.js checks
     against the number of table rows: a count stated separately from the table is what catches
     rows silently dropped by an edit. -->

<!-- GENERATED BELOW — scripts/mutation-register.mjs -->

Rows filed `hole`, `equivalent` or `display-only` survived the unit suite AND the whole net —
the self-gate, OSCAL validation, the smoke test, in-toto schema validation, the spelling corpus,
the SARIF shape check and the audit corpus. Rows filed `defence-in-depth` survived the unit suite
and were caught by one of those legs, so something does watch them, just not the tests. They are
listed rather than set aside: leaving them out was a prose exception that made the ratchet report
them as new survivors on every run.

The `Note` column is a summary. The full evidence for every verdict — what was run, what was
observed, and the argument for each equivalence — is in
[`mutation-survivors/`](mutation-survivors/), one file per function.

## Module: compliance

Survivors: 289

Holes: 135 · Equivalent: 24 · Display-only: 105 · Defence-in-depth: 25

### renderIso42001Readiness — 85 survivor(s): 40 hole · 2 equivalent · 37 display-only · 6 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 147 | ArrayDeclaration | `["Stryker was here"]` | display-only | Same class and same measurement as the eleven `L.push("")` injection twins (reference argument on the occurrence-16 one), with the position named because it is the strongest one available: this liter… |
| 150 | ConditionalExpression | `true` | equivalent | `counts` is written at exactly one site (dist/lib/compliance.js:151) and READ at exactly one site (line 178), where it is read by three literal keys: `counts.applied`, `counts.deviated`, `counts["n/a… |
| 150 | ConditionalExpression | `false` | hole | Measured on examples/request-triage through the real CLI: `**23 applied - 0 deviated - 13 n/a** across 36 accounted rule(s)` becomes `**0 applied - 0 deviated - 0 n/a** across 36 accounted rule(s)`. … |
| 150 | EqualityOperator | `counts[r.status] === undefined` | hole | Observably the same defect as the `-> false` twin on this line, measured the same way and byte-identical to it: on examples/request-triage the summary reads `**0 applied - 0 deviated - 0 n/a** across… |
| 151 | UpdateOperator | `counts[r.status]--` | hole | Measured on examples/request-triage through the real CLI: `**23 applied - 0 deviated - 13 n/a**` becomes `**-23 applied - 0 deviated - -13 n/a**`. Same recipe and same silence as the two guard mutant… |
| 152 | StringLiteral | `""` | defence-in-depth | Caught by test/smoke.js, the end-to-end leg. Measured, not reasoned: the mutant was applied to dist/lib/compliance.js and the real `runward compliance iso-42001` run on a fresh mission and on a copy … |
| 153 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 155 | StringLiteral | `""` | hole | Measured: line 4 of the draft — `> deterministically from ratified engineering artifacts (no model call, nothing scraped or run). It populates the` — becomes empty, which also splits the header block… |
| 156 | StringLiteral | `""` | hole | Measured: line 5 — `> **technical-evidence layer and its index**; the applicability, risk-acceptance, policy and management sign-off it` — becomes empty; `technical-evidence layer` occurs on exactly … |
| 157 | StringLiteral | `""` | display-only | Measured: line 6 — `> cannot invent are listed under "Required from the operator". This is **supporting evidence**, never certification —` — becomes empty. The claim survives on lines this mutant doe… |
| 158 | StringLiteral | `""` | display-only | Measured: line 7 — `> only an accredited body certifies an AI management system. Verify the current ISO/IEC 42001 text before an audit.` — becomes empty. Both halves survive elsewhere, on lines this … |
| 160 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 163 | StringLiteral | `""` | display-only | The prefix goes and the constant stays: measured, line 10 becomes `A green row proves a decision was traced to resolving, non-empty ...` instead of `> **Declared non-scope of every green row (ADR-004… |
| 164 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 165 | StringLiteral | `""` | defence-in-depth | Caught by test/smoke.js. Measured: mutant applied to dist/lib/compliance.js, real `runward compliance iso-42001` run on a fresh mission and on a copy of examples/request-triage; in both, smoke's `com… |
| 166 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 168 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 169 | StringLiteral | `""` | display-only | Measured on both missions: exactly one line changes — line 16 of the fresh draft, `\| ASI \| Risk \| Rules addressing it \|`, goes empty; the delimiter row and all ten data rows are untouched. No claim i… |
| 170 | StringLiteral | `""` | display-only | Measured on both missions: exactly one line changes — the GFM delimiter row `\|---\|---\|---\|` goes empty, and the header row and all ten data rows are untouched. This is the line that makes the block a… |
| 171 | BlockStatement | `{}` | defence-in-depth | Caught by test/smoke.js. Measured: with the loop body emptied the ten coverage rows disappear (fresh draft 60 lines -> 50; example 101 -> 91) and smoke's `/ASI0[1-9] \\|/` goes from true to false on b… |
| 172 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The mutant seeds the fallback of `inputs.asiCoverage.get(id) ?? []` with a non-empty array, so it is observable only when the Map has no entry for an id the loop visits. SENSITIVITY CONTROL — the nea… |
| 172 | LogicalOperator | `inputs.asiCoverage.get(id) && []` | hole | FALSE GAP ON EVERY ROW. `inputs.asiCoverage.get(id) && []` yields `[]` for every id — an array, empty or not, is truthy — so `slugs.length` is 0 always and every cell takes the fallback. Measured on … |
| 173 | ArrowFunction | `() => undefined` | hole | `slugs.map(() => undefined)` makes every mapped rule name disappear while the commas that separated them remain. Measured on examples/request-triage through the real CLI: ``\| ASI01 \| Agent Goal Hijac… |
| 173 | StringLiteral | `ˋˋ` | defence-in-depth | Caught by test/smoke.js. Measured: the ten coverage rows become ten empty lines and smoke's `/ASI0[1-9] \\|/` goes from true to false on a fresh mission and on a copy of examples/request-triage. Same … |
| 173 | StringLiteral | `ˋˋ` | hole | Same defect and byte-identical output to the `(s) => undefined` mutant on this line, measured on the same missions: the backtick-wrapped slug becomes an empty template, so ``\| ASI01 \| Agent Goal Hija… |
| 173 | StringLiteral | `""` | display-only | Measured on examples/request-triage: one line class changes and only the separator — the cell `` `frontier-deterministic-boundary`, `hexa-move-deterministic-out`, `security-prompt-injection` `` becom… |
| 173 | StringLiteral | `""` | hole | The fallback string is the pack's declaration that an OWASP ASI category has NO rule mapped and is therefore a gap to assess; the mutant empties it, so the cell renders blank and the gap stops being … |
| 175 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 176 | StringLiteral | `""` | display-only | Measured on both missions: exactly one line changes — `## 2. Control-implementation status (rule conformance)` goes empty. No claim moves with it: the section's lede, the line immediately below, stil… |
| 177 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 178 | StringLiteral | `ˋˋ` | hole | The mutated template is the ONLY place this document states its control-implementation counts. Measured on examples/request-triage through the real CLI: `Feeds the Statement of Applicability's implem… |
| 179 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 180 | ConditionalExpression | `true` | hole | FALSE 'NOTHING FILLED' ON A FILLED MISSION. `if (true)` always takes the empty branch, so the conformance table is replaced by the note that no manifest was found. Measured on examples/request-triage… |
| 180 | ConditionalExpression | `false` | hole | The mirror of its `-> true` twin: `if (false)` never takes the empty branch, so a mission with no conformance rows gets a table header and delimiter with no rows instead of the sentence explaining wh… |
| 180 | EqualityOperator | `inputs.conformance.length !== 0` | hole | `!==` inverts the predicate, so it is both of its siblings at once, and both directions were measured. On examples/request-triage it behaves as the `-> true` twin: 101 lines to 64, the 36-row conform… |
| 181 | StringLiteral | `""` | display-only | Only reachable on the empty branch. Verified through the real CLI (`runward init`, then `runward compliance iso-42001`): section 2 loses the sentence _No filled `Rule conformance` manifest found yet … |
| 183 | BlockStatement | `{}` | hole | Deletes the whole Statement-of-Applicability evidence table while the count sentence above it is untouched. Recipe: `cp -R examples/request-triage/runward .` then `runward compliance iso-42001` — the… |
| 184 | StringLiteral | `""` | display-only | Removes the header row of the section-2 evidence table; every data row survives with its rule, status, evidence pointer and phase intact, so no count, status, caveat or scope moves. The cost is rende… |
| 185 | StringLiteral | `""` | display-only | Same as the `\| Rule \| Status \| Evidence \| Phase \|` header sibling above: the delimiter row is table chrome, every data row survives verbatim, and the only cost is that the block stops rendering as a … |
| 187 | ConditionalExpression | `true` | hole | The Evidence column of every conformance row becomes the literal `true`. Verified on the packaged `examples/request-triage` mission: the row for `contracts-governance` keeps "applied" and its "Archit… |
| 187 | ConditionalExpression | `false` | hole | Same as the `true` sibling on this line, with `false` substituted for every evidence pointer instead. Verified on the packaged `examples/request-triage` mission. |
| 187 | LogicalOperator | `r.evidence && "—"` | hole | Inverts the evidence column: `r.evidence && "—"` returns the em dash whenever evidence EXISTS, and the empty string when it does not. Verified through the real CLI on the packaged `examples/request-t… |
| 187 | StringLiteral | `ˋˋ` | hole | Every row of the section-2 evidence table becomes an empty line, leaving the header, the delimiter and the count sentence in place: an empty Statement-of-Applicability table under `**23 applied · 0 d… |
| 187 | StringLiteral | `""` | display-only | Only distinguishable when a manifest row has an empty Evidence cell, which is a real shape (a `\| rule \| status \| \|` row parses to `evidence: ""`). The cell then renders blank instead of `—`; both rea… |
| 189 | StringLiteral | `"Stryker was here!"` | display-only | The mutant replaces a blank separator line with arbitrary text; it changes no count, status, caveat or scope, and the document's blank lines are read by nothing — not by the three unit tests that cal… |
| 190 | StringLiteral | `""` | display-only | Removes a navigational heading. The section it names is still fully self-describing: the line immediately below is `The "key design choices, alternatives, and re-evaluation triggers" an ISO 42001 aud… |
| 191 | StringLiteral | `"Stryker was here!"` | display-only | Blank separator between the section-3 heading and its lede. Same argument as the first blank-line sibling in this function. |
| 192 | StringLiteral | `ˋˋ` | hole | This is the only line in section 3 that maps the ADR journal onto ISO/IEC 42001, and the clause value it interpolates (`${cl.annexControls}` → `Annex A`) is versioned lens data under ADR-0022 rather … |
| 193 | StringLiteral | `"Stryker was here!"` | display-only | Blank separator between the section-3 lede and the ADR table. Same argument as the first blank-line sibling in this function. |
| 194 | BlockStatement | `{}` | hole | Empties the no-ADR branch, so a mission with no ratified ADR renders section 3 as a lede followed directly by section 4. Verified through the real CLI on a fresh `runward init`. Same substance as the… |
| 194 | ConditionalExpression | `true` | hole | Forces the no-ADR branch always. Verified through the real CLI on the packaged `examples/request-triage` mission, which carries three accepted ADRs: the table rows naming ADR-0001, ADR-0002 and ADR-0… |
| 194 | ConditionalExpression | `false` | hole | Forces the else branch always, so a mission with no ratified ADR gets the table chrome and no rows instead of the explicit sentence. Verified through the real CLI on a fresh `runward init` (whose `ad… |
| 194 | EqualityOperator | `inputs.adrs.length !== 0` | hole | Inverts the branch, so it is both of the two siblings at once: a mission with ratified ADRs prints _No ratified ADR found in `runward/adr/`._ and a mission with none prints a table header with no row… |
| 195 | StringLiteral | `""` | hole | Same as the block-emptying sibling on this branch, reached by blanking the string instead: on a fresh `runward init` the sentence _No ratified ADR found in `runward/adr/`._ becomes an empty line and … |
| 197 | BlockStatement | `{}` | hole | Deletes the ADR table on every mission that has ADRs. Verified through the real CLI on the packaged `examples/request-triage` mission: the three accepted ADRs and their statuses disappear and section… |
| 198 | StringLiteral | `""` | display-only | Header row of the section-3 ADR table; the rows survive with title, filename and status. Same argument as the section-2 table-chrome siblings: no count, status, caveat or scope moves, the only cost i… |
| 199 | StringLiteral | `""` | display-only | Delimiter row of the section-3 ADR table. Same argument as the section-2 table-chrome siblings. |
| 201 | ConditionalExpression | `true` | hole | The Status column of every ADR becomes the literal `true`. Verified on the packaged `examples/request-triage` mission: the three rows that read "accepted" read `true` instead, title and filename unto… |
| 201 | ConditionalExpression | `false` | hole | Same as the `true` sibling on this line, with `false` substituted for every ADR status. Verified on the packaged `examples/request-triage` mission. |
| 201 | LogicalOperator | `a.status && "—"` | hole | Inverts the status column: `a.status && "—"` yields the em dash for every ADR that HAS a status. Verified through the real CLI on the packaged `examples/request-triage` mission — all three ADRs, `acc… |
| 201 | StringLiteral | `ˋˋ` | hole | Every ADR row becomes an empty line while the header and delimiter remain: an empty design-decision journal presented as a table, on a mission that has one. Verified on the packaged `examples/request… |
| 201 | StringLiteral | `""` | display-only | Only distinguishable when an ADR carries no `**Status**:` line, a real shape (`readAdrs` keeps such a file and sets `status: ""`). The Status cell then renders blank instead of `—`; both read as no s… |
| 203 | StringLiteral | `"Stryker was here!"` | display-only | Blank separator between the ADR table and the section-4 heading. Same argument as the first blank-line sibling in this function, including the caveat that the injected line falls under the last table… |
| 204 | StringLiteral | `""` | display-only | Removes a navigational heading. The two bullets beneath it are self-labelled and carry their own clause reference (`- Threat model (feeds risk assessment 6.1.2): …`), so no count, status, caveat or s… |
| 205 | StringLiteral | `"Stryker was here!"` | display-only | Blank separator between the section-4 heading and its first bullet. Same argument as the first blank-line sibling in this function. |
| 206 | LogicalOperator | `inputs.threatModelState && "missing"` | hole | `??` guards a missing value; `&&` makes the whole expression return `"missing"` for EVERY non-empty state, so the reason a governance file is not counted is overwritten. Verified through the real CLI… |
| 206 | StringLiteral | `ˋˋ` | hole | Deletes the threat-model line outright, in both of its branches. Section 4 is titled `Risk & impact inputs (presence)` and has exactly two bullets; after the mutant it has one, and the document says … |
| 206 | StringLiteral | `""` | hole | Empties the positive status token: on a mission whose threat model is filled, the line renders `- Threat model (feeds risk assessment 6.1.2): ` with nothing after the colon. Verified through the real… |
| 206 | StringLiteral | `ˋˋ` | hole | Empties the negative branch: a mission whose threat model is missing or still a raw template renders `- Threat model (feeds risk assessment 6.1.2): ` with nothing after the colon. Verified through th… |
| 206 | StringLiteral | `""` | defence-in-depth | Unreachable from any runward command. The only producer of these inputs is `gatherComplianceInputs`, which always sets `threatModelState` from `govState`, and `govState` returns one of `missing`, `ra… |
| 207 | LogicalOperator | `inputs.evalRubricState && "missing"` | hole | Same as the threat-model `??` sibling, on the evaluation rubric. Verified through the real CLI on a fresh `runward init`: `**not counted** (raw template)` becomes `**not counted** (missing)`, so a fi… |
| 207 | StringLiteral | `ˋˋ` | hole | Deletes the evaluation-rubric line outright, in both branches. Same substance as the threat-model sibling above: section 4 is a presence section with exactly two entries and the mutant silently remov… |
| 207 | StringLiteral | `""` | hole | Empties the positive status token for the evaluation rubric: on the packaged `examples/request-triage` mission the line renders `- Evaluation rubric (feeds impact/validation analysis): ` with nothing… |
| 207 | StringLiteral | `ˋˋ` | hole | Empties the negative branch for the evaluation rubric: on a fresh `runward init` the true line `- Evaluation rubric (feeds impact/validation analysis): **not counted** (raw template)` renders with no… |
| 207 | StringLiteral | `""` | defence-in-depth | Same as the threat-model `"missing"` sibling: `evalRubricState` is always set by `gatherComplianceInputs` via `govState`, which cannot return undefined or an empty string, so the `??` fallback never … |
| 208 | StringLiteral | `"Stryker was here!"` | display-only | Blank separator between the evaluation-rubric bullet and the operator-required heading. Same argument as the first blank-line sibling in this function; here the injected line would be read as a lazy … |
| 209 | StringLiteral | `""` | hole | Removes the heading that draws the document's central line — between what runward assembled from the mission's artifacts and what only the operator can supply. Two concrete consequences, both verifie… |
| 210 | StringLiteral | `"Stryker was here!"` | display-only | Blank separator between the operator-required heading and its lede. Same argument as the first blank-line sibling in this function. |
| 211 | StringLiteral | `""` | display-only | Measured on a fresh `runward init` mission (60-line draft) and on examples/request-triage (101-line draft), applying the mutant to dist/lib/compliance.js and re-running the real CLI: exactly one line… |
| 212 | StringLiteral | `"Stryker was here!"` | display-only | REFERENCE ARGUMENT for the twelve injection-position survivors in this function (the eleven `L.push("")` twins and the `const L = []` seed). Measured on a fresh `runward init` mission and on examples… |
| 215 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 216 | StringLiteral | `ˋˋ` | hole | Measured: `runward compliance iso-42001` emits line 58 of the fresh draft as `_Regime mapping is dated engineering framing, not legal advice; ISO Annex A control counts/templates are behind the paywa… |
| 217 | StringLiteral | `"Stryker was here!"` | display-only | Same construction and same measurement as the occurrence-16 twin (the reference argument for this class): the mutant is applied to dist/lib/compliance.js and the real `runward compliance iso-42001` i… |
| 218 | StringLiteral | `""` | hole | Measured on examples/request-triage through the real CLI: the emitted draft collapses from 101 lines to 2 — the whole document becomes a single line. Every boundary between one claim and the next dis… |
| 218 | StringLiteral | `""` | display-only | Measured: the emitted file loses its final newline and nothing else — the fresh draft's last claim line is unchanged, and the file simply ends one byte earlier. No consumer branches on it: the draft … |

### renderNistAiRmf — 36 survivor(s): 13 hole · 2 equivalent · 20 display-only · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 257 | ArrayDeclaration | `["Stryker was here"]` | display-only | Seeding the accumulator prepends one line, `Stryker was here`, before the H1 and changes nothing else: the diff against the shipped render is exactly `0a1`. Every claim in the pack is byte-identical … |
| 258 | StringLiteral | `""` | defence-in-depth | Caught by the end-to-end smoke leg, not by the unit suite. test/smoke.js runs `runward compliance nist-ai-rmf` on a real mission and asserts the emitted nist-ai-rmf-readiness.md contains 'assessment-… |
| 259 | StringLiteral | `"Stryker was here!"` | display-only | SEPARATOR FAMILY, argued here once for the fourteen `L.push("")` mutants in this function (occurrences 1-14). These pushes are the document's blank lines. Replacing one with a non-empty string insert… |
| 261 | StringLiteral | `""` | hole | HEADER-CAVEAT FAMILY (this mutant and the two below it). The pack's header blockquote is where the document states what it is and what the regime is; emptying one of its lines deletes a claim a reade… |
| 262 | StringLiteral | `""` | hole | Header-caveat family — see the filing for the 'voluntary guidance' line for the recipe and the probe; same command, same before/after shape, line 5. Before: `> with no pass/fail and no certification;… |
| 263 | StringLiteral | `""` | hole | Header-caveat family — see the filing for the 'voluntary guidance' line for the recipe and the probe; same command, line 6. Before: `> while GOVERN, risk tolerance and go/no-go stay the operator's. V… |
| 265 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1 for the family argument and the probe. Occurrence 2 is the blank after the lens stamp, which closes the header blockquote. Measured with pandoc: the … |
| 271 | StringLiteral | `""` | display-only | The mutant empties only the label, leaving `L.push("" + GATE_NON_SCOPE)`, so the line is emitted as the full non-scope text with no `> ` marker, no bold 'Declared non-scope of every green row' and no… |
| 272 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 3 is the blank between the ADR-0040 non-scope paragraph and the '## 1.' heading; the injected line becomes a lazy continuation of that bl… |
| 273 | StringLiteral | `""` | display-only | The section heading is emptied; the section keeps its content and its own label. What follows the now-blank heading is 'An indicative engineering crosswalk (not NIST-endorsed): each agentic-security … |
| 274 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 4 is the blank between the '## 1.' heading and the crosswalk sentence; with it non-empty the injected line and the crosswalk sentence mer… |
| 275 | OptionalChaining | `lens.crosswalk.primary` | equivalent | EQUIVALENT, with the control. Measured: byte-identical output on all three fixtures — the diff is empty, not merely 'looks the same'. Reachability: renderNistAiRmf has exactly one caller, REGIMES['ni… |
| 275 | OptionalChaining | `lens.crosswalk.confirmAgainst` | equivalent | Same equivalence and the same control as the mutant on `lens.crosswalk?.primary` on this line, one field over: regimes/nist-ai-rmf@1.0.json defines crosswalk.confirmAgainst ('AI RMF §5'), it is the o… |
| 276 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 5 is the blank immediately before the ASI table, and it is load-bearing: measured with pandoc, the mutated document renders 2 tables inst… |
| 278 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 6 is the blank after the ASI table. Measured with pandoc: the table still renders as a table and the injected line follows it as an ordin… |
| 279 | StringLiteral | `""` | display-only | The '## 2. MEASURE / TEVV documentation' heading is emptied. The section keeps its own label in the sentence directly beneath it — 'Feeds MEASURE 2.x — documented, repeatable test methodology and res… |
| 280 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 7 is the blank between the '## 2.' heading and the 'Feeds MEASURE 2.x …' sentence; the injected line merges into that paragraph, ahead of… |
| 282 | StringLiteral | `ˋˋ` | hole | GOVERNANCE-PRESENCE FAMILY, argued here once for the six mutants on these two lines. Section 2 of this pack is its MEASURE/TEVV evidence, and it consists of exactly two statements: whether the missio… |
| 282 | StringLiteral | `""` | hole | Governance-presence family — see the filing on the whole evaluation-rubric line for the section's role, the recipe and the probe. This mutant empties the PRESENT branch, so it bites the opposite miss… |
| 282 | StringLiteral | `""` | hole | Governance-presence family — see the filing on the whole evaluation-rubric line. This mutant empties the MISSING branch. RECIPE: same as that filing — a mission with no runward/governance/evaluation-… |
| 283 | StringLiteral | `ˋˋ` | hole | Governance-presence family — see the filing on the whole evaluation-rubric line; this is the same mutation one line down, on the threat model, and the threat model matters more: it is the artefact th… |
| 283 | StringLiteral | `""` | hole | Governance-presence family — see the filings on the whole evaluation-rubric line and on its present branch; identical mutation on the threat-model line. RECIPE: a mission with a written runward/gover… |
| 283 | StringLiteral | `""` | hole | Governance-presence family — see the filings on the whole evaluation-rubric line and on its missing branch; identical mutation on the threat-model line. RECIPE: a mission with no runward/governance/t… |
| 284 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 8 is the blank between the two governance presence lines and the rule-conformance table, and it is load-bearing in the same way as occurr… |
| 286 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 9 is the blank after the conformance table; measured with pandoc, the table still renders as a table and the injected line follows it as … |
| 287 | StringLiteral | `""` | display-only | The '## 3. Design decisions (ADR journal)' heading is emptied. The ADR table below it is byte-identical and carries its own header row, `\| ADR \| Status \|`, so the block stays identified as the decisi… |
| 288 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 10 is the blank between the '## 3.' heading and the ADR table; load-bearing as at occurrences 5 and 8 — measured with pandoc, 2 tables re… |
| 290 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 11 is the blank after the ADR table; the table still renders and the injected line follows it as a paragraph. |
| 291 | StringLiteral | `""` | hole | This heading is the only in-place label on the pack's central honesty device, and emptying it inverts what the list beneath it says. RECIPE: any mission — `runward compliance nist-ai-rmf`. Before, th… |
| 292 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 12 is the blank between the 'Required from the operator' heading and the four items; a bulleted list may interrupt a paragraph in GFM, so… |
| 294 | StringLiteral | `ˋˋ` | hole | The loop body becomes an empty template literal, so the pack emits the 'Required from the operator / organization (runward cannot produce this)' heading followed by four empty lines. RECIPE: any miss… |
| 295 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 13 is the blank between the last operator-required item and the closing disclaimer; measured with pandoc, the disclaimer is absorbed into… |
| 296 | StringLiteral | `ˋˋ` | hole | The closing disclaimer becomes an empty line, deleting the pack's last caveat. RECIPE: any mission — `runward compliance nist-ai-rmf`. Before, the final line of runward/compliance/nist-ai-rmf-readine… |
| 297 | StringLiteral | `"Stryker was here!"` | display-only | Separator family — see the filing on occurrence 1. Occurrence 14 is the final push, so the document's last line becomes the injected sentence instead of a trailing blank. Nothing above it changes; th… |
| 298 | StringLiteral | `""` | hole | The join separator is emptied, so the document is emitted as ONE line. RECIPE: any mission — `runward compliance nist-ai-rmf`. Before: runward/compliance/nist-ai-rmf-readiness.md is 53 lines / 3658 b… |
| 298 | StringLiteral | `""` | display-only | The trailing `+ "\n"` is emptied. The document already ends with an empty final element, so the emitted file still terminates with exactly one newline after the closing disclaimer; what disappears is… |

### renderEuAiAct — 33 survivor(s): 10 hole · 18 display-only · 5 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 305 | ArrayDeclaration | `["Stryker was here"]` | display-only | PROBE: rendered the draft with the mutant applied and diffed against the shipped build on two fixtures (a fresh `runward init` mission and examples/request-triage/runward). The single difference is t… |
| 306 | StringLiteral | `""` | defence-in-depth | NOT a hole: another leg of the net kills it. test/smoke.js asserts on runward/compliance/eu-ai-act-readiness.md that `md.includes("assessment-readiness draft")`, and measured, that phrase occurs EXAC… |
| 307 | StringLiteral | `"Stryker was here!"` | display-only | SEPARATOR FAMILY - one argument for the fourteen `L.push("")` mutants of this function, written here and referred to by the thirteen siblings. Each replaces one blank line of runward/compliance/eu-ai… |
| 310 | OptionalChaining | `lens.highRisk.bindFrom` | defence-in-depth | `renderEuAiAct` is reachable only through `complianceCommand` with key 'eu-ai-act' (the REGIMES table in src/commands/compliance.ts), and its `lens` argument comes only from `loadRegime('eu-ai-act', … |
| 310 | OptionalChaining | `lens.highRisk.scope` | defence-in-depth | Same reachability and the same shipped-lens control as the `lens.highRisk?.bindFrom` mutant on this line; this is the `scope` half of the same interpolation (rendered: 'Chapter III, Sections 1, 2 and… |
| 311 | OptionalChaining | `lens.articles.runtimeLogging` | defence-in-depth | Same reachability and the same shipped-lens control as the `lens.highRisk?.` mutants above; this one renders `articles.runtimeLogging` = 'art. 12', the article the draft states it does NOT satisfy. P… |
| 311 | StringLiteral | `ˋˋ` | hole | HOLE. The mutant blanks the whole line, so the emitted draft loses two explicit NEGATIVE claims about what it is not: 'it does **not** satisfy art. 12 runtime logging' and 'it is not a signed declara… |
| 312 | StringLiteral | `""` | hole | HOLE, filed with its mitigation stated. The mutant removes '> Verify against the Official Journal text before filing.' from the header block quote - the framing block a filer meets first, beside '**D… |
| 314 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the header block quote and the ADR-0040 non-scope block quote. Measured on both f… |
| 318 | StringLiteral | `""` | hole | HOLE, and the most instructive one in this group. The mutant blanks only the prefix `"> **Declared non-scope of every green row (ADR-0040).** "`; `+ GATE_NON_SCOPE` still concatenates, so the reserva… |
| 319 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the ADR-0040 non-scope block quote and '## Annex IV coverage map'. Measured on bo… |
| 320 | StringLiteral | `""` | display-only | Display-only, and the only one of this function's five `##` section headings that is. The mutant blanks the heading; measured on both fixtures, the rest of the document is byte-identical, so the cove… |
| 321 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between '## Annex IV coverage map' and the table's header row. Measured on both fixtures:… |
| 322 | StringLiteral | `""` | hole | HOLE. The mutant blanks the coverage map's column header row while leaving the delimiter `\|---\|---\|---\|` and the nine data rows in place. Measured: the string 'runward supplies' occurs EXACTLY ONCE i… |
| 323 | StringLiteral | `""` | display-only | Display-only. The mutant blanks the `\|---\|---\|---\|` delimiter, which stops the coverage map rendering as a GFM table (header row and nine data rows become paragraph text). Measured on both fixtures, … |
| 324 | ArrayDeclaration | `["Stryker was here"]` | defence-in-depth | Same reachability argument as the `lens.highRisk?.` mutants: both shipped eu-ai-act lenses define `annexIv` as a nine-row array, so the `??` right operand is never evaluated and, PROBED, the rendered… |
| 326 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the last Annex IV coverage row and the '## Point 2 - design decisions' heading. M… |
| 327 | StringLiteral | `""` | hole | HOLE - SECTION-HEADING FAMILY, argument written here and referred to by the three siblings. This document has no sectioning device other than its `##` headings, so blanking one does not merely delete… |
| 328 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the '## Point 2 - design decisions' heading and the ADR table (or, on a fresh mis… |
| 330 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the ADR table and the '## Agentic-risk coverage' heading. Measured on both fixtur… |
| 331 | StringLiteral | `""` | hole | See the section-heading family argument on '## Point 2 - design decisions...'. THIS one: '## Agentic-risk coverage (OWASP ASI -> Point 2 cybersecurity / Point 5 risk)'. After the mutation (measured, … |
| 332 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the '## Agentic-risk coverage' heading and the ASI table's header row. Measured o… |
| 334 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the ASI table and the '## Control-implementation status' heading. Measured on bot… |
| 335 | StringLiteral | `""` | hole | See the section-heading family argument. THIS one: '## Control-implementation status (feeds Point 2 validation)'. After the mutation (measured on examples/request-triage, where the section carries th… |
| 336 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the '## Control-implementation status' heading and the conformance table (or, on … |
| 338 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the conformance table and the '## Required from the provider' heading. Measured o… |
| 339 | StringLiteral | `""` | hole | See the section-heading family argument; this is its strongest instance. THIS one: '## Required from the provider (runward cannot produce this)'. After the mutation (measured, both fixtures, rest byt… |
| 340 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the '## Required from the provider' heading and the first provider-required bulle… |
| 342 | StringLiteral | `ˋˋ` | hole | HOLE, the most consequential in this group. Every item of the provider-required list is emitted as an EMPTY line, so '## Required from the provider (runward cannot produce this)' is followed by three… |
| 343 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the blank line between the last provider-required bullet and the closing disclaimer. Measured on both fi… |
| 344 | StringLiteral | `ˋˋ` | hole | HOLE. The mutant blanks the closing line, so the draft loses both halves of its closing qualifier: 'Engineering framing, not legal advice' and the lens's own disclaimerTail, 'Annex IV wording moves -… |
| 345 | StringLiteral | `"Stryker was here!"` | display-only | See the separator-family argument on the first `L.push("")` (occurrence 1). THIS occurrence is the final blank line, after the closing disclaimer; the emitted document then ends with the stray line. … |
| 346 | StringLiteral | `""` | display-only | AMBIGUITY RESOLVED FIRST, because the mutant line as given does not say which of the two `"\n"` on `return L.join("\n") + "\n";` it is. MEASURED: mutating the join separator (`L.join("")`) collapses … |

### readRules — 32 survivor(s): 9 hole · 5 equivalent · 16 display-only · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 35 | StringLiteral | `""` | hole | Recipe: any mission without its own `runward/rules/` - the fallback branch the code comment names ("covers missions predating rules-in-mission"), and the shape of the SHIPPED `examples/request-triage… |
| 36 | ConditionalExpression | `false` | defence-in-depth | The guarded state is `runward/rules/` absent AND the package's own `templates/rules/` absent. `templates` ships in package.json `files`, and `rulesDir()`, `expectedRules()` and `allRules()` in confor… |
| 37 | ArrayDeclaration | `["Stryker was here"]` | defence-in-depth | Same branch and same precondition as the `!existsSync(dir) -> false` sibling above. Measured on the same forced install (packaged `templates/rules/` moved aside, mission with no rules/): the seeded a… |
| 41 | MethodExpression | `readdirSync(dir)` | hole | The emitted bytes are a function of the listing order: measured by replacing `.sort()` with `.sort().reverse()`, all three readiness drafts and the OSCAL change (`Addressed by rules: frontier-determi… |
| 42 | ConditionalExpression | `false` | hole | Recipe: leave a merge or patch leftover beside a rule. `git merge` writes `runward/rules/security-prompt-injection.md.orig`, a byte copy of the rule carrying its `asi:` frontmatter. Measured on `init… |
| 42 | StringLiteral | `""` | hole | `f.endsWith("")` is true for every name, so the guard never fires: the same mechanism and the same measured diff as the `!f.endsWith(".md") -> false` sibling. See that entry for the recipe (`security… |
| 44 | StringLiteral | `"Stryker was here!"` | equivalent | The initializer is read only when `readFileSync`/`.match` throws, and on that path `catch { continue }` leaves the loop body before any read of `fm`; on every other path it is overwritten. Measured b… |
| 46 | OptionalChaining | `readFileSync(join(dir, f), "utf8").match(FR…` | display-only | Surface: the membership of `ComplianceInputs.rules`, the array. A rule file whose bytes do not match compliance.ts's private `FRONTMATTER` makes `.match` return null, and `null[1]` throws INSIDE the … |
| 46 | StringLiteral | `"Stryker was here!"` | equivalent | Same slot as `let fm = ""`, on the non-throwing path: reached whenever `.match` returns null. Measured byte-identical on 17 missions, two of which reach it (a `README.md` in rules/, and a CRLF missio… |
| 48 | BlockStatement | `{}` | display-only | Surface: the membership of `ComplianceInputs.rules`. Falling through the catch keeps an unreadable rule file as `{slug: <filename>, title: <filename>, impact: "", asi: []}` instead of skipping it. Me… |
| 51 | MethodExpression | `fm.match(/^title:\s*(.+)$/m)?.[1] ?? f.repl…` | display-only | Surface: `RuleAsi.title`. Measured with a rule written `title: Rule WS `: the returned title keeps its trailing spaces and every emitted artifact is byte-identical. Shared with this batch: the `rules… |
| 51 | OptionalChaining | `fm.match(/^title:\s*(.+)$/m)[1]` | hole | Without the optional chaining, a rule file with no `title:` line makes `.match` return null OUTSIDE any try, so `null[1]` throws out of `gatherComplianceInputs` and the pack is never assembled. Three… |
| 51 | Regex | `/title:\s*(.+)$/m` | display-only | Surface: `RuleAsi.title`. Measured with a rule whose `nonScope:` line reads "does not prove the subtitle: rendering is correct" above the real `title:`: the unanchored pattern captures the earlier li… |
| 51 | Regex | `/^title:\s*(.+)/m` | equivalent | `.` in ECMAScript never matches a LineTerminator (`\n`, `\r`, U+2028, U+2029), so a greedy `(.+)` always ends at a line end - exactly where multiline `$` asserts. The two patterns therefore capture t… |
| 51 | Regex | `/^title:\s(.+)$/m` | display-only | Surface: `RuleAsi.title`. Requiring exactly one whitespace changes the value on `title:Rule Two` (no space, valid YAML): the match fails and the title falls back to the filename - measured. Every emi… |
| 51 | Regex | `/^title:\S*(.+)$/m` | display-only | Surface: `RuleAsi.title`. On the shipped `title: X` shape `\S*` matches nothing and the leading space is removed again by the `.trim()` on the same line, so nothing moves; a difference appears only o… |
| 51 | Regex | `/\.md/` | display-only | Surface: `RuleAsi.title`, on its FALLBACK branch only. Measured with a rule file named `rule.md.keep.md` and no `title:` field: the fallback title becomes "rule.keep.md" instead of "rule.md.keep". Ev… |
| 51 | StringLiteral | `"Stryker was here!"` | display-only | Surface: `RuleAsi.title`, fallback branch. Measured on three missions where a rule has no `title:` line: the fallback becomes e.g. "rule-twoStryker was here!". Every emitted artifact is byte-identica… |
| 52 | MethodExpression | `fm.match(/^impact:\s*(.+)$/m)?.[1] ?? ""` | display-only | Surface: `RuleAsi.impact`. Measured with `impact: HIGH `: the value keeps its trailing spaces. Every emitted artifact is byte-identical. Note the gate does not read impact from here either - `parseRu… |
| 52 | OptionalChaining | `fm.match(/^impact:\s*(.+)$/m)[1]` | hole | Without the optional chaining, a rule file with no `impact:` line makes `.match` return null outside any try and `null[1]` throws out of `gatherComplianceInputs`. Measured through the CLI: on a missi… |
| 52 | Regex | `/impact:\s*(.+)$/m` | display-only | Surface: `RuleAsi.impact`. Measured with a rule whose `nonScope:` line reads "... not that impact: LOW holds in production" above the real `impact:`: the unanchored pattern captures the earlier line … |
| 52 | Regex | `/^impact:\s*(.+)/m` | equivalent | Identical proof to the `title` sibling: `.` never matches a LineTerminator, so a greedy `(.+)` already ends where multiline `$` asserts, and the two patterns capture the same text for every input (me… |
| 52 | Regex | `/^impact:\s(.+)$/m` | display-only | Surface: `RuleAsi.impact`. Requiring exactly one whitespace loses the value on `impact:HIGH` (measured: the match fails and the field falls back to ""). Every emitted artifact is byte-identical. Shar… |
| 52 | Regex | `/^impact:\S*(.+)$/m` | display-only | Surface: `RuleAsi.impact`. Measured on `impact:HIGH`, where `\S*` eats "HIG" and the field becomes "H". On the shipped `impact: HIGH` shape the `.trim()` on the same line absorbs the difference. Ever… |
| 52 | StringLiteral | `"Stryker was here!"` | display-only | Surface: `RuleAsi.impact`, fallback branch. Measured on the three missions where a rule has no `impact:` line: the field becomes "Stryker was here!". Every emitted artifact is byte-identical. Shared … |
| 53 | Regex | `/asi:\s*\[(.*)\]/m` | hole | Recipe: indent the field by two spaces - ` asi: [ASI09]` - a routine YAML slip. The anchored pattern does not see it, and neither does `listField` in rules.ts, which is anchored the same way; the mut… |
| 53 | Regex | `/^asi:\s\[(.*)\]/m` | hole | Recipe: write `asi:[ASI03]` or `asi: [ASI03]` - both valid YAML, both read by `listField` in rules.ts, which uses `\s*`. Measured on each: the ASI03 row of the three drafts goes from `` `rule-two` ``… |
| 53 | StringLiteral | `"Stryker was here!"` | equivalent | Measured byte-identical on 17 missions, and the branch is heavily exercised: 34 of the 64 shipped rules carry no `asi:` field at all, so the fallback runs on every mission probed. It is inert because… |
| 54 | MethodExpression | `asiRaw.split(",").map(s => s.trim().toUpper…` | display-only | Surface: `RuleAsi.asi`. Measured on 8 missions: rules with no `asi:` field come out `[""]` instead of `[]`, and junk tokens (`xASI04`, `ASI055`, `ASI3`) are kept. Not one emitted byte moves. The arra… |
| 54 | Regex | `/ASI\d{2}$/` | display-only | Surface: `RuleAsi.asi`, same terminal guard as the sibling that drops the filter entirely. Dropping `^` admits a token that merely ENDS in an ASI id; measured with `asi: [ASI03, xASI04, ...]`, `"XASI… |
| 54 | Regex | `/^ASI\d{2}/` | display-only | Surface: `RuleAsi.asi`, same terminal guard. Dropping `$` admits a token that merely STARTS with an ASI id; measured with `asi: [..., ASI055, ...]`, `"ASI055"` is kept in the returned array and rejec… |
| 55 | Regex | `/\.md/` | hole | Unlike title and impact, the SLUG is rendered and is a join key: it is the text of the "Rules addressing it" column in all three drafts, of the OSCAL `description` ("Addressed by rules: ..."), and it… |

### readAdrs — 17 survivor(s): 9 hole · 3 equivalent · 3 display-only · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 84 | ArrayDeclaration | `["Stryker was here"]` | hole | Same mission as the previous entry (no `runward/adr/`). Shipped build: the three readiness drafts print `_No ratified ADR found in `runward/adr/`._` and the terminal prints `Decisions 0 ratified ADR(… |
| 92 | Regex | `/DRAFT-/i` | hole | The filter runs after isRealAdr, so `f` always begins `ADR-<digits>`; unanchored, `/DRAFT-/i` now also matches a RATIFIED ADR whose slug merely contains `draft-`. RECIPE: `runward/adr/ADR-0020-draft-… |
| 94 | StringLiteral | `"Stryker was here!"` | equivalent | SENSITIVITY CONTROL: `body` is assigned `readFileSync(join(dir, f), "utf8")` on the next line, which dominates every read of it; the only path that leaves the initializer intact is the catch, and tha… |
| 98 | BlockStatement | `{}` | defence-in-depth | The earlier branch that already refuses the input is `if (!isRealAdr(f, dir) \|\| ...) continue;` one line above. isRealAdr (src/lib/mission.ts) itself performs `statSync(abs).isFile()` and `readFileSy… |
| 101 | MethodExpression | `body.match(/^#\s+(.+)$/m)?.[1] ?? f.replace…` | display-only | SURFACE (A) — the ADR-journal cell: `title` and `status` reach exactly one place, the row `\| <title> (`<file>`) \| <status or —> \|` in the "Design decisions (ADR journal)" table of the three readiness… |
| 101 | OptionalChaining | `body.match(/^#\s+(.+)$/m)[1]` | hole | RECIPE: an ADR with no `# ` heading — `runward/adr/ADR-0013-no-heading.md` containing a single sentence over the 40-character floor isRealAdr enforces (`ADR_MIN_CHARS = 40`); a heading is never requi… |
| 101 | Regex | `/#\s+(.+)$/m` | display-only | SURFACE (A) — the ADR-journal cell: `title` and `status` reach exactly one place, the row `\| <title> (`<file>`) \| <status or —> \|` in the "Design decisions (ADR journal)" table of the three readiness… |
| 101 | Regex | `/^#\s+(.+)/m` | equivalent | SENSITIVITY CONTROL: `(.+)` is GREEDY and `.` matches neither \n nor \r, so the match already terminates exactly at the first line terminator; `$` under /m only asserts the position the greedy quanti… |
| 101 | Regex | `/^#\s(.+)$/m` | equivalent | SENSITIVITY CONTROL: both `\s+` and `\s` require at least one whitespace after `#`, so neither the existence nor the leftmost position of the match can change; the extra whitespace the mutant leaves … |
| 101 | Regex | `/\.md/` | display-only | SURFACE (A) — the ADR-journal cell: `title` and `status` reach exactly one place, the row `\| <title> (`<file>`) \| <status or —> \|` in the "Design decisions (ADR journal)" table of the three readiness… |
| 101 | StringLiteral | `"Stryker was here!"` | defence-in-depth | SURFACE (A) — the ADR-journal cell: `title` and `status` reach exactly one place, the row `\| <title> (`<file>`) \| <status or —> \|` in the "Design decisions (ADR journal)" table of the three readiness… |
| 104 | ConditionalExpression | `true` | hole | SURFACE (B) — `ratified` reaches exactly one place: src/commands/compliance.ts:84-86, the terminal line `Decisions N ratified ADR(s) · M not ratified`. It appears in no emitted document. That line is… |
| 104 | ConditionalExpression | `true` | hole | SURFACE (B) — `ratified` reaches exactly one place: src/commands/compliance.ts:84-86, the terminal line `Decisions N ratified ADR(s) · M not ratified`. It appears in no emitted document. That line is… |
| 104 | ConditionalExpression | `true` | hole | SURFACE (B) — `ratified` reaches exactly one place: src/commands/compliance.ts:84-86, the terminal line `Decisions N ratified ADR(s) · M not ratified`. It appears in no emitted document. That line is… |
| 104 | LogicalOperator | `word !== "" && !ADR_SET_ASIDE.test(word) \|\|…` | hole | SURFACE (B) — `ratified` reaches exactly one place: src/commands/compliance.ts:84-86, the terminal line `Decisions N ratified ADR(s) · M not ratified`. It appears in no emitted document. That line is… |
| 104 | LogicalOperator | `word !== "" \|\| !ADR_SET_ASIDE.test(word)` | hole | SURFACE (B) — `ratified` reaches exactly one place: src/commands/compliance.ts:84-86, the terminal line `Decisions N ratified ADR(s) · M not ratified`. It appears in no emitted document. That line is… |
| 104 | StringLiteral | `"Stryker was here!"` | hole | SURFACE (B) — `ratified` reaches exactly one place: src/commands/compliance.ts:84-86, the terminal line `Decisions N ratified ADR(s) · M not ratified`. It appears in no emitted document. That line is… |

### govState — 16 survivor(s): 11 hole · 3 equivalent · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 110 | BlockStatement | `{}` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 113 | ConditionalExpression | `true` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 113 | ConditionalExpression | `false` | equivalent | SENSITIVITY CONTROL: DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` with NO templateKey, on `governance/threat-model.md` and `governance/evaluati… |
| 113 | EqualityOperator | `st !== "untouched"` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 113 | StringLiteral | `""` | equivalent | SENSITIVITY CONTROL: artifactState's return type is `missing \| untouched \| in-progress \| filled`; it cannot return `""`, so the guard stays constant false exactly as it already is on this path (see t… |
| 114 | StringLiteral | `""` | defence-in-depth | The statement sits inside the `if (st === "untouched")` arm, and that arm is unreachable here. DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` wit… |
| 115 | ConditionalExpression | `true` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 115 | ConditionalExpression | `false` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 115 | EqualityOperator | `st === "in-progress"` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 115 | StringLiteral | `""` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 117 | ConditionalExpression | `true` | equivalent | SENSITIVITY CONTROL: DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` with NO templateKey, on `governance/threat-model.md` and `governance/evaluati… |
| 117 | ConditionalExpression | `false` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 117 | EqualityOperator | `inProgressCause(missionDir, a) !== "placeho…` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 117 | StringLiteral | `""` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 117 | StringLiteral | `""` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 117 | StringLiteral | `""` | defence-in-depth | The false arm of this ternary is unreachable on this path. DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` with NO templateKey, on `governance/thr… |

### renderOscal — 16 survivor(s): 8 hole · 2 equivalent · 6 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 369 | StringLiteral | `""` | hole | `ns` is the seed namespace of every uuid in the pack (spec section 5). The two forms differ only when missionName is falsy, and it can be: the CLI passes basename(root), findMissionRoot climbs to the… |
| 371 | StringLiteral | `""` | defence-in-depth | The `iso-42001` default fires only when lensId is falsy, and the shipped path never gets there: complianceCommand refuses an absent or unknown regime with exit 2 (src/commands/compliance.ts) before r… |
| 380 | OptionalChaining | `inputs.verdict.strict` | equivalent | `inputs.verdict?.clean === true && inputs.verdict?.strict === true`: the second operand is evaluated only when the first is true, which already requires inputs.verdict to be non-nullish, so the remov… |
| 382 | ArrayDeclaration | `["Stryker was here"]` | defence-in-depth | `?? []` evaluates its right operand only when the coverage map has no entry for the id, and gatherComplianceInputs seeds every key of ASI_LABELS with [] before filling so the map always holds exactly… |
| 394 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Even when the fallback fires the output is unchanged, which is stronger than unreachability. `["Stryker was here"].map((r) => r.rule)` yields [undefined] (a string has no `.rule`), and `prose.has(s)`… |
| 399 | ConditionalExpression | `true` | defence-in-depth | A clean --strict verdict already implies statuses.length > 0 for every category, so the conjunct cannot flip a status. Two code facts and one measurement: corpusDivergence (scaffold-lock.ts) makes an… |
| 399 | ConditionalExpression | `true` | hole | This is RWD-2026-0058 reintroduced verbatim. VERIFIED END TO END 2026-08-27, not argued: `cp -R examples/request-triage m`, rewrite the `contracts-governance` evidence cell in runward/architecture.md… |
| 399 | EqualityOperator | `statuses.length >= 0` | defence-in-depth | `statuses.length >= 0` is `true` for an array length, so this is survivor 6 written differently; the same argument settles it - see survivor 6 for the green-gate-implies-rows proof and its sensitivit… |
| 406 | StringLiteral | `""` | hole | The description is the sentence a GRC tool shows a human beside the control. Mutated, asi-07 reads `ASI07 Insecure Inter-Agent Communication. ` - the risk is named and the fact that NOTHING addresses… |
| 420 | StringLiteral | `""` | hole | This is the word the whole of RWD-2026-0045 exists to put in the pack, on the requirement rather than in a root remark. Mutated, every requirement of a GREEN mission carries `runward-gate-verdict` = … |
| 420 | StringLiteral | `""` | defence-in-depth | `presence` is only reachable with verdict.strict false, and the shipped path hardcodes the other branch: complianceCommand computes `computeVerdict(mission, { strict: true })` and sets `strict: true`… |
| 421 | StringLiteral | `""` | defence-in-depth | The `not run for this pack` arm is reached only when inputs.verdict is absent, and the CLI always assigns it before rendering (src/commands/compliance.ts:60-70) - an unasked gate cannot occur in the … |
| 426 | ConditionalExpression | `false` | hole | runward-evidence-depth is a prop an ingesting tool reads. Mutated, the `no rule mapped` arm is skipped and an unmapped category falls through to `0 rule(s) mapped, none accounted for in a manifest ye… |
| 427 | StringLiteral | `""` | hole | Same corner as survivor 13, worse outcome: the prop value becomes the empty string, which violates the OSCAL StringDatatype pattern `^\S(.*\S)?$` - probed with the vendored NIST 1.2.2 schema and ajv,… |
| 431 | StringLiteral | `""` | hole | The separator between rule slugs inside the prose caveat is the only thing making that list machine- and human-splittable. Probed on the rich mission with two prose rows on ASI09: `... (ADR-0004): ha… |
| 432 | StringLiteral | `ˋˋ` | hole | The strongest case a pack can state - the depth of the evidence behind a green row - becomes the empty string. Probed on the rich mission: all ten requirements lose `N rule(s), M manifest row(s) whos… |

### adrTableLines — 13 survivor(s): 9 hole · 4 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 245 | ConditionalExpression | `true` | hole | adrTableLines always returns `_No ratified ADR found in \`runward/adr/\`._`. On the rich mission the EU AI Act draft's "Point 2 - design decisions (ADR journal, near-verbatim to the Annex IV requirem… |
| 245 | ConditionalExpression | `false` | hole | The reverse: on a mission with no ADR the explicit `_No ratified ADR found_` statement is replaced by an empty table header. The document loses the one line telling an assessor the journal is empty r… |
| 245 | EqualityOperator | `inputs.adrs.length !== 0` | hole | The inversion of the same test - survivor 30's outcome on a mission with ADRs, survivor 31's on one without. Probed both ways. See survivors 30 and 31. |
| 246 | ArrayDeclaration | `[]` | hole | The `_No ratified ADR found in \`runward/adr/\`._` line vanishes entirely, leaving the Annex IV design-decisions heading followed by nothing on a mission with no journal. Fresh-mission recipe: see su… |
| 246 | StringLiteral | `""` | hole | Same as survivor 33 with a blank line in place of the sentence - the declared absence of a decision journal is deleted from the drafts. Fresh-mission recipe: see survivor 23. |
| 247 | ArrayDeclaration | `[]` | display-only | Header and delimiter of the ADR table removed; the three ADR rows and their statuses are untouched (probed on the rich mission). Presentation only, same surface and reasoning as survivor 27. |
| 247 | StringLiteral | `""` | display-only | The ADR table's label line alone, blanked - 1 line differs, every row intact. See survivor 27. |
| 247 | StringLiteral | `""` | display-only | The ADR table's delimiter alone, blanked - 1 line differs, labels and rows intact. See survivor 27. |
| 249 | ConditionalExpression | `true` | hole | The ADR Status column reads `true` on every row (probed on the rich mission: `\| ADR-0001: single orchestrator, sequential triage (\`ADR-0001-single-orchestrator.md\`) \| true \|`). The status of a deci… |
| 249 | ConditionalExpression | `false` | hole | Identical to survivor 39 with `false` - probed, all three rows. See survivor 39. |
| 249 | LogicalOperator | `a.status && "—"` | hole | `a.status && "-"` inverts the column: an ADR WITH a status renders the em dash that means none recorded, one without renders empty. Probed on the rich mission: three `accepted` decisions all read `-`… |
| 249 | StringLiteral | `ˋˋ` | hole | Every ADR row becomes an empty line: on the rich mission the Annex IV design-decisions section keeps its header and shows zero decisions where three are recorded - probed, the three `\| ADR-0001: sing… |
| 249 | StringLiteral | `""` | display-only | Differs only where a.status is already empty - an ADR file with no `**Status**:` line - and then swaps the em dash for an empty cell; both say the status is absent, and `ratified` is computed from ad… |

### confTableLines — 13 survivor(s): 9 hole · 4 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 237 | ConditionalExpression | `true` | hole | confTableLines always returns the empty-manifest sentence. On the rich mission the EU AI Act draft's Point 2 validation section reads `_No filled \`Rule conformance\` manifest found yet_` over a miss… |
| 237 | ConditionalExpression | `false` | hole | The reverse: on a mission with nothing filled the explicit statement is replaced by a bare table header with no rows. The caveat that says WHY the section is empty, and the gesture that closes it (`r… |
| 237 | EqualityOperator | `inputs.conformance.length !== 0` | hole | The inversion of the same test: survivor 22's outcome on a filled mission and survivor 23's on an empty one, at once. Probed both ways (48 lines differ rich, 11 fresh). See survivors 22 and 23. |
| 238 | ArrayDeclaration | `[]` | hole | The empty-manifest sentence disappears entirely: on a fresh mission the EU AI Act draft's "Control-implementation status (feeds Point 2 validation)" heading is followed by nothing at all, so a reader… |
| 238 | StringLiteral | `""` | hole | Same as survivor 25 with a blank line instead of no line - the declared gap and its remedy are still deleted from the document a regulated buyer reads. Fresh-mission recipe: see survivor 23. Probed: … |
| 239 | ArrayDeclaration | `[]` | display-only | Removes the header and delimiter rows of the control-implementation table; every row and every value survives in order (probed on the rich mission: 46 lines differ, all of them the two removed lines … |
| 239 | StringLiteral | `""` | display-only | The header label line alone, blanked. Same surface and same reasoning as survivor 27: the delimiter still stands, every row is intact, nothing keys on the labels. Probed on the rich mission: exactly … |
| 239 | StringLiteral | `""` | display-only | The delimiter row alone, blanked - the archetypal separator: 1 line differs on the rich mission, the column names and all 36 rows are untouched, and the block simply stops rendering as a table. Same … |
| 241 | ConditionalExpression | `true` | hole | The Evidence column - the pointer an auditor follows - reads `true` on every row. Probed on the rich mission: `\| \`contracts-governance\` \| applied \| file:code/src/core/ports/model-provider.port.ts#T… |
| 241 | ConditionalExpression | `false` | hole | Identical to survivor 18 with `false` in the cell - probed on the rich mission, all 36 evidence pointers replaced. See survivor 18. |
| 241 | LogicalOperator | `r.evidence && "—"` | hole | `r.evidence && "-"` inverts the cell: a row WITH a pointer renders the em dash that means "nothing recorded", and a row without one renders empty. Probed on the rich mission: all 36 pointers become `… |
| 241 | StringLiteral | `ˋˋ` | hole | Every row of the control-implementation table becomes an empty line: on the rich mission the EU AI Act draft's "Control-implementation status (feeds Point 2 validation)" section keeps its header and … |
| 241 | StringLiteral | `""` | display-only | Differs only where r.evidence is already empty, and then it swaps the em-dash placeholder for an empty table cell - both say "nothing recorded". Reachable but inert: probed on a mission whose floor.m… |

### asiTableLines — 11 survivor(s): 7 hole · 3 display-only · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 222 | ArrayDeclaration | `[]` | display-only | Header and delimiter of the agentic-risk coverage table removed; all ten ASI rows and their rule lists survive verbatim (probed on all three missions). Presentation only, same surface and reasoning a… |
| 222 | StringLiteral | `""` | display-only | The ASI table's label line alone, blanked - exactly 1 line differs on every mission probed. See survivor 27. |
| 222 | StringLiteral | `""` | display-only | The ASI table's delimiter alone, blanked - 1 line differs, labels and all ten rows intact. See survivor 27. |
| 223 | BlockStatement | `{}` | hole | The loop body is emptied, so the agentic-risk coverage table has NO rows: the EU AI Act draft's "Agentic-risk coverage (OWASP ASI -> Point 2 cybersecurity / Point 5 risk)" section and the NIST crossw… |
| 224 | ArrayDeclaration | `["Stryker was here"]` | defence-in-depth | Same fallback as survivor 4, one function over: unreachable because gatherComplianceInputs seeds every ASI_LABELS key before filling, so `get(id)` is never nullish. Probed byte-identical on all three… |
| 224 | LogicalOperator | `inputs.asiCoverage.get(id) && []` | hole | `inputs.asiCoverage.get(id) && []` always yields `[]`, because the map's values are arrays and an array is truthy even when empty. Probed on all three missions: every one of the ten rows reads `\| ASI… |
| 225 | ArrowFunction | `() => undefined` | hole | The slug renderer returns undefined, so the "Rules addressing it" column collapses to bare separators: probed on the rich mission, `\| ASI02 \| Tool Misuse & Exploitation \| \`checklist-pre-production-s… |
| 225 | StringLiteral | `ˋˋ` | hole | Every ASI row becomes an empty line - the same outcome as survivor 46 reached through the row template rather than the loop: header and delimiter stand, all ten rows blank, and the coverage claim plu… |
| 225 | StringLiteral | `ˋˋ` | hole | Each slug renders as the empty string, leaving the same comma skeleton as survivor 50 (probed: ASI05's single-rule cell becomes blank, ASI02's becomes `, , , , , , `). The rule names an assessor woul… |
| 225 | StringLiteral | `""` | hole | The rule slugs are concatenated without a separator: probed on the rich mission, ASI01 reads `\`frontier-deterministic-boundary\`\`hexa-move-deterministic-out\`\`security-prompt-injection\`` - one ru… |
| 225 | StringLiteral | `""` | hole | The gap marker becomes an empty cell: `\| ASI07 \| Insecure Inter-Agent Communication \| **no rule mapped - gap to assess** \|` becomes `\| ASI07 \| Insecure Inter-Agent Communication \| \|`. This is the doc… |

### gatherComplianceInputs — 6 survivor(s): 4 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 126 | ConditionalExpression | `true` | hole | The `has` is a live guard, not a redundant one: readRules accepts any token matching `/^ASI\d{2}$/` from a rule's `asi:` front matter, while asiCoverage is seeded only with the ten keys of ASI_LABELS… |
| 137 | ConditionalExpression | `true` | hole | This is RWD-2026-0061 reinstated, in the same words the defect register uses. RECIPE: `runward init --yes` and touch nothing, then `runward compliance iso-42001`. Shipped build: ISO §4 `- Threat mode… |
| 137 | StringLiteral | `""` | equivalent | SENSITIVITY CONTROL: this object literal is built at the call site, handed to artifactState, and discarded. artifactState and inProgressCause (src/lib/mission.ts) read `relPath` and `templateKey` and… |
| 138 | ConditionalExpression | `false` | hole | RECIPE: the packaged `examples/request-triage` mission, whose `runward/governance/evaluation-rubric.md` is genuinely written; `runward compliance iso-42001`. Shipped build: ISO §4 `- Evaluation rubri… |
| 138 | StringLiteral | `""` | equivalent | Identical control to the sibling `label` mutant on the threat-model literal: the object never escapes the call, and artifactState/inProgressCause read `relPath` and `templateKey` only. Mutating `relP… |
| 138 | StringLiteral | `""` | hole | artifactState's return type is `missing \| untouched \| in-progress \| filled` — never `""` — so the comparison is constant false and the mutant is behaviourally identical to `evalRubric -> false`, with… |

### readConformance — 5 survivor(s): 2 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 64 | ConditionalExpression | `false` | equivalent | Removing the guard means `readFileSync` is called on paths that are not there; it throws ENOENT and the `catch { continue }` two lines below runs the same `continue`. Measured byte-identical on 17 mi… |
| 66 | StringLiteral | `"Stryker was here!"` | equivalent | `body` is declared INSIDE the per-deliverable loop and read only after the `try`; on the only path where the initializer survives, `catch { continue }` has already left the iteration. Measured byte-i… |
| 70 | BlockStatement | `{}` | equivalent | Unlike its sibling in `readRules`, falling through here changes nothing: `body` is re-initialised to `""` at the top of every iteration and `parseManifest("")` finds no `Rule conformance` heading, so… |
| 74 | Regex | `/\[.*\]$/` | hole | Unanchored, the placeholder test drops any manifest row whose rule cell merely ENDS in `]`. Recipe: a rule file named `rule-two [draft].md` - legal on every filesystem runward supports - with the mat… |
| 74 | Regex | `/^\[.*\]/` | hole | The mirror of the sibling above: dropping `$` drops any row whose rule cell merely STARTS with `[`. Recipe: a rule file named `[wip] rule-three.md` with the row `\| [wip] rule-three \| n/a \| no queue i… |

### confCounts — 4 survivor(s): 3 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 232 | ConditionalExpression | `true` | equivalent | The mutated branch is genuinely taken, and I measured it being taken: on a mission carrying a row with status `todo` (which `parseManifest` keeps and the guard normally skips) the output is still byt… |
| 232 | ConditionalExpression | `false` | hole | Measured on 17 missions. On the shipped reference mission the NIST AI RMF draft's MEASURE/TEVV line goes from "From your mission: **23 applied - 0 deviated - 13 n/a** across 36 rule(s)" to "**0 appli… |
| 232 | EqualityOperator | `c[r.status] === undefined` | hole | The complement of the same guard: only statuses that are NOT among the three are counted, so `applied`, `deviated` and `n/a` never increment. Measured on 17 missions, with the identical rendered resu… |
| 233 | UpdateOperator | `c[r.status]--` | hole | Measured on 17 missions: the NIST AI RMF draft's MEASURE/TEVV line reads "**-23 applied - 0 deviated - -13 n/a** across 36 rule(s)" on the shipped reference mission. Negative counts read as absurd to… |

### (top level) — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 30 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | The successor of the pre-fix anchor survivor, re-probed on the CRLF-aware line rather than ported: the verdict for the old key was retired when RWD-2026-0083's fix changed this line's text, and ADR-0… |

### detUuid — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 352 | MethodExpression | `createHash("sha256").update(ˋrunward-oscal:…` | equivalent | Probed rather than argued, as instructed: the pack is byte-identical for every mission name tried ("demo-mission", "", "a", a 200-char name, a non-ASCII name). The reason is arithmetic - every read o… |

## Module: evidence

Survivors: 268

Holes: 164 · Equivalent: 69 · Display-only: 26 · Defence-in-depth: 9

### evidenceReport — 71 survivor(s): 51 hole · 4 equivalent · 15 display-only · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 737 | Regex | `/\[.*\]$/` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→54 — the `probe[end]` row is silently skipped as a template placeholder and its unresolvab… |
| 737 | Regex | `/^\[.*\]/` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→54 — the `[start]probe` row is skipped. Minimal mission `bracket-start` (corpus rule file … |
| 742 | BlockStatement | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: text only (the row falls through to the adr branch and `adrDecision("ADR-undefined")` answers "no matching ADR… |
| 742 | ConditionalExpression | `false` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: text only (the row falls through to the adr branch and `adrDecision("ADR-undefined")` answers "no matching ADR… |
| 743 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-malformed… |
| 743 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` string of the `probe-malformed` entry becomes "". Re-run on m… |
| 747 | StringLiteral | `ˋˋ` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→57. Both rows that cite `adr:0001` gain `typed pointer adr:0001 — ADR-0000-template.md is … |
| 752 | ObjectLiteral | `{}` | equivalent | The value is consumed on exactly three paths in the function body: `const abs = r.abs`, `"why" in r`, and (inside the outside-branch only) `"at" in r && r.at`. `{ abs: null }` and `{}` agree on all t… |
| 758 | ConditionalExpression | `false` | hole | wrong reason: reports plain resolution failure for a pointer that resolves to a real file outside the audited project — assert: a pointer that resolved to a real file outside the audited project must… |
| 758 | ConditionalExpression | `true` | hole | wrong reason: reports containment (outside the project) for four pointers that simply do not exist and for one absolute path; 5 rows misdiagnosed — assert: a pointer to a file that does not exist mus… |
| 758 | ConditionalExpression | `true` | hole | wrong reason: reports containment for three pointers that do not exist and for one absolute path; 4 rows misdiagnosed — assert: a pointer to a file that does not exist must name resolution failure, a… |
| 758 | EqualityOperator | `r.why !== "outside"` | hole | wrong reason: inverts the containment test: the one pointer that IS outside is reported as plain resolution failure, and four that are not are reported as containment violations — assert: the contain… |
| 758 | LogicalOperator | `"why" in r \|\| r.why === "outside"` | hole | wrong reason: reports containment for three pointers that do not exist and for one absolute path (the empty-path pointer escapes: its result object carries no `why` key); 4 rows misdiagnosed — assert… |
| 758 | StringLiteral | `""` | hole | wrong reason: reports plain resolution failure for a pointer that resolves outside the audited project: the containment comparison can never match — assert: a pointer that resolved to a real file out… |
| 758 | StringLiteral | `""` | hole | wrong reason: reports plain resolution failure for a pointer that resolves outside the audited project — assert: a pointer that resolved to a real file outside the audited project must name containme… |
| 759 | ConditionalExpression | `false` | hole | wrong reason: names the containment class correctly but states the offending location as the literal `false` instead of the resolved path (borderline: same reading as mutant 17) — assert: when a cont… |
| 759 | ConditionalExpression | `true` | hole | wrong reason: names the containment class correctly but states the offending location as the literal `true` instead of the resolved path (borderline: the failure CLASS holds, the located fact does no… |
| 759 | ConditionalExpression | `false` | hole | wrong reason: silently degrades a known offending location to the generic fallback `a path` (borderline: same reading as mutant 19) — assert: when a containment failure carries a resolved location, t… |
| 759 | LogicalOperator | `"at" in r && r.at && "a path"` | hole | wrong reason: silently degrades a KNOWN offending location to the generic fallback `a path`, so a containment refusal the gate can locate reads as one it cannot (borderline: the class holds, the loca… |
| 759 | LogicalOperator | `"at" in r \|\| r.at` | hole | wrong reason: names the containment class correctly but states the offending location as the literal `true` (borderline: same reading as mutant 17) — assert: when a containment failure carries a reso… |
| 759 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` of the `probe-outside` entry becomes `typed pointer does not … |
| 759 | StringLiteral | `""` | hole | wrong reason: silently degrades a known offending location to the generic fallback `a path` (borderline: same reading as mutant 19) — assert: when a containment failure carries a resolved location, t… |
| 759 | StringLiteral | `""` | equivalent | The `\|\| "a path"` fallback is selected only when `("at" in r && r.at)` is falsy, and that arm of the ternary is entered only when `r.why === "outside"`. `resolvePointer` builds that object as `{ abs:… |
| 760 | ConditionalExpression | `false` | hole | wrong reason: reports plain resolution failure for a pointer the gate refused because it is an absolute path — assert: a pointer refused for being absolute must name the absolute-path refusal, never … |
| 760 | ConditionalExpression | `true` | hole | wrong reason: reports the absolute-path refusal for four relative pointers that simply do not exist — assert: a relative pointer to a missing file must name resolution failure, never the absolute-pat… |
| 760 | ConditionalExpression | `true` | hole | wrong reason: reports the absolute-path refusal for three relative pointers that do not exist — assert: a relative pointer to a missing file must name resolution failure, never the absolute-path refu… |
| 760 | EqualityOperator | `r.why !== "absolute"` | hole | wrong reason: inverts the absolute-path test: the absolute pointer is reported as plain resolution failure and three relative missing pointers are reported as absolute paths — assert: the absolute-pa… |
| 760 | LogicalOperator | `"why" in r \|\| r.why === "absolute"` | hole | wrong reason: reports the absolute-path refusal for three relative pointers that do not exist — assert: a relative pointer to a missing file must name resolution failure, never the absolute-path refu… |
| 760 | StringLiteral | `""` | hole | wrong reason: reports plain resolution failure for an absolute pointer: the absolute comparison can never match — assert: a pointer refused for being absolute must name the absolute-path refusal, nev… |
| 760 | StringLiteral | `""` | hole | wrong reason: reports plain resolution failure for an absolute pointer — assert: a pointer refused for being absolute must name the absolute-path refusal, never the generic 'update it or remove the r… |
| 761 | StringLiteral | `""` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope, `rule` and exit code unchanged; the `probe-absolute` message truncates to `typed pointer does no… |
| 762 | StringLiteral | `""` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope, `rule` and exit code unchanged; four rows (probe-nopath, probe-unresolved, probe[end], [start]pr… |
| 778 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-dir` beco… |
| 778 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` string of the `probe-dir` entry becomes "". Re-run on minimal… |
| 784 | BlockStatement | `{}` | hole | FALSE GREEN, measured end to end. m-unchk, where the UNCHECKABLE report is the mission's only violation: exit 1 -> 0, verdict gaps -> clean, conformance 1 -> 0. Downstream on a copy of the mission: p… |
| 784 | ConditionalExpression | `false` | hole | OBSERVABLE, measured on two missions. m-unchk (the UNCHECKABLE branch is the mission's ONLY violation): exit 1 in both runs, conformance 1 in both, but the entry's problem changes — pristine 'the gat… |
| 784 | StringLiteral | `""` | hole | Same observable as the ConditionalExpression on the same line and by the same mechanism: '' in r is false for every object the resolver returns, so the guard is dead and the UNCHECKABLE case falls in… |
| 785 | ObjectLiteral | `{}` | hole | NOT display-only: machine fields are lost, not prose. m-unchk: exit 1 -> 1 and conformance 1 -> 1, so the exit code sees nothing, but the conformance entry goes from {scope:Floor, rule:hexa-architect… |
| 785 | StringLiteral | `ˋˋ` | display-only | Payload comparison on m-unchk: exit 1 in both runs; ONE line of the 163-line check --strict --json payload differs — line 116, the problem string becomes ''. verdict (gaps), exitCode, gaps {deliverab… |
| 787 | BlockStatement | `{}` | hole | KILLED LOCALLY, SURVIVES ON THE RUNNER, and both halves are measured. Locally the unit net fails 8 tests, each reporting that the gate said nothing where pristine says one problem. Through the gate o… |
| 787 | ConditionalExpression | `false` | hole | FALSE GREEN on both missions. The else-if condition is defeated, the spelling violation is never pushed, and the pointer falls through to the content/symbol checks, which pass. Mission A: exit 1 -> 0… |
| 787 | StringLiteral | `""` | hole | Same false green by short-circuit: '' in r is false for every object resolvePointer returns, so the condition is dead. Every capture is BYTE-IDENTICAL to the ConditionalExpression->false mutant, whic… |
| 790 | ObjectLiteral | `{}` | hole | The violation is still pushed and the exit code still 1 — precisely why the exit code cannot be the instrument — but the object is empty, so rule and problem become undefined and the machine surface … |
| 791 | StringLiteral | `ˋˋ` | display-only | Only the prose of the prescribe-a-path form is emptied. Mission A whole-payload diff of --json: ONE line changes, the problem string becomes ''. Everything else identical: exit 1, gaps, conformance 1… |
| 792 | StringLiteral | `ˋˋ` | display-only | Only the prose of the no-remedy form is emptied. Mission B whole-payload diff of --json: ONE line changes, the problem string becomes '' (4934 -> 4598 B). Exit 1 in both, gaps, conformance 1, one ent… |
| 799 | BlockStatement | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→53 (both the typed and the path-token diagnosis of the mode-000 file vanish). Minimal miss… |
| 803 | LogicalOperator | `e.code && "unknown"` | hole | wrong reason: claims the gate does not know why the evidence file could not be read when it does: a permission refusal (EACCES) is reported as an unknown cause (borderline: the top-level class 'canno… |
| 803 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-unreadabl… |
| 803 | StringLiteral | `""` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1 and the same probe on probe mission 2: byte-identical payload; minimal mission `unreadable-typed`: exit 1 / 1 g… |
| 803 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` string of the `probe-unreadable` entry becomes "". Re-run on … |
| 811 | ConditionalExpression | `true` | equivalent | The guard is redundant against its own right-hand operand. `p.line` is either `undefined` or the result of `Number()` on a `\d+` capture, i.e. a number. When it is a number the guard was already true… |
| 811 | StringLiteral | `""` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→54 — with `split("")` the length compared is the CHARACTER count, not the line count, so a… |
| 817 | EqualityOperator | `p.symbol.trim().length <= 2` | defence-in-depth | Survives the unit suite. Caught by the self-gate leg of the whole-net pass of 2026-08-20: running runward's own gate on its own mission changes verdict under this mutant. Not a hole — something does … |
| 817 | MethodExpression | `p.symbol` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→54 — dropping `.trim()` makes the symbol `" a "` three characters long, so the "names noth… |
| 820 | MethodExpression | `p.testName` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→54 — same shape on the test name. Minimal mission `blank-testname` (one row `test:code/tes… |
| 833 | ConditionalExpression | `true` | equivalent | adjudicated is a Set<string> written only here (adjudicated.add(abs)) and read only at the bare-path loop (adjudicated.has(abs)); it is never iterated, sized or serialised. With the guard defeated th… |
| 884 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-testname-… |
| 884 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` string of the `probe-testname-missing` entry becomes "". Re-r… |
| 895 | StringLiteral | `""` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1 and the same probe on probe mission 2: identical (a Buffer coerces to the same utf8 string at both consumers, i… |
| 897 | BlockStatement | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→53 (both unreadable-file rows lose their diagnosis). Minimal mission `unreadable-prose` (o… |
| 898 | LogicalOperator | `e.code && "unknown"` | hole | wrong reason: the same substitution on the path-token read: EACCES reported as an unknown cause on both unreadable rows (borderline: same reading as mutant 38) — assert: when readFileSync reports an … |
| 898 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-unreadabl… |
| 898 | StringLiteral | `""` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1 and the same probe on probe mission 2: byte-identical payload; minimal mission `unreadable-prose`: exit 1 / 1 g… |
| 898 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` string of the `probe-unreadable and probe-pathtoken-unreadabl… |
| 902 | Regex | `/\s/` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→56 — `code/src/extra.md`, whose content is the twelve characters `nowhitespace` and no whi… |
| 910 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-sig-unsaf… |
| 910 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `probe-sig-unsafe` `problem` becomes "" — the operator is told a rule i… |
| 915 | StringLiteral | `""` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→56 — `probe-sig-case` gains `evidence does not match the rule's signature /ZEBRAWORD/i` be… |
| 961 | Regex | `/\.(md\|markdown\|txt\|rst\|adoc\|asciidoc)/i` | hole | Dropping the $ makes the extension test match anywhere in the ABSOLUTE path, so a real test file is refused because some earlier component or infix contains .md, .txt, .rst, .adoc. Executed (original… |
| 962 | StringLiteral | `""` | display-only | abs.split(".") -> abs.split("") changes only the token interpolated into the violation TEXT: the path is split per character, so …/framing.md yields d and the message reads "a d document is not a tes… |
| 1040 | MethodExpression | `[...resolvedFiles.keys()].every(a => re.tes…` | hole | some -> every turns "at least one cited file carries the rule shape" into "every cited file does", i.e. a false RED on the ordinary shape of a cell that cites a code file and its test. Executed on a … |

### unsafeSignature — 32 survivor(s): 17 hole · 15 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 209 | Regex | `/\[(?:\\.\|[\]\\])*\]/g` | hole | Battery mission: three changes at once. `p01 :: unsafe signature regex … /([)a]+)+/` DISAPPEARS (false negative — a nested-quantifier regex accepted); `p04 :: unsafe signature regex … /(([}]))+/` APP… |
| 209 | Regex | `/\[(?:\\.\|[^\]\\])\]/g` | hole | Battery mission (`check --strict --json`, exit 1, 27 conformance entries at baseline): the entry `p01 :: unsafe signature regex … /([)a]+)+/` DISAPPEARS — the screen accepts a nested-quantifier regex… |
| 209 | StringLiteral | `""` | hole | Battery mission: `p06 :: evidence does not match the rule's signature /(\|)[]+/i — the pointed content lacks the rule's shape (cited, not applied?)` is replaced by `p06 :: unsafe signature regex (nest… |
| 215 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?[^()][+*}][^()]*\)…` | hole | THE SERIOUS ONE. Battery mission: three refusals DISAPPEAR outright — `p02 /(a{2,})+/`, `p03 /(a{2})+/`, `p28 /((a){2,})+/` — so the screen hands a group whose body carries a brace quantifier straigh… |
| 215 | Regex | `/\((?:\?[:=!]\|\?<[^>]>)?[^()]*[+*}][^()]*\)…` | hole | Battery mission: `p08 :: unsafe signature regex … /(?<a)>a+)+/` is replaced by `p08 :: invalid signature regex in the rule file: /(?<a)>a+)+/`. The gate still refuses; it refuses for a different, and… |
| 215 | Regex | `/\((?:\?[:=!]\|\?<[>]*>)?[^()]*[+*}][^()]*\)…` | hole | Battery mission: three entries move from `unsafe signature regex` to `invalid signature regex in the rule file` — `p08 /(?<a)>a+)+/`, `p09 /(?<)>a+)+/`, `p16 /(?<)>[^()]+)+/`. Teeth mission: identica… |
| 215 | Regex | `/\((?:\?[^:=!]\|\?<[^>]*>)?[^()]*[+*}][^()]*…` | hole | Battery mission: `p07 :: invalid signature regex in the rule file: /(?)+)+/ — fix runward/rules/p07.md` is replaced by `p07 :: unsafe signature regex (nested or overlapping-alternation quantifiers ri… |
| 217 | Regex | `/\((?:\?[:=!]\|\?<[^>]>)?[^()]*\\|[^()]*\)[+*…` | hole | Battery mission: `p11 :: unsafe signature regex … /(?<a)>\|)+/` is replaced by `p11 :: invalid signature regex in the rule file: /(?<a)>\|)+/`. Teeth mission: identical. |
| 217 | Regex | `/\((?:\?[:=!]\|\?<[>]*>)?[^()]*\\|[^()]*\)[+*…` | hole | Battery mission: two entries move from `unsafe signature regex` to `invalid signature regex in the rule file` — `p11 /(?<a)>\|)+/` and `p12 /(?<)>\|)+/`. Teeth mission: identical. |
| 217 | Regex | `/\((?:\?[^:=!]\|\?<[^>]*>)?[^()]*\\|[^()]*\)[…` | hole | Battery mission: `p10 :: invalid signature regex in the rule file: /(?)\|)+/` is replaced by `p10 :: unsafe signature regex (nested or overlapping-alternation quantifiers risk catastrophic backtrackin… |
| 220 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?[^()]*[+*}][()]*\)…` | hole | The mutated NESTED scan matches only when the body quantifier sits immediately before the ), so it still catches (a+)+, (a*b*)* and every reduced (G+)+ — but it stops catching a group whose quantifie… |
| 230 | StringLiteral | `"Stryker was here!"` | equivalent | The mutation substitutes the literal `Stryker was here!` for an empty string inside the collapse replacement, so the string the loop builds does change. What cannot change is any predicate applied to… |
| 230 | StringLiteral | `"Stryker was here!"` | equivalent | The mutation substitutes the literal `Stryker was here!` for an empty string inside the collapse replacement, so the string the loop builds does change. What cannot change is any predicate applied to… |
| 231 | ConditionalExpression | `false` | equivalent | `if (next === t) break` is the loop's fixpoint test, and the mutation only removes the early exit; the loop stays bounded by `i < 20`, so it cannot run forever. Take the iteration where the guard hol… |
| 250 | ArrayDeclaration | `["Stryker was here"]` | equivalent | \|\| [] is evaluated only when norm.match(/\(/g) is null, i.e. when norm holds no ( at all — and opens is used for nothing but the loop bound. With no ( in t, the reduction regex (which requires a lite… |
| 254 | ConditionalExpression | `false` | hole | Deletes the declared refusal at 64 groups ("Past this, refuse rather than reduce"). Differential run over 56 054 inputs: 12 valid-regex inputs separate them, every one a flat 65-70-group pattern such… |
| 254 | EqualityOperator | `opens >= 64` | hole | An off-by-one on a threshold whose safe side no test pins. The two answers differ only at exactly 64 opening groups. Differential run over 56 054 inputs: 2 valid-regex inputs separate them — (?:a) x6… |
| 255 | BooleanLiteral | `false` | hole | This is RWD-2026-0051 put back, and it is the worst of the three on this line: return false fires BEFORE the reduction loop, so a pattern with more than 64 opening groups is approved without ever bei… |
| 256 | EqualityOperator | `i < opens` | equivalent | The loop never exits by exhausting its counter, so removing one iteration removes nothing. Every pass that changes t deletes at least one ( (the replacement G[+][q] contains no parenthesis), and t st… |
| 256 | UpdateOperator | `i--` | equivalent | Same fact from the other side: with i-- the condition i <= opens is always true, so the mutant is an unbounded loop — and it terminates anyway, because the loop always leaves through break (fixpoint)… |
| 257 | Regex | `/\((?:\?[^:=!]\|\?<[^>]*>)?([^()]*)\)([+*?]\|…` | equivalent | The prefix alternation is a parsing convenience, not a decision: whatever it does not consume is consumed by ([^()]*) in the same span, so the match always covers the same characters and the only obs… |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]>)?([^()]*)\)([+*?]\|\{…` | equivalent | Same mechanism as the sibling: the named-group alternative now matches only a one-character name, so (?<name>a+) folds ?<name> into body instead of skipping it. A group name is [A-Za-z0-9_$] and can … |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[>]*>)?([^()]*)\)([+*?]\|\{…` | equivalent | Same argument as the two siblings: the named-group alternative can no longer match a real name, so the whole ?<name> span is folded into body, where it cannot change /[+*}]/ because a group name carr… |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?([^()]*)\)([^+*?]\|…` | equivalent | The trailing quantifier is re-emitted verbatim (G${mark}${q ?? ""}), so CAPTURING it and LEAVING it in the text produce a character-identical result: the reduction builds the same string either way. … |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?([^()]*)\)([+*?]\|\…` | equivalent | The trailing quantifier is re-emitted verbatim (G${mark}${q ?? ""}), so CAPTURING it and LEAVING it in the text produce a character-identical result: the reduction builds the same string either way. … |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?([^()]*)\)([+*?]\|\…` | equivalent | The trailing quantifier is re-emitted verbatim (G${mark}${q ?? ""}), so CAPTURING it and LEAVING it in the text produce a character-identical result: the reduction builds the same string either way. … |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?([^()]*)\)([+*?]\|\…` | equivalent | The trailing quantifier is re-emitted verbatim (G${mark}${q ?? ""}), so CAPTURING it and LEAVING it in the text produce a character-identical result: the reduction builds the same string either way. … |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?([^()]*)\)([+*?]\|\…` | equivalent | The trailing quantifier is re-emitted verbatim (G${mark}${q ?? ""}), so CAPTURING it and LEAVING it in the text produce a character-identical result: the reduction builds the same string either way. … |
| 257 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?([^()]*)\)([+*?]\|\…` | equivalent | The trailing quantifier is re-emitted verbatim (G${mark}${q ?? ""}), so CAPTURING it and LEAVING it in the text produce a character-identical result: the reduction builds the same string either way. … |
| 272 | BlockStatement | `{}` | hole | Emptying the block is the same defect as defeating its condition, by the other route: the no-opinion refusal disappears and every pattern the reduction could not resolve falls through to return false… |
| 272 | ConditionalExpression | `false` | hole | This deletes the property the 2026-08-26 rework was built to establish: an exhausted screen REFUSES rather than approves. After the reduction reaches its fixpoint, a leftover parenthesis means the fu… |
| 279 | BooleanLiteral | `false` | hole | Third route into the same gap: the block still runs, the compile probe still runs, and then the refusal answers false. Behaviourally identical to defeating the condition — same 813 valid-regex separa… |

### collectSealableEvidence — 25 survivor(s): 17 hole · 8 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 978 | StringLiteral | `"Stryker was here!"` | equivalent | `files` is a Map used as an ORDERED SET: the mutated literal is the placeholder VALUE passed to `files.set(key, ...)`, and the map is read exactly once, as `[...files.keys()]`. Every value that leave… |
| 987 | StringLiteral | `"Stryker was here!"` | equivalent | Same construction, same argument: the literal is the placeholder value of a Map whose only read is `[...files.keys()]`, and every emitted hash is recomputed by `out[rel] = sha256(join(root, rel))`. T… |
| 989 | MethodExpression | `[...files.keys()]` | hole | Battery: observable on 2 (freeze:f-plain, freeze:f-bracket), and on nothing else — notably NOT on the three `--attest` runs, because missionStateDigest re-sorts the keys before hashing. Close-up (too… |
| 1082 | Regex | `/\[.*\]$/` | hole | Skips TEMPLATE PLACEHOLDER rows. Without `^` it also skips any row whose rule column merely ENDS in `]`, and a skipped row contributes neither its adr: target nor its applied evidence to the frozen s… |
| 1082 | Regex | `/^\[.*\]/` | hole | Same defect, other anchor: without `$` the filter skips any row whose rule column merely BEGINS with `[` and contains `]`. Measured: `\| [legacy] queue \| applied \| file:code/guard.ts#guardFields \|` — … |
| 1089 | ConditionalExpression | `false` | hole | Every pointer enters the ADR branch, so a file:/test: pointer (adrId undefined) is looked up as adrFilename(missionDir, "ADR-undefined"). That returns null against an ordinary adr/ directory — which … |
| 1089 | ConditionalExpression | `false` | equivalent | adrId is assigned at exactly ONE site — the kind === "adr" branch of parseEvidencePointers — so !p.adrId alone already excludes every file:/test: pointer, and the removed disjunct decides nothing. SE… |
| 1089 | LogicalOperator | `p.kind !== "adr" && !p.adrId` | hole | The && narrows the skip to non-adr pointers with no adrId, so a MALFORMED adr pointer (adr:ADR-9999, adrId undefined, deliberately kept as a failing pointer) falls through to adrFilename(missionDir, … |
| 1091 | StringLiteral | `ˋˋ` | hole | adrFilename(missionDir, "") matches the FIRST entry of runward/adr/ — startsWith("") is always true and index 0 of a filename is not a digit — so the seal freezes an arbitrary ADR instead of the cite… |
| 1092 | ConditionalExpression | `false` | hole | f is null exactly when the cited ADR does not exist, and join(missionDir, "adr", null) throws. Reachable on a GREEN mission because the ADR is verified only on applied rows (evidenceReport) and devia… |
| 1095 | ConditionalExpression | `true` | hole | Freezes an adr/ entry that is not a regular file. Reachable green by the same n/a route: an ADR kept as a DIRECTORY is refused as a decision for applied/deviated rows, unchecked inside an n/a reason,… |
| 1096 | StringLiteral | `"Stryker was here!"` | equivalent | files is a Map used as an ORDERED SET: the returned record is built as out[rel] = sha256(join(root, rel)) over files.keys(), so no value written by any files.set is ever read. Measured identical to t… |
| 1116 | BlockStatement | `{}` | hole | Deletes RWD-2026-0070 fix outright. Measured end to end on examples/request-triage: create code/evidence-alias.ts -> src/core/domain/guard.ts, cite it as file:code/evidence-alias.ts#parseDeadline, fr… |
| 1117 | StringLiteral | `""` | hole | t.split("")[0] is the first CHARACTER of the token, so literal becomes <base>/c for code/evidence-alias.ts; lstat throws ENOENT, the loop continues, and the cited link is never sealed. Measured: on t… |
| 1117 | StringLiteral | `""` | hole | Identical mechanics to the "#" mutant: t.split("#")[0].split("")[0] is the first character of the pre-# part, literal is <base>/c, lstat throws and the cited link is never sealed. Measured: alias.ts … |
| 1118 | ConditionalExpression | `true` | hole | if (true) continue makes the loop body dead, so the cited symlink own path is never sealed — RWD-2026-0070 re-opened, by the shortest route. Measured: symlink fixture, shipped {alias.ts, code/guard.t… |
| 1118 | ConditionalExpression | `false` | equivalent | Dropping the continue cannot add a key. When literal === abs, the fall-through reaches files.set only if isLink && isRegularFile(literal) — and abs is the value resolvePointer returns, which is alway… |
| 1118 | EqualityOperator | `literal !== abs` | hole | Inverting the test skips exactly the symlink case (literal !== abs) and runs the body only where literal IS the resolved real path, where isLink is false — so the cited link is never sealed. Measured… |
| 1120 | BooleanLiteral | `true` | equivalent | The initialiser is dead: the only path that reaches the if without executing isLink = lstatSync(literal).isSymbolicLink() is the lstat throw, and the catch leaves the iteration with continue. isLink … |
| 1121 | BlockStatement | `{}` | hole | Emptying the try body leaves isLink false for every base, so the cited link is never sealed — RWD-2026-0070 re-opened. Measured: symlink fixture, shipped {alias.ts, code/guard.ts, runward/floor.md} v… |
| 1124 | BlockStatement | `{}` | equivalent | Falling out of the catch instead of continuing cannot add a key: lstat threw, so isLink still holds its per-iteration initial false, and isLink && ... short-circuits before isRegularFile is even call… |
| 1127 | ConditionalExpression | `true` | hole | Sealing every base literal path that lstat can stat and that is not the resolved target. Two measured over-seals, both on green missions. (a) Same relative name under two bases: notes.md at the proje… |
| 1127 | ConditionalExpression | `false` | hole | if (false) deletes the seal-the-link write, so the cited symlink own path never enters the lock — RWD-2026-0070 re-opened, exactly as the block-deletion mutant. Measured: symlink fixture, shipped {al… |
| 1127 | LogicalOperator | `isLink \|\| isRegularFile(literal)` | hole | Widening && to \|\| seals two shapes the condition exists to exclude, both measured on green missions. (a) isLink true, isRegularFile false — a cited-but-dangling link: alias.ts -> code/gone.ts enters … |
| 1128 | StringLiteral | `"Stryker was here!"` | equivalent | Same argument as the ADR-branch twin: the Map values are never read. The record the function returns is built as out[rel] = sha256(join(root, rel)) over files.keys(), so the string written here is ov… |

### parseEvidencePointers — 24 survivor(s): 14 hole · 2 equivalent · 8 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 110 | MethodExpression | `chunk` | hole | FALSE GREEN, verified by exit code. Applied on m4 (single defect: `file:code/deleted-a.ts<U+2028>; file:code/b.ts`): `check --strict --json` went from **exit 1 to exit 0**, conformance 1 -> 0, and th… |
| 115 | Regex | `/\S/` | display-only | Applied on m2, m3 and m6. Exit code, violation count and all evidence counters unchanged; the `problem` strings became `typed pointer does not resolve: test: — update it or remove the row` and `typed… |
| 115 | StringLiteral | `ˋˋ` | display-only | Applied on m2 and m6. `check --strict --json` kept exit 1, the same violation count and every evidence counter, but two `problem` strings lost the pointer they name: `typed pointer does not resolve: … |
| 125 | Regex | `/\S/` | display-only | Applied on m2. Exit 1 -> exit 1, conformance 10 -> 10, evidence counters identical; the message became `typed pointer adr: — an ADR pointer is `adr:NNNN` — digits only, no `ADR-` prefix` (baseline `a… |
| 125 | StringLiteral | `ˋˋ` | display-only | Applied on m2 (cell `adr:ADR-0002 — the deterministic guard decision`). Exit 1 -> exit 1, conformance 10 -> 10, evidence counters identical; the message `Architect · process-adr-and-journal · typed p… |
| 131 | EqualityOperator | `sep <= firstWs` | equivalent | The comparison is only ever evaluated on the third leg of `sep !== -1 && (firstWs === -1 \|\| sep < firstWs)`: reaching it requires `sep !== -1` AND `firstWs !== -1`, since `firstWs === -1` short-circu… |
| 139 | Regex | `/\s*(")([\s\S]*?)\1/` | hole | FALSE GREEN, verified by exit code. Applied on m6 (single defect: `test:code/test/pointers.test.ts::the "guard" path`, a name the file does not contain): `check --strict --json` went from **exit 1 to… |
| 139 | Regex | `/^\s(")([\s\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([\s\S])\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([\s\s]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([\S\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\S*(")([\s\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([^\s\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 140 | MethodExpression | `after` | hole | Applied on m2 and m3. On m2, `check --strict --json` gained the violation `Floor · provider-no-crash-missing-env · typed pointer test:code/test/pointers.test.ts:: — test named " spaced name" not foun… |
| 140 | Regex | `/["'ˋ]\|["'ˋ]$/g` | hole | Applied on m2 and m6. On m2 two rows moved (conformance 10 -> 11): `test named "the "guard" path"` became `test named "the guard path"` and a NEW violation appeared, `Floor · state-event-sourcing · t… |
| 140 | Regex | `/^["'ˋ]\|["'ˋ]/g` | hole | Applied on m2 and m6. Same observation as the sibling above, measured separately: on m2, `test named "the guard path"` replaced `test named "the "guard" path"` and the new violation `typed pointer te… |
| 140 | StringLiteral | `"Stryker was here!"` | hole | Applied on m2. `check --strict --json` gained `Floor · state-event-sourcing · typed pointer test:code/test/pointers.test.ts::'l'invariant — test named "Stryker was here!l'invariant tientStryker was h… |
| 157 | Regex | `/([^\s#]+)#(")([\s\S]*?)\2/` | hole | FALSE GREEN, verified by exit code. Applied on m5 (single defect: `file:code/deleted-b.ts — compare with code/b.ts#"the exact sentence"`): `check --strict --json` went from **exit 1 to exit 0**, conf… |
| 174 | Regex | `/:(\d+)/` | hole | Applied on m2. Two rows moved and the coverage counter with them (conformance 10 -> 11, `evidence.typed` 16 -> 15, `evidence.prose` 7 -> 8). A row that was GREEN went red: the cell `file:code/2026:07… |
| 182 | ConditionalExpression | `true` | equivalent | The mutated operand is the left half of `symbol !== undefined && /\s/.test(symbol)`. When `symbol` is a string, `symbol !== undefined` is already `true`, so replacing it by `true` changes nothing. Wh… |
| 182 | ConditionalExpression | `true` | display-only | Applied on m2 and m3. Exit code, violation count and every evidence counter unchanged; two `problem` strings changed on m2: `typed pointer file:code/src/demo.ts# — the `#` names nothing to look for` … |
| 182 | LogicalOperator | `symbol !== undefined \|\| /\s/.test(symbol)` | display-only | Applied on m2 and m3. Exit code, violation count and every evidence counter unchanged; the message `typed pointer file:code/src/demo.ts#MissingSymbol — symbol "MissingSymbol" not found in the file` b… |
| 182 | Regex | `/\S/` | display-only | Applied on m2 and m3. Exit code, violation count and every evidence counter unchanged; the message `typed pointer file:code/src/demo.ts#MissingSymbol — symbol "MissingSymbol" not found in the file` b… |
| 182 | StringLiteral | `"Stryker was here!"` | display-only | Applied on m2 and m3. Exit code, violation count and every evidence counter unchanged; the message `typed pointer file:code/src/demo.ts# — the `#` names nothing to look for (a symbol must be at least… |

### onDiskSpelling — 21 survivor(s): 7 hole · 10 equivalent · 4 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 338 | ConditionalExpression | `false` | hole | Identical `check --strict --json` payload on all seven probe missions and the self-gate (8/8 'no observable difference'). COULD NOT CLEAR. Removing the `!want` skip only matters when a path component… |
| 376 | ArithmeticOperator | `from - sep` | defence-in-depth | Neutralises the bound, so base is null and the walk restarts at the filesystem root — RWD-2026-0074 verbatim. Caught, by a named leg: test/spelling-conformance.js case ancestor-permissions-do-not-cha… |
| 376 | ConditionalExpression | `true` | hole | Forces the bound ON unconditionally. Reachable through the workspace allowance: repo && (real === repo \|\| real.startsWith(repo + sep)) calls onDiskSpelling(abs, resolve(b)) on a path legitimately OUT… |
| 376 | ConditionalExpression | `false` | defence-in-depth | Neutralises the bound, so base is null and the walk restarts at the filesystem root — RWD-2026-0074 verbatim. Caught, by a named leg: test/spelling-conformance.js case ancestor-permissions-do-not-cha… |
| 376 | ConditionalExpression | `true` | hole | Forces the bound ON unconditionally. Reachable through the workspace allowance: repo && (real === repo \|\| real.startsWith(repo + sep)) calls onDiskSpelling(abs, resolve(b)) on a path legitimately OUT… |
| 376 | ConditionalExpression | `false` | equivalent | The removed disjunct decides only when abs === from; everywhere else abs.startsWith(from + sep) already answers true. SENSITIVITY CONTROL: the nearby input is `file:.`, resolving exactly to the proje… |
| 376 | EqualityOperator | `abs !== from` | hole | Inverts the identity test, so the disjunction is true whenever abs !== from — i.e. for every pointer, including those NOT under from. Forces the bound ON unconditionally. Reachable through the worksp… |
| 376 | LogicalOperator | `abs === from && abs.startsWith(from.endsWit…` | defence-in-depth | Neutralises the bound, so base is null and the walk restarts at the filesystem root — RWD-2026-0074 verbatim. Caught, by a named leg: test/spelling-conformance.js case ancestor-permissions-do-not-cha… |
| 376 | MethodExpression | `abs.endsWith(from.endsWith(sep) ? from : fr…` | defence-in-depth | Neutralises the bound, so base is null and the walk restarts at the filesystem root — RWD-2026-0074 verbatim. Caught, by a named leg: test/spelling-conformance.js case ancestor-permissions-do-not-cha… |
| 376 | MethodExpression | `from.startsWith(sep)` | hole | On POSIX from is absolute, so from.startsWith(sep) is invariantly true and the ternary yields from instead of from + sep: the bound degrades to a bare string prefix and swallows any SIBLING whose nam… |
| 377 | MethodExpression | `abs` | hole | Passes the WHOLE absolute path where the remainder below the bound was intended. With the bound engaged the walk matches no first segment and returns null for every in-project pointer. On a case-inse… |
| 377 | StringLiteral | `""` | equivalent | Un-anchors the separator strip, which cannot matter because the string it runs on always BEGINS with the separator: base is non-null only when abs.startsWith(from + sep) held, so the slice starts at … |
| 377 | StringLiteral | `""` | equivalent | Empties the search value, so on POSIX the regex source becomes ^\\/ (backslash-slash) instead of ^/ and the leading separator survives the strip. The walk absorbs it: parts[0] is then "", and the loo… |
| 377 | StringLiteral | `""` | equivalent | Empties the replacement value. On POSIX the search value does not occur in sep ("/"), so the call is a no-op in both versions and the regex is ^/ either way — unobservable by construction on this pla… |
| 377 | StringLiteral | `"Stryker was here!"` | hole | Splices a literal into the head of the bounded remainder. With the bound engaged the walk matches no first segment and returns null for every in-project pointer. On a case-insensitive volume spelling… |
| 382 | ArithmeticOperator | `parts[0] - sep` | equivalent | Lives in the Windows drive-letter arm, dead on the platform the pass runs on: abs comes from resolve(), so on POSIX it starts with /, parts[0] is invariantly "", the parts[0] === "" test always takes… |
| 382 | ConditionalExpression | `true` | equivalent | Forces a condition already invariantly true on the platform the pass runs on: abs comes from resolve(), so on POSIX it starts with / and parts[0] is always "". SENSITIVITY CONTROL: the separating inp… |
| 382 | Regex | `/[A-Za-z]:$/` | equivalent | Lives in the Windows drive-letter arm, dead on the platform the pass runs on: abs comes from resolve(), so on POSIX it starts with /, parts[0] is invariantly "", the parts[0] === "" test always takes… |
| 382 | Regex | `/^[A-Za-z]:/` | equivalent | Lives in the Windows drive-letter arm, dead on the platform the pass runs on: abs comes from resolve(), so on POSIX it starts with /, parts[0] is invariantly "", the parts[0] === "" test always takes… |
| 382 | Regex | `/^[^A-Za-z]:$/` | equivalent | Lives in the Windows drive-letter arm, dead on the platform the pass runs on: abs comes from resolve(), so on POSIX it starts with /, parts[0] is invariantly "", the parts[0] === "" test always takes… |
| 388 | EqualityOperator | `i <= parts.length` | equivalent | Adds one iteration past the end. parts[parts.length] is undefined and the body first statement is if (!want) continue, so the extra pass does nothing and the loop exits. SENSITIVITY CONTROL: the near… |

### spellingViaRealpath — 14 survivor(s): 13 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 421 | BlockStatement | `{}` | hole | COULD NOT BE CLEARED, and filed as a hole for that reason rather than argued equivalent. Corrected probe on all four missions: identical everywhere, because the catch never runs — scripts/catch-reach… |
| 424 | ArithmeticOperator | `canonBase - sep` | hole | Mission A: exit 1 -> exit 0, conformance []. `canonBase - sep` on two strings is NaN, `startsWith` coerces it to "NaN", the test fails for every path and the function returns null. Missions B, C, D u… |
| 424 | BooleanLiteral | `canon.startsWith(canonBase + sep)` | hole | Corrected probe and per-mutant-detail on mission A: baseline exit 1 with the two case-insensitive violations; with the mutant applied, exit 0 and conformance []. Dropping the `!` makes the function r… |
| 424 | ConditionalExpression | `false` | equivalent | The mutant deletes an early `return null`, so it can only change the RESULT in a state where the guard fires — canon not under canonBase + sep — AND where the surviving expression then answers non-nu… |
| 424 | ConditionalExpression | `true` | hole | Same runs. Mission A: exit 1 -> exit 0, conformance [] (the guard becomes an unconditional `return null`). Missions B, C, D unchanged. A false green on a mis-spelled pointer, produced by a one-token … |
| 424 | MethodExpression | `canon.endsWith(canonBase + sep)` | hole | Mission A: exit 1 -> exit 0, conformance []. A canonical file path never ends with its base directory + separator, so the negated test is always true and the function returns null before it ever comp… |
| 426 | ArithmeticOperator | `canonBase.length - 1` | hole | Mission A: exit 1 -> exit 0, conformance []. The off-by-two slice carries the last character of the base plus the separator into `disk`, which then never case-matches the pointer. Missions B, C, D un… |
| 426 | MethodExpression | `canon` | hole | Mission A: exit 1 -> exit 0, conformance []. With `disk` set to the whole absolute canonical path instead of the pointer-relative suffix, it can never case-match the pointer as written, so the case c… |
| 437 | StringLiteral | `""` | hole | FALSE GREEN, measured. Shipped probe on the self-gate: no observable difference (exit 0, 4416 bytes) — no pointer in runward's own mission has a diverging spelling. split('/') becoming split('') inte… |
| 438 | ConditionalExpression | `true` | hole | Caught in the OTHER direction, by mission B: baseline exit 0 (green) -> exit 1 with 'typed pointer file:code/src/core/domain/guard-alias.ts#guardFields — this filesystem is case-insensitive; on a cas… |
| 438 | ConditionalExpression | `false` | hole | Mission A: exit 1 -> exit 0, conformance []. The whole ternary condition forced false makes the function return null unconditionally — the same false green as emptying it. Missions B, C, D unchanged. |
| 438 | EqualityOperator | `disk.toLowerCase() !== wrote.toLowerCase()` | hole | Observable in BOTH directions, which is what makes it the most serious of the fifteen. Mission A: exit 1 -> exit 0, conformance [] (a real case mis-spelling is certified green). Mission B: exit 0 -> … |
| 438 | MethodExpression | `disk.toUpperCase()` | hole | Mission A: exit 1 -> exit 0, conformance []. Comparing disk.toUpperCase() with wrote.toLowerCase() can only be equal for a path with no cased letters, so the case rung answers null for every real poi… |
| 438 | MethodExpression | `wrote.toUpperCase()` | hole | Mission A: exit 1 -> exit 0, conformance []. Same asymmetric folding on the other operand, same false green. Missions B, C, D unchanged. |

### textOutsideManifest — 13 survivor(s): 8 hole · 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 524 | StringLiteral | `"Stryker was here!"` | equivalent | `raw` is assigned unconditionally as the first statement of the `try`. The only path that skips that assignment is a throw inside `readFileSync`, and the `catch` returns a literal without ever readin… |
| 528 | BlockStatement | `{}` | equivalent | Two independent reasons, either sufficient. (1) The `catch` cannot be entered on any call this code can receive. `textOutsideManifest` is called only from `circularEvidence`, only when `abs === self`… |
| 529 | StringLiteral | `"Stryker was here!"` | equivalent | The `catch` cannot be entered on any call this code can receive. `textOutsideManifest` is called only from `circularEvidence`, only when `abs === self`, i.e. on the deliverable whose rows `evidenceRe… |
| 535 | Regex | `/\s*(ˋˋˋ\|~~~)/` | hole | FALSE GREEN. Dropping the caret makes the fence test 'contains a fence opener anywhere', so one sentence that MENTIONS a fence opens one; every following line, including the real conformance heading,… |
| 535 | Regex | `/^\S*(ˋˋˋ\|~~~)/` | hole | FALSE GREEN in BOTH directions. The mutant lets a non-space prefix precede the fence opener while refusing leading whitespace. m4-inline-backticks: pristine exit 1/gaps/conformance 1, mutant exit 0/c… |
| 536 | BooleanLiteral | `false` | equivalent | fenced[i] is read only by heading(i) = !fenced[i] && /^#{1,6}\s/.test(lines[i]); this literal is written only for lines matching the fence test, whose first non-blank characters are backticks or tild… |
| 542 | Regex | `/#{1,6}\s/` | hole | FALSE GREEN. Unanchored, the test makes any line CONTAINING a hash-then-space a heading, so the walk ends on an ordinary prose line and every row below it — the whole table — is kept in the text circ… |
| 543 | ArrayDeclaration | `["Stryker was here"]` | hole | FALSE GREEN. Unlike the register's equivalent Stryker cases, this literal is not decoration: `keep` is the haystack of outside.includes(symbol), so seeding it greens every self-citation whose symbol … |
| 545 | Regex | `/#{1,6}\s+Rule conformance/i` | hole | FALSE RED. Unanchored, the title test fires on any heading that MENTIONS the table, so a second section is excluded and the fact it states disappears from the text the self-citation is checked agains… |
| 545 | Regex | `/^#{1,6}\sRule conformance/i` | hole | FALSE GREEN. Collapsing \s+ to \s means one stray space in the heading stops the section being excluded, and the universal green key works again — while the manifest itself is still parsed, so nothin… |
| 547 | EqualityOperator | `i <= lines.length` | equivalent | The inner walk differs from pristine only when the excluded section runs to end-of-file. Pristine leaves the loop at i = lines.length, then the decrement and the outer increment land back on lines.le… |
| 549 | UpdateOperator | `i++` | hole | FALSE RED. An increment instead of a decrement means the outer loop's own increment skips PAST the heading that terminated the section, so that heading and the line after it are dropped from the kept… |
| 576 | StringLiteral | `""` | hole | FALSE GREEN. Joining with the empty string welds every line to the next and manufactures symbols that no line contains. It is a one-way weakening: concatenation can only ADD matches to outside.includ… |

### evidenceBreakdown — 12 survivor(s): 8 hole · 3 equivalent · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 1085 | MethodExpression | `(row.evidence \|\| "").replace(/\s+/g, " ")` | hole | Mission m1-dup. `node scripts/mutation-probe.mjs --function evidenceBreakdown --mission <m1-dup>/runward` reports OBSERVABLE: json (ledger probe-m1-dup.jsonl; re-run once, same result), and scripts/p… |
| 1085 | Regex | `/\s/g` | hole | THE ONE THAT MATTERS. Mission m1-dup: two `applied` rows carry the same two pointers, one written with a double space between them (`alpha file:code/src/core/domain/guard.ts file:code/src/core/domain… |
| 1085 | StringLiteral | `"Stryker was here!"` | hole | Mission m2-empty (three `applied` rows whose Evidence cell is empty: `\| hexa-architecture \| applied \| \|`). Pristine baseline: exit 1, evidence.duplicated = []. Official probe: OBSERVABLE: json (probe… |
| 1085 | StringLiteral | `""` | hole | Two directions, both measured. (a) m1-dup, official probe OBSERVABLE: json (twice), dual json+print: counters unchanged, but every duplicate key is re-spelled with its whitespace DELETED — "alpha fil… |
| 1086 | ConditionalExpression | `true` | hole | Mission m2-empty. Official probe OBSERVABLE: json (probe-m2-empty.jsonl, two runs); dual probe json+print; also OBSERVABLE on m9-combined. probe-delta: duplicated goes from [] to [{"evidence":"","rul… |
| 1095 | StringLiteral | `"Stryker was here!"` | equivalent | The mutated literal is only ever read when `row.evidence` is falsy. Two facts, both measured rather than reasoned: (a) `row.evidence` is always a string — scripts/probe-fuzz.mjs runs readManifest ove… |
| 1098 | ConditionalExpression | `false` | equivalent | Deleting the guard changes the value returned only if some pointer with a falsy `path` can reach a different outcome through `resolveFile(p.path, bases)`. It cannot, for two measured reasons. (a) `ad… |
| 1112 | MethodExpression | `[...byEvidence.entries()].filter(([, rs]) =…` | hole | Two missions. m1-dup (2 duplicate groups, inserted zeta-then-alpha so the sorted order is the reverse of the insertion order): official probe OBSERVABLE: json on two runs, dual probe json+print, prob… |
| 1115 | ArrowFunction | `() => undefined` | hole | Same measurements as 803\|24\|806\|62 and the same result, taken separately: m1-dup official probe OBSERVABLE: json on two runs and dual probe json+print, with probe-delta showing duplicated flipping fr… |
| 1269 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback is used only when the Evidence cell is empty, and it is passed to parseEvidencePointers, which emits a pointer only for a chunk matching POINTER_PREFIX = /\b(file\|test\|adr):(\S.*)$/. "St… |
| 1273 | LogicalOperator | `!abs && !isRegularFile(abs)` | hole | \|\| -> && disables the guard for the one input on which the two operators differ: a pointer that RESOLVES to something that is not a regular file. resolvePointer already requires existsSync, so that m… |
| 1291 | ConditionalExpression | `true` | defence-in-depth | Unreachable. t ranges over resolvedTargets, and a path enters that set only after if (!abs \|\| !isRegularFile(abs)) continue; three lines above — so every t is a regular file, while missionAbs is real… |

### resolvePointer — 11 survivor(s): 9 hole · 2 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 446 | StringLiteral | `""` | display-only | Ran `node scripts/mutation-probe.mjs --function resolvePointer --mission <esc>`: OBSERVABLE: json, not exit-code (ledger reports/mutation/probe-resolvePointer-esc.jsonl). Applied the mutant alone and… |
| 470 | ConditionalExpression | `false` | hole | Deletes the realpath fallback: walked === null silently becomes 'already matches'. Identical on eleven missions across all eight surfaces, with live controls moving in the same batteries. NOT equival… |
| 470 | ConditionalExpression | `true` | hole | Makes the realpath rung answer for EVERY pointer, discarding the walk's verdict. Observable twice, in opposite directions. m-unlist: pristine gaps/exit 1/conformance 5 becomes clean/exit 0/conformanc… |
| 470 | EqualityOperator | `walked !== null` | hole | Inverts the guard: the rung answers for verified, UNCHECKABLE and every real spelling, and the one input it was written for falls to the other arm. Same profile as the first, measured independently. … |
| 471 | ConditionalExpression | `false` | hole | No surface moved anywhere, over eleven missions and eight surfaces, with live controls moving in the same batteries. Filed hole rather than equivalent because the mutant IS in effect and the differen… |
| 471 | ConditionalExpression | `true` | hole | Collapses every answer the walk can give into null: a real spelling and UNCHECKABLE both reported as 'already matches'. The widest of the nine. m-case: gaps/exit 1/conformance 1 to clean/exit 0/confo… |
| 471 | EqualityOperator | `walked !== SPELLING_VERIFIED` | hole | Inverts the sentinel test: a real spelling and UNCHECKABLE become null, both refusals lost, while the sentinel passes through raw. Observable exactly like the ConditionalExpression true. m-case and m… |
| 483 | ConditionalExpression | `false` | hole | The repository-root twin: no surface moved on any of the eleven missions, with the repoD battery moving for its siblings. Filed hole for the same measured reason: the value diagnostic shows pristine … |
| 483 | ConditionalExpression | `true` | hole | The repository-root branch, which has NO realpath fallback below it: this makes it report null for every walk answer. repoA and repoC flip gaps/exit 1 to clean/exit 0. repoD: all eight surfaces diffe… |
| 483 | EqualityOperator | `walked !== SPELLING_VERIFIED` | hole | Inverts the sentinel test in the repository-root branch: a real spelling and UNCHECKABLE become null, the sentinel passes through raw. repoA and repoC flip to clean/exit 0, the unlistable-directory r… |
| 487 | StringLiteral | `""` | display-only | Ran the probe on esc: OBSERVABLE: json, not exit-code (probe-resolvePointer-esc.jsonl). Applied the mutant alone and diffed the payloads: pristine exit 1 / 6062 bytes, mutated exit 1 / 5734 bytes, an… |

### projectRelativeSpelling — 8 survivor(s): 3 hole · 3 equivalent · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 660 | ArrayDeclaration | `["Stryker was here"]` | hole | Survives on macOS too, so not a filesystem artifact: net exit 0 / fail 0 over 723 tests, the four extra nets exit 0 with byte-identical output, self-gate and all four missions byte-identical on json,… |
| 665 | ConditionalExpression | `false` | hole | Net exit 0 / fail 0, four extra nets exit 0, every mission byte-identical. Direct drive: 2 of 196 moved, both turning null into the bare parent marker. With the guard defeated the gate would render '… |
| 665 | StringLiteral | `""` | hole | Measured separately from its neighbour on the same line — the two are only distinguishable by column. Net exit 0 / fail 0, every mission byte-identical, the same 2 of 196 battery cases moving with th… |
| 725 | ConditionalExpression | `false` | equivalent | Removes a fast path, not a decision. With every root falsy accepted is [], and the next guard if (!accepted.some(under)) return null returns the same null, since [].some(...) is false. SENSITIVITY CO… |
| 735 | ConditionalExpression | `false` | equivalent | The disjunct is subsumed by the conjunction beside it: for r === "", "" !== ".." is true, "".startsWith("../") is false and isAbsolute("") is false — on path.posix and path.win32 alike — so the secon… |
| 735 | ConditionalExpression | `true` | defence-in-depth | Lets under accept a spelling that is the PARENT of an accepted root. Shielded upstream: projectRelativeSpelling is only ever called on r.spelling, and resolvePointer produces a spelling only for a pa… |
| 735 | StringLiteral | `"Stryker was here!"` | equivalent | Same subsumption as the r === "" -> false mutant on this line: for the real value "" the conjunction beside it already returns true, and for a relative path literally spelled Stryker was here! it als… |
| 735 | StringLiteral | `""` | defence-in-depth | Behaviourally identical to the r !== ".." -> true mutant on this line: r !== "" is false only for r === "", where the first disjunct has already returned true, so the sole value whose verdict changes… |

### verifyEvidenceLock — 8 survivor(s): 6 hole · 1 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 1013 | StringLiteral | `""` | equivalent | `readFileSync(path, "")` does not throw: an empty encoding is falsy, so Node returns the raw Buffer instead of decoding. The ONLY consumer of that value is `JSON.parse(...)` on the very next token, a… |
| 1016 | StringLiteral | `""` | hole | The mutated literal is the violation's RULE ATTRIBUTION, `rule: "(seal)"`, not its message. Battery: observable on 5 (json:t-corrupt-lock, json:t-lock-badutf8, json:t-lock-bom, json:t-lock-utf16, tex… |
| 1024 | StringLiteral | `""` | hole | Same literal, the unknown-version branch. Battery: observable on 3 (json:t-unknown-version, json:t-multi, text:t-multi). tools/rulefield.mjs on t-unknown-version: pristine `exit=1 ["(seal)"]`, mutant… |
| 1029 | StringLiteral | `""` | hole | Same literal, the zero-files branch. Battery: observable on 2 (json:t-zero-files, text:t-zero-files). tools/rulefield.mjs on t-zero-files: pristine `exit=1 ["(seal)"]`, mutant `exit=1 [""]`, the mess… |
| 1037 | ConditionalExpression | `false` | display-only | The mutated node is `abs === rootAbs`, so the containment test becomes `isAbsolute(rel) \|\| !(false \|\| abs.startsWith(rootAbs + sep))`. Built t-root-key for it: a lock whose key is `.`, the only input… |
| 1038 | StringLiteral | `""` | hole | Same `rule: "(seal)"` literal, the escapes-the-project branch. Battery: observable on 4 (json:t-escape-abs, json:t-escape-dotdot, json:t-multi, text:t-multi). tools/rulefield.mjs on t-escape-abs (a l… |
| 1042 | StringLiteral | `""` | hole | Same literal, the sealed-evidence-missing branch. Battery: observable on 5 (json:t-missing-file, json:t-root-key, json:t-multi, text:t-multi, text:t-root-key). tools/rulefield.mjs on t-missing-file (… |
| 1045 | StringLiteral | `""` | hole | Same literal, the sealed-evidence-changed branch — the one every real tamper lands on. Battery: observable on 8, the widest of the eight (json:t-file-modified, json:t-manifest-rewritten, json:t-manif… |

### splitPointers — 6 survivor(s): 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 65 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The mutant seeds the chunk accumulator with the constant string `Stryker was here`. `splitPointers` has exactly one consumer in the tree — the `for (const chunk of splitPointers(segment))` loop in `p… |
| 66 | StringLiteral | `"Stryker was here!"` | equivalent | The mutant makes the FIRST chunk carry the prefix `Stryker was here!`. Every path by which that could move a pointer is closed. (1) It cannot CREATE one: the literal has no `:`, and `POINTER_PREFIX` … |
| 80 | Regex | `/([\s,])(file\|test\|adr):\S/` | equivalent | The mutant deletes the `^` alternative, and that alternative is unreachable code at this call site. The regex is only ever evaluated as the right-hand operand of `if (/\s\|,/.test(ch) && /(^\|[\s,])(fi… |
| 82 | StringLiteral | `"Stryker was here!"` | equivalent | Same mechanism as the line-66 mutant, applied to every chunk after a cut rather than to the first: the buffer restarts with `Stryker was here!` instead of empty. The closures are identical and none o… |
| 88 | MethodExpression | `out` | equivalent | Removing the filter changes exactly which chunks reach the consumer, and the chunks it removes are precisely those on which the consumer is a no-op. `out.filter((x) => x.trim())` drops a chunk if and… |
| 88 | MethodExpression | `x` | equivalent | The predicate becomes the truthiness of the raw chunk instead of the truthiness of its trimmed form. For strings those two predicates disagree on exactly one class of value: the whitespace-only chunk… |

### conformanceRow — 5 survivor(s): 1 hole · 4 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 583 | ConditionalExpression | `false` | equivalent | with no pipe in the line the split yields a one-element array and the next line's cell-count test returns false regardless. One call site, so this oracle covers every use. Also survives the whole net… |
| 583 | StringLiteral | `""` | equivalent | includes of the empty string is true for every string, so the guard never fires — the same state the neighbour produces by returning false outright, and the two produce IDENTICAL digests, so that is … |
| 585 | StringLiteral | `"Stryker was here!"` | equivalent | The FIRST replace's replacement, the one stripping the leading pipe. The replacement text carries no pipe, so the pipe count is unchanged and the split returns exactly the same number of cells; the o… |
| 585 | StringLiteral | `"Stryker was here!"` | equivalent | The SECOND replace's replacement, stripping the trailing pipe. Both pristine and mutant CONSUME the trailing pipe — one replaces it with nothing, the other with pipe-free text — so the pipe count and… |
| 612 | MethodExpression | `t.endsWith("\|")` | hole | Observable in BOTH directions, through the gate, on both filesystems. FALSE GREEN on m-crow-green: pristine exit 1 / gaps / one gap; mutant exit 0 / clean / zero. sarif results 1 to 0, attest verdict… |

### isSpelling — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 278 | ConditionalExpression | `true` | equivalent | The empty spelling cannot pass either call site. At the exported parameter, the very next test rejects it for EVERY root: identity cannot hold because falsy roots are filtered out one line above, and… |
| 278 | StringLiteral | `"Stryker was here!"` | hole | Two observable flips. (a) Case B6, as above: the empty spelling is no longer excluded, null becomes 'src'. (b) Case B7, unique to this mutant: a legitimate spelling equal to the marker string is now … |
| 300 | MethodExpression | `s.normalize("NFC").toLowerCase().toUpperCas…` | equivalent | The fold's output is never rendered or returned; its single consumer compares two folded names, so only the PARTITION it induces can be observed. The two folds induce the same partition, measured thr… |

### repoRootAbove — 3 survivor(s): 2 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 492 | EqualityOperator | `i <= 24` | hole | Ran `node scripts/mutation-probe.mjs --function repoRootAbove --mission <d24>`: OBSERVABLE: exit-code (ledger reports/mutation/probe-repoRootAbove-d24.jsonl). Then applied the mutant alone and ran `n… |
| 492 | UpdateOperator | `i--` | hole | Ran the probe on d24: OBSERVABLE: exit-code (probe-repoRootAbove-d24.jsonl). Ran it again on d25, where the EqualityOperator mutant above is already identical to the pristine build: still OBSERVABLE:… |
| 498 | ConditionalExpression | `false` | equivalent | The guard only ends a walk that has already reached the filesystem root. The loop body examines `dir` for the five markers BEFORE computing `parent`, so the root is examined exactly once in the prist… |

### splitSegments — 3 survivor(s): 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 37 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The mutant seeds the accumulator with one extra segment whose value is the constant string `Stryker was here`. Two facts make it unable to move anything. First, `splitSegments` has exactly one consum… |
| 38 | StringLiteral | `"Stryker was here!"` | equivalent | The mutant makes the FIRST segment carry the prefix `Stryker was here!`. Three separate reasons close every path by which that could move a pointer. (1) It cannot CREATE one: the literal has no `:`, … |
| 54 | StringLiteral | `"Stryker was here!"` | equivalent | Same mechanism as the line-38 mutant, applied to every segment AFTER the first: instead of restarting the buffer empty after a `;`, it restarts it with `Stryker was here!`. The three closures are ide… |

### isRegularFile — 2 survivor(s): 1 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 720 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because a measurement condemned it. Ran the probe on esc (a mission with a directory pointer, a FIFO pointer, an unreadable fi… |
| 794 | BlockStatement | `{}` | equivalent | catch {} returns undefined instead of false, and every consumer uses the result in boolean position, where the two are indistinguishable. All eight call sites in the module are !isRegularFile(x) or i… |

### sha256 — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 940 | BlockStatement | `{}` | hole | The gate stops rendering a verdict at all. Shipped probe on t-lock-sentinel: OBSERVABLE, exit-code. Battery: observable on 4 (json:t-unreadable, json:t-lock-sentinel, json:t-lock-sentinel-empty, atte… |
| 941 | StringLiteral | `""` | hole | THE MOST SERIOUS OF THE SIXTEEN: it flips the gate in BOTH directions on a sealed, tampered-with mission. Shipped probe on t-lock-sentinel: OBSERVABLE, exit-code. Battery: observable on 3 (json:t-loc… |

### symbolPresent — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 23 | Regex | `/[A-Za-z_$][A-Za-z0-9_$]*$/` | hole | FALSE GREEN, verified by exit code, and three further observations in three other shapes. (1) m2, whose only defect is the cell `file:code/b.ts#a.b`: `check --strict --json` went from **exit 1 to exi… |
| 28 | Regex | `/\b(file\|test\|adr):(\S.*)/` | hole | Verified by exit code. On m3, whose only cell is `file:code/deleted-j.ts<U+2028> a trailing note` and whose cited file does not exist, `check --strict --json` went from **exit 0 to exit 1**, gaining … |

### clean — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 195 | Regex | `/[),.:ˋ]$/` | defence-in-depth | Strips one trailing character instead of the run, so a pointer ending in two of ),.: or a backtick keeps the second-to-last — RWD-2026-0055 re-opened one character short. Caught by the cheapest leg o… |

### realpathOr — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 711 | BlockStatement | `{}` | hole | COULD NOT CLEAR at the call sites that carry the risk — filed as a hole on that ground, and the ground is measured. Ran `node scripts/mutation-probe.mjs --function realpathOr` on norules, on the self… |

### renderEvidenceLock — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 995 | StringLiteral | `""` | hole | Shipped probe on f-plain: no observable difference — the probe never runs `--freeze`, so it never calls this function. Battery: observable on 2, both freeze runs (freeze:f-plain, freeze:f-bracket), w… |

## Module: conformance

Survivors: 130

Holes: 96 · Equivalent: 26 · Display-only: 1 · Defence-in-depth: 7

### readManifest — 25 survivor(s): 19 hole · 5 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 115 | EqualityOperator | `i <= lines.length` | equivalent | L'itération supplémentaire du scan de têtes lit lines[lines.length] === undefined ; RegExp.test le coerce vers la chaîne constante 'undefined', qui ne matche ni /^\s*(```\|~~~)/ ni /^#{1,6}\s+Rule con… |
| 116 | Regex | `/\s*(ˋˋˋ\|~~~)/` | hole | Désancrée, la regex de fence bascule `fenced` sur toute ligne CONTENANT ``` en inline. Recette REFUS-d'honnête : mission `init --example` verte + une ligne de prose « Note: wrap format examples in ``… |
| 116 | Regex | `/^\S*(ˋˋˋ\|~~~)/` | hole | CommonMark autorise une fence indentée jusqu'à 3 espaces ; le mutant cesse de la suivre. Recette A : illustration dans une fence indentée (« ␣␣``` ») dont la fausse tête d'exemple est en colonne 0 → … |
| 120 | Regex | `/#{1,6}\s+Rule conformance/i` | hole | Désancrée, la regex compte une MENTION en prose comme une tête de section. Recette : ajouter « The ## Rule conformance table below accounts for every mapped rule. » au-dessus de la vraie section → me… |
| 120 | Regex | `/^#{1,6}\sRule conformance/i` | hole | \s+ → \s : une tête écrite « ##␣␣Rule conformance » (double espace — rendu markdown identique) n'est plus reconnue. Mesuré en direct : rows [] ET problems [] — doublement silencieux, le livrable « n'… |
| 123 | ConditionalExpression | `false` | equivalent | Sans le retour anticipé, un document à 0 tête tombe dans la suite : heads.length>1 est faux, et la boucle des lignes démarre à heads[0]+1 = undefined+1 = NaN ; NaN < lines.length est toujours faux, d… |
| 128 | ArithmeticOperator | `i - 1` | hole | Même canal que le précédent, en pire : les numéros passent en base 0 moins 1, soit un décalage de DEUX — mesuré « lines 33, 39 » pour les vraies lignes 35 et 41. La remédiation pointe des lignes exis… |
| 128 | ArrowFunction | `() => undefined` | hole | La remédiation du refus perd ses pointeurs de ligne : mesuré sur la mission à sections dupliquées, « (lines 35, 41) » → « (lines , ) » (violation du gate ET check --json). Exit et compte inchangés, d… |
| 128 | StringLiteral | `""` | hole | Le séparateur disparaît et la liste de lignes fusionne en un nombre inexistant : mesuré « lines 35, 41 » → « lines 3541 ». Deux emplacements deviennent une seule ligne fantôme — remédiation fausse, p… |
| 135 | Regex | `/\s*(ˋˋˋ\|~~~)/` | hole | Version boucle-des-lignes du mutant 2 : toute ligne de la SECTION contenant ``` en inline bascule `fenced`. Recette : une ligne de prose « note: wrap format examples in ``` fences when documenting » … |
| 135 | Regex | `/^\S*(ˋˋˋ\|~~~)/` | hole | Le sens le plus grave : REFUSE cassé. Recette mesurée : mission exemple verte, une ligne exigée d'architecture.md déplacée DANS une fence indentée (« ␣␣``` » … « ␣␣``` ») — une illustration que le ga… |
| 141 | Regex | `/^#{1,6}\S/` | hole | Par backtracking, /^#{1,6}\S/ matche encore tout titre à ≥2 dièses (le dernier # sert de \S — vérifié : « ## 5. What stays open » matche, « # Annexe » non) : seul un titre de NIVEAU 1 cesse de clore … |
| 143 | MethodExpression | `line` | hole | Deux formes honnêtes GFM-légales cassent. A : table indentée de 2 espaces (rendu identique) — les lignes ne « commencent » plus par \| et sont perdues SANS problem : mesuré rows [] problems [], CLI ex… |
| 148 | MethodExpression | `t.startsWith("\|")` | hole | À ce point t commence toujours par \| (filtre deux lignes plus haut), donc la condition devient toujours vraie : TOUTE ligne GFM-ouverte (pipe final omis — valide, rendu identique, explicitement suppo… |
| 148 | StringLiteral | `""` | hole | endsWith("") est toujours vrai : même comportement toujours-slice(1,-1) que le mutant précédent, et les mesures sont octet-identiques (même diff de batterie sur la ligne GFM-ouverte, même bascule exi… |
| 155 | MethodExpression | `cols[0] ?? ""` | equivalent | Chaque cellule est déjà .trim()ée dans le map qui construit cols deux lignes plus haut ; trim est idempotent (même définition spec des blancs), donc la truthiness de (cols[0] ?? "").trim() et de (col… |
| 155 | Regex | `/:?-+:?$/` | hole | La garde des lignes malformées passe de plein-match à match-suffixe sur le motif séparateur : une ligne à 2 colonnes dont la première cellule FINIT par un tiret (« \| my-rule- \| applied » — typo de ti… |
| 155 | Regex | `/^:?-+:?/` | hole | Même garde élargie en match-préfixe : une ligne à 2 colonnes dont la première cellule COMMENCE par un tiret (« \| --legacy \| applied » — un tiret de liste collé) est avalée comme séparateur, son signa… |
| 155 | Regex | `/rule$/i` | hole | La garde d'en-tête élargie en suffixe : une ligne à 2 colonnes dont la première cellule finit par « rule » (« \| house-logging-rule \| applied ») est prise pour l'en-tête de table et sa perte n'est plu… |
| 155 | Regex | `/^rule/i` | hole | Garde d'en-tête élargie en préfixe : « \| rules-of-engagement \| applied » (2 colonnes) est lue comme l'en-tête « Rule » et disparaît sans signalement. Mesuré : exit 1→0, violation 1→0. Même classe de … |
| 155 | StringLiteral | `"Stryker was here!"` | equivalent | Le repli `??` est du code mort : cols vient de String.prototype.split, qui renvoie toujours ≥1 élément (même "" donne [""]) puis d'un map — cols[0] est donc toujours une chaîne définie et le repli n'… |
| 155 | StringLiteral | `"Stryker was here!"` | equivalent | Second repli `??` mort de la même ligne, même preuve que l'occurrence 1 : cols[0] n'est jamais nullish (split renvoie ≥1 élément pour toute chaîne), le littéral remplacé n'est jamais évalué. Contrôle… |
| 156 | MethodExpression | `t` | display-only | Argumenté aussi durement qu'un hole : la seule différence mesurable, sur toute la batterie et les 20 missions, est la LONGUEUR de l'extrait de la ligne fautive écho dans le message « needs 3 columns … |
| 160 | Regex | `/:?-+:?$/` | hole | Le saut de séparateur élargi en suffixe s'applique cette fois aux LIGNES COMPLÈTES (3 colonnes) : une ligne de données dont la cellule règle finit par un tiret (« \| hexa-architecture- \| n/a \| … \| » —… |
| 160 | Regex | `/^:?-+:?/` | hole | Saut de séparateur élargi en préfixe : toute cellule règle commençant par « - » ou « :- » est du mobilier — « \| --legacy-note \| n/a \| kept for history \| », « \| - hexa-architecture \| … » (tiret de lis… |

### unratifiedAdrs — 20 survivor(s): 17 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 263 | Regex | `/DRAFT-/i` | hole | Un fichier dont le NOM contient 'DRAFT-' ailleurs qu'en tête devient un DRAFT. Recette : mission init --example + adr/ADR-0115-DRAFT-mid.md au corps '**Status**: accepted'. Mesuré : livré exit 0 (ADR… |
| 266 | StringLiteral | `"Stryker was here!"` | equivalent | L'initialiseur de draftBody n'est observable que si readFileSync lève (le succès l'écrase). Chemin de levée sondé et mesuré : DRAFT-h-dir.md répertoire (EISDIR) et DRAFT géant de 540 Mio (utf8 au-del… |
| 268 | StringLiteral | `""` | hole | Mesuré (Node 24.18.0) : readFileSync(p, "") ne lève pas — '' est falsy, la lecture rend un Buffer, et regex.test coerce via toString() dont le défaut est utf8 : en dessous du cap de chaîne V8 (~512 M… |
| 271 | Regex | `/\s*(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | Sans l'ancre, une mention de 'status: rejected' en MILIEU de ligne vaut résolution. Recette : mission init --example + adr/DRAFT-f-rej-mid.md dont le corps est '# DRAFT\nThe previous status: rejected… |
| 271 | Regex | `/^\s(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | \s* → \s exige exactement UN blanc avant le statut : 'Status: rejected' en colonne 0 — la forme canonique du DRAFT résolu d'ADR-0038 — ne matche plus. Recette : mission init --example + DRAFT-b-rej-c… |
| 271 | Regex | `/^\S*(?:\*\*status\*\*\|status)\s*:\s*reject…` | hole | \s* → \S* : \S* ne peut pas traverser les espaces de tête, une ligne de statut INDENTÉE ne matche plus (la colonne 0 survit par backtracking sur \S* vide). Recette : mission init --example + DRAFT-c-… |
| 271 | Regex | `/^\s*(?:\*\*status\*\*\|status)\S*:\s*reject…` | hole | Le \s* entre le mot-clé et le deux-points devient \S* : l'espace française avant le deux-points — la règle typographique, pas une faute, le motif exact que RWD-2026-0084 vient de fusionner chez les q… |
| 271 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\srejecte…` | hole | Après le deux-points, \s* → \s exige exactement un blanc : 'Status:rejected' (collé) et 'Status: rejected' (double espace) ne matchent plus. Recette : mission init --example + DRAFT-e-rej-nospace.md … |
| 276 | StringLiteral | `"Stryker was here!"` | equivalent | Magasin mort : dans la branche non-DRAFT, le seul chemin où l'initialiseur de body survit est une readFileSync qui lève, et ce catch fait `continue` — l'itération sort avant toute lecture de body. Su… |
| 278 | StringLiteral | `""` | hole | Même mécanique que le jumeau draftBody, mais ici le verdict bascule. Mesuré : readFileSync(p, "") rend un Buffer (encodage '' falsy, pas de levée) et les deux .test coercent via toString() utf8 — ide… |
| 280 | BlockStatement | `{}` | equivalent | Après le catch vidé, le reste du corps de boucle se réduit aux deux tests sur body — resté "" (l'initialiseur, que cette mutation ne touche pas). "" ne peut matcher ni /^\s*(?:\*\*status\*\*\|status)\… |
| 283 | Regex | `/\s*(?:\*\*status\*\*\|status)\s*:\s*hypothe…` | hole | Sans l'ancre, une mention en milieu de ligne suffit à condamner un ADR ratifié. Recette : mission init --example + ADR-0104-hyp-mid.md : '# x\nearlier the status: hypothesis label was wrong\n\n**Stat… |
| 283 | Regex | `/^\s(?:\*\*status\*\*\|status)\s*:\s*hypothe…` | hole | Le plus large des survivants : \s* → \s exige un blanc avant le statut, donc 'Status: hypothesis' en COLONNE 0 — la forme canonique, celle que characterize --mine écrit — n'est plus détectée. Recette… |
| 283 | Regex | `/^\S*(?:\*\*status\*\*\|status)\s*:\s*hypoth…` | hole | \s* → \S* : la ligne de statut indentée échappe à la détection (\S* ne traverse pas les espaces ; la colonne 0 survit par backtracking). Recette : mission init --example + ADR-0101-hyp-indent.md (' S… |
| 283 | Regex | `/^\s*(?:\*\*status\*\*\|status)\S*:\s*hypoth…` | hole | L'espace française avant le deux-points cesse de matcher : '**Status** : hypothesis' — la forme qu'un opérateur français écrit par règle typographique, le motif même de RWD-2026-0084 — n'est plus dét… |
| 283 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\shypothe…` | hole | Après le deux-points, exactement un blanc requis : 'Status:hypothesis' (collé) et 'Status: hypothesis' (double espace) ne sont plus détectés. Recette : mission init --example + ADR-0103-hyp-nospace.m… |
| 284 | StringLiteral | `""` | hole | Pas un cosmétique : la raison EST ce qui dit à l'opérateur quel marqueur lever, et elle voyage sur trois surfaces. Recette : mission init --example + ADR-0100-hyp-col0.md, check --strict avec et sans… |
| 285 | Regex | `/why\S*:\s*UNKNOWN\b/i` | hole | \s* → \S* entre 'why' et le deux-points : 'why : UNKNOWN' à l'espace française n'est plus détecté. Recette : mission init --example + ADR-0111-why-fr.md ('**Status**: accepted' + 'why : UNKNOWN'). Me… |
| 285 | Regex | `/why\s*:\sUNKNOWN\b/i` | hole | Après le deux-points, exactement un blanc requis : 'why:UNKNOWN' (collé) et 'why: UNKNOWN' (double espace) ne sont plus détectés — seule la graphie minée exacte 'why: UNKNOWN' reste vue. Recette : mi… |
| 286 | StringLiteral | `""` | hole | Même classe que le survivant reason 'Status: hypothesis' : la raison est la remédiation, sur trois surfaces. Recette : mission init --example + ADR-0110-why.md ('**Status**: accepted' + 'why: UNKNOWN… |

### decisionCoverage — 17 survivor(s): 15 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 301 | StringLiteral | `""` | hole | endsWith('') est toujours vrai : tout non-.md de runward/adr/ entre dans le compte des decisions. Recette mesuree : mission init + ADR-0007 accepted + notes.txt dans adr/ ; `check --coverage` livre :… |
| 304 | BlockStatement | `{}` | hole | Corps de la branche DRAFT vide : plus aucune lecture du statut, chute sur le return true terminal — tout DRAFT est compte, y compris rejete. Recette mesuree : mission init + ADR-0007 accepted + DRAFT… |
| 304 | ConditionalExpression | `true` | hole | Tout fichier passe par la branche DRAFT : un ADR rejete NON-draft est evince du total (sa ligne Status: rejected declenche l'exclusion reservee aux DRAFT, ADR-0038). Recette mesuree : mission init + … |
| 304 | ConditionalExpression | `false` | hole | La branche DRAFT ne s'applique plus : un DRAFT rejete — le 'pas une decision' durable de l'operateur (ADR-0038) — est compte. Recette mesuree : mission init + ADR-0007 accepted + DRAFT-ADR-0010-rejec… |
| 304 | Regex | `/DRAFT-/i` | hole | Ancre ^ perdue : un nom d'ADR contenant 'draft-' en infixe est route dans la branche DRAFT. Recette mesuree : mission init + ADR-0007 accepted + ADR-0011-remove-draft-workflow.md ('**Status**: reject… |
| 305 | BlockStatement | `{}` | hole | Try vide : pas d'exception, pas de return, chute hors du bloc DRAFT sur le return true terminal — meme degenerescence que le mutant precedent par un autre chemin. Recette mesuree : mission init + ADR… |
| 306 | Regex | `/\s*(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | Sans ^, 'status: rejected' matche n'importe ou dans une ligne : un DRAFT hypothesis dont la prose mentionne un rejet amont est evince du compte. Recette mesuree : mission init + ADR-0007 accepted + D… |
| 306 | Regex | `/^\s(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | ^\s exige un blanc avant status. La sonde a d'abord montre que ce mutant SURVIT a la fixture evidente (ligne statut precedee d'une ligne vide : en mode m, \s mange le \n de la ligne vide et le match … |
| 306 | Regex | `/^\S*(?:\*\*status\*\*\|status)\s*:\s*reject…` | hole | ^\S* ne traverse plus une indentation : ' **Status**: rejected' indente n'est plus reconnu. Recette mesuree : mission init + ADR-0007 accepted + DRAFT-ADR-0013-rejected.md dont la ligne statut est in… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s:\s*rejecte…` | hole | \s: exige exactement un blanc entre status et le deux-points : la forme CANONIQUE du corpus '**Status**: rejected' (zero blanc avant :) ne matche plus, et l'alternative nue 'status' ne peut pas match… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\S*:\s*reject…` | hole | \S*: ne traverse plus un blanc avant le deux-points : '**Status** : rejected' (espace avant les deux-points — la typographie francaise, reelle dans ce corpus FR) n'est plus reconnu. Recette mesuree :… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\srejecte…` | hole | :\s exige exactement un blanc apres le deux-points : '**Status**:rejected' (colle) n'est plus reconnu. Recette mesuree : mission init + ADR-0007 accepted + DRAFT-ADR-0015-rejected.md portant '**Statu… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\S*reject…` | hole | :\S* ne peut pas traverser l'espace apres le deux-points : la forme CANONIQUE '**Status**: rejected' (un espace) ne matche plus — meme casse de la convention maison que le mutant \s: cote gauche. Rec… |
| 306 | StringLiteral | `""` | equivalent | readFileSync(p, '') : l'encodage chaine vide est falsy, Node rend un Buffer (verifie : Buffer.isBuffer = true, pas de throw). RegExp.test coerce son argument via String(buf) = buf.toString(), dont l'… |
| 308 | BlockStatement | `{}` | equivalent | Flux de controle : ce catch est la derniere instruction du bloc if (/^DRAFT-/), et l'instruction suivante du corps du filtre est le return true terminal (dist/lib/conformance.js:304-315, rien entre l… |
| 309 | BooleanLiteral | `false` | hole | Le catch de la branche DRAFT repond desormais 'exclu' : un DRAFT illisible disparait du total tout en restant dans la liste a ratifier (unratifiedAdrs, non mute, le pousse via son propre catch). Rece… |
| 318 | Regex | `/[\w./-]+\.(?:ts\|tsx\|js\|jsx\|mjs\|cjs\|py\|md\|j…` | hole | ya?ml → yaml : l'extension .yml sort de PATH_TOKEN — mesure fonction : evidencePathTokens('code/config/triage-rules.yml — moved') = [] en mute contre ['code/config/triage-rules.yml'] en livre ('.yaml… |

### parseRuleMeta — 16 survivor(s): 10 hole · 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 42 | StringLiteral | `"Stryker was here!"` | equivalent | Le fallback ne s'exerce que sur un fichier de règle SANS frontmatter. fm n'a que trois consommateurs, les trois match impact/phases/signature ; le littéral « Stryker was here! » ne contient aucune de… |
| 43 | MethodExpression | `fm.match(/^impact:\s*(.+)$/m)?.[1] ?? ""` | hole | RECETTE : mission example, une règle architect (contracts-governance.md) porte « impact: CRITICAL » suivi d'UN espace de fin de ligne (geste d'éditeur banal), lock re-signé. MESURÉ : build livré → « … |
| 43 | Regex | `/impact:\s*(.+)$/m` | hole | Sans ^, match() prend la PREMIÈRE occurrence de « impact: » dans tout le frontmatter, y compris en milieu de ligne. RECETTE : mission example, contracts-governance.md reçoit avant sa ligne impact une… |
| 43 | Regex | `/^impact:\s*(.+)/m` | equivalent | $ est redondant derrière (.+) glouton : en JS le point exclut les terminateurs de ligne (\n ET \r), donc (.+) s'étend exactement jusqu'à la position où $ multiline réussit toujours — aucun backtracki… |
| 43 | Regex | `/^impact:\s(.+)$/m` | hole | \s exige exactement un blanc là où \s* en accepte zéro. RECETTE : mission example, contracts-governance.md porte « impact:CRITICAL » sans espace après les deux-points — forme que le parseur livré ACC… |
| 43 | Regex | `/^impact:\S*(.+)$/m` | hole | Même porte que le mutant \s mais par l'autre bord : sur « impact: CRITICAL » \S* matche vide devant l'espace (identique), mais sur « impact:CRITICAL » \S* glouton avale la valeur et le backtracking l… |
| 43 | StringLiteral | `"Stryker was here!"` | equivalent | Le fallback ne s'exerce que sur une règle SANS ligne impact. parseRuleMeta est privé au module : impact n'a qu'UN consommateur, le test impact === "CRITICAL" \|\| impact === "HIGH" d'expectedRules (rul… |
| 44 | Regex | `/phases:\s*\[(.*)\]/m` | hole | Sans ^, la première occurrence de « phases: [...] » gagne, même en milieu de ligne. RECETTE : mission example, contracts-governance.md reçoit avant sa ligne phases la ligne « reviewNote: rollout phas… |
| 44 | Regex | `/^phases:\s\[(.*)\]/m` | hole | \s exige un blanc que \s* n'exige pas. RECETTE : mission example, contracts-governance.md porte « phases:[architect] » sans espace — accepté par le parseur livré, lock re-signé. MESURÉ : livré → mapp… |
| 44 | StringLiteral | `"Stryker was here!"` | equivalent | Le fallback ne s'exerce que sur une règle SANS ligne phases ; phases devient alors ["Stryker was here!"] au lieu de []. L'unique consommateur est phases.includes(phaseId) dans expectedRules, et phase… |
| 45 | MethodExpression | `phasesRaw.split(",").map(s => s.trim())` | equivalent | Retirer filter(Boolean) ne peut qu'AJOUTER des entrées "" à phases (phases: [] → [""], virgule traînante → ["architect",""]). L'unique consommateur est phases.includes(phaseId) avec phaseId parmi les… |
| 46 | MethodExpression | `fm.match(/^signature:\s*(.+)$/m)?.[1] ?? ""` | hole | La signature est une SOURCE de regex (ADR-0020) : un blanc final non trimé devient un espace littéral exigé dans la preuve. RECETTE : mission example, frontier-deterministic-boundary.md (règle signée… |
| 46 | Regex | `/signature:\s*(.+)$/m` | hole | Sans ^, la première occurrence de « signature: » dans le frontmatter gagne. RECETTE : mission example, frontier-deterministic-boundary.md reçoit avant sa ligne signature la ligne « reviewNote: the si… |
| 46 | Regex | `/^signature:\s*(.+)/m` | equivalent | Même identité que le mutant jumeau sur impact : $ est redondant derrière (.+) glouton, le point JS excluant \n et \r, la position finale de (.+) est exactement celle où $ multiline réussit toujours —… |
| 46 | Regex | `/^signature:\s(.+)$/m` | hole | La pire direction : le gate devient silencieux. RECETTE : mission example, frontier-deterministic-boundary.md porte « signature:zzqx9 » sans espace, motif absent de la preuve citée — le gate livré do… |
| 46 | Regex | `/^signature:\S*(.+)$/m` | hole | Même recette que le jumeau \s (« signature:zzqx9 » sans espace, motif absent de la preuve), autre mécanique : \S* glouton avale la valeur et le backtracking laisse à (.+) le dernier caractère — la si… |

### adrDecision — 13 survivor(s): 12 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 204 | Regex | `/ADR-0+(?:-\|\.md$)/i` | hole | Faux rouge réaliste. Sans ^, la détection du template matche la mention INTERNE "adr-0000-" dans un nom. Recette : ADR ratifié sain nommé `ADR-0005-retire-adr-0000-template.md` (un ADR dont le titre … |
| 204 | Regex | `/^ADR-0+(?:-\|\.md)/i` | hole | Faux rouge à footprint étroit. Sans $ après .md, un ".md" non final suffit. Recette : fichier `ADR-000.md.bak` (sauvegarde au contenu accepté réel de 40+ caractères), ligne deviated citant ADR-000 ; … |
| 204 | Regex | `/ADR-0+$/i` | hole | Faux rouge. Sans ^, le second disjoint matche tout nom strippé FINISSANT par "adr-0+". Recette : ADR ratifié sain `ADR-0006-supersede-adr-00.md` (titre finissant par la référence au template qu'il su… |
| 204 | Regex | `/^ADR-0$/i` | hole | FAUX VERT du gate, le classement le plus grave de ce lot avec 13 et 14. Le second disjoint garde exactement les noms tout-zéros SANS extension ; réduit à "ADR-0" exact, il ne garde plus ADR-00/000/00… |
| 204 | Regex | `/\.md/i` | hole | Faux rouge à footprint pathologique, mais mesuré. Le replace désancré supprime le PREMIER ".md" où qu'il soit. Recette : fichier `ADR-0.md00` au contenu accepté, deviated citant ADR-0 ; fixture .prob… |
| 204 | StringLiteral | `"Stryker was here!"` | equivalent | Équivalence par subsomption, prouvée puis balayée. Le texte de remplacement ne compte que si hit finit par ".md" ; or tout hit dont la forme strippée serait "ADR-0+" est de la forme "ADR-0+.md", déjà… |
| 213 | BlockStatement | `{}` | hole | Le verdict est remplacé par un crash. Recette : ADR `ADR-0008-locked.md` au contenu valide passé en chmod 000, cité par une ligne deviated (fixture .probe-5/fx/r-locked). Livré : exit 1 + la ligne op… |
| 214 | StringLiteral | `ˋˋ` | hole | FAUX VERT. La chaîne vide retournée par le catch est falsy : adrProblem la remonte et `if (why)` ne pousse aucune violation — un ADR ILLISIBLE satisfait la déviation. Recette identique au mutant préc… |
| 216 | MethodExpression | `text` | hole | FAUX VERT au cœur de la défense anti-fichier-vide. Recette : `ADR-0007-padded.md` = 60 caractères de blancs purs (longueur brute 60 >= ADR_MIN_CHARS=40, longueur trimée 0), cité par une ligne deviate… |
| 230 | Regex | `/(rejected\|superseded\|withdrawn\|obsolete)$/` | hole | Faux rouge à footprint étroit. Sans ^, tout mot de statut FINISSANT par un mot-clé devient mis de côté. Recette : ADR au `**Status**: unrejected` cité deviated ; fixture .probe-5/fx/g-unrejected, mes… |
| 230 | Regex | `/^(rejected\|superseded\|withdrawn\|obsolete)/` | hole | Faux rouge RÉALISTE. Sans $, un préfixe suffit : `**Status**: obsoleted` — variante anglaise réelle et courante — bascule. Recette : ADR ratifié par ailleurs sain au statut "obsoleted" cité deviated … |
| 231 | Regex | `/(proposed\|hypothesis\|draft\|pending)$/` | hole | Faux rouge à footprint étroit, jumeau du mutant 15 côté non-ratifié. Sans ^, tout mot finissant par proposed/hypothesis/draft/pending devient non ratifié. Recette : ADR au `**Status**: redraft` cité … |
| 231 | Regex | `/^(proposed\|hypothesis\|draft\|pending)/` | hole | Faux rouge RÉALISTE. Sans $, le préfixe "draft" matche `**Status**: drafting` — statut plausible d'une équipe réelle (comme "proposée" ne matche pas mais "drafted" matcherait aussi). Recette : ADR au… |

### conformance — 10 survivor(s): 6 hole · 1 equivalent · 3 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 356 | ConditionalExpression | `true` | equivalent | When floor is defined the two forms are identical; when EXPECTED_MAPPED[phaseId] is undefined the mutant evaluates 'expected.length < undefined', which is false for every n under JS relational semant… |
| 368 | StringLiteral | `""` | hole | The structural-fault line loses its scope label in all three surfaces an operator or a machine reads. RECIPE (2026-08-27): shipped example with a second '## Rule conformance' section pasted into floo… |
| 373 | Regex | `/\[.*\]$/` | hole | The placeholder skip /^\[.*\]$/ exists to exempt template rows like '[rule-slug]' from form-lint; dropping the '^' widens it to 'ends with ]', a strict superset, so REAL rows are silently exempted fr… |
| 373 | Regex | `/^\[.*\]/` | hole | The same superset in the other direction: dropping the '$' widens the placeholder skip to 'starts with [', which is exactly a rule cell written as a markdown link — the natural spelling for an operat… |
| 383 | StringLiteral | `ˋˋ` | hole | A remediation deleted from the verdict, which ADR-0046 files alongside a changed violation line. The '— removed in …' hint is the whole reason a corpus carries migrations.json (ADR-0057: an org's ren… |
| 384 | StringLiteral | `""` | hole | Same clause as the migrations hint, on the common case: the typo pointer. RECIPE (2026-08-27): shipped example + row '\| frontier-determistic-boundary \| applied \| file:code/src/demo.ts \|' (one letter … |
| 403 | ConditionalExpression | `false` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27). Forcing the ternary condition false kills the empty-status branch: MEASURED on a floor.md with one scaffolded row '\| config-secrets-boundary … |
| 403 | StringLiteral | `"Stryker was here!"` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27). readManifest lowercases every status on the way in, so row.status can never equal 'Stryker was here!' (capital S) and the comparison is const… |
| 404 | StringLiteral | `""` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27). The branch keeps firing but carries an empty problem: MEASURED on the scaffolded-row fixture the violation renders as '✗ Floor · config-secre… |
| 408 | ConditionalExpression | `true` | hole | Forcing the applied-guard true makes EVERY valid-status row with an empty Evidence cell collect 'applied without an evidence pointer — put a file:line or a test in the Evidence column'. It cannot fli… |

### expectedRules — 6 survivor(s): 4 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 81 | ConditionalExpression | `false` | equivalent | rulesDir() garantit la post-condition : la branche mission n'est retournée que si existsSync(missionRules), sinon templates/rules du paquet — la garde ne s'exerce donc que si templates/rules du paque… |
| 82 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Même atteignabilité que la garde qu'il suit : ce return ne s'exécute que si templates/rules du paquet manque ET la mission n'a pas de rules/ — un paquet mutilé, hors de l'univers d'entrées (packaging… |
| 83 | MethodExpression | `readdirSync(dir).filter(f => f.endsWith(".m…` | hole | Le .sort() supprimé rend l'ordre d'expectedRules dépendant du filesystem (readdir n'est pas trié par contrat — ext4 le rend en ordre de hash ; compliance.readRules trie explicitement « pour l'invaria… |
| 83 | MethodExpression | `readdirSync(dir)` | hole | Sans le filtre .md, expectedRules lit TOUTE entrée du dossier rules/. RECETTE 1 : mission example, sauvegarde d'opérateur contracts-governance.md.bak à côté de la règle (le mécanisme corpus l'ignore … |
| 84 | StringLiteral | `""` | hole | endsWith("") est toujours vrai : le filtre devient un no-op, comportement mesuré identique au retrait pur du filtre. Mêmes recettes, re-mesurées sous CE mutant : contracts-governance.md.bak dans rule… |
| 89 | Regex | `/\.md/` | hole | Sans ancre, replace retire la PREMIÈRE occurrence de « .md » au lieu de l'extension : un nom à « .md » infixe change de slug. RECETTE : mission example, règle a.mdx.md (HIGH, architect — nom légal qu… |

### (top level) — 5 survivor(s): 1 hole · 4 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 11 | StringLiteral | `""` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27, mutant applied to a package-shaped copy of dist inside an isolated worktree, never to the sources). The mutant empties the Architect entry's l… |
| 12 | StringLiteral | `""` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27). Measured on the shipped example: '✓ Topology: 4 rule(s) accounted for' becomes '✓ : 4 rule(s) accounted for' (exit code unchanged), and the l… |
| 14 | StringLiteral | `""` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27). Measured on the shipped example: '✓ Govern: 12 rule(s) accounted for' becomes '✓ : 12 rule(s) accounted for' (exit code unchanged; the label … |
| 15 | StringLiteral | `""` | defence-in-depth | KILLED BY THE smoke LEG, verified by replay (2026-08-27). Measured on the shipped example: '✓ Handover: 4 rule(s) accounted for' becomes '✓ : 4 rule(s) accounted for' (exit code unchanged; the label … |
| 17 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | The gate-side twin of the compliance anchor survivor (compliance-top-level.json, key 30\|21\|30\|50), re-probed here on conformance.ts's own FRONTMATTER because this copy feeds parseRuleMeta — expectedR… |

### trivialReason — 5 survivor(s): 4 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 24 | MethodExpression | `s` | equivalent | Divergence réelle au niveau fonction, mesurée en extrayant les deux formes : trivialReason(" because ") = true livré / false muté (non trimé : longueur 11 >= 8, et le test crochets est désancré par l… |
| 25 | Regex | `/\[.*\]$/` | hole | Faux rouge réaliste. Recette : examples/request-triage, une seule ligne d'architecture.md changée en `\| hexa-typescript-native \| n/a \| language locked at floor kickoff [ADR-0004] \|` (fixture .probe-5… |
| 25 | Regex | `/^\[.*\]/` | hole | Faux rouge symétrique du précédent, côté préfixe. Recette : même mission, raison n/a `[deferred] language locked at floor kickoff` (fixture .probe-5/fx/g-brack-start) ; mesuré : livré exit 0, muté ex… |
| 37 | EqualityOperator | `new Set(t.toLowerCase().replace(/\s/g, ""))…` | hole | La borne du correctif de dégénérescence lexicale n'est pas épinglée. Recette : raison n/a `test test` (9 caractères, exactement 3 caractères distincts t/e/s — le plancher que le commentaire du code d… |
| 37 | MethodExpression | `t.toUpperCase()` | hole | Pas équivalent, contrairement à l'intuition : la casse-pliage n'est pas bijective en Unicode. Mécanisme mesuré : "ßxs ßxs ßxs".toLowerCase() -> Set {ß,x,s} taille 3 (passe) ; .toUpperCase() -> "SSXS.… |

### ruleSignatures — 4 survivor(s): 1 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 57 | ConditionalExpression | `false` | equivalent | Argued with a measured sensitivity control, not supposed. On every reachable input the guard is dead code: rulesDir() returns the mission's runward/rules only when existsSync says it exists, else the… |
| 63 | StringLiteral | `"Stryker was here!"` | equivalent | The initializer is dead on every path, and the only path that could expose it was probed. The try's single statement either assigns sig — parseRuleMeta always returns a string signature, '(fm.match(.… |
| 67 | BlockStatement | `{}` | equivalent | When the read throws, sig still holds its initializer "" — the assignment never completed — so control falling out of the emptied catch reaches 'if (sig)' with a falsy value and the file is skipped: … |
| 71 | Regex | `/\.md/` | hole | RWD-2026-0082's territory: a mutant that falsifies the signature-map keying and extinguishes the regex screen. The unanchored replace cuts the FIRST '.md' out of the filename instead of the extension… |

### adrFilename — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 178 | ConditionalExpression | `false` | hole | La garde 'pas de runward/adr/' saute : adrFilename passe de null a un throw ENOENT (mesure au niveau fonction sur un missionDir sans adr/). Surface : collectSealableEvidence, donc le digest d'attesta… |
| 183 | ConditionalExpression | `true` | hole | Le predicat toujours vrai fait resoudre TOUTE citation adr: vers le premier fichier du dossier — mesure : adrFilename('ADR-0003') = ADR-0001-single-orchestrator.md. C'est exactement le trou que cette… |
| 183 | LogicalOperator | `u.startsWith(u0) \|\| !/[0-9]/.test(u.charAt(…` | hole | Avec \|\|, tout fichier dont le caractere a la position len(id) n'est pas un chiffre matche ('ADR-0002-...'.charAt(8) = '-') : le premier dirent gagne pour n'importe quel id — mesure : adrFilename('ADR… |

### allRules — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 95 | ConditionalExpression | `false` | equivalent | Copie exacte de la garde d'expectedRules, même post-condition de rulesDir : dir est soit le rules/ de la mission (existence vérifiée par rulesDir), soit templates/rules du paquet (embarqué par « file… |
| 96 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Le plus étanche des quatre mutants de garde : atteignable seulement sur le même état corrompu (paquet sans templates/rules ET mission sans rules/), et MÊME LÀ, mesuré octet pour octet identique — l'u… |
| 97 | Regex | `/\.md/` | hole | Même mécanique que son jumeau d'expectedRules mais sur l'UNIVERS des slugs connus (le contrôle « unknown rule »). RECETTE : la même mission cli-infix (règle a.mdx.md HIGH/architect, ligne n/a « a.mdx… |

### adrStatusWord — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 238 | Regex | `/[a-zà-ÿ]+/` | hole | Sans l'ancre, le mot de statut est pêché n'importe où dans la ligne au lieu du premier mot. Mesuré par la fonction : '**Status**: (proposed — pending ratification)' rend '' (livré) vs 'proposed' (mut… |

### driftReport — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 344 | MethodExpression | `tokens.every(t => resolveEvidencePath(t, ba…` | hole | Drift (ADR-0004, blocking under --strict since ADR-0021) refuses an applied prose row when NO cited path resolves; the mutant refuses when ANY cited path fails — a false red on prose that tells the t… |

### evidencePathTokens — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 321 | ArrayDeclaration | `["Stryker was here"]` | hole | The classic sentinel-array mutant, and it is NOT equivalent: the sentinel is fed to path resolution. evidencePathTokens' two consumers (evidence.js: the ADR-0019 non-vacuity loop over EVERY row, and … |

## Module: mission

Survivors: 65

Holes: 36 · Equivalent: 17 · Display-only: 3 · Defence-in-depth: 9

### readReopeningTriggers — 14 survivor(s): 10 hole · 2 equivalent · 2 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 195 | MethodExpression | `readdirSync(adrDir).filter(f => isRealAdr(f…` | hole | Le .sort() retiré, l'ordre de la veille devient l'ordre readdir de l'hôte, alors que le code promet 'sorted by filename (deterministic)' et que status n'affiche que les 8 premiers déclencheurs (CAP) … |
| 195 | MethodExpression | `readdirSync(adrDir)` | hole | Le filtre isRealAdr retiré de la boucle, tout .md nommé ADR-* est lu, y compris sous le plancher ADR_MIN_CHARS=40 que TOUT le reste du système refuse ('an empty file is not a decision'). Recette : AD… |
| 200 | BlockStatement | `{}` | equivalent | Le catch vidé ferait tomber l'exécution sur adrStatusLine(text) avec text undefined (TypeError, crash de runward status) SI on l'atteignait ; il est inatteignable : chaque f de la boucle a déjà passé… |
| 205 | Regex | `/accepted\b/i` | hole | L'ancre ^ retirée de /^accepted\b/i, 'accepted' se cherche n'importe où dans la ligne de statut : un ADR ÉCARTÉ dont la ligne mentionne le mot entre en vigueur. Recette : ADR-0013-superseded.md, '**S… |
| 209 | Regex | `/##\s+Reevaluation trigger/m` | hole | L'ancre ^ retirée de la recherche du titre, une simple MENTION de '## Reevaluation trigger' en milieu de ligne vaut section. Recette : ADR-0020-inline-mention.md, accepté, SANS section, dont le Conte… |
| 209 | Regex | `/^##\sReevaluation trigger/m` | hole | \s+ devient \s dans /^##\s+Reevaluation trigger/ : un titre markdown légal à deux espaces ('## Reevaluation trigger') cesse d'être reconnu. Recette : ADR-0019-twospace-heading.md ; runward status pas… |
| 214 | Regex | `/[^\n]*\n/` | equivalent | replace avec regex non-globale remplace l'occurrence LA PLUS À GAUCHE ; [^\n]* pouvant commencer, même vide, à l'indice 0, la première occurrence de [^\n]*\n commence à 0 dès qu'un \n existe : exacte… |
| 215 | Regex | `/##\s/m` | hole | L'ancre ^ retirée de la borne de fin de section /^##\s/, un '## ' en MILIEU de ligne de la prose devient la fin de section. Recette : ADR-0021-midline-hashes.md, prose '- Reopen if the "## Context" h… |
| 217 | Regex | `/\*\*Trigger set on\*\*:\s(\d{4}-\d{2}-\d{2…` | hole | \s* devient \s dans la lecture de la date : la graphie '**Trigger set on**:2026-04-04' (zéro espace après le deux-points) cesse de livrer sa date. Recette : ADR-0027-seton-nospace.md ; runward status… |
| 221 | MethodExpression | `l` | hole | Le trim retiré du map, les lignes de la section gardent blancs et indentation avant le filtre length>0 : une ligne d'espaces devient la 'première prose'. Recette : ADR-0025-indent-prose.md (ligne de … |
| 222 | Regex | `/\*\*Trigger set on\*\*/` | hole | L'ancre ^ retirée du filtre anti-métadonnée, toute prose CONTENANT '**Trigger set on**' est éliminée de l'aperçu au lieu des seules lignes de métadonnée. Recette : ADR-0026-seton-mention.md, déclench… |
| 223 | StringLiteral | `"Stryker was here!"` | hole | Le repli '' devient 'Stryker was here!' quand une section déclencheur n'a aucune ligne de prose (section vide ou réduite à sa ligne set-on). Recette : ADR-0022-emptysection.md (section portant seulem… |
| 224 | MethodExpression | `prose.slice(0, TRIGGER_PREVIEW_MAX - 1).tri…` | display-only | Écart atteignable unique : du blanc conservé devant le marqueur de troncature. trimStart est un no-op à gauche (chaque ligne de prose est déjà trim()ée par le map en amont : jamais de blanc de tête d… |
| 226 | MethodExpression | `preview.startsWith("…")` | display-only | endsWith devient startsWith : un aperçu ne peut jamais commencer par '…' (la prose est trim()ée non vide ; une section sans prose donne preview '' mais alors proseLines.length > 1 est faux), donc la … |

### artifactState — 11 survivor(s): 3 hole · 8 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 138 | MethodExpression | `readdirSync(path)` | hole | RECETTE : mission exemple (init --example) dont runward/contracts/ ne contient plus aucun .md mais un seul notes.txt de prose (fixture fxc2), puis 'node dist/cli.js check --strict'. MESURÉ avant/aprè… |
| 138 | StringLiteral | `""` | hole | endsWith("") est vrai pour tout nom : sémantique observable identique au mutant précédent (filtre supprimé), et MESURÉ identique — fxc2 (contracts/ sans .md, un notes.txt) : check --strict EXIT 1 -> … |
| 139 | ConditionalExpression | `false` | equivalent | Le retour anticipé 'untouched' sur liste vide devient inatteignable, mais la chute donne le même résultat : [].some(...) est false par définition du langage, donc hasFilled=false et le même littéral … |
| 149 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Occurrence 1 : le plancher placeholders de la branche templateKey. Le repli ne joue que si match est null (zéro placeholder) ; .length passe de 0 à 1, tous deux < 3, la garde de divergence prend la m… |
| 156 | ConditionalExpression | `true` | equivalent | filter(() => true) est sémantiquement le filtre supprimé : mêmes lignes vides (trimées) conservées que pour le mutant MethodExpression de la même ligne. Même argument, mêmes mesures : '' est absorbée… |
| 156 | EqualityOperator | `l.length >= 0` | equivalent | length >= 0 est une tautologie sur toute chaîne : prédicat toujours vrai, donc troisième forme du même mutant 'filtre inerte' que les deux précédents sur cette ligne. Même absorption de '' par templa… |
| 156 | MethodExpression | `s.split("\n").map(l => l.trim())` | equivalent | Supprimer le filtre garde les lignes vides (après trim) dans lines(). Côté template : '' entre dans templateLines. Côté contenu : chaque ligne vide ajoutée est alors absorbée par templateLines.has(''… |
| 156 | MethodExpression | `l` | hole | Sans trim, la comparaison contenu/template se fait sur lignes BRUTES : une ligne qui n'a changé que d'espaces compte comme 'nouvelle'. RECETTE : mission exemple verte ; remplacer runward/decision-mat… |
| 159 | MethodExpression | `l.split(/\s+/)` | equivalent | Les éléments de added sortent de lines(), donc sont trimés et non vides PAR CONSTRUCTION (le mutant s'applique seul ; la ligne lines() garde son trim et son filtre). Or split(/\s+/) sur une chaîne qu… |
| 159 | Regex | `/\s/` | equivalent | /\s/ au lieu de /\s+/ ne diffère que sur les blancs CONSÉCUTIFS : chaque blanc supplémentaire produit un jeton vide de plus — que le filter(Boolean), conservé par ce mutant, élimine. Le multiset des … |
| 164 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Occurrence 2 : le test placeholders du chemin SANS templateKey — chemin vivant, c'est celui que le pack compliance emprunte (govState passe {label, relPath} sans templateKey ; adr/ et contracts/ reto… |

### (top level) — 9 survivor(s): 8 hole · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 9 | StringLiteral | `""` | hole | templateKey vidé = falsy : artifactState saute la comparaison au template ET le plancher de divergence (added<3 \|\| addedWords<20) ; seul le comptage de placeholders répond. Recette : mission verte (c… |
| 10 | StringLiteral | `""` | hole | Même mécanisme que le mutant framing : templateKey falsy → ni détection raw-template ni plancher de divergence pour le Steering contract. Deux mesures. (1) Mission fraîche (runward init) : state de c… |
| 16 | StringLiteral | `""` | hole | templateKey falsy sur l'Architecture note. Mesures : mission fraîche, check --json : untouched → in-progress/placeholders (le scaffold brut annoncé « placeholders remain » au lieu de « raw template »… |
| 17 | StringLiteral | `""` | hole | Le pire des neuf survivants PHASES : le template d'execution-topology ne porte QUE 1 placeholder, donc sans templateKey le fallback (≥3 placeholders sinon filled) déclare le SCAFFOLD BRUT rempli. Mes… |
| 18 | StringLiteral | `""` | defence-in-depth | Le mutant est réel et grave hors filet — mesuré : template decision-matrix à 0 placeholder, donc mission fraîche check --json : untouched → filled (gaps 13→12) ; exemple avec matrix brute : `check` e… |
| 30 | StringLiteral | `""` | hole | templateKey falsy sur le Threat model (33 placeholders au template). Mesures : mission fraîche, check --json : untouched → in-progress/placeholders (cause fausse sur scaffold brut) ; mission verte av… |
| 31 | StringLiteral | `""` | hole | Même trou que le Threat model, sur l'Evaluation rubric (26 placeholders). Mesuré : mission fraîche, check --json : untouched → in-progress/placeholders ; mission verte avec governance/evaluation-rubr… |
| 32 | StringLiteral | `""` | hole | templateKey falsy sur l'Observability schema (27 placeholders). Mesuré : mission fraîche, check --json : untouched → in-progress/placeholders ; mission verte avec governance/observability-schema.md =… |
| 38 | StringLiteral | `""` | hole | templateKey falsy sur le Recovery runbook — le template le plus riche (50 placeholders), donc le plus « évidable ». Mesuré : mission fraîche, check --json : untouched → in-progress/placeholders ; mis… |

### analyze — 8 survivor(s): 1 hole · 7 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 171 | ArrowFunction | `() => undefined` | defence-in-depth | every(() => undefined) est faux sur toute phase (chacune a ≥1 artefact) : complete=false partout, donc sur la mission exemple currentPhase retombe à '1 · Frame' au lieu de 'all gates passed' et stead… |
| 171 | ConditionalExpression | `false` | defence-in-depth | every((a) => false) : identique au précédent — complete=false partout (mesuré : analyze ex 11111->00000, currentPhase 'all gates passed'->'1 · Frame', steady true->false). TUÉ PAR LA JAMBE SMOKE, VÉR… |
| 171 | MethodExpression | `artifacts.some(a => a.state === "filled")` | hole | Une phase devient 'complete' dès qu'UN artefact est rempli. RECETTES MESURÉES (3 surfaces) : (1) scaffold + framing.md rempli, mission-contract.md vierge (fxsome) : check 'Current gate 1 · Frame' -> … |
| 171 | StringLiteral | `""` | defence-in-depth | Aucun état ne vaut "" (le type est missing/untouched/in-progress/filled), donc la comparaison est toujours fausse : troisième forme du même effondrement complete=false partout (mesuré identique : ex … |
| 173 | StringLiteral | `""` | defence-in-depth | join(missionDir, "") = missionDir : adrCount compte les fichiers ADR-* à la RACINE de la mission, où il n'y en a aucun (mesuré : analyze ex adr 3->0 ; scaffold 0->0). La ligne 'ADRs N' de check et le… |
| 175 | ArrowFunction | `() => undefined` | defence-in-depth | filter(() => undefined) vide la liste : adrCount=0 partout (mesuré : analyze ex adr 3->0). Effet inverse du précédent, même surface (ligne 'ADRs' de check, adrCount du --json). TUÉ PAR LA JAMBE SMOKE… |
| 175 | MethodExpression | `readdirSync(adrDir)` | defence-in-depth | Sans le filtre isRealAdr, adrCount compte le template scaffoldé ADR-0000-template.md et n'importe quel fichier vide — la défense anti-fichier-vide saute pour ce compte (mesuré : scaffold adr 0->1, le… |
| 181 | StringLiteral | `""` | defence-in-depth | Sur mission steady, currentPhase devient la chaîne vide : la ligne 'Current gate' de check s'imprime vide et le champ currentGate du contrat --json (ADR-0030) se vide (mesuré : analyze ex gate 'all g… |

### adrStatusLine — 7 survivor(s): 4 hole · 2 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 84 | MethodExpression | `text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)…` | display-only | Le seul écart atteignable est du blanc de fin dans une cellule. Sonde fonction : adrStatusLine('**Status**: accepted ') rend 'accepted ' au lieu de 'accepted' ; le cas CRLF ne diverge pas (mesuré : '… |
| 84 | OptionalChaining | `text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)…` | equivalent | Le chaînage optionnel court-circuite la chaîne ENTIÈRE : dans text.match(...)?.[1].trim(), si match rend null, ?. saute aussi le .trim(), aucun TypeError (mesuré sur la forme mutée : 'no status here'… |
| 84 | Regex | `/\*\*Status\*\*\s*:\s*(.+)$/mi` | hole | L'ancre ^ retirée, la ligne de statut se lit n'importe où dans une ligne et sur la PREMIÈRE occurrence du fichier. Deux bascules mesurées. (1) Statut indenté ' **Status**: accepted' : livré le lit ''… |
| 84 | Regex | `/^\*\*Status\*\*\s*:\s*(.+)/mi` | equivalent | $ après (.+) glouton est redondant : '.' exclut les terminateurs de ligne, donc le glouton s'étend exactement jusqu'à la fin de ligne, position où $ (multiline) réussit toujours ; jamais de backtrack… |
| 84 | Regex | `/^\*\*Status\*\*\s*:\s(.+)$/mi` | hole | \s* devient \s après le deux-points : la graphie '**Status**:accepted' (zéro espace) cesse d'être lue ('' au lieu de 'accepted'). C'est la classe RWD-2026-0084 ressuscitée en miroir : le correctif a … |
| 84 | Regex | `/^\*\*Status\*\*\s*:\S*(.+)$/mi` | hole | \s* devient \S* après le deux-points : sur '**Status**:accepted', \S* glouton avale 'accepte' et (.+) capture 'd'. Mesuré : la cellule du pack ISO passe de 'accepted' à 'd' PENDANT que le compte rest… |
| 84 | StringLiteral | `"Stryker was here!"` | hole | Le repli '' devient 'Stryker was here!' pour tout ADR sans ligne **Status**. Mesuré : runward compliance passe de '17 ratified ADR(s) · 3 not ratified' à '18 · 2', parce que le mot dérivé 'stryker' n… |

### isRealAdr — 7 survivor(s): 5 hole · 1 equivalent · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 88 | ConditionalExpression | `false` | defence-in-depth | Le test de NOM est débranché : tout fichier ≥40 chars trimmed dans adr/ devient une décision — y compris ADR-0000-template.md (2644 octets), écrit par runward lui-même. Dégâts mesurés hors filet : mi… |
| 98 | ConditionalExpression | `false` | hole | Garde isFile débranchée ; trou à empreinte étroite (déni de verdict, pas faux vert), dit tel quel. Sur le voisin réaliste — un RÉPERTOIRE nommé ADR-0001-x.md — les deux formes coïncident, mesuré : re… |
| 99 | BooleanLiteral | `true` | hole | Le return de la garde isFile inversé : un NON-fichier au nom d'ADR devient une décision SANS lecture — ni contenu, ni plancher de 40 chars. (Identification de l'occurrence : les trois `return false;`… |
| 100 | EqualityOperator | `readFileSync(abs, "utf8").trim().length > A…` | hole | Faux ROUGE au bord documenté — la direction qui éteint un gate en refusant l'honnête. ADR_MIN_CHARS = 40 est le plancher déclaré ; le mutant refuse le fichier qui le touche exactement. Mesuré en fonc… |
| 100 | MethodExpression | `readFileSync(abs, "utf8")` | hole | Le fichier de BLANCS — exactement la classe que la campagne conformance a documentée sur adrDecision, ici côté présence. Sans trim, la longueur BRUTE décide : 46 octets d'espaces (trimmed 0) passent … |
| 102 | BlockStatement | `{}` | equivalent | Équivalent, argumenté avec contrôle de sensibilité et mesuré. Le catch vidé fait tomber la fonction en fin de corps : retour undefined au lieu de false, sur les seuls chemins qui jettent (EACCES, cou… |
| 103 | BooleanLiteral | `true` | hole | Le catch inversé : fail-OPEN sur l'illisible. Quand la lecture jette, le livré répond « pas une décision » (fail-closed) ; le muté répond « décision ». Recette : mission verte dont adr/ = template + … |

### findMissionRoot — 4 survivor(s): 3 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 56 | EqualityOperator | `i <= 128` | hole | Trou à portée minime, dit tel quel — et dans le sens d'un comportement PLUS juste que le livré. Divergence mesurée en fonction directe : mission au 127e ancêtre du cwd → identique ; au 128e ancêtre e… |
| 56 | UpdateOperator | `i--` | hole | Même famille que le mutant de borne, en version « cap supprimé ». i-- rend la condition i<128 toujours vraie mais ne crée JAMAIS de boucle infinie : le break racine tient (dirname est purement lexica… |
| 59 | StringLiteral | `""` | hole | Trou RÉALISTE : le marqueur de mission devient « un répertoire runward/ existe » (join(dir,"runward","") = dir/runward) au lieu de « runward/framing.md existe » — précisément la distinction que le co… |
| 62 | ConditionalExpression | `false` | equivalent | Équivalent, argumenté et mesuré. Le break racine devient inatteignable, mais la boucle plafonnée rend le même résultat sur toute entrée : dirname est une fonction lexicale pure et monotone — tout che… |

### inProgressCause — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 117 | BlockStatement | `{}` | equivalent | Le catch mute couvre le readFileSync interne d'inProgressCause, qui n'est atteint qu'APRÈS que artifactState(missionDir, a) a retourné 'in-progress' — donc après que artifactState a lui-même lu le mê… |
| 122 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Le repli [] ne sert que quand content.match(PLACEHOLDER) est null, c'est-à-dire zéro placeholder ; le tableau n'est consommé que par .length, comparé à 3. Original : 0 >= 3 = false ; muté : 1 >= 3 = … |
| 122 | EqualityOperator | `(content.match(PLACEHOLDER) \|\| []).length >…` | hole | RECETTE : mission scaffold (runward init) dont runward/floor.md et governance/threat-model.md contiennent EXACTEMENT 3 placeholders ([le p99]…) plus de la prose divergente (fixture fxph3). artifactSt… |

### isRealAdrName — 2 survivor(s): 1 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 76 | Regex | `/ADR-\d+/` | hole | Ancre ^ perdue : tout nom .md CONTENANT « ADR-<chiffre> » devient un ADR. Divergences mesurées en fonction directe : notes-on-ADR-0001.md, DRAFT-ADR-0009-x.md, supersedes-ADR-2.md, xADR-1.md — tous f… |
| 76 | Regex | `/^ADR-\d/` | equivalent | Équivalent, formellement et par mesure. Sous .test(), /^ADR-\d+/ et /^ADR-\d/ acceptent exactement le même langage : l'acceptation ne dépend que des positions 0-4 (« ADR- » puis UN chiffre) ; le + n'… |
