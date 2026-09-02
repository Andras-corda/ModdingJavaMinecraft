# IntelliJ IDEA (JetBrains)

IntelliJ IDEA est l'IDE **le plus utilisé** pour le modding : intégration Gradle native, débogueur solide, *hot-swap*, et un plugin dédié. La version **Community** (gratuite) suffit entièrement.

## 1. Installer

- Téléchargez **IntelliJ IDEA Community Edition** : [jetbrains.com/idea/download](https://www.jetbrains.com/idea/download/) (ou via **JetBrains Toolbox**, pratique pour les mises à jour).
- Au premier lancement, installez le plugin **Minecraft Development** : *Settings → Plugins → Marketplace → « Minecraft Development » → Install*, puis redémarrez.

Le plugin **Minecraft Development** apporte : coloration des `mods.toml` / mixins, inspections spécifiques, génération de `@Mixin`, icônes, et un assistant de création de projet (que nous n'utilisons pas ici, car on part du MDK).

## 2. Ouvrir le projet MDK

1. **File → Open**, sélectionnez le **dossier** du projet (celui qui contient `build.gradle`).
2. IntelliJ détecte Gradle et propose de charger le projet : acceptez. Si une fenêtre « Trust Project » apparaît, cliquez **Trust**.
3. Laissez l'import Gradle se terminer (barre de progression en bas). Au premier import : plusieurs minutes (mêmes téléchargements que `./gradlew build`).

> :astuce: Ouvrez **le dossier**, pas le fichier `build.gradle`. Et n'utilisez jamais *File → New → Project from Existing Sources* pour un projet Gradle : passez toujours par *Open*.

## 3. Configurer le JDK 17

### JDK du projet

*File → Project Structure → Project* :

- **SDK** : sélectionnez un JDK 17. S'il n'apparaît pas : *Add SDK → Download JDK → Version 17, Vendor : Eclipse Temurin → Download*.
- **Language level** : `17 - Sealed types, always-strict floating-point semantics`.

### JDK utilisé par Gradle

*Settings → Build, Execution, Deployment → Build Tools → Gradle* :

- **Gradle JVM** : `17` (le même JDK).
- **Build and run using** : `Gradle` (défaut). *Run tests using* : `Gradle` également, au début.

> :attention: Si « Gradle JVM » pointe vers Java 21, l'import échoue avec des erreurs ForgeGradle obscures. C'est la cause n°1 de projet qui ne s'ouvre pas.

## 4. Les configurations d'exécution

Avec **ForgeGradle 6**, les configurations `runClient`, `runServer`, `runData` sont **générées automatiquement** à l'import Gradle. Elles apparaissent dans le menu déroulant en haut à droite.

Si elles manquent :

```bash
./gradlew genIntellijRuns
```

puis *rechargez le projet Gradle* (icône « Reload All Gradle Projects » dans l'onglet Gradle).

### Lancer

- Sélectionnez **`runClient`** → cliquez sur ▶ (Run) ou 🐞 (Debug).
- Le jeu démarre. En mode Debug, les points d'arrêt fonctionnent.

### `runData`

Sélectionnez **`runData`** et lancez-le à chaque fois que vous modifiez vos *providers* de datagen. La sortie va dans `src/generated/resources/`.

## 5. Débogage et *hot-swap*

- **Points d'arrêt** : cliquez dans la marge. Points d'arrêt conditionnels : clic droit sur le point.
- **Évaluer une expression** : `Alt+F8` pendant une pause.
- **Hot-swap** : en Debug, modifiez le **corps** d'une méthode puis *Run → Debugging Actions → Reload Changed Classes*. Le code est remplacé à chaud.
  - Limites du hot-swap standard : impossible d'**ajouter/supprimer** méthodes, champs ou classes.
  - Pour aller plus loin, lancez le jeu avec le **JetBrains Runtime + « Enhanced class redefinition »** (IDEA 2023.2+ : *Settings → Build Tools → Gradle → Gradle JVM → télécharger un JBR 17*, puis activer *Settings → Build, Execution, Deployment → Debugger → HotSwap → « Enhanced class redefinition (uses DCEVM) »*).

> :astuce: Après un changement qui ne peut pas être *hot-swappé* (nouvelle méthode, nouveau champ), relancez simplement `runClient`. Utilisez `/reload` en jeu pour recharger uniquement les données (recettes, loot, tags, lang) sans redémarrer.

## 6. Réglages qui font gagner du temps

*Settings → …* :

- **Editor → General → Auto Import** : cochez *Add unambiguous imports on the fly* et *Optimize imports on the fly*.
- **Build Tools → Gradle → « Build and run using »** : garder `Gradle` évite les problèmes de classpath avec ForgeGradle.
- Activez `copyIdeResources = true` dans `build.gradle` si vous lancez parfois via *IDEA* plutôt que *Gradle* : sinon les ressources générées ne sont pas sur le classpath.
- **Version Control** : IntelliJ détecte le `.git` automatiquement. La fenêtre *Commit* (`Alt+0`) suffit pour le quotidien.

## 7. Fichiers IntelliJ et Git

Le MDK ignore déjà `.idea/` partiellement et `*.iml`. Recommandation simple : **ignorer tout `.idea/`** et `*.iml`, chacun reconfigure son IDE (c'est rapide). Voir [Git](#/git).

Ce qui compte est partagé par Gradle (`build.gradle`, `gradle.properties`), pas par les fichiers `.idea/`.

## 8. `.editorconfig` (partagé, lui)

Placez à la racine un `.editorconfig` — IntelliJ **et** VS Code le respectent :

```properties
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space

[*.java]
indent_size = 4
max_line_length = 120

[*.{json,yml,yaml,toml}]
indent_size = 2

[*.{gradle,properties}]
indent_size = 4
```

## Dépannage express

| Problème | Solution |
|----------|----------|
| L'import Gradle tourne en boucle ou échoue | Vérifier *Gradle JVM = 17* ; *File → Invalidate Caches → Invalidate and Restart* |
| Pas de `runClient` dans le menu | `./gradlew genIntellijRuns` puis *Reload Gradle Project* |
| `runClient` : `NoClassDefFoundError: ...client...` sur `runServer` | Du code client est référencé côté commun — voir [Config & réseau](#/config-reseau) |
| Ressources absentes en jeu quand on lance via *IDEA* | Activer `copyIdeResources = true` ou lancer via *Gradle* |
| Rouge partout après un `git pull` qui change les versions | *Reload All Gradle Projects*, puis `./gradlew --refresh-dependencies` |

Page suivante : **[Visual Studio Code](#/vscode)**.
