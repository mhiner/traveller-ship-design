import { MODULE_ID, SYNC_OPTION } from "./constants.mjs";
import { appendCarriedLots, listMarket, placeKey } from "../dist/blueprint.js";

// Speculative-goods window.
const MARKET_TEMPLATE = `modules/${MODULE_ID}/templates/market.html`;
// Tonnage prompt for a buy or a sale.
const TONS_TEMPLATE = `modules/${MODULE_ID}/templates/market-tons.html`;
// One open market window per ship actor id.
const apps = new Map();

/**
 * Shows a Foundry warning toast.
 * The call is skipped when the notifications UI is unavailable.
 */
function warn(message) {
  ui.notifications?.warn(message);
}

/**
 * The item that stores this ship's speculative-goods window.
 * The first embedded item with a market flag is that store.
 */
export function marketItem(actor) {
  return actor?.items?.find?.((item) => item.getFlag(MODULE_ID, "market")) ?? null;
}

/**
 * Deep clone of the market flag on the trade item.
 * Callers edit this clone and store it back, and the flag must be a plain object.
 */
export function marketRecord(actor) {
  const item = marketItem(actor);
  const stored = item?.getFlag(MODULE_ID, "market");
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  return foundry.utils.deepClone(stored);
}

/**
 * True when this document is the item that stores the market.
 * The flag is read from raw flags or getFlag, so sheet data and live documents both match.
 */
export function isMarketDocument(item) {
  const flag = item?.flags?.[MODULE_ID]?.market ?? item?.getFlag?.(MODULE_ID, "market");
  return Boolean(flag);
}

/**
 * Dice adapter passed to the trade library.
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
 * Highest skill total among the ship's crew for one skill.
 * The total is the skill level plus that skill's characteristic DM and bonus, and an unreadable crew leaves the untrained value of -3.
 */
function bestSkill(actor, skillId) {
  const crew = actor.system?.crewed?.crew ?? {};
  // Sorted ids keep a tied score on the same crew member.
  const ids = Object.keys(crew).sort();
  // Untrained value until a crew score replaces it.
  let best = -3;
  let found = false;
  for (const id of ids) {
    const member = game.actors?.get(id);
    // A world actor with getSkillValue supplies the score.
    if (!member || typeof member.getSkillValue !== "function") continue;
    const options = {};
    const skill = Number(member.getSkillValue(skillId, options));
    if (!Number.isFinite(skill)) continue;
    // getSkillValue writes the governing characteristic onto options.results.cha.
    const characteristic = options.results?.cha;
    const score = member.system?.characteristics?.[characteristic];
    const dm = Number(score?.dm) || 0;
    const bonus = Number(score?.bonus) || 0;
    const value = skill + dm + bonus;
    if (!found || value > best) {
      best = value;
      found = true;
    }
  }
  return found ? best : -3;
}

/**
 * Active Traveller Astrogation API.
 * A market roll needs worldProfile.
 */
function astrogationApi() {
  const mod = game.modules?.get("traveller-astrogation");
  if (!mod?.active || typeof mod.api?.worldProfile !== "function") return null;
  return mod.api;
}

/**
 * Trade goods used to roll a market.
 * The world folder named Trade Goods supplies them when it contains items, and the mgt2e base-items pack supplies them when that folder is empty.
 */
async function catalogue() {
  const world = game.items?.folders?.getName("Trade Goods")?.contents ?? [];
  if (world.length) return goodsFrom(world);
  const pack = game.packs?.get("mgt2e.base-items");
  if (!pack) return [];
  // Folder membership is available once the pack index is loaded.
  if (pack.getIndex) await pack.getIndex();
  const folder = pack.folders?.getName("Trade Goods");
  if (!folder) return [];
  const indexed = folder.contents?.length
    ? folder.contents
    : [...(pack.index ?? [])].filter((entry) => entry.folder === folder.id);
  return goodsFrom(indexed);
}

/**
 * Catalogue rows the trade library can price.
 * An index entry is loaded by uuid before its tons and price are read.
 */
