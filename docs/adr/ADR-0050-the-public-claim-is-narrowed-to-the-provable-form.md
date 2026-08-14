# ADR-0050: the public claim is narrowed to the provable form

**Date**: 2026-08-12
**Status**: proposed (ratification criteria below; this document crosses nothing)

## Context

The product review of 2026-08-12 read the published surface against what the gate demonstrably
does. Every location below was re-verified by grep on that day, on runward 0.33.5 with
`check --strict` at exit 0 on this repository. The site says, in both languages:

- "aucune IA ne peut l'embobiner" / "no AI can fool it" (runward-site `index.html:151,1768`,
  `js/i18n-en.js:24`);
- "Sécurisé dès le premier jour" / "Secured from day one" (`index.html:152,1769`,
  `js/i18n-en.js:25`);
- "la rend impossible dès la conception" / "makes it impossible by design" (`index.html:1166`,
  `js/i18n-en.js:105`);
- "impossibles à embobiner par un prompt" / "impossible to talk into passing with a prompt"
  (`content/docs/case-study.fr.md:37`, `docs/en/case-study.md:39`, plus the generated copies under
  `docs/`);
- "que rien ne peut embobiner" and "aucun prompt ne l'embobine"
  (`content/docs/compare.fr.md:36,108`, plus generated copies).

What the gate actually does is narrower, and the narrowing is this project's own doctrine. 64 rules
ship in `templates/rules/`; exactly one carries a machine-verifiable `signature:`
(`frontier-deterministic-boundary.md:6`), and that signature's own `nonScope` says it proves a
shape exists, not that it does its job. [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)
closed fabrication and circularity after 22 proven false greens; its non-scope is explicit and
unchanged: the gate verifies that evidence is present, resolves, and has not been tampered with,
never that the evidence is *about* the rule it is attached to. Re-verified 2026-08-12: a real file,
cited and sealed, whose content has nothing to do with its rule, passes `check --strict`. "No AI
can fool it" is a claim about relevance, and relevance is the declared non-scope. A reader who
tests the sentence wins against the site. That is the exact failure mode this project exists to
refuse, printed in its own hero.

Three more defects on the same surface, same verification date:

1. **A competitive claim nobody can replay.** "un contrôle au niveau du code (juillet 2026)
   confirme qu'aucun autre scaffold ne les réunit" (`content/docs/compare.fr.md:49`, EN
   `compare.en.md:49`, plus generated copies). No script, no corpus, no dated capture exists in
   either repository. The amendment to ADR-0045 already names this class: an event nobody else can
   replay is an assertion, not evidence. "Confirms" over an unreplayable event is the same defect
   in marketing form.
2. **Translations presented as verbatim.** `compare.fr.md:31` qualifies the BMAD citation
   "advisory … fournit des recommandations, ne bloque pas" as "mot pour mot"; the source sentence
   is English ("advisory … provides recommendations, not blocks"), so the French is a translation
   wearing verbatim's clothes. Same pattern on the Spec Kit and OpenSpec citations
   (`compare.fr.md:30,32`). The EN file's citation is a true verbatim; only the FR misstates its
   own nature.
3. **Four compare pages predating the gate's own doctrine.** The SPA pages
   `#/apres-la-spec/{spec-kit,openspec,bmad,spec-kitty}` (`index.html:1534-1603`) contain zero
   occurrences of "gate" across lines 1440-1605 (grep -c = 0, 2026-08-12); their last substantive
   edit is 2026-07-05 (git log), before ADR-0040 through ADR-0049 made the gate the central
   object. `docs/compare/index.html`, generated from current sources, says "gate" 8 times. The
   same site argues the comparison with and without its main argument.

**The guard already names its own hole.** `test/unit/no-overclaim.test.js` scans
`[README.md, docs, templates, runward, src]` of this repository only (line 24), and its header
(lines 3-7) records that the overclaim caught in the week of 2026-08-04 lived in the SITE repo,
"which that test cannot read". The site repo has no `runward/` directory and no test CI; its only
workflow is `sync-runward-docs.yml` (daily bump of the pinned runward devDependency, resync,
`npm run build` fail-loud). And the surface a visitor receives is built, not committed:
`build-i18n.mjs` generates `public/en.html`; measured 2026-08-12, the stale root `en.html` carries
0 occurrences of "fool" while the built `public/en.html` carries 2. A guard that reads only the
repo files can be green while the served page overclaims.

