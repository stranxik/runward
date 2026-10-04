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

**A measurement is one pass or both, and saying which is part of the result.** On 2026-09-01 a
whole-perimeter run of pass 1 was read as though it were the whole measurement: `sarif` retired zero
survivors after its shape check had been extended, and the conclusion drawn was that the schema leg
sits outside the mutation net. It does not — it is `sarif-shape` in the list of legs above, added on
2026-08-27 for exactly this reason. What sat outside was the *pass that runs it*, which nobody had
re-run. A pass-1 number compared against a net that lives in pass 2 measures nothing about that net,
and publishing it as if it did is the same class of error as reading a corpus as a specification.

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

## Module: mission

Survivors: 707

Holes: 671 · Equivalent: 24 · Display-only: 9 · Defence-in-depth: 3

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### STRUCTURE — 520 survivor(s): 514 hole · 6 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 181 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 184 | Regex | `/\S.*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 184 | Regex | `/^\S.*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 184 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 185 | Regex | `/(<\|<=\|>\|>=\|=)\s\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 185 | Regex | `/(<\|<=\|>\|>=\|=)\s*\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 185 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 187 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 187 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 188 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 189 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 190 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | BooleanLiteral | `cells[2]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | EqualityOperator | `cells[2] !== "—"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | EqualityOperator | `cells[2] !== "-"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | LogicalOperator | `(!cells[2] \|\| cells[2] === "—") && cells[2]…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | LogicalOperator | `!cells[2] && cells[2] === "—"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 191 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 192 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 196 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 198 | Regex | `/\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 198 | Regex | `/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 198 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 199 | Regex | `/(met\|partially-met\|not-met)\b/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 199 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 201 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 202 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 203 | Regex | `/\*\*(Metric\|Threshold \(success\))\*\*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 205 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 206 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 207 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 208 | Regex | `/\*\*Verdict\*\*\s:\s*([^·\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 208 | Regex | `/\*\*Verdict\*\*\S*:\s*([^·\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 208 | Regex | `/\*\*Verdict\*\*\s*:\s([^·\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 208 | Regex | `/\*\*Verdict\*\*\s*:\S*([^·\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 208 | Regex | `/\*\*Verdict\*\*\s*:\s*([^·\n])/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 208 | Regex | `/\*\*Verdict\*\*\s*:\s*([·\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 209 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 209 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 209 | MethodExpression | `v[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 209 | MethodExpression | `v[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 209 | Regex | `/met\b/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 209 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 211 | Regex | `/#{2,3} 3\. Gaps and deviations\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 211 | Regex | `/^#{2,3} 3\. Gaps and deviations\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 211 | Regex | `/^# 3\. Gaps and deviations\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 211 | Regex | `/^#{2,3} 3\. Gaps and deviations\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 211 | Regex | `/^#{2,3} 3\. Gaps and deviations\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 212 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 212 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 212 | EqualityOperator | `idx !== -1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 212 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 214 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 216 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 216 | Regex | `/#{1,6}\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 216 | Regex | `/^#\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 216 | Regex | `/^#{1,6}\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 218 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 219 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 219 | MethodExpression | `t.endsWith("\|")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 219 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 222 | ArrowFunction | `() => undefined` | display-only | Display-only, measured 2026-09-04: the whole `check --strict --json` payload is byte-identical on all three probe missions; the rendered text differs on `nu` only. The literal reaches the screen and … |
| 222 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 222 | MethodExpression | `cells.some(x => /^:?-+:?$/.test(x))` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 222 | Regex | `/:?-+:?$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 222 | Regex | `/^:?-+:?/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 222 | Regex | `/^:-+:?$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 222 | Regex | `/^:?-:?$/` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 222, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 222 | Regex | `/^:?-+:$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 224 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 224 | BooleanLiteral | `headerSeen` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 224 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | LogicalOperator | `x \|\| !/^\[[^\]]*\]$/.test(x)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | MethodExpression | `cells.every(x => x && !/^\[[^\]]*\]$/.test(…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 228 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 231 | MethodExpression | `v[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 231 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 241 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 243 | Regex | `/## The contract,.*sponsor$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 243 | Regex | `/^## The contract,.*sponsor/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 244 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 245 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 247 | Regex | `/\*+\|\*+$/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 247 | Regex | `/^\*+\|\*+/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 247 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 248 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | LogicalOperator | `value === "" && /^\[[^\]]*\]$/.test(value)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 249 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 251 | Regex | `/Engagements retained$/i` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 251 | Regex | `/^Engagements retained/i` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 253 | MethodExpression | `value` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | EqualityOperator | `(c[1] ?? "") !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | LogicalOperator | `(c[1] ?? "") === "" && /^\[[^\]]*\]$/.test(…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | LogicalOperator | `c[1] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | LogicalOperator | `c[1] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | MethodExpression | `rows` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 256 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 257 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 257 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 257 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 257 | EqualityOperator | `undecided.length <= rows.length` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 257 | EqualityOperator | `undecided.length >= rows.length` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | LogicalOperator | `c[0] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | MethodExpression | `undecided.map(c => (c[0] ?? "").replace(/\*…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | Regex | `/\*/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 258 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 268 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 271 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 272 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 273 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 273 | Regex | `/## 8\. Decisions\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 273 | Regex | `/^## 8\. Decisions\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 273 | Regex | `/^## 8\. Decisions\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 273 | Regex | `/^## 8\. Decisions\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 274 | LogicalOperator | `cells[1] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 274 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | EqualityOperator | `adrCell !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | LogicalOperator | `adrCell === "" && /^\[[^\]]*\]$/.test(adrCe…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 275 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 277 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 281 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 282 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 282 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 283 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 289 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 290 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 291 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 291 | Regex | `/## 3\. Ports\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 291 | Regex | `/^## 3\. Ports\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 291 | Regex | `/^## 3\. Ports\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 291 | Regex | `/^## 3\. Ports\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 292 | LogicalOperator | `cells[4] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 292 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | EqualityOperator | `spec !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | EqualityOperator | `spec !== "—"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | LogicalOperator | `(spec === "" \|\| /^\[[^\]]*\]$/.test(spec)) …` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | LogicalOperator | `spec === "" && /^\[[^\]]*\]$/.test(spec)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 293 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 295 | Regex | `/\[\|\]$/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 295 | Regex | `/^\[\|\]/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 295 | Regex | `/\)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 295 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 295 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 296 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 297 | MethodExpression | `spec` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 297 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 303 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 304 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 306 | BooleanLiteral | `existsSync(topoPath)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 306 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 306 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 308 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 309 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 309 | Regex | `/## 3\. Ports\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 309 | Regex | `/^## 3\. Ports\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 309 | Regex | `/^## 3\. Ports\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 309 | Regex | `/^## 3\. Ports\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | LogicalOperator | `cells[0] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | Regex | `/\*+\|\*+$/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | Regex | `/^\*\|\*+$/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | Regex | `/^\*+\|\*+/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | Regex | `/^\*+\|\*$/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 310 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | EqualityOperator | `port !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | LogicalOperator | `port === "" && /^\[[^\]]*\]$/.test(port)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 311 | StringLiteral | `"Stryker was here!"` | display-only | Display-only, measured 2026-09-04: the whole `check --strict --json` payload is byte-identical on all three probe missions; the rendered text differs on `optin` only. The literal reaches the screen a… |
| 313 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 314 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 321 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 325 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 326 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 327 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 330 | Regex | `/#{2,3} (?:\d+\. )?(?:The )?[Pp]ort → place…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 330 | Regex | `/^#{2,3} (?:\d+\. )?(?:The )?[Pp]ort → plac…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 330 | Regex | `/^#{2,3} (?:\d\. )?(?:The )?[Pp]ort → place…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 330 | Regex | `/^#{2,3} (?:\d+\. )?(?:The )?[Pp]ort → plac…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 330 | Regex | `/^#{2,3} (?:\d+\. )?(?:The )?[Pp]ort → plac…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 331 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 332 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 333 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 333 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 333 | StringLiteral | `""` | display-only | Display-only, measured 2026-09-04: the whole `check --strict --json` payload is byte-identical on all three probe missions; the rendered text differs on `optin` only. The literal reaches the screen a… |
| 333 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 333 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 334 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 335 | LogicalOperator | `cells[0] && ""` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 335, the machine payload of `check --strict --json` on the `declencheur` probe mission DIFFERS from the pristine build — the observable… |
| 335 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | ConditionalExpression | `false` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 336, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 336 | EqualityOperator | `port !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | LogicalOperator | `port === "" && /^\[[^\]]*\]$/.test(port)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/_e\.g\._/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/(…\|\.\.\.)$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | Regex | `/^(…\|\.\.\.)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 336 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 338 | LogicalOperator | `cells[2] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 338 | Regex | `/\*+/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 338 | Regex | `/^\*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 338 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 338 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | EqualityOperator | `family !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | LogicalOperator | `family === "" && /^\[[^\]]*\]$/.test(family)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 339 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 341 | BlockStatement | `{}` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 341, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 341 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 342 | MethodExpression | `family` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 342 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 344 | BlockStatement | `{}` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 344, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 344 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 344 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 345 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 347 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 348 | MethodExpression | `family` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 348 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 349 | ConditionalExpression | `false` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 349, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 349 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 350 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 361 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 364 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 366 | Regex | `/\*+/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 366 | Regex | `/^\*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 366 | StringLiteral | `"Stryker was here!"` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 366, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 366 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 367 | ConditionalExpression | `false` | display-only | Display-only, measured 2026-09-04: the whole `check --strict --json` payload is byte-identical on all three probe missions; the rendered text differs on `declencheur` only. The literal reaches the sc… |
| 367 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 369 | Regex | `/(default\|switched)\b/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 370 | MethodExpression | `pos` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 374 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 375 | StringLiteral | `""` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 375, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 376 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 377 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 377 | Regex | `/## Positions held\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 377 | Regex | `/^## Positions held\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 377 | Regex | `/^## Positions held\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 377 | Regex | `/^## Positions held\S*$/m` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 377, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 378 | LogicalOperator | `cells[1] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 378 | Regex | `/\*+/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 378 | Regex | `/^\*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 378 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 378 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 379 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 379 | Regex | `/switched\b/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 381 | LogicalOperator | `cells[2] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 381 | Regex | `/ADR-(\d)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 381 | Regex | `/ADR-(\D+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 381 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 382 | BooleanLiteral | `id` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 382 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 382 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 383 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 384 | BooleanLiteral | `adrIdExists(missionDir, ˋADR-${id[1]}ˋ)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 384 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 384 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 384 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 385 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 394 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 396 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 398 | MethodExpression | `sectionTableRows(content, /^#{2,3} 2\. Scor…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 398 | Regex | `/#{2,3} 2\. Scoring scale\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 398 | Regex | `/^#{2,3} 2\. Scoring scale\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 398 | Regex | `/^#{2,3} 2\. Scoring scale\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 398 | Regex | `/^#{2,3} 2\. Scoring scale\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | LogicalOperator | `(c[1] ?? "") !== "" \|\| !/^\[[^\]]*\]$/.test…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | LogicalOperator | `c[1] && ""` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 399, the machine payload of `check --strict --json` on the `declencheur` probe mission DIFFERS from the pristine build — the observable… |
| 399 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 399 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 400 | MethodExpression | `scores.every(c => /-?−?\d/.test(c[1] ?? ""))` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 400 | Regex | `/-?−\d/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 400 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 401 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 401 | EqualityOperator | `scores.length >= 0` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 403 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 403 | Regex | `/### Scenario /m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 404 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 405 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 405 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 405 | LogicalOperator | `!/\*\*Expected terms\*\*\s*:/.test(content)…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 405 | Regex | `/\*\*Expected terms\*\*\S*:/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 405 | Regex | `/\*\*Forbidden terms\*\*\S*:/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 406 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 415 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 417 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 419 | Regex | `/\*\*Carrier field\*\*\S*:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 419 | Regex | `/\*\*Carrier field\*\*\s*:\s([^\n]+)/` | display-only | Display-only, measured 2026-09-04: the whole `check --strict --json` payload is byte-identical on all three probe missions; the rendered text differs on `optin` only. The literal reaches the screen a… |
| 419 | Regex | `/\*\*Carrier field\*\*\s*:\S*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 420 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 420 | LogicalOperator | `carrier \|\| !/^\[/.test(carrier[1].trim())` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 420, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 420 | MethodExpression | `carrier[1]` | display-only | Display-only, measured 2026-09-04: the whole `check --strict --json` payload is byte-identical on all three probe missions; the rendered text differs on `nu` only. The literal reaches the screen and … |
| 420 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 421 | MethodExpression | `carrier[1].trim()` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 421 | MethodExpression | `carrier[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 423 | Regex | `/#{2,3} 5\. Cost ceilings\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 423 | Regex | `/^#{2,3} 5\. Cost ceilings\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 423 | Regex | `/^# 5\. Cost ceilings\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 423 | Regex | `/^#{2,3} 5\. Cost ceilings\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 423 | Regex | `/^#{2,3} 5\. Cost ceilings\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 424 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 424 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 424 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 424 | EqualityOperator | `idx === -1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 424 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 425 | MethodExpression | `content` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 425 | Regex | `/\n# /` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 426 | BooleanLiteral | `/\[[^\]]*\]/.test(block)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 426 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 426 | Regex | `/\[[^\]]\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 426 | Regex | `/\[[\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 426 | Regex | `/\D/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 427 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 436 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 439 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 441 | LogicalOperator | `cells[2] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 441 | Regex | `/\*+/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 441 | Regex | `/^\*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 441 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 441 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 443 | BooleanLiteral | `/^\[/.test(crit)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 443 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 443 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 443 | LogicalOperator | `crit \|\| !/^\[/.test(crit)` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 443, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 443 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 443 | Regex | `/(critical\|non-critical\|degraded)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 444 | MethodExpression | `crit` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 445 | LogicalOperator | `cells[3] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 445 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 448 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 448 | BooleanLiteral | `/^\[/.test(behaviour)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 448 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 448 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 448 | LogicalOperator | `behaviour \|\| !/^\[/.test(behaviour)` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 448, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 448 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 449 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 454 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 455 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 456 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 457 | Regex | `/#{2,3} 5\. Contacts\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 457 | Regex | `/^#{2,3} 5\. Contacts\s*/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 457 | Regex | `/^# 5\. Contacts\s*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 457 | Regex | `/^#{2,3} 5\. Contacts\s$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 457 | Regex | `/^#{2,3} 5\. Contacts\S*$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 458 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 458 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 458 | EqualityOperator | `rows.length !== 0` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | EqualityOperator | `x !== ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | LogicalOperator | `x === "" && /^\[[^\]]*\]$/.test(x)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | MethodExpression | `rows.some(c => c.every(x => x === "" \|\| /^\…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | MethodExpression | `c.some(x => x === "" \|\| /^\[[^\]]*\]$/.test…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | LogicalOperator | `c.length >= 4 \|\| c.slice(0, 4).every(x => x…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | LogicalOperator | `x !== "" \|\| !/^\[[^\]]*\]$/.test(x)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | MethodExpression | `rows.every(c => c.length >= 4 && c.slice(0,…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | MethodExpression | `c.slice(0, 4).some(x => x !== "" && !/^\[[^…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | MethodExpression | `c` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 463 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 464 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 474 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 476 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 478 | Regex | `/#{2,3} 2\. The redone task/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 479 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 479 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 481 | Regex | `/\n# /` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[^*]\*\*\s*:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[*]*\*\*\s*:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[^*]*\*\*\s:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[^*]*\*\*\S*:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[^*]*\*\*\s*:\s([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[^*]*\*\*\s*:\S*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 482 | Regex | `/\*\*Date[^*]*\*\*\s*:\s*([\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | BooleanLiteral | `/^\[/.test(dateLine[1].trim())` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | LogicalOperator | `dateLine \|\| !/^\[/.test(dateLine[1].trim())` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 483, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 483 | MethodExpression | `dateLine[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | Regex | `/\d-\d{2}-\d{2}/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 483 | Regex | `/\d{4}-\d{2}-\d/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 486 | Regex | `/\*\*Evidence\*\*\s:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 486 | Regex | `/\*\*Evidence\*\*\S*:\s*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 486 | Regex | `/\*\*Evidence\*\*\s*:\s([^\n]+)/` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 486, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists a… |
| 486 | Regex | `/\*\*Evidence\*\*\s*:\S*([^\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 486 | Regex | `/\*\*Evidence\*\*\s*:\s*([\n]+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 487 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 487 | BooleanLiteral | `/^\[/.test(evidence[1].trim())` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 487 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 487 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 487 | LogicalOperator | `evidence \|\| !/^\[/.test(evidence[1].trim())` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 487, the machine payload of `check --strict --json` on the `optin` probe mission DIFFERS from the pristine build — the observable exist… |
| 487 | MethodExpression | `evidence[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 487 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 488 | MethodExpression | `evidence[1].trim()` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 488 | MethodExpression | `evidence[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 488 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 495 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 496 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 497 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 498 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 499 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 500 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 501 | LogicalOperator | `x && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 501 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | EqualityOperator | `a !== null` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 502 | MethodExpression | `answers.every(a => a === null)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 505 | LogicalOperator | `cells[4] && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 505 | MethodExpression | `cells[4] ?? ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 505 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 506 | BooleanLiteral | `verdict` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 506 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 506 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 508 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 508 | Regex | `/safe\b/i` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 509 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | BooleanLiteral | `/^\[[^\]]*\]$/.test(verdict)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | Regex | `/safe\b/i` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 510 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 511 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### structureViolations — 76 survivor(s): 76 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 566 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 566 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 566 | EqualityOperator | `value === null` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 566 | Regex | `/^\[[^\]]\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 566 | Regex | `/^\[[\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 569 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 574 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 574 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 578 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 578 | Regex | `/#{1,6}\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 578 | Regex | `/^#\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 578 | Regex | `/^#{1,6}\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 580 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 581 | MethodExpression | `t.endsWith("\|")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 584 | MethodExpression | `cells.some(x => /^:?-+:?$/.test(x))` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 584 | Regex | `/:?-+:?$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 584 | Regex | `/^:?-+:?/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 591 | OptionalChaining | `cells[d.column + 1].replace` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 591 | Regex | `/\*+\|\*+$/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 591 | Regex | `/^\*+\|\*+/g` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | LogicalOperator | `v === undefined && v === ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 594 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 603 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 603 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 607 | Regex | `/#{1,6}\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 607 | Regex | `/^#{1,6}\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 609 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 610 | MethodExpression | `t.endsWith("\|")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 613 | MethodExpression | `cells.some(x => /^:?-+:?$/.test(x))` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 613 | Regex | `/:?-+:?$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 613 | Regex | `/^:?-+:?/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | ArrowFunction | `() => undefined` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | LogicalOperator | `x === "" && /^\[[^\]]*\]$/.test(x)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | MethodExpression | `cells.some(x => x === "" \|\| /^\[[^\]]*\]$/.…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 619 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 623 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 623 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 623 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 628 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 628 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 632 | Regex | `/#{1,6}\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 632 | Regex | `/^#{1,6}\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 634 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 635 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 638 | MethodExpression | `e.linePrefix ? block.filter(l => e.linePref…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s*\[[^\]]*\]?\s*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s\[[^\]]*\]?\s*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\S*\[[^\]]*\]?\s*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s*\[[^\]]\]?\s*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s*\[[\]]*\]?\s*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s*\[[^\]]*\]\s*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s*\[[^\]]*\]?\s$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 640 | Regex | `/:\s*\[[^\]]*\]?\S*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 641 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 644 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 644 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 645 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 645 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 645 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 648 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 651 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 659 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 659 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 659 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### isRealAdr — 32 survivor(s): 31 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 89 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 98 | ConditionalExpression | `false` | hole | isFile guard disconnected; a narrow-footprint hole (verdict denial, not a false green), stated as such. On the realistic neighbour — a DIRECTORY named ADR-0001-x.md — both forms coincide, measured: r… |
| 99 | BooleanLiteral | `true` | hole | The isFile guard's return inverted: a NON-file with an ADR name becomes a decision WITHOUT being read — neither content nor the 40-char floor. (Identifying the occurrence: the three `return false;` o… |
| 102 | BlockStatement | `{}` | equivalent | Equivalent, argued with a sensitivity control and measured. The emptied catch makes the function fall off the end of its body: it returns undefined instead of false, on the only paths that throw (EAC… |
| 102 | EqualityOperator | `text.trim().length <= ADR_MIN_CHARS` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 102 | MethodExpression | `text` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 103 | BooleanLiteral | `true` | hole | The inverted catch: fail-OPEN on the unreadable. When the read throws, the shipped build answers "not a decision" (fail-closed); the mutant answers "decision". Recipe: green mission whose adr/ = temp… |
| 109 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 109 | Regex | `/\*\*Date\*\*\S*:\s*\d{4}-\d{2}-\d{2}/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 109 | Regex | `/\*\*Date\*\*\s*:\s\d{4}-\d{2}-\d{2}/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 109 | Regex | `/\*\*Date\*\*\s*:\s*\d{4}-\d{2}-\d/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 111 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 111 | Regex | `/(proposed\|accepted\|superseded\|deprecated)\…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 112 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 113 | Regex | `/## Reevaluation trigger/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 114 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 114 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 116 | MethodExpression | `text.slice(t).split("\n").slice(1).join("\n…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 116 | MethodExpression | `text.slice(t).split("\n")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 116 | MethodExpression | `text` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 116 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 116 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | EqualityOperator | `block.length <= 20` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | LogicalOperator | `block.length < 20 && /^\[[^\]]*\]$/.test(bl…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | Regex | `/\[[^\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | Regex | `/^\[[^\]]*\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | Regex | `/^\[[^\]]\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 117 | Regex | `/^\[[\]]*\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 118 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 123 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### artifactState — 17 survivor(s): 8 hole · 9 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 139 | ConditionalExpression | `false` | equivalent | The early 'untouched' return on an empty list becomes unreachable, but the fall-through gives the same result: [].some(...) is false by definition of the language, so hasFilled=false and the same lit… |
| 149 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Occurrence 1: the placeholders floor of the templateKey branch. The fallback only applies if match is null (zero placeholders); .length goes from 0 to 1, both < 3, the divergence guard takes over ide… |
| 156 | ConditionalExpression | `true` | equivalent | filter(() => true) is semantically the removed filter: the same (trimmed) empty lines kept as for the MethodExpression mutant on the same line. Same argument, same measurements: '' is absorbed by tem… |
| 156 | EqualityOperator | `l.length >= 0` | equivalent | length >= 0 is a tautology on any string: an always-true predicate, hence a third form of the same 'inert filter' mutant as the two previous ones on this line. Same absorption of '' by templateLines … |
| 156 | MethodExpression | `s.split("\n").map(l => l.trim())` | equivalent | Removing the filter keeps the (post-trim) empty lines in lines(). Template side: '' enters templateLines. Content side: each added empty line is then absorbed by templateLines.has('') — so added is i… |
| 156 | MethodExpression | `l` | hole | Without trim, the content/template comparison is done on RAW lines: a line that changed only in whitespace counts as 'new'. RECIPE: green example mission; replace runward/decision-matrix.md with the … |
| 159 | MethodExpression | `l.split(/\s+/)` | equivalent | The elements of added come out of lines(), so they are trimmed and non-empty BY CONSTRUCTION (the mutant is applied alone; the lines() line keeps its trim and its filter). And split(/\s+/) on a strin… |
| 159 | Regex | `/\s/` | equivalent | /\s/ instead of /\s+/ only differs on CONSECUTIVE whitespace: each extra whitespace produces one more empty token — which the filter(Boolean), kept by this mutant, removes. The multiset of non-empty … |
| 164 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Occurrence 2: the placeholders test on the path WITHOUT templateKey — a live path, the one the compliance pack takes (govState passes {label, relPath} without templateKey; adr/ and contracts/ return … |
| 690 | MethodExpression | `readdirSync(path).filter(f => f.endsWith(".…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 690 | MethodExpression | `readdirSync(path)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 690 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 703 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 703 | LogicalOperator | `armed \|\| contracts.some(f => readFileSync(j…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 703 | MethodExpression | `contracts.every(f => readFileSync(join(path…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 703 | MethodExpression | `readFileSync(join(path, f), "utf8")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 735 | ConditionalExpression | `false` | equivalent | The early return `if (sections.length === 0) return s` is a SHORTCUT, not a behaviour: when no conformance section is found, `drop` stays empty and `s.split("\n").filter(() => true).join("\n")` rebui… |

### readReopeningTriggers — 14 survivor(s): 10 hole · 2 equivalent · 2 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 195 | MethodExpression | `readdirSync(adrDir).filter(f => isRealAdr(f…` | hole | With .sort() removed, the watch's order becomes the host's readdir order, whereas the code promises 'sorted by filename (deterministic)' and status only displays the first 8 triggers (CAP): on a file… |
| 195 | MethodExpression | `readdirSync(adrDir)` | hole | With the isRealAdr filter removed from the loop, every .md named ADR-* is read, including below the ADR_MIN_CHARS=40 floor that ALL the rest of the system refuses ('an empty file is not a decision').… |
| 200 | BlockStatement | `{}` | equivalent | The emptied catch would make execution fall onto adrStatusLine(text) with text undefined (TypeError, runward status crash) IF it were reached; it is unreachable: every f of the loop has already passe… |
| 205 | Regex | `/accepted\b/i` | hole | With the ^ anchor removed from /^accepted\b/i, 'accepted' is looked for anywhere in the status line: a SET-ASIDE ADR whose line mentions the word comes into force. Recipe: ADR-0013-superseded.md, '**… |
| 209 | Regex | `/##\s+Reevaluation trigger/m` | hole | With the ^ anchor removed from the heading search, a mere MENTION of '## Reevaluation trigger' mid-line counts as a section. Recipe: ADR-0020-inline-mention.md, accepted, WITHOUT a section, whose Con… |
| 209 | Regex | `/^##\sReevaluation trigger/m` | hole | \s+ becomes \s in /^##\s+Reevaluation trigger/: a legal markdown heading with two spaces ('## Reevaluation trigger') stops being recognised. Recipe: ADR-0019-twospace-heading.md; runward status goes … |
| 214 | Regex | `/[^\n]*\n/` | equivalent | replace with a non-global regex replaces the LEFTMOST occurrence; since [^\n]* can start, even empty, at index 0, the first occurrence of [^\n]*\n starts at 0 as soon as a \n exists: exactly the posi… |
| 215 | Regex | `/##\s/m` | hole | With the ^ anchor removed from the end-of-section bound /^##\s/, a '## ' in the MIDDLE of a prose line becomes the end of the section. Recipe: ADR-0021-midline-hashes.md, prose '- Reopen if the "## C… |
| 217 | Regex | `/\*\*Trigger set on\*\*:\s(\d{4}-\d{2}-\d{2…` | hole | \s* becomes \s in the date read: the spelling '**Trigger set on**:2026-04-04' (zero spaces after the colon) stops yielding its date. Recipe: ADR-0027-seton-nospace.md; runward status goes from '• ADR… |
| 221 | MethodExpression | `l` | hole | With the trim removed from the map, the section's lines keep their whitespace and indentation before the length>0 filter: a line of spaces becomes the 'first prose'. Recipe: ADR-0025-indent-prose.md … |
| 222 | Regex | `/\*\*Trigger set on\*\*/` | hole | With the ^ anchor removed from the anti-metadata filter, any prose CONTAINING '**Trigger set on**' is eliminated from the preview instead of the metadata lines alone. Recipe: ADR-0026-seton-mention.m… |
| 223 | StringLiteral | `"Stryker was here!"` | hole | The '' fallback becomes 'Stryker was here!' when a trigger section has no prose line (empty section or reduced to its set-on line). Recipe: ADR-0022-emptysection.md (section carrying only '**Trigger … |
| 224 | MethodExpression | `prose.slice(0, TRIGGER_PREVIEW_MAX - 1).tri…` | display-only | A single reachable difference: whitespace kept before the truncation marker. trimStart is a no-op on the left (every prose line is already trim()med by the upstream map: never leading whitespace in p… |
| 226 | MethodExpression | `preview.startsWith("…")` | display-only | endsWith becomes startsWith: a preview can never start with '…' (the prose is trim()med and non-empty; a section without prose gives preview '' but then proseLines.length > 1 is false), so the supple… |

### sectionTableRows — 9 survivor(s): 9 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 529 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 529 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 534 | Regex | `/#{1,6}\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 534 | Regex | `/^#{1,6}\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 536 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 537 | MethodExpression | `t.endsWith("\|")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 540 | MethodExpression | `cells.some(x => /^:?-+:?$/.test(x))` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 540 | Regex | `/:?-+:?$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 540 | Regex | `/^:?-+:?/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### yesNo — 6 survivor(s): 6 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 172 | Regex | `/\*+/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 172 | Regex | `/^\*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 172 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 173 | Regex | `/yes\b/i` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 173 | Regex | `/no\b/i` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 173 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### analyze — 4 survivor(s): 1 hole · 3 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 171 | MethodExpression | `artifacts.some(a => a.state === "filled")` | hole | A phase becomes 'complete' as soon as ONE artifact is filled. MEASURED RECIPES (3 surfaces): (1) scaffold + filled framing.md, blank mission-contract.md (fxsome): check 'Current gate 1 · Frame' -> '2… |
| 173 | StringLiteral | `""` | defence-in-depth | join(missionDir, "") = missionDir: adrCount counts the ADR-* files at the ROOT of the mission, where there are none (measured: analyze ex adr 3->0; scaffold 0->0). The 'ADRs N' line of check and the … |
| 175 | ArrowFunction | `() => undefined` | defence-in-depth | filter(() => undefined) empties the list: adrCount=0 everywhere (measured: analyze ex adr 3->0). The opposite effect of the previous one, same surface (check's 'ADRs' line, --json's adrCount). KILLED… |
| 175 | MethodExpression | `readdirSync(adrDir)` | defence-in-depth | Without the isRealAdr filter, adrCount counts the scaffolded template ADR-0000-template.md and any empty file — the empty-file defence is skipped for this count (measured: scaffold adr 0->1, the temp… |

### findMissionRoot — 4 survivor(s): 3 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 56 | EqualityOperator | `i <= 128` | hole | A hole of minimal reach, stated as such — and in the direction of a behaviour MORE correct than the shipped one. Divergence measured by direct function call: mission at the 127th ancestor of the cwd … |
| 56 | UpdateOperator | `i--` | hole | Same family as the bound mutant, in a "cap removed" version. i-- makes the condition i<128 always true but NEVER creates an infinite loop: the root break holds (dirname is purely lexical and reaches … |
| 59 | StringLiteral | `""` | hole | REALISTIC hole: the mission marker becomes "a runward/ directory exists" (join(dir,"runward","") = dir/runward) instead of "runward/framing.md exists" — precisely the distinction the code comment cla… |
| 62 | ConditionalExpression | `false` | equivalent | Equivalent, argued and measured. The root break becomes unreachable, but the capped loop returns the same result on every input: dirname is a pure, monotonic lexical function — every absolute path co… |

### inProgressDetail — 4 survivor(s): 4 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 154 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 157 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 157 | LogicalOperator | `!spec && !structureContractOptIn(missionDir)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 164 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### adrStatusLine — 3 survivor(s): 2 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 84 | MethodExpression | `text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)…` | display-only | The only reachable difference is trailing whitespace in a cell. Function probe: adrStatusLine('**Status**: accepted ') returns 'accepted ' instead of 'accepted'; the CRLF case does not diverge (measu… |
| 84 | OptionalChaining | `text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)…` | equivalent | Optional chaining short-circuits the ENTIRE chain: in text.match(...)?.[1].trim(), if match returns null, ?. also skips the .trim(), no TypeError (measured on the mutated form: 'no status here' retur… |
| 84 | Regex | `/^\*\*Status\*\*\s*:\s*(.+)/mi` | equivalent | $ after a greedy (.+) is redundant: '.' excludes line terminators, so the greedy match extends exactly to the end of the line, a position where $ (multiline) always succeeds; never any forced backtra… |

### agentRatificationOptIn — 3 survivor(s): 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 692 | StringLiteral | `""` | equivalent | `readFileSync(p, "")` returns a Buffer (measured) and JSON.parse converts it to its string: the same object. Measured: 0 of 21 cases differ. Positive control: L696 changes 2 cases. Behaviour probe 20… |
| 693 | OptionalChaining | `j.agentRatification` | equivalent | j is nullish only for a lock that reads `null`; `j.agentRatification` then throws a TypeError, which the catch turns into false. Measured: 0 of 21 cases differ, including `nulllock`. Positive control… |
| 695 | BlockStatement | `{}` | equivalent | The catch returns undefined instead of false; both consumers read it as a boolean (`if (!accepted)` in agentCause, `!agentRatificationOptIn(...)` in ratify.ts). Measured: 0 of 21 cases differ, includ… |

### inProgressCause — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 117 | BlockStatement | `{}` | equivalent | The mutated catch covers inProgressCause's inner readFileSync, which is only reached AFTER artifactState(missionDir, a) has returned 'in-progress' — so after artifactState has itself read the same fi… |
| 122 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The [] fallback is only used when content.match(PLACEHOLDER) is null, that is zero placeholders; the array is only consumed through .length, compared with 3. Original: 0 >= 3 = false; mutated: 1 >= 3… |
| 122 | EqualityOperator | `(content.match(PLACEHOLDER) \|\| []).length >…` | hole | RECIPE: scaffold mission (runward init) whose runward/floor.md and governance/threat-model.md contain EXACTLY 3 placeholders ([the p99]…) plus divergent prose (fixture fxph3). artifactState keeps its… |

### regulatedOptIn — 3 survivor(s): 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 680 | StringLiteral | `""` | equivalent | `readFileSync(p, "")` returns a Buffer (measured) and JSON.parse converts it to its string: the same object. Measured: 0 of 21 cases differ, including `reg` (lock present). Positive control: agentRat… |
| 681 | OptionalChaining | `j.regulated` | equivalent | j is nullish only for a lock that reads `null`; `j.regulated` then throws a TypeError, which the catch turns into false: the same answer. Measured: 0 of 21 cases differ, including the `nulllock` miss… |
| 683 | BlockStatement | `{}` | equivalent | The catch returns undefined instead of false, and every consumer reads the value as a boolean: verdict.ts (`if (regulated.on)`), check-contract.ts (conditional spreads, never serialised), verify.ts a… |

### tableCells — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 521 | MethodExpression | `line` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 521 | Regex | `/\\|/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 522 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### ISO_DATE — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 170 | Regex | `/\d{4}-\d{2}-\d{2}$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 170 | Regex | `/^\d{4}-\d{2}-\d{2}/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### isRealAdrName — 2 survivor(s): 1 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 76 | Regex | `/ADR-\d+/` | hole | Anchor ^ lost: every .md name CONTAINING "ADR-<digit>" becomes an ADR. Divergences measured by direct function call: notes-on-ADR-0001.md, DRAFT-ADR-0009-x.md, supersedes-ADR-2.md, xADR-1.md — all fa… |
| 76 | Regex | `/^ADR-\d/` | equivalent | Equivalent, formally and by measurement. Under .test(), /^ADR-\d+/ and /^ADR-\d/ accept exactly the same language: acceptance only depends on positions 0-4 ("ADR-" then ONE digit); the + only lengthe… |

### structureContractOptIn — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 668 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 669 | OptionalChaining | `j.structureContract` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

## Module: evidence

Survivors: 332

Holes: 221 · Equivalent: 84 · Display-only: 18 · Defence-in-depth: 9

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### evidenceReport — 75 survivor(s): 56 hole · 6 equivalent · 12 display-only · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 742 | BlockStatement | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: text only (the row falls through to the adr branch and `adrDecision("ADR-undefined")` answers "no matching ADR… |
| 742 | ConditionalExpression | `false` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: text only (the row falls through to the adr branch and `adrDecision("ADR-undefined")` answers "no matching ADR… |
| 743 | ObjectLiteral | `{}` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: the violation COUNT is unchanged (55) but the pushed object loses both fields — the entry for `probe-malformed… |
| 743 | StringLiteral | `ˋˋ` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope and `rule` unchanged; the `problem` string of the `probe-malformed` entry becomes "". Re-run on m… |
| 747 | StringLiteral | `ˋˋ` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→57. Both rows that cite `adr:0001` gain `typed pointer adr:0001 — ADR-0000-template.md is … |
| 752 | ObjectLiteral | `{}` | equivalent | The value is consumed on exactly three paths in the function body: `const abs = r.abs`, `"why" in r`, and (inside the outside-branch only) `"at" in r && r.at`. `{ abs: null }` and `{}` agree on all t… |
| 758 | ConditionalExpression | `false` | hole | wrong reason: reports plain resolution failure for a pointer that resolves to a real file outside the audited project — assert: a pointer that resolved to a real file outside the audited project must… |
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
| 760 | StringLiteral | `""` | hole | wrong reason: reports plain resolution failure for an absolute pointer: the absolute comparison can never match — assert: a pointer refused for being absolute must name the absolute-path refusal, nev… |
| 760 | StringLiteral | `""` | hole | wrong reason: reports plain resolution failure for an absolute pointer — assert: a pointer refused for being absolute must name the absolute-path refusal, never the generic 'update it or remove the r… |
| 761 | StringLiteral | `""` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: count, scope, `rule` and exit code unchanged; the `probe-absolute` message truncates to `typed pointer does no… |
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
| 898 | StringLiteral | `""` | display-only | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1 and the same probe on probe mission 2: byte-identical payload; minimal mission `unreadable-prose`: exit 1 / 1 g… |
| 902 | Regex | `/\s/` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→56 — `code/src/extra.md`, whose content is the twelve characters `nowhitespace` and no whi… |
| 915 | StringLiteral | `""` | hole | scripts/mutation-probe.mjs (corrected build, `--strict` in gateArgs) on probe mission 1: gaps.conformance 55→56 — `probe-sig-case` gains `evidence does not match the rule's signature /ZEBRAWORD/i` be… |
| 933 | MethodExpression | `row.evidence` | equivalent | Six siblings KILLED in this function (the three bounds of the signature guard, the two anchors of the template guard, and the truncation of the echo). The two survivors are on `row.evidence.trim()` -… |
| 933 | Regex | `/\[[^\]]*\s[^\]]*\]$/` | equivalent | Six siblings KILLED in this function (the three bounds of the signature guard, the two anchors of the template guard, and the truncation of the echo). The two survivors are on `row.evidence.trim()` -… |
| 949 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 949 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 954 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 954 | ConditionalExpression | `true` | hole | Hole with an exact recipe, measured 2026-09-10 by the v0.39.0 release gate's own ratchet: applied at line 954, the machine payload on the `load` probe mission DIFFERS from the pristine build — the ob… |
| 954 | EqualityOperator | `lt !== "unparseable"` | hole | Hole with an exact recipe, measured 2026-09-10 by the v0.39.0 release gate's own ratchet: applied at line 954, the machine payload on the `load` probe mission DIFFERS from the pristine build — the ob… |
| 954 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 955 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 955 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 956 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 956 | ConditionalExpression | `true` | hole | Hole with an exact recipe, measured 2026-09-10 by the v0.39.0 release gate's own ratchet: applied at line 956, the machine payload on the `load` probe mission DIFFERS from the pristine build — the ob… |
| 956 | EqualityOperator | `lt !== "absent"` | hole | Hole with an exact recipe, measured 2026-09-10 by the v0.39.0 release gate's own ratchet: applied at line 956, the machine payload on the `load` probe mission DIFFERS from the pristine build — the ob… |
| 956 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 957 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 957 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 958 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 958 | ConditionalExpression | `true` | hole | Hole with an exact recipe, measured 2026-09-10 by the v0.39.0 release gate's own ratchet: applied at line 958, the machine payload on the `load` probe mission DIFFERS from the pristine build — the ob… |
| 958 | EqualityOperator | `lt !== "findings"` | hole | Hole with an exact recipe, measured 2026-09-10 by the v0.39.0 release gate's own ratchet: applied at line 958, the machine payload on the `load` probe mission DIFFERS from the pristine build — the ob… |
| 958 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 959 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 959 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 961 | Regex | `/\.(md\|markdown\|txt\|rst\|adoc\|asciidoc)/i` | hole | Dropping the $ makes the extension test match anywhere in the ABSOLUTE path, so a real test file is refused because some earlier component or infix contains .md, .txt, .rst, .adoc. Executed (original… |
| 962 | StringLiteral | `""` | display-only | abs.split(".") -> abs.split("") changes only the token interpolated into the violation TEXT: the path is split per character, so …/framing.md yields d and the message reads "a d document is not a tes… |
| 1040 | MethodExpression | `[...resolvedFiles.keys()].every(a => re.tes…` | hole | some -> every turns "at least one cited file carries the rule shape" into "every cited file does", i.e. a false RED on the ordinary shape of a cell that cites a code file and its test. Executed on a … |

### natureSatisfied — 47 survivor(s): 47 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 1320 | ConditionalExpression | `false` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1320, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1320 | StringLiteral | `""` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1320, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | ArrowFunction | `() => undefined` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | BooleanLiteral | `!p.adrId` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | BooleanLiteral | `p.adrId` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | ConditionalExpression | `true` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | ConditionalExpression | `false` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1321 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1321 | EqualityOperator | `p.kind !== "adr"` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | LogicalOperator | `p.kind === "adr" && !!p.adrId \|\| adrIdExist…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1321 | LogicalOperator | `p.kind === "adr" \|\| !!p.adrId` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1321 | MethodExpression | `pointers.every(p => p.kind === "adr" && !!p…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1321 | StringLiteral | `""` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1321, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1321 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1324 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1327 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1327 | LogicalOperator | `!abs && !isRegularFile(abs)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1333 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1336 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1338 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1338 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1338 | EqualityOperator | `nature !== "sarif"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1338 | LogicalOperator | `nature === "sarif" \|\| isSarifReport(content)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1338 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1339 | BooleanLiteral | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1340 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1340 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1340 | EqualityOperator | `nature !== "eslint"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1340 | LogicalOperator | `nature === "eslint" \|\| isEslintReport(conte…` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1340, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1340 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1341 | BooleanLiteral | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | EqualityOperator | `nature !== "coverage"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | LogicalOperator | `nature === "coverage" \|\| isLcovReport(conte…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | LogicalOperator | `isLcovReport(content) && isCoberturaReport(…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1342 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1343 | BooleanLiteral | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1344 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1344 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1344 | EqualityOperator | `nature !== "sbom"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1344 | LogicalOperator | `nature === "sbom" \|\| isCycloneDxSbom(conten…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1344 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1345 | BooleanLiteral | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1358 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |

### unsafeSignature — 32 survivor(s): 15 hole · 17 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 215 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?[^()][+*}][^()]*\)…` | hole | THE SERIOUS ONE. Battery mission: three refusals DISAPPEAR outright — `p02 /(a{2,})+/`, `p03 /(a{2})+/`, `p28 /((a){2,})+/` — so the screen hands a group whose body carries a brace quantifier straigh… |
| 215 | Regex | `/\((?:\?[:=!]\|\?<[^>]>)?[^()]*[+*}][^()]*\)…` | hole | Battery mission: `p08 :: unsafe signature regex … /(?<a)>a+)+/` is replaced by `p08 :: invalid signature regex in the rule file: /(?<a)>a+)+/`. The gate still refuses; it refuses for a different, and… |
| 215 | Regex | `/\((?:\?[:=!]\|\?<[>]*>)?[^()]*[+*}][^()]*\)…` | hole | Battery mission: three entries move from `unsafe signature regex` to `invalid signature regex in the rule file` — `p08 /(?<a)>a+)+/`, `p09 /(?<)>a+)+/`, `p16 /(?<)>[^()]+)+/`. Teeth mission: identica… |
| 215 | Regex | `/\((?:\?[^:=!]\|\?<[^>]*>)?[^()]*[+*}][^()]*…` | hole | Battery mission: `p07 :: invalid signature regex in the rule file: /(?)+)+/ — fix runward/rules/p07.md` is replaced by `p07 :: unsafe signature regex (nested or overlapping-alternation quantifiers ri… |
| 217 | Regex | `/\((?:\?[:=!]\|\?<[^>]>)?[^()]*\\|[^()]*\)[+*…` | hole | Battery mission: `p11 :: unsafe signature regex … /(?<a)>\|)+/` is replaced by `p11 :: invalid signature regex in the rule file: /(?<a)>\|)+/`. Teeth mission: identical. |
| 217 | Regex | `/\((?:\?[:=!]\|\?<[>]*>)?[^()]*\\|[^()]*\)[+*…` | hole | Battery mission: two entries move from `unsafe signature regex` to `invalid signature regex in the rule file` — `p11 /(?<a)>\|)+/` and `p12 /(?<)>\|)+/`. Teeth mission: identical. |
| 217 | Regex | `/\((?:\?[^:=!]\|\?<[^>]*>)?[^()]*\\|[^()]*\)[…` | hole | Battery mission: `p10 :: invalid signature regex in the rule file: /(?)\|)+/` is replaced by `p10 :: unsafe signature regex (nested or overlapping-alternation quantifiers risk catastrophic backtrackin… |
| 220 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?[^()]*[+*}][()]*\)…` | hole | The mutated NESTED scan matches only when the body quantifier sits immediately before the ), so it still catches (a+)+, (a*b*)* and every reduced (G+)+ — but it stops catching a group whose quantifie… |
| 222 | Regex | `/\[(?:\\.\|[^\]\\])\]/g` | equivalent | The class-matching half of the normalisation is unobservable. Measured: removing the `.replace(/\[…\]/g, "C")` step ENTIRELY leaves the 60000-signature fuzz digest byte-identical, and 17 class-heavy … |
| 222 | Regex | `/\[(?:\\.\|[\]\\])*\]/g` | equivalent | Same measurement as the sibling above, on the same expression: the class-matching regex is inverted rather than narrowed, and the fuzz digest over 60000 signatures is byte-identical, as are the 17 ta… |
| 222 | StringLiteral | `""` | hole | Escapes are deleted instead of being neutralised into a token. Measured on a deterministic differential fuzz of 60000 generated signatures: 739 answers move (23988 unsafe verdicts become 24727). Dele… |
| 222 | StringLiteral | `""` | hole | The normalised class is DELETED instead of replaced by a token. Measured on the 60000-signature fuzz: 187 answers move (23988 unsafe verdicts become 24175). Deleting the class brings its neighbours t… |
| 230 | Regex | `/\((?:\?[:=!]\|\?<[^>]*>)?[^()]*\\|[^()]\)[+*…` | hole | The alternation scan requires EXACTLY ONE character between the pipe and the closing parenthesis. Measured: `(a\|bc)+`, `(a\|bcd)*`, `(?:xy\|zw)+` and `(ab\|cd){2}` all flip from unsafe to SAFE — a false… |
| 230 | StringLiteral | `"Stryker was here!"` | equivalent | The mutation substitutes the literal `Stryker was here!` for an empty string inside the collapse replacement, so the string the loop builds does change. What cannot change is any predicate applied to… |
| 230 | StringLiteral | `"Stryker was here!"` | equivalent | The mutation substitutes the literal `Stryker was here!` for an empty string inside the collapse replacement, so the string the loop builds does change. What cannot change is any predicate applied to… |
| 231 | ConditionalExpression | `false` | equivalent | `if (next === t) break` is the loop's fixpoint test, and the mutation only removes the early exit; the loop stays bounded by `i < 20`, so it cannot run forever. Take the iteration where the guard hol… |
| 250 | ArrayDeclaration | `["Stryker was here"]` | equivalent | \|\| [] is evaluated only when norm.match(/\(/g) is null, i.e. when norm holds no ( at all — and opens is used for nothing but the loop bound. With no ( in t, the reduction regex (which requires a lite… |
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

### collectSealableEvidence — 26 survivor(s): 15 hole · 11 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 978 | StringLiteral | `"Stryker was here!"` | equivalent | `files` is a Map used as an ORDERED SET: the mutated literal is the placeholder VALUE passed to `files.set(key, ...)`, and the map is read exactly once, as `[...files.keys()]`. Every value that leave… |
| 987 | StringLiteral | `"Stryker was here!"` | equivalent | Same construction, same argument: the literal is the placeholder value of a Map whose only read is `[...files.keys()]`, and every emitted hash is recomputed by `out[rel] = sha256(join(root, rel))`. T… |
| 989 | MethodExpression | `[...files.keys()]` | hole | Battery: observable on 2 (freeze:f-plain, freeze:f-bracket), and on nothing else — notably NOT on the three `--attest` runs, because missionStateDigest re-sorts the keys before hashing. Close-up (too… |
| 1082 | Regex | `/\[.*\]$/` | hole | Skips TEMPLATE PLACEHOLDER rows. Without `^` it also skips any row whose rule column merely ENDS in `]`, and a skipped row contributes neither its adr: target nor its applied evidence to the frozen s… |
| 1082 | Regex | `/^\[.*\]/` | hole | Same defect, other anchor: without `$` the filter skips any row whose rule column merely BEGINS with `[` and contains `]`. Measured: `\| [legacy] queue \| applied \| file:code/guard.ts#guardFields \|` — … |
| 1089 | ConditionalExpression | `false` | equivalent | adrId is assigned at exactly ONE site — the kind === "adr" branch of parseEvidencePointers — so !p.adrId alone already excludes every file:/test: pointer, and the removed disjunct decides nothing. SE… |
| 1089 | ConditionalExpression | `false` | hole | Every pointer enters the ADR branch, so a file:/test: pointer (adrId undefined) is looked up as adrFilename(missionDir, "ADR-undefined"). That returns null against an ordinary adr/ directory — which … |
| 1089 | LogicalOperator | `p.kind !== "adr" && !p.adrId` | hole | The && narrows the skip to non-adr pointers with no adrId, so a MALFORMED adr pointer (adr:ADR-9999, adrId undefined, deliberately kept as a failing pointer) falls through to adrFilename(missionDir, … |
| 1094 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1094 | Regex | `/^\[.\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1096 | StringLiteral | `"Stryker was here!"` | equivalent | files is a Map used as an ORDERED SET: the returned record is built as out[rel] = sha256(join(root, rel)) over files.keys(), so no value written by any files.set is ever read. Measured identical to t… |
| 1117 | StringLiteral | `""` | hole | t.split("")[0] is the first CHARACTER of the token, so literal becomes <base>/c for code/evidence-alias.ts; lstat throws ENOENT, the loop continues, and the cited link is never sealed. Measured: on t… |
| 1117 | StringLiteral | `""` | hole | Identical mechanics to the "#" mutant: t.split("#")[0].split("")[0] is the first character of the pre-# part, literal is <base>/c, lstat throws and the cited link is never sealed. Measured: alias.ts … |
| 1118 | ConditionalExpression | `false` | equivalent | Dropping the continue cannot add a key. When literal === abs, the fall-through reaches files.set only if isLink && isRegularFile(literal) — and abs is the value resolvePointer returns, which is alway… |
| 1118 | ConditionalExpression | `true` | hole | if (true) continue makes the loop body dead, so the cited symlink own path is never sealed — RWD-2026-0070 re-opened, by the shortest route. Measured: symlink fixture, shipped {alias.ts, code/guard.t… |
| 1118 | EqualityOperator | `literal !== abs` | hole | Inverting the test skips exactly the symlink case (literal !== abs) and runs the body only where literal IS the resolved real path, where isLink is false — so the cited link is never sealed. Measured… |
| 1120 | BooleanLiteral | `true` | equivalent | The initialiser is dead: the only path that reaches the if without executing isLink = lstatSync(literal).isSymbolicLink() is the lstat throw, and the catch leaves the iteration with continue. isLink … |
| 1121 | BlockStatement | `{}` | hole | Emptying the try body leaves isLink false for every base, so the cited link is never sealed — RWD-2026-0070 re-opened. Measured: symlink fixture, shipped {alias.ts, code/guard.ts, runward/floor.md} v… |
| 1124 | BlockStatement | `{}` | equivalent | Falling out of the catch instead of continuing cannot add a key: lstat threw, so isLink still holds its per-iteration initial false, and isLink && ... short-circuits before isRegularFile is even call… |
| 1127 | ConditionalExpression | `false` | hole | if (false) deletes the seal-the-link write, so the cited symlink own path never enters the lock — RWD-2026-0070 re-opened, exactly as the block-deletion mutant. Measured: symlink fixture, shipped {al… |
| 1127 | ConditionalExpression | `true` | hole | Sealing every base literal path that lstat can stat and that is not the resolved target. Two measured over-seals, both on green missions. (a) Same relative name under two bases: notes.md at the proje… |
| 1127 | LogicalOperator | `isLink \|\| isRegularFile(literal)` | hole | Widening && to \|\| seals two shapes the condition exists to exclude, both measured on green missions. (a) isLink true, isRegularFile false — a cited-but-dangling link: alias.ts -> code/gone.ts enters … |
| 1128 | StringLiteral | `"Stryker was here!"` | equivalent | Same argument as the ADR-branch twin: the Map values are never read. The record the function returns is built as out[rel] = sha256(join(root, rel)) over files.keys(), so the string written here is ov… |
| 1240 | ConditionalExpression | `true` | equivalent | The sibling that sealed the FIRST ADR in the journal instead of the one the row cites is KILLED by `the seal freezes the ADR the row CITES` — a test that first failed to see the defect because the pr… |
| 1240 | LogicalOperator | `abs \|\| isRegularFile(abs)` | equivalent | The sibling that sealed the FIRST ADR in the journal instead of the one the row cites is KILLED by `the seal freezes the ADR the row CITES` — a test that first failed to see the defect because the pr… |
| 1261 | BlockStatement | `{}` | equivalent | The sibling that sealed the FIRST ADR in the journal instead of the one the row cites is KILLED by `the seal freezes the ADR the row CITES` — a test that first failed to see the defect because the pr… |

### parseEvidenceCell — 24 survivor(s): 14 hole · 7 equivalent · 3 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 110 | MethodExpression | `chunk` | hole | FALSE GREEN, verified by exit code. Applied on m4 (single defect: `file:code/deleted-a.ts<U+2028>; file:code/b.ts`): `check --strict --json` went from **exit 1 to exit 0**, conformance 1 -> 0, and th… |
| 115 | Regex | `/\S/` | display-only | Applied on m2, m3 and m6. Exit code, violation count and all evidence counters unchanged; the `problem` strings became `typed pointer does not resolve: test: — update it or remove the row` and `typed… |
| 115 | StringLiteral | `ˋˋ` | display-only | Applied on m2 and m6. `check --strict --json` kept exit 1, the same violation count and every evidence counter, but two `problem` strings lost the pointer they name: `typed pointer does not resolve: … |
| 131 | EqualityOperator | `sep <= firstWs` | equivalent | The comparison is only ever evaluated on the third leg of `sep !== -1 && (firstWs === -1 \|\| sep < firstWs)`: reaching it requires `sep !== -1` AND `firstWs !== -1`, since `firstWs === -1` short-circu… |
| 139 | Regex | `/\s*(")([\s\S]*?)\1/` | hole | FALSE GREEN, verified by exit code. Applied on m6 (single defect: `test:code/test/pointers.test.ts::the "guard" path`, a name the file does not contain): `check --strict --json` went from **exit 1 to… |
| 139 | Regex | `/^\S*(")([\s\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s(")([\s\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([\S\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([\s\S])\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([\s\s]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 139 | Regex | `/^\s*(")([^\s\S]*?)\1/` | hole | Applied on m2. `check --strict --json` gained a violation the baseline did not have: `Floor · hexa-architecture · typed pointer test:code/test/pointers.test.ts:: — test named "the guard fails closed"… |
| 140 | MethodExpression | `after` | hole | Applied on m2 and m3. On m2, `check --strict --json` gained the violation `Floor · provider-no-crash-missing-env · typed pointer test:code/test/pointers.test.ts:: — test named " spaced name" not foun… |
| 140 | Regex | `/["'ˋ]\|["'ˋ]$/g` | hole | Applied on m2 and m6. On m2 two rows moved (conformance 10 -> 11): `test named "the "guard" path"` became `test named "the guard path"` and a NEW violation appeared, `Floor · state-event-sourcing · t… |
| 140 | Regex | `/^["'ˋ]\|["'ˋ]/g` | hole | Applied on m2 and m6. Same observation as the sibling above, measured separately: on m2, `test named "the guard path"` replaced `test named "the "guard" path"` and the new violation `typed pointer te… |
| 140 | StringLiteral | `"Stryker was here!"` | hole | Applied on m2. `check --strict --json` gained `Floor · state-event-sourcing · typed pointer test:code/test/pointers.test.ts::'l'invariant — test named "Stryker was here!l'invariant tientStryker was h… |
| 157 | Regex | `/([^\s#]+)#(")([\s\S]*?)\2/` | hole | FALSE GREEN, verified by exit code. Applied on m5 (single defect: `file:code/deleted-b.ts — compare with code/b.ts#"the exact sentence"`): `check --strict --json` went from **exit 1 to exit 0**, conf… |
| 174 | Regex | `/:(\d+)/` | hole | Applied on m2. Two rows moved and the coverage counter with them (conformance 10 -> 11, `evidence.typed` 16 -> 15, `evidence.prose` 7 -> 8). A row that was GREEN went red: the cell `file:code/2026:07… |
| 175 | Regex | `/ADR-?\d/i` | equivalent | Four siblings KILLED here (the `pathShaped` condition of the `::` branch, the block it guards, the echo of the branch without `::`, the echo of a misspelt `adr:`), two of them on a site that NO input… |
| 175 | Regex | `/^ADR-?\D/i` | equivalent | Four siblings KILLED here (the `pathShaped` condition of the `::` branch, the block it guards, the echo of the branch without `::`, the echo of a misspelt `adr:`), two of them on a site that NO input… |
| 175 | Regex | `/^ADR-\d/i` | equivalent | Four siblings KILLED here (the `pathShaped` condition of the `::` branch, the block it guards, the echo of the branch without `::`, the echo of a misspelt `adr:`), two of them on a site that NO input… |
| 182 | ConditionalExpression | `true` | equivalent | The mutated operand is the left half of `symbol !== undefined && /\s/.test(symbol)`. When `symbol` is a string, `symbol !== undefined` is already `true`, so replacing it by `true` changes nothing. Wh… |
| 182 | StringLiteral | `"Stryker was here!"` | display-only | Applied on m2 and m3. Exit code, violation count and every evidence counter unchanged; the message `typed pointer file:code/src/demo.ts# — the `#` names nothing to look for (a symbol must be at least… |
| 203 | Regex | `/\S/` | equivalent | Four siblings KILLED here (the `pathShaped` condition of the `::` branch, the block it guards, the echo of the branch without `::`, the echo of a misspelt `adr:`), two of them on a site that NO input… |
| 203 | StringLiteral | `""` | equivalent | Four siblings KILLED here (the `pathShaped` condition of the `::` branch, the block it guards, the echo of the branch without `::`, the echo of a misspelt `adr:`), two of them on a site that NO input… |

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

### evidenceBreakdown — 14 survivor(s): 8 hole · 5 equivalent · 1 defence-in-depth

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
| 1402 | BooleanLiteral | `true` | equivalent | Dedicated control built (no changing sibling): `typed++` -> `typed += 2` makes the probe diverge on `breakdown\|*`. The two survivors are on a `return false` of an inner function whose caller already … |
| 1418 | LogicalOperator | `!abs && !isRegularFile(abs)` | equivalent | Dedicated control built (no changing sibling): `typed++` -> `typed += 2` makes the probe diverge on `breakdown\|*`. The two survivors are on a `return false` of an inner function whose caller already … |

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

### textOutsideManifest — 13 survivor(s): 9 hole · 4 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 524 | StringLiteral | `"Stryker was here!"` | equivalent | `raw` is assigned unconditionally as the first statement of the `try`. The only path that skips that assignment is a throw inside `readFileSync`, and the `catch` returns a literal without ever readin… |
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
| 601 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

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

### conformanceRow — 10 survivor(s): 6 hole · 4 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 583 | ConditionalExpression | `false` | equivalent | with no pipe in the line the split yields a one-element array and the next line's cell-count test returns false regardless. One call site, so this oracle covers every use. Also survives the whole net… |
| 583 | StringLiteral | `""` | equivalent | includes of the empty string is true for every string, so the guard never fires — the same state the neighbour produces by returning false outright, and the two produce IDENTICAL digests, so that is … |
| 585 | StringLiteral | `"Stryker was here!"` | equivalent | The FIRST replace's replacement, the one stripping the leading pipe. The replacement text carries no pipe, so the pipe count is unchanged and the split returns exactly the same number of cells; the o… |
| 585 | StringLiteral | `"Stryker was here!"` | equivalent | The SECOND replace's replacement, stripping the trailing pipe. Both pristine and mutant CONSUME the trailing pipe — one replaces it with nothing, the other with pipe-free text — so the pipe count and… |
| 612 | MethodExpression | `t.endsWith("\|")` | hole | Observable in BOTH directions, through the gate, on both filesystems. FALSE GREEN on m-crow-green: pristine exit 1 / gaps / one gap; mutant exit 0 / clean / zero. sarif results 1 to 0, attest verdict… |
| 664 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 664 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 664 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 664 | EqualityOperator | `proposedStatus(st) === null` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 665 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

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

### verifyEvidenceLock — 7 survivor(s): 5 hole · 1 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 1013 | StringLiteral | `""` | equivalent | `readFileSync(path, "")` does not throw: an empty encoding is falsy, so Node returns the raw Buffer instead of decoding. The ONLY consumer of that value is `JSON.parse(...)` on the very next token, a… |
| 1016 | StringLiteral | `""` | hole | The mutated literal is the violation's RULE ATTRIBUTION, `rule: "(seal)"`, not its message. Battery: observable on 5 (json:t-corrupt-lock, json:t-lock-badutf8, json:t-lock-bom, json:t-lock-utf16, tex… |
| 1024 | StringLiteral | `""` | hole | Same literal, the unknown-version branch. Battery: observable on 3 (json:t-unknown-version, json:t-multi, text:t-multi). tools/rulefield.mjs on t-unknown-version: pristine `exit=1 ["(seal)"]`, mutant… |
| 1029 | StringLiteral | `""` | hole | Same literal, the zero-files branch. Battery: observable on 2 (json:t-zero-files, text:t-zero-files). tools/rulefield.mjs on t-zero-files: pristine `exit=1 ["(seal)"]`, mutant `exit=1 [""]`, the mess… |
| 1037 | ConditionalExpression | `false` | display-only | The mutated node is `abs === rootAbs`, so the containment test becomes `isAbsolute(rel) \|\| !(false \|\| abs.startsWith(rootAbs + sep))`. Built t-root-key for it: a lock whose key is `.`, the only input… |
| 1038 | StringLiteral | `""` | hole | Same `rule: "(seal)"` literal, the escapes-the-project branch. Battery: observable on 4 (json:t-escape-abs, json:t-escape-dotdot, json:t-multi, text:t-multi). tools/rulefield.mjs on t-escape-abs (a l… |
| 1042 | StringLiteral | `""` | hole | Same literal, the sealed-evidence-missing branch. Battery: observable on 5 (json:t-missing-file, json:t-root-key, json:t-multi, text:t-multi, text:t-root-key). tools/rulefield.mjs on t-missing-file (… |

### requiresLedger — 6 survivor(s): 6 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 1356 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1356 | LogicalOperator | `r.requires \|\| REQUIRABLE_NATURES.has(r.requ…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 1359 | ArrayDeclaration | `["Stryker was here"]` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1359, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1365 | ConditionalExpression | `false` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1365, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1368 | ConditionalExpression | `false` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 1368, the machine payload of `check --strict --json` on the `nu` probe mission DIFFERS from the pristine build — the observable exists … |
| 1370 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### splitPointers — 6 survivor(s): 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 65 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The mutant seeds the chunk accumulator with the constant string `Stryker was here`. `splitPointers` has exactly one consumer in the tree — the `for (const chunk of splitPointers(segment))` loop in `p… |
| 66 | StringLiteral | `"Stryker was here!"` | equivalent | The mutant makes the FIRST chunk carry the prefix `Stryker was here!`. Every path by which that could move a pointer is closed. (1) It cannot CREATE one: the literal has no `:`, and `POINTER_PREFIX` … |
| 80 | Regex | `/([\s,])(file\|test\|adr):\S/` | equivalent | The mutant deletes the `^` alternative, and that alternative is unreachable code at this call site. The regex is only ever evaluated as the right-hand operand of `if (/\s\|,/.test(ch) && /(^\|[\s,])(fi… |
| 82 | StringLiteral | `"Stryker was here!"` | equivalent | Same mechanism as the line-66 mutant, applied to every chunk after a cut rather than to the first: the buffer restarts with `Stryker was here!` instead of empty. The closures are identical and none o… |
| 88 | MethodExpression | `out` | equivalent | Removing the filter changes exactly which chunks reach the consumer, and the chunks it removes are precisely those on which the consumer is a no-op. `out.filter((x) => x.trim())` drops a chunk if and… |
| 88 | MethodExpression | `x` | equivalent | The predicate becomes the truthiness of the raw chunk instead of the truthiness of its trimmed form. For strings those two predicates disagree on exactly one class of value: the whitespace-only chunk… |

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

### isSpelling — 2 survivor(s): 1 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 278 | ConditionalExpression | `true` | equivalent | The empty spelling cannot pass either call site. At the exported parameter, the very next test rejects it for EVERY root: identity cannot hold because falsy roots are filtered out one line above, and… |
| 278 | StringLiteral | `"Stryker was here!"` | hole | Two observable flips. (a) Case B6, as above: the empty spelling is no longer excluded, null becomes 'src'. (b) Case B7, unique to this mutant: a legitimate spelling equal to the marker string is now … |

### caseFold — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 300 | MethodExpression | `s.normalize("NFC").toLowerCase().toUpperCas…` | equivalent | The fold's output is never rendered or returned; its single consumer compares two folded names, so only the PARTITION it induces can be observed. The two folds induce the same partition, measured thr… |

### clean — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 195 | Regex | `/[),.:ˋ]$/` | defence-in-depth | Strips one trailing character instead of the run, so a pointer ending in two of ),.: or a backtick keeps the second-to-last — RWD-2026-0055 re-opened one character short. Caught by the cheapest leg o… |

### pathShaped — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 122 | Regex | `/\.[^./]+/` | equivalent | Dedicated control built (no changing sibling): inverting `token.includes("/")` makes the probe diverge on `ptr\|*`. The survivor lifts the `$` anchor of `/\.[^./]+$/`: on the ten tokens measured (`x.t… |

### POINTER_PREFIX — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 28 | Regex | `/\b(file\|test\|adr):(\S.*)/` | hole | Verified by exit code. On m3, whose only cell is `file:code/deleted-j.ts<U+2028> a trailing note` and whose cited file does not exist, `check --strict --json` went from **exit 0 to exit 1**, gaining … |

### prosePointerLedger — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 1533 | StringLiteral | `"Stryker was here!"` | equivalent | Dedicated control built (no changing sibling): altering the pushed `deliverable` makes the probe diverge on `ledgerProse\|*`. The survivor replaces the `""` of `row.evidence \|\| ""` with a literal: it … |

### renderEvidenceLock — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 995 | StringLiteral | `""` | hole | Shipped probe on f-plain: no observable difference — the probe never runs `--freeze`, so it never calls this function. Battery: observable on 2, both freeze runs (freeze:f-plain, freeze:f-bracket), w… |

### sha256 — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 941 | StringLiteral | `""` | hole | THE MOST SERIOUS OF THE SIXTEEN: it flips the gate in BOTH directions on a sealed, tampered-with mission. Shipped probe on t-lock-sentinel: OBSERVABLE, exit-code. Battery: observable on 3 (json:t-loc… |

### symbolPresent — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 23 | Regex | `/[A-Za-z_$][A-Za-z0-9_$]*$/` | hole | FALSE GREEN, verified by exit code, and three further observations in three other shapes. (1) m2, whose only defect is the cell `file:code/b.ts#a.b`: `check --strict --json` went from **exit 1 to exi… |

## Module: delegation-sample

Survivors: 281

Holes: 281 · Equivalent: 0 · Display-only: 0 · Defence-in-depth: 0

**Whole net: never run for this module.** Its `hole` filings rest on the unit suite alone, so they claim less than the vocabulary above says — read them as *pass 1 only*.

### parseSampleLedger — 164 survivor(s): 164 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 187 | Regex | `/ /` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 187 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 190 | MethodExpression | `raw` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | LogicalOperator | `!r && typeof r !== "object"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | LogicalOperator | `(!r \|\| typeof r !== "object") && Array.isAr…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | LogicalOperator | `(!r \|\| typeof r !== "object" \|\| Array.isArr…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 201 | LogicalOperator | `(!r \|\| typeof r !== "object" \|\| Array.isArr…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 202 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 218 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 219 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 224 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 225 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 226 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 227 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 232 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 233 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 243 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 243 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 243 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 243 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 243 | LogicalOperator | `E === null && P === null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 245 | BooleanLiteral | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 245 | ObjectLiteral | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 248 | ArithmeticOperator | `(isoDay(a.period) ?? -Infinity) + (isoDay(b…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 248 | ArrowFunction | `() => undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 248 | LogicalOperator | `isoDay(b.period) && -Infinity` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 248 | MethodExpression | `[...groups.values()]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 248 | UnaryOperator | `+Infinity` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 248 | UnaryOperator | `+Infinity` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 250 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 250 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 254 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 254 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 255 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 256 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 270 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 271 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 277 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 278 | LogicalOperator | `charter.sample.seeds && "?"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 278 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 278 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 280 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 285 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 288 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 289 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 290 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 291 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 295 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 295 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 295 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 295 | LogicalOperator | `start < E && (start - E) % P !== 0` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 296 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | EqualityOperator | `size <= 1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | LogicalOperator | `typeof size !== "number" && !Number.isInteg…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | LogicalOperator | `(typeof size !== "number" \|\| !Number.isInte…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 302 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 303 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | LogicalOperator | `typeof nSeeds !== "number" && !Number.isInt…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | LogicalOperator | `(typeof nSeeds !== "number" \|\| !Number.isIn…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 306 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 307 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 308 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 308 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 308 | EqualityOperator | `charter.sample.seeds === null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 309 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 310 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 311 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 314 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 315 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 319 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 320 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 323 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 323 | LogicalOperator | `Array.isArray(d.population) \|\| d.population…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 323 | MethodExpression | `d.population.some(isPopItem)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 324 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 325 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 326 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 327 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 331 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 333 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 334 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 336 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 337 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 342 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 342 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 342 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 342 | EqualityOperator | `day <= start` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 342 | EqualityOperator | `day > end` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 349 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 352 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 352 | LogicalOperator | `Array.isArray(d.items) \|\| d.items.every(isI…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 352 | MethodExpression | `d.items.some(isItem)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 353 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 354 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 355 | OptionalChaining | `items.length` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 356 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 356 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 356 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 356 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 356 | LogicalOperator | `popOk \|\| randomness !== null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 356 | LogicalOperator | `popOk && randomness !== null \|\| typeof size…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 357 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 357 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 357 | LogicalOperator | `items \|\| expected` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 359 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 359 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 360 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 363 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 368 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 368 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 368 | LogicalOperator | `str(r.reviewer) \|\| foldName(r.reviewer) !==…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 368 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 369 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 370 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 371 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 371 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 371 | LogicalOperator | `Array.isArray(r.verdicts) \|\| r.verdicts.eve…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 371 | LogicalOperator | `str(v) \|\| VERDICTS.has(v)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 371 | MethodExpression | `r.verdicts.some(v => str(v) && VERDICTS.has…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 374 | OptionalChaining | `d.shipped.digest` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 377 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | LogicalOperator | `Array.isArray(v.seeds) \|\| v.seeds.every(s =…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | LogicalOperator | `isItem(s) && str(s.defect) \|\| str(s.nonce)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | LogicalOperator | `isItem(s) \|\| str(s.defect)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 382 | MethodExpression | `v.seeds.some(s => isItem(s) && str(s.defect…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 383 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 383 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 383 | LogicalOperator | `!seeds && seeds.length !== commitments.leng…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 384 | LogicalOperator | `seeds?.length && 0` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 384 | OptionalChaining | `seeds.length` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 384 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 387 | ArithmeticOperator | `j - 1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 388 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | LogicalOperator | `seeds \|\| items` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | LogicalOperator | `seeds && items \|\| expected` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 389 | LogicalOperator | `seeds && items && expected \|\| randomness !=…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 391 | ArrowFunction | `() => undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 391 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 391 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 391 | LogicalOperator | `placed.full.length !== items.length && plac…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 391 | MethodExpression | `placed.full.every((x, i) => !same(x, items[…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 392 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 403 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### drawSample — 22 survivor(s): 22 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 110 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 110 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 110 | EqualityOperator | `canonical(a) <= canonical(b)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 110 | EqualityOperator | `canonical(a) >= canonical(b)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 110 | EqualityOperator | `canonical(a) <= canonical(b)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 110 | EqualityOperator | `canonical(a) >= canonical(b)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 115 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 115 | UpdateOperator | `k--` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 116 | ArithmeticOperator | `cands.length + 1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 119 | EqualityOperator | `u <= 0` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 127 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 128 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 128 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 128 | EqualityOperator | `out.length < size` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 128 | EqualityOperator | `out.length > size` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 130 | ArrowFunction | `() => undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 130 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 130 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 130 | EqualityOperator | `p.stratum !== s` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 130 | MethodExpression | `pool` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 131 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 132 | CallExpression | `;` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### sampleState — 20 survivor(s): 20 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 430 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | EqualityOperator | `latestDay > cursor` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | LogicalOperator | `cursor !== null \|\| P !== null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 430 | LogicalOperator | `cursor !== null && P !== null \|\| latestDay …` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 431 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 435 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 435 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 435 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 435 | LogicalOperator | `a === null && b === null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 439 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 439 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 439 | EqualityOperator | `s.status !== "control-missed"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 439 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 441 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 446 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 447 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### isHex — 14 survivor(s): 14 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 67 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | LogicalOperator | `typeof s !== "string" && s.length === 0` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | LogicalOperator | `(typeof s !== "string" \|\| s.length === 0) &…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 69 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 69 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 69 | EqualityOperator | `bytes === undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 70 | BooleanLiteral | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 72 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 72 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 72 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### isItem — 13 survivor(s): 13 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | LogicalOperator | `!!o && typeof o === "object" && str(o.strat…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | LogicalOperator | `!!o && typeof o === "object" && str(o.strat…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | LogicalOperator | `!!o \|\| typeof o === "object"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | LogicalOperator | `!!o && typeof o === "object" \|\| str(o.strat…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | LogicalOperator | `!!o && typeof o === "object" && str(o.strat…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 163 | LogicalOperator | `!!o && typeof o === "object" && str(o.strat…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### canonical — 8 survivor(s): 8 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 90 | BooleanLiteral | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | BooleanLiteral | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | EqualityOperator | `i.shipped !== true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 90 | EqualityOperator | `i.agent !== true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### isPopItem — 8 survivor(s): 8 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 167 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | LogicalOperator | `isItem(x) \|\| STRATA.includes(o.stratum)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | LogicalOperator | `isItem(x) && STRATA.includes(o.stratum) && …` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | LogicalOperator | `isItem(x) && STRATA.includes(o.stratum) \|\| …` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 168 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 168 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### readSampleLedger — 8 survivor(s): 8 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 416 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 416 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 416 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 416 | LogicalOperator | `E === null && charter.sample.periodDays ===…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 416 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 418 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 422 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 423 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### placeSeeds — 6 survivor(s): 6 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 142 | ArrowFunction | `() => undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 142 | UnaryOperator | `+1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 144 | ArithmeticOperator | `uniform(randomness, "", "seed", j) / (full.…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 144 | ArithmeticOperator | `full.length - 1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 144 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 144 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### passingCovers — 4 survivor(s): 4 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 454 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 454 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 454 | EqualityOperator | `a < day` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 454 | EqualityOperator | `day <= b` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### same — 4 survivor(s): 4 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 170 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 170 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 170 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 170 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### shippedDigest — 4 survivor(s): 4 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 156 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 156 | EqualityOperator | `p.shipped !== true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 156 | MethodExpression | `pop.filter(p => p.stratum === "merge" && p.…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 157 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### DRAND_QUICKNET — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 50 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 51 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### leftover — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 181 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### populationHash — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 94 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### RANDOMNESS_DECLARED — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 42 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### str — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 160 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

## Module: conformance

Survivors: 202

Holes: 147 · Equivalent: 52 · Display-only: 3 · Defence-in-depth: 0

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### charterActGaps — 24 survivor(s): 24 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 845 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 851 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 851 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 851 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 851 | EqualityOperator | `day <= from` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 851 | LogicalOperator | `from !== null \|\| day !== null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 855 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 857 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 857 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 857 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 857 | EqualityOperator | `day >= until` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 857 | LogicalOperator | `until !== null \|\| day !== null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 861 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 861 | EqualityOperator | `day > x.from` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 861 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 862 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 862 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 862 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 862 | EqualityOperator | `day > y.from` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 862 | LogicalOperator | `foldName(y.delegate) === foldName(e.by ?? "…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 862 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 866 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 866 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 866 | EqualityOperator | `day > sample.unsampledFrom` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### unratifiedAdrs — 20 survivor(s): 17 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 263 | Regex | `/DRAFT-/i` | hole | A file whose NAME contains 'DRAFT-' anywhere other than at the start becomes a DRAFT. Recipe: mission init --example + adr/ADR-0115-DRAFT-mid.md with the body '**Status**: accepted'. Measured: shippe… |
| 266 | StringLiteral | `"Stryker was here!"` | equivalent | draftBody's initialiser is only observable if readFileSync throws (success overwrites it). Throwing path probed and measured: DRAFT-h-dir.md as a directory (EISDIR) and a giant 540 MiB DRAFT (utf8 be… |
| 268 | StringLiteral | `""` | hole | Measured (Node 24.18.0): readFileSync(p, "") does not throw — '' is falsy, the read returns a Buffer, and regex.test coerces through toString() whose default is utf8: below V8's string cap (~512 MiB)… |
| 271 | Regex | `/\s*(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | Without the anchor, a mention of 'status: rejected' in the MIDDLE of a line counts as a resolution. Recipe: mission init --example + adr/DRAFT-f-rej-mid.md whose body is '# DRAFT\nThe previous status… |
| 271 | Regex | `/^\s(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | \s* → \s requires exactly ONE whitespace before the status: 'Status: rejected' in column 0 — the canonical form of the ADR-0038 resolved DRAFT — no longer matches. Recipe: mission init --example + DR… |
| 271 | Regex | `/^\S*(?:\*\*status\*\*\|status)\s*:\s*reject…` | hole | \s* → \S*: \S* cannot cross leading spaces, an INDENTED status line no longer matches (column 0 survives through backtracking on an empty \S*). Recipe: mission init --example + DRAFT-c-rej-indent.md … |
| 271 | Regex | `/^\s*(?:\*\*status\*\*\|status)\S*:\s*reject…` | hole | The \s* between the keyword and the colon becomes \S*: the French space before the colon — the typographic rule, not a mistake, the exact pattern that RWD-2026-0084 has just merged into the four stat… |
| 271 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\srejecte…` | hole | After the colon, \s* → \s requires exactly one whitespace: 'Status:rejected' (no space) and 'Status: rejected' (double space) no longer match. Recipe: mission init --example + DRAFT-e-rej-nospace.md … |
| 276 | StringLiteral | `"Stryker was here!"` | equivalent | Dead store: in the non-DRAFT branch, the only path where body's initialiser survives is a readFileSync that throws, and this catch does `continue` — the iteration exits before any read of body. Succe… |
| 278 | StringLiteral | `""` | hole | The same mechanics as the draftBody twin, but here the verdict flips. Measured: readFileSync(p, "") returns a Buffer (encoding '' falsy, no throw) and both .test calls coerce through toString() utf8 … |
| 280 | BlockStatement | `{}` | equivalent | After the emptied catch, the rest of the loop body comes down to the two tests on body — still "" (the initialiser, which this mutation does not touch). "" can match neither /^\s*(?:\*\*status\*\*\|st… |
| 283 | Regex | `/\s*(?:\*\*status\*\*\|status)\s*:\s*hypothe…` | hole | Without the anchor, a mid-line mention is enough to condemn a ratified ADR. Recipe: mission init --example + ADR-0104-hyp-mid.md: '# x\nearlier the status: hypothesis label was wrong\n\n**Status**: a… |
| 283 | Regex | `/^\s(?:\*\*status\*\*\|status)\s*:\s*hypothe…` | hole | The widest of the survivors: \s* → \s requires whitespace before the status, so 'Status: hypothesis' in COLUMN 0 — the canonical form, the one characterize --mine writes — is no longer detected. Reci… |
| 283 | Regex | `/^\S*(?:\*\*status\*\*\|status)\s*:\s*hypoth…` | hole | \s* → \S*: the indented status line escapes detection (\S* does not cross spaces; column 0 survives through backtracking). Recipe: mission init --example + ADR-0101-hyp-indent.md (' Status: hypothesi… |
| 283 | Regex | `/^\s*(?:\*\*status\*\*\|status)\S*:\s*hypoth…` | hole | The French space before the colon stops matching: '**Status** : hypothesis' — the form a French operator writes by typographic rule, the very pattern of RWD-2026-0084 — is no longer detected. Recipe:… |
| 283 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\shypothe…` | hole | After the colon, exactly one whitespace required: 'Status:hypothesis' (no space) and 'Status: hypothesis' (double space) are no longer detected. Recipe: mission init --example + ADR-0103-hyp-nospace.… |
| 284 | StringLiteral | `""` | hole | Not cosmetic: the reason IS what tells the operator which marker to lift, and it travels on three surfaces. Recipe: mission init --example + ADR-0100-hyp-col0.md, check --strict with and without the … |
| 285 | Regex | `/why\S*:\s*UNKNOWN\b/i` | hole | \s* → \S* between 'why' and the colon: 'why : UNKNOWN' with the French space is no longer detected. Recipe: mission init --example + ADR-0111-why-fr.md ('**Status**: accepted' + 'why : UNKNOWN'). Mea… |
| 285 | Regex | `/why\s*:\sUNKNOWN\b/i` | hole | After the colon, exactly one whitespace required: 'why:UNKNOWN' (no space) and 'why: UNKNOWN' (double space) are no longer detected — only the exact mined spelling 'why: UNKNOWN' is still seen. Recip… |
| 286 | StringLiteral | `""` | hole | Same class as the 'Status: hypothesis' reason survivor: the reason is the remediation, on three surfaces. Recipe: mission init --example + ADR-0110-why.md ('**Status**: accepted' + 'why: UNKNOWN'), c… |

### readManifest — 19 survivor(s): 13 hole · 5 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 123 | ConditionalExpression | `false` | equivalent | Without the early return, a document with 0 headings falls through to the rest: heads.length>1 is false, and the loop over lines starts at heads[0]+1 = undefined+1 = NaN; NaN < lines.length is always… |
| 128 | ArithmeticOperator | `i - 1` | hole | Same channel as the previous one, worse: the numbers go to base 0 minus 1, i.e. an offset of TWO — measured "lines 33, 39" for the real lines 35 and 41. The remediation points to existing lines that … |
| 128 | ArrowFunction | `() => undefined` | hole | The refusal's remediation loses its line pointers: measured on the mission with duplicated sections, "(lines 35, 41)" → "(lines , )" (gate violation AND check --json). Exit and count unchanged, so au… |
| 128 | StringLiteral | `""` | hole | The separator disappears and the list of lines merges into a nonexistent number: measured "lines 35, 41" → "lines 3541". Two locations become a single ghost line — a false remediation, not an abbrevi… |
| 135 | Regex | `/\s*(ˋˋˋ\|~~~)/` | hole | Lines-loop version of mutant 2: any line of the SECTION containing an inline ``` toggles `fenced`. Recipe: a prose line "note: wrap format examples in ``` fences when documenting" between two rows of… |
| 135 | Regex | `/^\S*(ˋˋˋ\|~~~)/` | hole | The most serious direction: REFUSE broken. Measured recipe: green example mission, a required row of architecture.md moved INSIDE an indented fence ("␣␣```" … "␣␣```") — an illustration the gate must… |
| 141 | Regex | `/^#{1,6}\S/` | hole | Through backtracking, /^#{1,6}\S/ still matches every heading with ≥2 hashes (the last # serves as \S — checked: "## 5. What stays open" matches, "# Annexe" does not): only a LEVEL 1 heading stops cl… |
| 143 | MethodExpression | `line` | hole | Two honest GFM-legal forms break. A: table indented by 2 spaces (identical rendering) — the rows no longer "start" with \| and are lost WITHOUT a problem: measured rows [] problems [], CLI exit 0→1 wi… |
| 148 | MethodExpression | `t.startsWith("\|")` | hole | At this point t always starts with \| (filter two lines above), so the condition becomes always true: EVERY GFM-open row (final pipe omitted — valid, identical rendering, explicitly supported by this … |
| 148 | StringLiteral | `""` | hole | endsWith("") is always true: the same always-slice(1,-1) behaviour as the previous mutant, and the measurements are byte-identical (same battery diff on the GFM-open row, same exit 0→1 flip on the tr… |
| 155 | MethodExpression | `cols[0] ?? ""` | equivalent | Each cell is already .trim()med in the map that builds cols two lines above; trim is idempotent (same spec definition of whitespace), so the truthiness of (cols[0] ?? "").trim() and of (cols[0] ?? ""… |
| 155 | Regex | `/:?-+:?$/` | hole | The malformed-row guard goes from full match to suffix match on the separator pattern: a 2-column row whose first cell ENDS with a dash ("\| my-rule- \| applied" — a trailing-dash typo) is taken for ta… |
| 155 | Regex | `/^:?-+:?/` | hole | The same guard widened to a prefix match: a 2-column row whose first cell STARTS with a dash ("\| --legacy \| applied" — a stuck list dash) is swallowed as a separator, its report suppressed. Measured:… |
| 155 | Regex | `/^rule/i` | hole | Header guard widened to a prefix: "\| rules-of-engagement \| applied" (2 columns) is read as the "Rule" header and disappears without a report. Measured: exit 1→0, violation 1→0. The same class of mute… |
| 155 | Regex | `/rule$/i` | hole | The header guard widened to a suffix: a 2-column row whose first cell ends with "rule" ("\| house-logging-rule \| applied") is taken for the table header and its loss is no longer reported. Measured: e… |
| 155 | StringLiteral | `"Stryker was here!"` | equivalent | The `??` fallback is dead code: cols comes from String.prototype.split, which always returns ≥1 element (even "" gives [""]) then from a map — so cols[0] is always a defined string and the fallback i… |
| 155 | StringLiteral | `"Stryker was here!"` | equivalent | Second dead `??` fallback on the same line, same proof as occurrence 1: cols[0] is never nullish (split returns ≥1 element for any string), the replaced literal is never evaluated. Identical sensitiv… |
| 156 | MethodExpression | `t` | display-only | Argued as hard as a hole: the only measurable difference, across the whole battery and the 20 missions, is the LENGTH of the excerpt of the faulty row echoed in the "needs 3 columns" message (measure… |
| 177 | BooleanLiteral | `true` | equivalent | Dedicated control built (no changing sibling): inverting `if (heads.length === 0)` makes the probe diverge on `rows\|*`. The survivor is on the initialisation of a fence flag immediately reassigned by… |

### readRatification — 18 survivor(s): 15 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 461 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 461 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 465 | Regex | `/#{1,6}\s/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 465 | Regex | `/^#{1,6}\S/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 467 | Regex | `/- (\d{4}-\d{2}-\d{2}) · rows: ([^·]+) · (.…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 467 | Regex | `/^- (\d{4}-\d{2}-\d{2}) · rows: ([^·]+) · (…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 470 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 470 | MethodExpression | `(m[3].match(/mode: (.+)$/) ?? [, ""])[1]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 470 | Regex | `/mode: (.+)/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 470 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 471 | MethodExpression | `m[2].replace(/\((\d+)\)\s*$/, "").split(","…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 471 | Regex | `/\((\d+)\)\s*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 471 | Regex | `/\((\d)\)\s*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 471 | Regex | `/\((\d+)\)\S*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 644 | MethodExpression | `pair` | equivalent | r and d are each trimmed before any use (`/^[0-9a-f]{16}$/.test(d.trim())`, `bound[r.trim()] = d.trim()`): trimming the pair first is redundant. Measured: 0 of 21 cases differ, including a `bound:` s… |
| 655 | EqualityOperator | `at >= 0` | equivalent | `at === 0` means a segment that starts with `:`; the key is then `seg.slice(0, 0)`, the empty string, in both versions, which is none of by, for or proposer, and the segment is ignored the same way. … |
| 655 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback key of a segment with no `:`. `Stryker was here!` is none of by, for or proposer either, so the segment is ignored exactly as with the empty key. Measured: 0 of 21 cases differ, includin… |
| 687 | MethodExpression | `seg.slice(at + 2)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### parseRuleMeta — 16 survivor(s): 10 hole · 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 42 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback only fires on a rule file WITHOUT frontmatter. fm has only three consumers, the three impact/phases/signature matches; the literal "Stryker was here!" contains none of the substrings imp… |
| 43 | MethodExpression | `fm.match(/^impact:\s*(.+)$/m)?.[1] ?? ""` | hole | RECIPE: example mission, an architect rule (contracts-governance.md) carries "impact: CRITICAL" followed by ONE trailing space (a mundane editor gesture), lock re-signed. MEASURED: shipped build → "A… |
| 43 | Regex | `/impact:\s*(.+)$/m` | hole | Without ^, match() takes the FIRST occurrence of "impact:" anywhere in the frontmatter, including mid-line. RECIPE: example mission, contracts-governance.md receives before its impact line an operato… |
| 43 | Regex | `/^impact:\s*(.+)/m` | equivalent | $ is redundant after a greedy (.+): in JS the dot excludes line terminators (\n AND \r), so (.+) extends exactly to the position where multiline $ always succeeds — no backtracking possible, identica… |
| 43 | Regex | `/^impact:\s(.+)$/m` | hole | \s requires exactly one whitespace where \s* accepts zero. RECIPE: example mission, contracts-governance.md carries "impact:CRITICAL" without a space after the colon — a form the shipped parser ACCEP… |
| 43 | Regex | `/^impact:\S*(.+)$/m` | hole | The same door as the \s mutant but from the other edge: on "impact: CRITICAL" \S* matches empty before the space (identical), but on "impact:CRITICAL" the greedy \S* swallows the value and backtracki… |
| 43 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback only fires on a rule WITHOUT an impact line. parseRuleMeta is private to the module: impact has only ONE consumer, expectedRules's test impact === "CRITICAL" \|\| impact === "HIGH" (ruleSi… |
| 44 | Regex | `/phases:\s*\[(.*)\]/m` | hole | Without ^, the first occurrence of "phases: [...]" wins, even mid-line. RECIPE: example mission, contracts-governance.md receives before its phases line the line "reviewNote: rollout phases: [pilot] … |
| 44 | Regex | `/^phases:\s\[(.*)\]/m` | hole | \s requires whitespace that \s* does not. RECIPE: example mission, contracts-governance.md carries "phases:[architect]" without a space — accepted by the shipped parser, lock re-signed. MEASURED: shi… |
| 44 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback only fires on a rule WITHOUT a phases line; phases then becomes ["Stryker was here!"] instead of []. The only consumer is phases.includes(phaseId) in expectedRules, and phaseId is always… |
| 45 | MethodExpression | `phasesRaw.split(",").map(s => s.trim())` | equivalent | Removing filter(Boolean) can only ADD "" entries to phases (phases: [] → [""], trailing comma → ["architect",""]). The only consumer is phases.includes(phaseId) with phaseId among the five fixed, non… |
| 46 | MethodExpression | `fm.match(/^signature:\s*(.+)$/m)?.[1] ?? ""` | hole | The signature is a regex SOURCE (ADR-0020): an untrimmed trailing whitespace becomes a literal space required in the proof. RECIPE: example mission, frontier-deterministic-boundary.md (signed rule, a… |
| 46 | Regex | `/signature:\s*(.+)$/m` | hole | Without ^, the first occurrence of "signature:" in the frontmatter wins. RECIPE: example mission, frontier-deterministic-boundary.md receives before its signature line the line "reviewNote: the signa… |
| 46 | Regex | `/^signature:\s*(.+)/m` | equivalent | The same identity as the twin mutant on impact: $ is redundant after a greedy (.+), the JS dot excluding \n and \r, the final position of (.+) is exactly the one where multiline $ always succeeds — i… |
| 46 | Regex | `/^signature:\s(.+)$/m` | hole | The worst direction: the gate falls silent. RECIPE: example mission, frontier-deterministic-boundary.md carries "signature:zzqx9" without a space, a pattern absent from the cited proof — the shipped … |
| 46 | Regex | `/^signature:\S*(.+)$/m` | hole | Same recipe as the \s twin ("signature:zzqx9" without a space, pattern absent from the proof), different mechanics: the greedy \S* swallows the value and backtracking leaves the last character to (.+… |

### decisionCoverage — 14 survivor(s): 13 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 301 | StringLiteral | `""` | hole | endsWith('') is always true: every non-.md file in runward/adr/ enters the count of decisions. Measured recipe: mission init + ADR-0007 accepted + notes.txt in adr/; `check --coverage` shipped: 'Deci… |
| 304 | ConditionalExpression | `true` | hole | Every file goes through the DRAFT branch: a NON-draft rejected ADR is evicted from the total (its Status: rejected line triggers the exclusion reserved for DRAFTs, ADR-0038). Measured recipe: mission… |
| 304 | ConditionalExpression | `false` | hole | The DRAFT branch no longer applies: a rejected DRAFT — the operator's durable 'not a decision' (ADR-0038) — is counted. Measured recipe: mission init + ADR-0007 accepted + DRAFT-ADR-0010-rejected.md … |
| 304 | Regex | `/DRAFT-/i` | hole | Anchor ^ lost: an ADR name containing 'draft-' as an infix is routed into the DRAFT branch. Measured recipe: mission init + ADR-0007 accepted + ADR-0011-remove-draft-workflow.md ('**Status**: rejecte… |
| 305 | BlockStatement | `{}` | hole | Empty try: no exception, no return, fall-through out of the DRAFT block to the final return true — the same degeneration as the previous mutant by another path. Measured recipe: mission init + ADR-00… |
| 306 | Regex | `/\s*(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | Without ^, 'status: rejected' matches anywhere in a line: a hypothesis DRAFT whose prose mentions an upstream rejection is evicted from the count. Measured recipe: mission init + ADR-0007 accepted + … |
| 306 | Regex | `/^\s(?:\*\*status\*\*\|status)\s*:\s*rejecte…` | hole | ^\s requires whitespace before status. The probe first showed that this mutant SURVIVES the obvious fixture (status line preceded by an empty line: in m mode, \s eats the \n of the empty line and the… |
| 306 | Regex | `/^\S*(?:\*\*status\*\*\|status)\s*:\s*reject…` | hole | ^\S* no longer crosses indentation: an indented ' **Status**: rejected' is no longer recognised. Measured recipe: mission init + ADR-0007 accepted + DRAFT-ADR-0013-rejected.md whose status line is in… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s:\s*rejecte…` | hole | \s: requires exactly one whitespace between status and the colon: the corpus's CANONICAL form '**Status**: rejected' (zero whitespace before :) no longer matches, and the bare alternative 'status' ca… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\S*:\s*reject…` | hole | \S*: no longer crosses whitespace before the colon: '**Status** : rejected' (space before the colon — French typography, real in this FR corpus) is no longer recognised. Measured recipe: mission init… |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\srejecte…` | hole | :\s requires exactly one whitespace after the colon: '**Status**:rejected' (no space) is no longer recognised. Measured recipe: mission init + ADR-0007 accepted + DRAFT-ADR-0015-rejected.md carrying … |
| 306 | Regex | `/^\s*(?:\*\*status\*\*\|status)\s*:\S*reject…` | hole | :\S* cannot cross the space after the colon: the CANONICAL form '**Status**: rejected' (one space) no longer matches — the same breakage of the house convention as the \s: mutant on the left side. Me… |
| 306 | StringLiteral | `""` | equivalent | readFileSync(p, ''): the empty-string encoding is falsy, Node returns a Buffer (checked: Buffer.isBuffer = true, no throw). RegExp.test coerces its argument through String(buf) = buf.toString(), whos… |
| 309 | BooleanLiteral | `false` | hole | The DRAFT branch's catch now answers 'excluded': an unreadable DRAFT disappears from the total while staying in the to-ratify list (unratifiedAdrs, not mutated, pushes it through its own catch). Meas… |

### declaredUncarriableNatures — 14 survivor(s): 1 hole · 13 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 178 | ConditionalExpression | `false` | hole | The 'no runward/adr/' guard is skipped: adrFilename goes from null to an ENOENT throw (measured at function level on a missionDir without adr/). Surface: collectSealableEvidence, hence the attestatio… |
| 374 | MethodExpression | `readdirSync(dir)` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 374 | MethodExpression | `readdirSync(dir).filter(f => /^ADR-.*\.md$/…` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 374 | Regex | `/ADR-.*\.md$/i` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 374 | Regex | `/^ADR-.*\.md/i` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 376 | BlockStatement | `{}` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 384 | BlockStatement | `{}` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 387 | Regex | `/\*\*Nature not carried\*\*:\s*([a-z][a-z0-…` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 387 | Regex | `/^\*\*Nature not carried\*\*:\s([a-z][a-z0-…` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 392 | OptionalChaining | `name.match(/^ADR-\d+/i)[0]` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 392 | Regex | `/ADR-\d+/i` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 393 | ConditionalExpression | `true` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 393 | LogicalOperator | `id \|\| !out.has(line[1].toLowerCase())` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |
| 393 | MethodExpression | `line[1].toUpperCase()` | equivalent | NO mutant of this function moves the probe, so a DEDICATED CONTROL was built rather than concluding from an absence: replacing `out.set(line[1].toLowerCase(), id)` with an arbitrary key, and invertin… |

### adrDecision — 10 survivor(s): 8 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 204 | Regex | `/ADR-0+$/i` | hole | False red. Without ^, the second disjunct matches any stripped name ENDING in "adr-0+". Recipe: healthy ratified ADR `ADR-0006-supersede-adr-00.md` (title ending with the reference to the template it… |
| 204 | Regex | `/^ADR-0$/i` | hole | FALSE GREEN of the gate, the most serious filing of this batch along with 13 and 14. The second disjunct guards exactly the all-zeros names WITHOUT an extension; reduced to exact "ADR-0", it no longe… |
| 204 | Regex | `/\.md/i` | hole | False red with a pathological footprint, but measured. The unanchored replace removes the FIRST ".md" wherever it is. Recipe: file `ADR-0.md00` with accepted content, deviated citing ADR-0; fixture .… |
| 204 | Regex | `/ADR-0+(?:-\|\.md$)/i` | hole | Realistic false red. Without ^, template detection matches the INTERNAL mention "adr-0000-" in a name. Recipe: healthy ratified ADR named `ADR-0005-retire-adr-0000-template.md` (an ADR whose title ci… |
| 204 | Regex | `/^ADR-0+(?:-\|\.md)/i` | hole | Narrow-footprint false red. Without $ after .md, a non-final ".md" is enough. Recipe: file `ADR-000.md.bak` (a backup with real accepted content of 40+ characters), deviated row citing ADR-000; fixtu… |
| 204 | StringLiteral | `"Stryker was here!"` | equivalent | Equivalence by subsumption, proven then swept. The replacement text only matters if hit ends in ".md"; but every hit whose stripped form would be "ADR-0+" has the form "ADR-0+.md", already caught by … |
| 213 | BlockStatement | `{}` | hole | The verdict is replaced by a crash. Recipe: ADR `ADR-0008-locked.md` with valid content set to chmod 000, cited by a deviated row (fixture .probe-5/fx/r-locked). Shipped: exit 1 + the operator line "… |
| 214 | StringLiteral | `ˋˋ` | hole | FALSE GREEN. The empty string returned by the catch is falsy: adrProblem passes it up and `if (why)` pushes no violation — an UNREADABLE ADR satisfies the deviation. Recipe identical to the previous … |
| 216 | MethodExpression | `text` | hole | FALSE GREEN at the heart of the empty-file defence. Recipe: `ADR-0007-padded.md` = 60 characters of pure whitespace (raw length 60 >= ADR_MIN_CHARS=40, trimmed length 0), cited by a deviated row; fix… |
| 314 | LogicalOperator | `!abs && !hit` | equivalent | Four siblings KILLED in this function (the three `", "` separators and the filter of directories already named), two of which were only caught after adding an extra journal and then a fourth: sensiti… |

### manifestSections — 9 survivor(s): 4 hole · 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 115 | EqualityOperator | `i <= lines.length` | equivalent | The heading scan's extra iteration reads lines[lines.length] === undefined; RegExp.test coerces it to the constant string 'undefined', which matches neither /^\s*(```\|~~~)/ nor /^#{1,6}\s+Rule confor… |
| 116 | Regex | `/\s*(ˋˋˋ\|~~~)/` | hole | Unanchored, the fence regex toggles `fenced` on any line CONTAINING an inline ```. HONEST-REFUSAL recipe: green `init --example` mission + a prose line "Note: wrap format examples in ``` fences." bef… |
| 116 | Regex | `/^\S*(ˋˋˋ\|~~~)/` | hole | CommonMark allows a fence indented by up to 3 spaces; the mutant stops following it. Recipe A: an illustration inside an indented fence ("␣␣```") whose fake example heading is in column 0 → measured … |
| 120 | Regex | `/#{1,6}\s+Rule conformance/i` | hole | Unanchored, the regex counts a MENTION in prose as a section heading. Recipe: add "The ## Rule conformance table below accounts for every mapped rule." above the real section → measured exit 0→1, ref… |
| 120 | Regex | `/^#{1,6}\sRule conformance/i` | hole | \s+ → \s: a heading written "##␣␣Rule conformance" (double space — identical markdown rendering) is no longer recognised. Measured directly: rows [] AND problems [] — doubly silent, the deliverable "… |
| 160 | EqualityOperator | `i <= lines.length` | equivalent | Five survivors for four siblings KILLED in the same function (the fence toggle, its regex without `^`, the inner fence block, the inversion of `inFence`): so the probe is measurably sensitive here, o… |
| 161 | Regex | `/\s*(ˋˋˋ\|~~~)/` | equivalent | Five survivors for four siblings KILLED in the same function (the fence toggle, its regex without `^`, the inner fence block, the inversion of `inFence`): so the probe is measurably sensitive here, o… |
| 165 | Regex | `/#{1,6}\s/` | equivalent | Five survivors for four siblings KILLED in the same function (the fence toggle, its regex without `^`, the inner fence block, the inversion of `inFence`): so the probe is measurably sensitive here, o… |
| 165 | Regex | `/^#{1,6}\S/` | equivalent | Five survivors for four siblings KILLED in the same function (the fence toggle, its regex without `^`, the inner fence block, the inversion of `inFence`): so the probe is measurably sensitive here, o… |

### conformance — 8 survivor(s): 7 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 356 | ConditionalExpression | `true` | equivalent | When floor is defined the two forms are identical; when EXPECTED_MAPPED[phaseId] is undefined the mutant evaluates 'expected.length < undefined', which is false for every n under JS relational semant… |
| 373 | Regex | `/\[.*\]$/` | hole | The placeholder skip /^\[.*\]$/ exists to exempt template rows like '[rule-slug]' from form-lint; dropping the '^' widens it to 'ends with ]', a strict superset, so REAL rows are silently exempted fr… |
| 373 | Regex | `/^\[.*\]/` | hole | The same superset in the other direction: dropping the '$' widens the placeholder skip to 'starts with [', which is exactly a rule cell written as a markdown link — the natural spelling for an operat… |
| 383 | StringLiteral | `ˋˋ` | hole | A remediation deleted from the verdict, which ADR-0046 files alongside a changed violation line. The '— removed in …' hint is the whole reason a corpus carries migrations.json (ADR-0057: an org's ren… |
| 384 | StringLiteral | `""` | hole | Same clause as the migrations hint, on the common case: the typo pointer. RECIPE (2026-08-27): shipped example + row '\| frontier-determistic-boundary \| applied \| file:code/src/demo.ts \|' (one letter … |
| 402 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 402 | Regex | `/^\[.\]$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 408 | ConditionalExpression | `true` | hole | Forcing the applied-guard true makes EVERY valid-status row with an empty Evidence cell collect 'applied without an evidence pointer — put a file:line or a test in the Evidence column'. It cannot fli… |

### agentCause — 7 survivor(s): 7 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 894 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 894 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 894 | EqualityOperator | `day > ctx.sample.unsampledFrom` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 896 | BooleanLiteral | `e.proposerFor` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 896 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 896 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 896 | LogicalOperator | `!e.for && !e.proposer && !e.proposerFor` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### expectedRules — 6 survivor(s): 4 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 81 | ConditionalExpression | `false` | equivalent | rulesDir() guarantees the post-condition: the mission branch is only returned if existsSync(missionRules), otherwise the package's templates/rules — so the guard only fires if the installed package's… |
| 82 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Same reachability as the guard it follows: this return only runs if the package's templates/rules is missing AND the mission has no rules/ — a mutilated package, outside the input universe (packaging… |
| 83 | MethodExpression | `readdirSync(dir).filter(f => f.endsWith(".m…` | hole | The removed .sort() makes the order of expectedRules depend on the filesystem (readdir is not sorted by contract — ext4 returns it in hash order; compliance.readRules sorts explicitly "for the byte-i… |
| 83 | MethodExpression | `readdirSync(dir)` | hole | Without the .md filter, expectedRules reads EVERY entry of the rules/ directory. RECIPE 1: example mission, an operator backup contracts-governance.md.bak next to the rule (the corpus mechanism ignor… |
| 84 | StringLiteral | `""` | hole | endsWith("") is always true: the filter becomes a no-op, measured behaviour identical to removing the filter outright. Same recipes, re-measured under THIS mutant: contracts-governance.md.bak in rule… |
| 89 | Regex | `/\.md/` | hole | Without an anchor, replace removes the FIRST occurrence of ".md" instead of the extension: a name with an infix ".md" changes slug. RECIPE: example mission, rule a.mdx.md (HIGH, architect — a legal n… |

### trivialReason — 5 survivor(s): 4 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 24 | MethodExpression | `s` | equivalent | A real divergence at function level, measured by extracting both forms: trivialReason(" because ") = true shipped / false mutated (untrimmed: length 11 >= 8, and the brackets test is unanchored by th… |
| 25 | Regex | `/\[.*\]$/` | hole | Realistic false red. Recipe: examples/request-triage, a single row of architecture.md changed to `\| hexa-typescript-native \| n/a \| language locked at floor kickoff [ADR-0004] \|` (fixture .probe-5/fx/… |
| 25 | Regex | `/^\[.*\]/` | hole | The symmetric false red of the previous one, on the prefix side. Recipe: same mission, n/a reason `[deferred] language locked at floor kickoff` (fixture .probe-5/fx/g-brack-start); measured: shipped … |
| 37 | EqualityOperator | `new Set(t.toLowerCase().replace(/\s/g, ""))…` | hole | The bound of the lexical-degeneracy fix is not pinned. Recipe: n/a reason `test test` (9 characters, exactly 3 distinct characters t/e/s — the floor the code comment declares: "Three distinct charact… |
| 37 | MethodExpression | `t.toUpperCase()` | hole | Not equivalent, contrary to intuition: case folding is not bijective in Unicode. Measured mechanism: "ßxs ßxs ßxs".toLowerCase() -> Set {ß,x,s} of size 3 (passes); .toUpperCase() -> "SSXS..." because… |

### accountableRelation — 4 survivor(s): 4 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 620 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 622 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 625 | BooleanLiteral | `x.proposerFor` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 625 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### ruleSignatures — 4 survivor(s): 1 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 57 | ConditionalExpression | `false` | equivalent | Argued with a measured sensitivity control, not supposed. On every reachable input the guard is dead code: rulesDir() returns the mission's runward/rules only when existsSync says it exists, else the… |
| 63 | StringLiteral | `"Stryker was here!"` | equivalent | The initializer is dead on every path, and the only path that could expose it was probed. The try's single statement either assigns sig — parseRuleMeta always returns a string signature, '(fm.match(.… |
| 67 | BlockStatement | `{}` | equivalent | When the read throws, sig still holds its initializer "" — the assignment never completed — so control falling out of the emptied catch reaches 'if (sig)' with a falsy value and the file is skipped: … |
| 71 | Regex | `/\.md/` | hole | RWD-2026-0082's territory: a mutant that falsifies the signature-map keying and extinguishes the regex screen. The unanchored replace cuts the FIRST '.md' out of the filename instead of the extension… |

### UNBOUND_CAUSE_TEXT — 4 survivor(s): 2 hole · 2 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 755 | StringLiteral | `""` | display-only | The human text of the `blind` cause becomes empty. The mutant is SEEN: the text disappears from `problem` in check --json, from `unboundText` in ratify --decided --list --json and from the printed li… |
| 756 | StringLiteral | `""` | display-only | The human text of the `no-digest` cause becomes empty. The mutant is SEEN: the text disappears from `problem` in check --json, from `unboundText` in ratify --decided --list --json and from the printe… |
| 924 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 925 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### allRules — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 95 | ConditionalExpression | `false` | equivalent | Exact copy of expectedRules's guard, same post-condition of rulesDir: dir is either the mission's rules/ (existence checked by rulesDir), or the package's templates/rules (shipped through "files", ch… |
| 96 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The tightest of the four guard mutants: reachable only on the same corrupted state (package without templates/rules AND mission without rules/), and EVEN THERE, measured byte for byte identical — the… |
| 97 | Regex | `/\.md/` | hole | Same mechanics as its twin in expectedRules but on the UNIVERSE of known slugs (the "unknown rule" check). RECIPE: the same cli-infix mission (rule a.mdx.md HIGH/architect, n/a row "a.mdx" in archite… |

### declaredNameIn — 3 survivor(s): 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 609 | MethodExpression | `name` | equivalent | Both sources of the name arrive trimmed: the ratify command trims --agent and --for before any call (src/commands/ratify.ts, `opts.agent?.trim()`), and readRatification trims every declared value (by… |
| 610 | ConditionalExpression | `false` | equivalent | n is empty only when the name is, and no caller passes an empty name: the command refuses an empty or blank --agent or --for (unsafeDeclaredName, exit 2 before anything is read), readRatification kee… |
| 611 | BooleanLiteral | `true` | equivalent | The body of the same `!n` guard, and just as unreachable: no caller passes an empty name (unsafeDeclaredName on the command side, `if (value)` on the reading side, a non-empty e.for and a defined e.b… |

### latestDeclaredDay — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 803 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 803 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 803 | EqualityOperator | `d >= latest` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### ADR_SET_ASIDE — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 230 | Regex | `/(rejected\|superseded\|withdrawn\|obsolete)$/` | hole | Narrow-footprint false red. Without ^, any status word ENDING in a keyword becomes set aside. Recipe: ADR with `**Status**: unrejected` cited deviated; fixture .probe-5/fx/g-unrejected, measured: shi… |
| 230 | Regex | `/^(rejected\|superseded\|withdrawn\|obsolete)/` | hole | REALISTIC false red. Without $, a prefix is enough: `**Status**: obsoleted` — a real and common English variant — flips. Recipe: an otherwise healthy ratified ADR with status "obsoleted" cited deviat… |

### ADR_UNRATIFIED — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 231 | Regex | `/(proposed\|hypothesis\|draft\|pending)$/` | hole | Narrow-footprint false red, twin of mutant 15 on the unratified side. Without ^, any word ending in proposed/hypothesis/draft/pending becomes unratified. Recipe: ADR with `**Status**: redraft` cited … |
| 231 | Regex | `/^(proposed\|hypothesis\|draft\|pending)/` | hole | REALISTIC false red. Without $, the prefix "draft" matches `**Status**: drafting` — a plausible status for a real team (just as "proposée" does not match but "drafted" would match too). Recipe: ADR w… |

### adrStatusWord — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 238 | Regex | `/[a-zà-ÿ]+/` | hole | Without the anchor, the status word is fished anywhere in the line instead of the first word. Measured through the function: '**Status**: (proposed — pending ratification)' returns '' (shipped) vs 'p… |

### driftReport — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 344 | MethodExpression | `tokens.every(t => resolveEvidencePath(t, ba…` | hole | Drift (ADR-0004, blocking under --strict since ADR-0021) refuses an applied prose row when NO cited path resolves; the mutant refuses when ANY cited path fails — a false red on prose that tells the t… |

### evidencePathTokens — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 321 | ArrayDeclaration | `["Stryker was here"]` | hole | The classic sentinel-array mutant, and it is NOT equivalent: the sentinel is fed to path resolution. evidencePathTokens' two consumers (evidence.js: the ADR-0019 non-vacuity loop over EVERY row, and … |

### FRONTMATTER — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 17 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | The gate-side twin of the compliance anchor survivor (compliance-top-level.json, key 30\|21\|30\|50), re-probed here on conformance.ts's own FRONTMATTER because this copy feeds parseRuleMeta — expectedR… |

### isAgentMode — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 602 | MethodExpression | `mode` | equivalent | isAgentMode has one caller, readRatification, and it passes a mode already trimmed (`(m[3].match(/mode: (.+)$/) ?? [, ""])[1].trim()`): the function's own trim never meets surrounding whitespace. Mea… |

### locateAdr — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 281 | BlockStatement | `{}` | equivalent | This function's `ArrayDeclaration` sibling — the ADR-0074 list of journals — is KILLED by `the list of journals is the one ADR-0074 ratified`. The survivor is a `catch { continue }` on a `readdirSync… |

### PATH_TOKEN — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 318 | Regex | `/[\w./-]+\.(?:ts\|tsx\|js\|jsx\|mjs\|cjs\|py\|md\|j…` | hole | ya?ml → yaml: the .yml extension drops out of PATH_TOKEN — function measurement: evidencePathTokens('code/config/triage-rules.yml — moved') = [] mutated against ['code/config/triage-rules.yml'] shipp… |

## Module: delegation

Survivors: 131

Holes: 131 · Equivalent: 0 · Display-only: 0 · Defence-in-depth: 0

**Whole net: never run for this module.** Its `hole` filings rest on the unit suite alone, so they claim less than the vocabulary above says — read them as *pass 1 only*.

### parseCharter — 61 survivor(s): 61 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 107 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 107 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 107 | LogicalOperator | `raw.trim() === "" && raw.trimStart().starts…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 107 | MethodExpression | `raw` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 107 | MethodExpression | `raw.trimEnd()` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 107 | MethodExpression | `raw.trimStart().endsWith("#")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 107 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 109 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 109 | MethodExpression | `raw.endsWith("\t")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 109 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 109 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 111 | LogicalOperator | `indented \|\| item.startsWith("- ")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 111 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 117 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 117 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 123 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 123 | MethodExpression | `raw.slice(0, at)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 123 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 123 | UnaryOperator | `+1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 124 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 124 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 125 | MethodExpression | `raw` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 125 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 128 | MethodExpression | `raw.slice(at + 1)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 154 | ArrayDeclaration | `[]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 155 | LogicalOperator | `v.includes("<") \|\| v.includes(">")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 155 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 155 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 161 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 168 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 173 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 184 | ObjectLiteral | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | EqualityOperator | `k !== "R"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 199 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 202 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 208 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 215 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 219 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 220 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 223 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 224 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 225 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 231 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 232 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 233 | LogicalOperator | `expires && ""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 233 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 233 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 234 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 234 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 234 | LogicalOperator | `e0 !== null \|\| e1 !== null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 235 | EqualityOperator | `e1 < e0` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 240 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 240 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 242 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 243 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### unquote — 13 survivor(s): 13 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 56 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | EqualityOperator | `t.length > 2` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | EqualityOperator | `t[0] !== "'"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | LogicalOperator | `t[0] === '"' \|\| t.endsWith('"')` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | LogicalOperator | `t[0] === "'" \|\| t.endsWith("'")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | MethodExpression | `t.startsWith('"')` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | MethodExpression | `t.startsWith("'")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 56 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### positiveInt — 10 survivor(s): 10 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 84 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 84 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 84 | EqualityOperator | `v.length >= 6` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 84 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | EqualityOperator | `ch >= "9"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | LogicalOperator | `ch < "0" && ch > "9"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### isoDay — 9 survivor(s): 9 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 75 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 75 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 75 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 77 | ArrayDeclaration | `[]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 78 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 78 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 78 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 78 | LogicalOperator | `v[i] < "0" && v[i] > "9"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 78 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### confined — 8 survivor(s): 8 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 94 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | EqualityOperator | `p.length <= 1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | EqualityOperator | `p.length >= 1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | LogicalOperator | `!p.startsWith("/") \|\| !(p.length > 1 && p[1…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | MethodExpression | `p.endsWith("/")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 94 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### frontmatter — 7 survivor(s): 7 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 67 | Regex | `/ /` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 67 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 68 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 68 | MethodExpression | `lines[0]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 68 | OptionalChaining | `lines[0].trim` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 71 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 71 | UnaryOperator | `+1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### isKey — 7 survivor(s): 7 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 47 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 47 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 47 | LogicalOperator | `k === "" && !/[A-Za-z]/.test(k[0])` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 47 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 48 | BooleanLiteral | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 50 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 51 | BooleanLiteral | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### missionIdentities — 5 survivor(s): 5 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 292 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 292 | MethodExpression | `[...charter.aliases]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 292 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 296 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### inlineList — 4 survivor(s): 4 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 60 | MethodExpression | `v` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 61 | LogicalOperator | `!t.startsWith("[") && !t.endsWith("]")` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 61 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 61 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### LIST_KEYS — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 43 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 43 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 43 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### isDelegate — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 270 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 270 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### readCharter — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 262 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 263 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

## Module: compliance

Survivors: 98

Holes: 32 · Equivalent: 24 · Display-only: 23 · Defence-in-depth: 19

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### readRules — 31 survivor(s): 8 hole · 5 equivalent · 16 display-only · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
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

### readAdrs — 11 survivor(s): 3 hole · 3 equivalent · 3 display-only · 2 defence-in-depth

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

### govState — 8 survivor(s): 3 hole · 3 equivalent · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 113 | ConditionalExpression | `true` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 113 | ConditionalExpression | `false` | equivalent | SENSITIVITY CONTROL: DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` with NO templateKey, on `governance/threat-model.md` and `governance/evaluati… |
| 113 | EqualityOperator | `st !== "untouched"` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 113 | StringLiteral | `""` | equivalent | SENSITIVITY CONTROL: artifactState's return type is `missing \| untouched \| in-progress \| filled`; it cannot return `""`, so the guard stays constant false exactly as it already is on this path (see t… |
| 114 | StringLiteral | `""` | defence-in-depth | The statement sits inside the `if (st === "untouched")` arm, and that arm is unreachable here. DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` wit… |
| 115 | ConditionalExpression | `false` | hole | SURFACE (C) — threatModelState/evalRubricState reach two places: ISO §4 (`**not counted** (<state>)`, rendered only when the boolean is false) and the terminal line `Governance threat model <state>, … |
| 117 | ConditionalExpression | `true` | equivalent | SENSITIVITY CONTROL: DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` with NO templateKey, on `governance/threat-model.md` and `governance/evaluati… |
| 117 | StringLiteral | `""` | defence-in-depth | The false arm of this ternary is unreachable on this path. DOMAIN (D) — govState is module-private and its only two callers build `{ label: relPath, relPath }` with NO templateKey, on `governance/thr… |

### readConformance — 7 survivor(s): 4 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 64 | ConditionalExpression | `false` | equivalent | Removing the guard means `readFileSync` is called on paths that are not there; it throws ENOENT and the `catch { continue }` two lines below runs the same `continue`. Measured byte-identical on 17 mi… |
| 66 | StringLiteral | `"Stryker was here!"` | equivalent | `body` is declared INSIDE the per-deliverable loop and read only after the `try`; on the only path where the initializer survives, `catch { continue }` has already left the iteration. Measured byte-i… |
| 70 | BlockStatement | `{}` | equivalent | Unlike its sibling in `readRules`, falling through here changes nothing: `body` is re-initialised to `""` at the top of every iteration and `parseManifest("")` finds no `Rule conformance` heading, so… |
| 74 | ConditionalExpression | `false` | hole | COULD NOT CLEAR - filed as a hole because no measurement decided it (the isRegularFile precedent). Survived the unit pass and the whole-net legs of the release gate, and produced no observable differ… |
| 74 | Regex | `/\[.*\]$/` | hole | Unanchored, the placeholder test drops any manifest row whose rule cell merely ENDS in `]`. Recipe: a rule file named `rule-two [draft].md` - legal on every filesystem runward supports - with the mat… |
| 74 | Regex | `/^\[.*\]/` | hole | The mirror of the sibling above: dropping `$` drops any row whose rule cell merely STARTS with `[`. Recipe: a rule file named `[wip] rule-three.md` with the row `\| [wip] rule-three \| n/a \| no queue i… |
| 74 | Regex | `/^\[.\]$/` | hole | COULD NOT CLEAR - filed as a hole because no measurement decided it (the isRegularFile precedent). Survived the unit pass and the whole-net legs of the release gate, and produced no observable differ… |

### renderIso42001Readiness — 7 survivor(s): 1 hole · 2 equivalent · 2 display-only · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 150 | ConditionalExpression | `true` | equivalent | `counts` is written at exactly one site (dist/lib/compliance.js:151) and READ at exactly one site (line 178), where it is read by three literal keys: `counts.applied`, `counts.deviated`, `counts["n/a… |
| 172 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The mutant seeds the fallback of `inputs.asiCoverage.get(id) ?? []` with a non-empty array, so it is observable only when the Map has no entry for an id the loop visits. SENSITIVITY CONTROL — the nea… |
| 173 | StringLiteral | `""` | hole | The fallback string is the pack's declaration that an OWASP ASI category has NO rule mapped and is therefore a gap to assess; the mutant empties it, so the cell renders blank and the gap stops being … |
| 187 | StringLiteral | `""` | display-only | Only distinguishable when a manifest row has an empty Evidence cell, which is a real shape (a `\| rule \| status \| \|` row parses to `evidence: ""`). The cell then renders blank instead of `—`; both rea… |
| 201 | StringLiteral | `""` | display-only | Only distinguishable when an ADR carries no `**Status**:` line, a real shape (`readAdrs` keeps such a file and sets `status: ""`). The Status cell then renders blank instead of `—`; both read as no s… |
| 206 | StringLiteral | `""` | defence-in-depth | Unreachable from any runward command. The only producer of these inputs is `gatherComplianceInputs`, which always sets `threatModelState` from `govState`, and `govState` returns one of `missing`, `ra… |
| 207 | StringLiteral | `""` | defence-in-depth | Same as the threat-model `"missing"` sibling: `evalRubricState` is always set by `gatherComplianceInputs` via `govState`, which cannot return undefined or an empty string, so the `??` fallback never … |

### renderEuAiAct — 4 survivor(s): 4 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 310 | OptionalChaining | `lens.highRisk.bindFrom` | defence-in-depth | `renderEuAiAct` is reachable only through `complianceCommand` with key 'eu-ai-act' (the REGIMES table in src/commands/compliance.ts), and its `lens` argument comes only from `loadRegime('eu-ai-act', … |
| 310 | OptionalChaining | `lens.highRisk.scope` | defence-in-depth | Same reachability and the same shipped-lens control as the `lens.highRisk?.bindFrom` mutant on this line; this is the `scope` half of the same interpolation (rendered: 'Chapter III, Sections 1, 2 and… |
| 311 | OptionalChaining | `lens.articles.runtimeLogging` | defence-in-depth | Same reachability and the same shipped-lens control as the `lens.highRisk?.` mutants above; this one renders `articles.runtimeLogging` = 'art. 12', the article the draft states it does NOT satisfy. P… |
| 324 | ArrayDeclaration | `["Stryker was here"]` | defence-in-depth | Same reachability argument as the `lens.highRisk?.` mutants: both shipped eu-ai-act lenses define `annexIv` as a nine-row array, so the `??` right operand is never evaluated and, PROBED, the rendered… |

### gatherComplianceInputs — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 126 | ConditionalExpression | `true` | hole | The `has` is a live guard, not a redundant one: readRules accepts any token matching `/^ASI\d{2}$/` from a rule's `asi:` front matter, while asiCoverage is seeded only with the ten keys of ASI_LABELS… |
| 137 | StringLiteral | `""` | equivalent | SENSITIVITY CONTROL: this object literal is built at the call site, handed to artifactState, and discarded. artifactState and inProgressCause (src/lib/mission.ts) read `relPath` and `templateKey` and… |
| 138 | StringLiteral | `""` | equivalent | Identical control to the sibling `label` mutant on the threat-model literal: the object never escapes the call, and artifactState/inProgressCause read `relPath` and `templateKey` only. Mutating `relP… |

### asiTableLines — 2 survivor(s): 1 hole · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 224 | ArrayDeclaration | `["Stryker was here"]` | defence-in-depth | Same fallback as survivor 4, one function over: unreachable because gatherComplianceInputs seeds every ASI_LABELS key before filling, so `get(id)` is never nullish. Probed byte-identical on all three… |
| 225 | StringLiteral | `""` | hole | The gap marker becomes an empty cell: `\| ASI07 \| Insecure Inter-Agent Communication \| **no rule mapped - gap to assess** \|` becomes `\| ASI07 \| Insecure Inter-Agent Communication \| \|`. This is the doc… |

### renderNistAiRmf — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 275 | OptionalChaining | `lens.crosswalk.primary` | equivalent | EQUIVALENT, with the control. Measured: byte-identical output on all three fixtures — the diff is empty, not merely 'looks the same'. Reachability: renderNistAiRmf has exactly one caller, REGIMES['ni… |
| 275 | OptionalChaining | `lens.crosswalk.confirmAgainst` | equivalent | Same equivalence and the same control as the mutant on `lens.crosswalk?.primary` on this line, one field over: regimes/nist-ai-rmf@1.0.json defines crosswalk.confirmAgainst ('AI RMF §5'), it is the o… |

### verdictBannerLines — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 156 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR - filed as a hole because no measurement decided it (the isRegularFile precedent). Survived the unit pass and the whole-net legs of the release gate, and produced no observable differ… |
| 158 | StringLiteral | `""` | hole | COULD NOT CLEAR - filed as a hole because no measurement decided it (the isRegularFile precedent). Survived the unit pass and the whole-net legs of the release gate, and produced no observable differ… |

### adrTableLines — 1 survivor(s): 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 249 | StringLiteral | `""` | display-only | Differs only where a.status is already empty - an ADR file with no `**Status**:` line - and then swaps the em dash for an empty cell; both say the status is absent, and `ratified` is computed from ad… |

### confCounts — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 232 | ConditionalExpression | `true` | equivalent | The mutated branch is genuinely taken, and I measured it being taken: on a mission carrying a row with status `todo` (which `parseManifest` keeps and the guard normally skips) the output is still byt… |

### confTableLines — 1 survivor(s): 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 241 | StringLiteral | `""` | display-only | Differs only where r.evidence is already empty, and then it swaps the em-dash placeholder for an empty table cell - both say "nothing recorded". Reachable but inert: probed on a mission whose floor.m… |

### detUuid — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 352 | MethodExpression | `createHash("sha256").update(ˋrunward-oscal:…` | equivalent | Probed rather than argued, as instructed: the pack is byte-identical for every mission name tried ("demo-mission", "", "a", a 200-char name, a non-ASCII name). The reason is arithmetic - every read o… |

### FRONTMATTER — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 30 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | The successor of the pre-fix anchor survivor, re-probed on the CRLF-aware line rather than ported: the verdict for the old key was retired when RWD-2026-0083's fix changed this line's text, and ADR-0… |

## Module: sarif

Survivors: 56

Holes: 39 · Equivalent: 5 · Display-only: 0 · Defence-in-depth: 12

**Whole net: last run 2026-09-29, against a net that has since changed** (recorded `2102deca2908…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### buildSarif — 49 survivor(s): 38 hole · 1 equivalent · 10 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 49 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The `??` branch IS taken (horizon is null in 11 of 12 captured verdicts), but the injected literal yields `new Set([undefined])`, and all 156 deliverables across the fixtures carry a non-empty string… |
| 64 | StringLiteral | `""` | defence-in-depth | Caught by the whole net, leg `sarif-shape`, measured 2026-09-01 by scripts/mutation-wholenet.mjs after that leg gained the fixtures this campaign showed were missing — a deliverable gap, a rule-corpu… |
| 65 | ConditionalExpression | `true` | hole | Forcing the state test true makes every unfilled deliverable read `the deliverable is missing`. Measured on the red, partial and ph missions: a file that exists but is under-filled is reported as abs… |
| 65 | ConditionalExpression | `false` | hole | Forcing it false makes a genuinely absent file read `the deliverable is started but not filled`. Measured on the red mission: the deleted runbook.md is described as started. |
| 65 | EqualityOperator | `d.state !== "missing"` | hole | Inverting it swaps both: measured, the deleted runbook.md reads `started but not filled` and the under-filled handover.md reads `the deliverable is missing`. Every deliverable message in the document… |
| 65 | StringLiteral | `""` | hole | Comparing d.state against "" is always false: measured, the deleted runbook.md is reported as `the deliverable is started but not filled`. Nothing catches it. |
| 65 | StringLiteral | `""` | hole | Measured on the red mission: the message becomes `Recovery runbook (6 · Hand over): — the gate cannot be crossed on it.` — the reviewer is told a gate is blocked without being told why. Text is still… |
| 66 | ConditionalExpression | `true` | hole | Forcing the below-floor test true relabels a placeholder-bearing deliverable as `too close to the template to count as filled`. Measured on the ph mission, where the real cause is `placeholders remai… |
| 66 | ConditionalExpression | `false` | hole | Forcing it false makes a below-floor deliverable read `started but not filled`. Measured on the red and partial missions (handover.md). |
| 66 | EqualityOperator | `d.cause !== "below-floor"` | hole | Inverting it swaps the below-floor and placeholder wordings: measured on the red, partial and ph missions, both messages change. |
| 66 | StringLiteral | `""` | hole | Comparing d.cause against "" is always false: measured, the below-floor handover.md reads `started but not filled` on the red and partial missions. |
| 66 | StringLiteral | `""` | hole | Measured on the red and partial missions: the message becomes `Hand-over note (the kit, proven) (6 · Hand over): — the gate cannot be crossed on it.` — the cause is gone from the annotation the opera… |
| 67 | ConditionalExpression | `true` | hole | Forcing the placeholders test true relabels an UNTOUCHED deliverable as `placeholders remain`. Measured on a mission built with `init --path . --tools claude`, whose raw deliverables reach the defaul… |
| 67 | ConditionalExpression | `false` | hole | Forcing it false makes a placeholder-bearing deliverable read `started but not filled`. Measured on the ph mission. |
| 67 | EqualityOperator | `d.cause !== "placeholders"` | hole | Inverting it swaps the placeholder and default wordings: measured on the ph mission the message changes from `placeholders remain` to `started but not filled`. |
| 67 | StringLiteral | `""` | hole | Comparing against "" is always false: measured on the ph mission, `placeholders remain` becomes `started but not filled`. |
| 67 | StringLiteral | `""` | hole | Measured on the ph mission: the message becomes `Hand-over note (the kit, proven) (6 · Hand over): — the gate cannot be crossed on it.`, dropping the one word that tells the operator what to fix. |
| 68 | StringLiteral | `""` | hole | The default branch is reachable — an UNTOUCHED deliverable has state != missing/filled and cause null. Measured on a mission from `init --path . --tools claude`: every raw deliverable's message loses… |
| 68 | StringLiteral | `""` | hole | Measured on red, ph, raw and nomanifest: every non-deferred deliverable message loses ` — the gate cannot be crossed on it.`, the clause that tells the reviewer the finding is blocking rather than in… |
| 69 | ObjectLiteral | `{}` | defence-in-depth | Caught by the whole net, leg `sarif-shape`, measured 2026-09-01 by scripts/mutation-wholenet.mjs after that leg gained the fixtures this campaign showed were missing — a deliverable gap, a rule-corpu… |
| 85 | ObjectLiteral | `{}` | defence-in-depth | Applied it: every strict violation loses message.text. `node test/sarif-shape.js` exits 1 on the broken-pointer fixture, both on the OASIS schema (`message must have required property 'text'`) and on… |
| 106 | StringLiteral | `""` | defence-in-depth | Applied it: the seal/corpus/ADR/hook findings ship `level: ""`. `node test/sarif-shape.js` exits 1 on its seal-drift fixture — the OASIS level enum rejects it. |
| 111 | StringLiteral | `ˋˋ` | defence-in-depth | Applied it: the evidence-seal finding's message becomes "" (baseline text names the file whose sealed evidence moved). `node test/sarif-shape.js` exits 1 on the seal-drift fixture — `every result car… |
| 116 | StringLiteral | `ˋˋ` | defence-in-depth | Caught by the whole net, leg `sarif-shape`, measured 2026-09-01 by scripts/mutation-wholenet.mjs after that leg gained the fixtures this campaign showed were missing — a deliverable gap, a rule-corpu… |
| 118 | StringLiteral | `ˋˋ` | defence-in-depth | Caught by the whole net, leg `sarif-shape`, measured 2026-09-01 by scripts/mutation-wholenet.mjs after that leg gained the fixtures this campaign showed were missing — a deliverable gap, a rule-corpu… |
| 120 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the message drops from `zz-invented-rule.md — a rule runward never wrote, declaring a gated phase at CRITICAL/HIGH` to "". |
| 123 | StringLiteral | `""` | hole | Measured on a mission with an unrecorded corpus: the finding's artifactLocation.uri becomes "" (confirmed through `check --strict --sarif`), so a forge has nothing to anchor the annotation on. sarif-… |
| 123 | StringLiteral | `""` | hole | Measured: the unrecorded-corpus finding ships with message.text = "" — an error the reviewer sees with no explanation of what is wrong. sarif-shape.js stays green because it has no unrecorded-corpus … |
| 126 | StringLiteral | `ˋˋ` | defence-in-depth | Caught by the whole net, leg `sarif-shape`, measured 2026-09-01 by scripts/mutation-wholenet.mjs after that leg gained the fixtures this campaign showed were missing — a deliverable gap, a rule-corpu… |
| 129 | StringLiteral | `ˋˋ` | hole | Measured with `--hooks`: the hook finding's message drops from `1 operator hook(s) failed; the gate cannot be crossed on a failing hook` to "" — an empty error in the pull request while the gate exit… |
| 139 | StringLiteral | `""` | defence-in-depth | Applied it: driver.informationUri becomes "" in every document. `node test/sarif-shape.js` exits 1 on all four fixtures — the OASIS schema rejects it on `format: "uri"`. |
| 140 | MethodExpression | `[...ruleIds]` | hole | Dropping the sort changes the rules array order: measured on the red mission the emitted order goes from alphabetical to Set-insertion order (hexa-architecture and zz-invented-rule jump ahead of the … |
| 142 | ConditionalExpression | `true` | hole | Forcing the ternary true titles EVERY craft rule `A gated deliverable is missing or unfilled`. Measured on the red mission: handover-agents-charter-final, handover-redone-task-proof, hexa-architectur… |
| 142 | MethodExpression | `id` | hole | Measured: titles become `Craft rule runward/handover-agents-charter-final is not accounted for` — the `runward/` namespace is no longer stripped, so every craft-rule headline in the document changes.… |
| 142 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: every craft rule's shortDescription.text becomes "" — nine rules with no title in one document. sarif-shape.js stays green. |
| 142 | StringLiteral | `""` | hole | slice("".length) is slice(0), i.e. no strip at all: measured, the same wrong titles as leaving the id whole (`Craft rule runward/handover-...`). Nothing catches it. |
| 144 | ObjectLiteral | `{}` | hole | Measured: `defaultConfiguration` becomes `{}` on every rule, so a consumer reading rule-level severity falls back to the SARIF default `warning` instead of `error`. The document stays schema-valid an… |
| 144 | StringLiteral | `""` | defence-in-depth | Applied it: `defaultConfiguration.level` becomes "". `node test/sarif-shape.js` exits 1 — the OASIS enum rejects it (`allowedValues ["none","note","warning","error"]`). |
| 166 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | EqualityOperator | `g.deliverable === undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | EqualityOperator | `g.rule === undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | LogicalOperator | `g.deliverable !== undefined \|\| g.rule !== u…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | LogicalOperator | `locate(ˋrunward/${g.deliverable}ˋ, g.rule) …` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 167 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 198 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### manifestLineLocator — 4 survivor(s): 4 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 53 | ConditionalExpression | `true` | equivalent | The locator's cache is bypassed and the file re-read on every call. Within one command run the mission is not written between two lookups, so every answer is the same. Measured: 121 command runs byte… |
| 55 | StringLiteral | `"Stryker was here!"` | equivalent | The initial content of an unreadable file becomes the truthy `Stryker was here!`, so ruleRowLineOrNull runs on it; it holds no pipe line and answers null, as the empty-string path does. Measured: 0 o… |
| 57 | ConditionalExpression | `true` | equivalent | The existence and is-a-file guard forced true: readFileSync on a missing path throws ENOENT and on a directory EISDIR, both inside the surrounding try, so content stays empty and the answer stays nul… |
| 57 | LogicalOperator | `existsSync(abs) \|\| statSync(abs).isFile()` | equivalent | `&&` -> `\|\|`: for a missing path statSync throws inside the try (same null), for a directory readFileSync throws EISDIR inside the try (same null). Measured: 0 of 25 direct cases, 121 command runs by… |

### GATE_NON_SCOPE_SARIF — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 154 | StringLiteral | `""` | hole | Measured: every rule's fullDescription loses its first sentence (`runward verifies that a decision was traced to resolving, non-empty ... evidence.`). The unit test only matches the second and third … |

### SARIF_SCHEMA — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 18 | StringLiteral | `""` | defence-in-depth | Applied it: $schema becomes "" in every emitted document across 13 mission states. `node test/sarif-shape.js` goes red (exit 1) with 8 failures — `carries $schema` and `validates against the OASIS SA… |

### SARIF_VERSION — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 19 | StringLiteral | `""` | defence-in-depth | Applied it: `version` becomes "". The unit suite passes because sarif-emit.test.js compares the document against the mutated SARIF_VERSION constant itself. `node test/sarif-shape.js` exits 1: `versio… |

## Module: verdict

Survivors: 51

Holes: 37 · Equivalent: 10 · Display-only: 2 · Defence-in-depth: 2

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### computeVerdict — 39 survivor(s): 34 hole · 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 154 | ConditionalExpression | `true` | equivalent | Invariant: throughIndex === -1 exists ONLY if opts.through is non-null (a null/undefined through gives throughIndex null, not -1) — the removed conjunct is implied by the other. Measured: 0 delta ove… |
| 155 | StringLiteral | `""` | hole | The fail-loud remediation becomes unreadable. Measured on the real CLI: `runward verify` on an attestation whose predicate.through='bogus' (unsigned bytes, modifiable by construction): shipped "✗ unk… |
| 182 | ArithmeticOperator | `corpus.missing.length + corpus.edited.lengt…` | hole | Same class: measured on extra-only "1 rule-corpus divergence(s)" → "-1" (and edited+extra skewed), exit/JSON unchanged. The same absence of a corpus case in the sums test, and the summary — the sente… |
| 182 | ArithmeticOperator | `corpus.missing.length - corpus.edited.length` | hole | The worst of the class: on edited+extra the count comes to 0 and the divergences VANISH from the summary — shipped "! 1 rule-conformance gap(s) · 2 rule-corpus divergence(s)" → mutated "! 1 rule-conf… |
| 182 | AssignmentOperator | `strictBreakdown.corpus -= corpus.missing.le…` | hole | The summary's remediation count is inverted: measured on an edited rule: "! 1 rule-corpus divergence(s)" → "! -1 rule-corpus divergence(s)" (also on extra and edited+extra). Exit and payload intact (… |
| 198 | AssignmentOperator | `strictBreakdown.corpus -= 1` | hole | Lock removed: strictGaps does rise (+1, exit 1 kept) but the summary prints "-1 rule-corpus divergence(s)" instead of "1" — measured on the nolock fixture, the only delta in the battery. The unit tes… |
| 204 | ArithmeticOperator | `g.strictGaps + proposedHere` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 207 | ConditionalExpression | `true` | equivalent | Invariant: every producer of present:false carries violations:[] — verifyEvidenceLock (file absent) and the --freeze placeholder — so the added += is always worth 0. Measured: 0 delta over 39 probes,… |
| 213 | AssignmentOperator | `strictBreakdown.unratified -= unratified.le…` | hole | Draft ADR: exit 1 kept (strictGaps intact) but the summary prints "-1 unratified decision(s)" instead of "1" — measured on the draftadr fixture, the only delta. The sums test does not cover the unrat… |
| 219 | ConditionalExpression | `true` | equivalent | true && throughIndex!==null ≡ throughIndex!==null, equivalent by the same correlation (the left conjunct is implied by the right one after the throw). Measured 0 delta over 39 probes; sensitivity pro… |
| 219 | ConditionalExpression | `true` | equivalent | opts.through!=null && true ≡ opts.through!=null, equivalent by the reverse correlation (the right conjunct is implied by the left one: a valid through always gives an ordinal). Measured 0 delta over … |
| 219 | LogicalOperator | `opts.through != null \|\| throughIndex !== nu…` | equivalent | On this line the two conjuncts are perfectly correlated: null through ⇒ throughIndex null; non-null through ⇒ throughIndex ≥ 0 (the -1 is eliminated by the fail-loud throw upstream) — && and \|\| compu… |
| 221 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 221 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 221 | LogicalOperator | `charter === null && sample === null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 256 | ObjectLiteral | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 257 | ArrayDeclaration | `["Stryker was here"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 262 | ArrayDeclaration | `["Stryker was here"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 262 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 263 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 266 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 276 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 276 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 276 | LogicalOperator | `!contract && contract.gate !== "strict"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 284 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 291 | ArithmeticOperator | `workflowContract.malformed.length + workflo…` | hole | Hole with an exact recipe, measured 2026-09-04: applied at line 291, the machine payload of `check --strict --json` on the `declencheur` probe mission DIFFERS from the pristine build — the observable… |
| 291 | ArithmeticOperator | `workflowContract.malformed.length - workflo…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 301 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | LogicalOperator | `charter !== null \|\| delegation !== null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 301 | LogicalOperator | `charter !== null && delegation !== null \|\| …` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ArrowFunction | `() => undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | EqualityOperator | `gatedOrdinal(phase) < throughIndex` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 305 | EqualityOperator | `gatedOrdinal(phase) > throughIndex` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### judgeGated — 9 survivor(s): 5 equivalent · 2 display-only · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 116 | ConditionalExpression | `false` | equivalent | Dead branch: EXPECTED_MAPPED (dist/lib/constants.js, owned by the package, out of the mission's reach) pins the five gated phases at 6/4/10/12/4, so expected.length===0 always entails the (mapping) v… |
| 116 | ConditionalExpression | `true` | defence-in-depth | The skip swallows the (mapping) violation as soon as expected is empty. Measured: shipped corpus vendored through `runward update --corpus` with govern removed from every phases: → shipped exit 1 "on… |
| 116 | EqualityOperator | `violations.length !== 0` | defence-in-depth | The condition becomes "expected empty AND violations present" — exactly the state the comment forbids skipping. The same false green measured: strippedgov exit 1 → 0 (json and text). LEG NAMED AND RE… |
| 117 | ArrayDeclaration | `["Stryker was here"]` | equivalent | A literal in the dead branch, never evaluated in practice (the push is unreachable: EXPECTED_MAPPED forces the (mapping) violation when expected is empty). Measured 0 delta over 39 probes; skipped==0… |
| 117 | BooleanLiteral | `false` | equivalent | Same dead branch, same demonstration (EXPECTED_MAPPED + 0 delta measured + skipped==0 on 16 fixtures) and same sensitivity control (neighbouring mutant detected exit 1→0). The flag cannot be observed… |
| 117 | ObjectLiteral | `{}` | equivalent | In the dead branch: the push never runs (EXPECTED_MAPPED demonstration + skipped==0 measured everywhere, 0 delta over 39 probes). Sensitivity: the same control as above (the neighbouring if, mutated,… |
| 124 | ConditionalExpression | `false` | display-only | A proposal's evidence problems are also appended to the text of ANOTHER violation of the same rule (measured: the duplicate-row violation of hexa-architecture in `props` gains the sentence `Its evide… |
| 128 | StringLiteral | `""` | display-only | The separator between two evidence problems of one proposal disappears. 2 of 21 cases differ (security-code-execution-sandbox, two dead pointers), only in the `problem` field and the printed line. Be… |
| 134 | BlockStatement | `{}` | equivalent | A dead branch, like its neighbours already instructed on the same line: EXPECTED_MAPPED pins a non-zero floor for each of the five gated phases, so `expected.length === 0` always comes with the mappi… |

### countGaps — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 85 | ConditionalExpression | `true` | hole | deferredGaps counts every deferred row, filled ones included: measured on a green mission + `--through frame --json`: gaps.deferred 0 → 11 on a fully filled arc (exit 0 for both) — a CI reading the r… |
| 85 | StringLiteral | `""` | hole | state !== "" always true: measured behaviour identical to the previous one (gaps.deferred 0 → 11 on green --through frame, 5→5 on mid-construction, exits unchanged). Same recipe, same missing asserti… |

### sampleReading — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 39 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

## Module: check-contract

Survivors: 48

Holes: 23 · Equivalent: 2 · Display-only: 22 · Defence-in-depth: 1

**Whole net: last run 2026-09-29, against a net that has since changed** (recorded `2102deca2908…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### nextStep — 25 survivor(s): 1 hole · 2 equivalent · 21 display-only · 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 84 | StringLiteral | `""` | display-only | The muted tone becomes the plain one. Tone is dropped from the payload by nextPayload, so no machine surface sees it: the 121 NO_COLOR runs are byte-identical and 384 of 1,536 direct calls differ onl… |
| 89 | StringLiteral | `""` | display-only | The lead-in of the green Next line (`Assemble the evidence pack with `) becomes empty. Measured on every green probe run: only `next.text` and the terminal line differ; action `assemble-evidence-pack… |
| 89 | StringLiteral | `""` | display-only | A separating space of the green Next line. Measured: `next.text` and terminal text only, 128 of 1,536 direct calls, action and command unchanged. Survived the CI unit pass on this branch and the whol… |
| 90 | StringLiteral | `""` | display-only | A separating space of the green Next line. Measured: `next.text` and terminal text only, 128 of 1,536 direct calls, action and command unchanged. Survived the CI unit pass on this branch and the whol… |
| 90 | StringLiteral | `""` | display-only | A separating space of the green Next line. Measured: `next.text` and terminal text only, 128 of 1,536 direct calls, action and command unchanged. Survived the CI unit pass on this branch and the whol… |
| 103 | StringLiteral | `""` | display-only | The lead of the fill-and-close gesture becomes empty, leaving `, then re-run runward check --strict.`. Measured on the blank and agent missions: `next.text` and the terminal line only; action `fill-d… |
| 104 | StringLiteral | `""` | defence-in-depth | Survives the unit suite; caught by the `smoke` leg of the whole-net pass of 2026-09-29 (scripts/mutation-wholenet.mjs, detection confirmed by a second run). The lead of the fill-deliverables gesture … |
| 107 | StringLiteral | `""` | display-only | The re-seal instruction's prose becomes empty; the command segment `runward check --freeze` stays. Measured on the drifted-seal mission: `next.text` and terminal text only; action `reseal-evidence` a… |
| 107 | StringLiteral | `""` | display-only | The full stop after `runward check --freeze`. Measured on the drifted-seal mission: `next.text` and terminal text only. Survived the CI unit pass on this branch and the whole-net pass of 2026-09-29 (… |
| 110 | StringLiteral | `""` | display-only | The lead of the corpus gesture becomes empty; both command segments stay. Measured on the edited-corpus and unrecorded-corpus missions: `next.text` and terminal text only; action `reconcile-corpus` a… |
| 110 | StringLiteral | `""` | display-only | The commentary after `runward update`. Measured on both corpus missions: `next.text` and terminal text only; both commands still named. Survived the CI unit pass on this branch and the whole-net pass… |
| 110 | StringLiteral | `""` | display-only | The commentary after `runward update --corpus <path>`. Measured on both corpus missions: `next.text` and terminal text only. Survived the CI unit pass on this branch and the whole-net pass of 2026-09… |
| 112 | StringLiteral | `""` | display-only | The lead of the ratify-decisions gesture. Measured on the DRAFT ADR mission: `next.text` and terminal text only; action `ratify-decisions`, command and rerun unchanged. Survived the CI unit pass on t… |
| 114 | StringLiteral | `""` | display-only | The lead of the close-conformance gesture. Measured on the dead-pointer mission: `next.text` and terminal text only; action `close-conformance-gaps` and command unchanged. Survived the CI unit pass o… |
| 119 | StringLiteral | `""` | display-only | The lead of the ratify-decided-rows gesture; the two command segments stay. Measured on the regulated mission: `next.text` and terminal text only; action `ratify-decided-rows`, command `runward ratif… |
| 119 | StringLiteral | `""` | display-only | The `, then re-run ` between the two commands. Measured on the regulated mission: `next.text` and terminal text only; both commands still named, in order. Survived the CI unit pass on this branch and… |
| 119 | StringLiteral | `""` | display-only | The final full stop. Measured on the regulated mission: `next.text` and terminal text only. Survived the CI unit pass on this branch and the whole-net pass of 2026-09-29 (scripts/mutation-wholenet.mj… |
| 122 | StringLiteral | `""` | display-only | The fallback branch of nextStep (a red run no counted term explains) loses the word `Re-run ` before the command. Direct calls over 1,536 verdict shapes: 4 differ, all in that branch, and only in the… |
| 122 | StringLiteral | `""` | display-only | Same fallback branch: the full stop after the command disappears. 4 of 1,536 direct calls differ, only in segment text and `next.text`; action, command and rerun identical. Survived the CI unit pass … |
| 123 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 126 | ConditionalExpression | `true` | equivalent | `v.gaps > 0` forced true inside statusSeesIt. The expression is only evaluated on a red run (the green return above it takes every case where gaps, strictGaps and hookFailed are all 0), and on a red … |
| 126 | EqualityOperator | `v.gaps >= 0` | equivalent | `v.gaps > 0` -> `v.gaps >= 0`: differs from the original only at gaps === 0, which on a red run implies strictGaps > 0 or hookFailed > 0 and falsifies the conjunction anyway. Measured: 0 of 1,536 dir… |
| 129 | StringLiteral | `""` | display-only | The space before the `runward status` pointer disappears. Measured: only `next.text` and the terminal Next line differ (on the blank, agent and under-filled missions, the three where status sees the … |
| 129 | StringLiteral | `""` | display-only | The space after the `runward status` pointer disappears. Same measurement as its neighbour: `next.text` and the terminal line only, 256 of 1,536 direct calls, no field an agent branches on. Survived … |
| 129 | StringLiteral | `""` | display-only | The muted comment after the status pointer (`names exactly what is open at the current gate.`) becomes empty; the command segment `runward status` stays. Measured: `next.text` and terminal text only,… |

### conformanceEntries — 19 survivor(s): 19 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 259 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 259 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 259 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 259 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 259 | EqualityOperator | `c.deliverable === undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 259 | EqualityOperator | `c.rule === undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 259 | LogicalOperator | `c.deliverable !== undefined \|\| c.rule !== u…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 260 | ArrowFunction | `() => undefined` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 260 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 260 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 260 | EqualityOperator | `x.deliverable !== c.deliverable` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 261 | ObjectLiteral | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 261 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 261 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 262 | BooleanLiteral | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 262 | LogicalOperator | `meta?.phase && null` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 262 | OptionalChaining | `meta.phase` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 262 | StringLiteral | `ˋˋ` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 265 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### delegationPayload — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 280 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 283 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 283 | LogicalOperator | `gaps && []` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### optionFault — 1 survivor(s): 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 52 | StringLiteral | `""` | display-only | The only true cosmetic of the batch. Measured: exit 2 kept, message '--json--sarif each write a different document... Run runward check once per document you need.' — BOTH flag names stay present and… |

## Module: tool-adapters

Survivors: 46

Holes: 35 · Equivalent: 11 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### k6ThresholdsResult — 13 survivor(s): 13 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 337 | BlockStatement | `{}` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 338 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 340 | OptionalChaining | `summary.metrics` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 341 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 341 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 341 | LogicalOperator | `!metrics && typeof metrics !== "object"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 342 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 344 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 348 | OptionalChaining | `metrics[name].thresholds` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 349 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 349 | LogicalOperator | `!th && typeof th !== "object"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 352 | UpdateOperator | `seen--` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 358 | OptionalChaining | `v.ok` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |

### coberturaFileResult — 7 survivor(s): 7 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 189 | Regex | `/\.\//` | hole | The "./" strip loses its start anchor. Measured: pointer "src/a./b.ts" against filename="src/a./b.ts", and pointer "../lib/up.ts" against filename="/repo/pkg/../lib/up.ts", both go "covered" -> "abse… |
| 189 | StringLiteral | `""` | hole | Backslashes in the pointer are deleted instead of normalised. Measured: coberturaFileResult(COBERTURA, "src\\guard.ts") goes "covered" -> "absent". |
| 189 | StringLiteral | `"Stryker was here!"` | hole | The replacement string is injected into the wanted path. Measured: coberturaFileResult(COBERTURA, "./src/guard.ts") goes "covered" -> "absent". |
| 201 | ArithmeticOperator | `m.index - m[0].length` | hole | The body of a record with no </class> starts m[0].length before its own tag, pulling in the previous record. Measured on a truncated report whose unterminated dead record follows a live one: "uncover… |
| 201 | MethodExpression | `content` | hole | On a record with no </class> the body becomes the WHOLE document, so the record inherits every other record's hits. Measured on a truncated report whose unterminated dead record follows a live one: "… |
| 207 | Regex | `/<line\b[^>]*\bhits\S*=\s*["'](\d+)["']/ig` | hole | `hits\S*=` cannot cross whitespace. Measured on records whose only evidence is `<line number="1" hits = "4"/>` or `hits ="4"`: "covered" -> "uncovered". |
| 207 | Regex | `/<line\b[^>]*\bhits\s*=\S*["'](\d+)["']/ig` | hole | `=\S*` cannot cross whitespace after the equals sign. Measured on records whose only evidence is `hits = "4"` or `hits= "4"`: "covered" -> "uncovered". |

### sarifRuleResult — 5 survivor(s): 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 48 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The sentinel replaces [] only when `runs` is not an array; iterating it yields a string element whose `?.tool` is undefined, so no rule and no result is seen and the verdict stays "absent". Byte-iden… |
| 53 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The sentinel replaces [] only when `driver.rules` is not an array; the string element has no `.id`, so `rules.find` never matches and `rules[res.rule.index]?.id` stays undefined. Byte-identical over … |
| 57 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The sentinel replaces [] only when `run.results` is not an array; the string element has no `.ruleId`, so id is undefined and the loop continues for any string ruleId. Byte-identical over 645 calls, … |
| 64 | OptionalChaining | `res.level` | equivalent | 645 sarifRuleResult calls over 43 SARIF documents (null and primitive result entries included) were byte-identical. The line is reached only after `if (id !== ruleId) continue`, and for a string rule… |
| 64 | StringLiteral | `""` | equivalent | The literal's only use is `level !== "note" && level !== "none"`, and "" satisfies both comparisons exactly like "warning". Measured byte-identical over 645 calls on 43 documents, including logs wher… |

### eslintFileResult — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 237 | BlockStatement | `{}` | equivalent | Emptying the catch leaves report undefined, and the next line `!Array.isArray(report)` returns the same "unparseable". Measured on 19 malformed documents crossed with 7 pointers and on the 2500-compa… |
| 242 | Regex | `/\.\//` | hole | Dropping the ^ anchor makes replace strip the first "./" anywhere in the path: measured pointer "src/./lib/dot.ts" against record "/repo/src/./lib/dot.ts" flipped "clean" to "absent". |
| 256 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The mutated fallback array is only iterated when entry.messages is not an array, and its single element is a string whose .severity is undefined, so the severity===2 test never fires. Measured on the… |

### isLcovReport — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 119 | Regex | `/end_of_record\s*$/m` | hole | Dropping the line anchor on the terminator. Measured: isLcovReport goes false -> true for a file whose terminator is indented, and for one whose only occurrence is `TN:end_of_record` at the end of a … |
| 119 | Regex | `/^end_of_record\s*/m` | hole | Dropping `$` lets any line merely starting with the token count as a terminator. Measured on a file whose line is `end_of_record_v2`: isLcovReport goes false -> true. |
| 119 | Regex | `/^end_of_record\S*$/m` | hole | `\S*` inverts the character class. Measured: a genuine report whose terminators carry trailing spaces goes true -> false, and a file whose line is `end_of_record_v2` goes false -> true. |

### jtlSamplesResult — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 373 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 374 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 377 | BooleanLiteral | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |

### sbomComponentPresent — 3 survivor(s): 1 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 288 | BlockStatement | `{}` | equivalent | Emptying the catch leaves bom undefined, and the next guard `!Array.isArray(bom?.components)` returns the same "unparseable". Measured on 19 malformed documents crossed with 13 identities plus the fu… |
| 291 | OptionalChaining | `bom.components` | hole | Removing the optional chain dereferences a null BOM: measured sbomComponentPresent('null', 'a@1') returned "unparseable" before, throws TypeError "Cannot read properties of null (reading 'components'… |
| 299 | OptionalChaining | `c.version` | equivalent | `c?.version` is only evaluated once `typeof c?.name === "string"` has succeeded, which already proves c is non-nullish, so the optional chain can never be the operand that saves the access. Measured:… |

### isCycloneDxSbom — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 267 | Regex | `/"bomFormat"\S*:\s*"CycloneDX"/i` | hole | \S* cannot cross the space before the colon: measured isCycloneDxSbom('{"bomFormat" :"CycloneDX","components":[]}') flipped true to false. A pretty-printed SBOM stops being recognised as one. |
| 267 | Regex | `/"components"\S*:/` | hole | Same failure on the components marker: measured isCycloneDxSbom('{"bomFormat":"CycloneDX","components" : []}') flipped true to false. |

### isEslintReport — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 220 | Regex | `/"filePath"\S*:/` | hole | \S* cannot cross the space before the colon: measured isEslintReport('[{"filePath" : "a","messages":[]}]') flipped true to false. A pretty-printed ESLint report stops being recognised. |
| 220 | Regex | `/"messages"\S*:/` | hole | Same failure on the messages marker: measured isEslintReport('[{"filePath":"a","messages" : []}]') flipped true to false, while the filePath-only-spaced fixture is unaffected — the two regex mutants … |

### isK6Summary — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 313 | LogicalOperator | `/"metrics"\s*:/.test(content) \|\| /"http_req…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |
| 313 | Regex | `/"metrics"\S*:/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |

### lcovFileResult — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 158 | MethodExpression | `line.slice(3)` | equivalent | Number() already applies StrWhiteSpace trimming, the same character set String.prototype.trim removes, so Number(x.trim()) and Number(x) coincide for every string. Measured: 1331 combinations of 11 w… |
| 162 | MethodExpression | `line` | equivalent | The branch is only reachable for lines starting with "DA:", and "DA:" contains no comma, so it lies entirely inside split element [0] and element [1] is byte-identical with or without the slice. Meas… |

### isJmeterJtl — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 316 | LogicalOperator | `/<testResults\b/i.test(content) \|\| /<(httpS…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it (the isRegularFile precedent). Named by the v0.39.0 release gate's ratchet, exactly as the debt statement in the shipping PRs said … |

## Module: ratify

Survivors: 39

Holes: 21 · Equivalent: 15 · Display-only: 3 · Defence-in-depth: 0

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### applyDecisions — 13 survivor(s): 12 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 68 | ArrayDeclaration | `["Stryker was here"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 72 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 85 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 100 | Regex | `/### Ratification$/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 100 | Regex | `/^### Ratification/m` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 101 | Regex | `/\s$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 101 | Regex | `/\S*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 102 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 103 | Regex | `/\s*/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 103 | Regex | `/\s$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 103 | Regex | `/\S*$/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 218 | ArrayDeclaration | `["Stryker was here"]` | equivalent | A dead branch: a rule enters acceptedRules only after rowRe has found its row. A proposal comes from the Rule conformance section and its rewritten row stays there, and a bound decided row is not rew… |

### alarmFor — 8 survivor(s): 7 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 59 | ConditionalExpression | `true` | equivalent | In alarmFor, `p.kind !== "adr" && p.path` is exactly `p.path`: an `adr` pointer never carries a path and every `file:` or `test:` pointer does. Measured on parseEvidencePointers over adr:0001, adr:AD… |
| 59 | LogicalOperator | `p.kind !== "adr" \|\| p.path` | equivalent | In alarmFor, `p.kind !== "adr" && p.path` is exactly `p.path`: an `adr` pointer never carries a path and every `file:` or `test:` pointer does. Measured on parseEvidencePointers over adr:0001, adr:AD… |
| 59 | StringLiteral | `""` | equivalent | In alarmFor, `p.kind !== "adr" && p.path` is exactly `p.path`: an `adr` pointer never carries a path and every `file:` or `test:` pointer does. Measured on parseEvidencePointers over adr:0001, adr:AD… |
| 70 | BlockStatement | `{}` | equivalent | An uncompilable signature: without the `return true`, re stays undefined; every `re.test` then throws INSIDE the try of `paths.some`, whose callback answers false, and `!paths.some(...)` is true. The… |
| 76 | ConditionalExpression | `false` | equivalent | Without the guard, an unresolved (null) or missing path reaches readFileSync, which throws inside the try just below: the same `false`. Measured: 0 of 21 cases differ, including `props` (a missing fi… |
| 76 | LogicalOperator | `!abs && !existsSync(abs)` | display-only | Same return as the intact guard: a null or missing path reaches readFileSync, which throws inside the try, and the callback answers false. The one measured difference is that Node prints `[DEP0187] D… |
| 79 | StringLiteral | `""` | equivalent | `readFileSync(abs, "")` returns a Buffer (measured: typeof is object), and RegExp.prototype.test converts it to its UTF-8 string: the same text, the same answer. Measured: 0 of 21 cases differ. Posit… |
| 81 | BlockStatement | `{}` | equivalent | The callback of `paths.some` returns undefined instead of false: both are falsy for `some`, so the alarm is the same. Measured: 0 of 21 cases differ, including a cited directory (EISDIR). Positive co… |

### excerptAnchor — 5 survivor(s): 3 equivalent · 2 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 314 | ConditionalExpression | `true` | equivalent | pointer.line comes from the `:LINE` grammar: undefined or an integer >= 0. `line && true` and `line && line >= 1` differ in truth only for a negative line, which the grammar does not produce. Measure… |
| 314 | LogicalOperator | `pointer.line \|\| pointer.line >= 1` | equivalent | pointer.line comes from the `:LINE` grammar (digits): undefined or an integer >= 0. For undefined, 0 and every integer >= 1, `line \|\| line >= 1` and `line && line >= 1` have the same truth; a negativ… |
| 327 | BlockStatement | `{}` | equivalent | re is already null when `new RegExp` throws: the assignment in the try never happened, and the catch assigns the same value again. Measured: 0 of 21 cases differ, including the `sig` mission (the sig… |
| 331 | EqualityOperator | `i > 0` | display-only | A signature that matches on line 1 falls back to the top of the file, which is line 1: the anchored line shown is the same and only the note changes (`first line matching…` becomes `no line or symbol… |
| 332 | StringLiteral | `ˋˋ` | display-only | The note printed above the excerpt becomes empty. 8 of 21 cases differ, only in the `note` field (the JSON is identical with the note removed) and the printed `(…)` line; the anchored line and the ex… |

### signatureFacts — 3 survivor(s): 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 90 | ConditionalExpression | `true` | equivalent | In signatureFacts, `p.kind !== "adr" && p.path` is exactly `p.path`: an `adr` pointer never carries a path and every `file:` or `test:` pointer does. Measured on parseEvidencePointers over adr:0001, … |
| 90 | LogicalOperator | `p.kind !== "adr" \|\| p.path` | equivalent | In signatureFacts, `p.kind !== "adr" && p.path` is exactly `p.path`: an `adr` pointer never carries a path and every `file:` or `test:` pointer does. Measured on parseEvidencePointers over adr:0001, … |
| 90 | StringLiteral | `""` | equivalent | In signatureFacts, `p.kind !== "adr" && p.path` is exactly `p.path`: an `adr` pointer never carries a path and every `file:` or `test:` pointer does. Measured on parseEvidencePointers over adr:0001, … |

### listDecidedUnbound — 2 survivor(s): 1 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 101 | ConditionalExpression | `false` | equivalent | A dead guard: unboundRatifications only yields rules parseManifest read from this same file, which is read again here by the same parser, so the row is always found. Measured: 0 of 21 cases differ, i… |
| 112 | ObjectLiteral | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### proposerConflict — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 132 | BooleanLiteral | `p.proposerFor` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 132 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### resolveAgentAccept — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 166 | MethodExpression | `[p.proposer, p.proposerFor ? ˋfor ${p.propo…` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 166 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### splitProposer — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 27 | Regex | `/\S+$/` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 27 | Regex | `/\s$/` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### listProposals — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 42 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### sampleForBloc — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 124 | EqualityOperator | `ha <= hb` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

## Module: spec-conformance

Survivors: 38

Holes: 24 · Equivalent: 11 · Display-only: 3 · Defence-in-depth: 0

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### specConformance — 15 survivor(s): 8 hole · 4 equivalent · 3 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 125 | ArrayDeclaration | `[]` | equivalent | The `?? [...]` fallback is dead code: head always starts with `#` (anchored CRITERIA_HEADING), so head.match(/^#+/) is never null and the right-hand branch of ?? is never evaluated; `[]` (which would… |
| 125 | Regex | `/#+/` | equivalent | `head` comes out of `heads`, filtered by CRITERIA_HEADING anchored `^#{1,6}\\s`: head[0] is always `#`, so the first match of /#+/ is the leading run at index 0, identical to /^#+/. MEASURED: zero di… |
| 125 | StringLiteral | `""` | equivalent | The same dead fallback as m08: the value `\"\"` (level 0) would only be read if head.match(/^#+/) returned null, impossible since every heading comes from CRITERIA_HEADING anchored on `^#`. MEASURED:… |
| 131 | Regex | `/(#{1,6})\s/` | hole | Without ^, any `# ` in the MIDDLE of a criterion line is read as a level-1 heading and ENDS the section: everything that follows disappears. RECIPE: section with `- login works file:src/auth.ts#login… |
| 146 | ConditionalExpression | `true` | hole | Every excerpt goes through slice(0,99)+…: 20 cases out of 28 differ (every text field of the JSON gains a spurious …), and a criterion line of EXACTLY 100 characters ending in AC12 has its id truncat… |
| 146 | ConditionalExpression | `false` | hole | No truncation at all any more: the ids located beyond character 99 of a long line enter declaredIds whereas the shipped build loses them. RECIPE: `## Criteria` / a 113-char line ending in AC12 with a… |
| 146 | EqualityOperator | `t.length >= 100` | hole | Boundary: the line of exactly 100 characters tips into truncation. RECIPE identical to m14 (a 100-char line ending in AC12 + reference `see AC12`); spec-check --json. MEASURED shipped: full text, dec… |
| 146 | EqualityOperator | `t.length <= 100` | hole | Truncation inverted: 22 cases out of 28 differ. Both flips are measured on the same recipes as m14/m15: len100_id exit 0 -> 1 (declaredIds [AC12] -> [AC1], dangling manufactured) AND len113_id exit 1… |
| 146 | MethodExpression | `t` | hole | The long branch keeps the whole text (+…): the ids beyond character 99 rejoin declaredIds. RECIPE: fixture len113_id from m15; spec-check --json. MEASURED shipped: declaredIds [], dangling [{id:AC12}… |
| 146 | StringLiteral | `""` | display-only | Only the truncation MARKER disappears. MEASURED on the 28 cases: the only diffs = len113_id and long_broken, where text is 99 chars without … instead of 100 with … (same excerpt); exit, verdict, ok, … |
| 147 | ConditionalExpression | `true` | equivalent | The predicate becomes `true && !!p.path`: it keeps exactly the pointers with a truthy path. But the grammar only emits three kinds (POINTER_PREFIX = /\\b(file\|test\|adr):/, evidence.js:28) and adr obj… |
| 147 | LogicalOperator | `p.kind === "file" \|\| p.kind === "test" \|\| !…` | hole | With \|\|, a file/test pointer WITHOUT a path passes the filter (adr: pointers stay excluded as they have neither a path nor kind file/test: no crash). RECIPE: section with `- x file:#foo`; spec-check … |
| 156 | StringLiteral | `""` | display-only | The reason of a GREEN criterion becomes empty. MEASURED on the 28 cases: only the reason fields of the linked:true rows of the JSON change (\"linked\" -> \"\"); exit, verdict, counts, dangling, text,… |
| 164 | ArithmeticOperator | `heads[0][0] - 1` | hole | The vacuity finding points 2 lines too high (down to L-1, measured when the heading is on line 1: a negative line number in the JSON contract), and the exclusion of declaration lines from the bundle … |
| 164 | MethodExpression | `lines[heads[0][0]]` | display-only | The echo of the heading in the vacuity finding keeps its trailing whitespace. MEASURED on the 28 cases: the only diff = vacuity_trailing, text `## Acceptance criteria ` instead of `## Acceptance crit… |

### specBundleConformance — 11 survivor(s): 9 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 201 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Dead twice over. (1) The `?? []` fallback is unreachable: `per.find` never misses (per = map of the same files array), proven by control C1 (predicate forced to false → TypeError crash under mutant 2… |
| 201 | ArrowFunction | `() => undefined` | hole | `find` no longer finds anything → `?.`→undefined → `?? []` → declaredLines empty: the same collapse as mutant 1, the declaration lines are reread as references. MEASURED on the caseE recipe (criterio… |
| 201 | ArrowFunction | `() => undefined` | hole | declaredLines becomes Set{undefined}: `has(i+1)` (a number) is never true any more — the same collapse of the exclusion. MEASURED (caseE): exit 0→1, dangling []→[{spec.md:3,REQ-77}] through the funct… |
| 201 | ConditionalExpression | `false` | hole | Identical to mutant 3 by another path: `find` always fails → declaredLines empty. MEASURED (caseE, same recipe: spec with a criterion >100 chars carrying REQ-77 after the truncation, shipped artifact… |
| 201 | LogicalOperator | `per.find(p => p.path === f.path)?.criteria.…` | hole | The .map() always returns an array (truthy), so `a && []` ALWAYS empties declaredLines: the lines that DECLARE a criterion are reread as references. RECIPE (caseE): bundle specs/spec.md, section `## … |
| 201 | OptionalChaining | `per.find(p => p.path === f.path).criteria` | equivalent | `per` is built by `files.map(...)` over the SAME `files` array iterated afterwards: for every f there exists p with p.path===f.path, `find` never returns undefined, the `?.` guard is dead code by con… |
| 203 | ArithmeticOperator | `i - 1` | hole | The exclusion slides by two lines: the line TWO lines below a criterion is excluded from the scan, and the criterion line itself no longer is. DOUBLE effect measured. FALSE GREEN (caseF): spec.md wit… |
| 203 | ConditionalExpression | `false` | hole | The guard excluding declaration lines becomes inert: the same effects as mutant 1. MEASURED (caseE: criterion of 112 chars with REQ-77 at position 106, green pointer to the shipped code/router.ts, `s… |
| 207 | ConditionalExpression | `true` | hole | The dedup ignores the file: same line + same id is enough, across files. RECIPE (caseD): bundle spec.md (AC1 linked, shipped artifact code/router.ts) + plan.md l.3 `do AC7` + tasks.md l.3 `do AC7`; `… |
| 207 | ConditionalExpression | `true` | hole | The dedup ignores the id: same file + same line is enough — the SECOND dangling identifier on the same line is swallowed. RECIPE (caseC): tasks.md l.3 `do AC7 then FR9` (two ids declared nowhere) in … |
| 217 | MethodExpression | `[...declared]` | hole | `declaredIds` comes out in insertion order instead of sorted order in spec-check's machine JSON (a field of the ADR-0056 contract, consumed as is — not display text). RECIPE (caseG): spec.md declarin… |

### pointerLinks — 10 survivor(s): 5 hole · 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 32 | ConditionalExpression | `false` | equivalent | Dead branch in THIS module: `malformed` has only one assignment site (evidence.js:125, the adr: arm) and specConformance filters on kind file/test + !!p.path before calling pointerLinks, a private fu… |
| 33 | BooleanLiteral | `true` | equivalent | Dead branch (see mutants 1-2: the only assignment site of malformed = the adr: arm, filtered before pointerLinks; fuzz 25 shapes = 0; CLI unchanged everywhere). Measured sensitivity control: forced d… |
| 33 | ObjectLiteral | `{}` | equivalent | Same dead branch as the previous mutant (malformed never set on a file:/test: pointer — fuzz measured at 0 over 25 shapes, CLI unchanged on every scenario). Sensitivity control: the forced direct cal… |
| 33 | StringLiteral | `ˋˋ` | equivalent | Dead branch (same proofs as mutants 1-3: fuzz 0/25, CLI unchanged on the 20 scenarios). Measured sensitivity control: forced direct call — reason 'file:x — synthetic-malformed' becomes '': a differen… |
| 37 | ConditionalExpression | `false` | hole | RECIPE: spec `- AC1 -> file:./` (a pointer to the root itself), `runward spec-check s.md -p . --json`. Before: exit 1, reason 'file:./ — points outside the project tree'; after: exit 1 but reason 'fi… |
| 37 | StringLiteral | `"Stryker was here!"` | hole | Effect identical to mutant 5 (rel is never 'Stryker was here!', so the rel === '' arm is neutralised). Measured: `file:./` goes from 'points outside the project tree' to 'not a file' (exit 1 kept); a… |
| 50 | ConditionalExpression | `true` | equivalent | JS semantics: when p.line is undefined, `content.split('\n').length < undefined` is a NaN comparison = false — the && decides identically with the guard forced to true. Measured: 0 diff on the 20 sce… |
| 53 | MethodExpression | `p.symbol` | hole | VERDICT INVERSION on a quoted symbol padded with spaces. RECIPE: spec `- AC1 -> file:code/short.ts#" x"` (symbol ' x', 2 characters one of which is whitespace, trim -> 1), artifact 'const x = 1;', sp… |
| 108 | ObjectLiteral | `{}` | hole | Reason class. RECIPE: `- AC3 test:code/app.test.js::doesNotExist` on a non-JUnit source. Measured: unlinked and exit 1 kept (`{}` falsy-ok in the filter), reason goes from "test named "doesNotExist" … |
| 108 | StringLiteral | `ˋˋ` | hole | Reason class. Same recipe and same measurement as M28: red kept, reason `""` — the operator sees "unlinked" without knowing it is the test's NAME that is missing from the file (remediation: fix the n… |

### CRITERIA_HEADING — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 21 | Regex | `/#{1,6}\s.*\b(acceptance\|criteria)\b/i` | hole | Without the ^ anchor, a line of prose containing `# ` + the word acceptance becomes a section heading. RECIPE: spec with no criteria section at all (`# Spec` / prose `see the # acceptance notes below… |

### LIST_ITEM — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 22 | Regex | `/(?:[-*]\s\|\d+\.\s)/` | hole | Without ^, LIST_ITEM matches a superset: any section prose containing `- ` mid-line becomes a criterion without a pointer. RECIPE: section with `- login works file:src/auth.ts#login` + prose `The set… |

## Module: territory

Survivors: 36

Holes: 11 · Equivalent: 25 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### readOneWrangler — 10 survivor(s): 4 hole · 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 269 | StringLiteral | `""` | hole | Changing `.split("\\").join("/")` to `.join("")` changed the derived path on the fixture whose entry module carries a backslash in its name: `src/a/b.ts` became `src/ab.ts`. The category is therefore… |
| 288 | Regex | `/["']\|["']$/g` | hole | Dropping the `^` makes the strip remove every quote in the value, not just the delimiters. Measured on a manifest whose entry is `main = "src/o'brien.ts"`: the delivered code derives two bindings on … |
| 288 | Regex | `/^["']\|["']/g` | hole | Dropping the `$` on the second alternative has the same effect as dropping the `^` on the first: interior quotes are stripped. On the `main = "src/o'brien.ts"` fixture the two bindings became a singl… |
| 300 | StringLiteral | `"Stryker was here!"` | equivalent | The default only feeds tomlStringList, which returns null for any string not starting with "[", so "" and "Stryker was here!" both yield null and the loop continues. Measured: byte-identical Derivati… |
| 344 | ConditionalExpression | `true` | equivalent | Instrumented the loop and enumerated every value that reaches `Object.entries(tree.env)` across the fixtures — null, boolean, number, empty string, non-empty string, array, object. Every value the gu… |
| 344 | ConditionalExpression | `true` | equivalent | `cfg && true` admits every truthy env value including scalars; the instrumented enumeration over null/boolean/number/string/array/object shows every newly admitted value yields no crons array and no … |
| 344 | LogicalOperator | `cfg \|\| typeof cfg === "object"` | equivalent | `cfg \|\| typeof cfg === "object"` additionally admits truthy scalars (42, true, "triggers") and null, and rejects nothing the original admitted. The instrumented enumeration shows each of those values… |
| 348 | OptionalChaining | `cfg.triggers` | equivalent | Instrumented the `for (const [envName, cfg] of scopes)` loop and logged every cfg over the fixtures: 17 iterations, all `typeof cfg === "object"` and none null. The root scope is the tree, already pr… |
| 357 | OptionalChaining | `cfg.queues` | equivalent | Same instrumented measurement: cfg is a non-null object on all 17 scope iterations observed, so `cfg.queues` cannot throw where `cfg?.queues` was needed. Derivations byte-identical over 29 projects, … |
| 361 | ConditionalExpression | `true` | hole | `bindings.some((b) => true)` asks whether ANY manifest has bound something, not whether THIS one did, and `bindings` accumulates across manifests. Measured on a project holding `wrangler.a.toml` (dec… |

### deriveAll — 7 survivor(s): 7 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 376 | ConditionalExpression | `true` | equivalent | Every binding deriveAll sorts comes from `readOneWrangler`'s `emit`, which hardcodes `source: "derived"`, so the `m:` branch is dead. Measured by instrumenting deriveAll to log any binding with `sour… |
| 376 | StringLiteral | `ˋˋ` | equivalent | Same measurement: the `m:` arm of the ternary is never evaluated because no binding reaching deriveAll's sort carries `source: "map"` (0 occurrences over 170 invocations / 4591 bindings under instrum… |
| 379 | ConditionalExpression | `true` | equivalent | The mutation only maps the tie-equal case from 0 to 1, and V8's sort branches solely on `comparefn(...) < 0`. Measured: 945 synthetic trials (7 input shapes, sizes 3..5000, up to 98% duplicate keys) … |
| 379 | ConditionalExpression | `false` | equivalent | The mutation only maps the tie-greater case from 1 to 0, which V8's sort never distinguishes from 1 (it consults only `comparefn(...) < 0`). Measured: identical permutations in 945/945 synthetic tria… |
| 379 | EqualityOperator | `tie(a.via) <= tie(b.via)` | equivalent | `<=` only changes the answer for tie-EQUAL pairs, which it permutes (synthetic test: 654/945 random arrays up to 5000 elements get a different permutation of equal keys, while the sorted key order is… |
| 379 | EqualityOperator | `tie(a.via) >= tie(b.via)` | equivalent | `>=` keeps the correct 1 for tie-greater and only turns the tie-equal 0 into 1, which V8's sort treats identically. Measured: 945/945 synthetic trials give the same permutation with element identitie… |
| 379 | EqualityOperator | `tie(a.via) <= tie(b.via)` | equivalent | `<=` here yields 1 for tie-equal and 0 for tie-greater; both are "not less", and V8's sort only tests `comparefn(...) < 0`. Measured: 945/945 synthetic trials produce the identical permutation, and d… |

### readToml — 7 survivor(s): 5 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 136 | StringLiteral | `"Stryker was here!"` | hole | Applied to dist and called directly: readToml(`x = "a\`) stores `"a\` at HEAD and `"a\Stryker was here!` mutated, because the ?? only fires when a backslash is the last character of the line. Through… |
| 155 | ConditionalExpression | `false` | equivalent | `!line` is true only for the empty string, and the three matchers below it (`\[\[`, `\[`, `[A-Za-z0-9._"'-]+`) each require at least one character, so an empty line falls through to the same continue… |
| 168 | Regex | `/^([A-Za-z0-9._"'-]+)\s*=\s*(.*)/` | hole | `$` is load-bearing when the line carries a lone CR, which `.` cannot cross. Measured on a wrangler.toml with CR-only line endings: HEAD matches nothing and reports `no root main`, the mutant reads `… |
| 180 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The line is guarded by `value.startsWith("[")`, so `value.match(/\[/g)` always returns at least one match and the `\|\| []` fallback is unreachable. Measured: exhaustive enumeration of 16 105 TOML inpu… |
| 183 | MethodExpression | `next.split("#")[0]` | hole | Dropping the trim keeps each continuation line's indentation inside the value. Measured on the same multi-line `main`: HEAD resolves `[ "a" ]`, the mutant `[ "a" ]`, and the two crafted projects swap… |
| 183 | StringLiteral | `""` | hole | Continuation lines are joined without the separating space. Measured through deriveCloudflareWorkers on a multi-line array under `main`: HEAD resolves the entry as `[ "a" ]` and the mutant as `["a"]`… |
| 189 | MethodExpression | `value` | hole | Storing the raw value keeps the trailing space the continuation loop appends when it stops at end of file. Measured: an unterminated `main = [` array stores `[ "a" ` instead of `[ "a"`, which changes… |

### stripJsonc — 6 survivor(s): 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 41 | StringLiteral | `"Stryker was here!"` | equivalent | The ?? fires only when the manifest's last byte is a backslash inside a string, which leaves that string unterminated, so JSON.parse throws in both versions and the outcome is `unread` either way. Me… |
| 58 | EqualityOperator | `i <= text.length` | equivalent | `i <= text.length` only lets the line-comment scan step one index past the end, where text[i] is undefined (never a newline) and the outer `while (i < text.length)` exits identically. Measured: 111 1… |
| 64 | EqualityOperator | `i <= text.length` | equivalent | At `i === text.length` the added iteration tests `text[i] === "*"` on undefined, which is false, so the scan stops one index later and the following `i += 2` lands past the end in both versions. Meas… |
| 79 | StringLiteral | `"Stryker was here!"` | equivalent | Second-pass twin of the first-pass escape: it fires only when the last character of the comment-stripped text is a backslash inside a string, which leaves the document unparseable either way. Measure… |
| 97 | ConditionalExpression | `true` | equivalent | `/\s/.test(undefined)` is false, so the whitespace skip stops at the end of `out` with or without the bound, and `out[k] === "}"` is false past the end. Measured: 111 111 exhaustively enumerated docu… |
| 97 | EqualityOperator | `k <= out.length` | equivalent | Same boundary with `<=`: the one extra index holds undefined, which is not whitespace, so the loop exits at the same k. Measured: 111 111 exhaustively enumerated documents byte-identical, ten crafted… |

### deriveCloudflareWorkers — 4 survivor(s): 2 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 220 | MethodExpression | `readdirSync(projectRoot).filter(f => WRANGL…` | hole | Without `.sort()` the manifest read order, hence the order of `derivation.notes`, follows the filesystem. Measured with `fs.readdirSync` patched to return reverse order before the ESM binding: baseli… |
| 223 | ObjectLiteral | `{}` | hole | The note becomes `{}`. Measured on the chmod 0111 mission through `rules --for --json`: `derivation.notes[0]` loses `adapter`, `file`, `outcome` and `detail`; the human line renders `undefined · — · … |
| 241 | ConditionalExpression | `true` | equivalent | When `contested` is empty the guarded block is a no-op: `filter(b => !contested.includes(b.path))` is the identity and the `for (const p of contested)` body never runs. Measured: with `if (true)` the… |
| 244 | MethodExpression | `[...byEntry.get(p)]` | equivalent | The Set is filled by iterating `all.bindings`, which are pushed file by file in `found` order, and `found` is already `.sort()`ed, so the spread is monotone and `.sort()` is a no-op. Measured: the am… |

### tomlStringList — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 197 | ArrowFunction | `() => undefined` | equivalent | The mapped VALUES are never read: tomlStringList has exactly one call site (dist/lib/territory.js:300) which uses only `crons === null` and `crons.length`, and `.map` preserves length. Measured: five… |
| 197 | LogicalOperator | `m[1] && m[2]` | equivalent | `m[1] && m[2]` changes each element's value but not the array's length, and the single call site reads only null-ness and length. Measured: the same five crafted cron fixtures and 1 200 fuzzed manife… |

## Module: workflow-contract

Survivors: 33

Holes: 33 · Equivalent: 0 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### parseWorkflowContract — 21 survivor(s): 21 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 42 | Regex | `/\.md/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 43 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 49 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 54 | MethodExpression | `entry.replace(/#gated$/, "")` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 61 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 62 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 65 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 65 | MethodExpression | `entry.slice(0, i)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 65 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 66 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 66 | MethodExpression | `entry.slice(i + 1)` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 66 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 66 | UnaryOperator | `+1` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 68 | ArrayDeclaration | `[]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 68 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 69 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 70 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 71 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 72 | StringLiteral | `ˋˋ` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### readWorkflowContracts — 7 survivor(s): 7 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 85 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 91 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 91 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 94 | MethodExpression | `[...files]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 99 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 100 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 100 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### listField — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 27 | Regex | `/\[/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 27 | Regex | `/\]/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### confined — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 32 | Regex | `/[A-Za-z]:/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### FRONTMATTER — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 18 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### producesGateJoin — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 128 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

## Module: identity

Survivors: 30

Holes: 30 · Equivalent: 0 · Display-only: 0 · Defence-in-depth: 0

**Whole net: never run for this module.** Its `hole` filings rest on the unit suite alone, so they claim less than the vocabulary above says — read them as *pass 1 only*.

### forgeLoginFromEmail — 12 survivor(s): 12 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 80 | MethodExpression | `email` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 82 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 86 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 86 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 86 | LogicalOperator | `plus !== -1 \|\| /^\d+$/.test(local.slice(0, …` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 86 | Regex | `/\d+$/` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 86 | Regex | `/^\d+/` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 86 | UnaryOperator | `+1` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | LogicalOperator | `login === "" && /[@+\s]/.test(login)` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 87 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### byMatchesCommitter — 7 survivor(s): 7 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 96 | LogicalOperator | `committer.email.split("@")[0] && ""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 96 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 96 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 97 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 97 | MethodExpression | `[committer.name, login ?? "", local]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 97 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 97 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### readIdentities — 5 survivor(s): 5 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 32 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 34 | BlockStatement | `{}` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 37 | OptionalChaining | `j.identities` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 38 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 38 | LogicalOperator | `!raw && typeof raw !== "object"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### singleAccountableOptIn — 3 survivor(s): 3 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 52 | StringLiteral | `""` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 53 | OptionalChaining | `j.singleAccountable` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 54 | ConditionalExpression | `true` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### resolveIdentity — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 64 | ConditionalExpression | `false` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |
| 64 | StringLiteral | `"Stryker was here!"` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

### spellingsOf — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 70 | ArrayDeclaration | `["Stryker was here"]` | hole | NOT YET INSTRUCTED — filed as a hole because no measurement has decided it (the isRegularFile precedent). Survived pass 1 (the unit suite, Stryker status Survived) in the v0.43.0 release ratchet, run… |

## Module: scaffold-lock

Survivors: 28

Holes: 15 · Equivalent: 13 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### corpusDivergence — 17 survivor(s): 11 hole · 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 117 | MethodExpression | `readdirSync(missionRules).filter(f => f.end…` | hole | The extra[] list loses its deterministic order. APFS here returns readdir already byte-sorted, so I re-ran the module against a shim whose readdirSync reverses the order (ext4/XFS behaviour): extra g… |
| 118 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The `: []` branch is unreachable: the function already returned status "package" unless existsSync(missionRules) was true. Measured: poisoning it produces byte-identical output across the 50-fixture … |
| 135 | StringLiteral | `ˋˋ` | hole | Files absent from disk are pushed by the shipped-names loop instead of the recorded-keys loop, so corpus.missing is emitted in a different order. Measured on `runward check --strict --json` for a mis… |
| 138 | MethodExpression | `ruleKeys` | hole | When the lock's `files` keys are not stored sorted (a hand-edited or third-party-written lock), edited[] and missing[] lose their deterministic order. Measured on `runward check --strict --json` with… |
| 142 | ConditionalExpression | `true` | equivalent | The guard never fires: the shipped-names loop only pushes files ABSENT from `recorded`, while this loop only iterates keys PRESENT in `recorded`, so the two sets are disjoint. Measured by instrumenti… |
| 164 | StringLiteral | `"Stryker was here!"` | equivalent | The initial value of `head` is never read: it is overwritten by the readFileSync on the success path, and the catch path returns true before touching it. Measured by initialising it to null instead —… |
| 166 | MethodExpression | `readFileSync(join(missionRules, f), "utf8")` | hole | Removing the 800-character window makes the whole file searched for gated frontmatter. Measured on the CLI with a house rule whose `impact: HIGH` / `phases: [floor]` lines sit after 900 characters of… |
| 171 | OptionalChaining | `head.match(/^impact:\s*([A-Za-z]+)/m)?.[1].…` | equivalent | The regex capture group ([A-Za-z]+) is mandatory, so whenever match() returns non-null, index 1 is a string and the second optional chain is dead. Measured by instrumenting the site: 0 occurrences of… |
| 171 | Regex | `/impact:\s*([A-Za-z]+)/m` | hole | Dropping the ^ anchor makes any mid-line `impact:` match. Measured on the CLI with a house rule whose frontmatter reads `meta_impact: HIGH` plus `phases: [floor]`: corpus.extra goes from [] to ["zz-h… |
| 171 | Regex | `/^impact:\s([A-Za-z]+)/m` | hole | `\s*` to `\s` stops matching zero-space and two-space spellings, so a gated extension escapes the check the code exists to enforce. Measured on the CLI with a house rule spelled `impact:HIGH` / `phas… |
| 171 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback value only feeds `impact === "CRITICAL" \|\| impact === "HIGH"`, which "Stryker was here!" fails exactly as "" does. Measured by instrumenting the site: the ?? fallback fires 5 times acros… |
| 172 | Regex | `/phases:\s*\[([^\]]*)\]/m` | hole | Dropping the ^ anchor makes any mid-line `phases:` match. Measured on the CLI with a house rule spelled `impact: HIGH` plus `meta_phases: [floor]`: corpus.extra goes from [] to ["zz-house.md"] and st… |
| 172 | Regex | `/^phases:\s\[([^\]]*)\]/m` | hole | `\s*` to `\s` stops matching `phases:[floor]` and `phases: [floor]`. Measured on the CLI with a house rule spelled `impact:HIGH` / `phases:[floor]`: corpus.extra goes from ["zz-house.md"] to [] and s… |
| 172 | StringLiteral | `"Stryker was here!"` | equivalent | The fallback feeds split/trim/dequote then GATED.has, and "Stryker was here!" is not a gated phase any more than "" is. Measured by instrumenting the site: the ?? fallback fires 6 times, both values … |
| 174 | MethodExpression | `phases.split(",").map(x => x.trim().replace…` | hole | `some` to `every` demands that ALL phases be gated. Measured on the CLI with two house rules: `phases: [run, floor]` and `phases: ["govern", "run"]` both stop being reported — corpus.extra ["zz-house… |
| 174 | MethodExpression | `x` | hole | Dropping trim() leaves the leading space on every phase after the first. Measured on the CLI with a house rule declaring `phases: [run, floor]`: " floor" no longer matches GATED, corpus.extra goes fr… |
| 174 | StringLiteral | `"Stryker was here!"` | hole | Replacing quotes with a token instead of removing them breaks the quoted YAML spelling. Measured on the CLI with a house rule declaring `phases: ["govern", "run"]`: corpus.extra goes from ["zz-house.… |

### readScaffoldLock — 7 survivor(s): 4 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 34 | ConditionalExpression | `false` | equivalent | Removing the existsSync early return just routes an absent lock through readFileSync's ENOENT, which the surrounding try/catch already converts to the same `null`. Measured: byte-identical output acr… |
| 37 | StringLiteral | `""` | equivalent | readFileSync with encoding "" returns a Buffer instead of a string, and JSON.parse coerces it through toString() to the same utf8 text. Measured: identical parse of a lock containing non-ASCII (writt… |
| 38 | ConditionalExpression | `false` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 41 | ConditionalExpression | `true` | equivalent | Reachable only through JSON.parse output, where no non-object value (string, number, boolean, array element, null) carries string `name` and `version` properties, so the typeof check can never be wha… |
| 41 | LogicalOperator | `j.corpus \|\| typeof j.corpus === "object"` | hole | `&&` to `\|\|` accepts any truthy corpus value and, worse, makes a lock containing "corpus": null throw on j.corpus.name into the outer catch so the WHOLE lock reads as absent. Measured on the CLI: tha… |
| 42 | ConditionalExpression | `true` | hole | A numeric corpus.name is accepted as a valid pin. Measured on the CLI with a lock pinned {name: 7, version: "1.0.0"} beside a runward/rules/corpus.json of {name: "acme", version: "1.0.0"}: corpusDrif… |
| 42 | ConditionalExpression | `true` | hole | A numeric corpus.version is accepted as a valid pin. Measured on the CLI with a lock pinned {name: "acme", version: 7} beside a corpus.json of {name: "acme", version: "1.0.0"}: corpusDrift goes from … |

### scaffoldedProjectHashes — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 60 | StringLiteral | `""` | equivalent | A default value no caller uses: both callers pass missionDir (evidence.ts, `scaffoldedProjectHashes(dirname(missionDir), missionDir)`; propose.ts, `scaffoldedProjectHashes(root, mission)`). Measured:… |
| 62 | StringLiteral | `""` | equivalent | On POSIX no key reaches `add` with a backslash: readScaffoldLock already normalises the lock's keys, and relative/join return `/` separators. Equivalent on this platform only (the onDiskSpelling prec… |

### hashText — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 25 | StringLiteral | `""` | equivalent | Node falls back to the default (utf8) for an unrecognised encoding string on Hash.update. Measured directly: sha256 digests are identical for "" and "utf8" on 6 inputs including accents, emoji and la… |

### readPublishedRuleHashes — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 36 | StringLiteral | `""` | equivalent | `readFileSync(file, "")`: an empty encoding is treated as no encoding and returns a Buffer; `JSON.parse` coerces its argument to a string, which decodes the Buffer as UTF-8, the same text the "utf8" … |

## Module: wire-install

Survivors: 20

Holes: 20 · Equivalent: 0 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### removeClaudeSettings — 11 survivor(s): 11 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 77 | ArrayDeclaration | `["Stryker was here"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 77 | OptionalChaining | `base.hooks` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | ConditionalExpression | `true` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | LogicalOperator | `typeof e?.["runward-wired"] !== "string" \|\|…` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | OptionalChaining | `e["runward-wired"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 78 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 79 | LogicalOperator | `e?.hooks && ""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 79 | OptionalChaining | `e.hooks` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 79 | StringLiteral | `"Stryker was here!"` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 87 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### alreadyWired — 6 survivor(s): 6 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 48 | ArrayDeclaration | `["Stryker was here"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 48 | OptionalChaining | `j?.hooks.Stop` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 48 | OptionalChaining | `j.hooks` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 49 | ArrayDeclaration | `["Stryker was here"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 49 | OptionalChaining | `j.hooks` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
| 53 | OptionalChaining | `e["runward-wired"]` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### claudeStopEntry — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 26 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### kiroHookContent — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 40 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

### mergeClaudeSettings — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 71 | StringLiteral | `""` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |

## Module: territory-map

Survivors: 16

Holes: 5 · Equivalent: 11 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### readTerritoryMap — 9 survivor(s): 5 hole · 4 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 57 | LogicalOperator | `cols[0] && ""` | equivalent | The mutation kills the first disjunct only (`cols[0] && ""` tests "", always false), and the second regex is a strict superset of the first. Measured by enumerating 137257 strings over the alphabet {… |
| 57 | Regex | `/-{2,}$/` | hole | Dropping the `^` makes any first column ENDING in two dashes read as a separator. Measured on `\| src/a-- \| `startup` \| declare \| ... \|`: the row goes from live to silently swallowed — no binding, no … |
| 57 | Regex | `/^-{2,}/` | hole | Dropping the `$` makes any first column STARTING with two dashes read as a separator. Measured on `\| --src/a.ts \| `startup` \| declare \| ... \|`: 1 live row becomes 0 rows and 0 problems — a declaratio… |
| 57 | Regex | `/:?-{2,}:?$/` | hole | Dropping the `^` on the alignment separator makes any first column ENDING in two dashes (optionally colon-terminated) read as a separator. Measured on `\| src/a-- \| `startup` \| declare \| ... \|`: live … |
| 57 | Regex | `/^:?-{2,}:?/` | hole | Dropping the `$` makes any first column STARTING with dashes read as a separator. Measured on `\| --src/a.ts \| `startup` \| declare \| ... \|`: the declaration is swallowed as table syntax, with no refus… |
| 57 | StringLiteral | `"Stryker was here!"` | equivalent | Same site as mutant #2: the literal is the `??` default, reached only when `cols[0]` is undefined (a row whose trimmed text is exactly `\|`, present in the probe). Measured: `/^-{2,}$/` returns false … |
| 57 | StringLiteral | `"Stryker was here!"` | equivalent | Third instance of the same `??` default on the separator line, reached only when `cols[0]` is undefined. Measured: `/^:?-{2,}:?$/` returns false for both "" and "Stryker was here!" — the probe row `\|… |
| 61 | Regex | `/pattern$/i` | hole | Dropping the `^` makes any first column ENDING in "pattern" read as the table header. Measured on `\| src/pattern \| `startup` \| declare \| ... \|`: rows goes 1 to 0 and problems stays empty, so a live d… |
| 61 | StringLiteral | `"Stryker was here!"` | equivalent | The literal is only the `??` default, reached solely when `cols[0]` is undefined — a row whose trimmed text is exactly `\|`. Measured: that row is in the probe (it yields "found 0 columns" identically… |

### applyTerritoryMap — 5 survivor(s): 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 138 | ConditionalExpression | `true` | equivalent | The `? 1 : 0` tail is reached only when the paths are equal and the categories are not less-than; since duplicates cannot exist (Map key `${path} ${category}`), that means strictly greater, so the or… |
| 138 | ConditionalExpression | `false` | equivalent | Returning 0 where the original returns 1 preserves the predicate `cmp(a,b) < 0 <=> a < b`, and V8's TimSort branches on nothing else. Measured, not assumed: over 3360 sorts (sorted, reversed, two-hal… |
| 138 | EqualityOperator | `a.category <= b.category` | equivalent | The category term is reached only when the two paths are equal, and `state` is a Map keyed by `${path} ${category}` (categories carry no space, so the key is injective), so two entries with the same … |
| 138 | EqualityOperator | `a.category >= b.category` | equivalent | Reached only when the categories are strictly greater (duplicates are impossible under the Map key), where `>=` and `>` agree. Measured: 3360 sorts across 7 shapes up to 4000 elements produce identic… |
| 138 | EqualityOperator | `a.category <= b.category` | equivalent | Same shape as mutant #42 — the tail returns 0 instead of 1, leaving `cmp(a,b) < 0 <=> a < b` intact. Measured: identical comparator call sequence and identical output over 3360 sorts (7 shapes, sizes… |

### TRIVIAL — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 26 | MethodExpression | `s` | equivalent | TRIVIAL's only call site passes `why`, which is `rest.join(" \| ").trim()`, so its argument is already trimmed and String#trim is idempotent. Measured: 1008 padded values over twelve whitespace code p… |
| 26 | MethodExpression | `s` | equivalent | Second occurrence of the same idempotence: TRIVIAL is called only with `why`, itself the result of `.trim()`, so `/^\[.*\]$/.test(s.trim())` and `.test(s)` receive the same string. Measured: 1008 pad… |

## Module: attestation

Survivors: 13

Holes: 0 · Equivalent: 12 · Display-only: 0 · Defence-in-depth: 1

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### hashTree — 7 survivor(s): 7 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 54 | ArrowFunction | `() => undefined` | equivalent | A comparator that returns undefined counts as 0 for Array.sort (ToNumber -> NaN -> 0): a no-op stable sort = readdir order = mutant 9. Same argument (canonicalisation re-sorts, content independent of… |
| 54 | ConditionalExpression | `true` | equivalent | Inconsistent comparator = an arbitrary but deterministic permutation of the traversal; the content of the map does not depend on the order and missionStateDigest re-sorts the keys. Measured: bytes id… |
| 54 | ConditionalExpression | `false` | equivalent | Same class as mutant 11: only the traversal order moves, the content is identical, canonicalisation re-sorts. Measured: bytes identical to shipped everywhere, digest and sensitivity unchanged. Positi… |
| 54 | EqualityOperator | `a.name <= b.name` | equivalent | The names within one directory are unique (readdir): the equality case does not even exist, the mutated comparator is pointwise identical to shipped. Measured: identical bytes everywhere. Positive co… |
| 54 | EqualityOperator | `a.name >= b.name` | equivalent | Reversed traversal: a pure permutation, identical map content, keys re-sorted at canonicalisation. Measured: bytes identical to shipped on M0 and the 9 altered trees, idempotent. Positive control: 8/… |
| 54 | MethodExpression | `readdirSync(dir, { withFileTypes: true })` | equivalent | hashTree has only one consumer, missionStateDigest, which RE-SORTS every key at canonicalisation; the content of the map is independent of the traversal order (unique rel keys, no collision). Measure… |
| 54 | UnaryOperator | `+1` | equivalent | Identical in effect to mutant 12 (constant comparator): traversal order permuted, content unchanged, canonicalisation re-sorts. Measured: bytes identical to shipped everywhere, identical digest, sens… |

### buildBundleStatement — 5 survivor(s): 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 38 | ConditionalExpression | `true` | equivalent | The comparator becomes a<b?-1:1: identical to shipped on distinct names, only differs on ties (1 instead of 0), unreachable (CLI deduplication). Measured: NO difference anywhere — including the equal… |
| 38 | ConditionalExpression | `false` | equivalent | The comparator becomes a<b?-1:0 ("less/not less" only). Measured on the CLI's real V8: zero divergence over 720 seeded permutations covering binary insertion AND TimSort merging (sizes 2,3,5,8,13,21,… |
| 38 | EqualityOperator | `a.name <= b.name` | equivalent | Only differs on subjects with the SAME name (equality -> -1 instead of 0, the stable sort reorders the ties). Measured sensitivity control: the direct function probe with equal names/distinct digests… |
| 38 | EqualityOperator | `a.name >= b.name` | equivalent | On distinct names, >= equals >: pointwise identical to shipped; only equality differs (1 instead of 0), unreachable (CLI deduplication, unique readdir names). Measured: no difference, including the e… |
| 38 | EqualityOperator | `a.name <= b.name` | equivalent | On distinct names this reduces to a<b?-1:0 — the same function as mutant 4; ties -> 1, unreachable. Measured: zero divergence (720 permutations up to 512, CLI bundles of 40/600, equal-names probe, by… |

### RUNWARD_PREDICATE_TYPE — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 27 | StringLiteral | `""` | defence-in-depth | Leg: intoto-schema — REPLAYED, exit 1, two red asserts: the vendored schema (predicateType minLength 1 + format uri) and the literal assert === "https://runward.dev/verdict/v1". The units survive str… |

## Module: rules

Survivors: 11

Holes: 7 · Equivalent: 4 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### corpusStamp — 5 survivor(s): 3 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 214 | ConditionalExpression | `false` | equivalent | The existsSync guard is redundant: the surrounding try already absorbs the read failure and returns null. Measured corpusStamp over 13 fixtures — absent corpus.json, absent directory entirely, corpus… |
| 217 | StringLiteral | `""` | equivalent | "" is not a valid Node encoding, so readFileSync returns a Buffer instead of throwing, and JSON.parse stringifies that Buffer as UTF-8 — the same bytes 'utf8' would have produced. Verified directly (… |
| 218 | ConditionalExpression | `true` | hole | Forcing the left conjunct to true drops the name guard: a corpus.json of {"version":"1.0.0"} returned {version:'1.0.0'} with no name (base null), and {"name":7,"version":"1.0.0"} returned {name:7,...… |
| 218 | ConditionalExpression | `true` | hole | Replacing the typeof raw.name check with true accepts a stamp with no name or a numeric one: corpusStamp returned {version:'1.0.0'} and {name:7,version:'1.0.0'} where the baseline returned null in bo… |
| 218 | LogicalOperator | `raw \|\| typeof raw.name === "string"` | hole | Turning && into \|\| short-circuits on a truthy raw, so the name check is never reached: measured the same accepted malformed stamps — {"version":"1.0.0"} -> {version:'1.0.0'} and {"name":7,...} -> {na… |

### corpusDrift — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 238 | ConditionalExpression | `true` | hole | Forcing the name comparison to true makes corpusDrift blind to a corpus NAME change: with the lock pinned to acme@1.0.0 and runward/rules/corpus.json holding other@1.0.0, corpusDrift returned null in… |

### FRONTMATTER — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 18 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | Dropping the ^ anchor lets any ---...--- block in the file be read as frontmatter. Measured: content 'intro line\n\n---\ntitle: Sneaky\nimpact: CRITICAL\n---\n\nreal body' parsed to title 'Sneaky' / … |

### matchRulesForPaths — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 110 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The injected element is a string, so b.path and b.category are undefined: b.path === path is never true, governs.includes(undefined) is never true, and boundCategories gains only undefined, which no … |

### parseRule — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 24 | StringLiteral | `"Stryker was here!"` | equivalent | The sentinel only replaces fm on the no-frontmatter branch, and no field key (title:, impact:, phases:, asi:, tags:, impactDescription:, signature:, nonScope:, appliesTo:, governs:, noTerritory:, noA… |

### readRuleSet — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 201 | MethodExpression | `readdirSync(dir).filter(f => f.endsWith(".m…` | hole | Removing .sort() makes the 'deterministic inventory' depend on readdir order, which Node leaves unspecified. Measured on a fixture rules directory where APFS's UTF-8 byte order differs from JS code-u… |

### ruleBody — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 187 | Regex | `/\n+/` | hole | /^\n+/ -> /\n+/ drops the anchor and (with no g flag) deletes the FIRST newline run anywhere instead of the leading ones. Measured on ruleBody: '# Heading\n\nbody\n' -> '# Headingbody\n', 'text\ntitl… |

## Module: gate-hook

Survivors: 7

Holes: 0 · Equivalent: 7 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-29, against a net that has since changed** (recorded `2102deca2908…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### parseHookPayload — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 14 | OptionalChaining | `j.loop_count` | equivalent | Re-measured 2026-09-29 and re-filed from `hole` (COULD NOT CLEAR) to `equivalent`. `j?.loop_count` -> `j.loop_count` differs only when JSON.parse returns null, and then the mutated read throws a Type… |
| 15 | OptionalChaining | `j.stop_hook_active` | equivalent | Re-measured 2026-09-29 and re-filed from `hole` (COULD NOT CLEAR) to `equivalent`. `j?.stop_hook_active` -> `j.stop_hook_active` differs only when JSON.parse returns null; the mutated read then throw… |

### refusalLines — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 59 | EqualityOperator | `i <= 0` | equivalent | `i < 0` -> `i <= 0` differs only for a problem that STARTS with the ` — ` separator (brief empty, fix the rest, versus brief the whole string). Measured: of 4,545 direct cases, the 378 that differ ar… |
| 66 | ConditionalExpression | `true` | equivalent | `if (fix)` forced true also counts a null instruction under the key null. That entry is never read: `elide` requires `fix !== null` before consulting fixCount, and the Fix lines iterate `fixes`, not … |

### renderRefusal — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 124 | Regex | `/runward gate: /` | equivalent | The anchor of `/^runward gate: /` is dropped. `replace` without the g flag strips the FIRST match, and the text Cursor receives is refusalLines' output, whose first line always begins with `runward g… |
| 124 | StringLiteral | `""` | equivalent | Cursor's refusal reports `stream: ""` instead of `"stdout"`. The only reader, gate-hook's command, writes to stderr when `stream === "stderr"` and to stdout otherwise, so the text still lands on stdo… |

### resolveGateHookHarness — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 13 | ConditionalExpression | `false` | equivalent | `if (!id)` forced false lets an absent id fall through to the table lookups, which answer null for it anyway: GATE_HOOK_HARNESSES.includes(undefined) is false and familyOfHarness(undefined) matches n… |

## Module: citations

Survivors: 4

Holes: 0 · Equivalent: 4 · Display-only: 0 · Defence-in-depth: 0

**Whole net: never run for this module.** Its `hole` filings rest on the unit suite alone, so they claim less than the vocabulary above says — read them as *pass 1 only*.

### compareCitations — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 94 | EqualityOperator | `a.rule <= b.rule` | equivalent | Unreachable equality: the comparison sits behind `if (x !== y)` on the same two values, so `x < y` and `x <= y` can only disagree when x === y, which the guard has already excluded. The ternary retur… |
| 96 | EqualityOperator | `a.via.file <= b.via.file` | equivalent | Unreachable equality: the comparison sits behind `if (x !== y)` on the same two values, so `x < y` and `x <= y` can only disagree when x === y, which the guard has already excluded. The ternary retur… |

### citationsForPaths — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 70 | StringLiteral | `""` | equivalent | `readFileSync(abs, "")`: an empty encoding is treated as no encoding and returns a Buffer, and `symbolPresent` tests it with a RegExp or `includes` after string coercion, which decodes it as UTF-8 — … |

### lexicalTarget — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 9 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The seeded element is a project-relative candidate path that can only be returned if it equals an ASKED path, and an asked path is a normalised project path: the string "Stryker was here" is never on… |

## Module: paths

Survivors: 1

Holes: 0 · Equivalent: 1 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-01, against a net that has since changed** (recorded `dd5f00025151…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### VERSION — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 17 | StringLiteral | `""` | equivalent | Measured on Node v24.18.0: readFileSync(package.json, "") returns a Buffer and JSON.parse coerces it identically, so VERSION is the same string "0.37.0"; JSON.stringify of both parses is byte-equal, … |

## Module: verify-findings

Survivors: 1

Holes: 1 · Equivalent: 0 · Display-only: 0 · Defence-in-depth: 0

**Whole net: last run 2026-09-03, against a net that has since changed** (recorded `ebfd8f9d6b1f…`, current `1bba2855805e…`). A leg was added or edited after that pass, so every filing here that claims the whole net misses the mutant is about the earlier net. Re-run pass 2 to restore the claim.

### verifyFindingsPath — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 21 | OptionalChaining | `verify?.contract.produces` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it, not because one condemned it (the isRegularFile precedent). Survived the CI chunked unit pass, survived the whole-net pass (wholen… |