async function goodsFrom(entries) {
  const goods = [];
  for (let item of entries) {
    // A compendium index entry is loaded by uuid so its cargo system can be read.
    if (!item?.system?.cargo) item = await fromUuid(item.uuid);
    const cargo = item?.system?.cargo;
    // A cargo system is required for the row.
    if (!cargo) continue;
    goods.push({
      name: item.name,
      img: item.img || "icons/svg/item-bag.svg",
      tons: String(cargo.tons ?? "0"),
      price: Number(cargo.price) || 0,
      availability: String(cargo.availability ?? ""),
      purchaseDM: String(cargo.purchaseDM ?? ""),
      saleDM: String(cargo.saleDM ?? ""),
      illegal: Boolean(cargo.illegal)
    });
  }
  return goods;
}

/**
 * Maps an astrogation profile into the world object the market roll prices.
 * Amber and Red zones keep those labels, and a blank port is recorded as X.
 */
function worldFromProfile(profile) {
  const zone = profile.zone === "amber" ? "Amber" : profile.zone === "red" ? "Red" : "";
  return {
    name: profile.name || `${profile.sector} ${profile.hex}`,
    sector: profile.sector,
    hex: profile.hex,
    population: profile.population,
    port: profile.port || "X",
    codes: (profile.tradeCodes ?? []).join(", "),
    zone
  };
}

/**
 * Returns the ship's market item, creating it when the actor has none yet.
 * The new item is a quantity-1 item named Market with an empty window, and the create uses SYNC_OPTION so ship sync leaves the design alone.
 */
export async function ensureTradeItem(actor) {
  const existing = marketItem(actor);
  if (existing) return existing;
  const [created] = await actor.createEmbeddedDocuments("Item", [{
    name: "Market",
    img: "icons/svg/item-bag.svg",
    type: "item",
    system: { quantity: 1 },
    flags: { [MODULE_ID]: { market: { sector: "", hex: "", name: "", lots: [] } } }
  }], { [SYNC_OPTION]: true });
  return created ?? marketItem(actor);
}

/**
 * Writes the market flag on the trade item.
 * The update uses SYNC_OPTION so ship sync leaves the design alone, and callers refresh the open window.
 */
async function storeRecord(actor, record) {
  const item = await ensureTradeItem(actor);
  if (!item) return null;
  await item.update({ [`flags.${MODULE_ID}.market`]: record }, { [SYNC_OPTION]: true });
  return record;
}

/**
 * Resets the stored window to an empty world and an empty lot list, then re-renders the open window.
 * The update uses SYNC_OPTION so ship sync leaves the design alone.
 */
export async function clearMarket(actor) {
  const item = marketItem(actor);
  if (!item) return;
  await item.update({
    [`flags.${MODULE_ID}.market`]: { sector: "", hex: "", name: "", lots: [] }
  }, { [SYNC_OPTION]: true });
  apps.get(actor.id)?.render(false);
}

/**
 * The speculative window for this ship, rolled for the current system when the stored world is empty.
 * A stored sector and hex is kept and carried cargo is priced onto it, and a null population ends the roll.
 */
export async function ensureMarket(actor) {
  const current = actor.getFlag(MODULE_ID, "currentSystem");
  const stored = marketRecord(actor);
  // A stored sector and hex is reused. The flag is rewritten when carried cargo adds lots.
  if (stored?.sector && stored?.hex) {
    const updated = await withCarriedLots(actor, stored);
    // The same object means the lot list was left unchanged.
    if (updated === stored) return stored;
    return storeRecord(actor, updated);
  }
  // The window is rolled for the ship's current system flag.
  if (!current?.sector || !current?.hex) {
    warn("Set the current system before opening the market.");
    return null;
  }
  const api = astrogationApi();
  if (!api) {
    warn("Traveller Astrogation is not active.");
    return null;
  }
  let profile = null;
  try {
    profile = await api.worldProfile(current.sector, current.hex);
  } catch (error) {
    console.error(`${MODULE_ID} could not read the world profile`, error);
    warn("The current system could not be read.");
    return null;
  }
  // A null population ends the roll.
  if (!profile || profile.population === null) {
    warn("This system has no usable population, so it has no market.");
    return null;
  }
  const goods = await catalogue();
  if (!goods.length) {
    warn("Unable to find the Trade Goods folder.");
    return null;
  }
  // Lot ids for this roll are market-1, market-2, and so on.
  let next = 0;
  // Broker prices legal goods. Streetwise prices illegal goods.
  const record = listMarket(
    goods,
    worldFromProfile(profile),
    bestSkill(actor, "broker"),
    bestSkill(actor, "streetwise"),
    foundryDice(),
    () => {
      next += 1;
      return `market-${next}`;
    }
  );
  return storeRecord(actor, await withCarriedLots(actor, record));
}

