# Patchouli : livre de guide

**Patchouli** affiche un **livre de guide en jeu**, entièrement défini en **JSON** (aucun code de rendu). Idéal pour documenter votre contenu là où le joueur en a besoin.

> :attention: **Versions.** Patchouli **1.20.1-8x** sur [maven.blamejared.com](https://maven.blamejared.com). Doc : [vazkiimods.github.io/Patchouli](https://vazkiimods.github.io/Patchouli/).

## 1. Dépendance

```gradle
repositories { maven { url = "https://maven.blamejared.com" } }
dependencies {
    implementation fg.deobf("vazkii.patchouli:Patchouli:${patchouli_version}")
}
```

## 2. Arborescence du livre

```text
src/main/resources/data/monmod/patchouli_books/guide/
├── book.json
└── en_us/
    ├── categories/
    │   └── basics.json
    └── entries/
        ├── getting_started.json
        └── ruby_press.json
```

Le dossier `guide/` = l'ID du livre → `monmod:guide`. `en_us/` = langue (créez `fr_fr/` pour traduire, ou utilisez des clés `lang`).

## 3. `book.json`

```json
{
  "name": "book.monmod.guide.name",
  "landing_text": "book.monmod.guide.landing",
  "icon": "monmod:ruby",
  "creative_tab": "monmod.main",
  "model": "patchouli:book_brown",
  "show_progress": true,
  "version": 1,
  "i18n": true
}
```

Avec `"i18n": true`, `name`/`landing_text` sont des **clés de traduction** (recommandé).

## 4. Une catégorie — `categories/basics.json`

```json
{
  "name": "Les bases",
  "description": "Premiers pas avec Mon Mod.",
  "icon": "monmod:ruby",
  "sortnum": 0
}
```

## 5. Une entrée — `entries/ruby_press.json`

```json
{
  "name": "La presse à rubis",
  "category": "monmod:basics",
  "icon": "monmod:ruby_press",
  "advancement": "monmod:main/craft_press",
  "pages": [
    {
      "type": "patchouli:text",
      "text": "La $(item)presse à rubis$() transforme un rubis en $(item)plaque$(). Elle consomme du temps mais pas d'énergie."
    },
    {
      "type": "patchouli:crafting",
      "recipe": "monmod:ruby_press",
      "text": "Recette de fabrication."
    },
    {
      "type": "patchouli:spotlight",
      "item": "monmod:ruby_plate",
      "text": "La plaque sert à fabriquer les machines de tier 2."
    },
    {
      "type": "patchouli:image",
      "images": [ "monmod:textures/guide/press_setup.png" ],
      "text": "Installation type.",
      "border": true
    }
  ]
}
```

`advancement` (facultatif) : l'entrée reste **verrouillée** tant que l'avancement n'est pas obtenu — utile pour révéler le contenu progressivement.

### Types de pages courants

| `type` | Contenu |
|--------|---------|
| `patchouli:text` | texte formaté (voir codes ci-dessous) |
| `patchouli:crafting` | 1–2 recettes de craft |
| `patchouli:smelting` | recette de four |
| `patchouli:spotlight` | met un item en avant + description |
| `patchouli:image` | une ou plusieurs images |
| `patchouli:entity` | affiche une entité en 3D |
| `patchouli:multiblock` | schéma de multi-bloc (avec matérialisation en jeu) |
| `patchouli:link` | bouton vers une URL / une autre entrée |
| `patchouli:relations` | liens « voir aussi » |

### Codes de formatage du texte

`$(item)` gras coloré, `$(thing)` autre couleur, `$(l:entrée)…$()` lien interne, `$(br)` saut de ligne, `$(bold)`, `$(o)` italique, `$(#RRGGBB)` couleur, `$(k:key.jump)` touche, `$()` reset.

## 6. Donner le livre au joueur

```java
// Item du livre
ItemStack book = PatchouliAPI.get().getBookStack(new ResourceLocation(MonMod.MODID, "guide"));

// Le donner à la connexion (une seule fois)
@SubscribeEvent
public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
    Player player = event.getEntity();
    CompoundTag data = player.getPersistentData()
            .getCompound(Player.PERSISTED_NBT_TAG);
    if (!data.getBoolean("monmod_got_guide")) {
        player.addItem(PatchouliAPI.get().getBookStack(new ResourceLocation(MonMod.MODID, "guide")));
        data.putBoolean("monmod_got_guide", true);
        player.getPersistentData().put(Player.PERSISTED_NBT_TAG, data);
    }
}
```

Ou : une **recette de craft** normale pour `patchouli:guide_book` avec le NBT `patchouli:book` = `"monmod:guide"` (générée par datagen ou JSON à la main).

## 7. Traductions

`assets/monmod/lang/fr_fr.json` (si `"i18n": true`) :

```json
{
  "book.monmod.guide.name": "Guide de Mon Mod",
  "book.monmod.guide.landing": "Bienvenue. Ce livre se remplit au fil de vos découvertes."
}
```

Le texte des **entrées** peut aussi passer par des clés `lang` si vous mettez une clé au lieu du texte brut.

## 8. Dépendance douce ?

Souvent **dure** si le livre est le principal support de doc. Pour la rendre douce : `compileOnly`/`runtimeOnly`, `type="optional"`, et ne donnez le livre que si `ModList.get().isLoaded("patchouli")`. Les fichiers JSON du livre ne gênent pas si Patchouli est absent (ils sont juste ignorés).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Livre vide / « no categories » | dossier mal nommé (`patchouli_books/<id>/`) | respecter `data/<modid>/patchouli_books/<bookid>/` |
| Entrée absente | `category` pointe vers un ID inexistant | `"category": "monmod:basics"` = fichier `categories/basics.json` |
| Textes = clés brutes affichées | `"i18n": true` mais traductions manquantes | fournir les clés dans `lang/` |
| Recette « recipe not found » sur une page crafting | ID de recette faux | vérifier `data/monmod/recipes/...` |
| Le livre ne se met pas à jour après édition | cache | `/reload` ou relancer ; `F3+T` ne suffit pas toujours |
| Image déformée | dimensions ≠ 256×256 | utiliser des images 256×256 (zone utile ~200×200) |

Page suivante : **[Cloth Config : écran de configuration](#/cloth-config)**.
