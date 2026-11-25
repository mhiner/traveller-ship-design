/** High Guard design factors. Numbers only; the trade ledger does not read this file. */

export const MIN_HULL_TONS = 5;
export const MAX_HULL_TONS = 10000;
export const HULL_COST_PER_TON = 0.05;

/** A module hull is Cr25,000 per ton before the configuration modifier. */
export const MODULE_COST_PER_TON = 0.025;

/** Planetoid and buffered planetoid hulls are Cr4,000 per ton. */
export const PLANETOID_COST_PER_TON = 0.004;

export function clampHullTons(tons: number): number {
  if (!Number.isFinite(tons)) return 200;
  return Math.min(MAX_HULL_TONS, Math.max(MIN_HULL_TONS, Math.round(tons)));
}

export function armourSizeMultiplier(hullTons: number): number {
  if (hullTons <= 15) return 4;
  if (hullTons <= 25) return 3;
  if (hullTons <= 99) return 2;
  return 1;
}

export function hullCost(tons: number): number {
  return Math.round(clampHullTons(tons) * HULL_COST_PER_TON * 100) / 100;
}

export const CONFIGURATIONS = [
  {
    id: "standard",
    label: "Standard",
    cost: 1,
    pricePerTon: null,
    usable: 1,
    streamlined: false,
    armourBonus: 0,
    armourVolume: 1,
  },
  {
    id: "streamlined",
    label: "Streamlined",
    cost: 1.2,
    pricePerTon: null,
    usable: 1,
    streamlined: true,
    armourBonus: 0,
    armourVolume: 1.2,
  },
  {
    id: "sphere",
    label: "Sphere",
    cost: 1.1,
    pricePerTon: null,
    usable: 1,
    streamlined: false,
    armourBonus: 0,
    armourVolume: 0.9,
  },
  {
    id: "close",
    label: "Close structure",
    cost: 0.8,
    pricePerTon: null,
    usable: 1,
    streamlined: false,
    armourBonus: 0,
    armourVolume: 1.5,
  },
  {
    id: "distributed",
    label: "Dispersed structure",
    cost: 0.5,
    pricePerTon: null,
    usable: 1,
    streamlined: false,
    armourBonus: 0,
    armourVolume: 2,
  },
  {
    id: "planetoid",
    label: "Planetoid",
    cost: 1,
    pricePerTon: PLANETOID_COST_PER_TON,
    usable: 0.8,
    streamlined: false,
    armourBonus: 2,
    armourVolume: 1,
  },
  {
    id: "buffered",
    label: "Buffered planetoid",
    cost: 1,
    pricePerTon: PLANETOID_COST_PER_TON,
    usable: 0.65,
    streamlined: false,
    armourBonus: 4,
    armourVolume: 1,
  },
] as const;

export type ConfigurationId = (typeof CONFIGURATIONS)[number]["id"];

/** Applied to the hull price after configuration. Light is −25% cost and −10% hull points. Reinforced is +50% cost and +10% hull points. */
export const HULL_TYPES = [
  { id: "standard", label: "Standard", cost: 1, points: 1 },
  { id: "light", label: "Light Hull", cost: 0.75, points: 0.9 },
  { id: "reinforced", label: "Reinforced Hull", cost: 1.5, points: 1.1 },
  { id: "module", label: "Module", cost: 1, points: 1 },
] as const;

export type HullTypeId = (typeof HULL_TYPES)[number]["id"];

export const ARMOUR = [
  { id: "none", label: "None", tl: 0, tonsPerPoint: 0, costPerTon: 0 },
  {
    id: "titanium",
    label: "Titanium steel",
    tl: 7,
    tonsPerPoint: 0.025,
    costPerTon: 0.05,
  },
  {
    id: "crystaliron",
    label: "Crystaliron",
    tl: 10,
    tonsPerPoint: 0.0125,
    costPerTon: 0.2,
  },
  {
    id: "bonded",
    label: "Bonded superdense",
    tl: 14,
    tonsPerPoint: 0.008,
    costPerTon: 0.5,
  },
  {
    id: "molecular",
    label: "Molecular bonded",
    tl: 16,
    tonsPerPoint: 0.005,
    costPerTon: 1.5,
  },
] as const;

export type ArmourId = (typeof ARMOUR)[number]["id"];
export function armourAt(
  techLevel: number,
): readonly (typeof ARMOUR)[number][] {
  return ARMOUR.filter((armour) => armour.tl <= techLevel);
}

/** Maximum Protection from the hull armour table. */
export function armourProtectionMax(
  armour: ArmourId,
  techLevel: number,
): number {
  const tl = Number.isFinite(techLevel) ? techLevel : 0;
  if (armour === "titanium") return Math.min(tl, 9);
  if (armour === "crystaliron") return Math.min(tl, 13);
  if (armour === "bonded") return tl;
  if (armour === "molecular") return tl + 4;
  return 0;
}

