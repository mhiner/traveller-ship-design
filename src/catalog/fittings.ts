/** A fuel/cargo container costs Cr5,000 per ton of capacity and takes 5% more hull space than that capacity. */
export const FUEL_CARGO_COST_PER_TON = 0.005;
export const FUEL_CARGO_TONS_FACTOR = 1.05;

/** Docking space costs MCr 0.25 per ton of the bay. The bay is the craft's tons plus 10%, rounded up. */
export const DOCKING_COST_PER_TON = 0.25;

/** Vehicles that can sit in a docking space. Costs are in MCr. */
export const DOCK_VEHICLES = [
  { id: "air-raft", label: "Air/raft", tons: 4, cost: 0.25 },
  { id: "atv", label: "ATV", tons: 10, cost: 0.155 },
  { id: "prospecting-buggy", label: "Prospecting buggy", tons: 4, cost: 0.27 },
  { id: "berth-15", label: "15-ton berth", tons: 15, cost: 0 },
  { id: "berth-30", label: "30-ton berth", tons: 30, cost: 0 },
] as const;

export type DockVehicleId = (typeof DOCK_VEHICLES)[number]["id"];

/** A docking space with no craft aboard. The bay is sized from the craft tonnage on the dock. */
export const EMPTY_DOCK_CRAFT = "empty";

export function dockingSpaceTons(craftTons: number): number {
  const tons = Number.isFinite(craftTons) ? Math.max(0, craftTons) : 0;
  return Math.ceil(Math.round(tons * 110) / 100);
}
export const FITTINGS = {
  stateroom: { label: "Stateroom", tons: 4, cost: 0.5 },
  common: { label: "Common space", tons: 1, cost: 0.1 },
  lowBerth: { label: "Low berth", tons: 0.5, cost: 0.05 },
  /** Holds four people. One power each. */
  emergencyLowBerth: { label: "Emergency low berth", tons: 1, cost: 1 },
  cabin: { label: "Cabin space", tons: 1.5, costPerTon: 0.05 },
  /** Four seats in one ton. */
  accelerationBench: { label: "Acceleration bench", tons: 1, cost: 0.01 },
  accelerationSeat: { label: "Acceleration seat", tons: 0.5, cost: 0.03 },
  highStateroom: { label: "High stateroom", tons: 6, cost: 0.8 },
  luxuryStateroom: { label: "Luxury stateroom", tons: 10, cost: 1.5 },
  /** One passenger per ton at Cr50,000. */
  barracks: { label: "Barracks", tons: 1, cost: 0.05 },
  /** One cell holds six prisoners. Life support is Cr1,000. */
  brig: { label: "Brig", tons: 4, cost: 0.25 },
  processor: { label: "Fuel processor", tons: 1, cost: 0.05 },
  scoops: { label: "Fuel scoops", tons: 0, cost: 1 },
} as const;
/** One of each is the listed size. Studio price is MCr0.1 per ton. Laboratory price is MCr1 per four tons. An airlock is the two-ton minimum at MCr0.1 per ton. A robotics laboratory is the spacecraft shell: 4 tons and Cr500,000. */
export const WORK_SPACES = [
  { id: "laboratory", label: "Laboratory", tons: 4, cost: 1, power: 0, tl: 0 },
  {
    id: "robotics",
    label: "Robotics Laboratory",
    tons: 4,
    cost: 0.5,
    power: 0,
    tl: 0,
  },
  { id: "medical", label: "Medical Bay", tons: 4, cost: 2, power: 1, tl: 0 },
  { id: "studio", label: "Studio", tons: 4, cost: 0.4, power: 0, tl: 0 },
  { id: "workshop", label: "Workshop", tons: 6, cost: 0.9, power: 0, tl: 0 },
  { id: "library", label: "Library", tons: 4, cost: 4, power: 0, tl: 8 },
  {
    id: "briefing",
    label: "Briefing Room",
    tons: 4,
    cost: 0.5,
    power: 0,
    tl: 0,
  },
  { id: "airlock", label: "Airlock", tons: 2, cost: 0.2, power: 0, tl: 0 },
  { id: "unrep", label: "UNREP system", tons: 1, cost: 0.5, power: 1, tl: 7 },
] as const;

