import { MgT2ActorSheet } from "/systems/mgt2e/module/sheets/actor-sheet.mjs";
import { BlueprintShipModel } from "./model.mjs";
import {
  BlueprintShipSheet,
  deliverDesign,
  designFromHeader,
  editingDesign,
  isBreakawayAttached,
  projectInstalled
} from "./sheet.mjs";
import { MODULE_ID, SHEET_PARTS, SHIP_ICON, SHIP_TYPE, SYNC_OPTION } from "./constants.mjs";
import {
  actorsUsingDesign,
  adoptSpawnedDesigns,
  makeIndependent,
  separateSharedActors
} from "./breakaway-actors.mjs";
import { readHeader, touchesHeader } from "./sync.mjs";
import { withSpacecraftType } from "./wrap.mjs";

Hooks.once("init", () => {
  const Base = CONFIG.Actor.documentClass;
  // The blueprint actor subclasses the system actor, so Mongoose must already be loaded.
  if (typeof Base.prototype._prepareSpacecraftData !== "function") {
    console.error(
      `${MODULE_ID} loaded before Mongoose Traveller. Enable the mgt2e system.`
    );
    return;
  }

  /** Blueprint ship document. Spacecraft methods run with the type disguised as spacecraft. */
  class BlueprintActor extends Base {
    /** A new blueprint ship uses the free-trader token. Other actor types keep the system artwork. */
    static getDefaultArtwork(actorData) {
      if (actorData?.type !== SHIP_TYPE) return super.getDefaultArtwork(actorData);
      return { img: SHIP_ICON, texture: { src: SHIP_ICON } };
    }

    /** System updates assume type spacecraft. Disguise this ship for that call. */
    _preUpdate(changes, options, userId) {
      if (this.type !== SHIP_TYPE) return super._preUpdate(changes, options, userId);
      return withSpacecraftType(this, () => super._preUpdate(changes, options, userId));
    }

    /** Derived spacecraft numbers. `actor` is the document being prepared, which may be this ship. */
    _prepareSpacecraftData(actor) {
      const target = actor?.type === SHIP_TYPE ? actor : this.type === SHIP_TYPE ? this : null;
      if (!target) return super._prepareSpacecraftData(actor);
      return withSpacecraftType(target, () => super._prepareSpacecraftData(actor));
    }

    /** Hull damage uses the spacecraft sheet path. */
    applyDamage(damage, options, multiSelect) {
      if (this.type !== SHIP_TYPE) return super.applyDamage(damage, options, multiSelect);
      return withSpacecraftType(this, () => super.applyDamage(damage, options, multiSelect));
    }

    /** Critical lookup on a blueprint ship goes through the spacecraft implementation. */
    getCriticalLevel(critical) {
      if (this.type !== SHIP_TYPE) return super.getCriticalLevel(critical);
      return withSpacecraftType(this, () => super.getCriticalLevel(critical));
    }

    /** Critical writes on a blueprint ship go through the spacecraft implementation. */
    setCriticalLevel(critical, level) {
      if (this.type !== SHIP_TYPE) return super.setCriticalLevel(critical, level);
      return withSpacecraftType(this, () => super.setCriticalLevel(critical, level));
    }
  }

  CONFIG.Actor.documentClass = BlueprintActor;
  // Hull options the design can write. The system table does not know these tokens.
  const hulls = CONFIG.MGT2?.SPACECRAFT_HULLS;
  if (hulls) {
    hulls.adjustableHull = { tonPc: 5, conflict: ["adjustableHull15"] };
    hulls.adjustableHull15 = { tonPc: 1, conflict: ["adjustableHull"] };
    hulls.moduleHull = { conflict: ["light", "reinforced"] };
    for (const token of ["light", "reinforced"]) {
      const conflict = hulls[token]?.conflict ?? [];
      if (!conflict.includes("moduleHull")) conflict.push("moduleHull");
      hulls[token].conflict = conflict;
    }
  }
  CONFIG.Actor.dataModels[SHIP_TYPE] = BlueprintShipModel;
  Actors.unregisterSheet("mgt2e", MgT2ActorSheet, { types: [SHIP_TYPE] });
  Actors.registerSheet(MODULE_ID, BlueprintShipSheet, {
    types: [SHIP_TYPE],
    makeDefault: true,
    label: "Blueprint Ship"
  });

  const itemProto = CONFIG.Item.documentClass.prototype;
  const preCreate = itemProto._preCreate;
  // Items created on a blueprint ship still run the spacecraft item setup.
  itemProto._preCreate = function (data, options, userId) {
    const actor = this.actor;
    if (actor?.type === SHIP_TYPE) {
      return withSpacecraftType(actor, () => preCreate.call(this, data, options, userId));
    }
    return preCreate.call(this, data, options, userId);
  };

  void foundry.applications.handlebars.loadTemplates(SHEET_PARTS);
  void patchSystemSheets();
});