**The worst case, named first.** The provable sentence is commercially weaker than the forbidden
ones. "Vérifie la présence, les pointeurs et l'intégrité, jamais la qualité" sells less than "no
AI can fool it". This ADR chooses the weaker sentence anyway, because the alternative is a site
that loses an argument with its own product the first time someone runs it.

## Decision

**1. The ceiling sentence.** The strongest thing either repository may publish about the gate is
the sentence already printed at `content/docs/case-study.fr.md:51`: `runward check --strict`
"vérifie la présence, les pointeurs et l'intégrité de ce dossier, jamais sa qualité : la qualité,
c'est ce que vous venez de lire, et la juger reste le travail d'un humain." Presence, pointers,
integrity; never quality, never relevance. Every sentence stronger than this, in any phrasing and
either language, is a violation.

**2. One source of rules, shipped by the package.** The `RULES` of `no-overclaim.test.js` move to
a data file published with the npm package (`dist/claims-rules.json` or a `runward/claims` export);
the CLI test keeps consuming them, and its three meta-guards survive unchanged: the safe-list
tested in both directions, `FROZEN_CITATIONS`, and the scope assertion (> 100 files, named files).
New rule classes, each word-bounded and each with its `unless` escape for negations and
forbidden-list entries: absolutes about the gate (embobiner, fool it, talk into passing);
"impossible by design" / "impossible dès la conception"; "secured from day one" / "sécurisé dès le
premier jour"; a dated competitive claim with no replayable pointer beside it; "mot pour mot" or
"verbatim" applied to a translated citation. Every new rule is proven in both directions before
merge: it fires on the exact line it was written for, and stays silent on the corrected copy. The
lesson is already written four times in that file: a guard that cries on the safe case gets
switched off.

**3. The site build fails loud on a claim.** `scripts/check-claims.mjs` on runward-site consumes
the rules from the pinned runward devDependency (the daily sync already carries new versions
within 24 hours), and scans the BUILT surface `public/` as well as the sources (`index.html`,
`js/i18n-en.js`, `content/`, `news/`). It runs as the last step of `npm run build`, so a violation
reds the Vercel deploy; a PR workflow runs the same check. Scanning is word-bounded on text, like
the CLI guard, because HTML attributes and class names are noise. Before this guard is trusted, one
violation is seeded on purpose and the red build demonstrated, then reverted: a guard that has
never been seen failing is decoration.

**4. The copy is corrected at the sources, FR and EN, then regenerated.** The hero
(`index.html:151-152,1768-1769`, keys `hero.v1`/`hero.v2` of `i18n-en.js:24-25`) and the security
section (`index.html:1166`, `i18n-en.js:105`) drop "impossible" for the actual mechanism: the
trifecta kept incomplete (untrusted input, sensitive tool, exfiltration path, never all three) and
external tools pinned to a known version. Case-study and compare reuse the ceiling sentence to the
character, then `gen-docs` regenerates. The July claim either becomes replayable (dated corpus
plus script, committed) or is rewritten as a dated observation against the sources [1]-[5] the page
already cites, without "confirme" and without "aucun autre"; that choice belongs to the author and
is not made here. Translated citations carry the EN original verbatim in quotes with the FR marked
as a translation (the `FROZEN_CITATIONS` doctrine, `no-overclaim.test.js:149-151`). The site copy
is a per-character contract (site CLAUDE.md): every rewording passes the author before it is
written.

**5. The four SPA compare pages name the gate.** The word and the mechanism (deterministic
verdict, no model in the path, never a judgment of quality) appear in each "what runward adds"
cell of `index.html:1534-1603`, aligned with `docs/compare` which already names it 8 times. Text
only; the design contract forbids a structural redesign and none is needed.

## Alternatives considered

