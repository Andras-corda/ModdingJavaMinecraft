# Bonnes pratiques (checklist)

Récapitulatif transversal. Utilisez-le comme liste de contrôle avant chaque *pull request* et avant chaque release.

## Projet & versions

- [ ] `mod_id` défini une seule fois, en `public static final String`, réutilisé partout.
- [ ] `mod_id` = `mod_id` (gradle.properties) = `modId` (mods.toml) = préfixe des `ResourceLocation`.
- [ ] Versions Minecraft / Forge / mappings **figées** dans `gradle.properties` et **identiques** pour toute l'équipe.
- [ ] *Gradle wrapper* committé (`gradlew`, `gradlew.bat`, `gradle/wrapper/`).
- [ ] Toolchain Java 17 dans `build.gradle` ; personne ne compile avec un autre JDK.
- [ ] On lance **`./gradlew`**, jamais un Gradle système.
- [ ] `mods.toml` : dépendances `forge` et `minecraft` déclarées avec des `versionRange` corrects.
- [ ] `pack.mcmeta` : `pack_format` = 15 (pour 1.20.1).

## Enregistrement (registries)

- [ ] Tout passe par `DeferredRegister` ; aucun `new Block()/new Item()` dans un bloc `static {}`.
- [ ] Chaque `DeferredRegister` est bien `.register(modEventBus)` dans le constructeur `@Mod`.
- [ ] Aucun `RegistryObject.get()` appelé dans le constructeur ou pendant l'enregistrement.
- [ ] Les identifiants (`"sapphire_ore"`, etc.) sont considérés **définitifs** : pas de renommage après la première release publique.
- [ ] Un `DeferredRegister` par domaine (`ModItems`, `ModBlocks`, `ModBlockEntities`…) pour limiter les conflits Git.
- [ ] Chaque bloc a son `BlockItem` si on veut pouvoir le placer.

## Côtés client / serveur

