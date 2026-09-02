# Un bloc avec inventaire et interface

Objectif concret : un **coffre personnalisé** à 9 emplacements, qui garde son contenu, le lâche quand on le casse, et ouvre une interface au clic droit. On y ajoute ensuite le **tick** (pour une machine) et la **synchro client**.

C'est l'exemple le plus « transversal » du modding : `BlockEntity` + capability d'inventaire + `Menu` + `Screen` + réseau.

Prérequis : [Blocs, items & onglets](#/blocs-items).

## Vue d'ensemble des pièces

| Pièce | Rôle | Côté |
|-------|------|------|
| `Block` (`ModStorageBlock`) | forme, interactions, crée le `BlockEntity` | commun |
| `BlockEntity` (`StorageBlockEntity`) | stocke les données, sauvegarde NBT, expose l'inventaire | commun |
| `BlockEntityType` | associe la classe `BlockEntity` à un ou plusieurs blocs | commun (registre) |
| `MenuType` + `AbstractContainerMenu` | logique de conteneur : slots, shift-clic | commun (registre) |
| `AbstractContainerScreen` | rendu de l'interface | client |

## 1. Enregistrer les types

`registry/ModBlockEntities.java` :

```java
public final class ModBlockEntities {

    public static final DeferredRegister<BlockEntityType<?>> TYPES =
            DeferredRegister.create(ForgeRegistries.BLOCK_ENTITY_TYPES, MonMod.MODID);

    public static final RegistryObject<BlockEntityType<StorageBlockEntity>> STORAGE =
            TYPES.register("storage", () -> BlockEntityType.Builder
                    .of(StorageBlockEntity::new, ModBlocks.STORAGE_BLOCK.get())
                    .build(null));

    private ModBlockEntities() {}
    public static void register(IEventBus bus) { TYPES.register(bus); }
}
```

`registry/ModMenus.java` :

```java
public final class ModMenus {

    public static final DeferredRegister<MenuType<?>> MENUS =
            DeferredRegister.create(ForgeRegistries.MENU_TYPES, MonMod.MODID);

    public static final RegistryObject<MenuType<StorageMenu>> STORAGE =
            MENUS.register("storage", () -> IForgeMenuType.create(StorageMenu::new));

    private ModMenus() {}
    public static void register(IEventBus bus) { MENUS.register(bus); }
}
```

Et dans le constructeur `@Mod` :

```java
ModBlocks.register(bus);
ModBlockEntities.register(bus);
ModMenus.register(bus);
```

## 2. Le bloc

```java
public class ModStorageBlock extends BaseEntityBlock {

    public ModStorageBlock(Properties props) {
        super(props);
    }

    @Override
    public RenderShape getRenderShape(BlockState state) {
        return RenderShape.MODEL;                 // sinon le bloc est invisible
    }

    @Nullable
    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new StorageBlockEntity(pos, state);
    }

    @Override
    public InteractionResult use(BlockState state, Level level, BlockPos pos,
                                 Player player, InteractionHand hand, BlockHitResult hit) {
        if (!level.isClientSide()) {
            if (level.getBlockEntity(pos) instanceof StorageBlockEntity be) {
                NetworkHooks.openScreen((ServerPlayer) player, be, pos);
            }
        }
        return InteractionResult.sidedSuccess(level.isClientSide());
    }

    // Lâche le contenu quand le bloc est retiré / cassé.
    @Override
    public void onRemove(BlockState state, Level level, BlockPos pos, BlockState newState, boolean moved) {
        if (!state.is(newState.getBlock())) {
            if (level.getBlockEntity(pos) instanceof StorageBlockEntity be) {
                SimpleContainer inv = new SimpleContainer(be.items.getSlots());
                for (int i = 0; i < be.items.getSlots(); i++) inv.setItem(i, be.items.getStackInSlot(i));
                Containers.dropContents(level, pos, inv);
            }
            super.onRemove(state, level, pos, newState, moved);
        }
    }

    // (Facultatif) donne le comparateur.
    @Override public boolean hasAnalogOutputSignal(BlockState s) { return true; }
    @Override public int getAnalogOutputSignal(BlockState s, Level l, BlockPos p) {
        return l.getBlockEntity(p) instanceof StorageBlockEntity be
                ? ItemHandlerHelper.calcRedstoneFromInventory(be.items) : 0;
    }
}
```

## 3. Le `BlockEntity`

```java
public class StorageBlockEntity extends BlockEntity implements MenuProvider {

    public final ItemStackHandler items = new ItemStackHandler(9) {
        @Override
        protected void onContentsChanged(int slot) {
            setChanged();                         // marque à sauvegarder
            if (level != null && !level.isClientSide()) {
                level.sendBlockUpdated(getBlockPos(), getBlockState(), getBlockState(), 3);
            }
        }
    };

    private final LazyOptional<IItemHandler> itemHandler = LazyOptional.of(() -> items);

    public StorageBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.STORAGE.get(), pos, state);
    }

    // --- Capability : d'autres blocs (hoppers, tuyaux) accèdent à l'inventaire ---
    @Override
    public <T> LazyOptional<T> getCapability(Capability<T> cap, @Nullable Direction side) {
        if (cap == ForgeCapabilities.ITEM_HANDLER) return itemHandler.cast();
        return super.getCapability(cap, side);
    }

    @Override public void invalidateCaps() { super.invalidateCaps(); itemHandler.invalidate(); }
    @Override public void reviveCaps()     { super.reviveCaps();     /* recrée si besoin */ }

    // --- Sauvegarde ---
    @Override
    protected void saveAdditional(CompoundTag tag) {
        super.saveAdditional(tag);
        tag.put("Inventory", items.serializeNBT());
    }

    @Override
    public void load(CompoundTag tag) {
        super.load(tag);
        items.deserializeNBT(tag.getCompound("Inventory"));
    }

    // --- Synchro client (pour un rendu custom du contenu ; inutile si seule l'UI compte) ---
    @Nullable @Override
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    @Override
    public CompoundTag getUpdateTag() {
        CompoundTag tag = super.getUpdateTag();
        tag.put("Inventory", items.serializeNBT());
        return tag;
    }

    // --- MenuProvider ---
    @Override
    public Component getDisplayName() {
        return Component.translatable("block.monmod.storage_block");
    }

    @Nullable @Override
    public AbstractContainerMenu createMenu(int id, Inventory playerInv, Player player) {
        return new StorageMenu(id, playerInv, this);
    }
}
```

## 4. Le `Menu` (conteneur)

```java
public class StorageMenu extends AbstractContainerMenu {

    private final StorageBlockEntity be;
    private final ContainerLevelAccess access;

    /** Constructeur CLIENT : appelé via le réseau (IForgeMenuType). */
    public StorageMenu(int id, Inventory playerInv, FriendlyByteBuf extra) {
        this(id, playerInv, resolve(playerInv, extra.readBlockPos()));
    }

    /** Constructeur SERVEUR. */
    public StorageMenu(int id, Inventory playerInv, StorageBlockEntity be) {
        super(ModMenus.STORAGE.get(), id);
        this.be = be;
        this.access = ContainerLevelAccess.create(be.getLevel(), be.getBlockPos());

        // 9 slots du bloc (une rangée)
        IItemHandler h = be.items;
        for (int col = 0; col < 9; col++) {
            addSlot(new SlotItemHandler(h, col, 8 + col * 18, 18));
        }
        // Inventaire du joueur (3x9) + barre (1x9)
        addPlayerInventory(playerInv, 8, 51);
        addPlayerHotbar(playerInv, 8, 109);
    }

    private static StorageBlockEntity resolve(Inventory inv, BlockPos pos) {
        BlockEntity found = inv.player.level().getBlockEntity(pos);
        if (found instanceof StorageBlockEntity sbe) return sbe;
        throw new IllegalStateException("BlockEntity introuvable en " + pos);
    }

    @Override
    public boolean stillValid(Player player) {
        return stillValid(access, player, ModBlocks.STORAGE_BLOCK.get());
    }

    /** Shift-clic : déplace la pile entre bloc et joueur. */
    @Override
    public ItemStack quickMoveStack(Player player, int index) {
        Slot slot = slots.get(index);
        if (slot == null || !slot.hasItem()) return ItemStack.EMPTY;

        ItemStack stack = slot.getItem();
        ItemStack copy = stack.copy();
        int blockSlots = 9;
        int total = slots.size();

        if (index < blockSlots) {                       // du bloc -> joueur
            if (!moveItemStackTo(stack, blockSlots, total, true)) return ItemStack.EMPTY;
        } else {                                        // du joueur -> bloc
            if (!moveItemStackTo(stack, 0, blockSlots, false)) return ItemStack.EMPTY;
        }

        if (stack.isEmpty()) slot.set(ItemStack.EMPTY); else slot.setChanged();
        return copy;
    }

    // addPlayerInventory / addPlayerHotbar : petites boucles addSlot(new Slot(playerInv, ...))
}
```

> :astuce: `moveItemStackTo` et l'indexation des slots sont la partie la plus pénible. Copiez les boucles `addPlayerInventory`/`addPlayerHotbar` d'un menu vanilla (ex. `ChestMenu`) et gardez toujours l'ordre : **slots du bloc d'abord, puis inventaire joueur, puis barre**.

## 5. Le `Screen` (client)

Enregistré via `RegisterMenuScreensEvent` (ou `MenuScreens.register` dans `FMLClientSetupEvent`) :

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID, bus = Bus.MOD, value = Dist.CLIENT)
public class ModClientSetup {
    @SubscribeEvent
    public static void onRegisterScreens(RegisterMenuScreensEvent event) {
        event.register(ModMenus.STORAGE.get(), StorageScreen::new);
    }
}
```

```java
public class StorageScreen extends AbstractContainerScreen<StorageMenu> {

