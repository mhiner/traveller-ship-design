import { CARGO_GEAR, type CargoGear } from "../../src/catalog/fittings.ts";
import {
  driveEffectiveTons,
  JUMP_MIN_HULL_TONS,
  jumpPerformance,
  manoeuvrePerformance
} from "../../src/catalog/drives.ts";
import { type AdvancedDesign, evaluateDesign } from "../../src/design.ts";

/** Tons sitting outside the hull: external mounts, cargo nets, and ships on clamps. */
export interface ExternalLoad {
  external: number;
  jumpNet: number;
  planetary: number;
  /** Ships held on docking clamps, outside the hull. */
  clamped: number;
}

/** Which cargo space a hardware key represents. Internal cargo is the ship's own hold. */
export function cargoSpaceKind(
  key: string | undefined
): "internal" | "external" | "jumpNet" | "planetaryNet" | "breakaway" | null {
  if (!key) return null;
  if (key === "cargo") return "internal";
  if (key.includes(":external:") || key.endsWith(":external")) return "external";
  if (key.includes(":jumpNet:") || key.endsWith(":jumpNet")) return "jumpNet";
  if (key.includes(":planetaryNet:") || key.endsWith(":planetaryNet")) {
    return "planetaryNet";
  }
  if (key.startsWith("breakaway:") || key.includes(":breakaway:")) return "breakaway";
  return null;
}

/** Cargo capacities for fittings that are actually installed. */
export function externalCargoSpaces(
  design: { cargoGear?: CargoGear[] } | null | undefined
): { key: string; kind: "external" | "jumpNet" | "planetaryNet"; name: string; capacity: number; tl: number }[] {
  const spaces = [];
  for (const gear of design?.cargoGear ?? []) {
    if (gear.kind !== "external" && gear.kind !== "jumpNet" && gear.kind !== "planetaryNet") {
      continue;
    }
    const capacity = Number.isFinite(gear.quantity) ? Math.max(0, gear.quantity) : 0;
    if (capacity <= 0) continue;
    const spec = CARGO_GEAR.find((row) => row.id === gear.kind);
    spaces.push({
      key: `cargo:${gear.kind}:${gear.id || gear.kind}`,
      kind: gear.kind,
      name: spec?.label ?? gear.kind,
      capacity: Math.round(capacity * 1000) / 1000,
      tl: spec?.tl ?? 0
    });
  }
  return spaces;
}

/** Tons of cargo assigned to each external space. Unassigned cargo stays internal. */
export function externalLoad(
  held: readonly { hold?: string; tons: number }[]
): ExternalLoad {
  const load: ExternalLoad = { external: 0, jumpNet: 0, planetary: 0, clamped: 0 };
  for (const row of held) {
    const tons = Number.isFinite(row.tons) ? Math.max(0, row.tons) : 0;
    const kind = cargoSpaceKind(row.hold);
    if (kind === "external") load.external += tons;
    else if (kind === "jumpNet") load.jumpNet += tons;
    else if (kind === "planetaryNet") load.planetary += tons;
  }
  load.external = Math.round(load.external * 1000) / 1000;
  load.jumpNet = Math.round(load.jumpNet * 1000) / 1000;
  load.planetary = Math.round(load.planetary * 1000) / 1000;
  return load;
}

/**
 * Drive ratings after external cargo or a clamped ship is aboard.
 * Interstellar nets, external mounts, and docking clamps burden jump and maneuver.
 * An interplanetary net burdens maneuver, and any cargo in it prevents a jump.
 */
export function effectiveDrives(
  design: Pick<AdvancedDesign, "hullTons" | "thrust" | "jump" | "driveCustom">,
  load: ExternalLoad,
  installed?: { thrust?: number; jump?: number }
): { mdrive: number; jdrive: number } {
  const hull = Number.isFinite(design.hullTons) ? Math.max(0, design.hullTons) : 0;
  const thrust = Number.isFinite(installed?.thrust)
    ? Number(installed?.thrust)
    : (Number(design.thrust) || 0);
  const jump = Number.isFinite(installed?.jump)
    ? Number(installed?.jump)
    : (Number(design.jump) || 0);
  const thrustBasis = driveEffectiveTons(hull, design.driveCustom?.thrust);
  const jumpBasis = driveEffectiveTons(hull, design.driveCustom?.jump);
  const carried = load.external + load.jumpNet + (load.clamped ?? 0);
  const mdrive = Math.min(
    thrust,
    manoeuvrePerformance(hull + carried + load.planetary, thrustBasis, thrust)
  );
  // A hull under the jump minimum, or any cargo in an interplanetary net, has jump 0.
  if (load.planetary > 0 || hull < JUMP_MIN_HULL_TONS) return { mdrive, jdrive: 0 };
  return {
    mdrive,
    jdrive: Math.min(jump, jumpPerformance(hull + carried, jumpBasis, jump))
  };
}

/**
 * Tons a jump is scored against.
 * The hull plus cargo and clamped ships outside it. Cargo in an interplanetary net prevents a jump.
 */
export function jumpDisplacement(
  hullTons: number,
  load: { external?: number; jumpNet?: number; planetary?: number; clamped?: number }
): number {
  if ((load.planetary ?? 0) > 0) return 0;
  const hull = Number.isFinite(hullTons) ? Math.max(0, hullTons) : 0;
  const carried = (load.external ?? 0) + (load.jumpNet ?? 0) + (load.clamped ?? 0);
  return Math.round((hull + carried) * 1000) / 1000;
}

/**
 * Fuel for one jump at `jump`.
 * Uses the design's jump fuel, then scales it when the ship is jumping at a different rating or displacement.
 */
export function jumpFuelUse(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = [],
  jump = design.jump,
  hullTons = design.hullTons
): number {
  const rated = Number(design.jump) || 0;
  const want = Number(jump) || 0;
  if (rated <= 0 || want <= 0) return 0;
  const sheet = evaluateDesign(design, catalog);
  if (sheet.jumpFuel <= 0) return 0;
  const hull = Number(design.hullTons) || 0;
  const shown = Number(hullTons) || 0;
  // A missing displacement scales the fuel by jump rating alone.
  const scale = hull > 0 && shown > 0 ? shown / hull : 1;
  return Math.round(sheet.jumpFuel * (want / rated) * scale * 100) / 100;
}
