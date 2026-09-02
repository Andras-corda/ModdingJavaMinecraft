# Compatibilité entre mods

Votre mod ne tourne jamais seul. Cette page : déclarer des dépendances, appeler l'API d'un autre mod **sans planter s'il est absent**, et exposer votre contenu pour que les autres l'utilisent.

## Déclarer une dépendance (`mods.toml`)

```toml
# Dépendance OBLIGATOIRE (le jeu refuse de démarrer sans)
[[dependencies.monmod]]
    modId="jei"
    type="required"
    versionRange="[15.2.0,)"
    ordering="AFTER"       # charger monmod APRÈS jei
    side="CLIENT"

# Dépendance OPTIONNELLE (chargée avant si présente)
[[dependencies.monmod]]
    modId="curios"
    type="optional"
    versionRange="[5.1,)"
    ordering="AFTER"
    side="BOTH"

# INCOMPATIBLE
[[dependencies.monmod]]
    modId="badmod"
    type="incompatible"
    versionRange="*"
    side="BOTH"
```

`type` : `required`, `optional`, `incompatible`, `discouraged`.
`ordering` : `BEFORE`, `AFTER`, `NONE` — n'influence que **l'ordre de construction**, pas la garantie de présence.

## Vérifier la présence à l'exécution

```java
if (ModList.get().isLoaded("jei")) {
    JeiIntegration.init();
}
```

> :attention: **Ne référencez jamais** une classe d'un autre mod dans du code qui **charge toujours**. Isolez l'intégration dans une **classe séparée** appelée uniquement depuis la branche `isLoaded`. La JVM ne charge une classe qu'à sa première utilisation : si `JeiIntegration` n'est jamais touchée, ses `import mezz.jei...` n'explosent pas.

```java
// MAUVAIS : import JEI dans la classe principale
import mezz.jei.api.IModPlugin;   // NoClassDefFoundError si JEI absent

// BON : classe isolée
public final class JeiIntegration {
    public static void init() { /* ici seulement, les imports JEI */ }
}
```

## Dépendance de compilation

Pour appeler l'API d'un autre mod, il faut sa classe au **compile time** seulement :

```gradle
repositories {
    maven { url = "https://maven.blamejared.com" }     // JEI, Curios, Patchouli...
    maven { url = "https://www.cursemaven.com" }        // n'importe quel mod CurseForge
    maven { url = "https://api.modrinth.com/maven" }    // n'importe quel mod Modrinth
}

dependencies {
    // API seule, pas d'implémentation à l'exécution :
    compileOnly fg.deobf("mezz.jei:jei-1.20.1-common-api:15.2.0.27")
    compileOnly fg.deobf("mezz.jei:jei-1.20.1-forge-api:15.2.0.27")

    // Le mod complet pour TESTER en jeu (dev uniquement) :
    runtimeOnly fg.deobf("mezz.jei:jei-1.20.1-forge:15.2.0.27")

    // Un mod CurseForge par ID de fichier :
    // implementation fg.deobf("curse.maven:the-one-probe-245211:4629624")
}
```

`fg.deobf(...)` déobfusque le jar de dépendance pour l'environnement de dev.

## IMC — communication entre mods

`InterModComms` : envoyer des messages à un autre mod pendant le chargement (utilisé par Curios, The One Probe, Top…).

```java
// Émettre (sur le mod event bus)
private void enqueueIMC(InterModEnqueueEvent event) {
    InterModComms.sendTo("curios", CuriosApi.MODID, SlotTypeMessage.REGISTER_TYPE,
            () -> new SlotTypeMessage.Builder("amulet").size(1).build());
}

// Recevoir
private void processIMC(InterModProcessEvent event) {
    event.getIMCStream().forEach(msg -> { /* msg.method(), msg.messageSupplier() */ });
}
```

## Exposer son contenu aux autres

### 1. Tags (le plus important)

