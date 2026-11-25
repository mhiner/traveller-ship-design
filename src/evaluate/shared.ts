import type { DesignLine, LineRole } from "../design.ts";

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roboticsLineName(
  prefix: string,
  option: { label: string },
): string {
  return prefix ? `${prefix} (${option.label})` : option.label;
}

export function countedName(label: string, count: number): string {
  return count > 1 ? `${label} x${count}` : label;
}

export function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function sheetLine(
  role: LineRole,
  line: Omit<DesignLine, "role">,
): DesignLine {
  return { role, ...line };
}

export function findById<T extends { id: string }>(
  rows: readonly T[],
  id: string,
  fallback: T,
): T {
  return rows.find((row) => row.id === id) ?? fallback;
}

export interface ModulePower {
  base: number;
  jump: number;
  maneuver: number;
  weapons: number;
  sensors: number;
  fittings: number;
}

export function emptyModulePower(): ModulePower {
  return { base: 0, jump: 0, maneuver: 0, weapons: 0, sensors: 0, fittings: 0 };
}
