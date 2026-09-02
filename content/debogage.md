# Débogage & problèmes fréquents

Où regarder, quoi lire, et les erreurs classiques avec leur solution.

## Où sont les logs

| Fichier | Contenu |
|---------|---------|
| `run/logs/latest.log` | log de la dernière session (niveau info + debug si activé) |
| `run/logs/debug.log` | log complet et verbeux — **le plus utile** pour un bug de chargement |
| `run/crash-reports/crash-*.txt` | rapport de crash horodaté |
| Console de l'IDE | sortie temps réel |

Le niveau `debug` est déjà activé par les runs du MDK (`-Dforge.logging.console.level=debug`).

## Lire un rapport de crash

Un `crash-*.txt` contient :

- **`Description:`** — ce que faisait le jeu au moment du crash.
- La **stack trace** — lisez de haut en bas ; la **première ligne mentionnant votre paquet** (`fr.monequipe.monmod...`) est en général la coupable.
- **`-- Head --`** puis **`-- MOD ...`** — précise quel mod est impliqué.
- **`Mod List:`** en bas — versions exactes chargées.

> :astuce: Cherchez `Caused by:` : la dernière occurrence donne souvent la vraie cause racine.

## Déboguer dans l'IDE

- Lancez **`runClient`** en mode Debug (🐞).
- Points d'arrêt dans la marge ; conditionnels via clic droit.
- `Alt+F8` (IntelliJ) / *Debug Console* (VS Code) pour évaluer une expression pendant une pause.
- **Point d'arrêt sur exception** : IntelliJ *Run → View Breakpoints → Java Exception Breakpoints* → `NullPointerException`, décochez « Caught » si trop bruyant.
- Pour du code appelé très souvent, utilisez un point d'arrêt **conditionnel** plutôt que de casser à chaque tick.

## Rechargement sans redémarrer

