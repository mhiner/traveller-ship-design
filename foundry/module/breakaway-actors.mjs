import { MODULE_ID, SHIP_TYPE, SYNC_OPTION } from "./constants.mjs";
import { writeActorName } from "./sync.mjs";
import {
  breakawayActorSlots,
  designsReferencedBy,
  isBreakawayDesign,
  isolateDesigns,
  moduleActorSlots,
  splitRepeatedBreakaways
} from "../dist/blueprint.js";

/** Flag names for a spawned child. Modules count copies. Breakaway hulls do not. */
const SPAWN = {
  breakaway: {
    parent: "breakawayParent",
    design: "breakawayDesign",
    index: "breakawayIndex",
    bay: "breakawayBay",
    fallback: "Breakaway hull",
    count: false
  },
  module: {
    parent: "moduleParent",
    design: "moduleDesign",
    index: "moduleIndex",
    bay: "moduleBay",
    fallback: "Module",
    count: true
  }
};

/** Parents currently creating children. A second call for the same actor waits out. */
const ensuring = new Set();
/** Designs being spawned, so a hull cannot spawn itself. */
const designStack = [];
/** Parents adopting a child's edit. Publishing back is skipped while this is set. */
const adopting = new Set();

/** World actors. `contents` is the live list. An older game.actors is already a collection. */
function actors() {
  const list = game.actors?.contents ?? game.actors ?? [];
  return [...list];
}

/** A module flag, from getFlag or the raw flags object when getFlag is missing. */
function flag(actor, key) {
  return actor?.getFlag?.(MODULE_ID, key) ?? actor?.flags?.[MODULE_ID]?.[key];
}

/** Blueprint ships that name this actor as their parent under one flag. */
function spawnedBy(parentId, parentKey) {
  return actors().filter((actor) =>
    actor?.type === SHIP_TYPE && flag(actor, parentKey) === parentId
  );
}

/** Modules and breakaway hulls this ship has spawned. */
function spawnedDesigns(parentId) {
  return [
    ...spawnedBy(parentId, SPAWN.breakaway.parent),
    ...spawnedBy(parentId, SPAWN.module.parent)
  ];
}

/** Display name for one copy. The first copy keeps the design name. Later copies are numbered. */
function instanceName(base, index) {
  const name = String(base ?? "").trim();
  const slot = Number(index) || 0;
  if (!name) return "";
  return slot > 0 ? `${name} ${slot + 1}` : name;
}

/** True when this actor name was still the design name, or the numbered copy of it. */
function usesDesignName(actorName, designName, index) {
  const current = String(actorName ?? "").trim();
  const design = String(designName ?? "").trim();
  if (!current || !design) return !current;
  return current === design || current === instanceName(design, index);
}

/** The design selected on the actor, or the first saved design. */
function storedDesign(actor) {
  const blueprint = actor?.system?.blueprint ?? {};
  const designs = blueprint.designs ?? [];
  return designs.find((row) => row.id === blueprint.currentId) ?? designs[0] ?? null;
}

/** Foundry's last-modified time, used to pick the newest edit of one design. */
function modified(actor) {
  return Number(actor?._stats?.modifiedTime ?? actor?.updatedAt ?? 0);
}

/** Actors whose selected design has this id. Two attached copies of one hull both match. */
export function actorsUsingDesign(designId) {
  if (!designId) return [];
  return actors().filter((actor) => storedDesign(actor)?.id === designId);
}

/** The actor is still in the world. An update after a delete would report a missing id. */
function stillPresent(actor) {
  return Boolean(actor?.id && game.actors?.get?.(actor.id));
}

