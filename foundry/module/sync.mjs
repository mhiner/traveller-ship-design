import { MODULE_ID, SYNC_OPTION } from "./constants.mjs";

/** Header fields that belong to the design. Fuel, flags, and cash do not. */
const HEADER_FIELDS = ["dtons", "tl", "type", "configuration", "hullOptions", "isStandardDesign"];

/** Keep current fuel inside the tank. Missing numbers become zero. A missing cap leaves the amount. */
export function clampFuel(value, max) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  const held = Math.max(0, amount);
  const cap = Number(max);
  if (!Number.isFinite(cap)) return held;
  return Math.min(Math.max(0, cap), held);
}

/** True when this update edits the design header or the actor name, so the ship must be reprojected. */
export function touchesHeader(changes) {
  if (!changes || typeof changes !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(changes, "name")) return true;
  const ship = changes.system?.spacecraft;
  if (!ship || typeof ship !== "object") return false;
  return HEADER_FIELDS.some((key) => Object.prototype.hasOwnProperty.call(ship, key));
}

/** The design header currently stored on the actor. A blank type is left blank. */
export function readHeader(actor) {
  const ship = actor.system?.spacecraft ?? {};
  return {
    name: actor.name ?? "",
    dtons: Number(ship.dtons) || 0,
    tl: Number(ship.tl) || 0,
    type: typeof ship.type === "string" ? ship.type : "",
    configuration: ship.configuration ?? "standard",
    hullOptions: ship.hullOptions ?? "",
    isStandardDesign: Boolean(ship.isStandardDesign)
  };
}

/**
 * Write an actor name and redraw the actors directory.
 * The directory ignores a document update made with render false, so a name
 * change has to ask for that redraw or the sidebar keeps the previous name.
 */
export async function writeActorName(actor, name) {
  const next = String(name ?? "").trim();
  if (!next || !actor?.id || actor.name === next) return;
  if (!game.actors?.get?.(actor.id)) return;
  await actor.update({ name: next }, { render: false, diff: true, [SYNC_OPTION]: true });
  game.actors?.render?.(false, {
    renderContext: "updateActor",
    renderData: [{ name: next }]
  });
}

/** True when Foundry rejected the update because the document was already removed. */
function missingId(error) {
  return /does not exist/i.test(String(error?.message ?? error));
}

/** The item still on the actor. A reference from a parallel sync is ignored. */
function liveItem(actor, item) {
  if (!item?.id) return null;
  return actor.items?.get?.(item.id) ?? null;
}

/**
 * Write the projection onto the actor and its items.
 * Fuel on hand is capped at the new tank. Hits keep the damage already taken.
 * keepName leaves the actor name alone, so one copy of a shared design can be renamed.
 */
export async function applyProjection(actor, projection, blueprint, options = {}) {
  const damage = Number(actor.system?.hits?.damage) || 0;
  const hitsMax = projection.hitsMax;
  // diff drops keys that already match, so an unchanged ship does not write.
  const update = {
    "system.blueprint.currentId": blueprint.currentId,
    "system.blueprint.designs": blueprint.designs,
    "system.blueprint.modules": blueprint.modules,
    "system.hits.max": hitsMax,
    "system.hits.value": Math.max(0, hitsMax - damage),
    "system.settings.autoHits": false,
    "system.spacecraft.dtons": projection.dtons,
    "system.spacecraft.tl": projection.tl,
    "system.spacecraft.type": projection.type,
    "system.spacecraft.configuration": projection.configuration,
    "system.spacecraft.hullOptions": projection.hullOptions,
    "system.spacecraft.isStandardDesign": projection.isStandardDesign,
    "system.spacecraft.skill": projection.skill,
    "system.spacecraft.armour": projection.armour,
    "system.spacecraft.jdrive": projection.jdrive,
    "system.spacecraft.mdrive": projection.mdrive,
    "system.spacecraft.cargo": projection.cargo,
    "system.spacecraft.fuel.max": projection.fuelMax,
    "system.spacecraft.fuel.value": clampFuel(
      actor.system?.spacecraft?.fuel?.value,
      projection.fuelMax
    ),
    "system.spacecraft.power.max": projection.powerMax,
    "system.spacecraft.power.used": projection.powerUsed,
    "system.spacecraft.cost": projection.cost,
    "system.spacecraft.baseCost": projection.cost,
    "system.spacecraft.computer.bis": projection.computerBis,
    "system.spacecraft.computer.fib": projection.computerFib,
    "system.spacecraft.computer.processing": projection.processing,
    "system.spacecraft.processing": projection.processing
  };
  // render is false here. The name is written afterwards so the directory can redraw.
  await actor.update(update, { render: false, diff: true, [SYNC_OPTION]: true });
  await reconcilePieces(actor, projection.pieces, projection.tl);
  await reconcileSoftware(actor, projection.software ?? []);
  if (!options.keepName) await writeActorName(actor, projection.name);
  await refreshSheet(actor);
}

