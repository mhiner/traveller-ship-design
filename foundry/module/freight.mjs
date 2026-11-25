import { MODULE_ID, SYNC_OPTION } from "./constants.mjs";
import { listFreight, techFromUwp } from "../dist/blueprint.js";
import { ensureTradeItem, marketItem } from "./market.mjs";

// Freight and mail window.
const FREIGHT_TEMPLATE = `modules/${MODULE_ID}/templates/freight.html`;
// One open freight window per ship actor id.
const apps = new Map();

/**
 * Shows a Foundry warning toast.
 * The call is skipped when the notifications UI is unavailable.
 */
function warn(message) {
  ui.notifications?.warn(message);
}

/**
 * Shows a Foundry info toast.
 * Delivery uses it for the credits just paid.
 */
function notice(message) {
  ui.notifications?.info(message);
}

/**
 * Deep-cloned freight flag from the trade item that also stores the market.
 */
export function freightRecord(actor) {
  const item = marketItem(actor);
  const stored = item?.getFlag(MODULE_ID, "freight");
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  return foundry.utils.deepClone(stored);
}

/**
 * True when the stored list was rolled for this origin and destination.
 * Both ends are compared by sector and hex.
 */
function sameRoute(record, origin, destination) {
  return Boolean(record)
    && record.originSector === origin.sector
    && record.originHex === origin.hex
    && record.destSector === destination.sector
    && record.destHex === destination.hex;
}

/**
 * Writes the freight flag and re-renders the open freight window.
 * The update uses SYNC_OPTION so ship sync leaves the design alone.
 */
async function storeFreight(actor, record) {
  const item = await ensureTradeItem(actor);
  if (!item) return null;
  await item.update({ [`flags.${MODULE_ID}.freight`]: record }, { [SYNC_OPTION]: true });
  apps.get(actor.id)?.render(false);
  return record;
}

/**
 * Removes the freight flag with Foundry's -=freight key and re-renders the open window.
 * The update uses SYNC_OPTION so ship sync leaves the design alone.
 */
export async function clearFreight(actor) {
  const item = marketItem(actor);
  if (!item?.getFlag(MODULE_ID, "freight")) return;
  await item.update({ [`flags.${MODULE_ID}.-=freight`]: null }, { [SYNC_OPTION]: true });
  apps.get(actor.id)?.render(false);
}

/**
 * Active Traveller Astrogation API.
 * Freight needs both worldProfile and systemsWithin.
 */
function astrogationApi() {
  const mod = game.modules?.get("traveller-astrogation");
  if (!mod?.active || typeof mod.api?.worldProfile !== "function") return null;
  if (typeof mod.api?.systemsWithin !== "function") return null;
  return mod.api;
}

/**
 * Dice adapter passed to the freight library.
 * Faces come from Foundry's Die when that class is present.
 */
function foundryDice() {
  const Die = foundry?.dice?.terms?.Die;
  return {
    /**
     * Rolls one face from 1 through faces, and a count below 1 is rolled as 1.
     * Uses a finite face from Foundry's Die, then Foundry's uniform generator for the same range.
     */
    die(faces) {
      const sides = Math.max(1, Math.trunc(Number(faces) || 1));
      if (Die) {
        const face = new Die({ faces: sides }).randomFace();
        if (Number.isFinite(face) && face >= 1) return face;
      }
      const uniform = CONFIG?.Dice?.randomUniform?.() ?? Math.random();
      // Face in 1..sides from Foundry's uniform generator.
      return 1 + Math.floor(uniform * sides);
    }
  };
}

/**
 * Normalizes a current-system or target-system flag into sector, hex, and world coordinates.
 * A blank sector or hex yields null, and worldX and worldY are kept when they are finite numbers.
 */
function place(value) {
  if (!value || typeof value !== "object") return null;
  const sector = String(value.sector ?? "").trim();
  const hex = String(value.hex ?? "").trim();
  if (!sector || !hex) return null;
  const worldX = Number(value.worldX);
  const worldY = Number(value.worldY);
  return {
    name: String(value.name ?? ""),
    sector,
    hex,
    worldX: Number.isFinite(worldX) ? worldX : null,
    worldY: Number.isFinite(worldY) ? worldY : null
  };
}

/**
 * World record used to roll freight, including the UWP tech digit.
 * A null population or an unreadable tech level yields a warning and an empty world.
 */
