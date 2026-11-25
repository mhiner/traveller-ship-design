import {
  ADDITIONAL_SENSORS,
  type AdditionalSensor,
} from "./catalog/sensors.ts";
import {
  AMENITIES,
  type Amenity,
  CARGO_GEAR,
  type CargoGear,
  type DroneFit,
  DRONES,
  EMPTY_DOCK_CRAFT,
  EXTERNAL_SYSTEMS,
  type ExternalSystem,
  forcedLinkageAt,
  roboticsAvatarChair,
  roboticsDroneController,
  roboticsFabricator,
  roboticsSwarmController,
  WORK_SPACES,
  type WorkSpace,
} from "./catalog/fittings.ts";
import { HULL_OPTIONS, type HullOption } from "./catalog/hull.ts";
import type { Dock } from "./design.ts";

function moduleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function hullOptionId(
  ids: Set<string>,
  kind: string,
  requested: string | undefined,
): string {
  let id = requested?.trim() ? requested : "";
  if (!id || ids.has(id)) {
    let count = 1;
    id = `${kind}-${count}`;
    while (ids.has(id)) {
      count += 1;
      id = `${kind}-${count}`;
    }
  }
  ids.add(id);
  return id;
}

/** One of each hull option, except modular hulls. Solar units are truncated. Modular tons are rounded to two decimals. */
export function resolveHullOptions(
  installed: HullOption[] | undefined,
): HullOption[] {
  const seen = new Set<string>();
  const ids = new Set<string>();
  const resolved: HullOption[] = [];
  for (const option of installed ?? []) {
    const kind = HULL_OPTIONS.find((row) => row.id === option.kind);
    if (!kind || (kind.id !== "modular" && seen.has(kind.id))) continue;
    if (kind.id !== "modular") seen.add(kind.id);
    const id = hullOptionId(ids, kind.id, option.id);
    if (kind.group === "solar") {
      const requested = Number.isFinite(option.units)
        ? Math.max(0, Math.trunc(option.units ?? 0))
        : 0;
      resolved.push({ id, kind: kind.id, units: requested });
      continue;
    }
    if (kind.id !== "modular") {
      resolved.push({ id, kind: kind.id });
      continue;
    }
    const requested = Number.isFinite(option.tons)
      ? Math.max(0, option.tons ?? 0)
      : 0;
    resolved.push({
      id,
      kind: kind.id,
      tons: Math.round(requested * 100) / 100,
      modules: moduleIds(option.modules),
    });
  }
  return resolved;
}

export function resolveExternalSystems(
  installed: ExternalSystem[] | undefined,
): ExternalSystem[] {
  const seen = new Set<string>();
  const resolved: ExternalSystem[] = [];
  for (const system of installed ?? []) {
    const kind = EXTERNAL_SYSTEMS.find((row) => row.id === system.kind);
    if (!kind || seen.has(kind.id)) continue;
    seen.add(kind.id);
    const quantity = kind.counted && Number.isFinite(system.quantity)
      ? Math.max(1, Math.round(system.quantity))
      : 1;
    resolved.push({
      id: system.id || `${kind.id}-1`,
      kind: kind.id,
      quantity,
      ...(kind.id === "linkage"
        ? { techLevel: forcedLinkageAt(system.techLevel ?? 0).tl }
        : {}),
    });
  }
  return resolved;
}

export function resolveAmenities(installed: Amenity[] | undefined): Amenity[] {
  const seen = new Set<string>();
  const resolved: Amenity[] = [];
  for (const amenity of installed ?? []) {
    if (
      !AMENITIES.some((row) => row.id === amenity.kind) ||
      seen.has(amenity.kind)
    ) continue;
    seen.add(amenity.kind);
    const quantity = Number.isFinite(amenity.quantity)
      ? Math.max(0, Math.round(amenity.quantity))
      : 0;
    if (quantity > 0) {
      resolved.push({
        id: amenity.id || `${amenity.kind}-1`,
        kind: amenity.kind,
        quantity,
      });
    }
  }
  return resolved;
}

