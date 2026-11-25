import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { blankDesign, evaluateDesign } from "./design.ts";
import { STANDARD_DESIGNS } from "./templates.ts";
import { shipDesignFromAdvanced } from "./toShipDesign.ts";

describe("ship design import", () => {
  it("copies the free trader purchase price, cargo, and fuel tank", () => {
    const trader = STANDARD_DESIGNS.find((row) => row.name === "Free Trader");
    if (!trader) throw new Error("missing Free Trader");
    const sheet = evaluateDesign(trader);
    assertEquals(shipDesignFromAdvanced(trader), {
      designType: "Free Trader",
      classification: "Free Trader",
      hullTons: 200,
      cargoTons: 81,
      hybridCargoFuel: 0,
      externalCargoTons: 0,
      jumpRating: 1,
      staterooms: 10,
      doubleStaterooms: 0,
      lowBerths: 20,
      fuelCapacity: 21,
      cashPrice: Math.round(sheet.cost * 1_000_000),
      armed: false,
    });
    assertEquals(sheet.cost, 46.242);
  });

  it("sums staterooms, treats a fitted weapon as armed, and keeps container fuel out of the tank", () => {
    const design = blankDesign("hauler");
    design.name = "Hauler";
    design.classification = "Free Trader";
    design.hullTons = 400;
    design.jump = 2;
    design.staterooms = 4;
    design.highStaterooms = 1;
    design.luxuryStaterooms = 2;
    design.lowBerths = 6;
    design.containerTons = 20;
    design.fuelTons = 80;
    design.mounts = [{ id: "gun", kind: "single", weapons: ["pulse"] }];
    design.cargoGear = [
      { id: "net", kind: "jumpNet", quantity: 100 },
      { id: "mount", kind: "external", quantity: 40 },
    ];
    const sheet = evaluateDesign(design);
    const imported = shipDesignFromAdvanced(design);
    assertEquals(imported.designType, "Hauler");
    assertEquals(imported.classification, "Free Trader");
    assertEquals(imported.hullTons, 400);
    assertEquals(imported.jumpRating, 2);
    design.hullTons = 200;
    design.jump = 1;
    design.driveCustom = {
      thrust: { tier: "standard", options: [], effectiveTons: 400 },
      jump: { tier: "standard", options: [], effectiveTons: 400 },
      plant: { tier: "standard", options: [] },
    };
    assertEquals(shipDesignFromAdvanced(design).hullTons, 200);
    assertEquals(shipDesignFromAdvanced(design).jumpRating, 2);
    assertEquals(imported.lowBerths, 6);
    assertEquals(imported.staterooms, 7);
    design.doubleStaterooms = 3;
    assertEquals(shipDesignFromAdvanced(design).doubleStaterooms, 3);
    design.doubleStaterooms = 9;
    assertEquals(shipDesignFromAdvanced(design).doubleStaterooms, 4);
    assertEquals(imported.armed, true);
    assertEquals(imported.hybridCargoFuel, 20);
    assertEquals(imported.externalCargoTons, 140);
    design.cargoGear = [...design.cargoGear, {
      id: "local",
      kind: "planetaryNet",
      quantity: 50,
    }];
    assertEquals(shipDesignFromAdvanced(design).externalCargoTons, 190);
    assertEquals(imported.cargoTons, Math.max(0, sheet.cargo));
    assertEquals(
      imported.fuelCapacity,
      sheet.lines.find((line) => line.name === "Fuel tank")?.tons,
    );
    assertEquals(
      imported.fuelCapacity + imported.hybridCargoFuel,
      sheet.fuelCapacity,
    );
    assertEquals(imported.cashPrice, Math.round(sheet.cost * 1_000_000));
  });

  it("leaves a ship unarmed when its mounts have no weapons and drops jump below 100 tons", () => {
    const design = blankDesign("boat");
    design.name = "Boat";
    design.hullTons = 40;
    design.jump = 3;
    design.mounts = [{ id: "empty", kind: "fixed", weapons: [] }];
    const imported = shipDesignFromAdvanced(design);
    assertEquals(imported.jumpRating, 0);
    assertEquals(imported.armed, false);
    assertEquals(imported.externalCargoTons, 0);
    assertEquals(imported.hybridCargoFuel, 0);
  });
});
