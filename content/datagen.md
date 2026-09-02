# Génération de données (datagen)

La **datagen** produit automatiquement les fichiers JSON (modèles, blockstates, recettes, tables de butin, tags, traductions) à partir de **code Java**. C'est fortement recommandé, surtout en équipe :

- Un seul endroit à modifier quand on renomme ou ajoute du contenu.
- **Beaucoup moins de conflits Git** : on modifie du `.java`, pas 40 petits `.json` que tout le monde touche.
- Impossible d'oublier un fichier : si le code compile et que `runData` passe, l'ensemble est cohérent.

Vous écrivez les *providers* ; `./gradlew runData` écrit les JSON dans `src/generated/resources/`.

## Point d'entrée : `GatherDataEvent`

`datagen/DataGenerators.java` :

```java
package fr.monequipe.monmod.datagen;

import fr.monequipe.monmod.MonMod;
import net.minecraft.data.DataGenerator;
import net.minecraft.data.PackOutput;
import net.minecraftforge.data.event.GatherDataEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
public final class DataGenerators {

    @SubscribeEvent
    public static void gather(GatherDataEvent event) {
        DataGenerator gen = event.getGenerator();
        PackOutput output = gen.getPackOutput();
        var lookup = event.getLookupProvider();
        var existingFileHelper = event.getExistingFileHelper();

        // CLIENT
        gen.addProvider(event.includeClient(), new ModItemModelProvider(output, existingFileHelper));
        gen.addProvider(event.includeClient(), new ModBlockStateProvider(output, existingFileHelper));
        gen.addProvider(event.includeClient(), new ModLanguageProvider(output, "en_us"));
        gen.addProvider(event.includeClient(), new ModLanguageProvider(output, "fr_fr"));

        // SERVEUR
        gen.addProvider(event.includeServer(), new ModRecipeProvider(output));
        gen.addProvider(event.includeServer(), ModLootTableProvider.create(output));
        ModBlockTagsProvider blockTags = new ModBlockTagsProvider(output, lookup, existingFileHelper);
        gen.addProvider(event.includeServer(), blockTags);
        gen.addProvider(event.includeServer(),
                new ModItemTagsProvider(output, lookup, blockTags.contentsGetter(), existingFileHelper));
    }

    private DataGenerators() {}
}
```

## Modèles d'items

```java
public class ModItemModelProvider extends ItemModelProvider {

    public ModItemModelProvider(PackOutput output, ExistingFileHelper helper) {
        super(output, MonMod.MODID, helper);
    }

    @Override
    protected void registerModels() {
        basicItem(ModItems.SAPPHIRE.get());
        basicItem(ModItems.SAPPHIRE_DUST.get());
        // Modèle d'item d'un bloc : hérite du modèle de bloc
        withExistingParent("sapphire_block", modLoc("block/sapphire_block"));
    }
}
```

## Blockstates + modèles de blocs

```java
public class ModBlockStateProvider extends BlockStateProvider {

    public ModBlockStateProvider(PackOutput output, ExistingFileHelper helper) {
        super(output, MonMod.MODID, helper);
    }

    @Override
    protected void registerStatesAndModels() {
        simpleBlockWithItem(ModBlocks.SAPPHIRE_BLOCK.get(),
                cubeAll(ModBlocks.SAPPHIRE_BLOCK.get()));
        simpleBlockWithItem(ModBlocks.SAPPHIRE_ORE.get(),
                cubeAll(ModBlocks.SAPPHIRE_ORE.get()));
    }
}
```

`simpleBlockWithItem` génère blockstate + modèle de bloc + modèle d'item d'un coup. Il faut juste fournir les textures `textures/block/sapphire_block.png` etc.

## Traductions

```java
public class ModLanguageProvider extends LanguageProvider {

    public ModLanguageProvider(PackOutput output, String locale) {
        super(output, MonMod.MODID, locale);
    }

    @Override
    protected void addTranslations() {
        boolean fr = false; // adaptez selon le "locale" reçu, ou faites 2 classes
        add("itemGroup.monmod.main", "Mon Mod");
        add(ModItems.SAPPHIRE.get(), "Saphir");
        add(ModItems.SAPPHIRE_DUST.get(), "Poudre de saphir");
        add(ModBlocks.SAPPHIRE_BLOCK.get(), "Bloc de saphir");
        add(ModBlocks.SAPPHIRE_ORE.get(), "Minerai de saphir");
    }
}
```

> :astuce: Le plus simple est **une classe par langue** (`ModEnUsProvider`, `ModFrFrProvider`), chacune passant son `locale` au constructeur et surchargeant `addTranslations()`.

## Recettes

