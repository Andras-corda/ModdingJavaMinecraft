# Performance & profilage

Un mod lent ruine l'expérience d'un serveur entier. Cette page : **mesurer** d'abord, puis les pièges classiques et leurs parades.

## Le budget

Le serveur vise **20 ticks/seconde**, soit **50 ms par tick** pour *tout* : mobs, blocs, redstone, monde, **et tous les mods**. Dès qu'un tick dépasse 50 ms, le TPS chute et le jeu ralentit pour tout le monde.

Côté client, viser 60 FPS = **16 ms par frame** pour le rendu.

## Mesurer avant d'optimiser

### spark

Le profileur de référence pour Minecraft. Installez le mod **spark** en dev.

```text
/spark profiler --timeout 60      # profile 60 s, puis donne un lien web
/spark tps                        # TPS + MSPT (ms par tick) récents
/spark healthreport               # RAM, GC, threads
```

Le rapport web montre l'arbre d'appels avec le **temps passé par méthode** : cherchez vos paquets (`fr.monequipe.monmod`).

### Autres

- `/forge tps` : MSPT par dimension.
- `-XX:+FlightRecorder` + JFR pour un profil JVM complet.
- `/debug start` … `/debug stop` : profil vanilla léger.
- Le graphe `F3` (client) : pics de frame time.

## Pièges serveur (les plus fréquents)

### 1. Travailler à chaque tick sans nécessité

```java
// MAUVAIS : recherche coûteuse 20×/s
public static void serverTick(Level l, BlockPos pos, BlockState s, MyBE be) {
    List<Player> nearby = l.getEntitiesOfClass(Player.class, new AABB(pos).inflate(32));
    // ...
}

// MIEUX : espacer, et réduire le rayon
public static void serverTick(Level l, BlockPos pos, BlockState s, MyBE be) {
    if ((l.getGameTime() + be.tickOffset) % 20 != 0) return;   // 1×/s, décalé par bloc
    Player p = l.getNearestPlayer(pos.getX(), pos.getY(), pos.getZ(), 8, false);
    if (p == null) return;
    // ...
}
```

Encore mieux : **piloter par événement** (`PlayerInteractEvent`, `EntityJoinLevelEvent`) plutôt que par sondage.

### 2. `getBlockEntity` / `getBlockState` en boucle serrée

Chaque appel traverse le chunk. Dans une boucle ou un tick, **mettez en cache** :

```java
// au lieu de rappeler level.getBlockEntity(pos) 100×
if (this.cachedNeighbor == null || this.cachedNeighbor.isRemoved()) {
    this.cachedNeighbor = level.getBlockEntity(pos.above());
}
```

### 3. Allocations dans le chemin de tick

`new Vec3(...)`, `new BlockPos(...)`, `new AABB(...)`, lambdas, streams — chaque tick, chaque entité : le GC s'emballe.

```java
// MAUVAIS
for (BlockPos p : BlockPos.betweenClosed(a, b)) {   // alloue un BlockPos par itération... 
    // en fait betweenClosed réutilise un MutableBlockPos en interne : OK ici
}

// MAUVAIS : stream dans un tick
long count = level.getEntitiesOfClass(Zombie.class, box).stream().filter(...).count();

// MIEUX : boucle for classique + MutableBlockPos réutilisé
BlockPos.MutableBlockPos cursor = new BlockPos.MutableBlockPos();
for (int dx = -r; dx <= r; dx++) for (int dz = -r; dz <= r; dz++) {
    cursor.set(pos.getX() + dx, pos.getY(), pos.getZ() + dz);
    BlockState st = level.getBlockState(cursor);
    // ...
}
```

### 4. Block entities qui tickent pour rien

Un `BlockEntityTicker` qui tourne alors que la machine est inactive = coût pur. Retournez `null` dans `getTicker` selon l'état, ou sortez tôt du `serverTick`, ou passez le bloc en état « éteint » qui n'a pas de ticker.

### 5. Recherches d'entités trop larges

