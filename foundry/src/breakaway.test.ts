import { assertEquals } from "@std/assert";
import { blankDesign } from "../../src/design.ts";
import {
  applyBreakaways,
  breakawayActorSlots,
  breakawayJumpFuel,
  designsReferencedBy,
  isBreakawayDesign
} from "./breakaway.ts";
import { projectShip } from "./project.ts";

function piece(projection: { pieces: { key: string; rating?: number; tons?: number; name: string }[] }, key: string) {
  return projection.pieces.find((row) => row.key === key);
}

Deno.test("a breakaway hull is a hardware item of two percent of the hull", () => {
  const plain = blankDesign("plain");
  assertEquals(piece(projectShip(plain), "breakaway"), undefined);
  const design = blankDesign("section");
  design.hullTons = 200;
  design.hullOptions = [{ id: "join", kind: "breakaway" }];
  const fitted = piece(projectShip(design), "breakaway");
  assertEquals(fitted?.name, "Breakaway Hull");
  assertEquals(fitted?.tons, 4);
  assertEquals(fitted?.rating, 4);
  assertEquals(isBreakawayDesign(design), true);
  assertEquals(isBreakawayDesign(plain), false);
  assertEquals(isBreakawayDesign({ hullType: "module", hullOptions: [{ kind: "breakaway" }] }), false);
});

Deno.test("joined breakaway hulls combine and come apart again", () => {
  const carrier = blankDesign("carrier");
  carrier.name = "Carrier";
  carrier.hullTons = 200;
  carrier.thrust = 1;
  carrier.jump = 1;
  carrier.computer = "core5";
  carrier.fuelTons = 20;
  carrier.hullOptions = [{ id: "join", kind: "breakaway" }];
  carrier.mounts = [{ id: "bow", kind: "single", weapons: ["pulse"] }];
  const wing = blankDesign("wing");
  wing.name = "Wing";
  wing.hullTons = 100;
  wing.thrust = 2;
  wing.jump = 2;
  wing.computer = "core15";
  wing.sensors = "military";
  wing.fuelTons = 10;
  wing.hullOptions = [{ id: "join", kind: "breakaway" }];
  wing.mounts = [{ id: "tip", kind: "single", weapons: ["beam"] }];
  const stock = projectShip(carrier);
  const alone = applyBreakaways(stock, []);
  assertEquals(alone.jdrive, stock.jdrive);
  assertEquals(alone.mdrive, stock.mdrive);
  assertEquals(alone.powerMax, stock.powerMax);
  assertEquals(alone.dtons, stock.dtons);
  assertEquals(piece(alone, "breakaway")?.tons, 4);

  const joined = applyBreakaways(stock, [{
    id: "wing",
    name: "Wing",
    quantity: 1,
    projection: projectShip(wing)
  }]);
  assertEquals(joined.dtons, 300);
  assertEquals(joined.processing, 15);
  assertEquals(piece(joined, "computer")?.rating, 15);
  assertEquals(joined.jdrive, 0);
  assertEquals(piece(joined, "j-drive")?.rating, 0);
  assertEquals(joined.mdrive, 1);
  assertEquals(piece(joined, "m-drive")?.rating, 1);
  assertEquals(
    breakawayJumpFuel(joined, joined.jdrive, joined.dtons),
    0
  );
  assertEquals(joined.powerMax, stock.powerMax + projectShip(wing).powerMax);
  assertEquals(joined.fuelMax, stock.fuelMax + projectShip(wing).fuelMax);
  assertEquals(piece(joined, "sensors")?.name, "Military sensors");
  assertEquals(piece(joined, "cargo")?.rating, piece(stock, "cargo")?.rating);
  const hold = joined.pieces.find((row) => row.key === "breakaway:wing:0:cargo");
  assertEquals(hold?.name, "Wing cargo");
  assertEquals(hold?.rating, piece(projectShip(wing), "cargo")?.rating);
  assertEquals(joined.cargo, (piece(stock, "cargo")?.rating ?? 0) + (hold?.rating ?? 0));
  assertEquals(
    joined.pieces.some((row) => row.key.startsWith("breakaway:wing:0:weapon:")),
    true
  );
  assertEquals(
    joined.pieces.some((row) => row.key.startsWith("weapon:")),
    true
  );
  assertEquals(piece(joined, "breakaway")?.tons, 4);
  assertEquals(
    joined.pieces.some((row) => row.key === "breakaway:wing:0:breakaway"),
    true
  );
  const wingWithModule = projectShip(wing);
  wingWithModule.enclosedTons = 12;
  const carried = applyBreakaways(stock, [{
    id: "wing",
    name: "Wing",
    quantity: 2,
    projection: wingWithModule
  }]);
  assertEquals(carried.enclosedTons, 24);
});