- **Duplicate the rules list in the site repo.** Two lists diverge in silence; the guard's own
  header documents that a guard whose reach is not asserted quietly shrinks to nothing. One source
  of truth, consumed on both sides, is the whole point of decision 2.
- **Govern runward-site with runward (`npx runward init` on the site).** The gate verifies the
  artifacts of a mission, not marketing copy: it would catch none of the claims listed above. It is
  also heavier than the problem, and deferrable with its trigger written down.
- **A human checklist before publication.** It existed: the adversarial fact-check doctrine
  predates every overclaim above, and they shipped anyway. The entire lesson of
  [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) is that vigilance is not a
  mechanism; a deterministic guard that breaks the build is.
- **A new CLI command `runward scan-claims <dir>`.** That grows the product surface to solve the
  maintainer's marketing problem. [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md)
  keeps the operator layer outside the CLI; a data export consumed by a site script respects the
  boundary, a command does not.
- **Correct the copy without installing the guard.** The 2026-08-04 review already caught a site
  overclaim, and here is another one four weeks later. A correction without enforcement is the
  drift re-instructed, not a decision.

## Consequences

- **The worst case first: the headline gets weaker.** The true sentence covers presence, pointers
  and integrity; never quality, never relevance. That is assumed and it is the advertised price of
  this decision: a reader who tests the gate finds exactly what the site announces, which is the
  only durable marketing this project can afford.
- **The build becomes fail-loud on claims.** A false positive now blocks a legitimate deploy;
  hence the obligation, inherited from the guard file's own lessons, that every rule ship with its
  `unless` escape and be tested in both directions before any merge.
- **The rules file becomes a published, versioned surface of the npm package.** A rule change
  travels with the release and reaches the site within 24 hours through the existing daily sync;
  no new update route to maintain.
- **A reintroduced overclaim fails the day it is written**, on the built surface, not at the next
  human review. The drift can no longer come back silently, which is what distinguishes this from
  the checklist it replaces.
- **Cost**: 4 to 5.5 maintainer-days. 0.5 (this ADR) + 1 (rules externalized, new classes,
  two-direction tests) + 1 (site guard, build and CI wiring, demonstrated red build) + 1.5 to 2
  (copy FR/EN, author validation included) + 0.5 to 1 (the four compare pages). Making the July
  claim replayable would add 1 to 2 days of corpus and is not counted: it awaits the author's
  decision named in decision 4.

## What this does not claim

This ADR does not make the gate unfoolable. Relevance remains unverified: 1 signed rule out of 64,
and a real but unrelated proof still passes `check --strict`. That is precisely the claim being
removed, not repaired; repairing it is a different piece of work with its own trigger, and nothing
here advances it. It does not cover surfaces outside the two repositories: LinkedIn posts, HN
comments and the PDFs on thibaultsouris.fr stay under the human verification doctrine, which this
ADR neither strengthens nor replaces. It does not make the July competitive claim true: it makes
it replayable or removes it. It does not replace human judgment of quality; neither does the gate,
which is the ceiling sentence's entire content. And it crosses no phase of any mission: an ADR in
`proposed` status is an argument, not evidence.

## Ratification (what remains to be proven)

Five executable proofs, all required before Status may change; when they exist, their runs are
cited here, dated, and only then does this ADR become accepted:

1. `grep -rniE "embobin|fool it|impossible (dès la conception|by design)|sécurisé dès le premier
   jour|secured from day one"` over runward-site `public/` after a fresh build returns 0 matches
   outside negations.
2. `node scripts/check-claims.mjs` exits 0 on the corrected site, AND exits non-zero when a
   forbidden sentence is reinserted: both directions, exactly like the CLI guard's own tests.
3. `npm test` green on the runward repository with the rules externalized and the scope assertion
   (> 100 files, named files) intact.
4. One red Vercel build demonstrated on a seeded violation: proof commit, observed failure, then
   revert.
5. The four SPA compare pages contain the word "gate" (grep -c > 0 on `index.html:1440-1605`),
   and the July claim is either backed by a committed replayable script or absent.
