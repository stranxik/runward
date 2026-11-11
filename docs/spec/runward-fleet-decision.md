# runward-fleet: the decision reading, `runward-fleet-decision/0`

**Status**: specification of `runward-fleet-decision/0`, dated 2026-11-10, refined on 2026-11-11, with the code
that implements it (`packages/runward-fleet/ui/views.js`) · **Decided by**:
[ADR-0125](../adr/ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md),
refined by [ADR-0128](../adr/ADR-0128-the-decision-reading-groups-refusals-by-kind-and-by-text-folds-the-text-and-lists-refused-applications-first.md)
(the refusals grouped by kind and by text, the order of the applications, the five states always shown)
· **Reads**: `runward-fleet-index/0` ([runward-fleet-index.md](runward-fleet-index.md)) and nothing else
· **Closed lists**: [runward-closed-values.json](runward-closed-values.json)

The decision reading says, in plain words, what the team's own check says about each application, for a
reader who answers for what agents deliver and does not read code. It is a projection of the index: no
clock, no network, no model, nothing computed. Every count is a grouping the index holds, with its
denominator and the list it counts. Every sentence comes from the closed lexicon below, keyed on a closed
value of the index, and names the index path it was read from. The free text of a refusal (`problem`) is
shown character for character, marked as data, and never read. A value the lexicon does not know is shown
as written. The reader's decision is named in the title only: no state reads as a decision taken.

## 1. Where it lives, and how it is called

`runward-fleet/views` (`ui/views.js`, the module the static page inlines and a hosted deployment serves):

| Export | What it gives |
|---|---|
| `decide(index)` | the reading as a document, `runward-fleet-decision/0` (section 2) |
| `renderDecision(index, id?)` | its HTML: the portfolio, or the page of the application `id` (section 4) |
| `renderView(index, "decision", id?)` | the same, as the route `decision` of the views; `allViews` lists the portfolio and every application's page |
| `LEXICON`, `lexiconAt(lang, pointer)` | the lexicon in English and French, and the sentence a JSON Pointer (RFC 6901) names in it |
| `DECISION_FORMAT`, `DECISION_RULES` | `runward-fleet-decision/0`, and the rules of section 5 as the sources view lists them |

The static page opens on the reading when it has no hash (`#/decision`); `#/` is the fleet view, as before,
and every technical view is in the navigation.

## 2. The document

| Key | Content |
|---|---|
| `format` | `runward-fleet-decision/0` |
| `lang` | `en` or `fr`, the index's |
| `index` | `{ format, builtBy }` of the index read |
| `names` | `shown`, or `omitted` when the index leaves the names of people out (`fleet.json` `"names": "omitted"`) |
| `title` | a sentence: the title, the one place where the reader's decision is named |
| `listing` | the order the reading lists the applications in (ADR-0128): `ids`, read from the lists of `fleet.byVerdict`, the group `gaps` first, then `level-not-met`, then the other groups in the index's order, each list in the inventory's order (an application no list names comes after them, never dropped); and `note`, the sentence that says so, `from` `fleet.byVerdict` |
| `fleet` | `declared` (a number with its path) and `groups[]`: for each state of `fleet.byVerdict`, `{ state, label, count }`, `count` being `{ text, n, N, list, path }`; every state is present, `0 / N` included |
| `applications[]` | one per mission, in the inventory's order (`listing` gives the order of the page) |

An application: `id`, `path` (`missions[id=…]`), `name` (data), `state` (the index's own: `clean`,
`gaps`, `level-not-met`, `not-observed`, `not-available`, or any value it holds, never recomputed),
`stateWord` (for a check received whose export writes no verdict, "Check received, no state written",
never "No check received"), `qualifier` (after `clean` only), `date` (the last check received: the export's `at` label,
or "date not declared"; none for `not-observed`), `reason`, `kinds[]` (the refusals by kind, from
`latest.conformanceByKind`, each with its n / N, and its `texts[]`: for each text the check wrote for that
kind, from `byText`, `problem`, the text as data, read from the first refusal it lists; `label`, "Check
detail, as written" for one refusal, "(the same for n / N)" for several, N being the kind's; and
`refusals`, their positions in `problems`), `pieceCounts[]` (the documents not filled in, by state,
from `latest.deliverables.byState`), `problems[]` (each refusal: `line`, the sentence "{document}:
{kind}"; `where`, its file, line and requirement as data; `entry`, the sentence "{document}: {where}" the
page lists it with; `problem`, its text as data), `ungrouped` (the positions of the refusals no text group
lists: none for an index this version builds, every refusal for an index built before ADR-0128, each
then shown alone with its own sentence and text), `pieces[]` (the
documents not filled in, grouped by nature: `{ nature, label, items[] }`), `endorsement` (`detailed`,
`lines[]`, `disclosure[]`, `declared`), `origin` (from `implemented`) and `version` (the `runward`
version the export names). A grouping read from an export's own values is named by its position
(`…byMode[3]`, `…conformanceByKind[0]`, `fleet.byVerdict[1]`), so a value that holds any character still
resolves. The reading shows no count that is not a grouping: proposals are said by the refusals of kind
`proposed`, with their n / N, and a mode that is not detailed is said without a number.

