import { DOCK_VEHICLES, EMPTY_DOCK_CRAFT, EXTERNAL_SYSTEMS } from "../../src/catalog/fittings.ts";
import type { AdvancedDesign, Dock } from "../../src/design.ts";
import { resolveDocks, resolveExternalSystems } from "../../src/resolve.ts";

/** Fixed empty berths. Their tonnage is the largest craft the bay accepts. */
const BERTHS = new Set(["berth-15", "berth-30"]);

/** One docking space from a design. A ship bay can take an actor, and a vehicle bay is a fixed craft. */
export interface DesignBay {
  id: string;
  kind: "ship" | "vehicle";
  name: string;
  /** Supported craft size, in tons. A Type V clamp has no upper limit. */
  tons: number;
  /** Smallest craft this dock accepts. Berths accept anything up to tons. */
  minTons?: number;
  /** A ship actor can be dropped here. */
  acceptsShip: boolean;
  /** A vehicle actor can be dropped here. The tons are the vehicle this bay was drawn for. */
  acceptsVehicle?: boolean;
  /** An external docking clamp. A ship here is outside the hull. */
  clamp?: boolean;
}

/** A hull carried aboard, evaluated with its own catalog when one is set. */
export interface CarriedHull {
  id: string;
  design: AdvancedDesign;
  quantity: number;
  catalog?: readonly AdvancedDesign[];
}

/** A ship actor waiting for a bay, with the tons it occupies. */
export interface HeldShip {
  actorId: string;
  quantity: number;
  tons: number;
}

/** A bay after placement. actorId is empty while the bay is still open. */
export interface OccupiedBay {
  id: string;
  name: string;
  tons: number;
  actorId: string | null;
}

/** Copies that found no open bay. */
export interface UnplacedShip {
  actorId: string;
  quantity: number;
}

interface EmbeddedCraft {
  id: string;
  name?: string;
  hullTons?: number;
}

/** id, name, and hull tons taken from an embedded craft object. */
function craftRecord(craft: unknown): EmbeddedCraft | null {
  if (!craft || typeof craft !== "object") return null;
  const row = craft as { id?: unknown; name?: unknown; hullTons?: unknown };
  return {
    id: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : undefined,
    hullTons: typeof row.hullTons === "number" ? row.hullTons : undefined
  };
}

/** Whole tons print as integers. Fractional tons print to the hundredth. */
function tonLabel(tons: number): string {
  return Number.isInteger(tons)
    ? String(tons)
    : String(Math.round(tons * 100) / 100);
}

/** Docking spaces from a design, split between ship bays and vehicle bays. */
export function projectBays(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = []
): DesignBay[] {
  const embedded = new Map<string, EmbeddedCraft>();
  const loose: Dock[] = [];
  for (const dock of design.docks ?? []) {
    const record = craftRecord(dock.craft);
    const craft = typeof dock.craft === "string" ? dock.craft : record?.id ?? "";
    // A dock with no craft id contributes no bay.
    if (!craft) continue;
    const id = dock.id || `dock-${loose.length + 1}`;
    loose.push({ ...dock, id, craft });
    if (record) embedded.set(id, record);
  }

  const bays: DesignBay[] = [];
  for (const dock of resolveDocks(loose)) {
    if (dock.craft === EMPTY_DOCK_CRAFT) {
      const tons = dock.craftTons ?? 0;
      // A reserved berth uses the tons it was sized for.
      if (tons <= 0) continue;
      bays.push({
        id: dock.id,
        kind: "ship",
        name: `${tonLabel(tons)}-ton berth`,
        tons,
        acceptsShip: true
      });
      continue;
    }
    const vehicle = DOCK_VEHICLES.find((row) => row.id === dock.craft);
    // A vehicle stowed as cargo takes no bay.
    if (vehicle && dock.stowed) continue;
    // Fixed 15- and 30-ton berths accept a ship.
    if (vehicle && BERTHS.has(vehicle.id)) {
      bays.push({
        id: dock.id,
        kind: "ship",
        name: vehicle.label,
        tons: vehicle.tons,
        acceptsShip: true
      });
      continue;
    }
    // A catalog vehicle opens an empty bay of that vehicle's tonnage.
    if (vehicle) {
      bays.push({
        id: dock.id,
        kind: "vehicle",
        name: `${tonLabel(vehicle.tons)}-ton vehicle bay`,
        tons: vehicle.tons,
        acceptsShip: false,
        acceptsVehicle: true
      });
      continue;
    }
    // A catalog design or an embedded hull already fills this dock.
    const ship = catalog.find((row) => row.id === dock.craft);
    const fallback = embedded.get(dock.id);
    const name = ship?.name.trim() || fallback?.name?.trim() || "Docked ship";
    bays.push({
      id: dock.id,
      kind: "ship",
      name,
      tons: ship?.hullTons ?? fallback?.hullTons ?? 0,
      acceptsShip: false
    });
  }
  bays.push(...clampBays(design));
  return bays;
}

