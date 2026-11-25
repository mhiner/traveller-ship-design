import { moduleFitsBay } from "../../src/catalog/hull.ts";
import { type AdvancedDesign, evaluateDesign } from "../../src/design.ts";
import {
  componentValue,
  projectShip,
  round3,
  sensorRank,
  solarSupply,
  type ShipPiece,
  type ShipProjection
} from "./project.ts";

/** One of each. A module contributes the higher one, and does not add a second. */
const SINGLE_KEYS = new Set([
  "sensors"
]);

/** A module design has none of these, even when the ship projection would. */
const MODULE_OMITTED = new Set([
  "j-drive",
  "m-drive",
  "armour",
  "computer",
  "bridge"
]);

/** A module waiting for a bay: its id, hull tons, and how many copies are aboard. */
export interface ModuleLoad {
  id: string;
  tons: number;
  quantity: number;
}

/** A module design installed in quantity, evaluated with its own catalog when one is set. */
export interface InstalledModule {
  id: string;
  quantity: number;
  design: AdvancedDesign;
  catalog?: readonly AdvancedDesign[];
  hullOptions?: string;
}

/** Hundredths of a ton, so summed bay sizes round to two decimal places. */
function cents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

/** True for an external hold, a jump net, or a planetary net. */
function isExternalHold(key: string): boolean {
  return key.includes(":external:") || key.endsWith(":external") ||
    key.includes(":jumpNet:") || key.endsWith(":jumpNet") ||
    key.includes(":planetaryNet:") || key.endsWith(":planetaryNet");
}

/** True for cargo-handling gear, whose tons are real displacement inside the bay. */
function isHandling(key: string): boolean {
  return key.startsWith("handling:") || key.includes(":handling:");
}

/** Tons Foundry will add for a fitting that already sits inside a modular hull. */
export function enclosedDisplacement(piece: ShipPiece): number {
  const key = piece.key;
  if (/(^|:)solar:/.test(key) || isExternalHold(key)) return 0;
  const tons = piece.tons ?? 0;
  const rating = piece.rating ?? 0;
  if (piece.system === "power") return 0;
  if (piece.system === "fuel") return Math.max(tons, rating);
  if (piece.system === "cargo") return isHandling(key) ? tons : rating;
  return tons;
}

/** Adds a piece's enclosed tons, times its quantity, onto the projection. */
function addEnclosed(projection: ShipProjection, piece: ShipPiece, quantity = 1) {
  const tons = enclosedDisplacement(piece) * quantity;
  // Zero displacement leaves the running total alone.
  if (tons === 0) return;
  projection.enclosedTons = round3((projection.enclosedTons ?? 0) + tons);
}

/** One module per bay, and only when that module is the same size as the bay. */
export function moduleActorSlots<T extends {
  id: string;
  hullTons?: number;
  hullType?: string;
  hullOptions?: { kind?: string; tons?: number; modules?: string[] }[];
}>(
  design: T | null | undefined,
  catalog: readonly T[]
): T[] {
  const slots: T[] = [];
  for (const option of design?.hullOptions ?? []) {
    if (option?.kind !== "modular") continue;
    const id = option.modules?.[0];
    if (!id) continue;
    const hull = catalog.find((row) => row.id === id);
    if (!hull || hull.id === design?.id || hull.hullType !== "module") continue;
    if (!moduleFitsBay(hull.hullTons ?? 0, option.tons ?? 0)) continue;
    slots.push(hull);
  }
  return slots;
}

/** One modular-hull bay and the tons that bay accepts. */
export interface ModuleBay {
  id: string;
  tons: number;
}

/** Each modular hull is its own bay. Bays do not share leftover tonnage. */
export function moduleBays(
  design: { hullOptions?: { id?: string; kind?: string; tons?: number }[] } | null | undefined
): ModuleBay[] {
  const bays: ModuleBay[] = [];
  for (const option of design?.hullOptions ?? []) {
    if (option?.kind !== "modular") continue;
    const tons = Number(option.tons);
    if (!Number.isFinite(tons) || tons <= 0) continue;
    bays.push({ id: String(option.id ?? bays.length), tons });
  }
  return bays;
}

