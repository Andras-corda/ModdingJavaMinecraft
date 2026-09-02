# La classe principale du mod

Point d'entrée du mod : la classe annotée **`@Mod`**. Forge l'instancie au chargement.

## Squelette recommandé (Forge 1.20.1)

```java
package fr.monequipe.monmod;

import com.mojang.logging.LogUtils;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.slf4j.Logger;

@Mod(MonMod.MODID)
public class MonMod {

    /** Identifiant du mod. DOIT être identique à mod_id / mods.toml. */
    public static final String MODID = "monmod";

    /** Logger partagé du mod. */
    public static final Logger LOGGER = LogUtils.getLogger();

    public MonMod() {
        IEventBus modEventBus = FMLJavaModLoadingContext.get().getModEventBus();

        // 1. Enregistrements (blocs, items, onglets...) — voir page suivante.
        ModItems.register(modEventBus);
        ModBlocks.register(modEventBus);
        ModCreativeTabs.register(modEventBus);

        // 2. Étapes du cycle de vie sur le MOD event bus.
        modEventBus.addListener(this::commonSetup);

        // 3. Abonnement de cette instance au FORGE event bus (événements de jeu).
        MinecraftForge.EVENT_BUS.register(this);

        // 4. Configuration (voir page Config & réseau).
        // ModConfig.register();
    }

    private void commonSetup(final FMLCommonSetupEvent event) {
        // Initialisations communes client + serveur.
        // Attention : exécuté en parallèle des autres mods.
        // Le code qui touche aux registres doit être dans event.enqueueWork(...).
        event.enqueueWork(() -> {
            // ex. enregistrement de paquets réseau, compat...
        });
        LOGGER.info("Mon Mod : setup commun terminé");
    }
}
```

> :attention: **Signature du constructeur en 1.20.1.** On utilise `FMLJavaModLoadingContext.get().getModEventBus()`. Le constructeur avec paramètres injectés (`public MonMod(FMLJavaModLoadingContext context)`) n'est arrivé qu'à partir de 1.20.4 / 1.21 — ne le copiez pas depuis un tutoriel plus récent.

## Le `MODID` : une seule source de vérité

- Déclarez-le **une fois**, en `public static final String`.
- Réutilisez-le partout : `DeferredRegister.create(..., MonMod.MODID)`, `new ResourceLocation(MonMod.MODID, "xxx")`, `@Mod.EventBusSubscriber(modid = MonMod.MODID)`.
- Il doit être **égal** à `mod_id` (`gradle.properties`) et à `modId` (`mods.toml`).

## Choisir le bon bus d'événements

Rappel de [Prérequis](#/prerequis) : deux bus.

### Mod event bus — cycle de vie

```java
// Option A : lambda dans le constructeur
modEventBus.addListener(this::commonSetup);
modEventBus.addListener(this::clientSetup);

// Option B : classe dédiée avec annotation
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
public class ModEvents {
    @SubscribeEvent
    public static void onCommonSetup(FMLCommonSetupEvent event) { /* ... */ }
}
```

Événements fréquents du mod event bus :

| Événement | Usage |
|-----------|-------|
| `FMLCommonSetupEvent` | init commune (réseau, compat) |
| `FMLClientSetupEvent` | init client (rendus, key mappings) — **jamais** de logique serveur ici |
| `RegisterEvent` / événements des `DeferredRegister` | enregistrer des contenus |
| `BuildCreativeModeTabContentsEvent` | ajouter des items à un onglet existant |
| `GatherDataEvent` | datagen |
| `EntityAttributeCreationEvent` | attributs des entités custom |

### Forge event bus — jeu

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)   // bus = FORGE par défaut
public class GameEvents {

    @SubscribeEvent
    public static void onRightClickBlock(PlayerInteractEvent.RightClickBlock event) {
        if (event.getLevel().isClientSide()) return;   // serveur uniquement
        // ...
    }

    @SubscribeEvent
    public static void onLivingDeath(LivingDeathEvent event) {
        // ...
    }
}
```

> :astuce: `@Mod.EventBusSubscriber` s'abonne **automatiquement** au chargement. Pas besoin d'appeler `register(...)`. Précisez `value = Dist.CLIENT` pour une classe d'événements strictement client.

## Isoler le code client

Ne référencez **jamais** `net.minecraft.client.*` depuis une classe chargée côté serveur. Deux techniques :

### 1. `@Mod.EventBusSubscriber(value = Dist.CLIENT)`

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ClientSetup {
    @SubscribeEvent
    public static void onClientSetup(FMLClientSetupEvent event) {
        // Rendus, écrans, raccourcis clavier...
    }
}
```

### 2. `DistExecutor` pour un appel ponctuel

```java
DistExecutor.unsafeRunWhenOn(Dist.CLIENT, () -> ClientOnlyStuff::doClientThing);
```

Placez tout votre code de rendu dans un paquet `client/` à part, appelé uniquement depuis des points d'entrée client.

## Le logger

Utilisez **SLF4J** via `LogUtils.getLogger()` (fourni par Forge). N'utilisez pas `System.out.println`.

```java
MonMod.LOGGER.info("Chargé {} minerais custom", count);
MonMod.LOGGER.warn("Config invalide, valeur par défaut appliquée");
MonMod.LOGGER.error("Échec du chargement de la structure", exception);
MonMod.LOGGER.debug("Détail visible seulement en niveau debug");
```

Le niveau `debug` s'active avec `-Dforge.logging.console.level=debug` (déjà présent dans les runs du MDK).

## Ordre d'exécution au démarrage (simplifié)

1. Construction : Forge appelle le **constructeur** `@Mod` de chaque mod.
2. Les `DeferredRegister` déclenchent leurs événements d'enregistrement (blocs, puis items, etc.).
3. `FMLCommonSetupEvent` (parallèle entre mods) → utilisez `event.enqueueWork()` pour le code sensible à l'ordre.
4. `FMLClientSetupEvent` / `FMLDedicatedServerSetupEvent` selon le côté.
5. `InterModComms` (communication entre mods), puis chargement du monde.

> :attention: Ne lisez pas un `RegistryObject` (`.get()`) dans le constructeur ni pendant l'enregistrement : l'objet n'existe pas encore. Attendez au moins `FMLCommonSetupEvent`, ou mieux, ne le lisez qu'à l'usage en jeu.

Page suivante : **[Le système d'événements (catalogue)](#/evenements)**.
