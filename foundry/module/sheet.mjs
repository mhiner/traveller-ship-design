import { MgT2ActorSheet } from "/systems/mgt2e/module/sheets/actor-sheet.mjs";
import { tradeEmbarkPassengerHandler } from "/systems/mgt2e/module/helpers/utils/trade-utils.mjs";
import { MODULE_ID, SHEET_TEMPLATE, SHIP_TYPE, SYNC_OPTION } from "./constants.mjs";
import { deleteSpawned, ensureBreakawayActors, ensureModuleActors, publishBreakawayDesign } from "./breakaway-actors.mjs";
import { buyMarketLot, clearMarket, isMarketDocument, openMarket } from "./market.mjs";
import { clearFreight, deliverFreight, openFreight, syncFreight, takeFreight } from "./freight.mjs";
import { applyProjection, clampFuel } from "./sync.mjs";
import { withSpacecraftType } from "./wrap.mjs";
import { applyModules, applyBreakaways, breakawayJumpFuel, cargoSpaceKind, dockShipResult, effectiveDrives,
  externalLoad, clampedTonnage, addBerths, assignBerths, assignModuleBays, astrogationView, berthsOf, passageGrade,
  seatsOpen, isBreakawayDesign, jumpDisplacement, jumpFuelUse, loadedBreakawayDrives, moduleBays, moduleSpace,
  mountBlueprint, occupyShipBays, projectCarriedBays, projectShip, solarSupply } from "../dist/blueprint.js";

export { designFromHeader, projectShip } from "../dist/blueprint.js";

/** Ask how many passengers to embark, from 1 through the open berths. Dismissing the dialog embarks nobody, and a missing Dialog takes the maximum. */
function askCount({ title, detail, max }) {
  const Dialog = foundry?.appv1?.api?.Dialog ?? globalThis.Dialog;
  if (!Dialog) return Promise.resolve(max);
  return new Promise((resolve) => {
    let settled = false;
    /** Resolve the dialog once. A second call keeps the first answer. */
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    new Dialog({
      title,
      content: `<form class="traveler-blueprint"><p>${detail}</p><label>Passengers <input type="number" name="count" min="1" max="${max}" step="1" value="${max}"></label></form>`,
      buttons: {
        embark: {
          label: "Embark",
          callback: (html) => {
            const root = html?.[0] ?? html;
            const input = root?.querySelector?.("[name=count]") ?? html?.find?.("[name=count]")?.[0];
            const value = Math.floor(Number(input?.value));
            finish(Math.min(max, Math.max(1, Number.isFinite(value) && value > 0 ? value : max)));
          }
        }
      },
      // Dismissing the dialog embarks nobody.
      close: () => finish(0),
      default: "embark"
    }).render(true);
  });
}

/** Sheets with a live design editor. Design delivery and astrogation refreshes go to these. */
const openSheets = new Set();

/** Snapshot scroll offsets for nodes that have been scrolled. The next render replaces the blueprint pane. */
function keepScroll(root) {
  if (!root) return [];
  const saved = [];
  for (const node of root.querySelectorAll("*")) {
    if (!node.scrollTop && !node.scrollLeft) continue;
    saved.push([node, node.scrollTop, node.scrollLeft]);
  }
  return saved;
}

