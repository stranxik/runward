# The witness of a strict verdict: `runward-witness/1`

**Status**: specification, dated 2026-10-06 · **Implements**: [ADR-0089](../adr/ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
increment 1, step 3 · **Emitted by**: `runward check --strict --witness <file>` (runward 0.43.0 and
later) · **Read by**: a checker that shares no code with runward (ADR-0089 decision 2)

This document is the only specification of the witness. A checker is written from it, by someone who
has not read runward's source, and a checker that needs to read `src/` to agree with runward is a
defect of this document. Where this document and runward's behaviour differ, one of them has a defect,
and the disagreement is filed in `docs/compliance/known-defects.md` before either side changes
(ADR-0089 decision 3).

## 1. What a witness is, and what it is not

A **witness** is the set of facts one `check --strict` verdict relied on, written down by the run that
reached the verdict: each row of each gated manifest, each evidence pointer with what it resolved to
and that file's digest, each rule file's digest, the expected rule sets, the cited decisions with their
status words, the counts, and every term that counted against the verdict. The word is the technical
one of McConnell, Mehlhorn, Näher and Schweitzer ("Certifying algorithms", 2011): an artefact that lets
a much simpler program check one output. It says nothing of any certification, and nothing in runward,
in a checker or in a document about either calls a witnessed verdict "certified", "proven" or "verified
correct". The public wording is: *re-checked by a separate program that shares no code with runward*.

A checker does two things with it:

- it **re-checks** each fact the witness states against the tree (this file's digest is this; this
  pointer resolves, from this base, to this real path; this symbol is on this line), and
- it **re-derives** what a witness cannot carry, an absence (no expected rule lacks a row, no second
  `Rule conformance` section exists, no table row was left out, no pointer in a cell was silently
  dropped), from the tree alone, with the rules in section 9.

What a witness shows, when a checker accepts it: for **this run, on this tree, with this runward
version**, every witnessed fact holds and every re-derived absence holds. It shows nothing about
another tree, nothing about a family listed in `notWitnessed` (section 8), and nothing about the
quality of the evidence: the gate's own non-scope (`GATE_NON_SCOPE`, printed by every `check`) is
unchanged. Agreement between runward and a checker is not correctness: both can share a misreading of
this document.

**A checker's answer never changes `check`'s exit code.** `check` exits on its own verdict
(ADR-0047 decision 4); a checker answers with its own exit code, outside the command and outside the
verdict path. In runward's own CI, a witness the checker refuses fails the build (ADR-0089 decision 3);
in a user's run it decides nothing for the user.

## 2. Producing a witness

```sh
runward check --strict --witness witness.json
```

- `--witness <file>` requires `--strict` and refuses `--freeze` (exit 2, a usage error under
  [ADR-0083](../adr/ADR-0083-exit-code-two-carries-several-meanings-say-which-before-splitting-it.md)):
  a witness is the facts of a strict verdict, and a freeze judges without its old seal and writes a new
  one mid-run, so its witness would describe a verdict the next run does not give.
- A relative `<file>` is read from the working directory, like a shell redirection.
- The path is checked **before the gate runs**, so a refusal prints no partial audit and writes
  nothing. Refused with exit 2: a path inside the mission's `runward/` directory (the witness would
  become part of the tree it describes), a directory, a path whose parent directory does not exist or
  is not writable, an existing file that is not writable (all `usage`), and an existing file that is
  not a witness (`refused`: runward overwrites only a file whose `witness` field starts with
  `runward-witness/`). Under `--json`, each refusal is the ADR-0083 error document
  `{ "runward", "error", "message", "exitCode": 2 }`.
- The file is written whole: to a temporary file in the same directory, then renamed into place. A
  write that fails late removes the temporary file and exits 2; no reader ever finds half a witness.
- **`check`'s stdout and exit code are the same with and without `--witness`.** The notice
  `witness written: <file> (<bytes> bytes, runward-witness/1)` goes to stderr. With the global
  `--dry-run`, nothing is written and stderr says how many bytes would have been.
- The witness is assembled from the verdict object the command rendered and the exit code it exits
  on; nothing recomputes the verdict. Its facts are read with the same functions the verdict calls,
  on the same arguments.
- `--witness` combines with `--through`, `--hooks`, `--json`, `--sarif`, `--attest` and `--vsa`; stdout
  carries whichever document those ask for, unchanged.

**Size, measured on 2026-10-06** (runward 0.43.0, the canonical encoding of section 3): 37,100 bytes
for the example mission (`init --example`: 46 rows, 26 typed pointers, 25 bare path tokens, 16 cited
files, 64 rules) and 59,181 bytes for runward's own mission (46 rows, 41 cited files). ADR-0089 sized a
mock at 19,807 and 29,915 bytes; the witness carries more than the mock did (bare path tokens, the
`files` table's line counts and report natures, symbol and test locations, the deliverables, the
`notWitnessed` reasons). It is opt-in for that reason: `--json` stays the default machine document.

## 3. Canonical encoding

A witness file is **one JSON text** (RFC 8259) encoded as UTF-8, without a byte-order mark, followed
by exactly one line feed (U+000A). The JSON text is canonical:

- **Key order**: the members of every object, at every depth, are sorted by their key's UTF-16 code
  units, ascending (the order of RFC 8785, the JSON Canonicalization Scheme, and of JavaScript's
  default `Array.prototype.sort` on strings).
