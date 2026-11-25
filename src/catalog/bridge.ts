export const COMPUTERS = [
  { id: "core5", label: "Computer/5", tl: 7, cost: 0.03, bandwidth: 5 },
  { id: "core10", label: "Computer/10", tl: 9, cost: 0.16, bandwidth: 10 },
  { id: "core15", label: "Computer/15", tl: 11, cost: 2, bandwidth: 15 },
  { id: "core20", label: "Computer/20", tl: 12, cost: 5, bandwidth: 20 },
  { id: "core25", label: "Computer/25", tl: 13, cost: 10, bandwidth: 25 },
  { id: "core30", label: "Computer/30", tl: 14, cost: 20, bandwidth: 30 },
  { id: "core35", label: "Computer/35", tl: 15, cost: 30, bandwidth: 35 },
] as const;

export type ComputerId = (typeof COMPUTERS)[number]["id"];

/** Standard keeps the computer price. Bis or fib adds half. Both together double it. */
export const COMPUTER_TYPES = [
  { id: "standard", label: "Standard", costFactor: 1 },
  { id: "bis", label: "Bis", costFactor: 1.5 },
  { id: "fib", label: "Fib", costFactor: 1.5 },
  { id: "bisfib", label: "Bis+Fib", costFactor: 2 },
] as const;

export type ComputerTypeId = (typeof COMPUTER_TYPES)[number]["id"];

/** Standard bridge tonnage by hull. Cost is MCr 0.5 per 100 tons of hull, rounding the tons up. */
const BRIDGE_BANDS = [
  { maxTons: 50, tons: 3 },
  { maxTons: 99, tons: 6 },
  { maxTons: 200, tons: 10 },
  { maxTons: 1000, tons: 20 },
  { maxTons: 1999, tons: 40 },
  { maxTons: Number.POSITIVE_INFINITY, tons: 60 },
] as const;

export const BRIDGES = [
  { id: "cockpit", label: "Single cockpit" },
  { id: "dual", label: "Double cockpit" },
  { id: "bridge", label: "Bridge" },
  { id: "small", label: "Small bridge" },
  { id: "command", label: "Command bridge" },
] as const;

export type BridgeId = (typeof BRIDGES)[number]["id"];

export function standardBridgeTons(hullTons: number): number {
  return BRIDGE_BANDS.find((band) => hullTons <= band.maxTons)?.tons ?? 60;
}

/** One band smaller than the standard bridge. Absent on a hull of 50 tons or less. */
export function smallBridgeTons(hullTons: number): number | null {
  const index = BRIDGE_BANDS.findIndex((band) => hullTons <= band.maxTons);
  if (index <= 0) return null;
  return BRIDGE_BANDS[index - 1].tons;
}

export function bridgeCost(hullTons: number): number {
  return Math.ceil(hullTons / 100) * 0.5;
}

export function commandBridgeCost(hullTons: number): number {
  return Math.ceil(hullTons / 100) * 0.75;
}

