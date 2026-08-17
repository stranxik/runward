# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-08-14 (v0.35.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

### From the 2026-08-12 product review (ADR-0051 and ADR-0053 shipped in 0.34.0; ADR-0050 and ADR-0052 proposed)

A multi-agent product review (six axes, five held under counter-expertise, one refuted on sourcing)
produced four structural decisions. Two shipped in **0.34.0** and leave this list for the CHANGELOG:
decision 2 (the gate made as strong as its headline, ADR-0051 accepted) and decision 4 (the
construction gate, ADR-0053 accepted). What remains ahead: decision 1 (ADR-0050) minus its externalised
rule data, which shipped in 0.34.0 — its site-copy parts need the runward-site repo and the author's
per-character sign-off; decision 3 (ADR-0052), which depends on a third party the project does not
control; and the three paper cuts carried over from ADR-0051.

**Decision 1 — the public claim never exceeds what the gate proves ([ADR-0050](docs/adr/ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md)) — EXECUTED 2026-08-14** except its decision 5. Shipped: the site claims guard (`scripts/check-claims.mjs`, last step of the site build, one seeded violation demonstrably reddened it), the five new claim classes with their own `unless` escapes, the copy narrowed to the ceiling sentence in both languages (runward-website#22, author-approved), and the `runward/claims` package export (0.35.0). Still ahead:

- **Name the gate in the four SPA compare pages** (`index.html:1534-1603`): grep -c "gate" on that window is 0 today while `docs/compare` names it 8 times; word and mechanism in each "what runward adds" cell, text only (ADR-0050 decision 5).

**The three paper cuts from ADR-0051.** The decision itself — identifier-boundary symbol match, the 5-signature slice, the signed-share line — shipped in **0.34.0** (see the CHANGELOG). These three adjacent items change no decision and ship without an ADR:
- **The missing-row message names the gesture.** The strict gate's manifest message (`src/lib/conformance.ts:328`) never mentions `runward manifest --sync`, which scaffolds exactly the missing rows. Proof: `conformance-gate.test.js` golden contains the command when rows are missing. 1 to 2 hours.
- **The in-progress label states the true cause.** `check` prints "placeholders remain" for every in-progress artifact (`src/commands/check.ts:67`) while `mission.ts:115-126` distinguishes placeholders-left from divergence-below-floor. Expose the cause; JSON `state` unchanged. Proof in `artifact-state.test.js`. 2 to 3 hours.
- **Duplicated prose is named in the run.** When 2+ `applied` rows carry an identical Evidence cell, "What this gate verified" says so; counted, never gated, ADR-0004 intact, additive JSON. Proof in `evidence-breakdown.test.js`. Half a day.

**Decision 3 — the survival thesis and the first third-party mission ([ADR-0052](docs/adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md), proposed).** The strategic decision; the parts that depend only on us are ratifiable, the exit from zero third parties is not (a third party controls the calendar).

- **Fold the survival thesis into `docs/positioning.md`, behind the fact-check.** Adopted verbatim (independence: a verdict is opposable only when the judged party does not manufacture the judge; survival; agent-agnosticism). Adversarial fact-check pass, then the fold, then `positioning-drift.test.js` extended so diluting it reds CI. Site and README derive only after.
- **Commit the pilot pre-registration before any data exists.** `docs/pilot-protocol.md`: the fixed 12-to-20-question handover questionnaire, the scoring rule (the third party's engineer scores, never the author), and the written failure criterion, committed and dated first; the git history is the proof. Publication of the report is committed whichever way the numbers point.
- **The structure decision is posed, not taken** (Branch A contractable entity / Branch B assumed internal OSS regime), each with a named trigger; choosing a branch is its own later dated decision.

### From the 2026-08-14 technical-roadmap investigation (ADR-0054/0055/0056/0057 all accepted; the verdict layer shipped in 0.35.0)

A six-agent investigation (counter-expertised) asked what runward must BE, in code and
infrastructure, to become a credible enterprise-grade governance base for an agentic factory —
without becoming a runtime. Verdict: there is a real, buildable, thesis-preserving path, and it is
most of the set below — but "enterprise-grade in practice" does not live in the code (semantic truth
is permanently the operator's; adoption and continuity are earned by a calendar and an entity, not a
commit). The buildable north star: **runward becomes the deterministic, standards-legible verdict
layer of the agentic supply chain** — the artifact cosign, Kyverno, sigstore and GRC tools consume,
that no LLM-gated competitor can produce. Three proposed ADRs trace the structural decisions:
[ADR-0054](docs/adr/ADR-0054-the-runtime-boundary-is-explicit.md) (the runtime boundary, explicit),
[ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md) (the verdict as an
in-toto attestation), [ADR-0056](docs/adr/ADR-0056-the-evidence-layer-widens.md) (the evidence layer
widens, never leaving GATE_NON_SCOPE). The sixteen buildable objectives, triaged:

**Thesis-consistent CLI+artifacts — deterministic files computed in-repo, no runtime, in waves:**

- **Wave A (foundations) — SHIPPED.** (1) `check --attest` — the in-toto verdict predicate, the keystone every attestation builds on ([ADR-0055](docs/adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md), accepted); validated in real conditions against the in-toto Statement v1 contract on runward's own mission. (2) fail-loud `rules --for --json` — a top-level `couldNotRead` that refuses rather than guesses. (3) three more rules signed on their prescribed idioms (6/64 → 9/64, [ADR-0056](docs/adr/ADR-0056-the-evidence-layer-widens.md)).
- **Wave B — SHIPPED in 0.35.0** except two edges. (6) `runward verify` offline (ratified ADR-0055; now also names the cross-version skew, `producedBy`/`versionSkew`); (5) the phase-crossing attestation on `check --through`, horizon-aware verify; (4) the JUnit committed-tool adapter — homonym-safe (every occurrence scanned, one red reddens; `CLASS::NAME` pins), never spawning the tool. The SARIF adapter shipped 2026-08-17 (`#ruleId` on a committed scan resolves structurally: clean/findings/absent — the substring false green is dead by routing). The PR-native `verify` Action shipped 2026-08-17 (`verify/action.yml`, exercised on runward's own mission in CI).
- **Wave C — SHIPPED in 0.35.0.** (7) `runward bundle`; (10) `spec-check` — with the declared depth (`#SYMBOL`/`::NAME`/`:LINE`) verified through the gate's own evidence layer, every pointer of a criterion must verify; (9) the shared corpus pin ([ADR-0057](docs/adr/ADR-0057-the-shared-corpus-is-pinned-without-a-registry.md), **accepted**: `update --corpus <path>`, `corpusPin`/`corpusDrift` advisory, org `migrations.json` merged, the no-fetch invariant blocking under `unshare -n`); (11) the verdict-purity regression guard. The org corpus AUTHORITY — publish, sign, fan-out, fleet view, strong anti-forgery — stays the separate brick, blueprinted in [corpus-authority-brick.md](docs/corpus-authority-brick.md).
- **Wave D (opt-in edges).** (12) opt-in cosign signing under the **operator's** key — ships last, only with the no-key invariant test (runward custodies no key/identity), and "the operator's key" at N maintainers is now SPECIFIED before any code ([docs/spec/runward-signing.md](docs/spec/runward-signing.md), 2026-08-17: DSSE carries N signatures over one byte-idempotent payload; runward wraps and never signs; `signatureVerified: false` is frozen; five acceptance criteria); (13) a reference Kyverno deploy-gate consumer — runward produces the attestation, the operator's Kyverno admits.
- **Demand-gated.** (8) territory adapters beyond Cloudflare (`deriveAll` iterates one adapter today) — one per real mission that needs it, keeping the refuse-rather-than-guess derivation contract; not a speculative matrix.

**Operator satellite (outside the MIT CLI, [ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md), demand-gated, a batch of emitted artifacts only).** The corpus-authority half of this satellite — publisher, fan-out, fleet view, strong anti-forgery — is blueprinted in [corpus-authority-brick.md](docs/corpus-authority-brick.md): the second brick, a runtime on the operator's side of the seam, connected to runward by a vendored package and never a wire.

- (15) a batch cross-repo verdict reducer — the fleet "who is in good standing" view, offline, operator-triggered, reading emitted JSON/attestations, never a working tree or a socket. (16) an adoption self-audit + rule-ownership view across repos — corpus pins, signed-rule coverage, unratified-ADR debt, from emitted artifacts only. Both become runtime-creep the instant they enter the CLI, become always-on, or read a repo's tree — the category label is enforced, not decorative.
- **Deferred (Later).** (14) an OPA decision-log / Rego output — redundant with the in-toto attestation any policy engine already consumes; revived only on a named OPA-shop demand.

**The honest ceiling — not code, named so it never masquerades as a shippable feature:**

- (17) the first external mission converts the survival thesis to evidence ([ADR-0052](docs/adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md)): a second party runs the gate on a repo the maintainer did not write. No commit substitutes. (18) organizational continuity — a legal entity as procurement counterparty, a second maintainer to keep the STANDARD maintained, forkability exercised once. The CLI cannot be a counterparty. These two are the places that actually gate enterprise adoption, and neither is a code problem: **the code path wins on the SHAPE of the verdict; the right to say it wins in PRACTICE is earned by a third party and an entity, not by a commit.**

### From the 2026-08-14 full-repo audit — the non-blocking remainder

The audit's blocking list (two false greens in the evidence layer, the ADR-journal drift, the
assessor-register corrections, the site claims purge + guard, the release) shipped in **0.35.0**
and runward-website#22. What it left, dated here rather than silently absent:

- **Evidence-layer widening, still inside the thesis**: the lcov coverage adapter shipped 2026-08-17 (presence + non-vacuity, never a threshold — a floor is policy, and policy is the operator's CI); the bundle + spec-delta half of `spec-check` shipped the same day (a directory or several files; a criterion identifier referenced and declared nowhere is a dangling reference). **Remaining**: cobertura, lint and SCA/SBOM adapters on committed files.
- **Windows: PROVEN 2026-08-17.** A `windows-latest` leg runs the full suite plus the self-gate
  (`.github/workflows/ci.yml`, locked by `regulated-posture.test.js`). Its first run found seven real
  defects across three root classes — test-side `.pathname` resolution, the artifact POSIX contract
  at emission (bundle subjects, lock keys, messages), and the case check skipping under 8.3 short
  names — all fixed. "Same working tree ⇒ same verdict" now holds on the three OS.
- **Journal debts — SETTLED 2026-08-17** except one: ADR-0009's 19 unmapped rules are ruled on
  (3 mapped, 17 declaring `noAsi:`, silence guarded impossible); the conformance-gate incident log
  is declared and guarded (it is `docs/compliance/known-defects.md`, now carrying the three
  incidents found on 2026-08-14/17); ADR-0011's lapsed MCP trigger is re-armed on the narrower
  question it actually governs (a discovery surface, never the verdict path); ADR-0013's dangling
  skill reference is closed by decision (the tooled half shipped; the doctrine skill belongs to the
  CC BY-ND canon, not to this MIT tree); ADR-0016's SOC 2 is DECLINED with a named trigger (the day
  anything operates a service for a third party); ADR-0050 is accepted on its five executed proofs.
  The reevaluation triggers of ADR-0048..0057 are written — one specific to each decision, not a
  boilerplate line — with a **decision deadline on ADR-0052 (2026-11-17)**: by then the pilot has run
  and its result is published, or the survival thesis is retaken as a thesis in `docs/positioning.md`.
  A guard now refuses an ADR without a dated trigger, and it immediately found an eleventh the audit
  had missed (ADR-0039's date lived in prose, invisible to reader and tool alike).
- **The multi-maintainer doc — WRITTEN 2026-08-17** (`docs/operator-role.md`, "When there are several
  of you"): what already carries the case by construction (determinism + `verify` + the reviewed
  commit as trust anchor + a required check), the CODEOWNERS-per-phase pattern with a worked example,
  the three sharp edges (parallel re-seal, `--through` read by someone who did not declare the
  horizon, "the operator's key" at N before layer 5 is built), and what runward will NOT add with the
  reason: a "validated by" field is re-signable (ADR-0002's floor) and reading the author from git
  breaks same-tree-same-verdict (ADR-0054).
- **The TOR register extension** to the verdict surfaces (declared as dated debt in the register).
- **Interop — SHIPPED 2026-08-17** ([interop.md](docs/interop.md) + `check --vsa`): the verdict emits
  as a SLSA Verification Summary Attestation (a neutral port — a policy engine admits on it without
  learning runward's vocabulary, claiming no SLSA level and carrying the declared horizon inside the
  level), and the page documents signing with the operator's cosign, depositing into
  Archivista/Chainloop/OCI, and pushing the verdict as external evidence into Kosli and JFrog release
  gates. runward gained no client, no upload and no key.

### The documentation chantier (scoped 2026-08-17, scheduled after the technical plan)

The surface roughly doubled in a week and the author named the consequence: runward is becoming hard
to understand, and a line added to a table is not documentation.
[ADR-0058](docs/adr/ADR-0058-documentation-has-genres-and-they-do-not-mix.md) settles the register
question (three genres, three homes, one test: *would this sentence still be true if every company in
the market disappeared?*); what remains is the work itself, in this order:

- **The diagram capability, first** — measured: there is no diagram anywhere in `content/docs/` today.
  The perimeter is a timeline with stages plus a tool-per-stage overlay, which is a picture; rendering
  it as prose is why the current explanation takes three paragraphs. Decide the source format under
  the usual constraints (deterministic output, no network at build time, legible in the Markdown twin
  each page ships) before writing any of the pages below.
- **The perimeter map, as ONE surface** — upstream (Spec Kit, OpenSpec, BMAD, Spec Kitty, Kiro,
  Tessl, Conductor), downstream (Kosli, JFrog AppTrust, Chainloop, the SLSA toolchain), harnesses
  (Claude Code, Codex, Cursor, Copilot); for each: the object governed, the moment, who authors the
  verdict (code or model), what it ingests and emits. Never accreted one competitor at a time.
- **A reading path for the widened surface** — the evidence layer now spans three committed-tool
  adapters and five emissions; `evidence.*.md` was brought up to date on 2026-08-17 (it had gone
  factually wrong, not merely stale), but the entry points into it were not re-thought.
- **The register class in the site build** (ADR-0058 ratification criterion 1), proven in both
  directions like every claim class before it.

### Standing items

- **Instruct the remaining mutation survivors** — 81 measured against the full 437-test suite on
  2026-08-11 (down from a derived 199; twenty were already dead), each filed as hole, defence in
  depth, equivalent, or display-only
  ([ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) decision 4). The
  largest block is 37 in `evidence`. The 733 lower-stakes survivors were never confronted with the
  full net and are not counted here.
- **`fixed-in` for RWD-2026-0010/0011/0012** in `docs/compliance/known-defects.md`: they are closed
  by tests on `main` and this release is the first to carry them.

## Watching

- **How the `--for` answer is read.** [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s own reopening trigger (a): if the list is taken as exhaustive despite the standing caveat and the split counts, the output shape is wrong, not the operator.
- **Whether the two anchored `topology-*` rules pull their weight.** They were anchored to `execution-topology.md` because runward scaffolds that deliverable itself; if operators find the match noisy on a file that already carries four topology rules, the anchor is too coarse.
- **Whether a version gap between the running binary and the mission ever changes a verdict.**
  A field report ran a global `0.19.0` beside a repo at `0.28.0`. Measured rather than assumed, on
  2026-07-31: the same working tree judged by `0.19.0` and `0.32.0` — the runward mission itself,
  then a mission freshly scaffolded by `0.32.0` — produced **byte-identical output except the header
  line carrying the version**, same exit code. Ten releases apart. The gate reads the mission's own
  rule copy and the mission's own deliverables, so the binary's age does not move the verdict.
  Nothing is mechanised on an unproven risk (the ADR-0039 posture). Reopen if a report ever exhibits
  two versions disagreeing on one tree — that is the objective trigger, and it is falsifiable by the
  same two commands.
- **Rules whose `noTerritory` reason ages.** A declared absence is a decision, not a permanent fact: a rule rewritten to name an artifact becomes anchorable. Fifty of them now carry a reason that can be argued with — that is the point.
- **Whether the mutation ratchet holds.** [ADR-0046](docs/adr/ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md)
  sets no threshold and one direction: on the seven core modules the score does not go down and the
  absolute-survivor list does not grow. Next pass due 2026-11-05. It will report a **different**
  number for a reason that is not a regression: the verdict moved into `src/lib/verdict.ts`
  ([ADR-0047](docs/adr/ADR-0047-the-verdict-is-computed-where-a-test-can-reach-it.md)) and now sits
  inside the measured perimeter. Compare like for like, or the ratchet reads noise.
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
- Operator-layer satellite (adoption self-audit, operator cost recipes) — only on a real
  demand signal arriving through a channel (the ADR-0028 watch); never in the MIT CLI
  ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)). If the
  trigger ever fires, the citable reference frame exists: the AHE loop
  (observe/diagnose/propose/evaluate/promote under HITL) of arXiv 2605.18747 §2.3 —
  a frame, not a demand signal; the trigger stands unchanged
