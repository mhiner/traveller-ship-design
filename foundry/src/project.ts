import {
  COMPUTERS,
  type ComputerTypeId,
  installedSoftware
} from "../../src/catalog/bridge.ts";
import {
  type DriveCustom,
  driveEffectiveTons,
  legalDriveOptions,
  JUMP_COST_PER_TON,
  JUMP_MIN_HULL_TONS,
  JUMP_TL,
  MANOEUVRE_COST_PER_TON,
  MANOEUVRE_TL,
  POWER_PLANTS
} from "../../src/catalog/drives.ts";
import { ADDITIONAL_SENSORS, SENSORS } from "../../src/catalog/sensors.ts";
import { AMENITIES, CARGO_GEAR, DRONE_SET_SIZE, DRONES, EXTERNAL_SYSTEMS, FITTINGS, WORK_SPACES, 
  amenityCost, amenityPower, amenityTons, forcedLinkageAt, roboticsAvatarChair, roboticsDroneController,
  roboticsFabricator, roboticsSwarmController } from "../../src/catalog/fittings.ts";
import { ARMOUR, CONFIGURATIONS, HULL_OPTIONS, type ConfigurationId, type HullOptionId, solarCoatingQuote } from "../../src/catalog/hull.ts";
import { BARBETTE_WEAPONS, MOUNT_KINDS, mountLineName, POPUP_MOUNT, TURRET_WEAPONS } from "../../src/catalog/weapons.ts";
import { containerCapacities } from "../../src/evaluate/drives.ts";
import { weaponCombat } from "./weapons.ts";
import { SHIP_CLASSIFICATIONS, type ShipClassification } from "../../src/classification.ts";
import { type AdvancedDesign, type DesignLine, blankDesign, evaluateDesign } from "../../src/design.ts";
import { type DesignShipStats, shipDesignFromAdvanced } from "../../src/toShipDesign.ts";
import { resolveAmenities, resolveCargoGear, resolveDrones, resolveExternalSystems, resolveWorkSpaces } from "../../src/resolve.ts";
import { countedName } from "../../src/evaluate/shared.ts";

/** Design hull-option ids and the actor tokens they write. */
const OPTION_TO_ACTOR: Record<string, string> = {
  heat: "heatShielding",
  radiation: "radiationShielding",
  reflec: "reflec",
  stealth: "basicStealth",
  stealthImproved: "improvedStealth",
  stealthEnhanced: "enhancedStealth",
  stealthAdvanced: "advancedStealth",
  adjustable: "adjustableHull",
  adjustable15: "adjustableHull15"
};

/** Actor tokens read back into design hull-option ids. */
const ACTOR_TO_OPTION: Record<string, HullOptionId> = {
  heatShielding: "heat",
  radiationShielding: "radiation",
  reflec: "reflec",
  basicStealth: "stealth",
  improvedStealth: "stealthImproved",
  enhancedStealth: "stealthEnhanced",
  advancedStealth: "stealthAdvanced",
  adjustableHull: "adjustable",
  adjustableHull15: "adjustable15"
};

/** Stock token left over from when solar coating was a hull pill. */
const RETIRED_HULL_TOKENS = new Set(["solarCoating"]);

/** Hull tokens this projection rewrites: the hull type and each mapped option. */
const MANAGED_HULL_TOKENS = new Set([
  "light",
  "reinforced",
  "moduleHull",
  ...Object.values(OPTION_TO_ACTOR)
]);

/** Configuration ids the design catalog accepts. */
const CONFIGURATION_IDS = new Set(CONFIGURATIONS.map((row) => row.id));

/** Label, power, cost, and tech level for each turret and barbette weapon. */
const WEAPON_LABELS = new Map<
  string,
  { label: string; power: number; cost: number; tl: number }
>([
  ...TURRET_WEAPONS.map((weapon) =>
    [weapon.id, {
      label: weapon.label,
      power: weapon.power,
      cost: weapon.cost,
      tl: weapon.tl
    }] as const
  ),
  ...BARBETTE_WEAPONS.map((weapon) =>
    [weapon.id, {
      label: weapon.label,
      power: weapon.power,
      cost: weapon.cost,
      tl: weapon.tl
    }] as const
  )
]);

/** Design bridge ids and the Foundry bridge type stored on the bridge item. */
const BRIDGE_TYPES: Record<string, string> = {
  cockpit: "cockpit",
  dual: "dualCockpit",
  bridge: "standard",
  small: "small",
  command: "command"
};

/** Header fields the actor can edit. Hull options arrive as a space-separated token string. */
export interface ShipHeader {
  name: string;
  dtons: number;
  tl: number;
  /** Actor type field. One of the ship classifications, when it is recognized. */
  type?: string;
  configuration: string;
  hullOptions: string;
  isStandardDesign: boolean;
}

/** One installed program. Cost is stored in credits. */
export interface ShipSoftware {
  key: string;
  name: string;
  bandwidth: number;
  tl: number;
  cost: number;
  interface: string;
}

