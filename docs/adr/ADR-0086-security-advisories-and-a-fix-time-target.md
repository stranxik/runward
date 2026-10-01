# ADR-0086 — Security advisories by criterion, and a fix-time target one maintainer can keep

**Date**: 2026-10-01
**Status**: proposed — criteria, retroactive list and target are a recommendation; the maintainer decides
**Deciders**: the maintainer
**Method**: `SECURITY.md`, `docs/compliance/known-defects.md` (register date 2026-09-30, 163 entries),
`runward/governance/threat-model.md` §1 and ADR-0084 read on the branch of this ADR; GitHub's
documentation on repository security advisories and OpenSpec's `SECURITY.md` read at the source on
2026-10-01 and quoted below; the npm registry's version list and publication times for `runward` and
the repository's published advisories read the same day
**Relates to**: [ADR-0084](ADR-0084-security-intake-leaves-one-inbox-the-judgement-stays-human.md)
(the intake; this ADR is what happens after it),
[ADR-0068](ADR-0068-one-maintained-minor-and-a-dated-release-train.md) (the supported lines),
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) (a false green is the defect runward
exists to refuse)

## Context

**The promise.** `SECURITY.md`: "**Acknowledgement**: within 7 days of the report." "**Coordinated
disclosure**: the report stays private until a fix is released; the advisory is published with the
fix." "**No fix deadline is promised.** The project has one maintainer and has not set a time to fix; it
depends on the defect." And, on the supported lines: "Security fixes are exempt from the feature
release train: they ship when ready, to both supported lines." The table lists 0.42.x as maintained and
0.37.x to 0.41.x as "security fixes only", until dates between 2027-03-07 and 2027-03-24.

**What exists.** `gh api "repos/stranxik/runward/security-advisories?state=published"` returns 0
advisories (2026-10-01). The register holds 163 entries, each with a `class` and an `effect`; the
classes include `wrong-verdict`, `undue-refusal`, `unguarded`, `machine-surface`, `wrong-guidance` and
the claim class, and the effects include `exit-code`, `message`, `text-only` and `resource`. Nothing in
the register says which entries are security-relevant, and nothing in `SECURITY.md` says what makes a
defect a vulnerability. The threat model's first table does name the adversary that matters here, on
the row for "The operator's mission files": "untrusted input to the gate", threat "a manifest crafted
to pass without the underlying work existing".

**What the supported lines received.** The npm registry lists, from 0.37 on: 0.37.0, 0.37.1, 0.38.0,
0.39.0, 0.40.0, 0.41.0, 0.42.0, 0.42.1, 0.42.2, 0.42.3. No line older than the maintained one has had a
release since its own minor shipped. So every fix since 0.38.0 reached only the newest line. Whether any
of those fixes was owed to an older line depends on a classification that has never been made; this
ADR makes it, and the obligation follows from it.

**What GitHub provides, read at the source (2026-10-01).** *Repository security advisories*
(docs.github.com, concepts page): a maintainer can "Create a draft security advisory, and use the draft
to privately discuss the impact", and "Privately collaborate to fix the vulnerability in a temporary
private fork". On CVEs: "GitHub is a CVE Numbering Authority (CNA) and is authorized to assign CVE
identification numbers." "GitHub usually reviews the request within 72 hours. Requesting a CVE
identification number doesn't make your security advisory public." On publication: "GitHub will review
each published security advisory, add it to the GitHub Advisory Database, and may use the security
advisory to send Dependabot alerts to affected repositories." "Whenever possible, you should **add a
fix version to a security advisory prior to publishing the advisory**. If you don't, the advisory will
be published without a fixed version, and Dependabot will alert your users about the issue, without
offering any safe version to update to." On credits (*Creating a repository security advisory*): "You
can credit people who helped discover, report, or fix a security vulnerability. If you credit someone,
they can choose to accept or decline credit."

