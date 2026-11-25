import type { AdvancedDesign, DesignLine } from "../design.ts";
import {
  resolveAmenities,
  resolveCargoGear,
  resolveExternalSystems,
  resolveWorkSpaces,
} from "../resolve.ts";
import {
  AMENITIES,
  amenityCost,
  amenityPower,
  amenityTons,
  CARGO_GEAR,
  EXTERNAL_SYSTEMS,
  externalSystemPower,
  FITTINGS,
  forcedLinkageAt,
  holographicHullCost,
  holographicHullPower,
  roboticsAvatarChair,
  roboticsDroneController,
  roboticsFabricator,
  roboticsSwarmController,
  towCableCost,
  towCableTons,
  WORK_SPACES,
} from "../catalog/fittings.ts";
import { type ConfigurationId } from "../catalog/hull.ts";
import {
  countedName,
  findById,
  roboticsLineName,
  round2,
  round3,
  sheetLine,
  whole,
} from "./shared.ts";

export interface FittingsSection {
  lines: DesignLine[];
  /** Checks made while the power total is assembled. Reported before drive errors. */
  powerErrors: string[];
  errors: string[];
  fittingsPower: number;
  staterooms: number;
}

export function buildFittings(
  design: AdvancedDesign,
  hullTons: number,
  moduleHull: boolean,
  poweredModule: boolean,
  techLevel: number,
  configurationId: ConfigurationId,
  streamlined: boolean,
): FittingsSection {
  const powerErrors: string[] = [];
  const errors: string[] = [];
  const lines: DesignLine[] = [];
  const spaces = resolveWorkSpaces(design.workSpaces);
  const amenities = resolveAmenities(design.amenities);
  const externalSystems = resolveExternalSystems(design.externalSystems);
  const lowBerths = whole(design.lowBerths);
  const emergencyLowBerths = whole(design.emergencyLowBerths);
  const processors = whole(design.processorTons);
  let fittingsPower = Math.ceil(lowBerths / 10) + emergencyLowBerths +
    processors;
  const cargoGear = resolveCargoGear(design.cargoGear);
  for (const gear of cargoGear) {
    const kind = findById(CARGO_GEAR, gear.kind, CARGO_GEAR[0]);
    if (kind.tl > 0 && techLevel < kind.tl) {
      powerErrors.push(`${kind.label} requires tech level ${kind.tl}.`);
    }
    if (kind.power > 0) fittingsPower += kind.power * gear.quantity;
  }
  if (
    cargoGear.some((gear) => gear.kind === "external") &&
    (configurationId === "streamlined" || configurationId === "distributed")
  ) {
    powerErrors.push(
      "External cargo mounts cannot be fitted to a streamlined or dispersed hull.",
    );
  }
  for (const space of spaces) {
    const kind = findById(WORK_SPACES, space.kind, WORK_SPACES[0]);
    if (kind.tl > 0 && techLevel < kind.tl) {
      powerErrors.push(`${kind.label} requires tech level ${kind.tl}.`);
    }
    fittingsPower += kind.power * space.quantity;
    if (space.kind !== "robotics") continue;
    for (
      const [prefix, option] of [
        ["", roboticsAvatarChair(space.avatarChair)],
        ["Fabrication chamber", roboticsFabricator(space.fabrication)],
        ["Drone controller", roboticsDroneController(space.droneController)],
        ["Swarm controller", roboticsSwarmController(space.swarmController)],
      ] as const
    ) {
      if (option.id === "none") continue;
      if (option.tl > 0 && techLevel < option.tl) {
        powerErrors.push(
          `${
            roboticsLineName(prefix, option)
          } requires tech level ${option.tl}.`,
        );
      }
    }
  }
  for (const amenity of amenities) {
    fittingsPower += amenityPower(amenity.kind, amenity.quantity);
  }
  for (const system of externalSystems) {
    const kind = findById(EXTERNAL_SYSTEMS, system.kind, EXTERNAL_SYSTEMS[0]);
    const required = kind.id === "linkage"
      ? forcedLinkageAt(system.techLevel ?? 0).tl
      : kind.tl;
    if (required > 0 && techLevel < required) {
      powerErrors.push(`${kind.label} requires tech level ${required}.`);
    }
    fittingsPower += externalSystemPower(kind.id, hullTons);
  }

  const staterooms = whole(design.staterooms);
  const cabinSpaces = whole(design.cabinSpaces);
  if (staterooms > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "Staterooms",
        tons: round2(staterooms * FITTINGS.stateroom.tons),
        cost: round2(staterooms * FITTINGS.stateroom.cost),
      }),
    );
  }
  const commonTons = round2(
    Math.max(0, Number.isFinite(design.commonTons) ? design.commonTons : 0),
  );
  if (commonTons > 0) {
    lines.push(
      sheetLine("common", {
        name: FITTINGS.common.label,
        tons: commonTons,
        cost: round2(commonTons * FITTINGS.common.cost),
      }),
    );
  }
  if (lowBerths > 0) {
    const lowBerthPower = Math.ceil(lowBerths / 10);
    lines.push(
      sheetLine("accommodation", {
        name: "Low berths",
        tons: round2(lowBerths * FITTINGS.lowBerth.tons),
        cost: round2(lowBerths * FITTINGS.lowBerth.cost),
        power: lowBerthPower,
      }),
    );
  }
  if (emergencyLowBerths > 0) {
    lines.push(sheetLine("accommodation", {
      name: "Emergency low berths",
      tons: emergencyLowBerths * FITTINGS.emergencyLowBerth.tons,
      cost: round2(emergencyLowBerths * FITTINGS.emergencyLowBerth.cost),
      power: emergencyLowBerths,
    }));
  }
  if (cabinSpaces > 0) {
    const cabinTons = round2(cabinSpaces * FITTINGS.cabin.tons);
    lines.push(
      sheetLine("accommodation", {
        name: FITTINGS.cabin.label,
        tons: cabinTons,
        cost: round2(cabinTons * FITTINGS.cabin.costPerTon),
      }),
    );
  }
  const accelerationBenches = whole(design.accelerationBenches);
  const accelerationSeats = whole(design.accelerationSeats);
  const highStaterooms = whole(design.highStaterooms);
  const luxuryStaterooms = whole(design.luxuryStaterooms);
  if (accelerationBenches > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "Acceleration benches",
        tons: accelerationBenches * FITTINGS.accelerationBench.tons,
        cost: round3(accelerationBenches * FITTINGS.accelerationBench.cost),
      }),
    );
  }
  if (accelerationSeats > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "Acceleration seats",
        tons: round2(accelerationSeats * FITTINGS.accelerationSeat.tons),
        cost: round3(accelerationSeats * FITTINGS.accelerationSeat.cost),
      }),
    );
  }
  if (highStaterooms > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "High staterooms",
        tons: highStaterooms * FITTINGS.highStateroom.tons,
        cost: round3(highStaterooms * FITTINGS.highStateroom.cost),
      }),
    );
  }
  if (luxuryStaterooms > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "Luxury staterooms",
        tons: luxuryStaterooms * FITTINGS.luxuryStateroom.tons,
        cost: round3(luxuryStaterooms * FITTINGS.luxuryStateroom.cost),
      }),
    );
  }
  const barracks = whole(design.barracks);
  if (barracks > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "Barracks",
        tons: barracks * FITTINGS.barracks.tons,
        cost: round3(barracks * FITTINGS.barracks.cost),
      }),
    );
  }
  const brigs = whole(design.brigs);
  if (brigs > 0) {
    lines.push(
      sheetLine("accommodation", {
        name: "Brig",
        tons: brigs * FITTINGS.brig.tons,
        cost: round3(brigs * FITTINGS.brig.cost),
      }),
    );
  }
  if (processors > 0) {
    lines.push(
      sheetLine("system", {
        name: "Fuel processors",
        tons: processors * FITTINGS.processor.tons,
        cost: round2(processors * FITTINGS.processor.cost),
        power: processors,
      }),
    );
  }
  if (design.scoops && (!moduleHull || poweredModule)) {
    lines.push(
      sheetLine("system", {
        name: FITTINGS.scoops.label,
        tons: FITTINGS.scoops.tons,
        cost: streamlined ? 0 : FITTINGS.scoops.cost,
      }),
    );
  }
  for (const space of spaces) {
    const kind = findById(WORK_SPACES, space.kind, WORK_SPACES[0]);
    lines.push(sheetLine(space.kind === "robotics" ? "robotics" : "system", {
      name: countedName(kind.label, space.quantity),
      tons: round2(kind.tons * space.quantity),
      cost: round3(kind.cost * space.quantity),
      ...(kind.power > 0 ? { power: kind.power * space.quantity } : {}),
    }));
    if (space.kind !== "robotics") continue;
    for (
      const [prefix, option] of [
        ["", roboticsAvatarChair(space.avatarChair)],
        ["Fabrication chamber", roboticsFabricator(space.fabrication)],
        ["Drone controller", roboticsDroneController(space.droneController)],
        ["Swarm controller", roboticsSwarmController(space.swarmController)],
      ] as const
    ) {
      if (option.id === "none") continue;
      lines.push(
        sheetLine("roboticsOption", {
          name: roboticsLineName(prefix, option),
          tons: 0,
          cost: round3(option.cost * space.quantity),
          fold: "robotics",
        }),
      );
    }
  }
  for (const amenity of amenities) {
    const kind = findById(AMENITIES, amenity.kind, AMENITIES[0]);
    const power = amenityPower(kind.id, amenity.quantity);
    lines.push(sheetLine("system", {
      name: kind.label,
      tons: amenityTons(kind.id, amenity.quantity),
      cost: amenityCost(kind.id, amenity.quantity),
      ...(power > 0 ? { power } : {}),
    }));
    if ("tl" in kind && kind.tl > techLevel) {
      errors.push(`${kind.label} requires tech level ${kind.tl}.`);
    }
    if ("min" in kind && amenity.quantity < kind.min) {
      errors.push(`${kind.label} is at least ${kind.min} tons.`);
    }
  }
  for (const system of externalSystems) {
    const kind = findById(EXTERNAL_SYSTEMS, system.kind, EXTERNAL_SYSTEMS[0]);
    if (kind.id === "holographic") {
      const power = holographicHullPower(hullTons);
      lines.push(
        sheetLine("system", {
          name: kind.label,
          tons: 0,
          cost: holographicHullCost(hullTons),
          ...(power > 0 ? { power } : {}),
        }),
      );
      continue;
    }
    if (kind.id === "tow") {
      lines.push(
        sheetLine("system", {
          name: kind.label,
          tons: towCableTons(hullTons),
          cost: towCableCost(hullTons),
        }),
      );
      continue;
    }
    if (kind.id === "linkage") {
      const tier = forcedLinkageAt(system.techLevel ?? 0);
      lines.push(
        sheetLine("system", {
          name: `${kind.label} (${tier.label})`,
          tons: kind.tons * system.quantity,
          cost: round3(tier.cost * system.quantity),
        }),
      );
      continue;
    }
    lines.push(
      sheetLine("system", {
        name: kind.label,
        tons: round2(kind.tons * system.quantity),
        cost: round3(kind.cost * system.quantity),
      }),
    );
  }

  return { lines, powerErrors, errors, fittingsPower, staterooms };
}
