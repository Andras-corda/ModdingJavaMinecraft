# Un item avec un comportement

Cette page montre, par l'exemple, les **points d'entrée** d'un `Item` : clic en l'air, clic sur un bloc, clic sur une entité, utilisation maintenue, attaque, minage. Plus les mécaniques associées : cooldown, durabilité, sons, infobulles.

Prérequis : [Blocs, items & onglets](#/blocs-items) pour l'enregistrement.

## Les méthodes à surcharger

| Méthode de `Item` | Déclenchée quand | Retour |
|-------------------|------------------|--------|
| `use(Level, Player, InteractionHand)` | clic droit **en l'air** (ou en dernier recours) | `InteractionResultHolder<ItemStack>` |
| `useOn(UseOnContext)` | clic droit **sur un bloc** | `InteractionResult` |
| `interactLivingEntity(ItemStack, Player, LivingEntity, InteractionHand)` | clic droit **sur une entité** | `InteractionResult` |
| `onUseTick(Level, LivingEntity, ItemStack, int)` | à chaque tick pendant l'utilisation maintenue | `void` |
| `finishUsingItem(ItemStack, Level, LivingEntity)` | fin de l'utilisation maintenue (comme boire une potion) | `ItemStack` |
| `hurtEnemy(ItemStack, LivingEntity victime, LivingEntity attaquant)` | l'item sert à frapper une entité | `boolean` |
| `mineBlock(ItemStack, Level, BlockState, BlockPos, LivingEntity)` | un bloc est cassé avec l'item | `boolean` |
| `appendHoverText(...)` | affichage de l'infobulle | `void` |

> :attention: **Ordre d'appel du clic droit :** `useOn` (si un bloc est visé) → puis `use` (sinon, ou si `useOn` renvoie `PASS`). Ne dupliquez pas la logique : décidez où elle vit.

## Valeurs de retour

`InteractionResult` / `InteractionResultHolder` communiquent au jeu ce qu'il doit faire ensuite (animation de main, propagation à l'autre main, etc.) :

- `SUCCESS` / `sidedSuccess(...)` : action réussie, joue l'animation de bras. **Le plus courant.**
- `CONSUME` : réussi, sans animation de swing.
- `PASS` : « je ne fais rien, laisse le jeu continuer » (permet à l'autre main / au bloc d'agir).
- `FAIL` : échec, bloque toute autre interaction.

Pour `use`, on emballe avec le `ItemStack` : `InteractionResultHolder.sidedSuccess(stack, level.isClientSide())`.

## Exemple 1 — clic en l'air : un « bâton de foudre »

```java
public class LightningStaff extends Item {

    public LightningStaff(Properties props) {
        super(props.stacksTo(1).durability(100).rarity(Rarity.RARE));
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);

        // Vise un bloc jusqu'à 32 blocs.
        BlockHitResult hit = (BlockHitResult) player.pick(32.0D, 1.0F, false);
        if (hit.getType() != HitResult.Type.BLOCK) {
            return InteractionResultHolder.pass(stack);
        }

        if (level instanceof ServerLevel server) {
            LightningBolt bolt = EntityType.LIGHTNING_BOLT.create(server);
            bolt.moveTo(Vec3.atBottomCenterOf(hit.getBlockPos().above()));
            bolt.setCause(player instanceof ServerPlayer sp ? sp : null);
            server.addFreshEntity(bolt);

            stack.hurtAndBreak(5, player, p -> p.broadcastBreakEvent(hand));
            player.getCooldowns().addCooldown(this, 40);         // 2 secondes
        }

        player.awardStat(Stats.ITEM_USED.get(this));
        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide());
    }

    @Override
    public void appendHoverText(ItemStack stack, @Nullable Level level, List<Component> tip, TooltipFlag flag) {
        tip.add(Component.translatable("item.monmod.lightning_staff.desc").withStyle(ChatFormatting.GRAY));
    }

    @Override
    public boolean isFoil(ItemStack stack) {
        return true;   // effet enchanté visuel
    }
}
```

