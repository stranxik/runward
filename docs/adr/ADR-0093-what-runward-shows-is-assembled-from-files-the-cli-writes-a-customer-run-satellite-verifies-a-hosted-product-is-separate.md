# ADR-0093: What runward shows is assembled from files the CLI writes and never raises; a customer-run satellite verifies and displays; a hosted product is a separate product

**Date**: 2026-10-13 (revised the same day after two adversarial reviews)
**Status**: accepted (2026-10-13) — the maintainer accepted the umbrella architecture and its four
decisions, each as recommended: (1) two declared populations, the sample's unchanged and the
landings', with a published reconciliation; (2) the hosted product is a separate product, with its own
repository, record and licence, built in D6, while the customer-run satellite `runward-fleet` (MIT, no
editor key) stays; (3) a mission snapshot as an optional subject of each record, measured in D2 before
any public sentence on offline re-derivation; (4) OSCAL keeps `component-definition`. Constitutional,
class R under ADR-0088 decision 2: it names new reads against ADR-0054's crossings, adds a fourth git
reader, and amends ADR-0011, 0039, 0041, 0054, 0064, 0080, 0088, `docs/spec/runward-signing.md` and
`docs/spec/runward-oscal-mapping.md` by dated note, each note landing one delivery ahead of the code
that needs it. An agent wrote this record; the maintainer decided (ADR-0088 decision 4, applied to
decisions as to rows)
**Deciders**: the maintainer
**Method**: a French synthesis of three architecture studies, a forge-landscape note and a GitLab gap
analysis (all of 2026-10-13, outside this repository), revised against a doctrine review and a product
review whose findings were each checked on a fresh clone at `main@958d068` (runward 0.43.1):
`src/lib/attestation.ts` (`missionStateDigest`), `src/commands/verify.ts`, `src/commands/sample.ts`,
`src/lib/delegation-sample.ts` (`populationHash`), `src/commands/gate-hook.ts`,
`test/unit/runtime-boundary.test.js`, `eslint.security.config.js` (`SPAWN_ALLOWED`), the ADRs named
above, the signing, OSCAL mapping and witness specifications, and the actual output of
`check --strict --json`. Kosli's `attest custom` and `create attestation-type` reference pages were
read on 2026-10-13. Every week figure below is an estimate (plus or minus 30 %), not a measurement
**Relates to**: [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md),
[ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md),
[ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md),
[ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md),
[ADR-0064](ADR-0064-the-verdict-gets-a-report-an-auditor-reads-alone.md),
[ADR-0065](ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
[ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md),
[ADR-0092](ADR-0092-a-claims-layer-factual-sentences-are-tagged-typed-and-sealed-the-rest-is-said-unchecked.md);
the three D0 records it opens, [ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md),
[ADR-0095](ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md)
and [ADR-0096](ADR-0096-code-quality-and-junit-renderings-of-the-verdict-and-why-runward-gaps-are-not-filed-as-vulnerabilities.md),
all `proposed`

## Context

runward emits, for one instant, almost everything a steering committee, an auditor or a security
operations team asks about: `check --strict --json`, the witness, the unsigned attestation and
`verify`, SARIF, the HTML report, the OSCAL component definition. Missing are time (no verdict is kept
from one commit to the next), the population (the complete list of changes that landed in a period,
which an IT change-controls auditor starts from) and agent activity (`gate-hook` records only its
releases, in `runward/gate-bypass.log`).

The target is the full product: pull-request and merge-request summary, population export, period
report, event stream, organisation view, connectors, and a hosted offering with long history,
cross-repository search, alerts, role-based access and real-time agent activity. Zero human time by
default. Finished and demonstrable before any customer feedback. Never overclaim.

Four constraints shape it. runward is **self-sufficient**: it never assumes Kosli, GitHub, internet
access or any third-party tool; connectors are optional. **GitLab is first-class**, often self-managed
and possibly offline, at parity with GitHub; organisations are multi-forge. The **change request in the
ITSM** (ServiceNow, Jira Service Management) is the incumbent, so runward deposits evidence on it and
replaces nothing. The verdict path stays as ADR-0054 draws it.

A first draft of this record made four claims the code does not support:
1. `implemented: machine` by equality between a record's subject digest and the landed commit. Measured:
   `missionStateDigest` hashes `runward/` and the evidence files the manifests cite, nothing else; it is
   not a commit identity, and the record's commit fields are unsigned CI variables.
2. A vendor-operated multi-tenant service holding vendor-managed keys, called an ADR-0039 satellite.
   ADR-0039's amendment of 2026-08-24 says an adjacent product that makes runward operate a process, or
   whose aggregation is not the operator's, "is not a satellite: it is a different company's product".
3. "One population" shared with `sample draw`. Measured: `sample.ts` builds its population from
   `git log --first-parent --merges` by committer date, plus tags and ratification entries, with no
   patch id; `populationHash` is re-checked by `delegation-sample.ts`, which `verdict.ts` imports.
4. Offline re-performance of a row without the repository. Measured: `verify` re-derives the verdict
   from the current working tree.

This revision corrects all four and the major findings that came with them.

## Decision

**The MIT CLI writes files under versioned contracts and never raises a cell above `ci-declared`,
never signs, never verifies a signature and never reads a clock for a state. It reads git in exactly
one new module, `ledger`, outside the verdict path. A customer-run satellite, `runward-fleet`, verifies
signatures against the operator's trust policy, raises cells it can prove, and displays; it never
re-judges and is never the only copy. A vendor-operated hosted product, if built, is a separate
product under its own record, not a satellite, and nothing in the core depends on it.**

**The four questions put to the maintainer, and the answers (2026-10-13, each as recommended).**

| # | Question | Answer | Where it lives below |
|---|---|---|---|
| 1 | One population re-unified by a class R record, or two declared populations | two declared populations; the sample's stays unchanged in the verdict closure; the reconciliation is published | decision 4 |
| 2 | The hosted product as a separate product, built in D6 | yes: its own repository, record and licence; `runward-fleet` stays a MIT satellite and suffices alone | decision 10 |
| 3 | The mission snapshot as an optional subject of each record | yes, optional, measured in D2 before any public sentence on offline re-derivation | decisions 6 and 8 |
| 4 | OSCAL: keep `component-definition` or move to `assessment-results` | keep `component-definition`; reopen on a GRC tool that reads only assessment results | decision 9, the OSCAL amendment |

1. **The self-sufficient core.** Every function of the CLI and the static satellite works with no
   forge API, no network, no account and no third-party tool. A deliverable that needs a third-party
   tool is a connector and is never a prerequisite of another deliverable.

2. **The forge adapter boundary.** The verdict and the file renderings (SARIF, Code Quality JSON, a
   JUnit XML of the verdict, Markdown) are forge-neutral. Fact readers, posters and packaging are per
   forge and live in CI-step scripts outside the verdict's import closure, behind one port
   (`readChangeFacts`, `postSummary`, `setExternalStatus`, `identifyChange`) with documented closed
   behaviour. GitHub and GitLab ship at parity in every delivery; Azure DevOps and Bitbucket ship a
   pinned pipeline template and a summary poster. "Parity" describes what runward ships, never what a
   forge tier allows: on GitLab Free, approval independence is only detected after merge, and every
   surface says so.

3. **The ITSM deposit.** A CI step attaches a `runward-change-evidence/1` file (row, records,
   Markdown summary, HTML report, non-scope sentence, re-derivation command) to a ServiceNow change
   request or a Jira Service Management issue and adds a work note or comment. It never writes an
   approval state and never closes a request. The join key is a change-request identifier declared in
   the PR or MR description or a `Change-Request:` trailer; absent, the row reads
   `change_request: not-declared`. Offline, the file alone is the deposit.

4. **Two populations, declared.** The charter's sample population (ADR-0088 decision 6) is unchanged
   and stays in the verdict closure. The landing population, `runward-landing-population/1`, is new:
   every first-parent landing between two commits (merge, fast-forward, squash), each with `sha`,
   `parents`, `patch_id` and a declared forge change identifier. A published reconciliation lists every
   `merge` act of a sample period that is absent from the landing population of the same range, with
   its reason. They are not claimed to share a hash.

5. **`ledger`, the fourth git reader.** One module, fifth entry of `SPAWN_ALLOWED` after `hooks.ts`
   (which runs operator commands) and the three git readers `characterize.ts`, `doctor.ts`, `sample.ts`.
   - `ledger population` refuses a shallow clone, pins git configuration (`core.quotepath=false`,
     `diff.renames=false`, `core.abbrev=40`, diff attributes neutralised), passes `--no-ext-diff
     --no-textconv`, defines a merge's `patch_id` as `git patch-id --stable` over the diff between its
     first parent and itself, and writes the git version, the bounds, the list, its hash and the command
     that reproduces it.
   - `ledger replay` judges past trees of a commit range with today's runward, read-only from git, and
     writes records labelled `origin: replayed`, `judgedBy: runward@<version>`. It works on any
     repository on the day runward is installed, with no CI change. A replay never fills a verb.
   - `ledger record`, `ledger export`, `ledger verify` and `period` are pure functions of files.

6. **The contracts.** All borrow the canonical encoding of `docs/spec/witness.md` §3 and read an
   unknown value as `not-observed`; they borrow nothing else, and are not witnesses.
   - `runward.dev/record/v1` (unsigned in-toto statement): `origin` is `undetermined` for every record
     the CLI writes and `replayed` for a replay; repository, ref, `commit` and its `commitSource`,
     `run_id`, `run_attempt`, pipeline source; subjects: payload, witness, attestation and, opt-in, a
     mission snapshot (the exact files `missionStateDigest` hashes, at their paths); frozen tree facts:
     `gate-bypass.log` line count and digest, `wire_journal_last` (the last line of
     `adapters/installed.log`, declared, never "armed"), charter digest, `delegation.stage`, and the
     assurance mode and `degraded` flag copied from `check --json` (`not-observed` until ADR-0090
     surfaces them there; measured absent today); `implemented` at most `ci-declared`;
     `signatureVerified: false`.
   - `runward-change-row/1`: stable join keys for the customer's DORA metrics (landing commit, PR or MR
     identifier, landing date with its source, declared change request); every record of the landing
     with `run_id`, `run_attempt`, `origin` and signature presence (a missing earlier attempt is the
     finding `record-attempt-missing`); six verbs with `state`, `source`, `ref`; emergency; releases;
     replay kept apart; a `face` and a `provenance` block.
   - `runward-period/1`: bounds in commits, dates as labels; counts per verb and state, each with its
     denominator and the list it counts; findings with `class`, `impact` and an empty `entity_severity`,
     never combined; `effectiveness: not-assessed-by-runward`; `management_approval` empty; previous
     period by digest.
   - `runward-event/1`: `stream.{id,seq,prev}`, closed `type` list, `assurance: "declared"`, `hash`.
   - Cell states: `machine-established` (set by the satellite only), `ratified`, `ci-declared`,
     `declared`, `refused`, `no-record`, `not-observed`, `not-available`. The earlier name `machine` is
     dropped because it collides with ADR-0090's mode `machine`. Under that mode, zero ratification
     displays "machine mode in force", never a gap.
   - Emergency: a landing with no passing pre-merge record. A harness gate release is not an emergency
     change; it is shown as a release.
   - Prerequisite I0: the per-row ratification list and `causesByKind` in `check --json`, re-derived
     by `verify`. Additive, but it changes `check --json` and touches files on the charter's pre-merge
     paths, so it goes through the pre-approval path, not a delegated merge. Written `rows[]` in the
     studies; measured on `main@958d068`, `ratification.rows` is already the count of ratified rows
     (48 on runward's own mission), so the list takes another key, named in ADR-0095.

7. **The event stream.** Off unless `--events <file>` or `RUNWARD_EVENTS` is given. The path is
   refused when, symlinks resolved for the file and its parent, it lies in the verdict's read set or in
   the working tree. One file per stream id, created exclusively, then appended by the same writer,
   which reads only its last line. The side-channel test covers both import rings
   (`dist/commands/check.js`, `dist/commands/gate-hook.js`) and the five exit paths of `gate-hook`
   (misconfigured, no mission, clean, release, refusal): standard output and exit code byte-identical
   with and without the stream, and with a planted writer that throws. `events verify` detects interior
   deletions only; tail truncation is detected only once the head is shipped to a store the agent's
   credentials do not administer. Expected streams: one per `run_id` cited by records; harness
   sessions are not expected, and views say so. Prometheus textfile is a second output format of the
   same writer, declared outside the view rules (an operational signal, never evidence).
   `gen_ai.evaluation.result` is never produced, by the CLI or by a recipe.

8. **Integrity, honest per level and charter stage.** N0, unsigned, is the default and complete. N1,
   signature by the operator's CI identity, is opt-in. The CLI never verifies; the satellite verifies
   against the operator's `trust-policy.json`. The satellite raises `implemented` to
   `machine-established` only when the certificate's commit and ref claims equal the landing SHA and
   protected ref, and only when the trust policy pins `refs/heads/main` and the workflow file digest.
   Under ADR-0088 stage 1 every artifact is declared; in stage 2 CI-signed artifacts become evidence an
   agent cannot produce only under those pins (decision 1). End-of-turn events stay declared at every
   stage. The strongest public phrase is "unalterable after shipping to a store the agent's credentials
   do not administer". Without the tree, a third party performs offline inspection; re-derivation
   requires the tree at the cited commit or the mission snapshot. No reference to a strongest level of
   audit evidence is made.

9. **Connectors never make a customer tool say "compliant".** The GitHub check run is an option of the
   Action, carrying the gate's own exit code under the name "runward gate" with the non-scope. GitLab is
   one module with two modes: `step` (outbound external-control update) and `endpoint` (external status
   checks, served by the satellite container); it publishes the raw verdict, and the mapping to `pass`
   or `fail` is a policy file the customer writes; without it the module refuses to post. Kosli:
   `kosli attest custom` with a runward attestation type shipped with `--schema` only and no `--jq`
   rule; any rule is the customer's, and Kosli's compliance result is then Kosli's evaluation of the
   customer's rule; `attest decision --compliant` is not used. How Kosli displays a type with no rule
   is to be checked before the recipe ships. SIEM ingestion is a file and a tested Collector `filelog`
   recipe. OSCAL stays a `component-definition`.

10. **The satellite and the hosted product.** `runward-fleet` is a satellite under ADR-0039 as amended:
    its own repository, MIT, run in the operator's CI (static site) or installed by the customer as a
    signed OCI image with an SBOM and no outbound call (ingestion, append-only store, rebuildable index,
    alerts, RBAC, cross-repository search, real-time agent activity from the stream, the GitLab
    endpoint). It holds no vendor key, imports no runward module, reads no repository, invents no field
    and can be rebuilt from the customer's export. A vendor-operated multi-tenant hosted product with
    vendor-managed keys is **not** a satellite; it gets its own repository, its own record and its own
    licence, consumes the same exports, and the CLI knows neither its URL nor its existence.

11. **View rules.** Two display layers: a face (one sentence and `n / N` per state) and a provenance
    appendix (digest, signature state, date and its source, age, re-derivation command), tied by a
    golden test. Eighteen rules, each with a test a planted mutation reddens: no state computed by a
    view; face as a function of fields; states never summed, no composite percentage; gaps and silent
    repositories not filterable by default; silence is a finding; `replayed` never mixed with other
    origins; no cross-version comparison without a marker; no strong state carried by time; the CLI
    verifies no signature; `machine-established` only by the satellite under pinned policy; a
    repository cannot sign for another; management-body approval never set by software; the side
    channel never touches the verdict; machine mode shows "machine mode in force"; a harness release is
    never an emergency; bypass review is disclosure by default and strict only when opted in; join keys
    stable; no connector posts "compliant" or "pass" without the customer's rule.

12. **Build order, in deliveries, each ADR landing one delivery ahead of its code** (weeks are
    estimates):

    | Delivery | Content (GitLab woven in) | Weeks | Acceptance |
    |---|---|---|---|
    | D0 | this record; forge adapter boundary; per-row ratification contract; Code Quality and JUnit renderings; offline GitLab CE test bench | 1.5 | records `proposed`; bench starts with network off |
    | D1 | I0; `report --format md`; `--codequality`, `--junit`; Action summary and check-run option; GitLab component, catalogue and integrity-pinned file; MR note; docs, harness and charter sweep; per-tier enforcement guide; Azure and Bitbucket templates | 8.5 | byte-identical Markdown on both forges; every number a JSON path of the payload; install on offline GitLab CE |
    | D2 | `ledger population`, `replay`, `record` (N0 default, snapshot and signing opt-in), `export`, `verify`; ITSM deposit | 8 | shallow clone refused; replay fills no verb; deleted attempt surfaces; offline re-derivation from the snapshot measured |
    | D3 | `period` and HTML; bypass review; event writer, `events verify`, Prometheus format; SIEM recipes; GitLab audit recipes; Pages | 8 | byte-identical period; planted throwing writer leaves output identical; third-party checker agrees |
    | D4 | static `runward-fleet`; trust policy; signature verification; `machine-established` on GitHub and GitLab; cosign and `actions/attest` recipes, offline verification | 6 | rules in tests; no runward import; unpinned policy raises nothing |
    | D5 | satellite container; GitLab two-mode module; Kosli type; forge-neutral independence rule with GitHub and GitLab readers; Azure and Bitbucket posters | 10 | no outbound call; rebuilt from export; GitLab module refuses without policy |
    | D6 | hosted product, separate repository and record | 7 | tenant isolation; export replayed in a customer container gives the same site |

    About 49 agent-weeks in total, of which about 11 are GitLab parity spread over D0 to D5.

**Amendments, each by dated note, no accepted decision rewritten.**
- **ADR-0011.** Writing a file in a standard's format (JSONL, Prometheus textfile, SARIF, Code Quality,
  JUnit, OSCAL) is a gate output; embedding an SDK, opening a socket or pushing stays forbidden.
  runward's own decisions as events are distinct from the observability port of the delivered system.
  Conventions pinned by version on delivery.