- **No insignificant whitespace**: no space, tab or line break between tokens.
- **Strings** are serialised as ECMAScript `JSON.stringify` serialises them (the serialisation RFC 8785
  adopts): `"` and `\` escaped, U+0000 to U+001F escaped (`\b \t \n \f \r` by name, the others as
  `\u00XX` in lowercase hexadecimal), every other character written as itself.
- **Numbers** are non-negative integers written in decimal without a sign, exponent or fraction.
- **Lists keep the order this document gives for each one.** A list's order is part of the witness; a
  list whose order is said to be "as the verdict reads it" is still deterministic for a given tree and
  runward version.

The same tree and the same runward version give the same bytes (ADR-0054, "same tree and same runward
version, same verdict"). Nothing in a witness depends on the clock, the user, the host name, the
absolute location of the project, or the order in which the file system lists a directory, with one
declared exception: when a decision journal holds two files that both match one ADR id, the file the
verdict picked is the first in directory order (section 7.6), and the witness names it.

A checker parses the witness with any conforming JSON parser. It **may** also re-encode the parsed
value with the rules above and compare the bytes; a witness that does not round-trip was not written
by runward 0.43.0 or later, or was edited.

## 4. Spellings and digests

**Paths.** Every path in a witness is relative to the **project root**, the directory that contains
`runward/`, and spelled with `/` whatever the platform. No path is absolute, and none starts with `./`.
A `real` path (section 7.4) is the file's real path (every symbolic link resolved) relative to the real
path of the project root; it starts with `../` only when the file lies outside the project, in the
repository that contains it (`within: "repository"`).

**Text.** Files are read as UTF-8; an invalid byte sequence decodes to U+FFFD. A file's **lines** are
the pieces of its decoded text split on U+000A: line *n* is the *n*-th piece (1-based), a CR before an
LF stays at the end of its line, and the line count of a text is its number of pieces (a text ending
with LF has one empty last line, counted).

**File digest** (`sha256` of a file, a deliverable or an ADR): SHA-256, lowercase hexadecimal, of the
file's **normalised bytes**. If the raw bytes contain a NUL byte (0x00), they are hashed as they are.
Otherwise they are decoded as UTF-8 (invalid sequences to U+FFFD), every CR LF pair is replaced by LF,
and the result is encoded as UTF-8 and hashed. A Windows checkout and a POSIX checkout of one commit
therefore have the same digests.

**Text digest** (`sha256` of a rule file, and the package digests of section 7.2): the same, except
that there is no NUL exception: the bytes are always decoded, CR LF folded to LF, re-encoded and
hashed. For any file without a NUL byte the two digests are equal.

**Row digest** (`digest` of a row): the first 16 characters of the lowercase hexadecimal SHA-256 of the
UTF-8 encoding of `fold(rule) + U+0000 + lower(fold(status)) + U+0000 + fold(evidence)`, where
`fold(x)` removes leading and trailing white space and then replaces every run of white space by one
space (white space is ECMAScript's `\s`: the WhiteSpace and LineTerminator characters), and `lower`
is ECMAScript `toLowerCase`. `rule`, `status` and `evidence` are the row's three cells as section 9.4
reads them. It is the digest a ratification binds to (ADR-0080).

## 5. Versioning

`witness` is `"runward-witness/1"`. Under this identifier the schema only **expands**: a later runward
may add a member to any object, and add a value to a list of names (a family, a kind, a nature, a
`notWitnessed` entry); it never removes, renames or changes the meaning of one. A change of meaning is
`runward-witness/2`. A checker:

- refuses a witness whose `witness` is not a value it implements, with an exit code distinct from
  "a fact does not hold" (2 is recommended);
- ignores members it does not know (they belong to a later version of this schema);
- treats a value it does not know in a list of names (an unknown `family`, `kind`, `nature`) as beyond
  what it can re-check, never as a fact that holds.

`runward` is the version that wrote the witness. The verdict depends on the tree **and** on the
runward version (its shipped templates and corpus history): a checker records the version and never
compares two witnesses of different versions as if they were one.

## 6. Top level

| Member | Type | What it is |
|---|---|---|
| `witness` | string | `"runward-witness/1"` |
| `runward` | string | the runward version that ran the verdict, e.g. `"0.43.0"` |
| `mode` | object | how the verdict was asked for (6.1) |
| `verdict` | object | the verdict and its counts (6.2) |
| `repository` | string or null | the repository root the resolution relied on (6.3) |
| `corpus` | object | the rule corpus the verdict judged against (7.2) |
| `deliverables` | list | every deliverable of the arc and the state the verdict read (7.1) |
| `horizon` | object or null | the declared construction horizon (6.4) |
| `gated` | list | the five gated manifests, row by row (7.3) |
| `files` | object | every file a pointer or a path token resolved to (7.4) |
| `unratified` | list | the reconstructed decisions not yet ratified (7.7) |
| `causes` | list | every term that counted against the verdict (8.1) |
| `notWitnessed` | list | the families this witness does not carry the facts of (8.2) |

### 6.1 `mode`

`{ "strict": true, "through": <string or null>, "hooks": <boolean> }`. `strict` is always `true`.
`through` is the `--through` phase id, or null. `hooks` says whether `--hooks` ran the operator's hooks.

### 6.2 `verdict`

| Member | Type | Meaning |
|---|---|---|
| `result` | `"clean"` or `"gaps"` | the words `check --json` uses for its `verdict` |
| `exitCode` | 0 or 1 | the exit code `check` exited with |
| `gaps` | integer | deliverables not filled, inside the horizon |
| `strictGaps` | integer | every strict term (8.1) |
| `hookFailed` | integer | failed hooks, an invalid `hooks.json` counting one |
| `deferredGaps` | integer | deliverables not filled beyond the horizon; never counted |
| `checked` | integer | gated manifests judged and not skipped (7.3) |
| `strictBreakdown` | object | `strictGaps` by family: `conformance`, `proposed`, `corpus`, `seal`, `unratified`, `unboundRows`, `charter` (integers) |

Arithmetic a checker re-checks (all of it, always):

- `exitCode` is 0 if and only if `gaps + strictGaps + hookFailed` is 0, and `result` is `"clean"` if
  and only if `exitCode` is 0.
- `strictGaps` equals the sum of the seven `strictBreakdown` members plus the number of causes of
  family `workflow-contract`.
- The number of entries of `causes` equals `gaps + strictGaps + hookFailed`, and per family (8.1):
  `deliverable-state` causes = `gaps`; `conformance` causes = `strictBreakdown.conformance +
  strictBreakdown.proposed`, of which those of kind `proposed` = `strictBreakdown.proposed`; `corpus` =
  `corpus`; `seal` = `seal`; `unratified-decision` = `unratified`; `regulated` = `unboundRows`;
  `charter` = `charter`; `hooks` = `hookFailed`.
- `checked` equals the number of `gated` entries with `judged: true` and `skipped: false`.

### 6.3 `repository`

The nearest directory, among at most 24 starting with the project root itself and climbing, that
contains an entry named `.git`, `pnpm-workspace.yaml`, `lerna.json`, `turbo.json` or `nx.json`,
spelled relative to the project root (`"."` for the project root itself, `".."`, `"../.."`…), or null
when there is none. A pointer whose real path lies outside the project is accepted by the verdict only
inside this directory. A checker re-derives it with the same rule.

### 6.4 `horizon`

Null without `--through`. Otherwise `{ "phase": <the --through id>, "deferred": [<path>…] }`, the
deliverables of the phases after `phase`, in the order of `deliverables`. The presence phases, in
order, are `frame`, `architect`, `floor`, `govern`, `handover`. A gated manifest is **judged** when its
phase is at or before the horizon, with one fold: the `topology` manifest is judged with `architect`.
Under a horizon, deliverables and gated manifests beyond it count nothing; the corpus, the seal and
the unratified decisions are judged whatever the horizon.

## 7. The facts

### 7.1 `deliverables`

One entry per deliverable of the arc, in the arc's order, as the verdict read them:

`{ "phaseId": <string or null>, "path": "runward/<relative path>", "state": <string>, "cause": <string or null>, "sha256": <string or null> }`

- `state` is `filled`, `in-progress`, `untouched` or `missing`; `cause` is why an `in-progress`
  deliverable is not filled (`placeholders`, `below-floor`, or a structure cause), else null.
- `sha256` is the file digest of a regular file, null for a directory deliverable (`runward/adr`,
  `runward/contracts`) and for an absent path.

The arc, with each phase's deliverables: `frame`: `framing.md`, `mission-contract.md`; `architect`:
`architecture.md`, `execution-topology.md`, `decision-matrix.md`, `adr`, `contracts`; `floor`:
`floor.md`; `govern`: `governance/threat-model.md`, `governance/evaluation-rubric.md`,
`governance/observability-schema.md`; `handover`: `runbook.md`, `handover.md`.

Re-checked: each `sha256`; `state` is `missing` if and only if the path does not exist. **Not
witnessed**: whether an existing deliverable is `filled` (it is judged against the package's
templates; family `deliverable-state`).

### 7.2 `corpus`

| Member | Type | Meaning |
|---|---|---|
| `source` | `"mission"` or `"package"` | `mission` when `runward/rules/` exists; the verdict then reads that directory, else the installed package's `templates/rules/` |
| `status` | string | `verifiable`, `unrecorded` or `package` (below) |
| `edited`, `missing`, `extra` | lists of file names | the corpus divergences the verdict counted, e.g. `"hexa-architecture.md"` |
| `lock` | string or null | `"runward/scaffold-lock.json"` when the lock exists and reads as a lock, else null |
| `rules` | list | every rule of the judged corpus, sorted by `slug` |
| `package` | object | `{ "rulesSha256": <string or null>, "historySha256": <string or null> }` |

Each rule: `{ "slug": <file name without .md>, "sha256": <text digest>, "lock": "same" | "other" | "none", "signed": <boolean> }`.
`lock` compares the lock's recorded digest for `rules/<slug>.md` with the file's text digest: equal,
different, or no entry. `signed` is true when the rule's frontmatter carries a non-empty `signature:`.

`package.rulesSha256` is the SHA-256 (hexadecimal) of the concatenation, over the package's
`templates/rules/*.md` sorted by file name, of `<file name> U+0000 <text digest> U+000A`.
`package.historySha256` is the file digest of the package's `templates/rule-history.json`, or null when
it cannot be read. They pin the package the verdict compared against; the tree does not contain it.

**The lock**: `runward/scaffold-lock.json`, a JSON object with `"version": 1` and a `files` object
(file path to text digest); a backslash in a key reads as `/`. A file that does not parse, or lacks
either member, reads as no lock.

**Status**, re-derived by a checker from the tree: `package` when `runward/rules/` holds no `.md` file;
else `unrecorded` when the lock holds no key starting with `rules/` and ending with `.md`; else
`verifiable`.

**Divergences.** Under `verifiable`, `extra` lists the `.md` files of `runward/rules/` the lock does not
name whose first 800 characters carry a line `impact: CRITICAL` or `impact: HIGH` (the word after
`impact:` and optional white space, case-insensitive) and a line `phases: [ … ]` naming one of
`architect`, `topology`, `floor`, `govern`, `handover` (items split on `,`, trimmed, quotes removed).
`missing` lists the lock's `rules/*.md` entries whose file is absent, and the package's shipped rules
absent from both the directory and the lock. `edited` lists the lock's rules whose text digest differs
from the recorded one, or equals it while the package's published history (`rule-history.json`)
lists other digests for that file and not this one, unless the file's text equals the package's
shipped text.

A checker re-derives `status`, `extra`, and the lock-side part of `missing` (an entry whose file is
absent). The package-side parts (a shipped rule absent from the tree, a published-history mismatch, a
`lock: "other"` rule excused from `edited` because its text equals the shipped one) need the package:
**not witnessed** (family `corpus-history`), unless the checker is given the package and re-checks
`package.rulesSha256` and `package.historySha256` first. Without it, a `lock: "other"` rule absent from
`edited`, or a `lock: "same"` rule present in it, is reported as beyond the witness, not as a
disagreement. With `source:
"package"` the rule files are the package's, and the checker re-checks the `rules` entries only with the
package.

**Rule frontmatter** (used by 7.3 and 9.3): the text between a first line `---` and the next line
`---` (CR LF tolerated: the pattern is `^---\r?\n([\s\S]*?)\r?\n---`, matched at the start of the
file). In it, `impact` is the trimmed rest of the first line matching `^impact:\s*(.+)$`; `phases` is
the inside of the first `^phases:\s*\[(.*)\]`, split on `,`, each item trimmed, empty items dropped,
quotes **not** removed; `signature` is the trimmed rest of the first `^signature:\s*(.+)$`. Lines are
matched in multiline mode (`^` and `$` at line boundaries).

### 7.3 `gated`

Five entries, always, in this order: `architect` (`runward/architecture.md`), `topology`
(`runward/execution-topology.md`), `floor` (`runward/floor.md`), `govern`
(`runward/governance/threat-model.md`), `handover` (`runward/handover.md`).

| Member | Type | Meaning |
|---|---|---|
| `phase` | string | the gated phase id above |
| `path` | string | the manifest |
| `judged` | boolean | false only beyond a declared horizon (6.4) |
| `skipped` | boolean | judged, but nothing was expected and nothing was found: it counts nothing |
| `expected` | list of slugs | the rules the phase expects, sorted (section 9.3) |
| `floor` | integer | the minimum number of rules expected for this phase: `architect` 6, `topology` 4, `floor` 10, `govern` 12, `handover` 4 |
| `present` | boolean | the manifest exists |
| `sha256` | string or null | its file digest |
| `sections` | list of integers | the line of each `Rule conformance` heading (9.4) |
| `problems` | list of strings | why part of the manifest could not be read (9.4) |
| `rows` | list | its rule rows, in line order (7.3.1) |

An absent manifest has `sections`, `problems` and `rows` empty.

#### 7.3.1 Rows

`{ "line", "rule", "status", "digest", "pointers", "paths", "prose", "adr" }`:

- `line`: the row's 1-based line; `rule`, `status`: its first two cells as 9.4 reads them (`status`
  lowercased); `digest`: its row digest (section 4).
- `pointers`: the typed pointers of the evidence cell, in the order the cell carries them (7.3.2).
  Written for an **examined** row only: a row whose status is `applied` or `proposed:applied`, and whose
  trimmed evidence is not a placeholder (a whole cell of the form `[` … `]` containing white space,
  pattern `^\[[^\]]*\s[^\]]*\]$`). Empty otherwise.
- `paths`: the bare path tokens of the evidence cell, written for every row whose status is `applied`
  or `proposed:applied`, a placeholder included (7.3.3).
- `prose`: the pointer spellings the cell carries where no path could be (`test:junit`,
  `adr:process`, `file:Makefile`), every row: disclosed by `check`, never counted.
- `adr`: for a row whose status is `deviated`, the ADR its evidence names (7.6), or null when the
  evidence names none (no match of `ADR-\d+`, case-insensitive); null for every other status.

#### 7.3.2 Pointers

The pointer grammar is runward's (`file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`, `adr:NNNN`); a
checker does **not** re-implement it. It re-checks each pointer's facts and runs the conservative
cover test of 9.6, which refuses a pointer the grammar dropped. Each pointer carries only its kind's
members:

`kind: "file"`: `{ "kind", "raw", "path", "line", "symbol", "symbolDeclared", "target", "unresolved", "symbolAt", "outsideManifestAt", "report" }`

`kind: "test"`: `{ "kind", "raw", "path", "testName", "testNameDeclared", "target", "unresolved", "testAt", "junit" }`

`kind: "adr"`: `{ "kind", "raw", "malformed", "adr" }`

| Member | Type | Meaning |
|---|---|---|
| `raw` | string | the pointer as runward echoes it, rebuilt from what it parsed (a symbol or test name containing white space is re-quoted with `"`) |
| `path` | string | the path as written in the cell |
| `line` | integer or null | the `:LINE` of a `file:` pointer |
| `symbol` | string or null | the `#SYMBOL`, quotes removed; null when nothing usable followed `#` |
| `symbolDeclared` | boolean | the cell wrote a `#`, whether or not a symbol followed |
| `testName` | string or null | the `::NAME`, quotes removed; null when nothing followed `::` |
| `testNameDeclared` | boolean | the cell wrote a `::` |
| `target` | object or null | where `path` resolved (7.3.4), null when it did not |
| `unresolved` | null or string | when `target` is null: `absolute` (an absolute path, never evidence), `outside` (it exists from some base but its real path lies outside the project and the repository), `missing` (it exists from no base) |
| `symbolAt` | integer or null | the first line on which the symbol is present (9.5), when the symbol is read as text; null when it is on no line, when there is no symbol, or when the file is read as a report |
| `outsideManifestAt` | integer or null | when the target is the manifest itself: the first line **outside the manifest** (9.5) containing the symbol; else null |
| `report` | object or null | `{ "nature", "result" }` when the symbol was read through a report (9.5): the nature, and the result the verdict read (`clean`, `findings`, `absent`, `unparseable`, `covered`, `uncovered`, `present`, `ambiguous`) |
| `testAt` | integer or null | for a test name in a file that is not a JUnit report: the first line containing the name as a substring |
| `junit` | list or null | for a test name in a JUnit report: every `<testcase>` the name selects, in document order, `{ "line", "green" }` (9.5) |
| `malformed` | string or null | an `adr:` pointer that names a decision with the wrong spelling (`adr:ADR-0007`): why it cannot be used |
| `adr` | object or null | the ADR an `adr:NNNN` pointer names (7.6), id `ADR-NNNN` as written; null when `malformed` |

#### 7.3.3 Path tokens

Each: `{ "token", "target", "unresolved" }`, in the order the cell carries them. A token is a match of

```
[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|md|json|ya?ml|toml|go|rs|java|rb|php|sql|sh|css|scss|html|txt)\b
```

in the raw evidence cell (global, ECMAScript semantics, `\w` = `[A-Za-z0-9_]`). A token inside a typed
pointer is a token too (the cell `file:src/a.ts#X` carries the token `src/a.ts`). `target` and
`unresolved` are as for a pointer, with the token as the path.

#### 7.3.4 Targets

`{ "base": "project" | "mission" | "deliverable", "real": <path> }`. The three bases, tried in this
order: the project root, `runward/`, and the manifest's own directory. A path resolves from a base when
`base/path` exists and its real path lies inside the real path of that base, or inside the repository
root found by climbing from that base (6.3's rule, starting at the base). `base` is the **first** base
from which it resolves; `real` is its real path, project-relative (section 4). The facts about the file
are in `files[real]`.

### 7.4 `files`

An object whose keys are `real` paths, one per distinct file a pointer or a token resolved to, keys in
canonical order. Each value:

`{ "within": "project" | "repository", "regular": <boolean>, "sha256": <string or null>, "nonEmpty": <boolean or null>, "lines": <integer or null>, "natures": [<string>…] }`

- `within`: `repository` when `real` starts with `../`, else `project`.
- `regular`: the real path is a regular file (a directory is not).
- `sha256`, `nonEmpty`, `lines`: the file digest; whether its text contains a character that is not
  white space (`\S`); its line count. Null when the file is not regular or cannot be read (family
  `unreadable`).
- `natures`: which report detectors match the decoded text, in this order, each at most once. Each
  detector is a conjunction or disjunction of ECMAScript regular expressions searched anywhere in the
  text (`i` = case-insensitive, `m` = multiline):
  - `sarif`: (`/"\$schema"\s*:\s*"[^"]*sarif/i` or `/"version"\s*:\s*"2\.[01]/`) and `/"runs"\s*:/`;
  - `eslint`: the text with leading white space removed starts with `[`, and `/"filePath"\s*:/` and
    `/"messages"\s*:/`;
  - `sbom`: `/"bomFormat"\s*:\s*"CycloneDX"/i` and `/"components"\s*:/`;
  - `loadtest`: (`/"metrics"\s*:/` and `/"http_req_duration"/`) or (`/<testResults\b/i` and
    `/<(httpSample|sample)\b/i`);
  - `coverage`: (`/^SF:/m` and `/^end_of_record\s*$/m`) or (`/<coverage\b[^>]*\bline-rate\s*=/i` and
    `/<class\b[^>]*\bfilename\s*=/i`);
  - `junit`: `/<testsuite\b|<testcase\b/i`.

### 7.5 What resolves where: an example

From the example mission (`runward init --example`), `runward/execution-topology.md`, line 32:

```json
{"adr":null,"digest":"c4a99a24204033dd","line":32,
 "paths":[{"target":{"base":"project","real":"code/src/core/ports/routing.port.ts"},"token":"code/src/core/ports/routing.port.ts","unresolved":null}],
 "pointers":[{"kind":"file","line":null,"outsideManifestAt":null,"path":"code/src/core/ports/routing.port.ts",
   "raw":"file:code/src/core/ports/routing.port.ts#RoutingPort","report":null,"symbol":"RoutingPort","symbolAt":26,
   "symbolDeclared":true,"target":{"base":"project","real":"code/src/core/ports/routing.port.ts"},"unresolved":null}],
 "prose":[],"rule":"topology-port-placement-mapped","status":"applied"}
```

(Line breaks added for this page; the witness has none.) A checker re-checks: line 32 of the manifest
reads, as 9.4 splits it, `topology-port-placement-mapped` / `applied` / an evidence cell whose row digest
is `c4a99a24204033dd`; `code/src/core/ports/routing.port.ts` exists from the project root, is not a
symbolic link out of the project, and its real path is `<project>/code/src/core/ports/routing.port.ts`;
`files["code/src/core/ports/routing.port.ts"]` holds (its digest, non-empty, its line count, no report
nature); `RoutingPort` is present on line 26 (9.5) and on no earlier line; the cell's one `file:`
occurrence is covered (9.6).

A JUnit case, from `runward/floor.md` line 22 of the same mission:

```json
{"junit":[{"green":true,"line":8}],"kind":"test","path":"code/reports/junit.xml",
 "raw":"test:code/reports/junit.xml::\"guard: a fabricated account reference never routes — escalated to review\"",
 "target":{"base":"project","real":"code/reports/junit.xml"},"testAt":null,
 "testName":"guard: a fabricated account reference never routes — escalated to review","testNameDeclared":true,"unresolved":null}
```

An `adr:` pointer, from `runward/architecture.md`:

```json
{"adr":{"file":"runward/adr/ADR-0001-single-orchestrator.md","id":"ADR-0001","refusal":null,
 "sha256":"f81b70ac4db829224312a0fb6aacf3a048d4bbc193f61dfea717932eb695f017","status":"accepted"},
 "kind":"adr","malformed":null,"raw":"adr:0001"}
```

### 7.6 ADRs

`{ "id", "file", "sha256", "status", "refusal" }`: `id` as written (`ADR-0007`); `file` the project-
relative real path of the file the verdict found, or null; `sha256` its file digest, or null when it is
not a readable regular file; `status` its status word (below), or null when it was not read;
`refusal` null when the ADR can carry a decision, else the reason (English, not re-checked word for
word).

**Finding the file.** The journals, in order: `runward/adr/`, `docs/adr/`, `doc/adr/`, `adr/` (the last
three at the project root). In the first journal that exists **and** holds a match, the file is the
first entry, in directory order, whose upper-cased name starts with the upper-cased id and whose next
character is not a digit (`ADR-1` does not match `ADR-10-x.md`). A journal that exists without a match
is passed over. A checker re-checks that `file` is a match in that journal, that no earlier journal
holds a match, and, when the same journal holds several matches, reports the ambiguity rather than
choosing (the verdict took the first in directory order).

**Status word**: in the file's text, the first line matching `^\*\*Status\*\*\s*:\s*(.+)$`
(case-insensitive, multiline); its capture, trimmed and lowercased; then its leading run of the letters
`a`-`z` and `à`-`ÿ`. The empty string when there is no such line or no leading letter.

**Refusal** (`refusal` non-null), the first that applies: no file found; the file name is the scaffolded
template (it matches `^ADR-0+(?:-|\.md$)` case-insensitively, or, without its `.md`, matches
`^ADR-0+$`); it is not a regular file; it cannot be read; its trimmed text is shorter than 40 UTF-16
code units; its status word is `rejected`, `superseded`, `withdrawn` or `obsolete`; its status word is
`proposed`, `hypothesis`, `draft` or `pending`. A checker re-derives whether `refusal` is null.

### 7.7 `unratified`

The reconstructed decisions in `runward/adr/` (only that journal) the verdict refused, sorted by file:
`{ "file": "runward/adr/<name>", "reason": <string> }`. A checker re-derives the whole list (it is an
absence everywhere else): for each `.md` file of `runward/adr/`, in this order of tests, a name starting
`DRAFT-` (case-insensitive) is unratified unless its text has a line matching
`^\s*(?:\*\*status\*\*|status)\s*:\s*rejected\b` (case-insensitive, multiline); any other file is
unratified when its text has such a line with `hypothesis` instead of `rejected`, or else when it
matches `why\s*:\s*UNKNOWN\b` (case-insensitive). A file that cannot be read is skipped, except a
`DRAFT-` file, which is then unratified.

## 8. Causes, and what is not witnessed

### 8.1 `causes`

One entry per unit the verdict counted, `{ "family", "path", "rule", "kind", "problem" }`, in this
order: deliverables, gated manifests (in `gated` order, each in the order the verdict raised them),
corpus (`missing`, `edited`, `extra`, or one `corpus-unrecorded`), seal, unratified decisions (sorted by
path), regulated rows, charter, workflow contracts, hooks. `path` is the file the cause lands on (null
when it has none), `rule` the rule slug or null, `kind` a stable identifier or null, `problem` the
English sentence `check` prints (never compared word for word by a checker).

| `family` | Counts in | `kind` values | Witnessed? |
|---|---|---|---|
| `deliverable-state` | `gaps` | the state: `in-progress`, `untouched`, `missing` | `missing` only |
| `conformance` | `strictBreakdown.conformance` (+ `proposed`) | `proposed`, `missing-row`, `empty-status`, `invalid-status`, `applied-without-evidence`, `deviated-without-adr`, `na-without-reason`, `unknown-rule`, `duplicate-row`, `deliverable-missing`, `manifest-unreadable`, `mapping-floor`, `unresolved-pointer`, `evidence-placeholder`, `evidence-refused` | yes, but `evidence-refused` only in part (9.8) |
| `corpus` | `strictBreakdown.corpus` | `corpus-missing`, `corpus-edited`, `corpus-extra`, `corpus-unrecorded` | in part (7.2) |
| `seal` | `strictBreakdown.seal` | `seal-violation` | no |
| `unratified-decision` | `strictBreakdown.unratified` | `unratified-decision` | yes (7.7) |
| `regulated` | `strictBreakdown.unboundRows` | the unbound cause (`no-trace`, `changed`, …) | no |
| `charter` | `strictBreakdown.charter` | the charter gap kind | no |
| `workflow-contract` | `strictGaps` only | null | no |
| `hooks` | `hookFailed` | null | no |

**A refusal's witness is its failing facts**: the causes, and the facts of the rows and files they land
on, which the witness carries like those of a green run.

### 8.2 `notWitnessed`

The families of the verdict this version does not carry the facts of, each
`{ "family", "why", "causes" }`, `causes` being how many of this run's causes are of that family (0 for
a family that is not a cause family). In `runward-witness/1`: `deliverable-state`, `corpus-history`,
`signatures`, `report-natures`, `on-disk-spelling`, `scaffold-identical`, `unreadable`, `seal`,
`regulated`, `charter`, `workflow-contract`, `hooks`, `disclosures`. A checker that accepts a witness
says, beside its answer, that these were not re-checked; a cause of one of these families is reported
as **beyond the witness**, never as a fact that holds.

## 9. What a checker does

The order below is the recommended one; each step names what it **re-checks** (a fact the witness
states) and what it **re-derives** (an absence, from the tree alone). The checker exits 0 when every
step holds, 1 when a fact does not hold, an absence is not re-derived, or a disagreement of 9.8 is
found (and prints which), and refuses an unreadable witness or an unknown schema with a distinct code.

### 9.1 Schema and arithmetic

Re-check `witness`, then the arithmetic of 6.2. Re-derive `repository` (6.3).

### 9.2 Files

For each `files` entry: `<project>/<real>` exists; its real path equals the real path of the project
root joined with `real` (no symbolic link left in it); `within` is right and, for `repository`, the path
lies inside `repository`; `regular`, `sha256`, `nonEmpty`, `lines` and `natures` hold.

For each target in the witness (pointers and tokens): `base/path` exists, its real path is `real`, and
no earlier base resolves the path (each earlier base either has no such entry, or its entry's real path
lies outside that base and outside the repository root climbed from that base). For each `unresolved`:
`absolute` paths are absolute; `missing` paths exist from no base; `outside` paths exist from some base
and resolve from none.

### 9.3 Corpus and expected sets

Re-check `corpus` per 7.2. For each judged `gated` entry, re-derive `expected`: the slugs of the judged
corpus whose frontmatter `impact` is exactly `CRITICAL` or `HIGH` and whose `phases` contains the
entry's `phase`, sorted by code unit. Re-check `floor`.

### 9.4 Manifests, sections and rows

Re-check `present` and `sha256`. Re-derive `sections`, `problems` and `rows` from the manifest's
decoded text and compare them **exactly** (lists in order):

- **Fences.** A line matching `^\s*(```|~~~)` toggles a fence; it is itself fenced.
- **Sections.** A heading is an unfenced line matching `^#{1,6}\s`. A `Rule conformance` heading is an
  unfenced line matching `^#{1,6}\s+Rule conformance` (case-insensitive; `## Rule conformance and
  deviations` is one). `sections` lists their line numbers. With no such heading: no rows, no problems.
  With more than one: no rows, and one problem (the sentence starts with the number of sections).
- **The section** runs from the line after its heading to the line before the next heading; within it,
  fence lines and fenced lines are skipped (the fence toggles as above, restarting unfenced).
- **A row line** is a line of the section whose trimmed text starts with `|`. Its inner text is the
  trimmed line without its first character, and without its last character when that is `|`. The
  inner text is split on every `|` not preceded by `\`; in each cell, `\|` becomes `|`, every backtick
  is removed, and the cell is trimmed.
- With fewer than 3 cells, the line is skipped; it is a **problem** (one, starting `line <n>:`) unless
  its first cell matches `^:?-+:?$`, is empty, or is `rule` (case-insensitive).
- Otherwise `rule` is the first cell, `status` the second lowercased, and `evidence` the remaining
  cells joined with ` | `. The line is skipped when `rule` is `rule` (case-insensitive), matches
  `^:?-+:?$`, or matches `^\[.*\]$` (the template's own illustration). Every other line is a row.

For each row, re-check `line`, `rule`, `status` and `digest` against this reading. The checker's own
reading of the evidence cell is what 9.6 and 9.7 use.

### 9.5 Locations

- **Symbol present on a line** (`symbolAt`): when the symbol has identifier form
  (`^[A-Za-z_$][A-Za-z0-9_$]*$`), it is present on a line when it occurs there with neither
  `[A-Za-z0-9_$]` immediately before nor immediately after it; otherwise it is present when the line
  contains it as a substring. A declared quirk the checker reproduces: runward builds the identifier
  test as a regular expression from the symbol, so a `$` inside it reads as an end anchor and a symbol
  containing `$` is never present. Re-check that the symbol is present on `symbolAt` and on no earlier
  line, or on no line when `symbolAt` is null.
- **Report route.** A symbol is read through a report when the file's `natures` (re-checked in 9.2)
  contain, in this precedence, `sarif`, `eslint`, `sbom`, `loadtest` or `coverage`; `report.nature` is
  the first of them. Re-check the nature; the `result` is **not witnessed** (`report-natures`).
  Otherwise the symbol is read as text, `report` is null, and `symbolAt` applies. `junit` is not a
  symbol route.
- **Outside the manifest** (`outsideManifestAt`, when the target is the manifest itself): a line is
  outside the manifest unless it is a `Rule conformance` heading or lies between such a heading and the
  next heading (fences as in 9.4, a fence line itself counting as fenced for this purpose), or it is a
  **conformance-shaped line** anywhere in the file: its trimmed text contains `|`, and, with one leading
  and one trailing `|` removed and the rest split on every `|`, has at least 3 cells, whose second,
  trimmed and lowercased, is `applied`, `deviated`, `n/a`, or `proposed:` followed (after trimming) by
  one of those three; and the trimmed line starts with `|` or its first cell has no white space.
  Re-check that the symbol is a substring of line `outsideManifestAt`, that it is outside the manifest,
  and that no earlier outside line contains it.
- **JUnit cases** (`junit`): the test name selects `CLASS::NAME` when it contains `::` (the part before
  the first `::` is the class), else `NAME`. A case is an opening tag matching
  `<testcase\b[^>]*\bname\s*=\s*["']NAME["'][^>]*?(/?)>` (case-insensitive, NAME matched literally),
  whose tag text also matches `\bclassname\s*=\s*["']CLASS["']` when a class is given. It is **green**
  when the tag self-closes, or when the text from the end of the tag to the next `</testcase>`
  (matched case-sensitively; to the end of the file when there is none) contains none of `<failure`, `<error`, `<skipped` followed by a word boundary
  (case-insensitive). `line` is the line of the tag's `<`. Re-derive the full list and compare it in
  order: the absence of another matching case is part of the fact.
- **Test name as text** (`testAt`): the first line containing the name as a substring; re-check it and
  that no earlier line contains it.

### 9.6 The cover test (silent drops)

For each row whose status is `applied` or `proposed:applied` and whose evidence is not a placeholder
(7.3.1), let the **folded cell** be the evidence with every run of CR, LF, U+2028 and U+2029 replaced by
one space. Count the occurrences, in the folded cell, of

```
(?<![A-Za-z0-9_])(?:file|test|adr):\S
```

(ECMAScript, global). Count the same pattern in each of the row's `pointers[].raw` and `prose[]`
strings, and sum. The witness **covers the cell** when the cell's count is at most that sum; otherwise a
pointer spelling was dropped by the grammar without being disclosed (RWD-2026-0006, RWD-2026-0026), and
the checker refuses. The test is conservative: it never re-implements the grammar, and it refuses a
cell runward drops silently. It found one such defect before any checker existed: a pointer written
after another one in the same sentence, as in `test:r.xml::"a case" (file:x.ts#Y)`, is dropped by
runward 0.32.0 to 0.43.0 (RWD-2026-0165), so a checker written from this section refuses the witness
those versions write for runward's own mission, on two rows. That refusal is the test working. The
grammar now starts a pointer at every spelling this pattern counts, outside quotes (`adr:0007/file:x.ts`
reads two pointers), so on a witness written after the fix a cell the test refuses is a new defect.

### 9.7 Judging the witnessed scope

From the facts it re-checked, the checker re-derives the causes of the families it can judge, for each
judged gated entry (`judged: true`):

**Exact kinds.** In the `conformance` family, the checker re-derives the multiset of
`(path, rule, kind)` for every kind except `evidence-refused`:

1. Manifest absent: one `deliverable-missing` per expected rule, and nothing else (not even
   `mapping-floor`).
2. `mapping-floor` (rule `(mapping)`) when `expected` has fewer entries than `floor`.
3. One `manifest-unreadable` (rule `(manifest)`) per problem.
4. Over all rows: `unknown-rule` for each distinct rule that is not a slug of the judged corpus;
   `duplicate-row` for each distinct rule listed more than once (both can apply to one rule).
5. For each expected rule, its row (the **last** row listing it): none, `missing-row`; status
   `proposed:` + one of `applied`, `deviated`, `n/a` (trimmed), `proposed`; empty status,
   `empty-status`; any other status not in `applied`, `deviated`, `n/a`, `invalid-status`; `applied`
   with an empty evidence cell, `applied-without-evidence`; `deviated` whose `adr` is null or has a
   non-null `refusal`, `deviated-without-adr`; `n/a` whose trimmed evidence is shorter than 8 code
   units, or matches `^\[.*\]$`, or has fewer than 3 distinct code points once lowercased and stripped
   of white space, `na-without-reason`.
6. For **every** row whose status is exactly `applied` (expected or not):
   - placeholder evidence (7.3.1): one `evidence-placeholder`, and none of the pointer checks below;
   - otherwise one `unresolved-pointer` per `file:` or `test:` pointer whose `target` is null;
   - drift: when the raw evidence does not match `\b(?:file|test|adr):\S` and has at least one path
     token, and no token has a target: one `unresolved-pointer` for the row.
7. `proposed:applied` rows carry pointers and tokens, but their evidence problems are part of the
   `proposed` cause's sentence, never causes of their own.

The checker's multiset and the witness's causes of these kinds must be equal.

**The open kind, `evidence-refused`.** For each row whose status is exactly `applied` and whose
evidence is not a placeholder, the checker refuses the row when any of these holds (a pointer stops at
the first of its first five tests that applies):

- an `adr:` pointer with `malformed` non-null, or whose `adr.refusal` is non-null;
- a `file:` or `test:` pointer whose target is the manifest itself (`real` equals the real path of the
  entry's `path`), when it is a `test:` pointer, or a `file:` pointer whose symbol is null or whose
  `outsideManifestAt` is null; or whose target is, or is under, the real path of `runward/rules`
  (always that directory, whatever the corpus `source`);
- its target is not `regular`;
- its target's `nonEmpty` is false;
- `line` is greater than the target's `lines`;
- `symbolDeclared` and the symbol is null or shorter than 2 code units once trimmed; likewise
  `testNameDeclared` and the test name;
- a symbol read as text with `symbolAt` null;
- a `test:` pointer whose real path ends in `.md`, `.markdown`, `.txt`, `.rst`, `.adoc` or `.asciidoc`
  (case-insensitive): a document is not a test (and its test name is then not read);
- a test name with a `junit` list that is empty or has a case that is not green, or with `testAt` null;
- a path token that resolved to a regular file no typed pointer of the row resolved to, and that is
  the manifest itself or lies in `runward/rules`, or whose `nonEmpty` is false.

A row the checker refuses must carry at least one witness cause of the `conformance` family on that
`(path, rule)`. A row with an `evidence-refused` cause the checker does not refuse is **beyond the
witness** (a signature, a report result, a spelling, a scaffolded or unreadable file: section 8.2),
reported and not a disagreement.

### 9.8 Agreement

The witness **holds** when every fact re-checked in 9.1 to 9.5 holds, every absence re-derived in 9.2
to 9.6 holds, the exact multisets of 9.7 are equal, every row the checker refuses carries a cause, and
`unratified` equals its re-derivation. Under these conditions a `"clean"` verdict is one the checker
re-derived as clean over the witnessed scope, and a `"gaps"` verdict names, in `causes`, every refusal
the checker re-derived.

A **disagreement** is any of: a fact that does not hold; an absence the tree contradicts (an expected
rule, a section, a row or a pointer the witness left out); an exact-kind cause one side has and the
other does not; a row the checker refuses with no cause in the witness (a false green on runward's
side, the direction that matters most); an arithmetic identity of 6.2 that fails. The checker prints
which, and exits 1.

## 10. A refusal, worked

The attack corpus case AC-011 (`test/audit-corpus.js`, "a pointer that names nothing") on the example
mission: `runward/architecture.md` line 40 becomes
`| hexa-architecture | applied | file:src/a.ts# |`, and `src/a.ts` holds `export const x = 1;`.
`check --strict` exits 1; the witness carries:

```json
{"verdict":{"checked":5,"deferredGaps":0,"exitCode":1,"gaps":0,"hookFailed":0,"result":"gaps",
  "strictBreakdown":{"charter":0,"conformance":1,"corpus":0,"proposed":0,"seal":0,"unboundRows":0,"unratified":0},
  "strictGaps":1},
 "causes":[{"family":"conformance","kind":"evidence-refused","path":"runward/architecture.md",
  "problem":"typed pointer file:src/a.ts# — the `#` names nothing to look for (a symbol must be at least 2 characters); drop the `#` or name the symbol",
  "rule":"hexa-architecture"}]}
```

and, in `gated[0].rows`, the row at line 40 with the pointer
`{"kind":"file","raw":"file:src/a.ts#","symbol":null,"symbolDeclared":true,"symbolAt":null,…,"target":{"base":"project","real":"src/a.ts"}}`.
A checker re-checks the target and `files["src/a.ts"]`, re-derives the refusal (`symbolDeclared` with a
null symbol, 9.7), and finds it carried by the `conformance` cause on
`(runward/architecture.md, hexa-architecture)`: the witness holds. Had runward accepted the pointer
(the defect RWD-2026-0006 closed), the witness would read `"result":"clean"` with no cause, and the
checker, refusing the row from the same facts, would report a disagreement.

## 11. What this document does not specify

The checker's command line, its output format and its home (ADR-0089 decision 2: one file under
`checker/`, Node built-ins only, written by another session from this document); how runward's CI runs
it (step 5 of the record); the families of section 8.2, which a later version of this schema adds one
pull request at a time, each with its positive control (increment 2).
