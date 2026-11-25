import { assertEquals } from "@std/assert";
import { blankDesign, blankModule } from "../../src/design.ts";
import { projectShip } from "./project.ts";
import { applyModules, assignModuleBays, moduleActorSlots, moduleCapacity, moduleSpace } from "./modules.ts";

Deno.test("modules named on the design are separate actor slots", () => {
  const pod = blankModule("pod");
  pod.name = "Pod";
  pod.hullTons = 40;
  const crate = blankModule("crate");
  crate.hullTons = 40;
  const ship = blankDesign("ship");
  ship.hullOptions = [
    { id: "forward", kind: "modular", tons: 40, modules: ["pod", "missing", "ship", "crate"] },
    { id: "fins", kind: "aerofins" },
    { id: "aft", kind: "modular", tons: 30, modules: ["pod"] },
    { id: "spare", kind: "modular", tons: 40, modules: ["pod"] }
  ];
  const other = blankDesign("other");
  assertEquals(
    moduleActorSlots(ship, [ship, pod, crate, other]).map((row) => row.id),
    ["pod", "pod"]
  );
  assertEquals(moduleActorSlots(blankDesign("plain"), [pod]), []);
});

Deno.test("moduleCapacity sums every modular hull", () => {
  const design = blankDesign("cutter");
  design.hullOptions = [
    { id: "forward", kind: "modular", tons: 20 },
    { id: "aft", kind: "modular", tons: 10 },
    { id: "fins", kind: "aerofins" }
  ];
  assertEquals(moduleCapacity(design), 30);
  assertEquals(moduleCapacity(blankDesign("plain")), 0);
});

Deno.test("moduleSpace matches one module to one bay", () => {
  const bays = [
    { id: "forward", tons: 30 },
    { id: "aft", tons: 15 }
  ];
  assertEquals(moduleSpace(bays, [], 30), "ok");
  assertEquals(moduleSpace(bays, [], 20), "large");
  assertEquals(moduleSpace(bays, [{ tons: 30, quantity: 1 }], 30), "full");
  assertEquals(moduleSpace(bays, [{ tons: 30, quantity: 1 }], 15), "ok");
  assertEquals(moduleSpace([], [], 10), "empty");
});

Deno.test("assignModuleBays keeps one module of the bay size", () => {
  const bays = [
    { id: "forward", tons: 30 },
    { id: "aft", tons: 30 }
  ];
  const packed = assignModuleBays(bays, [
    { id: "small", tons: 10, quantity: 1 },
    { id: "pod", tons: 30, quantity: 1 }
  ]);
  assertEquals(packed.fitted, [{ id: "pod", tons: 30, quantity: 1 }]);
  assertEquals(packed.unplaced, [{ id: "small", tons: 10, quantity: 1 }]);
  assertEquals(packed.open.map((bay) => bay.id), ["aft"]);
  const doubled = assignModuleBays(bays, [{ id: "pod", tons: 30, quantity: 2 }]);
  assertEquals(doubled.fitted, [{ id: "pod", tons: 30, quantity: 2 }]);
  assertEquals(doubled.open, []);
  const crowded = assignModuleBays(
    [{ id: "only", tons: 30 }],
    [{ id: "pod", tons: 30, quantity: 2 }]
  );
  assertEquals(crowded.fitted, [{ id: "pod", tons: 30, quantity: 1 }]);
  assertEquals(crowded.unplaced, [{ id: "pod", tons: 30, quantity: 1 }]);
});