    private static final ResourceLocation TEXTURE =
            new ResourceLocation(MonMod.MODID, "textures/gui/storage.png");

    public StorageScreen(StorageMenu menu, Inventory inv, Component title) {
        super(menu, inv, title);
        this.imageWidth = 176;
        this.imageHeight = 133;
        this.inventoryLabelY = this.imageHeight - 94;
    }

    @Override
    protected void renderBg(GuiGraphics g, float partial, int mouseX, int mouseY) {
        int x = (width - imageWidth) / 2;
        int y = (height - imageHeight) / 2;
        g.blit(TEXTURE, x, y, 0, 0, imageWidth, imageHeight);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
        renderBackground(g);
        super.render(g, mouseX, mouseY, partial);
        renderTooltip(g, mouseX, mouseY);
    }
}
```

Il faut fournir la texture `assets/monmod/textures/gui/storage.png` (176×133, format vanilla).

## 6. Ajouter un tick (pour une machine)

Le bloc fournit le *ticker* ; il ne tourne que côté serveur en général :

```java
// Dans ModStorageBlock
@Nullable @Override
public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state,
                                                              BlockEntityType<T> type) {
    if (level.isClientSide()) return null;
    return createTickerHelper(type, ModBlockEntities.STORAGE.get(), StorageBlockEntity::serverTick);
}
```

```java
// Dans StorageBlockEntity
public int progress = 0;

