# ADR-0083 — Exit code 2 carries several meanings: say which, before splitting it

**Date**: 2026-09-28
**Status**: accepted 2026-09-28 — option A, chosen by the maintainer: keep 2 for every current case, make the class legible; doctor's critical exit stays 2 and is written into the port contract
**Deciders**: the maintainer
**Method**: every `process.exit(2)`, `exitCode: 2` and Commander misuse path in `src/` read on the
branch of this ADR (base `main` at 0.42.2), and the cases below re-run on the built CLI on 2026-09-28
against a copy of the audit's red mission and an empty directory
**Relates to**: [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) (the gate is a port,
the exit code is its contract), [ADR-0030](ADR-0030-the-machine-surface-is-a-contract.md) (additive only),
`runward/contracts/port-contract.md` (the published table)

## Context

**What the contract says.** `runward/contracts/port-contract.md` publishes three values: `0` clean,
`1` gaps, `2` "no mission found, or CLI misuse (unknown command/flag) — configuration error, distinct
from a gate failure by design, so a typo never reads as gate red", and adds "Exit code 2 is reserved
for 'the question could not be asked'; a red gate is always 1". The samples runward ships say less:
`action.yml`, the four CI and pre-commit adapters, `packaging/README.md` and the Kiro `POWER.md` read
"0 clean · 1 gaps · 2 no mission found".

