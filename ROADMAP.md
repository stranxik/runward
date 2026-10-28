# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-10-28 (v0.46.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

### Assurance modes: the work order of ADR-0090 (accepted 2026-10-12)

[ADR-0090](docs/adr/ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md) makes the assurance of delegated acts a choice per mission
(`machine`, `machine+critical`, `sampled`, `per-act`) and fixes a machine floor (M1 to M8) a machine
mode is honest only on. runward's own mission moves to `machine+critical`, printed « degraded » until
M3, M4, M6, M7 and M8 are in force. In order, each in its own pull request:

- **M6, after merge.** The parity test and the documented-commands job are built (shipped in
  0.44.0). Ahead: whether the job becomes a required check (the maintainer's setting), and its
  weekly runs read for flakes from the forge before anyone treats a red as the guide's fault. Steps 1,
  4, 5 and 6 of the guide are not executed by any job: item 1 below.
- **M3, after merge.** The net-shrink guard is built (shipped in 0.44.0). Ahead, each the
  maintainer's setting: `net shrink` and the coverage job `coverage does not go down` made required
  checks, and the `net-shrink-acknowledged` label created. The guard reads names and counts, not
  meaning: a weakened body that keeps its assertion calls passes it.

Next, in this order (the maintainer's work order after M3, 2026-10-13):

1. **Execute Steps 1, 4, 5 and 6 of the verification guide.** The documented-commands job runs Steps
   0, 2, 2c, 3, 7 and 8 and declares the other four not executed, each with its reason
   (`scripts/documented-commands.mjs`): Step 1's expected counts describe a project's whole tree, Step
   4 needs a pinned cosign installer, Step 5 has no pass or fail as written, Step 6's input is a CI
   artifact kept 90 days. Each gets an executed check with a positive control, or its sentence is
   rewritten to say what can be checked.
2. **The claims layer, [ADR-0092](docs/adr/ADR-0092-a-claims-layer-factual-sentences-are-tagged-typed-and-sealed-the-rest-is-said-unchecked.md)
   (accepted 2026-10-13: class D, four weeks report-only, no human re-ratification by default).** Factual sentences of the
   documents that bind (the verification guide, `SECURITY.md`, the `AGENTS.md` boundaries, the
   README's command table) carry an invisible `<!-- claim: <id> -->` tag; each claim has a type from a
   closed registry (`file-set`, `not-needed`, `duration`, `count`, `exit-code`, `version-ref`, `n-of-m`,
   `flag-present`, and `declared` for what cannot be measured), a verifier reading the sentence's own
   words and a positive control; the text is sealed by `rowDigest` to detect and disclose change: a
   changed typed claim is re-checked by its verifier, a changed `declared` one is disclosed and
   counted, and no human gesture is required by default (a person on sentences only under the
   `sampled` or `per-act` mode an adopter chooses); a lexical detector reports untagged factual-looking sentences for four weeks,
   then refuses new ones zone by zone if the measured waiver cost allows. Before any generalisation:
   60 prose seeds plus controls, catch rates per class and placement, and zero human gestures by
   default, measured, against criteria fixed in the record. Free prose stays unchecked, and the job says so.

Then:

- **M4, the witness checker on the CI self-gate.** Already planned under ADR-0089 (increment 1, steps
  4 and 5); ADR-0090 makes it part of the machine floor.
- **The `mode:` field.** Optional in `runward-delegation/1`, absent reads `sampled`; the mode in force
  computed by the gate, the sentences at the character on every surface, the strict gaps
  `assurance-mode-regulated` and `critical-unapproved`, the claims guard bound to the mode's ceiling.
- **M7, machine seeds, and the fixed `sampled` packet.** A seed pull request per period, its defect
  class drawn from the charter's `seed-classes:`, never merged, its catch published per class; the
  sampled review list carries each item's diff, and a seed must be fetchable from the forge before the
  draw.
- **M8, `enforce_admins`.** Required checks enforced for administrators, and the forge posture read by
  a CI step outside the verdict path and attested.
- **The charter switch.** runward's `runward/delegation.md` set to `mode: machine+critical` with the
  critical list narrowed to the verdict path and the trust roots, and `"regulated": true` removed from
  runward's own lock (option (b) of ADR-0088 decision 4), in their own signed commit (class R); the
  README says the tier stays exercised by the tests, the attack corpus and the example missions.

### Machine-checked proofs as evidence: ADR-0091 (accepted 2026-10-12), increment 1 on its trigger

[ADR-0091](docs/adr/ADR-0091-machine-checked-proofs-as-evidence-a-ratified-statement-a-kernel-checked-proof-read-and-never-run.md)
lets a row rest on a kernel-checked proof of a ratified statement. Increment 0 is the recipe
[`docs/recipes/lean-proofs-as-junit.md`](docs/recipes/lean-proofs-as-junit.md), with no verdict
change. Ahead:

- **Increment 0, its first measurement on a runner.** The reference workflow has not run on a GitHub
  runner, and `landrun` was not in place in the one end-to-end run (macOS, comparator's development
  shim). The first adopter run, or a run in a scratch repository, measures both, and the job's
  duration.
- **Increment 1, only on its trigger:** an adopter, or the ADR-0052 pilot mission, with a Lean
  statement to carry on a row, **and** the ADR-0089 checker running on runward's CI (M4 above). Then:
  the `runward-proof-report/1` format and `docs/spec/proof-report.md`, a proof adapter read behind
  `file:<report>#<Theorem>@<sha256>` (no new prefix), the `proof` nature in `REQUIRABLE_NATURES`, a
  bound ratification required on proof rows in every tier, the printed proof line and its non-scope
  sentence, the claims guard class, and AC-018 to AC-029 in the attack corpus. Class R.
- **Increment 2, after increment 1:** the proof facts in the witness, re-checked by the ADR-0089
  checker.

### Observability and forge parity: the delivery plan of [ADR-0093](docs/adr/ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md) (accepted 2026-10-13)

What runward shows over time is assembled from files the CLI writes; the CLI never raises a cell above
`ci-declared`, never signs and never verifies a signature. A customer-run satellite, `runward-fleet`
(MIT, no editor key), verifies and displays; a vendor-operated hosted product is a separate product
with its own repository, record and licence. GitLab ships at parity with GitHub in every delivery.
Each record lands one delivery ahead of its code. Weeks are estimates (plus or minus 30 %); about 49
agent-weeks in total. The order relative to ADR-0090's work order above is the maintainer's call.

- **D0, the records (1.5 weeks).** Part 1: ADR-0093 accepted; ADR-0094 (forge adapter boundary),
  ADR-0095 (per-row ratification, `causesByKind`, assurance block in `check --json`) and ADR-0096 (Code
  Quality and JUnit renderings, SARIF on GitLab) `proposed`; dated notes on ADR-0011, 0054, 0064 and
  0090. Part 2: an offline GitLab CE bench and recorded API responses. *Accepted when:* each record is
  `proposed` with "What would settle it"; the bench starts with the network cut.
- **D1, the gate that speaks, on both forges (8.5 weeks).** I0 on the pre-approval path; `report
  --format md`; `check --codequality`, `check --junit`; Action job summary and check-run option; GitLab
  component and integrity-pinned file, merge-request note; docs, `harness.ts` and charter sweep; the
  per-tier guide to making the gate required; Azure and Bitbucket templates. Records for D2 land
  (landing population and `ledger`, ITSM deposit; notes on ADR-0041, ADR-0088 decision 6, ADR-0054).
  *Accepted when:* the Markdown is byte-identical on both forges; every number is a JSON path of the
  payload; install works on the offline GitLab CE bench.
- **D2, past and present, unsigned (8 weeks).** `ledger population`, `replay`, `record` (unsigned by
  default; snapshot and signing opt-in), `export`, `verify`; the ITSM deposit. *Accepted when:* a
  shallow clone is refused; a replay fills no verb; a deleted attempt surfaces as a finding; offline
  re-derivation from the snapshot is measured before any public sentence on it.
- **D3, the period and the stream (8 weeks).** `period` and its HTML; the ex-post review of gate
  releases; the event writer, `events verify`, the Prometheus format; SIEM and GitLab audit recipes;
  Pages. *Accepted when:* `period` is byte-identical across runs; a planted throwing writer leaves
  `check` and `gate-hook` output identical; a third-party checker written from the specification agrees.
- **D4, the organisation view at the customer's (6 weeks).** Static `runward-fleet`, trust policy,
  signature verification, `machine-established` on GitHub and GitLab; cosign and `actions/attest`
  recipes with offline verification. *Accepted when:* the eighteen view rules are tests; the satellite
  imports no runward module; an unpinned trust policy raises nothing.
- **D5, the container and the connectors (10 weeks).** The satellite container (no outbound call); the
  GitLab two-mode module; the Kosli type; the forge-neutral independence rule with GitHub and GitLab
  readers (ADR-0080 Part 2); Azure and Bitbucket posters. *Accepted when:* no outbound call with the
  network cut; the site rebuilds from the export; the GitLab module refuses without a customer policy.
- **D6, the hosted product (7 weeks), in its own repository under its own record.** *Accepted when:*
  tenants are isolated; an export replayed in a customer container gives the same site; nothing in the
  core depends on it.

Four adopter findings were decided on 2026-10-23 (ADR-0099 to ADR-0102 accepted). Each implementation is a
pull request of its own, outside the D-plan's estimate:

- **Regime lenses beyond the three AI ones:** *shipped (docs):* the GDPR and NIS2 crosswalks,
  [docs/compliance/gdpr-crosswalk.md](docs/compliance/gdpr-crosswalk.md) and
  [docs/compliance/nis2-crosswalk.md](docs/compliance/nis2-crosswalk.md), no pack, each with its source
  read on 2026-10-23 and a review date (2027-04-23). *Waits:* the DORA lens, written with the D3 period
  report when D3 starts; the CRA, until an adopter asks; a watch of the crosswalks' review dates, which
  the `watch external facts` workflow reads only from `regimes/*.json` today. Never a compliance claim.
  [ADR-0099](docs/adr/ADR-0099-which-regime-lenses-come-after-the-three-ai-ones-cra-nis2-dora-gdpr-and-where-each-belongs.md), accepted.
- **A system of several repositories:** *shipped (docs):* the convention, in
  [docs/interop.md](docs/interop.md#a-system-of-several-repositories): one mission per project, a system
  document cites each member's emitted artefact by repository, commit and digest, and sums no state.
  Documentation only, not a verified contract. *Waits:* `runward-system/1` (option C), reopened by a
  second adopter asking; the D4 organisation view.
  [ADR-0100](docs/adr/ADR-0100-whether-a-mission-can-span-several-repositories-a-system-and-one-aggregated-evidence-file.md), accepted.
- **The EU AI Act pack:** a new lens file with operator-required rows for the system's qualification and
  Articles 4, 5, 14 and 50, and the lens's dated notes printed under the draft's header.
  [ADR-0101](docs/adr/ADR-0101-whether-the-eu-ai-act-pack-carries-rows-for-article-50-transparency-and-the-system-qualification.md), accepted.
- **A sealed JUnit report:** a documented normaliser for drift; `--freeze` refuses a cited report whose
  root counts failures or errors; an advisory line when a cited report fails outside the cited cases.
  [ADR-0102](docs/adr/ADR-0102-whether-the-seal-hashes-a-junit-report-by-what-the-gate-reads-of-it-rather-than-its-bytes.md), accepted.

## Watching

- **How old a committed JUnit report is.** An adopter's finding (re-checked on 0.44.1): a committed
  report carries no commit and no date, and the gate judges its cases as committed. What the verdict may
  read to say more without git, a clock or the network (ADR-0054) is laid out in
  [ADR-0098](docs/adr/ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md),
  accepted on 2026-10-23. Option B shipped (unreleased): `check --strict` counts the rows judged on such a
  report and says their freshness is not verified by this command, and `--json` carries it as
  `committedJUnit`. Option G documented: the CI regeneration guard is a recipe,
  [docs/recipes/junit-freshness-in-ci.md](docs/recipes/junit-freshness-in-ci.md). Source digests
  (option F) stay written down for a second adopter.
- **How the `--for` answer is read.** [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s own reopening trigger (a): if the list is taken as exhaustive despite the standing caveat and the split counts, the output shape is wrong, not the operator.
- **Whether the two anchored `topology-*` rules pull their weight.** They were anchored to `execution-topology.md` because runward scaffolds that deliverable itself; if operators find the match noisy on a file that already carries four topology rules, the anchor is too coarse.
- **Whether a version gap between the running binary and the mission ever changes a verdict.**
  A field report ran a global `0.19.0` beside a repo at `0.28.0`. Measured rather than assumed, on
  2026-07-31: the same working tree judged by `0.19.0` and `0.32.0` — the runward mission itself,
  then a mission freshly scaffolded by `0.32.0` — produced **byte-identical output except the header
  line carrying the version**, same exit code. The trigger set then was "reopen if a report ever
  exhibits two versions disagreeing on one tree". **It is met.** An adopter's report, reproduced on
  `main` at `dbcbc7a` on 2026-10-18: the same tree exits 0 under `0.31.0` and 1 under `0.44.0`. The
  2026-07-31 measurement was true of its pair of versions and is not true in general: the binary's
  age can move the verdict. What was exposed is the hooks: the pre-commit adapter ran a global
  `runward` when there was one, and every other adapter, packaged hook and `wire` entry ran an
  unpinned `npx` (RWD-2026-0171). Fixed by pinning, not by making versions agree: every hook runward
  writes or ships now runs the version that wrote it (TOR-243), so a verdict changes when the
  operator moves the pin, through `runward update`, and not when a machine's global install differs.
  What stays watched: a gap between the version a mission's hooks pin and the version a person types
  by hand (`runward check` on a global install) can still give two answers on one tree, and nothing
  tells the person; `check` does not compare its own version to the one the mission's adapters pin.
- **Rules whose `noTerritory` reason ages.** A declared absence is a decision, not a permanent fact: a rule rewritten to name an artifact becomes anchorable. Fifty of them now carry a reason that can be argued with — that is the point.
- **Whether the mutation ratchet holds, now that it has an artifact.** Until 0.36.1 the ratchet of
  [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 2 had no
  list to be diffed against, so "the survivor list does not grow" could not be falsified. It now
  does. Next pass due 2026-11-05, and it must be compared against
  [`docs/compliance/mutation-register.md`](docs/compliance/mutation-register.md) rather than against
  any number published earlier: every figure taken before 2026-08-21 was measured while orphaned
  test processes were saturating the machine, and Stryker counts a starved run as *detected*. The
  same module read 98.1 % contaminated and 77.4 % clean. Compare like for like, or the ratchet reads
  noise. What the CI leg still owes is running that comparison at release time — decided in the
  amendment, not yet wired.
- **Whether the machine surface deserves the partition the verdict has.** Measured on 2026-08-05: 42
  territory mutants applied one at a time left `check --strict` at exit 0 every time, while 4 of them
  corrupted `runward rules --for --json`. `check.ts` imports neither territory nor characterize, so
  the partition protecting the verdict is real. It is half a partition, because the contract an agent
  drives on sits outside it and answers a wrong list plausibly rather than saying it could not read.

## Later

- Community workflow extensions
- More tool profiles (contributions welcome — see CONTRIBUTING.md)
- Legal review of the license split (tooling MIT / doctrine CC BY-ND)
- Submit the Claude Code plugin (runward-gate) to the official plugin directory
  (discoverability; the third-party marketplace channel already works)

## Someday

- Certification / training track (separate, commercial)
- Operator cost recipes, never in the MIT CLI
  ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md), whose demand gate was
  withdrawn on 2026-08-24: building it is product work). The adoption self-audit and fleet views moved
  to D4 and D5 of the ADR-0093 plan. A citable reference frame exists: the AHE loop
  (observe/diagnose/propose/evaluate/promote under HITL) of arXiv 2605.18747 §2.3