**How a comparable project words a fix target.** OpenSpec's `SECURITY.md`
(github.com/Fission-AI/OpenSpec/blob/main/SECURITY.md, read 2026-10-01): "We aim to acknowledge within 3
business days and to ship a fix or a decision within 30 days. Valid reports are credited in the
advisory unless you'd rather stay anonymous."

**How fast past fixes shipped, measured.** For the entries listed under "Retroactive candidates", the
time from the measurement date written in the entry to the npm publication of the first version past
the entry's `affected` range runs from under one day (RWD-2026-0117: measured on 0.42.1, fixed in 0.42.2
the same day) to seven days (RWD-2026-0113 and -0114: measured 2026-09-12, 0.41.0 published 2026-09-19).
Those were self-found, with no reporter to coordinate and no backport; they say what a fix costs on the
maintained line, not what a reported, backported fix would cost.

## Decision

**1. An entry warrants a published advisory when it shipped in a version on npm and meets one of four
criteria.**

- **S1, verdict bypass.** Content an adopter's repository can hold (mission files, the lock, the rule
  copies, committed reports, the hook configuration) turns a verdict that should be red into green:
  `check` exits 0 where it should exit 1, or `verify` answers verified on an attestation that does not
  describe the tree. This is the threat the threat model names for mission files.
- **S2, an unasked effect on files.** The CLI writes, removes or reads a file the invocation did not ask
  for: outside the project root, against `--dry-run`, under a help text that says read-only, or on a
  path other than the one named.
- **S3, a human act recorded that the human did not make.** The CLI records a ratification or a decision
  under the operator's name that the operator did not give.
- **S4, no verdict by crafted input.** Content an adopter's repository can hold makes the gate run
  without bound, so no verdict is rendered.

**Not advised** (the register stays their record): undue refusals (the gate fails closed); entries
whose effect is `message` or `text-only` (a wrong sentence, a wrong guidance); `machine-surface` entries
that never moved an exit code; `unguarded` mechanisms that behaved correctly in every release;
measurements; declared limits with no fix (RWD-2026-0022, -0028), which belong to the non-scope and the
register, not to an advisory with no patched version.

**2. Each advisory names its register entry, and the register names its advisory.** One advisory per
entry, with the affected range from the entry, the patched version, the workaround the entry already
gives, and the credit `found-by` supports (a reporter through the form, or none for a self-found entry).
CVE requested through GitHub for S1 and S2 (scanners outside GitHub read CVEs), left to the maintainer
for S3 and S4. The register gains an `advisory` field (a GHSA identifier, or `none` with the criterion
it fails); that is a change to the register's guarded vocabulary, made in its own pull request.

**3. A security classification carries the backport, or says plainly that there is none.**
`SECURITY.md` promises security fixes to every supported line. Two ways to keep that honest, and the
maintainer chooses:

- **(a) Backport.** Each advised fix ships as a patch on every supported line it affects. Each patch
  release runs the whole release chain, the hours-long mutation ratchet included.
- **(b) The maintained line, said so.** A fix that does not apply cleanly to an older line ships on the
  maintained line only, the advisory lists the older line's range with the maintained version as the
  first patched one, and `SECURITY.md` says, beside the table, that this happens and that the advisory
  says it. This changes a published sentence of `SECURITY.md` ("to both supported lines") and is decided
  as such, never applied silently.

**Recommendation: (b) for the retroactive list, (a) going forward when the fix applies to the older
line without rework.** Twelve backports onto five lines, for fixes written against 0.42's code, is a
cost one maintainer will not pay on time; an advisory that tells the truth about the line is worth more
than a promise that quietly lapses.

**4. Retroactive advisories: only where an adopter on a supported line can still be affected.** An
entry meeting S1 to S4 whose whole affected range lies at or below 0.36.x (no longer supported) gets no
advisory; the register is its record. Among them are RWD-2026-0001 to -0009, -0021, -0046 to -0048,
-0051 and -0070. An entry whose range reaches 0.37.0 or later is a candidate.

