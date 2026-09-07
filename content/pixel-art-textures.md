# Pixel art & textures Minecraft

Une texture Minecraft, c'est du **pixel art** : petite, sans anti-aliasing, avec une palette réduite. Cette page couvre les conventions du style, l'animation, la transparence, et où placer les fichiers.

Voir aussi [Ressources : modèles, textures, langues](#/ressources-assets) (câblage modèle ↔ texture) et [Modèles & rendu](#/modeles-rendu) (teintes, *render types*).

## Format et résolution

| Point | Valeur |
|-------|--------|
| Format | **PNG**, RVBA 8 bits (l'indexé marche, le RVBA est plus simple) |
| Résolution par défaut | **16 × 16** (une face de bloc, un item) |
| HD | tout multiple de 16 (32, 64, 128…), **cohérent** dans tout le mod |
| Anti-aliasing | **désactivé** partout (bords de pixels nets) |
| Interpolation à l'export | **aucune** (« nearest », pas « bilinéaire ») |

Un item plat (`item/generated`) : 16×16, le reste transparent. Un bloc `cube_all` : 16×16 répété sur 6 faces.

## Le style vanilla en 6 règles

1. **Palette réduite.** 3 à 5 nuances par matériau. Pas de dégradé lisse.
2. **Décalage de teinte (*hue shift*).** Les ombres ne sont pas juste « plus sombres » : elles tirent vers le **bleu/violet**, les lumières vers le **jaune/orange**. Un bois d'ombre est brun-violacé, pas brun-gris.
3. **Bruit / *dithering*.** Vanilla parsème les surfaces de pixels isolés d'une 2ᵉ nuance (motif en damier léger) pour « texturer » sans dessiner de détail.
4. **Lisibilité avant détail.** La silhouette et le contraste comptent plus que la finesse : ça doit se lire à 16 px, en mouvement.
5. **Lumière du jeu.** Les **faces de blocs** sont ombrées automatiquement par le moteur (une face nord est plus sombre qu'une face haute) — ne « peignez » pas l'ombre directionnelle sur un bloc. Les **items** ont un rendu figé : là, un léger volume peint aide.
6. **Contour (optionnel).** Beaucoup de mods cernent les items d'un liseré 1 px plus sombre ; vanilla est inconstant. Choisissez une règle et tenez-la sur tout le mod.

## Outils

| Outil | Note |
|-------|------|
| **Blockbench (mode Paint)** | peindre **sur le modèle 3D** ; pinceau *dithering* intégré ; idéal pour les faces multiples |
| **Aseprite** (payant) | la référence du pixel art (palettes, calques, animation, aperçu tuilé) |
| **GIMP** / **Krita** (gratuits) | complets ; désactiver l'interpolation, activer la grille au pixel |
| **Photopea** (gratuit, web) | interface Photoshop |
| **Paint.NET** (gratuit, Windows) | simple et efficace |
| **Pixilart**, **Lospec Pixel Editor** (web) | rapides pour un essai |

Dans tous : zoom 800–1600 %, grille au pixel, crayon 1 px, remplissage **sans** tolérance de dégradé.

## Où vont les fichiers

```text
src/main/resources/assets/monmod/textures/
├── block/         sapphire_ore.png, sapphire_block.png ...
├── item/          sapphire.png, ruby_sword.png ...
├── entity/        sprite.png, sprite/variant_1.png ...
├── gui/           infuser.png (interfaces de conteneur)
├── models/armor/  ruby_layer_1.png, ruby_layer_2.png
└── particle/      ruby_spark_0.png ...
```

Les noms sont libres, mais on reprend l'identifiant du bloc/item par convention. La **casse** compte (`Sapphire.png` ≠ `sapphire.png`) — surtout sur GitHub / serveur Linux.

## Textures animées

Une texture animée = **une bande verticale** de N cases 16×16 empilées (donc `16 × 16N`) **+** un fichier `.mcmeta` du **même nom** avec `.png.mcmeta` :

`assets/monmod/textures/block/magic_ore.png` (16×64 = 4 images)
`assets/monmod/textures/block/magic_ore.png.mcmeta` :

```json
{
  "animation": {
    "frametime": 3,
    "interpolate": false,
    "frames": [0, 1, 2, 3, 2, 1]
  }
}
```

- `frametime` : durée d'une image, en ticks (20 ticks = 1 s).
- `frames` : ordre de lecture (permet des allers-retours, des pauses en répétant un index).
- `interpolate: true` : fond les images entre elles (eau, lave) — plus doux mais plus coûteux.

Fonctionne aussi pour les items et les particules.

## Transparence

| Cas | *Render type* du bloc | Exemple |
|-----|----------------------|---------|
| Opaque | `solid` (défaut) | pierre, métal |
| Tout ou rien (0 % ou 100 %) | **`cutout`** ou `cutout_mipped` | verre à barreaux, feuillage, plante, minerai à trou |
| Alpha partiel (dégradé) | **`translucent`** | verre teinté, glace, cristal |

On règle le *render type* dans le **modèle** du bloc (champ `"render_type"` en 1.20) ou par code — détails dans [Modèles & rendu](#/modeles-rendu).

> :attention: Pour une texture *cutout*, mettez les pixels **transparents en RVB neutre** (idéalement la couleur du pixel opaque voisin). Sinon, le *mipmapping* fait « baver » une frange colorée sur les bords vus de loin.

## Teintes dynamiques (feuillage, potions)

Une texture peut être **grise** et colorée à l'exécution selon le biome (herbe) ou une donnée (potion). Le modèle marque la face avec `"tintindex": 0`, et vous fournissez la couleur via `RegisterColorHandlersEvent` — voir [Modèles & rendu](#/modeles-rendu).

## Cohérence d'un pack

- Une **palette maîtresse** par famille de matériaux (un `.gpl` / `.ase` partagé).
- Une résolution unique.
- Un traitement d'ombre unique (même angle, même *hue shift*).
- Les mêmes conventions de contour et de *dithering*.
- Le **fichier source** (`.ase`, `.xcf`, calques) gardé dans le dépôt, hors de `src/` (voir [Export & import de modèles](#/export-import-modeles)).

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Texture floue en jeu | export avec interpolation, ou pack HD sans mipmap adapté | export « nearest », résolution multiple de 16 |
| Carreau violet et noir | fichier absent, mauvais chemin ou mauvaise casse | vérifier `textures/<catégorie>/<nom>.png` |
| Frange colorée sur les bords à distance | pixels transparents avec RVB parasite | RVB des pixels transparents = voisin opaque |
| L'animation ne joue pas | `.mcmeta` mal nommé (doit finir par `.png.mcmeta`) | `magic_ore.png.mcmeta` à côté de `magic_ore.png` |
| Verre modding opaque | pas de *render type* `cutout`/`translucent` | le déclarer (modèle ou code) |
| Item « plat gris » alors qu'on veut du volume | `item/generated` peint sans ombre | peindre un léger volume, ou faire un vrai modèle 3D |

Page suivante : **[Blockbench : blocs & items](#/blockbench-blocs-items)**.
