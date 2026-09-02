# Une entité et un projectile personnalisés

Deux exemples concrets :

1. un **projectile** lancé par un item (comme une boule de neige, mais custom) — il utilise un raycast interne à chaque tick ;
2. un aperçu d'une **créature** (mob) : enregistrement, attributs, IA, rendu.

Prérequis : [Blocs, items & onglets](#/blocs-items), [Un item avec un comportement](#/item-comportement), [Lancer de rayon](#/raycast).

## Partie 1 — un projectile

### Choisir la classe de base

| Classe de base | Comportement | Exemple vanilla |
|----------------|--------------|-----------------|
| `ThrowableItemProjectile` | lancé, subit la gravité, disparaît à l'impact | boule de neige, œuf, perle |
| `AbstractArrow` | flèche : se plante, peut être ramassée, dégâts selon vitesse | flèche, trident |
| `AbstractHurtingProjectile` | vol rectiligne, pas de gravité | boule de feu du Ghast |

On prend `ThrowableItemProjectile` pour l'exemple (une « bille de givre »).

### Enregistrer l'`EntityType`

`registry/ModEntities.java` :

```java
public final class ModEntities {

    public static final DeferredRegister<EntityType<?>> ENTITIES =
            DeferredRegister.create(ForgeRegistries.ENTITY_TYPES, MonMod.MODID);

    public static final RegistryObject<EntityType<FrostOrb>> FROST_ORB =
            ENTITIES.register("frost_orb", () -> EntityType.Builder
                    .<FrostOrb>of(FrostOrb::new, MobCategory.MISC)
                    .sized(0.25F, 0.25F)               // largeur, hauteur de la hitbox
                    .clientTrackingRange(4)            // en chunks
                    .updateInterval(10)                // ticks entre 2 synchros
                    .build("frost_orb"));

    private ModEntities() {}
    public static void register(IEventBus bus) { ENTITIES.register(bus); }
}
```

### La classe du projectile

```java
public class FrostOrb extends ThrowableItemProjectile {

    // Constructeur utilisé par le jeu (spawn réseau) — OBLIGATOIRE
    public FrostOrb(EntityType<? extends FrostOrb> type, Level level) {
        super(type, level);
    }

    // Constructeur pratique : lancé par un joueur
    public FrostOrb(Level level, LivingEntity thrower) {
        super(ModEntities.FROST_ORB.get(), thrower, level);
    }

    @Override
    protected Item getDefaultItem() {
        return ModItems.FROST_ORB_ITEM.get();       // pour le rendu (ThrownItemRenderer)
    }

    // Traînée de particules pendant le vol
    @Override
    public void tick() {
        super.tick();
        if (level().isClientSide()) {
            level().addParticle(ParticleTypes.SNOWFLAKE, getX(), getY(), getZ(), 0, 0, 0);
        }
    }

    // Impact sur une entité
    @Override
    protected void onHitEntity(EntityHitResult result) {
        super.onHitEntity(result);
        if (!level().isClientSide() && result.getEntity() instanceof LivingEntity living) {
            living.hurt(damageSources().thrown(this, getOwner()), 3.0F);
            living.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 100, 1));
        }
    }

    // Impact sur un bloc : givre la surface
    @Override
    protected void onHitBlock(BlockHitResult result) {
        super.onHitBlock(result);
        if (!level().isClientSide()) {
            BlockPos target = result.getBlockPos().relative(result.getDirection());
            if (level().getBlockState(target).isAir()
                    && level().getBlockState(result.getBlockPos()).isFaceSturdy(level(), result.getBlockPos(), result.getDirection())) {
                level().setBlockAndUpdate(target, Blocks.SNOW.defaultBlockState());
            }
        }
    }

    // Fin de vie commune (bloc OU entité)
    @Override
    protected void onHit(HitResult result) {
        super.onHit(result);
        if (!level().isClientSide()) {
            level().broadcastEntityEvent(this, (byte) 3);   // particules "cassé"
            discard();
        }
    }
}
```

> :info: **Le raycast est déjà fait pour vous.** `ThrowableItemProjectile#tick()` appelle chaque tick `ProjectileUtil.getHitResultOnMoveVector(this, this::canHitEntity)` : un lancer entre la position précédente et la nouvelle. Vos surcharges `onHit*` ne font que réagir.

### Le lancer depuis un item

```java
public class FrostOrbItem extends Item {

    public FrostOrbItem(Properties props) { super(props); }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);

        level.playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.SNOWBALL_THROW, SoundSource.PLAYERS, 0.5F,
                0.4F / (level.getRandom().nextFloat() * 0.4F + 0.8F));

        if (!level.isClientSide()) {
            FrostOrb orb = new FrostOrb(level, player);
            orb.setItem(stack);
            // direction = regard du joueur ; vitesse 1.5 ; imprécision 1.0
            orb.shootFromRotation(player, player.getXRot(), player.getYRot(), 0.0F, 1.5F, 1.0F);
            level.addFreshEntity(orb);
        }

        player.awardStat(Stats.ITEM_USED.get(this));
        if (!player.getAbilities().instabuild) stack.shrink(1);
        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide());
    }
}
```

### Le rendu (client)

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ModEntityRenderers {
    @SubscribeEvent
    public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
        event.registerEntityRenderer(ModEntities.FROST_ORB.get(), ThrownItemRenderer::new);
    }
}
```

`ThrownItemRenderer` affiche le modèle d'item renvoyé par `getDefaultItem()` / `setItem(...)`. Aucun modèle 3D à créer : il faut juste que `frost_orb_item` ait un modèle d'item (voir [Ressources](#/ressources-assets)).

## Partie 2 — une créature (mob), en survol

Une entité vivante demande plus de pièces. Vue d'ensemble.

### Enregistrement

```java
public static final RegistryObject<EntityType<Sprite>> SPRITE =
        ENTITIES.register("sprite", () -> EntityType.Builder
                .of(Sprite::new, MobCategory.CREATURE)
                .sized(0.6F, 1.8F)
                .clientTrackingRange(8)
                .build("sprite"));
