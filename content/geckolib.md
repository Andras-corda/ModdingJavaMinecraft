# GeckoLib : animations

**GeckoLib** est le moteur d'animation de référence pour Forge/NeoForge. Il joue des animations créées dans **[Blockbench](https://www.blockbench.net/)** (plugin *Animated Java* / format *Bedrock*) sur des **entités**, **block entities**, **items** et **armures**.

Sans GeckoLib, une entité animée demande d'écrire à la main un `HierarchicalModel` + interpolation ; avec, on fournit trois fichiers et une classe.

> :attention: **Versions.** Cette page vise **GeckoLib 4.x pour 1.20.1**. L'API a beaucoup changé entre la 3 et la 4. Vérifiez la version exacte sur [modrinth.com/mod/geckolib](https://modrinth.com/mod/geckolib) et suivez le [wiki officiel](https://github.com/bernie-g/geckolib/wiki) qui fait foi.

## 1. Dépendance

```gradle
repositories {
    maven { url = "https://dl.cloudsmith.io/public/geckolib3/geckolib/maven" }
}
dependencies {
    implementation fg.deobf("software.bernie.geckolib:geckolib-forge-1.20.1:${geckolib_version}")
}
```

`mods.toml` :

```toml
[[dependencies.monmod]]
    modId="geckolib"
    type="required"
    versionRange="[4.4,)"
    ordering="AFTER"
    side="BOTH"
```

> :info: GeckoLib 4 s'initialise seul en tant que dépendance Forge. (En GeckoLib ≤ 3, il fallait `GeckoLib.initialize()` dans le constructeur du mod — ce n'est plus le cas.)

## 2. Les fichiers d'assets

Pour une entité `gecko_sprite` :

```text
assets/monmod/
├── geo/entity/gecko_sprite.geo.json          ← le modèle (maillage), exporté de Blockbench
├── animations/entity/gecko_sprite.animation.json ← les animations, exportées de Blockbench
└── textures/entity/gecko_sprite.png          ← la texture
```

Dans Blockbench : *File → Export → GeckoLib Model* et *Animation → Export Animations*. Les noms d'animation (`animation.gecko_sprite.walk`, `.idle`, `.attack`) viennent du panneau *Animations*.

## 3. Une entité animée

```java
public class GeckoSpriteEntity extends PathfinderMob implements GeoEntity {

    private final AnimatableInstanceCache cache = GeckoLibUtil.createInstanceCache(this);

    public GeckoSpriteEntity(EntityType<? extends PathfinderMob> type, Level level) {
        super(type, level);
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Mob.createMobAttributes()
                .add(Attributes.MAX_HEALTH, 10.0D)
                .add(Attributes.MOVEMENT_SPEED, 0.25D);
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(1, new WaterAvoidingRandomStrollGoal(this, 1.0D));
        this.goalSelector.addGoal(2, new LookAtPlayerGoal(this, Player.class, 6.0F));
    }

    // --- GeckoLib ---
    @Override
    public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
        controllers.add(new AnimationController<>(this, "move", 4, this::moveAnim));
        controllers.add(new AnimationController<>(this, "attack", 0, this::attackAnim)
                .triggerableAnim("attack", RawAnimation.begin().thenPlay("animation.gecko_sprite.attack")));
    }

    private PlayState moveAnim(AnimationState<GeckoSpriteEntity> state) {
        if (state.isMoving()) {
            state.getController().setAnimation(RawAnimation.begin().thenLoop("animation.gecko_sprite.walk"));
        } else {
            state.getController().setAnimation(RawAnimation.begin().thenLoop("animation.gecko_sprite.idle"));
        }
        return PlayState.CONTINUE;
    }

    private PlayState attackAnim(AnimationState<GeckoSpriteEntity> state) {
        return PlayState.CONTINUE;   // piloté par triggerAnim, voir plus bas
    }

    @Override
    public AnimatableInstanceCache getAnimatableInstanceCache() {
        return this.cache;
    }
}
```

Déclencher l'animation d'attaque depuis le code serveur :

```java
@Override
public boolean doHurtTarget(Entity target) {
    this.triggerAnim("attack", "attack");   // (nom du contrôleur, nom de l'anim déclarable)
    return super.doHurtTarget(target);
}
```

Le 2ᵉ paramètre de `AnimationController` (`4`, `0`) est le **temps de transition** entre animations, en ticks.

## 4. Le modèle et le renderer