/** Write saved scroll offsets back onto nodes that are still in the document. */
function restoreScroll(saved) {
  for (const [node, top, left] of saved) {
    if (!node.isConnected) continue;
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}

/** The design open in the editor, including edits that have not been saved yet. */
export function editingDesign(actorId) {
  for (const sheet of openSheets) {
    if (sheet.actor?.id !== actorId) continue;
    return sheet.editingDesign();
  }
  return null;
}

/** Ensure spawned hulls, project the ship, fold what is installed, and publish. */
export async function projectInstalled(actor, design, catalog, hullOptions, options = {}) {
  const list = catalog ?? [];
  // When set, a parent hull that changed is copied onto the spawned child.
  const pushDesigns = options.pushDesigns === true;
  await ensureBreakawayActors(actor, design, list, { pushDesigns });
  await ensureModuleActors(actor, design, list, { pushDesigns });
  let projection;
  try {
    projection = projectShip(design, list, hullOptions ?? "");
  } catch (error) {
    console.error(`${MODULE_ID} ${options.failure ?? "could not project the design"}`, error);
    // Leave the actor unchanged when the design fails to project.
    return null;
  }
  projection = withInstalledBreakaways(
    actor,
    withInstalledModules(actor, projection, design)
  );
  const record = {
    currentId: design.id,
    designs: [design],
    modules: list.filter((row) => row?.id !== design.id)
  };
  // The caller can snapshot the blueprint record before it is written on the actor.
  options.beforeApply?.(record);
  await applyProjection(actor, projection, record, { keepName: options.keepName === true });
  await publishBreakawayDesign(actor, design);
  return projection;
}

/** Hand a saved design to every open sheet for this actor. Returns whether a sheet took it. */
export function deliverDesign(actorId, design, modules) {
  let delivered = false;
  for (const sheet of openSheets) {
    if (sheet.actor?.id !== actorId) continue;
    sheet.receiveDesign(design, modules);
    delivered = true;
  }
  return delivered;
}

/** Form fields painted from the projection after a design save. */
const HEADER_NAMES = {
  "system.spacecraft.dtons": "dtons",
  "system.spacecraft.tl": "tl",
  "system.spacecraft.type": "type",
  "system.spacecraft.configuration": "configuration"
};

/** Blueprint ship sheet. Projects a design onto the Mongoose spacecraft actor and keeps cargo, berths, astrogation, modules, breakaways, and docks aligned with it. */
export class BlueprintShipSheet extends MgT2ActorSheet {
  #view = null;
  #editor = null;
  // Debounce id for an unsaved design edit.
  #timer = 0;
  #stored = "";
  // Bumped when the editor is cleared, so a mount that finishes later is dropped.
  #generation = 0;
  #scrollTop = 0;
  #scrollLeft = 0;
  #keptScroll = [];
  // Jump targets from the last astrogation view, keyed by option id, with place and parsecs.
  #astroChoices = new Map();

  /** Sheet classes, template, size, and the blueprint tab shown on open. */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mgt2", "sheet", "actor", "spacecraft", "traveler-blueprint"],
      template: SHEET_TEMPLATE,
      width: 980,
      height: 760,
      tabs: [{
        navSelector: ".sheet-tabs",
        contentSelector: ".sheet-body",
        initial: "blueprint"
      }]
    });
  }

  /** Markup Foundry renders for this sheet. */
  get template() {
    return SHEET_TEMPLATE;
  }

  /** Build one render context. Ratings, power, displacement, berths, and the jump panel include joined hulls, cargo, and solar. */
  async getData() {
    await settleFuelCargo(this.actor);
    const projection = this.#openProjection();
    const installed = installedDrives(this.actor);
    const joined = hasJoinedHulls(this.actor) && projection;
    // A ship with joined hulls rates its drives from the combined projection.
    const driveBasis = joined
      ? { jump: projection.jdrive, maneuver: projection.mdrive }
      : installed;
    const laden = cargoLoad(this.actor);
    const clamped = this.#clampedTons();
    // Load tons that can change the ratings: outside cargo, an interplanetary net, and ships in clamps.
    const ladenTons = laden.external + laden.jumpNet + laden.planetary + clamped;
    const jumpLoad = { ...laden, clamped };
    // Attached hulls sit in the projection's displacement. Re-rate jump for that mass even with no cargo.
    const combinedDrives = joined ? loadedBreakawayDrives(projection, jumpLoad) : null;
    const ship = this.actor.system?.spacecraft;
    // The stock sheet copies the jump-drive item's rating into the jump label. Fuel scaling does not change that item.
    if (combinedDrives) {
      try {
        await alignJumpItem(this.actor, combinedDrives.jdrive);
      } catch (error) {
        console.error(`${MODULE_ID} could not store the effective jump`, error);
      }
    }
    // Seed ratings the stock sheet will copy. It then replaces them from the drive items, and the block below puts these back.
    if (ship && combinedDrives) {
      ship.jdrive = combinedDrives.jdrive;
      ship.mdrive = combinedDrives.mdrive;
    } else if (ship && ladenTons > 0) {
      ship.jdrive = driveBasis.jump;
      ship.mdrive = driveBasis.maneuver;
    }
    // The parent sheet reads a spacecraft for the duration of this call.
    const context = await withSpacecraftType(this.actor, () => super.getData());
    placeFuelCargo(context);
    placeListedCore(context, CORE_BEFORE_SOLAR);
    placeSolar(context);
    placeListedCore(context, CORE_AFTER_SOLAR);
    // Used power and armour follow the projection. Solar supply is added to the plant, in points, at thousandths.
    if (ship && projection) {
      ship.power.used = projection.powerUsed;
      ship.power.max = Math.round(
        ((Number(ship.power.max) || 0) + solarSupply(projection.pieces)) * 1000
      ) / 1000;
      ship.armour = projection.armour;
    }
    const listed = this.#bayListing();
    context.designShipBays = listed.ships;
    context.designVehicleBays = listed.vehicles;
    context.launchedShips = listed.launched;
    context.unplacedShips = listed.unplaced;
    context.launchedVehicles = listed.launchedVehicles;
    context.unplacedVehicles = listed.unplacedVehicles;
    context.moduleBay = listed.modules;
    context.breakawayBay = listed.breakaways;
    presentCargoSpaces(context);
    releaseEnclosed(context, projection);
    // The stock sheet just copied the drive item. Put the combined or loaded rating back, including when the only extra mass is an attached hull.
    if (ship && (combinedDrives || ladenTons > 0)) {
      applyLoadedDrives(
        context,
        this.actor,
        driveBasis,
        jumpLoad,
        joined ? projection : null
      );
    }
    presentJumpFuel(context, this.actor, projection, jumpLoad);
    // The label is the effective jump. Keep it on the re-rated value after the stock sheet has copied the drive item.
    if (combinedDrives) {
      const shown = context.system?.spacecraft;
      if (shown) shown.jdrive = combinedDrives.jdrive;
      if (context.fuelRequirements) context.fuelRequirements.rating = combinedDrives.jdrive;
      paintJumpRating(context, combinedDrives.jdrive);
    }
    // Market lots are shown on the trade tab, so the locker lists the ship's own gear.
    if (Array.isArray(context.locker)) {
      context.locker = context.locker.filter((item) => !isMarketDocument(item));
    }
    context.berths = this.#berthReport();
    context.astrogation = await this.#astrogation(
      Number(context.system?.spacecraft?.jdrive) || 0,
      projection,
      jumpLoad
    );
    return context;
  }

  /** Clamp an edited fuel amount to the tank before the actor is saved. */
  async _updateObject(event, formData) {
    const key = "system.spacecraft.fuel.value";
    if (formData && Object.prototype.hasOwnProperty.call(formData, key)) {
      formData[key] = clampFuel(formData[key], this.actor.system?.spacecraft?.fuel?.max);
    }
    return super._updateObject(event, formData);
  }

  /** Bind cargo, astrogation, and sheet clicks in the capture phase, then mount the design editor. */
  activateListeners(html) {
    const root = html?.[0] ?? html;
    root?.addEventListener?.("change", (event) => this.#onCargoHold(event), true);
    root?.addEventListener?.("change", (event) => this.#onAstrogationTarget(event), true);
    root?.addEventListener?.("click", (event) => this.#onSheetClick(event), true);
    // Stock listeners bind while the actor presents as a spacecraft.
    withSpacecraftType(this.actor, () => super.activateListeners(html));
    this.#fillType();
    void this.#mount(html);
  }

  /** Copy a saved classification into a type field that has not caught up. */
  #fillType() {
    const blueprint = this.actor.system?.blueprint ?? {};
    const stored = (blueprint.designs ?? []).find((design) =>
      design.id === blueprint.currentId
    ) ?? blueprint.designs?.[0] ?? null;
    const classification = stored?.classification;
    if (typeof classification !== "string" || classification === "") return;
    const pending = this.editingDesign()?.design?.classification;
    // An open draft with its own classification is left for the editor to save.
    if (pending && pending !== classification) return;
    if (this.actor.system?.spacecraft?.type === classification) return;
    // Write the type, and the sync flag keeps this update from projecting the design again.
    void this.actor.update(
      { "system.spacecraft.type": classification },
      { [SYNC_OPTION]: true }
    );
  }

  /** Store the hold chosen for a cargo lot. The event stops so the actor form stays unsubmitted. */
  #onCargoHold(event) {
    const select = event.target instanceof Element
      ? event.target.closest(".cargo-hold")
      : null;
    if (!select) return;
    event.stopPropagation();
    const item = this.actor.items.get(select.dataset.itemId);
    if (!item) return;
    void item.setFlag(MODULE_ID, "hold", select.value);
  }

  /** Show the breakaway or module tab, and store that choice on the actor. */
  #selectBay(name) {
    this.actor.system.spacecraft.baySelected = name;
    void this.actor.update({ "system.spacecraft.baySelected": name });
  }

  /** Apply plus, minus, or delete on a quantity row. Returns whether the click belonged to that row. */
  #quantityClick(event, target, row) {
    const control = target?.closest?.(row.selector);
    if (!control) return false;
    const actorId = control.closest(".actor-crew")?.dataset?.actorId;
    if (row.ship) {
      const docked = actorId ? game.actors?.get(actorId) : null;
      // This handler takes the click once the actor is a spacecraft.
      if (!docked || !isShipActor(docked)) return false;
      event.stopPropagation();
      event.preventDefault();
      if (control.classList.contains(row.plus)) void this.#addDocked(docked);
      else if (control.classList.contains(row.minus)) void row.down(actorId);
      else void row.clear(actorId);
      return true;
    }
    event.stopPropagation();
    event.preventDefault();
    // The click belongs to this row, and an empty actor id leaves the quantity as it stands.
    if (!actorId) return true;
    if (control.classList.contains(row.plus)) void row.up(actorId);
    else if (control.classList.contains(row.minus)) void row.down(actorId);
    else void row.clear(actorId);
    return true;
  }

  /** Save the jump target chosen in the list. An option absent from the last view clears the stored target. */
  #onAstrogationTarget(event) {
    const select = event.target instanceof Element
      ? event.target.closest(".astrogation-target")
      : null;
    if (!select) return;
    event.stopPropagation();
    const choice = this.#astroChoices.get(select.value) ?? null;
    void this.#storeTarget(choice?.place ?? null);
  }

  /** Build the jump panel for this rating. Fuel cost is tons for the selected target at the loaded displacement. */
  async #astrogation(jump, projection, load) {
    const api = astrogationApi();
    // The astrogation module is inactive, so the panel is omitted.
    if (!api) {
      this.#astroChoices = new Map();
      return null;
    }
    const current = storedPlace(this.actor.getFlag(MODULE_ID, "currentSystem"));
    const target = storedPlace(this.actor.getFlag(MODULE_ID, "targetSystem"));
    let within = [];
    if (current) {
      try {
        within = await api.systemsWithin(current, jump);
      } catch (error) {
        console.error(`${MODULE_ID} could not read systems in jump range`, error);
      }
    }
    const view = astrogationView({
      current,
      target,
      selected: storedPlace(api.selectedSystem()),
      within: Array.isArray(within) ? within : [],
      fuelCost: null,
      fuelHave: Number(this.actor.system?.spacecraft?.fuel?.value) || 0
    });
    this.#astroChoices = new Map(view.options.map((row) => [row.id, {
      place: row.place,
      parsecs: row.parsecs
    }]));
    const chosen = view.options.find((row) => row.selected);
    // The first view leaves the fuel cost empty so the selected row can be found, then the second view carries the price.
    const cost = chosen ? this.#jumpFuel(projection, load, chosen.parsecs) : 0;
    return astrogationView({
      current,
      target,
      selected: storedPlace(api.selectedSystem()),
      within: Array.isArray(within) ? within : [],
      fuelCost: chosen ? cost : null,
      fuelHave: Number(this.actor.system?.spacecraft?.fuel?.value) || 0
    });
  }

  /** Jump fuel in tons for this distance, using the loaded displacement. The cost stays zero unless the projection is present and the distance is positive. */
  #jumpFuel(projection, load, parsecs) {
    if (!projection || !(parsecs > 0)) return 0;
    const hull = Number(projection.dtons) || 0;
    // Displacement the jump is scored against, including outside cargo and clamps.
    return breakawayJumpFuel(projection, parsecs, jumpDisplacement(hull, load));
  }

  /** Store the astrogation module's selected system as this ship's location, then refresh freight. */
  async #setCurrentSystem() {
    const selected = storedPlace(astrogationApi()?.selectedSystem());
    // An empty selection leaves the ship's location unchanged.
    if (!selected) return;
    await this.actor.update({
      [`flags.${MODULE_ID}.currentSystem`]: selected
    }, { [SYNC_OPTION]: true });
    await syncFreight(this.actor);
  }

  /** Write the jump target flag, deleting it when the place is empty, then refresh freight. */
  async #storeTarget(place) {
    await this.actor.update(
      place
        ? { [`flags.${MODULE_ID}.targetSystem`]: place }
        : { [`flags.${MODULE_ID}.-=targetSystem`]: null },
      { [SYNC_OPTION]: true }
    );
    await syncFreight(this.actor);
  }

  /** Jump when the tank can pay the fuel. Freight is delivered, the ship is recorded at the target, and the market and freight boards are cleared. */
  async #jump() {
    const target = storedPlace(this.actor.getFlag(MODULE_ID, "targetSystem"));
    const current = storedPlace(this.actor.getFlag(MODULE_ID, "currentSystem"));
    const choice = target ? this.#astroChoices.get(`${target.sector}|${target.hex}`) : null;
    // A jump needs the current system, a target, and that target's range from the last panel.
    if (!current || !target || !choice) return;
    const projection = this.#openProjection();
    const load = { ...cargoLoad(this.actor), clamped: this.#clampedTons() };
    const cost = this.#jumpFuel(projection, load, choice.parsecs);
    const have = Number(this.actor.system?.spacecraft?.fuel?.value) || 0;
    // A millionth of a ton covers a short binary fraction. A zero cost warns and leaves the ship in place.
    if (!(cost > 0) || have + 1e-9 < cost) {
      ui.notifications?.warn(
        cost > 0
          ? `This jump needs ${cost} tons of fuel.`
          : "This ship cannot jump."
      );
      return;
    }
    const cap = Number(this.actor.system?.spacecraft?.fuel?.max) || 0;
    // Fuel remaining, in tons, held to hundredths and inside the tank.
    const left = Math.round(clampFuel(have - cost, cap) * 100) / 100;
    // Deliver at the destination, then record the arrival and clear both boards.
    await deliverFreight(this.actor, target);
    await this.actor.update({
      [`flags.${MODULE_ID}.currentSystem`]: target,
      [`flags.${MODULE_ID}.-=targetSystem`]: null,
      "system.spacecraft.fuel.value": left
    }, { [SYNC_OPTION]: true });
    await clearMarket(this.actor);
    await clearFreight(this.actor);
  }

  /** Route clicks for passengers, freight, the market, jumps, module and breakaway quantities, bay tabs, and docks. */
  #onSheetClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    // A matched control stops the event here, ahead of the stock sheet handler.
    const passenger = target?.closest?.(".crew-passenger");
    if (passenger) {
      event.preventDefault();
      event.stopPropagation();
      const actorId = passenger.closest(".actor-crew")?.dataset?.actorId;
      if (actorId) void this.#makePassenger(actorId);
      return;
    }
    const freight = target?.closest?.(".freight-open");
    if (freight) {
      event.preventDefault();
      event.stopPropagation();
      void openFreight(this.actor);
      return;
    }
    const market = target?.closest?.(".market-open");
    if (market) {
      event.preventDefault();
      event.stopPropagation();
      void openMarket(this.actor);
      return;
    }
    const astrogation = target?.closest?.(".astrogation-set, .astrogation-jump");
    if (astrogation) {
      event.preventDefault();
      event.stopPropagation();
      if (astrogation.classList.contains("astrogation-set")) void this.#setCurrentSystem();
      else if (!astrogation.hasAttribute("disabled")) void this.#jump();
      return;
    }
    // Module quantities, breakaway attach state, and dock state are handled here. Bay tabs follow.
    const rows = [
      {
        selector: ".module-delete",
        plus: "module-plus",
        minus: "module-minus",
        up: () => {},
        down: () => {},
        clear: (actorId) => this.#clearModule(actorId)
      },
      {
        selector: ".breakaway-plus, .breakaway-minus, .breakaway-delete",
        plus: "breakaway-plus",
        minus: "breakaway-minus",
        up: (actorId) => this.#attachBreakaway(actorId),
        down: (actorId) => this.#detachBreakaway(actorId),
        clear: (actorId) => this.#clearBreakaway(actorId)
      },
      {
        selector: ".vehicle-plus, .vehicle-minus, .vehicle-delete",
        plus: "vehicle-plus",
        minus: "vehicle-minus",
        up: (actorId) => {
          const actor = game.actors?.get(actorId);
          if (actor) return this.#addVehicle(actor);
        },
        down: (actorId) => this.#launchShip(actorId),
        clear: (actorId) => this.#clearDocked(actorId)
      }
    ];
    for (const row of rows) {
      if (this.#quantityClick(event, target, row)) return;
    }
    const bay = target?.closest?.(".bay-breakaway, .bay-module");
    if (bay) {
      event.preventDefault();
      this.#selectBay(bay.classList.contains("bay-breakaway") ? "breakaway" : "module");
      return;
    }
    this.#quantityClick(event, target, {
      selector: ".docked-plus, .docked-minus, .docked-delete",
      plus: "docked-plus",
      minus: "docked-minus",
      ship: true,
      down: (actorId) => this.#launchShip(actorId),
      clear: (actorId) => this.#clearDocked(actorId)
    });
  }

  /** Accept a dropped freight lot, market lot, or passenger world item, and pass every remaining payload to the spacecraft drop. */
  async _onDrop(event) {
    const raw = event.dataTransfer?.getData("application/x-traveler-blueprint-market")
      || event.dataTransfer?.getData("text/plain");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data?.type === `${MODULE_ID}.freight` && data.actorId === this.actor.id && data.lotId) {
          event.preventDefault();
          await takeFreight(this.actor, data.lotId);
          return;
        }
        if (data?.type === `${MODULE_ID}.market` && data.actorId === this.actor.id && data.lotId) {
          event.preventDefault();
          await buyMarketLot(this.actor, data.lotId);
          return;
        }
      } catch {
        // A market drag that is not ours falls through to the sheet drop.
      }
    }
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data?.type === "Item" && data.uuid) {
          const item = await fromUuid(data.uuid);
          const passage = item?.system?.world;
          // Passenger world data embarks through the trade flow, limited by the open berths.
          if (item?.type === "worlddata" && passage?.datatype === "passenger") {
            event.preventDefault();
            await this.#embarkPassengers(item);
            return;
          }
        }
      } catch {
        // Another drop uses the sheet's own handler.
      }
    }
    // The spacecraft drop handler runs while this actor presents as a ship.
    return withSpacecraftType(this.actor, () => super._onDrop(event));
  }

  /** Receive a dropped actor. A breakaway hull joins, a module installs, a ship docks, and a person needs a free berth. */
  async _onDropActor(event, data) {
    const actor = await fromUuid(data.uuid);
    // Two breakaway hulls join, and the dropped hull is added to this bay.
    if (actor && isBreakawayBlueprint(actor) && isBreakawayBlueprint(this.actor)) {
      return this.#addBreakaway(actor);
    }
    if (actor && isModuleBlueprint(actor)) return this.#addModule(actor);
    if (actor && actor.type === "vehicle") return this.#addVehicle(actor);
    if (actor && isShipActor(actor)) return this.#addDocked(actor);
    if (actor && ["traveller", "npc", "robot"].includes(actor.type)) {
      const aboard = this.#aboard();
      // A person already listed as a passenger keeps that berth. A new person needs a free one.
      if (!this.actor.system?.crewed?.passengers?.[actor.id]) {
        const report = assignBerths(this.#berthSupply(), [...aboard, "middle"]);
        if (!report.fits) {
          ui.notifications?.warn(report.reason);
          return;
        }
      }
    }
    return super._onDropActor(event, data);
  }

  /** Berths on this design, plus berths on each carried module and breakaway multiplied by quantity. */
  #berthSupply() {
    const { design } = this.#designSource();
    let supply = berthsOf(design ?? {});
    for (const carried of this.#carriedHulls()) {
      supply = addBerths(supply, berthsOf(carried.design ?? {}), carried.quantity);
    }
    return supply;
  }

  /** Passage grades of everyone aboard. Each crew member counts as the crew grade. */
  #aboard() {
    const grades = [];
    for (const id of Object.keys(this.actor.system?.crewed?.crew ?? {})) {
      if (id) grades.push("crew");
    }
    for (const [id, entry] of Object.entries(this.actor.system?.crewed?.passengers ?? {})) {
      const person = game.actors?.get(id);
      grades.push(passageGrade(entry?.passage ?? person?.system?.meta?.passage));
    }
    return grades;
  }

  /** Assign everyone aboard to the berths on hand, including the reason when the ship is short. */
  #berthReport() {
    return assignBerths(this.#berthSupply(), this.#aboard());
  }

  /** Move a crew member to standard passengers when a middle berth is free for them. */
  async #makePassenger(actorId) {
    const crew = this.actor.system?.crewed?.crew ?? {};
    // Crew listed on the ship are the people this move can change.
    if (!crew[actorId]) return;
    // This person is leaving the crew, so one crew grade comes off before the middle berth is checked.
    const aboard = this.#aboard().filter((grade) => grade === "crew").slice(1);
    const passengers = this.#aboard().filter((grade) => grade !== "crew");
    const report = assignBerths(this.#berthSupply(), [...passengers, ...aboard, "middle"]);
    if (!report.fits) {
      ui.notifications?.warn(report.reason);
      return;
    }
    await this.actor.update({ [`system.crewed.crew.-=${actorId}`]: null });
    await this.actor.update({
      [`system.crewed.passengers.${actorId}`]: { role: "STANDARD" }
    });
  }

  /** Embark this passenger lot, up to the open berths of its grade. The world owner runs the trade. */
  async #embarkPassengers(item) {
    const world = item.parent;
    // The lot needs a world actor to embark from.
    if (!world) return;
    const grade = passageGrade(item.system?.world?.passage);
    const supply = this.#berthSupply();
    const aboard = this.#aboard();
    const open = seatsOpen(supply, aboard, grade);
    if (open < 1) {
      ui.notifications?.warn(assignBerths(supply, [...aboard, grade]).reason);
      return;
    }
    const lot = Math.max(0, Math.floor(Number(item.system?.quantity) || 0));
    // The embark is capped by the open berths of this grade and by the size of the lot.
    const max = Math.min(open, lot);
    if (max < 1) return;
    const chosen = await askCount({
      title: "Embark passengers",
      detail: `This ship can take ${max}.`,
      max
    });
    // The dialog was dismissed, so nobody embarks.
    if (!chosen) return;
    const data = {
      type: "tradeEmbarkPassenger",
      shipActorId: this.actor.uuid,
      worldActorId: world.uuid,
      passengerItemId: item.uuid,
      quantity: chosen
    };
    // Owner permission is above 2 and runs the embark here. A lower permission asks the world owner on the system socket.
    if (world.permission > 2) await tradeEmbarkPassengerHandler(data);
    else game.socket?.emit("system.mgt2e", data);
  }

  /** Commit a pending design edit, drop the editor, and close the sheet. */
  async close(options) {
    this.#clear();
    return super.close(options);
  }

  /** Replacing the sheet HTML resets the window scroll. Put it back. */
  _replaceHTML(element, html) {
    const root = element?.[0] ?? element;
    const content = root?.querySelector?.(".window-content") ?? null;
    this.#scrollTop = content?.scrollTop ?? 0;
    this.#scrollLeft = content?.scrollLeft ?? 0;
    this.#keptScroll = keepScroll(root?.querySelector?.(".blueprint-mount"));
    super._replaceHTML(element, html);
    this.#applyScroll();
  }

  /** Restore scroll after the async render, which can clear it again once the HTML is in place. */
  async _render(force, options) {
    await super._render(force, options);
    this.#applyScroll();
  }

  /** Put the saved window and blueprint scroll offsets back on the live nodes. */
  #applyScroll() {
    const content = this.element?.[0]?.querySelector?.(".window-content");
    if (content) {
      content.scrollTop = this.#scrollTop;
      content.scrollLeft = this.#scrollLeft;
    }
    restoreScroll(this.#keptScroll);
  }

  /** Mount the design editor in the blueprint pane. A mount that finishes after the editor was cleared is destroyed. */
  async #mount(html) {
    const root = html?.[0] ?? html;
    const placeholder = root?.querySelector?.(".blueprint-mount");
    // The editor mounts when this render includes a blueprint pane.
    if (!placeholder) return;
    // A sheet render replaces the form. Keep the live editor so an in-flight
    // design save is not cancelled and open sections stay open.
    if (this.#view && this.#editor) {
      if (placeholder !== this.#editor) placeholder.replaceWith(this.#editor);
      return;
    }
    this.#seal(placeholder);
    this.#clear();
    const generation = this.#generation;
    try {
      const view = await mountBlueprint(placeholder, {
        load: () => this.#load(),
        sync: (design, modules, immediate) => this.#sync(design, modules, immediate)
      });
      // The editor was cleared while this mount was still loading.
      if (generation !== this.#generation) {
        view.destroy();
        return;
      }
      this.#view = view;
      this.#editor = placeholder;
      openSheets.add(this);
    } catch (error) {
      console.error(`${MODULE_ID} failed to open the design`, error);
    }
  }

  /** The actor sheet submits on every change. Design controls must not trigger that. */
  #seal(mount) {
    if (mount.dataset.blueprintSealed) return;
    mount.dataset.blueprintSealed = "1";
    mount.addEventListener("change", (event) => event.stopPropagation());
    mount.addEventListener("click", (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("button")
        : null;
      if (button && button.getAttribute("type") === null) button.type = "button";
    }, true);
    mount.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.target instanceof HTMLTextAreaElement) return;
      if (event.target instanceof HTMLInputElement) event.preventDefault();
    });
  }

  /** The unsaved draft in the open editor, or null when the editor is closed. */
  editingDesign() {
    return this.#view?.draft() ?? null;
  }

  /** Replace the open draft with this design and cancel the debounced save of the previous draft. */
  receiveDesign(design, modules) {
    window.clearTimeout(this.#timer);
    this.#timer = 0;
    this.#view?.replace(design, modules ?? []);
    this.#stored = JSON.stringify({
      currentId: design.id,
      designs: [design],
      modules: modules ?? []
    });
  }

  /** Drop the editor. A debounced draft is committed first, and the generation bump drops a mount still loading. */
  #clear() {
    // A running timer means a draft has yet to be written.
    const pending = this.#timer ? this.#view?.draft() : null;
    openSheets.delete(this);
    this.#generation += 1;
    window.clearTimeout(this.#timer);
    this.#timer = 0;
    this.#editor = null;
    if (pending) void this.#commit(pending.design, pending.modules);
    this.#view?.destroy();
    this.#view = null;
  }

  /** The blueprint record stored on the actor, plus the actor name the editor shows. */
  async #load() {
    const blueprint = this.actor.system?.blueprint ?? {};
    const record = {
      currentId: blueprint.currentId ?? "",
      designs: blueprint.designs ?? [],
      modules: blueprint.modules ?? []
    };
    this.#stored = JSON.stringify(record);
    return { ...record, actorName: this.actor.name ?? "" };
  }

  /** Schedule a design save. An immediate sync writes now, and a normal edit waits 300 ms so typing becomes one update. */
  #sync(design, modules, immediate) {
    window.clearTimeout(this.#timer);
    /** Clear the debounce handle and write this draft. */
    const run = () => {
      this.#timer = 0;
      void this.#commit(design, modules);
    };
    if (immediate) run();
    else this.#timer = window.setTimeout(run, 300);
  }

  /** Project the design, update spawned hulls, and paint the header fields from the result. */
  async #commit(design, modules) {
    // The design is passed on its own, so the catalog carries the other hulls.
    const kept = (modules ?? []).filter((row) => row?.id !== design.id);
    const projection = await projectInstalled(
      this.actor,
      design,
      [design, ...kept],
      this.actor.system?.spacecraft?.hullOptions ?? "",
      {
        pushDesigns: true,
        failure: "could not project the design",
        beforeApply: (record) => {
          this.#stored = JSON.stringify(record);
        }
      }
    );
    // A failed projection leaves the header as it stands.
    if (!projection) return;
    this.#paint(projection);
  }

  /** Copy projected header values into the open inputs. The actor document already holds the saved record. */
  #paint(projection) {
    const root = this.element?.[0] ?? this.element;
    if (!root?.querySelector) return;
    for (const [name, key] of Object.entries(HEADER_NAMES)) {
      const field = root.querySelector(`[name="${name}"]`);
      if (field) field.value = String(projection[key]);
    }
    const name = root.querySelector('[name="name"]');
    // The field is the actor name. A shared hull keeps its own name when the design name differs.
    if (name) name.value = this.actor.name || projection.name || "";
    const standard = root.querySelector('[name="system.spacecraft.isStandardDesign"]');
    if (standard) standard.checked = projection.isStandardDesign;
  }

  /** The open draft, or the stored current design, and the catalog of that design plus its modules. */
  #designSource() {
    const blueprint = this.actor.system?.blueprint ?? {};
    const live = this.editingDesign();
    const stored = (blueprint.designs ?? []).find((design) =>
      design.id === blueprint.currentId
    ) ?? blueprint.designs?.[0] ?? null;
    // The open draft is the design this render uses.
    const design = live?.design ?? stored;
    const modules = (live?.modules ?? blueprint.modules ?? []).filter((row) =>
      row?.id !== design?.id
    );
    return { design, catalog: design ? [design, ...modules] : [] };
  }

  /** Displacement tons of ships held in clamps. The weight is zero when the design is missing or the bays fail to read. */
  #clampedTons() {
    if (!this.#designSource().design) return 0;
    try {
      return clampedTonnage(this.#designBays(), this.#heldShips());
    } catch (error) {
      console.error(`${MODULE_ID} could not weigh clamped ships`, error);
      return 0;
    }
  }

  /** Docking bays on the design, including bays on carried hulls. A failed read yields an empty list. */
  #designBays() {
    const { design, catalog } = this.#designSource();
    if (!design) return [];
    try {
      return projectCarriedBays(design, catalog, this.#carriedHulls());
    } catch (error) {
      console.error(`${MODULE_ID} could not read docking bays`, error);
      return [];
    }
  }

  /** Installed modules and breakaway hulls, including nested breakaways. A nested hull's quantity is multiplied by each parent copy. */
  #carriedHulls(actor = this.actor, prefix = "", seen = new Set()) {
    const carried = [];
    const design = actorDesign(actor);
    if (design) {
      const held = [];
      for (const [actorId, entry] of Object.entries(actor?.system?.moduleBay ?? {})) {
        // A module entry for this same actor is passed over.
        if (actorId === actor?.id) continue;
        const other = game.actors?.get(actorId);
        const moduleDesign = actorDesign(other);
        // A module bay contributes when the actor's hull type is module.
        if (!other || moduleDesign?.hullType !== "module") continue;
        held.push({
          id: actorId,
          tons: shipTons(other),
          quantity: Math.max(1, Math.round(Number(entry?.quantity) || 1))
        });
      }
      for (const row of assignModuleBays(moduleBays(design), held).fitted) {
        const other = game.actors?.get(row.id);
        const moduleDesign = actorDesign(other);
        if (!moduleDesign) continue;
        carried.push({
          id: `${prefix}module:${row.id}`,
          design: moduleDesign,
          quantity: row.quantity,
          catalog: [moduleDesign, ...(other.system?.blueprint?.modules ?? [])]
        });
      }
    }
    // The breakaway walk continues on a breakaway hull, after its modules are in the list.
    if (!isBreakawayBlueprint(actor)) return carried;
    if (actor?.id) seen.add(actor.id);
    for (const [actorId, entry] of Object.entries(actor?.system?.breakawayBay ?? {})) {
      // This hull is already on the walk, which stops a join cycle.
      if (seen.has(actorId)) continue;
      const other = game.actors?.get(actorId);
      const otherDesign = actorDesign(other);
      if (!other || !isBreakawayDesign(otherDesign)) continue;
      seen.add(actorId);
      // A detached hull stays on the list and contributes nothing until it is attached again.
      if (!isBreakawayAttached(entry)) continue;
      const quantity = Math.max(1, Math.round(Number(entry?.quantity) || 1));
      const nested = this.#carriedHulls(other, `${prefix}breakaway:${actorId}:`, seen);
      carried.push({
        id: `${prefix}breakaway:${actorId}`,
        design: otherDesign,
        quantity,
        catalog: [otherDesign, ...(other.system?.blueprint?.modules ?? [])]
      });
      for (const row of nested) {
        // Each copy of the parent carries its own copy of the nested hull.
        carried.push({ ...row, quantity: row.quantity * quantity });
      }
    }
    return carried;
  }

  /** Bays flagged to accept a spacecraft. Fullness is checked when a ship is docked. */
  #openBays() {
    return this.#designBays().filter((bay) => bay.acceptsShip);
  }

  /** Bays flagged to accept a vehicle. Fullness is checked when a vehicle is docked. */
  #openVehicleBays() {
    return this.#designBays().filter((bay) => bay.acceptsVehicle);
  }

  /** Docked ships, with quantity and displacement tons. A launched ship stays listed and takes no bay. */
  #heldShips() {
    return this.#heldCraft(this.#listedShips());
  }

  /** Docked vehicles, with quantity and shipping tons. A launched vehicle stays listed and takes no bay. */
  #heldVehicles() {
    return this.#heldCraft(this.#listedVehicles());
  }

  /** The docked rows from a dock list, in the shape bay placement expects. */
  #heldCraft(listed) {
    const held = [];
    for (const row of listed) {
      if (!row.docked) continue;
      held.push({
        actorId: row.actorId,
        quantity: row.quantity,
        tons: row.tons
      });
    }
    return held;
  }

  /** Every ship in the docks map, docked or launched. A missing docked flag counts as docked. */
  #listedShips() {
    return this.#listedCraft((actor) => isShipActor(actor));
  }

  /** Every vehicle in the docks map, docked or launched. Shipping tons are the size the bay checks. */
  #listedVehicles() {
    return this.#listedCraft((actor) => actor.type === "vehicle");
  }

  /** Dock entries whose actor passes the test. A missing docked flag counts as docked. */
  #listedCraft(accept) {
    const docks = this.actor.system?.docks ?? {};
    const listed = [];
    for (const [actorId, entry] of Object.entries(docks)) {
      const actor = game.actors?.get(actorId);
      if (!actor || !accept(actor)) continue;
      const quantity = Math.max(1, Math.round(Number(entry?.quantity) || 1));
      const vehicle = actor.type === "vehicle";
      const tons = vehicle ? vehicleTons(actor) : shipTons(actor);
      listed.push({
        actorId,
        name: quantity > 1 ? `${actor.name} x${quantity}` : actor.name,
        img: actor.img,
        dtons: vehicle ? tons : actor.system?.spacecraft?.dtons,
        quantity,
        tons,
        docked: isDocked(entry)
      });
    }
    return listed;
  }

  /** Cards for ship bays, vehicle bays, launched craft, and the module and breakaway lists. */
  #bayListing() {
    const projected = this.#designBays();
    const ships = this.#dockCards(
      projected.filter((bay) => bay.kind === "ship"),
      this.#heldShips(),
      this.#listedShips()
    );
    const vehicles = this.#dockCards(
      projected.filter((bay) => bay.kind === "vehicle"),
      this.#heldVehicles(),
      this.#listedVehicles()
    );
    return {
      ships: ships.cards,
      vehicles: vehicles.cards,
      launched: ships.launched,
      unplaced: ships.unplaced,
      launchedVehicles: vehicles.launched,
      unplacedVehicles: vehicles.unplaced,
      modules: this.#moduleListing(),
      breakaways: this.#breakawayListing()
    };
  }

  /** Bay cards, launched craft, and craft that do not fit. An open bay stays empty until a docked craft takes it. */
  #dockCards(bays, held, listed) {
    const open = bays.filter((bay) => bay.acceptsShip || bay.acceptsVehicle);
    const occupied = occupyShipBays(open, held);
    const cards = [];
    for (const bay of bays) {
      const slot = bay.acceptsShip || bay.acceptsVehicle
        ? occupied.bays.find((row) => row.id === bay.id)
        : null;
      const actor = slot?.actorId ? game.actors?.get(slot.actorId) : null;
      // An open berth shows as empty. A dock drawn for a specific craft keeps its design name.
      if (!actor) {
        cards.push({
          title: bay.name,
          tons: bay.tons,
          span: baySpan(bay),
          empty: Boolean(bay.acceptsShip || bay.acceptsVehicle)
        });
        continue;
      }
      const ship = actor.system?.spacecraft ?? {};
      cards.push({
        title: actor.name,
        tons: bay.tons,
        empty: false,
        actorId: actor.id,
        img: actor.img,
        dtons: actor.type === "vehicle" ? vehicleTons(actor) : ship.dtons,
        mdrive: ship.mdrive,
        jdrive: ship.jdrive,
        status: "Docked"
      });
    }
    const launched = listed.filter((row) => !row.docked).map((row) => ({
      actorId: row.actorId,
      name: row.name,
      img: row.img,
      dtons: row.dtons,
      quantity: row.quantity,
      status: "Launched"
    }));
    const unplaced = occupied.unplaced.flatMap((row) => {
      const actor = game.actors?.get(row.actorId);
      if (!actor) return [];
      return [{
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        quantity: row.quantity,
        status: "Docked"
      }];
    });
    return { cards, launched, unplaced };
  }

  /** Module bay sizes on the design currently shown. */
  #moduleBays() {
    return moduleBays(this.#designSource().design);
  }

  /** Module actors in the module bay, with quantity and displacement tons. A missing quantity counts as one. */
  #heldModules() {
    const bay = this.actor.system?.moduleBay ?? {};
    const held = [];
    for (const [actorId, entry] of Object.entries(bay)) {
      const actor = game.actors?.get(actorId);
      if (!actor || !isModuleBlueprint(actor)) continue;
      held.push({
        id: actorId,
        actorId,
        tons: shipTons(actor),
        quantity: Math.max(1, Math.round(Number(entry?.quantity) || 1)),
        name: actor.name,
        img: actor.img
      });
    }
    return held;
  }

  /** One card per module bay. An attached module offers only removal. A module that fits no bay stays listed. */
  #moduleListing() {
    const bays = this.#moduleBays();
    const held = this.#heldModules();
    const pending = [];
    for (const row of held) {
      for (let count = 0; count < row.quantity; count += 1) pending.push(row);
    }
    const used = new Set();
    const cards = bays.map((bay) => {
      const index = pending.findIndex((row, item) =>
        !used.has(item) && sameTons(row.tons, bay.tons)
      );
      if (index < 0) {
        return {
          title: `${bayLabel(bay.tons)}-ton module bay`,
          tons: bay.tons,
          empty: true
        };
      }
      used.add(index);
      const row = pending[index];
      return {
        title: row.name,
        tons: row.tons,
        empty: false,
        actorId: row.actorId,
        img: row.img,
        status: "Attached"
      };
    });
    const unplaced = [];
    const seen = new Map();
    pending.forEach((row, item) => {
      if (used.has(item)) return;
      seen.set(row.actorId, (seen.get(row.actorId) ?? 0) + 1);
    });
    for (const [actorId, quantity] of seen) {
      const row = held.find((item) => item.actorId === actorId);
      if (!row) continue;
      unplaced.push({
        actorId,
        name: row.name,
        img: row.img,
        quantity
      });
    }
    return {
      open: bays.length > 0,
      cards,
      unplaced
    };
  }

  /** Add a dragged module to the list when an open bay matches its tonnage. A module already listed stays as it is. */
  async #addModule(actor) {
    // The same actor stays off its own module list.
    if (actor.id === this.actor.id) {
      ui.notifications?.warn("A ship cannot install itself as a module.");
      return;
    }
    if (this.actor.system?.moduleBay?.[actor.id]) return;
    const result = moduleSpace(this.#moduleBays(), this.#heldModules(), shipTons(actor));
    if (result !== "ok") {
      ui.notifications?.warn(MODULE_NOTE[result]);
      return;
    }
    await this.#setBay("moduleBay", actor.id, 1, { replace: true, render: false, resync: true });
  }

  /** Remove one copy of a module. The last copy leaves the list. A spawned module is also taken off the design. */
  async #clearModule(actorId) {
    if (await this.#releaseSpawnedModule(actorId)) return;
    const current = Math.round(Number(this.actor.system?.moduleBay?.[actorId]?.quantity) || 1);
    const quantity = current > 1 ? current - 1 : null;
    await this.#setBay("moduleBay", actorId, quantity, { render: false, resync: true });
  }

  /**
   * Take one spawned copy of this module off the carrier design.
   * Returns false when the module was dropped on the sheet rather than spawned from the design.
   */
  async #releaseSpawnedModule(actorId) {
    const child = game.actors?.get(actorId);
    const designId = child?.getFlag?.(MODULE_ID, "moduleDesign") ??
      child?.flags?.[MODULE_ID]?.moduleDesign;
    const parentId = child?.getFlag?.(MODULE_ID, "moduleParent") ??
      child?.flags?.[MODULE_ID]?.moduleParent;
    if (!child || parentId !== this.actor.id || !designId) return false;
    const { design, catalog } = this.#designSource();
    const options = design?.hullOptions ?? [];
    const index = options.findIndex((option) =>
      option?.kind === "modular" && (option.modules ?? []).includes(designId)
    );
    if (!design || index < 0) return false;
    const next = structuredClone(design);
    const option = next.hullOptions[index];
    const listed = [...(option.modules ?? [])];
    listed.splice(listed.indexOf(designId), 1);
    option.modules = listed;
    const modules = catalog.filter((row) => row?.id !== next.id);
    const bay = { ...(this.actor.system?.moduleBay ?? {}) };
    const quantity = Math.max(1, Math.round(Number(bay[actorId]?.quantity) || 1));
    if (quantity > 1) bay[actorId] = { quantity: quantity - 1 };
    else delete bay[actorId];
    // The saved design drops this module before the actor is deleted, so a refresh does not install it again.
    this.receiveDesign(next, modules);
    await this.actor.update({
      "system.blueprint.currentId": next.id,
      "system.blueprint.designs": [next],
      "system.blueprint.modules": modules,
      "system.moduleBay": bay
    }, { render: false, diff: false, [SYNC_OPTION]: true });
    if (quantity <= 1) await deleteSpawned(child);
    await this.#commit(next, modules);
    return true;
  }

  /** Write one bay entry. A null quantity deletes the key, and replace stores a fresh entry for a new actor. */
  async #setBay(bay, actorId, quantity, options = {}) {
    // A null quantity deletes the Foundry key. replace writes the whole entry, and a quantity update sets that field.
    const change = quantity == null
      ? { [`system.${bay}.-=${actorId}`]: null }
      : options.replace
      ? { [`system.${bay}.${actorId}`]: { quantity } }
      : { [`system.${bay}.${actorId}.quantity`]: quantity };
    if (options.render === false) await this.actor.update(change, { render: false });
    else await this.actor.update(change);
    // Modules and breakaways change the projected ship, so the design is written again.
    if (options.resync) await this.#resyncInstalled();
  }

  /** Project the saved current design, with installed modules and breakaways folded in. */
  #openProjection() {
    const blueprint = this.actor.system?.blueprint;
    const designs = blueprint?.designs ?? [];
    const current = designs.find((design) => design.id === blueprint?.currentId);
    if (!current) return null;
    try {
      return withInstalledBreakaways(
        this.actor,
        withInstalledModules(
          this.actor,
          projectShip(
            current,
            [...designs, ...(blueprint.modules ?? [])],
            this.actor.system?.spacecraft?.hullOptions ?? ""
          ),
          current
        )
      );
    } catch (error) {
      console.error(`${MODULE_ID} could not read the open design`, error);
      return null;
    }
  }

  /** Breakaway hulls on this ship, attached or not, and the displacement of the attached ones. */
  #breakawayListing() {
    const open = isBreakawayBlueprint(this.actor);
    const bay = this.actor.system?.breakawayBay ?? {};
    const cards = [];
    let tons = 0;
    for (const [actorId, entry] of Object.entries(bay)) {
      const actor = game.actors?.get(actorId);
      if (!actor || !isBreakawayBlueprint(actor)) continue;
      const quantity = Math.max(1, Math.round(Number(entry?.quantity) || 1));
      const attached = isBreakawayAttached(entry);
      const size = shipTons(actor);
      if (attached) tons += size * quantity;
      cards.push({
        actorId,
        name: quantity > 1 ? `${actor.name} x${quantity}` : actor.name,
        img: actor.img,
        tons: size,
        quantity,
        attached,
        status: attached ? "Attached" : "Detached"
      });
    }
    return {
      open,
      tons: Math.round(tons * 100) / 100,
      cards,
      hasCards: cards.length > 0
    };
  }

  /** Add a dragged breakaway hull to the list, attached. A hull already listed is attached again. */
  async #addBreakaway(actor) {
    // Joining uses a second actor.
    if (actor.id === this.actor.id) {
      ui.notifications?.warn("A ship cannot join itself.");
      return;
    }
    // Joining requires the carrier to be a breakaway hull.
    if (!isBreakawayBlueprint(this.actor)) {
      ui.notifications?.warn("Only a breakaway hull can carry other breakaway hulls.");
      return;
    }
    const current = this.actor.system?.breakawayBay?.[actor.id];
    if (current && isBreakawayAttached(current)) return;
    const quantity = Math.max(1, Math.round(Number(current?.quantity) || 1));
    await this.#setBreakaway(actor.id, { quantity, attached: true });
  }

  /** Mark a listed hull attached and fold it into the combined ship. */
  async #attachBreakaway(actorId) {
    const current = this.actor.system?.breakawayBay?.[actorId];
    if (!current || isBreakawayAttached(current)) return;
    const quantity = Math.max(1, Math.round(Number(current.quantity) || 1));
    await this.#setBreakaway(actorId, { quantity, attached: true });
  }

  /** Mark a listed hull detached. The card stays so it can be attached again. */
  async #detachBreakaway(actorId) {
    const current = this.actor.system?.breakawayBay?.[actorId];
    if (!current || !isBreakawayAttached(current)) return;
    const quantity = Math.max(1, Math.round(Number(current.quantity) || 1));
    await this.#setBreakaway(actorId, { quantity, attached: false });
  }

  /** Write one breakaway list entry. A null entry removes the hull from the list. */
  async #setBreakaway(actorId, entry) {
    const change = entry == null
      ? { [`system.breakawayBay.-=${actorId}`]: null }
      : {
        [`system.breakawayBay.${actorId}`]: {
          quantity: Math.max(1, Math.round(Number(entry.quantity) || 1)),
          attached: entry.attached !== false
        }
      };
    await this.actor.update(change, { render: false });
    await this.#resyncInstalled();
  }

  /** Remove a hull from the breakaway list and project the ship again. */
  async #clearBreakaway(actorId) {
    // A hull spawned from this design is removed from that list, or the next projection joins it again.
    if (await this.#detachSpawnedBreakaway(actorId)) return;
    await this.#setBay("breakawayBay", actorId, null, { render: false, resync: true });
  }

  /**
   * Take one spawned copy of this hull off the carrier design, then delete that actor.
   * Returns false when the hull was dropped on the sheet rather than spawned from the design.
   */
  async #detachSpawnedBreakaway(actorId) {
    const child = game.actors?.get(actorId);
    const designId = child?.getFlag?.(MODULE_ID, "breakawayDesign") ??
      child?.flags?.[MODULE_ID]?.breakawayDesign;
    const parentId = child?.getFlag?.(MODULE_ID, "breakawayParent") ??
      child?.flags?.[MODULE_ID]?.breakawayParent;
    if (!child || parentId !== this.actor.id || !designId) return false;
    const { design, catalog } = this.#designSource();
    const hulls = [...(design?.breakawayHulls ?? [])];
    const index = hulls.indexOf(designId);
    if (!design || index < 0) return false;
    const next = structuredClone(design);
    next.breakawayHulls = hulls.filter((_, item) => item !== index);
    const modules = catalog.filter((row) => row?.id !== next.id);
    const bay = { ...(this.actor.system?.breakawayBay ?? {}) };
    delete bay[actorId];
    // The saved design drops this hull before the actor is deleted, so a refresh does not join it again.
    this.receiveDesign(next, modules);
    await this.actor.update({
      "system.blueprint.currentId": next.id,
      "system.blueprint.designs": [next],
      "system.blueprint.modules": modules,
      "system.breakawayBay": bay
    }, { render: false, diff: false, [SYNC_OPTION]: true });
    await deleteSpawned(child);
    await this.#commit(next, modules);
    return true;
  }

  /** Project the current design again so installed modules and breakaways fold into the ship. */
  async #resyncInstalled() {
    const { design, catalog } = this.#designSource();
    if (!design) return;
    await this.#commit(design, catalog.filter((row) => row?.id !== design.id));
  }

  /** Add a dragged ship to the dock, docked. A ship already listed is docked again. */
  async #addDocked(actor) {
    // Docking uses a second ship.
    if (actor.id === this.actor.id) {
      ui.notifications?.warn("A ship cannot dock with itself.");
      return;
    }
    const current = this.actor.system?.docks?.[actor.id];
    // A ship already in a bay stays as it is.
    if (current && isDocked(current)) return;
    const quantity = Math.max(1, Math.round(Number(current?.quantity) || 1));
    if (!this.#dockFits(actor, quantity)) return;
    await this.#setDock(actor.id, { quantity, docked: true });
  }

  /** Add a dragged vehicle to the dock, docked. A vehicle already listed is docked again. */
  async #addVehicle(actor) {
    if (!actor || actor.id === this.actor.id) return;
    const current = this.actor.system?.docks?.[actor.id];
    // A vehicle already in a bay stays as it is.
    if (current && isDocked(current)) return;
    const quantity = Math.max(1, Math.round(Number(current?.quantity) || 1));
    const tons = vehicleTons(actor);
    if (!(tons > 0)) {
      ui.notifications?.warn("This vehicle has no shipping size.");
      return;
    }
    const held = this.#heldVehicles().filter((row) => row.actorId !== actor.id);
    const waiting = quantity > 1
      ? [{ actorId: `${actor.id}:waiting`, quantity: quantity - 1, tons }]
      : [];
    const result = dockShipResult(this.#openVehicleBays(), [...held, ...waiting], actor.id, tons);
    if (result !== "ok") {
      ui.notifications?.warn(VEHICLE_NOTE[result]);
      return;
    }
    await this.#setDock(actor.id, { quantity, docked: true });
  }

  /** True when this many copies fit bays that docked ships have not taken. A warning explains a refusal. */
  #dockFits(actor, quantity) {
    const held = this.#heldShips().filter((row) => row.actorId !== actor.id);
    const tons = shipTons(actor);
    // Copies after the first are already waiting, so the last copy is the one tested.
    const waiting = quantity > 1
      ? [{ actorId: `${actor.id}:waiting`, quantity: quantity - 1, tons }]
      : [];
    const result = dockShipResult(this.#openBays(), [...held, ...waiting], actor.id, tons);
    if (result === "ok") return true;
    ui.notifications?.warn(DOCK_NOTE[result]);
    return false;
  }

  /** Mark a listed ship launched. The card stays so it can be docked again. */
  async #launchShip(actorId) {
    const current = this.actor.system?.docks?.[actorId];
    if (!current || !isDocked(current)) return;
    const quantity = Math.max(1, Math.round(Number(current.quantity) || 1));
    await this.#setDock(actorId, { quantity, docked: false });
  }

  /** Write one dock list entry. A null entry removes the ship from the list. */
  async #setDock(actorId, entry) {
    const change = entry == null
      ? { [`system.docks.-=${actorId}`]: null }
      : {
        [`system.docks.${actorId}`]: {
          quantity: Math.max(1, Math.round(Number(entry.quantity) || 1)),
          docked: entry.docked !== false
        }
      };
    await this.actor.update(change);
  }

  /** Remove a ship from the docks. */
  async #clearDocked(actorId) {
    await this.#setDock(actorId, null);
  }
}

