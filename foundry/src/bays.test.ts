import { assertEquals } from "@std/assert";
import { blankDesign, blankModule } from "../../src/design.ts";
import { dockShipResult, occupyShipBays, projectBays, projectCarriedBays, clampedTonnage } from "./bays.ts";

Deno.test("projectBays puts empty berths on the docking bay and vehicles on the vehicle bay", () => {
  const design = blankDesign("carrier");
  design.docks = [
    { id: "open", craft: "empty", craftTons: 40 },
    { id: "raft", craft: "air-raft" },
    { id: "atv", craft: "atv" },
    { id: "berth", craft: "berth-15" },
    { id: "aboard", craft: "prospecting-buggy", stowed: true }
  ];
  assertEquals(projectBays(design), [
    {
      id: "open",
      kind: "ship",
      name: "40-ton berth",
      tons: 40,
      acceptsShip: true
    },
    {
      id: "raft",
      kind: "vehicle",
      name: "4-ton vehicle bay",
      tons: 4,
      acceptsShip: false,
      acceptsVehicle: true
    },
    {
      id: "atv",
      kind: "vehicle",
      name: "10-ton vehicle bay",
      tons: 10,
      acceptsShip: false,
      acceptsVehicle: true
    },
    {
      id: "berth",
      kind: "ship",
      name: "15-ton berth",
      tons: 15,
      acceptsShip: true
    }
  ]);
});

Deno.test("projectBays keeps a designed ship in its docking bay", () => {
  const carrier = blankDesign("carrier");
  const launch = blankDesign("launch");
  launch.name = "Launch";
  launch.hullTons = 20;
  carrier.docks = [{ id: "boat", craft: "launch" }];
  assertEquals(projectBays(carrier, [carrier, launch]), [
    {
      id: "boat",
      kind: "ship",
      name: "Launch",
      tons: 20,
      acceptsShip: false
    }
  ]);
});

Deno.test("occupyShipBays uses the smallest bay that fits", () => {
  const bays = [
    { id: "large", name: "40-ton berth", tons: 40 },
    { id: "small", name: "15-ton berth", tons: 15 }
  ];
  const placed = occupyShipBays(bays, [
    { actorId: "cutter", quantity: 1, tons: 30 },
    { actorId: "launch", quantity: 1, tons: 10 }
  ]);
  assertEquals(placed.bays.map((bay) => bay.actorId), ["cutter", "launch"]);
  assertEquals(placed.unplaced, []);
  assertEquals(
    dockShipResult(bays, [
      { actorId: "cutter", quantity: 1, tons: 30 },
      { actorId: "launch", quantity: 1, tons: 10 }
    ], "scout", 50),
    "large"
  );
  assertEquals(
    dockShipResult(bays, [
      { actorId: "cutter", quantity: 1, tons: 30 },
      { actorId: "launch", quantity: 1, tons: 10 }
    ], "boat", 12),
    "full"
  );
  assertEquals(dockShipResult([], [], "boat", 12), "empty");
});

Deno.test("docking clamps are ship docks sized to the clamp", () => {
  const design = blankDesign("tender");
  design.externalSystems = [
    { id: "small", kind: "clamp1", quantity: 2 },
    { id: "huge", kind: "clamp5", quantity: 1 }
  ];
  const bays = projectBays(design);
  assertEquals(bays.map((bay) => bay.name), [
    "Docking clamp (Type I)",
    "Docking clamp (Type I)",
    "Docking clamp (Type V)"
  ]);
  assertEquals(bays[0].tons, 30);
  assertEquals(bays[0].minTons, 1);
  assertEquals(bays[0].clamp, true);
  assertEquals(bays[0].acceptsShip, true);
  assertEquals(bays[2].minTons, 2001);
  assertEquals(Number.isFinite(bays[2].tons), false);
  const held = [{ actorId: "launch", quantity: 1, tons: 20 }];
  assertEquals(clampedTonnage(bays, held), 20);
  assertEquals(dockShipResult(bays, held, "boat", 10), "ok");
  assertEquals(dockShipResult(bays, held, "scout", 50), "range");
  design.docks = [{ id: "berth", craft: "berth-30" }];
  const mixed = projectBays(design);
  assertEquals(
    clampedTonnage(mixed, [{ actorId: "cutter", quantity: 1, tons: 30 }]),
    0
  );
  assertEquals(
    clampedTonnage(mixed, [
      { actorId: "cutter", quantity: 1, tons: 30 },
      { actorId: "launch", quantity: 1, tons: 20 }
    ]),
    20
  );
});

Deno.test("installed modules and breakaway hulls add their docks", () => {
  const ship = blankDesign("cutter");
  const pod = blankModule("pod");
  pod.docks = [{ id: "berth", craft: "berth-15" }];
  const wing = blankDesign("wing");
  wing.hullOptions = [{ id: "join", kind: "breakaway" }];
  wing.docks = [{ id: "open", craft: "empty", craftTons: 20 }];
  const bays = projectCarriedBays(ship, [ship, pod, wing], [
    { id: "module:pod", design: pod, quantity: 2, catalog: [pod] },
    { id: "breakaway:wing", design: wing, quantity: 1, catalog: [wing] }
  ]);
  assertEquals(bays.filter((bay) => bay.id.startsWith("module:pod:")).map((bay) => bay.id), [
    "module:pod:0:berth",
    "module:pod:1:berth"
  ]);
  assertEquals(bays.find((bay) => bay.id === "breakaway:wing:0:open")?.tons, 20);
});
