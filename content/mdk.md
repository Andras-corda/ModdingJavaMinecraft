# Le MDK Forge & Gradle

Le **MDK** (*Mod Development Kit*) est le projet de démarrage officiel de Forge : un dossier Gradle préconfiguré avec un mod d'exemple.

## 1. Télécharger le MDK 1.20.1

1. Allez sur **[files.minecraftforge.net](https://files.minecraftforge.net/)**.
2. Dans la colonne de gauche, sélectionnez **Minecraft 1.20.1**.
3. Cliquez sur **MDK** (bouton « Mdk » sous *Download Latest* ou *Download Recommended*).
4. Le lien ouvre une page publicitaire : cliquez sur **SKIP** en haut à droite pour lancer le vrai téléchargement.
5. Vous obtenez un zip du type `forge-1.20.1-47.3.0-mdk.zip`.

> :info: **Latest** vs **Recommended** : pour 1.20.1, la branche est stable depuis longtemps ; prenez la dernière `47.x` disponible. Notez bien le numéro (ex. `47.3.0`) : il ira dans `gradle.properties`.

## 2. Extraire proprement

Créez un dossier vide pour le projet (ex. `C:\Users\vous\Documents\Dev\MonMod\`) et extrayez-y le **contenu** du zip (pas le dossier `forge-…-mdk` imbriqué).

Vous devez voir à la racine :

```text
MonMod/
├── build.gradle
├── gradle.properties
├── settings.gradle
├── gradlew
├── gradlew.bat
├── gradle/
│   └── wrapper/
├── src/
│   └── main/
│       ├── java/com/example/examplemod/ExampleMod.java
│       └── resources/META-INF/mods.toml
├── LICENSE.txt
└── changelog.txt
```

Supprimez `LICENSE.txt` et `changelog.txt` (ils concernent le MDK, pas votre mod) et ajoutez **votre** licence plus tard.

## 3. Fichiers à connaître

### `gradle.properties` — les variables du projet

C'est **le seul fichier que vous éditez au démarrage**. Exemple commenté pour 1.20.1 :

```properties
# Options Gradle
org.gradle.jvmargs=-Xmx3G
org.gradle.daemon=false
org.gradle.parallel=true
org.gradle.caching=true

# Versions Minecraft / Forge — NE PAS diverger dans l'équipe
minecraft_version=1.20.1
minecraft_version_range=[1.20.1,1.21)
forge_version=47.3.0
forge_version_range=[47,)
loader_version_range=[47,)

# Mappings — identiques pour toute l'équipe
mapping_channel=official
mapping_version=1.20.1

# Identité du mod
mod_id=examplemod
mod_name=Example Mod
mod_license=MIT
mod_version=1.0.0
mod_group_id=com.example.examplemod
mod_authors=VotreÉquipe
mod_description=Un mod d'exemple pour Minecraft 1.20.1.
```

À changer **avant le premier build** :

- **`mod_id`** : minuscules, chiffres et `_` uniquement, 2 à 64 caractères. **Définitif.** Ex. `oremagic`.
- **`mod_group_id`** : votre paquet Java racine, en notation inversée. Ex. `fr.monequipe.oremagic`.
- `mod_name`, `mod_authors`, `mod_description`, `mod_license` : cosmétique, modifiable plus tard.
- `mod_version` : commencez à `0.1.0` (voir [versionnage](#/github)).

> :attention: Après avoir changé `mod_id` et `mod_group_id`, **renommez aussi** le dossier `src/main/java/com/example/examplemod/` et le paquet dans `ExampleMod.java` pour qu'ils correspondent. Sinon, tout compile mais l'organisation devient trompeuse.

### `build.gradle` — le script de build

Vous y toucherez rarement. Les points importants pour 1.20.1 :

```gradle
plugins {
    id 'eclipse'
    id 'idea'
    id 'maven-publish'
    id 'net.minecraftforge.gradle' version '[6.0,6.2)'
}

version = mod_version
group = mod_group_id
base.archivesName = mod_id

java.toolchain.languageVersion = JavaLanguageVersion.of(17)

minecraft {
    mappings channel: mapping_channel, version: mapping_version

    // Décommentez pour que les ressources soient sur le classpath quand
    // vous lancez le jeu depuis l'IDE (utile en équipe, cf. datagen).
    // copyIdeResources = true

    runs {
        client {
            workingDirectory project.file('run')
            property 'forge.logging.markers', 'REGISTRIES'
            property 'forge.logging.console.level', 'debug'
            mods { "${mod_id}" { source sourceSets.main } }
        }
        server {
            workingDirectory project.file('run')
            property 'forge.logging.console.level', 'debug'
            mods { "${mod_id}" { source sourceSets.main } }
        }
        data {
            workingDirectory project.file('run')
            args '--mod', mod_id,
                 '--all',
                 '--output', file('src/generated/resources/'),
                 '--existing', file('src/main/resources/')
            mods { "${mod_id}" { source sourceSets.main } }
        }
    }
}

// Rend le dossier de datagen visible comme ressources.
sourceSets.main.resources { srcDir 'src/generated/resources' }

repositories {
    // Ajoutez ici les dépôts de mods dont vous dépendez (JEI, etc.)
}

dependencies {
    minecraft "net.minecraftforge:forge:${minecraft_version}-${forge_version}"
}
```

### `settings.gradle`

Contient les dépôts de plugins et le nom du projet. En général on n'y touche que pour ajouter Parchment (voir ci-dessous).

### Le *wrapper* Gradle

`gradlew`, `gradlew.bat` et `gradle/wrapper/gradle-wrapper.properties` (+ `.jar`) : **à committer tels quels**. Ils garantissent que toute l'équipe et la CI utilisent Gradle 8.1.1.

## 4. (Optionnel mais recommandé) Passer aux mappings Parchment

Parchment ajoute les **noms de paramètres** et de la **Javadoc**. Dans `settings.gradle`, ajoutez le dépôt :

```gradle
pluginManagement {
    repositories {
        gradlePluginPortal()
        maven { url = 'https://maven.minecraftforge.net/' }
        maven { url = 'https://maven.parchmentmc.org' }   // <— ajout
    }
}
```

Dans `build.gradle`, ajoutez le plugin *librarian* et changez le canal :

```gradle
plugins {
    // ...
    id 'net.minecraftforge.gradle' version '[6.0,6.2)'
    id 'org.parchmentmc.librarian.forgegradle' version '1.+'   // <— ajout
}

minecraft {
    mappings channel: 'parchment', version: '2023.09.03-1.20.1'
    // ...
}
```

Puis `./gradlew --refresh-dependencies`. Toute l'équipe doit faire ce changement **en même temps** (idéalement dans le même commit).

## 5. Premier build

Dans le dossier du projet :

```bash
./gradlew build
```

Le premier lancement télécharge Minecraft, Forge, les librairies et **décompile le jeu**. Comptez **5 à 15 minutes**. À la fin :

```text
BUILD SUCCESSFUL in 7m 21s
```

Le mod compilé est dans **`build/libs/examplemod-1.0.0.jar`**.

## 6. Lancer le jeu

```bash
./gradlew runClient
```

Minecraft démarre. Dans **Mods**, vous devez voir « Example Mod ». En jeu, un bloc et un item d'exemple existent déjà.

> :astuce: Le monde de test, les logs et les options sont dans le dossier **`run/`**. Ce dossier ne doit **jamais** être committé (voir [Git](#/git)).

## 7. Nettoyer l'exemple

Une fois que tout fonctionne, dans `ExampleMod.java` :

- gardez la structure (constructeur, `@Mod`, logger) ;
- supprimez ou commentez le contenu d'exemple (bloc `EXAMPLE_BLOCK`, item `EXAMPLE_ITEM`, l'onglet, les abonnements de démonstration) ;
- vous repartirez proprement dans [La classe principale du mod](#/classe-principale).

## Problèmes fréquents au premier build

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `Could not determine java version` / build échoue tout de suite | Gradle utilise Java 21+ | Forcez un JDK 17 (voir [JDK](#/jdk)) |
| `Could not resolve net.minecraftforge:forge:1.20.1-...` | `forge_version` erroné, ou coupure réseau | Vérifiez le numéro, relancez avec `--refresh-dependencies` |
| Très lent puis échec sur `MCPConfig` / décompilation | Manque de RAM allouée à Gradle | `org.gradle.jvmargs=-Xmx3G` (ou plus) dans `gradle.properties` |
| `peer not authenticated` / erreurs SSL | Proxy ou antivirus d'entreprise | Configurez le proxy Gradle, ou testez hors du réseau d'entreprise |

Détails supplémentaires : [Débogage & problèmes fréquents](#/debogage).

Page suivante : **[Anatomie d'un projet Forge](#/structure)**.