/** Sheet warnings keyed by the code from dockShipResult. */
const DOCK_NOTE = {
  empty: "This design has no open docking bay.",
  large: "This ship is larger than the docking bays.",
  small: "This ship is smaller than the docking clamps.",
  range: "This ship does not fit an open clamp or bay.",
  full: "The open docking bays are already full."
};

/** Sheet warnings for a vehicle that does not fit a vehicle bay. */
const VEHICLE_NOTE = {
  empty: "This design has no open vehicle bay.",
  large: "This vehicle is larger than the vehicle bays.",
  small: "This vehicle is smaller than the vehicle bays.",
  range: "This vehicle does not fit an open vehicle bay.",
  full: "The open vehicle bays are already full."
};

/** Module id of the package that supplies the selected system and systems in jump range. */
const ASTRO_ID = "traveller-astrogation";

/** The active astrogation API, or null when that module or its system methods are unavailable. */
function astrogationApi() {
  const mod = game.modules?.get?.(ASTRO_ID);
  if (!mod?.active) return null;
  const api = mod.api;
  if (typeof api?.selectedSystem !== "function" || typeof api?.systemsWithin !== "function") return null;
  return api;
}

/** A stored sector and hex, with world coordinates when those numbers are finite. */
function storedPlace(value) {
  if (!value || typeof value !== "object") return null;
  const sector = String(value.sector ?? "").trim();
  const hex = String(value.hex ?? "").trim();
  // A place needs both a sector and a hex.
  if (!sector || !hex) return null;
  const worldX = Number(value.worldX);
  const worldY = Number(value.worldY);
  return {
    name: String(value.name ?? "").trim(),
    sector,
    hex,
    worldX: Number.isFinite(worldX) ? worldX : null,
    worldY: Number.isFinite(worldY) ? worldY : null
  };
}