Fournir les tags Forge standard rend votre contenu utilisable **sans que personne n'écrive de code** :

```java
tag(Tags.Items.INGOTS).addTag(forgeTag("ingots/ruby"));
tag(forgeTag("ingots/ruby")).add(ModItems.RUBY_INGOT.get());
tag(Tags.Items.ORES).addTag(forgeTag("ores/ruby"));
```

Voir [Registres & tags](#/registres-tags) pour la liste (`forge:ores/*`, `forge:gems/*`, `forge:storage_blocks/*`…).

### 2. Forge Energy (`IEnergyStorage`)

Le standard **de facto** pour l'énergie inter-mods. Exposez la capability `ForgeCapabilities.ENERGY` sur votre machine (voir [Capabilities](#/capabilities)) : tous les câbles/générateurs des mods tech pourront s'y connecter.

```java
private final EnergyStorage energy = new EnergyStorage(50_000, 1_000, 1_000);
private final LazyOptional<IEnergyStorage> energyOpt = LazyOptional.of(() -> energy);

@Override
public <T> LazyOptional<T> getCapability(Capability<T> cap, Direction side) {
    if (cap == ForgeCapabilities.ENERGY) return energyOpt.cast();
    return super.getCapability(cap, side);
}
```

Idem pour les fluides (`ForgeCapabilities.FLUID_HANDLER`) et les items (`ForgeCapabilities.ITEM_HANDLER`).

### 3. Une API publique

Si d'autres mods doivent piloter le vôtre :

- placez les interfaces publiques dans un paquet `api/` clairement séparé ;
- ne cassez pas ces signatures entre versions mineures (`@Deprecated` + délai) ;
- documentez avec de la Javadoc ;
- optionnel : publiez un jar `-api` séparé.

## Intégrations fréquentes

| Mod | Intégration typique |
|-----|---------------------|
| **JEI** / **REI** / **EMI** | `@JeiPlugin` : afficher vos recettes de machine, catégories, infos |
| **The One Probe** / **Jade** / **WTHIT** | IMC ou capability : infobulle en visant un bloc (énergie, progression) |
| **Curios** | IMC : emplacements d'équipement (amulette, ceinture, bague) |
| **Patchouli** | livre de guide en jeu, en JSON |
| **Mekanism** | capabilities chimiques |
| **Create** | `@Mod.EventBusSubscriber` + API kinetics |
| **GeckoLib** | animations d'entités / blocs / items |

## Tester la compatibilité

- Dans `run/mods/`, déposez les mods optionnels ; lancez **avec** et **sans**.
- Créez plusieurs configs de lancement (« runClient », « runClientWithJEI »…) si besoin.
- Vérifiez : démarrage OK, `/reload` OK, votre contenu apparaît dans JEI, l'infobulle TOP s'affiche.
- En CI, le build ne charge pas les mods `runtimeOnly` — les tests d'intégration se font en local ou via GameTest ciblés.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `NoClassDefFoundError: mezz/jei/...` sans JEI | classe d'intégration référencée dans du code toujours chargé | isoler + garder derrière `isLoaded` |
| Le mod compile mais l'API manque à l'exécution en dev | `compileOnly` sans `runtimeOnly` | ajouter `runtimeOnly fg.deobf(...)` pour tester |
| Recettes invisibles dans JEI | plugin non annoté `@JeiPlugin` ou `getPluginUid` en double | vérifier l'annotation et l'UID |
| Conflit d'ID de recette / de registre | pas de namespace mod | toujours `new ResourceLocation(MODID, ...)` |
| Autre mod pas chargé « avant » le vôtre | confusion `ordering` vs présence | `ordering` ≠ garantie ; utiliser `optional` + `isLoaded` |
| Votre minerai inutilisable par les autres mods | tags `forge:` absents | fournir `forge:ores/*`, `forge:ingots/*`… |

Page suivante : **[Bonnes pratiques (checklist)](#/bonnes-pratiques)**.
