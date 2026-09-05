# Métiers & commerce des villageois

Ajouter un **métier** de villageois (avec son poste de travail) et des **offres d'échange**, ou étendre le commerce du marchand ambulant.

Prérequis : [Registres & tags](#/registres-tags), [Structures & génération](#/structures) (pour situer un village).

## Vue d'ensemble

| Pièce | Rôle |
|-------|------|
| `PoiType` (*Point of Interest*) | quel(s) `BlockState` sert de poste de travail |
| `VillagerProfession` | associe un nom, un `PoiType`, des sons |
| `VillagerTradesEvent` | déclare les offres d'échange du métier |
| `WandererTradesEvent` | offres du marchand ambulant (indépendant des métiers) |

## 1. Le poste de travail (`PoiType`)

Un villageois sans emploi cherche, à portée, un bloc dont le `BlockState` correspond à un `PoiType` **libre**. Réutilisez un bloc existant (une variante de table d'enchantement, votre propre établi) — pas besoin d'une classe de bloc spéciale.

```java
public final class ModPoiTypes {

    public static final DeferredRegister<PoiType> POI_TYPES =
            DeferredRegister.create(ForgeRegistries.POI_TYPES, MonMod.MODID);

    public static final RegistryObject<PoiType> RUBY_BENCH = POI_TYPES.register("ruby_bench",
            () -> new PoiType(
                    ImmutableSet.copyOf(ModBlocks.RUBY_BENCH.get().getStateDefinition().getPossibleStates()),
                    1,      // maxTickets : combien de villageois peuvent revendiquer ce poste (1 = normal)
                    1));    // maxDistance : rarement changé

    private ModPoiTypes() {}
    public static void register(IEventBus bus) { POI_TYPES.register(bus); }
}
```

> :attention: Le `PoiType` doit être enregistré **avant** de créer le `VillagerProfession` (ordre d'enregistrement du même `DeferredRegister` groupé, ou deux registres distincts enregistrés dans le bon ordre — en pratique, les deux `RegistryObject` se résolvent en paresseux via `Supplier`, donc l'ordre des lignes de code n'a pas d'importance, seulement l'ordre des `.register(bus)` dans le constructeur).

## 2. Le métier (`VillagerProfession`)

```java
public final class ModProfessions {

    public static final DeferredRegister<VillagerProfession> PROFESSIONS =
            DeferredRegister.create(ForgeRegistries.VILLAGER_PROFESSIONS, MonMod.MODID);

    public static final RegistryObject<VillagerProfession> GEMCUTTER = PROFESSIONS.register("gemcutter",
            () -> new VillagerProfession(
                    "gemcutter",
                    holder -> holder.is(ModPoiTypes.RUBY_BENCH.get().getKey()),   // requiredPoiType (recherche d'emploi)
                    holder -> holder.is(ModPoiTypes.RUBY_BENCH.get().getKey()),   // acquirableJobSite (poste revendicable)
                    ImmutableSet.of(),   // sons "regarde les items" (rare)
                    SoundEvents.VILLAGER_WORK_MASON));

    private ModProfessions() {}
    public static void register(IEventBus bus) { PROFESSIONS.register(bus); }
}
```

Traduction : `entity.minecraft.villager.gemcutter` (le jeu préfixe par `entity.minecraft.villager.`, pas votre `modid`, car c'est un sous-type de l'entité vanilla `villager`).

## 3. Le costume du métier (client)

`assets/monmod/textures/entity/villager/profession/gemcutter.png` (48×64, même gabarit que les autres costumes vanilla) et le fichier de couleur de badge (facultatif) `assets/monmod/textures/entity/villager/profession_level/gemcutter.png` — Forge/vanilla assemblent automatiquement le costume par-dessus le modèle de villageois si le nom du fichier correspond au nom du métier. Rien à enregistrer côté rendu.

## 4. Les offres d'échange (`VillagerTradesEvent`)

Sur le **Forge event bus** :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)
public final class ModVillagerTrades {

    @SubscribeEvent
    public static void onVillagerTrades(VillagerTradesEvent event) {
        if (event.getType() != ModProfessions.GEMCUTTER.get()) return;

        Int2ObjectMap<List<VillagerTrades.ItemListing>> trades = event.getTrades();

        // Niveau 1 (novice)
        trades.get(1).add((trader, random) -> new MerchantOffer(
                new ItemCost(Items.EMERALD, 12),
                new ItemStack(ModItems.RUBY.get(), 1),
                12,      // nombre max d'utilisations avant réapprovisionnement
                10,      // XP donnée au joueur
                0.05F)); // multiplicateur de prix (variation)

        // Niveau 3 (compagnon) : achète un item du joueur
        trades.get(3).add((trader, random) -> new MerchantOffer(
                new ItemCost(ModItems.RUBY.get(), 4),
                Optional.of(new ItemCost(Items.EMERALD, 1)),   // second coût optionnel
                new ItemStack(Items.EMERALD, 6),
                6, 15, 0.05F));

        // Une classe dédiée pour une logique plus riche
        trades.get(5).add(new EnchantedItemForEmeraldsTrade());
    }
}
```

- **Niveaux** : 1 (novice) à 5 (maître). Le villageois débloque de nouvelles offres en travaillant (gain d'XP).
- Chaque `List<ItemListing>` d'un niveau est une **piscine** : le jeu en tire au hasard un sous-ensemble à proposer.
- `ItemListing` est une interface fonctionnelle : `getOffer(Entity trader, RandomSource random)`.
- `MerchantOffer` : coût(s), résultat, utilisations max, XP, multiplicateur de prix.

> :info: **1.20.1 a changé `MerchantOffer`** par rapport aux versions antérieures : le prix est un **`ItemCost`** (`Item` + `count`), pas un `ItemStack` brut. Adaptez les tutoriels plus anciens en conséquence.

### Une offre custom

```java
public class EnchantedItemForEmeraldsTrade implements VillagerTrades.ItemListing {
    @Override
    public MerchantOffer getOffer(Entity trader, RandomSource random) {
        ItemStack tool = new ItemStack(ModItems.RUBY_PICKAXE.get());
        tool = EnchantmentHelper.enchantItem(random, tool, 5 + random.nextInt(15), false);
        return new MerchantOffer(new ItemCost(Items.EMERALD, 20), Optional.empty(), tool, 3, 30, 0.2F);
    }
}
```

## 5. Le marchand ambulant

```java
@SubscribeEvent
public static void onWandererTrades(WandererTradesEvent event) {
    event.getGenericTrades().add((trader, random) ->
            new MerchantOffer(new ItemCost(Items.EMERALD, 5), new ItemStack(ModItems.RUBY.get()), 8, 2, 0.05F));

    event.getRareTrades().add((trader, random) ->
            new MerchantOffer(new ItemCost(Items.EMERALD, 30), new ItemStack(ModBlocks.RUBY_BLOCK.get()), 3, 20, 0.05F));
}
```

## 6. Faire apparaître le poste dans les villages générés

Rien de spécifique aux professions : c'est le **bloc job-site lui-même** qui doit apparaître dans les structures de village (voir [Structures & génération](#/structures)). Placez-le dans vos `.nbt` de maisons/pools, ou — pour l'ajouter aux villages **vanilla** — suivez la même méthode (fragile en 1.20.1, à réserver aux mods qui acceptent ce compromis) que pour les bâtiments.

Un villageois sans emploi cherchant un poste vérifie **tous les `PoiType` libres à portée**, sans distinction de biome ou de structure d'origine : votre `PoiType` fonctionnera même posé à la main dans un village vanilla existant.

## 7. Zombification et guérison

Un villageois transformé en zombie **conserve son métier et son niveau de commerce** ; à la guérison (`Weakness` + pomme dorée), il les retrouve. Rien à coder pour ce comportement — c'est automatique dès lors que votre métier est un `VillagerProfession` standard.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le villageois ne prend jamais le métier | `PoiType` ne matche pas les `BlockState` réels (ex. propriété d'orientation oubliée) | inclure **tous** les états du bloc dans `getPossibleStates()` |
| Costume manquant (villageois nu/gris) | fichier hors de `textures/entity/villager/profession/` ou mauvais nom | nom de fichier = nom du métier |
| `MerchantOffer` : erreur de compilation avec un exemple trouvé en ligne | ancien tutoriel utilisant `ItemStack` comme coût | migrer vers `ItemCost` (1.20.1+) |
| Aucune offre au niveau 1 | trades ajoutées à un niveau jamais atteint sans XP | vérifier `trades.get(1)`, et que le villageois peut gagner de l'XP (échanges répétés) |
| Le marchand ambulant n'a jamais l'offre custom | ajoutée aux `RareTrades` alors qu'on veut la voir souvent | utiliser `getGenericTrades()` pour les offres courantes |
| Deux mods créent des `PoiType` incompatibles sur le même bloc | `PoiType` dupliqué par erreur | un seul `PoiType` par bloc/état, coordonné si mod partagé |

Page suivante : **[Créer un boss](#/boss)**.
