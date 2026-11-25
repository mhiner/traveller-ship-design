import {
  ARMOUR,
  type ArmourId,
  clampHullTons,
  type ConfigurationId,
  CONFIGURATIONS,
  HULL_TYPES,
  hullCost,
  type HullOption,
  type HullTypeId,
  MAX_HULL_TONS,
  MIN_HULL_TONS,
} from "./catalog/hull.ts";
import {
  blankDriveCustom,
  type DriveCustoms,
  type PowerPlantId,
} from "./catalog/drives.ts";
import {
  mountPointCost,
  mountWeaponSlots,
  type WeaponMount,
  weaponPoints,
  weaponsForMount,
} from "./catalog/weapons.ts";
import { type AdditionalSensor, type SensorId } from "./catalog/sensors.ts";
import {
  type Amenity,
  type CargoGear,
  type DroneFit,
  type ExternalSystem,
  type WorkSpace,
} from "./catalog/fittings.ts";
import {
  type BridgeId,
  type ComputerId,
  type ComputerTypeId,
  type ShipBrainId,
  type ShipBrainInterfaceId,
  type SoftwareId,
} from "./catalog/bridge.ts";
import type { ShipClassification } from "./classification.ts";
import type { CustomShipBrain } from "./shipBrain.ts";
import { buildBridge } from "./evaluate/bridge.ts";
import { buildDocks } from "./evaluate/docks.ts";
import { buildDrives, plannedJump } from "./evaluate/drives.ts";
import { buildFittings } from "./evaluate/fittings.ts";
import { buildHull } from "./evaluate/hull.ts";
import { buildWeapons } from "./evaluate/weapons.ts";
import { round2, round3, whole } from "./evaluate/shared.ts";
import { orderSheetLines } from "./sheetOrder.ts";

/** One fuel/cargo container after the original. Capacity is in tons. */
export interface FuelContainer {
  id: string;
  tons: number;
}

export interface AdvancedDesign {
  id: string;
  name: string;
  /** Free text shown under the name in the shipyard. */
  description: string;
  /** Same list as a ship design: Free Trader, Lab Ship, Scout, Yacht, or Other. */
  classification: ShipClassification;
  hullTons: number;
  configuration: ConfigurationId;
  hullType: HullTypeId;
  armour: ArmourId;
  armourRating: number;
  techLevel: number;
  thrust: number;
  jump: number;
  powerPlant: PowerPlantId;
  /** Power points the plant is built to supply. */
  power: number;
  powerWeeks: number;
  /** Extra tankage. Zero follows the jump-fuel plus power-fuel requirement, less any fuel/cargo container. */
  fuelTons: number;
  /** Original fuel/cargo container capacity in tons. The hull space taken is 5% larger. */
  containerTons: number;
  /** Fuel/cargo containers after the original. Each capacity is in tons. */
  extraContainers: FuelContainer[];
  computer: ComputerId;
  computerType: ComputerTypeId;
  sensors: SensorId;
  software: SoftwareId[];
  mounts: WeaponMount[];
  staterooms: number;
  /** How many standard staterooms have bunks for two crew or one passenger. No extra tons or cost. */
  doubleStaterooms: number;
  lowBerths: number;
  /** Emergency low berths. Each holds four people, takes 1 ton, costs MCr 1, and draws 1 power. */
  emergencyLowBerths: number;
  /** Passenger places. Each is 1.5 tons at Cr50,000 per ton. */
  cabinSpaces: number;
  /** Benches. Each seats four in one ton at Cr10,000. */
  accelerationBenches: number;
  /** Seats. Each is half a ton at Cr30,000. */
  accelerationSeats: number;
  /** High staterooms. Each is 6 tons at MCr 0.8. */
  highStaterooms: number;
  /** Luxury staterooms. Each is 10 tons at MCr 1.5. */
  luxuryStaterooms: number;
  /** Barracks passengers. Each is 1 ton at Cr50,000. */
  barracks: number;
  /** Brigs. Each holds six prisoners, takes 4 tons, and costs MCr 0.25. */
  brigs: number;
  processorTons: number;
  scoops: boolean;
  /** Tons of common space. */
  commonTons: number;
  /** Standard designs are bought at 90% of the component total. */
  standardDesign: boolean;
  workSpaces: WorkSpace[];
  amenities: Amenity[];
  externalSystems: ExternalSystem[];
  hullOptions: HullOption[];
  /** Saved design ids joined through a breakaway hull. The same id may appear more than once. */
  breakawayHulls: string[];
  additionalSensors: AdditionalSensor[];
  /** Craft carried in docking spaces. A ship id is priced from the design catalog. */
  docks: Dock[];
  /** A module that keeps its own power plant, computer, and fuel. */
  powered?: boolean;
  /** High Guard advantages and disadvantages for the manoeuvre drive, jump drive, and power plant. */
  driveCustom?: DriveCustoms;
  drones: DroneFit[];
  cargoGear: CargoGear[];
  bridge: BridgeId;
  /** High Guard holographic controls. They add a quarter of the bridge cost and need tech level 9. */
  holographicControls: boolean;
  /** Extra sensor stations. Each is 1 ton and MCr 0.5. A hull above 7,500 tons includes them in the bridge. */
  sensorStations: number;
  /** Robot Handbook ship's brain. None leaves the ship on its computer alone. */
  shipBrain: ShipBrainId;
  /** Present only when a ship's brain is installed. Haptics gives Pilot DEX equal to the brain's tech level. */
  shipBrainInterface: ShipBrainInterfaceId;
  /** A custom Robot Handbook brain. Priced only while Ship's Brain is Custom. */
  customShipBrain?: CustomShipBrain;
}

