# Config, commandes & réseau

Trois briques transverses : la **configuration**, les **commandes**, et la **communication client ↔ serveur**.

## Configuration avec `ForgeConfigSpec`

Forge fournit un système de config TOML avec rechargement. Trois portées :

| Type | Fichier | Chargé où | Pour quoi |
|------|---------|-----------|-----------|
| `COMMON` | `run/config/monmod-common.toml` | client + serveur | valeurs qui ne changent pas le gameplay réseau |
| `CLIENT` | `run/config/monmod-client.toml` | client uniquement | affichage, sons, raccourcis |
| `SERVER` | `<monde>/serveurconfig/monmod-server.toml` | serveur ; **synchronisé** au client | équilibrage, règles de jeu — par monde |

`config/ModConfig.java` :

```java
package fr.monequipe.monmod.config;

import net.minecraftforge.common.ForgeConfigSpec;

public final class ModConfig {

    public static final ForgeConfigSpec COMMON_SPEC;
    public static final Common COMMON;

    static {
        var pair = new ForgeConfigSpec.Builder().configure(Common::new);
        COMMON_SPEC = pair.getRight();
        COMMON = pair.getLeft();
    }

    public static final class Common {
        public final ForgeConfigSpec.BooleanValue generateSapphireOre;
        public final ForgeConfigSpec.IntValue oreVeinSize;

        Common(ForgeConfigSpec.Builder b) {
            b.push("worldgen");
            generateSapphireOre = b
                    .comment("Générer le minerai de saphir dans le monde")
                    .define("generateSapphireOre", true);
            oreVeinSize = b
                    .comment("Taille des veines")
                    .defineInRange("oreVeinSize", 8, 1, 64);
            b.pop();
        }
    }

    private ModConfig() {}
}
```

Enregistrement dans le constructeur `@Mod` :

```java
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.config.ModConfig.Type;

ModLoadingContext.get().registerConfig(Type.COMMON, ModConfig.COMMON_SPEC);
```

Lecture (après le chargement de la config, donc pas dans le constructeur) :

```java
if (ModConfig.COMMON.generateSapphireOre.get()) {
    int size = ModConfig.COMMON.oreVeinSize.get();
    // ...
}
```

> :attention: N'appelez pas `.get()` trop tôt (constructeur, enregistrement). La config est prête à partir de `FMLCommonSetupEvent`. Pour réagir aux modifications en direct, écoutez `ModConfigEvent.Loading` / `ModConfigEvent.Reloading`.

## Commandes

Enregistrées sur le **Forge event bus** via `RegisterCommandsEvent` :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)
public final class ModCommands {

    @SubscribeEvent
    public static void onRegister(RegisterCommandsEvent event) {
        event.getDispatcher().register(
            Commands.literal("monmod")
                .requires(src -> src.hasPermission(2))          // opérateur
                .then(Commands.literal("hello")
                    .executes(ctx -> {
                        ctx.getSource().sendSuccess(
                            () -> Component.literal("Bonjour depuis Mon Mod !"), false);
                        return 1;
                    }))
                .then(Commands.literal("give_sapphire")
                    .then(Commands.argument("count", IntegerArgumentType.integer(1, 64))
                        .executes(ctx -> {
                            int count = IntegerArgumentType.getInteger(ctx, "count");
                            ServerPlayer player = ctx.getSource().getPlayerOrException();
                            player.getInventory().add(new ItemStack(ModItems.SAPPHIRE.get(), count));
                            return 1;
                        }))));
    }
}
```

Minecraft utilise **Brigadier** pour les commandes (le même moteur que `/give`, `/execute`…).

## Réseau client ↔ serveur

Pour tout échange custom (ouvrir un écran, synchroniser une donnée de bloc, déclencher une action serveur depuis un bouton), on utilise un **`SimpleChannel`**.

`network/ModNetwork.java` :

```java
package fr.monequipe.monmod.network;

import fr.monequipe.monmod.MonMod;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.network.NetworkRegistry;
import net.minecraftforge.network.simple.SimpleChannel;

public final class ModNetwork {

    private static final String PROTOCOL = "1";
    private static int id = 0;

    public static final SimpleChannel CHANNEL = NetworkRegistry.newSimpleChannel(
            new ResourceLocation(MonMod.MODID, "main"),
            () -> PROTOCOL, PROTOCOL::equals, PROTOCOL::equals);

    public static void register() {
        CHANNEL.registerMessage(id++, OpenGuiPacket.class,
                OpenGuiPacket::encode, OpenGuiPacket::decode, OpenGuiPacket::handle);
    }

    private ModNetwork() {}
}
```

Un paquet = 4 éléments : `encode`, `decode`, `handle`, et une classe porteuse de données.

```java
public record OpenGuiPacket(BlockPos pos) {

    public static void encode(OpenGuiPacket msg, FriendlyByteBuf buf) {
        buf.writeBlockPos(msg.pos);
    }

    public static OpenGuiPacket decode(FriendlyByteBuf buf) {
        return new OpenGuiPacket(buf.readBlockPos());
    }

    public static void handle(OpenGuiPacket msg, Supplier<NetworkEvent.Context> ctx) {
        ctx.get().enqueueWork(() -> {
            ServerPlayer sender = ctx.get().getSender();   // null si reçu côté client
            if (sender == null) return;
            // VALIDER : le joueur est-il assez proche ? a-t-il le droit ?
            if (sender.blockPosition().distSqr(msg.pos()) > 64) return;
            // ... ouvrir un menu, etc.
        });
        ctx.get().setPacketHandled(true);
    }
}
```

Appel depuis le client :

```java
ModNetwork.CHANNEL.sendToServer(new OpenGuiPacket(pos));
```

Appel depuis le serveur vers un joueur :

```java
ModNetwork.CHANNEL.send(PacketDistributor.PLAYER.with(() -> player), new SyncDataPacket(...));
```

`register()` s'appelle dans `FMLCommonSetupEvent` :

```java
modEventBus.addListener((FMLCommonSetupEvent e) -> e.enqueueWork(ModNetwork::register));
```

> :danger: **Sécurité réseau.** Un client malveillant peut envoyer n'importe quel paquet, avec n'importe quelles valeurs. Dans `handle`, côté serveur, **toujours** : vérifier `getSender() != null`, vérifier la distance / la propriété / les permissions, borner les valeurs. Ne faites jamais confiance aux données reçues.

## Capabilities (attacher des données)

Pour stocker une donnée sur une entité, un bloc ou un item sans modifier leur classe, Forge propose les **capabilities**. C'est un sujet à part entière ; retenez :

- On les utilise pour l'énergie (compat avec d'autres mods), des fluides, un inventaire custom sur un `BlockEntity`, des stats de joueur persistantes.
- Elles s'enregistrent via `RegisterCapabilitiesEvent`.
- Pour la persistance et la synchro, on combine capability + paquet réseau + `PlayerEvent.Clone` (respawn).

Voir la documentation officielle : [docs.minecraftforge.net — Capabilities](https://docs.minecraftforge.net/en/1.20.1/datastorage/capabilities/).

## Résumé des bonnes pratiques de cette page

- Config `SERVER` pour tout ce qui touche l'équilibrage ; elle est synchronisée et par-monde.
- Ne lisez la config qu'après `FMLCommonSetupEvent`.
- Commandes via Brigadier + `RegisterCommandsEvent`, avec `requires(...)` pour les permissions.
- Un seul `SimpleChannel` par mod suffit dans la plupart des cas.
- **Validez tout** ce qui arrive du client.

Page suivante : **[Capabilities (données attachées)](#/capabilities)**.