/** Structural equality for a design document. Key order is stable from structuredClone. */
function sameDesign(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/** Replace catalog hulls with the design on the spawned actor. The actor is the copy that was edited. */
export function adoptSpawnedDesigns(actor, catalog, liveDesign = () => null) {
  const newest = new Map();
  for (const child of spawnedDesigns(actor?.id)) {
    const id = flag(child, "breakawayDesign") || flag(child, "moduleDesign");
    if (!id) continue;
    const design = liveDesign(child) ?? storedDesign(child);
    if (!design || design.id !== id) continue;
    const previous = newest.get(id);
    if (!previous || modified(child) >= modified(previous.actor)) {
      newest.set(id, { actor: child, design });
    }
  }
  if (newest.size === 0) return catalog;
  return catalog.map((row) => {
    const found = newest.get(row?.id);
    return found ? structuredClone(found.design) : row;
  });
}

/** Create one blueprint ship for each breakaway hull named on the design, and join it. */
export async function ensureBreakawayActors(actor, design, catalog, options = {}) {
  if (!actor?.id || ensuring.has(actor.id)) return;
  // A hull already on the spawn stack must not create itself again.
  if (design?.id && designStack.includes(design.id)) return;
  ensuring.add(actor.id);
  adopting.add(actor.id);
  if (design?.id) designStack.push(design.id);
  try {
    // Two slots that name one design become two designs, so each hull actor can be renamed alone.
    const list = catalog ?? [];
    const { added, adoptedFrom } = splitRepeatedBreakaways(design, list);
    if (added.length) list.push(...added);
    await reconcileSpawned(
      actor,
      isBreakawayDesign(design) ? breakawayActorSlots(design, list) : [],
      list,
      options.pushDesigns === true,
      "breakaway",
      adoptedFrom
    );
  } finally {
    ensuring.delete(actor.id);
    adopting.delete(actor.id);
    if (design?.id && designStack.at(-1) === design.id) designStack.pop();
  }
}

/** Create one blueprint ship for each module named on a modular hull, and install it. */
export async function ensureModuleActors(actor, design, catalog, options = {}) {
  if (!actor?.id || ensuring.has(actor.id)) return;
  if (design?.id && designStack.includes(design.id)) return;
  ensuring.add(actor.id);
  adopting.add(actor.id);
  if (design?.id) designStack.push(design.id);
  try {
    await reconcileSpawned(
      actor,
      moduleActorSlots(design, catalog ?? []),
      catalog,
      options.pushDesigns === true,
      "module"
    );
  } finally {
    ensuring.delete(actor.id);
    adopting.delete(actor.id);
    if (design?.id && designStack.at(-1) === design.id) designStack.pop();
  }
}

/** Write this hull back onto the parent blueprint and refresh the combined ship. */
export async function publishBreakawayDesign(actor, design) {
  const parentId = flag(actor, "breakawayParent") || flag(actor, "moduleParent");
  // The parent is still adopting this child, so writing back would loop.
  if (!parentId || !design || adopting.has(parentId)) return;
  const parent = game.actors?.get?.(parentId);
  if (!parent) return;
  const modules = [...(parent.system?.blueprint?.modules ?? [])];
  const index = modules.findIndex((row) => row?.id === design.id);
  const copy = structuredClone(design);
  const previousName = index >= 0 ? modules[index]?.name : "";
  if (index >= 0 && sameDesign(modules[index], copy)) return;
  if (index >= 0) modules[index] = copy;
  else modules.push(copy);
  await parent.update(
    { "system.blueprint.modules": modules },
    { render: false, diff: false, [SYNC_OPTION]: true }
  );
  // Copies that still used the old design name follow it. A renamed actor is left as it is.
  await renameDefaultCopies(copy, previousName, actor.id);
  const { syncShip } = await import("./main.mjs");
  await syncShip(parent);
}

/** Give other copies the new design name when they were still using the old one. */
async function renameDefaultCopies(design, previousName, editedId) {
  const next = String(design?.name ?? "").trim();
  const previous = String(previousName ?? "").trim();
  if (!design?.id || !next || !previous || next === previous) return;
  for (const child of actorsUsingDesign(design.id)) {
    if (!stillPresent(child) || child.id === editedId) continue;
    const index = Number(flag(child, "breakawayIndex") ?? flag(child, "moduleIndex")) || 0;
    if (!usesDesignName(child.name, previous, index)) continue;
    await writeActorName(child, instanceName(next, index));
  }
}

/** Match spawned actors to the slots the design asks for. Leftovers are deleted. */
async function reconcileSpawned(actor, slots, catalog, pushDesigns, kind, adoptedFrom = new Map()) {
  const spec = SPAWN[kind];
  const existing = spawnedBy(actor.id, spec.parent);
  const pool = [...existing];
  const wanted = [];
  const groups = [];
  for (const hull of slots) {
    if (designStack.includes(hull.id)) continue;
    // Several module copies share one actor and raise its quantity.
    if (spec.count) {
      const found = groups.find((row) => row.hull.id === hull.id);
      if (found) {
        found.quantity += 1;
        continue;
      }
    }
    groups.push({ hull, quantity: 1 });
  }
  for (const group of groups) {
    const hull = group.hull;
    const index = wanted.length;
    const sourceId = adoptedFrom.get(hull.id);
    let at = pool.findIndex((child) => flag(child, spec.design) === hull.id);
    // A forked copy takes the child that still carries the id it was copied from.
    if (at < 0 && sourceId) at = pool.findIndex((child) => flag(child, spec.design) === sourceId);
    let child = at >= 0 ? pool.splice(at, 1)[0] : null;
    if (!child) {
      child = await createSpawnedActor(actor, hull, index, catalog, spec);
      if (child) {
        const { syncShip } = await import("./main.mjs");
        await syncShip(child, { fromDesign: true });
      }
    } else if (flag(child, spec.design) !== hull.id) {
      // The copy now has its own design. Keep the actor name the user already set.
      await installDesign(child, hull, catalog, spec, { keepActorName: true });
      const { syncShip } = await import("./main.mjs");
      await syncShip(child, { fromDesign: true });
    } else if (pushDesigns && !sameDesign(storedDesign(child), hull)) {
      // The parent design changed this hull. Push that copy onto the child.
      await installDesign(child, hull, catalog, spec);
      const { syncShip } = await import("./main.mjs");
      await syncShip(child, { fromDesign: true });
    }
    if (child && stillPresent(child) && flag(child, spec.index) !== index) {
      await child.update(
        { [`flags.${MODULE_ID}.${spec.index}`]: index },
        { render: false, [SYNC_OPTION]: true }
      );
    }
    if (child && stillPresent(child)) wanted.push({ actor: child, quantity: group.quantity });
  }
  for (const leftover of pool) {
    // A copy the user attached stays listed. Deleting it makes the next update miss its id.
    const listed = actor.system?.[spec.bay]?.[leftover.id];
    if (listed && stillPresent(leftover)) {
      wanted.push({
        actor: leftover,
        quantity: Math.max(1, Math.round(Number(listed.quantity) || 1))
      });
      continue;
    }
    await deleteSpawned(leftover);
  }
  await joinSpawned(actor, wanted, new Set(existing.map((child) => child.id)), spec.bay);
}

/** Replace the child's stored design with the hull from the parent. A custom actor name is kept. */
async function installDesign(child, hull, catalog, spec, options = {}) {
  if (!stillPresent(child)) return;
  const index = Number(flag(child, spec.index)) || 0;
  const previous = String(storedDesign(child)?.name ?? "").trim();
  const nextBase = String(hull.name ?? "").trim() || child.name || spec.fallback;
  const name = options.keepActorName || !usesDesignName(child.name, previous, index)
    ? child.name
    : instanceName(nextBase, index);
  await child.update({
    [`flags.${MODULE_ID}.${spec.design}`]: hull.id,
    "system.blueprint.currentId": hull.id,
    "system.blueprint.designs": [structuredClone(hull)],
    "system.blueprint.modules": designsReferencedBy(hull, catalog ?? [])
  }, { render: false, diff: false, [SYNC_OPTION]: true });
  await writeActorName(child, name);
}

/** A new blueprint ship in the parent's folder, flagged as this parent's child. */
async function createSpawnedActor(parent, hull, index, catalog, spec) {
  const name = instanceName(String(hull.name ?? "").trim() || spec.fallback, index);
  const folder = parent.folder?.id ?? parent.folder ?? null;
  const created = await Actor.create({
    name,
    type: SHIP_TYPE,
    folder,
    flags: {
      [MODULE_ID]: {
        [spec.parent]: parent.id,
        [spec.index]: index,
        [spec.design]: hull.id
      }
    },
    system: {
      blueprint: {
        currentId: hull.id,
        designs: [hull],
        modules: designsReferencedBy(hull, catalog ?? [])
      }
    }
  }, { render: false, [SYNC_OPTION]: true });
  return Array.isArray(created) ? created[0] : created;
}

/** Delete a spawned ship and the ships it spawned. */
export async function deleteSpawned(actor) {
  if (!stillPresent(actor)) return;
  for (const child of spawnedDesigns(actor.id)) await deleteSpawned(child);
  if (!stillPresent(actor)) return;
  await actor.delete({ render: false });
}

/** Write the bay map. Quantity is updated only when it changed, and a detached hull stays detached. Removed children are cleared. */
async function joinSpawned(actor, wanted, previousIds, bayKey) {
  const wantedIds = new Set(wanted.map((child) => child.actor.id));
  const patch = {};
  let changed = false;
  for (const id of previousIds) {
    if (wantedIds.has(id)) continue;
    patch[`system.${bayKey}.-=${id}`] = null;
    changed = true;
  }
  const bay = actor.system?.[bayKey] ?? {};
  for (const child of wanted) {
    const current = bay[child.actor.id];
    // A detached hull stays detached. A new hull starts attached.
    const attached = current ? current.attached !== false : true;
    if (current && Number(current.quantity) === child.quantity && current.attached === attached) {
      continue;
    }
    // An older entry with no attached flag is already joined, so a matching quantity needs no write.
    if (current && current.attached === undefined && attached && Number(current.quantity) === child.quantity) {
      continue;
    }
    patch[`system.${bayKey}.${child.actor.id}`] = { quantity: child.quantity, attached };
    changed = true;
  }
  if (!changed) return;
  await actor.update(patch, { render: false, diff: true, [SYNC_OPTION]: true });
}

/** Designs stored on the actor, the current design first and then the catalog. */
function blueprintDesigns(actor) {
  const blueprint = actor?.system?.blueprint ?? {};
  return [...(blueprint.designs ?? []), ...(blueprint.modules ?? [])].filter((row) => row?.id);
}

/** True when another ship already stores this design id. */
function designIdUsedByOther(id, exceptId) {
  return actors().some((actor) =>
    actor?.id &&
    actor.id !== exceptId &&
    actor.type === SHIP_TYPE &&
    blueprintDesigns(actor).some((design) => design.id === id)
  );
}

/**
 * Give this actor its own design ids.
 * Spawn flags are cleared unless the caller is keeping this hull on its parent.
 * Carried-hull lists on this actor are cleared so a duplicate does not control the original's hulls.
 * Returns the new current design id, or null when nothing was copied.
 */
export async function makeIndependent(actor, options = {}) {
  if (!stillPresent(actor)) return null;
  const blueprint = actor.system?.blueprint ?? {};
  const designs = [...(blueprint.designs ?? []), ...(blueprint.modules ?? [])];
  const ids = designs.map((row) => row?.id).filter(Boolean);
  if (ids.length === 0) return null;
  if (!options.force && !ids.some((id) => designIdUsedByOther(id, actor.id))) return null;
  const isolated = isolateDesigns(designs);
  const index = designs.findIndex((row) => row?.id === blueprint.currentId);
  const current = (index >= 0 ? isolated[index]?.id : isolated[0]?.id) ?? "";
  const oldId = storedDesign(actor)?.id;
  const designCount = (blueprint.designs ?? []).length;
  const update = {
    "system.blueprint.currentId": current,
    "system.blueprint.designs": isolated.slice(0, designCount),
    "system.blueprint.modules": isolated.slice(designCount)
  };
  if (options.keepLinks) {
    if (flag(actor, "breakawayDesign") === oldId) {
      update[`flags.${MODULE_ID}.breakawayDesign`] = current;
    }
    if (flag(actor, "moduleDesign") === oldId) {
      update[`flags.${MODULE_ID}.moduleDesign`] = current;
    }
  } else {
    for (const key of [
      "breakawayParent",
      "breakawayDesign",
      "breakawayIndex",
      "moduleParent",
      "moduleDesign",
      "moduleIndex"
    ]) {
      update[`flags.${MODULE_ID}.-=${key}`] = null;
    }
    for (const id of Object.keys(actor.system?.breakawayBay ?? {})) {
      update[`system.breakawayBay.-=${id}`] = null;
    }
    for (const id of Object.keys(actor.system?.moduleBay ?? {})) {
      update[`system.moduleBay.-=${id}`] = null;
    }
  }
  await actor.update(update, { render: false, diff: false, [SYNC_OPTION]: true });
  return current;
}

/** Point one repeated parent slot at this actor's new design id. Returns false when the parent does not list the id twice. */
async function retargetRepeatedSlot(extra, oldId) {
  const parentId = flag(extra, "breakawayParent");
  const parent = game.actors?.get?.(parentId);
  const parentDesign = storedDesign(parent);
  const occurrences = (parentDesign?.breakawayHulls ?? []).filter((id) => id === oldId).length;
  if (!parent || occurrences < 2) return false;
  const newId = await makeIndependent(extra, { keepLinks: true, force: true });
  if (!newId || !stillPresent(parent)) return false;
  const blueprint = parent.system?.blueprint ?? {};
  const designs = structuredClone(blueprint.designs ?? []);
  const current = designs.find((row) => row?.id === blueprint.currentId) ?? designs[0];
  if (!current) return false;
  let seen = 0;
  let replaced = false;
  current.breakawayHulls = (current.breakawayHulls ?? []).map((id) => {
    if (id !== oldId) return id;
    seen += 1;
    if (seen === 2) {
      replaced = true;
      return newId;
    }
    return id;
  });
  if (!replaced) return false;
  const modules = [...(blueprint.modules ?? [])];
  for (const design of blueprintDesigns(extra)) {
    if (!design?.id || design.id === blueprint.currentId) continue;
    const at = modules.findIndex((row) => row?.id === design.id);
    if (at >= 0) modules[at] = structuredClone(design);
    else modules.push(structuredClone(design));
  }
  await parent.update({
    "system.blueprint.designs": designs,
    "system.blueprint.modules": modules
  }, { render: false, diff: false, [SYNC_OPTION]: true });
  return true;
}

/** Actors that already share a design id each get their own copy. A repeated hull stays attached. A plain duplicate does not. */
export async function separateSharedActors() {
  if (!game.user?.isGM) return;
  const groups = new Map();
  for (const actor of actors()) {
    if (actor?.type !== SHIP_TYPE) continue;
    const id = storedDesign(actor)?.id;
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(actor);
    groups.set(id, list);
  }
  const { syncShip } = await import("./main.mjs");
  const parents = new Set();
  for (const [id, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => modified(a) - modified(b));
    for (const extra of group.slice(1)) {
      if (!stillPresent(extra) || storedDesign(extra)?.id !== id) continue;
      const parentId = flag(extra, "breakawayParent") || flag(extra, "moduleParent");
      const linked = await retargetRepeatedSlot(extra, id);
      if (!linked) {
        const changed = await makeIndependent(extra);
        if (changed) await syncShip(extra);
      }
      if (parentId) parents.add(parentId);
    }
  }
  for (const parentId of parents) {
    const parent = game.actors?.get?.(parentId);
    if (parent) await syncShip(parent);
  }
}
