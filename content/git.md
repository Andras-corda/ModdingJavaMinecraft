# Travailler à plusieurs avec Git

Un projet de mod partagé qui n'est pas rigoureux sur Git devient vite ingérable : conflits sur des fichiers générés, versions de Forge qui divergent, `run/` committé par erreur. Cette page donne une méthode qui tient.

## 1. Initialiser le dépôt (créateur du projet)

Depuis le dossier du projet (le MDK contient déjà un `.gitignore`) :

```bash
git init
git branch -M main
git add .
git commit -m "chore: import du MDK Forge 1.20.1"
```

## 1 bis. Rejoindre un projet existant (nouveau collaborateur)

> **« J'ai cloné le dépôt mais il n'y a pas de dossier `build/`. Comment je récupère le projet ? »**
>
> C'est normal : **`build/` (comme `.gradle/`, `run/`, `.idea/`, `out/`) n'est jamais committé.** Ce sont des dossiers **générés**. Tout ce qu'il faut pour reconstruire le projet est dans le dépôt : le code source, `build.gradle`, `gradle.properties`, et le *Gradle wrapper*.

Marche à suivre :

```bash
# 1. Cloner
git clone https://github.com/VOTRE-EQUIPE/VOTRE-MOD.git
cd VOTRE-MOD

# 2. Vérifier le JDK (doit afficher 17.x — voir la page JDK)
./gradlew -version

# 3. Construire : Gradle télécharge Minecraft + Forge, décompile le jeu,
#    et (re)crée build/, .gradle/, les configs de lancement...
./gradlew build
```

Le **premier `build` prend 5 à 15 minutes** (téléchargement + décompilation). Les suivants sont rapides. Ensuite :

```bash
./gradlew runClient        # lance le jeu avec le mod
```

Ou, dans un IDE :

- **IntelliJ IDEA** : *File → Open* → choisir le **dossier** cloné. L'import Gradle fait le reste et génère les configs `runClient` / `runData` (voir [IntelliJ](#/intellij)).
- **VS Code** : *File → Open Folder*, attendre l'indexation, puis `./gradlew genVSCodeRuns` (voir [VS Code](#/vscode)).

> :attention: **Ne copiez jamais** `build/`, `.gradle/`, `run/`, `.idea/`, `*.iml` depuis le poste d'un autre : ils contiennent des chemins absolus et des caches spécifiques à sa machine, et provoquent des erreurs. Chacun les régénère localement.
>
> Si quelqu'un a committé `build/` ou `run/` par erreur : `git rm -r --cached build run` puis commit (voir plus bas).

## 2. `.gitignore` : la pièce maîtresse

Le `.gitignore` du MDK est un bon départ. Version complète et commentée :

```gitignore
# ---- Sorties de build ----
build/
out/
bin/

# ---- Caches Gradle / Forge ----
.gradle/
# NE PAS ignorer gradle/wrapper/ : il est indispensable

# ---- Instance de jeu de test ----
run/
runs/
run-data/

# ---- Datagen : cache seulement ----
src/generated/resources/.cache/
# Le reste de src/generated/resources/ : voir la décision d'équipe ci-dessous

# ---- Logs ----
logs/
*.log

# ---- IntelliJ IDEA ----
.idea/
*.iml
*.ipr
*.iws

# ---- Eclipse ----
.metadata/
.classpath
.project
.settings/
.apt_generated/
*.launch

# ---- Visual Studio Code ----
.vscode/

# ---- OS ----
.DS_Store
Thumbs.db
```

### À committer absolument

- `gradlew`, `gradlew.bat`, **`gradle/wrapper/`** (fige Gradle 8.1.1 pour tous).
- `build.gradle`, `gradle.properties`, `settings.gradle`.
- Tout `src/main/`.
- `.gitignore`, `.editorconfig`, `README.md`, `LICENSE`, `CONTRIBUTING.md`.
- `.github/` (workflows CI, templates).

### À ne jamais committer

- `run/` — mondes, logs, `options.txt`, crash-reports. Propre à chaque poste.
- `build/`, `.gradle/`, `out/`, `bin/`.
- `src/generated/resources/.cache/`.
- Fichiers IDE contenant des chemins absolus (`*.iml`, `.vscode/launch.json`).

> :attention: Si `run/` ou `build/` a déjà été committé par erreur :
> ```bash
> git rm -r --cached run build
> git commit -m "chore: retire run/ et build/ du suivi"
> ```

### La question `src/generated/resources/`

Décidez **en équipe** et écrivez-le dans `CONTRIBUTING.md` :

