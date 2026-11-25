import {
  type AdvancedDesign,
  blankDesign,
  type Dock,
  legalMounts,
} from "./design.ts";
import {
  resolveAdditionalSensors,
  resolveAmenities,
  resolveCargoGear,
  resolveDocks,
  resolveDrones,
  resolveExternalSystems,
  resolveHullOptions,
  resolveWorkSpaces,
} from "./resolve.ts";
import { customBrainFrom } from "./shipBrain.ts";
import {
  SHIP_CLASSIFICATIONS,
  type ShipClassification,
} from "./classification.ts";
import {
  type AdditionalSensor,
  type AdditionalSensorId,
  type Amenity,
  type AmenityId,
  ARMOUR,
  blankDriveCustom,
  type BridgeId,
  BRIDGES,
  bridgesAt,
  type CargoGear,
  type CargoGearId,
  clampHullTons,
  COMPUTER_TYPES,
  COMPUTERS,
  CONFIGURATIONS,
  DOCK_VEHICLES,
  EMPTY_DOCK_CRAFT,
  type DriveCustom,
  type DriveCustoms,
  driveTier,
  type DroneFit,
  type DroneId,
  type ExternalSystem,
  type ExternalSystemId,
  FORCED_LINKAGE,
  HULL_OPTIONS,
  HULL_TYPES,
  type HullOption,
  installedSoftware,
  MOUNT_KINDS,
  type MountKindId,
  type MountWeaponId,
  POWER_PLANTS,
  SENSORS,
  SHIP_BRAIN_INTERFACES,
  SHIP_BRAINS,
  type SoftwareId,
  TURRET_WEAPONS,
  type TurretWeaponId,
  type WeaponMount,
  weaponsForMount,
  type WorkSpace,
  type WorkSpaceId,
} from "./tables.ts";

function oneOf<T extends { id: string }>(
  rows: readonly T[],
  value: unknown,
  fallback: T["id"],
): T["id"] {
  return rows.some((row) => row.id === value) ? value as T["id"] : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fuelContainers(value: unknown): { id: string; tons: number }[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: { id: string; tons: number }[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as { id?: unknown; tons?: unknown };
    let id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || seen.has(id)) id = freshDesignId();
    seen.add(id);
    rows.push({ id, tons: Math.max(0, Math.round(num(record.tons, 0))) });
  }
  return rows;
}

function freshDesignId(): string {
  return crypto.randomUUID();
}

function emptyExportValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number") return value === 0;
  if (typeof value === "string") return value === "";
  if (typeof value === "boolean") return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Drops zeros, empty strings, false, and empty lists or objects. A blank name stays so the file still imports. */
function pruneExport(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => pruneExport(item)).filter((item) =>
      !emptyExportValue(item)
    );
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "name") {
      result.name = typeof item === "string" ? item : "";
      continue;
    }
    const pruned = pruneExport(item);
    if (emptyExportValue(pruned)) continue;
    result[key] = pruned;
  }
  return result;
}

function softwareList(
  value: unknown,
  evade: boolean | undefined,
): SoftwareId[] {
  const source = Array.isArray(value) ? value : [];
  const ids = installedSoftware(
    source.filter((item): item is string => typeof item === "string"),
  ).map((program) => program.id);
  if (evade && !ids.some((id) => id.startsWith("evade"))) ids.push("evade1");
  return ids;
}

function mountsFrom(
  source: Record<string, unknown>,
  hullTons: number,
): WeaponMount[] {
  if (Array.isArray(source.mounts)) {
    const parsed = source.mounts.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const mount = item as { id?: unknown; kind?: unknown; weapons?: unknown };
      if (!MOUNT_KINDS.some((kind) => kind.id === mount.kind)) return [];
      const row = mount as {
        id?: unknown;
        kind?: unknown;
        weapons?: unknown;
        custom?: unknown;
        popup?: unknown;
      };
      const weapons = Array.isArray(row.weapons)
        ? row.weapons.filter((id): id is MountWeaponId =>
          weaponsForMount(row.kind as MountKindId).some((weapon) =>
            weapon.id === id
          )
        )
        : [];
      const source = Array.isArray(row.custom) ? row.custom : [];
      const custom = weapons.map((_, slot) => drivePart(source[slot]));
      const kept = custom.some((item) =>
        item.tier !== "standard" || item.options.length > 0
      );
      return [{
        id: typeof row.id === "string" ? row.id : `mount-${index + 1}`,
        kind: row.kind as MountKindId,
        weapons,
        ...(kept ? { custom } : {}),
        ...(row.popup === true && row.kind !== "barbette"
          ? { popup: true }
          : {}),
      }];
    });
    return legalMounts(hullTons, parsed);
  }
  const hasLegacy = "singleTurrets" in source || "doubleTurrets" in source ||
    "tripleTurrets" in source || "turretWeapon" in source;
  if (!hasLegacy) return blankDesign().mounts;
  const weapon = oneOf(
    TURRET_WEAPONS,
    source.turretWeapon,
    "pulse",
  ) as TurretWeaponId;
  const mounts: WeaponMount[] = [];
  const add = (kind: MountKindId, count: number) => {
    const capacity = MOUNT_KINDS.find((row) => row.id === kind)?.weapons ?? 1;
    for (let index = 0; index < count; index += 1) {
      mounts.push({
        id: `${kind}-${index + 1}`,
        kind,
        weapons: Array.from({ length: capacity }, () => weapon),
      });
    }
  };
  add("single", num(source.singleTurrets, 0));
  add("double", num(source.doubleTurrets, 0));
  add("triple", num(source.tripleTurrets, 0));
  return legalMounts(hullTons, mounts);
}

