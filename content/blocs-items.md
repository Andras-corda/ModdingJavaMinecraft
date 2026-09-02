# Blocs, items & onglets créatifs

On enregistre tout contenu avec **`DeferredRegister`** : une liste d'objets à créer, que Forge instancie au bon moment.

## Items

`fr/monequipe/monmod/registry/ModItems.java` :

```java
package fr.monequipe.monmod.registry;

import fr.monequipe.monmod.MonMod;
import net.minecraft.world.item.Item;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class ModItems {

    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, MonMod.MODID);

    public static final RegistryObject<Item> SAPPHIRE =
            ITEMS.register("sapphire", () -> new Item(new Item.Properties()));

    public static final RegistryObject<Item> SAPPHIRE_DUST =
            ITEMS.register("sapphire_dust", () -> new Item(new Item.Properties()));

    private ModItems() {}

    public static void register(IEventBus modEventBus) {
        ITEMS.register(modEventBus);
    }
}
```

- La **clé** (`"sapphire"`) devient l'identifiant `monmod:sapphire`. **Définitive.**
- `Item.Properties()` : `.stacksTo(16)`, `.rarity(Rarity.RARE)`, `.food(...)`, `.fireResistant()`…
- `SAPPHIRE.get()` renvoie l'`Item` — **seulement après l'enregistrement** (pas dans un `static`).

## Blocs

Un bloc nécessite **deux** enregistrements : le `Block` (registre des blocs) **et** son `BlockItem` (registre des items), pour pouvoir le tenir en main.

`registry/ModBlocks.java` :

```java
package fr.monequipe.monmod.registry;

import fr.monequipe.monmod.MonMod;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

import java.util.function.Supplier;

public final class ModBlocks {

    public static final DeferredRegister<Block> BLOCKS =
            DeferredRegister.create(ForgeRegistries.BLOCKS, MonMod.MODID);

    public static final RegistryObject<Block> SAPPHIRE_BLOCK = registerBlock("sapphire_block",
            () -> new Block(BlockBehaviour.Properties.of()
                    .mapColor(MapColor.COLOR_BLUE)
                    .strength(5.0F, 6.0F)
                    .requiresCorrectToolForDrops()));

    public static final RegistryObject<Block> SAPPHIRE_ORE = registerBlock("sapphire_ore",
            () -> new Block(BlockBehaviour.Properties.of()
                    .strength(3.0F)
                    .requiresCorrectToolForDrops()));

    /** Enregistre le bloc ET son BlockItem associé. */
    private static <T extends Block> RegistryObject<T> registerBlock(String name, Supplier<T> block) {
        RegistryObject<T> registered = BLOCKS.register(name, block);
        ModItems.ITEMS.register(name, () -> new BlockItem(registered.get(), new Item.Properties()));
        return registered;
    }

    private ModBlocks() {}

    public static void register(IEventBus modEventBus) {
        BLOCKS.register(modEventBus);
    }
}
```

> :attention: Ordre d'appel dans le constructeur `@Mod` : enregistrez **`ModItems` avant `ModBlocks`** n'est pas obligatoire (les `DeferredRegister` gèrent l'ordre), mais assurez-vous que `ModItems.ITEMS.register(modEventBus)` est bien appelé, car `registerBlock` y ajoute des entrées.

### Propriétés de bloc utiles

| Méthode | Effet |
|---------|-------|
| `.strength(dureté, résistance)` | temps de minage, résistance aux explosions |
| `.requiresCorrectToolForDrops()` | ne lâche rien sans le bon outil |
| `.sound(SoundType.METAL)` | sons de pas / casse |
| `.lightLevel(s -> 15)` | émission de lumière |
| `.noOcclusion()` | pour les blocs non pleins (vitres, modèles custom) |
| `.mapColor(MapColor.X)` | couleur sur la carte |

## Onglet créatif (1.20.1)

Depuis 1.19.3, les onglets créatifs sont **enregistrés** comme le reste. Deux cas.

### A. Créer son propre onglet

`registry/ModCreativeTabs.java` :

```java
package fr.monequipe.monmod.registry;

import fr.monequipe.monmod.MonMod;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.RegistryObject;

public final class ModCreativeTabs {

    public static final DeferredRegister<CreativeModeTab> TABS =
            DeferredRegister.create(Registries.CREATIVE_MODE_TAB, MonMod.MODID);

    public static final RegistryObject<CreativeModeTab> MAIN = TABS.register("main", () ->
            CreativeModeTab.builder()
                    .title(Component.translatable("itemGroup.monmod.main"))
                    .icon(() -> new ItemStack(ModItems.SAPPHIRE.get()))
                    .displayItems((params, output) -> {
                        output.accept(ModItems.SAPPHIRE.get());
                        output.accept(ModItems.SAPPHIRE_DUST.get());
                        output.accept(ModBlocks.SAPPHIRE_BLOCK.get());
                        output.accept(ModBlocks.SAPPHIRE_ORE.get());
                    })
                    .build());

    private ModCreativeTabs() {}

    public static void register(IEventBus modEventBus) {
        TABS.register(modEventBus);
    }
}
```

Ajoutez la traduction `itemGroup.monmod.main` dans `en_us.json` / `fr_fr.json`.

### B. Ajouter à un onglet vanilla existant

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
public class CreativeTabInjector {

    @SubscribeEvent
    public static void addToVanillaTabs(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey() == CreativeModeTabs.INGREDIENTS) {
            event.accept(ModItems.SAPPHIRE);
            event.accept(ModItems.SAPPHIRE_DUST);
        }
        if (event.getTabKey() == CreativeModeTabs.BUILDING_BLOCKS) {
            event.accept(ModBlocks.SAPPHIRE_BLOCK);
        }
    }
}
```

## Brancher tout ça dans la classe `@Mod`

```java
public MonMod() {
    IEventBus bus = FMLJavaModLoadingContext.get().getModEventBus();
    ModItems.register(bus);
    ModBlocks.register(bus);
    ModCreativeTabs.register(bus);
    // ...
}
```

## Tester

```bash
./gradlew runClient
```

En jeu (mode créatif) : l'onglet « main » doit apparaître avec vos items. Ils seront **sans texture** (carreaux violet/noir) et nommés `item.monmod.sapphire` : c'est normal, les textures, modèles et traductions font l'objet du chapitre [Ressources & rendu](#/ressources-assets).

> :astuce: `F3 + H` en jeu affiche les identifiants d'items dans les infobulles — pratique pour vérifier un `modid:nom`.

## Autres registres, même schéma

`ForgeRegistries.BLOCK_ENTITY_TYPES`, `MENU_TYPES`, `ENTITY_TYPES`, `MOB_EFFECTS`, `SOUND_EVENTS`, `RECIPE_SERIALIZERS`, `PARTICLE_TYPES`… Toujours : un `DeferredRegister.create(...)`, des `.register("nom", () -> ...)`, un `register(bus)` appelé depuis le constructeur.

Page suivante : **[Blocs avancés](#/blocs-avances)**.
