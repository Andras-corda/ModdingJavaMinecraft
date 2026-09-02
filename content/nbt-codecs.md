# NBT, sérialisation & Codecs

Comment on **stocke** des données (sur un item, une entité, un bloc, un fichier de sauvegarde) et comment on les **convertit** entre Java, NBT et JSON.

## NBT : le format de données de Minecraft

NBT (*Named Binary Tag*) est un dictionnaire typé. Le type central est **`CompoundTag`** (une `Map<String, Tag>`).

| Classe | Contenu |
|--------|---------|
| `CompoundTag` | dictionnaire clé → tag |
| `ListTag` | liste de tags **du même type** |
| `IntTag`, `LongTag`, `FloatTag`, `DoubleTag`, `ByteTag`, `ShortTag` | nombres |
| `StringTag` | texte |
| `ByteArrayTag`, `IntArrayTag`, `LongArrayTag` | tableaux |

### Lire / écrire un `CompoundTag`

```java
CompoundTag tag = new CompoundTag();
tag.putInt("Energy", 500);
tag.putString("Owner", uuid.toString());
tag.putBoolean("Active", true);

CompoundTag pos = new CompoundTag();
pos.putInt("x", 3); pos.putInt("y", 64); pos.putInt("z", -12);
tag.put("Target", pos);

ListTag items = new ListTag();
for (ItemStack s : contents) items.add(s.save(new CompoundTag()));
tag.put("Items", items);

// Relecture — TOUJOURS vérifier la présence
int energy = tag.getInt("Energy");                       // 0 si absent
if (tag.contains("Target", Tag.TAG_COMPOUND)) {
    CompoundTag t = tag.getCompound("Target");
}
ListTag list = tag.getList("Items", Tag.TAG_COMPOUND);   // vide si absent/mauvais type
```

> :attention: `getInt`/`getString`/… ne lèvent **jamais** d'exception : ils renvoient une valeur par défaut si la clé manque ou a le mauvais type. Utilisez `contains(key, type)` pour distinguer « absent » de « zéro ».

### `INBTSerializable` — un objet qui sait se sauvegarder

```java
public class Mana implements INBTSerializable<CompoundTag> {
    private int amount;

    @Override public CompoundTag serializeNBT() {
        CompoundTag t = new CompoundTag();
        t.putInt("Amount", amount);
        return t;
    }
    @Override public void deserializeNBT(CompoundTag t) {
        this.amount = t.getInt("Amount");
    }
}
```

### Où le NBT est utilisé