- **ADR-0039.** `runward-fleet` is named as a voluntary satellite and its conditions become tests (no
  import of the runward package, no URL or upload flag in the CLI, run or installed by the operator,
  rebuildable from the export). The hosted product is recorded as outside the satellite definition.
- **ADR-0041.** By name: "runward never computes the change set" gains one exception, `ledger
  population` and `ledger replay`, outside the verdict path, read-only, shallow clones refused,
  configuration pinned. `rules` and `check` still take no base ref.
- **ADR-0054.** `ledger` joins the git readers outside the verdict path (crossing 4) and
  `SPAWN_ALLOWED`; the event writer's read of the last line of its own stream file (crossing 3) and of
  the harness payload (crossing 4) are named as permitted outside the verdict path; the boundary test
  asserts that neither module is in the verdict closure and runs the side-channel test in both rings.
  The fleet corollary loses "summoned only on a real demand signal", aligned with ADR-0039 as amended;
  "assembled from artifacts each repo already emitted" stands.
- **ADR-0064.** "Computes nothing" means derives no verdict: a grouping inside runward is permitted as
  a pure function of emitted fields, under a versioned contract, publishing the list it counts; it is
  forbidden in any view. The report family includes the Markdown summary and the period report. The
  sentence on GitLab ingesting SARIF is narrowed to Ultimate from 19.2, where findings are filed as
  vulnerabilities; Code Quality and JUnit are the recommended GitLab channels.
