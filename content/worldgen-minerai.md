# Générer un minerai dans le monde

En 1.20.1, la génération de monde est **pilotée par des fichiers JSON** (datapack). Pour ajouter un minerai, il faut trois objets :

1. une **`configured_feature`** — *quoi* générer (quel bloc, quelle taille de veine, dans quoi il remplace) ;
2. une **`placed_feature`** — *où et combien* (nombre par chunk, plage d'altitude) ;
3. un **BiomeModifier Forge** — *dans quels biomes* injecter la *placed feature*.

Cette page donne d'abord la version **JSON à écrire à la main** (concrète, copiable), puis la version **datagen**.

Prérequis : le bloc `monmod:sapphire_ore` doit déjà exister (voir [Blocs & items](#/blocs-items)). On suppose aussi une variante `monmod:deepslate_sapphire_ore`.

## Méthode A — JSON à la main

### 1. La *configured feature*

`src/main/resources/data/monmod/worldgen/configured_feature/sapphire_ore.json` :

```json
{
  "type": "minecraft:ore",
  "config": {
    "size": 8,
    "discard_chance_on_air_exposure": 0.0,
    "targets": [
      {
        "target": {
          "predicate_type": "minecraft:tag_match",
          "tag": "minecraft:stone_ore_replaceables"
        },
        "state": { "Name": "monmod:sapphire_ore" }
      },
      {
        "target": {
          "predicate_type": "minecraft:tag_match",
          "tag": "minecraft:deepslate_ore_replaceables"
        },
        "state": { "Name": "monmod:deepslate_sapphire_ore" }
      }
    ]
  }
}
```

- `size` : nombre maximal de blocs dans une veine.
- Les deux `targets` : le minerai « pierre » dans la pierre/andésite/etc., la variante « deepslate » dans l'ardoise des abîmes. C'est exactement le schéma des minerais vanilla.

### 2. La *placed feature*

`src/main/resources/data/monmod/worldgen/placed_feature/sapphire_ore.json` :

```json
{
  "feature": "monmod:sapphire_ore",
  "placement": [
    { "type": "minecraft:count", "count": 7 },
    { "type": "minecraft:in_square" },
    {
      "type": "minecraft:height_range",
      "height": {
        "type": "minecraft:trapezoid",
        "min_inclusive": { "absolute": -64 },
        "max_inclusive": { "absolute": 48 }
      }
    },
    { "type": "minecraft:biome" }
  ]
}
```

- `count` : tentatives de veines par chunk.
- `in_square` : dispersion horizontale aléatoire dans le chunk.
- `height_range` + `trapezoid` : plus fréquent au centre de la plage (`-8`), plus rare aux extrêmes. Utilisez `uniform` pour une répartition plate.
- `biome` : filtre final indispensable (empêche la génération si le biome a été retiré).

### 3. Le BiomeModifier Forge

`src/main/resources/data/monmod/forge/biome_modifier/add_sapphire_ore.json` :

```json
{
  "type": "forge:add_features",
  "biomes": "#minecraft:is_overworld",
  "features": "monmod:sapphire_ore",
  "step": "underground_ores"
}
```

- `biomes` : un tag (`#minecraft:is_overworld`) ou une liste (`["minecraft:plains", "minecraft:forest"]`).
- `features` : la *placed feature* de l'étape 2.
- `step` : l'étape de génération. Pour un minerai, **`underground_ores`**. Autres valeurs utiles : `underground_decoration`, `vegetal_decoration`, `surface_structures`.

### 4. Tester

```bash
./gradlew runData      # seulement si vous utilisez la datagen (méthode B)
./gradlew runClient
```

En jeu :

```text
/setblock ~ ~ ~ air
```

puis creusez, ou créez un monde neuf. Astuce de test rapide : `/place feature monmod:sapphire_ore` place une veine immédiatement à vos pieds.

> :attention: Les BiomeModifiers ne s'appliquent qu'aux **chunks générés après** le changement. Testez toujours sur un **monde neuf** ou des chunks non explorés.

## Méthode B — par datagen

Plus de code, mais tout est typé et refactorable (voir [Datagen](#/datagen)).

### Déclarer les clés

```java
public final class ModWorldgen {

    public static final ResourceKey<ConfiguredFeature<?, ?>> SAPPHIRE_ORE_CF =
            ResourceKey.create(Registries.CONFIGURED_FEATURE,
                    new ResourceLocation(MonMod.MODID, "sapphire_ore"));

    public static final ResourceKey<PlacedFeature> SAPPHIRE_ORE_PF =
            ResourceKey.create(Registries.PLACED_FEATURE,
                    new ResourceLocation(MonMod.MODID, "sapphire_ore"));

    private ModWorldgen() {}
}
```

### La *configured feature* en code

```java
public static void bootstrapConfigured(BootstapContext<ConfiguredFeature<?, ?>> ctx) {
    RuleTest stone = new TagMatchTest(BlockTags.STONE_ORE_REPLACEABLES);
    RuleTest deepslate = new TagMatchTest(BlockTags.DEEPSLATE_ORE_REPLACEABLES);

    List<OreConfiguration.TargetBlockState> targets = List.of(
            OreConfiguration.target(stone, ModBlocks.SAPPHIRE_ORE.get().defaultBlockState()),
            OreConfiguration.target(deepslate, ModBlocks.DEEPSLATE_SAPPHIRE_ORE.get().defaultBlockState()));

    ctx.register(ModWorldgen.SAPPHIRE_ORE_CF,
            new ConfiguredFeature<>(Feature.ORE, new OreConfiguration(targets, 8)));
}
```

### La *placed feature* en code

```java
public static void bootstrapPlaced(BootstapContext<PlacedFeature> ctx) {
    HolderGetter<ConfiguredFeature<?, ?>> cf = ctx.lookup(Registries.CONFIGURED_FEATURE);

    ctx.register(ModWorldgen.SAPPHIRE_ORE_PF, new PlacedFeature(
            cf.getOrThrow(ModWorldgen.SAPPHIRE_ORE_CF),
            List.of(
                    CountPlacement.of(7),
                    InSquarePlacement.spread(),
                    HeightRangePlacement.triangle(VerticalAnchor.absolute(-64), VerticalAnchor.absolute(48)),
                    BiomeFilter.biome())));
}
```

### Le BiomeModifier en code

```java
public static void bootstrapBiomeModifiers(BootstapContext<BiomeModifier> ctx) {
    HolderGetter<Biome> biomes = ctx.lookup(Registries.BIOME);
    HolderGetter<PlacedFeature> pf = ctx.lookup(Registries.PLACED_FEATURE);

    ctx.register(
            ResourceKey.create(ForgeRegistries.Keys.BIOME_MODIFIERS,
                    new ResourceLocation(MonMod.MODID, "add_sapphire_ore")),
            new ForgeBiomeModifiers.AddFeaturesBiomeModifier(
                    biomes.getOrThrow(BiomeTags.IS_OVERWORLD),
                    HolderSet.direct(pf.getOrThrow(ModWorldgen.SAPPHIRE_ORE_PF)),
                    GenerationStep.Decoration.UNDERGROUND_ORES));
}
```

### Brancher dans le `DataGenerators`

```java
private static final RegistrySetBuilder BUILDER = new RegistrySetBuilder()
        .add(Registries.CONFIGURED_FEATURE, ModWorldgenData::bootstrapConfigured)
        .add(Registries.PLACED_FEATURE, ModWorldgenData::bootstrapPlaced)
        .add(ForgeRegistries.Keys.BIOME_MODIFIERS, ModWorldgenData::bootstrapBiomeModifiers);

@SubscribeEvent
public static void gather(GatherDataEvent event) {
    // ...
    event.getGenerator().addProvider(event.includeServer(),
            new DatapackBuiltinEntriesProvider(
                    event.getGenerator().getPackOutput(),
                    event.getLookupProvider(),
                    BUILDER,
                    Set.of(MonMod.MODID)));
}
```

`./gradlew runData` écrit alors exactement les JSON de la méthode A dans `src/generated/resources/`.

## Régler la rareté

| Levier | Effet |
|--------|-------|
| `count` (placement) | nombre de veines par chunk — le principal réglage |
| `size` (config) | taille de chaque veine |
| plage `height_range` | fenêtre d'altitude ; plus étroite = plus concentré |
| `discard_chance_on_air_exposure` | 0.0 à 1.0 : chance de retirer un bloc de minerai exposé à l'air (grottes) |
| `rarity_filter` (placement) | `{ "type": "minecraft:rarity_filter", "chance": 4 }` = 1 chunk sur 4 |

Comparez toujours vos valeurs à un minerai vanilla proche (le minerai de fer : `count` ≈ 20 réparti sur plusieurs *placed features*, `size` 9). Un `count` de 7 et `size` 8 donnent un minerai **assez rare**.

## Autres usages du même mécanisme

- **`forge:add_spawns`** : ajouter une créature aux spawns d'un biome.
- **Arbres / plantes custom** : `configured_feature` de type `minecraft:tree` ou `minecraft:random_patch`, `step` = `vegetal_decoration`.
- **`forge:remove_features`**, **`forge:remove_spawns`** : retirer du contenu vanilla.

Page suivante : **[Raccourcis clavier & overlay HUD](#/hud-keybinds)**.
