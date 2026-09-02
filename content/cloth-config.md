# Cloth Config : écran de configuration

Forge fournit un système de config TOML (voir [Config & réseau](#/config-reseau)) mais **pas** d'écran pour l'éditer en jeu (juste l'ouverture d'un fichier). **Cloth Config API** génère cet écran, avec catégories, curseurs, listes, validation.

Deux approches : le **builder** (impératif, souple) ou **AutoConfig** (annotations, rapide). Cette page couvre le builder branché sur un `ForgeConfigSpec` existant.

> :attention: **Versions.** Cloth Config **11.x** pour 1.20.1, sur [maven.shedaniel.me](https://maven.shedaniel.me/). Doc : [shedaniel.gitbook.io/cloth-config](https://shedaniel.gitbook.io/cloth-config/).

## 1. Dépendance (douce)

```gradle
repositories { maven { url = "https://maven.shedaniel.me/" } }
dependencies {
    // douce : le mod garde son ForgeConfigSpec ; Cloth n'ajoute que l'écran
    compileOnly fg.deobf("me.shedaniel.cloth:cloth-config-forge:${cloth_config_version}") {
        exclude(group: "net.fabricmc")
    }
    runtimeOnly fg.deobf("me.shedaniel.cloth:cloth-config-forge:${cloth_config_version}") {
        exclude(group: "net.fabricmc")
    }
}
```

## 2. Rappel : la config Forge

```java
public final class ModConfig {
    public static final ForgeConfigSpec COMMON_SPEC;
    public static final ForgeConfigSpec.BooleanValue GENERATE_ORE;
    public static final ForgeConfigSpec.IntValue VEIN_SIZE;
    public static final ForgeConfigSpec.ConfigValue<String> GREETING;

    static {
        ForgeConfigSpec.Builder b = new ForgeConfigSpec.Builder();
        b.push("worldgen");
        GENERATE_ORE = b.comment("Générer le minerai").define("generateOre", true);
        VEIN_SIZE = b.comment("Taille des veines").defineInRange("veinSize", 8, 1, 64);
        b.pop();
        b.push("misc");
        GREETING = b.comment("Message d'accueil").define("greeting", "Bienvenue !");
        b.pop();
        COMMON_SPEC = b.build();
    }
    private ModConfig() {}
}
```

## 3. L'écran Cloth, branché sur la spec

Classe **isolée** (`client/config/`), appelée seulement si Cloth est là :

```java
public final class ClothConfigScreen {

    public static Screen build(Screen parent) {
        ConfigBuilder builder = ConfigBuilder.create()
                .setParentScreen(parent)
                .setTitle(Component.translatable("config.monmod.title"))
                .setSavingRunnable(ModConfig.COMMON_SPEC::save);   // écrit le TOML

        ConfigEntryBuilder entry = builder.entryBuilder();

        ConfigCategory worldgen = builder.getOrCreateCategory(
                Component.translatable("config.monmod.category.worldgen"));

        worldgen.addEntry(entry
                .startBooleanToggle(Component.translatable("config.monmod.generateOre"),
                        ModConfig.GENERATE_ORE.get())
                .setDefaultValue(true)
                .setTooltip(Component.translatable("config.monmod.generateOre.tip"))
                .setSaveConsumer(ModConfig.GENERATE_ORE::set)
                .build());

        worldgen.addEntry(entry
                .startIntSlider(Component.translatable("config.monmod.veinSize"),
                        ModConfig.VEIN_SIZE.get(), 1, 64)
                .setDefaultValue(8)
                .setSaveConsumer(ModConfig.VEIN_SIZE::set)
                .build());

        ConfigCategory misc = builder.getOrCreateCategory(
                Component.translatable("config.monmod.category.misc"));

        misc.addEntry(entry
                .startStrField(Component.translatable("config.monmod.greeting"),
                        ModConfig.GREETING.get())
                .setDefaultValue("Bienvenue !")
                .setSaveConsumer(ModConfig.GREETING::set)
                .build());

        return builder.build();
    }

    private ClothConfigScreen() {}
}
```

## 4. Enregistrer l'écran auprès de Forge

Pour le bouton *Mods → Mon Mod → Config* :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ConfigScreenSetup {
    @SubscribeEvent
    public static void onClientSetup(FMLClientSetupEvent event) {
        event.enqueueWork(() -> {
            if (!ModList.get().isLoaded("cloth_config")) return;
            ModLoadingContext.get().registerExtensionPoint(
                    ConfigScreenHandler.ConfigScreenFactory.class,
                    () -> new ConfigScreenHandler.ConfigScreenFactory(
                            (mc, parent) -> ClothConfigScreen.build(parent)));
        });
    }
}
```

Sans Cloth, aucun bouton n'apparaît (dégradation propre).

## 5. Types d'entrées disponibles

| Builder | Entrée |
|---------|--------|
| `startBooleanToggle` | oui / non |
| `startIntField` / `startLongField` / `startFloatField` / `startDoubleField` | champ numérique |
| `startIntSlider` / `startLongSlider` | curseur |
| `startStrField` | texte |
| `startTextDescription` | paragraphe non éditable |
| `startEnumSelector(cls, val)` | énumération |
| `startStrList` / `startIntList` | liste éditable |
| `startColorField` | sélecteur de couleur |
| `startКeyCodeField` | touche |

Options communes : `.setDefaultValue(...)`, `.setTooltip(...)`, `.requireRestart()`, `.setErrorSupplier(v -> Optional<Component>)` (validation).

## 6. AutoConfig (variante annotations)

Plus rapide si vous n'avez pas déjà un `ForgeConfigSpec` :

```java
@Config(name = "monmod")
public class AutoModConfig implements ConfigData {
    @ConfigEntry.Gui.Tooltip public boolean generateOre = true;
    @ConfigEntry.BoundedDiscrete(min = 1, max = 64) public int veinSize = 8;
    public String greeting = "Bienvenue !";
}

// init
AutoConfig.register(AutoModConfig.class, GsonConfigSerializer::new);
AutoModConfig cfg = AutoConfig.getConfigHolder(AutoModConfig.class).getConfig();
```

AutoConfig sérialise en **JSON** (`config/monmod.json`), pas en TOML — choisissez une seule approche pour tout le mod.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Pas de bouton « Config » dans la liste des mods | extension point non enregistrée, ou Cloth absent | `registerExtensionPoint` en `FMLClientSetupEvent`, garde `isLoaded` |
| Les changements ne sont pas sauvegardés | `setSavingRunnable` / `setSaveConsumer` oubliés | brancher `spec::save` + un `setSaveConsumer` par entrée |
| Valeurs incohérentes avec le fichier TOML | on lit `get()` une fois puis on ignore les rechargements | relire `get()` à l'ouverture de l'écran |
| Crash `NoClassDefFoundError me/shedaniel/...` | code Cloth chargé sans Cloth | isoler `ClothConfigScreen`, garde `isLoaded` |
| Conflit de dépendance Fabric | Cloth tire des artefacts Fabric | `exclude(group: "net.fabricmc")` |
| Option « requiert un redémarrage » ignorée | `.requireRestart()` non posé | l'ajouter sur les entrées concernées |

Page suivante : **[Bonnes pratiques (checklist)](#/bonnes-pratiques)**.
