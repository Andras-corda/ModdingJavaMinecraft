# Blockbench : entités & GeckoLib

Créer un **modèle d'entité animé** dans Blockbench et l'exporter au format **GeckoLib** (`.geo.json` + `.animation.json`).

Cette page est le **volet artistique** ; le **volet code** (classes `GeoEntity`, `GeoModel`, renderers) est sur [GeckoLib : animations](#/geckolib).

Prérequis : [Blockbench : prise en main](#/blockbench-prise-en-main).

## Mise en place

1. Installer le plugin **GeckoLib Animation Utils** : *File → Plugins → rechercher « GeckoLib »*.
2. **File → New → Bedrock Entity Model** (c'est le format que GeckoLib consomme — **pas** « Modded Entity », qui vise le système Forge natif).
3. Réglez la **texture size** du projet (largeur × hauteur de l'atlas UV, ex. 64×64).

## Modéliser avec des os

Un modèle animé s'organise en **groupes = os** (*bones*), chacun avec un **point de pivot** placé à l'articulation.

```text
sprite                    (os racine, pivot au sol/centre)
├── body                  (pivot au bas du torse)
│   ├── head              (pivot au cou)
│   ├── arm_left          (pivot à l'épaule gauche)
│   ├── arm_right         (pivot à l'épaule droite)
│   ├── leg_left          (pivot à la hanche gauche)
│   └── leg_right         (pivot à la hanche droite)
└── ...
```

Règles :

- **Un os par partie qui bouge indépendamment.** Une jambe = un os ; si le genou plie, deux os (`leg_upper` → `leg_lower`).
- Le **pivot** de chaque os va **sur l'axe de rotation réel** (l'épaule, pas le milieu du bras). C'est ce qui rend une animation crédible.
- Nommez les os de façon stable : ces noms sont réutilisés dans les animations **et** dans le code (`setCustomAnimations`, os cachés/colorés).
- **Inflate** : élargit un cube uniformément (utile pour une « couche » type casque/fourrure par-dessus la tête).

## UV et texture

- Onglet **UV** : chaque cube a un dépliage « box UV » (une croix dépliée). *Auto UV* place tout sans chevauchement.
- Peignez en mode **Paint**, ou exportez la texture vierge (*Textures → clic droit → Save*), peignez ailleurs ([Pixel art & textures](#/pixel-art-textures)), réimportez.
- La texture d'entité va dans `assets/monmod/textures/entity/`.

## Animer (mode **Animate**)

1. Passez en mode **Animate**. Panneau **Animations → +** : créez `animation.sprite.walk` (le nom **doit** commencer par `animation.<nom_du_geo>.`).
2. Réglez **Loop** : `loop` (marche, idle), `hold on last frame` (attaque), `once`.
3. Sélectionnez un os, avancez le curseur de la **Timeline**, modifiez rotation/position/échelle → une **image-clé** est posée.
4. Répétez pour créer le cycle. Clic droit sur une keyframe → **easing** (linéaire, ease-in/out, pas…) pour le rythme.
5. `snapping` de la timeline réglé sur 20 ou 24 fps facilite la synchro avec les ticks.

Animations conventionnelles : `idle`, `walk`, `run`, `attack`, `sit`, `fly`, `death`. Ce sont les noms que le code appelle dans les `AnimationController` (voir [GeckoLib](#/geckolib)).

> :astuce: **Molang.** Blockbench accepte des expressions dans les champs de keyframe (`math.sin(query.anim_time * 20) * 5`). GeckoLib les évalue. Pratique pour une oscillation continue sans poser 20 keyframes, mais gardez-le simple.

## Exporter pour GeckoLib

Deux fichiers, dans deux dossiers :

| Contenu | Menu Blockbench | Destination |
|---------|-----------------|-------------|
| Le maillage | **File → Export → GeckoLib Model** (`.geo.json`) | `assets/monmod/geo/entity/sprite.geo.json` |
| Les animations | mode Animate → **menu Animations → Export** (`.animation.json`) | `assets/monmod/animations/entity/sprite.animation.json` |
| La texture | Textures → clic droit → **Save** | `assets/monmod/textures/entity/sprite.png` |

Les **trois chemins** sont ceux que renvoie votre `GeoModel` en Java (`getModelResource`, `getAnimationResource`, `getTextureResource`). Avec `DefaultedEntityGeoModel`, ils sont déduits du nom — respectez alors exactement `geo/entity/`, `animations/entity/`, `textures/entity/` + même nom de fichier.

## Réimporter pour modifier

- **Le projet** : gardez le `.bbmodel` (source Blockbench) dans le dépôt, hors de `src/` (ex. `art/models/sprite.bbmodel`). *File → Open* pour le rouvrir plus tard. C'est **lui** qu'on édite, pas le `.geo.json` exporté.
- **Un `.geo.json` sans le `.bbmodel`** (modèle d'un autre mod, ou `.bbmodel` perdu) : *File → Open* le `.geo.json` — Blockbench le reconstruit en projet éditable.
- **Des animations** : *menu Animations → Import* pour recharger un `.animation.json` dans un projet ouvert.

## Block entities & armures

Même format « Bedrock Entity », même export. Ce qui change est **côté code** :

- *Block entity* animé → `GeoBlockEntity` + `GeoBlockRenderer` (fichiers dans `geo/block/`, `animations/block/`).
- Armure animée → `GeoItem` sur l'`ArmorItem` + `GeoArmorRenderer` ; le modèle doit calquer la structure d'os de l'armure vanilla (`head`, `body`, `rightArm`…). C'est le cas le plus délicat — suivez le [wiki GeckoLib](https://github.com/bernie-g/geckolib/wiki), section *Armor*.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `Could not find animation animation.sprite.walk` | nom d'animation ≠ `animation.<geo>.<nom>` | renommer dans Blockbench, réexporter |
| Membre qui tourne « de travers » | pivot de l'os au mauvais endroit | replacer le pivot sur l'articulation, refaire les keyframes |
| Modèle invisible en jeu | mauvais chemin dans le `GeoModel`, ou renderer non enregistré | vérifier les 3 `ResourceLocation` + `EntityRenderersEvent` |
| Animation figée sur la 1ʳᵉ image | l'`AnimationController` ne rappelle pas `setAnimation` | voir [GeckoLib](#/geckolib) |
| Texture décalée après un changement d'UV | *texture size* du projet ≠ taille réelle du PNG | aligner les deux |
| J'ai perdu le `.bbmodel` | seul le `.geo.json` a été committé | *File → Open* le `.geo.json` (éditable), et **committez le `.bbmodel`** cette fois |

Page suivante : **[Export & import de modèles](#/export-import-modeles)**.
