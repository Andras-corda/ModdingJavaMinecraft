# Créer un mod Minecraft Forge 1.20.1

Ce guide décrit **de A à Z** la création d'un mod pour **Minecraft Java Edition 1.20.1** avec **Minecraft Forge**, depuis l'installation des outils jusqu'à la publication, en passant par le **travail en équipe**.

Il est pensé pour être suivi aussi bien avec **IntelliJ IDEA** (JetBrains) qu'avec **Visual Studio Code**, et pour un projet partagé par **plusieurs développeurs** via Git/GitHub.

> :astuce: Vous débutez ? Suivez les pages dans l'ordre du menu. Vous cherchez un point précis ? Utilisez la recherche en haut de page.

## À qui s'adresse ce guide

- Vous savez programmer en **Java** (classes, interfaces, génériques, lambdas). Ce guide n'enseigne pas le langage.
- Vous avez déjà **joué à Minecraft** et installé des mods.
- Vous voulez une base **propre, reproductible et collaborative**, pas seulement « un mod qui compile ».

## Les versions utilisées

| Composant | Version | Remarque |
|-----------|---------|----------|
| Minecraft | **1.20.1** | Version cible du mod |
| Minecraft Forge | **47.x** (ex. `47.3.0`) | Prenez la version fournie avec le MDK que vous téléchargez |
| Java (JDK) | **17** (exactement) | Minecraft 1.20.1 tourne sur Java 17 ; pas 8, pas 21 |
| Gradle | **8.1.1** | Fourni par le *wrapper* du MDK, ne pas installer manuellement |
| ForgeGradle | `[6.0,6.2)` | Plugin Gradle, défini dans `build.gradle` |
| Mappings | `official` (Mojang) `1.20.1` | Ou [Parchment](https://parchmentmc.org/) pour des noms de paramètres |

> :attention: Un mod Forge 1.20.1 **n'est pas compatible** avec 1.20.2, 1.20.4, 1.21, etc. Chaque version de Minecraft casse l'API. Les concepts restent proches, mais le code doit être adapté.

## Ce que couvre ce guide

- **Démarrer** : environnement (JDK 17, MDK, Gradle), IntelliJ IDEA, VS Code, anatomie d'un projet.
- **Fondations** : classe `@Mod`, [catalogue des événements](#/evenements), [registres & tags](#/registres-tags), [NBT & Codecs](#/nbt-codecs).
- **Contenu — blocs & items** : [blocs & items](#/blocs-items), [blocs à états / formes / ticks](#/blocs-avances), [outils & armures](#/outils-armures), [nourriture & cultures](#/nourriture-cultures), [fluides](#/fluides).
- **Contenu — systèmes de jeu** : [enchantements](#/enchantements), [effets & potions](#/effets-potions), [recettes personnalisées](#/recettes-custom), [modificateurs de butin](#/loot-modifiers), [types de dégâts](#/degats-types).
- **Ressources & rendu** : [assets](#/ressources-assets), [datagen](#/datagen), [sons](#/sons), [particules](#/particules), [modèles & rendu](#/modeles-rendu), [overlays & HUD](#/overlays-hud).
- **Systèmes & interactions** : [config & réseau](#/config-reseau), [capabilities](#/capabilities), [commandes Brigadier](#/commandes-avancees), [écrans & widgets](#/gui-screens), [conteneurs & menus](#/conteneurs-menus), [IA & synchro d'entités](#/entites-ia-data).
- **Créatures & monde** : [IA des mobs en profondeur](#/ia-avancee), [élevage & apprivoisement](#/elevage-apprivoisement), [métiers & commerce des villageois](#/villageois-metiers), [créer un boss](#/boss), [structures & villages](#/structures).
- **Recettes concrètes** : [raycast](#/raycast), [items à comportement](#/item-comportement), [blocs avec interface](#/block-entity), [entités & projectiles](#/entite-projectile), [génération de minerai](#/worldgen-minerai), [raccourcis & HUD](#/hud-keybinds).
- **En équipe** : [Git](#/git), [GitHub : dépôt, CI, releases](#/github).
- **Aller plus loin** : [mixins](#/mixins), [access transformers](#/access-transformers), [compatibilité inter-mods](#/compatibilite).
- **Bibliothèques tierces** : [le principe](#/librairies-tierces), [GeckoLib](#/geckolib), [Pehkui](#/pehkui), [JEI](#/jei), [Curios](#/curios), [Patchouli](#/patchouli), [Cloth Config](#/cloth-config).
- **Qualité** : [bonnes pratiques](#/bonnes-pratiques), [tests](#/tests), [performance](#/performance), [débogage](#/debogage).

## Comment ce guide est construit

Le contenu de chaque page est stocké en **Markdown** dans le dossier [`content/`](https://github.com/VOTRE-UTILISATEUR/VOTRE-DEPOT/tree/main/content) du dépôt. Le site lui-même est **100 % statique** (HTML/CSS/JS, sans dépendance externe) et se publie sur **GitHub Pages**. Vous pouvez donc :

- corriger ou compléter une page en éditant un simple fichier `.md` ;
- proposer vos modifications par *pull request* ;
- réutiliser la mécanique pour votre propre documentation de mod.

> :info: Ce guide vise Forge « classique ». Pour NeoForge (le fork issu de Forge, à partir de 1.20.2), la démarche est très similaire mais les noms de paquets diffèrent (`net.neoforged.*`). Les principes de collaboration de ce guide restent valables tels quels.

## Par où commencer

Passez à la page suivante : **[Prérequis & concepts clés](#/prerequis)**.