```java
public class ModRecipeProvider extends RecipeProvider {

    public ModRecipeProvider(PackOutput output) { super(output); }

    @Override
    protected void buildRecipes(Consumer<FinishedRecipe> writer) {
        ShapedRecipeBuilder.shaped(RecipeCategory.BUILDING_BLOCKS, ModBlocks.SAPPHIRE_BLOCK.get())
                .pattern("SSS").pattern("SSS").pattern("SSS")
                .define('S', ModItems.SAPPHIRE.get())
                .unlockedBy("has_sapphire", has(ModItems.SAPPHIRE.get()))
                .save(writer);

        SimpleCookingRecipeBuilder.smelting(
                        Ingredient.of(ModItems.SAPPHIRE_DUST.get()),
                        RecipeCategory.MISC, ModItems.SAPPHIRE.get(), 0.7F, 200)
                .unlockedBy("has_dust", has(ModItems.SAPPHIRE_DUST.get()))
                .save(writer, "monmod:sapphire_from_smelting");
    }
}
```

## Tables de butin

```java
public class ModBlockLootTables extends BlockLootSubProvider {

    protected ModBlockLootTables() {
        super(Set.of(), FeatureFlags.REGISTRY.allFlags());
    }

    @Override
    protected void generate() {
        dropSelf(ModBlocks.SAPPHIRE_BLOCK.get());
        // Minerai : lâche la gemme, sensible à Fortune, ou le bloc avec Touch of Silk
        add(ModBlocks.SAPPHIRE_ORE.get(),
                block -> createOreDrop(block, ModItems.SAPPHIRE.get()));
    }

    @Override
    protected Iterable<Block> getKnownBlocks() {
        return ModBlocks.BLOCKS.getEntries().stream().map(RegistryObject::get)::iterator;
    }
}
```

## Tags

```java
public class ModBlockTagsProvider extends BlockTagsProvider {

    public ModBlockTagsProvider(PackOutput output, CompletableFuture<HolderLookup.Provider> lookup,
                                ExistingFileHelper helper) {
        super(output, lookup, MonMod.MODID, helper);
    }

    @Override
    protected void addTags(HolderLookup.Provider provider) {
        tag(BlockTags.MINEABLE_WITH_PICKAXE)
                .add(ModBlocks.SAPPHIRE_BLOCK.get(), ModBlocks.SAPPHIRE_ORE.get());
        tag(BlockTags.NEEDS_IRON_TOOL)
                .add(ModBlocks.SAPPHIRE_ORE.get());
    }
}
```

## Lancer la génération

```bash
./gradlew runData
```

Résultat dans `src/generated/resources/` :

```text
src/generated/resources/
├── .cache/                       # IGNORÉ par Git
├── assets/monmod/
│   ├── blockstates/*.json
│   ├── models/block/*.json
│   ├── models/item/*.json
│   └── lang/en_us.json, fr_fr.json
└── data/monmod/
    ├── loot_tables/blocks/*.json
    ├── recipes/*.json
    └── tags/...
```

Grâce à `sourceSets.main.resources { srcDir 'src/generated/resources' }` (dans `build.gradle`), ces fichiers sont inclus dans le `.jar` final comme s'ils étaient dans `src/main/resources/`.

> :attention: **Ne modifiez jamais** un fichier de `src/generated/` à la main : il sera écrasé au prochain `runData`. Modifiez le *provider* Java.

## Workflow d'équipe recommandé

1. Chaque personne qui ajoute du contenu écrit **aussi** son *provider* datagen.
2. Elle lance `./gradlew runData` **avant de committer**.
3. Elle committe le code **et** les JSON générés (voir stratégie ci-dessous).

### Committer ou non `src/generated/` ?

| Choix | Avantages | Inconvénients |
|-------|-----------|---------------|
| **Committer** `src/generated/resources/` (hors `.cache/`) — *défaut du MDK* | Build simple, CI sans étape datagen, jar reproductible sans `runData` | Diffs plus gros ; risque d'oublier de relancer `runData` |
| **Ignorer** tout `src/generated/` | Diffs minimes, pas de JSON dans les revues | `runData` obligatoire avant chaque `build`, en local **et** en CI |

Si vous ignorez `src/generated/`, ajoutez dans `build.gradle` une dépendance de tâche :

```gradle
// Force runData avant build (option "ignorer src/generated")
tasks.named('build').configure { dependsOn 'runData' }
```

Documentez le choix dans le `README` / `CONTRIBUTING`.

## Ce que la datagen NE génère pas

- Les **textures PNG** (à dessiner à la main).
- Les **sons OGG**.
- Le fichier `sounds.json` (il existe un `SoundDefinitionsProvider` mais souvent fait main).
- La logique de jeu (classes de blocs/items custom).

Page suivante : **[Sons personnalisés](#/sons)**.
