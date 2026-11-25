import { assertEquals } from "@std/assert";
import { blankDesign } from "../../src/design.ts";
import { breakawayJumpFuel } from "./breakaway.ts";
import { cargoSpaceKind, effectiveDrives, externalLoad, jumpDisplacement, jumpFuelUse } from "./cargo.ts";
import { projectShip } from "./project.ts";

Deno.test("cargo spaces are told apart by hardware key", () => {
  assertEquals(cargoSpaceKind("cargo"), "internal");
  assertEquals(cargoSpaceKind("cargo:external:mount"), "external");
  assertEquals(cargoSpaceKind("module:pod:cargo:jumpNet:star"), "jumpNet");
  assertEquals(cargoSpaceKind("module:pod:cargo:planetaryNet:local"), "planetaryNet");
  assertEquals(cargoSpaceKind("breakaway:wing:0:cargo"), "breakaway");
  assertEquals(cargoSpaceKind("fuel-cargo"), null);
});

Deno.test("external cargo and jump nets burden both drives", () => {
  const design = blankDesign("laden");
  design.hullTons = 200;
  design.thrust = 2;
  design.jump = 2;
  const empty = externalLoad([]);
  assertEquals(effectiveDrives(design, empty), { mdrive: 2, jdrive: 2 });
  const carried = externalLoad([
    { hold: "cargo", tons: 30 },
    { hold: "cargo:external:mount", tons: 50 },
    { hold: "cargo:jumpNet:star", tons: 50 }
  ]);
  assertEquals(carried, { external: 50, jumpNet: 50, planetary: 0, clamped: 0 });
  assertEquals(effectiveDrives(design, carried), { mdrive: 1, jdrive: 1 });
  assertEquals(
    effectiveDrives(design, { ...carried, external: 0, jumpNet: 0, clamped: 100 }),
    { mdrive: 1, jdrive: 1 }
  );
});

Deno.test("cargo in an interplanetary jump net stops a jump and slows maneuver", () => {
  const design = blankDesign("local");
  design.hullTons = 200;
  design.thrust = 2;
  design.jump = 2;
  const load = externalLoad([
    { hold: "cargo:planetaryNet:local", tons: 10 },
    { hold: "cargo:external:mount", tons: 0 }
  ]);
  assertEquals(load.planetary, 10);
  assertEquals(effectiveDrives(design, load), { mdrive: 1, jdrive: 0 });
});

Deno.test("jump fuel follows the loaded displacement and the parsecs jumped", () => {
  const design = blankDesign("jumper");
  design.hullTons = 200;
  design.jump = 2;
  const projection = projectShip(design, [design]);
  assertEquals(jumpDisplacement(200, { external: 100, jumpNet: 0, planetary: 0, clamped: 0 }), 300);
  assertEquals(jumpDisplacement(200, { planetary: 10 }), 0);
  assertEquals(breakawayJumpFuel(projection, 2, 200), 40);
  assertEquals(breakawayJumpFuel(projection, 1, 300), 30);
  design.jump = 1;
  design.driveCustom = {
    thrust: { tier: "standard", options: [] },
    jump: { tier: "standard", options: [], effectiveTons: 400 },
    plant: { tier: "standard", options: [] }
  };
  const rated = projectShip(design, [design]);
  assertEquals(breakawayJumpFuel(rated, 1, 200), 20);
  assertEquals(breakawayJumpFuel(rated, 2, 200), 40);
});

Deno.test("jump fuel follows the jump rating", () => {
  const design = blankDesign("jumper");
  design.hullTons = 200;
  design.jump = 1;
  assertEquals(jumpFuelUse(design, [design], 1, 200), 20);
  design.jump = 2;
  assertEquals(jumpFuelUse(design, [design], 2, 200), 40);
  assertEquals(jumpFuelUse(design, [design], 1, 200), 20);
  assertEquals(jumpFuelUse(design, [design], 0, 200), 0);
});
