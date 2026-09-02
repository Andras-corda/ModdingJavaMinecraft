# Outils, armes & armures

Créer un set complet : pioche/hache/pelle/houe/épée + casque/plastron/jambières/bottes, avec un **matériau** custom.

Prérequis : [Blocs & items](#/blocs-items), [Registres & tags](#/registres-tags).

## Un matériau d'outil : `Tier`

Le `Tier` porte : durabilité, vitesse de minage, dégâts bonus, niveau de minage, enchantabilité, ingrédient de réparation.

```java
public final class ModTiers {

    public static final Tier RUBY = new ForgeTier(
            3,                                   // niveau de minage (0 bois, 1 pierre, 2 fer, 3 diamant)
            1200,                                // durabilité
            8.0F,                                // vitesse de minage
            3.5F,                                // dégâts bonus de base
            18,                                  // enchantabilité
            ModTags.Blocks.INCORRECT_FOR_RUBY_TOOL,   // TagKey<Block> des blocs qu'il NE mine PAS (optionnel)
            () -> Ingredient.of(ModItems.RUBY.get()));

    private ModTiers() {}
}
```

> :info: **`ForgeTier`** est la classe utilitaire de Forge. Le 6ᵉ argument est un `TagKey<Block>` listant ce que l'outil **ne** peut **pas** miner efficacement — passez `null` pour « comme le diamant ». Alternative : `Tiers.DIAMOND` réutilisé tel quel.

### Insérer un tier modding dans l'ordre vanilla

Le « niveau » entier ne suffit pas si vous voulez un tier **entre** le fer et le diamant, ou **après** la netherite. Enregistrez-le dans le `TierSortingRegistry`, dans `FMLCommonSetupEvent` :

```java
event.enqueueWork(() -> TierSortingRegistry.registerTier(
        ModTiers.RUBY,
        new ResourceLocation(MonMod.MODID, "ruby"),
        List.of(Tiers.DIAMOND),      // vient APRÈS le diamant
        List.of(Tiers.NETHERITE)));  // mais AVANT la netherite
```

## Les items d'outil

```java
public final class ModItems {

    public static final RegistryObject<Item> RUBY_PICKAXE = ITEMS.register("ruby_pickaxe",
            () -> new PickaxeItem(ModTiers.RUBY, 1, -2.8F, new Item.Properties()));

    public static final RegistryObject<Item> RUBY_AXE = ITEMS.register("ruby_axe",
            () -> new AxeItem(ModTiers.RUBY, 6.0F, -3.1F, new Item.Properties()));

    public static final RegistryObject<Item> RUBY_SHOVEL = ITEMS.register("ruby_shovel",
            () -> new ShovelItem(ModTiers.RUBY, 1.5F, -3.0F, new Item.Properties()));

    public static final RegistryObject<Item> RUBY_HOE = ITEMS.register("ruby_hoe",
            () -> new HoeItem(ModTiers.RUBY, -3, 0.0F, new Item.Properties()));

    public static final RegistryObject<Item> RUBY_SWORD = ITEMS.register("ruby_sword",
            () -> new SwordItem(ModTiers.RUBY, 3, -2.4F, new Item.Properties()));
}
```

Les deux nombres après le `Tier` = **dégâts d'attaque** (ajoutés au bonus du tier) et **vitesse d'attaque** (négatif ; `-2.4` = épée, `-3.1` = hache lente). Les valeurs vanilla équivalentes :

| Outil | dégâts | vitesse |
|-------|--------|---------|
| Épée | `3` | `-2.4F` |
| Pioche | `1` | `-2.8F` |
| Pelle | `1.5F` | `-3.0F` |
| Hache | `5`–`6` | `-3.0F` à `-3.2F` |
| Houe | `-tier` | `tier - 3` |

### Outil custom (comportement)

```java
public class HammerItem extends DiggerItem {
    public HammerItem(Tier tier, Item.Properties props) {
        super(1.0F, -3.2F, tier, BlockTags.MINEABLE_WITH_PICKAXE, props);
    }

    @Override
    public boolean mineBlock(ItemStack stack, Level level, BlockState state,
                             BlockPos pos, LivingEntity entity) {
        if (!level.isClientSide() && entity instanceof Player player) {
            // casser une zone 3x3 face au joueur...
        }
        return super.mineBlock(stack, level, state, pos, entity);
    }
}
```

## Tags obligatoires pour les outils

Sans tags, la pioche vanilla ne minera pas votre minerai, et votre pioche ne minera pas correctement les blocs modding. Par datagen ([Registres & tags](#/registres-tags)) :

```java
// ModItemTagsProvider
tag(ItemTags.PICKAXES).add(ModItems.RUBY_PICKAXE.get());
tag(ItemTags.AXES).add(ModItems.RUBY_AXE.get());
tag(ItemTags.SHOVELS).add(ModItems.RUBY_SHOVEL.get());
tag(ItemTags.HOES).add(ModItems.RUBY_HOE.get());
tag(ItemTags.SWORDS).add(ModItems.RUBY_SWORD.get());
// tag Forge inter-mods
tag(Tags.Items.TOOLS).add(/* tous */);
```

## Un matériau d'armure : `ArmorMaterial`

`ArmorMaterial` est une **interface**. On l'implémente (souvent en enum) :

```java
public enum ModArmorMaterials implements ArmorMaterial {

    RUBY("ruby", 33, new int[]{3, 6, 8, 3}, 20,
         SoundEvents.ARMOR_EQUIP_DIAMOND, 2.5F, 0.1F,
         () -> Ingredient.of(ModItems.RUBY.get()));

    // durabilité de base par emplacement (bottes, jambières, plastron, casque)
    private static final int[] BASE_DURABILITY = {13, 15, 16, 11};

    private final String name;
    private final int durabilityMultiplier;
    private final int[] protection;         // {bottes, jambières, plastron, casque}
    private final int enchantmentValue;
    private final SoundEvent equipSound;
    private final float toughness;
    private final float knockbackResistance;
    private final Supplier<Ingredient> repair;

    ModArmorMaterials(String name, int durMult, int[] protection, int ench,
                      SoundEvent sound, float toughness, float kbRes, Supplier<Ingredient> repair) {
        this.name = name; this.durabilityMultiplier = durMult; this.protection = protection;
        this.enchantmentValue = ench; this.equipSound = sound; this.toughness = toughness;
        this.knockbackResistance = kbRes; this.repair = repair;
    }

    @Override public int getDurabilityForType(ArmorItem.Type type) {
        return BASE_DURABILITY[type.getSlot().getIndex()] * durabilityMultiplier;
    }
    @Override public int getDefenseForType(ArmorItem.Type type) {
        return protection[type.getSlot().getIndex()];
    }
    @Override public int getEnchantmentValue() { return enchantmentValue; }
    @Override public SoundEvent getEquipSound() { return equipSound; }
    @Override public Ingredient getRepairIngredient() { return repair.get(); }
    @Override public String getName() { return MonMod.MODID + ":" + name; }
    @Override public float getToughness() { return toughness; }
    @Override public float getKnockbackResistance() { return knockbackResistance; }
}
```

Repères vanilla : cuir `{1,2,3,1}` tough 0 ; fer `{2,5,6,2}` tough 0 ; diamant `{3,6,8,3}` tough 2 ; netherite `{3,6,8,3}` tough 3, kbRes 0.1.

## Les items d'armure

```java
public static final RegistryObject<Item> RUBY_HELMET = ITEMS.register("ruby_helmet",
        () -> new ArmorItem(ModArmorMaterials.RUBY, ArmorItem.Type.HELMET, new Item.Properties()));
public static final RegistryObject<Item> RUBY_CHESTPLATE = ITEMS.register("ruby_chestplate",
        () -> new ArmorItem(ModArmorMaterials.RUBY, ArmorItem.Type.CHESTPLATE, new Item.Properties()));
public static final RegistryObject<Item> RUBY_LEGGINGS = ITEMS.register("ruby_leggings",
        () -> new ArmorItem(ModArmorMaterials.RUBY, ArmorItem.Type.LEGGINGS, new Item.Properties()));
public static final RegistryObject<Item> RUBY_BOOTS = ITEMS.register("ruby_boots",
        () -> new ArmorItem(ModArmorMaterials.RUBY, ArmorItem.Type.BOOTS, new Item.Properties()));
```

### Textures d'armure

Deux fichiers, pas dans `models/` habituels :

- `assets/monmod/textures/models/armor/ruby_layer_1.png` — casque + plastron + bottes.
- `assets/monmod/textures/models/armor/ruby_layer_2.png` — jambières.

Le nom `ruby` doit correspondre à la partie après `:` renvoyée par `getName()`.

### Effet de set (bonus quand l'armure complète est portée)

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)
public class ArmorSetHandler {
    @SubscribeEvent
    public static void onPlayerTick(TickEvent.PlayerTickEvent event) {
        if (event.phase != TickEvent.Phase.END || event.player.level().isClientSide()) return;
        Player p = event.player;
        boolean full = p.getInventory().armor.stream()
                .allMatch(s -> s.getItem() instanceof ArmorItem ai
                        && ai.getMaterial() == ModArmorMaterials.RUBY);
        if (full) {
            p.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SPEED, 40, 0, true, false, false));
        }
    }
}
```

## Modèles d'items (datagen)

```java
// ModItemModelProvider
handheldItem(ModItems.RUBY_PICKAXE);           // parent item/handheld
basicItem(ModItems.RUBY_HELMET.get());          // parent item/generated
// helper :
private void handheldItem(RegistryObject<Item> item) {
    withExistingParent(item.getId().getPath(), mcLoc("item/handheld"))
        .texture("layer0", modLoc("item/" + item.getId().getPath()));
}
```

## Réparation & attributs

```java
// Réparer avec le minerai à l'enclume : géré par getRepairIngredient() du Tier/Material.