async function freightWorld(api, stored) {
  let profile = null;
  try {
    profile = await api.worldProfile(stored.sector, stored.hex);
  } catch (error) {
    console.error(`${MODULE_ID} could not read a freight world`, error);
    return { world: null, warning: "A freight world could not be read." };
  }
  if (!profile || profile.population === null) {
    return { world: null, warning: "A freight world has no usable population." };
  }
  const tech = techFromUwp(String(profile.uwp ?? ""));
  // Traffic DMs need the UWP tech digit.
  if (tech === null) {
    return { world: null, warning: "A freight world has no tech level." };
  }
  // Amber and Red are the zone names the traffic DM table matches.
  const zone = profile.zone === "amber" ? "Amber" : profile.zone === "red" ? "Red" : "";
  return {
    world: {
      name: profile.name || stored.name || `${stored.sector} ${stored.hex}`,
      sector: profile.sector || stored.sector,
      hex: profile.hex || stored.hex,
      population: profile.population,
      port: profile.port || "X",
      tech,
      zone
    },
    warning: ""
  };
}

/**
 * True when the ship carries a weapon item.
 * listFreight uses that as the armed modifier on the mail roll.
 */
function shipArmed(actor) {
  return [...(actor.items ?? [])].some((item) => item.type === "weapon");
}

/**
 * Highest SOC DM among crewed actors, for the mail roll.
 * Uses a finite stored dm or the Mongoose table from the raw score, and an empty crew yields 0.
 */
function bestSocDm(actor) {
  const crew = actor.system?.crewed?.crew ?? {};
  let best = null;
  for (const id of Object.keys(crew)) {
    const member = game.actors?.get(id);
    // Sheets store the characteristic as SOC or soc.
    const score = member?.system?.characteristics?.SOC
      ?? member?.system?.characteristics?.soc;
    if (!score) continue;
    const dm = Number(score.dm);
    // A finite dm is the modifier. The raw score supplies the DM through the Mongoose table.
    const value = Number.isFinite(dm) ? dm : characteristicDm(Number(score.value));
    if (best === null || value > best) best = value;
  }
  return best ?? 0;
}

/**
 * Mongoose characteristic DM for a raw score.
 * Cuts fall at 0, 2, 5, 8, 11, and 14.
 */
function characteristicDm(score) {
  if (!Number.isFinite(score)) return 0;
  if (score <= 0) return -3;
  if (score <= 2) return -2;
  if (score <= 5) return -1;
  if (score <= 8) return 0;
  if (score <= 11) return 1;
  if (score <= 14) return 2;
  return 3;
}

/**
 * An empty route, stored when the route is cleared.
 * Cargo already under contract stays aboard.
 */
function blankFreight() {
  return {
    originSector: "",
    originHex: "",
    originName: "",
    destSector: "",
    destHex: "",
    destName: "",
    parsecs: 0,
    trafficDm: 0,
    lots: []
  };
}

/**
 * Keep the stored list while the current system and target stay the same.
 * A new pair replaces it. Contracted cargo is left aboard.
 */
export async function syncFreight(actor) {
  const current = place(actor.getFlag(MODULE_ID, "currentSystem"));
  const target = place(actor.getFlag(MODULE_ID, "targetSystem"));
  const stored = freightRecord(actor);
  if (!current || !target) {
    // A stored route is cleared when either end of the pair is missing.
    if (stored?.originSector) await storeFreight(actor, blankFreight());
    return { record: blankFreight(), warning: !current
      ? "Set the current system before looking for freight."
      : "Set a target system before looking for freight." };
  }
  if (sameRoute(stored, current, target)) return { record: stored, warning: "" };

  const api = astrogationApi();
  if (!api) {
    return { record: stored ?? blankFreight(), warning: "Traveller Astrogation is not active." };
  }
  // The ship's jump rating, in parsecs, is the radius passed to systemsWithin.
  const jump = Number(actor.system?.spacecraft?.jdrive) || 0;
  let within = [];
  try {
    within = await api.systemsWithin(current, jump);
  } catch (error) {
    console.error(`${MODULE_ID} could not read jump distance`, error);
    return { record: stored ?? blankFreight(), warning: "The target distance could not be read." };
  }
  const match = (Array.isArray(within) ? within : []).find((row) =>
    row?.sector === target.sector && row?.hex === target.hex
  );
  const parsecs = Number(match?.parsecs) || 0;
  // Mongoose freight is offered for a destination 1 to 6 parsecs away.
  if (!match || parsecs < 1 || parsecs > 6) {
    if (sameRoute(stored, current, target)) await storeFreight(actor, blankFreight());
    return {
      record: blankFreight(),
      warning: parsecs > 6
        ? "There is no freight beyond 6 parsecs."
        : "The target is outside this ship's jump."
    };
  }

  const origin = await freightWorld(api, current);
  if (!origin.world) {
    if (sameRoute(stored, current, target)) await storeFreight(actor, blankFreight());
    return { record: blankFreight(), warning: origin.warning };
  }
  const destination = await freightWorld(api, target);
  if (!destination.world) {
    if (sameRoute(stored, current, target)) await storeFreight(actor, blankFreight());
    return { record: blankFreight(), warning: destination.warning };
  }

  let next = 0;
  // Freight lots and mail. Rank is 0. Armed status and the best SOC DM come from the ship.
  const rolled = listFreight(
    origin.world,
    destination.world,
    parsecs,
    { armed: shipArmed(actor), rank: 0, socDm: bestSocDm(actor) },
    foundryDice(),
    () => {
      next += 1;
      return `freight-${next}`;
    }
  );
  const record = rolled ?? blankFreight();
  await storeFreight(actor, record);
  return { record, warning: "" };
}

