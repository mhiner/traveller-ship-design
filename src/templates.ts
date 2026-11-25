import { type AdvancedDesign, blankDesign, evaluateDesign } from "./design.ts";
import type { ShipClassification } from "./classification.ts";
import {
  bridgesAt,
  installedSoftware,
  MOUNT_KINDS,
  type MountKindId,
  powerPlantsAt,
  type SoftwareId,
  TURRET_WEAPONS,
  type TurretWeaponId,
  type WeaponMount,
  type WorkSpace,
  type WorkSpaceId,
} from "./tables.ts";

function filledMounts(
  kind: MountKindId,
  count: number,
  weapon: TurretWeaponId,
): WeaponMount[] {
  const capacity = MOUNT_KINDS.find((row) => row.id === kind)?.weapons ?? 1;
  return Array.from({ length: count }, (_, index) => ({
    id: `${kind}-${index + 1}`,
    kind,
    weapons: Array.from({ length: capacity }, () => weapon),
  }));
}

function mounts(
  kind: MountKindId,
  count: number,
  weapons: TurretWeaponId[] = [],
): WeaponMount[] {
  return Array.from(
    { length: count },
    (_, index) => ({ id: `${kind}-${index + 1}`, kind, weapons }),
  );
}

function design(
  name: string,
  patch: Partial<AdvancedDesign> & {
    evade?: boolean;
    singleTurrets?: number;
    doubleTurrets?: number;
    tripleTurrets?: number;
    barbettes?: number;
    turretWeapon?: TurretWeaponId;
    workshops?: number;
    medicalBays?: number;
    armouries?: number;
    airlocks?: number;
    laboratories?: number;
    studios?: number;
    briefings?: number;
    unrep?: number;
  },
): AdvancedDesign {
  const {
    evade,
    singleTurrets,
    doubleTurrets,
    tripleTurrets,
    barbettes: _barbettes,
    turretWeapon,
    workshops,
    medicalBays,
    armouries: _armouries,
    airlocks,
    laboratories,
    studios,
    briefings,
    unrep,
    ...rest
  } = patch;
  const draft = { ...blankDesign(`template-${name}`), name, ...rest };
  if (!("commonTons" in patch)) draft.commonTons = draft.staterooms;
  if (
    "singleTurrets" in patch || "doubleTurrets" in patch ||
    "tripleTurrets" in patch || "turretWeapon" in patch
  ) {
    const weapon = TURRET_WEAPONS.some((row) => row.id === turretWeapon)
      ? turretWeapon!
      : "pulse";
    draft.mounts = [
      ...filledMounts("single", singleTurrets ?? 0, weapon),
      ...filledMounts("double", doubleTurrets ?? 0, weapon),
      ...filledMounts("triple", tripleTurrets ?? 0, weapon),
    ];
  }
  const spaces: WorkSpace[] = [];
  const addSpace = (kind: WorkSpaceId, count: number | undefined) => {
    if (!count || count <= 0) return;
    spaces.push({ id: `${kind}-1`, kind, quantity: count });
  };
  addSpace("laboratory", laboratories);
  addSpace("medical", medicalBays);
  addSpace("studio", studios);
  addSpace("workshop", workshops);
  addSpace("briefing", briefings);
  addSpace("airlock", airlocks);
  addSpace("unrep", unrep);
  draft.workSpaces = spaces;
  const available = powerPlantsAt(draft.techLevel);
  draft.powerPlant = available.some((plant) => plant.id === patch.powerPlant)
    ? patch.powerPlant!
    : available[available.length - 1]?.id ?? draft.powerPlant;
  const required = evaluateDesign({ ...draft, power: 0 }).powerUse.total;
  draft.power = typeof patch.power === "number" && patch.power > 0
    ? patch.power
    : required;
  if (!bridgesAt(draft.hullTons).some((bridge) => bridge.id === draft.bridge)) {
    draft.bridge = draft.hullTons <= 50 ? "cockpit" : "bridge";
  }
  const groups = new Set(
    installedSoftware(draft.software).map((program) => program.group),
  );
  if (draft.jump > 0 && !groups.has("jump")) {
    draft.software = [...draft.software, `jump${draft.jump}` as SoftwareId];
  }
  if (evade && !groups.has("evade")) {
    draft.software = [...draft.software, "evade1"];
  }
  if (!("classification" in patch)) draft.classification = "Other";
  if (!("standardDesign" in patch)) draft.standardDesign = true;
  return draft;
}

