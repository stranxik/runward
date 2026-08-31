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

## Module: evidence

Survivors: 267

Holes: 162 · Equivalent: 70 · Display-only: 26 · Defence-in-depth: 9

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

### textOutsideManifest — 12 survivor(s): 8 hole · 4 equivalent

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

### sha256 — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 940 | BlockStatement | `{}` | hole | The gate stops rendering a verdict at all. Shipped probe on t-lock-sentinel: OBSERVABLE, exit-code. Battery: observable on 4 (json:t-unreadable, json:t-lock-sentinel, json:t-lock-sentinel-empty, atte… |
| 941 | StringLiteral | `""` | hole | THE MOST SERIOUS OF THE SIXTEEN: it flips the gate in BOTH directions on a sealed, tampered-with mission. Shipped probe on t-lock-sentinel: OBSERVABLE, exit-code. Battery: observable on 3 (json:t-loc… |

### caseFold — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 300 | MethodExpression | `s.normalize("NFC").toLowerCase().toUpperCas…` | equivalent | The fold's output is never rendered or returned; its single consumer compares two folded names, so only the PARTITION it induces can be observed. The two folds induce the same partition, measured thr… |

### clean — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 195 | Regex | `/[),.:ˋ]$/` | defence-in-depth | Strips one trailing character instead of the run, so a pointer ending in two of ),.: or a backtick keeps the second-to-last — RWD-2026-0055 re-opened one character short. Caught by the cheapest leg o… |

### POINTER_PREFIX — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 28 | Regex | `/\b(file\|test\|adr):(\S.*)/` | hole | Verified by exit code. On m3, whose only cell is `file:code/deleted-j.ts<U+2028> a trailing note` and whose cited file does not exist, `check --strict --json` went from **exit 0 to exit 1**, gaining … |

### realpathOr — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 711 | BlockStatement | `{}` | hole | COULD NOT CLEAR at the call sites that carry the risk — filed as a hole on that ground, and the ground is measured. Ran `node scripts/mutation-probe.mjs --function realpathOr` on norules, on the self… |

### renderEvidenceLock — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 995 | StringLiteral | `""` | hole | Shipped probe on f-plain: no observable difference — the probe never runs `--freeze`, so it never calls this function. Battery: observable on 2, both freeze runs (freeze:f-plain, freeze:f-bracket), w… |

### symbolPresent — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 23 | Regex | `/[A-Za-z_$][A-Za-z0-9_$]*$/` | hole | FALSE GREEN, verified by exit code, and three further observations in three other shapes. (1) m2, whose only defect is the cell `file:code/b.ts#a.b`: `check --strict --json` went from **exit 1 to exi… |

## Module: conformance

Survivors: 126

Holes: 96 · Equivalent: 26 · Display-only: 1 · Defence-in-depth: 3

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

### decisionCoverage — 16 survivor(s): 14 hole · 2 equivalent

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

### adrDecision — 9 survivor(s): 8 hole · 1 equivalent

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

### expectedRules — 6 survivor(s): 4 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 81 | ConditionalExpression | `false` | equivalent | rulesDir() garantit la post-condition : la branche mission n'est retournée que si existsSync(missionRules), sinon templates/rules du paquet — la garde ne s'exerce donc que si templates/rules du paque… |
| 82 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Même atteignabilité que la garde qu'il suit : ce return ne s'exécute que si templates/rules du paquet manque ET la mission n'a pas de rules/ — un paquet mutilé, hors de l'univers d'entrées (packaging… |
| 83 | MethodExpression | `readdirSync(dir).filter(f => f.endsWith(".m…` | hole | Le .sort() supprimé rend l'ordre d'expectedRules dépendant du filesystem (readdir n'est pas trié par contrat — ext4 le rend en ordre de hash ; compliance.readRules trie explicitement « pour l'invaria… |
| 83 | MethodExpression | `readdirSync(dir)` | hole | Sans le filtre .md, expectedRules lit TOUTE entrée du dossier rules/. RECETTE 1 : mission example, sauvegarde d'opérateur contracts-governance.md.bak à côté de la règle (le mécanisme corpus l'ignore … |
| 84 | StringLiteral | `""` | hole | endsWith("") est toujours vrai : le filtre devient un no-op, comportement mesuré identique au retrait pur du filtre. Mêmes recettes, re-mesurées sous CE mutant : contracts-governance.md.bak dans rule… |
| 89 | Regex | `/\.md/` | hole | Sans ancre, replace retire la PREMIÈRE occurrence de « .md » au lieu de l'extension : un nom à « .md » infixe change de slug. RECETTE : mission example, règle a.mdx.md (HIGH, architect — nom légal qu… |

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

### ADR_SET_ASIDE — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 230 | Regex | `/(rejected\|superseded\|withdrawn\|obsolete)$/` | hole | Faux rouge à footprint étroit. Sans ^, tout mot de statut FINISSANT par un mot-clé devient mis de côté. Recette : ADR au `**Status**: unrejected` cité deviated ; fixture .probe-5/fx/g-unrejected, mes… |
| 230 | Regex | `/^(rejected\|superseded\|withdrawn\|obsolete)/` | hole | Faux rouge RÉALISTE. Sans $, un préfixe suffit : `**Status**: obsoleted` — variante anglaise réelle et courante — bascule. Recette : ADR ratifié par ailleurs sain au statut "obsoleted" cité deviated … |

### ADR_UNRATIFIED — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 231 | Regex | `/(proposed\|hypothesis\|draft\|pending)$/` | hole | Faux rouge à footprint étroit, jumeau du mutant 15 côté non-ratifié. Sans ^, tout mot finissant par proposed/hypothesis/draft/pending devient non ratifié. Recette : ADR au `**Status**: redraft` cité … |
| 231 | Regex | `/^(proposed\|hypothesis\|draft\|pending)/` | hole | Faux rouge RÉALISTE. Sans $, le préfixe "draft" matche `**Status**: drafting` — statut plausible d'une équipe réelle (comme "proposée" ne matche pas mais "drafted" matcherait aussi). Recette : ADR au… |

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

### FRONTMATTER — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 17 | Regex | `/---\r?\n([\s\S]*?)\r?\n---/` | hole | The gate-side twin of the compliance anchor survivor (compliance-top-level.json, key 30\|21\|30\|50), re-probed here on conformance.ts's own FRONTMATTER because this copy feeds parseRuleMeta — expectedR… |

### PATH_TOKEN — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 318 | Regex | `/[\w./-]+\.(?:ts\|tsx\|js\|jsx\|mjs\|cjs\|py\|md\|j…` | hole | ya?ml → yaml : l'extension .yml sort de PATH_TOKEN — mesure fonction : evidencePathTokens('code/config/triage-rules.yml — moved') = [] en mute contre ['code/config/triage-rules.yml'] en livre ('.yaml… |

## Module: compliance

Survivors: 94

Holes: 28 · Equivalent: 24 · Display-only: 23 · Defence-in-depth: 19

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

### readConformance — 5 survivor(s): 2 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 64 | ConditionalExpression | `false` | equivalent | Removing the guard means `readFileSync` is called on paths that are not there; it throws ENOENT and the `catch { continue }` two lines below runs the same `continue`. Measured byte-identical on 17 mi… |
| 66 | StringLiteral | `"Stryker was here!"` | equivalent | `body` is declared INSIDE the per-deliverable loop and read only after the `try`; on the only path where the initializer survives, `catch { continue }` has already left the iteration. Measured byte-i… |
| 70 | BlockStatement | `{}` | equivalent | Unlike its sibling in `readRules`, falling through here changes nothing: `body` is re-initialised to `""` at the top of every iteration and `parseManifest("")` finds no `Rule conformance` heading, so… |
| 74 | Regex | `/\[.*\]$/` | hole | Unanchored, the placeholder test drops any manifest row whose rule cell merely ENDS in `]`. Recipe: a rule file named `rule-two [draft].md` - legal on every filesystem runward supports - with the mat… |
| 74 | Regex | `/^\[.*\]/` | hole | The mirror of the sibling above: dropping `$` drops any row whose rule cell merely STARTS with `[`. Recipe: a rule file named `[wip] rule-three.md` with the row `\| [wip] rule-three \| n/a \| no queue i… |

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

## Module: territory

Survivors: 88

Holes: 63 · Equivalent: 25 · Display-only: 0 · Defence-in-depth: 0

### readOneWrangler — 28 survivor(s): 22 hole · 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 252 | StringLiteral | `""` | hole | Applied on dist line 252 and re-ran deriveCloudflareWorkers over 29 disposable projects: 26 of them changed, every derived binding's via.adapter and every readOneWrangler note's adapter became the em… |
| 262 | BlockStatement | `{}` | hole | Replacing the readFileSync catch block with `{}` leaves `text` undefined, so readToml/stripJsonc throw: on the unreadable-manifest fixture deriveCloudflareWorkers went from an `unread` note to `THREW… |
| 263 | StringLiteral | `""` | hole | Measured on a mission whose wrangler.toml is chmod 000: the note's outcome went from "unread" to "". `rules --json --for` filters notes on `outcome === "unread"` to build couldNotRead, so the fail-lo… |
| 263 | StringLiteral | `""` | hole | On the chmod-000 manifest fixture the note keeps outcome "unread" but detail becomes "". couldNotRead[].detail is a machine field of `rules --json --for` and the only statement of WHY the carrier cou… |
| 269 | StringLiteral | `""` | hole | Changing `.split("\\").join("/")` to `.join("")` changed the derived path on the fixture whose entry module carries a backslash in its name: `src/a/b.ts` became `src/ab.ts`. The category is therefore… |
| 285 | StringLiteral | `""` | hole | Applied on dist line 285 (the TOML branch) and measured on a TOML manifest with no root `main`: the note kept outcome "read" but its detail went from "no root `main` (assets-only Worker, or declared … |
| 288 | Regex | `/["']\|["']$/g` | hole | Dropping the `^` makes the strip remove every quote in the value, not just the delimiters. Measured on a manifest whose entry is `main = "src/o'brien.ts"`: the delivered code derives two bindings on … |
| 288 | Regex | `/^["']\|["']/g` | hole | Dropping the `$` on the second alternative has the same effect as dropping the `^` on the first: interior quotes are stripped. On the `main = "src/o'brien.ts"` fixture the two bindings became a singl… |
| 290 | StringLiteral | `""` | hole | Applied on dist line 290 (the TOML branch) with a manifest whose `main` points at a missing file: the note's outcome went from "read" to "". outcome is a machine field in derivation.notes and the dis… |
| 297 | Regex | `/env\.([^.]+)\.triggers$/` | hole | Dropping the `^` lets any table whose name merely ENDS in `env.<x>.triggers` be treated as a per-environment trigger table. Measured on a manifest containing `[myenv.prod.triggers] crons = [...]`: th… |
| 297 | Regex | `/^env\.([^.]+)\.triggers/` | hole | Dropping the `$` lets a deeper table match. Measured on a manifest containing `[env.a.triggers.deep] crons = [...]`: the mutant derived two extra bindings attributed to `env.a.triggers.crons`, a decl… |
| 300 | StringLiteral | `"Stryker was here!"` | equivalent | The default only feeds tomlStringList, which returns null for any string not starting with "[", so "" and "Stryker was here!" both yield null and the loop continues. Measured: byte-identical Derivati… |
| 312 | Regex | `/env\.[^.]+\.queues\.consumers$/` | hole | Dropping the `^` lets any array table ending in `env.<x>.queues.consumers` count as a queue consumer. Measured on a manifest containing `[[legacyenv.old.queues.consumers]]`: the mutant derived an ext… |
| 312 | Regex | `/^env\.[^.]+\.queues\.consumers/` | hole | Dropping the `$` lets a deeper array table match. Measured on a manifest containing `[[env.c.queues.consumers.extra]]`: the mutant derived an extra background-work binding declared `env.c.queues.cons… |
| 325 | BlockStatement | `{}` | hole | Replacing the JSON.parse catch block with `{}` leaves `tree` undefined, so control falls through to the next guard. Measured on a syntactically broken wrangler.json: the note's detail went from "not … |
| 326 | StringLiteral | `""` | hole | Measured on a syntactically broken wrangler.json: outcome stays "unread" but detail becomes "". That detail is the couldNotRead[].detail field of `rules --json --for`, so the carrier is still flagged… |
| 330 | StringLiteral | `""` | hole | Measured on a manifest whose whole content is the JSON document `null`: the note keeps outcome "unread" — so the carrier still appears in the couldNotRead fail-loud list of `rules --json --for` — but… |
| 334 | StringLiteral | `""` | hole | Applied on dist line 334 (the JSON branch, second occurrence) and measured on two fixtures — a JSONC manifest with no `main` and a manifest whose top-level JSON is the array `[1,2,3]`: both notes kep… |
| 339 | StringLiteral | `""` | hole | Applied on dist line 339 (the JSON branch, second occurrence) and measured on two fixtures — `main` pointing at a missing file, and `main` pointing outside the project root: both notes' outcome went … |
| 344 | ConditionalExpression | `true` | equivalent | Instrumented the loop and enumerated every value that reaches `Object.entries(tree.env)` across the fixtures — null, boolean, number, empty string, non-empty string, array, object. Every value the gu… |
| 344 | ConditionalExpression | `true` | equivalent | `cfg && true` admits every truthy env value including scalars; the instrumented enumeration over null/boolean/number/string/array/object shows every newly admitted value yields no crons array and no … |
| 344 | LogicalOperator | `cfg \|\| typeof cfg === "object"` | equivalent | `cfg \|\| typeof cfg === "object"` additionally admits truthy scalars (42, true, "triggers") and null, and rejects nothing the original admitted. The instrumented enumeration shows each of those values… |
| 348 | OptionalChaining | `cfg.triggers` | equivalent | Instrumented the `for (const [envName, cfg] of scopes)` loop and logged every cfg over the fixtures: 17 iterations, all `typeof cfg === "object"` and none null. The root scope is the tree, already pr… |
| 357 | ConditionalExpression | `true` | hole | Forcing the length test to `true` makes an EMPTY `queues.consumers` array derive a consumer. Measured on `{"main": "src/i.ts", "triggers": {"crons": "0 0 * * *"}, "queues": {"consumers": []}}`: the d… |
| 357 | EqualityOperator | `cfg.queues.consumers.length >= 0` | hole | `>= 0` is true for an empty array, so the same fixture with `"queues": {"consumers": []}` flips from the note "no schedule or queue consumer declared" to a background-work binding declared `queues.co… |
| 357 | OptionalChaining | `cfg.queues` | equivalent | Same instrumented measurement: cfg is a non-null object on all 17 scope iterations observed, so `cfg.queues` cannot throw where `cfg?.queues` was needed. Derivations byte-identical over 29 projects, … |
| 361 | ConditionalExpression | `true` | hole | `bindings.some((b) => true)` asks whether ANY manifest has bound something, not whether THIS one did, and `bindings` accumulates across manifests. Measured on a project holding `wrangler.a.toml` (dec… |
| 362 | StringLiteral | `""` | hole | Applied on dist line 362 (the JSON branch) — line 317, the TOML twin, is killed by 5 unit tests and is therefore not this survivor. Measured on three fixtures (a bare wrangler.json, one whose crons i… |

### readToml — 25 survivor(s): 23 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 136 | StringLiteral | `"Stryker was here!"` | hole | Applied to dist and called directly: readToml(`x = "a\`) stores `"a\` at HEAD and `"a\Stryker was here!` mutated, because the ?? only fires when a backslash is the last character of the line. Through… |
| 154 | MethodExpression | `stripped` | hole | Dropping the trim leaves the CR of a CRLF manifest and the BOM of a UTF-8-BOM manifest attached to the line. Measured through deriveCloudflareWorkers: both fixtures fall from two bindings to zero and… |
| 155 | ConditionalExpression | `false` | equivalent | `!line` is true only for the empty string, and the three matchers below it (`\[\[`, `\[`, `[A-Za-z0-9._"'-]+`) each require at least one character, so an empty line falls through to the same continue… |
| 157 | Regex | `/\[\[\s*([^\]]+?)\s*\]\]$/` | hole | Without the `^` anchor a nested-array VALUE is read as an array-of-tables header. Measured: `matrix = [["a"]]` written before `main` moves `main` out of the root table and the Derivation drops from t… |
| 157 | Regex | `/^\[\[\s*([^\]]+?)\s*\]\]/` | hole | Without the `$` anchor, `[[queues.consumers]] and a note` is accepted as a header. Measured: HEAD derives nothing and reports `no schedule or queue consumer declared`, while the mutant emits a backgr… |
| 159 | MethodExpression | `arrHead[1]` | hole | trim() is not redundant: on `[[ ]]` the lazy group captures a single space. Measured through deriveCloudflareWorkers, the table name becomes ` ` instead of ``, the `main` that follows leaves the root… |
| 163 | Regex | `/^\[\s*([^\]]+?)\s*\]/` | hole | Without the `$` anchor, `[triggers] and a note` is accepted as a triggers header. Measured: HEAD derives nothing (the crons key stays in the root table) while the mutant emits scheduled-work and back… |
| 165 | MethodExpression | `head[1]` | hole | Same shape as the array-header case: on `[ ]` the lazy group captures a single space, so trim() carries meaning. Measured, the following `main` is stored under table ` ` instead of the root and the D… |
| 168 | Regex | `/([A-Za-z0-9._"'-]+)\s*=\s*(.*)$/` | hole | Without `^` the key match floats anywhere in the line. Measured through deriveCloudflareWorkers: `"my main" = "src/index.ts"` is read as key `main` (HEAD reads nothing), and a `} crons = [...]` line … |
| 168 | Regex | `/^([A-Za-z0-9._"'-]+)\s*=\s*(.*)/` | hole | `$` is load-bearing when the line carries a lone CR, which `.` cannot cross. Measured on a wrangler.toml with CR-only line endings: HEAD matches nothing and reports `no root main`, the mutant reads `… |
| 168 | Regex | `/^([A-Za-z0-9._"'-]+)\s=\s*(.*)$/` | hole | `\s` instead of `\s*` demands exactly one whitespace before `=`. Measured: `main="src/index.ts"` (wrangler's own compact style) and column-aligned `main = "src/index.ts"` both fall from two bindings … |
| 168 | Regex | `/^([A-Za-z0-9._"'-]+)\s*=\s(.*)$/` | hole | `\s` instead of `\s*` after `=` demands a space compact TOML does not write. Measured: `main="src/index.ts"` / `crons=["0 3 * * *"]` goes from two bindings at HEAD to zero bindings plus a `no root ma… |
| 171 | StringLiteral | `"Stryker was here!"` | hole | Quotes in a key are replaced by the literal instead of removed. Measured: `"main" = "src/index.ts"` yields key `Stryker was here!mainStryker was here!` and the Derivation drops from two bindings to z… |
| 174 | Regex | `/\{/` | hole | Dropping `^` makes a brace ANYWHERE in a value read as an inline table. Measured: `main = "src/{env}/index.ts"` and a sibling `desc = "uses {curly} braces"` both flip the manifest from `read` with tw… |
| 175 | StringLiteral | `""` | hole | The dot that separates table from key in the `unread` detail. Measured: an inline table under `[env.dev]` is reported as `inline table on \`env.devvars\`` instead of `\`env.dev.vars\`` — a key that a… |
| 175 | StringLiteral | `"Stryker was here!"` | hole | The empty else-branch of the same ternary. Measured: a root-level inline table is reported as `inline table on \`Stryker was here!vars\`` instead of `\`vars\``, in the same note that `rules --for --j… |
| 179 | MethodExpression | `value.endsWith("[")` | hole | endsWith instead of startsWith. Measured twice: `crons = ["0 3 * * *",` continued on the next line records evidence line 3 instead of 4, and a value that merely ENDS on `[` opens a continuation that … |
| 180 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The line is guarded by `value.startsWith("[")`, so `value.match(/\[/g)` always returns at least one match and the `\|\| []` fallback is unreachable. Measured: exhaustive enumeration of 16 105 TOML inpu… |
| 183 | MethodExpression | `next.split("#")[0]` | hole | Dropping the trim keeps each continuation line's indentation inside the value. Measured on the same multi-line `main`: HEAD resolves `[ "a" ]`, the mutant `[ "a" ]`, and the two crafted projects swap… |
| 183 | StringLiteral | `""` | hole | Continuation lines are joined without the separating space. Measured through deriveCloudflareWorkers on a multi-line array under `main`: HEAD resolves the entry as `[ "a" ]` and the mutant as `["a"]`… |
| 184 | ArithmeticOperator | `(next.match(/\[/g) \|\| []).length + (next.ma…` | hole | `+` counts closing brackets as openings, so the continuation never balances. Measured on the same multi-line cron array through deriveCloudflareWorkers: the evidence line published in via.line moves … |
| 184 | ArrayDeclaration | `["Stryker was here"]` | hole | `next.match(/\[/g) \|\| ["Stryker was here"]` gives every bracket-free continuation line a phantom opening bracket, so the array never balances. Measured: the multi-line cron array runs to EOF and the … |
| 184 | AssignmentOperator | `depth -= (next.match(/\[/g) \|\| []).length -…` | hole | `depth -=` inverts the balance, so the array continuation never closes and runs to end of file. Measured on an ordinary multi-line cron array: the recorded evidence line moves from 6 to 8 and the loo… |
| 189 | MethodExpression | `value` | hole | Storing the raw value keeps the trailing space the continuation loop appends when it stops at end of file. Measured: an unterminated `main = [` array stores `[ "a" ` instead of `[ "a"`, which changes… |
| 190 | ArithmeticOperator | `n - 1` | hole | Off-by-two on every recorded line. Measured: 16 of the 35 corpus derivations change — a plain `[triggers]` / `crons` manifest reports evidence line 2 for a cron written on line 4 — and via.line is pu… |

### deriveCloudflareWorkers — 14 survivor(s): 12 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 220 | MethodExpression | `readdirSync(projectRoot).filter(f => WRANGL…` | hole | Without `.sort()` the manifest read order, hence the order of `derivation.notes`, follows the filesystem. Measured with `fs.readdirSync` patched to return reverse order before the ESM binding: baseli… |
| 222 | BlockStatement | `{}` | hole | With an empty catch, `found` stays undefined and `found.length` throws. Measured on a real mission root chmod 0111 (readable child, unreadable directory): baseline returns the `absent`/"project root … |
| 223 | ArrayDeclaration | `["Stryker was here"]` | hole | A phantom binding is injected on an unreadable root. Measured on the chmod 0111 mission through `rules --for --json`: `derivation.bindings` goes from 0 to 1 and `categoriesResolved` from `[]` to `[nu… |
| 223 | ArrayDeclaration | `[]` | hole | The refusal note is dropped: an unreadable root returns `{bindings: [], notes: []}`. Measured on the chmod 0111 mission: `derivation.notes` goes from the `absent` note to `[]`, so "I could not read i… |
| 223 | ObjectLiteral | `{}` | hole | Returning `{}` gives deriveCloudflareWorkers no bindings/notes arrays. Measured on the same chmod 0111 mission: `deriveCloudflareWorkers` returns `{}` and `deriveAll` throws `d.bindings is not iterab… |
| 223 | ObjectLiteral | `{}` | hole | The note becomes `{}`. Measured on the chmod 0111 mission through `rules --for --json`: `derivation.notes[0]` loses `adapter`, `file`, `outcome` and `detail`; the human line renders `undefined · — · … |
| 223 | StringLiteral | `""` | hole | The note's `outcome` becomes `""`. Measured on the chmod 0111 mission: `derivation.notes[0].outcome` goes from `"absent"` to `""` in the JSON, and the human line reads `cloudflare-workers · — · : pro… |
| 223 | StringLiteral | `""` | hole | The note's `detail` becomes `""`. Measured on the chmod 0111 mission: `derivation.notes[0].detail` goes from "project root is not readable" to `""`, and the human line reads `cloudflare-workers · — ·… |
| 241 | ConditionalExpression | `true` | equivalent | When `contested` is empty the guarded block is a no-op: `filter(b => !contested.includes(b.path))` is the identity and the `for (const p of contested)` body never runs. Measured: with `if (true)` the… |
| 242 | ArrowFunction | `() => undefined` | hole | `filter(() => undefined)` drops EVERY binding as soon as one entry is contested, not just the contested one. Measured on a 3-manifest project where two manifests contest `src/a.ts` and a third owns `… |
| 244 | ArrayDeclaration | `[]` | hole | The ambiguous note's `file` becomes `""`. Measured through `runward rules --for --json` on a real mission: `derivation.notes[0].file` goes from `"wrangler.alpha.jsonc, wrangler.jsonc, wrangler.mcp.js… |
| 244 | MethodExpression | `[...byEntry.get(p)]` | equivalent | The Set is filled by iterating `all.bindings`, which are pushed file by file in `found` order, and `found` is already `.sort()`ed, so the spread is monotone and `.sort()` is a no-op. Measured: the am… |
| 244 | StringLiteral | `""` | hole | The separator disappears from the note's `file` field. Measured through `rules --for --json`: `"wrangler.alpha.jsonc, wrangler.jsonc, wrangler.mcp.jsonc"` becomes `"wrangler.alpha.jsoncwrangler.jsonc… |
| 245 | StringLiteral | `ˋˋ` | hole | The ambiguous note's `detail` becomes empty. Measured through `rules --for --json` on the contested mission: `detail` goes from "more than one manifest declares `src/index.ts` as its entry and no doc… |

### stripJsonc — 8 survivor(s): 2 hole · 6 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 41 | StringLiteral | `"Stryker was here!"` | equivalent | The ?? fires only when the manifest's last byte is a backslash inside a string, which leaves that string unterminated, so JSON.parse throws in both versions and the outcome is `unread` either way. Me… |
| 58 | EqualityOperator | `i <= text.length` | equivalent | `i <= text.length` only lets the line-comment scan step one index past the end, where text[i] is undefined (never a newline) and the outer `while (i < text.length)` exits identically. Measured: 111 1… |
| 63 | AssignmentOperator | `i -= 2` | hole | `i -= 2` scans for the closing `*/` from two characters BEFORE the opener instead of after it, so an opener of the form `/*/` closes on its own second and third characters. Measured: `{"main":"src/in… |
| 64 | ConditionalExpression | `true` | hole | Forcing the bound to `true` makes the block-comment scan never terminate on an unterminated comment. Measured: stripJsonc("/*") and a wrangler.jsonc truncated mid comment both hang (killed at 6 s), w… |
| 64 | EqualityOperator | `i <= text.length` | equivalent | At `i === text.length` the added iteration tests `text[i] === "*"` on undefined, which is false, so the scan stops one index later and the following `i += 2` lands past the end in both versions. Meas… |
| 79 | StringLiteral | `"Stryker was here!"` | equivalent | Second-pass twin of the first-pass escape: it fires only when the last character of the comment-stripped text is a backslash inside a string, which leaves the document unparseable either way. Measure… |
| 97 | ConditionalExpression | `true` | equivalent | `/\s/.test(undefined)` is false, so the whitespace skip stops at the end of `out` with or without the bound, and `out[k] === "}"` is false past the end. Measured: 111 111 exhaustively enumerated docu… |
| 97 | EqualityOperator | `k <= out.length` | equivalent | Same boundary with `<=`: the one extra index holds undefined, which is not whitespace, so the loop exits at the same k. Measured: 111 111 exhaustively enumerated documents byte-identical, ten crafted… |

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

### tomlStringList — 4 survivor(s): 2 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 197 | ArrowFunction | `() => undefined` | equivalent | The mapped VALUES are never read: tomlStringList has exactly one call site (dist/lib/territory.js:300) which uses only `crons === null` and `crons.length`, and `.map` preserves length. Measured: five… |
| 197 | LogicalOperator | `m[1] && m[2]` | equivalent | `m[1] && m[2]` changes each element's value but not the array's length, and the single call site reads only null-ness and length. Measured: the same five crafted cron fixtures and 1 200 fuzzed manife… |
| 197 | Regex | `/"([^"]*)"\|'([^'])'/g` | hole | `'([^']*)'` -> `'([^'])'` matches only ONE-character single-quoted literals. Measured: `crons = ['0 3 * * *']` yields an empty list, so the mutant reports `\`triggers.crons\` is an empty array — a de… |
| 197 | Regex | `/"([^"]*)"\|'([']*)'/g` | hole | `'([']*)'` matches only runs of quote characters, so no ordinary single-quoted string matches. Measured on the same manifest: the cron list comes back empty and the mutant declares an absence of sche… |

### WRANGLER_PATTERN — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 205 | Regex | `/wrangler(\..+)?\.(jsonc\|json\|toml)$/` | hole | Dropping the `^` makes any filename ENDING in a wrangler manifest name a manifest. Measured on a project holding `my-wrangler.toml` and `notwrangler.json` beside the real manifests: the mutant read b… |
| 205 | Regex | `/^wrangler(\..+)?\.(jsonc\|json\|toml)/` | hole | Dropping the `$` makes any filename STARTING with a manifest name a manifest. Measured on the same project: `wrangler.toml.bak` and `wrangler.tomlish` were both picked up, parsed as JSON (neither end… |

## Module: sarif

Survivors: 75

Holes: 58 · Equivalent: 3 · Display-only: 0 · Defence-in-depth: 14

### buildSarif — 66 survivor(s): 51 hole · 3 equivalent · 12 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 49 | ArrayDeclaration | `["Stryker was here"]` | equivalent | The `??` branch IS taken (horizon is null in 11 of 12 captured verdicts), but the injected literal yields `new Set([undefined])`, and all 156 deliverables across the fixtures carry a non-empty string… |
| 64 | StringLiteral | `""` | hole | Measured: every non-deferred deliverable finding ships `level: ""`, which is outside the SARIF enum — I validated the emitted documents against the vendored OASIS schema and red, ph, raw and nomanife… |
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
| 69 | ObjectLiteral | `{}` | hole | Measured: `region` becomes `{}` on every deliverable finding, and I validated the emitted documents against the vendored OASIS schema — red, partial, ph, raw and nomanifest come back INVALID (`region… |
| 75 | ConditionalExpression | `true` | hole | Forcing the find predicate true always returns the FIRST gated deliverable, so every strict violation is annotated on runward/architecture.md. Measured on the red and nomanifest missions: findings th… |
| 76 | StringLiteral | `""` | equivalent | The other `"runward"` on that line (the join prefix) is KILLED by the unit suite — I applied it and sarif-emit.test.js fails with `actual: 'architecture.md', expected: 'runward/architecture.md'` — so… |
| 78 | ConditionalExpression | `true` | hole | Forcing the guard true calls readFileSync on a manifest that does not exist. Measured on a mission whose runward/handover.md was deleted while its rules still produce violations: `check --strict --sa… |
| 78 | LogicalOperator | `abs \|\| existsSync(abs)` | hole | && -> \|\| makes a non-null path enough to read: same crash, measured on the same deleted-manifest mission — `ENOENT ... runward/handover.md`, exit 1, no SARIF emitted. sarif-shape.js stays green. |
| 78 | StringLiteral | `"Stryker was here!"` | equivalent | `content` is only used as `content ? ruleRowLine(content, v.rule) : 1`. The injected literal is truthy, and ruleRowLine("Stryker was here!", "hexa-architecture") returns 1 — I called it — which is ex… |
| 85 | ObjectLiteral | `{}` | defence-in-depth | Applied it: every strict violation loses message.text. `node test/sarif-shape.js` exits 1 on the broken-pointer fixture, both on the OASIS schema (`message must have required property 'text'`) and on… |
| 106 | ObjectLiteral | `{}` | defence-in-depth | Applied it: those same findings lose message.text. `node test/sarif-shape.js` exits 1 on the seal-drift fixture (schema `message must have required property 'text'` plus `every result carries a messa… |
| 106 | StringLiteral | `""` | defence-in-depth | Applied it: the seal/corpus/ADR/hook findings ship `level: ""`. `node test/sarif-shape.js` exits 1 on its seal-drift fixture — the OASIS level enum rejects it. |
| 107 | ArrayDeclaration | `[]` | hole | Measured: every seal, corpus, unratified-decision and hook finding ships `locations: []`, so it has no file to annotate — the finding exists but a forge cannot place it anywhere. The document stays s… |
| 107 | ObjectLiteral | `{}` | defence-in-depth | Applied it: the location element becomes `{}`. `node test/sarif-shape.js` exits 1 on the seal-drift fixture — `every location has a uri`. |
| 107 | ObjectLiteral | `{}` | defence-in-depth | Applied it: physicalLocation becomes `{}`. `node test/sarif-shape.js` exits 1 — the OASIS schema requires `artifactLocation` (or `address`) on a physicalLocation. |
| 107 | ObjectLiteral | `{}` | defence-in-depth | Applied it: artifactLocation becomes `{}`, dropping the uri. `node test/sarif-shape.js` exits 1 on the seal-drift fixture — `every location has a uri`. |
| 107 | ObjectLiteral | `{}` | defence-in-depth | Applied it: region becomes `{}`. `node test/sarif-shape.js` exits 1 — the OASIS schema requires `startLine` (or `charOffset`) on a region. |
| 111 | StringLiteral | `""` | defence-in-depth | Applied it: the evidence-seal finding's uri becomes "". `node test/sarif-shape.js` exits 1 on its seal-drift fixture — `every location has a uri`. |
| 111 | StringLiteral | `ˋˋ` | defence-in-depth | Applied it: the evidence-seal finding's message becomes "" (baseline text names the file whose sealed evidence moved). `node test/sarif-shape.js` exits 1 on the seal-drift fixture — `every result car… |
| 114 | ConditionalExpression | `false` | hole | Forcing the branch false DELETES every corpus finding from the document: measured on the red mission, the three `runward/rule-corpus` results (missing, edited, extra rule files) and their rule declar… |
| 114 | StringLiteral | `""` | hole | Comparing corpus.status against "" is never true, and the `unrecorded` else-if does not fire either: measured on the red mission, the same three rule-corpus findings vanish from a document the gate e… |
| 116 | StringLiteral | `""` | hole | Measured on the red mission: the missing-rule finding ships with ruleId "", and a rule with `id: ""` and the title `Craft rule is not accounted for` is declared alongside it. The document stays schem… |
| 116 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the finding for the deleted config-typing-zod.md ships uri "" instead of `runward/rules/config-typing-zod.md` — no file to annotate. sarif-shape.js stays green. |
| 116 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the message drops from `config-typing-zod.md — a rule runward wrote is gone from runward/rules/` to "", so a deleted rule is reported without naming the rule. |
| 118 | StringLiteral | `""` | hole | Measured on the red mission (hexa-architecture.md edited after runward wrote it): the finding ships with ruleId "" and a nameless declared rule. Schema-valid, sarif-shape.js green. |
| 118 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the edited-rule finding's uri drops from `runward/rules/hexa-architecture.md` to "". |
| 118 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the message drops from `hexa-architecture.md — edited since runward wrote it; impact, phases or signature may no longer be the shipped ones` to "". |
| 120 | StringLiteral | `""` | hole | Measured on the red mission (zz-invented-rule.md, CRITICAL and mapped to a gated phase): the finding ships with ruleId "" and a nameless declared rule. Schema-valid, sarif-shape.js green. |
| 120 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the extra-rule finding's uri drops from `runward/rules/zz-invented-rule.md` to "". |
| 120 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: the message drops from `zz-invented-rule.md — a rule runward never wrote, declaring a gated phase at CRITICAL/HIGH` to "". |
| 122 | ConditionalExpression | `true` | hole | Forcing the else-if true fabricates a `runward/rule-corpus` error on a mission whose corpus status is `package` (no local rule copy — the safest configuration, which the gate deliberately never flags… |
| 123 | StringLiteral | `""` | hole | Measured on a mission with an unrecorded corpus: the finding's artifactLocation.uri becomes "" (confirmed through `check --strict --sarif`), so a forge has nothing to anchor the annotation on. sarif-… |
| 123 | StringLiteral | `""` | hole | Measured: the unrecorded-corpus finding ships with message.text = "" — an error the reviewer sees with no explanation of what is wrong. sarif-shape.js stays green because it has no unrecorded-corpus … |
| 126 | StringLiteral | `ˋˋ` | hole | Measured on a mission carrying DRAFT-0099-guess.md: the unratified-decision finding's uri drops from `runward/adr/DRAFT-0099-guess.md` to "". sarif-shape.js stays green (no unratified fixture). |
| 126 | StringLiteral | `ˋˋ` | hole | Measured: the unratified-decision finding's message drops from `DRAFT-0099-guess.md — DRAFT — reconstructed decision not yet ratified` to "" — the reviewer sees an error naming no ADR and no reason. |
| 129 | StringLiteral | `""` | hole | Measured with `check --strict --hooks --sarif` on a mission with a failing hook: the finding's uri drops from `runward/hooks.json` to "". Nothing else reddens. |
| 129 | StringLiteral | `ˋˋ` | hole | Measured with `--hooks`: the hook finding's message drops from `1 operator hook(s) failed; the gate cannot be crossed on a failing hook` to "" — an empty error in the pull request while the gate exit… |
| 139 | StringLiteral | `""` | defence-in-depth | Applied it: driver.informationUri becomes "" in every document. `node test/sarif-shape.js` exits 1 on all four fixtures — the OASIS schema rejects it on `format: "uri"`. |
| 140 | MethodExpression | `[...ruleIds]` | hole | Dropping the sort changes the rules array order: measured on the red mission the emitted order goes from alphabetical to Set-insertion order (hexa-architecture and zz-invented-rule jump ahead of the … |
| 142 | ConditionalExpression | `true` | hole | Forcing the ternary true titles EVERY craft rule `A gated deliverable is missing or unfilled`. Measured on the red mission: handover-agents-charter-final, handover-redone-task-proof, hexa-architectur… |
| 142 | ConditionalExpression | `false` | hole | Forcing it false titles the deliverable rule `Craft rule deliverable-not-filled is not accounted for`. Measured across the red, partial and raw missions; the schema net stays green. |
| 142 | EqualityOperator | `id !== "runward/deliverable-not-filled"` | hole | Inverting the equality swaps both titles: measured on the red mission, deliverable-not-filled gets the craft-rule wording and every craft rule gets `A gated deliverable is missing or unfilled`. Every… |
| 142 | MethodExpression | `id` | hole | Measured: titles become `Craft rule runward/handover-agents-charter-final is not accounted for` — the `runward/` namespace is no longer stripped, so every craft-rule headline in the document changes.… |
| 142 | ObjectLiteral | `{}` | defence-in-depth | Applied it: every rule loses its shortDescription.text. `node test/sarif-shape.js` exits 1 — the OASIS schema requires `text` on a multiformatMessageString (`/runs/0/tool/driver/rules/0/shortDescript… |
| 142 | StringLiteral | `""` | hole | Comparing against "" makes the condition always false, so the deliverable rule is titled `Craft rule deliverable-not-filled is not accounted for`. Measured on the red, partial and raw documents. |
| 142 | StringLiteral | `""` | hole | Measured: the deliverable rule's shortDescription.text becomes "" in every document that carries a deliverable gap (red, partial, ph, raw, nomanifest). The schema tolerates an empty string, so sarif-… |
| 142 | StringLiteral | `ˋˋ` | hole | Measured on the red mission: every craft rule's shortDescription.text becomes "" — nine rules with no title in one document. sarif-shape.js stays green. |
| 142 | StringLiteral | `""` | hole | slice("".length) is slice(0), i.e. no strip at all: measured, the same wrong titles as leaving the id whole (`Craft rule runward/handover-...`). Nothing catches it. |
| 144 | ObjectLiteral | `{}` | hole | Measured: `defaultConfiguration` becomes `{}` on every rule, so a consumer reading rule-level severity falls back to the SARIF default `warning` instead of `error`. The document stays schema-valid an… |
| 144 | StringLiteral | `""` | defence-in-depth | Applied it: `defaultConfiguration.level` becomes "". `node test/sarif-shape.js` exits 1 — the OASIS enum rejects it (`allowedValues ["none","note","warning","error"]`). |

### ruleRowLine — 6 survivor(s): 6 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 30 | ConditionalExpression | `false` | hole | Disabling the row guard makes ruleRowLine match a prose line that merely ILLUSTRATES the row format. Measured on a mission carrying `Format reminder: each row reads \| hexa-architecture \| applied \| ..… |
| 30 | MethodExpression | `l.trim().endsWith("\|")` | hole | startsWith->endsWith drops every row written WITHOUT its closing pipe — a GFM form readManifest explicitly accepts (`t.endsWith("\|") ? slice(1,-1) : slice(1)`). Measured on a mission whose broken `he… |
| 30 | MethodExpression | `l` | hole | Dropping .trim() skips indented rows, which parseManifest reads (it trims before testing the leading pipe). Measured on a mission with a 3-space-indented broken `hexa-architecture` row: startLine fal… |
| 30 | StringLiteral | `""` | hole | startsWith("") is always true, so the guard never skips anything — same effect as forcing it false. Measured on the prose-illustration mission: the annotation moves from startLine 42 to 35, the exact… |
| 32 | OptionalChaining | `l.split("\|").slice(1, -1)[0].replace` | hole | Removing the optional chaining throws on a bare `\|` line inside the manifest table (split yields an empty inner array). Measured: `node dist/cli.js check --strict --sarif` on such a mission dies with… |
| 32 | StringLiteral | `"Stryker was here!"` | hole | Replacing the backtick-strip with a literal breaks rows whose rule name is written as a code span — a form readManifest supports and callers use. Measured on a mission with `\| `hexa-architecture` \| a… |

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

## Module: mission

Survivors: 51

Holes: 24 · Equivalent: 17 · Display-only: 3 · Defence-in-depth: 7

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

### isRealAdr — 6 survivor(s): 5 hole · 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
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

### adrStatusLine — 3 survivor(s): 2 equivalent · 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 84 | MethodExpression | `text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)…` | display-only | Le seul écart atteignable est du blanc de fin dans une cellule. Sonde fonction : adrStatusLine('**Status**: accepted ') rend 'accepted ' au lieu de 'accepted' ; le cas CRLF ne diverge pas (mesuré : '… |
| 84 | OptionalChaining | `text.match(/^\*\*Status\*\*\s*:\s*(.+)$/mi)…` | equivalent | Le chaînage optionnel court-circuite la chaîne ENTIÈRE : dans text.match(...)?.[1].trim(), si match rend null, ?. saute aussi le .trim(), aucun TypeError (mesuré sur la forme mutée : 'no status here'… |
| 84 | Regex | `/^\*\*Status\*\*\s*:\s*(.+)/mi` | equivalent | $ après (.+) glouton est redondant : '.' exclut les terminateurs de ligne, donc le glouton s'étend exactement jusqu'à la fin de ligne, position où $ (multiline) réussit toujours ; jamais de backtrack… |

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

## Module: spec-conformance

Survivors: 39

Holes: 25 · Equivalent: 11 · Display-only: 3 · Defence-in-depth: 0

### specConformance — 16 survivor(s): 9 hole · 4 equivalent · 3 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 125 | ArrayDeclaration | `[]` | equivalent | Le fallback `?? [...]` est du code mort : head commence toujours par `#` (CRITERIA_HEADING ancrée), donc head.match(/^#+/) n'est jamais null et la branche droite du ?? n'est jamais évaluée ; `[]` (qu… |
| 125 | Regex | `/#+/` | equivalent | `head` sort de `heads`, filtré par CRITERIA_HEADING ancrée `^#{1,6}\\s` : head[0] est toujours `#`, donc le premier match de /#+/ est la run de tête à l'index 0, identique à /^#+/. MESURÉ : zéro diff… |
| 125 | StringLiteral | `""` | equivalent | Même fallback mort que m08 : la valeur `\"\"` (level 0) ne serait lue que si head.match(/^#+/) rendait null, impossible puisque toute tête vient de CRITERIA_HEADING ancrée sur `^#`. MESURÉ : zéro dif… |
| 131 | Regex | `/(#{1,6})\s/` | hole | Sans ^, tout `# ` en MILIEU d'une ligne de critère est lu comme un titre de niveau 1 et TERMINE la section : tout ce qui suit disparaît. RECETTE : section avec `- login works file:src/auth.ts#login` … |
| 134 | ConditionalExpression | `false` | hole | La déduplication saute : un `### More criteria` imbriqué sous `## Acceptance criteria` est à la fois DANS la section ## et une tête à part entière, ses items sont comptés deux fois. RECETTE : `## Acc… |
| 146 | ConditionalExpression | `true` | hole | Tout excerpt passe par slice(0,99)+… : 20 cas sur 28 diffèrent (chaque champ text du JSON gagne un … parasite), et une ligne de critère d'EXACTEMENT 100 caractères finissant par AC12 voit son id tron… |
| 146 | ConditionalExpression | `false` | hole | Plus aucune troncature : les ids situés au-delà du caractère 99 d'une longue ligne entrent dans declaredIds alors que le livré les perd. RECETTE : `## Criteria` / ligne de 113 chars finissant par AC1… |
| 146 | EqualityOperator | `t.length >= 100` | hole | Frontière : la ligne d'exactement 100 caractères bascule dans la troncature. RECETTE identique à m14 (ligne de 100 chars finissant AC12 + référence `see AC12`) ; spec-check --json. MESURÉ livré : tex… |
| 146 | EqualityOperator | `t.length <= 100` | hole | Troncature inversée : 22 cas sur 28 diffèrent. Les deux flips sont mesurés sur les mêmes recettes que m14/m15 : len100_id exit 0 -> 1 (declaredIds [AC12] -> [AC1], dangling fabriqué) ET len113_id exi… |
| 146 | MethodExpression | `t` | hole | La branche longue garde le texte entier (+…) : les ids au-delà du caractère 99 réintègrent declaredIds. RECETTE : fixture len113_id de m15 ; spec-check --json. MESURÉ livré : declaredIds [], dangling… |
| 146 | StringLiteral | `""` | display-only | Seul le MARQUEUR de troncature disparaît. MESURÉ sur les 28 cas : uniques diffs = len113_id et long_broken, où text fait 99 chars sans … au lieu de 100 avec … (même excerpt) ; exit, verdict, ok, reas… |
| 147 | ConditionalExpression | `true` | equivalent | Le prédicat devient `true && !!p.path` : garde exactement les pointeurs à path truthy. Or la grammaire n'émet que trois kinds (POINTER_PREFIX = /\\b(file\|test\|adr):/, evidence.js:28) et les objets ad… |
| 147 | LogicalOperator | `p.kind === "file" \|\| p.kind === "test" \|\| !…` | hole | Avec \|\|, un pointeur file/test SANS path passe le filtre (les adr: restent exclus car sans path ni kind file/test : pas de crash). RECETTE : section avec `- x file:#foo` ; spec-check --json. MESURÉ l… |
| 156 | StringLiteral | `""` | display-only | Le reason d'un critère VERT devient vide. MESURÉ sur les 28 cas : seuls les champs reason des lignes linked:true du JSON changent (\"linked\" -> \"\") ; exit, verdict, comptes, dangling, text, et tou… |
| 164 | ArithmeticOperator | `heads[0][0] - 1` | hole | Le finding de vacuité pointe 2 lignes trop haut (jusqu'à L-1 mesuré quand le titre est en ligne 1 : un numéro de ligne négatif dans le contrat JSON), et l'exclusion des lignes de déclaration du scan … |
| 164 | MethodExpression | `lines[heads[0][0]]` | display-only | L'écho du titre dans le finding de vacuité garde ses blancs de fin. MESURÉ sur les 28 cas : unique diff = vacuity_trailing, text `## Acceptance criteria ` au lieu de `## Acceptance criteria` ; exit, … |

### specBundleConformance — 11 survivor(s): 9 hole · 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 201 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Doublement mort. (1) Le repli `?? []` est inatteignable : `per.find` ne rate jamais (per = map du même tableau files), prouvé par le contrôle C1 (prédicat forcé à false → crash TypeError sous mutant … |
| 201 | ArrowFunction | `() => undefined` | hole | `find` ne trouve plus rien → `?.`→undefined → `?? []` → declaredLines vide : même effondrement que le mutant 1, les lignes de déclaration sont relues comme références. MESURÉ sur la recette caseE (cr… |
| 201 | ArrowFunction | `() => undefined` | hole | declaredLines devient Set{undefined} : `has(i+1)` (un nombre) n'est plus jamais vrai — même effondrement de l'exclusion. MESURÉ (caseE) : exit 0→1, dangling []→[{spec.md:3,REQ-77}] par la fonction ET… |
| 201 | ConditionalExpression | `false` | hole | Identique au mutant 3 par un autre chemin : `find` échoue toujours → declaredLines vide. MESURÉ (caseE, même recette : spec avec critère >100 car. portant REQ-77 après la troncature, artefact code/ro… |
| 201 | LogicalOperator | `per.find(p => p.path === f.path)?.criteria.…` | hole | Le .map() renvoie toujours un tableau (truthy), donc `a && []` vide TOUJOURS declaredLines : les lignes qui DÉCLARENT un critère sont relues comme références. RECETTE (caseE) : bundle specs/spec.md, … |
| 201 | OptionalChaining | `per.find(p => p.path === f.path).criteria` | equivalent | `per` est construit par `files.map(...)` sur le MÊME tableau `files` itéré ensuite : pour chaque f il existe p avec p.path===f.path, `find` ne renvoie jamais undefined, la garde `?.` est du code mort… |
| 203 | ArithmeticOperator | `i - 1` | hole | L'exclusion glisse de deux lignes : la ligne située DEUX lignes sous un critère est exclue du scan, et la ligne de critère elle-même ne l'est plus. DOUBLE effet mesuré. FAUX VERT (caseF) : spec.md av… |
| 203 | ConditionalExpression | `false` | hole | La garde d'exclusion des lignes de déclaration devient inerte : mêmes effets que le mutant 1. MESURÉ (caseE : critère de 112 car. avec REQ-77 en position 106, pointeur vert vers code/router.ts livré,… |
| 207 | ConditionalExpression | `true` | hole | La dédup ignore le fichier : même ligne + même id suffit, à travers les fichiers. RECETTE (caseD) : bundle spec.md (AC1 lié, artefact code/router.ts livré) + plan.md l.3 `do AC7` + tasks.md l.3 `do A… |
| 207 | ConditionalExpression | `true` | hole | La dédup ignore l'id : même fichier + même ligne suffit — le SECOND identifiant pendant d'une même ligne est avalé. RECETTE (caseC) : tasks.md l.3 `do AC7 then FR9` (deux ids déclarés nulle part) dan… |
| 217 | MethodExpression | `[...declared]` | hole | `declaredIds` sort en ordre d'insertion au lieu de l'ordre trié dans le JSON machine de spec-check (champ du contrat ADR-0056, consommé tel quel — pas un texte d'affichage). RECETTE (caseG) : spec.md… |

### pointerLinks — 10 survivor(s): 5 hole · 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 32 | ConditionalExpression | `false` | equivalent | Branche morte dans CE module : `malformed` n'a qu'un site d'affectation (evidence.js:125, bras adr:) et specConformance filtre sur kind file/test + !!p.path avant d'appeler pointerLinks, fonction pri… |
| 33 | BooleanLiteral | `true` | equivalent | Branche morte (voir mutants 1-2 : unique site d'affectation de malformed = bras adr:, filtré avant pointerLinks ; fuzz 25 formes = 0 ; CLI inchangé partout). Contrôle de sensibilité mesuré : appel di… |
| 33 | ObjectLiteral | `{}` | equivalent | Même branche morte que le mutant précédent (malformed jamais posé sur un pointeur file:/test: — fuzz mesuré à 0 sur 25 formes, CLI inchangé sur tous les scénarios). Contrôle de sensibilité : l'appel … |
| 33 | StringLiteral | `ˋˋ` | equivalent | Branche morte (mêmes preuves que mutants 1-3 : fuzz 0/25, CLI inchangé sur les 20 scénarios). Contrôle de sensibilité mesuré : appel direct forcé — reason 'file:x — synthetic-malformed' devient '' : … |
| 37 | ConditionalExpression | `false` | hole | RECETTE : spec `- AC1 -> file:./` (pointeur sur la racine même), `runward spec-check s.md -p . --json`. Avant : exit 1, reason 'file:./ — points outside the project tree' ; après : exit 1 mais reason… |
| 37 | StringLiteral | `"Stryker was here!"` | hole | Effet identique au mutant 5 (rel ne vaut jamais 'Stryker was here!', donc le bras rel === '' est neutralisé). Mesuré : `file:./` passe de 'points outside the project tree' à 'not a file' (exit 1 cons… |
| 50 | ConditionalExpression | `true` | equivalent | Sémantique JS : quand p.line est undefined, `content.split('\n').length < undefined` vaut NaN-comparaison = false — le && décide identiquement avec la garde forcée à true. Mesuré : 0 diff sur les 20 … |
| 53 | MethodExpression | `p.symbol` | hole | INVERSION DE VERDICT sur symbole quoté rembourré d'espaces. RECETTE : spec `- AC1 -> file:code/short.ts#" x"` (symbole ' x', 2 caractères dont un blanc, trim -> 1), artefact 'const x = 1;', spec-chec… |
| 108 | ObjectLiteral | `{}` | hole | Classe reason. RECETTE : `- AC3 test:code/app.test.js::doesNotExist` sur source non-JUnit. Mesuré : unlinked et exit 1 conservés (`{}` falsy-ok dans le filter), reason passe de « test named "doesNotE… |
| 108 | StringLiteral | `ˋˋ` | hole | Classe reason. Même recette et même mesure que M28 : rouge conservé, reason `""` — l'opérateur voit « unlinked » sans savoir que c'est le NOM du test qui manque dans le fichier (remédiation : corrige… |

### CRITERIA_HEADING — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 21 | Regex | `/#{1,6}\s.*\b(acceptance\|criteria)\b/i` | hole | Sans l'ancre ^, une ligne de prose contenant `# ` + le mot acceptance devient un titre de section. RECETTE : spec sans aucune section de critères (`# Spec` / prose `see the # acceptance notes below` … |

### LIST_ITEM — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 22 | Regex | `/(?:[-*]\s\|\d+\.\s)/` | hole | Sans ^, LIST_ITEM matche un superset : toute prose de section contenant `- ` en milieu de ligne devient un critère sans pointeur. RECETTE : section avec `- login works file:src/auth.ts#login` + prose… |

## Module: tool-adapters

Survivors: 27

Holes: 16 · Equivalent: 11 · Display-only: 0 · Defence-in-depth: 0

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

### lcovFileResult — 2 survivor(s): 2 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 158 | MethodExpression | `line.slice(3)` | equivalent | Number() already applies StrWhiteSpace trimming, the same character set String.prototype.trim removes, so Number(x.trim()) and Number(x) coincide for every string. Measured: 1331 combinations of 11 w… |
| 162 | MethodExpression | `line` | equivalent | The branch is only reachable for lines starting with "DA:", and "DA:" contains no comma, so it lies entirely inside split element [0] and element [1] is byte-identical with or without the slice. Meas… |

## Module: scaffold-lock

Survivors: 24

Holes: 14 · Equivalent: 10 · Display-only: 0 · Defence-in-depth: 0

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

### readScaffoldLock — 6 survivor(s): 3 hole · 3 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 34 | ConditionalExpression | `false` | equivalent | Removing the existsSync early return just routes an absent lock through readFileSync's ENOENT, which the surrounding try/catch already converts to the same `null`. Measured: byte-identical output acr… |
| 37 | StringLiteral | `""` | equivalent | readFileSync with encoding "" returns a Buffer instead of a string, and JSON.parse coerces it through toString() to the same utf8 text. Measured: identical parse of a lock containing non-ASCII (writt… |
| 41 | ConditionalExpression | `true` | equivalent | Reachable only through JSON.parse output, where no non-object value (string, number, boolean, array element, null) carries string `name` and `version` properties, so the typeof check can never be wha… |
| 41 | LogicalOperator | `j.corpus \|\| typeof j.corpus === "object"` | hole | `&&` to `\|\|` accepts any truthy corpus value and, worse, makes a lock containing "corpus": null throw on j.corpus.name into the outer catch so the WHOLE lock reads as absent. Measured on the CLI: tha… |
| 42 | ConditionalExpression | `true` | hole | A numeric corpus.name is accepted as a valid pin. Measured on the CLI with a lock pinned {name: 7, version: "1.0.0"} beside a runward/rules/corpus.json of {name: "acme", version: "1.0.0"}: corpusDrif… |
| 42 | ConditionalExpression | `true` | hole | A numeric corpus.version is accepted as a valid pin. Measured on the CLI with a lock pinned {name: "acme", version: 7} beside a corpus.json of {name: "acme", version: "1.0.0"}: corpusDrift goes from … |

### hashText — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 25 | StringLiteral | `""` | equivalent | Node falls back to the default (utf8) for an unrecognised encoding string on Hash.update. Measured directly: sha256 digests are identical for "" and "utf8" on 6 inputs including accents, emoji and la… |

## Module: verdict

Survivors: 21

Holes: 9 · Equivalent: 10 · Display-only: 0 · Defence-in-depth: 2

### computeVerdict — 11 survivor(s): 6 hole · 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 154 | ConditionalExpression | `true` | equivalent | Invariant : throughIndex === -1 n'existe QUE si opts.through est non-nul (through nul/undefined donne throughIndex null, pas -1) — le conjoint supprimé est impliqué par l'autre. Mesuré : 0 delta sur … |
| 155 | StringLiteral | `""` | hole | La remédiation du fail-loud devient illisible. Mesuré sur le vrai CLI : `runward verify` sur une attestation dont predicate.through='bogus' (octets non signés, modifiables par construction) : livré «… |
| 182 | ArithmeticOperator | `corpus.missing.length + corpus.edited.lengt…` | hole | Même classe : mesuré sur extra-seul « 1 rule-corpus divergence(s) » → « -1 » (et edited+extra faussé), exit/JSON inchangés. Même absence de cas corpus dans le test des sommes, et le résumé — la phras… |
| 182 | ArithmeticOperator | `corpus.missing.length - corpus.edited.length` | hole | Le pire de la classe : sur edited+extra le compte fait 0 et les divergences DISPARAISSENT du résumé — livré « ! 1 rule-conformance gap(s) · 2 rule-corpus divergence(s) » → muté « ! 1 rule-conformance… |
| 182 | AssignmentOperator | `strictBreakdown.corpus -= corpus.missing.le…` | hole | Le compte de remédiation du résumé s'inverse : mesuré sur règle éditée : « ! 1 rule-corpus divergence(s) » → « ! -1 rule-corpus divergence(s) » (aussi sur extra et edited+extra). Exit et payload inta… |
| 198 | AssignmentOperator | `strictBreakdown.corpus -= 1` | hole | Lock supprimé : strictGaps monte bien (+1, exit 1 conservé) mais le résumé imprime « -1 rule-corpus divergence(s) » au lieu de « 1 » — mesuré sur la fixture nolock, seul delta de la batterie. Le test… |
| 207 | ConditionalExpression | `true` | equivalent | Invariant : tout producteur de present:false porte violations:[] — verifyEvidenceLock (fichier absent) et le placeholder --freeze — donc le += ajouté vaut toujours 0. Mesuré : 0 delta sur 39 sondes, … |
| 213 | AssignmentOperator | `strictBreakdown.unratified -= unratified.le…` | hole | ADR draft : exit 1 conservé (strictGaps intact) mais le résumé imprime « -1 unratified decision(s) » au lieu de « 1 » — mesuré sur la fixture draftadr, seul delta. Le test des sommes ne couvre pas la… |
| 219 | ConditionalExpression | `true` | equivalent | true && throughIndex!==null ≡ throughIndex!==null, équivalent par la même corrélation (le conjoint gauche est impliqué par le droit après le throw). Mesuré 0 delta sur 39 sondes ; sensibilité prouvée… |
| 219 | ConditionalExpression | `true` | equivalent | opts.through!=null && true ≡ opts.through!=null, équivalent par la corrélation inverse (le conjoint droit est impliqué par le gauche : un through valide donne toujours un ordinal). Mesuré 0 delta sur… |
| 219 | LogicalOperator | `opts.through != null \|\| throughIndex !== nu…` | equivalent | À cette ligne les deux conjoints sont parfaitement corrélés : through nul ⇒ throughIndex null ; through non-nul ⇒ throughIndex ≥ 0 (le -1 est éliminé par le throw fail-loud en amont) — && et \|\| calcu… |

### judgeGated — 7 survivor(s): 5 equivalent · 2 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 116 | BlockStatement | `{}` | equivalent | Corps de la branche morte : la condition (inchangée) ne s'exécute jamais — voir l'argument EXPECTED_MAPPED du mutant « -> false » ; le fall-through vers checked++ n'est atteignable dans aucun état co… |
| 116 | ConditionalExpression | `false` | equivalent | Branche morte : EXPECTED_MAPPED (dist/lib/constants.js, propriété du paquet, hors d'atteinte de la mission) épingle les cinq phases gated à 6/4/10/12/4, donc expected.length===0 entraîne toujours la … |
| 116 | ConditionalExpression | `true` | defence-in-depth | Le skip avale la violation (mapping) dès que expected est vide. Mesuré : corpus livré vendorisé via `runward update --corpus` avec govern retiré de tous les phases: → livré exit 1 « only 0 CRITICAL/H… |
| 116 | EqualityOperator | `violations.length !== 0` | defence-in-depth | La condition devient « expected vide ET violations présentes » — exactement l'état que le commentaire interdit de sauter. Même faux vert mesuré : strippedgov exit 1 → 0 (json et texte). JAMBE NOMMÉE … |
| 117 | ArrayDeclaration | `["Stryker was here"]` | equivalent | Littéral dans la branche morte, jamais évalué en pratique (le push est inatteignable : EXPECTED_MAPPED force la violation (mapping) quand expected est vide). Mesuré 0 delta sur 39 sondes ; skipped==0… |
| 117 | BooleanLiteral | `false` | equivalent | Même branche morte, même démonstration (EXPECTED_MAPPED + 0 delta mesuré + skipped==0 sur 16 fixtures) et même contrôle de sensibilité (mutant voisin détecté exit 1→0). Le drapeau ne peut être observ… |
| 117 | ObjectLiteral | `{}` | equivalent | Dans la branche morte : le push ne s'exécute jamais (démonstration EXPECTED_MAPPED + skipped==0 mesuré partout, 0 delta sur 39 sondes). Sensibilité : même contrôle que ci-dessus (le if voisin muté pr… |

### countGaps — 2 survivor(s): 2 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 85 | ConditionalExpression | `true` | hole | deferredGaps compte toutes les lignes différées, remplies incluses : mesuré mission verte + `--through frame --json` : gaps.deferred 0 → 11 sur un arc entièrement rempli (exit 0 les deux) — un CI lis… |
| 85 | StringLiteral | `""` | hole | state !== "" toujours vrai : comportement mesuré identique au précédent (gaps.deferred 0 → 11 sur verte --through frame, 5→5 sur mi-construction, exits inchangés). Même recette, même assertion manqua… |

### GATED_TO_PRESENCE — 1 survivor(s): 1 hole

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 40 | StringLiteral | `""` | hole | Même mécanique pour Floor : ordinal -1, jugé sous tout horizon. Mesuré : ligne config-secrets-boundary pointée sur un fichier inexistant + `--through frame` et `--through architect` : livré exit 0 → … |

## Module: territory-map

Survivors: 16

Holes: 5 · Equivalent: 11 · Display-only: 0 · Defence-in-depth: 0

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

### hashTree — 7 survivor(s): 7 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 54 | ArrowFunction | `() => undefined` | equivalent | Un comparateur qui rend undefined vaut 0 pour Array.sort (ToNumber -> NaN -> 0): tri stable no-op = ordre readdir = mutant 9. Même argument (canonicalisation re-trie, contenu indépendant de l'ordre) … |
| 54 | ConditionalExpression | `true` | equivalent | Comparateur incohérent = permutation arbitraire mais déterministe du parcours; le contenu de la map ne dépend pas de l'ordre et missionStateDigest re-trie les clés. Mesuré: octets identiques au livré… |
| 54 | ConditionalExpression | `false` | equivalent | Même classe que le mutant 11: seul l'ordre de parcours bouge, le contenu est identique, la canonicalisation re-trie. Mesuré: octets identiques au livré partout, digest et sensibilité inchangés. Contr… |
| 54 | EqualityOperator | `a.name <= b.name` | equivalent | Les noms d'un même répertoire sont uniques (readdir): le cas d'égalité n'existe même pas, le comparateur muté est pointwise identique au livré. Mesuré: octets identiques partout. Contrôle positif: 8/… |
| 54 | EqualityOperator | `a.name >= b.name` | equivalent | Parcours inversé: permutation pure, contenu de map identique, clés re-triées à la canonicalisation. Mesuré: octets identiques au livré sur M0 et les 9 arbres altérés, idempotent. Contrôle positif: 8/… |
| 54 | MethodExpression | `readdirSync(dir, { withFileTypes: true })` | equivalent | hashTree n'a qu'un consommateur, missionStateDigest, qui RE-TRIE toutes les clés à la canonicalisation; le contenu de la map est indépendant de l'ordre de parcours (clés rel uniques, pas de collision… |
| 54 | UnaryOperator | `+1` | equivalent | Identique en effet au mutant 12 (comparateur constant): ordre de parcours permuté, contenu inchangé, canonicalisation re-trie. Mesuré: octets identiques au livré partout, digest identique, sensibilit… |

### buildBundleStatement — 5 survivor(s): 5 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 38 | ConditionalExpression | `true` | equivalent | Comparateur devient a<b?-1:1: identique au livré sur noms distincts, ne diffère que sur les ex-aequo (1 au lieu de 0), inatteignables (dédoublonnage CLI). Mesuré: AUCUNE différence nulle part — y com… |
| 38 | ConditionalExpression | `false` | equivalent | Comparateur devient a<b?-1:0 ("inférieur/pas inférieur" seulement). Mesuré sur le vrai V8 du CLI: zéro divergence sur 720 permutations semées couvrant insertion binaire ET fusion TimSort (tailles 2,3… |
| 38 | EqualityOperator | `a.name <= b.name` | equivalent | Ne diffère que sur des subjects de MÊME nom (égalité -> -1 au lieu de 0, le tri stable réordonne les ex-aequo). Contrôle de sensibilité mesuré: la sonde fonction directe avec noms égaux/digests disti… |
| 38 | EqualityOperator | `a.name >= b.name` | equivalent | Sur noms distincts, >= égale >: pointwise identique au livré; seule l'égalité diffère (1 au lieu de 0), inatteignable (dédoublonnage CLI, noms readdir uniques). Mesuré: aucune différence, y compris l… |
| 38 | EqualityOperator | `a.name <= b.name` | equivalent | Sur noms distincts se réduit à a<b?-1:0 — même fonction que le mutant 4; ex-aequo -> 1, inatteignables. Mesuré: zéro divergence (720 permutations jusqu'à 512, bundles CLI 40/600, sonde noms égaux, oc… |

### RUNWARD_PREDICATE_TYPE — 1 survivor(s): 1 defence-in-depth

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 27 | StringLiteral | `""` | defence-in-depth | Jambe: intoto-schema — REJOUÉE, exit 1, deux asserts rouges: le schéma vendored (predicateType minLength 1 + format uri) et l'assert littéral === "https://runward.dev/verdict/v1". Les units survivent… |

## Module: rules

Survivors: 11

Holes: 7 · Equivalent: 4 · Display-only: 0 · Defence-in-depth: 0

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

## Module: check-contract

Survivors: 1

Holes: 0 · Equivalent: 0 · Display-only: 1 · Defence-in-depth: 0

### optionFault — 1 survivor(s): 1 display-only

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 52 | StringLiteral | `""` | display-only | Le seul cosmétique vrai du lot. Mesuré : exit 2 conservé, message '--json--sarif each write a different document... Run runward check once per document you need.' — les DEUX noms de drapeaux restent … |

## Module: paths

Survivors: 1

Holes: 0 · Equivalent: 1 · Display-only: 0 · Defence-in-depth: 0

### VERSION — 1 survivor(s): 1 equivalent

| Line | Mutator | Becomes | Filed as | Note |
| ---: | ------- | ------- | -------- | ---- |
| 17 | StringLiteral | `""` | equivalent | Measured on Node v24.18.0: readFileSync(package.json, "") returns a Buffer and JSON.parse coerces it identically, so VERSION is the same string "0.37.0"; JSON.stringify of both parses is byte-equal, … |
