# Blockbench : blocs & items

Créer les modèles `.json` de blocs et d'items avec le format **Java Block/Item** de Blockbench, et les brancher dans le mod.

Prérequis : [Blockbench : prise en main](#/blockbench-prise-en-main), [Ressources : modèles, textures, langues](#/ressources-assets).

## Le format « Java Block/Item » et ses limites

Le moteur de rendu de blocs de Minecraft est **volontairement limité**. Blockbench applique ces règles :

| Règle | Détail |
|-------|--------|
| **Cubes uniquement** | pas de maillage libre, pas de triangles |
| **Rotation d'élément** | **un seul axe à la fois**, et seulement **±22.5° ou ±45°** |
| **Taille** | chaque coordonnée entre **−16 et 32** |
| **Pas d'os animés** | c'est un modèle statique |

Si vous avez besoin de plus (rotation libre, animation, grande taille) → ce n'est **pas** un modèle de bloc : c'est une **entité** ou un *block entity* rendu par un [BER](#/modeles-rendu) ou [GeckoLib](#/blockbench-entites-geckolib).

## Modèle de bloc « cube plein » (le plus courant)

Souvent, inutile d'ouvrir Blockbench : héritez d'un parent vanilla.

`assets/monmod/models/block/sapphire_block.json` :

```json
{
  "parent": "minecraft:block/cube_all",
  "textures": { "all": "monmod:block/sapphire_block" }
}
```

Parents utiles : `cube_all`, `cube_column` (`end` + `side`), `cube_bottom_top`, `orientable` (`front`/`side`/`top`), `cross` (plante), `slab`, `stairs`.

## Modèle de bloc custom (dans Blockbench)

Pour une forme (table, machine, statue) :

1. **File → New → Java Block/Item**.
2. Construisez avec des cubes (respectez la limite de rotation).
3. **Textures → +** : importez vos PNG. Réglez l'**UV** face par face.
4. Onglet **UV** : sélectionnez une face, tirez la zone sur la texture. `Ctrl+clic` sélectionne plusieurs faces.
5. **Particle texture** : dans le panneau Textures, clic droit sur une texture → *Set as Particle Texture* (les particules de casse/pas prennent celle-ci).
6. **File → Export → Java Block/Item Model** → `polisher.json` dans `assets/monmod/models/block/`.
7. Créez le **blockstate** à la main (Blockbench ne le fait pas) :

`assets/monmod/blockstates/polisher.json` :

```json
{
  "variants": {
    "facing=north": { "model": "monmod:block/polisher" },
    "facing=east":  { "model": "monmod:block/polisher", "y": 90 },
    "facing=south": { "model": "monmod:block/polisher", "y": 180 },
    "facing=west":  { "model": "monmod:block/polisher", "y": 270 }
  }
}
```

8. **Modèle d'item du bloc** (`models/item/polisher.json`) :

```json
{ "parent": "monmod:block/polisher" }
```

> :attention: Oublier le modèle **d'item** du bloc est l'erreur n°1 : le bloc s'affiche dans le monde mais est invisible en main / dans l'inventaire.

## Modèle d'item plat

`assets/monmod/models/item/sapphire.json` :

```json
{
  "parent": "minecraft:item/generated",
  "textures": { "layer0": "monmod:item/sapphire" }
}
```

Plusieurs calques superposés : `layer0`, `layer1`… (utile pour un item + une surcouche colorée via `tintindex`).

Pour un outil tenu « en main » : parent `minecraft:item/handheld`.

## Transformations d'affichage (mode **Display**)

Un item apparaît dans 8 contextes (main droite/gauche en 3ᵉ/1ʳᵉ personne, GUI, tête, sol, cadre). Le mode **Display** de Blockbench règle position/rotation/échelle pour chacun ; l'export les écrit dans `"display"` du JSON.

```json
{
  "parent": "minecraft:item/generated",
  "textures": { "layer0": "monmod:item/ruby_wand" },
  "display": {
    "thirdperson_righthand": { "rotation": [0, -90, 55], "translation": [0, 4, 0.5], "scale": [0.85, 0.85, 0.85] },
    "firstperson_righthand":  { "rotation": [0, -90, 25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68] },
    "gui":                     { "rotation": [0, 0, 0], "translation": [0, 0, 0], "scale": [1, 1, 1] },
    "ground":                  { "translation": [0, 2, 0], "scale": [0.5, 0.5, 0.5] },
    "head":                    { "translation": [0, 13, 7], "scale": [1, 1, 1] }
  }
}
```

Point de départ pratique : partez du parent `minecraft:item/handheld` (déjà de bonnes valeurs pour un outil) et ajustez seulement ce qui gêne.

## Modèles conditionnels (`overrides`)

Un item qui change d'apparence selon un état (durabilité, `CustomModelData`, arc bandé…) : voir [Modèles & rendu → item overrides](#/modeles-rendu).

## Brancher dans le mod

- Le **nom du fichier modèle** doit correspondre à ce que pointe le blockstate / à l'identifiant de l'item (`monmod:block/polisher` → `models/block/polisher.json`).
- Blocs : `blockstates/<nom>.json` + `models/block/<nom>.json` + `models/item/<nom>.json`.
- Items : `models/item/<nom>.json` (nom = *path* de l'`Item` enregistré).
- Traductions : `item.monmod.<nom>` / `block.monmod.<nom>` dans `lang/`.
- Tout ça peut être **généré** par [datagen](#/datagen) à la place du JSON à la main — pratique dès qu'il y a plusieurs blocs similaires.

## Vérifier en jeu

```bash
./gradlew runClient
```

`F3 + T` recharge les ressources sans redémarrer. Modèle manquant → le log affiche `Unable to load model: 'monmod:block/xxx'` avec le chemin fautif.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Bloc invisible en main / inventaire | pas de `models/item/<bloc>.json` | l'ajouter (`{ "parent": "monmod:block/<bloc>" }`) |
| Export bloqué : « rotation invalide » | cube tourné sur 2 axes ou hors ±22.5/±45 | rester dans la limite, ou passer en modèle d'entité |
| Bloc noir/rose dans le monde | texture manquante ou UV vide sur une face | vérifier chemins + *Auto UV* |
| Le bloc ne tourne pas au placement | blockstate sans `"y"` par direction | ajouter les rotations dans le blockstate |
| Particules de casse fausses | pas de *Particle Texture* définie | clic droit sur la texture → *Set as Particle Texture* |
| Item en main mal orienté | pas de section `display` | régler en mode Display, ou hériter de `item/handheld` |

Page suivante : **[Blockbench : entités & GeckoLib](#/blockbench-entites-geckolib)**.