**What the code does.** The CLI audit of 2026-09-27 (04#18) found `2` returned for a typo, a refused
gesture and a refusal to a harness alike, so a script that applies the samples' table concludes "no
mission" on each of them. Measured 2026-09-28, grouped by what the reader should do next:

| Class | Command and case | Message (first words) | JSON form |
|---|---|---|---|
| **No mission** | `check`, `status`, `report`, `propose`, `ratify`, `manifest`, `compliance`, `update`, `wire` outside a mission | "No runward/ mission found here or above. Run `runward init` first." | `check --json`: `{"verdict":"no-mission","exitCode":2}`; `verify --json`: `reason: "no-mission"` |
| **Usage error** | any unknown command or option (`runward bogus`, `check --bogus`, `status --json`), a missing argument (`bundle`, `spec-check`), an invalid choice (`check --through topology`) — Commander, mapped in `src/cli.ts` (`MISUSE`) | "error: unknown option '--bogus'" | none |
| | flag combinations `check` refuses (`--json --sarif`, `--through` with `--freeze`, `--vsa` without `--resource-uri`) | "--json and --sarif each write a different document…" | none |
| | values a command refuses: `rules --phase Govern`, `explain <unknown>`, `rules --for /abs`, `compliance` without or with an unknown regime, `report --out` outside the project or on a directory, `update --corpus` not a directory, `bundle` artifact missing or outside the project, `characterize` on no directory, `ratify --by ""`, `ratify --accept` without `--agent` | "Unknown phase "Govern" — the gated phases are: …" | none |
| | inputs `verify` and `spec-check` cannot read (file absent, not JSON, not in-toto, not runward) | "Attestation not found: …" | `verify --json`: `{"verified":false,"reason":"attestation-not-found",…,"exitCode":2}`; `spec-check --json`: a `verdict` string |
| **Refused gesture** | `ratify` without a terminal; `ratify --agent` preflight (missing `--for`, `--by`/`--all`/`--attest-blind` beside it, no `--accept`, an unlisted or self-proposed row); `wire --install`/`--uninstall` under an agent signal or without a terminal; `wire --install` with no native target, an unreadable target, a failed read-back probe; `characterize --mine` on a governed mission; `report` refusing to overwrite a non-report file | "refusing to ratify without a terminal — …" | none |
| **Health** | `doctor` with at least one critical issue | "N critical issue(s), M warning(s)" | none |
| **Harness protocol** | `gate-hook --harness claude` or `junie` on a red tree: exit 2 is the harness's own "block, show stderr to the model" | the named refusal | not runward's port: the harness reads it |

Two rows are not "the question could not be asked": `doctor` answers the question and reports a bad
answer with the configuration code, and `gate-hook` speaks its harness's protocol, where 2 means
block. Every other row is a configuration or invocation fault, as the port contract says, but the
samples name only the first class.

**What a consumer can tell apart today.** Only `check --json` (`verdict: "no-mission"`), `verify
--json` (`reason`) and `spec-check --json` (`verdict`) say which case produced the 2. Everywhere else
the class lives in the English of stderr.

## Decision

**Keep 2 for every current case, and make the class legible instead of splitting the code.**

1. **The samples say what the port contract says.** Every shipped sample that prints the table
   (`action.yml`, `templates/adapters/*`, `packaging/README.md`, `packaging/kiro/POWER.md`) reads
   "2 no mission, a usage error or a refused gesture: the question could not be asked, never a red
   gate". A text change, no behaviour change.
2. **Each 2 names its class for a machine, additively.** Where a command has a `--json` form, its
   error document carries a stable `error` field (`no-mission | usage | refused | unreadable-input`)
   beside the existing `verdict`/`reason`, which keep their values (ADR-0030). Without `--json`,
   stderr keeps its sentences.
3. **The two rows that are not configuration faults are named as such.** `doctor`'s exit 2 on a
   critical issue is written into the port contract as the one health exit that reuses the code;
   `gate-hook`'s exit 2 is documented as the
   harness's protocol, outside the port.

## Alternatives discarded

- **Distinct codes with a compatibility period** (`64` usage, following `sysexits.h` `EX_USAGE`;
  `77` refused, `EX_NOPERM`; `2` kept for no mission): opt-in first (`RUNWARD_EXIT_CODES=2`), default at
  the next minor, the old mapping documented for a supported-version window (ADR-0068). It is the
  cleanest end state, and it is discarded *for now* because every consumer in the tree and in the
  samples branches on `!= 0` or on `== 1` only; none has been found that branches on 2, so the cost
  (every CI adapter, every harness sample, the ADR-0012 port table, a migration window) buys nothing
  measured yet. It stays the next step if option A's trigger fires.
- **Split only the refusals** (a refused TTY or agent gesture gets its own code, the rest stays 2):
  it fixes the one case an agent is most likely to misread, and leaves the usage/no-mission conflation
  the audit also names; a partial taxonomy is a second vocabulary to learn.
- **Keep everything as is and change nothing**: the samples keep contradicting the port contract they
  claim to quote, which is how the audit's reader concluded "no mission" on a typo.

## Consequences

- **Positive.** No consumer breaks: every exit code keeps its value. A script can tell a typo from a
  missing mission by reading one JSON field instead of parsing English, and the samples stop
  promising less than the code does.
- **Negative, accepted.** A consumer that reads only the exit code still cannot tell the classes
  apart; that is the price of not moving a code that CIs read blind.
- **Found while implementing (2026-09-28).** One shipped sample did act on 2: the BMAD review-layer
  instruction (`templates/adapters/bmad-review-layer.toml`) told its agent "exit 2 → no runward/
  mission here; skip this layer", so a typo or a refused gesture skipped the layer. It is runward's
  own sample, not an external consumer, and its text now says what 2 means (RWD-2026-0157); the
  search of external workflows that "What would settle it" names has not been run.
- **On other boundaries.** Nothing touches the verdict path (ADR-0054): the classes are assigned where
  each command already exits.

## What would settle it

- **For A**: the maintainer's reading of the table above, and a search of public workflows and
  harness configs that call `runward` for any that branch on exit 2 specifically. None found would
  confirm A; one found that treats 2 as "no mission" and acts on it (skips the gate, for instance)
  would argue for B.
- **For B**: a consumer, or a harness, that needs to act differently on a usage error and on a
  missing mission from the exit code alone, without `--json`.

## Reevaluation trigger (mandatory, dated)

Reopen when a consumer reports acting on exit 2 as "no mission" when it was a usage error or a
refusal, when a harness assigns a meaning of its own to 64 or 77, or when a new command adds a
fifth class of 2.

**Trigger set on**: 2026-09-28 · **Watched via**: issues and the defect register (`found-by` any)
mentioning an exit code; each new `process.exit(2)` in review.

## References

- The CLI audit of 2026-09-27, finding 04#18 (exit 2 overloaded).
- `runward/contracts/port-contract.md`, "Exit codes — the load-bearing contract" and "Errors".
- `src/cli.ts` (`MISUSE`, `onCommanderExit`), `src/commands/*` (each `process.exit(2)`).
- `sysexits.h` (BSD): `EX_USAGE` 64, `EX_NOPERM` 77.