/**
 * Speculative cargo in the hold, one row per item name.
 * Freight stays out of this list, and the sale price comes from the cargo or from the per-ton price saved at purchase.
 */
function carriedGoods(actor) {
  const rows = [];
  // The first stack of a name supplies the row.
  const seen = new Set();
  for (const item of actor.items ?? []) {
    if (item.type !== "cargo") continue;
    const cargo = item.system?.cargo ?? {};
    // Freight is paid at its destination, so it stays off the speculative list.
    if (cargo.freight || cargo.destinationName || cargo.destinationId) continue;
    const name = String(item.name ?? "").trim();
    if (!name || seen.has(name)) continue;
    // Per-ton sale price from the cargo field, then from the flag written at purchase.
    const salePrice = Number(cargo.salePrice)
      || Number(item.getFlag?.(MODULE_ID, "bought")?.salePerTon)
      || 0;
    seen.add(name);
    rows.push({
      name,
      img: item.img || "icons/svg/item-bag.svg",
      price: Number(cargo.price) || 0,
      purchaseDM: String(cargo.purchaseDM ?? ""),
      saleDM: String(cargo.saleDM ?? ""),
      illegal: Boolean(cargo.illegal),
      salePrice,
      speculative: Boolean(cargo.speculative)
    });
  }
  return rows;
}

/**
 * Loads the world used to price carried cargo against the stored window.
 * A null population is passed on as 0 so the sale percent can still be rolled.
 */
async function pricingWorld(record) {
  const api = astrogationApi();
  if (!api || !record?.sector || !record?.hex) return null;
  try {
    const profile = await api.worldProfile(record.sector, record.hex);
    if (!profile) return null;
    const world = worldFromProfile(profile);
    // The price chart needs a population digit. A null population is priced as 0.
    if (profile.population === null) world.population = 0;
    return world;
  } catch (error) {
    console.error(`${MODULE_ID} could not price cargo for the market`, error);
    return null;
  }
}

/**
 * Adds a sale row for each carried good whose name is missing from the stored lots.
 * New ids continue the market-N sequence past the highest id on the list.
 */
