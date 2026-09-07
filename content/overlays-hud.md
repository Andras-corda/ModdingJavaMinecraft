# Overlays & HUD

Le **HUD** (barre de vie, faim, hotbar, viseur…) est une pile d'**overlays**. Un mod peut en **ajouter**, en **masquer**, ou en **remplacer**. Tout est **client uniquement**.

Voir aussi [Raccourcis clavier & overlay HUD](#/hud-keybinds) (cas keybind + HUD) et [Modèles & rendu](#/modeles-rendu) (`GuiGraphics`).

## Ajouter un overlay

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public final class ModOverlays {

    public static final IGuiOverlay STAMINA_BAR = (forgeGui, g, partialTick, width, height) -> {
        Minecraft mc = Minecraft.getInstance();
        if (mc.options.hideGui || mc.player == null || mc.screen != null) return;
        if (!(mc.gameMode != null && mc.gameMode.canHurtPlayer())) return;   // caché en créatif/spectateur

        int stamina = ClientStaminaCache.get();      // synchronisé depuis le serveur
        int max = ClientStaminaCache.getMax();

        // Se placer AU-DESSUS de la barre d'air, en poussant la pile de droite
        int x = width / 2 + 10;
        int y = height - forgeGui.rightHeight;
        forgeGui.rightHeight += 10;                   // les overlays vanilla suivants se décalent

        for (int i = 0; i < 10; i++) {
            boolean filled = i < Math.round(stamina / (float) max * 10);
            g.blit(ICONS, x + i * 8, y, filled ? 0 : 9, 0, 9, 9);
        }
    };

    @SubscribeEvent
    public static void register(RegisterGuiOverlaysEvent event) {
        event.registerAbove(VanillaGuiOverlay.AIR_LEVEL.id(), "monmod_stamina", STAMINA_BAR);
    }

    private ModOverlays() {}
}
```

### `RegisterGuiOverlaysEvent`

| Méthode | Position |
|---------|----------|
| `registerAboveAll(id, overlay)` | tout en haut de la pile (dessiné en dernier) |
| `registerAbove(vanillaId, id, overlay)` | juste après un overlay vanilla |
| `registerBelow(vanillaId, id, overlay)` | juste avant |
| `registerBelowAll(id, overlay)` | tout en bas (dessiné en premier) |

### `VanillaGuiOverlay` — les ids

`CROSSHAIR`, `HOTBAR`, `EXPERIENCE_BAR`, `PLAYER_HEALTH`, `ARMOR_LEVEL`, `FOOD_LEVEL`, `AIR_LEVEL`, `MOUNT_HEALTH`, `JUMP_BAR`, `BOSS_EVENT_PROGRESS`, `SLEEP_FADE`, `PORTAL_FADE`, `HELMET`, `SPYGLASS`, `VIGNETTE`, `CHAT_PANEL`, `PLAYER_LIST`, `DEBUG_TEXT`, `FPS_GRAPH`, `POTION_ICONS`, `RECORD_OVERLAY`, `SUBTITLES`, `TITLE_TEXT`, `SCOREBOARD`.

### `ForgeGui` — l'objet passé

- `forgeGui.leftHeight` / `forgeGui.rightHeight` : hauteur cumulée des piles gauche (vie, armure…) et droite (faim, air, monture). **Incrémentez-les** pour que vos barres cohabitent avec vanilla sans se superposer.
- `forgeGui.getFont()`, `forgeGui.getGuiTicks()` (pour le clignotement).

## Masquer ou remplacer un overlay vanilla

`RenderGuiOverlayEvent.Pre` est **annulable** :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, value = Dist.CLIENT)
public final class HudTweaks {

    @SubscribeEvent
    public static void onPre(RenderGuiOverlayEvent.Pre event) {
        // Masquer la barre de faim quand une capacité custom est active
        if (event.getOverlay().id().equals(VanillaGuiOverlay.FOOD_LEVEL.id())
                && FeatureState.hungerDisabled()) {
            event.setCanceled(true);
        }

        // Remplacer complètement le viseur
        if (event.getOverlay().id().equals(VanillaGuiOverlay.CROSSHAIR.id())
                && holdingScanner()) {
            event.setCanceled(true);
            drawCustomCrosshair(event.getGuiGraphics());
        }
    }

    @SubscribeEvent
    public static void onPost(RenderGuiOverlayEvent.Post event) {
        // dessiner APRÈS un overlay vanilla précis
    }
}
```

## Décorations d'items (compteur, jauge sur l'icône)

Pour ajouter un dessin **sur l'icône d'un item** (dans l'inventaire, la hotbar, les conteneurs) : `RegisterItemDecorationsEvent` + `IItemDecorator`.

```java
@SubscribeEvent
public static void registerDecorations(RegisterItemDecorationsEvent event) {
    event.register(ModItems.ENERGY_CELL.get(), (g, font, stack, x, y) -> {
        int energy = stack.getOrCreateTag().getInt("Energy");
        int max = 10000;
        int barW = Math.round(13.0F * energy / max);
        g.fill(RenderType.guiOverlay(), x + 2, y + 13, x + 15, y + 15, 0xFF000000);
        g.fill(RenderType.guiOverlay(), x + 2, y + 13, x + 2 + barW, y + 14, 0xFF33BBFF);
        return true;   // true = on a dessiné
    });
}
```

## Le viseur : quoi je regarde

`Minecraft.getInstance().hitResult` est déjà calculé chaque frame (voir [Lancer de rayon](#/raycast)) :

```java
public static final IGuiOverlay LOOK_LABEL = (gui, g, partial, w, h) -> {
    Minecraft mc = Minecraft.getInstance();
    HitResult hit = mc.hitResult;
    if (mc.options.hideGui || hit == null || hit.getType() == HitResult.Type.MISS) return;

    Component label = switch (hit.getType()) {
        case BLOCK -> mc.level.getBlockState(((BlockHitResult) hit).getBlockPos())
                        .getBlock().getName();
        case ENTITY -> ((EntityHitResult) hit).getEntity().getDisplayName();
        default -> Component.empty();
    };
    int tw = mc.font.width(label);
    g.fill(w / 2 - tw / 2 - 3, h / 2 + 10, w / 2 + tw / 2 + 3, h / 2 + 22, 0x80000000);
    g.drawCenteredString(mc.font, label, w / 2, h / 2 + 12, 0xFFFFFF);
};
```

## Coordonnées & échelle

- Les coordonnées de rendu HUD sont en **pixels d'interface** (« GUI scale ») : `mc.getWindow().getGuiScaledWidth()` / `getGuiScaledHeight()` (== `width`/`height` reçus dans l'overlay).
- Pour dessiner plus petit/grand : `g.pose().pushPose(); g.pose().scale(0.5F, 0.5F, 1F); ... g.pose().popPose();` (les coordonnées sont alors doublées).
- Transparence : couleurs **ARGB** (`0x80000000` = noir 50 %). Pensez `RenderSystem.enableBlend()` si un `blit` custom perd son alpha.

## Texte du débogueur (F3)

```java
@SubscribeEvent
public static void debugText(CustomizeGuiOverlayEvent.DebugText event) {
    if (Minecraft.getInstance().options.renderDebug) {
        event.getRight().add("");
        event.getRight().add("[MonMod] mana: " + ClientManaCache.get());
    }
}
```

`getLeft()` / `getRight()` : les colonnes du F3.

## Barre de boss custom

La barre de boss vanilla est un overlay (`BOSS_EVENT_PROGRESS`) alimenté par les `ServerBossEvent` des entités (voir [Créer un boss](#/boss)). Vous n'avez normalement **rien** à dessiner : créez un `ServerBossEvent` côté entité et le HUD s'en occupe. Pour un rendu **totalement custom** (barre segmentée par phase), annulez `BOSS_EVENT_PROGRESS` dans `RenderGuiOverlayEvent.Pre` et dessinez la vôtre.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| L'overlay s'affiche dans les menus / écran de mort | pas de garde | tester `mc.options.hideGui`, `mc.screen`, `mc.player` |
| Barre superposée à la barre d'air/faim | `leftHeight`/`rightHeight` non incrémentés | `forgeGui.rightHeight += hauteur` |
| `NoClassDefFoundError` serveur | overlay dans une classe commune | `value = Dist.CLIENT` sur le subscriber |
| Couleurs « transparentes » invisibles | octet alpha à `00` | `0xFF......` (ou activer le blend) |
| Rendu net en 1080p, flou / décalé sinon | coordonnées en pixels bruts | utiliser `width`/`height` de l'overlay (déjà scalés) |
| FPS en baisse | allocations / calculs lourds par frame | mettre en cache, voir [Performance](#/performance) |
| `RenderGuiOverlayEvent.Pre` annulé sans effet | mauvais `id()` comparé | comparer avec `VanillaGuiOverlay.X.id()` |

Page suivante : **[Blockbench : prise en main](#/blockbench-prise-en-main)**.
