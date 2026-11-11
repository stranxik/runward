# runward-fleet: the mission projections, the six steps, the portfolio, the point and the series

**Status**: specification of `runward-fleet-path/0`, `runward-fleet-portfolio/0`, `runward-fleet-point/0`
and `runward-fleet-series/0`, dated 2026-11-11, with the code that implements them
(`packages/runward-fleet/ui/mission.js`) · **Proposed by**:
[ADR-0126](../adr/ADR-0126-the-mission-projections-the-six-steps-the-portfolio-and-a-history-of-received-versions-written-once-in-runward-fleet.md)
· **Reads**: `runward-fleet-index/0` ([runward-fleet-index.md](runward-fleet-index.md)) as it is, and the
points it writes · **Closed lists**: [runward-closed-values.json](runward-closed-values.json), section
`mission` · **Words shared with**: the decision reading ([runward-fleet-decision.md](runward-fleet-decision.md))

The mission projections say where each application stands in the six steps of the method, side by side
for a portfolio, and how that changed over the versions a service received. They are projections of the
index: no clock, no network, no model. They compute three things and nothing else, each written once,
here and in `ui/mission.js`: the groupings of each step (n / N, with the index path of every item counted),
the reading of each step by the rule of section 2, and, over versions, since when the last state and
position hold. A view prints a projection and computes nothing. Every sentence comes from the closed
lexicon of section 4, keyed on a closed value, or from the decision reading's lexicon for what both name: a
document, its state and its cause, a refusal's kind, an application's state. A value the lexicon does not
know is shown as written.

## 1. Where it lives, and how it is called

`runward-fleet/mission` (`ui/mission.js`, a module with no Node import that imports `./views.js` only):

| Export | What it gives |
|---|---|
| `path(index, id)` | the six steps of the application `id`, `runward-fleet-path/0` (section 3.1); `null` when the inventory declares no such application |
| `portfolio(index)` | applications by step, `runward-fleet-portfolio/0` (section 3.2) |
| `point(index)` | one version's point, `runward-fleet-point/0` (section 3.3) |
| `series(entries)` | the series of points over the versions received, `runward-fleet-series/0` (section 3.4) |
| `renderPath(index, id)`, `renderPortfolio(index)`, `renderSeries(doc, id?)` | their HTML, whose elements carry style roles (section 5); `renderPath` shows the portfolio for an `id` the inventory does not declare |
| `MISSION_LEXICON`, `missionLexiconAt(lang, pointer)` | the lexicon in English and French, and the sentence a JSON Pointer (RFC 6901) names: under `/decision/…`, in the decision reading's lexicon |
| `STEPS`, `SCOPE_PHASE`, `READINGS`, `COMPLETE_CAUSES`, `HOLES`, `readingOf`, `refusalPhase` | the closed values of section 2 and the rule itself |
| `PATH_FORMAT`, `PORTFOLIO_FORMAT`, `POINT_FORMAT`, `SERIES_FORMAT`, `MISSION_RULES` | the four formats, and the rules of section 6 |

The static page does not show these views yet: it inlines `ui/views.js` alone. A hosted deployment imports
the module from the commit it pins.

## 2. The steps, and how a step reads

**The six steps** (`STEPS`), each holding the phases of `check --json` (`deliverables[].phaseId`,
`conformance[].phaseId`) that the CLI numbers with it in its own phase labels (`1 · Frame`, `2 · Architect`,
`3 · Floor`, `5 · Govern (day zero)`, `6 · Hand over`); `topology` is folded under step 2, as the CLI's
`2 · Architect` holds `execution-topology.md`:

| Step | Id | Phases | English | French |
|---|---|---|---|---|
| 1 | `frame` | `frame` | Frame | Cadrer |
| 2 | `architect` | `architect`, `topology` | Architect | Architecturer |
| 3 | `floor` | `floor` | Floor | Plancher |
| 4 | `iterate` | none | Iterate | Itérer |
| 5 | `govern` | `govern` | Govern | Gouverner |
| 6 | `handover` | `handover` | Hand over | Transmettre |