/** One actor item. Weapons carry combat fields. Drives carry advancement and advantages. */
export interface ShipPiece {
  key: string;
  type: "hardware" | "weapon";
  name: string;
  system?: string;
  rating?: number;
  tons?: number;
  power?: number;
  quantity?: number;
  mount?: string;
  attaches?: string[];
  cost?: number;
  percent?: number;
  costPerTon?: number;
  /** Tech level of this component. The ship tech level is used when this is absent. */
  tl?: number;
  powerPerTon?: number;
  bridgeType?: string;
  /** Holographic controls checkbox on a bridge item. */
  holographicControls?: boolean;
  bis?: boolean;
  fib?: boolean;
  damage?: string;
  spaceRange?: string;
  characteristic?: string;
  skill?: string;
  attackBonus?: number;
  damageBonus?: string;
  damageType?: string;
  traits?: string;
  parryBonus?: number;
  magazine?: number;
  magazineCost?: number;
  /** Foundry advancement tier for a jump drive, manoeuvre drive, or power plant. */
  advancement?: string;
  /** Foundry advantage list, such as "energyEfficient 1, sizeReduction 2". */
  advantages?: string;
}

/** The evaluated ship written onto the actor. */
export interface ShipProjection {
  name: string;
  dtons: number;
  tl: number;
  /** Ship classification, stored on the actor as spacecraft.type. */
  type: string;
  configuration: string;
  hullOptions: string;
  isStandardDesign: boolean;
  skill: string;
  armour: number;
  jdrive: number;
  mdrive: number;
  cargo: number;
  fuelMax: number;
  powerMax: number;
  powerUsed: number;
  hitsMax: number;
  cost: number;
  computerBis: boolean;
  computerFib: boolean;
  processing: number;
  pieces: ShipPiece[];
  software: ShipSoftware[];
  /** Displacement of fittings that sit inside a modular hull and must not be counted again. */
  enclosedTons: number;
  /** Thrust rating times the tonnage that maneuver drive was designed against. */
  thrustPotential: number;
  /** Jump the drive was built at, on jumpBasis tons. A smaller hull can deliver a higher jump. */
  jumpRating: number;
  /** Tonnage the jump drive was designed against. Custom tonnage raises this above the hull. */
  jumpBasis: number;
  /** Fuel for one jump at jumpRating on jumpFuelHull. */
  jumpFuel: number;
  /** Tonnage jumpFuel was calculated for. This is jumpBasis, including custom drive tonnage. */
  jumpFuelHull: number;
}

/** Rounds to three decimal places, the precision used for tons and power. */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** A non-negative whole number. A non-finite value becomes 0. */
function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/** Power points a solar coating supplies. The coating does not draw this power. */
export function solarSupply(
  pieces: readonly { key: string; power?: number }[]
): number {
  let total = 0;
  for (const piece of pieces) {
    if (!/(^|:)solar:/.test(piece.key)) continue;
    total += Number(piece.power) || 0;
  }
  return round3(total);
}

/** Sum of design-line tons for one role, to three decimals. */
function tonsOf(
  lines: { role: string; tons: number }[],
  role: string
): number {
  return round3(
    lines.filter((line) => line.role === role).reduce(
      (total, line) => total + line.tons,
      0
    )
  );
}

/** A recognized classification, or Other when the stored value is unknown. */
function shipClassification(value: string): ShipClassification {
  return (SHIP_CLASSIFICATIONS as readonly string[]).includes(value)
    ? value as ShipClassification
    : "Other";
}

/** Actor configuration id. The design's distributed hull is the actor's dispersed hull. */
function configurationToActor(id: string): string {
  return id === "distributed" ? "dispersed" : id;
}

/** Design configuration id. The actor's dispersed hull is the design's distributed hull. */
function configurationToDesign(id: string): ConfigurationId | null {
  const designId = id === "dispersed" ? "distributed" : id;
  return CONFIGURATION_IDS.has(designId as ConfigurationId)
    ? designId as ConfigurationId
    : null;
}

/** Armour included by the hull configuration. Planetoid hulls include 2 and buffered hulls include 4. */
function configurationArmour(id: string): number {
  if (id === "planetoid") return 2;
  if (id === "buffered") return 4;
  return 0;
}

/** Pilot speciality from displacement: small craft under 100 tons, spacecraft through 5,000, capital beyond that. */
export function pilotSkill(dtons: number): string {
  if (dtons < 100) return "pilot.smallCraft";
  if (dtons <= 5000) return "pilot.spacecraft";
  return "pilot.capitalShips";
}

/** Catalog order of a sensor suite. An unknown name ranks below every suite. */
export function sensorRank(name: string | undefined): number {
  const index = SENSORS.findIndex((row) => name === `${row.label} sensors`);
  return index < 0 ? 0 : index + 1;
}

/** A piece the sheet should keep. Breakaway hulls also keep scoops that have no tons. */
export function componentValue(
  piece: ShipPiece,
  options?: { keepScoops?: boolean }
): boolean {
  if (options?.keepScoops && piece.key === "scoops") return true;
  return (piece.rating ?? 0) > 0 || (piece.tons ?? 0) > 0 ||
    (piece.cost ?? 0) > 0 || (piece.power ?? 0) > 0 ||
    (piece.attaches?.length ?? 0) > 0;
}

