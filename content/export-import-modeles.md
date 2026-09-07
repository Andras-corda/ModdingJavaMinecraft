# Export & import de modèles

Récapitulatif des **formats**, de **où placer chaque fichier**, de comment **réimporter** pour éditer, et de comment **référencer les assets vanilla**.

## Les formats Blockbench et leur usage

| Export Blockbench | Extension | Pour |
|-------------------|-----------|------|
| Java Block/Item Model | `.json` | modèles de **blocs et items** ([Blockbench : blocs & items](#/blockbench-blocs-items)) |
| GeckoLib Model | `.geo.json` | maillage d'**entité / block entity / armure** ([GeckoLib](#/geckolib)) |
| Animations (mode Animate) | `.animation.json` | animations GeckoLib |
| Bedrock Model | `.geo.json` | idem GeckoLib (le plugin GeckoLib ajoute juste des raccourcis) |
| Modded Entity | `.java` + `.png` | système d'entité **natif Forge** (pas GeckoLib) |
| OBJ / GLTF / Collada | `.obj` … | rendus externes, portfolio — **pas** consommés directement par le jeu |
| `.bbmodel` (**Save Project**) | `.bbmodel` | **le fichier source éditable** — à conserver |

## Où va chaque fichier

```text
src/main/resources/assets/monmod/
├── models/
│   ├── block/*.json              ← Java Block Model
│   └── item/*.json               ← Java Item Model
├── blockstates/*.json            ← À LA MAIN ou datagen (Blockbench ne les fait pas)
├── geo/
│   ├── entity/*.geo.json         ← GeckoLib Model (entités)
│   └── block/*.geo.json          ← GeckoLib Model (block entities)
├── animations/
│   ├── entity/*.animation.json
│   └── block/*.animation.json
└── textures/
    ├── block/*.png   item/*.png   entity/*.png
    ├── gui/*.png      particle/*.png
    └── models/armor/<mat>_layer_1.png, _layer_2.png
```

Le **nom du fichier** et le **chemin** doivent correspondre à ce que le code / les blockstates réclament :

- `monmod:block/polisher` → `assets/monmod/models/block/polisher.json`
- `GeoModel` renvoyant `monmod:geo/entity/sprite.geo.json` → ce fichier exact.

## Où garder les sources `.bbmodel` et `.ase`

**Pas dans `src/`** (ils gonfleraient le `.jar` sans servir au jeu). Un dossier dédié à la racine du dépôt :

```text
VOTRE-MOD/
├── art/
│   ├── models/            sprite.bbmodel, polisher.bbmodel ...
│   ├── textures/          sprite.ase, palette.gpl ...
│   └── README.md          conventions d'art de l'équipe
├── src/
└── ...
```

**Committez ce dossier.** Les `.bbmodel` / `.ase` sont votre « source » (comme un `.psd`) ; le `.json` / `.png` dans `src/` est le « rendu ». Perdre le `.bbmodel` = devoir tout remodéliser à partir du `.geo.json` (possible mais pénible, sans historique de calques).

Le `.gitignore` du site ou du mod n'exclut **pas** ces formats — ils sont petits, git les gère très bien. (Réservez **Git LFS** aux gros fichiers : sons `.ogg` nombreux, textures HD volumineuses.)

## Réimporter pour modifier

| J'ai… | Je fais… |
|-------|----------|
| le `.bbmodel` | *File → Open* — c'est la bonne source, éditez-la puis réexportez |
| seulement un `.json` de bloc/item (vanilla ou autre mod) | *File → Open* le `.json` — Blockbench le reconstruit en projet |
| seulement un `.geo.json` | *File → Open* — reconstruit en projet Bedrock Entity éditable |
| un `.animation.json` à charger dans un projet ouvert | menu **Animations → Import** |
| une texture à ajouter | glisser le `.png` dans le panneau **Textures** |

Après édition : **réexportez** vers `src/main/resources/...` (les mêmes chemins), puis `F3 + T` en jeu ou relancez `runClient`.

## Référencer les assets vanilla

### Comme parent de modèle

Blockbench embarque les **modèles parents vanilla** : mettez `"parent": "minecraft:block/cube_all"` dans un projet et l'aperçu s'assemble. Idem `minecraft:item/generated`, `minecraft:item/handheld`.

### Pour éditer un modèle vanilla existant

Extrayez-le du jeu :

- **Fichier `.jar` du client** : `~/.minecraft/versions/1.20.1/1.20.1.jar` — c'est une archive ZIP ; les modèles sont dans `assets/minecraft/models/`, les textures dans `assets/minecraft/textures/`.
- **Sources décompilées** du workspace : après `./gradlew build`, les assets vanilla sont extraits dans les caches ForgeGradle (`~/.gradle/caches/forge_gradle/...`).
- **Plugin Blockbench** « Vanilla Model Loader » / « Minecraft Assets » : télécharge et charge les assets d'une version choisie, directement dans Blockbench.

Puis *File → Open* le `.json` vanilla, modifiez, enregistrez **sous votre namespace** (`monmod:...`) — ne réécrivez jamais un fichier `minecraft:...` sauf pour un remplacement volontaire.

## Datagen : générer plutôt qu'exporter

Pour des **dizaines** de blocs/items simples, la [datagen](#/datagen) est plus rapide et sans erreur que l'export manuel :

```java
// ModItemModelProvider
basicItem(ModItems.SAPPHIRE.get());                 // -> item/sapphire.json (parent generated)
handheldItem(ModItems.RUBY_SWORD.get());            // -> parent handheld

// ModBlockStateProvider
simpleBlockWithItem(ModBlocks.SAPPHIRE_BLOCK.get(), cubeAll(ModBlocks.SAPPHIRE_BLOCK.get()));
```

Réservez Blockbench aux modèles **non triviaux** (formes custom, entités). Le reste : datagen.

## Contrôle qualité avant commit

- [ ] Le modèle s'affiche correctement en jeu (`runClient`), pas seulement dans Blockbench.
- [ ] Modèle d'**item** présent pour chaque bloc (`models/item/<bloc>.json`).
- [ ] Chemins et **casse** exacts (`textures/entity/Sprite.png` ≠ `sprite.png`).
- [ ] `.bbmodel` / `.ase` source committé dans `art/`.
- [ ] Pas de fichier `.obj` / `.gltf` inutile dans `src/`.
- [ ] Les *render types* des textures transparentes déclarés ([Pixel art & textures](#/pixel-art-textures)).
- [ ] Testé en **jar** si le chargement des ressources est en jeu (`./gradlew build`, jar dans un profil réel).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `Unable to load model 'monmod:block/x'` | chemin/nom d'export ≠ référence | aligner le nom de fichier sur le blockstate / l'`Item` |
| Modèle OK dans Blockbench, cassé en jeu | fichier `.obj`/`.gltf` exporté au lieu de `.json`/`.geo.json` | réexporter au bon format |
| Impossible de rouvrir mon modèle | seul le `.geo.json`/`.json` committé, `.bbmodel` perdu | *File → Open* le fichier exporté (éditable), committer le `.bbmodel` désormais |
| Texture vanilla « introuvable » dans Blockbench | assets vanilla non chargés | plugin Vanilla Model Loader, ou extraire du `.jar` |
| Diff Git illisible sur un `.json` | export réordonne les clés | acceptable ; committer le `.bbmodel` pour l'historique lisible |
| Jar énorme | `.bbmodel`/`.ase`/`.obj` dans `src/main/resources` | les déplacer dans `art/` |

Page suivante : **[Config, commandes & réseau](#/config-reseau)**.
