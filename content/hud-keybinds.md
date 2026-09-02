# Raccourcis clavier & overlay HUD

Deux mécaniques **purement client** qui vont souvent ensemble : une touche personnalisée qui déclenche une action (envoyée au serveur par un paquet), et un affichage à l'écran (HUD) qui montre un état.

Tout le code de cette page vit dans un paquet `client/` et n'est chargé que côté client (voir [La classe principale du mod](#/classe-principale)).

## Partie 1 — un raccourci clavier

### Déclarer le `KeyMapping`

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public final class ModKeyMappings {

    public static final String CATEGORY = "key.categories.monmod";

    public static final KeyMapping ACTIVATE_ABILITY = new KeyMapping(
            "key.monmod.activate_ability",          // clé de traduction
            KeyConflictContext.IN_GAME,             // n'agit qu'en jeu (pas dans les menus)
            InputConstants.Type.KEYSYM,             // touche clavier (vs souris)
            GLFW.GLFW_KEY_R,                        // touche par défaut : R
            CATEGORY);

    @SubscribeEvent
    public static void register(RegisterKeyMappingsEvent event) {
        event.register(ACTIVATE_ABILITY);
    }

    private ModKeyMappings() {}
}
```

Traductions (`assets/monmod/lang/en_us.json` / `fr_fr.json`) :

```json
{
  "key.categories.monmod": "Mon Mod",
  "key.monmod.activate_ability": "Activer la capacité"
}
```

Le joueur peut ensuite **rebinder** la touche dans *Options → Commandes*.

### Réagir à l'appui

Deux approches.

#### A. `InputEvent.Key` (touche pressée, hors mouvement)

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, value = Dist.CLIENT)   // FORGE bus
public final class ModKeyHandler {

    @SubscribeEvent
    public static void onKey(InputEvent.Key event) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.screen != null) return;

        while (ModKeyMappings.ACTIVATE_ABILITY.consumeClick()) {
            // Envoi au serveur : le client ne fait QUE demander.
            ModNetwork.CHANNEL.sendToServer(new ActivateAbilityPacket());
        }
    }
}
```

`consumeClick()` renvoie `true` une fois par appui non encore traité — la boucle `while` gère les appuis multiples dans la même frame.

#### B. `ClientTickEvent` (fonctionne aussi pour une touche maintenue)

```java
@SubscribeEvent
public static void onClientTick(TickEvent.ClientTickEvent event) {
    if (event.phase != TickEvent.Phase.END) return;
    Minecraft mc = Minecraft.getInstance();
    if (mc.player == null) return;

    if (ModKeyMappings.ACTIVATE_ABILITY.isDown()) {
        // ... action tant que la touche est enfoncée
    }
}
```

### Le paquet côté serveur

```java
public record ActivateAbilityPacket() {

    public static void encode(ActivateAbilityPacket msg, FriendlyByteBuf buf) { }
    public static ActivateAbilityPacket decode(FriendlyByteBuf buf) { return new ActivateAbilityPacket(); }

    public static void handle(ActivateAbilityPacket msg, Supplier<NetworkEvent.Context> ctx) {
        ctx.get().enqueueWork(() -> {
            ServerPlayer player = ctx.get().getSender();
            if (player == null) return;
            if (player.getCooldowns().isOnCooldown(ModItems.WAND.get())) return;   // validation !

            // ... effet serveur : lancer un raycast, appliquer un effet, etc.
            player.getCooldowns().addCooldown(ModItems.WAND.get(), 60);
        });
        ctx.get().setPacketHandled(true);
    }
}
```

> :danger: Le client peut envoyer ce paquet à volonté. **Validez toujours** côté serveur : le joueur a-t-il l'objet ? le cooldown est-il écoulé ? est-il en vie ? (voir [Config & réseau](#/config-reseau)).

## Partie 2 — un overlay HUD