function workSpacesFrom(
  source: { workSpaces?: unknown; workshops?: number; medicalBays?: number },
): WorkSpace[] {
  const loose: WorkSpace[] = [];
  if (Array.isArray(source.workSpaces)) {
    for (const item of source.workSpaces) {
      if (!item || typeof item !== "object") continue;
      const space = item as {
        id?: unknown;
        kind?: unknown;
        quantity?: unknown;
        avatarChair?: unknown;
        fabrication?: unknown;
        droneController?: unknown;
        swarmController?: unknown;
      };
      if (typeof space.kind !== "string") continue;
      loose.push({
        id: typeof space.id === "string" ? space.id : `${space.kind}-1`,
        kind: space.kind as WorkSpaceId,
        quantity: num(space.quantity, 1),
        avatarChair: typeof space.avatarChair === "string"
          ? space.avatarChair as WorkSpace["avatarChair"]
          : undefined,
        fabrication: typeof space.fabrication === "string"
          ? space.fabrication as WorkSpace["fabrication"]
          : undefined,
        droneController: typeof space.droneController === "string"
          ? space.droneController as WorkSpace["droneController"]
          : undefined,
        swarmController: typeof space.swarmController === "string"
          ? space.swarmController as WorkSpace["swarmController"]
          : undefined,
      });
    }
  } else {
    if (num(source.workshops, 0) > 0) {
      loose.push({
        id: "workshop-1",
        kind: "workshop",
        quantity: num(source.workshops, 0),
      });
    }
    if (num(source.medicalBays, 0) > 0) {
      loose.push({
        id: "medical-1",
        kind: "medical",
        quantity: num(source.medicalBays, 0),
      });
    }
  }
  return resolveWorkSpaces(loose);
}

function externalSystemsFrom(value: unknown): ExternalSystem[] {
  if (!Array.isArray(value)) return [];
  const loose: ExternalSystem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const system = item as {
      id?: unknown;
      kind?: unknown;
      quantity?: unknown;
      techLevel?: unknown;
    };
    if (typeof system.kind !== "string") continue;
    const tier = FORCED_LINKAGE.find((row) => row.tl === system.techLevel);
    loose.push({
      id: typeof system.id === "string" ? system.id : "",
      kind: system.kind as ExternalSystemId,
      quantity: typeof system.quantity === "number" ? system.quantity : 1,
      ...(system.kind === "linkage"
        ? { techLevel: tier?.tl ?? FORCED_LINKAGE[0].tl }
        : {}),
    });
  }
  return resolveExternalSystems(loose);
}

function cargoGearFrom(value: unknown, externalSystems?: unknown): CargoGear[] {
  const loose: CargoGear[] = [];
  const read = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const gear = item as { id?: unknown; kind?: unknown; quantity?: unknown };
    if (typeof gear.kind !== "string") return;
    loose.push({
      id: typeof gear.id === "string" ? gear.id : "",
      kind: gear.kind as CargoGearId,
      quantity: Math.max(1, Math.round(num(gear.quantity, 1))),
    });
  };
  if (Array.isArray(value)) { for (const item of value) read(item); }
  if (Array.isArray(externalSystems)) {
    for (const item of externalSystems) {
      if (!item || typeof item !== "object") continue;
      const system = item as { kind?: unknown };
      if (system.kind === "cargoNet" || system.kind === "cargoScoop") {
        read(item);
      }
    }
  }
  return resolveCargoGear(loose);
}