Step 4 holds no phase: the gate asks for no document there (ADR-0033: iterating is a posture, not a
milestone), so it reads "not asked by the gate" and is never said crossed.

**A refusal's step.** Its `phaseId` when the index carries the field (`null`: no step). An index written
before ADR-0125 carries no `phaseId` on a refusal: its gated scope names the phase (`SCOPE_PHASE`: `Architect`,
`Topology`, `Floor`, `Govern`, `Handover`, as the CLI's table of gated deliverables labels them). Any other
scope (`corpus`, `evidence-seal`, `reconstruction`, `delegation`, `ratification`, `analysis`) belongs to no
step: those refusals bear on the record as a whole and are listed apart. A document whose phase is on no step
is listed apart too, its phase shown as written.

**The rule** (`readingOf`), read in this order, from closed fields of the check received: the state and phase
of each document, the phase of each refusal, `verdict` and `strict`.

| # | When | Reading |
|---|---|---|
| 1 | the check received lists no document at all | `not-listed` |
| 2 | no document and no refusal at this step | `not-asked` |
| 3 | a document of this step is not filled, and this is the first such step | `current` (the CLI's own current phase, as `runward status` places it) |
| 4 | a document of this step is not filled, after the current step | `ahead` |
| 5 | the check refuses something at this step | `refused` |
| 6 | the check is strict and its verdict is `clean` or `gaps` | `crossed` |
| 7 | otherwise | `complete`, with its cause |

A step is crossed only where the check holds nothing against it: its documents filled, nothing refused there,
under a strict check whose state judges the answers. Under a presence-only check (`not-strict`), a level the
team requires and does not reach (`level-not-met`, ADR-0114), a check that writes no state (`no-state`), or a
state this reading does not know (`other`), a step whose documents are filled reads `complete`, its cause
said. A refusal that belongs to no step does not stop a step from being crossed: it is listed apart, and the
application's own state (the decision reading's) says the check refuses.

## 3. The documents

A sentence is `{ key, text, from?, args? }` as in the decision reading: `key` the JSON Pointer of its template
(under `/decision/…` when it is the decision reading's), `text` the template filled, `from` the index path of
the closed value it was read from, and `args` the values it was filled with: `{ text, path, verbatim }` for
data, `{ text }` for a step's number, `{ text, sentence }` for a sentence set inside another, and a grouping.
A grouping is `{ text, n, N, list, at, path, src }`: `n` of `N`, `list` the items it counts (a document's
`relPath`, a refusal's `scope · rule`, an application's id, a version), `at` the index path of each item, in
the same order, `path` its own path in the projection document (the path a view's numbers name), and `src`
the id of the source that gives it. A count is held once, as the `count` argument of the sentence that says
it: its `path` ends in `.args.count`. A grouping that would count nothing is not written.

### 3.1 `runward-fleet-path/0`

| Key | Content |
|---|---|
| `format`, `lang`, `index` | the format, `en` or `fr` (the index's), and `{ format, builtBy }` of the index read |
| `title` | a sentence |
| `application` | `id`, `path`, `name` (data), `state` (the index's own), `stateWord`, `qualifier` and `date`: the decision reading's, so "nothing is blocking" is never shown without the team's requirements and the date of the last check |
| `observed` | `false` for an application whose check was not read (`not-observed`, `not-available`): then `reason` is the decision reading's, and no step is shown |
| `position` | where the check places the application, its `currentGate` as written, data |
| `note` | `notListed` or `notStrict`, or `null` |
| `current` | the step number of the current step, or `null` |
| `steps[]` | six, in order: `step`, `id`, `path`, `number`, `name`, `reading`, `readingWord`, `why`, `documents` (a sentence whose count is the documents filled, n of the documents the check expects at this step; `null` when it expects none), `missing[]` (each document not filled: `relPath`, `state`, `cause`, `at`, `line`), `refusals` (a sentence whose count is the refusals at this step, n of all the check's refusals; `null` when none), `kinds[]` (the refusals at this step by kind, in the order the export lists them, each `{ kind, line }`, its count n of the refusals at this step) |
| `outside` | the refusals that belong to no step, `{ line, kinds[] }`, or `null` |
| `unplaced[]` | the documents whose phase is on no step, by phase: `{ phaseId, label, items[] }` |

### 3.2 `runward-fleet-portfolio/0`

| Key | Content |
|---|---|
| `format`, `lang`, `index`, `title` | as above |
| `declared` | the number of applications the inventory declares |
| `columns[]` | one per step: `step`, `id`, `number`, `name`, and `byReading[]`, the applications grouped by the reading of this step, each `{ state, line }`, in the order of `READINGS` then the states of an application not read, `N` being every application declared: an application whose check was not read is counted under its own state (`not-observed`, `not-available`), never left out, and the groups together count every application |
| `applications[]` | in the inventory's order: `application`'s keys, `reason` (for an application whose check was not read) and `cells[]` (six: `step`, `id`, `reading`, `readingWord`, and the sentences `documents` and `refusals`, or `null`), or `cells: null` |

### 3.3 `runward-fleet-point/0`

What a history needs of one version of the index, a pure function of it: a service writes it when it publishes
the version, and computes it again from the same bytes for a version that has none.

| Key | Content |
|---|---|
| `format`, `lang`, `index` | as above |
| `asOf` | the index's date label, data |
| `missions[]` | in the inventory's order: `id`, `name`, `state` (the index's verdict; `no-state` for a check received that writes none, which the index reads `not-observed`; `not-observed` or `not-available` for a check not read), `runward` (the version that judged), `commit` (the one the inventory declares), `gate` (`currentGate` as written), `exitCode`, `gaps` (the CLI's own counts: `{ deliverables, conformance }`), `check` (the sha256 of the check read, or the digest the inventory declares), `steps` (the six readings) |

### 3.4 `runward-fleet-series/0`

`series(entries)` reads `[{ version, seq, at, point }]`: the service's version of the index, its order, the date
it received it (its clock, declared), and the point; `{ version, seq, at, erased: true }` for a version whose
content was erased. Entries are read in the order of `seq` when every one carries a number, else as given. An
entry whose point is not a point (no `missions` list) is `unreadable`.

| Key | Content |
|---|---|
| `format`, `lang` | the format, and the language of the last point read |
| `origin` | `received`: the versions a service received, never mixed with a replay of past trees (ADR-0093 decision 11, rule 6) |
| `size` | the number of entries |
| `series[]` | one per application, those of the last version read first, in its order, then the others as they appear: `id`, `name`, `judgedBy` (the runward versions that judged, in order), `points[]` (each version holding the application: `version`, `seq`, `at`, `state`, `runward`, `commit`, `gate`, `gaps`, `steps`, `check`, `judgeChanged`, `stateWord`; and each hole, erased or unreadable, `{ version, seq, at, state, hole: true, stateWord }`, in every series), `since` (`{ version, seq, at, state, gate }`, or `null`) and `sinceLine` (its sentence, or `sinceNone`), `byState[]` (the points by state, each `{ state, line }`, in the order of the states then the holes, `N` being the series' points) |

**Since when** is the first point of the last run of points with an equal state and an equal position, a hole
or a version without the application breaking the run; `null` when the last version received does not hold the
application or is a hole. It is computed by `series`, never by a view. A point judged by another runward version
than the point before carries `judgeChanged` (rule 7), and its view a marker.

## 4. The lexicon

`MISSION_LEXICON.en` and `MISSION_LEXICON.fr` hold the same keys. French puts a no-break space before a colon.
`{…}` is a value, filled as data or as a grouping. The decision reading's sentences used here are its own: a
document's line (`/decision/pieces/item`), a refusal's kind (`/decision/problems/byKind`, `/decision/kind/…`),
an application's state, its requirements and its date, and a value the lexicon does not know
(`/decision/unknown/…`).

**Steps** (`step`, keyed on the step's id) and their number

| Key | English | French |
|---|---|---|
| `frame` | Frame | Cadrer |
| `architect` | Architect | Architecturer |
| `floor` | Floor | Plancher |
| `iterate` | Iterate | Itérer |
| `govern` | Govern | Gouverner |
| `handover` | Hand over | Transmettre |
| `number` | Step {step} | Étape {step} |

**Readings** (`reading`)

| Reading | English | French |
|---|---|---|
| `crossed` | Crossed | Franchie |
| `complete` | Documents complete | Pièces complètes |
| `refused` | Refused at this step | Refusée à cette étape |
| `current` | Current step | Étape en cours |
| `ahead` | Not reached yet | Pas encore atteinte |
| `not-asked` | Not asked by the gate | Non demandée par la porte |
| `not-listed` | Not listed by the check received | Non listée par le contrôle reçu |

**Why** (`why`; `why.complete` keyed on the cause)

| Reading or cause | English | French |
|---|---|---|
| `crossed` | Its documents are filled in and the check received refuses nothing at this step. | Ses pièces sont remplies et le contrôle reçu ne refuse rien à cette étape. |
| `complete` · `not-strict` | Its documents are filled in, but the check received reads the documents only, not the answers: it is not said crossed. | Ses pièces sont remplies, mais le contrôle reçu ne lit que les pièces, pas les réponses : elle n'est pas dite franchie. |
| `complete` · `level-not-met` | Its documents are filled in and nothing is refused at this step, but the evidence does not reach the level the team requires: it is not said crossed. | Ses pièces sont remplies et rien n'est refusé à cette étape, mais le niveau de preuve que l'équipe exige n'est pas atteint : elle n'est pas dite franchie. |
| `complete` · `no-state` | Its documents are filled in and nothing is refused at this step, but the check received writes no state: it is not said crossed. | Ses pièces sont remplies et rien n'est refusé à cette étape, mais le contrôle reçu n'écrit pas d'état : elle n'est pas dite franchie. |
| `complete` · `other` | Its documents are filled in and nothing is refused at this step, but the check received writes a state this reading does not know: it is not said crossed. | Ses pièces sont remplies et rien n'est refusé à cette étape, mais le contrôle reçu écrit un état que cette lecture ne connaît pas : elle n'est pas dite franchie. |
| `refused` | Its documents are filled in, and the check refuses answers at this step. | Ses pièces sont remplies, et le contrôle refuse des réponses à cette étape. |
| `current` | The first step whose documents are not all filled in: this is where the application stands. | La première étape dont les pièces ne sont pas toutes remplies : c'est là qu'en est l'application. |
| `ahead` | Its documents are not all filled in, and an earlier step is not finished either. | Ses pièces ne sont pas toutes remplies, et une étape antérieure n'est pas finie non plus. |
| `not-asked` | The gate asks for no document at this step: it is never said crossed. | La porte ne demande aucune pièce à cette étape : elle n'est jamais dite franchie. |
| `not-listed` | The check received lists no document: this step cannot be read. | Le contrôle reçu ne liste aucune pièce : cette étape ne peut pas être lue. |

**The path** (`path`)

| Key | English | French |
|---|---|---|
| `title` | The six steps | Les six étapes |
| `lede` | Where this application stands in the six steps of the method, read from its last check received. | Où en est cette application dans les six étapes de la méthode, d'après son dernier contrôle reçu. |
| `position` | Where the check places it, as it writes it: {gate} | Où le contrôle la place, tel qu'il l'écrit : {gate} |
| `documents` | {count} documents filled in | {count} pièces remplies |
| `refusals` | {count} refusals of the check at this step | {count} refus du contrôle à cette étape |
| `missing` | What is missing | Ce qui manque |
| `outside` | Refusals that belong to no step | Refus qui ne relèvent d'aucune étape |
| `outsideLede` | They bear on the record as a whole, not on one step. | Ils portent sur le dossier entier, pas sur une étape. |
| `outsideCount` | {count} refusals of the check outside the steps | {count} refus du contrôle hors des étapes |
| `unplaced` | Documents the check places outside the six steps | Pièces que le contrôle place hors des six étapes |
| `notStrict` | The check received reads the documents only, not the answers: no step is said crossed. | Le contrôle reçu ne lit que les pièces, pas les réponses : aucune étape n'est dite franchie. |
| `notListed` | The check received lists no document: no step can be read. | Le contrôle reçu ne liste aucune pièce : aucune étape ne peut être lue. |
| `back` | All applications | Toutes les applications |
| `received` | Over the versions received | Au fil des versions reçues |

**The portfolio** (`portfolio`)

| Key | English | French |
|---|---|---|
| `title` | Applications by step | Les applications par étape |
| `lede` | Where each application stands in the six steps of the method, read from its last check received. | Où en est chaque application dans les six étapes de la méthode, d'après son dernier contrôle reçu. |
| `application` | Application | Application |
| `group` | {reading}: {count} | {reading} : {count} |
| `documents` | {count} documents | {count} pièces |
| `refusals` | {count} refusals | {count} refus |

**The series** (`series`). A point's state is the decision reading's group label (`/decision/group/…`, so
"nothing is blocking" always carries the team's requirements, beside the date the version was received), or
one of these.

| Key | English | French |
|---|---|---|
| `title` | Over the versions received | Au fil des versions reçues |
| `lede` | Each version of the inventory the service received, in the order it received them. | Chaque version de l'inventaire que le service a reçue, dans l'ordre où il l'a reçue. |
| `origin` | Versions received, never mixed with a replay of earlier states; each date is the receiving service's clock: declared, not verified. | Des versions reçues, jamais mêlées à un rejeu d'états antérieurs ; chaque date est l'horloge du service qui reçoit : déclarée, non vérifiée. |
| `since` | The same state and the same position since version {version}, received {at} | Même état et même position depuis la version {version}, reçue le {at} |
| `sinceNone` | Not in the last version received. | Absente de la dernière version reçue. |
| `group` | {state}: {count} | {state} : {count} |
| `state` · `no-state` | Check received, no state written | Contrôle reçu, sans état écrit |
| `state` · `erased` | Content erased | Contenu effacé |
| `state` · `unreadable` | Not readable | Illisible |
| `erased` | Content erased: nothing of this version is read. | Contenu effacé : rien de cette version n'est lu. |
| `unreadable` | Nothing of this version could be read. | Rien de cette version n'a pu être lu. |
| `otherJudge` | Checked with another version of runward than the version before. | Contrôlée avec une autre version de runward que la version précédente. |
| `notWritten` | not written | non écrit |
| `chart` | Refusals of the check, version by version | Refus du contrôle, version par version |
| `cols` · `version` | Version | Version |
| `cols` · `received` | Received | Reçue le |
| `cols` · `state` | State | État |
| `cols` · `position` | Where the check places it | Où le contrôle la place |
| `cols` · `documents` | Documents missing | Pièces manquantes |
| `cols` · `refusals` | Refusals | Refus |
| `cols` · `judge` | Checked with | Contrôlée avec |

**The English words.** The French step words are the method's, chosen by the maintainer; the English ones are
the CLI's own phase labels, its `Hand over` included. "Crossed" is the CLI's word for a gate passed ("cross the
gate on evidence"); "complete" says what was found, the documents, and no more. "Not asked by the gate" is said
of a step, never "skipped" or "optional", which would read as a choice the team made.

## 5. The HTML and its style roles

As in the decision reading, each element carries a role, never a look, and a state or a reading is said by its
word and its shape (`data-role="mark"`, per `data-state` or `data-reading`), never by a colour alone. A number is
a `<span class="n">` whose `data-index` names its path in the projection document the view renders (so a view is
held against that document), and a count is always n / N. Data is marked as the views mark it: `<span
data-verbatim>`.

| View | `data-projection`, `data-view` | Roles |
|---|---|---|
| `renderPath` | `runward-fleet-path/0`, `path` | `back`, `name`, `state`, `mark`, `state-word`, `qualifier`, `date`, `title`, `lede`, `position`, `note`, `steps`, `step` (`data-step`, `data-reading`, `aria-current="step"` on the current one), `step-name`, `step-number`, `step-word`, `reading`, `reading-word`, `why`, `counts`, `documents`, `refusals`, `missing-title`, `missing`, `piece`, `kinds`, `kind`, `outside`, `outside-count`, `unplaced`, `nature`, `links` |
| `renderPortfolio` | `runward-fleet-portfolio/0`, `portfolio` | `title`, `lede`, `note`, `map-wrap`, `map` (a table: one row per application, `th scope="row"`; one column per step, `th scope="col"`), `corner`, `column`, `group`, `application`, `unread`, and per cell (`data-step`, `data-reading`) `mark`, `reading-word`, `documents`, `refusals` |
| `renderSeries` | `runward-fleet-series/0`, `series` (`data-origin="received"`) | `title`, `lede`, `origin`, `series`, `name`, `since`, `groups`, `group`, `chart` (an SVG: a bar per point for its refusals, a round mark for `clean`, a square turned for any other state, a dashed line for a hole), `table-wrap`, `points` (a table), `state-word`, `hole`; a point judged by another version carries `data-marker="other-judge"` |

The links name routes a deployment maps: `#/steps` (the portfolio), `#/steps/<id>` (a path), `#/received/<id>` (a
series), and the decision reading's `#/decision/<id>` and `#/mission/<id>`.

## 6. Its rules

Held by `test/unit/fleet-mission.test.js`, each with a planted control. The decision reading's rules hold here
where they apply: the words runward never says (`BANNED`), and "nothing is blocking" never without the team's
requirements and the date (R4). R1, none of the method's own words, does not: these views name the method's
six steps by design, and stay one click away from the decision reading.

| # | Rule |
|---|---|
| M1 | Every count is n / N with the list it counts, each item named by its index path; every number a view shows is its projection's value at the path it names. |
| M2 | A step's reading follows one written rule from closed fields of the index, the same in every deployment; the current step is the CLI's own, the first whose documents are not all filled in. |
| M3 | Step 4 is never said crossed: while the check expects no document there, it reads not asked by the gate. |
| M4 | No step is said crossed unless the check received reads the answers, refuses nothing at that step, and does not report the level the team requires as unmet. |
| M5 | Every closed value has its sentence in both languages, which hold the same keys; a value the lexicon does not know is shown as written; no word runward never says, and no reading names a decision taken. |
| M6 | The history holds the versions received only, never mixed with a replay, each dated by the receiving service's clock and said declared; a change of the judging version is marked; since when is computed once, in the projection, never by a view; an erased version is a hole that breaks a run. |

M2 is held against the CLI's own words on the five real exports: the step the projections call current is the
one the export's `currentGate` names when it names a phase, the steps they call refused are the phases it says
the gate is red at, and nothing is crossed when it says the level required is not met. The CLI's phase labels
number the steps, and its table of gated deliverables gives `SCOPE_PHASE`.

## 7. What it does not do

- It does not parse `currentGate`: the position is shown as the CLI writes it, and the current step is read from
  the documents' states.
- It reads no clock: a series' dates are the receiving service's, said declared.
- It adds nothing to `runward-fleet-index/0`, and the upload a service receives is unchanged: the path and the
  portfolio are read from the index as it is, and the point from the same bytes.
- It does not compare two states as better or worse, prints no percentage, and sums no states.
- It does not read a mission's documents: their text is another projection's (rendering and the register of
  decisions).

## 8. The fixtures

The golden inventory is the decision reading's: the five real `check --strict --json` exports of
`test/fixtures/fleet/decision/` (section 7 of [runward-fleet-decision.md](runward-fleet-decision.md)), a silent
mission and one received as a digest only. The series is four versions of an inventory built from the same
exports, the second one erased, given out of order. The projections (`portfolio`, every `path`, the `point`, the
series) are golden in `test/fixtures/golden/fleet/mission.{en,fr}.json`, and the digest of each page in
`mission.{en,fr}.sha256`, regenerated with `UPDATE_GOLDEN=1` and read in a diff.

## 9. For a hosted deployment

It pins a commit of `runward` that carries this specification and imports `runward-fleet/mission`. It writes
`point(index)` when it publishes a version of the index, computes it from the stored bytes for a version that has
none, and passes `series` the versions it received, with its own version number, order and reception date, and
`erased: true` for a version whose content was erased. The path and the portfolio are rendered from the index it
serves, so they are the same bytes as here for one index.