- **ADR-0080.** Part 2 becomes one forge-neutral pure rule with per-forge fact readers, GitHub and GitLab
  in the same delivery, replacing "GitLab when a user asks"; on GitLab Free it is a post-merge
  detection control and says so, on Premium and above the forge prevents and runward records.
- **ADR-0088.** Decision 6: the sample population is distinct from the landing population and keeps
  its construction; the reconciliation is published. Decision 1: a CI-signed artifact counts as
  evidence an agent cannot produce only when the trust policy pins `refs/heads/main` and the workflow
  file digest.
- **`docs/spec/runward-signing.md`.** By name: the CLI still never signs and never verifies; a
  verifying party (the satellite, an auditor) verifies against the operator's `trust-policy.json`, and
  the satellite alone may raise a cell on a verified certificate.
- **`docs/spec/runward-oscal-mapping.md`.** By name: the document stays a `component-definition`; the
  landing population and period report may be cited as back-matter resources by digest. An
  `assessment-results` output is not adopted (it would reverse §2 and require an `import-ap` assessment
  plan runward does not write).

**Where each note lands.** In D0, with this record: ADR-0011 (the file renderings only), ADR-0054 (its
stale fleet corollary), ADR-0064 (the report family and the SARIF sentence), and a pointer on ADR-0090
from ADR-0095. In D1, with the records for D2: ADR-0041, ADR-0088 decision 6 and the `ledger` crossing
of ADR-0054. In D2: the rest of ADR-0011, the event-stream crossings of ADR-0054 and the grouping
clause of ADR-0064. In D3: ADR-0039, ADR-0088 decision 1 and the signing specification. In D4: ADR-0080
and the OSCAL mapping specification. A note never rewrites an accepted decision.

