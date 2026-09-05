# Entités : IA & synchronisation

Complément de [Une entité & un projectile](#/entite-projectile) : comment une créature **décide** (IA), **retient** son état (données sauvegardées) et le **partage** avec le client (données synchronisées).

## Trois façons de stocker des données sur une entité

| Mécanisme | Sauvegardé ? | Synchronisé client ? | Pour quoi |
|-----------|--------------|----------------------|-----------|
| Champ Java simple | non | non | état transitoire (cible courante, timer d'IA) |
| `addAdditionalSaveData` / `readAdditionalSaveData` | **oui** | non | état persistant non affiché (âge, humeur) |
| `SynchedEntityData` (`EntityDataAccessor`) | selon usage | **oui** | tout ce que le client doit voir : variante, couleur, « assis », animation |

### `SynchedEntityData`

```java
public class SpriteEntity extends PathfinderMob {

    private static final EntityDataAccessor<Integer> VARIANT =
            SynchedEntityData.defineId(SpriteEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Boolean> GLOWING_TRAIL =
            SynchedEntityData.defineId(SpriteEntity.class, EntityDataSerializers.BOOLEAN);

    public SpriteEntity(EntityType<? extends PathfinderMob> type, Level level) { super(type, level); }

    @Override
    protected void defineSynchedData() {
        super.defineSynchedData();
        this.entityData.define(VARIANT, 0);
        this.entityData.define(GLOWING_TRAIL, false);
    }

    public int getVariant() { return this.entityData.get(VARIANT); }
    public void setVariant(int v) { this.entityData.set(VARIANT, v); }   // propagé au client automatiquement

    // Persistance
    @Override
    public void addAdditionalSaveData(CompoundTag tag) {
        super.addAdditionalSaveData(tag);
        tag.putInt("Variant", getVariant());
    }
    @Override
    public void readAdditionalSaveData(CompoundTag tag) {
        super.readAdditionalSaveData(tag);
        setVariant(tag.getInt("Variant"));
    }
}
```

Sérialiseurs disponibles : `BYTE`, `INT`, `LONG`, `FLOAT`, `BOOLEAN`, `STRING`, `COMPONENT`, `OPTIONAL_COMPONENT`, `ITEM_STACK`, `BLOCK_STATE`, `OPTIONAL_BLOCK_STATE`, `BLOCK_POS`, `OPTIONAL_BLOCK_POS`, `DIRECTION`, `OPTIONAL_UUID`, `COMPOUND_TAG`, `PARTICLE`, `VILLAGER_DATA`, `POSE`, `CAT_VARIANT`, `FROG_VARIANT`, `PAINTING_VARIANT`.

### Données custom au spawn (Forge)

Certaines données doivent être connues du client **dès l'apparition** et ne changent jamais. Plutôt qu'un `SynchedEntityData` permanent, implémentez `IEntityAdditionalSpawnData` :

```java
public class ArrowRainEntity extends Entity implements IEntityAdditionalSpawnData {
    private int radius;

    @Override public void writeSpawnData(FriendlyByteBuf buf) { buf.writeVarInt(radius); }
    @Override public void readSpawnData(FriendlyByteBuf buf) { this.radius = buf.readVarInt(); }
}
```

## L'IA à base de `Goal`

Deux sélecteurs :

- **`goalSelector`** : *que fait* la créature (errer, fuir, attaquer au corps-à-corps, regarder le joueur).
- **`targetSelector`** : *qui* elle prend pour cible (le dernier agresseur, le joueur le plus proche).

Priorité **basse = plus prioritaire** (0 avant 5).

```java
@Override
protected void registerGoals() {
    // goalSelector
    this.goalSelector.addGoal(0, new FloatGoal(this));                             // ne pas se noyer
    this.goalSelector.addGoal(1, new MeleeAttackGoal(this, 1.2D, false));
    this.goalSelector.addGoal(2, new WaterAvoidingRandomStrollGoal(this, 1.0D));
    this.goalSelector.addGoal(3, new LookAtPlayerGoal(this, Player.class, 8.0F));
    this.goalSelector.addGoal(4, new RandomLookAroundGoal(this));

    // targetSelector
    this.targetSelector.addGoal(0, new HurtByTargetGoal(this));                    // riposte
    this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));
}
```

### Goals fournis (extrait)

| Goal | Effet |
|------|-------|
| `FloatGoal` | remonter à la surface |
| `PanicGoal(mob, speed)` | fuir quand blessé |
| `MeleeAttackGoal(mob, speed, followEvenIfNotSeen)` | attaque au contact |
| `RangedAttackGoal` / `RangedBowAttackGoal` | attaque à distance |
| `WaterAvoidingRandomStrollGoal` / `RandomStrollGoal` | déambulation |
| `LookAtPlayerGoal` / `RandomLookAroundGoal` | regard |
| `TemptGoal(mob, speed, ingredient, canScare)` | suivre un item |
| `BreedGoal`, `FollowParentGoal` | reproduction (Animal) |
| `AvoidEntityGoal(mob, class, dist, walkSpeed, sprintSpeed)` | éviter un type |
| `OpenDoorGoal`, `MoveThroughVillageGoal` | villages |
| `LeapAtTargetGoal`, `RandomSwimmingGoal`, `FollowMobGoal` | divers |

### Un `Goal` custom

```java
public class ChargeAttackGoal extends Goal {

    private final PathfinderMob mob;
    private LivingEntity target;
    private int cooldown;

    public ChargeAttackGoal(PathfinderMob mob) {
        this.mob = mob;
        this.setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK));
    }

    @Override
    public boolean canUse() {
        this.target = mob.getTarget();
        return target != null && cooldown-- <= 0 && mob.distanceToSqr(target) > 16;
    }

    @Override public boolean canContinueToUse() {
        return target != null && target.isAlive() && mob.distanceToSqr(target) > 4;
    }

    @Override
    public void start() {
        Vec3 dir = target.position().subtract(mob.position()).normalize();
        mob.setDeltaMovement(dir.scale(1.6).add(0, 0.1, 0));
        mob.getNavigation().stop();
    }

    @Override
    public void stop() {
        this.cooldown = 100;
        this.target = null;
    }

    @Override public boolean requiresUpdateEveryTick() { return true; }
}
```

Enregistrez-le dans `registerGoals`.

## Navigation & mouvement

```java
@Override
protected PathNavigation createNavigation(Level level) {
    return new FlyingPathNavigation(this, level);   // ou GroundPathNavigation, AmphibiousPathNavigation, WallClimberNavigation
}

// se déplacer
this.getNavigation().moveTo(x, y, z, 1.0D);
this.getNavigation().moveTo(targetEntity, 1.2D);
this.getMoveControl(); this.getLookControl(); this.getJumpControl();
```

## Le système `Brain` (mémoire & comportements)

Les villageois, l'axolotl, le warden utilisent un `Brain<T>` : des **mémoires** (`MemoryModuleType`) alimentées par des **capteurs** (`SensorType`), et des **`Behavior`** activés selon des conditions.

C'est plus puissant (comportements composables, planification) mais nettement plus complexe. Pour un mob « classique », restez sur les `Goal`. Si vous en avez besoin, partez de `net.minecraft.world.entity.animal.axolotl.Axolotl` comme modèle et lisez [docs.minecraftforge.net](https://docs.minecraftforge.net/en/1.20.1/) + le code vanilla.

## Attributs modifiables en jeu

```java
this.getAttribute(Attributes.MOVEMENT_SPEED).setBaseValue(0.35D);

this.getAttribute(Attributes.ARMOR).addPermanentModifier(new AttributeModifier(
        UUID.fromString("..."), "enraged_armor", 4.0, AttributeModifier.Operation.ADDITION));
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Variante identique pour tous / clignote | stockée dans un champ simple non synchronisé | `SynchedEntityData` + `addAdditionalSaveData` |
| `defineSynchedData` : `NullPointerException` | `entityData.get(...)` avant `define(...)` | définir **avant** tout accès, appeler `super` en premier |
| Le mob reste immobile | `registerGoals` vide, ou pas d'attributs | ajouter des goals + `EntityAttributeCreationEvent` |
| Le mob ne cible jamais | `targetSelector` vide ou goal de trop haute priorité qui bloque | vérifier priorités et `getFlags()` |
| Goal custom jamais lancé | `getFlags()` en conflit avec un goal plus prioritaire | limiter les `Flag`, ajuster la priorité |
| Données de spawn absentes côté client | `IEntityAdditionalSpawnData` non implémenté / `EntityType.Builder` sans `setCustomClientFactory` (Forge le gère par défaut en 1.20.1) | implémenter l'interface |

Page suivante : **[IA des mobs, en profondeur](#/ia-avancee)**.