/** Redraw each open blueprint sheet when the selected astrogation system changes. */
Hooks.on("traveller-astrogation.selection", () => {
  for (const sheet of openSheets) {
    if (sheet.rendered) sheet.render(false);
  }
});

/** Sheet warnings keyed by the code from moduleSpace. */
const MODULE_NOTE = {
  empty: "This design has no module bay.",
  large: "This module does not match an open module bay.",
  full: "Every module bay of this size already holds a module."
};

/** A Mongoose spacecraft or a blueprint ship. */
function isShipActor(actor) {
  return actor?.type === "spacecraft" || actor?.type === SHIP_TYPE;
}

/** The design selected on the actor, or the first saved design when that id is absent. */
function actorDesign(actor) {
  const blueprint = actor?.system?.blueprint ?? {};
  const designs = blueprint.designs ?? [];
  return designs.find((design) => design.id === blueprint.currentId) ?? designs[0] ?? null;
}

/** A blueprint ship whose current design has hull type module. */
function isModuleBlueprint(actor) {
  return actor?.type === SHIP_TYPE && actorDesign(actor)?.hullType === "module";
}

/** A blueprint ship whose current design is a breakaway hull. */
function isBreakawayBlueprint(actor) {
  return actor?.type === SHIP_TYPE && isBreakawayDesign(actorDesign(actor));
}