/**
 * Empty cargo space, in tons.
 * spacecraft.cargo is the hold, and each cargo item's quantity is tons already filled.
 */
function freeTons(actor) {
  let free = Number(actor.system?.spacecraft?.cargo) || 0;
  for (const item of actor.items ?? []) {
    if (item.type !== "cargo") continue;
    free -= Number(item.system?.quantity) || 0;
  }
  return free;
}

/**
 * The freightContract flag stored on a cargo item.
 * getFlag is read first, then the raw flags object.
 */
function contractOf(item) {
  return item?.getFlag?.(MODULE_ID, "freightContract")
    ?? item?.flags?.[MODULE_ID]?.freightContract
    ?? null;
}

/**
 * True when the item is contracted freight or mail.
 * Either the freightContract flag or cargo.freight marks it.
 */
export function isFreightCargo(item) {
  return Boolean(contractOf(item)) || Boolean(item?.system?.cargo?.freight);
}

/**
 * Takes one freight or mail lot into the hold and removes it from the available list.
 * The lot is taken whole, its cost is 0 because payment happens on delivery, and the write uses SYNC_OPTION so ship sync leaves the design alone.
 */
export async function takeFreight(actor, lotId) {
  const record = freightRecord(actor);
  const lot = record?.lots?.find((row) => row.id === lotId);
  if (!record || !lot) {
    warn("That lot is no longer available.");
    return;
  }
  const tons = Number(lot.tons) || 0;
  if (!(tons > 0)) return;
  // 1e-9 tons of slack covers rounding in the free-space total.
  if (tons > freeTons(actor) + 1e-9) {
    warn("The hold has no room for this lot.");
    return;
  }
  // sector|hex, the key deliverFreight matches on arrival.
  const destination = `${record.destSector}|${record.destHex}`;
  await actor.createEmbeddedDocuments("Item", [{
    name: lot.name,
    img: "icons/svg/item-bag.svg",
    type: "cargo",
    system: {
      quantity: tons,
      cost: 0,
      cargo: {
        price: lot.pricePerTon,
        tons,
        freight: true,
        destinationName: record.destName,
        destinationId: destination
      }
    },
    flags: {
      [MODULE_ID]: {
        freightContract: {
          lot,
          origin: `${record.originSector}|${record.originHex}`,
          destination,
          destinationName: record.destName,
          pricePerTon: lot.pricePerTon
        }
      }
    }
  }], { [SYNC_OPTION]: true });
  record.lots = record.lots.filter((row) => row.id !== lotId);
  await storeFreight(actor, record);
}

/**
 * Returns a contracted lot to the available list and deletes the cargo item.
 * The open list must match the contract's origin and destination, and the write uses SYNC_OPTION so ship sync leaves the design alone.
 */
export async function releaseFreight(actor, item) {
  const contract = contractOf(item);
  if (!contract || item?.parent?.id !== actor.id) return;
  const record = freightRecord(actor);
  const origin = `${record?.originSector}|${record?.originHex}`;
  const destination = `${record?.destSector}|${record?.destHex}`;
  // The lot returns when this list matches the contract origin and destination.
  if (!record || contract.origin !== origin || contract.destination !== destination) {
    warn(`This cargo is bound for ${contract.destinationName || "another world"}.`);
    return;
  }
  const lot = contract.lot;
  record.lots = record.lots ?? [];
  // The original lot object is pushed when its id is new to the list.
  if (lot?.id && !record.lots.some((row) => row.id === lot.id)) record.lots.push(lot);
  await storeFreight(actor, record);
  await actor.deleteEmbeddedDocuments("Item", [item.id], { [SYNC_OPTION]: true });
}

