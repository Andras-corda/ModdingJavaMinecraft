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
│   │   │       ├── Config.java            # config du mod (ForgeConfigSpec) — fourni par le MDK
│   │   │       ├── registry/
│   │   │       │   ├── ModBlocks.java
│   │   │       │   ├── ModItems.java
│   │   │       │   └── ModCreativeTabs.java
│   │   │       ├── block/                 # classes de blocs custom
│   │   │       ├── item/                  # classes d'items custom
│   │   │       ├── client/                # code CLIENT UNIQUEMENT
│   │   │       ├── datagen/               # providers de datagen
│   │   │       └── network/               # paquets réseau
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

## `Config.java` — la config d'exemple du MDK

Le MDK fournit, **à côté de `ExampleMod.java`**, une classe `Config.java`. Elle n'est **pas obligatoire** mais montre comment déclarer une configuration lisible/éditable par le joueur, via l'API **`ForgeConfigSpec`** de Forge. Forge se charge de créer le fichier, de le charger, de le valider et de le recharger.

### Le fichier du MDK (traduit et commenté)

```java
package com.example.examplemod;

import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraftforge.common.ForgeConfigSpec;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.config.ModConfigEvent;
import net.minecraftforge.registries.ForgeRegistries;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mod.EventBusSubscriber(modid = ExampleMod.MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
public class Config {

    // 1. Un "builder" qui accumule les déclarations de valeurs
    private static final ForgeConfigSpec.Builder BUILDER = new ForgeConfigSpec.Builder();

    // 2. Chaque valeur : type, commentaire (-> écrit dans le .toml), clé, défaut, bornes
    private static final ForgeConfigSpec.BooleanValue LOG_DIRT_BLOCK = BUILDER
            .comment("Journaliser le bloc de terre au démarrage")
            .define("logDirtBlock", true);

    private static final ForgeConfigSpec.IntValue MAGIC_NUMBER = BUILDER
            .comment("Un nombre magique")
            .defineInRange("magicNumber", 42, 0, Integer.MAX_VALUE);

    public static final ForgeConfigSpec.ConfigValue<String> MAGIC_NUMBER_INTRODUCTION = BUILDER
            .comment("Le message d'introduction du nombre magique")
            .define("magicNumberIntroduction", "Le nombre magique est... ");

    // Une liste, avec un validateur appliqué à chaque élément
    private static final ForgeConfigSpec.ConfigValue<List<? extends String>> ITEM_STRINGS = BUILDER
            .comment("Une liste d'items à journaliser au démarrage.")
            .defineListAllowEmpty("items", List.of("minecraft:iron_ingot"), Config::validateItemName);

    // 3. On "ferme" le builder : SPEC est ce qu'on enregistre auprès de Forge
    static final ForgeConfigSpec SPEC = BUILDER.build();

    // 4. Des champs simples, remplis une fois au chargement (voir onLoad).
    //    Le code du jeu lit `Config.magicNumber` — pas de `.get()` à chaque appel.
    public static boolean logDirtBlock;
    public static int magicNumber;
    public static String magicNumberIntroduction;
    public static Set<Item> items;

    private static boolean validateItemName(final Object obj) {
        return obj instanceof final String itemName
                && ForgeRegistries.ITEMS.containsKey(new ResourceLocation(itemName));
    }

    // 5. Appelé par Forge à chaque (re)chargement de la config
    @SubscribeEvent
    static void onLoad(final ModConfigEvent event) {
        logDirtBlock = LOG_DIRT_BLOCK.get();
        magicNumber = MAGIC_NUMBER.get();
        magicNumberIntroduction = MAGIC_NUMBER_INTRODUCTION.get();
        items = ITEM_STRINGS.get().stream()
                .map(name -> ForgeRegistries.ITEMS.getValue(new ResourceLocation(name)))
                .collect(Collectors.toSet());
    }
}
```

### Ce qu'il faut retenir du pattern

1. **`BUILDER`** accumule les déclarations. Chaque `.define(...)` renvoie un objet (`BooleanValue`, `IntValue`, `ConfigValue<T>`…) qu'on garde.
2. **`.comment(...)`** devient un commentaire dans le fichier `.toml` — soignez-le, c'est la doc que verra le joueur.
3. **`SPEC = BUILDER.build()`** fige la spécification. C'est `SPEC` qu'on enregistre.
4. Le **`@Mod.EventBusSubscriber(bus = MOD)`** + **`onLoad(ModConfigEvent)`** recopie les valeurs dans des champs `static` simples, **une seule fois** au chargement. Le reste du code lit `Config.magicNumber` directement.
5. `defineInRange` (bornes), `defineListAllowEmpty` (+ validateur par élément), `defineEnum`, `defineList`… voir [Config, commandes & réseau](#/config-reseau).

### L'enregistrement, dans `ExampleMod.java`

Le constructeur `@Mod` contient :

```java
// Demande à Forge de créer et charger le fichier de config du mod
ModLoadingContext.get().registerConfig(ModConfig.Type.COMMON, Config.SPEC);
```

### Le fichier généré

Au premier lancement, Forge écrit **`run/config/examplemod-common.toml`** :

```toml
#Journaliser le bloc de terre au démarrage
logDirtBlock = true
#Un nombre magique
#Range: 0 ~ 2147483647
magicNumber = 42
#Le message d'introduction du nombre magique
magicNumberIntroduction = "Le nombre magique est... "
#Une liste d'items à journaliser au démarrage.
items = ["minecraft:iron_ingot"]
```

Le joueur édite ce fichier ; `/reload` ou un redémarrage applique les changements (et `onLoad` est rappelé).

### `COMMON`, `CLIENT` ou `SERVER` ?

`registerConfig` prend un **type** qui décide où et comment la config vit :

| Type | Fichier | Portée |
|------|---------|--------|
| `COMMON` | `run/config/<modid>-common.toml` | client **et** serveur, non synchronisé — pour ce qui ne touche pas au réseau |
| `CLIENT` | `run/config/<modid>-client.toml` | client seulement — affichage, sons, raccourcis |
| `SERVER` | `<monde>/serverconfig/<modid>-server.toml` | serveur, **synchronisé au client**, **par monde** — équilibrage, règles de jeu |

Le MDK utilise `COMMON`. Détails et exemples avancés : [Config, commandes & réseau](#/config-reseau).

> :astuce: Vous pouvez garder `Config.java` comme **modèle** (remplacez `logDirtBlock`/`magicNumber` par vos vraies options) ou le **supprimer** si votre mod n'a pas encore de config — dans ce cas, retirez aussi la ligne `registerConfig(...)` de `ExampleMod.java`.

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
