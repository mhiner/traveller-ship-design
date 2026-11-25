import type { AdvancedDesign, DesignLine, DesignSheet } from "../../design.ts";
import {
  biospherePassengers,
  DOCK_VEHICLES,
  FITTINGS,
} from "../../catalog/fittings.ts";
import { customLabel } from "../../catalog/drives.ts";
import { deepScanNote } from "../../catalog/sensors.ts";
import {
  MOUNT_KINDS,
  mountWeaponSlots,
  weaponChoices,
} from "../../catalog/weapons.ts";
import { componentNote } from "./shared.tsx";

const DOCKED_VEHICLES = new Set<string>(DOCK_VEHICLES.map((row) => row.label));

export type SheetFold =
  | "software"
  | "hull"
  | "brain"
  | "dock"
  | "turret"
  | "robotics";

export interface SheetFolds {
  softwareOpen: boolean;
  hullOpen: boolean;
  brainOpen: boolean;
  openDocks: ReadonlySet<number>;
  openTurrets: ReadonlySet<number>;
  openRobotics: ReadonlySet<number>;
  heading: boolean;
}

export interface SheetRowModel {
  key: string;
  index: number;
  className?: string;
  label: string;
  note: string;
  fold: SheetFold | null;
  /** Shown on the fold control. Empty when the row does not fold. */
  foldLabel: string;
  tons: number;
  power: number | null;
  cost: number;
}

function sheetLineName(line: { name: string; tons: number }): string {
  if (line.name === "Staterooms") {
    return `Staterooms x${Math.round(line.tons / FITTINGS.stateroom.tons)}`;
  }
  if (line.name === "Low berths") {
    return `Low berths x${Math.round(line.tons / FITTINGS.lowBerth.tons)}`;
  }
  return line.name;
}

function containedInDockingSpace(
  line: { name: string; carried?: boolean },
  lines: readonly { name: string }[],
): boolean {
  const docked = Boolean(line.carried) || DOCKED_VEHICLES.has(line.name);
  return docked &&
    lines.some((row) => row.name === `Docking space (${line.name})`);
}

function dockingCraftLabel(name: string): string | null {
  const match = /^Docking space \((.*)\)$/.exec(name);
  return match?.[1] ?? null;
}

function dockedCraftLines(
  lines: readonly { name: string }[],
): Map<number, number> {
  const childToHead = new Map<number, number>();
  for (let index = 0; index < lines.length - 1; index++) {
    const label = dockingCraftLabel(lines[index].name);
    if (label && lines[index + 1].name === label) {
      childToHead.set(index + 1, index);
    }
  }
  return childToHead;
}

function isFoldedWeaponMount(line: DesignLine): boolean {
  return line.role === "turret" ||
    (line.role === "mount" &&
      (line.name === "Fixed mount" || line.name.startsWith("Fixed mount ")));
}

function turretWeaponLines(lines: readonly DesignLine[]): Map<number, number> {
  const childToHead = new Map<number, number>();
  let head: number | null = null;
  for (let index = 0; index < lines.length; index++) {
    if (isFoldedWeaponMount(lines[index])) {
      head = index;
      continue;
    }
    if (head != null && lines[index].role === "weapon") {
      childToHead.set(index, head);
      continue;
    }
    head = null;
  }
  return childToHead;
}

function weaponSheetNotes(design: AdvancedDesign): string[] {
  const notes: string[] = [];
  for (const mount of design.mounts ?? []) {
    const kind = MOUNT_KINDS.find((row) => row.id === mount.kind);
    const slots = mountWeaponSlots(mount.kind, design.hullTons);
    const fitted = mount.weapons.slice(0, slots);
    if (!kind || (kind.id !== "fixed" && !kind.label.endsWith("turret"))) {
      for (let index = 0; index < fitted.length; index++) {
        notes.push(
          customLabel(
            weaponChoices(fitted[index], mount.kind),
            mount.custom?.[index],
          ),
        );
      }
      continue;
    }
    const groups: { id: string; notes: string[] }[] = [];
    fitted.forEach((weaponId, index) => {
      const note = customLabel(
        weaponChoices(weaponId, mount.kind),
        mount.custom?.[index],
      );
      const group = groups.find((row) => row.id === weaponId);
      if (group) {
        group.notes.push(note);
        return;
      }
      groups.push({ id: weaponId, notes: [note] });
    });
    for (const group of groups) {
      const unique = [...new Set(group.notes)];
      notes.push(unique.length === 1 ? unique[0] : "");
    }
  }
  return notes;
}