/** Fold installed module actors into the ship projection. Only copies that match a bay contribute. */
export function withInstalledModules(actor, projection, design) {
  const bays = moduleBays(design ?? actorDesign(actor));
  const bay = actor?.system?.moduleBay ?? {};
  const held = [];
  for (const [actorId, entry] of Object.entries(bay)) {
    // A module entry for this same actor is passed over.
    if (actorId === actor?.id) continue;
    const other = game.actors?.get(actorId);
    const moduleDesign = actorDesign(other);
    // A bay entry contributes when the actor is a module blueprint.
    if (!other || moduleDesign?.hullType !== "module") continue;
    const catalog = [moduleDesign, ...(other.system?.blueprint?.modules ?? [])];
    held.push({
      id: actorId,
      tons: shipTons(other),
      quantity: Math.max(1, Math.round(Number(entry?.quantity) || 1)),
      design: moduleDesign,
      catalog,
      hullOptions: other.system?.spacecraft?.hullOptions ?? ""
    });
  }
  const packed = assignModuleBays(bays, held);
  const quantityOf = new Map(packed.fitted.map((row) => [row.id, row.quantity]));
  // Fitted quantity is the number of copies that matched a bay, which can be below the stored count.
  return applyModules(
    projection,
    held.filter((row) => quantityOf.has(row.id)).map((row) => ({
      ...row,
      quantity: quantityOf.get(row.id)
    }))
  );
}