- [ ] Aucune référence à `net.minecraft.client.*` depuis une classe chargée sur le serveur dédié.
- [ ] Code de rendu isolé dans un paquet `client/`, appelé uniquement via `FMLClientSetupEvent`, `@EventBusSubscriber(value = Dist.CLIENT)` ou `DistExecutor`.
- [ ] `level.isClientSide()` testé avant toute modification du monde.
- [ ] Le serveur valide **toutes** les données reçues du client (distance, permissions, bornes).
- [ ] Pas de logique de jeu dans du code client (le client ne fait qu'afficher et demander).

## Ressources & données

- [ ] `en_us.json` **complet** (langue de repli). Autres langues ajoutées ensuite.
- [ ] Aucun texte affiché en dur : `Component.translatable("clé")` partout.
- [ ] Chaque bloc : blockstate + modèle de bloc + **modèle d'item**.
- [ ] Chaque bloc plaçable/minable : table de butin + tags (`mineable/*`, `needs_*_tool`).
- [ ] Datagen utilisée pour tous les JSON réguliers ; `runData` relancé avant chaque commit qui touche au contenu.
- [ ] On étend les tags vanilla via `data/minecraft/tags/...` dans son mod, pas de copie manuelle.
- [ ] Aucun fichier de `src/generated/` modifié à la main.
- [ ] Textures en PNG, tailles cohérentes (16×16 par défaut).

## Performance

- [ ] Pas d'allocation d'objets dans les méthodes appelées à chaque tick (`tick`, `animateTick`, événements de tick).
- [ ] Pas de `Level#getBlockEntity` / recherche coûteuse en boucle serrée : mettre en cache.
- [ ] Pas de parcours de tout l'inventaire / de toutes les entités à chaque tick sans nécessité.
- [ ] `RegistryObject.get()` mis en cache dans une variable locale si utilisé plusieurs fois.
- [ ] Logs `debug`/`trace` derrière `LOGGER.isDebugEnabled()` s'ils construisent une grosse chaîne.
- [ ] Pas de lecture de fichier / accès réseau sur le thread principal du jeu.

## Configuration

- [ ] `ForgeConfigSpec` pour toute valeur ajustable ; pas de constantes « magiques » éparpillées.
- [ ] Portée `SERVER` pour l'équilibrage (synchronisée, par-monde) ; `CLIENT` pour l'affichage.
- [ ] Config lue seulement après `FMLCommonSetupEvent` ; jamais mise en cache dans un `static` trop tôt.
- [ ] Valeurs bornées (`defineInRange`, `defineList` avec validateur).

## Réseau

- [ ] Un `SimpleChannel` par mod, version de protocole déclarée.
- [ ] Dans `handle`, côté serveur : `getSender() != null`, vérification distance/permission, `setPacketHandled(true)`.
- [ ] Payload minimal (envoyer un `BlockPos`, pas tout un objet).
- [ ] Jamais de logique exécutée hors de `ctx.enqueueWork(...)`.

## Mixins & Access Transformers

- [ ] Utilisés **en dernier recours**, quand l'API Forge ne suffit pas.
- [ ] Mixins les plus fins possibles (`@Inject` ciblé plutôt que `@Overwrite`).
- [ ] Chaque mixin commenté : pourquoi, quel comportement, quels risques de conflit.
- [ ] `refmap` et `mixins.json` configurés ; testé en environnement de production (jar), pas seulement en dev.
- [ ] AT (`accesstransformer.cfg`) : uniquement les entrées nécessaires, commentées.

## Qualité de code

- [ ] `.editorconfig` respecté ; Spotless (`spotlessApply`) exécuté avant commit.
- [ ] `spotlessCheck` (ou équivalent) en CI, bloquant.
- [ ] Classes utilitaires `final` avec constructeur privé.
- [ ] Javadoc sur les éléments publics réutilisables (API du mod).
- [ ] Pas de `System.out.println` ; `LOGGER` uniquement.
- [ ] Warnings du compilateur traités (ou justifiés).
- [ ] (Idéalement) quelques **GameTests** pour les mécaniques critiques.

## Git & collaboration

- [ ] `run/`, `build/`, `.gradle/`, `.idea/`, `.vscode/` ignorés.
- [ ] Décision `src/generated/` (committer / ignorer) prise **et documentée** dans `CONTRIBUTING.md`.
- [ ] `main` protégé : PR obligatoire, CI verte, ≥ 1 revue.
- [ ] Une branche = une fonctionnalité ; `main` toujours compilable.
- [ ] Commits en Conventional Commits.
- [ ] Montées de version Forge/MC/mappings dans un commit dédié, annoncé.
- [ ] Reformatages massifs séparés du code fonctionnel.

## Distribution

- [ ] `LICENSE` présent ; `mod_license` renseigné ; licence des assets précisée.
- [ ] `CHANGELOG.md` tenu à jour.
- [ ] Versionnage SemVer (`MAJEUR.MINEUR.CORRECTIF`), éventuellement préfixé de la version du jeu.
- [ ] Le mod testé **en tant que jar** (pas seulement en dev) : `build/libs/*.jar` copié dans un profil Forge réel.
- [ ] Testé sur **serveur dédié** en plus du solo.
- [ ] Tokens d'API (Modrinth/CurseForge) en secrets CI, jamais committés.
- [ ] `mods.toml` : `displayName`, `description`, `authors`, `issueTrackerURL` remplis.

## Compatibilité

- [ ] Dépendances optionnelles gérées avec `ModList.get().isLoaded("autremod")` avant d'appeler leur API.
- [ ] Intégrations (JEI, énergie…) dans des classes isolées, chargées conditionnellement.
- [ ] Pas d'hypothèse sur l'ordre de chargement des mods (`FMLCommonSetupEvent` est parallèle).
- [ ] Recettes/tags pensés pour cohabiter (utiliser des tags plutôt que des items précis).

## Avant chaque release — mini-procédure

1. `git switch main && git pull`
2. `./gradlew runData` (si option « committer »)
3. `./gradlew spotlessApply`
4. `./gradlew clean build`
5. Test `runClient` **et** `runServer`.
6. Test du **jar** dans un profil Forge réel.
7. Bump `mod_version`, mise à jour `CHANGELOG.md`.
8. `git commit -m "chore(release): X.Y.Z"`, `git tag vX.Y.Z`, `git push --tags`.

Page suivante : **[Tester son mod](#/tests)**.