### Enregistrer l'overlay

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public final class ModOverlays {

    public static final IGuiOverlay ABILITY_STATUS = (gui, g, partialTick, width, height) -> {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.options.hideGui) return;
        if (!mc.player.getMainHandItem().is(ModItems.WAND.get())) return;

        boolean ready = !mc.player.getCooldowns().isOnCooldown(ModItems.WAND.get());
        String text = ready ? "Capacité : prête" : "Capacité : recharge…";
        int color = ready ? 0x55FF55 : 0xFF5555;

        int x = 10;
        int y = height - 40;
        g.drawString(mc.font, text, x, y, color, true);   // true = ombre portée
    };

    @SubscribeEvent
    public static void register(RegisterGuiOverlaysEvent event) {
        // Juste au-dessus de la barre d'action vanilla
        event.registerAbove(VanillaGuiOverlay.HOTBAR.id(), "monmod_ability_status", ABILITY_STATUS);
    }

    private ModOverlays() {}
}
```

`registerAbove` / `registerBelow` prennent l'`id()` d'un `VanillaGuiOverlay` (`CROSSHAIR`, `HOTBAR`, `PLAYER_HEALTH`, `EXPERIENCE_BAR`, `CHAT_PANEL`…), un nom unique, et l'overlay.

### Dessiner avec `GuiGraphics`

| Appel | Effet |
|-------|-------|
| `g.drawString(font, text, x, y, argb, shadow)` | texte |
| `g.drawCenteredString(font, text, cx, y, argb)` | texte centré |
| `g.fill(x1, y1, x2, y2, argb)` | rectangle plein (avec alpha) |
| `g.blit(texture, x, y, u, v, w, h)` | portion d'une texture |
| `g.renderItem(stack, x, y)` | icône d'item |
| `g.pose().pushPose()` / `scale()` / `popPose()` | transformations (échelle, translation) |

Les couleurs sont en **ARGB** : `0xFFFF5555` = rouge opaque, `0x80000000` = noir semi-transparent.

### Exemple : afficher ce que je regarde (raycast + HUD)

```java
public static final IGuiOverlay LOOK_INFO = (gui, g, partialTick, width, height) -> {
    Minecraft mc = Minecraft.getInstance();
    if (mc.player == null || mc.hitResult == null) return;

    String label = switch (mc.hitResult.getType()) {
        case BLOCK -> {
            BlockPos pos = ((BlockHitResult) mc.hitResult).getBlockPos();
            yield mc.level.getBlockState(pos).getBlock().getName().getString();
        }
        case ENTITY -> ((EntityHitResult) mc.hitResult).getEntity().getName().getString();
        default -> null;
    };
    if (label == null) return;

    int w = mc.font.width(label) + 8;
    int x = (width - w) / 2;
    int y = height / 2 + 12;
    g.fill(x, y, x + w, y + 12, 0x80000000);
    g.drawCenteredString(mc.font, label, width / 2, y + 2, 0xFFFFFF);
};
```

`Minecraft.getInstance().hitResult` est déjà calculé chaque frame (voir [Lancer de rayon](#/raycast)) : aucun raycast à relancer côté client pour ce cas.

## Rendu 3D dans le monde (pour aller plus loin)

Pour dessiner **dans** le monde (contour de bloc, ligne de visée, hologramme), on utilise `RenderLevelStageEvent` :

```java
@SubscribeEvent
public static void onRenderLevel(RenderLevelStageEvent event) {
    if (event.getStage() != RenderLevelStageEvent.Stage.AFTER_TRANSLUCENT_BLOCKS) return;

    PoseStack pose = event.getPoseStack();
    Vec3 cam = event.getCamera().getPosition();
    pose.pushPose();
    pose.translate(-cam.x, -cam.y, -cam.z);      // repère monde -> repère caméra
    // ... dessiner avec MultiBufferSource / VertexConsumer
    pose.popPose();
}
```

C'est un sujet à part entière (buffers, shaders de base) ; retenez le point d'entrée.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `NoClassDefFoundError` au démarrage du serveur | classe HUD/keybind chargée côté serveur | `value = Dist.CLIENT` sur le `@EventBusSubscriber`, paquet `client/` isolé |
| La touche déclenche l'action plusieurs fois | pas de `consumeClick()` ou pas de boucle `while` | utiliser `while (KEY.consumeClick())` |
| L'action marche en solo, pas en multi | effet fait côté client | envoyer un paquet, exécuter côté serveur |
| L'overlay s'affiche dans les menus / l'écran de mort | pas de garde | tester `mc.options.hideGui`, `mc.screen`, `mc.player != null` |
| Couleurs « transparentes » qui n'apparaissent pas | alpha à `00` (`0x00FFFFFF`) | mettre l'octet alpha (`0xFF......`) |
| La touche entre en conflit avec une touche vanilla | pas de `KeyConflictContext` | `KeyConflictContext.IN_GAME` |

---

Vous avez maintenant les briques concrètes les plus demandées. Retour aux fondamentaux d'équipe : **[Travailler à plusieurs avec Git](#/git)**.