**New records, and the delivery during which each lands** (numbers from ADR-0094 on are the ones
taken; the class of a `proposed` record is proposed in it and decided by the maintainer):

| Record | Class | Lands during | For |
|---|---|---|---|
| ADR-0093, this umbrella | R | D0 | all |
| ADR-0094, forge adapter boundary (port, closed behaviours, parity by tier) | R, proposed | D0 | D1 |
| ADR-0095, per-row ratification contract, `causesByKind`, assurance block | R proposed (studies: D, pre-approval path) | D0 | D1 |
| ADR-0096, Code Quality and JUnit renderings of the verdict, position on SARIF in GitLab | R proposed (studies: D) | D0 | D1 |
| Landing population and the `ledger` family (two populations, replay, record, snapshot) | R | D1 | D2 |
| ITSM change-request deposit | D | D1 | D2 |
| Event stream and its emission points | R (touches `check` and `gate-hook`) | D2 | D3 |
| Ex-post review of gate releases (disclosure by default, strict on opt-in) | R (the gate reads a new block) | D2 | D3 |
| Period report and the finding-class table | D | D2 | D3 |
| `runward-fleet` satellite, trust policy, cell raising | R (satellite conditions, signing spec) | D3 | D4 |
| Forge-neutral independence rule (ADR-0080 part 2) | R | D4 | D5 |
| Connectors (GitLab module modes, Kosli type, SIEM recipes) | D | D4 | D5 |
| Hosted product, in its own repository | its own register | D5 | D6 |