/** Repaint an open sheet without moving focus out of the field the user is editing. */
async function refreshSheet(actor) {
  const sheet = actor.sheet;
  const states = sheet?.constructor?.RENDER_STATES;
  if (!sheet?.rendered || sheet._state !== states?.RENDERED) return;
  const root = sheet.element?.[0] ?? sheet.element;
  const active = document.activeElement;
  const restore = root?.contains?.(active) ? active : null;
  await sheet.render(false);
  if (restore?.isConnected) restore.focus({ preventScroll: true });
}

/** Software items whose flag key starts with software:. Extra programs are removed. */
async function reconcileSoftware(actor, programs) {
  const owned = actor.items.filter((item) =>
    String(item.getFlag(MODULE_ID, "key") ?? "").startsWith("software:")
  );
  const byKey = new Map(owned.map((item) => [item.getFlag(MODULE_ID, "key"), item]));
  const wanted = new Set(programs.map((program) => program.key));
  const remove = owned
    .filter((item) => !wanted.has(item.getFlag(MODULE_ID, "key")) && liveItem(actor, item))
    .map((item) => item.id);
  if (remove.length) await deleteItems(actor, remove);
  const computer = actor.items.find((item) => item.getFlag(MODULE_ID, "key") === "computer");
  const installed = [];
  for (const program of programs) {
    const id = await upsertSoftware(actor, program, byKey, computer?.id ?? null);
    if (id) installed.push(id);
  }
  if (!liveItem(actor, computer)) return;
  // The computer item lists the software ids the ship is running.
  try {
    await computer.update({
      "system.computer": {
        processing: Number(computer.system?.hardware?.rating) || 0,
        software: installed
      }
    }, { render: false });
  } catch (error) {
    if (!missingId(error)) throw error;
  }
}

/** Create or update one software item. A new program starts RUNNING and installed on the computer. */
async function upsertSoftware(actor, program, byKey, computerId) {
  let current = liveItem(actor, byKey.get(program.key));
  const software = {
    class: "spacecraft",
    type: "generic",
    interface: program.interface || "none",
    bandwidth: program.bandwidth ?? 0
  };
  if (!current) {
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name: program.name,
      type: "software",
      system: {
        tl: program.tl ?? 0,
        cost: program.cost ?? 0,
        quantity: 1,
        status: "RUNNING",
        software,
        installedOn: computerId
      },
      flags: { [MODULE_ID]: { key: program.key } }
    }], { render: false });
    if (created) byKey.set(program.key, created);
    return created?.id ?? null;
  }
  const update = {
    name: program.name,
    "system.tl": program.tl ?? 0,
    "system.cost": program.cost ?? 0,
    "system.software.class": software.class,
    "system.software.type": software.type,
    "system.software.interface": software.interface,
    "system.software.bandwidth": software.bandwidth,
    "system.installedOn": computerId
  };
  if (!current.system?.status) update["system.status"] = "RUNNING";
  try {
    await current.update(update, { render: false });
  } catch (error) {
    if (!missingId(error)) throw error;
    byKey.delete(program.key);
    return upsertSoftware(actor, program, byKey, computerId);
  }
  return current.id;
}

