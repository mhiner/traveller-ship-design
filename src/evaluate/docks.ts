import type { AdvancedDesign, DesignLine, DesignSheet } from "../design.ts";
import { resolveCargoGear, resolveDocks, resolveDrones } from "../resolve.ts";
import {
  CARGO_GEAR,
  CARGO_NET_RULE,
  cargoHandlingTons,
  DOCK_VEHICLES,
  DOCKING_COST_PER_TON,
  dockingSpaceTons,
  EMPTY_DOCK_CRAFT,
  DRONE_SET_SIZE,
  DRONES,
  jumpNetTons,
  PLANETARY_JUMP_NET_RULE,
  REPAIR_DRONE_COST_PER_TON,
  repairDroneTons,
} from "../catalog/fittings.ts";
import { plannedJump } from "./drives.ts";
import { findById, round2, round3, sheetLine } from "./shared.ts";

export interface DocksSection {
  lines: DesignLine[];
  errors: string[];
}

export function buildDocks(
  design: AdvancedDesign,
  hullTons: number,
  techLevel: number,
  usable: number,
  priorLines: readonly DesignLine[],
  catalog: readonly AdvancedDesign[],
  stack: readonly string[],
  quoteShip: (ship: AdvancedDesign) => DesignSheet,
): DocksSection {
  const errors: string[] = [];
  const lines: DesignLine[] = [];
  for (const fit of resolveDrones(design.drones)) {
    const kind = findById(DRONES, fit.kind, DRONES[0]);
    if (techLevel < kind.tl) {
      errors.push(`${kind.label} require tech level ${kind.tl}.`);
    }
    if (kind.id === "repair") {
      const tons = repairDroneTons(hullTons);
      lines.push(
        sheetLine("system", {
          name: kind.label,
          tons,
          cost: round3(tons * REPAIR_DRONE_COST_PER_TON),
        }),
      );
      continue;
    }
    const count = fit.quantity * DRONE_SET_SIZE;
    lines.push(sheetLine("system", {
      name: `${kind.label} ×${count}`,
      tons: round2(kind.tons * fit.quantity),
      cost: round3(kind.cost * fit.quantity),
    }));
  }

  for (const dock of resolveDocks(design.docks)) {
    if (dock.craft === EMPTY_DOCK_CRAFT) {
      const craftTons = dock.craftTons ?? 0;
      if (craftTons <= 0) {
        errors.push("An empty docking space needs a craft size.");
        continue;
      }
      const bayTons = dockingSpaceTons(craftTons);
      const shown = Number.isInteger(craftTons)
        ? String(craftTons)
        : String(Math.round(craftTons * 100) / 100);
      lines.push(sheetLine("dock", {
        name: `Docking space (${shown}-ton berth)`,
        tons: bayTons,
        cost: round3(bayTons * DOCKING_COST_PER_TON),
      }));
      continue;
    }
    const vehicle = DOCK_VEHICLES.find((row) => row.id === dock.craft);
    const ship = vehicle
      ? undefined
      : catalog.find((row) => row.id === dock.craft);
    if (!vehicle && !ship) {
      errors.push(`Docked ship “${dock.craft}” is not available.`);
      continue;
    }
    if (ship && (ship.id === design.id || stack.includes(ship.id))) {
      errors.push(`${ship.name} is already part of this design.`);
      continue;
    }
    const label = vehicle?.label ?? ship!.name;
    const stowed = Boolean(dock.stowed) && Boolean(vehicle);
    const craftTons = vehicle?.tons ?? ship!.hullTons;
    const bayTons = dockingSpaceTons(craftTons);
    let craftCost = vehicle ? round3(vehicle.cost) : 0;
    if (ship) {
      const carriedSheet = quoteShip(ship);
      craftCost = carriedSheet.cost;
      for (const error of carriedSheet.errors) {
        if (error.endsWith("is already part of this design.")) {
          errors.push(error);
        }
      }
    }
    if (dock.clamp && ship) {
      lines.push(
        sheetLine("dock", {
          name: `Docking clamp (${label})`,
          tons: 1 + ship.hullTons,
          cost: 0.5,
        }),
      );
      lines.push(
        sheetLine("craft", {
          name: label,
          tons: 0,
          cost: craftCost,
          carried: true,
        }),
      );
      continue;
    }
    if (!stowed) {
      lines.push(
        sheetLine("dock", {
          name: `Docking space (${label})`,
          tons: bayTons,
          cost: round3(bayTons * DOCKING_COST_PER_TON),
        }),
      );
    }
    if (craftCost === 0 && !ship) continue;
    lines.push(
      ship
        ? sheetLine("craft", {
          name: label,
          tons: 0,
          cost: craftCost,
          carried: true,
        })
        : sheetLine("craft", { name: label, tons: 0, cost: craftCost }),
    );
  }

  const cargoGear = resolveCargoGear(design.cargoGear);
  for (const gear of cargoGear) {
    const kind = findById(CARGO_GEAR, gear.kind, CARGO_GEAR[0]);
    if (kind.id !== "belt" && kind.id !== "belt12") continue;
    lines.push(sheetLine("system", {
      name: gear.quantity > 1 ? `${kind.label} ×${gear.quantity}` : kind.label,
      tons: kind.tons,
      cost: round3(kind.cost * gear.quantity),
      power: kind.power * gear.quantity,
    }));
  }
  for (const gear of cargoGear) {
    const kind = findById(CARGO_GEAR, gear.kind, CARGO_GEAR[0]);
    if (kind.id !== "cargoNet" && kind.id !== "cargoScoop") continue;
    lines.push(
      sheetLine("system", {
        name: kind.label,
        tons: kind.tons,
        cost: kind.cost,
      }),
    );
  }
  const wantsCrane = cargoGear.some((gear) => gear.kind === "crane");
  const nets = cargoGear.filter((gear) =>
    gear.kind === "jumpNet" || gear.kind === "planetaryNet"
  );
  const external = cargoGear.find((gear) => gear.kind === "external");
  const netTons = round2(
    nets.reduce((total, gear) => total + jumpNetTons(gear.quantity), 0),
  );
  if (wantsCrane || nets.length > 0) {
    const soFar = [...priorLines, ...lines];
    const fitted = round2(
      soFar.reduce((total, line) => total + (line.carried ? 0 : line.tons), 0) -
        hullTons,
    );
    const sized = cargoHandlingTons(
      round2(usable - fitted),
      wantsCrane,
      netTons,
    );
    if (wantsCrane) {
      lines.push(
        sheetLine("system", {
          name: "Cargo crane",
          tons: sized.craneTons,
          cost: round2(sized.craneTons),
        }),
      );
    }
    for (const gear of nets) {
      const kind = findById(CARGO_GEAR, gear.kind, CARGO_GEAR[0]);
      const tons = jumpNetTons(gear.quantity);
      lines.push(
        sheetLine("system", {
          name: kind.label,
          tons,
          cost: round3(tons * kind.cost),
        }),
      );
    }
  }
  if (
    nets.some((gear) => gear.kind === "planetaryNet") &&
    plannedJump(design, hullTons, design.hullType === "module") > 0
  ) {
    errors.push(PLANETARY_JUMP_NET_RULE);
  }
  if (
    cargoGear.some((gear) => gear.kind === "cargoNet") &&
    plannedJump(design, hullTons, design.hullType === "module") > 0
  ) {
    errors.push(CARGO_NET_RULE);
  }
  if (external) {
    lines.push(
      sheetLine("system", {
        name: "External cargo mount",
        tons: 0,
        cost: round3(external.quantity * 0.001),
      }),
    );
  }

  return { lines, errors };
}
