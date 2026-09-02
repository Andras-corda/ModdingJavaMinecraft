# Écrans & widgets

Deux familles d'interfaces :

- **avec conteneur** (`AbstractContainerMenu` + `AbstractContainerScreen`) — dès qu'il y a des **slots d'items** synchronisés : coffre, four, machine. Traité dans [Un bloc avec inventaire](#/block-entity).
- **sans conteneur** (`Screen`) — un menu purement client : config, sélecteur, livre de sorts, écran d'accueil de mod. **C'est le sujet de cette page.**

Tout est **client uniquement** (paquet `client/`).

## Un `Screen` minimal

```java
public class SpellbookScreen extends Screen {

    public SpellbookScreen() {
        super(Component.translatable("screen.monmod.spellbook"));
    }

    @Override
    protected void init() {
        super.init();
        int cx = this.width / 2;

        addRenderableWidget(Button.builder(Component.literal("Sort de feu"), b -> cast("fire"))
                .bounds(cx - 100, 60, 200, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Sort de givre"), b -> cast("frost"))
                .bounds(cx - 100, 84, 200, 20).build());

        addRenderableWidget(Button.builder(CommonComponents.GUI_DONE, b -> onClose())
                .bounds(cx - 100, this.height - 40, 200, 20).build());
    }

    private void cast(String spell) {
        ModNetwork.CHANNEL.sendToServer(new CastSpellPacket(spell));   // le serveur agit
        onClose();
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        this.renderBackground(g);                                        // fond assombri
        g.drawCenteredString(this.font, this.title, this.width / 2, 30, 0xFFFFFF);
        super.render(g, mouseX, mouseY, partialTick);                    // dessine les widgets
    }

    @Override public boolean isPauseScreen() { return false; }           // le jeu continue derrière
}
```

- **`init()`** est appelé à l'ouverture **et à chaque redimensionnement** : (re)créez-y les widgets. Ne gardez pas d'état vital uniquement dans les widgets.
- **`addRenderableWidget(...)`** : enregistre le widget pour rendu **et** clics/navigation clavier.
- **`renderBackground(g)`** : le voile sombre standard.

## Ouvrir l'écran

Depuis un **raccourci clavier** (voir [Raccourcis & HUD](#/hud-keybinds)) :

```java
if (ModKeyMappings.OPEN_SPELLBOOK.consumeClick()) {
    Minecraft.getInstance().setScreen(new SpellbookScreen());
}
```

Depuis un **item** (`use`) — l'écran étant client, on l'ouvre côté client :

```java
@Override
public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
    if (level.isClientSide()) {
        openScreen();                                       // méthode isolée, appelée seulement client
    }
    return InteractionResultHolder.sidedSuccess(player.getItemInHand(hand), level.isClientSide());
}

// classe séparée pour ne pas charger Screen côté serveur
private static void openScreen() {
    Minecraft.getInstance().setScreen(new SpellbookScreen());
}
```

> :attention: N'importez **jamais** `Screen`/`Minecraft` dans une classe chargée côté serveur. Isolez l'ouverture dans une classe `client/` appelée via `DistExecutor` ou derrière `level.isClientSide()`.

Depuis le **serveur** (« le PNJ ouvre un dialogue ») : envoyez un paquet ; le handler client fait `setScreen(...)`.

## Widgets disponibles

| Widget | Usage |
|--------|-------|
| `Button` | `Button.builder(text, onPress).bounds(x,y,w,h).tooltip(Tooltip.create(...)).build()` |
| `EditBox` | champ de texte : `new EditBox(font, x, y, w, h, Component)` ; `getValue()`, `setResponder(str -> ...)` |
| `Checkbox` | `Checkbox.builder(text, font).pos(x,y).selected(true).build()` |
| `CycleButton<T>` | choix cyclique : `CycleButton.<Mode>builder(m -> Component.literal(m.name())).withValues(Mode.values()).create(...)` |
| `AbstractSliderButton` | curseur (à sous-classer) |
| `MultiLineEditBox` | texte multi-lignes |
| `ObjectSelectionList<E>` | liste défilante d'éléments sélectionnables (à sous-classer) |
| `EditBox` + `SuggestionsList` | (avancé) |

Ajoutez-les dans `init()` avec `addRenderableWidget(...)`. Pour un widget visible mais non interactif : `addRenderableOnly(...)`.

## Dessiner : `GuiGraphics`

| Appel | Effet |
|-------|-------|
| `g.drawString(font, text, x, y, argb)` / `g.drawCenteredString(...)` | texte |
| `g.fill(x1, y1, x2, y2, argb)` | rectangle (avec alpha) |
| `g.blit(texture, x, y, u, v, w, h)` | portion de texture (`u,v` = offset dans le PNG) |
| `g.blitNineSliced(...)` | cadre étirable |
| `g.renderItem(stack, x, y)` + `g.renderItemDecorations(font, stack, x, y)` | icône d'item + compteur |
| `g.pose().pushPose()` / `scale()` / `translate()` / `popPose()` | transformations |
| `g.enableScissor(x1,y1,x2,y2)` / `disableScissor()` | découpe (zone défilante) |

Couleurs **ARGB** : `0xFFFFFFFF` blanc opaque, `0x80000000` noir semi-transparent.

## Entrées

```java
@Override public boolean keyPressed(int key, int scan, int mods) {
    if (key == GLFW.GLFW_KEY_TAB) { /* ... */ return true; }
    return super.keyPressed(key, scan, mods);
}
@Override public boolean mouseClicked(double mx, double my, int button) { return super.mouseClicked(mx, my, button); }
@Override public boolean mouseScrolled(double mx, double my, double delta) { return super.mouseScrolled(mx, my, delta); }
@Override public boolean charTyped(char c, int mods) { return super.charTyped(c, mods); }
@Override public boolean shouldCloseOnEsc() { return true; }
```

Renvoyez `true` quand vous avez « consommé » l'entrée.

## Écran de configuration du mod

Pour que votre config apparaisse via *Mods → votre mod → Config* :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ConfigScreenSetup {
    @SubscribeEvent
    public static void onClientSetup(FMLClientSetupEvent event) {
        ModLoadingContext.get().registerExtensionPoint(
                ConfigScreenHandler.ConfigScreenFactory.class,
                () -> new ConfigScreenHandler.ConfigScreenFactory(
                        (mc, parent) -> new MyConfigScreen(parent)));
    }
}
```

Écrire un `MyConfigScreen` complet est fastidieux. La bibliothèque **[Cloth Config API](https://www.curseforge.com/minecraft/mc-mods/cloth-config)** génère l'écran à partir d'annotations sur une classe de config — très répandue.

## Un widget custom

```java
public class ManaBarWidget extends AbstractWidget {

    private final IntSupplier current, max;

    public ManaBarWidget(int x, int y, int w, IntSupplier current, IntSupplier max) {
        super(x, y, w, 8, Component.empty());
        this.current = current; this.max = max;
    }

    @Override
    protected void renderWidget(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        g.fill(getX(), getY(), getX() + width, getY() + height, 0xFF202020);
        int fill = (int) (width * (current.getAsInt() / (float) Math.max(1, max.getAsInt())));
        g.fill(getX(), getY(), getX() + fill, getY() + height, 0xFF3B7DDD);
    }

    @Override protected void updateWidgetNarration(NarrationElementOutput out) {
        out.add(NarratedElementType.TITLE, Component.literal(current.getAsInt() + " / " + max.getAsInt()));
    }
}
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `NoClassDefFoundError` serveur | `Screen`/`Minecraft` importé dans une classe commune | isoler dans `client/`, appeler derrière `isClientSide()` |
| Widgets qui disparaissent au redimensionnement | créés hors de `init()` | (re)créer dans `init()` |
| Les clics ne font rien | `addRenderableOnly` au lieu de `addRenderableWidget` | utiliser `addRenderableWidget` |
| L'écran met le jeu en pause en multijoueur (rien) / en solo (freeze) | `isPauseScreen()` par défaut `true` | `return false` si le jeu doit continuer |
| Texte coupé / débordant | pas de `enableScissor` sur une zone défilante | délimiter avec scissor |
| Données modifiées non sauvegardées | l'écran ne persiste rien | envoyer un paquet / écrire la config à la fermeture |

Page suivante : **[Entités : IA & synchronisation](#/entites-ia-data)**.
