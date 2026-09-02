# Capabilities (données attachées)

Une **capability** attache des données et un comportement à un objet du jeu (entité, block entity, item, niveau, chunk) **sans** modifier sa classe. C'est le mécanisme standard pour : une barre de mana sur le joueur, un stockage d'énergie compatible avec les autres mods, un inventaire sur un block entity.

Prérequis : [NBT & Codecs](#/nbt-codecs), [Le système d'événements](#/evenements), [Config & réseau](#/config-reseau).

> :info: Les capabilities sont **verbeuses**. En 1.20.1 c'est l'API en place ; les versions suivantes la remplacent par un système d'*attachments* plus léger. Le principe (données + persistance + synchro) reste le même.

## Exemple fil rouge : le mana du joueur

### 1. L'interface + l'implémentation

```java
public interface IManaStore {
    int getMana();
    int getMaxMana();
    void setMana(int value);
    default void addMana(int delta) { setMana(getMana() + delta); }
    void copyFrom(IManaStore other);
}

public class ManaStore implements IManaStore, INBTSerializable<CompoundTag> {
    private int mana = 20;
    private int maxMana = 100;

    @Override public int getMana() { return mana; }
    @Override public int getMaxMana() { return maxMana; }
    @Override public void setMana(int v) { this.mana = Mth.clamp(v, 0, maxMana); }
    @Override public void copyFrom(IManaStore o) { this.mana = o.getMana(); this.maxMana = o.getMaxMana(); }

    @Override public CompoundTag serializeNBT() {
        CompoundTag t = new CompoundTag();
        t.putInt("Mana", mana);
        t.putInt("MaxMana", maxMana);
        return t;
    }
    @Override public void deserializeNBT(CompoundTag t) {
        this.maxMana = t.getInt("MaxMana");
        this.mana = t.getInt("Mana");
    }
}
```

### 2. Le token de capability

```java
public final class ModCapabilities {
    public static final Capability<IManaStore> MANA =
            CapabilityManager.get(new CapabilityToken<>() {});
    private ModCapabilities() {}
}
```

### 3. Enregistrer la capability

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD)
public class CapabilityRegistration {
    @SubscribeEvent
    public static void register(RegisterCapabilitiesEvent event) {
        event.register(IManaStore.class);
    }
}
```

### 4. Le provider

Il porte l'instance + gère la (dé)sérialisation NBT + le `LazyOptional` :

```java
public class ManaProvider implements ICapabilitySerializable<CompoundTag> {

    private final ManaStore store = new ManaStore();
    private final LazyOptional<IManaStore> opt = LazyOptional.of(() -> store);

    @Override
    public <T> LazyOptional<T> getCapability(Capability<T> cap, Direction side) {
        return cap == ModCapabilities.MANA ? opt.cast() : LazyOptional.empty();
    }

    @Override public CompoundTag serializeNBT()               { return store.serializeNBT(); }
    @Override public void deserializeNBT(CompoundTag tag)     { store.deserializeNBT(tag); }

    public void invalidate() { opt.invalidate(); }
}
```

### 5. Attacher le provider au joueur

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)
public class CapabilityAttach {

    private static final ResourceLocation ID = new ResourceLocation(MonMod.MODID, "mana");

    @SubscribeEvent
    public static void attach(AttachCapabilitiesEvent<Entity> event) {
        if (event.getObject() instanceof Player) {
            ManaProvider provider = new ManaProvider();
            event.addCapability(ID, provider);
            event.addListener(provider::invalidate);       // libère le LazyOptional à la mort de l'entité
        }
    }
}
```

`AttachCapabilitiesEvent<T>` existe pour `Entity`, `BlockEntity`, `ItemStack`, `Level`, `LevelChunk`.

### 6. Persister à travers la mort et le changement de dimension

Au respawn, le joueur est **recréé** : ses capabilities repartent à zéro. On les recopie :

```java
@SubscribeEvent
public static void onClone(PlayerEvent.Clone event) {
    if (!event.isWasDeath()) return;                        // aussi vrai pour un simple retour du End
    event.getOriginal().reviveCaps();                       // rend les caps de l'ancien joueur lisibles
    event.getOriginal().getCapability(ModCapabilities.MANA).ifPresent(oldMana ->
        event.getEntity().getCapability(ModCapabilities.MANA).ifPresent(newMana ->
            newMana.copyFrom(oldMana)));
    event.getOriginal().invalidateCaps();
}
```

### 7. Synchroniser vers le client

Le client a besoin du mana pour l'afficher (HUD). On envoie un paquet à chaque moment clé **et** à chaque changement.

