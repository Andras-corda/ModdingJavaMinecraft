# Conteneurs & menus (GUI avec slots)

Dès qu'une interface manipule des **items** synchronisés (coffre, four, machine, sac), il faut le couple **`AbstractContainerMenu`** (logique, commun) + **`AbstractContainerScreen`** (rendu, client).

[Un bloc avec inventaire](#/block-entity) montre le câblage complet ; cette page détaille le **système de slots** et la **synchronisation**. Pour un écran **sans slots**, voir [Écrans & widgets](#/gui-screens).

## Vue d'ensemble

| Pièce | Côté | Rôle |
|-------|------|------|
| `MenuType<T>` | commun (registre) | fabrique le menu |
| `AbstractContainerMenu` | commun | slots, shift-clic, validité, données synchronisées |
| `AbstractContainerScreen<T>` | client | fond, libellés, infobulles |
| `Slot` (+ sous-classes) | commun | une case : quoi accepter, combien, quoi faire au dépôt |
| `DataSlot` / `ContainerData` | commun→client | synchroniser des `int` (progression, énergie) |

## 1. Enregistrer le `MenuType`

```java
public static final DeferredRegister<MenuType<?>> MENUS =
        DeferredRegister.create(ForgeRegistries.MENU_TYPES, MonMod.MODID);

public static final RegistryObject<MenuType<InfuserMenu>> INFUSER =
        MENUS.register("infuser", () -> IForgeMenuType.create(InfuserMenu::new));
```

`IForgeMenuType.create((windowId, inv, buf) -> ...)` : le `buf` transporte des données du serveur au client à l'ouverture (souvent un `BlockPos`).

## 2. Le menu

```java
public class InfuserMenu extends AbstractContainerMenu {

    private final InfuserBlockEntity be;
    private final ContainerLevelAccess access;
    private final ContainerData data;   // progression synchronisée

    // --- constructeur CLIENT (réseau) ---
    public InfuserMenu(int id, Inventory playerInv, FriendlyByteBuf buf) {
        this(id, playerInv, getBlockEntity(playerInv, buf.readBlockPos()), new SimpleContainerData(2));
    }

    // --- constructeur SERVEUR ---
    public InfuserMenu(int id, Inventory playerInv, InfuserBlockEntity be, ContainerData data) {
        super(ModMenus.INFUSER.get(), id);
        this.be = be;
        this.access = ContainerLevelAccess.create(be.getLevel(), be.getBlockPos());
        this.data = data;

        IItemHandler h = be.getItemHandler();
        this.addSlot(new SlotItemHandler(h, 0, 56, 35) {          // entrée
            @Override public boolean mayPlace(ItemStack s) { return be.isValidInput(s); }
        });
        this.addSlot(new SlotItemHandler(h, 1, 116, 35) {         // sortie
            @Override public boolean mayPlace(ItemStack s) { return false; }   // rien à la main
        });

        addPlayerInventory(playerInv);
        addPlayerHotbar(playerInv);

        this.addDataSlots(data);    // enregistre les DataSlot
    }

    public int getProgress()    { return data.get(0); }
    public int getMaxProgress() { return data.get(1); }
    public int getProgressScaled(int pixels) {
        int max = getMaxProgress();
        return max != 0 ? getProgress() * pixels / max : 0;
    }

    @Override
    public boolean stillValid(Player player) {
        return stillValid(access, player, ModBlocks.INFUSER.get());
    }

    // ... quickMoveStack (voir ci-dessous)

    private static InfuserBlockEntity getBlockEntity(Inventory inv, BlockPos pos) {
        BlockEntity found = inv.player.level().getBlockEntity(pos);
        if (found instanceof InfuserBlockEntity ib) return ib;
        throw new IllegalStateException("BlockEntity manquant en " + pos);
    }

    private void addPlayerInventory(Inventory inv) {
        for (int row = 0; row < 3; ++row)
            for (int col = 0; col < 9; ++col)
                addSlot(new Slot(inv, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
    }
    private void addPlayerHotbar(Inventory inv) {
        for (int col = 0; col < 9; ++col)
            addSlot(new Slot(inv, col, 8 + col * 18, 142));
    }
}
```

> :attention: **L'ordre des `addSlot` = les indices.** Convention : slots de la **machine d'abord**, puis inventaire du joueur (3×9), puis barre (1×9). Toute la logique de `quickMoveStack` repose sur ces plages d'indices.

## 3. `quickMoveStack` (shift-clic)

La partie la plus piégeuse. Modèle robuste avec des constantes de plages :

```java
private static final int MACHINE_SLOTS = 2;
private static final int PLAYER_INV_START = MACHINE_SLOTS;
private static final int PLAYER_INV_END = PLAYER_INV_START + 27;      // 3×9
private static final int HOTBAR_END = PLAYER_INV_END + 9;

@Override
public ItemStack quickMoveStack(Player player, int index) {
    Slot slot = this.slots.get(index);
    if (slot == null || !slot.hasItem()) return ItemStack.EMPTY;

    ItemStack stack = slot.getItem();
    ItemStack copy = stack.copy();

    if (index < MACHINE_SLOTS) {
        // machine -> joueur (barre + inventaire)
        if (!this.moveItemStackTo(stack, PLAYER_INV_START, HOTBAR_END, true)) {
            return ItemStack.EMPTY;
        }
        slot.onQuickCraft(stack, copy);
    } else {
        // joueur -> machine (si acceptée), sinon inventaire <-> barre
        if (canGoInMachine(stack)) {
            if (!this.moveItemStackTo(stack, 0, 1, false)) return ItemStack.EMPTY;   // slot d'entrée
        } else if (index < PLAYER_INV_END) {
            if (!this.moveItemStackTo(stack, PLAYER_INV_END, HOTBAR_END, false)) return ItemStack.EMPTY;
        } else {
            if (!this.moveItemStackTo(stack, PLAYER_INV_START, PLAYER_INV_END, false)) return ItemStack.EMPTY;
        }
    }

    if (stack.isEmpty()) slot.set(ItemStack.EMPTY); else slot.setChanged();
    if (stack.getCount() == copy.getCount()) return ItemStack.EMPTY;   // rien n'a bougé
    slot.onTake(player, stack);
    return copy;
}
```

`moveItemStackTo(stack, start, end, reverseDirection)` : le **4ᵉ argument** insère depuis la fin de la plage (utile pour viser la barre en priorité). Se tromper de sens = items qui « sautent » d'un slot à l'autre visuellement.

## 4. Synchroniser des valeurs : `ContainerData` / `DataSlot`

Un `DataSlot` transmet **un `int` (0–32767)** du serveur vers le client, à chaque changement.

### Côté block entity

```java
protected final ContainerData data = new ContainerData() {
    public int get(int i) {
        return switch (i) { case 0 -> progress; case 1 -> maxProgress; default -> 0; };
    }
    public void set(int i, int v) {
        if (i == 0) progress = v; else if (i == 1) maxProgress = v;
    }
    public int getCount() { return 2; }
};
```

### Côté menu

```java
this.addDataSlots(data);   // dans le constructeur serveur
```

### Côté screen

```java
int px = menu.getProgressScaled(24);
g.blit(TEXTURE, x + 79, y + 34, 176, 14, px, 17);   // flèche de progression qui se remplit
```

> :astuce: `DataSlot` ne fait que des `int`. Pour synchroniser un `long` (énergie > 32767), envoyez **deux** `DataSlot` (bits hauts / bas) ou un **paquet réseau** dédié. Pour un `ItemStack` de sortie, il est déjà synchronisé via les slots.

## 5. Slots spéciaux

| Besoin | Technique |
|--------|-----------|
| Slot en lecture seule (résultat) | `mayPlace` → `false` |
| Slot qui filtre (que du charbon) | `mayPlace(s) -> s.is(ItemTags.COALS)` |
| Slot 1 seul item | `getMaxStackSize` → `1` |
| Effet au retrait (XP du four) | override `onTake(player, stack)` |
| Slot « fantôme » (JEI, filtre visuel) | `Slot` custom : `mayPickup` → `false`, ne consomme pas au clic, stocke une copie count 1 |
| Slot `IItemHandler` (block entity) | `SlotItemHandler` (Forge) au lieu de `Slot` |

## 6. Ouvrir le menu

Depuis le bloc, **côté serveur** :

```java
@Override
public InteractionResult use(BlockState state, Level level, BlockPos pos, Player player,
                             InteractionHand hand, BlockHitResult hit) {
    if (!level.isClientSide()) {
        if (level.getBlockEntity(pos) instanceof InfuserBlockEntity be) {
            NetworkHooks.openScreen((ServerPlayer) player, be, pos);   // be implémente MenuProvider
        }
    }
    return InteractionResult.sidedSuccess(level.isClientSide());
}
```

Le `MenuProvider.createMenu(int, Inventory, Player)` du block entity renvoie `new InfuserMenu(id, inv, this, this.data)`.

## 7. L'écran

```java
public class InfuserScreen extends AbstractContainerScreen<InfuserMenu> {

    private static final ResourceLocation TEX =
            new ResourceLocation(MonMod.MODID, "textures/gui/infuser.png");

    public InfuserScreen(InfuserMenu menu, Inventory inv, Component title) {
        super(menu, inv, title);
    }

    @Override protected void init() {
        super.init();
        this.titleLabelX = 8;                 // position du titre
        this.inventoryLabelY = this.imageHeight - 94;
    }

    @Override
    protected void renderBg(GuiGraphics g, float partial, int mx, int my) {
        int x = leftPos, y = topPos;
        g.blit(TEX, x, y, 0, 0, imageWidth, imageHeight);
        int px = menu.getProgressScaled(24);
        g.blit(TEX, x + 79, y + 34, 176, 14, px, 17);
    }

    @Override
    public void render(GuiGraphics g, int mx, int my, float partial) {
        renderBackground(g);
        super.render(g, mx, my, partial);
        renderTooltip(g, mx, my);            // infobulles des slots survolés
    }
}
```

Enregistrement : `RegisterMenuScreensEvent` → `event.register(ModMenus.INFUSER.get(), InfuserScreen::new)`.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Crash au clic : `IndexOutOfBounds` dans `quickMoveStack` | plages d'indices fausses | recalculer `MACHINE_SLOTS`, `PLAYER_INV_END`… |
| Duplication d'items au shift-clic | `quickMoveStack` ne renvoie pas `EMPTY` quand rien ne bouge | comparer `stack.getCount() == copy.getCount()` |
| Progression figée à 0 côté client | `addDataSlots` oublié, ou `ContainerData` renvoie mal | `addDataSlots(data)` + vérifier `get()/getCount()` |
| Slots invisibles / mal placés | coordonnées hors de la texture, ou `leftPos/topPos` non utilisés | coords relatives à `leftPos, topPos` |
| Menu s'ouvre puis se ferme aussitôt | `stillValid` faux (mauvais bloc / `ContainerLevelAccess`) | `stillValid(access, player, ModBlocks.X.get())` |
| `NetworkHooks.openScreen` : rien ne se passe | appelé côté client, ou joueur non `ServerPlayer` | garder `if (!level.isClientSide())`, caster |
| L'écran n'apparaît pas (menu ouvert mais noir) | `RegisterMenuScreensEvent` oublié | enregistrer `MenuType -> Screen` |

Page suivante : **[Entités : IA & synchronisation](#/entites-ia-data)**.