/** Fold breakaway actors into the ship. A hull is joined once, including hulls it carries. */
export function withInstalledBreakaways(actor, projection, seen = new Set()) {
  // Joined hulls fold in when this design is a breakaway hull.
  if (!isBreakawayDesign(actorDesign(actor))) return projection;
  // This walk's own copy of the seen set. Nested hulls share it, so each hull is joined once.
  const claimed = new Set(seen);
  if (actor?.id) claimed.add(actor.id);
  const joined = [];
  for (const [actorId, entry] of Object.entries(actor?.system?.breakawayBay ?? {})) {
    // This hull is already claimed on the walk.
    if (claimed.has(actorId)) continue;
    // A detached hull stays listed and is left out of the combined ship.
    if (!isBreakawayAttached(entry)) continue;
    const other = game.actors?.get(actorId);
    const design = actorDesign(other);
    if (!other || !isBreakawayDesign(design)) continue;
    claimed.add(actorId);
    const catalog = [design, ...(other.system?.blueprint?.modules ?? [])];
    let nested;
    try {
      nested = projectShip(
        design,
        catalog,
        other.system?.spacecraft?.hullOptions ?? ""
      );
    } catch (error) {
      console.error(`${MODULE_ID} could not read a breakaway hull`, error);
      // A hull that fails to project stays out of the join.
      continue;
    }
    nested = withInstalledModules(other, nested, design);
    nested = withInstalledBreakaways(other, nested, claimed);
    joined.push({
      id: actorId,
      name: other.name || design.name || "Breakaway hull",
      quantity: Math.max(1, Math.round(Number(entry?.quantity) || 1)),
      projection: nested
    });
  }
  return applyBreakaways(projection, joined);
}