```java
public class GeckoSpriteModel extends GeoModel<GeckoSpriteEntity> {
    @Override public ResourceLocation getModelResource(GeckoSpriteEntity e) {
        return new ResourceLocation(MonMod.MODID, "geo/entity/gecko_sprite.geo.json");
    }
    @Override public ResourceLocation getTextureResource(GeckoSpriteEntity e) {
        return new ResourceLocation(MonMod.MODID, "textures/entity/gecko_sprite.png");
    }
    @Override public ResourceLocation getAnimationResource(GeckoSpriteEntity e) {
        return new ResourceLocation(MonMod.MODID, "animations/entity/gecko_sprite.animation.json");
    }
}

public class GeckoSpriteRenderer extends GeoEntityRenderer<GeckoSpriteEntity> {
    public GeckoSpriteRenderer(EntityRendererProvider.Context ctx) {
        super(ctx, new GeckoSpriteModel());
        this.shadowRadius = 0.4F;
    }
}
```

Enregistrement (mod event bus, client) :

```java
@SubscribeEvent
public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
    event.registerEntityRenderer(ModEntities.GECKO_SPRITE.get(), GeckoSpriteRenderer::new);
}

@SubscribeEvent
public static void attributes(EntityAttributeCreationEvent event) {
    event.put(ModEntities.GECKO_SPRITE.get(), GeckoSpriteEntity.createAttributes().build());
}
```

## 5. Un item animé

```java
public class WandItem extends Item implements GeoItem {

    private final AnimatableInstanceCache cache = GeckoLibUtil.createInstanceCache(this);

    public WandItem(Properties props) { super(props); }

    @Override
    public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
        controllers.add(new AnimationController<>(this, "spin", 0, state ->
                state.setAndContinue(RawAnimation.begin().thenLoop("animation.wand.spin"))));
    }

    @Override public AnimatableInstanceCache getAnimatableInstanceCache() { return this.cache; }

    // Le rendu passe par un renderer dédié
    @Override
    public void initializeClient(Consumer<IClientItemExtensions> consumer) {
        consumer.accept(new IClientItemExtensions() {
            private final BlockEntityWithoutLevelRenderer renderer =
                    new WandRenderer();
            @Override public BlockEntityWithoutLevelRenderer getCustomRenderer() { return renderer; }
        });
    }
}

public class WandRenderer extends GeoItemRenderer<WandItem> {
    public WandRenderer() {
        super(new DefaultedItemGeoModel<>(new ResourceLocation(MonMod.MODID, "wand")));
    }
}
```

Avec `DefaultedItemGeoModel`, les chemins sont déduits : `geo/item/wand.geo.json`, `animations/item/wand.animation.json`, `textures/item/wand.png`.

Ajoutez `"parent": "builtin/entity"` (ou pas de modèle JSON) — GeckoLib prend la main sur le rendu.

## 6. Block entity animé

`implements GeoBlockEntity`, `AnimatableInstanceCache cache = GeckoLibUtil.createInstanceCache(this)`, `registerControllers`, `getAnimatableInstanceCache`. Renderer : `GeoBlockRenderer<T>` + `GeoModel<T>`, enregistré via `event.registerBlockEntityRenderer(...)`.

## 7. Armure animée

`implements GeoItem` sur l'`ArmorItem`, un `GeoArmorRenderer<T>` + `GeoModel`. GeckoLib remplace le modèle d'armure vanilla. Voir le wiki (section *Armor Animations*) : c'est le cas le plus délicat.

## `DefaultAnimations`

GeckoLib fournit des raccourcis pour les cas courants :

```java
controllers.add(DefaultAnimations.genericWalkIdleController(this));
controllers.add(DefaultAnimations.genericLivingController(this));
```

Ils attendent des noms d'animation standard (`misc.idle`, `move.walk`…).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Entité invisible / crash au spawn | renderer non enregistré, ou `GeoModel` avec mauvais chemin | `EntityRenderersEvent.RegisterRenderers` + vérifier les 3 `ResourceLocation` |
| `Could not find animation X` | nom exact ≠ (`animation.<id>.<name>`) | copier le nom depuis le `.animation.json` |
| Animation figée sur la 1ʳᵉ frame | le prédicat renvoie sans `setAnimation` à chaque appel | toujours `setAnimation` / `setAndContinue` dans le prédicat |
| Item non animé, texture plate | pas de `initializeClient` / renderer `GeoItemRenderer` | fournir le renderer via `IClientItemExtensions` |
| Crash `NoClassDefFoundError software/bernie/...` | `fg.deobf` oublié, ou lib absente à l'exécution | `implementation fg.deobf(...)`, installer GeckoLib |
| Ça marchait, puis cassé après update GeckoLib | changement d'API (3 → 4) | suivre le wiki de **la version utilisée** |

Page suivante : **[Pehkui : mise à l'échelle](#/pehkui)**.
