import type { DriveCustom, DriveOption } from "./drives.ts";

export const TURRET_WEAPONS = [
  { id: "beam", label: "Beam laser", tl: 10, cost: 0.5, power: 4 },
  { id: "fusion", label: "Fusion gun", tl: 14, cost: 2, power: 12 },
  { id: "drill", label: "Laser drill", tl: 8, cost: 0.15, power: 4 },
  { id: "missile", label: "Missile rack", tl: 7, cost: 0.75, power: 0 },
  { id: "particle", label: "Particle beam", tl: 12, cost: 4, power: 8 },
  { id: "plasma", label: "Plasma gun", tl: 11, cost: 2.5, power: 6 },
  { id: "pulse", label: "Pulse laser", tl: 9, cost: 1, power: 4 },
  { id: "railgun", label: "Railgun", tl: 10, cost: 1, power: 2 },
  { id: "sand", label: "Sandcaster", tl: 9, cost: 0.25, power: 0 },
] as const;

export type TurretWeaponId = (typeof TURRET_WEAPONS)[number]["id"];

/** One weapon. The mount is 5 tons; the weapon carries the cost and power. */
export const BARBETTE_WEAPONS = [
  {
    id: "beamBarbette",
    label: "Beam Laser Barbette",
    tl: 10,
    cost: 3,
    power: 12,
  },
  {
    id: "fusionBarbette",
    label: "Fusion Barbette",
    tl: 12,
    cost: 4,
    power: 20,
  },
  { id: "ion", label: "Ion Cannon", tl: 12, cost: 6, power: 10 },
  {
    id: "missileBarbette",
    label: "Missile Barbette",
    tl: 7,
    cost: 4,
    power: 0,
  },
  {
    id: "particleBarbette",
    label: "Particle Barbette",
    tl: 11,
    cost: 8,
    power: 15,
  },
  {
    id: "plasmaBarbette",
    label: "Plasma Barbette",
    tl: 11,
    cost: 5,
    power: 12,
  },
  {
    id: "pulseBarbette",
    label: "Pulse Laser Barbette",
    tl: 9,
    cost: 6,
    power: 12,
  },
  {
    id: "railgunBarbette",
    label: "Railgun Barbette",
    tl: 10,
    cost: 2,
    power: 5,
  },
  { id: "torpedo", label: "Torpedo Barbette", tl: 7, cost: 3, power: 2 },
] as const;

export type BarbetteWeaponId = (typeof BARBETTE_WEAPONS)[number]["id"];
export type MountWeaponId = TurretWeaponId | BarbetteWeaponId;

export const MOUNT_KINDS = [
  {
    id: "single",
    label: "Single turret",
    weapons: 1,
    tl: 7,
    power: 1,
    tons: 1,
    cost: 0.2,
  },
  {
    id: "double",
    label: "Double turret",
    weapons: 2,
    tl: 8,
    power: 1,
    tons: 1,
    cost: 0.5,
  },
  {
    id: "triple",
    label: "Triple turret",
    weapons: 3,
    tl: 9,
    power: 1,
    tons: 1,
    cost: 1,
  },
  {
    id: "fixed",
    label: "Fixed mount",
    weapons: 3,
    tl: 0,
    power: 0,
    tons: 0,
    cost: 0.1,
  },
  {
    id: "barbette",
    label: "Barbette",
    weapons: 1,
    tl: 0,
    power: 0,
    tons: 5,
    cost: 0,
  },
] as const;

export type MountKindId = (typeof MOUNT_KINDS)[number]["id"];

export interface WeaponMount {
  id: string;
  kind: MountKindId;
  weapons: MountWeaponId[];
  /** High Guard advantages or disadvantages, one entry per fitted weapon. */
  custom?: DriveCustom[];
  /** The mount retracts into the hull. Stored only when fitted. */
  popup?: boolean;
}

/** Pop-up mounting for a turret or fixed mount. Power is unchanged. */
export const POPUP_MOUNT = { tl: 10, tons: 1, cost: 1 } as const;

export function mountLineName(label: string, popup: boolean): string {
  return popup ? `${label} (pop-up)` : label;
}

export function parseMountLine(
  name: string,
): { label: string; popup: boolean; turret: boolean } | null {
  for (const kind of MOUNT_KINDS) {
    const popup = name === `${kind.label} (pop-up)`;
    if (name !== kind.label && !popup) continue;
    return { label: kind.label, popup, turret: kind.label.endsWith("turret") };
  }
  return null;
}

/** An adjustable hull gives every weapon pop-up mounting. */
export function hasAdjustableHull(
  options: readonly { kind: string }[] | undefined,
): boolean {
  return (options ?? []).some((option) =>
    option.kind === "adjustable" || option.kind === "adjustable15"
  );
}

/** Every fitted weapon is on a pop-up mount, so an exterior sensor scan does not show them. */
export function exteriorAppearsUnarmed(
  mounts: readonly WeaponMount[],
  hullTons: number,
  automaticPopup = false,
): boolean {
  let fitted = 0;
  let hidden = 0;
  for (const mount of mounts) {
    const count =
      mount.weapons.slice(0, mountWeaponSlots(mount.kind, hullTons)).filter((
        weapon,
      ) => weapon).length;
    if (count === 0) continue;
    fitted += count;
    if (automaticPopup || mount.popup === true) hidden += count;
  }
  return fitted > 0 && hidden === fitted;
}

