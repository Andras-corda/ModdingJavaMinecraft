# Particules personnalisées

Une particule custom = un `ParticleType` (enregistré, commun), un `Particle` + `ParticleProvider` (client), une texture, et un fichier `particles/<nom>.json`.

Prérequis : [Registres & tags](#/registres-tags), [Le système d'événements](#/evenements).

## 1. Enregistrer le `ParticleType`

Pour une particule sans données supplémentaires, `SimpleParticleType` suffit :

```java
public final class ModParticles {

    public static final DeferredRegister<ParticleType<?>> PARTICLE_TYPES =
            DeferredRegister.create(ForgeRegistries.PARTICLE_TYPES, MonMod.MODID);

    public static final RegistryObject<SimpleParticleType> RUBY_SPARK =
            PARTICLE_TYPES.register("ruby_spark", () -> new SimpleParticleType(false));
    //                                                                          ^ overrideLimiter :
    //                                    true = ignore la limite de particules (à réserver aux effets rares)

    private ModParticles() {}
    public static void register(IEventBus bus) { PARTICLE_TYPES.register(bus); }
}
```

## 2. La texture et le fichier `particles/`

- Texture : `assets/monmod/textures/particle/ruby_spark_0.png` (et `_1`, `_2`… pour une animation).
- Définition : `assets/monmod/particles/ruby_spark.json`

```json
{
  "textures": [
    "monmod:ruby_spark_0",
    "monmod:ruby_spark_1",
    "monmod:ruby_spark_2"
  ]
}
```

Le jeu construit un *atlas* de particules à partir de tous ces fichiers.

## 3. La classe `Particle` (client)

Le plus simple : hériter de `TextureSheetParticle`.

```java
public class RubySparkParticle extends TextureSheetParticle {

    private final SpriteSet sprites;

    protected RubySparkParticle(ClientLevel level, double x, double y, double z,
                                double vx, double vy, double vz, SpriteSet sprites) {
        super(level, x, y, z);
        this.sprites = sprites;
        this.friction = 0.96F;
        this.gravity = 0.2F;
        this.xd = vx; this.yd = vy; this.zd = vz;
        this.quadSize *= 0.6F + this.random.nextFloat() * 0.4F;
        this.lifetime = 20 + this.random.nextInt(20);
        this.rCol = 0.85F; this.gCol = 0.1F; this.bCol = 0.2F;   // teinte rouge rubis
        this.setSpriteFromAge(sprites);
    }

    @Override
    public void tick() {
        super.tick();
        this.setSpriteFromAge(sprites);       // avance l'animation
    }

    @Override
    public ParticleRenderType getRenderType() {
        return ParticleRenderType.PARTICLE_SHEET_TRANSLUCENT;
    }

    /** Le provider : instancié une fois côté client. */
    public static class Provider implements ParticleProvider<SimpleParticleType> {
        private final SpriteSet sprites;
        public Provider(SpriteSet sprites) { this.sprites = sprites; }

        @Override
        public Particle createParticle(SimpleParticleType type, ClientLevel level,
                                       double x, double y, double z,
                                       double vx, double vy, double vz) {
            return new RubySparkParticle(level, x, y, z, vx, vy, vz, sprites);
        }
    }
}
```

`ParticleRenderType` : `PARTICLE_SHEET_OPAQUE`, `PARTICLE_SHEET_TRANSLUCENT`, `PARTICLE_SHEET_LIT`, `CUSTOM`.

## 4. Enregistrer le provider (client)

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ModParticleProviders {

    @SubscribeEvent
    public static void register(RegisterParticleProvidersEvent event) {
        event.registerSpriteSet(ModParticles.RUBY_SPARK.get(), RubySparkParticle.Provider::new);
    }
}
```

- `registerSpriteSet` : la particule pioche dans les textures du `particles/*.json`.
- `registerSprite` / `registerSpecial` : autres modes (sprite unique, contrôle total).

## 5. Faire apparaître la particule

### Côté serveur — visible par tous

```java
if (level instanceof ServerLevel server) {
    server.sendParticles(
            ModParticles.RUBY_SPARK.get(),
            x, y, z,
            12,                 // nombre
            0.3, 0.3, 0.3,      // dispersion (dx, dy, dz)
            0.05);              // "speed" (facteur de vitesse)
}
```

### Côté client — local (dans un tick client, un BER, un événement de rendu)

```java
level.addParticle(ModParticles.RUBY_SPARK.get(), x, y, z, vx, vy, vz);
```

> :attention: `level.addParticle(...)` appelé sur le serveur ne fait **rien**. `ServerLevel#sendParticles` appelé sur le client plante. Règle : logique de jeu → `sendParticles` ; effets purement décoratifs déjà côté client → `addParticle`.

## Particule avec données (couleur, taille variables)

Comme `dust` vanilla (`DustParticleOptions`). Il faut :

1. une classe `ParticleOptions` portant les données + son `Codec` + son `Deserializer` ;
2. un `ParticleType<MesOptions>` (pas `SimpleParticleType`) avec `codec()` / `getDeserializer()` ;
3. lire les données dans le constructeur de la particule.

C'est nettement plus verbeux ; inspirez-vous de `net.minecraft.core.particles.DustParticleOptions` et `DustParticleBase`. Pour la plupart des besoins (une teinte fixe par type), créez **plusieurs `SimpleParticleType`**.

## Rappel : particules vanilla courantes

Utilisables directement sans rien enregistrer :

| Type | Effet |
|------|-------|
| `ParticleTypes.FLAME`, `SMOKE`, `LARGE_SMOKE` | feu / fumée |
| `ParticleTypes.END_ROD` | traînée blanche lente |
| `ParticleTypes.ELECTRIC_SPARK`, `CRIT`, `ENCHANTED_HIT` | impacts |
| `ParticleTypes.HEART`, `ANGRY_VILLAGER`, `HAPPY_VILLAGER` | humeurs |
| `ParticleTypes.PORTAL`, `REVERSE_PORTAL` | téléportation |
| `ParticleTypes.SNOWFLAKE`, `SPLASH`, `BUBBLE` | météo / eau |
| `new BlockParticleOption(ParticleTypes.BLOCK, state)` | éclats d'un bloc |
| `new ItemParticleOption(ParticleTypes.ITEM, stack)` | éclats d'un item |
| `new DustParticleOptions(new Vector3f(r,g,b), scale)` | poussière colorée |

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Rien ne s'affiche | provider non enregistré | `RegisterParticleProvidersEvent` |
| Carreau rose / texture manquante | `particles/<nom>.json` absent ou mauvais chemin de texture | `textures/particle/<name>.png` + JSON |
| `addParticle` sans effet | appelé côté serveur | `ServerLevel#sendParticles` |
| Crash `ClassCastException` sur `SimpleParticleType` | particule avec données mais type simple | créer un vrai `ParticleType<Options>` |
| Particules qui disparaissent aussitôt | `lifetime` non défini (0) | `this.lifetime = ...` dans le constructeur |
| Peu de particules apparaissent | limite de particules du client | `new SimpleParticleType(true)` pour les effets clés |

Page suivante : **[Modèles, item overrides & rendu](#/modeles-rendu)**.