## Alternatives discarded

- **`implemented: machine` from digest equality or the merge queue in the CLI.** The digest does not
  identify a commit and the commit fields are unsigned; only a verified certificate binds the two.
- **The hosted product as a satellite.** Contradicts ADR-0039's definition and ADR-0054's invariant.
- **One population for the sample and the export.** Re-unifying would change a construction the
  verdict re-checks (class R on ADR-0088 decision 6) for no gain an auditor sees.
- **Signing as the default path.** It would make the first demo depend on key material; N0 is complete.
- **OTLP/JSON written by the CLI; `gen_ai.evaluation.result`.** The event hash is on native bytes; the
  evaluated object is a repository tree, not a model output.
- **A hash chain over records.** Parallel jobs race on the head; reconciliation against the landing
  population and the listing of every attempt detect what matters.
- **Kosli `attest decision --compliant`, or a pass/fail chosen by runward in GitLab.** Either makes a
  customer tool say "compliant" on runward's word.
- **OSCAL `assessment-results`.** Reverses the mapping spec and needs an assessment plan.
- **GitLab after GitHub.** The target segment's most likely primary forge would wait for a request it
  will never phrase in runward's terms.

## Consequences

- **Positive.** Every function works offline with no third-party tool; the auditor gets a landing
  population with its reproduction command; the change manager finds the evidence on the change
  request; the security team gets an append-only line; the organisation view never states more than
  it verified. The verdict path is untouched except by I0 (additive, pre-approved) and the ex-post
  review record, argued separately.