```java
public record SyncManaPacket(int mana, int maxMana) {
    public static void encode(SyncManaPacket m, FriendlyByteBuf b) { b.writeInt(m.mana); b.writeInt(m.maxMana); }
    public static SyncManaPacket decode(FriendlyByteBuf b) { return new SyncManaPacket(b.readInt(), b.readInt()); }
    public static void handle(SyncManaPacket m, Supplier<NetworkEvent.Context> ctx) {
        ctx.get().enqueueWork(() ->                          // exécuté CÔTÉ CLIENT
            ClientManaCache.set(m.mana(), m.maxMana()));
        ctx.get().setPacketHandled(true);
    }
}

// utilitaire serveur
public static void syncTo(ServerPlayer player) {
    player.getCapability(ModCapabilities.MANA).ifPresent(mana ->
        ModNetwork.CHANNEL.send(PacketDistributor.PLAYER.with(() -> player),
            new SyncManaPacket(mana.getMana(), mana.getMaxMana())));
}

@SubscribeEvent public static void onLogin(PlayerEvent.PlayerLoggedInEvent e) { sync(e); }
@SubscribeEvent public static void onRespawn(PlayerEvent.PlayerRespawnEvent e) { sync(e); }
@SubscribeEvent public static void onDimChange(PlayerEvent.PlayerChangedDimensionEvent e) { sync(e); }
private static void sync(PlayerEvent e) {
    if (e.getEntity() instanceof ServerPlayer sp) syncTo(sp);
}
```

### 8. Utiliser le mana

```java
// Serveur : dépenser du mana pour lancer un sort
player.getCapability(ModCapabilities.MANA).ifPresent(mana -> {
    if (mana.getMana() >= 15) {
        mana.addMana(-15);
        castSpell(player);
        syncTo((ServerPlayer) player);          // resynchroniser
    } else {
        player.displayClientMessage(Component.translatable("monmod.no_mana"), true);
    }
});

// Régénération : dans PlayerTickEvent (END, serveur), tous les 20 ticks
```

## Capability sur un block entity (inventaire, énergie)

Plus simple : pas de `AttachCapabilitiesEvent`, on surcharge directement `getCapability` du block entity (voir [Un bloc avec inventaire](#/block-entity)) :

```java
private final LazyOptional<IItemHandler> items = LazyOptional.of(() -> itemHandler);
private final LazyOptional<IEnergyStorage> energy = LazyOptional.of(() -> energyStorage);

@Override
public <T> LazyOptional<T> getCapability(Capability<T> cap, Direction side) {
    if (cap == ForgeCapabilities.ITEM_HANDLER) return items.cast();
    if (cap == ForgeCapabilities.ENERGY) return energy.cast();
    return super.getCapability(cap, side);
}

@Override public void invalidateCaps() { super.invalidateCaps(); items.invalidate(); energy.invalidate(); }
```

**`ForgeCapabilities`** fournit les capabilities standard **inter-mods** : `ITEM_HANDLER`, `FLUID_HANDLER`, `ENERGY`. Les exposer rend votre machine compatible avec les tuyaux/câbles de tous les mods tech (voir [Compatibilité](#/compatibilite)).

## Le cycle de vie de `LazyOptional`

- `LazyOptional.of(() -> valeur)` : créé une fois, la valeur est calculée à la première résolution.
- `.ifPresent(consumer)` / `.map(...)` / `.orElse(defaut)` / `.resolve()` (Optional).
- `.invalidate()` : à appeler quand le porteur disparaît (entité qui meurt, block entity retiré). Après ça, tout code qui gardait ce `LazyOptional` reçoit « vide » via `addListener`.
- Ne **stockez pas** le résultat de `.resolve()` sur le long terme ; gardez le `LazyOptional` et résolvez à l'usage.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le mana repart à zéro à chaque mort | pas de `PlayerEvent.Clone` | recopier depuis `getOriginal()` |
| `getCapability(...)` toujours vide | `AttachCapabilitiesEvent` pas abonné, ou mauvais type générique | vérifier le bus (FORGE), le `instanceof` |
| HUD figé / faux | pas de resynchro après changement | `syncTo` sur login, respawn, dim-change, et à chaque modif |
| Fuite mémoire / `LazyOptional` jamais libéré | `invalidate()` oublié | `event.addListener(provider::invalidate)` + `invalidateCaps` |
| Données perdues au rechargement du chunk (block entity) | `setChanged()` oublié | appeler `setChanged()` après modif |
| Crash `IllegalStateException: Cannot get from an unresolved cap` post-mort | accès à un cap invalidé | re-`getCapability` à chaque usage |

Page suivante : **[Commandes avancées (Brigadier)](#/commandes-avancees)**.
