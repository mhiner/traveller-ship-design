export const MANOEUVRE_HULL_PERCENT: Record<number, number> = {
  0: 0.5,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
};
export const MANOEUVRE_TL: Record<number, number> = {
  0: 9,
  1: 9,
  2: 10,
  3: 10,
  4: 11,
  5: 11,
  6: 12,
  7: 13,
  8: 14,
  9: 15,
  10: 16,
  11: 17,
};
/** Jump Potential table. Percent of hull before the extra five tons, and the minimum tech level. */
export const JUMP_HULL_PERCENT: Record<number, number> = {
  1: 2.5,
  2: 5,
  3: 7.5,
  4: 10,
  5: 12.5,
  6: 15,
  7: 17.5,
  8: 20,
  9: 22.5,
};
export const JUMP_TL: Record<number, number> = {
  1: 9,
  2: 11,
  3: 12,
  4: 13,
  5: 14,
  6: 15,
  7: 16,
  8: 17,
  9: 18,
};
export const JUMP_DRIVE_EXTRA_TONS = 5;
export const JUMP_DRIVE_MIN_TONS = 10;
/** A jump drive requires a hull of at least 100 tons. */
export const JUMP_MIN_HULL_TONS = 100;

export function manoeuvreDriveTons(hullTons: number, thrust: number): number {
  const percent = MANOEUVRE_HULL_PERCENT[thrust];
  if (percent == null) return 0;
  return Math.round(hullTons * percent) / 100;
}

export function jumpDriveTons(hullTons: number, jump: number): number {
  const percent = JUMP_HULL_PERCENT[jump];
  if (percent == null) return 0;
  const tons = Math.round(hullTons * percent * 10) / 1000 +
    JUMP_DRIVE_EXTRA_TONS;
  return Math.max(JUMP_DRIVE_MIN_TONS, Math.round(tons * 100) / 100);
}

/** Highest rating whose hull percentage fits the drive built for `ratedTons` at `selected`. */
function performanceRating(
  percents: Record<number, number>,
  hullTons: number,
  ratedTons: number,
  selected: number,
  min: number,
  max: number,
): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  const rated = Number.isFinite(ratedTons) ? Math.max(0, ratedTons) : 0;
  const percent = percents[selected];
  if (hull <= 0 || percent == null) return 0;
  const budget = percent * rated;
  let best = 0;
  for (let rating = min; rating <= max; rating++) {
    const needed = percents[rating];
    if (needed == null) continue;
    if (needed * hull <= budget + 1e-9) best = rating;
  }
  return best;
}

/** Thrust this manoeuvre drive delivers on the actual hull.
 * Drive size still follows the rated tonnage.
 * Needed this so I could set an effective tonnage for cases where I needed
 * slightly more thrust for breakaway hulls or tugboat ships
 */
export function manoeuvrePerformance(
  hullTons: number,
  ratedTons: number,
  thrust: number,
): number {
  const selected = Number.isFinite(thrust) ? Math.trunc(thrust) : 0;
  return performanceRating(
    MANOEUVRE_HULL_PERCENT,
    hullTons,
    ratedTons,
    selected,
    0,
    11,
  );
}

/** Effective Jump drive performance. A hull under 100 tons cannot jump. */
export function jumpPerformance(
  hullTons: number,
  ratedTons: number,
  jump: number,
): number {
  const hull = Number.isFinite(hullTons) ? hullTons : 0;
  if (hull < JUMP_MIN_HULL_TONS) return 0;
  const selected = Number.isFinite(jump) ? Math.trunc(jump) : 0;
  if (selected <= 0) return 0;
  return performanceRating(JUMP_HULL_PERCENT, hull, ratedTons, selected, 1, 9);
}

/** Prototype and advanced components from High Guard customising ships. Percent changes are additive. */
export const DRIVE_CUSTOM_TIERS = [
  {
    id: "standard",
    label: "Standard",
    tl: 0,
    tons: 0,
    cost: 0,
    slots: 0,
    kind: "none",
  },
  {
    id: "early",
    label: "Early Prototype",
    tl: -2,
    tons: 1,
    cost: 10,
    slots: 2,
    kind: "disadvantage",
  },
  {
    id: "prototype",
    label: "Prototype",
    tl: -1,
    tons: 0,
    cost: 5,
    slots: 1,
    kind: "disadvantage",
  },
  {
    id: "budget",
    label: "Budget",
    tl: 0,
    tons: 0,
    cost: -0.25,
    slots: 1,
    kind: "disadvantage",
  },
  {
    id: "advanced",
    label: "Advanced",
    tl: 1,
    tons: 0,
    cost: 0.1,
    slots: 1,
    kind: "advantage",
  },
  {
    id: "very",
    label: "Very Advanced",
    tl: 2,
    tons: 0,
    cost: 0.25,
    slots: 2,
    kind: "advantage",
  },
  {
    id: "high",
    label: "High Technology",
    tl: 3,
    tons: 0,
    cost: 0.5,
    slots: 3,
    kind: "advantage",
  },
] as const;