// Ajouter un attribut custom à un item (ex. portée de minage sur un marteau)
@Override
public Multimap<Attribute, AttributeModifier> getAttributeModifiers(EquipmentSlot slot, ItemStack stack) {
    if (slot == EquipmentSlot.MAINHAND) {
        return ImmutableMultimap.<Attribute, AttributeModifier>builder()
                .putAll(super.getAttributeModifiers(slot, stack))
                .put(ForgeMod.BLOCK_REACH.get(), new AttributeModifier(
                        REACH_UUID, "Hammer reach", 1.0, AttributeModifier.Operation.ADDITION))
                .build();
    }
    return super.getAttributeModifiers(slot, stack);
}
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| La pioche mine tout à vitesse « main nue » | pas dans `ItemTags.PICKAXES` / mauvais tier | datagen tags + `Tier` correct |
| Votre minerai incassable avec la pioche vanilla | bloc pas dans `mineable/pickaxe` + `needs_*_tool` | datagen block tags |
| Armure invisible sur le joueur | fichier `_layer_1/2.png` manquant ou mal nommé | vérifier `textures/models/armor/<name>_layer_N.png` |
| Crash : `ArrayIndexOutOfBoundsException` dans `getDefenseForType` | `getSlot().getIndex()` sur un tableau mal ordonné | ordre = bottes(0), jambières(1), plastron(2), casque(3) |
| Tier modding « ignoré » pour le niveau de minage | pas de `TierSortingRegistry.registerTier` | l'enregistrer dans `FMLCommonSetupEvent` |

Page suivante : **[Nourriture & cultures](#/nourriture-cultures)**.