/** Rebuilds the actor hull-option string. Tokens outside the managed set keep their previous order. */
function hullOptionString(design: AdvancedDesign, previous = ""): string {
  const kept = previous.split(/\s+/).filter((token) =>
    token && !MANAGED_HULL_TOKENS.has(token) && !RETIRED_HULL_TOKENS.has(token)
  );
  const managed: string[] = [];
  if (design.hullType === "light") managed.push("light");
  if (design.hullType === "reinforced") managed.push("reinforced");
  if (design.hullType === "module") managed.push("moduleHull");
  for (const option of design.hullOptions ?? []) {
    const token = OPTION_TO_ACTOR[option.kind];
    if (token && !managed.includes(token)) managed.push(token);
  }
  return [...managed, ...kept].join(" ");
}

/** Writes a zero-ton fitting onto the actor. A fitting with tons goes through the normal piece filter. */
function pushEvenWhenEmpty(pieces: ShipPiece[], piece: ShipPiece) {
  if ((piece.tons ?? 0) > 0) addPiece(pieces, piece);
  else pieces.push(piece);
}

/** Keep a zero-ton piece when it still has a price, or when the caller always shows it. */
function placeOptional(
  pieces: ShipPiece[],
  piece: ShipPiece,
  keep: "always" | "priced"
) {
  const counted = (piece.tons ?? 0) > 0 || (piece.rating ?? 0) > 0 ||
    (piece.attaches?.length ?? 0) > 0;
  if (counted) {
    addPiece(pieces, piece);
    return;
  }
  if (keep === "always" || (piece.cost ?? 0) > 0 || (piece.power ?? 0) > 0) {
    pieces.push(piece);
  }
}

/** Bis and fib flags for the computer item. A combined computer type sets both. */
function computerFlags(type: ComputerTypeId): { bis: boolean; fib: boolean } {
  return {
    bis: type === "bis" || type === "bisfib",
    fib: type === "fib" || type === "bisfib"
  };
}

/** External fittings and drones. Clamps stay docks as well; this is their hardware. */
function addCoreFittings(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: { role: string; name: string; tons: number; cost: number; power?: number }[]
) {
  /** The system line whose name matches this fitting. */
  const lineFor = (name: string) =>
    lines.find((row) => row.role === "system" && row.name === name);
  for (const system of resolveExternalSystems(design.externalSystems)) {
    const kind = EXTERNAL_SYSTEMS.find((row) => row.id === system.kind);
    if (!kind) continue;
    const tier = kind.id === "linkage"
      ? forcedLinkageAt(system.techLevel ?? 0)
      : null;
    const name = tier ? `${kind.label} (${tier.label})` : kind.label;
    const line = lineFor(name);
    if (!line) continue;
    pushEvenWhenEmpty(pieces, {
      key: `fitting:${kind.id}:${system.id || kind.id}`,
      type: "hardware",
      name,
      system: "fitting",
      rating: line.tons,
      tons: line.tons,
      cost: line.cost,
      power: line.power ?? 0,
      quantity: 1,
      ...((tier?.tl ?? kind.tl) > 0 ? { tl: tier?.tl ?? kind.tl } : {})
    });
  }
  for (const fit of resolveDrones(design.drones)) {
    const kind = DRONES.find((row) => row.id === fit.kind);
    if (!kind) continue;
    const name = kind.id === "repair"
      ? kind.label
      : `${kind.label} ×${fit.quantity * DRONE_SET_SIZE}`;
    const line = lineFor(name);
    if (!line) continue;
    pushEvenWhenEmpty(pieces, {
      key: `drone:${kind.id}:${fit.id || kind.id}`,
      type: "hardware",
      name,
      system: "drone",
      rating: line.tons,
      tons: line.tons,
      cost: line.cost,
      power: line.power ?? 0,
      quantity: 1,
      ...(kind.tl > 0 ? { tl: kind.tl } : {})
    });
  }
}

/** Appends a piece that has a rating, tons, or attached items. A null piece is ignored. */
function addPiece(pieces: ShipPiece[], piece: ShipPiece | null) {
  if (!piece) return;
  const present = (piece.rating ?? 0) > 0 || (piece.tons ?? 0) > 0 ||
    (piece.attaches?.length ?? 0) > 0;
  if (present) pieces.push(piece);
}

/** Holds whose capacity sits outside the hull. The gear quantity is that capacity in tons. */
const EXTERNAL_HOLDS = new Set(["external", "jumpNet", "planetaryNet"]);
/** Gear that moves cargo and occupies tons inside the hull. */
const HANDLING_GEAR = new Set(["crane", "cargoNet", "cargoScoop", "belt", "belt12"]);

