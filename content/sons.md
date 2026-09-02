# Sons personnalisés

Ajouter un son : enregistrer un `SoundEvent`, décrire les fichiers dans `sounds.json`, fournir les `.ogg`, puis le jouer.

Prérequis : [Registres & tags](#/registres-tags).

## 1. Enregistrer le `SoundEvent`

```java
public final class ModSounds {

    public static final DeferredRegister<SoundEvent> SOUND_EVENTS =
            DeferredRegister.create(ForgeRegistries.SOUND_EVENTS, MonMod.MODID);

    public static final RegistryObject<SoundEvent> RUBY_CHIME = register("ruby_chime");
    public static final RegistryObject<SoundEvent> PRESS_WORKING = register("block.press.working");

    private static RegistryObject<SoundEvent> register(String name) {
        return SOUND_EVENTS.register(name,
                () -> SoundEvent.createVariableRangeEvent(new ResourceLocation(MonMod.MODID, name)));
    }

    private ModSounds() {}
    public static void register(IEventBus bus) { SOUND_EVENTS.register(bus); }
}
```

- `createVariableRangeEvent` : la portée d'atténuation dépend du volume passé à `playSound` (cas normal).
- `createFixedRangeEvent(float range)` : portée fixe en blocs.

## 2. `sounds.json`

`assets/monmod/sounds.json` — la clé correspond au **path** du `SoundEvent` :

```json
{
  "ruby_chime": {
    "subtitle": "subtitles.monmod.ruby_chime",
    "sounds": [
      "monmod:ruby_chime_1",
      { "name": "monmod:ruby_chime_2", "volume": 0.9, "pitch": 1.1 }
    ]
  },
  "block.press.working": {
    "subtitle": "subtitles.monmod.press_working",
    "sounds": [
      { "name": "monmod:block/press_loop", "stream": false }
    ]
  }
}
```

- Plusieurs entrées dans `sounds` → une est choisie **au hasard** à chaque lecture (variations).
- `"volume"`, `"pitch"`, `"weight"` (probabilité relative), `"stream"` (true pour les musiques longues), `"attenuation_distance"`.
- `"name"` pointe vers un fichier **sans extension**, relatif à `assets/<namespace>/sounds/`.

## 3. Les fichiers audio

Format **OGG Vorbis**. Emplacement pour les exemples ci-dessus :

```text
assets/monmod/sounds/ruby_chime_1.ogg
assets/monmod/sounds/ruby_chime_2.ogg
assets/monmod/sounds/block/press_loop.ogg
```

> :attention: Les sons **positionnels** (émis par un bloc, une entité) doivent être en **mono**. Un fichier stéréo est joué « dans la tête » du joueur sans direction ni atténuation. Les musiques / sons d'ambiance globaux peuvent être en stéréo.

## 4. Sous-titres (accessibilité)

Clé `subtitle` du `sounds.json` → traduction :

```json
{
  "subtitles.monmod.ruby_chime": "Carillon de rubis",
  "subtitles.monmod.press_working": "Presse en marche"
}
```

## 5. Jouer un son

### Depuis le monde (bloc, position)

```java
// Côté serveur : renvoyé à tous les joueurs à portée
level.playSound(null, pos, ModSounds.RUBY_CHIME.get(), SoundSource.BLOCKS, 1.0F, 1.0F);

// Passer le joueur : il ne le REÇOIT pas (utile si le client le joue déjà)
level.playSound(player, player.blockPosition(), ModSounds.RUBY_CHIME.get(),
        SoundSource.PLAYERS, 1.0F, 1.0F);
```

### Depuis une entité

```java
entity.playSound(ModSounds.RUBY_CHIME.get(), 1.0F, 1.0F);
```

### Côté client uniquement (UI, retour local)

```java
Minecraft.getInstance().getSoundManager().play(
        SimpleSoundInstance.forUI(ModSounds.RUBY_CHIME.get(), 1.0F));
```

`SoundSource` : `MASTER`, `MUSIC`, `RECORDS`, `WEATHER`, `BLOCKS`, `HOSTILE`, `NEUTRAL`, `PLAYERS`, `AMBIENT`, `VOICE` — respecte les curseurs de volume du joueur.

## Son en boucle (machine qui tourne)

Un son de boucle se gère **côté client** avec un `AbstractTickableSoundInstance` :

```java
public class PressSoundInstance extends AbstractTickableSoundInstance {

    private final PressBlockEntity be;

    public PressSoundInstance(PressBlockEntity be) {
        super(ModSounds.PRESS_WORKING.get(), SoundSource.BLOCKS, SoundInstance.createUnseededRandom());
        this.be = be;
        this.looping = true;
        this.delay = 0;
        this.volume = 0.6F;
        BlockPos p = be.getBlockPos();
        this.x = p.getX() + 0.5; this.y = p.getY() + 0.5; this.z = p.getZ() + 0.5;
    }

    @Override
    public void tick() {
        if (be.isRemoved() || !be.isWorking()) {
            stop();
        }
    }
}
```

Déclenché quand la machine démarre (ex. dans le BER ou sur un changement d'état synchronisé) :

```java
Minecraft.getInstance().getSoundManager().play(new PressSoundInstance(blockEntity));
```

## Datagen : `SoundDefinitionsProvider`

Génère le `sounds.json` :

```java
public class ModSoundProvider extends SoundDefinitionsProvider {

    public ModSoundProvider(PackOutput output, ExistingFileHelper helper) {
        super(output, MonMod.MODID, helper);
    }

    @Override
    public void registerSounds() {
        add(ModSounds.RUBY_CHIME.get(), definition()
                .subtitle("subtitles.monmod.ruby_chime")
                .with(sound(new ResourceLocation(MonMod.MODID, "ruby_chime_1")),
                      sound(new ResourceLocation(MonMod.MODID, "ruby_chime_2")).volume(0.9)));
    }
}
```

## Sons de blocs (pas / casse)

C'est un `SoundType`, pas un `SoundEvent` isolé :

```java
public static final SoundType RUBY_SOUNDS = new SoundType(
        1.0F, 1.0F,
        ModSounds.RUBY_BREAK.get(), ModSounds.RUBY_STEP.get(),
        ModSounds.RUBY_PLACE.get(), ModSounds.RUBY_HIT.get(), ModSounds.RUBY_FALL.get());

// dans les Properties du bloc :
BlockBehaviour.Properties.of().sound(RUBY_SOUNDS);
```

## Disque de musique

```java
public static final RegistryObject<Item> RECORD_MYSTIC = ITEMS.register("music_disc_mystic",
        () -> new RecordItem(15, ModSounds.MUSIC_DISC_MYSTIC, new Item.Properties().stacksTo(1).rarity(Rarity.RARE), 174 * 20));
// 15 = signal de redstone du comparateur ; 174*20 = durée en ticks (pour /jukebox et l'affichage)
```

Le `SoundEvent` du disque doit avoir `"stream": true` et être en `SoundSource.RECORDS`. Ajoutez l'item au tag `#minecraft:music_discs`.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Aucun son / `Unable to play unknown soundEvent` | clé `sounds.json` ≠ path du `SoundEvent` | aligner les noms |
| Son « dans la tête » sans direction | fichier stéréo pour un son positionnel | ré-encoder en mono |
| `.ogg` introuvable | mauvais chemin (`sounds/` implicite) | `assets/<ns>/sounds/<name>.ogg` |
| Boucle qui ne s'arrête jamais | `tick()` n'appelle jamais `stop()` | condition d'arrêt dans `tick()` |
| Le son ignore le volume des options | mauvais `SoundSource` | choisir la bonne catégorie |
| Double son (client + serveur) | `playSound(null, ...)` + le client rejoue | passer le joueur en 1ᵉʳ argument côté serveur |

Page suivante : **[Particules personnalisées](#/particules)**.