- **Negative, accepted.** Six contracts to keep in step, each expand-only; a fourth git reader; two
  populations to explain; a second repository to govern, and a third if the hosted product is built;
  several cells read `not-observed` or `ci-declared` for a long time and say so; GitLab Free users get
  detection, not prevention, of approval independence.
- **Words.** "machine-established" (satellite, pinned policy), "declared", "ci-declared", "unalterable
  after shipping to a store the agent's credentials do not administer". Never "certified", "compliant"
  or "guaranteed".

## What would settle it

- **Side channel**: in both rings and on the five `gate-hook` exits, output and exit code identical with
  and without the stream and with a throwing writer; a planted import of `ledger` or the event module
  into the verdict closure reddens `runtime-boundary.test.js`.
- **Population**: the same landing population on two clones; a shallow clone refused; the published
  reconciliation with the sample population empty or explained on runward's own history.
- **Cell raising**: a record whose certificate names another commit is never raised; an unpinned trust
  policy raises nothing.
- **Offline**: a third party re-derives a row from the mission snapshot with no repository, measured on
  runward's own mission; without the snapshot the page says "inspection only".
- **Connectors**: no connector posts "pass" or "compliant" without a customer rule file (test).
- **Self-sufficiency**: the full D1 to D4 demonstration runs on an offline GitLab CE instance.
- **Reader**: an auditor briefed on IT change controls draws a row and re-performs it from the snapshot;
  a committee reader answers from the period page alone what is blocking at close.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-01-13, or earlier on: an assessor rejecting the landing as population unit; a pipeline