- **Option A (défaut MDK) — committer** les JSON générés (hors `.cache/`). Chacun lance `runData` avant de committer. La CI n'a rien de spécial à faire.
- **Option B — ignorer** tout `src/generated/`. Ajoutez `src/generated/` au `.gitignore` et faites dépendre `build` de `runData` (voir [Datagen](#/datagen)). Diffs plus propres, CI un peu plus lente.

Ne mélangez pas les deux : c'est la garantie de conflits permanents.

## 3. Figer l'environnement pour toute l'équipe

Les divergences d'environnement causent des « ça marche chez moi ». À verrouiller :

| Élément | Où c'est figé | Committé ? |
|---------|---------------|------------|
| Version de Gradle | `gradle/wrapper/gradle-wrapper.properties` | ✅ oui |
| Versions Minecraft / Forge | `gradle.properties` (`minecraft_version`, `forge_version`) | ✅ oui |
| Mappings | `gradle.properties` (`mapping_channel`, `mapping_version`) | ✅ oui |
| Version de Java | `build.gradle` (toolchain 17) + doc `README` / `.sdkmanrc` | ✅ oui |
| Style de code | `.editorconfig` + config Spotless | ✅ oui |

> :astuce: Toute montée de version de Forge/Minecraft/mappings se fait dans **un commit dédié**, annoncé à l'équipe, suivi d'un `./gradlew --refresh-dependencies` et d'un *Reload Gradle* pour chacun.

## 4. Modèle de branches

Modèle léger, suffisant pour une petite équipe :

```text
main            <- toujours compilable, c'est la "vérité"
 └── feat/minerai-saphir      (une fonctionnalité = une branche)
 └── feat/machine-broyeur
 └── fix/crash-datagen
```

- On ne pousse **jamais** directement sur `main` : tout passe par une *pull request*.
- Une branche = une fonctionnalité ou un correctif, courte durée de vie.
- On rebase/merge `main` dans sa branche régulièrement pour limiter les conflits.

```bash
git switch -c feat/minerai-saphir
# ... travail, commits ...
git push -u origin feat/minerai-saphir
# ouvrir la PR sur GitHub
```

### Nommage des branches

`feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…` suivi d'un slug court en minuscules.

## 5. Messages de commit : Conventional Commits

Format : `type(portée): résumé à l'impératif`.

```text
feat(blocs): ajoute le minerai et le bloc de saphir
fix(datagen): corrige le chemin de la table de butin du minerai
refactor(registry): sépare ModItems et ModBlocks
docs(readme): explique la procédure de setup VS Code
chore(deps): passe Forge 47.2.0 -> 47.3.0
```

Types courants : `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `style`.

Avantages : historique lisible, génération de changelog possible, revue plus rapide.

## 6. Réduire les conflits : organisation du code

Les conflits Git en modding viennent surtout de **gros fichiers touchés par tout le monde**. Parades :

- **Un `DeferredRegister` par domaine** : `ModItems`, `ModBlocks`, `ModBlockEntities`… Deux personnes ajoutant un item et un bloc ne se marchent pas dessus.
- **Un paquet par fonctionnalité** : `feature/oremagic/`, `feature/machines/`.
- **Datagen plutôt que JSON à la main** : on modifie un *provider* `.java` ciblé, pas 30 `.json`.
- **`en_us.json` / `fr_fr.json`** : si générés par datagen, plus de conflit ; sinon, gardez les clés **triées** et groupées par fonctionnalité.
- Évitez les reformatages massifs mélangés à du code fonctionnel : faites-les dans un commit `style:` séparé.

## 7. Gérer un conflit sur un fichier généré

Si malgré tout un `.json` de `src/generated/` entre en conflit :

```bash
# Prendre la version d'une des branches puis régénérer
git checkout --theirs src/generated/resources/...
./gradlew runData
git add src/generated
```

La régénération fait foi ; le `.json` n'est qu'un artefact.

## 8. Style de code automatisé (Spotless)

Pour que tout le monde formate pareil, ajoutez **Spotless** dans `build.gradle` :

```gradle
plugins {
    // ...
    id 'com.diffplug.spotless' version '6.25.0'
}

spotless {
    java {
        target 'src/*/java/**/*.java'
        googleJavaFormat('1.17.0').aosp()   // 4 espaces
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}
```

- `./gradlew spotlessApply` : reformate.
- `./gradlew spotlessCheck` : échoue si le format n'est pas bon (à mettre en CI).

> :astuce: Ajoutez un *hook* Git `pre-commit` qui lance `spotlessApply` (ou utilisez l'outil [pre-commit](https://pre-commit.com/)), pour éviter les allers-retours en revue.

## 9. Fichiers d'aide au dépôt

À la racine, créez :

- **`README.md`** : présentation, versions cibles, comment lancer (`./gradlew runClient`).
- **`CONTRIBUTING.md`** : prérequis (JDK 17), conventions de branches/commits, décision sur `src/generated/`, comment lancer la datagen, checklist de PR.
- **`LICENSE`** : indispensable si le mod est public (voir [Publier](#/github)).
- **`.github/pull_request_template.md`** : rappel de la checklist (build OK, datagen relancée, testé en jeu).

Exemple de `CONTRIBUTING.md` minimal :

```markdown
# Contribuer

## Prérequis
- JDK 17 (Temurin conseillé)
- IntelliJ IDEA ou VS Code (voir le guide)

## Workflow
1. `git switch -c feat/ma-fonctionnalite`
2. Coder + écrire la datagen associée
3. `./gradlew runData` puis `./gradlew build`
4. `./gradlew spotlessApply`
5. Commits en Conventional Commits
6. Pousser, ouvrir une PR, attendre la CI verte + 1 revue

## Fichiers générés
On committe `src/generated/resources/` (hors `.cache/`).
Toujours relancer `runData` avant de committer.
```

Page suivante : **[GitHub : dépôt, CI & releases](#/github)**.
