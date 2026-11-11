# ADR-0129: runward has no runtime dependency: the argument parser, the terminal colours and init's questions are written in the package, on Node.js built-ins

**Date**: 2026-11-11
**Status**: proposed. The maintainer decided the principle on 2026-11-11, "zero dependency", strictly, and
relayed it to the session that wrote this record and the change it describes. He has not read this text
nor the code: it becomes accepted with his approval of the pull request that carries it, or is amended on
his review. It refines ADR-0116 decision 1 (the tarball still carries the tree the release tested; that
tree is now the package alone) and amends no accepted record
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed and written
by an agent session, class D of `runward/delegation.md`. The change touches `package.json`, a pre-merge
path of the charter: the pull request waits for the maintainer before merge (ADR-0088 decision 7). Under
ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: measured on 2026-11-11 on a fresh clone of `stranxik/runward` at `main@d052814` (0.46.0),
macOS, Node.js 24.22.1, npm 11.19.1. Read: `src/cli.ts`, `src/lib/styles.ts`, `src/commands/init.ts`, the
three dependencies as installed from the lockfile (`commander` 15.0.0, `chalk` 6.0.1, `@inquirer/prompts`
8.7.3: the option scan, the help formatter and the suggestions of the first; the colour-support detection
and the style application of the second), `package-lock.json`, `scripts/package-sbom.mjs`, the Node.js
documentation of `util.parseArgs`, `node:readline` and `node:tty`. Before any change: the help of the
program and of each of the 19 commands, by three spellings and at four widths, and 61 usage errors with
their exit codes, recorded from `main` (193 cases, `test/fixtures/golden/cli-usage.json`); the tarball of
`main` installed into an empty project; `init` driven under a pseudo-terminal, answered, then interrupted
with Ctrl-C. After: the same 193 cases compared byte for byte; `main` and the change run side by side on
3,052 argument lists (52 written, 3,000 drawn from the commands' own vocabulary), each command replaced by
a recorder of what it was called with; the styles of both run side by side under 86 environments, in a
pipe and under a pseudo-terminal; the tarball of the change installed into an empty project; `init` driven
again under a pseudo-terminal
**Relates to**: [ADR-0116](ADR-0116-what-a-user-installs-is-what-the-release-tested-the-tarball-bundles-its-dependencies-the-sbom-is-the-packages-and-no-signing-job-runs-the-build.md)
(what a user installs is what the release tested; decision 1 refined here),
[ADR-0083](ADR-0083-exit-code-two-carries-several-meanings-say-which-before-splitting-it.md) (the usage
errors and exit 2, kept as they are), ADR-0030 (a run without a terminal is never asked a question),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (no socket and no spawned process in
the verdict path), ADR-0065 (`gate-hook` fails open on its own misconfiguration), ADR-0087 (the
qualification kit), ADR-0031 (the supply-chain evidence a regulated buyer reads)

## Context

**What 0.46.0 installs.** `npm install runward@0.46.0` puts 28 packages on a machine ("added 28
packages"): runward and 27 others. Three are declared (`commander`, `chalk`, `@inquirer/prompts`); the other 24 come with
`@inquirer/prompts`, which `init` uses for five questions that `--yes` already skips. None of the 27 is on
the verdict path's own logic, and each of them runs in the process that prints the verdict: the first
parses its arguments, the second paints its lines.

**What the three were used for.** `commander` in one file (`src/cli.ts`: 19 commands, their options and
arguments, the help, the usage errors mapped to exit 2). `chalk` in one file (`src/lib/styles.ts`: six
palette colours, five basic ones, bold and dim). `@inquirer/prompts` in one file (`src/commands/init.ts`:
two lines of text, one multiple choice, two single choices). Together, about 14,000 lines of JavaScript
installed to serve those three files.

**Why it weighs on this tool in particular.** On 2025-09-08 the npm account of a maintainer of `chalk` and
`debug` was taken over by phishing, and versions carrying a payload were published for a set of widely
installed packages, `chalk@5.6.1` among them; they were removed within hours (secondary reporting; the
count is 18 packages in most accounts, see References). runward never installed that version: its range
was `^6.0.0`. But the 0.46.0 tarball declares its dependencies by range and carries no lock, so an install
resolves each of the 27 to the newest version its range allows on that day (ADR-0116 measured 16 of 27 at
other versions than the tag's lockfile). ADR-0116, merged and not yet released at the time of writing,
bundles the lockfile's versions in the tarball, so a version published after a release would no longer
reach that release's users. What would remain is the next lockfile update, which a person or an agent
merges, and the maintainer accounts behind 27 packages.
runward asks its users to take nothing on trust that they can re-derive; 27 packages by other hands, in the
process that prints the verdict, is a part its users could only take on trust.

**What ADR-0116 settles, and does not.** It makes the installed tree the tested tree (bundled, with a
package SBOM of 27 components). It does not reduce the tree. `runward/architecture.md` recorded the three
dependencies as a deliberate trade ("parsing, color, prompts are the only things not worth owning") with a
reevaluation trigger: a dependency unmaintained or a vulnerability window, then replace or vendor. This
record reopens that trade on the maintainer's instruction, not on that trigger: none of the three is
unmaintained, and no advisory is open against the versions the lockfile held.

## Decision

1. **`package.json` declares no runtime dependency**: no `dependencies`, `optionalDependencies`,
   `peerDependencies` or `bundleDependencies`. Development dependencies (the compiler, the linters, the
   mutation tool, the test tools) stay: they run where runward is built and tested, never where it is
   installed. `test/unit/zero-runtime-dependencies.test.js` fails when `package.json` declares one, when
   the lockfile's runtime tree is not empty, or when a module of the build imports anything but a Node.js
   built-in or one of the package's own files. A runtime dependency can come back only by a record that
   supersedes this one.

2. **Step 1, `init`'s questions** (`src/lib/prompt.ts`, on `node:readline`). A line of text, one choice,
   several choices. Choices are numbered and answered by typing the number: no arrow-key navigation, and no
   raw-mode or cursor code written by runward. `node:readline` itself edits the line being typed in raw
   mode and restores the terminal when the reader closes (Ctrl-C and a closed input close it; a process
   killed by SIGTERM or SIGKILL in the middle of a question may leave the terminal in raw mode). It is
   the one visible change of this record (see Consequences). Who is
   not asked is unchanged (ADR-0030: `--yes`, a CI, a stream that is not a terminal take the defaults).
   Ctrl-C at a question exits 1 and writes nothing, as measured on 0.46.0.

3. **Step 2, the colours** (`src/lib/styles.ts`). A style is an opening and a closing ANSI sequence. The
   palette is sent as 24-bit colour, as its nearest entry of the 256-colour palette, or as its nearest
   basic colour, by the level the terminal declares; `NO_COLOR`, `--no-color`, `FORCE_COLOR` and an output
   that is not a terminal decide as they did. `util.styleText` is not used: it has no 24-bit colour.

4. **Step 3, the arguments and the help** (`src/lib/cli-args.ts`, on `util.parseArgs`). The commands are
   declared in `src/cli.ts` as before, line for line. `util.parseArgs` reads a command's options (long
   and short forms, attached and separate values); the module adds what it does not have: the program's
   own options before and after the command name, the options that take several values, the choices, the
   required option, the arguments, the suggestions, the help, and the usage errors with their names.
   The help text, each usage error's sentence and each exit code are those of 0.46.0, byte for byte, held
   by `test/unit/cli-usage-golden.test.js` on a fixture recorded before the change.

5. **Node.js built-ins only, all within the declared range** (`engines`: Node.js 22.12 and later).
   `util.parseArgs` with `tokens` is stable since Node.js 20; `node:readline`, `node:tty` and `node:os`
   are older.

6. **The tarball and the SBOM follow** (ADR-0116 decision 1, refined). The tarball carries no
   `node_modules`. `scripts/package-sbom.mjs` is unchanged: it still compares the tarball's bundle with the
   lockfile's runtime tree and refuses any difference; both are now empty, and the SBOM lists the package
   alone. A dependency that came back unbundled, or a bundle the lockfile does not explain, is refused as
   before.

## What the project now owns

Each of these was somebody else's maintenance, and is now runward's:

- **Argument parsing.** The rules above, and their edge cases: an option's value that looks like an
  option, `--` ending the options, a negative number as an argument, a group of short options, an option
  repeated. `util.parseArgs` carries the tokenising; the rest is about 420 lines read by two tests.
- **The help's layout.** Column alignment and wrapping to the terminal's width, 80 columns in a pipe.
- **The terminal's colour support.** Which terminals take which level: `TERM`, `COLORTERM`,
  `TERM_PROGRAM`, the Windows build number, the CI systems that render colours. New terminals appear; the
  table will age, and the cost of a miss is a line less coloured than it could be, or `NO_COLOR` to type.
- **Windows.** Line-based questions and plain escape sequences are the two things a Windows console has
  handled since Windows 10; CI runs the suite on Windows. A legacy console without virtual terminal
  processing would show the sequences as text; `NO_COLOR=1` or `--no-color` is the way out there.
- **Ctrl-C and a closed input.** At a question, each ends `init` before anything is written, exit 1, with
  a sentence. Outside a question nothing changes: no signal handler is installed.
- **Pasted or typed-ahead answers.** One reader serves every question, so a line that arrives before its
  question is kept for it.

## Alternatives discarded

- **Keep `commander`, remove the other two** (28 packages to 2). It is the largest of the three pieces of
  code to write, has no dependency of its own and one maintainer account. Discarded on the instruction's
  own terms, strictly zero, and because "one dependency" keeps the question open that "none" closes: the
  SBOM, the lockfile's runtime tree and the install are then facts anyone checks with one command, with no
  list to read.
- **Vendor the three** (copy their sources into the package). No registry at install, and about 14,000
  lines by other hands in the tarball, to be kept in step with their upstreams by hand: the same code
  runs, its updates stop arriving, and a reader of the package has more to read, not less. ADR-0116's
  bundle already gave what vendoring gives (the tested tree is the installed tree) without the fork.
- **`util.styleText` for the colours.** It takes named colours only; the palette is six hex values.
- **Arrow-key menus written here.** They need raw mode handled by runward's own code, cursor addressing,
  redraw on resize, and a way back to a sane terminal on every exit path, on three operating systems
  (the numbered questions leave all of that to `node:readline`, for one line of input). That is the part of
  `@inquirer/prompts` that justified a dependency; rewriting it small and correct is not credible, and
  five questions asked once per project do not need it.
- **A hand-written scan instead of `util.parseArgs`.** It would mirror the previous parser most directly.
  The built-in is kept for what it does (it is Node.js's own, documented and tested there); what is
  written beside it is what it lacks.

## Consequences

- **An installation of runward is one package on disk** instead of 28 (measured: 28 with the published
  0.46.0, 28 with the tarball of `main`, 27 of them bundled; 1 with this change, installed offline from the
  file with an empty npm cache). The tarball packed from `main` with
  ADR-0116's bundle is about 1.23 MB; packed from this change it is about 0.85 MB (the exact figure
  moves with every line of the changelog the tarball carries), and an installation from the file needs
  no registry and no cache.
- **`init`'s questions change at a terminal.** Before: menus moved with the arrow keys, a space to tick a
  tool profile. After: numbered lists, a number and Enter (several numbers for the tool profiles, Enter
  alone for the default). The questions, their order, their defaults and what is written from the answers
  are unchanged. `init --yes`, `init` in a CI or in a pipe: unchanged, byte for byte
  (`test/unit/init-golden.test.js`).
- **Ctrl-C at a question**: exit 1 as before; the sentence changes from the dependency's ("User force
  closed the prompt with SIGINT") to runward's ("interrupted at a question (Ctrl-C): no answer was
  taken"). `src/cli.ts` held a line meant to exit 130 there; measured on 0.46.0, it was never reached. It
  is removed, and the exit code stays the one users have.
- **Help, usage errors, exit codes, colours**: no difference found, on the 193 recorded cases, the 3,052
  argument lists and the 86 environments of the Method. A difference found later on an input a user types
  is a defect to register.
- **The qualification documents and the mission's own records** that named the three dependencies are
  updated in the same change (`runward/architecture.md`, `runward/decision-matrix.md`,
  `runward/reference-stack.md`, `runward/runbook.md`, `runward/floor.md`, `docs/isolated-environments.md`,
  `docs/verifying-a-release.md`, the two qualification sheets).
- **Dependabot has nothing to propose for the runtime**: its pull requests now concern development
  dependencies and workflows only.

- **Four spellings the colour dependency read from the command line are gone.** It looked for `--color`,
  `--colors`, `--color=…` (`true`, `always`, `256`, `16m`, `false`, `never`…) and `--no-colors` among the
  arguments, beside `--no-color`. runward never declared them: each was, and still is, an unknown option
  (exit 2) unless it stands as an option's value, where it used to switch colours on or off as a side
  effect and no longer does. The comparison over 86 environments passed no such argument and could not
  see it; found by the review below.
- **`FORCE_COLOR` wins over `--no-color`**, as before: `FORCE_COLOR=3 runward --no-color check` is
  coloured, in a pipe too. Kept as found, and stated in `src/lib/styles.ts`; whether the flag should win
  is the maintainer's to decide.

### What this does not do

- **It does not make the build free of other people's code.** The build and the tests still run every
  development dependency (ADR-0116, "a build job that alters what it builds"): a dependency that changes
  the tarball before it is hashed is still signed as what the run built. The reproducible rebuild and the
  second job's byte-for-byte comparison stay the controls there.
- **Node.js, npm and the operating system** are still what runward runs on, and are not in the tarball.
- **It says nothing of the code now written here**: about 780 lines replace the three, read by this
  repository's tests and by one agent session; they have had no outside review.
- **The satellites** (`runward-forge`, `runward-fleet`, `runward-run`) are separate packages with their
  own manifests; `runward-fleet` already had no dependency, and this record does not change the others.

## Adversarial review (2026-11-11)

A second agent session read the pull request with the brief of refuting it, before the maintainer. It
ran 14,186 argument lists through `main` and the change, every command replaced by a recorder: no
difference, and nothing blocking. Its six findings, and what was done with each in the same pull request:

1. **The record and `src/lib/prompt.ts` said "no raw mode, no cursor movement". False**: at a terminal
   `node:readline` reads keys in raw mode and writes cursor sequences for the line being typed. Reworded
   (decision 2, the alternative on menus, the module's header): runward writes none of its own, readline
   restores the terminal on close, a process killed mid-question may not. Behaviour unchanged.
2. **A comment of `src/lib/styles.ts` put `--no-color` before `FORCE_COLOR`.** The code, like the
   dependency before it, lets the variable win. Comment corrected, behaviour kept, stated in Consequences.
3. **The colour dependency also read `--color`, `--colors`, `--color=…` and `--no-colors`** from the
   arguments, which the 86 environments never exercised. Stated in Consequences.
4. **The parser relied on "no command declares a short flag without a value" without enforcing it.**
   Such a declaration, and a short form on a program option, now throw when declared
   (`test/unit/cli-args.test.js`, planted).
5. **The tarball size stated here differed from the reviewer's by about a kilobyte** (the tarball carries
   the changelog, which grew). The exact figure is dropped for an approximate one.
6. **Where the review is recorded**: here, and in the changelog entry.

A review by a model is advisory (ADR-0007): it produces findings and crosses no gate.

## What would settle it

- **For decision 1**: on the first release that carries it, `npm install runward@X.Y.Z` into an empty
  project leaves one package under `node_modules` (runward, with no `node_modules` of its own), `npm ls
  --all` shows runward alone, and the release SBOM lists no component. **Against**: any other count.
  ("added 1 package" is not the measure: npm prints it for a tarball that bundles 27 others too.)
- **For decisions 2 to 4**: one release cycle without a defect registered against the parser, the colours
  or the questions that the dependency it replaced did not have. **Against**: a registered defect of that
  kind that costs more to fix here than the dependency cost to carry; or a report that the numbered
  questions lose a user the menus kept (then the question is the menus, written here or `init` reduced to
  flags, not the dependency back).
- **For the byte-for-byte claim**: `test/unit/cli-usage-golden.test.js` green on Linux, macOS and Windows
  on the fixture recorded from 0.46.0. **Against**: a help line, an error sentence or an exit code that
  differs from 0.46.0 on an input a user types, found after the merge.
- **For the maintainer**: his reading of this record and of the three modules. Until then it is proposed.

## Reevaluation trigger (mandatory, dated)

Reopen at the first release that carries this change (measure the install and the SBOM against "What would
settle it"), when a defect is registered against one of the three modules, when Node.js changes
`util.parseArgs` or `node:readline` in a way the tests catch, when a need appears that the three modules
do not cover and a dependency would (a record must then say why writing it here is worse), or on
2027-02-11, whichever comes first.

**Trigger set on**: 2026-11-11 · **Watched via**: `test/unit/zero-runtime-dependencies.test.js`,
`test/unit/cli-usage-golden.test.js`, `test/unit/package-sbom.test.js`, the defect register
(`docs/compliance/known-defects.md`).

## References

- `src/lib/cli-args.ts`, `src/lib/prompt.ts`, `src/lib/styles.ts`, `src/cli.ts`, `src/commands/init.ts`,
  `package.json`, `package-lock.json`.
- `test/unit/zero-runtime-dependencies.test.js`, `test/unit/cli-usage-golden.test.js` and
  `test/fixtures/golden/cli-usage.json`, `test/unit/cli-args.test.js`, `test/unit/prompt.test.js`,
  `test/unit/styles-color.test.js`, `test/unit/package-sbom.test.js`, `test/unit/example-packed.test.js`,
  `test/support/fake-tty.mjs`.
- Node.js documentation: `util.parseArgs` (https://nodejs.org/api/util.html#utilparseargsconfig),
  `node:readline` (https://nodejs.org/api/readline.html), `tty.isatty`
  (https://nodejs.org/api/tty.html#ttyisattyfd).
- The 2025-09-08 compromise of npm packages, secondary reporting:
  https://www.stepsecurity.io/blog/20-popular-npm-packages-compromised-chalk-debug-strip-ansi-color-convert-wrap-ansi
  and https://blog.checkpoint.com/crypto/the-great-npm-heist-september-2025/ (the accounts give 18 to 25
  packages; this record relies only on `chalk@5.6.1` being among them and on the removal within hours).
- NO_COLOR, https://no-color.org/.
- ADR-0030, ADR-0031, ADR-0054, ADR-0065, ADR-0083, ADR-0087, ADR-0088 decisions 4 and 7, ADR-0116.