export interface Dock {
  id: string;
  /** "air-raft", "atv", "prospecting-buggy", "berth-15", "berth-30", "empty", or the id of a design in the catalog. */
  craft: string;
  /** Supported craft tonnage when craft is "empty". The bay is this size plus 10%. */
  craftTons?: number;
  /** A vehicle carried on board another craft. It takes no docking bay, and its price stays in this ship. */
  stowed?: boolean;
  /** A Type I docking clamp: 1 ton and MCr 0.5, plus the craft's own tonnage. */
  clamp?: boolean;
}

/** What a sheet line is. Set when the line is created, so later views do not recover it from the display name. */
export type LineRole =
  | "hull"
  | "hullOption"
  | "module"
  | "armour"
  | "manoeuvre"
  | "jump"
  | "plant"
  | "fuel"
  | "bridge"
  | "controls"
  | "sensorStation"
  | "computer"
  | "software"
  | "sensors"
  | "sensorExtra"
  | "turret"
  | "mount"
  | "weapon"
  | "dock"
  | "craft"
  | "accommodation"
  | "common"
  | "robotics"
  | "roboticsOption"
  | "brain"
  | "system";

export interface DesignLine {
  name: string;
  tons: number;
  cost: number;
  /** Power points this component requires, or the points a power plant supplies. */
  power?: number;
  /** A docked ship. Its price stays outside the parent ship's standard-design discount. A vehicle's price is part of the parent. */
  carried?: boolean;
  /** Computer software folds under the computer. Hull options fold under the hull. Every brain line except programming folds under the programming line. Robotics laboratory options fold under that laboratory. */
  fold?: "software" | "brain" | "robotics" | "hull";
  /** The ship's brain programming line. The sheet folds the rest of the brain under it. */
  head?: "brain";
  role: LineRole;
  /** Hull-option id. Set only when role is hullOption. */
  option?: string;
}

export interface CrewLine {
  role: string;
  count: number;
}

export interface DesignSheet {
  lines: DesignLine[];
  used: number;
  usable: number;
  cargo: number;
  cost: number;
  hullPoints: number;
  armourRating: number;
  hardpoints: number;
  hardpointsUsed: number;
  jumpFuel: number;
  powerFuel: number;
  fuelMinimum: number;
  fuelCapacity: number;
  powerPlantTons: number;
  powerRequired: number;
  powerUse: {
    base: number;
    jump: number;
    maneuver: number;
    weapons: number;
    sensors: number;
    fittings: number;
    total: number;
  };
  /** Thrust the manoeuvre drive delivers on the actual hull. */
  thrustRating: number;
  /** Jump the jump drive delivers on the actual hull. */
  jumpRating: number;
  crew: CrewLine[];
  errors: string[];
  warnings: string[];
}

export function blankDesign(id = ""): AdvancedDesign {
  const design: AdvancedDesign = {
    id,
    name: "New design",
    description: "",
    classification: "Other",
    hullTons: 200,
    configuration: "streamlined",
    hullType: "standard",
    armour: "none",
    armourRating: 0,
    techLevel: 12,
    thrust: 1,
    jump: 0,
    powerPlant: "fusion8",
    power: 0,
    powerWeeks: 4,
    fuelTons: 0,
    containerTons: 0,
    extraContainers: [],
    computer: "core5",
    computerType: "standard",
    sensors: "basic",
    software: ["manoeuvre", "intellect", "library"],
    mounts: [],
    staterooms: 0,
    doubleStaterooms: 0,
    lowBerths: 0,
    emergencyLowBerths: 0,
    cabinSpaces: 0,
    accelerationBenches: 0,
    accelerationSeats: 0,
    highStaterooms: 0,
    luxuryStaterooms: 0,
    barracks: 0,
    brigs: 0,
    processorTons: 0,
    scoops: true,
    commonTons: 0,
    standardDesign: false,
    workSpaces: [],
    amenities: [],
    externalSystems: [],
    hullOptions: [],
    breakawayHulls: [],
    additionalSensors: [],
    docks: [],
    drones: [],
    cargoGear: [],
    bridge: "bridge",
    holographicControls: false,
    sensorStations: 0,
    shipBrain: "none",
    shipBrainInterface: "none",
  };
  design.power = evaluateDesign(design).powerUse.total;
  return design;
}

