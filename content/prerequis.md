# Prérequis & concepts clés

Avant d'écrire la moindre ligne de mod, il faut comprendre **sur quoi on s'appuie**. Cette page pose le vocabulaire utilisé partout ensuite.

## Prérequis matériels et logiciels

| Élément | Minimum conseillé |
|---------|-------------------|
| RAM | 8 Go (16 Go confortable : l'IDE + Gradle + le client de test) |
| Disque | ~5 Go pour un projet (caches Gradle, assets décompilés, `run/`) |
| OS | Windows 10/11, macOS, ou Linux |
| Connexion | Requise au premier build (téléchargement de Minecraft, Forge, mappings) |

Logiciels à installer (détaillés dans les pages suivantes) :

- **JDK 17** — [page dédiée](#/jdk).
- **Un IDE** : IntelliJ IDEA (recommandé) **ou** VS Code.
- **Git** — [git-scm.com](https://git-scm.com/). Sur Windows, installez « Git for Windows » (fournit Git Bash).
- Un **compte GitHub** pour héberger le projet en équipe.

> :astuce: N'installez **pas** Gradle séparément. Le MDK contient un *Gradle wrapper* (`gradlew`) qui télécharge la bonne version automatiquement. Utiliser un Gradle système d'une autre version est une source classique d'erreurs.

## Java, la JVM et les mappings

Minecraft est écrit en **Java** et distribué **obfusqué** : les noms de classes, méthodes et champs sont remplacés par `a`, `b`, `c`… pour la version publiée.

Pour développer, on a besoin de noms lisibles. C'est le rôle des **mappings** :

- **`official` (Mojang mappings)** — publiés par Mojang. Noms de classes/méthodes/champs lisibles. **Choix par défaut** pour 1.20.1.
- **Parchment** — Mojang mappings **+ noms de paramètres et Javadoc** fournis par la communauté. Recommandé pour le confort. Exemple de version pour 1.20.1 : `2023.09.03`.

ForgeGradle applique ces mappings pour vous fournir un **espace de travail « désobfusqué »**. À la compilation, votre code est retraduit vers les noms internes (`SRG`) que le jeu comprend à l'exécution.

> :info: Conséquence pratique : toute l'équipe **doit utiliser les mêmes mappings et la même version**, sinon les diffs Git deviennent illisibles et le code ne compile pas de la même façon. On fige donc ces valeurs dans `gradle.properties` (voir [MDK](#/mdk)).

## Gradle en 2 minutes

**Gradle** est l'outil de build. Ce qu'il faut retenir :

- `build.gradle` : script de build (plugins, dépendances, configuration Forge).
- `gradle.properties` : variables (versions de Minecraft, Forge, mappings, `mod_id`…).
- `settings.gradle` : nom du projet, dépôts de plugins.
- `gradlew` / `gradlew.bat` : le *wrapper*. **On lance toujours `./gradlew <tâche>`**, jamais `gradle`.
- `gradle/wrapper/` : fixe la version de Gradle. **À committer.**

Tâches Forge les plus utiles :

```bash
./gradlew build              # compile + produit le .jar dans build/libs/
./gradlew runClient          # lance un client Minecraft avec le mod
./gradlew runServer          # lance un serveur dédié avec le mod
./gradlew runData            # exécute la génération de données (datagen)
./gradlew genIntellijRuns    # crée les configurations d'exécution IntelliJ
./gradlew genVSCodeRuns      # crée .vscode/launch.json
./gradlew --refresh-dependencies   # force la revérification des dépendances
./gradlew clean              # supprime build/
```

> :attention: Sur Windows PowerShell, écrivez `./gradlew` ou `.\gradlew`. Le premier `build` peut prendre **5 à 15 minutes** (téléchargement + décompilation de Minecraft). Les suivants sont rapides.

## L'architecture de Minecraft : client, serveur, « sides »

C'est **le** concept qui piège les débutants.

### Distribution physique (*physical side*)

- **Client physique** : le jeu complet (rendu, sons, interface). Le fichier `minecraft.jar` du launcher.
- **Serveur dédié physique** : `minecraft_server.jar`. **Aucune** classe de rendu (`net.minecraft.client.*` est absent).

:danger: **Si votre code référence une classe `net.minecraft.client.*` depuis une portion chargée sur le serveur dédié, le serveur plante** avec `NoClassDefFoundError`. On isole donc le code client (voir [Config & réseau](#/config-reseau)).

### Côté logique (*logical side*)

Même en **solo**, Minecraft fait tourner **un serveur interne** + **un client** dans le même processus, sur des threads différents :

- Le **serveur logique** détient la vérité : monde, entités, inventaires, logique de jeu.
- Le **client logique** affiche une copie et envoie des intentions (« je clique », « j'avance »).

On teste le côté avec `level.isClientSide()` :

```java
if (!level.isClientSide()) {
    // Exécuté uniquement sur le serveur logique : modifier le monde ici.
}
```

> :astuce: Règle d'or : **le serveur décide, le client affiche**. Ne faites jamais confiance à une donnée venue du client sans la valider côté serveur.

## Les registres (*registries*)

Presque tout dans Minecraft est **enregistré** : blocs, items, entités, effets, biomes, sons, onglets créatifs… Chaque élément possède un identifiant unique de la forme `modid:nom` (une `ResourceLocation`), par exemple `examplemod:sapphire`.

Avec Forge 1.20.1, on enregistre via **`DeferredRegister`** (voir [Blocs & items](#/blocs-items)). Deux règles :

1. **Jamais d'initialisation « statique sauvage »** : on passe par `DeferredRegister`, pas par `new Block(...)` dans un `static {}`.
2. **Les identifiants sont définitifs** : renommer `examplemod:ruby` en `examplemod:red_gem` casse les mondes existants (items perdus). Choisissez bien dès le début.

## Les deux bus d'événements

Forge expose **deux** bus d'événements distincts. Se tromper de bus = code jamais appelé.

| Bus | Pour quoi | Comment s'abonner |
|-----|-----------|-------------------|
| **Mod event bus** | Cycle de vie du mod : `FMLCommonSetupEvent`, événements d'enregistrement, `FMLClientSetupEvent`, `GatherDataEvent`, `BuildCreativeModeTabContentsEvent` | `modEventBus.addListener(...)` dans le constructeur, ou `@Mod.EventBusSubscriber(bus = Bus.MOD)` |
| **Forge event bus** (`MinecraftForge.EVENT_BUS`) | Événements de jeu : clic droit, tick du joueur, mort d'une entité, chargement d'un chunk… | `MinecraftForge.EVENT_BUS.register(obj)`, ou `@Mod.EventBusSubscriber(bus = Bus.FORGE)` (valeur par défaut) |

On détaille l'usage dans [La classe principale du mod](#/classe-principale).

## `assets` contre `data`

Dans `src/main/resources/` :

- **`assets/modid/`** : ressources **client** — textures, modèles, sons, traductions (`lang/`).
- **`data/modid/`** : ressources **serveur/données** — recettes, tables de butin, tags, avancements, fonctions.

Une texture manquante ne fait pas planter le serveur ; une recette mal formée si.

## Récapitulatif

- Java **17**, mappings identiques pour toute l'équipe, figés dans `gradle.properties`.
- On lance **`./gradlew`**, jamais un Gradle système.
- **Serveur = vérité, client = affichage.** Isoler le code client.
- Tout s'**enregistre** avec `DeferredRegister` ; les identifiants sont définitifs.
- **Deux bus** d'événements : *mod* (cycle de vie) et *forge* (jeu).

Page suivante : **[Installer le JDK 17](#/jdk)**.
