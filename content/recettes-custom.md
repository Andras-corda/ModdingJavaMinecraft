# Recettes personnalisées

Deux besoins distincts :

1. ajouter des recettes **vanilla** (craft, fourneau, taille sur pierre…) — vu dans [Datagen](#/datagen), on récapitule ;
2. créer un **nouveau type de recette** pour une machine custom.

Prérequis : [NBT & Codecs](#/nbt-codecs), [Un bloc avec inventaire](#/block-entity).

## Rappel : recettes vanilla par datagen

```java
// craft façonné
ShapedRecipeBuilder.shaped(RecipeCategory.TOOLS, ModItems.RUBY_PICKAXE.get())
        .pattern("RRR").pattern(" S ").pattern(" S ")
        .define('R', ModItems.RUBY.get())
        .define('S', Items.STICK)
        .unlockedBy("has_ruby", has(ModItems.RUBY.get()))
        .save(writer);

// craft informe
ShapelessRecipeBuilder.shapeless(RecipeCategory.MISC, ModItems.RUBY.get(), 9)
        .requires(ModBlocks.RUBY_BLOCK.get())
        .unlockedBy("has_block", has(ModBlocks.RUBY_BLOCK.get()))
        .save(writer);

// fusion + haut fourneau
SimpleCookingRecipeBuilder.smelting(Ingredient.of(ModItems.RAW_RUBY.get()),
        RecipeCategory.MISC, ModItems.RUBY.get(), 0.7F, 200)
        .unlockedBy("has_raw", has(ModItems.RAW_RUBY.get())).save(writer, "monmod:ruby_from_smelting");
SimpleCookingRecipeBuilder.blasting(Ingredient.of(ModItems.RAW_RUBY.get()),
        RecipeCategory.MISC, ModItems.RUBY.get(), 0.7F, 100)
        .unlockedBy("has_raw", has(ModItems.RAW_RUBY.get())).save(writer, "monmod:ruby_from_blasting");

// taille sur pierre, forge sur enclume (smithing)
SingleItemRecipeBuilder.stonecutting(Ingredient.of(ModBlocks.RUBY_BLOCK.get()),
        RecipeCategory.BUILDING_BLOCKS, ModBlocks.RUBY_TILES.get(), 4)
        .unlockedBy("has_block", has(ModBlocks.RUBY_BLOCK.get())).save(writer, "monmod:ruby_tiles");
```

> :astuce: Utilisez un **`Ingredient`** basé sur un **tag** dès que possible (`Ingredient.of(Tags.Items.GEMS_RUBY)`) : la recette accepte alors le rubis des autres mods.

## Un type de recette custom : la « presse à rubis »

Objectif : une machine qui transforme `1 ingrédient` + `du temps` → `1 résultat`.

### 1. La classe de recette

```java
public record PressingRecipe(ResourceLocation id, Ingredient input,
                             ItemStack result, int time) implements Recipe<SimpleContainer> {

    public static final String NAME = "pressing";

    @Override
    public boolean matches(SimpleContainer container, Level level) {
        return input.test(container.getItem(0));
    }

    @Override
    public ItemStack assemble(SimpleContainer container, RegistryAccess access) {
        return result.copy();
    }

    @Override public boolean canCraftInDimensions(int w, int h) { return true; }
    @Override public ItemStack getResultItem(RegistryAccess access) { return result; }
    @Override public ResourceLocation getId() { return id; }

    @Override public RecipeSerializer<?> getSerializer() { return ModRecipes.PRESSING_SERIALIZER.get(); }
    @Override public RecipeType<?> getType() { return ModRecipes.PRESSING_TYPE.get(); }

    @Override
    public NonNullList<Ingredient> getIngredients() {
        NonNullList<Ingredient> list = NonNullList.create();
        list.add(input);
        return list;
    }
}
```

### 2. `RecipeType` et `RecipeSerializer`

```java
public final class ModRecipes {

    public static final DeferredRegister<RecipeSerializer<?>> SERIALIZERS =
            DeferredRegister.create(ForgeRegistries.RECIPE_SERIALIZERS, MonMod.MODID);
    public static final DeferredRegister<RecipeType<?>> TYPES =
            DeferredRegister.create(ForgeRegistries.RECIPE_TYPES, MonMod.MODID);

    public static final RegistryObject<RecipeType<PressingRecipe>> PRESSING_TYPE =
            TYPES.register(PressingRecipe.NAME, () -> new RecipeType<>() {
                @Override public String toString() { return MonMod.MODID + ":" + PressingRecipe.NAME; }
            });

    public static final RegistryObject<RecipeSerializer<PressingRecipe>> PRESSING_SERIALIZER =
            SERIALIZERS.register(PressingRecipe.NAME, PressingRecipe.Serializer::new);

    private ModRecipes() {}
    public static void register(IEventBus bus) { SERIALIZERS.register(bus); TYPES.register(bus); }
}
```

### 3. Le sérialiseur (JSON + réseau)

En 1.20.1, le `RecipeSerializer` fait le parsing JSON à la main (`GsonHelper`) — les codecs arrivent après :

```java
public static class Serializer implements RecipeSerializer<PressingRecipe> {

    @Override
    public PressingRecipe fromJson(ResourceLocation id, JsonObject json) {
        Ingredient input = Ingredient.fromJson(GsonHelper.getAsJsonObject(json, "ingredient"));
        JsonObject resultObj = GsonHelper.getAsJsonObject(json, "result");
        Item item = ForgeRegistries.ITEMS.getValue(
                new ResourceLocation(GsonHelper.getAsString(resultObj, "item")));
        int count = GsonHelper.getAsInt(resultObj, "count", 1);
        int time = GsonHelper.getAsInt(json, "time", 100);
        return new PressingRecipe(id, input, new ItemStack(item, count), time);
    }

    @Override
    public PressingRecipe fromNetwork(ResourceLocation id, FriendlyByteBuf buf) {
        Ingredient input = Ingredient.fromNetwork(buf);
        ItemStack result = buf.readItem();
        int time = buf.readVarInt();
        return new PressingRecipe(id, input, result, time);
    }

    @Override
    public void toNetwork(FriendlyByteBuf buf, PressingRecipe recipe) {
        recipe.input().toNetwork(buf);
        buf.writeItem(recipe.result());
        buf.writeVarInt(recipe.time());
    }
}
```

### 4. Enregistrer et brancher

```java
// constructeur @Mod
ModRecipes.register(bus);
```

### 5. Utiliser la recette dans le block entity

```java
private Optional<PressingRecipe> currentRecipe() {
    if (level == null) return Optional.empty();
    SimpleContainer inv = new SimpleContainer(items.getStackInSlot(INPUT_SLOT));
    return level.getRecipeManager().getRecipeFor(ModRecipes.PRESSING_TYPE.get(), inv, level);
}

public static void serverTick(Level level, BlockPos pos, BlockState state, PressBlockEntity be) {
    Optional<PressingRecipe> recipe = be.currentRecipe();
    if (recipe.isPresent() && be.canInsertResult(recipe.get().getResultItem(level.registryAccess()))) {
        be.progress++;
        if (be.progress >= recipe.get().time()) {
            be.items.extractItem(INPUT_SLOT, 1, false);
            be.items.insertItem(OUTPUT_SLOT, recipe.get().assemble(/*...*/, level.registryAccess()), false);
            be.progress = 0;
        }
        be.setChanged();
    } else {
        be.progress = 0;
    }
}
```

### 6. Datagen d'une recette custom

Il faut un `FinishedRecipe` maison (ou un petit builder). Exemple minimal :

```java
// dans buildRecipes(Consumer<FinishedRecipe> writer)
pressing(Ingredient.of(ModItems.RUBY.get()), ModItems.RUBY_PLATE.get(), 1, 120, writer);

private void pressing(Ingredient in, ItemLike out, int count, int time, Consumer<FinishedRecipe> writer) {
    writer.accept(new FinishedRecipe() {
        public void serializeRecipeData(JsonObject json) {
            json.add("ingredient", in.toJson());
            JsonObject r = new JsonObject();
            r.addProperty("item", ForgeRegistries.ITEMS.getKey(out.asItem()).toString());
            r.addProperty("count", count);
            json.add("result", r);
            json.addProperty("time", time);
        }
        public ResourceLocation getId() {
            return new ResourceLocation(MonMod.MODID, "pressing/" + ForgeRegistries.ITEMS.getKey(out.asItem()).getPath());
        }
        public RecipeSerializer<?> getType() { return ModRecipes.PRESSING_SERIALIZER.get(); }
        public JsonObject serializeAdvancement() { return null; }
        public ResourceLocation getAdvancementId() { return null; }
    });
}
```

Résultat : `data/monmod/recipes/pressing/ruby_plate.json`

```json
{
  "type": "monmod:pressing",
  "ingredient": { "item": "monmod:ruby" },
  "result": { "item": "monmod:ruby_plate", "count": 1 },
  "time": 120
}
```

## Modifier / retirer des recettes vanilla

- **Retirer** : un datapack qui écrase le fichier de recette par `{}` (invalide) ou le supprime. En mod : fichier vide dans `data/minecraft/recipes/<nom>.json` ? Non — préférez un datapack, ou l'événement `RecipesUpdatedEvent` côté client + logique serveur, ou la lib **CraftTweaker** pour les packs.
- **Ajouter des conditions Forge** à une recette : `"conditions": [ { "type": "forge:mod_loaded", "modid": "othermod" } ]` dans le JSON (généré via `.condition(...)` sur certains builders, ou à la main).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `getRecipeFor` renvoie toujours vide | `matches` trop strict, ou mauvais `RecipeType` | logguer, vérifier l'`Ingredient` |
| Crash au `/reload` : `Unknown recipe serializer` | `type` du JSON ≠ id enregistré du serializer | aligner `monmod:pressing` |
| La recette marche en solo, pas en multi | `toNetwork`/`fromNetwork` incomplets | sérialiser **tous** les champs |
| Le résultat perd son NBT | `assemble` renvoie `result` sans `.copy()` | toujours `result.copy()` |
| `getResultItem` NPE à l'affichage JEI | `getResultItem(RegistryAccess)` renvoie `null` | renvoyer le stack (jamais null) |

Page suivante : **[Modifier le butin (Global Loot Modifiers)](#/loot-modifiers)**.