/**
 * Pays freight and mail contracted to this place, then deletes that cargo.
 * Cash is credited to the hundredth of a credit, and the writes use SYNC_OPTION so ship sync leaves the design alone.
 */
export async function deliverFreight(actor, place) {
  // Contracts are keyed sector|hex, the same key stored when the lot was taken.
  const destination = `${place.sector}|${place.hex}`;
  const ids = [];
  let pay = 0;
  let tons = 0;
  for (const item of actor.items ?? []) {
    if (item.type !== "cargo") continue;
    const contract = contractOf(item);
    if (!contract || contract.destination !== destination) continue;
    const quantity = Number(item.system?.quantity) || 0;
    const price = Number(contract.pricePerTon) || 0;
    pay += price * quantity;
    tons += quantity;
    ids.push(item.id);
  }
  // An empty id list ends the delivery.
  if (!ids.length) return;
  const cash = Number(actor.system?.finance?.cash);
  const held = Number.isFinite(cash) ? cash : 0;
  // Credits kept to the hundredth. The toast rounds to whole credits.
  await actor.update({
    "system.finance.cash": Math.round((held + pay) * 100) / 100
  }, { [SYNC_OPTION]: true });
  await actor.deleteEmbeddedDocuments("Item", ids, { [SYNC_OPTION]: true });
  notice(`Delivered ${tons} tons for Cr${Math.round(pay)}.`);
}

/**
 * Window of freight and mail lots for the current route.
 * Lots drag onto the ship sheet, and a freight item dropped here returns to the list.
 */
class FreightApp extends Application {
  /**
   * Binds the window to one ship. The application id is unique per actor.
   */
  constructor(actor) {
    super({ id: `blueprint-freight-${actor.id}` });
    this.actor = actor;
  }

  /**
   * Foundry application options for the freight window.
   * openFreight replaces the title with the destination name.
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: FREIGHT_TEMPLATE,
      width: 560,
      height: "auto",
      resizable: true,
      title: "Freight and Mail"
    });
  }

  /**
   * Sheet data for the stored lots.
   * fee is the whole-lot payment, price per ton times tons.
   */
  getData() {
    const record = freightRecord(this.actor);
    const lots = (record?.lots ?? []).map((lot) => ({
      ...lot,
      fee: (Number(lot.pricePerTon) || 0) * (Number(lot.tons) || 0)
    }));
    const origin = record?.originName || "Current system";
    const destination = record?.destName || "Target system";
    return {
      origin,
      destination,
      parsecs: record?.parsecs || 0,
      lots,
      empty: lots.length === 0
    };
  }

  /**
   * Each lot row drags as application/x-traveler-blueprint-market for the ship sheet.
   * A dropped freight item is released back onto this list.
   */
  activateListeners(html) {
    super.activateListeners(html);
    const root = html?.[0] ?? html;
    root?.querySelectorAll(".market-lot").forEach((row) => {
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", (event) => {
        const payload = JSON.stringify({
          type: `${MODULE_ID}.freight`,
          actorId: this.actor.id,
          lotId: row.dataset.lotId
        });
        event.dataTransfer?.setData("application/x-traveler-blueprint-market", payload);
        event.dataTransfer?.setData("text/plain", payload);
      });
    });
    root?.addEventListener("dragenter", (event) => event.preventDefault());
    root?.addEventListener("dragover", (event) => event.preventDefault());
    root?.addEventListener("drop", (event) => {
      event.preventDefault();
      void this.#onDrop(event);
    });
  }

  /**
   * Releases a dropped freight item back onto this list.
   * The drop must be an Item uuid that is freight cargo.
   */
  async #onDrop(event) {
    let data = null;
    try {
      data = JSON.parse(event.dataTransfer?.getData("text/plain") || "");
    } catch {
      data = null;
    }
    if (data?.type !== "Item" || !data.uuid) return;
    const item = await fromUuid(data.uuid);
    if (!isFreightCargo(item)) return;
    await releaseFreight(this.actor, item);
  }
}

/**
 * Syncs freight for the current route, shows any warning, and opens the window.
 * The title includes the destination name when the record has one, and the window already open for this ship is reused.
 */
export async function openFreight(actor) {
  const { record, warning } = await syncFreight(actor);
  if (warning) warn(warning);
  let app = apps.get(actor.id);
  if (!app) {
    app = new FreightApp(actor);
    apps.set(actor.id, app);
  }
  const destination = record?.destName ? ` — ${record.destName}` : "";
  app.options.title = `Freight and Mail${destination}`;
  app.render(true);
}
