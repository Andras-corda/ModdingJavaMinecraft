# Effets & potions

Un **effet** (`MobEffect`) est un état temporaire d'une entité (poison, vitesse…). Une **potion** (`Potion`) est un *conteneur* d'effets qu'on peut brasser, mettre en flèche, lancer.

Prérequis : [Registres & tags](#/registres-tags).

## Un effet

```java
public final class ModEffects {

    public static final DeferredRegister<MobEffect> EFFECTS =
            DeferredRegister.create(ForgeRegistries.MOB_EFFECTS, MonMod.MODID);

    public static final RegistryObject<MobEffect> BLEEDING = EFFECTS.register("bleeding",
            () -> new BleedingEffect(MobEffectCategory.HARMFUL, 0x8b0000));   // couleur RGB

    public static final RegistryObject<MobEffect> HASTE_PLUS = EFFECTS.register("haste_plus",
            () -> new AttributeBoostEffect(MobEffectCategory.BENEFICIAL, 0x66ccff));

    private ModEffects() {}
    public static void register(IEventBus bus) { EFFECTS.register(bus); }
}
```

`MobEffectCategory` : `BENEFICIAL` (bordure verte), `HARMFUL` (rouge), `NEUTRAL`.

### Effet périodique (tick)

```java
public class BleedingEffect extends MobEffect {

    public BleedingEffect(MobEffectCategory cat, int color) { super(cat, color); }

    @Override
    public void applyEffectTick(LivingEntity entity, int amplifier) {
        if (!entity.level().isClientSide() && entity.getHealth() > 1.0F) {
            entity.hurt(entity.damageSources().magic(), 1.0F);
        }
    }

    /** Toutes les combien de ticks `applyEffectTick` est-il appelé ? */
    @Override
    public boolean isDurationEffectTick(int duration, int amplifier) {
        int interval = 40 >> amplifier;          // plus rapide à haut niveau
        return interval <= 0 || duration % interval == 0;
    }
}
```

### Effet qui modifie un attribut

```java
public class AttributeBoostEffect extends MobEffect {

    public AttributeBoostEffect(MobEffectCategory cat, int color) {
        super(cat, color);
        addAttributeModifier(Attributes.ATTACK_SPEED,
                "a1b2c3d4-0000-0000-0000-000000000001", 0.15D,
                AttributeModifier.Operation.MULTIPLY_TOTAL);
    }

    // Le modificateur est mis à l'échelle par l'amplificateur : base × (amplifier + 1)
    @Override
    public double getAttributeModifierValue(int amplifier, AttributeModifier modifier) {
        return modifier.getAmount() * (amplifier + 1);
    }
}
```

Le jeu applique/retire le modificateur automatiquement quand l'effet est ajouté/expiré.

### Icône

`assets/monmod/textures/mob_effect/bleeding.png` — **18×18** px. Affichée dans l'inventaire et le HUD.

### Appliquer un effet

```java
entity.addEffect(new MobEffectInstance(
        ModEffects.BLEEDING.get(),
        200,        // durée en ticks (10 s)
        1,          // amplificateur (0 = niveau I)
        false,      // "ambient" (comme une balise) : particules discrètes
        true,       // "visible" : particules
        true));     // "showIcon" : icône HUD
```

### Réagir aux effets (événements)

```java
@SubscribeEvent
public static void onEffectAdded(MobEffectEvent.Added event) { }
@SubscribeEvent
public static void onEffectExpired(MobEffectEvent.Expired event) { }
@SubscribeEvent
public static void canApply(MobEffectEvent.Applicable event) {
    if (event.getEffectInstance().getEffect() == ModEffects.BLEEDING.get()
            && event.getEntity().getType().is(EntityTypeTags.UNDEAD)) {
        event.setResult(Event.Result.DENY);   // les morts-vivants ne saignent pas
    }
}
```

## Une potion

Un `Potion` regroupe une ou plusieurs `MobEffectInstance`. Enregistrez la potion de base, puis ses variantes (« longue », « intense ») séparément :

```java
public final class ModPotions {

    public static final DeferredRegister<Potion> POTIONS =
            DeferredRegister.create(ForgeRegistries.POTIONS, MonMod.MODID);

    public static final RegistryObject<Potion> BLEEDING = POTIONS.register("bleeding",
            () -> new Potion(new MobEffectInstance(ModEffects.BLEEDING.get(), 900, 0)));

    public static final RegistryObject<Potion> LONG_BLEEDING = POTIONS.register("long_bleeding",
            () -> new Potion("bleeding", new MobEffectInstance(ModEffects.BLEEDING.get(), 1800, 0)));

    public static final RegistryObject<Potion> STRONG_BLEEDING = POTIONS.register("strong_bleeding",
            () -> new Potion("bleeding", new MobEffectInstance(ModEffects.BLEEDING.get(), 450, 1)));

    private ModPotions() {}
    public static void register(IEventBus bus) { POTIONS.register(bus); }
}
```

Le 1ᵉʳ argument `String` des variantes (« bleeding ») est le **suffixe de traduction commun**. Traductions :

```json
{
  "item.minecraft.potion.effect.bleeding": "Potion de saignement",
  "item.minecraft.splash_potion.effect.bleeding": "Potion jetable de saignement",
  "item.minecraft.lingering_potion.effect.bleeding": "Potion persistante de saignement",
  "item.minecraft.tipped_arrow.effect.bleeding": "Flèche de saignement"
}
```

Les potions jetable / persistante et les **flèches trempées** fonctionnent automatiquement dès que le `Potion` est enregistré.

## Le brassage (brewing)

En 1.20.1, on ajoute les recettes de brassage via `BrewingRecipeRegistry`, dans `FMLCommonSetupEvent` (protégé par `enqueueWork` car l'API n'est pas *thread-safe*) :

```java
private void commonSetup(FMLCommonSetupEvent event) {
    event.enqueueWork(() -> {
        // potion maladroite + griffe de araignée -> potion de saignement
        BrewingRecipeRegistry.addRecipe(
                Ingredient.of(PotionUtils.setPotion(new ItemStack(Items.POTION), Potions.AWKWARD)),
                Ingredient.of(ModItems.SPIDER_FANG.get()),
                PotionUtils.setPotion(new ItemStack(Items.POTION), ModPotions.BLEEDING.get()));

        // saignement + redstone -> saignement long
        addPotionMix(ModPotions.BLEEDING.get(), Items.REDSTONE, ModPotions.LONG_BLEEDING.get());
        // saignement + pierre lumineuse -> saignement intense
        addPotionMix(ModPotions.BLEEDING.get(), Items.GLOWSTONE_DUST, ModPotions.STRONG_BLEEDING.get());
    });
}

private static void addPotionMix(Potion from, Item ingredient, Potion to) {
    BrewingRecipeRegistry.addRecipe(
            Ingredient.of(PotionUtils.setPotion(new ItemStack(Items.POTION), from)),
            Ingredient.of(ingredient),
            PotionUtils.setPotion(new ItemStack(Items.POTION), to));
}
```

> :attention: `BrewingRecipeRegistry.addRecipe(Ingredient, Ingredient, ItemStack)` gère la potion **normale**. Pour aussi couvrir jetable / persistante, `PotionBrewing` s'en charge en interne à partir de la potion normale ; sinon ajoutez les variantes explicitement. Testez chaque forme.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `applyEffectTick` jamais appelé | `isDurationEffectTick` renvoie toujours `false` | vérifier la formule d'intervalle |
| Icône absente / carreau rose | fichier hors de `textures/mob_effect/`, mauvaise taille | 18×18 px, bon chemin |
| L'attribut ne revient pas à la normale à l'expiration | modificateur ajouté à la main sans `addAttributeModifier` | utiliser `addAttributeModifier` dans le constructeur |
| La potion n'a pas de recette de brassage | `addRecipe` hors de `enqueueWork` | l'appeler dans `FMLCommonSetupEvent` + `enqueueWork` |
| Flèche trempée absente du créatif | `Potion` non enregistré, ou pas de traduction | enregistrer + traduire les 4 formes |
| Dégâts d'effet infligés côté client aussi | pas de garde | `if (!entity.level().isClientSide())` |

Page suivante : **[Recettes personnalisées](#/recettes-custom)**.
