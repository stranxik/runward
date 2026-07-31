# ADR-0043: territory is declared in two parts — the rule names the category, the mission names its files

**Date**: 2026-07-31
**Status**: accepted (ratified 2026-07-31 — see Ratification)
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a second field report from the population [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s trigger names, investigated by a four-agent read (measurement against the real matcher, ADR-corpus constraint analysis, external prior-art survey, codebase feasibility); **candidate position pending maintainer ratification, not a durable position yet**

## Context

[ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) put the territory in the rule file, on the ground that "territory is a property of the *rule*, identical across missions". Its second amendment records why that premise is false: territory is the product of the rule's **subject** (a class of artifacts, genuinely invariant) and the mission's **layout** (a naming convention, variable per mission). The invariant carrier holds the variable half.

The consequence is measured, not feared. **Of the 45 CRITICAL/HIGH rules, six declare a territory that reaches the client's tree** — five more target artifacts runward scaffolds itself. That 13% is the ceiling, not a plateau: the editorial pass is complete and fifty rules have declared in writing that they will never carry a territory. Those six must guess the layout of every repository in the world with fixed globs, and the field measurement shows how brittle that is — a repo matches or not on whether it spelled a directory `adapters` or `infrastructure`, and one rule missed because `workers` had lost its singular twin.

The reopening trigger this ADR answers is ADR-0041's own (b), verbatim: "`appliesTo` coverage stalls below a useful fraction of the CRITICAL/HIGH set, making the primitive decorative — **then the carrier or the authoring discipline is wrong**."

Two constraints bound any answer, and both come from evidence rather than taste.

**A per-mission map rots.** ADR-0041's untouched half — "putting it in the mission would make every mission restate it and let it drift" — is true, and the field data is unambiguous: an empirical study of suppressed static-analysis warnings (FSE 2025, 46 Python projects, 7,357 suppressions) finds that **50.8% of suppressions affect no warning**, that the stock **grows monotonically**, and that stale entries **hide future warnings**. A declaration the repository must maintain by hand decays, and its decay is silent.

**A taxonomy nobody is made to fill stays empty.** Kubernetes published a recommended label vocabulary and states plainly that it "aren't required for any core tooling"; a decade on, adoption is partial. Nx is the one surveyed system that solved the same shape well — the project declares tags in its own config, constraints reference only tags, the package knows no paths — and the reason it works is that its plugin API *derives* tags and merges them with the project's. Derive, do not ask.

One analogy must be discarded before it misleads: the field report proposes CODEOWNERS. CODEOWNERS is a **central file of globs**. Adopting it would move the globs from the rule to the repository without changing their nature, and an entry-file layout would still need someone to write `src/entry.*.ts` by hand. It also declares only people, and GitHub exposes no API for which pattern matched.

## Decision

**Proposed, pending ratification: split the declaration. A rule declares the *category* of artifact it governs and no path at all. Which files are in that category is declared where that is knowable — derived from what the project already declares, and completed by the mission when derivation cannot reach.**

The candidate shape (to be confirmed or amended at ratification):

- **The rule declares a category, not a path.** An optional `governs:` frontmatter field naming one or more categories from a small closed vocabulary shipped with the rule set (`background-work`, `configuration`, `schema-migration`, `model-adapter`, …). The category is the invariant half and stays where invariants belong: in the rule file, reviewed by the maintainer, travelling with the package. `appliesTo:` is **not removed** — a rule may still declare paths where a path is genuinely universal (`**/AGENTS.md`, `**/execution-topology.md` — artifacts runward itself scaffolds), and the two compose by union.
- **Derivation first, and it is the default gesture.** runward maps files to categories from declarations the project has already made, never from its code: a deployment manifest naming an entrypoint and a schedule, an ecosystem manifest, a lockfile. These are operator declarations in a normed file — the same class of fact `characterize` already reads per ecosystem, and emphatically **not** the content signal ADR-0041 refused. Each derivation source is an adapter behind a port ([ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md)), so language and runtime neutrality ([ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md)) is preserved: an unknown framework yields no derivation, never a guess.
- **The mission completes, in both directions.** A map at the mission root declares `path-glob → category` and may also **remove** a derived one. It is additive to derivation and to `appliesTo`; it never narrows a rule's own declaration, because a mission that could silently shrink its own coverage would be the weak verifier [ADR-0040](ADR-0040-per-rule-non-scope-declaration.md) warns about. Precedence is **named, not implicit**: last matching entry wins, per attribute, as `.gitattributes` and CODEOWNERS both do — ESLint's own post-mortem names the alternative failure ("no one really understood all of the different permutations").
- **The match reason gains its missing half.** `matchedBy` becomes a discriminated union: an `appliesTo` match renders as today; a category match renders *both* levels — the rule governs category X, and this file is X **because** of that derivation source or that map line, with its file and line. This restores the `<source>` component of the `git check-ignore -v` format that ADR-0041 named as its model and dropped for want of a second source.
- **Reported in both directions, or not shipped.** Every surveyed system that solved this converged on the same pair of checks, and the ones that omitted it produce silent gaps: files no rule governs, **and** rules that govern nothing. On 64 rules, a rule matching nothing anywhere is exactly as serious as an unclassified file, and both are indistinguishable from success. A `--for` answer therefore reports the uncovered and the never-matching, and a rule whose category no file carries is nameable.
- **Rot is designed against from day one.** A map entry that matches no file is reported, not silently kept — the FSE finding is that half of such declarations are inert and that the stale ones mask future signal. Removal of a category is a visible act in the diff, never a silent loss of coverage.
- **The gate never reads the map.** `--for` stays a reading, always exit 0, outside the exit-code path. `check` is untouched: no new gated deliverable, no manifest change, no new red.

**Explicitly out of scope**, named so they are not silently dropped:
- **Inference from project code** (an AST read for "a module exporting a scheduled handler"). ADR-0041 refused it as a hypothesis presented as a fact, and this decision *reduces* the demand for it rather than reviving it: the mission declares by hand what a detector would have guessed. It would also be per-framework — `scheduled` on one platform, a decorator on another — and owning that is the language lock-in ADR-0005 refuses.
- **Replacing `appliesTo`.** Paths keep their place where they are genuinely invariant. This is a second axis, not a migration.

## Alternatives discarded

- **Widen the globs (`**/entry.*.ts` and friends).** Rejected, and the field report rejects it too. Measured: that glob matches the browser bundle a popular framework generates by default — a file with no background work at all — while missing `src/entry.ts` and any `.tsx` spelling. Too broad and too narrow at once, and it encodes one project's naming as a universal rule.
- **A CODEOWNERS-shaped file of globs in the repository.** Rejected: it moves the globs without changing their nature, and leaves every mission writing path patterns by hand — the very work derivation exists to avoid. Kept only as the *fallback* tier, where derivation cannot reach.
- **Tell each mission to edit its own `runward/rules/` copy.** [ADR-0020](ADR-0020-rule-evidence-signatures.md) permits it and it works today, which is exactly why it is tempting. Rejected: it forks the rule's **text**, not its territory, so the mission owns a divergence on doctrine itself; it stays `drift` forever and `update --force` erases it; and it is the per-mission workaround [ADR-0042](ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) already refused on its own ground — a gap that replicates into every scaffolded mission is a framework gap, not a per-mission exception.
- **Do nothing and accept 13%.** Defensible on cost, and it is the null option a maintainer may still take. Rejected here because the ceiling is terminal rather than transitional, and because the population that hit it is the one every graduated app will join.

## Consequences

**If ratified:**

- **Positive.** The declaration lands where the knowledge is: the maintainer says what "background work" means, the repository says which of its files carry it, and neither guesses the other's business. Derivation keeps the manual map small, which is what the field data says decides whether such a map survives. The primitive stops being decorative on the layouts that dominate serverless delivery, without runward learning to read anyone's code.
- **Negative, accepted.** It is the largest surface this line of work has touched: a new frontmatter field, a category vocabulary to write and maintain, at least one derivation adapter, a mission-level file with its own parse and failure modes, a discriminated match reason, and bidirectional reporting. The category vocabulary is a new editorial object that can itself go stale. And ADR-0041's untouched half stands: missions will restate, and some maps will rot — the answer is the reporting and pruning above, not a claim that it will not happen.
- **On other boundaries.** The gate is untouched: exit codes, `GATED_DELIVERABLES`, manifest shape, seal, and the zero-run/zero-LLM invariants all hold. `--for` remains outside the exit-code path. The determinism contract holds by construction — the map is in the working tree, unlike the git ref ADR-0041 refused for `--changed`.

**If rejected:** this file stands as the dated record that the two-part carrier was considered against a measured 13% ceiling and declined, with ADR-0041's amended premise left standing as the honest description of the limit.

## Ratification — 2026-07-31

Ratified by the maintainer the same day, ahead of the 2026-12-01 deadline. **Nothing is built with this ratification**, and the sequence is the one the decision states: ratify, then the vocabulary and the first derivation adapter, then the mission tier. What ratification settles — so the implementation re-litigates nothing — plus the two things the trigger required it to name:

**The initial category vocabulary: seven, one per real need, none speculative.** It is derived from the nine shipped rules whose territory reaches the client's tree, not invented:

| Category | Rules it carries |
|---|---|
| `background-work` | `async-job-guardrails` (HIGH) |
| `scheduled-work` | `async-scheduled-maintenance` (MEDIUM) |
| `configuration` | `config-secrets-boundary` (CRITICAL), `config-typing-zod` (MEDIUM) |
| `schema-migration` | `data-migrations-forward-only` (HIGH) |
| `port-adapter` | `hexa-adapter-pattern` (HIGH) |
| `model-provider` | `provider-llm-auto-detection` (CRITICAL), `resilience-multi-provider-fallback` (HIGH) |
| `startup` | `observability-startup-provider-log` (LOW) |

The vocabulary is **closed and small on purpose**: a category is added when a shipped rule needs one, never in anticipation. A file may carry several. The five remaining rules with a territory (`handover-agents-charter-final`, the four `topology-*`) keep `appliesTo:` unchanged and gain no category — their paths are artifacts runward scaffolds itself, so they are genuinely invariant, which is the case this ADR explicitly preserves.

**The first derivation adapter: the Cloudflare Workers deployment manifest.** `wrangler.jsonc` / `wrangler.toml` already declares, in a normed file the operator wrote, both the entry module (`main`) and its triggers (`triggers.crons`, queue consumers). From those declarations runward derives `scheduled-work` and `background-work` onto the named entry module — a fact about a declaration, never about the code behind it. This adapter is chosen first because it serves the population that reported the gap, and because it is the cleanest instance of the principle: the nature was declared twice already and nobody read it. An absent or unknown manifest yields **no** derivation, never a guess, and the adapter shape ([ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md)) keeps every other framework unprivileged.

**What ratification does not settle**, and the implementation must weigh: the on-disk form and location of the mission map (the `hooks.json` regime — outside `MISSION_LAYOUT`, never scaffolded, never refreshed by `update` — is the candidate, because a map that lives under `runward/rules/` stays `drift` forever and dies on `update --force`); whether `governs:` and `appliesTo:` may coexist on the same rule (they may, by union, but the counters must partition without redefining `unscoped.count`, which has kept its meaning since v0.24.0); and the exact rendering of the two-level match reason, which must carry the `<source>` component that ADR-0041 named as its model and dropped.

**The honest cost, restated at ratification.** This is the largest surface this line of work has touched, and the ceiling it removes is 13% of the CRITICAL/HIGH set — real, but the benefit arrives only as derivation adapters and categories are written. The prior art's two warnings are accepted, not dismissed: a hand-typed taxonomy goes empty, so derivation must stay the default gesture; and any map the repository maintains rots, so the bidirectional report and the inert-entry pruning are part of the decision, not a follow-up.

## Reevaluation trigger (mandatory, dated)

This is a candidate: the trigger governs the **ratification decision**. Decide — accept (moving Status to `accepted`, and naming the initial category vocabulary and the first derivation adapter) or reject (moving Status to `rejected`) — at the first groom, and no later than **2026-12-01**.

Once ratified, reopen if (a) the manual map is doing most of the work, meaning derivation reaches too little and the mechanism has become the hand-typed taxonomy the prior art says goes empty; (b) map entries that match nothing accumulate past a fraction that makes the report noise rather than signal — the FSE 50.8% is the number to measure against; or (c) the category vocabulary itself proves contested, i.e. missions disagree with the maintainer about what a category means, which would mean the invariant half was mis-drawn too.

**Trigger set on**: 2026-07-31 · **Watched via**: the ADR journal at each groom, and field reports from missions scaffolded by `runward init`.

### Amendment — 2026-07-31: trigger (b) named no instrument, and the obvious one cannot serve

Checked rather than assumed, condition by condition. **(a)** compares derived bindings against map entries — two declared sets, both already in `rules --for --json` (`derivation.bindings` beside the map's own count). Measurable. **(c)** is a field signal, and the trigger already names its channel. Measurable. **(b)** is not: "map entries that match nothing" requires knowing which files exist, and `rules --for` never learns that — it reads the disk only to load the rule set, and ADR-0041 fixed by ratification that paths come from the caller and that a path need not exist. The instrument this condition needs is precisely the one the primitive is built not to have.

Two ways it could have gone wrong, both refused:

- **Measuring inertness against the caller's selection.** On a three-file pull request, twenty-seven of thirty map rows would report as inert, every invocation. That is noise from the first day, and it would mechanically satisfy trigger (b) itself — the instrument would manufacture the failure it exists to detect.
- **Walking the tree from `--for`.** It breaks "paths come from the caller", and a walk needs an ignore model: the moment runward reads `.gitignore` it reads the operator's git configuration, which is the ADR-0039 line that `--changed <base>` was rejected on.

**The instrument is `characterize`.** It already walks the tree under a bounded, `SKIP_DIRS`-pruned traversal and already exists to state facts about an inventory at rest (ADR-0014, ADR-0036 — "counts, never interpretation"). A `## Territory coverage` section there — files walked, files carrying a category, map rows that matched nothing, with their line numbers — is a fact about a tree, in the command whose whole job is facts about the tree. It is read at a groom, which is the cadence this ADR already watches at, not per pull request.

**Consequently, trigger (b) is inert until the mission tier ships**, since no map exists to have inert rows. The correction is therefore a precondition rather than a repair: **the `characterize` measure ships with the mission tier, in the same increment**, exactly as this ADR's Decision already requires of the bidirectional report and the pruning ("part of the decision, not a follow-up"). Shipping the map without its instrument would leave a ratified reopening condition that nothing observes — and a trigger nobody can falsify is decorative, which is the defect this corpus refuses everywhere else.

**What stays honestly bounded, and must say so in its own output.** Even with the `characterize` measure, the "files nothing governs" half of the bidirectional report remains scoped to the caller's selection inside `rules --for`. That is complete for the use `--for` exists for — a pull request's own diff is the object under review — and incomplete for map health, which is why the health question lives in `characterize` instead. Both halves are real; they answer at different cadences, and neither may be presented as the other.

### Delivered — 2026-07-31, in full

All three tiers ship, plus the instrument the amendment above made a precondition. Two field reports from the same mission drove the shape, and both changed it.

- **Tiers 1–2** (v0.27.0): `governs:` on the nine rules whose territory reaches the client's tree; a Cloudflare Workers adapter reading `wrangler.jsonc`/`.json`/`.toml`. JSONC by a two-state scanner then `JSON.parse` — Cloudflare's own canonical example carries comments and trailing commas, so `JSON.parse` fails on the *nominal* case, and a regex would eat the `//` inside an URL. TOML by a table-path automaton, because table headers are absolute paths: an environment cron is named as such, and order-independence is free.
- **Tier 3**: `runward/territory.md`, four columns, precedence named in three places, `remove` as a first-class effect. Every refused row is reported with its line, on the `readReopeningTriggers` model rather than `parseManifest`'s silent skip — a row the operator believes is working and runward ignored is the worst state of all.
- **The `characterize` measure**: a `## Territory coverage` section — files walked, files carrying a category, and map rows that matched **no** walked file, with their line numbers. This is what makes trigger (b) observable.

**The vocabulary grew by one, on field evidence rather than by design.** Ratification named seven; a mission reported that `configuration` was too coarse — `config-secrets-boundary` (CRITICAL) and `config-typing-zod` (MEDIUM) shared the word with different subjects, so declaring a file "configuration" would have surfaced the typed-config rule as a false positive beside the secret boundary it was meant to reach. A signal that arrives with noise stops being read. `secret-boundary` is now its own category, and the granularity rule is stated: **a category is split when missions must be able to declare its parts separately**, never by quota.

**What the delivery proves, and what it does not.** The mission that reported the gap had two rules violated in July; derivation alone reached one of them, and only the map reaches the other — its entry module derives a secret from the environment, which no deployment manifest can describe. That is the two-part carrier working as argued. What it does not prove is durability: the prior art's warning stands, a repository-maintained map rots, and the `characterize` measure exists precisely so that rot is observable rather than assumed absent.

**A delivery defect found on the way, and fixed first.** The same report showed that `runward update` compared a mission's rule copy to the *current* template, which cannot distinguish an upstream change from a local edit — so every release that touched a shipped rule told operators they had modified files they never opened, and withheld the refresh behind `--force`. A mission following the instruction not to edit its rules never received the release at all. `runward/scaffold-lock.json` now records what runward wrote; where there is no record, `update` says it cannot tell rather than assigning blame.

## References

- [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) — the decision this extends; its second amendment records the false premise and the measured ceiling, and its trigger (b) is the door this ADR walks through.
- [ADR-0040](ADR-0040-per-rule-non-scope-declaration.md) — "every gate names what it cannot verify"; the source of the reasoning ADR-0041 mis-transposed, and the standard the bidirectional report answers to.
- [ADR-0042](ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md) — "a gap that replicates into every mission is a framework gap"; the ground for refusing the per-mission workaround.
- [ADR-0020](ADR-0020-rule-evidence-signatures.md) — operators already own their mission's rule copy and may tighten a frontmatter predicate there; the permission exists, the survival regime does not.
- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the port/adapter shape derivation sources take, so no framework is privileged.
- [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md) — language and runtime neutrality; why code inference stays out and derivation reads declarations only.
- [ADR-0014](ADR-0014-the-characterize-command-contract.md), [ADR-0036](ADR-0036-characterize-reports-git-churn-hotspots-and-bus-factor.md) — facts labelled facts; a derived category is a fact about a declaration, never about the code.
- The Dropyour field report 2 (2026-07-31) — the entry-file layout, and its own refusal of the widen-the-globs remedy.
- Prior art: Nx project tags and `createNodesV2` (the project declares, the plugin derives, both merge) — the closest working analogue; `.gitattributes` macro attributes and GitHub Linguist overrides (upstream defaults, repository override in both directions); Kubernetes labels/selectors and its recommended-but-optional vocabulary; Kubernetes Gateway API GEP-713, which rejected selector-based attachment over "the Discoverability Problem" — the counter-current this decision must answer with its match reason; *An Empirical Study of Suppressed Static Analysis Warnings*, FSE 2025 (50.8% inert, monotonic growth, stale entries hiding future warnings).