export type DriveCustomTier = (typeof DRIVE_CUSTOM_TIERS)[number]["id"];
export type DriveComponent = "thrust" | "jump" | "plant";

export interface DriveOption {
  id: string;
  label: string;
  kind: "advantage" | "disadvantage";
  slots: number;
  tons?: number;
  power?: number;
  fuel?: number;
  output?: number;
  roundUp?: boolean;
}

export const DRIVE_OPTIONS: Record<DriveComponent, readonly DriveOption[]> = {
  jump: [
    {
      id: "decreasedFuel",
      label: "Decreased Fuel",
      kind: "advantage",
      slots: 1,
      fuel: -0.05,
    },
    { id: "earlyJump", label: "Early Jump", kind: "advantage", slots: 1 },
    {
      id: "energyEfficient",
      label: "Energy Efficient",
      kind: "advantage",
      slots: 1,
      power: -0.25,
    },
    {
      id: "sizeReduction",
      label: "Size Reduction",
      kind: "advantage",
      slots: 1,
      tons: -0.1,
    },
    { id: "stealthJump", label: "Stealth Jump", kind: "advantage", slots: 2 },
    {
      id: "energyInefficient",
      label: "Energy Inefficient",
      kind: "disadvantage",
      slots: 1,
      power: 0.3,
    },
    { id: "lateJump", label: "Late Jump", kind: "disadvantage", slots: 1 },
    {
      id: "increasedSize",
      label: "Increased Size",
      kind: "disadvantage",
      slots: 1,
      tons: 0.25,
    },
  ],
  thrust: [
    {
      id: "energyEfficient",
      label: "Energy Efficient",
      kind: "advantage",
      slots: 1,
      power: -0.25,
    },
    {
      id: "sizeReduction",
      label: "Size Reduction",
      kind: "advantage",
      slots: 1,
      tons: -0.1,
    },
    {
      id: "energyInefficient",
      label: "Energy Inefficient",
      kind: "disadvantage",
      slots: 1,
      power: 0.3,
    },
    {
      id: "limitedRange",
      label: "Limited Range",
      kind: "disadvantage",
      slots: 1,
    },
    {
      id: "increasedSize",
      label: "Increased Size",
      kind: "disadvantage",
      slots: 1,
      tons: 0.25,
    },
    {
      id: "orbitalRange",
      label: "Orbital Range",
      kind: "disadvantage",
      slots: 2,
    },
  ],
  plant: [
    {
      id: "increasedPower",
      label: "Increased Power",
      kind: "advantage",
      slots: 2,
      output: 0.1,
      roundUp: true,
    },
    {
      id: "sizeReduction",
      label: "Size Reduction",
      kind: "advantage",
      slots: 1,
      tons: -0.1,
    },
    {
      id: "energyInefficient",
      label: "Energy Inefficient",
      kind: "disadvantage",
      slots: 1,
      output: -0.25,
    },
    {
      id: "increasedSize",
      label: "Increased Size",
      kind: "disadvantage",
      slots: 1,
      tons: 0.25,
    },
  ],
};

export interface DriveCustom {
  tier: DriveCustomTier;
  options: string[];
  /** Tonnage used to size this drive. Omitted values use the hull, and the hull is the minimum. */
  effectiveTons?: number;
}

/** Tonnage used for a drive's size, cost, and power. It defaults to the hull and cannot be smaller. */
export function driveEffectiveTons(
  hullTons: number,
  custom: DriveCustom | undefined,
): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  const requested = custom?.effectiveTons;
  if (requested == null || !Number.isFinite(requested)) return hull;
  return Math.max(hull, requested);
}

/** Tonnage note for a drive summary. Present only when the drive is sized above the hull. */
export function customTonnageNote(hullTons: number, basisTons: number): string {
  const hull = Number.isFinite(hullTons) ? hullTons : 0;
  const basis = Number.isFinite(basisTons)
    ? Math.round(basisTons * 100) / 100
    : 0;
  if (basis <= hull) return "";
  return `${Number.isInteger(basis) ? basis : basis} tons`;
}

export interface DriveCustoms {
  thrust: DriveCustom;
  jump: DriveCustom;
  plant: DriveCustom;
}

export interface DriveAdjustment {
  tonsFactor: number;
  costFactor: number;
  powerFactor: number;
  fuelFactor: number;
  outputFactor: number;
  roundUp: boolean;
  tl: number;
  label: string;
}

export function driveTier(id: string | undefined) {
  return DRIVE_CUSTOM_TIERS.find((tier) => tier.id === id) ??
    DRIVE_CUSTOM_TIERS[0];
}

/** Options that fit the tier: advantages or disadvantages, never both, within the slot count. The same option may be taken more than once. */
export function legalCustomOptions(
  pool: readonly DriveOption[],
  custom: DriveCustom | undefined,
): DriveOption[] {
  const tier = driveTier(custom?.tier);
  if (tier.slots === 0) return [];
  const chosen: DriveOption[] = [];
  let used = 0;
  for (const id of custom?.options ?? []) {
    const option = pool.find((row) => row.id === id && row.kind === tier.kind);
    if (!option || used + option.slots > tier.slots) continue;
    chosen.push(option);
    used += option.slots;
  }
  return chosen;
}