/** A list entry is attached unless it was explicitly detached. Entries saved before that flag stay joined. */
export function isBreakawayAttached(entry) {
  return entry?.attached !== false;
}

/** A dock entry occupies a bay unless it was explicitly launched. Entries saved before that flag stay docked. */
function isDocked(entry) {
  return entry?.docked !== false;
}

/** True when a listed breakaway hull is attached. Drive ratings then come from the combined projection. */
function hasJoinedHulls(actor) {
  return Object.values(actor?.system?.breakawayBay ?? {}).some(isBreakawayAttached);
}

/** Clamp tonnage window. A plain bay shows a blank span, and an unbounded clamp shows the minimum and up. */
function baySpan(bay) {
  if (!bay.clamp) return "";
  const min = bay.minTons ?? 0;
  // No finite maximum, so the label starts at the minimum tonnage.
  if (!Number.isFinite(bay.tons)) return `${min} or more`;
  return `${min}–${bay.tons}`;
}

/** Hull displacement in tons. A missing or non-numeric value is zero. */
function shipTons(actor) {
  const tons = Number(actor?.system?.spacecraft?.dtons);
  return Number.isFinite(tons) ? tons : 0;
}

/** Shipping size of a vehicle, in tons. A missing value is zero, and that vehicle cannot dock. */
function vehicleTons(actor) {
  const tons = Number(actor?.system?.vehicle?.shipping);
  return Number.isFinite(tons) ? tons : 0;
}

/** Whole tons print as integers. Fractional tons print to the hundredth. */
function bayLabel(tons) {
  const value = Number(tons) || 0;
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** True when two tonnages match a module bay, to the hundredth of a ton. */
function sameTons(left, right) {
  const bay = Math.round((Number(right) || 0) * 100);
  const module = Math.round((Number(left) || 0) * 100);
  return bay > 0 && module === bay;
}

/** True when the flag key names a fuel-cargo container, including a module prefix or a further tank. */
function isFuelCargoKey(key) {
  return /(^|:)fuel-cargo(:|$)/.test(String(key ?? ""));
}

/** The ship sheet adds fuel hardware to fuel and cargo hardware to cargo. Match each container's system to its status before that sum. */
async function settleFuelCargo(actor) {
  const items = actor?.items?.filter?.((item) => isFuelCargoKey(item.getFlag(MODULE_ID, "key"))) ??
    [];
  for (const item of items) {
    const want = item.system?.status === "INACTIVE" ? "cargo" : "fuel";
    if (item.system?.hardware?.system === want) continue;
    await item.update({ "system.hardware.system": want }, { render: false });
  }
}

/** True when a sheet-context item's flag key names a fuel-cargo container. */
function isFuelCargo(item) {
  return isFuelCargoKey(item?.flags?.[MODULE_ID]?.key);
}

/** The blueprint flag key on a sheet item, or an empty string when the item has none. */
function itemKey(item) {
  return String(item?.flags?.[MODULE_ID]?.key ?? "");
}

/** Ship Core matchers placed before the solar coating, in order: processor, aerofins, scoops, then fittings and drones. */
const CORE_BEFORE_SOLAR = [
  (key) => key === "fuel-processor" || key.endsWith(":fuel-processor"),
  (key) => key === "aerofins" || key.endsWith(":aerofins"),
  (key) => key === "scoops" || key.endsWith(":scoops"),
  (key) => /(^|:)fitting:/.test(key) || /(^|:)drone:/.test(key)
];

/** Ship Core matchers placed after the solar coating: modular fittings, pressure, and grav. */
const CORE_AFTER_SOLAR = [
  (key) => /(^|:)modular:/.test(key),
  (key) => /(^|:)pressure:/.test(key),
  (key) => /(^|:)grav:/.test(key)
];

/** Move each pattern into Ship Core, in pattern order, so the groups stay as they were. */
function placeListedCore(context, patterns) {
  for (const test of patterns) {
    moveToCore(context, (item) => test(itemKey(item)));
  }
}

/** True when the item key names a solar coating. */
function isSolar(item) {
  return /(^|:)solar:/.test(itemKey(item));
}

/** The item tons are hull covered by the coating. The coating itself takes no space. */
function placeSolar(context) {
  moveToCore(context, isSolar);
  let covered = 0;
  for (const item of context.coreItems ?? []) {
    if (!isSolar(item)) continue;
    covered += Number(item.system?.hardware?.tons) || 0;
  }
  covered = Math.round(covered * 100) / 100;
  if (covered <= 0) return;
  context.dtonsUsed = Math.round((Number(context.dtonsUsed) - covered) * 100) / 100;
  context.dtonsRemaining = Math.round(
    (Number(context.dtonsRemaining) + covered) * 1000
  ) / 1000;
}

/** Move matching items from the general, cargo, and living lists onto the end of Ship Core. */
function moveToCore(context, matches) {
  context.coreItems ??= [];
  for (const list of [context.generalItems, context.cargoItems, context.livingItems]) {
    if (!Array.isArray(list)) continue;
    // Counting down keeps each remaining index valid after a splice.
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (!matches(list[index])) continue;
      context.coreItems.push(list.splice(index, 1)[0]);
    }
  }
}

