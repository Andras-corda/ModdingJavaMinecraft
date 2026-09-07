# Ressources & liens utiles

## Documentation officielle

- **Forge — Documentation 1.20.1** : [docs.minecraftforge.net/en/1.20.1/](https://docs.minecraftforge.net/en/1.20.1/)
  Référence de base : cycle de vie, registres, events, datagen, réseau, capabilities.
- **Forge — Téléchargements (MDK)** : [files.minecraftforge.net](https://files.minecraftforge.net/net/minecraftforge/forge/)
- **Forge — Dépôt GitHub** : [github.com/MinecraftForge/MinecraftForge](https://github.com/MinecraftForge/MinecraftForge)
- **Forums Forge** : [forums.minecraftforge.net](https://forums.minecraftforge.net/) — section « Support & Bug Reports ».
- **Javadoc Forge** : liée depuis la doc officielle (utile pour explorer l'API events).

## Mappings

- **Parchment (ParchmentMC)** : [parchmentmc.org](https://parchmentmc.org/) — noms de paramètres + Javadoc. Voir [docs](https://parchmentmc.org/docs/getting-started).
- **Versions Parchment disponibles** : [parchmentmc.org/docs/getting-started#choosing-a-version](https://parchmentmc.org/docs/getting-started) (pour 1.20.1, ex. `2023.09.03-1.20.1`).

## Apprentissage & tutoriels

- **Forge Community Wiki** : [forge.gemwire.uk](https://forge.gemwire.uk/wiki/Main_Page) — complément communautaire à la doc officielle, souvent plus pédagogique.
- **Kaupenjoe (McJty-style) — YouTube & GitHub** : séries de tutoriels Forge 1.20.1 (blocs, machines, réseau). Vérifiez toujours que la vidéo cible bien **1.20.1**.
- **McJty Modding Tutorials** : [github.com/McJty](https://github.com/McJty) — exemples de code de référence, propres.
- **Blessé par l'obfuscation ?** Lisez la page « Non-Forge to Forge » et « Understanding Sides » de la doc officielle.

## Outils

- **Eclipse Temurin (JDK 17)** : [adoptium.net](https://adoptium.net/temurin/releases/?version=17)
- **IntelliJ IDEA Community** : [jetbrains.com/idea/download](https://www.jetbrains.com/idea/download/)
- **Plugin Minecraft Development (IntelliJ)** : [plugins.jetbrains.com/plugin/8327](https://plugins.jetbrains.com/plugin/8327-minecraft-development)
- **VS Code — Extension Pack for Java** : [marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack)
- **Blockbench** (modèles & textures de blocs/items/entités) : [blockbench.net](https://www.blockbench.net/) — chapitre dédié : [Modélisation & texturing](#/blockbench-prise-en-main)
- **Lospec** (palettes de pixel art) : [lospec.com/palette-list](https://lospec.com/palette-list)
- **MCreator** : [mcreator.net](https://mcreator.net/) — générateur visuel ; utile pour prototyper, mais ce guide vise le code direct.

## Bibliothèques & intégrations courantes

Intégration détaillée dans le chapitre **[Bibliothèques tierces](#/librairies-tierces)**.

- **GeckoLib** — animations : [wiki](https://github.com/bernie-g/geckolib/wiki) · [Modrinth](https://modrinth.com/mod/geckolib)
- **Pehkui** — mise à l'échelle des entités : [wiki](https://github.com/Virtuoel/Pehkui/wiki) · [Modrinth](https://modrinth.com/mod/pehkui)
- **JEI (Just Enough Items)** — viewer de recettes : [wiki](https://github.com/mezz/JustEnoughItems/wiki)
- **Curios API** — emplacements d'équipement : [wiki](https://github.com/TheIllusiveC4/Curios/wiki)
- **Patchouli** — livres de guide en jeu : [doc](https://vazkiimods.github.io/Patchouli/)
- **Cloth Config API** — écrans de configuration : [doc](https://shedaniel.gitbook.io/cloth-config/)
- **The One Probe** / **Jade** — infobulle d'information : [TOP](https://github.com/McJtyMods/TheOneProbe) · [Jade](https://github.com/Snownee/Jade)
- **Registrate** — enregistrement concis : [github.com/tterrag1098/Registrate](https://github.com/tterrag1098/Registrate)

## Publication

- **Modrinth** : [modrinth.com](https://modrinth.com/) — plateforme ouverte, API simple.
- **Minotaur (plugin Gradle Modrinth)** : [github.com/modrinth/minotaur](https://github.com/modrinth/minotaur)
- **CurseForge** : [curseforge.com](https://www.curseforge.com/) — plus grande audience.
- **CurseGradle** : [github.com/matthewprenger/CurseGradle](https://github.com/matthewprenger/CurseGradle)
- **choosealicense.com** : [choosealicense.com](https://choosealicense.com/) — pour la licence.
- **Keep a Changelog** : [keepachangelog.com/fr](https://keepachangelog.com/fr/1.0.0/)
- **Conventional Commits** : [conventionalcommits.org/fr](https://www.conventionalcommits.org/fr/v1.0.0/)

## Git & GitHub

- **Pro Git (livre, gratuit, en français)** : [git-scm.com/book/fr/v2](https://git-scm.com/book/fr/v2)
- **GitHub Actions — documentation** : [docs.github.com/actions](https://docs.github.com/fr/actions)
- **`gradle/actions` (setup-gradle)** : [github.com/gradle/actions](https://github.com/gradle/actions)
- **GitHub Pages — documentation** : [docs.github.com/pages](https://docs.github.com/fr/pages)
- **pre-commit** : [pre-commit.com](https://pre-commit.com/)
- **Spotless** : [github.com/diffplug/spotless](https://github.com/diffplug/spotless)

## Communautés

- **Discord officiel Forge** : lien depuis [minecraftforge.net](https://minecraftforge.net/) — canal `#modder-support`.
- **Discord Modded Minecraft (MMD)** : grande communauté d'entraide.
- **r/feedthebeast** et **r/Minecraft** (Reddit) — pour la visibilité, moins pour le support technique.

## Et pour la suite (autres versions)

- **NeoForge** (fork de Forge depuis 1.20.2) : [neoforged.net](https://neoforged.net/) et [docs.neoforged.net](https://docs.neoforged.net/). Migration `net.minecraftforge.*` → `net.neoforged.*`, système d'events revu. Les principes de ce guide (structure, datagen, Git, CI) restent valables.

---

> :info: Les API de modding bougent vite. Avant de suivre un tutoriel, **vérifiez la version ciblée**. Un exemple 1.19.2 ou 1.20.4 ne compilera pas tel quel en 1.20.1.

Retour à l'**[introduction](#/accueil)**.