`getEntitiesOfClass(Entity.class, hugeAABB)` scanne toutes les sous-sections. Réduisez le rayon, filtrez par classe précise, utilisez `getNearestPlayer`.

### 6. Chargement de chunks

`ForgeChunkManager.forceChunk(...)` sans le relâcher, ou téléportations en boucle : le serveur garde des chunks actifs. Forcez le **minimum** et relâchez.

### 7. Logs dans les chemins chauds

```java
LOGGER.debug("État: " + bigObject);   // la concaténation s'exécute MÊME si debug est off
// mieux :
if (LOGGER.isDebugEnabled()) LOGGER.debug("État: {}", bigObject);
```

### 8. Config lue à chaque appel

`ModConfig.COMMON.someValue.get()` fait une lecture TOML. Lisez une fois dans `ModConfigEvent`, gardez la valeur dans un champ.

## Structures de données

Pour de gros volumes indexés par position ou par int, utilisez **fastutil** (fourni par Minecraft) :

```java
import it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap;

// clé = BlockPos.asLong() -> pas de boxing, pas d'allocation de BlockPos
private final Long2ObjectOpenHashMap<MachineData> byPos = new Long2ObjectOpenHashMap<>();
byPos.put(pos.asLong(), data);
```

- `Long2ObjectOpenHashMap`, `Object2IntOpenHashMap`, `IntOpenHashSet`…
- `EnumMap<Direction, X>` plutôt qu'une `HashMap`.
- Tableaux plutôt que listes pour les tailles fixes.

## Travail hors du thread principal

Pour un calcul lourd (génération procédurale, gros parsing) **qui ne touche pas le monde** :

```java
CompletableFuture
    .supplyAsync(() -> computeExpensiveThing(), Util.backgroundExecutor())
    .thenAccept(result ->
        server.execute(() -> applyToWorld(result)));   // retour sur le thread serveur pour appliquer
```

> :danger: **Ne lisez ni n'écrivez JAMAIS le `Level`, les entités ou les block entities depuis un autre thread.** Tout accès au monde se fait sur le thread serveur (`server.execute(...)`) ou client (`Minecraft.getInstance().execute(...)`).

## Pièges client (rendu)

- Allocations par frame dans `render()` d'un [BER](#/modeles-rendu) ou un `RenderLevelStageEvent`.
- Ne pas *batcher* : appeler `buffers.endBatch()` trop souvent.
- Recalculer un modèle / une `VoxelShape` à chaque frame — pré-calculer.
- Overlays HUD qui font un raycast complet chaque frame alors que `Minecraft.hitResult` existe déjà.
- Trop de particules (`SimpleParticleType(true)` partout).

## Méthode

1. **Reproduire** la lenteur (serveur de test, charge réaliste).
2. `/spark profiler` 60 s pendant le pic.
3. Ouvrir le rapport, filtrer sur vos paquets, repérer la méthode coûteuse.
4. Corriger **une** chose, re-profiler, comparer les MSPT.
5. Ne pas micro-optimiser du code froid (chargement, datagen) : ça n'a aucun effet en jeu.

## Pièges fréquents

| Symptôme | Cause probable | Piste |
|----------|----------------|-------|
| MSPT qui monte avec le nombre de vos machines | tick trop lourd par machine | espacer, cacher les voisins, désactiver le ticker à l'arrêt |
| Lag par à-coups (GC) | allocations massives par tick | `MutableBlockPos`, éviter streams/lambdas chauds, fastutil |
| Serveur qui garde des chunks chargés | `forceChunk` non relâché | relâcher, limiter |
| FPS qui chute près d'un de vos blocs | `render()` alloue / recalcule | pré-calculer, profiler le client |
| Lenteur au `/reload` seulement | parsing de datapack lourd | acceptable si ce n'est qu'au reload ; sinon simplifier |
| « ça rame » sans mesure | pas de profil | **toujours** `/spark` d'abord |

Page suivante : **[Débogage & problèmes fréquents](#/debogage)**.
