import type { AdvancedDesign, DesignLine, DesignSheet } from "../design.ts";
import { resolveHullOptions } from "../resolve.ts";
import {
  ARMOUR,
  armourSizeMultiplier,
  CONFIGURATIONS,
  configuredHullCost,
  HULL_OPTIONS,
  HULL_TYPES,
  type HullOption,
  hullOptionCost,
  hullOptionTons,
  moduleFitsBay,
  modularHullMaxTons,
  MODULE_COST_PER_TON,
  PRESSURE_HULL_ARMOUR,
  solarCoatingQuote,
} from "../catalog/hull.ts";
import { BASE_POWER_PER_TON } from "../catalog/drives.ts";
import {
  emptyModulePower,
  findById,
  type ModulePower,
  round2,
  round3,
  sheetLine,
} from "./shared.ts";

export interface HullFacts {
  hullTons: number;
  hullCostValue: number;
  configuration: (typeof CONFIGURATIONS)[number];
  hullType: (typeof HULL_TYPES)[number];
  moduleHull: boolean;
  armour: (typeof ARMOUR)[number];
  techLevel: number;
  rating: number;
}

export interface HullSection {
  lines: DesignLine[];
  errors: string[];
  basePower: number;
  hullOptionPower: number;
  modulePower: ModulePower;
  builtInArmour: number;
  hullOptions: HullOption[];
  pressureArmour: number;
}

