# ADR-0114 — An identifier is read outside comments, and a strict green requires a row the gate verified

**Date**: 2026-11-05
**Status**: accepted (2026-11-05)
**Deciders**: an agent delegate, under class D of `runward/delegation.md`, on the maintainer's instruction
of 2026-11-05. Under ADR-0088 decision 4 the agent's writing is disclosed throughput, not independent
review; the pull request that carries this record changes pre-merge paths and waits for the maintainer
**Method**: both defects reproduced on a fresh clone of `stranxik/runward` at `main@8ffdf7c` (0.46.0)
before any change, each beside its control, then re-measured on the change. Read: `src/lib/evidence.ts`
(`symbolPresent` and its callers), `src/lib/conformance.ts` (`PATH_TOKEN`), `src/lib/verdict.ts`,
`src/lib/check-contract.ts`, `src/commands/check.ts`, `src/commands/verify.ts`, `docs/spec/witness.md`,
`runward/contracts/port-contract.md`, `action.yml`, ADR-0019, ADR-0051, ADR-0053, ADR-0060, ADR-0083
**Relates to**: [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) and
[ADR-0051](ADR-0051-the-gate-is-made-as-strong-as-its-headline.md) decision 1 (the symbol depth, refined
by decision 1 here), [ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md) (the vacuous green,
refined by decision 2: the refusal it described), [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)
and [ADR-0083](ADR-0083-exit-code-two-carries-several-meanings-say-which-before-splitting-it.md) (the exit
code contract, which gains 5), [ADR-0053](ADR-0053-the-construction-gate-certifies-a-declared-horizon.md)
(a prefix verdict), [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (nothing is executed),
RWD-2026-0194 in [known-defects.md](../compliance/known-defects.md)

## Context

**A comment kept a renamed symbol green (RWD-2026-0194).** The README's two-minute demo renames
`guardFields` to `validateFields` throughout `code/src`, and `check --strict` exits 1 on the two rows that
still cite `file:code/src/core/domain/guard.ts#guardFields`. Measured on 2026-11-05: append one line,
`// validateFields was called guardFields before the rename.`, and the same command exits 0, "all gates
passed", over a floor note and a threat model that cite a function that no longer exists; the same with a
`/* … */` comment. The check was the one ADR-0019 decided, "the symbol occurs in the file (deterministic
substring, language-neutral)", at the identifier boundary ADR-0051 added. A comment holds the name.

**Where runward resolves a symbol.** Three readers search a whole file: the gate (`evidenceReport`),
`spec-check` (`specConformance`) and the `rules --for` reminder (`citationsForPaths`). Two locators read
line by line: the witness's `symbolAt` and the ratification excerpt. Each reads any file that is not a
report an adapter routes (SARIF, ESLint, CycloneDX, k6 or JMeter, LCOV or Cobertura). runward has no
notion of a language for a symbol; the languages it knows by extension are the evidence layer's
`PATH_TOKEN`: `ts tsx js jsx mjs cjs py md json yml yaml toml go rs java rb php sql sh css scss html txt`.
Measured on 2026-11-05, the 52 `#SYMBOL` pointers of runward's own mission and of the shipped example sit
in `.md` (20), `.ts` (18), `.json` (8), `.yml` (4) and `.js` (2) files.

**A mission where nothing was verified exited 0 (case c4 of the 2026-11-05 witness).** The example
mission, every one of its 46 manifest rows set to `n/a` with one generic sentence: `check --strict` prints
`0 applied · 0 deviated · 46 n/a`, "! nothing was verified mechanically", then "all gates passed", exit 0;
`--json` says `verdict: "clean"`, `exitCode: 0`. ADR-0060 decided that a vacuous green is disclosed, not
refused, and wrote what a refusal would be if one came: "it takes Jest's shape: a named opt-in flag, never
a silent pass". Its precedent list already held the exit code: pytest exits 5 when no test was collected.

**What the exit code contract says.** `runward/contracts/port-contract.md` publishes 0 clean, 1 gaps, 2
"the question could not be asked", and its evolution rule: "existing exit-code semantics ... never change
meaning"; a breaking change "would ship alongside the old shape". No runward command exits 5 today
(`grep` of `src/` on 2026-11-05).