/** Package id before the spelling change. Ships saved under it are moved on ready. */
const PREVIOUS_MODULE_ID = "traveler-blueprint";

Hooks.once("ready", () => {
  void renamePreviousModuleId().then(() => separateSharedActors());
});

/** A duplicated ship gets its own design ids. Spawned hulls are created with SYNC_OPTION and stay linked. */
Hooks.on("createActor", (actor, options) => {
  if (actor?.type !== SHIP_TYPE || options?.[SYNC_OPTION]) return;
  void makeIndependent(actor).then((changed) => {
    if (changed) return syncShip(actor);
  });
});

/** Move ships and their items off the previous module id. */
async function renamePreviousModuleId() {
  // Players do not rewrite world actors. The first GM to load the world does.
  if (!game.user?.isGM) return;
  const previousType = `${PREVIOUS_MODULE_ID}.ship`;
  for (const actor of game.actors ?? []) {
    const update = renamedFlags(actor);
    if (actor.type === previousType) update.type = SHIP_TYPE;
    if (Object.keys(update).length > 0) {
      await actor.update(update, { [SYNC_OPTION]: true });
    }
    const items = [];
    for (const item of actor.items ?? []) {
      const renamed = renamedFlags(item);
      if (Object.keys(renamed).length === 0) continue;
      items.push({ _id: item.id, ...renamed });
    }
    if (items.length > 0) {
      await actor.updateEmbeddedDocuments("Item", items, { [SYNC_OPTION]: true });
    }
  }
}

/** Flag update that copies the previous module namespace onto this one, then deletes the old namespace. */
function renamedFlags(document) {
  const previous = document.flags?.[PREVIOUS_MODULE_ID];
  if (!previous) return {};
  const update = { [`flags.-=${PREVIOUS_MODULE_ID}`]: null };
  // Keep flags already written under the new id. Only fill them when they are absent.
  if (!document.flags?.[MODULE_ID]) update[`flags.${MODULE_ID}`] = previous;
  return update;
}

/** Dropping a carried hull clears it from every ship that still lists it, then reprojects those ships. */
Hooks.on("deleteActor", (actor) => {
  if (!actor?.id) return;
  const ships = game.actors?.filter?.(() => true) ?? [];
  for (const ship of ships) {
    if (ship?.type !== SHIP_TYPE) continue;
    const patch = {};
    if (ship.system?.moduleBay?.[actor.id]) patch[`system.moduleBay.-=${actor.id}`] = null;
    if (ship.system?.breakawayBay?.[actor.id]) {
      patch[`system.breakawayBay.-=${actor.id}`] = null;
    }
    if (Object.keys(patch).length === 0) continue;
    void ship.update(patch, { render: false, [SYNC_OPTION]: true }).then(() => syncShip(ship));
  }
});

/** A header edit reprojects the ship. Our own writes set SYNC_OPTION and stop here. */
Hooks.on("updateActor", (actor, changes, options) => {
  if (actor?.type !== SHIP_TYPE || options?.[SYNC_OPTION]) return;
  const hits = Number(actor.system?.hits?.value);
  if (changes?.system?.hits && hits < 1 && typeof actor.setDestroyedEffect === "function") {
    actor.setDestroyedEffect(true);
  }
  if (touchesHeader(changes)) void syncShip(actor);
  void refreshCarriers(actor);
});