A sentence is `{ key, text, from?, args? }`: `key` is the JSON Pointer of its template in the lexicon of
the document's language, `text` the template filled, `from` the index path of the closed value it was read
from, and `args` the values it was filled with, each `{ text, path, verbatim }` for data (with `code` when it is
shown as code), `{ text, n, N, list, path, src }` for a grouping, `{ text, value, path, src }` for a number
(`src` being the id of the source that gives it), or `{ text, sentence }` for a sentence of the lexicon set
inside another.

## 3. The lexicon

`LEXICON.en` and `LEXICON.fr` hold the same keys (a rule of section 5). French puts a no-break space before
a colon. The sentence that always follows `clean` (`qualifier.clean`) reads "according to the team's
requirements", in French "selon les exigences de l'équipe", and the date line "Last check received:
{date}", in French "Dernier contrôle reçu : {date}". `{…}` is a value, filled as data.

**The order of the list** (`orderByState`, the note of the portfolio, ADR-0128; `order` is kept for a view
listed in the inventory's order)

| Key | English | French |
|---|---|---|
| `orderByState` | Sorted by state: refused by the check first, then required level not met, then the others; within a state, in the order of the inventory. | Triées par état : refusées par le contrôle d'abord, puis niveau exigé non atteint, puis les autres ; dans un même état, dans l'ordre de l'inventaire. |
| `order` | Applications are listed in the order of the inventory. | Les applications sont listées dans l'ordre de l'inventaire. |

**States** (`state`) and the fleet's labels (`group`, plural in French; the label of `clean` carries the requirements)

| State | English | French |
|---|---|---|
| `clean` | Nothing is blocking | Rien ne bloque |
| `gaps` | Refused by the check | Refusée par le contrôle |
| `level-not-met` | Required level not met | Niveau exigé non atteint |
| `not-observed` | No check received | Aucun contrôle reçu |
| `not-available` | Content not shared | Contenu non partagé |



| Group | English | French |
|---|---|---|
| `clean` | Nothing is blocking, according to the team's requirements | Rien ne bloque, selon les exigences de l'équipe |
| `gaps` | Refused by the check | Refusées par le contrôle |
| `level-not-met` | Required level not met | Niveau exigé non atteint |
| `not-observed` | No check received | Aucun contrôle reçu |
| `not-available` | Content not shared | Contenu non partagé |

**Reasons** (`reason`); a check received that writes no state (`received`)

| State | English | French |
|---|---|---|
| `clean` | The check found no missing document and refuses nothing. The decision stays yours. | Le contrôle n'a relevé aucune pièce manquante et ne refuse rien. La décision reste la vôtre. |
| `gaps` | The check refuses this version, for the reasons that follow. | Le contrôle refuse cette version, pour les raisons qui suivent. |
| `level-not-met` | No gap was found, but the evidence does not reach the level the team requires. | Aucun écart, mais le niveau de preuve que l'équipe exige n'est pas atteint. |
| `not-observed` | No check has been received for this application. | Aucun contrôle n'a été reçu pour cette application. |
| `not-available` | Only fingerprints are sent for this application: its content is not shared. | Seules des empreintes remontent pour cette application : son contenu n'est pas partagé. |



| Received | English | French |
|---|---|---|
| `state` | Check received, no state written | Contrôle reçu, sans état écrit |
| `reason` | The check received for this application writes no state. | Le contrôle reçu pour cette application n'écrit pas d'état. |

**Refusals** (`kind`), each after its document or part of the record: "{subject}: {reason}"

| Kind | English | French |
|---|---|---|
| `proposed` | a proposed answer is not yet endorsed. | un point proposé n'est pas encore validé. |
| `missing-row` | a requirement of the team has no answer in the record. | une exigence de l'équipe n'a pas de réponse dans le dossier. |
| `empty-status` | a requirement of the team has no answer chosen yet. | une exigence de l'équipe n'a pas encore de réponse choisie. |
| `invalid-status` | a requirement has an answer the check does not recognise. | une exigence a une réponse que le contrôle ne reconnaît pas. |
| `applied-without-evidence` | a requirement is said to be met, with no evidence attached. | une exigence est dite tenue sans preuve jointe. |
| `evidence-placeholder` | a requirement is said to be met, its evidence left as the template's example. | une exigence est dite tenue, sa preuve laissée telle que le modèle l'écrit. |
| `deviated-without-adr` | a deliberate deviation has no written decision. | un écart assumé n'a pas sa décision écrite. |
| `na-without-reason` | a requirement is set aside with no written reason. | une exigence est écartée sans raison écrite. |
| `unknown-rule` | the record answers a requirement that is not among the team's rules. | le dossier répond à une exigence qui n'existe pas dans les règles de l'équipe. |
| `duplicate-row` | a requirement has several answers in the record. | une exigence a plusieurs réponses dans le dossier. |
| `deliverable-missing` | a required document is missing. | une pièce exigée est absente. |
| `manifest-unreadable` | the check cannot read this document's list of answers in full. | le contrôle ne peut pas lire en entier la liste des réponses de cette pièce. |
| `mapping-floor` | this document's list of requirements was cut below its minimum. | la liste des exigences de cette pièce a été réduite sous son minimum. |
| `unresolved-pointer` | the record cites a file or an item the check cannot find. | le dossier cite un fichier ou un élément que le contrôle ne trouve pas. |
| `evidence-refused` | a cited piece of evidence is refused by the check. | une preuve citée est refusée par le contrôle. |
| `requires-unmet` | a requirement asks for evidence of another kind than the one cited. | une exigence demande une preuve d'une autre nature que celle qui est citée. |
| `rule-violation` | the check refuses an answer in the record. | le contrôle refuse une réponse du dossier. |
| `corpus-missing` | one of the team's rules was deleted. | une des règles de l'équipe a été supprimée. |
| `corpus-edited` | one of the team's rules was changed since it was set up. | une des règles de l'équipe a été modifiée depuis sa mise en place. |
| `corpus-extra` | a rule was added without going through the tool. | une règle a été ajoutée sans passer par l'outil. |
| `corpus-unrecorded` | the team's rules are not recorded: the check cannot tell whether they changed. | l'état des règles de l'équipe n'est pas enregistré : le contrôle ne peut pas dire si elles ont changé. |
| `seal-violation` | a piece of evidence changed since it was recorded. | une preuve a changé depuis son enregistrement. |
| `unratified-decision` | a written decision is not yet endorsed. | une décision écrite n'est pas encore validée. |
| `unbound-row` | an item's endorsement is not accepted under the stricter rules the team chose. | la validation d'un point n'est pas retenue sous les règles plus strictes que l'équipe a choisies. |
| `charter-malformed` | the charter that delegates acts to agents is malformed. | la charte de délégation aux agents est mal formée. |
| `charter-stage-unread` | the delegation charter declares a level this version of the check cannot read. | la charte de délégation déclare un niveau que cette version du contrôle ne sait pas lire. |
| `charter-class-refused` | the charter delegates to agents an act that cannot be delegated to them. | la charte délègue aux agents un acte qui ne peut pas leur être délégué. |
| `charter-expired` | an agent acted after its delegation ended. | un agent a agi après la fin de sa délégation. |
| `agent-not-delegate` | an agent endorsed an item without being a delegate of the charter. | un agent a validé un point sans figurer parmi les délégués de la charte. |
| `sample-malformed` | the record of sample reviews is malformed. | le relevé des revues par échantillon est mal formé. |
| `sample-missed` | an agent acted while the sample reviews did not take place. | un agent a agi alors que les revues par échantillon n'ont pas eu lieu. |
| `class-suspended` | an agent acted in a class of acts that a sample review suspended. | un agent a agi dans une catégorie d'actes qu'une revue par échantillon a suspendue. |
| `analysis-boundary` | the delivered code crosses a boundary the team declared. | le code livré franchit une frontière que l'équipe a déclarée. |
| `analysis-capability` | the delivered code uses a capability the team did not allow there. | le code livré utilise une capacité que l'équipe n'a pas autorisée à cet endroit. |
| `analysis-secret` | the delivered code holds what looks like a secret. | le code livré contient ce qui ressemble à un secret. |
| `analysis-test-integrity` | a test of the delivered code does not check what it claims to. | un test du code livré ne vérifie pas ce qu'il annonce. |
| `analysis-symbol` | a name the record cites has no real content in the delivered code. | un nom que cite le dossier n'a pas de contenu réel dans le code livré. |
| `analysis-linkage` | a file the record cites refers to an item that does not exist. | un fichier que cite le dossier fait appel à un élément qui n'existe pas. |
| `analysis-policy` | the analysis policy the team chose is unknown to this version of the check. | la politique d'analyse choisie par l'équipe est inconnue de cette version du contrôle. |
| `not-observed` | a refusal whose kind the check does not write. | un refus dont le contrôle n'écrit pas le genre. |

**What the check refuses** (`problems`): a kind's sentence, then each text of that kind once, behind a
disclosure, then where each refusal is, behind a second one when there are several (ADR-0128). The label of
the text does not name its language: the text carries `lang="en"`.

| Key | English | French |
|---|---|---|
| `title` | What the check refuses | Ce que le contrôle refuse |
| `byKind` | {count} refusals of this kind: {reason} | {count} refus de ce genre : {reason} |
| `detail` | Check detail, as written | Détail du contrôle, tel quel |
| `same` | Check detail, as written (the same for {count}) | Détail du contrôle, tel quel (le même pour {count}) |
| `items` | Where, refusal by refusal | Où, refus par refus |
| `entry` | {subject}: {where} | {subject} : {where} |
| `line` | {subject}: {reason} | {subject} : {reason} |
| `where` | {file}, line {line}, requirement {rule} | {file}, ligne {line}, exigence {rule} |
| `whereFile` | {file}, requirement {rule} | {file}, exigence {rule} |
| `whereRule` | requirement {rule} | exigence {rule} |

**Documents** (`pieces.piece`, keyed on `relPath`)

| Deliverable | English | French |
|---|---|---|
| `framing.md` | Framing note | Note de cadrage |
| `mission-contract.md` | Steering agreement | Contrat de pilotage |
| `architecture.md` | Architecture note | Note d'architecture |
| `execution-topology.md` | Execution map | Carte d'exécution |
| `decision-matrix.md` | Decision matrix | Matrice de décision |
| `adr` | Written decisions | Décisions écrites |
| `contracts` | Interface contracts | Contrats d'interface |
| `floor.md` | First-version measurements | Mesures de la première version |
| `governance/threat-model.md` | Security assessment | Dossier de sécurité |
| `governance/evaluation-rubric.md` | Evaluation criteria | Grille d'évaluation |
| `governance/observability-schema.md` | Monitoring plan | Plan de surveillance |
| `runbook.md` | Recovery procedure | Procédure de reprise |
| `handover.md` | Handover note | Note de passation |

**Natures** (`pieces.nature`, keyed on `phaseId`; never numbered; `natureNone` when the export writes none)

| Phase | English | French |
|---|---|---|
| `frame` | Framing | Cadrage |
| `architect` | Design | Conception |
| `topology` | Design | Conception |
| `floor` | First version in service | Première version en service |
| `govern` | Controls | Contrôles |
| `handover` | Handover | Passation |

**States and causes of a document** (`pieces.state`, `pieces.count`, `pieces.cause`)

| State | English | French |
|---|---|---|
| `missing` | document absent | pièce absente |
| `untouched` | missing document | pièce manquante |
| `in-progress` | document started, not finished | pièce commencée, pas finie |
| `filled` | document filled in | pièce remplie |



| Count | English | French |
|---|---|---|
| `missing` | {count} documents absent | {count} pièces absentes |
| `untouched` | {count} documents missing | {count} pièces manquantes |
| `in-progress` | {count} documents started, not finished | {count} pièces commencées, pas finies |
| `filled` | {count} documents filled in | {count} pièces remplies |



| Cause | English | French |
|---|---|---|
| `placeholders` | parts are still to be filled in | des passages restent à remplir |
| `below-floor` | the text is still too short to count | le texte est encore trop court pour compter |
| `missing-section` | an expected section is missing | une section attendue manque |
| `invalid-field` | an expected field does not have the required form | un champ attendu n'a pas la forme demandée |
| `row-out-of-domain` | a line holds a value outside the allowed list | une ligne contient une valeur hors de la liste permise |
| `incoherent-rows` | lines contradict each other | des lignes se contredisent |
| `broken-echo` | a passage that must be repeated in another document is not | un passage à reprendre dans une autre pièce ne l'est pas |

**Parts of the record** (`scope`, when the file is not a document)

| Scope | English | French |
|---|---|---|
| `Architect` | Design | Conception |
| `Topology` | Design | Conception |
| `Floor` | First version in service | Première version en service |
| `Govern` | Controls | Contrôles |
| `Handover` | Handover | Passation |
| `corpus` | The team's rules | Règles de l'équipe |
| `evidence-seal` | Evidence record | Enregistrement des preuves |
| `reconstruction` | Written decisions | Décisions écrites |
| `delegation` | Delegation to agents | Délégation aux agents |
| `ratification` | Endorsements | Validations |
| `analysis` | Delivered code | Code livré |

**How rows were endorsed** (`endorsement.mode`, keyed on `ratification.byMode`)

| Mode or state | English | French |
|---|---|---|
| `line-by-line` | {count} items endorsed item by item | {count} points validés point par point |
| `en bloc` | {count} items endorsed all at once | {count} points validés en une fois |
| `agent` | {count} items endorsed by a reviewing agent | {count} points validés par un agent relecteur |
| `agent (single accountable)` | {count} items endorsed by a reviewing agent; the same person answers for the agent that proposed them and for the one that endorsed them | {count} points validés par un agent relecteur ; la même personne répond de l'agent qui les a proposés et de celui qui les a validés |
| `blind` | {count} items endorsed without reviewing the detail | {count} points validés sans relecture du détail |
| `changed` | {count} items changed since they were endorsed | {count} points modifiés depuis leur validation |
| `untraced` | {count} items with no endorsement recorded | {count} points sans validation enregistrée |
| `not-observed` | {count} items endorsed, with no mode written | {count} points validés, sans mode écrit |

**Agents, and what is not detailed** (`endorsement`)

| Key | English | French |
|---|---|---|
| `agent` | {count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of {person} (declared person) | {count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité de la personne déclarée {person} |
| `agentSingle` | {count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of {person} (declared person); the same person answers for the agent that proposed them and for the one that endorsed them | {count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité de la personne déclarée {person} ; la même personne répond de l'agent qui les a proposés et de celui qui les a validés |
| `agentNotPublished` | {count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of a declared person whose name is not published here | {count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité d'une personne déclarée dont le nom n'est pas publié ici |
| `agentSingleNotPublished` | {count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of a declared person whose name is not published here; the same person answers for the agent that proposed them and for the one that endorsed them | {count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité d'une personne déclarée dont le nom n'est pas publié ici ; la même personne répond de l'agent qui les a proposés et de celui qui les a validés |
| `agentNoPerson` | {count} items endorsed by a reviewing agent ({agent}, declared name), with no person declared as responsible | {count} points validés par un agent relecteur ({agent}, nom déclaré), sans personne responsable déclarée |
| `noneRecorded` | No endorsement recorded. | Aucune validation enregistrée. |
| `notDetailed` | Endorsement mode not detailed. | Mode de validation non détaillé. |
| `declared` | These names and modes are declared by the team: the check does not verify who answered. | Ces noms et ces modes sont déclarés par l'équipe : le contrôle ne vérifie pas qui a répondu. |
| `disclosure` | What the check writes about it: | Ce que le contrôle écrit à ce sujet : |

**Where the reading comes from** (`origin`, keyed on `implemented`)

| Value | English | French |
|---|---|---|
| `ci-declared` | Where this comes from: computed in the team's delivery chain. | D'où vient cette lecture : calculée par la chaîne de livraison de l'équipe. |
| `machine-established` | Where this comes from: computed in the team's delivery chain; its signature was verified by this page, under the operator's trust policy. | D'où vient cette lecture : calculée par la chaîne de livraison de l'équipe ; sa signature a été vérifiée par cette page, sous la politique de confiance de l'opérateur. |
| `version` | Check run with runward {version}. | Contrôle fait avec runward {version}. |

**A value the lexicon does not know** (`unknown`): shown as written, marked as data

| Of | English | French |
|---|---|---|
| `state` | State as the check writes it: {value} | État tel que le contrôle l'écrit : {value} |
| `kind` | detail of the check, as written: {value}. | détail du contrôle, tel quel : {value}. |
| `piece` | Document as the check names it: {value} | Pièce telle que le contrôle la nomme : {value} |
| `scope` | Part of the record as the check names it: {value} | Partie du dossier telle que le contrôle la nomme : {value} |
| `nature` | Kind of document as the check names it: {value} | Nature telle que le contrôle la nomme : {value} |
| `pieceState` | state as the check writes it: {value} | état tel que le contrôle l'écrit : {value} |
| `cause` | cause as the check writes it: {value} | cause telle que le contrôle l'écrit : {value} |
| `mode` | {count} items, endorsed in a mode as the check writes it: {value} | {count} points, validés selon un mode tel que le contrôle l'écrit : {value} |
| `origin` | Where this comes from, as the record writes it: {value} | D'où vient cette lecture, telle que le relevé l'écrit : {value} |

**The English words.** The French state words were chosen by the maintainer; the English ones are their
equivalents, each said as the fact it is. "Refused by the check" is the CLI's own word for `gaps`; "failed"
would read as pass or fail, "blocked" claims a release depends on the check, which the index does not
carry. "Required level not met" is the view's word for `level-not-met` since 2026-11-06. "No check
received" says that nothing was ever received, which "silent" or "no news" would blur. "Nothing is
blocking" (`clean`) is a status that decides nothing: "clear" and "cleared" read as an approval, "no
blockers" is a tracker's jargon. A row's endorsement is "endorsed": "approved" names an approval this
check does not make, and "validated" reads as a verification. The French "points" of the record are
English "items"; its "dossier" is "the record".

## 4. The HTML and its style roles

Each element carries a role, never a look: the static page styles the roles with its tokens
(`ui/template.html`), a hosted deployment with its own layer, and both render the same bytes from the same
index. A state is said by its word and its shape (`data-role="mark"`, per `data-state`), never by a colour
alone; a refusal inverts the two grounds on the static page.

| `data-role` | Holds |
|---|---|
| `title`, `lede`, `note` | the title, the line under it, the order of the list |
| `groups`, `group`, `group-label` | the fleet's groupings by state, each with its n / N: every state, `0 / N` included, `gaps` and `level-not-met` first |
| `applications`, `application` | the list of applications (`data-state`, `data-mission`), in the order of `listing` |
| `name` | an application's name, data |
| `state`, `mark`, `state-word` | the state line (`data-state`), its shape, its word |
| `qualifier`, `date`, `reason` | what follows the state |
| `kinds`, `kind`, `piece-count` | why, in a few lines: refusals by kind, documents not filled in by state, each with n / N (an application's page says the kinds in `problems`) |
| `problems`, `refusal-kinds`, `refusal-kind`, `sentence` | what the check refuses: one item per kind, its sentence with n / N |
| `refusal-text` | one text of a kind: its detail, then where its refusals are |
| `detail`, `detail-label`, `verbatim` | the check's text as written (`lang="en"`), once, in a `<details>` whose `<summary>` is its label with the n / N it stands for; the first of the page is open. On the endorsement, the CLI's own disclosure, in a `<div>` |
| `where`, `where-label`, `refusals` | where the refusals of one text are, in a `<details>` when there are several |
| `problem` | one refusal: "{document}: {file}, line {line}, requirement {rule}", carrying its index path (`data-index`) |
| `pieces`, `legend`, `nature`, `piece` | the documents not filled in, by nature |
| `endorsement` | how the rows were endorsed |
| `origin`, `version`, `links`, `back` | where it comes from, the version that checked, the way to the technical detail |

Data is marked as the views mark it: `<span data-verbatim>`, `<code>`, and `<!--verbatim:start-->` around
the check's text. Every number is a `<span class="n">` with its `data-index`, and a count is always n / N.
Nothing is folded by a script: `<details>` folds, and every refusal is in the HTML whether it is open or not.

## 5. Its rules

Held by the build on every rendered view of the reading and on the whole lexicon before a page is written
(`checkReading`, `checkLexicon`, `checkRefusals` of `runward-fleet/rules`), and by
`test/unit/fleet-decision.test.js`, each with a planted control:

| # | Rule | Held by |
|---|---|---|
| R1 | the reading's own words hold none of the method's internal words (`INTERNAL`) | build and test |
| R2 | every closed value the CLI writes has a sentence in both languages, which hold the same keys; an unknown value is shown as written | test (the closed lists against the CLI's code) and build (the two languages hold the same keys) |
| R3 | no state, group label or reason reads as a decision taken (`NOT_A_STATE`); the decision is named in a title only | build and test |
| R4 | "nothing is blocking" is always followed by the team's requirements, and, for an application, by the date of the last check (the export's `at` label, or "date not declared": a static inventory may declare none) | build and test (on each application's state, and on the fleet's label, which carries the requirements) |
| R5 | a row endorsed by an agent is never worded as a person's; a refusal's text is shown as written and never read | test (a planted copy of the view that says an agent's rows in a person's words is caught; every `problem` reworded moves no sentence) |
| R6 | grouped, no refusal is hidden: within a kind, the text groups partition its refusals, each n / N of the kind and holding only refusals of its text; an application's page lists every refusal once, under its index path (ADR-0128) | build (`checkIndex` on the index, `checkRefusals` on each application's page) and test (a refusal taken out of a group, out of a page, or listed twice, and a planted copy of the view that lists one fewer, are refused) |

The words runward never says (`BANNED`) are held on every view, the reading's included, in each listed form
and with boundaries of any script. The eighteen rules of ADR-0093 decision 11 hold too.

## 6. What it does not do

- It shows no history of states: the index carries the last check of each application only.
- It names no symbol from a refusal's text: that needs a structured field the CLI does not write.
- It computes no state, no count, no score, no percentage, no threshold on a date. The groupings by text
  and the order of the applications are read from the index (`byText`, `fleet.byVerdict`); the page sorts
  nothing by date: the `at` label is data, not a clock.
- With names omitted, it knows the names the exports declare in fields (who ratified in a person's mode,
  the person an agent answers to), and refuses an index where one of them appears in any mission's
  projected text, across any run of blanks: a name written only in free text and declared in no field is
  not one it knows.

## 7. The fixtures

`test/fixtures/fleet/decision/` holds real `check --strict --json` exports, each with its `mission`
replaced by a label that says where it comes from (the field is never projected), every other byte as the
CLI wrote it:

| File | Written by | On |
|---|---|---|
| `demo-renamed.check.json` | runward 0.46.0, in CI | `stranxik/runward-demo-renaming`, a name changed in the code (run 42836065477): two refusals `evidence-refused` |
| `demo-repaired.check.json` | runward 0.46.0, in CI | the same, the record following the new name (run 42836073560): `clean` |
| `hosted-proposed.check.json` | runward 0.46.0 from npm | `stranxik/runward-hosted` at `a4ede14`: 42 rows proposed, 4 missing, one document untouched; four texts for its 46 refusals (22, 19 and 1 of the kind `proposed`, 4 of `missing-row`), the case of many identical refusals |
| `agent-ratified.check.json` | runward 0.46.0 from npm | `init --example`, two rows proposed then ratified with `ratify --agent review-bot --for Alice` (one with `--single-accountable`), the rows of the threat model ratified line by line by a person (written by the library function the interactive command calls) |
| `level-not-met.check.json` | the CLI of this tree at `5a9cdf0` | `init --example`, `check --strict --require attested`: `level-not-met`, exit 5 (the published 0.46.0 does not write it; the build names itself 0.46.0, RWD-2026-0210) |

The decision readings of an inventory of these five, a silent mission and one received as a digest only
are golden (`test/fixtures/golden/fleet/decision.{en,fr}.json`, and the digest of each page in
`decision.{en,fr}.sha256`), regenerated with `UPDATE_GOLDEN=1` and read in a diff.

## 8. For a hosted deployment

It pins a commit of `main` that carries this specification, imports `decide` and `renderDecision` from
`runward-fleet/views`, and renders the reading from the index it serves, so the part drawn from the index is
the same bytes as in `runward-fleet build`. It writes the date of the last accepted upload as the export's
`at` label, declares an upload whose content is not consented by its `sha256` alone, and sets `"names":
"omitted"` for a page published in public. What only the service knows (an upload not accepted and its
reason, consent, access) it words from its own lexicon, under the same word rules.
