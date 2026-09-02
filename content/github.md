# GitHub : dépôt, CI & releases

Cette page couvre la mise en ligne du dépôt, l'**intégration continue** (build automatique à chaque PR), les **releases**, et la **publication** du mod. Elle explique aussi comment publier **ce site de guide** sur GitHub Pages.

## 1. Créer le dépôt

1. Sur GitHub : **New repository**. Nom = celui du mod. Ne cochez **rien** (pas de README/licence auto : le projet en a déjà).
2. Reliez votre dépôt local :

```bash
git remote add origin https://github.com/VOTRE-UTILISATEUR/VOTRE-DEPOT.git
git push -u origin main
```

### Protéger `main`

*Settings → Branches → Add branch ruleset* (ou *Branch protection rules*) sur `main` :

- ☑ Require a pull request before merging (au moins **1 approbation**).
- ☑ Require status checks to pass → sélectionnez le job **build** (après la 1ʳᵉ exécution de la CI).
- ☑ Require branches to be up to date before merging.
- ☑ (option) Require conversation resolution before merging.

Résultat : impossible de pousser du code cassé sur `main`.

## 2. Intégration continue (GitHub Actions)

Créez **`.github/workflows/build.yml`** :

```yaml
name: build

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Make gradlew executable
        run: chmod +x ./gradlew

      # Si vous IGNOREZ src/generated : décommentez la ligne suivante
      # - name: Datagen
      #   run: ./gradlew runData

      - name: Build
        run: ./gradlew build --stacktrace

      - name: Vérifier le format (si Spotless)
        run: ./gradlew spotlessCheck
        continue-on-error: false

      - name: Upload du jar
        uses: actions/upload-artifact@v4
        with:
          name: monmod-jar
          path: build/libs/*.jar
          if-no-files-found: error
```

Notes :

- `gradle/actions/setup-gradle@v4` gère le **cache Gradle** (dépendances, `~/.gradle`) automatiquement — builds suivants bien plus rapides.
- Le premier run reste long (décompilation de Minecraft). Le cache réduit ensuite fortement le temps.
- `--stacktrace` aide à diagnostiquer les échecs CI.
- Le `.jar` de chaque build est téléchargeable dans l'onglet **Actions → run → Artifacts**.

### Cache supplémentaire de ForgeGradle (optionnel)

ForgeGradle stocke Minecraft décompilé dans `~/.gradle/caches/forge_gradle`. `setup-gradle` le couvre déjà via le cache `~/.gradle`. Pour un contrôle fin :

```yaml
      - name: Cache ForgeGradle
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches/forge_gradle
          key: forgegradle-${{ runner.os }}-${{ hashFiles('gradle.properties') }}
```

## 3. Templates de PR et d'issues

**`.github/pull_request_template.md`** :

```markdown
## Description

<!-- Que fait cette PR ? -->

## Checklist
- [ ] `./gradlew build` passe en local
- [ ] `./gradlew runData` relancé (si contenu ajouté/modifié)
- [ ] `./gradlew spotlessApply` exécuté
- [ ] Testé en jeu (`runClient`)
- [ ] Commits en Conventional Commits
```

**`.github/ISSUE_TEMPLATE/bug_report.md`** : version de Minecraft/Forge, autres mods, log complet (`run/logs/latest.log` ou `debug.log`), étapes de repro.

## 4. Versionnage du mod (SemVer)

Format **`MAJEUR.MINEUR.CORRECTIF`** dans `mod_version` (`gradle.properties`) :

- **MAJEUR** : changement cassant (recettes retirées, API publique modifiée, worldgen incompatible).
- **MINEUR** : nouveau contenu rétrocompatible.
- **CORRECTIF** : correction de bug sans nouveau contenu.

Beaucoup de moddeurs préfixent avec la version du jeu : `1.20.1-0.3.0`.

Tenez un **`CHANGELOG.md`** (format [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)).

## 5. Releases automatiques

**`.github/workflows/release.yml`** — se déclenche quand vous poussez un tag `v*` :

```yaml
name: release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - uses: gradle/actions/setup-gradle@v4
      - run: chmod +x ./gradlew
      - run: ./gradlew build --stacktrace

      - name: Créer la release GitHub
        uses: softprops/action-gh-release@v2
        with:
          files: build/libs/*.jar
          generate_release_notes: true
```

Publier la version 0.3.0 :

