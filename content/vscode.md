# Visual Studio Code

VS Code fonctionne très bien pour le modding Forge, à condition d'installer les bonnes extensions et un JDK 17. L'expérience est un peu moins « clé en main » qu'IntelliJ (refactoring et inspections moins poussés), mais elle est légère et parfaitement viable, y compris en équipe mixte VS Code / IntelliJ.

## 1. Installer les extensions

Installez ces extensions (barre latérale *Extensions*, `Ctrl+Shift+X`) :

| Extension | ID | Rôle |
|-----------|-----|------|
| **Extension Pack for Java** | `vscjava.vscode-java-pack` | Langage Java, débogueur, tests, gestion de projet (métapaquet Microsoft) |
| **Gradle for Java** | `vscjava.vscode-gradle` | Vue des tâches Gradle, exécution |
| **EditorConfig for VS Code** | `editorconfig.editorconfig` | Respecte le `.editorconfig` partagé |

Facultatif : **Error Lens** (`usernamehw.errorlens`) pour voir les erreurs en ligne.

> :info: L'*Extension Pack for Java* installe notamment *Language Support for Java by Red Hat* (le serveur de langage, basé sur Eclipse JDT). C'est lui qui indexe le projet.

## 2. Configurer le JDK 17

VS Code a besoin de savoir **où** est le JDK 17. Deux réglages distincts :

- **`java.jdt.ls.java.home`** : le JDK qui fait tourner le *serveur de langage*. Peut être 17 **ou plus récent**.
- **`java.configuration.runtimes`** : les JDK disponibles pour **compiler et exécuter** votre code. Il **faut** un `JavaSE-17` marqué par défaut.

Ouvrez les *Settings (JSON)* (`Ctrl+Shift+P` → *Preferences: Open User Settings (JSON)*) :

```json
{
  "java.jdt.ls.java.home": "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.13.11-hotspot",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.13.11-hotspot",
      "default": true
    }
  ],
  "java.import.gradle.java.home": "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.13.11-hotspot"
}
```

> :attention: Sous Windows, dans le JSON, doublez les antislashs (`\\`) ou utilisez des slashs (`/`). Vérifiez qu'aucun `JAVA_HOME` système ne pointe vers Java 8 (le launcher Minecraft) : `java.import.gradle.java.home` a la priorité pour Gradle, mais le terminal intégré, lui, suit `JAVA_HOME`.

## 3. Ouvrir le projet et laisser l'indexation se faire

1. **File → Open Folder**, sélectionnez le dossier du projet.
2. Cliquez **Yes, I trust the authors**.
3. En bas à droite, l'icône Java affiche « Building… » / un éclair : l'indexation JDT tourne. Au premier import, **c'est long** (plusieurs minutes) et cela relance un build ForgeGradle.
4. Attendez que le statut passe au vert / disparaisse avant de juger les erreurs affichées.

Si l'indexation part mal :

- `Ctrl+Shift+P` → **Java: Clean Java Language Server Workspace** → *Restart and delete*.
- Lancez d'abord un `./gradlew build` dans le terminal intégré pour préremplir les caches.

## 4. Générer les configurations d'exécution

ForgeGradle sait générer un `launch.json` pour VS Code :

```bash
./gradlew genVSCodeRuns
```

Cela crée / met à jour **`.vscode/launch.json`** avec des configurations `runClient`, `runServer`, `runData`, et `.vscode/settings.json` (chemins de sources).

Ouvrez l'onglet **Run and Debug** (`Ctrl+Shift+D`), choisissez **runClient**, appuyez sur `F5`.

> :astuce: Relancez `./gradlew genVSCodeRuns` après chaque changement de version de Forge/Minecraft, ou si le lancement échoue avec un classpath incomplet.

Exemple de `.vscode/launch.json` généré (extrait) :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "runClient",
      "request": "launch",
      "mainClass": "net.minecraftforge.bootstrap.ForgeBootstrap",
      "projectName": "monmod",
      "vmArgs": "...généré par ForgeGradle...",
      "args": "...",
      "cwd": "${workspaceFolder}/run",
      "env": { }
    }
  ]
}
```

Ne modifiez pas ce fichier à la main : il est régénéré. S'il est committé, il crée des conflits (chemins absolus) — **ignorez `.vscode/` dans Git** (voir plus bas).

## 5. Débogage

- `F9` : point d'arrêt. `F5` : lancer/continuer. `F10`/`F11` : pas à pas.
- **Hot Code Replace** : VS Code remplace le corps des méthodes modifiées pendant une session de debug (réglage `"java.debug.settings.hotCodeReplace": "auto"`). Mêmes limites que partout : pas d'ajout de méthode/champ.
- Panneau **Debug Console** pour évaluer des expressions.
- `/reload` en jeu recharge les données sans redémarrer.

## 6. Tâches Gradle courantes

Via la vue **Gradle** (icône éléphant dans la barre latérale) ou le terminal intégré (`Ctrl+ù`) :

```bash
./gradlew build
./gradlew runClient
./gradlew runData
./gradlew --refresh-dependencies
```

## 7. Limites à connaître par rapport à IntelliJ

- Refactoring plus limité (renommage OK ; extractions et déplacements moins fiables sur gros projets).
- Pas d'assistant Mixin ; l'édition de `mods.toml` n'a pas de complétion dédiée.
- L'indexation JDT peut « décrocher » après un gros `git pull` → *Clean Java Language Server Workspace*.
- Les *runs* dépendent d'un `launch.json` régénéré ; en cas de doute, `./gradlew runClient` en terminal fonctionne toujours.

Aucune de ces limites n'empêche de livrer un mod complet. Beaucoup de moddeurs alternent : VS Code pour l'édition rapide, IntelliJ pour le debug lourd.

## 8. Git et fichiers VS Code

Ajoutez au `.gitignore` :

```text
.vscode/
```

Si votre équipe veut partager **certains** réglages (formatage, extensions recommandées), committez uniquement `.vscode/extensions.json` et un `.vscode/settings.json` **sans chemins absolus**, et gardez `launch.json` ignoré :

```text
.vscode/*
!.vscode/extensions.json
```

`.vscode/extensions.json` :

```json
{
  "recommendations": [
    "vscjava.vscode-java-pack",
    "vscjava.vscode-gradle",
    "editorconfig.editorconfig"
  ]
}
```

## Dépannage express

| Problème | Solution |
|----------|----------|
| Des centaines d'erreurs « cannot be resolved » | Indexation non terminée, ou mauvais JDK → attendre, puis *Clean Java Language Server Workspace* |
| `F5` ne lance rien / « main class not found » | `./gradlew genVSCodeRuns`, recharger la fenêtre |
| Gradle utilise Java 8 | Définir `java.import.gradle.java.home` et vérifier `JAVA_HOME` |
| Le terminal intégré n'a pas le bon Java | `$env:JAVA_HOME="...jdk-17..."` dans le terminal, ou corriger la variable système |
| Lenteurs extrêmes | Exclure `build/`, `run/`, `.gradle/` de la surveillance de fichiers (`files.watcherExclude`) |

```json
{
  "files.watcherExclude": {
    "**/build/**": true,
    "**/run/**": true,
    "**/.gradle/**": true
  }
}
```

Page suivante : **[La classe principale du mod](#/classe-principale)**.
