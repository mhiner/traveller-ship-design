import type { AdvancedDesign, DesignLine } from "../design.ts";
import {
  customTonnageNote,
  DRIVE_POWER_PER_TON,
  driveAdjustment,
  driveEffectiveTons,
  JUMP_COST_PER_TON,
  JUMP_FUEL_FRACTION,
  JUMP_HULL_PERCENT,
  JUMP_MIN_HULL_TONS,
  JUMP_TL,
  jumpDriveTons,
  jumpPerformance,
  MANOEUVRE_COST_PER_TON,
  MANOEUVRE_HULL_PERCENT,
  MANOEUVRE_TL,
  manoeuvreDriveTons,
  manoeuvrePerformance,
  POWER_PLANTS,
  powerPlantFuelTons,
  THRUST_ZERO_POWER_FACTOR,
} from "../catalog/drives.ts";
import {
  FUEL_CARGO_COST_PER_TON,
  FUEL_CARGO_TONS_FACTOR,
} from "../catalog/fittings.ts";
import {
  findById,
  type ModulePower,
  round2,
  round3,
  sheetLine,
  whole,
} from "./shared.ts";

export interface DriveDemand {
  basePower: number;
  hullOptionPower: number;
  modulePower: ModulePower;
  weaponPower: number;
  sensorPower: number;
  fittingsPower: number;
}

export interface DrivesSection {
  lines: DesignLine[];
  errors: string[];
  warnings: string[];
  thrust: number;
  jump: number;
  thrustRating: number;
  jumpRating: number;
  manoeuvreTons: number;
  jumpTons: number;
  plantTons: number;
  plantTonsShown: number;
  jumpFuel: number;
  powerFuel: number;
  fuelMinimum: number;
  fuelTons: number;
  /** Combined capacity of every fuel/cargo container. It offsets the fuel tank. */
  containerTons: number;
  powerUse: {
    base: number;
    jump: number;
    maneuver: number;
    weapons: number;
    sensors: number;
    fittings: number;
    total: number;
  };
}

/** Capacities of the original container and each added container, in tons. */
export function containerCapacities(
  design: { containerTons?: number; extraContainers?: readonly { tons?: number }[] },
): number[] {
  const first = Number.isFinite(design.containerTons)
    ? Math.max(0, Math.round(design.containerTons ?? 0))
    : 0;
  const rest = (design.extraContainers ?? []).map((row) =>
    Number.isFinite(row?.tons) ? Math.max(0, Math.round(row.tons ?? 0)) : 0
  );
  return [first, ...rest];
}

export function plannedJump(
  design: AdvancedDesign,
  hullTons: number,
  moduleHull: boolean,
): number {
  return moduleHull || hullTons < JUMP_MIN_HULL_TONS ? 0 : whole(design.jump);
}