async function withCarriedLots(actor, record) {
  const carried = carriedGoods(actor);
  if (!record?.lots || !carried.length) return record;
  // Every carried name already has a lot, so the stored object can be reused.
  if (carried.every((row) => record.lots.some((lot) => lot.name === row.name))) return record;
  const world = await pricingWorld(record);
  const goods = await catalogue();
  // Continue market-N past the highest id already stored.
  let next = 0;
  for (const lot of record.lots) {
    const match = /^market-(\d+)$/.exec(String(lot.id ?? ""));
    if (match) next = Math.max(next, Number(match[1]));
  }
  return appendCarriedLots(
    record,
    carried,
    goods,
    world,
    bestSkill(actor, "broker"),
    bestSkill(actor, "streetwise"),
    foundryDice(),
    () => {
      next += 1;
      return `market-${next}`;
    }
  );
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
 * Credits on the ship's finance block.
 * A missing finance block yields null so the caller can warn, and an unusable cash value yields 0.
 */
function cashOf(actor) {
  const finance = actor.system?.finance;
  if (!finance || typeof finance !== "object") return null;
  const cash = Number(finance.cash);
  return Number.isFinite(cash) ? cash : 0;
}

/**
 * Sector|hex key of the world where this cargo was bought.
 * The bought flag supplies it, then cargo.sourceId.
 */
function boughtSource(item) {
  const flagged = item?.getFlag?.(MODULE_ID, "bought")?.source
    ?? item?.flags?.[MODULE_ID]?.bought?.source;
  if (flagged) return String(flagged);
  return String(item?.system?.cargo?.sourceId ?? "");
}

/**
 * Whole tons, rounded down.
 * Unusable input yields 0.
 */
function wholeTons(value) {
  const tons = Math.floor(Number(value));
  return Number.isFinite(tons) ? tons : 0;
}

/**
 * Whole tons clamped to the range 1 through max.
 * A blank entry is treated as 1 ton before the max is applied.
 */
function clampTons(value, max) {
  return Math.min(max, Math.max(1, wholeTons(value) || 1));
}

/**
 * How many tons of one lot the ship can buy right now.
 * The cap is the least of listed tons, tons the cash can cover, and free hold space, and a blocked purchase warns and returns null.
 */
function buyOffer(actor, lotId) {
  const record = marketRecord(actor);
  const lot = record?.lots?.find((row) => row.id === lotId);
  if (!record || !lot) return null;
  if (!(lot.tons > 0)) {
    warn(`${lot.name} is not available.`);
    return null;
  }
  const cash = cashOf(actor);
  if (cash === null) {
    warn("Ship has no financial information.");
    return null;
  }
  const price = Number(lot.purchasePerTon) || 0;
  const stock = wholeTons(lot.tons);
  // Tons the cash can cover. A zero price leaves that cap equal to the stock.
  const byCash = price > 0 ? Math.floor(cash / price) : stock;
  // Free space below zero is treated as an empty hold.
  const bySpace = Math.max(0, wholeTons(freeTons(actor)));
  const max = Math.min(stock, byCash, bySpace);
  if (!(max > 0)) {
    // Under one ton of free space is reported as a full hold.
    warn(bySpace < 1 ? "The hold has no space." : "The ship cannot afford this cargo.");
    return null;
  }
  return { lot, price, stock, byCash, bySpace, max };
}

/**
 * Sale terms for a cargo item owned by this ship.
 * Freight stays for delivery on jump, and cargo bought in this sector and hex is refused.
 */
function sellOffer(actor, item) {
  const record = marketRecord(actor);
  if (!record?.lots) {
    warn("Open the market before selling.");
    return null;
  }
  if (item?.type !== "cargo" || item.parent?.id !== actor.id) return null;
  // Freight is paid on arrival, so this window leaves it aboard.
  if (item.system?.cargo?.freight || item.getFlag?.(MODULE_ID, "freightContract")) {
    warn("Deliver freight by jumping to its destination.");
    return null;
  }
  const source = boughtSource(item);
  // Same-world resale is refused when the purchase key matches this market. The key is sector|hex.
  if (source && source === placeKey(record.sector, record.hex)) {
    warn("You can't sell back at the same world.");
    return null;
  }
  const stock = wholeTons(item.system?.quantity);
  if (stock < 1) return null;
  // The open list prices a good by its item name.
  const lot = record.lots.find((row) => row.name === item.name);
  if (!lot) {
    warn(`This market has no price for ${item.name}.`);
    return null;
  }
  if (cashOf(actor) === null) {
    warn("Ship has no financial information.");
    return null;
  }
  return { item, lot, price: Number(lot.salePerTon) || 0, stock, max: stock };
}

/**
 * Opens the tonnage prompt and resolves with the chosen whole tons.
 * Dismissing the dialog resolves null.
 */
function askTons({ title, name, price, max, detail, verb, priceLabel }) {
  return new Promise((resolve) => {
    const id = foundry.utils.randomID?.() ?? String(Date.now());
    new TonsDialog({
      id: `blueprint-tons-${id}`,
      title,
      name,
      price,
      max,
      detail,
      verb,
      priceLabel,
      resolve
    }).render(true);
  });
}

/**
 * Prompt for how many tons to buy or sell.
 * The first call to finish resolves the promise.
 */
class TonsDialog extends Application {
  /**
   * Stores the prompt and leaves the promise unsettled until finish runs.
   */
  constructor(spec) {
    super({ id: spec.id, title: spec.title });
    this.spec = spec;
    this.settled = false;
  }

  /**
   * Foundry application options for the tonnage prompt.
   * The height follows the form.
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: TONS_TEMPLATE,
      width: 380,
      height: "auto"
    });
  }

  /**
   * Template data for the prompt, including the credit total at the maximum tons.
   */
  getData() {
    return {
      name: this.spec.name,
      price: this.spec.price,
      max: this.spec.max,
      detail: this.spec.detail,
      verb: this.spec.verb,
      priceLabel: this.spec.priceLabel,
      total: this.spec.price * this.spec.max
    };
  }

  /**
   * Wires the tonnage field, the live credit total, and the form submit.
   * Submitted tons are clamped into the range 1 through the offer maximum.
   */
  activateListeners(html) {
    super.activateListeners(html);
    const root = html?.[0] ?? html;
    const input = root?.querySelector(".market-tons-input");
    const sum = root?.querySelector(".market-tons-sum");
    const show = () => {
      if (!input || !sum) return;
      const tons = clampTons(input.value, this.spec.max);
      sum.textContent = String(this.spec.price * tons);
    };
    input?.addEventListener("input", show);
    root?.addEventListener("submit", (event) => {
      event.preventDefault();
      const tons = clampTons(input?.value, this.spec.max);
      this.finish(tons);
      void this.close();
    });
  }

  /**
   * Resolves the tonnage promise once.
   */
  finish(value) {
    // A later close after submit leaves the chosen tons in place.
    if (this.settled) return;
    this.settled = true;
    this.spec.resolve(value);
  }

  /**
   * Resolves the prompt with null, then closes the application.
   */
  async close(options) {
    this.finish(null);
    return super.close(options);
  }
}

/**
 * Buys the chosen tons as speculative cargo, records this world on the cargo, and shrinks the listed lot.
 * Cash is charged to the hundredth of a credit, and the writes use SYNC_OPTION so ship sync leaves the design alone.
 */
export async function buyMarketLot(actor, lotId) {
  const offer = buyOffer(actor, lotId);
  if (!offer) return;
  const chosen = await askTons({
    title: `Buy ${offer.lot.name}`,
    name: offer.lot.name,
    price: offer.price,
    max: offer.max,
    detail: `The market has ${offer.stock} t, cash covers ${offer.byCash} t, and the hold has ${offer.bySpace} t free.`,
    verb: "Buy",
    priceLabel: "Purchase price"
  });
  if (!chosen) return;
  // Stock, cash, and free tons are read again after the prompt.
  const current = buyOffer(actor, lotId);
  if (!current) return;
  const taken = Math.min(chosen, current.max);
  const record = marketRecord(actor);
  const lot = record?.lots?.find((row) => row.id === lotId);
  const cash = cashOf(actor);
  if (!record || !lot || cash === null) return;
  await actor.createEmbeddedDocuments("Item", [{
    name: lot.name,
    img: lot.img || "icons/svg/item-bag.svg",
    type: "cargo",
    system: {
      quantity: taken,
      cost: current.price,
      cargo: {
        price: lot.basePrice,
        tons: taken,
        illegal: Boolean(lot.illegal),
        speculative: true,
        salePrice: lot.salePerTon,
        sourceId: placeKey(record.sector, record.hex),
        sourceName: record.name
      }
    },
    flags: {
      [MODULE_ID]: {
        bought: {
          source: placeKey(record.sector, record.hex),
          salePerTon: lot.salePerTon
        }
      }
    }
  }], { [SYNC_OPTION]: true });
  // Charge credits to the hundredth, then shrink the listed tons and refresh the window.
  await actor.update({
    "system.finance.cash": Math.round((cash - current.price * taken) * 100) / 100
  }, { [SYNC_OPTION]: true });
  lot.tons -= taken;
  await storeRecord(actor, record);
  apps.get(actor.id)?.render(false);
}

/**
 * Sells the chosen tons of a held cargo item and adds those tons back onto the matching lot.
 * Cash is credited to the hundredth of a credit, and the writes use SYNC_OPTION so ship sync leaves the design alone.
 */
export async function sellCargo(actor, item) {
  const stored = marketRecord(actor);
  // Price carried goods onto a stored world before the sale offer is built.
  if (stored?.sector && stored?.hex) {
    const updated = await withCarriedLots(actor, stored);
    if (updated !== stored) {
      await storeRecord(actor, updated);
      apps.get(actor.id)?.render(false);
    }
  }
  const offer = sellOffer(actor, item);
  if (!offer) return;
  const chosen = await askTons({
    title: `Sell ${offer.item.name}`,
    name: offer.item.name,
    price: offer.price,
    max: offer.max,
    detail: `This cargo is ${offer.stock} t.`,
    verb: "Sell",
    priceLabel: "Sale price"
  });
  if (!chosen) return;
  // The offer is read again after the prompt.
  const current = sellOffer(actor, item);
  if (!current) return;
  const quantity = Math.min(chosen, current.max);
  const record = marketRecord(actor);
  const lot = record?.lots?.find((row) => row.name === item.name);
  const cash = cashOf(actor);
  if (!record || !lot || cash === null) return;
  // Pay credits to the hundredth, and add the sold tons back onto the lot.
  await actor.update({
    "system.finance.cash": Math.round((cash + current.price * quantity) * 100) / 100
  }, { [SYNC_OPTION]: true });
  lot.tons += quantity;
  await storeRecord(actor, record);
  const held = Number(item.system?.quantity) || 0;
  // Selling the entire remaining quantity deletes the cargo item.
  if (quantity >= held) {
    await actor.deleteEmbeddedDocuments("Item", [item.id], { [SYNC_OPTION]: true });
  } else {
    await item.update({ "system.quantity": held - quantity }, { [SYNC_OPTION]: true });
  }
  apps.get(actor.id)?.render(false);
}

/**
 * Rounded credit difference for the market sheet.
 * A positive value is shown with a leading plus.
 */
function signed(value) {
  const rounded = Math.round(Number(value) || 0);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

/**
 * Speculative-goods window for one ship.
 * Lot rows drag onto the ship sheet, and a cargo item dropped here is sold.
 */
class MarketApp extends Application {
  /**
   * Binds the window to one ship. The application id is unique per actor.
   */
  constructor(actor) {
    super({ id: `blueprint-market-${actor.id}` });
    this.actor = actor;
  }

  /**
   * Foundry application options for the market window.
   * openMarket replaces the title with the world name.
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: MARKET_TEMPLATE,
      width: 720,
      height: "auto",
      resizable: true,
      title: "Market"
    });
  }

  /**
   * Sheet data for the stored lots.
   * purchaseDiff and saleDiff are the per-ton price minus the catalogue base, in credits.
   */
  getData() {
    const record = marketRecord(this.actor);
    const lots = (record?.lots ?? []).map((lot) => ({
      ...lot,
      purchaseDiff: signed(lot.purchasePerTon - lot.basePrice),
      saleDiff: signed(lot.salePerTon - lot.basePrice)
    }));
    return {
      place: record?.name || "Market",
      lots,
      empty: lots.length === 0
    };
  }

  /**
   * Each lot row drags as application/x-traveler-blueprint-market for the ship sheet.
   * A dropped Item uuid is passed to sellCargo.
   */
  activateListeners(html) {
    super.activateListeners(html);
    const root = html?.[0] ?? html;
    root?.querySelectorAll(".market-lot").forEach((row) => {
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", (event) => {
        const payload = JSON.stringify({
          type: `${MODULE_ID}.market`,
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
   * Sells a dropped Item onto this market.
   * The drop must be an Item uuid.
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
    await sellCargo(this.actor, item);
  }
}

/**
 * Opens the market window, rolling a list when the stored world is empty.
 * Returns null when ensureMarket stops, and titles the window with the world name.
 */
export async function openMarket(actor) {
  const record = await ensureMarket(actor);
  if (!record) return null;
  // The window already open for this ship is reused.
  let app = apps.get(actor.id);
  if (!app) {
    app = new MarketApp(actor);
    apps.set(actor.id, app);
  }
  app.options.title = record.name ? `Market — ${record.name}` : "Market";
  app.render(true);
  return app;
}