/** Rebuild the actor from its design. `fromDesign` publishes the stored design instead of the sheet draft. */
export async function syncShip(actor, options = {}) {
  const blueprint = actor.system?.blueprint ?? {};
  // The selected design, or the first saved one when the selection is missing.
  const stored = (blueprint.designs ?? []).find((design) => design.id === blueprint.currentId) ??
    blueprint.designs?.[0] ??
    null;
  const live = options.fromDesign ? null : editingDesign(actor.id);
  const header = readHeader(actor);
  // An open editor wins over the last save, unless this sync is publishing a child hull.
  const source = options.fromDesign ? structuredClone(stored) : (live?.design ?? stored);
  // Attached hulls keep the design's hull tons. The actor header shows the combined displacement.
  const attachedHull = Object.values(actor.system?.breakawayBay ?? {}).some(isBreakawayAttached);
  if (!options.fromDesign && source && attachedHull) {
    header.dtons = Number(source.hullTons) || header.dtons;
  }
  // Two copies share one design. Renaming this actor must not rename that design.
  let keepName = false;
  const previousDesignName = String(source?.name ?? "").trim();
  const requestedName = header.name.trim();
  if (
    !options.fromDesign &&
    source?.id &&
    requestedName &&
    requestedName !== previousDesignName &&
    actorsUsingDesign(source.id).length > 1
  ) {
    keepName = true;
    header.name = previousDesignName;
  }
  let design = options.fromDesign && source ? source : designFromHeader(source, header);
  let modules = (options.fromDesign ? blueprint.modules : (live?.modules ?? blueprint.modules))
    ?.filter((row) => row?.id !== design.id) ?? [];
  if (!options.fromDesign) {
    const adopted = adoptSpawnedDesigns(actor, [design, ...modules], (child) =>
      editingDesign(child.id)?.design ?? null
    );
    design = adopted[0] ?? design;
    modules = adopted.slice(1);
  }
  const projection = await projectInstalled(
    actor,
    design,
    [design, ...modules],
    options.fromDesign ? "" : header.hullOptions,
    {
      pushDesigns: options.fromDesign === true,
      keepName,
      failure: "could not apply the header"
    }
  );
  if (!projection) return;
  deliverDesign(actor.id, design, modules);
}

/** A carried module or breakaway changed. Reproject every ship that has it aboard. */
async function refreshCarriers(moduleActor) {
  const ships = game.actors?.filter?.(() => true) ?? game.actors ?? [];
  for (const ship of ships) {
    if (ship?.id === moduleActor.id || ship?.type !== SHIP_TYPE) continue;
    const carried = ship.system?.moduleBay?.[moduleActor.id] ||
      ship.system?.breakawayBay?.[moduleActor.id];
    if (!carried) continue;
    await syncShip(ship);
  }
}

/** System dialogs read actor.type. Show blueprint ships as spacecraft while they run. */
async function patchSystemSheets() {
  try {
    const dialog = await import("/systems/mgt2e/module/helpers/spacecraft-attack-dialog.mjs");
    const original = dialog.MgT2SpacecraftAttackDialog.prototype.calculateTargets;
    dialog.MgT2SpacecraftAttackDialog.prototype.calculateTargets = function () {
      const targets = game.users?.current?.targets ?? [];
      const ships = [];
      for (const token of targets) {
        if (token.actor?.type === SHIP_TYPE) ships.push(token.actor);
      }
      // Nest the disguise so every targeted blueprint ship looks like a spacecraft.
      let call = () => original.call(this);
      for (const actor of ships) {
        const next = call;
        call = () => withSpacecraftType(actor, next);
      }
      return call();
    };
  } catch (error) {
    console.warn(`${MODULE_ID} could not patch spacecraft targeting`, error);
  }

  try {
    const items = await import("/systems/mgt2e/module/sheets/item-sheet.mjs");
    const original = items.MgT2ItemSheet.prototype.getData;
    items.MgT2ItemSheet.prototype.getData = function () {
      const parent = this.item?.parent;
      if (parent?.type === SHIP_TYPE) {
        return withSpacecraftType(parent, () => original.call(this));
      }
      return original.call(this);
    };
  } catch (error) {
    console.warn(`${MODULE_ID} could not patch hardware sheets`, error);
  }
}