/** Weapon and screen advantages and disadvantages. Percent changes are additive. Increased size is 20%. */
export const WEAPON_OPTIONS: readonly DriveOption[] = [
  { id: "accurate", label: "Accurate", kind: "advantage", slots: 2 },
  { id: "easyRepair", label: "Easy to Repair", kind: "advantage", slots: 1 },
  {
    id: "energyEfficient",
    label: "Energy Efficient",
    kind: "advantage",
    slots: 1,
    power: -0.25,
  },
  { id: "highYield", label: "High Yield", kind: "advantage", slots: 1 },
  {
    id: "veryHighYield",
    label: "Very High Yield",
    kind: "advantage",
    slots: 2,
  },
  { id: "intenseFocus", label: "Intense Focus", kind: "advantage", slots: 2 },
  { id: "longRange", label: "Long Range", kind: "advantage", slots: 2 },
  { id: "resilient", label: "Resilient", kind: "advantage", slots: 1 },
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
  { id: "inaccurate", label: "Inaccurate", kind: "disadvantage", slots: 1 },
  {
    id: "increasedSize",
    label: "Increased Size",
    kind: "disadvantage",
    slots: 1,
    tons: 0.2,
  },
];

const LASER_WEAPONS = new Set<MountWeaponId>([
  "beam",
  "drill",
  "pulse",
  "beamBarbette",
  "pulseBarbette",
]);
const PARTICLE_WEAPONS = new Set<MountWeaponId>([
  "particle",
  "particleBarbette",
]);
const MISSILE_WEAPONS = new Set<MountWeaponId>([
  "missile",
  "missileBarbette",
  "torpedo",
]);

/** Options that can be applied to this weapon. Turret weapons cannot take size reduction. Missiles cannot take yield options. Intense Focus is lasers and particle weapons. */
export function weaponChoices(
  weaponId: MountWeaponId,
  mountKind: MountKindId,
): DriveOption[] {
  return WEAPON_OPTIONS.filter((option) => {
    if (
      (option.id === "highYield" || option.id === "veryHighYield") &&
      MISSILE_WEAPONS.has(weaponId)
    ) return false;
    if (
      option.id === "intenseFocus" && !LASER_WEAPONS.has(weaponId) &&
      !PARTICLE_WEAPONS.has(weaponId)
    ) return false;
    if (option.id === "sizeReduction" && mountKind !== "fixed") return false;
    return true;
  });
}

/** Hulls under 100 tons use firmpoints. One per hull under 35 tons, two from 35 to 70, three from 70 to 99. */
export function weaponPoints(
  hullTons: number,
): { count: number; label: "Hardpoints" | "Firmpoints" } {
  if (hullTons >= 100) {
    return { count: Math.floor(hullTons / 100), label: "Hardpoints" };
  }
  if (hullTons < 35) return { count: 1, label: "Firmpoints" };
  if (hullTons <= 70) return { count: 2, label: "Firmpoints" };
  return { count: 3, label: "Firmpoints" };
}

/** A fixed mount on a hull under 100 tons holds one weapon. At 100 tons and above it holds three. */
export function mountWeaponSlots(kind: MountKindId, hullTons: number): number {
  if (hullTons < 100 && kind === "fixed") return 1;
  return MOUNT_KINDS.find((row) => row.id === kind)?.weapons ?? 1;
}

export function weaponsForMount(kind: MountKindId) {
  return kind === "barbette" ? BARBETTE_WEAPONS : TURRET_WEAPONS;
}

/** A barbette uses one hardpoint, or three firmpoints. Every other mount uses one. */
export function mountPointCost(kind: MountKindId, hullTons: number): number {
  if (kind === "barbette" && hullTons < 100) return 3;
  return 1;
}

export function pointsUsed(
  mounts: readonly { kind: MountKindId }[],
  hullTons: number,
): number {
  return mounts.reduce(
    (total, mount) => total + mountPointCost(mount.kind, hullTons),
    0,
  );
}

export function mountKindsFor(
  hullTons: number,
  mounts: readonly WeaponMount[],
  exceptId?: string,
) {
  if (hullTons >= 100) return MOUNT_KINDS;
  const others = mounts.filter((mount) => mount.id !== exceptId);
  const singleTaken = others.some((mount) => mount.kind === "single");
  const room = weaponPoints(hullTons).count - pointsUsed(others, hullTons);
  return MOUNT_KINDS.filter((kind) => {
    if (kind.id === "barbette") return room >= 3;
    if (kind.id === "single") return !singleTaken && room >= 1;
    return kind.id === "fixed" && room >= 1;
  });
}

/** Firmpoint weapons use 25% less power, rounded up. */
export function weaponPowerPoints(power: number, hullTons: number): number {
  if (hullTons >= 100) return power;
  return Math.ceil(power * 0.75);
}
