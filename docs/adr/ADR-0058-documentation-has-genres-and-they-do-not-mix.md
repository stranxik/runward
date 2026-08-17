# ADR-0058: documentation has genres, and they do not mix

**Date**: 2026-08-17
**Status**: accepted 2026-08-17 (all four criteria met; record below; this document crosses nothing)
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — triggered by a defect the author caught in review, on the published site

## Context

On 2026-08-17 a page was added to the technical documentation (`content/docs/release-layer.*.md`)
answering "does runward do what Kosli does?". Its mechanism half was sourced, dated and correct. Its
last section was not documentation at all:

> "Ces plateformes ont ce que runward n'a pas : des clients de référence dans la banque, des équipes
> commerciales, des stores hébergés, des écosystèmes de partenaires, et des années d'exploitation.
> Si votre besoin est la custody d'artefacts publiés à l'échelle d'un groupe, c'est chez elles qu'il
> faut aller, et runward n'a rien à dire de contraire."

Every sentence there is true, and none of it belongs in a technical reference. The author's review
named it in one line: *"ceci n'a rien à faire dans la doc, et cette page n'est pas sur le même ton
que les autres."*

**Measured rather than asserted.** A grep over `content/docs/` for that register — sales teams,
reference customers, "that is where you should go" — returns **zero occurrences outside that one
page**. And the existing comparison page, `compare.*.md`, discriminates on **mechanism**, quoting
each tool's own documentation about what renders its verdict ("`/analyze` produces a Markdown
report", "the QA persona's decision is advisory"). It never discriminates on market position. So the
house register was consistent, and one page broke it.

**The deeper defect is the axis, not the paragraph.** A sales team is not a fact about a tool: it
ages on a commercial clock, it cannot be verified from a repository, and it is exactly the kind of
claim [ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) narrows everywhere
else. Comparing on maturity in a page that also compares on mechanism teaches a reader that the two
are the same kind of statement. They are not.

**Why this needs a decision and not just a fix.** The same slip is now likely twice over. runward's
surface roughly doubled in a week (the verdict layer, three committed-tool adapters, four emission
formats, spec bundles, the corpus pin), and the author has named the consequence: *"runward
s'élargit et devient complexe à comprendre ; la documentation devra suivre."* Widening under time
pressure is precisely when material gets filed wherever there is a page open — which is how the
evidence page came to state two things that were false (`#SYMBOL` as a substring, `::NAME` as a name
that "must appear"), caught the same day.

## Decision

**1. Three genres, three homes, one register test.** Every piece of runward prose belongs to exactly
one genre, and the genre decides the home:

| Genre | Answers | Home | Register test |
|---|---|---|---|
| **Technical reference** | how it works, what it verifies, how to wire it | `content/docs/`, `docs/` | Would this sentence still be true if every company in the market disappeared? If not, it is not reference. |
| **Positioning** | who it is for, against what, what we do not have | `docs/positioning.md` (internal source of truth) | Is this a claim about the market, a competitor's maturity, or how we should *say* something? Then it is positioning. |
| **Narrative** | what happened, what it cost, what we learned | the news section, release articles | Is it dated and about an event? Then it is narrative. |

A comparison page IS legitimate technical reference — `compare.*.md` proves it — **when it compares
mechanisms**. The line is not the subject (competitors are a fine subject), it is the axis: what a
tool *does*, verifiable from its own documentation, belongs in the docs; what a company *has*,
verifiable only from the market, does not.

