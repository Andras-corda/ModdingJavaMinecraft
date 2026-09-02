# Ressources : modèles, textures, langues

Un item ou bloc enregistré a besoin de **ressources client** pour être visible : un modèle, une texture, un nom traduit. Cette page montre comment les écrire **à la main**. La page suivante ([Datagen](#/datagen)) montre comment les **générer**.

Toutes ces ressources vivent dans `src/main/resources/assets/monmod/`.

## Textures

- Format **PNG**, généralement **16×16** pixels.
- `assets/monmod/textures/item/sapphire.png`
- `assets/monmod/textures/block/sapphire_block.png`

Les noms de fichiers sont libres, mais par convention on reprend l'identifiant.

## Modèle d'item simple

`assets/monmod/models/item/sapphire.json` :

```json
{
  "parent": "minecraft:item/generated",
  "textures": {
    "layer0": "monmod:item/sapphire"
  }
}
```

`item/generated` = un item plat 2D. `monmod:item/sapphire` pointe vers `textures/item/sapphire.png`.

## Bloc « cube plein »

Il faut **trois** fichiers pour un bloc classique.

### 1. Blockstate

`assets/monmod/blockstates/sapphire_block.json` — associe les états du bloc à des modèles :

```json
{
  "variants": {
    "": { "model": "monmod:block/sapphire_block" }
  }
}
```

### 2. Modèle de bloc

`assets/monmod/models/block/sapphire_block.json` :

```json
{
  "parent": "minecraft:block/cube_all",
  "textures": {
    "all": "monmod:block/sapphire_block"
  }
}
```

`cube_all` = même texture sur les 6 faces. Autres parents utiles : `cube_bottom_top`, `cube_column`, `orientable`, `cross` (plantes).

### 3. Modèle d'item du bloc

`assets/monmod/models/item/sapphire_block.json` — pour l'aperçu en inventaire / en main :

```json
{
  "parent": "monmod:block/sapphire_block"
}
```

> :attention: Oublier le modèle **d'item** du bloc est l'erreur la plus fréquente : le bloc s'affiche dans le monde mais est invisible dans la main / l'inventaire.

## Traductions (`lang`)

`assets/monmod/lang/en_us.json` :

```json
{
  "itemGroup.monmod.main": "Mon Mod",

  "item.monmod.sapphire": "Sapphire",
  "item.monmod.sapphire_dust": "Sapphire Dust",

  "block.monmod.sapphire_block": "Block of Sapphire",
  "block.monmod.sapphire_ore": "Sapphire Ore"
}
```

`assets/monmod/lang/fr_fr.json` :

```json
{
  "itemGroup.monmod.main": "Mon Mod",

  "item.monmod.sapphire": "Saphir",
  "item.monmod.sapphire_dust": "Poudre de saphir",

  "block.monmod.sapphire_block": "Bloc de saphir",
  "block.monmod.sapphire_ore": "Minerai de saphir"
}
```

Clés de traduction : `item.<modid>.<nom>`, `block.<modid>.<nom>`, `itemGroup.<modid>.<nom>`, `<modid>.config.<clé>`, etc.

> :astuce: Fournissez **toujours** `en_us.json` complet : c'est la langue de repli. Ajoutez `fr_fr.json` (et d'autres) ensuite. Dans le code, n'écrivez jamais de texte en dur : utilisez `Component.translatable("clé")`.

## Recettes (données, pas assets)

Dans `data/monmod/recipes/`. Exemple `sapphire_block.json` (craft 3×3) :

```json
{
  "type": "minecraft:crafting_shaped",
  "pattern": ["SSS", "SSS", "SSS"],
  "key": {
    "S": { "item": "monmod:sapphire" }
  },
  "result": { "item": "monmod:sapphire_block" }
}
```

Fusion (`sapphire_dust` → `sapphire`), `smelting.json` :

```json
{
  "type": "minecraft:smelting",
  "ingredient": { "item": "monmod:sapphire_dust" },
  "result": "monmod:sapphire",
  "experience": 0.7,
  "cookingtime": 200
}
```

## Table de butin d'un bloc

Pour qu'un bloc lâche quelque chose quand on le casse : `data/monmod/loot_tables/blocks/sapphire_block.json` :

```json
{
  "type": "minecraft:block",
  "pools": [
    {
      "rolls": 1,
      "entries": [
        { "type": "minecraft:item", "name": "monmod:sapphire_block" }
      ],
      "conditions": [
        { "condition": "minecraft:survives_explosion" }
      ]
    }
  ]
}
```

Sans table de butin, casser le bloc ne donne **rien** (sauf en créatif). Le minerai qui lâche une gemme avec Fortune et Touch of Silk est plus complexe — c'est un bon candidat pour la datagen.

## Tags

Les tags regroupent des blocs/items pour les outils, recettes, comportements. `data/monmod/tags/blocks/needs_iron_tool.json` :

```json
{
  "replace": false,
  "values": ["monmod:sapphire_ore", "monmod:sapphire_block"]
}
```

Et pour que la pioche mine le bloc à vitesse normale, ajoutez-le à `minecraft:mineable/pickaxe` : `data/minecraft/tags/blocks/mineable/pickaxe.json` :

```json
{ "replace": false, "values": ["monmod:sapphire_ore", "monmod:sapphire_block"] }
```

> :info: On peut placer un fichier de tag sous `data/minecraft/tags/...` **depuis son mod** : Forge fusionne les tags de tous les mods. C'est la bonne façon d'étendre un tag vanilla.

## Vérifier

```bash
./gradlew runClient
```

- Textures visibles en main et dans le monde.
- Noms traduits (mettez le jeu en français pour tester `fr_fr`).
- `/give @s monmod:sapphire`, cassez un bloc pour vérifier le butin.
- En cas de modèle manquant : le log affiche `Exception loading blockstate definition` ou `Unable to load model` avec le chemin fautif — lisez-le attentivement (souvent une faute de casse ou un `modid` oublié).

Écrire tous ces JSON à la main devient vite pénible et **source de conflits Git**. Passez à la page suivante : **[Génération de données (datagen)](#/datagen)**.
