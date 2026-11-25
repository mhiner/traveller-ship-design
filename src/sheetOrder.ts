import type { DesignLine } from "./design.ts";
import {
  AMENITIES,
  DRONES,
  EXTERNAL_SYSTEMS,
  WORK_SPACES,
} from "./catalog/fittings.ts";

/** Sheet order. Anything not named here stays after the rest, in the order it was created. */
const HULL = 0;
const HULL_OPTION = 1;
const ARMOUR = 2;
const MANOEUVRE = 3;
const JUMP = 4;
const PLANT = 5;
const FUEL = 6;
const CONTAINER = 7;
const PROCESSOR = 8;
const BRIDGE = 9;
const SENSORS = 10;
const SENSOR_EXTRA = 11;
const COMPUTER = 12;
const SOFTWARE = 13;
const BRAIN = 14;
const WEAPONS = 15;
const ACCOMMODATION = 16;
const COMMON_FITTING = 17;
const WORK_SPACE = 18;
const EXTERNAL = 19;
const DOCK = 20;
const DRONE = 21;
const REMAINING = 22;

const AMENITY_LABELS = AMENITIES.map((row) => row.label);
const WORK_LABELS = WORK_SPACES.map((row) => row.label);
const EXTERNAL_LABELS = EXTERNAL_SYSTEMS.map((row) => row.label);
const DRONE_LABELS = DRONES.map((row) => row.label);

function matchesLabel(name: string, labels: readonly string[]): boolean {
  return labels.some((label) =>
    name === label || name.startsWith(`${label} ×`) ||
    name.startsWith(`${label} x`) || name.startsWith(`${label} (`)
  );
}

function dockedName(name: string): string | null {
  const space = /^Docking space \((.*)\)$/.exec(name);
  if (space) return space[1];
  const clamp = /^Docking clamp \((.*)\)$/.exec(name);
  return clamp?.[1] ?? null;
}

function sheetRank(line: DesignLine): number {
  if (line.role === "hull") return HULL;
  if (line.role === "hullOption" || line.role === "module") return HULL_OPTION;
  if (line.role === "armour") return ARMOUR;
  if (line.role === "manoeuvre") return MANOEUVRE;
  if (line.role === "jump") return JUMP;
  if (line.role === "plant") return PLANT;
  if (line.role === "fuel") {
    if (line.name === "Fuel tank") return FUEL;
    if (line.name.startsWith("Fuel/cargo container")) return CONTAINER;
    return REMAINING;
  }
  if (
    line.name === "Fuel processors" || line.name.startsWith("Fuel processor")
  ) return PROCESSOR;
  if (line.role === "bridge") return BRIDGE;
  if (line.role === "sensors") return SENSORS;
  if (line.role === "sensorExtra") return SENSOR_EXTRA;
  if (line.role === "computer") return COMPUTER;
  if (line.role === "software") return SOFTWARE;
  if (line.role === "brain") return BRAIN;
  if (
    line.role === "turret" || line.role === "mount" || line.role === "weapon"
  ) return WEAPONS;
  if (line.role === "accommodation" || line.role === "common") {
    return ACCOMMODATION;
  }
  if (line.role === "robotics" || line.role === "roboticsOption") {
    return WORK_SPACE;
  }
  if (matchesLabel(line.name, AMENITY_LABELS)) return COMMON_FITTING;
  if (matchesLabel(line.name, WORK_LABELS)) return WORK_SPACE;
  if (matchesLabel(line.name, EXTERNAL_LABELS)) return EXTERNAL;
  if (line.role === "dock" || line.role === "craft") return DOCK;
  if (matchesLabel(line.name, DRONE_LABELS)) return DRONE;
  return REMAINING;
}

function staysWith(
  head: DesignLine,
  previous: DesignLine,
  next: DesignLine,
): boolean {
  if (
    head.role === "hullOption" && head.option === "modular" &&
    (previous.role === "hullOption" || previous.role === "module") &&
    next.role === "module"
  ) return true;
  if (
    (head.role === "turret" || head.role === "mount") &&
    (previous.role === head.role || previous.role === "weapon") &&
    next.role === "weapon"
  ) return true;
  if (
    head.role === "robotics" &&
    (previous.role === "robotics" || previous.role === "roboticsOption") &&
    next.role === "roboticsOption"
  ) return true;
  if (head.role === "dock" && previous === head && next.role === "craft") {
    const label = dockedName(head.name);
    return label != null && next.name === label;
  }
  return false;
}

/** Puts sheet lines in component order. A folded child stays with the line it follows. */
export function orderSheetLines(lines: readonly DesignLine[]): DesignLine[] {
  const groups: DesignLine[][] = [];
  for (let index = 0; index < lines.length; index++) {
    const head = lines[index];
    const group = [head];
    while (
      index + 1 < lines.length &&
      staysWith(head, group[group.length - 1], lines[index + 1])
    ) {
      index += 1;
      group.push(lines[index]);
    }
    groups.push(group);
  }
  return groups
    .map((group, index) => ({ group, index, rank: sheetRank(group[0]) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .flatMap((entry) => entry.group);
}