that can only read OTLP/JSON; an OpenTelemetry convention for control decisions reaching Release
Candidate; a GRC tool that only reads OSCAL assessment results; the satellite found holding a vendor
key or reading a repository; ADR-0088 stage 2 holding; the ADR-0054 re-evaluation of 2026-11-05
concluding otherwise on a crossing named here.

**Trigger set on**: 2026-10-13 · **Watched via**: `runtime-boundary.test.js`, the satellite's closure
and golden tests, the claims guard on rendered HTML, the offline GitLab CE bench.

## References

- ADR-0011, 0021, 0039 (amendment of 2026-08-24), 0041, 0054, 0064, 0065, 0080, 0088 (decisions 1, 2, 4,
  6), 0089, 0090, 0092; `docs/spec/witness.md` §3; `docs/spec/runward-signing.md` (invariant, §3);
  `docs/spec/runward-oscal-mapping.md` §2; `src/lib/attestation.ts`, `src/commands/verify.ts`,
  `src/commands/sample.ts`, `src/lib/delegation-sample.ts`, `src/commands/gate-hook.ts`,
  `eslint.security.config.js`, `test/unit/runtime-boundary.test.js`.
- Regulation (EU) 2022/2554 art. 9(4)(e); Delegated Regulation (EU) 2024/1774 art. 12, 17, 27.
- GitLab documentation on CI/CD components, merge request approvals, external controls and status
  checks, Code Quality, `id_tokens` and Sigstore signing; Kosli `attest custom` and
  `create attestation-type` (read 2026-10-13).
- The French studies of 2026-10-13, outside this repository.