/** Tons of modular hull on the design. Each bay is spent whole. */
export function moduleCapacity(
  design: { hullOptions?: { kind?: string; tons?: number }[] } | null | undefined
): number {
  return cents(moduleBays(design).reduce((sum, bay) => sum + bay.tons, 0)) / 100;
}

/** The first open bay whose size matches the module exactly. */
function takeBay(
  bays: readonly ModuleBay[],
  tons: number,
  taken: Set<string>
): ModuleBay | undefined {
  return bays.find((bay) => !taken.has(bay.id) && moduleFitsBay(tons, bay.tons));
}

/** Whether one more module of `addTons` has an open bay of that exact size. */
export function moduleSpace(
  bays: readonly ModuleBay[],
  held: readonly { tons: number; quantity: number }[],
  addTons: number
): "ok" | "empty" | "large" | "full" {
  if (bays.length === 0) return "empty";
  if (!bays.some((bay) => moduleFitsBay(addTons, bay.tons))) return "large";
  const open = assignModuleBays(
    bays,
    held.map((row, index) => ({ id: String(index), tons: row.tons, quantity: row.quantity }))
  ).open;
  return open.some((bay) => moduleFitsBay(addTons, bay.tons)) ? "ok" : "full";
}

/** One copy per matching bay. A second copy, or a different size, stays unplaced. */
export function assignModuleBays(
  bays: readonly ModuleBay[],
  held: readonly ModuleLoad[]
): { fitted: ModuleLoad[]; unplaced: ModuleLoad[]; open: ModuleBay[] } {
  const taken = new Set<string>();
  const fitted = new Map<string, ModuleLoad>();
  const unplaced = new Map<string, ModuleLoad>();
  const copies = [...held].sort((a, b) => a.id.localeCompare(b.id));
  for (const row of copies) {
    const quantity = Math.max(0, Math.round(row.quantity));
    for (let count = 0; count < quantity; count += 1) {
      const bay = takeBay(bays, row.tons, taken);
      const target = bay ? fitted : unplaced;
      if (bay) taken.add(bay.id);
      const current = target.get(row.id) ?? { id: row.id, tons: row.tons, quantity: 0 };
      current.quantity += 1;
      target.set(row.id, current);
    }
  }
  return {
    fitted: [...fitted.values()],
    unplaced: [...unplaced.values()],
    open: bays.filter((bay) => !taken.has(bay.id))
  };
}

/** Sensors rank by suite order in the catalog. Other pieces rank by their rating. */
function pieceRank(piece: ShipPiece | undefined): number {
  if (!piece) return 0;
  if (piece.key === "sensors") return sensorRank(piece.name);
  return piece.rating ?? 0;
}

/** Pieces the module design actually contains. Hidden ship systems on a module are left out. */
function containedPieces(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[],
  projection: ShipProjection
): ShipPiece[] {
  const sheet = evaluateDesign(design, catalog);
  const names = new Set(sheet.lines.map((line) => line.name));
  return projection.pieces.filter((piece) => {
    if (MODULE_OMITTED.has(piece.key)) return false;
    // Scoops occupy no tons. They count when the sheet still names them.
    if (piece.key === "scoops") return names.has(piece.name);
    if (!componentValue(piece)) return false;
    // A hold is kept when the module sheet has cargo tons.
    if (piece.key === "cargo") return sheet.cargo > 0;
    // The piece name includes the daily rate, so a processor is kept by its key.
    if (piece.key === "fuel-processor") return true;
    return names.has(piece.name);
  });
}

/** Programs that appear as software lines on the module's design sheet. */
function containedSoftware(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[],
  projection: ShipProjection
) {
  const names = new Set(
    evaluateDesign(design, catalog).lines.filter((line) => line.role === "software")
      .map((line) => line.name)
  );
  return projection.software.filter((program) => names.has(program.name));
}