/**
 * Hardware and weapon items keyed by the projection.
 * Weapons are written first so a mount can store their item ids.
 */
async function reconcilePieces(actor, pieces, tl) {
  const owned = actor.items.filter((item) => {
    const key = item.getFlag(MODULE_ID, "key");
    return key && !String(key).startsWith("software:");
  });
  const byKey = new Map(owned.map((item) => [item.getFlag(MODULE_ID, "key"), item]));
  const wanted = new Set(pieces.map((piece) => piece.key));
  const remove = owned
    .filter((item) => !wanted.has(item.getFlag(MODULE_ID, "key")) && liveItem(actor, item))
    .map((item) => item.id);
  if (remove.length) await deleteItems(actor, remove);
  const ids = new Map();
  for (const piece of pieces) {
    if (piece.type !== "weapon") continue;
    ids.set(piece.key, await upsertPiece(actor, piece, tl, byKey, ids));
  }
  for (const piece of pieces) {
    if (piece.type === "weapon") continue;
    await upsertPiece(actor, piece, tl, byKey, ids);
  }
}

/** Piece field, hardware field, and whether an empty string is stored. */
const HARDWARE_FIELDS = [
  ["powerPerTon", "powerPerTon", "present"],
  ["bridgeType", "bridgeType", "truthy"],
  ["holographicControls", "holographicControls", "present"],
  ["bis", "isComputerBis", "present"],
  ["fib", "isComputerFib", "present"],
  ["advancement", "advancement", "present"],
  ["advantages", "advantages", "present"]
];

/** Copy the optional hardware fields that this piece actually has. */
function copyHardwareFields(hardware, piece) {
  for (const [from, to, when] of HARDWARE_FIELDS) {
    const value = piece[from];
    if (when === "truthy" ? !value : value == null) continue;
    hardware[to] = value;
  }
}

/** The hardware system object for one piece. An inactive fuel container is stored as cargo. */
function hardwareRecord(piece, current) {
  const hardware = {
    system: piece.system,
    rating: piece.rating ?? 0,
    tons: piece.tons ?? 0,
    power: piece.power ?? 0,
    mount: piece.mount ?? "turret"
  };
  copyHardwareFields(hardware, piece);
  if (piece.percent != null || piece.costPerTon != null) {
    hardware.tonnage = {
      percent: piece.percent ?? 0,
      cost: piece.costPerTon ?? 0,
      tons: 0,
      minimum: 0
    };
  }
  // Inactive containers are cargo so the ship sheet adds them to cargo, not fuel.
  if (
    /(^|:)fuel-cargo(:|$)/.test(String(piece.key ?? "")) &&
    current?.system?.status === "INACTIVE"
  ) {
    hardware.system = "cargo";
  }
  return hardware;
}

/** Item ids of the weapons this mount carries. Missing weapons are skipped. */
function attachedWeapons(piece, ids) {
  const weapons = {};
  for (const key of piece.attaches ?? []) {
    const id = ids.get(key);
    if (id) weapons[id] = { quantity: 1 };
  }
  return weapons;
}

/** Flat update for a hardware item. Tonnage percent and cost are written on their own paths. */
function hardwareUpdate(piece, hardware, weapons) {
  const update = {
    name: piece.name,
    "system.tl": piece.tl ?? 0,
    "system.quantity": piece.quantity ?? 1,
    "system.hardware.weapons": weapons
  };
  for (const [key, value] of Object.entries(hardware)) {
    if (key === "tonnage") continue;
    update[`system.hardware.${key}`] = value;
  }
  if (piece.cost != null) update["system.cost"] = piece.cost;
  if (piece.percent != null) update["system.hardware.tonnage.percent"] = piece.percent;
  if (piece.costPerTon != null) update["system.hardware.tonnage.cost"] = piece.costPerTon;
  return update;
}