## Options considered

For the symbol:

- **A. Remove the comments, by a lexer per known language, before the search; keep the strings.** A file
  of another language is read whole, as before.
- **B. Remove the comments and the strings.** runward's own architecture note cites
  `file:eslint.config.js#no-restricted-imports`, a name that lives only in string literals, as do config
  keys, routes and rule ids everywhere: B reds honest evidence.
- **C. Resolve symbols by syntax tree or language server.** ADR-0019 discarded it: language machinery,
  dependencies, false precision.
- **D. Keep the textual reading and say so** (RWD-2026-0194's workaround: grep the old name after a rename).

For the vacuous green:

- **A. Under `--strict`, a level of proof is required; `mechanical` by default, refused with exit 5;
  `--require traced` accepts by name.** Jest's shape, pytest's code.
- **B. Refuse with exit 1.** It says "gaps", and the payload's counts (RWD-2026-0146: what stands between a
  run and a green) would hold a gap that is no row.
- **C. Keep the disclosure** (ADR-0060 as it stands): the case c4 green stays the default.
- **D. An opt-in refusal, the default unchanged.** The vacuous green stays the default, and the operator who
  needs the refusal is the one who never asks for it.
- **E. A deprecation window: warn for one release, refuse in the next.** The contract's "expand then
  contract"; the default stays vacuous for the length of the window.

## Decision

**A** for both, on the maintainer's instruction of 2026-11-05.

**1. A `#SYMBOL` of identifier form is looked for outside the file's comments.** `withoutComments`
(`src/lib/evidence.ts`) replaces every comment of a file by spaces, its line breaks kept, so no two tokens
are glued and every line keeps its number; `symbolPresent(content, symbol, path)` searches what remains
for a symbol of the form ADR-0051 matches at an identifier boundary (`^[A-Za-z_$][A-Za-z0-9_$]*$`). The
three whole-file readers pass the path; the two locators do not, and keep the text.

- **The languages**: those of `PATH_TOKEN`, plus `.mts`, `.cts` and `.markdown`. JavaScript and TypeScript
  (`//`, `/* */`; strings, template literals with `${…}`, regular-expression literals after an operator or
  a keyword), Python (`#`; triple-quoted strings), Markdown and HTML (`<!-- -->`; in Markdown a backtick run
  opens code that a run of the same length closes), JSON (`//`, `/* */`, as tsconfig and JSONC write them),
  YAML (`#` at the start of a word; quotes open a string where a value starts; block scalars are strings),
  TOML (`#`), Go (`//`, `/* */`; raw strings, runes), Rust (`//`, nested `/* */`; raw strings, characters,
  lifetimes), Java (`//`, `/* */`; text blocks), Ruby (`#`, `=begin` … `=end`), PHP (`//`, `#` except
  `#[`, `/* */`), SQL (`--`, `/* */`), shell (`#` at the start of a word), CSS (`/* */`), SCSS (`//`,
  `/* */`). `.txt` has no comment, and any other file is read whole, as before this record.
- **Strings, decided**: a string literal is code that ships and runs, so a name in a string counts, and a
  comment marker in a string (`"https://…"`, `'#'`, `'a--b'`) opens nothing. A Python docstring is a
  string: it counts (stated below as a limit).
- **Other symbols, decided**: a quoted sentence, a dotted name or an operator keeps the textual reading.
  It names no identifier, ADR-0051 already reads it as text, and a sentence's natural home is a comment or
  a document: runward's own suite cites `#"the guard fails closed"` from a code comment
  (`test/unit/evidence-bytes-and-boundaries.test.js`).
- **An unterminated comment** runs to the end of the file in a programming language (what follows it is not
  code), and is text in Markdown and HTML, where an unclosed `<!--` in prose is literal.
- **The refusal** keeps its sentence, and adds "— it occurs only in a comment, and a comment is not code
  (runward ADR-0114)" when the file's text holds the name, so the reader is not told "not found" over a
  file that visibly contains it.