```bash
# 1. bump mod_version=0.3.0 dans gradle.properties, mettre à jour CHANGELOG.md
git commit -am "chore(release): 0.3.0"
git tag v0.3.0
git push && git push --tags
```

La CI construit le jar et crée la release avec le `.jar` en pièce jointe.

## 6. Publier sur Modrinth / CurseForge

Le plugin **Minotaur** (Modrinth) et **CurseGradle** publient le jar depuis Gradle.

`build.gradle` (extrait Minotaur) :

```gradle
plugins {
    // ...
    id 'com.modrinth.minotaur' version '2.+'
}

modrinth {
    token = System.getenv('MODRINTH_TOKEN')     // secret CI, jamais en clair
    projectId = 'abcdEFGH'
    versionNumber = "${mod_version}"
    versionType = 'release'
    uploadFile = tasks.jar
    gameVersions = ['1.20.1']
    loaders = ['forge']
    syncBodyFrom = rootProject.file('README.md').text
}
```

Dans le workflow release, ajoutez une étape :

```yaml
      - name: Publier sur Modrinth
        env:
          MODRINTH_TOKEN: ${{ secrets.MODRINTH_TOKEN }}
        run: ./gradlew modrinth
```

Ajoutez le secret dans *Settings → Secrets and variables → Actions → New repository secret*.

> :attention: Ne mettez **jamais** un token d'API dans `build.gradle` ou dans un fichier committé. Toujours via `System.getenv(...)` + secret GitHub, ou `~/.gradle/gradle.properties` (non versionné) en local.

## 7. Licence du mod

Choisissez avant de publier (le fichier `LICENSE` + le champ `mod_license`) :

| Licence | Idée | Pour qui |
|---------|------|----------|
| **MIT** / **Apache-2.0** | permissive, réutilisation libre | mods « bibliothèque », API |
| **LGPL-3.0** | modifications du mod à repartager | équilibre courant |
| **GPL-3.0** | tout dérivé reste libre | projets communautaires |
| **All Rights Reserved** | aucun droit accordé | à éviter pour du collaboratif |

[choosealicense.com](https://choosealicense.com/) aide à décider. Mentionnez aussi la licence des **assets** (textures, sons) : souvent CC BY / CC BY-NC.

---

## 8. Publier CE site de guide sur GitHub Pages

Le guide est un site statique (HTML/CSS/JS + Markdown). Deux façons de le publier.

### Option 1 — dépôt dédié au guide

1. Nouveau dépôt, ex. `guide-forge-1201`. Poussez-y le contenu de ce dossier (`index.html`, `assets/`, `content/`, `.nojekyll`).
2. *Settings → Pages → Build and deployment → Source : **Deploy from a branch***.
3. Branch : `main`, dossier `/ (root)`. **Save**.
4. Après ~1 min, le site est sur `https://VOTRE-UTILISATEUR.github.io/guide-forge-1201/`.
5. Éditez `window.SITE_CONFIG.repoUrl` dans `index.html` pour pointer vers ce dépôt.

### Option 2 — sous-dossier `docs/` du dépôt du mod

1. Placez le site dans `docs/` à la racine du dépôt du mod.
2. *Settings → Pages → Source : Deploy from a branch*, branch `main`, dossier **`/docs`**.
3. Le site sort sur `https://VOTRE-UTILISATEUR.github.io/VOTRE-DEPOT/`.

### Le fichier `.nojekyll`

Un fichier **vide** nommé `.nojekyll` à la racine du site désactive le traitement Jekyll de GitHub Pages. Sans lui, GitHub ignore les dossiers commençant par `_` et peut retarder la prise en compte de certains fichiers. Ce dépôt en contient déjà un.

### Chemins relatifs

Le site utilise uniquement des chemins **relatifs** (`assets/…`, `content/…`) et un routage par **ancre** (`#/page`). Il fonctionne donc quel que soit le sous-chemin (`/`, `/mon-depot/`, `/docs/`) sans configuration.

### Déploiement via GitHub Actions (optionnel)

Pour un contrôle total, *Settings → Pages → Source : **GitHub Actions***, puis `.github/workflows/pages.yml` :

```yaml
name: pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'          # ou './docs' si le site est dans docs/
      - id: deployment
        uses: actions/deploy-pages@v4
```

Page suivante : **[Mixins (dernier recours)](#/mixins)**.
