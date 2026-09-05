# Créer un boss

Un boss = une entité avec **beaucoup de vie**, une **barre de boss**, souvent des **phases**, des **résistances**, et une apparition / mort spectaculaires.

Prérequis : [Une entité & un projectile](#/entite-projectile), [Entités : IA & synchronisation](#/entites-ia-data).

## 1. L'entité et ses attributs

```java
public class ForgeGolemEntity extends Monster {

    private final ServerBossEvent bossEvent = new ServerBossEvent(
            this.getDisplayName(),
            BossEvent.BossBarColor.RED,
            BossEvent.BossBarOverlay.PROGRESS);

    // phase 0 = normal, 1 = enragé
    private static final EntityDataAccessor<Integer> PHASE =
            SynchedEntityData.defineId(ForgeGolemEntity.class, EntityDataSerializers.INT);

    public ForgeGolemEntity(EntityType<? extends Monster> type, Level level) {
        super(type, level);
        this.setPersistenceRequired();          // ne despawn jamais
        this.xpReward = 250;
        this.bossEvent.setDarkenScreen(true);
        this.bossEvent.setPlayBossMusic(true);
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Monster.createMonsterAttributes()
                .add(Attributes.MAX_HEALTH, 300.0D)
                .add(Attributes.ATTACK_DAMAGE, 12.0D)
                .add(Attributes.ARMOR, 12.0D)
                .add(Attributes.KNOCKBACK_RESISTANCE, 1.0D)
                .add(Attributes.MOVEMENT_SPEED, 0.25D)
                .add(Attributes.FOLLOW_RANGE, 48.0D);
    }

    @Override
    protected void defineSynchedData() {
        super.defineSynchedData();
        this.entityData.define(PHASE, 0);
    }

    public int getPhase() { return this.entityData.get(PHASE); }
    private void setPhase(int p) { this.entityData.set(PHASE, p); }
}
```

Enregistrez l'`EntityType` et les attributs comme dans [Une entité & un projectile](#/entite-projectile) (`EntityAttributeCreationEvent`).

## 2. La barre de boss

`ServerBossEvent` suit automatiquement les joueurs à qui l'ajouter/retirer :

```java
@Override
public void startSeenByPlayer(ServerPlayer player) {
    super.startSeenByPlayer(player);
    this.bossEvent.addPlayer(player);
}

@Override
public void stopSeenByPlayer(ServerPlayer player) {
    super.stopSeenByPlayer(player);
    this.bossEvent.removePlayer(player);
}

@Override
public void setCustomName(@Nullable Component name) {
    super.setCustomName(name);
    this.bossEvent.setName(this.getDisplayName());
}

@Override
protected void customServerAiStep() {
    super.customServerAiStep();
    this.bossEvent.setProgress(this.getHealth() / this.getMaxHealth());
}
```

`BossBarColor` : `PINK`, `BLUE`, `RED`, `GREEN`, `YELLOW`, `PURPLE`, `WHITE`.
`BossBarOverlay` : `PROGRESS`, `NOTCHED_6`, `NOTCHED_10`, `NOTCHED_12`, `NOTCHED_20`.

Pour un rendu **entièrement custom** (segments par phase, couleur changeante), voir [Overlays & HUD](#/overlays-hud) : annulez `VanillaGuiOverlay.BOSS_EVENT_PROGRESS` et dessinez la vôtre à partir de `PHASE` synchronisé.

## 3. Ne pas disparaître, ne pas changer de dimension

```java
@Override public boolean removeWhenFarAway(double distance) { return false; }
@Override public boolean canChangeDimensions() { return false; }
@Override protected boolean shouldDespawnInPeaceful() { return false; }
@Override public boolean canBeLeashed(Player player) { return false; }
```

## 4. Résistances

```java
// Plafonner les dégâts par coup (anti one-shot avec épée enchantée)
@Override
public boolean hurt(DamageSource source, float amount) {
    if (this.isInvulnerableTo(source)) return false;

    // immunité pendant l'intro / une transition de phase
    if (this.transitioning) return false;

    // cap : 10 % de la vie max par coup
    float capped = Math.min(amount, this.getMaxHealth() * 0.10F);

    boolean hurt = super.hurt(source, capped);
    if (hurt) checkPhaseTransition();
    return hurt;
}

@Override
public boolean isInvulnerableTo(DamageSource source) {
    return source.is(DamageTypeTags.IS_DROWNING)
        || source.is(DamageTypeTags.IS_FALL)
        || source.is(DamageTypes.IN_WALL)
        || source.is(DamageTypes.FELL_OUT_OF_WORLD) == false && super.isInvulnerableTo(source);
}

// Immunité à certains effets
@Override
public boolean canBeAffected(MobEffectInstance effect) {
    if (effect.getEffect() == MobEffects.POISON || effect.getEffect() == MobEffects.WITHER) return false;
    return super.canBeAffected(effect);
}

// Pas de recul
@Override public void knockback(double strength, double x, double z) { /* rien */ }

// Ne pas casser les blocs autour même si mobGriefing est actif ? (au contraire, souvent on VEUT qu'il casse)
```

## 5. Les phases

```java
private boolean transitioning = false;
private int transitionTicks = 0;

private void checkPhaseTransition() {
    if (getPhase() == 0 && getHealth() < getMaxHealth() * 0.5F) {
        startTransition(1);
    }
}

private void startTransition(int newPhase) {
    this.transitioning = true;
    this.transitionTicks = 60;                 // 3 s d'invulnérabilité + animation
    setPhase(newPhase);
    if (level() instanceof ServerLevel sl) {
        sl.playSound(null, blockPosition(), SoundEvents.WARDEN_ROAR, SoundSource.HOSTILE, 2F, 0.6F);
        sl.sendParticles(ParticleTypes.EXPLOSION, getX(), getY() + 1, getZ(), 12, 1, 1, 1, 0.0);
    }
    // ré-armer l'IA pour la nouvelle phase
    this.goalSelector.getAvailableGoals().clear();
    registerPhaseGoals(newPhase);
}

@Override
public void aiStep() {
    super.aiStep();
    if (transitioning && --transitionTicks <= 0) {
        transitioning = false;
        this.setDeltaMovement(Vec3.ZERO);
    }
}
```

## 6. L'IA

```java
@Override
protected void registerGoals() {
    this.goalSelector.addGoal(0, new FloatGoal(this));
    registerPhaseGoals(0);
    this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));
    this.targetSelector.addGoal(2, new HurtByTargetGoal(this));
}

private void registerPhaseGoals(int phase) {
    this.goalSelector.addGoal(1, new MeleeAttackGoal(this, phase == 0 ? 1.0D : 1.4D, true));
    this.goalSelector.addGoal(2, new MoveTowardsTargetGoal(this, 1.0D, 32.0F));
    if (phase >= 1) {
        this.goalSelector.addGoal(1, new SlamAttackGoal(this));    // AoE, uniquement enragé
    }
}
```

Un `Goal` custom pour une attaque de boss : voir [Entités : IA & synchronisation](#/entites-ia-data).

## 7. Apparition spectaculaire

Souvent déclenchée par un **item rituel** ou une **structure** ([Structures](#/structures)) :

```java
public static void summon(ServerLevel level, BlockPos pos) {
    ForgeGolemEntity boss = ModEntities.FORGE_GOLEM.get().create(level);
    if (boss == null) return;
    boss.moveTo(pos.getX() + 0.5, pos.getY(), pos.getZ() + 0.5, 0, 0);
    boss.setPhase(0);
    boss.finalizeSpawn(level, level.getCurrentDifficultyAt(pos), MobSpawnType.EVENT, null, null);
    level.levelEvent(1023, pos, 0);     // son d'apparition du Wither (global)
    level.addFreshEntity(boss);
}
```

## 8. Mort spectaculaire & butin

```java
@Override
protected void tickDeath() {
    ++this.deathTime;
    if (this.deathTime == 1 && !level().isClientSide()) {
        level().broadcastEntityEvent(this, EntityEvent.POOF);      // particules
    }
    if (level() instanceof ServerLevel sl && this.deathTime % 5 == 0) {
        sl.sendParticles(ParticleTypes.EXPLOSION, getRandomX(1), getRandomY(), getRandomZ(1), 1, 0, 0, 0, 0.0);
    }
    if (this.deathTime == 80) {                                    // ~4 s d'animation
        if (level() instanceof ServerLevel sl) {
            sl.explode(this, getX(), getY(), getZ(), 2.0F, Level.ExplosionInteraction.NONE);
        }
        this.remove(RemovalReason.KILLED);
    }
}

@Override
public void die(DamageSource source) {
    super.die(source);
    this.bossEvent.removeAllPlayers();
}
```

Butin : table `data/monmod/loot_tables/entities/forge_golem.json` — item unique, blocs rares, beaucoup d'XP (`xpReward` + éventuel bonus).

## 9. Sauvegarde

```java
@Override
public void addAdditionalSaveData(CompoundTag tag) {
    super.addAdditionalSaveData(tag);
    tag.putInt("Phase", getPhase());
    if (this.hasCustomName()) this.bossEvent.setName(this.getDisplayName());
}
@Override
public void readAdditionalSaveData(CompoundTag tag) {
    super.readAdditionalSaveData(tag);
    setPhase(tag.getInt("Phase"));
}
```

## 10. Barre de boss **sans** entité (`/bossbar` ou événement scénarisé)

Pour un raid, un compte à rebours, un événement serveur sans monstre : la commande `/bossbar` (ou son équivalent code via `CustomBossEvents` du serveur : `server.getCustomBossEvents().create(id, name)`).

```java
CustomBossEvent bar = server.getCustomBossEvents()
        .create(new ResourceLocation(MonMod.MODID, "raid"), Component.literal("Assaut"));
bar.setColor(BossEvent.BossBarColor.PURPLE);
bar.setMax(100); bar.setValue(100);
bar.setVisible(true);
bar.addPlayer(serverPlayer);
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Pas de barre de boss | `addPlayer` jamais appelé | override `startSeenByPlayer` / `stopSeenByPlayer` |
| Barre figée | `setProgress` non mis à jour | `customServerAiStep` → `setProgress(hp/maxHp)` |
| Le boss despawn / rentre dans un portail | `removeWhenFarAway` / `canChangeDimensions` par défaut | les override à `false`, `setPersistenceRequired()` |
| One-shot par une épée nette V | pas de plafond de dégâts | plafonner dans `hurt` |
| Transition de phase sautée (dégâts multiples dans le même tick) | condition testée après `super.hurt` sans garde | drapeau `transitioning`, invulnérabilité temporaire |
| Barre reste à l'écran après la mort | `bossEvent.removeAllPlayers()` oublié | l'appeler dans `die` |
| Phase non synchronisée (rendu client faux) | champ simple au lieu de `SynchedEntityData` | `EntityDataAccessor<Integer> PHASE` |

Page suivante : **[Structures & génération (villages, donjons)](#/structures)**.