/** Jump drive, manoeuvre drive, and power plant. An unlisted rating uses tech level 9, and an unrecognized plant id uses Fusion (TL8). */
function addDrives(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[],
  stats: DesignShipStats
) {
  const jumpRating = whole(stats.jumpRating);
  const thrustRating = whole(design.thrust);
  addPiece(pieces, withLine({
    key: "j-drive",
    type: "hardware",
    name: "Jump Drive",
    system: "j-drive",
    rating: jumpRating,
    tl: JUMP_TL[jumpRating] ?? 9,
    costPerTon: JUMP_COST_PER_TON,
    quantity: 1,
    ...driveCustomFields("jump", design.driveCustom?.jump)
  }, lines.find((line) => line.role === "jump")));
  addPiece(pieces, withLine({
    key: "m-drive",
    type: "hardware",
    name: "Manoeuvre Drive",
    system: "m-drive",
    rating: thrustRating,
    tl: MANOEUVRE_TL[thrustRating] ?? 9,
    costPerTon: MANOEUVRE_COST_PER_TON,
    quantity: 1,
    ...driveCustomFields("thrust", design.driveCustom?.thrust)
  }, lines.find((line) => line.role === "manoeuvre")));
  const plant = POWER_PLANTS.find((row) => row.id === design.powerPlant) ??
    POWER_PLANTS[2];
  const plantLine = lines.find((line) => line.role === "plant");
  addPiece(pieces, withLine({
    key: "power",
    type: "hardware",
    name: plant.label,
    system: "power",
    rating: whole(plantLine?.power ?? design.power),
    tl: plant.tl,
    powerPerTon: plant.powerPerTon,
    costPerTon: plant.costPerTon,
    quantity: 1,
    ...driveCustomFields("plant", design.driveCustom?.plant)
  }, plantLine));
}

/** Fuel tanks, fuel/cargo containers, processors, and scoops. Scoops are listed even at zero tons. */
function addFuel(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[],
  stats: DesignShipStats
) {
  const containerLines = lines.filter((line) =>
    line.name.startsWith("Fuel/cargo container")
  );
  const fuelLines = lines.filter((line) =>
    line.role === "fuel" && !containerLines.includes(line)
  );
  addPiece(pieces, fuelLines.length
    ? {
      key: "fuel",
      type: "hardware",
      name: fuelLines.length === 1 ? fuelLines[0].name : "Fuel",
      system: "fuel",
      rating: whole(stats.fuelCapacity),
      tons: whole(stats.fuelCapacity),
      cost: round3(fuelLines.reduce((sum, line) => sum + line.cost, 0)),
      power: 0,
      quantity: 1
    }
    : null);
  const capacities = containerCapacities(design);
  const extraIds = (design.extraContainers ?? []).map((row) => row.id);
  // Container lines are consumed in order. A capacity of zero takes no line.
  let cursor = 0;
  capacities.forEach((tons, index) => {
    if (tons <= 0) return;
    const line = containerLines[cursor];
    cursor += 1;
    if (!line) return;
    const key = index === 0 ? "fuel-cargo" : `fuel-cargo:${extraIds[index - 1] || cursor}`;
    addPiece(pieces, {
      key,
      type: "hardware",
      name: line.name,
      system: "fuel",
      rating: tons,
      tons: line.tons,
      cost: line.cost,
      power: 0,
      quantity: 1
    });
  });
  const processorLine = lines.find((line) => line.name === "Fuel processors");
  if (processorLine) {
    // One ton of processor refines 20 tons of fuel per day.
    const rate = Math.round(processorLine.tons) * 20;
    addPiece(pieces, {
      key: "fuel-processor",
      type: "hardware",
      name: `Fuel processor (${rate} tons/day)`,
      system: "processor",
      rating: rate,
      tons: processorLine.tons,
      cost: processorLine.cost,
      power: processorLine.power ?? processorLine.tons,
      costPerTon: FITTINGS.processor.cost,
      quantity: 1
    });
  }
  const scoops = lines.find((line) => line.name === "Fuel scoops");
  if (!scoops) return;
  placeOptional(pieces, {
    key: "scoops",
    type: "hardware",
    name: scoops.name,
    system: "scoops",
    rating: 0,
    tons: scoops.tons,
    cost: scoops.cost,
    power: scoops.power ?? 0,
    quantity: 1
  }, "always");
}

/** The armour item. Its rating is fitted armour, with configuration armour left on the ship total. */
function addArmour(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[],
  armourRating: number
) {
  const armour = ARMOUR.find((row) => row.id === design.armour) ?? ARMOUR[0];
  const armourLine = lines.find((line) => line.role === "armour");
  addPiece(pieces, {
    key: "armour",
    type: "hardware",
    name: armour.id === "none" ? "Armour" : `${armour.label} Armour`,
    system: "armour",
    rating: armourRating,
    tons: armourLine?.tons ?? 0,
    cost: armourLine?.cost ?? 0,
    power: 0,
    quantity: 1,
    tl: armour.tl,
    // Hull percentage taken by one point of this armour, to two decimals.
    percent: Math.round(armour.tonsPerPoint * 10000) / 100,
    costPerTon: armour.costPerTon
  });
}

/** External, jump-net, and planetary-net holds. The gear quantity is the capacity in tons. */
function addExternalHolds(
  pieces: ShipPiece[],
  design: AdvancedDesign
) {
  for (const gear of design.cargoGear ?? []) {
    if (!EXTERNAL_HOLDS.has(gear.kind)) continue;
    const capacity = Number.isFinite(gear.quantity) ? Math.max(0, gear.quantity) : 0;
    if (capacity <= 0) continue;
    const spec = CARGO_GEAR.find((row) => row.id === gear.kind);
    addPiece(pieces, {
      key: `cargo:${gear.kind}:${gear.id || gear.kind}`,
      type: "hardware",
      name: spec?.label ?? gear.kind,
      system: "cargo",
      rating: round3(capacity),
      tons: round3(capacity),
      cost: 0,
      power: 0,
      quantity: 1,
      ...(spec && spec.tl > 0 ? { tl: spec.tl } : {})
    });
  }
}

