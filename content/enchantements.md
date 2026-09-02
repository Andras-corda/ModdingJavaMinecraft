# Enchantements personnalisés

Un enchantement = une classe `Enchantment` enregistrée, plus des règles (sur quoi il s'applique, à quel niveau, compatible avec quoi) et un effet (déclenché par des hooks ou des événements).

Prérequis : [Registres & tags](#/registres-tags), [Le système d'événements](#/evenements).

## Enregistrer

```java
public final class ModEnchantments {

    public static final DeferredRegister<Enchantment> ENCHANTMENTS =
            DeferredRegister.create(ForgeRegistries.ENCHANTMENTS, MonMod.MODID);

    public static final RegistryObject<Enchantment> LIFESTEAL =
            ENCHANTMENTS.register("lifesteal", () -> new LifestealEnchantment(
                    Enchantment.Rarity.RARE,
                    EnchantmentCategory.WEAPON,
                    new EquipmentSlot[]{ EquipmentSlot.MAINHAND }));

    private ModEnchantments() {}
    public static void register(IEventBus bus) { ENCHANTMENTS.register(bus); }
}
```

- **`Rarity`** : `COMMON` (10), `UNCOMMON` (5), `RARE` (2), `VERY_RARE` (1) — poids dans la table d'enchantement.
- **`EnchantmentCategory`** : `WEAPON`, `ARMOR`, `ARMOR_HEAD`, `DIGGER`, `BOW`, `FISHING_ROD`, `TRIDENT`, `CROSSBOW`, `VANISHABLE`, `BREAKABLE`…
- **`EquipmentSlot[]`** : où l'objet doit être équipé pour que l'effet compte.

### Catégorie custom

Forge rend `EnchantmentCategory` extensible :

```java
public static final EnchantmentCategory RUBY_TOOLS = EnchantmentCategory.create(
        "monmod_ruby_tools",
        item -> item instanceof DiggerItem digger && digger.getTier() == ModTiers.RUBY);
```

## La classe

```java
public class LifestealEnchantment extends Enchantment {

    public LifestealEnchantment(Rarity rarity, EnchantmentCategory cat, EquipmentSlot[] slots) {
        super(rarity, cat, slots);
    }

    @Override public int getMaxLevel() { return 3; }
    @Override public int getMinCost(int level) { return 15 + (level - 1) * 9; }
    @Override public int getMaxCost(int level) { return getMinCost(level) + 20; }

    @Override public boolean isTreasureOnly() { return false; }   // trouvable en table d'enchantement
    @Override public boolean isTradeable() { return true; }       // livres de bibliothécaire
    @Override public boolean isDiscoverable() { return true; }    // table d'enchantement + pêche + butin

    @Override
    protected boolean checkCompatibility(Enchantment other) {
        return super.checkCompatibility(other) && other != Enchantments.MOB_LOOTING;
    }

    // Hook déclenché quand le porteur BLESSE une cible
    @Override
    public void doPostAttack(LivingEntity attacker, Entity target, int level) {
        if (target instanceof LivingEntity victim && !attacker.level().isClientSide()) {
            float heal = level * 1.0F;
            if (victim.getLastHurtByMob() == attacker) {   // c'est bien notre coup
                attacker.heal(heal);
            }
        }
    }
}
```

### Les hooks disponibles

| Méthode | Quand |
|---------|-------|
| `doPostAttack(user, target, level)` | l'utilisateur a blessé `target` |
| `doPostHurt(user, attacker, level)` | l'utilisateur a été blessé par `attacker` (comme Épines) |
| `getDamageBonus(level, mobType)` | bonus de dégâts (comme Fléau) |
| `getDamageProtection(level, source)` | réduction de dégâts (comme Protection) |

Pour tout le reste (minage, tir à l'arc, drops…), passez par un **événement** en testant le niveau :

```java
@SubscribeEvent
public static void onBlockBreak(BlockEvent.BreakEvent event) {
    ItemStack tool = event.getPlayer().getMainHandItem();
    int level = EnchantmentHelper.getItemEnchantmentLevel(ModEnchantments.AUTO_SMELT.get(), tool);
    if (level > 0) {
        // remplacer les drops par leur version fondue...
    }
}
```

## Lire un enchantement en jeu

```java
int lvl = EnchantmentHelper.getItemEnchantmentLevel(ModEnchantments.LIFESTEAL.get(), stack);

Map<Enchantment, Integer> all = EnchantmentHelper.getEnchantments(stack);

// Ajouter par code
stack.enchant(ModEnchantments.LIFESTEAL.get(), 2);

// Livre enchanté
ItemStack book = EnchantedBookItem.createForEnchantment(
        new EnchantmentInstance(ModEnchantments.LIFESTEAL.get(), 3));
```

## Compatibilité & obtention

| Vous voulez… | Réglage |
|--------------|---------|
| dispo en table d'enchantement | `isDiscoverable()` = `true` + catégorie qui accepte l'item |
| trésor uniquement (ex. Raccommodage) | `isTreasureOnly()` = `true` |
| interdit sur livre | surcharger `isAllowedOnBooks()` → `false` |
| incompatible avec un autre | `checkCompatibility(other)` |
| appliqué via enclume seulement | `isDiscoverable()` = `false`, `isTreasureOnly()` = `false` |

## Datagen & traductions

- **Traduction** : `"enchantment.monmod.lifesteal": "Vol de vie"` et éventuellement `"enchantment.monmod.lifesteal.desc"`.
- **Tags** (1.20.1) : `data/monmod/tags/... ` — peu de tags d'enchantement standard ; le principal est via `EnchantmentCategory`.
- Pas de fichier JSON pour l'enchantement lui-même en 1.20.1 (il est 100 % code).

> :info: **Attention aux tutoriels récents.** À partir de 1.21, les enchantements sont **data-driven** (fichiers JSON, plus de classe `Enchantment` à étendre). En 1.20.1, c'est bien la classe Java décrite ici.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| L'enchantement n'apparaît jamais dans la table | `isDiscoverable()` faux, ou catégorie qui rejette l'item | vérifier catégorie + `isDiscoverable` |
| L'effet ne se déclenche pas | mauvais hook (ex. `doPostHurt` au lieu de `doPostAttack`) | relire le tableau des hooks |
| `getMaxLevel()` > 1 mais un seul niveau appliqué | `getMinCost`/`getMaxCost` mal étagés | espacer les coûts par niveau |
| Effet doublé | logique côté client aussi | `if (!level.isClientSide())` |
| Incompatible avec tout | `checkCompatibility` renvoie `false` trop souvent | `return super.checkCompatibility(other) && ...` |

Page suivante : **[Effets & potions](#/effets-potions)**.
