# Direction de design · v3 : « Éprouvé, pas déclaré »

## Le concept, tiré du corpus (pas d'un moodboard)

Les mots ne viennent pas d'un brainstorm : ils viennent de la doctrine et de la méthode.
Le verbe qui structure tout le corpus est **tenir** (« un système qui tient en production », « des bases qui durent », le **plancher**). La loi morale est dans la postface de la doctrine : « un système agentique fiable n'est pas un exploit, c'est une **discipline** ». Le refrain du framework : « **demonstrated, not declared** », aucune porte franchie sur affirmation. Les autres mots porteurs relevés : **preuve**, **sobre** (le défaut sobre), **calme** (on ne discipline avec ce soin que ce qu'on veut utiliser longtemps), **transmettre**.

Le motif central en découle :

> **La matière qui se prouve.** Ce qui entre est une vapeur : l'idée, le prototype, le vibe coding : brillant, mobile, sans consistance. Chaque porte est une épreuve visible : la matière y est chargée, testée, et en ressort plus dense. À la sortie, elle est devenue un **plancher** : une dalle sobre, mate, qui porte. On ne voit jamais la page AFFIRMER : on la voit éprouver.

Pourquoi c'est mieux que le cube (primitive tech muette) et que le flux (jamais dans le corpus, et la fluidité seule ne dit pas la preuve) : la condensation vapeur → solide raconte exactement la promesse produit, et le mot d'arrivée est déjà dans le vocabulaire runward : le plancher.

## Les techniques des références, pas leur style

De Shopify Editions on prend la **respiration éditoriale** (des moments forts courts, puis du calme) et la vidéo brève par moment signature. De Hubtown on prend le **voyage d'une seule caméra en profondeur**, le preloader qui installe le calme, la typo géante fractionnée, les particules. **On ne prend ni leurs palettes ni leur ton** : la nôtre reste encre / électrique #241CC4 / papier, la typo reste Neue Haas / Departure Mono. Ces sites prouvent des techniques ; l'identité reste la nôtre.

## Storyboard v3 (l'état de la matière par section)

| # | Section | État de la matière | Moment signature |
|---|---|---|---|
| 1 | RUNWARD | **Vapeur** : nuée de particules brillantes, belle mais instable, qui tourbillonne autour du titre | La nuée frôle les lettres ; on sent qu'elle ne PORTE rien encore |
| 2 | Le constat | La vapeur passe derrière l'aplat ; une première ligne se fige | « La démo passe. La production tranche. » : la vapeur, c'est la démo |
| 3 | Les six portes | **Condensation** : à chaque écluse, la nuée perd de l'agitation et gagne de la densité ; des arêtes apparaissent | Porte franchie = un claquement calme : la matière « prend », un dépôt reste |
| 4 | La preuve | Premier **solide** : une dalle test porte une charge (le terminal posé dessus) et ne fléchit pas | Le terminal repose sur la matière éprouvée ; le ✓ se dépose |
| 5 | Les entrées | Trois vapeurs distinctes convergent vers la même première écluse | Trois chemins, une seule épreuve |
| 6 | Les artefacts | Les **dépôts** des portes : chaque document est un sédiment daté de l'épreuve | La pile = ce que la preuve laisse derrière elle |
| 7 | Après la spec | Les vapeurs des autres s'évaporent au bord du cadre ; la matière éprouvée continue | Ce qui n'est pas éprouvé se dissipe |
| 8 | Ship and run | Le **plancher** : dalle sobre, mate, immense, qui porte le lettrage final | La matière ne bouge plus : elle tient. Le calme comme preuve |

## Ce que ça change au ton

Sortir de l'ultra-tech ne passe pas par la douceur décorative mais par le **calme gagné** : le début est agité (vapeur), la fin est immobile (plancher) : la page se discipline elle-même à mesure qu'on la descend. Brume volumétrique et verre dépoli au début, matités minérales à la fin. Le terminal reste le seul objet assumé tech : c'est l'instrument de mesure. Le noir peut se bleuter légèrement dans les profondeurs de scène (technique), la charte de surface ne bouge pas.

## Assets générés et Figma

Assets IA quand le temps réel ne suffit pas : spritesheet de particules de condensation, texture minérale de la dalle finale (2048, tileable), og-image « la dalle et la nuée », séquence vidéo 6 s vapeur → plancher pour README et réseaux. Figma (connecté) : frames de storyboard des 8 états de matière à annoter par l'auteur, tokens de motion (durées, easings, densités par acte) lus via `get_variable_defs` avant chaque sprint.

## Sprints v3

1. **Vapeur** : remplacer fragments/cube par le système de particules (hero + constat). Done : au premier écran, on croit à une matière, pas à un effet.
2. **Épreuve** : la condensation aux six écluses + le claquement calme par porte. Done : franchir une porte se SENT sans un mot de texte.
3. **Plancher** : la dalle de preuve (section 4) et la dalle finale (section 8), matités, dépôts d'artefacts. Done : l'arrivée est immobile et on trouve ça juste.

## Survivants des versions précédentes

Le voyage caméra scroll-scrub, les 8 sections et leur copy validée, la hiérarchie texte/scène, le terminal-preuve, la boucle visuelle sur localhost, les gardes perf/reduced-motion. Tout le reste (cube, tunnel filaire comme motif, palette empruntée) est remplacé par la matière qui se prouve.