- **The witness** (runward-witness/1) keeps `symbolAt` as section 9.5 defines it, on the text: a refusal of
  a symbol present only in a comment is beyond the witness, family `comments`.

**2. Under `--strict`, the verdict requires a level of proof.** `check --strict --require <level>`:

- **`mechanical`, the default of a full strict verdict**: at least one `applied` row carries a pointer the
  gate opened and checked (`evidence.typed > 0`, the count the run already prints). **`traced`**: a green
  that rests on judgment alone, accepted by name. A `--through` prefix requires `traced` unless `--require`
  says otherwise (ADR-0053: a horizon certifies progress, never a crossing). `--require` without
  `--strict` is a usage error, exit 2: no row is read.
- **Exit 5** when no gap stands and the level is not met: the run was asked and answered, so not 2; it found
  no gap, so not 1; nothing it verified reaches the level, so not 0. pytest's code for "no tests were
  collected" carries the same distinction, and 5 is free in runward's contract. **Gaps first**: a red
  verdict exits 1 whatever its level.
- **The summary says it**: "Current gate  deliverables filled, nothing verified mechanically", a closing
  line naming the level, the count and both ways out, and a Next line (`verify-a-row`) that names them.
  Accepted with `traced`, the run still prints that the green rests on judgment alone.
- **`--json` carries it**: `verdict: "level-not-met"`, `exitCode: 5`, and, under `--strict`, `require:
  { level, met }`. `verdictOutcome` (`src/lib/verdict.ts`) is the one reading of the words and the code.
- **Every surface that states the verdict states this one.** The attestation carries it (its predicate is
  the payload). `verify` re-derives at the level an attestation records; one that records none was written
  by a runward that required none and is re-derived at `traced`, which `verify` says on a line of its own.
  The VSA reads FAILED; the JUnit rendering's `runward gate` case fails, `runward.exit-code` 5; `report`
  (HTML and Markdown) reads LEVEL NOT MET; `status` reads "no gap, nothing verified mechanically"; the
  compliance pack's banner says "level not met" and a control is `implemented` only on exit 0; `--freeze`
  refuses to seal, the exit staying 5. The witness keeps its arithmetic (`exitCode` 0 or 1) and gains the
  member `verdict.require`, carried, not re-checked (family `required-level`). SARIF and Code Quality list
  findings at locations, and a level is not one: they gain none, and the job's exit code carries it.
- **The port contract gains the row 5.** The old green stays one flag away, which is the "alongside" of
  the contract's evolution rule; there is no deprecation window (option E), because a window keeps the
  vacuous green the default for its length.

## How it extends: levels of proof

