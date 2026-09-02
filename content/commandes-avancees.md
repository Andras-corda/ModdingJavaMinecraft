# Commandes avancées (Brigadier)

Minecraft utilise **Brigadier** : un arbre de nœuds (`literal`, `argument`) où chaque branche peut avoir des permissions, des suggestions, et une exécution.

Rappel de base dans [Config & réseau](#/config-reseau). Ici : arguments typés, suggestions, permissions, commandes client.

## Enregistrement

```java
@Mod.EventBusSubscriber(modid = MonMod.MODID)
public class ModCommands {

    @SubscribeEvent
    public static void onRegister(RegisterCommandsEvent event) {
        CommandBuildContext ctx = event.getBuildContext();   // requis pour certains arguments
        event.getDispatcher().register(build(ctx));
    }

    private static LiteralArgumentBuilder<CommandSourceStack> build(CommandBuildContext bctx) {
        return Commands.literal("monmod")
                .then(spawnCommand())
                .then(giveCommand(bctx))
                .then(manaCommand());
    }
}
```

## Arguments typés

| ArgumentType | Lecture |
|--------------|---------|
| `IntegerArgumentType.integer(1, 64)` | `IntegerArgumentType.getInteger(ctx, "n")` |
| `DoubleArgumentType.doubleArg()` / `FloatArgumentType` | `...getDouble(ctx, "x")` |
| `BoolArgumentType.bool()` | `BoolArgumentType.getBool(ctx, "flag")` |
| `StringArgumentType.word()` / `.string()` / `.greedyString()` | `StringArgumentType.getString(ctx, "text")` |
| `EntityArgument.player()` / `.players()` / `.entity()` / `.entities()` | `EntityArgument.getPlayer(ctx, "target")` |
| `BlockPosArgument.blockPos()` | `BlockPosArgument.getLoadedBlockPos(ctx, "pos")` |
| `Vec3Argument.vec3()` | `Vec3Argument.getVec3(ctx, "pos")` |
| `ResourceLocationArgument.id()` | `ResourceLocationArgument.getId(ctx, "id")` |
| `ItemArgument.item(bctx)` | `ItemArgument.getItem(ctx, "item").createItemStack(count, false)` |
| `BlockStateArgument.block(bctx)` | `BlockStateArgument.getBlock(ctx, "block").getState()` |
| `ComponentArgument.textComponent(bctx)` | `ComponentArgument.getComponent(ctx, "msg")` |
| `EnumArgument.enumArgument(MyEnum.class)` (Forge) | `ctx.getArgument("mode", MyEnum.class)` |
| `GameProfileArgument.gameProfile()` | joueurs même hors-ligne |
| `TeamArgument`, `ColorArgument`, `TimeArgument`, `AngleArgument` | — |

Exemple :

```java
private static LiteralArgumentBuilder<CommandSourceStack> giveCommand(CommandBuildContext bctx) {
    return Commands.literal("give")
        .requires(src -> src.hasPermission(2))
        .then(Commands.argument("targets", EntityArgument.players())
            .then(Commands.argument("item", ItemArgument.item(bctx))
                .executes(ctx -> giveItem(ctx, 1))
                .then(Commands.argument("count", IntegerArgumentType.integer(1, 64))
                    .executes(ctx -> giveItem(ctx, IntegerArgumentType.getInteger(ctx, "count"))))));
}

private static int giveItem(CommandContext<CommandSourceStack> ctx, int count) throws CommandSyntaxException {
    Collection<ServerPlayer> targets = EntityArgument.getPlayers(ctx, "targets");
    ItemStack stack = ItemArgument.getItem(ctx, "item").createItemStack(count, false);
    for (ServerPlayer p : targets) p.getInventory().add(stack.copy());
    ctx.getSource().sendSuccess(() ->
        Component.translatable("commands.give.success.single", count,
            stack.getDisplayName(), targets.iterator().next().getDisplayName()), true);
    return targets.size();          // "success count" — visible par /execute store
}
```

## Suggestions (autocomplétion)

```java
private static final SuggestionProvider<CommandSourceStack> SPELL_IDS = (ctx, builder) ->
        SharedSuggestionProvider.suggest(
                ModRegistries.SPELL_REGISTRY.get().getKeys().stream().map(ResourceLocation::toString),
                builder);

Commands.argument("spell", StringArgumentType.word())
        .suggests(SPELL_IDS)
        .executes(...);
```

`SharedSuggestionProvider` fournit des helpers : `suggest(Iterable<String>, builder)`, `suggestResource(Iterable<ResourceLocation>, builder)`, `suggestCoordinates(...)`.

## Erreurs propres

```java
private static final SimpleCommandExceptionType NO_MANA =
        new SimpleCommandExceptionType(Component.translatable("commands.monmod.no_mana"));

private static final DynamicCommandExceptionType TOO_MUCH =
        new DynamicCommandExceptionType(max ->
            Component.translatable("commands.monmod.too_much", max));

// dans un executes :
if (mana < cost) throw NO_MANA.create();
if (amount > 1000) throw TOO_MUCH.create(1000);
```

Ou, non bloquant : `ctx.getSource().sendFailure(Component.literal("..."))` puis `return 0;`.

## Permissions

### Niveau OP simple

```java
.requires(src -> src.hasPermission(2))   // 0 tous, 1, 2 (gamemode...), 3, 4 (stop, op)
```

### API de permissions Forge (nœuds nommés)

Plus fin, compatible avec les plugins de permissions serveur (LuckPerms via un pont).

```java
public static final PermissionNode<Boolean> USE_SPAWN = new PermissionNode<>(
        MonMod.MODID, "command.spawn", PermissionTypes.BOOLEAN,
        (player, playerUUID, context) -> false);           // défaut : refusé

@Mod.EventBusSubscriber(modid = MonMod.MODID)
class Perms {
    @SubscribeEvent
    static void nodes(PermissionGatherEvent.Nodes event) {
        event.addNodes(USE_SPAWN);
    }
}

// dans la commande :
.requires(src -> src.getEntity() instanceof ServerPlayer p
        && PermissionAPI.getPermission(p, USE_SPAWN))
```

## Commandes client

`RegisterClientCommandsEvent` : la commande s'exécute **entièrement côté client**, sans serveur. Idéale pour des outils de debug, des réglages d'affichage.

```java
@SubscribeEvent
public static void clientCommands(RegisterClientCommandsEvent event) {
    event.getDispatcher().register(Commands.literal("monmoddbg")
        .then(Commands.literal("hitresult").executes(ctx -> {
            HitResult h = Minecraft.getInstance().hitResult;
            ctx.getSource().sendSuccess(() -> Component.literal(String.valueOf(h)), false);
            return 1;
        })));
}
```

Le `CommandSourceStack` d'une commande client a `sendSuccess`/`sendFailure` qui écrivent dans le chat local ; `ctx.getSource().getPlayer()` est le `LocalPlayer`.

## Redirections & alias

```java
LiteralCommandNode<CommandSourceStack> root =
        dispatcher.register(Commands.literal("monmod").then(...));

dispatcher.register(Commands.literal("mm").redirect(root));   // /mm = /monmod
```

## `CommandSourceStack` — l'essentiel

| Méthode | Renvoie |
|---------|---------|
| `getPlayerOrException()` | `ServerPlayer` (lève si console) |
| `getEntity()` / `getEntityOrException()` | l'exécutant |
| `getLevel()` | `ServerLevel` |
| `getPosition()` / `getRotation()` | `Vec3` / `Vec2` |
| `hasPermission(int)` | niveau OP |
| `sendSuccess(Supplier<Component>, boolean broadcastToOps)` | message de succès |
| `sendFailure(Component)` | message d'échec (rouge) |
| `withSuppressedOutput()` | pour `/execute` silencieux |

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| `ItemArgument.item(...)` ne compile pas | manque le `CommandBuildContext` | `event.getBuildContext()` |
| La commande n'apparaît pas | `RegisterCommandsEvent` mal abonné | bus FORGE, `@SubscribeEvent` |
| Suggestions vides | `SuggestionProvider` renvoie sans `.suggest(...)` | utiliser `SharedSuggestionProvider` |
| `getPlayer()` NPE en console | pas de garde | `getPlayerOrException()` + `try/catch` Brigadier |
| Commande client qui essaie de modifier le monde | confusion client/serveur | commande client = affichage local seulement |
| `return 0` traité comme échec silencieux | 0 = « aucun succès » | renvoyer ≥ 1, ou `sendFailure` explicite |

Page suivante : **[Écrans & widgets](#/gui-screens)**.
