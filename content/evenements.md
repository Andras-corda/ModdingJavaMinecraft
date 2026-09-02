# Le système d'événements (catalogue)

Forge fonctionne par **événements** : le jeu émet un signal, vos méthodes s'y abonnent. Cette page explique le mécanisme puis liste les événements les plus utiles.

Rappel de [Prérequis](#/prerequis) : il existe **deux bus**.

- **Mod event bus** — cycle de vie, enregistrements, initialisation (une fois au démarrage).
- **Forge event bus** (`MinecraftForge.EVENT_BUS`) — événements de jeu (en boucle).

## S'abonner : les trois façons

### 1. Classe statique annotée (recommandé pour la plupart des cas)

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)                 // bus FORGE par défaut
public final class GameHandlers {

    @SubscribeEvent
    public static void onBlockBreak(BlockEvent.BreakEvent event) {
        // ...
    }
}
```

Pour le **mod bus** : `@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD)`.
Pour du **client uniquement** : ajoutez `value = Dist.CLIENT`.

### 2. Lambda dans le constructeur `@Mod` (mod bus surtout)

```java
public MonMod() {
    IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();
    modBus.addListener(this::commonSetup);
    modBus.addListener(this::onRegisterPayloads);
}
```

### 3. Instance enregistrée manuellement

```java
MinecraftForge.EVENT_BUS.register(new MyGameHandler());   // méthodes NON statiques + @SubscribeEvent
```

## Contrôler un événement

### Priorité

```java
@SubscribeEvent(priority = EventPriority.HIGH)   // HIGHEST > HIGH > NORMAL > LOW > LOWEST
public static void early(LivingHurtEvent event) { }
```

### Annulation

Les événements marqués `@Cancelable` peuvent être stoppés :

```java
@SubscribeEvent
public static void onRightClick(PlayerInteractEvent.RightClickBlock event) {
    if (interdit(event.getPos())) {
        event.setCanceled(true);          // le clic n'a plus d'effet
    }
}
```

Pour aussi recevoir les événements déjà annulés par un autre mod :

```java
@SubscribeEvent(receiveCanceled = true)
```

### Résultat (ALLOW / DEFAULT / DENY)

Certains événements portent un `Result` à trois états (forcer, laisser vanilla décider, interdire) :

```java
@SubscribeEvent
public static void onMobSpawn(MobSpawnEvent.FinalizeSpawn event) {
    if (event.getEntity() instanceof Zombie && tropDeZombies()) {
        event.setSpawnCancelled(true);
    }
}
```

## Catalogue — Mod event bus

| Événement | Quand | Usage typique |
|-----------|-------|---------------|
| `FMLCommonSetupEvent` | init commune | réseau, compat, `ComposterBlock.COMPOSTABLES` |
| `FMLClientSetupEvent` | init client | `ItemProperties.register`, prédicats de modèle |
| `FMLDedicatedServerSetupEvent` | init serveur dédié | rare |
| `RegisterEvent` | enregistrement bas niveau | tout registre sans `DeferredRegister` |
| `RegisterCapabilitiesEvent` | — | déclarer ses capabilities |
| `EntityAttributeCreationEvent` | — | attributs des entités custom |
| `EntityAttributeModificationEvent` | — | ajouter un attribut à une entité vanilla |
| `SpawnPlacementRegisterEvent` | — | règles de spawn naturel |
| `RegisterSpawnPlacementsEvent` | — | (alias plus récent) |
| `BuildCreativeModeTabContentsEvent` | — | ajouter des items à un onglet |
| `GatherDataEvent` | `runData` | providers de datagen |
| `ModConfigEvent.Loading` / `.Reloading` | config lue/rechargée | recalculer des caches de config |
| `RegisterKeyMappingsEvent` | client | raccourcis clavier |
| `EntityRenderersEvent.RegisterRenderers` | client | renderers d'entités / block entities |
| `EntityRenderersEvent.RegisterLayerDefinitions` | client | maillages de modèles |
| `RegisterGuiOverlaysEvent` | client | overlays HUD |
| `RegisterMenuScreensEvent` | client | associer `Menu` → `Screen` |
| `RegisterColorHandlersEvent.Block` / `.Item` | client | teintes (feuillages, potions) |
| `RegisterParticleProvidersEvent` | client | providers de particules |
| `ModelEvent.RegisterAdditional` / `.ModifyBakingResult` | client | modèles custom |
| `AddPackFindersEvent` | — | packs de ressources/données intégrés |

## Catalogue — Forge event bus (jeu)

### Joueur

| Événement | Quand |
|-----------|-------|
| `PlayerEvent.PlayerLoggedInEvent` / `PlayerLoggedOutEvent` | connexion / déconnexion |
| `PlayerEvent.PlayerRespawnEvent` | réapparition |
| `PlayerEvent.Clone` | **copie des données au respawn / changement de dimension** |
| `PlayerEvent.PlayerChangedDimensionEvent` | changement de dimension |
| `PlayerEvent.ItemPickupEvent` / `ItemCraftedEvent` / `ItemSmeltedEvent` | ramassage / craft / cuisson |
| `PlayerEvent.BreakSpeed` | vitesse de minage (buff/debuff) |
| `PlayerEvent.HarvestCheck` | l'outil peut-il récolter ce bloc |
| `PlayerInteractEvent.RightClickBlock` / `RightClickItem` / `LeftClickBlock` | interactions |
| `PlayerInteractEvent.EntityInteract` / `EntityInteractSpecific` | clic droit sur une entité |
| `AttackEntityEvent` | le joueur frappe une entité (annulable) |
| `CriticalHitEvent` | coup critique |
| `PlayerXpEvent.PickupXp` / `LevelChange` / `XpChange` | expérience |
| `AnvilRepairEvent` / `AnvilUpdateEvent` | enclume |
| `ItemTooltipEvent` | modifier une infobulle |
| `TickEvent.PlayerTickEvent` | à chaque tick du joueur (phase START/END) |
| `ItemAttributeModifierEvent` | modifier les attributs conférés par un item |

### Entités vivantes

| Événement | Quand |
|-----------|-------|
| `LivingAttackEvent` | avant le calcul des dégâts (annulable = invincible) |
| `LivingHurtEvent` | dégâts calculés, avant application (modifier le montant) |
| `LivingDamageEvent` | dégâts après armure/enchantements, juste avant la santé |
| `LivingDeathEvent` | mort (annulable = « seconde chance ») |
| `LivingDropsEvent` / `LivingExperienceDropEvent` | butin / xp d'un mob |
| `LivingFallEvent` | dégâts de chute |
| `LivingHealEvent` | soin |
| `LivingEquipmentChangeEvent` | changement d'équipement |
| `LivingChangeTargetEvent` | un mob change de cible |
| `MobSpawnEvent.FinalizeSpawn` | finalisation d'un spawn (annulable, modifiable) |
| `LivingConversionEvent` | zombie → noyé, cochon → zombifié… |
| `LivingKnockBackEvent` | recul |
| `LivingGetProjectileEvent` | quelle munition tirer |

### Entités (toutes)

| Événement | Quand |
|-----------|-------|
| `EntityJoinLevelEvent` / `EntityLeaveLevelEvent` | ajout / retrait du monde |
| `EntityTravelToDimensionEvent` | téléportation inter-dimension |
| `EntityStruckByLightningEvent` | frappe de foudre |
| `EntityMobGriefingEvent` | vandalisme (creeper, enderman…) autorisé ? |
| `ProjectileImpactEvent` | impact d'un projectile (annulable) |
| `EntityTeleportEvent` | téléportation (perle, chorus, commande) |

### Blocs & monde

| Événement | Quand |
|-----------|-------|
| `BlockEvent.BreakEvent` | un joueur casse un bloc (annulable) |
| `BlockEvent.EntityPlaceEvent` | pose d'un bloc |
| `BlockEvent.NeighborNotifyEvent` | mise à jour de redstone/voisins |
| `BlockEvent.CropGrowEvent.Pre` / `.Post` | croissance d'une culture |
| `BlockEvent.FarmlandTrampleEvent` | piétinement de terre labourée |
| `BlockEvent.BlockToolModificationEvent` | hache→écorce, pelle→chemin |
| `LevelEvent.Load` / `.Save` / `.Unload` | chargement de niveau |
| `LevelEvent.CreateSpawnPosition` | choix du point de spawn du monde |
| `ChunkEvent.Load` / `.Unload` | chunks |
| `ChunkWatchEvent.Watch` / `.UnWatch` | un joueur commence/arrête de suivre un chunk (sync) |
| `ExplosionEvent.Start` / `.Detonate` | explosions |
| `SleepingTimeCheckEvent` / `SleepFinishedTimeEvent` | sommeil |
| `NoteBlockEvent.Play` | note d'un block de note |

### Serveur & cycle

| Événement | Quand |
|-----------|-------|
| `ServerAboutToStartEvent` / `ServerStartingEvent` / `ServerStartedEvent` | démarrage |
| `ServerStoppingEvent` / `ServerStoppedEvent` | arrêt (sauvegarder ici) |
| `RegisterCommandsEvent` | enregistrer des commandes |
| `AddReloadListenerEvent` | ajouter un listener de `/reload` |
| `TagsUpdatedEvent` | les tags sont (re)chargés |
| `TickEvent.ServerTickEvent` / `LevelTickEvent` | tick serveur / par-niveau |

### Client & rendu

| Événement | Quand |
|-----------|-------|
| `TickEvent.ClientTickEvent` / `RenderTickEvent` | tick / frame client |
| `RenderLevelStageEvent` | rendu dans le monde (par étape) |
| `RenderGuiOverlayEvent.Pre` / `.Post` | surcharger un overlay vanilla |
| `RenderPlayerEvent` / `RenderLivingEvent` | rendu d'entités |
| `RenderHandEvent` | main en première personne |
| `ScreenEvent.Init` / `.Render` / `.MouseButtonPressed` | modifier un écran (menus vanilla) |
| `InputEvent.Key` / `.MouseButton` / `.InteractionKeyMappingTriggered` | entrées |
| `ClientPlayerNetworkEvent.LoggingIn` / `.LoggingOut` | connexion client |
| `RecipesUpdatedEvent` | recettes synchronisées |
| `ClientChatEvent` / `ClientChatReceivedEvent` | chat |
| `ComputeFovModifierEvent` / `ViewportEvent.ComputeCameraAngles` | FOV / caméra |
| `RenderTooltipEvent.Pre` / `.Color` / `.GatherComponents` | infobulles |

### Butin & marchands

| Événement | Quand |
|-----------|-------|
| `LootTableLoadEvent` | modifier une table de butin au chargement (alternative aux [Global Loot Modifiers](#/loot-modifiers)) |
| `VillagerTradesEvent` | offres des villageois par métier |
| `WandererTradesEvent` | offres du marchand ambulant |
| `BabyEntitySpawnEvent` | naissance |

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| La méthode n'est jamais appelée | mauvais bus (mod vs forge) | vérifier `bus = Bus.MOD` / défaut |
| `@EventBusSubscriber` ignoré | méthode non `static`, ou `modid` absent | méthodes `static`, préciser `modid` |
| `NoClassDefFoundError` serveur | handler client sur le bus commun | `value = Dist.CLIENT` |
| L'événement se produit « deux fois » | pas de filtre de phase | `if (event.phase != TickEvent.Phase.END) return;` |
| Modification ignorée | événement pas annulable, ou trop tard dans la chaîne | choisir le bon événement (`LivingHurt` vs `LivingDamage`), régler la priorité |

Page suivante : **[Registres & tags en profondeur](#/registres-tags)**.
