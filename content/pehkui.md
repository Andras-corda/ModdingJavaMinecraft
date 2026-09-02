# Pehkui : mise à l'échelle

**Pehkui** met les entités **à l'échelle** : les rendre géantes ou minuscules, avec la hitbox, la portée, la vitesse, les dégâts de chute, la taille des items tenus, etc. qui suivent. Il gère la synchronisation client/serveur et l'interpolation.

Cas d'usage : potion de rétrécissement, boss qui grandit en phase 2, mode « bébé », talisman de géant.

> :attention: **Versions.** Cette page vise Pehkui **~3.8.x pour 1.20.1-forge**. Vérifiez sur [modrinth.com/mod/pehkui](https://modrinth.com/mod/pehkui). L'API `com.jamieswhiteshirt.pehkui` est stable dans la 3.x mais confirmez les noms de `ScaleType`.

## 1. Dépendance

```gradle
repositories {
    maven { url = "https://api.modrinth.com/maven" }
}
dependencies {
    // Pehkui est presque toujours une dépendance DOUCE : le mod marche sans,
    // il ajoute juste la mise à l'échelle si Pehkui est là.
    compileOnly fg.deobf("maven.modrinth:pehkui:3.8.3+1.20.1-forge")
    runtimeOnly fg.deobf("maven.modrinth:pehkui:3.8.3+1.20.1-forge")
}
```

`mods.toml` :

```toml
[[dependencies.monmod]]
    modId="pehkui"
    type="optional"
    versionRange="[3.8,)"
    ordering="AFTER"
    side="BOTH"
```

## 2. Les types d'échelle (`ScaleTypes`)

Pehkui découpe « la taille » en plusieurs axes indépendants :

| `ScaleType` | Effet |
|-------------|-------|
| `BASE` | échelle globale — modifie **tout** (modèle, hitbox, portée, vitesse…) |
| `WIDTH` / `HEIGHT` | hitbox seulement (largeur / hauteur) |
| `MODEL_WIDTH` / `MODEL_HEIGHT` | modèle visuel seulement |
| `MOTION` | vitesse de déplacement |
| `REACH` | portée d'interaction / d'attaque |
| `JUMP_HEIGHT` | hauteur de saut |
| `STEP_HEIGHT` | hauteur de marche (monter les blocs) |
| `FALL_DAMAGE` | multiplicateur de dégâts de chute |
| `ATTACK` / `DEFENSE` | dégâts infligés / réduction |
| `HELD_ITEM` | taille des items en main |
| `VISIBILITY` | distance à laquelle les mobs vous repèrent |
| `EYE_HEIGHT`, `THIRD_PERSON`, `DROPS`, `PROJECTILES`, `EXPLOSIONS`, `HORIZONTAL_/VERTICAL_MOTION` | ajustements fins |

Pour « tout mettre à l'échelle », utilisez **`BASE`**. Pour un effet purement visuel, `MODEL_WIDTH` + `MODEL_HEIGHT`.

## 3. Lire et modifier l'échelle

Comme c'est une dépendance douce, isolez tout l'accès à Pehkui dans une classe dédiée (voir [Compatibilité](#/compatibilite)) :

```java
public final class PehkuiCompat {

    public static void setScale(Entity entity, float scale) {
        ScaleData data = ScaleTypes.BASE.getScaleData(entity);
        data.setScale(scale);                  // instantané
    }

    public static void setScaleSmooth(Entity entity, float scale, int transitionTicks) {
        ScaleData data = ScaleTypes.BASE.getScaleData(entity);
        data.setScaleTickDelay(transitionTicks);
        data.setTargetScale(scale);            // interpolé sur transitionTicks
    }

    public static float getScale(Entity entity) {
        return ScaleTypes.BASE.getScaleData(entity).getScale();
    }

    public static void resetScale(Entity entity) {
        ScaleTypes.BASE.getScaleData(entity).resetScale();
    }

    private PehkuiCompat() {}
}
```

Appel depuis le mod, toujours gardé :

```java
if (ModList.get().isLoaded("pehkui")) {
    PehkuiCompat.setScaleSmooth(player, 0.4F, 20);   // rétrécit sur 1 s
}
```

- `setScale(f)` : applique immédiatement (le rendu « saute »).
- `setTargetScale(f)` + `setScaleTickDelay(n)` : transition douce sur `n` ticks — **préférez ceci**.
- `getScale()` : échelle courante (interpolée) ; `getTargetScale()` : cible ; `getBaseScale()` : valeur de base sans modificateurs.
- L'échelle est **persistée** avec l'entité et **synchronisée** au client par Pehkui — vous n'avez rien à faire.

## 4. Exemple : une potion de rétrécissement

Effet custom ([voir la page Effets](#/effets-potions)) qui pilote l'échelle à l'ajout et au retrait :

```java
public class ShrinkEffect extends MobEffect {

    public ShrinkEffect() { super(MobEffectCategory.NEUTRAL, 0x6699ff); }

    private static float scaleForAmplifier(int amp) {
        return switch (amp) { case 0 -> 0.5F; case 1 -> 0.25F; default -> 0.125F; };
    }

    // Pas d'application par tick nécessaire
    @Override public boolean isDurationEffectTick(int duration, int amplifier) { return false; }
}
```

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)
public class ShrinkHandler {

    @SubscribeEvent
    public static void onAdded(MobEffectEvent.Added event) {
        apply(event.getEntity(), event.getEffectInstance());
    }

    @SubscribeEvent
    public static void onExpired(MobEffectEvent.Expired event) {
        reset(event.getEntity(), event.getEffectInstance());
    }

    @SubscribeEvent
    public static void onRemoved(MobEffectEvent.Remove event) {
        reset(event.getEntity(), event.getEffectInstance());
    }

    private static void apply(LivingEntity entity, MobEffectInstance inst) {
        if (inst == null || inst.getEffect() != ModEffects.SHRINK.get()) return;
        if (!ModList.get().isLoaded("pehkui")) return;
        PehkuiCompat.setScaleSmooth(entity, ShrinkEffect.scaleForAmplifier(inst.getAmplifier()), 10);
    }

    private static void reset(LivingEntity entity, MobEffectInstance inst) {
        if (inst == null || inst.getEffect() != ModEffects.SHRINK.get()) return;
        if (!ModList.get().isLoaded("pehkui")) return;
        PehkuiCompat.setScaleSmooth(entity, 1.0F, 10);
    }
}
```

## 5. Modificateurs calculés (`ScaleModifier`)

Pour une échelle qui **dépend d'un état** (ex. « ×1.5 tant que l'armure de géant est portée »), sans écraser la valeur de base :

```java
public static final ScaleModifier GIANT_ARMOR = new TypedScaleModifier(() -> ScaleTypes.BASE, 0.5F) {
    // ajoute +0.5 à l'échelle tant que le modifier est présent
};

// ajouter / retirer
ScaleData data = ScaleTypes.BASE.getScaleData(entity);
data.getBaseValueModifiers().add(GIANT_ARMOR);
data.onUpdate();
// ...
data.getBaseValueModifiers().remove(GIANT_ARMOR);
data.onUpdate();
```

Les modificateurs se cumulent proprement et se retirent sans « remettre à 1 » ce que d'autres effets ont posé.

## 6. Type d'échelle custom

`ScaleType` s'enregistre via `ScaleRegistries` (dans l'init du mod, gardé par `isLoaded`). Rare : réservé si vous voulez un axe que Pehkui ne fournit pas. Voir le [wiki Pehkui](https://github.com/Virtuoel/Pehkui/wiki).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `NoClassDefFoundError com/jamieswhiteshirt/pehkui/...` | accès à Pehkui hors garde `isLoaded` | isoler dans `PehkuiCompat`, appeler derrière `isLoaded` |
| L'échelle « saute » brutalement | `setScale` au lieu de `setTargetScale` | `setTargetScale` + `setScaleTickDelay` |
| L'échelle ne revient pas à la normale | `MobEffectEvent.Remove` non géré (mort, lait, `/effect clear`) | gérer `Expired` **et** `Remove` |
| Hitbox géante mais modèle normal (ou l'inverse) | mauvais `ScaleType` (`WIDTH` vs `MODEL_WIDTH`) | utiliser `BASE` pour « tout » |
| Désync visuelle en multi | vous synchronisez vous-même | ne rien faire, Pehkui synchronise |
| L'effet marche en solo, pas en dédié | logique côté client | appliquer l'échelle **côté serveur** |

Page suivante : **[JEI : intégration des recettes](#/jei)**.
