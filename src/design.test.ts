import { assert, assertEquals as rawEquals } from "@std/assert";

/** Existing specs compare tons, cost, and power. Role is checked on its own. */
function withoutLineRole(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutLineRole);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const line = typeof record.name === "string" &&
    typeof record.tons === "number";
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (line && (key === "role" || key === "option")) continue;
    copy[key] = withoutLineRole(item);
  }
  return copy;
}

function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  rawEquals(withoutLineRole(actual), withoutLineRole(expected), msg);
}
import { describe, it } from "@std/testing/bdd";
import { combinedBreakaway } from "./combined.ts";
import { blankDesign, blankModule, evaluateDesign } from "./design.ts";
import { designFromJson } from "./store.ts";
import {
  blankCustomShipBrain,
  optionsAt,
  quoteCustomShipBrain,
} from "./shipBrain.ts";
import {
  ADDITIONAL_SENSORS,
  armourAt,
  armourProtectionMax,
  armourRatingMax,
  armouryCover,
  availableSoftware,
  biospherePassengers,
  bridgesAt,
  cargoHandlingTons,
  dockingSpaceTons,
  DRIVE_OPTIONS,
  exteriorAppearsUnarmed,
  hullCost,
  hullOptionsAt,
  jumpDriveTons,
  jumpNetTons,
  legalCustomOptions,
  manoeuvreDriveTons,
  powerPlantFuelTons,
  repairDroneTons,
  TURRET_WEAPONS,
} from "./tables.ts";
import { orderSheetLines } from "./sheetOrder.ts";
import { STANDARD_DESIGNS } from "./templates.ts";