export type WorkSpaceId = (typeof WORK_SPACES)[number]["id"];

/** Fitted inside a robotics laboratory. The laboratory has room for one of each, so they add no tons. */
export const ROBOTICS_AVATAR_CHAIRS = [
  { id: "none", label: "No avatar chair", tl: 0, cost: 0 },
  { id: "standard", label: "Avatar chair", tl: 13, cost: 0.3 },
  { id: "deluxe", label: "Deluxe avatar chair", tl: 13, cost: 0.5 },
] as const;

/** 128-slot chamber that fits in the laboratory. */
export const ROBOTICS_FABRICATORS = [
  { id: "none", label: "No fabrication chamber", tl: 0, cost: 0 },
  { id: "basic", label: "Basic", tl: 8, cost: 0.25 },
  { id: "improved", label: "Improved", tl: 10, cost: 1.25 },
  { id: "enhanced", label: "Enhanced", tl: 13, cost: 6 },
  { id: "advanced", label: "Advanced", tl: 17, cost: 24 },
] as const;

/** Robotic drone controller installed in the laboratory. */
export const ROBOTICS_DRONE_CONTROLLERS = [
  { id: "none", label: "No drone controller", tl: 0, cost: 0 },
  { id: "basic", label: "Basic", tl: 7, cost: 0.002 },
  { id: "improved", label: "Improved", tl: 9, cost: 0.01 },
  { id: "enhanced", label: "Enhanced", tl: 10, cost: 0.02 },
  { id: "advanced", label: "Advanced", tl: 11, cost: 0.05 },
] as const;

/** Swarm controller installed in the laboratory. */
export const ROBOTICS_SWARM_CONTROLLERS = [
  { id: "none", label: "No swarm controller", tl: 0, cost: 0 },
  { id: "basic", label: "Basic", tl: 8, cost: 0.01 },
  { id: "improved", label: "Improved", tl: 10, cost: 0.02 },
  { id: "enhanced", label: "Enhanced", tl: 12, cost: 0.05 },
  { id: "advanced", label: "Advanced", tl: 14, cost: 0.1 },
] as const;

export type RoboticsAvatarChairId =
  (typeof ROBOTICS_AVATAR_CHAIRS)[number]["id"];
export type RoboticsFabricatorId = (typeof ROBOTICS_FABRICATORS)[number]["id"];
export type RoboticsDroneControllerId =
  (typeof ROBOTICS_DRONE_CONTROLLERS)[number]["id"];
export type RoboticsSwarmControllerId =
  (typeof ROBOTICS_SWARM_CONTROLLERS)[number]["id"];

export function roboticsAvatarChair(id: string | undefined) {
  return ROBOTICS_AVATAR_CHAIRS.find((row) => row.id === id) ??
    ROBOTICS_AVATAR_CHAIRS[0];
}

export function roboticsFabricator(id: string | undefined) {
  return ROBOTICS_FABRICATORS.find((row) => row.id === id) ??
    ROBOTICS_FABRICATORS[0];
}

export function roboticsDroneController(id: string | undefined) {
  return ROBOTICS_DRONE_CONTROLLERS.find((row) => row.id === id) ??
    ROBOTICS_DRONE_CONTROLLERS[0];
}

export function roboticsSwarmController(id: string | undefined) {
  return ROBOTICS_SWARM_CONTROLLERS.find((row) => row.id === id) ??
    ROBOTICS_SWARM_CONTROLLERS[0];
}