A study of 2026-11-05 proposes three levels of proof per row, re-derived by runward from the tree,
attested (produced out of the agent's reach), declared, and a level a run demands; it is the subject of a
later record (ADR-0119, for the maintainer to ratify). This decision is its first step, in its shape:

- `--require <level>` names the floor a run demands. `traced` admits rows that are all declared;
  `mechanical` demands one re-derived row. A later level slots into `REQUIRED_LEVELS` by rank (they are
  ordered from the least to the most demanding), and `require.met` and exit 5 keep their meaning: the
  verdict meets the level asked, or no gap stands and it does not.
- The level of each row is not named in `--json` yet. It is derivable today: an `applied` row listed in
  `evidence.proseRows` is declared, every other `applied` row was re-derived. Naming it waits for ADR-0119's
  vocabulary, because ADR-0030 forbids renaming a field once it is emitted.
- Whether `mechanical` stays "one row" or becomes a floor every row must reach is ADR-0119's question.

## Alternatives discarded

- **A comment-stripping regular expression that ignores strings.** `"https://…"` holds a `//` and `'/*'` a
  `/*`: it would cut the rest of such a line, and refuse an honest symbol that follows a URL on it.
- **An exit code above 100, or 3 or 4.** No precedent carries the meaning; 5 does, in the tool ADR-0060
  already cited.
- **A boolean flag (`--allow-vacuous`, `--pass-with-nothing-verified`).** It names one exception, where a
  level names a scale the next record extends.

## Consequences

- **The README's demo stays red with the old name in a comment** (`test/unit/symbols-outside-comments.test.js`),
  and case c4 exits 5 (`test/unit/required-level.test.js`). Runward's own mission and the shipped example
  stay at exit 0, `require: { level: "mechanical", met: true }`; an attestation of 0.46.0, of the example or
  of case c4, still verifies.
- **Two behaviours change for adopters** (CHANGELOG, Changed): a pointer whose name survives only in a
  comment turns red, and a strict mission none of whose `applied` rows the gate verified exits 5 until a
  row is pointed at what applies it or the run says `--require traced`.
- **The lexer is a lexer, not a parser.** Its limits, each rare: shell, Ruby and PHP heredocs, JSX text,
  a regular expression after `)` or after a keyword not in its list, SCSS's unquoted `url(//…)`, Ruby's
  `?#` and a Ruby regular expression holding a `#`, MySQL's `#` comments, the bodies of HTML `<script>` and
  `<style>`, Markdown `~~~` fences and indented code. Each misreads a span either as code, so a comment there
  still counts (the reading before this record), or as a comment, so a name there is refused (red, and said).
- **Seven modules of the mutation perimeter change** (evidence, verdict, check-contract, spec-conformance,
  citations, witness, compliance): `npm run mutation:fresh` names them stale until they are re-measured,
  before the next tag (ADR-0103).
- **Unchanged.** The turn-end `gate-hook` blocks on gaps only. The Action and the shipped CI samples pass
  the code of `check --strict` through, so 5 fails their job as 1 does, and the pre-commit sample refuses
  the commit; their comments still name 0, 1 and 2 only, and naming 5 there is left to the next adapter
  sync. The Claude Code hook sample stays advisory (`|| true`), and the BMAD review layer reports the code
  verbatim. A signature (ADR-0020) and a test name (`::NAME`) in a source file are still read on the text,
  comments included.

### What this does not catch

- **A name left in a string or a docstring**, decided above, and a real identifier unrelated to the rule
  (ADR-0051, "What this does not claim").
- **One honest pointer and everything else declared** meets `mechanical`; a level per row is ADR-0119's.
- **A file outside the table**, read whole as before.

## What would settle it

- **For A (symbols)**: over the next ten pull requests that touch a cited file of runward's own mission or of
  an adopter's that reports to the register, no refusal comes from a comment marker the lexer misread.
- **Against A (symbols)**: one confirmed refusal of legitimate evidence caused by the lexer.
- **For A (level)**: every vacuous mission reported after the release exits 5, and the adopters who keep a
  traced mission say `--require traced` in their CI, visibly.
- **Against A (level)**: a legitimate mission that can point no row at anything, refused in a way that sends
  it to change a correct layout rather than to name its level.

## Reevaluation trigger (mandatory, dated)

Reopen at the first confirmed false refusal under decision 1, at the first report described under "Against
A (level)", when ADR-0119 is decided, or on 2027-02-05, whichever comes first.

**Trigger set on**: 2026-11-05 · **Watched via**: `test/unit/symbols-outside-comments.test.js`,
`test/unit/required-level.test.js`, the known-defects register, and issues that mention exit 5 or
`--require`.

## References

- `src/lib/evidence.ts` (`withoutComments`, `symbolPresent`, `COMMENT_ONLY`), `src/lib/spec-conformance.ts`,
  `src/lib/citations.ts`.
- `src/lib/verdict.ts` (`RequiredLevel`, `requiredLevel`, `levelMet`, `verdictOutcome`, `LEVEL_NOT_MET_EXIT`),
  `src/lib/check-contract.ts`, `src/commands/check.ts`, `src/commands/verify.ts`, `src/lib/witness.ts`,
  `docs/spec/witness.md` (6.2, 8.2), `runward/contracts/port-contract.md`.
- pytest exit codes (5: no tests collected); Jest `--passWithNoTests`; ADR-0060's prior art.
- ADR-0019, ADR-0051, ADR-0053, ADR-0060, ADR-0030, ADR-0083, ADR-0103, ADR-0088 decision 4; RWD-2026-0194.