/** Scales rating, tons, cost, and power. A fuel processor's rating is 20 tons per day for each ton of processor. */
function scalePiece(piece: ShipPiece, factor: number, key: string): ShipPiece {
  const next = structuredClone(piece);
  next.key = key;
  next.quantity = 1;
  if (factor === 1) return next;
  for (const field of ["rating", "tons", "cost", "power"] as const) {
    const value = next[field];
    if (typeof value === "number") next[field] = round3(value * factor);
  }
  if (key === "fuel-processor" || key.endsWith(":fuel-processor")) {
    const rate = Math.round(next.tons ?? 0) * 20;
    next.rating = rate;
    next.name = `Fuel processor (${rate} tons/day)`;
  }
  return next;
}

/** Weapons and mounts are copied once per install so each attachment list stays on its own item. */
function duplicatePiece(piece: ShipPiece): boolean {
  return piece.type === "weapon" || piece.system === "weapon" ||
    (piece.attaches?.length ?? 0) > 0;
}

/** Add a module's fuel, cargo, or power output onto the ship's own item. */
function addCapacity(
  projection: ShipProjection,
  key: "fuel" | "cargo" | "power",
  piece: ShipPiece,
  quantity: number
) {
  const amount = round3((piece.rating ?? 0) * quantity);
  // A zero contribution leaves the ship item unchanged.
  if (amount === 0) return;
  let target = projection.pieces.find((row) => row.key === key);
  if (!target) {
    target = {
      key,
      type: "hardware",
      name: key === "fuel" ? "Fuel tank" : key === "cargo" ? "Cargo Hold" : piece.name,
      system: key,
      rating: 0,
      tons: 0,
      cost: 0,
      power: 0,
      quantity: 1
    };
    projection.pieces.push(target);
  }
  target.rating = round3((target.rating ?? 0) + amount);
  // Power output raises the rating. Fuel and cargo tons follow that rating.
  if (key !== "power") target.tons = target.rating;
  if (typeof piece.cost === "number") {
    target.cost = round3((target.cost ?? 0) + piece.cost * quantity);
  }
  if (key === "fuel") projection.fuelMax = round3(projection.fuelMax + amount);
  else if (key === "cargo") projection.cargo = round3(projection.cargo + amount);
  else projection.powerMax = round3(projection.powerMax + amount);
}

/** Replaces a ship piece in place and copies its rating onto the matching ship field. Armour adds only the change in rating. */
function adopt(projection: ShipProjection, piece: ShipPiece) {
  const existing = projection.pieces.find((row) => row.key === piece.key);
  const previous = existing?.rating ?? 0;
  if (existing) {
    const key = existing.key;
    Object.assign(existing, structuredClone(piece), { key });
  } else {
    projection.pieces.push(structuredClone(piece));
  }
  if (piece.key === "computer") {
    projection.processing = piece.rating ?? projection.processing;
    projection.computerBis = piece.bis === true;
    projection.computerFib = piece.fib === true;
  } else if (piece.key === "j-drive") {
    projection.jdrive = piece.rating ?? 0;
  } else if (piece.key === "m-drive") {
    projection.mdrive = piece.rating ?? 0;
  } else if (piece.key === "armour") {
    projection.armour = round3(projection.armour + (piece.rating ?? 0) - previous);
  }
}

/** Evaluates one module. A design the evaluator rejects contributes nothing. */
function projectModule(module: InstalledModule): ShipProjection | null {
  const catalog = module.catalog ?? [module.design];
  try {
    return projectShip(module.design, catalog, module.hullOptions ?? "");
  } catch {
    return null;
  }
}

/** True for a fuel/cargo container, including one already copied onto the ship. */
function isFuelCargoKey(key: string): boolean {
  return /(^|:)fuel-cargo(:|$)/.test(key);
}

/** One actor item per container copy, at the container's own tonnage. */
function copyContainers(
  next: ShipProjection,
  module: InstalledModule,
  piece: ShipPiece,
  quantity: number
) {
  for (let copy = 0; copy < quantity; copy += 1) {
    const container = scalePiece(
      piece,
      1,
      `module:${module.id}:${copy}:${piece.key}`
    );
    addEnclosed(next, container);
    next.pieces.push(container);
  }
}