/** Additions to the common area. A hot tub is priced per ton. A theatre uses the MCr 0.2 per ton rate. Training draws 1 power point for every two trainees. A biosphere is MCr 0.2 and 1 power per ton, and covers life support for two passengers per ton. An armoury is 1 ton at MCr 0.25, and one ton covers 25 crew or 5 marines. A brewery is tech level 10, 0.5 tons and MCr 0.05, and makes 10 litres a week. A swimming pool is at least 4 tons at Cr20,000 per ton. An endless pool is 2 tons and Cr50,000. */
export const AMENITIES = [
  {
    id: "kitchen",
    label: "Gourmet kitchen",
    per: "diner",
    tons: 1,
    costPerTon: 0.2,
    costEach: 0,
  },
  {
    id: "hotTub",
    label: "Hot tub",
    per: "seat",
    tons: 0.25,
    costPerTon: 0.012,
    costEach: 0,
  },
  {
    id: "theatre",
    label: "Theatre",
    per: "theatre",
    tons: 8,
    costPerTon: 0.2,
    costEach: 0,
  },
  {
    id: "wetBar",
    label: "Wet bar",
    per: "bar",
    tons: 0,
    costPerTon: 0,
    costEach: 0.002,
  },
  {
    id: "training",
    label: "Training facilities",
    per: "trainee",
    tons: 2,
    costPerTon: 0.2,
    costEach: 0,
  },
  {
    id: "biosphere",
    label: "Biosphere",
    per: "ton",
    tons: 1,
    costPerTon: 0.2,
    costEach: 0,
    power: 1,
  },
  {
    id: "armoury",
    label: "Armoury",
    per: "ton",
    tons: 1,
    costPerTon: 0.25,
    costEach: 0,
  },
  {
    id: "brewery",
    label: "Brewery",
    per: "unit",
    tons: 0.5,
    costPerTon: 0.1,
    costEach: 0,
    tl: 10,
  },
  {
    id: "pool",
    label: "Swimming pool",
    per: "ton",
    tons: 1,
    costPerTon: 0.02,
    costEach: 0,
    min: 4,
  },
  {
    id: "endlessPool",
    label: "Endless pool",
    per: "pool",
    tons: 2,
    costPerTon: 0,
    costEach: 0.05,
  },
] as const;

/** Passengers whose life support one biosphere ton covers. */
export const BIOSPHERE_PASSENGERS_PER_TON = 2;

export type AmenityId = (typeof AMENITIES)[number]["id"];

export interface Amenity {
  id: string;
  kind: AmenityId;
  quantity: number;
}

export function amenityTons(kind: string, quantity: number): number {
  const amenity = AMENITIES.find((row) => row.id === kind);
  const count = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  return Math.round((amenity?.tons ?? 0) * count * 100) / 100;
}

export function amenityCost(kind: string, quantity: number): number {
  const amenity = AMENITIES.find((row) => row.id === kind);
  const count = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  if (!amenity) return 0;
  const cost = amenity.costEach > 0
    ? amenity.costEach * count
    : amenityTons(kind, count) * amenity.costPerTon;
  return Math.round(cost * 1000) / 1000;
}

export function amenityPower(kind: string, quantity: number): number {
  const amenity = AMENITIES.find((row) => row.id === kind);
  const count = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  if (amenity && "power" in amenity) return amenity.power * count;
  if (kind === "training") return Math.ceil(count / 2);
  return 0;
}

export function biospherePassengers(tons: number): number {
  const count = Number.isFinite(tons) ? Math.max(0, Math.round(tons)) : 0;
  return count * BIOSPHERE_PASSENGERS_PER_TON;
}

/** Crew or marines one armoury ton equips. */
export function armouryCover(tons: number): { crew: number; marines: number } {
  const count = Number.isFinite(tons) ? Math.max(0, Math.round(tons)) : 0;
  return { crew: count * 25, marines: count * 5 };
}

/** Forced linkage is always 2 tons. The variant sets the tech level, price, and pilot-check DM. */
export const FORCED_LINKAGE = [
  { label: "Basic", tl: 7, cost: 0.05, dm: -2 },
  { label: "Improved", tl: 9, cost: 0.075, dm: -1 },
  { label: "Enhanced", tl: 12, cost: 0.1, dm: 0 },
  { label: "Advanced", tl: 15, cost: 0.5, dm: 2 },
] as const;

