# runward v2 — prompts d'art direction (8 images)

> Génération des visuels définitifs du squelette `site/v2/index.html`.
> Une fois générées : déposer les fichiers dans `site/v2/img/` puis renseigner
> le tableau `IMAGE_SOURCES` en tête du `<script type="module">` d'`index.html`
> (ex. `IMAGE_SOURCES[0] = 'img/img-01.webp'`). Rien d'autre à changer :
> les placeholders canvas sont ignorés dès qu'une source est fournie,
> le shader gère le cadrage cover quel que soit le ratio.

## Socle stylistique commun (à préfixer sur chaque prompt)

```
Photographie minérale brumeuse, hyperréaliste, argentique moyen format.
Lumière rasante chaude de fin de journée, atmosphère silencieuse et monumentale.
Palette stricte : basalte presque noir #191715, greige chaux #E9E4DB,
vert brume sauge #C9D2C6 ; aucune autre couleur dominante.
Grain argentique fin et visible, légère brume atmosphérique, contraste doux.
Aucun humain, aucun animal, aucun texte, aucun logo, aucune végétation.
Rendu mat, matière avant tout : pierre, brume, lumière.
```

Négatifs communs : `illustration, 3D render plastique, saturation vive, bleu ciel,
néon, lens flare dur, HDR agressif, watermark, texte`.

---

## IMG-01 — Hero · vallée de brume, la porte lointaine
- **Format : 2048×1152 (paysage)** — fichier : `img/img-01.webp`
- Vaste vallée noyée dans une mer de brume sauge vue légèrement en plongée.
  Au loin, au centre, une porte monolithique rectangulaire dressée seule,
  minuscule dans l'immensité, **rétroéclairée par une unique lueur dorée chaude
  (#C9A45C)** qui perce la brume — seule source dorée de l'image.
  Premier plan : crêtes de basalte sombre émergeant de la nappe.
  Ciel greige voilé, sans bleu. Profondeur atmosphérique maximale.

## IMG-02 — CADRER · macro basalte veiné
- **Format : 2048×1152 (paysage)** — fichier : `img/img-02.webp`
- Macro frontale d'une surface de basalte noir mat (#191715), texture grenue
  finement détaillée, traversée de **deux ou trois fines veines minérales claires
  (chaux #E9E4DB)** qui serpentent en diagonale comme des courbes tracées.
  Lumière rasante venant de la gauche qui révèle le micro-relief.
  Aucun horizon, matière plein cadre.

## IMG-03 — ARCHITECTURER · l'enfilade des six monolithes
- **Format : 2048×1152 (paysage)** — fichier : `img/img-03.webp`
- Désert minéral greige noyé de brume basse. **Six monolithes de pierre sombre,
  identiques, alignés en enfilade** qui s'éloignent vers l'horizon en
  s'estompant dans la brume sauge — le plus proche net, le plus lointain
  presque dissous. Lumière rasante chaude effleurant leurs arêtes.
  Sol de sable compacté clair, ciel voilé chaux.

## IMG-04 — PLANCHER · le cristal et sa lueur
- **Format : 1536×2048 (portrait)** — fichier : `img/img-04.webp`
- Sur fond noir basalte profond, **un cristal brut vert sauge (#C9D2C6),
  translucide, aux facettes irrégulières**, posé seul, photographié en studio
  sombre. En son cœur, **une petite lueur dorée (#C9A45C) contenue**, comme une
  braise enchâssée — l'or n'existe nulle part ailleurs. Légère brume au sol,
  reflets froids sur les facettes, lumière rasante latérale très douce.

## IMG-05 — PREUVE · la pierre gravée
- **Format : 1536×2048 (portrait)** — fichier : `img/img-05.webp`
- Macro en lumière **très rasante** d'une dalle de pierre grise finement grenue,
  **gravée en creux de rangées de petits caractères géométriques abstraits**
  (glyphes techniques réguliers, illisibles, façon relevé lapidaire — pas de
  vraie langue). Les creux en ombre nette, les arêtes accrochant une lumière
  chaude. Cadre entièrement rempli par la pierre, perspective quasi frontale.

## IMG-06 — ARTEFACTS · strates sédimentaires fissurées
- **Format : 2048×1152 (paysage)** — fichier : `img/img-06.webp`
- **Vue zénithale** (drone à la verticale) de strates sédimentaires chaudes —
  ocres éteints, bruns basalte, greige — en bandes horizontales nettes,
  **traversées d'une fissure diagonale fine et continue** qui coupe tout le
  cadre. Lumière rasante chaude révélant le relief des couches. Aucun horizon,
  matière topographique plein cadre.

## IMG-07 — SHIP AND RUN · la plaine qui s'éclaircit
- **Format : 2048×1152 (paysage)** — fichier : `img/img-07.webp`
- Haute plaine minérale émergeant **au-dessus d'une mer de brume** sauge qui
  s'étend à perte de vue en contrebas. Le ciel s'éclaircit vers le haut du
  cadre en greige chaux lumineux — la seule image claire de la série,
  sensation d'aboutissement calme. Très légère chaleur dorée à l'horizon,
  premier plan de roche plate balayé de lumière rasante.

## IMG-08 — Footer · la dalle indigo
- **Format : 2048×1152 (paysage)** — fichier : `img/img-08.webp`
- Macro d'une **dalle minérale indigo profond (#241CC4 éteint, presque nuit)**,
  surface texturée mate — pierre teinte dans la masse, pas de peinture brillante.
  Micro-rayures et grain accrochant une très faible lumière rasante chaux.
  L'image la plus sombre et la plus sobre de la série : un sceau, un aplat
  matiériste. Aucun motif figuratif.

---

## Cohérence de série (check final avant intégration)
1. Même grain argentique et même température de lumière rasante sur les 8.
2. L'**or #C9A45C n'apparaît que** dans IMG-01 (porte), IMG-04 (cœur du cristal)
   et à peine IMG-07 (horizon) — nulle part ailleurs.
3. L'indigo n'existe **que** dans IMG-08.
4. Pas de ciel bleu, pas de vert végétal : brume sauge uniquement.
5. Exports : WebP qualité 82-88, profils sRGB, noms `img-01.webp` … `img-08.webp`.