/** Keeps the higher-ranked piece of a single system and adds only the extra enclosed tons. */
function keepHigher(next: ShipProjection, piece: ShipPiece) {
  const current = next.pieces.find((row) => row.key === piece.key);
  // An equal or lower suite leaves the ship's piece in place.
  if (pieceRank(piece) <= pieceRank(current)) return;
  const before = current ? enclosedDisplacement(current) : 0;
  adopt(next, piece);
  const adopted = next.pieces.find((row) => row.key === piece.key);
  const extra = (adopted ? enclosedDisplacement(adopted) : 0) - before;
  if (extra > 0) next.enclosedTons = round3((next.enclosedTons ?? 0) + extra);
}

/** One actor item per copy, with attachment keys rewritten onto that copy. */
function copyEach(
  next: ShipProjection,
  module: InstalledModule,
  piece: ShipPiece,
  quantity: number
) {
  for (let copy = 0; copy < quantity; copy += 1) {
    const prefix = `module:${module.id}:${copy}:`;
    const cloned = scalePiece(piece, 1, `${prefix}${piece.key}`);
    cloned.attaches = piece.attaches?.map((key) => `${prefix}${key}`);
    addEnclosed(next, cloned);
    next.pieces.push(cloned);
  }
}

/** One actor item whose rating, tons, cost, and power are multiplied by the install count. */
function scaleInto(
  next: ShipProjection,
  module: InstalledModule,
  piece: ShipPiece,
  quantity: number
) {
  const installed = scalePiece(piece, quantity, `module:${module.id}:${piece.key}`);
  addEnclosed(next, installed);
  next.pieces.push(installed);
  // Coating supply is added onto the ship's power total.
  if (/(^|:)solar:/.test(piece.key)) {
    next.powerMax = round3(next.powerMax + solarSupply([installed]));
  }
}

/** Routes one module piece onto the ship. Quantity is the number of installed copies. */
function installPiece(
  next: ShipProjection,
  module: InstalledModule,
  piece: ShipPiece,
  quantity: number
) {
  if (piece.key === "fuel" || piece.key === "cargo") {
    // Tanks and holds add to the ship's own item and count as enclosed tons.
    addEnclosed(next, piece, quantity);
    addCapacity(next, piece.key, piece, quantity);
    return;
  }
  if (isFuelCargoKey(piece.key)) {
    // Each fuel/cargo container stays its own item.
    copyContainers(next, module, piece, quantity);
    return;
  }
  if (piece.key === "power") {
    // Plant output is added to the ship's power item.
    addCapacity(next, "power", piece, quantity);
    return;
  }
  if (SINGLE_KEYS.has(piece.key)) {
    keepHigher(next, piece);
    return;
  }
  if (duplicatePiece(piece)) {
    copyEach(next, module, piece, quantity);
    return;
  }
  scaleInto(next, module, piece, quantity);
}

/** Copies module programs, keeping the first program of each key. */
function mergeModuleSoftware(
  next: ShipProjection,
  seen: Set<string>,
  module: InstalledModule,
  projected: ShipProjection
) {
  const catalog = module.catalog ?? [module.design];
  for (const program of containedSoftware(module.design, catalog, projected)) {
    if (seen.has(program.key)) continue;
    seen.add(program.key);
    next.software.push(structuredClone(program));
  }
}

/**
 * Add a module's components to a ship projection.
 * Fuel tanks, cargo holds, and power-plant output are added to the ship.
 * A module fuel/cargo container stays its own item: active adds to fuel, inactive adds to cargo.
 * A single system, such as sensors, keeps whichever side is higher.
 */
export function applyModules(
  ship: ShipProjection,
  installed: readonly InstalledModule[]
): ShipProjection {
  const next = structuredClone(ship);
  next.enclosedTons = next.enclosedTons ?? 0;
  const software = new Set(next.software.map((program) => program.key));
  for (const module of installed) {
    const quantity = Math.max(0, Math.round(module.quantity));
    if (quantity < 1) continue;
    const projected = projectModule(module);
    if (!projected) continue;
    const catalog = module.catalog ?? [module.design];
    for (const piece of containedPieces(module.design, catalog, projected)) {
      installPiece(next, module, piece, quantity);
    }
    next.powerUsed = round3(next.powerUsed + projected.powerUsed * quantity);
    mergeModuleSoftware(next, software, module, projected);
  }
  return next;
}