/** Create or update a weapon item. The flag key is how later syncs find it. */
async function upsertWeapon(actor, piece, itemTl, current, byKey) {
  const weapon = weaponFields(piece);
  if (!liveItem(actor, current)) current = null;
  if (!current) {
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name: piece.name,
      type: "weapon",
      system: {
        tl: itemTl,
        cost: piece.cost ?? 0,
        quantity: 1,
        status: "ACTIVE",
        weapon
      },
      flags: { [MODULE_ID]: { key: piece.key } }
    }], { render: false });
    if (created) byKey.set(piece.key, created);
    return created?.id;
  }
  try {
    await current.update({
      name: piece.name,
      "system.tl": itemTl,
      "system.cost": piece.cost ?? 0,
      "system.quantity": 1,
      ...weaponUpdate(weapon)
    }, { render: false });
  } catch (error) {
    if (!missingId(error)) throw error;
    byKey.delete(piece.key);
    return upsertWeapon(actor, piece, itemTl, null, byKey);
  }
  return current.id;
}

/** Create or update one projected piece. Weapons delegate to the weapon item. */
async function upsertPiece(actor, piece, tl, byKey, ids) {
  let current = liveItem(actor, byKey.get(piece.key));
  const itemTl = piece.tl ?? tl;
  if (piece.type === "weapon") return upsertWeapon(actor, piece, itemTl, current, byKey);
  const hardware = hardwareRecord(piece, current);
  const weapons = attachedWeapons(piece, ids);
  if (!current) {
    const system = {
      tl: itemTl,
      quantity: piece.quantity ?? 1,
      status: "ACTIVE",
      hardware: { ...hardware, weapons }
    };
    if (piece.cost != null) system.cost = piece.cost;
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name: piece.name,
      type: "hardware",
      system,
      flags: { [MODULE_ID]: { key: piece.key } }
    }], { render: false });
    if (created) byKey.set(piece.key, created);
    return created?.id;
  }
  const update = hardwareUpdate({ ...piece, tl: itemTl }, hardware, weapons);
  try {
    await current.update(update, { render: false });
  } catch (error) {
    if (!missingId(error)) throw error;
    byKey.delete(piece.key);
    return upsertPiece(actor, piece, tl, byKey, ids);
  }
  return current.id;
}

/** Remove owned items. A parallel sync may already have deleted one of them. */
async function deleteItems(actor, ids) {
  try {
    await actor.deleteEmbeddedDocuments("Item", ids, { render: false });
  } catch (error) {
    if (!missingId(error)) throw error;
  }
}

/** Spacecraft weapon fields the system sheet reads. Magazine size is also the ammo count. */
function weaponFields(piece) {
  const weapon = {
    scale: "spacecraft",
    mount: piece.mount ?? "turret",
    power: piece.power ?? 0,
    damage: piece.damage ?? "1d6",
    spaceRange: piece.spaceRange ?? "medium",
    characteristic: piece.characteristic ?? "DEX",
    skill: piece.skill ?? "gunner.turret",
    attackBonus: piece.attackBonus ?? 0,
    damageBonus: piece.damageBonus ?? "",
    damageType: piece.damageType ?? "standard",
    traits: piece.traits ?? "",
    parryBonus: piece.parryBonus ?? 0
  };
  if (piece.magazine != null) {
    weapon.magazine = piece.magazine;
    weapon.ammo = piece.magazine;
  }
  if (piece.magazineCost != null) weapon.magazineCost = piece.magazineCost;
  return weapon;
}

/** Flat system.weapon paths for an existing weapon item. */
function weaponUpdate(weapon) {
  const update = {};
  for (const [key, value] of Object.entries(weapon)) {
    update[`system.weapon.${key}`] = value;
  }
  return update;
}