function dronesFrom(value: unknown): DroneFit[] {
  if (!Array.isArray(value)) return [];
  const loose: DroneFit[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const fit = item as { id?: unknown; kind?: unknown; quantity?: unknown };
    if (typeof fit.kind !== "string") continue;
    loose.push({
      id: typeof fit.id === "string" ? fit.id : "",
      kind: fit.kind as DroneId,
      quantity: Math.max(1, Math.round(num(fit.quantity, 1))),
    });
  }
  return resolveDrones(loose);
}

function docksFrom(
  value: unknown,
  bundled: AdvancedDesign[],
  stack: ReadonlySet<string>,
): Dock[] {
  if (!Array.isArray(value)) return [];
  const loose: Dock[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const dock = item as {
      id?: unknown;
      craft?: unknown;
      stowed?: unknown;
      clamp?: unknown;
      craftTons?: unknown;
    };
    const craft = referenceId(dock.craft, bundled, stack);
    if (!craft) continue;
    const craftTons = num(dock.craftTons, 0);
    loose.push({
      id: typeof dock.id === "string" ? dock.id : "",
      craft,
      ...(craft === EMPTY_DOCK_CRAFT && craftTons > 0 ? { craftTons } : {}),
      ...(dock.stowed === true ? { stowed: true } : {}),
      ...(dock.clamp === true ? { clamp: true } : {}),
    });
  }
  return resolveDocks(loose);
}

function amenitiesFrom(value: unknown, armouries = 0): Amenity[] {
  const loose: Amenity[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const amenity = item as {
        id?: unknown;
        kind?: unknown;
        quantity?: unknown;
      };
      if (typeof amenity.kind !== "string" || seen.has(amenity.kind)) continue;
      seen.add(amenity.kind);
      const quantity = typeof amenity.quantity === "number" &&
          Number.isFinite(amenity.quantity)
        ? Math.max(1, Math.round(amenity.quantity))
        : 1;
      loose.push({
        id: typeof amenity.id === "string" ? amenity.id : `${amenity.kind}-1`,
        kind: amenity.kind as AmenityId,
        quantity,
      });
    }
  }
  const legacy = Number.isFinite(armouries)
    ? Math.max(0, Math.round(armouries))
    : 0;
  if (legacy > 0 && !seen.has("armoury")) {
    loose.push({ id: "armoury-1", kind: "armoury", quantity: legacy });
  }
  return resolveAmenities(loose);
}

function referenceId(
  value: unknown,
  bundled: AdvancedDesign[],
  stack: ReadonlySet<string>,
): string | null {
  if (typeof value === "string" && value) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const peek = (value as { id?: unknown }).id;
  if (typeof peek === "string" && stack.has(peek)) return peek;
  const design = normalize(value, bundled, stack);
  if (!design) return null;
  if (!bundled.some((row) => row.id === design.id)) bundled.push(design);
  return design.id;
}

function referenceIds(
  value: unknown,
  bundled: AdvancedDesign[],
  stack: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    const id = referenceId(item, bundled, stack);
    if (id) ids.push(id);
  }
  return ids;
}

function moduleIdsFrom(
  value: unknown,
  bundled: AdvancedDesign[],
  stack: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  return referenceIds(value, bundled, stack).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function hullOptionsFrom(
  value: unknown,
  bundled: AdvancedDesign[],
  stack: ReadonlySet<string>,
): HullOption[] {
  if (!Array.isArray(value)) return [];
  const loose: HullOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const option = item as {
      id?: unknown;
      kind?: unknown;
      tons?: unknown;
      modules?: unknown;
      units?: unknown;
    };
    const kind = HULL_OPTIONS.find((row) => row.id === option.kind);
    if (!kind) continue;
    const id = typeof option.id === "string" ? option.id : "";
    if (kind.group === "solar") {
      loose.push({
        id,
        kind: kind.id,
        units: typeof option.units === "number" ? option.units : 0,
      });
      continue;
    }
    if (kind.id === "modular") {
      loose.push({
        id,
        kind: kind.id,
        tons: typeof option.tons === "number" ? option.tons : 0,
        modules: moduleIdsFrom(option.modules, bundled, stack),
      });
      continue;
    }
    loose.push({ id, kind: kind.id });
  }
  return resolveHullOptions(loose);
}

function additionalSensorsFrom(value: unknown): AdditionalSensor[] {
  if (!Array.isArray(value)) return [];
  const loose: AdditionalSensor[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const sensor = item as { id?: unknown; kind?: unknown; tons?: unknown };
    if (typeof sensor.kind !== "string") continue;
    loose.push({
      id: typeof sensor.id === "string" ? sensor.id : "",
      kind: sensor.kind as AdditionalSensorId,
      tons: typeof sensor.tons === "number" ? sensor.tons : 1,
    });
  }
  return resolveAdditionalSensors(loose);
}

