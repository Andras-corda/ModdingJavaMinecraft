# Modifier le butin (Global Loot Modifiers)

Un **Global Loot Modifier** (GLM) intercepte le butin **après** que la table vanilla (ou d'un autre mod) a été tirée, et le transforme. C'est la bonne façon d'ajouter « le blé lâche parfois une graine dorée » ou « auto-fusion avec une enchantement custom » **sans toucher** aux tables existantes.

Prérequis : [NBT & Codecs](#/nbt-codecs), [Registres & tags](#/registres-tags).

## Anatomie

| Pièce | Rôle |
|-------|------|
| classe extends `LootModifier` | la transformation (`doApply`) |
| `Codec<MonModifier>` | (dé)sérialisation depuis JSON |
| enregistrement du codec | dans `ForgeRegistries.GLOBAL_LOOT_MODIFIER_SERIALIZERS` |
| `data/<modid>/loot_modifiers/<nom>.json` | une instance configurée |
| `data/forge/loot_modifiers/global_loot_modifiers.json` | la liste des modifiers actifs |

## 1. La classe

Exemple : ajouter un drop bonus quand un bloc est cassé avec une enchantement custom.

```java
public class BonusDropModifier extends LootModifier {

    public static final Supplier<Codec<BonusDropModifier>> CODEC = Suppliers.memoize(() ->
            RecordCodecBuilder.create(inst -> codecStart(inst).and(inst.group(
                    ForgeRegistries.ITEMS.getCodec().fieldOf("bonus").forGetter(m -> m.bonus),
                    Codec.INT.fieldOf("count").forGetter(m -> m.count),
                    Codec.INT.optionalFieldOf("chance_percent", 100).forGetter(m -> m.chancePercent)
            )).apply(inst, BonusDropModifier::new)));

    private final Item bonus;
    private final int count;
    private final int chancePercent;

    public BonusDropModifier(LootItemCondition[] conditions, Item bonus, int count, int chancePercent) {
        super(conditions);                      // les conditions viennent du JSON
        this.bonus = bonus;
        this.count = count;
        this.chancePercent = chancePercent;
    }

    @Override
    protected ObjectArrayList<ItemStack> doApply(ObjectArrayList<ItemStack> loot, LootContext context) {
        // Les `conditions` du JSON sont déjà vérifiées par LootModifier avant d'arriver ici.
        if (context.getRandom().nextInt(100) < chancePercent) {
            loot.add(new ItemStack(bonus, count));
        }
        return loot;
    }

    @Override
    public Codec<? extends IGlobalLootModifier> codec() {
        return CODEC.get();
    }
}
```

`codecStart(inst)` fournit le champ `conditions` commun ; `.and(inst.group(...))` ajoute vos champs.

## 2. Enregistrer le codec

```java
public final class ModLootModifiers {

    public static final DeferredRegister<Codec<? extends IGlobalLootModifier>> SERIALIZERS =
            DeferredRegister.create(ForgeRegistries.Keys.GLOBAL_LOOT_MODIFIER_SERIALIZERS, MonMod.MODID);

    public static final RegistryObject<Codec<BonusDropModifier>> BONUS_DROP =
            SERIALIZERS.register("bonus_drop", BonusDropModifier.CODEC);

    private ModLootModifiers() {}
    public static void register(IEventBus bus) { SERIALIZERS.register(bus); }
}
```

## 3. Le JSON du modifier

`data/monmod/loot_modifiers/coal_gives_diamond.json` :

```json
{
  "type": "monmod:bonus_drop",
  "conditions": [
    {
      "condition": "forge:loot_table_id",
      "loot_table_id": "minecraft:blocks/coal_ore"
    },
    {
      "condition": "minecraft:match_tool",
      "predicate": {
        "enchantments": [ { "enchantment": "monmod:lucky", "levels": { "min": 1 } } ]
      }
    }
  ],
  "bonus": "minecraft:diamond",
  "count": 1,
  "chance_percent": 5
}
```

Conditions utiles :

| Condition | Filtre |
|-----------|--------|
| `forge:loot_table_id` | une table précise |
| `minecraft:match_tool` | l'outil / son enchantement |
| `minecraft:block_state_property` | l'état du bloc cassé |
| `minecraft:killed_by_player` | mob tué par un joueur |
| `minecraft:random_chance` | probabilité brute |
| `minecraft:entity_properties` | propriétés de l'entité tuée / du joueur |
| `forge:can_tool_perform_action` | l'action de l'outil |

## 4. La liste des modifiers actifs

`data/forge/loot_modifiers/global_loot_modifiers.json` :

```json
{
  "replace": false,
  "entries": [
    "monmod:coal_gives_diamond"
  ]
}
```

L'**ordre** compte : les modifiers s'appliquent en séquence (un modifier peut voir le butin ajouté par le précédent).

## 5. Datagen

```java
public class ModGlobalLootModifiers extends GlobalLootModifierProvider {

    public ModGlobalLootModifiers(PackOutput output) {
        super(output, MonMod.MODID);
    }

    @Override
    protected void start() {
        add("coal_gives_diamond", new BonusDropModifier(
                new LootItemCondition[]{
                        LootTableIdCondition.builder(new ResourceLocation("minecraft", "blocks/coal_ore")).build(),
                        MatchTool.toolMatches(ItemPredicate.Builder.item()
                                .hasEnchantment(new EnchantmentPredicate(ModEnchantments.LUCKY.get(),
                                        MinMaxBounds.Ints.atLeast(1)))).build()
                },
                Items.DIAMOND, 1, 5));
    }
}
```

`GlobalLootModifierProvider` génère **et** le fichier du modifier **et** l'entrée dans `global_loot_modifiers.json`.

## Cas d'usage classiques

- **Auto-fusion** : `doApply` remplace chaque `ItemStack` par le résultat d'une recette de fusion (`level.getRecipeManager().getRecipeFor(RecipeType.SMELTING, ...)`), avec condition « outil enchanté Auto-Smelt ».
- **Drop de tête** : ajouter `PLAYER_HEAD` avec NBT quand un mob précis meurt tué par un joueur.
- **Loot de gâteau** : ajouter un item à toutes les tables d'un tag de coffres (`chests/*`).
- **Multiplicateur de drop** : dupliquer chaque stack selon un enchantement.

> :info: **`LootTableLoadEvent`** est une alternative plus directe (modifier la table à son chargement), mais moins « propre » : pas composable, s'exécute une fois, et entre en conflit si deux mods éditent la même table. Préférez les GLM pour du contenu partagé.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le modifier ne s'applique jamais | pas listé dans `global_loot_modifiers.json` | l'ajouter (ou utiliser la datagen qui le fait) |
| Crash `/reload` : `Unknown loot modifier type` | `type` JSON ≠ id du codec enregistré | aligner `monmod:bonus_drop` |
| Le bonus tombe **toujours**, même mauvais outil | condition oubliée / mal formée | vérifier le bloc `conditions` |
| `doApply` ne voit pas le contexte attendu (`getParamOrNull`) | paramètre absent de ce type de table | tester la nullité, ou restreindre via `forge:loot_table_id` |
| Double application | modifier listé deux fois, ou deux mods | dédupliquer, vérifier l'ordre |

Page suivante : **[Ressources : modèles, textures, langues](#/ressources-assets)**.