| Support | Méthodes |
|---------|----------|
| `ItemStack` | `stack.getOrCreateTag()`, `stack.getTag()`, `stack.setTag(t)` — voir [Un item avec un comportement](#/item-comportement) |
| `BlockEntity` | `saveAdditional(CompoundTag)` / `load(CompoundTag)` — voir [Un bloc avec inventaire](#/block-entity) |
| `Entity` | `addAdditionalSaveData(CompoundTag)` / `readAdditionalSaveData(CompoundTag)` |
| Entité — données libres (Forge) | `entity.getPersistentData()` : un `CompoundTag` qui **survit** à la sauvegarde ; pratique pour la compat, mais non synchronisé au client |
| Données globales du monde | `SavedData` attaché via `DimensionDataStorage` (`level.getDataStorage().computeIfAbsent(...)`) |
| Capabilities | via `ICapabilitySerializable` — voir [Capabilities](#/capabilities) |

### Sous-tags spéciaux d'un `ItemStack`

- `stack.getOrCreateTagElement("display")` → `Name`, `Lore`, `color`.
- `BlockEntityTag` : NBT appliqué au block entity quand l'item-bloc est posé.
- `CustomModelData` (int) : sélectionne un modèle via les [item overrides](#/modeles-rendu).

## Codecs : convertir proprement

Un **`Codec<T>`** décrit comment (dé)sérialiser un `T` vers **n'importe quel format** : NBT, JSON, réseau. C'est le mécanisme moderne, utilisé par toute la génération de monde, les `BiomeModifier`, les Global Loot Modifiers, les registres de datapack.

### Codecs primitifs

```java
Codec.INT, Codec.LONG, Codec.FLOAT, Codec.DOUBLE, Codec.BOOL, Codec.STRING
ResourceLocation.CODEC
BlockPos.CODEC
Codec.list(Codec.STRING)                  // List<String>
Codec.unboundedMap(Codec.STRING, Codec.INT)
ForgeRegistries.ITEMS.getCodec()          // Codec<Item>
BuiltInRegistries.BLOCK.byNameCodec()     // Codec<Block>
```

### Codec d'un objet : `RecordCodecBuilder`

```java
public record OreConfig(Block target, int veinSize, float rarity, List<String> biomes) {

    public static final Codec<OreConfig> CODEC = RecordCodecBuilder.create(inst -> inst.group(
            BuiltInRegistries.BLOCK.byNameCodec().fieldOf("target").forGetter(OreConfig::target),
            Codec.intRange(1, 64).fieldOf("vein_size").forGetter(OreConfig::veinSize),
            Codec.FLOAT.optionalFieldOf("rarity", 1.0F).forGetter(OreConfig::rarity),
            Codec.list(Codec.STRING).optionalFieldOf("biomes", List.of()).forGetter(OreConfig::biomes)
    ).apply(inst, OreConfig::new));
}
```

- `fieldOf("name")` : champ obligatoire.
- `optionalFieldOf("name", defaut)` : champ facultatif avec valeur par défaut.
- `forGetter(...)` : comment relire la valeur depuis l'objet.
- `xmap(a -> b, b -> a)` : transformer un codec existant (ex. `Codec.STRING.xmap(UUID::fromString, UUID::toString)`).
- `Codec.INT.flatXmap(...)` : transformation qui peut échouer (renvoie `DataResult`).

### Polymorphisme : `dispatch`

Pour « un champ `type` détermine la classe » (comme les features de génération) :

```java
Codec<Shape> SHAPE_CODEC = ShapeType.CODEC.dispatch(Shape::type, ShapeType::codec);
```

### Utiliser un codec

```java
// Objet -> NBT
Tag nbt = OreConfig.CODEC.encodeStart(NbtOps.INSTANCE, config)
        .getOrThrow(false, err -> LOGGER.error("Encodage: {}", err));

// NBT -> Objet
OreConfig back = OreConfig.CODEC.parse(NbtOps.INSTANCE, nbt)
        .getOrThrow(false, err -> LOGGER.error("Décodage: {}", err));

// Objet <-> JSON : même chose avec JsonOps.INSTANCE
JsonElement json = OreConfig.CODEC.encodeStart(JsonOps.INSTANCE, config).result().orElseThrow();
```

- `NbtOps.INSTANCE` : vers/depuis NBT.
- `JsonOps.INSTANCE` : vers/depuis JSON (datapacks).
- `parse(...)` renvoie un **`DataResult<T>`** : `.result()` (Optional), `.getOrThrow(...)`, `.resultOrPartial(err -> ...)`.

### Où les codecs sont obligatoires en 1.20.1

- `configured_feature`, `placed_feature`, tout objet de génération de monde ;
- `BiomeModifier` (Forge) et son sérialiseur ;
- `IGlobalLootModifier` ([Global Loot Modifiers](#/loot-modifiers)) ;
- objets de registres de datapack custom ;
- `DamageType`, `DimensionType`, etc.

> :info: En 1.20.1, les **`RecipeSerializer`** n'utilisent pas encore les codecs (parsing JSON manuel via `GsonHelper`). C'est le cas dans les versions ultérieures. Voir [Recettes personnalisées](#/recettes-custom).

## `Component` (texte) — un mot

Le texte affiché n'est pas une `String` mais un `Component`, sérialisable lui aussi :

```java
Component.literal("Texte brut");
Component.translatable("item.monmod.ruby");                     // via lang
Component.translatable("chat.monmod.found", count, name);       // avec %s
Component.literal("Attention").withStyle(ChatFormatting.RED, ChatFormatting.BOLD);
```

Détails dans [Modèles, langues & rendu](#/modeles-rendu).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Données perdues au rechargement du chunk | `setChanged()` oublié sur le block entity | appeler `setChanged()` après modif |
| `ListTag` mélange les types → crash | ajout de tags de types différents | une `ListTag` = un seul type |
| Codec `parse` renvoie un `DataResult` vide | JSON/NBT non conforme au schéma | logguer `err`, comparer aux champs `fieldOf` |
| Données présentes serveur mais pas client | NBT non synchronisé | paquet réseau ou `SynchedEntityData` (voir [Entités : IA & synchro](#/entites-ia-data)) |
| `getPersistentData()` non lu par un autre mod | mauvaise clé, ou attendu synchronisé | c'est du serveur uniquement |

Page suivante : **[Blocs, items & onglets créatifs](#/blocs-items)**.