Deno.test("applyModules adds cargo and fuel and keeps the better sensor", () => {
  const ship = blankDesign("cutter");
  ship.hullTons = 200;
  ship.sensors = "civilian";
  ship.computer = "core15";
  ship.fuelTons = 20;
  ship.power = 30;
  const pod = blankModule("pod");
  pod.hullTons = 30;
  pod.sensors = "military";
  pod.fuelTons = 8;
  pod.containerTons = 10;
  pod.mounts = [{ id: "gun", kind: "fixed", weapons: ["pulse"] }];
  const powered = blankModule("brain");
  powered.hullTons = 15;
  powered.powered = true;
  powered.techLevel = 15;
  powered.power = 20;
  powered.computer = "core30";
  powered.sensors = "basic";
  const shipProjection = projectShip(ship, [ship]);
  const podProjection = projectShip(pod, [pod]);
  const brainProjection = projectShip(powered, [powered]);
  const merged = applyModules(shipProjection, [
    { id: "pod", quantity: 1, design: pod },
    { id: "brain", quantity: 1, design: powered }
  ]);
  assertEquals(
    merged.cargo,
    shipProjection.cargo + podProjection.cargo + brainProjection.cargo
  );
  assertEquals(
    merged.fuelMax,
    shipProjection.fuelMax + podProjection.fuelMax + brainProjection.fuelMax
  );
  assertEquals(merged.pieces.find((piece) => piece.key === "fuel")?.rating, merged.fuelMax);
  const container = merged.pieces.find((piece) => piece.key.endsWith(":fuel-cargo"));
  assertEquals(container?.name, "Fuel/cargo container (10 t)");
  const withSpare = structuredClone(pod);
  withSpare.extraContainers = [{ id: "spare", tons: 4 }];
  const added = applyModules(shipProjection, [
    { id: "pod", quantity: 1, design: withSpare }
  ]);
  const containers = added.pieces.filter((piece) =>
    /(^|:)fuel-cargo(:|$)/.test(piece.key)
  );
  assertEquals(
    containers.map((piece) => piece.key),
    ["module:pod:0:fuel-cargo", "module:pod:0:fuel-cargo:spare"]
  );
  assertEquals(containers.map((piece) => piece.rating), [10, 4]);
  assertEquals(container?.system, "fuel");
  assertEquals(container?.rating, 10);
  assertEquals(container?.tons, 10.5);
  assertEquals(merged.pieces.find((piece) => piece.key === "cargo")?.rating, merged.cargo);
  assertEquals(merged.powerMax, shipProjection.powerMax + brainProjection.powerMax);
  assertEquals(merged.pieces.find((piece) => piece.key === "power")?.rating, merged.powerMax);
  assertEquals(merged.pieces.filter((piece) => piece.system === "power").length, 1);
  assertEquals(merged.pieces.find((piece) => piece.key === "sensors")?.name, "Military sensors");
  assertEquals(
    merged.pieces.find((piece) => piece.key === "computer")?.rating,
    shipProjection.pieces.find((piece) => piece.key === "computer")?.rating
  );
  assertEquals(merged.processing, shipProjection.processing);
  assertEquals(merged.jdrive, shipProjection.jdrive);
  assertEquals(merged.mdrive, shipProjection.mdrive);
  assertEquals(merged.armour, shipProjection.armour);
  assertEquals(
    merged.pieces.some((piece) =>
      [":j-drive", ":m-drive", ":armour", ":computer", ":bridge"].some((key) =>
        piece.key.endsWith(key)
      )
    ),
    false
  );
  assertEquals(
    merged.pieces.some((piece) => piece.key.startsWith("module:pod:") && piece.name === "Pulse laser"),
    true
  );
  assertEquals(
    merged.pieces.filter((piece) => piece.key === "computer").length,
    1
  );
  const doubled = applyModules(shipProjection, [{ id: "pod", quantity: 2, design: pod }]);
  assertEquals(doubled.cargo, shipProjection.cargo + podProjection.cargo * 2);
  assertEquals(
    doubled.pieces.filter((piece) => piece.name === "Pulse laser").length,
    2
  );
});

Deno.test("applyModules keeps a module fuel processor", () => {
  const ship = blankDesign("carrier");
  const pod = blankModule("refinery");
  pod.hullTons = 20;
  pod.processorTons = 1;
  const merged = applyModules(projectShip(ship, [ship]), [{
    id: "pod",
    quantity: 2,
    design: pod
  }]);
  const piece = merged.pieces.find((row) => row.key === "module:pod:fuel-processor");
  assertEquals(piece?.name, "Fuel processor (40 tons/day)");
  assertEquals(piece?.tons, 2);
  assertEquals(piece?.power, 2);
  assertEquals(piece?.rating, 40);
  assertEquals(piece?.cost, 0.1);
});

Deno.test("applyModules keeps a module external cargo mount as its own hold", () => {
  const ship = blankDesign("carrier");
  const pod = blankModule("rack");
  pod.hullTons = 20;
  pod.cargoGear = [{ id: "mount", kind: "external", quantity: 40 }];
  const shipProjection = projectShip(ship, [ship]);
  const podCargo = projectShip(pod, [pod]).pieces.find((row) => row.key === "cargo")?.rating ?? 0;
  const merged = applyModules(shipProjection, [{
    id: "pod",
    quantity: 1,
    design: pod
  }]);
  const hold = merged.pieces.find((row) => row.key === "cargo");
  const mount = merged.pieces.find((row) => row.key === "module:pod:cargo:external:mount");
  const shipCargo = shipProjection.pieces.find((row) => row.key === "cargo")?.rating ?? 0;
  assertEquals(hold?.rating, Math.round((shipCargo + podCargo) * 1000) / 1000);
  assertEquals(mount?.name, "External cargo mount");
  assertEquals(mount?.system, "cargo");
  assertEquals(mount?.rating, 40);
});

Deno.test("module fittings stay inside the reserved modular hull", () => {
  const cutter = blankDesign("cutter");
  cutter.hullTons = 50;
  cutter.hullOptions = [{ id: "bay", kind: "modular", tons: 30 }];
  const pod = blankModule("pod");
  pod.hullTons = 30;
  pod.accelerationSeats = 10;
  const ship = projectShip(cutter, [cutter, pod]);
  const merged = applyModules(ship, [{
    id: "pod",
    quantity: 1,
    design: pod,
    catalog: [pod]
  }]);
  assertEquals(merged.pieces.find((row) => row.key === "modular:bay")?.tons, 30);
  assertEquals(merged.enclosedTons, 30);
  const seats = merged.pieces.find((row) => row.key === "module:pod:stateroom");
  assertEquals(seats?.tons, 5);
  const shipCargo = ship.pieces.find((row) => row.key === "cargo")?.rating ?? 0;
  assertEquals(merged.pieces.find((row) => row.key === "cargo")?.rating, shipCargo + 25);
});
