# Registres & tags en profondeur

Deux mécanismes que vous utiliserez à chaque nouveau contenu : **enregistrer** un objet, et le **regrouper** avec des tags.

## Rappel : `DeferredRegister`

La façon normale d'enregistrer (voir [Blocs & items](#/blocs-items)) :

```java
public static final DeferredRegister<Item> ITEMS =
        DeferredRegister.create(ForgeRegistries.ITEMS, MonMod.MODID);

public static final RegistryObject<Item> RUBY =
        ITEMS.register("ruby", () -> new Item(new Item.Properties()));
```

`RegistryObject<T>` est un **`Supplier<T>`** : `RUBY.get()` renvoie l'item, mais seulement **après** la phase d'enregistrement.

### Les registres Forge courants

| `ForgeRegistries.…` | Contenu |
|---------------------|---------|
| `BLOCKS`, `ITEMS`, `FLUIDS` | blocs, items, fluides |
| `BLOCK_ENTITY_TYPES`, `ENTITY_TYPES` | types de block entities / entités |
| `MENU_TYPES`, `RECIPE_TYPES`, `RECIPE_SERIALIZERS` | conteneurs, recettes |
| `MOB_EFFECTS`, `POTIONS`, `ENCHANTMENTS` | effets, potions, enchantements |
| `SOUND_EVENTS`, `PARTICLE_TYPES` | sons, particules |
| `ATTRIBUTES`, `VILLAGER_PROFESSIONS`, `POI_TYPES` | attributs, métiers |
| `GLOBAL_LOOT_MODIFIER_SERIALIZERS` | [Global Loot Modifiers](#/loot-modifiers) |
| `BIOME_MODIFIER_SERIALIZERS` | modificateurs de biome |

### Les registres « datapack » (dynamiques)

Certains contenus (biomes, features de génération, dimensions, dégâts custom, `BiomeModifier`, `configured_feature`, `placed_feature`…) ne passent **pas** par `DeferredRegister`. Ils vivent dans des **registres de datapack** et se fournissent :

- soit par **fichiers JSON** dans `data/<modid>/<registre>/…` ;
- soit par **datagen** avec un `RegistrySetBuilder` + `DatapackBuiltinEntriesProvider` (voir [Générer un minerai](#/worldgen-minerai)).

## `RegisterEvent` : le niveau en dessous

`DeferredRegister` n'est qu'un habillage de `RegisterEvent`. Vous pouvez l'utiliser directement, utile pour les registres sans `DeferredRegister` pratique :

```java
@SubscribeEvent
public static void register(RegisterEvent event) {
    event.register(ForgeRegistries.Keys.ITEMS, helper -> {
        helper.register(new ResourceLocation(MonMod.MODID, "ruby"),
                new Item(new Item.Properties()));
    });
}
```

## Créer son propre registre

Pour un système de contenu maison (sorts, machines, quêtes…), déclarez un registre :

```java
public class ModRegistries {

    public static final ResourceKey<Registry<Spell>> SPELL_KEY =
            ResourceKey.createRegistryKey(new ResourceLocation(MonMod.MODID, "spells"));

    public static final DeferredRegister<Spell> SPELLS =
            DeferredRegister.create(SPELL_KEY, MonMod.MODID);

    // Crée le registre lui-même (à appeler une fois, avant les enregistrements)
    public static final Supplier<IForgeRegistry<Spell>> SPELL_REGISTRY =
            SPELLS.makeRegistry(() -> new RegistryBuilder<Spell>().sync(true));

    public static void register(IEventBus modBus) {
        SPELLS.register(modBus);
    }
}
```

Les autres mods peuvent alors ajouter leurs propres `Spell` dans votre registre.

## `ResourceLocation`, `ResourceKey`, `Holder`, `TagKey`

| Type | Ce que c'est | Exemple |
|------|--------------|---------|
| `ResourceLocation` | un identifiant `namespace:path` | `monmod:ruby` |
| `ResourceKey<T>` | un `ResourceLocation` **typé** vers un registre | `ResourceKey.create(Registries.ITEM, rl)` |
| `Holder<T>` | une référence vers une entrée de registre (résolue paresseusement) | `holder.value()`, `holder.is(tag)` |
| `TagKey<T>` | l'identifiant d'un **tag** dans un registre | `TagKey.create(Registries.BLOCK, rl)` |

`ResourceLocation` : le `namespace` par défaut est `minecraft`. **Toujours** préciser le vôtre : `new ResourceLocation(MonMod.MODID, "ruby")`.

## Les tags

Un **tag** est une liste nommée d'entrées de registre, extensible par datapack. Ils servent partout : « le charbon accepté par les fours », « les blocs minables à la pioche », « les entités qui brûlent au soleil ».

### Déclarer une clé de tag

```java
public final class ModTags {

    public static final class Blocks {
        public static final TagKey<Block> RUBY_MACHINES = tag("ruby_machines");
        public static final TagKey<Block> NEEDS_RUBY_TOOL = tag("needs_ruby_tool");

        private static TagKey<Block> tag(String name) {
            return BlockTags.create(new ResourceLocation(MonMod.MODID, name));
        }
    }

    public static final class Items {
        public static final TagKey<Item> RUBIES = tag("rubies");

        private static TagKey<Item> tag(String name) {
            return ItemTags.create(new ResourceLocation(MonMod.MODID, name));
        }
    }
}
```

### Utiliser un tag dans le code

```java
BlockState state = level.getBlockState(pos);
if (state.is(ModTags.Blocks.RUBY_MACHINES)) { /* ... */ }

if (stack.is(ModTags.Items.RUBIES)) { /* ... */ }
if (stack.is(Tags.Items.INGOTS)) { /* tag Forge */ }

if (entity.getType().is(EntityTypeTags.SKELETONS)) { /* ... */ }

// Parcourir les membres d'un tag
ForgeRegistries.ITEMS.tags().getTag(ModTags.Items.RUBIES)
        .forEach(item -> { /* ... */ });
```

### Remplir un tag par datagen

```java
public class ModBlockTagsProvider extends BlockTagsProvider {

    public ModBlockTagsProvider(PackOutput out, CompletableFuture<HolderLookup.Provider> lookup,
                                ExistingFileHelper helper) {
        super(out, lookup, MonMod.MODID, helper);
    }

    @Override
    protected void addTags(HolderLookup.Provider provider) {
        tag(ModTags.Blocks.RUBY_MACHINES)
                .add(ModBlocks.RUBY_FURNACE.get(), ModBlocks.RUBY_PRESS.get());

        // Étendre un tag vanilla depuis son mod
        tag(BlockTags.MINEABLE_WITH_PICKAXE)
                .add(ModBlocks.RUBY_ORE.get());

        tag(BlockTags.NEEDS_IRON_TOOL)
                .addTag(ModTags.Blocks.NEEDS_RUBY_TOOL);   // un tag peut contenir un tag
    }
}
```

Ou à la main : `data/monmod/tags/blocks/ruby_machines.json`

```json
{
  "replace": false,
  "values": [
    "monmod:ruby_furnace",
    "monmod:ruby_press",
    { "id": "somemod:optional_block", "required": false }
  ]
}
```

`"replace": true` **écrase** les valeurs existantes (dangereux, à éviter). `"required": false` : l'entrée est ignorée si absente (compat).

### Conventions de nommage

- **Étendre vanilla** : `data/minecraft/tags/blocks/mineable/pickaxe.json`, `needs_iron_tool`, `#minecraft:logs`…
- **Tags inter-mods Forge** : préfixe `forge:` — `forge:ores/ruby`, `forge:ingots/ruby`, `forge:storage_blocks/ruby`, `forge:gems/ruby`, `forge:tools/pickaxes`, `forge:dusts/*`, `forge:nuggets/*`.
  Fournir ces tags rend votre minerai **compatible** avec les recettes des autres mods.
- **Vos tags internes** : préfixe `monmod:`.

> :astuce: Pour un nouveau minerai « ruby », créez au minimum : `forge:ores/ruby`, `forge:ores` (parent), `forge:gems/ruby`, `forge:gems`, `forge:storage_blocks/ruby`, `forge:storage_blocks`. La classe `net.minecraftforge.common.Tags` liste toutes les clés existantes.

## Timing : quand les objets existent

```text
Constructeurs @Mod
   │
   ▼
Phase d'enregistrement  ← les DeferredRegister tirent leurs événements
   │                       (BLOCKS, puis ITEMS, puis le reste)
   ▼
FMLCommonSetupEvent     ← RegistryObject.get() est SÛR à partir d'ici
   ▼
… chargement du monde …
   ▼
TagsUpdatedEvent        ← les tags sont résolus (et à chaque /reload)
```

Ne lisez jamais `RUBY.get()` ni un tag dans un `static {}` ou un constructeur.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `NullPointerException` sur `.get()` | lecture trop tôt | attendre `FMLCommonSetupEvent`, ou garder le `Supplier` |
| `state.is(tag)` toujours faux | tag jamais rempli, ou faute de `ResourceLocation` | vérifier la datagen / le JSON, relancer `runData` |
| Le contenu n'apparaît pas dans les recettes des autres mods | tags `forge:` absents | fournir `forge:ores/*`, `forge:ingots/*`… |
| Tag écrasé après ajout d'un mod | quelqu'un a mis `"replace": true` | toujours `false` sauf intention explicite |
| `IllegalArgumentException: Registry already frozen` | enregistrement hors de la phase prévue | passer par `DeferredRegister` / `RegisterEvent` |

Page suivante : **[NBT, sérialisation & Codecs](#/nbt-codecs)**.