/** Cranes, nets, scoops, and belts that occupy tons. A belt quantity above one is written into the name so it matches the design line. */
function addHandlingGear(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[]
) {
  for (const gear of resolveCargoGear(design.cargoGear)) {
    if (!HANDLING_GEAR.has(gear.kind)) continue;
    const kind = CARGO_GEAR.find((row) => row.id === gear.kind);
    if (!kind) continue;
    const counted = (gear.kind === "belt" || gear.kind === "belt12") &&
      gear.quantity > 1;
    const name = counted ? `${kind.label} ×${gear.quantity}` : kind.label;
    const line = lines.find((row) => row.role === "system" && row.name === name);
    if (!line || line.tons <= 0) continue;
    addPiece(pieces, {
      key: `handling:${gear.kind}:${gear.id || gear.kind}`,
      type: "hardware",
      name,
      system: "cargo",
      rating: 0,
      tons: line.tons,
      cost: line.cost,
      power: line.power ?? 0,
      quantity: 1,
      ...(kind.tl > 0 ? { tl: kind.tl } : {})
    });
  }
}

/** The internal hold, then the external holds and the handling gear that serves them. */
function addCargo(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[],
  stats: DesignShipStats
) {
  addPiece(pieces, {
    key: "cargo",
    type: "hardware",
    name: "Cargo Hold",
    system: "cargo",
    rating: round3(stats.cargoTons),
    tons: round3(stats.cargoTons),
    cost: 0,
    power: 0,
    quantity: 1
  });
  addExternalHolds(pieces, design);
  addHandlingGear(pieces, design, lines);
}

/** Computer and bridge. An unrecognized bridge id is stored as a standard bridge. */
function addCommand(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[],
  computer: { label: string; tl: number } | undefined,
  processing: number,
  flags: { bis: boolean; fib: boolean }
) {
  addPiece(pieces, withLine({
    key: "computer",
    type: "hardware",
    name: computer?.label ?? "Computer",
    system: "computer",
    rating: processing,
    tl: computer?.tl ?? 0,
    bis: flags.bis,
    fib: flags.fib,
    quantity: 1
  }, lines.find((line) => line.role === "computer")));
  addPiece(pieces, withLine({
    key: "bridge",
    type: "hardware",
    name: "Bridge",
    system: "bridge",
    rating: 0,
    bridgeType: BRIDGE_TYPES[design.bridge] ?? "standard",
    holographicControls: design.holographicControls === true,
    quantity: 1
  }, lines.find((line) => line.role === "bridge")));
}

/** Workshops, labs, and robotics bays. Each robotics option adds its cost once per bay. */
function addWorkSpaces(pieces: ShipPiece[], design: AdvancedDesign) {
  for (const space of resolveWorkSpaces(design.workSpaces)) {
    const kind = WORK_SPACES.find((row) => row.id === space.kind);
    if (!kind) continue;
    let cost = kind.cost * space.quantity;
    if (space.kind === "robotics") {
      for (
        const option of [
          roboticsAvatarChair(space.avatarChair),
          roboticsFabricator(space.fabrication),
          roboticsDroneController(space.droneController),
          roboticsSwarmController(space.swarmController)
        ]
      ) {
        if (option.id !== "none") cost += option.cost * space.quantity;
      }
    }
    const tons = round3(kind.tons * space.quantity);
    addPiece(pieces, {
      key: `workspace:${space.id || space.kind}`,
      type: "hardware",
      name: countedName(kind.label, space.quantity),
      system: "common",
      rating: tons,
      tons,
      cost: round3(cost),
      power: kind.power * space.quantity,
      quantity: 1,
      ...(kind.tl > 0 ? { tl: kind.tl } : {})
    });
  }
}

/** Amenities that occupy tons, or that have a price or a power draw. */
function addAmenities(pieces: ShipPiece[], design: AdvancedDesign) {
  for (const amenity of resolveAmenities(design.amenities)) {
    const kind = AMENITIES.find((row) => row.id === amenity.kind);
    if (!kind) continue;
    const tons = amenityTons(kind.id, amenity.quantity);
    placeOptional(pieces, {
      key: `amenity:${amenity.id || amenity.kind}`,
      type: "hardware",
      name: kind.label,
      system: "common",
      rating: tons,
      tons,
      cost: amenityCost(kind.id, amenity.quantity),
      power: amenityPower(kind.id, amenity.quantity),
      quantity: 1,
      ...("tl" in kind && kind.tl > 0 ? { tl: kind.tl } : {})
    }, "priced");
  }
}

/** Accommodations as one item, then common space, workspaces, and amenities. Several room lines share that one accommodations item. */
function addLiving(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: DesignLine[],
  stats: DesignShipStats
) {
  const rooms = lines.filter((line) => line.role === "accommodation");
  addPiece(pieces, {
    key: "stateroom",
    type: "hardware",
    name: rooms.length === 1 ? rooms[0].name : "Accommodations",
    system: "stateroom",
    rating: whole(stats.staterooms),
    tons: tonsOf(lines, "accommodation"),
    cost: round3(rooms.reduce((sum, line) => sum + line.cost, 0)),
    power: 0,
    quantity: 1
  });
  const common = lines.find((line) => line.role === "common");
  addPiece(pieces, withLine({
    key: "common",
    type: "hardware",
    name: "Common space",
    system: "common",
    rating: common?.tons ?? 0,
    quantity: 1
  }, common));
  addWorkSpaces(pieces, design);
  addAmenities(pieces, design);
}