/** One of each. A breaching tube is 3 tons at MCr 3. A docking clamp is Type I 1 ton at MCr 0.5 for 1–30 tons, Type II 5 tons at MCr 1 for 31–99, Type III 10 tons at MCr 2 for 100–300, Type IV 20 tons at MCr 4 for 301–2,000, and Type V 50 tons at MCr 8 for 2,001 or more. A grappling arm is 2 tons at MCr 1 and handles 2 tons. A heavy grappling arm is 6 tons at MCr 3 and handles 10 tons. A holographic hull is MCr 0.1 and 1 power for every 2 tons of hull, and takes no space. A tow cable is 1% of the hull at Cr5,000 per ton of cable. A re-entry capsule is 0.5 tons at Cr20,000 and carries one person. A re-entry pod is 1 ton at Cr150,000 and carries two. */
export const EXTERNAL_SYSTEMS = [
  {
    id: "breaching",
    label: "Breaching tube",
    tl: 0,
    tons: 3,
    cost: 3,
    counted: true,
  },
  {
    id: "clamp1",
    label: "Docking clamp (Type I)",
    tl: 0,
    tons: 1,
    cost: 0.5,
    counted: true,
    holds: "1–30",
  },
  {
    id: "clamp2",
    label: "Docking clamp (Type II)",
    tl: 0,
    tons: 5,
    cost: 1,
    counted: true,
    holds: "31–99",
  },
  {
    id: "clamp3",
    label: "Docking clamp (Type III)",
    tl: 0,
    tons: 10,
    cost: 2,
    counted: true,
    holds: "100–300",
  },
  {
    id: "clamp4",
    label: "Docking clamp (Type IV)",
    tl: 0,
    tons: 20,
    cost: 4,
    counted: true,
    holds: "301–2,000",
  },
  {
    id: "clamp5",
    label: "Docking clamp (Type V)",
    tl: 0,
    tons: 50,
    cost: 8,
    counted: true,
    holds: "2,001 or more",
  },
  {
    id: "linkage",
    label: "Forced linkage apparatus",
    tl: 7,
    tons: 2,
    cost: 0,
    counted: true,
  },
  {
    id: "grappling",
    label: "Grappling arm",
    tl: 0,
    tons: 2,
    cost: 1,
    counted: true,
  },
  {
    id: "heavyGrappling",
    label: "Heavy grappling arm",
    tl: 0,
    tons: 6,
    cost: 3,
    counted: true,
  },
  {
    id: "holographic",
    label: "Holographic hull",
    tl: 10,
    tons: 0,
    cost: 0,
    counted: false,
  },
  { id: "tow", label: "Tow cable", tl: 0, tons: 0, cost: 0, counted: false },
  {
    id: "reentryCapsule",
    label: "Re-entry capsule",
    tl: 8,
    tons: 0.5,
    cost: 0.02,
    counted: true,
  },
  {
    id: "reentryPod",
    label: "Re-entry pod",
    tl: 9,
    tons: 1,
    cost: 0.15,
    counted: true,
  },
] as const;

export type ExternalSystemId = (typeof EXTERNAL_SYSTEMS)[number]["id"];

export interface ExternalSystem {
  id: string;
  kind: ExternalSystemId;
  quantity: number;
  /** Tech level of a forced linkage apparatus. */
  techLevel?: number;
}

export function forcedLinkageAt(
  techLevel: number,
): (typeof FORCED_LINKAGE)[number] {
  const requested = FORCED_LINKAGE.find((row) => row.tl === techLevel);
  if (requested) return requested;
  const available = FORCED_LINKAGE.filter((row) => row.tl <= techLevel);
  return available[available.length - 1] ?? FORCED_LINKAGE[0];
}

export function holographicHullCost(hullTons: number): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  return Math.round(hull * 0.1 * 1000) / 1000;
}

export function holographicHullPower(hullTons: number): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  return Math.ceil(hull / 2);
}

export function towCableTons(hullTons: number): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  return Math.round(hull) / 100;
}

export function towCableCost(hullTons: number): number {
  return Math.round(towCableTons(hullTons) * 0.005 * 1000) / 1000;
}

export function externalSystemPower(kind: string, hullTons: number): number {
  return kind === "holographic" ? holographicHullPower(hullTons) : 0;
}
/** A set is five drones. Repair drones instead take 1% of the hull, at least one ton, at MCr 0.2 per ton. */
export const DRONES = [
  { id: "mining", label: "Mining drones", tl: 12, tons: 10, cost: 1 },
  { id: "probe", label: "Probe drones", tl: 9, tons: 1, cost: 0.5 },
  {
    id: "advanced",
    label: "Advanced probe drones",
    tl: 12,
    tons: 1,
    cost: 0.8,
  },
  { id: "repair", label: "Repair drones", tl: 10, tons: 0, cost: 0 },
] as const;

export type DroneId = (typeof DRONES)[number]["id"];