/** The ship's docks, plus docks on installed modules and joined breakaway hulls. */
export function projectCarriedBays(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = [],
  carried: readonly CarriedHull[] = []
): DesignBay[] {
  const bays = projectBays(design, catalog);
  for (const hull of carried) {
    const quantity = Math.max(0, Math.round(hull.quantity));
    if (quantity < 1) continue;
    const sourceCatalog = hull.catalog ?? catalog;
    for (let copy = 0; copy < quantity; copy += 1) {
      for (const bay of projectBays(hull.design, sourceCatalog)) {
        // Prefix the copy so bays from several hulls keep distinct ids.
        bays.push({ ...bay, id: `${hull.id}:${copy}:${bay.id}` });
      }
    }
  }
  return bays;
}

/** The craft sizes a docking clamp accepts, read from the catalog range. */
function clampSpan(holds: string): { min: number; max: number } | null {
  const text = holds.replace(/,/g, "");
  const range = /^(\d+)[–-](\d+)$/.exec(text);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const open = /^(\d+) or more$/.exec(text);
  if (open) return { min: Number(open[1]), max: Number.POSITIVE_INFINITY };
  return null;
}

/** One bay per clamp. The catalog range is the craft size that clamp accepts. */
function clampBays(design: AdvancedDesign): DesignBay[] {
  const bays: DesignBay[] = [];
  for (const system of resolveExternalSystems(design.externalSystems)) {
    const kind = EXTERNAL_SYSTEMS.find((row) => row.id === system.kind);
    if (!kind || !("holds" in kind)) continue;
    const span = clampSpan(kind.holds);
    if (!span) continue;
    // Each fitting yields at least one clamp.
    const count = Math.max(1, Math.round(system.quantity));
    for (let index = 0; index < count; index += 1) {
      bays.push({
        id: `clamp:${kind.id}:${system.id}:${index}`,
        kind: "ship",
        name: kind.label,
        tons: span.max,
        minTons: span.min,
        acceptsShip: true,
        clamp: true
      });
    }
  }
  return bays;
}

/** Put the largest docked ships into the smallest open bay each one fits. */
export function occupyShipBays(
  bays: readonly { id: string; name: string; tons: number; minTons?: number }[],
  held: readonly HeldShip[]
): { bays: OccupiedBay[]; unplaced: UnplacedShip[] } {
  const slots: OccupiedBay[] = bays.map((bay) => ({
    id: bay.id,
    name: bay.name,
    tons: bay.tons,
    actorId: null
  }));
  const pending: { actorId: string; tons: number }[] = [];
  for (const ship of [...held].sort((a, b) => a.actorId.localeCompare(b.actorId))) {
    const quantity = Math.max(0, Math.round(ship.quantity));
    for (let count = 0; count < quantity; count += 1) {
      pending.push({ actorId: ship.actorId, tons: ship.tons });
    }
  }
  // Largest ships are placed first.
  pending.sort((a, b) => b.tons - a.tons);
  const unplaced = new Map<string, number>();
  for (const ship of pending) {
    let chosen = -1;
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const bay = bays[index];
      const min = bay.minTons ?? 0;
      if (slot.actorId || ship.tons < min || slot.tons < ship.tons) continue;
      // Among bays that fit, the smallest bay is used.
      if (chosen < 0 || slot.tons < slots[chosen].tons) chosen = index;
    }
    if (chosen < 0) {
      unplaced.set(ship.actorId, (unplaced.get(ship.actorId) ?? 0) + 1);
    } else {
      slots[chosen].actorId = ship.actorId;
    }
  }
  return {
    bays: slots,
    unplaced: [...unplaced].map(([actorId, quantity]) => ({ actorId, quantity }))
  };
}

/** Whether one more copy of a ship fits a bay that is still open. */
export function dockShipResult(
  bays: readonly { id: string; tons: number; minTons?: number }[],
  held: readonly HeldShip[],
  _actorId: string,
  tons: number
): "ok" | "empty" | "large" | "small" | "range" | "full" {
  if (!bays.length) return "empty";
  /** True when the ship tons fall inside the bay's minimum and maximum. */
  const fits = (bay: { tons: number; minTons?: number }) =>
    tons > 0 && tons >= (bay.minTons ?? 0) && tons <= bay.tons;
  if (!bays.some(fits)) {
    // Larger than every bay.
    if (bays.every((bay) => tons > bay.tons)) return "large";
    // Smaller than every bay's minimum.
    if (bays.every((bay) => tons < (bay.minTons ?? 0))) return "small";
    // No single bay's span covers this tonnage.
    return "range";
  }
  const placed = occupyShipBays(
    bays.map((bay) => ({ ...bay, name: bay.id })),
    held
  );
  const used = new Set(
    placed.bays.filter((bay) => bay.actorId).map((bay) => bay.id)
  );
  return bays.some((bay) => !used.has(bay.id) && fits(bay)) ? "ok" : "full";
}

/** Tons of ships sitting on docking clamps. Ships in a berth stay inside the hull. */
export function clampedTonnage(
  bays: readonly DesignBay[],
  held: readonly HeldShip[]
): number {
  const open = bays.filter((bay) => bay.kind === "ship" && bay.acceptsShip);
  const placed = occupyShipBays(open, held);
  const tonsOf = new Map(held.map((ship) => [ship.actorId, ship.tons]));
  let total = 0;
  for (const slot of placed.bays) {
    if (!slot.actorId) continue;
    const bay = open.find((row) => row.id === slot.id);
    if (!bay?.clamp) continue;
    total += tonsOf.get(slot.actorId) ?? 0;
  }
  return Math.round(total * 1000) / 1000;
}