function normalize(
  value: unknown,
  bundled: AdvancedDesign[] = [],
  stack: ReadonlySet<string> = new Set(),
): AdvancedDesign | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const legacy = value as Partial<AdvancedDesign> & {
    computerBis?: boolean;
    commandBridge?: boolean;
    evade?: boolean;
    singleTurrets?: number;
    doubleTurrets?: number;
    tripleTurrets?: number;
    barbettes?: number;
    turretWeapon?: string;
    workshops?: number;
    medicalBays?: number;
    armouries?: number;
  };
  if (typeof legacy.name !== "string") return null;
  const id = typeof legacy.id === "string" && legacy.id.trim()
    ? legacy.id
    : freshDesignId();
  if (stack.has(id)) return null;
  const name = legacy.name;
  const next = new Set(stack);
  next.add(id);
  const {
    computerBis,
    commandBridge,
    evade,
    singleTurrets,
    doubleTurrets,
    tripleTurrets,
    barbettes,
    turretWeapon,
    workshops,
    medicalBays,
    armouries,
    workSpaces,
    amenities,
    externalSystems,
    additionalSensors,
    docks,
    drones,
    cargoGear,
    hullOptions,
    breakawayHulls,
    shipBrain,
    shipBrainInterface,
    customShipBrain,
    ...row
  } = legacy;
  const blank = blankDesign(id);
  const hullTons = clampHullTons(num(row.hullTons, 0));
  const requestedBridge: BridgeId =
    BRIDGES.some((bridge) => bridge.id === row.bridge)
      ? row.bridge!
      : commandBridge
      ? "command"
      : blank.bridge;
  const bridge = bridgesAt(hullTons).some((item) => item.id === requestedBridge)
    ? requestedBridge
    : hullTons <= 50
    ? "cockpit"
    : "bridge";
  const hullType = oneOf(HULL_TYPES, row.hullType, blank.hullType);
  const parsedBrain = customBrainFrom(customShipBrain);
  return {
    ...blank,
    ...row,
    id,
    name,
    description: typeof row.description === "string" ? row.description : "",
    classification: hullType === "module"
      ? "Other"
      : (SHIP_CLASSIFICATIONS as readonly string[]).includes(
          String(row.classification),
        )
      ? row.classification as ShipClassification
      : blank.classification,
    hullTons,
    configuration: oneOf(
      CONFIGURATIONS,
      row.configuration,
      blank.configuration,
    ),
    hullType,
    armour: oneOf(ARMOUR, row.armour, blank.armour),
    armourRating: num(row.armourRating, 0),
    techLevel: num(row.techLevel, 0),
    thrust: num(row.thrust, 0),
    jump: num(row.jump, 0),
    powerPlant: oneOf(POWER_PLANTS, row.powerPlant, blank.powerPlant),
    power: num(row.power, 0),
    powerWeeks: num(row.powerWeeks, 0),
    fuelTons: num(row.fuelTons, 0),
    containerTons: num(row.containerTons, 0),
    extraContainers: fuelContainers(row.extraContainers),
    computer: oneOf(COMPUTERS, row.computer, blank.computer),
    computerType: oneOf(
      COMPUTER_TYPES,
      row.computerType,
      computerBis ? "bis" : blank.computerType,
    ),
    sensors: oneOf(SENSORS, row.sensors, blank.sensors),
    software: softwareList(row.software, evade),
    mounts: mountsFrom({
      ...legacy,
      singleTurrets,
      doubleTurrets,
      tripleTurrets,
      turretWeapon,
    }, hullTons),
    staterooms: num(row.staterooms, 0),
    doubleStaterooms: Math.min(
      num(row.staterooms, 0),
      Math.max(0, Math.trunc(num(row.doubleStaterooms, 0))),
    ),
    lowBerths: num(row.lowBerths, 0),
    emergencyLowBerths: Math.max(0, Math.trunc(num(row.emergencyLowBerths, 0))),
    cabinSpaces: num(row.cabinSpaces, 0),
    accelerationBenches: num(row.accelerationBenches, 0),
    accelerationSeats: num(row.accelerationSeats, 0),
    highStaterooms: num(row.highStaterooms, 0),
    luxuryStaterooms: num(row.luxuryStaterooms, 0),
    barracks: num(row.barracks, 0),
    brigs: Math.max(0, Math.trunc(num(row.brigs, 0))),
    processorTons: num(row.processorTons, 0),
    scoops: Boolean(row.scoops),
    standardDesign: Boolean(row.standardDesign),
    commonTons: num(row.commonTons, 0),
    workSpaces: workSpacesFrom({ workSpaces, workshops, medicalBays }),
    amenities: amenitiesFrom(
      amenities,
      typeof armouries === "number" ? armouries : 0,
    ),
    externalSystems: externalSystemsFrom(externalSystems),
    hullOptions: hullOptionsFrom(hullOptions, bundled, next),
    breakawayHulls: referenceIds(breakawayHulls, bundled, next),
    additionalSensors: additionalSensorsFrom(additionalSensors),
    docks: docksFrom(docks, bundled, next),
    drones: dronesFrom(drones),
    cargoGear: cargoGearFrom(cargoGear, externalSystems),
    bridge,
    holographicControls: row.holographicControls === true,
    sensorStations: Math.max(0, Math.trunc(num(row.sensorStations, 0))),
    shipBrain: oneOf(SHIP_BRAINS, shipBrain, "none"),
    shipBrainInterface: oneOf(SHIP_BRAINS, shipBrain, "none") === "none"
      ? "none"
      : oneOf(SHIP_BRAIN_INTERFACES, shipBrainInterface, "none"),
    ...(parsedBrain ? { customShipBrain: parsedBrain } : {}),
    ...(row.powered === true ? { powered: true } : {}),
    ...(driveCustomsFrom(row.driveCustom)
      ? { driveCustom: driveCustomsFrom(row.driveCustom) }
      : {}),
  };
}

