# Curios : emplacements d'équipement

**Curios API** ajoute des **emplacements d'équipement** au joueur (et aux autres entités) : amulette, ceinture, anneau, cape, charme… au-delà des 4 slots d'armure vanilla. C'est le standard partagé par des dizaines de mods.

> :attention: **Versions.** Curios **5.x** pour 1.20.1. API sur [maven.blamejared.com](https://maven.blamejared.com). En 1.20.1, les slots sont **data-driven** (fichiers JSON). Doc : [github.com/TheIllusiveC4/Curios/wiki](https://github.com/TheIllusiveC4/Curios/wiki).

## 1. Dépendance

```gradle
repositories { maven { url = "https://maven.blamejared.com" } }
dependencies {
    // "forge" contient déjà l'API
    implementation fg.deobf("top.theillusivec4.curios:curios-forge:${curios_version}+1.20.1")
    // en dépendance douce :
    // compileOnly fg.deobf("top.theillusivec4.curios:curios-forge:${curios_version}+1.20.1:api")
    // runtimeOnly fg.deobf("top.theillusivec4.curios:curios-forge:${curios_version}+1.20.1")
}
```

## 2. Déclarer un slot (data-driven)

Deux fichiers de datapack.

`src/main/resources/data/curios/slots/amulet.json` — définit le type de slot **globalement** :

```json
{
  "replace": false,
  "add_cosmetic": true,
  "size": 1,
  "order": 100,
  "icon": "monmod:slot/amulet"
}
```

`src/main/resources/data/curios/entities/player.json` — attache le slot au joueur :

```json
{
  "replace": false,
  "entities": [ "minecraft:player" ],
  "slots": [ "amulet" ]
}
```

Icône : `assets/monmod/textures/slot/amulet.png` (16×16), affichée dans l'écran Curios.

> :info: Slots standard déjà fournis par Curios (à réutiliser plutôt que d'en créer) : `ring`, `necklace`, `belt`, `back`, `hands`, `head`, `body`, `charm`, `feet`.

## 3. L'item : `ICurioItem`

Le plus simple — implémenter `ICurioItem` **directement sur l'`Item`** :

```java
public class AmuletOfHasteItem extends Item implements ICurioItem {

    private static final UUID HASTE_UUID = UUID.fromString("d5a1b2c3-0000-0000-0000-000000000010");

    public AmuletOfHasteItem(Properties props) { super(props.stacksTo(1)); }

    @Override
    public void curioTick(SlotContext ctx, ItemStack stack) {
        // appelé chaque tick tant que porté (côté serveur ET client)
    }

    @Override
    public void onEquip(SlotContext ctx, ItemStack prevStack, ItemStack stack) {
        if (ctx.entity() instanceof Player p && !p.level().isClientSide()) {
            p.level().playSound(null, p.blockPosition(), SoundEvents.ARMOR_EQUIP_GOLD,
                    SoundSource.PLAYERS, 0.6F, 1.0F);
        }
    }

    @Override
    public Multimap<Attribute, AttributeModifier> getAttributeModifiers(SlotContext ctx, UUID uuid, ItemStack stack) {
        Multimap<Attribute, AttributeModifier> map = HashMultimap.create();
        map.put(Attributes.ATTACK_SPEED, new AttributeModifier(
                HASTE_UUID, "amulet_haste", 0.15, AttributeModifier.Operation.MULTIPLY_TOTAL));
        return map;
    }

    @Override
    public boolean canEquipFromUse(SlotContext ctx, ItemStack stack) {
        return true;   // clic droit pour équiper directement
    }

    // Restreindre aux slots "necklace" / "amulet"
    @Override
    public boolean canEquip(SlotContext ctx, ItemStack stack) {
        return ctx.identifier().equals("necklace") || ctx.identifier().equals("amulet");
    }
}
```

`SlotContext` fournit : `entity()`, `identifier()` (nom du slot), `index()`, `visible()`, `cosmetic()`.

## 4. Lire l'équipement en jeu

```java
// Le joueur porte-t-il un item précis dans un curio ?
boolean wearing = CuriosApi.getCuriosInventory(player)
        .map(inv -> inv.isEquipped(ModItems.AMULET_OF_HASTE.get()))
        .orElse(false);

// Récupérer le stack (et son slot)
Optional<SlotResult> found = CuriosApi.getCuriosInventory(player)
        .flatMap(inv -> inv.findFirstCurio(ModItems.AMULET_OF_HASTE.get()));
found.ifPresent(res -> { ItemStack stack = res.stack(); });

// Tous les curios d'un type
CuriosApi.getCuriosInventory(player).ifPresent(inv -> {
    ICurioStacksHandler necklaces = inv.getCurios().get("necklace");
    // necklaces.getStacks() ...
});
```

## 5. Rendu du curio sur le joueur

```java
// client setup
CuriosRendererRegistry.register(ModItems.AMULET_OF_HASTE.get(), AmuletRenderer::new);
```

```java
public class AmuletRenderer implements ICurioRenderer {
    @Override
    public <T extends LivingEntity, M extends EntityModel<T>> void render(
            ItemStack stack, SlotContext ctx, PoseStack pose, RenderLayerParent<T, M> parent,
            MultiBufferSource buffers, int light, float limbSwing, float limbSwingAmount,
            float partialTicks, float ageInTicks, float netHeadYaw, float headPitch) {

        LivingEntity entity = ctx.entity();
        pose.pushPose();
        // se caler sur le torse
        if (parent.getModel() instanceof HumanoidModel<?> humanoid) {
            humanoid.body.translateAndRotate(pose);
        }
        pose.translate(0.0, 0.20, -0.13);
        pose.scale(0.4F, 0.4F, 0.4F);
        Minecraft.getInstance().getItemRenderer().renderStatic(
                stack, ItemDisplayContext.NONE, light, OverlayTexture.NO_OVERLAY,
                pose, buffers, entity.level(), 0);
        pose.popPose();
    }
}
```

Si vous ne voulez **aucun** rendu, ne rien enregistrer.

## 6. Curio via capability (au lieu d'`ICurioItem`)

Utile si l'`Item` ne peut pas implémenter l'interface (item d'un autre mod, logique partagée). `AttachCapabilitiesEvent<ItemStack>` → fournir un `ICurio` sous `CuriosCapability.ITEM`. Voir le wiki, section *Curio Capability*.

## 7. Ajouter un slot à un item **existant** (compat)

Par datapack, sans code :

`data/monmod/curios/slots/... ` non ; c'est via un **tag** : `data/curios/tags/items/<slot>.json` liste les items autorisés dans ce slot. Ex. `data/curios/tags/items/curio.json`.

## Pièges fréquents

| Symptôme | Cause | Correctif |
|----------|-------|-----------|
| Le slot n'apparaît pas | `data/curios/entities/player.json` manquant | ajouter le fichier d'attache |
| L'item ne rentre dans aucun slot | `canEquip` trop restrictif, ou item pas dans le bon slot | vérifier `ctx.identifier()` / le tag |
| Attributs pas appliqués | `getAttributeModifiers` sans UUID stable | UUID constant par modifier |
| Curio invisible alors qu'on veut un rendu | `CuriosRendererRegistry.register` oublié | l'enregistrer en client setup |
| `curioTick` double les effets | logique hors garde serveur | `if (!ctx.entity().level().isClientSide())` |
| `NoClassDefFoundError top/theillusivec4/...` | dépendance douce sans garde | isoler, `ModList.get().isLoaded("curios")` |

Page suivante : **[Patchouli : livre de guide](#/patchouli)**.