export function bridgesAt(
  hullTons: number,
): readonly (typeof BRIDGES)[number][] {
  return BRIDGES.filter((bridge) => {
    if (bridge.id === "cockpit" || bridge.id === "dual") return hullTons <= 50;
    if (bridge.id === "small") return smallBridgeTons(hullTons) !== null;
    if (bridge.id === "command") return hullTons >= 5000;
    return true;
  });
}
/** Core and High Guard ship software. Cost is MCr. A shared group can be installed only once. */
export const SHIP_SOFTWARE = [
  {
    id: "manoeuvre",
    label: "Manoeuvre/0",
    group: "manoeuvre",
    tl: 8,
    bandwidth: 0,
    cost: 0,
    rating: 0,
  },
  {
    id: "intellect",
    label: "Intellect",
    group: "intellect",
    tl: 11,
    bandwidth: 0,
    cost: 0,
    rating: 0,
  },
  {
    id: "library",
    label: "Library",
    group: "library",
    tl: 8,
    bandwidth: 0,
    cost: 0,
    rating: 0,
  },
  {
    id: "jump1",
    label: "Jump Control/1",
    group: "jump",
    tl: 9,
    bandwidth: 5,
    cost: 0.1,
    rating: 1,
  },
  {
    id: "jump2",
    label: "Jump Control/2",
    group: "jump",
    tl: 11,
    bandwidth: 10,
    cost: 0.2,
    rating: 2,
  },
  {
    id: "jump3",
    label: "Jump Control/3",
    group: "jump",
    tl: 12,
    bandwidth: 15,
    cost: 0.3,
    rating: 3,
  },
  {
    id: "jump4",
    label: "Jump Control/4",
    group: "jump",
    tl: 13,
    bandwidth: 20,
    cost: 0.4,
    rating: 4,
  },
  {
    id: "jump5",
    label: "Jump Control/5",
    group: "jump",
    tl: 14,
    bandwidth: 25,
    cost: 0.5,
    rating: 5,
  },
  {
    id: "jump6",
    label: "Jump Control/6",
    group: "jump",
    tl: 15,
    bandwidth: 30,
    cost: 0.6,
    rating: 6,
  },
  {
    id: "evade1",
    label: "Evade/1",
    group: "evade",
    tl: 9,
    bandwidth: 10,
    cost: 1,
    rating: 1,
  },
  {
    id: "evade2",
    label: "Evade/2",
    group: "evade",
    tl: 11,
    bandwidth: 15,
    cost: 2,
    rating: 2,
  },
  {
    id: "evade3",
    label: "Evade/3",
    group: "evade",
    tl: 13,
    bandwidth: 25,
    cost: 3,
    rating: 3,
  },
  {
    id: "fire1",
    label: "Fire Control/1",
    group: "fire",
    tl: 9,
    bandwidth: 5,
    cost: 2,
    rating: 1,
  },
  {
    id: "fire2",
    label: "Fire Control/2",
    group: "fire",
    tl: 10,
    bandwidth: 10,
    cost: 4,
    rating: 2,
  },
  {
    id: "fire3",
    label: "Fire Control/3",
    group: "fire",
    tl: 11,
    bandwidth: 15,
    cost: 6,
    rating: 3,
  },
  {
    id: "fire4",
    label: "Fire Control/4",
    group: "fire",
    tl: 12,
    bandwidth: 20,
    cost: 8,
    rating: 4,
  },
  {
    id: "fire5",
    label: "Fire Control/5",
    group: "fire",
    tl: 13,
    bandwidth: 25,
    cost: 10,
    rating: 5,
  },
  {
    id: "repair1",
    label: "Auto-Repair/1",
    group: "repair",
    tl: 10,
    bandwidth: 10,
    cost: 5,
    rating: 1,
  },
  {
    id: "repair2",
    label: "Auto-Repair/2",
    group: "repair",
    tl: 12,
    bandwidth: 20,
    cost: 10,
    rating: 2,
  },
  {
    id: "advancedFire1",
    label: "Advanced Fire Control/1",
    group: "advancedFire",
    tl: 10,
    bandwidth: 15,
    cost: 12,
    rating: 1,
  },
  {
    id: "advancedFire2",
    label: "Advanced Fire Control/2",
    group: "advancedFire",
    tl: 12,
    bandwidth: 25,
    cost: 15,
    rating: 2,
  },
  {
    id: "advancedFire3",
    label: "Advanced Fire Control/3",
    group: "advancedFire",
    tl: 14,
    bandwidth: 30,
    cost: 18,
    rating: 3,
  },
  {
    id: "antiHijack1",
    label: "Anti-Hijack/1",
    group: "antiHijack",
    tl: 11,
    bandwidth: 2,
    cost: 6,
    rating: 1,
  },
  {
    id: "antiHijack2",
    label: "Anti-Hijack/2",
    group: "antiHijack",
    tl: 12,
    bandwidth: 10,
    cost: 8,
    rating: 2,
  },
  {
    id: "antiHijack3",
    label: "Anti-Hijack/3",
    group: "antiHijack",
    tl: 13,
    bandwidth: 15,
    cost: 10,
    rating: 3,
  },
  {
    id: "battleNetwork1",
    label: "Battle Network/1",
    group: "battleNetwork",
    tl: 12,
    bandwidth: 5,
    cost: 5,
    rating: 1,
  },
  {
    id: "battleNetwork2",
    label: "Battle Network/2",
    group: "battleNetwork",
    tl: 14,
    bandwidth: 10,
    cost: 10,
    rating: 2,
  },
  {
    id: "battleSystem1",
    label: "Battle System/1",
    group: "battleSystem",
    tl: 9,
    bandwidth: 5,
    cost: 18,
    rating: 1,
  },
  {
    id: "battleSystem2",
    label: "Battle System/2",
    group: "battleSystem",
    tl: 12,
    bandwidth: 10,
    cost: 24,
    rating: 2,
  },
  {
    id: "battleSystem3",
    label: "Battle System/3",
    group: "battleSystem",
    tl: 15,
    bandwidth: 15,
    cost: 36,
    rating: 3,
  },
  {
    id: "broadSpectrum",
    label: "Broad Spectrum EW",
    group: "broadSpectrum",
    tl: 13,
    bandwidth: 12,
    cost: 14,
    rating: 0,
  },
  {
    id: "conscious1",
    label: "Conscious Intelligence/1",
    group: "conscious",
    tl: 16,
    bandwidth: 40,
    cost: 25,
    rating: 1,
  },
  {
    id: "conscious2",
    label: "Conscious Intelligence/2",
    group: "conscious",
    tl: 17,
    bandwidth: 25,
    cost: 20,
    rating: 2,
  },
  {
    id: "conscious3",
    label: "Conscious Intelligence/3",
    group: "conscious",
    tl: 18,
    bandwidth: 10,
    cost: 15,
    rating: 3,
  },
  {
    id: "ew1",
    label: "Electronic Warfare/1",
    group: "electronicWarfare",
    tl: 10,
    bandwidth: 10,
    cost: 15,
    rating: 1,
  },
  {
    id: "ew2",
    label: "Electronic Warfare/2",
    group: "electronicWarfare",
    tl: 13,
    bandwidth: 15,
    cost: 18,
    rating: 2,
  },
  {
    id: "ew3",
    label: "Electronic Warfare/3",
    group: "electronicWarfare",
    tl: 15,
    bandwidth: 20,
    cost: 24,
    rating: 3,
  },
  {
    id: "launch1",
    label: "Launch Solution/1",
    group: "launch",
    tl: 8,
    bandwidth: 5,
    cost: 10,
    rating: 1,
  },
  {
    id: "launch2",
    label: "Launch Solution/2",
    group: "launch",
    tl: 10,
    bandwidth: 10,
    cost: 12,
    rating: 2,
  },
  {
    id: "launch3",
    label: "Launch Solution/3",
    group: "launch",
    tl: 12,
    bandwidth: 15,
    cost: 16,
    rating: 3,
  },
  {
    id: "pointDefence1",
    label: "Point Defence/1",
    group: "pointDefence",
    tl: 9,
    bandwidth: 12,
    cost: 8,
    rating: 1,
  },
  {
    id: "pointDefence2",
    label: "Point Defence/2",
    group: "pointDefence",
    tl: 12,
    bandwidth: 15,
    cost: 12,
    rating: 2,
  },
  {
    id: "screenOptimiser",
    label: "Screen Optimiser",
    group: "screenOptimiser",
    tl: 10,
    bandwidth: 10,
    cost: 5,
    rating: 0,
  },
  {
    id: "virtualCrew0",
    label: "Virtual Crew/0",
    group: "virtualCrew",
    tl: 10,
    bandwidth: 5,
    cost: 1,
    rating: 0,
  },
  {
    id: "virtualCrew1",
    label: "Virtual Crew/1",
    group: "virtualCrew",
    tl: 13,
    bandwidth: 10,
    cost: 5,
    rating: 1,
  },
  {
    id: "virtualCrew2",
    label: "Virtual Crew/2",
    group: "virtualCrew",
    tl: 15,
    bandwidth: 15,
    cost: 10,
    rating: 2,
  },
  {
    id: "virtualGunner0",
    label: "Virtual Gunner/0",
    group: "virtualGunner",
    tl: 9,
    bandwidth: 5,
    cost: 1,
    rating: 0,
  },
  {
    id: "virtualGunner1",
    label: "Virtual Gunner/1",
    group: "virtualGunner",
    tl: 12,
    bandwidth: 10,
    cost: 5,
    rating: 1,
  },
  {
    id: "virtualGunner2",
    label: "Virtual Gunner/2",
    group: "virtualGunner",
    tl: 15,
    bandwidth: 15,
    cost: 10,
    rating: 2,
  },
  {
    id: "hop1",
    label: "Hop Control/1",
    group: "hop",
    tl: 17,
    bandwidth: 40,
    cost: 1,
    rating: 1,
  },
  {
    id: "hop2",
    label: "Hop Control/2",
    group: "hop",
    tl: 18,
    bandwidth: 50,
    cost: 2,
    rating: 2,
  },
  {
    id: "hop3",
    label: "Hop Control/3",
    group: "hop",
    tl: 19,
    bandwidth: 60,
    cost: 3,
    rating: 3,
  },
  {
    id: "hop4",
    label: "Hop Control/4",
    group: "hop",
    tl: 20,
    bandwidth: 70,
    cost: 4,
    rating: 4,
  },
  {
    id: "hop5",
    label: "Hop Control/5",
    group: "hop",
    tl: 21,
    bandwidth: 80,
    cost: 5,
    rating: 5,
  },
  {
    id: "hop6",
    label: "Hop Control/6",
    group: "hop",
    tl: 22,
    bandwidth: 90,
    cost: 6,
    rating: 6,
  },
  {
    id: "hop7",
    label: "Hop Control/7",
    group: "hop",
    tl: 23,
    bandwidth: 100,
    cost: 7,
    rating: 7,
  },
  {
    id: "hop8",
    label: "Hop Control/8",
    group: "hop",
    tl: 24,
    bandwidth: 110,
    cost: 8,
    rating: 8,
  },
  {
    id: "hop9",
    label: "Hop Control/9",
    group: "hop",
    tl: 25,
    bandwidth: 120,
    cost: 9,
    rating: 9,
  },
  {
    id: "skip1",
    label: "Skip Control/1",
    group: "skip",
    tl: 20,
    bandwidth: 40,
    cost: 1,
    rating: 1,
  },
  {
    id: "skip2",
    label: "Skip Control/2",
    group: "skip",
    tl: 21,
    bandwidth: 50,
    cost: 2,
    rating: 2,
  },
  {
    id: "skip3",
    label: "Skip Control/3",
    group: "skip",
    tl: 22,
    bandwidth: 60,
    cost: 3,
    rating: 3,
  },
  {
    id: "skip4",
    label: "Skip Control/4",
    group: "skip",
    tl: 23,
    bandwidth: 70,
    cost: 4,
    rating: 4,
  },
  {
    id: "skip5",
    label: "Skip Control/5",
    group: "skip",
    tl: 24,
    bandwidth: 80,
    cost: 5,
    rating: 5,
  },
  {
    id: "skip6",
    label: "Skip Control/6",
    group: "skip",
    tl: 25,
    bandwidth: 90,
    cost: 6,
    rating: 6,
  },
  {
    id: "skip7",
    label: "Skip Control/7",
    group: "skip",
    tl: 26,
    bandwidth: 100,
    cost: 7,
    rating: 7,
  },
  {
    id: "skip8",
    label: "Skip Control/8",
    group: "skip",
    tl: 27,
    bandwidth: 110,
    cost: 8,
    rating: 8,
  },
  {
    id: "skip9",
    label: "Skip Control/9",
    group: "skip",
    tl: 28,
    bandwidth: 120,
    cost: 9,
    rating: 9,
  },
] as const;