```

### Attributs

Sur le **mod event bus** :

```java
@SubscribeEvent
public static void attributes(EntityAttributeCreationEvent event) {
    event.put(ModEntities.SPRITE.get(), Sprite.createAttributes().build());
}
```

```java
// Dans la classe Sprite (extends PathfinderMob / Animal / Monster)
public static AttributeSupplier.Builder createAttributes() {
    return Mob.createMobAttributes()
            .add(Attributes.MAX_HEALTH, 12.0D)
            .add(Attributes.MOVEMENT_SPEED, 0.28D)
            .add(Attributes.FOLLOW_RANGE, 16.0D);
}
```

### IA (goals)

```java
@Override
protected void registerGoals() {
    goalSelector.addGoal(0, new FloatGoal(this));
    goalSelector.addGoal(1, new PanicGoal(this, 1.4D));
    goalSelector.addGoal(2, new WaterAvoidingRandomStrollGoal(this, 1.0D));
    goalSelector.addGoal(3, new LookAtPlayerGoal(this, Player.class, 6.0F));
    goalSelector.addGoal(4, new RandomLookAroundGoal(this));
}
```

### Placement de spawn (spawn naturel)

Sur le **mod event bus** :

```java
@SubscribeEvent
public static void spawnPlacement(SpawnPlacementRegisterEvent event) {
    event.register(ModEntities.SPRITE.get(),
            SpawnPlacements.Type.ON_GROUND,
            Heightmap.Types.MOTION_BLOCKING_NO_LEAVES,
            Animal::checkAnimalSpawnRules,
            SpawnPlacementRegisterEvent.Operation.REPLACE);
}
```

Pour l'ajouter aux biomes : un **BiomeModifier** `forge:add_spawns` (même principe que la génération de minerai, voir [Générer un minerai](#/worldgen-minerai)).

### Rendu + modèle

```java
// EntityRenderersEvent.RegisterRenderers
event.registerEntityRenderer(ModEntities.SPRITE.get(), SpriteRenderer::new);

// EntityRenderersEvent.RegisterLayerDefinitions
event.registerLayerDefinition(SpriteModel.LAYER, SpriteModel::createBodyLayer);
```

La `LayerDefinition` (le maillage) se crée à la main ou, en pratique, avec **[Blockbench](https://www.blockbench.net/)** (export « Java Entity ») qui génère le code de `createBodyLayer()`. Alternative répandue : la bibliothèque **[GeckoLib](https://github.com/bernie-g/geckolib)** pour des animations plus riches.

### Œuf de spawn

Forge fournit `ForgeSpawnEggItem` (résout le problème d'ordre d'enregistrement) :

```java
public static final RegistryObject<Item> SPRITE_EGG = ITEMS.register("sprite_spawn_egg",
        () -> new ForgeSpawnEggItem(ModEntities.SPRITE, 0x88ccff, 0x224466, new Item.Properties()));
```

## Datagen associée

- **Traductions** : `entity.monmod.frost_orb`, `entity.monmod.sprite`, `item.monmod.sprite_spawn_egg`.
- **Modèle d'item** du projectile / de l'œuf (`basicItem`, ou parent `minecraft:item/template_spawn_egg`).
- Le projectile n'a **pas** de table de butin ; le mob peut en avoir une (`entities/sprite.json`).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Crash au spawn : `NullPointerException` dans le renderer | renderer non enregistré | `EntityRenderersEvent.RegisterRenderers` |
| L'entité apparaît puis disparaît aussitôt côté client | `clientTrackingRange` trop faible ou pas de renderer | régler `clientTrackingRange`, enregistrer le renderer |
| Le mob « glisse » sans IA | `registerGoals` non surchargé, ou attributs absents | ajouter goals + `EntityAttributeCreationEvent` |
| Projectile invisible mais actif | pas de modèle d'item pour `getDefaultItem()` | créer le modèle d'item |
| `IllegalStateException: Missing attributes` | `EntityAttributeCreationEvent` oublié pour un `LivingEntity` | l'ajouter sur le mod event bus |
| Le projectile traverse tout | vous avez surchargé `tick()` sans `super.tick()` | toujours appeler `super.tick()` |

Page suivante : **[Générer un minerai dans le monde](#/worldgen-minerai)**.