| Changement | Comment recharger |
|------------|-------------------|
| Corps de méthode | *Hot-swap* : recompiler pendant le debug (voir [IntelliJ](#/intellij) / [VS Code](#/vscode)) |
| Recettes, loot, tags, avancements, `lang` | commande **`/reload`** en jeu |
| Modèles / textures / blockstates | **`F3 + T`** en jeu (recharge les ressources client) |
| Nouvelle méthode / champ / classe, `@Mod` | relancer `runClient` |
| `mods.toml`, `build.gradle`, versions | relancer `runClient` (+ *Reload Gradle*) |

## Erreurs fréquentes

### `Missing or unsupported mandatory dependencies`

Au démarrage, écran d'erreur listant des dépendances. Causes :

- `versionRange` de `mods.toml` trop stricte ou fausse (`[47.3.0,)` alors que Forge est en `47.2.x`).
- `modId` d'une dépendance mal orthographié.

**Solution :** élargir la plage (`[47,)`), vérifier l'orthographe du `modId`.

### `NullPointerException` sur un `RegistryObject`

```text
Cannot invoke "...Item.getDescriptionId()" because the return value of "RegistryObject.get()" is null
```

Vous appelez `.get()` **avant** l'enregistrement (dans un `static {}`, le constructeur, ou pendant `RegisterEvent`).

**Solution :** différez l'accès. Utilisez le `RegistryObject` lui-même (il est `Supplier`) et ne faites `.get()` qu'à l'usage en jeu, ou au plus tôt dans `FMLCommonSetupEvent` via `enqueueWork`.

### `NoClassDefFoundError: net/minecraft/client/...` sur serveur

Une classe **client** est référencée depuis du code chargé côté serveur.

**Solution :** isoler (paquet `client/`, `FMLClientSetupEvent`, `DistExecutor`, `@EventBusSubscriber(value = Dist.CLIENT)`). Voir [Classe principale](#/classe-principale).

### Bloc invisible en main / inventaire (mais visible dans le monde)

Modèle **d'item** du bloc manquant.

**Solution :** `assets/monmod/models/item/<bloc>.json` avec `{ "parent": "monmod:block/<bloc>" }`, ou `simpleBlockWithItem(...)` en datagen.

### Texture violette et noire

Le jeu ne trouve pas la texture. Dans `debug.log` : `Using missing texture, unable to load monmod:textures/...`.

**Causes :** faute de casse (`Sapphire.png` ≠ `sapphire.png`), mauvais chemin, `modid` oublié dans le JSON (`"item/sapphire"` au lieu de `"monmod:item/sapphire"`), fichier hors de `src/main/resources`.

### `Exception loading blockstate definition ... Unknown property / Missing model`

Le blockstate référence un modèle inexistant, ou ne couvre pas tous les états du bloc.

**Solution :** vérifier chaque `model` du blockstate ; pour un bloc avec des propriétés (orientation, etc.), lister **toutes** les variantes.

### `/reload` ne prend pas mes changements

- Vous avez modifié `src/generated/` à la main : relancez `runData`.
- Ressources hors du classpath : activez `copyIdeResources = true` (build.gradle) si vous lancez via l'IDE plutôt que Gradle.

## Problèmes Gradle / build

### `Could not resolve net.minecraftforge:forge:1.20.1-XX.X.X`

Version fausse dans `gradle.properties`, cache corrompu, ou réseau.

```bash
./gradlew build --refresh-dependencies
```

Si ça persiste, supprimez le cache ForgeGradle :

```bash
# Windows
rmdir /s /q "%USERPROFILE%\.gradle\caches\forge_gradle"
# macOS/Linux
rm -rf ~/.gradle/caches/forge_gradle
```

puis relancez.

### Build lent puis échec pendant la décompilation / `applyRangeMap` / OOM

Pas assez de mémoire pour Gradle.

**Solution :** dans `gradle.properties`, `org.gradle.jvmargs=-Xmx3G` (voire `-Xmx4G`). Fermez les autres applications lourdes au premier build.

### `Unsupported class file major version` / erreurs bizarres dès le début

Gradle tourne sur Java 21+ au lieu de 17.

**Solution :** voir [JDK](#/jdk). Vérifiez `./gradlew -version` (`JVM: 17.0.x`).

### Erreurs SSL / `peer not authenticated` / timeouts

Proxy ou antivirus d'entreprise intercepte HTTPS.

**Solution :** configurez le proxy pour Gradle (`~/.gradle/gradle.properties`) :

```properties
systemProp.https.proxyHost=proxy.entreprise.tld
systemProp.https.proxyPort=8080
```

ou testez hors du réseau d'entreprise.

### Après `git pull` : tout est rouge dans l'IDE

Les versions ont peut-être changé.

**Solution :** *Reload All Gradle Projects* (IntelliJ) / recharger la fenêtre (VS Code), puis `./gradlew --refresh-dependencies`. Si besoin, *Invalidate Caches* (IntelliJ) ou *Clean Java Language Server Workspace* (VS Code).

### `genIntellijRuns` / `genVSCodeRuns` : rien ne se passe

- IntelliJ : les runs sont normalement auto-générés par ForgeGradle 6 à l'import. Sinon lancez la tâche puis *Reload Gradle*.
- VS Code : relancez `./gradlew genVSCodeRuns`, rechargez la fenêtre, vérifiez que `.vscode/launch.json` a bien été créé.

## Méthode générale face à un bug

1. **Reproduire** de façon fiable (mêmes étapes, monde de test dédié).
2. Lire **`debug.log`** en entier, chercher `ERROR`, `WARN`, `Caused by`.
3. Isoler : le bug apparaît-il sans les autres mods ? avec un monde neuf ?
4. Point d'arrêt à l'endroit suspect, inspecter l'état.
5. Corriger, relancer, **revérifier en jar** si c'est un bug lié au chargement des ressources.
6. Ajouter un GameTest ou une note dans le `CHANGELOG` si pertinent.

Page suivante : **[Ressources & liens utiles](#/liens)**.
