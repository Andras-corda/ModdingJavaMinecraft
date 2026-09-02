# Anatomie d'un projet Forge

Comprendre où va chaque fichier évite les erreurs « ma texture ne s'affiche pas » et les conflits Git.

## Arborescence complète commentée

```text
MonMod/
├── build.gradle                  # script de build (plugins, deps, runs)
├── gradle.properties             # variables (versions, mod_id...)
├── settings.gradle               # nom du projet, dépôts de plugins
├── gradlew, gradlew.bat          # wrapper Gradle — À COMMITTER
├── gradle/wrapper/               # version de Gradle figée — À COMMITTER
├── .gitignore                    # fourni par le MDK — à adapter
├── LICENSE                       # votre licence (à ajouter)
├── README.md                     # présentation du mod
│
├── src/
│   ├── main/
│   │   ├── java/                 # VOTRE CODE
│   │   │   └── fr/monequipe/monmod/
│   │   │       ├── MonMod.java            # classe @Mod principale
│   │   │       ├── registry/
│   │   │       │   ├── ModBlocks.java
│   │   │       │   ├── ModItems.java
│   │   │       │   └── ModCreativeTabs.java
│   │   │       ├── block/                 # classes de blocs custom
│   │   │       ├── item/                  # classes d'items custom
│   │   │       ├── client/                # code CLIENT UNIQUEMENT
│   │   │       ├── datagen/               # providers de datagen
│   │   │       ├── network/               # paquets réseau
│   │   │       └── config/                # ForgeConfigSpec
│   │   │
│   │   └── resources/            # RESSOURCES STATIQUES
│   │       ├── META-INF/
│   │       │   └── mods.toml              # métadonnées du mod
│   │       ├── pack.mcmeta               # déclare un resource/data pack
│   │       ├── monmod.mixins.json        # (si vous utilisez Mixin)
│   │       ├── assets/monmod/            # CLIENT : textures, modèles...
│   │       │   ├── blockstates/
│   │       │   ├── models/
│   │       │   │   ├── block/
│   │       │   │   └── item/
│   │       │   ├── textures/
│   │       │   │   ├── block/
│   │       │   │   └── item/
│   │       │   └── lang/
│   │       │       ├── en_us.json
│   │       │       └── fr_fr.json
│   │       └── data/monmod/              # DONNÉES : recettes, loot, tags
│   │           ├── recipes/
│   │           ├── loot_tables/
│   │           ├── tags/
│   │           └── advancements/
│   │
│   ├── generated/
│   │   └── resources/            # SORTIE de `runData` (datagen)
│   │
│   └── test/                     # tests unitaires / GameTest (optionnel)
│
├── src/generated/resources/.cache/   # cache datagen — IGNORÉ par Git
├── build/                            # sortie de build — IGNORÉ
├── run/                              # instance de jeu de test — IGNORÉ
└── .gradle/                          # cache Gradle local — IGNORÉ
```

> :astuce: L'arborescence de paquets `java/` proposée (`registry/`, `block/`, `client/`, `datagen/`, `network/`) n'est pas imposée par Forge, mais elle **réduit fortement les conflits Git** en équipe : chacun travaille dans son sous-dossier.

## `META-INF/mods.toml`

Le manifeste du mod. Les `${...}` sont remplis par Gradle depuis `gradle.properties`.

```toml
modLoader="javafml"
loaderVersion="${loader_version_range}"
license="${mod_license}"
issueTrackerURL="https://github.com/VOTRE-UTILISATEUR/VOTRE-DEPOT/issues"

[[mods]]
modId="monmod"
version="${file.jarVersion}"
displayName="Mon Mod"
authors="Mon Équipe"
description='''
Description multi-lignes du mod.
'''
logoFile="logo.png"        # facultatif, à la racine des resources

# Dépendance obligatoire à Forge
[[dependencies.monmod]]
    modId="forge"
    type="required"
    versionRange="${forge_version_range}"
    ordering="NONE"
    side="BOTH"

# Dépendance obligatoire à Minecraft (verrouille la version du jeu)
[[dependencies.monmod]]
    modId="minecraft"
    type="required"
    versionRange="${minecraft_version_range}"
    ordering="NONE"
    side="BOTH"
```

Champs importants :

- **`modId`** doit être **identique** à `mod_id` de `gradle.properties`.
- **`side`** : `BOTH`, `CLIENT` ou `SERVER`. Indique où le mod est requis.
- **`type`** : `required`, `optional`, `incompatible`, `discouraged`.
- **`versionRange`** : notation Maven — `[47,)` = « 47 ou plus », `[1.20.1,1.21)` = « 1.20.1 inclus jusqu'à 1.21 exclu ».

> :attention: Depuis Forge 47, `type="required"` remplace l'ancien `mandatory=true`. Les deux fonctionnent encore en 1.20.1, mais utilisez `type`.

## `pack.mcmeta`

Déclare la version de format des packs. Pour 1.20.1 :

```json
{
  "pack": {
    "description": "Ressources de Mon Mod",
    "pack_format": 15
  }
}
```

`pack_format` **15** correspond à 1.20.1. (Il change à chaque version majeure de Minecraft.)

## Le dossier `src/generated/`

Sortie de la **génération de données**. Deux stratégies d'équipe (à choisir et documenter) :

1. **Committer `src/generated/resources/`** (sauf `.cache/`) : le build ne dépend pas de `runData`, la CI est simple. Défaut du MDK.
2. **Ignorer tout `src/generated/`** et lancer `runData` avant chaque build (localement et en CI). Diffs plus propres, mais process plus lourd.

Voir [Datagen](#/datagen) et [Git](#/git).

## Le dossier `run/`

Créé au premier `runClient`. Contient un Minecraft complet de test : `saves/`, `logs/`, `options.txt`, `crash-reports/`, `config/`… **Jamais committé.** Chaque développeur a le sien.

## Ce qui se retrouve dans le `.jar` final

`./gradlew build` produit `build/libs/monmod-<version>.jar` contenant :

- vos `.class` compilées depuis `src/main/java/` ;
- tout `src/main/resources/` ;
- `src/generated/resources/` (grâce à la ligne `sourceSets.main.resources { srcDir ... }`).

Il ne contient **pas** Forge ni Minecraft : ce sont des dépendances fournies par le *mod loader* chez le joueur.

Page suivante : **[IntelliJ IDEA](#/intellij)**.