/** Purchased armour points left under the table maximum after protection the hull already has. */
export function armourRatingMax(
  armour: ArmourId,
  techLevel: number,
  priorProtection: number,
): number {
  const prior = Number.isFinite(priorProtection)
    ? Math.max(0, priorProtection)
    : 0;
  return Math.max(0, armourProtectionMax(armour, techLevel) - prior);
}
/** One of each. Aerofins are priced per ton of fins. The others are priced per ton of hull. Stealth coatings exclude one another and reflec. Solar coating excludes every hull option except radiation shielding. */
export const HULL_OPTIONS = [
  {
    id: "aerofins",
    label: "Aerofins",
    tl: 0,
    percent: 5,
    costThousandths: 100,
    per: "option",
    group: "",
  },
  {
    id: "heat",
    label: "Heat Shielding",
    tl: 6,
    percent: 0,
    costThousandths: 100,
    per: "hull",
    group: "",
  },
  {
    id: "radiation",
    label: "Radiation Shielding",
    tl: 7,
    percent: 0,
    costThousandths: 25,
    per: "hull",
    group: "",
  },
  {
    id: "reflec",
    label: "Reflec",
    tl: 10,
    percent: 0,
    costThousandths: 100,
    per: "hull",
    group: "",
  },
  {
    id: "solarEnhanced",
    label: "Enhanced solar coating",
    tl: 10,
    percent: 0,
    costThousandths: 0,
    per: "hull",
    group: "solar",
  },
  {
    id: "solarAdvanced",
    label: "Advanced solar coating",
    tl: 12,
    percent: 0,
    costThousandths: 0,
    per: "hull",
    group: "solar",
  },
  {
    id: "stealth",
    label: "Basic Stealth",
    tl: 8,
    percent: 2,
    costThousandths: 40,
    per: "hull",
    group: "stealth",
  },
  {
    id: "stealthImproved",
    label: "Improved Stealth",
    tl: 10,
    percent: 0,
    costThousandths: 100,
    per: "hull",
    group: "stealth",
  },
  {
    id: "stealthEnhanced",
    label: "Enhanced Stealth",
    tl: 12,
    percent: 0,
    costThousandths: 500,
    per: "hull",
    group: "stealth",
  },
  {
    id: "stealthAdvanced",
    label: "Advanced Stealth",
    tl: 14,
    percent: 0,
    costThousandths: 1000,
    per: "hull",
    group: "stealth",
  },
  {
    id: "breakaway",
    label: "Breakaway Hull",
    tl: 0,
    percent: 2,
    costThousandths: 2000,
    per: "option",
    group: "",
  },
  {
    id: "modular",
    label: "Modular Hull",
    tl: 0,
    percent: 0,
    costThousandths: 0,
    per: "option",
    group: "",
  },
  /** 25% of the hull. The cost is ten times the hull, priced in evaluateDesign. */
  {
    id: "pressure",
    label: "Pressure Hull",
    tl: 0,
    percent: 25,
    costThousandths: 0,
    per: "hull",
    group: "",
  },
  /** 5% of the hull and 10% of the base hull cost. Priced in evaluateDesign. */
  {
    id: "adjustable",
    label: "Adjustable Hull (TL12)",
    tl: 12,
    percent: 5,
    costThousandths: 0,
    per: "hull",
    group: "adjustable",
  },
  /** 1% of the hull and the full base hull cost. Priced in evaluateDesign. */
  {
    id: "adjustable15",
    label: "Adjustable Hull (TL15)",
    tl: 15,
    percent: 1,
    costThousandths: 0,
    per: "hull",
    group: "adjustable",
  },
  /** One ton per 200 tons of hull. MCr 1 and 2 power per ton of screen. */
  {
    id: "grav",
    label: "Grav Screen",
    tl: 12,
    percent: 0.5,
    costThousandths: 1000,
    per: "option",
    group: "",
  },
] as const;

/** Intrinsic armour added by a pressure hull. */
export const PRESSURE_HULL_ARMOUR = 4;

export type HullOptionId = (typeof HULL_OPTIONS)[number]["id"];

export interface HullOption {
  id: string;
  kind: HullOptionId;
  /** Tons reserved by a modular hull. At most 75% of the ship. */
  tons?: number;
  /** The one module carried in this bay. Its hull matches the bay tonnage. */
  modules?: string[];
  /** Hull tons covered by a solar coating. At most 40% of the hull, and the coating takes no tonnage. */
  units?: number;
}

/** Solar coating covers at most 40% of the hull. One unit is one ton of hull. */
export function solarCoatingMaxUnits(hullTons: number): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  return Math.floor(hull * 0.4);
}