describe("advanced ship design", () => {
  it("builds the slow pinnace from High Guard", () => {
    const pinnace = STANDARD_DESIGNS.find((row) => row.name === "Slow Pinnace");
    assert(pinnace);
    const sheet = evaluateDesign(pinnace);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.hullPoints, 16);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 40,
      cost: 2.4,
      power: 8,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 3"),
      { name: "Manoeuvre drive 3", tons: 1.2, cost: 2.4, power: 12 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL8)"), {
      name: "Fusion (TL8)",
      tons: 2,
      cost: 1,
      power: 20,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 1,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 3,
      cost: 0.5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fixed mount"), {
      name: "Fixed mount",
      tons: 0,
      cost: 0.1,
      power: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Airlock"), {
      name: "Airlock",
      tons: 2,
      cost: 0.2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Fuel scoops")?.cost,
      0,
    );
    assertEquals(sheet.cargo, 30.8);
    assertEquals(sheet.cost, 5.967);
    assertEquals(sheet.powerUse.maneuver, 12);
    assertEquals(sheet.crew, [{ role: "Pilot", count: 1 }]);
    assertEquals(pinnace.standardDesign, true);
    assertEquals(
      evaluateDesign({ ...pinnace, standardDesign: false }).cost,
      6.63,
    );
  });

  it("builds the launch from High Guard", () => {
    const launch = STANDARD_DESIGNS.find((row) => row.name === "Launch");
    assert(launch);
    const sheet = evaluateDesign(launch);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.hullPoints, 8);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 20,
      cost: 1.2,
      power: 4,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 0.2, cost: 0.4, power: 2 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL8)"), {
      name: "Fusion (TL8)",
      tons: 1,
      cost: 0.5,
      power: 10,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 1,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 3,
      cost: 0.5,
    });
    assertEquals(
      sheet.lines.some((line) =>
        line.name === "Airlock" || line.name.includes("turret") ||
        line.name === "Fixed mount"
      ),
      false,
    );
    assertEquals(sheet.cargo, 14.8);
    assertEquals(sheet.cost, 2.367);
    assertEquals(
      evaluateDesign({ ...launch, standardDesign: false }).cost,
      2.63,
    );
  });

  it("builds the ship's boat from High Guard", () => {
    const boat = STANDARD_DESIGNS.find((row) => row.name === "Ship's Boat");
    assert(boat);
    const sheet = evaluateDesign(boat);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 12);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 30,
      cost: 1.8,
      power: 6,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 5"),
      { name: "Manoeuvre drive 5", tons: 1.5, cost: 3, power: 15 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 1.5,
      cost: 1.5,
      power: 22.5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 1,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 3,
      cost: 0.5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fixed mount"), {
      name: "Fixed mount",
      tons: 0,
      cost: 0.1,
      power: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Cabin space"), {
      name: "Cabin space",
      tons: 9,
      cost: 0.45,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Airlock"), {
      name: "Airlock",
      tons: 2,
      cost: 0.2,
    });
    assertEquals(sheet.cargo, 12);
    assertEquals(sheet.cost, 6.822);
  });

  it("builds the yacht from High Guard", () => {
    const yacht = STANDARD_DESIGNS.find((row) => row.name === "Yacht");
    assert(yacht);
    const sheet = evaluateDesign(yacht, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 80);
    assertEquals(sheet.lines.find((line) => line.name === "Standard hull"), {
      name: "Standard hull",
      tons: 200,
      cost: 10,
      power: 40,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 10,
      cost: 15,
      power: 20,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 6,
      cost: 6,
      power: 90,
    });
    assertEquals(sheet.powerFuel, 2);
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 22,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Civilian sensors"), {
      name: "Civilian sensors",
      tons: 1,
      cost: 3,
      power: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Docking space (Air/raft)"),
      { name: "Docking space (Air/raft)", tons: 5, cost: 1.25 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Air/raft"), {
      name: "Air/raft",
      tons: 0,
      cost: 0.25,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Docking space (Ship's Boat)"),
      { name: "Docking space (Ship's Boat)", tons: 33, cost: 8.25 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Ship's Boat"), {
      name: "Ship's Boat",
      tons: 0,
      cost: 6.822,
      carried: true,
    });
    assertEquals(sheet.lines.find((line) => line.name === "ATV"), {
      name: "ATV",
      tons: 0,
      cost: 0.155,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 1,
      cost: 0.05,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Gourmet kitchen"), {
      name: "Gourmet kitchen",
      tons: 6,
      cost: 1.2,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Hot tub"), {
      name: "Hot tub",
      tons: 1,
      cost: 0.012,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Theatre"), {
      name: "Theatre",
      tons: 8,
      cost: 1.6,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Wet bar"), {
      name: "Wet bar",
      tons: 0,
      cost: 0.002,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Studio"), {
      name: "Studio",
      tons: 4,
      cost: 0.4,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Training facilities"),
      { name: "Training facilities", tons: 4, cost: 0.8, power: 1 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 48,
      cost: 6,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Luxury staterooms"),
      { name: "Luxury staterooms", tons: 10, cost: 1.5 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Common space"), {
      name: "Common space",
      tons: 13,
      cost: 1.3,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump Control/1")?.cost,
      0.1,
    );
    assertEquals(sheet.cargo, 16);
    assertEquals(sheet.cost, 62.5311);
    assertEquals(sheet.powerUse.total, 83);
  });

  it("builds the subsidised merchant from High Guard", () => {
    const merchant = STANDARD_DESIGNS.find((row) =>
      row.name === "Subsidised Merchant"
    );
    assert(merchant);
    const sheet = evaluateDesign(merchant, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 160);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 400,
      cost: 24,
      power: 80,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 4, cost: 8, power: 40 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 15,
      cost: 22.5,
      power: 40,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 9,
      cost: 9,
      power: 135,
    });
    assertEquals(sheet.powerFuel, 1);
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 41,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 20,
      cost: 2,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Civilian sensors"), {
      name: "Civilian sensors",
      tons: 1,
      cost: 3,
      power: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Docking space (Launch)"),
      { name: "Docking space (Launch)", tons: 22, cost: 5.5 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Launch"), {
      name: "Launch",
      tons: 0,
      cost: 2.367,
      carried: true,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 1,
      cost: 0.05,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 76,
      cost: 9.5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Low berths"), {
      name: "Low berths",
      tons: 4.5,
      cost: 0.45,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Common space"), {
      name: "Common space",
      tons: 5.5,
      cost: 0.55,
    });
    assertEquals(sheet.cargo, 201);
    assertEquals(sheet.cost, 78.579);
  });

  it("builds the seeker from High Guard", () => {
    const seeker = STANDARD_DESIGNS.find((row) => row.name === "Seeker");
    assert(seeker);
    const sheet = evaluateDesign(seeker, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 40);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 100,
      cost: 6,
      power: 20,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Crystaliron 4"), {
      name: "Crystaliron 4",
      tons: 6,
      cost: 1.2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 2"),
      { name: "Manoeuvre drive 2", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 2"), {
      name: "Jump drive 2",
      tons: 10,
      cost: 15,
      power: 20,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 4,
      cost: 4,
      power: 60,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 21,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 0.5,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Computer/5 bis")?.cost,
      0.045,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Military sensors"), {
      name: "Military sensors",
      tons: 2,
      cost: 4.1,
      power: 2,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Double turret"), {
      name: "Double turret",
      tons: 1,
      cost: 0.5,
      power: 1,
    });
    assertEquals(
      sheet.lines.find((line) =>
        line.name === "Docking space (Prospecting buggy)"
      ),
      { name: "Docking space (Prospecting buggy)", tons: 5, cost: 1.25 },
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Prospecting buggy"),
      { name: "Prospecting buggy", tons: 0, cost: 0.27 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 1,
      cost: 0.05,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 8,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump Control/2")?.cost,
      0.2,
    );
    assertEquals(sheet.cargo, 30);
    assertEquals(sheet.cost, 34.3035);
  });

  it("builds the free trader from High Guard", () => {
    const trader = STANDARD_DESIGNS.find((row) => row.name === "Free Trader");
    assert(trader);
    const sheet = evaluateDesign(trader);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 80);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 200,
      cost: 12,
      power: 40,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Crystaliron 2"), {
      name: "Crystaliron 2",
      tons: 6,
      cost: 1.2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 10,
      cost: 15,
      power: 20,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 5,
      cost: 5,
      power: 75,
    });
    assertEquals(sheet.powerFuel, 1);
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 21,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Computer/5")?.cost,
      0.03,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Civilian sensors"), {
      name: "Civilian sensors",
      tons: 1,
      cost: 3,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 1,
      cost: 0.05,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Cargo crane"), {
      name: "Cargo crane",
      tons: 3,
      cost: 3,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 40,
      cost: 5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Low berths"), {
      name: "Low berths",
      tons: 10,
      cost: 1,
      power: 2,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Common space"), {
      name: "Common space",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump Control/1")?.cost,
      0.1,
    );
    assertEquals(sheet.powerUse, {
      base: 40,
      jump: 20,
      maneuver: 20,
      weapons: 0,
      sensors: 1,
      fittings: 3,
      total: 84,
    });
    assertEquals(sheet.cargo, 81);
    assertEquals(sheet.cost, 46.242);
    assertEquals(
      evaluateDesign({ ...trader, standardDesign: false }).cost,
      51.38,
    );
  });

  it("builds the far trader from High Guard", () => {
    const trader = STANDARD_DESIGNS.find((row) => row.name === "Far Trader");
    assert(trader);
    const sheet = evaluateDesign(trader);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 80);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 200,
      cost: 12,
      power: 40,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Crystaliron 2"), {
      name: "Crystaliron 2",
      tons: 6,
      cost: 1.2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 2"), {
      name: "Jump drive 2",
      tons: 15,
      cost: 22.5,
      power: 40,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 5,
      cost: 5,
      power: 75,
    });
    assertEquals(sheet.powerFuel, 1);
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 41,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Computer/5 bis")?.cost,
      0.045,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Civilian sensors"), {
      name: "Civilian sensors",
      tons: 1,
      cost: 3,
      power: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 2,
      cost: 0.1,
      power: 2,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Cargo crane"), {
      name: "Cargo crane",
      tons: 3,
      cost: 3,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 40,
      cost: 5,
    });
    assertEquals(sheet.lines.some((line) => line.name === "Low berths"), false);
    assertEquals(sheet.lines.find((line) => line.name === "Common space"), {
      name: "Common space",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump Control/2")?.cost,
      0.2,
    );
    assertEquals(sheet.powerUse, {
      base: 40,
      jump: 40,
      maneuver: 20,
      weapons: 0,
      sensors: 1,
      fittings: 2,
      total: 103,
    });
    assertEquals(sheet.cargo, 65);
    assertEquals(sheet.cost, 52.2405);
    assertEquals(
      evaluateDesign({ ...trader, standardDesign: false }).cost,
      58.045,
    );
  });

  it("builds the modular cutter and its modules from High Guard", () => {
    const cutter = STANDARD_DESIGNS.find((row) =>
      row.name === "Modular Cutter"
    );
    assert(cutter);
    const sheet = evaluateDesign(cutter, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 50,
      cost: 3,
      power: 10,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 4"),
      { name: "Manoeuvre drive 4", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 2,
      cost: 2,
      power: 30,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Modular Hull"), {
      name: "Modular Hull",
      tons: 30,
      cost: 1.8,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Cabin space"), {
      name: "Cabin space",
      tons: 6,
      cost: 0.3,
    });
    assertEquals(sheet.cargo, 4);
    assertEquals(sheet.cost, 10.737);
    const moduleSheet = (name: string) => {
      const design = STANDARD_DESIGNS.find((row) => row.name === name);
      assert(design);
      return evaluateDesign(design, STANDARD_DESIGNS);
    };
    const cradle = moduleSheet("Vehicle Cradle Module");
    assertEquals(cradle.errors, []);
    assertEquals(
      cradle.lines.find((line) => line.name === "Docking space (15-ton berth)"),
      { name: "Docking space (15-ton berth)", tons: 17, cost: 4.25 },
    );
    assertEquals(
      cradle.lines.find((line) => line.name === "Acceleration seats"),
      { name: "Acceleration seats", tons: 6, cost: 0.36 },
    );
    assertEquals(cradle.cargo, 7);
    assertEquals(cradle.cost, 4.959);
    const cargo = moduleSheet("Cargo Transport Module");
    assertEquals(cargo.cargo, 25);
    assertEquals(cargo.cost, 1.08);
    const personnel = moduleSheet("Personnel Transport Module");
    assertEquals(personnel.cargo, 0);
    assertEquals(personnel.cost, 2.43);
    const skimmer = moduleSheet("Fuel Skimmer Module");
    assertEquals(skimmer.errors, []);
    assertEquals(skimmer.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 28,
      cost: 0,
    });
    assertEquals(
      skimmer.lines.find((line) => line.name === "UNREP system x2"),
      { name: "UNREP system x2", tons: 2, cost: 1, power: 2 },
    );
    assertEquals(skimmer.cargo, 0);
    assertEquals(skimmer.cost, 1.71);
    const frame = moduleSheet("Fighter Frame Module");
    assertEquals(frame.errors, []);
    assertEquals(
      frame.lines.find((line) =>
        line.name === "Module, Dispersed structure hull"
      )?.cost,
      0.375,
    );
    assertEquals(
      frame.lines.filter((line) =>
        line.name === "Docking clamp (Ultralight Fighter)"
      ).length,
      4,
    );
    assertEquals(frame.cargo, 2);
    const shelter = moduleSheet("Pressurised Shelter Module");
    assertEquals(shelter.errors, []);
    assertEquals(shelter.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 16,
      cost: 2,
    });
    assertEquals(shelter.lines.find((line) => line.name === "Fusion (TL8)"), {
      name: "Fusion (TL8)",
      tons: 1,
      cost: 0.5,
      power: 10,
    });
    assertEquals(shelter.cargo, 6);
    assertEquals(shelter.cost, 3.627);
  });

  it("uses the ship design classifications", () => {
    assertEquals(blankDesign("new").classification, "Other");
    const classification = (name: string) =>
      STANDARD_DESIGNS.find((row) => row.name === name)?.classification;
    assertEquals(classification("Free Trader"), "Free Trader");
    assertEquals(classification("Far Trader"), "Free Trader");
    assertEquals(classification("Volitant Far Trader"), "Free Trader");
    assertEquals(classification("Scout"), "Scout");
    assertEquals(classification("Seeker"), "Scout");
    assertEquals(classification("Medical Scout"), "Scout");
    assertEquals(classification("Yacht"), "Yacht");
    assertEquals(classification("Launch"), "Other");
    assertEquals(classification("Patrol Corvette"), "Other");
  });

  it("builds the medical scout from Adventure Class Ships", () => {
    const scout = STANDARD_DESIGNS.find((row) => row.name === "Medical Scout");
    assert(scout);
    assertEquals(scout.standardDesign, false);
    const sheet = evaluateDesign(scout, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.hullPoints, 160);
    assertEquals(sheet.lines.find((line) => line.name === "Standard hull"), {
      name: "Standard hull",
      tons: 400,
      cost: 20,
      power: 80,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 2"),
      { name: "Manoeuvre drive 2", tons: 8, cost: 16, power: 80 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 3"), {
      name: "Jump drive 3",
      tons: 35,
      cost: 52.5,
      power: 120,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 20,
      cost: 20,
      power: 300,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 127,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 20,
      cost: 2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Computer/15")?.cost,
      2,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Military sensors"), {
      name: "Military sensors",
      tons: 2,
      cost: 4.1,
      power: 2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Life Scanner Analysis Suite"),
      { name: "Life Scanner Analysis Suite", tons: 1, cost: 4, power: 1 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Double turret"), {
      name: "Double turret",
      tons: 1,
      cost: 0.5,
      power: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Docking space (Slow Pinnace)"),
      { name: "Docking space (Slow Pinnace)", tons: 44, cost: 11 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Slow Pinnace"), {
      name: "Slow Pinnace",
      tons: 0,
      cost: 5.967,
      carried: true,
    });
    assertEquals(
      sheet.lines.filter((line) => line.name === "Docking space (Air/raft)")
        .length,
      2,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Docking space (Air/raft)"),
      { name: "Docking space (Air/raft)", tons: 5, cost: 1.25 },
    );
    assertEquals(
      sheet.lines.filter((line) => line.name === "Air/raft").map((line) =>
        line.cost
      ),
      [0.25, 0.25],
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 3,
      cost: 0.15,
      power: 3,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Fuel scoops")?.cost,
      1,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Medical Bay x6"), {
      name: "Medical Bay x6",
      tons: 24,
      cost: 12,
      power: 6,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Laboratory"), {
      name: "Laboratory",
      tons: 4,
      cost: 1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Briefing Room"), {
      name: "Briefing Room",
      tons: 4,
      cost: 0.5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 32,
      cost: 4,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Low berths"), {
      name: "Low berths",
      tons: 10,
      cost: 1,
      power: 2,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump Control/3")?.cost,
      0.3,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Common space"), {
      name: "Common space",
      tons: 32,
      cost: 3.2,
    });
    assertEquals(sheet.cargo, 23);
    assertEquals(sheet.powerUse, {
      base: 80,
      jump: 120,
      maneuver: 80,
      weapons: 1,
      sensors: 3,
      fittings: 11,
      total: 295,
    });
    assertEquals(sheet.cost, 164.217);
  });

  it("builds the Volitant far trader from Adventure Class Ships", () => {
    const trader = STANDARD_DESIGNS.find((row) =>
      row.name === "Volitant Far Trader"
    );
    assert(trader);
    assertEquals(trader.standardDesign, false);
    assertEquals(trader.classification, "Free Trader");
    const sheet = evaluateDesign(trader, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.warnings, []);
    assertEquals(sheet.lines.find((line) => line.name === "Streamlined hull"), {
      name: "Streamlined hull",
      tons: 200,
      cost: 12,
      power: 40,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Aerofins"), {
      name: "Aerofins",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Bonded superdense 4"),
      { name: "Bonded superdense 4", tons: 7.68, cost: 3.84 },
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 2"), {
      name: "Jump drive 2",
      tons: 15,
      cost: 22.5,
      power: 40,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 6,
      cost: 6,
      power: 90,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 41,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Holographic controls"),
      { name: "Holographic controls", tons: 0, cost: 0.25 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Civilian sensors"), {
      name: "Civilian sensors",
      tons: 1,
      cost: 3,
      power: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Computer/5 bis")?.cost,
      0.045,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump Control/2")?.cost,
      0.2,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Double turret"), {
      name: "Double turret",
      tons: 1,
      cost: 0.5,
      power: 1,
    });
    assertEquals(
      sheet.lines.some((line) =>
        line.name.startsWith("Missile") || line.name.startsWith("Pulse") ||
        line.name.startsWith("Sand")
      ),
      false,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 40,
      cost: 5,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Common space"), {
      name: "Common space",
      tons: 10,
      cost: 1,
    });
    assertEquals(sheet.lines.some((line) => line.name === "Low berths"), false);
    assertEquals(sheet.lines.find((line) => line.name === "Fuel processors"), {
      name: "Fuel processors",
      tons: 2,
      cost: 0.1,
      power: 2,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Fuel scoops"), {
      name: "Fuel scoops",
      tons: 0,
      cost: 0,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Cargo crane"), {
      name: "Cargo crane",
      tons: 3,
      cost: 3,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Loading belt (TL12)"),
      { name: "Loading belt (TL12)", tons: 1, cost: 0.01, power: 1 },
    );
    assertEquals(sheet.cargo, 50.32);
    assertEquals(sheet.powerUse, {
      base: 40,
      jump: 40,
      maneuver: 20,
      weapons: 1,
      sensors: 1,
      fittings: 3,
      total: 105,
    });
    assertEquals(sheet.cost, 63.445);
  });

  it("builds the mercenary cruiser from High Guard", () => {
    const cruiser = STANDARD_DESIGNS.find((row) =>
      row.name === "Mercenary Cruiser"
    );
    assert(cruiser);
    assertEquals(cruiser.standardDesign, true);
    const sheet = evaluateDesign(cruiser, STANDARD_DESIGNS);
    assertEquals(sheet.errors, []);
    const line = (name: string) => sheet.lines.find((row) => row.name === name);
    const sum = (name: string) =>
      sheet.lines.filter((row) => row.name === name).reduce(
        (total, row) => total + row.tons,
        0,
      );
    assertEquals(line("Sphere hull"), {
      name: "Sphere hull",
      tons: 800,
      cost: 44,
      power: 160,
    });
    assertEquals(line("Crystaliron 3"), {
      name: "Crystaliron 3",
      tons: 27,
      cost: 5.4,
    });
    assertEquals(line("Radiation Shielding"), {
      name: "Radiation Shielding",
      tons: 0,
      cost: 20,
    });
    assertEquals(line("Manoeuvre drive 3"), {
      name: "Manoeuvre drive 3",
      tons: 24,
      cost: 60,
      power: 120,
    });
    assertEquals(line("Jump drive 3"), {
      name: "Jump drive 3",
      tons: 65,
      cost: 97.5,
      power: 240,
    });
    assertEquals(line("Fusion (TL12)"), {
      name: "Fusion (TL12)",
      tons: 36,
      cost: 36,
      power: 540,
    });
    assertEquals(sheet.jumpFuel, 240);
    assertEquals(sheet.powerFuel, 8);
    assertEquals(line("Fuel tank"), { name: "Fuel tank", tons: 250, cost: 0 });
    assertEquals(line("Bridge"), { name: "Bridge", tons: 20, cost: 4 });
    assertEquals(line("Holographic controls"), {
      name: "Holographic controls",
      tons: 0,
      cost: 1,
    });
    assertEquals(line("Computer/20 fib")?.cost, 7.5);
    assertEquals(line("Military sensors"), {
      name: "Military sensors",
      tons: 2,
      cost: 4.1,
      power: 2,
    });
    assertEquals(
      sheet.lines.filter((row) => row.name === "Triple turret").length,
      8,
    );
    assertEquals(sum("Triple turret"), 8);
    assertEquals(
      sheet.lines.filter((row) => row.name === "Triple turret").reduce(
        (total, row) => total + row.cost,
        0,
      ),
      8,
    );
    assertEquals(sum("Docking space (Modular Cutter)"), 110);
    assertEquals(
      sheet.lines.filter((row) => row.name === "Modular Cutter").map((row) =>
        row.cost
      ),
      [10.737, 10.737],
    );
    assertEquals(sum("Docking space (30-ton berth)"), 66);
    assertEquals(line("Docking space (Air/raft)"), {
      name: "Docking space (Air/raft)",
      tons: 5,
      cost: 1.25,
    });
    assertEquals(line("Air/raft"), { name: "Air/raft", tons: 0, cost: 0.25 });
    assertEquals(line("Armoury"), { name: "Armoury", tons: 7, cost: 1.75 });
    assertEquals(line("Briefing Room"), {
      name: "Briefing Room",
      tons: 4,
      cost: 0.5,
    });
    assertEquals(line("Fuel processors"), {
      name: "Fuel processors",
      tons: 6,
      cost: 0.3,
      power: 6,
    });
    assertEquals(line("Fuel scoops"), {
      name: "Fuel scoops",
      tons: 0,
      cost: 1,
    });
    assertEquals(line("Medical Bay x2"), {
      name: "Medical Bay x2",
      tons: 8,
      cost: 4,
      power: 2,
    });
    assertEquals(line("Training facilities"), {
      name: "Training facilities",
      tons: 10,
      cost: 2,
      power: 3,
    });
    assertEquals(line("Workshop"), { name: "Workshop", tons: 6, cost: 0.9 });
    assertEquals(line("Luxury staterooms"), {
      name: "Luxury staterooms",
      tons: 10,
      cost: 1.5,
    });
    assertEquals(line("Staterooms"), {
      name: "Staterooms",
      tons: 60,
      cost: 7.5,
    });
    assertEquals(line("Barracks"), { name: "Barracks", tons: 30, cost: 1.5 });
    assertEquals(line("Evade/1")?.cost, 1);
    assertEquals(line("Fire Control/2")?.cost, 4);
    assertEquals(line("Jump Control/3")?.cost, 0.3);
    assertEquals(line("Common space"), {
      name: "Common space",
      tons: 24,
      cost: 2.4,
    });
    assertEquals(sheet.cargo, 22);
    assertEquals(sheet.hullPoints, 320);
    assertEquals(sheet.cost, 346.959);
    assertEquals(sheet.powerUse, {
      base: 160,
      jump: 240,
      maneuver: 120,
      weapons: 8,
      sensors: 2,
      fittings: 11,
      total: 541,
    });
    assertEquals(sheet.warnings, [
      "Software uses 35 bandwidth and the computer provides 20.",
    ]);
    assertEquals(sheet.crew, [
      { role: "Pilot", count: 1 },
      { role: "Astrogator", count: 1 },
      { role: "Engineer", count: 4 },
      { role: "Gunner", count: 8 },
      { role: "Medic", count: 1 },
      { role: "Steward", count: 1 },
    ]);
  });

  it("fits every standard design inside its hull", () => {
    const round3 = (value: number) => Math.round(value * 1000) / 1000;
    for (const design of STANDARD_DESIGNS) {
      const sheet = evaluateDesign(design, STANDARD_DESIGNS);
      assertEquals(sheet.errors, [], design.name);
      assertEquals(
        sheet.warnings.some((warning) => warning.includes("power points")),
        false,
        design.name,
      );
      assert(sheet.cargo >= 0, design.name);
      if (!design.standardDesign) continue;
      const open = evaluateDesign(
        { ...design, standardDesign: false },
        STANDARD_DESIGNS,
      );
      const carried = round3(
        open.lines.reduce(
          (total, line) => total + (line.carried ? line.cost : 0),
          0,
        ),
      );
      const list = round3(open.cost - carried);
      const listThousandths = Math.round(list * 1000);
      const carriedThousandths = Math.round(carried * 1000);
      assertEquals(
        sheet.cost,
        (listThousandths * 9 + carriedThousandths * 10) / 10000,
        design.name,
      );
    }
  });

  it("sizes power plant fuel from the High Guard tank rule", () => {
    assertEquals(powerPlantFuelTons("fusion12", 9, 4), 1);
    assertEquals(powerPlantFuelTons("fusion8", 8.2, 4), 1);
    assertEquals(powerPlantFuelTons("fusion8", 2, 4), 1);
    assertEquals(powerPlantFuelTons("fusion12", 20, 4), 2);
    assertEquals(powerPlantFuelTons("fusion12", 24, 4), 3);
    assertEquals(powerPlantFuelTons("fusion12", 4, 12), 3);
    assertEquals(powerPlantFuelTons("chemical", 1, 2), 10);
    assertEquals(powerPlantFuelTons("chemical", 1, 4), 20);
    assertEquals(powerPlantFuelTons("chemical", 16.4, 4), 328);
    assertEquals(powerPlantFuelTons("fusion8", 2, 4, 40), 0.2);
    assertEquals(powerPlantFuelTons("fusion12", 1.5, 4, 30), 0.15);
    assertEquals(powerPlantFuelTons("fusion8", 1, 4, 20), 0.1);
    assertEquals(powerPlantFuelTons("fusion12", 9, 4, 99), 0.9);
    assertEquals(powerPlantFuelTons("fusion12", 9, 4, 100), 1);
    const craft = blankDesign("craft");
    craft.hullTons = 40;
    craft.jump = 0;
    craft.power = 20;
    craft.powerPlant = "fusion8";
    craft.fuelTons = 0;
    const craftSheet = evaluateDesign(craft);
    assertEquals(craftSheet.powerFuel, 0.2);
    assertEquals(craftSheet.fuelMinimum, 0.2);
    assertEquals(
      craftSheet.lines.find((line) => line.name === "Fuel tank")?.tons,
      0.2,
    );
  });

  it("keeps a 200-ton trader at jump 1 and one hardpoint", () => {
    const trader = blankDesign("trader");
    trader.jump = 1;
    trader.power = 80;
    const sheet = evaluateDesign(trader);
    assertEquals(sheet.errors, []);
    assertEquals(sheet.jumpFuel, 20);
    assertEquals(sheet.powerFuel, 1);
    assertEquals(sheet.fuelMinimum, 21);
    assertEquals(sheet.fuelCapacity, 21);
    assertEquals(sheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 21,
      cost: 0,
    });
    assertEquals(
      sheet.lines.some((line) => line.name === "Fuel/cargo container"),
      false,
    );
    const cabins = blankDesign("cabins");
    cabins.cabinSpaces = 6;
    assertEquals(
      evaluateDesign(cabins).lines.find((line) => line.name === "Cabin space"),
      { name: "Cabin space", tons: 9, cost: 0.45 },
    );
    cabins.cabinSpaces = 0;
    assertEquals(
      evaluateDesign(cabins).lines.some((line) => line.name === "Cabin space"),
      false,
    );
    const seats = blankDesign("seats");
    seats.accelerationBenches = 2;
    seats.accelerationSeats = 3;
    seats.highStaterooms = 1;
    seats.luxuryStaterooms = 2;
    const seated = evaluateDesign(seats);
    assertEquals(
      seated.lines.find((line) => line.name === "Acceleration benches"),
      { name: "Acceleration benches", tons: 2, cost: 0.02 },
    );
    assertEquals(
      seated.lines.find((line) => line.name === "Acceleration seats"),
      { name: "Acceleration seats", tons: 1.5, cost: 0.09 },
    );
    assertEquals(seated.lines.find((line) => line.name === "High staterooms"), {
      name: "High staterooms",
      tons: 6,
      cost: 0.8,
    });
    assertEquals(
      seated.lines.find((line) => line.name === "Luxury staterooms"),
      { name: "Luxury staterooms", tons: 20, cost: 3 },
    );
    seats.barracks = 4;
    assertEquals(
      evaluateDesign(seats).lines.find((line) => line.name === "Barracks"),
      { name: "Barracks", tons: 4, cost: 0.2 },
    );
    seats.emergencyLowBerths = 2;
    const rescued = evaluateDesign(seats);
    assertEquals(
      rescued.lines.find((line) => line.name === "Emergency low berths"),
      { name: "Emergency low berths", tons: 2, cost: 2, power: 2 },
    );
    assertEquals(rescued.powerUse.fittings, 2);
    seats.brigs = 2;
    assertEquals(
      evaluateDesign(seats).lines.find((line) => line.name === "Brig"),
      { name: "Brig", tons: 8, cost: 0.5 },
    );
    seats.brigs = 4;
    assertEquals(
      evaluateDesign(seats).lines.find((line) => line.name === "Brig"),
      { name: "Brig", tons: 16, cost: 1 },
    );
    const cells = blankDesign("cells");
    cells.brigs = 1;
    seats.brigs = 1;
    const combined = combinedBreakaway([seats, cells]);
    assertEquals(combined.sheet.lines.find((line) => line.name === "Brig"), {
      name: "Brig",
      tons: 8,
      cost: 0.5,
    });
    assertEquals(combined.design.brigs, 2);
    const spare = blankDesign("spare");
    spare.emergencyLowBerths = 1;
    seats.emergencyLowBerths = 1;
    const joined = combinedBreakaway([seats, spare]);
    assertEquals(
      joined.sheet.lines.find((line) => line.name === "Emergency low berths"),
      { name: "Emergency low berths", tons: 2, cost: 2, power: 2 },
    );
    assertEquals(joined.design.emergencyLowBerths, 2);
    seats.barracks = 0;
    seats.brigs = 0;
    seats.emergencyLowBerths = 0;
    seats.accelerationBenches = 0;
    seats.accelerationSeats = 0;
    seats.highStaterooms = 0;
    seats.luxuryStaterooms = 0;
    const cleared = evaluateDesign(seats);
    assertEquals(
      cleared.lines.some((line) =>
        line.name.startsWith("Acceleration") ||
        line.name.endsWith("staterooms") && line.name !== "Staterooms"
      ),
      false,
    );
    const carried = blankDesign("container");
    carried.jump = 1;
    carried.power = 80;
    carried.containerTons = 19;
    const carriedSheet = evaluateDesign(carried);
    assertEquals(carriedSheet.fuelMinimum, 2);
    assertEquals(carriedSheet.lines.find((line) => line.name === "Fuel tank"), {
      name: "Fuel tank",
      tons: 2,
      cost: 0,
    });
    assertEquals(
      carriedSheet.lines.find((line) =>
        line.name.startsWith("Fuel/cargo container")
      ),
      { name: "Fuel/cargo container (19 t)", tons: 19.95, cost: 0.095 },
    );
    assertEquals(carriedSheet.fuelCapacity, 21);
    const covered = blankDesign("covered");
    covered.jump = 1;
    covered.power = 80;
    covered.containerTons = 30;
    const coveredSheet = evaluateDesign(covered);
    assertEquals(coveredSheet.fuelMinimum, 0);
    assertEquals(
      coveredSheet.lines.some((line) => line.name === "Fuel tank"),
      false,
    );
    assertEquals(coveredSheet.fuelCapacity, 30);
    const split = blankDesign("split");
    split.jump = 1;
    split.power = 80;
    split.containerTons = 10;
    split.extraContainers = [{ id: "second", tons: 15 }];
    const splitSheet = evaluateDesign(split);
    assertEquals(splitSheet.fuelMinimum, 0);
    assertEquals(splitSheet.fuelCapacity, 25);
    assertEquals(
      splitSheet.lines.filter((line) =>
        line.name.startsWith("Fuel/cargo container")
      ).map((line) => line.name),
      ["Fuel/cargo container (10 t)", "Fuel/cargo container (15 t)"],
    );
    assertEquals(
      sheet.lines.some((line) =>
        line.name.startsWith("Jump fuel") ||
        line.name.startsWith("Power plant fuel")
      ),
      false,
    );
    const extraFuel = blankDesign("tank");
    extraFuel.jump = 1;
    extraFuel.power = 80;
    extraFuel.fuelTons = 40;
    assertEquals(
      evaluateDesign(extraFuel).lines.find((line) => line.name === "Fuel tank")
        ?.tons,
      40,
    );
    extraFuel.fuelTons = 1;
    assertEquals(
      evaluateDesign(extraFuel).lines.find((line) => line.name === "Fuel tank")
        ?.tons,
      21,
    );
    assertEquals(sheet.hardpoints, 2);
    assertEquals(sheet.hardpointsUsed, 0);
    assertEquals(sheet.hullPoints, 80);
    assert(sheet.cargo > 80);
    assertEquals(sheet.powerUse, {
      base: 40,
      jump: 20,
      maneuver: 20,
      weapons: 0,
      sensors: 0,
      fittings: 0,
      total: 80,
    });
    const military = blankDesign("sensors");
    military.jump = 1;
    military.power = 80;
    military.sensors = "military";
    assertEquals(evaluateDesign(military).powerUse.sensors, 2);
    assertEquals(evaluateDesign(military).powerUse.total, 82);
    assertEquals(sheet.powerPlantTons, 8);
    assertEquals(
      sheet.lines.find((line) => line.name === "Fusion (TL8)")?.cost,
      4,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Streamlined hull")?.power,
      40,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 1")?.power,
      20,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Jump drive 1")?.power,
      20,
    );
    assertEquals(
      sheet.lines.some((line) =>
        line.name === "Triple turret" || line.name === "Pulse laser"
      ),
      false,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Basic sensors")?.power,
      0,
    );
    assert(
      sheet.lines.findIndex((line) => line.name === "Basic sensors") <
        sheet.lines.findIndex((line) => line.name.startsWith("Computer/")),
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Fusion (TL8)")?.power,
      80,
    );
    assertEquals(blankDesign("fresh").techLevel, 12);
    assertEquals(blankDesign("fresh").jump, 0);
    assertEquals(
      sheet.lines.some((line) =>
        line.name === "Staterooms" || line.name === "Low berths" ||
        line.name === "Common space" || line.name.startsWith("Acceleration") ||
        line.name === "High staterooms" || line.name === "Luxury staterooms" ||
        line.name === "Cabin space"
      ),
      false,
    );
  });

  it("refuses weapons beyond the hardpoints and a power plant below the drives", () => {
    const design = blankDesign("over");
    design.mounts = Array.from(
      { length: 5 },
      (_, index) => ({
        id: `mount-${index}`,
        kind: "triple" as const,
        weapons: [],
      }),
    );
    design.power = 0;
    const sheet = evaluateDesign(design);
    assert(sheet.errors.some((error) => error.includes("hardpoints")));
    assertEquals(
      sheet.warnings.some((warning) => warning.includes("power points")),
      false,
    );
  });

  it("prices hull options from High Guard and keeps stealth apart from reflec", () => {
    const fins = blankDesign("fins");
    fins.hullTons = 95;
    fins.hullOptions = [{ id: "fins", kind: "aerofins" }];
    assertEquals(
      evaluateDesign(fins).lines.find((line) => line.name === "Aerofins"),
      { name: "Aerofins", tons: 4.75, cost: 0.475 },
    );
    const coated = blankDesign("coated");
    coated.hullOptions = [
      { id: "heat", kind: "heat" },
      { id: "radiation", kind: "radiation" },
      { id: "basic", kind: "stealth" },
    ];
    const coatedSheet = evaluateDesign(coated);
    assertEquals(
      coatedSheet.lines.find((line) => line.name === "Heat Shielding"),
      { name: "Heat Shielding", tons: 0, cost: 20 },
    );
    assertEquals(
      coatedSheet.lines.find((line) => line.name === "Radiation Shielding"),
      { name: "Radiation Shielding", tons: 0, cost: 5 },
    );
    assertEquals(
      coatedSheet.lines.find((line) => line.name === "Basic Stealth"),
      { name: "Basic Stealth", tons: 4, cost: 8 },
    );
    coated.hullOptions = [{ id: "improved", kind: "stealthImproved" }];
    assertEquals(
      evaluateDesign(coated).lines.find((line) =>
        line.name === "Improved Stealth"
      ),
      { name: "Improved Stealth", tons: 0, cost: 20 },
    );
    coated.techLevel = 14;
    coated.hullOptions = [{ id: "advanced", kind: "stealthAdvanced" }];
    assertEquals(
      evaluateDesign(coated).lines.find((line) =>
        line.name === "Advanced Stealth"
      ),
      { name: "Advanced Stealth", tons: 0, cost: 200 },
    );
    coated.techLevel = 11;
    coated.hullOptions = [{ id: "enhanced", kind: "stealthEnhanced" }];
    assert(
      evaluateDesign(coated).errors.some((error) =>
        error === "Enhanced Stealth requires tech level 12."
      ),
    );
    coated.techLevel = 12;
    coated.hullOptions = [{ id: "reflec", kind: "reflec" }, {
      id: "enhanced",
      kind: "stealthEnhanced",
    }];
    assert(
      evaluateDesign(coated).errors.some((error) =>
        error === "Reflec cannot be combined with stealth."
      ),
    );
    assertEquals(hullOptionsAt(11, []).map((option) => option.label), [
      "Aerofins",
      "Heat Shielding",
      "Radiation Shielding",
      "Reflec",
      "Enhanced solar coating",
      "Basic Stealth",
      "Improved Stealth",
      "Breakaway Hull",
      "Modular Hull",
      "Pressure Hull",
    ]);
    assertEquals(
      hullOptionsAt(11, ["reflec"]).some((option) =>
        option.group === "stealth"
      ),
      false,
    );
    assertEquals(
      hullOptionsAt(14, ["stealth"]).some((option) =>
        option.id === "reflec" || option.group === "stealth"
      ),
      false,
    );
    assertEquals(hullOptionsAt(6, []).map((option) => option.id), [
      "aerofins",
      "heat",
      "breakaway",
      "modular",
      "pressure",
    ]);
    assertEquals(
      hullOptionsAt(6, ["modular", "breakaway"]).map((option) => option.id),
      ["aerofins", "heat", "modular", "pressure"],
    );
    assertEquals(
      hullOptionsAt(12, ["radiation"]).some((option) =>
        option.id === "solarAdvanced"
      ),
      true,
    );
    assertEquals(
      hullOptionsAt(12, ["solarEnhanced"]).map((option) => option.id),
      ["radiation"],
    );
    assertEquals(
      hullOptionsAt(12, ["heat"]).some((option) => option.group === "solar"),
      false,
    );
    const breakaway = blankDesign("breakaway");
    breakaway.hullTons = 1000;
    breakaway.hullOptions = [{ id: "join", kind: "breakaway" }];
    assertEquals(
      evaluateDesign(breakaway).lines.find((line) =>
        line.name === "Breakaway Hull"
      ),
      { name: "Breakaway Hull", tons: 20, cost: 40 },
    );
    breakaway.hullTons = 200;
    assertEquals(
      evaluateDesign(breakaway).lines.find((line) =>
        line.name === "Breakaway Hull"
      ),
      { name: "Breakaway Hull", tons: 4, cost: 8 },
    );
    const deep = blankDesign("deep");
    deep.hullTons = 200;
    deep.configuration = "streamlined";
    deep.hullOptions = [{ id: "deep", kind: "pressure" }];
    const deepSheet = evaluateDesign(deep);
    assertEquals(
      deepSheet.lines.find((line) => line.name === "Pressure Hull"),
      { name: "Pressure Hull", tons: 50, cost: 120 },
    );
    assertEquals(deepSheet.armourRating, 4);
    deep.hullType = "light";
    assertEquals(
      evaluateDesign(deep).lines.find((line) => line.name === "Pressure Hull")
        ?.cost,
      90,
    );
    deep.hullType = "standard";
    deep.configuration = "planetoid";
    const planetoid = evaluateDesign(deep);
    assertEquals(
      planetoid.lines.find((line) => line.name === "Pressure Hull"),
      { name: "Pressure Hull", tons: 50, cost: 8 },
    );
    assertEquals(planetoid.armourRating, 6);

    const coatedHull = blankDesign("solar");
    coatedHull.hullTons = 200;
    coatedHull.configuration = "standard";
    coatedHull.techLevel = 10;
    coatedHull.hullOptions = [{ id: "coat", kind: "solarEnhanced", units: 80 }];
    assertEquals(
      evaluateDesign(coatedHull).lines.find((line) =>
        line.name === "Enhanced solar coating x80"
      ),
      { name: "Enhanced solar coating x80", tons: 0, cost: 24, power: 8 },
    );
    coatedHull.hullOptions = [{ id: "coat", kind: "solarEnhanced", units: 81 }];
    assert(
      evaluateDesign(coatedHull).errors.some((error) =>
        error === "Solar coating covers at most 40% of the hull (80 units)."
      ),
    );
    coatedHull.configuration = "close";
    coatedHull.hullOptions = [{ id: "coat", kind: "solarEnhanced", units: 80 }];
    assertEquals(
      evaluateDesign(coatedHull).lines.find((line) =>
        line.name === "Enhanced solar coating x80"
      )?.power,
      4,
    );
    coatedHull.configuration = "distributed";
    assertEquals(
      evaluateDesign(coatedHull).lines.find((line) =>
        line.name === "Enhanced solar coating x80"
      )?.power,
      4,
    );
    coatedHull.configuration = "streamlined";
    assert(
      evaluateDesign(coatedHull).errors.some((error) =>
        error === "Solar coating cannot be applied to a streamlined hull."
      ),
    );
    assertEquals(
      evaluateDesign(coatedHull).lines.find((line) =>
        line.name === "Enhanced solar coating x80"
      )?.power,
      undefined,
    );
    coatedHull.configuration = "standard";
    coatedHull.techLevel = 12;
    coatedHull.hullOptions = [
      { id: "coat", kind: "solarAdvanced", units: 10 },
      { id: "shield", kind: "radiation" },
    ];
    const advancedCoat = evaluateDesign(coatedHull);
    assertEquals(
      advancedCoat.errors.filter((error) => error.includes("Solar coating")),
      [],
    );
    assertEquals(
      advancedCoat.lines.find((line) =>
        line.name === "Advanced solar coating x10"
      ),
      { name: "Advanced solar coating x10", tons: 0, cost: 4, power: 2 },
    );
    coatedHull.hullOptions = [
      { id: "coat", kind: "solarAdvanced", units: 10 },
      { id: "heat", kind: "heat" },
    ];
    assert(
      evaluateDesign(coatedHull).errors.some((error) =>
        error === "Solar coating can be combined only with radiation shielding."
      ),
    );
    coatedHull.techLevel = 9;
    coatedHull.hullOptions = [{ id: "coat", kind: "solarEnhanced", units: 1 }];
    assert(
      evaluateDesign(coatedHull).errors.some((error) =>
        error === "Enhanced solar coating requires tech level 10."
      ),
    );
  });

  it("prices a hull at Cr50000 per ton and allows 5 to 10000 tons", () => {
    assertEquals(hullCost(200), 10);
    assertEquals(hullCost(5), 0.25);
    const light = blankDesign("light-hull");
    light.hullType = "light";
    const lightSheet = evaluateDesign(light);
    assertEquals(
      lightSheet.lines.find((line) =>
        line.name === "Light Hull, Streamlined hull"
      ),
      { name: "Light Hull, Streamlined hull", tons: 200, cost: 9, power: 40 },
    );
    assertEquals(lightSheet.hullPoints, 72);
    const reinforced = blankDesign("reinforced-hull");
    reinforced.hullTons = 2000;
    reinforced.hullType = "reinforced";
    const reinforcedSheet = evaluateDesign(reinforced);
    assertEquals(
      reinforcedSheet.lines.find((line) =>
        line.name === "Reinforced Hull, Streamlined hull"
      )?.cost,
      180,
    );
    assertEquals(reinforcedSheet.hullPoints, 880);
    const design = blankDesign("mid");
    design.hullTons = 150;
    const sheet = evaluateDesign(design);
    assertEquals(
      sheet.lines.find((line) => line.name === "Streamlined hull")?.tons,
      150,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Streamlined hull")?.cost,
      9,
    );
    assertEquals(sheet.hardpoints, 1);
    design.configuration = "distributed";
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Dispersed structure hull"
      )?.cost,
      3.75,
    );
    design.configuration = "planetoid";
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Planetoid hull"
      )?.cost,
      0.6,
    );
    design.configuration = "streamlined";
    design.hullTons = 4;
    assert(
      evaluateDesign(design).errors.some((error) => error.includes("10,000")),
    );
    design.hullTons = 10001;
    const over = evaluateDesign(design);
    assert(over.errors.some((error) => error.includes("10,000")));
    assertEquals(over.lines[0]?.tons, 10000);
  });

  it("prices a module at Cr25000 per ton and omits ship systems", () => {
    const design = blankModule("pod");
    design.hullTons = 200;
    design.configuration = "streamlined";
    design.classification = "Yacht";
    design.armour = "crystaliron";
    design.armourRating = 4;
    design.hullOptions = [{ id: "fins", kind: "aerofins" }];
    design.thrust = 2;
    design.jump = 2;
    design.power = 50;
    design.scoops = true;
    design.mounts = [{ id: "gun", kind: "fixed", weapons: ["pulse"] }];
    const sheet = evaluateDesign(design);
    assertEquals(
      sheet.lines.find((line) => line.name === "Module, Streamlined hull"),
      { name: "Module, Streamlined hull", tons: 200, cost: 6, power: 0 },
    );
    assertEquals(sheet.armourRating, 0);
    const names = sheet.lines.map((line) => line.name);
    assertEquals(
      names.some((name) =>
        name.startsWith("Crystaliron") || name === "Aerofins" ||
        name.startsWith("Manoeuvre") || name.startsWith("Jump drive") ||
        name.startsWith("Fusion") || name === "Fuel scoops" ||
        name === "Bridge" || name.startsWith("Computer") ||
        name.endsWith("sensors")
      ),
      false,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Pulse laser"), {
      name: "Pulse laser",
      tons: 0,
      cost: 1,
      power: 4,
    });
    assertEquals(sheet.powerUse.base, 0);
    assertEquals(sheet.powerUse.weapons, 4);
    assertEquals(
      sheet.warnings.some((warning) => warning.includes("power points")),
      false,
    );
    assertEquals(sheet.errors.some((error) => error.includes("power")), false);
    design.configuration = "distributed";
    assertEquals(evaluateDesign(design).lines[0]?.cost, 2.5);
    design.configuration = "planetoid";
    assertEquals(evaluateDesign(design).lines[0]?.cost, 5);
    assertEquals(evaluateDesign(design).armourRating, 0);
    assertEquals(blankModule("fresh").name, "New module");
    assertEquals(blankModule("fresh").classification, "Other");
  });

  it("uses firmpoints under 100 tons and reduces weapon power by 25 percent", () => {
    const design = blankDesign("boat");
    design.hullTons = 10;
    design.mounts = [];
    assertEquals(evaluateDesign(design).hardpoints, 1);
    design.hullTons = 40;
    assertEquals(evaluateDesign(design).hardpoints, 2);
    design.hullTons = 80;
    assertEquals(evaluateDesign(design).hardpoints, 3);
    design.hullTons = 40;
    design.bridge = "cockpit";
    design.mounts = [
      { id: "a", kind: "single", weapons: ["pulse"] },
      { id: "b", kind: "fixed", weapons: ["pulse"] },
    ];
    const sheet = evaluateDesign(design);
    assertEquals(sheet.hardpointsUsed, 2);
    assertEquals(
      sheet.lines.filter((line) => line.name === "Pulse laser").map((line) =>
        line.power
      ),
      [3, 3],
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Single turret")?.power,
      1,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Fixed mount")?.power,
      0,
    );
    design.mounts = [
      { id: "a", kind: "single", weapons: ["pulse"] },
      { id: "b", kind: "fixed", weapons: ["pulse", "beam", "missile"] },
    ];
    const crowded = evaluateDesign(design);
    assert(
      crowded.errors.some((error) => error.includes("Fixed mount holds 1")),
    );
    assertEquals(
      crowded.lines.filter((line) =>
        line.name === "Beam laser" || line.name === "Missile rack"
      ),
      [],
    );
    assertEquals(
      crowded.lines.filter((line) => line.name === "Pulse laser").length,
      2,
    );
    design.hullTons = 200;
    design.mounts = [{
      id: "b",
      kind: "fixed",
      weapons: ["pulse", "beam", "missile"],
    }];
    const large = evaluateDesign(design);
    assertEquals(
      large.errors.filter((error) => error.includes("Fixed mount")),
      [],
    );
    assertEquals(
      large.lines.filter((line) =>
        line.name === "Pulse laser" || line.name === "Beam laser" ||
        line.name === "Missile rack"
      ).map((line) => line.name),
      ["Pulse laser", "Beam laser", "Missile rack"],
    );
    design.hullTons = 40;
    design.mounts = [
      { id: "a", kind: "double", weapons: ["pulse"] },
      { id: "b", kind: "single", weapons: ["pulse"] },
      { id: "c", kind: "single", weapons: ["beam"] },
    ];
    const illegal = evaluateDesign(design);
    assert(illegal.errors.some((error) => error.includes("100 tons")));
    assert(illegal.errors.some((error) => error.includes("one single turret")));
    assert(illegal.errors.some((error) => error.includes("firmpoints")));
  });

  it("sizes a plant from its power per ton and hides plants above the tech level", () => {
    const chemical = blankDesign("chemical");
    chemical.powerPlant = "chemical";
    chemical.power = 80;
    const chemicalSheet = evaluateDesign(chemical);
    assertEquals(chemicalSheet.powerPlantTons, 16);
    assertEquals(
      chemicalSheet.lines.find((line) => line.name === "Chemical (TL7)")?.cost,
      4,
    );

    const early = blankDesign("early");
    early.techLevel = 11;
    early.powerPlant = "fusion12";
    const earlySheet = evaluateDesign(early);
    assert(earlySheet.errors.some((error) => error.includes("tech level 12")));
    assertEquals(armourAt(6).map((row) => row.id), ["none"]);
    assertEquals(armourAt(9).map((row) => row.id), ["none", "titanium"]);
    assertEquals(armourAt(12).map((row) => row.id), [
      "none",
      "titanium",
      "crystaliron",
    ]);
    assertEquals(armourAt(15).map((row) => row.id), [
      "none",
      "titanium",
      "crystaliron",
      "bonded",
    ]);
    assertEquals(armourAt(16).map((row) => row.id), [
      "none",
      "titanium",
      "crystaliron",
      "bonded",
      "molecular",
    ]);
    assertEquals(armourProtectionMax("none", 15), 0);
    assertEquals(armourProtectionMax("titanium", 7), 7);
    assertEquals(armourProtectionMax("titanium", 12), 9);
    assertEquals(armourProtectionMax("crystaliron", 10), 10);
    assertEquals(armourProtectionMax("crystaliron", 14), 13);
    assertEquals(armourProtectionMax("bonded", 14), 14);
    assertEquals(armourProtectionMax("bonded", 15), 15);
    assertEquals(armourProtectionMax("molecular", 16), 20);
    assertEquals(armourRatingMax("titanium", 12, 2), 7);
    assertEquals(armourRatingMax("crystaliron", 12, 4), 8);
    assertEquals(armourRatingMax("bonded", 14, 8), 6);
  });

  it("prices a computer by type and limits bridges to the hull", () => {
    const design = blankDesign("systems");
    assertEquals(bridgesAt(design.hullTons).map((bridge) => bridge.label), [
      "Bridge",
      "Small bridge",
    ]);
    const standard = evaluateDesign(design);
    assertEquals(
      standard.lines.find((line) => line.name === "Computer/5")?.cost,
      0.03,
    );
    assertEquals(standard.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 1,
    });

    design.computerType = "bis";
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Computer/5 bis"
      )?.cost,
      0.045,
    );
    design.computerType = "fib";
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Computer/5 fib"
      )?.cost,
      0.045,
    );
    design.computerType = "bisfib";
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Computer/5 bis+fib"
      )?.cost,
      0.06,
    );

    design.computerType = "standard";
    design.bridge = "small";
    assertEquals(
      evaluateDesign(design).lines.find((line) => line.name === "Small bridge"),
      { name: "Small bridge", tons: 6, cost: 0.5 },
    );

    design.hullTons = 50;
    design.bridge = "cockpit";
    assertEquals(bridgesAt(50).map((bridge) => bridge.id), [
      "cockpit",
      "dual",
      "bridge",
    ]);
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Single cockpit"
      ),
      { name: "Single cockpit", tons: 1.5, cost: 0.01 },
    );
    design.bridge = "dual";
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Double cockpit"
      )?.cost,
      0.015,
    );

    design.hullTons = 5000;
    design.bridge = "command";
    assertEquals(bridgesAt(5000).map((bridge) => bridge.id), [
      "bridge",
      "small",
      "command",
    ]);
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Command bridge"
      ),
      { name: "Command bridge", tons: 80, cost: 37.5 },
    );

    design.hullTons = 200;
    design.bridge = "command";
    assert(
      evaluateDesign(design).errors.some((error) => error.includes("5,000")),
    );
  });

  it("prices installed software and keeps one program from each family", () => {
    const design = blankDesign("software");
    const sheet = evaluateDesign(design);
    assertEquals(
      sheet.lines.find((line) => line.name === "Intellect")?.cost,
      0,
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre/0")?.cost,
      0,
    );
    assertEquals(
      sheet.lines.some((line) => line.name.startsWith("Jump Control")),
      false,
    );
    assertEquals(
      availableSoftware(design.software, design.techLevel).filter((program) =>
        program.group === "jump"
      ).map((program) => program.id),
      ["jump1", "jump2", "jump3"],
    );

    design.software = [...design.software, "jump1"];
    assertEquals(
      availableSoftware(design.software, design.techLevel).some((program) =>
        program.group === "jump"
      ),
      false,
    );
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Jump Control/1"
      )?.cost,
      0.1,
    );

    design.software = design.software.filter((id) => id !== "jump1");
    assert(
      availableSoftware(design.software, design.techLevel).some((program) =>
        program.id === "jump1"
      ),
    );

    design.software = [...design.software, "evade1", "evade2", "fire1"];
    const crowded = evaluateDesign(design);
    assertEquals(
      crowded.lines.filter((line) => line.name.startsWith("Evade")).map((
        line,
      ) => line.cost),
      [1],
    );
    assertEquals(
      crowded.lines.find((line) => line.name === "Fire Control/1")?.cost,
      2,
    );
    assertEquals(
      availableSoftware(design.software, design.techLevel).some((program) =>
        program.group === "evade" || program.group === "fire"
      ),
      false,
    );

    const names = availableSoftware([], 12).map((program) => program.label);
    assert(names.includes("Advanced Fire Control/1"));
    assert(names.includes("Advanced Fire Control/2"));
    assertEquals(names.includes("Advanced Fire Control/3"), false);
    assert(names.includes("Launch Solution/1"));
    assert(names.includes("Virtual Gunner/0"));
    assert(names.includes("Screen Optimiser"));
    assertEquals(names.includes("Conscious Intelligence/1"), false);
    assertEquals(names.includes("Hop Control/1"), false);
    assertEquals(
      availableSoftware([], 8).some((program) => program.id === "launch1"),
      true,
    );
    assertEquals(
      availableSoftware([], 18).some((program) => program.id === "conscious3"),
      true,
    );
    assertEquals(
      availableSoftware([], 20).filter((program) => program.group === "hop")
        .map((program) => program.id),
      ["hop1", "hop2", "hop3", "hop4"],
    );
    assertEquals(
      availableSoftware([], 20).some((program) => program.id === "skip1"),
      true,
    );

    design.software = [
      "advancedFire1",
      "advancedFire2",
      "screenOptimiser",
      "launch3",
    ];
    const highGuard = evaluateDesign(design);
    assertEquals(
      highGuard.lines.find((line) => line.name === "Advanced Fire Control/1"),
      { name: "Advanced Fire Control/1", tons: 0, cost: 12, fold: "software" },
    );
    assertEquals(
      highGuard.lines.some((line) => line.name === "Advanced Fire Control/2"),
      false,
    );
    assertEquals(
      highGuard.lines.find((line) => line.name === "Launch Solution/3")?.cost,
      16,
    );
    assert(
      highGuard.warnings.some((warning) =>
        warning === "Screen Optimiser requires a screen."
      ),
    );
  });

  it("prices each work space and counts medical bay power", () => {
    const design = blankDesign("spaces");
    design.lowBerths = 0;
    design.workSpaces = [
      { id: "lab", kind: "laboratory", quantity: 1 },
      { id: "robotics", kind: "robotics", quantity: 1 },
      { id: "med", kind: "medical", quantity: 2 },
      { id: "studio", kind: "studio", quantity: 1 },
      { id: "shop", kind: "workshop", quantity: 1 },
      { id: "library", kind: "library", quantity: 1 },
      { id: "brief", kind: "briefing", quantity: 1 },
      { id: "lock", kind: "airlock", quantity: 1 },
    ];
    const sheet = evaluateDesign(design);
    const line = (name: string) =>
      sheet.lines.find((row) => row.name === name && row.tons > 0);
    assertEquals(line("Laboratory")?.tons, 4);
    assertEquals(line("Laboratory")?.cost, 1);
    assertEquals(line("Robotics Laboratory")?.tons, 4);
    assertEquals(line("Robotics Laboratory")?.cost, 0.5);
    assertEquals(line("Robotics Laboratory")?.power, undefined);
    assertEquals(line("Medical Bay x2")?.tons, 8);
    assertEquals(line("Medical Bay x2")?.cost, 4);
    assertEquals(line("Medical Bay x2")?.power, 2);
    assertEquals(line("Studio")?.tons, 4);
    assertEquals(line("Studio")?.cost, 0.4);
    assertEquals(line("Workshop")?.tons, 6);
    assertEquals(line("Workshop")?.cost, 0.9);
    assertEquals(line("Library")?.tons, 4);
    assertEquals(line("Library")?.cost, 4);
    assertEquals(line("Briefing Room")?.tons, 4);
    assertEquals(line("Briefing Room")?.cost, 0.5);
    assertEquals(line("Airlock")?.tons, 2);
    assertEquals(line("Airlock")?.cost, 0.2);
    assertEquals(line("Airlock")?.power, undefined);
    assertEquals(sheet.powerUse.fittings, 2);
    design.techLevel = 7;
    assert(
      evaluateDesign(design).errors.some((error) => error.includes("Library")),
    );
  });

  it("prices robotics laboratory options from the Robot Handbook", () => {
    const design = blankDesign("robotics-lab");
    design.techLevel = 12;
    design.lowBerths = 0;
    design.workSpaces = [{
      id: "robot",
      kind: "robotics",
      quantity: 2,
      avatarChair: "deluxe",
      fabrication: "basic",
      droneController: "improved",
      swarmController: "enhanced",
    }];
    const sheet = evaluateDesign(design);
    const line = (name: string) => sheet.lines.find((row) => row.name === name);
    assertEquals(line("Robotics Laboratory x2"), {
      name: "Robotics Laboratory x2",
      tons: 8,
      cost: 1,
    });
    assertEquals(line("Deluxe avatar chair"), {
      name: "Deluxe avatar chair",
      tons: 0,
      cost: 1,
      fold: "robotics",
    });
    assertEquals(line("Fabrication chamber (Basic)"), {
      name: "Fabrication chamber (Basic)",
      tons: 0,
      cost: 0.5,
      fold: "robotics",
    });
    assertEquals(line("Drone controller (Improved)"), {
      name: "Drone controller (Improved)",
      tons: 0,
      cost: 0.02,
      fold: "robotics",
    });
    assertEquals(line("Swarm controller (Enhanced)"), {
      name: "Swarm controller (Enhanced)",
      tons: 0,
      cost: 0.1,
      fold: "robotics",
    });
    assert(
      sheet.errors.some((error) =>
        error === "Deluxe avatar chair requires tech level 13."
      ),
    );
    assertEquals(
      sheet.errors.some((error) =>
        error.includes("Fabrication chamber") ||
        error.includes("Drone controller") || error.includes("Swarm controller")
      ),
      false,
    );
    design.techLevel = 17;
    design.workSpaces = [{
      ...design.workSpaces[0],
      quantity: 1,
      avatarChair: "standard",
      fabrication: "advanced",
      droneController: "advanced",
      swarmController: "advanced",
    }];
    const fitted = evaluateDesign(design);
    assertEquals(
      fitted.lines.find((row) => row.name === "Avatar chair")?.cost,
      0.3,
    );
    assertEquals(
      fitted.lines.find((row) => row.name === "Fabrication chamber (Advanced)")
        ?.cost,
      24,
    );
    assertEquals(
      fitted.lines.find((row) => row.name === "Drone controller (Advanced)")
        ?.cost,
      0.05,
    );
    assertEquals(
      fitted.lines.find((row) => row.name === "Swarm controller (Advanced)")
        ?.cost,
      0.1,
    );
    assertEquals(
      fitted.errors.some((error) => error.includes("requires tech level")),
      false,
    );
  });

  it("prices each additional sensor once and counts its power", () => {
    const design = blankDesign("extra-sensors");
    design.techLevel = 15;
    design.additionalSensors = [
      ...ADDITIONAL_SENSORS.map((kind) => ({
        id: kind.id,
        kind: kind.id,
        tons: 1,
      })),
      { id: "life-again", kind: "life" as const, tons: 1 },
    ];
    const sheet = evaluateDesign(design);
    const line = (name: string) => sheet.lines.find((row) => row.name === name);
    assertEquals(line("Life Scanner"), {
      name: "Life Scanner",
      tons: 1,
      cost: 2,
      power: 1,
    });
    assertEquals(line("Life Scanner Analysis Suite"), {
      name: "Life Scanner Analysis Suite",
      tons: 1,
      cost: 4,
      power: 1,
    });
    assertEquals(line("Shallow Penetration Suite"), {
      name: "Shallow Penetration Suite",
      tons: 10,
      cost: 5,
      power: 1,
    });
    assertEquals(line("Improved Signal Processing"), {
      name: "Improved Signal Processing",
      tons: 1,
      cost: 4,
      power: 1,
    });
    assertEquals(line("Enhanced Signal Processing"), {
      name: "Enhanced Signal Processing",
      tons: 2,
      cost: 8,
      power: 2,
    });
    assertEquals(line("Mineral Detection Suite"), {
      name: "Mineral Detection Suite",
      tons: 1,
      cost: 5,
    });
    assertEquals(
      sheet.lines.filter((row) => row.name === "Life Scanner").length,
      1,
    );
    assertEquals(line("Deep Penetration Scanners"), {
      name: "Deep Penetration Scanners",
      tons: 1,
      cost: 1,
      power: 1,
    });
    assertEquals(line("Extension Net"), {
      name: "Extension Net",
      tons: 2,
      cost: 2,
    });
    assertEquals(line("Distributed Arrays"), {
      name: "Distributed Arrays",
      tons: 0,
      cost: 0,
    });
    assertEquals(line("Rapid-deployment Extended Arrays"), {
      name: "Rapid-deployment Extended Arrays",
      tons: 0,
      cost: 0,
    });
    assertEquals(line("Countermeasures Suite"), {
      name: "Countermeasures Suite",
      tons: 2,
      cost: 4,
      power: 1,
    });
    assertEquals(line("Military Countermeasures Suite"), {
      name: "Military Countermeasures Suite",
      tons: 15,
      cost: 28,
      power: 2,
    });
    assertEquals(sheet.powerUse.sensors, 10);
    design.techLevel = 11;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("Military Countermeasures Suite")
      ),
    );
  });

  it("prices deep penetration scanners, an extension net, and arrays that scale the sensor suite", () => {
    const design = blankDesign("arrays");
    design.techLevel = 12;
    design.sensors = "military";
    design.additionalSensors = [
      { id: "deep", kind: "deep", tons: 25 },
      { id: "net", kind: "extension", tons: 1 },
      { id: "rapid", kind: "rapid", tons: 1 },
      { id: "spread", kind: "distributed", tons: 1 },
    ];
    const sheet = evaluateDesign(design);
    const line = (name: string) => sheet.lines.find((row) => row.name === name);
    assertEquals(line("Deep Penetration Scanners"), {
      name: "Deep Penetration Scanners",
      tons: 25,
      cost: 25,
      power: 1,
    });
    assertEquals(line("Extension Net"), {
      name: "Extension Net",
      tons: 2,
      cost: 2,
    });
    assertEquals(line("Rapid-deployment Extended Arrays"), {
      name: "Rapid-deployment Extended Arrays",
      tons: 4,
      cost: 16.4,
      power: 4,
    });
    assertEquals(line("Distributed Arrays"), {
      name: "Distributed Arrays",
      tons: 4,
      cost: 8.2,
      power: 4,
    });
    assertEquals(sheet.powerUse.sensors, 11);
    assert(
      sheet.errors.some((error) =>
        error ===
          "Distributed Arrays can only be added to Improved or Advanced sensors."
      ),
    );
    assert(
      sheet.errors.some((error) =>
        error === "Distributed Arrays requires a hull of more than 5,000 tons."
      ),
    );

    design.hullTons = 150;
    design.additionalSensors = [{ id: "net", kind: "extension", tons: 1 }];
    assertEquals(
      evaluateDesign(design).lines.find((row) => row.name === "Extension Net"),
      { name: "Extension Net", tons: 1.5, cost: 1.5 },
    );
    design.hullTons = 50;
    assertEquals(
      evaluateDesign(design).lines.find((row) => row.name === "Extension Net")
        ?.tons,
      1,
    );

    design.hullTons = 6000;
    design.sensors = "improved";
    design.techLevel = 12;
    design.additionalSensors = [{ id: "spread", kind: "distributed", tons: 1 }];
    const improved = evaluateDesign(design);
    assertEquals(
      improved.lines.find((row) => row.name === "Distributed Arrays"),
      { name: "Distributed Arrays", tons: 6, cost: 8.6, power: 8 },
    );
    assertEquals(improved.powerUse.sensors, 12);
    assertEquals(
      improved.errors.some((error) => error.includes("Distributed Arrays")),
      false,
    );
    design.sensors = "advanced";
    design.techLevel = 15;
    const advanced = evaluateDesign(design);
    assertEquals(
      advanced.lines.find((row) => row.name === "Distributed Arrays"),
      { name: "Distributed Arrays", tons: 10, cost: 10.6, power: 12 },
    );
    assertEquals(advanced.powerUse.sensors, 18);
    design.hullTons = 5000;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error === "Distributed Arrays requires a hull of more than 5,000 tons."
      ),
    );

    design.hullTons = 6000;
    design.sensors = "improved";
    design.techLevel = 12;
    design.additionalSensors = [{ id: "rapid", kind: "rapid", tons: 1 }];
    const rapid = evaluateDesign(design);
    assertEquals(
      rapid.lines.find((row) =>
        row.name === "Rapid-deployment Extended Arrays"
      ),
      {
        name: "Rapid-deployment Extended Arrays",
        tons: 6,
        cost: 17.2,
        power: 8,
      },
    );
    assertEquals(rapid.powerUse.sensors, 12);
    assertEquals(
      rapid.errors.some((error) => error.includes("Rapid-deployment")),
      false,
    );

    design.hullTons = 200;
    design.techLevel = 9;
    design.sensors = "basic";
    design.additionalSensors = [
      { id: "deep", kind: "deep", tons: 0 },
      { id: "net", kind: "extension", tons: 1 },
      { id: "rapid", kind: "rapid", tons: 1 },
      { id: "spread", kind: "distributed", tons: 1 },
    ];
    const low = evaluateDesign(design);
    assertEquals(
      low.lines.find((row) => row.name === "Deep Penetration Scanners"),
      { name: "Deep Penetration Scanners", tons: 1, cost: 1, power: 1 },
    );
    assert(
      low.errors.some((error) =>
        error === "Deep Penetration Scanners requires tech level 13."
      ),
    );
    assert(
      low.errors.some((error) =>
        error === "Extension Net requires tech level 10."
      ),
    );
    assert(
      low.errors.some((error) =>
        error === "Rapid-deployment Extended Arrays requires tech level 11."
      ),
    );
    assert(
      low.errors.some((error) =>
        error === "Distributed Arrays requires tech level 11."
      ),
    );
  });

  it("prices a barbette at five tons and one hardpoint, or three firmpoints", () => {
    const design = blankDesign("barbette");
    design.techLevel = 12;
    design.mounts = [
      { id: "a", kind: "barbette", weapons: ["particleBarbette"] },
      { id: "b", kind: "barbette", weapons: ["particleBarbette"] },
    ];
    const sheet = evaluateDesign(design);
    assertEquals(sheet.hardpointsUsed, 2);
    assertEquals(sheet.lines.filter((line) => line.name === "Barbette"), [
      { name: "Barbette", tons: 5, cost: 0, power: 0 },
      { name: "Barbette", tons: 5, cost: 0, power: 0 },
    ]);
    assertEquals(
      sheet.lines.filter((line) => line.name === "Particle Barbette"),
      [
        { name: "Particle Barbette", tons: 0, cost: 8, power: 15 },
        { name: "Particle Barbette", tons: 0, cost: 8, power: 15 },
      ],
    );
    assertEquals(sheet.powerUse.weapons, 30);
    design.mounts = [{
      id: "a",
      kind: "barbette",
      weapons: ["fusionBarbette"],
    }];
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Fusion Barbette"
      ),
      { name: "Fusion Barbette", tons: 0, cost: 4, power: 20 },
    );
    design.mounts = [{ id: "a", kind: "barbette", weapons: ["torpedo"] }];
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Torpedo Barbette"
      ),
      { name: "Torpedo Barbette", tons: 0, cost: 3, power: 2 },
    );
    design.mounts = [{
      id: "a",
      kind: "barbette",
      weapons: ["missileBarbette"],
    }];
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Missile Barbette"
      ),
      { name: "Missile Barbette", tons: 0, cost: 4, power: 0 },
    );
    design.mounts = [{
      id: "a",
      kind: "barbette",
      weapons: ["ion"],
      popup: true,
    }];
    const ion = evaluateDesign(design);
    assertEquals(ion.lines.find((line) => line.name === "Ion Cannon"), {
      name: "Ion Cannon",
      tons: 0,
      cost: 6,
      power: 10,
    });
    assertEquals(ion.lines.find((line) => line.name === "Barbette"), {
      name: "Barbette",
      tons: 5,
      cost: 0,
      power: 0,
    });
    assertEquals(ion.errors.some((error) => error.includes("Pop-up")), false);
    design.techLevel = 8;
    design.mounts = [{ id: "a", kind: "barbette", weapons: ["beamBarbette"] }];
    assert(
      evaluateDesign(design).errors.some((error) =>
        error === "Beam Laser Barbette requires tech level 10."
      ),
    );
    design.hullTons = 80;
    design.techLevel = 12;
    design.mounts = [{
      id: "a",
      kind: "barbette",
      weapons: ["particleBarbette"],
    }];
    const boat = evaluateDesign(design);
    assertEquals(boat.hardpoints, 3);
    assertEquals(boat.hardpointsUsed, 3);
    assertEquals(
      boat.lines.find((line) => line.name === "Particle Barbette")?.power,
      12,
    );
    assertEquals(
      boat.errors.some((error) =>
        error.includes("firmpoints") || error.includes("100 tons")
      ),
      false,
    );
    design.mounts = [
      { id: "a", kind: "barbette", weapons: ["particleBarbette"] },
      { id: "b", kind: "fixed", weapons: ["pulse"] },
    ];
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("firmpoints")
      ),
    );
    design.hullTons = 40;
    design.mounts = [{
      id: "a",
      kind: "barbette",
      weapons: ["missileBarbette"],
    }];
    const small = evaluateDesign(design);
    assertEquals(small.hardpoints, 2);
    assertEquals(small.hardpointsUsed, 3);
    assert(small.errors.some((error) => error.includes("firmpoints")));
    design.hullTons = 200;
    design.mounts = [{
      id: "a",
      kind: "single",
      weapons: ["particleBarbette"],
    }];
    assertEquals(
      evaluateDesign(design).lines.some((line) =>
        line.name === "Particle Barbette" || line.name === "Beam laser"
      ),
      false,
    );
  });

  it("lists the turret weapons from the High Guard table", () => {
    assertEquals(
      TURRET_WEAPONS.map((
        weapon,
      ) => [weapon.label, weapon.tl, weapon.power, weapon.cost]),
      [
        ["Beam laser", 10, 4, 0.5],
        ["Fusion gun", 14, 12, 2],
        ["Laser drill", 8, 4, 0.15],
        ["Missile rack", 7, 0, 0.75],
        ["Particle beam", 12, 8, 4],
        ["Plasma gun", 11, 6, 2.5],
        ["Pulse laser", 9, 4, 1],
        ["Railgun", 10, 2, 1],
        ["Sandcaster", 9, 0, 0.25],
      ],
    );
  });

  it("charges nothing for fuel scoops on a streamlined hull and 1 MCr on every other hull", () => {
    const design = blankDesign("scoops");
    design.scoops = true;
    const streamlined = evaluateDesign(design);
    assertEquals(
      streamlined.lines.find((line) => line.name === "Fuel scoops")?.cost,
      0,
    );
    assertEquals(
      streamlined.errors.some((error) => error.includes("scoops")),
      false,
    );
    for (
      const configuration of [
        "standard",
        "sphere",
        "close",
        "distributed",
        "planetoid",
        "buffered",
      ] as const
    ) {
      design.configuration = configuration;
      const sheet = evaluateDesign(design);
      assertEquals(
        sheet.errors.some((error) => error.includes("scoops")),
        false,
        configuration,
      );
      assertEquals(
        sheet.lines.find((line) => line.name === "Fuel scoops")?.cost,
        1,
        configuration,
      );
    }
  });

  it("sizes a docking space at the craft plus 10 percent and leaves carried ships off the parent discount", () => {
    assertEquals(dockingSpaceTons(4), 5);
    assertEquals(dockingSpaceTons(10), 11);
    assertEquals(dockingSpaceTons(15), 17);
    assertEquals(dockingSpaceTons(20), 22);
    assertEquals(dockingSpaceTons(30), 33);
    assertEquals(dockingSpaceTons(40), 44);
    assertEquals(dockingSpaceTons(50), 55);
    const round3 = (value: number) => Math.round(value * 1000) / 1000;
    const parent = blankDesign("carrier");
    const alone = evaluateDesign(parent);
    parent.docks = [{ id: "raft", craft: "air-raft" }];
    const raft = evaluateDesign(parent);
    assertEquals(raft.errors, []);
    assertEquals(
      raft.lines.find((line) => line.name === "Docking space (Air/raft)"),
      { name: "Docking space (Air/raft)", tons: 5, cost: 1.25 },
    );
    assertEquals(raft.lines.find((line) => line.name === "Air/raft"), {
      name: "Air/raft",
      tons: 0,
      cost: 0.25,
    });
    assertEquals(raft.cargo, Math.round((alone.cargo - 5) * 100) / 100);
    parent.docks = [{ id: "open", craft: "empty", craftTons: 40 }];
    const open = evaluateDesign(parent);
    assertEquals(open.errors, []);
    assertEquals(
      open.lines.find((line) => line.name === "Docking space (40-ton berth)"),
      { name: "Docking space (40-ton berth)", tons: 44, cost: 11 },
    );
    assertEquals(
      open.lines.some((line) => line.name === "40-ton berth"),
      false,
    );
    const restored = designFromJson(JSON.parse(JSON.stringify(parent)));
    assertEquals(restored?.docks, [{
      id: "open",
      craft: "empty",
      craftTons: 40,
    }]);
    parent.docks = [{ id: "bare", craft: "empty" }];
    assert(
      evaluateDesign(parent).errors.some((error) =>
        error.includes("craft size")
      ),
    );
    assertEquals(raft.cost, round3(alone.cost + 1.5));
    parent.docks = [{ id: "atv", craft: "atv" }];
    const atv = evaluateDesign(parent);
    assertEquals(
      atv.lines.find((line) => line.name === "Docking space (ATV)"),
      { name: "Docking space (ATV)", tons: 11, cost: 2.75 },
    );
    assertEquals(atv.lines.find((line) => line.name === "ATV")?.cost, 0.155);
    parent.docks = [{ id: "buggy", craft: "prospecting-buggy" }];
    const buggy = evaluateDesign(parent);
    assertEquals(
      buggy.lines.find((line) =>
        line.name === "Docking space (Prospecting buggy)"
      ),
      { name: "Docking space (Prospecting buggy)", tons: 5, cost: 1.25 },
    );
    assertEquals(
      buggy.lines.find((line) => line.name === "Prospecting buggy"),
      { name: "Prospecting buggy", tons: 0, cost: 0.27 },
    );
    assertEquals(buggy.cargo, Math.round((alone.cargo - 5) * 100) / 100);
    parent.standardDesign = true;
    const discountedBuggy = evaluateDesign(parent);
    const buggyList = round3(
      discountedBuggy.lines.reduce((total, line) => total + line.cost, 0),
    );
    assertEquals(
      discountedBuggy.cost,
      (Math.round(buggyList * 1000) * 9) / 10000,
    );
    parent.standardDesign = false;
    const pinnace = STANDARD_DESIGNS.find((row) => row.name === "Slow Pinnace");
    assert(pinnace);
    parent.standardDesign = true;
    parent.docks = [{ id: "bay", craft: pinnace.id }];
    const discounted = evaluateDesign(parent, STANDARD_DESIGNS);
    assertEquals(discounted.errors, []);
    assertEquals(
      discounted.lines.find((line) =>
        line.name === "Docking space (Slow Pinnace)"
      ),
      { name: "Docking space (Slow Pinnace)", tons: 44, cost: 11 },
    );
    assertEquals(
      discounted.lines.find((line) => line.name === "Slow Pinnace")?.cost,
      5.967,
    );
    const structure = round3(
      discounted.lines.filter((line) => !line.carried).reduce(
        (total, line) => total + line.cost,
        0,
      ),
    );
    const structureThousandths = Math.round(structure * 1000);
    assertEquals(
      discounted.cost,
      (structureThousandths * 9 + Math.round(5.967 * 10000)) / 10000,
    );
    parent.standardDesign = false;
    const listed = evaluateDesign(parent, STANDARD_DESIGNS);
    assertEquals(
      listed.lines.find((line) => line.name === "Slow Pinnace")?.cost,
      5.967,
    );
    assertEquals(
      Math.round((listed.cost - discounted.cost) * 10000),
      Math.round(structure * 0.1 * 10000),
    );
    parent.docks = [{ id: "gone", craft: "missing-ship" }];
    assert(
      evaluateDesign(parent).errors.some((error) =>
        error.includes("missing-ship")
      ),
    );
    const left = blankDesign("left");
    const right = blankDesign("right");
    left.docks = [{ id: "out", craft: right.id }];
    right.docks = [{ id: "back", craft: left.id }];
    const loop = evaluateDesign(left, [left, right]);
    assert(
      loop.errors.some((error) =>
        error.includes("already part of this design")
      ),
    );
  });

  it("prices drone sets and sizes repair drones from the hull", () => {
    assertEquals(repairDroneTons(40), 1);
    assertEquals(repairDroneTons(200), 2);
    assertEquals(repairDroneTons(250), 2.5);
    const design = blankDesign("drones");
    design.techLevel = 12;
    design.drones = [
      { id: "probe-1", kind: "probe", quantity: 2 },
      { id: "probe-2", kind: "probe", quantity: 1 },
      { id: "mine-1", kind: "mining", quantity: 1 },
      { id: "adv-1", kind: "advanced", quantity: 3 },
      { id: "repair-1", kind: "repair", quantity: 4 },
    ];
    const sheet = evaluateDesign(design);
    assertEquals(sheet.lines.find((line) => line.name === "Probe drones ×10"), {
      name: "Probe drones ×10",
      tons: 2,
      cost: 1,
    });
    assertEquals(
      sheet.lines.filter((line) => line.name.startsWith("Probe drones")).length,
      1,
    );
    assertEquals(sheet.lines.find((line) => line.name === "Mining drones ×5"), {
      name: "Mining drones ×5",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Advanced probe drones ×15"),
      { name: "Advanced probe drones ×15", tons: 3, cost: 2.4 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Repair drones"), {
      name: "Repair drones",
      tons: 2,
      cost: 0.4,
    });
    assertEquals(sheet.errors, []);
    design.hullTons = 40;
    assertEquals(
      evaluateDesign(design).lines.find((line) =>
        line.name === "Repair drones"
      ),
      { name: "Repair drones", tons: 1, cost: 0.2 },
    );
    design.hullTons = 200;
    design.techLevel = 8;
    const early = evaluateDesign(design);
    assert(
      early.errors.some((error) =>
        error.includes("Probe drones require tech level 9")
      ),
    );
    assert(
      early.errors.some((error) =>
        error.includes("Mining drones require tech level 12")
      ),
    );
    assert(
      early.errors.some((error) =>
        error.includes("Repair drones require tech level 10")
      ),
    );
    design.techLevel = 12;
    design.standardDesign = true;
    const discounted = evaluateDesign(design);
    design.standardDesign = false;
    const full = evaluateDesign(design);
    assertEquals(discounted.cost, (Math.round(full.cost * 1000) * 9) / 10000);
  });

  it("sizes jump and manoeuvre drives from the High Guard potential tables", () => {
    assertEquals(manoeuvreDriveTons(40, 3), 1.2);
    assertEquals(manoeuvreDriveTons(200, 0), 1);
    assertEquals(manoeuvreDriveTons(10, 6), 0.6);
    assertEquals(jumpDriveTons(200, 1), 10);
    assertEquals(jumpDriveTons(200, 2), 15);
    assertEquals(jumpDriveTons(100, 1), 10);
    assertEquals(jumpDriveTons(400, 1), 15);
    assertEquals(jumpDriveTons(400, 2), 25);
    assertEquals(jumpDriveTons(400, 3), 35);
    assertEquals(jumpDriveTons(600, 3), 50);
    assertEquals(jumpDriveTons(800, 3), 65);
    const design = blankDesign("drives");
    design.hullTons = 400;
    design.techLevel = 12;
    design.thrust = 4;
    design.jump = 3;
    design.power = 1000;
    const sheet = evaluateDesign(design);
    assertEquals(
      sheet.lines.find((line) => line.name === "Manoeuvre drive 4"),
      { name: "Manoeuvre drive 4", tons: 16, cost: 32, power: 160 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Jump drive 3"), {
      name: "Jump drive 3",
      tons: 35,
      cost: 52.5,
      power: 120,
    });
    design.hullTons = 200;
    design.thrust = 0;
    design.jump = 2;
    design.techLevel = 11;
    const station = evaluateDesign(design);
    assertEquals(
      station.lines.find((line) => line.name === "Manoeuvre drive 0"),
      { name: "Manoeuvre drive 0", tons: 1, cost: 2, power: 5 },
    );
    assertEquals(station.lines.find((line) => line.name === "Jump drive 2"), {
      name: "Jump drive 2",
      tons: 15,
      cost: 22.5,
      power: 40,
    });
    design.techLevel = 10;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("Jump 2 requires tech level 11")
      ),
    );
    design.thrust = 2;
    design.techLevel = 9;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("Thrust 2 requires tech level 10")
      ),
    );
    design.thrust = 12;
    design.jump = 10;
    const over = evaluateDesign(design);
    assert(over.errors.some((error) => error.includes("Thrust is above 11")));
    assert(over.errors.some((error) => error.includes("Jump is above 9")));
    assertEquals(
      over.lines.some((line) => line.name.startsWith("Manoeuvre drive")),
      false,
    );
    assertEquals(
      over.lines.some((line) => line.name.startsWith("Jump drive")),
      false,
    );
  });

  it("omits the jump drive on a hull below 100 tons", () => {
    const design = blankDesign("launch");
    design.hullTons = 50;
    design.jump = 2;
    design.thrust = 4;
    design.power = 100;
    const sheet = evaluateDesign(design);
    assertEquals(
      sheet.lines.some((line) => line.name.startsWith("Jump drive")),
      false,
    );
    assertEquals(sheet.jumpFuel, 0);
    assertEquals(sheet.powerUse.jump, 0);
    assertEquals(sheet.errors.filter((error) => error.includes("Jump")), []);
    design.hullTons = 100;
    assertEquals(
      evaluateDesign(design).lines.find((line) => line.name === "Jump drive 2")
        ?.tons,
      jumpDriveTons(100, 2),
    );
  });

  it("prices cargo cranes, loading belts, external mounts, and jump nets", () => {
    assertEquals(cargoHandlingTons(84, true), { craneTons: 3, jumpNetTons: 0 });
    assertEquals(cargoHandlingTons(153, true), {
      craneTons: 3,
      jumpNetTons: 0,
    });
    assertEquals(cargoHandlingTons(190.5, true), {
      craneTons: 3.5,
      jumpNetTons: 0,
    });
    assertEquals(cargoHandlingTons(220, true), {
      craneTons: 3.5,
      jumpNetTons: 0,
    });
    assertEquals(jumpNetTons(40), 0.4);
    assertEquals(jumpNetTons(100), 1);
    assertEquals(jumpNetTons(250), 2.5);
    assertEquals(cargoHandlingTons(200, false, jumpNetTons(100)), {
      craneTons: 0,
      jumpNetTons: 1,
    });
    const design = blankDesign("cargo");
    design.jump = 1;
    design.power = 80;
    const before = evaluateDesign(design);
    design.cargoGear = [{ id: "crane", kind: "crane", quantity: 1 }];
    const crane = evaluateDesign(design);
    assertEquals(crane.lines.find((line) => line.name === "Cargo crane"), {
      name: "Cargo crane",
      tons: 3,
      cost: 3,
    });
    assertEquals(crane.cargo, Math.round((before.cargo - 3) * 100) / 100);
    design.cargoGear = [
      { id: "belt", kind: "belt", quantity: 2 },
      { id: "belt12", kind: "belt12", quantity: 1 },
    ];
    design.techLevel = 12;
    design.power = 200;
    const belts = evaluateDesign(design);
    assertEquals(belts.lines.find((line) => line.name === "Loading belt ×2"), {
      name: "Loading belt ×2",
      tons: 1,
      cost: 0.006,
      power: 2,
    });
    assertEquals(
      belts.lines.find((line) => line.name === "Loading belt (TL12)"),
      { name: "Loading belt (TL12)", tons: 1, cost: 0.01, power: 1 },
    );
    assertEquals(belts.powerUse.fittings, before.powerUse.fittings + 3);
    design.techLevel = 11;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("Loading belt (TL12) requires tech level 12")
      ),
    );
    design.techLevel = 12;
    design.configuration = "standard";
    design.cargoGear = [{ id: "mount", kind: "external", quantity: 40 }];
    const mount = evaluateDesign(design);
    assertEquals(
      mount.lines.find((line) => line.name === "External cargo mount"),
      { name: "External cargo mount", tons: 0, cost: 0.04 },
    );
    assertEquals(
      mount.errors.some((error) => error.includes("External cargo")),
      false,
    );
    design.configuration = "streamlined";
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("streamlined or dispersed")
      ),
    );
    design.configuration = "distributed";
    assert(
      evaluateDesign(design).errors.some((error) =>
        error.includes("streamlined or dispersed")
      ),
    );
    design.configuration = "standard";
    design.cargoGear = [{ id: "net", kind: "jumpNet", quantity: 250 }];
    design.techLevel = 9;
    const early = evaluateDesign(design);
    assert(
      early.errors.some((error) =>
        error.includes("Interstellar jump net requires tech level 10")
      ),
    );
    assertEquals(
      early.lines.find((line) => line.name === "Interstellar jump net"),
      { name: "Interstellar jump net", tons: 2.5, cost: 0.75 },
    );
    design.techLevel = 12;
    const net = evaluateDesign(design);
    const open = evaluateDesign({ ...design, cargoGear: [] });
    assertEquals(
      net.lines.find((line) => line.name === "Interstellar jump net"),
      { name: "Interstellar jump net", tons: 2.5, cost: 0.75 },
    );
    assertEquals(net.cargo, Math.round((open.cargo - 2.5) * 100) / 100);
    assertEquals(net.errors.filter((error) => error.includes("jump net")), []);
    design.cargoGear = [
      { id: "mount", kind: "external", quantity: 40 },
      { id: "net", kind: "jumpNet", quantity: 250 },
    ];
    const covered = evaluateDesign(design);
    assertEquals(
      covered.lines.find((line) => line.name === "Interstellar jump net"),
      { name: "Interstellar jump net", tons: 2.5, cost: 0.75 },
    );
    assertEquals(
      covered.lines.find((line) => line.name === "External cargo mount")?.cost,
      0.04,
    );
    design.cargoGear = [{ id: "local", kind: "planetaryNet", quantity: 250 }];
    design.techLevel = 7;
    design.jump = 1;
    const earlyPlanet = evaluateDesign(design);
    assert(
      earlyPlanet.errors.some((error) =>
        error.includes("Interplanetary jump net requires tech level 8")
      ),
    );
    assert(
      earlyPlanet.errors.some((error) =>
        error ===
          "A ship cannot jump while an interplanetary jump net is deployed."
      ),
    );
    assertEquals(
      earlyPlanet.lines.find((line) => line.name === "Interplanetary jump net"),
      { name: "Interplanetary jump net", tons: 2.5, cost: 0.25 },
    );
    design.techLevel = 8;
    design.jump = 0;
    const planet = evaluateDesign(design);
    const withoutNet = evaluateDesign({ ...design, cargoGear: [] });
    assertEquals(
      planet.lines.find((line) => line.name === "Interplanetary jump net"),
      { name: "Interplanetary jump net", tons: 2.5, cost: 0.25 },
    );
    assertEquals(
      planet.cargo,
      Math.round((withoutNet.cargo - 2.5) * 100) / 100,
    );
    assertEquals(
      planet.errors.filter((error) =>
        error.includes("jump net") || error.includes("Interplanetary")
      ),
      [],
    );
  });

  it("calculates a combined breakaway sheet without storing a design", () => {
    const primary = blankDesign("primary");
    primary.name = "Carrier";
    primary.techLevel = 12;
    primary.hullTons = 200;
    primary.configuration = "streamlined";
    primary.hullType = "standard";
    primary.thrust = 1;
    primary.jump = 1;
    primary.power = 75;
    primary.powerPlant = "fusion12";
    primary.armour = "crystaliron";
    primary.armourRating = 4;
    primary.computer = "core5";
    primary.sensors = "civilian";
    primary.staterooms = 4;
    primary.commonTons = 0;
    primary.lowBerths = 0;
    primary.software = [];
    primary.scoops = false;
    primary.hullOptions = [{ id: "join", kind: "breakaway" }, {
      id: "fins",
      kind: "aerofins",
    }];
    const section = blankDesign("section");
    section.name = "Section";
    section.techLevel = 12;
    section.hullTons = 100;
    section.configuration = "planetoid";
    section.hullType = "light";
    section.thrust = 4;
    section.jump = 2;
    section.power = 40;
    section.powerPlant = "fusion8";
    section.armour = "titanium";
    section.armourRating = 1;
    section.computer = "core15";
    section.sensors = "military";
    section.bridge = "cockpit";
    section.staterooms = 2;
    section.commonTons = 0;
    section.lowBerths = 0;
    section.software = [];
    section.scoops = false;
    section.hullOptions = [{ id: "join", kind: "breakaway" }];
    const primarySheet = evaluateDesign(primary);
    const sectionSheet = evaluateDesign(section);
    const { design, sheet } = combinedBreakaway([primary, section]);
    assertEquals(design.name, "Carrier Combined");
    assertEquals(design.breakawayHulls, []);
    assertEquals(primary.hullOptions.map((option) => option.kind), [
      "breakaway",
      "aerofins",
    ]);
    assertEquals(sheet.lines.find((line) => line.name.endsWith(" hull")), {
      name: "Light Hull, Planetoid hull",
      tons: 300,
      cost: (primarySheet.lines.find((line) =>
        line.name.endsWith(" hull")
      )?.cost ?? 0) + (sectionSheet.lines.find((line) =>
        line.name.endsWith(" hull")
      )?.cost ?? 0),
      power: (primarySheet.lines.find((line) =>
        line.name.endsWith(" hull")
      )?.power ?? 0) + (sectionSheet.lines.find((line) =>
        line.name.endsWith(" hull")
      )?.power ?? 0),
    });
    assertEquals(sheet.lines.some((line) => line.name === "Aerofins"), false);
    const breakaway = sheet.lines.find((line) =>
      line.name === "Breakaway Hull"
    );
    assertEquals(
      breakaway?.tons,
      (primarySheet.lines.find((line) => line.name === "Breakaway Hull")
        ?.tons ?? 0) +
        (sectionSheet.lines.find((line) => line.name === "Breakaway Hull")
          ?.tons ?? 0),
    );
    assertEquals(
      sheet.lines.find((line) => line.name.startsWith("Manoeuvre drive "))
        ?.name,
      "Manoeuvre drive 2",
    );
    assertEquals(
      sheet.lines.find((line) => line.name.startsWith("Manoeuvre drive "))
        ?.power,
      primarySheet.powerUse.maneuver + sectionSheet.powerUse.maneuver,
    );
    assertEquals(
      sheet.lines.find((line) => line.name.startsWith("Jump drive "))?.name,
      "Jump drive 1",
    );
    assertEquals(
      sheet.lines.find((line) => line.name.startsWith("Jump drive "))?.power,
      primarySheet.powerUse.jump + sectionSheet.powerUse.jump,
    );
    assertEquals(
      sheet.lines.find((line) => line.role === "armour")?.name,
      "mixed armor",
    );
    assertEquals(
      sheet.armourRating,
      Math.min(primarySheet.armourRating, sectionSheet.armourRating),
    );
    assertEquals(
      sheet.lines.find((line) =>
        line.name === "Fusion (TL8)" || line.name === "Fusion (TL12)" ||
        line.name === "mixed"
      )?.name,
      "mixed",
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "mixed" && line.power != null)
        ?.power,
      115,
    );
    assertEquals(
      sheet.lines.find((line) => line.name.startsWith("Computer/"))?.name,
      "Computer/15",
    );
    assertEquals(
      sheet.lines.find((line) => line.name.endsWith(" sensors"))?.name,
      "Military sensors",
    );
    assertEquals(
      sheet.lines.find((line) =>
        line.name === "Bridge" || line.name === "Single cockpit"
      )?.name,
      "Bridge",
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Staterooms")?.tons,
      (primarySheet.lines.find((line) => line.name === "Staterooms")?.tons ??
        0) +
        (sectionSheet.lines.find((line) => line.name === "Staterooms")?.tons ??
          0),
    );
    assertEquals(
      sheet.cost,
      Math.round((primarySheet.cost + sectionSheet.cost) * 10000) / 10000,
    );
    const repeated = combinedBreakaway([primary, section, section]);
    assertEquals(
      repeated.sheet.lines.find((line) => line.name.endsWith(" hull"))?.tons,
      400,
    );
    section.powerPlant = "fusion12";
    const samePlant = combinedBreakaway([primary, section]).sheet;
    assertEquals(
      samePlant.lines.find((line) =>
        line.power === 115 &&
        (line.name === "Fusion (TL12)" || line.name === "mixed")
      )?.name,
      "Fusion (TL12)",
    );
  });

  it("divides summed manoeuvre potential by the joined hull", () => {
    const tulwar = blankDesign("tulwar");
    tulwar.hullTons = 180;
    tulwar.thrust = 1;
    tulwar.jump = 0;
    tulwar.driveCustom = {
      thrust: { tier: "standard", options: [], effectiveTons: 240 },
      jump: { tier: "standard", options: [] },
      plant: { tier: "standard", options: [] },
    };
    const cutlass = blankDesign("cutlass");
    cutlass.hullTons = 30;
    cutlass.thrust = 8;
    cutlass.jump = 0;
    assertEquals(evaluateDesign(tulwar).thrustRating, 1);
    const combined = combinedBreakaway([tulwar, cutlass, cutlass]);
    assertEquals(combined.design.hullTons, 240);
    assertEquals(combined.sheet.thrustRating, 3);
    assertEquals(
      combined.sheet.lines.find((line) =>
        line.name.startsWith("Manoeuvre drive ")
      )?.name,
      "Manoeuvre drive 3",
    );
  });

  it("prices a modular hull as the same tonnage of the containing hull", () => {
    const ship = blankDesign("carrier");
    ship.hullTons = 200;
    ship.techLevel = 12;
    ship.hullOptions = [{ id: "bay", kind: "modular", tons: 150, modules: [] }];
    assertEquals(
      evaluateDesign(ship).lines.find((line) => line.name === "Modular Hull"),
      { name: "Modular Hull", tons: 150, cost: 9 },
    );
    ship.hullOptions = [{ id: "bay", kind: "modular", tons: 160, modules: [] }];
    const over = evaluateDesign(ship);
    assert(
      over.errors.some((error) =>
        error === "A modular hull cannot exceed 75% of the hull (150 tons)."
      ),
    );
    assertEquals(
      over.lines.find((line) => line.name === "Modular Hull")?.tons,
      150,
    );
    const pod = blankModule("pod");
    pod.name = "Pod";
    pod.hullTons = 150;
    pod.techLevel = 12;
    const extra = blankModule("extra");
    extra.name = "Extra";
    extra.hullTons = 150;
    extra.techLevel = 12;
    ship.hullOptions = [{
      id: "bay",
      kind: "modular",
      tons: 150,
      modules: ["pod"],
    }];
    const podSheet = evaluateDesign(pod);
    const withPod = evaluateDesign(ship, [pod]);
    const podIndex = withPod.lines.findIndex((line) =>
      line.name === "Modular Hull"
    );
    assertEquals(withPod.lines[podIndex + 1], {
      name: "Pod",
      tons: 150,
      cost: podSheet.cost,
      power: podSheet.powerUse.total,
      carried: true,
      fold: "hull",
    });
    const bare = evaluateDesign({
      ...ship,
      hullOptions: [{ id: "bay", kind: "modular", tons: 150, modules: [] }],
    });
    assertEquals(
      Math.round(withPod.cost * 10000),
      Math.round(bare.cost * 10000) + Math.round(podSheet.cost * 1000) * 10,
    );
    assertEquals(
      withPod.powerUse.total,
      bare.powerUse.total + podSheet.powerUse.total,
    );
    assertEquals(withPod.powerRequired, withPod.powerUse.total);
    assertEquals(
      withPod.powerUse.base,
      bare.powerUse.base + podSheet.powerUse.base,
    );
    assertEquals(
      withPod.powerUse.fittings,
      bare.powerUse.fittings + podSheet.powerUse.fittings,
    );
    assertEquals(
      withPod.warnings.some((warning) => warning.includes("power points")),
      false,
    );
    assertEquals(withPod.cargo, bare.cargo);
    assertEquals(
      withPod.errors.filter((error) =>
        error.includes("module") || error.includes("Pod")
      ),
      [],
    );
    pod.hullTons = 100;
    const short = evaluateDesign(ship, [pod]);
    assert(
      short.errors.some((error) =>
        error === "Pod is 100 tons and this module bay is 150 tons."
      ),
    );
    pod.hullTons = 150;
    ship.hullOptions = [{
      id: "bay",
      kind: "modular",
      tons: 150,
      modules: ["pod", "extra"],
    }];
    const both = evaluateDesign(ship, [pod, extra]);
    const bothIndex = both.lines.findIndex((line) =>
      line.name === "Modular Hull"
    );
    assertEquals(
      both.lines.slice(bothIndex, bothIndex + 2).map((line) => line.name),
      ["Modular Hull", "Pod"],
    );
    assert(
      both.errors.some((error) => error === "A module bay holds one module."),
    );
    const advanced = blankModule("advanced");
    advanced.name = "Advanced pod";
    advanced.hullTons = 150;
    advanced.techLevel = 14;
    ship.hullOptions = [{
      id: "bay",
      kind: "modular",
      tons: 150,
      modules: ["advanced"],
    }];
    assert(
      evaluateDesign(ship, [advanced]).errors.some((error) =>
        error === "Advanced pod requires tech level 14."
      ),
    );
    ship.hullType = "light";
    ship.hullOptions = [{ id: "bay", kind: "modular", tons: 150, modules: [] }];
    assertEquals(
      evaluateDesign(ship).lines.find((line) => line.name === "Modular Hull")
        ?.cost,
      6.75,
    );
    ship.hullType = "standard";
    ship.configuration = "planetoid";
    assertEquals(
      evaluateDesign(ship).lines.find((line) => line.name === "Modular Hull")
        ?.cost,
      0.6,
    );
    ship.configuration = "standard";
    ship.hullType = "standard";
    ship.hullOptions = [
      { id: "forward", kind: "modular", tons: 80, modules: [] },
      { id: "aft", kind: "modular", tons: 70, modules: [] },
    ];
    assertEquals(
      evaluateDesign(ship).lines.filter((line) => line.name === "Modular Hull")
        .map((line) => line.tons),
      [80, 70],
    );
    ship.hullOptions = [
      { id: "forward", kind: "modular", tons: 100, modules: [] },
      { id: "aft", kind: "modular", tons: 100, modules: [] },
    ];
    const split = evaluateDesign(ship);
    assert(
      split.errors.filter((error) =>
        error === "A modular hull cannot exceed 75% of the hull (150 tons)."
      ).length === 1,
    );
    assertEquals(
      split.lines.filter((line) => line.name === "Modular Hull").map((line) =>
        line.tons
      ),
      [100, 50],
    );
  });

  it("applies High Guard customisation to the drives and power plant", () => {
    const ship = blankDesign("custom");
    ship.hullTons = 200;
    ship.thrust = 1;
    ship.jump = 1;
    ship.power = 80;
    ship.powerPlant = "fusion12";
    ship.techLevel = 12;
    const plain = evaluateDesign(ship);
    assertEquals(plain.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 10,
      cost: 15,
      power: 20,
    });
    assertEquals(
      plain.lines.find((line) => line.name === "Fusion (TL12)")?.power,
      80,
    );
    assertEquals(plain.jumpFuel, 20);

    ship.driveCustom = {
      thrust: { tier: "advanced", options: ["energyEfficient"] },
      jump: { tier: "advanced", options: ["energyEfficient"] },
      plant: { tier: "standard", options: [] },
    };
    const efficient = evaluateDesign(ship);
    assertEquals(
      efficient.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4.4, power: 15 },
    );
    assertEquals(efficient.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 10,
      cost: 16.5,
      power: 15,
    });

    ship.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: { tier: "early", options: ["increasedSize", "energyInefficient"] },
      plant: { tier: "standard", options: [] },
    };
    const early = evaluateDesign(ship);
    assertEquals(early.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 22.5,
      cost: 165,
      power: 26,
    });
    assertEquals(
      early.errors.some((error) => error === "Jump 1 requires tech level 7."),
      false,
    );

    ship.techLevel = 6;
    assert(
      evaluateDesign(ship).errors.some((error) =>
        error === "Jump 1 requires tech level 7."
      ),
    );
    ship.techLevel = 12;

    ship.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: {
        tier: "advanced",
        options: ["sizeReduction", "decreasedFuel", "energyInefficient"],
      },
      plant: { tier: "standard", options: [] },
    };
    const reduced = evaluateDesign(ship);
    assertEquals(
      reduced.lines.find((line) => line.name === "Jump drive 1")?.tons,
      9,
    );
    assertEquals(
      reduced.lines.find((line) => line.name === "Jump drive 1")?.cost,
      16.5,
    );
    assertEquals(
      reduced.lines.find((line) => line.name === "Jump drive 1")?.power,
      20,
    );
    assertEquals(reduced.jumpFuel, 20);

    ship.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: { tier: "very", options: ["decreasedFuel", "sizeReduction"] },
      plant: { tier: "very", options: ["increasedPower"] },
    };
    const mixed = evaluateDesign(ship);
    assertEquals(
      mixed.lines.find((line) => line.name === "Jump drive 1")?.tons,
      9,
    );
    assertEquals(
      mixed.lines.find((line) => line.name === "Jump drive 1")?.cost,
      18.75,
    );
    assertEquals(mixed.jumpFuel, 19);
    const plant = mixed.lines.find((line) => line.name === "Fusion (TL12)");
    assertEquals(plant?.power, 88);
    assertEquals(
      plant?.tons,
      plain.lines.find((line) => line.name === "Fusion (TL12)")?.tons,
    );
    assertEquals(plant?.cost, 6.68);

    ship.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: { tier: "standard", options: [] },
      plant: { tier: "budget", options: ["energyInefficient"] },
    };
    const budget = evaluateDesign(ship);
    assertEquals(
      budget.lines.find((line) => line.name === "Fusion (TL12)")?.power,
      60,
    );
    assertEquals(
      budget.lines.find((line) => line.name === "Fusion (TL12)")?.cost,
      4.01,
    );
    assertEquals(
      budget.warnings.some((warning) => warning.includes("power points")),
      false,
    );

    ship.driveCustom = {
      thrust: { tier: "very", options: ["energyEfficient", "energyEfficient"] },
      jump: { tier: "standard", options: [] },
      plant: { tier: "standard", options: [] },
    };
    const twice = evaluateDesign(ship);
    assertEquals(
      twice.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 5, power: 10 },
    );

    ship.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: {
        tier: "high",
        options: ["sizeReduction", "sizeReduction", "sizeReduction"],
      },
      plant: { tier: "standard", options: [] },
    };
    const stacked = evaluateDesign(ship);
    assertEquals(
      stacked.lines.find((line) => line.name === "Jump drive 1")?.tons,
      7,
    );
    assertEquals(
      stacked.lines.find((line) => line.name === "Jump drive 1")?.cost,
      22.5,
    );
    assertEquals(
      legalCustomOptions(DRIVE_OPTIONS.jump, {
        tier: "very",
        options: ["sizeReduction", "sizeReduction", "sizeReduction"],
      }).length,
      2,
    );
  });

  it("sizes jump and manoeuvre drives from effective tonnage", () => {
    const ship = blankDesign("rated");
    ship.hullTons = 200;
    ship.thrust = 1;
    ship.jump = 1;
    ship.power = 80;
    ship.powerPlant = "fusion12";
    ship.techLevel = 12;
    const plain = evaluateDesign(ship);
    assertEquals(
      plain.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(plain.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 10,
      cost: 15,
      power: 20,
    });
    assertEquals(plain.jumpFuel, 20);

    ship.driveCustom = {
      thrust: { tier: "standard", options: [], effectiveTons: 100 },
      jump: { tier: "standard", options: [], effectiveTons: 400 },
      plant: { tier: "standard", options: [] },
    };
    const rated = evaluateDesign(ship);
    assertEquals(rated.thrustRating, 1);
    assertEquals(rated.jumpRating, 2);
    assertEquals(
      rated.lines.find((line) => line.name === "Manoeuvre drive 1"),
      { name: "Manoeuvre drive 1", tons: 2, cost: 4, power: 20 },
    );
    assertEquals(
      rated.lines.find((line) => line.name === "Jump drive 1 (400 tons)"),
      { name: "Jump drive 1 (400 tons)", tons: 15, cost: 22.5, power: 40 },
    );
    assertEquals(rated.jumpFuel, 40);
    ship.techLevel = 9;
    assertEquals(
      evaluateDesign(ship).errors.includes("Jump 2 requires tech level 11."),
      true,
    );
    ship.techLevel = 12;

    ship.driveCustom.jump = {
      tier: "advanced",
      options: ["decreasedFuel"],
      effectiveTons: 400,
    };
    assertEquals(evaluateDesign(ship).jumpFuel, 38);

    ship.driveCustom.thrust = {
      tier: "standard",
      options: [],
      effectiveTons: 400,
    };
    ship.driveCustom.jump = { tier: "standard", options: [] };
    const heavy = evaluateDesign(ship);
    assertEquals(heavy.thrustRating, 2);
    assertEquals(heavy.jumpRating, 1);
    assertEquals(
      heavy.lines.find((line) => line.name === "Manoeuvre drive 1 (400 tons)"),
      { name: "Manoeuvre drive 1 (400 tons)", tons: 4, cost: 8, power: 40 },
    );
    assertEquals(heavy.lines.find((line) => line.name === "Jump drive 1"), {
      name: "Jump drive 1",
      tons: 10,
      cost: 15,
      power: 20,
    });
    assertEquals(heavy.jumpFuel, 20);

    const stored = designFromJson({
      id: "rated",
      name: "Rated",
      hullTons: 200,
      thrust: 1,
      jump: 1,
      power: 80,
      powerPlant: "fusion12",
      techLevel: 12,
      driveCustom: {
        thrust: { tier: "standard", options: [], effectiveTons: 400 },
        jump: { tier: "standard", options: [], effectiveTons: 50.4 },
        plant: { tier: "standard", options: [] },
      },
    });
    assertEquals(stored?.driveCustom?.thrust.effectiveTons, 400);
    assertEquals(stored?.driveCustom?.jump.effectiveTons, 50);
    assertEquals(
      evaluateDesign(stored!).lines.find((line) => line.name === "Jump drive 1")
        ?.tons,
      10,
    );

    ship.hullTons = 200;
    ship.thrust = 1;
    ship.jump = 2;
    ship.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: { tier: "standard", options: [], effectiveTons: 250 },
      plant: { tier: "standard", options: [] },
    };
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name.startsWith("Jump drive ")
      )?.name,
      "Jump drive 2 (250 tons)",
    );
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name.startsWith("Manoeuvre drive ")
      )?.name,
      "Manoeuvre drive 1",
    );
  });

  it("customises each fitted weapon from the High Guard weapon table", () => {
    const ship = blankDesign("guns");
    ship.hullTons = 200;
    ship.techLevel = 12;
    ship.mounts = [{
      id: "turret",
      kind: "double",
      weapons: ["pulse", "missile"],
      custom: [
        { tier: "advanced", options: ["energyEfficient"] },
        { tier: "budget", options: ["inaccurate", "highYield"] },
      ],
    }];
    const sheet = evaluateDesign(ship);
    assertEquals(sheet.lines.find((line) => line.name === "Pulse laser"), {
      name: "Pulse laser",
      tons: 0,
      cost: 1.1,
      power: 3,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Missile rack"), {
      name: "Missile rack",
      tons: 0,
      cost: 0.56,
      power: 0,
    });
    assertEquals(
      sheet.errors.filter((error) =>
        error.includes("Pulse laser") || error.includes("Missile rack")
      ),
      [],
    );

    ship.mounts = [{
      id: "turret",
      kind: "single",
      weapons: ["pulse"],
      custom: [{ tier: "very", options: ["intenseFocus"] }],
    }];
    const focused = evaluateDesign(ship);
    assertEquals(focused.lines.find((line) => line.name === "Pulse laser"), {
      name: "Pulse laser",
      tons: 0,
      cost: 1.25,
      power: 4,
    });

    ship.techLevel = 12;
    ship.mounts = [{
      id: "turret",
      kind: "triple",
      weapons: ["pulse", "missile", "pulse"],
    }];
    const repeated = evaluateDesign(ship);
    assertEquals(
      repeated.lines.find((line) => line.name === "Pulse laser x2"),
      { name: "Pulse laser x2", tons: 0, cost: 2, power: 8 },
    );
    assertEquals(repeated.lines.find((line) => line.name === "Missile rack"), {
      name: "Missile rack",
      tons: 0,
      cost: 0.75,
      power: 0,
    });
    assertEquals(
      repeated.lines.some((line) => line.name === "Pulse laser"),
      false,
    );
    ship.mounts = [{
      id: "fixed",
      kind: "fixed",
      weapons: ["pulse", "pulse", "pulse"],
    }];
    const fixedRepeated = evaluateDesign(ship);
    assertEquals(
      fixedRepeated.lines.find((line) => line.name === "Pulse laser x3"),
      { name: "Pulse laser x3", tons: 0, cost: 3, power: 12 },
    );
    assertEquals(
      fixedRepeated.lines.some((line) => line.name === "Pulse laser"),
      false,
    );

    ship.techLevel = 6;
    ship.mounts = [{
      id: "turret",
      kind: "single",
      weapons: ["pulse"],
      custom: [{ tier: "early", options: ["energyInefficient"] }],
    }];
    assert(
      evaluateDesign(ship).errors.some((error) =>
        error === "Pulse laser requires tech level 7."
      ),
    );

    const small = blankDesign("small-guns");
    small.hullTons = 40;
    small.techLevel = 12;
    small.mounts = [{
      id: "fixed",
      kind: "fixed",
      weapons: ["pulse"],
      custom: [{
        tier: "advanced",
        options: ["energyEfficient", "sizeReduction"],
      }],
    }];
    assertEquals(
      evaluateDesign(small).lines.find((line) => line.name === "Pulse laser")
        ?.power,
      2,
    );
  });

  it("prices pop-up mounting at one ton and MCr 1 from tech level 10", () => {
    const ship = blankDesign("popup");
    ship.hullTons = 200;
    ship.techLevel = 12;
    ship.mounts = [
      { id: "turret", kind: "single", weapons: ["pulse"], popup: true },
      { id: "fixed", kind: "fixed", weapons: ["beam"] },
    ];
    const sheet = evaluateDesign(ship);
    assertEquals(
      sheet.lines.find((line) => line.name === "Single turret (pop-up)"),
      { name: "Single turret (pop-up)", tons: 2, cost: 1.2, power: 1 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Fixed mount"), {
      name: "Fixed mount",
      tons: 0,
      cost: 0.1,
      power: 0,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Pulse laser")?.power,
      4,
    );
    assertEquals(sheet.errors.some((error) => error.includes("Pop-up")), false);
    assertEquals(exteriorAppearsUnarmed(ship.mounts, ship.hullTons), false);

    ship.mounts = [{
      id: "fixed",
      kind: "fixed",
      weapons: ["pulse"],
      popup: true,
    }];
    const fixed = evaluateDesign(ship);
    assertEquals(
      fixed.lines.find((line) => line.name === "Fixed mount (pop-up)"),
      { name: "Fixed mount (pop-up)", tons: 1, cost: 1.1, power: 0 },
    );
    assertEquals(exteriorAppearsUnarmed(ship.mounts, ship.hullTons), true);

    ship.mounts = [
      { id: "a", kind: "double", weapons: ["pulse"], popup: true },
      { id: "b", kind: "single", weapons: ["beam"] },
    ];
    assertEquals(exteriorAppearsUnarmed(ship.mounts, ship.hullTons), false);
    ship.mounts = [{ id: "empty", kind: "triple", weapons: [], popup: true }];
    assertEquals(exteriorAppearsUnarmed(ship.mounts, ship.hullTons), false);
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Triple turret (pop-up)"
      ),
      { name: "Triple turret (pop-up)", tons: 2, cost: 2, power: 1 },
    );

    ship.techLevel = 9;
    ship.mounts = [{
      id: "turret",
      kind: "single",
      weapons: ["pulse"],
      popup: true,
    }];
    assertEquals(
      evaluateDesign(ship).errors.includes(
        "Pop-up mounting requires tech level 10.",
      ),
      true,
    );
  });

  it("prices adjustable hull from the base hull and includes pop-up mounting for free", () => {
    const design = blankDesign("adjust");
    design.hullTons = 400;
    design.configuration = "standard";
    design.techLevel = 15;
    design.hullOptions = [{ id: "adj", kind: "adjustable15" }];
    design.mounts = [
      { id: "turret", kind: "triple", weapons: ["beam"] },
      { id: "gun", kind: "barbette", weapons: ["particleBarbette"] },
    ];
    const sheet = evaluateDesign(design);
    assertEquals(
      sheet.lines.find((line) => line.name === "Adjustable Hull (TL15)"),
      { name: "Adjustable Hull (TL15)", tons: 4, cost: 20 },
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Triple turret (pop-up)"),
      { name: "Triple turret (pop-up)", tons: 1, cost: 1, power: 1 },
    );
    assertEquals(
      sheet.lines.find((line) => line.name === "Barbette (pop-up)"),
      { name: "Barbette (pop-up)", tons: 5, cost: 0, power: 0 },
    );
    assertEquals(sheet.errors.some((error) => error.includes("Pop-up")), false);
    assertEquals(
      exteriorAppearsUnarmed(design.mounts, design.hullTons, true),
      true,
    );

    design.hullTons = 200;
    design.configuration = "streamlined";
    design.hullType = "light";
    design.techLevel = 12;
    design.hullOptions = [{ id: "adj", kind: "adjustable" }];
    design.mounts = [{
      id: "turret",
      kind: "single",
      weapons: ["pulse"],
      popup: true,
    }];
    const light = evaluateDesign(design);
    assertEquals(
      light.lines.find((line) => line.name === "Adjustable Hull (TL12)"),
      { name: "Adjustable Hull (TL12)", tons: 10, cost: 1 },
    );
    assertEquals(
      light.lines.find((line) => line.name === "Single turret (pop-up)"),
      { name: "Single turret (pop-up)", tons: 1, cost: 0.2, power: 1 },
    );
    assertEquals(light.errors.some((error) => error.includes("Pop-up")), false);

    design.techLevel = 11;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error === "Adjustable Hull (TL12) requires tech level 12."
      ),
    );
    design.techLevel = 14;
    design.hullOptions = [{ id: "late", kind: "adjustable15" }];
    assert(
      evaluateDesign(design).errors.some((error) =>
        error === "Adjustable Hull (TL15) requires tech level 15."
      ),
    );
    assertEquals(
      hullOptionsAt(12, []).some((option) => option.id === "adjustable"),
      true,
    );
    assertEquals(
      hullOptionsAt(12, []).some((option) => option.id === "adjustable15"),
      false,
    );
    assertEquals(
      hullOptionsAt(15, ["adjustable"]).some((option) =>
        option.id === "adjustable15"
      ),
      false,
    );
  });

  it("prices a grav screen at one ton per 200 tons of hull", () => {
    const design = blankDesign("screen");
    design.hullTons = 200;
    design.techLevel = 12;
    design.hullOptions = [{ id: "grav", kind: "grav" }];
    const plain = evaluateDesign(blankDesign("plain"));
    const sheet = evaluateDesign(design);
    assertEquals(sheet.lines.find((line) => line.name === "Grav Screen"), {
      name: "Grav Screen",
      tons: 1,
      cost: 1,
      power: 2,
    });
    assertEquals(sheet.powerUse.base, plain.powerUse.base + 2);
    assertEquals(sheet.powerUse.total, plain.powerUse.total + 2);
    design.hullTons = 400;
    assertEquals(
      evaluateDesign(design).lines.find((line) => line.name === "Grav Screen"),
      { name: "Grav Screen", tons: 2, cost: 2, power: 4 },
    );
    design.hullTons = 150;
    assertEquals(
      evaluateDesign(design).lines.find((line) => line.name === "Grav Screen"),
      { name: "Grav Screen", tons: 0.75, cost: 0.75, power: 1.5 },
    );
    design.hullTons = 200;
    design.techLevel = 11;
    assert(
      evaluateDesign(design).errors.some((error) =>
        error === "Grav Screen requires tech level 12."
      ),
    );
    assertEquals(
      hullOptionsAt(12, []).some((option) => option.id === "grav"),
      true,
    );
    assertEquals(
      hullOptionsAt(11, []).some((option) => option.id === "grav"),
      false,
    );
    assertEquals(
      hullOptionsAt(12, ["grav"]).some((option) => option.group === "solar"),
      false,
    );
  });

  it("marks double occupancy on staterooms without extra tons or cost", () => {
    const design = blankDesign("bunks");
    design.staterooms = 10;
    design.doubleStaterooms = 4;
    const sheet = evaluateDesign(design);
    assertEquals(sheet.lines.find((line) => line.name === "Staterooms"), {
      name: "Staterooms",
      tons: 40,
      cost: 5,
    });
    assertEquals(
      sheet.lines.some((line) => line.name.includes("Double")),
      false,
    );
  });

  it("prices a biosphere at MCr 0.2 and one power per ton", () => {
    const ship = blankDesign("garden");
    ship.amenities = [{ id: "bio", kind: "biosphere", quantity: 17 }];
    const sheet = evaluateDesign(ship);
    assertEquals(sheet.lines.find((line) => line.name === "Biosphere"), {
      name: "Biosphere",
      tons: 17,
      cost: 3.4,
      power: 17,
    });
    assertEquals(sheet.powerUse.fittings, 17);
    assertEquals(biospherePassengers(17), 34);
  });

  it("prices an armoury at 1 ton and MCr 0.25", () => {
    const ship = blankDesign("marines");
    const before = evaluateDesign(ship).powerUse.fittings;
    ship.amenities = [{ id: "arms", kind: "armoury", quantity: 2 }];
    const sheet = evaluateDesign(ship);
    assertEquals(sheet.lines.find((line) => line.name === "Armoury"), {
      name: "Armoury",
      tons: 2,
      cost: 0.5,
    });
    assertEquals(sheet.powerUse.fittings, before);
    assertEquals(armouryCover(2), { crew: 50, marines: 10 });
  });

  it("prices a brewery and both swimming pools", () => {
    const ship = blankDesign("leisure");
    ship.techLevel = 12;
    ship.amenities = [
      { id: "brew", kind: "brewery", quantity: 2 },
      { id: "pool", kind: "pool", quantity: 8 },
      { id: "lap", kind: "endlessPool", quantity: 1 },
    ];
    const sheet = evaluateDesign(ship);
    assertEquals(sheet.lines.find((line) => line.name === "Brewery"), {
      name: "Brewery",
      tons: 1,
      cost: 0.1,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Swimming pool"), {
      name: "Swimming pool",
      tons: 8,
      cost: 0.16,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Endless pool"), {
      name: "Endless pool",
      tons: 2,
      cost: 0.05,
    });
    assertEquals(
      sheet.errors.filter((error) =>
        error.includes("Brewery") || error.includes("pool")
      ),
      [],
    );

    ship.techLevel = 9;
    assert(
      evaluateDesign(ship).errors.some((error) =>
        error === "Brewery requires tech level 10."
      ),
    );

    ship.techLevel = 12;
    ship.amenities = [{ id: "pool", kind: "pool", quantity: 3 }];
    const small = evaluateDesign(ship);
    assertEquals(small.lines.find((line) => line.name === "Swimming pool"), {
      name: "Swimming pool",
      tons: 3,
      cost: 0.06,
    });
    assert(
      small.errors.some((error) =>
        error === "Swimming pool is at least 4 tons."
      ),
    );
  });

  it("prices external systems from the hull and the linkage tech level", () => {
    const ship = blankDesign("tug");
    ship.hullTons = 200;
    ship.techLevel = 12;
    ship.externalSystems = [
      { id: "tube", kind: "breaching", quantity: 1 },
      { id: "link", kind: "linkage", quantity: 1, techLevel: 12 },
      { id: "arm", kind: "grappling", quantity: 2 },
      { id: "holo", kind: "holographic", quantity: 1 },
      { id: "tow", kind: "tow", quantity: 1 },
    ];
    const sheet = evaluateDesign(ship);
    assertEquals(sheet.lines.find((line) => line.name === "Breaching tube"), {
      name: "Breaching tube",
      tons: 3,
      cost: 3,
    });
    assertEquals(
      sheet.lines.find((line) =>
        line.name === "Forced linkage apparatus (Enhanced)"
      ),
      { name: "Forced linkage apparatus (Enhanced)", tons: 2, cost: 0.1 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Grappling arm"), {
      name: "Grappling arm",
      tons: 4,
      cost: 2,
    });
    ship.externalSystems = [...ship.externalSystems, {
      id: "heavy",
      kind: "heavyGrappling",
      quantity: 1,
    }];
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Heavy grappling arm"
      ),
      { name: "Heavy grappling arm", tons: 6, cost: 3 },
    );
    assertEquals(sheet.lines.find((line) => line.name === "Holographic hull"), {
      name: "Holographic hull",
      tons: 0,
      cost: 20,
      power: 100,
    });
    assertEquals(sheet.lines.find((line) => line.name === "Tow cable"), {
      name: "Tow cable",
      tons: 2,
      cost: 0.01,
    });
    assertEquals(sheet.powerUse.fittings, 100);
    ship.cargoGear = [{ id: "scoop", kind: "cargoScoop", quantity: 1 }];
    const scooped = evaluateDesign(ship);
    assertEquals(scooped.lines.find((line) => line.name === "Cargo scoop"), {
      name: "Cargo scoop",
      tons: 2,
      cost: 0.5,
    });
    assertEquals(scooped.powerUse.fittings, 100);
    ship.cargoGear = [...ship.cargoGear, {
      id: "net",
      kind: "cargoNet",
      quantity: 1,
    }];
    ship.jump = 1;
    const netted = evaluateDesign(ship);
    assertEquals(netted.lines.find((line) => line.name === "Cargo net"), {
      name: "Cargo net",
      tons: 5,
      cost: 1,
    });
    assert(
      netted.errors.some((error) =>
        error === "A ship cannot jump while a cargo net is extended."
      ),
    );
    ship.jump = 0;
    ship.cargoGear = [];
    assertEquals(
      evaluateDesign(ship).errors.some((error) => error.includes("cargo net")),
      false,
    );

    ship.externalSystems = [{
      id: "link",
      kind: "linkage",
      quantity: 2,
      techLevel: 9,
    }];
    const linked = evaluateDesign(ship);
    assertEquals(
      linked.lines.find((line) => line.name.startsWith("Forced linkage")),
      { name: "Forced linkage apparatus (Improved)", tons: 4, cost: 0.15 },
    );

    ship.techLevel = 11;
    ship.externalSystems = [{
      id: "link",
      kind: "linkage",
      quantity: 1,
      techLevel: 15,
    }];
    assert(
      evaluateDesign(ship).errors.some((error) =>
        error === "Forced linkage apparatus requires tech level 15."
      ),
    );

    const boat = blankDesign("boat");
    boat.hullTons = 35;
    boat.externalSystems = [{ id: "tow", kind: "tow", quantity: 1 }];
    assertEquals(
      evaluateDesign(boat).lines.find((line) => line.name === "Tow cable"),
      { name: "Tow cable", tons: 0.35, cost: 0.002 },
    );

    const escape = blankDesign("escape");
    escape.hullTons = 200;
    escape.techLevel = 12;
    escape.externalSystems = [
      { id: "capsules", kind: "reentryCapsule", quantity: 4 },
      { id: "pods", kind: "reentryPod", quantity: 2 },
    ];
    const dropped = evaluateDesign(escape);
    ship.externalSystems = [
      { id: "small", kind: "clamp1", quantity: 4 },
      { id: "huge", kind: "clamp5", quantity: 1 },
    ];
    const clamped = evaluateDesign(ship);
    assertEquals(
      clamped.lines.find((line) => line.name === "Docking clamp (Type I)"),
      { name: "Docking clamp (Type I)", tons: 4, cost: 2 },
    );
    assertEquals(
      clamped.lines.find((line) => line.name === "Docking clamp (Type V)"),
      { name: "Docking clamp (Type V)", tons: 50, cost: 8 },
    );
    assertEquals(clamped.powerUse.fittings, 0);

    assertEquals(
      dropped.lines.find((line) => line.name === "Re-entry capsule"),
      { name: "Re-entry capsule", tons: 2, cost: 0.08 },
    );
    assertEquals(dropped.lines.find((line) => line.name === "Re-entry pod"), {
      name: "Re-entry pod",
      tons: 2,
      cost: 0.3,
    });
    assertEquals(dropped.powerUse.fittings, 0);
    escape.techLevel = 7;
    const early = evaluateDesign(escape);
    assertEquals(
      early.errors.includes("Re-entry capsule requires tech level 8."),
      true,
    );
    assertEquals(
      early.errors.includes("Re-entry pod requires tech level 9."),
      true,
    );
    escape.techLevel = 8;
    const capsuleOnly = evaluateDesign(escape);
    assertEquals(
      capsuleOnly.errors.includes("Re-entry capsule requires tech level 8."),
      false,
    );
    assertEquals(
      capsuleOnly.errors.includes("Re-entry pod requires tech level 9."),
      true,
    );
  });

  it("adds holographic controls as a quarter of the bridge cost", () => {
    const ship = blankDesign("holo-bridge");
    ship.hullTons = 200;
    ship.techLevel = 12;
    ship.holographicControls = true;
    const sheet = evaluateDesign(ship);
    assertEquals(sheet.lines.find((line) => line.name === "Bridge"), {
      name: "Bridge",
      tons: 10,
      cost: 1,
    });
    assertEquals(
      sheet.lines.find((line) => line.name === "Holographic controls"),
      { name: "Holographic controls", tons: 0, cost: 0.25 },
    );

    ship.techLevel = 8;
    assertEquals(
      evaluateDesign(ship).errors.includes(
        "Holographic controls require tech level 9.",
      ),
      true,
    );

    ship.holographicControls = false;
    assertEquals(
      evaluateDesign(ship).lines.some((line) =>
        line.name === "Holographic controls"
      ),
      false,
    );

    const module = blankModule("mod");
    module.holographicControls = true;
    assertEquals(
      evaluateDesign(module).lines.some((line) =>
        line.name === "Holographic controls"
      ),
      false,
    );
  });

  it("prices extra sensor stations on hulls of 7,500 tons or less", () => {
    const ship = blankDesign("stations");
    ship.sensorStations = 2;
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Sensor station x2"
      ),
      { name: "Sensor station x2", tons: 2, cost: 1 },
    );
    ship.sensorStations = 1;
    assertEquals(
      evaluateDesign(ship).lines.find((line) => line.name === "Sensor station"),
      { name: "Sensor station", tons: 1, cost: 0.5 },
    );

    ship.hullTons = 8000;
    const capital = evaluateDesign(ship);
    assert(
      capital.errors.some((error) =>
        error ===
          "Sensor stations are only available on hulls of 7,500 tons or less."
      ),
    );
    assertEquals(
      capital.lines.some((line) => line.name.startsWith("Sensor station")),
      false,
    );

    const pod = blankModule("pod");
    pod.sensorStations = 3;
    assertEquals(
      evaluateDesign(pod).lines.some((line) =>
        line.name.startsWith("Sensor station")
      ),
      false,
    );

    const other = blankDesign("other-stations");
    other.sensorStations = 1;
    const combined = combinedBreakaway([ship, other]).sheet;
    assertEquals(
      combined.lines.find((line) => line.name.startsWith("Sensor station")),
      { name: "Sensor station", tons: 1, cost: 0.5 },
    );
    ship.hullTons = 200;
    assertEquals(
      combinedBreakaway([ship, other]).sheet.lines.find((line) =>
        line.name.startsWith("Sensor station")
      ),
      { name: "Sensor station x2", tons: 2, cost: 1 },
    );
  });

  it("prices a ship's brain and its interface from the Robot Handbook", () => {
    const ship = blankDesign("minded");
    ship.hullTons = 200;
    ship.techLevel = 12;
    assertEquals(
      evaluateDesign(ship).lines.some((line) =>
        line.name.startsWith("Ship's brain")
      ),
      false,
    );

    ship.shipBrain = "alpha";
    ship.shipBrainInterface = "interface";
    const alpha = evaluateDesign(ship);
    assertEquals(
      alpha.lines.find((line) => line.name === "Ship's brain (Alpha)"),
      { name: "Ship's brain (Alpha)", tons: 0, cost: 0.04 },
    );
    assertEquals(
      alpha.lines.find((line) => line.name === "Ship's Brain Interface"),
      { name: "Ship's Brain Interface", tons: 0, cost: 1 },
    );

    ship.shipBrainInterface = "haptics";
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Ship's Brain Interface + Haptics"
      ),
      { name: "Ship's Brain Interface + Haptics", tons: 0, cost: 1.4 },
    );

    ship.techLevel = 10;
    ship.shipBrain = "alpha";
    ship.shipBrainInterface = "none";
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Ship's brain (Alpha)"
      )?.cost,
      0.13,
    );

    ship.techLevel = 11;
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Ship's brain (Alpha)"
      )?.cost,
      0.08,
    );

    ship.techLevel = 12;
    ship.shipBrain = "brian";
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Ship's brain (Brian)"
      ),
      { name: "Ship's brain (Brian)", tons: 0, cost: 1 },
    );

    ship.shipBrain = "omega";
    assert(
      evaluateDesign(ship).errors.some((error) =>
        error === "Omega requires tech level 15."
      ),
    );
  });

  it("prices a custom ship's brain with chassis, upgrades, armour, and skill software", () => {
    const ship = blankDesign("custom-brain");
    ship.hullTons = 200;
    ship.techLevel = 14;
    ship.shipBrain = "custom";
    ship.shipBrainInterface = "interface";
    ship.customShipBrain = {
      name: "",
      chassis: 1,
      armour: 0,
      programming: "advanced-12",
      bandwidthUpgrade: "",
      intellect: 0,
      hardened: false,
      options: [],
      skills: [],
      avatars: 0,
    };
    const small = evaluateDesign(ship);
    assertEquals(
      small.lines.find((line) => line.name === "Ship's brain chassis (Size 1)"),
      {
        name: "Ship's brain chassis (Size 1)",
        tons: 0,
        cost: 0.00006,
        fold: "brain",
      },
    );
    const brainNames = small.lines.map((line) => line.name).filter((name) =>
      name.startsWith("Ship's brain")
    );
    assertEquals(brainNames.slice(0, 2), [
      "Ship's brain (Advanced, TL12)",
      "Ship's brain chassis (Size 1)",
    ]);
    assertEquals(
      small.lines.find((line) => line.name === "Ship's Brain Interface")?.cost,
      1,
    );
    assertEquals(
      quoteCustomShipBrain(ship.customShipBrain, 14).slotsAvailable,
      4,
    );

    ship.customShipBrain = {
      name: "",
      chassis: 5,
      armour: 6,
      programming: "very-14",
      bandwidthUpgrade: "very-6",
      intellect: 1,
      hardened: true,
      options: [],
      avatars: 0,
      skills: [
        { id: "steward", skill: "steward", level: 2, specialty: "" },
        {
          id: "electronics",
          skill: "electronics",
          level: 1,
          specialty: "computers",
        },
      ],
    };
    const fitted = evaluateDesign(ship);
    assertEquals(fitted.errors, []);
    assertEquals(
      fitted.lines.find((line) => line.name === "Ship's brain chassis (Size 5)")
        ?.cost,
      0.0006,
    );
    assertEquals(
      fitted.lines.find((line) => line.name === "Brain armour (+6)")?.cost,
      0.003,
    );
    assertEquals(
      fitted.lines.find((line) =>
        line.name === "Ship's brain (Very Advanced, TL14)"
      )?.cost,
      0.5,
    );
    assertEquals(
      fitted.lines.find((line) => line.name === "Brain bandwidth upgrade (+6)")
        ?.cost,
      0.05,
    );
    assertEquals(
      fitted.lines.find((line) => line.name === "Brain intellect upgrade (+1)")
        ?.cost,
      0.024,
    );
    assertEquals(
      fitted.lines.find((line) => line.name === "Brain hardening")?.cost,
      0.275,
    );
    assertEquals(
      fitted.lines.find((line) => line.name === "Steward 2 (effective 4)")
        ?.cost,
      0.01,
    );
    assertEquals(
      fitted.lines.find((line) =>
        line.name === "Electronics (computers) 1 (effective 3)"
      )?.cost,
      0.001,
    );
    assertEquals(quoteCustomShipBrain(ship.customShipBrain, 14).slotsUsed, 4);

    ship.customShipBrain = {
      name: "",
      chassis: 5,
      armour: 0,
      programming: "very-12",
      bandwidthUpgrade: "",
      intellect: 0,
      hardened: false,
      options: [],
      skills: [],
      avatars: 0,
    };
    assertEquals(
      evaluateDesign(ship).lines.find((line) =>
        line.name === "Ship's brain (Very Advanced, TL12)"
      )?.cost,
      0.125,
    );

    ship.techLevel = 9;
    assert(
      evaluateDesign(ship).errors.some((error) =>
        error.includes("tech level 10")
      ),
    );

    ship.techLevel = 12;
    ship.customShipBrain = {
      name: "",
      chassis: 1,
      armour: 0,
      programming: "advanced-12",
      bandwidthUpgrade: "advanced-4",
      intellect: 0,
      hardened: false,
      options: [],
      skills: [{ id: "steward", skill: "steward", level: 3, specialty: "" }],
      avatars: 0,
    };
    const over = evaluateDesign(ship);
    assert(over.errors.some((error) => error.includes("inherent bandwidth")));
    assertEquals(
      over.lines.find((line) => line.name.startsWith("Steward 3"))?.cost,
      0.1,
    );

    const fresh = quoteCustomShipBrain(blankCustomShipBrain(12), 12);
    assertEquals(
      fresh.lines.find((line) => line.name === "External power")?.cost,
      0.0001,
    );
    assertEquals(
      fresh.lines.find((line) => line.name === "External power")?.fold,
      "brain",
    );
    assertEquals(
      fresh.lines.find((line) => line.name.startsWith("Ship's brain chassis"))
        ?.fold,
      "brain",
    );
    assertEquals(
      fresh.lines.find((line) => line.head === "brain")?.name,
      "Ship's brain (Advanced, TL12)",
    );
    assertEquals(
      fresh.lines.findIndex((line) => line.head === "brain") <
        fresh.lines.findIndex((line) =>
          line.name.startsWith("Ship's brain chassis")
        ),
      true,
    );
    assertEquals(fresh.slotsUsed, 2);
    const labels = optionsAt(12).map((option) => option.label);
    assertEquals(
      labels,
      [...labels].sort((left, right) => left.localeCompare(right)),
    );
    assertEquals(labels.includes("External power"), false);
    assertEquals(labels.includes("Visual spectrum sensor"), false);
    assertEquals(labels.includes("Auditory sensor"), false);
    assertEquals(labels.includes("Voder speaker"), false);
    assertEquals(labels.includes("Wireless data link"), false);
    assertEquals(labels.includes("Transceiver 5km (basic)"), false);
    assert(labels.includes("Transceiver 5km (improved)"));
    const sized = quoteCustomShipBrain({
      ...blankCustomShipBrain(12),
      chassis: 5,
    }, 12);
    assertEquals(
      sized.lines.find((line) => line.name === "External power")?.cost,
      0.0016,
    );

    const swarm = optionsAt(14).find((option) =>
      option.label === "Swarm controller (advanced)"
    );
    assertEquals(swarm?.slots, 1);
    assert(
      optionsAt(12).some((option) =>
        option.label === "Swarm controller (enhanced)"
      ),
    );
    assertEquals(
      optionsAt(12).some((option) =>
        option.label === "Swarm controller (advanced)"
      ),
      false,
    );

    const plain = quoteCustomShipBrain({
      ...blankCustomShipBrain(12),
      skills: [{ id: "pilot", skill: "pilot", level: 0, specialty: "" }],
    }, 12);
    assertEquals(plain.dexDm, 0);
    assertEquals(
      plain.skills.find((skill) => skill.skill === "pilot")?.effective,
      0,
    );
    assertEquals(
      plain.lines.find((line) => line.name.startsWith("Pilot"))?.name,
      "Pilot 0",
    );

    const haptic = quoteCustomShipBrain(
      {
        ...blankCustomShipBrain(12),
        skills: [{
          id: "pilot",
          skill: "pilot",
          level: 1,
          specialty: "small craft",
        }],
      },
      12,
      true,
    );
    assertEquals(haptic.dexterity, 12);
    assertEquals(haptic.dexDm, 2);
    assertEquals(
      haptic.skills.find((skill) => skill.skill === "pilot")?.effective,
      3,
    );
    assertEquals(
      haptic.lines.find((line) => line.name.startsWith("Pilot"))?.name,
      "Pilot (small craft) 1 (effective 3)",
    );
    assertEquals(
      haptic.lines.find((line) => line.name.startsWith("Pilot"))?.cost,
      0.001,
    );

    const repeated = quoteCustomShipBrain({
      ...blankCustomShipBrain(12),
      skills: [
        { id: "craft", skill: "pilot", level: 1, specialty: "small craft" },
        { id: "ship", skill: "pilot", level: 1, specialty: "spacecraft" },
      ],
    }, 12);
    assertEquals(repeated.errors, []);
    assertEquals(
      repeated.lines.filter((line) => line.name.startsWith("Pilot")).map((
        line,
      ) => line.name),
      [
        "Pilot (small craft) 1",
        "Pilot (spacecraft) 1",
      ],
    );
    assert(
      quoteCustomShipBrain({
        ...blankCustomShipBrain(12),
        skills: [{ id: "bare", skill: "pilot", level: 1, specialty: "" }],
      }, 12).errors.some((error) => error === "Pilot 1 needs a specialty."),
    );
    assertEquals(
      quoteCustomShipBrain({
        ...blankCustomShipBrain(12),
        skills: [{
          id: "ath",
          skill: "athletics",
          level: 1,
          specialty: "strength",
        }],
      }, 12).lines.find((line) => line.name.startsWith("Athletics"))?.name,
      "Athletics (STR) 1 (effective -2)",
    );
    assertEquals(
      quoteCustomShipBrain({ ...blankCustomShipBrain(12), name: "Ada" }, 12)
        .lines.find((line) => line.name.startsWith("Ada"))?.name,
      "Ada (Advanced, TL12)",
    );
    const bareBrain = quoteCustomShipBrain(blankCustomShipBrain(12), 12);
    const avatars = quoteCustomShipBrain({
      ...blankCustomShipBrain(12),
      avatars: 3,
    }, 12);
    assertEquals(
      avatars.lines.find((line) => line.name === "Ava Ship's Avatar x3"),
      { name: "Ava Ship's Avatar x3", tons: 0, cost: 0.3, fold: "brain" },
    );
    assertEquals(avatars.slotsUsed, bareBrain.slotsUsed);
    assertEquals(
      quoteCustomShipBrain({ ...blankCustomShipBrain(12), avatars: 1 }, 12)
        .lines.find((line) => line.name === "Ava Ship's Avatar")?.cost,
      0.1,
    );
    const ordered = quoteCustomShipBrain({
      ...blankCustomShipBrain(12),
      skills: [
        { id: "pilot", skill: "pilot", level: 1, specialty: "spacecraft" },
        { id: "admin", skill: "admin", level: 0, specialty: "" },
        { id: "craft", skill: "pilot", level: 1, specialty: "small craft" },
      ],
    }, 12);
    assertEquals(
      ordered.lines.filter((line) =>
        line.name.startsWith("Admin") || line.name.startsWith("Pilot")
      ).map((line) => line.name),
      [
        "Admin 0",
        "Pilot (small craft) 1",
        "Pilot (spacecraft) 1",
      ],
    );
  });

  it("tags each sheet line with a role when it is created", () => {
    const design = blankDesign("roles");
    design.hullTons = 200;
    design.techLevel = 12;
    design.thrust = 1;
    design.jump = 1;
    design.power = 60;
    design.armour = "crystaliron";
    design.armourRating = 2;
    design.hullOptions = [{ id: "fins", kind: "aerofins" }];
    design.externalSystems = [{ id: "holo", kind: "holographic", quantity: 1 }];
    design.staterooms = 2;
    const sheet = evaluateDesign(design);
    const roleOf = (name: string) =>
      sheet.lines.find((line) => line.name === name)?.role;
    rawEquals(roleOf("Streamlined hull"), "hull");
    rawEquals(roleOf("Aerofins"), "hullOption");
    rawEquals(
      sheet.lines.find((line) => line.name === "Aerofins")?.option,
      "aerofins",
    );
    rawEquals(roleOf("Crystaliron 2"), "armour");
    rawEquals(roleOf("Holographic hull"), "system");
    rawEquals(roleOf("Manoeuvre drive 1"), "manoeuvre");
    rawEquals(roleOf("Jump drive 1"), "jump");
    rawEquals(roleOf("Fusion (TL8)"), "plant");
    rawEquals(roleOf("Bridge"), "bridge");
    rawEquals(roleOf("Computer/5"), "computer");
    rawEquals(roleOf("Staterooms"), "accommodation");
    const other = blankDesign("other");
    other.hullTons = 100;
    other.techLevel = 12;
    const combined = combinedBreakaway([design, other]);
    rawEquals(
      combined.sheet.lines.find((line) => line.name === "Holographic hull")
        ?.role,
      "system",
    );
    rawEquals(
      combined.sheet.lines.find((line) => line.role === "hull")?.name.endsWith(
        " hull",
      ),
      true,
    );
  });

  it("lists sheet components in the ship-sheet order", () => {
    const pod = blankModule("pod");
    pod.name = "Cargo pod";
    pod.hullTons = 12;
    const design = blankDesign("order");
    design.hullTons = 400;
    design.techLevel = 12;
    design.thrust = 1;
    design.jump = 1;
    design.power = 400;
    design.armour = "crystaliron";
    design.armourRating = 1;
    design.hullOptions = [
      { id: "bay", kind: "modular", tons: 12, modules: ["pod"] },
      { id: "fins", kind: "aerofins" },
    ];
    design.containerTons = 10;
    design.processorTons = 1;
    design.holographicControls = true;
    design.sensorStations = 1;
    design.additionalSensors = [{ id: "life", kind: "life", tons: 1 }];
    design.software = ["manoeuvre", "library"];
    design.shipBrain = "alpha";
    design.mounts = [{ id: "gun", kind: "double", weapons: ["pulse"] }];
    design.staterooms = 1;
    design.commonTons = 1;
    design.amenities = [{ id: "bar", kind: "wetBar", quantity: 1 }];
    design.workSpaces = [{ id: "lab", kind: "laboratory", quantity: 1 }];
    design.externalSystems = [{ id: "tube", kind: "breaching", quantity: 1 }];
    design.docks = [{ id: "raft", craft: "air-raft" }];
    design.drones = [{ id: "probes", kind: "probe", quantity: 1 }];
    design.cargoGear = [{ id: "crane", kind: "crane", quantity: 1 }];
    const names = evaluateDesign(design, [pod]).lines.map((line) => line.name);
    const markers = [
      "Streamlined hull",
      "Modular Hull",
      "Cargo pod",
      "Aerofins",
      "Crystaliron 1",
      "Manoeuvre drive 1",
      "Jump drive 1",
      "Fusion (TL8)",
      "Fuel tank",
      "Fuel/cargo container (10 t)",
      "Fuel processors",
      "Bridge",
      "Basic sensors",
      "Life Scanner",
      "Computer/5",
      "Manoeuvre/0",
      "Library",
      "Ship's brain (Alpha)",
      "Double turret",
      "Pulse laser",
      "Staterooms",
      "Common space",
      "Wet bar",
      "Laboratory",
      "Breaching tube",
      "Docking space (Air/raft)",
      "Air/raft",
      "Probe drones ×5",
      "Holographic controls",
      "Sensor station",
      "Fuel scoops",
      "Cargo crane",
    ];
    const indexes = markers.map((name) => names.indexOf(name));
    assert(indexes.every((index) => index >= 0), names.join(" | "));
    assert(
      indexes.every((index, place) =>
        place === 0 || index > indexes[place - 1]
      ),
    );
    const extra = blankDesign("extra");
    extra.hullTons = 200;
    extra.techLevel = 12;
    extra.power = 80;
    extra.drones = [{ id: "fix", kind: "repair", quantity: 1 }];
    const joined = combinedBreakaway([design, extra], [pod]).sheet.lines.map((
      line,
    ) => line.name);
    assert(joined.indexOf("Staterooms") < joined.indexOf("Repair drones"));
    assert(joined.indexOf("Repair drones") < joined.indexOf("Fuel scoops"));
    const grouped = orderSheetLines([
      { role: "turret", name: "Double turret", tons: 1, cost: 0.5 },
      { role: "weapon", name: "Pulse laser", tons: 0, cost: 1 },
      { role: "dock", name: "Docking space (Air/raft)", tons: 5, cost: 1 },
      { role: "craft", name: "Air/raft", tons: 0, cost: 0.25 },
      { role: "system", name: "Fuel processors", tons: 1, cost: 0.05 },
      {
        role: "fuel",
        name: "Fuel/cargo container (10 t)",
        tons: 10.5,
        cost: 0.05,
      },
      { role: "fuel", name: "Fuel tank", tons: 4, cost: 0 },
      {
        role: "hullOption",
        option: "modular",
        name: "Modular Hull",
        tons: 20,
        cost: 1,
      },
      { role: "module", name: "Cargo pod", tons: 12, cost: 0.3 },
      { role: "hull", name: "Streamlined hull", tons: 400, cost: 20 },
    ]).map((line) => line.name);
    rawEquals(grouped, [
      "Streamlined hull",
      "Modular Hull",
      "Cargo pod",
      "Fuel tank",
      "Fuel/cargo container (10 t)",
      "Fuel processors",
      "Double turret",
      "Pulse laser",
      "Docking space (Air/raft)",
      "Air/raft",
    ]);
  });
});
