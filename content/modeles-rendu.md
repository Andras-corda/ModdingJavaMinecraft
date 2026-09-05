# Modèles, item overrides & rendu

Après [Ressources : modèles, textures, langues](#/ressources-assets), voici les mécanismes de rendu plus avancés : modèles conditionnels d'items, teintes, `RenderType`, et le rendu de block entities (BER).

Tout ce qui est décrit ici est **client uniquement**.

## Rappels sur les modèles

| Parent | Pour |
|--------|------|
| `item/generated` | item plat, `layer0` (+ `layer1`…) |
| `item/handheld` | outil tenu « en main » |
| `block/cube_all` | bloc, même texture partout |
| `block/cube_column`, `cube_bottom_top`, `orientable` | variantes de faces |
| `block/cross` | plante en croix |

Le `display` d'un modèle contrôle les transformations par contexte (`thirdperson_righthand`, `firstperson_righthand`, `gui`, `ground`, `fixed`, `head`) : position, rotation, échelle.

## Item overrides : un modèle selon l'état

`overrides` sélectionne un modèle quand un **prédicat** dépasse un seuil.

```json
{
  "parent": "item/handheld",
  "textures": { "layer0": "monmod:item/ruby_drill" },
  "overrides": [
    { "predicate": { "monmod:active": 1 }, "model": "monmod:item/ruby_drill_active" }
  ]
}
```

### Prédicats vanilla

| Prédicat | Sens |
|----------|------|
| `damage` | durabilité relative (0.0 neuf → 1.0 cassé) |
| `damaged` | 1 si l'item a de la durabilité |
| `custom_model_data` | valeur entière du NBT `CustomModelData` |
| `pulling`, `pull` (arc), `charged`, `firework` (arbalète) | tir |
| `angle` (boussole), `time` (horloge) | orientation |
| `cooldown` | balayage de recharge |
| `lefthanded`, `broken`, `cast` (canne à pêche) | états divers |

### Prédicat custom

À enregistrer dans `FMLClientSetupEvent` :

```java
@SubscribeEvent
public static void onClientSetup(FMLClientSetupEvent event) {
    event.enqueueWork(() -> {
        ItemProperties.register(ModItems.RUBY_DRILL.get(),
                new ResourceLocation(MonMod.MODID, "active"),
                (stack, level, entity, seed) ->
                        stack.getOrCreateTag().getBoolean("Active") ? 1.0F : 0.0F);
    });
}
```

Le modèle `ruby_drill_active.json` doit exister à part.

### `CustomModelData` — plusieurs apparences pour un même item

```json
{
  "parent": "item/generated",
  "textures": { "layer0": "monmod:item/token_default" },
  "overrides": [
    { "predicate": { "custom_model_data": 1 }, "model": "monmod:item/token_gold" },
    { "predicate": { "custom_model_data": 2 }, "model": "monmod:item/token_silver" }
  ]
}
```

```java
stack.getOrCreateTag().putInt("CustomModelData", 1);
```

Très utilisé par les packs de ressources et les serveurs.

## Teintes (couleurs dynamiques)

Pour des feuillages, de l'eau, une potion — le modèle déclare `"tintindex": 0` sur les faces à teinter, et vous fournissez la couleur :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ModColors {

    @SubscribeEvent
    public static void blockColors(RegisterColorHandlersEvent.Block event) {
        event.register((state, level, pos, tintIndex) ->
                        (level != null && pos != null)
                                ? BiomeColors.getAverageFoliageColor(level, pos)
                                : FoliageColor.getDefaultColor(),
                ModBlocks.RUBY_LEAVES.get());
    }

    @SubscribeEvent
    public static void itemColors(RegisterColorHandlersEvent.Item event) {
        event.register((stack, tintIndex) ->
                        tintIndex == 0 ? 0x4CAF50 : 0xFFFFFF,
                ModBlocks.RUBY_LEAVES.get().asItem());
    }
}
```

## `RenderType` d'un bloc

Par défaut un bloc est rendu « solide » (opaque). Pour la transparence :

- **Verre / feuillages / plantes** : `cutout` ou `cutout_mipped` (transparence tout ou rien).
- **Vitraux / glace / eau** : `translucent` (dégradé alpha).

Deux façons :

```java
// A. dans le modèle JSON (1.20+), champ "render_type"
{ "parent": "block/cube_all", "render_type": "minecraft:cutout", "textures": { "all": "monmod:block/ruby_glass" } }
```

```java
// B. par code, dans FMLClientSetupEvent
event.enqueueWork(() ->
    ItemBlockRenderTypes.setRenderLayer(ModBlocks.RUBY_GLASS.get(), RenderType.translucent()));