export const DRONE_SET_SIZE = 5;
export const REPAIR_DRONE_COST_PER_TON = 0.2;

export function repairDroneTons(hullTons: number): number {
  const hull = Number.isFinite(hullTons)
    ? Math.max(0, Math.round(hullTons))
    : 0;
  return Math.max(1, Math.round(hull) / 100);
}

/** Cargo crane, cargo net, cargo scoop, loading belts, external cargo mount, and jump nets. A cargo net is 5 tons at MCr 1. A cargo scoop is 2 tons at MCr 0.5. Jump-net cost is MCr per ton of net. */
export const CARGO_GEAR = [
  { id: "crane", label: "Cargo crane", tl: 0, tons: 0, cost: 1, power: 0 },
  { id: "cargoNet", label: "Cargo net", tl: 0, tons: 5, cost: 1, power: 0 },
  {
    id: "cargoScoop",
    label: "Cargo scoop",
    tl: 0,
    tons: 2,
    cost: 0.5,
    power: 0,
  },
  { id: "belt", label: "Loading belt", tl: 7, tons: 1, cost: 0.003, power: 1 },
  {
    id: "belt12",
    label: "Loading belt (TL12)",
    tl: 12,
    tons: 1,
    cost: 0.01,
    power: 1,
  },
  {
    id: "external",
    label: "External cargo mount",
    tl: 0,
    tons: 0,
    cost: 0.001,
    power: 0,
  },
  {
    id: "jumpNet",
    label: "Interstellar jump net",
    tl: 10,
    tons: 0,
    cost: 0.3,
    power: 0,
  },
  {
    id: "planetaryNet",
    label: "Interplanetary jump net",
    tl: 8,
    tons: 0,
    cost: 0.1,
    power: 0,
  },
] as const;

export const PLANETARY_JUMP_NET_RULE =
  "A ship cannot jump while an interplanetary jump net is deployed.";
export const CARGO_NET_RULE =
  "A ship cannot jump while a cargo net is extended.";
export const CARGO_SCOOP_NOTE = "Sweeps up one ton of material per round.";

export type CargoGearId = (typeof CARGO_GEAR)[number]["id"];

/** One internal ton for every 100 tons of external cargo the net is rated to carry. */
export function jumpNetTons(capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.round(capacity * 100) / 10000;
}

/** Crane is 2.5 tons plus 0.5 tons per 150 tons of cargo, or part of that 150. A jump net's tons come from its capacity and are set aside before the crane is sized. */
export function cargoHandlingTons(
  available: number,
  crane: boolean,
  netTons = 0,
): { craneTons: number; jumpNetTons: number } {
  const raw = Number.isFinite(available) ? available : 0;
  const jumpNetTons = Number.isFinite(netTons) ? Math.max(0, netTons) : 0;
  const space = raw - jumpNetTons;
  if (!crane) return { craneTons: 0, jumpNetTons };
  const bandsFor = (cargo: number) => {
    const tons = Math.round(cargo * 100) / 100;
    if (tons <= 0) return 0;
    return Math.ceil(tons / 150);
  };
  let craneTons = 2.5;
  for (let guard = 0; guard < 1000; guard += 1) {
    const required = 2.5 + 0.5 * bandsFor(space - craneTons);
    if (craneTons + 1e-9 >= required) break;
    craneTons = Math.round((craneTons + 0.5) * 100) / 100;
  }
  return { craneTons, jumpNetTons };
}
export interface WorkSpace {
  id: string;
  kind: WorkSpaceId;
  quantity: number;
  /** Options fitted in a robotics laboratory. */
  avatarChair?: RoboticsAvatarChairId;
  fabrication?: RoboticsFabricatorId;
  droneController?: RoboticsDroneControllerId;
  swarmController?: RoboticsSwarmControllerId;
}

export interface DroneFit {
  id: string;
  kind: DroneId;
  /** Sets of five drones. Repair drones ignore this and use a share of the hull. */
  quantity: number;
}

export interface CargoGear {
  id: string;
  kind: CargoGearId;
  /** Loading belts are a count for cost and power. Their tonnage stays at 1. An external mount is tons of cargo. A jump net is tons of external cargo capacity. A crane ignores this. */
  quantity: number;
}