export type SoftwareId = (typeof SHIP_SOFTWARE)[number]["id"];

export const DEFAULT_SOFTWARE: SoftwareId[] = [
  "manoeuvre",
  "intellect",
  "library",
];

export function installedSoftware(ids: readonly string[]) {
  const seen = new Set<string>();
  const programs = [];
  for (const id of ids) {
    const program = SHIP_SOFTWARE.find((row) => row.id === id);
    if (!program || seen.has(program.group)) continue;
    seen.add(program.group);
    programs.push(program);
  }
  return programs;
}

export function availableSoftware(
  installed: readonly string[],
  techLevel: number,
) {
  const groups = new Set(
    installedSoftware(installed).map((program) => program.group),
  );
  return SHIP_SOFTWARE.filter((program) =>
    program.tl <= techLevel && !groups.has(program.group)
  );
}
/** Robot Handbook ship's brains. An Alpha costs Cr130,000 at TL10, Cr80,000 at TL11 and Cr40,000 at TL12 or higher. The interface is Cr5,000 per hull ton. Haptics add Cr2,000 per hull ton. Neither takes tonnage. */
export const SHIP_BRAINS = [
  { id: "none", label: "None", tl: 0, cost: 0 },
  { id: "alpha", label: "Alpha", tl: 10, cost: 0.13 },
  { id: "brian", label: "Brian", tl: 12, cost: 1 },
  { id: "omega", label: "Omega", tl: 15, cost: 10 },
  { id: "custom", label: "Custom", tl: 10, cost: 0 },
] as const;

export type ShipBrainId = (typeof SHIP_BRAINS)[number]["id"];

export const SHIP_BRAIN_INTERFACES = [
  { id: "none", label: "None" },
  { id: "interface", label: "Ship's Brain Interface" },
  { id: "haptics", label: "Ship's Brain Interface + Haptics" },
] as const;

export type ShipBrainInterfaceId = (typeof SHIP_BRAIN_INTERFACES)[number]["id"];

export function shipBrainCost(kind: string, techLevel: number): number {
  if (kind === "alpha") {
    if (techLevel >= 12) return 0.04;
    if (techLevel >= 11) return 0.08;
    return 0.13;
  }
  return SHIP_BRAINS.find((row) => row.id === kind)?.cost ?? 0;
}

export function shipBrainInterfaceCost(kind: string, hullTons: number): number {
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  const perTon = kind === "haptics" ? 0.007 : kind === "interface" ? 0.005 : 0;
  return Math.round(hull * perTon * 1000) / 1000;
}