**2. The register is enforceable, and enforced where enforcement already lives.** The site build
already runs `scripts/check-claims.mjs` (ADR-0050 decision 3). It gains a class for this: a
market-maturity vocabulary (sales team / reference customers / years of operation / "that is where
you should go", both languages) is refused in `content/docs/` and allowed everywhere else. Like every
class before it, it ships with its `unless` escapes and is proven in both directions before it is
trusted — a guard that cries on the safe case gets switched off, and this project has paid that
lesson four times.

**3. The perimeter map is a chantier, not a page.** The author's instruction is explicit: *"on
reviendra plus tard sur tous les concurrents ou voisins de runward et le périmètre de chacun ; une
note ou une ligne ne suffit pas."* Recorded here so it is scoped rather than improvised: it covers
the upstream (Spec Kit, OpenSpec, BMAD, Spec Kitty, Kiro, Tessl, Conductor), the downstream
(Kosli, JFrog AppTrust, Chainloop, the SLSA toolchain), and the harnesses (Claude Code, Codex,
Cursor, Copilot) — for each, the object governed, the moment, the verdict's author (code or model),
and what it ingests or emits. It ships as one coherent surface, not as pages accreted one competitor
at a time. It is scheduled AFTER the in-flight technical plan, by the author's decision.

**4. That map is a diagram before it is prose.** The perimeter is a *timeline with stages* (intent →
construction gate → build → artifact custody → promotion → runtime) with a *tool-per-stage* overlay;
that is a picture, and rendering it as a table is why the current explanation needs three paragraphs.
The chantier therefore starts from the diagram, not from prose.

> **Correction, 2026-08-17 (same day).** This decision first read "and the pipeline does not draw
> yet", asserted as *measured*. It was false, and the measurement was the problem: the grep behind it
> looked for `mermaid`, `<svg`, `graph TD` and `flowchart` in `content/docs/*.md` and `gen-docs.mjs`,
> and found only UI iconography. The docs pipeline **already draws** — a `DIAGRAMS` registry of eight
> diagrams in four shapes (flow, loop, layered, quadrant), referenced from content by a
> ` ```diagram ` fence, rendered as inline SVG at build time, with an fr+en text equivalent the build
> THROWS without, precisely so the Markdown twin each page ships stays legible. It already satisfies
> the three constraints this ADR was about to demand of it: deterministic output, no network at build
> time, legible in the twin. One of the eight, `scaffold-landscape`, is even a competitor positioning
> map — the exact genre the perimeter map needs.
>
> Recorded rather than quietly edited, because the failure is the one this project fails a test over
> in every other direction: a claim labelled *measured* whose measurement could not have seen the
> thing it denied. The lesson is narrow and worth keeping: a grep for the vocabulary you expect proves
> nothing about a system that uses a different one — look for the CAPABILITY (what the generator
> emits), never for the spelling you assumed it would use.

## Amendment (2026-08-17) — the repository/site axis: one copy, an explicit link

The three genres above decide WHAT a page is. They do not decide WHERE a technical reference lives
when the project has two reading surfaces — the repository and the documentation site — and the
question came up immediately: `docs/interop.md` (signing a verdict with cosign, depositing it into
Archivista or Chainloop, pushing it into a Kosli or JFrog release gate, admitting on it with
Kyverno) had no page on the site, so an operator wiring runward had to go to GitHub for the
operational half.

**Decided by the author: an explicit link, never a duplicate.**

The reason is the project's own anti-drift discipline applied to prose. These recipes are
**commands**, and two copies of a command diverge — the second one silently, because nothing
re-runs it. The repository holds them because that is where they are versioned alongside the code
that produces them: a flag that changes and its recipe move in the same commit, reviewed together.
The site links out.

What that costs, stated: a reader on the site leaves it to read them. That is accepted, and it is
cheaper than the alternative — a site page that is right the day it ships and wrong three releases
later, which is exactly the failure this ADR exists to prevent one genre at a time.

What it requires: the link must be where the reader with that question actually is, not only where
the material is adjacent. It now sits on `wiring` ("wire the gate" — the operating page, where
someone plugging runward into their chain looks), on `evidence` (in the task router), and on
`release-layer` (where the boundary with that layer is drawn).

This does not generalise to every repository document. `regulated-adoption` legitimately exists as
two DIFFERENT pages — the repo sheet for a procurement review, the site page for a reader arriving
cold — because they are different documents for different audiences, not two copies of one. The rule
is narrow: **one copy of anything executable; a link, never a transcription.**

## Alternatives considered

- **Delete the offending paragraph and move on.** What was done first, because it was live on the
  published site — but alone it fixes one page and teaches nothing. The same material would land in
  the next comparison page written under the same pressure.
- **Ban competitors from the technical documentation entirely.** Simple, and wrong: `compare.*.md` is
  useful, sourced, and technical. It would also push a real engineering question ("is this the same
  as my release gate?") into marketing surface, where an engineer will not look for it.
- **Keep positioning in the docs but label it.** A "positioning" callout inside a reference page is a
  disclaimer, and disclaimers are what a reader skips. The genre decides the home, not a badge.
- **Enforce the register by review only.** The failure being corrected here happened in review — the
  author caught it, which is the system working. But this project's own doctrine is that a rule
  nothing enforces erodes: the claims guard exists precisely because a documented intention is not a
  contract (ADR-0050).

## Consequences

- **A cheap, mechanical answer to "where does this paragraph go?"** — the register test is one
  question ("still true if the market vanished?"), which is the kind of rule that survives being
  applied at 2am under deadline.
- **One more claim class in the site build**, and therefore one more way for the build to redden on
  honest copy if the class is written too wide. Mitigated by the both-directions proof the ADR-0050
  discipline already requires.
- **The perimeter map is deferred with a shape**, so it starts from a scope and a diagram question
  rather than from an empty page.
- **A cost, accepted**: `positioning.md` grows into the document nobody outside the project reads,
  and its "honest gaps" section is where uncomfortable material accumulates. That is the correct
  place for it, and it means the discipline of keeping that file honest matters more, not less.
- Crosses no phase; `check --strict` reads exit 0 before and after.

## What this does not claim

- It does not say the removed paragraph was false. It was true, and it stays true in
  `positioning.md`.
- It does not make the documentation good — it makes one class of mistake mechanical. Clarity,
  structure and the widening problem the author named are a separate, larger job (decision 3).
- It does not decide how diagrams are produced; it records that they are the chantier's first
  question.

## Ratification

**Accepted 2026-08-17.** The four criteria were met the same day the decision was taken, which is
the point: a register rule that waits for a quiet week is a register rule nobody applies.

1. **The class ships and is proven in THREE directions.** `scripts/check-claims.mjs` gains a
   market-maturity class (sales teams, reference customers, years of operation, market share,
   "that is where you should go", both languages), **scoped** to `content/docs/` and its built
   copies via a new optional `scope` field. The scoping is the design, not a convenience: the same
   sentence is legitimate in a news article, in `positioning.md`, in the README, and a class that
   refused it everywhere would be the guard-that-cries-on-the-safe-case this project has already
   switched off four times. Proven: a seeded violation inside `content/docs` reddens the build
   (exit 1, with the replacement named in the message); **the same sentence in `content/news` does
   not** (exit 0 — the scope works, which is what makes the class usable); the corrected surface
   stays green at 408 files. All seeds reverted.
2. **The corrected pages hold.** `release-layer.*.md` carries no market-maturity claim (the class
   now enforces that mechanically rather than by review), and the material lives in
   `positioning.md`, where it is grouped with the other honest gaps.
3. **The chantier is scoped in the roadmap** — with its first question corrected: the diagram
   capability already existed (see the correction in decision 4), so the map started from the
   registry rather than from a capability decision. Two of the four steps have since shipped: the
   perimeter map as one surface, and a task-keyed reading path on the evidence page.
4. **Global invariant.** `check --strict` exits 0; `no-overclaim` and `positioning-drift` green.

The criteria as originally set, kept as the record of the bar:

1. **The register class ships and is proven in both directions**: `scripts/check-claims.mjs` refuses
   the market-maturity vocabulary inside `content/docs/`, passes on the corrected pages, and a seeded
   violation reddens the site build — then is reverted, exactly as ADR-0050 decision 3 required of
   its own classes.
2. **The corrected pages hold**: `release-layer.*.md` carries no market-maturity claim, and the
   material lives in `positioning.md` instead (grep, both directions).
3. **The chantier is scoped in the roadmap**, and starts from the existing diagram registry rather
   than from a capability decision that turned out to be already taken (see the correction above).
4. **Global invariant**: `check --strict` exits 0; `no-overclaim` and `positioning-drift` green.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05.

The decision is wrong and must be revisited if any holds: the register class fires on legitimate
technical prose (a page that must name a market fact to be *technically* honest — a deprecation, a
vendor withdrawing a format); the three-genre split sends readers to a page they do not read, so the
positioning material becomes invisible rather than well-placed; or the perimeter map turns out to
need market facts to be useful, which would mean the map is positioning and belongs on the other side
of this line.

**Watched via**: the site build (the guard is a build step) and each documentation pass.

## References

- [ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md) — the claims guard this reuses, and the ceiling sentence the register test generalises
- [ADR-0040](ADR-0040-per-rule-non-scope-declaration.md) — naming what a surface does NOT do, applied here to what a page is NOT for
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — the boundary the release-layer page describes on the technical axis
- [interop.md](../interop.md) — the recipes the corrected page points at