export function buildDrives(
  design: AdvancedDesign,
  hullTons: number,
  moduleHull: boolean,
  poweredModule: boolean,
  techLevel: number,
  demand: DriveDemand,
): DrivesSection {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines: DesignLine[] = [];
  const thrust = moduleHull ? 0 : whole(design.thrust);
  const jump = plannedJump(design, hullTons, moduleHull);
  const power = (moduleHull && !poweredModule) || !Number.isFinite(design.power)
    ? 0
    : Math.max(0, Math.round(design.power * 100) / 100);
  const weeks = Math.max(1, whole(design.powerWeeks));
  const thrustBasis = moduleHull
    ? 0
    : driveEffectiveTons(hullTons, design.driveCustom?.thrust);
  const jumpBasis = moduleHull
    ? 0
    : driveEffectiveTons(hullTons, design.driveCustom?.jump);
  const thrustRating = moduleHull
    ? 0
    : manoeuvrePerformance(hullTons, thrustBasis, thrust);
  const jumpRating = moduleHull
    ? 0
    : jumpPerformance(hullTons, jumpBasis, jump);
  const jumpPower = moduleHull || JUMP_HULL_PERCENT[jump] == null
    ? 0
    : Math.round(jumpBasis * DRIVE_POWER_PER_TON * jump);
  const maneuverPower = moduleHull || MANOEUVRE_HULL_PERCENT[thrust] == null
    ? 0
    : Math.round(
      thrustBasis * DRIVE_POWER_PER_TON *
        (thrust === 0 ? THRUST_ZERO_POWER_FACTOR : thrust),
    );
  const manoeuvreTons = moduleHull
    ? 0
    : manoeuvreDriveTons(thrustBasis, thrust);
  const jumpTons = moduleHull ? 0 : jumpDriveTons(jumpBasis, jump);
  const plant = findById(POWER_PLANTS, design.powerPlant, POWER_PLANTS[2]);
  const plantTons = power <= 0
    ? 0
    : Math.ceil(power * 100 / plant.powerPerTon) / 100;
  const thrustFit = driveAdjustment("thrust", design.driveCustom?.thrust);
  const jumpFit = driveAdjustment("jump", design.driveCustom?.jump);
  const plantFit = driveAdjustment("plant", design.driveCustom?.plant);
  const thrustTons = round2(manoeuvreTons * thrustFit.tonsFactor);
  const thrustDrivePower = Math.round(maneuverPower * thrustFit.powerFactor);
  const jumpTonsShown = round2(jumpTons * jumpFit.tonsFactor);
  const jumpDrivePower = Math.round(jumpPower * jumpFit.powerFactor);
  const plantTonsShown = round2(plantTons * plantFit.tonsFactor);
  const plantOutput = !plantFit.roundUp && plantFit.outputFactor === 1
    ? power
    : plantFit.roundUp
    ? Math.ceil(Math.round(power * plantFit.outputFactor * 1000) / 1000)
    : Math.round(Math.round(power * plantFit.outputFactor * 1000) / 1000);
  const {
    basePower,
    hullOptionPower,
    modulePower,
    weaponPower,
    sensorPower,
    fittingsPower,
  } = demand;
  const powerUse = {
    base: basePower + hullOptionPower + modulePower.base,
    jump: jumpDrivePower + modulePower.jump,
    maneuver: thrustDrivePower + modulePower.maneuver,
    weapons: weaponPower + modulePower.weapons,
    sensors: sensorPower + modulePower.sensors,
    fittings: fittingsPower + modulePower.fittings,
    total: basePower + hullOptionPower + modulePower.base + jumpDrivePower +
      modulePower.jump + thrustDrivePower + modulePower.maneuver + weaponPower +
      modulePower.weapons + sensorPower + modulePower.sensors + fittingsPower +
      modulePower.fittings,
  };
  const thrustName = customTonnageNote(hullTons, thrustBasis);
  const jumpName = customTonnageNote(hullTons, jumpBasis);
  if (!moduleHull && MANOEUVRE_HULL_PERCENT[thrust] != null) {
    lines.push(sheetLine("manoeuvre", {
      name: thrustName
        ? `Manoeuvre drive ${thrust} (${thrustName})`
        : `Manoeuvre drive ${thrust}`,
      tons: thrustTons,
      cost: round2(
        manoeuvreTons * MANOEUVRE_COST_PER_TON * thrustFit.costFactor,
      ),
      power: thrustDrivePower,
    }));
  }
  if (!moduleHull && JUMP_HULL_PERCENT[jump] != null) {
    lines.push(sheetLine("jump", {
      name: jumpName
        ? `Jump drive ${jump} (${jumpName})`
        : `Jump drive ${jump}`,
      tons: jumpTonsShown,
      cost: round2(jumpTons * JUMP_COST_PER_TON * jumpFit.costFactor),
      power: jumpDrivePower,
    }));
  }
  if ((!moduleHull || poweredModule) && power > 0) {
    lines.push(
      sheetLine("plant", {
        name: plant.label,
        tons: plantTonsShown,
        cost: round2(plantTons * plant.costPerTon * plantFit.costFactor),
        power: plantOutput,
      }),
    );
  }
  if (
    (!moduleHull || poweredModule) && power > 0 &&
    plant.tl + plantFit.tl > techLevel
  ) {
    errors.push(
      `${plant.label} requires tech level ${plant.tl + plantFit.tl}.`,
    );
  }
  if (!moduleHull && thrust > 11) errors.push("Thrust is above 11.");
  if (!moduleHull && jump > 9) errors.push("Jump is above 9.");
  const thrustTl = (MANOEUVRE_TL[thrustRating] ?? 0) +
    (MANOEUVRE_HULL_PERCENT[thrust] == null ? 0 : thrustFit.tl);
  if (!moduleHull && thrustTl > techLevel) {
    errors.push(`Thrust ${thrustRating} requires tech level ${thrustTl}.`);
  }
  const jumpTl = (JUMP_TL[jumpRating] ?? 0) +
    (JUMP_HULL_PERCENT[jump] == null ? 0 : jumpFit.tl);
  if (!moduleHull && jumpTl > techLevel) {
    errors.push(`Jump ${jumpRating} requires tech level ${jumpTl}.`);
  }
  const jumpFuel = round2(
    jumpBasis * JUMP_FUEL_FRACTION * jump *
      (JUMP_HULL_PERCENT[jump] == null ? 1 : jumpFit.fuelFactor),
  );
  const powerFuel = powerPlantFuelTons(
    plant.id,
    plantTonsShown,
    weeks,
    hullTons,
  );
  const combinedFuel = round2(jumpFuel + powerFuel);
  const fuelRequired = hullTons < 100 ? combinedFuel : Math.ceil(combinedFuel);
  const containers = containerCapacities(design);
  const containerTons = containers.reduce((total, tons) => total + tons, 0);
  const fuelMinimum = Math.max(0, round2(fuelRequired - containerTons));
  const requestedFuel = Number.isFinite(design.fuelTons)
    ? Math.max(
      0,
      hullTons < 100 ? round2(design.fuelTons) : Math.round(design.fuelTons),
    )
    : 0;
  const fuelTons = Math.max(requestedFuel, fuelMinimum);
  if (fuelTons > 0) {
    lines.push(
      sheetLine("fuel", { name: "Fuel tank", tons: fuelTons, cost: 0 }),
    );
  }
  for (const tons of containers) {
    if (tons <= 0) continue;
    lines.push(sheetLine("fuel", {
      name: `Fuel/cargo container (${tons} t)`,
      tons: round2(tons * FUEL_CARGO_TONS_FACTOR),
      cost: round3(tons * FUEL_CARGO_COST_PER_TON),
    }));
  }
  return {
    lines,
    errors,
    warnings,
    thrust,
    jump,
    thrustRating,
    jumpRating,
    manoeuvreTons,
    jumpTons,
    plantTons,
    plantTonsShown,
    jumpFuel,
    powerFuel,
    fuelMinimum,
    fuelTons,
    containerTons,
    powerUse,
  };
}
