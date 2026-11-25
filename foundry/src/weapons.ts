import {
  type DriveCustom,
  customAdjustment,
  legalCustomOptions
} from "../../src/catalog/drives.ts";
import {
  type MountKindId,
  type MountWeaponId,
  weaponChoices,
  weaponPowerPoints,
  weaponsForMount
} from "../../src/catalog/weapons.ts";

/** Range bands from nearest to farthest. A custom shift moves one step along this list. */
const RANGE_BANDS = [
  "adjacent",
  "close",
  "short",
  "medium",
  "long",
  "verylong"
] as const;

interface WeaponProfile {
  range: string;
  damage: string;
  damageType: string;
  attack?: number;
  traits?: string[];
  magazine?: number;
  firmpointMagazine?: number;
  magazineCost?: number;
}

/** Combat line for each weapon the design can mount. Damage is a Foundry roll. */
const PROFILES: Record<MountWeaponId, WeaponProfile> = {
  beam: { range: "medium", damage: "1d6", damageType: "laser" },
  fusion: {
    range: "medium",
    damage: "4d6",
    damageType: "plasma",
    traits: ["radiation"]
  },
  drill: {
    range: "adjacent",
    damage: "4d6",
    damageType: "laser",
    attack: -3
  },
  missile: {
    range: "special",
    damage: "4d6",
    damageType: "standard",
    traits: ["smart"],
    magazine: 12,
    firmpointMagazine: 4
  },
  particle: {
    range: "verylong",
    damage: "3d6",
    damageType: "energy",
    traits: ["radiation"]
  },
  plasma: { range: "medium", damage: "3d6", damageType: "plasma" },
  pulse: { range: "long", damage: "2d6", damageType: "laser" },
  railgun: {
    range: "short",
    damage: "2d6",
    damageType: "standard",
    traits: ["ap 4"],
    magazine: 12
  },
  sand: {
    range: "close",
    damage: "Special",
    damageType: "standard",
    magazine: 12,
    magazineCost: 25000
  },
  beamBarbette: { range: "medium", damage: "2d6", damageType: "laser" },
  fusionBarbette: {
    range: "medium",
    damage: "5d6",
    damageType: "plasma",
    traits: ["radiation"]
  },
  ion: {
    range: "medium",
    damage: "2d6 * 10",
    damageType: "energy",
    traits: ["ion"]
  },
  missileBarbette: {
    range: "special",
    damage: "4d6",
    damageType: "standard",
    traits: ["smart"],
    magazine: 25,
    firmpointMagazine: 8
  },
  particleBarbette: {
    range: "verylong",
    damage: "4d6",
    damageType: "energy",
    traits: ["radiation"]
  },
  plasmaBarbette: { range: "medium", damage: "4d6", damageType: "plasma" },
  pulseBarbette: { range: "long", damage: "3d6", damageType: "laser" },
  railgunBarbette: {
    range: "medium",
    damage: "3d6",
    damageType: "standard",
    traits: ["ap 5"],
    magazine: 12
  },
  torpedo: {
    range: "special",
    damage: "6d6",
    damageType: "standard",
    traits: ["smart"],
    magazine: 3,
    firmpointMagazine: 2
  }
};

/** Combat fields written onto a weapon item, plus the power that weapon draws. */
export interface WeaponCombat {
  damage: string;
  spaceRange: string;
  characteristic: "DEX";
  skill: "gunner.turret";
  attackBonus: number;
  damageBonus: "";
  damageType: string;
  traits: string;
  parryBonus: 0;
  power: number;
  magazine?: number;
  magazineCost?: number;
}

/** Moves a band by a number of steps, staying inside the list. An unlisted band is returned unchanged. */
function shiftRange(range: string, steps: number): string {
  const index = RANGE_BANDS.indexOf(range as (typeof RANGE_BANDS)[number]);
  if (index < 0) return range;
  const next = Math.min(RANGE_BANDS.length - 1, Math.max(0, index + steps));
  return RANGE_BANDS[next];
}

/** Firmpoint weapons lose range. A listed Medium or shorter band becomes Adjacent, and nothing can reach past Close. */
function combatRange(
  range: string,
  longRange: boolean,
  firmpoint: boolean
): string {
  if (range === "special") return "distant";
  if (!firmpoint) return longRange ? shiftRange(range, 1) : range;
  const index = RANGE_BANDS.indexOf(range as (typeof RANGE_BANDS)[number]);
  const medium = RANGE_BANDS.indexOf("medium");
  let reduced = index <= medium ? "adjacent" : "close";
  if (longRange && reduced === "adjacent") reduced = "close";
  return reduced;
}

/** Joins trait text. Intense Focus adds 2 to an existing AP value, or adds AP 2 when the weapon has none. */
function combatTraits(traits: readonly string[], intenseFocus: boolean): string {
  const next = [...traits];
  if (intenseFocus) {
    const ap = next.findIndex((trait) => trait.startsWith("ap "));
    if (ap >= 0) {
      const value = Number(next[ap].slice(3)) || 0;
      next[ap] = `ap ${value + 2}`;
    } else {
      next.push("ap 2");
    }
  }
  return next.join(", ");
}

/** Power, damage, range, skill, and modifiers for one fitted weapon. */
export function weaponCombat(
  weaponId: string,
  mountKind: MountKindId,
  hullTons: number,
  custom?: DriveCustom
): WeaponCombat | null {
  const item = weaponsForMount(mountKind).find((row) => row.id === weaponId);
  const profile = PROFILES[weaponId as MountWeaponId];
  if (!item || !profile) return null;
  const pool = weaponChoices(item.id, mountKind);
  const chosen = legalCustomOptions(pool, custom);
  const ids = new Set(chosen.map((option) => option.id));
  const fit = customAdjustment(pool, custom);
  // A hull under 100 tons mounts these weapons as firmpoints.
  const firmpoint = hullTons < 100;
  // A firmpoint uses the smaller magazine when the profile lists one.
  const magazine = firmpoint && profile.firmpointMagazine != null
    ? profile.firmpointMagazine
    : profile.magazine;
  // Power is the hull-scaled weapon draw times the custom power factor.
  return {
    damage: profile.damage,
    spaceRange: combatRange(profile.range, ids.has("longRange"), firmpoint),
    characteristic: "DEX",
    skill: "gunner.turret",
    attackBonus: (profile.attack ?? 0) + (ids.has("accurate") ? 1 : 0) -
      (ids.has("inaccurate") ? 1 : 0),
    damageBonus: "",
    damageType: profile.damageType,
    traits: combatTraits(profile.traits ?? [], ids.has("intenseFocus")),
    parryBonus: 0,
    power: Math.round(weaponPowerPoints(item.power, hullTons) * fit.powerFactor),
    ...(magazine != null ? { magazine } : {}),
    ...(profile.magazineCost != null
      ? { magazineCost: profile.magazineCost }
      : {})
  };
}