```

Préférez la méthode **A** (déclarative, gérée par datagen via `.renderType("cutout")`).

## Rendu de block entity (BER)

Pour dessiner **au-delà du modèle statique** : un item qui flotte et tourne sur un piédestal, du texte, une animation.

```java
public class PedestalRenderer implements BlockEntityRenderer<PedestalBlockEntity> {

    public PedestalRenderer(BlockEntityRendererProvider.Context ctx) { }

    @Override
    public void render(PedestalBlockEntity be, float partialTick, PoseStack pose,
                       MultiBufferSource buffers, int packedLight, int packedOverlay) {
        ItemStack stack = be.getStoredItem();
        if (stack.isEmpty()) return;

        pose.pushPose();
        pose.translate(0.5, 1.15, 0.5);                                   // au-dessus du bloc
        float spin = (be.getLevel().getGameTime() + partialTick) * 4.0F;  // rotation continue
        pose.mulPose(Axis.YP.rotationDegrees(spin));
        pose.scale(0.5F, 0.5F, 0.5F);

        Minecraft.getInstance().getItemRenderer().renderStatic(
                stack, ItemDisplayContext.FIXED, packedLight, packedOverlay,
                pose, buffers, be.getLevel(), 0);

        pose.popPose();
    }

    // Continuer à rendre même quand le bloc sort du champ (gros hologrammes)
    @Override public boolean shouldRenderOffScreen(PedestalBlockEntity be) { return false; }
}
```

Enregistrement :

```java
@SubscribeEvent
public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
    event.registerBlockEntityRenderer(ModBlockEntities.PEDESTAL.get(), PedestalRenderer::new);
}
```

Points clés :

- **`PoseStack`** : pile de transformations. Toujours `pushPose()` … `popPose()` de façon équilibrée.
- **`partialTick`** : fraction entre deux ticks (0.0–1.0), pour un mouvement fluide.
- **`packedLight`** : niveau de lumière au bloc, à propager aux `VertexConsumer`.
- **`MultiBufferSource`** : d'où viennent les `VertexConsumer` (`buffers.getBuffer(RenderType.xxx)`).
- Ne créez **aucun** objet lourd par frame ; pré-calculez.

## Dessiner dans le monde sans block entity

`RenderLevelStageEvent` (contour de zone, ligne de visée, sélection) :

```java
@SubscribeEvent
public static void onRenderLevel(RenderLevelStageEvent event) {
    if (event.getStage() != RenderLevelStageEvent.Stage.AFTER_TRANSLUCENT_BLOCKS) return;

    Vec3 cam = event.getCamera().getPosition();
    PoseStack pose = event.getPoseStack();
    pose.pushPose();
    pose.translate(-cam.x, -cam.y, -cam.z);

    MultiBufferSource.BufferSource buffers = Minecraft.getInstance().renderBuffers().bufferSource();
    VertexConsumer lines = buffers.getBuffer(RenderType.lines());
    // LevelRenderer.renderLineBox(pose, lines, aabb, r, g, b, a);
    buffers.endBatch();

    pose.popPose();
}
```

## Modèles dynamiques / `BakedModel`

Pour des modèles générés à l'exécution (câbles connectés, textures assemblées), il faut un `BakedModel` custom + `ModelEvent`. C'est avancé : voir [docs.minecraftforge.net — Models](https://docs.minecraftforge.net/en/1.20.1/rendering/modelloaders/) et la classe `net.minecraftforge.client.model` (`CompositeModel`, `DynamicFluidContainerModel`, `ItemLayerModel`).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Verre modding opaque / bordures noires | pas de `render_type` cutout/translucent | ajouter le render type (modèle ou code) |
| Override d'item ignoré | prédicat non enregistré, ou valeur jamais atteinte | `ItemProperties.register` + vérifier la valeur retournée |
| BER : le monde « clignote » / lumière fausse | `packedLight` non transmis, `pushPose/popPose` déséquilibrés | équilibrer la pile, propager la lumière |
| Chute de FPS près du bloc | allocations dans `render()` | pré-calculer, réutiliser |
| Teinte non appliquée | `"tintindex"` absent du modèle | l'ajouter aux faces concernées |
| `RenderLevelStageEvent` : objets « collés » à la caméra | translation caméra oubliée | `pose.translate(-cam.x, -cam.y, -cam.z)` |

Page suivante : **[Overlays & HUD](#/overlays-hud)**.
