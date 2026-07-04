# RUNWARD · Direction narrative et visuelle

> Proposition pour dépasser le « brutalisme bleu » actuel. Le site ne montre plus un style : il raconte le produit. Trois portes d'entrée, un seul tunnel de six portes, et au bout la production.

## 1. Le concept

**« La matière traverse le tunnel : ce qui entre en chaos mat ressort en lumière. »**

C'est exactement ce que fait Runward avec le code d'un agent : du brut non prouvé entre par une des trois portes (nouveau projet, spec existante, prototype existant), franchit six portes de preuve (Cadrer, Architecturer, Plancher, Itérer, Gouverner, Transmettre), et sort prêt pour la production. Le site incarne cette transformation par une métamorphose de matière en trois actes :

- **Acte I · chaos mat** : fragments anguleux, pigment sans reflet, wireframes. Rien ne brille, rien n'est prouvé.
- **Acte II · verre et métal** : dans le tunnel, la matière se discipline. Arêtes usinées, verre dépoli, reflets contrôlés. Chaque porte franchie polit l'objet.
- **Acte III · lumière** : la preuve faite, l'objet émet. Bloom maîtrisé, phosphore de terminal, blanc qui gagne.

Le cube reste le héros persistant : c'est LUI qui change de matière, pas le décor.

## 2. Storyboard (8 sections)

| # | Section | État de scène | Matière dominante | Moment signature |
|---|---|---|---|---|
| 01 | RUNWARD (hero) | Chaos en suspension, assemblage en cube en 2,2 s | Fragments mats, wireframe violet | Le cube se pose et le titre RUN / WARD. tombe avec lui, même respiration |
| 02 | LE CONSTAT | Aplat électrique uni, typo massive | Pigment plein, grain papier | Bascule brutale noir vers bleu : la démo passe, la production tranche |
| 03 | LES SIX PORTES | Le tunnel : six cadres wireframe en enfilade | Métal brossé naissant, verre dépoli sur les cadres | Le rail s'allume porte à porte ; à chaque porte franchie le cube gagne un reflet |
| 04 | LA PREUVE | Terminal en scène, grille au sol | Verre d'écran, phosphore | La grille de preuve s'illumine sous le terminal quand la boucle valide |
| 05 | LES ENTRÉES | Fond papier, trois encadrements tracés | Plan d'architecte, encre | Les trois portes convergent en perspective vers UN point de fuite : le tunnel de 03 |
| 06 | LES ARTEFACTS | Objets posés comme pièces usinées | Métal anodisé, arêtes franches | Chaque artefact sort « de presse », extrusion courte au scroll |
| 07 | APRÈS LA SPEC | Comparatif gravé, rangées qui tombent une à une | Verre technique, traits gravés | La rangée Runward tranche : seule ligne qui s'électrise |
| 08 | SHIP AND RUN | Aplat électrique qui monte vers la lumière | Lumière, bloom contenu | Le cube-bloc franchit la dernière porte (reprise du motif du logo) et laisse une traînée |

## 3. Assets générés (photo / vidéo IA) : là où le temps réel ne suffit pas

Le temps réel excelle pour l'interaction ; il plafonne sur la richesse de matière et les rendus fixes. Assets à générer :

- **og-image cinématique** : still du cube anodisé au milieu du tunnel, grain pellicule, profondeur de champ. Format : 1200 × 630 JPEG (< 300 Ko), variante 1080 × 1080 pour social.
- **Séquence vidéo d'assemblage** : le chaos qui devient cube puis lumière, 8 à 10 s, pour le README GitHub et les posts. Formats : MP4 H.264 1920 × 1080 + WebM VP9, fallback GIF 800 × 450.
- **Matcap sur-mesure** : sphère « bleu électrique anodisé » pour éclairer le cube Three.js sans coût de lumières. Format : PNG 512 × 512.
- **HDRI studio sombre** : reflets crédibles pour l'acte verre/métal. Format : .hdr ou .exr 2K, compressé en KTX2 au build.
- **Grain unifié** : texture de bruit tileable qui remplace les turbulences SVG dispersées. Format : PNG 1024 × 1024, un seul asset pour tout le site.
- **Trois plaques matière** (chaos mat, verre, lumière) : 2048 px, pour le moodboard Figma et d'éventuels fonds de section.

## 4. Figma connecté : ce qu'on y construit

- **Tokens (à lire ensuite via `get_variable_defs`)** : couleurs (electric, ink, paper, accent, muted, rule), échelle typo (giant, g-md, mono, kicker), espacements (paires min/max des clamp), et surtout **tokens de motion** : durées (rvd), staggers (rvs), easing (ease), délais d'acte. Le code CSS devient le miroir des variables, plus l'inverse.
- **Frames à dessiner pour implémentation fidèle** : un moodboard 3 frames (une par acte de matière) ; un storyboard 8 frames 1440 × 900 annotées (état initial, état final, courbe, déclencheur scroll) ; une spec image par image de l'assemblage du hero (0 s, 0,8 s, 1,6 s, 2,2 s, 2,6 s failsafe).
- **Shader fills** : lister les fills disponibles (`list_shader_fills`), récupérer grain animé ou iridescence via `get_shader_fill`, et les porter en GLSL dans les matériaux Three.js pour garder une source unique de vérité visuelle.

## 5. Les trois prochains sprints

1. **Sprint « Matière »** : matcap + HDRI sur le cube, grain unifié, calibration des trois actes. Done visuel : le cube lit comme un objet anodisé à toutes les sections, les aplats restent unis, captures avant/après validées.
2. **Sprint « Convergence »** : la section 05 gagne sa perspective vers le point de fuite commun ; lien visuel explicite 3 entrées vers 1 tunnel (ancre de caméra partagée avec 03). Done visuel : on comprend sans lire que trois entrées mènent au même tunnel ; scroll tenu à 60 fps.
3. **Sprint « Lumière »** : acte final, montée du bloom au franchissement de la dernière porte sans écraser le CTA ; export og-image + vidéo README aux formats cibles. Done visuel : le franchissement se voit en une capture, le texte du CTA reste net.

## Références (emprunts, pas copies)

- **Igloo Inc, par Abeto** (Site of the Year Awwwards 2024) : caméra continue et matière procédurale qui raconte (la glace y est le récit). On emprunte : la matière comme narration, un seul voyage de caméra.
- **Lusion v3** (Site of the Year Awwwards 2023) : transitions de scène sans couture, le 3D recule quand le texte parle. On emprunte : la hiérarchie stricte texte / scène.
- **bruno-simon.com** : l'objet-héros persistant qui rend le monde physique et attachant. On emprunte : le cube comme compagnon de tout le scroll.
- **Pages produit Apple (AirPods Pro)** : le scroll comme timeline déterministe, chaque section est un keyframe. On emprunte : le scrub précis, zéro animation qui joue « toute seule » hors intro.