export function buildHull(
  design: AdvancedDesign,
  facts: HullFacts,
  catalog: readonly AdvancedDesign[],
  stack: readonly string[],
  quoteModule: (fitted: AdvancedDesign) => DesignSheet,
): HullSection {
  const errors: string[] = [];
  const lines: DesignLine[] = [];
  const {
    hullTons,
    hullCostValue,
    configuration,
    hullType,
    moduleHull,
    armour,
    techLevel,
    rating,
  } = facts;
  const basePower = moduleHull ? 0 : Math.round(hullTons * BASE_POWER_PER_TON);
  const configuredCost = moduleHull
    ? round3(round3(hullTons * MODULE_COST_PER_TON) * configuration.cost)
    : configuration.pricePerTon == null
    ? round2(hullCostValue * configuration.cost)
    : round2(hullTons * configuration.pricePerTon);
  lines.push(sheetLine("hull", {
    name: hullType.id === "standard"
      ? `${configuration.label} hull`
      : `${hullType.label}, ${configuration.label} hull`,
    tons: hullTons,
    cost: moduleHull
      ? round3(configuredCost * hullType.cost)
      : round2(configuredCost * hullType.cost),
    power: basePower,
  }));

  const builtInArmour = moduleHull ? 0 : configuration.armourBonus;
  const hullOptions = moduleHull ? [] : resolveHullOptions(design.hullOptions);
  const modulePower = emptyModulePower();
  const stealth = hullOptions.filter((option) =>
    HULL_OPTIONS.find((row) => row.id === option.kind)?.group === "stealth"
  );
  const solar = hullOptions.filter((option) =>
    HULL_OPTIONS.find((row) => row.id === option.kind)?.group === "solar"
  );
  if (stealth.length > 1) {
    errors.push("A ship can have only one stealth option.");
  }
  if (
    hullOptions.some((option) => option.kind === "reflec") && stealth.length > 0
  ) errors.push("Reflec cannot be combined with stealth.");
  if (solar.length > 1) errors.push("A ship can have only one solar coating.");
  if (
    hullOptions.filter((option) =>
      HULL_OPTIONS.find((row) => row.id === option.kind)?.group === "adjustable"
    ).length > 1
  ) {
    errors.push("A ship can have only one adjustable hull.");
  }
  if (
    solar.length > 0 &&
    hullOptions.some((option) =>
      option.kind !== "radiation" && !solar.includes(option)
    )
  ) {
    errors.push("Solar coating can be combined only with radiation shielding.");
  }
  let hullOptionPower = 0;
  let modularRoom = modularHullMaxTons(hullTons);
  const modularAsked = hullOptions.reduce(
    (total, option) =>
      option.kind === "modular" ? total + (option.tons ?? 0) : total,
    0,
  );
  if (modularAsked > modularRoom) {
    errors.push(
      `A modular hull cannot exceed 75% of the hull (${modularRoom} tons).`,
    );
  }
  for (const option of hullOptions) {
    const kind = findById(HULL_OPTIONS, option.kind, HULL_OPTIONS[0]);
    if (kind.tl > 0 && techLevel < kind.tl) {
      errors.push(`${kind.label} requires tech level ${kind.tl}.`);
    }
    if (kind.id === "modular") {
      const requested = option.tons ?? 0;
      const tons = Math.min(requested, modularRoom);
      modularRoom = Math.round((modularRoom - tons) * 100) / 100;
      lines.push(
        sheetLine("hullOption", {
          name: kind.label,
          tons,
          cost: configuredHullCost(tons, configuration.id, hullType.id),
          option: kind.id,
        }),
      );
      const named = option.modules ?? [];
      if (named.length > 1) errors.push("A module bay holds one module.");
      const id = named[0];
      if (id) {
        const fitted = catalog.find((row) => row.id === id);
        if (!fitted || fitted.hullType !== "module") {
          errors.push("That module is no longer available.");
        } else if (fitted.id === design.id || stack.includes(fitted.id)) {
          errors.push(`${fitted.name} is already part of this design.`);
        } else {
          if (fitted.techLevel > techLevel) {
            errors.push(
              `${fitted.name} requires tech level ${fitted.techLevel}.`,
            );
          }
          if (!moduleFitsBay(fitted.hullTons, tons)) {
            errors.push(
              `${fitted.name} is ${fitted.hullTons} tons and this module bay is ${tons} tons.`,
            );
          }
          const moduleSheet = quoteModule(fitted);
          modulePower.base += moduleSheet.powerUse.base;
          modulePower.jump += moduleSheet.powerUse.jump;
          modulePower.maneuver += moduleSheet.powerUse.maneuver;
          modulePower.weapons += moduleSheet.powerUse.weapons;
          modulePower.sensors += moduleSheet.powerUse.sensors;
          modulePower.fittings += moduleSheet.powerUse.fittings;
          lines.push(
            sheetLine("module", {
              name: fitted.name,
              tons: fitted.hullTons,
              cost: moduleSheet.cost,
              power: moduleSheet.powerUse.total,
              carried: true,
              fold: "hull",
            }),
          );
        }
      }
      continue;
    }
    if (kind.id === "pressure") {
      lines.push(sheetLine("hullOption", {
        name: kind.label,
        tons: hullOptionTons(kind.id, hullTons),
        cost: round2(
          configuredHullCost(hullTons, configuration.id, hullType.id) * 10,
        ),
        option: kind.id,
      }));
      continue;
    }
    if (kind.group === "adjustable") {
      const share = kind.id === "adjustable15" ? 1 : 0.1;
      lines.push(sheetLine("hullOption", {
        name: kind.label,
        tons: hullOptionTons(kind.id, hullTons),
        cost: round2(hullCostValue * share),
        option: kind.id,
      }));
      continue;
    }
    if (kind.id === "grav") {
      const tons = hullOptionTons(kind.id, hullTons);
      const power = round2(tons * 2);
      hullOptionPower += power;
      lines.push(
        sheetLine("hullOption", {
          name: kind.label,
          tons,
          cost: hullOptionCost(kind.id, hullTons),
          option: kind.id,
          ...(power > 0 ? { power } : {}),
        }),
      );
      continue;
    }
    if (kind.group === "solar") {
      const quoted = solarCoatingQuote(
        kind.id,
        hullTons,
        option.units ?? 0,
        configuration.id,
      );
      if ((option.units ?? 0) > quoted.max) {
        errors.push(
          `Solar coating covers at most 40% of the hull (${quoted.max} units).`,
        );
      }
      if (configuration.id === "streamlined") {
        errors.push("Solar coating cannot be applied to a streamlined hull.");
      }
      lines.push(
        sheetLine("hullOption", {
          name: countedSolar(kind.label, quoted.units),
          tons: 0,
          cost: quoted.cost,
          option: kind.id,
          ...(quoted.power > 0 ? { power: quoted.power } : {}),
        }),
      );
      continue;
    }
    lines.push(
      sheetLine("hullOption", {
        name: kind.label,
        tons: hullOptionTons(kind.id, hullTons),
        cost: hullOptionCost(kind.id, hullTons),
        option: kind.id,
      }),
    );
  }

  if (rating > 0) {
    const armourTons = round2(
      hullTons * armour.tonsPerPoint * armourSizeMultiplier(hullTons) *
        configuration.armourVolume * rating,
    );
    lines.push(sheetLine("armour", {
      name: `${armour.label} ${rating}`,
      tons: armourTons,
      cost: round2(armourTons * armour.costPerTon),
    }));
    if (techLevel < armour.tl) {
      errors.push(`${armour.label} requires tech level ${armour.tl}.`);
    }
  }

  return {
    lines,
    errors,
    basePower,
    hullOptionPower,
    modulePower,
    builtInArmour,
    hullOptions,
    pressureArmour: hullOptions.some((option) => option.kind === "pressure")
      ? PRESSURE_HULL_ARMOUR
      : 0,
  };
}

function countedSolar(label: string, count: number): string {
  return count > 1 ? `${label} x${count}` : label;
}