function isModularHullLine(line: DesignLine): boolean {
  return line.role === "hullOption" && line.option === "modular";
}

function modularHullModules(
  lines: readonly DesignLine[],
): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  let head: number | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (isModularHullLine(line)) {
      head = index;
      groups.set(index, []);
      continue;
    }
    if (head != null && line.role === "module") {
      groups.get(head)?.push(index);
      continue;
    }
    head = null;
  }
  return groups;
}

function installedModuleLabel(
  lines: readonly { name: string }[],
  indexes: readonly number[],
): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const index of indexes) {
    const name = lines[index].name;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return order.map((name) => {
    const count = counts.get(name) ?? 0;
    return count > 1 ? `${name} x${count}` : name;
  }).join(", ");
}

function hullOptionLineIndexes(lines: readonly DesignLine[]): Set<number> {
  const indexes = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    const role = lines[index].role;
    if (role === "hullOption" || role === "module") indexes.add(index);
  }
  return indexes;
}

function roboticsOptionLines(
  lines: readonly DesignLine[],
): Map<number, number> {
  const childToHead = new Map<number, number>();
  let head: number | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.role === "robotics") {
      head = index;
      continue;
    }
    if (head != null && line.role === "roboticsOption") {
      childToHead.set(index, head);
      continue;
    }
    head = null;
  }
  return childToHead;
}

