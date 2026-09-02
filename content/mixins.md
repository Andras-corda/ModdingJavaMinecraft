# Mixins (dernier recours)

Un **mixin** injecte du bytecode dans une classe existante (vanilla ou d'un autre mod) au chargement. C'est le seul moyen de modifier un comportement pour lequel **aucun** hook ni événement Forge n'existe.

> :danger: **Les mixins sont fragiles.** Ils cassent à chaque mise à jour, entrent en conflit entre mods, et sont pénibles à déboguer. **Cherchez d'abord** : un événement ([catalogue](#/evenements)), une méthode surchargeable, un `RegisterEvent`, une capability. Le mixin vient **après** avoir épuisé ces pistes.

## Mise en place (1.20.1 / ForgeGradle 6)

### `build.gradle`

```gradle
plugins {
    // ...
    id 'org.spongepowered.mixin' version '0.7-SNAPSHOT'
}

repositories {
    maven { url = 'https://repo.spongepowered.org/repository/maven-public/' }
}

mixin {
    add sourceSets.main, "monmod.refmap.json"
    config "monmod.mixins.json"
}
```

### `src/main/resources/monmod.mixins.json`

```json
{
  "required": true,
  "minVersion": "0.8.5",
  "package": "fr.monequipe.monmod.mixin",
  "compatibilityLevel": "JAVA_17",
  "refmap": "monmod.refmap.json",
  "mixins": [],
  "client": [ "ClientLevelMixin" ],
  "server": [],
  "injectors": { "defaultRequire": 1 }
}
```

- `mixins` : classes appliquées **des deux côtés** ; `client` / `server` : côté-spécifiques.
- `defaultRequire: 1` : le build échoue si une injection ne trouve pas sa cible (recommandé).

### `META-INF/mods.toml`

```toml
[[mixins]]
config="monmod.mixins.json"
```

## Anatomie d'un mixin

```java
package fr.monequipe.monmod.mixin;

@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin {

    // Accès à un champ/méthode privé de la cible
    @Shadow public abstract boolean isAlive();
    @Shadow private int deathTime;

    // Injecter au DÉBUT de la méthode "tick"
    @Inject(method = "tick", at = @At("HEAD"), cancellable = true)
    private void monmod$onTickHead(CallbackInfo ci) {
        LivingEntity self = (LivingEntity) (Object) this;      // "this" est la cible
        if (self.hasEffect(ModEffects.STASIS.get())) {
            ci.cancel();                                        // saute tout le reste de tick()
        }
    }

    // Modifier la valeur de RETOUR d'une méthode qui renvoie un float
    @Inject(method = "getSwimAmount", at = @At("RETURN"), cancellable = true)
    private void monmod$noSwimVisual(float partial, CallbackInfoReturnable<Float> cir) {
        if (/* condition */ false) cir.setReturnValue(0.0F);
    }
}
```

Conventions : préfixez vos méthodes injectées (`monmod$...`) pour éviter les collisions entre mods.

## Les types d'injection

| Annotation | Effet | Quand l'utiliser |
|------------|-------|------------------|
| `@Inject` | ajoute du code à un point (`@At`) | le plus sûr ; lire / annuler / modifier le retour |
| `@ModifyArg` | change **un argument** d'un appel | ajuster un paramètre passé à une méthode |
| `@ModifyVariable` | change une **variable locale** | ajuster une valeur intermédiaire |
| `@ModifyConstant` | change une **constante** littérale | changer un `64` en `128`… |
| `@Redirect` | **remplace** entièrement un appel / accès | dernier recours, très conflictuel |
| `@Overwrite` | remplace toute une méthode | **à éviter** : casse toute compat |

### `@At` — où injecter

`HEAD`, `TAIL`, `RETURN` (chaque `return`), `INVOKE` (avant/après un appel précis), `FIELD` (accès à un champ), `INVOKE_ASSIGN`, `CONSTANT`, `NEW`.

```java
@Inject(method = "hurt",
        at = @At(value = "INVOKE",
                 target = "Lnet/minecraft/world/entity/LivingEntity;playHurtSound(Lnet/minecraft/world/damagesource/DamageSource;)V"))
```

## MixinExtras — préférez-le à `@Redirect`

Forge 47 (1.20.1) **embarque MixinExtras**. Ses annotations sont plus robustes et composables :

| MixinExtras | Remplace | Effet |
|-------------|----------|-------|
| `@WrapOperation` | `@Redirect` | encapsule un appel, avec possibilité de l'exécuter (`operation.call(...)`) |
| `@ModifyExpressionValue` | `@Redirect` sur un getter | modifie la valeur d'une expression |
| `@ModifyReturnValue` | `@Inject` at RETURN | modifie proprement le retour |
| `@WrapWithCondition` | `@Redirect` void | exécute l'appel seulement si condition |

```java
@ModifyExpressionValue(method = "getWalkTargetValue",
        at = @At(value = "INVOKE", target = "..."))
private float monmod$boost(float original) {
    return original * 1.5F;
}
```

## Débogage

```bash
./gradlew runClient -Dmixin.debug.export=true
```

Les classes transformées sont écrites dans `run/.mixin.out/` — décompilez-les pour voir le résultat réel de l'injection.

- `MixinApplyError` / `InvalidInjectionException` : la cible n'existe pas (mauvais nom, mauvaise signature) ou le point `@At` est ambigu → préciser `ordinal`/`target`.
- Nom des méthodes : en dev, utilisez les **noms mappés** (`tick`) ; le *refmap* traduit vers SRG en production. Testez **le jar**.

## Règles de survie en équipe et en compat

- **Un mixin = un besoin précis**, documenté (commentaire : pourquoi, quel comportement, quels risques).
- `@Inject` > MixinExtras > `@Redirect` > `@Overwrite` (jamais).
- Ne mixinez pas une classe d'un autre mod sans `"required": false` sur ce mixin (via un mixin plugin) — sinon crash si l'autre mod est absent.
- Testez avec et sans les autres mods du modpack cible.
- Committez `mixins.json` et la config `build.gradle` ; toute l'équipe re-`--refresh` après ajout.
- Un mixin qui « marche en dev mais pas en jar » = presque toujours un problème de refmap / noms.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `Mixin config monmod.mixins.json does not exist` | `[[mixins]]` absent de `mods.toml`, ou fichier mal placé | vérifier chemin + `mods.toml` |
| Le mixin marche en dev, pas en prod | refmap non généré / noms en dur | plugin `org.spongepowered.mixin` + `mixin { add ... }` |
| `@Inject` : « target method not found » | mauvaise signature, méthode lambda/synthétique | copier la signature exacte, `@At` avec `target` complet |
| Conflit avec un autre mod | deux `@Redirect`/`@Overwrite` sur la même méthode | passer en `@WrapOperation` / `@Inject` |
| `ClassCastException` sur `(Cible)(Object) this` | mixin sur la mauvaise classe | vérifier `@Mixin(...)` |
| Crash seulement quand un autre mod est présent | mixin sur une classe optionnelle sans garde | mixin plugin + `shouldApplyMixin` |

Page suivante : **[Access Transformers](#/access-transformers)**.