/** The sensor suite, each additional sensor, and the sensor stations. Extra sensors pair with sensor-extra lines in list order. */
function addSensors(pieces: ShipPiece[], design: AdvancedDesign, lines: DesignLine[]) {
  const sensor = SENSORS.find((row) => row.id === design.sensors) ?? SENSORS[0];
  addPiece(pieces, withLine({
    key: "sensors",
    type: "hardware",
    name: `${sensor.label} sensors`,
    system: "sensor",
    rating: 0,
    tl: sensor.tl,
    quantity: 1
  }, lines.find((line) => line.role === "sensors")));
  const extraLines = lines.filter((line) => line.role === "sensorExtra");
  for (const [index, fitted] of (design.additionalSensors ?? []).entries()) {
    const kind = ADDITIONAL_SENSORS.find((row) => row.id === fitted.kind);
    addPiece(pieces, withLine({
      key: `sensor:${fitted.kind}:${index}`,
      type: "hardware",
      name: kind?.label ?? "Sensor",
      system: "sensor",
      rating: 0,
      tl: kind?.tl ?? 0,
      quantity: 1
    }, extraLines[index]));
  }
  addPiece(pieces, withLine({
    key: "sensor-station",
    type: "hardware",
    name: "Sensor station",
    system: "sensor",
    rating: whole(design.sensorStations),
    quantity: 1
  }, lines.find((line) => line.role === "sensorStation")));
}

/** Breakaway hull and aerofins. Tons, cost, and power come from the hull-option line. */
function addHullFitting(pieces: ShipPiece[], lines: DesignLine[], option: string) {
  const line = lines.find((row) =>
    row.role === "hullOption" && row.option === option
  );
  if (!line) return;
  addPiece(pieces, {
    key: option,
    type: "hardware",
    name: line.name,
    system: option,
    rating: line.tons,
    tons: line.tons,
    cost: line.cost,
    power: line.power ?? 0,
    quantity: 1
  });
}

/** Hull figures and managed items for one design. */
export function projectShip(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = [],
  previousHullOptions = ""
): ShipProjection {
  const stats = shipDesignFromAdvanced(design, catalog);
  const sheet = evaluateDesign(design, catalog);
  const computer = COMPUTERS.find((row) => row.id === design.computer);
  const processing = computer?.bandwidth ?? 0;
  const flags = computerFlags(design.computerType as ComputerTypeId);
  const pieces: ShipPiece[] = [];
  // Fitted armour only. Configuration armour remains on the ship armour total.
  const armourRating = Math.max(
    0,
    sheet.armourRating - configurationArmour(design.configuration)
  );
  addDrives(pieces, design, sheet.lines, stats);
  addFuel(pieces, design, sheet.lines, stats);
  addCoreFittings(pieces, design, sheet.lines);
  addArmour(pieces, design, sheet.lines, armourRating);
  addCargo(pieces, design, sheet.lines, stats);
  addCommand(pieces, design, sheet.lines, computer, processing, flags);
  addLiving(pieces, design, sheet.lines, stats);
  addSensors(pieces, design, sheet.lines);
  addHullFitting(pieces, sheet.lines, "breakaway");
  addHullFitting(pieces, sheet.lines, "aerofins");
  addModularHulls(pieces, design, sheet.lines);
  addPressureHull(pieces, design, sheet.lines);
  addGravScreen(pieces, design, sheet.lines);
  addSolarCoating(pieces, design, sheet.lines);
  addMounts(pieces, design);
  const hullTons = whole(stats.hullTons);
  const thrust = whole(design.thrust);
  const thrustBasis = driveEffectiveTons(hullTons, design.driveCustom?.thrust);
  const jumpBasis = driveEffectiveTons(hullTons, design.driveCustom?.jump);
  // The built rating stays on the tonnage the drive was sized for. Performance on a smaller hull is jdrive.
  const builtJump = hullTons < JUMP_MIN_HULL_TONS ? 0 : whole(design.jump);
  return {
    name: design.name.trim(),
    dtons: hullTons,
    tl: whole(design.techLevel),
    type: shipClassification(design.classification),
    configuration: configurationToActor(design.configuration),
    hullOptions: hullOptionString(design, previousHullOptions),
    isStandardDesign: design.standardDesign,
    skill: pilotSkill(whole(stats.hullTons)),
    armour: sheet.armourRating,
    jdrive: whole(stats.jumpRating),
    mdrive: thrust,
    cargo: round3(stats.cargoTons),
    fuelMax: whole(stats.fuelCapacity),
    // Solar coating supply is added onto the plant rating.
    powerMax: round3(whole(design.power) + solarSupply(pieces)),
    powerUsed: round3(sheet.powerUse.total),
    hitsMax: whole(sheet.hullPoints),
    cost: sheet.cost,
    computerBis: flags.bis,
    computerFib: flags.fib,
    processing,
    pieces,
    software: shipSoftware(design),
    enclosedTons: 0,
    thrustPotential: thrust > 0 ? thrust * thrustBasis : 0,
    jumpRating: builtJump,
    jumpBasis,
    jumpFuel: sheet.jumpFuel,
    jumpFuelHull: jumpBasis
  };
}