export function layoutSheet(
  design: AdvancedDesign,
  sheet: DesignSheet,
  folds: SheetFolds,
): SheetRowModel[] {
  const dockedCraft = dockedCraftLines(sheet.lines);
  const turretWeapons = turretWeaponLines(sheet.lines);
  const roboticsOptions = roboticsOptionLines(sheet.lines);
  const roboticsExtras = new Map<number, number>();
  for (const [child, head] of roboticsOptions) {
    roboticsExtras.set(
      head,
      (roboticsExtras.get(head) ?? 0) + sheet.lines[child].cost,
    );
  }
  const armedTurrets = new Set(turretWeapons.values());
  const turretExtras = new Map<number, { cost: number; power: number }>();
  for (const [child, head] of turretWeapons) {
    const extra = turretExtras.get(head) ?? { cost: 0, power: 0 };
    extra.cost += sheet.lines[child].cost;
    extra.power += sheet.lines[child].power ?? 0;
    turretExtras.set(head, extra);
  }
  const brainExtras = sheet.lines.reduce(
    (sum, line) => sum + (line.fold === "brain" ? line.cost : 0),
    0,
  );
  const softwareCost = sheet.lines.reduce(
    (sum, line) => sum + (line.role === "software" ? line.cost : 0),
    0,
  );
  const hullOptions = hullOptionLineIndexes(sheet.lines);
  const hullOptionCost = [...hullOptions].reduce(
    (sum, index) => sum + sheet.lines[index].cost,
    0,
  );
  const modularModules = modularHullModules(sheet.lines);
  const installedModuleLines = new Set([...modularModules.values()].flat());
  const weaponNotes = weaponSheetNotes(design);
  const weaponNotesByIndex = new Map<number, string>();
  let weaponNoteCursor = 0;
  for (let index = 0; index < sheet.lines.length; index++) {
    if (sheet.lines[index].role !== "weapon") continue;
    const note = weaponNotes[weaponNoteCursor++] ?? "";
    if (note) weaponNotesByIndex.set(index, note);
  }
  const rows: SheetRowModel[] = [];
  for (let index = 0; index < sheet.lines.length; index++) {
    const line = sheet.lines[index];
    const software = line.role === "software";
    const brainPart = line.fold === "brain";
    const dockHead = dockedCraft.get(index);
    const dockLabel = dockingCraftLabel(line.name);
    const dock = dockLabel != null &&
      sheet.lines[index + 1]?.name === dockLabel;
    const turretHead = turretWeapons.get(index);
    const turret = isFoldedWeaponMount(line);
    const roboticsHead = roboticsOptions.get(index);
    const robotics = line.role === "robotics";
    const hullOption = hullOptions.has(index);
    const hull = line.role === "hull" && hullOptions.size > 0;
    const fittedModules = modularModules.get(index) ?? [];
    const moduleLabel = installedModuleLabel(sheet.lines, fittedModules);
    if (software && !folds.softwareOpen) continue;
    if (installedModuleLines.has(index)) continue;
    if (hullOption && !folds.hullOpen) continue;
    if (brainPart && !folds.brainOpen) continue;
    if (dockHead != null && !folds.openDocks.has(dockHead)) continue;
    if (turretHead != null && !folds.openTurrets.has(turretHead)) continue;
    if (roboticsHead != null && !folds.openRobotics.has(roboticsHead)) continue;
    if (
      !folds.heading && dockHead == null &&
      containedInDockingSpace(line, sheet.lines)
    ) continue;
    const computer = line.role === "computer";
    const brain = line.head === "brain";
    const weaponNote = weaponNotesByIndex.get(index) ?? "";
    const note = componentNote(design, line) || weaponNote ||
      (line.name === "Deep Penetration Scanners"
        ? deepScanNote(line.tons)
        : "");
    const craft = dock ? sheet.lines[index + 1] : undefined;
    const cost = brain && !folds.brainOpen
      ? line.cost + brainExtras
      : computer && !folds.softwareOpen
      ? line.cost + softwareCost
      : hull && !folds.hullOpen
      ? line.cost + hullOptionCost
      : dock && craft && !folds.openDocks.has(index)
      ? line.cost + craft.cost
      : turret && !folds.openTurrets.has(index)
      ? line.cost + (turretExtras.get(index)?.cost ?? 0)
      : robotics && !folds.openRobotics.has(index)
      ? line.cost + (roboticsExtras.get(index) ?? 0)
      : fittedModules.length > 0
      ? line.cost +
        fittedModules.reduce((sum, child) => sum + sheet.lines[child].cost, 0)
      : line.cost;
    const foldedTurret = turret && !folds.openTurrets.has(index);
    const modulePower = fittedModules.reduce(
      (sum, child) => sum + (sheet.lines[child].power ?? 0),
      0,
    );
    const power = foldedTurret
      ? (line.power ?? 0) + (turretExtras.get(index)?.power ?? 0)
      : fittedModules.some((child) => sheet.lines[child].power != null) ||
          line.power != null
      ? (line.power ?? 0) + modulePower
      : line.power;
    const rowClass = [
      computer ? "sheet-computer" : "",
      hull ? "sheet-hull" : "",
      brain ? "sheet-brain" : "",
      dock ? "sheet-dock" : "",
      turret ? "sheet-turret" : "",
      robotics ? "sheet-robotics" : "",
      software ? "sheet-software-row" : "",
      hullOption ? "sheet-hull-row" : "",
      brainPart ? "sheet-brain-row" : "",
      dockHead != null ? "sheet-dock-row" : "",
      turretHead != null ? "sheet-turret-row" : "",
      roboticsHead != null ? "sheet-robotics-row" : "",
    ].filter(Boolean).join(" ");
    const fold: SheetFold | null = computer
      ? "software"
      : hull
      ? "hull"
      : brain
      ? "brain"
      : dock
      ? "dock"
      : turret
      ? "turret"
      : robotics
      ? "robotics"
      : null;
    const foldLabel = computer
      ? "(software)"
      : hull
      ? "(options)"
      : brain
      ? "(options)"
      : turret
      ? (armedTurrets.has(index) ? "(weapons)" : "(empty)")
      : robotics
      ? "(options)"
      : "";
    rows.push({
      key: `${line.name}-${index}`,
      index,
      className: rowClass || undefined,
      label: `${sheetLineName(line)}${moduleLabel ? ` (${moduleLabel})` : ""}`,
      note,
      fold,
      foldLabel,
      tons: line.tons,
      power: power == null ? null : power,
      cost,
    });
  }
  return rows;
}

export function biosphereNote(
  lines: readonly { name: string; tons: number }[],
): string {
  const tons = lines.find((line) => line.name === "Biosphere")?.tons ?? 0;
  return tons > 0
    ? `Life support covered for ${biospherePassengers(tons)} passengers.`
    : "";
}
