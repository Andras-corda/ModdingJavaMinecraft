# IA des mobs, en profondeur

[Entités : IA & synchronisation](#/entites-ia-data) posait les bases (`Goal`, `SynchedEntityData`, navigation). Cette page va plus loin : attaques à distance, mobs volants/nageurs, **mémoire de l'agresseur** (comme l'ours polaire ou le piglin), variantes aléatoires, et une introduction au système **Brain** des villageois.

## Attaque à distance

`RangedAttackGoal` délègue le tir à l'entité via l'interface `RangedAttackMob` :

```java
public class SpriteEntity extends PathfinderMob implements RangedAttackMob {

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(1, new RangedAttackGoal(this, 1.0D, 40, 20.0F));
        //                                     ^vitesse  ^délai entre tirs (ticks)  ^portée
        this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));
    }

    @Override
    public void performRangedAttack(LivingEntity target, float distanceFactor) {
        FrostOrb orb = new FrostOrb(level(), this);
        double dx = target.getX() - getX();
        double dy = target.getY(0.5) - orb.getY();
        double dz = target.getZ() - getZ();
        orb.shoot(dx, dy + Math.sqrt(dx * dx + dz * dz) * 0.2, dz, 1.6F, 6.0F);
        level().addFreshEntity(orb);
        playSound(SoundEvents.SKELETON_SHOOT, 1.0F, 1.0F);
    }
}
```

Pour un mob à l'arc, utilisez plutôt `RangedBowAttackGoal<T extends Mob & RangedAttackMob>` avec l'item `bow` en main.

## Mobs volants et nageurs

Un mob volant a besoin d'une **navigation** et d'un **contrôle de mouvement** adaptés — sinon il « marche dans le vide » ou tombe.

```java
public class WispEntity extends PathfinderMob {

    public WispEntity(EntityType<? extends PathfinderMob> type, Level level) {
        super(type, level);
        this.moveControl = new FlyingMoveControl(this, 20, true);
        this.setNoGravity(true);
    }

    @Override
    protected PathNavigation createNavigation(Level level) {
        FlyingPathNavigation nav = new FlyingPathNavigation(this, level);
        nav.setCanOpenDoors(false);
        nav.setCanFloat(true);
        nav.setCanPassDoors(true);
        return nav;
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(1, new FlyRandomlyGoal(this));   // classe custom, voir plus bas
        this.goalSelector.addGoal(2, new LookAtPlayerGoal(this, Player.class, 8.0F));
    }
}
```

Un `Goal` de vol aléatoire simple :

```java
public class FlyRandomlyGoal extends Goal {
    private final PathfinderMob mob;

    public FlyRandomlyGoal(PathfinderMob mob) {
        this.mob = mob;
        setFlags(EnumSet.of(Goal.Flag.MOVE));
    }

    @Override public boolean canUse() { return mob.getRandom().nextInt(30) == 0; }
    @Override public boolean canContinueToUse() { return false; }   // one-shot : redémarre via canUse

    @Override
    public void start() {
        RandomSource r = mob.getRandom();
        Vec3 target = mob.position().add(
                (r.nextDouble() - 0.5) * 10, (r.nextDouble() - 0.5) * 6, (r.nextDouble() - 0.5) * 10);
        mob.getNavigation().moveTo(target.x, target.y, target.z, 0.6D);
    }
}
```

Pour un mob **nageur** (poisson, créature amphibie) : `WaterBoundPathNavigation` (reste dans l'eau) ou `AmphibiousPathNavigation` (eau + terre, comme l'axolotl) + `setPathfindingMalus(BlockPathTypes.WATER, 0)` pour autoriser l'eau sans pénalité.

## Mémoriser un agresseur (« mobs neutres »)

Comme l'ours polaire ou le cochon zombifié : neutre tant qu'on ne l'attaque pas, puis hostile **pendant un temps donné**, même si le joueur se cache. C'est l'interface **`NeutralMob`**.

```java
public class GuardianSpriteEntity extends PathfinderMob implements NeutralMob {

    private static final UniformInt PERSISTENT_ANGER_TIME = TimeUtil.rangeOfSeconds(20, 39);
    private int remainingPersistentAngerTime;
    @Nullable private UUID persistentAngerTarget;

    @Override
    protected void registerGoals() {
        this.targetSelector.addGoal(1, new HurtByTargetGoal(this).setAlertOthers());
        this.targetSelector.addGoal(2, new ResetUniversalAngerTargetGoal<>(this, true));
    }

    @Override public int getRemainingPersistentAngerTime() { return remainingPersistentAngerTime; }
    @Override public void setRemainingPersistentAngerTime(int time) { remainingPersistentAngerTime = time; }
    @Override @Nullable public UUID getPersistentAngerTarget() { return persistentAngerTarget; }
    @Override public void setPersistentAngerTarget(@Nullable UUID uuid) { persistentAngerTarget = uuid; }
    @Override public void startPersistentAngerTimer() { setRemainingPersistentAngerTime(PERSISTENT_ANGER_TIME.sample(random)); }

    @Override
    public void setLastHurtByMob(@Nullable LivingEntity entity) {
        super.setLastHurtByMob(entity);
        if (entity != null) this.setPersistentAngerTarget(entity.getUUID());
    }

    @Override
    public void tick() {
        super.tick();
        this.updatePersistentAnger((ServerLevel) level(), true);   // décrémente le minuteur, oublie la cible à 0
    }

    @Override
    public void addAdditionalSaveData(CompoundTag tag) { super.addAdditionalSaveData(tag); this.addPersistentAngerSaveData(tag); }
    @Override
    public void readAdditionalSaveData(CompoundTag tag) { super.readAdditionalSaveData(tag); this.readPersistentAngerSaveData((ServerLevel) level(), tag); }
}
```

`NeutralMob` fournit la plomberie (sauvegarde, minuteur, `ResetUniversalAngerTargetGoal`) ; vous ne codez que le déclenchement (`setLastHurtByMob`) et le tick.

## Variantes aléatoires au spawn

Comme les lapins ou les chevaux : une texture parmi plusieurs, tirée **une fois** à l'apparition et **synchronisée**.

```java
private static final EntityDataAccessor<Integer> VARIANT =
        SynchedEntityData.defineId(SpriteEntity.class, EntityDataSerializers.INT);

@Override
public SpawnGroupData finalizeSpawn(ServerLevelAccessor level, DifficultyInstance difficulty,
                                    MobSpawnType reason, @Nullable SpawnGroupData data, @Nullable CompoundTag tag) {
    this.entityData.set(VARIANT, this.random.nextInt(4));   // 4 variantes
    return super.finalizeSpawn(level, difficulty, reason, data, tag);
}

public int getVariant() { return this.entityData.get(VARIANT); }
```

Le renderer choisit la texture selon `entity.getVariant()` (voir [Modèles & rendu](#/modeles-rendu)).

## `mobGriefing` : respecter la règle de jeu

Avant qu'un mob casse un bloc, mange une culture, ramasse un item :

```java
if (net.minecraftforge.event.ForgeEventFactory.getMobGriefingEvent(level, this)) {
    level.destroyBlock(pos, true, this);
}
```

`ForgeEventFactory.getMobGriefingEvent` combine la règle de jeu `mobGriefing` **et** l'événement `EntityMobGriefingEvent` (qu'un autre mod peut annuler pour protéger une zone). Toujours passer par cette méthode plutôt que lire `level.getGameRules()` directement.

## Introduction au système `Brain` (villageois, piglins, warden)

Les entités les plus « intelligentes » de vanilla n'utilisent **pas** `Goal` mais un **`Brain<T>`** : une mémoire à court terme (`MemoryModuleType`) alimentée par des **capteurs** (`SensorType`) et exploitée par des **`Behavior`** activés selon des conditions.

```text
Sensor (observe le monde, ex. "joueurs à proximité")
   → écrit dans une Memory (ex. NEAREST_VISIBLE_PLAYER)
      → un Behavior dont les conditions sont remplies s'active
         (ex. "regarder le joueur le plus proche")
```

C'est **beaucoup** plus lourd à mettre en place qu'un `Goal` (activités, horaires, POI…). Réservez-le à une entité qui a vraiment besoin de comportements composés et d'un horaire (comme un PNJ). Pour presque tout le reste, les `Goal` classiques suffisent.

Un `Behavior` minimal (regarder la cible mémorisée) :

```java
public class LookAtRememberedTarget extends Behavior<LivingEntity> {

    public LookAtRememberedTarget() {
        super(Map.of(MemoryModuleType.ATTACK_TARGET, MemoryStatus.VALUE_PRESENT));
    }

    @Override
    protected void start(ServerLevel level, LivingEntity mob, long gameTime) {
        mob.getBrain().getMemory(MemoryModuleType.ATTACK_TARGET).ifPresent(target ->
                mob.getLookControl().setLookAt(target, 30.0F, 30.0F));
    }
}
```

Branché via `Brain.Provider<T>` + `registerActivity(Activity.CORE, ...)`. Pour un exemple complet, lisez les sources vanilla de `Villager` ou `Piglin` (mappings officiels) — c'est la meilleure documentation disponible pour ce système.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le mob volant tombe / traverse les murs | navigation par défaut (`GroundPathNavigation`) | `createNavigation` → `FlyingPathNavigation` + `moveControl` adapté |
| Le mob « oublie » son agresseur trop vite / jamais | `NeutralMob` mal câblé (tick, save data) | appeler `updatePersistentAnger` chaque tick, sauvegarder/charger |
| Le tir à distance ne part jamais | `RangedAttackGoal` sans `RangedAttackMob` implémenté | implémenter `performRangedAttack` |
| Variante différente à chaque rechargement | pas de sauvegarde du `SynchedEntityData` custom | `addAdditionalSaveData`/`readAdditionalSaveData` (voir [Entités : IA & synchro](#/entites-ia-data)) |
| Le mob casse des blocs même `mobGriefing=false` | lecture directe de la règle sans passer par Forge | `ForgeEventFactory.getMobGriefingEvent(level, entity)` |
| `Brain` : `NullPointerException` sur une mémoire absente | lue sans vérifier `getMemory(...).isPresent()` | toujours passer par `Optional` |

Page suivante : **[Élevage & apprivoisement](#/elevage-apprivoisement)**.