Deno.test("custom jump tonnage keeps the selected rating on that tonnage", () => {
  const hull = blankDesign("hull");
  hull.hullTons = 180;
  hull.jump = 3;
  hull.thrust = 1;
  hull.driveCustom = {
    thrust: { tier: "standard", options: [] },
    jump: { tier: "standard", options: [], effectiveTons: 240 },
    plant: { tier: "standard", options: [] }
  };
  const alone = projectShip(hull);
  assertEquals(alone.dtons, 180);
  assertEquals(alone.jumpBasis, 240);
  assertEquals(alone.jumpRating, 3);
  assertEquals(alone.jumpFuelHull, 240);
  assertEquals(alone.jdrive, 4);
  const pod = blankDesign("pod");
  pod.hullTons = 60;
  pod.jump = 0;
  pod.thrust = 1;
  const joined = applyBreakaways(alone, [{
    id: "pod",
    name: "Pod",
    quantity: 1,
    projection: projectShip(pod)
  }]);
  assertEquals(joined.dtons, 240);
  assertEquals(joined.jdrive, 3);
  assertEquals(piece(joined, "j-drive")?.rating, 3);
});

Deno.test("joined maneuver is rating times design tonnage, divided by the combined hull", () => {
  const heavy = blankDesign("heavy");
  heavy.hullTons = 150;
  heavy.thrust = 2;
  heavy.jump = 2;
  const light = blankDesign("light");
  light.hullTons = 50;
  light.thrust = 6;
  light.jump = 1;
  const joined = applyBreakaways(projectShip(heavy), [{
    id: "light",
    name: "Light",
    quantity: 1,
    projection: projectShip(light)
  }]);
  assertEquals(joined.dtons, 200);
  assertEquals(joined.mdrive, 3);
  assertEquals(piece(joined, "m-drive")?.rating, 3);
  const heavyShip = projectShip(heavy);
  assertEquals(joined.jdrive, 1);
  assertEquals(
    breakawayJumpFuel(joined, joined.jdrive, joined.dtons),
    Math.round(
      heavyShip.jumpFuel * (joined.jdrive / heavyShip.jumpRating) *
        (joined.dtons / heavyShip.jumpFuelHull) * 100
    ) / 100
  );

  heavy.driveCustom = {
    thrust: { tier: "standard", options: [], effectiveTons: 250 },
    jump: { tier: "standard", options: [] },
    plant: { tier: "standard", options: [] }
  };
  const oversized = applyBreakaways(projectShip(heavy), [{
    id: "light",
    name: "Light",
    quantity: 1,
    projection: projectShip(light)
  }]);
  assertEquals(oversized.mdrive, 4);
});

Deno.test("breakaway hulls named on the design are separate actor slots", () => {
  const wing = blankDesign("wing");
  wing.name = "Wing";
  wing.hullOptions = [{ id: "join", kind: "breakaway" }];
  const pod = blankDesign("pod");
  pod.name = "Pod";
  const carrier = blankDesign("carrier");
  carrier.hullOptions = [{ id: "join", kind: "breakaway" }];
  carrier.breakawayHulls = ["wing", "wing", "pod", "missing"];
  const slots = breakawayActorSlots(carrier, [carrier, wing, pod]);
  assertEquals(slots.map((hull) => hull.id), ["wing", "wing"]);
  const library = designsReferencedBy(wing, [carrier, wing, pod]);
  assertEquals(library.map((hull) => hull.id), []);
  wing.breakawayHulls = ["pod"];
  pod.hullOptions = [{ id: "join", kind: "breakaway" }];
  assertEquals(
    designsReferencedBy(wing, [carrier, wing, pod]).map((hull) => hull.id),
    ["pod"]
  );
  assertEquals(
    breakawayActorSlots(blankDesign("plain"), [wing]).map((hull) => hull.id),
    []
  );
});
