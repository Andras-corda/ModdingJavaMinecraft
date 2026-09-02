# JEI : intégration des recettes

**JEI** (*Just Enough Items*) affiche les recettes et les usages des items. Vos recettes **vanilla** (craft, four…) apparaissent automatiquement. Pour une **machine custom** (voir [Recettes personnalisées](#/recettes-custom)), il faut un **plugin JEI** : une catégorie qui dessine la recette et la déclaration des recettes.

> :attention: **Versions.** JEI **15.x** pour 1.20.1. API sur [maven.blamejared.com](https://maven.blamejared.com). Le wiki : [github.com/mezz/JustEnoughItems/wiki](https://github.com/mezz/JustEnoughItems/wiki).

## 1. Dépendance (douce)

```gradle
repositories { maven { url = "https://maven.blamejared.com" } }
dependencies {
    compileOnly fg.deobf("mezz.jei:jei-1.20.1-common-api:${jei_version}")
    compileOnly fg.deobf("mezz.jei:jei-1.20.1-forge-api:${jei_version}")
    runtimeOnly fg.deobf("mezz.jei:jei-1.20.1-forge:${jei_version}")
}
```

Tout le code ci-dessous va dans un paquet `client/jei/` — il n'est chargé que si JEI est présent (JEI découvre les `@JeiPlugin`).

## 2. Le plugin

```java
@JeiPlugin
public class MonModJeiPlugin implements IModPlugin {

    private static final ResourceLocation UID = new ResourceLocation(MonMod.MODID, "jei_plugin");

    @Override public ResourceLocation getPluginUid() { return UID; }

    @Override
    public void registerCategories(IRecipeCategoryRegistration reg) {
        reg.addRecipeCategories(new PressingCategory(reg.getJeiHelpers().getGuiHelper()));
    }

    @Override
    public void registerRecipes(IRecipeRegistration reg) {
        RecipeManager rm = Minecraft.getInstance().level.getRecipeManager();
        List<PressingRecipe> recipes = rm.getAllRecipesFor(ModRecipes.PRESSING_TYPE.get());
        reg.addRecipes(PressingCategory.RECIPE_TYPE, recipes);
    }

    @Override
    public void registerRecipeCatalysts(IRecipeCatalystRegistration reg) {
        // "cliquer sur la Presse dans JEI montre ses recettes"
        reg.addRecipeCatalyst(new ItemStack(ModBlocks.RUBY_PRESS.get()), PressingCategory.RECIPE_TYPE);
    }

    @Override
    public void registerGuiHandlers(IGuiHandlerRegistration reg) {
        // (optionnel) rendre des zones de votre Screen "cliquables" vers JEI
    }
}
```

## 3. La catégorie

```java
public class PressingCategory implements IRecipeCategory<PressingRecipe> {

    public static final RecipeType<PressingRecipe> RECIPE_TYPE =
            RecipeType.create(MonMod.MODID, "pressing", PressingRecipe.class);

    private final IDrawable background;
    private final IDrawable icon;

    public PressingCategory(IGuiHelper helper) {
        // Fond : soit une texture dédiée, soit un rectangle
        this.background = helper.createBlankDrawable(120, 40);
        this.icon = helper.createDrawableItemStack(new ItemStack(ModBlocks.RUBY_PRESS.get()));
    }

    @Override public RecipeType<PressingRecipe> getRecipeType() { return RECIPE_TYPE; }
    @Override public Component getTitle() { return Component.translatable("gui.monmod.category.pressing"); }
    @Override public IDrawable getBackground() { return background; }
    @Override public IDrawable getIcon() { return icon; }

    @Override
    public void setRecipe(IRecipeLayoutBuilder builder, PressingRecipe recipe, IFocusGroup focuses) {
        builder.addSlot(RecipeIngredientRole.INPUT, 10, 12)
               .addIngredients(recipe.getIngredients().get(0));

        builder.addSlot(RecipeIngredientRole.OUTPUT, 90, 12)
               .addItemStack(recipe.getResultItem(Minecraft.getInstance().level.registryAccess()));
    }

    @Override
    public void draw(PressingRecipe recipe, IRecipeSlotsView slots, GuiGraphics g,
                     double mouseX, double mouseY) {
        // flèche, temps de traitement…
        g.drawString(Minecraft.getInstance().font,
                (recipe.time() / 20) + " s", 44, 28, 0x808080, false);
    }
}
```

`RecipeIngredientRole` : `INPUT`, `OUTPUT`, `CATALYST`, `RENDER_ONLY`.

## 4. Traductions

```json
{
  "gui.monmod.category.pressing": "Presse à rubis"
}
```

## 5. Ce que JEI fait tout seul

- Recettes de craft/four/fumoir/haut-fourneau/taille sur pierre/enclume/brassage de votre mod.
- Recherche par nom, par tag, par mod (`@monmod`).
- Infobulles enrichies, `U` (usages) / `R` (recettes).
- Les recettes marquées d'une **condition Forge** (`forge:mod_loaded`…) sont masquées si la condition est fausse.

## 6. Autres crochets utiles

| Méthode d'`IModPlugin` | Pour |
|------------------------|------|
| `registerItemSubtypes` | items dont le NBT change l'identité (potions custom, energy) |
| `registerIngredients` | types d'ingrédients custom (fluides, mana…) |
| `registerRecipeTransferHandlers` | bouton « + » qui remplit votre `Menu` depuis une recette |
| `registerGuiHandlers` | zones exclusives / cliquables de votre écran |
| `onRuntimeAvailable` | accès au `IJeiRuntime` (masquer des items dynamiquement…) |

### Masquer un item du JEI

```java
@Override
public void onRuntimeAvailable(IJeiRuntime runtime) {
    if (ModConfig.HIDE_WIP.get()) {
        runtime.getIngredientManager().removeIngredientsAtRuntime(
                VanillaTypes.ITEM_STACK, List.of(new ItemStack(ModItems.DEBUG_TOOL.get())));
    }
}
```

## Note : REI et EMI

**REI** et **EMI** sont deux viewers alternatifs. EMI lit une partie des plugins JEI directement ; REI a sa propre API. Si vous visez large, `compileOnly` sur l'API JEI suffit pour la majorité des joueurs ; ajoutez un plugin REI/EMI séparé seulement si demandé.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Plugin ignoré | pas d'annotation `@JeiPlugin`, ou classe hors du jar | annoter, vérifier le paquet |
| `getPluginUid` en double | UID réutilisé d'un exemple | `new ResourceLocation(MODID, "jei_plugin")` unique |
| Catégorie vide | `registerRecipes` ne récupère rien | `getAllRecipesFor(TYPE)` — vérifier le `RecipeType` |
| Crash `NoClassDefFoundError mezz/jei` | code JEI chargé sans JEI | tout dans `client/jei/`, `compileOnly`+`runtimeOnly` |
| Slot mal placé / manquant | coordonnées relatives au `background` | ajuster x/y, taille du drawable |
| `registryAccess()` NPE dans `setRecipe` | `Minecraft.level` null au chargement | JEI appelle `setRecipe` en jeu, c'est ok ; éviter en dehors |

Page suivante : **[Curios : emplacements d'équipement](#/curios)**.