/** Installed programs. Catalog costs are megacredits and are stored here as credits. Intellect and conscious programs use the intellect interface. */
function shipSoftware(design: AdvancedDesign): ShipSoftware[] {
  return installedSoftware(design.software ?? []).map((program) => ({
    key: `software:${program.id}`,
    name: program.label,
    bandwidth: program.bandwidth,
    tl: program.tl,
    cost: Math.round(program.cost * 1_000_000),
    interface: program.group === "intellect" || program.group === "conscious"
      ? "intellect"
      : "none"
  }));
}

/** Design drive tiers and the Foundry advancement names stored on a drive item. */
const ACTOR_DRIVE_TIER: Record<string, string> = {
  early: "earlyPrototype",
  prototype: "prototype",
  budget: "budget",
  standard: "standard",
  advanced: "advanced",
  very: "veryAdvanced",
  high: "highTech"
};

/** The tier and the options Foundry shows on a drive item. Repeated options keep a count. */
function driveCustomFields(
  component: "thrust" | "jump" | "plant",
  custom: DriveCustom | undefined
): { advancement: string; advantages: string } {
  const chosen = legalDriveOptions(component, custom);
  const counts = new Map<string, number>();
  for (const option of chosen) {
    counts.set(option.id, (counts.get(option.id) ?? 0) + 1);
  }
  return {
    advancement: ACTOR_DRIVE_TIER[custom?.tier ?? "standard"] ?? "standard",
    advantages: [...counts].map(([id, count]) => `${id} ${count}`).join(", ")
  };
}

/** Copies the evaluated name, tons, cost, and power onto a piece. A missing line leaves the piece as it was. */
function withLine(
  piece: ShipPiece,
  line: { name: string; tons: number; cost: number; power?: number } | undefined
): ShipPiece {
  if (!line) return piece;
  return {
    ...piece,
    name: line.name,
    tons: line.tons,
    cost: line.cost,
    power: line.power ?? piece.power ?? 0
  };
}

/** Reserved module space. The tons are the hull the modules use. */
function addModularHulls(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: { role: string; option?: string; name: string; tons: number; cost: number; power?: number }[]
) {
  const modularLines = lines.filter((row) =>
    row.role === "hullOption" && row.option === "modular"
  );
  let index = 0;
  for (const option of design.hullOptions ?? []) {
    if (option.kind !== "modular") continue;
    const line = modularLines[index];
    index += 1;
    if (!line || line.tons <= 0) continue;
    addPiece(pieces, {
      key: `modular:${option.id || index}`,
      type: "hardware",
      name: line.name,
      system: "modular",
      rating: line.tons,
      tons: line.tons,
      cost: line.cost,
      power: line.power ?? 0,
      quantity: 1
    });
  }
}

/** Grav screen is one ton per 200 tons of hull. Cost and power follow that tonnage. */
function addGravScreen(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: { role: string; option?: string; name: string; tons: number; cost: number; power?: number }[]
) {
  const line = lines.find((row) => row.role === "hullOption" && row.option === "grav");
  if (!line || line.tons <= 0) return;
  const option = (design.hullOptions ?? []).find((row) => row.kind === "grav");
  addPiece(pieces, {
    key: `grav:${option?.id || "grav"}`,
    type: "hardware",
    name: line.name,
    system: "grav",
    rating: line.tons,
    tons: line.tons,
    cost: line.cost,
    power: line.power ?? 0,
    quantity: 1
  });
}

/** Pressure hull takes 25% of the hull. The +4 armour stays on the armour total. */
function addPressureHull(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: { role: string; option?: string; name: string; tons: number; cost: number; power?: number }[]
) {
  const line = lines.find((row) =>
    row.role === "hullOption" && row.option === "pressure"
  );
  if (!line || line.tons <= 0) return;
  const option = (design.hullOptions ?? []).find((row) => row.kind === "pressure");
  addPiece(pieces, {
    key: `pressure:${option?.id || "pressure"}`,
    type: "hardware",
    name: line.name,
    system: "pressure",
    rating: line.tons,
    tons: line.tons,
    cost: line.cost,
    power: line.power ?? 0,
    quantity: 1
  });
}

/** Solar coating covers hull tons and takes no space. The item tons are the tons covered. */
function addSolarCoating(
  pieces: ShipPiece[],
  design: AdvancedDesign,
  lines: { role: string; name: string; option?: string; cost: number }[]
) {
  for (const option of design.hullOptions ?? []) {
    if (option.kind !== "solarEnhanced" && option.kind !== "solarAdvanced") {
      continue;
    }
    const kind = HULL_OPTIONS.find((row) => row.id === option.kind);
    const line = lines.find((row) =>
      row.role === "hullOption" && row.option === option.kind
    );
    if (!kind || !line) continue;
    const quoted = solarCoatingQuote(
      option.kind,
      design.hullTons,
      option.units ?? 0,
      design.configuration
    );
    if (quoted.units <= 0) continue;
    addPiece(pieces, {
      key: `solar:${option.id || option.kind}`,
      type: "hardware",
      name: line.name,
      system: "solar",
      rating: quoted.units,
      tons: quoted.units,
      cost: line.cost,
      power: quoted.power,
      quantity: 1,
      ...(kind.tl > 0 ? { tl: kind.tl } : {})
    });
  }
}

