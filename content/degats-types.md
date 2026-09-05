# Types de dégâts personnalisés

Depuis 1.19.4/1.20, les **types de dégâts** ne sont plus des constantes Java mais des objets **pilotés par données** (`DamageType`, registre de datapack). C'est ce qui permet à un autre mod — ou un datapack — de faire « le feu ne blesse pas les morts-vivants » ou « ce dégât ignore l'armure » **sans modifier votre code**.

Prérequis : [Registres & tags](#/registres-tags), [NBT & Codecs](#/nbt-codecs).

## Pourquoi s'en soucier

Sans type de dégât dédié, un dégât custom hérite d'un comportement générique : mauvais message de mort, pas de comportement standardisé (traverse l'armure ou non, compte comme feu ou non…). Avec un `DamageType` déclaré, vous branchez votre dégât sur **tous** les mécanismes vanilla existants (résistance au feu, tags de mob, messages de mort traduits) via de simples tags.

## 1. Déclarer le type de dégât (JSON)

`src/main/resources/data/monmod/damage_type/venom.json` :

```json
{
  "message_id": "venom",
  "scaling": "when_caused_by_living_non_player",
  "exhaustion": 0.1,
  "effects": "hurt"
}
```

| Champ | Valeurs | Sens |
|-------|---------|------|
| `message_id` | texte libre | clé du message de mort : `death.attack.<message_id>` |
| `scaling` | `never`, `when_caused_by_living_non_player`, `always` | le dégât est-il réduit en difficulté Facile ? |
| `exhaustion` | float | faim consommée par le joueur qui reçoit ce dégât |
| `effects` | `hurt`, `thorns`, `drowning`, `burning`, `poking`, `freezing` | effet visuel/sonore associé (secousse, brûlure…) |
| `death_message_type` | (optionnel) `default`, `fall_variants`, `intentional_game_design` | variantes de message |

## 2. La clé Java

```java
public final class ModDamageTypes {

    public static final ResourceKey<DamageType> VENOM =
            ResourceKey.create(Registries.DAMAGE_TYPE, new ResourceLocation(MonMod.MODID, "venom"));

    private ModDamageTypes() {}
}
```

> :info: `DamageType` est un registre de **datapack** (dynamique), comme les *configured features* ([Générer un minerai](#/worldgen-minerai)). Il n'y a **pas** de `DeferredRegister` : on déclare une `ResourceKey` et on fournit le JSON (à la main ou par datagen), résolue à l'exécution via `RegistryAccess`.

## 3. Créer un `DamageSource` et infliger le dégât

```java
public static DamageSource venom(Level level, @Nullable Entity source) {
    Holder<DamageType> type = level.registryAccess()
            .registryOrThrow(Registries.DAMAGE_TYPE)
            .getHolderOrThrow(ModDamageTypes.VENOM);
    return new DamageSource(type, source);
}

// usage
target.hurt(venom(level, this), 4.0F);
```

> :attention: **Ne mettez jamais en cache** ce `DamageSource` dans un champ `static` : `RegistryAccess` dépend du monde chargé (différent par serveur, recréé à chaque partie). Reconstruisez-le à l'usage — c'est un objet léger.

Pour les dégâts **vanilla**, `Level#damageSources()` (un `DamageSources` déjà résolu) fournit des raccourcis tout faits : `damageSources().magic()`, `.mobAttack(entity)`, `.fall()`, `.drown()`, `.playerAttack(player)`, `.thrown(projectile, owner)`, etc. — préférez-les quand le dégât correspond à un cas vanilla.

## 4. Traduction du message de mort

```json
{
  "death.attack.venom": "%1$s est mort empoisonné",
  "death.attack.venom.player": "%1$s est mort empoisonné en combattant %2$s"
}
```

`%1$s` = la victime, `%2$s` = l'attaquant (variante `.player` utilisée s'il y en a un).

## 5. Brancher sur les mécanismes vanilla via les tags

C'est la partie la plus utile : **ajouter votre type aux tags de dégâts vanilla** pour hériter de comportements standards.

`data/minecraft/tags/damage_type/bypasses_armor.json` :

```json
{ "replace": false, "values": ["monmod:venom"] }
```

Tags vanilla les plus utiles :

| Tag | Effet obtenu |
|-----|--------------|
| `bypasses_armor` | ignore l'armure du joueur |
| `bypasses_invulnerability` | touche même en créatif/spectateur |
| `bypasses_effects` | ignore les effets de statut (résistance…) |
| `bypasses_enchantments` | ignore Protection & co |
| `is_fire` | déclenche l'immunité au feu, éteint par l'eau, `fire_immune` protège |
| `is_explosion` | traite comme une explosion (recul, dégâts de bloc associés) |
| `is_fall` | traite comme une chute (bottes à absorption de choc, etc.) |
| `is_drowning` / `is_freezing` / `is_lightning` | comportements associés |
| `no_knockback` | pas de recul |
| `panic_causes` / `panic_environmental_causes` | fait fuir les animaux |
| `always_hurts_ender_dragons`, `always_most_significant_fall` | cas spéciaux |
| `witch_resistant_to` | la sorcière résiste (comme le poison vanilla) |

Sans ces tags, votre dégât se comporte comme un dégât « générique » : armure et enchantements s'appliquent normalement, ce qui convient à la majorité des cas.

## 6. Datagen (alternative au JSON à la main)

```java
public static void bootstrap(BootstapContext<DamageType> ctx) {
    ctx.register(ModDamageTypes.VENOM,
            new DamageType("venom", DamageScaling.WHEN_CAUSED_BY_LIVING_NON_PLAYER, 0.1F));
}

// dans le DataGenerators, comme pour la génération de monde (voir Générer un minerai)
private static final RegistrySetBuilder BUILDER = new RegistrySetBuilder()
        .add(Registries.DAMAGE_TYPE, ModDamageTypesData::bootstrap);
```

## 7. Réagir à un dégât selon son type

```java
@SubscribeEvent
public static void onLivingHurt(LivingHurtEvent event) {
    if (event.getSource().is(DamageTypeTags.IS_FIRE)) {
        // logique commune à TOUS les dégâts de feu, vanilla ou modding
    }
    if (event.getSource().typeHolder().is(ModDamageTypes.VENOM)) {
        // logique spécifique à votre type
    }
}
```

`source.is(tag)` fonctionne pour un `TagKey<DamageType>` ; `source.typeHolder().is(resourceKey)` compare à une clé précise.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `IllegalStateException` / dégât inconnu au démarrage | JSON absent ou mal placé | `data/<modid>/damage_type/<name>.json` |
| Message de mort générique (« X est mort ») | `message_id` sans traduction | ajouter `death.attack.<message_id>` |
| `DamageSource` mis en cache statique qui casse au 2ᵉ monde | `RegistryAccess` dépend du monde | reconstruire à chaque usage, jamais en `static final` |
| Le dégât traverse toujours l'armure alors que ce n'est pas voulu | présent par erreur dans `bypasses_armor` | retirer l'entrée du tag |
| Un mod tiers ne peut pas rendre une entité immunisée | pas de tag `is_fire`/`is_explosion` pertinent | utiliser le tag vanilla adapté plutôt qu'un type totalement générique |
| Ancien code `DamageSource.MAGIC` ne compile plus | API pré-1.19.4 | utiliser `level.damageSources().magic()` ou un type custom |

Page suivante : **[Ressources : modèles, textures, langues](#/ressources-assets)**.