/** Enhanced coating is TL10. Advanced coating is TL12. Basic and improved grades have no coating output. */
export function solarCoatingRate(
  kind: string,
): { powerPerUnit: number; costPerUnit: number } | undefined {
  if (kind === "solarEnhanced") return { powerPerUnit: 0.1, costPerUnit: 0.3 };
  if (kind === "solarAdvanced") return { powerPerUnit: 0.2, costPerUnit: 0.4 };
  return undefined;
}

/** Price a solar coating. Close structure and dispersed structure supply half the power. A streamlined hull supplies none. */
export function solarCoatingQuote(
  kind: string,
  hullTons: number,
  units: number,
  configurationId: string,
): { units: number; max: number; cost: number; power: number } {
  const rate = solarCoatingRate(kind);
  const max = solarCoatingMaxUnits(hullTons);
  const requested = Number.isFinite(units) ? Math.max(0, Math.trunc(units)) : 0;
  const fitted = Math.min(requested, max);
  const halved = configurationId === "close" ||
    configurationId === "distributed";
  const factor = configurationId === "streamlined" ? 0 : halved ? 0.5 : 1;
  return {
    units: fitted,
    max,
    cost: rate ? Math.round(fitted * rate.costPerUnit * 1000) / 1000 : 0,
    power: rate
      ? Math.round(fitted * rate.powerPerUnit * factor * 100) / 100
      : 0,
  };
}

/** A module bay holds one module, and that module is the same size as the bay. */
export function moduleFitsBay(moduleTons: number, bayTons: number): boolean {
  const bay = Math.round((Number.isFinite(bayTons) ? bayTons : 0) * 100);
  const module = Math.round((Number.isFinite(moduleTons) ? moduleTons : 0) * 100);
  return bay > 0 && module === bay;
}

/** A modular hull cannot take more than 75% of the ship. */
export function modularHullMaxTons(hullTons: number): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  return Math.floor(hull * 75) / 100;
}

/** What `tons` of this ship's hull costs, using its configuration and hull type. */
export function configuredHullCost(
  tons: number,
  configurationId: string,
  hullTypeId: string,
): number {
  const amount = Number.isFinite(tons) ? Math.max(0, tons) : 0;
  const configuration =
    CONFIGURATIONS.find((row) => row.id === configurationId) ??
      CONFIGURATIONS[0];
  const hullType = HULL_TYPES.find((row) => row.id === hullTypeId) ??
    HULL_TYPES[0];
  const priced = hullType.id === "module"
    ? Math.round(
      Math.round(amount * MODULE_COST_PER_TON * 100) / 100 *
        configuration.cost * 100,
    ) / 100
    : configuration.pricePerTon == null
    ? Math.round(
      Math.round(amount * HULL_COST_PER_TON * 100) / 100 * configuration.cost *
        100,
    ) / 100
    : Math.round(amount * configuration.pricePerTon * 100) / 100;
  return Math.round(priced * hullType.cost * 100) / 100;
}

export function hullOptionTons(kind: string, hullTons: number): number {
  const option = HULL_OPTIONS.find((row) => row.id === kind);
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  return Math.round(hull * (option?.percent ?? 0)) / 100;
}

export function hullOptionCost(kind: string, hullTons: number): number {
  const option = HULL_OPTIONS.find((row) => row.id === kind);
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  const basis = option?.per === "option" ? hullOptionTons(kind, hull) : hull;
  return Math.round(basis * (option?.costThousandths ?? 0)) / 1000;
}

/** Options the ship can still add: within its tech level, not already fitted, and not excluded by reflec, stealth, or solar coating. A modular hull may be added more than once. */
export function hullOptionsAt(techLevel: number, installed: readonly string[]) {
  const fitted = HULL_OPTIONS.filter((row) => installed.includes(row.id));
  const stealth = fitted.some((row) => row.group === "stealth");
  const reflec = fitted.some((row) => row.id === "reflec");
  const solar = fitted.some((row) => row.group === "solar");
  const adjustable = fitted.some((row) => row.group === "adjustable");
  const blocksSolar = fitted.some((row) =>
    row.id !== "radiation" && row.group !== "solar"
  );
  return HULL_OPTIONS.filter((row) => {
    if (
      row.tl > techLevel || (installed.includes(row.id) && row.id !== "modular")
    ) return false;
    if (row.group === "stealth" && (stealth || reflec)) return false;
    if (row.id === "reflec" && stealth) return false;
    if (row.group === "solar" && (solar || blocksSolar)) return false;
    if (solar && row.id !== "radiation" && row.group !== "solar") return false;
    if (row.group === "adjustable" && adjustable) return false;
    return true;
  });
}
