# Structures & génération (villages, donjons)

Une **structure** est un bâtiment (ou ensemble de bâtiments) placé pendant la génération du monde : temple, avant-poste, village, donjon. En 1.20.1 c'est **piloté par des fichiers JSON** + des fichiers `.nbt` créés avec les **blocs de structure** en jeu.

Prérequis : [Générer un minerai](#/worldgen-minerai) (registres de datapack), [Registres & tags](#/registres-tags).

## Deux familles

| Type | Assemblage | Exemples vanilla |
|------|-----------|------------------|
| **Rigide** (`minecraft:jigsaw` à 1 pièce, ou type dédié) | un seul `.nbt` posé tel quel | temple du désert, iglou, ruine |
| **Jigsaw** (`minecraft:jigsaw`) | pièces assemblées via des blocs *jigsaw*, à partir de *pools* | village, bastion, avant-poste pillard, cité antique |

Un village = des dizaines de `.nbt` (maisons, routes, décor) reliés par des blocs jigsaw et organisés en `template_pool`.

## Les fichiers en jeu

```text
src/main/resources/data/monmod/
├── structures/                              ← les .nbt (créés avec un bloc de structure)
│   ├── tower/base.nbt
│   ├── tower/floor.nbt
│   └── tower/roof.nbt
├── worldgen/
│   ├── structure/mage_tower.json            ← la structure
│   ├── structure_set/mage_tower.json        ← où/à quelle fréquence
│   ├── template_pool/mage_tower/start.json  ← pièce(s) de départ
│   ├── template_pool/mage_tower/floors.json
│   └── processor_list/mage_tower_weathering.json  ← (optionnel) altération
└── tags/worldgen/structure/mage_tower.json  ← pour /locate #monmod:mage_tower
```

## 1. Créer les pièces `.nbt`

En jeu (créatif) :

1. Construisez la pièce.
2. Posez un **bloc de structure** (`/give @s minecraft:structure_block`), mode **SAVE**, nom `monmod:tower/base`, ajustez la zone.
3. **Save** → le fichier apparaît dans `saves/<monde>/generated/monmod/structures/tower/base.nbt`.
4. Copiez-le dans `src/main/resources/data/monmod/structures/tower/base.nbt`.

Pour le **jigsaw** : placez des **blocs jigsaw** (`minecraft:jigsaw`) sur les faces de raccord, avec un *name*, un *target name*, et le *pool* à connecter.

## 2. La structure — `worldgen/structure/mage_tower.json`

```json
{
  "type": "minecraft:jigsaw",
  "biomes": "#monmod:has_structure/mage_tower",
  "step": "surface_structures",
  "terrain_adaptation": "beard_thin",
  "start_pool": "monmod:mage_tower/start",
  "size": 4,
  "start_height": {
    "absolute": 0
  },
  "project_start_to_heightmap": "WORLD_SURFACE_WG",
  "max_distance_from_center": 80,
  "use_expansion_hack": false,
  "spawn_overrides": {}
}
```

- `biomes` : un **tag de biomes** (recommandé) ou une liste. Créez `data/monmod/tags/worldgen/biome/has_structure/mage_tower.json`.
- `step` : `surface_structures`, `underground_structures`, `underground_decoration`…
- `terrain_adaptation` : `none`, `beard_thin`, `beard_box`, `bury`, `encapsulate` — comment le sol s'adapte autour.
- `size` : profondeur maximale d'assemblage jigsaw (2–7 selon la complexité).
- `project_start_to_heightmap` : colle le départ au sol (`WORLD_SURFACE_WG`) ou laisse `start_height` décider.

## 3. Le `structure_set` — placement et fréquence

`worldgen/structure_set/mage_tower.json` :

```json
{
  "structures": [
    { "structure": "monmod:mage_tower", "weight": 1 }
  ],
  "placement": {
    "type": "minecraft:random_spread",
    "spacing": 32,
    "separation": 12,
    "salt": 165745295,
    "spread_type": "linear"
  }
}
```

- `spacing` : taille moyenne (en chunks) de la maille où **une** structure peut apparaître.
- `separation` : distance minimale (en chunks) entre deux structures. **Toujours** `separation < spacing`.
- `salt` : un grand entier **unique à votre structure** (sinon collision de placement avec une autre).
- Plusieurs `structures` dans un set : elles se **partagent** les emplacements (une seule par maille).

## 4. Les template pools (jigsaw)

`worldgen/template_pool/mage_tower/start.json` :

```json
{
  "fallback": "minecraft:empty",
  "elements": [
    {
      "weight": 1,
      "element": {
        "element_type": "minecraft:single_pool_element",
        "location": "monmod:tower/base",
        "processors": "minecraft:empty",
        "projection": "rigid"
      }
    }
  ]
}
```

`worldgen/template_pool/mage_tower/floors.json` — les étages, tirés aléatoirement à chaque raccord jigsaw :

```json
{
  "fallback": "minecraft:empty",
  "elements": [
    { "weight": 3, "element": { "element_type": "minecraft:single_pool_element", "location": "monmod:tower/floor", "processors": "monmod:mage_tower_weathering", "projection": "rigid" } },
    { "weight": 1, "element": { "element_type": "minecraft:single_pool_element", "location": "monmod:tower/roof", "processors": "minecraft:empty", "projection": "rigid" } }
  ]
}
```

- `projection` : `rigid` (le bâtiment garde sa forme) ou `terrain_matching` (épouse le relief — pour les routes).
- `element_type` : `single_pool_element` (un `.nbt`), `list_pool_element` (plusieurs à la suite), `feature_pool_element` (une *feature* de génération), `empty_pool_element`.
- `fallback` : pool utilisé quand `size` est atteint (souvent un « bout » ou `empty`).

## 5. Processeurs (altération, remplacement)

`worldgen/processor_list/mage_tower_weathering.json` — remplace aléatoirement des blocs pour un rendu « usé » :

```json
{
  "processors": [
    {
      "processor_type": "minecraft:rule",
      "rules": [
        {
          "location_predicate": { "predicate_type": "minecraft:always_true" },
          "input_predicate": { "predicate_type": "minecraft:block_match", "block": "minecraft:stone_bricks" },
          "output_state": { "Name": "minecraft:cracked_stone_bricks" },
          "position_predicate": { "predicate_type": "minecraft:always_true" }
        }
      ]
    }
  ]
}
```

Processeurs utiles : `minecraft:rule` (remplacement conditionnel), `minecraft:block_rot` (retire un % de blocs), `minecraft:gravity` (fait tomber), `minecraft:protected_blocks` (ne touche pas certains blocs).

## 6. Tester

```text
/place structure monmod:mage_tower              (place la structure à vos pieds)
/place jigsaw monmod:mage_tower/start minecraft:empty 7   (assemble un jigsaw manuellement)
/place template monmod:tower/base                (pose une seule pièce)
/locate structure monmod:mage_tower             (trouve la plus proche)
```

> :attention: Les structures n'apparaissent que dans les **chunks générés après** l'ajout. Testez sur un **monde neuf** ou avec `/place`.

## 7. Ajouter des bâtiments à un village vanilla

C'est le cas le plus demandé — et le plus délicat en 1.20.1.

Un village plaines assemble ses maisons depuis `minecraft:village/plains/houses`. **Minecraft ne fusionne pas les template pools** : deux mods qui veulent ajouter une maison entrent en conflit.

Options :

1. **Remplacer le pool** — un datapack (dans votre mod) place `data/minecraft/worldgen/template_pool/village/plains/houses.json` contenant **toutes** les entrées vanilla **+** les vôtres. Simple, mais **incompatible** avec tout autre mod qui fait pareil.
2. **Une bibliothèque de fusion** (ex. *YUNG's API*, ou des helpers de fusion de pools) qui injecte proprement au chargement.
3. **Sa propre structure** de type village (plus de travail, mais aucun conflit).

Pour un mod publié qui vise la compatibilité, préférez **2** ou **3**.

## 8. Datagen

Tout le JSON ci-dessus se génère via `DatapackBuiltinEntriesProvider` :

```java
private static final RegistrySetBuilder BUILDER = new RegistrySetBuilder()
        .add(Registries.PROCESSOR_LIST, ModProcessors::bootstrap)
        .add(Registries.TEMPLATE_POOL, ModPools::bootstrap)
        .add(Registries.STRUCTURE, ModStructures::bootstrap)
        .add(Registries.STRUCTURE_SET, ModStructureSets::bootstrap);
```

Les `.nbt` restent créés à la main. Le code Java des `bootstrap` reconstruit les objets `Structure` / `StructureTemplatePool` — verbeux ; beaucoup de mods gardent le **JSON à la main** pour les structures et n'utilisent la datagen que pour le reste.

## 9. Type de structure custom (Java)

Nécessaire seulement pour une **logique de placement spéciale** (ex. « toujours au bord d'un lac »). Sinon `minecraft:jigsaw` suffit.

```java
public static final DeferredRegister<StructureType<?>> STRUCTURE_TYPES =
        DeferredRegister.create(Registries.STRUCTURE_TYPE, MonMod.MODID);

public static final RegistryObject<StructureType<LakeShrineStructure>> LAKE_SHRINE =
        STRUCTURE_TYPES.register("lake_shrine", () -> () -> LakeShrineStructure.CODEC);
```

`LakeShrineStructure extends Structure`, avec `Structure.simpleCodec(...)` ou un `RecordCodecBuilder` incluant `Structure.settingsCodec(instance)`, et `findGenerationPoint(GenerationContext)`.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| La structure n'apparaît jamais | `biomes` pointe vers un tag vide, ou `structure_set` absent | remplir le tag de biomes, créer le `structure_set` |
| Elle apparaît **partout** / se chevauche | `salt` non unique, `separation`/`spacing` trop petits | grand `salt` unique, `separation < spacing` |
| Jigsaw ne s'assemble pas au-delà de la 1ʳᵉ pièce | blocs jigsaw mal configurés (name/target/pool) | vérifier *target pool* et *joint type* dans le `.nbt` |
| Structure flottante / enterrée | `project_start_to_heightmap` / `terrain_adaptation` inadaptés | `WORLD_SURFACE_WG` + `beard_thin` pour un bâtiment de surface |
| `/place structure` : « Unknown structure » | mauvais chemin JSON | `data/<modid>/worldgen/structure/<name>.json` |
| Conflit avec un autre mod sur les villages | remplacement de template pool | bibliothèque de fusion ou structure dédiée |
| `.nbt` non trouvé | placé hors de `data/<modid>/structures/` | respecter ce dossier exact |

Page suivante : **[Lancer de rayon (raycasting)](#/raycast)**.
