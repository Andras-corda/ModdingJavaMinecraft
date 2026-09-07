# Blockbench : prise en main

**Blockbench** ([blockbench.net](https://www.blockbench.net/)) est l'éditeur de référence pour les modèles 3D Minecraft : blocs, items, entités, armures. Gratuit, open-source, disponible en application (Windows/macOS/Linux) et en [version web](https://app.blockbench.net/).

Cette page : installation, choix du format de projet, tour de l'interface, système de coordonnées. Les pages suivantes détaillent [les blocs/items](#/blockbench-blocs-items), [les entités + GeckoLib](#/blockbench-entites-geckolib), et [l'export/import](#/export-import-modeles).

## Installer

- **Application** : télécharger sur [blockbench.net](https://www.blockbench.net/) (recommandé — plugins, raccourcis, performances).
- **Web** : [app.blockbench.net](https://app.blockbench.net/) — pratique pour dépanner, sans installation.

Plugins utiles (menu **File → Plugins**) :

| Plugin | Pour |
|--------|------|
| **Vanilla Model Loader** (ou « Minecraft Assets ») | charger les modèles/textures vanilla comme référence |
| **GeckoLib Animation Utils** | export des modèles/animations au format GeckoLib |

## Choisir le bon format de projet

Au démarrage (**File → New**), Blockbench demande un **format**. Pour du modding Forge 1.20.1 :

| Format Blockbench | Quand l'utiliser | Sortie |
|-------------------|------------------|--------|
| **Java Block/Item** | blocs et items du jeu | `.json` (modèle vanilla) |
| **Bedrock Entity** | entités, *block entities* (via un BER), armures, items animés **avec [GeckoLib](#/geckolib)** | `.geo.json` + `.animation.json` |
| **Modded Entity** | entités avec le système de modèle **natif de Forge** (génère du code Java `EntityModel`) | code Java + `.png` |
| **Generic Model** | modèle libre pour le *loader OBJ* de Forge | `.obj` / `.json` |
| Skin | skins de joueur | `.png` |

> :astuce: **Règle simple.** Bloc ou item → *Java Block/Item*. Entité animée → *Bedrock Entity* + GeckoLib (le choix le plus répandu et le plus documenté). *Modded Entity* fonctionne mais te lie au système Forge, plus verbeux.

## Les modes (barre en haut à droite)

| Mode | Rôle |
|------|------|
| **Edit** | créer/déplacer/redimensionner les cubes et les groupes (os) |
| **Paint** | peindre la texture directement sur le modèle |
| **Animate** | *(formats entité)* poser des images-clés d'animation |
| **Display** | *(Java Item)* régler la position de l'objet en main, dans le GUI, au sol… |

## Les panneaux

- **Outliner** (à droite) : l'arbre du modèle — groupes (*os*), cubes, verrous, visibilité.
- **UV** (bas droite) : dépliage de la texture sur les faces.
- **Textures** (bas droite) : les images du modèle ; double-clic pour éditer, clic droit → *Save*.
- **Propriétés de l'élément** (droite) : position, taille, rotation, **point de pivot**, *inflate*.
- **Timeline** (bas, mode Animate) : les images-clés.

## Le système de coordonnées Minecraft

- **1 bloc = 16 unités** (« pixels »). Un cube de `[0,0,0]` à `[16,16,16]` remplit un bloc.
- **X** = est(+)/ouest(−) · **Y** = haut(+)/bas(−) · **Z** = sud(+)/nord(−).
- Le **centre du bloc** est à `[8, 8, 8]` ; le repère du monde place l'origine `[0,0,0]` au **coin** du bloc.
- Pour les **blocs et items**, le modèle doit rester dans `[-16, -16, -16]` → `[32, 32, 32]` (limite du moteur vanilla).
- Pour les **entités**, aucune limite de taille ni de rotation.

### Le point de pivot

Chaque groupe/cube a un **point de pivot** (origine de rotation, croix orange). Il est capital :

- pour orienter proprement un élément (une porte tourne autour de sa charnière) ;
- pour l'animation : un **os** (groupe) tourne autour de son pivot — placez-le à l'articulation (épaule, hanche, base d'une tige).

`Tools → Center Pivot` recentre le pivot ; on le déplace ensuite à la main dans les propriétés.

## Créer un premier cube

1. **File → New → Java Block/Item**.
2. Bouton **+** dans l'Outliner (ou `N`) → un cube apparaît.
3. Propriétés : *From* `[0,0,0]`, *To* `[16,16,16]` → cube plein.
4. Panneau **Textures → +** → importer un PNG 16×16 (ou *Create Texture* pour partir d'un canevas).
5. Onglet **UV** : chaque face est une zone de la texture ; *Auto UV* les répartit.
6. Mode **Paint** pour retoucher, ou éditez le PNG dans un autre logiciel ([Pixel art & textures](#/pixel-art-textures)).
7. **File → Export → Java Block/Item Model** → `sapphire_block.json`.

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `N` | nouveau cube · `Ctrl+G` grouper |
| `Q` / `W` / `E` / `R` | déplacer / redimensionner / faire pivoter / pivot |
| `Ctrl+D` | dupliquer |
| clic molette + glisser | orbiter la caméra |
| `F` | focus sur la sélection |
| `2` `3` `4` | vues orthographiques |

## Ce que Blockbench **ne** fait **pas** bien

- Les **blockstates** (`assets/modid/blockstates/*.json`) : à écrire à la main ou par [datagen](#/datagen). Blockbench exporte le *modèle*, pas l'association état→modèle.
- Les modèles **multipart** complexes : possibles mais fastidieux — la datagen est souvent plus rapide.
- Le **rig** avancé (contraintes, IK) : Blockbench reste un éditeur simple ; pour des animations riches, il fait le maillage et les keyframes de base, GeckoLib fait le reste.

Page suivante : **[Pixel art & textures Minecraft](#/pixel-art-textures)**.