/** A module starts from a blank design, classified as Other, without changing the hidden ship systems. */
export function blankModule(id = ""): AdvancedDesign {
  const design = blankDesign(id);
  design.name = "New module";
  design.classification = "Other";
  design.hullType = "module";
  return design;
}

function fittedMount(
  mount: WeaponMount,
  kind: WeaponMount["kind"],
  hullTons: number,
): WeaponMount {
  const weapons = mount.weapons.slice(0, mountWeaponSlots(kind, hullTons));
  const custom = weapons.map((_, index) =>
    mount.custom?.[index] ?? blankDriveCustom()
  );
  const { custom: _previous, ...rest } = mount;
  if (
    !custom.some((row) => row.tier !== "standard" || row.options.length > 0)
  ) return { ...rest, kind, weapons };
  return { ...rest, kind, weapons, custom };
}

export function legalMounts(
  hullTons: number,
  mounts: WeaponMount[],
): WeaponMount[] {
  const budget = weaponPoints(hullTons).count;
  let used = 0;
  let singleUsed = false;
  const kept: WeaponMount[] = [];
  for (const mount of mounts) {
    const kind = hullTons >= 100
      ? mount.kind
      : mount.kind === "barbette"
      ? "barbette"
      : mount.kind === "single" && !singleUsed
      ? "single"
      : "fixed";
    const cost = mountPointCost(kind, hullTons);
    if (used + cost > budget) continue;
    if (kind === "single") singleUsed = true;
    used += cost;
    const allowed = new Set<string>(
      weaponsForMount(kind).map((weapon) => weapon.id),
    );
    const pairs = mount.weapons.map((id, index) => ({
      id,
      custom: mount.custom?.[index],
    })).filter((pair) => allowed.has(pair.id));
    const custom = pairs.map((pair) => pair.custom ?? blankDriveCustom());
    const { custom: _custom, ...rest } = mount;
    const next = {
      ...rest,
      weapons: pairs.map((pair) => pair.id),
      ...(custom.some((row) =>
          row.tier !== "standard" || row.options.length > 0
        )
        ? { custom }
        : {}),
    };
    kept.push(fittedMount(next, kind, hullTons));
  }
  return kept;
}

