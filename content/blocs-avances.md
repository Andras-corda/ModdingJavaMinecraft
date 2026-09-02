# Blocs avancés

Au-delà du cube plein : blocs **orientés**, avec **états**, **forme custom**, **waterloggables**, qui **tickent**.

Prérequis : [Blocs & items](#/blocs-items).

## Les états de bloc (`BlockState`)

Un `Block` est une classe ; un `BlockState` est **une combinaison de valeurs de propriétés** de ce bloc. Ex. `oak_stairs` a `facing`, `half`, `shape`, `waterlogged` → des dizaines de `BlockState`.

### Propriétés vanilla réutilisables

`net.minecraft.world.level.block.state.properties.BlockStateProperties` :

| Propriété | Type | Valeurs |
|-----------|------|---------|
| `HORIZONTAL_FACING` | `Direction` | N, S, E, W |
| `FACING` | `Direction` | + UP, DOWN |
| `AXIS` | `Direction.Axis` | X, Y, Z |
| `LIT`, `POWERED`, `OPEN`, `WATERLOGGED` | `boolean` | — |
| `AGE_7`, `AGE_15` | `int` | 0..7 / 0..15 |

### Déclarer les propriétés d'un bloc

```java
public class PolisherBlock extends HorizontalDirectionalBlock {

    public static final BooleanProperty RUNNING = BooleanProperty.create("running");

    public PolisherBlock(Properties props) {
        super(props);
        registerDefaultState(defaultBlockState()
                .setValue(FACING, Direction.NORTH)
                .setValue(RUNNING, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> b) {
        b.add(FACING, RUNNING);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext ctx) {
        return defaultBlockState()
                .setValue(FACING, ctx.getHorizontalDirection().getOpposite());
    }

    // Rotation / miroir (structures, /clone)
    @Override public BlockState rotate(BlockState s, Rotation r) { return s.setValue(FACING, r.rotate(s.getValue(FACING))); }
    @Override public BlockState mirror(BlockState s, Mirror m)   { return s.rotate(m.getRotation(s.getValue(FACING))); }
}
```

Lecture / écriture en jeu :

```java
BlockState state = level.getBlockState(pos);
Direction facing = state.getValue(PolisherBlock.FACING);
level.setBlock(pos, state.setValue(PolisherBlock.RUNNING, true), Block.UPDATE_CLIENTS);
```

### Propriété d'énumération custom

```java
public enum ConnectionType implements StringRepresentable {
    NONE("none"), SINGLE("single"), DOUBLE("double");

    private final String name;
    ConnectionType(String n) { this.name = n; }
    @Override public String getSerializedName() { return name; }
}

// dans le bloc :
public static final EnumProperty<ConnectionType> CONNECTION =
        EnumProperty.create("connection", ConnectionType.class);
```

### Flags de `setBlock`

`level.setBlock(pos, state, flags)` — combinez avec `|` :

| Flag | Effet |
|------|-------|
| `Block.UPDATE_CLIENTS` (2) | envoyer au client |
| `Block.UPDATE_NEIGHBORS` (1) | notifier les voisins (redstone) |
| `Block.UPDATE_INVISIBLE` (4) | ne pas re-rendre |
| `Block.UPDATE_IMMEDIATE` (8) | re-render immédiat côté client |
| `Block.UPDATE_ALL` (3) | `CLIENTS | NEIGHBORS` — le plus courant |

`setBlockAndUpdate(pos, state)` = `setBlock(pos, state, UPDATE_ALL)`.

## Forme custom (`VoxelShape`)

Pour un bloc non plein (table, tuyau, statue). La forme sert à la sélection, la collision, l'occlusion de lumière.

```java
public class PedestalBlock extends Block {

    private static final VoxelShape SHAPE = Shapes.or(
            Block.box(2, 0, 2, 14, 2, 14),    // base
            Block.box(5, 2, 5, 11, 12, 11),   // pilier
            Block.box(3, 12, 3, 13, 14, 13)); // plateau

    public PedestalBlock(Properties props) { super(props); }

    @Override
    public VoxelShape getShape(BlockState s, BlockGetter l, BlockPos p, CollisionContext c) {
        return SHAPE;
    }

    @Override public RenderShape getRenderShape(BlockState s) { return RenderShape.MODEL; }
    @Override public boolean useShapeForLightOcclusion(BlockState s) { return true; }
}
```

- `Block.box(x1,y1,z1, x2,y2,z2)` : coordonnées en **seizièmes de bloc** (0–16).
- `Shapes.or(...)` : union ; `Shapes.join(a, b, BooleanOp.ONLY_FIRST)` : soustraction.
- Forme **par direction** : pré-calculez une `Map<Direction, VoxelShape>` (voir plus bas), ne recalculez jamais dans `getShape`.

```java
// Faire tourner une forme pour chaque orientation
private static VoxelShape rotate(VoxelShape shape, Direction to) {
    VoxelShape[] buffer = { shape, Shapes.empty() };
    int times = (to.get2DDataValue() - Direction.NORTH.get2DDataValue() + 4) % 4;
    for (int i = 0; i < times; i++) {
        buffer[0].forAllBoxes((minX, minY, minZ, maxX, maxY, maxZ) ->
            buffer[1] = Shapes.or(buffer[1],
                Shapes.box(1 - maxZ, minY, minX, 1 - minZ, maxY, maxX)));
        buffer[0] = buffer[1];
        buffer[1] = Shapes.empty();
    }
    return buffer[0];
}
```

## Waterlogging

```java
public class PipeBlock extends Block implements SimpleWaterloggedBlock {

    public static final BooleanProperty WATERLOGGED = BlockStateProperties.WATERLOGGED;

    public PipeBlock(Properties p) {
        super(p);
        registerDefaultState(defaultBlockState().setValue(WATERLOGGED, false));
    }

    @Override protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> b) {
        b.add(WATERLOGGED);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext ctx) {
        FluidState fluid = ctx.getLevel().getFluidState(ctx.getClickedPos());
        return defaultBlockState().setValue(WATERLOGGED, fluid.getType() == Fluids.WATER);
    }

    @Override
    public FluidState getFluidState(BlockState s) {
        return s.getValue(WATERLOGGED) ? Fluids.WATER.getSource(false) : super.getFluidState(s);
    }

    @Override
    public BlockState updateShape(BlockState s, Direction dir, BlockState neighbor,
                                  LevelAccessor level, BlockPos pos, BlockPos neighborPos) {
        if (s.getValue(WATERLOGGED)) {
            level.scheduleTick(pos, Fluids.WATER, Fluids.WATER.getTickDelay(level));
        }
        return super.updateShape(s, dir, neighbor, level, pos, neighborPos);
    }
}
```

## Blocs qui tickent

### Tick aléatoire (croissance, propagation)

```java
public MyBlock(Properties p) { super(p.randomTicks()); }   // active les random ticks

@Override
public void randomTick(BlockState s, ServerLevel level, BlockPos pos, RandomSource rand) {
    if (rand.nextInt(5) == 0) {
        // se répandre, mûrir, etc.
    }
}
```

Fréquence ≈ 1 tick aléatoire / bloc / ~68 s en moyenne (dépend de `randomTickSpeed`).

### Tick programmé (déterministe)

```java
@Override
public void neighborChanged(BlockState s, Level level, BlockPos pos, Block block,
                            BlockPos from, boolean moving) {
    if (!level.isClientSide()) {
        level.scheduleTick(pos, this, 4);   // dans 4 ticks
    }
}

@Override
public void tick(BlockState s, ServerLevel level, BlockPos pos, RandomSource rand) {
    // exécuté quand le tick programmé arrive
}
```

Pour un tick **à chaque tick** (machine), utilisez un `BlockEntity` avec ticker (voir [Un bloc avec inventaire](#/block-entity)), pas le bloc.

## Sous-classes vanilla prêtes à l'emploi

| Classe | Pour |
|--------|------|
| `HorizontalDirectionalBlock` | orientation N/S/E/W au placement |
| `DirectionalBlock` | orientation 6 faces |
| `RotatedPillarBlock` | axe X/Y/Z (tronc, poutre) |
| `StairBlock`, `SlabBlock` | escaliers, dalles (demandent un `Supplier<BlockState>` de base) |
| `FenceBlock`, `WallBlock`, `IronBarsBlock` | barrières, murs, grilles (connexions) |
| `DoorBlock`, `TrapDoorBlock`, `FenceGateBlock` | demandent un `BlockSetType` / `WoodType` |
| `ButtonBlock`, `PressurePlateBlock` | redstone (demandent un `BlockSetType`) |
| `BushBlock`, `CropBlock`, `DoublePlantBlock` | végétation — voir [Nourriture & cultures](#/nourriture-cultures) |
| `FallingBlock` | gravité (sable) |
| `BaseEntityBlock` | bloc avec block entity |

> :attention: Depuis 1.20, `DoorBlock`, `TrapDoorBlock`, `ButtonBlock`, `PressurePlateBlock`, `FenceGateBlock`, `StandingSignBlock`… prennent un **`BlockSetType`** (et parfois `WoodType`). Il faut l'**enregistrer** au préalable : `BlockSetType.register(new BlockSetType("monmod:ruby"))` dans le constructeur du mod (avant les blocs), sinon crash au chargement des sons.

## Datagen des blocs à états

```java
// blockstate + modèle pour un bloc orienté "on/off"
@Override
protected void registerStatesAndModels() {
    var polisher = ModBlocks.POLISHER.get();
    ModelFile off = models().orientable("polisher",
            modLoc("block/polisher_side"), modLoc("block/polisher_front"), modLoc("block/polisher_top"));
    ModelFile on = models().orientable("polisher_on",
            modLoc("block/polisher_side"), modLoc("block/polisher_front_on"), modLoc("block/polisher_top"));

    getVariantBuilder(polisher).forAllStates(state -> {
        Direction dir = state.getValue(PolisherBlock.FACING);
        boolean running = state.getValue(PolisherBlock.RUNNING);
        return ConfiguredModel.builder()
                .modelFile(running ? on : off)
                .rotationY((int) dir.toYRot())
                .build();
    });
    // modèle d'item
    simpleBlockItem(polisher, off);
}
```

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Crash au démarrage : `NullPointerException` dans `SoundType` d'une porte/bouton | `BlockSetType` non enregistré | l'enregistrer avant les blocs |
| Le bloc n'a qu'un seul état visuel | propriété absente de `createBlockStateDefinition` | l'ajouter au `Builder` |
| Le bloc « saute » en diagonale pour la collision | `VoxelShape` recalculée chaque frame / mauvaise rotation | pré-calculer une `Map<Direction, VoxelShape>` |
| L'eau disparaît quand on pose le tuyau | pas de `SimpleWaterloggedBlock` / `getFluidState` | implémenter le waterlogging complet |
| `randomTick` jamais appelé | `.randomTicks()` oublié dans les `Properties` | l'ajouter |
| État non synchronisé au client | `setBlock` sans `UPDATE_CLIENTS` | utiliser `UPDATE_ALL` |

Page suivante : **[Outils, armes & armures](#/outils-armures)**.