public static void serverTick(Level level, BlockPos pos, BlockState state, StorageBlockEntity be) {
    // ex. transformer le slot 0 en résultat au bout de 100 ticks
    if (be.canProcess()) {
        be.progress++;
        if (be.progress >= 100) { be.process(); be.progress = 0; }
        be.setChanged();
    } else {
        be.progress = 0;
    }
}
```

Pour afficher `progress` dans le `Screen`, on le **synchronise via le menu** avec `addDataSlot(...)` :

```java
// Dans StorageMenu (constructeur serveur)
addDataSlot(new DataSlot() {
    public int get() { return be.progress; }
    public void set(int v) { be.progress = v; }
});
```

Le client lit alors `menu.getProgress()` chaque frame. `DataSlot` ne transmet que des `int` (0–32767).

## Récapitulatif des points sensibles

- `BaseEntityBlock` rend le bloc **invisible** par défaut → `getRenderShape` = `RenderShape.MODEL`.
- `build(null)` dans `BlockEntityType.Builder` : le `null` est le *type datafixer*, normal.
- Toujours `setChanged()` après modification, sinon perte au rechargement du chunk.
- `onRemove` : lâcher le contenu **avant** `super.onRemove(...)`.
- `getCapability` : renvoyer `itemHandler.cast()`, et **invalider** dans `invalidateCaps`.
- Menu : constructeur `(int, Inventory, FriendlyByteBuf)` **obligatoire** pour `IForgeMenuType.create`.
- `NetworkHooks.openScreen` : uniquement côté serveur, avec un `ServerPlayer`.

Page suivante : **[Une entité et un projectile personnalisés](#/entite-projectile)**.
