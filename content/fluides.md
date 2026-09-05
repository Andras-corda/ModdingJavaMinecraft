# Fluides personnalisés

Un fluide custom (miel, huile, mana liquide…) demande **deux notions Forge distinctes** : le **`Fluid`** (logique de propagation, source/coulant) et le **`FluidType`** (propriétés physiques et rendu). Plus un bloc de fluide et un seau.

Prérequis : [Blocs avancés](#/blocs-avances), [Registres & tags](#/registres-tags).

## Vue d'ensemble

| Pièce | Registre | Rôle |
|-------|----------|------|
| `FluidType` | `ForgeRegistries.FLUID_TYPES` | densité, viscosité, lumière, sons — et, côté client, textures/teinte |
| `Fluid` (source + coulant) | `ForgeRegistries.FLUIDS` | la logique du fluide vanilla (`ForgeFlowingFluid`) |
| `LiquidBlock` | `ForgeRegistries.BLOCKS` | le bloc posé dans le monde |
| `BucketItem` | `ForgeRegistries.ITEMS` | pour ramasser/déverser |

## 1. Le `FluidType`

```java
public final class ModFluidTypes {

    public static final DeferredRegister<FluidType> FLUID_TYPES =
            DeferredRegister.create(ForgeRegistries.FLUID_TYPES, MonMod.MODID);

    public static final RegistryObject<FluidType> HONEY_FLUID_TYPE = FLUID_TYPES.register("honey_fluid",
            () -> new FluidType(FluidType.Properties.create()
                    .lightLevel(0)
                    .density(3500)          // > eau (1000) => coule dans l'eau
                    .viscosity(6000)        // plus haut => s'écoule plus lentement
                    .sound(SoundActions.BUCKET_FILL, SoundEvents.BUCKET_FILL_HONEY)
                    .sound(SoundActions.BUCKET_EMPTY, SoundEvents.BUCKET_EMPTY_HONEY)
                    .canConvertToSource(false)
                    .canSwim(false)         // marche dedans plutôt que nager
                    .canHydrate(false)));

    private ModFluidTypes() {}
    public static void register(IEventBus bus) { FLUID_TYPES.register(bus); }
}
```

`FluidType.Properties` couvre l'essentiel : `density`, `viscosity`, `temperature`, `lightLevel`, `canExtinguish`, `canConvertToSource`, `supportsBoating`, `canPushEntity`.

## 2. Le `Fluid` (source + coulant)

Forge fournit `ForgeFlowingFluid` (basé sur le `FlowingFluid` vanilla — le même mécanisme que l'eau/la lave) :

```java
public final class ModFluids {

    public static final DeferredRegister<Fluid> FLUIDS =
            DeferredRegister.create(ForgeRegistries.FLUIDS, MonMod.MODID);

    public static final RegistryObject<FlowingFluid> HONEY_FLUID =
            FLUIDS.register("honey_fluid", () -> new ForgeFlowingFluid.Source(honeyProperties()));

    public static final RegistryObject<FlowingFluid> HONEY_FLUID_FLOWING =
            FLUIDS.register("flowing_honey_fluid", () -> new ForgeFlowingFluid.Flowing(honeyProperties()));

    public static final RegistryObject<LiquidBlock> HONEY_FLUID_BLOCK =
            ModBlocks.BLOCKS.register("honey_fluid_block", () -> new LiquidBlock(
                    HONEY_FLUID,
                    BlockBehaviour.Properties.copy(Blocks.WATER)
                            .noCollission()
                            .strength(100.0F)
                            .noLootTable()));

    public static final RegistryObject<Item> HONEY_BUCKET =
            ModItems.ITEMS.register("honey_bucket", () -> new BucketItem(
                    HONEY_FLUID,
                    new Item.Properties().craftRemainder(Items.BUCKET).stacksTo(1)));

    private static ForgeFlowingFluid.Properties honeyProperties() {
        return new ForgeFlowingFluid.Properties(ModFluidTypes.HONEY_FLUID_TYPE, HONEY_FLUID, HONEY_FLUID_FLOWING)
                .slopeFindDistance(2)
                .levelDecreasePerBlock(2)     // s'écoule moins loin que l'eau (1) => plus visqueux
                .block(HONEY_FLUID_BLOCK)
                .bucket(HONEY_BUCKET);
    }

    private ModFluids() {}
    public static void register(IEventBus bus) { FLUIDS.register(bus); }
}
```

> :attention: **Toujours enregistrer les deux** (`Source` et `Flowing`). `ForgeFlowingFluid.Properties` les référence l'un l'autre : comme ce sont des `RegistryObject` (des `Supplier`), l'ordre de déclaration n'a pas d'importance — seule compte la résolution paresseuse via `.get()`, qui n'arrive qu'après l'enregistrement complet.

`levelDecreasePerBlock` : `1` (comme l'eau) = coule loin et vite ; une valeur plus haute = flaques courtes, fluide « épais ».

## 3. Rendu (texture, teinte) — client uniquement

Sans ça, le fluide s'affiche en damier violet/noir. `RegisterClientExtensionsEvent` (mod bus, client) :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public final class ModClientFluids {

    @SubscribeEvent
    public static void registerClientExtensions(RegisterClientExtensionsEvent event) {
        event.registerFluidType(new IClientFluidTypeExtensions() {
            private static final ResourceLocation STILL =
                    new ResourceLocation(MonMod.MODID, "block/honey_fluid_still");
            private static final ResourceLocation FLOWING =
                    new ResourceLocation(MonMod.MODID, "block/honey_fluid_flow");

            @Override public ResourceLocation getStillTexture() { return STILL; }
            @Override public ResourceLocation getFlowingTexture() { return FLOWING; }
            @Override public int getTintColor() { return 0xFFE9A400; }   // teinte ambrée
        }, ModFluidTypes.HONEY_FLUID_TYPE.get());
    }
}
```

- Les textures `still`/`flowing` peuvent être **réutilisées** depuis vanilla (`minecraft:block/water_still`) et simplement **teintées** via `getTintColor()` — évite de dessiner une texture animée à la main.
- Pour une texture propre, dupliquez `water_still.png` / `water_flow.png` (16×16 à 32 frames, format `.mcmeta` animé) en la retouchant.

## 4. Modèle du bloc de fluide

Un `LiquidBlock` n'a **pas** de modèle JSON classique — le rendu passe directement par le `FluidType`. Aucun fichier `models/block/honey_fluid_block.json` n'est nécessaire.

## 5. Modèle du seau (item)

Copiez le modèle vanilla du seau d'eau en changeant la texture :

```json
{
  "parent": "forge:item/bucket",
  "loader": "forge:bucket",
  "fluid": "monmod:honey_fluid"
}
```

Le *loader* `forge:bucket` (fourni par Forge) génère automatiquement le rendu (base + fluide en overlay coloré) à partir du `FluidType` — pas de texture de seau plein à dessiner à la main.

## 6. Interagir avec le fluide en code

```java
// Le bloc à cette position est-il ma source de fluide ?
if (level.getFluidState(pos).is(ModFluids.HONEY_FLUID.get())) { ... }

// Poser une source
level.setBlockAndUpdate(pos, ModFluids.HONEY_FLUID_BLOCK.get().defaultBlockState());

// Vider un seau
if (!level.isClientSide()) {
    level.setBlockAndUpdate(pos, ModFluids.HONEY_FLUID_BLOCK.get().defaultBlockState());
    player.setItemInHand(hand, ItemUtils.createFilledResult(stack, player, new ItemStack(Items.BUCKET)));
}
```

Pour un **réservoir** (tank) dans un `BlockEntity` — la vraie utilité pratique d'un fluide custom — implémentez la capability `IFluidHandler` (`ForgeCapabilities.FLUID_HANDLER`), avec un `FluidTank` comme pour un inventaire `ItemStackHandler` (voir [Capabilities](#/capabilities) et [Un bloc avec inventaire](#/block-entity)) :

```java
private final FluidTank tank = new FluidTank(8000, stack -> stack.getFluid() == ModFluids.HONEY_FLUID.get()) {
    @Override protected void onContentsChanged() { setChanged(); }
};
private final LazyOptional<IFluidHandler> fluidHandler = LazyOptional.of(() -> tank);

@Override
public <T> LazyOptional<T> getCapability(Capability<T> cap, Direction side) {
    if (cap == ForgeCapabilities.FLUID_HANDLER) return fluidHandler.cast();
    return super.getCapability(cap, side);
}
```

Cela rend votre réservoir compatible avec les tuyaux/pompes de **tous** les mods qui parlent `IFluidHandler` — le standard de facto, comme `IEnergyStorage` pour l'énergie.

## 7. Tags

```java
// data/monmod/tags/fluids/honey.json (ou via datagen)
tag(FluidTags.WATER)   // NE PAS faire : votre fluide n'est pas de l'eau
```

Créez plutôt vos propres tags si vous avez plusieurs fluides d'une même famille (`monmod:honey`, incluant source + coulant), utile pour des recettes ou des vérifications génériques (« ce bloc est-il un fluide de mon mod ? »).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Fluide en damier violet/noir | `RegisterClientExtensionsEvent` non enregistré | l'ajouter, côté client uniquement |
| Le seau ne se remplit/vide jamais | `BucketItem` mal construit (fluide manquant) | `new BucketItem(SOURCE_FLUID, properties)` |
| `IllegalStateException` au démarrage sur `ForgeFlowingFluid.Properties` | `Source`/`Flowing` non tous les deux enregistrés | enregistrer les deux `RegistryObject` |
| Le fluide ne s'écoule pas / reste en un seul bloc | `slopeFindDistance`/`levelDecreasePerBlock` mal réglés | comparer à l'eau (`4`/`1`) ou la lave (`2`/`2`) |
| Item de seau invisible | modèle `forge:item/bucket` mal référencé | vérifier `"loader": "forge:bucket"` et le champ `"fluid"` |
| Le fluide ne se combine pas avec un tuyau d'un autre mod | capability `IFluidHandler` non exposée | l'ajouter sur le `BlockEntity` du réservoir |

Page suivante : **[Enchantements personnalisés](#/enchantements)**.