**Retroactive candidates, measured from the register (affected range as the entry states it; patched
version = the next version published on npm).**

| id | Criterion | One line | Affected | Patched | Recommend |
|---|---|---|---|---|---|
| RWD-2026-0095 | S1 | `verify` answered verified on an attestation whose deliverables, conformance and horizon tables were invented | 0.35.0 to 0.37.1 | 0.38.0 | yes |
| RWD-2026-0107 | S1 | `manifest --sync` alone turned an untouched deliverable into a filled one, no human line written | 0.35.0 to 0.39.0 | 0.40.0 | yes |
| RWD-2026-0113 | S1 | a stale committed JUnit report kept a renamed test green under `check --strict` | 0.40.0 | 0.41.0 | yes |
| RWD-2026-0115 | S1 | renaming the `Rule conformance` heading reopened RWD-2026-0107 | 0.40.0 | 0.41.0 | yes |
| RWD-2026-0117 | S1 | a shipped rule weakened and its lock line re-signed passed the strict gate | 0.33.1 to 0.42.1 | 0.42.2 | yes |
| RWD-2026-0124 | S3 | `ratify --all` ratified, under the operator's name, a sampled row the operator had skipped | 0.38.0 to 0.42.2 | 0.42.3 | yes |
| RWD-2026-0127 | S2, S3 | `--dry-run ratify` rewrote rows and appended a `mode: BLIND` entry | 0.38.0 to 0.42.2 | 0.42.3 | yes |
| RWD-2026-0134 | S1 | under `check --hooks`, a malformed `hooks.json` ran no hook and the gate came out green | 0.8.0 to 0.42.2 | 0.42.3 | yes |
| RWD-2026-0139 | S2 | `report -o` removed then overwrote any file it was pointed at, and wrote outside the project with `../` | 0.39.0 to 0.42.2 | 0.42.3 | yes |
| RWD-2026-0140 | S2 | `--dry-run report` wrote the report and removed the previous one | 0.39.0 to 0.42.2 | 0.42.3 | yes, low severity |
| RWD-2026-0141 | S2 | `characterize --mine`, described as read-only, wrote DRAFT ADRs into a governed mission | 0.10.0 to 0.42.2 | 0.42.3 | yes, low severity |
| RWD-2026-0144 | S1 | `check --strict` accepted runward's own blank `AGENTS.md` template as the finalized charter | 0.39.0 to 0.42.2 | 0.42.3 | yes |
| RWD-2026-0114 | S4? | the ReDoS screen was quadratic in its input | through 0.40.0 | 0.41.0 | no: the entry records a cost, not a verdict that never came |
| RWD-2026-0120 | none | readiness packs printed "clean" while `check` exited 1; `verify` refused an honest attestation | through 0.42.2 | 0.42.3 | no: every exit code an automation reads was red; the packs' sentence is text |

Every recommended entry is fixed in 0.42.3, the version an adopter is told to move to.

**5. A fix-time target, as an aim.** Proposed wording for `SECURITY.md`, replacing "No fix deadline is
promised":

> **Fix or decision**: we aim to ship a fix, or to publish a decision, within 30 days of the report. A
> decision is a documented workaround, a reasoned "not a vulnerability", or a dated plan. This is an
> aim of a single maintainer, not a contractual deadline. If it is missed, the reporter is told before
> day 30, in the advisory, with the reason and a new date.

The same aim applies to a defect the maintainer finds himself when it meets S1 to S4, counted from the
entry's measurement date. **A missed aim is recorded**: one line in the advisory (or the register entry)
saying it was missed and by how many days. Two missed aims in a row reopen this decision.

## Alternatives discarded

- **Advise every `wrong-verdict` with effect `exit-code`.** Mechanical and easy to audit, but it would
  advise undue refusals the class also holds (RWD-2026-0017, -0020: the gate refused honest work), which
  fail closed and endanger no adopter, and it would miss S2 and S3, whose class is not `wrong-verdict`
  (RWD-2026-0127, -0139, -0141). The class says what the gate did wrong; the criteria say who is exposed.