/** Weapon mounts and the weapons fitted to them. The mount item draws its own power plus every fitted weapon. */
function addMounts(pieces: ShipPiece[], design: AdvancedDesign) {
  const kinds = new Map(MOUNT_KINDS.map((kind) => [kind.id, kind]));
  for (const [index, mount] of (design.mounts ?? []).entries()) {
    const kind = kinds.get(mount.kind);
    // Single, double, and triple turrets share the turret mount type.
    const hardwareMount = mount.kind === "barbette"
      ? "barbette"
      : mount.kind === "fixed"
      ? "fixed"
      : "turret";
    // Popup tons, cost, and tech level apply to a popup turret or fixed mount.
    const popup = mount.popup === true && mount.kind !== "barbette";
    const attaches: string[] = [];
    let weaponPower = kind?.power ?? 0;
    for (const [weaponIndex, weaponId] of (mount.weapons ?? []).entries()) {
      if (!weaponId) continue;
      const key = `weapon:${mount.id || index}:${weaponIndex}`;
      const known = WEAPON_LABELS.get(weaponId);
      const combat = weaponCombat(
        weaponId,
        mount.kind,
        design.hullTons,
        mount.custom?.[weaponIndex]
      );
      const power = combat?.power ?? 0;
      attaches.push(key);
      weaponPower += power;
      pieces.push({
        key,
        type: "weapon",
        name: known?.label ?? weaponId,
        mount: hardwareMount,
        quantity: 1,
        cost: known?.cost ?? 0,
        power,
        tl: known?.tl ?? 0,
        damage: combat?.damage,
        spaceRange: combat?.spaceRange,
        characteristic: combat?.characteristic,
        skill: combat?.skill,
        attackBonus: combat?.attackBonus,
        damageBonus: combat?.damageBonus,
        damageType: combat?.damageType,
        traits: combat?.traits,
        parryBonus: combat?.parryBonus,
        ...(combat?.magazine != null ? { magazine: combat.magazine } : {}),
        ...(combat?.magazineCost != null
          ? { magazineCost: combat.magazineCost }
          : {})
      });
    }
    pieces.push({
      key: `mount:${mount.id || index}`,
      type: "hardware",
      name: kind ? mountLineName(kind.label, popup) : "Weapon mount",
      system: "weapon",
      rating: attaches.length,
      tons: (kind?.tons ?? 0) + (popup ? POPUP_MOUNT.tons : 0),
      cost: round3((kind?.cost ?? 0) + (popup ? POPUP_MOUNT.cost : 0)),
      power: weaponPower,
      tl: Math.max(kind?.tl ?? 0, popup ? POPUP_MOUNT.tl : 0),
      quantity: 1,
      mount: hardwareMount,
      attaches
    });
  }
}

/** Copy header edits onto the open design, leaving unmapped hull options in place. */
export function designFromHeader(
  current: AdvancedDesign | null,
  header: ShipHeader
): AdvancedDesign {
  const design = current ? structuredClone(current) : blankDesign();
  const name = header.name.trim();
  // A blank header name leaves the design name in place.
  if (name) design.name = name;
  if (Number.isFinite(header.dtons) && header.dtons > 0) {
    design.hullTons = Math.round(header.dtons);
  }
  if (Number.isFinite(header.tl)) design.techLevel = Math.round(header.tl);
  design.standardDesign = header.isStandardDesign;
  const configuration = configurationToDesign(header.configuration);
  if (configuration) design.configuration = configuration;
  const tokens = header.hullOptions.split(/\s+/).filter(Boolean);
  // Light, reinforced, and module are exclusive. Clearing those tokens returns the hull to standard.
  if (tokens.includes("light")) design.hullType = "light";
  else if (tokens.includes("reinforced")) design.hullType = "reinforced";
  else if (tokens.includes("moduleHull")) design.hullType = "module";
  else if (
    design.hullType === "light" || design.hullType === "reinforced" ||
    design.hullType === "module"
  ) {
    design.hullType = "standard";
  }
  // A mapped option stays while its actor token is still in the header.
  const next = (design.hullOptions ?? []).filter((option) => {
    const token = OPTION_TO_ACTOR[option.kind];
    return !token || tokens.includes(token);
  });
  for (const [token, kind] of Object.entries(ACTOR_TO_OPTION)) {
    if (!tokens.includes(token)) continue;
    if (next.some((option) => OPTION_TO_ACTOR[option.kind] === token)) continue;
    next.push({ id: kind, kind });
  }
  design.hullOptions = next;
  // A module hull is classified as Other.
  if (design.hullType === "module") design.classification = "Other";
  else if (
    header.type !== undefined &&
    (SHIP_CLASSIFICATIONS as readonly string[]).includes(header.type)
  ) {
    design.classification = header.type as ShipClassification;
  }
  return design;
}
