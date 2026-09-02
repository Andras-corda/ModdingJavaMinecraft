# Bibliothèques tierces : le principe

Beaucoup de fonctionnalités (animations, mise à l'échelle, emplacements d'équipement, livre de guide, écran de config) sont **déjà résolues** par des bibliothèques matures. Les réécrire est une perte de temps et une source de bugs.

Cette section montre comment intégrer les plus courantes. D'abord, la méthode générale.

## Ajouter une dépendance de bibliothèque

Dans `build.gradle` :

```gradle
repositories {
    // Dépôts des bibliothèques (à ajouter selon les libs utilisées)
    maven { url = "https://maven.blamejared.com" }                      // JEI, Curios, Patchouli, GeckoLib(miroir)…
    maven { url = "https://dl.cloudsmith.io/public/geckolib3/geckolib/maven" }  // GeckoLib
    maven { url = "https://maven.shedaniel.me/" }                        // Cloth Config
    maven { url = "https://api.modrinth.com/maven" }                    // n'importe quel mod publié sur Modrinth
    maven { url = "https://www.cursemaven.com" }                         // n'importe quel mod CurseForge
}

dependencies {
    minecraft "net.minecraftforge:forge:${minecraft_version}-${forge_version}"

    // Bibliothèque « dure » : requise à la compilation ET à l'exécution
    implementation fg.deobf("software.bernie.geckolib:geckolib-forge-1.20.1:4.4.9")

    // Bibliothèque « douce » : API à la compilation, mod complet seulement pour tester
    compileOnly  fg.deobf("mezz.jei:jei-1.20.1-forge-api:15.20.0.106")
    runtimeOnly  fg.deobf("mezz.jei:jei-1.20.1-forge:15.20.0.106")
}
```

- **`fg.deobf(...)`** : indispensable — déobfusque le jar de la bibliothèque pour l'environnement de dev.
- **`implementation`** : dans le classpath de compilation et d'exécution.
- **`compileOnly` + `runtimeOnly`** : l'API pour compiler, le mod complet seulement en jeu (utile pour les dépendances optionnelles : on code contre l'API sans forcer sa présence chez le joueur).

> :attention: **Les numéros de version bougent vite.** Prenez la version qui correspond **exactement** à `1.20.1` sur la page CurseForge / Modrinth de la bibliothèque, et notez-la dans `gradle.properties` pour toute l'équipe.

## `gradle.properties` : centraliser les versions

```properties
geckolib_version=4.4.9
jei_version=15.20.0.106
curios_version=5.11.0
patchouli_version=1.20.1-84
cloth_config_version=11.1.136
pehkui_version=3.8.3
```

```gradle
implementation fg.deobf("software.bernie.geckolib:geckolib-forge-1.20.1:${geckolib_version}")
```

## Déclarer la dépendance dans `mods.toml`

Pour qu'un joueur ait un message clair si la bibliothèque manque :

```toml
[[dependencies.monmod]]
    modId="geckolib"
    type="required"           # ou "optional"
    versionRange="[4.4,)"
    ordering="AFTER"
    side="BOTH"
```

## Dure ou douce ?

| Cas | Choix |
|-----|-------|
| La lib est au cœur du mod (toutes vos entités animées avec GeckoLib) | **dure** : `implementation` + `type="required"` |
| La lib ajoute un bonus (intégration JEI, slot Curios facultatif) | **douce** : `compileOnly`/`runtimeOnly` + `type="optional"` + garde `ModList.get().isLoaded(...)` |

Pour la méthode d'isolation des dépendances douces (classe séparée, `isLoaded`), voir [Compatibilité entre mods](#/compatibilite).

## `jarJar` : embarquer une petite lib dans son jar

Pour une **petite** bibliothèque utilitaire (pas GeckoLib, trop grosse), Forge permet de l'inclure dans votre jar avec **jarJar** :

```gradle
jarJar.enable()

dependencies {
    jarJar(group: 'com.example', name: 'tinylib', version: '[1.0,2.0)') {
        jarJar.pin(it, '1.0.3')
    }
}

tasks.named('jar') {
    // le jar de sortie contient META-INF/jarjar/
}
```

À réserver aux **vraies petites** libs sans mod complet publié. Pour tout le reste, dépendance normale + le joueur installe la lib.

## Bibliothèques couvertes dans cette section

| Bibliothèque | Pour |
|--------------|------|
| **[GeckoLib](#/geckolib)** | animations d'entités, blocs, items, armures (modèles Blockbench) |
| **[Pehkui](#/pehkui)** | mettre les entités à l'échelle (grandir / rétrécir) |
| **[JEI](#/jei)** | afficher vos recettes de machine dans le viewer |
| **[Curios](#/curios)** | emplacements d'équipement (amulette, ceinture, bague…) |
| **[Patchouli](#/patchouli)** | livre de guide en jeu, en JSON |
| **[Cloth Config](#/cloth-config)** | écran de configuration généré |

## Autres bibliothèques utiles (non détaillées ici)

- **The One Probe / Jade / WTHIT** — infobulle d'information en visant un bloc.
- **Architectury API** — écrire un mod multi-loader (Forge + Fabric).
- **Registrate** — enregistrement de contenu plus concis (blocs + items + datagen d'un coup).
- **Cardinal Components / (Forge : capabilities natives)** — données attachées.
- **Owo-lib** (Fabric surtout), **Silk**, **Kotlin for Forge** (si vous codez en Kotlin).
- **Forge Config API / Night Config** — déjà inclus dans Forge.

Page suivante : **[GeckoLib : animations](#/geckolib)**.