À prévoir : les traductions `item.monmod.lightning_staff` et `item.monmod.lightning_staff.desc` (voir [Ressources](#/ressources-assets)).

## Exemple 2 — clic sur un bloc : un « marqueur » de position

```java
@Override
public InteractionResult useOn(UseOnContext ctx) {
    Level level = ctx.getLevel();
    BlockPos pos = ctx.getClickedFace() == Direction.UP
            ? ctx.getClickedPos().above()
            : ctx.getClickedPos().relative(ctx.getClickedFace());

    if (!level.isClientSide()) {
        Player player = ctx.getPlayer();
        CompoundTag tag = ctx.getItemInHand().getOrCreateTag();
        tag.putLong("MarkedPos", pos.asLong());
        if (player != null) {
            player.displayClientMessage(
                Component.translatable("item.monmod.marker.set", pos.toShortString()), true);
        }
    }
    return InteractionResult.sidedSuccess(level.isClientSide());
}
```

`UseOnContext` donne : `getLevel()`, `getPlayer()` (peut être `null`), `getHand()`, `getClickedPos()`, `getClickedFace()`, `getClickLocation()`, `getItemInHand()`.

## Exemple 3 — clic sur une entité : un « collier » qui renomme

```java
@Override
public InteractionResult interactLivingEntity(ItemStack stack, Player player,
                                              LivingEntity target, InteractionHand hand) {
    if (!(target instanceof Animal animal)) return InteractionResult.PASS;

    if (!player.level().isClientSide()) {
        animal.setCustomName(Component.literal("Rex"));
        animal.setPersistenceRequired();               // ne despawn plus
        stack.shrink(1);
    }
    return InteractionResult.sidedSuccess(player.level().isClientSide());
}
```

## Exemple 4 — utilisation maintenue : une « longue-vue » de raycast

```java
public class Spyglass2 extends Item {

    public Spyglass2(Properties props) { super(props.stacksTo(1)); }

    @Override
    public UseAnim getUseAnimation(ItemStack stack) { return UseAnim.SPYGLASS; }

    @Override
    public int getUseDuration(ItemStack stack) { return 1200; }   // jusqu'à 60 s

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        player.startUsingItem(hand);
        return InteractionResultHolder.consume(player.getItemInHand(hand));
    }

    @Override
    public void onUseTick(Level level, LivingEntity entity, ItemStack stack, int remaining) {
        if (level.isClientSide() || !(entity instanceof Player player)) return;
        if ((getUseDuration(stack) - remaining) % 20 != 0) return;  // 1 fois/seconde

        HitResult hit = ProjectileUtil.getHitResultOnViewVector(player, e -> true, 128.0D);
        if (hit.getType() == HitResult.Type.ENTITY) {
            Entity t = ((EntityHitResult) hit).getEntity();
            player.displayClientMessage(Component.literal("Cible : " + t.getName().getString()), true);
        }
    }
}
```

## Mécaniques associées

### Cooldown

```java
player.getCooldowns().addCooldown(this, 40);            // ticks (40 = 2 s)
if (player.getCooldowns().isOnCooldown(this)) return InteractionResultHolder.fail(stack);
```

Le cooldown est **par item** et affiché automatiquement (balayage gris sur l'icône).

### Durabilité

```java
// À l'enregistrement :
ITEMS.register("blink_wand", () -> new BlinkWand(new Item.Properties().durability(64)));

// À l'usage :
stack.hurtAndBreak(1, player, p -> p.broadcastBreakEvent(hand));
```

`durability(n)` et `stacksTo(n)` sont **exclusifs** : un item avec durabilité a forcément `stacksTo(1)`.

### Sons

```java
level.playSound(
    null,                     // null = tous les joueurs proches l'entendent
    player.getX(), player.getY(), player.getZ(),
    SoundEvents.EXPERIENCE_ORB_PICKUP,
    SoundSource.PLAYERS,
    1.0F,                     // volume
    1.0F);                    // pitch (0.5 à 2.0)
```

Passer le **joueur** en 1ᵉʳ argument à la place de `null` : le son n'est **pas** renvoyé à ce joueur (évite le double-son quand le client le joue déjà lui-même).

### Données persistantes sur l'item (NBT)

```java
CompoundTag tag = stack.getOrCreateTag();
tag.putInt("Charges", 3);
int charges = stack.getOrCreateTag().getInt("Charges");
```

> :astuce: Pour des données structurées ou partagées avec d'autres systèmes, préférez une **capability** d'item (voir [Config & réseau](#/config-reseau)) au NBT brut.

### Enchantabilité

```java
new Item.Properties()
    .durability(250)
    .rarity(Rarity.UNCOMMON);
// et surcharger :
@Override public int getEnchantmentValue() { return 15; }             // comme le fer
@Override public boolean isEnchantable(ItemStack s) { return s.getCount() == 1; }
```

## Côté client vs serveur — le réflexe

Toute méthode d'item est appelée **des deux côtés**. Schéma type :

```java
@Override
public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
    ItemStack stack = player.getItemInHand(hand);

    // 1. Validation commune (peut lire l'état du monde des deux côtés)
    if (player.getCooldowns().isOnCooldown(this)) {
        return InteractionResultHolder.fail(stack);
    }

    // 2. Effets de gameplay : SERVEUR uniquement
    if (!level.isClientSide()) {
        doServerEffect(level, player, stack);
    }

    // 3. Retour "sided" : anime la main des deux côtés
    return InteractionResultHolder.sidedSuccess(stack, level.isClientSide());
}
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| L'effet se produit deux fois | logique hors du `if (!level.isClientSide())` | isoler les effets côté serveur |
| L'animation de bras ne se joue pas | retour `CONSUME` ou `PASS` | renvoyer `SUCCESS` / `sidedSuccess` |
| `useOn` ignoré, seul `use` s'exécute | `useOn` renvoie `PASS` | renvoyer un `InteractionResult` non-`PASS` |
| Durabilité qui ne descend pas | `hurtAndBreak` appelé côté client | l'appeler côté serveur |
| Item empilable **et** avec durabilité : crash / bizarreries | `stacksTo` > 1 avec `durability` | garder `stacksTo(1)` |

Page suivante : **[Un bloc avec inventaire et interface](#/block-entity)**.
