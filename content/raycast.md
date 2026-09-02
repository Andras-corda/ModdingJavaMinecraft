# Lancer de rayon (raycasting)

Le **raycasting** consiste à tracer une demi-droite depuis un point (souvent les yeux d'une entité) dans une direction, et à trouver **le premier obstacle** : un bloc, une entité, ou un fluide. C'est la base de : « quel bloc je regarde ? », les armes à distance instantanée (*hitscan*), les baguettes/outils de sélection, les capteurs, la visée des mobs.

> :info: Cette page suppose la lecture de [Prérequis & concepts clés](#/prerequis) (côtés client/serveur) et [Blocs, items & onglets](#/blocs-items).

## Vocabulaire

| Type | Rôle |
|------|------|
| `Vec3` | un point ou un vecteur en coordonnées monde (`double` x/y/z) |
| `HitResult` | résultat abstrait d'un lancer. `getType()` = `MISS`, `BLOCK` ou `ENTITY` |
| `BlockHitResult` | touche un bloc : `getBlockPos()`, `getDirection()` (face touchée), `getLocation()` (point exact) |
| `EntityHitResult` | touche une entité : `getEntity()`, `getLocation()` |
| `ClipContext` | paramètres d'un lancer contre les blocs (mode bloc, mode fluide, entité émettrice) |

## 1. Le cas le plus simple : « quel bloc je regarde ? »

### Côté client (rendu, aperçu, HUD)

Minecraft calcule déjà en permanence la cible du réticule :

```java
HitResult hit = Minecraft.getInstance().hitResult;
if (hit != null && hit.getType() == HitResult.Type.BLOCK) {
    BlockPos pos = ((BlockHitResult) hit).getBlockPos();
    // ... afficher un contour, une infobulle, etc.
}
```

`Minecraft.getInstance().hitResult` prend en compte les entités **et** les blocs, avec la portée d'interaction du joueur.

### Côté serveur (logique de jeu)

Le serveur ne stocke pas ce champ : il faut lancer le rayon soi-même.

```java
/** Ce que le joueur regarde, blocs uniquement, avec la portée vanilla. */
public static BlockHitResult pickBlock(Player player, boolean hitFluids) {
    double reach = player.getBlockReach();          // 4.5 en survie (Forge ajoute un attribut)
    float partial = 1.0F;
    return (BlockHitResult) player.pick(reach, partial, hitFluids);
}
```

`Entity#pick(distance, partialTicks, hitFluids)` fait un `clip` interne et renvoie un `BlockHitResult` (jamais d'entité).

## 2. Lancer de rayon contre les blocs : `Level#clip`

La méthode générale. On construit deux points (départ, arrivée) et un `ClipContext` :

```java
public static BlockHitResult raycastBlocks(Level level, Entity source, double distance,
                                           boolean hitFluids) {
    Vec3 start = source.getEyePosition();                       // origine : les yeux
    Vec3 direction = source.getViewVector(1.0F);                // direction du regard, normalisée
    Vec3 end = start.add(direction.x * distance,
                         direction.y * distance,
                         direction.z * distance);

    ClipContext.Fluid fluidMode = hitFluids ? ClipContext.Fluid.ANY : ClipContext.Fluid.NONE;

    return level.clip(new ClipContext(
            start, end,
            ClipContext.Block.OUTLINE,   // OUTLINE = forme visuelle ; COLLIDER = forme de collision
            fluidMode,
            source));                    // l'entité émettrice (ignorée par le lancer)
}
```

Exploitation :

```java
BlockHitResult hit = raycastBlocks(level, player, 5.0, false);

switch (hit.getType()) {
    case MISS -> {
        // rien dans la portée ; hit.getLocation() == end
    }
    case BLOCK -> {
        BlockPos pos       = hit.getBlockPos();     // le bloc touché
        Direction face      = hit.getDirection();   // la face touchée (UP, NORTH...)
        Vec3 exactPoint     = hit.getLocation();    // point d'impact précis
        BlockState state    = level.getBlockState(pos);
        BlockPos placeAt    = pos.relative(face);   // case adjacente (pour "poser" quelque chose)
    }
    default -> { }
}
```

### `OUTLINE` ou `COLLIDER` ?

- **`ClipContext.Block.OUTLINE`** : la boîte de sélection visible (ex. un bouton, une dalle). Utilisez-le pour « qu'est-ce que je vise ? ».
- **`ClipContext.Block.COLLIDER`** : la forme de collision (ex. une échelle n'a pas de collision). Utilisez-le pour « une flèche passerait-elle ? », les lignes de vue.
- **`ClipContext.Block.VISUAL`** : forme d'occlusion, rarement utile.

### Fluides

- `ClipContext.Fluid.NONE` : ignore l'eau et la lave.
- `ClipContext.Fluid.SOURCE_ONLY` : ne touche que les blocs sources.
- `ClipContext.Fluid.ANY` : touche tout fluide (utile pour un seau, une canne à pêche).

## 3. Lancer de rayon contre les entités

`Level#clip` **ignore les entités**. Pour elles, on utilise `ProjectileUtil`.

### Cas simple : blocs + entités en une passe

```java
public static HitResult raycastFull(Entity source, double distance) {
    return ProjectileUtil.getHitResultOnViewVector(
            source,
            target -> !target.isSpectator() && target.isPickable(),
            distance);
}
```

`getHitResultOnViewVector` lance d'abord contre les blocs, puis cherche une entité **plus proche** que le bloc touché. Le résultat est un `BlockHitResult` **ou** un `EntityHitResult`.

### Cas maîtrisé : lancer manuel combiné

Quand il faut un filtre précis, l'origine exacte, ou réutiliser la distance :

```java
public static HitResult raycast(Player player, double reach, boolean hitFluids) {
    Level level = player.level();
    Vec3 eye = player.getEyePosition();
    Vec3 view = player.getViewVector(1.0F);
    Vec3 end = eye.add(view.scale(reach));

    // a) Blocs
    ClipContext.Fluid fluid = hitFluids ? ClipContext.Fluid.ANY : ClipContext.Fluid.NONE;
    BlockHitResult blockHit = level.clip(
            new ClipContext(eye, end, ClipContext.Block.COLLIDER, fluid, player));

    // On ne cherche des entités que jusqu'au bloc touché.
    Vec3 searchEnd = blockHit.getType() == HitResult.Type.MISS ? end : blockHit.getLocation();
    double maxDistSq = eye.distanceToSqr(searchEnd);

    // b) Entités dans la boîte englobant le trajet
    AABB box = player.getBoundingBox().expandTowards(view.scale(reach)).inflate(1.0D);
    EntityHitResult entityHit = ProjectileUtil.getEntityHitResult(
            player, eye, searchEnd, box,
            e -> !e.isSpectator() && e.isPickable() && e != player,
            maxDistSq);   // comparée en distance AU CARRÉ malgré le nom du paramètre

    // c) L'entité gagne si elle est devant le bloc (déjà garanti par maxDistSq)
    return entityHit != null ? entityHit : blockHit;
}
```

Puis :

```java
HitResult hit = raycast(player, 20.0, false);
if (hit.getType() == HitResult.Type.ENTITY) {
    Entity target = ((EntityHitResult) hit).getEntity();
    if (target instanceof LivingEntity living && !level.isClientSide()) {
        living.hurt(level.damageSources().playerAttack(player), 6.0F);
    }
}
```

## 4. Lancer depuis un mob (ligne de vue, visée d'IA)

```java
// Le mob "voit-il" sa cible sans mur entre eux ?
public static boolean hasLineOfSight(Mob mob, Entity target) {
    Vec3 from = new Vec3(mob.getX(), mob.getEyeY(), mob.getZ());
    Vec3 to   = new Vec3(target.getX(), target.getEyeY(), target.getZ());
    BlockHitResult hit = mob.level().clip(
            new ClipContext(from, to, ClipContext.Block.COLLIDER, ClipContext.Fluid.NONE, mob));
    return hit.getType() == HitResult.Type.MISS
        || hit.getBlockPos().equals(target.blockPosition());
}
```

(`Mob#getSensing().hasLineOfSight(entity)` existe aussi et met en cache le résultat par tick — préférez-le pour l'IA.)

## 5. Origine et direction personnalisées

Le rayon n'est pas obligé de partir des yeux ni de suivre le regard :

```java
// Depuis la pointe d'un objet tenu, vers un point cliqué
Vec3 start = player.getEyePosition().add(player.getViewVector(1F).scale(0.5));
Vec3 dir   = targetPoint.subtract(start).normalize();
Vec3 end   = start.add(dir.scale(64));
```

Pour un rendu fluide côté client, passez le *partial tick* réel :

```java
float pt = Minecraft.getInstance().getFrameTime();
Vec3 eye = player.getEyePosition(pt);
Vec3 view = player.getViewVector(pt);
```

## 6. Dessiner une traînée le long du rayon

Effet visuel (étincelles), à faire **côté serveur** avec `ServerLevel#sendParticles` pour que tous les joueurs voient :

```java
if (level instanceof ServerLevel server) {
    Vec3 start = player.getEyePosition();
    Vec3 step = hit.getLocation().subtract(start).scale(1.0 / 24.0);
    Vec3 p = start;
    for (int i = 0; i < 24; i++) {
        p = p.add(step);
        server.sendParticles(ParticleTypes.END_ROD, p.x, p.y, p.z, 1, 0, 0, 0, 0.0);
    }
}
```

## 7. Parcourir *tous* les blocs traversés (DDA)

`clip` ne renvoie que le **premier** bloc. Pour un « rayon perforant » qui affecte chaque bloc de la ligne :

```java
public static List<BlockPos> blocksAlong(Vec3 start, Vec3 end) {
    List<BlockPos> out = new ArrayList<>();
    int steps = (int) Math.ceil(start.distanceTo(end) * 2); // ~2 points par bloc
    for (int i = 0; i <= steps; i++) {
        Vec3 p = start.lerp(end, (double) i / steps);
        BlockPos bp = BlockPos.containing(p);
        if (out.isEmpty() || !out.get(out.size() - 1).equals(bp)) out.add(bp);
    }
    return out;
}
```

C'est une approximation (un pas trop grand « saute » un bloc en diagonale). Pour un tracé exact, implémentez l'algorithme **DDA voxel** (Amanatides & Woo) ; pour la plupart des mods, l'échantillonnage ci-dessus suffit.

## 8. Exemple complet : une baguette qui téléporte au point visé

Combine item + raycast + côté serveur (voir aussi [Un item avec un comportement](#/item-comportement)).

```java
public class BlinkWand extends Item {

    public BlinkWand(Properties props) {
        super(props.stacksTo(1).durability(64));
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);

        BlockHitResult hit = (BlockHitResult) player.pick(48.0D, 1.0F, false);
        if (hit.getType() != HitResult.Type.BLOCK) {
            return InteractionResultHolder.fail(stack);
        }

        if (!level.isClientSide()) {
            Vec3 dest = Vec3.atCenterOf(hit.getBlockPos().relative(hit.getDirection()));
            player.teleportTo(dest.x, hit.getBlockPos().getY() + 1, dest.z);
            level.playSound(null, player.blockPosition(),
                    SoundEvents.CHORUS_FRUIT_TELEPORT, SoundSource.PLAYERS, 1F, 1F);
            stack.hurtAndBreak(1, player, p -> p.broadcastBreakEvent(hand));
            player.getCooldowns().addCooldown(this, 20);
        }
        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide());
    }
}
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le rayon touche toujours le lanceur | mauvaise entité passée au `ClipContext`, ou pas de filtre `e != player` | passer `source`/`player` en 5ᵉ argument, filtrer les entités |
| Rien n'est touché côté serveur alors que ça marche à l'écran | vous lisez `Minecraft.getInstance().hitResult` dans du code serveur | relancer le rayon avec `Level#clip` / `ProjectileUtil` |
| Impact « à côté » à grande distance | *partial ticks* à `0` en plein mouvement | passer `getFrameTime()` côté client ; côté serveur c'est déjà stable |
| Les dalles/escaliers ne sont pas touchés correctement | `COLLIDER` au lieu de `OUTLINE` (ou l'inverse) | choisir selon l'usage (visée = `OUTLINE`) |
| Traînée de particules invisible pour les autres joueurs | `level.addParticle` (client only) | `ServerLevel#sendParticles` |

Page suivante : **[Un item avec un comportement](#/item-comportement)**.