/** Keep containers under Ship Core, and count the extra hull space their capacity does not cover. */
function placeFuelCargo(context) {
  context.coreItems ??= [];
  for (const list of [context.cargoItems, context.generalItems]) {
    if (!Array.isArray(list)) continue;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (!isFuelCargo(list[index])) continue;
      context.coreItems.push(list.splice(index, 1)[0]);
    }
  }
  let extra = 0;
  for (const item of context.coreItems) {
    if (!isFuelCargo(item)) continue;
    const rating = Number(item.system?.hardware?.rating) || 0;
    const tons = Number(item.system?.hardware?.tons) || 0;
    // Hull tons above the rated capacity still occupy the ship.
    extra += Math.max(0, tons - rating);
  }
  extra = Math.round(extra * 1000) / 1000;
  if (extra <= 0) return;
  context.dtonsUsed = Math.round((Number(context.dtonsUsed) + extra) * 1000) / 1000;
  context.dtonsRemaining = Math.round(
    (Number(context.dtonsRemaining) - extra) * 1000
  ) / 1000;
}

/** The hold id on a cargo lot, from the flags object or from getFlag on a live item. */
function cargoHold(item) {
  return item?.flags?.[MODULE_ID]?.hold ?? item?.getFlag?.(MODULE_ID, "hold") ?? "";
}

/** Sum cargo lots into the load object the drive and jump formulas consume. */
function cargoLoad(actor) {
  const held = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "cargo") continue;
    held.push({
      hold: cargoHold(item),
      tons: Number(item.system?.quantity) || 0
    });
  }
  return externalLoad(held);
}

/** Jump and maneuver ratings of the active drives, before cargo and clamps reduce them. */
function installedDrives(actor) {
  return {
    jump: driveRating(actor, "j-drive"),
    maneuver: driveRating(actor, "m-drive")
  };
}

/** The rating the stock sheet will copy onto the ship from an active drive. */
function driveRating(actor, system) {
  let rating = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== "hardware") continue;
    const hardware = item.system?.hardware;
    if (!hardware || hardware.system !== system) continue;
    if (item.system?.status !== "ACTIVE") continue;
    const value = Number.parseInt(hardware.rating, 10);
    if (!Number.isFinite(value)) continue;
    // A concealed maneuver drive shows half its rating, truncated.
    const shown = system === "m-drive" && hardware.concealedDrive
      ? Number.parseInt(String(value / 2), 10)
      : value;
    if (shown > rating) rating = shown;
  }
  return rating;
}

/** True when the key is cargo-handling gear. Its tons are fittings, counted in displacement. */
function isCargoHandling(key) {
  return key.startsWith("handling:") || key.includes(":handling:");
}

/** Module fittings sit inside the reserved modular hull, so their tons are not counted again. */
function releaseEnclosed(context, projection) {
  const enclosed = Number(projection?.enclosedTons) || 0;
  if (enclosed <= 0) return;
  context.dtonsUsed = Math.round((Number(context.dtonsUsed) - enclosed) * 100) / 100;
  context.dtonsRemaining = Math.round(
    (Number(context.dtonsRemaining) + enclosed) * 1000
  ) / 1000;
}

/** One capacity line per hold. External holds do not consume internal displacement. */
function presentCargoSpaces(context) {
  const internal = { key: "cargo", name: "Cargo Hold", capacity: 0 };
  const external = [];
  let outside = 0;
  let fittings = 0;
  for (const item of context.cargoItems ?? []) {
    const key = String(item?.flags?.[MODULE_ID]?.key ?? "");
    if (isCargoHandling(key)) {
      fittings += Number(item.system?.hardware?.tons) || 0;
      continue;
    }
    const kind = cargoSpaceKind(key);
    const capacity = Number(item.system?.hardware?.rating) || 0;
    if (kind === "internal") {
      internal.name = item.name || "Cargo Hold";
      internal.capacity = capacity;
    // Breakaway cargo keeps its own line, and its capacity stays in this displacement.
    } else if (kind === "breakaway") {
      external.push({ key, name: item.name || "Breakaway cargo", capacity });
    // External, jump-net, and planetary capacity sit outside the hull.
    } else if (kind) {
      outside += capacity;
      external.push({ key, name: item.name || kind, capacity });
    }
  }
  const spaces = [internal, ...external];
  const used = new Map(spaces.map((space) => [space.key, 0]));
  for (const lot of context.cargo ?? []) {
    const flagged = String(cargoHold(lot));
    // A lot counts against a hold id that matches a space, and an unmatched id counts as internal cargo.
    const key = used.has(flagged) ? flagged : "cargo";
    used.set(key, (used.get(key) ?? 0) + (Number(lot.system?.quantity) || 0));
    lot.holdChoices = spaces.map((space) => ({
      key: space.key,
      name: space.name,
      selected: space.key === key
    }));
    // The hold picker appears when the ship lists more than one hold.
    lot.showHold = spaces.length > 1;
  }
  context.cargoSpaces = spaces.map((space) => {
    const spaceUsed = Math.round((used.get(space.key) ?? 0) * 100) / 100;
    return {
      ...space,
      used: spaceUsed,
      remaining: Math.round((space.capacity - spaceUsed) * 10) / 10
    };
  });
  // External hold capacity comes out of displacement. Handling-gear tons go back in.
  if (outside <= 0 && fittings <= 0) return;
  context.dtonsUsed = Math.round(
    (Number(context.dtonsUsed) - outside + fittings) * 100
  ) / 100;
  context.dtonsRemaining = Math.round(
    (Number(context.dtonsRemaining) + outside - fittings) * 1000
  ) / 1000;
}

/** Active jump drives whose stored rating is not the jump this mass can make. */
function jumpItemsAt(actor, rating) {
  const items = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "hardware") continue;
    const hardware = item.system?.hardware;
    if (!hardware || hardware.system !== "j-drive") continue;
    if (item.system?.status && item.system.status !== "ACTIVE") continue;
    if (Number(hardware.rating) === rating) continue;
    items.push(item);
  }
  return items;
}

/**
 * Store the effective jump on the jump-drive item.
 * The stock sheet reads that rating for the jump label, so a fuel change alone leaves the old jump in place.
 */
async function alignJumpItem(actor, rating) {
  const jobs = jumpItemsAt(actor, rating).map((item) => item.update(
    { "system.hardware.rating": rating },
    { render: false, diff: true, [SYNC_OPTION]: true }
  ));
  if (jobs.length) await Promise.all(jobs);
}

/** Show the effective jump on the drive cards in this render. */
function paintJumpRating(context, rating) {
  const lists = [context.items, context.coreItems, context.hardware];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      const hardware = item.system?.hardware;
      if (!hardware || hardware.system !== "j-drive") continue;
      if (item.system?.status && item.system.status !== "ACTIVE") continue;
      hardware.rating = rating;
    }
  }
}

/** Fill the jump fuel line for the current rating and the loaded displacement. */
function presentJumpFuel(context, actor, projection, load) {
  const requirements = context.fuelRequirements;
  const design = actorDesign(actor);
  const ship = context.system?.spacecraft;
  if (!requirements || !design || !ship) return;
  const hull = Number(projection?.dtons) || Number(ship.dtons) || design.hullTons;
  // Loaded displacement. Cargo in an interplanetary net makes this zero.
  const mass = jumpDisplacement(hull, load ?? {});
  let jump = Number(ship.jdrive) || 0;
  const basis = Number(projection?.jumpBasis) || 0;
  // A drive built for a smaller hull cannot keep its rating once attached hulls raise the mass.
  if (projection && basis > 0 && mass > basis && Number(projection.jumpRating) > 0) {
    jump = loadedBreakawayDrives(projection, load ?? {}).jdrive;
    ship.jdrive = jump;
  }
  requirements.rating = jump;
  if (projection) {
    // Scale the projection's stored jump fuel to this rating and displacement.
    requirements.jumpFuel = breakawayJumpFuel(projection, jump, mass);
    return;
  }
  const blueprint = actor.system?.blueprint ?? {};
  // The design formula supplies jump fuel when the projection is empty.
  requirements.jumpFuel = jumpFuelUse(
    design,
    [design, ...(blueprint.designs ?? []), ...(blueprint.modules ?? [])],
    jump,
    // A zero displacement uses the hull tons in the design formula.
    mass || hull
  );
}

/** Put the load-adjusted jump and maneuver ratings on the sheet, and save them when they differ from the stored ship. */
function applyLoadedDrives(context, actor, installed, load, combined) {
  const design = actorDesign(actor);
  const ship = context.system?.spacecraft;
  if (!design || !ship) return;
  // Joined hulls take a shared rating from the combined ship and this load.
  const drives = combined
    ? loadedBreakawayDrives(combined, load)
    : effectiveDrives(design, load, {
      thrust: installed.maneuver,
      jump: installed.jump
    });
  ship.jdrive = drives.jdrive;
  ship.mdrive = drives.mdrive;
  const source = actor._source?.system?.spacecraft ?? {};
  const patch = {};
  if (source.jdrive !== drives.jdrive) patch["system.spacecraft.jdrive"] = drives.jdrive;
  if (source.mdrive !== drives.mdrive) patch["system.spacecraft.mdrive"] = drives.mdrive;
  if (Object.keys(patch).length === 0) return;
  // Persist a changed rating in place. The sync flag keeps this update from projecting the design again.
  void actor.update(patch, { render: false, diff: true, [SYNC_OPTION]: true });
}