function cutterModule(
  name: string,
  patch: Parameters<typeof design>[1],
): AdvancedDesign {
  const draft = design(name, {
    jump: 0,
    thrust: 0,
    scoops: false,
    software: [],
    bridge: "cockpit",
    commonTons: 0,
    ...patch,
    hullType: "module",
  });
  if (!(typeof patch.power === "number" && patch.power > 0)) draft.power = 0;
  draft.hullType = "module";
  draft.classification = "Other";
  return draft;
}

/** Some of the official designs from High Guard and Adventure Class ships.  Used to validate calulations */
export const STANDARD_DESIGNS: AdvancedDesign[] = [
  design("Light Fighter", {
    hullTons: 10,
    configuration: "streamlined",
    armour: "crystaliron",
    armourRating: 2,
    techLevel: 12,
    thrust: 6,
    jump: 0,
    powerPlant: "fusion12",
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    sensors: "improved",
    mounts: mounts("fixed", 1, ["pulse"]),
    software: ["manoeuvre", "intellect", "library", "fire1"],
    bridge: "cockpit",
    staterooms: 0,
    lowBerths: 0,
    commonTons: 0,
    scoops: true,
  }),
  design("Launch", {
    hullTons: 20,
    configuration: "streamlined",
    techLevel: 12,
    thrust: 1,
    jump: 0,
    powerPlant: "fusion8",
    power: 10,
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    sensors: "basic",
    software: ["manoeuvre", "intellect", "library"],
    bridge: "bridge",
    staterooms: 0,
    lowBerths: 0,
    commonTons: 0,
    scoops: true,
  }),
  design("Ship's Boat", {
    hullTons: 30,
    configuration: "streamlined",
    techLevel: 12,
    thrust: 5,
    jump: 0,
    powerPlant: "fusion12",
    power: 22.5,
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    sensors: "basic",
    mounts: mounts("fixed", 1),
    software: ["manoeuvre", "intellect", "library"],
    bridge: "bridge",
    staterooms: 0,
    lowBerths: 0,
    commonTons: 0,
    cabinSpaces: 6,
    airlocks: 1,
    scoops: true,
  }),
  design("Slow Pinnace", {
    hullTons: 40,
    configuration: "streamlined",
    techLevel: 12,
    thrust: 3,
    jump: 0,
    powerPlant: "fusion8",
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    sensors: "basic",
    mounts: mounts("fixed", 1),
    bridge: "bridge",
    staterooms: 0,
    lowBerths: 0,
    commonTons: 0,
    airlocks: 1,
    scoops: true,
  }),
  design("Scout", {
    hullTons: 100,
    configuration: "streamlined",
    classification: "Scout",
    armour: "crystaliron",
    armourRating: 4,
    techLevel: 12,
    thrust: 2,
    jump: 2,
    powerPlant: "fusion12",
    powerWeeks: 12,
    fuelTons: 23,
    computer: "core5",
    computerType: "bis",
    sensors: "military",
    mounts: mounts("double", 1),
    staterooms: 4,
    lowBerths: 0,
    commonTons: 0,
    processorTons: 2,
    workshops: 1,
    scoops: true,
  }),
  design("Seeker", {
    hullTons: 100,
    configuration: "streamlined",
    classification: "Scout",
    armour: "crystaliron",
    armourRating: 4,
    techLevel: 12,
    thrust: 2,
    jump: 2,
    powerPlant: "fusion12",
    powerWeeks: 4,
    fuelTons: 21,
    computer: "core5",
    computerType: "bis",
    sensors: "military",
    mounts: mounts("double", 1),
    staterooms: 2,
    lowBerths: 0,
    commonTons: 0,
    processorTons: 1,
    scoops: true,
    power: 60,
    software: ["jump2", "library", "manoeuvre", "intellect"],
    docks: [{ id: "buggy", craft: "prospecting-buggy" }],
  }),
  design("Medical Scout", {
    standardDesign: false,
    classification: "Scout",
    hullTons: 400,
    configuration: "standard",
    techLevel: 14,
    thrust: 2,
    jump: 3,
    powerPlant: "fusion12",
    power: 300,
    powerWeeks: 12,
    fuelTons: 127,
    computer: "core15",
    sensors: "military",
    additionalSensors: [{ id: "life", kind: "lifeAnalysis", tons: 1 }],
    mounts: mounts("double", 1),
    software: ["manoeuvre", "jump3", "intellect", "library"],
    staterooms: 8,
    lowBerths: 20,
    commonTons: 32,
    processorTons: 3,
    scoops: true,
    medicalBays: 6,
    laboratories: 1,
    briefings: 1,
    docks: [
      { id: "pinnace", craft: "template-Slow Pinnace" },
      { id: "raft-1", craft: "air-raft" },
      { id: "raft-2", craft: "air-raft" },
    ],
  }),
  design("Free Trader", {
    hullTons: 200,
    configuration: "streamlined",
    classification: "Free Trader",
    armour: "crystaliron",
    armourRating: 2,
    techLevel: 12,
    thrust: 1,
    jump: 1,
    powerPlant: "fusion12",
    power: 75,
    powerWeeks: 4,
    fuelTons: 21,
    computer: "core5",
    sensors: "civilian",
    staterooms: 10,
    lowBerths: 20,
    processorTons: 1,
    scoops: true,
    cargoGear: [{ id: "crane", kind: "crane", quantity: 1 }],
  }),
  design("Far Trader", {
    hullTons: 200,
    configuration: "streamlined",
    classification: "Free Trader",
    armour: "crystaliron",
    armourRating: 2,
    techLevel: 12,
    thrust: 1,
    jump: 2,
    powerPlant: "fusion12",
    power: 75,
    powerWeeks: 4,
    fuelTons: 41,
    computer: "core5",
    computerType: "bis",
    sensors: "civilian",
    staterooms: 10,
    lowBerths: 0,
    processorTons: 2,
    scoops: true,
    cargoGear: [{ id: "crane", kind: "crane", quantity: 1 }],
  }),
  design("Volitant Far Trader", {
    standardDesign: false,
    classification: "Free Trader",
    hullTons: 200,
    configuration: "streamlined",
    armour: "bonded",
    armourRating: 4,
    techLevel: 14,
    thrust: 1,
    jump: 2,
    powerPlant: "fusion12",
    power: 90,
    powerWeeks: 4,
    fuelTons: 41,
    computer: "core5",
    computerType: "bis",
    sensors: "civilian",
    holographicControls: true,
    software: ["manoeuvre", "intellect", "library", "jump2"],
    mounts: mounts("double", 1),
    staterooms: 10,
    lowBerths: 0,
    commonTons: 10,
    processorTons: 2,
    scoops: true,
    hullOptions: [{ id: "fins", kind: "aerofins" }],
    cargoGear: [
      { id: "crane", kind: "crane", quantity: 1 },
      { id: "belt", kind: "belt12", quantity: 1 },
    ],
  }),
  design("Yacht", {
    hullTons: 200,
    configuration: "standard",
    classification: "Yacht",
    techLevel: 12,
    thrust: 1,
    jump: 1,
    powerPlant: "fusion12",
    power: 90,
    powerWeeks: 8,
    fuelTons: 22,
    computer: "core5",
    sensors: "civilian",
    software: ["manoeuvre", "intellect", "library", "jump1"],
    staterooms: 12,
    luxuryStaterooms: 1,
    lowBerths: 0,
    commonTons: 13,
    processorTons: 1,
    studios: 1,
    scoops: false,
    amenities: [
      { id: "kitchen", kind: "kitchen", quantity: 6 },
      { id: "tub", kind: "hotTub", quantity: 4 },
      { id: "theatre", kind: "theatre", quantity: 1 },
      { id: "bar", kind: "wetBar", quantity: 1 },
      { id: "gym", kind: "training", quantity: 2 },
    ],
    docks: [
      { id: "raft", craft: "air-raft" },
      { id: "boat", craft: "template-Ship's Boat" },
      { id: "atv", craft: "atv", stowed: true },
    ],
  }),
  design("Subsidised Merchant", {
    hullTons: 400,
    configuration: "streamlined",
    techLevel: 12,
    thrust: 1,
    jump: 1,
    powerPlant: "fusion12",
    power: 135,
    powerWeeks: 4,
    fuelTons: 41,
    computer: "core5",
    sensors: "civilian",
    software: ["jump1", "library", "manoeuvre", "intellect"],
    docks: [{ id: "launch", craft: "template-Launch" }],
    staterooms: 19,
    lowBerths: 9,
    commonTons: 5.5,
    processorTons: 1,
    scoops: true,
  }),
  design("Mercenary Cruiser", {
    hullTons: 800,
    configuration: "sphere",
    armour: "crystaliron",
    armourRating: 3,
    techLevel: 12,
    thrust: 3,
    jump: 3,
    driveCustom: {
      thrust: { tier: "very", options: ["energyEfficient", "energyEfficient"] },
      jump: { tier: "standard", options: [] },
      plant: { tier: "standard", options: [] },
    },
    powerPlant: "fusion12",
    power: 540,
    powerWeeks: 8,
    fuelTons: 250,
    computer: "core20",
    computerType: "fib",
    sensors: "military",
    holographicControls: true,
    mounts: mounts("triple", 8),
    software: ["manoeuvre", "intellect", "library", "jump3", "evade1", "fire2"],
    staterooms: 15,
    luxuryStaterooms: 1,
    barracks: 30,
    commonTons: 24,
    processorTons: 6,
    scoops: true,
    medicalBays: 2,
    briefings: 1,
    workshops: 1,
    amenities: [
      { id: "armoury", kind: "armoury", quantity: 7 },
      { id: "training", kind: "training", quantity: 5 },
    ],
    hullOptions: [{ id: "radiation", kind: "radiation" }],
    docks: [
      { id: "cutter-1", craft: "template-Modular Cutter" },
      { id: "cutter-2", craft: "template-Modular Cutter" },
      { id: "module-1", craft: "berth-30" },
      { id: "module-2", craft: "berth-30" },
      { id: "raft", craft: "air-raft" },
    ],
  }),
  design("Patrol Corvette", {
    hullTons: 400,
    configuration: "streamlined",
    armour: "crystaliron",
    armourRating: 4,
    techLevel: 12,
    thrust: 4,
    jump: 3,
    powerPlant: "fusion12",
    powerWeeks: 4,
    fuelTons: 122,
    computer: "core15",
    sensors: "military",
    mounts: [
      ...mounts("triple", 2, ["pulse", "pulse", "pulse"]),
      ...mounts("triple", 2, ["missile", "missile", "missile"]).map((
        mount,
        index,
      ) => ({ ...mount, id: `missile-${index + 1}` })),
    ],
    software: ["manoeuvre", "intellect", "library", "jump3", "evade1", "fire1"],
    staterooms: 12,
    lowBerths: 4,
    commonTons: 10,
    processorTons: 4,
    scoops: true,
  }),
  design("Subsidised Liner", {
    hullTons: 600,
    configuration: "standard",
    techLevel: 12,
    thrust: 1,
    jump: 3,
    powerPlant: "fusion12",
    powerWeeks: 4,
    fuelTons: 183,
    computer: "core10",
    computerType: "bis",
    sensors: "civilian",
    staterooms: 30,
    lowBerths: 20,
    commonTons: 34,
    medicalBays: 1,
    studios: 2,
    scoops: false,
  }),
  design("Modular Cutter", {
    hullTons: 50,
    configuration: "streamlined",
    techLevel: 12,
    thrust: 4,
    jump: 0,
    powerPlant: "fusion12",
    power: 30,
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    sensors: "basic",
    mounts: mounts("fixed", 1),
    bridge: "bridge",
    cabinSpaces: 4,
    airlocks: 1,
    scoops: true,
    hullOptions: [{ id: "module", kind: "modular", tons: 30, modules: [] }],
  }),
  cutterModule("Vehicle Cradle Module", {
    hullTons: 30,
    configuration: "streamlined",
    techLevel: 7,
    accelerationSeats: 12,
    docks: [{ id: "berth", craft: "berth-15" }],
  }),
  cutterModule("Cargo Transport Module", {
    hullTons: 30,
    configuration: "streamlined",
    techLevel: 7,
    accelerationSeats: 10,
  }),
  cutterModule("Personnel Transport Module", {
    hullTons: 30,
    configuration: "streamlined",
    techLevel: 7,
    accelerationSeats: 60,
  }),
  cutterModule("Fuel Skimmer Module", {
    hullTons: 30,
    configuration: "streamlined",
    techLevel: 7,
    fuelTons: 28,
    scoops: true,
    unrep: 2,
  }),
  design("Ultralight Fighter", {
    hullTons: 6,
    configuration: "streamlined",
    armour: "crystaliron",
    armourRating: 3,
    techLevel: 12,
    thrust: 6,
    jump: 0,
    powerPlant: "fusion12",
    power: 15,
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    sensors: "civilian",
    mounts: mounts("fixed", 1, ["pulse"]),
    bridge: "cockpit",
    staterooms: 0,
    lowBerths: 0,
    commonTons: 0,
    scoops: false,
    hullOptions: [{ id: "coat", kind: "stealthImproved" }],
  }),
  cutterModule("Fighter Frame Module", {
    hullTons: 30,
    configuration: "distributed",
    techLevel: 12,
    docks: [1, 2, 3, 4].map((index) => ({
      id: `clamp-${index}`,
      craft: "template-Ultralight Fighter",
      clamp: true,
    })),
  }),
  cutterModule("Pressurised Shelter Module", {
    hullTons: 30,
    configuration: "streamlined",
    techLevel: 8,
    powerPlant: "fusion8",
    power: 10,
    powerWeeks: 4,
    fuelTons: 1,
    computer: "core5",
    software: ["library"],
    staterooms: 4,
    commonTons: 4,
    airlocks: 1,
    powered: true,
  }),
  design("Cutlass", {
    description:
      "This is the Tulwar's daughter ship.  Two cutlasses are assigned to the Tulwar as breakaway hulls, adding their thrust and power to the combined ship.\n\nThe ship also has an interstellar jump net, demonstrating how to combine external cargo capacity with the parent ship.",
    classification: "Other",
    hullTons: 30,
    configuration: "streamlined",
    hullType: "light",
    armour: "bonded",
    armourRating: 14,
    techLevel: 14,
    thrust: 8,
    powerPlant: "fusion12",
    power: 33,
    powerWeeks: 4,
    computer: "core5",
    sensors: "basic",
    software: ["manoeuvre", "intellect", "library"],
    mounts: [{ id: "cutlass-pulse", kind: "fixed", weapons: ["pulse"] }],
    accelerationBenches: 1,
    scoops: true,
    externalSystems: [{ id: "cutlass-tow", kind: "tow", quantity: 1 }],
    hullOptions: [
      { id: "cutlass-module", kind: "modular", tons: 12, modules: [] },
      { id: "cutlass-breakaway", kind: "breakaway" },
    ],
    cargoGear: [{ id: "cutlass-net", kind: "jumpNet", quantity: 70 }],
    bridge: "bridge",
    driveCustom: {
      thrust: { tier: "standard", options: [] },
      jump: { tier: "standard", options: [] },
      plant: { tier: "very", options: ["sizeReduction", "sizeReduction"] },
    },
  }),
  design("Tulwar", {
    description:
      "An example of a ship with a breakaway hull.  For this design system, each hull is created as an independent design with the breakaway hull option.  Then, you can add other hulls with the breakaway option to the parent ship.  Hulls can be nested to an arbitrary level of depth. Recursion checks are in place, but you can break them if you intentionally force recursion.   TLDR: if you make a circular assignment of breakaway hulls, it is on you.\n\nThe Tulwar also uses a custom effective tonnage for both the jump and maneuver drive to account for the combined ship's end tonnage.  This is set in the drive customizations.\n\nAdditionally, this ship uses a jump net and a fuel/cargo container to demonstrate cargo interactions with those two components.",
    classification: "Other",
    hullTons: 180,
    configuration: "close",
    armour: "crystaliron",
    techLevel: 14,
    thrust: 1,
    jump: 3,
    powerPlant: "fusion12",
    power: 90,
    powerWeeks: 4,
    containerTons: 72,
    computer: "core10",
    computerType: "bis",
    sensors: "basic",
    software: ["manoeuvre", "intellect", "library", "jump3"],
    mounts: [{ id: "tulwar-turret", kind: "double", weapons: [] }],
    staterooms: 6,
    doubleStaterooms: 2,
    processorTons: 1,
    scoops: true,
    commonTons: 6,
    hullOptions: [
      { id: "tulwar-breakaway", kind: "breakaway" },
      { id: "tulwar-module-1", kind: "modular", tons: 12, modules: [] },
      { id: "tulwar-module-2", kind: "modular", tons: 12, modules: [] },
    ],
    breakawayHulls: ["template-Cutlass", "template-Cutlass"],
    cargoGear: [{ id: "tulwar-net", kind: "jumpNet", quantity: 240 }],
    bridge: "bridge",
    driveCustom: {
      thrust: { tier: "standard", options: [], effectiveTons: 240 },
      jump: { tier: "standard", options: [], effectiveTons: 240 },
      plant: { tier: "standard", options: [] },
    },
  }),
];
