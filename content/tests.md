# Tester son mod

Deux niveaux de tests automatisés pour un mod Forge :

- **GameTest** : tests d'intégration *dans le jeu*, dans une petite structure — vérifient un comportement réel (le four fond, la machine consomme l'énergie, le bloc se casse correctement).
- **JUnit** : tests unitaires de logique pure, sans lancer Minecraft.

Ils complètent — sans remplacer — le test manuel et le [débogage](#/debogage).

## GameTest

### Écrire un test

```java
@GameTestHolder(MonMod.MODID)
public class PressGameTests {

    @GameTest(template = "monmod:press_empty")
    public static void pressProcessesInput(GameTestHelper helper) {
        BlockPos machinePos = new BlockPos(1, 1, 1);

        // Place la machine + un input
        helper.setBlock(machinePos, ModBlocks.RUBY_PRESS.get());
        if (helper.getBlockEntity(machinePos) instanceof PressBlockEntity be) {
            be.getItemHandler().insertItem(0, new ItemStack(ModItems.RUBY.get()), false);
        } else {
            helper.fail("Pas de PressBlockEntity");
            return;
        }

        // Attend 120 ticks puis vérifie la sortie
        helper.runAfterDelay(130, () -> {
            PressBlockEntity be = (PressBlockEntity) helper.getBlockEntity(machinePos);
            ItemStack out = be.getItemHandler().getStackInSlot(1);
            if (out.is(ModItems.RUBY_PLATE.get())) {
                helper.succeed();
            } else {
                helper.fail("Sortie attendue: ruby_plate, obtenu: " + out);
            }
        });
    }

    @GameTest(template = "monmod:empty_3x3")
    public static void oreDropsGem(GameTestHelper helper) {
        BlockPos p = new BlockPos(1, 1, 1);
        helper.setBlock(p, ModBlocks.RUBY_ORE.get());
        Player player = helper.makeMockSurvivalPlayer();
        player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.DIAMOND_PICKAXE));

        helper.destroyBlock(p);   // simplifié ; sinon simuler le minage du joueur
        helper.succeedWhenEntityPresent(EntityType.ITEM, p.getX() + .5, p.getY(), p.getZ() + .5);
    }
}
```

### La structure de test

Chaque `@GameTest` référence un `template` (structure NBT) qui définit la zone de test — souvent juste un plancher.

- Fichier : `src/main/resources/data/monmod/structures/empty_3x3.snbt` (ou `.nbt`).
- Créez-la en jeu : `/structure` + un *structure block* en mode `SAVE`, ou copiez une structure vide vanilla.
- Convention : plancher de pierre, la zone de test au-dessus.

### `GameTestHelper` — l'essentiel

| Méthode | Effet |
|---------|-------|
| `setBlock(pos, block)` / `getBlockState(pos)` / `getBlockEntity(pos)` | manipuler les blocs (coords **relatives** à la structure) |
| `spawn(type, pos)` / `spawnItem(item, x,y,z)` | faire apparaître |
| `assertBlockPresent(block, pos)` / `assertBlockNotPresent(...)` | assertions bloc |
| `assertEntityPresent(type)` / `assertEntityNotPresent(type)` | assertions entité |
| `assertContainerContains(pos, item)` | contenu d'un conteneur |
| `succeed()` / `succeedWhen(Runnable)` / `succeedWhenBlockPresent(...)` | valider |
| `fail(String)` | échouer |
| `runAfterDelay(ticks, Runnable)` | différer |
| `makeMockSurvivalPlayer()` | joueur factice |

Toute exception non rattrapée = test **échoué**.

### Lancer les GameTests

Le MDK 1.20.1 fournit une run `gameTestServer`. En ligne de commande :

```bash
./gradlew runGameTestServer
```

Le build **échoue** si un test échoue → idéal en **CI**. Ajoutez au workflow (voir [GitHub](#/github)) :

```yaml
      - name: GameTests
        run: ./gradlew runGameTestServer --stacktrace
```

En jeu (monde créatif superplat) : `/test runall`, `/test runthis`, `/test run monmod:press_processes_input`.

### Enregistrer des tests hors `@GameTestHolder`

```java
@SubscribeEvent
public static void registerTests(RegisterGameTestsEvent event) {
    event.register(MoreTests.class);
}
```

## JUnit (logique pure)

Pour tout ce qui **ne dépend pas** d'un `Level` vivant : calculs, parsing de config, algorithmes, matching de recette extrait dans une classe simple.

### Configuration

```gradle
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.2'
}

test {
    useJUnitPlatform()
}
```

Tests dans `src/test/java/`.

### Test sans Minecraft

```java
class ManaMathTest {

    @Test
    void regenCappedAtMax() {
        ManaStore store = new ManaStore();     // classe qui n'importe rien de net.minecraft
        store.setMana(95);
        store.addMana(20);
        assertEquals(store.getMaxMana(), store.getMana());
    }
}
```

### Test qui touche des classes Minecraft

Certaines classes (`ItemStack`, `BlockState`, les registres) exigent le *bootstrap* du jeu :

```java
class RecipeMatchTest {

    @BeforeAll
    static void bootstrap() {
        SharedConstants.tryDetectVersion();
        Bootstrap.bootStrap();                 // initialise les registres vanilla — lent (~quelques s)
    }

    @Test
    void pressAcceptsRuby() {
        PressingRecipe r = new PressingRecipe(
                new ResourceLocation("monmod", "t"),
                Ingredient.of(Items.DIAMOND), new ItemStack(Items.NETHERITE_INGOT), 100);
        SimpleContainer c = new SimpleContainer(1);
        c.setItem(0, new ItemStack(Items.DIAMOND));
        assertTrue(r.matches(c, null));
    }
}
```

> :attention: `Bootstrap.bootStrap()` initialise **vanilla**, pas votre mod (vos `DeferredRegister` ne sont pas tirés). Testez la logique, pas l'intégration — celle-ci relève des **GameTests**.

### Quoi tester où

| Sujet | Test |
|-------|------|
| Formule de dégâts, de mana, de génération | JUnit pur |
| Parsing d'un fichier de config / JSON custom | JUnit pur |
| `matches()` d'une recette custom | JUnit (bootstrap) |
| Un bloc se casse et lâche le bon item | GameTest |
| Une machine consomme et produit | GameTest |
| Une entité cible bien un joueur | GameTest |
| Le rendu, le réseau, l'UI | test **manuel** (pas d'auto-test fiable) |

## Bonnes pratiques

- **Extrayez la logique** des classes « Minecraft » vers des classes simples (`ManaStore`, `SpellMath`) : elles deviennent testables en JUnit.
- Un GameTest par mécanique critique ; nommez-les clairement.
- Faites tourner `runGameTestServer` en CI, bloquant.
- Un test rouge est un bug : ne le désactivez pas, corrigez-le ou marquez-le `@Disabled` avec une raison et un ticket.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `runGameTestServer` : « No test structure » | fichier `.snbt`/`.nbt` absent ou mauvais nom | placer dans `data/<modid>/structures/`, nom = `template` |
| JUnit : `NullPointerException` sur `BuiltInRegistries` | pas de `Bootstrap.bootStrap()` | l'appeler dans `@BeforeAll` |
| GameTest instable (parfois vert, parfois rouge) | timing trop serré | augmenter le `runAfterDelay`, `succeedWhen` |
| Les GameTests ne sont pas découverts | classe sans `@GameTestHolder(MODID)` | annoter, ou `RegisterGameTestsEvent` |
| CI très lente | bootstrap JUnit dans chaque classe | mutualiser, ou éviter le bootstrap |

Page suivante : **[Performance & profilage](#/performance)**.