function drivePart(value: unknown, keepTons = false): DriveCustom {
  const row = value && typeof value === "object"
    ? value as { tier?: unknown; options?: unknown; effectiveTons?: unknown }
    : {};
  const tier =
    driveTier(typeof row.tier === "string" ? row.tier : undefined).id;
  const options = Array.isArray(row.options)
    ? row.options.filter((id): id is string => typeof id === "string")
    : [];
  const requested = keepTons && typeof row.effectiveTons === "number" &&
      Number.isFinite(row.effectiveTons)
    ? Math.round(row.effectiveTons)
    : undefined;
  const effectiveTons = requested != null && requested > 0
    ? requested
    : undefined;
  if (tier === "standard" && options.length === 0 && effectiveTons == null) {
    return blankDriveCustom();
  }
  return { tier, options, ...(effectiveTons != null ? { effectiveTons } : {}) };
}

function driveCustomsFrom(value: unknown): DriveCustoms | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as { thrust?: unknown; jump?: unknown; plant?: unknown };
  const thrust = drivePart(row.thrust, true);
  const jump = drivePart(row.jump, true);
  const plant = drivePart(row.plant);
  const untouched = [thrust, jump, plant].every((part) =>
    part.tier === "standard" && part.options.length === 0 &&
    part.effectiveTons == null
  );
  if (untouched) return undefined;
  return { thrust, jump, plant };
}

/** One ship design from a JSON object. Embedded docked ships, modules, and breakaway hulls become ids. */
export function designFromJson(value: unknown): AdvancedDesign | null {
  if (Array.isArray(value)) return null;
  return normalize(value);
}

/** The design plus every docked ship, module, and breakaway hull embedded in its JSON. */
export function designBundleFromJson(
  value: unknown,
): { design: AdvancedDesign; bundled: AdvancedDesign[] } | null {
  if (Array.isArray(value)) return null;
  const bundled: AdvancedDesign[] = [];
  const design = normalize(value, bundled);
  if (!design) return null;
  return { design, bundled };
}

/** JSON for a design, with docked ships, modules, and breakaway hulls written in full. Zeros and empty values are left out. */
export function designForExport(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[],
  stack: ReadonlySet<string> = new Set(),
): unknown {
  const next = new Set(stack);
  next.add(design.id);
  const embed = (id: string): unknown => {
    if (next.has(id)) return id;
    const found = catalog.find((row) => row.id === id);
    if (!found) return id;
    return designForExport(found, catalog, next);
  };
  return pruneExport({
    ...design,
    docks: design.docks.map((dock) =>
      dock.craft === EMPTY_DOCK_CRAFT ||
      DOCK_VEHICLES.some((row) => row.id === dock.craft)
        ? dock
        : { ...dock, craft: embed(dock.craft) }
    ),
    hullOptions: design.hullOptions.map((option) =>
      option.kind === "modular"
        ? { ...option, modules: (option.modules ?? []).map((id) => embed(id)) }
        : option
    ),
    breakawayHulls: (design.breakawayHulls ?? []).map((id) => embed(id)),
  });
}

/** Designs stored as a list, skipping rows that are not a ship design. */
export function designsFromStored(value: unknown): AdvancedDesign[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const design = designFromJson(row);
    return design ? [design] : [];
  });
}
