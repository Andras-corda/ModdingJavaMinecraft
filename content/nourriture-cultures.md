# Nourriture & cultures

Ajouter un aliment, et la culture qui le produit (graine → plante qui pousse → récolte).

Prérequis : [Blocs & items](#/blocs-items), [Blocs avancés](#/blocs-avances).

## Un aliment

`FoodProperties` décrit la nourriture ; il se pose sur les `Item.Properties`.

```java
public static final FoodProperties SPICY_BERRY_FOOD = new FoodProperties.Builder()
        .nutrition(4)                       // demi-jambons rendus
        .saturationMod(0.3F)                // multiplicateur de saturation
        .fast()                             // se mange vite (comme les baies)
        .effect(() -> new MobEffectInstance(MobEffects.FIRE_RESISTANCE, 600, 0), 1.0F)
        .effect(() -> new MobEffectInstance(MobEffects.MOVEMENT_SPEED, 200, 0), 0.5F)
        .build();

public static final RegistryObject<Item> SPICY_BERRY = ITEMS.register("spicy_berry",
        () -> new Item(new Item.Properties().food(SPICY_BERRY_FOOD)));
```

Options du `Builder` :

| Méthode | Effet |
|---------|-------|
| `nutrition(int)` | points de faim restaurés |
| `saturationMod(float)` | saturation = `2 × nutrition × mod` |
| `meat()` | compte comme viande (loups, charognards) |
| `alwaysEat()` | mangeable même faim pleine (pomme d'or) |
| `fast()` | animation courte |
| `effect(Supplier<MobEffectInstance>, float proba)` | effet à la consommation |

### Aliment avec logique custom

```java
public class ElixirItem extends Item {
    public ElixirItem(Properties p) { super(p.food(ELIXIR_FOOD).craftRemainder(Items.GLASS_BOTTLE).stacksTo(16)); }

    @Override
    public ItemStack finishUsingItem(ItemStack stack, Level level, LivingEntity entity) {
        ItemStack result = super.finishUsingItem(stack, level, entity);   // gère faim + effets + shrink
        if (!level.isClientSide() && entity instanceof Player player) {
            player.removeEffect(MobEffects.POISON);
            player.removeEffect(MobEffects.WITHER);
        }
        // craftRemainder ne rend pas la bouteille à la consommation : on le fait ici
        return result.isEmpty() && !((Player) entity).getAbilities().instabuild
                ? new ItemStack(Items.GLASS_BOTTLE) : result;
    }

    @Override public UseAnim getUseAnimation(ItemStack s) { return UseAnim.DRINK; }
    @Override public int getUseDuration(ItemStack s) { return 32; }
}
```

### Compostage

Dans `FMLCommonSetupEvent` :

```java
event.enqueueWork(() -> {
    ComposterBlock.COMPOSTABLES.put(ModItems.SPICY_BERRY.get(), 0.3F);
    ComposterBlock.COMPOSTABLES.put(ModBlocks.SPICY_BUSH.get().asItem(), 0.5F);
});
```

## Une culture (plante annuelle façon blé/carotte)

Trois pièces : le **bloc de culture**, l'**item graine**, et éventuellement l'**item récolte** (si différent de la graine).

### Le bloc

```java
public class SpicyCropBlock extends CropBlock {

    public static final int MAX_AGE = 7;
    public static final IntegerProperty AGE = BlockStateProperties.AGE_7;

    private static final VoxelShape[] SHAPES = new VoxelShape[]{
            Block.box(0, 0, 0, 16, 2, 16),  Block.box(0, 0, 0, 16, 4, 16),
            Block.box(0, 0, 0, 16, 6, 16),  Block.box(0, 0, 0, 16, 8, 16),
            Block.box(0, 0, 0, 16, 10, 16), Block.box(0, 0, 0, 16, 12, 16),
            Block.box(0, 0, 0, 16, 14, 16), Block.box(0, 0, 0, 16, 16, 16)};

    public SpicyCropBlock(Properties p) { super(p); }

    @Override protected IntegerProperty getAgeProperty() { return AGE; }
    @Override public int getMaxAge() { return MAX_AGE; }

    @Override protected ItemLike getBaseSeedId() { return ModItems.SPICY_SEEDS.get(); }

    @Override
    public VoxelShape getShape(BlockState s, BlockGetter l, BlockPos p, CollisionContext c) {
        return SHAPES[s.getValue(getAgeProperty())];
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> b) {
        b.add(AGE);
    }

    // Croît plus vite sur terre labourée humide, ralentie si trop dense (comportement de CropBlock)
}
```

Enregistrement (le bloc n'est **pas** dans un onglet créatif, il n'a pas de `BlockItem`) :

```java
public static final RegistryObject<Block> SPICY_CROP = BLOCKS.register("spicy_crop",
        () -> new SpicyCropBlock(BlockBehaviour.Properties.copy(Blocks.WHEAT)));
// PAS de ModItems.ITEMS.register ici : la culture n'est pas un item tenable
```

### L'item graine

Utilisez `ItemNameBlockItem` : il place le bloc au clic droit sur de la terre labourée et garde son propre nom d'item.

```java
public static final RegistryObject<Item> SPICY_SEEDS = ITEMS.register("spicy_seeds",
        () -> new ItemNameBlockItem(ModBlocks.SPICY_CROP.get(),
                new Item.Properties()));
```

Ajoutez la graine à l'onglet créatif et au tag `#minecraft:villager_plantable_seeds` si vous voulez que les fermiers PNJ la plantent.

### Rendre la culture bonemealable

`CropBlock` l'est déjà. Pour une plante custom non-`CropBlock`, implémentez `BonemealableBlock` :

```java
public class MyBushBlock extends BushBlock implements BonemealableBlock {
    @Override public boolean isValidBonemealTarget(LevelReader l, BlockPos p, BlockState s, boolean client) {
        return s.getValue(AGE) < MAX_AGE;
    }
    @Override public boolean isBonemealSuccess(Level l, RandomSource r, BlockPos p, BlockState s) { return true; }
    @Override public void performBonemeal(ServerLevel l, RandomSource r, BlockPos p, BlockState s) {
        l.setBlock(p, s.setValue(AGE, Math.min(MAX_AGE, s.getValue(AGE) + 1)), 2);
    }
}
```

## Datagen d'une culture

### Blockstate (un modèle par âge)

```java
@Override
protected void registerStatesAndModels() {
    getVariantBuilder(ModBlocks.SPICY_CROP.get()).forAllStates(state -> {
        int age = state.getValue(SpicyCropBlock.AGE);
        return ConfiguredModel.builder()
                .modelFile(models().crop("spicy_crop_stage" + age,
                        modLoc("block/spicy_crop_stage" + age)).renderType("cutout"))
                .build();
    });
}
```

Il faut 8 textures `assets/monmod/textures/block/spicy_crop_stage0.png` … `stage7.png`.

### Modèle d'item de la graine

```java
// ModItemModelProvider
basicItem(ModItems.SPICY_SEEDS.get());   // parent item/generated
```

### Table de butin (récolte)

```java
// dans un BlockLootSubProvider
LootItemCondition.Builder ripe = LootItemBlockStatePropertyCondition.hasBlockStateProperties(
        ModBlocks.SPICY_CROP.get())
        .setProperties(StatePropertiesPredicate.Builder.properties()
                .hasProperty(SpicyCropBlock.AGE, SpicyCropBlock.MAX_AGE));

this.add(ModBlocks.SPICY_CROP.get(), this.createCropDrops(
        ModBlocks.SPICY_CROP.get(),
        ModItems.SPICY_BERRY.get(),      // récolte
        ModItems.SPICY_SEEDS.get(),      // graines
        ripe));
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| La culture s'affiche en cube plein rose/noir | modèle non `cutout` / pas 8 modèles | `renderType("cutout")`, un modèle par âge |
| Casser la culture ne rend rien | table de butin absente | `createCropDrops` en datagen |
| La graine ne se plante pas | `BlockItem` classique au lieu de `ItemNameBlockItem` | utiliser `ItemNameBlockItem` |
| La culture pousse hors de la terre labourée | `mayPlaceOn` non hérité / mauvaise `Properties` | `Properties.copy(Blocks.WHEAT)` ou surcharger `mayPlaceOn` |
| Effet d'aliment jamais appliqué côté client | logique dans `finishUsingItem` sans garde serveur | `if (!level.isClientSide())` |

Page suivante : **[Fluides personnalisés](#/fluides)**.