- **No retroactive advisories, criteria from now on only.** Cheapest, and it leaves adopters on 0.37.x
  to 0.42.2 with no Dependabot alert for twelve defects the register already describes in public. The
  facts are published; only the channel that reaches a dependency scanner is missing.
- **Retroactive advisories for every entry meeting S1 to S4, unsupported lines included.** An advisory
  on a line nobody supports tells its users to upgrade, which the support table already tells them.
  More advisories, and no new information in any of them.
- **A fix deadline, not an aim.** One maintainer, no deputy (ADR-0084's premise): a deadline he cannot
  meet when away is a promise that will be broken, and a broken security promise costs more than an
  honest aim. The ROADMAP's silver badge criterion `access_continuity` is the same constraint seen from
  another side.
- **A shorter aim (7 or 14 days).** The measured self-found fixes took zero to seven days, which
  suggests it is possible on the maintained line; it does not cover a reporter's coordination or a
  backport. 30 days matches the wording a comparable project chose and leaves room for (a).

## Consequences

- **Positive.** A reader knows what runward treats as a vulnerability, and an adopter's dependency
  scanner learns of the twelve defects that could still reach a supported line. `SECURITY.md` stops
  promising nothing about time and promises something it can keep.
- **Negative, accepted.** Twelve advisory forms to write, each tied to its register entry; possibly
  twelve CVE requests. Option (b) narrows a published sentence of `SECURITY.md`, and saying so is part of
  the change. Every future S1 to S4 entry costs an advisory, and the 30-day aim adds a clock to the
  adversarial audits that find most of them (110 of 163 entries were found that way).
- **On the documents.** `SECURITY.md` (the criteria in one paragraph, the aim, and option (a) or (b));
  the register's `advisory` field and its test; `ROADMAP.md`'s two "Security handling" items move once
  the advisories are published. No change to the CLI, the gate or the mission.

## What would settle it

- **For the criteria**: the maintainer reads the twelve recommended entries and the two refused ones
  against S1 to S4; any entry he would class otherwise names a criterion that is wrong, and the
  criterion is corrected before any advisory is published.
- **For (a) or (b)**: one recommended fix (RWD-2026-0134, the smallest: one `catch`) backported to
  0.41.x and run through the release chain. If it takes under a day including the ratchet, (a) is
  affordable and becomes the default; if not, (b) is what the project can keep.
- **For the advisory channel**: one advisory published end to end (draft, CVE request, publication),
  then `npm audit` run on a project pinned to an affected version shows it. Until that is seen, an
  advisory reaching scanners is GitHub's description, not runward's measurement.
- **For the aim**: the first reported vulnerability handled under it, and the time from report to fix or
  decision recorded in the advisory.

## Reevaluation trigger (mandatory, dated)

Reopen at the first missed aim followed by a second; when the project gains a second maintainer or a
security manager (the single-person premise changes); when GitHub changes how repository advisories
feed the Advisory Database or Dependabot; when a supported line's window is extended or shortened; or
when an entry is filed that the criteria cannot place.

**Trigger set on**: 2026-10-01 · **Watched via**: the defect register (each new entry is read against
S1 to S4 when it is filed), the repository's published advisories at each release's runbook step 2,
and `SECURITY.md`'s table at each minor.

## References

- `SECURITY.md`; `docs/compliance/known-defects.md`; `runward/governance/threat-model.md` §1;
  `ROADMAP.md` ("Security handling, as the mature projects do it").
- GitHub Docs, read 2026-10-01: *Repository security advisories*; *Creating a repository security
  advisory* (credits); *Publishing a repository security advisory*; *Editing a repository security
  advisory*.
- OpenSpec, `SECURITY.md`, github.com/Fission-AI/OpenSpec/blob/main/SECURITY.md, read 2026-10-01.
- npm registry, `npm view runward versions` and `npm view runward time`, read 2026-10-01.