export function evaluateDesign(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = [],
  stack: readonly string[] = [],
): DesignSheet {
  const requestedTons = whole(design.hullTons);
  const hullTons = clampHullTons(requestedTons);
  const tonnageErrors =
    requestedTons < MIN_HULL_TONS || requestedTons > MAX_HULL_TONS
      ? [
        `Tonnage is from ${MIN_HULL_TONS.toLocaleString("en-US")} to ${
          MAX_HULL_TONS.toLocaleString("en-US")
        } tons.`,
      ]
      : [];
  const hull = { tons: hullTons, cost: hullCost(hullTons) };
  const configuration =
    CONFIGURATIONS.find((row) => row.id === design.configuration) ??
      CONFIGURATIONS[0];
  const hullType = HULL_TYPES.find((row) => row.id === design.hullType) ??
    HULL_TYPES[0];
  const moduleHull = hullType.id === "module";
  const armour = ARMOUR.find((row) => row.id === design.armour) ?? ARMOUR[0];
  const techLevel = whole(design.techLevel);
  const poweredModule = moduleHull && design.powered === true;
  const rating = moduleHull || armour.id === "none"
    ? 0
    : whole(design.armourRating);
  const usable = round2(hull.tons * configuration.usable);
  const points = weaponPoints(hull.tons);
  const quote = (fitted: AdvancedDesign) =>
    evaluateDesign(fitted, catalog, [...stack, design.id]);

  const weapons = buildWeapons(design, hull.tons, moduleHull, techLevel);
  const hullBuilt = buildHull(
    design,
    {
      hullTons: hull.tons,
      hullCostValue: hull.cost,
      configuration,
      hullType,
      moduleHull,
      armour,
      techLevel,
      rating,
    },
    catalog,
    stack,
    quote,
  );
  const fittings = buildFittings(
    design,
    hull.tons,
    moduleHull,
    poweredModule,
    techLevel,
    configuration.id,
    configuration.streamlined,
  );
  const jump = plannedJump(design, hull.tons, moduleHull);
  const bridge = buildBridge(
    design,
    hull.tons,
    moduleHull,
    poweredModule,
    techLevel,
    jump,
  );
  const drives = buildDrives(
    design,
    hull.tons,
    moduleHull,
    poweredModule,
    techLevel,
    {
      basePower: hullBuilt.basePower,
      hullOptionPower: hullBuilt.hullOptionPower,
      modulePower: hullBuilt.modulePower,
      weaponPower: weapons.weaponPower,
      sensorPower: bridge.sensorPower,
      fittingsPower: fittings.fittingsPower,
    },
  );
  const lines = [
    ...hullBuilt.lines,
    ...drives.lines,
    ...bridge.lines,
    ...weapons.lines,
    ...fittings.lines,
  ];
  const docks = buildDocks(
    design,
    hull.tons,
    techLevel,
    usable,
    lines,
    catalog,
    stack,
    quote,
  );
  lines.push(...docks.lines);

  const errors = [
    ...tonnageErrors,
    ...weapons.errors,
    ...hullBuilt.errors,
    ...fittings.powerErrors,
    ...bridge.sensorErrors,
    ...drives.errors,
    ...bridge.errors,
    ...fittings.errors,
    ...docks.errors,
  ];
  const warnings = [...drives.warnings, ...bridge.warnings];
  const hullLine = lines.find((line) => line.role === "hull");
  const used = round2(
    lines.reduce((total, line) => total + (line.carried ? 0 : line.tons), 0) -
      (hullLine?.tons ?? 0),
  );
  const cargo = round2(usable - used);
  if (cargo < 0) {
    errors.push(`The design is ${round2(-cargo)} tons over the usable hull.`);
  }

  const driveTons = drives.manoeuvreTons + drives.jumpTons + drives.plantTons;
  const gunners = (design.mounts ?? []).length;
  const pilotOnly = !moduleHull && hull.tons <= 100 && drives.jump === 0;
  const crew: CrewLine[] = (pilotOnly ? [{ role: "Pilot", count: 1 }] : [
    { role: "Command", count: hull.tons >= 1000 ? 1 : 0 },
    { role: "Pilot", count: 1 },
    { role: "Astrogator", count: drives.jumpRating > 0 ? 1 : 0 },
    {
      role: "Engineer",
      count: driveTons > 0 ? Math.max(1, Math.ceil(driveTons / 35)) : 0,
    },
    {
      role: "Maintenance",
      count: hull.tons >= 1000 ? Math.ceil(hull.tons / 1000) : 0,
    },
    { role: "Gunner", count: gunners },
    { role: "Medic", count: hull.tons >= 200 ? 1 : 0 },
    {
      role: "Steward",
      count: fittings.staterooms >= 8
        ? Math.max(1, Math.floor(fittings.staterooms / 10))
        : 0,
    },
  ]).filter((row) => row.count > 0);

  const orderedLines = orderSheetLines(lines);
  const listCost = round3(
    lines.reduce((total, line) => total + (line.carried ? 0 : line.cost), 0),
  );
  const carriedCost = round3(
    lines.reduce((total, line) => total + (line.carried ? line.cost : 0), 0),
  );
  const listThousandths = Math.round(listCost * 1000);
  const carriedThousandths = Math.round(carriedCost * 1000);
  const purchaseTenThousandths =
    (design.standardDesign ? listThousandths * 9 : listThousandths * 10) +
    carriedThousandths * 10;
  return {
    lines: orderedLines,
    used,
    usable,
    cargo,
    cost: purchaseTenThousandths / 10000,
    hullPoints: Math.round(Math.ceil(hull.tons / 2.5) * hullType.points),
    armourRating: hullBuilt.builtInArmour + hullBuilt.pressureArmour + rating,
    hardpoints: points.count,
    hardpointsUsed: weapons.usedPoints,
    jumpFuel: drives.jumpFuel,
    powerFuel: drives.powerFuel,
    fuelMinimum: drives.fuelMinimum,
    fuelCapacity: drives.fuelTons + drives.containerTons,
    powerPlantTons: drives.plantTonsShown,
    powerRequired: drives.powerUse.total,
    powerUse: drives.powerUse,
    thrustRating: drives.thrustRating,
    jumpRating: drives.jumpRating,
    crew,
    errors,
    warnings,
  };
}
