# Élevage & apprivoisement

Comment créer une créature qu'on peut **apprivoiser** (comme le loup) ou **élever** (comme la vache) : nourrir, faire naître des petits, la faire suivre puis s'asseoir.

Prérequis : [Entités : IA & synchronisation](#/entites-ia-data), [IA des mobs, en profondeur](#/ia-avancee).

## Élevage (breeding) — s'applique à tout `Animal`

Deux méthodes à surcharger suffisent pour qu'un `Animal` (ou sous-classe) devienne « reproductible » avec un item précis.

```java
public class SpriteAnimal extends Animal {

    public SpriteAnimal(EntityType<? extends Animal> type, Level level) { super(type, level); }

    /** Quel item déclenche le "mode amour" (cœurs) quand on le donne. */
    @Override
    public boolean isFood(ItemStack stack) {
        return stack.is(ModItems.MAGIC_BERRY.get());
    }

    /** L'enfant produit quand deux parents en mode amour se rencontrent. */
    @Nullable
    @Override
    public AgeableMob getBreedOffspring(ServerLevel level, AgeableMob otherParent) {
        return ModEntities.SPRITE.get().create(level);
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(0, new FloatGoal(this));
        this.goalSelector.addGoal(1, new PanicGoal(this, 1.5D));
        this.goalSelector.addGoal(2, new BreedGoal(this, 1.0D));
        this.goalSelector.addGoal(3, new TemptGoal(this, 1.2D, s -> s.is(ModItems.MAGIC_BERRY.get()), false));
        this.goalSelector.addGoal(4, new FollowParentGoal(this, 1.1D));
        this.goalSelector.addGoal(5, new WaterAvoidingRandomStrollGoal(this, 1.0D));
        this.goalSelector.addGoal(6, new LookAtPlayerGoal(this, Player.class, 6.0F));
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Animal.createMobAttributes()
                .add(Attributes.MAX_HEALTH, 8.0D)
                .add(Attributes.MOVEMENT_SPEED, 0.25D);
    }
}
```

Vous n'avez **rien d'autre à faire** : la classe `Animal` gère déjà, à partir de `isFood`, le clic droit (mode amour, particules cœur, consommation de l'item), le minuteur avant reproduction, et l'appel à `getBreedOffspring` quand deux parents en mode amour se rencontrent (via `BreedGoal`).

### Bébés

`AgeableMob` (parent d'`Animal`) gère l'âge : négatif = bébé (grandit jusqu'à 0), positif = adulte, avec un cooldown après reproduction.

```java
// Faire naître un bébé directement (spawn, oeuf...)
SpriteAnimal baby = ModEntities.SPRITE.get().create(level);
baby.setAge(-24000);          // -24000 ticks = 20 min avant l'âge adulte
level.addFreshEntity(baby);
```

`getAgeScale()` réduit automatiquement le modèle rendu pour les bébés — rien à faire côté rendu.

## Apprivoisement — `TamableAnimal`

Pour un compagnon comme le loup : possède un **propriétaire**, peut **s'asseoir**, suit son maître.

```java
public class SpriteCompanion extends TamableAnimal {

    public SpriteCompanion(EntityType<? extends TamableAnimal> type, Level level) { super(type, level); }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(0, new FloatGoal(this));
        this.goalSelector.addGoal(1, new SitWhenOrderedToGoal(this));
        this.goalSelector.addGoal(2, new FollowOwnerGoal(this, 1.0D, 10.0F, 2.0F, false));
        this.goalSelector.addGoal(3, new WaterAvoidingRandomStrollGoal(this, 1.0D));
        this.goalSelector.addGoal(4, new LookAtPlayerGoal(this, Player.class, 8.0F));
        this.targetSelector.addGoal(1, new OwnerHurtByTargetGoal(this));   // défend le maître
        this.targetSelector.addGoal(2, new OwnerHurtTargetGoal(this));    // attaque avec le maître
    }

    public static AttributeSupplier.Builder createAttributes() {
        return TamableAnimal.createMobAttributes()
                .add(Attributes.MAX_HEALTH, 20.0D)
                .add(Attributes.MOVEMENT_SPEED, 0.3D)
                .add(Attributes.ATTACK_DAMAGE, 3.0D);
    }

    @Override
    public InteractionResult mobInteract(Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);

        if (!this.isTame()) {
            // Pas encore apprivoisé : chance basée sur l'item de "confiance"
            if (stack.is(ModItems.MAGIC_BERRY.get())) {
                if (!level().isClientSide()) {
                    if (!player.getAbilities().instabuild) stack.shrink(1);
                    if (this.random.nextInt(3) == 0) {
                        this.tame(player);
                        this.navigation.stop();
                        this.setTarget(null);
                        this.setOrderedToSit(true);
                        level().broadcastEntityEvent(this, (byte) 7);   // particules cœur
                    } else {
                        level().broadcastEntityEvent(this, (byte) 6);   // particules fumée (échec)
                    }
                }
                return InteractionResult.sidedSuccess(level().isClientSide());
            }
            return super.mobInteract(player, hand);
        }

        // Déjà apprivoisé : le propriétaire peut le faire asseoir / se lever
        if (this.isOwnedBy(player)) {
            if (stack.is(ModItems.MAGIC_BERRY.get()) && this.getHealth() < this.getMaxHealth()) {
                if (!player.getAbilities().instabuild) stack.shrink(1);
                this.heal(4.0F);
                return InteractionResult.sidedSuccess(level().isClientSide());
            }
            if (!level().isClientSide() && !this.isFood(stack)) {
                this.setOrderedToSit(!this.isOrderedToSit());
                this.navigation.stop();
            }
            return InteractionResult.sidedSuccess(level().isClientSide());
        }

        return super.mobInteract(player, hand);
    }

    @Override
    public boolean isFood(ItemStack stack) { return stack.is(ModItems.MAGIC_BERRY.get()); }

    @Nullable
    @Override
    public AgeableMob getBreedOffspring(ServerLevel level, AgeableMob otherParent) {
        SpriteCompanion baby = ModEntities.SPRITE_COMPANION.get().create(level);
        if (baby != null) baby.setOwnerUUID(this.getOwnerUUID());   // le bébé hérite du propriétaire
        return baby;
    }
}
```

### Ce que `TamableAnimal` fournit déjà

| Membre | Rôle |
|--------|------|
| `isTame()` | apprivoisé ou non |
| `tame(Player)` | marque comme apprivoisé par ce joueur |
| `getOwnerUUID()` / `setOwnerUUID(UUID)` | propriétaire (persistant, synchronisé) |
| `isOwnedBy(LivingEntity)` | ce joueur est-il le propriétaire ? |
| `isOrderedToSit()` / `setOrderedToSit(boolean)` | assis ou non (avec `SitWhenOrderedToGoal`) |
| `SitWhenOrderedToGoal`, `FollowOwnerGoal`, `OwnerHurtByTargetGoal`, `OwnerHurtTargetGoal` | *goals* prêts à l'emploi |

### Œuf de spawn et animations

- Œuf : `ForgeSpawnEggItem` (voir [Une entité & un projectile](#/entite-projectile)).
- Particules d'apprivoisement : `broadcastEntityEvent(this, (byte) 7)` (cœurs, succès) / `(byte) 6` (fumée, échec) sont les codes vanilla — aucune particule custom à écrire.
- Position assise dans le rendu : gérée automatiquement par le modèle si vous héritez d'un renderer basé sur `isInSittingPose()`/`isOrderedToSit()` ; avec [GeckoLib](#/geckolib), pilotez une animation `sit` via un `AnimationController` qui teste `isOrderedToSit()`.

## Dressage progressif sans apprivoisement complet

Pour un mob qu'on **attire** sans le posséder (comme les axolotls avec un seau de têtards, ou faire suivre temporairement) : `TemptGoal` seul, sans `TamableAnimal`. Le mob suit l'item tenu tant qu'il est visible, sans notion de propriétaire.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le clic droit ne déclenche jamais le mode amour | `isFood` non surchargé, ou `mobInteract` de la sous-classe ne rappelle pas `super` | vérifier `isFood`, appeler `super.mobInteract` si non géré |
| Aucun bébé n'apparaît | `getBreedOffspring` renvoie `null` | renvoyer une instance de `EntityType.create(level)` |
| Le compagnon n'obéit qu'à un joueur, pas à son vrai propriétaire | `isOwnedBy` non vérifié avant d'agir | toujours conditionner par `isOwnedBy(player)` |
| Le bébé apprivoisé n'a pas de propriétaire | `setOwnerUUID` oublié dans `getBreedOffspring` | copier `getOwnerUUID()` du parent |
| Le mob s'assoit mais continue à se déplacer | `navigation.stop()` non appelé | l'appeler en même temps que `setOrderedToSit(true)` |
| `OwnerHurtByTargetGoal` ne défend jamais | `targetSelector` vide ou mauvaise priorité | l'ajouter en priorité haute (0-1) |

Page suivante : **[Métiers & commerce des villageois](#/villageois-metiers)**.