export function resolveWorkSpaces(
  spaces: WorkSpace[] | undefined,
): WorkSpace[] {
  const seen = new Set<string>();
  const resolved: WorkSpace[] = [];
  for (const space of spaces ?? []) {
    if (
      !WORK_SPACES.some((row) => row.id === space.kind) || seen.has(space.kind)
    ) continue;
    seen.add(space.kind);
    const quantity = Number.isFinite(space.quantity)
      ? Math.max(0, Math.round(space.quantity))
      : 0;
    if (quantity <= 0) continue;
    resolved.push(
      space.kind === "robotics"
        ? {
          id: space.id,
          kind: space.kind,
          quantity,
          avatarChair: roboticsAvatarChair(space.avatarChair).id,
          fabrication: roboticsFabricator(space.fabrication).id,
          droneController: roboticsDroneController(space.droneController).id,
          swarmController: roboticsSwarmController(space.swarmController).id,
        }
        : { id: space.id, kind: space.kind, quantity },
    );
  }
  return resolved;
}

export function resolveAdditionalSensors(
  installed: AdditionalSensor[] | undefined,
): AdditionalSensor[] {
  const seen = new Set<string>();
  const resolved: AdditionalSensor[] = [];
  for (const sensor of installed ?? []) {
    const kind = ADDITIONAL_SENSORS.find((row) => row.id === sensor.kind);
    if (!kind || seen.has(kind.id)) continue;
    seen.add(kind.id);
    const tons = kind.id === "deep"
      ? Math.max(1, Math.round(Number.isFinite(sensor.tons) ? sensor.tons : 1))
      : kind.tons;
    resolved.push({ id: sensor.id || `${kind.id}-1`, kind: kind.id, tons });
  }
  return resolved;
}

export function resolveCargoGear(
  installed: CargoGear[] | undefined,
): CargoGear[] {
  const seen = new Set<string>();
  const resolved: CargoGear[] = [];
  for (const gear of installed ?? []) {
    if (
      !CARGO_GEAR.some((row) => row.id === gear.kind) || seen.has(gear.kind)
    ) continue;
    seen.add(gear.kind);
    const quantity = Number.isFinite(gear.quantity)
      ? Math.max(1, Math.round(gear.quantity))
      : 1;
    resolved.push({
      id: gear.id || `${gear.kind}-1`,
      kind: gear.kind,
      quantity,
    });
  }
  return resolved;
}

export function resolveDrones(installed: DroneFit[] | undefined): DroneFit[] {
  const seen = new Set<string>();
  const resolved: DroneFit[] = [];
  for (const fit of installed ?? []) {
    if (!DRONES.some((row) => row.id === fit.kind) || seen.has(fit.kind)) {
      continue;
    }
    seen.add(fit.kind);
    const quantity = Number.isFinite(fit.quantity)
      ? Math.max(0, Math.round(fit.quantity))
      : 0;
    if (fit.kind !== "repair" && quantity <= 0) continue;
    resolved.push({
      id: fit.id || `${fit.kind}-1`,
      kind: fit.kind,
      quantity: Math.max(1, quantity),
    });
  }
  return resolved;
}

export function resolveDocks(docks: Dock[] | undefined): Dock[] {
  const seen = new Set<string>();
  const resolved: Dock[] = [];
  for (const dock of docks ?? []) {
    if (!dock || typeof dock.craft !== "string" || dock.craft.length === 0) {
      continue;
    }
    const id = dock.id || `dock-${resolved.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const craftTons = Number.isFinite(dock.craftTons)
      ? Math.max(0, dock.craftTons ?? 0)
      : 0;
    resolved.push({
      id,
      craft: dock.craft,
      ...(dock.craft === EMPTY_DOCK_CRAFT && craftTons > 0
        ? { craftTons }
        : {}),
      ...(dock.stowed ? { stowed: true } : {}),
      ...(dock.clamp ? { clamp: true } : {}),
    });
  }
  return resolved;
}
