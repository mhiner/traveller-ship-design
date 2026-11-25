import {
  SHIP_CLASSIFICATIONS,
  type ShipClassification,
} from "./classification.ts";
import { type AdvancedDesign, evaluateDesign } from "./design.ts";
import { containerCapacities } from "./evaluate/drives.ts";
import { JUMP_MIN_HULL_TONS } from "./tables.ts";

/** Hull figures a host can copy onto its own ship record. */
export interface DesignShipStats {
  designType: string;
  classification: ShipClassification;
  hullTons: number;
  /** Dedicated cargo tons, before external cargo and hybrid space. */
  cargoTons: number;
  /** Tons that can be filled with cargo or fuel. */
  hybridCargoFuel: number;
  /** Cargo carried outside the hull. */
  externalCargoTons: number;
  jumpRating: number;
  staterooms: number;
  /** Staterooms with bunks. Each holds two crew or one passenger. */
  doubleStaterooms: number;
  lowBerths: number;
  /** Dedicated fuel tank, before hybrid space. */
  fuelCapacity: number;
  cashPrice: number;
  armed: boolean;
}

function whole(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

/** Loading-belt counts and cargo capacities are at least one once the fitting is present. */
function gearQuantity(
  design: AdvancedDesign,
  kind: "jumpNet" | "planetaryNet" | "external",
): number {
  const gear = (design.cargoGear ?? []).find((row) => row.kind === kind);
  if (!gear) return 0;
  return Number.isFinite(gear.quantity)
    ? Math.max(1, Math.round(gear.quantity))
    : 1;
}

/** Copy an advanced design into the hull figures stored on a ship. */
export function shipDesignFromAdvanced(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = [],
): DesignShipStats {
  const sheet = evaluateDesign(design, catalog);
  const containerTons = containerCapacities(design).reduce(
    (total, tons) => total + tons,
    0,
  );
  const classification = SHIP_CLASSIFICATIONS.includes(design.classification)
    ? design.classification
    : "Other";
  const jumpRating =
    design.hullType === "module" || whole(design.hullTons) < JUMP_MIN_HULL_TONS
      ? 0
      : sheet.jumpRating;
  const armed = (design.mounts ?? []).some((mount) =>
    (mount.weapons ?? []).some((weapon) => weapon)
  );
  return {
    designType: design.name.trim(),
    classification,
    hullTons: whole(design.hullTons),
    cargoTons: Math.max(0, sheet.cargo),
    hybridCargoFuel: containerTons,
    externalCargoTons: gearQuantity(design, "jumpNet") +
      gearQuantity(design, "planetaryNet") + gearQuantity(design, "external"),
    jumpRating,
    staterooms: whole(design.staterooms) + whole(design.highStaterooms) +
      whole(design.luxuryStaterooms),
    doubleStaterooms: Math.min(
      whole(design.staterooms),
      whole(design.doubleStaterooms),
    ),
    lowBerths: whole(design.lowBerths),
    fuelCapacity: sheet.lines.find((line) => line.name === "Fuel tank")?.tons ??
      0,
    cashPrice: Math.round(sheet.cost * 1_000_000),
    armed,
  };
}