export function legalDriveOptions(
  component: DriveComponent,
  custom: DriveCustom | undefined,
): DriveOption[] {
  return legalCustomOptions(DRIVE_OPTIONS[component], custom);
}

export function customAdjustment(
  pool: readonly DriveOption[],
  custom: DriveCustom | undefined,
): DriveAdjustment {
  const tier = driveTier(custom?.tier);
  const chosen = legalCustomOptions(pool, custom);
  let tons = tier.kind === "none" ? 0 : tier.tons;
  let power = 0;
  let fuel = 0;
  let output = 0;
  let roundUp = false;
  for (const option of chosen) {
    tons += option.tons ?? 0;
    power += option.power ?? 0;
    fuel += option.fuel ?? 0;
    output += option.output ?? 0;
    roundUp = roundUp || option.roundUp === true;
  }
  return {
    tonsFactor: Math.max(0, 1 + tons),
    costFactor: 1 + (tier.kind === "none" ? 0 : tier.cost),
    powerFactor: Math.max(0, 1 + power),
    fuelFactor: Math.max(0, 1 + fuel),
    outputFactor: Math.max(0, 1 + output),
    roundUp,
    tl: tier.kind === "none" ? 0 : tier.tl,
    label: repeatedLabels(chosen.map((option) => option.label)),
  };
}

function repeatedLabels(labels: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map((
    [label, count],
  ) => (count > 1 ? `${label} x${count}` : label)).join(", ");
}

export function driveAdjustment(
  component: DriveComponent,
  custom: DriveCustom | undefined,
): DriveAdjustment {
  return customAdjustment(DRIVE_OPTIONS[component], custom);
}

/** Tier name plus the selected advantages or disadvantages. */
export function customLabel(
  pool: readonly DriveOption[],
  custom: DriveCustom | undefined,
): string {
  const tier = driveTier(custom?.tier);
  const options = customAdjustment(pool, custom).label;
  return [tier.id === "standard" ? "" : tier.label, options].filter(Boolean)
    .join(", ");
}

export function blankDriveCustom(): DriveCustom {
  return { tier: "standard", options: [] };
}

export const MANOEUVRE_COST_PER_TON = 2;
export const JUMP_COST_PER_TON = 1.5;
/** Basic systems are 20% of the hull. */
export const BASE_POWER_PER_TON = 0.2;
/** A drive needs 10% of the hull times its rating. */
export const DRIVE_POWER_PER_TON = 0.1;
/** Thrust 0 uses a quarter of drive power. Only applicable to Space Stations */
export const THRUST_ZERO_POWER_FACTOR = 0.25;

/** Power per ton is the plant output. Cost is MCr per ton. */
export const POWER_PLANTS = [
  {
    id: "fission",
    label: "Fission (TL6)",
    tl: 6,
    powerPerTon: 8,
    costPerTon: 0.4,
  },
  {
    id: "chemical",
    label: "Chemical (TL7)",
    tl: 7,
    powerPerTon: 5,
    costPerTon: 0.25,
  },
  {
    id: "fusion8",
    label: "Fusion (TL8)",
    tl: 8,
    powerPerTon: 10,
    costPerTon: 0.5,
  },
  {
    id: "fusion12",
    label: "Fusion (TL12)",
    tl: 12,
    powerPerTon: 15,
    costPerTon: 1,
  },
  {
    id: "fusion15",
    label: "Fusion (TL15)",
    tl: 15,
    powerPerTon: 20,
    costPerTon: 2,
  },
  {
    id: "antimatter",
    label: "Antimatter (TL20)",
    tl: 20,
    powerPerTon: 100,
    costPerTon: 10,
  },
] as const;

export type PowerPlantId = (typeof POWER_PLANTS)[number]["id"];

/** Chemical plants are a mess and I wish they would just go away but if I remove people will complain */
export function powerPlantFuelTons(
  plant: PowerPlantId,
  plantTons: number,
  weeks: number,
  hullTons = 100,
): number {
  if (plantTons <= 0 || weeks <= 0) return 0;
  if (plant === "chemical") {
    return Math.round(plantTons * 10 * weeks / 2 * 100) / 100;
  }
  const share = Math.round(plantTons * 100) / 1000;
  const fourWeeks = hullTons < 100 ? share : Math.max(1, Math.ceil(share));
  return Math.round(fourWeeks * weeks / 4 * 100) / 100;
}

/** Filter Power Plant Types based on ship TL  */
export function powerPlantsAt(
  techLevel: number,
): readonly (typeof POWER_PLANTS)[number][] {
  return POWER_PLANTS.filter((plant) => plant.tl <= techLevel);
}

/** Jump fuel is 10% of hull per jump number. */
export const JUMP_FUEL_FRACTION = 0.1;
