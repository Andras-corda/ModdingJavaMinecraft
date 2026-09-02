# Access Transformers

Un **Access Transformer** (AT) change la **visibilité** (et le caractère `final`) d'un champ, d'une méthode ou d'une classe de Minecraft, au chargement. C'est le moyen le plus simple d'accéder à un membre `private`/`protected` de vanilla — plus léger qu'un mixin, plus robuste que la réflexion.

## Quand l'utiliser

| Besoin | Outil |
|--------|-------|
| Lire / écrire un champ `private` de vanilla | **AT** (`public`) |
| Appeler une méthode `protected`/`private` de vanilla | **AT** (`public`) |
| Étendre une classe et appeler une méthode `protected` | souvent **inutile** (déjà accessible depuis une sous-classe) |
| Retirer `final` d'un champ pour le réassigner | **AT** (`public-f`) — à éviter si possible |
| Modifier le *corps* d'une méthode | **Mixin** (pas un AT) |
| Ajouter un comportement | **Événement** ou **Mixin** |

## Mise en place

### 1. Le fichier

`src/main/resources/META-INF/accesstransformer.cfg` :

```text
# Format : <modificateur> <classe> [<membre>] # commentaire

# Rendre public un champ
public net.minecraft.world.entity.LivingEntity f_20939_ # lastHurtByPlayerTime

# Rendre public une méthode
public net.minecraft.server.level.ServerPlayer m_9209_(Lnet/minecraft/world/level/portal/DimensionTransition;)V # changeDimension

# Rendre public ET non-final un champ
public-f net.minecraft.world.level.biome.Biome f_47437_ # climateSettings

# Rendre protected -> public une classe interne
public net.minecraft.world.item.CrossbowItem$ChargingSounds
```

- **`f_20939_`** / **`m_9209_`** : ce sont les **noms SRG** (obfusqués intermédiaires). Le commentaire donne le nom lisible.
- Modificateurs : `public`, `protected`, `default`, `private` ; suffixe `-f` pour retirer `final`, `+f` pour l'ajouter.

### 2. Déclarer l'AT dans `build.gradle`

```gradle
minecraft {
    accessTransformer = file('src/main/resources/META-INF/accesstransformer.cfg')
    // ...
}
```

### 3. Rafraîchir l'environnement

```bash
./gradlew --refresh-dependencies
```

Puis **ré-importer** le projet Gradle (IntelliJ : *Reload All Gradle Projects* ; VS Code : recharger la fenêtre). Le membre devient visible dans l'auto-complétion.

## Trouver le nom SRG

- **Plugin « Minecraft Development » (IntelliJ)** : clic droit sur le champ/méthode dans les sources vanilla → *Copy AT entry* → colle directement la ligne dans `accesstransformer.cfg`. **La méthode recommandée.**
- Sinon : consulter les mappings (`build/tmp/…`) ou la base de données de mappings en ligne.

## Exemple concret

Vous voulez lire le compteur `noActionTime` (`f_20922_`, `private int`) de `LivingEntity` pour votre logique d'IA :

```text
# accesstransformer.cfg
public net.minecraft.world.entity.LivingEntity f_20922_ # noActionTime
```

```java
// après --refresh + re-import
int idle = livingEntity.noActionTime;   // compile désormais
```

## AT vs réflexion vs mixin `@Accessor`

| | AT | Réflexion | Mixin `@Accessor` |
|-|----|-----------|--------------------|
| Perf | native (aucun coût) | lente | native |
| Robustesse mise à jour | bonne (SRG stable) | fragile (noms) | bonne |
| Setup | 1 ligne + refresh | rien | config mixin complète |
| Portée | globale (toute la JVM) | ciblée | ciblée |
| Lisibilité | bonne | mauvaise | moyenne |

→ **AT par défaut** pour de la visibilité. Mixin `@Accessor`/`@Invoker` si vous avez déjà une config mixin et voulez rester ciblé.

## En équipe

- **Committez** `accesstransformer.cfg` et la ligne `build.gradle`.
- Après chaque ajout d'entrée, prévenez l'équipe : chacun fait `--refresh-dependencies` + re-import, sinon « ça ne compile pas chez moi ».
- Gardez le fichier **minimal et commenté** : une entrée = un besoin réel, avec le nom lisible en commentaire.
- Les AT s'appliquent à **tout le jeu** : deux mods qui rendent le même champ `public` ne se gênent pas, mais évitez de retirer `final` sans raison sérieuse.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le membre reste inaccessible | pas de `--refresh-dependencies` / re-import | relancer, ré-importer Gradle |
| `build.gradle` ignore l'AT | ligne `accessTransformer = ...` absente ou hors du bloc `minecraft` | vérifier l'emplacement |
| `error: cannot find symbol` sur le nom SRG | AT correct mais on utilise `f_20922_` au lieu du nom mappé | utiliser le nom **lisible** dans le code (`noActionTime`) |
| Fonctionne en dev, `NoSuchFieldError` en prod | AT non embarqué / mauvais nom SRG | l'AT doit être dans `META-INF/` du jar ; vérifier le nom via le plugin MCDev |
| Conflit de compilation après un `git pull` | nouvelle entrée d'AT non prise en compte | `--refresh-dependencies` + re-import |

Page suivante : **[Compatibilité entre mods](#/compatibilite)**.
